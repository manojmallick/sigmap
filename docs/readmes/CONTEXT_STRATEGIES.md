# SigMap — Context Strategies

SigMap supports four output strategies (`full`, `index`, `per-module` and `hot-cold`)
controlled by the `"strategy"` key in `gen-context.config.json`. Each trades off token
cost, context completeness, and MCP dependency differently. This guide explains when to
use each one with concrete examples.

> **Measured sizes and the `index` strategy are on [sigmap.io/guide/strategies](https://sigmap.io/guide/strategies).**
> The token profiles below (`arbi-platform`) are one small project at an early version: read them as the
> shape of each layout, not as figures to plan with. The sizes depend on the file your tool reads
> (`CLAUDE.md`, `AGENTS.md` or the Copilot file), which this page's profiles do not distinguish.

---

## Quick comparison

| Strategy | Always-injected tokens | Context lost? | Needs MCP? | Best for |
|---|---|---|---|---|
| `full` | All the signatures that fit the budget; grows with the repository | Yes, files over the budget (most of the repositories measured lost some) | No | A small repository, or a tool that can run neither commands nor MCP |
| `index` | A map with no signatures, a few hundred tokens | No: the retrieval index holds every file | No (`sigmap ask`) | What `sigmap --init` writes; agents that run `sigmap ask` |
| `per-module` | A short overview that grows with the number of top-level modules | Yes, files over a module's own budget | No | Clear module boundaries, one module file at a time |
| `hot-cold` | The files changed in the last `hotCommits` commits, with no cap | No: cold files are not injected, not dropped | No (`sigmap ask` returns cold files; MCP is another way) | A repository with history, when recent work should be in front of the agent |

---

## Strategy 1: `full` (default)

### What it does

One file. All signatures. Injected on every question.

```
.github/copilot-instructions.md   ← all 80 files, ~4,000 tokens, always injected
```

### When to use it

- **You are just getting started** — no configuration needed, works immediately.
- **Your codebase is small** — over its budget `full` drops files, and on the repositories
  measured only a few of the smallest lost none.
- **You use GitHub Copilot Chat in VS Code** — Copilot reads `copilot-instructions.md`
  automatically; there is no mechanism to conditionally inject per-file.
- **You are not using MCP** — if your IDE does not support MCP tools, `full` ensures the
  model always has codebase context without any extra steps.
- **Cross-cutting questions are common** — "How does the web layer call the server auth
  API?" needs context from both modules at once; `full` has it for the files that fit its budget, and `sigmap ask` ranks across modules.

### Config

```json
{
  "strategy": "full"
}
```

No other keys are needed. This is the default when there is no config — you can omit `"strategy"` entirely.

### Output files

```
.github/copilot-instructions.md   ← written on every run
```

### Token profile (arbi-platform example)

```
Input  (source files)  : ~77,551 tokens
Output (signatures)    :  ~3,980 tokens   ← 94.9% reduction
Injected every question:  ~3,980 tokens
```

### Reduce further without switching strategies

With `autoMaxTokens` off, lower the budget and SigMap will drop the lowest-priority files automatically:

```json
{
  "strategy": "full",
  "autoMaxTokens": false,
  "maxTokens": 2000,
  "diffPriority": true
}
```

With `diffPriority: true`, recently committed files sort ahead of others of the same kind when
the budget is applied. They are not pinned: a file that does not fit is still collapsed to its
line anchors or dropped.

---

## Strategy 2: `per-module`

### What it does

One signature file per top-level `srcDir`, plus a tiny always-injected overview table.

```
.github/copilot-instructions.md     ← overview table only, a few hundred tokens (always-on)
.github/context-server.md           ← all server/ signatures, ~2,000 tokens
.github/context-web.md              ← all web/ signatures,    ~600 tokens
.github/context-desktop.md          ← all desktop/ signatures, ~1,500 tokens
```

The IDE injects only the overview. The developer loads the
relevant module file for detailed signatures.

### When to use it

- **Your codebase has 3–8 clearly separated modules** (e.g. `server/`, `web/`,
  `mobile/`, `infra/`) and most questions stay within one module.
- **You want every module to have its own context file** — each file has one, up to its
  own budget; a module over it loses files (the retrieval index still holds them).
- **MCP is not available** — `per-module` files are plain Markdown. You can reference
  them manually in your IDE context window without any tooling.
- **You work on one module per session** — open the module's `.md` file in your IDE
  context panel at the start of a session; you get full depth for that module alone
  (~600–2,000 tokens in the example below) instead of the whole signature file.

### Config

```json
{
  "srcDirs": ["server", "web", "desktop"],
  "strategy": "per-module",
  "autoMaxTokens": false,
  "maxTokens": 6000
}
```

Each module gets its own full budget, the one `full` would get for the whole repository
(4,000 to 25,600 tokens with `autoMaxTokens` on; `maxTokens`, at least 1,000, with it off),
not a share of one pool, so a module larger than that loses files and the run prints a
`budget: dropped N` line for it. To give each module more headroom, turn `autoMaxTokens`
off and raise `maxTokens`:

```json
{
  "srcDirs": ["server", "web", "desktop", "infra", "shared"],
  "strategy": "per-module",
  "autoMaxTokens": false,
  "maxTokens": 12000
}
```

### Output files

```
.github/copilot-instructions.md     ← always written (overview)
.github/context-<module>.md         ← one per srcDir entry
```

### Token profile (arbi-platform example)

```
Always injected (overview)    :    ~117 tokens   ← every question
On-demand (server module)     :  ~2,140 tokens   ← when editing server/
On-demand (desktop module)    :  ~1,583 tokens   ← when editing desktop/
On-demand (web module)        :    ~335 tokens   ← when editing web/
Total coverage                :  ~4,058 tokens   ← vs ~3,980 full strategy
```

Effective per-question cost: **~117 + ~module tokens** instead of ~3,980.

### How to load a module file in your IDE

**VS Code / Copilot Chat** — drag `.github/context-server.md` into the chat context
panel, or use `#file:.github/context-server.md` in a prompt.

**Cursor** — add the module file to the context with `@file` or drag it into the
composer.

**Claude Code** — reference the file with `@.github/context-server.md`, or run
`sigmap ask "<question>"`, which ranks files across every module (MCP `read_context`
returns only the overview under `per-module`).

### Cross-module questions

When a question spans two modules (e.g. "how does the web React component call the
server API?"), load both module files:

```
#file:.github/context-web.md
#file:.github/context-server.md
How does LoginForm submit its credentials?
```

The combined cost is `~335 + ~2,140 = ~2,475 tokens` — still cheaper than the `full`
strategy's flat ~3,980 tokens.

---

## Strategy 3: `hot-cold`

### What it does

Split output into two files based on git commit history:

- **Hot** → recently committed files → written to the primary output, auto-injected by
  the IDE on every question.
- **Cold** → everything else → written to `.github/context-cold.md`, retrieved on
  demand with `sigmap ask` (or MCP).

```
.github/copilot-instructions.md    ← HOT: files changed in last N commits (no token cap)
.github/context-cold.md            ← COLD: all other files (not injected; reachable without MCP, below)
```

### When to use it

- **You use Claude Code or Cursor with MCP enabled** — the model can call
  `read_context({ module: "..." })` to pull cold context exactly when it needs it.
  Without MCP it can still run `sigmap ask "<question>"`, which searches the retrieval
  index, and that index holds the cold files too.
- **You are actively working in one area** — if you have touched 5 files in the last
  10 commits, those are hot. Everything else is cold. The model has full context for
  the area you are working in at almost zero token cost.
- **You want only recent work injected** — `hot-cold` injects just what changed in the
  last `hotCommits` commits. That slice has no token cap, so keep `hotCommits` low.
- **Your codebase has a stable core** — library code, generated files, migrations, old
  modules that are rarely touched. These naturally become cold and stay out of the
  injection stream.

### When NOT to use it

- **The agent can run neither commands nor MCP** — then it sees a cold file only if it
  reads `.github/context-cold.md` itself. Use `full` on a small repository instead.
- **You frequently jump between unrelated areas** — if today you edit `server/auth.py`
  but then need context from `web/checkout.tsx` which hasn't been touched in 3 weeks,
  the model has no cold context unless it runs `sigmap ask` or calls MCP.
- **You are debugging a regression in old code** — the buggy file may be cold.
- **Your checkout is shallow** (`git clone --depth 1`, the default of many CI jobs) —
  one commit makes every file hot, and the hot set has no cap (hundreds of thousands of tokens on a large repository).

### Config

```json
{
  "strategy": "hot-cold",
  "diffPriority": true,
  "hotCommits": 10
}
```

`hotCommits` controls how many recent git commits are considered "hot" (default: 10).
Raise it for longer-lived features; lower it to keep the hot set minimal:

```json
{
  "strategy": "hot-cold",
  "diffPriority": true,
  "hotCommits": 5
}
```

### Output files

```
.github/copilot-instructions.md    ← always written (hot files)
.github/context-cold.md            ← written alongside (cold files, not injected)
```

### Token profile (arbi-platform example, 10 recent commits)

```
Hot  (auto-injected, 79 files) : ~3,700 tokens   ← active area of the project
Cold (on demand, 1 file)       :   ~363 tokens   ← stable/untouched
```

In a project where you work in a narrower active area (e.g. only `server/api/`):

```
Hot  (auto-injected, ~10 files) : ~400 tokens    ← just the files you changed
Cold (on demand, ~70 files)     : ~3,500 tokens  ← rest of codebase via `sigmap ask` or MCP
```

### Retrieval of cold context

Without MCP, `sigmap ask "<question>"` searches `.context/sig-index.json`, which holds the
cold files and is identical under all four strategies; it returns the ranked files and
their signatures. With MCP, when a question touches a cold file, the model (in Claude
Code or Cursor) can call:

```json
{ "name": "read_context", "arguments": { "module": "server" } }
```

This returns signatures for the cold files in `server/`, adding ~200–800 tokens only
for that specific question. No cold files are injected on questions that don't need
them.

```bash
# Start MCP server (auto-started by Claude Code / Cursor after --setup)
node gen-context.js --mcp

# Manual retrieval test
echo '{"jsonrpc":"2.0","method":"tools/call","id":1,"params":{"name":"read_context","arguments":{"module":"server"}}}' \
  | node gen-context.js --mcp
```

---

## Choosing a strategy — decision tree

1. **Your agent runs `sigmap ask` (or the MCP tools)** → `index`, which is what `sigmap --init` writes.
2. **It cannot, and you want everything inline** → `full`, on a repository small enough that nothing is dropped.
3. **Module boundaries are clear and you load one module at a time** → `per-module`.
4. **The repository has history and your work sits in recent commits** → `hot-cold`, with a low `hotCommits`.
5. **Unsure** → `index`.

---

## Side-by-side scenario examples

### Scenario A: "Fix the login bug"

You recently edited `server/auth.py` and `server/routes.py`.

| Strategy | What the model sees | Tokens |
|---|---|---|
| `full` | All 80 files | ~3,980 |
| `per-module` | Overview + you load `context-server.md` | ~117 + ~2,140 = ~2,257 |
| `hot-cold` | Only recently changed files (includes auth.py) | ~400–800 |

**Fits: `hot-cold`**, if those commits are inside the last `hotCommits`: the exact files you need are then already hot. The numbers above are an invented 80-file project, not a measurement.

---

### Scenario B: "How does web checkout call the payment server?"

You haven't touched the payment module in 3 weeks. `web/Checkout.tsx` was edited yesterday.

| Strategy | What the model sees | Tokens |
|---|---|---|
| `full` | All 80 files including payment server | ~3,980 |
| `per-module` | Overview + load `context-web.md` + `context-server.md` | ~117 + ~335 + ~2,140 = ~2,592 |
| `hot-cold` (no MCP) | Only hot files — payment server is COLD; the model gets it by running `sigmap ask` | ~400 + ~1,000–2,000 per `ask` |
| `hot-cold` (with MCP) | Hot + model calls `read_context({ module: "server" })` | ~400 + ~2,140 = ~2,540 |

**Fits: `per-module`**, or `index`: no MCP needed, and `sigmap ask` ranks across modules in one answer. The numbers above are an invented 80-file project, not a measurement.

---

### Scenario C: Daily active development, always using Claude Code with MCP

You make 5–10 commits per day, always in the same `server/api/` area.

| Strategy | Always-injected | Extra per question | Total |
|---|---|---|---|
| `full` | ~3,980 | — | ~3,980 every time |
| `per-module` | ~117 | +~2,140 (server) | ~2,257 when needed |
| `hot-cold` | ~400 (active files) | +~3,500 via MCP when needed | ~400 most of the time |

**Fits: `hot-cold`**, as long as the recent commits stay few (in this invented example ~400 always-injected tokens against ~3,980); `index` keeps the always-on file about the same size whatever the commits. The model retrieves the rest when it needs it.

---

### Scenario D: New engineer onboarding — needs to understand the whole codebase

No recent commits. Needs context from every module.

| Strategy | Coverage | Tokens |
|---|---|---|
| `full` | Complete | ~3,980 |
| `per-module` | Complete (load all module files) | ~117 + ~4,058 = ~4,175 |
| `hot-cold` | Only the recent files are injected; the rest through `sigmap ask` or MCP | depends on the commits |

**Fits: `full`**, on a repository small enough that nothing is dropped: one file, no extra steps. The numbers above are an invented 80-file project, not a measurement.

---

## Configuration reference

```json
{
  "_comment": "Context strategy — choose one",

  "strategy": "full",
  "_strategy_options": "'full' | 'index' | 'per-module' | 'hot-cold'",

  "hotCommits": 10,
  "_hotCommits_note": "Only used by 'hot-cold'. Controls how many recent git commits count as hot.",

  "maxTokens": 6000,
  "_maxTokens_note": "Sets the size of the context files only with autoMaxTokens:false; by default the budget is scaled to the repository (80% of its signature tokens, 4,000 to 25,600). Per-module: each module gets its own full budget, not a share. hot-cold: the hot set is not budgeted."
}
```

The strategies respect `secretScan`, `diffPriority`, `exclude`, and `.contextignore`.

---

## Mixing with other features

| Feature | `full` | `per-module` | `hot-cold` |
|---|---|---|---|
| `--routing` hints | ✅ appended to primary output | ✅ appended to overview | ✅ appended to hot |
| `--format cache` | ✅ writes cache JSON | ✅ for primary output | ✅ for hot output |
| `--track` / `--health` | ✅ | ✅ | ✅ |
| `--monorepo` | ✅ | ⚠️ per-module inside each package | ⚠️ hot-cold inside each package |
| MCP `read_context` | reads primary output | reads primary output | reads both hot + cold |
| MCP `search_signatures` | searches all files | searches all files | searches all files |

This table covers the three strategies that write signatures into files; `index` writes a map only, and its signatures are in the retrieval index (see the guide).

---

## Migration guide

### Switching from `full` to `per-module`

1. Add `"strategy": "per-module"` to `gen-context.config.json`
2. Run `node gen-context.js`
3. Note the new `.github/context-<module>.md` files created
4. Add the relevant module file to your IDE context window for focused sessions
5. Optional: add `.github/context-*.md` to `.gitignore` if you prefer not to commit them,
   or commit them so teammates can reference them too

### Switching from `full` to `hot-cold`

1. Optional: register the MCP server with `sigmap mcp install <client>`; without it, `sigmap ask` reaches the cold files
2. Add `"strategy": "hot-cold"` and optionally `"hotCommits": 10` to config
3. Run `node gen-context.js`
4. Verify output: `[sigmap] hot-cold: hot X files ... cold Y files`
5. Test retrieval of cold context: `sigmap ask "<question about a cold file>"`, or `read_context` from your IDE if MCP is on

### Reverting to `full`

Set `"strategy": "full"` (or remove the `strategy` key entirely) and run
`node gen-context.js`. The run deletes the `.github/context-<module>.md` files and `context-cold.md`
it did not write, and says so (`pruned N stale context split(s)`).
