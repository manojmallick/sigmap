# Agent-level A/B — measured tool calls, tokens and cost

**claude-code 2.1.322 (Claude Code) · claude-haiku-5-5 · 2026-11-11 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap index strategy + 7-tool core MCP profile (the docs' setup for an agent that calls the tools).
- Both arms: the same prompt, model, tool allowlist (Read, Grep, Glob, Bash), per-run budget cap $0.5 and timeout 420 s; run in a clean copy of the commit pinned in `benchmarks/xrepo-repos.json`.
- Questions: the task id(s) x032, x033, x034, x035, x036 of `benchmarks/tasks/retrieval-xrepo.jsonl`. Pass = hit@5 on the repository-relative paths the answer names.
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
| flask | 5 | 10/10 | 10/10 | 0 / 0 |
| all | 5 | 10/10 | 10/10 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 5. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | +38% | −16% | mixed |
| Input tokens (uncached) | +13% | −11% | mixed |
| Output tokens | +15% | +6% | more in every repetition |
| Cache-read tokens | +45% | +9% | more in every repetition |
| Cache-write tokens | +13% | −11% | mixed |
| Total tokens (derived) | +39% | +5% | more in every repetition |
| Cost | +18% | −4% | mixed |
| Wall time | +9% | −2% | mixed |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | +43% [−8%, +122%] † | −20% [−43%, +12%] † | mixed |
| Input tokens (uncached) | +15% [−11%, +40%] † | −13% [−29%, +21%] † | mixed |
| Output tokens | +15% [+6%, +25%] | +7% [−10%, +22%] † | more in every repetition, within the noise |
| Cache-read tokens | +49% [+9%, +94%] | +6% [−18%, +59%] † | more in every repetition, within the noise |
| Cache-write tokens | +12% [−18%, +51%] † | −12% [−35%, +14%] † | mixed |
| Total tokens (derived) | +40% [+6%, +78%] | +3% [−20%, +49%] † | more in every repetition, within the noise |
| Cost | +17% [−7%, +47%] † | −5% [−26%, +17%] † | mixed |
| Wall time | +10% [+5%, +16%] | −2% [−15%, +11%] † | mixed |

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
| flask | 3 | 4 | 0 | 1 / 2 / 2 |
| all | 3 | 4 | 0 | 1 / 2 / 2 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | 7 | 7 | 0 | 1 / 3 / 1 |
| all | 7 | 7 | 0 | 1 / 3 / 1 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | 966 | 1,009 | +132 | 1 / 0 / 4 |
| all | 966 | 1,009 | +132 | 1 / 0 / 4 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | 33,829 | 45,083 | +7,556 | 0 / 0 / 5 |
| all | 33,829 | 45,083 | +7,556 | 0 / 0 / 5 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | 6,648 | 6,423 | +515 | 2 / 0 / 3 |
| all | 6,648 | 6,423 | +515 | 2 / 0 / 3 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | 41,449 | 56,747 | +9,202 | 0 / 0 / 5 |
| all | 41,449 | 56,747 | +9,202 | 0 / 0 / 5 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | $0.0022 | $0.0023 | +$0.0003 | 1 / 0 / 4 |
| all | $0.0022 | $0.0023 | +$0.0003 | 1 / 0 / 4 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | 10.4 s | 9.9 s | +537 ms | 2 / 0 / 3 |
| all | 10.4 s | 9.9 s | +537 ms | 2 / 0 / 3 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| flask | $0.0241 (10 runs) | $0.0256 (10 runs) | none | none |
| all | $0.0241 (10 runs) | $0.0256 (10 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| flask/x032 | without | 2/2 | 5 [4–6] | 7 [6–8] | 1,910 [1,713–2,107] | 36,635 [27,742–45,528] | 10,649 [10,004–11,294] | $0.0035 [$0.0031–$0.0038] | 14.5 s [13.7 s–15.3 s] |
| flask/x032 | with | 2/2 | 5 [3–6] | 7 [6–8] | 2,150 [2,000–2,299] | 45,083 [36,553–53,612] | 11,164 [7,926–14,402] | $0.0038 [$0.0031–$0.0044] | 15.1 s [14.2 s–16.0 s] |
| flask/x033 | without | 2/2 | 3 [1–4] | 6 [4–8] | 1,013 [770–1,255] | 28,872 [16,802–40,942] | 6,476 [4,927–8,025] | $0.0021 [$0.0015–$0.0026] | 10.4 s [8.8 s–12.0 s] |
| flask/x033 | with | 2/2 | 4 [3–4] | 6 [6–6] | 1,009 [976–1,041] | 36,428 [35,474–37,381] | 8,709 [8,197–9,220] | $0.0026 [$0.0025–$0.0027] | 9.9 s [9.2 s–10.7 s] |
| flask/x034 | without | 2/2 | 3 [3–3] | 7 [6–8] | 966 [871–1,060] | 33,829 [27,261–40,396] | 6,648 [6,346–6,949] | $0.0022 [$0.0020–$0.0023] | 10.6 s [10.4 s–10.8 s] |
| flask/x034 | with | 2/2 | 3 [2–4] | 8 [6–10] | 1,123 [1,109–1,137] | 49,491 [34,549–64,432] | 6,126 [4,949–7,302] | $0.0023 [$0.0019–$0.0027] | 11.6 s [11.6 s–11.7 s] |
| flask/x035 | without | 2/2 | 4 [3–4] | 9 [8–10] | 740 [722–757] | 45,773 [38,193–53,353] | 5,304 [4,545–6,063] | $0.0019 [$0.0017–$0.0021] | 10.0 s [8.9 s–11.1 s] |
| flask/x035 | with | 2/2 | 4 [4–4] | 8 [8–8] | 872 [851–892] | 50,359 [49,217–51,501] | 6,423 [6,286–6,559] | $0.0022 [$0.0022–$0.0023] | 9.8 s [9.7 s–10.0 s] |
| flask/x036 | without | 2/2 | 2 [2–2] | 6 [6–6] | 739 [630–847] | 29,179 [27,574–30,783] | 9,124 [8,032–10,215] | $0.0025 [$0.0022–$0.0028] | 8.9 s [7.8 s–10.1 s] |
| flask/x036 | with | 2/2 | 2 [1–3] | 6 [4–8] | 766 [668–864] | 36,505 [22,072–50,937] | 5,872 [4,206–7,537] | $0.0019 [$0.0014–$0.0024] | 9.8 s [8.8 s–10.7 s] |

