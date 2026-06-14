import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  encodeClaudeProjectPath,
  findTranscriptFile,
  formatTranscriptMessages,
  parseTranscriptFile,
  resolveProjectTranscriptDir
} from "../scripts/lib/transcript.mjs";

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "srh-transcript-"));
}

function writeJsonl(filePath, records) {
  fs.writeFileSync(filePath, `${records.map((record) => JSON.stringify(record)).join("\n")}\n`, "utf8");
}

test("encodeClaudeProjectPath matches Claude project directory convention", () => {
  assert.equal(encodeClaudeProjectPath("/Users/stardust/source/openclaw"), "-Users-stardust-source-openclaw");
});

test("findTranscriptFile prefers session id and falls back to newest transcript", () => {
  const root = makeTempDir();
  const home = path.join(root, "home");
  const cwd = path.join(root, "repo");
  fs.mkdirSync(cwd, { recursive: true });

  const projectDir = resolveProjectTranscriptDir(cwd, { HOME: home });
  fs.mkdirSync(projectDir, { recursive: true });
  const oldFile = path.join(projectDir, "old.jsonl");
  const sessionFile = path.join(projectDir, "abc123.jsonl");
  writeJsonl(oldFile, [{ type: "user", sessionId: "old", message: { role: "user", content: "old" } }]);
  writeJsonl(sessionFile, [{ type: "user", sessionId: "abc123", message: { role: "user", content: "new" } }]);
  fs.utimesSync(oldFile, new Date(Date.now() - 100000), new Date(Date.now() - 100000));
  fs.utimesSync(sessionFile, new Date(), new Date());

  assert.equal(findTranscriptFile({ cwd, env: { HOME: home }, sessionId: "abc123" }), sessionFile);
  assert.equal(findTranscriptFile({ cwd, env: { HOME: home } }), sessionFile);
});

test("parseTranscriptFile extracts main user, assistant, and tool result text", () => {
  const root = makeTempDir();
  const filePath = path.join(root, "session.jsonl");
  writeJsonl(filePath, [
    { type: "queue-operation", operation: "enqueue", content: "skip" },
    {
      type: "user",
      timestamp: "2026-06-14T01:00:00.000Z",
      message: { role: "user", content: "实现 /srh 插件" }
    },
    {
      type: "assistant",
      timestamp: "2026-06-14T01:01:00.000Z",
      message: {
        role: "assistant",
        content: [
          { type: "text", text: "我会先检查仓库。" },
          { type: "tool_use", name: "Bash", input: { command: "ls" } }
        ]
      }
    },
    {
      type: "user",
      timestamp: "2026-06-14T01:02:00.000Z",
      message: {
        role: "user",
        content: [{ type: "tool_result", tool_use_id: "toolu_1", content: "README.md\n" }]
      }
    },
    {
      type: "assistant",
      isSidechain: true,
      message: { role: "assistant", content: "skip sidechain" }
    }
  ]);

  const messages = parseTranscriptFile(filePath, { maxMessages: 10, maxChars: 10000 });
  assert.equal(messages.length, 3);
  const rendered = formatTranscriptMessages(messages);
  assert.match(rendered, /实现 \/srh 插件/);
  assert.match(rendered, /\[tool_use Bash\]/);
  assert.match(rendered, /README\.md/);
  assert.doesNotMatch(rendered, /skip sidechain/);
});

test("parseTranscriptFile keeps the first message and latest tail when trimming by count", () => {
  const root = makeTempDir();
  const filePath = path.join(root, "session.jsonl");
  writeJsonl(
    filePath,
    Array.from({ length: 6 }, (_, index) => ({
      type: index % 2 === 0 ? "user" : "assistant",
      message: { role: index % 2 === 0 ? "user" : "assistant", content: `message ${index}` }
    }))
  );

  const messages = parseTranscriptFile(filePath, { maxMessages: 3, maxChars: 10000 });
  assert.deepEqual(
    messages.map((message) => message.content),
    ["message 0", "message 4", "message 5"]
  );
});
