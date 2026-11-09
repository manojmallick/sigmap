# Agent-level A/B — measured tool calls, tokens and cost

**claude-code 2.1.319 (Claude Code) · claude-haiku-5-5 · 2026-11-09 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap index strategy + 7-tool core MCP profile (the docs' setup for an agent that calls the tools).
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
| Tool calls | −14% | −6% | fewer in every repetition |
| Input tokens (uncached) | 0% | +6% | mixed |
| Output tokens | −17% | −11% | fewer in every repetition |
| Cache-read tokens | +23% | +30% | more in every repetition |
| Cache-write tokens | +6% | −3% | mixed |
| Total tokens (derived) | +19% | +25% | more in every repetition |
| Cost | +3% | 0% | more in every repetition |
| Wall time | 0% | +1% | more in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −14% [−23%, −3%] | −8% [−24%, +9%] † | fewer in every repetition, within the noise |
| Input tokens (uncached) | +2% [−16%, +28%] † | +8% [−11%, +32%] † | more in every repetition, within the noise |
| Output tokens | −16% [−32%, +5%] † | −10% [−23%, +5%] † | fewer in every repetition, within the noise |
| Cache-read tokens | +28% [−1%, +73%] † | +35% [+7%, +70%] | more in every repetition, within the noise |
| Cache-write tokens | +7% [−8%, +25%] † | −3% [−21%, +21%] † | mixed |
| Total tokens (derived) | +23% [+3%, +55%] | +29% [+7%, +57%] | more in every repetition, outside the noise |
| Cost | +6% [−8%, +20%] † | +3% [−9%, +18%] † | more in every repetition, within the noise |
| Wall time | +1% [−15%, +22%] † | +3% [−7%, +16%] † | more in every repetition, within the noise |

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
| rails | 4 | 4 | −1 | 3 / 1 / 1 |
| all | 4 | 4 | −1 | 3 / 1 / 1 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | 7 | 7 | 0 | 2 / 1 / 2 |
| all | 7 | 7 | 0 | 2 / 1 / 2 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | 1,436 | 1,312 | −261 | 4 / 0 / 1 |
| all | 1,436 | 1,312 | −261 | 4 / 0 / 1 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | 41,208 | 52,943 | +10,398 | 0 / 0 / 5 |
| all | 41,208 | 52,943 | +10,398 | 0 / 0 / 5 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | 8,011 | 9,319 | +1,031 | 2 / 0 / 3 |
| all | 8,011 | 9,319 | +1,031 | 2 / 0 / 3 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | 50,661 | 64,143 | +8,247 | 0 / 0 / 5 |
| all | 50,661 | 64,143 | +8,247 | 0 / 0 / 5 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | $0.0027 | $0.0027 | +$0.0000 | 2 / 0 / 3 |
| all | $0.0027 | $0.0027 | +$0.0000 | 2 / 0 / 3 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | 13.6 s | 14.2 s | −809 ms | 3 / 0 / 2 |
| all | 13.6 s | 14.2 s | −809 ms | 3 / 0 / 2 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| rails | $0.0273 (10 runs) | $0.0279 (10 runs) | none | none |
| all | $0.0273 (10 runs) | $0.0279 (10 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| rails/x084 | without | 2/2 | 4 [3–4] | 7 [6–8] | 1,054 [844–1,264] | 40,798 [35,529–46,067] | 7,866 [5,745–9,986] | $0.0025 [$0.0019–$0.0031] | 11.7 s [10.4 s–13.1 s] |
| rails/x084 | with | 2/2 | 3 [2–3] | 6 [6–6] | 794 [778–809] | 41,445 [38,538–44,352] | 9,430 [5,255–13,604] | $0.0027 [$0.0019–$0.0035] | 10.6 s [10.1 s–11.2 s] |
| rails/x085 | without | 2/2 | 5 [4–5] | 7 [6–8] | 1,436 [1,343–1,529] | 41,208 [36,326–46,089] | 8,011 [7,293–8,728] | $0.0027 [$0.0026–$0.0029] | 13.6 s [13.2 s–14.0 s] |
| rails/x085 | with | 2/2 | 5 [5–5] | 8 [8–8] | 1,312 [1,104–1,520] | 60,062 [59,074–61,049] | 6,965 [5,112–8,817] | $0.0027 [$0.0022–$0.0031] | 14.2 s [12.7 s–15.7 s] |
| rails/x086 | without | 2/2 | 2 [2–2] | 4 [4–4] | 708 [673–742] | 20,610 [18,821–22,398] | 5,489 [3,712–7,265] | $0.0017 [$0.0013–$0.0020] | 8.6 s [8.4 s–8.7 s] |
| rails/x086 | with | 2/2 | 2 [2–2] | 6 [6–6] | 791 [755–827] | 43,176 [41,261–45,091] | 6,850 [4,545–9,154] | $0.0022 [$0.0017–$0.0027] | 11.5 s [10.7 s–12.3 s] |
| rails/x087 | without | 2/2 | 4 [4–4] | 8 [8–8] | 1,738 [1,618–1,857] | 53,630 [52,223–55,036] | 11,192 [9,080–13,304] | $0.0036 [$0.0032–$0.0041] | 16.2 s [16.2 s–16.3 s] |
| rails/x087 | with | 2/2 | 4 [3–4] | 8 [8–8] | 1,460 [1,216–1,704] | 64,028 [62,117–65,938] | 9,319 [7,422–11,215] | $0.0032 [$0.0030–$0.0035] | 15.4 s [14.6 s–16.3 s] |
| rails/x088 | without | 2/2 | 6 [5–7] | 8 [8–8] | 1,700 [1,676–1,724] | 50,174 [47,672–52,675] | 8,835 [6,850–10,820] | $0.0031 [$0.0028–$0.0035] | 15.4 s [14.7 s–16.0 s] |
| rails/x088 | with | 2/2 | 5 [4–6] | 7 [6–8] | 1,328 [1,314–1,341] | 52,943 [46,897–58,988] | 9,866 [9,394–10,337] | $0.0032 [$0.0030–$0.0033] | 14.2 s [14.1 s–14.2 s] |

