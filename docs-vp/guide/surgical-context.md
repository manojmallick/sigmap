# Surgical Context

Surgical Context is SigMap's demand-driven retrieval mode. Instead of dumping
whole signature blocks into your agent's upfront context, it points the agent at
**exact line ranges**, lets it **fetch bodies on demand**, and emits **only what
changed** between turns.

Three mechanisms work together:

| Mechanism | What it does | Flag / tool |
|---|---|---|
| **Line anchors** | Every signature carries a `path:start-end` suffix | on by default (v6.11.0) |
| **Two-tier index** | Emit a tiny symbol-header index; fetch bodies on demand | `--mode index` |
| **Delta context** | Emit only signatures for files changed since a ref | `--since <ref>` |

## Line anchors

Since v6.11.0, extracted signatures carry the source location they came from:

```
def extract(filepath)  :268-338
function loadConfig(cwd) → object  :42-58
```

The `:start-end` suffix is a 1-based, inclusive line range. An agent that sees
`loadConfig  :42-58` can read those 17 lines instead of re-opening the whole
file — the core idea behind Surgical Context.

Coverage grows by release: TypeScript and Python top-level declarations first
(v6.11.0); **v6.13.0 adds JavaScript and per-member anchors** — TypeScript/
JavaScript class methods and interface members now carry their own range
(spanning the member body), so `get_lines` can target an individual method.
Remaining languages are being added in subsequent phases.

## `--mode index` — two-tier output

`sigmap ask` normally writes ranked signature blocks. With `--mode index` it
emits **only** the symbol-header index — declaration heads plus their anchors,
no parameter lists, no return types, no bodies:

```bash
sigmap ask "where is config loaded" --mode index
```

````text
# SigMap Query Context (index mode)
> Symbol index only — fetch exact lines on demand via the `get_lines` MCP tool.

## src/config/loader.js
```
function loadConfig  :42-58
function detectAutoSrcDirs  :12-39
```
````

The agent reads this minimal map, then fetches the exact lines for the symbol it
actually needs. Upfront context shrinks; nothing relevant is lost.

## `get_lines` MCP tool

`get_lines` is the demand-driven workhorse. Given a file and a line range it
returns the exact source — clamped to the file bounds, secret-scanned, and
sandboxed to the project root:

```json
{ "name": "get_lines", "arguments": { "file": "src/config/loader.js", "start": 42, "end": 58 } }
```

````text
# src/config/loader.js:42-58
```
function loadConfig(cwd) {
  ...
}
```
````

It is one of SigMap's MCP tools (alongside `read_context`, `query_context`,
`get_impact`, and others — see the [MCP server guide](/guide/mcp)).

## Delta context — `--since <ref>`

`--since` restricts `ask` output to files changed since a git ref, so a
steady-state turn carries near-zero context:

```bash
sigmap ask "finish the refactor" --since main
sigmap ask "what did I touch" --since HEAD~3 --mode index
```

Only ranked files that changed since the ref are emitted. Combine with
`--mode index` for the leanest possible turn.

## Budget-aware degradation

When the generated context would exceed `maxTokens`, SigMap now degrades
gracefully: it **collapses signature bodies to their anchors first** (keeping the
symbol and `:start-end`) before dropping whole files. The agent can still
re-fetch any body via `get_lines`. The usual budget report still prints:

```
[sigmap] budget: collapsed bodies to anchors, reclaimed ~1840 tokens
[sigmap] budget: dropped 3 files to stay under 6000 tokens
```

## Agent configuration

Point your agent's MCP client at the SigMap server, then let it call `get_lines`
on the anchors it sees.

**Claude Code / Cursor / Codex** (`mcp` config):

```json
{
  "mcpServers": {
    "sigmap": { "command": "npx", "args": ["sigmap", "mcp"] }
  }
}
```

Then generate anchored context and query in index mode:

```bash
sigmap                                   # generate context (anchors on)
sigmap ask "add a language extractor" --mode index
```

## Measuring the savings

Numbers are never hand-typed — run the dashboard to see the **Token Reduction**
panel for your own repos and the published benchmark:

```bash
sigmap --report      # opens the dashboard with the Token Reduction panel
```

See the [Benchmarks overview](/guide/benchmark) for methodology.
