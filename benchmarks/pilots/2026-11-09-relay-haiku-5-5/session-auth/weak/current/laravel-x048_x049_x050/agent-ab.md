# Agent-level A/B — measured tool calls, tokens and cost

**claude-code 2.1.322 (Claude Code) · claude-haiku-4-5 · 2026-11-10 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap generated context + MCP server.
- Both arms: the same prompt, model, tool allowlist (Read, Grep, Glob, Bash), per-run budget cap $1 and timeout 420 s; run in a clean copy of the commit pinned in `benchmarks/xrepo-repos.json`.
- Questions: the task id(s) x048, x049, x050 of `benchmarks/tasks/retrieval-xrepo.jsonl`. Pass = hit@5 on the repository-relative paths the answer names.
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
| laravel | 3 | 6/6 | 6/6 | 0 / 0 |
| all | 3 | 6/6 | 6/6 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 3. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | +36% | +3% | more in every repetition |
| Input tokens (uncached) | +17% | −10% | mixed |
| Output tokens | +13% | −18% | mixed |
| Cache-read tokens | +12% | +13% | more in every repetition |
| Cache-write tokens | −49% | −9% | fewer in every repetition |
| Total tokens (derived) | +6% | +11% | more in every repetition |
| Cost | −23% | −4% | fewer in every repetition |
| Wall time | +22% | −11% | mixed |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | +39% [+7%, +63%] | +4% [−10%, +33%] † | more in every repetition, within the noise |
| Input tokens (uncached) | +18% [+7%, +43%] | −14% [−44%, +20%] † | mixed |
| Output tokens | +12% [0%, +39%] † | −20% [−43%, +2%] † | mixed |
| Cache-read tokens | +18% [−10%, +53%] † | +7% [−32%, +62%] † | more in every repetition, within the noise |
| Cache-write tokens | −49% [−55%, −42%] | −10% [−24%, +3%] † | fewer in every repetition, within the noise |
| Total tokens (derived) | +11% [−13%, +38%] † | +6% [−30%, +55%] † | more in every repetition, within the noise |
| Cost | −23% [−29%, −14%] | −5% [−22%, +19%] † | fewer in every repetition, within the noise |
| Wall time | +22% [+10%, +33%] | −13% [−38%, +7%] † | mixed |

### Outcome (hit@5), by repetition

Per paired task: **better** = the SigMap arm named the file and the other did not; **worse** = the reverse; **tie** = both found it or both missed. Localisation only.

| repetition | paired tasks | better | worse | tie |
| --- | ---: | ---: | ---: | ---: |
| R1 | 3 | 0 | 0 | 3 |
| R2 | 3 | 0 | 0 | 3 |
| all | 6 | 0 | 0 | 6 |

## Tool calls

Provenance: agent-reported (main-thread tool_use blocks). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | 12 | 15 | +2 | 0 / 1 / 2 |
| all | 12 | 15 | +2 | 0 / 1 / 2 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | 106 | 98 | +12 | 1 / 0 / 2 |
| all | 106 | 98 | +12 | 1 / 0 / 2 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | 3,217 | 3,071 | −233 | 2 / 0 / 1 |
| all | 3,217 | 3,071 | −233 | 2 / 0 / 1 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | 269,737 | 288,214 | +65,804 | 1 / 0 / 2 |
| all | 269,737 | 288,214 | +65,804 | 1 / 0 / 2 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | 23,021 | 16,557 | −8,981 | 3 / 0 / 0 |
| all | 23,021 | 16,557 | −8,981 | 3 / 0 / 0 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | 296,347 | 308,876 | +55,797 | 1 / 0 / 2 |
| all | 296,347 | 308,876 | +55,797 | 1 / 0 / 2 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | $0.0905 | $0.0764 | −$0.0141 | 2 / 0 / 1 |
| all | $0.0905 | $0.0764 | −$0.0141 | 2 / 0 / 1 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | 37.7 s | 35.8 s | +1.3 s | 1 / 0 / 2 |
| all | 37.7 s | 35.8 s | +1.3 s | 1 / 0 / 2 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| laravel | $0.5309 (6 runs) | $0.4524 (6 runs) | none | none |
| all | $0.5309 (6 runs) | $0.4524 (6 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| laravel/x048 | without | 2/2 | 12 [10–14] | 106 [90–122] | 3,217 [3,018–3,415] | 291,684 [177,477–405,891] | 25,538 [17,401–33,674] | $0.0964 [$0.0677–$0.1251] | 37.7 s [35.6 s–39.7 s] |
| laravel/x048 | with | 2/2 | 12 [9–15] | 90 [50–130] | 2,601 [1,709–3,493] | 243,798 [121,390–366,206] | 16,557 [15,889–17,225] | $0.0706 [$0.0525–$0.0887] | 35.8 s [22.1 s–49.5 s] |
| laravel/x049 | without | 2/2 | 13 [8–18] | 114 [74–154] | 3,476 [2,706–4,245] | 269,737 [180,517–358,957] | 23,021 [18,460–27,581] | $0.0905 [$0.0868–$0.0942] | 38.9 s [32.0 s–45.8 s] |
| laravel/x049 | with | 2/2 | 15 [13–17] | 126 [106–146] | 3,243 [2,696–3,789] | 335,541 [276,610–394,471] | 13,235 [12,380–14,089] | $0.0764 [$0.0660–$0.0867] | 40.3 s [35.2 s–45.3 s] |
| laravel/x050 | without | 2/2 | 10 [9–11] | 86 [82–90] | 2,536 [2,456–2,615] | 208,888 [192,189–225,586] | 22,424 [19,979–24,868] | $0.0785 [$0.0715–$0.0855] | 29.3 s [28.6 s–30.0 s] |
| laravel/x050 | with | 2/2 | 15 [12–17] | 98 [98–98] | 3,071 [2,502–3,640] | 288,214 [265,894–310,533] | 17,493 [14,314–20,672] | $0.0793 [$0.0735–$0.0850] | 35.2 s [30.6 s–39.8 s] |

