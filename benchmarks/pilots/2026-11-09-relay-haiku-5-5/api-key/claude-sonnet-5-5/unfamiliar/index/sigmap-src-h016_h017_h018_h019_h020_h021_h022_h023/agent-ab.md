# Agent-level A/B — measured tool calls, tokens and cost

**anthropic-messages-api direct Messages API · claude-sonnet-5-5 · 2026-11-11 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap index strategy + 7-tool core MCP profile (the docs' setup for an agent that calls the tools).
- Both arms: the same prompt, model, tool allowlist (Read, Grep, Glob, Bash), per-run budget cap $0.25 and timeout 420 s; run in a clean copy of the commit pinned in `benchmarks/xrepo-repos.json`.
- Questions: the task id(s) h016, h017, h018, h019, h020, h021, h022, h023 of `benchmarks/tasks/retrieval-xrepo.jsonl`. Pass = hit@5 on the repository-relative paths the answer names.
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
| sigmap-src | 8 | 14/16 | 16/16 | 0 / 0 |
| all | 8 | 14/16 | 16/16 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 8. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −39% | −53% | fewer in every repetition |
| Input tokens (uncached) | −1% | −2% | fewer in every repetition |
| Output tokens | −25% | −35% | fewer in every repetition |
| Cache-read tokens | −26% | −36% | fewer in every repetition |
| Cache-write tokens | −47% | −57% | fewer in every repetition |
| Total tokens (derived) | −32% | −42% | fewer in every repetition |
| Cost | −39% | −49% | fewer in every repetition |
| Wall time | −30% | −40% | fewer in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −51% [−68%, −23%] | −60% [−77%, −31%] | fewer in every repetition, outside the noise |
| Input tokens (uncached) | −2% [−3%, 0%] † | −2% [−3%, 0%] | fewer in every repetition, within the noise |
| Output tokens | −33% [−51%, −9%] | −40% [−58%, −14%] | fewer in every repetition, outside the noise |
| Cache-read tokens | −41% [−65%, +16%] † | −32% [−65%, +43%] † | fewer in every repetition, within the noise |
| Cache-write tokens | −54% [−71%, −24%] | −47% [−65%, −20%] n=6 | fewer in every repetition, outside the noise |
| Total tokens (derived) | −42% [−63%, +4%] † | −44% [−67%, −1%] | fewer in every repetition, within the noise |
| Cost | −45% [−63%, −14%] | −57% [−75%, −26%] | fewer in every repetition, outside the noise |
| Wall time | −37% [−48%, −17%] | −42% [−56%, −23%] | fewer in every repetition, outside the noise |

### Outcome (hit@5), by repetition

Per paired task: **better** = the SigMap arm named the file and the other did not; **worse** = the reverse; **tie** = both found it or both missed. Localisation only.

| repetition | paired tasks | better | worse | tie |
| --- | ---: | ---: | ---: | ---: |
| R1 | 8 | 1 | 0 | 7 |
| R2 | 8 | 1 | 0 | 7 |
| all | 16 | 2 | 0 | 14 |

## Tool calls

Provenance: agent-reported (main-thread tool_use blocks). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 6 | 2 | −3 | 7 / 0 / 1 |
| all | 6 | 2 | −3 | 7 / 0 / 1 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 184 | 181 | −5 | 6 / 1 / 1 |
| all | 184 | 181 | −5 | 6 / 1 / 1 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 818 | 488 | −262 | 7 / 0 / 1 |
| all | 818 | 488 | −262 | 7 / 0 / 1 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 22,028 | 8,400 | −13,938 | 6 / 0 / 2 |
| all | 22,028 | 8,400 | −13,938 | 6 / 0 / 2 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 8,228 | 3,315 | −5,978 | 7 / 0 / 1 |
| all | 8,228 | 3,315 | −5,978 | 7 / 0 / 1 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 32,492 | 13,973 | −19,095 | 7 / 0 / 1 |
| all | 32,492 | 13,973 | −19,095 | 7 / 0 / 1 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd), or computed from the API's usage and a price table when the run went through the Messages API directly. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | $0.0327 | $0.0194 | −$0.0196 | 7 / 0 / 1 |
| all | $0.0327 | $0.0194 | −$0.0196 | 7 / 0 / 1 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 9.1 s | 4.5 s | −4.3 s | 7 / 0 / 1 |
| all | 9.1 s | 4.5 s | −4.3 s | 7 / 0 / 1 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | $0.5270 (16 runs) | $0.2968 (16 runs) | none | none |
| all | $0.5270 (16 runs) | $0.2968 (16 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| sigmap-src/h016 | without | 2/2 | 4 [4–4] | 181 [180–182] | 818 [781–854] | 19,093 [16,381–21,804] | 8,239 [6,570–9,907] | $0.0330 [$0.0297–$0.0362] | 9.0 s [8.4 s–9.6 s] |
| sigmap-src/h016 | with | 2/2 | 1 [1–1] | 176 [176–176] | 279 [266–291] | 6,160 [6,160–6,160] | 2,093 [2,060–2,125] | $0.0096 [$0.0094–$0.0098] | 3.9 s [3.4 s–4.5 s] |
| sigmap-src/h017 | without | 2/2 | 7 [6–8] | 187 [185–189] | 1,096 [968–1,224] | 31,009 [22,882–39,136] | 10,228 [9,222–11,234] | $0.0431 [$0.0377–$0.0485] | 11.9 s [10.3 s–13.5 s] |
| sigmap-src/h017 | with | 2/2 | 3 [2–4] | 182 [181–183] | 713 [564–861] | 14,132 [11,351–16,912] | 2,608 [2,437–2,778] | $0.0168 [$0.0144–$0.0193] | 7.7 s [6.5 s–8.9 s] |
| sigmap-src/h018 | without | 2/2 | 6 [5–7] | 187 [186–188] | 776 [733–818] | 22,080 [19,331–24,828] | 9,029 [8,967–9,090] | $0.0351 [$0.0348–$0.0354] | 7.7 s [7.7 s–7.8 s] |
| sigmap-src/h018 | with | 2/2 | 1 [1–1] | 180 [180–180] | 268 [258–277] | 7,136 [6,160–8,111] | 976 [0–1,951] | $0.0069 [$0.0048–$0.0090] | 3.3 s [3.3 s–3.3 s] |
| sigmap-src/h019 | without | 2/2 | 7 [5–8] | 188 [185–191] | 819 [701–936] | 26,716 [15,335–38,096] | 7,385 [6,850–7,919] | $0.0324 [$0.0276–$0.0372] | 9.2 s [7.4 s–10.9 s] |
| sigmap-src/h019 | with | 2/2 | 2 [1–2] | 182 [181–183] | 369 [281–456] | 9,664 [8,124–11,204] | 1,307 [0–2,613] | $0.0092 [$0.0048–$0.0137] | 4.1 s [3.6 s–4.5 s] |
| sigmap-src/h020 | without | 2/2 | 6 [6–6] | 185 [184–186] | 851 [781–921] | 21,977 [15,613–28,341] | 9,900 [9,006–10,793] | $0.0380 [$0.0338–$0.0422] | 13.9 s [12.7 s–15.1 s] |
| sigmap-src/h020 | with | 2/2 | 5 [4–5] | 185 [184–186] | 724 [711–736] | 21,891 [16,856–26,925] | 4,022 [2,969–5,075] | $0.0220 [$0.0205–$0.0235] | 8.3 s [7.9 s–8.7 s] |
| sigmap-src/h021 | without | 2/2 | 5 [5–5] | 181 [181–181] | 820 [803–836] | 11,594 [11,552–11,636] | 5,266 [5,215–5,316] | $0.0240 [$0.0237–$0.0243] | 11.7 s [11.7 s–11.7 s] |
| sigmap-src/h021 | with | 2/2 | 8 [6–9] | 186 [183–189] | 1,121 [926–1,316] | 40,205 [25,996–54,414] | 6,204 [4,390–8,017] | $0.0351 [$0.0258–$0.0445] | 13.9 s [10.6 s–17.2 s] |
| sigmap-src/h022 | without | 2/2 | 3 [2–3] | 178 [177–179] | 516 [454–578] | 5,400 [1,628–9,171] | 7,527 [6,729–8,325] | $0.0254 [$0.0220–$0.0288] | 5.1 s [4.1 s–6.2 s] |
| sigmap-src/h022 | with | 2/2 | 2 [2–2] | 177 [177–177] | 439 [392–486] | 6,160 [6,160–6,160] | 6,706 [6,669–6,743] | $0.0227 [$0.0222–$0.0233] | 4.3 s [4.0 s–4.6 s] |
| sigmap-src/h023 | without | 0/2 | 5 [5–5] | 183 [183–183] | 677 [669–684] | 23,953 [23,902–24,003] | 8,218 [7,999–8,436] | $0.0325 [$0.0320–$0.0329] | 8.4 s [8.3 s–8.4 s] |
| sigmap-src/h023 | with | 2/2 | 2 [2–2] | 177 [177–177] | 536 [503–569] | 6,160 [6,160–6,160] | 7,590 [7,557–7,623] | $0.0259 [$0.0255–$0.0263] | 4.7 s [4.6 s–4.7 s] |

