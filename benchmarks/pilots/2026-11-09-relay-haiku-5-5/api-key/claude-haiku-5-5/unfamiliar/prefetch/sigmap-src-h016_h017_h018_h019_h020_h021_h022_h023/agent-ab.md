# Agent-level A/B — measured tool calls, tokens and cost

**anthropic-messages-api direct Messages API · claude-haiku-5-5 · 2026-11-11 · 4 runs per arm · publishable**

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
| sigmap-src | 8 | 25/32 | 22/32 | 0 / 0 |
| all | 8 | 25/32 | 22/32 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2, R3, R4) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 8. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | R3 | R4 | verdict |
| --- | ---: | ---: | ---: | ---: | ---: |
| Tool calls | −81% | −72% | −61% | −68% | fewer in every repetition |
| Input tokens (uncached) | +1304% | +1312% | +1320% | +1316% | more in every repetition |
| Output tokens | −40% | −32% | −12% | −23% | fewer in every repetition |
| Cache-read tokens | −88% | −89% | −34% | −69% | fewer in every repetition |
| Cache-write tokens | −63% | −56% | −58% | −39% | fewer in every repetition |
| Total tokens (derived) | −74% | −71% | −31% | −46% | fewer in every repetition |
| Cost | −48% | −40% | −29% | −20% | fewer in every repetition |
| Wall time | −37% | −36% | −1% | −24% | fewer in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | R3 | R4 | verdict |
| --- | ---: | ---: | ---: | ---: | ---: |
| Tool calls | −70% [−88%, −29%] n=4 | −68% [−82%, −37%] n=5 | −70% [−82%, −48%] n=4 | −53% [−84%, +14%] † n=4 | fewer in every repetition, within the noise |
| Input tokens (uncached) | +1286% [+1137%, +1448%] | +1294% [+1146%, +1449%] | +1302% [+1150%, +1461%] | +1298% [+1154%, +1449%] | more in every repetition, outside the noise |
| Output tokens | −30% [−53%, +11%] † | −26% [−47%, +15%] † | −7% [−41%, +86%] † | −18% [−46%, +40%] † | fewer in every repetition, within the noise |
| Cache-read tokens | −87% [−96%, −53%] | −87% [−94%, −66%] | −69% [−92%, +83%] † | −73% [−91%, −2%] | fewer in every repetition, within the noise |
| Cache-write tokens | −44% [−75%, +51%] † n=4 | −50% [−62%, −33%] n=5 | −50% [−71%, −26%] n=4 | −7% [−49%, +54%] † n=4 | fewer in every repetition, within the noise |
| Total tokens (derived) | −65% [−88%, +12%] † | −60% [−81%, +2%] † | −42% [−81%, +167%] † | −41% [−77%, +75%] † | fewer in every repetition, within the noise |
| Cost | −35% [−70%, +63%] † | −28% [−60%, +60%] † | −22% [−65%, +146%] † | −13% [−58%, +109%] † | fewer in every repetition, within the noise |
| Wall time | −29% [−54%, +22%] † | −31% [−52%, +10%] † | −9% [−47%, +95%] † | −23% [−51%, +36%] † | fewer in every repetition, within the noise |

### Outcome (hit@5), by repetition

Per paired task: **better** = the SigMap arm named the file and the other did not; **worse** = the reverse; **tie** = both found it or both missed. Localisation only.

| repetition | paired tasks | better | worse | tie |
| --- | ---: | ---: | ---: | ---: |
| R1 | 8 | 1 | 1 | 6 |
| R2 | 8 | 0 | 1 | 7 |
| R3 | 8 | 1 | 2 | 5 |
| R4 | 8 | 1 | 2 | 5 |
| all | 32 | 3 | 6 | 23 |

## Tool calls

