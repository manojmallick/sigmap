# Agent-level A/B — measured tool calls, tokens and cost

**claude-code 2.1.322 (Claude Code) · claude-haiku-4-5 · 2026-11-10 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap lean: 7-tool core MCP profile + a three-line section.
- Both arms: the same prompt, model, tool allowlist (Read, Grep, Glob, Bash), per-run budget cap $1 and timeout 420 s; run in a clean copy of the commit pinned in `benchmarks/xrepo-repos.json`.
- Questions: the task id(s) x039, x040 of `benchmarks/tasks/retrieval-xrepo.jsonl`. Pass = hit@5 on the repository-relative paths the answer names.
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
| express | 2 | 4/4 | 4/4 | 0 / 0 |
| all | 2 | 4/4 | 4/4 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 2. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −41% | −29% | fewer in every repetition |
| Input tokens (uncached) | −51% | −34% | fewer in every repetition |
| Output tokens | −46% | −33% | fewer in every repetition |
| Cache-read tokens | −56% | −34% | fewer in every repetition |
| Cache-write tokens | −44% | +5% | mixed |
| Total tokens (derived) | −55% | −31% | fewer in every repetition |
| Cost | −47% | −12% | fewer in every repetition |
| Wall time | −35% | −29% | fewer in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −40% [−50%, −29%] | −29% [−50%, 0%] † | fewer in every repetition, within the noise |
| Input tokens (uncached) | −49% [−62%, −32%] | −32% [−44%, −16%] | fewer in every repetition, outside the noise |
| Output tokens | −46% [−50%, −42%] | −32% [−56%, +4%] † | fewer in every repetition, within the noise |
| Cache-read tokens | −52% [−68%, −27%] | −31% [−51%, −3%] | fewer in every repetition, outside the noise |
| Cache-write tokens | −44% [−44%, −44%] | −8% [−35%, +30%] † | fewer in every repetition, within the noise |
| Total tokens (derived) | −51% [−66%, −30%] | −28% [−50%, +3%] † | fewer in every repetition, within the noise |
| Cost | −47% [−51%, −42%] | −19% [−45%, +21%] † | fewer in every repetition, within the noise |
| Wall time | −35% [−38%, −33%] | −27% [−47%, 0%] | fewer in every repetition, outside the noise |

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
| express | 9 | 6 | −3 | 2 / 0 / 0 |
| all | 9 | 6 | −3 | 2 / 0 / 0 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | 70 | 40 | −30 | 2 / 0 / 0 |
| all | 70 | 40 | −30 | 2 / 0 / 0 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | 1,866 | 1,127 | −739 | 2 / 0 / 0 |
| all | 1,866 | 1,127 | −739 | 2 / 0 / 0 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | 121,295 | 66,886 | −54,409 | 2 / 0 / 0 |
| all | 121,295 | 66,886 | −54,409 | 2 / 0 / 0 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | 13,142 | 10,781 | −2,361 | 2 / 0 / 0 |
| all | 13,142 | 10,781 | −2,361 | 2 / 0 / 0 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | 136,373 | 78,834 | −57,539 | 2 / 0 / 0 |
| all | 136,373 | 78,834 | −57,539 | 2 / 0 / 0 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | $0.0478 | $0.0339 | −$0.0139 | 2 / 0 / 0 |
| all | $0.0478 | $0.0339 | −$0.0139 | 2 / 0 / 0 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | 22.7 s | 15.4 s | −7.3 s | 2 / 0 / 0 |
| all | 22.7 s | 15.4 s | −7.3 s | 2 / 0 / 0 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| express | $0.1913 (4 runs) | $0.1357 (4 runs) | none | none |
| all | $0.1913 (4 runs) | $0.1357 (4 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| express/x039 | without | 2/2 | 9 [7–10] | 70 [50–90] | 1,641 [1,393–1,888] | 124,599 [84,609–164,588] | 14,895 [12,632–17,158] | $0.0505 [$0.0498–$0.0513] | 20.9 s [17.8 s–23.9 s] |
| express/x039 | with | 2/2 | 6 [5–7] | 38 [34–42] | 1,268 [1,091–1,445] | 67,291 [52,163–82,419] | 14,680 [7,082–22,278] | $0.0425 [$0.0249–$0.0601] | 16.4 s [15.0 s–17.8 s] |
| express/x040 | without | 2/2 | 9 [7–10] | 70 [50–90] | 2,092 [1,907–2,276] | 117,992 [71,304–164,679] | 11,389 [10,481–12,297] | $0.0451 [$0.0413–$0.0489] | 24.5 s [21.0 s–27.9 s] |
| express/x040 | with | 2/2 | 5 [5–5] | 42 [34–50] | 986 [962–1,010] | 66,482 [51,971–80,992] | 6,882 [6,856–6,907] | $0.0254 [$0.0239–$0.0269] | 14.4 s [14.1 s–14.7 s] |

