---
title: Task benchmark
description: Latest saved task benchmark for SigMap v7.27.0. 52.2% correct, 39.4% fewer prompts, 76% hit@5 across 90 tasks, with R language support.
head:
  - - meta
    - property: og:title
      content: "SigMap task benchmark — fewer retries, better context (with R language)"
  - - meta
    - property: og:description
      content: "Latest saved run: 52.2% correct, 1.72 prompts per task, 39.4% prompt reduction, 90 tasks, 18+ repos with R support."
  - - meta
    - property: og:url
      content: "https://sigmap.io/guide/task-benchmark"
---

# Task benchmark

::: info Official v7.27.0 benchmark snapshot
**Benchmark ID:** sigmap-v7.27-main &nbsp;·&nbsp; **Date:** 2026-06-22 (with R language)

| Metric | Value |
|---|---:|
| Hit@5 | **76%** vs 13.6% baseline |
| Graph-boosted hit@5 | **76%** |
| Retrieval lift | **5.6×** |
| Prompt reduction | **39.4%** (2.84 → 1.72) |
| Task success proxy | **52.2%** |
| Token reduction (21 repos) | **97.0%** |
| GPT-4o overflow (without → with) | **16/21 → 0/21** |
:::

Latest saved run: **2026-06-22 (v7.27.0)** — Now includes R language support (ggplot2, dplyr, shiny)

This page answers the question people care about most:

> does SigMap help the developer finish the task with fewer retries?

## Headline result

| Metric | Without SigMap | With SigMap |
|---|:---:|:---:|
| Task success proxy | 10% | **52.2%** |
| Prompts per task | 2.84 | **1.67** |
| Prompt reduction | — | **39.4%** |
| Retrieval hit@5 | 13.6% | **76%** |
| Token reduction | — | **97.0%** |

## Why the task benchmark exists

Retrieval is a prerequisite, but not the whole story. Developers feel the difference as:

- fewer prompt retries
- fewer "can you share more files?" loops
- fewer answers grounded in the wrong module

The task benchmark models that outcome from the ranked file quality tiers:

- rank 1 hit → likely one prompt
- rank 2–5 hit → likely follow-up prompt
- miss → likely multiple retries

## Current saved score card

| Tier | Meaning | Tasks | Share |
|---|---|---:|---:|
| Correct | Right file was ranked first | 47 | **52.2%** |
| Partial | Right file was present but not first | 24 | **26.7%** |
| Wrong | Right file never surfaced in top 5 | 19 | **21.1%** |

## Prompt model summary

| Metric | Value |
|---|---:|
| Average prompts without SigMap | 2.84 |
| Average prompts with SigMap | **1.72** |
| Reduction | **39.4%** |
| Average hit@5 lift | **6.0x** across repo baselines |

## What changed in the v5 story

The earlier SigMap story was mostly "smaller context." The v5 story is more useful:

- use [ask](/guide/ask) to build the focused context
- use [validate](/guide/validate) to make sure coverage is healthy
- use [judge](/guide/judge) to check whether the answer was actually grounded
- use [learning](/guide/learning) when the same files repeatedly help or hurt

That makes the benchmark more than a marketing claim. It maps onto the actual daily workflow.

## Benchmark snapshot by repo

| Repo | Prompt reduction | Correct / Partial / Wrong |
|---|---:|---:|
| flask | 64.8% | 5 / 0 / 0 |
| gin | 43.7% | 3 / 1 / 1 |
| rails | 47.2% | 2 / 1 / 2 |
| rust-analyzer | 64.8% | 4 / 1 / 0 |
| serilog | 26.1% | 0 / 2 / 3 |
| laravel | 64.7% | 2 / 3 / 0 |
| vapor | 17.7% | 1 / 1 / 3 |
| fastapi | 48.9% | 4 / 0 / 1 |

These rows show why the task benchmark matters. Some repos have great retrieval lift but still need workflow help around validation and judge-based trust.

## Reproduce

```bash
node scripts/run-task-benchmark.mjs --save
node scripts/run-task-benchmark.mjs --json
```

For the full multi-benchmark dashboard:

```bash
node scripts/run-benchmark-matrix.mjs --save --skip-clone
open benchmarks/reports/benchmark-report.html
```
