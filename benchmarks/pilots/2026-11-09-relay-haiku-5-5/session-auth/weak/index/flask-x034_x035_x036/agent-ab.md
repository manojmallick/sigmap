# Agent-level A/B — measured tool calls, tokens and cost

**claude-code 2.1.322 (Claude Code) · claude-haiku-4-5 · 2026-11-10 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap index strategy + 7-tool core MCP profile (the docs' setup for an agent that calls the tools).
- Both arms: the same prompt, model, tool allowlist (Read, Grep, Glob, Bash), per-run budget cap $1 and timeout 420 s; run in a clean copy of the commit pinned in `benchmarks/xrepo-repos.json`.
- Questions: the task id(s) x034, x035, x036 of `benchmarks/tasks/retrieval-xrepo.jsonl`. Pass = hit@5 on the repository-relative paths the answer names.
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
| flask | 3 | 6/6 | 6/6 | 0 / 0 |
| all | 3 | 6/6 | 6/6 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 3. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | +11% | −41% | mixed |
| Input tokens (uncached) | −5% | −40% | fewer in every repetition |
| Output tokens | −1% | −29% | fewer in every repetition |
| Cache-read tokens | +2% | −45% | mixed |
| Cache-write tokens | −21% | −23% | fewer in every repetition |
| Total tokens (derived) | −1% | −43% | fewer in every repetition |
| Cost | −13% | −30% | fewer in every repetition |
| Wall time | −1% | −26% | fewer in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | +9% [−33%, +75%] † | −48% [−75%, +67%] † | mixed |
| Input tokens (uncached) | −4% [−28%, +57%] † | −42% [−65%, +41%] † | fewer in every repetition, within the noise |
| Output tokens | −3% [−39%, +23%] † | −26% [−52%, +51%] † | fewer in every repetition, within the noise |
| Cache-read tokens | +6% [−19%, +82%] † | −50% [−78%, +79%] † | mixed |
| Cache-write tokens | −24% [−45%, +1%] † | −24% [−35%, −12%] | fewer in every repetition, within the noise |
| Total tokens (derived) | +1% [−19%, +55%] † | −45% [−72%, +66%] † | mixed |
| Cost | −15% [−23%, −1%] | −29% [−50%, +11%] † | fewer in every repetition, within the noise |
| Wall time | −2% [−28%, +18%] † | −22% [−48%, +33%] † | fewer in every repetition, within the noise |

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
| flask | 7 | 5 | −2 | 2 / 0 / 1 |
| all | 7 | 5 | −2 | 2 / 0 / 1 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | 66 | 46 | −12 | 2 / 0 / 1 |
| all | 66 | 46 | −12 | 2 / 0 / 1 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | 1,761 | 1,670 | −281 | 2 / 0 / 1 |
| all | 1,761 | 1,670 | −281 | 2 / 0 / 1 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | 137,410 | 95,091 | −42,679 | 2 / 0 / 1 |
| all | 137,410 | 95,091 | −42,679 | 2 / 0 / 1 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | 18,386 | 14,029 | −5,094 | 3 / 0 / 0 |
| all | 18,386 | 14,029 | −5,094 | 3 / 0 / 0 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | 157,580 | 109,549 | −48,516 | 2 / 0 / 1 |
| all | 157,580 | 109,549 | −48,516 | 2 / 0 / 1 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | $0.0609 | $0.0441 | −$0.0168 | 2 / 0 / 1 |
| all | $0.0609 | $0.0441 | −$0.0168 | 2 / 0 / 1 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | 23.0 s | 21.5 s | −2.5 s | 2 / 0 / 1 |
| all | 23.0 s | 21.5 s | −2.5 s | 2 / 0 / 1 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| flask | $0.3862 (6 runs) | $0.2980 (6 runs) | none | none |
| all | $0.3862 (6 runs) | $0.2980 (6 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| flask/x034 | without | 2/2 | 7 [6–8] | 66 [58–74] | 1,719 [1,610–1,827] | 137,410 [108,103–166,717] | 18,386 [16,523–20,248] | $0.0592 [$0.0520–$0.0664] | 22.5 s [21.2 s–23.8 s] |
| flask/x034 | with | 2/2 | 10 [9–10] | 70 [58–82] | 2,344 [2,251–2,436] | 164,118 [134,408–193,828] | 16,651 [12,895–20,406] | $0.0615 [$0.0574–$0.0656] | 27.5 s [26.8 s–28.2 s] |
| flask/x035 | without | 2/2 | 11 [6–15] | 94 [58–130] | 3,199 [2,012–4,386] | 212,892 [103,114–322,670] | 17,836 [15,615–20,057] | $0.0731 [$0.0517–$0.0944] | 36.3 s [25.3 s–47.4 s] |
| flask/x035 | with | 2/2 | 5 [4–5] | 46 [42–50] | 1,670 [1,231–2,109] | 95,091 [84,090–106,091] | 12,742 [12,507–12,977] | $0.0434 [$0.0396–$0.0472] | 21.5 s [18.1 s–24.8 s] |
| flask/x036 | without | 2/2 | 6 [4–8] | 58 [42–74] | 1,761 [1,504–2,018] | 128,554 [72,591–184,517] | 19,574 [19,178–19,970] | $0.0609 [$0.0532–$0.0686] | 23.0 s [20.1 s–26.0 s] |
| flask/x036 | with | 2/2 | 5 [2–7] | 46 [26–66] | 1,481 [1,146–1,815] | 85,876 [39,819–131,932] | 14,029 [10,481–17,577] | $0.0441 [$0.0433–$0.0449] | 20.5 s [17.4 s–23.6 s] |

