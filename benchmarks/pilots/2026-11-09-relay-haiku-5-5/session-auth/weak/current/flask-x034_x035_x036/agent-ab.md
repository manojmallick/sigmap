# Agent-level A/B — measured tool calls, tokens and cost

**claude-code 2.1.322 (Claude Code) · claude-haiku-4-5 · 2026-11-10 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap generated context + MCP server.
- Both arms: the same prompt, model, tool allowlist (Read, Grep, Glob, Bash), per-run budget cap $1 and timeout 420 s; run in a clean copy of the commit pinned in `benchmarks/xrepo-repos.json`.
- Questions: the task id(s) x034, x035, x036 of `benchmarks/tasks/retrieval-xrepo.jsonl`. Pass = hit@5 on the repository-relative paths the answer names.
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
| flask | 3 | 6/6 | 6/6 | 0 / 0 |
| all | 3 | 6/6 | 6/6 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 3. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −38% | −32% | fewer in every repetition |
| Input tokens (uncached) | −50% | −35% | fewer in every repetition |
| Output tokens | −39% | −30% | fewer in every repetition |
| Cache-read tokens | −47% | −26% | fewer in every repetition |
| Cache-write tokens | −12% | −28% | fewer in every repetition |
| Total tokens (derived) | −43% | −27% | fewer in every repetition |
| Cost | −26% | −28% | fewer in every repetition |
| Wall time | −34% | −22% | fewer in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −32% [−50%, 0%] † | −26% [−73%, +133%] † | fewer in every repetition, within the noise |
| Input tokens (uncached) | −49% [−71%, −24%] | −33% [−73%, +94%] † | fewer in every repetition, within the noise |
| Output tokens | −37% [−59%, −9%] | −26% [−61%, +55%] † | fewer in every repetition, within the noise |
| Cache-read tokens | −43% [−74%, +8%] † | −19% [−78%, +241%] † | fewer in every repetition, within the noise |
| Cache-write tokens | −15% [−37%, +5%] † | −30% [−43%, −13%] | fewer in every repetition, within the noise |
| Total tokens (derived) | −41% [−71%, +4%] † | −22% [−74%, +160%] † | fewer in every repetition, within the noise |
| Cost | −27% [−52%, −5%] | −29% [−52%, −3%] | fewer in every repetition, outside the noise |
| Wall time | −32% [−55%, −1%] | −20% [−53%, +46%] † | fewer in every repetition, within the noise |

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
| flask | 11 | 5 | −4 | 2 / 0 / 1 |
| all | 11 | 5 | −4 | 2 / 0 / 1 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | 94 | 46 | −40 | 2 / 0 / 1 |
| all | 94 | 46 | −40 | 2 / 0 / 1 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | 2,626 | 1,349 | −841 | 2 / 0 / 1 |
| all | 2,626 | 1,349 | −841 | 2 / 0 / 1 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | 206,596 | 103,569 | −77,738 | 2 / 0 / 1 |
| all | 206,596 | 103,569 | −77,738 | 2 / 0 / 1 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | 17,735 | 13,403 | −4,332 | 3 / 0 / 0 |
| all | 17,735 | 13,403 | −4,332 | 3 / 0 / 0 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | 225,984 | 118,366 | −79,501 | 2 / 0 / 1 |
| all | 225,984 | 118,366 | −79,501 | 2 / 0 / 1 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | $0.0676 | $0.0440 | −$0.0138 | 3 / 0 / 0 |
| all | $0.0676 | $0.0440 | −$0.0138 | 3 / 0 / 0 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | 30.4 s | 19.2 s | −8.0 s | 2 / 0 / 1 |
| all | 30.4 s | 19.2 s | −8.0 s | 2 / 0 / 1 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| flask | $0.3785 (6 runs) | $0.2772 (6 runs) | none | none |
| all | $0.3785 (6 runs) | $0.2772 (6 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| flask/x034 | without | 2/2 | 11 [11–11] | 98 [98–98] | 2,626 [2,584–2,668] | 234,746 [233,372–236,119] | 19,671 [18,871–20,470] | $0.0760 [$0.0744–$0.0777] | 30.4 s [30.2 s–30.5 s] |
| flask/x034 | with | 2/2 | 7 [7–7] | 58 [58–58] | 1,785 [1,765–1,805] | 157,008 [152,753–161,262] | 18,789 [17,837–19,741] | $0.0623 [$0.0609–$0.0636] | 22.4 s [21.6 s–23.2 s] |
| flask/x035 | without | 2/2 | 11 [10–11] | 94 [90–98] | 2,753 [2,744–2,762] | 206,596 [192,066–221,125] | 16,542 [15,489–17,594] | $0.0676 [$0.0670–$0.0682] | 32.1 s [31.6 s–32.7 s] |
| flask/x035 | with | 2/2 | 4 [3–5] | 26 [26–26] | 1,110 [1,086–1,133] | 49,760 [49,668–49,851] | 10,929 [10,811–11,046] | $0.0324 [$0.0320–$0.0328] | 14.7 s [14.2 s–15.2 s] |
| flask/x036 | without | 2/2 | 3 [3–3] | 34 [34–34] | 1,102 [1,085–1,118] | 46,133 [46,103–46,163] | 17,735 [17,722–17,747] | $0.0456 [$0.0456–$0.0457] | 15.7 s [15.7 s–15.7 s] |
| flask/x036 | with | 2/2 | 5 [3–7] | 46 [26–66] | 1,349 [1,012–1,685] | 103,569 [49,614–157,523] | 13,403 [10,053–16,752] | $0.0440 [$0.0436–$0.0443] | 19.2 s [15.5 s–23.0 s] |

