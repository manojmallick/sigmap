# Agent-level A/B — measured tool calls, tokens and cost

**claude-code 2.1.321 (Claude Code) · claude-haiku-5-5 · 2026-11-09 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap generated context + MCP server.
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
| Tool calls | −4% | +16% | mixed |
| Input tokens (uncached) | −4% | −4% | fewer in every repetition |
| Output tokens | +23% | +26% | more in every repetition |
| Cache-read tokens | +65% | +68% | more in every repetition |
| Cache-write tokens | −1% | +8% | mixed |
| Total tokens (derived) | +51% | +56% | more in every repetition |
| Cost | +13% | +21% | more in every repetition |
| Wall time | +6% | +9% | more in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −6% [−24%, +17%] † | +4% [−29%, +43%] † | mixed |
| Input tokens (uncached) | −6% [−21%, +15%] † | −5% [−17%, +7%] † | fewer in every repetition, within the noise |
| Output tokens | +19% [+1%, +42%] | +18% [−9%, +57%] † | more in every repetition, within the noise |
| Cache-read tokens | +60% [+28%, +107%] | +67% [+42%, +94%] | more in every repetition, outside the noise |
| Cache-write tokens | −4% [−20%, +14%] † | +9% [−2%, +20%] † | mixed |
| Total tokens (derived) | +46% [+20%, +82%] | +55% [+35%, +76%] | more in every repetition, outside the noise |
| Cost | +9% [−3%, +25%] † | +19% [+7%, +32%] | more in every repetition, within the noise |
| Wall time | +5% [−5%, +16%] † | +7% [−5%, +23%] † | more in every repetition, within the noise |

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
| fastify | 3 | 4 | −0 | 4 / 2 / 2 |
| all | 3 | 4 | −0 | 4 / 2 / 2 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | 6 | 6 | 0 | 2 / 5 / 1 |
| all | 6 | 6 | 0 | 2 / 5 / 1 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | 1,122 | 1,308 | +103 | 3 / 0 / 5 |
| all | 1,122 | 1,308 | +103 | 3 / 0 / 5 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | 28,655 | 49,990 | +21,571 | 0 / 0 / 8 |
| all | 28,655 | 49,990 | +21,571 | 0 / 0 / 8 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | 7,431 | 7,133 | +195 | 4 / 0 / 4 |
| all | 7,431 | 7,133 | +195 | 4 / 0 / 4 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | 37,754 | 58,186 | +21,110 | 0 / 0 / 8 |
| all | 37,754 | 58,186 | +21,110 | 0 / 0 / 8 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | $0.0024 | $0.0026 | +$0.0003 | 1 / 0 / 7 |
| all | $0.0024 | $0.0026 | +$0.0003 | 1 / 0 / 7 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | 12.5 s | 13.1 s | +453 ms | 3 / 0 / 5 |
| all | 12.5 s | 13.1 s | +453 ms | 3 / 0 / 5 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| fastify | $0.0387 (16 runs) | $0.0450 (16 runs) | none | none |
| all | $0.0387 (16 runs) | $0.0450 (16 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| fastify/x137 | without | 2/2 | 3 [3–3] | 6 [6–6] | 1,305 [1,303–1,307] | 28,703 [27,987–29,419] | 9,111 [6,484–11,737] | $0.0028 [$0.0022–$0.0033] | 13.1 s [12.4 s–13.7 s] |
| fastify/x137 | with | 2/2 | 5 [4–5] | 8 [6–10] | 1,865 [1,829–1,900] | 72,354 [52,307–92,401] | 12,492 [8,760–16,224] | $0.0042 [$0.0032–$0.0051] | 17.0 s [15.0 s–19.0 s] |
| fastify/x138 | without | 2/2 | 3 [2–3] | 6 [6–6] | 790 [737–842] | 28,353 [27,727–28,979] | 6,150 [4,964–7,335] | $0.0019 [$0.0017–$0.0021] | 11.0 s [10.6 s–11.4 s] |
| fastify/x138 | with | 2/2 | 2 [1–2] | 4 [4–4] | 751 [668–833] | 30,937 [30,603–31,270] | 6,625 [6,336–6,913] | $0.0020 [$0.0019–$0.0021] | 9.3 s [9.2 s–9.3 s] |
| fastify/x139 | without | 2/2 | 3 [2–3] | 6 [6–6] | 1,075 [1,070–1,079] | 28,607 [28,371–28,842] | 6,595 [5,619–7,570] | $0.0021 [$0.0019–$0.0023] | 12.3 s [11.7 s–12.8 s] |
| fastify/x139 | with | 2/2 | 2 [2–2] | 6 [6–6] | 920 [848–991] | 50,139 [49,383–50,895] | 6,550 [6,420–6,679] | $0.0023 [$0.0023–$0.0023] | 11.6 s [10.8 s–12.5 s] |
| fastify/x140 | without | 2/2 | 4 [3–4] | 7 [6–8] | 1,000 [988–1,011] | 37,175 [28,892–45,457] | 9,461 [8,219–10,703] | $0.0028 [$0.0024–$0.0031] | 12.5 s [11.8 s–13.1 s] |
| fastify/x140 | with | 2/2 | 6 [5–7] | 7 [6–8] | 2,126 [1,866–2,385] | 58,784 [48,647–68,921] | 7,614 [6,420–8,807] | $0.0032 [$0.0027–$0.0036] | 15.4 s [13.4 s–17.3 s] |
| fastify/x141 | without | 2/2 | 4 [4–4] | 6 [6–6] | 1,169 [1,114–1,224] | 27,236 [26,929–27,542] | 7,109 [6,760–7,458] | $0.0023 [$0.0022–$0.0023] | 13.2 s [12.0 s–14.3 s] |
| fastify/x141 | with | 2/2 | 4 [4–4] | 6 [6–6] | 1,367 [1,288–1,446] | 49,842 [49,627–50,056] | 7,543 [7,517–7,569] | $0.0027 [$0.0027–$0.0027] | 13.3 s [13.1 s–13.6 s] |
| fastify/x142 | without | 2/2 | 4 [4–4] | 6 [6–6] | 968 [927–1,009] | 28,290 [28,025–28,554] | 7,119 [6,566–7,672] | $0.0022 [$0.0021–$0.0023] | 11.0 s [10.9 s–11.1 s] |
| fastify/x142 | with | 2/2 | 4 [3–4] | 6 [6–6] | 976 [871–1,081] | 49,256 [49,037–49,474] | 6,280 [5,911–6,648] | $0.0022 [$0.0022–$0.0023] | 11.7 s [11.3 s–12.2 s] |
| fastify/x143 | without | 2/2 | 4 [3–5] | 7 [6–8] | 1,169 [1,110–1,227] | 34,304 [28,176–40,432] | 8,794 [7,610–9,977] | $0.0027 [$0.0025–$0.0028] | 12.6 s [12.4 s–12.8 s] |
| fastify/x143 | with | 2/2 | 4 [3–4] | 7 [6–8] | 1,631 [1,192–2,069] | 62,962 [50,018–75,905] | 10,376 [10,134–10,618] | $0.0035 [$0.0035–$0.0036] | 14.8 s [13.5 s–16.1 s] |
| fastify/x144 | without | 2/2 | 3 [3–3] | 8 [8–8] | 1,264 [970–1,557] | 41,031 [40,452–41,609] | 7,744 [7,473–8,014] | $0.0026 [$0.0025–$0.0027] | 13.0 s [12.4 s–13.7 s] |
| fastify/x144 | with | 2/2 | 3 [3–3] | 6 [6–6] | 1,250 [1,237–1,262] | 48,825 [48,178–49,471] | 6,723 [6,553–6,892] | $0.0025 [$0.0024–$0.0025] | 12.9 s [12.4 s–13.4 s] |

