---
title: Retrieval benchmark
description: Latest saved retrieval benchmark for SigMap v8.85.1. 80.4% hit@5 across 105 tasks on 18 repos; the honest grep comparison scores 92.8% vs 40.0% (2.32× lift) on its own 125-task corpus.
head:
  - - meta
    - property: og:title
      content: "SigMap retrieval benchmark — 80.4% hit@5"
  - - meta
    - property: og:description
      content: "Latest saved run: 80.4% hit@5 over 105 tasks on 18 repos; honest grep comparison 92.8% vs 40.0% (2.32x lift, 125 tasks, 19 repos)."
  - - meta
    - property: og:url
      content: "https://sigmap.io/guide/retrieval-benchmark"
---

# Retrieval benchmark

::: info Official v8.85.1 benchmark snapshot
**Benchmark ID:** sigmap-v8.85-main &nbsp;·&nbsp; **Date:** 2026-10-27 (with R language)

| Metric | Value |
|---|---:|
| Hit@5 (retrieval corpus, 105 tasks / 18 repos) | **80.4%** |
| Honest grep comparison (125 tasks / 19 repos) | **92.8%** vs 40.0% single-shot grep — **2.32× lift** |
| Graph-boosted hit@5 | **80.4%** |
| Honest lift (vs grep agent) | **2.32×** |
| Prompt reduction | **44.4%** (2.84 → 1.58) |
| Task success proxy | **61.9%** |
| Overall token reduction | **95.2%** |
| GPT-4o overflow (without → with) | **14/21 → 0/21** |
:::

Latest saved run: **2026-10-28 (v8.85.1)**

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
| Average hit@5 (honest corpus, 125 tasks) | 40.0% | **92.8%** |
| Graph-boosted hit@5 | — | **80.4%** |
| Honest lift (vs single-shot grep, `benchmark:honest`) | — | **2.32x** |
| Random-selection hit@5 (data only, no longer quoted) | 13.6% | — |
| Correct (rank 1) | ~1% | **61.9%** |
| Partial (ranks 2–5) | ~13% | **18.1%** |
| Wrong (not in top 5) | ~86% | **20.0%** |

The 80.4% hit@5 on the retrieval corpus (105 tasks / 18 repos) is scored with bare `bm25rank` — BM25 over the context file's signatures, with no path penalties, import-graph boost, recency or body words — so it does not move when `retrieval.bodyWords` ships. The honest corpus above, the [third-party corpus](#measured-on-repos-we-do-not-control-xrepo) and the [CI gate](#the-ci-retrieval-gate-v8-51-6) corpora are scored through the full `rank()`, which is why they did.

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
| Easy split | 110 | **95.5%** | 38.2% |
| **Hard split** | 15 | **73.3%** | **53.3%** |
| Small repos | 13 | 100.0% | 61.5% |
| Medium repos | 52 | 88.5% | 46.2% |
| Large repos | 60 | 95.0% | 30.0% |

These rows are the saved honest report's own (`benchmarks/reports/honest-baseline.json`). The table had drifted from it since v8.62.0 and was regenerated at v8.68.0, and again at v8.75.0, when body words became the default: the hard split reads 11 of 15 where it read 10 until v8.74.0, and the easy split 95.5% where it read 92.7%. The grep column was regenerated again at v8.75.1 (easy 39.1%, large 31.7%) and at v8.76.0 (easy 38.2%, large 30.0%; the autopsy section below says why).

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
| `hard` | 90 | **71.1%** | 70% floor | Leak-free tasks over **SigMap's own source** |
| `mined` | 60 | **66.7%** | no-regress | Commit subjects + the files that commit touched, minus the generated outputs every commit also rewrites |
| `jvm` | 61 | **41.0%** | no-regress | Mined from `spring-petclinic` (32) + `akka` (29) |
| `easy` | 20 | 90.0% | reference only | Leaky by construction; published for contrast |

Every corpus is asserted leak-free: no query shares a stemmed token with its
expected file's basename. `hard` and `mined` are re-asserted on every run.

