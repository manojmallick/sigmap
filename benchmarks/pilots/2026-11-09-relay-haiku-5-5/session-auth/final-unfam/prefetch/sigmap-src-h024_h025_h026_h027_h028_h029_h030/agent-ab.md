# Agent-level A/B — measured tool calls, tokens and cost

**claude-code 2.1.322 (Claude Code) · claude-haiku-5-5 · 2026-11-11 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap ranked the question BEFORE the first turn (what a prompt hook would inject): the five likeliest files with their signatures and line anchors after the question in the user turn, + the sigmap CLI; no MCP server, no standing section, no extra tool call.
- Both arms: the same prompt, model, tool allowlist (Read, Grep, Glob, Bash), per-run budget cap $0.5 and timeout 420 s; run in a clean copy of the commit pinned in `benchmarks/xrepo-repos.json`.
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
| sigmap-src | 7 | 11/14 | 14/14 | 0 / 0 |
| all | 7 | 11/14 | 14/14 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 7. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −38% | −9% | fewer in every repetition |
| Input tokens (uncached) | −26% | +3% | mixed |
| Output tokens | −22% | +1% | mixed |
| Cache-read tokens | −25% | +21% | mixed |
| Cache-write tokens | −2% | −26% | fewer in every repetition |
| Total tokens (derived) | −21% | +13% | mixed |
| Cost | −10% | −13% | fewer in every repetition |
| Wall time | −16% | +1% | mixed |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −44% [−61%, −15%] | −19% [−53%, +28%] † | fewer in every repetition, within the noise |
| Input tokens (uncached) | −29% [−44%, −8%] | −3% [−27%, +26%] † | fewer in every repetition, within the noise |
| Output tokens | −26% [−43%, −7%] | −3% [−29%, +36%] † | fewer in every repetition, within the noise |
| Cache-read tokens | −31% [−49%, −1%] | +15% [−20%, +62%] † | mixed |
| Cache-write tokens | +7% [−16%, +31%] † | −25% [−37%, −8%] | mixed |
| Total tokens (derived) | −23% [−40%, +3%] † | +8% [−22%, +50%] † | mixed |
| Cost | −6% [−18%, +12%] † | −13% [−32%, +11%] † | fewer in every repetition, within the noise |
| Wall time | −19% [−32%, −3%] | 0% [−19%, +24%] † | mixed |

### Outcome (hit@5), by repetition

Per paired task: **better** = the SigMap arm named the file and the other did not; **worse** = the reverse; **tie** = both found it or both missed. Localisation only.

| repetition | paired tasks | better | worse | tie |
| --- | ---: | ---: | ---: | ---: |
| R1 | 7 | 3 | 0 | 4 |
| R2 | 7 | 0 | 0 | 7 |
| all | 14 | 3 | 0 | 11 |

## Tool calls

