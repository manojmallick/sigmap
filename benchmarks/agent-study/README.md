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
| `model`, `set`, `variant` | the model; `famous`, `unfamiliar` or `change`; the SigMap setup (`index`, `prefetch`, `lean`, `current`, `skill*`) |
| `repo`, `task`, `arm`, `run` | the question, `with` or `without` SigMap, the repetition |
| `ok`, `pass` | the run finished; the expected file was among the five named (for `change`: the hidden tests passed) |
| `turns`, `calls`, `mcp`, `cli`, `skill` | model turns; tool calls; of those, SigMap MCP calls, `sigmap` CLI commands and Skill calls |
| `in`, `out`, `cacheRead`, `cacheWrite` | tokens by class |
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
| `AGENT` | `claude` | `api` talks to the Messages API directly (use it when Claude Code requests are refused for the key) |
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

`data/heldout-questions.jsonl`, `data/heldout-repos.json` (the pinned commits) and `data/heldout-build-report.txt` are the question set the
study used; `data/closed-book.heldout.*.json` is its closed-book control.

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
| `summarize.mjs --vs-placebo` | `index` and `prefetch` against the size-matched placebo, as well as against nothing |
| `retrieval-rank.mjs` | free, offline: where SigMap's own ranking puts the expected file |
| `run-change.sh` | stage 2: the change tasks, one process per task, resumable |
| `screen-change-tasks.mjs` | describes the change tasks and flags hidden tests that need names the real fix invented |
| `summarize.mjs` | every number in the study, from `data/runs.ndjson` |
| `to-runs.mjs` | turns your own runs into rows `summarize.mjs` reads |

The harness itself is `scripts/run-agent-ab.mjs` with `scripts/lib/agent-ab*.mjs`.

## Your own runs

`run-token-saving.sh` writes the harness's per-batch records under `token-saving-runs/<set>/<variant>/`. `to-runs.mjs` turns them into rows of the table above:

```bash
node benchmarks/agent-study/to-runs.mjs token-saving-runs --route api --model claude-haiku-5-5 > mine.ndjson
node benchmarks/agent-study/summarize.mjs --runs mine.ndjson
```

The harness's own reports (`agent-ab.md` in each batch folder) print the same estimators per batch.
