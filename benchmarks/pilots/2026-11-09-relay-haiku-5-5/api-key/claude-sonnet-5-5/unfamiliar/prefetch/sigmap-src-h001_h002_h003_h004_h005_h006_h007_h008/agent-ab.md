# Agent-level A/B — measured tool calls, tokens and cost

**anthropic-messages-api direct Messages API · claude-sonnet-5-5 · 2026-11-11 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

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
| sigmap-src | 8 | 14/16 | 12/16 | 0 / 0 |
| all | 8 | 14/16 | 12/16 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 8. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −69% | −64% | fewer in every repetition |
| Input tokens (uncached) | +1283% | +1288% | more in every repetition |
| Output tokens | −48% | −49% | fewer in every repetition |
| Cache-read tokens | −81% | −82% | fewer in every repetition |
| Cache-write tokens | −55% | −55% | fewer in every repetition |
| Total tokens (derived) | −66% | −65% | fewer in every repetition |
| Cost | −45% | −44% | fewer in every repetition |
| Wall time | −46% | −50% | fewer in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −68% [−77%, −54%] n=7 | −60% [−71%, −41%] n=7 | fewer in every repetition, outside the noise |
| Input tokens (uncached) | +1258% [+1074%, +1435%] | +1263% [+1077%, +1442%] | more in every repetition, outside the noise |
| Output tokens | −51% [−65%, −33%] | −48% [−62%, −33%] | fewer in every repetition, outside the noise |
| Cache-read tokens | −87% [−94%, −75%] | −85% [−92%, −75%] | fewer in every repetition, outside the noise |
| Cache-write tokens | −51% [−64%, −31%] n=7 | −56% [−74%, −32%] n=7 | fewer in every repetition, outside the noise |
| Total tokens (derived) | −69% [−79%, −54%] | −65% [−75%, −51%] | fewer in every repetition, outside the noise |
| Cost | −48% [−60%, −28%] | −45% [−56%, −28%] | fewer in every repetition, outside the noise |
| Wall time | −47% [−62%, −27%] | −51% [−64%, −34%] | fewer in every repetition, outside the noise |

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
| sigmap-src | 5 | 2 | −4 | 8 / 0 / 0 |
| all | 5 | 2 | −4 | 8 / 0 / 0 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 182 | 2,698 | +2,517 | 0 / 0 / 8 |
| all | 182 | 2,698 | +2,517 | 0 / 0 / 8 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 946 | 481 | −393 | 8 / 0 / 0 |
| all | 946 | 481 | −393 | 8 / 0 / 0 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 19,796 | 1,628 | −15,690 | 8 / 0 / 0 |
| all | 19,796 | 1,628 | −15,690 | 8 / 0 / 0 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 8,482 | 4,227 | −5,623 | 7 / 0 / 1 |
| all | 8,482 | 4,227 | −5,623 | 7 / 0 / 1 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 29,466 | 10,124 | −19,117 | 8 / 0 / 0 |
| all | 29,466 | 10,124 | −19,117 | 8 / 0 / 0 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd), or computed from the API's usage and a price table when the run went through the Messages API directly. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | $0.0357 | $0.0209 | −$0.0185 | 7 / 0 / 1 |
| all | $0.0357 | $0.0209 | −$0.0185 | 7 / 0 / 1 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 9.7 s | 5.6 s | −4.9 s | 8 / 0 / 0 |
| all | 9.7 s | 5.6 s | −4.9 s | 8 / 0 / 0 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | $0.6487 (16 runs) | $0.3609 (16 runs) | none | none |
| all | $0.6487 (16 runs) | $0.3609 (16 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| sigmap-src/h001 | without | 2/2 | 5 [4–6] | 179 [178–180] | 696 [589–803] | 11,434 [8,372–14,496] | 6,429 [6,380–6,477] | $0.0257 [$0.0239–$0.0275] | 7.2 s [6.1 s–8.3 s] |
| sigmap-src/h001 | with | 2/2 | 2 [2–2] | 2,651 [2,651–2,651] | 487 [475–499] | 1,628 [1,628–1,628] | 7,247 [7,245–7,249] | $0.0286 [$0.0285–$0.0287] | 6.7 s [5.3 s–8.1 s] |
| sigmap-src/h002 | without | 0/2 | 8 [7–9] | 184 [183–185] | 1,432 [1,328–1,535] | 34,376 [23,631–45,121] | 20,237 [18,426–22,047] | $0.0721 [$0.0665–$0.0778] | 16.2 s [15.5 s–17.0 s] |
| sigmap-src/h002 | with | 0/2 | 4 [3–4] | 2,745 [2,744–2,746] | 978 [772–1,184] | 12,180 [5,922–18,438] | 7,439 [6,041–8,836] | $0.0363 [$0.0295–$0.0431] | 8.9 s [7.1 s–10.7 s] |
| sigmap-src/h003 | without | 2/2 | 4 [3–4] | 183 [182–184] | 645 [573–717] | 12,571 [8,395–16,746] | 7,573 [7,143–8,003] | $0.0283 [$0.0256–$0.0309] | 6.5 s [5.8 s–7.2 s] |
| sigmap-src/h003 | with | 2/2 | 1 [1–1] | 2,957 [2,957–2,957] | 322 [304–339] | 1,628 [1,628–1,628] | 3,375 [3,363–3,386] | $0.0179 [$0.0177–$0.0181] | 3.1 s [2.8 s–3.3 s] |
| sigmap-src/h004 | without | 2/2 | 4 [3–5] | 184 [183–185] | 934 [758–1,109] | 20,447 [15,875–25,018] | 9,391 [8,503–10,279] | $0.0373 [$0.0324–$0.0422] | 9.8 s [8.5 s–11.0 s] |
| sigmap-src/h004 | with | 2/2 | 3 [2–3] | 1,933 [1,933–1,933] | 478 [308–648] | 5,523 [4,496–6,550] | 2,087 [1,017–3,157] | $0.0150 [$0.0142–$0.0157] | 5.9 s [5.1 s–6.7 s] |
| sigmap-src/h005 | without | 2/2 | 4 [3–5] | 181 [180–182] | 555 [522–587] | 11,790 [8,142–15,438] | 6,851 [6,018–7,684] | $0.0254 [$0.0223–$0.0285] | 9.1 s [6.4 s–11.8 s] |
| sigmap-src/h005 | with | 2/2 | 0 [0–0] | 2,409 [2,409–2,409] | 345 [328–362] | 814 [814–814] | 0 [0–0] | $0.0084 [$0.0083–$0.0086] | 3.2 s [3.0 s–3.4 s] |
| sigmap-src/h006 | without | 2/2 | 10 [10–10] | 188 [187–189] | 1,385 [1,312–1,457] | 57,026 [47,321–66,730] | 12,173 [10,713–13,633] | $0.0561 [$0.0497–$0.0624] | 15.1 s [13.5 s–16.7 s] |
| sigmap-src/h006 | with | 2/2 | 2 [2–2] | 3,037 [3,037–3,037] | 484 [475–492] | 1,628 [1,628–1,628] | 5,079 [5,023–5,134] | $0.0239 [$0.0237–$0.0242] | 4.1 s [3.8 s–4.4 s] |
| sigmap-src/h007 | without | 2/2 | 5 [4–6] | 180 [178–182] | 959 [697–1,221] | 27,266 [18,124–36,408] | 11,986 [10,372–13,599] | $0.0454 [$0.0369–$0.0539] | 9.7 s [7.4 s–12.0 s] |
| sigmap-src/h007 | with | 0/2 | 3 [3–3] | 2,799 [2,799–2,799] | 626 [611–641] | 10,809 [10,779–10,839] | 8,857 [8,489–9,224] | $0.0362 [$0.0354–$0.0369] | 8.1 s [7.6 s–8.6 s] |
| sigmap-src/h008 | without | 2/2 | 7 [6–8] | 180 [179–181] | 1,112 [1,013–1,211] | 19,145 [14,187–24,103] | 7,539 [7,106–7,972] | $0.0342 [$0.0311–$0.0372] | 13.1 s [12.9 s–13.4 s] |
| sigmap-src/h008 | with | 2/2 | 2 [1–2] | 1,684 [1,684–1,684] | 258 [240–276] | 1,628 [1,628–1,628] | 3,145 [2,631–3,659] | $0.0141 [$0.0127–$0.0156] | 5.3 s [3.3 s–7.2 s] |

