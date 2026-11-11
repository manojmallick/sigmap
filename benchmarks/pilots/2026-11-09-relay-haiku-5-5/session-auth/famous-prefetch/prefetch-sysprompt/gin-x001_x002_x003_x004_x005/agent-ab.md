# Agent-level A/B — measured tool calls, tokens and cost

**claude-code 2.1.322 (Claude Code) · claude-haiku-5-5 · 2026-11-11 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap ranked the question BEFORE the first turn (what a prompt hook would inject): the five likeliest files with their signatures and line anchors in the prompt, + the sigmap CLI; no MCP server, no standing section, no extra tool call.
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
| gin | 5 | 9/10 | 9/10 | 0 / 0 |
| all | 5 | 9/10 | 9/10 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 5. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −42% | −17% | fewer in every repetition |
| Input tokens (uncached) | −33% | −13% | fewer in every repetition |
| Output tokens | −29% | +7% | mixed |
| Cache-read tokens | −37% | +14% | mixed |
| Cache-write tokens | +27% | −3% | mixed |
| Total tokens (derived) | −25% | +11% | mixed |
| Cost | +4% | +2% | more in every repetition |
| Wall time | −22% | −4% | fewer in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −38% [−52%, −20%] | −12% [−46%, +44%] † | fewer in every repetition, within the noise |
| Input tokens (uncached) | −30% [−43%, −15%] | −13% [−39%, +25%] † | fewer in every repetition, within the noise |
| Output tokens | −26% [−37%, −14%] | +1% [−28%, +41%] † | mixed |
| Cache-read tokens | −32% [−46%, −13%] | +12% [−26%, +70%] † | mixed |
| Cache-write tokens | +28% [+15%, +43%] | −8% [−25%, +13%] † | mixed |
| Total tokens (derived) | −20% [−35%, −1%] | +8% [−24%, +52%] † | mixed |
| Cost | +7% [−5%, +19%] † | −4% [−19%, +19%] † | mixed |
| Wall time | −20% [−31%, −13%] | −5% [−24%, +18%] † | fewer in every repetition, within the noise |

### Outcome (hit@5), by repetition

Per paired task: **better** = the SigMap arm named the file and the other did not; **worse** = the reverse; **tie** = both found it or both missed. Localisation only.

| repetition | paired tasks | better | worse | tie |
| --- | ---: | ---: | ---: | ---: |
| R1 | 5 | 1 | 0 | 4 |
| R2 | 5 | 0 | 1 | 4 |
| all | 10 | 1 | 1 | 8 |

## Tool calls

Provenance: agent-reported (main-thread tool_use blocks). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 4 | 2 | −1 | 4 / 0 / 1 |
| all | 4 | 2 | −1 | 4 / 0 / 1 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 7 | 5 | −2 | 4 / 0 / 1 |
| all | 7 | 5 | −2 | 4 / 0 / 1 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 1,108 | 933 | −50 | 5 / 0 / 0 |
| all | 1,108 | 933 | −50 | 5 / 0 / 0 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 34,526 | 26,118 | −5,847 | 4 / 0 / 1 |
| all | 34,526 | 26,118 | −5,847 | 4 / 0 / 1 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 6,863 | 7,883 | +1,087 | 1 / 0 / 4 |
| all | 6,863 | 7,883 | +1,087 | 1 / 0 / 4 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 42,503 | 34,347 | −5,028 | 4 / 0 / 1 |
| all | 42,503 | 34,347 | −5,028 | 4 / 0 / 1 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | $0.0023 | $0.0022 | −$0.0000 | 3 / 0 / 2 |
| all | $0.0023 | $0.0022 | −$0.0000 | 3 / 0 / 2 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 11.5 s | 9.6 s | −1.7 s | 4 / 0 / 1 |
| all | 11.5 s | 9.6 s | −1.7 s | 4 / 0 / 1 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| gin | $0.0251 (10 runs) | $0.0259 (10 runs) | none | none |
| all | $0.0251 (10 runs) | $0.0259 (10 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| gin/x001 | without | 2/2 | 4 [3–4] | 7 [6–8] | 1,108 [936–1,279] | 34,526 [30,134–38,917] | 6,863 [5,338–8,388] | $0.0023 [$0.0021–$0.0024] | 11.1 s [10.1 s–12.1 s] |
| gin/x001 | with | 2/2 | 2 [2–2] | 4 [4–4] | 810 [800–820] | 20,346 [17,584–23,108] | 7,883 [6,473–9,293] | $0.0022 [$0.0019–$0.0024] | 8.8 s [8.7 s–9.0 s] |
| gin/x002 | without | 2/2 | 2 [1–2] | 4 [4–4] | 943 [858–1,027] | 16,480 [16,144–16,816] | 6,245 [5,991–6,499] | $0.0019 [$0.0018–$0.0020] | 9.3 s [8.8 s–9.7 s] |
| gin/x002 | with | 2/2 | 2 [1–3] | 5 [4–6] | 893 [696–1,089] | 26,118 [17,098–35,138] | 7,332 [4,877–9,786] | $0.0022 [$0.0019–$0.0025] | 9.4 s [8.3 s–10.5 s] |
| gin/x003 | without | 1/2 | 2 [2–2] | 6 [6–6] | 979 [907–1,051] | 27,302 [26,999–27,605] | 7,189 [6,832–7,546] | $0.0022 [$0.0021–$0.0023] | 11.5 s [10.7 s–12.3 s] |
| gin/x003 | with | 1/2 | 2 [1–2] | 4 [4–4] | 933 [911–954] | 20,142 [17,445–22,838] | 6,924 [4,418–9,429] | $0.0021 [$0.0016–$0.0025] | 9.7 s [9.1 s–10.4 s] |
| gin/x004 | without | 2/2 | 5 [3–7] | 9 [6–12] | 1,884 [1,248–2,519] | 51,066 [31,016–71,116] | 11,426 [9,991–12,860] | $0.0037 [$0.0029–$0.0045] | 15.0 s [11.5 s–18.5 s] |
| gin/x004 | with | 2/2 | 4 [3–5] | 7 [6–8] | 1,840 [1,373–2,307] | 45,244 [33,431–57,056] | 13,476 [12,157–14,794] | $0.0041 [$0.0040–$0.0042] | 13.5 s [11.1 s–15.8 s] |
| gin/x005 | without | 2/2 | 7 [6–7] | 8 [8–8] | 1,380 [1,324–1,435] | 40,508 [39,980–41,035] | 6,784 [6,170–7,398] | $0.0025 [$0.0024–$0.0026] | 12.2 s [11.5 s–12.8 s] |
| gin/x005 | with | 2/2 | 4 [3–4] | 6 [6–6] | 1,007 [1,005–1,008] | 34,661 [31,460–37,862] | 7,978 [5,215–10,740] | $0.0024 [$0.0019–$0.0030] | 9.6 s [9.6 s–9.7 s] |

