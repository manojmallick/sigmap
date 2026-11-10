# Agent-level A/B — measured tool calls, tokens and cost

**claude-code 2.1.321 (Claude Code) · claude-haiku-4-5 · 2026-11-10 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap lean: 7-tool core MCP profile + a three-line section.
- Both arms: the same prompt, model, tool allowlist (Read, Grep, Glob, Bash), per-run budget cap $1 and timeout 420 s; run in a clean copy of the commit pinned in `benchmarks/xrepo-repos.json`.
- Questions: the task id(s) x145, x146 of `benchmarks/tasks/retrieval-xrepo.jsonl`. Pass = hit@5 on the repository-relative paths the answer names.
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
| fastapi | 2 | 4/4 | 4/4 | 0 / 0 |
| all | 2 | 4/4 | 4/4 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 2. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | +4% | −4% | mixed |
| Input tokens (uncached) | +39% | −4% | mixed |
| Output tokens | −1% | −18% | fewer in every repetition |
| Cache-read tokens | +55% | −9% | mixed |
| Cache-write tokens | −32% | −28% | fewer in every repetition |
| Total tokens (derived) | +46% | −11% | mixed |
| Cost | −3% | −20% | fewer in every repetition |
| Wall time | +5% | −13% | mixed |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −18% [−58%, +62%] † | +1% [−18%, +25%] † | mixed |
| Input tokens (uncached) | +16% [−44%, +141%] † | +1% [−16%, +22%] † | more in every repetition, within the noise |
| Output tokens | −12% [−47%, +47%] † | −16% [−26%, −3%] | fewer in every repetition, within the noise |
| Cache-read tokens | +18% [−47%, +164%] † | −1% [−22%, +26%] † | mixed |
| Cache-write tokens | −34% [−46%, −20%] | −28% [−29%, −27%] | fewer in every repetition, outside the noise |
| Total tokens (derived) | +13% [−47%, +143%] † | −3% [−22%, +20%] † | mixed |
| Cost | −14% [−47%, +38%] † | −18% [−25%, −10%] | fewer in every repetition, within the noise |
| Wall time | −2% [−36%, +50%] † | −11% [−21%, +1%] † | fewer in every repetition, within the noise |

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
| fastapi | 13 | 13 | 0 | 1 / 0 / 1 |
| all | 13 | 13 | 0 | 1 / 0 / 1 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | 96 | 110 | +14 | 1 / 0 / 1 |
| all | 96 | 110 | +14 | 1 / 0 / 1 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | 2,786 | 2,505 | −281 | 1 / 0 / 1 |
| all | 2,786 | 2,505 | −281 | 1 / 0 / 1 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | 215,940 | 249,238 | +33,299 | 1 / 0 / 1 |
| all | 215,940 | 249,238 | +33,299 | 1 / 0 / 1 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | 18,498 | 12,982 | −5,516 | 2 / 0 / 0 |
| all | 18,498 | 12,982 | −5,516 | 2 / 0 / 0 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | 237,320 | 264,835 | +27,516 | 1 / 0 / 1 |
| all | 237,320 | 264,835 | +27,516 | 1 / 0 / 1 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | $0.0726 | $0.0635 | −$0.0091 | 2 / 0 / 0 |
| all | $0.0726 | $0.0635 | −$0.0091 | 2 / 0 / 0 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | 32.5 s | 30.9 s | −1.6 s | 1 / 0 / 1 |
| all | 32.5 s | 30.9 s | −1.6 s | 1 / 0 / 1 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| fastapi | $0.2905 (4 runs) | $0.2541 (4 runs) | none | none |
| all | $0.2905 (4 runs) | $0.2541 (4 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| fastapi/x145 | without | 2/2 | 15 [13–17] | 110 [74–146] | 3,135 [2,501–3,768] | 274,921 [160,450–389,392] | 20,966 [18,598–23,333] | $0.0852 [$0.0658–$0.1046] | 36.0 s [27.7 s–44.3 s] |
| fastapi/x145 | with | 2/2 | 18 [14–21] | 150 [122–178] | 3,225 [2,777–3,673] | 363,557 [304,078–423,035] | 15,969 [14,942–16,996] | $0.0846 [$0.0784–$0.0907] | 38.2 s [34.8 s–41.7 s] |
| fastapi/x146 | without | 2/2 | 10 [8–12] | 82 [74–90] | 2,438 [2,261–2,614] | 156,959 [143,411–170,506] | 16,030 [15,856–16,204] | $0.0600 [$0.0574–$0.0626] | 29.1 s [27.2 s–31.0 s] |
| fastapi/x146 | with | 2/2 | 8 [5–10] | 70 [50–90] | 1,786 [1,381–2,190] | 134,920 [89,846–179,994] | 9,994 [8,724–11,264] | $0.0425 [$0.0334–$0.0516] | 23.6 s [19.8 s–27.5 s] |

