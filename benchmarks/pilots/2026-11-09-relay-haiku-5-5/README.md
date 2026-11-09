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

## What it cost

The 40 runs used **5.16M raw tokens** (about 129k per run). At the relay's 3× rate for this model that is an estimated **15.5M** debited from the plan, on top of the smoke tests and the 4-run pilot (about 0.9M). The estimate assumes the relay counts cache-read tokens at 3× too, which was not confirmed: the relay's own dashboard is the record. Plan for roughly 130k raw tokens per run, not the 56k the gin-only pilot suggested; flask and fastapi tasks run much longer.

## Files

- `full-40runs/` — the run above. `agent-ab.md` the report, `agent-ab.json` the same as data, `raw.json` one record per agent run (answers included; the paths in them are the harness's throwaway temp directories), `progress.log` the per-run lines, `shim-stats.json` what the shim did over the whole session: 576 message requests, 504 empty messages dropped (all `role: "system"`), upstream statuses 1006 × 200, 3 × 403 (the Sonnet tier refusal, before switching to Haiku) and 2 × 502.
- `pilot-gin-4runs/` — one task on gin, 2 repetitions × 2 arms, the first end-to-end check through the shim.