Provenance: agent-reported (main-thread tool_use blocks). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 4 | 1 | −3 | 7 / 0 / 1 |
| all | 4 | 1 | −3 | 7 / 0 / 1 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 184 | 2,574 | +2,386 | 0 / 0 / 8 |
| all | 184 | 2,574 | +2,386 | 0 / 0 / 8 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 966 | 635 | −284 | 7 / 0 / 1 |
| all | 966 | 635 | −284 | 7 / 0 / 1 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 15,266 | 2,962 | −9,735 | 7 / 0 / 1 |
| all | 15,266 | 2,962 | −9,735 | 7 / 0 / 1 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 8,414 | 3,666 | −5,702 | 6 / 0 / 2 |
| all | 8,414 | 3,666 | −5,702 | 6 / 0 / 2 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 26,203 | 10,466 | −12,732 | 6 / 0 / 2 |
| all | 26,203 | 10,466 | −12,732 | 6 / 0 / 2 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd), or computed from the API's usage and a price table when the run went through the Messages API directly. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | $0.0019 | $0.0011 | −$0.0007 | 6 / 0 / 2 |
| all | $0.0019 | $0.0011 | −$0.0007 | 6 / 0 / 2 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 5.4 s | 4.0 s | −1.9 s | 6 / 0 / 2 |
| all | 5.4 s | 4.0 s | −1.9 s | 6 / 0 / 2 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | $0.0549 (32 runs) | $0.0354 (32 runs) | none | none |
| all | $0.0549 (32 runs) | $0.0354 (32 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| sigmap-src/h016 | without | 3/4 | 3 [1–3] | 178 [176–180] | 734 [596–887] | 7,907 [1,628–14,776] | 6,075 [5,326–6,578] | $0.0012 [$0.0011–$0.0014] | 4.8 s [3.8 s–5.4 s] |
| sigmap-src/h016 | with | 4/4 | 0 [0–0] | 2,973 [2,973–2,973] | 434 [389–462] | 814 [814–814] | 0 [0–0] | $0.0005 [$0.0005–$0.0005] | 2.5 s [2.2 s–2.6 s] |
| sigmap-src/h017 | without | 4/4 | 5 [2–6] | 183 [181–185] | 1,088 [641–1,278] | 14,032 [6,304–22,104] | 8,054 [4,382–8,364] | $0.0017 [$0.0009–$0.0019] | 5.8 s [3.9 s–7.1 s] |
| sigmap-src/h017 | with | 4/4 | 3 [1–4] | 2,355 [2,353–2,355] | 819 [789–859] | 5,235 [1,628–5,342] | 4,255 [2,855–4,782] | $0.0012 [$0.0010–$0.0013] | 4.4 s [4.3 s–5.1 s] |
| sigmap-src/h018 | without | 4/4 | 6 [4–6] | 186 [186–188] | 1,207 [983–1,294] | 21,090 [15,710–30,752] | 12,594 [8,353–13,534] | $0.0024 [$0.0019–$0.0026] | 7.1 s [6.1 s–7.8 s] |
| sigmap-src/h018 | with | 4/4 | 0 [0–0] | 3,097 [3,097–3,097] | 599 [452–716] | 814 [814–814] | 0 [0–0] | $0.0006 [$0.0005–$0.0007] | 3.0 s [2.3 s–3.2 s] |
| sigmap-src/h019 | without | 3/4 | 3 [2–4] | 185 [183–187] | 736 [644–987] | 10,973 [8,356–16,096] | 6,234 [4,037–8,474] | $0.0013 [$0.0010–$0.0016] | 4.7 s [4.0 s–6.0 s] |
| sigmap-src/h019 | with | 4/4 | 2 [1–3] | 3,079 [3,077–3,079] | 636 [581–763] | 8,160 [1,628–11,089] | 7,472 [5,266–10,016] | $0.0016 [$0.0014–$0.0021] | 4.9 s [3.8 s–5.9 s] |
| sigmap-src/h020 | without | 4/4 | 10 [7–13] | 192 [186–192] | 1,348 [969–1,740] | 42,875 [10,231–73,302] | 8,775 [3,539–16,407] | $0.0022 [$0.0010–$0.0037] | 8.7 s [5.9 s–9.8 s] |
| sigmap-src/h020 | with | 0/4 | 1 [1–2] | 2,792 [2,792–2,794] | 708 [618–764] | 1,628 [1,628–5,474] | 3,078 [3,008–3,610] | $0.0010 [$0.0010–$0.0011] | 4.1 s [4.0 s–4.2 s] |
| sigmap-src/h021 | without | 0/4 | 0 [0–0] | 175 [175–175] | 196 [186–250] | 814 [814–814] | 0 [0–0] | $0.0001 [$0.0001–$0.0002] | 1.5 s [1.3 s–1.8 s] |
| sigmap-src/h021 | with | 1/4 | 2 [1–7] | 2,263 [2,262–2,272] | 815 [509–1,622] | 4,296 [1,628–62,227] | 6,021 [4,272–12,657] | $0.0014 [$0.0010–$0.0032] | 6.2 s [4.4 s–14.8 s] |
| sigmap-src/h022 | without | 4/4 | 4 [3–5] | 181 [181–181] | 844 [690–878] | 16,501 [16,377–18,043] | 11,485 [8,881–15,015] | $0.0020 [$0.0016–$0.0025] | 5.1 s [4.4 s–5.2 s] |
| sigmap-src/h022 | with | 4/4 | 2 [1–2] | 1,993 [1,992–1,994] | 633 [571–703] | 5,828 [1,628–10,039] | 5,779 [3,286–8,886] | $0.0013 [$0.0009–$0.0018] | 3.9 s [3.3 s–4.3 s] |
| sigmap-src/h023 | without | 3/4 | 8 [3–10] | 185 [181–189] | 1,213 [904–1,587] | 44,927 [20,797–73,396] | 14,301 [12,335–15,151] | $0.0029 [$0.0022–$0.0034] | 7.6 s [5.4 s–10.0 s] |
| sigmap-src/h023 | with | 1/4 | 0 [0–1] | 2,135 [2,135–2,137] | 531 [402–691] | 814 [814–1,628] | 0 [0–7,372] | $0.0005 [$0.0004–$0.0015] | 2.8 s [2.2 s–3.9 s] |

