---
title: End-to-end walkthrough
description: Real example of the full SigMap workflow — ask, validate, judge, and learn on a real open-source repo. Shows token cost before and after.
head:
  - - meta
    - property: og:title
      content: "SigMap end-to-end walkthrough — ask, validate, judge, learn"
  - - meta
    - property: og:description
      content: "Watch the full SigMap workflow on a real repo: ask ranks files, validate checks coverage, judge scores groundedness, learn reinforces what helped."
  - - meta
    - property: og:url
      content: "https://manojmallick.github.io/sigmap/guide/walkthrough"
---

# End-to-end walkthrough

This page walks through the complete SigMap workflow on a real open-source repo. Every command shown here produces real output — nothing is mocked.

**Repo used:** `gin` (Go web framework, 107 files, 4.7% random hit@5 baseline)

---

## Step 1 — Generate the context map

```bash
cd ~/projects/gin
npx sigmap
```

Output:

```
[sigmap] scanned 107 files (Go · JavaScript · Markdown)
[sigmap] extracted 312 signatures
[sigmap] wrote .github/copilot-instructions.md  (3,841 tokens)
[sigmap] token reduction: 97.3%  (raw: ~142,000 → context: 3,841)
```

SigMap wrote a compact signature map from 142,000 raw source tokens down to 3,841 tokens. That is the file your AI tool will read.

---

## Step 2 — Ask for the files that matter to the current task

```bash
sigmap ask "Where is route registration handled?"
```

Output:

```
────────────────────────────────────────────────
 sigmap ask  "Where is route registration handled?"
 Intent    : explain
 Context   : 1,240 tokens  →  .context/query-context.md
 Coverage  : 94%
 Risk      : LOW
 Cost      : $0.006/query  (was $0.71 · saved 99%)
────────────────────────────────────────────────
```

SigMap detected intent `explain`, ranked the 5 most relevant files by TF-IDF over extracted signatures, and wrote a 1,240-token query context. The same query against raw source would cost $0.71 in GPT-4o input tokens.

The ranked files in `.context/query-context.md`:

```
1. gin.go              (routerGroup, addRoute, handle, GET, POST, PUT, DELETE)
2. routergroup.go      (RouterGroup, Group, Use, calculateAbsolutePath)
3. tree.go             (methodTree, addRoute, getValue, nodeType)
4. context.go          (Context, Next, Abort, Param, Query)
5. utils.go            (joinPaths, filterFlags, parseAccept)
```

---

## Step 3 — Validate coverage

Before handing the context to an LLM, check that the relevant symbols are actually present:

```bash
sigmap validate --query "route registration"
```

Output:

```
[sigmap] ✔ config valid  coverage: 94%
[sigmap] ✔ query coverage OK — all 2 symbols found (routerGroup, addRoute)
```

Coverage is 94% and the key symbols from the query are present in the ranked context. Safe to proceed.

---

## Step 4 — Get an AI answer

You paste the contents of `.context/query-context.md` into your AI tool along with the question. The AI responds:

> Route registration in gin is handled by `RouterGroup.addRoute()` in `routergroup.go`. It delegates to `Engine.trees` (a slice of `methodTree`) via `tree.go`. The `GET`, `POST`, `PUT`, `DELETE` methods on `RouterGroup` are thin wrappers that call `handle()` with the appropriate HTTP method string.

---

## Step 5 — Judge the answer's groundedness

```bash
sigmap judge --answer "Route registration in gin is handled by RouterGroup.addRoute() in routergroup.go. It delegates to Engine.trees (a slice of methodTree) via tree.go. The GET, POST, PUT, DELETE methods on RouterGroup are thin wrappers that call handle() with the appropriate HTTP method string."
```

Output:

```
[sigmap] judge result:
  Groundedness      : 91%
  Support level     : ✔ HIGH
  Untraceable syms  : (none above threshold)
```

91% groundedness means nearly every identifier in the answer (`RouterGroup`, `addRoute`, `methodTree`, `handle`, `GET`, `POST`) appears in the context signatures. The answer is traceable to the code SigMap surfaced.

::: info What groundedness measures
Groundedness does not judge whether the answer is factually correct — it measures whether the identifiers and claims in the answer are traceable to the context that was provided. High groundedness means the AI is working from the right source material.
:::

---

## Step 6 — Learn from what helped

The ranked files were useful. Tell SigMap to boost them for future queries:

```bash
sigmap learn --good gin.go routergroup.go tree.go
```

Output:

```
[sigmap] learned: boosted 3 file(s)
```

Next time you run `sigmap ask` on a routing question, these files will rank higher by a multiplier (capped at 3×).

To see current learned weights:

```bash
sigmap weights
```

Output:

```
[sigmap] Learned file weights (×multiplier vs baseline):
  gin.go                                             ×1.15  +▪
  routergroup.go                                     ×1.15  +▪
  tree.go                                            ×1.15  +▪

  Total files with learned weights: 3
  To reset: sigmap learn --reset
```

---

## Before vs after summary

| | Without SigMap | With SigMap |
|---|:---:|:---:|
| Tokens sent to LLM | ~142,000 | **1,240** |
| Token cost (GPT-4o) | $0.71 | **$0.006** |
| Right file in top 5 | 4.7% chance | **100%** (gin) |
| Answer groundedness | unknown | **91%** |
| Prompts to finish | ~2.84 average | **1–2** |

---

## Next steps

- [ask](/guide/ask) — full reference for query options and intent detection
- [validate](/guide/validate) — config, coverage, and symbol checks
- [judge](/guide/judge) — groundedness scoring and LLM mode
- [learning](/guide/learning) — weights, decay, and rollback
- [compare alternatives](/guide/compare-alternatives) — how this compares to embeddings and RAG
