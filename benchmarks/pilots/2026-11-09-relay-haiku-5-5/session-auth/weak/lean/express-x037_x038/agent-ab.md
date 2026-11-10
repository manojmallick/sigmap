# Agent-level A/B — measured tool calls, tokens and cost

**claude-code 2.1.321 (Claude Code) · claude-haiku-4-5 · 2026-11-10 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap lean: 7-tool core MCP profile + a three-line section.
- Both arms: the same prompt, model, tool allowlist (Read, Grep, Glob, Bash), per-run budget cap $1 and timeout 420 s; run in a clean copy of the commit pinned in `benchmarks/xrepo-repos.json`.
- Questions: the task id(s) x037, x038 of `benchmarks/tasks/retrieval-xrepo.jsonl`. Pass = hit@5 on the repository-relative paths the answer names.
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
| express | 2 | 4/4 | 4/4 | 0 / 0 |
| all | 2 | 4/4 | 4/4 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 2. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | +14% | +29% | more in every repetition |
| Input tokens (uncached) | +12% | +10% | more in every repetition |
| Output tokens | −8% | +12% | mixed |
| Cache-read tokens | −5% | +16% | mixed |
| Cache-write tokens | −53% | +2% | mixed |
| Total tokens (derived) | −9% | +15% | mixed |
| Cost | −30% | +8% | mixed |
| Wall time | −6% | +8% | mixed |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | +13% [+10%, +17%] | +27% [+13%, +44%] | more in every repetition, outside the noise |
| Input tokens (uncached) | +12% [+9%, +15%] | +4% [−22%, +39%] † | more in every repetition, within the noise |
| Output tokens | −8% [−10%, −6%] | +12% [+12%, +12%] | mixed |
| Cache-read tokens | −6% [−10%, −2%] | +13% [−4%, +32%] † | mixed |
| Cache-write tokens | −53% [−58%, −48%] | −5% [−34%, +36%] † | fewer in every repetition, within the noise |
| Total tokens (derived) | −10% [−14%, −6%] | +13% [0%, +27%] | mixed |
| Cost | −31% [−34%, −27%] | +7% [−5%, +22%] † | mixed |
| Wall time | −6% [−7%, −4%] | +8% [+8%, +8%] | mixed |

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
| express | 10 | 12 | +2 | 0 / 0 / 2 |
| all | 10 | 12 | +2 | 0 / 0 / 2 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | 88 | 98 | +10 | 1 / 0 / 1 |
| all | 88 | 98 | +10 | 1 / 0 / 1 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | 2,275 | 2,286 | +11 | 1 / 0 / 1 |
| all | 2,275 | 2,286 | +11 | 1 / 0 / 1 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | 186,589 | 193,263 | +6,674 | 1 / 0 / 1 |
| all | 186,589 | 193,263 | +6,674 | 1 / 0 / 1 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | 16,821 | 12,070 | −4,751 | 2 / 0 / 0 |
| all | 16,821 | 12,070 | −4,751 | 2 / 0 / 0 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | 205,773 | 207,716 | +1,944 | 1 / 0 / 1 |
| all | 205,773 | 207,716 | +1,944 | 1 / 0 / 1 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | $0.0638 | $0.0550 | −$0.0088 | 2 / 0 / 0 |
| all | $0.0638 | $0.0550 | −$0.0088 | 2 / 0 / 0 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | 26.7 s | 26.9 s | +161 ms | 1 / 0 / 1 |
| all | 26.7 s | 26.9 s | +161 ms | 1 / 0 / 1 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| express | $0.2551 (4 runs) | $0.2200 (4 runs) | none | none |
| all | $0.2551 (4 runs) | $0.2200 (4 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| express/x037 | without | 2/2 | 11 [9–12] | 94 [82–106] | 2,538 [2,241–2,835] | 206,470 [171,075–241,865] | 17,521 [14,730–20,311] | $0.0685 [$0.0579–$0.0791] | 29.6 s [27.6 s–31.6 s] |
| express/x037 | with | 2/2 | 14 [13–14] | 118 [114–122] | 2,533 [2,508–2,557] | 231,865 [226,454–237,275] | 10,153 [9,783–10,522] | $0.0563 [$0.0549–$0.0577] | 29.5 s [29.3 s–29.8 s] |
| express/x038 | without | 2/2 | 9 [8–10] | 82 [74–90] | 2,013 [1,689–2,336] | 166,708 [141,779–191,636] | 16,121 [15,304–16,937] | $0.0591 [$0.0533–$0.0648] | 23.8 s [21.7 s–25.9 s] |
| express/x038 | with | 2/2 | 10 [9–11] | 78 [58–98] | 2,040 [1,884–2,195] | 154,661 [136,780–172,541] | 13,987 [7,140–20,833] | $0.0537 [$0.0426–$0.0648] | 24.2 s [23.5 s–24.9 s] |

