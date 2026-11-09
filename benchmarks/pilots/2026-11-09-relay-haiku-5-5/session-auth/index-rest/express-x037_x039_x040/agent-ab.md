# Agent-level A/B — measured tool calls, tokens and cost

**claude-code 2.1.319 (Claude Code) · claude-haiku-5-5 · 2026-11-09 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap index strategy + 7-tool core MCP profile (the docs' setup for an agent that calls the tools).
- Both arms: the same prompt, model, tool allowlist (Read, Grep, Glob, Bash), per-run budget cap $0.5 and timeout 420 s; run in a clean copy of the commit pinned in `benchmarks/xrepo-repos.json`.
- Questions: the task id(s) x037, x039, x040 of `benchmarks/tasks/retrieval-xrepo.jsonl`. Pass = hit@5 on the repository-relative paths the answer names.
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
| express | 3 | 6/6 | 6/6 | 0 / 0 |
| all | 3 | 6/6 | 6/6 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 3. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | 0% | +14% | mixed |
| Input tokens (uncached) | +14% | 0% | mixed |
| Output tokens | +19% | +19% | more in every repetition |
| Cache-read tokens | +54% | +28% | more in every repetition |
| Cache-write tokens | +12% | +6% | more in every repetition |
| Total tokens (derived) | +45% | +24% | more in every repetition |
| Cost | +19% | +12% | more in every repetition |
| Wall time | +3% | +6% | more in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | +10% [−33%, +100%] † | 0% [−50%, +50%] † | mixed |
| Input tokens (uncached) | +14% [0%, +50%] † | 0% [0%, 0%] † | mixed |
| Output tokens | +17% [+1%, +53%] | +17% [+4%, +48%] | more in every repetition, outside the noise |
| Cache-read tokens | +55% [+29%, +119%] | +29% [+25%, +31%] | more in every repetition, outside the noise |
| Cache-write tokens | +15% [−12%, +31%] † | +7% [−18%, +42%] † | more in every repetition, within the noise |
| Total tokens (derived) | +46% [+20%, +99%] | +25% [+21%, +32%] | more in every repetition, outside the noise |
| Cost | +21% [−4%, +47%] † | +13% [−5%, +30%] † | more in every repetition, within the noise |
| Wall time | +3% [−3%, +16%] † | +6% [0%, +14%] | more in every repetition, within the noise |

### Outcome (hit@5), by repetition

Per paired task: **better** = the SigMap arm named the file and the other did not; **worse** = the reverse; **tie** = both found it or both missed. Localisation only.

| repetition | paired tasks | better | worse | tie |
| --- | ---: | ---: | ---: | ---: |
| R1 | 3 | 0 | 0 | 3 |
| R2 | 3 | 0 | 0 | 3 |
| all | 6 | 0 | 0 | 6 |

## Tool calls

Provenance: agent-reported (main-thread tool_use blocks). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | 2 | 3 | 0 | 1 / 1 / 1 |
| all | 2 | 3 | 0 | 1 / 1 / 1 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | 5 | 6 | 0 | 0 / 2 / 1 |
| all | 5 | 6 | 0 | 0 / 2 / 1 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | 659 | 830 | +176 | 0 / 0 / 3 |
| all | 659 | 830 | +176 | 0 / 0 / 3 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | 21,544 | 35,008 | +8,761 | 0 / 0 / 3 |
| all | 21,544 | 35,008 | +8,761 | 0 / 0 / 3 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | 4,924 | 5,599 | +178 | 1 / 0 / 2 |
| all | 4,924 | 5,599 | +178 | 1 / 0 / 2 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | 27,157 | 40,975 | +8,641 | 0 / 0 / 3 |
| all | 27,157 | 40,975 | +8,641 | 0 / 0 / 3 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | $0.0015 | $0.0018 | +$0.0003 | 0 / 0 / 3 |
| all | $0.0015 | $0.0018 | +$0.0003 | 0 / 0 / 3 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | 10.4 s | 11.1 s | +581 ms | 0 / 0 / 3 |
| all | 10.4 s | 11.1 s | +581 ms | 0 / 0 / 3 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| express | $0.0095 (6 runs) | $0.0109 (6 runs) | none | none |
| all | $0.0095 (6 runs) | $0.0109 (6 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| express/x037 | without | 2/2 | 2 [1–2] | 5 [4–6] | 684 [594–774] | 21,544 [15,925–27,163] | 4,924 [4,265–5,582] | $0.0015 [$0.0013–$0.0018] | 11.2 s [11.0 s–11.4 s] |
| express/x037 | with | 2/2 | 3 [2–3] | 6 [6–6] | 860 [813–907] | 35,008 [34,803–35,212] | 5,102 [4,605–5,598] | $0.0018 [$0.0017–$0.0019] | 11.7 s [11.0 s–12.5 s] |
| express/x039 | without | 2/2 | 2 [1–2] | 4 [4–4] | 659 [638–680] | 16,270 [15,925–16,614] | 4,110 [3,752–4,467] | $0.0013 [$0.0013–$0.0014] | 8.5 s [8.3 s–8.6 s] |
| express/x039 | with | 2/2 | 1 [1–1] | 4 [4–4] | 674 [642–706] | 21,463 [21,119–21,806] | 5,599 [5,343–5,855] | $0.0017 [$0.0016–$0.0017] | 8.5 s [8.1 s–9.0 s] |
| express/x040 | without | 2/2 | 3 [3–3] | 7 [6–8] | 651 [616–686] | 32,830 [26,470–39,190] | 6,117 [5,575–6,658] | $0.0019 [$0.0019–$0.0019] | 10.4 s [8.5 s–12.3 s] |
| express/x040 | with | 2/2 | 3 [2–4] | 7 [6–8] | 830 [641–1,018] | 41,591 [34,028–49,154] | 5,818 [5,790–5,846] | $0.0020 [$0.0018–$0.0022] | 11.1 s [9.8 s–12.3 s] |

