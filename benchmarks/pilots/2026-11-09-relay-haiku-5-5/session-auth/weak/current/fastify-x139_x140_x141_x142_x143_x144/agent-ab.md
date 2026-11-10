# Agent-level A/B — measured tool calls, tokens and cost

**claude-code 2.1.322 (Claude Code) · claude-haiku-4-5 · 2026-11-10 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap generated context + MCP server.
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
| Tool calls | −25% | −29% | fewer in every repetition |
| Input tokens (uncached) | −38% | −37% | fewer in every repetition |
| Output tokens | −32% | −29% | fewer in every repetition |
| Cache-read tokens | −31% | −38% | fewer in every repetition |
| Cache-write tokens | −26% | −45% | fewer in every repetition |
| Total tokens (derived) | −31% | −39% | fewer in every repetition |
| Cost | −29% | −40% | fewer in every repetition |
| Wall time | −30% | −27% | fewer in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −25% [−53%, +24%] † | −28% [−46%, −5%] | fewer in every repetition, within the noise |
| Input tokens (uncached) | −40% [−63%, +3%] † | −38% [−60%, −10%] | fewer in every repetition, within the noise |
| Output tokens | −30% [−53%, +4%] † | −28% [−46%, −6%] | fewer in every repetition, within the noise |
| Cache-read tokens | −34% [−67%, +56%] † | −41% [−63%, −10%] | fewer in every repetition, within the noise |
| Cache-write tokens | −27% [−50%, +12%] † | −46% [−56%, −32%] | fewer in every repetition, within the noise |
| Total tokens (derived) | −33% [−66%, +52%] † | −41% [−62%, −11%] | fewer in every repetition, within the noise |
| Cost | −30% [−56%, +25%] † | −41% [−55%, −22%] | fewer in every repetition, within the noise |
| Wall time | −29% [−51%, +4%] † | −26% [−44%, −5%] | fewer in every repetition, within the noise |

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
| fastify | 18 | 14 | −4 | 4 / 0 / 2 |
| all | 18 | 14 | −4 | 4 / 0 / 2 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | 156 | 96 | −60 | 4 / 0 / 2 |
| all | 156 | 96 | −60 | 4 / 0 / 2 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | 3,949 | 3,098 | −797 | 4 / 0 / 2 |
| all | 3,949 | 3,098 | −797 | 4 / 0 / 2 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | 428,537 | 302,856 | −150,686 | 3 / 0 / 3 |
| all | 428,537 | 302,856 | −150,686 | 3 / 0 / 3 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | 24,541 | 18,282 | −9,044 | 6 / 0 / 0 |
| all | 24,541 | 18,282 | −9,044 | 6 / 0 / 0 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | 457,507 | 327,043 | −158,932 | 3 / 0 / 3 |
| all | 457,507 | 327,043 | −158,932 | 3 / 0 / 3 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | $0.1164 | $0.0846 | −$0.0437 | 5 / 0 / 1 |
| all | $0.1164 | $0.0846 | −$0.0437 | 5 / 0 / 1 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | 48.1 s | 38.6 s | −10.4 s | 5 / 0 / 1 |
| all | 48.1 s | 38.6 s | −10.4 s | 5 / 0 / 1 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| fastify | $1.48 (12 runs) | $0.9705 (12 runs) | none | none |
| all | $1.48 (12 runs) | $0.9705 (12 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| fastify/x139 | without | 2/2 | 16 [15–16] | 134 [130–138] | 3,340 [3,273–3,406] | 336,267 [327,426–345,108] | 22,690 [20,960–24,420] | $0.0958 [$0.0918–$0.0999] | 39.6 s [39.2 s–40.0 s] |
| fastify/x139 | with | 2/2 | 14 [13–14] | 110 [98–122] | 3,011 [2,792–3,229] | 354,221 [327,533–380,909] | 20,998 [18,666–23,330] | $0.0926 [$0.0917–$0.0935] | 37.7 s [35.6 s–39.8 s] |
| fastify/x140 | without | 2/2 | 21 [20–22] | 178 [170–186] | 4,725 [4,693–4,756] | 728,302 [620,978–835,625] | 42,071 [35,361–48,781] | $0.1808 [$0.1568–$0.2048] | 58.4 s [58.0 s–58.8 s] |
| fastify/x140 | with | 2/2 | 15 [13–16] | 82 [74–90] | 3,460 [3,435–3,485] | 251,490 [232,595–270,385] | 20,715 [18,983–22,446] | $0.0840 [$0.0823–$0.0857] | 39.5 s [39.4 s–39.6 s] |
| fastify/x141 | without | 2/2 | 15 [13–16] | 126 [114–138] | 3,138 [3,121–3,154] | 346,986 [337,748–356,223] | 24,053 [20,947–27,159] | $0.0986 [$0.0914–$0.1058] | 40.9 s [40.4 s–41.5 s] |
| fastify/x141 | with | 2/2 | 16 [15–16] | 134 [130–138] | 3,186 [3,125–3,246] | 375,212 [370,617–379,806] | 15,850 [15,830–15,869] | $0.0853 [$0.0851–$0.0855] | 40.6 s [38.4 s–42.9 s] |
| fastify/x142 | without | 2/2 | 13 [10–15] | 110 [90–130] | 3,260 [2,763–3,756] | 288,840 [185,266–392,413] | 25,028 [18,937–31,119] | $0.0953 [$0.0703–$0.1204] | 38.2 s [33.3 s–43.0 s] |
| fastify/x142 | with | 2/2 | 18 [13–22] | 134 [114–154] | 3,835 [3,713–3,956] | 495,576 [294,830–696,321] | 23,610 [12,305–34,915] | $0.1161 [$0.0728–$0.1594] | 46.9 s [42.5 s–51.3 s] |
| fastify/x143 | without | 2/2 | 24 [22–26] | 202 [186–218] | 4,559 [3,983–5,134] | 579,685 [504,619–654,750] | 26,936 [26,210–27,662] | $0.1348 [$0.1230–$0.1467] | 55.2 s [48.5 s–61.9 s] |
| fastify/x143 | with | 2/2 | 10 [9–11] | 62 [50–74] | 1,900 [1,719–2,080] | 153,143 [112,882–193,404] | 11,164 [10,338–11,990] | $0.0472 [$0.0406–$0.0538] | 23.1 s [22.0 s–24.2 s] |
| fastify/x144 | without | 2/2 | 24 [23–24] | 198 [194–202] | 7,368 [7,210–7,526] | 510,089 [482,012–538,166] | 23,057 [21,024–25,089] | $0.1342 [$0.1265–$0.1418] | 79.5 s [79.1 s–79.9 s] |
| fastify/x144 | with | 2/2 | 10 [8–12] | 70 [50–90] | 2,933 [2,396–3,470] | 190,763 [121,899–259,627] | 13,172 [11,477–14,867] | $0.0602 [$0.0472–$0.0731] | 35.1 s [29.8 s–40.4 s] |

