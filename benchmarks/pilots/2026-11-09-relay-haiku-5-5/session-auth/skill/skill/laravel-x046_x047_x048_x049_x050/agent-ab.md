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
| Tool calls | −23% | −32% | fewer in every repetition |
| Input tokens (uncached) | −16% | −11% | fewer in every repetition |
| Output tokens | −6% | −15% | fewer in every repetition |
| Cache-read tokens | −21% | −15% | fewer in every repetition |
| Cache-write tokens | −17% | −12% | fewer in every repetition |
| Total tokens (derived) | −20% | −14% | fewer in every repetition |
| Cost | −15% | −13% | fewer in every repetition |
| Wall time | −1% | −12% | fewer in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −23% [−53%, +12%] † | −31% [−54%, −4%] | fewer in every repetition, within the noise |
| Input tokens (uncached) | −15% [−31%, +12%] † | −14% [−36%, +9%] † | fewer in every repetition, within the noise |
| Output tokens | −6% [−21%, +17%] † | −16% [−28%, 0%] | fewer in every repetition, within the noise |
| Cache-read tokens | −19% [−40%, +13%] † | −19% [−43%, +7%] † | fewer in every repetition, within the noise |
| Cache-write tokens | −17% [−27%, −3%] | −12% [−22%, −3%] | fewer in every repetition, outside the noise |
| Total tokens (derived) | −19% [−38%, +9%] † | −18% [−38%, +3%] † | fewer in every repetition, within the noise |
| Cost | −15% [−27%, +2%] † | −14% [−23%, −4%] | fewer in every repetition, within the noise |
| Wall time | 0% [−16%, +20%] † | −11% [−22%, −1%] | fewer in every repetition, within the noise |

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
| laravel | 5 | 4 | −1 | 4 / 0 / 1 |
| all | 5 | 4 | −1 | 4 / 0 / 1 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | 7 | 6 | −1 | 3 / 1 / 1 |
| all | 7 | 6 | −1 | 3 / 1 / 1 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | 1,519 | 1,233 | −233 | 4 / 0 / 1 |
| all | 1,519 | 1,233 | −233 | 4 / 0 / 1 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | 45,683 | 36,146 | −7,503 | 3 / 0 / 2 |
| all | 45,683 | 36,146 | −7,503 | 3 / 0 / 2 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | 11,181 | 9,096 | −2,085 | 4 / 0 / 1 |
| all | 11,181 | 9,096 | −2,085 | 4 / 0 / 1 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | 58,640 | 48,240 | −8,949 | 3 / 0 / 2 |
| all | 58,640 | 48,240 | −8,949 | 3 / 0 / 2 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | $0.0034 | $0.0029 | −$0.0005 | 4 / 0 / 1 |
| all | $0.0034 | $0.0029 | −$0.0005 | 4 / 0 / 1 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | 13.5 s | 12.0 s | −2.0 s | 3 / 0 / 2 |
| all | 13.5 s | 12.0 s | −2.0 s | 3 / 0 / 2 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| laravel | $0.0341 (10 runs) | $0.0293 (10 runs) | none | none |
| all | $0.0341 (10 runs) | $0.0293 (10 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| laravel/x046 | without | 2/2 | 6 [6–6] | 9 [8–10] | 1,648 [1,631–1,664] | 58,498 [48,905–68,090] | 9,394 [7,878–10,909] | $0.0033 [$0.0029–$0.0037] | 15.0 s [14.9 s–15.2 s] |
| laravel/x046 | with | 2/2 | 2 [2–2] | 5 [4–6] | 1,180 [1,035–1,325] | 27,823 [20,815–34,830] | 7,287 [6,863–7,710] | $0.0023 [$0.0021–$0.0026] | 12.0 s [10.8 s–13.2 s] |
| laravel/x047 | without | 2/2 | 3 [3–3] | 6 [6–6] | 1,268 [1,237–1,299] | 36,244 [34,522–37,966] | 10,937 [9,272–12,601] | $0.0032 [$0.0028–$0.0035] | 10.7 s [10.6 s–10.7 s] |
| laravel/x047 | with | 2/2 | 4 [3–4] | 6 [6–6] | 1,598 [1,469–1,727] | 36,853 [35,979–37,727] | 11,229 [10,358–12,100] | $0.0034 [$0.0033–$0.0035] | 12.1 s [11.2 s–13.0 s] |
| laravel/x048 | without | 2/2 | 5 [4–5] | 7 [6–8] | 1,632 [1,602–1,662] | 43,649 [36,330–50,967] | 11,901 [11,011–12,791] | $0.0036 [$0.0034–$0.0039] | 13.5 s [13.4 s–13.7 s] |
| laravel/x048 | with | 2/2 | 4 [3–4] | 6 [6–6] | 1,400 [1,249–1,550] | 36,146 [36,046–36,246] | 10,689 [10,499–10,878] | $0.0032 [$0.0031–$0.0033] | 11.6 s [10.9 s–12.2 s] |
| laravel/x049 | without | 2/2 | 5 [5–5] | 8 [8–8] | 1,519 [1,442–1,596] | 53,216 [51,576–54,855] | 11,181 [9,848–12,513] | $0.0035 [$0.0033–$0.0038] | 13.5 s [13.5 s–13.6 s] |
| laravel/x049 | with | 2/2 | 5 [4–5] | 6 [6–6] | 1,233 [1,231–1,234] | 35,145 [34,908–35,381] | 9,096 [8,923–9,269] | $0.0028 [$0.0027–$0.0028] | 11.5 s [11.3 s–11.6 s] |
| laravel/x050 | without | 2/2 | 5 [3–7] | 7 [6–8] | 1,273 [1,000–1,546] | 45,683 [35,128–56,237] | 11,678 [9,725–13,630] | $0.0034 [$0.0028–$0.0041] | 11.4 s [9.4 s–13.5 s] |
| laravel/x050 | with | 2/2 | 4 [3–4] | 9 [8–10] | 1,129 [1,028–1,230] | 58,219 [49,744–66,694] | 8,976 [8,489–9,462] | $0.0029 [$0.0027–$0.0032] | 12.9 s [12.6 s–13.2 s] |

