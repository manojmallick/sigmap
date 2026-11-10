# Agent-level A/B — measured tool calls, tokens and cost

**claude-code 2.1.322 (Claude Code) · claude-haiku-4-5 · 2026-11-10 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap index strategy + 7-tool core MCP profile (the docs' setup for an agent that calls the tools).
- Both arms: the same prompt, model, tool allowlist (Read, Grep, Glob, Bash), per-run budget cap $1 and timeout 420 s; run in a clean copy of the commit pinned in `benchmarks/xrepo-repos.json`.
- Questions: the task id(s) x147, x148, x149, x150, x151, x152 of `benchmarks/tasks/retrieval-xrepo.jsonl`. Pass = hit@5 on the repository-relative paths the answer names.
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
| fastapi | 6 | 12/12 | 12/12 | 0 / 0 |
| all | 6 | 12/12 | 12/12 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 6. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −17% | −33% | fewer in every repetition |
| Input tokens (uncached) | −15% | −36% | fewer in every repetition |
| Output tokens | −12% | −21% | fewer in every repetition |
| Cache-read tokens | −21% | −40% | fewer in every repetition |
| Cache-write tokens | −31% | −23% | fewer in every repetition |
| Total tokens (derived) | −21% | −39% | fewer in every repetition |
| Cost | −25% | −29% | fewer in every repetition |
| Wall time | −6% | −17% | fewer in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −28% [−52%, +13%] † | −30% [−47%, −4%] | fewer in every repetition, within the noise |
| Input tokens (uncached) | −25% [−49%, +12%] † | −32% [−54%, −4%] | fewer in every repetition, within the noise |
| Output tokens | −19% [−43%, +17%] † | −19% [−39%, +4%] † | fewer in every repetition, within the noise |
| Cache-read tokens | −33% [−58%, +8%] † | −32% [−64%, +13%] † | fewer in every repetition, within the noise |
| Cache-write tokens | −31% [−51%, −10%] | −22% [−49%, 0%] | fewer in every repetition, outside the noise |
| Total tokens (derived) | −32% [−56%, +5%] † | −31% [−63%, +13%] † | fewer in every repetition, within the noise |
| Cost | −28% [−46%, −5%] | −25% [−53%, +4%] † | fewer in every repetition, within the noise |
| Wall time | −12% [−35%, +24%] † | −15% [−33%, +6%] † | fewer in every repetition, within the noise |

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
| fastapi | 13 | 10 | −3 | 6 / 0 / 0 |
| all | 13 | 10 | −3 | 6 / 0 / 0 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | 112 | 86 | −26 | 6 / 0 / 0 |
| all | 112 | 86 | −26 | 6 / 0 / 0 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | 3,042 | 2,551 | −595 | 5 / 0 / 1 |
| all | 3,042 | 2,551 | −595 | 5 / 0 / 1 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | 325,674 | 253,047 | −81,279 | 5 / 0 / 1 |
| all | 325,674 | 253,047 | −81,279 | 5 / 0 / 1 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | 24,663 | 19,459 | −4,133 | 6 / 0 / 0 |
| all | 24,663 | 19,459 | −4,133 | 6 / 0 / 0 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | 353,509 | 279,679 | −84,893 | 5 / 0 / 1 |
| all | 353,509 | 279,679 | −84,893 | 5 / 0 / 1 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | $0.0972 | $0.0819 | −$0.0171 | 6 / 0 / 0 |
| all | $0.0972 | $0.0819 | −$0.0171 | 6 / 0 / 0 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | 38.5 s | 32.6 s | −6.4 s | 4 / 0 / 2 |
| all | 38.5 s | 32.6 s | −6.4 s | 4 / 0 / 2 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| fastapi | $1.17 (12 runs) | $0.8532 (12 runs) | none | none |
| all | $1.17 (12 runs) | $0.8532 (12 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| fastapi/x147 | without | 2/2 | 13 [12–14] | 114 [106–122] | 2,792 [2,607–2,976] | 293,673 [260,928–326,417] | 26,443 [23,202–29,683] | $0.0963 [$0.0856–$0.1070] | 37.8 s [33.8 s–41.8 s] |
| fastapi/x147 | with | 2/2 | 9 [7–10] | 78 [66–90] | 2,409 [2,003–2,814] | 195,866 [147,433–244,298] | 23,041 [22,604–23,477] | $0.0778 [$0.0700–$0.0855] | 32.0 s [27.5 s–36.4 s] |
| fastapi/x148 | without | 2/2 | 9 [7–11] | 70 [66–74] | 1,786 [1,614–1,958] | 119,380 [104,929–133,831] | 12,117 [10,523–13,711] | $0.0452 [$0.0397–$0.0507] | 22.7 s [21.1 s–24.3 s] |
| fastapi/x148 | with | 2/2 | 7 [5–9] | 66 [50–82] | 1,724 [1,565–1,882] | 142,508 [100,982–184,034] | 10,943 [10,647–11,238] | $0.0448 [$0.0393–$0.0504] | 23.0 s [20.3 s–25.7 s] |
| fastapi/x149 | without | 2/2 | 6 [4–8] | 58 [42–74] | 1,696 [1,444–1,948] | 104,742 [61,936–147,547] | 14,440 [13,510–15,369] | $0.0479 [$0.0405–$0.0553] | 21.4 s [19.5 s–23.3 s] |
| fastapi/x149 | with | 2/2 | 3 [2–3] | 26 [26–26] | 879 [860–897] | 39,992 [39,876–40,107] | 11,881 [11,784–11,977] | $0.0322 [$0.0321–$0.0323] | 13.3 s [13.1 s–13.5 s] |
| fastapi/x150 | without | 2/2 | 17 [8–26] | 146 [74–218] | 3,292 [2,094–4,489] | 357,676 [170,338–545,013] | 22,884 [20,956–24,812] | $0.0981 [$0.0772–$0.1191] | 39.1 s [26.1 s–52.1 s] |
| fastapi/x150 | with | 2/2 | 15 [14–15] | 126 [122–130] | 3,462 [3,427–3,496] | 326,193 [308,126–344,259] | 18,020 [16,689–19,351] | $0.0861 [$0.0818–$0.0904] | 42.9 s [41.5 s–44.2 s] |
| fastapi/x151 | without | 2/2 | 23 [17–28] | 190 [146–234] | 4,418 [3,392–5,443] | 659,287 [459,809–858,764] | 33,649 [27,669–39,628] | $0.1555 [$0.1184–$0.1926] | 50.4 s [38.4 s–62.5 s] |
| fastapi/x151 | with | 2/2 | 16 [12–19] | 114 [66–162] | 3,348 [2,560–4,136] | 325,705 [133,022–518,388] | 20,897 [11,225–30,569] | $0.0912 [$0.0486–$0.1338] | 42.2 s [31.8 s–52.6 s] |
| fastapi/x152 | without | 2/2 | 13 [12–13] | 110 [106–114] | 3,500 [2,991–4,009] | 433,699 [400,755–466,642] | 40,563 [40,036–41,089] | $0.1421 [$0.1418–$0.1424] | 40.2 s [35.0 s–45.4 s] |
| fastapi/x152 | with | 2/2 | 11 [10–12] | 94 [82–106] | 2,694 [2,336–3,051] | 310,228 [186,511–433,945] | 24,951 [13,192–36,709] | $0.0945 [$0.0568–$0.1322] | 33.2 s [30.1 s–36.3 s] |

