# Agent-level A/B — measured tool calls, tokens and cost

**anthropic-messages-api direct Messages API · claude-haiku-5-5 · 2026-11-11 · 4 runs per arm · publishable**

- Arms: **without** = no SigMap; **with** = SigMap ranked the question BEFORE the first turn (what a prompt hook would inject): the five likeliest files with their signatures and line anchors after the question in the user turn, + the sigmap CLI; no MCP server, no standing section, no extra tool call.
- Both arms: the same prompt, model, tool allowlist (Read, Grep, Glob, Bash), per-run budget cap $0.25 and timeout 420 s; run in a clean copy of the commit pinned in `benchmarks/xrepo-repos.json`.
- Questions: the task id(s) h024, h025, h026, h027, h028, h029, h030 of `benchmarks/tasks/retrieval-xrepo.jsonl`. Pass = hit@5 on the repository-relative paths the answer names.
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
| sigmap-src | 7 | 23/28 | 27/28 | 0 / 0 |
| all | 7 | 23/28 | 27/28 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2, R3, R4) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 7. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | R3 | R4 | verdict |
| --- | ---: | ---: | ---: | ---: | ---: |
| Tool calls | −74% | −79% | −75% | −62% | fewer in every repetition |
| Input tokens (uncached) | +1355% | +1355% | +1352% | +1358% | more in every repetition |
| Output tokens | −31% | −39% | −42% | −30% | fewer in every repetition |
| Cache-read tokens | −89% | −88% | −81% | −78% | fewer in every repetition |
| Cache-write tokens | −58% | −55% | −51% | −59% | fewer in every repetition |
| Total tokens (derived) | −72% | −69% | −65% | −64% | fewer in every repetition |
| Cost | −42% | −40% | −39% | −40% | fewer in every repetition |
| Wall time | −28% | −40% | −44% | −28% | fewer in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | R3 | R4 | verdict |
| --- | ---: | ---: | ---: | ---: | ---: |
| Tool calls | −60% [−82%, −13%] n=5 | −62% [−81%, −24%] n=5 | −54% [−75%, −16%] n=5 | −34% [−76%, +55%] † n=5 | fewer in every repetition, within the noise |
| Input tokens (uncached) | +1345% [+1208%, +1473%] | +1345% [+1217%, +1465%] | +1342% [+1216%, +1466%] | +1348% [+1214%, +1474%] | more in every repetition, outside the noise |
| Output tokens | −28% [−50%, −2%] | −35% [−48%, −18%] | −32% [−56%, +5%] † | −20% [−48%, +17%] † | fewer in every repetition, within the noise |
| Cache-read tokens | −79% [−93%, −44%] | −80% [−93%, −47%] | −80% [−94%, −41%] | −65% [−90%, +13%] † | fewer in every repetition, within the noise |
| Cache-write tokens | −45% [−73%, −12%] n=5 | −35% [−71%, +39%] † n=5 | −38% [−67%, −3%] n=5 | −42% [−68%, −13%] n=5 | fewer in every repetition, within the noise |
| Total tokens (derived) | −61% [−81%, −24%] | −58% [−79%, −13%] | −62% [−83%, −20%] | −51% [−78%, 0%] † | fewer in every repetition, within the noise |
| Cost | −40% [−62%, −9%] | −35% [−59%, +5%] † | −40% [−65%, −3%] | −35% [−60%, 0%] | fewer in every repetition, within the noise |
| Wall time | −22% [−42%, +2%] † | −36% [−51%, −11%] | −35% [−56%, −4%] | −19% [−48%, +25%] † | fewer in every repetition, within the noise |

### Outcome (hit@5), by repetition

Per paired task: **better** = the SigMap arm named the file and the other did not; **worse** = the reverse; **tie** = both found it or both missed. Localisation only.

| repetition | paired tasks | better | worse | tie |
| --- | ---: | ---: | ---: | ---: |
| R1 | 7 | 0 | 0 | 7 |
| R2 | 7 | 2 | 0 | 5 |
| R3 | 7 | 1 | 0 | 6 |
| R4 | 7 | 1 | 0 | 6 |
| all | 28 | 4 | 0 | 24 |

## Tool calls

