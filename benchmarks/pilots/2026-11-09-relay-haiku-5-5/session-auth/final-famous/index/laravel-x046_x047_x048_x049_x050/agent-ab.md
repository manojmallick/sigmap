# Agent-level A/B — measured tool calls, tokens and cost

**claude-code 2.1.322 (Claude Code) · claude-haiku-5-5 · 2026-11-11 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap index strategy + 7-tool core MCP profile (the docs' setup for an agent that calls the tools).
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
| Tool calls | −19% | +5% | mixed |
| Input tokens (uncached) | −21% | +6% | mixed |
| Output tokens | −19% | −5% | fewer in every repetition |
| Cache-read tokens | −6% | +38% | mixed |
| Cache-write tokens | −13% | −4% | fewer in every repetition |
| Total tokens (derived) | −7% | +29% | mixed |
| Cost | −14% | +1% | mixed |
| Wall time | −16% | 0% | mixed |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −20% [−37%, +3%] † | +5% [−12%, +24%] † | mixed |
| Input tokens (uncached) | −20% [−31%, −6%] | +6% [−13%, +36%] † | mixed |
| Output tokens | −17% [−36%, +5%] † | −5% [−12%, +2%] † | fewer in every repetition, within the noise |
| Cache-read tokens | −3% [−21%, +20%] † | +38% [+10%, +87%] | mixed |
| Cache-write tokens | −13% [−27%, 0%] | −5% [−21%, +13%] † | fewer in every repetition, within the noise |
| Total tokens (derived) | −5% [−21%, +15%] † | +29% [+7%, +66%] | mixed |
| Cost | −13% [−28%, −1%] | +1% [−10%, +12%] † | mixed |
| Wall time | −15% [−26%, −5%] | 0% [−5%, +5%] † | mixed |

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
| laravel | 4 | 4 | 0 | 2 / 2 / 1 |
| all | 4 | 4 | 0 | 2 / 2 / 1 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | 7 | 6 | −1 | 3 / 2 / 0 |
| all | 7 | 6 | −1 | 3 / 2 / 0 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | 1,566 | 1,225 | −151 | 4 / 0 / 1 |
| all | 1,566 | 1,225 | −151 | 4 / 0 / 1 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | 36,210 | 38,335 | +3,483 | 0 / 0 / 5 |
| all | 36,210 | 38,335 | +3,483 | 0 / 0 / 5 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | 7,749 | 6,436 | −895 | 4 / 0 / 1 |
| all | 7,749 | 6,436 | −895 | 4 / 0 / 1 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | 46,393 | 48,207 | +2,436 | 1 / 0 / 4 |
| all | 46,393 | 48,207 | +2,436 | 1 / 0 / 4 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | $0.0024 | $0.0024 | −$0.0002 | 4 / 0 / 1 |
| all | $0.0024 | $0.0024 | −$0.0002 | 4 / 0 / 1 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | 12.6 s | 11.4 s | −977 ms | 4 / 0 / 1 |
| all | 12.6 s | 11.4 s | −977 ms | 4 / 0 / 1 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| laravel | $0.0255 (10 runs) | $0.0239 (10 runs) | none | none |
| all | $0.0255 (10 runs) | $0.0239 (10 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| laravel/x046 | without | 2/2 | 4 [3–4] | 8 [6–10] | 1,569 [1,437–1,700] | 39,929 [28,017–51,841] | 6,082 [5,558–6,606] | $0.0024 [$0.0023–$0.0025] | 12.9 s [12.6 s–13.3 s] |
| laravel/x046 | with | 2/2 | 4 [3–5] | 7 [6–8] | 1,418 [1,323–1,512] | 43,412 [36,259–50,565] | 5,187 [5,127–5,247] | $0.0022 [$0.0021–$0.0023] | 12.1 s [11.2 s–12.9 s] |
| laravel/x047 | without | 2/2 | 5 [4–5] | 8 [6–10] | 1,796 [1,576–2,016] | 40,326 [27,920–52,731] | 8,206 [7,522–8,889] | $0.0029 [$0.0026–$0.0033] | 13.7 s [11.9 s–15.5 s] |
| laravel/x047 | with | 2/2 | 4 [3–4] | 8 [6–10] | 1,225 [1,066–1,383] | 52,123 [36,158–68,088] | 6,436 [5,704–7,168] | $0.0024 [$0.0020–$0.0028] | 11.4 s [10.1 s–12.6 s] |
| laravel/x048 | without | 2/2 | 5 [4–5] | 7 [6–8] | 1,566 [1,491–1,641] | 36,210 [29,106–43,314] | 8,610 [8,387–8,832] | $0.0029 [$0.0027–$0.0030] | 12.6 s [11.8 s–13.4 s] |
| laravel/x048 | with | 2/2 | 4 [3–4] | 6 [6–6] | 1,317 [1,246–1,388] | 38,335 [37,923–38,747] | 8,549 [8,514–8,584] | $0.0028 [$0.0027–$0.0028] | 11.6 s [11.0 s–12.2 s] |
| laravel/x049 | without | 2/2 | 4 [4–4] | 6 [6–6] | 1,280 [1,187–1,373] | 27,655 [27,567–27,743] | 6,000 [5,927–6,072] | $0.0021 [$0.0021–$0.0021] | 11.5 s [10.6 s–12.4 s] |
| laravel/x049 | with | 2/2 | 4 [3–5] | 6 [6–6] | 1,217 [1,207–1,227] | 35,945 [35,938–35,952] | 7,036 [6,346–7,726] | $0.0024 [$0.0022–$0.0025] | 10.5 s [9.8 s–11.2 s] |
| laravel/x050 | without | 2/2 | 4 [3–4] | 7 [6–8] | 1,054 [1,042–1,066] | 36,132 [29,582–42,681] | 7,749 [7,724–7,773] | $0.0024 [$0.0024–$0.0025] | 10.5 s [10.2 s–10.9 s] |
| laravel/x050 | with | 2/2 | 4 [3–4] | 6 [6–6] | 1,167 [1,051–1,282] | 36,252 [36,087–36,417] | 6,267 [5,277–7,256] | $0.0022 [$0.0019–$0.0025] | 10.7 s [10.6 s–10.9 s] |

