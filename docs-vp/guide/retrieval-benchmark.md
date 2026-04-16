---
title: Retrieval benchmark
description: Latest saved retrieval benchmark for SigMap v5.2.0. 78.9% hit@5 vs 13.6% random baseline across 90 tasks on 18 repos.
head:
  - - meta
    - property: og:title
      content: "SigMap retrieval benchmark — 78.9% hit@5"
  - - meta
    - property: og:description
      content: "Latest saved run: 78.9% hit@5 vs 13.6% random baseline, 5.8x lift, 90 tasks, 18 repos."
  - - meta
    - property: og:url
      content: "https://manojmallick.github.io/sigmap/guide/retrieval-benchmark"
---

# Retrieval benchmark

Latest saved run: **2026-04-16 (v5.2.0)**

**Result:** SigMap finds the right file in the top 5 far more often than chance — **78.9% hit@5** vs **13.6%** random baseline across 90 coding tasks on 18 public repos.

## Summary

| Metric | Baseline | SigMap |
|---|:---:|:---:|
| Average hit@5 | 13.6% | **78.9%** |
| Lift | — | **5.8×** |
| Correct (rank 1) | ~1% | **52.2%** |
| Partial (ranks 2-5) | — | **27.8%** |
| Wrong (miss) | **86.4%** | **20.0%** |

## Quality tiers across 90 tasks

| Tier | Tasks | Share |
|---|---:|---:|
| Correct | 47 / 90 | **52.2%** |
| Partial | 25 / 90 | **27.8%** |
| Wrong | 18 / 90 | **20.0%** |

## What this benchmark answers

When you ask an LLM a coding question, the first failure mode is simple: the model never saw the file that mattered. This benchmark measures whether SigMap surfaces that file high enough in the ranked context to make a good answer possible.

It does **not** measure prose quality directly. That is why it pairs with the [task benchmark](/guide/task-benchmark) and `sigmap judge`.

## Representative repo results

| Repo | Random hit@5 | SigMap hit@5 | Notes |
|---|:---:|:---:|---|
| `flask` | 26.3% | **100%** | small, well-scoped source tree |
| `rails` | 0.4% | **60%** | large repo, still a major lift |
| `rust-analyzer` | 0.8% | **100%** | large repo, low random baseline |
| `laravel` | 0.3% | **100%** | huge search space, strong retrieval gain |
| `fastapi` | 10.4% | **80%** | mid-sized Python framework |

## Reproduce

```bash
node scripts/run-retrieval-benchmark.mjs --save
node scripts/run-retrieval-benchmark.mjs --json
```
