# Agent-level A/B — measured tool calls, tokens and cost

**claude-code 2.1.321 (Claude Code) · claude-haiku-5-5 · 2026-11-09 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap lean: 7-tool core MCP profile + a three-line section.
- Both arms: the same prompt, model, tool allowlist (Read, Grep, Glob, Bash), per-run budget cap $0.5 and timeout 420 s; run in a clean copy of the commit pinned in `benchmarks/xrepo-repos.json`.
- Questions: the task id(s) x084, x085, x086, x087, x088 of `benchmarks/tasks/retrieval-xrepo.jsonl`. Pass = hit@5 on the repository-relative paths the answer names.
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
| rails | 5 | 10/10 | 10/10 | 0 / 0 |
| all | 5 | 10/10 | 10/10 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 5. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | +6% | +50% | more in every repetition |
| Input tokens (uncached) | −13% | +19% | mixed |
| Output tokens | +3% | +14% | more in every repetition |
| Cache-read tokens | −2% | +36% | mixed |
| Cache-write tokens | −6% | −3% | fewer in every repetition |
| Total tokens (derived) | −3% | +30% | mixed |
| Cost | −4% | +7% | mixed |
| Wall time | +7% | +11% | more in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | +6% [0%, +19%] † | +61% [+26%, +93%] | more in every repetition, within the noise |
| Input tokens (uncached) | −15% [−28%, 0%] † | +16% [0%, +42%] † | mixed |
| Output tokens | +6% [−5%, +18%] † | +17% [+6%, +30%] | more in every repetition, within the noise |
| Cache-read tokens | −7% [−25%, +14%] † | +33% [+12%, +69%] | mixed |
| Cache-write tokens | −4% [−15%, +6%] † | −3% [−18%, +11%] † | fewer in every repetition, within the noise |
| Total tokens (derived) | −6% [−19%, +9%] † | +27% [+8%, +60%] | mixed |
| Cost | −3% [−9%, +5%] † | +8% [−4%, +21%] † | mixed |
| Wall time | +7% [−7%, +24%] † | +14% [0%, +32%] | more in every repetition, within the noise |

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
| rails | 3 | 5 | +1 | 0 / 1 / 4 |
| all | 3 | 5 | +1 | 0 / 1 / 4 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | 6 | 8 | 0 | 2 / 1 / 2 |
| all | 6 | 8 | 0 | 2 / 1 / 2 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | 1,159 | 1,275 | +143 | 1 / 0 / 4 |
| all | 1,159 | 1,275 | +143 | 1 / 0 / 4 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | 35,916 | 57,809 | +9,350 | 2 / 0 / 3 |
| all | 35,916 | 57,809 | +9,350 | 2 / 0 / 3 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | 8,044 | 8,471 | −100 | 3 / 0 / 2 |
| all | 8,044 | 8,471 | −100 | 3 / 0 / 2 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | 45,021 | 67,331 | +9,141 | 2 / 0 / 3 |
| all | 45,021 | 67,331 | +9,141 | 2 / 0 / 3 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | $0.0025 | $0.0028 | +$0.0000 | 2 / 0 / 3 |
| all | $0.0025 | $0.0028 | +$0.0000 | 2 / 0 / 3 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | 12.5 s | 14.2 s | +851 ms | 2 / 0 / 3 |
| all | 12.5 s | 14.2 s | +851 ms | 2 / 0 / 3 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| rails | $0.0292 (10 runs) | $0.0296 (10 runs) | none | none |
| all | $0.0292 (10 runs) | $0.0296 (10 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| rails/x084 | without | 2/2 | 3 [3–3] | 6 [6–6] | 856 [797–915] | 34,313 [32,599–36,027] | 8,044 [6,477–9,611] | $0.0024 [$0.0021–$0.0026] | 10.0 s [9.7 s–10.2 s] |
| rails/x084 | with | 2/2 | 5 [4–5] | 8 [6–10] | 1,044 [837–1,251] | 57,809 [38,743–76,874] | 8,471 [7,085–9,856] | $0.0028 [$0.0028–$0.0028] | 14.2 s [14.0 s–14.5 s] |
| rails/x085 | without | 2/2 | 3 [2–3] | 6 [6–6] | 1,159 [1,088–1,230] | 35,916 [32,272–39,560] | 7,940 [7,765–8,114] | $0.0025 [$0.0025–$0.0026] | 12.5 s [12.3 s–12.7 s] |
| rails/x085 | with | 2/2 | 4 [3–4] | 5 [4–6] | 1,275 [1,165–1,385] | 32,086 [22,235–41,936] | 6,786 [5,874–7,697] | $0.0023 [$0.0023–$0.0023] | 11.5 s [10.7 s–12.3 s] |
| rails/x086 | without | 2/2 | 2 [1–2] | 5 [4–6] | 689 [651–727] | 27,362 [22,562–32,161] | 5,836 [4,456–7,215] | $0.0018 [$0.0014–$0.0021] | 8.9 s [8.0 s–9.8 s] |
| rails/x086 | with | 2/2 | 2 [2–2] | 4 [4–4] | 832 [734–929] | 24,019 [22,245–25,792] | 6,442 [4,741–8,143] | $0.0019 [$0.0016–$0.0023] | 9.8 s [9.7 s–9.8 s] |
| rails/x087 | without | 2/2 | 5 [5–5] | 8 [8–8] | 2,026 [1,934–2,118] | 53,035 [51,123–54,946] | 13,458 [10,648–16,267] | $0.0042 [$0.0037–$0.0047] | 16.9 s [16.1 s–17.7 s] |
| rails/x087 | with | 2/2 | 5 [5–5] | 8 [8–8] | 1,917 [1,762–2,072] | 62,384 [59,125–65,643] | 13,358 [12,215–14,500] | $0.0043 [$0.0041–$0.0044] | 16.8 s [16.6 s–17.1 s] |
| rails/x088 | without | 2/2 | 5 [4–5] | 7 [6–8] | 1,454 [1,334–1,573] | 48,640 [36,940–60,340] | 12,297 [11,661–12,932] | $0.0037 [$0.0036–$0.0037] | 13.7 s [12.0 s–15.4 s] |
| rails/x088 | with | 2/2 | 6 [4–8] | 8 [6–10] | 1,661 [1,538–1,784] | 59,762 [38,453–81,070] | 10,220 [10,139–10,301] | $0.0035 [$0.0032–$0.0038] | 15.4 s [13.9 s–16.8 s] |

