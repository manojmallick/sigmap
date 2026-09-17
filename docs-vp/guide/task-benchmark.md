---
title: Task benchmark
description: Latest saved task benchmark for SigMap v8.49.2. 61.9% correct, 43.7% fewer prompts, 78.6% hit@5 across 105 tasks, with R language support.
head:
  - - meta
    - property: og:title
      content: "SigMap task benchmark — fewer retries, better context (with R language)"
  - - meta
    - property: og:description
      content: "Latest saved run: 61.9% correct, 1.6 prompts per task, 43.7% prompt reduction, 105 tasks, 18 repos with R support."
  - - meta
    - property: og:url
      content: "https://sigmap.io/guide/task-benchmark"
---

# Task benchmark

::: info Official v8.49.2 benchmark snapshot
**Benchmark ID:** sigmap-v8.49-main &nbsp;·&nbsp; **Date:** 2026-09-15 (with R language)

| Metric | Value |
|---|---:|
| Hit@5 | **78.6%** vs 44.0% single-shot grep baseline |
| Graph-boosted hit@5 | **78.6%** |
| Honest lift (vs grep agent) | **1.73×** |
| Prompt reduction | **43.7%** (2.84 → 1.6) |
| Task success proxy | **61.9%** |
| Token reduction (21 repos) | **96.6%** |
| GPT-4o overflow (without → with) | **16/21 → 0/21** |
:::

Latest saved run: **2026-09-15 (v8.49.2)** — includes R language support (ggplot2, dplyr, shiny)

The success/proxy definitions and the task corpus are described in [benchmark methodology](/guide/methodology).

This page answers the question people care about most:

> does SigMap help the developer finish the task with fewer retries?

## Headline result

| Metric | Without SigMap | With SigMap |
|---|:---:|:---:|
| Task success proxy | 10% | **61.9%** |
| Prompts per task | 2.84 | **1.6** |
| Prompt reduction | — | **48%** |
| Retrieval hit@5 | 13.6% | **88%** |
| Token reduction | — | **96.6%** |

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
| Correct | Right file was ranked first | 65 | **61.9%** |
| Partial | Right file was present but not first | 18 | **17.1%** |
| Wrong | Right file never surfaced in top 5 | 23 | **21.9%** |

## Prompt model summary

| Metric | Value |
|---|---:|
| Average prompts without SigMap | 2.84 |
| Average prompts with SigMap | **1.6** |
| Reduction | **43.7%** |
| Honest hit@5 lift | **1.73x** vs single-shot grep baseline (per-repo random lifts remain in the report as data) |

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
| express | 31.3% | 5 / 3 / 0 |
| flask | 34.8% | 5 / 0 / 3 |
| gin | 57.5% | 6 / 2 / 0 |
| spring-petclinic | 44.8% | 4 / 0 / 1 |
| rails | 53.3% | 3 / 2 / 0 |
| axios | 13.9% | 1 / 3 / 4 |
| rust-analyzer | 59.9% | 4 / 1 / 0 |
| abseil-cpp | 66.6% | 5 / 0 / 0 |
| serilog | 4.7% | 0 / 1 / 4 |
| riverpod | 53.1% | 4 / 0 / 1 |
| okhttp | 62.5% | 5 / 0 / 0 |
| laravel | 60.0% | 4 / 1 / 0 |
| akka | 52.9% | 3 / 2 / 0 |
| vapor | 5.2% | 0 / 1 / 4 |
| vue-core | 59.6% | 4 / 1 / 0 |
| svelte | 39.7% | 3 / 0 / 2 |
| fastify | 37.7% | 5 / 0 / 3 |
| fastapi | 44.4% | 3 / 1 / 1 |

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
