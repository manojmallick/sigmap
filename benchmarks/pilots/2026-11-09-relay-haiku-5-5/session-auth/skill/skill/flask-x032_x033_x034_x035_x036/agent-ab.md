# Agent-level A/B — measured tool calls, tokens and cost

**claude-code 2.1.322 (Claude Code) · claude-haiku-5-5 · 2026-11-10 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap as one on-demand skill (sigmap-locate) + the sigmap CLI: no MCP server, no always-on section.
- Both arms: the same prompt, model, tool allowlist (Read, Grep, Glob, Bash), per-run budget cap $0.5 and timeout 420 s; run in a clean copy of the commit pinned in `benchmarks/xrepo-repos.json`.
- Questions: the task id(s) x032, x033, x034, x035, x036 of `benchmarks/tasks/retrieval-xrepo.jsonl`. Pass = hit@5 on the repository-relative paths the answer names.
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
| flask | 5 | 10/10 | 10/10 | 0 / 0 |
| all | 5 | 10/10 | 10/10 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 5. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −6% | −18% | fewer in every repetition |
| Input tokens (uncached) | 0% | −12% | mixed |
| Output tokens | −13% | −29% | fewer in every repetition |
| Cache-read tokens | −1% | −13% | fewer in every repetition |
| Cache-write tokens | −6% | 0% | fewer in every repetition |
| Total tokens (derived) | −2% | −11% | fewer in every repetition |
| Cost | −7% | −9% | fewer in every repetition |
| Wall time | −9% | −17% | fewer in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −4% [−20%, +14%] † | −20% [−53%, +37%] † | fewer in every repetition, within the noise |
| Input tokens (uncached) | −1% [−16%, +14%] † | −13% [−28%, +10%] † | fewer in every repetition, within the noise |
| Output tokens | −9% [−30%, +12%] † | −26% [−44%, +1%] † | fewer in every repetition, within the noise |
| Cache-read tokens | −3% [−23%, +20%] † | −15% [−36%, +17%] † | fewer in every repetition, within the noise |
| Cache-write tokens | −6% [−15%, +6%] † | −2% [−19%, +18%] † | fewer in every repetition, within the noise |
| Total tokens (derived) | −3% [−20%, +14%] † | −12% [−32%, +18%] † | fewer in every repetition, within the noise |
| Cost | −6% [−15%, +6%] † | −10% [−27%, +13%] † | fewer in every repetition, within the noise |
| Wall time | −7% [−22%, +8%] † | −15% [−29%, +2%] † | fewer in every repetition, within the noise |

### Outcome (hit@5), by repetition

Per paired task: **better** = the SigMap arm named the file and the other did not; **worse** = the reverse; **tie** = both found it or both missed. Localisation only.

| repetition | paired tasks | better | worse | tie |
| --- | ---: | ---: | ---: | ---: |
| R1 | 5 | 0 | 0 | 5 |
| R2 | 5 | 0 | 0 | 5 |
| all | 10 | 0 | 0 | 10 |

## Tool calls

Provenance: agent-reported (main-thread tool_use blocks). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | 4 | 3 | −1 | 3 / 1 / 1 |
| all | 4 | 3 | −1 | 3 / 1 / 1 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | 7 | 6 | 0 | 2 / 2 / 1 |
| all | 7 | 6 | 0 | 2 / 2 / 1 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | 1,323 | 1,128 | −298 | 4 / 0 / 1 |
| all | 1,323 | 1,128 | −298 | 4 / 0 / 1 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | 41,873 | 36,759 | +1,114 | 2 / 0 / 3 |
| all | 41,873 | 36,759 | +1,114 | 2 / 0 / 3 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | 11,319 | 10,995 | −421 | 4 / 0 / 1 |
| all | 11,319 | 10,995 | −421 | 4 / 0 / 1 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | 52,039 | 49,840 | +740 | 2 / 0 / 3 |
| all | 52,039 | 49,840 | +740 | 2 / 0 / 3 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | $0.0031 | $0.0031 | −$0.0003 | 3 / 0 / 2 |
| all | $0.0031 | $0.0031 | −$0.0003 | 3 / 0 / 2 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | 12.4 s | 11.2 s | −1.4 s | 4 / 0 / 1 |
| all | 12.4 s | 11.2 s | −1.4 s | 4 / 0 / 1 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| flask | $0.0337 (10 runs) | $0.0311 (10 runs) | none | none |
| all | $0.0337 (10 runs) | $0.0311 (10 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| flask/x032 | without | 2/2 | 5 [5–5] | 8 [8–8] | 2,710 [2,547–2,873] | 54,743 [54,462–55,024] | 13,146 [12,273–14,019] | $0.0045 [$0.0044–$0.0046] | 18.4 s [17.9 s–18.9 s] |
| flask/x032 | with | 2/2 | 4 [4–4] | 6 [6–6] | 1,643 [1,511–1,774] | 35,401 [35,329–35,472] | 12,472 [12,442–12,502] | $0.0037 [$0.0036–$0.0037] | 12.9 s [12.1 s–13.7 s] |
| flask/x033 | without | 2/2 | 5 [4–5] | 7 [6–8] | 1,473 [1,220–1,726] | 43,378 [35,248–51,507] | 11,416 [11,368–11,463] | $0.0035 [$0.0032–$0.0037] | 12.9 s [10.7 s–15.1 s] |
| flask/x033 | with | 2/2 | 3 [3–3] | 6 [6–6] | 1,128 [1,010–1,246] | 36,014 [35,933–36,095] | 10,995 [8,538–13,451] | $0.0031 [$0.0026–$0.0037] | 11.6 s [11.4 s–11.8 s] |
| flask/x034 | without | 2/2 | 3 [2–3] | 6 [6–6] | 970 [930–1,009] | 35,401 [35,256–35,546] | 10,185 [8,836–11,534] | $0.0029 [$0.0026–$0.0032] | 9.8 s [9.7 s–9.9 s] |
| flask/x034 | with | 2/2 | 4 [4–4] | 7 [6–8] | 1,209 [1,160–1,258] | 44,129 [35,069–53,189] | 9,804 [9,332–10,275] | $0.0030 [$0.0028–$0.0032] | 11.2 s [10.7 s–11.8 s] |
| flask/x035 | without | 2/2 | 4 [3–4] | 7 [6–8] | 1,323 [1,289–1,356] | 41,873 [34,364–49,381] | 8,837 [7,858–9,816] | $0.0028 [$0.0026–$0.0031] | 12.4 s [12.3 s–12.4 s] |
| flask/x035 | with | 2/2 | 3 [1–4] | 7 [4–10] | 1,025 [698–1,352] | 44,061 [20,789–67,332] | 7,687 [6,267–9,106] | $0.0025 [$0.0018–$0.0032] | 10.3 s [8.4 s–12.3 s] |
| flask/x036 | without | 2/2 | 2 [2–2] | 6 [6–6] | 1,040 [1,028–1,052] | 35,645 [34,974–36,316] | 11,319 [10,104–12,533] | $0.0031 [$0.0029–$0.0034] | 11.5 s [11.5 s–11.6 s] |
| flask/x036 | with | 2/2 | 2 [2–2] | 6 [6–6] | 899 [811–986] | 36,759 [35,166–38,351] | 12,177 [11,432–12,921] | $0.0033 [$0.0030–$0.0035] | 10.6 s [9.7 s–11.4 s] |

