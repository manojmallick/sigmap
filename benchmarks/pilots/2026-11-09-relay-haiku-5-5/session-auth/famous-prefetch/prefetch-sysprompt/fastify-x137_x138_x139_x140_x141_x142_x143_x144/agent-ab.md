# Agent-level A/B — measured tool calls, tokens and cost

**claude-code 2.1.322 (Claude Code) · claude-haiku-5-5 · 2026-11-11 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap ranked the question BEFORE the first turn (what a prompt hook would inject): the five likeliest files with their signatures and line anchors in the prompt, + the sigmap CLI; no MCP server, no standing section, no extra tool call.
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
| Tool calls | −32% | −34% | fewer in every repetition |
| Input tokens (uncached) | −33% | −23% | fewer in every repetition |
| Output tokens | −5% | +16% | mixed |
| Cache-read tokens | −43% | −19% | fewer in every repetition |
| Cache-write tokens | +18% | −8% | mixed |
| Total tokens (derived) | −32% | −16% | fewer in every repetition |
| Cost | +4% | −4% | mixed |
| Wall time | −9% | −1% | fewer in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −29% [−47%, −1%] | −35% [−50%, −12%] | fewer in every repetition, outside the noise |
| Input tokens (uncached) | −33% [−45%, −14%] | −23% [−33%, −10%] | fewer in every repetition, outside the noise |
| Output tokens | −2% [−16%, +17%] † | +12% [−7%, +43%] † | mixed |
| Cache-read tokens | −43% [−58%, −19%] | −19% [−33%, 0%] | fewer in every repetition, outside the noise |
| Cache-write tokens | +20% [+4%, +38%] | −10% [−23%, +4%] † | mixed |
| Total tokens (derived) | −30% [−45%, −9%] | −16% [−29%, 0%] | fewer in every repetition, outside the noise |
| Cost | +6% [−9%, +24%] † | −6% [−19%, +9%] † | mixed |
| Wall time | −8% [−17%, +2%] † | −3% [−15%, +14%] † | fewer in every repetition, within the noise |

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
| fastify | 3 | 2 | −1 | 7 / 0 / 1 |
| all | 3 | 2 | −1 | 7 / 0 / 1 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | 7 | 5 | −3 | 7 / 0 / 1 |
| all | 7 | 5 | −3 | 7 / 0 / 1 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | 1,265 | 1,169 | +5 | 3 / 0 / 5 |
| all | 1,265 | 1,169 | +5 | 3 / 0 / 5 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | 35,882 | 20,732 | −15,740 | 7 / 0 / 1 |
| all | 35,882 | 20,732 | −15,740 | 7 / 0 / 1 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | 7,682 | 7,948 | +791 | 3 / 0 / 5 |
| all | 7,682 | 7,948 | +791 | 3 / 0 / 5 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | 45,617 | 31,100 | −14,339 | 7 / 0 / 1 |
| all | 45,617 | 31,100 | −14,339 | 7 / 0 / 1 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | $0.0025 | $0.0024 | +$0.0001 | 3 / 0 / 5 |
| all | $0.0025 | $0.0024 | +$0.0001 | 3 / 0 / 5 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | 12.0 s | 10.9 s | −1.1 s | 6 / 0 / 2 |
| all | 12.0 s | 10.9 s | −1.1 s | 6 / 0 / 2 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| fastify | $0.0418 (16 runs) | $0.0419 (16 runs) | none | none |
| all | $0.0418 (16 runs) | $0.0419 (16 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| fastify/x137 | without | 2/2 | 5 [4–5] | 7 [6–8] | 1,413 [1,364–1,461] | 36,788 [29,598–43,978] | 8,664 [7,864–9,464] | $0.0028 [$0.0026–$0.0030] | 12.2 s [12.1 s–12.3 s] |
| fastify/x137 | with | 2/2 | 2 [2–2] | 4 [4–4] | 1,168 [1,071–1,265] | 18,063 [16,064–20,062] | 6,651 [4,660–8,642] | $0.0021 [$0.0018–$0.0024] | 10.4 s [9.5 s–11.4 s] |
| fastify/x138 | without | 2/2 | 3 [2–4] | 5 [4–6] | 856 [621–1,091] | 22,837 [16,147–29,527] | 6,446 [5,285–7,607] | $0.0019 [$0.0015–$0.0024] | 9.1 s [6.9 s–11.3 s] |
| fastify/x138 | with | 2/2 | 2 [2–2] | 4 [4–4] | 866 [770–961] | 17,682 [15,812–19,552] | 7,344 [6,235–8,453] | $0.0021 [$0.0019–$0.0022] | 8.3 s [8.2 s–8.3 s] |
| fastify/x139 | without | 2/2 | 3 [2–3] | 6 [6–6] | 876 [848–903] | 29,140 [28,385–29,894] | 7,054 [6,967–7,140] | $0.0021 [$0.0021–$0.0022] | 9.8 s [9.3 s–10.4 s] |
| fastify/x139 | with | 2/2 | 2 [2–2] | 4 [4–4] | 876 [862–890] | 17,757 [15,864–19,650] | 7,738 [5,880–9,595] | $0.0022 [$0.0018–$0.0025] | 8.2 s [7.8 s–8.6 s] |
| fastify/x140 | without | 2/2 | 6 [3–9] | 10 [6–14] | 1,590 [1,028–2,151] | 61,950 [30,068–93,831] | 11,256 [10,087–12,425] | $0.0037 [$0.0028–$0.0045] | 13.7 s [10.6 s–16.8 s] |
| fastify/x140 | with | 2/2 | 4 [3–4] | 7 [6–8] | 2,130 [1,739–2,520] | 42,319 [34,690–49,948] | 12,439 [10,149–14,728] | $0.0040 [$0.0036–$0.0043] | 15.7 s [14.5 s–16.9 s] |
| fastify/x141 | without | 2/2 | 5 [4–6] | 8 [6–10] | 1,416 [1,391–1,440] | 41,012 [27,020–55,003] | 6,806 [6,683–6,928] | $0.0025 [$0.0023–$0.0026] | 13.1 s [11.8 s–14.3 s] |
| fastify/x141 | with | 2/2 | 2 [2–2] | 5 [4–6] | 1,170 [1,135–1,205] | 23,402 [15,454–31,349] | 6,539 [5,760–7,318] | $0.0021 [$0.0021–$0.0022] | 11.4 s [10.4 s–12.4 s] |
| fastify/x142 | without | 2/2 | 3 [3–3] | 6 [6–6] | 1,038 [917–1,159] | 29,377 [28,411–30,343] | 7,158 [5,506–8,810] | $0.0022 [$0.0018–$0.0026] | 10.6 s [10.1 s–11.2 s] |
| fastify/x142 | with | 2/2 | 5 [4–5] | 7 [6–8] | 1,109 [975–1,242] | 38,154 [33,411–42,896] | 8,158 [5,911–10,405] | $0.0026 [$0.0020–$0.0031] | 10.6 s [9.5 s–11.6 s] |
| fastify/x143 | without | 2/2 | 3 [3–3] | 7 [6–8] | 1,174 [1,083–1,265] | 34,976 [28,450–41,501] | 8,206 [7,999–8,412] | $0.0026 [$0.0025–$0.0026] | 11.8 s [11.5 s–12.1 s] |
| fastify/x143 | with | 2/2 | 2 [2–2] | 4 [4–4] | 1,628 [1,534–1,721] | 17,870 [15,933–19,806] | 11,583 [10,091–13,074] | $0.0033 [$0.0030–$0.0036] | 12.1 s [11.5 s–12.7 s] |
| fastify/x144 | without | 2/2 | 3 [3–3] | 7 [6–8] | 1,356 [1,052–1,659] | 38,753 [29,119–48,386] | 9,750 [7,880–11,619] | $0.0030 [$0.0024–$0.0036] | 12.7 s [11.4 s–13.9 s] |
| fastify/x144 | with | 2/2 | 2 [2–2] | 5 [4–6] | 1,251 [1,194–1,307] | 24,379 [15,737–33,020] | 8,831 [7,376–10,286] | $0.0026 [$0.0024–$0.0029] | 11.2 s [10.8 s–11.6 s] |

