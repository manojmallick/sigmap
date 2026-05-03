---
title: Benchmark overview
description: Official v6.8 benchmark snapshot. 96.8% average token reduction, 80.0% retrieval hit@5, 41.0% fewer prompts, and 13/18 raw repos overflowing GPT-4o without SigMap.
head:
  - - meta
    - property: og:title
      content: "SigMap benchmark overview — v6.8 snapshot"
  - - meta
    - property: og:description
      content: "One place for token, retrieval, quality, and task metrics from the latest saved v6.8 benchmark run."
  - - meta
    - property: og:url
      content: "https://manojmallick.github.io/sigmap/guide/benchmark"
---

# Benchmark overview

::: info Official v6.8 benchmark snapshot
**Benchmark ID:** sigmap-v6.8-main &nbsp;·&nbsp; **Date:** 2026-05-03

| Metric | Value |
|---|---:|
| Hit@5 | **80.0%** vs 13.6% baseline |
| Graph-boosted hit@5 | **80.0%** |
| Retrieval lift | **5.9×** |
| Prompt reduction | **41.0%** (2.84 → 1.68) |
| Task success proxy | **52.2%** |
| Overall token reduction | **96.8%** |
| GPT-4o overflow (without → with) | **13/18 → 0/18** |
:::

This is the landing page for the public benchmark story. It answers four different questions:

| If you want to prove... | Open |
|---|---|
| SigMap reduces context size dramatically | [Token reduction](/guide/benchmark) |
| SigMap finds the right file more often | [Retrieval benchmark](/guide/retrieval-benchmark) |
| SigMap reduces retries and wrong-context answers | [Task benchmark](/guide/task-benchmark) |
| SigMap keeps large repos inside model limits | [Quality benchmark](/guide/quality-benchmark) |

## Official v6.8 snapshot

Latest saved benchmark run: **2026-05-03 (v6.8.0)**

| Metric | Result |
|---|---:|
| Repos | 18 |
| Tasks | 90 |
| Average token reduction by repo | **96.8%** |
| Retrieval hit@5 | **80.0%** |
| Graph-boosted hit@5 | **80.0%** |
| Random baseline hit@5 | 13.6% |
| Prompt reduction | **41.0%** (2.84 → 1.68 prompts) |
| GPT-4o overflow repos without SigMap | **13 / 18** |
| GPT-4o monthly input savings at 10 calls/day | **$9,337.58** |

## What each benchmark proves

### 1. Token reduction

- Raw source across the benchmark set: **12,837,269** tokens
- Final SigMap output: **241,328** tokens
- Best summary for launch messaging: **98.1% overall reduction**

### 2. Retrieval quality

- SigMap hit@5: **80.0%**
- Graph-boosted hit@5: **80.0%** (+0.0pp with dependency graph)
- Random baseline: **13.6%**
- Lift: **5.9x**

This is the best benchmark when the question is: *"Does SigMap actually put the right file in context?"*

### 3. Task outcomes

- Correct: **47 / 90** (52.2%)
- Partial: **24 / 90** (26.7%)
- Wrong: **19 / 90** (21.1%)
- Average prompts: **2.84 → 1.68**

This is the best benchmark when the question is: *"Does the developer need fewer retries to finish the job?"*

### 4. Quality and overflow

- **13/18** repos overflow GPT-4o's 128K context window without SigMap
- **5,047** files would be hidden from the model in the raw-flow scenario
- **16,131** symbols are surfaced in SigMap output across the benchmark repos

This is the best benchmark when the question is: *"Why does token reduction matter operationally?"*

## Open the HTML dashboard

The easiest way to inspect the latest benchmark run is the self-contained HTML report:

```bash
node scripts/run-benchmark-matrix.mjs --save --skip-clone
open benchmarks/reports/benchmark-report.html
```

That generates synchronized JSON plus a dashboard for token, retrieval, quality, and task metrics together.

## Reproduce the full benchmark set

```bash
node scripts/run-benchmark.mjs --save --skip-clone
node scripts/run-retrieval-benchmark.mjs --save
node scripts/run-quality-benchmark.mjs --save
node scripts/run-task-benchmark.mjs --save
node scripts/run-benchmark-matrix.mjs --save --skip-clone
```

The matrix run writes:

- `benchmarks/reports/token-reduction.json`
- `benchmarks/reports/retrieval.json`
- `benchmarks/reports/quality.json`
- `benchmarks/reports/task-benchmark.json`
- `benchmarks/reports/benchmark-matrix.json`
- `benchmarks/reports/benchmark-report.html`

## Benchmark resources

- **[Benchmark suite →](https://github.com/manojmallick/sigmap-benchmark-suite)** — Open-source scripts, 90 real-world coding tasks, and per-repo raw results
- **[Archived data (Zenodo) →](https://zenodo.org/records/19898842)** — Full benchmark dataset for reproducibility and independent analysis
- **[Hacker News discussion →](https://news.ycombinator.com/item?id=47956790)** — Community feedback and related work
