import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { resolveRuntimeConfig } from "../scripts/lib/config.mjs";

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "srh-config-"));
}

test("resolveRuntimeConfig uses project over user over env", () => {
  const root = makeTempDir();
  const home = makeTempDir();
  const nested = path.join(root, "packages", "app");
  fs.mkdirSync(nested, { recursive: true });
  fs.mkdirSync(path.join(home, ".shuorenhua"), { recursive: true });

  fs.writeFileSync(
    path.join(home, ".shuorenhua", "config.json"),
    JSON.stringify({ default: { provider: "omp", model: "sonnet" } }),
    "utf8"
  );
  fs.writeFileSync(
    path.join(root, ".shuorenhua.json"),
    JSON.stringify({ default: { provider: "agy", model: "gemini-flash" } }),
    "utf8"
  );

  const runtime = resolveRuntimeConfig({
    cwd: nested,
    env: {
      HOME: home,
      SHUORENHUA_PROVIDER: "claude",
      SHUORENHUA_MODEL: "sonnet"
    }
  });

  assert.equal(runtime.provider, "agy");
  assert.equal(runtime.model, "gemini-flash");
});

test("resolveRuntimeConfig uses CLI options over files", () => {
  const root = makeTempDir();
  const home = makeTempDir();
  fs.writeFileSync(
    path.join(root, ".shuorenhua.json"),
    JSON.stringify({ default: { provider: "agy", model: "gemini-flash" } }),
    "utf8"
  );

  const runtime = resolveRuntimeConfig({
    cwd: root,
    env: { HOME: home },
    cliOptions: { provider: "opencode", model: "google/gemini-flash" }
  });

  assert.equal(runtime.provider, "opencode");
  assert.equal(runtime.model, "google/gemini-flash");
});

test("resolveRuntimeConfig reports missing default", () => {
  const root = makeTempDir();
  const home = makeTempDir();
  assert.throws(
    () => resolveRuntimeConfig({ cwd: root, env: { HOME: home } }),
    /No \/srh provider configured/
  );
});
