# Agent-level A/B — measured tool calls, tokens and cost

**claude-code 2.1.321 (Claude Code) · claude-haiku-4-5 · 2026-11-10 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap generated context + MCP server.
- Both arms: the same prompt, model, tool allowlist (Read, Grep, Glob, Bash), per-run budget cap $1 and timeout 420 s; run in a clean copy of the commit pinned in `benchmarks/xrepo-repos.json`.
- Questions: the task id(s) x084, x085 of `benchmarks/tasks/retrieval-xrepo.jsonl`. Pass = hit@5 on the repository-relative paths the answer names.
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
| rails | 2 | 4/4 | 4/4 | 0 / 0 |
| all | 2 | 4/4 | 4/4 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 2. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −8% | +5% | mixed |
| Input tokens (uncached) | −17% | −9% | fewer in every repetition |
| Output tokens | −6% | −11% | fewer in every repetition |
| Cache-read tokens | −1% | +8% | mixed |
| Cache-write tokens | +1% | −18% | mixed |
| Total tokens (derived) | −1% | +6% | mixed |
| Cost | −1% | −9% | fewer in every repetition |
| Wall time | −15% | −13% | fewer in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −9% [−13%, −6%] | +7% [0%, +14%] † | mixed |
| Input tokens (uncached) | −12% [−23%, 0%] † | −7% [−14%, 0%] † | fewer in every repetition, within the noise |
| Output tokens | −8% [−12%, −3%] | −9% [−16%, −1%] | fewer in every repetition, outside the noise |
| Cache-read tokens | +7% [−7%, +24%] † | +12% [+2%, +24%] | more in every repetition, within the noise |
| Cache-write tokens | 0% [0%, +1%] | −19% [−26%, −13%] | mixed |
| Total tokens (derived) | +6% [−7%, +20%] † | +9% [+1%, +19%] | more in every repetition, within the noise |
| Cost | 0% [−3%, +3%] † | −9% [−9%, −9%] | fewer in every repetition, within the noise |
| Wall time | −15% [−15%, −14%] | −12% [−16%, −7%] | fewer in every repetition, outside the noise |

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
| rails | 12 | 11 | −0 | 1 / 1 / 0 |
| all | 12 | 11 | −0 | 1 / 1 / 0 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | 90 | 78 | −12 | 1 / 1 / 0 |
| all | 90 | 78 | −12 | 1 / 1 / 0 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | 2,690 | 2,462 | −228 | 2 / 0 / 0 |
| all | 2,690 | 2,462 | −228 | 2 / 0 / 0 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | 212,257 | 219,437 | +7,180 | 1 / 0 / 1 |
| all | 212,257 | 219,437 | +7,180 | 1 / 0 / 1 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | 15,978 | 14,530 | −1,449 | 2 / 0 / 0 |
| all | 15,978 | 14,530 | −1,449 | 2 / 0 / 0 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | 231,015 | 236,506 | +5,491 | 1 / 0 / 1 |
| all | 231,015 | 236,506 | +5,491 | 1 / 0 / 1 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | $0.0667 | $0.0634 | −$0.0033 | 2 / 0 / 0 |
| all | $0.0667 | $0.0634 | −$0.0033 | 2 / 0 / 0 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | 32.3 s | 27.7 s | −4.5 s | 2 / 0 / 0 |
| all | 32.3 s | 27.7 s | −4.5 s | 2 / 0 / 0 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| rails | $0.2669 (4 runs) | $0.2536 (4 runs) | none | none |
| all | $0.2669 (4 runs) | $0.2536 (4 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| rails/x084 | without | 2/2 | 8 [7–8] | 54 [50–58] | 1,816 [1,808–1,824] | 101,372 [91,674–111,070] | 12,551 [12,316–12,786] | $0.0444 [$0.0430–$0.0458] | 22.7 s [22.6 s–22.9 s] |
| rails/x084 | with | 2/2 | 8 [7–8] | 54 [50–58] | 1,703 [1,611–1,795] | 125,513 [113,265–137,761] | 10,924 [9,521–12,326] | $0.0430 [$0.0419–$0.0441] | 20.3 s [19.3 s–21.2 s] |
| rails/x085 | without | 2/2 | 16 [15–16] | 126 [114–138] | 3,564 [3,483–3,644] | 323,142 [294,167–352,117] | 19,405 [17,910–20,900] | $0.0891 [$0.0887–$0.0894] | 41.8 s [39.6 s–44.0 s] |
| rails/x085 | with | 2/2 | 15 [15–15] | 102 [98–106] | 3,221 [2,920–3,521] | 313,360 [299,990–326,730] | 18,136 [18,059–18,212] | $0.0838 [$0.0811–$0.0865] | 35.2 s [33.1 s–37.3 s] |

