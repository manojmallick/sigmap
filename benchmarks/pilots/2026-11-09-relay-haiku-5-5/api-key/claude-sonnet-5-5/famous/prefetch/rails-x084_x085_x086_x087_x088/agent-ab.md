# Agent-level A/B — measured tool calls, tokens and cost

**anthropic-messages-api direct Messages API · claude-sonnet-5-5 · 2026-11-11 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap ranked the question BEFORE the first turn (what a prompt hook would inject): the five likeliest files with their signatures and line anchors after the question in the user turn, + the sigmap CLI; no MCP server, no standing section, no extra tool call.
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
| Tool calls | −14% | −25% | fewer in every repetition |
| Input tokens (uncached) | +767% | +769% | more in every repetition |
| Output tokens | −9% | −12% | fewer in every repetition |
| Cache-read tokens | −49% | −57% | fewer in every repetition |
| Cache-write tokens | −6% | −5% | fewer in every repetition |
| Total tokens (derived) | −14% | −19% | fewer in every repetition |
| Cost | +10% | +9% | more in every repetition |
| Wall time | +5% | −17% | mixed |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −12% [−52%, +61%] † | −20% [−52%, +35%] † | fewer in every repetition, within the noise |
| Input tokens (uncached) | +763% [+663%, +876%] | +764% [+664%, +877%] | more in every repetition, outside the noise |
| Output tokens | −9% [−21%, +6%] † | −12% [−25%, +5%] † | fewer in every repetition, within the noise |
| Cache-read tokens | −40% [−57%, −15%] | −47% [−68%, −13%] | fewer in every repetition, outside the noise |
| Cache-write tokens | +13% [−26%, +66%] † | +8% [−23%, +57%] † | more in every repetition, within the noise |
| Total tokens (derived) | +3% [−32%, +40%] † | −4% [−32%, +35%] † | mixed |
| Cost | +20% [−11%, +51%] † | +15% [−7%, +45%] † | more in every repetition, within the noise |
| Wall time | +1% [−32%, +42%] † | −17% [−30%, −7%] | mixed |

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
| rails | 3 | 2 | −1 | 3 / 0 / 2 |
| all | 3 | 2 | −1 | 3 / 0 / 2 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | 214 | 1,846 | +1,632 | 0 / 0 / 5 |
| all | 214 | 1,846 | +1,632 | 0 / 0 / 5 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | 496 | 484 | −32 | 3 / 0 / 2 |
| all | 496 | 484 | −32 | 3 / 0 / 2 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | 3,671 | 1,628 | −1,592 | 4 / 1 / 0 |
| all | 3,671 | 1,628 | −1,592 | 4 / 1 / 0 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | 3,441 | 4,060 | −132 | 3 / 0 / 2 |
| all | 3,441 | 4,060 | −132 | 3 / 0 / 2 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | 7,822 | 8,369 | +573 | 2 / 0 / 3 |
| all | 7,822 | 8,369 | +573 | 2 / 0 / 3 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd), or computed from the API's usage and a price table when the run went through the Messages API directly. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | $0.0147 | $0.0195 | +$0.0028 | 1 / 0 / 4 |
| all | $0.0147 | $0.0195 | +$0.0028 | 1 / 0 / 4 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | 6.1 s | 6.2 s | +457 ms | 2 / 0 / 3 |
| all | 6.1 s | 6.2 s | +457 ms | 2 / 0 / 3 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| rails | $0.1702 (10 runs) | $0.1861 (10 runs) | none | none |
| all | $0.1702 (10 runs) | $0.1861 (10 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| rails/x084 | without | 2/2 | 3 [3–3] | 209 [209–209] | 477 [432–521] | 5,459 [3,112–7,806] | 4,192 [2,614–5,770] | $0.0168 [$0.0128–$0.0207] | 7.8 s [6.3 s–9.3 s] |
| rails/x084 | with | 2/2 | 2 [2–2] | 2,103 [2,103–2,103] | 484 [477–490] | 1,628 [1,628–1,628] | 4,060 [4,051–4,069] | $0.0195 [$0.0194–$0.0196] | 4.3 s [3.8 s–4.9 s] |
| rails/x085 | without | 2/2 | 2 [1–2] | 214 [213–215] | 496 [422–570] | 3,671 [1,628–5,714] | 3,441 [3,272–3,610] | $0.0147 [$0.0132–$0.0163] | 5.1 s [4.3 s–5.8 s] |
| rails/x085 | with | 2/2 | 3 [1–4] | 1,846 [1,845–1,847] | 465 [287–642] | 3,308 [1,628–4,987] | 2,777 [2,670–2,884] | $0.0159 [$0.0136–$0.0183] | 6.2 s [3.9 s–8.5 s] |
| rails/x086 | without | 2/2 | 3 [3–3] | 233 [233–233] | 574 [561–587] | 3,220 [3,215–3,224] | 1,126 [1,121–1,130] | $0.0097 [$0.0095–$0.0098] | 6.1 s [6.0 s–6.2 s] |
| rails/x086 | with | 2/2 | 1 [1–1] | 1,612 [1,612–1,612] | 438 [408–468] | 1,628 [1,628–1,628] | 2,167 [2,141–2,192] | $0.0133 [$0.0130–$0.0137] | 7.4 s [5.6 s–9.1 s] |
| rails/x087 | without | 2/2 | 1 [1–1] | 213 [213–213] | 454 [451–456] | 1,628 [1,628–1,628] | 2,716 [2,714–2,718] | $0.0121 [$0.0121–$0.0121] | 6.0 s [4.7 s–7.4 s] |
| rails/x087 | with | 2/2 | 2 [2–2] | 2,148 [2,148–2,148] | 488 [481–495] | 1,628 [1,628–1,628] | 4,105 [3,874–4,335] | $0.0198 [$0.0191–$0.0204] | 5.0 s [4.5 s–5.4 s] |
| rails/x088 | without | 2/2 | 5 [4–5] | 219 [219–219] | 795 [784–805] | 15,757 [15,616–15,897] | 8,137 [7,390–8,883] | $0.0319 [$0.0299–$0.0339] | 11.1 s [11.0 s–11.3 s] |
| rails/x088 | with | 2/2 | 3 [3–3] | 1,737 [1,737–1,737] | 629 [625–632] | 5,747 [5,212–6,281] | 5,427 [4,798–6,056] | $0.0245 [$0.0228–$0.0261] | 11.6 s [9.1 s–14.1 s] |

