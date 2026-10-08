---
title: Retrieval benchmark
description: Latest saved retrieval benchmark for SigMap v8.71.0. 80.4% hit@5 across 105 tasks on 18 repos; the honest grep comparison scores 89.6% vs 39.2% (2.29× lift) on its own 125-task corpus.
head:
  - - meta
    - property: og:title
      content: "SigMap retrieval benchmark — 80.4% hit@5"
  - - meta
    - property: og:description
      content: "Latest saved run: 80.4% hit@5 over 105 tasks on 18 repos; honest grep comparison 89.6% vs 39.2% (2.29x lift, 125 tasks, 19 repos)."
  - - meta
    - property: og:url
      content: "https://sigmap.io/guide/retrieval-benchmark"
---

# Retrieval benchmark

::: info Official v8.71.0 benchmark snapshot
**Benchmark ID:** sigmap-v8.71-main &nbsp;·&nbsp; **Date:** 2026-10-08 (with R language)

| Metric | Value |
|---|---:|
| Hit@5 (retrieval corpus, 105 tasks / 18 repos) | **80.4%** |
| Honest grep comparison (125 tasks / 19 repos) | **89.6%** vs 39.2% single-shot grep — **2.29× lift** |
| Graph-boosted hit@5 | **80.4%** |
| Honest lift (vs grep agent) | **2.29×** |
| Prompt reduction | **44.4%** (2.84 → 1.6) |
| Task success proxy | **61.9%** |
| Overall token reduction | **95.7%** |
| GPT-4o overflow (without → with) | **16/21 → 0/21** |
:::

Latest saved run: **2026-10-08 (v8.71.0)**

The task set, baselines, and the hit@5 definition are documented in [benchmark methodology](/guide/methodology).

**Result:** SigMap finds the right file in the top 5 far more often than chance — **80.4% hit@5** vs **13.6%** random baseline across 105 tasks on 18 real repos.

::: tip Why this number dipped in v8.51.6 and recovered
v8.51.6 made nine extractors resolve parameters correctly, which also made Scala extraction ~3× more complete (akka: 836 → 2,545 types). Under a fixed token budget that is a straight trade — more signatures per file means fewer files fit — and the budget spent itself strictly best-first across the whole repo. On akka, `akka-stream` took **all 128 surviving slots** while `akka-actor` (192 files) and `akka-cluster` (28 files) got **zero**: two of three configured source modules rendered invisible. akka fell 1.0 → 0.4 and the published figure dipped to 75.3%.

The extraction was right; the budget's drop order was wrong. A module can now be thinned but never erased ([#743](https://github.com/manojmallick/sigmap/issues/743)), and hit@5 is back to **79.7%** with the extractor improvements kept. Equal round-robin and strictly proportional share were both measured and rejected — they recovered akka at the cost of rails and gin.

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
| Average hit@5 (honest corpus, 125 tasks) | 39.2% | **89.6%** |
| Graph-boosted hit@5 | — | **80.4%** |
| Honest lift (vs single-shot grep, `benchmark:honest`) | — | **2.29x** |
| Random-selection hit@5 (data only, no longer quoted) | 13.6% | — |
| Correct (rank 1) | ~1% | **61.9%** |
| Partial (ranks 2–5) | ~13% | **18.1%** |
| Wrong (not in top 5) | ~86% | **20.0%** |

## Quality tiers from the saved run

| Tier | Tasks | Share |
|---|---:|---:|
| Correct | 65 / 105 | **61.9%** |
| Partial | 19 / 105 | **18.1%** |
| Wrong | 21 / 105 | **20.0%** |

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
| Easy split | 110 | **92.7%** | 38.2% |
| **Hard split** | 15 | **66.7%** | **53.3%** |
| Small repos | 13 | 100.0% | 61.5% |
| Medium repos | 52 | 84.6% | 46.2% |
| Large repos | 60 | 91.7% | 30.0% |

These rows are the saved honest report's own (`benchmarks/reports/honest-baseline.json`). The table had drifted from it since v8.62.0 and is regenerated at v8.68.0; the hard split, for one, reads 10 of 15 where it read 9 until v8.66.0.

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

## How the ranker stems words

Query and index words are reduced to stems before they are compared, so a question phrased with one form of a word can find code named with another. Until v8.65.3 the stemmer left six of ten common pairs apart — `classify` stayed `classify` while `classified` became `classifi` — so "how are test files classified" ranked `src/util/file-class.js` 15th. A word and its inflections now reach one stem:

| Rule | Example |
|---|---|
| `-ied` becomes `y` | `classified` → `classify` |
| the silent `e` comes off the base — except that a stem ending in a lone `s` keeps it, and `-ing`/`-ed`/`-er` put it back | `cache`, `caching` → `cach`; `parse`, `parsing` → `parse` |
| `-er` and derivational suffixes need a root of 5+ characters | `order` stays `order`; `normal` stays `normal` |
| an `-er` under `-ed`/`-ing` comes off too | `registered` → `register` → `regist` |
| doubled consonants collapse | `mapping` → `map` |
| `-ify`, `-ifier`, `-ification` fold to the root (4+ characters left) | `classified` → `class`; `verify` is unchanged |

Each rule was kept or dropped by measurement against a same-tree control — the unmodified tree, scored with the same harness over 299 tasks, never against the stored baseline. hit@5 counts, before → after:

