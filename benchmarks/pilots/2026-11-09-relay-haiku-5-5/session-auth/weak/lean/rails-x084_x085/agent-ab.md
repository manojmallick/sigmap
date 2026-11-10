# Agent-level A/B — measured tool calls, tokens and cost

**claude-code 2.1.321 (Claude Code) · claude-haiku-4-5 · 2026-11-10 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap lean: 7-tool core MCP profile + a three-line section.
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
| Tool calls | −43% | −48% | fewer in every repetition |
| Input tokens (uncached) | −47% | −42% | fewer in every repetition |
| Output tokens | −55% | −44% | fewer in every repetition |
| Cache-read tokens | −56% | −45% | fewer in every repetition |
| Cache-write tokens | −28% | −25% | fewer in every repetition |
| Total tokens (derived) | −54% | −44% | fewer in every repetition |
| Cost | −43% | −35% | fewer in every repetition |
| Wall time | −40% | −35% | fewer in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −32% [−67%, +40%] † | −49% [−56%, −42%] | fewer in every repetition, within the noise |
| Input tokens (uncached) | −40% [−73%, +32%] † | −41% [−45%, −36%] | fewer in every repetition, within the noise |
| Output tokens | −44% [−71%, +8%] † | −43% [−49%, −37%] | fewer in every repetition, within the noise |
| Cache-read tokens | −45% [−81%, +58%] † | −45% [−47%, −42%] | fewer in every repetition, within the noise |
| Cache-write tokens | −22% [−41%, +3%] † | −26% [−35%, −17%] | fewer in every repetition, within the noise |
| Total tokens (derived) | −43% [−78%, +51%] † | −43% [−45%, −42%] | fewer in every repetition, within the noise |
| Cost | −33% [−62%, +17%] † | −36% [−37%, −34%] | fewer in every repetition, within the noise |
| Wall time | −31% [−64%, +31%] † | −33% [−41%, −25%] | fewer in every repetition, within the noise |

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
| rails | 11 | 6 | −5 | 2 / 0 / 0 |
| all | 11 | 6 | −5 | 2 / 0 / 0 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | 94 | 52 | −42 | 2 / 0 / 0 |
| all | 94 | 52 | −42 | 2 / 0 / 0 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | 3,021 | 1,501 | −1,520 | 2 / 0 / 0 |
| all | 3,021 | 1,501 | −1,520 | 2 / 0 / 0 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | 211,535 | 102,916 | −108,619 | 2 / 0 / 0 |
| all | 211,535 | 102,916 | −108,619 | 2 / 0 / 0 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | 15,617 | 11,449 | −4,167 | 2 / 0 / 0 |
| all | 15,617 | 11,449 | −4,167 | 2 / 0 / 0 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | 230,266 | 115,918 | −114,348 | 2 / 0 / 0 |
| all | 230,266 | 115,918 | −114,348 | 2 / 0 / 0 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | $0.0676 | $0.0407 | −$0.0268 | 2 / 0 / 0 |
| all | $0.0676 | $0.0407 | −$0.0268 | 2 / 0 / 0 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | 34.3 s | 21.3 s | −13.0 s | 2 / 0 / 0 |
| all | 34.3 s | 21.3 s | −13.0 s | 2 / 0 / 0 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| rails | $0.2703 (4 runs) | $0.1630 (4 runs) | none | none |
| all | $0.2703 (4 runs) | $0.1630 (4 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| rails/x084 | without | 2/2 | 7 [5–9] | 58 [50–66] | 1,665 [1,378–1,951] | 109,259 [83,753–134,764] | 11,640 [9,653–13,626] | $0.0426 [$0.0346–$0.0505] | 20.8 s [18.3 s–23.4 s] |
| rails/x084 | with | 2/2 | 6 [4–7] | 54 [42–66] | 1,363 [1,237–1,488] | 104,950 [77,819–132,080] | 9,406 [8,881–9,931] | $0.0362 [$0.0318–$0.0406] | 20.8 s [17.5 s–24.0 s] |
| rails/x085 | without | 2/2 | 15 [12–18] | 130 [106–154] | 4,378 [3,378–5,377] | 313,811 [237,042–390,579] | 19,594 [16,112–23,075] | $0.0926 [$0.0729–$0.1122] | 47.8 s [39.6 s–55.9 s] |
| rails/x085 | with | 2/2 | 7 [6–7] | 50 [42–58] | 1,639 [1,553–1,725] | 100,883 [75,820–125,945] | 13,493 [13,449–13,536] | $0.0453 [$0.0425–$0.0482] | 21.9 s [20.4 s–23.5 s] |

