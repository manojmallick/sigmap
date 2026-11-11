# Agent-level A/B — measured tool calls, tokens and cost

**claude-code 2.1.322 (Claude Code) · claude-haiku-5-5 · 2026-11-11 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap index strategy + 7-tool core MCP profile (the docs' setup for an agent that calls the tools).
- Both arms: the same prompt, model, tool allowlist (Read, Grep, Glob, Bash), per-run budget cap $0.5 and timeout 420 s; run in a clean copy of the commit pinned in `benchmarks/xrepo-repos.json`.
- Questions: the task id(s) x145, x146, x147, x148, x149, x150, x151, x152 of `benchmarks/tasks/retrieval-xrepo.jsonl`. Pass = hit@5 on the repository-relative paths the answer names.
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
| fastapi | 8 | 16/16 | 15/16 | 0 / 1 |
| all | 8 | 16/16 | 15/16 | 0 / 1 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 8. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −29% n=7 | +22% | mixed |
| Input tokens (uncached) | −17% n=7 | +4% | mixed |
| Output tokens | −16% n=7 | +7% | mixed |
| Cache-read tokens | −2% n=7 | +36% | mixed |
| Cache-write tokens | +21% n=7 | +7% | more in every repetition |
| Total tokens (derived) | +1% n=7 | +31% | more in every repetition |
| Cost | +7% n=7 | +12% | more in every repetition |
| Wall time | −6% n=7 | +4% | mixed |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −26% [−44%, −1%] n=7 | +21% [+5%, +46%] | mixed |
| Input tokens (uncached) | −16% [−28%, −4%] n=7 | +5% [−7%, +21%] † | mixed |
| Output tokens | −10% [−31%, +15%] † n=7 | +9% [−5%, +25%] † | mixed |
| Cache-read tokens | 0% [−16%, +16%] † n=7 | +39% [+18%, +68%] | mixed |
| Cache-write tokens | +20% [−5%, +56%] † n=7 | +7% [−7%, +24%] † | more in every repetition, within the noise |
| Total tokens (derived) | +2% [−15%, +20%] † n=7 | +33% [+14%, +58%] | more in every repetition, within the noise |
| Cost | +9% [−12%, +35%] † n=7 | +12% [−1%, +28%] † | more in every repetition, within the noise |
| Wall time | −4% [−17%, +10%] † n=7 | +4% [−5%, +16%] † | mixed |

### Outcome (hit@5), by repetition

Per paired task: **better** = the SigMap arm named the file and the other did not; **worse** = the reverse; **tie** = both found it or both missed. Localisation only.

| repetition | paired tasks | better | worse | tie |
| --- | ---: | ---: | ---: | ---: |
| R1 | 7 | 0 | 0 | 7 |
| R2 | 8 | 0 | 0 | 8 |
| all | 15 | 0 | 0 | 15 |

## Tool calls

Provenance: agent-reported (main-thread tool_use blocks). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | 3 | 3 | 0 | 3 / 2 / 3 |
| all | 3 | 3 | 0 | 3 / 2 / 3 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | 6 | 6 | 0 | 3 / 2 / 3 |
| all | 6 | 6 | 0 | 3 / 2 / 3 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | 913 | 1,027 | +27 | 3 / 0 / 5 |
| all | 913 | 1,027 | +27 | 3 / 0 / 5 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | 28,216 | 36,171 | +6,775 | 1 / 0 / 7 |
| all | 28,216 | 36,171 | +6,775 | 1 / 0 / 7 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | 6,325 | 6,758 | +109 | 4 / 0 / 4 |
| all | 6,325 | 6,758 | +109 | 4 / 0 / 4 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | 35,564 | 44,297 | +7,432 | 1 / 0 / 7 |
| all | 35,564 | 44,297 | +7,432 | 1 / 0 / 7 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | $0.0020 | $0.0023 | +$0.0001 | 3 / 0 / 5 |
| all | $0.0020 | $0.0023 | +$0.0001 | 3 / 0 / 5 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | 10.1 s | 10.4 s | −92 ms | 4 / 0 / 4 |
| all | 10.1 s | 10.4 s | −92 ms | 4 / 0 / 4 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| fastapi | $0.0336 (16 runs) | $0.0345 (15 runs) · 1 run unreported | none | 1 run unreported |
| all | $0.0336 (16 runs) | $0.0345 (15 runs) · 1 run unreported | none | 1 run unreported |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| fastapi/x145 | without | 2/2 | 3 [2–4] | 5 [4–6] | 858 [830–886] | 22,042 [16,828–27,255] | 7,143 [5,415–8,871] | $0.0021 [$0.0017–$0.0025] | 9.1 s [8.9 s–9.3 s] |
| fastapi/x145 | with | 2/2 | 3 [3–3] | 6 [6–6] | 1,045 [970–1,120] | 36,300 [33,613–38,987] | 9,626 [8,378–10,873] | $0.0028 [$0.0026–$0.0031] | 10.4 s [10.0 s–10.8 s] |
| fastapi/x146 | without | 2/2 | 4 [3–4] | 9 [8–10] | 1,200 [845–1,555] | 46,479 [40,944–52,014] | 7,170 [6,931–7,408] | $0.0025 [$0.0022–$0.0028] | 12.0 s [9.4 s–14.5 s] |
| fastapi/x146 | with | 2/2 | 3 [3–3] | 6 [6–6] | 1,046 [1,045–1,046] | 36,600 [35,904–37,295] | 7,061 [7,023–7,098] | $0.0023 [$0.0023–$0.0023] | 10.0 s [9.9 s–10.1 s] |
| fastapi/x147 | without | 2/2 | 2 [2–2] | 6 [6–6] | 796 [763–828] | 27,621 [27,572–27,670] | 4,656 [4,610–4,702] | $0.0016 [$0.0016–$0.0016] | 10.1 s [10.0 s–10.1 s] |
| fastapi/x147 | with | 2/2 | 2 [1–2] | 5 [4–6] | 954 [886–1,021] | 28,408 [21,497–35,319] | 4,458 [4,320–4,596] | $0.0017 [$0.0016–$0.0017] | 9.7 s [9.2 s–10.2 s] |
| fastapi/x148 | without | 2/2 | 4 [3–4] | 7 [6–8] | 963 [861–1,065] | 34,365 [29,657–39,073] | 5,965 [5,161–6,769] | $0.0020 [$0.0020–$0.0021] | 10.1 s [9.3 s–10.9 s] |
| fastapi/x148 | with | 1/2 | 4 [4–4] n=1 | 8 [8–8] n=1 | 970 [970–970] n=1 | 49,961 [49,961–49,961] n=1 | 4,938 [4,938–4,938] n=1 | $0.0020 [$0.0020–$0.0020] n=1 | 10.5 s [10.5 s–10.5 s] n=1 |
| fastapi/x149 | without | 2/2 | 3 [2–3] | 6 [6–6] | 864 [824–903] | 28,081 [27,960–28,201] | 4,914 [4,617–5,210] | $0.0017 [$0.0016–$0.0018] | 9.1 s [9.0 s–9.2 s] |
| fastapi/x149 | with | 2/2 | 4 [2–6] | 7 [6–8] | 1,008 [670–1,346] | 42,741 [33,321–52,160] | 8,487 [6,922–10,051] | $0.0026 [$0.0026–$0.0027] | 11.6 s [10.0 s–13.2 s] |
| fastapi/x150 | without | 2/2 | 3 [2–3] | 6 [6–6] | 850 [801–899] | 28,187 [28,164–28,209] | 6,129 [5,629–6,629] | $0.0019 [$0.0019–$0.0020] | 10.1 s [10.0 s–10.3 s] |
| fastapi/x150 | with | 2/2 | 3 [2–3] | 6 [6–6] | 896 [775–1,017] | 35,519 [34,923–36,115] | 6,456 [6,214–6,698] | $0.0021 [$0.0021–$0.0021] | 9.6 s [8.6 s–10.5 s] |
| fastapi/x151 | without | 2/2 | 3 [2–3] | 6 [6–6] | 1,184 [929–1,439] | 28,245 [28,179–28,310] | 6,522 [5,758–7,285] | $0.0022 [$0.0019–$0.0025] | 10.2 s [9.1 s–11.4 s] |
| fastapi/x151 | with | 2/2 | 3 [3–3] | 6 [6–6] | 1,127 [1,118–1,136] | 34,461 [32,849–36,073] | 7,521 [5,684–9,358] | $0.0024 [$0.0021–$0.0028] | 10.4 s [10.2 s–10.7 s] |
| fastapi/x152 | without | 2/2 | 6 [4–7] | 7 [6–8] | 2,092 [1,734–2,450] | 34,486 [27,698–41,274] | 6,903 [5,695–8,111] | $0.0028 [$0.0023–$0.0033] | 15.4 s [13.7 s–17.2 s] |
| fastapi/x152 | with | 2/2 | 4 [3–4] | 6 [6–6] | 1,431 [1,192–1,670] | 36,043 [35,158–36,927] | 6,404 [5,927–6,880] | $0.0024 [$0.0021–$0.0026] | 13.6 s [13.4 s–13.7 s] |

