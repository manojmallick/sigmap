# Agent-level A/B — measured tool calls, tokens and cost

**claude-code 2.1.322 (Claude Code) · claude-haiku-5-5 · 2026-11-11 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap ranked the question BEFORE the first turn (what a prompt hook would inject): the five likeliest files with their signatures and line anchors after the question in the user turn, + the sigmap CLI; no MCP server, no standing section, no extra tool call.
- Both arms: the same prompt, model, tool allowlist (Read, Grep, Glob, Bash), per-run budget cap $0.5 and timeout 420 s; run in a clean copy of the commit pinned in `benchmarks/xrepo-repos.json`.
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
| sigmap-src | 8 | 16/16 | 13/16 | 0 / 0 |
| all | 8 | 16/16 | 13/16 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 8. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −57% | −68% | fewer in every repetition |
| Input tokens (uncached) | −39% | −50% | fewer in every repetition |
| Output tokens | −32% | −50% | fewer in every repetition |
| Cache-read tokens | −43% | −52% | fewer in every repetition |
| Cache-write tokens | −8% | −58% | fewer in every repetition |
| Total tokens (derived) | −38% | −53% | fewer in every repetition |
| Cost | −20% | −55% | fewer in every repetition |
| Wall time | −24% | −38% | fewer in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −60% [−77%, −25%] n=7 | −63% [−79%, −39%] n=7 | fewer in every repetition, outside the noise |
| Input tokens (uncached) | −45% [−60%, −20%] | −53% [−68%, −31%] | fewer in every repetition, outside the noise |
| Output tokens | −31% [−50%, −3%] | −49% [−63%, −27%] | fewer in every repetition, outside the noise |
| Cache-read tokens | −52% [−69%, −19%] | −54% [−72%, −24%] | fewer in every repetition, outside the noise |
| Cache-write tokens | −7% [−19%, +11%] † | −55% [−71%, −36%] | fewer in every repetition, within the noise |
| Total tokens (derived) | −42% [−60%, −12%] | −54% [−71%, −27%] | fewer in every repetition, outside the noise |
| Cost | −19% [−34%, +3%] † | −54% [−68%, −35%] | fewer in every repetition, within the noise |
| Wall time | −25% [−41%, −4%] | −37% [−49%, −21%] | fewer in every repetition, outside the noise |

### Outcome (hit@5), by repetition

Per paired task: **better** = the SigMap arm named the file and the other did not; **worse** = the reverse; **tie** = both found it or both missed. Localisation only.

| repetition | paired tasks | better | worse | tie |
| --- | ---: | ---: | ---: | ---: |
| R1 | 8 | 0 | 1 | 7 |
| R2 | 8 | 0 | 2 | 6 |
| all | 16 | 0 | 3 | 13 |

## Tool calls