| Corpus | Tasks | hit@5 | MRR@30 |
|---|---:|:---:|:---:|
| `hard` | 90 | 66 → 66 | 0.581 → 0.596 |
| `mined` | 23 | 14 → 14 | 0.411 → 0.411 |
| `easy` | 20 | 18 → 18 | 0.819 → 0.853 |
| `jvm` (`akka`) | 29 | 12 → 13 | 0.296 → 0.339 |
| `jvm` (`spring-petclinic`) | 32 | 6 → 8 | 0.133 → 0.145 |
| per-repo tasks (honest) | 105 | 93 → 93 | 0.721 → 0.703 |
| **all** | **299** | **209 → 212** | **0.5576 → 0.5636** |

No corpus loses a task at hit@5, and hit@3 rises 190 → 197. It is not a free win. On the per-repo tasks three rank-1 hits slip to rank 2 (none leaves the top 5), which is why the modeled task-success proxy reads 59.0% where it read 61.0%; four tasks fall from rank 5 to 6 while four enter the top 5. A stem can also be re-stemmed differently when it still ends in a removable suffix (`implemented` → `implement` → `impl`): merging those chains would make a verb like `implement` match every file that says "implementation", which cost a mined task and the `--no-regress` gate, so it is not done. Over 12,003 real identifiers the stems that change when re-stemmed fall from 322 to 152.

## The CI retrieval gate (v8.51.6)

The split above comes from `benchmark:honest`, which scores **across repos**. A
separate gate — `npm run validate:retrieval`, run on every CI job — scores four
corpora and is what actually blocks a merge. Do not confuse its `hard` corpus
with the `benchmark:honest` hard split above; they are different task sets that
happen to share an adjective.

| Corpus | Tasks | hit@5 | Gated on | What it measures |
|---|---:|:---:|---|---|
| `hard` | 90 | **74.4%** | 70% floor | Leak-free tasks over **SigMap's own source** |
| `mined` | 60 | **61.7%** | no-regress | Commit subjects + the files that commit touched, minus the generated outputs every commit also rewrites |
| `jvm` | 61 | **34.4%** | no-regress | Mined from `spring-petclinic` (32) + `akka` (29) |
| `easy` | 20 | 90.0% | reference only | Leaky by construction; published for contrast |

Every corpus is asserted leak-free: no query shares a stemmed token with its
expected file's basename. `hard` and `mined` are re-asserted on every run.

