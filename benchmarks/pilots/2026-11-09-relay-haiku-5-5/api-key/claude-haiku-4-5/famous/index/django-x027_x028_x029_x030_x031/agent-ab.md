# Agent-level A/B — measured tool calls, tokens and cost

**anthropic-messages-api direct Messages API · claude-haiku-4-5 · 2026-11-11 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

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
| django | 5 | 10/10 | 9/10 | 0 / 0 |
| all | 5 | 10/10 | 9/10 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 5. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −46% | −49% | fewer in every repetition |
| Input tokens (uncached) | −16% | −22% | fewer in every repetition |
| Output tokens | −26% | −31% | fewer in every repetition |
| Cache-read tokens | −62% | −64% | fewer in every repetition |
| Cache-write tokens | −35% | −37% | fewer in every repetition |
| Total tokens (derived) | −58% | −59% | fewer in every repetition |
| Cost | −39% | −42% | fewer in every repetition |
| Wall time | −21% | −26% | fewer in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −47% [−66%, −24%] | −49% [−67%, −22%] | fewer in every repetition, outside the noise |
| Input tokens (uncached) | −10% [−56%, +62%] † | +10% [−41%, +101%] † | mixed |
| Output tokens | −27% [−50%, −3%] | −30% [−55%, +6%] † | fewer in every repetition, within the noise |
| Cache-read tokens | −61% [−79%, −37%] | −53% [−78%, +20%] † | fewer in every repetition, within the noise |
| Cache-write tokens | −38% [−47%, −26%] | −37% [−43%, −32%] | fewer in every repetition, outside the noise |
| Total tokens (derived) | −56% [−73%, −37%] | −52% [−72%, −10%] | fewer in every repetition, outside the noise |
| Cost | −39% [−48%, −30%] | −39% [−50%, −27%] | fewer in every repetition, outside the noise |
| Wall time | −21% [−45%, +4%] † | −23% [−44%, +7%] † | fewer in every repetition, within the noise |

### Outcome (hit@5), by repetition

Per paired task: **better** = the SigMap arm named the file and the other did not; **worse** = the reverse; **tie** = both found it or both missed. Localisation only.

| repetition | paired tasks | better | worse | tie |
| --- | ---: | ---: | ---: | ---: |
| R1 | 5 | 0 | 1 | 4 |
| R2 | 5 | 0 | 0 | 5 |
| all | 10 | 0 | 1 | 9 |

## Tool calls

Provenance: agent-reported (main-thread tool_use blocks). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | 16 | 9 | −8 | 5 / 0 / 0 |
| all | 16 | 9 | −8 | 5 / 0 / 0 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | 4,306 | 6,726 | +2,123 | 2 / 0 / 3 |
| all | 4,306 | 6,726 | +2,123 | 2 / 0 / 3 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | 1,752 | 1,176 | −575 | 4 / 0 / 1 |
| all | 1,752 | 1,176 | −575 | 4 / 0 / 1 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | 146,845 | 61,954 | −103,742 | 4 / 0 / 1 |
| all | 146,845 | 61,954 | −103,742 | 4 / 0 / 1 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | 18,203 | 10,349 | −6,396 | 5 / 0 / 0 |
| all | 18,203 | 10,349 | −6,396 | 5 / 0 / 0 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | 174,813 | 79,702 | −109,713 | 4 / 0 / 1 |
| all | 174,813 | 79,702 | −109,713 | 4 / 0 / 1 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd), or computed from the API's usage and a price table when the run went through the Messages API directly. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | $0.0511 | $0.0322 | −$0.0205 | 5 / 0 / 0 |
| all | $0.0511 | $0.0322 | −$0.0205 | 5 / 0 / 0 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | 20.7 s | 14.8 s | −6.0 s | 4 / 0 / 1 |
| all | 20.7 s | 14.8 s | −6.0 s | 4 / 0 / 1 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| django | $0.5591 (10 runs) | $0.3313 (10 runs) | none | none |
| all | $0.5591 (10 runs) | $0.3313 (10 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| django/x027 | without | 2/2 | 15 [12–18] | 2,793 [1,107–4,479] | 1,778 [1,519–2,037] | 166,642 [163,690–169,593] | 18,203 [15,439–20,966] | $0.0511 [$0.0509–$0.0513] | 21.9 s [19.0 s–24.8 s] |
| django/x027 | with | 1/2 | 12 [10–13] | 4,916 [2,875–6,957] | 1,649 [1,295–2,003] | 62,900 [50,161–75,639] | 10,237 [9,254–11,220] | $0.0322 [$0.0284–$0.0361] | 21.2 s [15.0 s–27.4 s] |
| django/x028 | without | 2/2 | 11 [10–11] | 13,758 [10,925–16,591] | 997 [983–1,010] | 33,279 [25,486–41,071] | 13,697 [11,354–16,040] | $0.0392 [$0.0341–$0.0442] | 12.3 s [12.0 s–12.6 s] |
| django/x028 | with | 2/2 | 9 [7–10] | 6,748 [6,732–6,764] | 1,176 [868–1,484] | 50,045 [32,679–67,410] | 9,111 [7,591–10,631] | $0.0290 [$0.0239–$0.0342] | 14.8 s [11.5 s–18.0 s] |
| django/x029 | without | 2/2 | 22 [21–23] | 12,094 [11,773–12,414] | 2,103 [2,098–2,108] | 320,837 [319,037–322,637] | 26,021 [25,736–26,305] | $0.0872 [$0.0867–$0.0877] | 26.5 s [26.2 s–26.7 s] |
| django/x029 | with | 2/2 | 8 [5–10] | 4,906 [2,894–6,917] | 1,042 [692–1,391] | 95,048 [49,454–140,642] | 19,625 [17,559–21,690] | $0.0441 [$0.0373–$0.0510] | 15.9 s [13.0 s–18.9 s] |
| django/x030 | without | 2/2 | 16 [10–21] | 4,306 [3,671–4,941] | 1,532 [1,009–2,054] | 146,412 [62,603–230,220] | 16,220 [13,971–18,469] | $0.0469 [$0.0337–$0.0600] | 19.9 s [13.0 s–26.8 s] |
| django/x030 | with | 2/2 | 5 [5–5] | 6,726 [6,710–6,741] | 791 [734–847] | 27,696 [27,366–28,026] | 10,349 [9,816–10,881] | $0.0264 [$0.0260–$0.0267] | 11.1 s [10.7 s–11.6 s] |
| django/x031 | without | 2/2 | 17 [12–21] | 4,138 [3,412–4,864] | 1,752 [1,269–2,234] | 146,845 [72,544–221,145] | 22,079 [18,406–25,751] | $0.0552 [$0.0415–$0.0689] | 20.7 s [14.9 s–26.4 s] |
| django/x031 | with | 2/2 | 9 [8–10] | 6,779 [6,778–6,780] | 1,177 [1,081–1,272] | 61,954 [37,526–86,382] | 12,006 [8,641–15,371] | $0.0339 [$0.0277–$0.0400] | 14.7 s [14.2 s–15.1 s] |

