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

::: tip Worst case is still 95%
The lowest value measured across the 7 repos was **95.2%** (axios/TypeScript).
Even on a repo where most code is already terse, SigMap cuts context by more than 20×.
:::

## More languages coming

The 7 repos above cover the most common languages. Benchmarks for more languages
(C#, Kotlin, Swift, Dart, PHP, Scala) will be added as results are collected.
Follow the [roadmap](/guide/roadmap) for updates.
