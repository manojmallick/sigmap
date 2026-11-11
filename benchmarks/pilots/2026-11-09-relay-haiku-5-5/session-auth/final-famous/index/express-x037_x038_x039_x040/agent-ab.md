# Agent-level A/B — measured tool calls, tokens and cost

**claude-code 2.1.322 (Claude Code) · claude-haiku-5-5 · 2026-11-11 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap index strategy + 7-tool core MCP profile (the docs' setup for an agent that calls the tools).
- Both arms: the same prompt, model, tool allowlist (Read, Grep, Glob, Bash), per-run budget cap $0.5 and timeout 420 s; run in a clean copy of the commit pinned in `benchmarks/xrepo-repos.json`.
- Questions: the task id(s) x037, x038, x039, x040 of `benchmarks/tasks/retrieval-xrepo.jsonl`. Pass = hit@5 on the repository-relative paths the answer names.
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
| express | 4 | 8/8 | 8/8 | 0 / 0 |
| all | 4 | 8/8 | 8/8 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 4. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −8% | +11% | mixed |
| Input tokens (uncached) | 0% | +22% | mixed |
| Output tokens | −4% | −4% | fewer in every repetition |
| Cache-read tokens | +27% | +65% | more in every repetition |
| Cache-write tokens | +31% | +14% | more in every repetition |
| Total tokens (derived) | +27% | +54% | more in every repetition |
| Cost | +23% | +17% | more in every repetition |
| Wall time | +14% | +2% | more in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −7% [−56%, +112%] † | +22% [−13%, +73%] † | mixed |
| Input tokens (uncached) | 0% [−26%, +36%] † | +22% [0%, +50%] † | mixed |
| Output tokens | −2% [−27%, +36%] † | −3% [−14%, +8%] † | fewer in every repetition, within the noise |
| Cache-read tokens | +24% [−22%, +85%] † | +66% [+31%, +111%] | more in every repetition, within the noise |
| Cache-write tokens | +30% [+17%, +50%] | +14% [0%, +30%] | more in every repetition, outside the noise |
| Total tokens (derived) | +26% [−13%, +73%] † | +55% [+25%, +92%] | more in every repetition, within the noise |
| Cost | +24% [+9%, +37%] | +17% [+6%, +30%] | more in every repetition, outside the noise |
| Wall time | +14% [+5%, +26%] | +2% [−6%, +12%] † | more in every repetition, within the noise |

### Outcome (hit@5), by repetition

Per paired task: **better** = the SigMap arm named the file and the other did not; **worse** = the reverse; **tie** = both found it or both missed. Localisation only.

| repetition | paired tasks | better | worse | tie |
| --- | ---: | ---: | ---: | ---: |
| R1 | 4 | 0 | 0 | 4 |
| R2 | 4 | 0 | 0 | 4 |
| all | 8 | 0 | 0 | 8 |

## Tool calls

Provenance: agent-reported (main-thread tool_use blocks). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | 3 | 3 | −0 | 2 / 1 / 1 |
| all | 3 | 3 | −0 | 2 / 1 / 1 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | 6 | 6 | +1 | 0 / 2 / 2 |
| all | 6 | 6 | +1 | 0 / 2 / 2 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | 817 | 758 | −59 | 3 / 0 / 1 |
| all | 817 | 758 | −59 | 3 / 0 / 1 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | 25,500 | 32,911 | +10,410 | 0 / 0 / 4 |
| all | 25,500 | 32,911 | +10,410 | 0 / 0 / 4 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | 5,056 | 6,299 | +1,217 | 0 / 0 / 4 |
| all | 5,056 | 6,299 | +1,217 | 0 / 0 / 4 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | 31,404 | 39,724 | +11,510 | 0 / 0 / 4 |
| all | 31,404 | 39,724 | +11,510 | 0 / 0 / 4 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | $0.0017 | $0.0020 | +$0.0003 | 0 / 0 / 4 |
| all | $0.0017 | $0.0020 | +$0.0003 | 0 / 0 / 4 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | 8.4 s | 8.9 s | +965 ms | 1 / 0 / 3 |
| all | 8.4 s | 8.9 s | +965 ms | 1 / 0 / 3 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| express | $0.0127 (8 runs) | $0.0153 (8 runs) | none | none |
| all | $0.0127 (8 runs) | $0.0153 (8 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| express/x037 | without | 2/2 | 3 [2–3] | 5 [4–6] | 863 [816–910] | 22,829 [16,782–28,876] | 5,479 [4,183–6,774] | $0.0018 [$0.0015–$0.0021] | 8.8 s [8.4 s–9.2 s] |
| express/x037 | with | 2/2 | 2 [1–3] | 5 [4–6] | 756 [736–775] | 27,081 [18,653–35,508] | 6,471 [5,274–7,667] | $0.0019 [$0.0018–$0.0021] | 9.7 s [8.8 s–10.6 s] |
| express/x038 | without | 2/2 | 4 [4–4] | 6 [6–6] | 867 [730–1,003] | 28,229 [27,775–28,683] | 5,427 [4,971–5,883] | $0.0018 [$0.0016–$0.0020] | 8.9 s [8.6 s–9.2 s] |
| express/x038 | with | 2/2 | 3 [3–3] | 6 [6–6] | 673 [668–677] | 37,386 [35,908–38,863] | 7,072 [4,753–9,391] | $0.0021 [$0.0016–$0.0026] | 8.6 s [7.8 s–9.5 s] |
| express/x039 | without | 2/2 | 1 [1–1] | 4 [4–4] | 584 [557–610] | 16,773 [16,772–16,774] | 3,665 [3,516–3,813] | $0.0012 [$0.0012–$0.0012] | 7.1 s [6.8 s–7.4 s] |
| express/x039 | with | 2/2 | 3 [2–3] | 5 [4–6] | 777 [696–857] | 28,437 [22,100–34,773] | 4,219 [3,704–4,734] | $0.0015 [$0.0013–$0.0017] | 8.1 s [7.2 s–9.0 s] |
| express/x040 | without | 2/2 | 3 [2–4] | 6 [4–8] | 770 [651–889] | 28,172 [16,784–39,559] | 4,685 [3,776–5,594] | $0.0016 [$0.0012–$0.0020] | 8.1 s [7.1 s–9.2 s] |
| express/x040 | with | 2/2 | 3 [2–4] | 7 [6–8] | 760 [671–849] | 43,662 [35,441–51,883] | 6,127 [5,093–7,161] | $0.0020 [$0.0017–$0.0024] | 9.1 s [8.3 s–9.9 s] |

