# Agent-level A/B — measured tool calls, tokens and cost

**claude-code 2.1.321 (Claude Code) · claude-haiku-4-5 · 2026-11-10 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap index strategy + 7-tool core MCP profile (the docs' setup for an agent that calls the tools).
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
| Tool calls | −70% | −48% | fewer in every repetition |
| Input tokens (uncached) | −63% | −44% | fewer in every repetition |
| Output tokens | −60% | −54% | fewer in every repetition |
| Cache-read tokens | −72% | −47% | fewer in every repetition |
| Cache-write tokens | −48% | −28% | fewer in every repetition |
| Total tokens (derived) | −70% | −46% | fewer in every repetition |
| Cost | −59% | −40% | fewer in every repetition |
| Wall time | −46% | −47% | fewer in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −72% [−75%, −68%] | −49% [−76%, +13%] † | fewer in every repetition, within the noise |
| Input tokens (uncached) | −63% [−65%, −61%] | −44% [−71%, +11%] † | fewer in every repetition, within the noise |
| Output tokens | −60% [−63%, −58%] | −60% [−79%, −21%] | fewer in every repetition, outside the noise |
| Cache-read tokens | −71% [−72%, −70%] | −46% [−78%, +32%] † | fewer in every repetition, within the noise |
| Cache-write tokens | −51% [−60%, −39%] | −26% [−49%, +6%] † | fewer in every repetition, within the noise |
| Total tokens (derived) | −70% [−71%, −69%] | −44% [−76%, +29%] † | fewer in every repetition, within the noise |
| Cost | −60% [−63%, −57%] | −39% [−65%, +6%] † | fewer in every repetition, within the noise |
| Wall time | −47% [−50%, −44%] | −50% [−72%, −10%] | fewer in every repetition, outside the noise |

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
| fastapi | 14 | 6 | −8 | 2 / 0 / 0 |
| all | 14 | 6 | −8 | 2 / 0 / 0 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | 118 | 54 | −64 | 2 / 0 / 0 |
| all | 118 | 54 | −64 | 2 / 0 / 0 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | 3,099 | 1,345 | −1,754 | 2 / 0 / 0 |
| all | 3,099 | 1,345 | −1,754 | 2 / 0 / 0 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | 283,236 | 110,082 | −173,154 | 2 / 0 / 0 |
| all | 283,236 | 110,082 | −173,154 | 2 / 0 / 0 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | 18,691 | 11,454 | −7,238 | 2 / 0 / 0 |
| all | 18,691 | 11,454 | −7,238 | 2 / 0 / 0 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | 305,144 | 122,935 | −182,209 | 2 / 0 / 0 |
| all | 305,144 | 122,935 | −182,209 | 2 / 0 / 0 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | $0.0813 | $0.0407 | −$0.0406 | 2 / 0 / 0 |
| all | $0.0813 | $0.0407 | −$0.0406 | 2 / 0 / 0 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | 35.6 s | 19.0 s | −16.6 s | 2 / 0 / 0 |
| all | 35.6 s | 19.0 s | −16.6 s | 2 / 0 / 0 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| fastapi | $0.3253 (4 runs) | $0.1628 (4 runs) | none | none |
| all | $0.3253 (4 runs) | $0.1628 (4 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| fastapi/x145 | without | 2/2 | 20 [17–22] | 166 [146–186] | 3,722 [3,392–4,052] | 432,696 [356,003–509,389] | 22,525 [21,812–23,238] | $0.1071 [$0.0963–$0.1179] | 43.7 s [42.6 s–44.9 s] |
| fastapi/x145 | with | 2/2 | 6 [4–7] | 54 [42–66] | 1,204 [700–1,707] | 110,581 [79,547–141,614] | 12,672 [11,202–14,142] | $0.0425 [$0.0339–$0.0510] | 18.4 s [11.9 s–25.0 s] |
| fastapi/x146 | without | 2/2 | 8 [8–8] | 70 [66–74] | 2,476 [2,234–2,718] | 133,775 [131,645–135,905] | 14,858 [12,903–16,812] | $0.0555 [$0.0531–$0.0580] | 27.5 s [25.0 s–29.9 s] |
| fastapi/x146 | with | 2/2 | 6 [2–9] | 54 [26–82] | 1,487 [835–2,139] | 109,584 [39,792–179,375] | 10,235 [6,760–13,710] | $0.0389 [$0.0217–$0.0561] | 19.6 s [12.4 s–26.8 s] |

