# Agent-level A/B — measured tool calls, tokens and cost

**claude-code 2.1.321 (Claude Code) · claude-haiku-4-5 · 2026-11-10 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap lean: 7-tool core MCP profile + a three-line section.
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
| Tool calls | −36% | −41% | fewer in every repetition |
| Input tokens (uncached) | −32% | −58% | fewer in every repetition |
| Output tokens | −9% | −27% | fewer in every repetition |
| Cache-read tokens | −42% | −70% | fewer in every repetition |
| Cache-write tokens | −24% | −45% | fewer in every repetition |
| Total tokens (derived) | −39% | −68% | fewer in every repetition |
| Cost | −26% | −52% | fewer in every repetition |
| Wall time | −7% | −31% | fewer in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −44% [−57%, −27%] | −41% [−52%, −28%] | fewer in every repetition, outside the noise |
| Input tokens (uncached) | −36% [−48%, −20%] | −58% [−58%, −57%] | fewer in every repetition, outside the noise |
| Output tokens | −14% [−37%, +19%] † | −27% [−40%, −11%] | fewer in every repetition, within the noise |
| Cache-read tokens | −45% [−57%, −28%] | −70% [−71%, −67%] | fewer in every repetition, outside the noise |
| Cache-write tokens | −24% [−29%, −20%] | −45% [−47%, −43%] | fewer in every repetition, outside the noise |
| Total tokens (derived) | −41% [−53%, −27%] | −68% [−70%, −66%] | fewer in every repetition, outside the noise |
| Cost | −26% [−36%, −16%] | −52% [−56%, −47%] | fewer in every repetition, outside the noise |
| Wall time | −10% [−31%, +17%] † | −31% [−38%, −23%] | fewer in every repetition, within the noise |

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
| laravel | 15 | 9 | −6 | 2 / 0 / 0 |
| all | 15 | 9 | −6 | 2 / 0 / 0 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | 120 | 60 | −60 | 2 / 0 / 0 |
| all | 120 | 60 | −60 | 2 / 0 / 0 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | 2,954 | 2,361 | −593 | 1 / 0 / 1 |
| all | 2,954 | 2,361 | −593 | 1 / 0 / 1 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | 305,173 | 114,107 | −191,066 | 2 / 0 / 0 |
| all | 305,173 | 114,107 | −191,066 | 2 / 0 / 0 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | 23,722 | 15,657 | −8,065 | 2 / 0 / 0 |
| all | 23,722 | 15,657 | −8,065 | 2 / 0 / 0 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | 331,969 | 132,185 | −199,784 | 2 / 0 / 0 |
| all | 331,969 | 132,185 | −199,784 | 2 / 0 / 0 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | $0.0929 | $0.0546 | −$0.0383 | 2 / 0 / 0 |
| all | $0.0929 | $0.0546 | −$0.0383 | 2 / 0 / 0 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | 34.1 s | 26.8 s | −7.3 s | 2 / 0 / 0 |
| all | 34.1 s | 26.8 s | −7.3 s | 2 / 0 / 0 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| laravel | $0.3714 (4 runs) | $0.2184 (4 runs) | none | none |
| all | $0.3714 (4 runs) | $0.2184 (4 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| laravel/x046 | without | 2/2 | 17 [15–18] | 118 [82–154] | 2,779 [2,304–3,254] | 276,769 [166,256–387,282] | 22,959 [19,843–26,074] | $0.0876 [$0.0804–$0.0948] | 32.6 s [27.6 s–37.6 s] |
| laravel/x046 | with | 2/2 | 12 [11–13] | 66 [66–66] | 2,819 [2,736–2,901] | 122,588 [119,053–126,122] | 16,124 [11,397–20,850] | $0.0587 [$0.0500–$0.0674] | 30.5 s [29.0 s–32.1 s] |
| laravel/x047 | without | 2/2 | 14 [7–21] | 122 [66–178] | 3,129 [2,221–4,037] | 333,578 [147,220–519,935] | 24,485 [24,414–24,556] | $0.0981 [$0.0747–$0.1215] | 35.6 s [27.5 s–43.8 s] |
| laravel/x047 | with | 2/2 | 7 [3–10] | 54 [34–74] | 1,904 [1,399–2,409] | 105,627 [62,810–148,443] | 15,190 [12,945–17,434] | $0.0505 [$0.0482–$0.0529] | 23.0 s [18.9 s–27.0 s] |

