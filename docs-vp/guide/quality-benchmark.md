---
title: Quality benchmark
description: What token reduction means operationally in v8.85.0. 14/21 repos overflow GPT-4o without SigMap, 5,345 files would be hidden, 17,979 symbols are grounded, and input-cost savings reach $10,000+/month (GPT-4o), $12,000+ (Claude Sonnet), or $4,000+ (Claude Haiku) at 10 calls/day.
head:
  - - meta
    - property: og:title
      content: "SigMap quality benchmark — overflow, hidden files, and cost"
  - - meta
    - property: og:description
      content: "14/21 repos overflow GPT-4o without SigMap. 5,345 files would be hidden. 17,979 symbols grounded. Input-cost savings: $10,000+/mo GPT-4o, $12,000+ Claude Sonnet, $4,000+ Claude Haiku at 10 calls/day."
  - - meta
    - property: og:url
      content: "https://sigmap.io/guide/quality-benchmark"
---

# Quality benchmark

::: info Official v8.85.0 benchmark snapshot
**Benchmark ID:** sigmap-v8.85-main &nbsp;·&nbsp; **Date:** 2026-10-27 (with R language)

| Metric | Value |
|---|---:|
| Hit@5 (retrieval corpus, 105 tasks / 18 repos) | **80.4%** |
| Honest grep comparison (125 tasks / 19 repos) | **92.8%** vs 39.2% single-shot grep — **2.37× lift** |
| Honest lift (vs grep agent) | **2.37×** |
| Prompt reduction | **44.4%** (2.84 → 1.58) |
| Task success proxy | **61.9%** |
| Overall token reduction | **95.2%** |
| GPT-4o overflow (without → with) | **14/21 → 0/21** |
:::

Token reduction is the mechanism. This benchmark shows the operational consequence:

- does the repo fit inside model limits?
- how much code would be hidden without SigMap?
- what does that mean for API cost?

Latest saved run: **2026-10-27 (v8.85.0)**

How the repos and tasks are picked, and what the token numbers do and don't prove, is in [benchmark methodology](/guide/methodology).

## Headline numbers

| Metric | Without SigMap | With SigMap |
|---|:---:|:---:|
| GPT-4o overflow repos | **14 / 21** | 0 / 21 |
| Files left out of the context | **5,345** | 4,557 (omitted from the written map by its token budget; still reachable through `sigmap ask`) |
| Grounded symbols surfaced | 0 | **17,979** |
| Monthly input savings (10 calls/day) | — | **$10,000+** GPT-4o · **$12,000+** Sonnet · **$4,000+** Haiku |

## 1. Context window fit

Raw repository content overflows GPT-4o's 128K window in **14 of 21** benchmark repos, and Claude's 200K window in **12 of 21**.

That means a tool has to omit or truncate content before the model answers. SigMap avoids this by staying inside the budgeted context envelope.

| Repo class | Without SigMap | With SigMap |
|---|---:|---:|
| GPT-4o fits | 7 / 21 | 21 / 21 |
| Claude 200K fits | 9 / 21 | 21 / 21 |
| Gemini 1M fits | 16 / 21 | 21 / 21 |

## 2. Hidden-file risk

Across the benchmark repos, **5,345** files would be hidden from the model in the raw-flow scenario.

This is the clearest explanation for why "just send the repo" is unreliable:

- some files never reach the model
- which files get dropped depends on the tool
- the omission is easy to miss until the answer is already wrong

SigMap changes that by surfacing compact signatures for the project structure ahead of time.

## 3. Grounded symbols

The latest saved run surfaced **17,979** grounded symbols across the benchmark repos, against **50,589** that stay dark without SigMap. That is the structural map the model can actually reason over.

Counting is **structural** — non-empty lines inside the fenced blocks the generated context already delimits. Until v8.51.4 the counter matched each line against a keyword-prefix allowlist (`function `, `class `, `def `, …), so every language whose signature begins with the identifier read as zero. R was the worst case: `name <- function(args)` matched nothing, so ggplot2 reported **1** grounded symbol against 964 real ones and this page published **0% grounding for R**. See [#694](https://github.com/manojmallick/sigmap/issues/694).

| Repo | Language | Grounded symbols | Grounding % |
|---|---|---:|---:|
| express | JavaScript | 94 | ≥100%* |
| flask | Python | 274 | 65% |
| gin | Go | 709 | 67% |
| spring-petclinic | Java | 411 | 77% |
| rails | Ruby | 2,147 | 29% |
| axios | TypeScript | 239 | ≥100%* |
| rust-analyzer | Rust | 1,747 | 10% |
| abseil-cpp | C++ | 1,501 | 13% |
| serilog | C# | 269 | 45% |
| riverpod | Dart | 1,765 | 47% |
| okhttp | Kotlin | 209 | ≥100%* |
| laravel | PHP | 1,638 | 20% |
| akka | Scala | 1,737 | 34% |
| vapor | Swift | 479 | 43% |
| vue-core | Vue | 893 | 33% |
| svelte | Svelte | 1,256 | 57% |
| fastify | JavaScript | 231 | 74% |
| fastapi | Python | 340 | 38% |
| ggplot2 | R | 955 | 50% |
| dplyr | R | 531 | 73% |
| shiny | R | 554 | 42% |

Average across the **19 of 21** repos whose raw-symbol estimate held: **46%**.

\* `Grounding %` divides by `estimatedRawSymbols`, a `rawTokens / 200` heuristic. For **axios** (235 measured vs 182 estimated) and **okhttp** (209 measured vs 156 estimated) the measured count exceeds the estimate, so the ratio is not meaningful — the estimate is what is wrong there, not the measurement. Those rows are clamped, flagged, and excluded from the average rather than published as the impossible percentages they used to be (okhttp read 114%).

## 4. Cost impact

At 10 calls per day across the benchmark set. Token reduction is model-agnostic; the **dollar** figure scales with each model's input rate, so the same reduction saves different amounts per model. Pricing is per 1M input tokens, verified 2026-07 (GPT-4o [$2.50](https://openai.com/api/pricing/); Claude Sonnet 5/4.6 [$3.00](https://platform.claude.com/docs/en/about-claude/pricing) and Haiku 4.5 [$1.00](https://platform.claude.com/docs/en/about-claude/pricing)):

| Model | Input $/1M | Saved / day | Saved / month |
|---|:---:|---:|---:|
| GPT-4o | $2.50 | **$334+** | **$10,000+** |
| Claude Sonnet | $3.00 | **$400+** | **$12,000+** |
| Claude Haiku | $1.00 | **$133+** | **$4,000+** |

::: warning These rates are the benchmark's own, and one is out of date (v8.63.0)
The table is priced from a literal inside `scripts/run-quality-benchmark.mjs`, last verified 2026-07 — not from the dated [model profile](/guide/config#models) that `gain`, `--cost` and `ask` price from since v8.63.0. The two disagree on Claude Sonnet. The profile, checked against Anthropic's pricing page on 2026-10-04, prices the current Sonnet (5.5) at **$2.00**, and that page lists Sonnet 5 at $2.00 as well; only Sonnet 4.6 is $3.00. Read the Sonnet row as a Sonnet 4.6 figure: at $2.00 it scales to two-thirds of what is shown. The GPT-4o and Haiku rates match the profile.

The same script treats "Claude" as a 200K window in the context-fit section above. That holds for Haiku 4.5; Sonnet 4.6 and later carry 1M.

The benchmark was not re-priced in this release, so the published figures are unchanged from v8.62.2.
:::

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
