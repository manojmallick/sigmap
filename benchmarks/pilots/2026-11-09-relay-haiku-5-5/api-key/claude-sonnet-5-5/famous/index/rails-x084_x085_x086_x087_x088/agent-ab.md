# Agent-level A/B — measured tool calls, tokens and cost

**anthropic-messages-api direct Messages API · claude-sonnet-5-5 · 2026-11-11 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap index strategy + 7-tool core MCP profile (the docs' setup for an agent that calls the tools).
- Both arms: the same prompt, model, tool allowlist (Read, Grep, Glob, Bash), per-run budget cap $0.25 and timeout 420 s; run in a clean copy of the commit pinned in `benchmarks/xrepo-repos.json`.
- Questions: the task id(s) x084, x085, x086, x087, x088 of `benchmarks/tasks/retrieval-xrepo.jsonl`. Pass = hit@5 on the repository-relative paths the answer names.
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
| rails | 5 | 10/10 | 10/10 | 0 / 0 |
| all | 5 | 10/10 | 10/10 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 5. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −14% | +44% | mixed |
| Input tokens (uncached) | 0% | 0% | mixed |
| Output tokens | −10% | +24% | mixed |
| Cache-read tokens | +76% | +362% | more in every repetition |
| Cache-write tokens | −38% | −27% | fewer in every repetition |
| Total tokens (derived) | +29% | +121% | more in every repetition |
| Cost | −20% | +3% | mixed |
| Wall time | −20% | −6% | fewer in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −12% [−31%, +18%] † | +48% [−10%, +164%] † | mixed |
| Input tokens (uncached) | 0% [−1%, 0%] † | 0% [0%, +1%] † | mixed |
| Output tokens | −10% [−18%, −1%] | +22% [−4%, +64%] † | mixed |
| Cache-read tokens | +135% [+50%, +248%] | +368% [+204%, +703%] | more in every repetition, outside the noise |
| Cache-write tokens | −28% [−49%, +6%] † | −34% [−69%, +32%] † | fewer in every repetition, within the noise |
| Total tokens (derived) | +55% [+12%, +97%] | +110% [+43%, +248%] | more in every repetition, outside the noise |
| Cost | −12% [−31%, +6%] † | −2% [−37%, +60%] † | fewer in every repetition, within the noise |
| Wall time | −17% [−35%, +7%] † | −7% [−39%, +49%] † | fewer in every repetition, within the noise |

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
| rails | 2 | 2 | 0 | 1 / 2 / 2 |
| all | 2 | 2 | 0 | 1 / 2 / 2 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | 214 | 215 | 0 | 1 / 2 / 2 |
| all | 214 | 215 | 0 | 1 / 2 / 2 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | 509 | 581 | −22 | 3 / 0 / 2 |
| all | 509 | 581 | −22 | 3 / 0 / 2 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | 3,208 | 9,815 | +6,310 | 0 / 0 / 5 |
| all | 3,208 | 9,815 | +6,310 | 0 / 0 / 5 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | 3,452 | 2,348 | −1,463 | 4 / 0 / 1 |
| all | 3,452 | 2,348 | −1,463 | 4 / 0 / 1 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | 7,279 | 12,599 | +4,549 | 0 / 0 / 5 |
| all | 7,279 | 12,599 | +4,549 | 0 / 0 / 5 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd), or computed from the API's usage and a price table when the run went through the Messages API directly. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | $0.0149 | $0.0132 | −$0.0017 | 4 / 0 / 1 |
| all | $0.0149 | $0.0132 | −$0.0017 | 4 / 0 / 1 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | 5.8 s | 5.7 s | −1.2 s | 3 / 0 / 2 |
| all | 5.8 s | 5.7 s | −1.2 s | 3 / 0 / 2 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| rails | $0.1714 (10 runs) | $0.1561 (10 runs) | none | none |
| all | $0.1714 (10 runs) | $0.1561 (10 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| rails/x084 | without | 2/2 | 2 [1–3] | 208 [207–209] | 469 [363–574] | 2,514 [1,628–3,400] | 4,088 [2,883–5,293] | $0.0158 [$0.0140–$0.0176] | 7.5 s [6.7 s–8.3 s] |
| rails/x084 | with | 2/2 | 2 [2–2] | 208 [207–209] | 447 [417–477] | 8,824 [7,428–10,220] | 2,348 [957–3,739] | $0.0125 [$0.0085–$0.0166] | 4.1 s [3.8 s–4.5 s] |
| rails/x085 | without | 2/2 | 2 [1–2] | 214 [213–215] | 509 [429–589] | 3,682 [1,628–5,735] | 3,452 [3,272–3,631] | $0.0149 [$0.0132–$0.0165] | 5.3 s [4.7 s–5.9 s] |
| rails/x085 | with | 2/2 | 2 [1–3] | 214 [213–215] | 581 [542–620] | 9,815 [7,428–12,202] | 1,989 [1,783–2,195] | $0.0132 [$0.0118–$0.0146] | 5.7 s [5.0 s–6.5 s] |
| rails/x086 | without | 2/2 | 3 [3–3] | 233 [233–233] | 529 [514–543] | 3,208 [3,205–3,210] | 1,071 [1,025–1,116] | $0.0091 [$0.0088–$0.0093] | 5.8 s [5.7 s–5.9 s] |
| rails/x086 | with | 2/2 | 2 [2–2] | 231 [231–231] | 434 [419–448] | 7,428 [7,428–7,428] | 1,024 [1,023–1,024] | $0.0088 [$0.0087–$0.0090] | 4.6 s [4.6 s–4.7 s] |
| rails/x087 | without | 2/2 | 1 [1–1] | 213 [213–213] | 467 [434–499] | 1,628 [1,628–1,628] | 2,714 [2,714–2,714] | $0.0122 [$0.0119–$0.0125] | 4.3 s [4.1 s–4.5 s] |
| rails/x087 | with | 2/2 | 3 [1–4] | 215 [213–217] | 705 [505–905] | 13,912 [7,428–20,396] | 3,564 [1,655–5,473] | $0.0192 [$0.0111–$0.0272] | 7.3 s [5.4 s–9.2 s] |
| rails/x088 | without | 2/2 | 4 [3–5] | 218 [217–219] | 835 [740–930] | 11,963 [5,863–18,063] | 9,027 [7,738–10,316] | $0.0337 [$0.0284–$0.0391] | 10.4 s [8.8 s–11.9 s] |
| rails/x088 | with | 2/2 | 4 [4–4] | 219 [219–219] | 782 [762–801] | 20,534 [19,232–21,836] | 4,793 [4,149–5,436] | $0.0243 [$0.0223–$0.0264] | 7.1 s [7.0 s–7.1 s] |

