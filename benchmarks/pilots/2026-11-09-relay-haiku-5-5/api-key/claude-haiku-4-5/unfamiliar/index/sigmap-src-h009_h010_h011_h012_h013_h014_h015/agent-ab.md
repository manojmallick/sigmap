# Agent-level A/B — measured tool calls, tokens and cost

**anthropic-messages-api direct Messages API · claude-haiku-4-5 · 2026-11-11 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap index strategy + 7-tool core MCP profile (the docs' setup for an agent that calls the tools).
- Both arms: the same prompt, model, tool allowlist (Read, Grep, Glob, Bash), per-run budget cap $0.25 and timeout 420 s; run in a clean copy of the commit pinned in `benchmarks/xrepo-repos.json`.
- Questions: the task id(s) h009, h010, h011, h012, h013, h014, h015 of `benchmarks/tasks/retrieval-xrepo.jsonl`. Pass = hit@5 on the repository-relative paths the answer names.
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
| sigmap-src | 7 | 12/14 | 14/14 | 0 / 0 |
| all | 7 | 12/14 | 14/14 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 7. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −24% | −38% | fewer in every repetition |
| Input tokens (uncached) | +40% | +20% | more in every repetition |
| Output tokens | −14% | −25% | fewer in every repetition |
| Cache-read tokens | +27% | −43% | mixed |
| Cache-write tokens | −22% | −20% | fewer in every repetition |
| Total tokens (derived) | +16% | −39% | mixed |
| Cost | −8% | −25% | fewer in every repetition |
| Wall time | −6% | −19% | fewer in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −28% [−50%, 0%] † | −44% [−58%, −22%] | fewer in every repetition, within the noise |
| Input tokens (uncached) | +50% [−25%, +219%] † | +32% [−17%, +109%] † | more in every repetition, within the noise |
| Output tokens | −21% [−42%, +8%] † | −31% [−48%, −9%] | fewer in every repetition, within the noise |
| Cache-read tokens | −43% [−79%, +53%] † | −55% [−76%, −20%] | fewer in every repetition, within the noise |
| Cache-write tokens | −32% [−60%, +17%] † | −22% [−36%, −3%] | fewer in every repetition, within the noise |
| Total tokens (derived) | −33% [−68%, +46%] † | −46% [−67%, −15%] | fewer in every repetition, within the noise |
| Cost | −24% [−53%, +30%] † | −27% [−44%, −4%] | fewer in every repetition, within the noise |
| Wall time | −15% [−39%, +18%] † | −24% [−42%, 0%] | fewer in every repetition, within the noise |

### Outcome (hit@5), by repetition

Per paired task: **better** = the SigMap arm named the file and the other did not; **worse** = the reverse; **tie** = both found it or both missed. Localisation only.

| repetition | paired tasks | better | worse | tie |
| --- | ---: | ---: | ---: | ---: |
| R1 | 7 | 1 | 0 | 6 |
| R2 | 7 | 1 | 0 | 6 |
| all | 14 | 2 | 0 | 12 |

## Tool calls

Provenance: agent-reported (main-thread tool_use blocks). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 12 | 8 | −4 | 6 / 0 / 1 |
| all | 12 | 8 | −4 | 6 / 0 / 1 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 2,989 | 2,801 | −153 | 4 / 0 / 3 |
| all | 2,989 | 2,801 | −153 | 4 / 0 / 3 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 1,178 | 1,012 | −329 | 6 / 0 / 1 |
| all | 1,178 | 1,012 | −329 | 6 / 0 / 1 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 91,044 | 55,036 | −37,449 | 5 / 0 / 2 |
| all | 91,044 | 55,036 | −37,449 | 5 / 0 / 2 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 19,067 | 14,056 | −6,185 | 6 / 0 / 1 |
| all | 19,067 | 14,056 | −6,185 | 6 / 0 / 1 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 112,601 | 78,644 | −43,387 | 5 / 0 / 2 |
| all | 112,601 | 78,644 | −43,387 | 5 / 0 / 2 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd), or computed from the API's usage and a price table when the run went through the Messages API directly. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | $0.0422 | $0.0341 | −$0.0127 | 6 / 0 / 1 |
| all | $0.0422 | $0.0341 | −$0.0127 | 6 / 0 / 1 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 14.3 s | 13.4 s | −3.3 s | 5 / 0 / 2 |
| all | 14.3 s | 13.4 s | −3.3 s | 5 / 0 / 2 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | $0.6052 (14 runs) | $0.4967 (14 runs) | none | none |
| all | $0.6052 (14 runs) | $0.4967 (14 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| sigmap-src/h009 | without | 2/2 | 11 [8–14] | 3,798 [3,075–4,520] | 1,063 [869–1,256] | 66,345 [20,688–112,001] | 15,691 [11,642–19,740] | $0.0354 [$0.0255–$0.0452] | 12.5 s [9.7 s–15.2 s] |
| sigmap-src/h009 | with | 2/2 | 7 [4–9] | 2,794 [2,784–2,803] | 662 [447–877] | 24,723 [9,985–39,460] | 10,097 [10,024–10,169] | $0.0212 [$0.0187–$0.0237] | 9.2 s [6.1 s–12.2 s] |
| sigmap-src/h010 | without | 2/2 | 16 [11–20] | 2,989 [1,076–4,901] | 1,620 [1,162–2,077] | 177,074 [68,967–285,181] | 19,067 [13,213–24,921] | $0.0526 [$0.0303–$0.0750] | 19.9 s [14.1 s–25.6 s] |
| sigmap-src/h010 | with | 2/2 | 13 [11–15] | 2,836 [2,826–2,846] | 1,554 [1,342–1,765] | 253,701 [155,225–352,176] | 28,169 [21,654–34,683] | $0.0712 [$0.0521–$0.0902] | 20.6 s [17.8 s–23.3 s] |
| sigmap-src/h011 | without | 2/2 | 9 [5–13] | 3,042 [1,085–4,998] | 989 [680–1,297] | 64,042 [24,690–103,393] | 22,265 [18,270–26,259] | $0.0422 [$0.0407–$0.0437] | 12.3 s [8.8 s–15.8 s] |
| sigmap-src/h011 | with | 2/2 | 10 [3–17] | 2,811 [2,780–2,841] | 1,075 [397–1,752] | 83,044 [9,568–156,520] | 14,100 [5,505–22,695] | $0.0341 [$0.0126–$0.0556] | 13.7 s [5.4 s–22.0 s] |
| sigmap-src/h012 | without | 2/2 | 12 [8–16] | 1,712 [1,067–2,356] | 1,210 [821–1,598] | 150,779 [67,100–234,457] | 25,933 [19,679–32,187] | $0.0553 [$0.0365–$0.0740] | 15.2 s [10.8 s–19.6 s] |
| sigmap-src/h012 | with | 2/2 | 7 [7–7] | 2,801 [2,796–2,805] | 867 [828–905] | 70,549 [59,709–81,389] | 19,748 [19,108–20,388] | $0.0389 [$0.0384–$0.0394] | 11.5 s [10.7 s–12.3 s] |
| sigmap-src/h013 | without | 0/2 | 19 [17–21] | 4,442 [4,397–4,486] | 1,606 [1,394–1,817] | 99,717 [71,870–127,563] | 19,407 [18,688–20,125] | $0.0467 [$0.0420–$0.0514] | 18.5 s [16.1 s–20.9 s] |
| sigmap-src/h013 | with | 2/2 | 10 [5–14] | 2,798 [2,777–2,819] | 1,078 [576–1,579] | 40,961 [4,238–77,684] | 13,010 [8,831–17,189] | $0.0285 [$0.0171–$0.0400] | 13.4 s [6.9 s–20.0 s] |
| sigmap-src/h014 | without | 2/2 | 8 [6–9] | 1,696 [1,060–2,331] | 790 [620–959] | 51,248 [43,467–59,029] | 15,735 [12,535–18,934] | $0.0304 [$0.0242–$0.0367] | 10.3 s [8.6 s–12.0 s] |
| sigmap-src/h014 | with | 2/2 | 4 [3–5] | 2,783 [2,782–2,784] | 461 [385–536] | 13,800 [12,209–15,390] | 9,038 [8,362–9,713] | $0.0178 [$0.0164–$0.0191] | 6.5 s [5.8 s–7.2 s] |
| sigmap-src/h015 | without | 2/2 | 12 [10–14] | 1,846 [1,075–2,617] | 1,178 [1,036–1,320] | 91,044 [90,401–91,686] | 18,533 [18,232–18,834] | $0.0400 [$0.0382–$0.0418] | 14.3 s [12.8 s–15.7 s] |
| sigmap-src/h015 | with | 2/2 | 8 [8–8] | 8,540 [6,564–10,515] | 1,012 [993–1,031] | 55,036 [32,861–77,211] | 14,056 [10,066–18,046] | $0.0367 [$0.0313–$0.0420] | 13.8 s [13.2 s–14.5 s] |

