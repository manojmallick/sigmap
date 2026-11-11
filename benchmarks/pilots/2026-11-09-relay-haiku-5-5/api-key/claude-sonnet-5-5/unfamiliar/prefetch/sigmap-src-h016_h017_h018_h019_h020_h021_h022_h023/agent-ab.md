# Agent-level A/B — measured tool calls, tokens and cost

**anthropic-messages-api direct Messages API · claude-sonnet-5-5 · 2026-11-11 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap ranked the question BEFORE the first turn (what a prompt hook would inject): the five likeliest files with their signatures and line anchors after the question in the user turn, + the sigmap CLI; no MCP server, no standing section, no extra tool call.
- Both arms: the same prompt, model, tool allowlist (Read, Grep, Glob, Bash), per-run budget cap $0.25 and timeout 420 s; run in a clean copy of the commit pinned in `benchmarks/xrepo-repos.json`.
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
- Direct Messages API agent (scripts/lib/agent-ab-api.mjs), not Claude Code: a short neutral system prompt (about 150 tokens) and four read-only tools, so the prefix each turn re-reads is far smaller than Claude Code's and SigMap's per-turn addition is a larger share of a turn. Cost is computed from the usage the API reports and a price table (the Console's usage page is the authority), with 5-minute prompt caching. Not comparable cell by cell with Claude Code runs.

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
| Tool calls | −60% | −60% | fewer in every repetition |
| Input tokens (uncached) | +1309% | +1309% | more in every repetition |
| Output tokens | −37% | −34% | fewer in every repetition |
| Cache-read tokens | −70% | −69% | fewer in every repetition |
| Cache-write tokens | −57% | −53% | fewer in every repetition |
| Total tokens (derived) | −58% | −56% | fewer in every repetition |
| Cost | −41% | −38% | fewer in every repetition |
| Wall time | −41% | −42% | fewer in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −58% [−77%, −28%] n=7 | −64% [−80%, −32%] n=7 | fewer in every repetition, outside the noise |
| Input tokens (uncached) | +1291% [+1146%, +1444%] | +1291% [+1140%, +1450%] | more in every repetition, outside the noise |
| Output tokens | −40% [−59%, −15%] | −40% [−59%, −11%] | fewer in every repetition, outside the noise |
| Cache-read tokens | −75% [−90%, −30%] | −78% [−92%, −38%] | fewer in every repetition, outside the noise |
| Cache-write tokens | −53% [−70%, −24%] n=7 | −51% [−70%, −15%] n=7 | fewer in every repetition, outside the noise |
| Total tokens (derived) | −61% [−78%, −30%] | −58% [−77%, −19%] | fewer in every repetition, outside the noise |
| Cost | −45% [−63%, −17%] | −41% [−61%, −8%] | fewer in every repetition, outside the noise |
| Wall time | −42% [−55%, −22%] | −46% [−61%, −24%] | fewer in every repetition, outside the noise |

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
| sigmap-src | 6 | 2 | −4 | 7 / 0 / 1 |
| all | 6 | 2 | −4 | 7 / 0 / 1 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 184 | 2,575 | +2,389 | 0 / 0 / 8 |
| all | 184 | 2,575 | +2,389 | 0 / 0 / 8 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 832 | 469 | −292 | 6 / 0 / 2 |
| all | 832 | 469 | −292 | 6 / 0 / 2 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 18,502 | 4,260 | −15,103 | 6 / 0 / 2 |
| all | 18,502 | 4,260 | −15,103 | 6 / 0 / 2 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 9,723 | 3,904 | −6,369 | 6 / 0 / 2 |
| all | 9,723 | 3,904 | −6,369 | 6 / 0 / 2 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 30,800 | 10,367 | −20,325 | 6 / 0 / 2 |
| all | 30,800 | 10,367 | −20,325 | 6 / 0 / 2 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd), or computed from the API's usage and a price table when the run went through the Messages API directly. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | $0.0373 | $0.0198 | −$0.0141 | 7 / 0 / 1 |
| all | $0.0373 | $0.0198 | −$0.0141 | 7 / 0 / 1 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 10.9 s | 4.9 s | −4.1 s | 7 / 0 / 1 |
| all | 10.9 s | 4.9 s | −4.1 s | 7 / 0 / 1 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | $0.6181 (16 runs) | $0.3749 (16 runs) | none | none |
| all | $0.6181 (16 runs) | $0.3749 (16 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| sigmap-src/h016 | without | 2/2 | 4 [3–5] | 180 [178–182] | 721 [634–808] | 19,791 [7,939–31,642] | 12,742 [12,480–13,004] | $0.0434 [$0.0408–$0.0460] | 7.6 s [6.3 s–8.9 s] |
| sigmap-src/h016 | with | 2/2 | 1 [1–1] | 2,975 [2,975–2,975] | 432 [350–514] | 1,628 [1,628–1,628] | 3,803 [3,293–4,313] | $0.0201 [$0.0196–$0.0206] | 4.7 s [3.9 s–5.6 s] |
| sigmap-src/h017 | without | 2/2 | 9 [8–9] | 188 [187–189] | 1,288 [1,195–1,380] | 36,952 [31,234–42,670] | 13,039 [11,356–14,722] | $0.0532 [$0.0470–$0.0595] | 13.0 s [11.9 s–14.1 s] |
| sigmap-src/h017 | with | 2/2 | 1 [1–1] | 2,353 [2,353–2,353] | 456 [454–457] | 1,628 [1,628–1,628] | 2,792 [2,712–2,872] | $0.0166 [$0.0164–$0.0168] | 4.6 s [4.5 s–4.7 s] |
| sigmap-src/h018 | without | 2/2 | 5 [4–6] | 184 [184–184] | 758 [663–853] | 12,858 [9,730–15,985] | 8,996 [7,002–10,989] | $0.0330 [$0.0264–$0.0396] | 6.6 s [6.2 s–7.1 s] |
| sigmap-src/h018 | with | 2/2 | 0 [0–0] | 3,097 [3,097–3,097] | 174 [156–191] | 814 [814–814] | 0 [0–0] | $0.0081 [$0.0079–$0.0083] | 1.9 s [1.6 s–2.2 s] |
| sigmap-src/h019 | without | 2/2 | 7 [7–7] | 189 [189–189] | 891 [884–898] | 31,178 [29,054–33,302] | 8,631 [7,005–10,256] | $0.0371 [$0.0327–$0.0415] | 10.8 s [10.5 s–11.0 s] |
| sigmap-src/h019 | with | 2/2 | 2 [1–3] | 3,078 [3,077–3,079] | 596 [541–651] | 6,322 [1,628–11,015] | 8,954 [8,564–9,343] | $0.0358 [$0.0333–$0.0382] | 6.9 s [6.7 s–7.0 s] |
| sigmap-src/h020 | without | 2/2 | 5 [5–5] | 184 [184–184] | 773 [733–812] | 16,760 [16,732–16,787] | 10,451 [10,162–10,739] | $0.0376 [$0.0364–$0.0387] | 11.1 s [9.0 s–13.1 s] |
| sigmap-src/h020 | with | 1/2 | 4 [3–5] | 2,797 [2,796–2,798] | 752 [712–792] | 14,934 [11,582–18,285] | 6,652 [5,956–7,348] | $0.0327 [$0.0299–$0.0355] | 6.8 s [6.5 s–7.1 s] |
| sigmap-src/h021 | without | 2/2 | 6 [5–7] | 182 [181–183] | 964 [813–1,114] | 17,214 [11,408–23,019] | 6,703 [5,226–8,179] | $0.0302 [$0.0238–$0.0366] | 13.3 s [10.3 s–16.3 s] |
| sigmap-src/h021 | with | 2/2 | 7 [5–8] | 2,268 [2,266–2,270] | 1,085 [926–1,243] | 20,242 [10,112–30,372] | 7,056 [4,591–9,520] | $0.0371 [$0.0273–$0.0468] | 10.9 s [9.0 s–12.8 s] |
| sigmap-src/h022 | without | 2/2 | 2 [2–2] | 177 [177–177] | 437 [415–458] | 1,628 [1,628–1,628] | 6,729 [6,729–6,729] | $0.0219 [$0.0217–$0.0221] | 4.2 s [4.2 s–4.2 s] |
| sigmap-src/h022 | with | 2/2 | 2 [1–2] | 1,993 [1,992–1,994] | 483 [420–546] | 3,639 [1,628–5,649] | 4,005 [3,207–4,803] | $0.0196 [$0.0165–$0.0226] | 4.5 s [3.6 s–5.3 s] |
| sigmap-src/h023 | without | 2/2 | 7 [7–7] | 185 [183–187] | 1,017 [1,012–1,022] | 42,298 [31,212–53,383] | 13,466 [12,726–14,205] | $0.0527 [$0.0523–$0.0530] | 11.2 s [9.9 s–12.5 s] |
| sigmap-src/h023 | with | 0/2 | 2 [2–2] | 2,139 [2,139–2,139] | 444 [398–489] | 4,882 [4,882–4,882] | 3,151 [2,956–3,345] | $0.0176 [$0.0166–$0.0185] | 5.1 s [4.9 s–5.3 s] |

