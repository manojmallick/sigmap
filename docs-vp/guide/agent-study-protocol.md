# Agent study: protocol

The plan behind [the agent study](/guide/agent-study), written so that someone else can check it, repeat it on their own repository and
disagree with it. It follows the method of the stet.sh article *"I Tested Six Ways to Save $$$ on 5.6 Sol"* (a baseline against
treatments, every arm repeated, a recorded-workload estimate beside a paired typical-task estimate, an interval on every claim) and says
where it differs from it and why.

## The question

> When an AI coding agent works on a repository with SigMap set up the way the docs recommend, does it use fewer tokens, less money and
> less time than the same agent without SigMap, and does it still get the answer?

Two parts of that question are easy to get wrong, so they are fixed here before any run:

- **"Saves" is not "the answer is smaller".** The bill is for the whole trajectory. A tool that shortens one result and makes the agent run
  twice as many commands costs more, which is what the article found for most of the tools it tested. Every figure below is for a *whole
  run*: all turns, all tool results, all output.
- **"The answer" has to be checked.** A saving that comes with a lower hit rate is a cost, not a saving.

## What counts as a result

For one agent, model, question set and SigMap setup, the setup **saves** only if all of these hold:

1. the typical-task change in real cost has a 95% interval entirely below zero, in the pooled runs **and** in each repetition on its own;
2. the same for total tokens or, where tokens rise and cost falls, the cost is explained (see *Reading tokens and cost* below);
3. the file was found in at least as many runs as without SigMap, to within what a binomial count of that size can show.

A setup that fails (1) is reported as "inside the noise", not as "no effect". With 30 to 45 questions and 2 to 4 repetitions the study
can see a change of about 10% in the typical task and cannot see a smaller one.

## Design

| | |
|---|---|
| **Arms** | *without*: no SigMap. *with*: one SigMap setup. Both arms get the same prompt, the same model, the same tools, the same budget cap, and a clean copy of the repository at a pinned commit. |
| **SigMap setups** | `index` (the documented setup: `strategy: "index"`, the 7-tool `core` MCP profile, the section SigMap itself writes), `prefetch` (SigMap ranks the question before the first turn and the five files, with signatures and `:start-end` anchors, are put after the question; what a prompt hook would do), `lean`, `current` (the old default), and skills (`skill`, `skill-always`, `skill-shipped`). |
| **Pairing** | Each question is run in both arms, in alternating order (without→with, then with→without), so cache warmth and drift fall on both. Pairs are formed by repository, question and repetition. A pair with a failed run is dropped and counted; a run stopped by the turn cap is a scored miss at the cost it incurred, never a dropped pair. |
| **Repetitions** | 4 per arm for the cheapest model, 2 for the others. Repetitions measure consistency; they are not independent questions. |
| **Estimators** | The article's two: *whole batch* (total of one arm over total of the other, closest to the real bill, dominated by large runs) and *typical task* (the geometric mean of the per-pair ratios, every question weighs the same), with a seeded 10,000-resample paired bootstrap for the interval. `scripts/lib/agent-ab-stats.mjs`. |
| **Metrics** | Real cost; total tokens (input, output, cache read, cache write, summed unweighted, so a cache read counts like a fresh token and cost is the priced view); tool calls; wall-clock seconds; whether the expected file is among the five files named (hit@5). |

### Arm hygiene

The two arms must differ in **nothing the agent can find by searching** except the thing under test. This is checked on every repository
before the first paid run (`assertArmHygiene`), because the first version of this study failed it: SigMap's generated `CLAUDE.md`
(and `AGENTS.md`, `.github/copilot-instructions.md`) was left in the SigMap arm's checkout, and wherever a repository's `.gitignore` did not
name those files the agent's own `grep` found a complete signature map in them, a second channel for the treatment. The results that
depended on it were discarded and re-run; the numbers on [the results page](/guide/agent-study) are from the clean runs. The only
allowed differences now are the harness's `gen-context.config.json` and, for a skill setup, the skill files.

