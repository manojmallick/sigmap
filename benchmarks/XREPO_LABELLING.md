# xrepo labelling protocol

How a repository and its questions enter the xrepo corpus (`benchmarks/tasks/retrieval-xrepo.jsonl`, scored by `scripts/run-xrepo-gate.mjs`). The method is the one the first 83 tasks were made with (#892), written down so the corpus can grow to 200 tasks over 30 repositories (#984) without the method drifting. The mechanical half is enforced by `test/integration/xrepo-corpus.test.js` and `scripts/lib/xrepo-hygiene.mjs`; the rest is on the annotators.

The point of the corpus is a measurement nobody here can influence. Every rule below exists to keep a label from being shaped by the ranker it will score.

## 1. Order of work

1. **Pick the repository.** Language coverage first (Ruby and C/C++ for #975, then PHP, C#, Kotlin, Swift, Dart, frontend frameworks). A repository earns a place when it has several distinct subsystems a developer would ask about, not one dominant file.
2. **Pin it.** Add a `benchmarks/xrepo-repos.json` entry with the full 40-hex commit, the `https://github.com/<org>/<repo>.git` URL, the extractor `language` key (`src/extractors/dispatch.js`) and a descriptive `layout`. Each `language|layout` pair is one row of the guide's table, so it must be unique. If `scripts/run-benchmark.mjs` pins the same repository the commits must agree (a test checks this). Set `srcDirs` (with `srcDirsWhy`) only for a recorded detection gap; the gate measures the zero-config path.
3. **Export the pin.** Label from a clean copy of exactly that commit, never from the working clone:
   ```
   mkdir -p /tmp/label/<repo> && git -C benchmarks/repos/<repo> archive <sha> | tar -x -C /tmp/label/<repo>
   ```
   A clean export has no `.context/`, no generated instruction files and no index, and every path you cite is guaranteed to exist at the pin.
4. **First annotator** writes the questions (section 2).
5. **Second annotator** answers them (section 3).
6. **Reconcile** (section 4), record the agreement, and run the static checks.
7. **Only now** run the gate, `--save` the baseline and update the guide (section 5).

Nobody runs SigMap, the ranker, `sigmap ask` or reads a `.context/` index of a repository before step 7. A label written after seeing what the ranker returns measures the ranker against itself.

## 2. First annotator: writing a task

Read the code. Five tasks per repository is the target (the corpus test requires at least four), spread over different subsystems, with no two tasks sharing an answer set.

Each task is one JSON line:

```json
{"id":"x084","split":"hard","source":"labelled","repo":"<manifest name>","query":"...","expected_files":["path/from/repo/root"],"rationale":"...","audit":"agreed"}
```

- **query**: one natural-language sentence of at least 6 words, phrased as a developer who has not read the code would ask it, describing behaviour rather than naming it. No path, no file extension, no repository name.
- **No basename leak.** After identifier splitting and stemming, the query must share no token with the basename of any expected file (`src/eval/corpus.js` `queryLeakage`). "payments" leaks against `payment.rb`; so does "queue" against `queue.rb`. Reword with the behaviour's other vocabulary, and test the query against the filename before you keep it.
- **expected_files**: one to three distinct repo-relative, forward-slash paths. List a file only when the question cannot be answered without it. If a neighbour is arguably an answer, either rule it out in the rationale or leave it off; omitting a file can only make a hit harder.
- **What may be an answer** is decided without `src/util/file-class.js`, which misfires on real code (`history.ts` read as docs, `test_harness.lua` as a test, `core/build/` as build output). Only the unambiguous exclusions apply: a test, spec, fixture, mock, example, docs, benchmark or tooling directory; a language's own test-file naming; generated or build output; non-source files. The files must be in an answer language (`ANSWER_LANGUAGES` in `scripts/lib/xrepo-hygiene.mjs`).
- **rationale**: at least 40 characters, naming what the file does (the function or type that does it) and the neighbours you ruled out and why. A reader who has not seen the repository should be able to check the label from this alone.
- **id**: `x` plus three digits, sequential across the whole file.
- **split** is always `hard`, **source** always `labelled`.

Do not copy a phrase out of the answer's own code or comments into the query. The gate flags any 4-word run of the query that appears in the answer's index entry (`verbatim`); if it fires, reword the query and leave the files alone.

## 3. Second annotator: answering them

A different annotator, working in a fresh context with the same clean export, is given **only the questions**: no expected files, no rationales, no first annotator's notes. For each question it names the one to three files it would pick, and says nothing else. It follows the same eligibility rules as above and does not run SigMap.

Both annotators have so far been language models, so agreement bounds labelling noise and says nothing about blind spots they share. Say so wherever the figure is quoted.

## 4. Reconciling and recording

Compare the first annotator's set with the second's, per question:

| Relation | What happens | `audit` |
|---|---|---|
| Identical sets | the label stands | `agreed` |
| The first named an extra file | cut back to the shared set | `agreed` |
| The second named more | the label stays; the extra files are borderline neighbours | `partial` |
| Overlap, neither contains the other | the label is the shared set | `partial` |
| Disjoint | drop the task and write a different question; do not pick a winner | - |

Report three numbers for every batch: exact matches, tasks sharing at least one file, and disjoint tasks. Both raw sets are kept in `benchmarks/xrepo-annotations.json` so the figures can be recomputed, and `xrepo-corpus.test.js` re-derives every `audit` value from them.

Then run the static checks, which need no index and no ranker:

```
node test/integration/xrepo-corpus.test.js
```

It checks shape, answer eligibility and the basename leak for every task, and that ids are sequential. It does not look at the export, so also confirm that every expected file exists in the clean export (`existenceProblems` in `scripts/lib/xrepo-hygiene.mjs` does exactly that, given the task list and the export directory).

## 5. After the labels are final

1. `node scripts/fetch-xrepo-repos.mjs --check` confirms every clone is at its pin.
2. `node scripts/run-xrepo-gate.mjs --per-task --why` reads the new repositories for the first time. The 16 repositories that were already in the corpus must reproduce their baseline hits exactly; if one moves, stop and find out why before recording anything.
3. `node scripts/run-xrepo-gate.mjs --save` records the new baseline. Say so in the PR: a re-baseline is never silent. `--save` rewrites every entry it scored, so diff `benchmarks/xrepo-baseline.json` and keep only the entries that should have moved.
4. Update the guide (`docs-vp/guide/retrieval-benchmark.md`): the results table, the overall row, the interval, the headroom, the `--why` table and the counts in the prose. `xrepo-corpus.test.js` pins each of them to the baseline.
5. If a query is reworded after step 2 because the gate's `verbatim` check fired, record that in the PR. The files never change.

A task that turns out to be unreachable (its answer is not in the zero-config index) stays in the corpus: it is a measured product gap, not a labelling error.
