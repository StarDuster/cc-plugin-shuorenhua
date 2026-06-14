import { spawn } from "node:child_process";

import { buildAgyCommand, runAgy } from "./agy.mjs";

export function buildProviderCommand(provider, providerConfig = {}, model, prompt) {
  if (provider === "agy") {
    return buildAgyCommand(providerConfig, model, prompt);
  }

  const bin = providerConfig.bin || provider;
  const args = [];

  if (provider === "opencode") {
    args.push("run");
    if (model) {
      args.push("--model", model);
    }
    args.push(prompt);
  } else if (provider === "omp") {
    args.push("-p");
    if (model) {
      args.push("--model", model);
    }
    args.push(prompt);
  } else if (provider === "claude") {
    args.push("-p");
    if (model) {
      args.push("--model", model);
    }
    args.push(prompt);
  } else {
    throw new Error(`Unsupported provider "${provider}".`);
  }

  return { bin, args };
}

export async function runProvider({ provider, providerConfig = {}, model, prompt, cwd = process.cwd(), env = process.env }) {
  if (provider === "agy") {
    return runAgy({ providerConfig, model, prompt, cwd, env });
  }

  const { bin, args } = buildProviderCommand(provider, providerConfig, model, prompt);
  const timeoutMs = Number.parseInt(String(providerConfig.timeoutMs ?? 300000), 10);
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
  }, Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 300000);

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
  }).finally(() => clearTimeout(timer));

  if (timedOut) {
    throw new Error(`${provider} timed out after ${timeoutMs}ms.`);
  }
  if (result.code !== 0) {
    const detail = stderr.trim() || stdout.trim() || `exit code ${result.code}`;
    throw new Error(`${provider} failed: ${detail}`);
  }

  const output = stdout.trim();
  if (!output) {
    throw new Error(`${provider} returned empty output.`);
  }
  return output;
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
