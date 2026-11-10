# Agent-level A/B — measured tool calls, tokens and cost

**claude-code 2.1.322 (Claude Code) · claude-haiku-4-5 · 2026-11-10 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap index strategy + 7-tool core MCP profile (the docs' setup for an agent that calls the tools).
- Both arms: the same prompt, model, tool allowlist (Read, Grep, Glob, Bash), per-run budget cap $1 and timeout 420 s; run in a clean copy of the commit pinned in `benchmarks/xrepo-repos.json`.
- Questions: the task id(s) x048, x049, x050 of `benchmarks/tasks/retrieval-xrepo.jsonl`. Pass = hit@5 on the repository-relative paths the answer names.
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
| laravel | 3 | 6/6 | 6/6 | 0 / 0 |
| all | 3 | 6/6 | 6/6 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 3. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −24% | +22% | mixed |
| Input tokens (uncached) | −21% | +17% | mixed |
| Output tokens | −12% | +4% | mixed |
| Cache-read tokens | −33% | +12% | mixed |
| Cache-write tokens | −50% | −37% | fewer in every repetition |
| Total tokens (derived) | −33% | +8% | mixed |
| Cost | −38% | −15% | fewer in every repetition |
| Wall time | −4% | +8% | mixed |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −26% [−36%, −6%] | +16% [−32%, +127%] † | mixed |
| Input tokens (uncached) | −22% [−31%, −5%] | +10% [−30%, +114%] † | mixed |
| Output tokens | −15% [−26%, +11%] † | +1% [−43%, +100%] † | mixed |
| Cache-read tokens | −36% [−53%, +3%] † | +2% [−37%, +115%] † | mixed |
| Cache-write tokens | −48% [−66%, +2%] † | −37% [−48%, −20%] | fewer in every repetition, within the noise |
| Total tokens (derived) | −37% [−54%, +3%] † | −1% [−37%, +104%] † | fewer in every repetition, within the noise |
| Cost | −39% [−57%, +5%] † | −19% [−40%, +38%] † | fewer in every repetition, within the noise |
| Wall time | −6% [−19%, +14%] † | +4% [−31%, +90%] † | mixed |

### Outcome (hit@5), by repetition

Per paired task: **better** = the SigMap arm named the file and the other did not; **worse** = the reverse; **tie** = both found it or both missed. Localisation only.

| repetition | paired tasks | better | worse | tie |
| --- | ---: | ---: | ---: | ---: |
| R1 | 3 | 0 | 0 | 3 |
| R2 | 3 | 0 | 0 | 3 |
| all | 6 | 0 | 0 | 6 |

## Tool calls

Provenance: agent-reported (main-thread tool_use blocks). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | 15 | 15 | −2 | 2 / 0 / 1 |
| all | 15 | 15 | −2 | 2 / 0 / 1 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | 126 | 126 | −16 | 2 / 0 / 1 |
| all | 126 | 126 | −16 | 2 / 0 / 1 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | 3,056 | 3,247 | −434 | 2 / 0 / 1 |
| all | 3,056 | 3,247 | −434 | 2 / 0 / 1 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | 334,108 | 298,459 | −71,853 | 2 / 0 / 1 |
| all | 334,108 | 298,459 | −71,853 | 2 / 0 / 1 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | 24,222 | 13,896 | −9,949 | 3 / 0 / 0 |
| all | 24,222 | 13,896 | −9,949 | 3 / 0 / 0 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | 361,511 | 315,727 | −76,585 | 2 / 0 / 1 |
| all | 361,511 | 315,727 | −76,585 | 2 / 0 / 1 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | $0.0973 | $0.0740 | −$0.0188 | 3 / 0 / 0 |
| all | $0.0973 | $0.0740 | −$0.0188 | 3 / 0 / 0 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | 35.8 s | 39.5 s | −3.6 s | 2 / 0 / 1 |
| all | 35.8 s | 39.5 s | −3.6 s | 2 / 0 / 1 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| laravel | $0.5752 (6 runs) | $0.4202 (6 runs) | none | none |
| all | $0.5752 (6 runs) | $0.4202 (6 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| laravel/x048 | without | 2/2 | 9 [7–11] | 78 [66–90] | 2,569 [2,542–2,595] | 223,222 [162,538–283,905] | 31,177 [29,173–33,180] | $0.0976 [$0.0874–$0.1078] | 31.9 s [31.9 s–31.9 s] |
| laravel/x048 | with | 2/2 | 7 [7–7] | 62 [58–66] | 2,135 [1,960–2,310] | 131,412 [127,990–134,834] | 13,249 [11,431–15,066] | $0.0504 [$0.0462–$0.0545] | 28.3 s [27.6 s–28.9 s] |
| laravel/x049 | without | 2/2 | 18 [17–19] | 154 [146–162] | 3,960 [3,642–4,277] | 370,312 [325,041–415,582] | 17,887 [15,263–20,510] | $0.0928 [$0.0814–$0.1041] | 43.5 s [41.4 s–45.6 s] |
| laravel/x049 | with | 2/2 | 15 [13–16] | 126 [114–138] | 3,247 [2,453–4,040] | 298,459 [261,476–335,442] | 13,896 [12,185–15,606] | $0.0740 [$0.0629–$0.0851] | 39.5 s [31.5 s–47.4 s] |
| laravel/x050 | without | 2/2 | 15 [11–18] | 126 [98–154] | 3,056 [2,465–3,647] | 334,108 [249,153–419,062] | 24,222 [23,095–25,348] | $0.0973 [$0.0835–$0.1110] | 35.8 s [29.7 s–41.9 s] |
| laravel/x050 | with | 2/2 | 19 [12–25] | 158 [106–210] | 3,811 [2,692–4,929] | 379,820 [223,529–536,110] | 14,273 [9,992–18,554] | $0.0857 [$0.0559–$0.1156] | 45.1 s [34.0 s–56.3 s] |

