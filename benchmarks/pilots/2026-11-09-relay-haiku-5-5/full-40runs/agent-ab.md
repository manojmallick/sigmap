# Agent-level A/B — measured tool calls, tokens and cost

**claude-code 2.1.319 (Claude Code) · claude-haiku-5.5 · 2026-11-09 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap generated context + MCP server.
- Both arms: the same prompt, model, tool allowlist (Read, Grep, Glob, Bash), per-run budget cap $0.3 and timeout 420 s; run in a clean copy of the commit pinned in `benchmarks/xrepo-repos.json`.
- Questions: first 2 task(s) by id per repo of `benchmarks/tasks/retrieval-xrepo.jsonl`. Pass = hit@5 on the repository-relative paths the answer names.
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

## Outcome

| repo | tasks | pass without | pass with | failed runs (without / with) |
| --- | ---: | ---: | ---: | ---: |
| gin | 2 | 4/4 | 4/4 | 0 / 0 |
| flask | 2 | 3/4 | 4/4 | 0 / 0 |
| express | 2 | 4/4 | 4/4 | 0 / 0 |
| fastify | 2 | 4/4 | 4/4 | 0 / 0 |
| fastapi | 2 | 3/4 | 4/4 | 0 / 0 |
| all | 10 | 18/20 | 20/20 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 10. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | 0% | +11% | mixed |
| Input tokens (uncached) | +2% | +29% | more in every repetition |
| Output tokens | −22% | +10% | mixed |
| Cache-read tokens | +72% | +126% | more in every repetition |
| Total tokens (derived) | +12% | +42% | more in every repetition |
| Cost | 0% | +29% | more in every repetition |
| Wall time | −21% | +10% | mixed |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −11% [−40%, +32%] † | +7% [−29%, +62%] † | mixed |
| Input tokens (uncached) | −3% [−38%, +53%] † | +59% [−20%, +198%] † | mixed |
| Output tokens | −20% [−44%, +16%] † | +28% [−21%, +95%] † | mixed |
| Cache-read tokens | +58% [+10%, +130%] | +128% [+44%, +242%] | more in every repetition, outside the noise |
| Total tokens (derived) | +7% [−31%, +63%] † | +68% [−11%, +198%] † | more in every repetition, within the noise |
| Cost | −4% [−37%, +47%] † | +57% [−18%, +186%] † | mixed |
| Wall time | −23% [−45%, +7%] † | +13% [−19%, +52%] † | mixed |

### Outcome (hit@5), by repetition

Per paired task: **better** = the SigMap arm named the file and the other did not; **worse** = the reverse; **tie** = both found it or both missed. Localisation only.

| repetition | paired tasks | better | worse | tie |
| --- | ---: | ---: | ---: | ---: |
| R1 | 10 | 0 | 0 | 10 |
| R2 | 10 | 2 | 0 | 8 |
| all | 20 | 2 | 0 | 18 |

## Tool calls

