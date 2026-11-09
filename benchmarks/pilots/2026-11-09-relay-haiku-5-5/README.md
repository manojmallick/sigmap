# Agent A/B through a relay, Haiku 5.5 — 2026-11-09

**Not a published result.** It is a pilot, run through a third-party Anthropic-compatible relay on a free-tier key, with a different model from the harness default, on very few tasks. The repository publishes no agent-level figure; nothing here changes a number in the README or `benchmarks/latest.json`. It is saved so the run can be repeated and the files read.

## Update: the same test on the real API. Read this first.

Added after a way to run without an API key was built (`--session-auth`: the logged-in Claude Code session, which means real Anthropic Haiku 5.5, real prompt caching and real prices, about $0.002 and 12 seconds a run). **30 labelled questions (gin, flask, express, fastify, fastapi) × 2 repetitions × 2 arms = 120 runs, none failed.** SigMap is the `index` variant (the docs' setup) against no SigMap. `session-combined.mjs` reproduces everything from `session-auth/`.

| | SigMap against no SigMap |
|---|---|
| file found | **60/60 against 60/60** |
| real cost, pooled over 60 pairs | **+5%** typical [−1%, +11%], inside the noise (workload +6%); SigMap cheaper in 28 pairs, dearer in 32 |
| total tokens | **+19%** [+11%, +27%], outside the noise (SigMap lower in 13 of 60): the section and tool definitions are re-read every turn (cached, so cheap in dollars) |
| tool calls | −3% [−14%, +9%], inside the noise; 3.2 and 3.2 per run |
| seconds | no difference (12.5 and 12.5) |
| by repo, real cost | express +13%, fastapi +11%, fastify +4%, gin 0%, flask −5% (every interval but express's includes zero) |

What it changes:

- **The agent barely used SigMap's retrieval.** In 60 SigMap runs it called `query_context` 11 times, `get_lines` 55 times and `Grep` 97 times: it searched by itself. The baseline finds the file in about 3 calls for about $0.0023, so on these questions **there is nothing for SigMap to save**, and what it adds (a section and seven tool definitions) is pure overhead.
- **The relay results below describe a different agent.** On the same questions the relay runs took about 10 tool calls and 1 to 2 minutes, against 3 calls and 12 seconds here. I could not separate the causes (the relay's model and caching, or `--bare`'s minimal system prompt against Claude Code's full one); either way, the "long searches where SigMap saves" picture, and the 3× noise, do not transfer to the real agent. The noise is small here (standard deviation of the paired log-ratio 0.22, against 1.11 on the relay), so 60 pairs resolve about ±6%.
- **Verdict on this evidence:** with a strong agent that greps well, on repos of 53 to 7,084 files and questions about where code lives, SigMap in the docs' setup **does not save cost or time, adds about 18% to the token count (cached, so about 3% to the dollar cost, at most about 8%), and finds the file just as often**. It was not shown to help; on large repos it may trim tool calls a little.
- **Large repos, tested next:** the same run on django (7,084 files), rails (4,901) and laravel (3,179), 15 questions, 60 runs, none failed (`session-auth/index-large/`). File found 30/30 against 30/30; real cost **−1%** workload, **0%** typical [−7%, +9%]; tokens +18% [+6%, +32%]; tool calls **−14%** workload, −17% typical [−31%, +1%] (SigMap lower in 16 pairs, higher in 6, equal in 8: the one hint of a gain, with an interval that just touches zero); seconds unchanged. The agent still asked SigMap to retrieve in only 5 of 30 runs. Size of repo made no visible difference to cost.
- **All 45 questions, 8 repos, 180 runs, $0.44:** file found **90/90 against 90/90**; real cost **+3%** typical [−1%, +8%] (SigMap cheaper in 44 pairs, dearer in 46: a coin flip); tokens **+18%** [+12%, +25%]; tool calls −8% [−17%, +2%]; time 0%; `query_context` asked in 16 of 90 runs.
- **`lean` on the same 45 questions (180 runs, $0.46, none failed) is worse than `index` and than no SigMap.** File found 90/90 by both arms, but against its own baseline **real cost +16%** [+11%, +20%] (SigMap cheaper in 17 pairs, dearer in 73), **tokens +34%** [+26%, +42%], **tool calls +41%** [+31%, +53%], seconds +13%, every interval clear of zero. Directly against `index`: cost +11% [+6%, +16%], tool calls +47%. The cause is behaviour, not the prompt size: the lean section names `query_context` and says to confirm with `get_lines`, so the agent obeyed (`query_context` in 89 of 90 runs, `get_lines` 179 times) **and also kept grepping** (124 calls). SigMap became an extra step on top of the agent's own search, not a replacement for it.
- **The earlier projection for `lean` was wrong in sign.** It subtracted the static tokens `lean` drops and held behaviour fixed, and predicted −25% / −6% by workload; measured, tokens are +32% / +34%. Tool definitions and section size were not what decided cost; whether and how the agent is told to use the tool was. The `lean` section is withdrawn as a recommendation.
- **`current` (the old default: `full` strategy, all 22 tools, the generated section) on the same 45 questions: 178 of 180 runs counted, $0.45.** One run timed out at 420 s (`fastapi/x148`, repetition 2, SigMap arm) and that question × repetition is left out for every variant. File found 89/89 by both arms. Against its baseline: real cost **+9%** [+4%, +14%] (cheaper in 36 of 89 pairs), tokens **+41%** [+31%, +50%], seconds 0%, and **tool calls −17%** [−26%, −7%], the only variant with a clear cut in calls (`Read` 90 against 134 for the baseline). It asked SigMap to retrieve in only 4 of 89 runs, so the cut does not come from retrieval: the generated section lists files and signatures with line anchors, which tells the agent where to look and saves it reads, at the price of carrying that text on every turn.
- **Not tested, and where it could still pay off:** weaker models, environments with no grep (chat-only LLMs), repos larger than django, other kinds of task (SigMap also offers impact analysis, grounding checks and other tools this test never asked for), and a prompt that makes the agent use SigMap's retrieval (it ignored it here). Only Haiku 5.5 was run.

### The three setups side by side (45 questions × 2 repetitions, 89 paired cases)

Each column is that setup's SigMap arm against its own baseline run in the same invocation: typical task, 95% interval, `~` = the interval includes zero. `session-combined.mjs` prints it.

| | `index` | `lean` | `current` |
|---|---|---|---|
| what the agent is given | `index` strategy, 7 core tools, SigMap's own text | 7 core tools, a three-line section | `full` strategy, all 22 tools, the generated section |
| file found | 90/90 | 90/90 | 89/89 |
| real cost | **+3% [−1%, +8%] ~** | +15% [+11%, +20%] | +9% [+4%, +14%] |
| total tokens | +18% [+12%, +26%] | +33% [+26%, +42%] | +41% [+31%, +50%] |
| tool calls | −8% [−17%, +2%] ~ | +41% [+31%, +53%] | **−17% [−26%, −7%]** |
| seconds | 0% ~ | +13% [+9%, +17%] | 0% ~ |
| asked SigMap to retrieve | 16 of 90 runs | 89 of 90 | 4 of 89 |
| cheaper than its baseline | 43 of 89 pairs | 17 of 89 | 36 of 89 |

Against `index` directly: `lean` costs +10% [+6%, +15%] and makes +47% more calls; `current` costs +5% [0%, +10%] and uses +22% more tokens with −8% calls.

- **No setup was cheaper than no SigMap.** `index` is the closest to neutral and the only one whose cost interval includes zero.
- **They trade differently.** `current` buys fewer tool calls (its inline signature map saves reads) with a heavier prompt; `lean` makes the agent do extra steps; `index` does little of either. None changed the time, and all found the file every time.
- **An agent that already finds the file in about 3 calls has little to give up to SigMap and little to gain from it.**

## How it was produced

| | |
|---|---|
| Harness | `npm run benchmark:agent-ab` (`scripts/run-agent-ab.mjs`), the per-repetition report from this branch |
| Agent | Claude Code 2.1.319, `--bare`, read-only tools, one clean copy of each pinned repo per arm |
| Model | `claude-haiku-5.5`, the only Claude model the key's tier (free) could use; `claude-sonnet-5.5` is Plus-tier and was refused with a 403 |
| Endpoint | an Anthropic-compatible relay, reached through `scripts/agent-ab-compat-shim.mjs` (drops the empty `{"role":"system","content":[]}` message the relay's validator rejects; changes nothing else) |
| Repos | gin, flask, express, fastify, fastapi at the commits in `benchmarks/xrepo-repos.json` |
| Repetitions | 2 per arm (the harness's own publishable minimum is 4, so every report here says NOT PUBLISHABLE) |

## What a relay changes about the numbers

- **Cost rows are not the relay's bill.** The agent computes `total_cost_usd` itself, for a model name it may not price. The relay debited this key at 3× raw tokens (its dashboard: 1,588 raw tokens → 4,764 debited). Read tokens, tool calls and hit@5; read spend from the relay's dashboard.
- **The relay's caching may differ from Anthropic's**, so uncached input and cache-read figures describe this relay, not the API.
- **The report is only as good as the relay's claim to serve the model it names.** I could not verify that.
- **Haiku is not the harness default.** Nothing here says how Sonnet or any other model behaves.

## Reproduce it (your own key, your machine)

```bash
git checkout ccr-5bbe0b89-62tsxy
npm run fetch:xrepo -- --only gin,flask,express,fastify,fastapi
# Linux only: the harness scrubs the agent's environment, which needs bubblewrap
sudo apt-get install -y bubblewrap

# terminal 1 — the shim (use your relay's base URL)
node scripts/agent-ab-compat-shim.mjs --upstream https://<your-relay> --stats shim-stats.json

# terminal 2 — see the plan and worst-case spend first, then run
export ANTHROPIC_BASE_URL=http://127.0.0.1:18082
export ANTHROPIC_API_KEY=<your relay key>
npm run benchmark:agent-ab -- --dry-run --repos gin,flask,express,fastify,fastapi --tasks-per-repo 2 --runs 2 --model claude-haiku-5.5
npm run benchmark:agent-ab -- --repos gin,flask,express,fastify,fastapi --tasks-per-repo 2 --runs 2 \
  --model claude-haiku-5.5 --max-budget-usd 0.3 --timeout-ms 420000 \
  --save --allow-unpublishable --out-dir ./ab-out --raw-out ./ab-out/raw.json
```

`run-remaining.sh` (see "What would settle it") does the remaining questions one at a time and can be rerun after an interruption.

`GET <relay>/v1/models` lists the model names your key may use. Use `--runs 4` for a report the harness treats as publishable.

The commands above run the `current` arm. Add `--sigmap-variant index` (the docs' setup for an agent that calls the tools) or `--sigmap-variant lean` (the smallest) to run those instead; run one variant per invocation. Do both against a fresh baseline each time.

## Result: 10 tasks × 2 repetitions × 2 arms = 40 agent runs, none failed

`full-40runs/agent-ab.md` is the report. Both estimates are per repetition; a change is SigMap's arm against the no-SigMap arm, so negative means SigMap used less. `†` = the 95% interval includes zero.

| | R1 workload | R2 workload | R1 typical task | R2 typical task | verdict (typical task) |
|---|---:|---:|---:|---:|---|
| Tool calls | 0% | +11% | −11% † | +7% † | mixed |
| Total tokens (derived) | +12% | +42% | +7% † | +68% † | more both times, within the noise |
| Cache-read tokens | +72% | +126% | +58% | +128% | more both times, **outside** the noise |
| Input tokens (uncached) | +2% | +29% | −3% † | +59% † | mixed |
| Output tokens | −22% | +10% | −20% † | +28% † | mixed |
| Wall time | −21% | +10% | −23% † | +13% † | mixed |
| Cost (the agent's arithmetic, **not** the relay's bill) | 0% | +29% | −4% † | +57% † | mixed |

| Found the file (hit@5) | without SigMap | with SigMap | better / worse / tie, per paired task |
|---|---:|---:|---|
| 10 tasks × 2 repetitions | 18 / 20 | 20 / 20 | 2 / 0 / 18 |

The two misses were the no-SigMap arm on `flask/x032` and `fastapi/x145`, both in repetition 2.

**Read it as:** on this slice SigMap did not reduce tokens, tool calls or time in both repetitions, and it found the file at least as often (2 wins, 0 losses out of 20 pairs, too few to call). Its generated section is read on every turn, which is where the extra cache-read tokens come from. The workload total and the typical task disagree about several rows, which is why both are shown, and with 10 tasks the typical-task intervals are wide (about 70 to 220 percentage points across, e.g. total tokens in R2 is +68% with an interval of −11% to +198%): most of what moved is inside the noise. The baseline's own mean total tokens per task barely changed between repetitions (115.6k → 111.9k, −3%), while SigMap's arm's rose (129.6k → 158.6k, +22%), so repetition 2 is where SigMap looks worse.

**What this does not say:** nothing about Sonnet or Opus, another agent, other tasks, or edit quality (the harness asks where code lives and grades nothing else). It says nothing about SigMap's other published claims. It rests on the relay serving the model it names.

## Where it helped and where it hurt

Per task and repetition (20 paired cases), SigMap's arm used **fewer** total tokens in 8 and **more** in 12. The effect is bimodal, not a flat overhead:

- **Fewer, −20% to −78%** (8 cases): fastify/x138 R2 (236k → 52k), flask/x032 R1 and R2 (399k → 132k, 360k → 183k), fastapi/x145 R1 and R2, fastify/x137 R1, fastify/x138 R1, gin/x002 R1 (−2%). Seven of the eight were questions where the baseline spent 84k+ tokens, usually 15 to 28 tool calls of searching.
- **More, +32% to +439%** (12 cases): express/x038 R2 (27k → 146k), fastapi/x146 R2 (83k → 348k), gin/x002 R2 (22k → 73k), flask/x033 R1 and R2, and others. Ten of the twelve were questions the baseline answered in under 90k tokens.
- **What the agent did:** in all 20 SigMap runs it used SigMap's tools (`get_lines` 115 calls, `search_signatures` 72, `query_context` 22) and read files directly 10 times, against 156 `Read` calls in the baseline. It swapped reading for many small SigMap calls, and carried SigMap's generated section and tool definitions on every turn (this arm uses the default full 22-tool profile, not `mcp.tools: "core"`). Where the baseline needed a long search that swap saved tokens; where it did not, the fixed per-turn cost was larger than anything saved.
- This is a pattern in 20 cases, offered as a hypothesis (SigMap pays off on questions that are hard to search, costs on easy ones) and not a finding. It was not tested by changing the tool profile or the generated section's budget.

## Against the stet.sh study (indicative only)

[stet.sh's study](https://www.stet.sh/blog/gpt-56-token-saving-modes) ran the same shape of experiment (10 tasks, 2 repetitions, workload total and typical task) on six token-saving modes. **It is not the same experiment:** a different agent (Codex CLI), model (GPT-5.6 Sol) and tasks (ten merged edits in one repo, graded on patch quality), against this run's Claude Code, Haiku 5.5 via a relay, and where-is-this-file questions on five open-source repos. Read the table as "same kind of question, different world", not as a ranking.

| Tool | what it does | total tokens, workload R1 / R2 | typical task R1 / R2 | cut tokens in both repetitions? |
|---|---|---:|---:|---|
| Caveman | terse dialogue | +7% / −11% | −5% / −9% | no |
| Ponytail | write less code | +16% / −1% | +8% / −3% | no |
| RTK | filter shell output | +18% / −8% | +18% / −5% | no |
| Terra (cheaper model) | changes model and price | +6% / +5% | −23% / −12% | no (cost −49% both times) |
| **SigMap `current` (measured, 10 tasks)** | **ranked context + MCP tools** | **+12% / +42%** | **+7% / +68%** | **no** |
| *SigMap `lean`, modelled on the same 40 runs* | *the static prompt it no longer sends, subtracted* | *−25% / −6%* | *−36% / +2%, intervals include zero* | *workload yes, typical task no; **not a measurement*** |
| *SigMap `lean`, measured, 1 task (gin/x001)* | *same index, 7 tools, 3-line section* | *−36% / −20%* | *one task, no interval* | *a direction only* |
| *SigMap `index` (the docs' setup), modelled on the same 40 runs* | *index strategy + 7 tools, product's own text* | *−19% / +2%* | *−28% / +14%, intervals include zero* | *no (second repetition flat); **not a measurement*** |
| **SigMap `index`, measured, 6 questions (12 paired runs)** | **index strategy + 7 tools, product's own text** | **−31% / +43%** | **−16% / +23%, intervals include zero** | **no (second repetition +43%); pooled −6%** |
| **SigMap `index`, real API, 45 questions (180 runs)** | **same** | **+20% / +16%** | **+21% / +16%** | **no, higher both times (cheaper in 21 of 90 pairs)** |
| **SigMap `lean`, real API, 45 questions (180 runs)** | **core tools + three-line section** | **+32% / +34%** | **+30% / +37%** | **no, higher both times (cheaper in 9 of 90 pairs)** |
| Mandarin | translated prompts | +86% / +15% | +70% / +12% | no, much worse |
| Context Mode | index and retrieve context | +94% / +46% | +102% / +51% | no, much worse |

- **The two italic lean rows are not on the same footing as the rest.** Only `current` was measured over the 10 tasks. The modelled row subtracts the 3.3k static tokens per turn that lean no longer re-sends from every SigMap run and keeps the agent's behaviour exactly as it was (`analysis.mjs`, section 4): it reproduces the measured `current` rows exactly, and on the one question where lean was actually measured it was too pessimistic (model: 45k and 124k; measured: 28k and 26k), but it cannot see the agent behaving differently, which could go either way on other questions. Its typical-task intervals (−59% to +4%, −49% to +89%) include zero, so by the study's own standard they are inside the noise. The measured row is one question over two repetitions.
- No tool that was actually measured over 10 tasks, in either study, cut tokens in both repetitions. SigMap sits between the four that stay near zero and the two that make things clearly worse, and is the closest in kind to Context Mode, which also adds retrieval; SigMap's increase was smaller.
- Quality is not comparable. The study graded patches (tests, equivalence, review) and found several modes lost on those. This run grades only whether the right file was named: SigMap 20/20 against 18/20, with no losses. Finding a file is a far easier test than writing a correct patch, so that result does not say SigMap is safer.
- Dollar cost is missing here on purpose: the relay's pricing is not the agent's arithmetic, and the study's strongest result (a cheaper model cuts the bill) is about price, which this run cannot speak to.

## Was SigMap set up fairly, and what went wrong?

**The comparison itself was fair.** Both arms got the same prompt, model, read-only tools and a clean copy of the same pinned commit. The SigMap arm got what a first-time user gets (zero-config generation as the xrepo gate does it, the generated section appended to the system prompt, the MCP server), the harness verified each run's own init event, and all 20 SigMap runs used SigMap's tools. **But the arm carried more than it needed, and several things worked against it.** Reproduce the numbers below with `arm-audit.mjs` and `analysis.mjs` in this directory (both offline, no key).

What the evidence shows, strongest first:

1. **The agent kept checking after the first answer (but see "Correction": on the harder questions it was right to).** The MCP `query_context` tool (top 5) returned the expected file, in a roughly 400 to 800 token answer, for 8 of the 10 questions. The runs still averaged 13.8 tool calls: 5.8 `get_lines` and 3.6 `search_signatures` per run, and 4 of 20 runs never called `query_context`. Across the 20 pairs, each extra tool call cost about 13k tokens (the conversation is re-read every turn).
2. **A fixed cost on every question.** At equal tool-call counts the SigMap arm still used about 21k more tokens (least squares, R² 0.79, n=20). Per turn it re-sent the 22 MCP tool definitions (about 2.6k tokens; the 7-tool `core` profile the README recommends is about 1k) plus the generated section (1.5k to 2.1k tokens).
3. **The always-on section is a thin slice that answers few questions.** It lists 8 to 18 of each repo's files (gin 9 of 118, fastapi 18 of 968) and held the answer file for only 2 of the 10 questions; on express 8 of its 12 entries are `examples/` or `test/` files and `lib/request.js` is absent. The section also tells the agent to run `sigmap ask` in a terminal and never mentions the MCP tools the arm gave it, so the instructions point at the path the agent mostly did not take (the CLI was used in 3 runs).
4. **Questions the baseline found easy cannot be made cheaper.** Ten of the twelve cases where SigMap cost more were questions the baseline answered in under 90k tokens; all it could add there was overhead.
5. **Retrieval missed twice (gin/x002, fastify/x138)** and the basic ranker alone placed the file in the top 5 for only 4 of 10: these are the paraphrased "hard" questions, where SigMap's published numbers are also lowest.
6. **The relay confounds the token counts.** It reported no cache writes and served only 14% (without) and 21% (with) of input from cache, where the real API caches a stable prompt prefix heavily. Re-weighting the same runs the way Anthropic prices them (cache read 0.1×, output 5×) gives repetition 1 about break-even (workload +3%, typical task −2%) and repetition 2 still worse (+30%, +58%). That is an estimate, not a bill, and a real-API run is the way to settle it.

### Ideas, in the order I would test them

Each is a hypothesis from 20 paired cases, not a finding, and none has been tried.

1. ~~**Make one call enough.** Have `query_context` end with an explicit stop line when the top match is strong, using the `confidence` the ranker already computes.~~ **Withdrawn, see "Correction" below:** the premise was wrong, and the data says the agent was right to check.
2. **Cut the per-turn cost.** Default to the `core` profile or smaller (`query_context` and `get_lines`), and fold `search_signatures` into `query_context`, which removes a second way to search. Expect: about 1.6k fewer tokens per turn from definitions alone.
3. **Make the section match the tools.** When MCP is configured, name the MCP tool instead of the CLI, in a few lines, and make the signature sample opt-in for question answering. Expect: a few hundred tokens per turn instead of 1.5k to 2k.
4. **Pay only when asked.** The wins came on questions needing long searches (baseline 84k+ tokens), the losses on easy ones. An always-on tax cannot do that; progressive disclosure (tools on demand, almost nothing always-on) could.
5. **Keep the injected prefix byte-stable** so provider caching discounts it (the section already carries a `sigmap:volatile` marker), and measure on the real API, where a cached prefix costs a tenth.
6. **Add the two misses to the retrieval backlog** (gin/x002 `render/json.go`, fastify/x138 `lib/validation.js`).
7. **Test them as arms**, not by argument: baseline, current, `core` plus no section, and that plus the stop line, on the same 10 tasks × 2 repetitions. At about 130k raw tokens per run that is roughly 2.6M raw tokens per arm; the harness has no arm-variant switch yet.

## Correction, after checking the ideas against all 30 labelled questions

I tested idea 1 before building it (`retrieval-audit.mjs`, free and offline, over every labelled question of gin, flask, express, fastify and fastapi). It does not hold, and it changes how to read point 1 above.

- **The premise was wrong.** The ranker's `confidence` is a relative tier inside the returned results (the top third of the score range is "high"), so the first result is almost always "high", wrong ones included. It cannot be a stop signal.
- **A score margin does not rescue it.** On the 30 questions `query_context` puts the expected file **first 10 times (33%)**, in the top 3 17 times, in the top 5 20 times (67%) and in the top 10 23 times. A rule "the top file is clearly ahead" fires on 11 of 30 questions at top1/top2 ≥ 1.30 and is right 7 times (64%); at looser margins it is right under half the time. A stop line would be wrong about as often as right.
- **So point 1 was overstated.** The pilot's ten questions were easier than the thirty (8 of 10 had the file in the top 5, against 20 of 30), and with the first file right a third of the time, the agent's `get_lines` and `search_signatures` calls were partly rational. They are the likely reason SigMap's arm found the file 20 of 20 times where retrieval alone would have placed it in the top 5 only two times in three.
- **The opt-in ranking settings do not help here either.** `callGraphBoost` 19 of 30 in the top 5, `centralityBlend` 20, `surfaceEnrichment` 20, `minedExpansions` 20, all four together 20 (24 in the top 10); turning `bodyWords` (on by default) off drops it to 16. The default is the best of them, and two of those settings are already deprecated for measuring no net benefit.

**What survives is cutting the fixed cost** (ideas 2 and 3), because that tax is paid on every turn whether or not retrieval is right. It is built as a harness variant, not a product change, so it can be measured before anyone decides to change a default:

```bash
npm run benchmark:agent-ab -- --sigmap-variant lean ...   # default is "current", what the pilot ran
```

`lean` keeps the same index and the same MCP server but hands the agent the 7-tool `core` profile (about 1.0k tokens of definitions, against about 2.6k for all 22) and a three-line section (about 70 tokens, against about 1.7k) that names the MCP tools and says to treat the ranking as a lead and confirm. Re-sent on every turn that is about **1.0k tokens instead of about 4.3k (−76%)**, or roughly 46k tokens per question over the pilot's 13.8 turns before any caching discount (the regression above found about 21k at this relay's caching). It removes the fixed cost, not the extra calls: each of those still costs about 13k tokens. It has not been run against a model.

### First probe of the lean variant: one question, four runs

`lean-gin-4runs/` is `--sigmap-variant lean` on `gin/x001` only (2 repetitions × 2 arms), through the repo's own shim. Total tokens per run (input + output + cache read):

| | repetition 1 | repetition 2 | tool calls | found the file |
|---|---:|---:|---:|---|
| baseline, earlier run | 43.6k | 62.4k | 12, 17 | yes, yes |
| SigMap `current`, earlier run | 68.3k | 179.9k | 6, 16 | yes, yes |
| baseline, this run | 44.0k | 32.6k | 9, 9 | yes, yes |
| **SigMap `lean`, this run** | **28.4k** | **26.1k** | 7, 5 | yes, yes |

Against its own baseline in the same run the lean arm used −36% and −20% of the tokens (mean −29%); the `current` arm on the same question had been +57% and +188% over its baseline. The lean arm called `query_context` twice in all, `get_lines` six times and `read_context` once.

**Read it as a direction and not a result.** It is one question; the baseline alone moved from 62k to 33k in repetition 2 between the two invocations, so a difference of this size is within what a single question swings; there is no interval; and the model is Haiku through a relay. It says the fixed cost was real and removable on this question, and nothing about the other 29. The run used about 131k raw tokens, an estimated 0.4M debited at the relay's 3×.

## Using SigMap efficiently: strategies, tool sets, and the verdict so far

The question was fair: **the pilot did not use SigMap the way its own docs say to use it with an agent that calls the tools.** It ran the default `full` strategy and all 22 MCP tools. The strategies guide recommends `index` (an always-on map, every signature still in the index) for exactly this case, and `hot-cold` or `per-module` for others. Checked offline (`strategy-audit.mjs`, free):

| strategy | always-on section, tokens (mean of 5 repos) | retrieval, first / top 5 of 30 | usable in this harness? |
|---|---:|---|---|
| `full` (the pilot) | 1,747 | 10 / 20 | yes |
| `index` | **622** (−64%) | 10 / 20 | **yes: the docs' choice for tool-calling agents** |
| `per-module` | 557 (gin 1,131, the others about 400) | 10 / 20 | yes, but no smaller than `index` here, and the agent must pick a module file |
| `hot-cold` | 28,469 | 10 / 20 | **no.** "Recently changed files" needs git history, the pinned checkouts hold one commit, so every file is hot (fastapi: 99,804 tokens). It would be a harness artefact, not a result |

Retrieval is identical under every strategy, as the docs say, so a cheaper strategy cannot cost accuracy. What is re-sent on every turn, in tokens:

| setup | tool definitions | section | per turn |
|---|---:|---:|---:|
| `current`: `full` + all 22 tools (the pilot) | 2,568 | 1,747 | **4,315** |
| `index` + 7-tool `core` (the docs' setup; variant `index`) | 955 | 622 | **1,577** |
| `lean`: `core` + a three-line section (variant `lean`) | 955 | 73 | **1,028** |

**Measured so far, on one question (`gin/x001`, 4 runs per variant, the same questions the old arm lost):**

| | repetition 1 | repetition 2 | vs its own same-run baseline |
|---|---:|---:|---|
| `current` (earlier run) | 68.3k (baseline 43.6k) | 179.9k (baseline 62.4k) | +134% |
| `lean` | 28.4k (baseline 44.0k) | 26.1k (baseline 32.6k) | −29% |
| `index` | 21.6k (baseline 30.8k) | 20.8k (baseline 21.1k) | −18% |

All three found the file every time. `index` made 6 and 2 tool calls and called `query_context` twice, `get_lines` three times and `read_context` once, and no `sigmap` command in a terminal. The baseline itself ranged from 21k to 62k tokens across the three invocations, so the gap between `lean` and `index` is noise and the gap between either and `current` is not.

**Modelled over all 40 pilot runs** (`analysis.mjs` section 4: the current arm minus the static tokens the variant no longer re-sends, behaviour held fixed; not a measurement, and the typical-task intervals include zero):

| | workload R1 / R2 | typical task R1 / R2 |
|---|---:|---:|
| `current`, measured | +12% / +42% | +7% / +68% |
| `index`, modelled | −19% / +2% | −28% / +14% |
| `lean`, modelled | −25% / −6% | −36% / +2% |

### The `index` arm on six questions: everything the relay's allowance covered

Run one question per invocation in an order fixed beforehand, cheapest first by the baseline's own cost in the 40-run pilot (`gin/x002`, `express/x038`, `express/x037`, `flask/x033`, `fastapi/x145`, `fastify/x137`, ...), stopping at the first relay refusal. That order favours easy questions, where SigMap has least to save; and the baseline's cost proved a poor guide to it (below). The relay then returned HTTP 402, "Your Token Plan (Coding Tokens) balance is exhausted (0 tokens remaining)", during `fastify/x137`; that half-finished batch is discarded (`index-5questions/fastify-x137-aborted.log`). With the earlier `gin/x001` probe that is **6 questions, 2 repetitions, 24 runs, none failed** (`index-combined.mjs` reproduces everything below).

| question | baseline R1 / R2 | `current`, earlier run (vs its baseline) | **`index`** (vs its same-run baseline) | calls: index / baseline |
|---|---:|---:|---:|---|
| gin/x001 | 31k / 21k | 68k / 180k (+57% / +188%) | 22k / 21k (−30% / −1%) | 6, 2 / 7, 7 |
| gin/x002 | 177k / 9k | 65k / 73k (−2% / +239%) | 20k / 57k (−89% / +522%) | 5, 9 / 24, 4 |
| express/x038 | 51k / 52k | 86k / 146k (+33% / +439%) | 55k / 59k (+7% / +14%) | 13, 13 / 8, 9 |
| express/x037 | 25k / 29k | 91k / 42k (+32% / +45%) | 69k / 13k (+181% / −56%) | 12, 2 / 5, 6 |
| flask/x033 | 184k / 54k | 256k / 256k (+201% / +205%) | 108k / 178k (−42% / +229%) | 12, 21 / 16, 10 |
| fastapi/x145 | 27k / 84k | 38k / 81k (−55% / −33%) | 68k / 29k (+150% / −65%) | 11, 6 / 6, 15 |

| over these 6 questions | `index`: workload | `index`: typical task | `current` (earlier run): workload | `current`: typical task |
|---|---:|---:|---:|---:|
| repetition 1 | −31% | −16% [−66%, +83%] | +46% | +24% [−25%, +95%] |
| repetition 2 | +43% | +23% [−44%, +180%] | +126% | **+132% [+29%, +275%], outside the noise** |
| both pooled | **−6%** | | +82% | |

- **Against the old arm the fix is large.** On the same six questions `current` was +82% pooled with a second-repetition loss outside the noise; `index` is −6% pooled with every interval including zero.
- **Against no SigMap it is break-even, not a saving.** The sign flips between repetitions (−31%, then +43%), the intervals include zero both times, tool calls are 9.3 against 9.8, and the file was found 12 of 12 times by both arms.
- **The noise is the real finding.** The baseline alone cost 177k tokens on `gin/x002` in one repetition and 9k in the next (24 tool calls, then 4), 184k then 54k on `flask/x033`, 27k then 84k on `fastapi/x145`. With swings of 3× to 20× on the same question, six questions cannot resolve an effect of 20% either way, and a single repetition is close to a coin flip.
- **How the agent used it:** over the 12 `index` runs, 57 `get_lines`, 22 `query_context`, 6 `read_context`, 21 shell commands and 2 file reads; it still checked what it was told.
- **Cost:** these 24 runs used 1.44M raw tokens.

### The saving list: where SigMap used fewer tokens, and what it tracks

`index-combined.mjs` prints every case (a question in a repetition) with its change against that repetition's own baseline. **Cases with fewer tokens:**

| tool | cases with fewer tokens | source |
|---|---:|---|
| Caveman | 12 of 20 | the study |
| Ponytail | 9 of 20 | the study |
| RTK | 8 of 20 | the study |
| Terra (cheaper model) | about 10 of 20 ("roughly half") | the study |
| Mandarin | 2 of 20 | the study |
| Context Mode | 1 of 20 | the study |
| **SigMap `current`** | **8 of 20** | this pilot, 40 runs |
| **SigMap `index`** | **6 of 12** (5 clearly, 1 a tie) | this pilot, 6 questions |

`index`, the six cases that used fewer tokens:

| case | change | tokens against the baseline | the baseline's repetition |
|---|---:|---|---|
| gin/x002 R1 | −89% | 20k against 177k | **the costlier of its two** (the other cost 9k) |
| fastapi/x145 R2 | −65% | 29k against 84k | **the costlier** (the other cost 27k) |
| express/x037 R2 | −56% | 13k against 29k | **the costlier** |
| flask/x033 R1 | −42% | 108k against 184k | **the costlier** (the other cost 54k) |
| gin/x001 R1 | −30% | 22k against 31k | **the costlier** |
| gin/x001 R2 | −1% | 21k against 21k | a tie |

**What it tracks.** Five of the six savings came in the baseline's own costlier repetition, and four of the four cases that cost more than 50% more came in its cheaper one. That is what noise looks like, and it is why the pooled result is −6% and not a saving: the baseline "lost" when the agent happened to wander, and SigMap "lost" when the agent happened to get lucky without it.

**Where a real saving does seem to sit.** In the old `current` arm three questions saved in **both** repetitions: `flask/x032` (−67%, −49%; a baseline of about 380k tokens), `fastify/x138` (−78%, −20%; about 164k) and `fastapi/x145` (−55%, −33%; about 102k). They are three of the five most expensive questions, the ones where the baseline needed a long search. **`index` has not been run on `flask/x032` or `fastify/x138`**: the run order (cheapest baseline first) put them last and the allowance ended before them. So the `index` result of break-even comes from the easy questions, where SigMap has least to save; whether it saves on the hard ones with the cheaper setup is the open question, and the evidence so far says that is where to look.

### What would settle it, and why running `lean` on the rest would not

The key had no balance left to run anything further (HTTP 402, rechecked after the six questions), so the rest is a plan. `index-combined.mjs` prints the numbers below.

- **The noise sets the size of the experiment.** The log-ratio of SigMap's arm to its same-run baseline has a standard deviation of 1.11, so one paired run is typically off by a factor of about 3. The 12 pairs so far give a pooled interval of −46% to +91%; all 10 pilot questions would still give about −37% to +66%. The baseline alone differed by 1.5×, 1.2×, 1.0×, 3.1×, 3.4× and 19.4× between its two repetitions of the same question.
- **A result worth the name needs about 144 paired runs for ±20% (72 questions × 2 repetitions) and about 524 for ±10%.** The corpus holds 208 labelled questions across 35 repos, so ±20% is within reach with more checkouts (`npm run fetch:xrepo`); ±10% needs more repetitions per question, which also helps most because most of the noise is the agent's own run-to-run variation.
- **`lean` against `index` cannot be resolved at any affordable size.** They differ by about 550 static tokens a turn, roughly 5k tokens a question, against a single-run error of about 3×. Running `lean` on the other nine questions would add runs without being able to say which is cheaper, so the next allowance is better spent on more questions or repetitions of **one** variant, `index` (the docs' setup, no hand-written text), against its baseline.
- **If you still want both on every question:** `bash benchmarks/pilots/2026-11-09-relay-haiku-5-5/run-remaining.sh` runs the nine questions `lean` has not had and the four `index` has not had (13 questions, 52 agent runs, about 6M raw tokens here), one question per invocation, resumable, stopping at the first failure; `DRY=1` prints every plan first. Questions already saved in this directory are skipped.

### Verdict, as far as the evidence goes

1. **The pilot's loss was largely a setup problem, not a verdict on SigMap.** It re-sent about 4.3k tokens a turn that the docs' own setup avoids (about 1.6k), and the product's recommended strategy for an agent that calls the tools was not the one run.
2. **Used efficiently, SigMap lands near break-even on this slice, not at a saving (now measured on six questions, above: −6% pooled, signs flipping between repetitions).** The arithmetic and the one measured question say the fixed tax is mostly removable; they do not say the agent then needs fewer calls. `query_context` puts the right file first only a third of the time on these questions, so the agent still has to verify, and each extra call still costs about 13k tokens. A saving shows up where the baseline needed a long search (the pilot's eight wins, −20% to −78%) and a cost where it did not.
3. **Accuracy was not the problem:** the file was found 20 of 20 times in the 40-run pilot (18 of 20 for the baseline) and 6 of 6 in the SigMap arms of the three 4-run probes (6 of 6 for their baselines).
4. **Against the other tools:** if the modelled rows hold, an efficiently set-up SigMap would sit with Caveman, Ponytail and RTK (near zero, noisy) and not with Context Mode and Mandarin. That is a projection.
5. **What is not done, and what would settle it:** the allowance ran out after six of the ten questions for `index` and one for `lean`, so the 10-question × 2-repetition run of each, and enough repetitions to see through swings of 3× to 20× on a single question, are still to do; they need a key that can cover about 5M raw tokens per variant (the commands are in "Reproduce it", with `--sigmap-variant index` or `lean`, and `--task-ids` to run questions one at a time). **The statement the evidence supports: with the docs' setup SigMap does not lose accuracy and does not cost more tokens than no SigMap on average, but it has not been shown to save any; the pilot's +12% / +42% was a setup problem and should not be quoted as its efficiency.**

## What it cost

The two later 4-run probes used about 131k (`lean`) and 94k (`index`) raw tokens, and the five-question `index` run 1.44M more (24 runs including `gin/x001`), after which the relay returned HTTP 402 with 0 tokens remaining. The 40 runs used **5.16M raw tokens** (about 129k per run). At the relay's 3× rate for this model that is an estimated **15.5M** debited from the plan, on top of the smoke tests and the 4-run pilot (about 0.9M). The estimate assumes the relay counts cache-read tokens at 3× too, which was not confirmed: the relay's own dashboard is the record. Plan for roughly 130k raw tokens per run, not the 56k the gin-only pilot suggested; flask and fastapi tasks run much longer.

**Reconciled afterwards.** The 72 saved runs used 5.66M input, 39k output and 1.25M cache-read tokens. Against the 18M plan: 3× on every token would be 20.9M (more than the plan held, so not the rule); 3× on input and output with cache reads free is 17.1M; **3× on input and output with cache reads at 1× is 18.4M, the best fit**, before the smoke tests, the aborted `fastify/x137` batch and the harness's side calls. So the 18M is accounted for, the "cache reads at 3×" assumption above was wrong (which is why more questions ran than first estimated), and the exhaustion is plan-wide: Haiku, `glm-5.3-flash` and `mercury-3` all return the same HTTP 402 "balance is exhausted (0 tokens remaining)", while `claude-sonnet-5.5` returns a 403 (Plus tier). For planning, about 16M of this plan's tokens covers the 13 remaining questions (52 runs).

## Files

- `full-40runs/` — the run above. `agent-ab.md` the report, `agent-ab.json` the same as data, `raw.json` one record per agent run (answers included; the paths in them are the harness's throwaway temp directories), `progress.log` the per-run lines, `shim-stats.json` what the shim did over the whole session: 576 message requests, 504 empty messages dropped (all `role: "system"`), upstream statuses 1006 × 200, 3 × 403 (the Sonnet tier refusal, before switching to Haiku) and 2 × 502.
- `index-5questions/` and `index-combined.mjs` — the five further questions the `index` arm ran (report, data and raw records for each, the shim's stats, the run log, and the aborted `fastify/x137` log) and the script that reproduces the combined analysis above.
- `index-gin-4runs/` — the same probe for the docs' setup (`--sigmap-variant index`).
- `strategy-audit.mjs` — what each context strategy injects and that retrieval does not change (`node benchmarks/pilots/2026-11-09-relay-haiku-5-5/strategy-audit.mjs`; needs the fetched checkouts).
- `lean-gin-4runs/` — the lean-variant probe above: report, data, raw records and the shim's stats.
- `run-remaining.sh` — the resumable, one-question-at-a-time runner for the questions the allowance did not cover; `DRY=1` prints the plans.
- `retrieval-audit.mjs` — how good `query_context` is on all 30 labelled questions, whether a score margin can say "clearly ahead", and the opt-in ranking settings (`node benchmarks/pilots/2026-11-09-relay-haiku-5-5/retrieval-audit.mjs`; needs the fetched checkouts).
- `arm-audit.mjs` and `analysis.mjs` — the free, offline checks behind the diagnosis above (`node benchmarks/pilots/2026-11-09-relay-haiku-5-5/arm-audit.mjs`; needs the fetched checkouts).
- `pilot-gin-4runs/` — one task on gin, 2 repetitions × 2 arms, the first end-to-end check through the shim.
