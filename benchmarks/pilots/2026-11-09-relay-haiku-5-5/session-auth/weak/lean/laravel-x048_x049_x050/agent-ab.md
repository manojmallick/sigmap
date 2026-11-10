# Agent-level A/B — measured tool calls, tokens and cost

**claude-code 2.1.322 (Claude Code) · claude-haiku-4-5 · 2026-11-10 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap lean: 7-tool core MCP profile + a three-line section.
- Both arms: the same prompt, model, tool allowlist (Read, Grep, Glob, Bash), per-run budget cap $1 and timeout 420 s; run in a clean copy of the commit pinned in `benchmarks/xrepo-repos.json`.
- Questions: the task id(s) x048, x049, x050 of `benchmarks/tasks/retrieval-xrepo.jsonl`. Pass = hit@5 on the repository-relative paths the answer names.
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
| laravel | 3 | 6/6 | 6/6 | 0 / 0 |
| all | 3 | 6/6 | 6/6 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 3. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −2% | +2% | mixed |
| Input tokens (uncached) | −12% | −7% | fewer in every repetition |
| Output tokens | −9% | −4% | fewer in every repetition |
| Cache-read tokens | −16% | −5% | fewer in every repetition |
| Cache-write tokens | −10% | −17% | fewer in every repetition |
| Total tokens (derived) | −15% | −6% | fewer in every repetition |
| Cost | −12% | −11% | fewer in every repetition |
| Wall time | −5% | −8% | fewer in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −5% [−25%, +28%] † | 0% [−21%, +27%] † | fewer in every repetition, within the noise |
| Input tokens (uncached) | −16% [−38%, +26%] † | −10% [−39%, +18%] † | fewer in every repetition, within the noise |
| Output tokens | −10% [−19%, +8%] † | −7% [−19%, +9%] † | fewer in every repetition, within the noise |
| Cache-read tokens | −17% [−36%, +23%] † | −10% [−44%, +21%] † | fewer in every repetition, within the noise |
| Cache-write tokens | −16% [−37%, +17%] † | −18% [−34%, −1%] | fewer in every repetition, within the noise |
| Total tokens (derived) | −17% [−34%, +20%] † | −10% [−43%, +19%] † | fewer in every repetition, within the noise |
| Cost | −13% [−29%, +3%] † | −12% [−33%, +3%] † | fewer in every repetition, within the noise |
| Wall time | −5% [−12%, +2%] † | −10% [−19%, +5%] † | fewer in every repetition, within the noise |

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
| laravel | 16 | 15 | −1 | 2 / 0 / 1 |
| all | 16 | 15 | −1 | 2 / 0 / 1 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | 134 | 102 | −32 | 2 / 0 / 1 |
| all | 134 | 102 | −32 | 2 / 0 / 1 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | 3,182 | 2,803 | −379 | 2 / 0 / 1 |
| all | 3,182 | 2,803 | −379 | 2 / 0 / 1 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | 322,000 | 282,930 | −80,482 | 2 / 0 / 1 |
| all | 322,000 | 282,930 | −80,482 | 2 / 0 / 1 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | 18,634 | 13,784 | −3,148 | 2 / 0 / 1 |
| all | 18,634 | 13,784 | −3,148 | 2 / 0 / 1 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | 342,838 | 310,331 | −79,080 | 2 / 0 / 1 |
| all | 342,838 | 310,331 | −79,080 | 2 / 0 / 1 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | $0.0850 | $0.0873 | −$0.0070 | 2 / 0 / 1 |
| all | $0.0850 | $0.0873 | −$0.0070 | 2 / 0 / 1 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | 39.0 s | 33.0 s | −3.2 s | 2 / 0 / 1 |
| all | 39.0 s | 33.0 s | −3.2 s | 2 / 0 / 1 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| laravel | $0.5284 (6 runs) | $0.4689 (6 runs) | none | none |
| all | $0.5284 (6 runs) | $0.4689 (6 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| laravel/x048 | without | 2/2 | 15 [14–16] | 130 [122–138] | 3,182 [2,892–3,471] | 282,512 [266,826–298,197] | 18,634 [17,396–19,871] | $0.0816 [$0.0810–$0.0821] | 39.0 s [37.0 s–41.0 s] |
| laravel/x048 | with | 2/2 | 12 [11–12] | 90 [74–106] | 2,803 [2,648–2,957] | 184,013 [150,187–217,838] | 12,038 [10,961–13,115] | $0.0566 [$0.0546–$0.0586] | 33.0 s [30.0 s–36.0 s] |
| laravel/x049 | without | 2/2 | 17 [15–18] | 142 [130–154] | 3,764 [3,564–3,964] | 322,000 [284,327–359,672] | 16,932 [16,416–17,448] | $0.0850 [$0.0792–$0.0908] | 44.0 s [41.6 s–46.5 s] |
| laravel/x049 | with | 2/2 | 21 [19–23] | 174 [154–194] | 4,069 [3,868–4,269] | 392,030 [343,112–440,947] | 13,784 [13,765–13,803] | $0.0873 [$0.0813–$0.0932] | 45.5 s [43.7 s–47.2 s] |
| laravel/x050 | without | 2/2 | 16 [11–20] | 134 [98–170] | 3,143 [2,313–3,973] | 363,412 [226,276–500,548] | 22,722 [20,810–24,634] | $0.0976 [$0.0759–$0.1194] | 35.8 s [29.5 s–42.2 s] |
| laravel/x050 | with | 2/2 | 15 [11–18] | 102 [98–106] | 2,533 [1,867–3,199] | 282,930 [246,105–319,755] | 24,766 [20,605–28,927] | $0.0906 [$0.0753–$0.1059] | 32.6 s [25.2 s–40.1 s] |

