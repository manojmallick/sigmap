---
title: Repomix integration
description: Use SigMap and Repomix together for two-layer context. SigMap for always-on signatures, Repomix for deep sessions.
head:
  - - meta
    - property: og:title
      content: "SigMap + Repomix — two-layer AI context strategy"
  - - meta
    - property: og:description
      content: "SigMap for always-on signatures, Repomix for full-depth sessions. Use both for complete AI context coverage."
  - - meta
    - property: og:url
      content: "https://manojmallick.github.io/sigmap/guide/repomix"
  - - meta
    - property: og:type
      content: article
  - - meta
    - name: keywords
      content: "sigmap repomix, repomix integration, ai context tools, codebase context, copilot context"
---
# SigMap + Repomix

Two tools, two layers, one strategy. SigMap keeps signatures always fresh. Repomix provides full-depth context for complex sessions. You need both.

> "SigMap for daily always-on context; Repomix for deep one-off sessions — use both."

## Different tools, different jobs

Each tool is optimised for a specific workflow. They stack, not compete.

### sigmap — Always-on signatures

Runs automatically on every save and every commit. Extracts function and class signatures from 21 languages. Writes a compact context file under 4K tokens that every AI coding agent reads at session start.

- Automatic — zero manual steps after `--setup`
- Under 4,000 tokens for any codebase
- Signatures only — shapes, not bodies
- Secret scanning before every write
- MCP server for on-demand module pulls
- Self-healing CI — auto-regenerates on drift

### repomix — Deep session context

Packs your entire codebase into a single XML or Markdown file using token-efficient compression. Purpose-built for deep one-off sessions where the agent needs full file contents, not just signatures.

- Manual — run when you need full depth
- Full file contents, compressed
- XML or Markdown output format
- Broader language support via Tree-sitter
- Repomix Cloud for team sharing
- 15,000+ GitHub stars, active community

See: [github.com/yamadashy/repomix](https://github.com/yamadashy/repomix)

### Together they cover every workflow

SigMap handles the 90% — daily coding sessions where you need fast, always-fresh context. Repomix handles the 10% — architectural decisions, large-scale refactors, and debugging sessions that need every line.

```
sigmap (daily)  +  repomix (deep sessions)  =  full coverage
```

## The two-layer caching strategy

Stack both tools for maximum token and cost efficiency.

**Layer 1 — Stable Repomix prefix (cached)**

Run Repomix once at the start of a deep session. The compressed codebase becomes a stable prefix in the prompt. Using Anthropic's `cache_control` breakpoints (or OpenAI's equivalent), this prefix is computed once and reused across every request in the session. The codebase rarely changes within a single session — cache hit rate is typically 95%+.

Tags: `repomix --compress` · `cache_control: ephemeral` · 60% cost reduction

**Layer 2 — Fresh SigMap signatures (dynamic)**

SigMap regenerates on every save. Its compact signature output sits above the Repomix prefix and tells the agent which files changed since the session started. The signatures identify where to look; the cached Repomix context provides the depth. Under 4K tokens, always fresh, always accurate.

Tags: `node gen-context.js --watch` · `< 4K tokens` · always fresh

### Combined workflow

```bash
# Session start — run once
npx repomix --compress --output .context/repomix.md
# [repomix] packed 247 files → 28,400 tokens (compressed)

# Always running — background watcher
node gen-context.js --watch &
# [sigmap] watching src/ app/ lib/ ...

# Query with both layers
cat .context/repomix.md .github/copilot-instructions.md \
  | claude --cache "Fix the UserService.findById bug"

# Result: 28,400 tokens cached (L1) + 3,847 tokens fresh (L2)
# L1 cache hit rate: 97%  ←  pay once per session
# L2 tokens: 3,847        ←  always current
# Effective cost: -76% vs uncached full context
```

## Which tool for which task

| Task | Use | Why |
|------|-----|-----|
| Daily coding session | sigmap | Auto-updated signatures are enough for navigation and autocomplete context |
| Fix a specific bug | sigmap | MCP `search_signatures` finds the relevant files in <200 tokens |
| Add a feature to existing code | sigmap | Signatures show the interface; bodies aren't needed to extend |
| Architecture review | repomix | Agent needs full file contents to reason about system design |
| Large-scale refactor | both | Repomix for full depth, SigMap to track what changes in real-time |
| Onboarding a new codebase | both | Repomix for full understanding, SigMap to keep the session lean |
| CI token budget check | sigmap | `--report --json` outputs machine-readable stats for CI dashboards |
| Sharing context with a team | repomix | Repomix Cloud handles team sharing; SigMap output goes in git |
| Security audit | sigmap | Secret scanning redacts credentials before any output is written |

## Prompt cache payload

Use `node gen-context.js --format cache` to generate the Anthropic `cache_control` JSON structure. The stable signatures become a cached prefix — pay once, reuse across every request.

```json
{
  "messages": [
    {
      "role": "user",
      "content": [
        {
          "type": "text",
          "text": "# Code signatures\n\n## src/api/users.ts\nexport class UserService\n  async findById(id: string): Promise<User>\n...",
          "cache_control": { "type": "ephemeral" }
        },
        {
          "type": "text",
          "text": "Fix the race condition in UserService.findById"
        }
      ]
    }
  ]
}
```

### Cache economics on a 100-request session

| | Count | Cost |
|-|-------|------|
| Cache write | 1× | Full cost |
| Cache reads | 99× | 10% cost |
| **Session saving** | | **-60% API cost** |

## One ignore file for both tools

The `.contextignore` file uses the same gitignore syntax as `.repomixignore`. Symlink them to maintain a single exclusion list for both tools.

```bash
ln -s .contextignore .repomixignore
```

**.contextignore:**

```bash
# SigMap exclusions
node_modules/
dist/
build/
*.generated.*
*.pb.*
coverage/
*.test.*
*.spec.*
```

**.repomixignore (symlink)** — same exclusion list, both tools respect it.


---

<div style="text-align:center;margin-top:2.5rem;padding-bottom:.5rem;font-size:0.85em;color:var(--vp-c-text-3)">
  Made in Amsterdam, Netherlands <span title="Netherlands">🇳🇱</span>
</div>