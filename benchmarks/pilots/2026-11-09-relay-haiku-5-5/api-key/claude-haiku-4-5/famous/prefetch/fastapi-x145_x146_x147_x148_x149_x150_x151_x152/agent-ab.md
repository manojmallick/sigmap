# Agent-level A/B — measured tool calls, tokens and cost

**anthropic-messages-api direct Messages API · claude-haiku-4-5 · 2026-11-11 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap ranked the question BEFORE the first turn (what a prompt hook would inject): the five likeliest files with their signatures and line anchors after the question in the user turn, + the sigmap CLI; no MCP server, no standing section, no extra tool call.
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
| Tool calls | −45% | −52% | fewer in every repetition |
| Input tokens (uncached) | −9% | −72% | fewer in every repetition |
| Output tokens | −35% | −42% | fewer in every repetition |
| Cache-read tokens | −68% | −78% | fewer in every repetition |
| Cache-write tokens | −38% | −50% | fewer in every repetition |
| Total tokens (derived) | −61% | −74% | fewer in every repetition |
| Cost | −41% | −60% | fewer in every repetition |
| Wall time | −34% | −44% | fewer in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −60% [−77%, −32%] | −54% [−68%, −37%] | fewer in every repetition, outside the noise |
| Input tokens (uncached) | −1% [−43%, +65%] † | −61% [−80%, −17%] | fewer in every repetition, within the noise |
| Output tokens | −43% [−57%, −22%] | −42% [−61%, −14%] | fewer in every repetition, outside the noise |
| Cache-read tokens | −71% [−83%, −57%] n=7 | −75% [−88%, −44%] | fewer in every repetition, outside the noise |
| Cache-write tokens | −38% [−43%, −30%] | −49% [−63%, −27%] | fewer in every repetition, outside the noise |
| Total tokens (derived) | −63% [−75%, −50%] | −70% [−84%, −43%] | fewer in every repetition, outside the noise |
| Cost | −42% [−54%, −28%] | −57% [−69%, −36%] | fewer in every repetition, outside the noise |
| Wall time | −39% [−53%, −23%] | −43% [−61%, −16%] | fewer in every repetition, outside the noise |

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
| fastapi | 18 | 8 | −8 | 8 / 0 / 0 |
| all | 18 | 8 | −8 | 8 / 0 / 0 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | 7,035 | 4,479 | −3,641 | 5 / 0 / 3 |
| all | 7,035 | 4,479 | −3,641 | 5 / 0 / 3 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | 1,817 | 964 | −796 | 7 / 0 / 1 |
| all | 1,817 | 964 | −796 | 7 / 0 / 1 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | 147,607 | 28,015 | −104,180 | 8 / 0 / 0 |
| all | 147,607 | 28,015 | −104,180 | 8 / 0 / 0 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | 17,996 | 9,926 | −9,379 | 7 / 0 / 1 |
| all | 17,996 | 9,926 | −9,379 | 7 / 0 / 1 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | 184,174 | 40,666 | −124,925 | 7 / 0 / 1 |
| all | 184,174 | 40,666 | −124,925 | 7 / 0 / 1 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd), or computed from the API's usage and a price table when the run went through the Messages API directly. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | $0.0593 | $0.0230 | −$0.0339 | 7 / 0 / 1 |
| all | $0.0593 | $0.0230 | −$0.0339 | 7 / 0 / 1 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | 22.2 s | 11.9 s | −9.2 s | 8 / 0 / 0 |
| all | 22.2 s | 11.9 s | −9.2 s | 8 / 0 / 0 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| fastapi | $0.8532 (16 runs) | $0.4153 (16 runs) | none | none |
| all | $0.8532 (16 runs) | $0.4153 (16 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| fastapi/x145 | without | 2/2 | 19 [16–22] | 7,531 [7,053–8,009] | 2,088 [2,081–2,094] | 183,088 [140,529–225,646] | 17,959 [16,101–19,816] | $0.0587 [$0.0516–$0.0658] | 25.2 s [24.7 s–25.8 s] |
| fastapi/x145 | with | 2/2 | 4 [4–4] | 1,982 [1,981–1,982] | 582 [526–637] | 18,413 [18,355–18,471] | 11,094 [11,081–11,107] | $0.0206 [$0.0203–$0.0209] | 7.6 s [6.8 s–8.3 s] |
| fastapi/x146 | without | 2/2 | 15 [13–17] | 1,122 [1,107–1,136] | 1,682 [1,431–1,933] | 118,470 [98,464–138,476] | 18,033 [17,880–18,186] | $0.0439 [$0.0408–$0.0470] | 20.6 s [16.9 s–24.4 s] |
| fastapi/x146 | with | 2/2 | 6 [5–6] | 2,776 [2,773–2,779] | 804 [655–952] | 30,534 [23,476–37,591] | 8,444 [6,579–10,308] | $0.0204 [$0.0166–$0.0242] | 11.0 s [9.0 s–12.9 s] |
| fastapi/x147 | without | 2/2 | 19 [15–22] | 18,780 [18,668–18,891] | 1,952 [1,432–2,471] | 121,631 [99,659–143,602] | 17,277 [10,916–23,637] | $0.0623 [$0.0549–$0.0697] | 23.8 s [18.4 s–29.1 s] |
| fastapi/x147 | with | 2/2 | 10 [9–11] | 5,750 [2,287–9,212] | 1,125 [888–1,361] | 25,496 [24,693–26,298] | 6,406 [6,113–6,698] | $0.0219 [$0.0177–$0.0261] | 12.9 s [10.3 s–15.5 s] |
| fastapi/x148 | without | 2/2 | 17 [13–21] | 6,539 [3,493–9,584] | 1,637 [1,223–2,050] | 187,426 [64,283–310,569] | 21,080 [14,714–27,445] | $0.0598 [$0.0344–$0.0852] | 20.2 s [14.4 s–26.1 s] |
| fastapi/x148 | with | 2/2 | 4 [3–4] | 1,887 [1,884–1,889] | 604 [580–628] | 12,461 [11,009–13,912] | 9,616 [7,612–11,619] | $0.0182 [$0.0159–$0.0204] | 7.4 s [6.8 s–7.9 s] |
| fastapi/x149 | without | 2/2 | 7 [5–9] | 2,618 [2,462–2,774] | 778 [546–1,010] | 18,598 [17,726–19,470] | 11,626 [9,943–13,308] | $0.0229 [$0.0199–$0.0259] | 8.9 s [7.2 s–10.5 s] |
| fastapi/x149 | with | 2/2 | 3 [1–4] | 3,679 [3,670–3,688] | 638 [349–926] | 17,788 [0–35,576] | 12,352 [11,638–13,065] | $0.0241 [$0.0200–$0.0282] | 8.6 s [5.3 s–12.0 s] |
| fastapi/x150 | without | 2/2 | 19 [17–20] | 13,382 [10,183–16,581] | 2,341 [2,169–2,512] | 173,583 [105,806–241,359] | 19,404 [12,989–25,819] | $0.0667 [$0.0478–$0.0856] | 27.9 s [25.5 s–30.4 s] |
| fastapi/x150 | with | 2/2 | 13 [13–13] | 6,552 [2,932–10,172] | 1,576 [1,553–1,599] | 61,358 [57,730–64,986] | 10,237 [8,809–11,664] | $0.0334 [$0.0320–$0.0347] | 19.2 s [18.0 s–20.4 s] |
| fastapi/x151 | without | 2/2 | 16 [15–16] | 9,647 [7,017–12,277] | 1,674 [1,593–1,754] | 85,730 [61,638–109,821] | 11,948 [10,983–12,913] | $0.0415 [$0.0401–$0.0429] | 20.1 s [19.0 s–21.3 s] |
| fastapi/x151 | with | 2/2 | 15 [12–18] | 7,018 [2,388–11,647] | 1,719 [1,519–1,919] | 59,584 [54,127–65,041] | 9,008 [8,401–9,615] | $0.0328 [$0.0285–$0.0372] | 19.5 s [17.6 s–21.5 s] |
| fastapi/x152 | without | 2/2 | 21 [20–21] | 3,017 [2,363–3,671] | 2,387 [2,369–2,405] | 262,084 [215,856–308,312] | 23,651 [20,869–26,433] | $0.0707 [$0.0634–$0.0781] | 29.5 s [28.6 s–30.4 s] |
| fastapi/x152 | with | 2/2 | 14 [9–19] | 5,280 [1,805–8,754] | 1,907 [1,386–2,428] | 80,891 [51,729–110,053] | 10,708 [8,357–13,059] | $0.0363 [$0.0244–$0.0482] | 21.8 s [16.2 s–27.5 s] |

