# Agent-level A/B — measured tool calls, tokens and cost

**claude-code 2.1.322 (Claude Code) · claude-haiku-5-5 · 2026-11-11 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap ranked the question BEFORE the first turn (what a prompt hook would inject): the five likeliest files with their signatures and line anchors after the question in the user turn, + the sigmap CLI; no MCP server, no standing section, no extra tool call.
- Both arms: the same prompt, model, tool allowlist (Read, Grep, Glob, Bash), per-run budget cap $0.5 and timeout 420 s; run in a clean copy of the commit pinned in `benchmarks/xrepo-repos.json`.
- Questions: the task id(s) x137, x138, x139, x140, x141, x142, x143, x144 of `benchmarks/tasks/retrieval-xrepo.jsonl`. Pass = hit@5 on the repository-relative paths the answer names.
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
| fastify | 8 | 16/16 | 16/16 | 0 / 0 |
| all | 8 | 16/16 | 16/16 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 8. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −42% | −35% | fewer in every repetition |
| Input tokens (uncached) | −26% | −25% | fewer in every repetition |
| Output tokens | −13% | −5% | fewer in every repetition |
| Cache-read tokens | −35% | −24% | fewer in every repetition |
| Cache-write tokens | +6% | −12% | mixed |
| Total tokens (derived) | −28% | −21% | fewer in every repetition |
| Cost | −6% | −12% | fewer in every repetition |
| Wall time | −9% | −11% | fewer in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −33% [−58%, +3%] † | −32% [−49%, −9%] | fewer in every repetition, within the noise |
| Input tokens (uncached) | −21% [−42%, +10%] † | −26% [−38%, −12%] | fewer in every repetition, within the noise |
| Output tokens | −5% [−21%, +12%] † | −5% [−15%, +9%] † | fewer in every repetition, within the noise |
| Cache-read tokens | −23% [−51%, +22%] † | −24% [−42%, −1%] | fewer in every repetition, within the noise |
| Cache-write tokens | +9% [−16%, +40%] † | −12% [−31%, +10%] † | mixed |
| Total tokens (derived) | −17% [−44%, +25%] † | −20% [−37%, +1%] † | fewer in every repetition, within the noise |
| Cost | +1% [−22%, +29%] † | −11% [−25%, +5%] † | mixed |
| Wall time | −4% [−21%, +16%] † | −10% [−16%, −4%] | fewer in every repetition, within the noise |

### Outcome (hit@5), by repetition

Per paired task: **better** = the SigMap arm named the file and the other did not; **worse** = the reverse; **tie** = both found it or both missed. Localisation only.

| repetition | paired tasks | better | worse | tie |
| --- | ---: | ---: | ---: | ---: |
| R1 | 8 | 0 | 0 | 8 |
| R2 | 8 | 0 | 0 | 8 |
| all | 16 | 0 | 0 | 16 |

## Tool calls

