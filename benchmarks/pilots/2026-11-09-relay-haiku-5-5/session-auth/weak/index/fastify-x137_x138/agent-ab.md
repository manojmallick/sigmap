# Agent-level A/B — measured tool calls, tokens and cost

**claude-code 2.1.321 (Claude Code) · claude-haiku-4-5 · 2026-11-10 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap index strategy + 7-tool core MCP profile (the docs' setup for an agent that calls the tools).
- Both arms: the same prompt, model, tool allowlist (Read, Grep, Glob, Bash), per-run budget cap $1 and timeout 420 s; run in a clean copy of the commit pinned in `benchmarks/xrepo-repos.json`.
- Questions: the task id(s) x137, x138 of `benchmarks/tasks/retrieval-xrepo.jsonl`. Pass = hit@5 on the repository-relative paths the answer names.
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
| fastify | 2 | 4/4 | 4/4 | 0 / 0 |
| all | 2 | 4/4 | 4/4 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 2. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −25% | −50% | fewer in every repetition |
| Input tokens (uncached) | −24% | −47% | fewer in every repetition |
| Output tokens | −18% | −51% | fewer in every repetition |
| Cache-read tokens | −27% | −58% | fewer in every repetition |
| Cache-write tokens | −28% | −44% | fewer in every repetition |
| Total tokens (derived) | −27% | −57% | fewer in every repetition |
| Cost | −26% | −51% | fewer in every repetition |
| Wall time | −21% | −41% | fewer in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −29% [−52%, +5%] † | −51% [−59%, −41%] | fewer in every repetition, within the noise |
| Input tokens (uncached) | −27% [−49%, +5%] † | −48% [−56%, −39%] | fewer in every repetition, within the noise |
| Output tokens | −23% [−50%, +19%] † | −51% [−57%, −44%] | fewer in every repetition, within the noise |
| Cache-read tokens | −35% [−59%, +5%] † | −59% [−68%, −48%] | fewer in every repetition, within the noise |
| Cache-write tokens | −29% [−36%, −23%] | −45% [−59%, −26%] | fewer in every repetition, outside the noise |
| Total tokens (derived) | −34% [−58%, +4%] † | −59% [−67%, −47%] | fewer in every repetition, within the noise |
| Cost | −30% [−48%, −6%] | −52% [−62%, −39%] | fewer in every repetition, outside the noise |
| Wall time | −27% [−51%, +10%] † | −41% [−47%, −34%] | fewer in every repetition, within the noise |

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
| fastify | 21 | 13 | −8 | 2 / 0 / 0 |
| all | 21 | 13 | −8 | 2 / 0 / 0 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | 178 | 114 | −64 | 2 / 0 / 0 |
| all | 178 | 114 | −64 | 2 / 0 / 0 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | 4,453 | 2,871 | −1,583 | 2 / 0 / 0 |
| all | 4,453 | 2,871 | −1,583 | 2 / 0 / 0 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | 530,502 | 295,265 | −235,238 | 2 / 0 / 0 |
| all | 530,502 | 295,265 | −235,238 | 2 / 0 / 0 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | 28,807 | 18,377 | −10,430 | 2 / 0 / 0 |
| all | 28,807 | 18,377 | −10,430 | 2 / 0 / 0 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | 563,940 | 316,626 | −247,314 | 2 / 0 / 0 |
| all | 563,940 | 316,626 | −247,314 | 2 / 0 / 0 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | $0.1331 | $0.0807 | −$0.0524 | 2 / 0 / 0 |
| all | $0.1331 | $0.0807 | −$0.0524 | 2 / 0 / 0 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | 52.1 s | 35.8 s | −16.4 s | 2 / 0 / 0 |
| all | 52.1 s | 35.8 s | −16.4 s | 2 / 0 / 0 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| fastify | $0.5324 (4 runs) | $0.3230 (4 runs) | none | none |
| all | $0.5324 (4 runs) | $0.3230 (4 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| fastify/x137 | without | 2/2 | 22 [21–22] | 182 [178–186] | 4,619 [4,336–4,902] | 522,267 [477,009–567,525] | 27,779 [23,558–31,999] | $0.1311 [$0.1167–$0.1454] | 51.8 s [50.9 s–52.7 s] |
| fastify/x137 | with | 2/2 | 10 [9–10] | 86 [82–90] | 2,150 [2,123–2,176] | 188,007 [181,663–194,350] | 14,180 [13,212–15,148] | $0.0580 [$0.0553–$0.0607] | 26.3 s [24.9 s–27.7 s] |
| fastify/x138 | without | 2/2 | 21 [19–22] | 174 [162–186] | 4,287 [3,824–4,750] | 538,738 [465,819–611,656] | 29,835 [28,142–31,527] | $0.1352 [$0.1289–$0.1414] | 52.5 s [48.7 s–56.3 s] |
| fastify/x138 | with | 2/2 | 17 [13–20] | 142 [114–170] | 3,592 [2,647–4,536] | 402,523 [315,066–489,979] | 22,573 [20,732–24,414] | $0.1035 [$0.0863–$0.1207] | 45.2 s [37.1 s–53.4 s] |

