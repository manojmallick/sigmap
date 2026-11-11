# Agent-level A/B — measured tool calls, tokens and cost

**anthropic-messages-api direct Messages API · claude-haiku-4-5 · 2026-11-11 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap index strategy + 7-tool core MCP profile (the docs' setup for an agent that calls the tools).
- Both arms: the same prompt, model, tool allowlist (Read, Grep, Glob, Bash), per-run budget cap $0.25 and timeout 420 s; run in a clean copy of the commit pinned in `benchmarks/xrepo-repos.json`.
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
- Direct Messages API agent (scripts/lib/agent-ab-api.mjs), not Claude Code: a short neutral system prompt (about 150 tokens) and four read-only tools, so the prefix each turn re-reads is far smaller than Claude Code's and SigMap's per-turn addition is a larger share of a turn. Cost is computed from the usage the API reports and a price table (the Console's usage page is the authority), with 5-minute prompt caching. Not comparable cell by cell with Claude Code runs.

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
| Tool calls | −20% | −15% | fewer in every repetition |
| Input tokens (uncached) | −57% | −46% | fewer in every repetition |
| Output tokens | −9% | −8% | fewer in every repetition |
| Cache-read tokens | +68% | +12% | more in every repetition |
| Cache-write tokens | +46% | +9% | more in every repetition |
| Total tokens (derived) | +56% | +8% | more in every repetition |
| Cost | +24% | −2% | mixed |
| Wall time | −3% | −6% | fewer in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −13% [−35%, +19%] † | −12% [−28%, +7%] † | fewer in every repetition, within the noise |
| Input tokens (uncached) | −47% [−70%, −7%] | −44% [−66%, −8%] | fewer in every repetition, outside the noise |
| Output tokens | +1% [−27%, +61%] † | −7% [−26%, +21%] † | mixed |
| Cache-read tokens | +104% [−15%, +371%] † | +25% [−39%, +165%] † | more in every repetition, within the noise |
| Cache-write tokens | +45% [0%, +94%] † | +9% [−31%, +72%] † | more in every repetition, within the noise |
| Total tokens (derived) | +68% [−13%, +192%] † | +19% [−36%, +131%] † | more in every repetition, within the noise |
| Cost | +26% [−12%, +72%] † | +2% [−28%, +59%] † | more in every repetition, within the noise |
| Wall time | +5% [−23%, +64%] † | −3% [−25%, +26%] † | mixed |

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
| flask | 13 | 10 | −4 | 4 / 0 / 1 |
| all | 13 | 10 | −4 | 4 / 0 / 1 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | 7,366 | 3,121 | −2,601 | 4 / 0 / 1 |
| all | 7,366 | 3,121 | −2,601 | 4 / 0 / 1 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | 1,508 | 1,249 | −265 | 4 / 0 / 1 |
| all | 1,508 | 1,249 | −265 | 4 / 0 / 1 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | 95,574 | 102,161 | +11,566 | 2 / 0 / 3 |
| all | 95,574 | 102,161 | +11,566 | 2 / 0 / 3 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | 16,410 | 17,403 | +3,547 | 2 / 0 / 3 |
| all | 16,410 | 17,403 | +3,547 | 2 / 0 / 3 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | 120,461 | 123,906 | +7,822 | 2 / 0 / 3 |
| all | 120,461 | 123,906 | +7,822 | 2 / 0 / 3 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd), or computed from the API's usage and a price table when the run went through the Messages API directly. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | $0.0447 | $0.0413 | −$0.0033 | 3 / 0 / 2 |
| all | $0.0447 | $0.0413 | −$0.0033 | 3 / 0 / 2 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | 18.4 s | 15.4 s | −3.1 s | 4 / 0 / 1 |
| all | 18.4 s | 15.4 s | −3.1 s | 4 / 0 / 1 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| flask | $0.4392 (10 runs) | $0.4852 (10 runs) | none | none |
| all | $0.4392 (10 runs) | $0.4852 (10 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| flask/x032 | without | 2/2 | 21 [20–21] | 10,327 [10,256–10,398] | 2,295 [1,973–2,616] | 95,574 [73,009–118,138] | 12,266 [10,274–14,258] | $0.0467 [$0.0404–$0.0530] | 25.2 s [21.5 s–28.8 s] |
| flask/x032 | with | 2/2 | 17 [16–17] | 3,131 [3,122–3,140] | 2,089 [2,069–2,109] | 221,544 [106,060–337,028] | 22,497 [14,103–30,890] | $0.0639 [$0.0417–$0.0860] | 24.6 s [22.6 s–26.7 s] |
| flask/x033 | without | 2/2 | 19 [16–21] | 10,005 [8,353–11,657] | 2,117 [1,972–2,261] | 209,880 [147,731–272,029] | 21,693 [19,881–23,505] | $0.0687 [$0.0611–$0.0762] | 25.5 s [22.8 s–28.1 s] |
| flask/x033 | with | 2/2 | 13 [12–14] | 3,121 [3,116–3,126] | 1,710 [1,646–1,773] | 221,446 [201,455–241,437] | 25,240 [20,701–29,779] | $0.0654 [$0.0574–$0.0733] | 20.7 s [19.9 s–21.6 s] |
| flask/x034 | without | 2/2 | 7 [5–8] | 2,567 [2,435–2,699] | 678 [481–874] | 19,398 [6,634–32,162] | 8,312 [6,986–9,638] | $0.0183 [$0.0142–$0.0223] | 8.1 s [5.8 s–10.4 s] |
| flask/x034 | with | 2/2 | 9 [8–10] | 3,093 [3,084–3,102] | 1,249 [1,186–1,312] | 102,161 [57,238–147,083] | 17,403 [12,551–22,255] | $0.0413 [$0.0304–$0.0522] | 15.4 s [13.8 s–16.9 s] |
| flask/x035 | without | 2/2 | 13 [11–15] | 5,699 [2,774–8,623] | 1,508 [1,422–1,594] | 109,608 [67,663–151,553] | 16,410 [13,747–19,072] | $0.0447 [$0.0397–$0.0497] | 18.4 s [17.3 s–19.5 s] |
| flask/x035 | with | 2/2 | 10 [8–11] | 3,098 [3,088–3,108] | 1,145 [1,015–1,275] | 97,380 [69,745–125,015] | 14,611 [13,631–15,590] | $0.0368 [$0.0322–$0.0415] | 15.3 s [13.1 s–17.4 s] |
| flask/x036 | without | 2/2 | 9 [7–11] | 7,366 [6,117–8,615] | 1,238 [1,092–1,384] | 68,751 [30,568–106,933] | 16,624 [16,076–17,172] | $0.0412 [$0.0372–$0.0452] | 15.0 s [13.5 s–16.6 s] |
| flask/x036 | with | 2/2 | 8 [7–8] | 5,095 [3,075–7,115] | 973 [951–995] | 47,192 [36,336–58,048] | 16,447 [8,425–24,468] | $0.0352 [$0.0260–$0.0444] | 11.8 s [11.5 s–12.2 s] |