::: tip The `mined` corpus was re-mined at v8.66.0 ([#883](https://github.com/manojmallick/sigmap/issues/883))
Five of its 23 tasks (m001–m005) listed the bundled `gen-context.js` as their only expected file. Tooling rewrites that file on nearly every source commit, and the miner records the files a commit touched, so the bundle became "the answer" — unwinnable, although the ranker returned the real implementation first. The miner now removes generated outputs (the bundle, `.context/`, adapter outputs, `llms*.txt`) *before* it judges which file a commit was about, and its default window is the whole history: it had been 960 commits, which stopped covering the repository at 1,331.

Re-mined, the corpus is **60 tasks** (17 kept, 1 relabelled, 5 dropped, 42 new), so one task is 1.7pp instead of 4.3pp, and its 95% interval is 49.0–72.9%. The headline barely moves — **60.9% → 61.7%** — and the 60-task corpus scores the same on the v8.65.3 tree (37 of 60), so none of that is a ranking change. Measured against a clean v8.65.3 worktree, the release moves one first-hit rank inside the top 5 (`mined` m003, 3 → 4, a 0.012-point tie) and three outside it (`hard` h020 9 → 10, h026 10 → beyond 30 and h067 13 → 14, because [#895](https://github.com/manojmallick/sigmap/pull/895) changed this repository's own index); `easy` does not move. Only the `mined` entry of `retrieval-baseline.json` was re-recorded; its stored `hard` (75.6%) and `jvm` (21.3%) still do not reproduce (73.3% and 34.4% measured) and are left as they are.
:::

::: tip Measured at v8.67.0 — `hard` reads 74.4%, and that is not a ranking change
Against clean worktrees of v8.66.0 and of the release commit, with the index regenerated in each: `hard` 73.3% → **74.4%** (66 → 67 of 90, MRR 0.579 → 0.579), `mined` 61.7% → 61.7% (0.472 → 0.472), `easy` 90.0% → 90.0% (0.850 → 0.850) and `jvm` 34.4% → 34.4% (0.229 → 0.229). Four first-hit ranks move. `hard` h007 (17 → 18) and `mined` m009 (11 → 12) slip further outside the top 5: adding only the release's four new test files to a v8.66.0 tree reproduces both, because this repository indexes its own tests. `hard` h020 (9 → 2, the one new hit) and h032 (1 → 2) are a query about which package of a monorepo a question belongs to and one about emitting an editor rules file, and both vanish with `changes: false` in both trees: the generated `## recent changes` block is indexed as signatures of the repository's last file (`src/workspace/detector.js`), so a branch whose recent commits name `workspaceMarker` and `source-root-resolver` moves a query about monorepos. With the block off, two ranks move and no task changes hit/miss status, so the extra task is not claimed as an improvement. `retrieval-baseline.json` is not re-recorded; its stored `hard` (75.6%) and `jvm` (21.3%) still do not reproduce.
:::

### Why `hard` is reported but not enforced

`hard` scores SigMap against its own source, so its BM25 statistics shift
whenever the indexed file set changes — **including when the change cannot
affect ranking**. This was proven in CI rather than argued: a probe branch
containing one two-assertion test file and no source change scored 75.6% →
74.4% and failed the gate. Enforcing `hard` against the previous run therefore
fails honest work and, worse, trains you to ignore the gate.

It is now held to its **70% floor** instead (currently 67/90 tasks pass, 1 task
= 1.1pp, four tasks of headroom). The floor, the leak assertions, and
`--no-regress` on `mined` and `jvm` are the enforced checks.

<!-- benchmark: re-measured at v8.63.0 — all four corpora present (43 cached repos); figures above are measured, not carried -->

::: tip Re-measured at v8.63.0 — the first release in the series to move a hit@5
All four corpora were present in the v8.63.0 release run, so the figures above
are **measured, not carried forward**. `mined` 60.9%, `jvm` 29.5% and `easy`
90.0% are unchanged from v8.56.0 to the decimal. `hard` reads **74.4%**, after
holding 73.3% from v8.56.0 through v8.62.2 — one task, and not a ranking change;
the v8.63.0 note below accounts for it task by task.

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
| v8.62.2 | one new module (`src/analysis/test-coverage.js`) + a test file, three modules edited | 73.3% (control 73.3%) | **0.578** (control 0.584) |
| v8.63.0 | one new module (`src/config/models.js`) + a test file, seven modules edited | **74.4%** (control 73.3%) | **0.577** (control 0.578) |

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

v8.62.2 does not touch the ranker. It adds one module to `srcDirs`
(`src/analysis/test-coverage.js`) and a test file, and edits three modules. A
pristine v8.62.1 worktree reproduces that release's 0.584 and the release tree
reads 0.578 — a difference of exactly one task: h034 moved from rank 1 to rank 2,
with `src/retrieval/ranker.js` now ahead of the expected file. Every other `hard`
task kept its rank, and `mined` 60.9% / 0.411, `jvm` 29.5% / 0.195 and `easy`
90.0% / 0.825 did not move. The module did more damage before it merged: its
first header was a paragraph of history, a module's leading comment is indexed as
prose, and that put it in the top three for three unrelated `hard` tasks.
Rewritten as a purpose statement, it stopped.

v8.63.0 does not touch the ranker either, and it is the first release in this
series to move a `hard` hit@5. It adds one module to `srcDirs`
(`src/config/models.js`) and a test file, and edits seven modules. A per-task
diff against a pristine v8.62.2 worktree accounts for every figure:

| corpus | v8.62.2 control | v8.63.0 | tasks whose first-hit rank changed |
|---|---|---|---|
| `hard` | 73.3% / 0.578 | 74.4% / 0.577 | h027 6 → 5 · h025 2 → 3 · h087 3 → 4 · h020 9 → 8 · h042 18 → 19 |
| `mined` | 60.9% / 0.411 | 60.9% / 0.401 | m015 2 → 3 · m016 4 → 5 |
| `easy` | 90.0% / 0.825 | 90.0% / 0.817 | t011 2 → 3 |
| `jvm` | 29.5% / 0.195 (the v8.62.2 release run — the external repos are not part of a worktree) | 29.5% / 0.195 | none |

h027 crossing the cutoff is the whole of 73.3% → 74.4% (66 → 67 of 90). Its
query, its expected file and the three files ranked first are the same on both
trees; a file that had sat just ahead of it fell below as term weights shifted.
That is corpus composition, not a better ranker, and the extra hit should not be
read as an improvement. h025 and h087 each lost a rank inside the cutoff, which
is why MRR reads 0.577 against 0.578 despite the extra hit. h020 and h042 moved
outside the cutoff and count for nothing.

Three of the movements share a cause: the new module now ranks above the
expected file. h025 asks which model tier a task needs; m015 and m016 are commit
subjects about correcting model names. For the two mined tasks the corpus is
behind the code rather than the ranker being wrong — those commits edited model
names in `src/routing/hints.js`, and this release moved the names out of that
file into `src/config/models.js`, which is what the ranker now returns first for
m016. The labels were left as mined; re-mining a corpus is its own change. For
h025 the intrusion is real, one rank's worth: the expected file is the task
classifier, and the model table is not it. The module appears in the top three
for five `hard` tasks in all (h006, h011, h024, h025, h065) and changes the
expected file's rank in that one.

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
([#810](https://github.com/manojmallick/sigmap/issues/810)) did not exist until
v8.66.0 — it is [`xrepo`](#measured-on-repos-we-do-not-control-xrepo), below.
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

At 34.4%, `jvm` is still the least flattering number SigMap publishes. It is here
for the same reason the hard split is: it is the one that moves when the
vocabulary-mismatch problem gets solved — and in v8.55.0 it moved, from **21.3%
to 29.5% (+8.2pp)**, when the ranker stopped ignoring Go and JVM test-file
conventions, and again in v8.65.3, from **29.5% to 34.4% (+4.9pp, three more of 61
tasks)**, when the stemmer began to conflate inflections (`calculating` with
`calculate`, `naming` with `name`). Its own design is what makes that credible: `jvm` scores against
repositories the change was not made in, so unlike `hard` it could not have
absorbed the change as corpus drift.

## Measured on repos we do not control (xrepo)

Every other corpus on this page is one this project wrote or can influence: `hard` scores SigMap against its own source, `mined` is its own commit history, `jvm` covers two repositories. A ranking regression on a repository nobody here controls could therefore ship green — which is how [#805](https://github.com/manojmallick/sigmap/issues/805), [#807](https://github.com/manojmallick/sigmap/issues/807) and [#808](https://github.com/manojmallick/sigmap/issues/808) reached users. **xrepo** is the instrument for that gap: **83 questions across 16 third-party repositories** (Go, Kotlin, Swift, Rust, TypeScript, Python, JavaScript, PHP, C#, Dart, Elixir, Astro, Lua and GDScript), each repository pinned to an exact commit, each question labelled with the files that answer it and a written reason ([#892](https://github.com/manojmallick/sigmap/issues/892)).

### How the labels were made

- **Blind.** Every repo was labelled by reading its code. Nobody ran SigMap, the ranker or a `.context/` index first, and the baseline records whatever the ranker scored — including repos at 0%.
- **Leak-free.** The two checks the `hard` split uses: no query word shares a stem with an expected file's *name*, and no four-word run of a query appears in its answer's signatures.
- **Eligibility without the ranker's own classifiers.** What may be an answer is decided by conventional test, docs and example directories, language-specific test-file names and non-source extensions — never by `src/util/file-class.js`. Those predicates demote tests and docs at ranking time and misfire on real implementation (see the findings below); a corpus that excluded whatever the ranker already calls "not source" could never reveal that.
- **Two annotators.** A second, independent annotator saw only the questions and named the files it would pick. **79 of 83 file sets matched exactly (95%), all 83 shared at least one file, and none were disjoint.** The label is what both named; the one task where the first annotator had listed an extra file was cut back to the shared set, and three tasks where the second annotator named more are marked `"audit": "partial"`. Both annotators were language models, so the agreement bounds labelling noise, not blind spots they share.
- One question is the external audit's own, verbatim: *How does gin route requests through its middleware chain?* Its expected files omit `gin.go`, because the query names the project and would leak against that basename; omitting a file can only make a hit harder.

### Reading it

| Repo | Language | Layout | Indexed | Tasks | Hits | hit@5 | Unreachable |
|---|---|---|---|---:|---:|---:|---:|
| gin | go | flat-go | zero-config | 5 | 4 | 80.0% | — |
| OkHttp | kotlin | gradle-multimodule | zero-config | 5 | 3 | 60.0% | — |
| Alamofire | swift | swiftpm-sources | zero-config | 5 | 3 | 60.0% | — |
| Tokio | rust | cargo-workspace | zero-config | 5 | 3 | 60.0% | — |
| Excalidraw | typescript_react | yarn-workspaces | zero-config | 6 | 3 | 50.0% | — |
| Django | python | package-beside-tests | zero-config | 5 | 3 | 60.0% | — |
| Flask | python | src-layout | zero-config | 5 | 4 | 80.0% | — |
| Express | javascript | lib | zero-config | 4 | 3 | 75.0% | — |
| vue-core | typescript | pnpm-workspace | zero-config | 5 | 0 | 0.0% | — |
| Laravel | php | composer-src | zero-config | 5 | 1 | 20.0% | — |
| Serilog | csharp | dotnet-src | zero-config | 5 | 1 | 20.0% | — |
| Riverpod | dart | dart-workspace | zero-config | 5 | 1 | 20.0% | — |
| Phoenix | elixir | mix-lib | zero-config | 5 | 4 | 80.0% | — |
| Astro | astro | pnpm-workspace-subtree | zero-config | 7 | 1 | 14.3% | 1 |
| plenary.nvim | lua | lua-module | zero-config | 6 | 5 | 83.3% | — |
| godot-demo-projects | gdscript | godot-projects | zero-config | 5 | 3 | 60.0% | — |
| **Overall** | | | | **83** | **42** | **50.6%** | **1** |

**Read it as a band, not a point.** One task is 1.2pp, and the 95% interval over 83 tasks is **40.1–61.1%**. The level is uncertain by about that much. A *drop in any repo's hit count* is a different matter: the ranker is deterministic and every repo is pinned, so a count moves only when SigMap's code does. The gate therefore enforces both an overall floor (40%, eight tasks of headroom — it guards a collapse) and per-repo no-regress (the sharp check), and neither is a claim about the headline. It scores far below `hard` and `mined` for the reason it exists: those corpora are easier because they are closer to home.

**Zero-config.** Each repo is indexed the way a first-time user's `sigmap` run indexes it — auto-detected `srcDirs`, no config. When this corpus was first scored, three repos could not be: the resolver never reached Riverpod's `packages/*/lib`, Phoenix's `lib/` or the Godot demos, so every answer was unindexed (0/5 each) and their manifest entries pinned `srcDirs` to measure ranking regardless. Detection now reaches all three, the pins are gone, and the table is zero-config throughout ([#900](https://github.com/manojmallick/sigmap/issues/900)). A manifest entry may still pin `srcDirs` — with a `srcDirsWhy` recording the measured reason — if a future layout defeats detection; none does today.

**Phoenix reads 4/5, not the 5/5 its pin scored.** That is a change of measurement path, not a regression. Zero-config scored 0/5 there before; the pinned 5/5 was measured through a config file, and with one present the import graph is built over the pinned roots. With none, the graph is built over `src`, `app`, `lib`, `R` and `inst` whatever roots detection chose (see [found while fixing it](#what-the-first-run-found-and-what-became-of-it)).

**Unreachable** means no expected file of the task is in the index, so it cannot be found at all: detection skipped its directory, or the extractor emitted no signature for it. Those tasks stay in the corpus and are recorded in the baseline; the gate fails when a task that *was* reachable becomes unreachable, not on the gaps themselves.

**Python is indexed with the regex extractor.** The default Python extractor shells out to the host's `python3` once per file, so the same tree scores differently depending on which Python is installed (Flask moved 5/5 → 4/5) and a repo the size of Django takes minutes. A committed number cannot depend on that, so the gate runs generation with `python3` shadowed.

### What the first run found, and what became of it

Beyond the number, the first run surfaced defects the self-scored corpora cannot see, all measured and listed in [#893](https://github.com/manojmallick/sigmap/issues/893). Most were fixed in [#900](https://github.com/manojmallick/sigmap/issues/900):

- **Zero-config detection missed the source root** in Dart workspaces, Elixir mix projects and Godot repos — **fixed.** A pub workspace is a monorepo whose packages contribute their `lib/`; an Elixir project's source is `lib/`; a GDScript tree is rooted at the repo. All 15 tasks went from unreachable to reachable.
- **Real files never reached the index** — **fixed** for a TypeScript or JavaScript file that ends `export default <identifier>` or declares `export default function`, any C# `partial` type, and a Swift type whose inheritance clause carries an attribute (`: @unchecked Sendable`). **Still open:** everything under a directory named `build/` (Astro's whole static-build pipeline). About fourteen directory walkers each skip by name against one shared list, so changing the rule for one makes `validate`, `doctor` and coverage disagree with `generate`; it needs one shared skip primitive first.
- **`isDocsFile` demoted real source by 80%** — **fixed.** A well-known doc name (`history`, `security`, `changes`, `license` …) is documentation only when it is not source code, so excalidraw's `history.ts` now ranks 1st for the undo/redo question instead of 20th. The rule is a deny-list of programming-language extensions: across 66,691 tracked files in 50 repos it changes exactly eight source files and no document, where an allow-list of prose extensions would also have released genuine docs (`README.Rmd`, `LICENSE.python`).
- **Left alone on purpose:** `test_*` as the only test signal fires on 62 code files in those 50 repos, and every one is a test or testing-infrastructure file (Rails `test_case.rb`, abseil `test_helpers.cc`, fastapi `test_main.py`). Restricting it to Python, as #893 suggested, would un-demote 56 of them for no measured gain.

Two more were found while fixing these, and are **not fixed here**:

- **In zero-config the import graph is built over the wrong directories.** `buildFromCwd` falls back to `src`, `app`, `lib`, `R` and `inst` when there is no config file, whatever roots detection chose, and every product caller (`ask`, `plan`, `--impact`, the MCP tools) passes none. For Phoenix the graph holds 75 files against 224 when built over the six roots it indexes, and one task ranks 5th under one graph and misses under the other. It reaches ranking on every zero-config repo, so it needs its own measure-gated change.
- **A repo's generated `## recent changes` block is indexed as signatures of its last file.** In this repository that file is `src/workspace/detector.js`, so every commit rewrites its index entry, and the self-scored corpora drift with it: a branch that edits `src/discovery/` made the monorepo question (`h020`) rank `detector.js` 2nd instead of 9th, and the gain disappears with `changes: false`. Read a movement on `hard` or `mined` against a pristine `develop` worktree *and* with that section disabled. Not measured on xrepo.

### Why a task misses (`--why`)

A hit rate says how many tasks miss and nothing about the remedy, and the remedy depends on the reason. `--why` places every miss in exactly one class. The table is the 41 misses behind the 42/83 above:

| Why the task misses | Tasks | What it needs |
|---|---:|---|
| answer not indexed | 1 | detection or an extractor |
| demoted by a path penalty | 0 | a path classifier |
| no token in common with the question | 12 | a way across the vocabulary — not a re-weighting |
| ranked 6–10 | 9 | ranking |
| ranked 11–20 | 5 | ranking |
| ranked 21–50 | 5 | ranking |
| ranked beyond 50 | 9 | ranking |

The first two rows are decided by code that is not the ranker, and fixing one never costs another split: at the first run they held 4 tasks (plus 15 hidden behind the pinned `srcDirs`) and 1, and they hold 1 and 0 now. The other 40 misses are the ranker's. Nine sit within five places of the top 5. The twelve that share no token with the question score zero: the question and the answer's index entry have no word in common, so a lexical ranker has nothing to compare, and no re-weighting changes that. Whether a zero-dependency lever reaches them is a measurement for [#674](https://github.com/manojmallick/sigmap/issues/674) and [#703](https://github.com/manojmallick/sigmap/issues/703) — repo-mined expansions measured +0 tasks on the earlier corpora and have not been tried on this one.

The penalty row is a counterfactual: the path penalty is divided out of the file's final score and the list re-sorted with the ranker's own tie-break, so it answers "would this file have made the top 5 had its path not demoted it" and nothing more. It is report-only — `--why` records no baseline.

### Run it

```bash
npm run fetch:xrepo        # pinned shallow/sparse fetch of the 16 repos (about 380 MB, idempotent)
npm run benchmark:xrepo    # the report; add --per-task for each task's rank and what moved
npm run benchmark:xrepo -- --why   # why each miss misses: not indexed / penalty / ranking, by distance
npm run validate:xrepo     # the gate: floor + per-repo no-regress (CI adds --require-repos)
```

CI restores `benchmarks/repos` from a cache keyed on `benchmarks/xrepo-repos.json`, fetches only what is missing or off-pin, and runs the gate. The gate exits 0 when the repos are absent, so a fresh checkout is never broken by it.

::: warning Set the seven new clones aside before a release benchmark run
`fetch:xrepo` puts seven repositories that no other suite expects (tokio, excalidraw, django, phoenix, astro, plenary, godot-demo-projects) into `benchmarks/repos/`, and two suites enumerate that whole directory. With them present, `benchmark:test-discovery` reads **95.3% F1 over 33 repositories instead of 98.0% over 28**, and `validate:grounding-coverage` fails because each has no recorded floor. The published figures were measured with them moved aside; the cause is tracked in [#893](https://github.com/manojmallick/sigmap/issues/893).
:::

### Changing the corpus

- **Re-pin a repo:** change its `commit` in `benchmarks/xrepo-repos.json`, run `npm run fetch:xrepo`, re-check every task that names a file in that repo, then `node scripts/run-xrepo-gate.mjs --save`. A pin that moves with the corpus unchanged is a measurement change; say so in the PR.
- **Add a task:** read the code, never the ranker; write a question that shares no word stem with the answer's file name; record a `rationale` naming what the file does and which neighbours you ruled out; have a second annotator name files for the question alone; set `"audit"` to `agreed` or `partial`. `test/integration/xrepo-corpus.test.js` enforces the mechanical half.
- **Never hand-edit the baseline.** `--save` merges, so a run on a machine that lacks some repos does not erase their entries.

## Where the misses come from

A hit rate says how many tasks miss and nothing about the remedy. Every gate can now say why — each miss in exactly one class, with the words that explain it — and compare each opt-in ranking signal with the shipped ranker, task by task. This section is what that found. Each figure in it is held to a saved report by a test, so none can drift; `hard`, `mined` and `easy` score this repository against itself, move with every commit, and are not quoted.

### What the misses are made of

| Why the task misses | xrepo | jvm |
|---|---:|---:|
| answer not indexed | 1 | 0 |
| demoted by a path penalty | 0 | 1 |
| no token in common with the question | **12** | **24** |
| ranked 6–10 | 9 | 2 |
| ranked 11–20 | 5 | 0 |
| ranked 21–50 | 5 | 8 |
| ranked beyond 50 | 9 | 5 |
| **hits / tasks** | 42 / 83 | 21 / 61 |
| **hit rate over the tasks a word can reach** | 60.0% (42 / 70) | 56.8% (21 / 37) |

*A word can reach a task* when its answer is indexed and shares a word with the question. A task outside that set cannot be won by any method that matches words, so the rate over the set is the one a ranking change can move; the rate over every task also moves when the corpus does.

The largest class on both corpora is the one no re-weighting touches: the answer shares no token with the question. What differs is why. On `xrepo`, whose questions were written by reading the code, **11 of the 12** hold a *distinctive* word of the question in their own source — a word held by no more than 5% of the files, which the file's signatures do not carry (okhttp `revalidated`, express `tls`, serilog `retrying`) — and the twelfth holds none. A signature map keeps a file's shape and drops what its body says, and a question about how something works is asked in the words the body uses. On `jvm` the same split reads **6 / 12 / 6**: six hold a distinctive word, twelve only common ones (`import`, `message`, `not`), six nothing. Those are commit subjects the miner took for questions, and most of them describe an edit, not a topic.

### What the JVM split measures

It reads **34.4%** (21 of 61) — not the 22.9% [#674](https://github.com/manojmallick/sigmap/issues/674) quoted, nor the 21.3% its baseline held until this release, which is why its no-regress check would have passed a drop of 13 points. Of its 40 misses **24** share no token with the question, almost all of them spring-petclinic commit subjects: "fix typo in confirmation message", "Make jar not war", "Add proxyBeanMethods = false". The miner took the subject as the question and the files the commit touched as the answer, and a subject that describes an edit names nothing the file is about. **5** tasks name only a test file as the answer, and none of them hits. This is the shape of [#883](https://github.com/manojmallick/sigmap/issues/883) — a mining artefact scored as a ranking miss — in a second corpus.

Over the 37 tasks a word-matching ranker can reach, the hit rate is **56.8%**. What is left is 16 ranking misses (15 ranked below the top 5, one demoted by a path penalty), most of them in akka's large Scala files. The headline measures the corpus as much as the ranker: read the reachable rate when judging a ranking change, and keep the headline for comparing releases.

### The hard split against grep

[#674](https://github.com/manojmallick/sigmap/issues/674) called the honest benchmark's hard split "the one split where the baseline wins" (SigMap 46.7%, grep 53.3%). The saved report now reads SigMap **66.7%** (10 of 15) against grep **53.3%** (8 of 15). `--autopsy` asks which tasks each finds and the other does not — and in doing so found what the grep scan was counting.

**The published scan counts SigMap's own files.** `.context/sig-index.json` and `.github/copilot-instructions.md` hold every identifier in a repository, so any question matches them first. In the layout the published figure is measured in, they took **127 of the 625** top-5 places the scan returned. They are not answers, and they push answers out.

| grep scan | hit@5 | honest lift |
|---|---:|---:|
| as published | 39.2% (49 / 125) | 2.29× |
| SigMap's own files left out | 45.6% (57 / 125) | 1.96× |

**The scan is unchanged**: `benchmark:honest` still scans what it always scanned, and this section only records the effect. Whether to restate the lift is a call for a release, not a side effect of a diagnosis. Because the scan includes those files, the published figure moves with the repository: v8.70.1 reads 49 / 125 where v8.70.0 read 50 / 125, one more of the 625 top-5 places taken by SigMap's own generated files (127 against 126) — on a control run of the untouched v8.70.0 tree, in the same layout, the scan reproduces 50 / 125.

Against the scan without those files:

| | tasks | both find it | only SigMap | only grep | neither |
|---|---:|---:|---:|---:|---:|
| every task | 125 | 54 | 58 | 3 | 10 |
| hard split | 15 | 7 | 3 | 1 | 4 |

The three tasks grep finds and SigMap does not show no systematic vocabulary advantage. One shares no token with the question and holds only common words in its source (`express-h003`, which grep ranks 3rd). Two are SigMap near-misses, ranked 6th–10th, that grep ranks 5th and 2nd (`fastapi-t004`, `svelte-t002`). SigMap's 13 misses on this corpus are **4** that share no word with their index entry and **9** ranked misses, **5** of them ranked 6th–10th.

### The opt-in ranking signals

Each signal against the shipped ranker, task by task. A cell is the net number of tasks it wins over plain, with won / lost beside it: a signal that wins as many as it loses has moved answers around, not improved them. The honest corpus is scored without an import graph, as its own table is, so the two arms that are about the graph do not apply to it (—).

| signal | xrepo | hard | mined | easy | jvm | honest | all |
|---|---:|---:|---:|---:|---:|---:|---:|
| plain (as shipped) | 42 / 83 | 66 / 90 | 37 / 60 | 18 / 20 | 21 / 61 | 112 / 125 | 296 / 439 |
| centrality blend | -1 (0 / 1) | +0 (0 / 0) | +0 (0 / 0) | +0 (0 / 0) | +0 (0 / 0) | — | -1 (0 / 1) |
| surface enrichment | +0 (1 / 1) | +0 (0 / 0) | +0 (0 / 0) | +0 (0 / 0) | +0 (0 / 0) | +0 (0 / 0) | +0 (1 / 1) |
| mined expansions | +3 (4 / 1) | +0 (1 / 1) | +0 (0 / 0) | +0 (0 / 0) | +0 (0 / 0) | +1 (1 / 0) | +4 (6 / 2) |
| call-graph boost | +0 (0 / 0) | -2 (1 / 3) | -2 (0 / 2) | -1 (0 / 1) | +1 (1 / 0) | +1 (1 / 0) | -3 (3 / 6) |
| **body words** | +15 (16 / 1) | +1 (2 / 1) | +3 (4 / 1) | +0 (0 / 0) | +1 (1 / 0) | +4 (4 / 0) | +24 (27 / 3) |
| no import graph (as `ask`) | +0 (0 / 0) | +2 (2 / 0) | -2 (1 / 3) | +0 (0 / 0) | -2 (0 / 2) | — | -2 (3 / 5) |

- **Centrality blend: deprecated.** It moved the rank of 4 of 314 tasks and changed one hit, a loss (express `x037`).
- **Surface enrichment: deprecated.** It changed two hits, one each way (express `x038` won, `x040` lost), and adds pseudo-signatures to the index. Its best case is a web framework asked a route-worded question, and across the corpora that case is net zero.
- **Mined expansions: stays opt-in.** +3 on the third-party corpus (won 4, lost 1) and +1 on the honest corpus, nothing elsewhere. That is thin — five tasks changed on `xrepo`, which a sign test cannot tell from chance (p ≈ 0.19) — and the four it wins were already near-misses; it does not reach the no-token class.
- **Call-graph boost: not decided here**, because [#703](https://github.com/manojmallick/sigmap/issues/703) does not cover it. Net −3 (won 3, lost 6), negative on three of the six corpora: it is the next decision.
- **No import graph** is not a signal but a configuration. `sigmap ask` and `--query` call `rank()` without one, while the benchmark runner and the MCP tool pass one, so the neighbour boost the benchmarks include is not what `ask` runs. Removing it is net −2 over the five corpora it applies to (won 3, lost 5): the mismatch costs nothing a benchmark can see.

**The rule a signal is held to.** A signal becomes a default when it wins at least five more tasks than it loses on the third-party corpus — a margin where a sign test starts to separate a win from chance — and loses net on no other corpus. It is deprecated when its net is not positive and it changes at most two hits. Anything else stays opt-in and measured. The rule was written with these numbers in hand, so it is a standard the next measurement is held to, not a result.

### Body words

`retrieval.bodyWords` is the lever the first section points at. It indexes each file's *body words* — the rare words of its source that its signatures drop — into BM25's prose field, so a question asked in the words the code uses to do something can reach the file that does it. A word counts when no more than 5% of the indexed files hold it, the file's own index entry lacks it, and it is not a number, a word under three characters, or one that only frames a question (`how`, `does`, `whether`); a file keeps its 200 best, ordered by the lines that hold them, so the result never depends on the order files arrive in.

On `xrepo` it takes 42 of 83 to **57** (50.6% → 68.7%), winning **16** tasks and losing **1**, and lifts MRR from 0.354 to 0.483, so it is not a hit@5-only effect. It wins on corpora other people wrote about other code, too: `mined` +3, `jvm` +1, `hard` +1, and the honest corpus **112 → 116** of 125 (89.6% → **92.8%**) without losing a task. No corpus loses net. One caveat the corpus cannot remove: `xrepo`'s questions were written by reading the code, which favours a lever that indexes the code's own words, so its +15 is the upper end. The mined and JVM subjects, written by people describing a change, gain less, and none loses.

The two constants were chosen from a sweep, not from a peak. Net tasks over plain, won / lost beside it, summed over the six corpora:

| share of files | 50 words | 100 words | 200 words | 500 words | all words |
|---|---:|---:|---:|---:|---:|
| 2% | +15 (18 / 3) | +14 (21 / 7) | +14 (20 / 6) | +14 (20 / 6) | +14 (20 / 6) |
| 5% | +25 (28 / 3) | +28 (31 / 3) | **+24 (27 / 3)** | +24 (29 / 5) | +25 (30 / 5) |
| 10% | +28 (34 / 6) | +32 (38 / 6) | +30 (38 / 8) | +27 (36 / 9) | +26 (36 / 10) |

Across all 15 settings and six corpora (90 cells) **none** is net-negative, and the third-party corpus is +6 or better at every one. The region is flat from a 5% share and 50 words up (**+24 to +32** over 439 tasks) and lower at 2%, which is too tight on a large repository. The shipped 5% / 200 is inside it, not at its peak (10% / 100 is +32): it is the smaller of the two shares on the plateau, so the smaller index, and it loses 3 tasks, as few as any setting in it. `npm run benchmark:body-words-sweep` reproduces the grid.

It costs a little once per regeneration and a little per query: building takes about 0.7 ms per indexed file (1.9 s for laravel's 2,618 files), the cache is about 0.2 KB per file (509 KB for laravel, smaller than its signature index), and a query costs 6–23 ms more on the largest repositories (laravel 153 → 176 ms). That was measured once, on one laptop, and is not a recorded benchmark.

The words reach the ranker only — never `.context/sig-index.json`, the generated context file or anything `ask` renders for an LLM; a test generates with the flag on and off and compares the context file and the signature index. With the flag off nothing changes. The cache at `.context/body-words.json` is keyed by the mtime of `sig-index.json`, so regenerating rebuilds it and `ask` rewriting `query-context.md` does not. Files edited after the last regeneration, and files the MCP `notify_*` tools add between regenerations, carry no body words until the next one.

Turn it on in `gen-context.config.json`:

```json
{ "retrieval": { "bodyWords": true } }
```

It meets the rule above — +15 on the third-party corpus, no corpus net-negative — so it is eligible to become a default. Flipping it moves every published retrieval number, the baselines and the honest corpus among them, so it belongs with the release that re-records them. `src/eval/runner.js` and the honest benchmark rank without any signal, so they would need to read the flag to keep measuring what ships.

### How far is 90%?

[#674](https://github.com/manojmallick/sigmap/issues/674) asked for the honest corpus at 90%, or a statement of why not. It reads **89.6%** (112 of 125): one task short. Its 13 misses are the 4 that share no word with their index entry — which no method that matches words can win — and 9 ranking misses, 5 of them ranked 6th–10th. With `retrieval.bodyWords` on it reads **92.8%** (116 of 125). That clears 90%, but by a margin of a few tasks on a corpus where any signal that wins one task does so (mined expansions and the call-graph boost each reach 113 of 125, **90.4%**), so the third-party corpus is the figure to watch: 50.6% as shipped, 68.7% with the words.

### Run it

```bash
npm run benchmark:retrieval -- --why        # why every miss of hard / mined / easy / jvm misses, one class each
npm run benchmark:retrieval -- --per-task   # each task's class and rank, one line each (what a release diffs)
npm run benchmark:xrepo -- --why            # the same for the third-party corpus
npm run benchmark:signals                   # every opt-in signal against plain on all six corpora, and record it
npm run benchmark:body-words-sweep          # the grid the body-words constants were chosen from, and record it
node scripts/run-honest-benchmark.mjs --autopsy   # where SigMap and a whole-file grep scan disagree
```

::: warning Record the autopsy from the layout the published report uses
`npm run benchmark:honest` saves, so run the script directly for the autopsy, and save it only from a working tree whose 50 clones are real directories inside it (`cp -cR`): there the grep baseline reads 39.2% and the saved report is the published one. In a checkout with symlinked clones the same scan walks a different file set for the self-repo task set and reads a different number — 41.6% when that was measured at v8.67.0, 40.0% (2.24×) on the v8.70.1 tree — so the figure is only comparable to the published one in the layout described here.
:::

## Per-repo results

| Repo | Random hit@5 | SigMap hit@5 | Lift | Correct / Partial / Wrong |
|---|:---:|:---:|:---:|---:|
| express | 83.3% | 100% | 1.2x | 5 / 3 / 0 |
| flask | 26.3% | 62.5% | 2.4x | 5 / 0 / 3 |
| gin | 4.7% | 100% | 21.4x | 7 / 1 / 0 |
| spring-petclinic | 38.5% | 80% | 2.1x | 4 / 0 / 1 |
| rails | 0.4% | 100% | 235.8x | 3 / 2 / 0 |
| axios | 20.0% | 62.5% | 3.1x | 4 / 1 / 3 |
| rust-analyzer | 0.8% | 100% | 127.0x | 4 / 1 / 0 |
| abseil-cpp | 0.7% | 100% | 140.0x | 5 / 0 / 0 |
| serilog | 5.1% | 20% | 4.0x | 0 / 1 / 4 |
| riverpod | 1.1% | 80% | 71.4x | 4 / 0 / 1 |
| okhttp | 27.8% | 100% | 3.6x | 4 / 1 / 0 |
| laravel | 0.3% | 100% | 306.6x | 4 / 1 / 0 |
| akka | 2.4% | 100% | 42.2x | 2 / 3 / 0 |
| vapor | 3.8% | 20% | 5.2x | 0 / 1 / 4 |
| vue-core | 2.2% | 100% | 46.4x | 4 / 1 / 0 |
| svelte | 1.4% | 80% | 59.2x | 2 / 2 / 1 |
| fastify | 16.1% | 62.5% | 3.9x | 5 / 0 / 3 |
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
