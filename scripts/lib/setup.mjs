import { spawnSync } from "node:child_process";

export function findExecutable(bin, env = process.env) {
  const result = spawnSync("sh", ["-lc", `command -v ${shellQuote(bin)}`], {
    env,
    encoding: "utf8"
  });
  if (result.status !== 0) {
    return null;
  }
  return result.stdout.trim() || null;
}

export function runCommand(bin, args = [], { env = process.env, timeoutMs = 10000 } = {}) {
  const result = spawnSync(bin, args, {
    env,
    encoding: "utf8",
    timeout: timeoutMs
  });
  return {
    ok: result.status === 0,
    status: result.status,
    signal: result.signal,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    error: result.error?.message ?? null
  };
}

export function renderSetupReport(report) {
  const lines = ["# Shuorenhua setup", ""];

  lines.push("## Binaries");
  for (const item of report.binaries) {
    lines.push(`- ${item.name}: ${item.path ? `ok (${item.path})` : "missing"}`);
  }

  lines.push("", "## Config");
  lines.push(`- user config: ${report.userConfigPath}`);
  lines.push(`- project config: ${report.projectConfigPath ?? "not found"}`);
  lines.push(`- provider: ${report.provider ?? "not configured"}`);
  lines.push(`- model: ${report.model ?? "not configured"}`);

  if (!report.provider || !report.model) {
    lines.push(
      "",
      "Create `.shuorenhua.json` in the project root, for example:",
      "",
      "```json",
      JSON.stringify(
        {
          default: {
            provider: "agy",
            model: "gemini-flash"
          }
        },
        null,
        2
      ),
      "```"
    );
  }

  if (report.agyModels) {
    lines.push("", "## agy models");
    lines.push("```text");
    lines.push(report.agyModels.trim() || "(no output)");
    lines.push("```");
  }

  return `${lines.join("\n")}\n`;
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}
