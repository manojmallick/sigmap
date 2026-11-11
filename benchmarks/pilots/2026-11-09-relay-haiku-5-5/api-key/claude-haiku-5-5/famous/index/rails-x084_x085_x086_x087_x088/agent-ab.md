# Agent-level A/B — measured tool calls, tokens and cost

**anthropic-messages-api direct Messages API · claude-haiku-5-5 · 2026-11-11 · 4 runs per arm · publishable**

- Arms: **without** = no SigMap; **with** = SigMap index strategy + 7-tool core MCP profile (the docs' setup for an agent that calls the tools).
- Both arms: the same prompt, model, tool allowlist (Read, Grep, Glob, Bash), per-run budget cap $0.25 and timeout 420 s; run in a clean copy of the commit pinned in `benchmarks/xrepo-repos.json`.
- Questions: the task id(s) x084, x085, x086, x087, x088 of `benchmarks/tasks/retrieval-xrepo.jsonl`. Pass = hit@5 on the repository-relative paths the answer names.
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
| rails | 5 | 20/20 | 20/20 | 0 / 0 |
| all | 5 | 20/20 | 20/20 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2, R3, R4) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 5. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | R3 | R4 | verdict |
| --- | ---: | ---: | ---: | ---: | ---: |
| Tool calls | +13% | +29% | −8% | −33% | mixed |
| Input tokens (uncached) | 0% | 0% | 0% | −1% | mixed |
| Output tokens | +12% | +12% | −8% | −20% | mixed |
| Cache-read tokens | +150% | +96% | +75% | +30% | more in every repetition |
| Cache-write tokens | −17% | −59% | −52% | −63% | fewer in every repetition |
| Total tokens (derived) | +72% | +23% | +13% | −9% | mixed |
| Cost | +3% | −30% | −29% | −43% | mixed |
| Wall time | +7% | +11% | −6% | −18% | mixed |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | R3 | R4 | verdict |
| --- | ---: | ---: | ---: | ---: | ---: |
| Tool calls | 0% [−58%, +141%] † | +33% [−16%, +111%] † | +15% [−36%, +105%] † | −41% [−73%, +26%] † | mixed |
| Input tokens (uncached) | 0% [−1%, +2%] † | 0% [−1%, +2%] † | 0% [−1%, 0%] † | −1% [−3%, 0%] † | mixed |
| Output tokens | 0% [−42%, +80%] † | +9% [−12%, +33%] † | −6% [−30%, +26%] † | −21% [−32%, −9%] | mixed |
| Cache-read tokens | +132% [−6%, +472%] † | +117% [+4%, +353%] | +137% [+28%, +380%] | +22% [−31%, +114%] † | more in every repetition, within the noise |
| Cache-write tokens | −35% [−68%, +42%] † | −64% [−78%, −46%] | −60% [−80%, −24%] | −72% [−80%, −52%] | fewer in every repetition, within the noise |
| Total tokens (derived) | +42% [−30%, +211%] † | +16% [−28%, +89%] † | +20% [−7%, +69%] † | −16% [−46%, +30%] † | mixed |
| Cost | −13% [−53%, +74%] † | −33% [−52%, −12%] | −31% [−52%, −1%] | −47% [−56%, −29%] | fewer in every repetition, within the noise |
| Wall time | −2% [−36%, +61%] † | +8% [−17%, +40%] † | −4% [−22%, +19%] † | −18% [−32%, −4%] | mixed |

### Outcome (hit@5), by repetition

Per paired task: **better** = the SigMap arm named the file and the other did not; **worse** = the reverse; **tie** = both found it or both missed. Localisation only.

| repetition | paired tasks | better | worse | tie |
| --- | ---: | ---: | ---: | ---: |
| R1 | 5 | 0 | 0 | 5 |
| R2 | 5 | 0 | 0 | 5 |
| R3 | 5 | 0 | 0 | 5 |
| R4 | 5 | 0 | 0 | 5 |
| all | 20 | 0 | 0 | 20 |

## Tool calls

