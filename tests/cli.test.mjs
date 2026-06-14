import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const CLI = path.join(ROOT, "scripts", "shuorenhua.mjs");

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "srh-cli-"));
}

test("setup --json reports missing config without failing", () => {
  const dir = makeTempDir();
  const home = path.join(dir, "home");
  fs.mkdirSync(home, { recursive: true });

  const result = spawnSync(process.execPath, [CLI, "setup", "--json"], {
    cwd: dir,
    env: { ...process.env, HOME: home, SHUORENHUA_PROVIDER: "", SHUORENHUA_MODEL: "" },
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.provider, null);
  assert.equal(report.model, null);
  assert.ok(Array.isArray(report.binaries));
});
