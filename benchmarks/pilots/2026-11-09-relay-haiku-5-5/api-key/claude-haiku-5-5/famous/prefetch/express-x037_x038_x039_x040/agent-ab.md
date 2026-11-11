# Agent-level A/B — measured tool calls, tokens and cost

**anthropic-messages-api direct Messages API · claude-haiku-5-5 · 2026-11-11 · 4 runs per arm · publishable**

- Arms: **without** = no SigMap; **with** = SigMap ranked the question BEFORE the first turn (what a prompt hook would inject): the five likeliest files with their signatures and line anchors after the question in the user turn, + the sigmap CLI; no MCP server, no standing section, no extra tool call.
- Both arms: the same prompt, model, tool allowlist (Read, Grep, Glob, Bash), per-run budget cap $0.25 and timeout 420 s; run in a clean copy of the commit pinned in `benchmarks/xrepo-repos.json`.
- Questions: the task id(s) x037, x038, x039, x040 of `benchmarks/tasks/retrieval-xrepo.jsonl`. Pass = hit@5 on the repository-relative paths the answer names.
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
| express | 4 | 16/16 | 16/16 | 0 / 0 |
| all | 4 | 16/16 | 16/16 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2, R3, R4) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 4. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | R3 | R4 | verdict |
| --- | ---: | ---: | ---: | ---: | ---: |
| Tool calls | −58% | −45% | −36% | −73% | fewer in every repetition |
| Input tokens (uncached) | +583% | +585% | +583% | +579% | more in every repetition |
| Output tokens | −1% | −2% | −5% | −3% | fewer in every repetition |
| Cache-read tokens | −45% | −16% | −33% | −71% | fewer in every repetition |
| Cache-write tokens | −28% | +11% | 0% | −62% | mixed |
| Total tokens (derived) | −22% | +12% | −4% | −51% | mixed |
| Cost | −2% | +19% | +12% | −23% | mixed |
| Wall time | +3% | −15% | −20% | −19% | mixed |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | R3 | R4 | verdict |
| --- | ---: | ---: | ---: | ---: | ---: |
| Tool calls | −55% [−80%, −33%] n=3 | −42% [−68%, −10%] | −33% [−70%, 0%] † | −50% [−75%, 0%] † n=2 | fewer in every repetition, within the noise |
| Input tokens (uncached) | +582% [+554%, +617%] | +584% [+554%, +619%] | +583% [+551%, +616%] | +578% [+551%, +609%] | more in every repetition, outside the noise |
| Output tokens | −4% [−16%, +9%] † | −7% [−23%, +11%] † | −4% [−21%, +14%] † | −3% [−9%, +1%] † | fewer in every repetition, within the noise |
| Cache-read tokens | −47% [−75%, 0%] † | −20% [−56%, +18%] † | −27% [−71%, +24%] † | −75% [−90%, −27%] | fewer in every repetition, within the noise |
| Cache-write tokens | −9% [−29%, +4%] † n=3 | +8% [−13%, +47%] † | −2% [−11%, +13%] † | −23% [−49%, +16%] † n=2 | mixed |
| Total tokens (derived) | −25% [−48%, +7%] † | +11% [−16%, +32%] † | 0% [−39%, +31%] † | −54% [−75%, −6%] | mixed |
| Cost | −7% [−27%, +9%] † | +18% [+8%, +32%] | +12% [−6%, +27%] † | −23% [−40%, +4%] † | mixed |
| Wall time | +4% [−3%, +12%] † | −16% [−29%, −1%] | −19% [−38%, −4%] | −17% [−25%, −5%] | mixed |

### Outcome (hit@5), by repetition

Per paired task: **better** = the SigMap arm named the file and the other did not; **worse** = the reverse; **tie** = both found it or both missed. Localisation only.

| repetition | paired tasks | better | worse | tie |
| --- | ---: | ---: | ---: | ---: |
| R1 | 4 | 0 | 0 | 4 |
| R2 | 4 | 0 | 0 | 4 |
| R3 | 4 | 0 | 0 | 4 |
| R4 | 4 | 0 | 0 | 4 |
| all | 16 | 0 | 0 | 16 |

