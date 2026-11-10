# Agent-level A/B — measured tool calls, tokens and cost

**claude-code 2.1.321 (Claude Code) · claude-haiku-4-5 · 2026-11-10 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap generated context + MCP server.
- Both arms: the same prompt, model, tool allowlist (Read, Grep, Glob, Bash), per-run budget cap $1 and timeout 420 s; run in a clean copy of the commit pinned in `benchmarks/xrepo-repos.json`.
- Questions: the task id(s) x001, x002 of `benchmarks/tasks/retrieval-xrepo.jsonl`. Pass = hit@5 on the repository-relative paths the answer names.
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
| gin | 2 | 4/4 | 4/4 | 0 / 0 |
| all | 2 | 4/4 | 4/4 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 2. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | +27% | −40% | mixed |
| Input tokens (uncached) | −7% | −37% | fewer in every repetition |
| Output tokens | +5% | −27% | mixed |
| Cache-read tokens | +24% | −17% | mixed |
| Cache-write tokens | +85% | −20% | mixed |
| Total tokens (derived) | +29% | −18% | mixed |
| Cost | +53% | −20% | mixed |
| Wall time | +7% | −24% | mixed |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | +37% [+13%, +67%] | −48% [−67%, −18%] | mixed |
| Input tokens (uncached) | −13% [−24%, 0%] † | −46% [−65%, −16%] | fewer in every repetition, within the noise |
| Output tokens | +3% [−2%, +8%] † | −34% [−55%, −3%] | mixed |
| Cache-read tokens | +19% [+10%, +29%] | −33% [−59%, +9%] † | mixed |
| Cache-write tokens | +57% [+11%, +122%] | −24% [−35%, −10%] | mixed |
| Total tokens (derived) | +22% [+10%, +36%] | −32% [−58%, +8%] † | mixed |
| Cost | +37% [+8%, +74%] | −28% [−47%, −3%] | mixed |
| Wall time | +4% [−4%, +14%] † | −28% [−42%, −9%] | mixed |

### Outcome (hit@5), by repetition

Per paired task: **better** = the SigMap arm named the file and the other did not; **worse** = the reverse; **tie** = both found it or both missed. Localisation only.

| repetition | paired tasks | better | worse | tie |
| --- | ---: | ---: | ---: | ---: |
| R1 | 2 | 0 | 0 | 2 |
| R2 | 2 | 0 | 0 | 2 |
| all | 4 | 0 | 0 | 4 |

## Tool calls

Provenance: agent-reported (main-thread tool_use blocks). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 8 | 7 | −1 | 2 / 0 / 0 |
| all | 8 | 7 | −1 | 2 / 0 / 0 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 70 | 52 | −18 | 2 / 0 / 0 |
| all | 70 | 52 | −18 | 2 / 0 / 0 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 1,730 | 1,493 | −237 | 1 / 0 / 1 |
| all | 1,730 | 1,493 | −237 | 1 / 0 / 1 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 127,577 | 124,996 | −2,581 | 1 / 0 / 1 |
| all | 127,577 | 124,996 | −2,581 | 1 / 0 / 1 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 10,817 | 13,789 | +2,973 | 1 / 0 / 1 |
| all | 10,817 | 13,789 | +2,973 | 1 / 0 / 1 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 140,193 | 140,330 | +137 | 1 / 0 / 1 |
| all | 140,193 | 140,330 | +137 | 1 / 0 / 1 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | $0.0431 | $0.0476 | +$0.0045 | 1 / 0 / 1 |
| all | $0.0431 | $0.0476 | +$0.0045 | 1 / 0 / 1 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 21.1 s | 18.9 s | −2.3 s | 1 / 0 / 1 |
| all | 21.1 s | 18.9 s | −2.3 s | 1 / 0 / 1 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| gin | $0.1724 (4 runs) | $0.1904 (4 runs) | none | none |
| all | $0.1724 (4 runs) | $0.1904 (4 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| gin/x001 | without | 2/2 | 10 [8–11] | 86 [74–98] | 2,054 [1,872–2,235] | 169,953 [142,020–197,886] | 13,823 [13,025–14,620] | $0.0550 [$0.0497–$0.0603] | 24.6 s [22.2 s–27.0 s] |
| gin/x001 | with | 2/2 | 9 [9–9] | 78 [74–82] | 2,094 [2,030–2,158] | 199,281 [182,592–215,969] | 21,005 [13,107–28,903] | $0.0725 [$0.0587–$0.0863] | 24.9 s [24.5 s–25.2 s] |
| gin/x002 | without | 2/2 | 6 [3–9] | 54 [34–74] | 1,406 [1,002–1,809] | 85,201 [45,980–124,422] | 7,811 [6,556–9,066] | $0.0312 [$0.0228–$0.0397] | 17.7 s [14.1 s–21.3 s] |
| gin/x002 | with | 2/2 | 4 [3–5] | 26 [26–26] | 892 [806–978] | 50,712 [50,624–50,799] | 6,574 [5,872–7,275] | $0.0227 [$0.0209–$0.0245] | 12.9 s [12.3 s–13.4 s] |

