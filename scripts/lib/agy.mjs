import { spawn, spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const DEFAULT_TIMEOUT_MS = 300000;
const DEFAULT_MODEL_LIST_TIMEOUT_MS = 15000;

export function buildAgyCommand(providerConfig = {}, model, prompt) {
  const bin = providerConfig.bin || "agy";
  validateAgyModelText(model);
  return {
    bin,
    args: ["--print", "--model", model, prompt]
  };
}

export function listAgyModels({ bin = "agy", env = process.env, timeoutMs = DEFAULT_MODEL_LIST_TIMEOUT_MS } = {}) {
  const result = spawnSync(bin, ["models"], {
    env,
    encoding: "utf8",
    timeout: timeoutMs
  });

  if (result.error) {
    return {
      ok: false,
      models: [],
      message: result.error.message
    };
  }

  const stdout = result.stdout ?? "";
  const stderr = result.stderr ?? "";
  if (result.status !== 0) {
    return {
      ok: false,
      models: [],
      message: stderr.trim() || stdout.trim() || `exit code ${result.status}`
    };
  }

  return {
    ok: true,
    models: stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean),
    message: ""
  };
}

export async function runAgy({ providerConfig = {}, model, prompt, cwd = process.cwd(), env = process.env } = {}) {
  const { bin, args } = buildAgyCommand(providerConfig, model, prompt);
  const timeoutMs = positiveInteger(providerConfig.timeoutMs, DEFAULT_TIMEOUT_MS);
  const runDir = createAgyRunDir({ cwd, env, configuredDir: providerConfig.cacheDir });
  const stdoutFile = path.join(runDir, "agy-run.out");
  const stderrFile = path.join(runDir, "agy-run.log");
  const commandFile = path.join(runDir, "agy-run.cmd");
  const metadataFile = path.join(runDir, "metadata.json");

  writeCommandDebugFile(commandFile, { bin, args, cwd, timeoutMs });

  if (providerConfig.validateModel !== false) {
    const modelList = listAgyModels({
      bin,
      env,
      timeoutMs: positiveInteger(providerConfig.modelListTimeoutMs, DEFAULT_MODEL_LIST_TIMEOUT_MS)
    });
    if (!modelList.ok) {
      writeMetadata(metadataFile, {
        tool: "agy",
        model,
        status: "model_list_error",
        error: modelList.message
      });
      throw new Error(`agy models failed before run: ${modelList.message}\nDebug logs: ${runDir}`);
    }
    if (!modelList.models.includes(model)) {
      writeMetadata(metadataFile, {
        tool: "agy",
        model,
        status: "model_not_found",
        availableModels: modelList.models
      });
      throw new Error(
        [
          `Configured agy model not found: ${model}`,
          "Available agy models:",
          ...modelList.models.map((name) => `- ${name}`),
          `Debug logs: ${runDir}`
        ].join("\n")
      );
    }
  }

  const startedAt = new Date();
  const child = spawn(bin, args, {
    cwd,
    env,
    stdio: ["ignore", "pipe", "pipe"],
    detached: process.platform !== "win32"
  });

  let stdout = "";
  let stderr = "";
  let timedOut = false;

  const timer = setTimeout(() => {
    timedOut = true;
    terminateProcess(child);
  }, timeoutMs);

  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    stdout += chunk;
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });

  const result = await new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (code, signal) => resolve({ code, signal }));
  })
    .catch((error) => ({ code: null, signal: null, spawnError: error }))
    .finally(() => clearTimeout(timer));

  fs.writeFileSync(stdoutFile, stdout, "utf8");
  fs.writeFileSync(stderrFile, stderr, "utf8");

  const durationMs = Date.now() - startedAt.getTime();
  const baseMetadata = {
    tool: "agy",
    model,
    timeoutMs,
    durationMs,
    startedAt: startedAt.toISOString(),
    runDir,
    stdoutFile,
    stderrFile
  };

  if (result.spawnError) {
    writeMetadata(metadataFile, {
      ...baseMetadata,
      status: "spawn_error",
      error: result.spawnError.message
    });
    throw new Error(`agy failed to start: ${result.spawnError.message}\nDebug logs: ${runDir}`);
  }

  if (timedOut) {
    writeMetadata(metadataFile, {
      ...baseMetadata,
      status: "timeout",
      exitCode: 124
    });
    throw new Error(`agy timed out after ${timeoutMs}ms.\nDebug logs: ${runDir}`);
  }

  if (result.code !== 0) {
    writeMetadata(metadataFile, {
      ...baseMetadata,
      status: "error",
      exitCode: result.code,
      signal: result.signal
    });
    const detail = lastLines(stderr || stdout, 20) || `exit code ${result.code}`;
    throw new Error(`agy failed: ${detail}\nDebug logs: ${runDir}`);
  }

  const output = stdout.trim();
  if (!output) {
    writeMetadata(metadataFile, {
      ...baseMetadata,
      status: "empty_response",
      exitCode: 0
    });
    const detail = lastLines(stderr, 20);
    throw new Error(`agy returned empty output.${detail ? `\nagy stderr:\n${detail}` : ""}\nDebug logs: ${runDir}`);
  }

  writeMetadata(metadataFile, {
    ...baseMetadata,
    status: "success",
    exitCode: 0
  });
  return output;
}

export function validateAgyModelText(model) {
  if (model == null || !String(model).trim()) {
    throw new Error("Missing agy model.");
  }
  const normalized = String(model);
  if (normalized.length > 200) {
    throw new Error("agy model name is too long.");
  }
  if (/[\u0000-\u001f\u007f]/u.test(normalized)) {
    throw new Error("agy model name contains control characters.");
  }
}

function createAgyRunDir({ cwd, env, configuredDir }) {
  const id = `${new Date().toISOString().replace(/[:.]/g, "-")}-${process.pid}-${crypto.randomBytes(4).toString("hex")}`;
  const baseDir = configuredDir
    ? path.resolve(cwd, configuredDir)
    : path.join(env.XDG_CACHE_HOME || path.join(env.HOME || os.homedir(), ".cache"), "shuorenhua", sanitizePath(cwd));
  const runDir = path.join(baseDir, `agy-run-${id}`);
  fs.mkdirSync(runDir, { recursive: true });
  return runDir;
}

function sanitizePath(value) {
  return path.resolve(value).replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-");
}

function writeCommandDebugFile(filePath, { bin, args, cwd, timeoutMs }) {
  const debugArgs = args.map((arg, index) => (index === args.length - 1 ? "<prompt>" : arg));
  fs.writeFileSync(
    filePath,
    [
      "# Shuorenhua agy invocation debug info",
      `# Timestamp: ${new Date().toISOString()}`,
      `# Working directory: ${cwd}`,
      `# Timeout: ${timeoutMs}ms`,
      "",
      `${bin} ${debugArgs.map(shellQuoteForDisplay).join(" ")}`,
      ""
    ].join("\n"),
    "utf8"
  );
}

function writeMetadata(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function positiveInteger(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function lastLines(text, count) {
  return String(text ?? "")
    .trim()
    .split(/\r?\n/)
    .slice(-count)
    .join("\n")
    .trim();
}

function shellQuoteForDisplay(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function terminateProcess(child) {
  if (!child.pid) {
    return;
  }
  try {
    if (process.platform !== "win32") {
      process.kill(-child.pid, "SIGTERM");
    } else {
      child.kill("SIGTERM");
    }
  } catch {
    try {
      child.kill("SIGTERM");
    } catch {
      // Ignore best-effort termination failures.
    }
  }
}
