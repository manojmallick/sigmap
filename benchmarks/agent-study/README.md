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
| `model`, `set`, `variant` | the model; `famous` or `unfamiliar`; the SigMap setup (`index`, `prefetch`, `lean`, `current`, `skill*`) |
| `repo`, `task`, `arm`, `run` | the question, `with` or `without` SigMap, the repetition |
| `ok`, `pass` | the run finished; the expected file was among the five named |
| `turns`, `calls`, `mcp`, `cli`, `skill` | model turns; tool calls; of those, SigMap MCP calls, `sigmap` CLI commands and Skill calls |
| `in`, `out`, `cacheRead`, `cacheWrite` | tokens by class |
| `usd`, `ms`, `limit` | cost (the agent's own figure, or computed from usage for `api`); wall-clock milliseconds; the cap that stopped the run, if any |

Rows with `limit` set hit the 25-turn cap and are scored as a miss.

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

The script is resumable (a finished batch is skipped). The famous set needs the eight pinned checkouts (`npm run fetch:xrepo`); the
unfamiliar set is built from this checkout (`make-unfamiliar-root.mjs`).

## Files

| file | what it does |
|---|---|
| `run-token-saving.sh` | the whole measurement under your key, with the checks, the plan and the spend limit |
| `run-remaining.sh` | one batch of questions per invocation, resumable; what the script above calls |
| `make-unfamiliar-root.mjs` | builds the sanitised data root of this repository's own source with its hard questions |
| `closed-book.mjs` | the control: the same questions with no repository and no tools |
| `retrieval-rank.mjs` | free, offline: where SigMap's own ranking puts the expected file |
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
