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
- **The Messages API directly**, with a small agent loop (`scripts/lib/agent-ab-api.mjs`): a ~150-token system prompt, four read-only
  tools (Read, Grep and Glob through ripgrep, a Bash limited to a few read-only commands with no shell), prompt caching, a 25-turn cap.
  This is **not** Claude Code. It re-reads about 4k tokens a turn where Claude Code re-reads about 12k, so it shows what SigMap does for a
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
