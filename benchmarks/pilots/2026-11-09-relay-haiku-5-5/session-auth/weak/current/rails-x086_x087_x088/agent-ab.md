# Agent-level A/B — measured tool calls, tokens and cost

**claude-code 2.1.322 (Claude Code) · claude-haiku-4-5 · 2026-11-10 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap generated context + MCP server.
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
| Tool calls | −12% | +24% | mixed |
| Input tokens (uncached) | −11% | +37% | mixed |
| Output tokens | −16% | +14% | mixed |
| Cache-read tokens | −23% | +90% | mixed |
| Cache-write tokens | −38% | +10% | mixed |
| Total tokens (derived) | −24% | +81% | mixed |
| Cost | −30% | +30% | mixed |
| Wall time | −9% | +15% | mixed |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −21% [−54%, +19%] † | +23% [0%, +50%] † | mixed |
| Input tokens (uncached) | −22% [−68%, +28%] † | +33% [−29%, +124%] † | mixed |
| Output tokens | −23% [−50%, +7%] † | +15% [−9%, +39%] † | mixed |
| Cache-read tokens | −27% [−70%, +74%] † | +89% [−15%, +249%] † | mixed |
| Cache-write tokens | −34% [−58%, −11%] | +13% [−17%, +44%] † | mixed |
| Total tokens (derived) | −26% [−66%, +59%] † | +79% [−15%, +226%] † | mixed |
| Cost | −27% [−37%, −2%] | +31% [−15%, +92%] † | mixed |
| Wall time | −14% [−44%, +10%] † | +15% [−9%, +42%] † | mixed |

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
| rails | 12 | 11 | −1 | 2 / 0 / 1 |
| all | 12 | 11 | −1 | 2 / 0 / 1 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | 70 | 66 | −4 | 2 / 0 / 1 |
| all | 70 | 66 | −4 | 2 / 0 / 1 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | 2,814 | 2,461 | −353 | 2 / 0 / 1 |
| all | 2,814 | 2,461 | −353 | 2 / 0 / 1 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | 149,985 | 179,983 | +29,999 | 1 / 0 / 2 |
| all | 149,985 | 179,983 | +29,999 | 1 / 0 / 2 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | 18,206 | 14,769 | −3,438 | 3 / 0 / 0 |
| all | 18,206 | 14,769 | −3,438 | 3 / 0 / 0 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | 171,074 | 197,278 | +26,204 | 1 / 0 / 2 |
| all | 171,074 | 197,278 | +26,204 | 1 / 0 / 2 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | $0.0655 | $0.0599 | −$0.0085 | 3 / 0 / 0 |
| all | $0.0655 | $0.0599 | −$0.0085 | 3 / 0 / 0 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | 32.3 s | 31.3 s | −1.0 s | 2 / 0 / 1 |
| all | 32.3 s | 31.3 s | −1.0 s | 2 / 0 / 1 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| rails | $0.4531 (6 runs) | $0.4030 (6 runs) | none | none |
| all | $0.4531 (6 runs) | $0.4030 (6 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| rails/x086 | without | 2/2 | 9 [4–13] | 70 [34–106] | 2,034 [1,311–2,756] | 143,390 [52,218–234,562] | 14,559 [8,849–20,268] | $0.0537 [$0.0295–$0.0779] | 26.3 s [18.4 s–34.2 s] |
| rails/x086 | with | 2/2 | 6 [5–6] | 42 [34–50] | 1,471 [1,384–1,557] | 93,870 [69,533–118,207] | 14,220 [10,490–17,950] | $0.0452 [$0.0406–$0.0498] | 20.2 s [19.0 s–21.5 s] |
| rails/x087 | without | 2/2 | 13 [10–16] | 98 [58–138] | 3,110 [2,350–3,870] | 376,645 [107,787–645,503] | 26,995 [11,165–42,824] | $0.1073 [$0.0449–$0.1697] | 35.4 s [27.0 s–43.9 s] |
| rails/x087 | with | 2/2 | 17 [15–19] | 146 [130–162] | 3,713 [3,275–4,151] | 436,182 [376,681–495,683] | 17,033 [16,083–17,982] | $0.0964 [$0.0863–$0.1064] | 43.2 s [38.2 s–48.3 s] |
| rails/x088 | without | 2/2 | 12 [11–12] | 70 [58–82] | 2,814 [2,785–2,842] | 149,985 [118,693–181,276] | 18,206 [17,364–19,048] | $0.0655 [$0.0639–$0.0671] | 32.3 s [31.8 s–32.9 s] |
| rails/x088 | with | 2/2 | 11 [11–11] | 66 [58–74] | 2,461 [2,329–2,592] | 179,983 [153,764–206,202] | 14,769 [14,486–15,051] | $0.0599 [$0.0574–$0.0624] | 31.3 s [30.0 s–32.6 s] |

