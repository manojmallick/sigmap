---
title: Quality benchmark — overflow risk, signature coverage, API cost
description: What token reduction means in practice. 13/18 real repos exceed GPT-4o's context limit without SigMap. 4,977 files not in context. $9,435/month in API input cost.
head:
  - - meta
    - property: og:title
      content: "SigMap Quality Benchmark — overflow, coverage, cost"
  - - meta
    - property: og:description
      content: "13/18 repos exceed GPT-4o's 128K context limit without SigMap. 4,977 files not in context. $9,435/month in GPT-4o input-token cost."
  - - meta
    - property: og:url
      content: "https://manojmallick.github.io/sigmap/guide/quality-benchmark"
  - - meta
    - name: keywords
      content: "llm context window overflow, context limit, sigmap benchmark, ai token cost savings, signature coverage"
---

# Quality benchmark

Token reduction is the mechanism. This page measures what it means in practice —
context window fit, signature coverage, and API cost.

No LLM API key was used. All metrics are computed from:
- **raw token counts** measured by `node gen-context.js --report --json` on each repo
- **published model context-window sizes** from official documentation
- **published API pricing** from OpenAI and Anthropic pricing pages

Reproduce with:

```bash
node scripts/run-quality-benchmark.mjs --save
```

---

## 1. Context window fit

A model can only process what fits in its context window. When raw source exceeds the limit,
content must be truncated or selectively omitted — the LLM works with an incomplete view of
the codebase.

The table below compares each repo's measured raw token count against published context limits.
SigMap output always fits because the token budget is capped (default: 6,000 tokens).

