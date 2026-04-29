---
title: Retrieval benchmark
description: Latest saved retrieval benchmark for SigMap v6.5. 81.1% hit@5 vs 13.6% random baseline across 90 tasks on 18 repos.
head:
  - - meta
    - property: og:title
      content: "SigMap retrieval benchmark — 81.1% hit@5"
  - - meta
    - property: og:description
      content: "Latest saved run: 81.1% hit@5 vs 13.6% random baseline, 6.0x lift, 90 tasks, 18 repos."
  - - meta
    - property: og:url
      content: "https://manojmallick.github.io/sigmap/guide/retrieval-benchmark"
---

# Retrieval benchmark

::: info Official v6.5 benchmark snapshot
**Benchmark ID:** sigmap-v6.5-main &nbsp;·&nbsp; **Date:** 2026-04-25

| Metric | Value |
|---|---:|
| Hit@5 | **81.1%** vs 13.6% baseline |
| Graph-boosted hit@5 | **81.1%** |
| Retrieval lift | **6.0×** |
| Prompt reduction | **41.4%** (2.84 → 1.69) |
| Task success proxy | **52.2%** |
| Overall token reduction | **96.9%** |
| GPT-4o overflow (without → with) | **13/18 → 0/18** |
:::

Latest saved run: **2026-04-25 (v6.6.3)**

**Result:** SigMap finds the right file in the top 5 far more often than chance — **81.1% hit@5** vs **13.6%** random baseline across 90 tasks on 18 real repos.

## Why this benchmark matters

When a coding assistant misses the key file, everything downstream gets worse:

- more retries
- more clarifying questions
- more wrong-context answers

This benchmark isolates that first question: *did the right file appear in context?*

## Headline numbers

| Metric | Without SigMap | With SigMap |
|---|:---:|:---:|
| Average hit@5 | 13.6% | **81.1%** |
| Graph-boosted hit@5 | — | **80.0%** |
| Lift | — | **5.8x** |
| Correct (rank 1) | ~1% | **52.2%** |
| Partial (ranks 2–5) | ~13% | **26.7%** |
| Wrong (not in top 5) | ~86% | **21.1%** |

## Quality tiers from the saved run

| Tier | Tasks | Share |
|---|---:|---:|
| Correct | 47 / 90 | **52.2%** |
| Partial | 24 / 90 | **26.7%** |
| Wrong | 19 / 90 | **21.1%** |

## Per-repo results

| Repo | Random hit@5 | SigMap hit@5 | Lift | Correct / Partial / Wrong |
|---|:---:|:---:|:---:|---:|
| express | 83.3% | 80% | 1.0x | 2 / 2 / 1 |
| flask | 26.3% | 100% | 3.8x | 5 / 0 / 0 |
| gin | 4.7% | 80% | 17.0x | 3 / 1 / 1 |
| spring-petclinic | 38.5% | 60% | 1.6x | 3 / 0 / 2 |
| rails | 0.4% | 60% | 150.0x | 2 / 1 / 2 |
| axios | 20.0% | 60% | 3.0x | 2 / 1 / 2 |
| rust-analyzer | 0.8% | 100% | 125.0x | 4 / 1 / 0 |
| abseil-cpp | 0.7% | 100% | 142.9x | 3 / 2 / 0 |
| serilog | 5.1% | 60% | 11.8x | 1 / 2 / 2 |
| riverpod | 1.1% | 100% | 90.9x | 4 / 1 / 0 |
| okhttp | 27.8% | 100% | 3.6x | 5 / 0 / 0 |
| laravel | 0.3% | 100% | 333.3x | 2 / 3 / 0 |
| akka | 2.4% | 100% | 41.7x | 3 / 2 / 0 |
| vapor | 3.8% | 40% | 10.5x | 1 / 1 / 3 |
| vue-core | 2.2% | 100% | 45.5x | 1 / 4 / 0 |
| svelte | 1.4% | 60% | 42.9x | 0 / 3 / 2 |
| fastify | 16.1% | 60% | 3.7x | 3 / 0 / 2 |
| fastapi | 10.4% | 80% | 7.7x | 4 / 0 / 1 |

## What the benchmark does not measure

This benchmark does **not** score answer wording, correctness of prose, or stylistic quality. It measures a narrower prerequisite:

> whether the right source file is present in the ranked context.

That is why it pairs well with [judge](/guide/judge) and the [task benchmark](/guide/task-benchmark).

## Reproduce

```bash
node scripts/run-retrieval-benchmark.mjs --save
node scripts/run-retrieval-benchmark.mjs --json
```

For the full multi-benchmark dashboard:

```bash
node scripts/run-benchmark-matrix.mjs --save --skip-clone
```
