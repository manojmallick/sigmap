# Agent-level A/B — measured tool calls, tokens and cost

**claude-code 2.1.322 (Claude Code) · claude-haiku-5-5 · 2026-11-10 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap as one on-demand skill (sigmap-locate) + the sigmap CLI: no MCP server, no always-on section.
- Both arms: the same prompt, model, tool allowlist (Read, Grep, Glob, Bash), per-run budget cap $0.5 and timeout 420 s; run in a clean copy of the commit pinned in `benchmarks/xrepo-repos.json`.
- Questions: the task id(s) x145, x146, x147, x148, x149, x150, x151, x152 of `benchmarks/tasks/retrieval-xrepo.jsonl`. Pass = hit@5 on the repository-relative paths the answer names.
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
| fastapi | 8 | 16/16 | 16/16 | 0 / 0 |
| all | 8 | 16/16 | 16/16 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 8. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −11% | −23% | fewer in every repetition |
| Input tokens (uncached) | −10% | −4% | fewer in every repetition |
| Output tokens | +3% | −7% | mixed |
| Cache-read tokens | −13% | +1% | mixed |
| Cache-write tokens | 0% | −1% | fewer in every repetition |
| Total tokens (derived) | −10% | +1% | mixed |
| Cost | −2% | −2% | fewer in every repetition |
| Wall time | −2% | −5% | fewer in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −9% [−21%, +8%] † | −23% [−41%, +1%] † | fewer in every repetition, within the noise |
| Input tokens (uncached) | −9% [−20%, +5%] † | −7% [−20%, +11%] † | fewer in every repetition, within the noise |
| Output tokens | 0% [−10%, +13%] † | −2% [−27%, +33%] † | mixed |
| Cache-read tokens | −11% [−23%, +6%] † | −7% [−26%, +21%] † | fewer in every repetition, within the noise |
| Cache-write tokens | 0% [−7%, +7%] † | −1% [−10%, +8%] † | fewer in every repetition, within the noise |
| Total tokens (derived) | −9% [−19%, +4%] † | −5% [−22%, +18%] † | fewer in every repetition, within the noise |
| Cost | −2% [−7%, +5%] † | −2% [−14%, +11%] † | fewer in every repetition, within the noise |
| Wall time | −2% [−10%, +8%] † | −4% [−17%, +12%] † | fewer in every repetition, within the noise |

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
| fastapi | 3 | 3 | −0 | 4 / 4 / 0 |
| all | 3 | 3 | −0 | 4 / 4 / 0 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | 7 | 6 | −1 | 4 / 3 / 1 |
| all | 7 | 6 | −1 | 4 / 3 / 1 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | 1,012 | 1,123 | −56 | 4 / 0 / 4 |
| all | 1,012 | 1,123 | −56 | 4 / 0 / 4 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | 39,455 | 35,850 | −2,488 | 4 / 0 / 4 |
| all | 39,455 | 35,850 | −2,488 | 4 / 0 / 4 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | 8,983 | 9,052 | −55 | 5 / 0 / 3 |
| all | 8,983 | 9,052 | −55 | 5 / 0 / 3 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | 49,309 | 45,610 | −2,367 | 5 / 0 / 3 |
| all | 49,309 | 45,610 | −2,367 | 5 / 0 / 3 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | $0.0027 | $0.0026 | −$0.0001 | 5 / 0 / 3 |
| all | $0.0027 | $0.0026 | −$0.0001 | 5 / 0 / 3 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | 11.8 s | 12.5 s | −287 ms | 4 / 0 / 4 |
| all | 11.8 s | 12.5 s | −287 ms | 4 / 0 / 4 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| fastapi | $0.0455 (16 runs) | $0.0447 (16 runs) | none | none |
| all | $0.0455 (16 runs) | $0.0447 (16 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| fastapi/x145 | without | 2/2 | 3 [1–5] | 6 [4–8] | 1,007 [811–1,203] | 36,398 [20,763–52,032] | 9,262 [8,513–10,011] | $0.0027 [$0.0023–$0.0031] | 10.6 s [9.1 s–12.2 s] |
| fastapi/x145 | with | 2/2 | 3 [1–4] | 5 [4–6] | 886 [681–1,091] | 28,646 [20,847–36,445] | 9,161 [7,965–10,357] | $0.0026 [$0.0021–$0.0030] | 9.9 s [9.1 s–10.7 s] |
| fastapi/x146 | without | 2/2 | 5 [4–5] | 9 [8–10] | 1,617 [1,131–2,103] | 59,764 [48,999–70,529] | 11,715 [11,029–12,401] | $0.0038 [$0.0035–$0.0040] | 14.6 s [12.5 s–16.7 s] |
| fastapi/x146 | with | 2/2 | 5 [4–5] | 10 [8–12] | 1,388 [1,001–1,775] | 74,573 [51,366–97,780] | 12,008 [9,750–14,265] | $0.0038 [$0.0030–$0.0047] | 14.9 s [12.7 s–17.1 s] |
| fastapi/x147 | without | 2/2 | 3 [2–3] | 6 [6–6] | 996 [765–1,227] | 34,945 [34,906–34,984] | 7,682 [7,411–7,953] | $0.0024 [$0.0022–$0.0026] | 10.7 s [9.4 s–12.1 s] |
| fastapi/x147 | with | 2/2 | 3 [2–3] | 6 [6–6] | 1,316 [979–1,653] | 35,214 [35,168–35,259] | 7,967 [7,497–8,437] | $0.0026 [$0.0023–$0.0029] | 13.0 s [12.2 s–13.9 s] |
| fastapi/x148 | without | 2/2 | 4 [4–4] | 7 [6–8] | 1,158 [1,006–1,309] | 42,014 [34,810–49,217] | 8,230 [7,794–8,666] | $0.0026 [$0.0026–$0.0027] | 13.6 s [13.4 s–13.9 s] |
| fastapi/x148 | with | 2/2 | 3 [2–3] | 6 [6–6] | 902 [810–993] | 36,770 [36,525–37,014] | 9,036 [8,447–9,625] | $0.0026 [$0.0025–$0.0028] | 10.8 s [10.7 s–10.9 s] |
| fastapi/x149 | without | 2/2 | 2 [2–2] | 6 [6–6] | 743 [651–834] | 36,896 [35,824–37,967] | 9,658 [7,793–11,523] | $0.0027 [$0.0022–$0.0031] | 10.5 s [9.6 s–11.3 s] |
| fastapi/x149 | with | 2/2 | 2 [1–2] | 5 [4–6] | 794 [655–932] | 28,103 [20,837–35,369] | 9,123 [9,021–9,224] | $0.0025 [$0.0025–$0.0025] | 9.4 s [9.0 s–9.7 s] |
| fastapi/x150 | without | 2/2 | 3 [2–3] | 6 [6–6] | 920 [871–969] | 34,917 [34,913–34,920] | 8,704 [8,626–8,781] | $0.0026 [$0.0025–$0.0026] | 11.8 s [11.4 s–12.2 s] |
| fastapi/x150 | with | 2/2 | 3 [2–3] | 6 [6–6] | 930 [824–1,035] | 35,390 [35,128–35,651] | 8,183 [7,773–8,592] | $0.0025 [$0.0023–$0.0026] | 12.0 s [11.4 s–12.6 s] |
| fastapi/x151 | without | 2/2 | 3 [2–3] | 7 [6–8] | 1,018 [1,013–1,022] | 42,337 [35,211–49,463] | 7,955 [7,330–8,580] | $0.0025 [$0.0025–$0.0026] | 11.9 s [10.7 s–13.2 s] |
| fastapi/x151 | with | 2/2 | 3 [2–3] | 7 [6–8] | 1,375 [1,304–1,446] | 42,732 [35,732–49,732] | 7,947 [7,944–7,949] | $0.0027 [$0.0027–$0.0027] | 13.4 s [12.6 s–14.1 s] |
| fastapi/x152 | without | 2/2 | 6 [5–6] | 8 [8–8] | 2,118 [1,602–2,634] | 51,390 [51,280–51,500] | 9,636 [9,219–10,053] | $0.0035 [$0.0032–$0.0038] | 18.2 s [17.2 s–19.3 s] |
| fastapi/x152 | with | 2/2 | 4 [3–4] | 6 [6–6] | 1,737 [1,352–2,121] | 36,310 [35,227–37,393] | 9,067 [8,306–9,828] | $0.0030 [$0.0027–$0.0034] | 15.2 s [13.2 s–17.2 s] |

