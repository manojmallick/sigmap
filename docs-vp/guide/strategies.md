---
title: Context strategies
description: Choose the right SigMap strategy — full, per-module, or hot-cold. Token cost comparison, MCP integration, and decision guide.
head:
  - - meta
    - property: og:title
      content: "SigMap Strategies — full, per-module, hot-cold"
  - - meta
    - property: og:description
      content: "Choose the right SigMap strategy for your workflow. Token cost comparison, MCP integration, and decision guide."
  - - meta
    - property: og:url
      content: "https://manojmallick.github.io/sigmap/guide/strategies"
  - - meta
    - property: og:type
      content: article
  - - meta
    - name: keywords
      content: "sigmap strategy, sigmap full, sigmap per-module, sigmap hot-cold, ai context strategy, token budget"
---
# Context strategies

SigMap supports three output strategies: `full`, `per-module`, and `hot-cold`. This page shows when to use each one, what token cost to expect, and how MCP changes the decision.

## Quick comparison

| Strategy | Always injected | Context loss | MCP required | Best fit |
|----------|----------------|--------------|--------------|----------|
| `full` | ~4,000 tokens | No | No | Default for all IDEs and onboarding |
| `per-module` | ~100–300 tokens overview | No | No | Module-based projects, focused work |
| `hot-cold` | ~200–800 hot set | Cold files unless fetched | Yes for cold | Claude Code / Cursor with MCP |

## Each strategy in detail

### full

Single output file with all signatures. Best if you want complete context all the time and do not want to manage additional files.

```json
{
  "strategy": "full",
  "maxTokens": 6000
}
```

**No context loss. No MCP needed.**

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

1. **No MCP in your IDE**: choose `full` or `per-module`.
2. **Module boundaries are clear**: choose `per-module`.
3. **MCP always available and active area is small**: choose `hot-cold`.
4. **Unsure**: start with `full`, then move to `per-module` when output grows.

## Further reading

- Detailed guide in repository: [docs/CONTEXT_STRATEGIES.md](https://github.com/manojmallick/sigmap/blob/main/docs/CONTEXT_STRATEGIES.md)
- MCP setup: [MCP server](/guide/mcp)
- CLI usage: [Quick start](/guide/quick-start)


---

<div style="text-align:center;margin-top:2.5rem;padding-bottom:.5rem;font-size:0.85em;color:var(--vp-c-text-3)">
  Made in Amsterdam, Netherlands <span title="Netherlands">🇳🇱</span>
</div>