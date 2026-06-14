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
      "if (args[0] === 'models') { console.log('Gemini 3.5 Flash (Medium)'); process.exit(0); }",
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
    model: "Gemini 3.5 Flash (Medium)",
    prompt: "hello",
    cwd: dir
  });

  assert.equal(output, "model=Gemini 3.5 Flash (Medium); prompt=hello");
});

test("runProvider reports provider stderr on failure", async () => {
  const dir = makeTempDir();
  const fake = path.join(dir, "fake-failure.mjs");
  fs.writeFileSync(
    fake,
    [
      "#!/usr/bin/env node",
      "const args = process.argv.slice(2);",
      "if (args[0] === 'models') { console.log('gemini-flash'); process.exit(0); }",
      "console.error('not signed in');",
      "process.exit(2);"
    ].join("\n"),
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

test("runProvider rejects an agy model that is not listed by agy models", async () => {
  const dir = makeTempDir();
  const marker = path.join(dir, "should-not-run");
  const fake = path.join(dir, "fake-model-list.mjs");
  fs.writeFileSync(
    fake,
    [
      "#!/usr/bin/env node",
      "const fs = await import('node:fs');",
      "const args = process.argv.slice(2);",
      "if (args[0] === 'models') { console.log('safe-model'); process.exit(0); }",
      `fs.writeFileSync(${JSON.stringify(marker)}, 'ran');`,
      "console.log('unexpected');"
    ].join("\n"),
    "utf8"
  );
  fs.chmodSync(fake, 0o755);

  await assert.rejects(
    () =>
      runProvider({
        provider: "agy",
        providerConfig: { bin: fake, timeoutMs: 10000 },
        model: "missing-model",
        prompt: "hello",
        cwd: dir
      }),
    /Configured agy model not found/
  );
  assert.equal(fs.existsSync(marker), false);
});

test("buildProviderCommand rejects agy model control characters", () => {
  assert.throws(() => buildProviderCommand("agy", {}, "bad\nmodel", "hello"), /control characters/);
});
