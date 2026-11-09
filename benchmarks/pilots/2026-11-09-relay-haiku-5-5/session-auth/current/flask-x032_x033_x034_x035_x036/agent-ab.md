# Agent-level A/B — measured tool calls, tokens and cost

**claude-code 2.1.321 (Claude Code) · claude-haiku-5-5 · 2026-11-09 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap generated context + MCP server.
- Both arms: the same prompt, model, tool allowlist (Read, Grep, Glob, Bash), per-run budget cap $0.5 and timeout 420 s; run in a clean copy of the commit pinned in `benchmarks/xrepo-repos.json`.
- Questions: the task id(s) x032, x033, x034, x035, x036 of `benchmarks/tasks/retrieval-xrepo.jsonl`. Pass = hit@5 on the repository-relative paths the answer names.
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
| flask | 5 | 10/10 | 10/10 | 0 / 0 |
| all | 5 | 10/10 | 10/10 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 5. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −11% | 0% | mixed |
| Input tokens (uncached) | −6% | +6% | mixed |
| Output tokens | +9% | +20% | more in every repetition |
| Cache-read tokens | +57% | +87% | more in every repetition |
| Cache-write tokens | +13% | +3% | more in every repetition |
| Total tokens (derived) | +47% | +69% | more in every repetition |
| Cost | +17% | +18% | more in every repetition |
| Wall time | +3% | +8% | more in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −24% [−57%, +19%] † | +2% [−30%, +52%] † | mixed |
| Input tokens (uncached) | −6% [−34%, +28%] † | +6% [0%, +19%] † | mixed |
| Output tokens | −4% [−27%, +25%] † | +11% [−7%, +38%] † | mixed |
| Cache-read tokens | +61% [+7%, +136%] | +87% [+69%, +120%] | more in every repetition, outside the noise |
| Cache-write tokens | +9% [−15%, +47%] † | +2% [−12%, +17%] † | more in every repetition, within the noise |
| Total tokens (derived) | +49% [+2%, +113%] | +69% [+54%, +96%] | more in every repetition, outside the noise |
| Cost | +14% [−11%, +45%] † | +16% [+2%, +32%] | more in every repetition, within the noise |
| Wall time | +1% [−8%, +11%] † | +7% [0%, +15%] | more in every repetition, within the noise |

### Outcome (hit@5), by repetition

Per paired task: **better** = the SigMap arm named the file and the other did not; **worse** = the reverse; **tie** = both found it or both missed. Localisation only.

| repetition | paired tasks | better | worse | tie |
| --- | ---: | ---: | ---: | ---: |
| R1 | 5 | 0 | 0 | 5 |
| R2 | 5 | 0 | 0 | 5 |
| all | 10 | 0 | 0 | 10 |

## Tool calls

Provenance: agent-reported (main-thread tool_use blocks). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | 3 | 3 | 0 | 2 / 1 / 2 |
| all | 3 | 3 | 0 | 2 / 1 / 2 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | 6 | 6 | 0 | 1 / 3 / 1 |
| all | 6 | 6 | 0 | 1 / 3 / 1 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | 945 | 930 | +48 | 2 / 0 / 3 |
| all | 945 | 930 | +48 | 2 / 0 / 3 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | 28,840 | 49,795 | +21,802 | 0 / 0 / 5 |
| all | 28,840 | 49,795 | +21,802 | 0 / 0 / 5 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | 6,555 | 7,367 | +342 | 2 / 0 / 3 |
| all | 6,555 | 7,367 | +342 | 2 / 0 / 3 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | 38,264 | 58,097 | +22,261 | 0 / 0 / 5 |
| all | 38,264 | 58,097 | +22,261 | 0 / 0 / 5 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | $0.0021 | $0.0024 | +$0.0003 | 2 / 0 / 3 |
| all | $0.0021 | $0.0024 | +$0.0003 | 2 / 0 / 3 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | 11.1 s | 11.3 s | +277 ms | 2 / 0 / 3 |
| all | 11.1 s | 11.3 s | +277 ms | 2 / 0 / 3 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| flask | $0.0238 (10 runs) | $0.0281 (10 runs) | none | none |
| all | $0.0238 (10 runs) | $0.0281 (10 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| flask/x032 | without | 2/2 | 6 [6–6] | 8 [8–8] | 1,793 [1,565–2,021] | 44,883 [44,692–45,074] | 10,919 [10,384–11,453] | $0.0035 [$0.0033–$0.0037] | 16.0 s [14.8 s–17.2 s] |
| flask/x032 | with | 2/2 | 6 [5–7] | 8 [8–8] | 2,815 [2,604–3,025] | 69,964 [66,369–73,558] | 13,422 [11,593–15,250] | $0.0048 [$0.0044–$0.0052] | 19.3 s [18.2 s–20.4 s] |
| flask/x033 | without | 2/2 | 3 [3–3] | 6 [6–6] | 1,149 [1,134–1,164] | 28,840 [28,593–29,087] | 8,269 [8,019–8,519] | $0.0025 [$0.0025–$0.0026] | 12.1 s [11.9 s–12.4 s] |
| flask/x033 | with | 2/2 | 2 [2–2] | 6 [6–6] | 930 [797–1,062] | 49,795 [49,331–50,258] | 7,367 [7,035–7,699] | $0.0024 [$0.0024–$0.0024] | 11.4 s [10.7 s–12.1 s] |
| flask/x034 | without | 2/2 | 3 [2–3] | 6 [6–6] | 945 [868–1,021] | 27,485 [27,134–27,835] | 6,264 [5,732–6,795] | $0.0020 [$0.0019–$0.0021] | 11.1 s [11.0 s–11.1 s] |
| flask/x034 | with | 2/2 | 4 [4–4] | 6 [6–6] | 1,062 [920–1,204] | 49,287 [49,109–49,464] | 6,605 [6,448–6,762] | $0.0023 [$0.0023–$0.0024] | 11.3 s [11.3 s–11.4 s] |
| flask/x035 | without | 2/2 | 4 [3–4] | 7 [6–8] | 816 [788–844] | 33,483 [27,930–39,035] | 6,555 [6,427–6,683] | $0.0021 [$0.0020–$0.0021] | 10.0 s [9.5 s–10.6 s] |
| flask/x035 | with | 2/2 | 2 [1–2] | 5 [4–6] | 629 [579–678] | 40,045 [30,490–49,599] | 5,126 [5,111–5,140] | $0.0017 [$0.0016–$0.0019] | 9.9 s [9.3 s–10.5 s] |
| flask/x036 | without | 2/2 | 2 [2–2] | 5 [4–6] | 716 [680–751] | 21,934 [16,132–27,735] | 6,132 [4,701–7,563] | $0.0018 [$0.0015–$0.0021] | 9.7 s [8.7 s–10.7 s] |
| flask/x036 | with | 2/2 | 3 [2–3] | 7 [6–8] | 763 [725–801] | 59,871 [48,498–71,243] | 8,655 [8,412–8,898] | $0.0027 [$0.0025–$0.0029] | 10.2 s [9.4 s–11.0 s] |

