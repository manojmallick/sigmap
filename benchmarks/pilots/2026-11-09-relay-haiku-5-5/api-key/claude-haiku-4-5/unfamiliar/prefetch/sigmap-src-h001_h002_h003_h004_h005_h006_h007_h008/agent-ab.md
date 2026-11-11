# Agent-level A/B — measured tool calls, tokens and cost

**anthropic-messages-api direct Messages API · claude-haiku-4-5 · 2026-11-11 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap ranked the question BEFORE the first turn (what a prompt hook would inject): the five likeliest files with their signatures and line anchors after the question in the user turn, + the sigmap CLI; no MCP server, no standing section, no extra tool call.
- Both arms: the same prompt, model, tool allowlist (Read, Grep, Glob, Bash), per-run budget cap $0.25 and timeout 420 s; run in a clean copy of the commit pinned in `benchmarks/xrepo-repos.json`.
- Questions: the task id(s) h001, h002, h003, h004, h005, h006, h007, h008 of `benchmarks/tasks/retrieval-xrepo.jsonl`. Pass = hit@5 on the repository-relative paths the answer names.
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
| sigmap-src | 8 | 8/16 | 9/16 | 0 / 0 |
| all | 8 | 8/16 | 9/16 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 8. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | +13% | −36% | mixed |
| Input tokens (uncached) | −40% | −25% | fewer in every repetition |
| Output tokens | +21% | −19% | mixed |
| Cache-read tokens | +68% | −32% | mixed |
| Cache-write tokens | +41% | −19% | mixed |
| Total tokens (derived) | +61% | −31% | mixed |
| Cost | +35% | −24% | mixed |
| Wall time | +24% | −21% | mixed |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −48% [−78%, +6%] † n=6 | −71% [−85%, −40%] n=7 | fewer in every repetition, within the noise |
| Input tokens (uncached) | +15% [−53%, +145%] † | +5% [−44%, +92%] † | more in every repetition, within the noise |
| Output tokens | +43% [−56%, +406%] † | −23% [−72%, +224%] † | mixed |
| Cache-read tokens | +109% [−11%, +392%] † n=4 | −74% [−92%, −18%] n=5 | mixed |
| Cache-write tokens | −3% [−56%, +105%] † n=6 | −44% [−64%, −20%] n=7 | fewer in every repetition, within the noise |
| Total tokens (derived) | +179% [−63%, +2441%] † | −43% [−88%, +387%] † | mixed |
| Cost | +112% [−40%, +794%] † | −16% [−69%, +260%] † | mixed |
| Wall time | +54% [−49%, +413%] † | −25% [−72%, +199%] † | mixed |

### Outcome (hit@5), by repetition

Per paired task: **better** = the SigMap arm named the file and the other did not; **worse** = the reverse; **tie** = both found it or both missed. Localisation only.

| repetition | paired tasks | better | worse | tie |
| --- | ---: | ---: | ---: | ---: |
| R1 | 8 | 1 | 0 | 7 |
| R2 | 8 | 1 | 1 | 6 |
| all | 16 | 2 | 1 | 13 |

## Tool calls

