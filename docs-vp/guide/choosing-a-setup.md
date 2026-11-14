---
title: Choosing a setup
description: Which way to give an agent SigMap saves tokens, time or cost, by goal, with the measured record of each on twenty unseen repositories, what not to use, and three ways to find out which one suits your project.
head:
  - - meta
    - property: og:title
      content: "Choosing a SigMap setup for token, time and cost savings"
  - - meta
    - property: og:description
      content: "Which way to give an agent SigMap saves tokens, time or cost, by goal, from 22,540 recorded agent runs, and how to measure it on your own project."
  - - meta
    - property: og:url
      content: "https://sigmap.io/guide/choosing-a-setup"
  - - meta
    - property: og:type
      content: article
---

# Choosing a setup: tokens, time or cost

SigMap reaches an agent in three ways, and they do not save the same thing. In the [agent study](/guide/agent-study) (22,540 recorded runs) the way that cut **time** and
**tokens** was not the way that cut **cost** most safely, and no setup saved on every repository. This page says which to pick for which goal, what to leave off, and how to find
out for your own project, because nothing SigMap can compute offline predicted which repositories save ([Stage I](/guide/agent-study-protocol#stage-i-can-an-offline-signal-say-which-setup-suits-a-repository)).

## The short answer, by goal

What each did on the twenty repositories the study held out (repositories SigMap was never tuned on; Messages-API agent, Haiku 5.5; the unit is the repository):

| If you care most about | Use | What it did |
|---|---|---|
| **Time** | the prefetch route | time **−18%** [−21%, −14%], and **19 of the 20 repositories** saved time; no repository was slower |
| **Total tokens** | the prefetch route | **−26%** [−39%, −14%]; 9 repositories used fewer, **none used more** |
| **Not paying more** | `strategy: "index"` with `mcp.tools: "locate"` | cost **−7%** [−13%, −2%]; **none of the 20 cost more**, 4 saved. It saves no time (+1%) and total tokens rise (+18%) |
| **Cost, with upside and risk** | the prefetch route | cost −7% [−19%, +4%]: 7 repositories saved, **5 cost more** (up to +31%) |
| **Nothing** | `strategy: "index"` alone | cost −1% [−8%, +5%], time +2%, tokens **+51%** (17 of 20 used more) |

"The prefetch route" is the ranking put in front of the model before its first turn. Two things deliver it, and they are not equal: the benchmark's version puts the text in the
prompt itself (the row above), and the installed hook (`sigmap hooks install claude --prefetch`) hands it over as a separate system reminder, which the agent checks less. On a clean
comparison in Claude Code (Haiku 5.5, eight repositories, 348 first asks) **the installed hook took time −11%, total tokens −23%, tool calls −41% and cost −4% [−7%, −1%]**, about a third
of what the same text saves in the prompt. So expect the smaller numbers from the hook and read the table as the ceiling.

## What each setup is

- **The prefetch hook** (opt-in): `sigmap hooks install claude --prefetch` adds a `UserPromptSubmit` hook that runs `sigmap ask` on each substantive prompt and gives the model the top
  five files with signatures and `:start-end` anchors. It needs no MCP server and adds no tool definitions. It stays silent for slash commands, prompts under four words, a prompt it cannot read
  (under 90% ASCII letters) and a project with no index. `SIGMAP_PREFETCH=0` turns it off. See [the prefetch hook](/guide/cli#the-prefetch-hook).
- **`index` plus `locate`** (opt-in): `{ "strategy": "index", "mcp": { "tools": "locate" } }` in `gen-context.config.json`, and the MCP server registered. The model carries a short map and
  two tools, `query_context` and `get_lines`, about 426 tokens of definitions a turn. It drops the impact, callee and verification tools, so it is for *where is this implemented?* questions.
  See [tool profiles](/guide/mcp#tool-profiles-core-locate-or-all).
- **`index` plus `core`** (the documented setup): seven tools, about 1,505 tokens of definitions a turn, for an agent that also edits and checks code. The study measured location questions,
  not editing, so it does not say whether `core` pays for an editing agent.

## What not to use

Measured in Claude Code with Haiku 5.5 on famous frameworks: the old default (`current`, the full section and every tool) cost **+9%** more than no SigMap, the `lean` section **+16%**,
and a skill the agent is told to call first **+25%**. A skill the agent may call or not was never called (0 of 270 runs), so it changed nothing.

## Where it saves more, and where it does not

- **More:** code the model has not read (on SigMap's own source `index` cut a task's cost 28% to 44% on every model); a weaker model (Haiku 4.5 saved 29% even on famous frameworks); and
  repositories where the unaided agent already spends a lot per question (for `prefetch`, a rank correlation of 0.66 between a repository's baseline cost per run and its saving; you
  cannot see that cost without running the baseline, which is why it does not help you choose in advance).
- **Less:** famous frameworks with a strong model in Claude Code (+3% to +4%, the model already knows where things are), and small repositories where the agent finds the file in about
  four calls.
- **Mind the language and the ranking.** The hook ranks with a tokenizer that reads only A-Z, a-z and 0-9, so it says nothing for a prompt written mostly in another script, and the
  saving is not free where the ranking is weak: on one repository the unaided agent found the file more often than the one that trusted the list.

## Find out for your own project

Nothing offline predicts the saving, so there are three ways to know, from cheapest to most reliable.

**1. Ask SigMap what it can tell you for free.** `sigmap advise` runs offline and spends nothing. It reports what each setup adds to a turn in your project, how often SigMap's first five
files hold the file a recent change of yours touched against a single-shot grep, and whether your prompts are readable by the hook. It makes **no call and prints no percentage**, and says so:
in the study the numbers it reports did not predict the saving.

```
$ sigmap advise
...
What each setup adds to a turn (tokens, estimated as chars/4; ...):
  tools, locate profile      278   (2 tools: query_context, get_lines)
  tools, core profile        953   (7 tools)
  tools, all               2,561   (22 tools)
  prefetch hook                0   standing; one block per prompt, at most ~2,048; ...

Questions mined from your git history since 2025-11-14: 12 (55 commit(s) examined; ...)
  the file is in SigMap's first five   9 of 12 (75%, 95% interval 47% to 91%)
  the file is in a single-shot grep's  1 of 12 (8%, 95% interval 1% to 35%)
  headroom (SigMap minus grep)         +67 points
  the prefetch hook would fire for     12 of 12 of those titles as prompts

What this does NOT do: it makes no call and prints no saving. ...
```

That is SigMap's own repository, whose ranker was tuned on questions like these, so it is the best case; a repository where SigMap's first five hold the file no more often than grep's shows
a headroom near zero. Read it as a description of how well SigMap finds things in your project, which is a reason to try a setup and not a measure of what it will save. The
[`advise` reference](/guide/cli#advise) lists the options.

**2. Watch your own sessions.** `sigmap hooks install claude` records each Claude Code session's usage from its transcript, and `sigmap --report --sessions` totals it (a cost *floor*, with the
provenance of every figure). Switch the prefetch hook on and off with `SIGMAP_PREFETCH=0` for a few weeks and compare. This is indicative only: your tasks differ from week to week, and nothing here
pairs a question with itself.

**3. Measure it, paired.** The study's harness runs the same questions with and without a setup against a real agent and pairs them. It spends real money, so look at the plan first. It lives in the
SigMap repository, not in the npm package, so clone it:

```bash
# 1. questions from your repository's own merged changes (a public GitHub repository; needs network, no key)
node scripts/build-heldout-set.mjs --out ./my-root --repos owner/name --max-per-repo 12

# 2. the plan and the worst-case spend; spawns nothing (the study used --model claude-haiku-5-5)
SIGMAP_XREPO_DATA=./my-root node scripts/run-agent-ab.mjs --agent api --model claude-haiku-5-5 --sigmap-variant prefetch --runs 4 --dry-run

# 3. the real run: ANTHROPIC_API_KEY, --max-budget-usd caps each run; try --sigmap-variant index and locate the same way
SIGMAP_XREPO_DATA=./my-root ANTHROPIC_API_KEY=... node scripts/run-agent-ab.mjs --agent api --model claude-haiku-5-5 --sigmap-variant prefetch --runs 4 --save
```

Read the typical-task change with its interval, and the file found beside it: a saving whose interval includes zero is not a saving, and a small set of questions only sees a large change (the study's
30 to 45 questions with two to four repetitions saw a change of about 10%, not a smaller one). A repository needs at least 8 qualifying changes since `--since` (default 2026-07-01) to contribute
questions; lower `--min-per-repo` or move `--since` back for a quieter one. The [study protocol](/guide/agent-study-protocol) says how the numbers are formed, and [Measure AI credits](/guide/measure-ai-credits) is the same idea against GitHub's own billing view for Copilot.

## What this page does not say

Twenty repositories, one cheap model and one agent (the Messages-API agent); the installed hook was measured on eight repositories in Claude Code, picked after earlier results. The question stage
scores whether the agent names the right file, not the quality of anything it writes, so nothing here says whether SigMap changes the quality of a patch. See [Where this can mislead](/guide/agent-study#where-this-can-mislead).
