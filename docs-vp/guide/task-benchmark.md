---
title: Task benchmark — prompts, quality & hallucination risk
description: SigMap reduces prompts-to-answer by 46%, puts correct context in rank-1 for 59% of tasks, and lowers hallucination risk from 92% dark symbols to a grounded index.
head:
  - - meta
    - property: og:title
      content: "SigMap Task Benchmark — 46% fewer prompts, 59% correct context, 92% hallucination risk without SigMap"
  - - meta
    - property: og:description
      content: "SigMap reduces prompts-to-answer from 2.84 to 1.54 (−46%). Correct context 59%, partial 29%, wrong 13%. 92% of codebase symbols are hidden from AI without SigMap."
  - - meta
    - property: og:url
      content: "https://manojmallick.github.io/sigmap/guide/task-benchmark"
  - - meta
    - name: keywords
      content: "sigmap task benchmark, llm prompts reduction, context quality, hallucination risk, answer quality"
---

# Task benchmark

This benchmark answers three practical questions:

1. **How many prompts does it take to get a correct answer?** (fewer with better context)
2. **What fraction of tasks land correct / partial / wrong context?** (answer quality tiers)
3. **How much of the codebase is hidden from the AI without SigMap?** (hallucination risk)

All numbers are derived from the [retrieval benchmark](/guide/retrieval-benchmark) — 80 real
coding tasks across 16 repos. No LLM API was used.

::: info Methodology
Prompt counts are **model-derived proxies** from retrieval tiers, not measured LLM
sessions. The mapping used: rank-1 hit → 1.0 prompts (right context immediately),
rank 2–5 → 2.0 prompts (partial context, user re-prompts), not top-5 → 3.0 prompts
(wrong context, user iterates). Hallucination risk = `dark / (grounded + dark)` across
all indexed symbols — symbols that are unreachable to the AI without SigMap's signature
index.
:::

---

## 1. Real task benchmark — prompts to answer

<div style="display:flex;gap:2rem;flex-wrap:wrap;margin:1.5rem 0">

<div style="flex:1;min-width:220px;background:var(--vp-c-bg-soft);border-radius:10px;padding:1.2rem 1.5rem">
  <div style="font-size:0.8em;text-transform:uppercase;letter-spacing:.08em;color:var(--vp-c-text-2);margin-bottom:.4rem">Without SigMap</div>
  <div style="font-size:2.4em;font-weight:700;color:#ef4444">2.84</div>
  <div style="font-size:0.85em;color:var(--vp-c-text-2)">avg prompts to answer</div>
  <div style="margin-top:.8rem;font-size:0.85em;color:#ef4444">13.7% hit@5 · ~1% rank-1</div>
</div>

<div style="flex:1;min-width:220px;background:var(--vp-c-bg-soft);border-radius:10px;padding:1.2rem 1.5rem;border:2px solid #7c6af7">
  <div style="font-size:0.8em;text-transform:uppercase;letter-spacing:.08em;color:var(--vp-c-text-2);margin-bottom:.4rem">With SigMap</div>
  <div style="font-size:2.4em;font-weight:700;color:#7c6af7">1.54</div>
  <div style="font-size:0.85em;color:var(--vp-c-text-2)">avg prompts to answer</div>
  <div style="margin-top:.8rem;font-size:0.85em;color:#7c6af7">87.5% hit@5 · 59% rank-1</div>
</div>

<div style="flex:1;min-width:220px;background:var(--vp-c-bg-soft);border-radius:10px;padding:1.2rem 1.5rem">
  <div style="font-size:0.8em;text-transform:uppercase;letter-spacing:.08em;color:var(--vp-c-text-2);margin-bottom:.4rem">Improvement</div>
  <div style="font-size:2.4em;font-weight:700;color:#22c55e">−46%</div>
  <div style="font-size:0.85em;color:var(--vp-c-text-2)">fewer prompts needed</div>
  <div style="margin-top:.8rem;font-size:0.85em;color:#22c55e">6.4× lift in context relevance</div>
</div>

</div>

**Hit@5 comparison**

<div style="margin:1rem 0">
<div style="display:flex;align-items:center;gap:10px;margin:6px 0">
  <span style="width:160px;font-size:0.85em">Without SigMap</span>
  <div style="position:relative;flex:1;background:var(--vp-c-bg-soft);border-radius:4px;height:22px">
    <div style="background:#ef4444;height:22px;border-radius:4px;width:13.7%"></div>
  </div>
  <span style="font-size:0.85em;color:#ef4444;width:48px">13.7%</span>
