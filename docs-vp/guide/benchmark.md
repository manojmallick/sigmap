---
title: Benchmark overview
description: Official v5.2.0 benchmark snapshot. 98.1% overall token reduction, 78.9% retrieval hit@5, 40.6% fewer prompts, and 13/18 raw repos overflowing GPT-4o without SigMap.
head:
  - - meta
    - property: og:title
      content: "SigMap benchmark overview — v5.2.0 snapshot"
  - - meta
    - property: og:description
      content: "One place for token, retrieval, quality, and task metrics from the latest saved v5.2.0 benchmark run."
  - - meta
    - property: og:url
      content: "https://manojmallick.github.io/sigmap/guide/benchmark"
  - - meta
    - name: keywords
      content: "sigmap benchmark overview, token reduction, retrieval benchmark, task benchmark, quality benchmark"
---

# Benchmark overview

Latest saved benchmark run: **2026-04-16 (v5.2.0)**

## Official release snapshot

| Metric | Value |
|---|---:|
| Repos | 18 |
| Tasks | 90 |
| Overall token reduction | **98.1%** |
| Retrieval hit@5 | **78.9%** |
| Task success proxy | **52.2%** |
| Prompt reduction | **40.6%** |
| GPT-4o monthly input savings at 10 calls/day | **$9,390.15** |
| Raw repos that overflow GPT-4o 128K without SigMap | **13 / 18** |

## Which benchmark proves what

| Question | Page |
|---|---|
| Does SigMap reduce context size enough to matter? | [Quality benchmark](/guide/quality-benchmark) |
| Does it put the right file in context? | [Retrieval benchmark](/guide/retrieval-benchmark) |
| Does that reduce retries on real tasks? | [Task benchmark](/guide/task-benchmark) |
| Does the same approach hold across languages and repo shapes? | [Generalization](/guide/generalization) |

## Why this snapshot is the one to use publicly

- it matches the current docs and release narrative for `v5.2.0`
- it reflects the workflow-first release: `ask`, `validate`, `judge`, `learn`, `weights`, `compare`, `share`
- it is the same snapshot used for the HTML benchmark dashboard

## Reproduce

```bash
node scripts/run-benchmark-matrix.mjs --save --skip-clone
```

That writes synchronized JSON reports plus a self-contained HTML dashboard in `benchmarks/reports/`.

## Saved outputs

- `benchmarks/reports/token-reduction.json`
- `benchmarks/reports/retrieval.json`
- `benchmarks/reports/quality.json`
- `benchmarks/reports/task-benchmark.json`
- `benchmarks/reports/benchmark-report.html`
