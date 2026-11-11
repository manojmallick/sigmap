# Agent-level A/B — measured tool calls, tokens and cost

**claude-code 2.1.322 (Claude Code) · claude-haiku-5-5 · 2026-11-11 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap index strategy + 7-tool core MCP profile (the docs' setup for an agent that calls the tools).
- Both arms: the same prompt, model, tool allowlist (Read, Grep, Glob, Bash), per-run budget cap $0.5 and timeout 420 s; run in a clean copy of the commit pinned in `benchmarks/xrepo-repos.json`.
- Questions: the task id(s) h001, h002, h003, h004, h005, h006, h007, h008 of `benchmarks/tasks/retrieval-xrepo.jsonl`. Pass = hit@5 on the repository-relative paths the answer names.
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
| sigmap-src | 8 | 12/16 | 11/16 | 0 / 0 |
| all | 8 | 12/16 | 11/16 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 8. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −43% | −60% | fewer in every repetition |
| Input tokens (uncached) | −41% | −57% | fewer in every repetition |
| Output tokens | −49% | −61% | fewer in every repetition |
| Cache-read tokens | −37% | −60% | fewer in every repetition |
| Cache-write tokens | −30% | −53% | fewer in every repetition |
| Total tokens (derived) | −37% | −59% | fewer in every repetition |
| Cost | −36% | −56% | fewer in every repetition |
| Wall time | −33% | −48% | fewer in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −56% [−77%, −19%] | −55% [−74%, −27%] n=6 | fewer in every repetition, outside the noise |
| Input tokens (uncached) | −43% [−56%, −26%] | −57% [−71%, −39%] | fewer in every repetition, outside the noise |
| Output tokens | −48% [−62%, −29%] | −58% [−68%, −47%] | fewer in every repetition, outside the noise |
| Cache-read tokens | −40% [−59%, −13%] | −59% [−75%, −35%] | fewer in every repetition, outside the noise |
| Cache-write tokens | −30% [−46%, −9%] | −53% [−65%, −40%] | fewer in every repetition, outside the noise |
| Total tokens (derived) | −39% [−57%, −13%] | −59% [−73%, −38%] | fewer in every repetition, outside the noise |
| Cost | −36% [−52%, −15%] | −56% [−67%, −43%] | fewer in every repetition, outside the noise |
| Wall time | −31% [−45%, −16%] | −45% [−55%, −32%] | fewer in every repetition, outside the noise |

### Outcome (hit@5), by repetition

Per paired task: **better** = the SigMap arm named the file and the other did not; **worse** = the reverse; **tie** = both found it or both missed. Localisation only.

| repetition | paired tasks | better | worse | tie |
| --- | ---: | ---: | ---: | ---: |
| R1 | 8 | 0 | 0 | 8 |
| R2 | 8 | 0 | 1 | 7 |
| all | 16 | 0 | 1 | 15 |

## Tool calls

Provenance: agent-reported (main-thread tool_use blocks). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 6 | 2 | −3 | 6 / 2 / 0 |
| all | 6 | 2 | −3 | 6 / 2 / 0 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 11 | 5 | −4 | 8 / 0 / 0 |
| all | 11 | 5 | −4 | 8 / 0 / 0 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 1,833 | 757 | −783 | 8 / 0 / 0 |
| all | 1,833 | 757 | −783 | 8 / 0 / 0 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 63,204 | 28,948 | −25,901 | 6 / 0 / 2 |
| all | 63,204 | 28,948 | −25,901 | 6 / 0 / 2 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 11,533 | 5,850 | −4,413 | 8 / 0 / 0 |
| all | 11,533 | 5,850 | −4,413 | 8 / 0 / 0 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 77,013 | 36,542 | −31,478 | 7 / 0 / 1 |
| all | 77,013 | 36,542 | −31,478 | 7 / 0 / 1 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | $0.0038 | $0.0019 | −$0.0016 | 8 / 0 / 0 |
| all | $0.0038 | $0.0019 | −$0.0016 | 8 / 0 / 0 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 15.3 s | 9.6 s | −4.6 s | 8 / 0 / 0 |
| all | 15.3 s | 9.6 s | −4.6 s | 8 / 0 / 0 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | $0.0621 (16 runs) | $0.0328 (16 runs) | none | none |
| all | $0.0621 (16 runs) | $0.0328 (16 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| sigmap-src/h001 | without | 2/2 | 6 [5–6] | 10 [10–10] | 1,510 [1,406–1,614] | 54,061 [53,735–54,387] | 9,747 [9,564–9,930] | $0.0032 [$0.0032–$0.0033] | 13.3 s [12.3 s–14.3 s] |
| sigmap-src/h001 | with | 2/2 | 6 [4–7] | 8 [6–10] | 1,231 [860–1,602] | 55,969 [35,928–76,009] | 8,917 [6,419–11,414] | $0.0030 [$0.0021–$0.0038] | 11.5 s [8.8 s–14.3 s] |
| sigmap-src/h002 | without | 0/2 | 13 [7–18] | 18 [16–20] | 4,508 [3,743–5,272] | 128,079 [103,815–152,343] | 15,461 [14,734–16,188] | $0.0066 [$0.0059–$0.0074] | 29.2 s [26.2 s–32.1 s] |
| sigmap-src/h002 | with | 0/2 | 8 [7–9] | 8 [8–8] | 1,545 [1,351–1,739] | 52,727 [51,847–53,606] | 9,477 [8,563–10,390] | $0.0032 [$0.0029–$0.0035] | 12.5 s [11.9 s–13.1 s] |
| sigmap-src/h003 | without | 2/2 | 7 [6–8] | 12 [10–14] | 2,402 [2,397–2,406] | 72,346 [60,614–84,078] | 13,938 [13,036–14,840] | $0.0047 [$0.0046–$0.0048] | 19.4 s [18.8 s–20.1 s] |
| sigmap-src/h003 | with | 1/2 | 1 [0–1] | 3 [2–4] | 703 [543–863] | 15,050 [9,266–20,834] | 4,268 [2,946–5,590] | $0.0014 [$0.0010–$0.0018] | 9.4 s [6.6 s–12.3 s] |
| sigmap-src/h004 | without | 2/2 | 7 [5–8] | 12 [10–14] | 2,156 [1,702–2,609] | 80,362 [54,670–106,054] | 13,857 [7,733–19,980] | $0.0047 [$0.0029–$0.0064] | 17.2 s [14.4 s–20.1 s] |
| sigmap-src/h004 | with | 2/2 | 3 [2–3] | 7 [6–8] | 1,114 [978–1,250] | 42,274 [35,364–49,183] | 6,383 [6,172–6,594] | $0.0023 [$0.0021–$0.0024] | 11.0 s [9.8 s–12.3 s] |
| sigmap-src/h005 | without | 2/2 | 4 [3–4] | 7 [6–8] | 1,098 [1,019–1,177] | 34,862 [28,140–41,583] | 7,558 [7,096–8,019] | $0.0024 [$0.0022–$0.0026] | 10.1 s [9.2 s–11.1 s] |
| sigmap-src/h005 | with | 2/2 | 2 [1–2] | 4 [4–4] | 708 [558–857] | 21,149 [20,824–21,474] | 5,316 [5,126–5,506] | $0.0016 [$0.0015–$0.0017] | 8.5 s [7.4 s–9.6 s] |
| sigmap-src/h006 | without | 2/2 | 4 [4–4] | 7 [6–8] | 1,330 [1,322–1,337] | 35,232 [28,876–41,587] | 11,192 [7,664–14,719] | $0.0033 [$0.0026–$0.0039] | 12.2 s [11.8 s–12.5 s] |
| sigmap-src/h006 | with | 2/2 | 4 [4–4] | 6 [6–6] | 806 [730–881] | 36,746 [36,260–37,232] | 8,350 [7,788–8,911] | $0.0024 [$0.0024–$0.0025] | 9.7 s [9.5 s–9.9 s] |
| sigmap-src/h007 | without | 0/2 | 3 [2–3] | 6 [6–6] | 884 [848–919] | 27,082 [27,030–27,133] | 5,443 [5,327–5,559] | $0.0018 [$0.0018–$0.0018] | 9.9 s [9.2 s–10.6 s] |
| sigmap-src/h007 | with | 0/2 | 1 [0–1] | 3 [2–4] | 513 [461–564] | 15,049 [9,260–20,838] | 3,466 [2,946–3,985] | $0.0011 [$0.0009–$0.0013] | 6.8 s [6.3 s–7.4 s] |
| sigmap-src/h008 | without | 2/2 | 8 [7–9] | 13 [12–14] | 2,239 [2,220–2,258] | 85,503 [79,686–91,319] | 11,875 [11,259–12,491] | $0.0044 [$0.0043–$0.0044] | 17.8 s [16.9 s–18.8 s] |
| sigmap-src/h008 | with | 2/2 | 1 [1–1] | 4 [4–4] | 577 [513–640] | 21,139 [20,821–21,456] | 4,840 [4,600–5,079] | $0.0015 [$0.0015–$0.0015] | 7.6 s [7.3 s–7.8 s] |

