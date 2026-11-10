# Agent-level A/B — measured tool calls, tokens and cost

**claude-code 2.1.322 (Claude Code) · claude-haiku-4-5 · 2026-11-10 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap generated context + MCP server.
- Both arms: the same prompt, model, tool allowlist (Read, Grep, Glob, Bash), per-run budget cap $1 and timeout 420 s; run in a clean copy of the commit pinned in `benchmarks/xrepo-repos.json`.
- Questions: the task id(s) x147, x148, x149, x150, x151, x152 of `benchmarks/tasks/retrieval-xrepo.jsonl`. Pass = hit@5 on the repository-relative paths the answer names.
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
| fastapi | 6 | 12/12 | 12/12 | 0 / 0 |
| all | 6 | 12/12 | 12/12 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 6. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −23% | −14% | fewer in every repetition |
| Input tokens (uncached) | −30% | −20% | fewer in every repetition |
| Output tokens | −26% | −23% | fewer in every repetition |
| Cache-read tokens | −33% | −30% | fewer in every repetition |
| Cache-write tokens | −51% | −38% | fewer in every repetition |
| Total tokens (derived) | −34% | −30% | fewer in every repetition |
| Cost | −41% | −33% | fewer in every repetition |
| Wall time | −24% | −20% | fewer in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −18% [−38%, +6%] † | −23% [−48%, +14%] † | fewer in every repetition, within the noise |
| Input tokens (uncached) | −29% [−43%, −11%] | −27% [−49%, +1%] † | fewer in every repetition, within the noise |
| Output tokens | −26% [−38%, −6%] | −24% [−47%, +9%] † | fewer in every repetition, within the noise |
| Cache-read tokens | −32% [−44%, −15%] | −26% [−51%, +13%] † | fewer in every repetition, within the noise |
| Cache-write tokens | −50% [−62%, −36%] | −35% [−55%, −8%] | fewer in every repetition, outside the noise |
| Total tokens (derived) | −33% [−44%, −18%] | −26% [−49%, +12%] † | fewer in every repetition, within the noise |
| Cost | −40% [−49%, −29%] | −28% [−42%, −2%] | fewer in every repetition, outside the noise |
| Wall time | −24% [−33%, −10%] | −19% [−40%, +10%] † | fewer in every repetition, within the noise |

### Outcome (hit@5), by repetition

Per paired task: **better** = the SigMap arm named the file and the other did not; **worse** = the reverse; **tie** = both found it or both missed. Localisation only.

| repetition | paired tasks | better | worse | tie |
| --- | ---: | ---: | ---: | ---: |
| R1 | 6 | 0 | 0 | 6 |
| R2 | 6 | 0 | 0 | 6 |
| all | 12 | 0 | 0 | 12 |

## Tool calls

