# Agent-level A/B — measured tool calls, tokens and cost

**claude-code 2.1.321 (Claude Code) · claude-haiku-4-5 · 2026-11-10 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap lean: 7-tool core MCP profile + a three-line section.
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
| Tool calls | −63% | −40% | fewer in every repetition |
| Input tokens (uncached) | −60% | −40% | fewer in every repetition |
| Output tokens | −56% | −38% | fewer in every repetition |
| Cache-read tokens | −75% | −58% | fewer in every repetition |
| Cache-write tokens | −68% | −44% | fewer in every repetition |
| Total tokens (derived) | −75% | −57% | fewer in every repetition |
| Cost | −69% | −48% | fewer in every repetition |
| Wall time | −47% | −33% | fewer in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −63% [−68%, −56%] | −45% [−70%, 0%] † | fewer in every repetition, within the noise |
| Input tokens (uncached) | −59% [−65%, −52%] | −46% [−71%, 0%] † | fewer in every repetition, within the noise |
| Output tokens | −54% [−67%, −37%] | −43% [−68%, +3%] † | fewer in every repetition, within the noise |
| Cache-read tokens | −73% [−81%, −63%] | −62% [−79%, −31%] | fewer in every repetition, outside the noise |
| Cache-write tokens | −65% [−74%, −52%] | −45% [−60%, −24%] | fewer in every repetition, outside the noise |
| Total tokens (derived) | −73% [−80%, −62%] | −60% [−76%, −33%] | fewer in every repetition, outside the noise |
| Cost | −66% [−76%, −53%] | −49% [−55%, −41%] | fewer in every repetition, outside the noise |
| Wall time | −45% [−58%, −27%] | −37% [−61%, +1%] † | fewer in every repetition, within the noise |

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
| fastify | 19 | 9 | −10 | 2 / 0 / 0 |
| all | 19 | 9 | −10 | 2 / 0 / 0 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | 162 | 80 | −82 | 2 / 0 / 0 |
| all | 162 | 80 | −82 | 2 / 0 / 0 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | 4,112 | 2,164 | −1,947 | 2 / 0 / 0 |
| all | 4,112 | 2,164 | −1,947 | 2 / 0 / 0 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | 496,586 | 162,019 | −334,567 | 2 / 0 / 0 |
| all | 496,586 | 162,019 | −334,567 | 2 / 0 / 0 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | 28,571 | 12,472 | −16,099 | 2 / 0 / 0 |
| all | 28,571 | 12,472 | −16,099 | 2 / 0 / 0 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | 529,431 | 176,736 | −352,695 | 2 / 0 / 0 |
| all | 529,431 | 176,736 | −352,695 | 2 / 0 / 0 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | $0.1275 | $0.0520 | −$0.0755 | 2 / 0 / 0 |
| all | $0.1275 | $0.0520 | −$0.0755 | 2 / 0 / 0 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | 46.0 s | 27.4 s | −18.6 s | 2 / 0 / 0 |
| all | 46.0 s | 27.4 s | −18.6 s | 2 / 0 / 0 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| fastify | $0.5101 (4 runs) | $0.2082 (4 runs) | none | none |
| all | $0.5101 (4 runs) | $0.2082 (4 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| fastify/x137 | without | 2/2 | 16 [15–16] | 134 [130–138] | 3,276 [3,235–3,317] | 359,820 [314,679–404,961] | 24,362 [18,424–30,299] | $0.1012 [$0.0846–$0.1178] | 37.6 s [36.0 s–39.2 s] |
| fastify/x137 | with | 2/2 | 11 [7–15] | 98 [66–130] | 2,728 [2,047–3,409] | 197,876 [117,933–277,818] | 10,503 [8,782–12,223] | $0.0545 [$0.0397–$0.0694] | 32.9 s [26.1 s–39.6 s] |
| fastify/x138 | without | 2/2 | 23 [20–25] | 190 [170–210] | 4,947 [4,569–5,325] | 633,352 [505,093–761,611] | 32,781 [23,752–41,809] | $0.1538 [$0.1210–$0.1866] | 54.4 s [46.9 s–61.8 s] |
| fastify/x138 | with | 2/2 | 7 [6–8] | 62 [50–74] | 1,601 [1,442–1,759] | 126,163 [106,023–146,302] | 14,442 [10,785–18,099] | $0.0496 [$0.0451–$0.0541] | 22.0 s [18.2 s–25.7 s] |

