# Agent-level A/B — measured tool calls, tokens and cost

**claude-code 2.1.322 (Claude Code) · claude-haiku-5-5 · 2026-11-11 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap ranked the question BEFORE the first turn (what a prompt hook would inject): the five likeliest files with their signatures and line anchors after the question in the user turn, + the sigmap CLI; no MCP server, no standing section, no extra tool call.
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
| Tool calls | −19% | +36% | mixed |
| Input tokens (uncached) | −12% | +7% | mixed |
| Output tokens | +19% | +18% | more in every repetition |
| Cache-read tokens | 0% | +29% | more in every repetition |
| Cache-write tokens | +28% | −21% | mixed |
| Total tokens (derived) | +5% | +19% | more in every repetition |
| Cost | +22% | −7% | mixed |
| Wall time | +9% | +11% | more in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −21% [−71%, +106%] † | +43% [−24%, +186%] † | mixed |
| Input tokens (uncached) | −12% [−47%, +48%] † | +6% [−36%, +74%] † | mixed |
| Output tokens | +22% [−14%, +69%] † | +16% [−12%, +44%] † | more in every repetition, within the noise |
| Cache-read tokens | −1% [−51%, +100%] † | +34% [−29%, +153%] † | mixed |
| Cache-write tokens | +30% [+2%, +56%] | −20% [−37%, +5%] † | mixed |
| Total tokens (derived) | +6% [−41%, +88%] † | +22% [−29%, +110%] † | more in every repetition, within the noise |
| Cost | +23% [−6%, +59%] † | −5% [−29%, +23%] † | mixed |
| Wall time | +9% [−16%, +40%] † | +9% [−17%, +38%] † | more in every repetition, within the noise |

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
| gin | 4 | 4 | +1 | 2 / 0 / 3 |
| all | 4 | 4 | +1 | 2 / 0 / 3 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 7 | 6 | −1 | 3 / 0 / 2 |
| all | 7 | 6 | −1 | 3 / 0 / 2 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 1,178 | 1,100 | +281 | 2 / 0 / 3 |
| all | 1,178 | 1,100 | +281 | 2 / 0 / 3 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 33,589 | 36,170 | +2,581 | 1 / 0 / 4 |
| all | 33,589 | 36,170 | +2,581 | 1 / 0 / 4 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 6,782 | 7,100 | +521 | 2 / 0 / 3 |
| all | 6,782 | 7,100 | +521 | 2 / 0 / 3 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 40,075 | 44,357 | +4,282 | 1 / 0 / 4 |
| all | 40,075 | 44,357 | +4,282 | 1 / 0 / 4 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | $0.0020 | $0.0024 | +$0.0003 | 1 / 0 / 4 |
| all | $0.0020 | $0.0024 | +$0.0003 | 1 / 0 / 4 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 10.5 s | 10.4 s | +689 ms | 2 / 0 / 3 |
| all | 10.5 s | 10.4 s | +689 ms | 2 / 0 / 3 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| gin | $0.0244 (10 runs) | $0.0261 (10 runs) | none | none |
| all | $0.0244 (10 runs) | $0.0261 (10 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| gin/x001 | without | 2/2 | 4 [4–4] | 8 [8–8] | 1,197 [1,077–1,316] | 49,022 [47,918–50,126] | 11,910 [11,134–12,685] | $0.0035 [$0.0032–$0.0037] | 11.4 s [11.3 s–11.4 s] |
| gin/x001 | with | 2/2 | 2 [1–2] | 4 [4–4] | 993 [895–1,091] | 21,176 [19,275–23,076] | 8,525 [7,839–9,211] | $0.0024 [$0.0022–$0.0026] | 8.7 s [8.0 s–9.3 s] |
| gin/x002 | without | 2/2 | 1 [1–1] | 4 [4–4] | 806 [695–916] | 16,810 [16,810–16,810] | 6,579 [5,790–7,368] | $0.0019 [$0.0017–$0.0021] | 8.0 s [7.8 s–8.3 s] |
| gin/x002 | with | 2/2 | 4 [3–4] | 8 [8–8] | 1,363 [1,288–1,437] | 48,075 [47,366–48,784] | 7,100 [4,700–9,499] | $0.0026 [$0.0021–$0.0030] | 12.0 s [11.8 s–12.1 s] |
| gin/x003 | without | 2/2 | 2 [2–2] | 6 [6–6] | 709 [641–777] | 27,555 [27,478–27,631] | 6,782 [6,702–6,861] | $0.0020 [$0.0019–$0.0020] | 8.7 s [8.1 s–9.2 s] |
| gin/x003 | with | 2/2 | 3 [2–3] | 5 [4–6] | 990 [849–1,130] | 28,116 [22,812–33,420] | 6,457 [4,484–8,429] | $0.0021 [$0.0015–$0.0026] | 9.4 s [7.8 s–10.9 s] |
| gin/x004 | without | 2/2 | 4 [3–5] | 7 [6–8] | 1,262 [1,261–1,262] | 37,913 [28,491–47,334] | 9,300 [7,839–10,761] | $0.0029 [$0.0025–$0.0033] | 10.5 s [10.1 s–10.8 s] |
| gin/x004 | with | 2/2 | 5 [5–5] | 8 [8–8] | 1,651 [1,616–1,685] | 54,795 [51,869–57,720] | 11,485 [10,561–12,408] | $0.0037 [$0.0035–$0.0038] | 13.7 s [13.5 s–13.9 s] |
| gin/x005 | without | 2/2 | 4 [2–6] | 7 [4–10] | 1,178 [925–1,430] | 33,589 [16,748–50,430] | 5,302 [4,620–5,983] | $0.0020 [$0.0016–$0.0024] | 10.7 s [9.1 s–12.3 s] |
| gin/x005 | with | 2/2 | 4 [1–6] | 6 [4–8] | 1,100 [925–1,274] | 36,170 [19,359–52,981] | 7,081 [5,868–8,294] | $0.0023 [$0.0023–$0.0023] | 10.4 s [8.9 s–11.8 s] |