## Tool calls

Provenance: agent-reported (main-thread tool_use blocks). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | 3 | 2 | −1 | 4 / 0 / 0 |
| all | 3 | 2 | −1 | 4 / 0 / 0 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | 199 | 1,364 | +1,163 | 0 / 0 / 4 |
| all | 199 | 1,364 | +1,163 | 0 / 0 / 4 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | 619 | 595 | −24 | 2 / 0 / 2 |
| all | 619 | 595 | −24 | 2 / 0 / 2 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | 4,539 | 2,944 | −809 | 3 / 0 / 1 |
| all | 4,539 | 2,944 | −809 | 3 / 0 / 1 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | 2,967 | 2,724 | −512 | 3 / 0 / 1 |
| all | 2,967 | 2,724 | −512 | 3 / 0 / 1 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | 8,207 | 7,817 | −205 | 2 / 0 / 2 |
| all | 8,207 | 7,817 | −205 | 2 / 0 / 2 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd), or computed from the API's usage and a price table when the run went through the Messages API directly. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | $0.0007 | $0.0009 | +$0.0000 | 2 / 0 / 2 |
| all | $0.0007 | $0.0009 | +$0.0000 | 2 / 0 / 2 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | 4.0 s | 3.7 s | −596 ms | 3 / 0 / 1 |
| all | 4.0 s | 3.7 s | −596 ms | 3 / 0 / 1 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| express | $0.0124 (16 runs) | $0.0124 (16 runs) | none | none |
| all | $0.0124 (16 runs) | $0.0124 (16 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| express/x037 | without | 4/4 | 5 [4–5] | 203 [200–204] | 1,062 [851–1,148] | 8,802 [4,920–11,293] | 3,439 [2,558–4,057] | $0.0010 [$0.0009–$0.0012] | 6.8 s [6.1 s–7.9 s] |
| express/x037 | with | 4/4 | 1 [0–1] | 1,348 [1,346–1,348] | 1,165 [605–1,223] | 1,628 [814–1,628] | 2,424 [0–2,662] | $0.0009 [$0.0007–$0.0011] | 5.9 s [3.3 s–6.8 s] |
| express/x038 | without | 4/4 | 3 [3–3] | 198 [198–198] | 634 [584–735] | 3,607 [3,590–3,616] | 2,785 [2,738–2,829] | $0.0007 [$0.0007–$0.0008] | 3.5 s [3.5 s–3.9 s] |
| express/x038 | with | 4/4 | 3 [2–3] | 1,271 [1,271–1,271] | 656 [614–674] | 4,320 [4,087–4,585] | 3,025 [2,854–3,347] | $0.0009 [$0.0008–$0.0009] | 3.7 s [3.4 s–4.3 s] |
| express/x039 | without | 4/4 | 1 [1–3] | 190 [190–192] | 493 [373–578] | 1,628 [1,628–4,123] | 2,263 [2,038–2,655] | $0.0006 [$0.0005–$0.0007] | 3.1 s [2.4 s–3.6 s] |
| express/x039 | with | 4/4 | 1 [0–1] | 1,395 [1,394–1,396] | 419 [392–533] | 1,221 [814–1,628] | 924 [0–1,887] | $0.0005 [$0.0003–$0.0006] | 2.5 s [2.4 s–2.6 s] |
| express/x040 | without | 4/4 | 3 [2–4] | 200 [198–200] | 605 [524–657] | 5,470 [3,153–6,648] | 3,150 [2,512–3,592] | $0.0007 [$0.0007–$0.0008] | 4.4 s [3.8 s–5.2 s] |
| express/x040 | with | 4/4 | 2 [1–2] | 1,380 [1,378–1,380] | 535 [414–728] | 4,259 [1,628–4,412] | 3,142 [1,822–4,300] | $0.0009 [$0.0006–$0.0010] | 3.8 s [3.2 s–5.0 s] |

