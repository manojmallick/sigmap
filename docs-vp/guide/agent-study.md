# Agent study: results

Does an AI coding agent use fewer tokens, less money and less time with SigMap than without it, and does it still find the answer? This page
has the measured answer, how SigMap works when it is set up the way these runs set it up, and what to take from that for your own repository.
The plan these runs follow was fixed first and is on [the protocol page](/guide/agent-study-protocol); it copies the method of the stet.sh
article [*"I Tested Six Ways to Save $$$ on 5.6 Sol"*](https://www.stet.sh/blog/gpt-56-token-saving-modes): a baseline against treatments,
every arm repeated, the whole-batch estimate beside a paired typical-task estimate, an interval on every claim.

**What was run:** 20,120 agent runs: 10,248 in Claude Code ($72.82 as the agent reported it) and 9,872 in a small Messages-API agent ($85.50
computed from usage and prices). Of those, 4,920 are the first question study, 2,660 the first two controls (a placebo arm, and five
repositories SigMap was not tuned on), 4,668 the second round (fifteen more repositories and a two-tool profile), 144 the change-task stage and
7,728 the hook rounds (the real hook in a live Claude Code session, the same text in the prompt, what went wrong with the first comparison, and
whether focusing the query shows up in an agent's cost, on the eight repositories and on the twelve others). Every run is one row of
[`benchmarks/agent-study/data/runs.ndjson`](https://github.com/manojmallick/sigmap/blob/main/benchmarks/agent-study/data/runs.ndjson);
every number on this page is `node benchmarks/agent-study/summarize.mjs` over that file.

## The short answer

- **Across twenty repositories SigMap was never tuned on, no setup met the bar set beforehand for "saves reliably".** Haiku 5.5, real cost,
  the repository as the unit (pooled by resampling repositories): `index` **−1% [−8, +5]** (3 repositories save, 15 no clear change, 2 cost
  more), `prefetch` **−7% [−19, +4]** (7 / 8 / 5), `locate` **−7% [−13, −2]** (4 / 16 / 0). The bar needed a pooled interval below zero,
  half the repositories saving and at most 15% costing more. Only `locate` has a pooled interval below zero, and a small one.
- **It saves where the work it replaces is expensive.** On SigMap's own source, which the models have not read and where its ranker was
  tuned, `index` cut the real cost of a task by **28% to 44%** on every model and both agents. Among the twenty unseen repositories the
  savings are in the ones where the unaided agent already spends the most (for `prefetch`, a rank correlation of 0.66 between a repository's
  baseline cost per run and the saving; it is not size or language), and the biggest is `flamingock-java` (−37%, −64%, −42% for `index`,
  `prefetch`, `locate`). Where the unaided agent finds the file in about four calls there is little to remove.
- **It is not just text in the prompt.** A size-matched block of generic search guidance, with no SigMap in it, did not produce the saving:
  against that placebo `index` is still −38% and −27% (Sonnet 5.5, unfamiliar and famous questions) and −46% and −37% (Haiku 5.5). On
  Haiku 5.5 the placebo on its own *raised* cost by 7% to 17%. On the first five unseen repositories the Sonnet comparison is inside the noise.
- **`index` adds tokens it rarely earns back.** Pooled over the twenty repositories Haiku 5.5's total tokens were **+51%** with `index`
  (tool calls −15%, time +3%). A smaller tool list helps: `locate`, which keeps only the two tools agents used (`query_context` and
  `get_lines`), is **−4% [−7, −2]** against `index` for Haiku 5.5 (−3, −3, −9, −2 in the four repetitions) and **−10% [−16, −4]** for Sonnet 5.5
  (five repositories), with total tokens −20% and −23%.
- **`prefetch` saves time and tokens, and costs on some repositories, when the benchmark puts the text in the prompt.** Putting `sigmap ask`'s
  ranking after the question, with no tools and no standing section: pooled over the twenty repositories cost −8% [−11, −4], total tokens
  −27%, tool calls −44% and time −18%, but it was clearly dearer on five of them (up to +31%) and the file was found in 798 runs of 888
  against 809 without it.
- **The installed hook saves about a third of what the same text saves when it is in the prompt.** On a clean comparison (Haiku 5.5, eight of
  the twenty repositories, every run a first ask, the hook and the prompt text ranking the identical question; 348 pairs each): the text in the
  prompt took real cost **−12% [−15, −9]**, tool calls −54%, time −22% and total tokens −32%, but the file was found in 315 runs of 348 against
  328 without it; the hook took cost **−4% [−7, −1]**, tool calls −41%, time −11% and tokens −23%, found 321 against 326. Pair for pair the hook cost
  **+6% [+4, +9]** more than the prompt text. Three changes to what the hook prints (plain stdout, a firmer header, a shorter block) did not
  close the gap. A hook cannot put text in the user's own turn; Claude Code adds its output as a separate `<system-reminder>`, and the agent
  checks that list more than it checks the same text in its prompt. My first comparison got this wrong in both directions, for two reasons
  that are described [below](#the-real-hook-and-the-same-text-in-the-prompt).
- **It does not save on famous frameworks in Claude Code with a strong model.** With Haiku 5.5 on 45 questions about gin, flask, django,
  rails and the like the typical task cost **+3% to +4%** with intervals that include zero, and tokens rose by about a fifth. The model
  already knows those repositories: asked with no repository and no tools it names the expected file for 40 of the 45 questions, and for
  none of the 30 about SigMap's source.
- **A weaker model saves on the famous frameworks too.** Haiku 4.5 in Claude Code: `index` cost −29% [−35%, −23%].
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
tools instead of twenty-two.

Two things the study led to are now in SigMap, both opt-in:

- **`"mcp": { "tools": "locate" }`** advertises only `query_context` and `get_lines`, the two tools agents used. It cuts the tool definitions
  from 1,505 tokens to 426 on every turn and was cheaper than `core` on the same questions (−4% for Haiku 5.5 over 887 paired runs, −10% for
  Sonnet 5.5 over 110). Use it when you ask where code is; keep `core` when the agent also changes and checks code, because `locate` drops
  the impact, callee and verification tools and the study did not test those. See [tool profiles](/guide/mcp#tool-profiles-core-locate-or-all).
- **`sigmap hooks install claude --prefetch`** is the route that needs no tools at all. A Claude Code `UserPromptSubmit` hook runs
  `sigmap ask` on each substantive prompt and hands the model the ranking as context before the turn starts. The study's `prefetch` puts
  the same text in the prompt itself; the installed hook was measured separately (`prefetch-hook`) and **its saving is not established**
  ([the real hook](#the-real-hook-and-the-same-text-in-the-prompt)). It skips slash commands and prompts under four words, never repeats a block already in the conversation, and caps the block
  at 8 KiB. See [the prefetch hook](/guide/cli#the-prefetch-hook) for what it does and does not do.

**What the model carries.** With `strategy: "index"` the `CLAUDE.md` section is a map of about 0.8k tokens (761 on the API's
token counter): the modules and how many files and signatures each holds, the entry points, and how to ask. It contains no signatures.
The seven `core` tool definitions add another 1.5k (1,505), so the setup adds **2,266 tokens to every turn**. For a snapshot of SigMap's own repository the
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
setup adds 2.3k tokens that are re-read on every one of them, so the saving is gone.

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

**First asks and repeats, Claude Code rows.** Each Claude Code number above pools two runs of every question: its first ask, and a repeat
minutes later in the same checkout, which Claude Code serves from the prompt cache. A repeat is not what a user's question looks like. On
first asks alone: `index` on SigMap's own source **−28% [−39, −16]** (repeat −44%), `prefetch` there **−23% [−31, −13]** (repeat −45%),
`prefetch` on the famous frameworks **+16% [+5, +27]** (repeat −14%), `index` on the famous frameworks +5% [−3, +13] (repeat +3%). Most other
Claude Code series show no gap between the two (`lean`, `current`, the skills, Haiku 4.5; one earlier `index` series on the famous
frameworks went from +8% to −1%), but the ones that add question-specific text show a large one. The Messages-API rows are not affected: `prefetch` there, by repetition, was −9%, −8%, −3% and −10%. Every Claude Code row
in `data/runs.ndjson` is tagged `ask: first | repeat`, and `summarize.mjs --ask first` reads first asks only.

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
| `current` | the full generated section and the default MCP tool profile (4.3k tokens a turn) | **+9%** [+4, +14] | +41% | −17% |
| `lean` | seven tools and a three-line section (1.0k a turn) | **+16%** [+11, +20] | +34% | +41% |
| `skill-always` | a skill whose description asks to be called first | **+25%** [+20, +30] | +61% | +67% |
| `skill` (two runs) | one short skill the agent may or may not call | −5% [−9, −1], +1% [−3, +6] ~ | −9%, 0% ~ | −16%, −4% ~ |
| `skill-shipped` | the three skills `sigmap skills install --client claude` writes | −1% [−5, +4] ~ | −1% ~ | −7% ~ |

The optional skills were never called (0 of 270 runs), so they cost and saved nothing; the one that was forced was called in 90 of 90 runs
and then the agent did its usual `Grep` and `Read` on top. Two identical runs of the `skill` setup differ by 6 points in cost, which is
the noise floor of a 90-pair row.

### Is it SigMap, or just text in the prompt?

The runs where the API agent saved cost while almost never calling SigMap raised a fair doubt: maybe any block of text in the prompt does
it. The control is a **placebo**: a size-matched block of generic code-search guidance (it carries the same kind of advice the SigMap
section does and nothing about SigMap or the repository), in the same place, with no tools. The `index` setup adds 2,266 tokens to every
turn on the API's token counter; the placebo adds 2,170. Same questions, same repetitions, each arm against its own no-SigMap baseline, and
`index` against the placebo directly (typical task, real cost; the repetitions are in brackets).

| Agent · model · set | placebo against nothing | `index` against nothing | **`index` against the placebo** |
|---|---:|---:|---:|
| Haiku 5.5 · unfamiliar | **+17%** [+9, +26] | −37% [−46, −25] | **−46%** [−54, −37] (−43 −47 −49 −44) |
| Haiku 5.5 · famous | +7% [+1, +13] | −33% [−37, −29] | **−37%** [−40, −34] (−34 −38 −38 −38) |
| Sonnet 5.5 · unfamiliar | −11% [−18, −4] | −44% [−53, −34] | **−38%** [−47, −27] (−38 −37) |
| Sonnet 5.5 · famous | −4% [−11, +5] ~ | −28% [−35, −21] | **−27%** [−34, −20] (−27 −28) |
| Haiku 5.5 · unseen repositories | +11% [+5, +17] | −7% [−12, 0] | **−19%** [−24, −14] (−21 −15 −18 −22) |
| Sonnet 5.5 · unseen repositories | −1% [−10, +8] ~ | −8% [−18, +2] ~ | −7% [−16, +2] ~ |

The rule written before the runs: if the interval for `index` against the placebo is entirely below zero and every repetition points the
same way, the saving cannot be explained by the prompt text. That holds in five of the six rows. The generic guidance on its own did not
save on the famous questions and, on Haiku 5.5, made things *more* expensive (total tokens +60%: it adds tokens). So the placebo is
a poor stand-in for "nothing" and a fair test of "text instead of an index". On the unseen repositories with Sonnet 5.5 the data cannot
tell SigMap from the guidance: both are near zero.

### First round: five repositories SigMap was not tuned on

The first results rested on one repository, and it was SigMap's own. This set takes five others, one per language (Python, TypeScript, Go,
Rust, Java), chosen by a rule that was fixed before looking: the first repository in star order, 100 to 500 stars, created before 2026,
pushed recently, with at least 15 merged pull requests since July. The 55 questions are the titles of those merged changes and the label
is the source files each change touched (`scripts/build-heldout-set.mjs`; nothing was edited by hand). It is a fair test, not a flattering
one: the labels are noisy, and the closed-book control shows the models already guess a good share of them.

| Repository (language, questions) | closed-book hit (Haiku · Sonnet) | `index`, Haiku 5.5 | `index`, Sonnet 5.5 | `prefetch`, Haiku 5.5 |
|---|---:|---:|---:|---:|
| `stefankoegl/python-json-patch` (Python, 12) | 6/12 · 6/12 | +2% ~ | −8% ~ | **+19%** |
| `statelyai/agent` (TypeScript, 12) | 1/12 · 3/12 | −5% ~ | −2% ~ | **−27%** |
| `ionos-cloud/cluster-api-provider-proxmox` (Go, 9) | 5/9 · 8/9 | **+24%** | −8% ~ | **+31%** |
| `timescale/timescaledb-toolkit` (Rust, 11) | 4/11 · 10/11 | −3% ~ | +13% ~ | −3% ~ |
| `flamingock/flamingock-java` (Java, 11) | 0/11 · 0/11 | **−37%** | **−32%** | **−64%** |
| **all five** | 16/55 · 27/55 | **−7%** [−12, 0] | **−8%** [−18, +2] ~ | **−18%** [−25, −10] |
| the two with closed-book ≤ 30% for both models (`agent`, `flamingock-java`) | | **−22%** [−30, −13] | **−18%** [−31, −2] | **−48%** [−54, −41] |

Real cost, typical task, SigMap arm against its own no-SigMap arm (the repetitions are 4 for Haiku 5.5 and 2 for Sonnet 5.5; Sonnet 5.5 was
not run with `prefetch` here). Found: `index` 205 of 219 against 204 (Haiku 5.5) and 107 of 110 against 106 (Sonnet 5.5); `prefetch` 202 of
220 against 202. The other measures on all five: Haiku 5.5 `index` total tokens +40% [+28, +53], tool calls −18% [−23, −11], seconds
+4% [+1, +8]; Haiku 5.5 `prefetch` tokens −42%, tool calls −52%, seconds −24%; Sonnet 5.5 `index` tokens +26% [+9, +44], tool calls −21%,
seconds −18% [−24, −11].

What this says, without rounding it up:

- **One repository carries the saving.** On `flamingock-java`, the one the models cannot guess (0 of 11 closed-book), every setup saves,
  by a third to two thirds. On the other four `index` is inside the noise for both models, except for the +24% above. The data cannot say
  why: unfamiliarity alone does not decide it (`statelyai/agent` is nearly as unknown, 1 of 12 closed-book for Haiku 5.5, and `index` saved
  nothing clear there), so with five repositories size, language, question style and luck cannot be told apart. On a one-module library
  (`python-json-patch`, closed-book hit 50%) there is nothing to save and `prefetch` costs 19% more.
- **The "cleaner cut" is mostly that one repository.** The two repositories with a closed-book hit of 30% or less give −22% and −18% for
  `index`, but that is `flamingock-java` at −37% and −32% averaged with `agent` at −5% and −2%.
- **On Haiku 5.5, `index` can cost more.** +24% on `cluster-api-provider-proxmox`, where it added tokens (+137%) without removing enough
  turns. That is the turn arithmetic of the first results again: a standing 2.3k tokens must buy back at least as many turns as it costs.
- **Time and tokens do not follow cost.** `index` raised total tokens on the unseen set for both models while cost fell slightly; only
  `prefetch` lowered tokens, tool calls and seconds together.

### Twenty repositories, and a two-tool tool list

Five repositories could not say how often SigMap saves, so the rule that chose them was continued down the same list: fifteen more
(`scripts/select-heldout-repos.mjs`, `build-heldout-set.mjs`; one more, `emilk/egui_plot`, was refused by the harness's own check that a
copy is clean at its pinned commit, before any model call, and is not in the set). Twenty repositories in eight languages and 222 questions
taken from their merged changes, Haiku 5.5, four repetitions, `index`, `prefetch` and `locate` each against its own no-SigMap baseline.
`locate` is `index` with the tool list cut from seven to the two tools agents actually called, which takes the tool definitions from 1,505 tokens
to 426 (marginal, on the API's token counter), 1,079 fewer on every turn.

The bar was written first (see the protocol): the pooled estimate, resampling repositories, entirely below zero; at least half of the
repositories saving and at most 15% costing more; the file found to within two points of the baseline.

| Haiku 5.5 · 20 repositories | pooled real cost | saves · no clear change · costs more | file found (baseline) | tokens · tool calls · seconds, pooled over questions | bar |
|---|---:|---:|---:|---|---|
| `index` | −1% [−8, +5] ~ | 3 · 15 · 2 | 805/887 (813/887) | +51% · −15% · +3% | not met |
| `prefetch` | −7% [−19, +4] ~ | 7 · 8 · 5 | 798/888 (809/888) | −27% · −44% · −18% | not met |
| `locate` | **−7%** [−13, −2] | 4 · 16 · 0 | 811/888 (812/888) | +17% · −16% · +2% | not met (4 of 20 save) |

Over the fifteen repositories not in the first round the same three rows are +0% (`index`), −4% (`prefetch`) and −6% [−9, −3] (`locate`), pooled
over questions. A repository "saves" when its own 95% interval is below zero. Question by question, `prefetch` is the one that moves tokens,
calls and seconds (−8% cost [−11, −4] pooled over questions); by repository it is spread from −64% to +31%.

| Repository (language, files) | `index` | `prefetch` | `locate` |
|---|---:|---:|---:|
| `postgresql-for-doctrine` (PHP, 2,388) | +4% ~ | **−18%** ✓ | −11% ~ |
| `flamingock-java` (Java, 1,207) | **−37%** ✓ | **−64%** ✓ | **−42%** ✓ |
| `statelyai/agent` (TypeScript, 990) | −5% ~ | **−27%** ✓ | −10% ~ |
| `mica-mqtt` (Java, 526) | −8% ~ | +9% ~ | **−14%** ✓ |
| `upjet` (Go, 374) | **−17%** ✓ | **−19%** ✓ | **−12%** ✓ |
| `cluster-api-provider-proxmox` (Go, 320) | **+24%** ✗ | **+31%** ✗ | −3% ~ |
| `GDScript-formatter` (Rust, 297) | **−19%** ✓ | **−31%** ✓ | **−18%** ✓ |
| `Salesforce-Inspector-reloaded` (JavaScript, 260) | −8% ~ | 0% ~ | −10% ~ |
| `pinboard` (PHP, 235) | +7% ~ | **+19%** ✗ | +9% ~ |
| `textbringer` (Ruby, 221) | +13% ~ | **−16%** ✓ | −4% ~ |
| `timescaledb-toolkit` (Rust, 210) | −3% ~ | −3% ~ | +4% ~ |
| `conda/constructor` (Python, 198) | **+16%** ✗ | **+20%** ✗ | −3% ~ |
| `chatmail/relay` (Python, 187) | 0% ~ | **+12%** ✗ | +3% ~ |
| `openscad-playground` (TypeScript, 150) | +2% ~ | −1% ~ | −7% ~ |
| `irb` (Ruby, 145) | −9% ~ | −1% ~ | −12% ~ |
| `keycloak-restrict-client-auth` (Java, 127) | +11% ~ | **−20%** ✓ | −1% ~ |
| `TeleBox` (TypeScript, 121) | +8% ~ | −2% ~ | +3% ~ |
| `livekit/sip` (Go, 113) | +6% ~ | +11% ~ | +5% ~ |
| `fastify-static` (JavaScript, 83) | +5% ~ | +6% ~ | −12% ~ |
| `python-json-patch` (Python, 31) | +2% ~ | **+19%** ✗ | +9% ~ |

✓ saves, ✗ costs more, ~ no clear change (the repository's own 95% interval).

What it says, and does not:

- **There is no pattern by size or language.** The largest repository saves with `prefetch` and not with `index`; a 300-file Rust and a
  370-file Go repository save with all three; a 320-file Go repository costs 24% to 31% more. One thing does track the saving: where the
  unaided agent already spends the most per question, `prefetch` saves more (rank correlation 0.66 across the twenty; 0.33 for `index`,
  0.38 for `locate`). It is an exploratory look, not a test, but it is the turn arithmetic of the first results again: the setup pays
  its fixed cost on every turn and gets it back only if it removes turns.
- **`locate` is the only setup that never clearly costs more**, and the direct comparison with `index` is clean: −4% [−7, −2] over 887
  pairs, with every repetition below zero, and total tokens −20%. Its saving is small (−7% against nothing), and it drops tools that edits
  and checks need, which these locate questions do not exercise.
- **The questions are easy for this agent.** Haiku 5.5 finds the file in about 91% of the baseline runs in about 4.4 calls, so there is
  little to take out. The first round's closed-book control (Haiku 5.5 names an expected file for 29% of the questions with no code at
  all) says the same from the other side.
- **A hypothesis I got wrong.** I expected `index`'s missing time saving to be the cold start of the MCP server. Profiled, the first
  `query_context` after an index build takes 1.4 s on a 1,500-file repository because it builds the body-word cache (0.2 s afterwards), but
  the cache is kept in `.context/` and edits do not rebuild it, so it is a once-per-regeneration cost, not the cause. The cause is turns:
  `index` removed few of them.
- **A bug in SigMap came out of it.** `conda/constructor` has a top-level directory called `constructor`; the generator grouped files by
  directory in a plain object, so that group was `Object.prototype.constructor` and `--adapter claude` wrote no file at all. The module
  list silently dropped such directories. Fixed (with a test that fails on the old code); the affected runs were redone with the fix.

### The real hook, and the same text in the prompt

Every `prefetch` number above is the benchmark putting SigMap's ranking in the prompt. What a user installs is different: the
`UserPromptSubmit` hook, run by Claude Code, whose output Claude Code adds to the conversation. Measuring that took four attempts, and the
first three were wrong in ways worth stating, because they are easy to repeat.

**What the first comparison got wrong.** The first run had the hook at cost −1% and the same ranking in the prompt at −15%, and concluded the
hook delivers less and the route does not explain it. Two flaws in my setup made most of that gap:

1. *Repeated questions.* Every question ran twice in the same checkout, minutes apart. On Claude Code the second run's opening prompt is
   identical to the first's and is read from the prompt cache, which flatters any arm that adds question-specific text. The prompt-text arm on
   the same questions was −4% [−9, +1] on first asks and −27% [−31, −23] on repeats; the hook +1% and −1%.
2. *A diluted query.* The hook ranks the whole prompt it is handed, which here was the question inside about fifty words of instructions; the
   harness ranked the bare question. Against the expected files the bare question puts one in the top five for 61 of 87 questions and first for 32;
   the wrapped prompt, for 47 and 11, and the two lists were never identical. The hook arm had a worse ranking.

The same problem meets anyone who pastes a long prompt, so the hook now focuses a long prompt before ranking it (below).

**The clean comparison.** The prompt is the bare question plus a one-token reference no other run shares (so every run is a first ask), the
instructions that wrapped it move to the system prompt of both arms, and offline the hook's top five then equals the bare question's for all 87
questions. Eight repositories chosen after the earlier results (the five where `prefetch` had cost more and three where it saved; they are not
a sample), 87 questions, Haiku 5.5, Claude Code on a logged-in session, four repetitions (two runs, then two more as a confirmation).

| Haiku 5.5 · Claude Code · 8 repositories · first asks | pairs | real cost, typical task | by repository (pooled · saves · none · costs more) | tokens · tool calls · seconds | file found (without) |
|---|---:|---:|---|---|---:|
| the ranking in the prompt (`prefetch`) | 348 | **−12%** [−15, −9] | −11% [−19, −3] · 4 · 4 · 0 | −32% · −54% · −22% | 315/348 (328/348) |
| the installed hook (`prefetch-hook`) | 348 | **−4%** [−7, −1] | −4% [−14, +5] ~ · 2 · 6 · 0 | −23% · −41% · −11% | 321/348 (326/348) |

Paired on the same questions and repetitions the hook cost **+6% [+4, +9]** more than the prompt text (+4%, +7%, +7%, +7% by repetition;
+9% [+5, +13] when each is measured against its own baseline). The prompt text saves more and finds the file less often (3.7 points fewer
runs than its baseline, against 1.4 for the hook): the agent trusts it more, and trusting a ranking whose top five holds the expected file for
70% of the questions has a price. Per repository, four-repetition real cost for the prompt text and the hook:

| Repository | the ranking in the prompt | the installed hook |
|---|---:|---:|
| `flamingock-java` | **−28%** ✓ | **−28%** ✓ |
| `GDScript-formatter` | **−26%** ✓ | **−19%** ✓ |
| `statelyai/agent` | **−15%** ✓ | +10% ~ |
| `conda/constructor` | **−11%** ✓ | +4% ~ |
| `chatmail/relay` | −6% ~ | −1% ~ |
| `cluster-api-provider-proxmox` | +4% ~ | +11% ~ |
| `python-json-patch` | −1% ~ | +4% ~ |
| `intaro/pinboard` | −1% ~ | −5% ~ |

✓ saves, ~ no clear change (the repository's own 95% interval); no repository costs more under either.

**Why the hook does less.** The traces (the order of each run's tool calls, `trace-analysis.mjs`) say it is not that the hook goes unused: the
answer named a ranked file in 90% of hook runs and 94% of prompt-text runs. The agent's first call was a Grep in 78% of both (93% to 97% without
SigMap). What differs is checking: after the hook it made 2.6 tool calls and read a ranked file in 31% of runs, after the prompt text 1.95 and
22%. Claude Code adds hook output as a separate `<system-reminder>` message after the user's turn (the version used, 2.1.322, takes only
`additionalContext` from this hook, with no way to rewrite the prompt), and the agent looks like it treats a reminder as a lead to verify and
the same words in its own prompt as nearer to settled. That is a reading of the traces, not a tested cause.

**Three deliveries tried, none better.** Prototypes around the product's own `prefetch()` (`benchmarks/agent-study/hooks/prototype-hook.cjs`), each a
change a hook can make: the block as plain stdout (`hook-plain`), under a header that says where to start (`hook-firm`), and cut to about 2.5 KB
(`hook-brief`). Against their own baselines they came out at −7% [−11, −3], −6% [−9, −3] (four repetitions) and −8% [−12, −3]. Against the
shipped hook, measured against each series' own baseline: −2% [−7, +3], −2% [−5, +2] and −3% [−8, +3], none distinguishable from zero; and +7% to
+8% above the prompt text. `hook-firm` passed the screening rule as I had written it (it compared SigMap arm to SigMap arm, and its series'
baseline happened to be 4% cheaper); the confirmation the rule required, with the shipped hook and the prompt text run back to back and the
adjusted comparison declared beforehand as its criterion, gave −3% [−8, +2] and did not pass. `hook-plain` also found the file in 3.4 points fewer
runs than its baseline. Nothing here changes the shipped hook.

What this does not show: eight repositories picked after the fact are not a sample of repositories; one cheap model; where-is-it questions only;
a hook that can only add a reminder, which is the whole of what this version of Claude Code lets a hook do. It does not say a different
version, or another agent, would behave the same. And the only comparison that was planned and passed cleanly is the hook against the prompt
text; the rest is what four runs and one wrong turn left standing.

**Fixing the diluted query in the product.** The hook now reduces a prompt of more than two dozen words to the sentences that say something
(`src/session/query-focus.js`): greetings, instructions about the answer and pasted tool output are left out, a `label: question` lead-in stays with
its sentence, and a short prompt is ranked exactly as written. Judged offline, with no model, on 222 held-out questions inside thirteen kinds of
wrapper (2,886 prompts): the expected file was in the top five for 59% of the raw prompts, 66% after focusing and 72% for the bare question (first
for 28%, 36% and 45%). It recovers `template`, `log` and `context` almost fully (51% → 72%, 46% → 72%, 60% → 70%) and does nothing for a block of
constraints written in ordinary software words (46% → 46%, 55% → 55%). **In an agent:** with the benchmark's own wrapped prompt (every run a first ask), the hook against its baseline took cost **−3% [−6, 0]** with focusing
and **+3% [0, +6]** without it on the eight repositories (1,392 runs), and **−7% [−10, −5]** and **0% [−3, +2]** on the twelve other repositories of the
twenty (2,160 runs; chosen by nothing, they are what was left). Focused against unfocused, each against its own baseline: −6% [−9, −2] and −7% [−10,
−4], negative in seven repetitions of eight. **But on the twelve the focused hook found the file less often:** 483 runs of 540 against 497 for its baseline
(net −14 pairs, p = 0.02; unfocused net +9), mostly on `TeleBox`, where the expected file is in the top five for 3 of 12 questions however the query
is built. Over all twenty repositories the focused hook is −6% [−7, −4] with 13 runs fewer found of 888 (p = 0.08). The honest reading: focusing buys
roughly 5% to 7% of cost and a point or two of accuracy where the ranking is poor, and nothing here guards against a poor ranking. The first attempts, the bug that spent my confirmation split and the limits are in the
[protocol](/guide/agent-study-protocol#afterwards-focusing-the-query-for-long-prompts-a-product-fix-measured-offline).

Reproduce: `node benchmarks/agent-study/summarize.mjs --set heldout-q --by-repo`, `--versus prefetch-hook:prefetch [--adjusted]`, and
`node benchmarks/agent-study/trace-analysis.mjs`. The hook rounds ran on a logged-in session, not API credit (about $13 by Claude Code's own count).

### Change tasks

Stage 2 of the protocol moves from "name the file" to the article's task: the agent gets a bug report and the code as it was before a
merged fix, edits it, may run the repository's tests, and its patch is graded by the fix's own tests, which it never sees. Nine tasks
from SigMap's history after the models' cutoff, 144 runs, $5.39.

| Agent · model | setup | pairs | tests passed with (without) | real cost | tool calls |
|---|---|---:|---:|---:|---:|
| API agent · Haiku 5.5 | `index` | 27 | 3/27 (3/27) | −7% [−17, +3] ~ | −6% [−15, +4] ~ |
| API agent · Haiku 5.5 | `prefetch` | 27 | 3/27 (3/27) | −14% [−27, 0] ~ | **−19%** [−29, −10] |
| API agent · Sonnet 5.5 | `index` | 18 | 1/18 (2/18) | −4% [−18, +12] ~ | −8% [−26, +9] ~ |

**This stage did not work as a test of patch quality, and it says nothing for or against SigMap there.** Of 9 tasks, one (c09, a small
well-specified bug) was solved, and it was solved in both arms. Every other run, with and without SigMap, failed the hidden tests.
The reason is in the grading, not only in the models: `screen-change-tasks.mjs` lists the names each task's hidden tests take out of a
module that do not exist in that module before the fix. For five of the nine tasks (c01, c02, c03, c07, c11) the test needs a name the
real fix *invented* (`maskStrings` in c07, `generatedReason` in c11, `STAGE_NEEDS` in c01), which no bug report can contain. A test
file passes only if every test in it does, so such a file cannot pass without the invented name, whatever the rest of the patch does
(in c07, one of the nine tests in the file calls `maskStrings` directly; the agents' own summaries describe the behaviour the report
asked for, but how many of the other eight tests their patches passed was not recorded). On the other four tasks (c04, c05, c06, c09)
the tests use only names the code already had, and Haiku 5.5 and Sonnet 5.5 solved only c09.

What the runs do show is effort on attempts that mostly failed. The point estimates for cost are below zero (−4% to −14%) and for tool
calls too, but only one interval clears zero (tool calls under `prefetch`), and the repetitions do not agree (`--study`: tokens "saved
both times?" no for all three). Restricted to the four tasks whose tests use no invented names, `index` on Haiku 5.5 reads −17% [−26, −8]
in cost over 12 pairs; that cut was chosen after the results were seen and is exploratory, not evidence.

What would make this stage informative: screen the tasks for invented names *before* running anything (the script is there, and the
next version of `build-change-tasks.mjs` should apply it as a rule), add the equivalence and review graders the article used instead of
only a test file, use more tasks than nine, and a model strong enough to clear them. None of that was done here.

## Where this can mislead

- **The unfamiliar set is one repository, and it is SigMap's own.** Its ranker was tuned on questions like these, so −28% to −44% is the
  best case. The twenty unseen repositories are the correction: −1% for `index` and −7% for `prefetch` and `locate`, none meeting the bar.
  Twenty repositories picked by a star-order rule is still a modest sample of repositories, the labels are the files a commit happened to
  touch, the questions are the commits' titles (some are poor questions), and everything in the second round is one cheap model (Haiku
  5.5; Sonnet 5.5 only on the first five). Run the study on your own repository (below) before quoting any of it.
- **Claude Code and the API agent are different agents.** The API agent carries about 0.9k tokens of fixed prompt and tool definitions where Claude Code carries
  about 12k. The two are never mixed in one row; the difference between them (a 33% saving on the famous frameworks in one, none in the other)
  is itself a result: how much SigMap saves depends on the agent as well as the model.
- **Repeating a question is not free on Claude Code.** The first four rounds ran each question twice in one checkout, and Claude Code reads the
  repeat's identical opening prompt from the prompt cache. That moved the cost of arms that add question-specific text by up to 30 points
  (above). It is why the Claude Code `prefetch` numbers in the tables are read on first asks, and why the hook rounds end with a prompt no two
  runs share. I found this late, from my own comparison going wrong, and the Claude Code rows from before it are the least safe in the study.
- **A sensitivity check on the arm problem.** The protocol page describes how the first runs left a generated file searchable in the
  SigMap arm. Re-summarising the Claude Code famous runs without django and rails (where such a file was most likely to be visible)
  gives `index` +7% [+2, +13] cost: still no saving.
- **Price assumptions.** Haiku 5.5 and Haiku 4.5 costs reproduce the figures Claude Code itself reported to the digit. Sonnet 5.5's output
  price is assumed to be five times its input price; the percentages above do not depend on it, only the dollar amounts.
- **Small samples.** 30 to 45 questions and two to four repetitions see a change of about 10% in the typical task and not a smaller one.
  `~` means exactly that.
- **Localisation, not quality.** The question stage scores whether the agent names the right file, not the quality of anything it
  writes. The change-task stage was meant to measure quality and could not (above), so nothing here says whether SigMap changes the
  quality of a patch.

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
