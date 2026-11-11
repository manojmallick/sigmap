# Agent-level A/B — measured tool calls, tokens and cost

**anthropic-messages-api direct Messages API · claude-sonnet-5-5 · 2026-11-11 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap index strategy + 7-tool core MCP profile (the docs' setup for an agent that calls the tools).
- Both arms: the same prompt, model, tool allowlist (Read, Grep, Glob, Bash), per-run budget cap $0.25 and timeout 420 s; run in a clean copy of the commit pinned in `benchmarks/xrepo-repos.json`.
- Questions: the task id(s) x046, x047, x048, x049, x050 of `benchmarks/tasks/retrieval-xrepo.jsonl`. Pass = hit@5 on the repository-relative paths the answer names.
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
| laravel | 5 | 10/10 | 10/10 | 0 / 0 |
| all | 5 | 10/10 | 10/10 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 5. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −46% | −44% | fewer in every repetition |
| Input tokens (uncached) | −2% | −1% | fewer in every repetition |
| Output tokens | −28% | −24% | fewer in every repetition |
| Cache-read tokens | −12% | +1% | mixed |
| Cache-write tokens | −53% | −51% | fewer in every repetition |
| Total tokens (derived) | −24% | −14% | fewer in every repetition |
| Cost | −40% | −36% | fewer in every repetition |
| Wall time | −51% | −34% | fewer in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −47% [−58%, −27%] | −48% [−58%, −35%] | fewer in every repetition, outside the noise |
| Input tokens (uncached) | −2% [−3%, −1%] | −1% [−2%, −1%] | fewer in every repetition, outside the noise |
| Output tokens | −30% [−41%, −18%] | −23% [−35%, −10%] | fewer in every repetition, outside the noise |
| Cache-read tokens | −7% [−40%, +32%] † | +13% [−23%, +66%] † | mixed |
| Cache-write tokens | −60% [−75%, −39%] | −54% [−72%, −24%] | fewer in every repetition, outside the noise |
| Total tokens (derived) | −23% [−45%, +3%] † | −9% [−35%, +30%] † | fewer in every repetition, within the noise |
| Cost | −42% [−52%, −29%] | −36% [−53%, −13%] | fewer in every repetition, outside the noise |
| Wall time | −49% [−66%, −27%] | −34% [−42%, −22%] | fewer in every repetition, outside the noise |

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
| laravel | 6 | 3 | −3 | 5 / 0 / 0 |
| all | 6 | 3 | −3 | 5 / 0 / 0 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | 206 | 201 | −3 | 5 / 0 / 0 |
| all | 206 | 201 | −3 | 5 / 0 / 0 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | 834 | 556 | −227 | 5 / 0 / 0 |
| all | 834 | 556 | −227 | 5 / 0 / 0 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | 11,995 | 11,956 | −327 | 3 / 0 / 2 |
| all | 11,995 | 11,956 | −327 | 3 / 0 / 2 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | 5,646 | 2,302 | −4,194 | 5 / 0 / 0 |
| all | 5,646 | 2,302 | −4,194 | 5 / 0 / 0 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | 18,506 | 16,831 | −5,220 | 3 / 0 / 2 |
| all | 18,506 | 16,831 | −5,220 | 3 / 0 / 2 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd), or computed from the API's usage and a price table when the run went through the Messages API directly. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | $0.0252 | $0.0165 | −$0.0142 | 5 / 0 / 0 |
| all | $0.0252 | $0.0165 | −$0.0142 | 5 / 0 / 0 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | 10.2 s | 6.2 s | −3.1 s | 5 / 0 / 0 |
| all | 10.2 s | 6.2 s | −3.1 s | 5 / 0 / 0 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| laravel | $0.2745 (10 runs) | $0.1707 (10 runs) | none | none |
| all | $0.2745 (10 runs) | $0.1707 (10 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| laravel/x046 | without | 2/2 | 6 [5–6] | 207 [207–207] | 733 [645–821] | 20,438 [16,777–24,098] | 6,211 [5,786–6,635] | $0.0274 [$0.0247–$0.0300] | 14.0 s [12.3 s–15.6 s] |
| laravel/x046 | with | 2/2 | 3 [2–3] | 201 [201–201] | 556 [495–617] | 10,795 [10,125–11,465] | 2,017 [1,765–2,269] | $0.0132 [$0.0121–$0.0143] | 6.2 s [5.6 s–6.7 s] |
| laravel/x047 | without | 2/2 | 5 [4–5] | 197 [196–198] | 778 [626–929] | 6,816 [6,084–7,548] | 5,140 [5,099–5,181] | $0.0224 [$0.0208–$0.0239] | 13.2 s [8.4 s–17.9 s] |
| laravel/x047 | with | 2/2 | 2 [2–2] | 194 [194–194] | 551 [490–612] | 11,956 [11,890–12,022] | 4,130 [3,999–4,260] | $0.0186 [$0.0183–$0.0189] | 5.3 s [4.9 s–5.8 s] |
| laravel/x048 | without | 2/2 | 6 [4–7] | 209 [207–211] | 1,102 [925–1,279] | 25,209 [15,320–35,097] | 9,850 [8,749–10,951] | $0.0411 [$0.0346–$0.0476] | 10.2 s [7.8 s–12.5 s] |
| laravel/x048 | with | 2/2 | 5 [4–5] | 208 [207–209] | 851 [832–869] | 23,275 [18,909–27,640] | 5,162 [4,905–5,419] | $0.0265 [$0.0248–$0.0282] | 7.4 s [7.0 s–7.8 s] |
| laravel/x049 | without | 2/2 | 5 [4–5] | 201 [201–201] | 834 [715–952] | 11,826 [11,078–12,573] | 5,646 [4,958–6,334] | $0.0252 [$0.0222–$0.0283] | 8.3 s [7.7 s–8.8 s] |
| laravel/x049 | with | 2/2 | 2 [2–2] | 199 [199–199] | 517 [483–551] | 11,499 [11,487–11,511] | 1,071 [881–1,261] | $0.0105 [$0.0097–$0.0114] | 5.2 s [5.1 s–5.3 s] |
| laravel/x050 | without | 2/2 | 7 [6–7] | 206 [205–207] | 919 [844–994] | 11,995 [9,656–14,333] | 3,684 [3,377–3,991] | $0.0212 [$0.0192–$0.0232] | 9.6 s [7.7 s–11.6 s] |
| laravel/x050 | with | 2/2 | 4 [3–4] | 202 [201–203] | 741 [717–764] | 14,868 [11,459–18,277] | 2,302 [1,460–3,143] | $0.0165 [$0.0135–$0.0196] | 7.0 s [6.9 s–7.0 s] |

