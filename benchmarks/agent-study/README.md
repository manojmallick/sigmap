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
| `screen-change-tasks.mjs` | describes the change tasks and flags hidden tests that need names the real fix invented |
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
