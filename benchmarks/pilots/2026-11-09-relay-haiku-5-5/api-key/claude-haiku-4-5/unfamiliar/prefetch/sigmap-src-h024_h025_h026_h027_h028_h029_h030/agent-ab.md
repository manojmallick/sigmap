# Agent-level A/B — measured tool calls, tokens and cost

**anthropic-messages-api direct Messages API · claude-haiku-4-5 · 2026-11-11 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

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
| sigmap-src | 7 | 10/14 | 11/14 | 0 / 0 |
| all | 7 | 10/14 | 11/14 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 7. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −23% | −37% | fewer in every repetition |
| Input tokens (uncached) | −39% | −28% | fewer in every repetition |
| Output tokens | −19% | −31% | fewer in every repetition |
| Cache-read tokens | +5% | −42% | mixed |
| Cache-write tokens | +7% | −24% | mixed |
| Total tokens (derived) | +4% | −40% | mixed |
| Cost | −3% | −32% | fewer in every repetition |
| Wall time | −14% | −29% | fewer in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −32% [−68%, +14%] † | −51% [−74%, −12%] | fewer in every repetition, within the noise |
| Input tokens (uncached) | −23% [−55%, +33%] † | +34% [−36%, +168%] † | mixed |
| Output tokens | −27% [−64%, +12%] † | −48% [−72%, −6%] | fewer in every repetition, within the noise |
| Cache-read tokens | +56% [+5%, +118%] n=6 | −43% [−86%, +56%] † n=6 | mixed |
| Cache-write tokens | +6% [−26%, +49%] † | −27% [−46%, −3%] | mixed |
| Total tokens (derived) | −9% [−68%, +79%] † | −60% [−86%, +4%] † | fewer in every repetition, within the noise |
| Cost | −5% [−44%, +39%] † | −41% [−63%, −7%] | fewer in every repetition, within the noise |
| Wall time | −20% [−58%, +23%] † | −45% [−70%, −2%] | fewer in every repetition, within the noise |

### Outcome (hit@5), by repetition

Per paired task: **better** = the SigMap arm named the file and the other did not; **worse** = the reverse; **tie** = both found it or both missed. Localisation only.

| repetition | paired tasks | better | worse | tie |
| --- | ---: | ---: | ---: | ---: |
| R1 | 7 | 0 | 0 | 7 |
| R2 | 7 | 1 | 0 | 6 |
| all | 14 | 1 | 0 | 13 |

## Tool calls

