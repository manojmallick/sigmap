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

## What it cost

The 40 runs used **5.16M raw tokens** (about 129k per run). At the relay's 3× rate for this model that is an estimated **15.5M** debited from the plan, on top of the smoke tests and the 4-run pilot (about 0.9M). The estimate assumes the relay counts cache-read tokens at 3× too, which was not confirmed: the relay's own dashboard is the record. Plan for roughly 130k raw tokens per run, not the 56k the gin-only pilot suggested; flask and fastapi tasks run much longer.

## Files

- `full-40runs/` — the run above. `agent-ab.md` the report, `agent-ab.json` the same as data, `raw.json` one record per agent run (answers included; the paths in them are the harness's throwaway temp directories), `progress.log` the per-run lines, `shim-stats.json` what the shim did over the whole session: 576 message requests, 504 empty messages dropped (all `role: "system"`), upstream statuses 1006 × 200, 3 × 403 (the Sonnet tier refusal, before switching to Haiku) and 2 × 502.
- `pilot-gin-4runs/` — one task on gin, 2 repetitions × 2 arms, the first end-to-end check through the shim.
