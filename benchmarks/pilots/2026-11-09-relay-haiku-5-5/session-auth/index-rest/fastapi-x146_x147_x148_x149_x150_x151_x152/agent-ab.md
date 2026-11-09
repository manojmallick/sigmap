# Agent-level A/B — measured tool calls, tokens and cost

**claude-code 2.1.319 (Claude Code) · claude-haiku-5-5 · 2026-11-09 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap index strategy + 7-tool core MCP profile (the docs' setup for an agent that calls the tools).
- Both arms: the same prompt, model, tool allowlist (Read, Grep, Glob, Bash), per-run budget cap $0.5 and timeout 420 s; run in a clean copy of the commit pinned in `benchmarks/xrepo-repos.json`.
- Questions: the task id(s) x146, x147, x148, x149, x150, x151, x152 of `benchmarks/tasks/retrieval-xrepo.jsonl`. Pass = hit@5 on the repository-relative paths the answer names.
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
| fastapi | 7 | 14/14 | 14/14 | 0 / 0 |
| all | 7 | 14/14 | 14/14 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 7. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | +17% | +5% | more in every repetition |
| Input tokens (uncached) | +8% | −4% | mixed |
| Output tokens | +4% | +2% | more in every repetition |
| Cache-read tokens | +44% | +24% | more in every repetition |
| Cache-write tokens | +13% | −3% | mixed |
| Total tokens (derived) | +37% | +19% | more in every repetition |
| Cost | +15% | +2% | more in every repetition |
| Wall time | +3% | +1% | more in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | +15% [−9%, +49%] † | +5% [−24%, +51%] † | more in every repetition, within the noise |
| Input tokens (uncached) | +8% [−8%, +30%] † | −3% [−21%, +21%] † | mixed |
| Output tokens | +5% [−15%, +32%] † | +1% [−21%, +30%] † | more in every repetition, within the noise |
| Cache-read tokens | +43% [+18%, +78%] | +24% [−8%, +71%] † | more in every repetition, within the noise |
| Cache-write tokens | +13% [−1%, +30%] † | −6% [−18%, +11%] † | mixed |
| Total tokens (derived) | +37% [+16%, +67%] | +18% [−10%, +59%] † | more in every repetition, within the noise |
| Cost | +15% [+2%, +33%] | 0% [−17%, +22%] † | more in every repetition, within the noise |
| Wall time | +3% [−7%, +15%] † | +1% [−10%, +16%] † | more in every repetition, within the noise |

### Outcome (hit@5), by repetition

Per paired task: **better** = the SigMap arm named the file and the other did not; **worse** = the reverse; **tie** = both found it or both missed. Localisation only.

| repetition | paired tasks | better | worse | tie |
| --- | ---: | ---: | ---: | ---: |
| R1 | 7 | 0 | 0 | 7 |
| R2 | 7 | 0 | 0 | 7 |
| all | 14 | 0 | 0 | 14 |

## Tool calls

Provenance: agent-reported (main-thread tool_use blocks). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | 4 | 4 | 0 | 2 / 2 / 3 |
| all | 4 | 4 | 0 | 2 / 2 / 3 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | 6 | 6 | 0 | 2 / 3 / 2 |
| all | 6 | 6 | 0 | 2 / 3 / 2 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | 1,082 | 1,083 | −102 | 4 / 0 / 3 |
| all | 1,082 | 1,083 | −102 | 4 / 0 / 3 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | 28,326 | 36,774 | +7,809 | 1 / 0 / 6 |
| all | 28,326 | 36,774 | +7,809 | 1 / 0 / 6 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | 6,603 | 6,682 | +67 | 3 / 0 / 4 |
| all | 6,603 | 6,682 | +67 | 3 / 0 / 4 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | 35,863 | 45,830 | +8,507 | 1 / 0 / 6 |
| all | 35,863 | 45,830 | +8,507 | 1 / 0 / 6 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | $0.0021 | $0.0023 | +$0.0001 | 3 / 0 / 4 |
| all | $0.0021 | $0.0023 | +$0.0001 | 3 / 0 / 4 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | 13.2 s | 13.1 s | −141 ms | 4 / 0 / 3 |
| all | 13.2 s | 13.1 s | −141 ms | 4 / 0 / 3 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| fastapi | $0.0318 (14 runs) | $0.0345 (14 runs) | none | none |
| all | $0.0318 (14 runs) | $0.0345 (14 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| fastapi/x146 | without | 2/2 | 4 [4–4] | 10 [10–10] | 1,014 [996–1,032] | 52,411 [50,869–53,953] | 7,997 [7,973–8,021] | $0.0026 [$0.0026–$0.0026] | 14.3 s [13.8 s–14.8 s] |
| fastapi/x146 | with | 2/2 | 5 [3–6] | 9 [8–10] | 1,659 [1,540–1,777] | 59,533 [52,586–66,480] | 8,739 [7,829–9,648] | $0.0032 [$0.0029–$0.0035] | 16.6 s [16.6 s–16.6 s] |
| fastapi/x147 | without | 2/2 | 3 [2–3] | 6 [6–6] | 1,082 [987–1,176] | 28,326 [28,215–28,436] | 6,603 [5,680–7,526] | $0.0021 [$0.0019–$0.0024] | 12.6 s [12.5 s–12.6 s] |
| fastapi/x147 | with | 2/2 | 2 [2–2] | 6 [6–6] | 1,083 [872–1,293] | 35,600 [35,315–35,885] | 5,751 [4,746–6,756] | $0.0020 [$0.0017–$0.0024] | 12.4 s [10.9 s–13.9 s] |
| fastapi/x148 | without | 2/2 | 4 [3–4] | 6 [6–6] | 1,133 [974–1,292] | 27,070 [27,025–27,115] | 5,489 [4,468–6,509] | $0.0019 [$0.0017–$0.0022] | 13.2 s [11.8 s–14.6 s] |
| fastapi/x148 | with | 2/2 | 4 [3–4] | 7 [6–8] | 942 [864–1,019] | 43,320 [35,280–51,359] | 5,556 [4,237–6,874] | $0.0020 [$0.0016–$0.0024] | 12.0 s [11.7 s–12.3 s] |
| fastapi/x149 | without | 2/2 | 2 [2–2] | 6 [6–6] | 725 [661–788] | 28,456 [26,338–30,573] | 6,677 [4,549–8,805] | $0.0020 [$0.0015–$0.0025] | 11.0 s [10.2 s–11.7 s] |
| fastapi/x149 | with | 2/2 | 5 [4–5] | 10 [10–10] | 1,169 [998–1,339] | 73,806 [62,928–84,684] | 9,314 [6,389–12,238] | $0.0032 [$0.0024–$0.0040] | 14.7 s [13.4 s–16.0 s] |
| fastapi/x150 | without | 2/2 | 3 [2–3] | 6 [6–6] | 895 [818–971] | 27,500 [27,309–27,691] | 6,405 [6,386–6,423] | $0.0020 [$0.0020–$0.0020] | 10.7 s [10.7 s–10.7 s] |
| fastapi/x150 | with | 2/2 | 3 [3–3] | 6 [6–6] | 793 [792–793] | 36,034 [35,802–36,265] | 6,682 [6,190–7,174] | $0.0021 [$0.0020–$0.0022] | 11.4 s [11.4 s–11.4 s] |
| fastapi/x151 | without | 2/2 | 4 [3–4] | 9 [8–10] | 1,394 [1,226–1,561] | 49,534 [38,934–60,133] | 8,050 [6,502–9,598] | $0.0028 [$0.0023–$0.0033] | 14.0 s [12.8 s–15.2 s] |
| fastapi/x151 | with | 2/2 | 3 [2–4] | 6 [6–6] | 1,031 [878–1,184] | 36,774 [36,277–37,271] | 8,019 [6,508–9,529] | $0.0025 [$0.0021–$0.0029] | 13.5 s [13.4 s–13.6 s] |
| fastapi/x152 | without | 2/2 | 4 [4–4] | 6 [6–6] | 1,662 [1,566–1,758] | 27,306 [26,808–27,803] | 6,394 [5,804–6,983] | $0.0024 [$0.0022–$0.0025] | 15.9 s [15.3 s–16.6 s] |
| fastapi/x152 | with | 2/2 | 4 [4–4] | 6 [6–6] | 1,437 [1,352–1,521] | 35,114 [34,849–35,379] | 5,911 [5,480–6,341] | $0.0023 [$0.0022–$0.0023] | 13.1 s [12.5 s–13.7 s] |

