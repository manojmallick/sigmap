# Agent-level A/B — measured tool calls, tokens and cost

**claude-code 2.1.321 (Claude Code) · claude-haiku-4-5 · 2026-11-10 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap generated context + MCP server.
- Both arms: the same prompt, model, tool allowlist (Read, Grep, Glob, Bash), per-run budget cap $1 and timeout 420 s; run in a clean copy of the commit pinned in `benchmarks/xrepo-repos.json`.
- Questions: the task id(s) x046, x047 of `benchmarks/tasks/retrieval-xrepo.jsonl`. Pass = hit@5 on the repository-relative paths the answer names.
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
| laravel | 2 | 4/4 | 4/4 | 0 / 0 |
| all | 2 | 4/4 | 4/4 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 2. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −8% | −53% | fewer in every repetition |
| Input tokens (uncached) | −25% | −56% | fewer in every repetition |
| Output tokens | −1% | −33% | fewer in every repetition |
| Cache-read tokens | −19% | −49% | fewer in every repetition |
| Cache-write tokens | −27% | −9% | fewer in every repetition |
| Total tokens (derived) | −20% | −46% | fewer in every repetition |
| Cost | −21% | −28% | fewer in every repetition |
| Wall time | −3% | −28% | fewer in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −10% [−31%, +17%] † | −53% [−65%, −38%] | fewer in every repetition, within the noise |
| Input tokens (uncached) | −27% [−42%, −8%] | −56% [−56%, −55%] | fewer in every repetition, outside the noise |
| Output tokens | −7% [−34%, +31%] † | −31% [−47%, −9%] | fewer in every repetition, within the noise |
| Cache-read tokens | −24% [−46%, +7%] † | −49% [−53%, −46%] | fewer in every repetition, within the noise |
| Cache-write tokens | −29% [−42%, −13%] | −17% [−37%, +9%] † | fewer in every repetition, within the noise |
| Total tokens (derived) | −23% [−43%, +3%] † | −47% [−51%, −43%] | fewer in every repetition, within the noise |
| Cost | −21% [−25%, −18%] | −30% [−38%, −21%] | fewer in every repetition, outside the noise |
| Wall time | −6% [−27%, +20%] † | −26% [−36%, −15%] | fewer in every repetition, within the noise |

### Outcome (hit@5), by repetition

Per paired task: **better** = the SigMap arm named the file and the other did not; **worse** = the reverse; **tie** = both found it or both missed. Localisation only.

| repetition | paired tasks | better | worse | tie |
| --- | ---: | ---: | ---: | ---: |
| R1 | 2 | 0 | 0 | 2 |
| R2 | 2 | 0 | 0 | 2 |
| all | 4 | 0 | 0 | 4 |

## Tool calls

Provenance: agent-reported (main-thread tool_use blocks). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | 14 | 9 | −5 | 2 / 0 / 0 |
| all | 14 | 9 | −5 | 2 / 0 / 0 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | 116 | 68 | −48 | 2 / 0 / 0 |
| all | 116 | 68 | −48 | 2 / 0 / 0 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | 2,986 | 2,459 | −527 | 2 / 0 / 0 |
| all | 2,986 | 2,459 | −527 | 2 / 0 / 0 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | 263,449 | 172,240 | −91,209 | 2 / 0 / 0 |
| all | 263,449 | 172,240 | −91,209 | 2 / 0 / 0 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | 22,189 | 17,675 | −4,514 | 2 / 0 / 0 |
| all | 22,189 | 17,675 | −4,514 | 2 / 0 / 0 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | 288,739 | 192,442 | −96,297 | 2 / 0 / 0 |
| all | 288,739 | 192,442 | −96,297 | 2 / 0 / 0 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | $0.0858 | $0.0649 | −$0.0208 | 2 / 0 / 0 |
| all | $0.0858 | $0.0649 | −$0.0208 | 2 / 0 / 0 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | 35.4 s | 30.0 s | −5.4 s | 2 / 0 / 0 |
| all | 35.4 s | 30.0 s | −5.4 s | 2 / 0 / 0 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| laravel | $0.3431 (4 runs) | $0.2597 (4 runs) | none | none |
| all | $0.3431 (4 runs) | $0.2597 (4 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| laravel/x046 | without | 2/2 | 13 [13–13] | 114 [114–114] | 2,601 [2,362–2,839] | 246,246 [236,782–255,710] | 20,184 [13,633–26,735] | $0.0781 [$0.0629–$0.0933] | 31.7 s [28.3 s–35.1 s] |
| laravel/x046 | with | 2/2 | 9 [8–9] | 58 [50–66] | 2,004 [1,861–2,147] | 125,503 [112,398–138,608] | 16,004 [8,618–23,390] | $0.0546 [$0.0393–$0.0700] | 24.9 s [24.1 s–25.7 s] |
| laravel/x047 | without | 2/2 | 15 [12–17] | 118 [106–130] | 3,371 [2,902–3,839] | 280,652 [252,852–308,452] | 24,193 [20,433–27,953] | $0.0934 [$0.0910–$0.0958] | 39.1 s [36.3 s–42.0 s] |
| laravel/x047 | with | 2/2 | 10 [6–14] | 78 [58–98] | 2,914 [2,016–3,812] | 218,977 [166,428–271,526] | 19,346 [16,330–22,361] | $0.0752 [$0.0715–$0.0790] | 35.1 s [26.8 s–43.4 s] |

