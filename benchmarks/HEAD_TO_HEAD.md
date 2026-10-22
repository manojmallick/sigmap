# Head-to-head: SigMap, codebase-memory-mcp and code-review-graph (#972)

SigMap's comparison page characterises other tools from their READMEs. This harness **measures** two of them on the
same questions SigMap's third-party gate uses, with one scorer, so that a third party can rerun it and get the same
tables. The published run is on the enlarged corpus (#984, plan step 15). What exists today is the harness and an
**exploratory** mode whose numbers are read once, for Gate G1, and not published.

```
node scripts/run-head-to-head.mjs --exploratory --out <dir outside benchmarks/> [--root <data root>]
                                  [--tasks 1-83] [--only gin,flask] [--tools codebase-memory-mcp,code-review-graph] [--force]
```

## What is run

For every task of `benchmarks/tasks/retrieval-xrepo.jsonl` (human-labelled, blind and double-annotated; the exploratory
run uses the original tasks x001-x083) on the pinned clones of `benchmarks/xrepo-repos.json`:

| system | how it is asked | version |
|---|---|---|
| SigMap | the xrepo gate's own zero-config index and ranker (`src/eval/runner`), the same question text | this tree |
| codebase-memory-mcp | `cli index_repository --repo-path <copy>` (its default `full` mode: all files plus semantic), then `cli search_graph` in three arms: `--query` (BM25), `--semantic-query` with the whole question, `--semantic-query` with the question's significant words as separate entries | 0.12.1, `benchmarks/rivals.json` |
| code-review-graph | `build` in the copy, then `search "<question>"` (JSON). No embedding extra is installed, so its search mode is FTS; the report records the mode the tool says it used | 2.3.9, `benchmarks/rivals.json` |

A rival indexes a **throwaway, pristine copy** of the clone (`git clean -fdx` and a checkout, so none of SigMap's own
output is in what it sees). Nothing is written in the clone itself.

## One scorer

Every system is reduced to an ordered list of repository-relative files per task and scored by the same two functions
(`scripts/lib/head-to-head.mjs`):

- **hit@5**: an expected file is among the first five files;
- **MRR@10**: 1 / the rank of the first expected file, 0 beyond rank ten.

Rivals answer in nodes (functions, classes, methods), not files. A result counts as its file, files keep the order of
their first result, and a path is made relative to the repository. Intervals are Wilson 95% (`scripts/lib/band.mjs`).

## Ambiguities are resolved in the rival's favour, and counted

1. A rival path that ends with an expected path, or the other way round, counts as the file (monorepo prefixes). The
   report says on how many tasks that decided the answer (`summary.ambiguous`).
2. Each arm is scored on its own. `best` takes, per task, the most favourable arm: an upper bound no user could reach
   without knowing the answer, labelled as such.
3. `+src` variants of every arm leave out test, mock and generated files (`src/util/file-class.js`). SigMap's own ranker
   demotes them; the rivals do not, and the expected answers are source files. The variants show what a rival scores if
   its test-file hits are ignored.
4. A task whose expected files the rival has no node for (its graph holds nothing of them) is **unsupported** for it. It
   is reported apart and never counted as a miss in the both-indexed table. In the all-tasks table it counts as a miss,
   and the table says so.
5. A rival that cannot index a repository, or times out (indexing 30 minutes, one query 3 minutes), is recorded under
   `errors` and its tasks as unsupported. They are not misses.

## Gate G1

Pre-registered in #972 and the plan before any rival number was read. On the tasks both tools can index (SigMap's index
reaches an expected file and the rival has nodes for one):

- if the best rival arm leads SigMap by **more than 10 points hit@5**, run #985 (reranker spike) before #976;
- if the rival's wins concentrate in repos whose language the import graph cannot read (`laravel`, `serilog`, `riverpod`,
  `alamofire`, `plenary`, `godot-demo-projects`), run #980 (import resolvers) before #976;
- otherwise keep the order in #978 and treat #985 as optional.

"Concentrate" is operationalised, before the run, as at least half of the rival-only wins. The maintainer confirms any
re-ordering; the decision rules are not significance claims (83 tasks cannot support one).

## Isolation: never a dependency

- Nothing here is installed by `npm install` and nothing ships in the npm package; `test/integration/head-to-head.test.js`
  fails if a rival appears in `package.json` or if `benchmarks/` is in the package `files`.
- Artifacts are downloaded to `benchmarks/rivals/` (or `$SIGMAP_RIVALS_DIR`), a directory that ignores itself.
- **Checked before they are run.** A binary is used only if its SHA-256 equals the one pinned in `benchmarks/rivals.json`
  *and* the release's own `checksums.txt`; the codebase-memory-mcp build also carries SLSA provenance
  (`gh attestation verify <artifact> --repo DeusData/codebase-memory-mcp`). The code-review-graph wheel is checked against
  its pinned hash before it is installed; its dependencies resolve from PyPI as pip always does, and the resolved set
  (`pip freeze`) is written to the report.
- Every rival runs with a **scratch `HOME`** and a minimal environment, so no agent configuration of yours is read or written.
  (`--skip-config` is the option of codebase-memory-mcp's installer, which this harness never runs: it runs the binary itself.)
- A pin that does not match fails closed: the run stops and nothing is left behind that a later run would use.

## What is recorded per tool

Install time, index time and index size per repository, tokens returned per query (characters / 4, as everywhere in
SigMap), the version, the SHA-256 of what ran, and the README the claims about it were read from (commit-pinned and
dated). These feed the speed and install rows of the gap analysis.

## Reproduce

Python 3.10 or newer is needed for code-review-graph (`SIGMAP_RIVALS_PYTHON=python3.11` to choose one). On a platform
without a pinned codebase-memory-mcp artifact the harness stops and says which platforms are pinned (darwin-arm64,
darwin-x64, linux-x64, linux-arm64).

```
node scripts/fetch-xrepo-repos.mjs                       # the pinned clones
node scripts/run-head-to-head.mjs --exploratory --out /tmp/h2h
```

The raw answers of each repository are kept in `<out>/raw/<repo>.json`, so a rerun resumes and scoring can be redone
without asking the tools again.
