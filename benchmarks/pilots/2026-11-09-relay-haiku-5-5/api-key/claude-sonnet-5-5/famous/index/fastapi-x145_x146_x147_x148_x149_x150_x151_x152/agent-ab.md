# Agent-level A/B — measured tool calls, tokens and cost

**anthropic-messages-api direct Messages API · claude-sonnet-5-5 · 2026-11-11 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap index strategy + 7-tool core MCP profile (the docs' setup for an agent that calls the tools).
- Both arms: the same prompt, model, tool allowlist (Read, Grep, Glob, Bash), per-run budget cap $0.25 and timeout 420 s; run in a clean copy of the commit pinned in `benchmarks/xrepo-repos.json`.
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
- Direct Messages API agent (scripts/lib/agent-ab-api.mjs), not Claude Code: a short neutral system prompt (about 150 tokens) and four read-only tools, so the prefix each turn re-reads is far smaller than Claude Code's and SigMap's per-turn addition is a larger share of a turn. Cost is computed from the usage the API reports and a price table (the Console's usage page is the authority), with 5-minute prompt caching. Not comparable cell by cell with Claude Code runs.

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
| Tool calls | −23% | −10% | fewer in every repetition |
| Input tokens (uncached) | 0% | 0% | fewer in every repetition |
| Output tokens | −14% | −2% | fewer in every repetition |
| Cache-read tokens | +22% | +106% | more in every repetition |
| Cache-write tokens | −64% | −56% | fewer in every repetition |
| Total tokens (derived) | −11% | +38% | mixed |
| Cost | −43% | −26% | fewer in every repetition |
| Wall time | −28% | −22% | fewer in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −21% [−35%, −6%] | −8% [−41%, +51%] † | fewer in every repetition, within the noise |
| Input tokens (uncached) | 0% [−1%, 0%] † | 0% [−1%, 0%] † | fewer in every repetition, within the noise |
| Output tokens | −15% [−23%, −5%] | −3% [−18%, +17%] † | fewer in every repetition, within the noise |
| Cache-read tokens | +47% [−5%, +127%] † | +139% [+60%, +257%] | more in every repetition, within the noise |
| Cache-write tokens | −64% [−77%, −43%] | −51% [−67%, −23%] n=7 | fewer in every repetition, outside the noise |
| Total tokens (derived) | +4% [−29%, +55%] † | +46% [+10%, +95%] | more in every repetition, within the noise |
| Cost | −40% [−55%, −19%] | −28% [−44%, −3%] | fewer in every repetition, outside the noise |
| Wall time | −25% [−37%, −12%] | −20% [−33%, −6%] | fewer in every repetition, outside the noise |

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
| fastapi | 3 | 3 | −1 | 4 / 2 / 2 |
| all | 3 | 3 | −1 | 4 / 2 / 2 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | 217 | 217 | −1 | 4 / 2 / 2 |
| all | 217 | 217 | −1 | 4 / 2 / 2 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | 535 | 481 | −65 | 7 / 0 / 1 |
| all | 535 | 481 | −65 | 7 / 0 / 1 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | 5,859 | 11,406 | +5,126 | 2 / 0 / 6 |
| all | 5,859 | 11,406 | +5,126 | 2 / 0 / 6 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | 4,982 | 2,188 | −3,432 | 7 / 0 / 1 |
| all | 4,982 | 2,188 | −3,432 | 7 / 0 / 1 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | 11,812 | 13,956 | +556 | 4 / 0 / 4 |
| all | 11,812 | 13,956 | +556 | 4 / 0 / 4 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd), or computed from the API's usage and a price table when the run went through the Messages API directly. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | $0.0194 | $0.0131 | −$0.0097 | 7 / 0 / 1 |
| all | $0.0194 | $0.0131 | −$0.0097 | 7 / 0 / 1 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | 6.8 s | 5.2 s | −1.6 s | 8 / 0 / 0 |
| all | 6.8 s | 5.2 s | −1.6 s | 8 / 0 / 0 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| fastapi | $0.3087 (16 runs) | $0.1975 (16 runs) | none | none |
| all | $0.3087 (16 runs) | $0.1975 (16 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| fastapi/x145 | without | 2/2 | 3 [2–4] | 217 [216–218] | 578 [456–700] | 11,225 [3,836–18,613] | 5,510 [2,400–8,620] | $0.0222 [$0.0118–$0.0327] | 10.4 s [9.2 s–11.6 s] |
| fastapi/x145 | with | 2/2 | 2 [2–2] | 216 [216–216] | 467 [391–542] | 10,239 [9,723–10,755] | 2,192 [1,519–2,864] | $0.0126 [$0.0103–$0.0150] | 5.2 s [5.1 s–5.3 s] |
| fastapi/x146 | without | 2/2 | 3 [3–3] | 219 [219–219] | 540 [514–566] | 5,179 [4,960–5,397] | 4,296 [4,133–4,458] | $0.0176 [$0.0170–$0.0182] | 6.0 s [5.9 s–6.2 s] |
| fastapi/x146 | with | 2/2 | 3 [3–3] | 219 [219–219] | 538 [530–546] | 11,559 [11,118–12,000] | 2,483 [2,093–2,872] | $0.0143 [$0.0134–$0.0153] | 5.7 s [5.7 s–5.7 s] |
| fastapi/x147 | without | 2/2 | 2 [2–2] | 215 [215–215] | 463 [462–464] | 6,101 [5,603–6,598] | 4,455 [3,979–4,930] | $0.0174 [$0.0161–$0.0187] | 5.4 s [5.1 s–5.7 s] |
| fastapi/x147 | with | 2/2 | 2 [2–2] | 215 [215–215] | 338 [327–348] | 11,253 [10,656–11,850] | 597 [0–1,194] | $0.0075 [$0.0063–$0.0088] | 4.6 s [4.4 s–4.9 s] |
| fastapi/x148 | without | 2/2 | 2 [1–3] | 208 [207–209] | 438 [358–517] | 5,617 [1,628–9,605] | 6,129 [4,636–7,621] | $0.0212 [$0.0159–$0.0266] | 5.0 s [4.3 s–5.7 s] |
| fastapi/x148 | with | 2/2 | 3 [2–3] | 209 [209–209] | 419 [356–481] | 10,717 [10,716–10,717] | 988 [881–1,095] | $0.0092 [$0.0083–$0.0101] | 4.8 s [4.7 s–4.9 s] |
| fastapi/x149 | without | 2/2 | 3 [2–3] | 211 [211–211] | 412 [381–442] | 2,955 [2,844–3,066] | 1,628 [1,374–1,882] | $0.0092 [$0.0082–$0.0102] | 4.8 s [4.8 s–4.8 s] |
| fastapi/x149 | with | 2/2 | 2 [1–2] | 210 [209–211] | 376 [372–380] | 8,759 [6,824–10,693] | 591 [534–648] | $0.0074 [$0.0069–$0.0079] | 4.1 s [4.0 s–4.2 s] |
| fastapi/x150 | without | 2/2 | 3 [2–3] | 216 [216–216] | 530 [487–572] | 3,910 [3,906–3,914] | 2,140 [2,074–2,205] | $0.0119 [$0.0113–$0.0124] | 9.2 s [7.8 s–10.6 s] |
| fastapi/x150 | with | 2/2 | 4 [3–4] | 217 [216–218] | 692 [621–762] | 14,514 [11,685–17,343] | 2,677 [2,427–2,927] | $0.0169 [$0.0150–$0.0188] | 6.6 s [5.9 s–7.3 s] |
| fastapi/x151 | without | 2/2 | 4 [4–4] | 224 [224–224] | 626 [612–640] | 13,256 [13,012–13,500] | 7,392 [6,497–8,287] | $0.0278 [$0.0255–$0.0302] | 7.5 s [5.8 s–9.2 s] |
| fastapi/x151 | with | 2/2 | 3 [2–3] | 223 [222–224] | 496 [450–541] | 13,732 [11,805–15,658] | 2,184 [2,119–2,248] | $0.0136 [$0.0129–$0.0143] | 5.1 s [4.7 s–5.5 s] |
| fastapi/x152 | without | 2/2 | 5 [4–5] | 220 [220–220] | 705 [649–761] | 12,169 [8,474–15,864] | 6,806 [4,960–8,652] | $0.0269 [$0.0210–$0.0329] | 10.7 s [10.1 s–11.3 s] |
| fastapi/x152 | with | 2/2 | 3 [2–3] | 218 [218–218] | 610 [574–646] | 12,009 [11,968–12,049] | 3,261 [3,097–3,424] | $0.0171 [$0.0163–$0.0178] | 8.2 s [7.4 s–8.9 s] |

