# Agent-level A/B — measured tool calls, tokens and cost

**anthropic-messages-api direct Messages API · claude-haiku-4-5 · 2026-11-11 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap index strategy + 7-tool core MCP profile (the docs' setup for an agent that calls the tools).
- Both arms: the same prompt, model, tool allowlist (Read, Grep, Glob, Bash), per-run budget cap $0.25 and timeout 420 s; run in a clean copy of the commit pinned in `benchmarks/xrepo-repos.json`.
- Questions: the task id(s) h016, h017, h018, h019, h020, h021, h022, h023 of `benchmarks/tasks/retrieval-xrepo.jsonl`. Pass = hit@5 on the repository-relative paths the answer names.
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
| sigmap-src | 8 | 11/16 | 11/16 | 1 / 0 |
| all | 8 | 11/16 | 11/16 | 1 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 8. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −34% n=7 | −66% | fewer in every repetition |
| Input tokens (uncached) | −19% n=7 | −2% | fewer in every repetition |
| Output tokens | −20% n=7 | −50% | fewer in every repetition |
| Cache-read tokens | −15% n=7 | −81% | fewer in every repetition |
| Cache-write tokens | −29% n=7 | −49% | fewer in every repetition |
| Total tokens (derived) | −17% n=7 | −75% | fewer in every repetition |
| Cost | −23% n=7 | −54% | fewer in every repetition |
| Wall time | −13% n=7 | −46% | fewer in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −46% [−72%, −1%] n=6 | −67% [−78%, −50%] n=7 | fewer in every repetition, outside the noise |
| Input tokens (uncached) | +1% [−45%, +80%] † n=7 | +33% [−22%, +118%] † | more in every repetition, within the noise |
| Output tokens | −30% [−57%, +4%] † n=7 | −48% [−65%, −26%] | fewer in every repetition, within the noise |
| Cache-read tokens | −46% [−83%, +41%] † n=6 | −82% [−94%, −47%] n=6 | fewer in every repetition, within the noise |
| Cache-write tokens | −31% [−61%, +4%] † n=6 | −50% [−61%, −30%] n=7 | fewer in every repetition, within the noise |
| Total tokens (derived) | −26% [−69%, +56%] † n=7 | −68% [−86%, −25%] | fewer in every repetition, within the noise |
| Cost | −19% [−55%, +36%] † n=7 | −44% [−64%, −6%] | fewer in every repetition, within the noise |
| Wall time | −21% [−52%, +15%] † n=7 | −42% [−60%, −17%] | fewer in every repetition, within the noise |

### Outcome (hit@5), by repetition

Per paired task: **better** = the SigMap arm named the file and the other did not; **worse** = the reverse; **tie** = both found it or both missed. Localisation only.

| repetition | paired tasks | better | worse | tie |
| --- | ---: | ---: | ---: | ---: |
| R1 | 7 | 0 | 0 | 7 |
| R2 | 8 | 1 | 2 | 5 |
| all | 15 | 1 | 2 | 12 |

## Tool calls

Provenance: agent-reported (main-thread tool_use blocks). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 14 | 7 | −7 | 7 / 1 / 0 |
| all | 14 | 7 | −7 | 7 / 1 / 0 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 3,625 | 2,817 | −792 | 5 / 0 / 3 |
| all | 3,625 | 2,817 | −792 | 5 / 0 / 3 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 1,362 | 857 | −248 | 8 / 0 / 0 |
| all | 1,362 | 857 | −248 | 8 / 0 / 0 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 122,432 | 38,479 | −31,382 | 6 / 1 / 1 |
| all | 122,432 | 38,479 | −31,382 | 6 / 1 / 1 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 18,977 | 13,982 | −5,539 | 5 / 1 / 2 |
| all | 18,977 | 13,982 | −5,539 | 5 / 1 / 2 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 148,234 | 58,040 | −37,883 | 6 / 0 / 2 |
| all | 148,234 | 58,040 | −37,883 | 6 / 0 / 2 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd), or computed from the API's usage and a price table when the run went through the Messages API directly. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | $0.0465 | $0.0303 | −$0.0117 | 5 / 0 / 3 |
| all | $0.0465 | $0.0303 | −$0.0117 | 5 / 0 / 3 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 16.5 s | 11.4 s | −1.5 s | 6 / 0 / 2 |
| all | 16.5 s | 11.4 s | −1.5 s | 6 / 0 / 2 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | $0.8052 (16 runs) | $0.5191 (16 runs) | $0.0991 (1 run) | none |
| all | $0.8052 (16 runs) | $0.5191 (16 runs) | $0.0991 (1 run) | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| sigmap-src/h016 | without | 2/2 | 12 [10–13] | 3,843 [1,069–6,617] | 1,183 [891–1,475] | 69,027 [57,037–81,017] | 19,409 [18,767–20,050] | $0.0409 [$0.0347–$0.0472] | 14.2 s [10.8 s–17.6 s] |
| sigmap-src/h016 | with | 2/2 | 6 [5–7] | 2,795 [2,793–2,796] | 855 [781–929] | 39,868 [29,934–49,802] | 12,885 [9,859–15,910] | $0.0272 [$0.0220–$0.0323] | 11.9 s [10.2 s–13.7 s] |
| sigmap-src/h017 | without | 2/2 | 15 [6–23] | 6,080 [2,240–9,920] | 1,458 [798–2,118] | 132,513 [68,807–196,218] | 24,760 [18,961–30,559] | $0.0576 [$0.0368–$0.0783] | 17.7 s [9.9 s–25.5 s] |
| sigmap-src/h017 | with | 2/2 | 4 [3–5] | 2,784 [2,781–2,786] | 528 [432–623] | 12,819 [9,248–16,390] | 7,519 [5,840–9,197] | $0.0161 [$0.0132–$0.0190] | 6.7 s [5.7 s–7.7 s] |
| sigmap-src/h018 | without | 1/2 | 18 [18–18] | 5,302 [3,481–7,123] | 1,940 [1,791–2,089] | 138,794 [83,523–194,065] | 18,545 [18,046–19,044] | $0.0521 [$0.0433–$0.0608] | 21.9 s [19.3 s–24.5 s] |
| sigmap-src/h018 | with | 1/2 | 7 [4–10] | 2,788 [2,778–2,797] | 859 [623–1,095] | 26,566 [4,228–48,903] | 10,693 [6,143–15,243] | $0.0231 [$0.0140–$0.0322] | 10.0 s [7.4 s–12.6 s] |
| sigmap-src/h019 | without | 2/2 | 22 [14–29] | 3,406 [3,019–3,793] | 2,109 [1,677–2,540] | 235,256 [90,534–379,977] | 21,333 [14,945–27,720] | $0.0641 [$0.0391–$0.0891] | 25.1 s [19.0 s–31.2 s] |
| sigmap-src/h019 | with | 2/2 | 18 [12–23] | 2,871 [2,840–2,902] | 2,096 [1,511–2,681] | 201,652 [105,194–298,109] | 16,779 [12,848–20,709] | $0.0545 [$0.0370–$0.0720] | 26.4 s [19.6 s–33.2 s] |
| sigmap-src/h020 | without | 1/2 | 14 [14–14] n=1 | 1,093 [1,093–1,093] n=1 | 1,266 [1,266–1,266] n=1 | 112,352 [112,352–112,352] n=1 | 17,175 [17,175–17,175] n=1 | $0.0401 [$0.0401–$0.0401] n=1 | 15.4 s [15.4 s–15.4 s] n=1 |
| sigmap-src/h020 | with | 1/2 | 13 [2–23] | 2,840 [2,779–2,900] | 1,225 [292–2,158] | 187,086 [4,195–369,976] | 17,453 [6,475–28,431] | $0.0495 [$0.0128–$0.0862] | 16.9 s [4.6 s–29.2 s] |
| sigmap-src/h021 | without | 0/2 | 0 [0–0] | 1,030 [1,030–1,030] | 86 [83–88] | 0 [0–0] | 0 [0–0] | $0.0015 [$0.0014–$0.0015] | 1.2 s [1.2 s–1.3 s] |
| sigmap-src/h021 | with | 0/2 | 0 [0–0] | 2,765 [2,765–2,765] | 70 [63–76] | 0 [0–0] | 0 [0–0] | $0.0031 [$0.0031–$0.0031] | 1.2 s [1.2 s–1.3 s] |
| sigmap-src/h022 | without | 1/2 | 14 [13–14] | 3,159 [2,485–3,832] | 1,011 [892–1,130] | 57,973 [27,103–88,842] | 14,437 [11,745–17,128] | $0.0321 [$0.0243–$0.0398] | 11.6 s [9.8 s–13.5 s] |
| sigmap-src/h022 | with | 2/2 | 6 [5–6] | 6,666 [6,652–6,680] | 843 [760–925] | 37,090 [29,664–44,516] | 15,079 [14,789–15,368] | $0.0334 [$0.0319–$0.0350] | 10.9 s [10.1 s–11.7 s] |
| sigmap-src/h023 | without | 2/2 | 21 [19–22] | 6,551 [1,150–11,952] | 1,997 [1,842–2,151] | 267,987 [144,813–391,161] | 33,144 [25,968–40,319] | $0.0848 [$0.0681–$0.1014] | 24.0 s [21.4 s–26.7 s] |
| sigmap-src/h023 | with | 1/2 | 12 [4–20] | 4,838 [2,879–6,797] | 1,353 [502–2,203] | 169,778 [0–339,555] | 19,261 [11,680–26,841] | $0.0527 [$0.0239–$0.0814] | 18.0 s [6.7 s–29.2 s] |