Provenance: agent-reported (main-thread tool_use blocks). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 16 | 11 | −6 | 6 / 0 / 1 |
| all | 16 | 11 | −6 | 6 / 0 / 1 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 3,042 | 2,900 | +127 | 3 / 0 / 4 |
| all | 3,042 | 2,900 | +127 | 3 / 0 / 4 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 1,611 | 1,048 | −443 | 6 / 0 / 1 |
| all | 1,611 | 1,048 | −443 | 6 / 0 / 1 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 176,892 | 105,865 | +16,347 | 3 / 0 / 4 |
| all | 176,892 | 105,865 | +16,347 | 3 / 0 / 4 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 17,959 | 18,048 | +89 | 3 / 0 / 4 |
| all | 17,959 | 18,048 | +89 | 3 / 0 / 4 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 203,835 | 127,453 | +18,064 | 3 / 0 / 4 |
| all | 203,835 | 127,453 | +18,064 | 3 / 0 / 4 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd), or computed from the API's usage and a price table when the run went through the Messages API directly. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | $0.0573 | $0.0372 | −$0.0038 | 4 / 0 / 3 |
| all | $0.0573 | $0.0372 | −$0.0038 | 4 / 0 / 3 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 19.6 s | 13.8 s | −3.3 s | 6 / 0 / 1 |
| all | 19.6 s | 13.8 s | −3.3 s | 6 / 0 / 1 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | $0.7677 (14 runs) | $0.6193 (14 runs) | none | none |
| all | $0.7677 (14 runs) | $0.6193 (14 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| sigmap-src/h024 | without | 0/2 | 16 [13–18] | 1,956 [1,134–2,777] | 1,720 [1,609–1,830] | 176,892 [82,728–271,055] | 23,268 [20,737–25,799] | $0.0573 [$0.0450–$0.0696] | 20.6 s [17.7 s–23.5 s] |
| sigmap-src/h024 | with | 1/2 | 24 [19–29] | 3,402 [3,385–3,419] | 2,732 [2,106–3,357] | 311,352 [188,719–433,984] | 26,169 [18,940–33,397] | $0.0809 [$0.0565–$0.1053] | 33.4 s [26.8 s–40.0 s] |
| sigmap-src/h025 | without | 2/2 | 23 [21–24] | 1,736 [1,133–2,339] | 2,039 [2,021–2,057] | 282,537 [248,470–316,604] | 24,706 [19,876–29,536] | $0.0711 [$0.0621–$0.0800] | 26.2 s [25.5 s–26.9 s] |
| sigmap-src/h025 | with | 2/2 | 10 [3–16] | 2,553 [2,514–2,592] | 1,048 [337–1,758] | 83,869 [0–167,737] | 14,599 [10,798–18,400] | $0.0344 [$0.0177–$0.0512] | 13.2 s [4.4 s–21.9 s] |
| sigmap-src/h026 | without | 0/2 | 31 [30–31] | 3,199 [1,176–5,222] | 2,557 [2,478–2,636] | 261,126 [236,404–285,847] | 17,959 [15,793–20,125] | $0.0645 [$0.0610–$0.0681] | 29.6 s [28.6 s–30.5 s] |
| sigmap-src/h026 | with | 0/2 | 25 [25–25] | 3,326 [3,325–3,327] | 2,115 [1,935–2,294] | 286,117 [254,860–317,374] | 18,048 [15,899–20,196] | $0.0651 [$0.0584–$0.0718] | 27.0 s [24.7 s–29.4 s] |
| sigmap-src/h027 | without | 2/2 | 16 [7–25] | 11,936 [11,553–12,318] | 1,611 [770–2,452] | 100,056 [13,648–186,464] | 15,963 [13,964–17,961] | $0.0499 [$0.0342–$0.0657] | 19.6 s [9.3 s–29.9 s] |
| sigmap-src/h027 | with | 2/2 | 4 [2–6] | 2,972 [2,960–2,984] | 445 [243–646] | 18,283 [0–36,565] | 8,842 [8,046–9,637] | $0.0181 [$0.0142–$0.0219] | 6.2 s [3.7 s–8.6 s] |
| sigmap-src/h028 | without | 2/2 | 14 [13–14] | 8,735 [5,777–11,692] | 1,391 [1,340–1,441] | 76,909 [58,940–94,877] | 14,072 [13,652–14,491] | $0.0410 [$0.0406–$0.0414] | 17.0 s [16.1 s–18.0 s] |
| sigmap-src/h028 | with | 2/2 | 11 [5–17] | 2,900 [2,859–2,941] | 1,046 [446–1,646] | 108,998 [22,713–195,283] | 14,509 [13,162–15,856] | $0.0372 [$0.0238–$0.0505] | 13.8 s [6.0 s–21.6 s] |
| sigmap-src/h029 | without | 2/2 | 15 [6–24] | 1,104 [1,048–1,159] | 1,513 [643–2,382] | 254,997 [19,611–490,382] | 21,842 [14,294–29,389] | $0.0615 [$0.0241–$0.0988] | 17.9 s [7.3 s–28.6 s] |
| sigmap-src/h029 | with | 2/2 | 5 [4–6] | 2,841 [2,835–2,846] | 573 [428–717] | 29,510 [12,463–46,556] | 18,810 [15,916–21,703] | $0.0322 [$0.0261–$0.0382] | 7.3 s [5.5 s–9.2 s] |
| sigmap-src/h030 | without | 2/2 | 14 [13–15] | 3,042 [1,083–5,000] | 1,260 [1,166–1,353] | 89,518 [78,336–100,700] | 16,205 [9,404–23,005] | $0.0385 [$0.0314–$0.0457] | 15.5 s [14.2 s–16.8 s] |
| sigmap-src/h030 | with | 2/2 | 11 [9–12] | 2,808 [2,801–2,815] | 1,114 [902–1,325] | 105,865 [70,798–140,931] | 18,302 [14,586–22,017] | $0.0418 [$0.0326–$0.0511] | 14.6 s [11.6 s–17.6 s] |

