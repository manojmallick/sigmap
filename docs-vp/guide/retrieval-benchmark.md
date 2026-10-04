---
title: Retrieval benchmark
description: Latest saved retrieval benchmark for SigMap v8.62.1. 78.6% hit@5 across 105 tasks on 18 repos; the honest grep comparison scores 88.0% vs 40.0% (2.20× lift) on its own 125-task corpus.
head:
  - - meta
    - property: og:title
      content: "SigMap retrieval benchmark — 78.6% hit@5"
  - - meta
    - property: og:description
      content: "Latest saved run: 78.6% hit@5 over 105 tasks on 18 repos; honest grep comparison 88.0% vs 40.0% (2.20x lift, 125 tasks, 19 repos)."
  - - meta
    - property: og:url
      content: "https://sigmap.io/guide/retrieval-benchmark"
---

# Retrieval benchmark

::: info Official v8.62.1 benchmark snapshot
**Benchmark ID:** sigmap-v8.62-main &nbsp;·&nbsp; **Date:** 2026-10-04 (with R language)

| Metric | Value |
|---|---:|
| Hit@5 (retrieval corpus, 105 tasks / 18 repos) | **78.6%** |
| Honest grep comparison (125 tasks / 19 repos) | **88.0%** vs 40.0% single-shot grep — **2.20× lift** |
| Graph-boosted hit@5 | **78.6%** |
| Honest lift (vs grep agent) | **2.20×** |
| Prompt reduction | **43.4%** (2.84 → 1.6) |
| Task success proxy | **61.0%** |
| Overall token reduction | **95.8%** |
| GPT-4o overflow (without → with) | **16/21 → 0/21** |
:::

Latest saved run: **2026-10-04 (v8.62.1)**

The task set, baselines, and the hit@5 definition are documented in [benchmark methodology](/guide/methodology).

**Result:** SigMap finds the right file in the top 5 far more often than chance — **78.6% hit@5** vs **13.6%** random baseline across 105 tasks on 18 real repos.

::: tip Why this number dipped in v8.51.6 and recovered
v8.51.6 made nine extractors resolve parameters correctly, which also made Scala extraction ~3× more complete (akka: 836 → 2,545 types). Under a fixed token budget that is a straight trade — more signatures per file means fewer files fit — and the budget spent itself strictly best-first across the whole repo. On akka, `akka-stream` took **all 128 surviving slots** while `akka-actor` (192 files) and `akka-cluster` (28 files) got **zero**: two of three configured source modules rendered invisible. akka fell 1.0 → 0.4 and the published figure dipped to 75.3%.

The extraction was right; the budget's drop order was wrong. A module can now be thinned but never erased ([#743](https://github.com/manojmallick/sigmap/issues/743)), and hit@5 is back to **78.6%** with the extractor improvements kept. Equal round-robin and strictly proportional share were both measured and rejected — they recovered akka at the cost of rails and gin.

