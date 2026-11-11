# Agent study: results

Does an AI coding agent use fewer tokens, less money and less time with SigMap than without it, and does it still find the answer? This page
has the measured answer, how SigMap works when it is set up the way these runs set it up, and what to take from that for your own repository.
The plan these runs follow was fixed first and is on [the protocol page](/guide/agent-study-protocol); it copies the method of the stet.sh
article [*"I Tested Six Ways to Save $$$ on 5.6 Sol"*](https://www.stet.sh/blog/gpt-56-token-saving-modes): a baseline against treatments,
every arm repeated, the whole-batch estimate beside a paired typical-task estimate, an interval on every claim.

**What was run:** 4,920 agent runs for the question study (2,520 in Claude Code at $46.18 as the agent reported it; 2,400 in a small
Messages-API agent at $41.81 computed from usage and prices), then the change-task stage below. Every run is one row of
[`benchmarks/agent-study/data/runs.ndjson`](https://github.com/manojmallick/sigmap/blob/main/benchmarks/agent-study/data/runs.ndjson);
every number on this page is `node benchmarks/agent-study/summarize.mjs` over that file.

## The short answer

- **SigMap saves money and time where the model has not memorised the code.** On 30 questions about SigMap's own source, `index` cut the
  real cost of a task by **28% to 44%** on every model and both agents (every interval below zero, and a saving in both repetitions), tool
  calls by 46% to 51%, and found the right file as often or more often (53 of 60 against 54 in Claude Code; 107 of 120 against 100,
  55 of 60 against 51 and 48 of 60 against 44 in the API agent).
- **It does not save on famous frameworks in Claude Code with a strong model.** With Haiku 5.5 on 45 questions about gin, flask, django,
  rails and the like the typical task cost **+3% to +4%** with intervals that include zero, and tokens rose by about a fifth. The model
  already knows those repositories: asked with no repository and no tools it names the expected file for 40 of the 45 questions, and for
  none of the 30 about SigMap's source.
- **A weaker model saves everywhere.** Haiku 4.5 in Claude Code: `index` cost −29% [−35%, −23%] on the famous frameworks.
- **Tokens and cost are not the same number.** In the API agent `index` cut Haiku 5.5's cost by a third on the famous frameworks while
  total tokens were flat (+3%, inside the noise) and Sonnet 5.5's tokens *rose* 24% while its cost fell 28%. The baseline writes every
  grep result into the prompt cache, which is billed at 1.25 times a fresh token; SigMap's fixed prefix is written once and read at a
  tenth. Read cost for the bill and tokens for the context, and do not call a saving from one of them alone.
- **Not every way of handing SigMap to an agent works.** The old default (`current`, +9%), the lean section (`lean`, +16%) and a skill
  that the agent is told to call first (`skill-always`, +25%) cost more than no SigMap on Haiku 5.5. A skill the agent may call or not
  was never called and changed nothing.

## Set it up the way the runs did

This is the documented optimum: the **index** strategy and the **core** tool profile. Retrieval is identical under every strategy; what
changes is what the model carries on every turn.

```bash
# in your repository
cat > gen-context.config.json <<'EOF'
{ "strategy": "index", "mcp": { "tools": "core" } }
EOF
npx sigmap --adapter claude      # builds .context/sig-index.json and writes a short map into CLAUDE.md
```

Register the MCP server with your agent (`npx -y sigmap --mcp`; see [MCP](/guide/mcp)). With the `core` profile the agent sees seven
tools instead of twenty-two. If your agent can run a command before the first turn, there is a second route that needs no tools at all:
run `sigmap ask "<the question>"` and put its output after the question. The study calls that `prefetch`.

**What the model carries.** With `strategy: "index"` the `CLAUDE.md` section is a map of about 1.6k tokens: the modules and how many
files and signatures each holds, the entry points, and how to ask. It contains no signatures. For a snapshot of SigMap's own repository the
whole index is 24,647 tokens across 188 files and is not injected into any prompt. With the default `full` strategy the section would carry
the signatures themselves (capped to a token budget), which is what `current` did in these runs: 4.3k tokens re-sent on every turn.

**What happens on a question.** The agent calls `query_context` (or you run `sigmap ask`), SigMap ranks the indexed files against the
question using paths, signatures and the import graph, and returns the top five with their signatures and `:start-end` line anchors,
about 1.4k tokens. The agent then reads only the anchored lines (`get_lines`, or `Read` with an offset) instead of opening files to look
around. An example from the clone, for the question "a function named async is listed as an async function":

```text
1  packages/adapters/willow.js  8.290  299 tok
2  packages/adapters/index.js   6.721  179 tok
3  src/conventions/fix.js       5.121  173 tok
4  src/tracking/pricing.js      4.414  174 tok
5  src/extractors/pipeline.js   4.414  656 tok
5 of 485 files · cutoff 4.414 · 1,429 tokens · sha256:a05279f516ad → .context/query-context.md
```

That ranking is **wrong** for that question (the file that matters is `src/extractors/typescript.js`). That is typical, and it is why the
agent keeps its own `Grep` and `Read`: offline, the expected file is first for 31% of the 45 famous questions and in the top five for
64%, and for the 30 unfamiliar questions first for 20% and in the top five for 53% (`retrieval-rank.mjs`). The agents still found the
file in 80% to 92% of the unfamiliar runs because the ranking is a lead they check, not an answer they accept.

**Why that is cheaper.** Without SigMap Haiku 5.5 in Claude Code took 6.6 turns and 1,690 output tokens a run on the unfamiliar
questions and read 58k tokens from the cache; with `index` it took 3.8 turns, 902 output tokens and 36k cache-read tokens. Fewer turns
means the context is re-sent fewer times, and the model writes less. Where
the model already knows where things are (the famous frameworks in Claude Code) there are few turns to remove (4.3 against 4.3) and the
map is an extra 1.6k tokens re-read on every one of them, so the saving is gone.

## Results

All figures are the **typical task** (the geometric mean of the per-question ratios, so every question weighs the same) with a 95%
bootstrap interval, SigMap arm against its own no-SigMap arm on the same questions, same model, same tools. `~` marks an interval that
includes zero. Negative is cheaper.

### Real cost

| Agent · model | unfamiliar, `index` | unfamiliar, `prefetch` | famous, `index` | famous, `prefetch` |
|---|---:|---:|---:|---:|
| Claude Code · Haiku 5.5 | **−37%** [−44, −29] | **−35%** [−42, −26] | +4% [−2, +10] ~ | 0% [−7, +7] ~ |
| Claude Code · Haiku 4.5 | not run | not run | **−29%** [−35, −23] | not run |
| API agent · Haiku 5.5 | **−37%** [−46, −25] | **−40%** [−49, −29] | **−33%** [−37, −29] | **−18%** [−23, −11] |
| API agent · Sonnet 5.5 | **−44%** [−53, −34] | **−30%** [−39, −20] | **−28%** [−35, −21] | +9% [−2, +22] ~ |
| API agent · Haiku 4.5 | **−28%** [−40, −13] | −13% [−36, +21] ~ | **−19%** [−27, −11] | **−36%** [−43, −29] |

### The rest of `index`

| Agent · model · set | total tokens | tool calls | seconds | file found (without SigMap) |
|---|---:|---:|---:|---:|
| Claude Code · Haiku 5.5 · unfamiliar | −37% [−46, −27] | −51% [−60, −40] | −28% [−34, −22] | 53/60 (54/60) |
| API agent · Haiku 5.5 · unfamiliar | −23% [−36, −5] | −47% [−54, −40] | −8% [−16, 0] | 107/120 (100/120) |
| API agent · Sonnet 5.5 · unfamiliar | −33% [−45, −19] | −46% [−56, −35] | −36% [−42, −28] | 55/60 (51/60) |
| API agent · Haiku 4.5 · unfamiliar | −46% [−61, −25] | −49% [−59, −36] | −31% [−42, −18] | 48/60 (44/60) |
| Claude Code · Haiku 5.5 · famous | **+19%** [+11, +27] | +2% [−8, +13] ~ | +2% [−2, +7] ~ | 88/89 (89/89) |
| Claude Code · Haiku 4.5 · famous | −35% [−42, −26] | −33% [−41, −24] | −20% [−26, −13] | 88/89 (89/89) |
| API agent · Haiku 5.5 · famous | +3% [−6, +12] ~ | −33% [−39, −27] | −11% [−15, −7] | 178/178 (178/178) |
| API agent · Sonnet 5.5 · famous | **+24%** [+10, +39] | −28% [−35, −20] | −19% [−24, −13] | 90/90 (90/90) |
| API agent · Haiku 4.5 · famous | −21% [−33, −7] | −31% [−36, −25] | −15% [−20, −9] | 89/90 (84/90) |

Four things the table shows that a single headline would hide:

1. **Repetitions agree where there is a saving.** Claude Code, Haiku 5.5, unfamiliar: tokens −30% then −45% by whole workload (−30% then
   −42% for the typical task), cost −29% then −46%: a saving in both repetitions, and the same holds for `index` on every unfamiliar
   row. On the famous frameworks the same setup's tokens rose in both repetitions (+20% then +16%).
2. **Where tokens rise, cost often does not.** The API agent on the famous frameworks: Haiku 5.5 without SigMap writes 6,102 tokens a run
   into the cache and with `index` 2,716; Sonnet 5.5 4,451 and 2,264. Re-read tokens are the cheap ones (a tenth of the price), and
   `index` moves tokens from written to re-read. In Claude Code the two arms write the same amount (7.3k tokens a run on the famous
   questions), because its much larger fixed prefix (about 12k tokens) dominates what is written, so there is nothing to move and the cost
   follows the tokens.
3. **A saving is not always SigMap being used.** On the famous questions the API agent called a SigMap tool in only 38 of 178 Haiku 5.5
   runs and 2 of 90 Sonnet runs, yet cost fell 33% and 28%. On the unfamiliar ones it called one in 88 of 120 and 59 of 60. So on the
   famous frameworks part of the cost saving comes from the agent being a little more decisive with a map in front of it, not from
   retrieval, and a model that reads that map but never needs the lookup is saving for a reason that does not need the index.
4. **`prefetch` is the cheapest way to take the tokens out.** Putting the ranking after the question cuts tool calls by 21% to 60% and
   total tokens by 11% to 64% on every row except two (Sonnet 5.5 on the famous questions, −2%, and Haiku 4.5 on the unfamiliar ones,
   −29%, whose intervals include zero), with no tool definitions and no standing section, and it is cost-neutral on the famous
   frameworks in Claude Code (0% [−7, +7]).

### Setups that did not help (Claude Code · Haiku 5.5 · famous)

| Setup | what the agent got | real cost | tokens | tool calls |
|---|---|---:|---:|---:|
| `current` | the full generated section and 22 MCP tools (4.3k tokens a turn) | **+9%** [+4, +14] | +41% | −17% |
| `lean` | seven tools and a three-line section (1.0k a turn) | **+16%** [+11, +20] | +34% | +41% |
| `skill-always` | a skill whose description asks to be called first | **+25%** [+20, +30] | +61% | +67% |
| `skill` (two runs) | one short skill the agent may or may not call | −5% [−9, −1], +1% [−3, +6] ~ | −9%, 0% ~ | −16%, −4% ~ |
| `skill-shipped` | the three skills `sigmap skills install --client claude` writes | −1% [−5, +4] ~ | −1% ~ | −7% ~ |

The optional skills were never called (0 of 270 runs), so they cost and saved nothing; the one that was forced was called in 90 of 90 runs
and then the agent did its usual `Grep` and `Read` on top. Two identical runs of the `skill` setup differ by 6 points in cost, which is
the noise floor of a 90-pair row.

### Change tasks

*Stage 2 of the protocol. Added below when the runs finish.*

## Where this can mislead

- **The unfamiliar set is one repository, and it is SigMap's own.** Its ranker was tuned on questions like these. The saving there is
  real for a model that has not read the code, but it is the best case. Run the study on your own repository (below) before quoting it.
- **Claude Code and the API agent are different agents.** The API agent re-reads about 4k tokens a turn where Claude Code re-reads about
  12k. The two are never mixed in one row; the difference between them (a 33% saving on the famous frameworks in one, none in the other)
  is itself a result: how much SigMap saves depends on the agent as well as the model.
- **A sensitivity check on the arm problem.** The protocol page describes how the first runs left a generated file searchable in the
  SigMap arm. Re-summarising the Claude Code famous runs without django and rails (where such a file was most likely to be visible)
  gives `index` +7% [+2, +13] cost: still no saving.
- **Price assumptions.** Haiku 5.5 and Haiku 4.5 costs reproduce the figures Claude Code itself reported to the digit. Sonnet 5.5's output
  price is assumed to be five times its input price; the percentages above do not depend on it, only the dollar amounts.
- **Small samples.** 30 to 45 questions and two to four repetitions see a change of about 10% in the typical task and not a smaller one.
  `~` means exactly that.
- **Localisation, not quality.** The question stage scores whether the agent names the right file, not the quality of anything it
  writes. That is what the change-task stage is for.

## Repeat it

```bash
# no key: every number above, from the saved runs
node benchmarks/agent-study/summarize.mjs
node benchmarks/agent-study/summarize.mjs --study          # the article's columns: per repetition, "saved both times?"

# your repository, your key: prints the plan and the worst-case spend first, starts nothing without GO=1
GO=1 AGENT=api MAX_TOTAL_USD=25 ANTHROPIC_API_KEY=... bash benchmarks/agent-study/run-token-saving.sh
```

[The protocol](/guide/agent-study-protocol) lists what each variable does and how to read the output; `benchmarks/agent-study/README.md`
describes the data file and the other tools.
