# Agent-level A/B — measured tool calls, tokens and cost

**claude-code 2.1.322 (Claude Code) · claude-haiku-5-5 · 2026-11-11 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap ranked the question BEFORE the first turn (what a prompt hook would inject): the five likeliest files with their signatures and line anchors after the question in the user turn, + the sigmap CLI; no MCP server, no standing section, no extra tool call.
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
| Tool calls | 0% | −26% | mixed |
| Input tokens (uncached) | −18% | −17% | fewer in every repetition |
| Output tokens | +23% | −12% | mixed |
| Cache-read tokens | −15% | −7% | fewer in every repetition |
| Cache-write tokens | +32% | −17% | mixed |
| Total tokens (derived) | −7% | −9% | fewer in every repetition |
| Cost | +22% | −14% | mixed |
| Wall time | +6% | −10% | mixed |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −2% [−26%, +36%] † | −25% [−49%, +3%] † | fewer in every repetition, within the noise |
| Input tokens (uncached) | −19% [−29%, −4%] | −16% [−32%, +2%] † | fewer in every repetition, within the noise |
| Output tokens | +26% [0%, +57%] † | −12% [−38%, +16%] † | mixed |
| Cache-read tokens | −17% [−33%, +7%] † | −6% [−30%, +21%] † | fewer in every repetition, within the noise |
| Cache-write tokens | +32% [+12%, +54%] | −16% [−28%, −5%] | mixed |
| Total tokens (derived) | −8% [−23%, +15%] † | −7% [−27%, +16%] † | fewer in every repetition, within the noise |
| Cost | +23% [+5%, +45%] | −12% [−24%, +2%] † | mixed |
| Wall time | +8% [−8%, +24%] † | −9% [−25%, +7%] † | mixed |

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
| fastapi | 3 | 3 | −1 | 5 / 0 / 3 |
| all | 3 | 3 | −1 | 5 / 0 / 3 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | 7 | 6 | −1 | 6 / 1 / 1 |
| all | 7 | 6 | −1 | 6 / 1 / 1 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | 976 | 1,164 | +75 | 3 / 0 / 5 |
| all | 976 | 1,164 | +75 | 3 / 0 / 5 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | 35,663 | 33,173 | −3,571 | 5 / 0 / 3 |
| all | 35,663 | 33,173 | −3,571 | 5 / 0 / 3 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | 6,599 | 6,534 | +629 | 2 / 0 / 6 |
| all | 6,599 | 6,534 | +629 | 2 / 0 / 6 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | 44,172 | 40,694 | −2,724 | 6 / 0 / 2 |
| all | 44,172 | 40,694 | −2,724 | 6 / 0 / 2 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | $0.0022 | $0.0023 | +$0.0001 | 4 / 0 / 4 |
| all | $0.0022 | $0.0023 | +$0.0001 | 4 / 0 / 4 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | 10.3 s | 10.7 s | +174 ms | 4 / 0 / 4 |
| all | 10.3 s | 10.7 s | +174 ms | 4 / 0 / 4 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| fastapi | $0.0359 (16 runs) | $0.0368 (16 runs) | none | none |
| all | $0.0359 (16 runs) | $0.0368 (16 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| fastapi/x145 | without | 2/2 | 4 [3–4] | 7 [6–8] | 1,062 [811–1,312] | 36,307 [29,197–43,416] | 8,436 [7,744–9,128] | $0.0026 [$0.0022–$0.0029] | 10.4 s [8.6 s–12.1 s] |
| fastapi/x145 | with | 2/2 | 2 [1–2] | 4 [4–4] | 613 [430–796] | 18,306 [17,366–19,246] | 9,919 [8,115–11,723] | $0.0025 [$0.0020–$0.0029] | 8.4 s [6.5 s–10.2 s] |
| fastapi/x146 | without | 2/2 | 4 [3–5] | 9 [8–10] | 1,324 [928–1,720] | 48,684 [41,309–56,059] | 7,647 [7,150–8,144] | $0.0027 [$0.0023–$0.0031] | 12.0 s [9.5 s–14.6 s] |
| fastapi/x146 | with | 2/2 | 3 [2–3] | 7 [6–8] | 1,346 [1,287–1,404] | 43,280 [33,705–52,854] | 8,664 [7,668–9,659] | $0.0028 [$0.0027–$0.0030] | 13.0 s [12.4 s–13.7 s] |
| fastapi/x147 | without | 2/2 | 2 [2–2] | 5 [4–6] | 858 [787–929] | 22,761 [16,840–28,681] | 5,034 [4,364–5,704] | $0.0017 [$0.0015–$0.0018] | 9.1 s [8.6 s–9.6 s] |
| fastapi/x147 | with | 2/2 | 3 [2–3] | 4 [4–4] | 1,333 [1,232–1,434] | 18,919 [17,773–20,064] | 6,050 [5,048–7,051] | $0.0021 [$0.0019–$0.0022] | 10.6 s [10.2 s–11.0 s] |
| fastapi/x148 | without | 2/2 | 4 [3–4] | 7 [6–8] | 948 [890–1,006] | 33,338 [27,646–39,029] | 5,047 [4,829–5,264] | $0.0018 [$0.0018–$0.0018] | 9.7 s [9.4 s–9.9 s] |
| fastapi/x148 | with | 2/2 | 3 [3–3] | 6 [6–6] | 911 [789–1,032] | 30,039 [29,019–31,058] | 5,290 [4,588–5,991] | $0.0018 [$0.0017–$0.0019] | 10.0 s [9.8 s–10.2 s] |
| fastapi/x149 | without | 2/2 | 3 [2–3] | 7 [6–8] | 840 [577–1,103] | 35,020 [27,880–42,160] | 6,667 [4,525–8,808] | $0.0021 [$0.0015–$0.0027] | 10.3 s [8.4 s–12.2 s] |
| fastapi/x149 | with | 2/2 | 3 [3–3] | 6 [6–6] | 1,077 [1,045–1,108] | 36,307 [34,293–38,321] | 6,794 [4,745–8,843] | $0.0023 [$0.0019–$0.0027] | 10.0 s [9.9 s–10.1 s] |
| fastapi/x150 | without | 2/2 | 3 [2–3] | 6 [6–6] | 788 [722–853] | 27,701 [27,680–27,722] | 6,376 [6,148–6,603] | $0.0019 [$0.0019–$0.0020] | 9.5 s [9.3 s–9.6 s] |
| fastapi/x150 | with | 2/2 | 4 [3–5] | 7 [6–8] | 1,196 [1,129–1,263] | 40,623 [34,865–46,380] | 7,495 [5,860–9,129] | $0.0025 [$0.0021–$0.0029] | 11.4 s [10.5 s–12.3 s] |
| fastapi/x151 | without | 2/2 | 3 [3–3] | 7 [6–8] | 1,005 [934–1,075] | 37,649 [28,858–46,440] | 7,398 [6,239–8,557] | $0.0024 [$0.0021–$0.0026] | 10.9 s [10.4 s–11.3 s] |
| fastapi/x151 | with | 2/2 | 3 [2–3] | 7 [6–8] | 1,133 [1,123–1,142] | 38,242 [30,589–45,895] | 6,031 [5,040–7,022] | $0.0022 [$0.0020–$0.0023] | 10.8 s [10.1 s–11.6 s] |
| fastapi/x152 | without | 2/2 | 6 [4–7] | 9 [8–10] | 2,072 [1,613–2,531] | 44,947 [38,470–51,424] | 6,532 [5,555–7,508] | $0.0028 [$0.0023–$0.0033] | 17.1 s [16.1 s–18.0 s] |
| fastapi/x152 | with | 2/2 | 4 [3–4] | 6 [6–6] | 1,480 [1,195–1,764] | 29,445 [28,682–30,207] | 6,275 [5,550–6,999] | $0.0023 [$0.0023–$0.0023] | 12.6 s [11.2 s–14.0 s] |

