# Agent-level A/B — measured tool calls, tokens and cost

**claude-code 2.1.319 (Claude Code) · claude-haiku-5-5 · 2026-11-09 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap index strategy + 7-tool core MCP profile (the docs' setup for an agent that calls the tools).
- Both arms: the same prompt, model, tool allowlist (Read, Grep, Glob, Bash), per-run budget cap $0.5 and timeout 420 s; run in a clean copy of the commit pinned in `benchmarks/xrepo-repos.json`.
- Questions: the task id(s) x046, x047, x048, x049, x050 of `benchmarks/tasks/retrieval-xrepo.jsonl`. Pass = hit@5 on the repository-relative paths the answer names.
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
| laravel | 5 | 10/10 | 10/10 | 0 / 0 |
| all | 5 | 10/10 | 10/10 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 5. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | 0% | −26% | mixed |
| Input tokens (uncached) | 0% | −6% | mixed |
| Output tokens | −12% | −17% | fewer in every repetition |
| Cache-read tokens | +27% | +19% | more in every repetition |
| Cache-write tokens | +3% | −13% | mixed |
| Total tokens (derived) | +22% | +12% | more in every repetition |
| Cost | +2% | −10% | mixed |
| Wall time | −7% | −2% | fewer in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −7% [−40%, +28%] † | −24% [−40%, −10%] | fewer in every repetition, within the noise |
| Input tokens (uncached) | −1% [−16%, +14%] † | −6% [−16%, 0%] † | fewer in every repetition, within the noise |
| Output tokens | −12% [−30%, +10%] † | −16% [−37%, 0%] † | fewer in every repetition, within the noise |
| Cache-read tokens | +24% [−1%, +54%] † | +19% [+4%, +30%] | more in every repetition, within the noise |
| Cache-write tokens | +3% [−17%, +27%] † | −12% [−21%, −3%] | mixed |
| Total tokens (derived) | +19% [−4%, +47%] † | +13% [−1%, +22%] † | more in every repetition, within the noise |
| Cost | +1% [−17%, +22%] † | −9% [−22%, +1%] † | mixed |
| Wall time | −7% [−24%, +11%] † | −2% [−8%, +5%] † | fewer in every repetition, within the noise |

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
| laravel | 5 | 5 | −1 | 3 / 1 / 1 |
| all | 5 | 5 | −1 | 3 / 1 / 1 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | 7 | 7 | 0 | 2 / 2 / 1 |
| all | 7 | 7 | 0 | 2 / 2 / 1 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | 1,419 | 1,341 | −104 | 4 / 0 / 1 |
| all | 1,419 | 1,341 | −104 | 4 / 0 / 1 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | 34,608 | 41,920 | +9,013 | 0 / 0 / 5 |
| all | 34,608 | 41,920 | +9,013 | 0 / 0 / 5 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | 7,607 | 7,355 | −14 | 3 / 0 / 2 |
| all | 7,607 | 7,355 | −14 | 3 / 0 / 2 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | 43,944 | 50,378 | +6,743 | 1 / 0 / 4 |
| all | 43,944 | 50,378 | +6,743 | 1 / 0 / 4 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | $0.0026 | $0.0025 | −$0.0004 | 3 / 0 / 2 |
| all | $0.0026 | $0.0025 | −$0.0004 | 3 / 0 / 2 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | 14.7 s | 14.2 s | −847 ms | 4 / 0 / 1 |
| all | 14.7 s | 14.2 s | −847 ms | 4 / 0 / 1 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| laravel | $0.0271 (10 runs) | $0.0262 (10 runs) | none | none |
| all | $0.0271 (10 runs) | $0.0262 (10 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| laravel/x046 | without | 2/2 | 6 [5–6] | 8 [8–8] | 1,883 [1,882–1,884] | 40,358 [40,295–40,421] | 7,369 [7,085–7,652] | $0.0028 [$0.0028–$0.0029] | 16.0 s [15.9 s–16.1 s] |
| laravel/x046 | with | 2/2 | 4 [3–5] | 7 [6–8] | 1,097 [925–1,268] | 41,920 [36,940–46,899] | 7,355 [5,756–8,953] | $0.0024 [$0.0020–$0.0029] | 14.2 s [14.0 s–14.4 s] |
| laravel/x047 | without | 2/2 | 4 [2–5] | 7 [6–8] | 1,419 [1,040–1,798] | 34,608 [27,609–41,607] | 7,910 [7,298–8,521] | $0.0026 [$0.0023–$0.0030] | 14.7 s [11.4 s–18.0 s] |
| laravel/x047 | with | 2/2 | 2 [2–2] | 6 [6–6] | 1,120 [1,117–1,122] | 35,692 [35,305–36,079] | 6,591 [6,469–6,713] | $0.0022 [$0.0022–$0.0023] | 12.0 s [11.7 s–12.2 s] |
| laravel/x048 | without | 2/2 | 5 [4–6] | 8 [8–8] | 1,660 [1,564–1,756] | 43,469 [42,881–44,056] | 9,940 [9,044–10,836] | $0.0033 [$0.0031–$0.0034] | 15.6 s [15.2 s–15.9 s] |
| laravel/x048 | with | 2/2 | 5 [4–5] | 8 [8–8] | 1,557 [1,481–1,632] | 52,548 [52,337–52,758] | 7,707 [7,239–8,175] | $0.0028 [$0.0028–$0.0029] | 14.7 s [14.6 s–14.9 s] |
| laravel/x049 | without | 2/2 | 5 [4–5] | 6 [6–6] | 1,332 [1,279–1,384] | 27,082 [26,722–27,442] | 6,818 [6,802–6,834] | $0.0023 [$0.0023–$0.0023] | 12.8 s [12.4 s–13.1 s] |
| laravel/x049 | with | 2/2 | 5 [4–5] | 6 [6–6] | 1,459 [1,329–1,589] | 36,095 [35,711–36,478] | 6,971 [6,004–7,938] | $0.0025 [$0.0022–$0.0027] | 14.8 s [13.3 s–16.4 s] |
| laravel/x050 | without | 2/2 | 5 [4–5] | 7 [6–8] | 1,373 [1,147–1,598] | 34,383 [27,956–40,810] | 7,607 [5,784–9,429] | $0.0026 [$0.0020–$0.0031] | 14.2 s [11.6 s–16.8 s] |
| laravel/x050 | with | 2/2 | 5 [3–7] | 8 [6–10] | 1,341 [1,011–1,671] | 55,204 [35,611–74,797] | 9,375 [6,119–12,631] | $0.0031 [$0.0021–$0.0041] | 14.2 s [11.3 s–17.1 s] |

