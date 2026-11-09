# Agent-level A/B — measured tool calls, tokens and cost

**claude-code 2.1.319 (Claude Code) · claude-haiku-5-5 · 2026-11-09 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap index strategy + 7-tool core MCP profile (the docs' setup for an agent that calls the tools).
- Both arms: the same prompt, model, tool allowlist (Read, Grep, Glob, Bash), per-run budget cap $0.5 and timeout 420 s; run in a clean copy of the commit pinned in `benchmarks/xrepo-repos.json`.
- Questions: the task id(s) x137, x139, x140, x141, x142, x143, x144 of `benchmarks/tasks/retrieval-xrepo.jsonl`. Pass = hit@5 on the repository-relative paths the answer names.
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
| fastify | 7 | 14/14 | 14/14 | 0 / 0 |
| all | 7 | 14/14 | 14/14 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 7. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −7% | +8% | mixed |
| Input tokens (uncached) | −4% | 0% | mixed |
| Output tokens | −1% | +24% | mixed |
| Cache-read tokens | +22% | +29% | more in every repetition |
| Cache-write tokens | +1% | 0% | mixed |
| Total tokens (derived) | +17% | +23% | more in every repetition |
| Cost | +3% | +10% | more in every repetition |
| Wall time | +7% | +11% | more in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −10% [−27%, +14%] † | +6% [−28%, +59%] † | mixed |
| Input tokens (uncached) | −4% [−12%, 0%] † | 0% [−15%, +18%] † | mixed |
| Output tokens | −2% [−13%, +11%] † | +17% [−6%, +48%] † | mixed |
| Cache-read tokens | +22% [+9%, +32%] | +29% [+7%, +55%] | more in every repetition, outside the noise |
| Cache-write tokens | −1% [−12%, +15%] † | −2% [−15%, +17%] † | fewer in every repetition, within the noise |
| Total tokens (derived) | +17% [+6%, +27%] | +23% [+6%, +42%] | more in every repetition, outside the noise |
| Cost | +2% [−6%, +12%] † | +7% [−5%, +22%] † | more in every repetition, within the noise |
| Wall time | +6% [−1%, +13%] † | +10% [−3%, +26%] † | more in every repetition, within the noise |

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
| fastify | 3 | 4 | −1 | 4 / 1 / 2 |
| all | 3 | 4 | −1 | 4 / 1 / 2 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | 6 | 6 | 0 | 2 / 4 / 1 |
| all | 6 | 6 | 0 | 2 / 4 / 1 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | 1,210 | 1,101 | +141 | 3 / 0 / 4 |
| all | 1,210 | 1,101 | +141 | 3 / 0 / 4 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | 29,507 | 39,661 | +7,754 | 0 / 0 / 7 |
| all | 29,507 | 39,661 | +7,754 | 0 / 0 / 7 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | 7,290 | 6,907 | −295 | 6 / 0 / 1 |
| all | 7,290 | 6,907 | −295 | 6 / 0 / 1 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | 40,866 | 49,483 | +7,421 | 0 / 0 / 7 |
| all | 40,866 | 49,483 | +7,421 | 0 / 0 / 7 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | $0.0024 | $0.0024 | +$0.0001 | 3 / 0 / 4 |
| all | $0.0024 | $0.0024 | +$0.0001 | 3 / 0 / 4 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | 13.2 s | 13.4 s | +539 ms | 2 / 0 / 5 |
| all | 13.2 s | 13.4 s | +539 ms | 2 / 0 / 5 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| fastify | $0.0342 (14 runs) | $0.0363 (14 runs) | none | none |
| all | $0.0342 (14 runs) | $0.0363 (14 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| fastify/x137 | without | 2/2 | 5 [4–5] | 7 [6–8] | 1,210 [1,156–1,263] | 34,437 [27,632–41,242] | 7,052 [6,815–7,288] | $0.0024 [$0.0024–$0.0024] | 14.0 s [12.3 s–15.8 s] |
| fastify/x137 | with | 2/2 | 4 [4–4] | 6 [6–6] | 1,508 [1,070–1,945] | 39,661 [38,827–40,495] | 10,602 [10,596–10,608] | $0.0033 [$0.0030–$0.0035] | 13.4 s [11.3 s–15.6 s] |
| fastify/x139 | without | 2/2 | 3 [3–3] | 6 [6–6] | 1,067 [1,019–1,114] | 28,704 [28,507–28,900] | 7,103 [6,593–7,612] | $0.0022 [$0.0022–$0.0023] | 11.7 s [10.5 s–12.8 s] |
| fastify/x139 | with | 2/2 | 2 [2–2] | 6 [6–6] | 961 [919–1,003] | 36,151 [35,660–36,641] | 6,808 [6,675–6,940] | $0.0022 [$0.0022–$0.0022] | 12.2 s [12.1 s–12.4 s] |
| fastify/x140 | without | 2/2 | 3 [3–3] | 6 [6–6] | 1,373 [1,350–1,396] | 29,507 [29,198–29,815] | 9,981 [9,605–10,356] | $0.0030 [$0.0029–$0.0030] | 13.4 s [13.2 s–13.6 s] |
| fastify/x140 | with | 2/2 | 6 [5–7] | 7 [6–8] | 1,841 [1,279–2,403] | 44,745 [37,976–51,513] | 9,690 [8,036–11,343] | $0.0033 [$0.0033–$0.0033] | 17.1 s [14.3 s–20.0 s] |
| fastify/x141 | without | 2/2 | 4 [4–4] | 6 [6–6] | 1,150 [1,087–1,213] | 27,190 [26,744–27,635] | 6,714 [6,304–7,123] | $0.0022 [$0.0021–$0.0023] | 12.3 s [12.1 s–12.5 s] |
| fastify/x141 | with | 2/2 | 3 [2–3] | 6 [6–6] | 1,055 [911–1,198] | 35,080 [34,726–35,434] | 5,889 [5,106–6,672] | $0.0021 [$0.0018–$0.0023] | 12.6 s [11.2 s–14.0 s] |
| fastify/x142 | without | 2/2 | 6 [5–6] | 8 [8–8] | 1,299 [1,123–1,475] | 40,030 [39,725–40,334] | 7,290 [6,064–8,515] | $0.0025 [$0.0022–$0.0028] | 13.8 s [13.0 s–14.5 s] |
| fastify/x142 | with | 2/2 | 5 [4–5] | 7 [6–8] | 1,079 [1,054–1,103] | 42,349 [35,192–49,505] | 6,049 [5,270–6,827] | $0.0022 [$0.0019–$0.0024] | 12.8 s [12.1 s–13.5 s] |
| fastify/x143 | without | 2/2 | 3 [2–4] | 6 [6–6] | 1,460 [947–1,972] | 27,819 [27,443–28,195] | 7,666 [7,517–7,814] | $0.0025 [$0.0023–$0.0028] | 13.2 s [10.9 s–15.5 s] |
| fastify/x143 | with | 2/2 | 4 [4–4] | 6 [6–6] | 1,885 [1,435–2,335] | 35,573 [35,434–35,711] | 6,907 [6,190–7,624] | $0.0027 [$0.0023–$0.0030] | 15.8 s [13.7 s–17.9 s] |
| fastify/x144 | without | 2/2 | 3 [2–3] | 7 [6–8] | 960 [848–1,072] | 33,784 [28,236–39,332] | 7,353 [7,220–7,486] | $0.0023 [$0.0023–$0.0023] | 11.6 s [11.1 s–12.0 s] |
| fastify/x144 | with | 2/2 | 3 [2–3] | 7 [6–8] | 1,101 [1,073–1,128] | 43,474 [34,676–52,272] | 7,306 [6,609–8,003] | $0.0024 [$0.0022–$0.0027] | 13.7 s [12.8 s–14.7 s] |