Provenance: agent-reported (main-thread tool_use blocks). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 11 | 10 | −1 | 1 / 0 / 1 |
| flask | 18 | 15 | −3 | 1 / 0 / 1 |
| express | 10 | 12 | +2 | 1 / 0 / 1 |
| fastify | 12 | 11 | −1 | 1 / 0 / 1 |
| fastapi | 15 | 21 | +6 | 1 / 0 / 1 |
| all | 12 | 12 | −1 | 5 / 0 / 5 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 38,583 | 72,712 | +34,130 | 0 / 0 / 2 |
| flask | 206,976 | 162,681 | −44,296 | 1 / 0 / 1 |
| express | 38,293 | 68,282 | +29,989 | 0 / 0 / 2 |
| fastify | 113,181 | 83,054 | −30,127 | 1 / 0 / 1 |
| fastapi | 91,138 | 178,359 | +87,222 | 1 / 0 / 1 |
| all | 76,040 | 92,047 | +26,010 | 3 / 0 / 7 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 536 | 445 | −92 | 1 / 0 / 1 |
| flask | 1,098 | 573 | −525 | 2 / 0 / 0 |
| express | 479 | 588 | +109 | 1 / 0 / 1 |
| fastify | 693 | 569 | −124 | 1 / 0 / 1 |
| fastapi | 454 | 852 | +398 | 0 / 0 / 2 |
| all | 595 | 569 | −6 | 5 / 0 / 5 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 9,454 | 23,497 | +14,043 | 0 / 0 / 2 |
| flask | 23,788 | 43,625 | +19,837 | 0 / 0 / 2 |
| express | 8,664 | 22,503 | +13,840 | 0 / 0 / 2 |
| fastify | 21,213 | 23,062 | +1,850 | 1 / 0 / 1 |
| fastapi | 14,262 | 39,647 | +25,386 | 1 / 0 / 1 |
| all | 14,262 | 27,586 | +10,847 | 2 / 0 / 8 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 0 | 0 | 0 | 0 / 2 / 0 |
| flask | 0 | 0 | 0 | 0 / 2 / 0 |
| express | 0 | 0 | 0 | 0 / 2 / 0 |
| fastify | 0 | 0 | 0 | 0 / 2 / 0 |
| fastapi | 0 | 0 | 0 | 0 / 2 / 0 |
| all | 0 | 0 | 0 | 0 / 10 / 0 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 48,573 | 96,654 | +48,081 | 0 / 0 / 2 |
| flask | 231,862 | 206,879 | −24,984 | 1 / 0 / 1 |
| express | 47,435 | 91,373 | +43,937 | 0 / 0 / 2 |
| fastify | 135,086 | 106,684 | −28,402 | 1 / 0 / 1 |
| fastapi | 105,853 | 218,859 | +113,006 | 1 / 0 / 1 |
| all | 93,476 | 120,167 | +34,668 | 3 / 0 / 7 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | $0.0042 | $0.0077 | +$0.0035 | 0 / 0 / 2 |
| flask | $0.0215 | $0.0166 | −$0.0049 | 1 / 0 / 1 |
| express | $0.0042 | $0.0072 | +$0.0031 | 0 / 0 / 2 |
| fastify | $0.0119 | $0.0088 | −$0.0031 | 1 / 0 / 1 |
| fastapi | $0.0095 | $0.0184 | +$0.0089 | 1 / 0 / 1 |
| all | $0.0081 | $0.0097 | +$0.0026 | 3 / 0 / 7 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 88.4 s | 86.3 s | −2.1 s | 1 / 0 / 1 |
| flask | 149.1 s | 108.7 s | −40.4 s | 1 / 0 / 1 |
| express | 89.0 s | 81.6 s | −7.5 s | 1 / 0 / 1 |
| fastify | 81.2 s | 77.0 s | −4.2 s | 1 / 0 / 1 |
| fastapi | 109.7 s | 135.9 s | +26.2 s | 1 / 0 / 1 |
| all | 95.2 s | 81.6 s | −3.4 s | 5 / 0 / 5 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| gin | $0.0169 (4 runs) | $0.0309 (4 runs) | none | none |
| flask | $0.0859 (4 runs) | $0.0663 (4 runs) | none | none |
| express | $0.0166 (4 runs) | $0.0289 (4 runs) | none | none |
| fastify | $0.0475 (4 runs) | $0.0353 (4 runs) | none | none |
| fastapi | $0.0379 (4 runs) | $0.0736 (4 runs) | none | none |
| all | $0.2049 (20 runs) | $0.2350 (20 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| gin/x001 | without | 2/2 | 15 [12–17] | 44,457 [34,975–53,938] | 620 [496–744] | 7,932 [7,866–7,998] | 0 [0–0] | $0.0048 [$0.0039–$0.0057] | 113.1 s [104.3 s–122.0 s] |
| gin/x001 | with | 2/2 | 11 [6–16] | 95,019 [50,677–139,361] | 387 [260–513] | 28,706 [17,373–40,039] | 0 [0–0] | $0.0100 [$0.0054–$0.0146] | 101.2 s [63.3 s–139.2 s] |
| gin/x002 | without | 2/2 | 7 [6–8] | 32,709 [15,416–50,001] | 453 [357–548] | 10,976 [5,740–16,212] | 0 [0–0] | $0.0036 [$0.0019–$0.0053] | 63.6 s [44.7 s–82.5 s] |
| gin/x002 | with | 2/2 | 9 [9–9] | 50,405 [46,862–53,948] | 503 [381–625] | 18,288 [17,430–19,146] | 0 [0–0] | $0.0055 [$0.0052–$0.0058] | 71.3 s [64.9 s–77.7 s] |
| flask/x032 | without | 1/2 | 26 [23–28] | 347,092 [329,324–364,860] | 1,531 [1,177–1,884] | 30,582 [28,621–32,542] | 0 [0–0] | $0.0358 [$0.0342–$0.0374] | 203.1 s [185.0 s–221.3 s] |
| flask/x032 | with | 2/2 | 12 [11–13] | 122,970 [101,125–144,815] | 544 [502–585] | 34,195 [30,607–37,783] | 0 [0–0] | $0.0129 [$0.0107–$0.0152] | 74.2 s [61.3 s–87.1 s] |
| flask/x033 | without | 2/2 | 11 [8–13] | 66,861 [63,748–69,973] | 665 [537–793] | 16,995 [13,379–20,611] | 0 [0–0] | $0.0072 [$0.0070–$0.0074] | 95.0 s [79.1 s–111.0 s] |
| flask/x033 | with | 2/2 | 19 [18–19] | 202,392 [196,599–208,184] | 603 [357–848] | 53,055 [46,595–59,514] | 0 [0–0] | $0.0203 [$0.0188–$0.0217] | 143.1 s [107.9 s–178.3 s] |
| express/x037 | without | 2/2 | 11 [8–14] | 41,251 [22,794–59,708] | 570 [211–929] | 7,151 [6,208–8,094] | 0 [0–0] | $0.0045 [$0.0024–$0.0065] | 95.4 s [64.2 s–126.6 s] |
| express/x037 | with | 2/2 | 8 [5–11] | 47,490 [31,449–63,530] | 492 [459–524] | 18,541 [10,504–26,578] | 0 [0–0] | $0.0049 [$0.0035–$0.0063] | 75.4 s [74.2 s–76.6 s] |
| express/x038 | without | 2/2 | 9 [6–11] | 35,335 [18,117–52,553] | 388 [340–435] | 10,176 [8,717–11,635] | 0 [0–0] | $0.0038 [$0.0021–$0.0056] | 82.6 s [58.8 s–106.4 s] |
| express/x038 | with | 2/2 | 16 [13–18] | 89,074 [65,433–112,715] | 684 [519–849] | 26,465 [20,042–32,888] | 0 [0–0] | $0.0095 [$0.0070–$0.0120] | 87.8 s [60.8 s–114.7 s] |
| fastify/x137 | without | 2/2 | 10 [9–11] | 85,219 [76,035–94,402] | 913 [882–943] | 19,742 [18,641–20,843] | 0 [0–0] | $0.0092 [$0.0083–$0.0101] | 72.5 s [57.7 s–87.4 s] |
| fastify/x137 | with | 2/2 | 15 [11–18] | 119,543 [57,139–181,946] | 561 [424–698] | 30,046 [19,209–40,883] | 0 [0–0] | $0.0125 [$0.0063–$0.0188] | 93.6 s [69.1 s–118.1 s] |
| fastify/x138 | without | 2/2 | 14 [12–15] | 141,143 [76,356–205,930] | 473 [389–557] | 22,683 [15,747–29,619] | 0 [0–0] | $0.0146 [$0.0081–$0.0211] | 89.9 s [81.0 s–98.7 s] |
| fastify/x138 | with | 2/2 | 8 [8–8] | 46,565 [37,584–55,545] | 576 [349–803] | 16,079 [13,961–18,196] | 0 [0–0] | $0.0051 [$0.0043–$0.0059] | 60.4 s [52.0 s–68.9 s] |
| fastapi/x145 | without | 1/2 | 15 [10–20] | 88,046 [68,438–107,654] | 263 [238–288] | 14,123 [12,793–15,453] | 0 [0–0] | $0.0091 [$0.0071–$0.0110] | 113.3 s [56.2 s–170.5 s] |
| fastapi/x145 | with | 2/2 | 7 [3–10] | 44,719 [27,040–62,397] | 626 [616–636] | 14,045 [9,980–18,109] | 0 [0–0] | $0.0049 [$0.0031–$0.0067] | 68.1 s [41.3 s–94.9 s] |
| fastapi/x146 | without | 2/2 | 15 [14–15] | 94,229 [69,750–118,708] | 645 [480–810] | 14,401 [12,357–16,444] | 0 [0–0] | $0.0099 [$0.0073–$0.0124] | 106.1 s [95.6 s–116.7 s] |
| fastapi/x146 | with | 2/2 | 35 [32–37] | 312,000 [282,124–341,876] | 1,079 [980–1,177] | 65,250 [65,109–65,391] | 0 [0–0] | $0.0319 [$0.0285–$0.0353] | 203.7 s [180.5 s–226.8 s] |

