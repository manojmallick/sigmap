# Agent-level A/B — measured tool calls, tokens and cost

**claude-code 2.1.322 (Claude Code) · claude-haiku-5-5 · 2026-11-10 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap index strategy + 7-tool core MCP profile (the docs' setup for an agent that calls the tools).
- Both arms: the same prompt, model, tool allowlist (Read, Grep, Glob, Bash), per-run budget cap $0.6 and timeout 420 s; run in a clean copy of the commit pinned in `benchmarks/xrepo-repos.json`.
- Questions: the task id(s) h001, h002, h003, h004, h005, h006, h007, h008 of `benchmarks/tasks/retrieval-xrepo.jsonl`. Pass = hit@5 on the repository-relative paths the answer names.
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
| sigmap-src | 8 | 11/16 | 12/16 | 0 / 0 |
| all | 8 | 11/16 | 12/16 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 8. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −31% | −50% | fewer in every repetition |
| Input tokens (uncached) | −32% | −46% | fewer in every repetition |
| Output tokens | −26% | −51% | fewer in every repetition |
| Cache-read tokens | −36% | −46% | fewer in every repetition |
| Cache-write tokens | −27% | −33% | fewer in every repetition |
| Total tokens (derived) | −34% | −44% | fewer in every repetition |
| Cost | −28% | −39% | fewer in every repetition |
| Wall time | −16% | −34% | fewer in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −40% [−60%, −6%] | −51% [−69%, −21%] n=7 | fewer in every repetition, outside the noise |
| Input tokens (uncached) | −33% [−48%, −12%] | −47% [−59%, −31%] | fewer in every repetition, outside the noise |
| Output tokens | −26% [−44%, +2%] † | −45% [−58%, −25%] | fewer in every repetition, within the noise |
| Cache-read tokens | −35% [−57%, −2%] | −46% [−62%, −24%] | fewer in every repetition, outside the noise |
| Cache-write tokens | −24% [−42%, +1%] † | −33% [−45%, −16%] | fewer in every repetition, within the noise |
| Total tokens (derived) | −31% [−48%, −4%] | −44% [−58%, −22%] | fewer in every repetition, outside the noise |
| Cost | −25% [−41%, −3%] | −38% [−50%, −20%] | fewer in every repetition, outside the noise |
| Wall time | −15% [−28%, +3%] † | −30% [−44%, −14%] | fewer in every repetition, within the noise |

### Outcome (hit@5), by repetition

Per paired task: **better** = the SigMap arm named the file and the other did not; **worse** = the reverse; **tie** = both found it or both missed. Localisation only.

| repetition | paired tasks | better | worse | tie |
| --- | ---: | ---: | ---: | ---: |
| R1 | 8 | 1 | 1 | 6 |
| R2 | 8 | 1 | 0 | 7 |
| all | 16 | 2 | 1 | 13 |

## Tool calls

Provenance: agent-reported (main-thread tool_use blocks). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 4 | 2 | −2 | 7 / 0 / 1 |
| all | 4 | 2 | −2 | 7 / 0 / 1 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 8 | 6 | −4 | 8 / 0 / 0 |
| all | 8 | 6 | −4 | 8 / 0 / 0 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 1,250 | 821 | −475 | 7 / 0 / 1 |
| all | 1,250 | 821 | −475 | 7 / 0 / 1 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 43,431 | 31,974 | −17,598 | 6 / 0 / 2 |
| all | 43,431 | 31,974 | −17,598 | 6 / 0 / 2 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 11,230 | 7,139 | −2,320 | 7 / 0 / 1 |
| all | 11,230 | 7,139 | −2,320 | 7 / 0 / 1 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 55,166 | 39,222 | −21,579 | 7 / 0 / 1 |
| all | 55,166 | 39,222 | −21,579 | 7 / 0 / 1 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | $0.0033 | $0.0023 | −$0.0009 | 7 / 0 / 1 |
| all | $0.0033 | $0.0023 | −$0.0009 | 7 / 0 / 1 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 12.0 s | 10.7 s | −3.0 s | 7 / 0 / 1 |
| all | 12.0 s | 10.7 s | −3.0 s | 7 / 0 / 1 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | $0.0555 (16 runs) | $0.0369 (16 runs) | none | none |
| all | $0.0555 (16 runs) | $0.0369 (16 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| sigmap-src/h001 | without | 2/2 | 8 [6–9] | 11 [10–12] | 1,817 [1,664–1,969] | 64,978 [51,669–78,287] | 11,750 [10,391–13,108] | $0.0039 [$0.0034–$0.0044] | 16.8 s [15.5 s–18.0 s] |
| sigmap-src/h001 | with | 2/2 | 2 [2–2] | 4 [4–4] | 781 [762–799] | 16,730 [12,130–21,330] | 11,749 [8,655–14,842] | $0.0029 [$0.0023–$0.0035] | 9.8 s [8.9 s–10.7 s] |
| sigmap-src/h002 | without | 1/2 | 10 [9–11] | 12 [12–12] | 3,701 [2,580–4,821] | 92,769 [76,364–109,174] | 21,080 [15,246–26,913] | $0.0070 [$0.0062–$0.0078] | 25.0 s [20.6 s–29.4 s] |
| sigmap-src/h002 | with | 0/2 | 8 [7–8] | 7 [6–8] | 1,545 [1,459–1,631] | 43,116 [35,942–50,290] | 9,893 [9,407–10,378] | $0.0032 [$0.0030–$0.0034] | 13.1 s [12.0 s–14.2 s] |
| sigmap-src/h003 | without | 0/2 | 2 [2–2] | 6 [6–6] | 724 [684–764] | 26,688 [26,321–27,054] | 5,580 [5,294–5,865] | $0.0017 [$0.0017–$0.0018] | 9.6 s [9.0 s–10.2 s] |
| sigmap-src/h003 | with | 2/2 | 2 [1–2] | 5 [4–6] | 772 [758–786] | 28,077 [20,692–35,462] | 5,649 [5,611–5,687] | $0.0018 [$0.0017–$0.0019] | 10.5 s [10.2 s–10.8 s] |
| sigmap-src/h004 | without | 2/2 | 4 [2–5] | 8 [6–10] | 1,124 [789–1,458] | 42,197 [26,536–57,857] | 9,038 [7,091–10,985] | $0.0028 [$0.0021–$0.0035] | 11.5 s [9.2 s–13.7 s] |
| sigmap-src/h004 | with | 2/2 | 3 [1–4] | 6 [4–8] | 1,033 [676–1,389] | 36,125 [21,330–50,920] | 6,777 [4,702–8,852] | $0.0022 [$0.0015–$0.0030] | 11.1 s [8.8 s–13.4 s] |
| sigmap-src/h005 | without | 2/2 | 4 [3–4] | 7 [6–8] | 1,203 [1,092–1,313] | 39,020 [31,095–46,945] | 10,717 [9,165–12,268] | $0.0031 [$0.0027–$0.0036] | 10.7 s [9.7 s–11.7 s] |
| sigmap-src/h005 | with | 2/2 | 2 [1–2] | 4 [4–4] | 628 [442–814] | 21,006 [20,684–21,328] | 6,089 [5,334–6,844] | $0.0017 [$0.0015–$0.0020] | 8.0 s [7.3 s–8.6 s] |
| sigmap-src/h006 | without | 2/2 | 5 [4–5] | 8 [8–8] | 1,298 [1,206–1,389] | 44,666 [41,275–48,056] | 11,995 [9,203–14,786] | $0.0035 [$0.0029–$0.0041] | 12.6 s [12.4 s–12.8 s] |
| sigmap-src/h006 | with | 2/2 | 5 [5–5] | 7 [6–8] | 1,258 [1,107–1,409] | 45,174 [37,671–52,677] | 10,407 [10,126–10,687] | $0.0032 [$0.0030–$0.0034] | 12.0 s [10.4 s–13.5 s] |
| sigmap-src/h007 | without | 0/2 | 3 [2–3] | 7 [6–8] | 919 [753–1,084] | 32,120 [27,106–37,133] | 5,854 [5,372–6,335] | $0.0020 [$0.0017–$0.0022] | 11.3 s [9.2 s–13.4 s] |
| sigmap-src/h007 | with | 0/2 | 1 [0–1] | 3 [2–4] | 543 [417–668] | 14,938 [9,192–20,684] | 3,476 [2,930–4,021] | $0.0011 [$0.0009–$0.0013] | 7.8 s [7.1 s–8.5 s] |
| sigmap-src/h008 | without | 2/2 | 6 [5–6] | 10 [8–12] | 1,514 [1,395–1,633] | 62,763 [44,842–80,683] | 11,744 [10,466–13,022] | $0.0037 [$0.0032–$0.0042] | 14.0 s [12.7 s–15.3 s] |
| sigmap-src/h008 | with | 2/2 | 3 [2–3] | 6 [6–6] | 861 [631–1,090] | 35,870 [35,099–36,641] | 7,500 [6,903–8,097] | $0.0023 [$0.0020–$0.0025] | 10.8 s [9.5 s–12.1 s] |

