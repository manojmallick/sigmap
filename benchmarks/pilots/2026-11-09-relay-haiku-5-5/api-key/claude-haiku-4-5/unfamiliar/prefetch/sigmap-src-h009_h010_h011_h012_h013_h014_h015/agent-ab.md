# Agent-level A/B — measured tool calls, tokens and cost

**anthropic-messages-api direct Messages API · claude-haiku-4-5 · 2026-11-11 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap ranked the question BEFORE the first turn (what a prompt hook would inject): the five likeliest files with their signatures and line anchors after the question in the user turn, + the sigmap CLI; no MCP server, no standing section, no extra tool call.
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
| sigmap-src | 7 | 11/14 | 13/14 | 0 / 0 |
| all | 7 | 11/14 | 13/14 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 7. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −50% | −42% | fewer in every repetition |
| Input tokens (uncached) | −27% | +2% | mixed |
| Output tokens | −46% | −36% | fewer in every repetition |
| Cache-read tokens | −63% | −46% | fewer in every repetition |
| Cache-write tokens | −36% | −32% | fewer in every repetition |
| Total tokens (derived) | −60% | −44% | fewer in every repetition |
| Cost | −45% | −35% | fewer in every repetition |
| Wall time | −44% | −35% | fewer in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −62% [−78%, −36%] | −53% [−78%, +19%] † | fewer in every repetition, within the noise |
| Input tokens (uncached) | −7% [−46%, +64%] † | +17% [−27%, +85%] † | mixed |
| Output tokens | −54% [−71%, −29%] | −45% [−73%, +26%] † | fewer in every repetition, within the noise |
| Cache-read tokens | −68% [−84%, −32%] n=5 | −19% [−86%, +456%] † n=5 | fewer in every repetition, within the noise |
| Cache-write tokens | −41% [−53%, −25%] | −44% [−75%, +9%] † | fewer in every repetition, within the noise |
| Total tokens (derived) | −69% [−85%, −41%] | −56% [−85%, +48%] † | fewer in every repetition, within the noise |
| Cost | −50% [−63%, −33%] | −43% [−72%, +14%] † | fewer in every repetition, within the noise |
| Wall time | −49% [−65%, −28%] | −43% [−70%, +22%] † | fewer in every repetition, within the noise |

### Outcome (hit@5), by repetition

Per paired task: **better** = the SigMap arm named the file and the other did not; **worse** = the reverse; **tie** = both found it or both missed. Localisation only.

| repetition | paired tasks | better | worse | tie |
| --- | ---: | ---: | ---: | ---: |
| R1 | 7 | 2 | 0 | 5 |
| R2 | 7 | 0 | 0 | 7 |
| all | 14 | 2 | 0 | 12 |

## Tool calls

