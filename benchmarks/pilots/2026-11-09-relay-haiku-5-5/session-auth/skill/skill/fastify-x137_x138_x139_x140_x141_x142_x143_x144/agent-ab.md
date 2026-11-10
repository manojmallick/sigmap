# Agent-level A/B — measured tool calls, tokens and cost

**claude-code 2.1.322 (Claude Code) · claude-haiku-5-5 · 2026-11-10 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap as one on-demand skill (sigmap-locate) + the sigmap CLI: no MCP server, no always-on section.
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
| Tool calls | 0% | +12% | mixed |
| Input tokens (uncached) | +7% | +8% | more in every repetition |
| Output tokens | +9% | +5% | more in every repetition |
| Cache-read tokens | +12% | +16% | more in every repetition |
| Cache-write tokens | −10% | +17% | mixed |
| Total tokens (derived) | +7% | +16% | more in every repetition |
| Cost | −3% | +14% | mixed |
| Wall time | +5% | 0% | mixed |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −6% [−29%, +23%] † | +4% [−18%, +32%] † | mixed |
| Input tokens (uncached) | +7% [−10%, +28%] † | +5% [−11%, +26%] † | more in every repetition, within the noise |
| Output tokens | +8% [−11%, +33%] † | +3% [−12%, +23%] † | more in every repetition, within the noise |
| Cache-read tokens | +10% [−14%, +41%] † | +10% [−12%, +39%] † | more in every repetition, within the noise |
| Cache-write tokens | −11% [−20%, 0%] † | +16% [+3%, +30%] | mixed |
| Total tokens (derived) | +6% [−14%, +31%] † | +11% [−9%, +37%] † | more in every repetition, within the noise |
| Cost | −4% [−15%, +9%] † | +12% [−1%, +27%] † | mixed |
| Wall time | +4% [−5%, +17%] † | −1% [−10%, +10%] † | mixed |

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
| fastify | 4 | 3 | −0 | 4 / 2 / 2 |
| all | 4 | 3 | −0 | 4 / 2 / 2 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | 6 | 7 | 0 | 1 / 4 / 3 |
| all | 6 | 7 | 0 | 1 / 4 / 3 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | 1,211 | 1,320 | +11 | 4 / 0 / 4 |
| all | 1,211 | 1,320 | +11 | 4 / 0 / 4 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | 36,311 | 39,669 | +941 | 2 / 0 / 6 |
| all | 36,311 | 39,669 | +941 | 2 / 0 / 6 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | 9,922 | 10,271 | +206 | 3 / 0 / 5 |
| all | 9,922 | 10,271 | +206 | 3 / 0 / 5 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | 48,314 | 50,909 | +797 | 3 / 0 / 5 |
| all | 48,314 | 50,909 | +797 | 3 / 0 / 5 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | $0.0030 | $0.0031 | −$0.0000 | 5 / 0 / 3 |
| all | $0.0030 | $0.0031 | −$0.0000 | 5 / 0 / 3 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | 12.0 s | 12.4 s | +186 ms | 4 / 0 / 4 |
| all | 12.0 s | 12.4 s | +186 ms | 4 / 0 / 4 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| fastify | $0.0484 (16 runs) | $0.0508 (16 runs) | none | none |
| all | $0.0484 (16 runs) | $0.0508 (16 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| fastify/x137 | without | 2/2 | 4 [3–4] | 6 [6–6] | 1,306 [1,246–1,365] | 35,951 [35,480–36,422] | 10,057 [8,869–11,245] | $0.0030 [$0.0028–$0.0033] | 11.7 s [11.7 s–11.8 s] |
| fastify/x137 | with | 2/2 | 4 [3–4] | 6 [6–6] | 1,432 [1,195–1,668] | 37,120 [35,338–38,902] | 10,252 [8,145–12,359] | $0.0031 [$0.0026–$0.0037] | 12.4 s [10.9 s–13.8 s] |
| fastify/x138 | without | 2/2 | 4 [3–4] | 6 [6–6] | 1,004 [883–1,124] | 34,736 [34,527–34,944] | 8,234 [7,586–8,881] | $0.0025 [$0.0023–$0.0027] | 10.1 s [9.2 s–11.0 s] |
| fastify/x138 | with | 2/2 | 3 [2–3] | 6 [4–8] | 813 [694–932] | 35,449 [20,825–50,072] | 7,814 [7,347–8,281] | $0.0023 [$0.0020–$0.0026] | 9.8 s [8.4 s–11.3 s] |
| fastify/x139 | without | 2/2 | 3 [2–3] | 6 [6–6] | 1,060 [927–1,192] | 36,460 [36,168–36,752] | 9,901 [9,415–10,386] | $0.0029 [$0.0028–$0.0029] | 13.6 s [11.0 s–16.3 s] |
| fastify/x139 | with | 2/2 | 2 [2–2] | 6 [6–6] | 956 [913–999] | 36,735 [35,718–37,752] | 9,412 [8,291–10,532] | $0.0027 [$0.0025–$0.0029] | 11.6 s [10.4 s–12.9 s] |
| fastify/x140 | without | 2/2 | 4 [4–4] | 6 [6–6] | 1,116 [1,019–1,213] | 36,009 [34,858–37,160] | 12,072 [11,557–12,586] | $0.0033 [$0.0032–$0.0035] | 11.6 s [10.8 s–12.5 s] |
| fastify/x140 | with | 2/2 | 4 [3–5] | 8 [6–10] | 1,400 [1,074–1,726] | 55,918 [38,208–73,628] | 12,654 [12,224–13,083] | $0.0038 [$0.0035–$0.0040] | 13.3 s [10.9 s–15.8 s] |
| fastify/x141 | without | 2/2 | 4 [4–4] | 7 [6–8] | 1,317 [1,223–1,410] | 43,073 [34,564–51,582] | 9,750 [8,512–10,987] | $0.0030 [$0.0028–$0.0033] | 13.7 s [13.3 s–14.1 s] |
| fastify/x141 | with | 2/2 | 7 [6–7] | 9 [8–10] | 1,981 [1,851–2,111] | 64,497 [55,566–73,428] | 12,739 [12,668–12,810] | $0.0042 [$0.0041–$0.0042] | 16.1 s [15.9 s–16.4 s] |
| fastify/x142 | without | 2/2 | 3 [3–3] | 6 [6–6] | 894 [763–1,024] | 36,162 [34,934–37,389] | 9,726 [7,504–11,948] | $0.0028 [$0.0022–$0.0033] | 11.3 s [10.5 s–12.0 s] |
| fastify/x142 | with | 2/2 | 5 [4–5] | 7 [6–8] | 1,219 [1,157–1,281] | 43,365 [35,798–50,932] | 8,418 [8,292–8,543] | $0.0027 [$0.0026–$0.0029] | 12.5 s [11.7 s–13.3 s] |
| fastify/x143 | without | 2/2 | 4 [3–4] | 7 [6–8] | 1,853 [1,777–1,929] | 43,993 [35,044–52,942] | 10,697 [9,924–11,470] | $0.0035 [$0.0033–$0.0037] | 14.7 s [13.6 s–15.8 s] |
| fastify/x143 | with | 2/2 | 3 [2–4] | 7 [6–8] | 1,702 [1,472–1,932] | 42,219 [35,665–48,772] | 10,914 [9,711–12,117] | $0.0035 [$0.0030–$0.0039] | 14.1 s [13.6 s–14.5 s] |
| fastify/x144 | without | 2/2 | 3 [2–3] | 7 [6–8] | 1,494 [1,462–1,526] | 43,101 [35,085–51,117] | 9,943 [9,247–10,639] | $0.0032 [$0.0029–$0.0034] | 12.2 s [12.0 s–12.5 s] |
| fastify/x144 | with | 2/2 | 2 [2–2] | 6 [6–6] | 1,240 [1,185–1,295] | 36,344 [34,813–37,874] | 10,290 [8,633–11,946] | $0.0030 [$0.0027–$0.0034] | 11.3 s [11.1 s–11.6 s] |

