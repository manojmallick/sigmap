# Agent-level A/B — measured tool calls, tokens and cost

**claude-code 2.1.322 (Claude Code) · claude-haiku-5-5 · 2026-11-11 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap ranked the question BEFORE the first turn (what a prompt hook would inject): the five likeliest files with their signatures and line anchors in the prompt, + the sigmap CLI; no MCP server, no standing section, no extra tool call.
- Both arms: the same prompt, model, tool allowlist (Read, Grep, Glob, Bash), per-run budget cap $0.5 and timeout 420 s; run in a clean copy of the commit pinned in `benchmarks/xrepo-repos.json`.
- Questions: the task id(s) x046, x047, x048, x049, x050 of `benchmarks/tasks/retrieval-xrepo.jsonl`. Pass = hit@5 on the repository-relative paths the answer names.
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
| laravel | 5 | 10/10 | 10/10 | 0 / 0 |
| all | 5 | 10/10 | 10/10 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 5. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −23% | −33% | fewer in every repetition |
| Input tokens (uncached) | −6% | −22% | fewer in every repetition |
| Output tokens | −17% | −14% | fewer in every repetition |
| Cache-read tokens | +1% | −11% | mixed |
| Cache-write tokens | +43% | −18% | mixed |
| Total tokens (derived) | +8% | −12% | mixed |
| Cost | +21% | −16% | mixed |
| Wall time | −10% | −15% | fewer in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −23% [−45%, +5%] † | −30% [−50%, −6%] | fewer in every repetition, within the noise |
| Input tokens (uncached) | −7% [−25%, +14%] † | −21% [−35%, −6%] | fewer in every repetition, within the noise |
| Output tokens | −18% [−29%, −3%] | −13% [−24%, 0%] | fewer in every repetition, outside the noise |
| Cache-read tokens | −1% [−31%, +35%] † | −10% [−29%, +15%] † | fewer in every repetition, within the noise |
| Cache-write tokens | +45% [+18%, +75%] | −18% [−22%, −13%] | mixed |
| Total tokens (derived) | +8% [−19%, +40%] † | −11% [−28%, +8%] † | mixed |
| Cost | +21% [+1%, +46%] | −16% [−23%, −7%] | mixed |
| Wall time | −10% [−20%, +3%] † | −14% [−23%, −5%] | fewer in every repetition, within the noise |

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
| laravel | 4 | 3 | −1 | 3 / 1 / 1 |
| all | 4 | 3 | −1 | 3 / 1 / 1 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | 6 | 6 | −2 | 3 / 1 / 1 |
| all | 6 | 6 | −2 | 3 / 1 / 1 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | 1,518 | 1,162 | −306 | 4 / 0 / 1 |
| all | 1,518 | 1,162 | −306 | 4 / 0 / 1 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | 28,556 | 33,066 | −7,491 | 3 / 0 / 2 |
| all | 28,556 | 33,066 | −7,491 | 3 / 0 / 2 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | 8,065 | 8,767 | +1,551 | 2 / 0 / 3 |
| all | 8,065 | 8,767 | +1,551 | 2 / 0 / 3 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | 39,112 | 43,224 | −6,378 | 3 / 0 / 2 |
| all | 39,112 | 43,224 | −6,378 | 3 / 0 / 2 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | $0.0027 | $0.0025 | +$0.0000 | 2 / 0 / 3 |
| all | $0.0027 | $0.0025 | +$0.0000 | 2 / 0 / 3 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | 12.0 s | 10.8 s | −2.0 s | 4 / 0 / 1 |
| all | 12.0 s | 10.8 s | −2.0 s | 4 / 0 / 1 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| laravel | $0.0263 (10 runs) | $0.0270 (10 runs) | none | none |
| all | $0.0263 (10 runs) | $0.0270 (10 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| laravel/x046 | without | 2/2 | 6 [4–8] | 8 [6–10] | 1,598 [1,414–1,781] | 39,798 [26,795–52,800] | 6,245 [5,837–6,652] | $0.0024 [$0.0021–$0.0027] | 13.8 s [11.9 s–15.8 s] |
| laravel/x046 | with | 2/2 | 3 [3–3] | 6 [6–6] | 1,162 [1,029–1,295] | 32,307 [30,356–34,257] | 7,795 [5,225–10,365] | $0.0025 [$0.0020–$0.0029] | 10.8 s [9.8 s–11.8 s] |
| laravel/x047 | without | 2/2 | 4 [3–4] | 6 [6–6] | 1,456 [1,411–1,500] | 28,556 [28,171–28,941] | 9,095 [9,040–9,149] | $0.0028 [$0.0028–$0.0028] | 11.7 s [11.2 s–12.3 s] |
| laravel/x047 | with | 2/2 | 3 [2–3] | 4 [4–4] | 1,150 [1,007–1,292] | 18,887 [16,616–21,158] | 8,767 [6,949–10,585] | $0.0025 [$0.0022–$0.0028] | 9.7 s [9.1 s–10.2 s] |
| laravel/x048 | without | 2/2 | 4 [3–4] | 6 [6–6] | 1,518 [1,386–1,649] | 28,213 [27,797–28,629] | 8,065 [8,041–8,089] | $0.0027 [$0.0026–$0.0027] | 12.0 s [11.8 s–12.2 s] |
| laravel/x048 | with | 2/2 | 4 [3–4] | 7 [6–8] | 1,501 [1,421–1,580] | 41,834 [35,225–48,443] | 10,517 [7,413–13,621] | $0.0033 [$0.0025–$0.0040] | 13.0 s [12.0 s–14.1 s] |
| laravel/x049 | without | 2/2 | 4 [4–4] | 6 [6–6] | 1,164 [1,099–1,228] | 27,227 [27,064–27,389] | 7,047 [6,620–7,474] | $0.0023 [$0.0022–$0.0023] | 11.7 s [11.4 s–12.1 s] |
| laravel/x049 | with | 2/2 | 5 [4–5] | 6 [6–6] | 1,237 [1,143–1,330] | 33,066 [30,416–35,716] | 8,916 [6,135–11,696] | $0.0027 [$0.0022–$0.0033] | 11.1 s [10.7 s–11.6 s] |
| laravel/x050 | without | 2/2 | 6 [5–7] | 9 [8–10] | 1,560 [1,359–1,761] | 47,624 [40,028–55,220] | 8,463 [7,357–9,568] | $0.0029 [$0.0026–$0.0033] | 14.1 s [12.3 s–15.8 s] |
| laravel/x050 | with | 2/2 | 3 [3–3] | 7 [6–8] | 1,113 [1,001–1,224] | 35,899 [30,894–40,904] | 7,928 [5,982–9,873] | $0.0025 [$0.0020–$0.0030] | 10.8 s [9.4 s–12.3 s] |