Provenance: agent-reported (main-thread tool_use blocks). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 18 | 9 | −7 | 5 / 0 / 2 |
| all | 18 | 9 | −7 | 5 / 0 / 2 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 2,724 | 3,064 | +119 | 3 / 0 / 4 |
| all | 2,724 | 3,064 | +119 | 3 / 0 / 4 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 1,723 | 944 | −550 | 5 / 0 / 2 |
| all | 1,723 | 944 | −550 | 5 / 0 / 2 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 176,404 | 66,510 | −22,027 | 5 / 0 / 2 |
| all | 176,404 | 66,510 | −22,027 | 5 / 0 / 2 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 20,639 | 16,837 | −5,214 | 6 / 0 / 1 |
| all | 20,639 | 16,837 | −5,214 | 6 / 0 / 1 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 200,751 | 88,077 | −27,681 | 5 / 0 / 2 |
| all | 200,751 | 88,077 | −27,681 | 5 / 0 / 2 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd), or computed from the API's usage and a price table when the run went through the Messages API directly. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | $0.0546 | $0.0364 | −$0.0140 | 4 / 0 / 3 |
| all | $0.0546 | $0.0364 | −$0.0140 | 4 / 0 / 3 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 21.5 s | 12.1 s | −6.9 s | 5 / 0 / 2 |
| all | 21.5 s | 12.1 s | −6.9 s | 5 / 0 / 2 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | $0.8341 (14 runs) | $0.4991 (14 runs) | none | none |
| all | $0.8341 (14 runs) | $0.4991 (14 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| sigmap-src/h009 | without | 2/2 | 9 [7–10] | 6,019 [5,693–6,345] | 695 [528–862] | 18,572 [0–37,144] | 12,406 [8,465–16,346] | $0.0269 [$0.0189–$0.0348] | 8.3 s [6.3 s–10.3 s] |
| sigmap-src/h009 | with | 2/2 | 2 [2–2] | 2,557 [2,557–2,557] | 262 [233–291] | 0 [0–0] | 7,192 [5,790–8,594] | $0.0129 [$0.0110–$0.0148] | 3.7 s [3.4 s–4.0 s] |
| sigmap-src/h010 | without | 1/2 | 25 [21–28] | 1,740 [1,141–2,339] | 2,454 [2,294–2,614] | 523,769 [430,018–617,520] | 36,545 [28,863–44,227] | $0.1121 [$0.0945–$0.1296] | 30.3 s [28.8 s–31.8 s] |
| sigmap-src/h010 | with | 2/2 | 9 [6–12] | 3,125 [3,117–3,133] | 944 [755–1,132] | 66,510 [48,941–84,079] | 17,498 [15,364–19,632] | $0.0364 [$0.0310–$0.0417] | 12.1 s [10.3 s–14.0 s] |
| sigmap-src/h011 | without | 2/2 | 14 [13–14] | 4,461 [4,057–4,864] | 1,313 [1,267–1,358] | 76,728 [49,571–103,884] | 20,615 [17,591–23,639] | $0.0445 [$0.0386–$0.0503] | 15.4 s [15.1 s–15.8 s] |
| sigmap-src/h011 | with | 2/2 | 2 [2–2] | 3,110 [3,107–3,112] | 285 [222–348] | 2,869 [0–5,737] | 10,219 [7,563–12,874] | $0.0176 [$0.0149–$0.0203] | 4.4 s [3.2 s–5.5 s] |
| sigmap-src/h012 | without | 2/2 | 18 [14–21] | 1,118 [1,108–1,128] | 1,750 [1,521–1,978] | 249,243 [210,683–287,803] | 26,246 [25,144–27,347] | $0.0676 [$0.0612–$0.0740] | 21.5 s [19.2 s–23.8 s] |
| sigmap-src/h012 | with | 2/2 | 3 [2–4] | 2,519 [2,513–2,525] | 357 [249–465] | 14,437 [0–28,874] | 5,637 [1,981–9,292] | $0.0128 [$0.0102–$0.0154] | 5.0 s [3.8 s–6.1 s] |
| sigmap-src/h013 | without | 0/2 | 20 [17–23] | 7,468 [6,795–8,140] | 1,723 [1,718–1,727] | 230,342 [163,708–296,975] | 26,450 [20,490–32,409] | $0.0722 [$0.0574–$0.0870] | 22.6 s [21.2 s–24.0 s] |
| sigmap-src/h013 | with | 1/2 | 22 [17–26] | 5,826 [2,616–9,035] | 1,942 [1,546–2,337] | 292,162 [247,660–336,663] | 23,635 [20,029–27,241] | $0.0743 [$0.0692–$0.0794] | 24.2 s [19.3 s–29.2 s] |
| sigmap-src/h014 | without | 2/2 | 7 [3–11] | 2,724 [1,096–4,352] | 799 [363–1,234] | 91,054 [6,554–175,553] | 18,746 [15,466–22,026] | $0.0393 [$0.0262–$0.0524] | 10.6 s [4.9 s–16.3 s] |
| sigmap-src/h014 | with | 2/2 | 10 [6–14] | 3,064 [3,049–3,079] | 1,153 [796–1,510] | 97,777 [33,269–162,284] | 16,837 [10,297–23,376] | $0.0397 [$0.0232–$0.0561] | 13.9 s [10.3 s–17.5 s] |
| sigmap-src/h015 | without | 2/2 | 20 [16–24] | 1,842 [1,151–2,533] | 1,867 [1,362–2,372] | 176,404 [93,652–259,155] | 20,639 [19,455–21,822] | $0.0546 [$0.0460–$0.0632] | 23.3 s [16.1 s–30.6 s] |
| sigmap-src/h015 | with | 2/2 | 13 [13–13] | 1,961 [1,955–1,967] | 1,318 [1,301–1,334] | 154,377 [90,548–218,206] | 25,606 [19,517–31,694] | $0.0560 [$0.0419–$0.0701] | 16.5 s [15.9 s–17.1 s] |

