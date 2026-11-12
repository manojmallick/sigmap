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
repositories, how often does SigMap save?** And it showed where the cost sits: `index` adds 2,266 tokens to every turn, 1,505 of them tool
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

`--sigmap-variant locate` is `index` with the tool list cut to `query_context` and `get_lines` (the runs wrote `mcp.tools: ["query_context",
"get_lines"]`; the named profile `"locate"` added afterwards advertises the same two tools), the two tools the agents used. Same section, same index. It takes the tool definitions from 1,505 tokens to
426, 1,079 fewer on every turn. It is a probe for locate questions only: the tools it drops (`get_impact`, `verify_suggestion` and others) are
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

## Third round: the real hook, in a live Claude Code session

Every `prefetch` number above comes from the harness putting the ranking into the prompt. What a user installs is different: the
`UserPromptSubmit` hook (`sigmap hooks install claude --prefetch`), run by Claude Code itself. This round tests that, with the rules
written before any run.

**Setup.** `--sigmap-variant prefetch-hook` copies the repository as before, then writes a `.claude/settings.json` into the SigMap arm's
copy only, registering the product's own hook command (the same text `hooks install claude --prefetch` writes) with its own timeout. The
prompt is the bare question in both arms; the SigMap arm gets no `## SigMap` section, no MCP server and no CLI allowance, so the hook is the
only difference. It runs on Claude Code with the logged-in session (`--session-auth`), because the hook needs the real program; those runs
count against the account's plan, not API credit, and are reported with the cost Claude Code itself records.

**Integrity, checked on every run.** The hook fired exactly once in the SigMap arm, with outcome `success`, exit code 0 and more than zero
bytes of added context, and never in the no-SigMap arm. A run that fails this check stops the batch, so a hook that quietly did nothing
cannot pass as a result. Before the first run of each repository the harness runs the registered command on a prompt derived from an
indexed file and refuses to start if it adds nothing.

**Repositories (chosen after seeing results, so read with that in mind).** The eight repositories of the twenty-repository round where
the harness-injected `prefetch` behaved most distinctly: the five where it cost more (`ionos-cloud/cluster-api-provider-proxmox`,
`conda/constructor`, `intaro/pinboard`, `chatmail/relay`, `stefankoegl/python-json-patch`) and three where it saved
(`flamingock/flamingock-java`, `GDQuest/GDScript-formatter`, `statelyai/agent`). Picking repositories because of an earlier extreme
result means some of that result was noise, and a rerun will tend to look less extreme on its own (regression to the mean). That is why
the savers are in the run as a contrast: both groups have the same selection, so a difference between them is not explained by it.

**Runs.** Every question those repositories have in the held-out sets (87 across the eight), Haiku 5.5, 2 repetitions, both arms:
348 runs, at most $0.25 each by Claude Code's own cap.

**Unit and estimate.** As in the second round: per repository, the typical-task change in real cost against the baseline, classed
*saves*, *costs more* or *no clear change* by its 95% interval; pooled over repositories by resampling repositories (10,000 times,
seed 1), reported separately for the two groups and for all eight.

**Decision rule.**

- *The hook is the harness prefetch, in practice* if the five cost-more repositories still lean upward (pooled interval above zero, or
  point estimate above zero with most repositories not saving) **and** the three savers still save. Then the earlier numbers describe
  what users get, including its cost on the repositories where the unaided agent was already cheap.
- *The cost was mostly the harness or noise* if the five cost-more repositories pool to an interval entirely below zero or including zero
  with a point estimate at or below zero. The earlier cost-more classification is then not carried forward.
- *The hook differs from the harness prefetch* if the savers stop saving (pooled interval including or above zero). Reported as a
  difference between the two ways of delivering the same text, without a cause: the study does not isolate one.
- The file found in at least as many runs as without SigMap, to within 2 percentage points, is required for any "no cost" statement.

Not part of this round: any claim about all repositories (eight chosen ones are not a sample), any claim about models other than Haiku
5.5 or about change tasks, and any comparison of absolute cost with the API-route runs (Claude Code adds its own system prompt, so only
within-route ratios are comparable).

**What was run.** 348 runs; none failed, none hit a cap, and the hook fired in all 174 SigMap-arm runs and in none of the 174 baseline runs.
The results, and the rule applied as written, are on the results page under "The real hook".

### A control added after the first result

The first result raised a question the design could not answer. The real hook (Claude Code) and the earlier `prefetch` numbers (the
Messages API agent, text put in the prompt by the harness) differ in two things at once, the way the text is delivered and the route that
runs the agent, and the repository-level results did not carry over from one to the other. This control was added after seeing that, and its
rule is written here before it runs.

