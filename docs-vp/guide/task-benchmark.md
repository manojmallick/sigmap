---
title: Task benchmark
description: Latest saved task benchmark for SigMap v5.2.0. 52.2% correct, 40.6% fewer prompts, and 78.9% hit@5 across 90 tasks on 18 repos.
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

This page answers the practical question:

> does SigMap help the developer finish the task with fewer retries?

## Release snapshot

| Metric | Without SigMap | With SigMap |
|---|:---:|:---:|
| Task success proxy | 10% | **52.2%** |
| Prompts per task | 2.84 | **1.69** |
| Prompt reduction | — | **40.6%** |
| Retrieval hit@5 | 13.6% | **78.9%** |

## Why this is a proxy

The task benchmark is derived from retrieval quality tiers:

- rank 1 means the model got the key file immediately
- ranks 2-5 mean the needed file was present, but not perfectly prioritized
- a miss means the model is likely working from the wrong code and the user needs more back-and-forth

That makes it a useful release metric even without an LLM judge in the loop.

## Task tier breakdown

| Tier | Meaning | Tasks | Share |
|---|---|---:|---:|
| Correct | Right file was ranked first | 47 | **52.2%** |
| Partial | Right file appeared, but not first | 25 | **27.8%** |
| Wrong | Right file missed the top 5 | 18 | **20.0%** |

## Why this matters

The benchmark lines up with the day-to-day SigMap workflow:

- use `ask` to build the focused context
- use `validate` before trusting low-coverage queries
- use `judge` to check whether the answer was actually grounded
- use `learn` and `weights` when the same files repeatedly help or hurt

## Reproduce

```bash
node scripts/run-task-benchmark.mjs --save
node scripts/run-task-benchmark.mjs --json
```
