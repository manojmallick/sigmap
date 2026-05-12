---
title: Benchmark overview
description: Official v6.10.10 benchmark snapshot. 97.9% average token reduction across 21 repos, 78.9% retrieval hit@5, 40.6% fewer prompts, and R language support verified.
head:
  - - meta
    - property: og:title
      content: "SigMap benchmark overview — v6.10.10 snapshot with R language"
  - - meta
    - property: og:description
      content: "Token, retrieval, quality, and task metrics from latest v6.10.10 benchmark run with 21 repositories including R language support."
  - - meta
    - property: og:url
      content: "https://manojmallick.github.io/sigmap/guide/benchmark"
---

# Benchmark overview

::: info Official v6.10.10 benchmark snapshot (21 repos, including R language)
**Benchmark ID:** sigmap-v6.10-main &nbsp;·&nbsp; **Date:** 2026-05-12

| Metric | Value |
|---|---:|
| Hit@5 (18 core repos) | **78.9%** vs 13.6% baseline |
| Token reduction (21 repos) | **97.9%** |
| Retrieval lift | **5.8×** |
| Prompt reduction | **40.6%** (2.84 → 1.66) |
| Task success proxy | **52.2%** |
| GPT-4o overflow (without → with) | **16/21 → 0/21** |
:::

This is the landing page for the public benchmark story. It answers four different questions:

| If you want to prove... | Open |
|---|---|
| SigMap reduces context size dramatically | [Token reduction](/guide/benchmark) |
| SigMap finds the right file more often | [Retrieval benchmark](/guide/retrieval-benchmark) |
| SigMap reduces retries and wrong-context answers | [Task benchmark](/guide/task-benchmark) |
| SigMap keeps large repos inside model limits | [Quality benchmark](/guide/quality-benchmark) |

## Official v6.10.10 snapshot (with R language support)

Latest saved benchmark run: **2026-05-12 (v6.10.10)**

| Metric | Result |
|---|---:|
| Token reduction repos | 21 (including R: ggplot2, dplyr, shiny) |
| Retrieval benchmark repos | 18 (core languages) |
| Total tasks | 90 |
| Average token reduction (all 21) | **97.9%** (13.5M → 278.1K tokens) |
| Retrieval hit@5 (18 core) | **78.9%** |
| Graph-boosted hit@5 | **78.9%** |
| Random baseline hit@5 | 13.6% |
| Prompt reduction | **40.6%** (2.84 → 1.66 prompts) |
| GPT-4o overflow repos without SigMap | **16 / 21** |
| GPT-4o monthly input savings at 10 calls/day | **$10,500+** |

## What each benchmark proves

### 1. Token reduction (21 repositories)

- Raw source across benchmark set: **13,499,894** tokens (21 repos)
- Final SigMap output: **278,065** tokens
- Overall reduction: **97.9%**
- **New in v6.10.10:** R language support verified
  - ggplot2: 94.3% reduction (381.5K → 21.7K tokens)
  - dplyr: 93.4% reduction (145.1K → 9.5K tokens)
  - shiny: 96.2% reduction (264.6K → 10.0K tokens)

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

- **16/21** repos overflow GPT-4o's 128K context window without SigMap
- R repos add to overflow risk: ggplot2 and shiny both overflow without SigMap
- **5,200+** files would be hidden from the model in the raw-flow scenario
- **16,500+** symbols are surfaced in SigMap output across all benchmark repos
- With SigMap: **0/21 repos overflow** — all repos fit within 128K context

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
