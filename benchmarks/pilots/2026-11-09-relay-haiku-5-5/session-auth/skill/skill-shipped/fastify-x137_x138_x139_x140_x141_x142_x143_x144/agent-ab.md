# Agent-level A/B — measured tool calls, tokens and cost

**claude-code 2.1.322 (Claude Code) · claude-haiku-5-5 · 2026-11-10 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap as the three skills `sigmap skills install --client claude` writes + the sigmap CLI: no MCP server, no always-on section.
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
- Skill variant: both arms run with skills enabled (the Skill tool, and the agent's own bundled skills listed in the prompt, about 2k tokens), which the earlier no-skill runs did not have, so these figures are against this run's own baseline and not comparable cell by cell with the index, lean or current runs. The SigMap arm adds only its skill file(s) and the sigmap CLI: no MCP server and no appended section.

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
| Tool calls | −9% | −14% | fewer in every repetition |
| Input tokens (uncached) | +8% | +4% | more in every repetition |
| Output tokens | −4% | +11% | mixed |
| Cache-read tokens | +9% | +4% | more in every repetition |
| Cache-write tokens | −13% | −11% | fewer in every repetition |
| Total tokens (derived) | +4% | +1% | more in every repetition |
| Cost | −8% | −5% | fewer in every repetition |
| Wall time | +1% | +9% | more in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −12% [−31%, +12%] † | −20% [−40%, +13%] † | fewer in every repetition, within the noise |
| Input tokens (uncached) | +5% [−14%, +28%] † | +3% [−13%, +23%] † | more in every repetition, within the noise |
| Output tokens | −7% [−22%, +10%] † | +12% [−8%, +37%] † | mixed |
| Cache-read tokens | +5% [−17%, +32%] † | +2% [−19%, +29%] † | more in every repetition, within the noise |
| Cache-write tokens | −12% [−24%, −1%] | −10% [−17%, −3%] | fewer in every repetition, outside the noise |
| Total tokens (derived) | +1% [−17%, +22%] † | 0% [−17%, +20%] † | mixed |
| Cost | −8% [−20%, +2%] † | −5% [−14%, +4%] † | fewer in every repetition, within the noise |
| Wall time | −1% [−12%, +12%] † | +9% [−1%, +22%] † | mixed |

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
| fastify | 4 | 3 | −1 | 5 / 2 / 1 |
| all | 4 | 3 | −1 | 5 / 2 / 1 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | 6 | 7 | +1 | 2 / 2 / 4 |
| all | 6 | 7 | +1 | 2 / 2 / 4 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | 1,284 | 1,349 | +42 | 3 / 0 / 5 |
| all | 1,284 | 1,349 | +42 | 3 / 0 / 5 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | 37,804 | 43,892 | +4,350 | 3 / 0 / 5 |
| all | 37,804 | 43,892 | +4,350 | 3 / 0 / 5 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | 10,368 | 9,656 | −842 | 8 / 0 / 0 |
| all | 10,368 | 9,656 | −842 | 8 / 0 / 0 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | 51,397 | 54,904 | +3,816 | 3 / 0 / 5 |
| all | 51,397 | 54,904 | +3,816 | 3 / 0 / 5 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | $0.0032 | $0.0030 | −$0.0001 | 6 / 0 / 2 |
| all | $0.0032 | $0.0030 | −$0.0001 | 6 / 0 / 2 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | 12.4 s | 13.3 s | +1.3 s | 3 / 0 / 5 |
| all | 12.4 s | 13.3 s | +1.3 s | 3 / 0 / 5 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| fastify | $0.0517 (16 runs) | $0.0483 (16 runs) | none | none |
| all | $0.0517 (16 runs) | $0.0483 (16 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| fastify/x137 | without | 2/2 | 4 [3–5] | 6 [6–6] | 1,394 [1,081–1,706] | 38,980 [37,297–40,662] | 14,742 [13,397–16,087] | $0.0040 [$0.0036–$0.0045] | 11.9 s [10.5 s–13.4 s] |
| fastify/x137 | with | 2/2 | 5 [3–6] | 8 [6–10] | 1,432 [1,309–1,555] | 52,273 [35,554–68,992] | 9,829 [9,195–10,463] | $0.0032 [$0.0028–$0.0036] | 13.0 s [11.8 s–14.2 s] |
| fastify/x138 | without | 2/2 | 3 [2–4] | 5 [4–6] | 922 [811–1,033] | 28,023 [20,725–35,320] | 8,959 [8,942–8,976] | $0.0025 [$0.0024–$0.0027] | 9.6 s [8.7 s–10.5 s] |
| fastify/x138 | with | 2/2 | 2 [1–2] | 4 [4–4] | 710 [620–800] | 20,911 [20,909–20,913] | 8,271 [7,356–9,186] | $0.0022 [$0.0020–$0.0024] | 8.6 s [8.2 s–9.1 s] |
| fastify/x139 | without | 2/2 | 4 [3–4] | 6 [6–6] | 1,143 [1,091–1,194] | 36,611 [36,502–36,719] | 9,667 [9,167–10,166] | $0.0029 [$0.0027–$0.0030] | 11.9 s [11.7 s–12.1 s] |
| fastify/x139 | with | 2/2 | 3 [2–4] | 7 [6–8] | 1,261 [1,124–1,397] | 43,139 [36,286–49,992] | 8,796 [8,583–9,008] | $0.0028 [$0.0027–$0.0029] | 13.5 s [13.3 s–13.6 s] |
| fastify/x140 | without | 2/2 | 4 [3–5] | 7 [6–8] | 1,257 [910–1,603] | 42,200 [36,177–48,223] | 11,916 [11,607–12,225] | $0.0034 [$0.0031–$0.0037] | 13.0 s [11.6 s–14.4 s] |
| fastify/x140 | with | 2/2 | 4 [4–4] | 7 [6–8] | 1,630 [1,521–1,738] | 45,284 [37,102–53,466] | 11,245 [11,173–11,317] | $0.0035 [$0.0034–$0.0036] | 14.9 s [13.3 s–16.6 s] |
| fastify/x141 | without | 2/2 | 4 [4–4] | 6 [6–6] | 1,312 [1,236–1,388] | 36,296 [35,018–37,573] | 10,060 [8,880–11,239] | $0.0030 [$0.0027–$0.0033] | 12.8 s [12.5 s–13.1 s] |
| fastify/x141 | with | 2/2 | 4 [3–4] | 7 [6–8] | 1,358 [1,215–1,500] | 44,359 [36,328–52,389] | 9,651 [9,477–9,824] | $0.0031 [$0.0030–$0.0031] | 14.5 s [13.4 s–15.5 s] |
| fastify/x142 | without | 2/2 | 4 [4–4] | 6 [6–6] | 963 [945–981] | 36,629 [34,981–38,276] | 9,720 [8,364–11,075] | $0.0028 [$0.0025–$0.0031] | 10.8 s [10.7 s–11.0 s] |
| fastify/x142 | with | 2/2 | 3 [3–3] | 6 [6–6] | 872 [799–944] | 36,408 [35,710–37,106] | 8,908 [8,306–9,509] | $0.0026 [$0.0025–$0.0027] | 9.9 s [9.1 s–10.7 s] |
| fastify/x143 | without | 2/2 | 5 [4–5] | 7 [6–8] | 1,672 [1,577–1,766] | 44,700 [35,759–53,640] | 12,200 [11,273–13,126] | $0.0037 [$0.0036–$0.0039] | 13.8 s [13.4 s–14.2 s] |
| fastify/x143 | with | 2/2 | 5 [3–6] | 8 [6–10] | 1,890 [1,850–1,930] | 50,316 [36,236–64,396] | 11,210 [10,558–11,861] | $0.0037 [$0.0034–$0.0040] | 15.6 s [14.5 s–16.7 s] |
| fastify/x144 | without | 2/2 | 4 [3–4] | 8 [8–8] | 1,526 [1,018–2,033] | 52,844 [51,008–54,680] | 10,677 [9,631–11,723] | $0.0034 [$0.0029–$0.0039] | 14.3 s [13.4 s–15.2 s] |
| fastify/x144 | with | 2/2 | 3 [3–3] | 7 [6–8] | 1,340 [1,328–1,351] | 43,426 [35,606–51,246] | 9,662 [9,580–9,744] | $0.0030 [$0.0029–$0.0031] | 13.1 s [13.0 s–13.1 s] |

