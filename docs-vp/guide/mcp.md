---
title: MCP server setup
description: Set up the SigMap MCP server for Claude Code, Codex CLI, OpenCode, Cursor, and Windsurf. On-demand codebase access with 22 tools over stdio. Zero npm install.
head:
  - - meta
    - property: og:title
      content: "SigMap MCP Server — on-demand codebase context"
  - - meta
    - property: og:description
      content: "Give Claude Code, Codex CLI, OpenCode, Cursor, and Windsurf on-demand access to your codebase signatures. 22 MCP tools over stdio."
  - - meta
    - property: og:url
      content: "https://sigmap.io/guide/mcp"
  - - meta
    - property: og:type
      content: article
  - - meta
    - name: keywords
      content: "sigmap mcp, sigmap mcp server, claude code mcp, codex mcp, opencode mcp, cursor mcp, windsurf mcp, codebase context mcp"
---
# MCP server setup

Give Claude Code, Codex CLI, OpenCode, Cursor, and Windsurf on-demand access to your codebase signatures. No setup-time npm install is needed.

The SigMap MCP server exposes 22 tools over the stdio Model Context Protocol (all of them by default; [`mcp.tools`](#tool-profiles-core-or-all) lets a project advertise fewer). Your AI agent calls only what it needs — keeping token costs low.

> **Setup time: under 2 minutes.** Use `sigmap --setup` for automatic configuration.

## Auto-setup (recommended)

One command detects your editor config and wires everything up automatically.

```bash
sigmap --setup
```

`--setup` detects existing MCP config files, writes each host's supported format, migrates older SigMap entries, then installs a git post-commit hook and starts the file watcher. Claude Code uses the project `.mcp.json`; Codex CLI uses `~/.codex/config.toml`; OpenCode uses `opencode.json` or `~/.config/opencode/opencode.json`.

```
[sigmap] Claude Code: registered MCP server in .mcp.json
[sigmap] registered MCP server in .cursor/mcp.json
[sigmap] Codex CLI: registered MCP server in ~/.codex/config.toml
[sigmap] OpenCode: registered MCP server in opencode.json
[sigmap] installed .git/hooks/post-commit
[sigmap] watching for changes (Ctrl+C to stop)…
```

## Manual config — Claude Code

Claude Code reads project MCP servers from `.mcp.json`.

`sigmap mcp install claude` writes this file and checks it with `claude mcp list` when the CLI is installed. Claude Code asks you to approve the server on first use.

SigMap marks its task-oriented `query_context` tool to load upfront in Claude Code's tool search, so the first codebase question can discover the right files without requiring a separate search step.

```json
{
  "mcpServers": {
    "sigmap": {
      "command": "npx",
      "args": ["-y", "sigmap", "--mcp"]
    }
  }
}
```

## Manual config — Codex CLI

Codex CLI reads MCP server entries from `$CODEX_HOME/config.toml`, defaulting to `~/.codex/config.toml`:

```toml
[mcp_servers.sigmap]
command = "npx"
args = ["-y", "sigmap", "--mcp"]
```

`sigmap mcp install codex` writes this table, migrates the old SigMap entry out of `config.yaml`, and checks it with `codex mcp list` when the CLI is installed. The command honors `CODEX_HOME` when it is set.

## Manual config — OpenCode

OpenCode uses an `mcp` object and an array for a local server command. The project file is `opencode.json`; the global file is `~/.config/opencode/opencode.json`.

```json
{
  "mcp": {
    "sigmap": {
      "type": "local",
      "command": ["npx", "-y", "sigmap", "--mcp"],
      "enabled": true
    }
  }
}
```

`sigmap mcp install opencode` writes this shape and checks it with `opencode mcp list` when the CLI is installed.

## Manual config — Cursor

Add sigmap to your Cursor MCP configuration file at `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "sigmap": {
      "command": "node",
      "args": ["/path/to/your/project/gen-context.js", "--mcp"]
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
Claude Code and Codex now receive the full tool list at MCP startup without a discovery round-trip. The server answers `tools/list` with all 22 tools (the `initialize` response itself declares only the `tools` capability), so a host that fetches the list when it starts the server has them immediately. No config change needed — upgrade via `npm install -g sigmap@latest`.
:::

All tools are available on-demand — your AI agent calls only what it needs. All 22 are advertised by default; [`mcp.tools`](#tool-profiles-core-or-all) lets a project advertise fewer.

| Tool | What it does | Arg(s) | Example call |
|------|-------------|--------|-------------|
| `read_context` | Returns signatures for the full codebase or a specific module path. Outputs ~50–500 tokens depending on scope. | `module` (optional string) | `read_context(module="src/auth")` |
| `search_signatures` | Case-insensitive keyword search across all extracted signatures. Returns matching lines grouped by file. | `query` (required string) | `search_signatures(query="handleRequest")` |
| `get_map` | Returns a section from PROJECT_MAP.md: import graph, class hierarchy, route table, or (v8.5) environment variables, build & CI, config & manifests, or database migrations. | `type` ("imports"\|"classes"\|"routes"\|"env"\|"buildci"\|"manifests"\|"migrations") | `get_map(type="migrations")` |
| `explain_file` | Returns signatures, imports, and reverse callers for a single file. | `path` (required string) | `explain_file(path="src/auth/service.ts")` |
| `list_modules` | Returns a token-count table of top-level source directories. Use this first to decide which module to load. | none | `list_modules()` |
| `create_checkpoint` | Records session progress with a git state snapshot. | `note` (optional string) | `create_checkpoint(note="Added rate limiting")` |
| `get_routing` | Returns the model tier hints table (fast / balanced / powerful per file) based on complexity scores. | none | `get_routing()` |
| `query_context` | Ranks all files by relevance to a free-text query using TF-IDF scoring. Returns top-K files. New in v2.3. | `query` (required string), `topK` (optional number, default 10) | `query_context(query="authentication flow")` |
| `get_impact` | Returns the blast radius of a file — direct importers, transitive importers, affected tests and routes. Since v8.43 a cached view over the knowledge map: affected tests include discovered test↔impl edges, not just importing test files. Reads fifteen language families, with Swift at module level; the edges are measured against each language's own tooling in [import-graph accuracy](/guide/import-accuracy). | `file` (required string), `depth` (optional number, default 3) | `get_impact(file="src/auth/service.ts")` |
| `get_method_impact` | **Method-level blast radius** — every function that (transitively) calls a symbol, or with `direction="callees"` everything it calls. Finer-grained than `get_impact`: which *functions* break, not just which files. JS/TS, Python, Java, Go, Rust. New in v8.13. A **lower bound**: measured against compiler-derived edges, it finds most plain `f()` calls in Go and none of the calls through a receiver (`x.m()`) outside Java — [call-graph accuracy](/guide/callgraph-accuracy). | `symbol` (required string, name or `file#name`), `direction` (optional "callers"\|"callees"), `depth` (optional number, default 0 = unlimited) | `get_method_impact(symbol="validateToken")` |
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

### Opt-in: `log_session_usage`

One more tool exists, and it is **not** among the 22. It lets an agent SigMap has no hook integration for — Cursor, Windsurf, Codex CLI, Gemini CLI, OpenCode — report its own token usage so the session shows up in [`sigmap --report --sessions`](/guide/cli#sessions-report). It is listed in `tools/list` (and answers `tools/call`) only when the project sets `session.mcpCapture: true`; otherwise it is absent, so you pay none of its definition tokens and the default surface is the 22 above.

| Tool | Returns | Parameters |
|---|---|---|
| `log_session_usage` | The session as the store now holds it, with its provenance label. Recorded as `agent-reported`: SigMap cannot verify it, and it is never merged into `measured` totals. | `id` (optional string — omit for one id per MCP connection) · `model` (optional string) · `usage` (optional object `{ in, out, cacheRead?, cacheWrite? }` — `in` and `out` required) |

Send the session's **running totals** at the end of a task; a later call for the same session replaces the earlier one. An omitted cache category is stored as unknown (`n/a`), not `0`. Missing or invalid `usage` is recorded as `unavailable` with the reason returned — never as zeros, and never over a usable earlier report. A measured transcript of the same session (Claude Code hooks) outranks a self-report.

## Tool profiles: core or all

Every tool definition is sent to your agent at the start of every MCP session — about 2.5k tokens for all 22 — whether or not it is ever called, and each one is another thing for the model to choose between. `mcp.tools` in `gen-context.config.json` decides how many the server advertises:

| `mcp.tools` | Tools advertised | Definition tokens | Use when |
|---|---|---|---|
| `"all"` (the default; also what an absent key means) | all 22 | ~2.5k | you use the live-index notify tools, checkpoints, the knowledge map or the architecture views |
| `"core"` | 7 — `query_context`, `read_context`, `get_callee_signatures`, `get_lines`, `get_impact`, `get_method_impact`, `verify_suggestion` (the five tools of the [live loop](#your-agent-s-live-loop) below, plus `read_context` and `get_impact`) | ~0.9k | the agent only needs the retrieval + grounding loop |
| `["get_lines", "verify_suggestion"]` | exactly the names listed | by list | you want a tighter or different set |

Token figures are chars/4 of the serialized `tools/list`, the estimate SigMap uses everywhere; `sigmap doctor` prints the exact figure for your project (counting `log_session_usage` when [`session.mcpCapture`](#opt-in-log-session-usage) is on), and what `core` would cost if you are on `all`.

```json
{ "mcp": { "tools": "core" } }
```

- **`sigmap mcp install` does not choose a profile.** It registers the server in your client's config and writes nothing into your repository, so a plain `sigmap mcp install claude` advertises all 22 tools. `sigmap --init` is what writes `{ "mcp": { "autoRegister": true, "tools": "core" } }`; to get the 7-tool profile after an install, add the snippet above to `gen-context.config.json`. A project that already has a config keeps whatever it has.
- **The profile applies to `tools/call` too.** A tool the server does not advertise is refused with a message that names the setting rather than answered anyway — otherwise the setting would be a suggestion, not a switch. A name that is not a tool at all still reads `Unknown tool`.
- **`log_session_usage` is not part of any profile.** It exists only when [`session.mcpCapture`](#opt-in-log-session-usage) is on, whatever `mcp.tools` says.
- **It is read once, and held for as long as it runs** — when the server first handles a `tools/list`, a `tools/call` or a `server/discover` (`initialize` does not read it), like the tool list your editor caches. Restart the server (or the editor) after changing it.
- **A value SigMap cannot read never breaks the server.** A string that is not `all` or `core`, an empty list, a value of the wrong type, or an `mcp` that is not an object: the server falls back to `all`. Names in a list that are not tools are dropped and the rest are served. A key beside `tools` that SigMap does not read (`mcp.tool`, say) is ignored, so a typo in the key itself leaves `all`. `sigmap doctor` warns in every case and says what it did instead.
- **Existing configs keep every tool.** With no `mcp.tools` key you get the same 22 tools, with the same names, parameter names, types, enums and `required` lists as before. Their descriptions are shorter — all 22 tool descriptions and 15 of the 33 parameter descriptions — so a client that validates arguments sees no difference and one that shows or caches the description text sees different text. `sigmap --init` writes `"core"` into a **new** config, wherever it runs, and never rewrites one that exists; `--output`, `tune --apply` and `roots --fix` can also create a config, but write only the keys they set, so a config created by one of them keeps all 22.
- **Some guidance below names tools `core` does not advertise.** The workflows under [Three common MCP workflows](#three-common-mcp-workflows) use `explain_file` and `list_modules`; on `core`, rank with `query_context` and read a module with `read_context(module=...)`. The agent skills and the wiki that mention MCP tools also give a CLI alternative (`sigmap note`, `sigmap budget`, `sigmap squeeze`), and the wiki lists only the tools your project advertises. A refused call says why and who can change it.

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

Send a raw JSON-RPC request to confirm the server starts and returns its tool definitions (all 22, unless [`mcp.tools`](#tool-profiles-core-or-all) narrows them).

```bash
echo '{"jsonrpc":"2.0","method":"tools/list","id":1}' | node gen-context.js --mcp
```

Expected output (abridged: the real reply lists every tool the profile advertises, in the server's own order, and each entry also carries a `description` and an `inputSchema`):

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

**Option 1 — file watcher:** Run `sigmap --watch` in a terminal while you code. Every file save is patched into the live index within a fraction of a second, so the tools that rank through the index (`search_signatures`, `query_context`, …) see it at once. `read_context` serves the written context file, which is regenerated after a short quiet window ([how it works](/guide/cli#watch)), so it keeps the old content until the watcher has been quiet for `watchSettleMs` (the timer restarts on every save) and that regeneration has finished, and says so in its stale-index banner. Best for active coding sessions.

**Option 2 — git hook (recommended):** Run `sigmap --setup` once. It installs a `.git/hooks/post-commit` hook that regenerates context automatically on every commit. More reliable than the watcher across sleep/wake cycles.


---

<div style="text-align:center;margin-top:2.5rem;padding-bottom:.5rem;font-size:0.85em;color:var(--vp-c-text-3)">
  Made in Amsterdam, Netherlands <span title="Netherlands">🇳🇱</span>
</div>