Each run also reports the tools and servers it actually had, and the run is thrown away (and the whole plan stops) if the no-SigMap arm
holds a SigMap server or the SigMap arm does not hold its own.

## Question sets

| Set | What | Why |
|---|---|---|
| **famous** | 45 labelled questions about 8 well-known frameworks (gin, flask, express, fastify, fastapi, django, rails, laravel), pinned commits, from the retrieval corpus (`benchmarks/tasks/retrieval-xrepo.jsonl`). The first questions of each repository, fixed before any result. | Realistic and varied, but the model has read these repositories. |
| **unfamiliar** | The first 30 of the repository's own hard retrieval questions, about SigMap's own source, in a sanitised clone (answer keys and generated agent context removed). | The model cannot answer them from memory. |

The **closed-book control** asks each question with no repository and no tools. If the model already names the right file for most
questions, a retrieval tool has little to add on them, and the study says so rather than averaging it away: Haiku 5.5 names the expected
file for 40 of the 45 famous questions and for none of the 30 unfamiliar ones.

## Agents

- **Claude Code**, headless, under the isolation of `--setting-sources project`, on the account's own login. The key route was not usable:
  see *What went wrong along the way*.
- **The Messages API directly**, with a small agent loop (`scripts/lib/agent-ab-api.mjs`): a ~150-token system prompt and four read-only
  tools (about 0.9k tokens with the tool definitions) (Read, Grep and Glob through ripgrep, a Bash limited to a few read-only commands with no shell), prompt caching, a 25-turn cap.
  This is **not** Claude Code. Its fixed prefix is about 0.9k tokens where Claude Code's is about 12k, so it shows what SigMap does for a
  lean agent. The two are never mixed in one table.

Models: Claude Haiku 5.5, Haiku 4.5 and Sonnet 5.5.

## Reading tokens and cost

Tokens and cost can move in opposite directions. Under prompt caching a token that is *re-read* costs a tenth of a fresh one and a token
that is *written* to the cache costs 1.25 times, so what matters is the mix. In the lean-agent runs SigMap's static prefix is written once
and read cheaply afterwards, while the baseline writes every grep result into the cache as it arrives: total tokens can stay flat while
cost falls by a third. That is why every table carries both. Cost for the Claude Code route is the agent's own reported figure; for the
Messages API route it is computed from the usage the API returns and a price table (the output price of Sonnet 5.5 is assumed to be five
times the input price; percentages between arms do not depend on it).

## What this study cannot show

- **Only "find the file".** The tasks ask the agent to name the files that implement something, and the answer is checked against a
  label. The article's tasks were merged changes whose patches were graded on tests, equivalence and review. Whether SigMap changes the
  quality of a *patch* is not measured here. See *Stage 2*.
- **One repository for the unfamiliar set**, and it is SigMap's own, which its ranker was tuned on.
- **Two kinds of agent, three models**, all Claude. Other agents and other vendors' models are not tested.
- **Small samples.** The intervals are wide where they are wide; "inside the noise" means exactly that.
- **No quality grading beyond hit@5.** There is no review of the explanation the agent writes.

## Stage 2: change tasks (the article's task type)

To test the claim the article actually tests, Stage 2 replays **merged bug fixes** from the repository's history after the models'
knowledge cutoff, with the fix's tests hidden from the agent:

1. **Pool**: commits since 2026-07-01 that change source under `src/` (and, where needed, the bundled `gen-context.js`) and add or change
   a test, remove or rename no source file, whose message closes an issue; one task per issue; not a feature request; hidden tests under
   25 KB; and the tests must not name a file the fix creates. The rule is mechanical (`scripts/build-change-tasks.mjs`) and was fixed
   before any agent ran; 31 fix commits were examined and the reason for each one left out is in `data/change-excluded.txt`.
2. **Task text**: the issue's title and first paragraph, with every path and file name of the real fix redacted. The location is the
   thing SigMap claims to find, so it is not handed over.
3. **Validity**: a task is kept only if the hidden tests fail on the parent commit (with an assertion, not a missing module) and pass
   with the real fix applied, twice, each under the time limit.
