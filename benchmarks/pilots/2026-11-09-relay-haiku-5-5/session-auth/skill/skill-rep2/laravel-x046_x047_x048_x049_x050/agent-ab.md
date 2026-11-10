# Agent-level A/B — measured tool calls, tokens and cost

**claude-code 2.1.322 (Claude Code) · claude-haiku-5-5 · 2026-11-10 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap as one on-demand skill (sigmap-locate) + the sigmap CLI: no MCP server, no always-on section.
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
- Skill variant: both arms run with skills enabled (the Skill tool, and the agent's own bundled skills listed in the prompt, about 2k tokens), which the earlier no-skill runs did not have, so these figures are against this run's own baseline and not comparable cell by cell with the index, lean or current runs. The SigMap arm adds only its skill file(s) and the sigmap CLI: no MCP server and no appended section.

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
| Tool calls | −21% | −32% | fewer in every repetition |
| Input tokens (uncached) | +7% | −19% | mixed |
| Output tokens | −10% | −6% | fewer in every repetition |
| Cache-read tokens | +15% | −23% | mixed |
| Cache-write tokens | +13% | +2% | more in every repetition |
| Total tokens (derived) | +14% | −19% | mixed |
| Cost | +8% | −4% | mixed |
| Wall time | +1% | −10% | mixed |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −21% [−29%, −11%] | −31% [−41%, −16%] | fewer in every repetition, outside the noise |
| Input tokens (uncached) | +6% [0%, +19%] † | −18% [−28%, −6%] | mixed |
| Output tokens | −11% [−19%, −1%] | −3% [−21%, +20%] † | fewer in every repetition, within the noise |
| Cache-read tokens | +13% [+2%, +27%] | −21% [−32%, −7%] | mixed |
| Cache-write tokens | +10% [−8%, +32%] † | +1% [−4%, +9%] † | more in every repetition, within the noise |
| Total tokens (derived) | +12% [0%, +24%] | −17% [−27%, −5%] | mixed |
| Cost | +6% [−8%, +21%] † | −3% [−9%, +3%] † | mixed |
| Wall time | 0% [−6%, +9%] † | −9% [−24%, +10%] † | mixed |

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
| laravel | 4 | 3 | −1 | 5 / 0 / 0 |
| all | 4 | 3 | −1 | 5 / 0 / 0 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | 7 | 7 | −1 | 3 / 1 / 1 |
| all | 7 | 7 | −1 | 3 / 1 / 1 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | 1,365 | 1,361 | −183 | 3 / 0 / 2 |
| all | 1,365 | 1,361 | −183 | 3 / 0 / 2 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | 44,249 | 45,686 | −6,369 | 3 / 0 / 2 |
| all | 44,249 | 45,686 | −6,369 | 3 / 0 / 2 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | 9,515 | 10,681 | +521 | 2 / 0 / 3 |
| all | 9,515 | 10,681 | +521 | 2 / 0 / 3 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | 55,407 | 57,879 | −4,561 | 3 / 0 / 2 |
| all | 55,407 | 57,879 | −4,561 | 3 / 0 / 2 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | $0.0029 | $0.0033 | +$0.0001 | 2 / 0 / 3 |
| all | $0.0029 | $0.0033 | +$0.0001 | 2 / 0 / 3 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | 12.8 s | 12.6 s | −1.1 s | 3 / 0 / 2 |
| all | 12.8 s | 12.6 s | −1.1 s | 3 / 0 / 2 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| laravel | $0.0313 (10 runs) | $0.0317 (10 runs) | none | none |
| all | $0.0313 (10 runs) | $0.0317 (10 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| laravel/x046 | without | 2/2 | 4 [2–5] | 6 [4–8] | 1,279 [1,088–1,469] | 35,817 [20,723–50,910] | 8,368 [7,833–8,902] | $0.0027 [$0.0023–$0.0030] | 12.2 s [9.6 s–14.8 s] |
| laravel/x046 | with | 2/2 | 3 [2–3] | 5 [4–6] | 1,096 [874–1,318] | 28,589 [20,817–36,360] | 7,720 [6,950–8,490] | $0.0024 [$0.0020–$0.0027] | 11.1 s [9.1 s–13.2 s] |
| laravel/x047 | without | 2/2 | 4 [3–5] | 7 [6–8] | 1,666 [1,363–1,968] | 44,249 [34,954–53,543] | 10,179 [9,382–10,976] | $0.0033 [$0.0029–$0.0037] | 14.5 s [11.5 s–17.4 s] |
| laravel/x047 | with | 2/2 | 3 [2–3] | 6 [6–6] | 1,361 [1,126–1,595] | 37,880 [36,479–39,281] | 12,293 [10,979–13,607] | $0.0035 [$0.0034–$0.0037] | 12.1 s [11.4 s–12.7 s] |
| laravel/x048 | without | 2/2 | 6 [4–7] | 9 [6–12] | 1,811 [1,531–2,091] | 63,845 [36,711–90,979] | 11,784 [11,333–12,234] | $0.0039 [$0.0034–$0.0044] | 15.7 s [13.7 s–17.8 s] |
| laravel/x048 | with | 2/2 | 4 [3–4] | 7 [6–8] | 1,379 [1,254–1,504] | 48,192 [36,154–60,229] | 12,305 [10,450–14,159] | $0.0036 [$0.0031–$0.0042] | 12.6 s [12.3 s–12.9 s] |
| laravel/x049 | without | 2/2 | 5 [4–6] | 7 [6–8] | 1,365 [1,186–1,543] | 41,833 [34,566–49,100] | 8,797 [8,515–9,079] | $0.0029 [$0.0026–$0.0031] | 12.8 s [11.4 s–14.1 s] |
| laravel/x049 | with | 2/2 | 5 [4–5] | 7 [6–8] | 1,505 [1,492–1,518] | 45,686 [35,259–56,113] | 10,681 [8,799–12,562] | $0.0033 [$0.0029–$0.0038] | 14.6 s [14.4 s–14.9 s] |
| laravel/x050 | without | 2/2 | 4 [4–4] | 7 [6–8] | 1,086 [1,061–1,110] | 44,799 [35,461–54,137] | 9,515 [8,992–10,038] | $0.0029 [$0.0027–$0.0031] | 12.1 s [10.9 s–13.3 s] |
| laravel/x050 | with | 2/2 | 3 [3–3] | 8 [8–8] | 1,284 [1,178–1,390] | 50,759 [50,667–50,851] | 9,172 [8,955–9,388] | $0.0030 [$0.0029–$0.0031] | 13.2 s [12.5 s–13.8 s] |

