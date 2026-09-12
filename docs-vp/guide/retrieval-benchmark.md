---
title: Retrieval benchmark
description: Latest saved retrieval benchmark for SigMap v8.32.1. 78.9% hit@5 vs 44.0% single-shot grep baseline (1.79× honest lift) across 105 tasks on 18 repos, with R language support.
head:
  - - meta
    - property: og:title
      content: "SigMap retrieval benchmark — 78.9% hit@5"
  - - meta
    - property: og:description
      content: "Latest saved run: 78.9% hit@5 vs 44.0% single-shot grep baseline, 1.79x honest lift, 105 tasks, 18 repos."
  - - meta
    - property: og:url
      content: "https://sigmap.io/guide/retrieval-benchmark"
---

# Retrieval benchmark

::: info Official v8.32.1 benchmark snapshot
**Benchmark ID:** sigmap-v8.32-main &nbsp;·&nbsp; **Date:** 2026-09-12 (with R language)

| Metric | Value |
|---|---:|
| Hit@5 | **82%** vs 44.0% single-shot grep baseline |
| Graph-boosted hit@5 | **88%** |
| Honest lift (vs grep agent) | **1.79×** |
| Prompt reduction | **44.4%** (2.84 → 1.58) |
| Task success proxy | **62.9%** |
| Overall token reduction | **96.8%** |
| GPT-4o overflow (without → with) | **16/21 → 0/21** |
:::

Latest saved run: **2026-09-12 (v8.32.1)**

**Result:** SigMap finds the right file in the top 5 far more often than chance — **78.9% hit@5** vs **13.6%** random baseline across 105 tasks on 18 real repos.

## Why this benchmark matters

When a coding assistant misses the key file, everything downstream gets worse:

- more retries
- more clarifying questions
- more wrong-context answers

This benchmark isolates that first question: *did the right file appear in context?*

## Headline numbers

| Metric | Without SigMap | With SigMap |
|---|:---:|:---:|
| Average hit@5 (grep-agent baseline) | 44.0% | **78.9%** |
| Graph-boosted hit@5 | — | **78.9%** |
| Honest lift (vs single-shot grep, `benchmark:honest`) | — | **1.79x** |
| Random-selection hit@5 (data only, no longer quoted) | 13.6% | — |
| Correct (rank 1) | ~1% | **62.9%** |
| Partial (ranks 2–5) | ~13% | **17.1%** |
| Wrong (not in top 5) | ~86% | **18.1%** |

## Quality tiers from the saved run

| Tier | Tasks | Share |
|---|---:|---:|
| Correct | 68 / 105 | **62.9%** |
| Partial | 18 / 105 | **17.1%** |
| Wrong | 19 / 105 | **18.1%** |

## Hard split and size buckets (new in v8.22)

Most benchmark queries share tokens with the filenames they expect (`absl Time
Duration TimeZone` → `absl/time/time.h`) — so a high hit@5 partly measures
filename matching. v8.22 adds a **no-leakage hard split**: a task may be
labeled `"split": "hard"` only if its BM25-tokenized query shares **no stemmed
token** with its expected files' basenames. `scripts/validate-task-corpus.mjs`
enforces this in CI (it also measured that **90 of 110 pre-existing easy tasks
leak**). `benchmark:honest` reports both splits, plus per-repo-size buckets
(<200 / ≤1000 / >1000 files scanned on disk):

| Slice | Tasks | SigMap hit@5 | Grep baseline |
|---|---:|:---:|:---:|
| Easy split | 110 | **76.4%** | 43.6% |
| **Hard split** | 15 | **33.3%** | **53.3%** |
| Small repos | 13 | 84.6% | 69.2% |
| Medium repos | 52 | 44.2% | 46.2% |
| Large repos | 60 | 91.7% | 38.3% |

The hard split is published deliberately: with filename leakage removed, the
single-shot grep baseline currently **beats** SigMap. That is the measured
vocabulary-mismatch ceiling — the number repo-mined query expansion (planned
for v9.0) exists to move. When it moves, this table is the proof.

## The CI retrieval gate (v8.32.1)

The split above comes from `benchmark:honest`, which scores **across repos**. A
separate gate — `npm run validate:retrieval`, run on every CI job — scores four
corpora and is what actually blocks a merge. Do not confuse its `hard` corpus
with the `benchmark:honest` hard split above; they are different task sets that
happen to share an adjective.

| Corpus | Tasks | hit@5 | Gated on | What it measures |
|---|---:|:---:|---|---|
| `hard` | 90 | **75.6%** | 70% floor | Leak-free tasks over **SigMap's own source** |
| `mined` | 23 | **60.9%** | no-regress | Commit subjects + the files that commit touched |
| `jvm` | 61 | **16.4%** | no-regress | Mined from `spring-petclinic` (32) + `akka` (29) |
| `easy` | 20 | 90.0% | reference only | Leaky by construction; published for contrast |

