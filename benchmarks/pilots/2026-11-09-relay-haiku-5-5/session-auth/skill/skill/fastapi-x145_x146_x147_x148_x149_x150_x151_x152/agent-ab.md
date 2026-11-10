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
| Tool calls | +4% | −25% | mixed |
| Input tokens (uncached) | +4% | −23% | mixed |
| Output tokens | −11% | −17% | fewer in every repetition |
| Cache-read tokens | +10% | −28% | mixed |
| Cache-write tokens | −4% | −5% | fewer in every repetition |
| Total tokens (derived) | +7% | −24% | mixed |
| Cost | −3% | −11% | fewer in every repetition |
| Wall time | −11% | −14% | fewer in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −2% [−24%, +20%] † | −23% [−38%, −4%] | fewer in every repetition, within the noise |
| Input tokens (uncached) | +4% [−14%, +26%] † | −21% [−35%, −6%] | mixed |
| Output tokens | −14% [−25%, −3%] | −14% [−27%, 0%] | fewer in every repetition, outside the noise |
| Cache-read tokens | +10% [−15%, +41%] † | −25% [−40%, −7%] | mixed |
| Cache-write tokens | −4% [−18%, +14%] † | −5% [−12%, +2%] † | fewer in every repetition, within the noise |
| Total tokens (derived) | +7% [−15%, +32%] † | −21% [−34%, −7%] | mixed |
| Cost | −4% [−17%, +11%] † | −11% [−18%, −3%] | fewer in every repetition, within the noise |
| Wall time | −13% [−22%, −1%] | −12% [−25%, +2%] † | fewer in every repetition, within the noise |

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
| fastapi | 3 | 3 | −1 | 6 / 0 / 2 |
| all | 3 | 3 | −1 | 6 / 0 / 2 |

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
| fastapi | 1,196 | 1,057 | −170 | 7 / 0 / 1 |
| all | 1,196 | 1,057 | −170 | 7 / 0 / 1 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | 39,306 | 36,305 | −2,926 | 5 / 0 / 3 |
| all | 39,306 | 36,305 | −2,926 | 5 / 0 / 3 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | 9,666 | 9,211 | −976 | 5 / 0 / 3 |
| all | 9,666 | 9,211 | −976 | 5 / 0 / 3 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | 49,831 | 46,004 | −4,072 | 6 / 0 / 2 |
| all | 49,831 | 46,004 | −4,072 | 6 / 0 / 2 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | $0.0029 | $0.0027 | −$0.0003 | 7 / 0 / 1 |
| all | $0.0029 | $0.0027 | −$0.0003 | 7 / 0 / 1 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | 12.2 s | 10.3 s | −1.3 s | 7 / 0 / 1 |
| all | 12.2 s | 10.3 s | −1.3 s | 7 / 0 / 1 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| fastapi | $0.0490 (16 runs) | $0.0455 (16 runs) | none | none |
| all | $0.0490 (16 runs) | $0.0455 (16 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| fastapi/x145 | without | 2/2 | 4 [3–4] | 8 [6–10] | 1,269 [1,201–1,337] | 53,550 [34,900–72,199] | 10,737 [7,774–13,699] | $0.0033 [$0.0025–$0.0041] | 12.7 s [10.3 s–15.1 s] |
| fastapi/x145 | with | 2/2 | 2 [2–2] | 5 [4–6] | 826 [817–834] | 29,135 [20,855–37,415] | 9,374 [8,183–10,565] | $0.0026 [$0.0023–$0.0029] | 9.5 s [8.2 s–10.9 s] |
| fastapi/x146 | without | 2/2 | 4 [4–4] | 10 [10–10] | 1,472 [1,342–1,602] | 67,850 [67,139–68,561] | 11,050 [10,354–11,745] | $0.0036 [$0.0034–$0.0038] | 13.9 s [12.9 s–15.0 s] |
| fastapi/x146 | with | 2/2 | 4 [2–5] | 8 [6–10] | 1,386 [1,260–1,512] | 54,506 [38,192–70,819] | 11,096 [10,674–11,517] | $0.0035 [$0.0031–$0.0038] | 13.1 s [12.4 s–13.9 s] |
| fastapi/x147 | without | 2/2 | 3 [2–3] | 6 [6–6] | 1,134 [1,078–1,190] | 35,591 [34,700–36,482] | 8,698 [8,481–8,915] | $0.0027 [$0.0026–$0.0027] | 12.6 s [12.3 s–12.8 s] |
| fastapi/x147 | with | 2/2 | 2 [2–2] | 6 [6–6] | 932 [887–977] | 35,355 [35,175–35,534] | 7,689 [7,508–7,869] | $0.0024 [$0.0023–$0.0024] | 9.7 s [9.3 s–10.1 s] |
| fastapi/x148 | without | 2/2 | 5 [4–5] | 7 [6–8] | 1,203 [1,125–1,280] | 43,022 [34,283–51,760] | 8,592 [8,303–8,881] | $0.0028 [$0.0026–$0.0029] | 11.8 s [11.1 s–12.6 s] |
| fastapi/x148 | with | 2/2 | 4 [3–5] | 6 [6–6] | 1,037 [930–1,143] | 36,369 [36,180–36,558] | 9,308 [8,982–9,634] | $0.0027 [$0.0026–$0.0029] | 10.1 s [9.8 s–10.3 s] |
| fastapi/x149 | without | 2/2 | 3 [2–3] | 6 [6–6] | 1,040 [928–1,152] | 34,519 [33,846–35,192] | 9,118 [7,347–10,889] | $0.0027 [$0.0024–$0.0030] | 10.6 s [9.3 s–11.8 s] |
| fastapi/x149 | with | 2/2 | 2 [2–2] | 6 [6–6] | 866 [808–923] | 36,242 [36,189–36,294] | 8,175 [8,024–8,326] | $0.0024 [$0.0024–$0.0025] | 9.9 s [8.9 s–11.0 s] |
| fastapi/x150 | without | 2/2 | 3 [2–3] | 6 [6–6] | 1,147 [1,089–1,204] | 35,108 [34,834–35,382] | 10,579 [9,661–11,497] | $0.0030 [$0.0029–$0.0032] | 11.1 s [10.5 s–11.7 s] |
| fastapi/x150 | with | 2/2 | 3 [2–4] | 6 [6–6] | 1,078 [818–1,337] | 35,398 [35,100–35,696] | 8,319 [7,814–8,823] | $0.0026 [$0.0023–$0.0028] | 10.5 s [9.5 s–11.4 s] |
| fastapi/x151 | without | 2/2 | 3 [2–3] | 6 [6–6] | 1,189 [958–1,419] | 35,123 [34,850–35,396] | 8,527 [7,608–9,446] | $0.0027 [$0.0024–$0.0029] | 11.2 s [10.3 s–12.2 s] |
| fastapi/x151 | with | 2/2 | 3 [2–4] | 7 [6–8] | 1,325 [1,119–1,530] | 47,962 [35,575–60,349] | 11,176 [8,370–13,982] | $0.0034 [$0.0026–$0.0042] | 12.1 s [10.3 s–13.8 s] |
| fastapi/x152 | without | 2/2 | 6 [5–6] | 9 [6–12] | 2,235 [1,914–2,556] | 57,781 [35,114–80,447] | 10,214 [9,295–11,133] | $0.0037 [$0.0035–$0.0039] | 18.1 s [14.2 s–22.1 s] |
| fastapi/x152 | with | 2/2 | 5 [4–6] | 8 [6–10] | 1,753 [1,458–2,047] | 52,166 [35,364–68,968] | 9,114 [8,526–9,702] | $0.0032 [$0.0028–$0.0037] | 14.3 s [12.2 s–16.5 s] |

