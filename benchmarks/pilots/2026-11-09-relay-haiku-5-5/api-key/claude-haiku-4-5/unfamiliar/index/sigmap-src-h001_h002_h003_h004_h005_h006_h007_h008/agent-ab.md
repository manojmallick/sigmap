# Agent-level A/B — measured tool calls, tokens and cost

**anthropic-messages-api direct Messages API · claude-haiku-4-5 · 2026-11-11 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4); 1 cell with no completed run**

- Arms: **without** = no SigMap; **with** = SigMap index strategy + 7-tool core MCP profile (the docs' setup for an agent that calls the tools).
- Both arms: the same prompt, model, tool allowlist (Read, Grep, Glob, Bash), per-run budget cap $0.25 and timeout 420 s; run in a clean copy of the commit pinned in `benchmarks/xrepo-repos.json`.
- Questions: the task id(s) h001, h002, h003, h004, h005, h006, h007, h008 of `benchmarks/tasks/retrieval-xrepo.jsonl`. Pass = hit@5 on the repository-relative paths the answer names.
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
| sigmap-src | 8 | 9/16 | 10/16 | 4 / 2 |
| all | 8 | 9/16 | 10/16 | 4 / 2 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 8. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −55% n=5 | −55% n=5 | fewer in every repetition |
| Input tokens (uncached) | +27% n=5 | −40% n=5 | mixed |
| Output tokens | −48% n=5 | −48% n=5 | fewer in every repetition |
| Cache-read tokens | −78% n=5 | −56% n=5 | fewer in every repetition |
| Cache-write tokens | −50% n=5 | −28% n=5 | fewer in every repetition |
| Total tokens (derived) | −70% n=5 | −52% n=5 | fewer in every repetition |
| Cost | −50% n=5 | −40% n=5 | fewer in every repetition |
| Wall time | −47% n=5 | −44% n=5 | fewer in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −62% [−83%, −15%] n=4 | −63% [−85%, −34%] n=4 | fewer in every repetition, outside the noise |
| Input tokens (uncached) | +100% [+17%, +165%] n=5 | −13% [−61%, +91%] † n=5 | mixed |
| Output tokens | −48% [−72%, −16%] n=5 | −41% [−75%, +18%] † n=5 | fewer in every repetition, within the noise |
| Cache-read tokens | −79% [−98%, −29%] n=3 | −69% [−93%, −16%] n=4 | fewer in every repetition, outside the noise |
| Cache-write tokens | −54% [−68%, −33%] n=4 | −28% [−51%, −2%] n=4 | fewer in every repetition, outside the noise |
| Total tokens (derived) | −61% [−87%, +16%] † n=5 | −40% [−79%, +44%] † n=5 | fewer in every repetition, within the noise |
| Cost | −38% [−65%, +14%] † n=5 | −22% [−61%, +52%] † n=5 | fewer in every repetition, within the noise |
| Wall time | −46% [−69%, −12%] n=5 | −36% [−70%, +21%] † n=5 | fewer in every repetition, within the noise |

### Outcome (hit@5), by repetition

Per paired task: **better** = the SigMap arm named the file and the other did not; **worse** = the reverse; **tie** = both found it or both missed. Localisation only.

| repetition | paired tasks | better | worse | tie |
| --- | ---: | ---: | ---: | ---: |
| R1 | 5 | 0 | 0 | 5 |
| R2 | 5 | 1 | 0 | 4 |
| all | 10 | 1 | 0 | 9 |

## Tool calls

Provenance: agent-reported (main-thread tool_use blocks). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 15 | 6 | −9 | 6 / 1 / 0 |
| all | 15 | 6 | −9 | 6 / 1 / 0 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 3,241 | 2,804 | −423 | 4 / 0 / 3 |
| all | 3,241 | 2,804 | −423 | 4 / 0 / 3 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 1,557 | 677 | −819 | 6 / 0 / 1 |
| all | 1,557 | 677 | −819 | 6 / 0 / 1 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 115,698 | 25,687 | −77,679 | 6 / 1 / 0 |
| all | 115,698 | 25,687 | −77,679 | 6 / 1 / 0 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 18,038 | 12,139 | −7,632 | 6 / 1 / 0 |
| all | 18,038 | 12,139 | −7,632 | 6 / 1 / 0 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 138,332 | 41,289 | −86,643 | 6 / 0 / 1 |
| all | 138,332 | 41,289 | −86,643 | 6 / 0 / 1 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd), or computed from the API's usage and a price table when the run went through the Messages API directly. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | $0.0445 | $0.0239 | −$0.0228 | 6 / 0 / 1 |
| all | $0.0445 | $0.0239 | −$0.0228 | 6 / 0 / 1 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 18.9 s | 8.5 s | −9.5 s | 6 / 0 / 1 |
| all | 18.9 s | 8.5 s | −9.5 s | 6 / 0 / 1 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | $0.8369 (16 runs) | $0.5629 (16 runs) | $0.3346 (4 runs) | $0.2018 (2 runs) |
| all | $0.8369 (16 runs) | $0.5629 (16 runs) | $0.3346 (4 runs) | $0.2018 (2 runs) |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| sigmap-src/h001 | without | 2/2 | 18 [12–23] | 3,241 [1,079–5,403] | 1,690 [1,323–2,056] | 172,988 [117,166–228,809] | 26,451 [25,286–27,616] | $0.0621 [$0.0539–$0.0702] | 23.9 s [22.6 s–25.1 s] |
| sigmap-src/h001 | with | 2/2 | 15 [13–16] | 2,818 [2,803–2,833] | 1,420 [1,287–1,552] | 106,992 [71,389–142,594] | 18,819 [17,673–19,965] | $0.0441 [$0.0413–$0.0469] | 19.8 s [19.6 s–20.0 s] |
| sigmap-src/h002 | without | 0/2 | n/a | n/a | n/a | n/a | n/a | n/a | n/a |
| sigmap-src/h002 | with | 0/2 | 12 [10–14] | 5,687 [5,675–5,698] | 1,247 [1,114–1,379] | 117,785 [87,292–148,278] | 18,310 [17,270–19,350] | $0.0466 [$0.0416–$0.0516] | 16.8 s [15.1 s–18.4 s] |
| sigmap-src/h003 | without | 2/2 | 14 [6–22] | 5,582 [1,054–10,110] | 1,421 [698–2,143] | 84,109 [29,575–138,642] | 17,478 [14,803–20,152] | $0.0429 [$0.0260–$0.0599] | 16.8 s [8.3 s–25.2 s] |
| sigmap-src/h003 | with | 2/2 | 3 [2–4] | 2,782 [2,776–2,788] | 394 [250–538] | 12,813 [4,494–21,131] | 8,616 [8,159–9,072] | $0.0168 [$0.0147–$0.0189] | 5.6 s [3.9 s–7.2 s] |
| sigmap-src/h004 | without | 1/2 | 27 [27–27] n=1 | 2,515 [2,515–2,515] n=1 | 2,427 [2,427–2,427] n=1 | 216,411 [216,411–216,411] n=1 | 22,785 [22,785–22,785] n=1 | $0.0648 [$0.0648–$0.0648] n=1 | 27.7 s [27.7 s–27.7 s] n=1 |
| sigmap-src/h004 | with | 1/2 | 16 [16–16] n=1 | 2,833 [2,833–2,833] n=1 | 1,608 [1,608–1,608] n=1 | 100,998 [100,998–100,998] n=1 | 16,768 [16,768–16,768] n=1 | $0.0419 [$0.0419–$0.0419] n=1 | 18.2 s [18.2 s–18.2 s] n=1 |
| sigmap-src/h005 | without | 1/2 | 13 [8–18] | 3,406 [1,116–5,695] | 1,191 [750–1,631] | 115,698 [22,170–209,226] | 18,038 [10,595–25,481] | $0.0435 [$0.0249–$0.0620] | 15.6 s [10.0 s–21.3 s] |
| sigmap-src/h005 | with | 2/2 | 5 [4–5] | 2,783 [2,777–2,789] | 655 [560–750] | 13,587 [4,154–23,019] | 9,422 [7,384–11,460] | $0.0192 [$0.0152–$0.0232] | 8.1 s [6.5 s–9.6 s] |
| sigmap-src/h006 | without | 2/2 | 16 [14–17] | 1,094 [1,082–1,105] | 1,676 [1,506–1,845] | 119,923 [84,961–154,884] | 20,083 [16,854–23,311] | $0.0466 [$0.0382–$0.0550] | 18.9 s [17.0 s–20.7 s] |
| sigmap-src/h006 | with | 1/2 | 7 [7–7] n=1 | 2,790 [2,790–2,790] n=1 | 699 [699–699] n=1 | 37,787 [37,787–37,787] n=1 | 14,855 [14,855–14,855] n=1 | $0.0286 [$0.0286–$0.0286] n=1 | 8.9 s [8.9 s–8.9 s] n=1 |
| sigmap-src/h007 | without | 0/2 | 0 [0–0] | 1,028 [1,028–1,028] | 99 [66–131] | 0 [0–0] | 0 [0–0] | $0.0015 [$0.0014–$0.0017] | 1.4 s [1.1 s–1.7 s] |
| sigmap-src/h007 | with | 0/2 | 0 [0–0] | 2,763 [2,763–2,763] | 106 [99–112] | 0 [0–0] | 0 [0–0] | $0.0033 [$0.0033–$0.0033] | 1.6 s [1.5 s–1.8 s] |
| sigmap-src/h008 | without | 1/2 | 15 [15–15] n=1 | 9,917 [9,917–9,917] n=1 | 1,557 [1,557–1,557] n=1 | 77,679 [77,679–77,679] n=1 | 15,187 [15,187–15,187] n=1 | $0.0445 [$0.0445–$0.0445] n=1 | 20.9 s [20.9 s–20.9 s] n=1 |
| sigmap-src/h008 | with | 2/2 | 2 [2–2] | 6,850 [6,849–6,851] | 300 [293–307] | 0 [0–0] | 5,538 [5,518–5,558] | $0.0153 [$0.0152–$0.0153] | 4.7 s [4.7 s–4.7 s] |

