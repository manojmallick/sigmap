---
title: Benchmark overview
description: Official v8.80.1 benchmark snapshot. 95.7% average token reduction across 21 repos, 80.4% retrieval hit@5, 44.4% fewer prompts, and R language support verified.
head:
  - - meta
    - property: og:title
      content: "SigMap benchmark overview — v8.80.1 snapshot with R language"
  - - meta
    - property: og:description
      content: "Token, retrieval, quality, and task metrics from latest v8.80.1 benchmark run (2026-10-18) with 21 repositories including R language support."
  - - meta
    - property: og:url
      content: "https://sigmap.io/guide/benchmark"
---

# Benchmark overview

::: info Official v8.80.1 benchmark snapshot (21 repos, including R language)
**Benchmark ID:** sigmap-v8.80-main &nbsp;·&nbsp; **Date:** 2026-10-18

| Metric | Value |
|---|---:|
| Hit@5 (retrieval corpus, 105 tasks / 18 repos) | **80.4%** |
| Honest grep comparison (125 tasks / 19 repos) | **92.8%** vs 39.2% single-shot grep — **2.37× lift** |
| Token reduction (21 repos) | **95.7%** |
| Honest lift (vs grep agent) | **2.37×** |
| Prompt reduction | **44.4%** (2.84 → 1.6) |
| Task success proxy | **61.9%** |
| Test discovery (impl→test) | **F1 98.0%** · hit@1 97.4% (28 repos) |
| GPT-4o overflow (without → with) | **14/21 → 0/21** |
:::

This is the landing page for the public benchmark story. It answers four different questions:

| If you want to prove... | Open |
|---|---|
| SigMap reduces context size dramatically | [Token reduction](/guide/benchmark) |
| SigMap finds the right file more often | [Retrieval benchmark](/guide/retrieval-benchmark) |
| SigMap reduces retries and wrong-context answers | [Task benchmark](/guide/task-benchmark) |
| SigMap keeps large repos inside model limits | [Quality benchmark](/guide/quality-benchmark) |

## Official v8.80.1 snapshot (with R language support)

Latest saved benchmark run: **2026-10-18 (v8.80.1)**

Task selection, metric definitions, baselines, and the limits of what these tests cover are in [benchmark methodology](/guide/methodology).