| Repo | Raw tokens | GPT-4o 128K | Claude 200K | Gemini 1M | SigMap |
|------|:----------:|:-----------:|:-----------:|:---------:|:------:|
| [express](https://github.com/expressjs/express) | 70.6K | FITS ✓ | FITS ✓ | FITS ✓ | FITS ✓ |
| [flask](https://github.com/pallets/flask) | 147.9K | EXCEEDS +16% | FITS ✓ | FITS ✓ | FITS ✓ |
| [gin](https://github.com/gin-gonic/gin) | 216.4K | EXCEEDS +69% | EXCEEDS +8% | FITS ✓ | FITS ✓ |
| [spring-petclinic](https://github.com/spring-projects/spring-petclinic) | 97.9K | FITS ✓ | FITS ✓ | FITS ✓ | FITS ✓ |
| [rails](https://github.com/rails/rails) | 1.5M | EXCEEDS ×12 | EXCEEDS ×7.5 | EXCEEDS +49% | FITS ✓ |
| [axios](https://github.com/axios/axios) | 105.7K | FITS ✓ | FITS ✓ | FITS ✓ | FITS ✓ |
| [rust-analyzer](https://github.com/rust-lang/rust-analyzer) | 3.5M | EXCEEDS ×27 | EXCEEDS ×17 | EXCEEDS ×3.5 | FITS ✓ |
| [abseil-cpp](https://github.com/abseil/abseil-cpp) | 2.3M | EXCEEDS ×18 | EXCEEDS ×11 | EXCEEDS ×2.3 | FITS ✓ |
| [serilog](https://github.com/serilog/serilog) | 195.5K | EXCEEDS +53% | FITS ✓ | FITS ✓ | FITS ✓ |
| [riverpod](https://github.com/rrousselGit/riverpod) | 747.2K | EXCEEDS ×5.8 | EXCEEDS ×3.7 | FITS ✓ | FITS ✓ |
| [okhttp](https://github.com/square/okhttp) | 31.3K | FITS ✓ | FITS ✓ | FITS ✓ | FITS ✓ |
| [laravel](https://github.com/laravel/framework) | 1.7M | EXCEEDS ×13 | EXCEEDS ×8.5 | EXCEEDS +68% | FITS ✓ |
| [akka](https://github.com/akka/akka) | 790.5K | EXCEEDS ×6.2 | EXCEEDS ×4.0 | FITS ✓ | FITS ✓ |
| [vapor](https://github.com/vapor/vapor) | 171.4K | EXCEEDS +34% | FITS ✓ | FITS ✓ | FITS ✓ |
| [vue-core](https://github.com/vuejs/core) | 414.4K | EXCEEDS ×3.2 | EXCEEDS ×2.1 | FITS ✓ | FITS ✓ |
| [svelte](https://github.com/sveltejs/svelte) | 438.2K | EXCEEDS ×3.4 | EXCEEDS ×2.2 | FITS ✓ | FITS ✓ |
| [fastify](https://github.com/fastify/fastify) | 54.4K | FITS ✓ | FITS ✓ | FITS ✓ | FITS ✓ |
| [fastapi](https://github.com/tiangolo/fastapi) | 178.4K | EXCEEDS +39% | FITS ✓ | FITS ✓ | FITS ✓ |

**13/18 repos exceed GPT-4o's 128K limit. 9/18 exceed Claude's 200K limit. With SigMap: 0/18 exceed any limit.**

::: info What "EXCEEDS" means technically
When raw content is larger than the context window, it cannot be sent as-is. Tooling (IDEs,
agents, API clients) must decide what to truncate or omit before the request is made. The
LLM itself never sees the overflowing content. What gets omitted depends on the tool — there
is no universal behaviour.
:::

---

## 2. Signature coverage

SigMap extracts function and class signatures from source files and writes them into a
compact context file. This table measures two things that are directly countable:

- **Signatures in context (SigMap)** — lines in the SigMap output file that are function/class/interface declarations, counted exactly
- **Source files not in context (no SigMap)** — files that would be truncated when raw content exceeds the GPT-4o 128K limit, assuming files are included in full and sequentially

> **What "not in context" means:** if a repo's raw source exceeds the GPT-4o 128K window and
> you attempt to include all files, files beyond the limit are cut. SigMap avoids this entirely
> because its output is always within the token budget.

| Repo | Signatures in SigMap output | Source files not in context (raw, GPT-4o limit) |
|------|:---------------------------:|:-----------------------------------------------:|
| [express](https://github.com/expressjs/express) | 11 | 0 of 6 |
| [flask](https://github.com/pallets/flask) | 209 | 0 of 19 |
| [gin](https://github.com/gin-gonic/gin) | 450 | 28 of 107 |
| [spring-petclinic](https://github.com/spring-projects/spring-petclinic) | 13 | 0 of 13 |
| [rails](https://github.com/rails/rails) | 648 | **1,079 of 1,179** |
| [axios](https://github.com/axios/axios) | 53 | 0 of 25 |
| [rust-analyzer](https://github.com/rust-lang/rust-analyzer) | 395 | **612 of 635** |
| [abseil-cpp](https://github.com/abseil/abseil-cpp) | 350 | **662 of 700** |
| [serilog](https://github.com/serilog/serilog) | 301 | 0 of 99 |
| [riverpod](https://github.com/rrousselGit/riverpod) | 672 | **363 of 446** |
| [okhttp](https://github.com/square/okhttp) | 115 | 0 of 18 |
| [laravel](https://github.com/laravel/framework) | 578 | **1,417 of 1,533** |
| [akka](https://github.com/akka/akka) | 508 | **177 of 211** |
| [vapor](https://github.com/vapor/vapor) | 364 | 34 of 131 |
| [vue-core](https://github.com/vuejs/core) | 205 | **159 of 232** |
| [svelte](https://github.com/sveltejs/svelte) | 195 | **262 of 370** |

**Total: 5,865 signatures extractable into context with SigMap. 4,977 source files not in context without it (raw, GPT-4o limit).**

::: info Methodology notes
- Signature count is exact: output file lines matching function/class/interface declaration patterns
- "Files not in context" assumes worst-case: all files concatenated sequentially, truncated at 128K tokens. Real tools may use different file selection strategies.
- SigMap output size for these repos ranges from 201 to 8,800 tokens — all within the default 6,000-token budget (some repos use a higher configured budget).
:::

---

## 3. API input-token cost

This is the most directly computable metric: fewer tokens sent = lower API bill.
Numbers use measured `rawTokens` and `finalTokens` from the [token reduction benchmark](/guide/benchmark),
multiplied by published per-token prices. No modelling involved.

> **Pricing source:** [OpenAI pricing page](https://openai.com/api/pricing/) · [Anthropic pricing page](https://www.anthropic.com/pricing)
> GPT-4o: $2.50/1M input (regular) · $1.25/1M (cached). Claude Sonnet: $3.00/1M · $0.30/1M cached.
> **Baseline assumption:** 10 API calls/day per repo. Adjust to your actual usage.

### GPT-4o

| Repo | Raw cost/day | SigMap cost/day | Saved/day | Saved/month |
|------|:--------:|:-----------:|:---------:|:-----------:|
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
| **TOTAL** | | | **$317/day** | **$9,435/month** |

**Claude Sonnet: $421/day · $12,630/month saved at regular pricing. At cached pricing: $42.10/day saved.**

---

## Summary

| Metric | Source | Without SigMap | With SigMap |
|--------|--------|:--------------:|:-----------:|
| Repos exceeding GPT-4o 128K | Measured | **13/18** | 0/18 |
| Repos exceeding Claude 200K | Measured | **9/18** | 0/18 |
| Source files not in context (GPT-4o limit) | Measured | **4,977** | 0 |
| Signatures extractable into context | Measured (SigMap output) | 0 | **5,865** |
| GPT-4o input cost (10 calls/day, all repos) | Computed from measured tokens × pricing | **~$317/day** | **~$2.57/day** |

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


---

<div style="text-align:center;margin-top:2.5rem;padding-bottom:.5rem;font-size:0.85em;color:var(--vp-c-text-3)">
  Made in Amsterdam, Netherlands <span title="Netherlands">🇳🇱</span>
</div>