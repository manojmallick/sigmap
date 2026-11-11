# Agent-level A/B — measured tool calls, tokens and cost

**anthropic-messages-api direct Messages API · claude-sonnet-5-5 · 2026-11-11 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap ranked the question BEFORE the first turn (what a prompt hook would inject): the five likeliest files with their signatures and line anchors after the question in the user turn, + the sigmap CLI; no MCP server, no standing section, no extra tool call.
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
| Tool calls | −50% | −40% | fewer in every repetition |
| Input tokens (uncached) | +588% | +588% | more in every repetition |
| Output tokens | −32% | −28% | fewer in every repetition |
| Cache-read tokens | −49% | +15% | mixed |
| Cache-write tokens | +10% | −53% | mixed |
| Total tokens (derived) | −6% | +11% | mixed |
| Cost | +11% | −11% | mixed |
| Wall time | −31% | −16% | fewer in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −46% [−63%, −16%] | −36% [−59%, 0%] † | fewer in every repetition, within the noise |
| Input tokens (uncached) | +587% [+554%, +621%] | +588% [+554%, +621%] | more in every repetition, outside the noise |
| Output tokens | −28% [−41%, −7%] | −25% [−42%, −3%] | fewer in every repetition, outside the noise |
| Cache-read tokens | −45% [−63%, −16%] | +16% [−16%, +38%] † | mixed |
| Cache-write tokens | +21% [−30%, +88%] † | +342% n=1 | more in every repetition, within the noise |
| Total tokens (derived) | −1% [−35%, +42%] † | +16% [−31%, +86%] † | mixed |
| Cost | +15% [−18%, +59%] † | −2% [−53%, +105%] † | mixed |
| Wall time | −25% [−55%, +38%] † | −15% [−39%, +45%] † | fewer in every repetition, within the noise |

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
| express | 3 | 1 | −1 | 3 / 1 / 0 |
| all | 3 | 1 | −1 | 3 / 1 / 0 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | 198 | 1,364 | +1,166 | 0 / 0 / 4 |
| all | 198 | 1,364 | +1,166 | 0 / 0 / 4 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | 452 | 319 | −133 | 4 / 0 / 0 |
| all | 452 | 319 | −133 | 4 / 0 / 0 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | 3,010 | 2,841 | −169 | 3 / 0 / 1 |
| all | 3,010 | 2,841 | −169 | 3 / 0 / 1 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | 1,685 | 1,647 | −39 | 2 / 0 / 2 |
| all | 1,685 | 1,647 | −39 | 2 / 0 / 2 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | 5,278 | 6,404 | +1,270 | 2 / 0 / 2 |
| all | 5,278 | 6,404 | +1,270 | 2 / 0 / 2 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd), or computed from the API's usage and a price table when the run went through the Messages API directly. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | $0.0095 | $0.0103 | +$0.0011 | 2 / 0 / 2 |
| all | $0.0095 | $0.0103 | +$0.0011 | 2 / 0 / 2 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | 5.3 s | 3.6 s | −1.9 s | 3 / 0 / 1 |
| all | 5.3 s | 3.6 s | −1.9 s | 3 / 0 / 1 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| express | $0.0832 (8 runs) | $0.0839 (8 runs) | none | none |
| all | $0.0832 (8 runs) | $0.0839 (8 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| express/x037 | without | 2/2 | 4 [4–4] | 198 [198–198] | 588 [580–596] | 3,145 [3,045–3,244] | 2,141 [2,041–2,240] | $0.0123 [$0.0121–$0.0124] | 6.0 s [5.9 s–6.0 s] |
| express/x037 | with | 2/2 | 2 [2–2] | 1,348 [1,348–1,348] | 350 [345–354] | 2,899 [1,628–4,170] | 1,271 [0–2,542] | $0.0099 [$0.0071–$0.0128] | 3.6 s [3.4 s–3.8 s] |
| express/x038 | without | 2/2 | 3 [3–3] | 198 [198–198] | 522 [511–533] | 5,156 [5,156–5,156] | 3,974 [3,823–4,124] | $0.0166 [$0.0161–$0.0171] | 4.7 s [4.5 s–4.8 s] |
| express/x038 | with | 2/2 | 1 [1–1] | 1,269 [1,269–1,269] | 302 [297–307] | 2,640 [1,628–3,652] | 1,012 [0–2,024] | $0.0086 [$0.0063–$0.0109] | 3.3 s [3.2 s–3.4 s] |
| express/x039 | without | 2/2 | 1 [1–1] | 190 [190–190] | 208 [190–225] | 2,858 [1,628–4,088] | 1,230 [0–2,460] | $0.0061 [$0.0034–$0.0088] | 2.8 s [2.7 s–2.9 s] |
| express/x039 | with | 2/2 | 1 [1–1] | 1,396 [1,396–1,396] | 204 [202–205] | 3,651 [1,628–5,673] | 2,023 [0–4,045] | $0.0106 [$0.0059–$0.0153] | 5.2 s [4.9 s–5.5 s] |
| express/x040 | without | 2/2 | 2 [2–2] | 198 [198–198] | 382 [347–416] | 2,875 [2,864–2,886] | 744 [741–747] | $0.0066 [$0.0063–$0.0070] | 7.4 s [5.3 s–9.4 s] |
| express/x040 | with | 2/2 | 2 [1–2] | 1,379 [1,378–1,380] | 337 [307–366] | 2,783 [1,628–3,938] | 2,443 [1,611–3,274] | $0.0128 [$0.0102–$0.0154] | 3.7 s [3.6 s–3.7 s] |

