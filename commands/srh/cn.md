---
description: Summarize current session in Chinese via Sonnet subagent (no extra CLI usage)
allowed-tools:
  - "Bash(${CLAUDE_PLUGIN_ROOT}/scripts/shuorenhua.mjs:*)"
  - Agent
---

The command to get the summarization prompt with transcript is:
!`printf '%s\n' "\"${CLAUDE_PLUGIN_ROOT}/scripts/shuorenhua.mjs\" prompt \"$ARGUMENTS\""`

You MUST spawn an Agent with model "sonnet". In the agent prompt, tell it to:
1. Run the command shown above using Bash
2. Read the output — it contains a Chinese summarization prompt with the full session transcript
3. Follow the instructions to produce a Chinese Markdown summary with sections: 一句话、当前状态、关键上下文、待办、风险
4. Return only the summary

Do NOT process the transcript yourself. Do NOT call agy or any external provider. Output the agent's result directly.
