# Agent-level A/B — measured tool calls, tokens and cost

**claude-code 2.1.321 (Claude Code) · claude-haiku-4-5 · 2026-11-10 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap generated context + MCP server.
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
| Tool calls | −49% | −23% | fewer in every repetition |
| Input tokens (uncached) | −52% | −48% | fewer in every repetition |
| Output tokens | −46% | −30% | fewer in every repetition |
| Cache-read tokens | −69% | −47% | fewer in every repetition |
| Cache-write tokens | −64% | −44% | fewer in every repetition |
| Total tokens (derived) | −69% | −46% | fewer in every repetition |
| Cost | −64% | −43% | fewer in every repetition |
| Wall time | −42% | −33% | fewer in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −49% [−50%, −48%] | −20% [−36%, 0%] † | fewer in every repetition, within the noise |
| Input tokens (uncached) | −52% [−53%, −51%] | −47% [−65%, −21%] | fewer in every repetition, outside the noise |
| Output tokens | −46% [−47%, −44%] | −29% [−45%, −9%] | fewer in every repetition, outside the noise |
| Cache-read tokens | −69% [−70%, −68%] | −48% [−65%, −21%] | fewer in every repetition, outside the noise |
| Cache-write tokens | −64% [−70%, −57%] | −47% [−60%, −31%] | fewer in every repetition, outside the noise |
| Total tokens (derived) | −69% [−70%, −68%] | −48% [−65%, −21%] | fewer in every repetition, outside the noise |
| Cost | −64% [−67%, −61%] | −45% [−59%, −25%] | fewer in every repetition, outside the noise |
| Wall time | −42% [−44%, −41%] | −32% [−47%, −14%] | fewer in every repetition, outside the noise |

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
| fastify | 23 | 14 | −9 | 2 / 0 / 0 |
| all | 23 | 14 | −9 | 2 / 0 / 0 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | 194 | 96 | −98 | 2 / 0 / 0 |
| all | 194 | 96 | −98 | 2 / 0 / 0 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | 4,671 | 2,825 | −1,846 | 2 / 0 / 0 |
| all | 4,671 | 2,825 | −1,846 | 2 / 0 / 0 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | 734,930 | 269,664 | −465,266 | 2 / 0 / 0 |
| all | 734,930 | 269,664 | −465,266 | 2 / 0 / 0 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | 38,601 | 16,429 | −22,173 | 2 / 0 / 0 |
| all | 38,601 | 16,429 | −22,173 | 2 / 0 / 0 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | 778,397 | 289,014 | −489,383 | 2 / 0 / 0 |
| all | 778,397 | 289,014 | −489,383 | 2 / 0 / 0 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | $0.1742 | $0.0740 | −$0.1002 | 2 / 0 / 0 |
| all | $0.1742 | $0.0740 | −$0.1002 | 2 / 0 / 0 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | 53.8 s | 33.1 s | −20.6 s | 2 / 0 / 0 |
| all | 53.8 s | 33.1 s | −20.6 s | 2 / 0 / 0 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| fastify | $0.6970 (4 runs) | $0.2962 (4 runs) | none | none |
| all | $0.6970 (4 runs) | $0.2962 (4 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| fastify/x137 | without | 2/2 | 22 [13–31] | 186 [114–258] | 4,516 [3,003–6,029] | 697,431 [331,179–1,063,682] | 36,785 [28,978–44,591] | $0.1661 [$0.1062–$0.2260] | 51.0 s [36.2 s–65.7 s] |
| fastify/x137 | with | 2/2 | 15 [13–16] | 106 [90–122] | 2,971 [2,730–3,211] | 299,281 [263,194–335,367] | 19,524 [19,066–19,981] | $0.0839 [$0.0800–$0.0878] | 35.1 s [31.2 s–39.0 s] |
| fastify/x138 | without | 2/2 | 24 [22–26] | 202 [186–218] | 4,826 [4,155–5,497] | 772,430 [464,749–1,080,111] | 40,418 [23,179–57,657] | $0.1824 [$0.1138–$0.2510] | 56.6 s [48.2 s–64.9 s] |
| fastify/x138 | with | 2/2 | 14 [13–14] | 86 [66–106] | 2,680 [2,300–3,059] | 240,048 [160,574–319,521] | 13,334 [9,271–17,397] | $0.0642 [$0.0462–$0.0821] | 31.2 s [25.8 s–36.6 s] |

