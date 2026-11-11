# Agent-level A/B — measured tool calls, tokens and cost

**claude-code 2.1.322 (Claude Code) · claude-haiku-5-5 · 2026-11-11 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap ranked the question BEFORE the first turn (what a prompt hook would inject): the five likeliest files with their signatures and line anchors in the prompt, + the sigmap CLI; no MCP server, no standing section, no extra tool call.
- Both arms: the same prompt, model, tool allowlist (Read, Grep, Glob, Bash), per-run budget cap $0.5 and timeout 420 s; run in a clean copy of the commit pinned in `benchmarks/xrepo-repos.json`.
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
- Run on the logged-in session (--session-auth), not an API key and not under --bare: the agent carries a prompt prefix about 40k tokens larger in both arms (cached), the cost figures are real Anthropic prices with real caching, and the usage counts against that account's plan.

## Outcome

| repo | tasks | pass without | pass with | failed runs (without / with) |
| --- | ---: | ---: | ---: | ---: |
| rails | 5 | 10/10 | 10/10 | 0 / 0 |
| all | 5 | 10/10 | 10/10 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 5. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −35% | −26% | fewer in every repetition |
| Input tokens (uncached) | −29% | −18% | fewer in every repetition |
| Output tokens | −18% | −27% | fewer in every repetition |
| Cache-read tokens | −33% | −13% | fewer in every repetition |
| Cache-write tokens | +22% | −24% | mixed |
| Total tokens (derived) | −21% | −15% | fewer in every repetition |
| Cost | +7% | −23% | mixed |
| Wall time | −7% | −15% | fewer in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −42% [−54%, −22%] | −26% [−46%, +25%] † | fewer in every repetition, within the noise |
| Input tokens (uncached) | −31% [−33%, −26%] | −13% [−39%, +35%] † | fewer in every repetition, within the noise |
| Output tokens | −21% [−41%, +6%] † | −22% [−45%, +8%] † | fewer in every repetition, within the noise |
| Cache-read tokens | −37% [−43%, −26%] | −5% [−38%, +61%] † | fewer in every repetition, within the noise |
| Cache-write tokens | +22% [+18%, +27%] | −17% [−45%, +27%] † | mixed |
| Total tokens (derived) | −24% [−29%, −16%] | −7% [−38%, +54%] † | fewer in every repetition, within the noise |
| Cost | +6% [−3%, +13%] † | −16% [−42%, +21%] † | mixed |
| Wall time | −9% [−14%, −1%] | −12% [−32%, +13%] † | fewer in every repetition, within the noise |

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
| rails | 4 | 3 | −1 | 5 / 0 / 0 |
| all | 4 | 3 | −1 | 5 / 0 / 0 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | 6 | 5 | −2 | 4 / 0 / 1 |
| all | 6 | 5 | −2 | 4 / 0 / 1 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | 1,275 | 916 | −179 | 4 / 0 / 1 |
| all | 1,275 | 916 | −179 | 4 / 0 / 1 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | 34,458 | 31,140 | −11,714 | 4 / 0 / 1 |
| all | 34,458 | 31,140 | −11,714 | 4 / 0 / 1 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | 8,320 | 9,176 | +856 | 2 / 0 / 3 |
| all | 8,320 | 9,176 | +856 | 2 / 0 / 3 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | 43,531 | 41,410 | −10,691 | 4 / 0 / 1 |
| all | 43,531 | 41,410 | −10,691 | 4 / 0 / 1 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | $0.0024 | $0.0026 | +$0.0001 | 2 / 0 / 3 |
| all | $0.0024 | $0.0026 | +$0.0001 | 2 / 0 / 3 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | 10.8 s | 9.9 s | −626 ms | 4 / 0 / 1 |
| all | 10.8 s | 9.9 s | −626 ms | 4 / 0 / 1 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| rails | $0.0286 (10 runs) | $0.0266 (10 runs) | none | none |
| all | $0.0286 (10 runs) | $0.0266 (10 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| rails/x084 | without | 2/2 | 3 [3–3] | 6 [6–6] | 747 [722–772] | 34,458 [32,707–36,209] | 8,320 [6,451–10,188] | $0.0024 [$0.0020–$0.0027] | 9.0 s [8.6 s–9.4 s] |
| rails/x084 | with | 2/2 | 2 [2–2] | 4 [4–4] | 916 [815–1,016] | 22,745 [19,181–26,308] | 9,176 [6,116–12,235] | $0.0025 [$0.0020–$0.0030] | 8.7 s [8.7 s–8.7 s] |
| rails/x085 | without | 2/2 | 4 [2–5] | 5 [4–6] | 1,275 [1,019–1,531] | 27,616 [22,518–32,714] | 6,451 [3,871–9,031] | $0.0022 [$0.0015–$0.0029] | 10.8 s [9.4 s–12.2 s] |
| rails/x085 | with | 2/2 | 3 [2–4] | 6 [4–8] | 835 [697–972] | 39,064 [18,929–59,198] | 8,826 [7,017–10,634] | $0.0026 [$0.0025–$0.0027] | 11.4 s [10.1 s–12.8 s] |
| rails/x086 | without | 2/2 | 2 [2–2] | 5 [4–6] | 774 [774–774] | 27,676 [22,542–32,809] | 5,821 [3,859–7,782] | $0.0018 [$0.0014–$0.0023] | 8.2 s [7.7 s–8.8 s] |
| rails/x086 | with | 2/2 | 1 [1–1] | 4 [4–4] | 628 [627–629] | 22,022 [18,704–25,340] | 6,768 [3,321–10,214] | $0.0019 [$0.0012–$0.0025] | 7.6 s [7.5 s–7.7 s] |
| rails/x087 | without | 2/2 | 5 [4–5] | 7 [6–8] | 1,776 [1,480–2,071] | 44,662 [33,274–56,049] | 11,656 [11,309–12,003] | $0.0037 [$0.0033–$0.0040] | 13.5 s [11.7 s–15.4 s] |
| rails/x087 | with | 2/2 | 3 [2–3] | 5 [4–6] | 920 [886–954] | 31,140 [19,228–43,051] | 9,345 [5,323–13,367] | $0.0026 [$0.0019–$0.0033] | 9.9 s [9.2 s–10.5 s] |
| rails/x088 | without | 2/2 | 7 [6–7] | 11 [10–12] | 1,923 [1,895–1,950] | 77,773 [65,795–89,751] | 12,469 [12,056–12,882] | $0.0042 [$0.0042–$0.0043] | 16.5 s [15.0 s–17.9 s] |
| rails/x088 | with | 2/2 | 5 [4–6] | 7 [6–8] | 1,744 [1,281–2,207] | 49,869 [42,932–56,806] | 11,609 [7,192–16,026] | $0.0037 [$0.0025–$0.0049] | 13.8 s [11.8 s–15.9 s] |

