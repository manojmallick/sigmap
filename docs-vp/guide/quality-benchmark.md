---
title: Quality benchmark
description: What token reduction means operationally in v7.25.2. 16/21 repos overflow GPT-4o without SigMap, 5,200+ files would be hidden, and GPT-4o input savings reach $10,500+/month at 10 calls/day.
head:
  - - meta
    - property: og:title
      content: "SigMap quality benchmark — overflow, hidden files, and cost"
  - - meta
    - property: og:description
      content: "16/21 repos overflow GPT-4o without SigMap. 5,200+ files would be hidden. $10,500+/month saved in GPT-4o input cost at 10 calls/day."
  - - meta
    - property: og:url
      content: "https://sigmap.io/guide/quality-benchmark"
---

# Quality benchmark

::: info Official v7.25.2 benchmark snapshot
**Benchmark ID:** sigmap-v7.25-main &nbsp;·&nbsp; **Date:** 2026-06-22 (with R language)

| Metric | Value |
|---|---:|
| Hit@5 | **76%** vs 13.6% baseline |
| Retrieval lift | **5.6×** |
| Prompt reduction | **39.4%** (2.84 → 1.72) |
| Task success proxy | **52.2%** |
| Overall token reduction | **97.0%** |
| GPT-4o overflow (without → with) | **16/21 → 0/21** |
:::

Token reduction is the mechanism. This benchmark shows the operational consequence:

- does the repo fit inside model limits?
- how much code would be hidden without SigMap?
- what does that mean for API cost?

Latest saved run: **2026-06-22 (v7.25.2)**

## Headline numbers

| Metric | Without SigMap | With SigMap |
|---|:---:|:---:|
| GPT-4o overflow repos | **16 / 21** | 0 / 21 |
| Hidden files | **5,200+** | 0 |
| Grounded symbols surfaced | 0 | **16,500+** |
| GPT-4o monthly input savings | — | **$10,500+** |

## 1. Context window fit

Raw repository content overflows GPT-4o's 128K window in **16 of 21** benchmark repos. It overflows Claude's 200K window in many of 21 repos.

That means a tool has to omit or truncate content before the model answers. SigMap avoids this by staying inside the budgeted context envelope.

| Repo class | Without SigMap | With SigMap |
|---|---:|---:|
| GPT-4o fits | 5 / 21 | 21 / 21 |
| Claude 200K fits | 9 / 21 | 21 / 21 |
| Gemini 1M fits | 14 / 21 | 21 / 21 |

## 2. Hidden-file risk

Across the benchmark repos, **5,200+** files would be hidden from the model in the raw-flow scenario.

This is the clearest explanation for why "just send the repo" is unreliable:

- some files never reach the model
- which files get dropped depends on the tool
- the omission is easy to miss until the answer is already wrong

SigMap changes that by surfacing compact signatures for the project structure ahead of time.

## 3. Grounded symbols

The latest saved run surfaced **16,500+** grounded symbols across the benchmark repos. That is the structural map the model can actually reason over.

Without SigMap, the same benchmark set leaves symbols effectively dark or unreachable to the model.

## 4. Cost impact

At 10 calls per day across the benchmark set:

| Model | Saved / day | Saved / month |
|---|---:|---:|
| GPT-4o | **$350+** | **$10,500+** |
| Claude Sonnet | **$400+** | **$12,000+** |

This is why the benchmark story is not just "smaller output." It directly affects the latency and cost profile of daily AI-assisted work.

## Reproduce

```bash
node scripts/run-benchmark.mjs --save --skip-clone
node scripts/run-quality-benchmark.mjs --save
node scripts/run-benchmark-matrix.mjs --save --skip-clone
```

Open the HTML dashboard for the full saved snapshot:

```bash
open benchmarks/reports/benchmark-report.html
```
