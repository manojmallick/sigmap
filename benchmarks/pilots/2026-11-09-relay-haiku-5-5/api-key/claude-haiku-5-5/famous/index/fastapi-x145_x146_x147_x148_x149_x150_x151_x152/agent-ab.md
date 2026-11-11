# Agent-level A/B — measured tool calls, tokens and cost

**anthropic-messages-api direct Messages API · claude-haiku-5-5 · 2026-11-11 · 4 runs per arm · publishable**

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
| fastapi | 8 | 32/32 | 32/32 | 0 / 0 |
| all | 8 | 32/32 | 32/32 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2, R3, R4) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 8. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | R3 | R4 | verdict |
| --- | ---: | ---: | ---: | ---: | ---: |
| Tool calls | −25% | −12% | −17% | −22% | fewer in every repetition |
| Input tokens (uncached) | 0% | 0% | 0% | 0% | fewer in every repetition |
| Output tokens | −1% | −6% | −19% | −18% | fewer in every repetition |
| Cache-read tokens | +9% | +85% | +47% | +10% | more in every repetition |
| Cache-write tokens | −55% | −42% | −37% | −66% | fewer in every repetition |
| Total tokens (derived) | −13% | +33% | +14% | −16% | mixed |
| Cost | −33% | −20% | −24% | −42% | fewer in every repetition |
| Wall time | +7% | +10% | −9% | −9% | mixed |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | R3 | R4 | verdict |
| --- | ---: | ---: | ---: | ---: | ---: |
| Tool calls | −23% [−37%, −4%] | −12% [−29%, +6%] † | −18% [−40%, +7%] † | −17% [−34%, +5%] † | fewer in every repetition, within the noise |
| Input tokens (uncached) | 0% [−1%, 0%] † | 0% [0%, 0%] † | 0% [−1%, 0%] † | 0% [−1%, 0%] | fewer in every repetition, within the noise |
| Output tokens | −1% [−11%, +11%] † | −6% [−16%, +3%] † | −18% [−25%, −9%] | −16% [−29%, 0%] † | fewer in every repetition, within the noise |
| Cache-read tokens | +29% [−17%, +106%] † | +103% [+44%, +171%] | +58% [−1%, +128%] † | +41% [−13%, +127%] † | more in every repetition, within the noise |
| Cache-write tokens | −51% [−61%, −37%] | −36% [−57%, −10%] | −41% [−64%, −7%] | −62% [−78%, −34%] | fewer in every repetition, outside the noise |
| Total tokens (derived) | 0% [−30%, +45%] † | +45% [+5%, +95%] | +18% [−20%, +61%] † | +1% [−33%, +52%] † | mixed |
| Cost | −29% [−40%, −14%] | −15% [−35%, +6%] † | −24% [−41%, −3%] | −38% [−55%, −14%] | fewer in every repetition, within the noise |
| Wall time | +5% [−8%, +26%] † | +7% [−6%, +26%] † | −9% [−23%, +12%] † | −7% [−22%, +11%] † | mixed |

### Outcome (hit@5), by repetition

Per paired task: **better** = the SigMap arm named the file and the other did not; **worse** = the reverse; **tie** = both found it or both missed. Localisation only.

| repetition | paired tasks | better | worse | tie |
| --- | ---: | ---: | ---: | ---: |
| R1 | 8 | 0 | 0 | 8 |
| R2 | 8 | 0 | 0 | 8 |
| R3 | 8 | 0 | 0 | 8 |
| R4 | 8 | 0 | 0 | 8 |
| all | 32 | 0 | 0 | 32 |

## Tool calls

