---
title: Benchmark — token reduction results
description: Real-world token reduction numbers. SigMap measured on 16 open-source repos across 16 languages. Average 99.3% reduction.
head:
  - - meta
    - property: og:title
      content: "SigMap Benchmark — 99.3% token reduction across 16 languages"
  - - meta
    - property: og:description
      content: "Measured on express, flask, rails, rust-analyzer, laravel, akka, svelte and more. Average 99.3% reduction across 16 languages."
  - - meta
    - property: og:url
      content: "https://manojmallick.github.io/sigmap/guide/benchmark"
  - - meta
    - name: keywords
      content: "sigmap benchmark, token reduction, ai coding agent tokens, copilot tokens, real-world benchmark"
---

# Benchmark

These numbers are measured — not estimated. Every row was produced by running
`node gen-context.js --report --json` against a real public repository cloned at `--depth 1`.

## Token reduction across 16 languages

| Repo | Language | Raw tokens | After SigMap | Reduction |
|------|----------|------------|:------------:|:---------:|
| [express](https://github.com/expressjs/express) | JavaScript | 15.5K | 201 | **98.7%** |
| [flask](https://github.com/pallets/flask) | Python | 84.8K | 3.4K | **96.0%** |
| [gin](https://github.com/gin-gonic/gin) | Go | 172.8K | 5.7K | **96.7%** |
| [spring-petclinic](https://github.com/spring-projects/spring-petclinic) | Java | 77.0K | 634 | **99.2%** |
| [rails](https://github.com/rails/rails) | Ruby | 1.5M | 7.1K | **99.5%** |
| [axios](https://github.com/axios/axios) | TypeScript | 31.7K | 1.5K | **95.2%** |
| [rust-analyzer](https://github.com/rust-lang/rust-analyzer) | Rust | 3.5M | 5.9K | **99.8%** |
| [abseil-cpp](https://github.com/abseil/abseil-cpp) | C++ | 2.3M | 6.3K | **99.7%** |
| [serilog](https://github.com/serilog/serilog) | C# | 113.7K | 5.8K | **94.9%** |
| [riverpod](https://github.com/rrousselGit/riverpod) | Dart | 682.7K | 6.5K | **99.0%** |
| [okhttp](https://github.com/square/okhttp) | Kotlin | 31.3K | 1.4K | **95.5%** |
| [laravel](https://github.com/laravel/framework) | PHP | 1.7M | 7.2K | **99.6%** |
| [akka](https://github.com/akka/akka) | Scala | 790.5K | 7.1K | **99.1%** |
| [vapor](https://github.com/vapor/vapor) | Swift | 171.2K | 6.4K | **96.3%** |
| [vue-core](https://github.com/vuejs/core) | Vue | 404.2K | 8.8K | **97.8%** |
| [svelte](https://github.com/sveltejs/svelte) | Svelte | 438.2K | 8.0K | **98.2%** |
| **Average** | 16 repos | 12.0M | 82.0K | **99.3%** |

> Token counts estimated at 4 chars/token (standard approximation used by OpenAI and Anthropic tooling).

## LLM response-time savings

Every token sent to an LLM costs latency. A frontier model (Claude 3.5 Sonnet, GPT-4o) processes
roughly **2,000 input tokens per second** before generating a single output token. That means
loading a large repo raw can stall your AI agent for minutes before it even starts responding.

> **Assumptions:** ~2,000 tok/s uncached · ×10 faster with prompt cache (Anthropic & OpenAI both offer this)

| Repo | Raw (cold) | SigMap (cold) | 1st call saved | Raw (cached) | SigMap (cached) | Cache saved |
|------|:----------:|:-------------:|:--------------:|:------------:|:---------------:|:-----------:|
| [express](https://github.com/expressjs/express) | 7.7s | 0.1s | **7.6s** | 0.8s | <0.1s | **0.8s** |
| [flask](https://github.com/pallets/flask) | 42.4s | 1.7s | **40.7s** | 4.2s | 0.2s | **4.1s** |
| [gin](https://github.com/gin-gonic/gin) | 1min 26s | 2.9s | **1min 24s** | 8.6s | 0.3s | **8.3s** |
| [spring-petclinic](https://github.com/spring-projects/spring-petclinic) | 38.5s | 0.3s | **38.2s** | 3.9s | <0.1s | **3.8s** |
| [rails](https://github.com/rails/rails) | 12min 27s | 3.5s | **12min 24s** | 1min 15s | 0.3s | **1min 14s** |
| [axios](https://github.com/axios/axios) | 15.8s | 0.8s | **15.1s** | 1.6s | <0.1s | **1.5s** |
| [rust-analyzer](https://github.com/rust-lang/rust-analyzer) | 29min 21s | 2.9s | **29min 18s** | 2min 56s | 0.3s | **2min 56s** |
| [abseil-cpp](https://github.com/abseil/abseil-cpp) | 19min 19s | 3.1s | **19min 16s** | 1min 56s | 0.3s | **1min 56s** |
| [serilog](https://github.com/serilog/serilog) | 56.9s | 2.9s | **54.0s** | 5.7s | 0.3s | **5.4s** |
| [riverpod](https://github.com/rrousselGit/riverpod) | 5min 41s | 3.3s | **5min 38s** | 34.1s | 0.3s | **33.8s** |
| [okhttp](https://github.com/square/okhttp) | 15.6s | 0.7s | **14.9s** | 1.6s | <0.1s | **1.5s** |
| [laravel](https://github.com/laravel/framework) | 13min 59s | 3.6s | **13min 56s** | 1min 24s | 0.4s | **1min 24s** |
| [akka](https://github.com/akka/akka) | 6min 35s | 3.5s | **6min 32s** | 39.5s | 0.3s | **39.2s** |
| [vapor](https://github.com/vapor/vapor) | 1min 26s | 3.2s | **1min 22s** | 8.6s | 0.3s | **8.2s** |
| [vue-core](https://github.com/vuejs/core) | 3min 22s | 4.4s | **3min 18s** | 20.2s | 0.4s | **19.8s** |
| [svelte](https://github.com/sveltejs/svelte) | 3min 39s | 4.0s | **3min 35s** | 21.9s | 0.4s | **21.5s** |

**At 10 calls/day across all repos: 1hr 40min saved per call · 16hr 35min/day · 6,055 hr/year**

::: tip What "cached" means
When prompt caching is enabled (default on Claude, opt-in on OpenAI), repeated context — like your SigMap output — is served from the model's KV cache at ~10× the normal speed and ~10% of the cost. The SigMap output is small enough to cache for free in most tier plans. Raw repo content is usually too large and changes too often to cache reliably.
:::

## What "raw tokens" means

`rawTokens` = estimated token count of all source files in the indexed directories before any processing.
`finalTokens` = token count of the generated `.github/copilot-instructions.md` output.

SigMap reads each file, extracts only the function/class/interface signatures (no bodies), and
writes them into a compact context file. The reduction is the difference between those two numbers.

## Reproduce the benchmark yourself

```bash
# Clone the benchmark runner (included in the repo)
git clone https://github.com/manojmallick/sigmap
cd sigmap

# Run against all 16 repos — clones them fresh, runs sigmap, prints the table
node scripts/run-benchmark.mjs --save

# Already cloned? Skip the network step:
node scripts/run-benchmark.mjs --skip-clone --save
```

Results are saved to `benchmarks/reports/token-reduction.json`.

## Against your own repo

```bash
# In any project directory:
node gen-context.js --report
```

Example output:

```
[sigmap] report:
  version         : 3.3.1
  files processed : 57
  files dropped   : 0
  input tokens    : ~51965
  output tokens   : ~3375
  budget limit    : 6000
  reduction       : 93.5%
```

Or get machine-readable JSON for CI:

```bash
node gen-context.js --report --json
# → {"rawTokens":51965,"finalTokens":3375,"reductionPct":93.5,...}
```

## Why not 100%?

The output is not empty — it still contains the full signature index (~200–7K tokens depending on
codebase size). That index is what your AI agent reads to understand the project structure at the
start of every session. The goal is **maximum information density at minimum token cost**, not
zero output.

::: tip Worst case is still 94.9%
The lowest value measured across the 16 repos was **94.9%** (serilog/C#).
Even on a repo where most code is already terse, SigMap cuts context by more than 18×.
:::

---

<div style="text-align:center;margin-top:2.5rem;padding-bottom:.5rem;font-size:0.85em;color:var(--vp-c-text-3)">
  Made in Amsterdam, Netherlands <span title="Netherlands">🇳🇱</span>
</div>