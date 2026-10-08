---
title: MCP server setup
description: Set up the SigMap MCP server for Claude Code, Cursor, and Windsurf. On-demand codebase access with 22 tools over stdio. Zero npm install.
head:
  - - meta
    - property: og:title
      content: "SigMap MCP Server — on-demand codebase context"
  - - meta
    - property: og:description
      content: "Give Claude Code, Cursor, and Windsurf on-demand access to your codebase signatures. 22 MCP tools over stdio."
  - - meta
    - property: og:url
      content: "https://sigmap.io/guide/mcp"
  - - meta
    - property: og:type
      content: article
  - - meta
    - name: keywords
      content: "sigmap mcp, sigmap mcp server, claude code mcp, cursor mcp, windsurf mcp, codebase context mcp"
---
# MCP server setup

Give Claude Code, Cursor, and Windsurf on-demand access to your codebase signatures. Zero npm install.

The SigMap MCP server exposes 22 tools over the stdio Model Context Protocol. Your AI agent calls only what it needs — keeping token costs low.

> **Setup time: under 2 minutes.** Use `sigmap --setup` for automatic configuration.

## Auto-setup (recommended)

One command detects your editor config and wires everything up automatically.

```bash
sigmap --setup
```

`--setup` detects `.claude/settings.json` and `.cursor/mcp.json` automatically, then adds the sigmap MCP server entry to each one it finds. It also installs a git post-commit hook and starts the file watcher.

```
[sigmap] registered MCP server in .claude/settings.json
[sigmap] registered MCP server in .cursor/mcp.json
[sigmap] installed .git/hooks/post-commit
[sigmap] watching for changes (Ctrl+C to stop)…
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

## Spec conformance

The server is verified against the black-box [`@hasmcp/mcp-spec-test`](https://www.npmjs.com/package/@hasmcp/mcp-spec-test) conformance suite. As of v8.35.0 both tested revisions report **conformant on what could be checked** — 14/0 on 2025-11-25 and 13/0 on 2026-07-28 (remaining skips are capabilities the server honestly does not advertise: it is tools-only).

- `initialize` negotiates against an explicit supported-version list (`2025-11-25` … `2024-11-05`). An unsupported or absent offer gets the newest supported version — never an echo of a version the server cannot speak.
- `server/discover` (spec 2026-07-28) is answered session-less, before any handshake, with the honest version list, capabilities, identity, and cache hints — so clients can discover instead of offer-and-hope.
- `tools/list` rejects pagination cursors it never issued with `-32602` rather than silently restarting from page one.

## 22 available tools

::: tip New in v6.3.0 — native tool registration
Claude Code and Codex now receive the full tool list at MCP startup without a discovery round-trip. The server declares all 22 tools in the `initialize` response, so your AI sees them immediately. No config change needed — upgrade via `npm install -g sigmap@latest`.
:::

All tools are available on-demand — your AI agent calls only what it needs.

| Tool | What it does | Arg(s) | Example call |
|------|-------------|--------|-------------|
| `read_context` | Returns signatures for the full codebase or a specific module path. Outputs ~50–500 tokens depending on scope. | `module` (optional string) | `read_context(module="src/auth")` |
| `search_signatures` | Case-insensitive keyword search across all extracted signatures. Returns matching lines grouped by file. | `query` (required string) | `search_signatures(query="handleRequest")` |
| `get_map` | Returns a section from PROJECT_MAP.md: import graph, class hierarchy, route table, or (v8.5) environment variables, build & CI, config & manifests, or database migrations. | `type` ("imports"\|"classes"\|"routes"\|"env"\|"buildci"\|"manifests"\|"migrations") | `get_map(type="migrations")` |
| `explain_file` | Returns signatures, imports, and reverse callers for a single file. | `path` (required string) | `explain_file(path="src/auth/service.ts")` |
| `list_modules` | Returns a token-count table of top-level source directories. Use this first to decide which module to load. | none | `list_modules()` |
| `create_checkpoint` | Records session progress with a git state snapshot. | `summary` (required string) | `create_checkpoint(summary="Added rate limiting")` |
| `get_routing` | Returns the model tier hints table (fast / balanced / powerful per file) based on complexity scores. | none | `get_routing()` |
| `query_context` | Ranks all files by relevance to a free-text query using TF-IDF scoring. Returns top-K files. New in v2.3. | `query` (required string), `topK` (optional number, default 10) | `query_context(query="authentication flow")` |
| `get_impact` | Returns the blast radius of a file — direct importers, transitive importers, affected tests and routes. Since v8.43 a cached view over the knowledge map: affected tests include discovered test↔impl edges, not just importing test files. | `file` (required string), `depth` (optional number, default 3) | `get_impact(file="src/auth/service.ts")` |
| `get_method_impact` | **Method-level blast radius** — every function that (transitively) calls a symbol, or with `direction="callees"` everything it calls. Finer-grained than `get_impact`: which *functions* break, not just which files. JS/TS, Python, Java, Go, Rust. New in v8.13. | `symbol` (required string, name or `file#name`), `direction` (optional "callers"\|"callees"), `depth` (optional number, default 0 = unlimited) | `get_method_impact(symbol="validateToken")` |
| `get_lines` | **Surgical Context** demand-driven fetch: returns an exact line range from a file behind a `:start-end` anchor. Clamped to file bounds, secret-scanned, sandboxed to the project root. New in v6.12.0. | `file` (required string), `start` (required number), `end` (required number) | `get_lines(file="src/config/loader.js", start=42, end=58)` |
| `read_memory` | **Memory** — recall the cross-session decision log (notes left via `sigmap note`) plus the last `ask` session focus. Kills agent cold-start. New in v6.15.0. | `limit` (optional number, default 10) | `read_memory(limit=10)` |
| `get_diff_context` | Returns every changed file (working tree, staged, or vs a base ref) with its current signatures + blast radius (importers, tests, routes) + risk label. Lists files shell-free. New in v8.0. | `base` (optional string), `staged` (optional bool), `depth` (optional number, default 2) | `get_diff_context(base="main")` |
| `get_architecture_overview` | One-call codebase map: module breakdown (files/tokens), most-depended-on hub files, dependency-cycle count, route totals. Since v8.43 every section derives from the cached knowledge map — route totals count real route nodes. Extends `get_map`. New in v8.0. | none | `get_architecture_overview()` |
| `verify_suggestion` | Ground an AI code suggestion before writing it — verify a snippet against the repo **and the libraries actually installed** in `node_modules` (the grounding moat); flags fake files/imports/symbols/scripts and reports the installed libraries verified against with pinned versions. New in v8.2. | `code` (required string) | `verify_suggestion(code="const r = Router()")` |
| `squeeze_output` | Compress noisy tool/command/agent output — a stack trace, CI/build log, or JSON payload — before it enters context. Same deterministic, offline engine as `sigmap squeeze`: keeps the signal, strips the noise, enriches the top stack frame. Passes the input through unchanged when nothing is squeezable. New in v8.8. | `content` (required string) | `squeeze_output(content="Traceback…")` |
| `get_budget` | Session spend ledger — estimated tokens SigMap emitted this session (chars/4, from the local gain log), optional budget remaining, and context freshness. Counts only SigMap output, not the whole chat. Advises degrade-gracefully tactics (terse, squeeze, summarize-then-drop) at ≥80% budget. New in v8.23. | `session` (optional string) · `budgetTokens` (optional number) | `get_budget(budgetTokens=50000)` |
| `get_callee_signatures` | Returns the **exact current signature(s)** of named symbols from the index — so the model never guesses a callee’s parameters from training memory. Unknown names get a closest-match suggestion. New in v7.19. | `symbols` (required string[]) | `get_callee_signatures(symbols=["loadConfig"])` |
| `sigmap_notify_file_created` | Live-index write hook: tells SigMap a file was created or modified so its signatures are indexed for the rest of the session — new symbols become resolvable by `search_signatures` / `get_callee_signatures` immediately. New in v7.21. | `path` (required string), `content` (optional string) | `sigmap_notify_file_created(path="src/new.js")` |
| `sigmap_notify_symbol_added` | Fast path: registers a single new symbol signature in the live index without re-reading the whole file. New in v7.21. | `signature` (required string), `file` (required string), `line` (optional number) | `sigmap_notify_symbol_added(signature="function retry(fn, n)", file="src/util/retry.js")` |
| `sigmap_notify_file_deleted` | Live-index write hook: drops a deleted file’s symbols from the live index. New in v7.21. | `path` (required string) | `sigmap_notify_file_deleted(path="src/old.js")` |
| `query_knowledge_map` | **Unified knowledge map** — typed nodes (file, symbol, library@version, route, env-var, migration, script) and edges (imports, calls, defines, tests, uses-lib, exposes-route, reads-env) assembled from SigMap’s existing graphs. `library` answers upgrade impact (lib → importing files → their dependents → covering tests); `file` returns every typed edge touching one file; `env` (v8.42) returns the files reading an environment variable and whether a committed `.env.example` declares it; no args returns the node/edge summary. New in v8.41. | `library` · `file` · `env` (all optional strings) | `query_knowledge_map(env="DATABASE_URL")` |

