# Agent-level A/B — measured tool calls, tokens and cost

**claude-code 2.1.321 (Claude Code) · claude-haiku-5-5 · 2026-11-09 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap lean: 7-tool core MCP profile + a three-line section.
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
| Tool calls | +56% | +7% | more in every repetition |
| Input tokens (uncached) | +23% | +6% | more in every repetition |
| Output tokens | +21% | −2% | mixed |
| Cache-read tokens | +53% | +17% | more in every repetition |
| Cache-write tokens | +7% | −13% | mixed |
| Total tokens (derived) | +44% | +12% | more in every repetition |
| Cost | +16% | −6% | mixed |
| Wall time | +18% | +2% | more in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | +58% [+23%, +107%] | +10% [−2%, +25%] † | more in every repetition, within the noise |
| Input tokens (uncached) | +20% [−9%, +63%] † | +11% [−9%, +34%] † | more in every repetition, within the noise |
| Output tokens | +24% [+7%, +42%] | 0% [−22%, +26%] † | mixed |
| Cache-read tokens | +49% [+6%, +116%] | +28% [+1%, +62%] | more in every repetition, outside the noise |
| Cache-write tokens | +8% [−5%, +22%] † | −12% [−22%, +2%] † | mixed |
| Total tokens (derived) | +41% [+6%, +91%] | +21% [−3%, +48%] † | more in every repetition, within the noise |
| Cost | +17% [+3%, +33%] | −3% [−15%, +13%] † | mixed |
| Wall time | +17% [+3%, +34%] | +4% [−11%, +19%] † | more in every repetition, within the noise |

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
| fastify | 4 | 5 | +1 | 0 / 1 / 7 |
| all | 4 | 5 | +1 | 0 / 1 / 7 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | 7 | 7 | +1 | 1 / 2 / 5 |
| all | 7 | 7 | +1 | 1 / 2 / 5 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | 1,044 | 1,289 | +119 | 2 / 0 / 6 |
| all | 1,044 | 1,289 | +119 | 2 / 0 / 6 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | 31,927 | 40,366 | +13,161 | 1 / 0 / 7 |
| all | 31,927 | 40,366 | +13,161 | 1 / 0 / 7 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | 7,600 | 7,010 | −359 | 4 / 0 / 4 |
| all | 7,600 | 7,010 | −359 | 4 / 0 / 4 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | 40,875 | 48,723 | +14,118 | 1 / 0 / 7 |
| all | 40,875 | 48,723 | +14,118 | 1 / 0 / 7 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | $0.0024 | $0.0025 | +$0.0001 | 3 / 0 / 5 |
| all | $0.0024 | $0.0025 | +$0.0001 | 3 / 0 / 5 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | 12.4 s | 13.7 s | +1.1 s | 2 / 0 / 6 |
| all | 12.4 s | 13.7 s | +1.1 s | 2 / 0 / 6 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| fastify | $0.0399 (16 runs) | $0.0418 (16 runs) | none | none |
| all | $0.0399 (16 runs) | $0.0418 (16 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| fastify/x137 | without | 2/2 | 4 [4–4] | 7 [6–8] | 1,027 [979–1,075] | 35,234 [28,656–41,812] | 7,545 [7,031–8,059] | $0.0024 [$0.0022–$0.0025] | 12.4 s [12.4 s–12.5 s] |
| fastify/x137 | with | 2/2 | 5 [4–5] | 8 [6–10] | 1,558 [1,404–1,711] | 48,666 [35,301–62,031] | 8,011 [6,577–9,445] | $0.0029 [$0.0028–$0.0029] | 15.9 s [13.3 s–18.4 s] |
| fastify/x138 | without | 2/2 | 3 [2–3] | 5 [4–6] | 652 [646–658] | 21,956 [16,139–27,772] | 5,123 [4,958–5,288] | $0.0016 [$0.0015–$0.0016] | 9.0 s [7.9 s–10.1 s] |
| fastify/x138 | with | 2/2 | 5 [3–6] | 7 [6–8] | 840 [710–969] | 40,092 [33,652–46,532] | 7,070 [6,247–7,892] | $0.0022 [$0.0019–$0.0025] | 10.8 s [9.0 s–12.6 s] |
| fastify/x139 | without | 2/2 | 2 [2–2] | 6 [6–6] | 926 [729–1,122] | 28,590 [28,366–28,814] | 6,582 [6,209–6,955] | $0.0021 [$0.0020–$0.0021] | 11.1 s [10.2 s–12.1 s] |
| fastify/x139 | with | 2/2 | 3 [2–3] | 6 [6–6] | 959 [718–1,199] | 33,588 [32,997–34,179] | 6,706 [5,442–7,970] | $0.0022 [$0.0018–$0.0025] | 12.6 s [11.9 s–13.2 s] |
| fastify/x140 | without | 2/2 | 6 [3–8] | 12 [6–18] | 2,173 [1,664–2,681] | 77,979 [28,522–127,435] | 11,144 [9,962–12,326] | $0.0041 [$0.0031–$0.0051] | 19.0 s [14.3 s–23.7 s] |
| fastify/x140 | with | 2/2 | 7 [7–7] | 14 [14–14] | 1,551 [1,450–1,652] | 96,996 [95,481–98,510] | 10,173 [9,940–10,405] | $0.0038 [$0.0037–$0.0039] | 17.0 s [16.5 s–17.5 s] |
| fastify/x141 | without | 2/2 | 4 [4–4] | 6 [6–6] | 1,279 [1,178–1,380] | 28,695 [26,970–30,420] | 8,016 [7,509–8,522] | $0.0025 [$0.0024–$0.0027] | 12.3 s [12.1 s–12.4 s] |
| fastify/x141 | with | 2/2 | 5 [4–6] | 9 [8–10] | 1,555 [1,476–1,633] | 53,036 [46,620–59,451] | 6,951 [6,019–7,882] | $0.0027 [$0.0024–$0.0030] | 16.2 s [14.3 s–18.0 s] |
| fastify/x142 | without | 2/2 | 4 [3–4] | 7 [6–8] | 933 [927–939] | 35,160 [30,903–39,416] | 7,654 [6,581–8,727] | $0.0023 [$0.0022–$0.0025] | 10.9 s [10.4 s–11.4 s] |
| fastify/x142 | with | 2/2 | 5 [4–5] | 7 [6–8] | 983 [859–1,107] | 40,362 [33,063–47,660] | 6,812 [6,512–7,112] | $0.0023 [$0.0022–$0.0023] | 11.6 s [11.2 s–12.1 s] |
| fastify/x143 | without | 2/2 | 4 [4–4] | 8 [8–8] | 1,203 [1,133–1,273] | 41,860 [41,532–42,188] | 8,669 [7,971–9,366] | $0.0028 [$0.0027–$0.0029] | 13.8 s [13.2 s–14.4 s] |
| fastify/x143 | with | 2/2 | 4 [4–4] | 7 [6–8] | 1,203 [1,031–1,374] | 39,671 [33,071–46,271] | 6,567 [6,144–6,990] | $0.0023 [$0.0022–$0.0024] | 13.5 s [12.2 s–14.8 s] |
| fastify/x144 | without | 2/2 | 2 [2–2] | 6 [6–6] | 1,061 [1,055–1,066] | 27,482 [27,277–27,686] | 6,928 [6,051–7,804] | $0.0022 [$0.0020–$0.0024] | 13.3 s [11.7 s–15.0 s] |
| fastify/x144 | with | 2/2 | 4 [3–4] | 7 [6–8] | 1,375 [1,108–1,641] | 40,371 [33,608–47,134] | 7,529 [6,683–8,375] | $0.0026 [$0.0026–$0.0026] | 13.9 s [11.8 s–16.0 s] |