Worth naming, because it will recur: this corpus scores the **budgeted context file**, so a completeness gain can lower the published number while improving the product. The [honest grep comparison](#the-honest-grep-comparison) was unaffected throughout at **86.4% vs 40.8%**.
:::

## Why this benchmark matters

When a coding assistant misses the key file, everything downstream gets worse:

- more retries
- more clarifying questions
- more wrong-context answers

This benchmark isolates that first question: *did the right file appear in context?*

## Headline numbers

| Metric | Without SigMap | With SigMap |
|---|:---:|:---:|
| Average hit@5 (honest corpus, 125 tasks) | 40.0% | **88.0%** |
| Graph-boosted hit@5 | — | **78.6%** |
| Honest lift (vs single-shot grep, `benchmark:honest`) | — | **2.20x** |
| Random-selection hit@5 (data only, no longer quoted) | 13.6% | — |
| Correct (rank 1) | ~1% | **61.0%** |
| Partial (ranks 2–5) | ~13% | **17.1%** |
| Wrong (not in top 5) | ~86% | **18.1%** |

## Quality tiers from the saved run

| Tier | Tasks | Share |
|---|---:|---:|
| Correct | 65 / 105 | **61.0%** |
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
| Easy split | 110 | **91.8%** | 39.1% |
| **Hard split** | 15 | **60.0%** | **53.3%** |
| Small repos | 13 | 100.0% | 61.5% |
| Medium repos | 52 | 80.8% | 46.2% |
| Large repos | 60 | 91.7% | 31.7% |

The hard split is published deliberately: it is the measured vocabulary-mismatch
ceiling, the number repo-mined query expansion (planned for v9.0) exists to move.

**It moved in v8.55.0 — by exactly one task, which is the honest way to state
it.** The hard split holds 15 tasks, so **one task is 6.7pp**. Measured against a
pristine `v8.54.2` worktree over the same cached corpus, SigMap went 53.3% → 60.0%
and grep stayed at 53.3%: a corpus this small cannot distinguish "SigMap now beats
grep on vocabulary-mismatch queries" from "one task changed rank". Read it as the
tie being broken by a single task, not as a win.

The whole-corpus movement is larger and better supported: **80.0% → 88.0%
(+8.0pp)** over 125 tasks against that same `v8.54.2` control, lifting the
published multiplier from 1.89× to 2.16×. Demoting test files, mocks, CI and docs
is exactly the change a *"which file implements X"* corpus should reward, since
those are the files that name a behaviour most often without implementing it. Note
also that the previously published 86.4% did not reproduce at v8.54.2 either — the
control measured 80.0% — which is the same provenance problem
[#707](https://github.com/manojmallick/sigmap/issues/707) exists to close.

## The CI retrieval gate (v8.51.6)

The split above comes from `benchmark:honest`, which scores **across repos**. A
separate gate — `npm run validate:retrieval`, run on every CI job — scores four
corpora and is what actually blocks a merge. Do not confuse its `hard` corpus
with the `benchmark:honest` hard split above; they are different task sets that
happen to share an adjective.

| Corpus | Tasks | hit@5 | Gated on | What it measures |
|---|---:|:---:|---|---|
| `hard` | 90 | **73.3%** | 70% floor | Leak-free tasks over **SigMap's own source** |
| `mined` | 23 | **60.9%** | no-regress | Commit subjects + the files that commit touched |
| `jvm` | 61 | **29.5%** | no-regress | Mined from `spring-petclinic` (32) + `akka` (29) |
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

It is now held to its **70% floor** instead (currently 66/90 tasks pass, 1 task
= 1.1pp, three tasks of headroom). The floor, the leak assertions, and
`--no-regress` on `mined` and `jvm` are the enforced checks.

<!-- benchmark: re-measured at v8.62.1 — all four corpora present (43 cached repos); figures above are measured, not carried -->

::: tip Re-measured at v8.62.1 — and self-repo drift finally showed up
All four corpora were present in the v8.62.1 release run, so the figures above
are **measured, not carried forward**. Every hit@5 is unchanged from v8.56.0 to
the decimal: `hard` 73.3%, `mined` 60.9%, `jvm` 29.5%, `easy` 90.0%.

`hard` scores against **SigMap's own source**, so anything that changes the
indexed file set can shift its BM25 statistics whether or not ranking changed.
Each release since v8.58.0 was checked over the same cached corpus rather
than assumed:

| release | what it added to SigMap's own source | `hard` hit@5 | `hard` MRR |
|---|---|---|---|
| v8.58.0 | `src/analysis/index-state.js` + tests | 73.3% (control 73.3%) | 0.589 (control 0.589) |
| v8.59.0 | a test file, two modules rewritten | 73.3% | 0.589 |
| v8.60.0 | a test file, five sources edited | 73.3% (control 73.3%) | **0.584** (control 0.589) |
| v8.61.0 | two modules + a test file | 73.3% (control 73.3%) | **0.582** (control 0.584) |
| v8.61.1 | a test file + 15 lines in the CLI | 73.3% | 0.582 — **unmoved** |
| v8.61.2 | 2 modules + 3 test files, and a ranker condition | 73.3% (control 73.3%) | **0.584** (control 0.586) |
| v8.61.3 | a helper under `scripts/` (unindexed) + 1 test file | 73.3% | 0.584 — **unmoved** |
| v8.62.0 | two extractor modules (`powershell.js`, `objc.js`) + their tests | 73.3% (control 73.3%) | **0.578** (control 0.584) |
| v8.62.1 | a test file + loop rewrites in four modules and the CLI core | 73.3% (control 73.3%) | **0.584** (control 0.578) |

v8.62.0 moved MRR and no hit@5, and two control trees say exactly which change
did it. The tree v8.61.3 was *measured* on still reproduces its recorded figures
— `hard` 73.3% / 0.584, `mined` 60.9% / 0.389, `easy` 90.0% / 0.792. The tree
v8.61.3 was *tagged* on already reads `hard` 0.578, `mined` 0.411, `easy` 0.825,
and this release reads the same three numbers to the digit. The difference
between those two trees is one merge: the PowerShell extractor landed after the
v8.61.3 benchmarks ran and before the tag, so v8.61.3 shipped a source tree its
own row above does not describe. Adding `src/extractors/objc.js` on top moved
nothing. `jvm`, the one gated corpus that scores against external repos, is
29.5% / 0.195 on both sides — so this is corpus composition again, not ranking:
one new 660-line module in `srcDirs` is enough to shift the IDF statistics of
three corpora that score against SigMap's own source. Two of the three moved
*up* (`mined` +0.022, `easy` +0.033) and `hard` moved down 0.006, which is the
signature of reshuffled term weights rather than a better or worse ranker.

v8.62.1 touches the ranker as well — `Math.max(...scores)` became a loop — so it
was measured the way v8.61.2 was, by toggling that one change on the release
tree. The original and the rewritten ranker score every gated corpus identically
over the same index: `hard` 73.3% / 0.584, `mined` 60.9% / 0.411, `jvm` 29.5% /
0.195, `easy` 90.0% / 0.825. `hard` MRR is 0.006 above the v8.62.0 figure, and
with the ranker ruled out that is corpus composition once more: the release adds
a 176-line test file and rewrites a few lines in four indexed modules. `mined`,
`easy` and `jvm` did not move from v8.62.0 at all.

v8.61.1 is the first release in the series to move **nothing**. Every gated
corpus came back byte-identical to the v8.61.0 measurement — `hard` 73.3% /
0.582, `mined` 60.9% / 0.411, `easy` 90.0% / 0.817, `jvm` 29.5% / 0.192 — and
`benchmarks/reports/honest-baseline.json` differs from the previous release only
in its `generated` timestamp. That is the expected shape for a change that adds
a test file and fifteen lines to one JSON branch: test files are dropped first by
the token budget, so the indexed file set the `hard` corpus scores against did
not change, and the IDF statistics did not either. A null result is recorded here
for the same reason the movements are — the series is only evidence if the quiet
releases appear in it too.

v8.61.2 is the first release in the series whose own change touches the ranker,
so it was measured by **toggling that one condition on the release tree** rather
than against a previous release. With the condition off, `mined` hit@5 reads
56.5%; with it on, 60.9% — the 4.4pp is given back, not won, because adding the
module is what exposed the bug ([#851](https://github.com/manojmallick/sigmap/issues/851)).
`hard` MRR moves −0.002 and `easy` does not move at all.

v8.61.3 is the second null result, and for a structurally cleaner reason than
v8.61.1's: its new helper lives in `scripts/`, which is not in `srcDirs`
(`["src", "packages"]`), so it is not indexed at all, and its one new test file
is dropped first by the token budget. The indexed file set the `hard` corpus
scores against did not change, and every gated corpus came back identical —
`hard` 73.3% / 0.584, `mined` 60.9% / 0.389, `jvm` 29.5% / 0.195, `easy` 90.0% /
0.792. This is also the first release whose reports carry the version that
measured them, so the claim "measured, not carried" is now checkable in
`benchmarks/latest.json` rather than taken on trust.

Two MRR figures recorded for v8.61.1 above — `mined` 0.411 and `easy` 0.817 — do
**not** reproduce on this release's tree, which measures 0.389 and 0.792 with the
fix applied and 0.380 and 0.792 without it. Both corpora score against SigMap's
own source, so four added files are enough to shift their IDF statistics, and
MRR is the more sensitive of the two metrics: every published hit@5 is unchanged.
The earlier numbers are left as recorded rather than quietly rewritten — that is
the same provenance gap [#707](https://github.com/manojmallick/sigmap/issues/707)
exists to close, and silently re-recording a baseline is what makes a drift
series worthless.

v8.61.0 moved the other way, and there the attribution is unambiguous. The
two corpora that score against SigMap's own source both drifted by a hair —
`hard` MRR 0.584 → 0.582, `mined` 0.412 → 0.411, both hit@5 flat — while the two
that score against **external** repos came back byte-identical: `easy` 90.0% /
0.817 and `jvm` 29.5% / 0.192 on both sides. A ranking change could not have
spared the external corpora, so the movement is corpus composition and nothing
else: the release added `src/retrieval/with-source.js`,
`src/retrieval/selection-quality.js` and one test file, which changed the indexed
file set and with it the IDF statistics.

v8.60.0 was the first of the three to move anything: **MRR −0.005, hit@5 flat.**
The indexed file set changed, so the IDF statistics did too, and that was enough
to reorder results *within* the top five without changing which queries land
there. It is not a ranking change — `retrieval.callGraphBoost` is off by default,
so that release's call-graph edits cannot reach the ranker — and MRR is not a
published figure. It is recorded here rather than passed over, because this is
exactly the drift the `hard` floor exists to tolerate and the kind of movement
that becomes a mystery if nobody writes down when it started.
:::

::: warning The committed `hard` baseline does not reproduce (v8.55.0)
`benchmarks/retrieval-baseline.json` records `hard = 75.6%`, and that figure does
not reproduce on `develop` today — a **pristine worktree with no changes applied**
measured 72.2% at v8.55.0, and the corpus reads 73.3% at v8.56.0. This is the drift the floor exists to tolerate, and it is
disclosed here rather than silently re-recorded: refreshing a baseline as a side
effect of an unrelated change is how a stale number becomes a published one. It
is re-recorded deliberately with the number-provenance work
([#707](https://github.com/manojmallick/sigmap/issues/707),
[#811](https://github.com/manojmallick/sigmap/issues/811)).

The same episode is why `jvm` matters more than `hard`: ranking weights changed in
v8.55.0 and `hard` could not falsify them, because it scores SigMap against the
repository the change was made in. A labelled third-party corpus
([#810](https://github.com/manojmallick/sigmap/issues/810)) does not exist yet.
:::

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

At 29.5%, `jvm` is still the least flattering number SigMap publishes. It is here
for the same reason the hard split is: it is the one that moves when the
vocabulary-mismatch problem gets solved — and in v8.55.0 it moved, from **21.3%
to 29.5% (+8.2pp)**, when the ranker stopped ignoring Go and JVM test-file
conventions. Its own design is what makes that credible: `jvm` scores against
repositories the change was not made in, so unlike `hard` it could not have
absorbed the change as corpus drift.

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
