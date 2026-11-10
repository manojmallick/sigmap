# Agent-level A/B — measured tool calls, tokens and cost

**claude-code 2.1.322 (Claude Code) · claude-haiku-5-5 · 2026-11-10 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap as the three skills `sigmap skills install --client claude` writes + the sigmap CLI: no MCP server, no always-on section.
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
| Tool calls | −15% | +6% | mixed |
| Input tokens (uncached) | 0% | +13% | mixed |
| Output tokens | −7% | +4% | mixed |
| Cache-read tokens | 0% | +20% | more in every repetition |
| Cache-write tokens | +1% | −5% | mixed |
| Total tokens (derived) | 0% | +14% | more in every repetition |
| Cost | −1% | 0% | fewer in every repetition |
| Wall time | −1% | +6% | mixed |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −15% [−48%, +54%] † | +1% [−31%, +48%] † | mixed |
| Input tokens (uncached) | −1% [−36%, +64%] † | +8% [−17%, +39%] † | mixed |
| Output tokens | −5% [−27%, +26%] † | +4% [−19%, +37%] † | mixed |
| Cache-read tokens | −2% [−45%, +89%] † | +11% [−22%, +58%] † | mixed |
| Cache-write tokens | +2% [−10%, +16%] † | −7% [−18%, +5%] † | mixed |
| Total tokens (derived) | 0% [−39%, +71%] † | +7% [−21%, +46%] † | mixed |
| Cost | 0% [−20%, +26%] † | −2% [−17%, +14%] † | mixed |
| Wall time | −1% [−22%, +23%] † | +5% [−8%, +21%] † | mixed |

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
| laravel | 4 | 4 | −1 | 3 / 0 / 2 |
| all | 4 | 4 | −1 | 3 / 0 / 2 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | 6 | 6 | 0 | 1 / 3 / 1 |
| all | 6 | 6 | 0 | 1 / 3 / 1 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | 1,390 | 1,327 | +24 | 2 / 0 / 3 |
| all | 1,390 | 1,327 | +24 | 2 / 0 / 3 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | 35,383 | 35,636 | +253 | 1 / 0 / 4 |
| all | 35,383 | 35,636 | +253 | 1 / 0 / 4 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | 9,433 | 9,223 | −214 | 3 / 0 / 2 |
| all | 9,433 | 9,223 | −214 | 3 / 0 / 2 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | 46,442 | 46,355 | +20 | 2 / 0 / 3 |
| all | 46,442 | 46,355 | +20 | 2 / 0 / 3 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | $0.0031 | $0.0029 | +$0.0000 | 2 / 0 / 3 |
| all | $0.0031 | $0.0029 | +$0.0000 | 2 / 0 / 3 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | 12.6 s | 13.1 s | −59 ms | 3 / 0 / 2 |
| all | 12.6 s | 13.1 s | −59 ms | 3 / 0 / 2 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| laravel | $0.0299 (10 runs) | $0.0297 (10 runs) | none | none |
| all | $0.0299 (10 runs) | $0.0297 (10 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| laravel/x046 | without | 2/2 | 4 [3–5] | 7 [6–8] | 1,547 [1,247–1,847] | 43,482 [36,572–50,391] | 9,706 [9,195–10,216] | $0.0032 [$0.0028–$0.0035] | 13.4 s [11.8 s–15.0 s] |
| laravel/x046 | with | 2/2 | 2 [2–2] | 4 [4–4] | 1,092 [1,031–1,153] | 20,906 [20,905–20,907] | 7,636 [6,705–8,566] | $0.0023 [$0.0021–$0.0025] | 10.5 s [9.9 s–11.2 s] |
| laravel/x047 | without | 2/2 | 5 [4–5] | 6 [6–6] | 1,621 [1,452–1,789] | 35,383 [35,242–35,524] | 9,433 [9,150–9,715] | $0.0031 [$0.0029–$0.0032] | 13.2 s [11.7 s–14.6 s] |
| laravel/x047 | with | 2/2 | 4 [3–4] | 6 [6–6] | 1,495 [1,282–1,707] | 35,636 [35,610–35,662] | 9,219 [8,965–9,472] | $0.0029 [$0.0028–$0.0031] | 13.1 s [12.6 s–13.7 s] |
| laravel/x048 | without | 2/2 | 4 [3–4] | 7 [6–8] | 1,390 [1,147–1,633] | 46,183 [37,351–55,014] | 11,821 [11,371–12,270] | $0.0035 [$0.0034–$0.0036] | 12.6 s [11.3 s–13.9 s] |
| laravel/x048 | with | 2/2 | 5 [3–6] | 7 [6–8] | 1,597 [1,268–1,926] | 46,359 [36,504–56,213] | 11,458 [10,259–12,656] | $0.0036 [$0.0031–$0.0041] | 13.4 s [12.2 s–14.6 s] |
| laravel/x049 | without | 2/2 | 4 [3–5] | 6 [6–6] | 1,146 [960–1,331] | 34,806 [34,656–34,956] | 9,182 [9,014–9,349] | $0.0028 [$0.0027–$0.0028] | 11.5 s [11.3 s–11.7 s] |
| laravel/x049 | with | 2/2 | 4 [3–4] | 6 [6–6] | 1,170 [1,164–1,175] | 35,077 [34,811–35,342] | 9,223 [8,482–9,964] | $0.0028 [$0.0026–$0.0029] | 11.1 s [10.9 s–11.3 s] |
| laravel/x050 | without | 2/2 | 3 [2–4] | 5 [4–6] | 1,111 [884–1,337] | 28,087 [20,719–35,455] | 8,170 [7,581–8,758] | $0.0025 [$0.0022–$0.0028] | 10.9 s [9.9 s–12.0 s] |
| laravel/x050 | with | 2/2 | 5 [4–5] | 10 [10–10] | 1,327 [1,319–1,335] | 67,945 [67,693–68,196] | 9,792 [9,742–9,842] | $0.0033 [$0.0033–$0.0033] | 14.7 s [14.2 s–15.2 s] |