::: tip Why token reduction moved 96.6% → 96.2% in v8.51.2
The Python AST extractor began running in production for the first time ([#693](https://github.com/manojmallick/sigmap/issues/693)). It was always the documented Tier-1 path — `KNOWN_LIMITATIONS.md` describes it as a native CPython AST parse when `python3` is on PATH — but nothing in the shipped pipeline passed it a file path, so Python files silently used the Tier-2 regex tier instead.

AST signatures are **richer per symbol**: they carry type annotations, return types and docstring hints. Measured on `flask`, 661 → 670 signatures at 54.4 → 63.8 characters each (+17%). The two Python-heavy repos in the corpus account for the whole delta — `fastapi` 97.8% → 89.6%, `flask` 95.6% → 94.8% — while every non-Python repo is unchanged.

We looked for waste before accepting the number. The AST tier had been emitting the implicit `self`/`cls` receiver that the regex tier has always filtered — 233 of flask's 235 methods carried it, for no information. Removing it recovered about 3% of Python signature bytes and, more importantly, made the two tiers agree on the same file. It moved the headline figure by roughly 0.1–0.2 points per repo: **the rest of the increase is type annotations, and those are the point.**

So this is a deliberate trade, not drift: more accurate Python grounding at slightly lower compression. A repo built on a machine without `python3` still gets the regex tier and its previous numbers, exactly as the limitations table has always stated.
:::

| Metric | Result |
|---|---:|
| Token reduction repos | 21 (including R: ggplot2, dplyr, shiny) |
| Retrieval benchmark repos | 18 (core languages) |
| Total tasks | 105 |
| Average token reduction (all 21) | **95.7%** |
| Retrieval hit@5 (18 core) | **80.4%** |
| Graph-boosted hit@5 | **80.4%** |
| Grep-agent baseline hit@5 (125 tasks, 19 repos) | 39.2% — **2.37× honest lift** |
| Random baseline hit@5 (data only, no longer quoted) | 13.6% |
| Prompt reduction | **44.4%** (2.84 → 1.6 prompts) |
| GPT-4o overflow repos without SigMap | **14 / 21** |
| GPT-4o monthly input savings at 10 calls/day | **$10,062.65** |

## What each benchmark proves

### 1. Token reduction (21 repositories)

- Raw source across benchmark set: **13,674,144** tokens (21 repos)
- Final SigMap output: **257,273** tokens
- Pooled reduction across the whole corpus: **98.1%**
- Average per-repo reduction — **the published figure**: **95.7%**
- **New in v6.11.1:** R language support verified
  - ggplot2: 95.1% reduction (381.5K → 18.6K tokens)
  - dplyr: 94.2% reduction (145.1K → 8.3K tokens)
  - shiny: 96.7% reduction (264.6K → 8.8K tokens)
- **New in v6.12.0:** demand-driven *Surgical Context* (`ask --mode index` + the `get_lines` MCP tool) cuts upfront `ask` context further on top of the figures above by emitting symbol pointers instead of bodies — see the [Surgical Context guide](/guide/surgical-context).
- **Line anchors (v6.13.0):** extended to JavaScript and to class methods / interface members (TS & JS), raising index-mode token reduction on real repos from ~4.6% to 32–42% (axios 43.4%, fastify 41.1%, svelte 36.8%, vue-core 32.4%).

### 2. Retrieval quality

- SigMap hit@5 (honest corpus, 125 tasks): **92.8%**
- SigMap hit@5 (retrieval corpus, 105 tasks): **80.4%** — graph-boosted **80.4%** (+0.0pp)
- Grep-agent baseline: **39.2%** (single-shot, `npm run benchmark:honest`)
- Honest lift: **2.37x** (+53.6pt vs grep; random baseline 13.6% kept as data only)

This is the best benchmark when the question is: *"Does SigMap actually put the right file in context?"*

### 3. Task outcomes

- Correct: **65 / 105** (61.9%)
- Partial: **19 / 105** (18.1%)
- Wrong: **21 / 105** (20.0%)
- Average prompts: **2.84 → 1.6**

This is the best benchmark when the question is: *"Does the developer need fewer retries to finish the job?"*

### 4. Quality and overflow

- **14/21** repos overflow GPT-4o's 128K context window without SigMap
- R repos add to overflow risk: ggplot2 and shiny both overflow without SigMap
- **5,200+** files would be hidden from the model in the raw-flow scenario
- **16,718** symbols are surfaced in SigMap output across all benchmark repos
- With SigMap: **0/21 repos overflow** — all repos fit within 128K context

This is the best benchmark when the question is: *"Why does token reduction matter operationally?"*

### 5. Test discovery (v8.7)

- Impl→test discovery scored against an **independent canonical-name gold oracle** (no LLM, pure string math)
- **F1 98.0%** · precision 97.1% · recall 98.8% · **hit@1 97.4%**
- Measured across **28 repos / 3,701** canonical impl↔test pairs
- Cross-language: `test_x.py`↔`x.py`, `x_test.go`↔`x.go`, `XTest.java`↔`X.java`, `x.spec.ts`↔`x.ts`
- Reproduce: `npm run benchmark:test-discovery`

This is the best benchmark when the question is: *"When SigMap points at a file, does it also find the tests that cover it?"*

### 6. Grounding accuracy (labelled fixtures)

- **Measured, not modelled:** `verify` and `judge` run over checked-in mini repos in seven languages, each with a `good.md` (every claim real) and a `bad.md` (planted, labelled fakes)
- Reports **precision and recall per claim kind** — file, symbol, import, imported name, npm script — plus the judge's pass/fail verdict accuracy; published as `grounding_regression` in `benchmarks/latest.json`
- No LLM, no network, no clones: two runs are byte-identical, so `npm run validate:grounding` gates it in CI against floors in `benchmarks/grounding-regression-baseline.json`
- The corpus includes cases the detectors currently get wrong (a real bare import the judge cannot clear without a `package.json`, a fake name that is a substring of a real one) — they are recorded in the floors, so a fix raises the number and a regression lowers it
- Reproduce: `npm run benchmark:grounding-regression`

The related `npm run benchmark:grounding` reports *ground-truth availability* — how many in-scope symbols the index surfaces, per repo. Its universe is the generator's own resolved scope, a repo that measures nothing fails the run instead of printing a row, and `npm run validate:grounding-coverage` gates each repo against its own recorded floor.

This is the best benchmark when the question is: *"When an AI answer cites a file, symbol or import, how often is SigMap right about whether it is real?"*

### 7. Agent-level A/B (opt-in — a live agent, your API key)

- **Measured, not modelled:** a real coding agent (Claude Code, `--bare`) answers the same labelled third-party question with and without SigMap, and the harness records what it did — **tool calls, tokens per billing category, cost, wall time, and whether the answer named the right file** (hit@5 on the paths it names, the retrieval corpora's own definition)
- Questions are the first K tasks by id per repo of the xrepo corpus, each in a throwaway copy of the pinned commit. Both arms get the byte-identical prompt, model, budget cap and read-only tools (`Read`, `Grep`, `Glob` and a `Bash` limited to `grep`/`ls`/`cat`/`head`/`tail`/`wc`); only the SigMap arm gets SigMap's generated section, the `sigmap` CLI and its MCP server
- Each run's own `init` event must match its arm, or the plan aborts before any report is written. Median over the completed runs per arm per task, arms interleaved and counterbalanced; min and max reported (the JSON adds the standard deviation); repo rows are paired per task (with fewer / tie / more). A cell with fewer than **4 completed** runs makes the report `NOT PUBLISHABLE` however many were requested — ask for more than 4 to leave room for a failed run
- Provenance on every figure (`agent-reported`, `table (as of …)`, `measured`); an unreported metric is `n/a`, not `0`; a failed run is left out of every series, but its cost is not lost — a **Spend** section counts every run, completed or not (a row per repo, each cell keeping the provenance classes apart, never a blended total); a cache category some messages omitted is unknown for that run (left out of the series, so `n=` is short), not the sum of the others
- It costs real money and is never part of the default suite or CI: `npm run benchmark:agent-ab -- --dry-run` prints the plan and the spend if every run reaches its cap (`runs × --max-budget-usd`) and starts nothing; without `ANTHROPIC_API_KEY` it explains and exits 0
- A clone under `benchmarks/repos` may be a symlink (a worktree that borrows the shared clones): it is resolved before anything is copied, so the shared clone is never reset, cleaned or written and the two arms are two directories; an arm whose `.git` is a symlink or a gitfile is refused before git can write through it. A flag that takes a value and is given none (`--runs --save`) is an error, not the default
- Reproduce: `ANTHROPIC_API_KEY=… npm run benchmark:agent-ab -- --save` (writes `benchmarks/reports/agent-ab.json` and `.md`)

No figure from it is published yet — the harness ships ready, the numbers come from a live run. Until then every tool-call, token-cost and task-success claim elsewhere on this page remains what it says it is: modelled.

This is the best benchmark when the question is: *"Does an agent with SigMap actually use fewer tool calls and tokens, and still find the right file?"*

## Open the HTML dashboard

The easiest way to inspect the latest benchmark run is the self-contained HTML report:

```bash
node scripts/run-benchmark-matrix.mjs --save --skip-clone
open benchmarks/reports/benchmark-report.html
```

That generates synchronized JSON plus a dashboard for token, retrieval, quality, and task metrics together.

## Reproduce the full benchmark set

```bash
node scripts/run-benchmark.mjs --save --skip-clone
node scripts/run-retrieval-benchmark.mjs --save
node scripts/run-quality-benchmark.mjs --save
node scripts/run-task-benchmark.mjs --save
node scripts/run-benchmark-matrix.mjs --save --skip-clone
```

Each benchmark repository is **pinned to a fixed commit** in `scripts/run-benchmark.mjs` (fetched by SHA on clone). The corpus is frozen, so retrieval and token numbers move only when SigMap's own ranking/extraction changes — not when an upstream repo does. This makes hit@5 a true release-over-release signal rather than a moving target.

The matrix run writes:

- `benchmarks/reports/token-reduction.json`
- `benchmarks/reports/retrieval.json`
- `benchmarks/reports/quality.json`
- `benchmarks/reports/task-benchmark.json`
- `benchmarks/reports/benchmark-matrix.json`
- `benchmarks/reports/benchmark-report.html`

## Benchmark resources

- **[Benchmark suite →](https://github.com/manojmallick/sigmap-benchmark-suite)** — Open-source scripts, 90 real-world coding tasks, and per-repo raw results
- **[Archived data (Zenodo) →](https://zenodo.org/records/19898842)** — Full benchmark dataset for reproducibility and independent analysis
- **[Hacker News discussion →](https://news.ycombinator.com/item?id=47956790)** — Community feedback and related work
