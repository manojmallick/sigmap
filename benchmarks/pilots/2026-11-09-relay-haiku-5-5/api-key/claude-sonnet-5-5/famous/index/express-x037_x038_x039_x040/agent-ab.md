# Agent-level A/B — measured tool calls, tokens and cost

**anthropic-messages-api direct Messages API · claude-sonnet-5-5 · 2026-11-11 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap index strategy + 7-tool core MCP profile (the docs' setup for an agent that calls the tools).
- Both arms: the same prompt, model, tool allowlist (Read, Grep, Glob, Bash), per-run budget cap $0.25 and timeout 420 s; run in a clean copy of the commit pinned in `benchmarks/xrepo-repos.json`.
- Questions: the task id(s) x037, x038, x039, x040 of `benchmarks/tasks/retrieval-xrepo.jsonl`. Pass = hit@5 on the repository-relative paths the answer names.
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
| express | 4 | 8/8 | 8/8 | 0 / 0 |
| all | 4 | 8/8 | 8/8 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 4. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −20% | −20% | fewer in every repetition |
| Input tokens (uncached) | 0% | 0% | mixed |
| Output tokens | −15% | −14% | fewer in every repetition |
| Cache-read tokens | +177% | +146% | more in every repetition |
| Cache-write tokens | −49% | −78% | fewer in every repetition |
| Total tokens (derived) | +72% | +60% | more in every repetition |
| Cost | −22% | −35% | fewer in every repetition |
| Wall time | −24% | −15% | fewer in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −16% [−29%, 0%] † | −18% [−33%, 0%] † | fewer in every repetition, within the noise |
| Input tokens (uncached) | 0% [0%, 0%] † | 0% [−1%, 0%] † | mixed |
| Output tokens | −13% [−20%, −4%] | −16% [−29%, −3%] | fewer in every repetition, outside the noise |
| Cache-read tokens | +197% [+124%, +293%] | +146% [+96%, +215%] | more in every repetition, outside the noise |
| Cache-write tokens | −57% [−76%, −14%] | −89% [−96%, −36%] n=3 | fewer in every repetition, outside the noise |
| Total tokens (derived) | +77% [+40%, +121%] | +63% [+38%, +91%] | more in every repetition, outside the noise |
| Cost | −25% [−44%, +1%] † | −32% [−50%, −7%] | fewer in every repetition, within the noise |
| Wall time | −19% [−38%, +3%] † | −14% [−30%, −4%] | fewer in every repetition, within the noise |

### Outcome (hit@5), by repetition

Per paired task: **better** = the SigMap arm named the file and the other did not; **worse** = the reverse; **tie** = both found it or both missed. Localisation only.

| repetition | paired tasks | better | worse | tie |
| --- | ---: | ---: | ---: | ---: |
| R1 | 4 | 0 | 0 | 4 |
| R2 | 4 | 0 | 0 | 4 |
| all | 8 | 0 | 0 | 8 |

## Tool calls

Provenance: agent-reported (main-thread tool_use blocks). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | 3 | 2 | −1 | 3 / 1 / 0 |
| all | 3 | 2 | −1 | 3 / 1 / 0 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | 198 | 198 | 0 | 1 / 3 / 0 |
| all | 198 | 198 | 0 | 1 / 3 / 0 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | 458 | 383 | −54 | 4 / 0 / 0 |
| all | 458 | 383 | −54 | 4 / 0 / 0 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | 3,613 | 10,488 | +6,451 | 0 / 0 / 4 |
| all | 3,613 | 10,488 | +6,451 | 0 / 0 / 4 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | 2,225 | 504 | −1,244 | 4 / 0 / 0 |
| all | 2,225 | 504 | −1,244 | 4 / 0 / 0 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | 6,504 | 12,350 | +4,452 | 0 / 0 / 4 |
| all | 6,504 | 12,350 | +4,452 | 0 / 0 / 4 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd), or computed from the API's usage and a price table when the run went through the Messages API directly. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | $0.0114 | $0.0077 | −$0.0025 | 3 / 0 / 1 |
| all | $0.0114 | $0.0077 | −$0.0025 | 3 / 0 / 1 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | 4.9 s | 4.2 s | −546 ms | 3 / 0 / 1 |
| all | 4.9 s | 4.2 s | −546 ms | 3 / 0 / 1 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| express | $0.0913 (8 runs) | $0.0655 (8 runs) | none | none |
| all | $0.0913 (8 runs) | $0.0655 (8 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| express/x037 | without | 2/2 | 4 [3–4] | 198 [198–198] | 497 [444–549] | 3,554 [3,045–4,063] | 2,520 [2,309–2,731] | $0.0124 [$0.0123–$0.0125] | 5.3 s [4.8 s–5.8 s] |
| express/x037 | with | 2/2 | 3 [3–3] | 198 [198–198] | 456 [451–460] | 10,030 [9,455–10,605] | 2,351 [1,753–2,949] | $0.0128 [$0.0114–$0.0143] | 4.4 s [4.3 s–4.5 s] |
| express/x038 | without | 2/2 | 3 [3–3] | 198 [198–198] | 477 [473–481] | 5,157 [5,156–5,157] | 4,125 [4,124–4,125] | $0.0165 [$0.0165–$0.0165] | 4.4 s [4.3 s–4.5 s] |
| express/x038 | with | 2/2 | 2 [2–2] | 198 [198–198] | 388 [370–405] | 11,583 [11,123–12,043] | 618 [173–1,062] | $0.0081 [$0.0073–$0.0090] | 4.2 s [4.1 s–4.3 s] |
| express/x039 | without | 2/2 | 1 [1–1] | 190 [190–190] | 240 [191–289] | 2,858 [1,628–4,088] | 1,230 [0–2,460] | $0.0064 [$0.0041–$0.0088] | 3.2 s [3.0 s–3.5 s] |
| express/x039 | with | 2/2 | 1 [1–1] | 190 [190–190] | 193 [192–193] | 7,084 [6,802–7,365] | 282 [0–563] | $0.0044 [$0.0038–$0.0051] | 3.3 s [3.3 s–3.4 s] |
| express/x040 | without | 2/2 | 3 [2–3] | 199 [198–200] | 439 [425–453] | 3,673 [2,894–4,451] | 1,930 [1,448–2,411] | $0.0103 [$0.0091–$0.0116] | 7.1 s [6.3 s–7.9 s] |
| express/x040 | with | 2/2 | 2 [2–2] | 198 [198–198] | 379 [364–394] | 10,946 [10,698–11,193] | 391 [124–658] | $0.0074 [$0.0066–$0.0081] | 4.1 s [4.0 s–4.2 s] |

