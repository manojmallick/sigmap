# Agent-level A/B — measured tool calls, tokens and cost

**anthropic-messages-api direct Messages API · claude-haiku-5-5 · 2026-11-11 · 4 runs per arm · publishable**

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
| fastapi | 8 | 32/32 | 32/32 | 0 / 0 |
| all | 8 | 32/32 | 32/32 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2, R3, R4) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 8. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | R3 | R4 | verdict |
| --- | ---: | ---: | ---: | ---: | ---: |
| Tool calls | −31% | −22% | −9% | −31% | fewer in every repetition |
| Input tokens (uncached) | +838% | +840% | +841% | +839% | more in every repetition |
| Output tokens | +3% | −4% | +9% | −2% | mixed |
| Cache-read tokens | −38% | −28% | −35% | −59% | fewer in every repetition |
| Cache-write tokens | −7% | 0% | −40% | −40% | fewer in every repetition |
| Total tokens (derived) | −12% | 0% | −24% | −39% | fewer in every repetition |
| Cost | +12% | +16% | −11% | −15% | mixed |
| Wall time | +9% | −9% | +2% | −10% | mixed |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | R3 | R4 | verdict |
| --- | ---: | ---: | ---: | ---: | ---: |
| Tool calls | −32% [−49%, −8%] | −21% [−43%, +7%] † | −13% [−41%, +19%] † | −31% [−52%, +5%] † | fewer in every repetition, within the noise |
| Input tokens (uncached) | +770% [+563%, +1046%] | +772% [+564%, +1052%] | +772% [+565%, +1051%] | +771% [+563%, +1048%] | more in every repetition, outside the noise |
| Output tokens | +1% [−17%, +27%] † | −5% [−20%, +16%] † | +8% [−7%, +23%] † | −2% [−15%, +16%] † | mixed |
| Cache-read tokens | −46% [−64%, −19%] | −34% [−57%, −6%] | −34% [−67%, +19%] † | −55% [−71%, −27%] | fewer in every repetition, within the noise |
| Cache-write tokens | +5% [−30%, +52%] † | +8% [−19%, +44%] † | −23% [−54%, +34%] † | −34% [−58%, +7%] † | mixed |
| Total tokens (derived) | −11% [−36%, +23%] † | 0% [−25%, +31%] † | −13% [−46%, +37%] † | −32% [−55%, +7%] † | mixed |
| Cost | +16% [−14%, +55%] † | +18% [−5%, +49%] † | −1% [−30%, +42%] † | −11% [−35%, +25%] † | mixed |
| Wall time | +8% [−6%, +28%] † | −9% [−21%, +8%] † | +1% [−14%, +14%] † | −10% [−21%, +3%] † | mixed |

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
| fastapi | 3 | 2 | −1 | 6 / 0 / 2 |
| all | 3 | 2 | −1 | 6 / 0 / 2 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | 216 | 1,893 | +1,674 | 0 / 0 / 8 |
| all | 216 | 1,893 | +1,674 | 0 / 0 / 8 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | 721 | 773 | −27 | 5 / 0 / 3 |
| all | 721 | 773 | −27 | 5 / 0 / 3 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | 7,182 | 4,655 | −1,978 | 7 / 0 / 1 |
| all | 7,182 | 4,655 | −1,978 | 7 / 0 / 1 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | 4,909 | 3,321 | −1,001 | 5 / 0 / 3 |
| all | 4,909 | 3,321 | −1,001 | 5 / 0 / 3 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | 12,973 | 10,272 | −1,065 | 6 / 0 / 2 |
| all | 12,973 | 10,272 | −1,065 | 6 / 0 / 2 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd), or computed from the API's usage and a price table when the run went through the Messages API directly. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | $0.0011 | $0.0010 | +$0.0000 | 3 / 0 / 5 |
| all | $0.0011 | $0.0010 | +$0.0000 | 3 / 0 / 5 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | 4.5 s | 4.6 s | −338 ms | 5 / 0 / 3 |
| all | 4.5 s | 4.6 s | −338 ms | 5 / 0 / 3 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| fastapi | $0.0361 (32 runs) | $0.0357 (32 runs) | none | none |
| all | $0.0361 (32 runs) | $0.0357 (32 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| fastapi/x145 | without | 4/4 | 3 [3–4] | 216 [216–218] | 775 [705–901] | 7,947 [6,856–17,470] | 6,752 [6,281–10,000] | $0.0013 [$0.0013–$0.0019] | 4.5 s [4.4 s–5.5 s] |
| fastapi/x145 | with | 4/4 | 1 [1–1] | 1,424 [1,424–1,424] | 604 [554–659] | 1,628 [1,628–1,628] | 3,386 [3,349–3,641] | $0.0009 [$0.0009–$0.0009] | 3.6 s [3.0 s–3.9 s] |
| fastapi/x146 | without | 4/4 | 3 [2–3] | 220 [219–221] | 668 [634–828] | 10,694 [5,843–15,487] | 6,656 [4,321–6,859] | $0.0013 [$0.0009–$0.0014] | 4.5 s [4.1 s–5.0 s] |
| fastapi/x146 | with | 4/4 | 3 [2–4] | 2,530 [2,529–2,531] | 912 [461–1,130] | 9,274 [6,388–15,057] | 5,470 [4,466–7,042] | $0.0014 [$0.0013–$0.0018] | 5.2 s [3.6 s–7.1 s] |
| fastapi/x147 | without | 4/4 | 3 [2–3] | 215 [215–217] | 632 [515–766] | 3,382 [3,207–6,036] | 1,959 [1,566–3,011] | $0.0006 [$0.0005–$0.0008] | 4.1 s [3.6 s–4.9 s] |
| fastapi/x147 | with | 4/4 | 2 [2–2] | 1,829 [1,829–1,829] | 584 [566–616] | 1,628 [1,628–1,628] | 3,140 [3,084–3,154] | $0.0009 [$0.0009–$0.0009] | 3.3 s [3.1 s–4.0 s] |
| fastapi/x148 | without | 4/4 | 3 [3–5] | 209 [209–211] | 610 [569–701] | 5,164 [3,352–20,609] | 3,163 [1,647–9,545] | $0.0008 [$0.0005–$0.0018] | 3.7 s [3.3 s–4.2 s] |
| fastapi/x148 | with | 4/4 | 3 [2–3] | 1,290 [1,288–1,290] | 606 [533–687] | 4,136 [1,628–4,320] | 2,347 [2,231–3,013] | $0.0008 [$0.0007–$0.0008] | 3.8 s [3.6 s–4.2 s] |
| fastapi/x149 | without | 4/4 | 3 [2–4] | 212 [211–213] | 785 [560–968] | 9,146 [7,940–17,262] | 7,592 [4,161–16,043] | $0.0015 [$0.0010–$0.0025] | 4.8 s [3.5 s–5.6 s] |
| fastapi/x149 | with | 4/4 | 2 [2–3] | 3,639 [3,639–3,639] | 792 [596–809] | 6,944 [6,539–7,226] | 4,991 [4,459–5,098] | $0.0014 [$0.0014–$0.0015] | 4.6 s [3.7 s–5.1 s] |
| fastapi/x150 | without | 4/4 | 2 [2–2] | 216 [216–216] | 601 [565–618] | 3,930 [3,914–3,930] | 2,036 [2,022–2,038] | $0.0006 [$0.0006–$0.0006] | 3.8 s [3.5 s–4.0 s] |
| fastapi/x150 | with | 4/4 | 3 [3–3] | 2,588 [2,588–2,588] | 951 [743–1,064] | 5,689 [5,598–6,449] | 4,503 [4,390–5,252] | $0.0014 [$0.0013–$0.0014] | 5.2 s [4.4 s–6.1 s] |
| fastapi/x151 | without | 4/4 | 4 [3–4] | 224 [224–226] | 811 [791–918] | 16,347 [9,355–17,984] | 8,245 [3,232–8,881] | $0.0016 [$0.0009–$0.0018] | 5.3 s [4.9 s–5.4 s] |
| fastapi/x151 | with | 4/4 | 2 [2–3] | 1,957 [1,957–1,959] | 754 [598–895] | 5,175 [5,010–8,246] | 3,169 [3,075–3,501] | $0.0010 [$0.0009–$0.0011] | 4.6 s [4.0 s–5.5 s] |
| fastapi/x152 | without | 4/4 | 5 [3–6] | 220 [218–220] | 1,062 [843–1,145] | 6,418 [3,514–9,825] | 2,965 [2,599–4,699] | $0.0010 [$0.0008–$0.0013] | 5.9 s [4.8 s–6.2 s] |
| fastapi/x152 | with | 4/4 | 3 [3–4] | 1,028 [1,028–1,030] | 963 [907–1,082] | 4,135 [4,009–8,316] | 3,256 [3,091–3,856] | $0.0010 [$0.0010–$0.0012] | 5.4 s [4.9 s–5.9 s] |

