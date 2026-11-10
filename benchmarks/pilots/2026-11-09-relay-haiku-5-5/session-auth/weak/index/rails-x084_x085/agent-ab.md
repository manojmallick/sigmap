# Agent-level A/B — measured tool calls, tokens and cost

**claude-code 2.1.321 (Claude Code) · claude-haiku-4-5 · 2026-11-10 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap index strategy + 7-tool core MCP profile (the docs' setup for an agent that calls the tools).
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
| Tool calls | −11% | −35% | fewer in every repetition |
| Input tokens (uncached) | +12% | −31% | mixed |
| Output tokens | +80% | −4% | mixed |
| Cache-read tokens | +45% | −32% | mixed |
| Cache-write tokens | +5% | −26% | mixed |
| Total tokens (derived) | +42% | −31% | mixed |
| Cost | +31% | −23% | mixed |
| Wall time | +74% | −6% | mixed |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −24% [−56%, +30%] † | −39% [−67%, +13%] † | fewer in every repetition, within the noise |
| Input tokens (uncached) | −5% [−41%, +54%] † | −28% [−60%, +32%] † | fewer in every repetition, within the noise |
| Output tokens | +23% [−49%, +196%] † | +6% [−20%, +40%] † | more in every repetition, within the noise |
| Cache-read tokens | +8% [−42%, +100%] † | −25% [−64%, +54%] † | mixed |
| Cache-write tokens | +4% [+2%, +7%] | −26% [−29%, −23%] | mixed |
| Total tokens (derived) | +9% [−39%, +92%] † | −25% [−61%, +45%] † | mixed |
| Cost | +13% [−23%, +63%] † | −19% [−37%, +5%] † | mixed |
| Wall time | +33% [−36%, +176%] † | 0% [−18%, +21%] † | mixed |

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
| rails | 10 | 8 | −2 | 2 / 0 / 0 |
| all | 10 | 8 | −2 | 2 / 0 / 0 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | 72 | 64 | −8 | 2 / 0 / 0 |
| all | 72 | 64 | −8 | 2 / 0 / 0 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | 2,356 | 3,099 | +743 | 1 / 0 / 1 |
| all | 2,356 | 3,099 | +743 | 1 / 0 / 1 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | 149,059 | 151,241 | +2,182 | 0 / 0 / 2 |
| all | 149,059 | 151,241 | +2,182 | 0 / 0 / 2 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | 13,994 | 12,433 | −1,562 | 2 / 0 / 0 |
| all | 13,994 | 12,433 | −1,562 | 2 / 0 / 0 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | 165,481 | 166,836 | +1,355 | 0 / 0 / 2 |
| all | 165,481 | 166,836 | +1,355 | 0 / 0 / 2 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | $0.0547 | $0.0555 | +$0.0008 | 1 / 0 / 1 |
| all | $0.0547 | $0.0555 | +$0.0008 | 1 / 0 / 1 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | 26.0 s | 33.2 s | +7.2 s | 1 / 0 / 1 |
| all | 26.0 s | 33.2 s | +7.2 s | 1 / 0 / 1 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| rails | $0.2190 (4 runs) | $0.2222 (4 runs) | none | none |
| all | $0.2190 (4 runs) | $0.2222 (4 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| rails/x084 | without | 2/2 | 9 [8–9] | 54 [50–58] | 1,651 [1,426–1,875] | 95,186 [89,085–101,286] | 10,822 [9,212–12,431] | $0.0395 [$0.0380–$0.0410] | 19.5 s [18.0 s–21.1 s] |
| rails/x084 | with | 2/2 | 7 [4–9] | 50 [34–66] | 1,480 [960–2,000] | 98,173 [58,775–137,571] | 9,477 [9,358–9,596] | $0.0362 [$0.0294–$0.0430] | 17.6 s [13.5 s–21.8 s] |
| rails/x085 | without | 2/2 | 11 [10–12] | 90 [74–106] | 3,061 [2,097–4,025] | 202,933 [160,058–245,807] | 17,167 [16,869–17,464] | $0.0700 [$0.0615–$0.0785] | 32.6 s [22.8 s–42.3 s] |
| rails/x085 | with | 2/2 | 9 [4–13] | 78 [42–114] | 4,718 [3,239–6,197] | 204,308 [89,052–319,564] | 15,388 [12,050–18,726] | $0.0749 [$0.0492–$0.1005] | 48.8 s [34.8 s–62.9 s] |

