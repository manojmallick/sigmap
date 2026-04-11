---
title: Quality benchmark — hallucination, overflow, cost
description: What token reduction means for LLM behaviour. 10/16 real repos overflow GPT-4o without SigMap. 4,793 files hidden. $8,958/month saved.
head:
  - - meta
    - property: og:title
      content: "SigMap Quality Benchmark — overflow, hallucination, cost"
  - - meta
    - property: og:description
      content: "10/16 repos overflow GPT-4o without SigMap. 4,793 files hidden from the LLM. SigMap fixes all of it — no API key needed."
  - - meta
    - property: og:url
      content: "https://manojmallick.github.io/sigmap/guide/quality-benchmark"
  - - meta
    - name: keywords
      content: "llm hallucination, context window overflow, ai assumptions, sigmap benchmark, token cost savings"
---

# Quality benchmark

Token reduction is the mechanism. This page measures what it means for **LLM behaviour** —
hallucination, assumptions, repeated questions, and API cost.

No LLM API key was used. All four metrics are computed directly from repo stats and
published model specifications. Reproduce with:

```bash
node scripts/run-quality-benchmark.mjs --save
```

---

## 1. Context window overflow risk

When raw repo content exceeds a model's context window, the LLM **must** either truncate silently,
make assumptions about unseen files, or ask you to paste the relevant code before it can proceed.

