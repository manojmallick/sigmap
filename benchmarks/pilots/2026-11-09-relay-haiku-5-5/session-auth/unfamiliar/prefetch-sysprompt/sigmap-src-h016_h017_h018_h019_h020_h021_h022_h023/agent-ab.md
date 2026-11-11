# Agent-level A/B — measured tool calls, tokens and cost

**claude-code 2.1.322 (Claude Code) · claude-haiku-5-5 · 2026-11-10 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap ranked the question BEFORE the first turn (what a prompt hook would inject): the five likeliest files with their signatures and line anchors in the prompt, + the sigmap CLI; no MCP server, no standing section, no extra tool call.
- Both arms: the same prompt, model, tool allowlist (Read, Grep, Glob, Bash), per-run budget cap $0.6 and timeout 420 s; run in a clean copy of the commit pinned in `benchmarks/xrepo-repos.json`.
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
- Run on the logged-in session (--session-auth), not an API key and not under --bare: the agent carries a prompt prefix about 40k tokens larger in both arms (cached), the cost figures are real Anthropic prices with real caching, and the usage counts against that account's plan.

## Outcome

| repo | tasks | pass without | pass with | failed runs (without / with) |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 8 | 16/16 | 14/16 | 0 / 0 |
| all | 8 | 16/16 | 14/16 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 8. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −58% | −56% | fewer in every repetition |
| Input tokens (uncached) | −52% | −43% | fewer in every repetition |
| Output tokens | −47% | −41% | fewer in every repetition |
| Cache-read tokens | −65% | −41% | fewer in every repetition |
| Cache-write tokens | −29% | −42% | fewer in every repetition |
| Total tokens (derived) | −59% | −41% | fewer in every repetition |
| Cost | −39% | −42% | fewer in every repetition |
| Wall time | −39% | −32% | fewer in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −61% [−74%, −42%] | −47% [−59%, −30%] n=7 | fewer in every repetition, outside the noise |
| Input tokens (uncached) | −53% [−64%, −37%] | −47% [−65%, −24%] | fewer in every repetition, outside the noise |
| Output tokens | −46% [−60%, −28%] | −40% [−55%, −16%] | fewer in every repetition, outside the noise |
| Cache-read tokens | −65% [−78%, −44%] | −47% [−69%, −14%] | fewer in every repetition, outside the noise |
| Cache-write tokens | −22% [−43%, +15%] † | −42% [−66%, −16%] | fewer in every repetition, within the noise |
| Total tokens (derived) | −58% [−72%, −34%] | −46% [−68%, −15%] | fewer in every repetition, outside the noise |
| Cost | −34% [−51%, −6%] | −43% [−63%, −17%] | fewer in every repetition, outside the noise |
| Wall time | −37% [−47%, −25%] | −32% [−46%, −13%] | fewer in every repetition, outside the noise |

### Outcome (hit@5), by repetition

Per paired task: **better** = the SigMap arm named the file and the other did not; **worse** = the reverse; **tie** = both found it or both missed. Localisation only.

| repetition | paired tasks | better | worse | tie |
| --- | ---: | ---: | ---: | ---: |
| R1 | 8 | 0 | 1 | 7 |
| R2 | 8 | 0 | 1 | 7 |
| all | 16 | 0 | 2 | 14 |

## Tool calls

