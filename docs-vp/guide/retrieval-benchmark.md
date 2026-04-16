---
title: Retrieval benchmark — context relevance across 18 repos
description: SigMap hit@5 = 80% vs 13.6% random baseline. 5.9× lift. 90 real coding tasks across 18 repos measured without an LLM API. Last run v5.1.0.
head:
  - - meta
    - property: og:title
      content: "SigMap Retrieval Benchmark — 80% hit@5 across 18 repos"
  - - meta
    - property: og:description
      content: "SigMap puts the right file in context 80% of the time. Random selection: 13.6%. 5.9× lift across 90 real tasks, zero LLM API."
  - - meta
    - property: og:url
      content: "https://manojmallick.github.io/sigmap/guide/retrieval-benchmark"
  - - meta
    - name: keywords
      content: "context retrieval benchmark, sigmap hit@5, llm context quality, signature retrieval, code navigation"
---

# Retrieval benchmark

**Result:** SigMap finds the right file in the top 5 far more often than chance — **80% hit@5** vs 13.6% random across 90 tasks (5.9× lift). Last run: 2026-04-16 (v5.1.0).

When you ask an LLM a coding question, the answer quality depends entirely on whether the
**right files are in context**. This benchmark measures exactly that — without running any LLM.

**Method:** For each of 18 real repos (5 tasks each, 90 total), we ask: *does SigMap's output
include the correct file in the top-5 ranked results?* We compare against the expected random
probability of finding that file if files were selected at random.

No LLM API was used. All scores are retrieval-rank arithmetic.

Reproduce:
```bash
node scripts/run-retrieval-benchmark.mjs --save --skip-run
# Or with fresh gen-context runs (takes a few minutes):
node scripts/run-retrieval-benchmark.mjs --save
```

---

## Results

