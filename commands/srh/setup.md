---
description: Check Shuorenhua provider configuration and available local CLIs
argument-hint: "[--provider agy|opencode|omp|claude] [--model <model>] [--json]"
disable-model-invocation: true
allowed-tools: Bash(node:*)
---

!`node "${CLAUDE_PLUGIN_ROOT}/scripts/shuorenhua.mjs" setup "$ARGUMENTS"`