Provenance: agent-reported (main-thread tool_use blocks). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 5 | 4 | −2 | 6 / 0 / 1 |
| all | 5 | 4 | −2 | 6 / 0 / 1 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 8 | 8 | −1 | 5 / 0 / 2 |
| all | 8 | 8 | −1 | 5 / 0 / 2 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 1,171 | 1,222 | −198 | 6 / 0 / 1 |
| all | 1,171 | 1,222 | −198 | 6 / 0 / 1 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 39,889 | 46,692 | −1,385 | 4 / 0 / 3 |
| all | 39,889 | 46,692 | −1,385 | 4 / 0 / 3 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 7,951 | 7,449 | −739 | 5 / 0 / 2 |
| all | 7,951 | 7,449 | −739 | 5 / 0 / 2 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 50,441 | 55,058 | −2,253 | 4 / 0 / 3 |
| all | 50,441 | 55,058 | −2,253 | 4 / 0 / 3 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | $0.0025 | $0.0025 | −$0.0003 | 5 / 0 / 2 |
| all | $0.0025 | $0.0025 | −$0.0003 | 5 / 0 / 2 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 10.8 s | 10.4 s | −1.6 s | 5 / 0 / 2 |
| all | 10.8 s | 10.4 s | −1.6 s | 5 / 0 / 2 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | $0.0456 (14 runs) | $0.0404 (14 runs) | none | none |
| all | $0.0456 (14 runs) | $0.0404 (14 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| sigmap-src/h024 | without | 1/2 | 10 [9–10] | 16 [14–18] | 2,992 [2,721–3,263] | 126,715 [110,623–142,806] | 20,836 [19,625–22,047] | $0.0069 [$0.0064–$0.0075] | 21.6 s [20.3 s–22.9 s] |
| sigmap-src/h024 | with | 2/2 | 9 [8–10] | 17 [14–20] | 2,850 [2,679–3,021] | 141,027 [107,200–174,854] | 13,689 [11,780–15,598] | $0.0056 [$0.0048–$0.0064] | 21.7 s [21.3 s–22.2 s] |
| sigmap-src/h025 | without | 2/2 | 6 [4–7] | 9 [6–12] | 1,854 [1,285–2,422] | 56,351 [27,405–85,297] | 11,516 [7,772–15,259] | $0.0038 [$0.0025–$0.0051] | 14.7 s [11.3 s–18.1 s] |
| sigmap-src/h025 | with | 2/2 | 4 [2–5] | 8 [4–12] | 1,547 [623–2,471] | 54,967 [18,052–91,881] | 10,955 [9,636–12,274] | $0.0035 [$0.0024–$0.0046] | 13.0 s [7.0 s–19.0 s] |
| sigmap-src/h026 | without | 2/2 | 6 [4–7] | 9 [6–12] | 1,356 [999–1,712] | 46,942 [27,288–66,595] | 6,134 [5,332–6,935] | $0.0024 [$0.0018–$0.0029] | 12.1 s [9.2 s–14.9 s] |
| sigmap-src/h026 | with | 2/2 | 4 [3–5] | 8 [6–10] | 1,293 [833–1,752] | 50,979 [32,495–69,463] | 7,449 [6,750–8,148] | $0.0026 [$0.0024–$0.0029] | 11.1 s [8.4 s–13.9 s] |
| sigmap-src/h027 | without | 1/2 | 4 [2–5] | 7 [6–8] | 1,044 [924–1,163] | 34,443 [28,777–40,108] | 7,951 [6,319–9,582] | $0.0025 [$0.0020–$0.0029] | 10.2 s [9.4 s–11.1 s] |
| sigmap-src/h027 | with | 2/2 | 1 [1–1] | 4 [4–4] | 609 [522–696] | 20,223 [18,653–21,792] | 6,796 [5,243–8,349] | $0.0019 [$0.0016–$0.0021] | 7.4 s [7.1 s–7.7 s] |
| sigmap-src/h028 | without | 2/2 | 3 [2–3] | 6 [6–6] | 808 [786–830] | 28,334 [27,383–29,285] | 6,405 [5,445–7,364] | $0.0020 [$0.0018–$0.0022] | 8.3 s [7.9 s–8.7 s] |
| sigmap-src/h028 | with | 2/2 | 5 [3–6] | 8 [8–8] | 1,222 [915–1,529] | 46,692 [45,492–47,892] | 7,136 [5,572–8,699] | $0.0025 [$0.0024–$0.0027] | 10.4 s [9.7 s–11.1 s] |
| sigmap-src/h029 | without | 1/2 | 4 [3–4] | 7 [6–8] | 1,104 [959–1,248] | 39,116 [30,784–47,448] | 10,215 [9,456–10,973] | $0.0030 [$0.0028–$0.0031] | 10.0 s [9.7 s–10.4 s] |
| sigmap-src/h029 | with | 2/2 | 2 [1–3] | 4 [4–4] | 798 [759–837] | 20,022 [18,524–21,520] | 7,552 [5,344–9,760] | $0.0021 [$0.0017–$0.0026] | 8.4 s [7.2 s–9.5 s] |
| sigmap-src/h030 | without | 2/2 | 5 [3–6] | 8 [6–10] | 1,171 [975–1,367] | 39,889 [27,193–52,585] | 6,620 [5,142–8,097] | $0.0023 [$0.0018–$0.0028] | 10.8 s [8.8 s–12.7 s] |
| sigmap-src/h030 | with | 2/2 | 3 [2–3] | 6 [6–6] | 973 [689–1,257] | 32,435 [31,032–33,838] | 5,881 [4,088–7,673] | $0.0020 [$0.0015–$0.0025] | 9.2 s [8.4 s–9.9 s] |