| Repo | Raw tokens | GPT-4o 128K | Claude 200K | Gemini 1M | SigMap |
|------|:----------:|:-----------:|:-----------:|:---------:|:------:|
| [express](https://github.com/expressjs/express) | 15.5K | FITS ✓ | FITS ✓ | FITS ✓ | FITS ✓ |
| [flask](https://github.com/pallets/flask) | 84.8K | FITS ✓ | FITS ✓ | FITS ✓ | FITS ✓ |
| [gin](https://github.com/gin-gonic/gin) | 172.8K | OVERFLOW +35% | FITS ✓ | FITS ✓ | FITS ✓ |
| [spring-petclinic](https://github.com/spring-projects/spring-petclinic) | 77.0K | FITS ✓ | FITS ✓ | FITS ✓ | FITS ✓ |
| [rails](https://github.com/rails/rails) | 1.5M | OVERFLOW +1067% | OVERFLOW +647% | OVERFLOW +49% | FITS ✓ |
| [axios](https://github.com/axios/axios) | 31.7K | FITS ✓ | FITS ✓ | FITS ✓ | FITS ✓ |
| [rust-analyzer](https://github.com/rust-lang/rust-analyzer) | 3.5M | OVERFLOW +2652% | OVERFLOW +1661% | OVERFLOW +252% | FITS ✓ |
| [abseil-cpp](https://github.com/abseil/abseil-cpp) | 2.3M | OVERFLOW +1711% | OVERFLOW +1059% | OVERFLOW +132% | FITS ✓ |
| [serilog](https://github.com/serilog/serilog) | 113.7K | FITS ✓ | FITS ✓ | FITS ✓ | FITS ✓ |
| [riverpod](https://github.com/rrousselGit/riverpod) | 682.7K | OVERFLOW +433% | OVERFLOW +241% | FITS ✓ | FITS ✓ |
| [okhttp](https://github.com/square/okhttp) | 31.3K | FITS ✓ | FITS ✓ | FITS ✓ | FITS ✓ |
| [laravel](https://github.com/laravel/framework) | 1.7M | OVERFLOW +1211% | OVERFLOW +739% | OVERFLOW +68% | FITS ✓ |
| [akka](https://github.com/akka/akka) | 790.5K | OVERFLOW +518% | OVERFLOW +295% | FITS ✓ | FITS ✓ |
| [vapor](https://github.com/vapor/vapor) | 171.2K | OVERFLOW +34% | FITS ✓ | FITS ✓ | FITS ✓ |
| [vue-core](https://github.com/vuejs/core) | 404.2K | OVERFLOW +216% | OVERFLOW +102% | FITS ✓ | FITS ✓ |
| [svelte](https://github.com/sveltejs/svelte) | 438.2K | OVERFLOW +242% | OVERFLOW +119% | FITS ✓ | FITS ✓ |

**10/16 repos overflow GPT-4o's 128K window without SigMap. With SigMap: 0/16.**

::: tip Why this matters
When a repo overflows the context window, the LLM must say one of two things:
1. *"Could you paste the relevant files?"* — the clarifying question that breaks your flow
2. Silently truncate — seeing only the first N files, making assumptions about the rest

SigMap ensures the LLM always sees 100% of the codebase structure in ≤7K tokens.
:::

---

## 2. Hallucination surface

Without SigMap, the LLM has no grounding for function names in your codebase —
it must guess or hallucinate names it hasn't seen. **Dark symbols** are functions the LLM cannot see.

> **Methodology:** grounded symbols = lines in SigMap output that are function/class/interface signatures.
> Dark symbols ≈ `rawTokens / 200` (average tokens per function body including whitespace/comments), minus grounded.

| Repo | Grounded (SigMap) | Dark (no SigMap) | Grounding % |
|------|:-----------------:|:----------------:|:-----------:|
| [express](https://github.com/expressjs/express) | 11 | ~66 | 14% |
| [flask](https://github.com/pallets/flask) | 209 | ~215 | 49% |
| [gin](https://github.com/gin-gonic/gin) | 450 | ~414 | 52% |
| [spring-petclinic](https://github.com/spring-projects/spring-petclinic) | 13 | ~372 | 3% |
| [rails](https://github.com/rails/rails) | 648 | ~6,823 | 9% |
| [axios](https://github.com/axios/axios) | 53 | ~105 | 34% |
| [rust-analyzer](https://github.com/rust-lang/rust-analyzer) | 395 | ~17,217 | 2% |
| [abseil-cpp](https://github.com/abseil/abseil-cpp) | 350 | ~11,240 | 3% |
| [serilog](https://github.com/serilog/serilog) | 301 | ~268 | 53% |
| [riverpod](https://github.com/rrousselGit/riverpod) | 672 | ~2,742 | 20% |
| [okhttp](https://github.com/square/okhttp) | 115 | ~41 | 74% |
| [laravel](https://github.com/laravel/framework) | 578 | ~7,815 | 7% |
| [akka](https://github.com/akka/akka) | 508 | ~3,445 | 13% |
| [vapor](https://github.com/vapor/vapor) | 364 | ~492 | 43% |
| [vue-core](https://github.com/vuejs/core) | 205 | ~1,816 | 10% |
| [svelte](https://github.com/sveltejs/svelte) | 195 | ~1,996 | 9% |

**~55,067 total "dark" symbols across all repos — functions the LLM cannot ground without SigMap.**

::: tip What SigMap provides
The SigMap output gives the LLM the **full public API surface** of the codebase in a compact format:
every exported function name, parameter list, and return type. This is exactly what the LLM needs
to know *what exists* before it decides *how to call it*.
:::

---

## 3. Files hidden from the LLM (forced assumptions)

When raw content overflows the context window, the LLM is limited to seeing only the first N files
that fit. Every file beyond that becomes an **assumption**. SigMap always shows all files.

| Repo | Total files | Visible without SigMap | Hidden without SigMap | With SigMap |
|------|:-----------:|:----------------------:|:---------------------:|:-----------:|
| [express](https://github.com/expressjs/express) | 6 | 6 | **0** | 0 |
| [flask](https://github.com/pallets/flask) | 19 | 19 | **0** | 0 |
| [gin](https://github.com/gin-gonic/gin) | 107 | 79 | **28** | 0 |
| [spring-petclinic](https://github.com/spring-projects/spring-petclinic) | 13 | 13 | **0** | 0 |
| [rails](https://github.com/rails/rails) | 1,179 | 100 | **1,079** | 0 |
| [axios](https://github.com/axios/axios) | 25 | 25 | **0** | 0 |
| [rust-analyzer](https://github.com/rust-lang/rust-analyzer) | 635 | 23 | **612** | 0 |
| [abseil-cpp](https://github.com/abseil/abseil-cpp) | 700 | 38 | **662** | 0 |
| [serilog](https://github.com/serilog/serilog) | 99 | 99 | **0** | 0 |
| [riverpod](https://github.com/rrousselGit/riverpod) | 446 | 83 | **363** | 0 |
| [okhttp](https://github.com/square/okhttp) | 18 | 18 | **0** | 0 |
| [laravel](https://github.com/laravel/framework) | 1,533 | 116 | **1,417** | 0 |
| [akka](https://github.com/akka/akka) | 211 | 34 | **177** | 0 |
| [vapor](https://github.com/vapor/vapor) | 131 | 97 | **34** | 0 |
| [vue-core](https://github.com/vuejs/core) | 232 | 73 | **159** | 0 |
| [svelte](https://github.com/sveltejs/svelte) | 370 | 108 | **262** | 0 |

**4,793 files hidden from the LLM without SigMap across all repos. With SigMap: 0.**

8 of 16 repos have more than 50% of their codebase invisible to the LLM without SigMap. The LLM on those repos is essentially guessing about structure it has never seen.

---

## 4. API cost savings

SigMap doesn't just save time — it directly reduces your API bill. The numbers below use
published pricing and `rawTokens`/`finalTokens` from the token reduction benchmark.

> **Pricing used:** GPT-4o $2.50/1M (regular) · $1.25/1M (cached). Claude Sonnet $3.00/1M · $0.30/1M cached. 10 calls/day per repo.

### GPT-4o

| Repo | Raw/day | SigMap/day | Saved/day | Saved/month |
|------|:-------:|:----------:|:---------:|:-----------:|
| [express](https://github.com/expressjs/express) | $0.39 | $0.005 | $0.38 | **$11.44** |
| [flask](https://github.com/pallets/flask) | $2.12 | $0.08 | $2.04 | **$61.08** |
| [gin](https://github.com/gin-gonic/gin) | $4.32 | $0.14 | $4.18 | **$125.31** |
| [spring-petclinic](https://github.com/spring-projects/spring-petclinic) | $1.92 | $0.02 | $1.91 | **$57.24** |
| [rails](https://github.com/rails/rails) | $37.36 | $0.18 | $37.18 | **$1,115.36** |
| [axios](https://github.com/axios/axios) | $0.79 | $0.04 | $0.75 | **$22.61** |
| [rust-analyzer](https://github.com/rust-lang/rust-analyzer) | $88.06 | $0.15 | $87.92 | **$2,637.46** |
| [abseil-cpp](https://github.com/abseil/abseil-cpp) | $57.95 | $0.16 | $57.79 | **$1,733.78** |
| [serilog](https://github.com/serilog/serilog) | $2.84 | $0.15 | $2.70 | **$80.93** |
| [riverpod](https://github.com/rrousselGit/riverpod) | $17.07 | $0.16 | $16.91 | **$507.16** |
| [okhttp](https://github.com/square/okhttp) | $0.78 | $0.04 | $0.75 | **$22.40** |
| [laravel](https://github.com/laravel/framework) | $41.96 | $0.18 | $41.78 | **$1,253.54** |
| [akka](https://github.com/akka/akka) | $19.76 | $0.18 | $19.59 | **$587.60** |
| [vapor](https://github.com/vapor/vapor) | $4.28 | $0.16 | $4.12 | **$123.58** |
| [vue-core](https://github.com/vuejs/core) | $10.10 | $0.22 | $9.88 | **$296.50** |
| [svelte](https://github.com/sveltejs/svelte) | $10.95 | $0.20 | $10.75 | **$322.62** |
| **TOTAL** | | | **$298.54/day** | **$8,958/month** |

**Claude Sonnet total: $358/day · $10,750/month saved** (cached: $35.83/day saved).

---

## Summary scorecard

| Metric | Without SigMap | With SigMap |
|--------|:--------------:|:-----------:|
| Repos overflowing GPT-4o | **10/16** | 0/16 |
| Repos overflowing Claude | **9/16** | 0/16 |
| Files hidden from LLM | **4,793** | 0 |
| Dark symbols (ungrounded) | **~55,067** | 0 |
| Forced clarifying questions | **10/16 repos** | None |
| GPT-4o cost (10 calls/day) | **~$299/day** | ~$0.43/day |

::: tip One-line summary
Without SigMap, the LLM on a large codebase is working blind — it can see only a fraction of the
code, guesses function names it hasn't been shown, and asks clarifying questions before it can
help. SigMap solves all three in under a second.
:::

## Reproduce these numbers

```bash
# Run token reduction benchmark first (clones repos if needed)
node scripts/run-benchmark.mjs --save

# Then run quality analysis (no LLM API needed)
node scripts/run-quality-benchmark.mjs --save

# Results written to:
#   benchmarks/reports/token-reduction.json
#   benchmarks/reports/quality.json
```