Provenance: agent-reported (main-thread tool_use blocks). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 8 | 3 | −5 | 7 / 1 / 0 |
| all | 8 | 3 | −5 | 7 / 1 / 0 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 12 | 6 | −6 | 7 / 1 / 0 |
| all | 12 | 6 | −6 | 7 / 1 / 0 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 2,068 | 1,116 | −952 | 7 / 0 / 1 |
| all | 2,068 | 1,116 | −952 | 7 / 0 / 1 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 74,635 | 34,226 | −50,358 | 7 / 0 / 1 |
| all | 74,635 | 34,226 | −50,358 | 7 / 0 / 1 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 13,911 | 9,565 | −3,547 | 7 / 0 / 1 |
| all | 13,911 | 9,565 | −3,547 | 7 / 0 / 1 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 97,979 | 45,065 | −55,210 | 7 / 0 / 1 |
| all | 97,979 | 45,065 | −55,210 | 7 / 0 / 1 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | $0.0048 | $0.0028 | −$0.0019 | 7 / 0 / 1 |
| all | $0.0048 | $0.0028 | −$0.0019 | 7 / 0 / 1 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 17.7 s | 11.1 s | −6.6 s | 7 / 0 / 1 |
| all | 17.7 s | 11.1 s | −6.6 s | 7 / 0 / 1 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | $0.0791 (16 runs) | $0.0473 (16 runs) | none | none |
| all | $0.0791 (16 runs) | $0.0473 (16 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| sigmap-src/h016 | without | 2/2 | 4 [3–4] | 8 [8–8] | 1,540 [1,531–1,548] | 43,438 [43,406–43,469] | 10,454 [9,412–11,496] | $0.0033 [$0.0031–$0.0035] | 13.7 s [13.3 s–14.1 s] |
| sigmap-src/h016 | with | 2/2 | 2 [1–2] | 4 [4–4] | 785 [648–921] | 19,842 [17,266–22,418] | 8,463 [5,813–11,112] | $0.0023 [$0.0017–$0.0029] | 9.3 s [8.4 s–10.2 s] |
| sigmap-src/h017 | without | 2/2 | 8 [7–8] | 11 [10–12] | 2,036 [1,794–2,277] | 63,923 [58,511–69,334] | 12,097 [9,783–14,410] | $0.0041 [$0.0038–$0.0044] | 16.8 s [15.4 s–18.2 s] |
| sigmap-src/h017 | with | 2/2 | 3 [1–4] | 5 [4–6] | 1,098 [1,009–1,187] | 26,091 [16,640–35,541] | 8,496 [7,121–9,870] | $0.0025 [$0.0024–$0.0026] | 10.9 s [10.8 s–11.1 s] |
| sigmap-src/h018 | without | 2/2 | 9 [9–9] | 12 [12–12] | 2,100 [2,031–2,169] | 85,347 [83,038–87,655] | 30,433 [26,050–34,816] | $0.0080 [$0.0071–$0.0089] | 18.6 s [18.3 s–18.8 s] |
| sigmap-src/h018 | with | 2/2 | 2 [0–3] | 3 [2–4] | 882 [814–950] | 13,622 [9,854–17,389] | 9,108 [2,964–15,251] | $0.0024 [$0.0011–$0.0037] | 8.6 s [8.0 s–9.2 s] |
| sigmap-src/h019 | without | 2/2 | 5 [5–5] | 9 [8–10] | 1,435 [1,430–1,439] | 51,458 [44,481–58,435] | 12,067 [11,815–12,318] | $0.0036 [$0.0036–$0.0037] | 14.6 s [13.9 s–15.2 s] |
| sigmap-src/h019 | with | 2/2 | 4 [3–4] | 7 [6–8] | 1,213 [1,038–1,387] | 43,200 [30,845–55,555] | 10,022 [8,904–11,140] | $0.0030 [$0.0030–$0.0031] | 12.2 s [10.6 s–13.8 s] |
| sigmap-src/h020 | without | 2/2 | 9 [7–10] | 13 [10–16] | 2,102 [1,695–2,508] | 114,051 [58,879–169,223] | 19,688 [11,628–27,747] | $0.0061 [$0.0038–$0.0085] | 18.6 s [15.0 s–22.2 s] |
| sigmap-src/h020 | with | 2/2 | 4 [3–4] | 7 [6–8] | 1,135 [1,061–1,208] | 44,086 [38,057–50,115] | 10,841 [8,054–13,627] | $0.0032 [$0.0025–$0.0038] | 11.3 s [10.5 s–12.1 s] |
| sigmap-src/h021 | without | 2/2 | 11 [10–12] | 19 [16–22] | 3,409 [2,756–4,061] | 151,466 [122,453–180,479] | 16,889 [15,359–18,418] | $0.0066 [$0.0057–$0.0075] | 27.2 s [21.8 s–32.6 s] |
| sigmap-src/h021 | with | 2/2 | 6 [5–6] | 12 [12–12] | 1,748 [1,567–1,929] | 88,582 [80,202–96,962] | 13,397 [13,150–13,643] | $0.0044 [$0.0044–$0.0045] | 18.4 s [17.7 s–19.1 s] |
| sigmap-src/h022 | without | 2/2 | 4 [3–5] | 7 [6–8] | 1,050 [819–1,280] | 33,996 [27,934–40,058] | 7,018 [6,569–7,466] | $0.0023 [$0.0022–$0.0024] | 11.2 s [9.3 s–13.1 s] |
| sigmap-src/h022 | with | 2/2 | 4 [3–5] | 7 [6–8] | 1,370 [1,256–1,484] | 42,362 [33,817–50,906] | 12,707 [9,282–16,132] | $0.0037 [$0.0028–$0.0045] | 12.1 s [11.9 s–12.4 s] |
| sigmap-src/h023 | without | 2/2 | 8 [5–10] | 15 [12–18] | 2,434 [2,265–2,602] | 118,140 [77,656–158,623] | 15,725 [13,556–17,894] | $0.0055 [$0.0046–$0.0065] | 21.6 s [19.3 s–23.9 s] |
| sigmap-src/h023 | with | 0/2 | 2 [2–2] | 4 [4–4] | 702 [636–767] | 18,574 [16,410–20,738] | 8,121 [5,967–10,275] | $0.0022 [$0.0018–$0.0025] | 9.0 s [8.1 s–9.8 s] |

