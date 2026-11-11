# Agent-level A/B — measured tool calls, tokens and cost

**anthropic-messages-api direct Messages API · claude-haiku-4-5 · 2026-11-11 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

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
| express | 4 | 8/8 | 8/8 | 0 / 0 |
| all | 4 | 8/8 | 8/8 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 4. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −37% | −14% | fewer in every repetition |
| Input tokens (uncached) | −26% | +63% | mixed |
| Output tokens | −9% | −17% | fewer in every repetition |
| Cache-read tokens | +49% | +1% | more in every repetition |
| Cache-write tokens | +45% | +2% | more in every repetition |
| Total tokens (derived) | +35% | +6% | more in every repetition |
| Cost | +13% | +9% | more in every repetition |
| Wall time | −7% | −13% | fewer in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −36% [−56%, −11%] | −16% [−29%, +2%] † | fewer in every repetition, within the noise |
| Input tokens (uncached) | −26% [−35%, −15%] | +91% [−26%, +354%] † | mixed |
| Output tokens | −9% [−36%, +27%] † | −19% [−35%, +5%] † | fewer in every repetition, within the noise |
| Cache-read tokens | +76% [−52%, +607%] † | −13% [−45%, +14%] † | mixed |
| Cache-write tokens | +37% [−21%, +157%] † | +1% [−10%, +13%] † | more in every repetition, within the noise |
| Total tokens (derived) | +30% [−44%, +206%] † | +1% [−15%, +21%] † | more in every repetition, within the noise |
| Cost | +8% [−29%, +63%] † | +7% [−9%, +23%] † | more in every repetition, within the noise |
| Wall time | −8% [−34%, +26%] † | −15% [−29%, +7%] † | fewer in every repetition, within the noise |

### Outcome (hit@5), by repetition

Per paired task: **better** = the SigMap arm named the file and the other did not; **worse** = the reverse; **tie** = both found it or both missed. Localisation only.

| repetition | paired tasks | better | worse | tie |
| --- | ---: | ---: | ---: | ---: |
| R1 | 4 | 0 | 0 | 4 |
| R2 | 4 | 0 | 0 | 4 |
| all | 8 | 0 | 0 | 8 |

## Tool calls

Provenance: agent-reported (main-thread tool_use blocks). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | 11 | 7 | −3 | 4 / 0 / 0 |
| all | 11 | 7 | −3 | 4 / 0 / 0 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | 5,545 | 7,133 | +657 | 2 / 0 / 2 |
| all | 5,545 | 7,133 | +657 | 2 / 0 / 2 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | 1,111 | 926 | −95 | 2 / 0 / 2 |
| all | 1,111 | 926 | −95 | 2 / 0 / 2 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | 40,676 | 40,995 | +7,716 | 2 / 0 / 2 |
| all | 40,676 | 40,995 | +7,716 | 2 / 0 / 2 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | 8,527 | 10,878 | +1,141 | 1 / 0 / 3 |
| all | 8,527 | 10,878 | +1,141 | 1 / 0 / 3 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | 55,868 | 62,313 | +10,031 | 2 / 0 / 2 |
| all | 55,868 | 62,313 | +10,031 | 2 / 0 / 2 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd), or computed from the API's usage and a price table when the run went through the Messages API directly. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | $0.0259 | $0.0308 | +$0.0028 | 2 / 0 / 2 |
| all | $0.0259 | $0.0308 | +$0.0028 | 2 / 0 / 2 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | 13.4 s | 11.6 s | −922 ms | 2 / 0 / 2 |
| all | 13.4 s | 11.6 s | −922 ms | 2 / 0 / 2 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| express | $0.2110 (8 runs) | $0.2344 (8 runs) | none | none |
| all | $0.2110 (8 runs) | $0.2344 (8 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| express/x037 | without | 2/2 | 10 [10–10] | 5,543 [2,534–8,552] | 1,033 [1,015–1,051] | 39,143 [25,652–52,634] | 9,247 [8,421–10,073] | $0.0262 [$0.0255–$0.0269] | 12.7 s [12.5 s–12.9 s] |
| express/x037 | with | 2/2 | 10 [8–11] | 7,181 [7,169–7,193] | 1,150 [1,078–1,221] | 62,126 [58,846–65,405] | 11,222 [8,808–13,635] | $0.0332 [$0.0302–$0.0361] | 14.8 s [14.4 s–15.1 s] |
| express/x038 | without | 2/2 | 12 [9–14] | 4,687 [1,081–8,292] | 1,190 [1,115–1,264] | 45,328 [38,007–52,649] | 11,724 [11,491–11,956] | $0.0298 [$0.0248–$0.0348] | 14.2 s [12.5 s–15.8 s] |
| express/x038 | with | 2/2 | 7 [6–8] | 7,084 [7,061–7,107] | 883 [676–1,089] | 37,777 [31,141–44,412] | 10,534 [7,497–13,571] | $0.0284 [$0.0250–$0.0318] | 10.9 s [9.0 s–12.8 s] |
| express/x039 | without | 2/2 | 12 [10–14] | 5,548 [4,543–6,552] | 1,207 [1,111–1,303] | 42,209 [36,323–48,094] | 7,808 [7,580–8,035] | $0.0256 [$0.0253–$0.0258] | 14.3 s [13.4 s–15.2 s] |
| express/x039 | with | 2/2 | 7 [5–8] | 3,092 [3,085–3,098] | 738 [709–766] | 27,442 [18,829–36,055] | 8,115 [7,511–8,719] | $0.0197 [$0.0179–$0.0214] | 8.9 s [8.5 s–9.3 s] |
| express/x040 | without | 2/2 | 8 [7–8] | 9,477 [7,272–11,681] | 849 [822–875] | 12,414 [4,936–19,892] | 7,181 [5,689–8,673] | $0.0239 [$0.0234–$0.0245] | 10.9 s [10.5 s–11.2 s] |
| express/x040 | with | 2/2 | 7 [6–8] | 9,153 [7,197–11,108] | 970 [754–1,186] | 44,214 [8,588–79,839] | 14,013 [7,987–20,038] | $0.0359 [$0.0257–$0.0462] | 12.3 s [9.6 s–14.9 s] |