These are the figures of the ranker as it ships. v8.75.0 made [body words](#body-words)
the default, which is the whole of the movement since v8.74.0: `mined` 61.7% → 68.3%
(37 → 41 of 60), `jvm` 34.4% → 41.0% (21 → 25 of 61), `easy` 90.0% → 95.0% (18 → 19 of 20)
and `hard` unchanged at 72.2% (65 of 90, three won and three lost). `retrieval-baseline.json`
was re-recorded with them, and the `hard` it held (75.6%) had not reproduced since
v8.55.0 — it read what the gate measured then. v8.76.0 read 71.1% (64 of 90), and v8.77.0, v8.77.1, v8.77.2, v8.78.0, v8.79.0, v8.80.0 and v8.80.1 read the same; the note
below says why, and the baseline file was not re-recorded for it. v8.81.0 reads **70.0% (63 of 90)**, one task fewer: `h062` (expected `src/retrieval/sig-index-store.js`) went from rank 4 to rank 7 because the release added `src/util/dir-listing.js` and rewrote the header of `src/cache/entry.js` for the `more` list, and both now hold words of its question; 21 of the 90 tasks change rank by a few places and only `h062` crosses the top 5 (`h022` and `h064` stay misses). An untouched merged `develop` in the same layout reads the same 63, and the ranker and what it reads of each file are unchanged, so this is the self-scored corpus drifting with the repository by design. The floor, 70.0%, now has no task of headroom. v8.78.0 did re-record one block of it: `mined` fell from 68.3% to **66.7%** (41 → 40 of 60) when
the release added two source modules and two test files to the repository the corpus is mined from, and one task (`m053`, "update model names to current
(April 2026)" → `src/routing/hints.js`) went from rank 5 to rank 6. The ranker did not change: the v8.77.2 code run over the files of the change that moved it
(PR #967) gives the same per-task ranks as that change's own code, so the movement is the indexed material, as with `hard` below.

::: tip The `mined` corpus was re-mined at v8.66.0 ([#883](https://github.com/manojmallick/sigmap/issues/883))
Five of its 23 tasks (m001–m005) listed the bundled `gen-context.js` as their only expected file. Tooling rewrites that file on nearly every source commit, and the miner records the files a commit touched, so the bundle became "the answer" — unwinnable, although the ranker returned the real implementation first. The miner now removes generated outputs (the bundle, `.context/`, adapter outputs, `llms*.txt`) *before* it judges which file a commit was about, and its default window is the whole history: it had been 960 commits, which stopped covering the repository at 1,331.

Re-mined, the corpus is **60 tasks** (17 kept, 1 relabelled, 5 dropped, 42 new), so one task is 1.7pp instead of 4.3pp, and its 95% interval is 49.0–72.9%. The headline barely moves — **60.9% → 61.7%** — and the 60-task corpus scores the same on the v8.65.3 tree (37 of 60), so none of that is a ranking change. Measured against a clean v8.65.3 worktree, the release moves one first-hit rank inside the top 5 (`mined` m003, 3 → 4, a 0.012-point tie) and three outside it (`hard` h020 9 → 10, h026 10 → beyond 30 and h067 13 → 14, because [#895](https://github.com/manojmallick/sigmap/pull/895) changed this repository's own index); `easy` does not move. Only the `mined` entry of `retrieval-baseline.json` was re-recorded; its stored `hard` (75.6%) and `jvm` (21.3%) still do not reproduce (73.3% and 34.4% measured) and are left as they are.
:::

::: tip Measured at v8.67.0 — `hard` reads 74.4%, and that is not a ranking change
Against clean worktrees of v8.66.0 and of the release commit, with the index regenerated in each: `hard` 73.3% → **74.4%** (66 → 67 of 90, MRR 0.579 → 0.579), `mined` 61.7% → 61.7% (0.472 → 0.472), `easy` 90.0% → 90.0% (0.850 → 0.850) and `jvm` 34.4% → 34.4% (0.229 → 0.229). Four first-hit ranks move. `hard` h007 (17 → 18) and `mined` m009 (11 → 12) slip further outside the top 5: adding only the release's four new test files to a v8.66.0 tree reproduces both, because this repository indexes its own tests. `hard` h020 (9 → 2, the one new hit) and h032 (1 → 2) are a query about which package of a monorepo a question belongs to and one about emitting an editor rules file, and both vanish with `changes: false` in both trees: the generated `## recent changes` block is indexed as signatures of the repository's last file (`src/workspace/detector.js`), so a branch whose recent commits name `workspaceMarker` and `source-root-resolver` moves a query about monorepos. With the block off, two ranks move and no task changes hit/miss status, so the extra task is not claimed as an improvement. `retrieval-baseline.json` is not re-recorded; its stored `hard` (75.6%) and `jvm` (21.3%) still do not reproduce.
:::

::: tip Measured at v8.76.0 — `hard` reads 71.1%, and that is not a ranking change
Against clean worktrees of the v8.75.1 tag and of develop with the index regenerated in each: `hard` 72.2% → **71.1%** (65 → 64 of 90), `mined` 68.3% → 68.3%, `easy` 95.0% → 95.0% and `jvm` 41.0% → 41.0%. One first hit leaves the top 5 — `hard` h006, "how much money does one query cost for a given model" (answer `src/tracking/pricing.js`), 5 → 7, behind the new `src/session/report.js` and `render.js`, which are about cost per model. With the generated recent-changes block on, 25 of the 170 self-scored ranks move (median 1, maximum 6; the 61 JVM tasks, which score third-party clones, do not move) and 22 with it off, and `hard` reads 64 of 90 either way. Scoring this release's ranker over the v8.75.1 tree's index ranks all 170 tasks of `hard`, `mined` and `easy` exactly as v8.75.1's own does, and the other way round, while the two trees' own indexes differ on 22; copying only the release's `src/` changes onto the v8.75.1 tree reproduces h006 and copying only its three new or changed test files does not. `retrieval-baseline.json` still holds 72.2%: `hard` is reported, not enforced, and the headroom to the floor is now one task. v8.77.0 reads the same 71.1% (64 of 90): it changes no `src/` or `packages/` behaviour, the one file it adds to the index is a test file, and the headroom is still one task. v8.77.1 reads it again: it changes no `src/` or `packages/` behaviour, adds no file to the index and leaves the signatures of the one indexed file it touches (the extended test file) byte-identical, line anchors included, and the headroom is still one task. v8.77.2 reads it once more: it is documentation only, so no `src/` or `packages/` behaviour changes and no file is added to the index.
:::

::: tip Measured at v8.80.0 — `easy` reads 90.0%, and that is not a ranking change
Against clean worktrees of v8.79.0 and of each of the three changes merged since (#1001, #1002, #1003), scored by the gate itself: `hard` 71.1% → 71.1% (64 of 90, MRR 0.538 → 0.531) and `mined` 66.7% → 66.7% (40 of 60, MRR 0.463 → 0.459) flip no task at any of the three, and `easy` 95.0% → **90.0%** (19 → 18 of 20, MRR 0.804 → 0.758) loses exactly one, at #1003: `t006`, "token budget enforcement dropping files" (answer `gen-context.js`), from rank 4 to rank 9. `t011`, "python dataclass BaseModel field extraction" (answer `python.js`), stays a hit but goes from rank 1 to 3 as that file gains signatures. With the generated recent-changes block off in both trees `easy` reads 90.0% before and after #1003 (`t006` is a miss at rank 39 and 38), so the 95.0% leaned on that block, which names different files after these commits; the ranker did not change. On the release commit's own clean worktree the readings are `hard` 71.1% (MRR 0.531), `mined` 66.7% (0.463) and `easy` 90.0% (0.758): the release's own text moves `mined`'s MRR back in the third decimal and no task. The 61 JVM tasks score third-party clones and read 41.0% (25 of 61) as before. `retrieval-baseline.json` is not re-recorded.
:::

### Why `hard` is reported but not enforced

`hard` scores SigMap against its own source, so its BM25 statistics shift
whenever the indexed file set changes — **including when the change cannot
affect ranking**. This was proven in CI rather than argued: a probe branch
containing one two-assertion test file and no source change scored 75.6% →
74.4% and failed the gate. Enforcing `hard` against the previous run therefore
fails honest work and, worse, trains you to ignore the gate.

It is now held to its **70% floor** instead (currently 64/90 tasks pass, 1 task
= 1.1pp, one task of headroom). The floor, the leak assertions, and
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
`benchmarks/retrieval-baseline.json` recorded `hard = 75.6%` (re-recorded at v8.75.0 as 72.2%), and that figure did
not reproduce on `develop` at the time — a **pristine worktree with no changes applied**
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

At 41.0% (34.4% until body words became the default in v8.75.0, +6.6pp, four more of 61
tasks), `jvm` is still the least flattering number SigMap publishes. It is here
for the same reason the hard split is: it is the one that moves when the
vocabulary-mismatch problem gets solved — and in v8.55.0 it moved, from **21.3%
to 29.5% (+8.2pp)**, when the ranker stopped ignoring Go and JVM test-file
conventions, and again in v8.65.3, from **29.5% to 34.4% (+4.9pp, three more of 61
tasks)**, when the stemmer began to conflate inflections (`calculating` with
`calculate`, `naming` with `name`). Its own design is what makes that credible: `jvm` scores against
repositories the change was not made in, so unlike `hard` it could not have
absorbed the change as corpus drift.

## Measured on repos we do not control (xrepo)

Every other corpus on this page is one this project wrote or can influence: `hard` scores SigMap against its own source, `mined` is its own commit history, `jvm` covers two repositories. A ranking regression on a repository nobody here controls could therefore ship green — which is how [#805](https://github.com/manojmallick/sigmap/issues/805), [#807](https://github.com/manojmallick/sigmap/issues/807) and [#808](https://github.com/manojmallick/sigmap/issues/808) reached users. **xrepo** is the instrument for that gap: **208 questions across 35 third-party repositories** (Go, Kotlin, Swift, Rust, TypeScript, Python, JavaScript, PHP, C#, Dart, Elixir, Astro, Lua, GDScript, Ruby, C, C++, Vue, Svelte, Scala, R and Java), each repository pinned to an exact commit, each question labelled with the files that answer it and a written reason ([#892](https://github.com/manojmallick/sigmap/issues/892)). It started as 83 questions over 16 repositories and grew to 208 over 35 ([#984](https://github.com/manojmallick/sigmap/issues/984), whose target was 200 over 30): the first 20 added questions are the Ruby (Rails, Sidekiq) and C/C++ (libuv, spdlog) repositories, none of which the corpus covered before. The next 25 are a second repository each for PHP (Composer), C# (Newtonsoft.Json), Swift (Vapor) and Kotlin (Exposed), and VitePress, the first whose answers include Vue single-file components. The last 80 are ten more repositories, eight questions each: Svelte, Fastify, FastAPI, dplyr, Akka, rust-analyzer, Abseil, Gson, GORM and Zod. They bring Java, Scala, R and Svelte, and a second repository for JavaScript, Python, Rust, C++, Go and TypeScript.

### How the labels were made

- **Blind.** Every repo was labelled by reading its code. Nobody ran SigMap, the ranker or a `.context/` index first, and the baseline records whatever the ranker scored — including repos at 0%. The method is written down as a protocol, `benchmarks/XREPO_LABELLING.md`; the nineteen repositories added by [#984](https://github.com/manojmallick/sigmap/issues/984) were labelled from clean `git archive` exports of their pinned commits, which hold no index and no generated instruction file.
- **Leak-free.** The two checks the `hard` split uses: no query word shares a stem with an expected file's *name*, and no four-word run of a query appears in its answer's signatures.
- **Eligibility without the ranker's own classifiers.** What may be an answer is decided by conventional test, docs and example directories, language-specific test-file names and non-source extensions — never by `src/util/file-class.js`. Those predicates demote tests and docs at ranking time and misfire on real implementation (see the findings below); a corpus that excluded whatever the ranker already calls "not source" could never reveal that.
- **Two annotators.** A second, independent annotator saw only the questions and named the files it would pick. **79 of 83 file sets matched exactly (95%), all 83 shared at least one file, and none were disjoint.** The label is what both named; the one task where the first annotator had listed an extra file was cut back to the shared set, and three tasks where the second annotator named more are marked `"audit": "partial"`. Both annotators were language models, so the agreement bounds labelling noise, not blind spots they share. The 45 questions added since were annotated the same way, each annotator in a fresh context: **43 of 45 file sets matched exactly, all 45 shared at least one file, and none were disjoint.** The two that differed are in Rails, where the first annotator had listed one extra file and the label was cut back to the shared set; the latest 25 matched exactly on every question, which is what questions with one clear answer produce and is no evidence that nothing in them is ambiguous. The 80 questions added after them were annotated the same way, ten repositories at a time, each annotator in a fresh context: **79 of 80 file sets matched exactly, all 80 shared at least one file, and none were disjoint.** The one that differed (FastAPI x152) is `partial`: the second annotator named one more file than the label. Altogether 122 of the 125 annotated questions matched exactly. Two lapses in the protocol are recorded rather than hidden: three first annotators (Akka, GORM, Abseil) opened the source of the checking script, which holds the shape, eligibility and name-leak rules and no retrieval logic, and two (Abseil, rust-analyzer) listed the scratch directory, which showed the names of other repositories' task files. None opened another annotator's answers or any index, and no second annotator was shown a first annotator's file. Both annotators' raw answers for all 125 are in `benchmarks/xrepo-annotations.json`, and a test re-derives every `audit` value from them.
- One question is the external audit's own, verbatim: *How does gin route requests through its middleware chain?* Its expected files omit `gin.go`, because the query names the project and would leak against that basename; omitting a file can only make a hit harder.

### Reading it

| Repo | Language | Layout | Indexed | Tasks | Hits | hit@5 | Unreachable |
|---|---|---|---|---:|---:|---:|---:|
| gin | go | flat-go | zero-config | 5 | 4 | 80.0% | — |
| OkHttp | kotlin | gradle-multimodule | zero-config | 5 | 4 | 80.0% | — |
| Alamofire | swift | swiftpm-sources | zero-config | 5 | 5 | 100.0% | — |
| Tokio | rust | cargo-workspace | zero-config | 5 | 4 | 80.0% | — |
| Excalidraw | typescript_react | yarn-workspaces | zero-config | 6 | 3 | 50.0% | — |
| Django | python | package-beside-tests | zero-config | 5 | 4 | 80.0% | — |
| Flask | python | src-layout | zero-config | 5 | 5 | 100.0% | — |
| Express | javascript | lib | zero-config | 4 | 3 | 75.0% | — |
| vue-core | typescript | pnpm-workspace | zero-config | 5 | 2 | 40.0% | — |
| Laravel | php | composer-src | zero-config | 5 | 2 | 40.0% | — |
| Serilog | csharp | dotnet-src | zero-config | 5 | 2 | 40.0% | — |
| Riverpod | dart | dart-workspace | zero-config | 5 | 3 | 60.0% | — |
| Phoenix | elixir | mix-lib | zero-config | 5 | 5 | 100.0% | — |
| Astro | astro | pnpm-workspace-subtree | zero-config | 7 | 4 | 57.1% | 1 |
| plenary.nvim | lua | lua-module | zero-config | 6 | 6 | 100.0% | — |
| godot-demo-projects | gdscript | godot-projects | zero-config | 5 | 3 | 60.0% | — |
| Rails | ruby | multi-gem-monorepo | zero-config | 5 | 3 | 60.0% | — |
| Sidekiq | ruby | single-gem-lib | zero-config | 5 | 3 | 60.0% | — |
| libuv | cpp | c-platform-split | zero-config | 5 | 3 | 60.0% | 1 |
| spdlog | cpp | header-mostly | zero-config | 5 | 2 | 40.0% | — |
| Composer | php | php-application-src | zero-config | 5 | 1 | 20.0% | — |
| Newtonsoft.Json | csharp | dotnet-single-library | zero-config | 5 | 2 | 40.0% | 1 |
| Vapor | swift | swiftpm-framework-target | zero-config | 5 | 5 | 100.0% | — |
| Exposed | kotlin | gradle-orm-modules | zero-config | 5 | 2 | 40.0% | — |
| VitePress | vue_sfc | vue-theme-plus-node-server | zero-config | 5 | 2 | 40.0% | 1 |
| Svelte | svelte | compiler-monorepo-packages-svelte | zero-config | 8 | 6 | 75.0% | — |
| Fastify | javascript | plugin-framework-lib-and-docs | zero-config | 8 | 3 | 37.5% | — |
| FastAPI | python | package-at-repo-root | zero-config | 8 | 5 | 62.5% | — |
| dplyr | r | r-package-R-dir | zero-config | 8 | 2 | 25.0% | — |
| Akka | scala | sbt-multimodule-scala-and-java | zero-config | 8 | 3 | 37.5% | 1 |
| rust-analyzer | rust | crates-dir-workspace | zero-config | 8 | 1 | 12.5% | 3 |
| Abseil | cpp | absl-subdirs-headers-and-sources | zero-config | 8 | 1 | 12.5% | — |
| Gson | java | maven-library-plus-extras | zero-config | 8 | 6 | 75.0% | — |
| GORM | go | root-package-plus-subpackages | zero-config | 8 | 5 | 62.5% | — |
| Zod | typescript | pnpm-monorepo-packages-zod | zero-config | 8 | 4 | 50.0% | — |
| **Overall** | | | | **208** | **118** | **56.7%** | **8** |

**Read it as a band, not a point.** One task is 0.5pp, and the 95% interval over 208 tasks is **49.9–63.3%**. The level is uncertain by about that much. A *drop in any repo's hit count* is a different matter: the ranker is deterministic and every repo is pinned, so a count moves only when SigMap's code does. The gate therefore enforces both an overall floor (40%, thirty-four tasks of headroom — it guards a collapse) and per-repo no-regress (the sharp check), and neither is a claim about the headline. Until v8.74.0 it scored far below `hard` and `mined` (42 of 83, 50.6%, 40.1–61.1%) for the reason it exists: those corpora are easier because they are closer to home. With body words on by default the original 83 questions sit level with them — 59 of 83, 71.1% — because the largest class of its misses was the one body words reach ([below](#why-a-task-misses-why)). The 45 questions added since read 22 of 45 (10 of the first 20, 12 of the next 25) and took the whole to 81 of 128, 63.3%; the 80 added last read 35 of 80 (43.8%) and take it to **116 of 208, 55.8%**. All 25 earlier repositories still score exactly what they did (the 16 original ones 59 of 83, the rest 22 of 45), so the lower figure is the new repositories: ten larger, harder-to-index repositories whose questions paraphrase the code (Abseil, rust-analyzer and dplyr hit 1, 1 and 2 of 8), five of whose answers are absent from the zero-config index (see *Unreachable* below). The interval is 13.4 points wide, against 16.4 over 128 tasks and 19.1 over the original 83. The self-scored corpora read higher because they are closer to home, and the figure is not a claim that SigMap finds the right file for one question in two on any repository: its questions were written by reading the code, which favours a lever that indexes the code's own words.

**Zero-config.** Each repo is indexed the way a first-time user's `sigmap` run indexes it — auto-detected `srcDirs`, no config. When this corpus was first scored, three repos could not be: the resolver never reached Riverpod's `packages/*/lib`, Phoenix's `lib/` or the Godot demos, so every answer was unindexed (0/5 each) and their manifest entries pinned `srcDirs` to measure ranking regardless. Detection now reaches all three, the pins are gone, and the table is zero-config throughout ([#900](https://github.com/manojmallick/sigmap/issues/900)). A manifest entry may still pin `srcDirs` — with a `srcDirsWhy` recording the measured reason — if a future layout defeats detection; none does today.

**Phoenix read 4/5 zero-config at v8.74.0, not the 5/5 its pin scored, and reads 5/5 again with body words on.** The difference was a change of measurement path, not a regression. Zero-config scored 0/5 there before; the pinned 5/5 was measured through a config file, and with one present the import graph is built over the pinned roots. With none, the graph the ranker is handed is built over `src`, `app`, `lib`, `R` and `inst` whatever roots detection chose — on purpose, see [the import graph](#the-import-graph-and-the-ranker-934-935).

**Unreachable** means no expected file of the task is in the index, so it cannot be found at all: detection skipped its directory, or the extractor emitted no signature for it. Those tasks stay in the corpus and are recorded in the baseline; the gate fails when a task that *was* reachable becomes unreachable, not on the gaps themselves. Thirteen are unreachable now. One is Astro's `build/` pipeline (below). Five more were found by the Ruby and C/C++ repositories added in [#984](https://github.com/manojmallick/sigmap/issues/984): four of the five Rails answers, and libuv's `include/uv/errno.h`. On Rails a zero-config run indexes 1,253 of the repository's 3,392 Ruby files, taken from five of its twelve gems (`activesupport`, `railties`, `activestorage`, `actioncable`, `actionmailer`) and its `guides/` folder, and none from `activerecord`, `actionpack`, `actionview` or `activejob`, where the four answers are. The cause is not investigated yet; this records what was observed. The last two arrived with the next batch of [#984](https://github.com/manojmallick/sigmap/issues/984) and are recorded the same way, as observations whose causes are not confirmed: Newtonsoft.Json's `DefaultSerializationBinder.cs`, for which the C# extractor emits no signature at all (a zero-config run of the pin reports "no extractable signatures"; the class header's base list is interleaved with `#pragma` lines), and VitePress's `src/node/build/generateSitemap.ts`, because a zero-config run of the pin indexes no file under `src/node/build/`, which looks like the `build/` directory skip behind Astro's. The last five arrived with the third batch of [#984](https://github.com/manojmallick/sigmap/issues/984), in its two largest repositories: Akka's `JsonObjectParser.scala` and `JacksonSerializer.scala`, and rust-analyzer's `postfix.rs`, `apply_demorgan.rs` and `flycheck_to_proto.rs`. A zero-config run indexes 786 of Akka's 4,623 tracked files and 700 of rust-analyzer's 2,266, and these five are among the files it leaves out. The cause is not investigated either; this records what was observed.

**Python is indexed with the regex extractor.** The default Python extractor uses the host's `python3` when there is one: a CPython AST pass that parses what that interpreter can parse, so the same tree extracts differently depending on which Python is installed, and the generated header names it (`toolchain=python@3.9`). It used to start one process per file, which took minutes on Django, and now starts one per 1,000 files ([#970](https://github.com/manojmallick/sigmap/issues/970)). A committed number cannot depend on the host's interpreter, so the gate still runs generation with `python3` shadowed. `node scripts/run-xrepo-gate.mjs --python-ast` scores the Python repos both ways: on this corpus Django reads 4/5 on both tiers and Flask 5/5 on both, under Python 3.9.6 and under 3.14.6, with MRR moving from 0.383 to 0.367 (Django) and from 0.690 to 0.700 (Flask). The earlier note that Flask moved from 5/5 to 4/5 with the host's Python does not reproduce on the current corpus.

### What the first run found, and what became of it

Beyond the number, the first run surfaced defects the self-scored corpora cannot see, all measured and listed in [#893](https://github.com/manojmallick/sigmap/issues/893). Most were fixed in [#900](https://github.com/manojmallick/sigmap/issues/900):

- **Zero-config detection missed the source root** in Dart workspaces, Elixir mix projects and Godot repos — **fixed.** A pub workspace is a monorepo whose packages contribute their `lib/`; an Elixir project's source is `lib/`; a GDScript tree is rooted at the repo. All 15 tasks went from unreachable to reachable.
- **Real files never reached the index** — **fixed** for a TypeScript or JavaScript file that ends `export default <identifier>` or declares `export default function`, any C# `partial` type, and a Swift type whose inheritance clause carries an attribute (`: @unchecked Sendable`). **Still open:** everything under a directory named `build/` (Astro's whole static-build pipeline). About fourteen directory walkers each skip by name against one shared list, so changing the rule for one makes `validate`, `doctor` and coverage disagree with `generate`; it needs one shared skip primitive first.
- **`isDocsFile` demoted real source by 80%** — **fixed.** A well-known doc name (`history`, `security`, `changes`, `license` …) is documentation only when it is not source code, so excalidraw's `history.ts` now ranks 1st for the undo/redo question instead of 20th. The rule is a deny-list of programming-language extensions: across 66,691 tracked files in 50 repos it changes exactly eight source files and no document, where an allow-list of prose extensions would also have released genuine docs (`README.Rmd`, `LICENSE.python`).
- **Left alone on purpose:** `test_*` as the only test signal fires on 62 code files in those 50 repos, and every one is a test or testing-infrastructure file (Rails `test_case.rb`, abseil `test_helpers.cc`, fastapi `test_main.py`). Restricting it to Python, as #893 suggested, would un-demote 56 of them for no measured gain.

Two more were found while fixing these and were **not fixed in #900**. The first was fixed afterwards, in [#934](https://github.com/manojmallick/sigmap/issues/934) (below); the second is still open:

- **In zero-config the import graph was built over the wrong directories.** `buildFromCwd` fell back to `src`, `app`, `lib`, `R` and `inst` when there was no config file, whatever roots detection chose, and the product callers (`plan`, `--impact`, the MCP tools) passed none. For Phoenix the graph held 75 files against 224 when built over the six roots it indexes, and one task ranks 5th under one graph and misses under the other. Fixed for every surface that reports a blast radius in [#934](https://github.com/manojmallick/sigmap/issues/934); what ranking is handed is deliberately unchanged, see below.
- **A repo's generated `## recent changes` block is indexed as signatures of its last file.** In this repository that file is `src/workspace/detector.js`, so every commit rewrites its index entry, and the self-scored corpora drift with it: a branch that edits `src/discovery/` made the monorepo question (`h020`) rank `detector.js` 2nd instead of 9th, and the gain disappears with `changes: false`. Read a movement on `hard` or `mined` against a pristine `develop` worktree *and* with that section disabled. Not measured on xrepo.

### The import graph and the ranker (#934, #935)

Until #934 a repo with no `srcDirs` pin got an import graph over `src`, `app`, `lib`, `R` and `inst` only. Of the 50 pinned clones, **29 had an empty graph** (26 with no `srcDirs` pin; 12 are written in languages the graph does not read), so `--impact`, `plan`'s blast radius and the MCP `get_impact` / `get_method_impact` tools answered "nothing depends on this" (`get_method_impact`: "symbol not found in the call-graph") for Django, Rails, Excalidraw, Tokio, Gin and 10 more. The graph now walks the roots detection chose **plus** those conventional names — a conventional directory the walk reached before is still reached, and no clone lost a node or an edge — and the live overlay and the call graph resolve their directories the same way. 21 repos go from an empty graph to one with files in it, 15 of them with resolved import edges (Django 0 → 2,971 files, Astro 0 → 1,890, Rails 0 → 1,234; the other six — Zod, whose TypeScript imports `./x.js` for `x.ts`, and five small repositories in languages the graph does not read — gain files and no edges), and the repositories with no import edge at all go from 30 to 15; a pinned `srcDirs` still wins, with its own exclude list.

**What ranking is handed did not change, and that is measured, not assumed.** The neighbour boost adds 0.40 per importing seed to a file that itself matched, was calibrated on graphs of a few hundred files, and is bounded only by a hub cutoff of 20% of the graph — 595 importers on Django's 2,971 files. Fed the full Django graph, `core/exceptions.py`, with 180 importers, collects +72 on a pre-boost score of 12 and ranks first; the answers to x029 and x030 fall from 4th and 5th to 11th. Over the whole corpus that was **42 → 42** hits at v8.73.0, before body words (won 3, lost 3, MRR 0.3543 → 0.3520), with **django 3 → 1** — a per-repo regression an average would hide. So `rank()` is still handed `buildRankingGraph` (the pre-#934 walk), the benchmarks that score it call the same function, and in v8.73.0 no published number or baseline moved. Calibrating the boost for large graphs was then measured with a rule chosen on one half of the data and scored on the other, and no rule earned the change ([below](#calibrating-the-neighbour-boost-935)).

### Calibrating the neighbour boost (#935)

The question #934 left open is whether the hop-1 boost can be bounded so that `rank()` can be handed the complete graph. On this corpus **no rule earns it**, so nothing changed: `rank()` is still handed `buildRankingGraph`, and the calibration moved no published number or baseline. Every figure in this section was measured on the ranker as it shipped through v8.74.0 — without body words — and is recorded as such: the sweep ranks with whatever the runner is handed, so re-running it now measures the rules on top of them.

**Method.** Ten rules were fixed in `scripts/lib/graph-damping.mjs` before this run, after an exploratory one, most of them the shapes #935's own lead suggested: a file may take at most 24, 16, 12, 8 or 4 hop-1 bonuses (`cap`), at most 2, 1 or 0.5 times its own score in total beyond its first bonus (`share`), or each successive bonus is scaled by 0.9 or 0.8 (`decay`). The first bonus is never damped — it is the designed lift for a direct neighbour of a match — so a rule can reorder files that matched on their own and can never hide a neighbour. Every task is ranked with the graph `rank()` is handed today and with the complete graph under each rule; a cell counts the tasks the setting wins and loses against the former.

| Rule | xrepo 42/83 | hard 65/90 | mined 37/60 | easy 18/20 | jvm 21/61 | all |
|------|------------:|-----------:|------------:|-----------:|----------:|----:|
| `complete graph, no rule` | +0 (3/3) | +0 (0/0) | +0 (0/0) | +0 (0/0) | +0 (0/0) | +0 (3/3) |
| `cap24` | +1 (3/2) | +0 (0/0) | +0 (0/0) | +0 (0/0) | +0 (0/0) | +1 (3/2) |
| `cap16` | +1 (3/2) | +1 (1/0) | +0 (0/0) | +0 (0/0) | +0 (0/0) | +2 (4/2) |
| `cap12` | +2 (3/1) | +1 (1/0) | +0 (0/0) | +0 (0/0) | -1 (0/1) | +2 (4/2) |
| `cap8` | +2 (3/1) | +3 (3/0) | +0 (0/0) | +0 (0/0) | -1 (0/1) | +4 (6/2) |
| `cap4` | +2 (2/0) | +3 (3/0) | +0 (0/0) | +0 (0/0) | -2 (0/2) | +3 (5/2) |
| `share2` | +1 (3/2) | +2 (2/0) | +0 (0/0) | +0 (0/0) | -1 (0/1) | +2 (5/3) |
| `share1` | +1 (3/2) | +2 (2/0) | +0 (0/0) | +0 (0/0) | -1 (0/1) | +2 (5/3) |
| `share0.5` | +2 (3/1) | +3 (3/0) | +0 (0/0) | +0 (0/0) | -1 (0/1) | +4 (6/2) |
| `decay0.9` | +3 (3/0) | +3 (3/0) | +0 (0/0) | +0 (0/0) | -2 (0/2) | +4 (6/2) |
| `decay0.8` | +2 (2/0) | +3 (3/0) | +0 (0/0) | +0 (0/0) | -2 (0/2) | +3 (5/2) |

**What it says.**

- The complete graph with no rule is net zero on xrepo: it wins phoenix x062, vue-core x041 and flask x032 and loses django x029, x030 and flask x033. Damping removes the three losses only at its strongest settings (`decay0.9` is 3 won / 0 lost; `cap4` and `decay0.8` 2 / 0), while `cap24` and `cap16` still lose two and `cap12`, `cap8` and `share0.5` one — the best xrepo reading is +3 (`decay0.9`), against the +5 the default rule asks for.
- Every rule that helps `hard` by two or more tasks costs `jvm` one or two. The only ones that cost it nothing, `cap24` and `cap16`, are worth +1 on xrepo (`cap16` also +1 on `hard`).
- `mined` and `easy` do not move under any rule, and the honest corpus is scored without an import graph, as its table is, so no rule can move it. `ask` and `--query` hand the ranker no graph either: only the MCP `query_context` tool, `sigmap --benchmark` / `--eval`, the benchmark harnesses and a library caller of `rank()` are affected by anything in this section.

**Chosen on one half, scored on the other.** A table of ten rules over 314 tasks is partly noise, so a rule was also chosen on one half of xrepo (by repository) and of `mined` (by task) and scored on the other half and on `hard`, `easy` and `jvm`, which tuning never touches, and the folds were swapped:

| Tuned on | Chose | Held out: xrepo | mined | hard | easy | jvm |
|----------|-------|----------------:|------:|-----:|-----:|----:|
| fold 0 (69 tasks) | `cap12` | +1 | +0 | +1 | +0 | -1 |
| fold 1 (74 tasks) | `cap4` | +0 | +0 | +3 | +0 | -2 |

The two folds do not agree on a rule, and on both the held-out reading is one task or none on xrepo against a loss on `jvm`. The lead in #935 — `cap8` at +2 on xrepo, +3 on `hard`, −1 on `jvm` — reproduces row for row above, and it was a lead rather than a result: the best cell of a table scored on the data it was picked from.

**The call.** The default rule in this guide asks for at least five more wins than losses on xrepo and no corpus net-negative. No row meets it, so nothing is switched on and `buildRankingGraph` keeps the walk it had before #934. The option the sweep turns, `graphDamping` on `rank()`, is not wired to any config. One xrepo task is 1.2 points and the best rule's whole lead is three tasks: a larger labelled corpus is the lever, not another rule. An earlier run also tried letting a boosted file seed hop 2 once instead of once per bonus; it changed nothing, because a hop-2 neighbour is by construction a file that no matched file imports, and the option was removed.

```bash
npm run benchmark:graph-damping-sweep      # the table and the folds above, recorded to benchmarks/reports/graph-damping-sweep.json
```

### Why a task misses (`--why`)

A hit rate says how many tasks miss and nothing about the remedy, and the remedy depends on the reason. `--why` places every miss in exactly one class. The table is the 90 misses behind the 118/208 above (the shipped ranker — body words on):

| Why the task misses | Tasks | What it needs |
|---|---:|---|
| answer not indexed | 8 | detection or an extractor |
| demoted by a path penalty | 0 | a path classifier |
| no token in common with the question | 3 | a way across the vocabulary — not a re-weighting |
| ranked 6–10 | 18 | ranking |
| ranked 11–20 | 19 | ranking |
| ranked 21–50 | 24 | ranking |
| ranked beyond 50 | 18 | ranking |

The first two rows are decided by code that is not the ranker, and fixing one never costs another split: at the first run they held 4 tasks (plus 15 hidden behind the pinned `srcDirs`) and 1, and they hold 8 and 0 now: the original 83 questions still hold 1 and 0, one of the others is in the Ruby and C/C++ repositories added by [#984](https://github.com/manojmallick/sigmap/issues/984), two are in the next batch (Newtonsoft.Json and VitePress) and four in the last (Akka and rust-analyzer). The other 82 misses are the ranker's. Eighteen sit within five places of the top 5. The class that share no token with the question scored zero at v8.74.0 — the question and the answer's index entry have no word in common, so a lexical ranker has nothing to compare, and no re-weighting changes that — and held 12 of the 41 misses; the lever that reached them was not a re-weighting but the answer's *own* words, which [body words](#body-words) add, and four tasks are left in it (one original question, three added since). Repo-mined expansions, the other lever [#674](https://github.com/manojmallick/sigmap/issues/674) and [#703](https://github.com/manojmallick/sigmap/issues/703) asked about, are net negative on this corpus with body words on (−1).

The penalty row is a counterfactual: the path penalty is divided out of the file's final score and the list re-sorted with the ranker's own tie-break, so it answers "would this file have made the top 5 had its path not demoted it" and nothing more. The row is the baseline's own account (`--save` records it beside the hit count); it is not a gate.

### Run it

```bash
npm run fetch:xrepo        # pinned shallow/sparse fetch of the 35 repos (about 900 MB, idempotent)
npm run benchmark:xrepo    # the report; add --per-task for each task's rank and what moved
npm run benchmark:xrepo -- --why   # why each miss misses: not indexed / penalty / ranking, by distance
npm run validate:xrepo     # the gate: floor + per-repo no-regress (CI adds --require-repos)
```

CI restores `benchmarks/repos` from a cache keyed on `benchmarks/xrepo-repos.json`, fetches only what is missing or off-pin, and runs the gate. The gate exits 0 when the repos are absent, so a fresh checkout is never broken by it.

### Judging a change: the exact paired test

A retrieval change is scored on the same tasks before and after, so only the tasks whose hit status changed carry information: the ones it **won** (a miss that is now a hit) and the ones it **lost**. If the change only moved the answers around, each changed task is equally likely to go either way, which makes the number of wins among them a fair-coin count; the gate prints the exact two-sided sign test on it (McNemar's exact test is the same computation, with no normal approximation). It sits beside the won and lost counts, in three places:

- `npm run benchmark:xrepo` prints **against the baseline** after the table: the tasks compared with the recorded baseline, those won and lost, and the verdict. Tasks and repositories the baseline does not hold yet are counted as new and never compared. `--json` carries the same as `vsBaseline`.
- `npm run benchmark:xrepo -- --signals` prints the line under every ranking signal that changed a task, and so do `benchmark:retrieval -- --signals` (per corpus) and `benchmark:honest` with its signal arms.
- Nothing is decided by it: the gate's floor and per-repo no-regress rule are unchanged. The test only says how much a won/lost count supports.

Read it as a rule of thumb: the words "better" or "worse" appear only when p is below 0.05, and anything else reads "not distinguishable from reshuffling", with how many changed tasks it would take. Fewer than six changed tasks can never be decisive: a clean 5–0 sweep is p = 0.0625. So a change that moves four tasks is not evidence either way, however it looks as a rate, and a net gain of two (3 won, 1 lost) is p = 0.625.

:::tip The eleven xrepo-only clones are skipped by the suites that walk `benchmarks/repos`
`fetch:xrepo` puts eleven repositories that no other suite expects (tokio, excalidraw, django, phoenix, astro, plenary, godot-demo-projects, composer, newtonsoft-json, exposed, vitepress) into `benchmarks/repos/`. The manifest flags them `xrepoOnly`, and the two suites whose published figure or gate depends on the exact set of clones — `benchmark:test-discovery` and `validate:grounding-coverage` — skip them through `scripts/lib/benchmark-repos.mjs`, so a machine that has run `fetch:xrepo` reads the same figures on those two as one that has not (`validate:source-roots` and `validate:benchmark-determinism` also read the directory and were left as they were) ([#893](https://github.com/manojmallick/sigmap/issues/893) §7). The twenty-four repositories xrepo shares with other suites are measured by both.
:::

### Changing the corpus

- **Re-pin a repo:** change its `commit` in `benchmarks/xrepo-repos.json`, run `npm run fetch:xrepo`, re-check every task that names a file in that repo, then `node scripts/run-xrepo-gate.mjs --save`. A pin that moves with the corpus unchanged is a measurement change; say so in the PR.
- **Add a task:** read the code, never the ranker; write a question that shares no word stem with the answer's file name; record a `rationale` naming what the file does and which neighbours you ruled out; have a second annotator name files for the question alone; set `"audit"` to `agreed` or `partial`. `test/integration/xrepo-corpus.test.js` enforces the mechanical half, and `benchmarks/XREPO_LABELLING.md` is the whole procedure, including how to record both annotators' answers in `benchmarks/xrepo-annotations.json`.
- **Never hand-edit the baseline.** `--save` merges, so a run on a machine that lacks some repos does not erase their entries.

## Where the misses come from

A hit rate says how many tasks miss and nothing about the remedy. Every gate can now say why — each miss in exactly one class, with the words that explain it — and compare each ranking signal with the shipped ranker, task by task. This section is what that found, measured on the ranker as v8.75.0 ships it, body words included. Each figure in it is held to a saved report by a test, so none can drift; `hard`, `mined` and `easy` score this repository against itself and move with every commit, so they appear only as columns of the signals table below.

### What the misses are made of

| Why the task misses | xrepo | jvm |
|---|---:|---:|
| answer not indexed | 8 | 0 |
| demoted by a path penalty | 0 | 2 |
| no token in common with the question | 3 | **16** |
| ranked 6–10 | 18 | 6 |
| ranked 11–20 | 19 | 3 |
| ranked 21–50 | 24 | 6 |
| ranked beyond 50 | 18 | 3 |
| **hits / tasks** | 118 / 208 | 25 / 61 |
| **hit rate over the tasks a word can reach** | 59.9% (118 / 197) | 55.6% (25 / 45) |

*A word can reach a task* when its answer is indexed and shares a word with the question. A task outside that set cannot be won by any method that matches words, so the rate over the set is the one a ranking change can move; the rate over every task also moves when the corpus does.

**The xrepo column above is the current baseline, 208 tasks, and the signal-arm table below was re-recorded on it (v8.81.0, with `hard`, `mined` and `easy` scored against the tree it was recorded on). Its third-party column was scored again at v8.82.0 ([#975](https://github.com/manojmallick/sigmap/issues/975): the C and C++ extractor moved one `spdlog` task) and the other columns stand as recorded, because a control on untouched `develop` already reads some of them differently, so `recorded` in the report says when each was scored.** The three sweeps further down are different: each is a dated experiment on the first 83 tasks (`xrepo 42/83` is the ranker of that date), and each already says that a re-run does not reproduce its table, because the ranker has moved since. They are kept as the record of how the constants were chosen and were not re-run on the grown corpus. Re-running the neighbour-boost calibration there is the use [#984](https://github.com/manojmallick/sigmap/issues/984) was opened for, and it is a new measurement, not a re-recording.

The largest class used to be the one no re-weighting touches: the answer shares no token with the question. On `xrepo`, whose questions were written by reading the code, it held 12 of the 41 misses at v8.74.0 and **11 of the 12** held a *distinctive* word of the question in their own source — a word held by no more than 5% of the files, which the file's signatures do not carry (okhttp `revalidated`, express `tls`, serilog `retrying`). A signature map keeps a file's shape and drops what its body says, and a question about how something works is asked in the words the body uses. [Body words](#body-words) index exactly those words and are on by default since v8.75.0, so the class is **3** now: one task holds none of the question's words anywhere and two hold only common ones. On `jvm` it is still the largest, 16 of 36 misses, and reads **1 / 9 / 6**: one holds a distinctive word, nine only common ones (`import`, `message`, `not`), six nothing. Those are commit subjects the miner took for questions, and most of them describe an edit, not a topic.

### What the JVM split measures

It reads **41.0%** (25 of 61) — 34.4% at v8.74.0, before body words were on by default, and not the 22.9% [#674](https://github.com/manojmallick/sigmap/issues/674) quoted. Of its 36 misses **16** share no token with the question, all of them spring-petclinic commit subjects: "fix typo in confirmation message", "Make jar not war", "Add proxyBeanMethods = false". The miner took the subject as the question and the files the commit touched as the answer, and a subject that describes an edit names nothing the file is about. **5** tasks name only a test file as the answer, and none of them hits. This is the shape of [#883](https://github.com/manojmallick/sigmap/issues/883) — a mining artefact scored as a ranking miss — in a second corpus.

Over the 45 tasks a word-matching ranker can reach, the hit rate is **55.6%**. What is left is 20 ranking misses (18 ranked below the top 5, two demoted by a path penalty), most of them in akka's large Scala files. The headline measures the corpus as much as the ranker: read the reachable rate when judging a ranking change, and keep the headline for comparing releases.

### The hard split against grep

[#674](https://github.com/manojmallick/sigmap/issues/674) called the honest benchmark's hard split "the one split where the baseline wins" (SigMap 46.7%, grep 53.3%). The saved report now reads SigMap **80.0%** (12 of 15) against grep **53.3%** (8 of 15). `--autopsy` asks which tasks each finds and the other does not — and in doing so found what the grep scan was counting.

**The published scan counts SigMap's own files.** `.context/sig-index.json` and `.github/copilot-instructions.md` hold every identifier in a repository, so any question matches them first. In the layout the published figure is measured in, they took **135 of the 625** top-5 places the scan returned. They are not answers, and they push answers out.

| grep scan | hit@5 | honest lift |
|---|---:|---:|
| as published | 40.0% (50 / 125) | 2.32× |
| SigMap's own files left out | 46.4% (58 / 125) | 2.00× |

**The scan is unchanged**: `benchmark:honest` still scans what it always scanned, and this section only records the effect. Whether to restate the lift is a call for a release, not a side effect of a diagnosis. Because the scan includes those files, the published figure moves with the repository: v8.70.1 reads 49 / 125 where v8.70.0 read 50 / 125, one more of the 625 top-5 places taken by SigMap's own generated files (127 against 126) — on a control run of the untouched v8.70.0 tree, in the same layout, the scan reproduces 50 / 125. v8.72.0 keeps 49 / 125 while that count of places moves the other way, 127 → 126, with the same scan. v8.72.1 keeps 49 / 125 again while the count moves back, 126 → 127, with the same scan; the two trees differ only in documentation (a legacy site deleted, six decision records added), which the scan reads, but the cause is not isolated. v8.73.0 reads 51 / 125 with 126 of the 625 places, the same scan on a clean checkout of the release: two more answers than v8.72.1 published — `src/tracking/logger.js` for "usage log tracking NDJSON runs" (t018) and `src/mcp/handlers.js` for t020 — each the answer that SigMap's own generated files had been displacing from the fifth place. The v8.72.1 tag, run through the same recipe on the same day, reads 50 / 125 (t020 only), so 39.2% did not reproduce from its own tag and one task of the movement is the environment, not the tree. Cause not isolated beyond that contested fifth place. v8.74.0 reads 50 / 125 with 127 of the 625 places on a clean checkout of the release, the same scan: `src/tracking/logger.js` (t018) is displaced from the fifth place by one generated file again and only `src/mcp/handlers.js` (t020) keeps its answer, which is the 50 / 125 the v8.72.1 tag reads by this recipe. The figure therefore moves down by one, and the lift up from 2.20× to 2.24×, with no change to the scan — the release adds text, and the scan reads it; `rank()` is unchanged with `graphDamping` absent. v8.75.0 reads 49 / 125 with 128 of the 625 places on a clean checkout of the release, the same scan: one answer fewer than v8.74.0, from the release's own text again, and the lift moves up from 2.24× to 2.37×: 0.08 of the 0.13 because SigMap's side moved (112 → 116 of 125), the rest because the scan, unchanged, finds one answer fewer (50 → 49). v8.75.1 reads 51 / 125 with 125 of the 625 places on a clean checkout of the release, the same scan: two answers more than v8.75.0 published — `src/tracking/logger.js` (t018, fifth) and `src/mcp/handlers.js` (t020, fourth) are in grep's top five again — and the lift moves down from 2.37× to 2.27× with SigMap's side unchanged at 116 of 125. The v8.75.0 tag, run through the same recipe on the same clones, reads 51 / 125 too, so 39.2% did not reproduce from its own tag and the movement is not this release's. The release adds one file to each clone's `.context/` (`.context/.gitignore`); the scan was measured with and without it and reads the same either way. Cause not isolated beyond the environment. v8.76.0 reads 50 / 125 with 126 of the 625 places on a clean checkout of the release, the same scan: one answer fewer than v8.75.1 published — `src/tracking/logger.js` (t018) is fifth in grep's scan on the v8.75.1 tag and ninth on the release tree, where SigMap's own generated `.github/copilot-instructions.md` holds that place — and the lift moves up from 2.27× to 2.32× with SigMap's side unchanged at 116 of 125. The v8.75.1 tag, run through the same recipe on the same clones in a clean worktree, reproduces 51 / 125, so this movement is the tree's: the release adds two modules, three new or changed test files and their documentation, and the scan reads them. Which of them moved t018 is not isolated. v8.77.0 reads 50 / 125 again with 127 of the 625 places on a clean checkout of the release, the same scan and the same 2.32×: one more place is taken by SigMap's own generated files (127 against 126), no hit count moves in any split or bucket, and two unpublished grep-MRR leaves move in the third decimal. The release adds a benchmark harness under `scripts/`, one test file and their documentation, and the scan reads all of it. v8.77.1 reads 50 / 125 with 126 of the 625 places on a clean checkout of the release, the same scan and the same 2.32×: one place fewer is taken by SigMap's own generated files (126 against 127), no hit count moves in any split or bucket, and one unpublished grep-MRR leaf moves in the third decimal. The release changes that harness, the cases of one test file and their documentation, and the scan reads all of it. v8.77.2 reads 50 / 125 with 126 of the 625 places on a clean checkout of the release, the same scan and the same 2.32×, and no leaf of either honest report moves. The release changes documentation only — and the scan reads documentation, which is why it was measured and not assumed. v8.78.0 reads 50 / 125 with 126 of the 625 places on a clean checkout of the release, the same scan and the same 2.32×, and no hit count moves in any split or bucket; six unpublished MRR leaves move in the third decimal (SigMap's own overall, easy and large-bucket figures and their three grep-side counterparts), and they already read those values on `develop` as merged, before any release edit. The release adds two modules, two test files and their documentation, and the scan reads all of it. v8.79.0 reads 50 / 125 with 125 of the 625 places on the release tree, the same scan and the same 2.32×, and no hit count moves in any split or bucket; SigMap's own generated files take one place fewer (125 against 126) and two unpublished grep-side MRR leaves move in the third decimal (the easy split 0.187 to 0.188, the small bucket 0.295 to 0.299). The merged `develop` before any release edit, measured in the same layout, reads 126 and the old values, so the movement belongs to the release's own text — a changelog entry, a roadmap entry and a contributors block, which the scan reads — and is not isolated further. v8.80.0 reads 50 / 125 with 125 of the 625 places on the release tree, the same scan and the same 2.32×, and no hit count moves in any split or bucket; five unpublished MRR leaves move in the third decimal (SigMap's overall 0.765 to 0.758, the easy split 0.786 to 0.778, the large bucket 0.773 to 0.758, and on the grep side the overall 0.193 to 0.194 and the large bucket 0.137 to 0.138). The merged `develop` before any release edit, measured in the same layout, reads 126 places, the same three SigMap-side values, and on the grep side 0.194 overall, 0.139 for the large bucket and 0.295 for the small one, so the SigMap-side movement belongs to the merged code — #1002 and #1003 changed the repository the self-repo task set is scored against — and the places count and the grep-side values belong to the release's own text, which the scan reads. v8.80.1 reads 49 / 125 with 129 of the 625 places on the release tree, the same scan, and the lift moves up from 2.32× to 2.37×; SigMap's side is unchanged at 116 of 125 (92.8%, MRR 0.758) and the scan finds one answer fewer (50 to 49: the easy split 42 to 41 of 110, the large bucket 18 to 17 of 60); four unpublished grep-side MRR leaves move in the third decimal (overall 0.194 to 0.193, the easy split 0.188 to 0.187, the large bucket 0.138 to 0.136, the small bucket 0.299 to 0.295). The merged `develop` before any release edit, measured in the same layout, reads exactly the same (49 / 125, 129 places, 2.37×), so this movement belongs to the merged code and text, not to the release's: #1005 to #1010 added a module, a two-file benchmark harness under `scripts/`, three new test files, a rewritten Ruby extractor and their documentation, the scan reads all of it, and SigMap's own generated files take four more of the 625 top-5 places than at v8.80.0 (129 against 125). The autopsy without those files is unchanged (57 / 125, 45.6%, 2.04×). v8.81.0 reads 50 / 125 with 132 of the 625 places on the release tree, the same scan, and the lift moves down from 2.37× to 2.32×; SigMap's side is unchanged at 116 of 125 (92.8%) with its MRR 0.758 to 0.767 (the self-repo task set is scored against the live repository, and the easy split and the large bucket move with it, 0.778 to 0.788 and 0.758 to 0.778), and the scan finds one answer more (49 to 50: two more of the self-repo set's 20, one fewer in flask). An untouched merged `develop` before any release edit, measured in the same layout, reads exactly the same (50 / 125, 132 places, 2.32×), so this movement belongs to the merged code, not to the release's text. One thing was changed so that it would: the extraction cache (`.context/extract-cache.json`, #971) is a new file of SigMap's own in every indexed clone, and counting it moved the published scan to 43 / 125 (34.4%, lift 2.70×) with 187 of the 625 places and no change to SigMap's 92.8%, a lift made larger by a file the scan should not rank. The scan now leaves that one file out of the ranking and the file count (PR #1018) and counts every other file SigMap writes exactly as before, which keeps the series what it was. The autopsy without SigMap's files reads 58 / 125, 46.4%, 2.00× (57 / 125, 45.6%, 2.04× at v8.80.1). v8.82.0 reads 50 / 125 with 131 of the 625 places on the release tree, the same scan and the same 2.32×, and SigMap's side is unchanged at 116 of 125 (92.8%); the release changes no shipped file, adds scripts, benchmark data, one test file and their documentation, and the scan reads all of it, so SigMap's own generated files take one place fewer (132 to 131) and the autopsy without them reads 58 / 125, 46.4%, 2.00× as before. v8.83.0 reads 50 / 125 with 130 of the 625 places on the release tree, the same scan, and the lift moves down from 2.32× to 2.30× because SigMap's side moved, 116 to 115 of 125 (92.8% to 92.0%, MRR 0.767 to 0.763): the whole move is the self-repo task set, 19 to 18 of 20, which is scored against the live repository. An untouched merged `develop` before any release edit, measured in the same layout, reads the same hit counts and the same SigMap MRR, and the v8.82.0 tag, run through the same recipe, reproduces v8.82.0's published 116 / 125 and 50 / 125 leaf for leaf, so the movement belongs to the merged code (#1029 to #1031 add modules, harnesses, tests and documentation, and the scan reads all of it) and not to the release's text; three unpublished grep-side MRR leaves move in the third decimal between the merged tree and the release tree (overall 0.188 to 0.187, the easy split 0.181 to 0.180, the large bucket 0.130 to 0.129), which belongs to the release's text. The autopsy without SigMap's own files reads 58 / 125, 46.4%, 1.98× (2.00× before). v8.84.0 reads 49 / 125 with 135 of the 625 places on the release tree, the same scan, and the lift moves up from 2.30× to 2.35× because the grep side moved, 50 to 49 of 125 (40.0% to 39.2%, MRR 0.186 to 0.185), while SigMap's side is unchanged at 115 of 125 (92.0%, MRR 0.763). An untouched merged `develop` before any release edit, measured in the same layout, reads exactly the same (49 / 125, 135 places, 2.35×), and the v8.83.0 tag, run through the same recipe, reproduces v8.83.0's published 115 / 125 and 50 / 125 (its count of places reads 133 here against the 130 published, because the shared clones now hold this release's generated files, so that count is layout-sensitive and is not claimed as reproduced), so the movement belongs to the merged code (#1035 adds a module, scripts, six tests and their documentation, and the scan reads all of it) and not to the release's text. The autopsy without SigMap's own files reads 58 / 125, 46.4%, 1.98× as before. v8.85.0 reads 49 / 125 with 136 of the 625 places on the release tree, the same scan and the same 39.2%, and the lift moves up from 2.35× to 2.37× because SigMap's side moved, 115 to 116 of 125 (92.0% to 92.8%, MRR 0.763 to 0.776): `express-h003`, which shared no token with its index entry, becomes a hit and `fastify-h002` moves from sharing none to ranked 9th, both after the merged extractor change (#996; the cause is not isolated further), while the self-repo task `t006`, whose answer is the generated bundle `gen-context.js`, moves from a miss ranked 151st to an answer that is not indexed, because #876 leaves the bundle out of the index by design. An untouched merged `develop` before any release edit, measured in the same layout, reads exactly the same (49 / 125, 116 / 125, 136 places, 2.37×), and the v8.84.0 tag, run through the same recipe, reproduces v8.84.0's published 115 / 125 and its 10 misses, so the movement belongs to the merged code (#1039 changes the extractors, detection, the adapters and the bundle, and the scan reads all of it) and not to the release's text. The autopsy without SigMap's own files reads 58 / 125, 46.4%, 2.00× (1.98× before). v8.85.1 reads 50 / 125 with 135 of the 625 places on the release tree, the same scan, and the lift moves down from 2.37× to 2.32× because the grep side moved, 49 to 50 of 125 (39.2% to 40.0%, the easy split 37.3% to 38.2%, the large bucket 30.0% to 31.7%), while SigMap's side is unchanged at 116 of 125 (92.8%). An untouched merged `develop` before any release edit, measured in the same layout, reads exactly the same (50 / 125, 135 places, 2.32×), and the v8.85.0 tag, run through the same recipe, reproduces v8.85.0's published 49 / 125 and its 136 places, so the movement belongs to the merged code (#1043 adds a checker script, two tests, a Dependabot file and workflow edits, and the scan reads all of it) and not to the release's text. The autopsy without SigMap's own files reads 58 / 125, 46.4%, 2.00× as before.

Against the scan without those files:

| | tasks | both find it | only SigMap | only grep | neither |
|---|---:|---:|---:|---:|---:|
| every task | 125 | 57 | 59 | 1 | 8 |
| hard split | 15 | 8 | 4 | 0 | 3 |

The one task grep finds and SigMap does not shows no systematic vocabulary advantage: it is a SigMap near-miss, ranked 6th–10th, that grep ranks 5th (`fastapi-t004`). The second task of v8.84.0, `express-h003`, which shared no token with the question and which grep ranked 3rd, is a SigMap hit now. SigMap's 9 misses on this corpus are **1** that shares no word with its index entry, **1** whose answer is not indexed (the generated bundle `gen-context.js`, left out by design) and **7** ranked misses, **5** of them ranked 6th–10th.

### The opt-in ranking signals

Each signal against the shipped ranker, task by task. A cell is the net number of tasks it wins over plain, with won / lost beside it: a signal that wins as many as it loses has moved answers around, not improved them. The honest corpus is scored without an import graph, as its own table is, so the two arms that are about the graph do not apply to it (—). Body words ship on, so `plain` already carries them and their row is the ablation: the flag turned off, a cell that counts what the words win — a negative number there is the cost of switching them off.

| signal | xrepo | hard | mined | easy | jvm | honest | all |
|---|---:|---:|---:|---:|---:|---:|---:|
| plain (as shipped) | 118 / 208 | 63 / 90 | 40 / 60 | 18 / 20 | 25 / 61 | 116 / 125 | 380 / 564 |
| centrality blend | +0 (0 / 0) | +0 (0 / 0) | +0 (0 / 0) | +0 (0 / 0) | +0 (0 / 0) | — | +0 (0 / 0) |
| surface enrichment | +0 (0 / 0) | +0 (0 / 0) | +0 (0 / 0) | +0 (0 / 0) | +0 (0 / 0) | +0 (0 / 0) | +0 (0 / 0) |
| mined expansions | +0 (4 / 4) | -3 (1 / 4) | -1 (1 / 2) | +0 (0 / 0) | +1 (2 / 1) | -1 (0 / 1) | -4 (8 / 12) |
| call-graph boost | -1 (0 / 1) | -4 (0 / 4) | -4 (0 / 4) | +0 (0 / 0) | +2 (2 / 0) | +0 (0 / 0) | -7 (2 / 9) |
| **body words (flag off)** | -40 (2 / 42) | +1 (4 / 3) | -3 (1 / 4) | -1 (0 / 1) | -4 (0 / 4) | -4 (0 / 4) | -51 (7 / 58) |
| no import graph (as `ask`) | -1 (0 / 1) | +1 (3 / 2) | -3 (0 / 3) | +1 (1 / 0) | -1 (1 / 2) | — | -3 (5 / 8) |

- **Centrality blend: deprecated.** It moved the rank of 7 of 439 tasks and changed no hit.
- **Surface enrichment: deprecated.** It changed no hit, and adds pseudo-signatures to the index. Its best case is a web framework asked a route-worded question, and across the corpora that case is net zero.
- **Mined expansions: stays opt-in.** Net −4 (won 8, lost 12), negative on three of the six corpora: ±0 on the third-party corpus, −3 on `hard`, −1 on `mined`, −1 on the honest corpus, and +1 on `jvm`. With body words on it no longer wins where it was +3 with the words off (the v8.67.0 recording), and 20 tasks changed hit, so it is neither a default nor deprecated; it does not reach the no-token class.
- **Call-graph boost: not decided here**, because [#703](https://github.com/manojmallick/sigmap/issues/703) does not cover it. Net −7 (won 2, lost 9), negative on three of the six corpora: it is the next decision.
- **No import graph** is not a signal but a configuration. `sigmap ask` and `--query` call `rank()` without one, while the benchmark runner and the MCP tool pass one, so the neighbour boost the benchmarks include is not what `ask` runs. Removing it is net −3 over the five corpora it applies to (won 5, lost 8), and it is not a loss everywhere: `hard` reads +1 without it and `mined` -3. A task or two of `mined` moves with the commit the index was generated at — the generated recent-changes block is indexed — so a re-run on another history can read differently.
- **Body words: the default, by one task of `hard` short of the rule.** Switching the flag off costs **40** tasks on the third-party corpus (won 2, lost 42), 3 on `mined` (won 1, lost 4), 4 on `jvm`, 4 on the honest corpus and 1 on `easy`, and **gains 1 on `hard`** (won 4, lost 3): as shipped, the words read one task worse there.

**The rule a signal is held to.** A signal becomes a default when it wins at least five more tasks than it loses on the third-party corpus — a margin where a sign test starts to separate a win from chance — and loses net on no other corpus. It is deprecated when its net is not positive and it changes at most two hits. Anything else stays opt-in and measured. The rule was written with the v8.67.0 numbers in hand, so it is a standard the next measurement is held to, not a result — and it was held to: body words met it as an addition at v8.67.0 and as shipped at v8.75.0. They miss its second clause on the tree of this re-recording, by one task: switching them off is −38 on the third-party corpus and worse on four of the other five, and +1 on `hard` (won 4, lost 3), so by the rule as written they would not be a default. `hard` is 90 tasks scored against this repository and moves with every commit, one task is 1.1 points, and the v8.74.0 tree read the same −1 for the words (the placement in the next section was the answer then). The flag stays on, nothing in the code changed, and whether one task of `hard` outweighs +38 on the third-party corpus is the maintainer's call; this paragraph records the measurement and does not make it.

### Body words

`retrieval.bodyWords` is the lever the first section points at, and it ships on since v8.75.0. It indexes each file's *body words* — the rare words of its source that its signatures drop — into a field of their own at BM25's prose weight that adds nothing to a document's length, so a question asked in the words the code uses to do something can reach the file that does it. A word counts when no more than 5% of the indexed files hold it, the file's own index entry lacks it, and it is not a number, a word under three characters, or one that only frames a question (`how`, `does`, `whether`); a file keeps its 200 best, ordered by the lines that hold them, so the result never depends on the order files arrive in.

On `xrepo` switching it off takes 118 of 208 to **78** (56.7% → 37.5%): it wins **42** tasks and loses **2**, and lifts MRR from 0.245 to 0.386, so it is not a hit@5-only effect. It wins on corpora it was not chosen on, too: `mined` +3, `jvm` +4, `easy` +1 and the honest corpus **112 → 116** of 125 (89.6% → **92.8%**) without losing a task. `hard` is the exception: the words win 3 of its tasks and lose 4 (`hard` h006, h031, h045, h064 are the tasks they lose), so no corpus but `hard` is worse off with them, and `hard` by one task, as it was on the v8.74.0 tree. One caveat the corpus cannot remove: `xrepo`'s questions were written by reading the code, which favours a lever that indexes the code's own words, so its +38 is the upper end. The mined and JVM subjects, written by people describing a change, gain less, and `jvm` loses nothing.

The two constants were chosen from a sweep, not from a peak (measured at v8.67.0, with the words in the prose field; the placement's own sweep is [below](#weighting-the-body-words-943)). Net tasks over plain, won / lost beside it, summed over the six corpora:

| share of files | 50 words | 100 words | 200 words | 500 words | all words |
|---|---:|---:|---:|---:|---:|
| 2% | +15 (18 / 3) | +14 (21 / 7) | +14 (20 / 6) | +14 (20 / 6) | +14 (20 / 6) |
| 5% | +25 (28 / 3) | +28 (31 / 3) | **+24 (27 / 3)** | +24 (29 / 5) | +25 (30 / 5) |
| 10% | +28 (34 / 6) | +32 (38 / 6) | +30 (38 / 8) | +27 (36 / 9) | +26 (36 / 10) |

Across all 15 settings and six corpora (90 cells) **none** is net-negative, and the third-party corpus is +6 or better at every one. The region is flat from a 5% share and 50 words up (**+24 to +32** over 439 tasks) and lower at 2%, which is too tight on a large repository. The shipped 5% / 200 is inside it, not at its peak (10% / 100 is +32): it is the smaller of the two shares on the plateau, so the smaller index, and it loses 3 tasks, as few as any setting in it. `npm run benchmark:body-words-sweep` runs the same grid and now scores it in the shipped placement, so a re-run no longer reproduces the table above.

It costs a little once per regeneration and a little per query: building takes about 0.6–0.85 ms per indexed file (1.9 s for laravel's 2,618 files when it was measured at v8.67.0 with the words in the prose field; 1.7 s for Django's 2,086 and 1.5 s for laravel at v8.75.0, the line filter included), the cache is about 0.2 KB per file (509 KB for laravel, smaller than its signature index), and a query costs 6–23 ms more on the largest repositories (laravel 153 → 176 ms). That was measured on one laptop, and is not a recorded benchmark.

The words reach the ranker only — never `.context/sig-index.json`, the generated context file or anything `ask` renders for an LLM; a test generates with the flag on and off and compares the context file and the signature index. With the flag off nothing changes. The cache at `.context/body-words.json` is keyed by the mtime of `sig-index.json`, so regenerating rebuilds it and `ask` rewriting `query-context.md` does not. Files edited after the last regeneration, and files the MCP `notify_*` tools add between regenerations, carry no body words until the next one.

Turn it off in `gen-context.config.json`:

```json
{ "retrieval": { "bodyWords": false } }
```

It met the rule above as an addition at v8.67.0 — +15 on the third-party corpus, no corpus net-negative — and was eligible to become a default; on the v8.74.0 tree the placement described here no longer did, by one task of `hard`, and the next section is what was done about that. It has shipped on since v8.75.0.

### Weighting the body words (#943)

Everything above measured the words as they joined BM25's prose field, so they carried its weight (0.6) and were counted into a document's length. [#943](https://github.com/manojmallick/sigmap/issues/943) asked what a field of their own would do, because the rule above turned on one task. On the v8.74.0 tree (f33510f) that placement read **−1** on `hard` — 4 won, 5 lost, where the v8.67.0 recording above read +1 — and so did not meet the rule. On the tree of this change it reads **+0** (4 / 4): `h087`, "the built-in settings applied before any overrides", is a hit again, with no change to the file it names. `hard` is 90 tasks scored against this repository, one task is 1.1 points, and it moves with edits unrelated to its answer — adding the test that pins this section moved one cell of the table below — so it cannot carry a placement on its own.

The sweep puts the words in a field of their own and varies both things the 90-cell grid above left alone. The family was fixed before the run — eleven cells, a weight from 0.2 to 0.8, the words counted into a document's length (`count`) or not (`ignore`), mildest first — and a variant is judged against plain by the rule above applied one step more strictly: xrepo at least +5, no corpus net-negative, and neither half of xrepo (by repository) or of `mined` (by task) net-negative. Net tasks over plain, won / lost beside it:

| Placement | xrepo | hard | mined | easy | jvm | honest | all |
|---|---:|---:|---:|---:|---:|---:|---:|
| plain | 42 / 83 | 65 / 90 | 37 / 60 | 18 / 20 | 21 / 61 | 112 / 125 | 295 / 439 |
| prose field (through v8.74) | +15 (16/1) | +0 (4/4) | +3 (3/0) | +0 (0/0) | +1 (1/0) | +4 (4/0) | +23 (28/5) |
| `w0.2-count` | +9 (9/0) | +0 (2/2) | +1 (2/1) | +0 (0/0) | +1 (1/0) | +3 (3/0) | +14 (17/3) |
| `w0.2-ignore` | +11 (11/0) | +0 (2/2) | +1 (2/1) | +1 (1/0) | +1 (1/0) | +3 (3/0) | +17 (20/3) |
| `w0.3-count` | +12 (12/0) | +1 (3/2) | +1 (2/1) | +0 (0/0) | +1 (1/0) | +3 (3/0) | +18 (21/3) |
| `w0.3-ignore` | +15 (15/0) | +0 (2/2) | +3 (4/1) | +1 (1/0) | +1 (1/0) | +3 (3/0) | +23 (26/3) |
| `w0.4-count` | +14 (14/0) | +2 (4/2) | +3 (3/0) | +0 (0/0) | +1 (1/0) | +4 (4/0) | +24 (26/2) |
| `w0.4-ignore` | +16 (17/1) | +0 (3/3) | +4 (4/0) | +1 (1/0) | +2 (2/0) | +3 (3/0) | +26 (30/4) |
| `w0.5-count` | +14 (15/1) | +1 (4/3) | +3 (3/0) | +0 (0/0) | +1 (1/0) | +4 (4/0) | +23 (27/4) |
| `w0.5-ignore` | +17 (18/1) | +0 (3/3) | +4 (4/0) | +1 (1/0) | +3 (3/0) | +4 (4/0) | +29 (33/4) |
| **`w0.6-ignore`** | +17 (18/1) | +0 (3/3) | +4 (4/0) | +1 (1/0) | +4 (4/0) | +4 (4/0) | +30 (34/4) |
| `w0.8-count` | +16 (18/2) | +0 (4/4) | +3 (3/0) | +0 (0/0) | +4 (4/0) | +2 (3/1) | +25 (32/7) |
| `w0.8-ignore` | +18 (19/1) | -2 (3/5) | +7 (7/0) | +1 (1/0) | +4 (4/0) | +3 (3/0) | +31 (37/6) |

- **The placement through v8.74 meets the rule here, by zero, and so do seven of the eleven cells**: ignoring the length from weight 0.3 to 0.6, counting it at 0.4, 0.5 and 0.8. The cells that fail do so at the edges — weight 0.2, and 0.3 counted, lose one task on one half of `mined`; `w0.8-ignore` loses `hard` by two.
- **The rule as written names `w0.3-ignore`**, the mildest cell that meets it, and it does not ship. On this tree the placement it would replace meets the rule too, and `w0.3-ignore` does not beat it on the corpora that do not move with this repository: level on xrepo (+15 against +15) and `jvm` (+1 against +1), one task behind on the honest corpus (+3 against +4) and one ahead on `easy` (+1 against +0).
- **What is reproducible is the length treatment.** Not counting the words into a document's length beats counting them by +2 or +3 on xrepo at every weight tried, and by one on `easy` at every weight; on `jvm` it is never worse (0 to +2 across the five weights) and on `mined` never worse (0 to +4). It never helps `hard`: nothing at weight 0.2, one or two tasks at the other four. That was read off the table after the rule had named its cell, and it is the one reason a different cell ships.
- **What ships is `w0.6-ignore`**: the weight the words already carried and no contribution to the length, so there is no new constant and one factor separates it from the placement it replaces. Against that placement xrepo reads +17 (18 / 1) against +15 (16 / 1), `jvm` +4 (4 / 0) against +1 (1 / 0), `mined` +4 against +3, `easy` +1 against +0, the honest corpus +4 against +4 and `hard` +0 (3 / 3) against +0 (4 / 4) — **+30 (34 / 4)** against +23 (28 / 5), and worse on no corpus.

**What it does not show.**

- It is not the cell the rule named and it was chosen after the table was seen. What supports it is a sign that holds across five weights, not a best-of-eleven cell; a reader who prefers `w0.3-ignore` is choosing between two placements that are level on xrepo and `jvm` and differ by one task on the honest corpus and on `easy`.
- The strong end of the family trades `hard` for the third-party corpora. Chosen on one half of xrepo and `mined`, without ever seeing `hard`, `easy`, `jvm` or the honest corpus, the argmax is `w0.8-ignore` on both folds (+11 and +14 on the tuning half) and reads `hard` −2 on the held-out one, beside +10 and +8 on xrepo, +4 and +3 on `mined` and +4 on `jvm`. Which end is right depends on whose questions are trusted: `hard`'s are paraphrases written to avoid the code's own words, and xrepo's were written by reading the code, so its +17 is the upper end here as it was above.
- The report is the tree of this change. `hard` and `mined` move with every commit, so `npm run benchmark:body-weight-sweep` belongs on the release tree before anything is flipped.

**What changed in the code.** `retrieval.bodyWords` places the words as `w0.6-ignore` (`BODY_FIELD`, `BODY_WEIGHT` and `BODY_LENGTH` in `src/retrieval/bm25.js`, which a test holds to `ADOPTED` in `scripts/lib/body-weight.mjs`); `bodyField: 'prose'` selects the placement through v8.74. Three more things were done to make the flag safe to leave on:

- **A rare word is what a credential is.** Signatures pass the secret scanner; body words did not, so a repository holding `AKIAIOSFODNN7EXAMPLE` wrote `akiaiosfodnn7example` into `.context/body-words.json`. [#944](https://github.com/manojmallick/sigmap/pull/944) blanked the lines the scanner's patterns flag, and a review before the default flipped found what that left: unquoted `api_key: …` values, JSON-style `"password": …`, `mongodb+srv://` userinfo, a token that tokenizing splits below any length rule, and the body of a PEM block. A line is blanked, not just its word, when it holds a pattern of the secret scanner (the free-text ones `sigmap redact` uses included), assigns any credential-named key (quoted or not, in JSON, YAML, `.env` or code), carries a password in the userinfo of a URL, holds a bearer or token-family value, sits inside a PEM block, is longer than 2,000 characters, or holds a 20-character run of letters and digits. The cache schema moved to 3, so an older cache is rebuilt rather than trusted. It is a filter, not a guarantee — a secret in a shape none of those names stays — and the cache is local, in `.context/`, which SigMap keeps out of git with a `.context/.gitignore` of its own ([#947](https://github.com/manojmallick/sigmap/issues/947) — `sigmap --init` was documented as doing this and never did); `retrieval.bodyWords: false` turns the words off where that is not enough.
- **An index key is not trusted.** A committed context file can name any path, so a key that is absolute, climbs out of the repository, links out of it or is not a regular file is never read.
- **Every command that ranks reads the same words.** `plan`, `evidence` and `validate --query` ranked without them while `ask`, `--query` and the MCP tool used them, so a plan could find nothing where `ask` found the file; they now take the words from one place.
- **The benchmarks read the flag.** `src/eval/runner.js` builds a repository's body words in memory when its `gen-context.config.json` or the default turns them on, so `--benchmark`, the gates and the honest benchmark measure what that repository ships and leave a pinned checkout untouched. The signal arms are flag-aware: `plain` is what ships, and the `body words` row flips the flag relative to it.
- **It is cheap to build.** On the machine this was measured on, building takes 1.7 s for Django's 2,086 indexed files and 1.5 s for Laravel's 2,618, with the line filter included, once per regeneration.

**It ships on (v8.75.0).** By the rule above the flag was eligible — +15 or better on the third-party corpus, no corpus net-negative — and flipping it was one line, `bodyWords: true` in `src/config/defaults.js`. It moved every published retrieval number, every baseline and the sense of the `body words` row of the signals table, which is the ablation now. The report above is the tree of [#944](https://github.com/manojmallick/sigmap/pull/944); re-running `npm run benchmark:body-weight-sweep` on the merged `develop` reproduced its table cell for cell, and `hard` and `mined` move with every commit.

### How far is 90%?

[#674](https://github.com/manojmallick/sigmap/issues/674) asked for the honest corpus at 90%, or a statement of why not. As shipped it reads **92.8%** (116 of 125); with the words switched off it reads 89.6% (112 of 125), one task short of 90%. That clears 90% by three tasks, on a corpus where any signal that wins one task does so, so the third-party corpus is the figure to watch: 56.7% as shipped, 37.5% without the words. Its 9 misses are the 2 that no method that matches words can win — one shares no word with its index entry, one has an answer the index leaves out by design — and 7 ranking misses, 5 of them ranked 6th–10th.

### Run it

```bash
npm run benchmark:retrieval -- --why        # why every miss of hard / mined / easy / jvm misses, one class each
npm run benchmark:retrieval -- --per-task   # each task's class and rank, one line each (what a release diffs)
npm run benchmark:xrepo -- --why            # the same for the third-party corpus
npm run benchmark:signals                   # every ranking signal against what ships on all six corpora, and record it
npm run benchmark:body-words-sweep          # the grid the body-words constants were chosen from, and record it
npm run benchmark:body-weight-sweep         # the weight and length of the body-words field, held out, and record it
node scripts/run-honest-benchmark.mjs --autopsy   # where SigMap and a whole-file grep scan disagree
```

::: warning Record the autopsy from the layout the published report uses
`npm run benchmark:honest` saves, so run the script directly for the autopsy, and save it only from a working tree whose 50 clones are real directories inside it (`cp -cR`): there the grep baseline reads 39.2% (49 of 125, at v8.80.1) and the saved report is the published one. In a checkout with symlinked clones the same scan walks a different file set for the self-repo task set and can read a different number — 41.6% when that was measured at v8.67.0, and on the v8.70.1 tree 40.0% (2.24×) against 39.2% (2.29×) in real directories — so the figure is only comparable to the published one in the layout described here.
:::

## Per-repo results

| Repo | Random hit@5 | SigMap hit@5 | Lift | Correct / Partial / Wrong |
|---|:---:|:---:|:---:|---:|
| express | 83.3% | 100% | 1.2x | 7 / 1 / 0 |
| flask | 26.3% | 62.5% | 2.4x | 5 / 0 / 3 |
| gin | 4.7% | 100% | 21.4x | 7 / 1 / 0 |
| spring-petclinic | 38.5% | 80% | 2.1x | 4 / 0 / 1 |
| rails | 0.4% | 100% | 235.8x | 3 / 2 / 0 |
| axios | 20.0% | 62.5% | 3.1x | 4 / 1 / 3 |
| rust-analyzer | 0.8% | 100% | 127.0x | 4 / 1 / 0 |
| abseil-cpp | 0.7% | 100% | 140.0x | 3 / 2 / 0 |
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

**Byte-stable includes the checkout path.** Until v8.84.0 the token budget priced each section by its *absolute* path while the heading renders the repo-relative one, so the same commit lost sections the deeper it was cloned (gin: 72 sections at a 79-character path, 55 at 255) and a file under a directory named `test` counted as a test. `node scripts/check-path-independence.mjs --repo benchmarks/repos/gin` copies a repository to checkout paths of different length, generates the map in each, and exits 1 if they disagree (only the trailing `Updated:` line may differ).
