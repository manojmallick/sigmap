# Agent-level A/B — measured tool calls, tokens and cost

**claude-code 2.1.321 (Claude Code) · claude-haiku-5-5 · 2026-11-09 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap generated context + MCP server.
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
| Tool calls | −18% | 0% | mixed |
| Input tokens (uncached) | 0% | +21% | mixed |
| Output tokens | −12% | +10% | mixed |
| Cache-read tokens | +66% | +92% | more in every repetition |
| Cache-write tokens | +22% | +2% | more in every repetition |
| Total tokens (derived) | +56% | +75% | more in every repetition |
| Cost | +21% | +18% | more in every repetition |
| Wall time | −4% | +14% | mixed |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −26% [−51%, +12%] † | +12% [−37%, +98%] † | mixed |
| Input tokens (uncached) | −7% [−34%, +34%] † | +22% [+6%, +40%] | mixed |
| Output tokens | −16% [−39%, +13%] † | +9% [+1%, +18%] | mixed |
| Cache-read tokens | +46% [−6%, +125%] † | +93% [+66%, +123%] | more in every repetition, within the noise |
| Cache-write tokens | +17% [+1%, +35%] | +3% [−25%, +42%] † | more in every repetition, within the noise |
| Total tokens (derived) | +39% [−4%, +103%] † | +77% [+50%, +107%] | more in every repetition, within the noise |
| Cost | +15% [−6%, +38%] † | +19% [−2%, +49%] † | more in every repetition, within the noise |
| Wall time | −5% [−23%, +15%] † | +12% [+3%, +24%] | mixed |

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
| rails | 3 | 4 | +1 | 2 / 0 / 3 |
| all | 3 | 4 | +1 | 2 / 0 / 3 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | 7 | 6 | 0 | 2 / 1 / 2 |
| all | 7 | 6 | 0 | 2 / 1 / 2 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | 1,045 | 1,120 | +48 | 2 / 0 / 3 |
| all | 1,045 | 1,120 | +48 | 2 / 0 / 3 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | 41,367 | 53,433 | +20,491 | 0 / 0 / 5 |
| all | 41,367 | 53,433 | +20,491 | 0 / 0 / 5 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | 6,898 | 10,079 | +175 | 2 / 0 / 3 |
| all | 6,898 | 10,079 | +175 | 2 / 0 / 3 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | 49,205 | 62,942 | +19,924 | 0 / 0 / 5 |
| all | 49,205 | 62,942 | +19,924 | 0 / 0 / 5 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | $0.0023 | $0.0029 | +$0.0003 | 2 / 0 / 3 |
| all | $0.0023 | $0.0029 | +$0.0003 | 2 / 0 / 3 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | 11.1 s | 11.1 s | +419 ms | 2 / 0 / 3 |
| all | 11.1 s | 11.1 s | +419 ms | 2 / 0 / 3 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| rails | $0.0270 (10 runs) | $0.0323 (10 runs) | none | none |
| all | $0.0270 (10 runs) | $0.0323 (10 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| rails/x084 | without | 2/2 | 2 [1–3] | 5 [4–6] | 740 [724–755] | 27,416 [22,504–32,327] | 6,643 [3,770–9,516] | $0.0020 [$0.0014–$0.0026] | 9.2 s [8.8 s–9.5 s] |
| rails/x084 | with | 2/2 | 3 [2–3] | 6 [6–6] | 788 [738–837] | 52,069 [48,088–56,050] | 10,079 [6,835–13,323] | $0.0029 [$0.0023–$0.0035] | 10.4 s [10.0 s–10.8 s] |
| rails/x085 | without | 2/2 | 3 [3–3] | 6 [6–6] | 1,045 [1,025–1,065] | 34,007 [32,289–35,725] | 6,207 [4,783–7,631] | $0.0021 [$0.0018–$0.0024] | 10.7 s [10.6 s–10.8 s] |
| rails/x085 | with | 2/2 | 4 [3–4] | 6 [6–6] | 1,120 [975–1,265] | 53,400 [51,795–55,005] | 6,382 [4,751–8,013] | $0.0024 [$0.0020–$0.0028] | 11.1 s [10.8 s–11.5 s] |
| rails/x086 | without | 2/2 | 3 [2–3] | 7 [6–8] | 934 [725–1,142] | 41,367 [36,911–45,822] | 6,898 [5,971–7,825] | $0.0023 [$0.0019–$0.0026] | 11.1 s [9.6 s–12.6 s] |
| rails/x086 | with | 2/2 | 2 [1–3] | 6 [4–8] | 718 [561–874] | 53,433 [31,982–74,884] | 5,496 [3,974–7,018] | $0.0020 [$0.0020–$0.0020] | 9.8 s [8.7 s–11.0 s] |
| rails/x087 | without | 2/2 | 4 [3–5] | 7 [6–8] | 1,851 [1,604–2,097] | 46,559 [38,974–54,143] | 11,292 [8,075–14,509] | $0.0036 [$0.0028–$0.0045] | 15.7 s [14.9 s–16.5 s] |
| rails/x087 | with | 2/2 | 5 [3–6] | 11 [8–14] | 2,137 [1,914–2,359] | 123,111 [81,939–164,282] | 15,264 [10,736–19,791] | $0.0054 [$0.0039–$0.0068] | 20.0 s [19.9 s–20.1 s] |
| rails/x088 | without | 2/2 | 7 [5–8] | 8 [6–10] | 1,616 [1,217–2,015] | 49,098 [36,015–62,180] | 11,107 [11,059–11,154] | $0.0035 [$0.0032–$0.0038] | 14.4 s [12.2 s–16.6 s] |
| rails/x088 | with | 2/2 | 4 [2–5] | 7 [6–8] | 1,269 [1,246–1,292] | 69,589 [58,500–80,677] | 10,887 [8,161–13,613] | $0.0035 [$0.0028–$0.0042] | 12.5 s [12.4 s–12.6 s] |