| Repo | Files | Sigs | Random hit@5 | SigMap hit@5 | Lift | Correct | Partial | Wrong |
|------|------:|-----:|:------------:|:------------:|:----:|:-------:|:-------:|:-----:|
| [express](https://github.com/expressjs/express) | 6 | 6 | 83% | 80% | 1× | 2/5 | 2/5 | 1/5 |
| [flask](https://github.com/pallets/flask) | 19 | 20 | 26% | **100%** | 3.8× | 5/5 | 0/5 | 0/5 |
| [gin](https://github.com/gin-gonic/gin) | 107 | 76 | 5% | **100%** | 21× | 3/5 | 2/5 | 0/5 |
| [spring-petclinic](https://github.com/spring-projects/spring-petclinic) | 13 | 29 | 39% | 60% | 1.6× | 3/5 | 0/5 | 2/5 |
| [rails](https://github.com/rails/rails) | 1,179 | 389 | 0.4% | 60% | **142×** | 2/5 | 1/5 | 2/5 |
| [axios](https://github.com/axios/axios) | 25 | 29 | 20% | 60% | 3× | 2/5 | 1/5 | 2/5 |
| [rust-analyzer](https://github.com/rust-lang/rust-analyzer) | 635 | 50 | 0.8% | **100%** | **127×** | 4/5 | 1/5 | 0/5 |
| [abseil-cpp](https://github.com/abseil/abseil-cpp) | 700 | 176 | 0.7% | **100%** | **140×** | 3/5 | 2/5 | 0/5 |
| [serilog](https://github.com/serilog/serilog) | 99 | 90 | 5% | 60% | 11.9× | 1/5 | 2/5 | 2/5 |
| [riverpod](https://github.com/rrousselGit/riverpod) | 446 | 43 | 1.1% | **100%** | 89× | 4/5 | 1/5 | 0/5 |
| [okhttp](https://github.com/square/okhttp) | 18 | 18 | 28% | **100%** | 3.6× | 5/5 | 0/5 | 0/5 |
| [laravel](https://github.com/laravel/framework) | 1,533 | 113 | 0.3% | **100%** | **307×** | 2/5 | 3/5 | 0/5 |
| [akka](https://github.com/akka/akka) | 211 | 64 | 2.4% | **100%** | 42× | 3/5 | 2/5 | 0/5 |
| [vapor](https://github.com/vapor/vapor) | 131 | 121 | 3.8% | 40% | 10.5× | 1/5 | 1/5 | 3/5 |
| [vue-core](https://github.com/vuejs/core) | 232 | 175 | 2.2% | **100%** | 46× | 1/5 | 4/5 | 0/5 |
| [svelte](https://github.com/sveltejs/svelte) | 370 | 205 | 1.4% | 60% | 44× | 0/5 | 3/5 | 2/5 |
| [fastify](https://github.com/fastify/fastify) | 31 | 28 | 16% | 60% | 3.7× | 3/5 | 0/5 | 2/5 |
| [fastapi](https://github.com/tiangolo/fastapi) | 48 | 32 | 10% | 80% | 7.7× | 3/5 | 1/5 | 1/5 |
| **Average** | | | **13.6%** | **80.0%** | **5.9×** | **48/90** | **24/90** | **18/90** |

**9 of 18 repos hit 100% (all 5 tasks found in top-5). Only 18/90 tasks produced a wrong result.**

---

## Source file coverage per project

The default `maxTokens: 6000` budget fits only a fraction of source files for large repos. This table shows how many files SigMap includes vs drops, measured with scoped `srcDirs` (source code only, no test/examples).

| Repo | Language | srcDirs | Total files | Included | Dropped | Coverage | Grade | Hit@5 |
|---|---|---|---:|---:|---:|---:|:---:|:---:|
| express | JavaScript | `lib/` | 6 | 6 | 0 | **100%** | A | 80% |
| okhttp | Kotlin | 3 dirs | 19 | 18 | 1 | **95%** | A | 100% |
| fastify | JavaScript | `lib/` | 31 | 28 | 3 | **90%** | A | 60% |
| serilog | C# | `src/Serilog/` | 115 | 100 | 15 | **87%** | B | 80% |
| flask | Python | `src/flask/` | 26 | 20 | 6 | **77%** | B | 100% |
| gin | Go | `.` | 130 | 76 | 54 | **58%** | C | 100% |
| vapor | Swift | `Sources/` | 250 | 134 | 116 | **54%** | C | 60% |
| fastapi | Python | `fastapi/` | 53 | 32 | 21 | **60%** | C | 80% |
| riverpod | Dart | `packages/` | 254 | 114 | 140 | **45%** | D | 100% |
| axios | TypeScript | `lib/` | 67 | 29 | 38 | **43%** | D | 60% |
| vue-core | Vue | `packages/` | 307 | 102 | 205 | **33%** | D | 100% |
| spring-petclinic | Java | `src/` | 84 | 25 | 59 | **30%** | D | 60% |
| svelte | Svelte | `packages/svelte/src`, `src/` | 410 | 63 | 347 | **15%** | D | 60% |
| akka | Scala | 4 dirs | 398 | 64 | 334 | **16%** | D | 100% |
| rails | Ruby | 7 dirs | 1,442 | 113 | 1,329 | **8%** | D | 80% |
| laravel | PHP | `src/Illuminate/` | 1,842 | 113 | 1,729 | **6%** | D | 100% |
| rust-analyzer | Rust | `crates/` | 2,007 | 50 | 1,957 | **2%** | D | 100% |
| abseil-cpp | C++ | `absl/` | 1,542 | 38 | 1,504 | **2%** | D | 100% |

**Grade key:** A ≥95% · B ≥80% · C ≥60% · D <60% (default 6K token budget)

### Key finding: low coverage ≠ low retrieval quality

The most striking result is that repos with the lowest file coverage still achieve the highest hit@5:

- **rust-analyzer** — 2% file coverage (50 of 2,007 files) → **100% hit@5**
- **abseil-cpp** — 2% file coverage (38 of 1,542 files) → **100% hit@5**
- **laravel** — 6% file coverage (113 of 1,842 files) → **100% hit@5**
- **rails** — 8% file coverage (113 of 1,442 files) → **80% hit@5**
- **akka** — 16% file coverage (64 of 398 files) → **100% hit@5**

This works because SigMap's token budget drop order prioritises **recently-changed and high-signal files first**. The files that answer real coding tasks tend to be the hot, actively-developed files — exactly the ones the budget keeps.

The pattern breaks when task files are **structurally peripheral** (config, rarely-touched utilities). That is what causes the 60% hit@5 on svelte (15% coverage, 347 files dropped) and spring-petclinic (30% coverage, some task files dropped).

### How to increase coverage for large repos

**1. Raise `maxTokens` in your config**

```json
{ "maxTokens": 12000 }
```

Most frontier models (Claude, GPT-4o, Gemini) handle 12K–24K context easily. Doubling the budget roughly doubles file coverage on large repos.

**2. Use `per-module` strategy for monorepos**

For rails, laravel, vue-core, akka — each is a monorepo with distinct sub-packages:

```json
{ "strategy": "per-module" }
```

This writes one `context-<module>.md` per `srcDir` instead of one combined file, so each module gets its full budget.

**3. Set explicit `srcDirs`**

Without a config, SigMap auto-detects source dirs. Adding `srcDirs` prevents test files and generated code from consuming the budget:

```json
{ "srcDirs": ["src", "lib"] }
```

**4. Use `hot-cold` strategy**

```json
{ "strategy": "hot-cold" }
```

Recently-changed files go into the hot context (always injected). Older files go into a cold context served on demand via MCP. This is the highest-coverage option for very large repos.

---

## Before vs after (quality tiers)

Without SigMap, the context provided to the LLM is either truncated at the token limit or
assembled from an unordered file list — equivalent to random selection for large repos.

```
Context quality — all 90 tasks across 18 repos

  Without SigMap (random selection):
  Correct  ██░░░░░░░░░░░░░░░░░░░░░░  14%  —  12/90 tasks
  Partial  ████░░░░░░░░░░░░░░░░░░░░  17%  —  15/90 tasks
  Wrong    ████████████████████████  70%  —  63/90 tasks

  With SigMap:
  Correct  ████████████████████░░░░  53%  —  48/90 tasks
  Partial  ████████████░░░░░░░░░░░░  27%  —  24/90 tasks
  Wrong    █████░░░░░░░░░░░░░░░░░░░  20%  —  18/90 tasks
```

**Wrong context drops from 70% → 20%. Correct context jumps from 14% → 53%.**

For large repos (rails 1,179 files; laravel 1,533; rust-analyzer 635; abseil-cpp 700):
- Without SigMap: random hit@5 is **0.3–0.8%** — effectively zero
- With SigMap: **80–100%** hit@5 across all four

---

## What the tiers mean

| Tier | Definition | What it means for the LLM |
|------|-----------|--------------------------|
| **Correct** | Target file is rank-1 result | LLM receives the most relevant context immediately |
| **Partial** | Target file in ranks 2–5 | Context present, but mixed with less-relevant files |
| **Wrong** | Target file not in top-5 | LLM operates without the key file in context |

::: info Methodology
- **Tasks:** 5 per repo × 18 repos = 90 tasks. Each task is a natural-language query with one or more `expected_files` (real files from the cloned repo).
- **Random baseline:** `min(1, 5/fileCount)` — the probability that a uniformly random 5-file selection contains the target file.
- **SigMap hit@5:** does the SigMap retrieval ranker return the expected file within its top-5 ranked results?
- **No LLM API used.** Scores are purely rank-position arithmetic against ground-truth file labels.
- Task files are at `benchmarks/tasks/<repo>.jsonl` — readable and verifiable.
:::

---

## Summary

| Metric | Without SigMap | With SigMap |
|--------|:--------------:|:-----------:|
| Average hit@5 | 13.6% | **80.0%** |
| Lift | — | **5.9×** |
| Wrong context (top-5 miss) | **70%** | 20% |
| Correct context (rank-1 hit) | 14% | **53%** |
| 100% hit@5 repos | 0/18 | **9/18** |

## Reproduce

```bash
# Uses existing generated output (fast, ~1s)
node scripts/run-retrieval-benchmark.mjs --skip-run

# Re-runs gen-context on all 18 repos first (~2 min)
node scripts/run-retrieval-benchmark.mjs

# Save results to benchmarks/reports/retrieval.json
node scripts/run-retrieval-benchmark.mjs --save --skip-run

# JSON output for scripting
node scripts/run-retrieval-benchmark.mjs --json --skip-run
```


---

<div style="text-align:center;margin-top:2.5rem;padding-bottom:.5rem;font-size:0.85em;color:var(--vp-c-text-3)">
  Made in Amsterdam, Netherlands <span title="Netherlands">🇳🇱</span>
</div>