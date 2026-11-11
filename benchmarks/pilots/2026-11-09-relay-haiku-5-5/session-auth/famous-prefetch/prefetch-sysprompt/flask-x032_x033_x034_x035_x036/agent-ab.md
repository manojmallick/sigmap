# Agent-level A/B — measured tool calls, tokens and cost

**claude-code 2.1.322 (Claude Code) · claude-haiku-5-5 · 2026-11-11 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap ranked the question BEFORE the first turn (what a prompt hook would inject): the five likeliest files with their signatures and line anchors in the prompt, + the sigmap CLI; no MCP server, no standing section, no extra tool call.
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
| Tool calls | 0% | −24% | mixed |
| Input tokens (uncached) | −18% | −20% | fewer in every repetition |
| Output tokens | +7% | −2% | mixed |
| Cache-read tokens | −15% | −5% | fewer in every repetition |
| Cache-write tokens | +44% | −8% | mixed |
| Total tokens (derived) | −2% | −5% | fewer in every repetition |
| Cost | +28% | −6% | mixed |
| Wall time | +2% | −3% | mixed |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −13% [−54%, +52%] † | −21% [−50%, +32%] † | fewer in every repetition, within the noise |
| Input tokens (uncached) | −17% [−32%, 0%] † | −20% [−39%, 0%] † | fewer in every repetition, within the noise |
| Output tokens | 0% [−25%, +35%] † | −3% [−19%, +17%] † | mixed |
| Cache-read tokens | −13% [−32%, +11%] † | −5% [−34%, +27%] † | fewer in every repetition, within the noise |
| Cache-write tokens | +42% [+28%, +56%] | −11% [−25%, +11%] † | mixed |
| Total tokens (derived) | −2% [−20%, +21%] † | −7% [−31%, +21%] † | fewer in every repetition, within the noise |
| Cost | +26% [+11%, +43%] | −8% [−24%, +11%] † | mixed |
| Wall time | +2% [−14%, +21%] † | −4% [−14%, +5%] † | mixed |

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
| flask | 4 | 3 | −1 | 3 / 1 / 1 |
| all | 4 | 3 | −1 | 3 / 1 / 1 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | 6 | 5 | −2 | 3 / 2 / 0 |
| all | 6 | 5 | −2 | 3 / 2 / 0 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | 949 | 945 | +87 | 2 / 0 / 3 |
| all | 949 | 945 | +87 | 2 / 0 / 3 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | 28,376 | 26,681 | −8,497 | 3 / 0 / 2 |
| all | 28,376 | 26,681 | −8,497 | 3 / 0 / 2 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | 7,693 | 9,685 | +1,379 | 1 / 0 / 4 |
| all | 7,693 | 9,685 | +1,379 | 1 / 0 / 4 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | 41,168 | 37,113 | −6,967 | 3 / 0 / 2 |
| all | 41,168 | 37,113 | −6,967 | 3 / 0 / 2 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | $0.0023 | $0.0026 | +$0.0003 | 1 / 0 / 4 |
| all | $0.0023 | $0.0026 | +$0.0003 | 1 / 0 / 4 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | 10.3 s | 10.4 s | +765 ms | 2 / 0 / 3 |
| all | 10.3 s | 10.4 s | +765 ms | 2 / 0 / 3 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| flask | $0.0252 (10 runs) | $0.0280 (10 runs) | none | none |
| all | $0.0252 (10 runs) | $0.0280 (10 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| flask/x032 | without | 2/2 | 4 [3–5] | 6 [6–6] | 2,206 [1,865–2,546] | 28,376 [28,286–28,466] | 10,581 [10,280–10,881] | $0.0035 [$0.0033–$0.0037] | 15.1 s [14.2 s–16.1 s] |
| flask/x032 | with | 2/2 | 6 [5–6] | 6 [6–6] | 2,453 [2,401–2,504] | 32,764 [30,422–35,105] | 11,960 [8,502–15,417] | $0.0039 [$0.0033–$0.0046] | 16.2 s [16.0 s–16.3 s] |
| flask/x033 | without | 2/2 | 4 [3–4] | 6 [6–6] | 949 [937–960] | 28,151 [27,733–28,569] | 8,171 [7,960–8,381] | $0.0024 [$0.0024–$0.0024] | 9.9 s [9.5 s–10.2 s] |
| flask/x033 | with | 2/2 | 3 [3–3] | 6 [6–6] | 1,162 [1,125–1,199] | 34,369 [31,278–37,460] | 12,061 [10,319–13,803] | $0.0033 [$0.0030–$0.0036] | 10.6 s [10.6 s–10.7 s] |
| flask/x034 | without | 2/2 | 3 [2–4] | 6 [6–6] | 984 [851–1,117] | 27,668 [27,508–27,827] | 7,247 [6,542–7,952] | $0.0022 [$0.0020–$0.0024] | 10.3 s [10.0 s–10.5 s] |
| flask/x034 | with | 2/2 | 1 [1–1] | 4 [4–4] | 677 [653–700] | 19,004 [16,690–21,318] | 7,060 [4,750–9,370] | $0.0019 [$0.0015–$0.0024] | 8.5 s [8.1 s–8.9 s] |
| flask/x035 | without | 2/2 | 4 [3–5] | 7 [6–8] | 858 [780–935] | 34,111 [27,318–40,903] | 6,947 [6,709–7,185] | $0.0022 [$0.0021–$0.0022] | 9.4 s [8.7 s–10.1 s] |
| flask/x035 | with | 2/2 | 3 [2–4] | 5 [4–6] | 945 [721–1,168] | 25,614 [21,088–30,139] | 7,433 [5,110–9,755] | $0.0022 [$0.0016–$0.0028] | 10.4 s [8.7 s–12.1 s] |
| flask/x036 | without | 2/2 | 3 [1–4] | 7 [4–10] | 838 [611–1,065] | 35,542 [16,782–54,301] | 7,693 [7,099–8,286] | $0.0023 [$0.0019–$0.0027] | 11.0 s [8.1 s–13.8 s] |
| flask/x036 | with | 2/2 | 3 [2–3] | 5 [4–6] | 742 [732–752] | 26,681 [20,778–32,584] | 9,685 [7,230–12,139] | $0.0026 [$0.0020–$0.0031] | 9.5 s [8.1 s–10.9 s] |

