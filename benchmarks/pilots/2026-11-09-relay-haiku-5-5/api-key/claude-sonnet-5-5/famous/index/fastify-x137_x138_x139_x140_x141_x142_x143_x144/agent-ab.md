# Agent-level A/B — measured tool calls, tokens and cost

**anthropic-messages-api direct Messages API · claude-sonnet-5-5 · 2026-11-11 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap index strategy + 7-tool core MCP profile (the docs' setup for an agent that calls the tools).
- Both arms: the same prompt, model, tool allowlist (Read, Grep, Glob, Bash), per-run budget cap $0.25 and timeout 420 s; run in a clean copy of the commit pinned in `benchmarks/xrepo-repos.json`.
- Questions: the task id(s) x137, x138, x139, x140, x141, x142, x143, x144 of `benchmarks/tasks/retrieval-xrepo.jsonl`. Pass = hit@5 on the repository-relative paths the answer names.
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
| fastify | 8 | 16/16 | 16/16 | 0 / 0 |
| all | 8 | 16/16 | 16/16 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 8. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −15% | −26% | fewer in every repetition |
| Input tokens (uncached) | 0% | 0% | fewer in every repetition |
| Output tokens | −9% | −18% | fewer in every repetition |
| Cache-read tokens | +67% | +10% | more in every repetition |
| Cache-write tokens | −60% | −58% | fewer in every repetition |
| Total tokens (derived) | +6% | −13% | mixed |
| Cost | −38% | −39% | fewer in every repetition |
| Wall time | −18% | −19% | fewer in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −18% [−39%, +9%] † | −24% [−52%, +21%] † | fewer in every repetition, within the noise |
| Input tokens (uncached) | 0% [−1%, 0%] † | 0% [−1%, +1%] † | fewer in every repetition, within the noise |
| Output tokens | −12% [−32%, +16%] † | −18% [−39%, +10%] † | fewer in every repetition, within the noise |
| Cache-read tokens | +73% [+16%, +160%] | +47% [−30%, +179%] † | more in every repetition, within the noise |
| Cache-write tokens | −59% [−74%, −37%] | −46% [−70%, +19%] † | fewer in every repetition, within the noise |
| Total tokens (derived) | +4% [−26%, +50%] † | −1% [−45%, +57%] † | mixed |
| Cost | −39% [−57%, −16%] | −35% [−57%, +5%] † | fewer in every repetition, within the noise |
| Wall time | −17% [−32%, +1%] † | −20% [−40%, +8%] † | fewer in every repetition, within the noise |

### Outcome (hit@5), by repetition

Per paired task: **better** = the SigMap arm named the file and the other did not; **worse** = the reverse; **tie** = both found it or both missed. Localisation only.

| repetition | paired tasks | better | worse | tie |
| --- | ---: | ---: | ---: | ---: |
| R1 | 8 | 0 | 0 | 8 |
| R2 | 8 | 0 | 0 | 8 |
| all | 16 | 0 | 0 | 16 |

## Tool calls

Provenance: agent-reported (main-thread tool_use blocks). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | 4 | 3 | −1 | 4 / 2 / 2 |
| all | 4 | 3 | −1 | 4 / 2 / 2 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | 215 | 215 | 0 | 3 / 2 / 3 |
| all | 215 | 215 | 0 | 3 / 2 / 3 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | 653 | 586 | −75 | 5 / 0 / 3 |
| all | 653 | 586 | −75 | 5 / 0 / 3 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | 7,836 | 12,594 | +5,782 | 1 / 0 / 7 |
| all | 7,836 | 12,594 | +5,782 | 1 / 0 / 7 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | 6,380 | 2,561 | −3,904 | 7 / 0 / 1 |
| all | 6,380 | 2,561 | −3,904 | 7 / 0 / 1 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | 14,627 | 15,894 | +1,483 | 3 / 0 / 5 |
| all | 14,627 | 15,894 | +1,483 | 3 / 0 / 5 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd), or computed from the API's usage and a price table when the run went through the Messages API directly. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | $0.0237 | $0.0150 | −$0.0095 | 7 / 0 / 1 |
| all | $0.0237 | $0.0150 | −$0.0095 | 7 / 0 / 1 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | 7.1 s | 6.1 s | −944 ms | 5 / 0 / 3 |
| all | 7.1 s | 6.1 s | −944 ms | 5 / 0 / 3 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| fastify | $0.3864 (16 runs) | $0.2372 (16 runs) | none | none |
| all | $0.3864 (16 runs) | $0.2372 (16 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| fastify/x137 | without | 2/2 | 4 [4–4] | 222 [222–222] | 680 [655–705] | 6,527 [5,825–7,228] | 5,745 [5,043–6,446] | $0.0229 [$0.0213–$0.0246] | 6.0 s [5.7 s–6.2 s] |
| fastify/x137 | with | 2/2 | 3 [2–3] | 221 [220–222] | 473 [408–537] | 8,499 [5,597–11,401] | 2,566 [2,193–2,939] | $0.0133 [$0.0111–$0.0154] | 4.6 s [4.0 s–5.3 s] |
| fastify/x138 | without | 2/2 | 2 [2–2] | 203 [203–203] | 383 [340–426] | 1,628 [1,628–1,628] | 7,015 [6,853–7,177] | $0.0221 [$0.0221–$0.0221] | 5.6 s [4.4 s–6.8 s] |
| fastify/x138 | with | 2/2 | 2 [1–3] | 204 [203–205] | 288 [197–379] | 8,782 [6,696–10,868] | 1,723 [1,050–2,395] | $0.0094 [$0.0063–$0.0124] | 3.6 s [3.0 s–4.2 s] |
| fastify/x139 | without | 2/2 | 3 [2–3] | 210 [210–210] | 479 [393–565] | 8,653 [8,536–8,770] | 7,821 [7,734–7,907] | $0.0265 [$0.0254–$0.0276] | 4.9 s [4.7 s–5.1 s] |
| fastify/x139 | with | 2/2 | 3 [2–3] | 210 [210–210] | 600 [480–720] | 11,755 [11,662–11,848] | 3,140 [3,065–3,215] | $0.0166 [$0.0153–$0.0180] | 5.3 s [4.5 s–6.1 s] |
| fastify/x140 | without | 2/2 | 6 [4–8] | 225 [222–228] | 1,029 [903–1,154] | 24,631 [8,394–40,867] | 9,991 [8,951–11,031] | $0.0406 [$0.0335–$0.0477] | 12.7 s [11.4 s–13.9 s] |
| fastify/x140 | with | 2/2 | 2 [2–2] | 220 [220–220] | 467 [454–480] | 6,696 [6,696–6,696] | 1,884 [1,835–1,932] | $0.0112 [$0.0111–$0.0112] | 5.9 s [5.8 s–6.0 s] |
| fastify/x141 | without | 2/2 | 6 [5–6] | 215 [215–215] | 838 [739–936] | 10,596 [4,355–16,837] | 5,464 [2,588–8,340] | $0.0246 [$0.0152–$0.0340] | 7.7 s [7.7 s–7.8 s] |
| fastify/x141 | with | 2/2 | 5 [4–5] | 215 [215–215] | 783 [750–815] | 16,432 [16,157–16,706] | 2,872 [2,823–2,921] | $0.0187 [$0.0185–$0.0190] | 7.2 s [7.1 s–7.3 s] |
| fastify/x142 | without | 2/2 | 6 [5–6] | 215 [214–216] | 784 [694–873] | 7,601 [6,878–8,324] | 2,845 [2,484–3,206] | $0.0169 [$0.0168–$0.0170] | 9.4 s [7.7 s–11.0 s] |
| fastify/x142 | with | 2/2 | 3 [2–4] | 213 [212–214] | 572 [460–683] | 13,433 [11,130–15,736] | 1,866 [1,740–1,991] | $0.0135 [$0.0116–$0.0154] | 6.4 s [5.4 s–7.4 s] |
| fastify/x143 | without | 2/2 | 3 [3–3] | 212 [212–212] | 626 [543–709] | 7,187 [5,605–8,768] | 2,147 [548–3,746] | $0.0135 [$0.0090–$0.0180] | 8.9 s [7.0 s–10.8 s] |
| fastify/x143 | with | 2/2 | 5 [4–6] | 215 [212–218] | 781 [589–973] | 17,595 [10,822–24,367] | 3,044 [2,758–3,329] | $0.0194 [$0.0154–$0.0234] | 9.7 s [7.5 s–12.0 s] |
| fastify/x144 | without | 2/2 | 3 [2–3] | 219 [219–219] | 606 [554–657] | 8,072 [7,934–8,209] | 7,185 [6,352–8,018] | $0.0261 [$0.0235–$0.0286] | 6.4 s [5.9 s–6.9 s] |
| fastify/x144 | with | 2/2 | 3 [2–4] | 220 [219–221] | 701 [628–774] | 13,803 [11,181–16,424] | 2,557 [2,393–2,720] | $0.0166 [$0.0149–$0.0183] | 7.3 s [6.7 s–7.9 s] |

