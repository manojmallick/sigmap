# Agent-level A/B — measured tool calls, tokens and cost

**claude-code 2.1.322 (Claude Code) · claude-haiku-4-5 · 2026-11-10 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap lean: 7-tool core MCP profile + a three-line section.
- Both arms: the same prompt, model, tool allowlist (Read, Grep, Glob, Bash), per-run budget cap $1 and timeout 420 s; run in a clean copy of the commit pinned in `benchmarks/xrepo-repos.json`.
- Questions: the task id(s) x139, x140, x141, x142, x143, x144 of `benchmarks/tasks/retrieval-xrepo.jsonl`. Pass = hit@5 on the repository-relative paths the answer names.
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
| fastify | 6 | 12/12 | 12/12 | 0 / 0 |
| all | 6 | 12/12 | 12/12 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 6. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | +31% | +5% | more in every repetition |
| Input tokens (uncached) | +24% | +1% | more in every repetition |
| Output tokens | +30% | −2% | mixed |
| Cache-read tokens | +18% | −2% | mixed |
| Cache-write tokens | −23% | −27% | fewer in every repetition |
| Total tokens (derived) | +15% | −3% | mixed |
| Cost | −1% | −14% | fewer in every repetition |
| Wall time | +28% | −5% | mixed |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | +30% [−7%, +84%] † | +1% [−24%, +35%] † | more in every repetition, within the noise |
| Input tokens (uncached) | +21% [−10%, +65%] † | −1% [−23%, +27%] † | mixed |
| Output tokens | +27% [0%, +58%] † | −2% [−19%, +24%] † | mixed |
| Cache-read tokens | +10% [−20%, +52%] † | −2% [−29%, +38%] † | mixed |
| Cache-write tokens | −23% [−36%, 0%] † | −27% [−42%, −6%] | fewer in every repetition, within the noise |
| Total tokens (derived) | +7% [−21%, +47%] † | −3% [−30%, +35%] † | mixed |
| Cost | −4% [−24%, +23%] † | −14% [−33%, +14%] † | fewer in every repetition, within the noise |
| Wall time | +26% [+2%, +56%] | −4% [−20%, +21%] † | mixed |

### Outcome (hit@5), by repetition

Per paired task: **better** = the SigMap arm named the file and the other did not; **worse** = the reverse; **tie** = both found it or both missed. Localisation only.

| repetition | paired tasks | better | worse | tie |
| --- | ---: | ---: | ---: | ---: |
| R1 | 6 | 0 | 0 | 6 |
| R2 | 6 | 0 | 0 | 6 |
| all | 12 | 0 | 0 | 12 |

## Tool calls

