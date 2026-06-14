import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export function encodeClaudeProjectPath(cwd) {
  return path.resolve(cwd).replace(/[\\/]/g, "-");
}

export function resolveClaudeHome(env = process.env) {
  return env.CLAUDE_HOME || path.join(env.HOME || os.homedir(), ".claude");
}

export function resolveProjectTranscriptDir(cwd, env = process.env) {
  return path.join(resolveClaudeHome(env), "projects", encodeClaudeProjectPath(cwd));
}

export function findTranscriptFile({ cwd = process.cwd(), env = process.env, sessionId = null, transcriptPath = null } = {}) {
  if (transcriptPath) {
    const resolved = path.resolve(cwd, transcriptPath);
    if (!fs.existsSync(resolved)) {
      throw new Error(`Transcript file does not exist: ${resolved}`);
    }
    return resolved;
  }

  const projectDir = resolveProjectTranscriptDir(cwd, env);
  if (!fs.existsSync(projectDir)) {
    throw new Error(`Claude transcript directory does not exist for this cwd: ${projectDir}`);
  }

  const jsonlFiles = fs
    .readdirSync(projectDir)
    .filter((name) => name.endsWith(".jsonl"))
    .map((name) => path.join(projectDir, name));

  if (jsonlFiles.length === 0) {
    throw new Error(`No Claude transcript .jsonl files found in ${projectDir}`);
  }

  const normalizedSessionId = normalizeString(sessionId ?? env.SHUORENHUA_SESSION_ID);
  if (normalizedSessionId) {
    const exactPath = path.join(projectDir, `${normalizedSessionId}.jsonl`);
    if (fs.existsSync(exactPath)) {
      return exactPath;
    }
    const matchingFile = jsonlFiles.find((filePath) => fileContainsSessionId(filePath, normalizedSessionId));
    if (matchingFile) {
      return matchingFile;
    }
  }

  return jsonlFiles
    .map((filePath) => ({ filePath, mtimeMs: fs.statSync(filePath).mtimeMs }))
    .sort((left, right) => right.mtimeMs - left.mtimeMs)[0].filePath;
}

export function parseTranscriptFile(filePath, options = {}) {
  const raw = fs.readFileSync(filePath, "utf8");
  const entries = [];

  for (const [index, line] of raw.split(/\r?\n/).entries()) {
    if (!line.trim()) {
      continue;
    }
    let record;
    try {
      record = JSON.parse(line);
    } catch (error) {
      throw new Error(`Invalid JSONL at ${filePath}:${index + 1}: ${error.message}`);
    }
    const message = transcriptRecordToMessage(record);
    if (message) {
      entries.push(message);
    }
  }

  return trimMessages(entries, options);
}

export function transcriptRecordToMessage(record) {
  if (!record || record.isSidechain) {
    return null;
  }

  const role = record.message?.role || record.type;
  if (role !== "user" && role !== "assistant") {
    return null;
  }

  const content = extractMessageContent(record.message?.content);
  if (!content.trim()) {
    return null;
  }

  return {
    role,
    timestamp: record.timestamp ?? null,
    uuid: record.uuid ?? null,
    content: content.trim()
  };
}

export function formatTranscriptMessages(messages) {
  return messages
    .map((message) => {
      const timestamp = message.timestamp ? ` ${message.timestamp}` : "";
      return `### ${message.role.toUpperCase()}${timestamp}\n${message.content}`;
    })
    .join("\n\n");
}

export function trimMessages(messages, { maxMessages = 120, maxChars = 120000 } = {}) {
  const normalizedMaxMessages = positiveInteger(maxMessages, 120);
  const normalizedMaxChars = positiveInteger(maxChars, 120000);
  let selected = messages;

  if (selected.length > normalizedMaxMessages) {
    const first = selected[0];
    const tail = selected.slice(-(normalizedMaxMessages - 1));
    selected = tail.includes(first) ? tail : [first, ...tail];
  }

  const rendered = selected.map((message) => ({ message, text: formatTranscriptMessages([message]) }));
  const totalChars = rendered.reduce((sum, item) => sum + item.text.length + 2, 0);
  if (totalChars <= normalizedMaxChars) {
    return selected;
  }

  const kept = [];
  let used = 0;
  for (let index = rendered.length - 1; index >= 0; index -= 1) {
    const item = rendered[index];
    const nextSize = item.text.length + 2;
    if (used + nextSize > normalizedMaxChars) {
      continue;
    }
    kept.push(item.message);
    used += nextSize;
  }
  kept.reverse();

  const first = selected[0];
  if (first && !kept.includes(first)) {
    const firstText = formatTranscriptMessages([first]);
    if (used + firstText.length + 2 <= normalizedMaxChars) {
      kept.unshift(first);
    }
  }

  return kept.length > 0 ? kept : [truncateMessage(selected.at(-1), normalizedMaxChars)];
}

function extractMessageContent(content) {
  if (content == null) {
    return "";
  }
  if (typeof content === "string") {
    return content;
  }
  if (!Array.isArray(content)) {
    return objectSummary(content);
  }

  return content
    .map((part) => {
      if (typeof part === "string") {
        return part;
      }
      if (!part || typeof part !== "object") {
        return "";
      }
      if (part.type === "text") {
        return part.text ?? "";
      }
      if (part.type === "tool_use") {
        return `[tool_use ${part.name ?? "unknown"}]\n${objectSummary(part.input ?? {})}`;
      }
      if (part.type === "tool_result") {
        return `[tool_result ${part.tool_use_id ?? ""}]\n${extractMessageContent(part.content)}`;
      }
      if (part.text) {
        return part.text;
      }
      return objectSummary(part);
    })
    .filter(Boolean)
    .join("\n");
}

function objectSummary(value) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function fileContainsSessionId(filePath, sessionId) {
  const raw = fs.readFileSync(filePath, "utf8");
  return raw.includes(`"sessionId":"${sessionId}"`) || raw.includes(`"session_id":"${sessionId}"`);
}

function truncateMessage(message, maxChars) {
  const contentLimit = Math.max(200, maxChars - 80);
  const content = message.content.length > contentLimit ? `${message.content.slice(0, contentLimit)}\n[truncated]` : message.content;
  return { ...message, content };
}

function positiveInteger(value, fallback) {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeString(value) {
  if (value == null) {
    return null;
  }
  const normalized = String(value).trim();
  return normalized || null;
}