4. **Grading**: the agent's patch is applied to a pristine copy of the parent commit, the hidden test files are put on top (overwriting
   anything the agent did to them), and the tests are run with no API key in the environment. Pass or fail, plus the size of the patch.
   No LLM grader is used in this stage.
5. **Same arms, estimators and hygiene checks** as above, with the agent allowed to edit files (`Edit`, `Write`) and run the repository's
   tests (`RunTest`, under `test/` only), a fresh checkout for every run, a 40-turn cap, and a run stopped by a cap or a timeout graded
   on what it had left.

**Two decisions made after the pool was built and before any agent ran:** two of the eleven tasks (#900, #943) are umbrella issues whose
text does not say what their tests check, and were left out (they are listed in `data/change-tasks.json` as not run). Nine tasks remain.

**Status: run, and it did not work as a test of patch quality.** After the first Haiku 5.5 runs, `screen-change-tasks.mjs` was written to
check one more validity condition, which the rule above lacks: a hidden test that takes a name out of a module that does not exist before
the fix cannot pass unless the fix invents it. Five of the nine tasks fail that screen. The nine tasks were still run as planned and
reported as a whole; the screen is a diagnostic added afterwards, and any cut by it is exploratory. The results are on
[the results page](/guide/agent-study#change-tasks).

## Two controls added after the first results

The first results had two weaknesses, both found by reading them rather than by anyone outside. **The unfamiliar set is one repository, and
it is SigMap's own**, which its ranker was tuned on. And **on the famous questions the API agent saved cost while almost never calling
SigMap** (2 of 90 Sonnet runs), so part of that saving might be having a short block of text in the prompt, not the index. The rules for
both controls were written before any result of either was read.

### Control 1: a placebo arm

`--sigmap-variant placebo` (API agent only) gives the SigMap arm's system prompt a block of **generic code-search guidance** (about
7,000 characters, `scripts/lib/agent-ab-placebo.mjs`) and nothing else: no SigMap, no repository information, no extra tool, nothing
changed in the checkout. It is a *strong* placebo on purpose: it carries the same kind of behavioural advice the SigMap section does
(search with distinctive words, read only the region you need, stop when you have the definition and one more signal).

**Size.** Measured with the API's token counter on the exact request each arm sends: the `index` setup adds **2,266 tokens to every
turn** (761 for the section, 1,505 for the seven `core` tool definitions); the placebo adds **2,170**.

**Runs.** The same two question sets as before (30 unfamiliar, 45 famous), Haiku 5.5 with 4 repetitions and Sonnet 5.5 with 2, each
against its own no-SigMap baseline, and `index` compared with the placebo directly on the same questions and repetitions
(`summarize.mjs --vs-placebo`).

**Decision rule.** For each model and question set, on the typical-task cost of `index` against `placebo`:
- *the interval is entirely below zero in the pooled runs and the point estimate is below zero in each repetition*: the index does
  something the prompt text alone does not, and the saving can be attributed to SigMap;
- *the interval includes zero*: the data cannot tell SigMap from the guidance, and the part of any saving that the placebo also shows is
  not attributed to SigMap;
- *the interval is entirely above zero*: the placebo is cheaper than SigMap.

### Control 2: held-out repositories

Five repositories SigMap was never tuned on, in five languages, with questions taken from the maintainers' own merged changes.

**Repositories (fixed by rule, not by looking at them).** From GitHub's repository search: not a fork, not archived, pushed since
2026-10-15, created before 2026, 100 to 500 stars, 0.8 to 10 MB. Taking each language in turn (Python, TypeScript, Go, Rust, Java), the
first repository in star order whose description is not a list or a template and which has at least 15 merged pull requests since
2026-07-01. That gave `stefankoegl/python-json-patch`, `statelyai/agent`, `ionos-cloud/cluster-api-provider-proxmox`,
`timescale/timescaledb-toolkit` and, for Java, `flamingock/flamingock-java` (the first Java repository in the order,
`jenkinsci/docker-plugin`, had too few usable questions and was replaced by the next).

**Questions.** `scripts/build-heldout-set.mjs` reads each repository's git history since 2026-07-01 and keeps a first-parent commit when its
title (cleaned of the pull-request number and the conventional-commit type) is 25 to 160 characters and at least four words, is not about
lint, formatting, tests, docs, refactoring, renames or CI, the author is not a bot, the commit changes one to three source files
(not tests, fixtures, examples, demos, docs, config, generated or minified code), every one of them still exists at the pinned commit, and the
title does not name any of them. The oldest qualifying commits are taken, up to 12 per repository, and a repository with fewer than 8 is left
out. The label is the source files the commit changed; the question is its title. Two filters were added after a first build showed
questions that were test-only or about tooling, and before any agent ran; no question was edited by hand. 55 questions came out, and some
labels are noisy (a commit's files are not always the only place a behaviour lives): that cost lands on both arms.

**Closed-book control.** The same questions with no repository and no tools. Haiku 5.5 names an expected file for 16 of 55 (29%) and
Sonnet 5.5 for 27 of 55 (49%): from 0 of 11 (flamingock-java) to 6 of 12 (python-json-patch, a one-module library whose main file is easy
to guess) for Haiku 5.5, and up to 10 of 11 (timescaledb-toolkit) for Sonnet 5.5. The pooled set is the headline; the repositories with a
closed-book rate of 30% or less for the model under test are reported separately as the cleaner cut (for both models: `statelyai/agent`
and `flamingock-java`).

**Runs.** `index`, `prefetch` and `placebo`, each against its own baseline, for Haiku 5.5 with 4 repetitions; `index` and `placebo` for
Sonnet 5.5 with 2 (`prefetch` was left out there to keep the spend down). The same "saves" rule as above. Results are on
[the results page](/guide/agent-study#is-it-sigmap-or-just-text-in-the-prompt).

## Second round: more repositories, and a smaller tool list

The held-out result (five repositories, one of which carried the saving) leaves the question open at the level that matters: **across
repositories, how often does SigMap save?** And it showed where the cost sits: `index` adds 2,266 tokens to every turn, 1,197 of them tool
definitions, while agents called only two of the seven tools. Both are tested next, with the rules written before any run.

### Experiment A: about twenty repositories

**Repositories.** The rule of the first held-out round, continued down the same list: for each of Python, TypeScript, Go, Rust and Java the
next two repositories in star order that qualify (at least 15 merged pull requests since 2026-07-01, a non-list description, at least 8
usable questions), and for JavaScript, Ruby and PHP the first two. The five repositories of the first round stay as they are, on their
existing runs. `scripts/select-heldout-repos.mjs` applies the rule and `scripts/build-heldout-set.mjs` builds the questions, unchanged.

**Runs.** `index`, `prefetch` and `locate` (below), each against its own no-SigMap baseline, Haiku 5.5, 4 repetitions.

**Unit and estimate.** The repository. For each repository the typical-task change in real cost of a setup against its baseline; the
repository is classed *saves* when its 95% interval is entirely below zero, *costs more* when entirely above, *no clear change* otherwise.
The pooled estimate is the geometric mean of the per-repository ratios, with a 95% interval from resampling repositories (10,000 times,
seed 1), so a large repository cannot stand in for several small ones.

**Bar for "saves reliably".** All three, for one setup: the pooled repository-level interval entirely below zero; at least half of the
repositories *save* and at most 15% *cost more*; and the file found in at least as many runs as without SigMap, to within 2 percentage
points over all runs. Anything short of that is reported as what it is, with the number that failed.

### Experiment B: `locate`, a two-tool profile

`--sigmap-variant locate` is `index` with the tool list cut to `query_context` and `get_lines` (`mcp.tools: ["query_context",
"get_lines"]`, a setting that already exists), the two tools the agents used. Same section, same index. It drops about 860 of the 1,197
tokens of tool definitions. It is a probe for locate questions only: the tools it drops (`get_impact`, `verify_suggestion` and others) are
for editing and checking, which these questions do not exercise, so a saving here says nothing about their value.

**Runs.** On the five repositories of the first round (existing `index` runs are the comparison): Haiku 5.5 with 4 repetitions and
Sonnet 5.5 with 2; and on every repository of Experiment A for Haiku 5.5.

**Decision rule.** `locate` against `index`, paired on the same questions and repetitions: cost interval entirely below zero in the pooled
runs and every repetition pointing the same way means the smaller tool list helps; an interval that includes zero means it does not
matter at this size; entirely above zero means it hurts.

**What was run.** The selector produced up to six candidates per language (`data/heldout2-selected-repos.txt`); the builder kept the first two
usable repositories per language (`data/heldout2-build-report.txt` says why the others were not), 16 repositories and 175 questions, of which
`emilk/egui_plot` (8 questions) was refused by the harness before any run. Haiku 5.5, 4 repetitions, `index`, `prefetch` and `locate`:
4,008 runs, none failed. `locate` was also run on the first five repositories (Haiku 5.5, 4 repetitions; Sonnet 5.5, 2). Results: the results
page, "Twenty repositories, and a two-tool tool list".

## What went wrong along the way

Recorded because a study that hides its errors is not worth reading.

- **A relay's numbers described a different agent** (about 10 tool calls a run against 3), and its multiplier made costs unreadable. Those
  runs are not carried forward.
- **The generated files in the SigMap arm** (above). Found by listing what each arm's search could see; fixed in the harness with a
  permanent check; affected runs re-run.
- **An API key that plain calls accepted but Claude Code requests were refused for** ("credit balance is too low"), with two different
  keys. That is why the Messages API route exists.
- **A turn cap recorded as a failure** dropped exactly the questions a weak model cannot finish, which would have flattered it. The cap is
  now a scored miss.
- **A repository the harness would not copy cleanly.** `emilk/egui_plot` failed the harness's check that a copy is clean at its pinned
  commit, before any model call, and stopped four drivers; it was left out of the second round by that rule (the other nineteen in the
  second set, with the first round's five, are the twenty).
- **A SigMap crash on a directory called `constructor`.** `conda/constructor`'s `prefetch` runs stopped because `gen-context --adapter claude`
  threw ("groups[group].push is not a function"): files were grouped by top-level directory in a plain object. Fixed in SigMap, the batch
  redone with the fix; the same grouping had silently dropped such a directory from the module list.
- **A hypothesis about cold start that profiling disproved.** See the results page.
- **A held-out build with test files as "source".** The first build of the held-out questions counted a root-level `tests.py` as source
  (one question's only label was the test file) and kept titles about lint and docs. Both were fixed in the rule before any agent ran.
- **A script edited while it ran.** `run-token-saving.sh` was changed while the two placebo runs were using it; bash reads a script as it
  goes, so each run printed a syntax error after its last batch. All 12 batches of both had finished, and the counts (600 and 300 runs)
  match the plan, so no data was affected.
- **The standing cost of `index` was under-stated.** Earlier text said "about 1.6k tokens a turn"; measured on the API's token counter
  it is 2,266 (761 for the section and 1,505 for the seven tool definitions). The placebo was sized to the measured figure.
- **A tool-call drop of about 10% appeared with SigMap present and never called** (the optional skill). Differences of that size in tool
  calls are not evidence that retrieval did anything; the study reads cost and tokens first.

## Reproduce it

```bash
# no key needed: the numbers on the results page, from the saved runs
node benchmarks/agent-study/summarize.mjs
node benchmarks/agent-study/summarize.mjs --study          # the article's columns

# your own key: checks first, prints the plan and the worst-case spend, starts nothing
export ANTHROPIC_API_KEY=...
AGENT=api bash benchmarks/agent-study/run-token-saving.sh
GO=1 AGENT=api MAX_TOTAL_USD=25 bash benchmarks/agent-study/run-token-saving.sh
```

`AGENT=claude` (the default) runs the same plan through Claude Code under `--bare`; it needs a key Claude Code may bill. On a fresh
machine `npm run fetch:xrepo` fetches the eight pinned repositories first. Both routes check the key with one tiny call before
spending anything.