Provenance: agent-reported (main-thread tool_use blocks). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | 15 | 18 | +2 | 2 / 1 / 3 |
| all | 15 | 18 | +2 | 2 / 1 / 3 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | 130 | 146 | +14 | 2 / 1 / 3 |
| all | 130 | 146 | +14 | 2 / 1 / 3 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | 3,346 | 4,066 | +638 | 2 / 0 / 4 |
| all | 3,346 | 4,066 | +638 | 2 / 0 / 4 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | 361,895 | 370,323 | +4,771 | 3 / 0 / 3 |
| all | 361,895 | 370,323 | +4,771 | 3 / 0 / 3 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | 23,430 | 18,178 | −5,807 | 6 / 0 / 0 |
| all | 23,430 | 18,178 | −5,807 | 6 / 0 / 0 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | 388,563 | 392,431 | −70 | 3 / 0 / 3 |
| all | 388,563 | 392,431 | −70 | 3 / 0 / 3 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | $0.0983 | $0.0939 | −$0.0072 | 5 / 0 / 1 |
| all | $0.0983 | $0.0939 | −$0.0072 | 5 / 0 / 1 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | 40.9 s | 48.3 s | +6.0 s | 2 / 0 / 4 |
| all | 40.9 s | 48.3 s | +6.0 s | 2 / 0 / 4 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| fastify | $1.27 (12 runs) | $1.17 (12 runs) | none | none |
| all | $1.27 (12 runs) | $1.17 (12 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| fastify/x139 | without | 2/2 | 14 [12–15] | 118 [106–130] | 3,233 [2,816–3,649] | 303,312 [239,010–367,613] | 20,515 [16,328–24,701] | $0.0876 [$0.0707–$0.1045] | 38.2 s [33.0 s–43.3 s] |
| fastify/x139 | with | 2/2 | 19 [15–22] | 146 [114–178] | 4,145 [3,756–4,534] | 370,167 [271,694–468,640] | 17,469 [15,173–19,765] | $0.0928 [$0.0764–$0.1092] | 48.0 s [42.6 s–53.4 s] |
| fastify/x140 | without | 2/2 | 16 [11–20] | 134 [98–170] | 3,738 [2,915–4,560] | 494,510 [396,229–592,790] | 43,669 [40,633–46,704] | $0.1556 [$0.1477–$0.1635] | 47.0 s [36.2 s–57.8 s] |
| fastify/x140 | with | 2/2 | 27 [25–28] | 202 [194–210] | 4,731 [4,349–5,113] | 665,785 [620,059–711,510] | 29,874 [27,769–31,979] | $0.1502 [$0.1395–$0.1609] | 57.3 s [52.7 s–61.9 s] |
| fastify/x141 | without | 2/2 | 15 [11–18] | 126 [98–154] | 2,990 [2,472–3,508] | 365,623 [285,365–445,880] | 25,724 [24,148–27,300] | $0.1031 [$0.0893–$0.1169] | 37.9 s [30.4 s–45.5 s] |
| fastify/x141 | with | 2/2 | 19 [18–20] | 158 [146–170] | 3,987 [3,669–4,305] | 378,747 [349,148–408,345] | 18,543 [17,789–19,296] | $0.0951 [$0.0890–$0.1011] | 48.7 s [43.2 s–54.1 s] |
| fastify/x142 | without | 2/2 | 13 [11–14] | 110 [98–122] | 2,869 [2,723–3,014] | 263,441 [217,701–309,180] | 25,155 [21,131–29,178] | $0.0911 [$0.0884–$0.0938] | 34.4 s [32.8 s–36.0 s] |
| fastify/x142 | with | 2/2 | 11 [9–13] | 90 [82–98] | 2,659 [2,553–2,764] | 230,538 [207,025–254,050] | 19,345 [12,284–26,406] | $0.0751 [$0.0592–$0.0911] | 31.4 s [29.8 s–33.0 s] |
| fastify/x143 | without | 2/2 | 19 [15–22] | 146 [130–162] | 3,459 [3,142–3,775] | 358,168 [295,544–420,792] | 20,891 [20,616–21,165] | $0.0950 [$0.0877–$0.1023] | 43.7 s [41.3 s–46.1 s] |
| fastify/x143 | with | 2/2 | 16 [15–16] | 130 [130–130] | 3,075 [2,851–3,298] | 310,526 [295,892–325,159] | 15,087 [13,781–16,393] | $0.0767 [$0.0715–$0.0819] | 39.9 s [35.6 s–44.2 s] |
| fastify/x144 | without | 2/2 | 17 [15–19] | 146 [130–162] | 4,135 [3,533–4,737] | 374,060 [296,940–451,179] | 21,706 [16,699–26,712] | $0.1016 [$0.0809–$0.1224] | 49.0 s [41.9 s–56.2 s] |
| fastify/x144 | with | 2/2 | 17 [11–23] | 146 [98–194] | 4,498 [3,159–5,837] | 370,478 [218,900–522,056] | 17,813 [12,337–23,288] | $0.0953 [$0.0625–$0.1282] | 51.2 s [39.0 s–63.5 s] |

