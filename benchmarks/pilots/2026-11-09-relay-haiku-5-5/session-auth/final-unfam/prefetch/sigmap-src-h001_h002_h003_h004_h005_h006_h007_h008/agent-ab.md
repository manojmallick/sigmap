# Agent-level A/B — measured tool calls, tokens and cost

**claude-code 2.1.322 (Claude Code) · claude-haiku-5-5 · 2026-11-11 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap ranked the question BEFORE the first turn (what a prompt hook would inject): the five likeliest files with their signatures and line anchors after the question in the user turn, + the sigmap CLI; no MCP server, no standing section, no extra tool call.
- Both arms: the same prompt, model, tool allowlist (Read, Grep, Glob, Bash), per-run budget cap $0.5 and timeout 420 s; run in a clean copy of the commit pinned in `benchmarks/xrepo-repos.json`.
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
- Run on the logged-in session (--session-auth), not an API key and not under --bare: the agent carries a prompt prefix about 40k tokens larger in both arms (cached), the cost figures are real Anthropic prices with real caching, and the usage counts against that account's plan.

## Outcome

| repo | tasks | pass without | pass with | failed runs (without / with) |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 8 | 11/16 | 12/16 | 0 / 0 |
| all | 8 | 11/16 | 12/16 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 8. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −73% | −58% | fewer in every repetition |
| Input tokens (uncached) | −55% | −50% | fewer in every repetition |
| Output tokens | −44% | −47% | fewer in every repetition |
| Cache-read tokens | −67% | −54% | fewer in every repetition |
| Cache-write tokens | −37% | −56% | fewer in every repetition |
| Total tokens (derived) | −62% | −54% | fewer in every repetition |
| Cost | −43% | −53% | fewer in every repetition |
| Wall time | −38% | −39% | fewer in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −67% [−79%, −47%] n=5 | −51% [−71%, −25%] n=6 | fewer in every repetition, outside the noise |
| Input tokens (uncached) | −58% [−64%, −49%] | −55% [−70%, −31%] | fewer in every repetition, outside the noise |
| Output tokens | −33% [−51%, −12%] | −46% [−65%, −20%] | fewer in every repetition, outside the noise |
| Cache-read tokens | −69% [−75%, −59%] | −57% [−76%, −26%] | fewer in every repetition, outside the noise |
| Cache-write tokens | −30% [−48%, −5%] | −55% [−66%, −41%] | fewer in every repetition, outside the noise |
| Total tokens (derived) | −60% [−66%, −51%] | −56% [−74%, −28%] | fewer in every repetition, outside the noise |
| Cost | −36% [−51%, −16%] | −52% [−65%, −35%] | fewer in every repetition, outside the noise |
| Wall time | −34% [−44%, −24%] | −38% [−54%, −20%] | fewer in every repetition, outside the noise |

### Outcome (hit@5), by repetition

Per paired task: **better** = the SigMap arm named the file and the other did not; **worse** = the reverse; **tie** = both found it or both missed. Localisation only.

| repetition | paired tasks | better | worse | tie |
| --- | ---: | ---: | ---: | ---: |
| R1 | 8 | 1 | 1 | 6 |
| R2 | 8 | 1 | 0 | 7 |
| all | 16 | 2 | 1 | 13 |

## Tool calls

