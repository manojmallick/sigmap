# Agent-level A/B — measured tool calls, tokens and cost

**anthropic-messages-api direct Messages API · claude-sonnet-5-5 · 2026-11-11 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap ranked the question BEFORE the first turn (what a prompt hook would inject): the five likeliest files with their signatures and line anchors after the question in the user turn, + the sigmap CLI; no MCP server, no standing section, no extra tool call.
- Both arms: the same prompt, model, tool allowlist (Read, Grep, Glob, Bash), per-run budget cap $0.25 and timeout 420 s; run in a clean copy of the commit pinned in `benchmarks/xrepo-repos.json`.
- Questions: the task id(s) h024, h025, h026, h027, h028, h029, h030 of `benchmarks/tasks/retrieval-xrepo.jsonl`. Pass = hit@5 on the repository-relative paths the answer names.
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
| sigmap-src | 7 | 10/14 | 14/14 | 0 / 0 |
| all | 7 | 10/14 | 14/14 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 7. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −22% | −17% | fewer in every repetition |
| Input tokens (uncached) | +1361% | +1370% | more in every repetition |
| Output tokens | −8% | −19% | fewer in every repetition |
| Cache-read tokens | −31% | +13% | mixed |
| Cache-write tokens | +10% | +12% | more in every repetition |
| Total tokens (derived) | −7% | +25% | mixed |
| Cost | +19% | +24% | more in every repetition |
| Wall time | +5% | −13% | mixed |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −25% [−39%, −9%] | −11% [−36%, +25%] † | fewer in every repetition, within the noise |
| Input tokens (uncached) | +1351% [+1223%, +1476%] | +1360% [+1228%, +1487%] | more in every repetition, outside the noise |
| Output tokens | −11% [−20%, +2%] † | −19% [−31%, −5%] | fewer in every repetition, within the noise |
| Cache-read tokens | −29% [−57%, +3%] † | +2% [−30%, +45%] † | mixed |
| Cache-write tokens | +6% [−20%, +45%] † | +8% [−14%, +39%] † | more in every repetition, within the noise |
| Total tokens (derived) | +4% [−25%, +41%] † | +27% [−3%, +64%] † | more in every repetition, within the noise |
| Cost | +20% [−2%, +47%] † | +23% [+5%, +46%] | more in every repetition, within the noise |
| Wall time | +9% [−16%, +41%] † | −10% [−26%, +14%] † | mixed |

### Outcome (hit@5), by repetition

Per paired task: **better** = the SigMap arm named the file and the other did not; **worse** = the reverse; **tie** = both found it or both missed. Localisation only.

| repetition | paired tasks | better | worse | tie |
| --- | ---: | ---: | ---: | ---: |
| R1 | 7 | 2 | 0 | 5 |
| R2 | 7 | 2 | 0 | 5 |
| all | 14 | 4 | 0 | 10 |

## Tool calls

