# Agent-level A/B — measured tool calls, tokens and cost

**anthropic-messages-api direct Messages API · claude-sonnet-5-5 · 2026-11-11 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap index strategy + 7-tool core MCP profile (the docs' setup for an agent that calls the tools).
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
| sigmap-src | 7 | 12/14 | 13/14 | 0 / 0 |
| all | 7 | 12/14 | 13/14 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 7. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −43% | −38% | fewer in every repetition |
| Input tokens (uncached) | −2% | −1% | fewer in every repetition |
| Output tokens | −37% | −32% | fewer in every repetition |
| Cache-read tokens | −37% | −20% | fewer in every repetition |
| Cache-write tokens | −39% | −24% | fewer in every repetition |
| Total tokens (derived) | −37% | −22% | fewer in every repetition |
| Cost | −38% | −25% | fewer in every repetition |
| Wall time | −27% | −30% | fewer in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −39% [−65%, +2%] † | −31% [−63%, +18%] † | fewer in every repetition, within the noise |
| Input tokens (uncached) | −2% [−3%, 0%] | −1% [−3%, 0%] | fewer in every repetition, outside the noise |
| Output tokens | −37% [−56%, −13%] | −28% [−52%, −3%] | fewer in every repetition, outside the noise |
| Cache-read tokens | +6% [−56%, +159%] † | +11% [−42%, +113%] † | more in every repetition, within the noise |
| Cache-write tokens | −46% [−67%, −14%] | −31% [−59%, +7%] † | fewer in every repetition, within the noise |
| Total tokens (derived) | −27% [−59%, +21%] † | −13% [−47%, +35%] † | fewer in every repetition, within the noise |
| Cost | −41% [−62%, −11%] | −26% [−53%, +7%] † | fewer in every repetition, within the noise |
| Wall time | −23% [−46%, +13%] † | −24% [−47%, +3%] † | fewer in every repetition, within the noise |

### Outcome (hit@5), by repetition

Per paired task: **better** = the SigMap arm named the file and the other did not; **worse** = the reverse; **tie** = both found it or both missed. Localisation only.

| repetition | paired tasks | better | worse | tie |
| --- | ---: | ---: | ---: | ---: |
| R1 | 7 | 0 | 0 | 7 |
| R2 | 7 | 1 | 0 | 6 |
| all | 14 | 1 | 0 | 13 |

## Tool calls

Provenance: agent-reported (main-thread tool_use blocks). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 3 | 2 | −1 | 5 / 1 / 1 |
| all | 3 | 2 | −1 | 5 / 1 / 1 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 181 | 176 | −1 | 5 / 2 / 0 |
| all | 181 | 176 | −1 | 5 / 2 / 0 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 629 | 463 | −142 | 6 / 0 / 1 |
| all | 629 | 463 | −142 | 6 / 0 / 1 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 11,843 | 6,160 | +1,331 | 3 / 0 / 4 |
| all | 11,843 | 6,160 | +1,331 | 3 / 0 / 4 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 6,517 | 3,925 | −1,869 | 5 / 0 / 2 |
| all | 6,517 | 3,925 | −1,869 | 5 / 0 / 2 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 19,167 | 12,670 | −758 | 4 / 0 / 3 |
| all | 19,167 | 12,670 | −758 | 4 / 0 / 3 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd), or computed from the API's usage and a price table when the run went through the Messages API directly. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | $0.0253 | $0.0180 | −$0.0045 | 6 / 0 / 1 |
| all | $0.0253 | $0.0180 | −$0.0045 | 6 / 0 / 1 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 6.5 s | 6.3 s | −937 ms | 4 / 0 / 3 |
| all | 6.5 s | 6.3 s | −937 ms | 4 / 0 / 3 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | $0.3978 (14 runs) | $0.2716 (14 runs) | none | none |
| all | $0.3978 (14 runs) | $0.2716 (14 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| sigmap-src/h024 | without | 0/2 | 5 [4–6] | 182 [180–184] | 864 [718–1,009] | 26,865 [16,497–37,233] | 8,899 [7,599–10,198] | $0.0366 [$0.0298–$0.0434] | 9.2 s [7.5 s–11.0 s] |
| sigmap-src/h024 | with | 1/2 | 5 [4–5] | 181 [180–182] | 816 [697–935] | 32,417 [27,621–37,212] | 8,287 [8,063–8,511] | $0.0357 [$0.0341–$0.0373] | 8.3 s [6.8 s–9.8 s] |
| sigmap-src/h025 | without | 2/2 | 8 [7–8] | 182 [181–183] | 1,196 [1,142–1,250] | 25,886 [19,541–32,230] | 9,155 [8,860–9,450] | $0.0404 [$0.0389–$0.0419] | 12.9 s [12.2 s–13.6 s] |
| sigmap-src/h025 | with | 2/2 | 1 [1–1] | 173 [173–173] | 306 [306–306] | 6,160 [6,160–6,160] | 1,815 [1,813–1,816] | $0.0092 [$0.0092–$0.0092] | 4.4 s [3.8 s–5.1 s] |
| sigmap-src/h026 | without | 2/2 | 8 [8–8] | 189 [189–189] | 1,246 [1,182–1,309] | 44,965 [44,397–45,533] | 7,604 [7,314–7,893] | $0.0408 [$0.0394–$0.0423] | 14.0 s [13.2 s–14.8 s] |
| sigmap-src/h026 | with | 2/2 | 5 [4–5] | 182 [181–183] | 714 [629–798] | 19,307 [16,563–22,051] | 2,643 [2,548–2,738] | $0.0180 [$0.0163–$0.0196] | 7.0 s [6.2 s–7.8 s] |
| sigmap-src/h027 | without | 2/2 | 3 [2–4] | 172 [171–173] | 546 [488–603] | 4,830 [1,628–8,031] | 5,794 [5,541–6,047] | $0.0212 [$0.0194–$0.0231] | 5.2 s [4.5 s–5.9 s] |
| sigmap-src/h027 | with | 2/2 | 2 [1–2] | 171 [171–171] | 328 [204–451] | 6,160 [6,160–6,160] | 3,925 [1,684–6,166] | $0.0147 [$0.0078–$0.0215] | 3.4 s [2.8 s–4.1 s] |
| sigmap-src/h028 | without | 2/2 | 2 [2–2] | 170 [170–170] | 402 [402–402] | 1,628 [1,628–1,628] | 4,494 [4,494–4,494] | $0.0159 [$0.0159–$0.0159] | 3.9 s [3.9 s–3.9 s] |
| sigmap-src/h028 | with | 2/2 | 2 [2–2] | 170 [170–170] | 463 [442–483] | 6,160 [6,160–6,160] | 5,877 [5,877–5,877] | $0.0209 [$0.0207–$0.0211] | 4.1 s [3.9 s–4.2 s] |
| sigmap-src/h029 | without | 2/2 | 3 [2–4] | 179 [178–180] | 629 [509–748] | 11,843 [8,307–15,379] | 6,517 [6,180–6,853] | $0.0253 [$0.0226–$0.0280] | 6.5 s [5.6 s–7.4 s] |
| sigmap-src/h029 | with | 2/2 | 2 [2–2] | 176 [176–176] | 487 [470–504] | 6,160 [6,160–6,160] | 6,750 [6,750–6,750] | $0.0233 [$0.0232–$0.0235] | 6.5 s [6.5 s–6.6 s] |
| sigmap-src/h030 | without | 2/2 | 1 [1–1] | 181 [181–181] | 377 [351–402] | 1,628 [1,628–1,628] | 5,656 [5,656–5,656] | $0.0186 [$0.0183–$0.0188] | 4.2 s [4.0 s–4.3 s] |
| sigmap-src/h030 | with | 2/2 | 2 [2–2] | 181 [181–181] | 332 [322–342] | 6,160 [6,160–6,160] | 3,654 [3,654–3,654] | $0.0140 [$0.0139–$0.0141] | 6.3 s [4.7 s–7.9 s] |

