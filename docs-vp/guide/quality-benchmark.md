---
title: Quality benchmark
description: What token reduction means operationally in v8.51.4. 14/21 repos overflow GPT-4o without SigMap, 5,139 files would be hidden, 15,674 symbols are grounded, and input-cost savings reach $9,900+/month (GPT-4o), $11,900+ (Claude Sonnet), or $3,900+ (Claude Haiku) at 10 calls/day.
head:
  - - meta
    - property: og:title
      content: "SigMap quality benchmark — overflow, hidden files, and cost"
  - - meta
    - property: og:description
      content: "14/21 repos overflow GPT-4o without SigMap. 5,139 files would be hidden. 15,674 symbols grounded. Input-cost savings: $9,900+/mo GPT-4o, $11,900+ Claude Sonnet, $3,900+ Claude Haiku at 10 calls/day."
  - - meta
    - property: og:url
      content: "https://sigmap.io/guide/quality-benchmark"
---

# Quality benchmark

::: info Official v8.51.4 benchmark snapshot
**Benchmark ID:** sigmap-v8.51-main &nbsp;·&nbsp; **Date:** 2026-09-25 (with R language)

| Metric | Value |
|---|---:|
| Hit@5 (retrieval corpus, 105 tasks / 18 repos) | **78.6%** |
| Honest grep comparison (125 tasks / 19 repos) | **86.4%** vs 40.8% single-shot grep — **2.12× lift** |
| Honest lift (vs grep agent) | **2.12×** |
| Prompt reduction | **43.7%** (2.84 → 1.6) |
| Task success proxy | **61.9%** |
| Overall token reduction | **96.1%** |
| GPT-4o overflow (without → with) | **16/21 → 0/21** |
:::

Token reduction is the mechanism. This benchmark shows the operational consequence:

- does the repo fit inside model limits?
- how much code would be hidden without SigMap?
- what does that mean for API cost?

Latest saved run: **2026-09-25 (v8.51.4)**

How the repos and tasks are picked, and what the token numbers do and don't prove, is in [benchmark methodology](/guide/methodology).

## Headline numbers

| Metric | Without SigMap | With SigMap |
|---|:---:|:---:|
| GPT-4o overflow repos | **16 / 21** | 0 / 21 |
| Hidden files | **5,200+** | 0 |
| Grounded symbols surfaced | 0 | **15,674** |
| Monthly input savings (10 calls/day) | — | **$9,900+** GPT-4o · **$11,900+** Sonnet · **$3,900+** Haiku |

## 1. Context window fit

Raw repository content overflows GPT-4o's 128K window in **14 of 21** benchmark repos, and Claude's 200K window in **11 of 21**.

That means a tool has to omit or truncate content before the model answers. SigMap avoids this by staying inside the budgeted context envelope.

| Repo class | Without SigMap | With SigMap |
|---|---:|---:|
| GPT-4o fits | 7 / 21 | 21 / 21 |
| Claude 200K fits | 10 / 21 | 21 / 21 |
| Gemini 1M fits | 17 / 21 | 21 / 21 |

## 2. Hidden-file risk

Across the benchmark repos, **5,139** files would be hidden from the model in the raw-flow scenario.

This is the clearest explanation for why "just send the repo" is unreliable:

- some files never reach the model
- which files get dropped depends on the tool
- the omission is easy to miss until the answer is already wrong

SigMap changes that by surfacing compact signatures for the project structure ahead of time.

## 3. Grounded symbols

The latest saved run surfaced **15,674** grounded symbols across the benchmark repos, against **51,183** that stay dark without SigMap. That is the structural map the model can actually reason over.

Counting is **structural** — non-empty lines inside the fenced blocks the generated context already delimits. Until v8.51.4 the counter matched each line against a keyword-prefix allowlist (`function `, `class `, `def `, …), so every language whose signature begins with the identifier read as zero. R was the worst case: `name <- function(args)` matched nothing, so ggplot2 reported **1** grounded symbol against 964 real ones and this page published **0% grounding for R**. See [#694](https://github.com/manojmallick/sigmap/issues/694).

| Repo | Language | Grounded symbols | Grounding % |
|---|---|---:|---:|
| express | JavaScript | 11 | 14% |
| flask | Python | 228 | 54% |
| gin | Go | 651 | 59% |
| spring-petclinic | Java | 361 | 67% |
| rails | Ruby | 1,903 | 25% |
| axios | TypeScript | 183 | ≥100%* |
| rust-analyzer | Rust | 1,582 | 9% |
| abseil-cpp | C++ | 1,726 | 15% |
| serilog | C# | 174 | 31% |
| riverpod | Dart | 1,627 | 44% |
| okhttp | Kotlin | 179 | ≥100%* |
| laravel | PHP | 1,451 | 17% |
| akka | Scala | 1,052 | 27% |
| vapor | Swift | 217 | 25% |
| vue-core | Vue | 666 | 26% |
| svelte | Svelte | 1,108 | 50% |
| fastify | JavaScript | 191 | 61% |
| fastapi | Python | 335 | 38% |
| ggplot2 | R | 964 | 51% |
| dplyr | R | 517 | 71% |
| shiny | R | 548 | 41% |

Average across the **19 of 21** repos whose raw-symbol estimate held: **38%**.

\* `Grounding %` divides by `estimatedRawSymbols`, a `rawTokens / 200` heuristic. For **axios** (183 measured vs 161 estimated) and **okhttp** (179 measured vs 156 estimated) the measured count exceeds the estimate, so the ratio is not meaningful — the estimate is what is wrong there, not the measurement. Those rows are clamped, flagged, and excluded from the average rather than published as the impossible percentages they used to be (okhttp read 114%).

## 4. Cost impact

At 10 calls per day across the benchmark set. Token reduction is model-agnostic; the **dollar** figure scales with each model's input rate, so the same reduction saves different amounts per model. Pricing is per 1M input tokens, verified 2026-07 (GPT-4o [$2.50](https://openai.com/api/pricing/); Claude Sonnet 5/4.6 [$3.00](https://platform.claude.com/docs/en/about-claude/pricing) and Haiku 4.5 [$1.00](https://platform.claude.com/docs/en/about-claude/pricing)):

| Model | Input $/1M | Saved / day | Saved / month |
|---|:---:|---:|---:|
| GPT-4o | $2.50 | **$330+** | **$9,900+** |
| Claude Sonnet | $3.00 | **$390+** | **$11,900+** |
| Claude Haiku | $1.00 | **$130+** | **$3,900+** |

This is why the benchmark story is not just "smaller output." It directly affects the latency and cost profile of daily AI-assisted work — across whichever model you run.

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