Provenance: agent-reported (main-thread tool_use blocks). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | 3 | 3 | −1 | 5 / 3 / 0 |
| all | 3 | 3 | −1 | 5 / 3 / 0 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | 217 | 216 | −1 | 4 / 4 / 0 |
| all | 217 | 216 | −1 | 4 / 4 / 0 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | 796 | 683 | −113 | 7 / 0 / 1 |
| all | 796 | 683 | −113 | 7 / 0 / 1 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | 10,330 | 12,689 | +2,157 | 1 / 0 / 7 |
| all | 10,330 | 12,689 | +2,157 | 1 / 0 / 7 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | 6,266 | 2,155 | −3,132 | 7 / 0 / 1 |
| all | 6,266 | 2,155 | −3,132 | 7 / 0 / 1 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | 17,318 | 16,218 | −824 | 4 / 0 / 4 |
| all | 17,318 | 16,218 | −824 | 4 / 0 / 4 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd), or computed from the API's usage and a price table when the run went through the Messages API directly. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | $0.0013 | $0.0008 | −$0.0004 | 7 / 0 / 1 |
| all | $0.0013 | $0.0008 | −$0.0004 | 7 / 0 / 1 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | 4.8 s | 4.5 s | −416 ms | 5 / 0 / 3 |
| all | 4.8 s | 4.5 s | −416 ms | 5 / 0 / 3 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| fastapi | $0.0391 (32 runs) | $0.0273 (32 runs) | none | none |
| all | $0.0391 (32 runs) | $0.0273 (32 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| fastapi/x145 | without | 4/4 | 4 [3–4] | 218 [216–218] | 871 [653–971] | 17,556 [7,610–20,638] | 9,270 [7,412–11,668] | $0.0018 [$0.0015–$0.0020] | 5.1 s [4.3 s–5.4 s] |
| fastapi/x145 | with | 4/4 | 2 [1–2] | 216 [214–216] | 660 [630–785] | 11,309 [6,824–14,568] | 2,013 [987–4,462] | $0.0007 [$0.0006–$0.0011] | 4.3 s [3.7 s–4.9 s] |
| fastapi/x146 | without | 4/4 | 3 [3–4] | 221 [221–221] | 820 [803–1,161] | 13,933 [10,287–16,899] | 6,637 [4,242–8,855] | $0.0015 [$0.0011–$0.0017] | 5.6 s [5.1 s–6.8 s] |
| fastapi/x146 | with | 4/4 | 3 [3–4] | 219 [219–221] | 682 [595–874] | 14,390 [12,628–16,431] | 4,395 [2,669–7,209] | $0.0011 [$0.0009–$0.0014] | 4.5 s [3.8 s–5.2 s] |
| fastapi/x147 | without | 4/4 | 2 [2–2] | 215 [215–215] | 564 [509–598] | 3,331 [3,103–3,563] | 1,663 [1,435–1,895] | $0.0005 [$0.0005–$0.0006] | 3.6 s [3.5 s–3.9 s] |
| fastapi/x147 | with | 4/4 | 2 [2–3] | 215 [215–215] | 526 [486–748] | 11,048 [10,916–11,167] | 1,689 [1,500–1,881] | $0.0006 [$0.0006–$0.0007] | 3.4 s [3.3 s–3.8 s] |
| fastapi/x148 | without | 4/4 | 5 [2–5] | 211 [209–213] | 772 [642–912] | 13,611 [6,411–27,887] | 6,626 [2,573–9,686] | $0.0014 [$0.0008–$0.0019] | 4.4 s [4.0 s–5.6 s] |
| fastapi/x148 | with | 4/4 | 3 [3–4] | 210 [209–211] | 684 [609–787] | 14,360 [11,420–17,146] | 2,136 [1,544–2,973] | $0.0008 [$0.0006–$0.0009] | 4.5 s [3.7 s–5.1 s] |
| fastapi/x149 | without | 4/4 | 3 [2–3] | 212 [211–213] | 672 [631–829] | 6,640 [4,772–11,778] | 5,906 [5,107–7,477] | $0.0012 [$0.0011–$0.0013] | 4.0 s [3.8 s–5.3 s] |
| fastapi/x149 | with | 4/4 | 3 [2–4] | 212 [211–215] | 752 [539–830] | 15,036 [10,978–20,664] | 1,884 [1,385–5,128] | $0.0008 [$0.0006–$0.0013] | 7.1 s [5.5 s–9.0 s] |
| fastapi/x150 | without | 4/4 | 3 [2–3] | 216 [216–218] | 597 [458–715] | 3,698 [3,468–6,820] | 3,072 [2,036–3,337] | $0.0007 [$0.0006–$0.0008] | 3.6 s [3.1 s–4.7 s] |
| fastapi/x150 | with | 4/4 | 2 [2–2] | 216 [216–216] | 551 [519–690] | 11,830 [11,754–12,930] | 2,173 [2,065–3,187] | $0.0007 [$0.0007–$0.0008] | 3.7 s [3.7 s–4.3 s] |
| fastapi/x151 | without | 4/4 | 4 [2–4] | 223 [222–224] | 868 [681–1,024] | 12,091 [7,620–16,613] | 7,609 [6,584–8,565] | $0.0015 [$0.0013–$0.0017] | 5.1 s [3.9 s–5.8 s] |
| fastapi/x151 | with | 4/4 | 3 [2–3] | 223 [222–224] | 692 [633–759] | 13,549 [11,569–25,075] | 2,724 [2,185–6,776] | $0.0008 [$0.0008–$0.0015] | 4.5 s [4.1 s–5.1 s] |
| fastapi/x152 | without | 4/4 | 5 [5–6] | 220 [220–220] | 1,128 [1,001–1,274] | 8,568 [6,601–10,086] | 4,213 [3,235–5,554] | $0.0012 [$0.0010–$0.0014] | 6.0 s [5.5 s–6.5 s] |
| fastapi/x152 | with | 4/4 | 4 [3–4] | 218 [218–220] | 960 [841–1,141] | 11,424 [10,749–16,798] | 2,619 [2,429–2,837] | $0.0010 [$0.0009–$0.0011] | 5.3 s [4.7 s–6.1 s] |