</div>
<div style="display:flex;align-items:center;gap:10px;margin:6px 0">
  <span style="width:160px;font-size:0.85em">With SigMap</span>
  <div style="position:relative;flex:1;background:var(--vp-c-bg-soft);border-radius:4px;height:22px">
    <div style="background:#7c6af7;height:22px;border-radius:4px;width:87.5%"></div>
  </div>
  <span style="font-size:0.85em;color:#7c6af7;width:48px">87.5%</span>
</div>
</div>

| | Without SigMap | With SigMap | Change |
|---|---|---|---|
| **Avg prompts to answer** | 2.84 | 1.54 | **−46%** |
| **Hit@5 (context relevance)** | 13.7% | 87.5% | **+6.4×** |
| **Context in rank 1** | ~1% | 59% | **+58 pts** |

::: tip What this means
On a typical coding task — *"explain the auth flow"*, *"where is the middleware stack configured?"*
— without SigMap the AI has a ~14% chance of seeing the right file. It will ask clarifying
questions or produce answers grounded in the wrong code. With SigMap the right file lands in
context 87.5% of the time, usually at rank 1, resolving the task in a single prompt.
:::

### Before / after by repo

```
Repo                   Random   SigMap     Lift
──────────────────── ──────── ──────── ────────
express                 83.3%      80%     1.0×
flask                   26.3%     100%     3.8×
gin                      4.7%     100%    21.3×
spring-petclinic        38.5%      80%     2.1×
rails                    0.4%      80%   200.0×
axios                   20.0%      60%     3.0×
rust-analyzer            0.8%     100%   125.0×
abseil-cpp               0.7%     100%   142.9×
serilog                  5.1%      80%    15.7×
riverpod                 1.1%     100%    90.9×
okhttp                  27.8%     100%     3.6×
laravel                  0.3%     100%   333.3×
akka                     2.4%     100%    41.7×
vapor                    3.8%      60%    15.8×
vue-core                 2.2%     100%    45.5×
svelte                   1.4%      60%    42.9×
```

Lift = SigMap hit@5 ÷ random baseline. Large repos (rails at 1179 files, laravel at 1533)
show the most dramatic gains because random selection is nearly hopeless.

---

## 2. Answer quality score

Quality tiers across 80 tasks on 16 repos:

<div style="margin:1.2rem 0">

<div style="margin:10px 0">
  <div style="display:flex;justify-content:space-between;font-size:0.85em;margin-bottom:4px">
    <span style="color:#22c55e;font-weight:600">✓ Correct — right file at rank 1</span>
    <span style="color:#22c55e">47 / 80 tasks</span>
  </div>
  <div style="background:var(--vp-c-bg-soft);border-radius:6px;height:28px;overflow:hidden">
    <div style="background:#22c55e;height:28px;width:58.8%;display:flex;align-items:center;padding-left:10px;font-size:0.82em;color:#fff;font-weight:600">58.8%</div>
  </div>
</div>

<div style="margin:10px 0">
  <div style="display:flex;justify-content:space-between;font-size:0.85em;margin-bottom:4px">
    <span style="color:#f59e0b;font-weight:600">~ Partial — right file in top 5</span>
    <span style="color:#f59e0b">23 / 80 tasks</span>
  </div>
  <div style="background:var(--vp-c-bg-soft);border-radius:6px;height:28px;overflow:hidden">
    <div style="background:#f59e0b;height:28px;width:28.7%;display:flex;align-items:center;padding-left:10px;font-size:0.82em;color:#fff;font-weight:600">28.7%</div>
  </div>
</div>

<div style="margin:10px 0">
  <div style="display:flex;justify-content:space-between;font-size:0.85em;margin-bottom:4px">
    <span style="color:#ef4444;font-weight:600">✗ Wrong — right file not found</span>
    <span style="color:#ef4444">10 / 80 tasks</span>
  </div>
  <div style="background:var(--vp-c-bg-soft);border-radius:6px;height:28px;overflow:hidden">
    <div style="background:#ef4444;height:28px;width:12.5%;display:flex;align-items:center;padding-left:10px;font-size:0.82em;color:#fff;font-weight:600">12.5%</div>
  </div>
</div>

</div>

| Tier | Definition | Count | % |
|---|---|---|---|
| **Correct** | Target file at rank 1 — full context, direct answer | 47 | 58.8% |
| **Partial** | Target file at rank 2–5 — context present but not leading | 23 | 28.7% |
| **Wrong** | Target file not in top 5 — AI answers from wrong context | 10 | 12.5% |

