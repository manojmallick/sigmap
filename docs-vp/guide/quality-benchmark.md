---
title: Quality benchmark
description: What token reduction means operationally in v5.9. 13/18 repos overflow GPT-4o without SigMap, 5,047 files would be hidden, and GPT-4o input savings reach $9,390.06/month at 10 calls/day.
head:
  - - meta
    - property: og:title
      content: "SigMap quality benchmark — overflow, hidden files, and cost"
  - - meta
    - property: og:description
      content: "13/18 repos overflow GPT-4o without SigMap. 5,047 files would be hidden. $9,390.15/month saved in GPT-4o input cost at 10 calls/day."
  - - meta
    - property: og:url
      content: "https://manojmallick.github.io/sigmap/guide/quality-benchmark"
---

# Quality benchmark

::: info Official v5.9 benchmark snapshot
**Benchmark ID:** sigmap-v5.9-main &nbsp;·&nbsp; **Date:** 2026-04-18

| Metric | Value |
|---|---:|
| Hit@5 | **80.0%** vs 13.6% baseline |
| Retrieval lift | **5.9×** |
| Prompt reduction | **41.2%** (2.84 → 1.67) |
| Task success proxy | **53.3%** |
| Overall token reduction | **98.1%** |
| GPT-4o overflow (without → with) | **13/18 → 0/18** |
:::

Token reduction is the mechanism. This benchmark shows the operational consequence:

- does the repo fit inside model limits?
- how much code would be hidden without SigMap?
- what does that mean for API cost?

Latest saved run: **2026-04-18 (v5.9.0)**

## Headline numbers

| Metric | Without SigMap | With SigMap |
|---|:---:|:---:|
| GPT-4o overflow repos | **13 / 18** | 0 / 18 |
| Hidden files | **5,047** | 0 |
| Grounded symbols surfaced | 0 | **16,131** |
| GPT-4o monthly input savings | — | **$9,390.06** |

## 1. Context window fit

Raw repository content overflows GPT-4o's 128K window in **13 of 18** benchmark repos. It overflows Claude's 200K window in **9 of 18** repos.

That means a tool has to omit or truncate content before the model answers. SigMap avoids this by staying inside the budgeted context envelope.

| Repo class | Without SigMap | With SigMap |
|---|---:|---:|
| GPT-4o fits | 5 / 18 | 18 / 18 |
| Claude 200K fits | 9 / 18 | 18 / 18 |
| Gemini 1M fits | 14 / 18 | 18 / 18 |

## 2. Hidden-file risk

Across the benchmark repos, **5,047** files would be hidden from the model in the raw-flow scenario.

This is the clearest explanation for why "just send the repo" is unreliable:

- some files never reach the model
- which files get dropped depends on the tool
- the omission is easy to miss until the answer is already wrong

SigMap changes that by surfacing compact signatures for the project structure ahead of time.

## 3. Grounded symbols

The latest saved run surfaced **16,131** grounded symbols across the benchmark repos. That is the structural map the model can actually reason over.

Without SigMap, the same benchmark set leaves **47,670** symbols effectively dark or unreachable to the model.

## 4. Cost impact

At 10 calls per day across the benchmark set:

| Model | Saved / day | Saved / month |
|---|---:|---:|
| GPT-4o | **$313.00** | **$9,390.15** |
| Claude Sonnet | **$375.61** | **$11,268.16** |

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
