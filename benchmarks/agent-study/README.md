# Agent study: tools and data

The harness, scripts and saved runs behind [the agent study](../../docs-vp/guide/agent-study.md). The method is in
[the protocol](../../docs-vp/guide/agent-study-protocol.md); this file is what is in the folder and how to run it.

## The numbers, with no key

```bash
node benchmarks/agent-study/summarize.mjs                       # one row per run series, change against its own baseline
node benchmarks/agent-study/summarize.mjs --study               # the stet.sh study's columns (repetition 1 / repetition 2)
node benchmarks/agent-study/summarize.mjs --model claude-sonnet-5-5 --set unfamiliar
node benchmarks/agent-study/summarize.mjs --exclude-repos django,rails
```

`data/runs.ndjson` has one row per agent run:

| field | meaning |
|---|---|
| `series` | one invocation of the harness (route, model, question set, SigMap setup, both arms); pairs never cross series |
| `route` | `claude-code` or `api` (the Messages API directly) |
| `model`, `set`, `variant` | the model; `famous`, `unfamiliar`, `heldout`, `heldout-q` (the clean hook rounds: bare-question prompt, every run a first ask), `heldout-g` (the 67 thin-ranking questions, standard header against `hook-doubt`), `heldout-w` (the same as `heldout-q` with the benchmark's wrapped prompt: the query-focusing and guard checks; the variants `prefetch-hook`, `prefetch-hook-nofocus` and `prefetch-hook-guard`, the last being the shipped hook run after the guard was added) or `change`; the SigMap setup (`index`, `prefetch`, `prefetch-hook`, `hook-plain`, `hook-firm`, `hook-brief`, `locate`, `placebo`, `lean`, `current`, `skill*`) |
| `repo`, `task`, `arm`, `run` | the question, `with` or `without` SigMap, the repetition |
| `ok`, `pass` | the run finished; the expected file was among the five named (for `change`: the hidden tests passed) |
| `turns`, `calls`, `mcp`, `cli`, `skill` | model turns; tool calls; of those, SigMap MCP calls, `sigmap` CLI commands and Skill calls |
| `in`, `out`, `cacheRead`, `cacheWrite` | tokens by class |
| `ask` | Claude Code rows only: `first`, or `repeat` for the second run of a question in a batch, which the host serves from the prompt cache (see the results page); `summarize.mjs --ask first` reads first asks only. Every `--prompt-style question` run is a first ask |
| `hookBytes` | `prefetch-hook` runs only: bytes of context the `UserPromptSubmit` hook added to the run (0 in the baseline arm, which must have no hook) |
| `usd`, `ms`, `limit` | cost (the agent's own figure, or computed from usage for `api`); wall-clock milliseconds; the cap that stopped the run, if any |

Rows with `limit` set hit a cap (25 turns, 40 for `change`, the per-run budget or the timeout) and are scored as they stand: a miss, never a dropped pair. `change` rows also carry `files`, `added`, `removed` (the size of the patch) and `why` (which hidden tests failed).

## Running it yourself

```bash
export ANTHROPIC_API_KEY=...                  # your shell only
AGENT=api bash benchmarks/agent-study/run-token-saving.sh                          # checks, plan, worst-case spend; starts nothing
GO=1 AGENT=api MODEL=claude-haiku-5-5 RUNS=4 MAX_TOTAL_USD=25 bash benchmarks/agent-study/run-token-saving.sh
node benchmarks/agent-study/to-runs.mjs token-saving-runs --model claude-haiku-5-5 > mine.ndjson && node benchmarks/agent-study/summarize.mjs --runs mine.ndjson
```

| variable | default | |
|---|---|---|
| `AGENT` | `claude` | `api` talks to the Messages API directly (use it when Claude Code requests are refused for the key); its Grep and Glob tools run ripgrep, so `rg` must be installed |
| `SETS` | `unfamiliar famous` | which question sets |
| `VARIANTS` | `index prefetch` | which SigMap setups |
| `MODEL`, `RUNS` | `claude-haiku-5-5`, `4` | |
| `MAX_TOTAL_USD` | `25` | stop before the next batch once the recorded spend passes this |
| `KEY_CHECK` | `1` | one tiny call with the key before anything else |

The script is resumable (a finished batch is skipped).

### The controls: a placebo arm and held-out repositories

```bash
# placebo (API agent only): a size-matched block of generic search guidance instead of SigMap
GO=1 AGENT=api VARIANTS=placebo MODEL=claude-haiku-5-5 RUNS=4 bash benchmarks/agent-study/run-token-saving.sh
node benchmarks/agent-study/summarize.mjs --vs-placebo

# held-out repositories: build the question set from their git history, then run it
node scripts/build-heldout-set.mjs --out heldout --repos owner/name,owner/name --since 2026-07-01
HELDOUT_ROOT=heldout SETS=heldout GO=1 AGENT=api VARIANTS="index placebo prefetch" bash benchmarks/agent-study/run-token-saving.sh
TASKS_FILE=heldout/benchmarks/tasks/retrieval-xrepo.jsonl TAG=heldout node benchmarks/agent-study/closed-book.mjs   # what the model already knows
```

Second round (fifteen more repositories): `node scripts/select-heldout-repos.mjs --languages python,typescript,go,rust,java,javascript,ruby,php
--per-language 4 --skip <already used>` applies the repository rule from GitHub's search, and `build-heldout-set.mjs --repos lang:owner/name,...
--keep-per-language 2` builds the questions (`data/heldout2-*`). Shard a large set with `HELDOUT_REPOS=a,b`. `--sigmap-variant locate` is `index`
with the tool list cut to `query_context` and `get_lines`.

**Third round: large repositories** (16 repositories of 3,026 to 7,756 tracked files, 192 questions, `data/heldout3-*`). The first two rounds top out at
about 2,400 files, so nothing in the study says what a new-install default does on a large repository. The rule is round 2's with two changes that
`select-heldout-repos.mjs --size-kb 30000..400000` and `build-heldout-set.mjs --min-files 3000 --max-files 10000` make: a larger size window in the search,
and a check on `git ls-files` at the pinned commit. GitHub's size filter is a weak proxy for file count: of the 93 candidates the builder tried, 72 were
outside the window (71 under 3,000 files, one over 10,000), 3 failed to clone on the macOS machine that built the set, 2 had fewer than 8 qualifying
questions and 16 were kept; 36 were not tried because their language already had two. Pass 1 (36 candidates) gave only 4 usable repositories, so pass 2 applied the same rule deeper in star order and in five more
languages; that decision was made knowing file counts and no agent outcome. Nothing was chosen by hand: every repository is a candidate the rule
printed (`data/heldout3-selected-repos.txt`, with stars and merged-PR counts in `data/heldout3-selection-log.txt`), and `data/heldout3-build-report.txt` has
one line for every candidate. Rebuild it with no key:

```bash
node benchmarks/agent-study/rebuild-heldout-root.mjs --out ~/heldout3-root --pins heldout3-repos.json --questions heldout3-questions.jsonl   # about 2 GB
```

`data/heldout-questions.jsonl`, `data/heldout-repos.json` (the pinned commits) and `data/heldout-build-report.txt` are the question set the
study used; `data/closed-book.heldout.*.json` is its closed-book control.

### Repeating a run on the same held-out repositories

`build-heldout-set.mjs` reads each repository's current head, so running it again gives different questions. To repeat a run on what the study used, rebuild the data root from the saved pins (about 100 MB; network only, no key):

```bash
node benchmarks/agent-study/rebuild-heldout-root.mjs --out ~/heldout-root --exclude emilk__egui_plot   # the 20 repositories, 222 questions, of the API and hook series
# plan and cost ceiling first (starts nothing); then GO=1. ANTHROPIC_API_KEY in your shell only.
MCP_CONNECTION_NONBLOCKING=0 SETS=heldout HELDOUT_ROOT=~/heldout-root VARIANTS=locate AGENT=claude MODEL=claude-haiku-5-5 RUNS=4 MAX_TOTAL_USD=25 BUDGET=0.25 \
  OUT=~/t5-runs bash benchmarks/agent-study/run-token-saving.sh
node benchmarks/agent-study/to-runs.mjs ~/t5-runs --route claude-code --model claude-haiku-5-5 > locate.ndjson
# first asks only (run 1 of each question; runs 2-4 are served from the host's prompt cache, see `ask` above), then the bar:
node -e 'const l=require("fs").readFileSync(0,"utf8").split("\n").filter(Boolean).filter((x)=>JSON.parse(x).ask!=="repeat");process.stdout.write(l.join("\n")+"\n")' < locate.ndjson > locate-first.ndjson
node benchmarks/agent-study/confirm-bar.mjs --runs locate-first.ndjson --variant locate --set heldout   # a pre-registered bar, clause by clause
```

`confirm-bar.mjs` applies the bar written in its own source (B1 to B4) with the study's pairing, drop rule and repository-level pooling, and exits 1 if a clause is not met. `--out` must be outside this repository.

**The run this was written for is saved:** `data/confirm-locate-claude-code.ndjson` is the table of the confirmatory run of #1071 (`locate`, Claude Code, Haiku 5.5, the 20 held-out repositories, 1,776 runs, run 2026-11-18/19; the output of `to-runs.mjs`, unedited). It is kept apart from `data/runs.ndjson` so the study's counts and every figure derived from them stay as published. Anyone can re-derive its headline with no key and no network:

```bash
grep '"ask":"first"' benchmarks/agent-study/data/confirm-locate-claude-code.ndjson > first.ndjson
node benchmarks/agent-study/confirm-bar.mjs --runs first.ndjson --variant locate --set heldout   # BAR MET: cost -16.6% [-23.2, -9.7], file found 205 vs 208, uptake 96%
```

`test/integration/agent-study-confirmatory-tools.test.js` pins those numbers. They say what the bar says about this run and nothing beyond it: one model, one agent setup, 20 repositories of up to about 2,400 files, and "file found", not answer quality.

**The same test with Sonnet 5.5 (T6 of #1071) is saved too:** `data/confirm-locate-claude-code-sonnet-5-5.ndjson`, 444 runs (one per question per arm, so every run is a first ask), run 2026-11-20/21 from commit `1c85b72`, whose harness files are identical to those of the pre-registered commit; the output of `to-runs.mjs`, unedited. Run it as above with `MODEL=claude-sonnet-5-5 RUNS=1 BUDGET=0.50`; the bar reads all runs, with no first-ask filter:

```bash
node benchmarks/agent-study/confirm-bar.mjs --runs benchmarks/agent-study/data/confirm-locate-claude-code-sonnet-5-5.ndjson --variant locate --set heldout
# BAR MET: cost -8.8% [-15.5, -2.0], file found 211 vs 207, uptake 93%; 5 repositories clearly save, 15 are indeterminate, none clearly costs more
```

With Sonnet the saving is in cost, not in tokens: the SigMap arm wrote less output and fewer cache tokens but read more from cache, so its total tokens per run were 9% higher while its reported cost was 12% lower (ratio of means; a test pins the direction). Two batches were run twice because the maintainer's laptop slept mid-run (wall times of 974 to 1,520 s against a 420 s timeout); the discarded attempt gives -8.2% [-14.9, -1.7] with the bar met, so the rerun does not decide the result. If a long run times out, compare the run's wall time with the timeout first: a figure far above it means the host was asleep, not that the agent hung.

**The same test on large repositories (T7 of #1071) is saved as well:** `data/confirm-locate-claude-code-large.ndjson`, 384 runs (192 questions on the third round's 16 repositories of 3,026 to 7,756 tracked files, one run per question per arm, so every run is a first ask), Haiku 5.5, run 2026-11-21 from commit `f341c54` (the harness files are identical to `1c85b72`, the commit T5 and T6 ran from); the output of `to-runs.mjs`, unedited. It was pre-registered on #1071 before any run existed, and the bar is the same B1 to B4.

```bash
node benchmarks/agent-study/confirm-bar.mjs --runs benchmarks/agent-study/data/confirm-locate-claude-code-large.ndjson --variant locate --set heldout
# BAR MET: cost -18.5% [-22.5, -14.3], file found 167 vs 175, uptake 96%; 11 repositories clearly save, 5 are indeterminate, none clearly costs more
```

What the bar's reading hides: B3 is read on the point estimate, and it passes by 0.8 points (-4.2 against a limit of -5): 13 questions were found only without SigMap and 5 only with it, and an interval from resampling repositories is [-7.8, -1.0] (computed afterwards, not part of the bar), so a loss of more than 5 points is not excluded. Here cost and tokens fell together (about -20% each, against Sonnet's +9% tokens and -12% cost in T6). The rank correlation of cost change with file count is, post hoc, +0.36 over these 16 repositories (3,026 to 7,756 files), -0.48 over T5's 20 (31 to 2,388) and -0.19 [-0.50, 0.16] over all 36: no trend with size in either direction. Two runs of one repository took 376 and 381 s against the 420 s timeout and completed. It says nothing beyond one model, `locate` only, `--bare` with an API key, 16 repositories of up to 7,756 files in eight languages (no Python or JavaScript qualified), and "file found", not answer quality.

Three things the first live attempts taught, so they need not be learned again:

- **`PROMPT_STYLE=question` does not work for `locate`.** The harness refuses it (`scripts/lib/agent-ab-claude.mjs`): the SigMap arm of a variant that is neither a hook nor prefetch needs the system-prompt slot the style also uses. Leave `PROMPT_STYLE` unset, which is why runs 2-4 of a question are `repeat` asks and the bar above is read on first asks.
- **Set `MCP_CONNECTION_NONBLOCKING=0`.** Claude Code 2.1.178 does not wait for the MCP server before its first model request by default, so a SigMap arm can begin with no SigMap tool (its init event says the server is `pending`). With the variable set the CLI waits for it.
- **A server that is still `pending` anyway is repeated, up to 3 times.** It happened once in 93 SigMap-arm launches with the variable set (45 in a probe, 48 in the first batch). The run is discarded and the same job is run again (read from the init event alone, before the agent has done anything, so it cannot select on the outcome); each repeat prints a `RETRY` line with the discarded run's cost, and the kept record carries `startupRetries` in `raw.json`. A server that is absent or `failed`, a forbidden tool, or any fault in the baseline arm is still fatal, and a failed batch still records nothing.

A batch is one repository (96 runs with 12 questions and 4 repetitions, about 15 minutes), so a crash or Ctrl-C loses the batch in progress; rerunning resumes from the finished ones.

### Change tasks (stage 2)

```bash
node scripts/build-change-tasks.mjs --out change-root --max 16                      # needs git history and `gh` (or a cached issues/ folder)
node benchmarks/agent-study/screen-change-tasks.mjs change-root --skip c08,c10     # describe the tasks and flag tests that need invented names
DATA=change-root bash benchmarks/agent-study/run-change.sh                         # plan and worst-case spend; GO=1 ANTHROPIC_API_KEY=... runs it
node benchmarks/agent-study/to-runs.mjs raw/change/claude-haiku-5-5/index --variant index --model claude-haiku-5-5 > change.ndjson
node benchmarks/agent-study/summarize.mjs --runs change.ndjson --tasks c04,c05,c06,c09
```

`data/change-tasks.json` describes the nine tasks that ran and the two left out; `data/change-excluded.txt` is why each other fix commit
was not made a task. The famous set needs the eight pinned checkouts (`npm run fetch:xrepo`); the
unfamiliar set is built from this checkout (`make-unfamiliar-root.mjs`).

## Files

| file | what it does |
|---|---|
| `run-token-saving.sh` | the whole measurement under your key, with the checks, the plan and the spend limit |
| `run-remaining.sh` | one batch of questions per invocation, resumable; what the script above calls |
| `make-unfamiliar-root.mjs` | builds the sanitised data root of this repository's own source with its hard questions |
| `closed-book.mjs` | the control: the same questions with no repository and no tools |
| `summarize.mjs --by-repo [--per-repo]` | repository level: how many repositories save, a pooled estimate that resamples repositories, and the pre-set bar |
| `summarize.mjs --versus locate:index` | one setup directly against another, on the same questions and repetitions |
| `summarize.mjs --versus a:b --adjusted` | the same, each series' change against its own baseline, so a dearer or cheaper hour cancels |
| `summarize.mjs --versus a:b --adjusted --found-did` | also the difference of the two series' file-found changes, with an interval that resamples questions |
| `summarize.mjs --ask first` | Claude Code rows only: a question's first ask, without the repeats the host serves from the prompt cache |
| `run-hook-study.sh` | the hook rounds: eight repositories, 87 questions, one delivery of the ranking at a time on a logged-in Claude Code session (`PROMPT_STYLE=question` for the clean design) |
| `query-focus-eval.mjs` | offline, no model call: 222 held-out questions inside thirteen kinds of wrapper, ranked by the real `sigmap ask` raw and after the hook's query focusing; the result of record is `data/query-focus-eval.txt` |
| `guard-eval.mjs` | offline, no model call: how well four signals predict that the hook's ranking is wrong, the leave-one-repository-out threshold selection, and the shipped readability guard's counterfactual on the agent runs; the result of record is `data/guard-eval.txt` |
| `trace-analysis.mjs` | what the agent does first, from the ordered tool calls the harness records: first call, whether it read a ranked file, calls before that |
| `hooks/prototype-hook.cjs` | the prototype deliveries of the prefetch hook (plain stdout, a firmer header, a shorter block) and the doubtful header of Stage G; none shipped |
| `summarize.mjs --vs-placebo` | `index` and `prefetch` against the size-matched placebo, as well as against nothing |
| `retrieval-rank.mjs` | free, offline: where SigMap's own ranking puts the expected file |
| `run-change.sh` | stage 2: the change tasks, one process per task, resumable |
| `screen-change-tasks.mjs` | describes the change tasks and flags hidden tests that need names the real fix invented (`build-change-tasks.mjs` now applies the same screen, from `scripts/lib/change-task-screen.mjs`, as a rule and never keeps such a task) |
| `summarize.mjs` | every number in the study, from `data/runs.ndjson` |
| `to-runs.mjs` | turns your own runs into rows `summarize.mjs` reads |

The harness itself is `scripts/run-agent-ab.mjs` with `scripts/lib/agent-ab*.mjs`.

Tests, offline with no key: `test/integration/agent-ab.test.js`, `agent-ab-change.test.js` (the harness), `prefetch-hook.test.js` (the shipped hook) and
`bare-files.test.js` (path-only index entries and the PHP extractor). The list, what each covers and the gates that decided Stage H are in the
[protocol](../../docs-vp/guide/agent-study-protocol.md#tests).

## Your own runs

`run-token-saving.sh` writes the harness's per-batch records under `token-saving-runs/<set>/<variant>/`. `to-runs.mjs` turns them into rows of the table above:

```bash
node benchmarks/agent-study/to-runs.mjs token-saving-runs --route api --model claude-haiku-5-5 > mine.ndjson
node benchmarks/agent-study/summarize.mjs --runs mine.ndjson
```

The harness's own reports (`agent-ab.md` in each batch folder) print the same estimators per batch.