10 repos out of 16 scored **100% hit@5**. The 3 repos below 100% (axios, vapor, svelte) are
small-to-medium with sparse or highly fragmented signature coverage.

---

## 3. Hallucination risk proxy

Without SigMap, **92% of codebase symbols are hidden from the AI**. The AI can only see
what fits in the context window — for large repos that is a tiny fraction of the codebase.
Symbols outside context become **hallucination risk**: the AI may invent plausible-sounding
but incorrect function names, method signatures, or file paths.

<div style="display:flex;gap:2rem;flex-wrap:wrap;margin:1.5rem 0">

<div style="flex:1;min-width:200px;background:var(--vp-c-bg-soft);border-radius:10px;padding:1.2rem 1.5rem">
  <div style="font-size:0.8em;text-transform:uppercase;letter-spacing:.08em;color:var(--vp-c-text-2);margin-bottom:.4rem">Without SigMap</div>
  <div style="font-size:2.4em;font-weight:700;color:#ef4444">92%</div>
  <div style="font-size:0.85em;color:var(--vp-c-text-2)">of symbols hidden from AI</div>
  <div style="margin-top:.6rem;font-size:0.82em;color:#ef4444">55,067 dark symbols</div>
</div>

<div style="flex:1;min-width:200px;background:var(--vp-c-bg-soft);border-radius:10px;padding:1.2rem 1.5rem;border:2px solid #7c6af7">
  <div style="font-size:0.8em;text-transform:uppercase;letter-spacing:.08em;color:var(--vp-c-text-2);margin-bottom:.4rem">With SigMap</div>
  <div style="font-size:2.4em;font-weight:700;color:#7c6af7">0%</div>
  <div style="font-size:0.85em;color:var(--vp-c-text-2)">indexed symbols are dark</div>
  <div style="margin-top:.6rem;font-size:0.82em;color:#7c6af7">5,067 grounded signatures</div>
</div>

</div>

SigMap's signature index trades full file content for a compact, grounded representation
that fits the entire codebase:

| | Without SigMap | With SigMap |
|---|---|---|
| **Symbols visible to AI** | ~8% (context window limit) | 100% of indexed symbols |
| **Dark symbols (hidden)** | 55,067 | 0 |
| **Grounded symbols** | 5,067 | 5,067 |
| **Hallucination risk zone** | **92%** | **0%** |

### Per-repo hallucination risk

| Repo | Grounded | Dark | Risk |
|---|---|---|---|
| express | 11 | 66 | 86% |
| flask | 209 | 215 | 51% |
| gin | 450 | 414 | 48% |
| spring-petclinic | 13 | 372 | 97% |
| rails | 648 | 6,823 | 91% |
| axios | 53 | 105 | 66% |
| rust-analyzer | 395 | 17,217 | 98% |
| abseil-cpp | 350 | 11,240 | 97% |
| serilog | 301 | 268 | 47% |
| riverpod | 672 | 2,742 | 80% |
| okhttp | 115 | 41 | 26% |
| laravel | 578 | 7,815 | 93% |
| akka | 508 | 3,445 | 87% |
| vapor | 364 | 492 | 57% |
| vue-core | 205 | 1,816 | 90% |
| svelte | 195 | 1,996 | 91% |

Large, mature repos (rust-analyzer, abseil-cpp, laravel, spring-petclinic) have the highest
risk — over 90% of their symbols are invisible to the AI without SigMap.

---

## Reproduce

```bash
# Run from SigMap root
node scripts/run-task-benchmark.mjs --save

# JSON output
node scripts/run-task-benchmark.mjs --json
```

Requires `benchmarks/reports/retrieval.json` and `benchmarks/reports/quality.json` (both
included in the repo). Re-running recomputes from the same 80-task empirical retrieval data.

---

## Summary

| Metric | Without SigMap | With SigMap |
|---|---|---|
| Avg prompts to answer | 2.84 | **1.54** (−46%) |
| Context hit@5 | 13.7% | **87.5%** (+6.4×) |
| Correct context (rank 1) | ~1% | **59%** |
| Wrong context | ~87% | **13%** |
| Hallucination risk zone | **92%** | **0%** (fully indexed) |

No LLM API was used. All scores are computed from the [retrieval benchmark](/guide/retrieval-benchmark)
— 80 tasks, 16 real-world repos, 7 languages.
