# Memory & notes

SigMap keeps a small, cross-session **decision log** so an agent (or you) can
recall *what we were doing and why* without re-reading the whole codebase. It's
the cold-start killer: one MCP call at the start of a task instead of a full
re-scan.

Four pieces work together:

| Piece | What it does | Surface |
|---|---|---|
| `sigmap note` | Append a note to the decision log | CLI |
| `sigmap status` | Repo state at a glance — branch, dirty files, index freshness, notes | CLI |
| `read_memory` | Return recent notes + last session focus to an agent | MCP tool |
| **retrieval** | A note relevant to your query boosts the files it names and joins the emitted context (v8.54.2) | [`ask`](/guide/cli#note) |

Notes are stored as append-only NDJSON at `.context/notes.ndjson` (alongside
SigMap's other state logs). Zero dependencies, fully local.

::: tip Notes became a retrieval signal in v8.54.2 (#776)
Before v8.54.2 the log was **write-only**: the only readers were `note` itself,
`status`, and the `read_memory` MCP tool. A note saying *"the redaction logic
lives in `src/security/patterns.js`"* could not influence a query about
redaction — the one thing a decision log exists for.

A note that is relevant to your query now boosts the files whose paths it names
and is rendered into `.context/query-context.md` under a `## Notes` heading, so
the agent consuming that context sees the human's answer first. It is
relevance-gated (notes never leak into unrelated queries), bounded to recent
notes, and completely inert when no notes exist. See
[`note` in the CLI reference](/guide/cli#note).
:::

## `sigmap note`

```bash
sigmap note "switched auth to JWT; refresh-token flow still TODO"
```

Each note records the text, an ISO timestamp, and the current git branch. List
recent notes by running `note` with no text:

```bash
sigmap note            # last 10
sigmap note --list 25  # last 25
sigmap note --json     # machine-readable
```

## `sigmap status`

```bash
$ sigmap status
[sigmap] status
  Branch:        feat/auth-refresh
  Working tree:  3 files changed
  Last index:    2h ago (v6.15.0, 412 files) — STALE: 5 files changed since
  Notes:         7 (latest: switched auth to JWT; refresh-token flow still TODO)
```

`Last index` reads the usage log and compares the index time against your
tracked files' mtimes, so you can see at a glance whether the context an agent
is using is stale. Add `--json` for CI or scripting.

## `read_memory` (MCP)

The 11th MCP tool. Agents call it at the start of a task to recall the decision
log plus the last ranking-session focus. It is not in the `core` [tool profile](/guide/mcp#tool-profiles-core-or-all)
a `sigmap --init` config selects: add it to an `mcp.tools` list by name, or set `"all"`.

```jsonc
// tools/call
{ "name": "read_memory", "arguments": { "limit": 10 } }
```

Returns Markdown — recent notes (most recent first) and, when available, the
last query and focus files from `ask`:

```markdown
# SigMap memory

## Recent notes (2)
- [2026-06-08 10:13 (feat/auth-refresh)] switched auth to JWT; refresh-token flow still TODO
- [2026-06-08 09:40 (feat/auth-refresh)] extracted token store into src/auth/tokens.ts

## Last session
**Last query:** refresh token rotation
**Focus files:** src/auth/tokens.ts, src/auth/middleware.ts
```

Pair it with `note`: leave a note when you finish a chunk of work, and the next
agent session starts already knowing where you left off.
