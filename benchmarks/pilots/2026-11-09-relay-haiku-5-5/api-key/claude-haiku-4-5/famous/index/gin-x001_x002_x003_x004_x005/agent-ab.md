# Agent-level A/B — measured tool calls, tokens and cost

**anthropic-messages-api direct Messages API · claude-haiku-4-5 · 2026-11-11 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap index strategy + 7-tool core MCP profile (the docs' setup for an agent that calls the tools).
- Both arms: the same prompt, model, tool allowlist (Read, Grep, Glob, Bash), per-run budget cap $0.25 and timeout 420 s; run in a clean copy of the commit pinned in `benchmarks/xrepo-repos.json`.
- Questions: the task id(s) x001, x002, x003, x004, x005 of `benchmarks/tasks/retrieval-xrepo.jsonl`. Pass = hit@5 on the repository-relative paths the answer names.
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
| gin | 5 | 9/10 | 10/10 | 0 / 0 |
| all | 5 | 9/10 | 10/10 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 5. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −11% | −31% | fewer in every repetition |
| Input tokens (uncached) | −22% | −21% | fewer in every repetition |
| Output tokens | +2% | −18% | mixed |
| Cache-read tokens | +72% | −38% | mixed |
| Cache-write tokens | +28% | +3% | more in every repetition |
| Total tokens (derived) | +54% | −30% | mixed |
| Cost | +22% | −13% | mixed |
| Wall time | +7% | −18% | mixed |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −7% [−21%, +13%] † | −29% [−47%, −2%] | fewer in every repetition, within the noise |
| Input tokens (uncached) | +6% [−49%, +121%] † | +6% [−48%, +115%] † | more in every repetition, within the noise |
| Output tokens | +3% [−14%, +16%] † | −13% [−34%, +15%] † | mixed |
| Cache-read tokens | +69% [−17%, +296%] † | −16% [−48%, +26%] † | mixed |
| Cache-write tokens | +21% [−15%, +89%] † | +5% [−18%, +28%] † | more in every repetition, within the noise |
| Total tokens (derived) | +48% [−12%, +181%] † | −15% [−45%, +16%] † | mixed |
| Cost | +19% [−8%, +68%] † | −8% [−31%, +19%] † | mixed |
| Wall time | +9% [−10%, +25%] † | −14% [−31%, +7%] † | mixed |

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
| gin | 8 | 8 | −2 | 3 / 0 / 2 |
| all | 8 | 8 | −2 | 3 / 0 / 2 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 3,942 | 3,199 | −745 | 3 / 0 / 2 |
| all | 3,942 | 3,199 | −745 | 3 / 0 / 2 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 885 | 942 | +41 | 2 / 0 / 3 |
| all | 885 | 942 | +41 | 2 / 0 / 3 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 37,256 | 55,300 | +6,919 | 1 / 0 / 4 |
| all | 37,256 | 55,300 | +6,919 | 1 / 0 / 4 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 12,346 | 11,728 | +848 | 2 / 0 / 3 |
| all | 12,346 | 11,728 | +848 | 2 / 0 / 3 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 52,495 | 71,284 | +6,800 | 1 / 0 / 4 |
| all | 52,495 | 71,284 | +6,800 | 1 / 0 / 4 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd), or computed from the API's usage and a price table when the run went through the Messages API directly. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | $0.0251 | $0.0287 | +$0.0007 | 2 / 0 / 3 |
| all | $0.0251 | $0.0287 | +$0.0007 | 2 / 0 / 3 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 9.9 s | 11.6 s | +624 ms | 2 / 0 / 3 |
| all | 9.9 s | 11.6 s | +624 ms | 2 / 0 / 3 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| gin | $0.2836 (10 runs) | $0.2955 (10 runs) | none | none |
| all | $0.2836 (10 runs) | $0.2955 (10 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| gin/x001 | without | 2/2 | 14 [13–15] | 7,041 [5,831–8,251] | 1,168 [1,063–1,273] | 45,474 [33,652–57,296] | 12,346 [11,647–13,044] | $0.0329 [$0.0325–$0.0332] | 16.7 s [15.7 s–17.6 s] |
| gin/x001 | with | 2/2 | 9 [6–11] | 3,203 [3,192–3,214] | 942 [746–1,138] | 59,877 [38,821–80,933] | 14,399 [12,729–16,068] | $0.0319 [$0.0267–$0.0371] | 14.5 s [10.1 s–18.9 s] |
| gin/x002 | without | 1/2 | 8 [7–8] | 3,942 [1,079–6,804] | 772 [752–791] | 18,382 [12,177–24,586] | 8,412 [6,674–10,149] | $0.0202 [$0.0201–$0.0202] | 9.2 s [9.0 s–9.4 s] |
| gin/x002 | with | 2/2 | 6 [4–7] | 3,197 [3,196–3,198] | 812 [704–920] | 20,310 [19,007–21,612] | 9,259 [8,149–10,369] | $0.0209 [$0.0188–$0.0229] | 9.8 s [8.9 s–10.8 s] |
| gin/x003 | without | 2/2 | 7 [6–7] | 1,078 [1,078–1,078] | 694 [665–722] | 37,256 [36,347–38,165] | 13,468 [13,132–13,803] | $0.0251 [$0.0245–$0.0258] | 8.9 s [8.9 s–9.0 s] |
| gin/x003 | with | 2/2 | 7 [7–7] | 3,205 [3,199–3,210] | 879 [807–950] | 44,175 [42,358–45,992] | 11,037 [9,318–12,756] | $0.0258 [$0.0235–$0.0281] | 10.8 s [10.6 s–11.0 s] |
| gin/x004 | without | 2/2 | 7 [6–8] | 2,933 [1,077–4,788] | 885 [867–903] | 22,233 [15,223–29,242] | 9,544 [9,408–9,679] | $0.0215 [$0.0201–$0.0229] | 9.9 s [9.7 s–10.1 s] |
| gin/x004 | with | 2/2 | 8 [8–8] | 3,199 [3,190–3,207] | 971 [881–1,061] | 77,682 [28,235–127,129] | 19,724 [13,488–25,959] | $0.0405 [$0.0273–$0.0537] | 11.6 s [9.7 s–13.5 s] |
| gin/x005 | without | 2/2 | 14 [11–17] | 5,422 [5,398–5,446] | 1,599 [1,276–1,922] | 121,941 [79,103–164,779] | 13,263 [11,852–14,674] | $0.0422 [$0.0345–$0.0499] | 19.0 s [15.4 s–22.7 s] |
| gin/x005 | with | 2/2 | 10 [9–10] | 3,195 [3,186–3,203] | 1,061 [922–1,200] | 55,300 [51,687–58,913] | 11,728 [9,981–13,475] | $0.0287 [$0.0276–$0.0298] | 13.0 s [11.4 s–14.6 s] |

