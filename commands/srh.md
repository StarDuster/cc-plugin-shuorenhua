---
description: Translate the current Claude Code session into Chinese plain-language notes
argument-hint: "[--provider agy|opencode|omp|claude] [--model <model>] [--transcript <path>] [--max-messages N] [--max-chars N] [--json]"
disable-model-invocation: true
allowed-tools: "Bash(${CLAUDE_PLUGIN_ROOT}/scripts/shuorenhua.mjs:*)"
---

!`"${CLAUDE_PLUGIN_ROOT}/scripts/shuorenhua.mjs" summarize "$ARGUMENTS"`
