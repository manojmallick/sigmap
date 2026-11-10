# Agent-level A/B — measured tool calls, tokens and cost

**claude-code 2.1.322 (Claude Code) · claude-haiku-5-5 · 2026-11-10 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap as the three skills `sigmap skills install --client claude` writes + the sigmap CLI: no MCP server, no always-on section.
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
| Tool calls | +31% | +8% | more in every repetition |
| Input tokens (uncached) | +19% | +4% | more in every repetition |
| Output tokens | +19% | +13% | more in every repetition |
| Cache-read tokens | +37% | +7% | more in every repetition |
| Cache-write tokens | +21% | +7% | more in every repetition |
| Total tokens (derived) | +34% | +7% | more in every repetition |
| Cost | +23% | +8% | more in every repetition |
| Wall time | +13% | +6% | more in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | +38% [−1%, +107%] † | +7% [−16%, +34%] † | more in every repetition, within the noise |
| Input tokens (uncached) | +17% [−4%, +47%] † | +1% [−10%, +16%] † | more in every repetition, within the noise |
| Output tokens | +13% [−5%, +39%] † | +13% [+1%, +24%] | more in every repetition, within the noise |
| Cache-read tokens | +30% [−1%, +79%] † | +3% [−9%, +22%] † | more in every repetition, within the noise |
| Cache-write tokens | +18% [+5%, +35%] | +8% [−9%, +23%] † | more in every repetition, within the noise |
| Total tokens (derived) | +27% [−1%, +68%] † | +4% [−7%, +20%] † | more in every repetition, within the noise |
| Cost | +19% [+3%, +41%] | +8% [−5%, +19%] † | more in every repetition, within the noise |
| Wall time | +11% [+2%, +23%] | +6% [−4%, +16%] † | more in every repetition, within the noise |

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
| fastapi | 3 | 4 | +1 | 2 / 1 / 5 |
| all | 3 | 4 | +1 | 2 / 1 / 5 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | 7 | 7 | 0 | 2 / 3 / 3 |
| all | 7 | 7 | 0 | 2 / 3 / 3 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | 1,147 | 1,219 | +138 | 1 / 0 / 7 |
| all | 1,147 | 1,219 | +138 | 1 / 0 / 7 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | 38,909 | 44,537 | +1,749 | 3 / 0 / 5 |
| all | 38,909 | 44,537 | +1,749 | 3 / 0 / 5 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | 8,592 | 9,917 | +1,124 | 2 / 0 / 6 |
| all | 8,592 | 9,917 | +1,124 | 2 / 0 / 6 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | 48,851 | 56,040 | +2,909 | 2 / 0 / 6 |
| all | 48,851 | 56,040 | +2,909 | 2 / 0 / 6 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | $0.0027 | $0.0030 | +$0.0002 | 0 / 0 / 8 |
| all | $0.0027 | $0.0030 | +$0.0002 | 0 / 0 / 8 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | 11.2 s | 11.4 s | +774 ms | 1 / 0 / 7 |
| all | 11.2 s | 11.4 s | +774 ms | 1 / 0 / 7 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| fastapi | $0.0444 (16 runs) | $0.0514 (16 runs) | none | none |
| all | $0.0444 (16 runs) | $0.0514 (16 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| fastapi/x145 | without | 2/2 | 3 [1–4] | 5 [4–6] | 948 [898–998] | 28,753 [20,761–36,744] | 10,814 [7,902–13,726] | $0.0029 [$0.0023–$0.0036] | 10.0 s [9.1 s–10.8 s] |
| fastapi/x145 | with | 2/2 | 4 [4–4] | 7 [6–8] | 1,232 [1,149–1,314] | 44,139 [34,802–53,475] | 10,024 [8,680–11,368] | $0.0031 [$0.0027–$0.0035] | 11.2 s [10.5 s–11.8 s] |
| fastapi/x146 | without | 2/2 | 3 [3–3] | 8 [8–8] | 1,269 [1,204–1,334] | 51,627 [50,709–52,545] | 9,747 [9,207–10,287] | $0.0031 [$0.0030–$0.0033] | 13.2 s [11.7 s–14.7 s] |
| fastapi/x146 | with | 2/2 | 6 [5–7] | 13 [12–14] | 2,125 [1,621–2,628] | 104,943 [84,701–125,185] | 14,266 [11,160–17,371] | $0.0050 [$0.0039–$0.0060] | 18.3 s [15.2 s–21.4 s] |
| fastapi/x147 | without | 2/2 | 3 [3–3] | 6 [6–6] | 1,070 [1,035–1,105] | 34,841 [34,733–34,949] | 7,849 [7,700–7,998] | $0.0025 [$0.0024–$0.0025] | 10.3 s [10.1 s–10.4 s] |
| fastapi/x147 | with | 2/2 | 3 [2–3] | 6 [6–6] | 1,232 [1,166–1,298] | 35,428 [35,173–35,683] | 7,673 [7,420–7,926] | $0.0025 [$0.0024–$0.0026] | 11.3 s [10.9 s–11.6 s] |
| fastapi/x148 | without | 2/2 | 5 [5–5] | 8 [8–8] | 1,240 [1,147–1,332] | 50,405 [50,014–50,796] | 8,235 [7,866–8,603] | $0.0028 [$0.0026–$0.0029] | 12.7 s [12.0 s–13.4 s] |
| fastapi/x148 | with | 2/2 | 4 [3–4] | 7 [6–8] | 1,063 [939–1,186] | 45,801 [37,281–54,321] | 9,809 [9,572–10,046] | $0.0030 [$0.0028–$0.0031] | 11.6 s [10.1 s–13.0 s] |
| fastapi/x149 | without | 2/2 | 2 [2–2] | 6 [6–6] | 854 [786–922] | 34,887 [34,802–34,971] | 8,719 [7,122–10,316] | $0.0025 [$0.0022–$0.0029] | 10.5 s [9.7 s–11.3 s] |
| fastapi/x149 | with | 2/2 | 3 [2–3] | 7 [6–8] | 969 [928–1,009] | 46,064 [35,305–56,823] | 10,459 [8,087–12,831] | $0.0030 [$0.0024–$0.0036] | 10.7 s [10.7 s–10.8 s] |
| fastapi/x150 | without | 2/2 | 3 [3–3] | 6 [6–6] | 1,179 [1,159–1,198] | 35,794 [35,635–35,953] | 8,708 [8,496–8,919] | $0.0027 [$0.0027–$0.0027] | 10.8 s [9.8 s–11.7 s] |
| fastapi/x150 | with | 2/2 | 4 [4–4] | 6 [6–6] | 1,206 [986–1,426] | 35,444 [35,226–35,662] | 9,215 [8,948–9,481] | $0.0028 [$0.0026–$0.0030] | 11.0 s [10.1 s–12.0 s] |
| fastapi/x151 | without | 2/2 | 3 [2–4] | 7 [6–8] | 1,116 [1,041–1,191] | 42,566 [35,527–49,605] | 8,327 [7,718–8,936] | $0.0026 [$0.0024–$0.0029] | 11.7 s [11.5 s–11.9 s] |
| fastapi/x151 | with | 2/2 | 3 [3–3] | 6 [6–6] | 1,144 [1,012–1,275] | 36,094 [35,923–36,264] | 9,001 [8,582–9,420] | $0.0027 [$0.0026–$0.0029] | 13.6 s [12.0 s–15.2 s] |
| fastapi/x152 | without | 2/2 | 5 [4–5] | 7 [6–8] | 1,936 [1,880–1,992] | 42,025 [34,900–49,149] | 8,476 [8,237–8,714] | $0.0031 [$0.0029–$0.0032] | 16.0 s [15.6 s–16.3 s] |
| fastapi/x152 | with | 2/2 | 6 [5–6] | 7 [6–8] | 2,196 [1,853–2,538] | 44,935 [36,912–52,958] | 10,551 [9,852–11,249] | $0.0037 [$0.0035–$0.0038] | 16.5 s [15.1 s–17.9 s] |

