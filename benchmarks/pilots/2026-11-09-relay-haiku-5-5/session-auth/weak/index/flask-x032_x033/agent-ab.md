# Agent-level A/B — measured tool calls, tokens and cost

**claude-code 2.1.321 (Claude Code) · claude-haiku-4-5 · 2026-11-10 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap index strategy + 7-tool core MCP profile (the docs' setup for an agent that calls the tools).
- Both arms: the same prompt, model, tool allowlist (Read, Grep, Glob, Bash), per-run budget cap $1 and timeout 420 s; run in a clean copy of the commit pinned in `benchmarks/xrepo-repos.json`.
- Questions: the task id(s) x032, x033 of `benchmarks/tasks/retrieval-xrepo.jsonl`. Pass = hit@5 on the repository-relative paths the answer names.
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
| flask | 2 | 4/4 | 4/4 | 0 / 0 |
| all | 2 | 4/4 | 4/4 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 2. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −10% | −27% | fewer in every repetition |
| Input tokens (uncached) | −26% | −32% | fewer in every repetition |
| Output tokens | −42% | −21% | fewer in every repetition |
| Cache-read tokens | −43% | −25% | fewer in every repetition |
| Cache-write tokens | −56% | −15% | fewer in every repetition |
| Total tokens (derived) | −45% | −24% | fewer in every repetition |
| Cost | −50% | −19% | fewer in every repetition |
| Wall time | −44% | −21% | fewer in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −15% [−64%, +100%] † | −26% [−59%, +33%] † | fewer in every repetition, within the noise |
| Input tokens (uncached) | −25% [−59%, +36%] † | −33% [−66%, +29%] † | fewer in every repetition, within the noise |
| Output tokens | −43% [−50%, −36%] | −26% [−52%, +16%] † | fewer in every repetition, within the noise |
| Cache-read tokens | −43% [−68%, −1%] | −35% [−71%, +44%] † | fewer in every repetition, within the noise |
| Cache-write tokens | −55% [−66%, −42%] | −17% [−24%, −8%] | fewer in every repetition, outside the noise |
| Total tokens (derived) | −45% [−66%, −11%] | −34% [−69%, +38%] † | fewer in every repetition, within the noise |
| Cost | −50% [−52%, −48%] | −25% [−48%, +8%] † | fewer in every repetition, within the noise |
| Wall time | −45% [−48%, −41%] | −24% [−47%, +11%] † | fewer in every repetition, within the noise |

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
| flask | 12 | 10 | −2 | 1 / 0 / 1 |
| all | 12 | 10 | −2 | 1 / 0 / 1 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | 104 | 74 | −30 | 1 / 0 / 1 |
| all | 104 | 74 | −30 | 1 / 0 / 1 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | 3,664 | 2,496 | −1,168 | 2 / 0 / 0 |
| all | 3,664 | 2,496 | −1,168 | 2 / 0 / 0 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | 315,174 | 211,047 | −104,128 | 1 / 0 / 1 |
| all | 315,174 | 211,047 | −104,128 | 1 / 0 / 1 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | 30,084 | 19,289 | −10,795 | 2 / 0 / 0 |
| all | 30,084 | 19,289 | −10,795 | 2 / 0 / 0 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | 349,025 | 232,905 | −116,120 | 1 / 0 / 1 |
| all | 349,025 | 232,905 | −116,120 | 1 / 0 / 1 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | $0.1101 | $0.0722 | −$0.0379 | 2 / 0 / 0 |
| all | $0.1101 | $0.0722 | −$0.0379 | 2 / 0 / 0 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | 40.8 s | 27.2 s | −13.6 s | 2 / 0 / 0 |
| all | 40.8 s | 27.2 s | −13.6 s | 2 / 0 / 0 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| flask | $0.4404 (4 runs) | $0.2889 (4 runs) | none | none |
| all | $0.4404 (4 runs) | $0.2889 (4 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| flask/x032 | without | 2/2 | 8 [7–9] | 74 [66–82] | 3,891 [3,161–4,621] | 242,430 [202,265–282,594] | 35,372 [34,845–35,899] | $0.1145 [$0.1138–$0.1152] | 42.3 s [34.7 s–49.9 s] |
| flask/x032 | with | 2/2 | 13 [12–14] | 98 [90–106] | 3,321 [2,970–3,672] | 303,729 [200,342–407,116] | 22,150 [12,381–31,918] | $0.0914 [$0.0597–$0.1230] | 33.9 s [29.3 s–38.6 s] |
| flask/x033 | without | 2/2 | 16 [14–17] | 134 [122–146] | 3,437 [3,079–3,794] | 387,919 [354,304–421,533] | 24,795 [23,177–26,413] | $0.1057 [$0.1038–$0.1076] | 39.4 s [37.7 s–41.1 s] |
| flask/x033 | with | 2/2 | 6 [5–7] | 50 [50–50] | 1,671 [1,530–1,811] | 118,364 [114,957–121,771] | 16,429 [15,329–17,528] | $0.0531 [$0.0499–$0.0563] | 20.6 s [19.6 s–21.6 s] |