Provenance: agent-reported (main-thread tool_use blocks). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 2 | 2 | −1 | 5 / 1 / 1 |
| all | 2 | 2 | −1 | 5 / 1 / 1 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 181 | 2,546 | +2,369 | 0 / 0 / 7 |
| all | 181 | 2,546 | +2,369 | 0 / 0 / 7 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 487 | 421 | −77 | 7 / 0 / 0 |
| all | 487 | 421 | −77 | 7 / 0 / 0 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 4,945 | 1,628 | 0 | 3 / 3 / 1 |
| all | 4,945 | 1,628 | 0 | 3 / 3 / 1 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 5,670 | 5,575 | −172 | 5 / 0 / 2 |
| all | 5,670 | 5,575 | −172 | 5 / 0 / 2 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 11,618 | 11,366 | +2,008 | 3 / 0 / 4 |
| all | 11,618 | 11,366 | +2,008 | 3 / 0 / 4 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd), or computed from the API's usage and a price table when the run went through the Messages API directly. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | $0.0212 | $0.0263 | +$0.0030 | 2 / 0 / 5 |
| all | $0.0212 | $0.0263 | +$0.0030 | 2 / 0 / 5 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 5.1 s | 6.7 s | −892 ms | 4 / 0 / 3 |
| all | 5.1 s | 6.7 s | −892 ms | 4 / 0 / 3 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | $0.3515 (14 runs) | $0.4269 (14 runs) | none | none |
| all | $0.3515 (14 runs) | $0.4269 (14 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| sigmap-src/h024 | without | 0/2 | 6 [5–6] | 182 [182–182] | 833 [707–959] | 28,066 [27,862–28,269] | 10,546 [10,354–10,737] | $0.0407 [$0.0399–$0.0414] | 8.7 s [8.2 s–9.3 s] |
| sigmap-src/h024 | with | 2/2 | 4 [3–5] | 3,110 [3,109–3,111] | 756 [654–858] | 17,413 [11,820–23,005] | 10,374 [10,217–10,531] | $0.0432 [$0.0414–$0.0449] | 6.8 s [6.2 s–7.4 s] |
| sigmap-src/h025 | without | 0/2 | 7 [7–7] | 181 [181–181] | 1,092 [1,023–1,161] | 16,886 [16,810–16,961] | 5,612 [5,512–5,712] | $0.0287 [$0.0278–$0.0296] | 13.8 s [13.1 s–14.4 s] |
| sigmap-src/h025 | with | 2/2 | 5 [5–5] | 2,093 [2,091–2,095] | 1,076 [1,060–1,091] | 30,466 [20,860–40,071] | 12,170 [11,651–12,689] | $0.0515 [$0.0510–$0.0519] | 12.9 s [10.9 s–14.8 s] |
| sigmap-src/h026 | without | 2/2 | 7 [5–8] | 186 [183–189] | 1,049 [905–1,192] | 32,853 [21,701–44,005] | 6,886 [6,301–7,470] | $0.0346 [$0.0295–$0.0398] | 11.7 s [9.7 s–13.7 s] |
| sigmap-src/h026 | with | 2/2 | 6 [6–6] | 2,943 [2,942–2,944] | 797 [721–872] | 22,301 [20,735–23,867] | 5,217 [5,145–5,289] | $0.0314 [$0.0307–$0.0320] | 8.3 s [7.7 s–8.8 s] |
| sigmap-src/h027 | without | 2/2 | 2 [2–2] | 171 [171–171] | 442 [420–463] | 1,628 [1,628–1,628] | 4,374 [4,221–4,526] | $0.0160 [$0.0159–$0.0162] | 4.4 s [4.1 s–4.6 s] |
| sigmap-src/h027 | with | 2/2 | 1 [1–1] | 2,681 [2,681–2,681] | 391 [380–401] | 1,628 [1,628–1,628] | 6,666 [6,591–6,741] | $0.0263 [$0.0262–$0.0263] | 6.1 s [4.1 s–8.0 s] |
| sigmap-src/h028 | without | 2/2 | 2 [1–2] | 170 [170–170] | 431 [359–502] | 1,628 [1,628–1,628] | 4,387 [4,280–4,494] | $0.0159 [$0.0150–$0.0169] | 4.1 s [3.6 s–4.7 s] |
| sigmap-src/h028 | with | 2/2 | 1 [1–1] | 2,517 [2,517–2,517] | 421 [405–436] | 1,628 [1,628–1,628] | 4,150 [4,139–4,161] | $0.0199 [$0.0198–$0.0201] | 6.2 s [5.9 s–6.6 s] |
| sigmap-src/h029 | without | 2/2 | 2 [1–2] | 177 [176–178] | 487 [482–492] | 4,945 [1,628–8,261] | 6,009 [5,934–6,084] | $0.0212 [$0.0204–$0.0220] | 5.1 s [4.9 s–5.3 s] |
| sigmap-src/h029 | with | 2/2 | 2 [2–2] | 2,546 [2,546–2,546] | 371 [331–411] | 1,628 [1,628–1,628] | 4,209 [4,176–4,241] | $0.0196 [$0.0193–$0.0200] | 6.7 s [4.8 s–8.6 s] |
| sigmap-src/h030 | without | 2/2 | 1 [1–1] | 181 [181–181] | 370 [320–419] | 1,628 [1,628–1,628] | 5,670 [5,670–5,670] | $0.0186 [$0.0181–$0.0191] | 4.0 s [3.7 s–4.2 s] |
| sigmap-src/h030 | with | 2/2 | 1 [1–1] | 2,400 [2,400–2,400] | 254 [253–254] | 1,628 [1,628–1,628] | 5,575 [5,575–5,575] | $0.0216 [$0.0216–$0.0216] | 2.8 s [2.8 s–2.9 s] |

