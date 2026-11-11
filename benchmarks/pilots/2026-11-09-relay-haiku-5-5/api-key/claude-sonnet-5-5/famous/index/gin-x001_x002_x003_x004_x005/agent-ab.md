# Agent-level A/B — measured tool calls, tokens and cost

**anthropic-messages-api direct Messages API · claude-sonnet-5-5 · 2026-11-11 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap index strategy + 7-tool core MCP profile (the docs' setup for an agent that calls the tools).
- Both arms: the same prompt, model, tool allowlist (Read, Grep, Glob, Bash), per-run budget cap $0.25 and timeout 420 s; run in a clean copy of the commit pinned in `benchmarks/xrepo-repos.json`.
- Questions: the task id(s) x001, x002, x003, x004, x005 of `benchmarks/tasks/retrieval-xrepo.jsonl`. Pass = hit@5 on the repository-relative paths the answer names.
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
| gin | 5 | 10/10 | 10/10 | 0 / 0 |
| all | 5 | 10/10 | 10/10 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 5. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −43% | −38% | fewer in every repetition |
| Input tokens (uncached) | −1% | −1% | fewer in every repetition |
| Output tokens | −29% | −24% | fewer in every repetition |
| Cache-read tokens | +13% | +33% | more in every repetition |
| Cache-write tokens | −49% | −45% | fewer in every repetition |
| Total tokens (derived) | −9% | +5% | mixed |
| Cost | −36% | −30% | fewer in every repetition |
| Wall time | −30% | −31% | fewer in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −41% [−57%, −20%] | −37% [−67%, +8%] † | fewer in every repetition, within the noise |
| Input tokens (uncached) | −1% [−2%, 0%] | −1% [−2%, 0%] † | fewer in every repetition, within the noise |
| Output tokens | −29% [−39%, −18%] | −25% [−45%, 0%] | fewer in every repetition, outside the noise |
| Cache-read tokens | +45% [−34%, +188%] † | +92% [−31%, +303%] † | more in every repetition, within the noise |
| Cache-write tokens | −40% [−66%, +46%] † | −42% [−77%, +47%] † | fewer in every repetition, within the noise |
| Total tokens (derived) | +15% [−39%, +120%] † | +38% [−30%, +165%] † | more in every repetition, within the noise |
| Cost | −28% [−47%, +7%] † | −25% [−51%, +18%] † | fewer in every repetition, within the noise |
| Wall time | −27% [−40%, −11%] | −25% [−51%, −1%] | fewer in every repetition, outside the noise |

### Outcome (hit@5), by repetition

Per paired task: **better** = the SigMap arm named the file and the other did not; **worse** = the reverse; **tie** = both found it or both missed. Localisation only.

| repetition | paired tasks | better | worse | tie |
| --- | ---: | ---: | ---: | ---: |
| R1 | 5 | 0 | 0 | 5 |
| R2 | 5 | 0 | 0 | 5 |
| all | 10 | 0 | 0 | 10 |

## Tool calls

Provenance: agent-reported (main-thread tool_use blocks). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 3 | 2 | −1 | 3 / 2 / 0 |
| all | 3 | 2 | −1 | 3 / 2 / 0 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 201 | 199 | −1 | 3 / 2 / 0 |
| all | 201 | 199 | −1 | 3 / 2 / 0 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 564 | 391 | −174 | 4 / 0 / 1 |
| all | 564 | 391 | −174 | 4 / 0 / 1 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 4,440 | 7,008 | +5,380 | 1 / 0 / 4 |
| all | 4,440 | 7,008 | +5,380 | 1 / 0 / 4 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 2,899 | 1,848 | −2,183 | 4 / 0 / 1 |
| all | 2,899 | 1,848 | −2,183 | 4 / 0 / 1 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 8,115 | 11,041 | +1,004 | 1 / 0 / 4 |
| all | 8,115 | 11,041 | +1,004 | 1 / 0 / 4 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd), or computed from the API's usage and a price table when the run went through the Messages API directly. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | $0.0142 | $0.0121 | −$0.0067 | 4 / 0 / 1 |
| all | $0.0142 | $0.0121 | −$0.0067 | 4 / 0 / 1 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 6.8 s | 5.5 s | −1.2 s | 4 / 0 / 1 |
| all | 6.8 s | 5.5 s | −1.2 s | 4 / 0 / 1 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| gin | $0.1821 (10 runs) | $0.1217 (10 runs) | none | none |
| all | $0.1821 (10 runs) | $0.1217 (10 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| gin/x001 | without | 2/2 | 4 [3–5] | 201 [200–202] | 647 [589–704] | 20,277 [15,843–24,711] | 7,323 [7,052–7,593] | $0.0292 [$0.0271–$0.0314] | 11.8 s [8.8 s–14.9 s] |
| gin/x001 | with | 2/2 | 1 [1–1] | 196 [196–196] | 326 [321–330] | 6,381 [5,753–7,008] | 4,139 [2,893–5,385] | $0.0153 [$0.0120–$0.0186] | 4.9 s [4.9 s–4.9 s] |
| gin/x002 | without | 2/2 | 3 [2–3] | 212 [212–212] | 564 [551–577] | 4,440 [4,440–4,440] | 2,899 [2,396–3,401] | $0.0142 [$0.0131–$0.0153] | 6.2 s [5.9 s–6.5 s] |
| gin/x002 | with | 2/2 | 2 [1–2] | 210 [210–210] | 391 [309–472] | 7,008 [7,008–7,008] | 716 [666–765] | $0.0075 [$0.0068–$0.0082] | 5.6 s [5.4 s–5.7 s] |
| gin/x003 | without | 2/2 | 3 [2–3] | 204 [203–205] | 542 [443–640] | 3,795 [3,061–4,529] | 2,372 [2,098–2,646] | $0.0125 [$0.0121–$0.0130] | 8.4 s [7.2 s–9.7 s] |
| gin/x003 | with | 2/2 | 3 [2–3] | 204 [203–205] | 547 [539–554] | 13,244 [10,930–15,558] | 1,440 [841–2,039] | $0.0121 [$0.0101–$0.0142] | 5.5 s [5.4 s–5.7 s] |
| gin/x004 | without | 2/2 | 4 [3–4] | 200 [199–201] | 847 [736–957] | 9,652 [6,496–12,808] | 7,143 [6,061–8,224] | $0.0287 [$0.0242–$0.0331] | 6.8 s [6.2 s–7.3 s] |
| gin/x004 | with | 2/2 | 2 [2–2] | 199 [199–199] | 595 [593–596] | 15,471 [13,818–17,124] | 2,580 [938–4,222] | $0.0159 [$0.0121–$0.0196] | 5.6 s [5.4 s–5.7 s] |
| gin/x005 | without | 2/2 | 1 [1–1] | 178 [178–178] | 441 [409–472] | 1,628 [1,628–1,628] | 542 [519–564] | $0.0064 [$0.0061–$0.0068] | 4.5 s [4.3 s–4.6 s] |
| gin/x005 | with | 2/2 | 1 [1–1] | 178 [178–178] | 367 [315–418] | 7,008 [7,008–7,008] | 1,848 [1,770–1,925] | $0.0100 [$0.0093–$0.0108] | 4.6 s [4.3 s–4.9 s] |

