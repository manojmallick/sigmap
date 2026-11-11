# Agent-level A/B — measured tool calls, tokens and cost

**anthropic-messages-api direct Messages API · claude-sonnet-5-5 · 2026-11-11 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap index strategy + 7-tool core MCP profile (the docs' setup for an agent that calls the tools).
- Both arms: the same prompt, model, tool allowlist (Read, Grep, Glob, Bash), per-run budget cap $0.25 and timeout 420 s; run in a clean copy of the commit pinned in `benchmarks/xrepo-repos.json`.
- Questions: the task id(s) x032, x033, x034, x035, x036 of `benchmarks/tasks/retrieval-xrepo.jsonl`. Pass = hit@5 on the repository-relative paths the answer names.
- Statistics: the median over runs per task per arm; the repo row is the median over tasks, with the paired per-task delta (with − without) and how many tasks the SigMap arm used fewer / the same / more.
- Repetitions: each run index is one repetition, reported on its own in two ways — the workload total and the typical task (paired geometric mean, with a bootstrap interval) — and a saving counts only if it points the same way in every repetition.

## Caveats

- One agent, one model, one date. The result says nothing about another agent or model.
- The questions ask where code lives, so this measures localisation, not edit or generation quality.
- Pass is hit@5 on the paths the answer names (the retrieval corpora's own definition), not a human judgement.
- Tasks are the first K by id per repo — a rule, not a random sample. N is small and one task is worth 1/N: read it as a band, not a point.
- Token figures are per-request billing categories summed over the run. They are not the size of the context.
- The SigMap arm adds SigMap's generated section to the system prompt, so its input and cache figures include that cost.
- Cost is the agent's own account. Prompt caching makes it depend on run order; arms are interleaved and counterbalanced to spread that, not to remove it.
- The self repo is excluded: its tree holds its own answer key and its own generated context.
- Repetitions reuse the same tasks, so they measure consistency, not generalisation to other tasks.
- The workload total is dominated by the largest tasks; the typical-task estimate gives every task equal weight. The two can disagree in sign on the same runs, and neither is a correction of the other.
- A typical-task interval that includes zero (†) is inside the noise: the runs cannot tell that change from none.
- Total tokens is a derived, unweighted sum of the four billing categories, so a cache read counts like a fresh token. Read Cost for the priced view: a token change and a cost change can differ in sign.
- Direct Messages API agent (scripts/lib/agent-ab-api.mjs), not Claude Code: a short neutral system prompt (about 150 tokens) and four read-only tools, so the prefix each turn re-reads is far smaller than Claude Code's and SigMap's per-turn addition is a larger share of a turn. Cost is computed from the usage the API reports and a price table (the Console's usage page is the authority), with 5-minute prompt caching. Not comparable cell by cell with Claude Code runs.

## Outcome

| repo | tasks | pass without | pass with | failed runs (without / with) |
| --- | ---: | ---: | ---: | ---: |
| flask | 5 | 10/10 | 10/10 | 0 / 0 |
| all | 5 | 10/10 | 10/10 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 5. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −21% | −53% | fewer in every repetition |
| Input tokens (uncached) | 0% | −1% | fewer in every repetition |
| Output tokens | −7% | −30% | fewer in every repetition |
| Cache-read tokens | +95% | +32% | more in every repetition |
| Cache-write tokens | −32% | −83% | fewer in every repetition |
| Total tokens (derived) | +45% | −14% | mixed |
| Cost | −12% | −56% | fewer in every repetition |
| Wall time | −2% | −15% | fewer in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −17% [−36%, +18%] † | −54% [−70%, −30%] | fewer in every repetition, within the noise |
| Input tokens (uncached) | 0% [−1%, 0%] † | −1% [−2%, 0%] | fewer in every repetition, within the noise |
| Output tokens | −2% [−15%, +17%] † | −29% [−45%, −11%] | fewer in every repetition, within the noise |
| Cache-read tokens | +125% [+47%, +247%] | +57% [−18%, +138%] † | more in every repetition, within the noise |
| Cache-write tokens | −41% [−69%, +25%] † | −74% [−90%, −39%] n=4 | fewer in every repetition, within the noise |
| Total tokens (derived) | +67% [+17%, +150%] | −2% [−45%, +53%] † | mixed |
| Cost | −9% [−37%, +30%] † | −54% [−72%, −30%] | fewer in every repetition, within the noise |
| Wall time | +4% [−20%, +26%] † | −14% [−42%, +19%] † | mixed |

### Outcome (hit@5), by repetition

Per paired task: **better** = the SigMap arm named the file and the other did not; **worse** = the reverse; **tie** = both found it or both missed. Localisation only.

| repetition | paired tasks | better | worse | tie |
| --- | ---: | ---: | ---: | ---: |
| R1 | 5 | 0 | 0 | 5 |
| R2 | 5 | 0 | 0 | 5 |
| all | 10 | 0 | 0 | 10 |

## Tool calls

Provenance: agent-reported (main-thread tool_use blocks). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | 3 | 2 | −1 | 5 / 0 / 0 |
| all | 3 | 2 | −1 | 5 / 0 / 0 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | 200 | 200 | −1 | 4 / 1 / 0 |
| all | 200 | 200 | −1 | 4 / 1 / 0 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | 619 | 406 | −98 | 4 / 0 / 1 |
| all | 619 | 406 | −98 | 4 / 0 / 1 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | 6,028 | 8,800 | +4,329 | 1 / 0 / 4 |
| all | 6,028 | 8,800 | +4,329 | 1 / 0 / 4 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | 2,340 | 1,091 | −2,114 | 4 / 0 / 1 |
| all | 2,340 | 1,091 | −2,114 | 4 / 0 / 1 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | 9,358 | 10,502 | +2,435 | 2 / 0 / 3 |
| all | 9,358 | 10,502 | +2,435 | 2 / 0 / 3 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd), or computed from the API's usage and a price table when the run went through the Messages API directly. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | $0.0162 | $0.0090 | −$0.0040 | 4 / 0 / 1 |
| all | $0.0162 | $0.0090 | −$0.0040 | 4 / 0 / 1 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | 5.2 s | 5.3 s | +84 ms | 2 / 0 / 3 |
| all | 5.2 s | 5.3 s | +84 ms | 2 / 0 / 3 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| flask | $0.1596 (10 runs) | $0.1009 (10 runs) | none | none |
| all | $0.1596 (10 runs) | $0.1009 (10 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| flask/x032 | without | 2/2 | 5 [4–5] | 209 [208–210] | 902 [861–942] | 6,028 [4,512–7,544] | 2,219 [1,611–2,827] | $0.0162 [$0.0140–$0.0184] | 8.2 s [7.9 s–8.5 s] |
| flask/x032 | with | 2/2 | 3 [2–3] | 206 [206–206] | 678 [518–837] | 10,357 [9,816–10,898] | 3,466 [1,279–5,652] | $0.0179 [$0.0110–$0.0249] | 8.1 s [7.4 s–8.8 s] |
| flask/x033 | without | 2/2 | 3 [2–4] | 207 [206–208] | 631 [553–709] | 10,162 [5,476–14,847] | 6,198 [3,345–9,051] | $0.0243 [$0.0154–$0.0331] | 10.0 s [9.7 s–10.4 s] |
| flask/x033 | with | 2/2 | 2 [1–3] | 205 [204–206] | 406 [317–494] | 8,800 [6,762–10,838] | 1,091 [674–1,508] | $0.0090 [$0.0066–$0.0113] | 5.3 s [4.1 s–6.6 s] |
| flask/x034 | without | 2/2 | 3 [2–3] | 200 [200–200] | 619 [618–620] | 7,024 [6,530–7,517] | 5,011 [4,619–5,402] | $0.0205 [$0.0194–$0.0216] | 5.2 s [5.1 s–5.3 s] |
| flask/x034 | with | 2/2 | 2 [2–2] | 200 [200–200] | 522 [490–553] | 10,662 [10,654–10,670] | 1,156 [1,037–1,274] | $0.0106 [$0.0100–$0.0112] | 6.9 s [6.7 s–7.2 s] |
| flask/x035 | without | 2/2 | 3 [3–3] | 192 [192–192] | 431 [413–449] | 2,756 [2,754–2,758] | 1,625 [1,623–1,627] | $0.0093 [$0.0091–$0.0095] | 4.2 s [4.2 s–4.3 s] |
| flask/x035 | with | 2/2 | 2 [1–2] | 191 [190–192] | 393 [372–413] | 8,654 [6,762–10,546] | 557 [445–668] | $0.0074 [$0.0066–$0.0083] | 4.3 s [3.8 s–4.8 s] |
| flask/x036 | without | 2/2 | 2 [1–2] | 195 [194–196] | 282 [222–342] | 2,472 [1,628–3,316] | 2,340 [437–4,242] | $0.0096 [$0.0040–$0.0151] | 3.3 s [2.7 s–3.8 s] |
| flask/x036 | with | 2/2 | 1 [1–1] | 194 [194–194] | 316 [313–318] | 6,988 [6,762–7,214] | 226 [0–452] | $0.0055 [$0.0050–$0.0060] | 3.6 s [3.6 s–3.7 s] |

