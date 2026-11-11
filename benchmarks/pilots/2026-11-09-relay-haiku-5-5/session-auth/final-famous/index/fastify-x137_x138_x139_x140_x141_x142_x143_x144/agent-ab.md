# Agent-level A/B — measured tool calls, tokens and cost

**claude-code 2.1.322 (Claude Code) · claude-haiku-5-5 · 2026-11-11 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap index strategy + 7-tool core MCP profile (the docs' setup for an agent that calls the tools).
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
| Tool calls | +13% | +35% | more in every repetition |
| Input tokens (uncached) | +8% | +13% | more in every repetition |
| Output tokens | −8% | +25% | mixed |
| Cache-read tokens | +31% | +47% | more in every repetition |
| Cache-write tokens | +20% | +4% | more in every repetition |
| Total tokens (derived) | +28% | +38% | more in every repetition |
| Cost | +15% | +14% | more in every repetition |
| Wall time | −1% | +32% | mixed |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | +18% [−7%, +50%] † | +37% [−7%, +98%] † | more in every repetition, within the noise |
| Input tokens (uncached) | +7% [−7%, +26%] † | +12% [−10%, +48%] † | more in every repetition, within the noise |
| Output tokens | −8% [−21%, +6%] † | +25% [+7%, +46%] | mixed |
| Cache-read tokens | +29% [−1%, +64%] † | +46% [+10%, +108%] | more in every repetition, within the noise |
| Cache-write tokens | +13% [−3%, +35%] † | +5% [−7%, +17%] † | more in every repetition, within the noise |
| Total tokens (derived) | +27% [+7%, +53%] | +38% [+9%, +84%] | more in every repetition, outside the noise |
| Cost | +12% [−1%, +27%] † | +15% [+2%, +31%] | more in every repetition, within the noise |
| Wall time | −1% [−11%, +11%] † | +29% [+9%, +60%] | mixed |

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
| fastify | 3 | 4 | +1 | 1 / 1 / 6 |
| all | 3 | 4 | +1 | 1 / 1 / 6 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | 6 | 6 | 0 | 1 / 4 / 3 |
| all | 6 | 6 | 0 | 1 / 4 / 3 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | 1,060 | 1,094 | +26 | 3 / 0 / 5 |
| all | 1,060 | 1,094 | +26 | 3 / 0 / 5 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | 28,978 | 36,021 | +8,608 | 1 / 0 / 7 |
| all | 28,978 | 36,021 | +8,608 | 1 / 0 / 7 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | 6,667 | 7,554 | +581 | 2 / 0 / 6 |
| all | 6,667 | 7,554 | +581 | 2 / 0 / 6 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | 37,270 | 44,981 | +8,947 | 1 / 0 / 7 |
| all | 37,270 | 44,981 | +8,947 | 1 / 0 / 7 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | $0.0021 | $0.0026 | +$0.0002 | 1 / 0 / 7 |
| all | $0.0021 | $0.0026 | +$0.0002 | 1 / 0 / 7 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | 10.3 s | 10.5 s | −2 ms | 4 / 0 / 4 |
| all | 10.3 s | 10.5 s | −2 ms | 4 / 0 / 4 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| fastify | $0.0360 (16 runs) | $0.0411 (16 runs) | none | none |
| all | $0.0360 (16 runs) | $0.0411 (16 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| fastify/x137 | without | 2/2 | 4 [4–4] | 7 [6–8] | 1,148 [1,105–1,191] | 38,756 [29,328–48,183] | 9,285 [7,424–11,146] | $0.0028 [$0.0023–$0.0033] | 10.6 s [10.3 s–11.0 s] |
| fastify/x137 | with | 2/2 | 3 [2–3] | 5 [4–6] | 1,171 [1,075–1,266] | 25,902 [21,982–29,821] | 14,761 [9,213–20,309] | $0.0038 [$0.0027–$0.0049] | 10.7 s [10.1 s–11.3 s] |
| fastify/x138 | without | 2/2 | 1 [1–1] | 4 [4–4] | 673 [640–705] | 16,815 [16,814–16,816] | 5,916 [5,866–5,966] | $0.0017 [$0.0017–$0.0017] | 7.2 s [7.0 s–7.5 s] |
| fastify/x138 | with | 2/2 | 3 [2–3] | 5 [4–6] | 852 [737–966] | 29,415 [21,279–37,550] | 6,196 [5,297–7,095] | $0.0020 [$0.0016–$0.0023] | 8.8 s [7.9 s–9.7 s] |
| fastify/x139 | without | 2/2 | 3 [2–3] | 6 [6–6] | 1,069 [915–1,223] | 29,564 [29,130–29,997] | 7,293 [6,574–8,011] | $0.0023 [$0.0021–$0.0025] | 10.9 s [10.0 s–11.8 s] |
| fastify/x139 | with | 2/2 | 3 [2–3] | 6 [6–6] | 916 [817–1,015] | 35,167 [33,657–36,677] | 8,175 [6,209–10,140] | $0.0024 [$0.0020–$0.0029] | 9.9 s [9.9 s–9.9 s] |
| fastify/x140 | without | 2/2 | 3 [3–3] | 6 [6–6] | 1,330 [981–1,678] | 30,411 [30,081–30,740] | 10,454 [10,096–10,812] | $0.0031 [$0.0030–$0.0032] | 11.3 s [9.2 s–13.4 s] |
| fastify/x140 | with | 2/2 | 4 [4–4] | 6 [6–6] | 1,215 [1,099–1,331] | 36,044 [35,986–36,101] | 8,433 [8,008–8,858] | $0.0027 [$0.0025–$0.0028] | 10.9 s [10.3 s–11.6 s] |
| fastify/x141 | without | 2/2 | 3 [2–4] | 6 [6–6] | 1,151 [926–1,376] | 27,609 [27,590–27,627] | 5,687 [5,543–5,830] | $0.0020 [$0.0018–$0.0021] | 10.3 s [9.3 s–11.4 s] |
| fastify/x141 | with | 2/2 | 4 [3–4] | 6 [6–6] | 905 [864–945] | 35,998 [35,880–36,115] | 6,678 [6,236–7,120] | $0.0021 [$0.0021–$0.0022] | 10.1 s [9.9 s–10.3 s] |
| fastify/x142 | without | 2/2 | 4 [4–4] | 7 [6–8] | 987 [973–1,001] | 33,679 [28,124–39,234] | 5,882 [5,463–6,301] | $0.0020 [$0.0020–$0.0020] | 10.3 s [9.9 s–10.7 s] |
| fastify/x142 | with | 2/2 | 5 [4–5] | 7 [6–8] | 1,017 [893–1,141] | 42,507 [34,924–50,089] | 5,784 [5,596–5,971] | $0.0021 [$0.0019–$0.0023] | 10.2 s [8.9 s–11.6 s] |
| fastify/x143 | without | 2/2 | 3 [2–3] | 6 [6–6] | 1,051 [830–1,271] | 28,393 [28,387–28,399] | 7,159 [7,124–7,193] | $0.0022 [$0.0021–$0.0024] | 10.1 s [8.5 s–11.8 s] |
| fastify/x143 | with | 2/2 | 4 [2–5] | 8 [6–10] | 1,447 [1,274–1,620] | 51,028 [35,676–66,380] | 7,256 [6,777–7,735] | $0.0027 [$0.0023–$0.0030] | 14.4 s [13.0 s–15.9 s] |
| fastify/x144 | without | 2/2 | 2 [2–2] | 5 [4–6] | 855 [761–948] | 22,164 [16,836–27,491] | 6,175 [6,097–6,252] | $0.0019 [$0.0018–$0.0020] | 8.9 s [8.1 s–9.8 s] |
| fastify/x144 | with | 2/2 | 4 [3–5] | 9 [8–10] | 1,249 [1,099–1,399] | 59,503 [51,178–67,828] | 7,851 [7,525–8,177] | $0.0028 [$0.0027–$0.0029] | 15.9 s [11.7 s–20.1 s] |

