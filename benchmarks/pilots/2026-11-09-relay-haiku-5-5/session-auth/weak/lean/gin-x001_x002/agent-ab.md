# Agent-level A/B — measured tool calls, tokens and cost

**claude-code 2.1.321 (Claude Code) · claude-haiku-4-5 · 2026-11-10 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap lean: 7-tool core MCP profile + a three-line section.
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
| Tool calls | −7% | −63% | fewer in every repetition |
| Input tokens (uncached) | −6% | −51% | fewer in every repetition |
| Output tokens | +1% | −46% | mixed |
| Cache-read tokens | −2% | −54% | fewer in every repetition |
| Cache-write tokens | +2% | −29% | mixed |
| Total tokens (derived) | −2% | −52% | fewer in every repetition |
| Cost | +1% | −40% | mixed |
| Wall time | +4% | −37% | mixed |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −6% [−44%, +60%] † | −66% [−75%, −55%] | fewer in every repetition, within the noise |
| Input tokens (uncached) | −5% [−39%, +48%] † | −52% [−55%, −49%] | fewer in every repetition, within the noise |
| Output tokens | +2% [−17%, +24%] † | −47% [−56%, −37%] | mixed |
| Cache-read tokens | +4% [−39%, +77%] † | −57% [−62%, −50%] | mixed |
| Cache-write tokens | +5% [−7%, +19%] † | −31% [−37%, −23%] | mixed |
| Total tokens (derived) | +4% [−36%, +71%] † | −54% [−60%, −48%] | mixed |
| Cost | +5% [−18%, +35%] † | −41% [−48%, −34%] | mixed |
| Wall time | +4% [−14%, +26%] † | −39% [−50%, −26%] | mixed |

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
| gin | 8 | 5 | −3 | 2 / 0 / 0 |
| all | 8 | 5 | −3 | 2 / 0 / 0 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 72 | 50 | −22 | 2 / 0 / 0 |
| all | 72 | 50 | −22 | 2 / 0 / 0 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 1,742 | 1,300 | −442 | 2 / 0 / 0 |
| all | 1,742 | 1,300 | −442 | 2 / 0 / 0 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 135,879 | 93,683 | −42,196 | 2 / 0 / 0 |
| all | 135,879 | 93,683 | −42,196 | 2 / 0 / 0 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 12,072 | 10,283 | −1,789 | 2 / 0 / 0 |
| all | 12,072 | 10,283 | −1,789 | 2 / 0 / 0 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 149,764 | 105,316 | −44,448 | 2 / 0 / 0 |
| all | 149,764 | 105,316 | −44,448 | 2 / 0 / 0 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | $0.0465 | $0.0365 | −$0.0100 | 2 / 0 / 0 |
| all | $0.0465 | $0.0365 | −$0.0100 | 2 / 0 / 0 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 22.5 s | 18.3 s | −4.3 s | 2 / 0 / 0 |
| all | 22.5 s | 18.3 s | −4.3 s | 2 / 0 / 0 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| gin | $0.1860 (4 runs) | $0.1459 (4 runs) | none | none |
| all | $0.1860 (4 runs) | $0.1459 (4 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| gin/x001 | without | 2/2 | 10 [9–11] | 90 [82–98] | 1,917 [1,718–2,116] | 183,193 [164,088–202,298] | 14,800 [14,105–15,495] | $0.0576 [$0.0533–$0.0619] | 24.7 s [22.0 s–27.5 s] |
| gin/x001 | with | 2/2 | 5 [5–5] | 50 [50–50] | 1,386 [1,337–1,434] | 100,267 [99,829–100,704] | 12,556 [11,965–13,147] | $0.0421 [$0.0407–$0.0435] | 19.7 s [18.9 s–20.5 s] |
| gin/x002 | without | 2/2 | 7 [5–8] | 54 [50–58] | 1,566 [1,319–1,813] | 88,564 [76,987–100,141] | 9,345 [7,694–10,995] | $0.0354 [$0.0297–$0.0411] | 20.3 s [17.6 s–23.0 s] |
| gin/x002 | with | 2/2 | 5 [2–8] | 50 [26–74] | 1,214 [794–1,634] | 87,100 [37,801–136,398] | 8,011 [6,875–9,146] | $0.0309 [$0.0215–$0.0402] | 16.9 s [11.4 s–22.3 s] |

