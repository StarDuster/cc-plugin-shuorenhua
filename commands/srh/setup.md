---
description: Check Shuorenhua provider configuration and available local CLIs
argument-hint: "[--provider agy|opencode|omp|claude] [--model <model>] [--json]"
disable-model-invocation: true
allowed-tools: "Bash(${CLAUDE_PLUGIN_ROOT}/scripts/shuorenhua.mjs:*)"
---

!`"${CLAUDE_PLUGIN_ROOT}/scripts/shuorenhua.mjs" setup "$ARGUMENTS"`