Provenance: agent-reported (main-thread tool_use blocks). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 4 | 1 | −3 | 5 / 2 / 0 |
| all | 4 | 1 | −3 | 5 / 2 / 0 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 181 | 2,544 | +2,368 | 0 / 0 / 7 |
| all | 181 | 2,544 | +2,368 | 0 / 0 / 7 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 843 | 526 | −317 | 5 / 0 / 2 |
| all | 843 | 526 | −317 | 5 / 0 / 2 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 13,804 | 1,628 | −12,990 | 5 / 2 / 0 |
| all | 13,804 | 1,628 | −12,990 | 5 / 2 / 0 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 6,284 | 3,970 | −3,397 | 6 / 0 / 1 |
| all | 6,284 | 3,970 | −3,397 | 6 / 0 / 1 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 21,286 | 8,825 | −15,276 | 5 / 0 / 2 |
| all | 21,286 | 8,825 | −15,276 | 5 / 0 / 2 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd), or computed from the API's usage and a price table when the run went through the Messages API directly. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | $0.0014 | $0.0010 | −$0.0005 | 5 / 0 / 2 |
| all | $0.0014 | $0.0010 | −$0.0005 | 5 / 0 / 2 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 5.6 s | 3.3 s | −1.9 s | 5 / 0 / 2 |
| all | 5.6 s | 3.3 s | −1.9 s | 5 / 0 / 2 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | $0.0501 (28 runs) | $0.0300 (28 runs) | none | none |
| all | $0.0501 (28 runs) | $0.0300 (28 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| sigmap-src/h024 | without | 1/4 | 7 [6–8] | 186 [184–188] | 1,394 [1,293–1,751] | 51,994 [39,933–53,132] | 12,379 [10,223–14,179] | $0.0027 [$0.0025–$0.0032] | 8.9 s [7.9 s–10.2 s] |
| sigmap-src/h024 | with | 3/4 | 3 [2–3] | 3,110 [3,109–3,111] | 946 [762–1,327] | 12,303 [10,659–24,096] | 8,982 [8,157–13,713] | $0.0021 [$0.0019–$0.0026] | 5.2 s [4.5 s–6.9 s] |
| sigmap-src/h025 | without | 3/4 | 9 [7–10] | 184 [183–187] | 1,565 [1,191–1,714] | 70,393 [51,328–81,267] | 18,976 [13,976–20,019] | $0.0038 [$0.0030–$0.0042] | 9.2 s [7.2 s–10.1 s] |
| sigmap-src/h025 | with | 4/4 | 1 [1–1] | 2,087 [2,087–2,087] | 526 [489–561] | 1,628 [1,628–1,628] | 2,891 [2,509–3,649] | $0.0009 [$0.0008–$0.0009] | 3.6 s [3.2 s–3.8 s] |
| sigmap-src/h026 | without | 4/4 | 4 [2–5] | 182 [179–185] | 843 [403–926] | 18,135 [8,106–40,284] | 6,284 [5,810–10,846] | $0.0014 [$0.0010–$0.0022] | 5.6 s [2.9 s–6.3 s] |
| sigmap-src/h026 | with | 4/4 | 1 [1–3] | 2,934 [2,934–2,938] | 526 [497–616] | 1,628 [1,628–10,626] | 3,970 [3,844–6,319] | $0.0011 [$0.0010–$0.0014] | 3.7 s [3.7 s–5.3 s] |
| sigmap-src/h027 | without | 3/4 | 5 [3–8] | 176 [173–181] | 994 [887–1,464] | 13,804 [5,718–48,339] | 7,592 [4,990–10,916] | $0.0015 [$0.0013–$0.0026] | 5.8 s [5.0 s–9.2 s] |
| sigmap-src/h027 | with | 4/4 | 0 [0–0] | 2,679 [2,679–2,679] | 464 [412–523] | 814 [814–814] | 0 [0–0] | $0.0005 [$0.0005–$0.0005] | 2.4 s [2.4 s–3.5 s] |
| sigmap-src/h028 | without | 4/4 | 1 [1–1] | 170 [170–170] | 436 [377–500] | 1,628 [1,628–1,628] | 5,445 [5,422–5,450] | $0.0009 [$0.0009–$0.0010] | 2.5 s [2.3 s–2.8 s] |
| sigmap-src/h028 | with | 4/4 | 1 [1–2] | 2,517 [2,517–2,519] | 456 [368–532] | 1,628 [1,628–5,327] | 4,217 [3,375–4,258] | $0.0010 [$0.0010–$0.0010] | 3.3 s [2.8 s–4.0 s] |
| sigmap-src/h029 | without | 4/4 | 1 [1–1] | 176 [176–176] | 609 [503–656] | 1,628 [1,628–1,628] | 5,671 [5,636–5,805] | $0.0011 [$0.0010–$0.0011] | 3.4 s [3.1 s–4.3 s] |
| sigmap-src/h029 | with | 4/4 | 0 [0–0] | 2,544 [2,544–2,544] | 559 [534–584] | 814 [814–814] | 0 [0–0] | $0.0005 [$0.0005–$0.0006] | 2.7 s [2.4 s–3.1 s] |
| sigmap-src/h030 | without | 4/4 | 1 [1–1] | 181 [181–181] | 431 [284–515] | 1,628 [1,628–1,628] | 5,278 [2,739–5,284] | $0.0009 [$0.0006–$0.0009] | 2.6 s [2.0 s–3.0 s] |
| sigmap-src/h030 | with | 4/4 | 1 [1–1] | 2,400 [2,400–2,400] | 482 [456–519] | 1,628 [1,628–1,628] | 5,413 [5,224–6,638] | $0.0012 [$0.0011–$0.0013] | 2.9 s [2.6 s–3.3 s] |

