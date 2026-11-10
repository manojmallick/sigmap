# Agent-level A/B — measured tool calls, tokens and cost

**claude-code 2.1.321 (Claude Code) · claude-haiku-4-5 · 2026-11-10 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap index strategy + 7-tool core MCP profile (the docs' setup for an agent that calls the tools).
- Both arms: the same prompt, model, tool allowlist (Read, Grep, Glob, Bash), per-run budget cap $1 and timeout 420 s; run in a clean copy of the commit pinned in `benchmarks/xrepo-repos.json`.
- Questions: the task id(s) x027, x028 of `benchmarks/tasks/retrieval-xrepo.jsonl`. Pass = hit@5 on the repository-relative paths the answer names.
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
| django | 2 | 4/4 | 3/4 | 0 / 0 |
| all | 2 | 4/4 | 3/4 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 2. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −24% | −12% | fewer in every repetition |
| Input tokens (uncached) | −35% | −11% | fewer in every repetition |
| Output tokens | −28% | −21% | fewer in every repetition |
| Cache-read tokens | −36% | −21% | fewer in every repetition |
| Cache-write tokens | −26% | −37% | fewer in every repetition |
| Total tokens (derived) | −36% | −22% | fewer in every repetition |
| Cost | −30% | −29% | fewer in every repetition |
| Wall time | −21% | −17% | fewer in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −24% [−25%, −24%] | −16% [−30%, 0%] † | fewer in every repetition, within the noise |
| Input tokens (uncached) | −34% [−44%, −23%] | −14% [−27%, 0%] † | fewer in every repetition, within the noise |
| Output tokens | −30% [−36%, −22%] | −24% [−37%, −8%] | fewer in every repetition, outside the noise |
| Cache-read tokens | −34% [−49%, −14%] | −24% [−33%, −15%] | fewer in every repetition, outside the noise |
| Cache-write tokens | −26% [−27%, −24%] | −39% [−48%, −29%] | fewer in every repetition, outside the noise |
| Total tokens (derived) | −34% [−48%, −15%] | −26% [−34%, −16%] | fewer in every repetition, outside the noise |
| Cost | −30% [−34%, −25%] | −32% [−42%, −20%] | fewer in every repetition, outside the noise |
| Wall time | −21% [−24%, −19%] | −19% [−27%, −9%] | fewer in every repetition, outside the noise |

### Outcome (hit@5), by repetition

Per paired task: **better** = the SigMap arm named the file and the other did not; **worse** = the reverse; **tie** = both found it or both missed. Localisation only.

| repetition | paired tasks | better | worse | tie |
| --- | ---: | ---: | ---: | ---: |
| R1 | 2 | 0 | 0 | 2 |
| R2 | 2 | 0 | 1 | 1 |
| all | 4 | 0 | 1 | 3 |

## Tool calls

Provenance: agent-reported (main-thread tool_use blocks). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | 14 | 11 | −3 | 2 / 0 / 0 |
| all | 14 | 11 | −3 | 2 / 0 / 0 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | 120 | 92 | −28 | 2 / 0 / 0 |
| all | 120 | 92 | −28 | 2 / 0 / 0 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | 2,990 | 2,252 | −738 | 2 / 0 / 0 |
| all | 2,990 | 2,252 | −738 | 2 / 0 / 0 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | 279,810 | 201,155 | −78,655 | 2 / 0 / 0 |
| all | 279,810 | 201,155 | −78,655 | 2 / 0 / 0 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | 17,735 | 11,938 | −5,797 | 2 / 0 / 0 |
| all | 17,735 | 11,938 | −5,797 | 2 / 0 / 0 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | 300,655 | 215,437 | −85,218 | 2 / 0 / 0 |
| all | 300,655 | 215,437 | −85,218 | 2 / 0 / 0 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | $0.0785 | $0.0553 | −$0.0232 | 2 / 0 / 0 |
| all | $0.0785 | $0.0553 | −$0.0232 | 2 / 0 / 0 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | 34.2 s | 27.7 s | −6.5 s | 2 / 0 / 0 |
| all | 34.2 s | 27.7 s | −6.5 s | 2 / 0 / 0 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| django | $0.3141 (4 runs) | $0.2214 (4 runs) | none | none |
| all | $0.3141 (4 runs) | $0.2214 (4 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| django/x027 | without | 2/2 | 17 [16–17] | 142 [138–146] | 3,340 [3,266–3,414] | 365,302 [331,220–399,384] | 19,393 [15,122–23,663] | $0.0922 [$0.0806–$0.1037] | 38.3 s [37.8 s–38.9 s] |
| django/x027 | with | 1/2 | 15 [13–16] | 110 [82–138] | 2,831 [2,667–2,995] | 253,623 [168,037–339,209] | 14,147 [11,436–16,857] | $0.0679 [$0.0531–$0.0827] | 33.1 s [31.6 s–34.5 s] |
| django/x028 | without | 2/2 | 11 [10–12] | 98 [90–106] | 2,640 [2,551–2,728] | 194,318 [193,211–195,424] | 16,078 [12,823–19,333] | $0.0649 [$0.0587–$0.0711] | 30.1 s [28.3 s–31.9 s] |
| django/x028 | with | 2/2 | 8 [7–9] | 74 [66–82] | 1,672 [1,611–1,733] | 148,687 [131,267–166,106] | 9,730 [9,368–10,092] | $0.0428 [$0.0414–$0.0441] | 22.4 s [20.6 s–24.2 s] |