**Runs.** `--sigmap-variant prefetch` (the harness puts SigMap's ranking after the question, as in the second round) on Claude Code with the
logged-in session (`--agent claude --session-auth`), the same eight repositories and 87 questions, Haiku 5.5, 2 repetitions, a fresh
no-SigMap baseline of its own: 348 runs.

**Decision rule.** Compared pair by pair on the same questions and repetitions (`summarize.mjs --versus prefetch-hook:prefetch`), real cost:

- *The route explains the difference* if harness `prefetch` on Claude Code looks like the hook (per-repository results correlated with the
  hook's, pooled interval including zero) and unlike its own API-route results.
- *The delivery explains it* if harness `prefetch` on Claude Code reproduces its API-route per-repository pattern (rank correlation of the
  eight repositories' effects with the API-route ones at 0.5 or more) while the hook does not.
- Anything else is reported as unexplained. With eight repositories and two repetitions, only a large difference can be told from noise,
  and the result will say so.

**What was run.** 348 runs, none failed. By the letter of the rule the outcome is *unexplained* (the prompt text on Claude Code took cost
−15% [−24, −6], so the route does not explain the gap, but its rank correlation with the API-route results was 0.40, short of the 0.5 the
delivery branch asked for). The results page, "The real hook, and the same text in the prompt", gives the numbers and what they support.

## Fourth round: delivering the same ranking differently

The third round left one measured fact and one open question. The same ranking took Haiku 5.5's cost −15% when the harness put it in the
prompt and −1% when Claude Code's `UserPromptSubmit` hook delivered it, on the same route and questions. This round looks for a delivery that
closes that gap. What a hook can do is narrow, which shapes the experiment: in the Claude Code version used (2.1.322) the hook's JSON output
for this event takes only `additionalContext`, with no way to rewrite the prompt, and both that and plain stdout arrive as a separate
`<system-reminder>` message after the user's turn (labelled "UserPromptSubmit hook additional context:" or "...hook success:"). The prompt
text sits inside the user's own message, which a hook cannot reach. What can be varied is what the reminder says and how much of it there is.

### Stage A: is the gap real, and what does the agent do first?

Two questions, asked before any variant is designed.

**1. Does the gap reproduce?** `prefetch-hook` and `prefetch` run again on Claude Code with the same eight repositories, 87 questions and
Haiku 5.5, two new repetitions each (numbered 3 and 4 and merged with the first two), a fresh baseline for each. *Rule:* the gap reproduces if
the paired hook-against-prompt real-cost difference over the new runs alone has a 95% interval entirely above zero. If it includes zero, the
estimate is the four-repetition pooled one, and the +17% of the third round is reported as not reproduced at that size. The four-repetition
pooled estimate is reported either way.

**2. What does the agent do after each delivery?** The harness now records the order of each run's tool calls and the files the ranking
named. For each delivery (and the baseline): the share of runs whose first call is a Read, Grep, Glob or Bash; the share that read at least one
ranked file; the share that read the top-ranked file; the share that searched before reading a ranked file; and the number of calls before the
first read of a ranked file. These are descriptive, with no estimator and no decision rule, and exploratory: their only use is to choose the
delivery variants of Stage B, which are written here, with their rule, and committed before they run.

**Stage A, what happened.** 696 runs, none failed. Under the rule as written the gap reproduced: over the new runs alone the hook cost
+22% [+16, +29] more than the prompt text, paired, and +20% [+15, +24] pooled over all four repetitions. But splitting the runs by whether the
question had been asked before in its batch showed the comparison was not sound, and looking for why found a second problem (both are in the
list below). On first asks only, with the hook's ranking still diluted, the prompt text was −4% [−9, +1] against its baseline, the hook +1% [−3,
+5], and the hook +8% [+3, +12] against the prompt text. The traces: the agent's first call was a Grep in 91% of hook runs, 83% of prompt-text
runs and 90% of baseline runs; the answer named a ranked file in 76% of hook runs and 75% of prompt-text runs; the prompt text cut turns from
6.0 to 3.6 and the hook from 5.9 to 4.7. Neither delivery changes the agent's opening move, and both are used about equally.

### Stage B0: the clean comparison

With both flaws removed (`--prompt-style question`, below), the comparison is rerun, so that what remains of any difference between the hook and
the prompt text is delivery alone.

**Setup.** The user's prompt is the bare question followed by a one-token reference no other run shares (`[q` and eight hex digits, which
matches nothing in a ranking). The instructions the template used to wrap around the question ("name the repository-relative path of each
file…") move to the system prompt, the same text in both arms. Offline, with this prompt the hook's top five equals the bare question's top
five for all 87 questions (against none of 87 with the template), so the hook and the harness's `prefetch` rank the same text. The reference
makes every run a first ask: nothing in the opening prompt repeats, while the system prompt and tools stay shared, as in a session.

**Runs.** `prefetch-hook` and `prefetch`, each with its own baseline, on Claude Code (logged-in session), the same eight repositories and 87
questions, Haiku 5.5, 2 repetitions: 696 runs.

**Estimators.** As in the third round: typical-task real cost per setup against its baseline, pooled by resampling repositories, and the two
setups paired against each other on the same questions and repetitions.

**Decision rule.**

- *Delivery explains the gap* if the hook against the prompt text has a 95% interval entirely above zero in the pooled runs and above zero in
  both repetitions. Stage B1, the delivery variants, then starts, with its variants and rule written and committed before they run.
- *No gap* if that interval includes zero. The hook then does what the prompt text does and the third round's difference was the two flaws; the
  question left is whether either saves, answered by each setup's own interval and the bar of the second round.
- *The hook is better* if the interval is entirely below zero. Reported as found.

**Stage B0, what happened.** 696 runs, none failed, every run a first ask, the hook and the prompt text ranking identical text. Prompt text
against its baseline: real cost −13% [−17, −10] (tokens −33%, tool calls −55%, time −22%), −13% [−22, −4] pooled by repository (4 save, none costs
more), the file found in 157 runs of 174 against 162. The hook against its baseline: −5% [−10, −1], −5% [−15, +3] by repository (2 save, 6 no clear
change), found 160 against 163. Hook against prompt text, paired: **+6% [+2, +9]**, above zero in both repetitions (+4%, +7%): the rule's first
branch, so delivery explains what is left of the gap, and Stage B1 follows. The traces: after the hook the agent made 2.6 tool calls and read a
ranked file in 31% of runs, after the prompt text 1.95 and 22%; the answer named a ranked file in 90% and 94%. It checks the hook's list more. The
prompt text's higher trust has a price: it found the file in 3 points fewer runs than its baseline, the hook in 2.

### Stage B1: three deliveries of the same ranking

All three are prototypes in `benchmarks/agent-study/hooks/prototype-hook.cjs`, calling the product's own `prefetch()` (same ranking, same
signatures, same dedupe) and changing only what Claude Code is handed. Each is a change a hook can make; none rewrites the prompt, which this
version of Claude Code does not allow.

- `hook-plain`: the block as plain stdout instead of JSON `additionalContext`. Claude Code adds both as a `<system-reminder>` message, labelled
  "hook success:" rather than "hook additional context:". The only other documented channel; expected to change little.
- `hook-firm`: the same block under a header that says where to start ("The answer is usually in the first few. Start with them… search only
  if none of them fits") in place of "These are leads, not an answer". Tests whether the checking is the hedge. It asks the agent to trust more,
  and the prompt text, which is trusted more, found the file less often, so found is part of the rule.
- `hook-brief`: the same header and ranking with at most 2.5 KB of signatures instead of 8 KB. Tests whether less to carry and re-read helps.

**Runs.** Each variant on Claude Code (logged-in session), the stage B0 setup (`--prompt-style question`), the same eight repositories and 87
questions, Haiku 5.5, 2 repetitions, a baseline of its own: 348 runs each, 1,044 in all. The stage B0 `prefetch-hook` and `prefetch` runs are
the references.

**Decision rule, per variant.** A variant *improves on the shipped hook* if all of:

1. its real cost against the shipped hook, paired on the same questions and repetitions, has a 95% interval entirely below zero in the pooled
   runs and a point estimate below zero in both repetitions;
2. the file is found in no fewer runs than its own baseline's, less 2 percentage points over all runs;
3. at most one of the eight repositories costs more than its baseline (its own 95% interval entirely above zero).

It *matches the prompt text* if, in addition, its cost against the prompt text has an interval that includes zero or lies below it. Otherwise it
is reported as what it is, with the number that failed.

**Three variants are screened against one reference**, so one that passes is more likely to be chance than the same result from a single
planned comparison. A variant that passes is therefore re-run before anything is concluded about it: two fresh repetitions on all eight
repositories, the shipped hook run alongside as the reference, the same rule. Only a variant that passes both is a candidate for the product,
and screening alone changes nothing in the product or its documentation. If none passes, the shipped delivery stays and the numbers are
reported.

**Stage B1 screening, what happened.** 1,044 runs, none failed, every hook fired once in the SigMap arm and never in a baseline. Against the
shipped hook, SigMap arm to SigMap arm, real cost: `hook-plain` −3% [−6, 0] (file found 3.4 points below its own baseline: fails criterion 2),
`hook-brief` −3% [−6, +1] (interval includes zero: fails criterion 1), `hook-firm` −3% [−7, 0], both repetitions below zero (−2%, −5%), found
163 against a baseline of 161, no repository costing more: **passes all three, by the letter**. All three are +2% to +3% against the prompt
text, intervals including zero.

Then the baselines were looked at. The five series' baseline arms cost between $0.00325 and $0.00346 a run, and the `hook-firm` series' was 4%
below the shipped hook's, which is as large as the effect. The comparison above sets one series' SigMap arm against another's, so a cheaper hour
counts as a saving. Comparing each pair's change against its own baseline (`summarize.mjs --versus a:b --adjusted`, added after seeing this, not
planned): `hook-firm` against the shipped hook **0% [−5, +5]**, `hook-plain` −2% [−7, +3], `hook-brief` −3% [−8, +3]; and against the prompt text
+9% [+4, +14], +8% [+2, +13], +7% [+1, +12]. On that view none of the three differs from the shipped hook, and all stay above the prompt text. The
traces: the firm header sent the agent to a ranked file sooner (1.0 calls before the first ranked read against 1.6) and read the top-ranked file in
17% of runs against 13%, but the calls per run fell only from 2.6 to 2.3.

**Confirmation of `hook-firm`, as the rule requires, with one change declared before it runs.** The shipped hook, `hook-firm` and the prompt
text run back to back for each repository (the order of `run-hook-study.sh`), two fresh repetitions of all 87 questions each: 1,044 runs. The
rule is the one above, except that criterion 1 is judged on the baseline-adjusted comparison: the real cost of `hook-firm` against the shipped
hook, each against its own baseline, has a 95% interval entirely below zero in the pooled runs and a point estimate below zero in both
repetitions. The unadjusted figure is reported beside it. If `hook-firm` does not pass, the shipped delivery stays, and the result is "no
delivery tried closes the gap".

**Confirmation, what happened.** 1,044 runs, none failed: the shipped hook, `hook-firm` and the prompt text back to back for each repository, two
fresh repetitions of all 87 questions. `hook-firm` against the shipped hook, each against its own baseline: **−3% [−8, +2]**, by repetition 0% and
−5%. The declared criterion needs an interval entirely below zero and both repetitions below zero; it has neither. (Unadjusted: −2% [−5, 0], also
including zero.) `hook-firm` does not pass, and **no delivery tried improves on the shipped hook**. The confirmation also reproduced the stage B0
result: the shipped hook against the prompt text +7% [+3, +11], +7% in both repetitions. Over the four clean repetitions: the prompt text −12% [−15,
−9] against its baseline (found 315 of 348 against 328), the shipped hook −4% [−7, −1] (found 321 against 326), the hook against the prompt text
+6% [+4, +9]; `hook-firm` −6% [−9, −3] against its baseline and −2% [−5, +2] against the shipped hook. The numbers and what they do not show are on
the results page, "The real hook, and the same text in the prompt".

**What this round changed in the study itself.** Rows are tagged `ask: first | repeat`; `--prompt-style question` is the way to run the Claude Code
agent from now on; `--versus` has an `--adjusted` form; and the Claude Code results from before the fourth round are best read on first asks. The
Messages-API results, where no such effect appeared by repetition, stand as reported.

### Afterwards: focusing the query for long prompts (a product fix, measured offline)

The rounds above found that the hook ranks whatever prompt it is handed: the expected file was in the top five for 47 of 87 questions when
the question sat inside about fifty words of instructions, against 61 for the bare question. The fix is in the hook (`src/session/query-focus.js`),
and it is judged without a model: ranking only, by the real `sigmap ask`, over the 222 held-out questions of the 20 repositories, each put inside
a wrapper. `benchmarks/agent-study/query-focus-eval.mjs` runs it; the result of record is `data/query-focus-eval.txt`.

**Split and criteria, written before any candidate was scored.** The 55 questions of the first five repositories design the rule; the 167 of
the other fifteen test it. Wrappers: seven while designing (`template`, the benchmark's own prompt; `polite`, `rules`, `log` with a pasted test
run, `context`, `standards`, a block of coding conventions), three written before the rule was scored on the second split (`task`,
`trace`, `chat`). A rule is acceptable if: (1) a prompt of two dozen words or fewer is ranked exactly as written, which the bare questions
(at most 19 words) show; (2) under the long wrappers `template`, `log`, `context` and `standards` the top-five rate is within 4 points of the
bare question's and the top-one rate within 6; (3) no wrapper ends more than 2 points below the raw prompt; (4) it costs under 150 ms. A tie
between rules goes to the one that needs no index.

**What did not work.** Each of these ranked worse than the raw prompt on the design split (mean top-five hits of 55 over the six long wrappers: raw
35.8): dropping the words that appear in 3% to 20% of the repository's files (32.7 down to 22.2, because it takes question words such as `list` and
`install` with it); keeping the 8 or 12 words with the highest inverse document frequency (8.0, 12.2); keeping the one or two sentences with the
most rare-term mass (22.2, 29.8, because boilerplate is often longer than the question). What worked is dropping *sentences* that are only
conversation or instructions about the answer (a function-word and conversation list, a content-word ratio of 0.5, at least two content words),
and fenced or pasted tool output. Two bugs in it, found by reading the cases it got wrong: splitting at colons, which cut `goproxmox: make ...`
into a scope label with nothing in it and threw the label away (the chosen rule's 37.2 became 42.2 when fixed), and a chatty lead-in
(`What I'm trying to do: <question>`) pulling a sentence under the content ratio, which left the `trace` wrapper at 70 of 167 hits on the
second split against 88 for the raw prompt. The second was found *by* that split, so the split no longer tests the rule as it stands; the fix (judge a sentence on what follows a
short label) was checked on four new wrappers written before the fixed rule was scored on anything: `issue`, `review`, `longpolite`, `instr2`.

**Result of record: 222 questions, 13 wrappers, 2,886 prompts.** Expected file in the top five: raw wrapped prompt 59.4%, focused 65.6%, the bare
question 71.6%; first: 27.7%, 36.4% and 44.6%. About half the gap. By wrapper (top five, raw → focused, bare 72%): `template` 51% → 72%, `log`
46% → 72%, `context` 60% → 70%, `polite` 66% → 72%, `chat` 68% → 71%, `instr2` 67% → 71%, `trace` 59% → 66%, `rules` 70% → 70%, `issue` 62% → 64%,
`review` 63% → 65%, `longpolite` 59% → 61%, `standards` 46% → 46%, `task` 55% → 55%. Criteria: (1) met, 0 of 222 bare questions changed; (2) met for
`template`, `log` and `context`, **not** for `standards` (46% against 72%); (3) met, the worst wrapper is one hit of 222 below raw; (4) met,
at most 19 ms for a megabyte of paste with the question before or after it.

**What it cannot do.** `standards` and `task` are lists of constraints written in ordinary software words ("keep the public API unchanged",
"add tests for any new behaviour"), which a word list does not tell from a question; chatter in ordinary words survives (`longpolite`); a pasted
traceback loses its frames, which in real use may be the best lead in the prompt (nothing here measures that). A variant that also asks whether a
sentence's words occur in the repository was tried afterwards, not chosen on it: much better on `standards` (113 against 68 of 167) and `task`
(109 against 88), much worse on `trace` (58 against 94), so it is not shipped. All wrappers are mine, in English, and the questions are commit
titles; no real prompts were available. The effect on an agent is Stage D, below; the earlier agent runs use the bare-question prompt, which the rule
leaves untouched, so none of their numbers change. `SIGMAP_PREFETCH_FOCUS=0` restores the old behaviour.

### Stage D: does the focusing show up in an agent's cost?

The query focusing was judged on rankings alone. Whether a better ranking moves an agent's cost is a separate question, asked here with the prompt that
caused the problem.

**Setup.** `--prompt-style wrapped`: the benchmark's original prompt, instructions and all, with a one-token reference on the question line so that
every run is a first ask. The hook is handed that whole prompt. Two series of the shipped hook on Claude Code (logged-in session), Haiku 5.5, the same
eight repositories and 87 questions, four repetitions, each with a baseline of its own (696 runs each, 1,392 in all): focusing on, as shipped, and
focusing off (`SIGMAP_PREFETCH_FOCUS=0`, the hook ranks the whole prompt, as in the first three rounds), run back to back for each repository
(`run-hook-study.sh`, `prefetch-hook` and `prefetch-hook:nofocus`). A pilot of four questions confirmed the switch reaches the hook inside Claude
Code: all four ranked lists differed, and without focusing the same file came first for three of the four.

**What the offline result predicts.** On these prompts the focused query puts the expected file in the top five about as often as the bare question
does (72% against 51% raw), and the focused list equals the bare question's in about three prompts of four.

**Decision rule.** The focusing *shows up end to end* if the real cost of the focused series against the unfocused one, each measured against its own
baseline (`summarize.mjs --versus prefetch-hook:prefetch-hook-nofocus --adjusted`), has a 95% interval entirely below zero and a point estimate below
zero in at least three of the four repetitions, and the file is found in no fewer than its baseline's runs less 2 percentage points. If the interval
includes zero, the result is "not detected at this size", and the ranking numbers are what is established. For reference, not as a rule: the same
hook with the bare-question prompt (the fourth round's clean runs) took cost −4% [−7, −1] against its baseline. With 348 pairs per series the adjusted
interval is about ±4 points wide, so only a difference of that size or more can be seen.

**Stage D, what happened.** 1,392 runs, none failed; the hook fired in every SigMap-arm run of both series and in no baseline run, and every run was a
first ask. Against its own baseline the focused hook took real cost **−3% [−6, 0]** (tokens −17%, tool calls −37%, time −14%; file found 321 of 348
against 320), the unfocused hook **+3% [0, +6]** (tokens −7%, calls −32%, time −9%; found 320 against 322). The two baselines cost the same per run
($0.00361 and $0.00364). The rule: focused against unfocused, each against its own baseline, **−6% [−9, −2]**, by repetition −10%, +1%, −7%, −6%;
the file found no less often than its baseline. **Met: the focusing shows up in an agent's cost.** With the wrapped prompt the focused hook is back
at about the level of the bare-question hook of the fourth round (−4% [−7, −1]); by repository the pooled estimates are −3% [−11, +5] and +3% [−4,
+10], 2 of 8 repositories saving and 3 costing more in each, which is what eight repositories and a small effect look like. This is one model, one
prompt wrapper, and the same eight repositories chosen after the earlier results.

### Stage E: repositories outside the eight

Stage D, like every hook run before it, used eight repositories chosen after the earlier results. This stage runs the same hook on the other twelve of
the twenty-repository set: `timescaledb-toolkit`, `TeleBox`, `upjet`, `mica-mqtt`, `fastify-static`, `sip`, `postgresql-for-doctrine`,
`openscad-playground`, `irb`, `textbringer`, `keycloak-restrict-client-auth` and `Salesforce-Inspector-reloaded`. They are all that is left of the
set, so nothing about them was picked by how any setup did, and no agent had yet run the hook on them. One limit: their questions were used in the
offline evaluation of the query focusing (`timescaledb-toolkit`'s while the rule was designed, the other eleven's while it was tested), so the
repositories are new to the agent runs but not to the rule.

**Setup.** As Stage D: the benchmark's wrapped prompt with a per-run reference (`--prompt-style wrapped`), the shipped hook with focusing on and
with focusing off (`prefetch-hook` and `prefetch-hook:nofocus`), Claude Code on the logged-in session, Haiku 5.5, four repetitions, a baseline of
its own for each series. 135 questions, 2,160 runs, 540 pairs per series; the adjusted interval is about ±3 points wide.

**Decision rule.** The focused hook's saving *holds outside the eight* if, against its own baseline, the typical-task real cost has a 95% interval
entirely below zero, the estimate pooled by repository (resampling repositories) has a point estimate below zero, and the file is found in no fewer
than its baseline's runs less 2 percentage points. Otherwise the result is "not shown outside the eight", with the numbers. The focusing itself
holds outside the eight if the Stage D rule is met again: focused against unfocused, each against its own baseline, entirely below zero and
negative in at least three of four repetitions. Reported without a rule: the twenty repositories together (these twelve and the eight of Stage D,
the same prompt and hook), by repository.

**Stage E, what happened.** 2,160 runs, none failed; the hook fired in every SigMap-arm run of both series and in no baseline run, every run a first
ask, and the two series' baselines cost the same per run ($0.00399 and $0.00395). The focused hook against its own baseline: real cost **−7% [−10, −5]**
(tokens −18%, tool calls −38%, time −10%); pooled by repository **−7% [−11, −3]**, 4 of 12 repositories saving clearly and none costing more. The
unfocused hook: 0% [−3, +2] (tokens −7%, tool calls −29%), 2 of 12 saving and 1 costing more. Focused against unfocused, each against its own
baseline, **−7% [−10, −4]**, negative in all four repetitions (−5%, −4%, −11%, −7%).

**The rule, by its letter: the saving is not shown to hold, because of the accuracy clause.** The cost parts are met (the typical-task interval is
entirely below zero, the by-repository point estimate is below zero, and the focusing contrast is met again). The file was found in **483 of 540**
runs against 497 for the focused hook's baseline, 2.6 points fewer where the rule allowed 2. This is not noise at the usual level: in 23 pairs the
focused hook lost a file its baseline found and in 9 the reverse (net −14, exact sign test p = 0.02), where the unfocused hook was net +9 (p = 0.12) and
the eight repositories of Stage D were a wash (7 against 8). Most of it is one repository: `TeleBox` went from 28 of 48 found to 20, and the
others that lost a few (`sip` −3, `openscad-playground` −3, `Salesforce-Inspector-reloaded` −3) were offset by repositories that gained. Without
`TeleBox` the net is −6 of 492 pairs. Offline, focusing did not make any ranking worse there: the expected file is in the top five for only 3 of 12
`TeleBox` questions with the bare question, 4 with the raw wrapped prompt, 3 focused, so the list is poor however the query is built. It looks like
the same trade as the prompt text in the fourth round: an agent that leans on a poor list spends less and finds the file less often. Over all twenty
repositories (the eight of Stage D and these twelve) the focused hook was −6% [−7, −4] against its baseline (888 pairs; −5% [−10, −1] pooled by
repository, 6 saving, 11 no clear change, 3 costing more) and found the file 13 runs fewer of 888 (p = 0.08); the unfocused hook +1% [−1, +3] and
7 runs more.

### Stage F: a confidence guard for the hook

Stage E left a trade the hook cannot see for itself: on the twelve repositories outside the eight it saved 7% of cost and found the file in 14 fewer
runs of 540, mostly where its ranking is poor however the query is built. The guard withholds the injection when the ranking looks weak, so the agent
behaves as it would without the hook exactly when the list is least likely to be right. It can use only what the hook already holds: the scores
`sigmap ask` prints, how many files it shows, and the prompt itself.

**Families of signal, fixed before any was scored** (a rule is one of these, or an OR of them, each with one threshold): (1) *flatness*, the last shown
score over the first; (2) *the top score* alone; (3) *the margin*, the first score over the second; (4) *readable share*, the share of the focused
query's letters that are ASCII, i.e. what the tokenizer can use (a Chinese commit title leaves only its identifiers). Nothing outside these is tried,
so that a rule is not found by searching until one works.

**Target and procedure.** For each of the 222 held-out questions, the focused benchmark prompt (what the hook actually ranks) is ranked by the real
`sigmap ask`, and a ranking is *right* when an expected file is among the files it shows. A threshold is chosen by leave-one-repository-out over the
20 repositories (so the repository being scored never chose its own threshold), taking, within each family, the loosest threshold that skips at least
a third of the misses, and the simplest family or OR that meets the criteria below. Agent-level numbers are then read off the 888 pairs of Stages D
and E by *counterfactual*: a pair the guard would skip takes its baseline arm's outcome, since an uninjected run is a baseline run. That is a
simulation, so the real test is a run.

**Criteria.** Offline: (O1) the share of wrong rankings skipped exceeds the share of right rankings skipped by at least 0.20; (O2) no more than 35%
of questions are skipped. Counterfactual over Stages D and E: (O3) the file found no more than 1.0 point below baseline (it is 1.5 points below over
all twenty repositories and 2.6 below on the twelve), and at least 60% of the unguarded cost saving kept. If any fails, the guard is not shipped.

**The real run, written now.** If the offline criteria are met, the guarded hook runs on the twelve repositories outside the eight (the benchmark's
wrapped prompt, first asks only, four repetitions, a baseline of its own: 1,080 runs). It *works* if its real cost against its own baseline has a 95%
interval entirely below zero and the file is found no fewer than its baseline's runs less 2 percentage points, the clause the unguarded hook failed.
The twelve are not a clean test of the thresholds, which were chosen with their rankings in the data; the runs are new, their outcomes not.

**Stage F, what happened.** *Offline* (`guard-eval.mjs`, result of record `data/guard-eval.txt`): 222 focused queries, 160 with the expected file among the
files shown and 62 without. The four families are weak predictors one at a time: AUC 0.62 (flatness), 0.66 (top score), 0.58 (margin), 0.63 (readable
share). Leave-one-repository-out, the best pair was top score OR readable share (skips 35% of the wrong rankings and 6% of the right ones, separation
0.30, 14% of questions); the single families sit at the 0.20 boundary of criterion O1, and `readable` alone cannot reach a third of the misses, so the
procedure selects nothing for it. **What ships is the readable half alone, which departs from the registered "best configuration"**: in the
counterfactual the score floor adds nothing visible (the same found and cost to one decimal), and an absolute BM25 score floor was never tested on a
repository smaller than 80 files and could silently switch the hook off in a small project. The threshold is 0.9, not a fitted value: no focused query
has a readable share between 0.88 and 1.0, and 0.9 does not trip on one accented name in an English prompt. The rule skips 22 of the 222 questions
(18 wrong rankings, 4 right), all in `TeleBox` and `mica-mqtt`, whose commit titles are Chinese; the per-run reference token cannot move any of them over the
line (0 of 44,000 draws). *Counterfactual* over the 888 pairs of Stages D and E (a skipped pair takes its baseline arm's outcome): 10% of pairs
skipped, cost −5.6% becomes −5.2%, 93% of the saving kept, the file found 1.5 points below baseline becomes 0.6 below; on the twelve outside the eight
−7.2% becomes −6.5% (91% kept) and 2.6 points below becomes 1.1, which is 0.1 over criterion O3's 1.0.

*The real run:* 1,080 runs (the first attempt stopped on all four shards when the plan's usage limit was reached, recorded nothing, and was repeated
unchanged once it had reset). The hook was silent on exactly 88 runs, 22 questions in four repetitions, as the integrity check required of each; every
other run injected. Against its own baseline the guarded hook took real cost **−8% [−10, −5]** (tokens −19%, tool calls −36%, time −10%), pooled by
repository −7% [−12, −4] (5 of 12 saving, none costing more), and the file was found in **485 of 540** runs against 492, **1.3 points fewer**: both clauses of
the rule are met, including the one the unguarded hook failed (2.6 points). Paired, the guarded hook lost a file its baseline found in 19 pairs and
gained one in 12 (net −7, p = 0.28), where the unguarded hook was net −14 (p = 0.02). Against the unguarded series, each against its own baseline,
the guard cost nothing measurable: 0% [−3, +2].

**What this does and does not show.** The guard is, in the data it was built from, a language guard: it fires on prompts written mostly in a script
the ranker cannot read. It does nothing for English prompts whose ranking is simply wrong (`agent` and `GDScript-formatter` have 6 of 12 wrong,
`relay` 4 of 10), because none of the four signals predicts those (AUC at most 0.66). Its thresholds were chosen with these repositories' rankings in
view, so the twelve are not a clean test of the guard, though the runs and their outcomes are new. And the real run carries a noise floor worth
knowing: on `TeleBox` the guarded hook was silent, so its runs are baseline runs, yet they found 22 of 48 against 25 for the paired baseline, while
the unguarded series' baseline on the same repository found 28. A gap of 3 from nothing but run-to-run variation means part of the `TeleBox` loss
reported in Stage E was noise.

### Stage G: a more doubtful header when the ranking is thin

The guard of Stage F cannot see an English prompt whose ranking is simply wrong. A cheaper action than silence is to say so: inject the list, but under
a header that tells the agent this ranking looks weak. Stage B1's `hook-firm` (a header that asks for more trust) changed nothing measurable, so the
prior for any header is small; this tests the opposite wording where it would matter.

**How much there is to gain.** From the runs already in hand (Stages D and E, the guarded Chinese questions left out): where the ranking was right
(156 questions, 624 pairs) the focused hook was a wash on accuracy (file lost 3 times, gained 5) and saved 6.3%; where it was wrong (44 questions, 176 pairs)
it lost the file in 15 pairs and gained it in 8 (net −7, 4.0 points of those pairs, 0.9 points of all 800) and still saved 3.8%. A header can recover at
most those 7 pairs, and only by making the agent verify more, which spends some of the 3.8%. Accuracy is therefore a poor primary outcome: an effect of
that size cannot be told from noise. What a header can change visibly is how much the agent checks, so the test has two parts.

**Defining "thin", fixed before it is computed.** The same four families as Stage F, minus readable share (the guard covers it): flatness, top score and
margin, one threshold each, alone or as an OR of two. Over the 200 questions the guard lets through (44 wrong rankings), chosen leave-one-repository-out as
in Stage F but aiming at *half* of the wrong rankings, with the fewest right rankings flagged. The rule that ships in the prototype is the one fitted the
same way on all 200. If the share of wrong rankings among the flagged questions is not clearly above the 22% among all of them, the header is not tested:
a header that says "weak" about a list that is no weaker than average would be untrue.

**The header** (the standard one is `HEADER` in `src/session/prefetch.js`):

> ## Files SigMap ranked for this question (a weak ranking)
> SigMap ranked this repository's files against the question from its offline index (no model call), but the scores for this question are low or close
> together, which in testing went with a list that did not contain the right file more often than usual. Treat these as guesses to check, not leads to
> follow: search the repository as you normally would, and use the list only where it helps. Each signature carries a `:start-end` line anchor you can
> Read directly.

**Parts of the test.** (1) *The mechanism*: on the flagged questions, does the agent verify more? Tool calls per run with the doubtful header against the
standard one, paired on the same questions and repetitions, each against its own baseline. It *works as intended* if that interval is entirely above zero.
(2) *The payoff*: on the same questions, the file found against baseline, and the real cost, for the two headers. It *pays off* if the doubtful header's
found-rate gain over the standard one (each against its own baseline) has a 95% interval entirely above zero, and it keeps at least half of the standard
header's cost saving on those questions. The run size and the exact question list follow once the rule is fitted, and will be written here before any run.

**The rule that was fitted, and the run (written before any run).** Leave-one-repository-out over the 200 questions the guard lets through, aiming at half of
the wrong rankings: flatness flags 48% of them and 25% of the right ones (top score 52% and 26%, margin 50% and 39%, pairs no better); flatness is scale-free,
so it wins the tie with the top score, which would flag every prompt in a small repository. Fitted on all 200: **flat when the last shown score is more than 57%
of the first** (`flatness < 0.429`). It flags 67 of the 200 questions, 23 of them with a wrong ranking: 34% against 22% overall, so "more often than usual"
in the header is true. Pushed through the real prototype process with fresh random reference tokens, 67 questions got the doubtful header, 22 were silent
(the guard) and 133 got the standard header, exactly as predicted offline.

The run: the 67 flagged questions of 17 repositories (the other 133 get the same block under either header, so they carry no information), the
benchmark's wrapped prompt with a per-run reference, the standard shipped hook and `hook-doubt` run back to back for each repository, five repetitions,
a baseline of its own for each series: 1,340 runs. **Power, stated now:** with about 335 pairs per series, tool calls per run can be compared to within
roughly ±5% and cost to within ±5 points, but the file-found difference to only about ±8 points, while the whole accuracy loss available to recover is
about 4 points of the wrong-ranking pairs (2 or 3 points of these flagged questions). The payoff clause below is therefore close to untestable; the mechanism
clause is the part this run can settle. The found difference is a difference of differences (each series against its own baseline), with a 95% interval from
resampling questions (10,000 times, seed 1).

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

- **A comparison that let the weather in (found in Stage B1).** The first rule for the delivery variants compared one series' SigMap arm with
  another's, so a series whose baseline happened to be 4% cheaper looked 3% better. Each series' change against its own baseline
  (`--adjusted`) cancels that, and the confirmation was judged on it. The rule was written before I knew the baselines drifted; the
  adjustment was written down before the confirmation ran, and the screening result by the letter is still reported.
- **A launch with an empty question list.** The first driver for the real-hook run built its question ids with a script that printed the
  wrong variable, so every batch was refused with "--task-ids needs a value" before any call (nothing ran, nothing was spent). Fixed and
  relaunched after the design above was committed.
- **A decision rule with two groups of different sizes.** The real-hook rule asked whether three repositories "stop saving" by whether their
  pooled interval includes zero; over three repositories that interval is about thirty points wide and nearly always does. The result is
  reported both by the rule as written and by what the per-repository numbers support.

- **Repeated questions were served from the prompt cache (found in the fourth round).** Every batch ran each question twice in the same
  checkout, minutes apart. On Claude Code the second run's opening prompt is byte-identical to the first's, so the host reads it from the
  prompt cache, and an arm that adds question-specific text to the prompt gains most. `prefetch` on Claude Code: first asks against repeats
  +16% and −14% (famous questions), −23% and −45% (SigMap's own source), −4% and −27% (the eight repositories); the Messages-API agent,
  which does not reuse a prefix this way, showed nothing by repetition (−9%, −8%, −3%, −10%). A source comment from the first round had
  recorded the same effect for another variant ("cost +14% in repetition 1 and −11% in repetition 2") and I did not carry the lesson to the
  prompt-text arm. Rows are now tagged `ask: first | repeat` and the third round's conclusion ("the route does not explain the gap") is
  withdrawn. Earlier Claude Code results that used only two repetitions are best read on first asks; the table on the results page shows both.
- **The hook ranked the whole prompt (found in the fourth round).** The hook is handed the submitted prompt and ranks all of it. In the
  benchmark that was the question inside about fifty words of instructions, while the harness's `prefetch` ranked the bare question. Scored
  against the expected files, the bare question puts one in the top five for 61 of 87 questions and first for 32; the wrapped prompt for 47
  and 11, and the two top-five lists were never identical. The hook arm of the third round and of Stage A had a worse ranking than the
  prompt-text arm. The same applies to a person who pastes a long prompt: a hook that ranks everything it is given is as good as the prompt is
  focused, which is a limit of the product, not just of the benchmark.

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
