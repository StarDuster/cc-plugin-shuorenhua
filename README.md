# cc-plugin-shuorenhua

Claude Code 插件，提供 `/srh` 命令：读取当前 session 的本地 transcript，发给你配置的模型，输出一份中文“人话摘要”。

适合把长对话快速整理成：当前目标、已完成内容、关键上下文、待办和风险。

## 安装

### 本地临时加载

```bash
claude --plugin-dir /Users/stardust/source/cc-plugin-shuorenhua
```

进入 Claude Code 后检查：

```text
/srh:setup
```

### 持久安装

```bash
claude plugin marketplace add /Users/stardust/source/cc-plugin-shuorenhua --scope user
claude plugin install srh@shuorenhua-local
```

重启 Claude Code 后运行：

```text
/srh:setup
```

更新：

```bash
claude plugin marketplace update shuorenhua-local
claude plugin update srh
```

卸载：

```bash
claude plugin uninstall srh
claude plugin marketplace remove shuorenhua-local
```

## 配置

在项目根目录创建 `.shuorenhua.json`：

```json
{
  "default": {
    "provider": "agy",
    "model": "Gemini 3.5 Flash (Medium)"
  }
}
```

也可以用用户配置 `~/.shuorenhua/config.json`，或环境变量：

```bash
export SHUORENHUA_PROVIDER=agy
export SHUORENHUA_MODEL="Gemini 3.5 Flash (Medium)"
```

优先级：

1. `/srh --provider ... --model ...`
2. 项目 `.shuorenhua.json`
3. 用户 `~/.shuorenhua/config.json`
4. 环境变量

支持的 provider：

- `agy`
- `opencode`
- `omp`
- `claude`

## 使用

### `/srh` — 外部 provider 摘要

通过配置的外部 CLI（agy、opencode、omp、claude）生成中文摘要：

```text
/srh
/srh --provider agy --model "Gemini 3.5 Flash (Medium)"
/srh --max-messages 80 --max-chars 60000
/srh --transcript /absolute/path/to/session.jsonl
```

### `/srh:cn` — 当前 session 内摘要

不调用外部 CLI，输出 prompt 文本，配合当前 Claude Code session 使用。适合主 session 跑 Opus 时用 Sonnet subagent 生成中文摘要，不产生额外 CLI 用量：

```text
/srh:cn
```

命令会输出 `scripts/shuorenhua.mjs prompt` 命令路径。复制执行后把输出交给 Agent（model: sonnet）处理即可。

### `prompt` 子命令

`/srh:cn` 背后调用的脚本子命令。只读取 transcript、构建 prompt 文本输出到 stdout，不调用任何 LLM：

```bash
node scripts/shuorenhua.mjs prompt
node scripts/shuorenhua.mjs prompt --max-messages 80 --max-chars 60000
node scripts/shuorenhua.mjs prompt --transcript /path/to/session.jsonl
```

### `/srh:setup` — 检查配置

```text
/srh:setup
```

如果 `/srh:setup` 没出现在命令列表里，可以试试 `/setup`。

## 工作方式

- 插件从 `~/.claude/projects/.../*.jsonl` 读取 Claude Code transcript。
- SessionStart hook 会记录当前 `session_id`，优先定位当前会话。
- 找不到当前 session 时，会回退到当前项目最新的 `.jsonl`。
- transcript 会原样发送给你配置的 provider，不默认脱敏。

## agy 调用安全策略

- Claude command 只允许执行插件自己的 `scripts/shuorenhua.mjs`。
- 插件用 Node `spawn` 参数数组调用 `agy`，不通过 shell 拼命令。
- 运行前会调用 `agy models`，确认配置的模型名存在。
- `agy` 的 stdout、stderr、metadata 会写到 `~/.cache/shuorenhua/...`，方便排错。
- debug 命令文件不会保存完整 transcript prompt，只写 `<prompt>` 占位。

## 注意

Claude Code transcript 可能包含代码、命令输出、路径、工具结果、环境信息或密钥。只把它发给你信任的模型和 CLI。

如果使用 `agy`，先确认已经登录；否则 `/srh:setup` 会显示 `agy models` 的登录提示。

## 开发

```bash
npm test
claude plugin validate .claude-plugin/plugin.json
claude plugin validate .claude-plugin/marketplace.json
```
