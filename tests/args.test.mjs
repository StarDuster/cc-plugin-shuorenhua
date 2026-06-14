import assert from "node:assert/strict";
import test from "node:test";

import { parseArgs, splitRawArgumentString } from "../scripts/lib/args.mjs";

test("splitRawArgumentString handles quotes and escapes", () => {
  assert.deepEqual(splitRawArgumentString('--provider agy --model "gemini flash" hello\\ world'), [
    "--provider",
    "agy",
    "--model",
    "gemini flash",
    "hello world"
  ]);
});

test("parseArgs handles value, boolean, and positional args", () => {
  const parsed = parseArgs(['--provider agy --model="gemini-flash" --json tail'], {
    valueOptions: ["provider", "model"],
    booleanOptions: ["json"]
  });

  assert.deepEqual(parsed.options, {
    provider: "agy",
    model: "gemini-flash",
    json: true
  });
  assert.deepEqual(parsed.positionals, ["tail"]);
});
