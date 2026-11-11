# Agent-level A/B — measured tool calls, tokens and cost

**claude-code 2.1.322 (Claude Code) · claude-haiku-5-5 · 2026-11-11 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap ranked the question BEFORE the first turn (what a prompt hook would inject): the five likeliest files with their signatures and line anchors in the prompt, + the sigmap CLI; no MCP server, no standing section, no extra tool call.
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
| Tool calls | +4% | −8% | mixed |
| Input tokens (uncached) | −14% | −8% | fewer in every repetition |
| Output tokens | +3% | −10% | mixed |
| Cache-read tokens | −14% | +6% | mixed |
| Cache-write tokens | +33% | −14% | mixed |
| Total tokens (derived) | −5% | +2% | mixed |
| Cost | +20% | −10% | mixed |
| Wall time | −2% | −4% | fewer in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | +5% [−14%, +27%] † | −1% [−26%, +42%] † | mixed |
| Input tokens (uncached) | −16% [−29%, 0%] | −2% [−23%, +22%] † | fewer in every repetition, within the noise |
| Output tokens | +6% [−5%, +20%] † | −11% [−22%, +1%] † | mixed |
| Cache-read tokens | −17% [−34%, +4%] † | +16% [−12%, +54%] † | mixed |
| Cache-write tokens | +35% [+25%, +45%] | −13% [−29%, +5%] † | mixed |
| Total tokens (derived) | −6% [−19%, +10%] † | +9% [−13%, +36%] † | mixed |
| Cost | +20% [+16%, +26%] | −9% [−22%, +3%] † | mixed |
| Wall time | −2% [−10%, +7%] † | −3% [−11%, +6%] † | fewer in every repetition, within the noise |

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
| fastapi | 4 | 3 | −0 | 4 / 1 / 3 |
| all | 4 | 3 | −0 | 4 / 1 / 3 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | 6 | 6 | 0 | 2 / 6 / 0 |
| all | 6 | 6 | 0 | 2 / 6 / 0 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | 1,066 | 1,052 | −84 | 5 / 0 / 3 |
| all | 1,066 | 1,052 | −84 | 5 / 0 / 3 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | 29,523 | 31,719 | +1,900 | 2 / 0 / 6 |
| all | 29,523 | 31,719 | +1,900 | 2 / 0 / 6 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | 7,747 | 7,836 | +1,401 | 2 / 0 / 6 |
| all | 7,747 | 7,836 | +1,401 | 2 / 0 / 6 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | 38,691 | 40,781 | +2,898 | 3 / 0 / 5 |
| all | 38,691 | 40,781 | +2,898 | 3 / 0 / 5 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | $0.0025 | $0.0026 | +$0.0002 | 2 / 0 / 6 |
| all | $0.0025 | $0.0026 | +$0.0002 | 2 / 0 / 6 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | 10.9 s | 10.9 s | +176 ms | 3 / 0 / 5 |
| all | 10.9 s | 10.9 s | +176 ms | 3 / 0 / 5 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| fastapi | $0.0394 (16 runs) | $0.0415 (16 runs) | none | none |
| all | $0.0394 (16 runs) | $0.0415 (16 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| fastapi/x145 | without | 2/2 | 3 [2–3] | 5 [4–6] | 812 [788–835] | 23,062 [16,838–29,286] | 11,107 [10,876–11,338] | $0.0029 [$0.0028–$0.0030] | 9.1 s [9.1 s–9.2 s] |
| fastapi/x145 | with | 2/2 | 2 [2–2] | 5 [4–6] | 905 [898–911] | 25,662 [15,675–35,648] | 11,636 [9,396–13,876] | $0.0030 [$0.0027–$0.0034] | 9.3 s [8.8 s–9.8 s] |
| fastapi/x146 | without | 2/2 | 5 [4–5] | 11 [10–12] | 1,257 [1,235–1,279] | 60,383 [54,710–66,056] | 8,300 [8,015–8,584] | $0.0029 [$0.0029–$0.0029] | 14.1 s [13.7 s–14.5 s] |
| fastapi/x146 | with | 2/2 | 3 [3–3] | 6 [6–6] | 1,373 [1,298–1,447] | 35,643 [32,337–38,948] | 10,161 [8,948–11,374] | $0.0031 [$0.0029–$0.0032] | 11.6 s [11.2 s–12.0 s] |
| fastapi/x147 | without | 2/2 | 2 [1–2] | 5 [4–6] | 1,041 [1,019–1,062] | 22,075 [16,832–27,318] | 4,870 [4,047–5,692] | $0.0017 [$0.0015–$0.0019] | 10.6 s [9.6 s–11.5 s] |
| fastapi/x147 | with | 2/2 | 3 [3–3] | 5 [4–6] | 1,140 [950–1,330] | 24,562 [16,084–33,039] | 7,028 [5,097–8,958] | $0.0022 [$0.0018–$0.0026] | 10.7 s [9.7 s–11.7 s] |
| fastapi/x148 | without | 2/2 | 4 [4–4] | 7 [6–8] | 1,091 [1,019–1,162] | 33,793 [28,066–39,519] | 6,009 [5,138–6,880] | $0.0021 [$0.0018–$0.0024] | 11.1 s [9.6 s–12.7 s] |
| fastapi/x148 | with | 2/2 | 4 [3–4] | 6 [6–6] | 923 [848–998] | 30,021 [29,112–30,929] | 7,326 [4,407–10,244] | $0.0022 [$0.0016–$0.0028] | 10.2 s [9.7 s–10.7 s] |
| fastapi/x149 | without | 2/2 | 3 [2–3] | 6 [6–6] | 972 [664–1,280] | 30,091 [28,986–31,196] | 9,127 [8,672–9,581] | $0.0026 [$0.0025–$0.0027] | 10.1 s [8.7 s–11.5 s] |
| fastapi/x149 | with | 2/2 | 3 [2–3] | 6 [6–6] | 873 [790–956] | 35,415 [32,510–38,319] | 7,644 [4,556–10,731] | $0.0023 [$0.0017–$0.0029] | 10.4 s [10.2 s–10.6 s] |
| fastapi/x150 | without | 2/2 | 4 [4–4] | 6 [6–6] | 1,032 [984–1,079] | 28,955 [28,822–29,087] | 7,195 [6,382–8,007] | $0.0022 [$0.0021–$0.0024] | 10.5 s [8.9 s–12.1 s] |
| fastapi/x150 | with | 2/2 | 4 [3–4] | 6 [6–6] | 963 [863–1,063] | 33,417 [30,900–35,934] | 8,900 [6,344–11,456] | $0.0026 [$0.0021–$0.0031] | 11.1 s [9.4 s–12.7 s] |
| fastapi/x151 | without | 2/2 | 4 [3–4] | 8 [8–8] | 1,477 [1,412–1,541] | 43,521 [41,329–45,713] | 9,164 [7,568–10,760] | $0.0030 [$0.0026–$0.0034] | 13.7 s [13.1 s–14.3 s] |
| fastapi/x151 | with | 2/2 | 4 [4–4] | 8 [6–10] | 1,297 [1,231–1,362] | 44,834 [34,421–55,247] | 8,029 [6,583–9,475] | $0.0027 [$0.0023–$0.0031] | 12.7 s [11.5 s–14.0 s] |
| fastapi/x152 | without | 2/2 | 4 [3–4] | 6 [6–6] | 1,636 [1,431–1,840] | 27,770 [27,400–28,139] | 5,996 [5,480–6,511] | $0.0023 [$0.0021–$0.0025] | 13.4 s [12.3 s–14.6 s] |
| fastapi/x152 | with | 2/2 | 4 [4–4] | 6 [6–6] | 1,522 [1,440–1,603] | 28,972 [27,600–30,344] | 7,482 [5,650–9,313] | $0.0025 [$0.0022–$0.0029] | 13.9 s [13.6 s–14.2 s] |