Provenance: agent-reported (main-thread tool_use blocks). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | 4 | 2 | −2 | 5 / 2 / 1 |
| all | 4 | 2 | −2 | 5 / 2 / 1 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | 7 | 6 | −2 | 5 / 1 / 2 |
| all | 7 | 6 | −2 | 5 / 1 / 2 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | 1,161 | 1,170 | +17 | 3 / 0 / 5 |
| all | 1,161 | 1,170 | +17 | 3 / 0 / 5 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | 35,980 | 28,125 | −10,562 | 5 / 0 / 3 |
| all | 35,980 | 28,125 | −10,562 | 5 / 0 / 3 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | 7,417 | 7,212 | −148 | 4 / 0 / 4 |
| all | 7,417 | 7,212 | −148 | 4 / 0 / 4 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | 44,597 | 35,654 | −11,459 | 5 / 0 / 3 |
| all | 44,597 | 35,654 | −11,459 | 5 / 0 / 3 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | $0.0024 | $0.0023 | −$0.0001 | 5 / 0 / 3 |
| all | $0.0024 | $0.0023 | −$0.0001 | 5 / 0 / 3 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | 11.2 s | 10.8 s | −383 ms | 4 / 0 / 4 |
| all | 11.2 s | 10.8 s | −383 ms | 4 / 0 / 4 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| fastify | $0.0420 (16 runs) | $0.0384 (16 runs) | none | none |
| all | $0.0420 (16 runs) | $0.0384 (16 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| fastify/x137 | without | 2/2 | 4 [4–4] | 7 [6–8] | 1,087 [1,079–1,095] | 40,043 [31,808–48,277] | 9,888 [9,787–9,988] | $0.0029 [$0.0028–$0.0030] | 10.5 s [10.0 s–11.1 s] |
| fastify/x137 | with | 2/2 | 2 [2–2] | 4 [4–4] | 1,228 [999–1,456] | 18,908 [17,771–20,044] | 6,095 [5,390–6,799] | $0.0020 [$0.0020–$0.0020] | 10.8 s [10.6 s–10.9 s] |
| fastify/x138 | without | 2/2 | 3 [2–3] | 5 [4–6] | 786 [637–935] | 22,354 [16,812–27,896] | 4,849 [4,627–5,070] | $0.0016 [$0.0014–$0.0018] | 8.1 s [7.0 s–9.3 s] |
| fastify/x138 | with | 2/2 | 3 [2–3] | 6 [6–6] | 916 [812–1,020] | 32,369 [30,485–34,252] | 7,325 [7,184–7,465] | $0.0022 [$0.0022–$0.0023] | 9.4 s [9.1 s–9.7 s] |
| fastify/x139 | without | 2/2 | 2 [2–2] | 6 [6–6] | 903 [836–969] | 28,976 [28,413–29,538] | 6,289 [5,785–6,792] | $0.0020 [$0.0019–$0.0021] | 9.4 s [8.5 s–10.4 s] |
| fastify/x139 | with | 2/2 | 2 [2–2] | 4 [4–4] | 919 [908–930] | 18,602 [17,559–19,644] | 6,612 [6,295–6,928] | $0.0020 [$0.0019–$0.0020] | 9.9 s [8.6 s–11.1 s] |
| fastify/x140 | without | 2/2 | 9 [4–14] | 13 [6–20] | 2,238 [1,154–3,321] | 96,477 [29,246–163,707] | 11,794 [8,853–14,735] | $0.0044 [$0.0026–$0.0062] | 17.6 s [11.0 s–24.2 s] |
| fastify/x140 | with | 2/2 | 4 [3–4] | 7 [6–8] | 1,476 [1,019–1,932] | 40,256 [33,799–46,713] | 9,692 [9,219–10,165] | $0.0031 [$0.0027–$0.0035] | 12.1 s [9.6 s–14.6 s] |
| fastify/x141 | without | 2/2 | 5 [4–5] | 7 [6–8] | 1,291 [1,210–1,371] | 34,631 [28,834–40,427] | 7,115 [6,214–8,015] | $0.0024 [$0.0023–$0.0025] | 12.2 s [11.5 s–12.9 s] |
| fastify/x141 | with | 2/2 | 2 [1–3] | 5 [4–6] | 976 [917–1,034] | 23,881 [17,143–30,618] | 5,300 [4,999–5,601] | $0.0018 [$0.0018–$0.0018] | 9.2 s [8.2 s–10.2 s] |
| fastify/x142 | without | 2/2 | 5 [4–5] | 7 [6–8] | 1,096 [963–1,229] | 37,329 [28,121–46,536] | 7,720 [5,950–9,489] | $0.0025 [$0.0020–$0.0030] | 10.3 s [8.9 s–11.7 s] |
| fastify/x142 | with | 2/2 | 4 [3–4] | 7 [6–8] | 1,113 [971–1,254] | 40,212 [32,770–47,654] | 7,100 [4,886–9,314] | $0.0024 [$0.0018–$0.0030] | 10.8 s [10.0 s–11.6 s] |
| fastify/x143 | without | 2/2 | 5 [4–6] | 8 [8–8] | 1,647 [1,427–1,867] | 42,371 [41,715–43,026] | 8,370 [7,784–8,955] | $0.0029 [$0.0027–$0.0032] | 14.0 s [13.4 s–14.6 s] |
| fastify/x143 | with | 2/2 | 2 [2–2] | 4 [4–4] | 1,455 [1,328–1,582] | 18,707 [17,632–19,782] | 10,526 [9,200–11,852] | $0.0030 [$0.0028–$0.0032] | 11.6 s [10.9 s–12.3 s] |
| fastify/x144 | without | 2/2 | 2 [2–2] | 6 [6–6] | 1,225 [1,153–1,297] | 27,946 [27,864–28,028] | 6,699 [6,621–6,777] | $0.0022 [$0.0022–$0.0023] | 11.9 s [10.9 s–12.9 s] |
| fastify/x144 | with | 2/2 | 3 [3–3] | 7 [6–8] | 1,247 [1,239–1,255] | 38,920 [32,226–45,613] | 8,373 [6,655–10,090] | $0.0027 [$0.0023–$0.0031] | 10.9 s [10.7 s–11.1 s] |

