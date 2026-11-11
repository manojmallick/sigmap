# Agent-level A/B — measured tool calls, tokens and cost

**anthropic-messages-api direct Messages API · claude-haiku-4-5 · 2026-11-11 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap index strategy + 7-tool core MCP profile (the docs' setup for an agent that calls the tools).
- Both arms: the same prompt, model, tool allowlist (Read, Grep, Glob, Bash), per-run budget cap $0.25 and timeout 420 s; run in a clean copy of the commit pinned in `benchmarks/xrepo-repos.json`.
- Questions: the task id(s) x145, x146, x147, x148, x149, x150, x151, x152 of `benchmarks/tasks/retrieval-xrepo.jsonl`. Pass = hit@5 on the repository-relative paths the answer names.
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
| fastapi | 8 | 16/16 | 16/16 | 0 / 0 |
| all | 8 | 16/16 | 16/16 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 8. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −40% | −24% | fewer in every repetition |
| Input tokens (uncached) | −42% | −38% | fewer in every repetition |
| Output tokens | −27% | −23% | fewer in every repetition |
| Cache-read tokens | +13% | −2% | mixed |
| Cache-write tokens | +17% | −11% | mixed |
| Total tokens (derived) | +10% | −6% | mixed |
| Cost | −2% | −16% | fewer in every repetition |
| Wall time | −22% | −19% | fewer in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −44% [−63%, −16%] | −32% [−56%, −3%] | fewer in every repetition, outside the noise |
| Input tokens (uncached) | −26% [−64%, +62%] † | −32% [−54%, +10%] † | fewer in every repetition, within the noise |
| Output tokens | −33% [−53%, −6%] | −26% [−43%, −3%] | fewer in every repetition, outside the noise |
| Cache-read tokens | −23% [−61%, +58%] † | −1% [−41%, +63%] † n=7 | fewer in every repetition, within the noise |
| Cache-write tokens | +8% [−31%, +71%] † | −12% [−30%, +18%] † | mixed |
| Total tokens (derived) | −15% [−54%, +58%] † | −21% [−52%, +29%] † | fewer in every repetition, within the noise |
| Cost | −9% [−39%, +36%] † | −20% [−35%, +2%] † | fewer in every repetition, within the noise |
| Wall time | −27% [−47%, 0%] | −21% [−40%, +2%] † | fewer in every repetition, within the noise |

### Outcome (hit@5), by repetition

Per paired task: **better** = the SigMap arm named the file and the other did not; **worse** = the reverse; **tie** = both found it or both missed. Localisation only.

| repetition | paired tasks | better | worse | tie |
| --- | ---: | ---: | ---: | ---: |
| R1 | 8 | 0 | 0 | 8 |
| R2 | 8 | 0 | 0 | 8 |
| all | 16 | 0 | 0 | 16 |

## Tool calls

Provenance: agent-reported (main-thread tool_use blocks). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | 16 | 10 | −6 | 6 / 0 / 2 |
| all | 16 | 10 | −6 | 6 / 0 / 2 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | 8,529 | 5,061 | −1,867 | 7 / 0 / 1 |
| all | 8,529 | 5,061 | −1,867 | 7 / 0 / 1 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | 1,903 | 1,149 | −536 | 6 / 0 / 2 |
| all | 1,903 | 1,149 | −536 | 6 / 0 / 2 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | 99,041 | 77,484 | −21,751 | 6 / 0 / 2 |
| all | 99,041 | 77,484 | −21,751 | 6 / 0 / 2 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | 14,418 | 13,963 | −1,404 | 4 / 0 / 4 |
| all | 14,418 | 13,963 | −1,404 | 4 / 0 / 4 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | 130,336 | 96,486 | −27,202 | 6 / 0 / 2 |
| all | 130,336 | 96,486 | −27,202 | 6 / 0 / 2 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd), or computed from the API's usage and a price table when the run went through the Messages API directly. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | $0.0494 | $0.0340 | −$0.0093 | 6 / 0 / 2 |
| all | $0.0494 | $0.0340 | −$0.0093 | 6 / 0 / 2 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | 22.5 s | 15.3 s | −5.5 s | 6 / 0 / 2 |
| all | 22.5 s | 15.3 s | −5.5 s | 6 / 0 / 2 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| fastapi | $0.7484 (16 runs) | $0.6834 (16 runs) | none | none |
| all | $0.7484 (16 runs) | $0.6834 (16 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| fastapi/x145 | without | 2/2 | 15 [12–18] | 8,901 [7,070–10,731] | 1,851 [1,616–2,085] | 155,003 [75,526–234,479] | 23,228 [13,604–32,851] | $0.0627 [$0.0434–$0.0820] | 22.4 s [19.1 s–25.6 s] |
| fastapi/x145 | with | 2/2 | 9 [8–9] | 3,112 [3,106–3,117] | 1,076 [1,024–1,127] | 73,110 [60,523–85,697] | 13,998 [13,008–14,987] | $0.0333 [$0.0311–$0.0355] | 14.7 s [14.6 s–14.8 s] |
| fastapi/x146 | without | 2/2 | 8 [5–11] | 1,096 [1,085–1,106] | 1,050 [708–1,391] | 70,064 [29,604–110,523] | 15,334 [10,122–20,546] | $0.0325 [$0.0202–$0.0448] | 12.8 s [8.9 s–16.7 s] |
| fastapi/x146 | with | 2/2 | 9 [7–10] | 5,094 [3,128–7,060] | 1,106 [951–1,261] | 66,057 [36,353–95,760] | 11,644 [8,747–14,541] | $0.0318 [$0.0264–$0.0372] | 14.2 s [12.2 s–16.1 s] |
| fastapi/x147 | without | 2/2 | 19 [19–19] | 9,593 [8,212–10,973] | 2,066 [2,041–2,090] | 126,814 [94,324–159,303] | 13,718 [11,420–16,016] | $0.0497 [$0.0449–$0.0546] | 25.1 s [24.4 s–25.9 s] |
| fastapi/x147 | with | 2/2 | 11 [8–13] | 5,057 [3,109–7,004] | 1,192 [1,026–1,358] | 81,857 [77,050–86,664] | 14,730 [9,447–20,013] | $0.0376 [$0.0333–$0.0419] | 16.5 s [14.3 s–18.7 s] |
| fastapi/x148 | without | 2/2 | 16 [11–20] | 9,262 [9,200–9,323] | 1,435 [1,051–1,818] | 96,152 [92,866–99,437] | 18,404 [15,668–21,139] | $0.0491 [$0.0478–$0.0503] | 17.5 s [13.3 s–21.6 s] |
| fastapi/x148 | with | 2/2 | 10 [4–16] | 7,140 [7,032–7,248] | 1,017 [504–1,529] | 82,160 [18,009–146,311] | 11,361 [9,791–12,930] | $0.0346 [$0.0236–$0.0457] | 13.3 s [7.1 s–19.5 s] |
| fastapi/x149 | without | 2/2 | 10 [8–11] | 6,678 [4,123–9,233] | 1,108 [976–1,239] | 33,474 [9,656–57,292] | 13,045 [9,970–16,120] | $0.0319 [$0.0224–$0.0413] | 13.2 s [10.8 s–15.6 s] |
| fastapi/x149 | with | 2/2 | 3 [2–3] | 5,066 [3,077–7,054] | 517 [470–563] | 3,965 [0–7,929] | 13,928 [11,949–15,906] | $0.0255 [$0.0243–$0.0266] | 6.7 s [6.4 s–7.1 s] |
| fastapi/x150 | without | 2/2 | 19 [16–22] | 17,333 [9,852–24,814] | 2,221 [2,027–2,414] | 101,930 [94,493–109,367] | 13,938 [12,420–15,456] | $0.0561 [$0.0450–$0.0671] | 26.0 s [23.6 s–28.4 s] |
| fastapi/x150 | with | 2/2 | 14 [14–14] | 3,140 [3,132–3,148] | 1,740 [1,732–1,748] | 195,997 [80,958–311,036] | 24,683 [11,648–37,718] | $0.0623 [$0.0344–$0.0901] | 21.5 s [19.8 s–23.2 s] |
| fastapi/x151 | without | 2/2 | 19 [18–20] | 3,932 [3,654–4,210] | 2,229 [2,165–2,292] | 164,924 [148,454–181,393] | 14,899 [13,383–16,414] | $0.0502 [$0.0466–$0.0538] | 26.7 s [25.9 s–27.5 s] |
| fastapi/x151 | with | 2/2 | 11 [8–13] | 3,129 [3,113–3,144] | 1,297 [1,085–1,508] | 61,702 [40,421–82,983] | 9,286 [8,314–10,258] | $0.0274 [$0.0230–$0.0318] | 16.0 s [13.2 s–18.8 s] |
| fastapi/x152 | without | 2/2 | 16 [14–18] | 8,158 [5,093–11,222] | 1,955 [1,754–2,155] | 93,539 [61,379–125,699] | 11,834 [10,665–13,002] | $0.0421 [$0.0395–$0.0447] | 22.7 s [20.6 s–24.8 s] |
| fastapi/x152 | with | 2/2 | 17 [13–21] | 7,150 [7,074–7,225] | 2,448 [1,773–3,123] | 330,881 [194,611–467,150] | 29,393 [22,691–36,095] | $0.0892 [$0.0639–$0.1145] | 29.3 s [21.5 s–37.0 s] |

