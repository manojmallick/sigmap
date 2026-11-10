# Agent-level A/B — measured tool calls, tokens and cost

**claude-code 2.1.321 (Claude Code) · claude-haiku-4-5 · 2026-11-10 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap generated context + MCP server.
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
| Tool calls | −71% | −18% | fewer in every repetition |
| Input tokens (uncached) | −78% | −21% | fewer in every repetition |
| Output tokens | −60% | +14% | mixed |
| Cache-read tokens | −82% | −1% | fewer in every repetition |
| Cache-write tokens | −39% | −21% | fewer in every repetition |
| Total tokens (derived) | −79% | −3% | fewer in every repetition |
| Cost | −61% | −9% | fewer in every repetition |
| Wall time | −54% | +13% | mixed |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −75% [−85%, −57%] | −18% [−22%, −13%] | fewer in every repetition, outside the noise |
| Input tokens (uncached) | −79% [−85%, −72%] | −21% [−22%, −20%] | fewer in every repetition, outside the noise |
| Output tokens | −63% [−75%, −45%] | +13% [+6%, +22%] | mixed |
| Cache-read tokens | −84% [−89%, −76%] | −1% [−6%, +5%] † | fewer in every repetition, within the noise |
| Cache-write tokens | −39% [−39%, −38%] | −23% [−43%, +3%] † | fewer in every repetition, within the noise |
| Total tokens (derived) | −81% [−86%, −74%] | −2% [−9%, +5%] † | fewer in every repetition, within the noise |
| Cost | −61% [−66%, −56%] | −10% [−21%, +4%] † | fewer in every repetition, within the noise |
| Wall time | −56% [−65%, −44%] | +13% [+5%, +22%] | mixed |

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
| fastapi | 15 | 7 | −8 | 2 / 0 / 0 |
| all | 15 | 7 | −8 | 2 / 0 / 0 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | 126 | 50 | −76 | 2 / 0 / 0 |
| all | 126 | 50 | −76 | 2 / 0 / 0 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | 2,884 | 1,763 | −1,122 | 2 / 0 / 0 |
| all | 2,884 | 1,763 | −1,122 | 2 / 0 / 0 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | 309,448 | 118,509 | −190,939 | 2 / 0 / 0 |
| all | 309,448 | 118,509 | −190,939 | 2 / 0 / 0 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | 17,698 | 12,013 | −5,685 | 2 / 0 / 0 |
| all | 17,698 | 12,013 | −5,685 | 2 / 0 / 0 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | 330,156 | 132,335 | −197,821 | 2 / 0 / 0 |
| all | 330,156 | 132,335 | −197,821 | 2 / 0 / 0 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | $0.0809 | $0.0447 | −$0.0361 | 2 / 0 / 0 |
| all | $0.0809 | $0.0447 | −$0.0361 | 2 / 0 / 0 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | 33.2 s | 22.5 s | −10.7 s | 2 / 0 / 0 |
| all | 33.2 s | 22.5 s | −10.7 s | 2 / 0 / 0 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| fastapi | $0.3236 (4 runs) | $0.1790 (4 runs) | none | none |
| all | $0.3236 (4 runs) | $0.1790 (4 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| fastapi/x145 | without | 2/2 | 14 [8–20] | 122 [74–170] | 2,872 [1,609–4,134] | 279,255 [141,018–417,492] | 16,544 [12,433–20,655] | $0.0755 [$0.0471–$0.1039] | 30.9 s [19.9 s–41.9 s] |
| fastapi/x145 | with | 2/2 | 5 [3–7] | 42 [26–58] | 1,377 [1,051–1,702] | 97,234 [46,421–148,047] | 12,795 [12,732–12,857] | $0.0422 [$0.0354–$0.0491] | 19.5 s [14.7 s–24.2 s] |
| fastapi/x146 | without | 2/2 | 15 [9–21] | 130 [82–178] | 2,897 [1,678–4,116] | 339,640 [164,586–514,694] | 18,852 [14,160–23,544] | $0.0863 [$0.0533–$0.1193] | 35.6 s [23.4 s–47.7 s] |
| fastapi/x146 | with | 2/2 | 8 [7–9] | 58 [50–66] | 2,149 [2,040–2,257] | 139,784 [125,467–154,101] | 11,232 [8,076–14,388] | $0.0472 [$0.0418–$0.0527] | 25.6 s [24.5 s–26.6 s] |

