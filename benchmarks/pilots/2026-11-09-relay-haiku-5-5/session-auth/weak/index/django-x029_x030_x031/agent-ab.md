# Agent-level A/B — measured tool calls, tokens and cost

**claude-code 2.1.322 (Claude Code) · claude-haiku-4-5 · 2026-11-10 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap index strategy + 7-tool core MCP profile (the docs' setup for an agent that calls the tools).
- Both arms: the same prompt, model, tool allowlist (Read, Grep, Glob, Bash), per-run budget cap $1 and timeout 420 s; run in a clean copy of the commit pinned in `benchmarks/xrepo-repos.json`.
- Questions: the task id(s) x029, x030, x031 of `benchmarks/tasks/retrieval-xrepo.jsonl`. Pass = hit@5 on the repository-relative paths the answer names.
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
| django | 3 | 6/6 | 6/6 | 0 / 0 |
| all | 3 | 6/6 | 6/6 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 3. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −13% | −12% | fewer in every repetition |
| Input tokens (uncached) | +3% | −11% | mixed |
| Output tokens | +4% | −22% | mixed |
| Cache-read tokens | +7% | −14% | mixed |
| Cache-write tokens | −16% | −26% | fewer in every repetition |
| Total tokens (derived) | +5% | −15% | mixed |
| Cost | −5% | −22% | fewer in every repetition |
| Wall time | +13% | −12% | mixed |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −11% [−56%, +38%] † | −6% [−50%, +83%] † | fewer in every repetition, within the noise |
| Input tokens (uncached) | +2% [−30%, +32%] † | −6% [−46%, +69%] † | mixed |
| Output tokens | +2% [−35%, +40%] † | −16% [−41%, +35%] † | mixed |
| Cache-read tokens | +10% [−23%, +68%] † | 0% [−47%, +131%] † | mixed |
| Cache-write tokens | −13% [−30%, +13%] † | −22% [−40%, +22%] † | fewer in every repetition, within the noise |
| Total tokens (derived) | +9% [−23%, +63%] † | −3% [−46%, +116%] † | mixed |
| Cost | −2% [−22%, +29%] † | −16% [−38%, +48%] † | fewer in every repetition, within the noise |
| Wall time | +11% [−24%, +48%] † | −8% [−32%, +32%] † | mixed |

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
| django | 13 | 11 | +1 | 1 / 0 / 2 |
| all | 13 | 11 | +1 | 1 / 0 / 2 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | 110 | 98 | +4 | 1 / 0 / 2 |
| all | 110 | 98 | +4 | 1 / 0 / 2 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | 3,038 | 2,458 | −387 | 2 / 0 / 1 |
| all | 3,038 | 2,458 | −387 | 2 / 0 / 1 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | 276,571 | 227,239 | −19,137 | 2 / 0 / 1 |
| all | 276,571 | 227,239 | −19,137 | 2 / 0 / 1 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | 23,415 | 15,187 | −7,138 | 2 / 0 / 1 |
| all | 23,415 | 15,187 | −7,138 | 2 / 0 / 1 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | 303,588 | 244,691 | −27,748 | 2 / 0 / 1 |
| all | 303,588 | 244,691 | −27,748 | 2 / 0 / 1 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | $0.0921 | $0.0680 | −$0.0203 | 2 / 0 / 1 |
| all | $0.0921 | $0.0680 | −$0.0203 | 2 / 0 / 1 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | 35.1 s | 31.5 s | +22 ms | 1 / 0 / 2 |
| all | 35.1 s | 31.5 s | +22 ms | 1 / 0 / 2 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| django | $0.4752 (6 runs) | $0.4093 (6 runs) | none | none |
| all | $0.4752 (6 runs) | $0.4093 (6 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| django/x029 | without | 2/2 | 13 [11–14] | 110 [98–122] | 3,492 [2,605–4,379] | 276,571 [253,440–299,702] | 23,415 [22,354–24,476] | $0.0921 [$0.0878–$0.0963] | 40.2 s [32.3 s–48.0 s] |
| django/x029 | with | 2/2 | 13 [10–16] | 114 [90–138] | 3,106 [2,574–3,637] | 257,434 [203,057–311,811] | 15,187 [14,655–15,719] | $0.0718 [$0.0626–$0.0809] | 40.2 s [32.6 s–47.8 s] |
| django/x030 | without | 2/2 | 7 [6–8] | 66 [58–74] | 1,979 [1,705–2,252] | 117,626 [93,360–141,892] | 12,663 [12,163–13,163] | $0.0470 [$0.0442–$0.0498] | 25.0 s [23.3 s–26.7 s] |
| django/x030 | with | 2/2 | 11 [11–11] | 98 [98–98] | 2,458 [2,305–2,610] | 227,239 [215,942–238,535] | 14,897 [13,756–16,037] | $0.0649 [$0.0645–$0.0653] | 31.5 s [30.8 s–32.2 s] |
| django/x031 | without | 2/2 | 17 [16–18] | 122 [106–138] | 3,038 [2,984–3,091] | 314,368 [266,737–361,999] | 25,872 [23,073–28,671] | $0.0985 [$0.0884–$0.1086] | 35.1 s [35.0 s–35.3 s] |
| django/x031 | with | 2/2 | 8 [8–8] | 74 [74–74] | 2,110 [2,006–2,213] | 199,095 [193,111–205,079] | 18,735 [18,427–19,042] | $0.0680 [$0.0673–$0.0687] | 28.6 s [26.6 s–30.5 s] |

