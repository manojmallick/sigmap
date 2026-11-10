# Agent-level A/B — measured tool calls, tokens and cost

**claude-code 2.1.321 (Claude Code) · claude-haiku-4-5 · 2026-11-10 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap generated context + MCP server.
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
| Tool calls | −18% | −34% | fewer in every repetition |
| Input tokens (uncached) | −37% | −53% | fewer in every repetition |
| Output tokens | −23% | −37% | fewer in every repetition |
| Cache-read tokens | −34% | −53% | fewer in every repetition |
| Cache-write tokens | −29% | −24% | fewer in every repetition |
| Total tokens (derived) | −33% | −51% | fewer in every repetition |
| Cost | −29% | −38% | fewer in every repetition |
| Wall time | −24% | −38% | fewer in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −24% [−75%, +133%] † | −36% [−47%, −22%] | fewer in every repetition, within the noise |
| Input tokens (uncached) | −38% [−75%, +55%] † | −54% [−60%, −47%] | fewer in every repetition, within the noise |
| Output tokens | −31% [−61%, +21%] † | −39% [−49%, −26%] | fewer in every repetition, within the noise |
| Cache-read tokens | −40% [−79%, +73%] † | −53% [−63%, −40%] | fewer in every repetition, within the noise |
| Cache-write tokens | −29% [−31%, −27%] | −24% [−25%, −23%] | fewer in every repetition, outside the noise |
| Total tokens (derived) | −39% [−76%, +55%] † | −51% [−61%, −39%] | fewer in every repetition, within the noise |
| Cost | −34% [−54%, −3%] | −38% [−44%, −30%] | fewer in every repetition, outside the noise |
| Wall time | −29% [−53%, +8%] † | −39% [−47%, −29%] | fewer in every repetition, within the noise |

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
| flask | 14 | 10 | −4 | 1 / 0 / 1 |
| all | 14 | 10 | −4 | 1 / 0 / 1 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | 124 | 66 | −58 | 2 / 0 / 0 |
| all | 124 | 66 | −58 | 2 / 0 / 0 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | 3,406 | 2,367 | −1,039 | 2 / 0 / 0 |
| all | 3,406 | 2,367 | −1,039 | 2 / 0 / 0 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | 329,352 | 181,236 | −148,117 | 2 / 0 / 0 |
| all | 329,352 | 181,236 | −148,117 | 2 / 0 / 0 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | 23,927 | 17,524 | −6,403 | 2 / 0 / 0 |
| all | 23,927 | 17,524 | −6,403 | 2 / 0 / 0 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | 356,809 | 201,192 | −155,617 | 2 / 0 / 0 |
| all | 356,809 | 201,192 | −155,617 | 2 / 0 / 0 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | $0.0979 | $0.0651 | −$0.0329 | 2 / 0 / 0 |
| all | $0.0979 | $0.0651 | −$0.0329 | 2 / 0 / 0 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | 38.1 s | 25.9 s | −12.2 s | 2 / 0 / 0 |
| all | 38.1 s | 25.9 s | −12.2 s | 2 / 0 / 0 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| flask | $0.3918 (4 runs) | $0.2603 (4 runs) | none | none |
| all | $0.3918 (4 runs) | $0.2603 (4 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| flask/x032 | without | 2/2 | 12 [6–18] | 106 [58–154] | 3,392 [2,863–3,920] | 254,207 [159,037–349,376] | 24,673 [16,548–32,797] | $0.0918 [$0.0878–$0.0959] | 37.7 s [31.1 s–44.3 s] |
| flask/x032 | with | 2/2 | 14 [14–14] | 86 [82–90] | 3,184 [2,891–3,476] | 243,124 [211,161–275,086] | 18,286 [12,743–23,829] | $0.0769 [$0.0611–$0.0926] | 32.6 s [31.4 s–33.8 s] |
| flask/x033 | without | 2/2 | 17 [16–17] | 142 [138–146] | 3,421 [3,287–3,554] | 404,498 [374,573–434,423] | 23,181 [21,999–24,363] | $0.1041 [$0.0980–$0.1101] | 38.5 s [35.4 s–41.5 s] |
| flask/x033 | with | 2/2 | 7 [4–9] | 46 [34–58] | 1,550 [1,280–1,820] | 119,348 [78,569–160,126] | 16,762 [15,265–18,258] | $0.0533 [$0.0448–$0.0617] | 19.2 s [16.6 s–21.8 s] |