Every corpus is asserted leak-free: no query shares a stemmed token with its
expected file's basename. `hard` and `mined` are re-asserted on every run.

### Why `hard` is reported but not enforced

`hard` scores SigMap against its own source, so its BM25 statistics shift
whenever the indexed file set changes — **including when the change cannot
affect ranking**. This was proven in CI rather than argued: a probe branch
containing one two-assertion test file and no source change scored 75.6% →
74.4% and failed the gate. Enforcing `hard` against the previous run therefore
fails honest work and, worse, trains you to ignore the gate.

It is now held to its **70% floor** instead (currently 68/90 tasks pass, 1 task
= 1.1pp, five tasks of headroom). The floor, the leak assertions, and
`--no-regress` on `mined` and `jvm` are the enforced checks.

### Why the JVM corpus exists

`jvm` scores against *other* repositories, which puts it outside that feedback
loop entirely — a code change cannot move the corpus it is measured on. It
earned that design immediately: in #578 it caught a real one-task regression
(18.0% → 16.4%) that the old gate would have attributed to noise.

The cause was identified rather than absorbed. `akka:m018` expects
`Logging.scala`, which holds a class the 8-member ceiling truncates — so
disclosing the truncation adds one `… +N more methods` line, and BM25's
document-length normalisation drops it from rank 5 to rank 6. A fix excluding
markers from the scored term space did not move the number, so it was reverted
rather than left in as unexplained complexity.

At 16.4%, `jvm` is the least flattering number SigMap publishes. It is here for
the same reason the hard split is: it is the one that moves when the
vocabulary-mismatch problem gets solved.

## Per-repo results

| Repo | Random hit@5 | SigMap hit@5 | Lift | Correct / Partial / Wrong |
|---|:---:|:---:|:---:|---:|
| express | 83.3% | 100% | 1.2x | 3 / 2 / 0 |
| flask | 26.3% | 100% | 3.8x | 5 / 0 / 0 |
| gin | 4.7% | 100% | 21.4x | 4 / 1 / 0 |
| spring-petclinic | 38.5% | 100% | 2.6x | 5 / 0 / 0 |
| rails | 0.4% | 100% | 235.8x | 3 / 2 / 0 |
| axios | 20.0% | 80% | 4.0x | 1 / 3 / 1 |
| rust-analyzer | 0.8% | 100% | 127.0x | 4 / 1 / 0 |
| abseil-cpp | 0.7% | 100% | 140.0x | 5 / 0 / 0 |
| serilog | 5.1% | 20% | 4.0x | 0 / 1 / 4 |
| riverpod | 1.1% | 100% | 89.2x | 5 / 0 / 0 |
| okhttp | 27.8% | 100% | 3.6x | 5 / 0 / 0 |
| laravel | 0.3% | 100% | 306.6x | 4 / 1 / 0 |
| akka | 2.4% | 100% | 42.2x | 3 / 2 / 0 |
| vapor | 3.8% | 0% | 0.0x | 0 / 0 / 5 |
| vue-core | 2.2% | 100% | 46.5x | 4 / 1 / 0 |
| svelte | 1.4% | 100% | 74.0x | 3 / 2 / 0 |
| fastify | 16.1% | 80% | 5.0x | 4 / 0 / 1 |
| fastapi | 10.4% | 80% | 7.7x | 3 / 1 / 1 |

## What the benchmark does not measure

This benchmark does **not** score answer wording, correctness of prose, or stylistic quality. It measures a narrower prerequisite:

> whether the right source file is present in the ranked context.

That is why it pairs well with [judge](/guide/judge) and the [task benchmark](/guide/task-benchmark).

## Reproduce

```bash
node scripts/run-retrieval-benchmark.mjs --save
node scripts/run-retrieval-benchmark.mjs --json
```

For the full multi-benchmark dashboard:

```bash
node scripts/run-benchmark-matrix.mjs --save --skip-clone
```

### Third-party reproducible harness (v8.8.0+)

For a **self-contained** run that anyone can reproduce from a clean checkout — no dev tooling required, only `git` and Node 18+ — use the [`public-benchmarks/`](https://github.com/manojmallick/sigmap/tree/main/public-benchmarks) harness. It pins 18 repos to exact commits (`repos.csv`), ships the 90 queries (`queries.json`), clones + maps + scores in one command, and ranks with the **shipped** BM25 ranker:

```bash
cd public-benchmarks
./run.sh            # clone pinned repos (shallow) + score → hit@1/hit@5/MRR
./run.sh --json     # also write results.json
```

Because the repos are pinned and the map is byte-stable, the harness returns the **same numbers on any machine** — turning the headline hit@5 from a claim into a third-party-verifiable fact (v9.0 G1). Zero deps, no LLM, no API keys.