Provenance: agent-reported (main-thread tool_use blocks). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 24 | 16 | −4 | 5 / 0 / 3 |
| all | 24 | 16 | −4 | 5 / 0 / 3 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 5,305 | 3,183 | −508 | 4 / 0 / 4 |
| all | 5,305 | 3,183 | −508 | 4 / 0 / 4 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 1,998 | 1,562 | −212 | 5 / 0 / 3 |
| all | 1,998 | 1,562 | −212 | 5 / 0 / 3 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 197,275 | 166,240 | −9,575 | 4 / 0 / 4 |
| all | 197,275 | 166,240 | −9,575 | 4 / 0 / 4 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 20,484 | 17,115 | +3,973 | 3 / 0 / 5 |
| all | 20,484 | 17,115 | +3,973 | 3 / 0 / 5 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 223,802 | 188,493 | −9,741 | 4 / 0 / 4 |
| all | 223,802 | 188,493 | −9,741 | 4 / 0 / 4 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd), or computed from the API's usage and a price table when the run went through the Messages API directly. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | $0.0588 | $0.0496 | −$0.0054 | 5 / 0 / 3 |
| all | $0.0588 | $0.0496 | −$0.0054 | 5 / 0 / 3 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 24.0 s | 19.2 s | −3.3 s | 5 / 0 / 3 |
| all | 24.0 s | 19.2 s | −3.3 s | 5 / 0 / 3 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | $0.8634 (16 runs) | $0.8751 (16 runs) | none | none |
| all | $0.8634 (16 runs) | $0.8751 (16 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| sigmap-src/h001 | without | 1/2 | 24 [17–30] | 6,147 [1,175–11,119] | 2,088 [1,630–2,545] | 225,622 [48,341–402,903] | 18,495 [10,069–26,920] | $0.0623 [$0.0367–$0.0878] | 24.4 s [18.1 s–30.7 s] |
| sigmap-src/h001 | with | 2/2 | 16 [12–19] | 2,994 [2,976–3,012] | 1,557 [1,361–1,753] | 166,098 [87,980–244,216] | 22,278 [17,859–26,697] | $0.0552 [$0.0409–$0.0696] | 19.4 s [15.9 s–22.9 s] |
| sigmap-src/h002 | without | 0/2 | 26 [25–26] | 7,155 [5,163–9,146] | 2,241 [2,087–2,395] | 437,277 [419,297–455,257] | 36,822 [35,820–37,824] | $0.1081 [$0.1063–$0.1099] | 29.3 s [28.3 s–30.2 s] |
| sigmap-src/h002 | with | 0/2 | 25 [25–25] | 9,701 [9,696–9,705] | 2,160 [2,109–2,210] | 289,059 [267,554–310,563] | 20,915 [18,004–23,826] | $0.0755 [$0.0695–$0.0816] | 27.3 s [26.3 s–28.2 s] |
| sigmap-src/h003 | without | 1/2 | 4 [0–8] | 1,929 [1,029–2,829] | 487 [146–828] | 11,289 [0–22,578] | 5,715 [0–11,429] | $0.0126 [$0.0018–$0.0235] | 5.6 s [1.7 s–9.5 s] |
| sigmap-src/h003 | with | 2/2 | 6 [1–11] | 3,170 [3,150–3,189] | 1,004 [364–1,643] | 51,663 [0–103,325] | 13,025 [6,812–19,238] | $0.0296 [$0.0135–$0.0458] | 11.2 s [4.8 s–17.6 s] |
| sigmap-src/h004 | without | 2/2 | 25 [24–26] | 8,604 [1,160–16,047] | 2,280 [2,190–2,370] | 253,336 [208,596–298,075] | 22,473 [22,088–22,858] | $0.0734 [$0.0705–$0.0764] | 28.4 s [27.8 s–29.0 s] |
| sigmap-src/h004 | with | 1/2 | 28 [24–31] | 4,224 [2,512–5,936] | 2,516 [2,348–2,683] | 384,848 [369,743–399,953] | 26,636 [22,654–30,617] | $0.0886 [$0.0830–$0.0942] | 30.4 s [28.6 s–32.2 s] |
| sigmap-src/h005 | without | 0/2 | 27 [25–28] | 16,528 [6,343–26,713] | 1,909 [1,677–2,140] | 117,800 [67,484–168,116] | 7,880 [5,505–10,255] | $0.0477 [$0.0467–$0.0487] | 23.6 s [20.6 s–26.6 s] |
| sigmap-src/h005 | with | 0/2 | 16 [4–28] | 2,795 [2,726–2,864] | 1,567 [500–2,633] | 166,383 [8,980–323,785] | 13,315 [9,358–17,271] | $0.0439 [$0.0178–$0.0700] | 19.1 s [5.8 s–32.3 s] |
| sigmap-src/h006 | without | 2/2 | 16 [13–19] | 1,092 [1,071–1,112] | 1,575 [1,298–1,852] | 168,928 [62,501–275,355] | 23,658 [16,026–31,290] | $0.0554 [$0.0338–$0.0770] | 18.5 s [14.1 s–22.8 s] |
| sigmap-src/h006 | with | 2/2 | 4 [3–5] | 3,247 [3,241–3,252] | 477 [361–592] | 10,170 [0–20,340] | 12,350 [11,667–13,032] | $0.0221 [$0.0213–$0.0228] | 5.9 s [5.1 s–6.7 s] |
| sigmap-src/h007 | without | 0/2 | 0 [0–0] | 1,028 [1,028–1,028] | 76 [60–91] | 0 [0–0] | 0 [0–0] | $0.0014 [$0.0013–$0.0015] | 996 ms [868 ms–1.1 s] |
| sigmap-src/h007 | with | 0/2 | 30 [23–37] | 3,196 [3,189–3,202] | 3,371 [2,933–3,808] | 511,268 [408,310–614,225] | 33,983 [33,070–34,895] | $0.1137 [$0.1067–$0.1206] | 41.4 s [36.9 s–45.8 s] |
| sigmap-src/h008 | without | 2/2 | 26 [24–27] | 4,462 [2,407–6,517] | 2,337 [2,299–2,374] | 251,404 [230,723–272,085] | 23,551 [23,067–24,034] | $0.0707 [$0.0662–$0.0753] | 29.0 s [28.8 s–29.2 s] |
| sigmap-src/h008 | with | 2/2 | 2 [2–2] | 2,205 [2,205–2,205] | 231 [221–240] | 0 [0–0] | 4,452 [4,450–4,454] | $0.0089 [$0.0089–$0.0090] | 3.6 s [3.4 s–3.7 s] |

