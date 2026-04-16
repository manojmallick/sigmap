---
title: MCP server setup
description: Set up the SigMap MCP server for Claude Code, Cursor, and Windsurf. On-demand codebase access with 8 tools over stdio. Zero npm install.
head:
  - - meta
    - property: og:title
      content: "SigMap MCP Server — on-demand codebase context"
  - - meta
    - property: og:description
      content: "Give Claude Code, Cursor, and Windsurf on-demand access to your codebase signatures. 8 MCP tools over stdio."
  - - meta
    - property: og:url
      content: "https://manojmallick.github.io/sigmap/guide/mcp"
  - - meta
    - property: og:type
      content: article
  - - meta
    - name: keywords
      content: "sigmap mcp, sigmap mcp server, claude code mcp, cursor mcp, windsurf mcp, codebase context mcp"
---
# MCP server setup

Give Claude Code, Cursor, and Windsurf on-demand access to your codebase signatures. Zero npm install.

The SigMap MCP server exposes 8 tools over the stdio Model Context Protocol. Your AI agent calls only what it needs — keeping token costs low.

> **Setup time: under 2 minutes.** Use `sigmap --setup` for automatic configuration.

## Auto-setup (recommended)

One command detects your editor config and wires everything up automatically.

```bash
sigmap --setup
```

`--setup` detects `.claude/settings.json` and `.cursor/mcp.json` automatically, then adds the sigmap MCP server entry to each one it finds. It also installs a git post-commit hook and starts the file watcher.

```
[sigmap] ✓ detected .claude/settings.json
[sigmap] ✓ added MCP server entry → .claude/settings.json
[sigmap] ✓ detected .cursor/mcp.json
[sigmap] ✓ added MCP server entry → .cursor/mcp.json
[sigmap] ✓ installed .git/hooks/post-commit
[sigmap] ✓ watcher started on src/ app/ lib/
```

## Manual config — Claude Code

Add the sigmap MCP server to your Claude Code settings file.

Use `.claude/settings.json` in your project root for project-level access, or `~/.claude/settings.json` for global access across all projects. The absolute path in `args` must point to the actual `gen-context.js` file on disk.

```json
{
  "mcpServers": {
    "sigmap": {
      "command": "node",
      "args": ["/absolute/path/to/your/project/gen-context.js", "--mcp"]
    }
  }
}
```

## Manual config — Cursor

Add sigmap to your Cursor MCP configuration file at `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "sigmap": {
      "command": "node",
      "args": ["/absolute/path/to/your/project/gen-context.js", "--mcp"]
    }
  }
}
```

## SigMap + Repomix together

Stack both MCP servers for the two-layer context strategy — SigMap for always-on signatures, Repomix for deep ad-hoc sessions.

```json
{
  "mcpServers": {
    "sigmap": {
      "command": "node",
      "args": ["/path/to/project/gen-context.js", "--mcp"]
    },
    "repomix": {
      "command": "npx",
      "args": ["-y", "@repomix/mcp@latest"]
    }
  }
}
```

## 8 available tools

All tools are available on-demand — your AI agent calls only what it needs.

| Tool | What it does | Arg(s) | Example call |
|------|-------------|--------|-------------|
| `read_context` | Returns signatures for the full codebase or a specific module path. Outputs ~50–500 tokens depending on scope. | `module` (optional string) | `read_context(module="src/auth")` |
| `search_signatures` | Case-insensitive keyword search across all extracted signatures. Returns matching lines grouped by file. | `query` (required string) | `search_signatures(query="handleRequest")` |
| `get_map` | Returns import graph, class hierarchy, or route table from PROJECT_MAP.md. | `type` ("imports"\|"classes"\|"routes") | `get_map(type="routes")` |
| `explain_file` | Returns signatures, imports, and reverse callers for a single file. | `path` (required string) | `explain_file(path="src/auth/service.ts")` |
| `list_modules` | Returns a token-count table of top-level source directories. Use this first to decide which module to load. | none | `list_modules()` |
| `create_checkpoint` | Records session progress with a git state snapshot. | `summary` (required string) | `create_checkpoint(summary="Added rate limiting")` |
| `get_routing` | Returns the model tier hints table (fast / balanced / powerful per file) based on complexity scores. | none | `get_routing()` |
| `query_context` | Ranks all files by relevance to a free-text query using TF-IDF scoring. Returns top-K files. New in v2.3. | `query` (required string), `topK` (optional number, default 10) | `query_context(query="authentication flow")` |

## Token cost per tool call

Use `list_modules()` first and `read_context(module=...)` to stay efficient.

| Tool call | Approx. tokens |
|-----------|---------------|
| `read_context()` (full codebase) | 200–4,000 |
| `read_context(module="src/auth")` | 20–500 |
| `search_signatures(query="login")` | 10–200 |
| `get_map(type="routes")` | 50–800 |
| `explain_file(path="...")` | 30–400 |
| `list_modules()` | 20–100 |

## Three common MCP workflows

### 1. Debug a bug

Use `query_context(query="...")` to rank the likely files, then `explain_file(path="...")` on the most relevant result.

### 2. Understand a module

Start with `list_modules()`, then `read_context(module="src/auth")` or another focused module path instead of loading the whole codebase.

### 3. Verify an AI answer

Use `ask` to create `.context/query-context.md`, let the model answer, then run [judge](/guide/judge) against that same context file to check groundedness.

## Test the server

Send a raw JSON-RPC request to confirm the server starts and returns all 8 tool definitions.

```bash
echo '{"jsonrpc":"2.0","method":"tools/list","id":1}' | node gen-context.js --mcp
```

Expected output:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "tools": [
      { "name": "read_context" },
      { "name": "search_signatures" },
      { "name": "get_map" },
      { "name": "explain_file" },
      { "name": "list_modules" },
      { "name": "create_checkpoint" },
      { "name": "get_routing" },
      { "name": "query_context" }
    ]
  }
}
```

## Keep context fresh

The MCP server reads whatever context file is on disk. Keep that file up to date and every tool call reflects your latest code.

**Option 1 — file watcher:** Run `sigmap --watch` in a terminal while you code. Every file save triggers an incremental regeneration. Best for active coding sessions.

**Option 2 — git hook (recommended):** Run `sigmap --setup` once. It installs a `.git/hooks/post-commit` hook that regenerates context automatically on every commit. More reliable than the watcher across sleep/wake cycles.


---

<div style="text-align:center;margin-top:2.5rem;padding-bottom:.5rem;font-size:0.85em;color:var(--vp-c-text-3)">
  Made in Amsterdam, Netherlands <span title="Netherlands">🇳🇱</span>
</div>
