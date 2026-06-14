#!/usr/bin/env node

import process from "node:process";

import { parseArgs, parseIntegerOption } from "./lib/args.mjs";
import { DEFAULT_CONFIG, resolveRuntimeConfig } from "./lib/config.mjs";
import { buildSummaryPrompt } from "./lib/prompt.mjs";
import { runProvider } from "./lib/provider.mjs";
import { findExecutable, renderSetupReport, runCommand } from "./lib/setup.mjs";
import { findTranscriptFile, formatTranscriptMessages, parseTranscriptFile } from "./lib/transcript.mjs";

const VALUE_OPTIONS = ["provider", "model", "transcript", "max-messages", "max-chars", "config", "cwd", "session-id"];
const BOOLEAN_OPTIONS = ["json", "help"];

function printUsage() {
  process.stdout.write(
    [
      "Usage:",
      "  node scripts/shuorenhua.mjs summarize [--provider <agy|opencode|omp|claude>] [--model <model>] [--transcript <path>] [--max-messages N] [--max-chars N] [--json]",
      "  node scripts/shuorenhua.mjs setup [--json]",
      "",
      "Recommended first config:",
      '  { "default": { "provider": "agy", "model": "Gemini 3.5 Flash (Medium)" } }',
      ""
    ].join("\n")
  );
}

async function handleSummarize(argv) {
  const { options } = parseArgs(argv, {
    valueOptions: VALUE_OPTIONS,
    booleanOptions: BOOLEAN_OPTIONS
  });

  if (options.help) {
    printUsage();
    return;
  }

  const cwd = options.cwd ? String(options.cwd) : process.cwd();
  const runtime = resolveRuntimeConfig({
    cwd,
    env: process.env,
    cliOptions: {
      provider: options.provider,
      model: options.model,
      config: options.config
    }
  });

  const maxMessages = parseIntegerOption(options["max-messages"], "max-messages") ?? runtime.history.maxMessages ?? DEFAULT_CONFIG.history.maxMessages;
  const maxChars = parseIntegerOption(options["max-chars"], "max-chars") ?? runtime.history.maxChars ?? DEFAULT_CONFIG.history.maxChars;
  const transcriptFile = findTranscriptFile({
    cwd,
    env: process.env,
    transcriptPath: options.transcript,
    sessionId: options["session-id"]
  });
  const messages = parseTranscriptFile(transcriptFile, { maxMessages, maxChars });
  const transcriptText = formatTranscriptMessages(messages);

  const prompt = buildSummaryPrompt({
    transcriptText,
    cwd,
    transcriptFile,
    provider: runtime.provider,
    model: runtime.model
  });
  const output = await runProvider({
    provider: runtime.provider,
    providerConfig: runtime.providerConfig,
    model: runtime.model,
    prompt,
    cwd,
    env: process.env
  });

  if (options.json) {
    process.stdout.write(
      `${JSON.stringify(
        {
          provider: runtime.provider,
          model: runtime.model,
          transcriptFile,
          messages: messages.length,
          output
        },
        null,
        2
      )}\n`
    );
    return;
  }

  process.stdout.write(`${output}\n`);
}

async function handleSetup(argv) {
  const { options } = parseArgs(argv, {
    valueOptions: VALUE_OPTIONS,
    booleanOptions: BOOLEAN_OPTIONS
  });
  const cwd = options.cwd ? String(options.cwd) : process.cwd();
  const runtime = resolveRuntimeConfig({
    cwd,
    env: process.env,
    cliOptions: {
      provider: options.provider,
      model: options.model,
      config: options.config
    },
    requireDefault: false
  });

  const bins = ["node", "agy", "opencode", "omp", "claude"];
  const binaries = bins.map((name) => ({ name, path: findExecutable(name, process.env) }));
  let agyModels = null;
  if (runtime.provider === "agy" || !runtime.provider) {
    const agyPath = binaries.find((item) => item.name === "agy")?.path;
    if (agyPath) {
      const result = runCommand(agyPath, ["models"], { env: process.env, timeoutMs: 15000 });
      agyModels = result.ok ? result.stdout : result.stderr || result.stdout || result.error || "agy models failed";
    }
  }

  const report = {
    binaries,
    userConfigPath: runtime.userConfigPath,
    projectConfigPath: runtime.projectConfigPath,
    provider: runtime.provider,
    model: runtime.model,
    agyModels
  };

  if (options.json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    process.stdout.write(renderSetupReport(report));
  }
}

async function handlePrompt(argv) {
  const { options } = parseArgs(argv, {
    valueOptions: VALUE_OPTIONS,
    booleanOptions: BOOLEAN_OPTIONS
  });

  const cwd = options.cwd ? String(options.cwd) : process.cwd();
  const runtime = resolveRuntimeConfig({
    cwd,
    env: process.env,
    cliOptions: { config: options.config },
    requireDefault: false
  });

  const maxMessages = parseIntegerOption(options["max-messages"], "max-messages") ?? runtime.history.maxMessages ?? DEFAULT_CONFIG.history.maxMessages;
  const maxChars = parseIntegerOption(options["max-chars"], "max-chars") ?? runtime.history.maxChars ?? DEFAULT_CONFIG.history.maxChars;
  const transcriptFile = findTranscriptFile({
    cwd,
    env: process.env,
    transcriptPath: options.transcript,
    sessionId: options["session-id"]
  });
  const messages = parseTranscriptFile(transcriptFile, { maxMessages, maxChars });
  const transcriptText = formatTranscriptMessages(messages);

  const prompt = buildSummaryPrompt({
    transcriptText,
    cwd,
    transcriptFile,
    provider: "inline",
    model: "sonnet"
  });

  process.stdout.write(`${prompt}\n`);
}

async function main() {
  const [subcommand = "summarize", ...argv] = process.argv.slice(2);
  if (subcommand === "summarize" || subcommand === "srh") {
    await handleSummarize(argv);
  } else if (subcommand === "setup") {
    await handleSetup(argv);
  } else if (subcommand === "prompt") {
    await handlePrompt(argv);
  } else if (subcommand === "help" || subcommand === "--help" || subcommand === "-h") {
    printUsage();
  } else {
    throw new Error(`Unknown subcommand "${subcommand}".`);
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
