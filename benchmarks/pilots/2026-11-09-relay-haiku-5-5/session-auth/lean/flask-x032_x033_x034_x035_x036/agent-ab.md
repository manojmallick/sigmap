# Agent-level A/B — measured tool calls, tokens and cost

**claude-code 2.1.321 (Claude Code) · claude-haiku-5-5 · 2026-11-09 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap lean: 7-tool core MCP profile + a three-line section.
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
| Tool calls | +69% | +39% | more in every repetition |
| Input tokens (uncached) | +6% | +24% | more in every repetition |
| Output tokens | +22% | +22% | more in every repetition |
| Cache-read tokens | +24% | +54% | more in every repetition |
| Cache-write tokens | +15% | +15% | more in every repetition |
| Total tokens (derived) | +22% | +46% | more in every repetition |
| Cost | +18% | +22% | more in every repetition |
| Wall time | +11% | +23% | more in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | +72% [+36%, +113%] | +40% [+24%, +68%] | more in every repetition, outside the noise |
| Input tokens (uncached) | +5% [0%, +14%] † | +24% [+11%, +33%] | more in every repetition, within the noise |
| Output tokens | +23% [+12%, +44%] | +20% [+14%, +29%] | more in every repetition, outside the noise |
| Cache-read tokens | +23% [+13%, +38%] | +55% [+32%, +73%] | more in every repetition, outside the noise |
| Cache-write tokens | +15% [+11%, +22%] | +15% [+11%, +23%] | more in every repetition, outside the noise |
| Total tokens (derived) | +22% [+13%, +35%] | +46% [+28%, +59%] | more in every repetition, outside the noise |
| Cost | +18% [+12%, +26%] | +22% [+15%, +30%] | more in every repetition, outside the noise |
| Wall time | +11% [+4%, +17%] | +23% [+20%, +26%] | more in every repetition, outside the noise |

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
| flask | 3 | 6 | +2 | 0 / 0 / 5 |
| all | 3 | 6 | +2 | 0 / 0 / 5 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | 7 | 8 | +1 | 0 / 1 / 4 |
| all | 7 | 8 | +1 | 0 / 1 / 4 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | 941 | 1,097 | +240 | 0 / 0 / 5 |
| all | 941 | 1,097 | +240 | 0 / 0 / 5 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | 33,810 | 47,602 | +12,646 | 0 / 0 / 5 |
| all | 33,810 | 47,602 | +12,646 | 0 / 0 / 5 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | 7,609 | 8,581 | +1,010 | 0 / 0 / 5 |
| all | 7,609 | 8,581 | +1,010 | 0 / 0 / 5 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | 42,215 | 61,532 | +13,787 | 0 / 0 / 5 |
| all | 42,215 | 61,532 | +13,787 | 0 / 0 / 5 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | $0.0023 | $0.0027 | +$0.0005 | 0 / 0 / 5 |
| all | $0.0023 | $0.0027 | +$0.0005 | 0 / 0 / 5 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | 10.5 s | 12.4 s | +1.9 s | 0 / 0 / 5 |
| all | 10.5 s | 12.4 s | +1.9 s | 0 / 0 / 5 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| flask | $0.0244 (10 runs) | $0.0292 (10 runs) | none | none |
| all | $0.0244 (10 runs) | $0.0292 (10 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| flask/x032 | without | 2/2 | 5 [5–5] | 7 [6–8] | 1,772 [1,760–1,784] | 35,938 [28,345–43,530] | 10,382 [10,170–10,594] | $0.0033 [$0.0032–$0.0034] | 14.2 s [13.9 s–14.4 s] |
| flask/x032 | with | 2/2 | 6 [6–6] | 8 [8–8] | 2,195 [2,162–2,227] | 47,602 [46,768–48,435] | 11,728 [11,386–12,069] | $0.0039 [$0.0039–$0.0040] | 17.6 s [17.3 s–17.8 s] |
| flask/x033 | without | 2/2 | 3 [3–3] | 6 [6–6] | 941 [937–944] | 27,949 [27,657–28,240] | 7,969 [7,629–8,308] | $0.0023 [$0.0023–$0.0024] | 10.3 s [10.1 s–10.5 s] |
| flask/x033 | with | 2/2 | 4 [4–4] | 7 [6–8] | 1,071 [1,052–1,089] | 40,595 [33,701–47,488] | 8,979 [8,744–9,213] | $0.0027 [$0.0027–$0.0028] | 11.3 s [10.6 s–12.1 s] |
| flask/x034 | without | 2/2 | 3 [3–3] | 8 [8–8] | 1,106 [993–1,218] | 40,227 [39,978–40,476] | 6,646 [6,190–7,101] | $0.0023 [$0.0021–$0.0024] | 12.8 s [12.1 s–13.5 s] |
| flask/x034 | with | 2/2 | 6 [6–6] | 9 [8–10] | 1,346 [1,337–1,354] | 54,648 [46,405–62,891] | 8,581 [8,069–9,093] | $0.0029 [$0.0029–$0.0030] | 14.5 s [14.3 s–14.6 s] |
| flask/x035 | without | 2/2 | 4 [3–4] | 7 [6–8] | 808 [717–898] | 33,628 [27,393–39,862] | 6,184 [5,964–6,404] | $0.0020 [$0.0019–$0.0020] | 10.3 s [9.6 s–11.0 s] |
| flask/x035 | with | 2/2 | 6 [5–7] | 9 [8–10] | 1,097 [1,003–1,190] | 54,685 [48,579–60,790] | 7,045 [6,613–7,477] | $0.0025 [$0.0023–$0.0027] | 12.3 s [11.5 s–13.0 s] |
| flask/x036 | without | 2/2 | 3 [2–3] | 7 [6–8] | 789 [682–895] | 33,810 [26,955–40,665] | 7,609 [7,137–8,081] | $0.0023 [$0.0022–$0.0023] | 10.5 s [9.3 s–11.7 s] |
| flask/x036 | with | 2/2 | 4 [4–4] | 7 [6–8] | 902 [777–1,027] | 39,393 [32,655–46,130] | 8,324 [7,862–8,786] | $0.0025 [$0.0025–$0.0025] | 12.4 s [10.2 s–14.6 s] |

