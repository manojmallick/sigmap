# Agent-level A/B — measured tool calls, tokens and cost

**claude-code 2.1.322 (Claude Code) · claude-haiku-5-5 · 2026-11-10 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap index strategy + 7-tool core MCP profile (the docs' setup for an agent that calls the tools).
- Both arms: the same prompt, model, tool allowlist (Read, Grep, Glob, Bash), per-run budget cap $0.6 and timeout 420 s; run in a clean copy of the commit pinned in `benchmarks/xrepo-repos.json`.
- Questions: the task id(s) h024, h025, h026, h027, h028, h029, h030 of `benchmarks/tasks/retrieval-xrepo.jsonl`. Pass = hit@5 on the repository-relative paths the answer names.
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
| sigmap-src | 7 | 14/14 | 14/14 | 0 / 0 |
| all | 7 | 14/14 | 14/14 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 7. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −31% | −29% | fewer in every repetition |
| Input tokens (uncached) | −23% | −15% | fewer in every repetition |
| Output tokens | −28% | −24% | fewer in every repetition |
| Cache-read tokens | −11% | −14% | fewer in every repetition |
| Cache-write tokens | −20% | −22% | fewer in every repetition |
| Total tokens (derived) | −13% | −15% | fewer in every repetition |
| Cost | −20% | −21% | fewer in every repetition |
| Wall time | −16% | −2% | fewer in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −38% [−52%, −22%] | −25% [−43%, 0%] † | fewer in every repetition, within the noise |
| Input tokens (uncached) | −25% [−33%, −15%] | −15% [−34%, +9%] † | fewer in every repetition, within the noise |
| Output tokens | −35% [−45%, −23%] | −20% [−32%, −3%] | fewer in every repetition, outside the noise |
| Cache-read tokens | −13% [−26%, +6%] † | −4% [−36%, +42%] † | fewer in every repetition, within the noise |
| Cache-write tokens | −20% [−32%, −7%] | −12% [−40%, +25%] † | fewer in every repetition, within the noise |
| Total tokens (derived) | −14% [−26%, +1%] † | −6% [−36%, +38%] † | fewer in every repetition, within the noise |
| Cost | −22% [−32%, −11%] | −13% [−38%, +20%] † | fewer in every repetition, within the noise |
| Wall time | −18% [−23%, −10%] | 0% [−18%, +19%] † | fewer in every repetition, within the noise |

### Outcome (hit@5), by repetition

Per paired task: **better** = the SigMap arm named the file and the other did not; **worse** = the reverse; **tie** = both found it or both missed. Localisation only.

| repetition | paired tasks | better | worse | tie |
| --- | ---: | ---: | ---: | ---: |
| R1 | 7 | 0 | 0 | 7 |
| R2 | 7 | 0 | 0 | 7 |
| all | 14 | 0 | 0 | 14 |

## Tool calls

Provenance: agent-reported (main-thread tool_use blocks). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 4 | 3 | −2 | 6 / 1 / 0 |
| all | 4 | 3 | −2 | 6 / 1 / 0 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 7 | 6 | −2 | 5 / 1 / 1 |
| all | 7 | 6 | −2 | 5 / 1 / 1 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 1,126 | 816 | −334 | 7 / 0 / 0 |
| all | 1,126 | 816 | −334 | 7 / 0 / 0 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 38,175 | 35,592 | −2,216 | 4 / 0 / 3 |
| all | 38,175 | 35,592 | −2,216 | 4 / 0 / 3 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 9,053 | 7,365 | −2,248 | 5 / 0 / 2 |
| all | 9,053 | 7,365 | −2,248 | 5 / 0 / 2 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 50,022 | 42,750 | −5,613 | 4 / 0 / 3 |
| all | 50,022 | 42,750 | −5,613 | 4 / 0 / 3 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | $0.0027 | $0.0021 | −$0.0007 | 5 / 0 / 2 |
| all | $0.0027 | $0.0021 | −$0.0007 | 5 / 0 / 2 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 11.8 s | 10.8 s | −1.4 s | 4 / 0 / 3 |
| all | 11.8 s | 10.8 s | −1.4 s | 4 / 0 / 3 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | $0.0466 (14 runs) | $0.0370 (14 runs) | none | none |
| all | $0.0466 (14 runs) | $0.0370 (14 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| sigmap-src/h024 | without | 2/2 | 10 [9–10] | 16 [14–18] | 2,793 [2,449–3,137] | 150,294 [132,675–167,912] | 23,962 [22,842–25,081] | $0.0077 [$0.0071–$0.0083] | 23.9 s [20.7 s–27.0 s] |
| sigmap-src/h024 | with | 2/2 | 7 [5–9] | 13 [10–16] | 2,193 [1,370–3,016] | 108,959 [64,228–153,690] | 14,851 [8,671–21,031] | $0.0052 [$0.0031–$0.0073] | 19.3 s [13.7 s–25.0 s] |
| sigmap-src/h025 | without | 2/2 | 6 [5–6] | 8 [8–8] | 1,317 [1,224–1,409] | 39,272 [38,271–40,273] | 11,556 [8,147–14,965] | $0.0034 [$0.0026–$0.0041] | 12.5 s [12.1 s–13.0 s] |
| sigmap-src/h025 | with | 2/2 | 4 [4–4] | 6 [6–6] | 816 [764–868] | 37,057 [36,890–37,223] | 8,662 [8,518–8,805] | $0.0025 [$0.0025–$0.0025] | 13.7 s [10.3 s–17.1 s] |
| sigmap-src/h026 | without | 2/2 | 5 [4–6] | 7 [6–8] | 1,336 [1,074–1,598] | 34,088 [28,128–40,048] | 6,383 [5,243–7,523] | $0.0023 [$0.0019–$0.0027] | 12.7 s [10.5 s–15.0 s] |
| sigmap-src/h026 | with | 2/2 | 3 [3–3] | 6 [6–6] | 889 [804–973] | 35,247 [34,866–35,628] | 5,908 [5,678–6,138] | $0.0020 [$0.0019–$0.0021] | 10.8 s [9.4 s–12.1 s] |
| sigmap-src/h027 | without | 2/2 | 4 [3–4] | 8 [6–10] | 1,007 [918–1,095] | 40,439 [27,560–53,318] | 9,053 [7,892–10,213] | $0.0027 [$0.0023–$0.0031] | 11.4 s [10.1 s–12.8 s] |
| sigmap-src/h027 | with | 2/2 | 2 [2–2] | 5 [4–6] | 698 [621–775] | 27,871 [21,318–34,423] | 6,805 [6,127–7,482] | $0.0020 [$0.0019–$0.0021] | 10.1 s [9.6 s–10.5 s] |
| sigmap-src/h028 | without | 2/2 | 3 [2–3] | 6 [6–6] | 856 [760–952] | 27,065 [26,759–27,371] | 5,933 [5,445–6,421] | $0.0019 [$0.0017–$0.0020] | 10.1 s [9.9 s–10.3 s] |
| sigmap-src/h028 | with | 2/2 | 2 [1–3] | 6 [4–8] | 725 [452–997] | 35,592 [20,694–50,490] | 6,428 [5,309–7,546] | $0.0020 [$0.0015–$0.0025] | 10.4 s [8.2 s–12.6 s] |
| sigmap-src/h029 | without | 2/2 | 4 [3–5] | 7 [6–8] | 1,126 [1,113–1,139] | 38,175 [29,422–46,928] | 10,714 [9,706–11,722] | $0.0031 [$0.0028–$0.0034] | 11.8 s [11.7 s–11.9 s] |
| sigmap-src/h029 | with | 2/2 | 2 [2–2] | 4 [4–4] | 792 [788–796] | 21,013 [20,690–21,336] | 7,365 [5,178–9,551] | $0.0021 [$0.0016–$0.0025] | 8.9 s [8.6 s–9.1 s] |
| sigmap-src/h030 | without | 2/2 | 3 [3–3] | 6 [6–6] | 1,062 [1,012–1,112] | 26,878 [26,553–27,203] | 7,235 [5,376–9,094] | $0.0022 [$0.0019–$0.0026] | 10.8 s [10.3 s–11.2 s] |
| sigmap-src/h030 | with | 2/2 | 3 [3–3] | 7 [6–8] | 897 [856–937] | 46,526 [38,628–54,423] | 9,219 [8,675–9,763] | $0.0028 [$0.0027–$0.0028] | 11.5 s [11.3 s–11.7 s] |

