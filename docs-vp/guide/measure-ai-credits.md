---
title: Measure AI credits with and without SigMap
description: A procedure you can run to measure what SigMap changes in your GitHub Copilot AI-credit usage, using GitHub's own billing view — and what sigmap gain does and does not tell you.
head:
  - - meta
    - property: og:title
      content: "Measure AI credits with and without SigMap"
  - - meta
    - property: og:description
      content: "A before/after procedure using GitHub's billing view, so the number you quote is one you measured."
  - - meta
    - property: og:url
      content: "https://sigmap.io/guide/measure-ai-credits"
---

# Measure AI credits with and without SigMap

`sigmap gain` and the cost figures in these docs are **estimates**. They say how many tokens SigMap's context saved *compared with feeding whole files*, priced from a dated table. They are not a record of what your AI client read, and they are not a bill. If you want to know what SigMap does to **your** GitHub Copilot AI-credit usage, measure it: GitHub's own billing view is the only place that number exists.

This page is a procedure, not a result. SigMap does not publish a credits figure, because the answer depends on your tasks, your model and your agent.

## What `gain` tells you, and what it does not

| | `sigmap gain` | GitHub billing |
|---|---|---|
| What it counts | Tokens SigMap emitted vs. the whole-file reads it replaced (a counterfactual) | AI credits your Copilot usage actually consumed |
| How tokens are counted | chars ÷ 4, unless `models.charsPerToken` is configured | GitHub's own accounting |
| How dollars are produced | A dated per-model input-price table (`gain --models`), input tokens only | What GitHub charges for your plan |
| Sees your agent's real behaviour | No — it cannot know what the agent would have read | Yes |
| Good for | Seeing the size of the context SigMap hands over | Deciding whether SigMap changes what you spend |

They answer different questions. A large `gain` figure with no change in credits means the agent was not reading whole files in the first place; a drop in credits with a small `gain` figure means something else changed. Only the second column is evidence about credits.

## Before you start

- A paid Copilot plan that shows **AI usage** in your billing settings. GitHub's [AI usage documentation](https://docs.github.com/en/copilot/how-tos/manage-and-track-spending/monitor-ai-usage) describes where it lives for your plan.
- Know the grain of what GitHub reports. Its [billing reports reference](https://docs.github.com/en/billing/reference/billing-reports) says usage is logged by the **day it occurred, in UTC**, and the report aggregates by date together with other dimensions (such as SKU and model) — it does not list individual requests. That is why the two arms below get separate days.
- Open **Settings → Billing and licensing → AI usage** (`https://github.com/settings/billing`) once and look at the breakdown by model, so you recognise it afterwards.
- A repository you can clone twice, at one fixed commit.

## The procedure

### 1. Fix the task set

Write down 10–20 real tasks you would give the agent ("add a retry to the upload client", "why does the export test fail?"). Use the same wording in both arms. Small samples are noisy; fewer than ten tasks per arm will not tell you much.

### 2. Fix everything else

Keep the same Copilot plan, the same model, the same editor and agent mode, and the same repository commit in both arms. Do not use Copilot for anything else in the measurement window — its usage lands in the same report.

### 3. Prepare two checkouts

| Arm | Checkout |
|---|---|
| **A — without SigMap** | A fresh clone with no SigMap output: no `.github/copilot-instructions.md`, no `CLAUDE.md`/`AGENTS.md` signature block, no `.context/`, and no `sigmap` MCP server registered in the editor. |
| **B — with SigMap** | A fresh clone where you ran `sigmap` (or `sigmap --setup` if you use MCP), exactly as you would in daily work. |

Confirm A really has none of it: `git status --ignored` and a look at your editor's MCP list.

### 4. Run the tasks

Give each arm **whole UTC days of its own**, and alternate the days (A, B, A, B, …) so that drift in the model or in your own habits falls on both arms. Interleaving the arms inside one day would leave the report unable to tell them apart. Split the task list evenly across the days, run the same number of tasks per day in both arms, and stay clear of 00:00 UTC (a run that straddles midnight is split across two rows).

Write down, for every run: the arm, the task, the UTC date, whether the task was completed, and how many follow-up prompts it took.

### 5. Download the report

On the **Metered usage** or **AI usage** page choose **Get usage report**, set the details (pick the detailed AI-credits report and a time frame that covers every arm-day) and choose **Email me the report**. GitHub emails a download link; per GitHub's [billing documentation](https://docs.github.com/en/billing/how-tos/products/view-productlicense-use) the link expires after 24 hours, so download it promptly. The columns, including the AI-specific ones such as `model`, are listed in the [billing reports reference](https://docs.github.com/en/billing/reference/billing-reports).

Check the `model` column: if it shows more than one model on a day, the arms are no longer comparable.

### 6. Compare per completed task

For each arm, add up the AI credits on that arm's days and divide by the number of tasks that were **completed**. Cheaper runs that failed are not savings. Report the per-day figures, the number of runs, and the spread (minimum, median, maximum) across days, not just a mean:

```
              runs   completed   credits   credits / completed task
A (no SigMap)   12        10        ...        ...
B (SigMap)      12        11        ...        ...
```

Then compare with what `sigmap gain` recorded in checkout B for the same period:

```bash
sigmap gain --since 7d --json     # price and totals, with costBasis stating that it is an estimate
```

If the two disagree, believe GitHub's number and treat `gain` as the size of the context SigMap supplied.

## What this will not tell you

- It measures *your* tasks on *your* repository. It does not generalise to other repos, models or agents.
- Credits are not the only cost: time to a correct answer and the share of answers that were right matter too. SigMap's own accuracy measurements are on the [benchmark pages](/guide/benchmark); they are modelled on a corpus, not on your billing.
- A single run of each arm is an anecdote. Repeat it on another week before you quote it.

If you do publish a number from this procedure, include the plan, the model, the task list, the run count and the report window, so someone else can repeat it.