Provenance: agent-reported (main-thread tool_use blocks). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 7 | 2 | −5 | 7 / 0 / 1 |
| all | 7 | 2 | −5 | 7 / 0 / 1 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 10 | 4 | −6 | 6 / 1 / 1 |
| all | 10 | 4 | −6 | 6 / 1 / 1 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 1,898 | 961 | −995 | 6 / 0 / 2 |
| all | 1,898 | 961 | −995 | 6 / 0 / 2 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 54,905 | 20,056 | −37,486 | 6 / 0 / 2 |
| all | 54,905 | 20,056 | −37,486 | 6 / 0 / 2 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 10,584 | 7,726 | −3,319 | 7 / 0 / 1 |
| all | 10,584 | 7,726 | −3,319 | 7 / 0 / 1 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 70,554 | 28,176 | −46,348 | 6 / 0 / 2 |
| all | 70,554 | 28,176 | −46,348 | 6 / 0 / 2 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | $0.0037 | $0.0022 | −$0.0018 | 6 / 0 / 2 |
| all | $0.0037 | $0.0022 | −$0.0018 | 6 / 0 / 2 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 14.6 s | 9.1 s | −5.8 s | 6 / 0 / 2 |
| all | 14.6 s | 9.1 s | −5.8 s | 6 / 0 / 2 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | $0.0633 (16 runs) | $0.0382 (16 runs) | none | none |
| all | $0.0633 (16 runs) | $0.0382 (16 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| sigmap-src/h016 | without | 2/2 | 3 [3–3] | 6 [6–6] | 1,405 [1,372–1,437] | 27,540 [27,499–27,581] | 7,156 [5,957–8,354] | $0.0024 [$0.0022–$0.0027] | 11.8 s [11.6 s–12.1 s] |
| sigmap-src/h016 | with | 2/2 | 1 [0–2] | 3 [2–4] | 908 [645–1,170] | 14,331 [6,281–22,380] | 6,398 [6,379–6,417] | $0.0019 [$0.0018–$0.0019] | 8.3 s [7.1 s–9.4 s] |
| sigmap-src/h017 | without | 2/2 | 9 [5–12] | 12 [10–14] | 2,271 [1,427–3,115] | 75,672 [57,950–93,393] | 11,349 [10,752–11,945] | $0.0042 [$0.0034–$0.0049] | 16.2 s [12.3 s–20.1 s] |
| sigmap-src/h017 | with | 2/2 | 2 [1–2] | 4 [4–4] | 1,005 [929–1,080] | 19,730 [18,321–21,138] | 7,127 [6,506–7,747] | $0.0021 [$0.0021–$0.0022] | 9.4 s [8.7 s–10.0 s] |
| sigmap-src/h018 | without | 2/2 | 7 [6–8] | 8 [8–8] | 1,737 [1,617–1,857] | 45,374 [45,131–45,616] | 19,570 [11,701–27,439] | $0.0052 [$0.0037–$0.0067] | 13.0 s [12.9 s–13.1 s] |
| sigmap-src/h018 | with | 2/2 | 1 [0–2] | 3 [2–4] | 917 [784–1,049] | 14,455 [9,845–19,064] | 6,308 [2,944–9,671] | $0.0019 [$0.0011–$0.0026] | 8.2 s [7.2 s–9.2 s] |
| sigmap-src/h019 | without | 2/2 | 4 [4–4] | 8 [8–8] | 1,285 [1,114–1,456] | 44,174 [43,816–44,531] | 9,820 [9,577–10,062] | $0.0030 [$0.0030–$0.0031] | 12.2 s [11.2 s–13.3 s] |
| sigmap-src/h019 | with | 2/2 | 5 [3–6] | 10 [8–12] | 1,532 [1,256–1,807] | 66,239 [51,705–80,772] | 8,687 [6,660–10,713] | $0.0032 [$0.0025–$0.0039] | 14.6 s [11.8 s–17.5 s] |
| sigmap-src/h020 | without | 2/2 | 9 [8–10] | 12 [10–14] | 2,060 [2,036–2,083] | 64,436 [54,788–74,083] | 7,912 [7,646–8,178] | $0.0033 [$0.0032–$0.0033] | 16.5 s [15.1 s–17.9 s] |
| sigmap-src/h020 | with | 1/2 | 1 [1–1] | 4 [4–4] | 848 [809–887] | 20,382 [18,754–22,010] | 5,497 [3,765–7,228] | $0.0017 [$0.0014–$0.0021] | 8.8 s [8.4 s–9.1 s] |
| sigmap-src/h021 | without | 2/2 | 10 [8–11] | 19 [16–22] | 2,888 [2,663–3,113] | 142,680 [122,916–162,443] | 17,747 [14,461–21,033] | $0.0064 [$0.0055–$0.0074] | 23.3 s [21.4 s–25.3 s] |
| sigmap-src/h021 | with | 2/2 | 5 [4–6] | 12 [10–14] | 1,718 [1,546–1,890] | 79,663 [68,204–91,122] | 9,660 [6,958–12,361] | $0.0036 [$0.0032–$0.0039] | 16.5 s [14.8 s–18.2 s] |
| sigmap-src/h022 | without | 2/2 | 3 [3–3] | 6 [6–6] | 865 [826–903] | 27,850 [27,773–27,927] | 7,394 [7,321–7,467] | $0.0022 [$0.0022–$0.0022] | 9.5 s [8.8 s–10.1 s] |
| sigmap-src/h022 | with | 2/2 | 3 [2–3] | 6 [6–6] | 1,097 [808–1,386] | 33,200 [32,913–33,486] | 8,325 [5,595–11,055] | $0.0025 [$0.0019–$0.0032] | 10.2 s [8.5 s–11.9 s] |
| sigmap-src/h023 | without | 2/2 | 7 [6–7] | 13 [12–14] | 2,368 [2,354–2,382] | 87,764 [79,613–95,915] | 14,377 [14,298–14,455] | $0.0049 [$0.0048–$0.0050] | 19.6 s [19.6 s–19.6 s] |
| sigmap-src/h023 | with | 0/2 | 2 [2–2] | 4 [4–4] | 671 [538–804] | 19,407 [18,107–20,706] | 8,406 [6,358–10,453] | $0.0022 [$0.0017–$0.0027] | 7.9 s [7.6 s–8.1 s] |

