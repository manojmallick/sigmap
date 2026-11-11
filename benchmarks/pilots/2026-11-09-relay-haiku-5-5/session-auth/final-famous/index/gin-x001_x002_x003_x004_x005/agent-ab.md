# Agent-level A/B — measured tool calls, tokens and cost

**claude-code 2.1.322 (Claude Code) · claude-haiku-5-5 · 2026-11-11 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap index strategy + 7-tool core MCP profile (the docs' setup for an agent that calls the tools).
- Both arms: the same prompt, model, tool allowlist (Read, Grep, Glob, Bash), per-run budget cap $0.5 and timeout 420 s; run in a clean copy of the commit pinned in `benchmarks/xrepo-repos.json`.
- Questions: the task id(s) x001, x002, x003, x004, x005 of `benchmarks/tasks/retrieval-xrepo.jsonl`. Pass = hit@5 on the repository-relative paths the answer names.
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
| gin | 5 | 10/10 | 10/10 | 0 / 0 |
| all | 5 | 10/10 | 10/10 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 5. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | +20% | +5% | more in every repetition |
| Input tokens (uncached) | −6% | +6% | mixed |
| Output tokens | +9% | +4% | more in every repetition |
| Cache-read tokens | +13% | +32% | more in every repetition |
| Cache-write tokens | +12% | −20% | mixed |
| Total tokens (derived) | +13% | +22% | more in every repetition |
| Cost | +11% | −7% | mixed |
| Wall time | +9% | +2% | more in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | +30% [0%, +102%] † | −11% [−53%, +38%] † | mixed |
| Input tokens (uncached) | −6% [−25%, +20%] † | +5% [−18%, +33%] † | mixed |
| Output tokens | +10% [+4%, +17%] | +1% [−17%, +19%] † | more in every repetition, within the noise |
| Cache-read tokens | +13% [−21%, +62%] † | +30% [−6%, +78%] † | more in every repetition, within the noise |
| Cache-write tokens | +13% [−4%, +30%] † | −21% [−37%, 0%] | mixed |
| Total tokens (derived) | +14% [−11%, +46%] † | +19% [−12%, +57%] † | more in every repetition, within the noise |
| Cost | +13% [+1%, +21%] | −9% [−28%, +9%] † | mixed |
| Wall time | +9% [+4%, +14%] | 0% [−8%, +9%] † | more in every repetition, within the noise |

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
| gin | 3 | 3 | +1 | 1 / 1 / 3 |
| all | 3 | 3 | +1 | 1 / 1 / 3 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 7 | 7 | 0 | 1 / 3 / 1 |
| all | 7 | 7 | 0 | 1 / 3 / 1 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 944 | 1,007 | +63 | 1 / 0 / 4 |
| all | 944 | 1,007 | +63 | 1 / 0 / 4 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 34,352 | 43,925 | +9,573 | 1 / 0 / 4 |
| all | 34,352 | 43,925 | +9,573 | 1 / 0 / 4 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 7,047 | 7,509 | −383 | 3 / 0 / 2 |
| all | 7,047 | 7,509 | −383 | 3 / 0 / 2 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 42,208 | 52,384 | +10,177 | 1 / 0 / 4 |
| all | 42,208 | 52,384 | +10,177 | 1 / 0 / 4 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | $0.0023 | $0.0024 | +$0.0001 | 2 / 0 / 3 |
| all | $0.0023 | $0.0024 | +$0.0001 | 2 / 0 / 3 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 9.8 s | 10.3 s | +503 ms | 1 / 0 / 4 |
| all | 9.8 s | 10.3 s | +503 ms | 1 / 0 / 4 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| gin | $0.0237 (10 runs) | $0.0241 (10 runs) | none | none |
| all | $0.0237 (10 runs) | $0.0241 (10 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| gin/x001 | without | 2/2 | 3 [2–4] | 6 [6–6] | 887 [744–1,029] | 30,746 [30,664–30,827] | 8,072 [7,692–8,452] | $0.0024 [$0.0022–$0.0025] | 8.8 s [8.4 s–9.3 s] |
| gin/x001 | with | 2/2 | 2 [1–2] | 4 [4–4] | 771 [740–802] | 20,537 [18,762–22,312] | 7,689 [4,475–10,903] | $0.0021 [$0.0015–$0.0028] | 8.3 s [8.1 s–8.5 s] |
| gin/x002 | without | 2/2 | 2 [1–2] | 4 [4–4] | 944 [860–1,028] | 16,811 [16,810–16,812] | 5,971 [5,762–6,179] | $0.0018 [$0.0018–$0.0018] | 9.3 s [8.7 s–9.9 s] |
| gin/x002 | with | 2/2 | 3 [3–3] | 6 [6–6] | 1,007 [979–1,034] | 36,055 [35,406–36,704] | 5,422 [4,479–6,364] | $0.0019 [$0.0018–$0.0021] | 9.8 s [9.7 s–9.9 s] |
| gin/x003 | without | 2/2 | 3 [2–3] | 7 [6–8] | 803 [777–828] | 34,352 [27,849–40,854] | 7,047 [7,000–7,093] | $0.0022 [$0.0021–$0.0022] | 9.8 s [9.6 s–10.0 s] |
| gin/x003 | with | 2/2 | 3 [2–3] | 7 [6–8] | 944 [867–1,021] | 43,925 [36,040–51,809] | 7,509 [6,967–8,050] | $0.0024 [$0.0022–$0.0026] | 10.3 s [9.6 s–11.1 s] |
| gin/x004 | without | 2/2 | 5 [4–5] | 8 [8–8] | 1,453 [1,430–1,475] | 45,476 [45,214–45,738] | 10,373 [10,084–10,662] | $0.0033 [$0.0032–$0.0033] | 11.8 s [11.6 s–12.0 s] |
| gin/x004 | with | 2/2 | 5 [5–5] | 8 [8–8] | 1,683 [1,472–1,893] | 51,230 [50,267–52,192] | 7,978 [6,908–9,048] | $0.0029 [$0.0028–$0.0031] | 13.6 s [13.4 s–13.8 s] |
| gin/x005 | without | 2/2 | 6 [5–6] | 8 [8–8] | 1,247 [1,047–1,446] | 40,003 [39,572–40,434] | 6,156 [5,668–6,644] | $0.0023 [$0.0021–$0.0025] | 10.8 s [10.1 s–11.4 s] |
| gin/x005 | with | 2/2 | 7 [5–9] | 8 [6–10] | 1,253 [1,109–1,397] | 53,013 [36,476–69,549] | 7,370 [7,206–7,534] | $0.0026 [$0.0024–$0.0029] | 11.1 s [10.3 s–11.9 s] |

