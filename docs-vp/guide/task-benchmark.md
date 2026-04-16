---
title: Task benchmark
description: Latest saved task benchmark for SigMap v5.2. 52.2% correct, 40.6% fewer prompts, and 78.9% hit@5 across 90 tasks on 18 repos.
head:
  - - meta
    - property: og:title
      content: "SigMap task benchmark — fewer retries, better context"
  - - meta
    - property: og:description
      content: "Latest saved run: 52.2% correct, 1.69 prompts per task, 40.6% prompt reduction, 90 tasks, 18 repos."
  - - meta
    - property: og:url
      content: "https://manojmallick.github.io/sigmap/guide/task-benchmark"
---

# Task benchmark

Latest saved run: **2026-04-16 (v5.2.0)**

This page answers the question people care about most:

> does SigMap help the developer finish the task with fewer retries?

## Headline result

| Metric | Without SigMap | With SigMap |
|---|:---:|:---:|
| Task success proxy | 10% | **52.2%** |
| Prompts per task | 2.84 | **1.69** |
| Prompt reduction | — | **40.6%** |
| Retrieval hit@5 | 13.6% | **78.9%** |

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
| Average prompts with SigMap | **1.69** |
| Reduction | **40.6%** |
| Average hit@5 lift | **55.4x** across repo baselines |

## What changed in the v5 story

The earlier SigMap story was mostly "smaller context." The v5.2 story is more useful:

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