Provenance: agent-reported (main-thread tool_use blocks). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | 12 | 10 | −2 | 5 / 1 / 0 |
| all | 12 | 10 | −2 | 5 / 1 / 0 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | 108 | 84 | −30 | 6 / 0 / 0 |
| all | 108 | 84 | −30 | 6 / 0 / 0 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | 3,095 | 2,235 | −813 | 6 / 0 / 0 |
| all | 3,095 | 2,235 | −813 | 6 / 0 / 0 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | 258,637 | 237,298 | −69,116 | 5 / 0 / 1 |
| all | 258,637 | 237,298 | −69,116 | 5 / 0 / 1 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | 23,194 | 15,119 | −11,304 | 5 / 0 / 1 |
| all | 23,194 | 15,119 | −11,304 | 5 / 0 / 1 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | 285,029 | 259,373 | −79,842 | 5 / 0 / 1 |
| all | 285,029 | 259,373 | −79,842 | 5 / 0 / 1 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | $0.0878 | $0.0680 | −$0.0309 | 5 / 0 / 1 |
| all | $0.0878 | $0.0680 | −$0.0309 | 5 / 0 / 1 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | 37.6 s | 29.1 s | −8.5 s | 5 / 0 / 1 |
| all | 37.6 s | 29.1 s | −8.5 s | 5 / 0 / 1 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| fastapi | $1.26 (12 runs) | $0.7998 (12 runs) | none | none |
| all | $1.26 (12 runs) | $0.7998 (12 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| fastapi/x147 | without | 2/2 | 13 [10–16] | 114 [90–138] | 3,099 [2,606–3,592] | 263,694 [204,447–322,940] | 22,400 [20,577–24,222] | $0.0868 [$0.0820–$0.0915] | 37.9 s [32.9 s–42.9 s] |
| fastapi/x147 | with | 2/2 | 13 [13–13] | 98 [90–106] | 2,841 [2,341–3,340] | 247,753 [220,306–275,200] | 14,178 [13,991–14,365] | $0.0674 [$0.0668–$0.0681] | 33.9 s [31.0 s–36.8 s] |
| fastapi/x148 | without | 2/2 | 12 [8–15] | 102 [74–130] | 2,277 [1,803–2,751] | 217,683 [127,552–307,814] | 16,267 [14,951–17,583] | $0.0658 [$0.0517–$0.0798] | 28.1 s [21.9 s–34.3 s] |
| fastapi/x148 | with | 2/2 | 11 [10–11] | 86 [82–90] | 2,222 [1,954–2,490] | 242,246 [235,570–248,921] | 16,599 [12,618–20,579] | $0.0686 [$0.0587–$0.0786] | 29.4 s [27.2 s–31.5 s] |
| fastapi/x149 | without | 2/2 | 9 [7–10] | 78 [66–90] | 2,158 [1,921–2,395] | 151,028 [124,788–177,267] | 17,493 [16,304–18,681] | $0.0610 [$0.0595–$0.0624] | 27.4 s [25.9 s–29.0 s] |
| fastapi/x149 | with | 2/2 | 5 [4–6] | 34 [34–34] | 1,292 [1,284–1,299] | 71,774 [67,527–76,021] | 12,199 [11,733–12,664] | $0.0381 [$0.0367–$0.0394] | 17.4 s [16.4 s–18.3 s] |
| fastapi/x150 | without | 2/2 | 11 [10–11] | 94 [90–98] | 3,091 [2,854–3,327] | 253,580 [242,503–264,656] | 23,988 [23,006–24,970] | $0.0889 [$0.0846–$0.0931] | 37.3 s [36.5 s–38.1 s] |
| fastapi/x150 | with | 2/2 | 10 [9–10] | 82 [82–82] | 2,241 [2,000–2,481] | 194,602 [190,719–198,484] | 9,602 [9,337–9,867] | $0.0499 [$0.0497–$0.0502] | 28.8 s [26.4 s–31.3 s] |
| fastapi/x151 | without | 2/2 | 23 [20–26] | 194 [170–218] | 4,750 [4,125–5,375] | 675,577 [579,631–771,523] | 38,893 [24,691–53,094] | $0.1693 [$0.1344–$0.2041] | 55.4 s [50.8 s–59.9 s] |
| fastapi/x151 | with | 2/2 | 19 [12–26] | 150 [106–194] | 3,974 [3,126–4,821] | 433,750 [281,780–585,719] | 16,060 [14,072–18,048] | $0.0955 [$0.0721–$0.1190] | 46.9 s [38.0 s–55.7 s] |
| fastapi/x152 | without | 2/2 | 14 [10–17] | 118 [90–146] | 4,255 [3,127–5,383] | 509,851 [327,372–692,329] | 43,602 [38,444–48,760] | $0.1596 [$0.1254–$0.1938] | 49.7 s [38.1 s–61.3 s] |
| fastapi/x152 | with | 2/2 | 9 [7–10] | 74 [66–82] | 2,230 [2,064–2,395] | 232,350 [207,158–257,542] | 22,940 [10,856–35,024] | $0.0803 [$0.0545–$0.1062] | 28.4 s [27.0 s–29.8 s] |

