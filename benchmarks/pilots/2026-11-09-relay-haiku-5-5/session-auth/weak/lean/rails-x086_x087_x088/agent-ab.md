# Agent-level A/B — measured tool calls, tokens and cost

**claude-code 2.1.322 (Claude Code) · claude-haiku-4-5 · 2026-11-10 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap lean: 7-tool core MCP profile + a three-line section.
- Both arms: the same prompt, model, tool allowlist (Read, Grep, Glob, Bash), per-run budget cap $1 and timeout 420 s; run in a clean copy of the commit pinned in `benchmarks/xrepo-repos.json`.
- Questions: the task id(s) x086, x087, x088 of `benchmarks/tasks/retrieval-xrepo.jsonl`. Pass = hit@5 on the repository-relative paths the answer names.
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
- Run on the logged-in session (--session-auth), not an API key and not under --bare: the agent carries a prompt prefix about 40k tokens larger in both arms (cached), the cost figures are real Anthropic prices with real caching, and the usage counts against that account's plan.

## Outcome

| repo | tasks | pass without | pass with | failed runs (without / with) |
| --- | ---: | ---: | ---: | ---: |
| rails | 3 | 6/6 | 6/6 | 0 / 0 |
| all | 3 | 6/6 | 6/6 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 3. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −22% | −12% | fewer in every repetition |
| Input tokens (uncached) | −44% | +13% | mixed |
| Output tokens | −14% | 0% | mixed |
| Cache-read tokens | −52% | +43% | mixed |
| Cache-write tokens | −32% | +24% | mixed |
| Total tokens (derived) | −51% | +40% | mixed |
| Cost | −36% | +23% | mixed |
| Wall time | −19% | +10% | mixed |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −22% [−35%, −14%] | −28% [−60%, +18%] † | fewer in every repetition, within the noise |
| Input tokens (uncached) | −46% [−49%, −39%] | +6% [−38%, +76%] † | mixed |
| Output tokens | −16% [−30%, +3%] † | −11% [−44%, +21%] † | fewer in every repetition, within the noise |
| Cache-read tokens | −53% [−54%, −50%] | +22% [−43%, +119%] † | mixed |
| Cache-write tokens | −29% [−42%, −16%] | +18% [−6%, +65%] † | mixed |
| Total tokens (derived) | −51% [−52%, −50%] | +21% [−38%, +99%] † | mixed |
| Cost | −35% [−41%, −29%] | +13% [−22%, +48%] † | mixed |
| Wall time | −19% [−24%, −9%] | +6% [−14%, +22%] † | mixed |

### Outcome (hit@5), by repetition

Per paired task: **better** = the SigMap arm named the file and the other did not; **worse** = the reverse; **tie** = both found it or both missed. Localisation only.

| repetition | paired tasks | better | worse | tie |
| --- | ---: | ---: | ---: | ---: |
| R1 | 3 | 0 | 0 | 3 |
| R2 | 3 | 0 | 0 | 3 |
| all | 6 | 0 | 0 | 6 |

## Tool calls

Provenance: agent-reported (main-thread tool_use blocks). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | 14 | 10 | −2 | 3 / 0 / 0 |
| all | 14 | 10 | −2 | 3 / 0 / 0 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | 94 | 74 | −24 | 3 / 0 / 0 |
| all | 94 | 74 | −24 | 3 / 0 / 0 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | 2,776 | 2,873 | −175 | 2 / 0 / 1 |
| all | 2,776 | 2,873 | −175 | 2 / 0 / 1 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | 230,159 | 169,537 | −60,622 | 3 / 0 / 0 |
| all | 230,159 | 169,537 | −60,622 | 3 / 0 / 0 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | 18,146 | 15,578 | −1,561 | 3 / 0 / 0 |
| all | 18,146 | 15,578 | −1,561 | 3 / 0 / 0 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | 251,175 | 188,061 | −63,114 | 3 / 0 / 0 |
| all | 251,175 | 188,061 | −63,114 | 3 / 0 / 0 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | $0.0733 | $0.0625 | −$0.0107 | 3 / 0 / 0 |
| all | $0.0733 | $0.0625 | −$0.0107 | 3 / 0 / 0 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | 32.0 s | 31.9 s | −3.2 s | 3 / 0 / 0 |
| all | 32.0 s | 31.9 s | −3.2 s | 3 / 0 / 0 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| rails | $0.4197 (6 runs) | $0.3503 (6 runs) | none | none |
| all | $0.4197 (6 runs) | $0.3503 (6 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| rails/x086 | without | 2/2 | 6 [5–7] | 54 [42–66] | 1,744 [1,556–1,932] | 97,172 [72,775–121,569] | 10,262 [9,917–10,606] | $0.0390 [$0.0349–$0.0431] | 22.9 s [21.1 s–24.8 s] |
| rails/x086 | with | 2/2 | 4 [2–6] | 30 [26–34] | 1,114 [868–1,359] | 49,522 [41,786–57,257] | 9,121 [8,940–9,301] | $0.0288 [$0.0271–$0.0304] | 18.5 s [18.1 s–18.9 s] |
| rails/x087 | without | 2/2 | 17 [11–22] | 142 [98–186] | 3,970 [2,784–5,156] | 380,646 [197,891–563,400] | 19,751 [12,740–26,762] | $0.0976 [$0.0593–$0.1358] | 45.1 s [33.7 s–56.6 s] |
| rails/x087 | with | 2/2 | 16 [13–19] | 110 [106–114] | 3,796 [3,382–4,209] | 283,472 [279,308–287,635] | 18,191 [15,416–20,965] | $0.0838 [$0.0799–$0.0877] | 41.9 s [40.9 s–42.9 s] |
| rails/x088 | without | 2/2 | 14 [10–17] | 94 [42–146] | 2,776 [2,165–3,387] | 230,159 [74,279–386,038] | 18,146 [13,780–22,512] | $0.0733 [$0.0459–$0.1007] | 32.0 s [25.0 s–39.0 s] |
| rails/x088 | with | 2/2 | 10 [8–11] | 74 [74–74] | 2,873 [2,263–3,482] | 169,537 [162,489–176,584] | 15,578 [14,739–16,417] | $0.0625 [$0.0571–$0.0680] | 31.9 s [28.4 s–35.4 s] |

