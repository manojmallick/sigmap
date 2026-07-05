# SigMap public benchmark harness

A self-contained, third-party-runnable harness that reproduces SigMap's **retrieval** numbers (hit@1 / hit@5 / MRR) from a clean checkout. No LLM, no API keys, no external dependencies — only `git` and Node.js 18+.

> Determinism is the whole pitch, so the benchmark is deterministic too: pinned
> repos at exact commits, a byte-stable signature map, and pure rank math. The
> same inputs produce the same numbers on any machine.

## Run it

```bash
cd public-benchmarks
./run.sh                 # clone pinned repos (shallow) + score
./run.sh --json          # also write results.json
./run.sh --skip-clone    # reuse repos already in ./.repos
```

Or score repos you have already cloned:

```bash
node score.mjs --skip-run --repos-dir ./.repos   # score existing gen-context output
```

## What it measures

For each repo in [`repos.csv`](repos.csv) the harness:

1. **Clones** the repo at its pinned commit into `./.repos/<name>` (shallow).
2. **Maps** it with `../gen-context.js`, constrained to the repo's `srcDirs`
   (the last CSV column) so tests/docs/build dirs don't pollute the index.
3. **Parses** the generated `.github/copilot-instructions.md` into a
   `file → signatures` index.
4. **Ranks** every query in [`queries.json`](queries.json) against that index
   using SigMap's shipped identifier-aware BM25 ranker (`src/retrieval/bm25.js`)
   — the exact ranker the product ships, not a benchmark-only copy.
5. **Scores** each query by the rank of the first expected file:
   - **hit@1** — expected file is the top result
   - **hit@5** — expected file is in the top 5
   - **MRR** — mean reciprocal rank (`1 / firstRank`)

Aggregates are micro-averaged over all queries.

## The data

| File | Contents |
|---|---|
| [`repos.csv`](repos.csv) | 18 real-world repos: `repo,url,commit,srcDirs` (srcDirs `;`-separated), pinned to exact commits for reproducibility |
| [`queries.json`](queries.json) | 90 queries: `{ repo: [{ id, query, expected_files }] }` — natural-language task → the file(s) that answer it |
| `results.json` | written by `--json`: `{ aggregate, perRepo }` |

The queries are the same task set used by the in-repo retrieval benchmark
(`scripts/run-retrieval-benchmark.mjs`); this harness packages them so anyone
can reproduce the numbers without the rest of the dev tooling.

## Honesty notes

- **Retrieval only.** This harness scores file retrieval (hit@k / MRR). It does
  not call an LLM and does not measure task-success or token-reduction — those
  have their own runners under `scripts/`.
- **Pinned, not frozen.** If a pinned commit is ever unreachable, `run.sh` falls
  back to the default branch and prints a drift warning; numbers from a drifted
  clone are not comparable to the published set.
- **No invented numbers.** Publish only what this harness (or the `scripts/`
  runners) actually produced — never a hand-typed metric.