Provenance: agent-reported (main-thread tool_use blocks). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 5 | 2 | −3 | 8 / 0 / 0 |
| all | 5 | 2 | −3 | 8 / 0 / 0 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 8 | 4 | −5 | 8 / 0 / 0 |
| all | 8 | 4 | −5 | 8 / 0 / 0 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 1,542 | 865 | −507 | 7 / 0 / 1 |
| all | 1,542 | 865 | −507 | 7 / 0 / 1 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 42,408 | 19,730 | −27,133 | 8 / 0 / 0 |
| all | 42,408 | 19,730 | −27,133 | 8 / 0 / 0 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 12,198 | 6,203 | −5,987 | 8 / 0 / 0 |
| all | 12,198 | 6,203 | −5,987 | 8 / 0 / 0 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 55,321 | 26,774 | −30,980 | 8 / 0 / 0 |
| all | 55,321 | 26,774 | −30,980 | 8 / 0 / 0 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | $0.0036 | $0.0018 | −$0.0017 | 8 / 0 / 0 |
| all | $0.0036 | $0.0018 | −$0.0017 | 8 / 0 / 0 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 12.8 s | 8.6 s | −3.3 s | 8 / 0 / 0 |
| all | 12.8 s | 8.6 s | −3.3 s | 8 / 0 / 0 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | $0.0630 (16 runs) | $0.0325 (16 runs) | none | none |
| all | $0.0630 (16 runs) | $0.0325 (16 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| sigmap-src/h001 | without | 2/2 | 4 [3–5] | 8 [8–8] | 1,078 [982–1,174] | 40,363 [39,889–40,836] | 8,949 [7,929–9,968] | $0.0027 [$0.0025–$0.0030] | 11.8 s [11.7 s–11.9 s] |
| sigmap-src/h001 | with | 2/2 | 4 [2–5] | 6 [4–8] | 1,313 [989–1,637] | 34,030 [18,615–49,445] | 8,345 [6,936–9,754] | $0.0027 [$0.0026–$0.0027] | 11.0 s [8.9 s–13.1 s] |
| sigmap-src/h002 | without | 1/2 | 12 [7–16] | 18 [14–22] | 4,757 [3,509–6,005] | 145,990 [82,989–208,991] | 20,366 [16,756–23,975] | $0.0079 [$0.0059–$0.0099] | 31.1 s [24.0 s–38.3 s] |
| sigmap-src/h002 | with | 0/2 | 5 [4–5] | 11 [10–12] | 1,921 [1,917–1,925] | 67,836 [58,897–76,774] | 6,881 [5,407–8,355] | $0.0030 [$0.0028–$0.0032] | 16.3 s [16.3 s–16.4 s] |
| sigmap-src/h003 | without | 0/2 | 3 [2–3] | 6 [6–6] | 844 [815–872] | 27,124 [27,091–27,156] | 5,463 [5,350–5,576] | $0.0018 [$0.0017–$0.0018] | 10.0 s [9.6 s–10.3 s] |
| sigmap-src/h003 | with | 2/2 | 1 [0–1] | 3 [2–4] | 725 [534–916] | 14,311 [6,281–22,340] | 5,353 [4,357–6,349] | $0.0016 [$0.0014–$0.0018] | 7.5 s [6.6 s–8.3 s] |
| sigmap-src/h004 | without | 2/2 | 6 [5–6] | 8 [8–8] | 1,785 [1,724–1,846] | 44,453 [42,621–46,285] | 13,999 [13,937–14,061] | $0.0041 [$0.0041–$0.0042] | 13.7 s [13.4 s–14.0 s] |
| sigmap-src/h004 | with | 2/2 | 4 [3–4] | 6 [6–6] | 1,251 [1,160–1,341] | 31,293 [29,978–32,608] | 8,053 [7,593–8,512] | $0.0025 [$0.0025–$0.0026] | 10.8 s [10.7 s–10.9 s] |
| sigmap-src/h005 | without | 2/2 | 3 [2–4] | 7 [6–8] | 1,298 [1,190–1,406] | 37,470 [28,111–46,828] | 10,397 [9,363–11,431] | $0.0031 [$0.0027–$0.0035] | 12.0 s [11.3 s–12.6 s] |
| sigmap-src/h005 | with | 2/2 | 0 [0–0] | 2 [2–2] | 818 [706–930] | 7,718 [6,281–9,154] | 4,371 [2,938–5,803] | $0.0014 [$0.0010–$0.0017] | 8.4 s [8.0 s–8.7 s] |
| sigmap-src/h006 | without | 2/2 | 7 [5–8] | 11 [10–12] | 1,938 [1,631–2,244] | 70,859 [62,705–79,013] | 14,425 [13,941–14,909] | $0.0046 [$0.0042–$0.0049] | 15.5 s [13.9 s–17.0 s] |
| sigmap-src/h006 | with | 2/2 | 2 [1–3] | 4 [4–4] | 780 [734–826] | 20,745 [18,999–22,490] | 7,190 [6,141–8,239] | $0.0020 [$0.0018–$0.0023] | 7.7 s [7.7 s–7.7 s] |
| sigmap-src/h007 | without | 0/2 | 3 [2–3] | 7 [6–8] | 1,067 [809–1,325] | 32,424 [27,117–37,731] | 5,592 [5,382–5,801] | $0.0020 [$0.0018–$0.0022] | 11.5 s [9.5 s–13.4 s] |
| sigmap-src/h007 | with | 0/2 | 0 [0–0] | 2 [2–2] | 912 [814–1,010] | 7,911 [6,281–9,540] | 4,569 [2,936–6,201] | $0.0014 [$0.0012–$0.0017] | 8.7 s [7.8 s–9.7 s] |
| sigmap-src/h008 | without | 2/2 | 9 [5–13] | 15 [10–20] | 2,499 [1,440–3,557] | 114,993 [58,054–171,932] | 14,398 [11,851–16,945] | $0.0053 [$0.0037–$0.0069] | 19.6 s [12.4 s–26.9 s] |
| sigmap-src/h008 | with | 2/2 | 2 [1–2] | 4 [4–4] | 585 [569–600] | 18,716 [17,640–19,792] | 5,525 [4,910–6,139] | $0.0016 [$0.0015–$0.0017] | 6.9 s [6.8 s–7.0 s] |

