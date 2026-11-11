# Agent-level A/B — measured tool calls, tokens and cost

**claude-code 2.1.322 (Claude Code) · claude-haiku-5-5 · 2026-11-11 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap index strategy + 7-tool core MCP profile (the docs' setup for an agent that calls the tools).
- Both arms: the same prompt, model, tool allowlist (Read, Grep, Glob, Bash), per-run budget cap $0.6 and timeout 420 s; run in a clean copy of the commit pinned in `benchmarks/xrepo-repos.json`.
- Questions: the task id(s) h024, h025, h026, h027, h028, h029, h030 of `benchmarks/tasks/retrieval-xrepo.jsonl`. Pass = hit@5 on the repository-relative paths the answer names.
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
| sigmap-src | 7 | 11/14 | 12/14 | 0 / 0 |
| all | 7 | 11/14 | 12/14 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 7. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −16% | −14% | fewer in every repetition |
| Input tokens (uncached) | −17% | −11% | fewer in every repetition |
| Output tokens | −11% | −22% | fewer in every repetition |
| Cache-read tokens | −8% | +14% | mixed |
| Cache-write tokens | +5% | −3% | mixed |
| Total tokens (derived) | −6% | +10% | mixed |
| Cost | −1% | −5% | fewer in every repetition |
| Wall time | −9% | −12% | fewer in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −17% [−61%, +65%] † | +8% [−35%, +92%] † | mixed |
| Input tokens (uncached) | −17% [−42%, +22%] † | −9% [−32%, +25%] † | fewer in every repetition, within the noise |
| Output tokens | −11% [−42%, +36%] † | −20% [−39%, +4%] † | fewer in every repetition, within the noise |
| Cache-read tokens | −4% [−37%, +56%] † | +16% [−21%, +71%] † | mixed |
| Cache-write tokens | +8% [−13%, +37%] † | −4% [−32%, +30%] † | mixed |
| Total tokens (derived) | −3% [−34%, +52%] † | +10% [−23%, +59%] † | mixed |
| Cost | 0% [−25%, +39%] † | −5% [−32%, +27%] † | mixed |
| Wall time | −8% [−29%, +24%] † | −11% [−24%, +3%] † | fewer in every repetition, within the noise |

### Outcome (hit@5), by repetition

Per paired task: **better** = the SigMap arm named the file and the other did not; **worse** = the reverse; **tie** = both found it or both missed. Localisation only.

| repetition | paired tasks | better | worse | tie |
| --- | ---: | ---: | ---: | ---: |
| R1 | 7 | 1 | 0 | 6 |
| R2 | 7 | 1 | 1 | 5 |
| all | 14 | 2 | 1 | 11 |

## Tool calls

Provenance: agent-reported (main-thread tool_use blocks). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 4 | 4 | −2 | 4 / 0 / 3 |
| all | 4 | 4 | −2 | 4 / 0 / 3 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 6 | 6 | 0 | 3 / 2 / 2 |
| all | 6 | 6 | 0 | 3 / 2 / 2 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 1,143 | 841 | −303 | 5 / 0 / 2 |
| all | 1,143 | 841 | −303 | 5 / 0 / 2 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 27,907 | 37,096 | +8,542 | 3 / 0 / 4 |
| all | 27,907 | 37,096 | +8,542 | 3 / 0 / 4 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 8,425 | 7,255 | +1,251 | 3 / 0 / 4 |
| all | 8,425 | 7,255 | +1,251 | 3 / 0 / 4 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 35,327 | 45,827 | +9,756 | 3 / 0 / 4 |
| all | 35,327 | 45,827 | +9,756 | 3 / 0 / 4 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | $0.0026 | $0.0023 | +$0.0002 | 2 / 0 / 5 |
| all | $0.0026 | $0.0023 | +$0.0002 | 2 / 0 / 5 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 10.3 s | 9.6 s | −983 ms | 4 / 0 / 3 |
| all | 10.3 s | 9.6 s | −983 ms | 4 / 0 / 3 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | $0.0441 (14 runs) | $0.0428 (14 runs) | none | none |
| all | $0.0441 (14 runs) | $0.0428 (14 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| sigmap-src/h024 | without | 1/2 | 12 [11–12] | 20 [18–22] | 3,112 [2,979–3,245] | 177,393 [127,023–227,763] | 19,415 [14,750–24,080] | $0.0072 [$0.0058–$0.0086] | 24.9 s [23.5 s–26.2 s] |
| sigmap-src/h024 | with | 0/2 | 8 [7–8] | 17 [16–18] | 2,534 [2,479–2,589] | 172,250 [156,140–188,360] | 21,969 [20,687–23,251] | $0.0074 [$0.0069–$0.0078] | 21.3 s [20.3 s–22.2 s] |
| sigmap-src/h025 | without | 1/2 | 6 [6–6] | 11 [10–12] | 1,663 [1,504–1,821] | 63,381 [62,531–64,231] | 12,244 [8,763–15,725] | $0.0039 [$0.0031–$0.0047] | 15.6 s [15.1 s–16.0 s] |
| sigmap-src/h025 | with | 2/2 | 4 [3–4] | 6 [6–6] | 841 [775–906] | 35,727 [35,428–36,025] | 6,905 [6,206–7,604] | $0.0022 [$0.0020–$0.0023] | 10.0 s [9.8 s–10.3 s] |
| sigmap-src/h026 | without | 2/2 | 3 [2–3] | 6 [6–6] | 817 [773–861] | 27,235 [27,110–27,360] | 4,443 [4,426–4,459] | $0.0016 [$0.0015–$0.0016] | 9.2 s [9.1 s–9.2 s] |
| sigmap-src/h026 | with | 2/2 | 6 [4–7] | 9 [6–12] | 1,432 [1,063–1,800] | 57,966 [35,670–80,261] | 7,255 [5,927–8,583] | $0.0027 [$0.0021–$0.0034] | 13.3 s [10.3 s–16.4 s] |
| sigmap-src/h027 | without | 1/2 | 5 [4–6] | 10 [8–12] | 1,444 [1,082–1,805] | 53,198 [39,319–67,076] | 8,425 [8,056–8,793] | $0.0029 [$0.0027–$0.0032] | 13.5 s [11.2 s–15.8 s] |
| sigmap-src/h027 | with | 2/2 | 2 [2–2] | 5 [4–6] | 756 [740–771] | 28,051 [21,456–34,646] | 6,458 [5,812–7,103] | $0.0020 [$0.0019–$0.0020] | 8.8 s [8.0 s–9.5 s] |
| sigmap-src/h028 | without | 2/2 | 2 [2–2] | 6 [6–6] | 811 [750–871] | 27,366 [27,361–27,371] | 5,479 [5,459–5,499] | $0.0018 [$0.0017–$0.0018] | 9.0 s [8.8 s–9.2 s] |
| sigmap-src/h028 | with | 2/2 | 4 [3–4] | 6 [6–6] | 773 [733–813] | 35,908 [35,548–36,268] | 6,730 [6,200–7,260] | $0.0021 [$0.0020–$0.0022] | 9.1 s [8.8 s–9.4 s] |
| sigmap-src/h029 | without | 2/2 | 4 [1–7] | 6 [4–8] | 1,143 [869–1,417] | 27,907 [16,784–39,030] | 6,076 [5,983–6,168] | $0.0021 [$0.0018–$0.0023] | 10.3 s [9.5 s–11.2 s] |
| sigmap-src/h029 | with | 2/2 | 3 [1–4] | 6 [4–8] | 840 [642–1,038] | 37,612 [20,834–54,389] | 7,370 [5,302–9,437] | $0.0023 [$0.0016–$0.0030] | 9.3 s [7.5 s–11.2 s] |
| sigmap-src/h030 | without | 2/2 | 2 [1–2] | 5 [4–6] | 798 [749–846] | 24,942 [16,790–33,093] | 9,583 [9,066–10,099] | $0.0026 [$0.0024–$0.0027] | 8.7 s [8.5 s–8.8 s] |
| sigmap-src/h030 | with | 2/2 | 3 [1–5] | 6 [4–8] | 985 [570–1,399] | 37,096 [21,474–52,717] | 9,579 [6,621–12,537] | $0.0028 [$0.0018–$0.0037] | 9.6 s [7.1 s–12.1 s] |

