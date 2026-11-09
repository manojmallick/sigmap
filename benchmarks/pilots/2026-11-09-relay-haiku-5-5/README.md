# Agent A/B through a relay, Haiku 5.5 — 2026-11-09

**Not a published result.** It is a pilot, run through a third-party Anthropic-compatible relay on a free-tier key, with a different model from the harness default, on very few tasks. The repository publishes no agent-level figure; nothing here changes a number in the README or `benchmarks/latest.json`. It is saved so the run can be repeated and the files read.

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

`GET <relay>/v1/models` lists the model names your key may use. Use `--runs 4` for a report the harness treats as publishable.

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
| **SigMap (this run)** | **ranked context + MCP tools** | **+12% / +42%** | **+7% / +68%** | **no** |
| Mandarin | translated prompts | +86% / +15% | +70% / +12% | no, much worse |
| Context Mode | index and retrieve context | +94% / +46% | +102% / +51% | no, much worse |

- No tool in either study cut tokens in both repetitions. SigMap sits between the four that stay near zero and the two that make things clearly worse, and is the closest in kind to Context Mode, which also adds retrieval; SigMap's increase was smaller.
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

## What it cost

The 40 runs used **5.16M raw tokens** (about 129k per run). At the relay's 3× rate for this model that is an estimated **15.5M** debited from the plan, on top of the smoke tests and the 4-run pilot (about 0.9M). The estimate assumes the relay counts cache-read tokens at 3× too, which was not confirmed: the relay's own dashboard is the record. Plan for roughly 130k raw tokens per run, not the 56k the gin-only pilot suggested; flask and fastapi tasks run much longer.

## Files

- `full-40runs/` — the run above. `agent-ab.md` the report, `agent-ab.json` the same as data, `raw.json` one record per agent run (answers included; the paths in them are the harness's throwaway temp directories), `progress.log` the per-run lines, `shim-stats.json` what the shim did over the whole session: 576 message requests, 504 empty messages dropped (all `role: "system"`), upstream statuses 1006 × 200, 3 × 403 (the Sonnet tier refusal, before switching to Haiku) and 2 × 502.
- `lean-gin-4runs/` — the lean-variant probe above: report, data, raw records and the shim's stats.
- `retrieval-audit.mjs` — how good `query_context` is on all 30 labelled questions, whether a score margin can say "clearly ahead", and the opt-in ranking settings (`node benchmarks/pilots/2026-11-09-relay-haiku-5-5/retrieval-audit.mjs`; needs the fetched checkouts).
- `arm-audit.mjs` and `analysis.mjs` — the free, offline checks behind the diagnosis above (`node benchmarks/pilots/2026-11-09-relay-haiku-5-5/arm-audit.mjs`; needs the fetched checkouts).
- `pilot-gin-4runs/` — one task on gin, 2 repetitions × 2 arms, the first end-to-end check through the shim.
