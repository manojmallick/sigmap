---
title: Retrieval benchmark
description: Latest saved retrieval benchmark for SigMap v8.4.0. 87% hit@5 vs 13.6% random baseline across 90 tasks on 18 repos, with R language support.
head:
  - - meta
    - property: og:title
      content: "SigMap retrieval benchmark — 87% hit@5"
  - - meta
    - property: og:description
      content: "Latest saved run: 87% hit@5 vs 13.6% random baseline, 6.4x lift, 90 tasks, 18 repos."
  - - meta
    - property: og:url
      content: "https://sigmap.io/guide/retrieval-benchmark"
---

# Retrieval benchmark

::: info Official v8.4.0 benchmark snapshot
**Benchmark ID:** sigmap-v8.4-main &nbsp;·&nbsp; **Date:** 2026-07-04 (with R language)

| Metric | Value |
|---|---:|
| Hit@5 | **87%** vs 13.6% baseline |
| Graph-boosted hit@5 | **87%** |
| Retrieval lift | **6.4×** |
| Prompt reduction | **48.8%** (2.84 → 1.46) |
| Task success proxy | **67.8%** |
| Overall token reduction | **97.0%** |
| GPT-4o overflow (without → with) | **16/21 → 0/21** |
:::

Latest saved run: **2026-07-04 (v8.4.0)**

**Result:** SigMap finds the right file in the top 5 far more often than chance — **87% hit@5** vs **13.6%** random baseline across 90 tasks on 18 real repos.

## Why this benchmark matters

When a coding assistant misses the key file, everything downstream gets worse:

- more retries
- more clarifying questions
- more wrong-context answers

This benchmark isolates that first question: *did the right file appear in context?*

## Headline numbers

| Metric | Without SigMap | With SigMap |
|---|:---:|:---:|
| Average hit@5 | 13.6% | **86.7%** |
| Graph-boosted hit@5 | — | **86.7%** |
| Lift | — | **6.4x** |
| Correct (rank 1) | ~1% | **67.8%** |
| Partial (ranks 2–5) | ~13% | **18.9%** |
| Wrong (not in top 5) | ~86% | **13.3%** |

## Quality tiers from the saved run

| Tier | Tasks | Share |
|---|---:|---:|
| Correct | 61 / 90 | **67.8%** |
| Partial | 17 / 90 | **18.9%** |
| Wrong | 12 / 90 | **13.3%** |

## Per-repo results

| Repo | Random hit@5 | SigMap hit@5 | Lift | Correct / Partial / Wrong |
|---|:---:|:---:|:---:|---:|
| express | 83.3% | 100% | 1.2x | 3 / 2 / 0 |
| flask | 26.3% | 100% | 3.8x | 5 / 0 / 0 |
| gin | 4.7% | 100% | 21.4x | 4 / 1 / 0 |
| spring-petclinic | 38.5% | 100% | 2.6x | 5 / 0 / 0 |
| rails | 0.4% | 100% | 235.8x | 3 / 2 / 0 |
| axios | 20.0% | 80% | 4.0x | 1 / 3 / 1 |
| rust-analyzer | 0.8% | 100% | 127.0x | 4 / 1 / 0 |
| abseil-cpp | 0.7% | 100% | 140.0x | 5 / 0 / 0 |
| serilog | 5.1% | 20% | 4.0x | 0 / 1 / 4 |
| riverpod | 1.1% | 100% | 89.2x | 5 / 0 / 0 |
| okhttp | 27.8% | 100% | 3.6x | 5 / 0 / 0 |
| laravel | 0.3% | 100% | 306.6x | 4 / 1 / 0 |
| akka | 2.4% | 100% | 42.2x | 3 / 2 / 0 |
| vapor | 3.8% | 0% | 0.0x | 0 / 0 / 5 |
| vue-core | 2.2% | 100% | 46.4x | 4 / 1 / 0 |
| svelte | 1.4% | 100% | 74.0x | 3 / 2 / 0 |
| fastify | 16.1% | 80% | 5.0x | 4 / 0 / 1 |
| fastapi | 10.4% | 80% | 7.7x | 3 / 1 / 1 |

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
