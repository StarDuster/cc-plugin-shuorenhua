import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { buildProviderCommand, runProvider } from "../scripts/lib/provider.mjs";

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "srh-provider-"));
}

test("buildProviderCommand builds supported provider commands", () => {
  assert.deepEqual(buildProviderCommand("agy", {}, "gemini-flash", "hello"), {
    bin: "agy",
    args: ["--print", "--model", "gemini-flash", "hello"]
  });
  assert.deepEqual(buildProviderCommand("opencode", {}, "google/gemini-flash", "hello"), {
    bin: "opencode",
    args: ["run", "--model", "google/gemini-flash", "hello"]
  });
  assert.deepEqual(buildProviderCommand("omp", {}, "sonnet", "hello"), {
    bin: "omp",
    args: ["-p", "--model", "sonnet", "hello"]
  });
  assert.deepEqual(buildProviderCommand("claude", {}, "sonnet", "hello"), {
    bin: "claude",
    args: ["-p", "--model", "sonnet", "hello"]
  });
});

test("runProvider returns stdout from a fake agy provider", async () => {
  const dir = makeTempDir();
  const fake = path.join(dir, "fake-provider.mjs");
  fs.writeFileSync(
    fake,
    [
      "#!/usr/bin/env node",
      "const args = process.argv.slice(2);",
      "const model = args[args.indexOf('--model') + 1];",
      "const prompt = args.at(-1);",
      "console.log(`model=${model}; prompt=${prompt}`);"
    ].join("\n"),
    "utf8"
  );
  fs.chmodSync(fake, 0o755);

  const output = await runProvider({
    provider: "agy",
    providerConfig: { bin: fake, timeoutMs: 10000 },
    model: "gemini-flash",
    prompt: "hello",
    cwd: dir
  });

  assert.equal(output, "model=gemini-flash; prompt=hello");
});

test("runProvider reports provider stderr on failure", async () => {
  const dir = makeTempDir();
  const fake = path.join(dir, "fake-failure.mjs");
  fs.writeFileSync(
    fake,
    ["#!/usr/bin/env node", "console.error('not signed in');", "process.exit(2);"].join("\n"),
    "utf8"
  );
  fs.chmodSync(fake, 0o755);

  await assert.rejects(
    () =>
      runProvider({
        provider: "agy",
        providerConfig: { bin: fake, timeoutMs: 10000 },
        model: "gemini-flash",
        prompt: "hello",
        cwd: dir
      }),
    /agy failed: not signed in/
  );
});
