# Agent-level A/B — measured tool calls, tokens and cost

**anthropic-messages-api direct Messages API · claude-haiku-5-5 · 2026-11-11 · 4 runs per arm · publishable**

- Arms: **without** = no SigMap; **with** = SigMap index strategy + 7-tool core MCP profile (the docs' setup for an agent that calls the tools).
- Both arms: the same prompt, model, tool allowlist (Read, Grep, Glob, Bash), per-run budget cap $0.25 and timeout 420 s; run in a clean copy of the commit pinned in `benchmarks/xrepo-repos.json`.
- Questions: the task id(s) x037, x038, x039, x040 of `benchmarks/tasks/retrieval-xrepo.jsonl`. Pass = hit@5 on the repository-relative paths the answer names.
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
| express | 4 | 16/16 | 16/16 | 0 / 0 |
| all | 4 | 16/16 | 16/16 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2, R3, R4) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 4. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | R3 | R4 | verdict |
| --- | ---: | ---: | ---: | ---: | ---: |
| Tool calls | −50% | −50% | −25% | −20% | fewer in every repetition |
| Input tokens (uncached) | −2% | −1% | −1% | 0% | fewer in every repetition |
| Output tokens | −35% | −17% | −15% | +11% | mixed |
| Cache-read tokens | +9% | +99% | +63% | +188% | more in every repetition |
| Cache-write tokens | −32% | −36% | −44% | −40% | fewer in every repetition |
| Total tokens (derived) | −4% | +46% | +28% | +76% | mixed |
| Cost | −29% | −17% | −21% | −6% | fewer in every repetition |
| Wall time | −33% | −15% | −12% | +9% | mixed |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | R3 | R4 | verdict |
| --- | ---: | ---: | ---: | ---: | ---: |
| Tool calls | −41% [−65%, 0%] † | −55% [−71%, −24%] | −22% [−65%, +57%] † | −18% [−56%, +52%] † | fewer in every repetition, within the noise |
| Input tokens (uncached) | −2% [−4%, 0%] † | −1% [−2%, 0%] | 0% [−2%, +1%] † | 0% [−2%, +1%] † | fewer in every repetition, within the noise |
| Output tokens | −32% [−47%, −13%] | −17% [−27%, −5%] | −13% [−34%, +6%] † | +8% [−9%, +32%] † | mixed |
| Cache-read tokens | +58% [−29%, +252%] † | +93% [+56%, +140%] | +116% [+19%, +351%] | +190% [+93%, +328%] | more in every repetition, within the noise |
| Cache-write tokens | −39% [−56%, −20%] | −42% [−69%, −4%] | −44% [−59%, −11%] | −37% [−56%, 0%] | fewer in every repetition, outside the noise |
| Total tokens (derived) | +17% [−30%, +95%] † | +41% [+11%, +80%] | +49% [−7%, +141%] † | +77% [+28%, +145%] | more in every repetition, within the noise |
| Cost | −27% [−38%, −11%] | −19% [−35%, +4%] † | −19% [−38%, +6%] † | −5% [−20%, +16%] † | fewer in every repetition, within the noise |
| Wall time | −27% [−47%, +1%] † | −15% [−26%, −1%] | −9% [−34%, +16%] † | +7% [−21%, +38%] † | mixed |

### Outcome (hit@5), by repetition

Per paired task: **better** = the SigMap arm named the file and the other did not; **worse** = the reverse; **tie** = both found it or both missed. Localisation only.

| repetition | paired tasks | better | worse | tie |
| --- | ---: | ---: | ---: | ---: |
| R1 | 4 | 0 | 0 | 4 |
| R2 | 4 | 0 | 0 | 4 |
| R3 | 4 | 0 | 0 | 4 |
| R4 | 4 | 0 | 0 | 4 |
| all | 16 | 0 | 0 | 16 |

## Tool calls

Provenance: agent-reported (main-thread tool_use blocks). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | 4 | 2 | −1 | 2 / 1 / 1 |
| all | 4 | 2 | −1 | 2 / 1 / 1 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | 199 | 198 | −2 | 2 / 2 / 0 |
| all | 199 | 198 | −2 | 2 / 2 / 0 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | 669 | 585 | −81 | 4 / 0 / 0 |
| all | 669 | 585 | −81 | 4 / 0 / 0 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | 4,459 | 9,474 | +4,377 | 0 / 0 / 4 |
| all | 4,459 | 9,474 | +4,377 | 0 / 0 / 4 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | 2,691 | 1,752 | −962 | 4 / 0 / 0 |
| all | 2,691 | 1,752 | −962 | 4 / 0 / 0 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | 8,291 | 12,336 | +3,410 | 0 / 0 / 4 |
| all | 8,291 | 12,336 | +3,410 | 0 / 0 / 4 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd), or computed from the API's usage and a price table when the run went through the Messages API directly. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | $0.0008 | $0.0007 | −$0.0001 | 3 / 0 / 1 |
| all | $0.0008 | $0.0007 | −$0.0001 | 3 / 0 / 1 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | 4.2 s | 3.9 s | −503 ms | 2 / 0 / 2 |
| all | 4.2 s | 3.9 s | −503 ms | 2 / 0 / 2 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| express | $0.0124 (16 runs) | $0.0100 (16 runs) | none | none |
| all | $0.0124 (16 runs) | $0.0100 (16 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| express/x037 | without | 4/4 | 4 [3–7] | 200 [198–208] | 814 [664–1,468] | 4,714 [4,367–18,160] | 3,331 [2,014–4,406] | $0.0009 [$0.0007–$0.0014] | 5.3 s [3.8 s–10.1 s] |
| express/x037 | with | 4/4 | 2 [1–3] | 197 [196–198] | 663 [511–979] | 8,293 [6,802–11,288] | 1,448 [1,103–2,975] | $0.0007 [$0.0005–$0.0009] | 4.1 s [3.2 s–5.7 s] |
| express/x038 | without | 4/4 | 3 [3–3] | 198 [198–198] | 637 [629–666] | 4,203 [3,616–4,790] | 2,374 [1,706–2,950] | $0.0007 [$0.0006–$0.0007] | 3.6 s [3.5 s–3.7 s] |
| express/x038 | with | 4/4 | 3 [3–3] | 198 [198–200] | 627 [577–663] | 11,259 [10,735–15,886] | 2,066 [1,804–2,213] | $0.0007 [$0.0007–$0.0007] | 4.0 s [3.6 s–4.2 s] |
| express/x039 | without | 4/4 | 1 [1–3] | 190 [190–192] | 471 [452–512] | 1,628 [1,628–4,131] | 1,694 [1,681–2,663] | $0.0005 [$0.0005–$0.0006] | 2.9 s [2.7 s–3.3 s] |
| express/x039 | with | 4/4 | 2 [1–2] | 190 [190–192] | 467 [390–523] | 6,802 [6,802–10,816] | 722 [603–2,076] | $0.0004 [$0.0004–$0.0006] | 2.9 s [2.8 s–3.4 s] |
| express/x040 | without | 4/4 | 4 [3–7] | 201 [200–204] | 701 [631–1,002] | 8,006 [4,390–16,535] | 3,008 [2,677–5,258] | $0.0009 [$0.0007–$0.0012] | 4.7 s [4.4 s–6.4 s] |
| express/x040 | with | 4/4 | 2 [1–3] | 198 [196–200] | 543 [541–631] | 10,654 [6,802–16,505] | 2,055 [1,474–2,517] | $0.0007 [$0.0005–$0.0008] | 3.7 s [3.1 s–4.4 s] |

