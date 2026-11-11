# Agent-level A/B — measured tool calls, tokens and cost

**anthropic-messages-api direct Messages API · claude-haiku-5-5 · 2026-11-11 · 4 runs per arm · publishable**

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
| sigmap-src | 8 | 24/32 | 24/32 | 0 / 0 |
| all | 8 | 24/32 | 24/32 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2, R3, R4) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 8. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | R3 | R4 | verdict |
| --- | ---: | ---: | ---: | ---: | ---: |
| Tool calls | −69% | −75% | −74% | −88% | fewer in every repetition |
| Input tokens (uncached) | +1305% | +1301% | +1294% | +1282% | more in every repetition |
| Output tokens | −29% | −29% | −27% | −45% | fewer in every repetition |
| Cache-read tokens | −82% | −81% | −85% | −95% | fewer in every repetition |
| Cache-write tokens | −58% | −65% | −71% | −60% | fewer in every repetition |
| Total tokens (derived) | −61% | −65% | −72% | −79% | fewer in every repetition |
| Cost | −35% | −42% | −49% | −46% | fewer in every repetition |
| Wall time | −28% | −33% | −34% | −47% | fewer in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | R3 | R4 | verdict |
| --- | ---: | ---: | ---: | ---: | ---: |
| Tool calls | −48% [−78%, +22%] † n=4 | −61% [−75%, −42%] n=4 | −57% [−70%, −41%] n=4 | −81% [−87%, −73%] n=4 | fewer in every repetition, within the noise |
| Input tokens (uncached) | +1280% [+1077%, +1480%] | +1276% [+1078%, +1469%] | +1269% [+1062%, +1470%] | +1257% [+1056%, +1455%] | more in every repetition, outside the noise |
| Output tokens | −22% [−43%, +12%] † | −29% [−54%, +6%] † | −23% [−43%, +2%] † | −39% [−61%, −1%] | fewer in every repetition, within the noise |
| Cache-read tokens | −81% [−92%, −51%] | −81% [−91%, −56%] | −88% [−96%, −66%] | −92% [−96%, −80%] | fewer in every repetition, outside the noise |
| Cache-write tokens | −36% [−64%, +24%] † n=4 | −51% [−72%, −16%] n=4 | −51% [−69%, −26%] n=4 | −52% [−75%, −24%] n=4 | fewer in every repetition, within the noise |
| Total tokens (derived) | −54% [−78%, +3%] † | −59% [−80%, −12%] | −68% [−86%, −21%] | −70% [−85%, −30%] | fewer in every repetition, within the noise |
| Cost | −29% [−60%, +33%] † | −38% [−64%, +14%] † | −44% [−67%, +3%] † | −40% [−65%, +13%] † | fewer in every repetition, within the noise |
| Wall time | −22% [−42%, +8%] † | −35% [−55%, −9%] | −32% [−51%, −8%] | −41% [−61%, −10%] | fewer in every repetition, within the noise |

### Outcome (hit@5), by repetition

Per paired task: **better** = the SigMap arm named the file and the other did not; **worse** = the reverse; **tie** = both found it or both missed. Localisation only.

| repetition | paired tasks | better | worse | tie |
| --- | ---: | ---: | ---: | ---: |
| R1 | 8 | 0 | 0 | 8 |
| R2 | 8 | 0 | 0 | 8 |
| R3 | 8 | 0 | 0 | 8 |
| R4 | 8 | 0 | 0 | 8 |
| all | 32 | 0 | 0 | 32 |

## Tool calls

