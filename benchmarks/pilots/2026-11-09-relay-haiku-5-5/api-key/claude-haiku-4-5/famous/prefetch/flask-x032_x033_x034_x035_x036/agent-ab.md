# Agent-level A/B — measured tool calls, tokens and cost

**anthropic-messages-api direct Messages API · claude-haiku-4-5 · 2026-11-11 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap ranked the question BEFORE the first turn (what a prompt hook would inject): the five likeliest files with their signatures and line anchors after the question in the user turn, + the sigmap CLI; no MCP server, no standing section, no extra tool call.
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
| Tool calls | −38% | −40% | fewer in every repetition |
| Input tokens (uncached) | −58% | −52% | fewer in every repetition |
| Output tokens | −19% | −29% | fewer in every repetition |
| Cache-read tokens | −44% | −45% | fewer in every repetition |
| Cache-write tokens | −23% | −20% | fewer in every repetition |
| Total tokens (derived) | −42% | −43% | fewer in every repetition |
| Cost | −32% | −33% | fewer in every repetition |
| Wall time | −22% | −28% | fewer in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −36% [−42%, −30%] | −46% [−68%, −9%] | fewer in every repetition, outside the noise |
| Input tokens (uncached) | −53% [−68%, −30%] | −49% [−62%, −31%] | fewer in every repetition, outside the noise |
| Output tokens | −18% [−24%, −10%] | −29% [−53%, +9%] † | fewer in every repetition, within the noise |
| Cache-read tokens | −39% [−71%, +28%] † | −39% [−78%, +85%] † | fewer in every repetition, within the noise |
| Cache-write tokens | −26% [−51%, +14%] † | −21% [−53%, +34%] † | fewer in every repetition, within the noise |
| Total tokens (derived) | −39% [−67%, +17%] † | −40% [−74%, +37%] † | fewer in every repetition, within the noise |
| Cost | −32% [−52%, −2%] | −31% [−57%, +11%] † | fewer in every repetition, within the noise |
| Wall time | −18% [−31%, −7%] | −27% [−52%, +12%] † | fewer in every repetition, within the noise |

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
| flask | 15 | 7 | −5 | 5 / 0 / 0 |
| all | 15 | 7 | −5 | 5 / 0 / 0 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | 6,496 | 2,862 | −3,803 | 5 / 0 / 0 |
| all | 6,496 | 2,862 | −3,803 | 5 / 0 / 0 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | 1,711 | 1,059 | −386 | 4 / 0 / 1 |
| all | 1,711 | 1,059 | −386 | 4 / 0 / 1 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | 138,911 | 37,897 | −101,014 | 3 / 0 / 2 |
| all | 138,911 | 37,897 | −101,014 | 3 / 0 / 2 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | 19,414 | 12,212 | −8,072 | 3 / 0 / 2 |
| all | 19,414 | 12,212 | −8,072 | 3 / 0 / 2 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | 166,683 | 52,999 | −112,214 | 3 / 0 / 2 |
| all | 166,683 | 52,999 | −112,214 | 3 / 0 / 2 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd), or computed from the API's usage and a price table when the run went through the Messages API directly. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | $0.0558 | $0.0255 | −$0.0264 | 3 / 0 / 2 |
| all | $0.0558 | $0.0255 | −$0.0264 | 3 / 0 / 2 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | 20.1 s | 12.8 s | −6.3 s | 4 / 0 / 1 |
| all | 20.1 s | 12.8 s | −6.3 s | 4 / 0 / 1 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| flask | $0.5411 (10 runs) | $0.3639 (10 runs) | none | none |
| all | $0.5411 (10 runs) | $0.3639 (10 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| flask/x032 | without | 2/2 | 23 [22–23] | 6,919 [6,194–7,644] | 2,669 [2,443–2,895] | 329,442 [241,999–416,885] | 27,220 [22,175–32,265] | $0.0872 [$0.0740–$0.1004] | 31.5 s [28.8 s–34.3 s] |
| flask/x032 | with | 2/2 | 18 [14–22] | 3,039 [3,010–3,067] | 2,301 [2,043–2,559] | 126,318 [67,371–185,265] | 13,789 [13,327–14,250] | $0.0444 [$0.0366–$0.0522] | 24.7 s [20.8 s–28.6 s] |
| flask/x033 | without | 2/2 | 15 [11–18] | 10,708 [9,339–12,076] | 1,726 [1,404–2,048] | 135,120 [75,132–195,107] | 19,130 [17,571–20,688] | $0.0568 [$0.0486–$0.0649] | 20.5 s [16.9 s–24.1 s] |
| flask/x033 | with | 2/2 | 10 [8–11] | 3,213 [3,204–3,222] | 1,340 [1,310–1,370] | 192,718 [149,635–235,801] | 28,107 [26,198–30,016] | $0.0643 [$0.0575–$0.0712] | 16.0 s [15.7 s–16.3 s] |
| flask/x034 | without | 2/2 | 6 [5–7] | 3,126 [2,949–3,303] | 691 [519–862] | 15,722 [7,510–23,934] | 8,609 [7,777–9,440] | $0.0189 [$0.0164–$0.0215] | 7.9 s [6.1 s–9.8 s] |
| flask/x034 | with | 2/2 | 5 [5–5] | 2,862 [2,860–2,864] | 726 [695–756] | 36,624 [36,012–37,235] | 12,212 [11,108–13,316] | $0.0254 [$0.0239–$0.0269] | 9.2 s [9.0 s–9.4 s] |
| flask/x035 | without | 2/2 | 17 [14–19] | 5,178 [4,480–5,875] | 1,711 [1,398–2,023] | 138,911 [115,889–161,932] | 19,414 [17,477–21,350] | $0.0519 [$0.0511–$0.0526] | 20.1 s [16.8 s–23.4 s] |
| flask/x035 | with | 2/2 | 7 [5–8] | 2,812 [2,808–2,816] | 948 [785–1,111] | 37,897 [31,976–43,817] | 11,342 [10,384–12,300] | $0.0255 [$0.0245–$0.0265] | 11.5 s [9.8 s–13.1 s] |
| flask/x036 | without | 2/2 | 14 [14–14] | 6,496 [5,855–7,136] | 1,619 [1,424–1,814] | 156,715 [142,126–171,303] | 20,399 [19,975–20,823] | $0.0558 [$0.0532–$0.0583] | 19.0 s [16.4 s–21.6 s] |
| flask/x036 | with | 2/2 | 6 [4–8] | 2,693 [2,680–2,706] | 1,059 [844–1,273] | 34,591 [20,381–48,800] | 8,673 [8,173–9,173] | $0.0223 [$0.0192–$0.0254] | 12.8 s [10.3 s–15.3 s] |