## Your agent's live loop

SigMap doesn't compete with your agent's live search — it's what the live loop **calls for grounding**. Agentic grep is superb at *finding* a file and terrible at *proving* anything about it: it can't tell you a symbol's exact signature, what breaks if you change it, or whether the call your model is about to write actually exists. Five tools cover that gap, and each is deterministic, byte-stable, and auditable — the same inputs return the same bytes, every time:

| Loop step | Tool | What the agent gets |
|---|---|---|
| "Which files matter for this task?" | `query_context` | Ranked files with scores and explain signals — reproducible, no embeddings |
| "What exactly can I call here?" | `get_callee_signatures` | Exact signatures for the symbols in scope, before the model writes a call |
| "Show me just those lines" | `get_lines` | The anchored `:start-end` range — no whole-file dumps |
| "What breaks if I change this?" | `get_method_impact` | Every function that transitively calls the symbol (JS/TS, Python, Java, Go, Rust) |
| "Is this suggestion real?" | `verify_suggestion` | The snippet checked against the repo **and the libraries actually installed** |

The canonical sequence: your agent greps (or asks) its way to a candidate area → `query_context` confirms and ranks → `get_callee_signatures` + `get_lines` ground the exact surface → the model writes code → `verify_suggestion` proves the calls exist → `get_method_impact` sizes the blast radius before committing. Grep finds; SigMap grounds.

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

Send a raw JSON-RPC request to confirm the server starts and returns all 22 tool definitions.

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
      { "name": "query_context" },
      { "name": "get_method_impact" },
      { "name": "get_impact" },
      { "name": "get_lines" },
      { "name": "read_memory" },
      { "name": "get_diff_context" },
      { "name": "get_architecture_overview" }
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
