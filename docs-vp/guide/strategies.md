---
title: Context strategies
description: Choose the right SigMap strategy — full, index, per-module, or hot-cold. Token cost comparison, MCP integration, and decision guide.
head:
  - - meta
    - property: og:title
      content: "SigMap Strategies — full, index, per-module, hot-cold"
  - - meta
    - property: og:description
      content: "Choose the right SigMap strategy for your workflow. Token cost comparison, MCP integration, and decision guide."
  - - meta
    - property: og:url
      content: "https://sigmap.io/guide/strategies"
  - - meta
    - property: og:type
      content: article
  - - meta
    - name: keywords
      content: "sigmap strategy, sigmap full, sigmap index, sigmap per-module, sigmap hot-cold, ai context strategy, token budget"
---
# Context strategies

SigMap supports four output strategies: `full`, `index`, `per-module`, and `hot-cold`. This page shows when to use each one, what token cost to expect, and how MCP changes the decision.

## Quick comparison

| Strategy | Always injected | Context loss | MCP required | Best fit |
|----------|----------------|--------------|--------------|----------|
| `full` | ~4,000 tokens | No | No | Default for all IDEs and onboarding |
| `index` | ~400 tokens (map only) | No — index holds everything | No (`sigmap ask` suffices) | Large repos; agents that will actually look things up |
| `per-module` | ~100–300 tokens overview | No | No | Module-based projects, focused work |
| `hot-cold` | ~200–800 hot set | Cold files unless fetched | Yes for cold | Claude Code / Cursor with MCP |

## Best strategy by task

| Task | Best strategy | Why |
|---|---|---|
| Daily coding with `ask` | `full` | Fastest default path with no extra workflow steps |
| Debugging with `ask` + MCP `query_context` | `full` or `hot-cold` | `full` keeps everything simple; `hot-cold` wins when MCP is always available |
| Large repo with Claude Code or Cursor MCP | `hot-cold` | Lowest always-on token load while keeping cold context fetchable |
| CI, reporting, and shared docs output | `full` or `per-module` | Easier to reason about and easier to compare across runs |
| Clear module boundaries | `per-module` | Lets teams inject only the relevant package or service |
| Long sessions where the always-on tax dominates | `index` | Pays for the map once; each question pulls only what it needs |

## Each strategy in detail

### full

Single output file with all signatures. Best if you want complete context all the time and do not want to manage additional files.

```json
{
  "strategy": "full"
}
```

Budget auto-scales by default. For a fixed cap: `{ "autoMaxTokens": false, "maxTokens": 6000 }`.

**No context loss. No MCP needed.**

### index

The always-on file is a **map**, not a dump: how to retrieve, a module rollup, entry points, and direct-dependency version pins. Every signature stays in `.context/sig-index.json`, which `sigmap ask` already reads and which no adapter injects.

```json
{
  "strategy": "index"
}
```

This exists because a full dump does not merely *cost* tokens — it **suppresses retrieval**. An agent that already holds a superset of what `sigmap ask` would return is correct not to call it, so the always-on artifact ends up competing with the lookup path it exists to feed.

Measured on the SigMap repo itself:

| | `full` | `index` |
|---|---|---|
| Always-on context | 55,567 B (~13,892 tokens) | 1,510 B (~377 tokens) |
| First answer | ~13,892 tokens | ~1,385 tokens (map + one `ask`) |

Retrieval is unaffected: the index is written before the strategy split, and a test pins that it is **byte-identical** under `index` and `full`. Switching changes only *where* signatures are injected, never what retrieval can reach.

**Two caveats, both reported by the tool rather than buried here.** Below roughly 400 tokens of signatures the map's fixed overhead costs more than inlining everything, and SigMap says `strategy:"full" is cheaper here` instead of reporting a saving of zero. And the payoff depends on the agent actually running `sigmap ask` (or the MCP tools) — the map tells it to, but an agent that ignores the instruction gets less context, not more.

**No context loss. No MCP required** — `sigmap ask` works from the CLI.

### per-module

Writes one file per top-level module plus a tiny overview. You inject only the module you are currently working on.

```json
{
  "srcDirs": ["server", "web", "desktop"],
  "strategy": "per-module"
}
```

**No context loss. No MCP needed.** Typically 70% fewer injected tokens than `full`.

### hot-cold

Recently changed files stay "hot" and are auto-injected. Everything else goes to `context-cold.md` and should be pulled via MCP when needed.

```json
{
  "strategy": "hot-cold",
  "hotCommits": 10,
  "diffPriority": true
}
```

**Cold files require MCP.** Achieves ~90% fewer always-on tokens when using Claude Code or Cursor with MCP enabled.

## Real usage scenarios

### Scenario A: Fix a login bug

You edited auth files in the last few commits and need fast iteration.

**Winner: hot-cold.** The hot set already contains the files you are editing.

### Scenario B: Cross-module question

You need frontend + backend context in one answer. MCP may or may not be available.

**Winner: per-module.** Load both module files — no context loss and no MCP dependency.

### Scenario C: Team with MCP enabled

Claude Code / Cursor is standard across the team and MCP is always available.

**Winner: hot-cold.** Keep always-on tiny and fetch cold context only when needed.

### Scenario D: Onboarding new engineers

Need broad project understanding quickly, with minimal setup complexity.

**Winner: full.** One file, complete picture, no additional workflow steps.

## Decision tree

1. **Your agent reliably runs `sigmap ask` (or the MCP tools)**: choose `index` — the largest always-on saving.
2. **No MCP in your IDE and you want everything inline**: choose `full` or `per-module`.
3. **Module boundaries are clear**: choose `per-module`.
4. **MCP always available and active area is small**: choose `hot-cold`.
5. **Unsure**: start with `full`, then move to `index` once you can see the always-on cost in your own sessions.

## Further reading

- Detailed guide in repository: [docs/CONTEXT_STRATEGIES.md](https://github.com/manojmallick/sigmap/blob/main/docs/CONTEXT_STRATEGIES.md)
- MCP setup: [MCP server](/guide/mcp)
- CLI usage: [Quick start](/guide/quick-start)


---

<div style="text-align:center;margin-top:2.5rem;padding-bottom:.5rem;font-size:0.85em;color:var(--vp-c-text-3)">
  Made in Amsterdam, Netherlands <span title="Netherlands">🇳🇱</span>
</div>