Provenance: agent-reported (main-thread tool_use blocks). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | 3 | 3 | 0 | 2 / 1 / 2 |
| all | 3 | 3 | 0 | 2 / 1 / 2 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | 217 | 217 | 0 | 2 / 1 / 2 |
| all | 217 | 217 | 0 | 2 / 1 / 2 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | 827 | 707 | −64 | 3 / 0 / 2 |
| all | 827 | 707 | −64 | 3 / 0 / 2 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | 8,094 | 11,035 | +9,407 | 1 / 0 / 4 |
| all | 8,094 | 11,035 | +9,407 | 1 / 0 / 4 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | 6,340 | 3,012 | −2,919 | 5 / 0 / 0 |
| all | 6,340 | 3,012 | −2,919 | 5 / 0 / 0 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | 16,552 | 15,654 | +5,902 | 2 / 0 / 3 |
| all | 16,552 | 15,654 | +5,902 | 2 / 0 / 3 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd), or computed from the API's usage and a price table when the run went through the Messages API directly. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | $0.0012 | $0.0009 | −$0.0003 | 4 / 0 / 1 |
| all | $0.0012 | $0.0009 | −$0.0003 | 4 / 0 / 1 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | 4.6 s | 4.1 s | −380 ms | 3 / 0 / 2 |
| all | 4.6 s | 4.1 s | −380 ms | 3 / 0 / 2 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| rails | $0.0268 (20 runs) | $0.0199 (20 runs) | none | none |
| all | $0.0268 (20 runs) | $0.0199 (20 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| rails/x084 | without | 4/4 | 1 [1–6] | 207 [207–215] | 575 [566–1,046] | 1,628 [1,628–8,194] | 4,818 [4,123–5,340] | $0.0010 [$0.0009–$0.0011] | 3.4 s [3.2 s–6.1 s] |
| rails/x084 | with | 4/4 | 3 [1–3] | 209 [207–209] | 707 [636–754] | 11,035 [7,428–11,880] | 3,012 [690–4,374] | $0.0009 [$0.0005–$0.0010] | 4.1 s [3.6 s–4.2 s] |
| rails/x085 | without | 4/4 | 3 [1–4] | 217 [213–219] | 827 [682–888] | 11,961 [1,628–15,937] | 5,362 [4,837–8,105] | $0.0012 [$0.0010–$0.0016] | 5.1 s [3.8 s–6.0 s] |
| rails/x085 | with | 4/4 | 3 [1–4] | 214 [213–217] | 692 [565–816] | 9,883 [7,428–17,837] | 1,755 [1,029–1,862] | $0.0007 [$0.0005–$0.0008] | 4.1 s [3.5 s–5.0 s] |
| rails/x086 | without | 4/4 | 3 [2–3] | 233 [233–233] | 863 [775–985] | 8,094 [7,991–8,302] | 7,194 [5,811–7,460] | $0.0014 [$0.0012–$0.0015] | 4.6 s [4.1 s–5.4 s] |
| rails/x086 | with | 4/4 | 2 [1–2] | 232 [231–233] | 566 [394–593] | 9,629 [7,428–12,296] | 1,174 [924–1,412] | $0.0005 [$0.0005–$0.0006] | 3.3 s [2.7 s–3.6 s] |
| rails/x087 | without | 4/4 | 3 [2–4] | 215 [215–217] | 739 [649–937] | 6,476 [4,981–16,029] | 6,340 [3,944–9,862] | $0.0012 [$0.0009–$0.0019] | 4.4 s [4.0 s–5.6 s] |
| rails/x087 | with | 4/4 | 4 [1–6] | 217 [213–221] | 1,100 [738–1,823] | 18,890 [7,428–47,408] | 4,165 [2,519–10,721] | $0.0013 [$0.0008–$0.0027] | 6.5 s [4.5 s–10.2 s] |
| rails/x088 | without | 4/4 | 5 [3–6] | 219 [217–221] | 1,048 [834–1,324] | 10,175 [7,776–14,099] | 8,510 [6,618–9,789] | $0.0017 [$0.0017–$0.0018] | 5.8 s [4.5 s–7.0 s] |
| rails/x088 | with | 4/4 | 5 [3–6] | 219 [217–219] | 984 [914–1,151] | 20,134 [14,653–24,954] | 5,591 [3,519–7,398] | $0.0014 [$0.0012–$0.0017] | 5.5 s [4.9 s–5.8 s] |

