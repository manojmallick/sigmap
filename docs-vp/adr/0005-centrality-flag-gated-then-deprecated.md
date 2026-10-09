---
title: "ADR 0005 — Centrality: gated, measured, deprecated"
description: Why the import-graph centrality ranking prior shipped behind a flag, how it was judged against a corpus the project does not control, and the rule every ranking signal is now held to.
---

# ADR 0005 — The centrality ranking prior shipped behind a flag, was measured, and is deprecated

| | |
|---|---|
| **Status** | Deprecated — still works, warns once, removal planned for v9.0 |
| **Recorded** | 2026-10-09 ([#930](https://github.com/manojmallick/sigmap/issues/930)); shipped in v8.21.0, deprecated in v8.68.0 ([#703](https://github.com/manojmallick/sigmap/issues/703), [#905](https://github.com/manojmallick/sigmap/issues/905), [PR #906](https://github.com/manojmallick/sigmap/pull/906)) |
| **Applies to** | `retrieval.centralityBlend` (and, by the same rule, `retrieval.surfaceEnrichment`) |

## Context

Files that many others import are plausibly important, and graph centrality is a standard way to turn that into a ranking prior. It looked like a principled deepening of the import-graph boost SigMap already had. It was also unproven: the only corpus of the time was the project-written 90-task, 18-repository set, which the changelog calls lexical-favouring.

## Decision

**In v8.21.0** the prior shipped — [`src/graph/centrality.js`](https://github.com/manojmallick/sigmap/blob/main/src/graph/centrality.js), power iteration with damping 0.85 and 20 iterations, deterministic — **off by default behind `retrieval.centralityBlend`**. A measure gate (an A/B over 90 tasks across 18 repositories) scored both arms at 77.8% hit@5, a difference of zero tasks: non-regressing, neutral, so it stayed opt-in.

**In v8.68.0** it was re-measured against the shipped ranker, task by task, over the third-party corpus (which the project does not control), this repository's own splits and the JVM repositories — 314 tasks; the honest corpus is scored without an import graph, so centrality does not apply to it. It moved the rank of 4 of those 314 tasks and changed one hit — a loss (express `x037`). It was **deprecated**: it still works, `loadConfig` warns once per process when a config turns it on, and the config reference marks the key. Nothing was deleted, because removing a config key is a breaking change.

## Why

1. **A flag lets an idea ship without becoming everyone's ranking.** The risk of an unproven signal falls on the people who turn it on.
2. **A signal is judged on the corpus that can falsify it.** Centrality looked neutral on corpora the project controlled. The third-party corpus ([#892](https://github.com/manojmallick/sigmap/issues/892)) was the first that did not come from the project; on it centrality was net −1 (no task won, one lost).
3. **A rule, written down, so the next signal is not argued from scratch.** After the numbers were in hand, the [retrieval benchmark](/guide/retrieval-benchmark) stated:
   - a signal becomes a **default** when it wins at least five more tasks than it loses on the third-party corpus and loses net on no other corpus;
   - it is **deprecated** when its net is not positive and it changes at most two hits;
   - anything else stays **opt-in and measured**.

   The rule was written after seeing the results, so it is a standard for the next measurement, not a result.

## Consequences

- **A measured negative is a legitimate outcome.** Centrality was carried from v8.21.0 to v8.68.0 before a corpus that could judge it existed. An unmeasured flag is a liability.
- **Surface enrichment went the same way** (two hits changed, one each way). Mined expansions stayed opt-in (+3 on the third-party corpus, too thin for a sign test to separate from chance); the call-graph boost was net −3 and undecided when this was written.
- **The deprecation has a window.** A user hears before v9.0 removes the key, not after.

## Evidence

- `src/graph/centrality.js`; `src/config/loader.js` (`DEPRECATED_SIGNALS`, `warnDeprecatedSignals`).
- `test/integration/signal-deprecation.test.js`: a deprecated signal warns once per process and still works; a signal that is off, or one that earns its keep, never warns; the config reference marks the deprecated keys and only those.
- [Retrieval benchmark](/guide/retrieval-benchmark), "The opt-in ranking signals" — the per-corpus table behind the verdict — and [config reference](/guide/config).
- `CHANGELOG.md`, v8.21.0 (introduction, 77.8% / +0) and v8.68.0 (deprecation).

## Revisit when

Never as a default unless it meets the rule above on the third-party corpus. Removal in v9.0 is the plan; a measurement that showed a real win would change that plan, and would need to clear the same bar as any other signal.
