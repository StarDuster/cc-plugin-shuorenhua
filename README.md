# cc-plugin-shuorenhua

`cc-plugin-shuorenhua` is a Claude Code plugin that adds `/srh`. It reads the
current Claude Code session transcript from `~/.claude/projects/.../*.jsonl`,
sends it to a configured model route, and returns a concise Chinese handoff.

The intended default route is `agy` with a Gemini Flash model, but the plugin
does not hard-code a model. Configure the exact model slug used by your local
CLI.

## 安装

### 方式一：临时加载（开发时推荐）

在任意项目里启动 Claude Code 时带上这个插件目录：

```bash
claude --plugin-dir /Users/stardust/source/cc-plugin-shuorenhua
```

进入 Claude Code 后运行：

```text
/srh:setup
```

如果命令列表没有显示 `/srh:setup`，也可以试 `/setup`。主命令是：

```text
/srh
```

### 方式二：持久安装

这个仓库已经包含本地 marketplace 文件。先把仓库加入 Claude Code 的
marketplace 列表：

```bash
claude plugin marketplace add /Users/stardust/source/cc-plugin-shuorenhua --scope user
```

然后安装插件：

```bash
claude plugin install srh@shuorenhua-local
```

重启 Claude Code 后检查：

```text
/srh:setup
```

更新插件代码后，刷新 marketplace 并更新插件：

```bash
claude plugin marketplace update shuorenhua-local
claude plugin update srh
```

卸载：

```bash
claude plugin uninstall srh
claude plugin marketplace remove shuorenhua-local
```

### 前置条件

- Node.js 18.18 或更高版本。
- 至少配置一个 provider CLI：`agy`、`opencode`、`omp` 或 `claude`。
- 如果用推荐的 `agy` + Gemini Flash，先确保 `agy` 已登录；否则
  `/srh:setup` 会显示 `agy models` 的登录提示。

## Configure

Create `.shuorenhua.json` in the project root:

```json
{
  "default": {
    "provider": "agy",
    "model": "gemini-flash"
  }
}
```

You can also use `~/.shuorenhua/config.json` or environment variables:

```bash
export SHUORENHUA_PROVIDER=agy
export SHUORENHUA_MODEL=gemini-flash
```

Config precedence is:

1. Slash command args, such as `/srh --provider agy --model gemini-flash`
2. Project `.shuorenhua.json`
3. User `~/.shuorenhua/config.json`
4. Environment variables

Full config shape:

```json
{
  "default": {
    "provider": "agy",
    "model": "gemini-flash"
  },
  "providers": {
    "agy": { "bin": "agy", "timeoutMs": 300000 },
    "opencode": { "bin": "opencode", "timeoutMs": 300000 },
    "omp": { "bin": "omp", "timeoutMs": 300000 },
    "claude": { "bin": "claude", "timeoutMs": 300000 }
  },
  "history": {
    "maxMessages": 120,
    "maxChars": 120000
  }
}
```

## Commands

```text
/srh
/srh --provider agy --model gemini-flash
/srh --transcript ~/.claude/projects/-Users-me-source-app/<session-id>.jsonl
/srh --max-messages 80 --max-chars 60000
/srh:setup
/setup
```

Provider invocation:

- `agy`: `agy --print --model <model> <prompt>`
- `opencode`: `opencode run --model <model> <prompt>`
- `omp`: `omp -p --model <model> <prompt>`
- `claude`: `claude -p --model <model> <prompt>`

`/srh:setup` attempts `agy models` when the selected provider is `agy`. If agy
is not signed in, it will show agy's login message instead of treating that as a
plugin failure.

## Transcript Lookup

The SessionStart hook stores the active Claude `session_id` in
`SHUORENHUA_SESSION_ID`. `/srh` uses that first, then falls back to the newest
`.jsonl` transcript under the current cwd's Claude project directory.

You can bypass lookup with:

```text
/srh --transcript /absolute/path/to/session.jsonl
```

## Privacy

First version behavior is intentionally simple: transcript content is sent to
the configured provider as-is. Claude Code transcripts can include code,
commands, paths, tool outputs, environment snippets, credentials, or other
private data. Use a trusted provider/model route.

## Development

```bash
npm test
```

The test suite uses only Node's built-in `node:test` runner.
