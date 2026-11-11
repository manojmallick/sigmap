# Agent-level A/B — measured tool calls, tokens and cost

**anthropic-messages-api direct Messages API · claude-sonnet-5-5 · 2026-11-11 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap index strategy + 7-tool core MCP profile (the docs' setup for an agent that calls the tools).
- Both arms: the same prompt, model, tool allowlist (Read, Grep, Glob, Bash), per-run budget cap $0.25 and timeout 420 s; run in a clean copy of the commit pinned in `benchmarks/xrepo-repos.json`.
- Questions: the task id(s) x027, x028, x029, x030, x031 of `benchmarks/tasks/retrieval-xrepo.jsonl`. Pass = hit@5 on the repository-relative paths the answer names.
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
| django | 5 | 10/10 | 10/10 | 0 / 0 |
| all | 5 | 10/10 | 10/10 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 5. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −36% | −23% | fewer in every repetition |
| Input tokens (uncached) | 0% | 0% | fewer in every repetition |
| Output tokens | −26% | −12% | fewer in every repetition |
| Cache-read tokens | +6% | +56% | more in every repetition |
| Cache-write tokens | −65% | −83% | fewer in every repetition |
| Total tokens (derived) | −20% | −6% | fewer in every repetition |
| Cost | −47% | −54% | fewer in every repetition |
| Wall time | −14% | −3% | fewer in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −33% [−53%, −8%] | −26% [−55%, +12%] † | fewer in every repetition, within the noise |
| Input tokens (uncached) | 0% [−1%, 0%] † | 0% [−1%, 0%] † | fewer in every repetition, within the noise |
| Output tokens | −25% [−33%, −17%] | −15% [−30%, +7%] † | fewer in every repetition, within the noise |
| Cache-read tokens | +40% [−24%, +156%] † | +89% [+5%, +240%] | more in every repetition, within the noise |
| Cache-write tokens | −47% [−81%, +49%] † | −86% [−93%, −72%] n=4 | fewer in every repetition, within the noise |
| Total tokens (derived) | +6% [−43%, +97%] † | +5% [−36%, +71%] † | more in every repetition, within the noise |
| Cost | −37% [−62%, +7%] † | −54% [−68%, −37%] | fewer in every repetition, within the noise |
| Wall time | −16% [−36%, +13%] † | −1% [−28%, +33%] † | fewer in every repetition, within the noise |

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
| django | 3 | 2 | −1 | 3 / 2 / 0 |
| all | 3 | 2 | −1 | 3 / 2 / 0 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | 198 | 197 | 0 | 2 / 3 / 0 |
| all | 198 | 197 | 0 | 2 / 3 / 0 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | 486 | 367 | −110 | 4 / 0 / 1 |
| all | 486 | 367 | −110 | 4 / 0 / 1 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | 6,325 | 9,833 | +1,282 | 2 / 0 / 3 |
| all | 6,325 | 9,833 | +1,282 | 2 / 0 / 3 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | 4,915 | 1,048 | −4,376 | 5 / 0 / 0 |
| all | 4,915 | 1,048 | −4,376 | 5 / 0 / 0 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | 11,921 | 11,578 | −3,739 | 3 / 0 / 2 |
| all | 11,921 | 11,578 | −3,739 | 3 / 0 / 2 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd), or computed from the API's usage and a price table when the run went through the Messages API directly. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | $0.0188 | $0.0076 | −$0.0120 | 5 / 0 / 0 |
| all | $0.0188 | $0.0076 | −$0.0120 | 5 / 0 / 0 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | 4.9 s | 4.6 s | −826 ms | 3 / 0 / 2 |
| all | 4.9 s | 4.6 s | −826 ms | 3 / 0 / 2 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| django | $0.1882 (10 runs) | $0.0931 (10 runs) | none | none |
| all | $0.1882 (10 runs) | $0.0931 (10 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| django/x027 | without | 2/2 | 1 [1–1] | 196 [196–196] | 371 [365–376] | 1,628 [1,628–1,628] | 1,667 [662–2,671] | $0.0086 [$0.0061–$0.0110] | 3.9 s [3.8 s–4.0 s] |
| django/x027 | with | 2/2 | 1 [1–1] | 196 [196–196] | 340 [338–342] | 5,848 [5,398–6,298] | 1,048 [586–1,510] | $0.0076 [$0.0065–$0.0086] | 4.8 s [4.3 s–5.3 s] |
| django/x028 | without | 2/2 | 3 [3–3] | 195 [195–195] | 486 [467–505] | 6,325 [5,568–7,081] | 4,915 [4,874–4,956] | $0.0188 [$0.0187–$0.0189] | 4.9 s [4.4 s–5.4 s] |
| django/x028 | with | 2/2 | 1 [1–1] | 193 [193–193] | 376 [351–401] | 6,298 [6,298–6,298] | 539 [422–656] | $0.0068 [$0.0067–$0.0068] | 3.9 s [3.5 s–4.3 s] |
| django/x029 | without | 2/2 | 2 [2–2] | 199 [199–199] | 464 [439–488] | 2,927 [2,914–2,939] | 1,115 [705–1,525] | $0.0084 [$0.0076–$0.0092] | 4.7 s [4.6 s–4.8 s] |
| django/x029 | with | 2/2 | 2 [2–2] | 199 [199–199] | 328 [325–331] | 10,514 [9,799–11,228] | 715 [0–1,429] | $0.0076 [$0.0060–$0.0092] | 3.8 s [3.8 s–3.9 s] |
| django/x030 | without | 2/2 | 4 [3–4] | 198 [197–199] | 581 [520–641] | 12,857 [11,762–13,952] | 8,677 [7,896–9,458] | $0.0305 [$0.0281–$0.0328] | 8.4 s [8.1 s–8.6 s] |
| django/x030 | with | 2/2 | 2 [2–2] | 197 [197–197] | 367 [320–413] | 9,833 [9,730–9,936] | 1,182 [501–1,862] | $0.0090 [$0.0068–$0.0112] | 4.6 s [4.5 s–4.7 s] |
| django/x031 | without | 2/2 | 4 [3–5] | 206 [205–207] | 581 [511–650] | 11,372 [7,432–15,312] | 7,748 [7,581–7,914] | $0.0279 [$0.0268–$0.0289] | 5.5 s [5.1 s–5.8 s] |
| django/x031 | with | 2/2 | 4 [3–4] | 206 [205–207] | 593 [522–664] | 12,654 [9,778–15,529] | 2,715 [2,642–2,787] | $0.0157 [$0.0142–$0.0171] | 7.7 s [7.5 s–8.0 s] |