Provenance: agent-reported (main-thread tool_use blocks). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 4 | 1 | −4 | 7 / 1 / 0 |
| all | 4 | 1 | −4 | 7 / 1 / 0 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 181 | 2,698 | +2,518 | 0 / 0 / 8 |
| all | 181 | 2,698 | +2,518 | 0 / 0 / 8 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 750 | 554 | −211 | 7 / 0 / 1 |
| all | 750 | 554 | −211 | 7 / 0 / 1 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 14,375 | 1,221 | −12,845 | 6 / 1 / 1 |
| all | 14,375 | 1,221 | −12,845 | 6 / 1 / 1 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 8,543 | 2,028 | −5,427 | 7 / 1 / 0 |
| all | 8,543 | 2,028 | −5,427 | 7 / 1 / 0 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 26,363 | 7,097 | −17,262 | 6 / 0 / 2 |
| all | 26,363 | 7,097 | −17,262 | 6 / 0 / 2 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd), or computed from the API's usage and a price table when the run went through the Messages API directly. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | $0.0017 | $0.0008 | −$0.0006 | 6 / 0 / 2 |
| all | $0.0017 | $0.0008 | −$0.0006 | 6 / 0 / 2 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 5.0 s | 3.1 s | −1.6 s | 7 / 0 / 1 |
| all | 5.0 s | 3.1 s | −1.6 s | 7 / 0 / 1 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | $0.0523 (32 runs) | $0.0296 (32 runs) | none | none |
| all | $0.0523 (32 runs) | $0.0296 (32 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| sigmap-src/h001 | without | 4/4 | 4 [2–6] | 178 [178–180] | 675 [592–723] | 8,851 [8,040–14,884] | 8,992 [5,852–9,608] | $0.0015 [$0.0012–$0.0017] | 4.5 s [3.4 s–5.1 s] |
| sigmap-src/h001 | with | 4/4 | 3 [1–4] | 2,653 [2,651–2,655] | 624 [576–635] | 10,747 [1,628–19,437] | 8,409 [7,743–9,559] | $0.0018 [$0.0016–$0.0019] | 4.0 s [3.3 s–4.2 s] |
| sigmap-src/h002 | without | 0/4 | 6 [5–7] | 181 [181–185] | 1,436 [1,237–1,507] | 19,900 [14,803–40,006] | 13,722 [12,109–15,167] | $0.0027 [$0.0024–$0.0029] | 7.6 s [6.5 s–8.0 s] |
| sigmap-src/h002 | with | 0/4 | 2 [1–2] | 2,742 [2,742–2,744] | 1,124 [866–1,519] | 1,628 [1,628–6,212] | 4,056 [3,676–8,209] | $0.0015 [$0.0012–$0.0018] | 6.2 s [5.6 s–8.5 s] |
| sigmap-src/h003 | without | 4/4 | 2 [1–2] | 182 [180–182] | 537 [481–552] | 8,232 [1,628–8,336] | 6,160 [5,841–6,393] | $0.0011 [$0.0010–$0.0012] | 3.5 s [2.7 s–3.7 s] |
| sigmap-src/h003 | with | 4/4 | 0 [0–1] | 2,955 [2,955–2,957] | 487 [482–542] | 814 [814–1,628] | 0 [0–3,617] | $0.0005 [$0.0005–$0.0010] | 2.8 s [2.4 s–3.1 s] |
| sigmap-src/h004 | without | 4/4 | 8 [6–8] | 191 [189–193] | 1,453 [1,293–1,848] | 62,427 [39,926–75,157] | 12,050 [10,675–12,629] | $0.0029 [$0.0024–$0.0033] | 8.9 s [8.0 s–11.3 s] |
| sigmap-src/h004 | with | 4/4 | 2 [1–3] | 1,931 [1,931–1,933] | 617 [484–682] | 1,628 [1,628–4,593] | 4,431 [2,205–5,747] | $0.0011 [$0.0007–$0.0013] | 3.2 s [2.9 s–3.7 s] |
| sigmap-src/h005 | without | 4/4 | 4 [2–5] | 181 [180–182] | 620 [564–667] | 8,229 [3,838–8,318] | 4,693 [3,937–6,791] | $0.0010 [$0.0009–$0.0012] | 3.9 s [3.2 s–4.0 s] |
| sigmap-src/h005 | with | 4/4 | 0 [0–0] | 2,409 [2,409–2,409] | 344 [299–446] | 814 [814–814] | 0 [0–0] | $0.0004 [$0.0004–$0.0005] | 2.2 s [2.0 s–2.3 s] |
| sigmap-src/h006 | without | 4/4 | 5 [2–7] | 180 [177–185] | 825 [679–1,309] | 22,406 [8,012–42,303] | 9,010 [7,266–14,150] | $0.0020 [$0.0015–$0.0024] | 5.4 s [4.6 s–7.7 s] |
| sigmap-src/h006 | with | 4/4 | 2 [0–2] | 3,037 [3,035–3,037] | 679 [488–747] | 1,628 [814–1,628] | 5,086 [0–5,430] | $0.0013 [$0.0006–$0.0014] | 3.5 s [2.7 s–4.2 s] |
| sigmap-src/h007 | without | 0/4 | 0 [0–0] | 172 [172–172] | 260 [227–297] | 814 [814–814] | 0 [0–0] | $0.0002 [$0.0001–$0.0002] | 2.0 s [1.6 s–2.2 s] |
| sigmap-src/h007 | with | 0/4 | 0 [0–0] | 2,795 [2,795–2,795] | 491 [461–526] | 814 [814–814] | 0 [0–0] | $0.0005 [$0.0005–$0.0006] | 3.0 s [2.9 s–3.1 s] |
| sigmap-src/h008 | without | 4/4 | 7 [4–7] | 181 [179–185] | 1,208 [989–1,301] | 25,426 [21,629–39,600] | 8,094 [3,722–10,160] | $0.0020 [$0.0013–$0.0021] | 7.3 s [6.3 s–7.9 s] |
| sigmap-src/h008 | with | 4/4 | 0 [0–0] | 1,682 [1,682–1,682] | 358 [294–434] | 814 [814–814] | 0 [0–0] | $0.0004 [$0.0003–$0.0004] | 2.4 s [1.8 s–2.7 s] |

