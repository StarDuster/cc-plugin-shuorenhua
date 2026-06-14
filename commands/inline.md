---
description: Summarize current session in Chinese via Sonnet directly, without external CLI usage
allowed-tools:
  - "Bash(${CLAUDE_PLUGIN_ROOT}/scripts/shuorenhua.mjs:*)"
  - Agent
---

Build the transcript summarization prompt with this command:
!`printf '%s\n' "\"${CLAUDE_PLUGIN_ROOT}/scripts/shuorenhua.mjs\" prompt \"$ARGUMENTS\""`

Immediately spawn an Agent with model "sonnet". In the agent prompt, tell it to:
1. Run the command shown above using Bash
2. Read the output — it contains a Chinese summarization prompt with the full session transcript
3. Follow the instructions to produce a Chinese Markdown summary with sections: 一句话、当前状态、关键上下文、待办、风险
4. Return only the summary

Do NOT process the transcript in the main session. Do NOT call agy or any external provider. Output the Sonnet agent's result directly.
