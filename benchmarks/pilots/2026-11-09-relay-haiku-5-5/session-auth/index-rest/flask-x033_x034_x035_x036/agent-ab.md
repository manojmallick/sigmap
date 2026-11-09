# Agent-level A/B — measured tool calls, tokens and cost

**claude-code 2.1.319 (Claude Code) · claude-haiku-5-5 · 2026-11-09 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap index strategy + 7-tool core MCP profile (the docs' setup for an agent that calls the tools).
- Both arms: the same prompt, model, tool allowlist (Read, Grep, Glob, Bash), per-run budget cap $0.5 and timeout 420 s; run in a clean copy of the commit pinned in `benchmarks/xrepo-repos.json`.
- Questions: the task id(s) x033, x034, x035, x036 of `benchmarks/tasks/retrieval-xrepo.jsonl`. Pass = hit@5 on the repository-relative paths the answer names.
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
- Run on the logged-in session (--session-auth), not an API key and not under --bare: the agent carries a prompt prefix about 40k tokens larger in both arms (cached), the cost figures are real Anthropic prices with real caching, and the usage counts against that account's plan.

## Outcome

| repo | tasks | pass without | pass with | failed runs (without / with) |
| --- | ---: | ---: | ---: | ---: |
| flask | 4 | 8/8 | 8/8 | 0 / 0 |
| all | 4 | 8/8 | 8/8 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 4. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −25% | −15% | fewer in every repetition |
| Input tokens (uncached) | −7% | −14% | fewer in every repetition |
| Output tokens | −20% | +4% | mixed |
| Cache-read tokens | +16% | +2% | more in every repetition |
| Cache-write tokens | +1% | −22% | mixed |
| Total tokens (derived) | +12% | −3% | mixed |
| Cost | −2% | −13% | fewer in every repetition |
| Wall time | −8% | +1% | mixed |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −24% [−33%, −10%] | −20% [−45%, +15%] † | fewer in every repetition, within the noise |
| Input tokens (uncached) | −5% [−15%, 0%] † | −15% [−27%, 0%] † | fewer in every repetition, within the noise |
| Output tokens | −18% [−36%, +10%] † | 0% [−29%, +37%] † | mixed |
| Cache-read tokens | +20% [0%, +36%] † | +1% [−19%, +26%] † | more in every repetition, within the noise |
| Cache-write tokens | 0% [−15%, +18%] † | −22% [−29%, −9%] | fewer in every repetition, within the noise |
| Total tokens (derived) | +15% [−3%, +31%] † | −3% [−20%, +18%] † | mixed |
| Cost | −2% [−16%, +17%] † | −14% [−26%, +3%] † | fewer in every repetition, within the noise |
| Wall time | −7% [−17%, +3%] † | +1% [−13%, +17%] † | mixed |

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
| flask | 3 | 3 | −1 | 3 / 1 / 0 |
| all | 3 | 3 | −1 | 3 / 1 / 0 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | 6 | 6 | −1 | 2 / 2 / 0 |
| all | 6 | 6 | −1 | 2 / 2 / 0 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | 1,060 | 899 | −76 | 2 / 0 / 2 |
| all | 1,060 | 899 | −76 | 2 / 0 / 2 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | 28,185 | 35,557 | +3,916 | 1 / 0 / 3 |
| all | 28,185 | 35,557 | +3,916 | 1 / 0 / 3 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | 7,894 | 7,298 | −632 | 4 / 0 / 0 |
| all | 7,894 | 7,298 | −632 | 4 / 0 / 0 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | 38,192 | 43,917 | +3,207 | 1 / 0 / 3 |
| all | 38,192 | 43,917 | +3,207 | 1 / 0 / 3 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | $0.0025 | $0.0023 | −$0.0001 | 3 / 0 / 1 |
| all | $0.0025 | $0.0023 | −$0.0001 | 3 / 0 / 1 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | 11.9 s | 11.8 s | −370 ms | 3 / 0 / 1 |
| all | 11.9 s | 11.8 s | −370 ms | 3 / 0 / 1 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| flask | $0.0198 (8 runs) | $0.0183 (8 runs) | none | none |
| all | $0.0198 (8 runs) | $0.0183 (8 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| flask/x033 | without | 2/2 | 3 [3–3] | 6 [6–6] | 991 [968–1,014] | 28,137 [27,816–28,458] | 8,481 [8,072–8,890] | $0.0025 [$0.0024–$0.0026] | 11.1 s [10.9 s–11.3 s] |
| flask/x033 | with | 2/2 | 3 [2–4] | 6 [6–6] | 1,187 [881–1,492] | 36,320 [35,431–37,209] | 7,942 [7,936–7,948] | $0.0025 [$0.0024–$0.0027] | 12.1 s [11.0 s–13.3 s] |
| flask/x034 | without | 2/2 | 3 [3–3] | 6 [6–6] | 1,150 [903–1,396] | 27,924 [27,068–28,779] | 7,308 [6,378–8,237] | $0.0023 [$0.0022–$0.0024] | 12.2 s [10.2 s–14.2 s] |
| flask/x034 | with | 2/2 | 3 [2–3] | 6 [6–6] | 925 [825–1,024] | 34,795 [34,493–35,096] | 6,654 [6,183–7,125] | $0.0021 [$0.0021–$0.0022] | 11.9 s [11.6 s–12.3 s] |
| flask/x035 | without | 2/2 | 5 [4–5] | 10 [10–10] | 1,130 [1,118–1,141] | 52,208 [52,172–52,244] | 6,979 [6,542–7,416] | $0.0025 [$0.0024–$0.0026] | 13.6 s [13.6 s–13.7 s] |
| flask/x035 | with | 2/2 | 3 [3–3] | 8 [8–8] | 737 [675–799] | 48,020 [47,865–48,174] | 5,230 [4,529–5,931] | $0.0019 [$0.0017–$0.0021] | 11.6 s [11.0 s–12.3 s] |
| flask/x036 | without | 2/2 | 2 [2–2] | 6 [6–6] | 800 [688–911] | 28,234 [26,226–30,241] | 9,731 [7,990–11,471] | $0.0026 [$0.0022–$0.0031] | 11.6 s [10.7 s–12.4 s] |
| flask/x036 | with | 2/2 | 2 [1–2] | 5 [4–6] | 873 [868–878] | 29,194 [21,778–36,609] | 9,120 [8,282–9,958] | $0.0026 [$0.0023–$0.0028] | 11.1 s [10.5 s–11.7 s] |

