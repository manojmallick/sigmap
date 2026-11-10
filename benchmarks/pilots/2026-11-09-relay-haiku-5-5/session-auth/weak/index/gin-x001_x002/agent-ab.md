# Agent-level A/B — measured tool calls, tokens and cost

**claude-code 2.1.321 (Claude Code) · claude-haiku-4-5 · 2026-11-10 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap index strategy + 7-tool core MCP profile (the docs' setup for an agent that calls the tools).
- Both arms: the same prompt, model, tool allowlist (Read, Grep, Glob, Bash), per-run budget cap $1 and timeout 420 s; run in a clean copy of the commit pinned in `benchmarks/xrepo-repos.json`.
- Questions: the task id(s) x001, x002 of `benchmarks/tasks/retrieval-xrepo.jsonl`. Pass = hit@5 on the repository-relative paths the answer names.
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
| gin | 2 | 4/4 | 4/4 | 0 / 0 |
| all | 2 | 4/4 | 4/4 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 2. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −14% | −44% | fewer in every repetition |
| Input tokens (uncached) | −30% | −54% | fewer in every repetition |
| Output tokens | −2% | −15% | fewer in every repetition |
| Cache-read tokens | −18% | −54% | fewer in every repetition |
| Cache-write tokens | −3% | −13% | fewer in every repetition |
| Total tokens (derived) | −17% | −50% | fewer in every repetition |
| Cost | −7% | −26% | fewer in every repetition |
| Wall time | −8% | −17% | fewer in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −18% [−33%, 0%] † | −42% [−50%, −33%] | fewer in every repetition, within the noise |
| Input tokens (uncached) | −32% [−41%, −22%] | −54% [−55%, −53%] | fewer in every repetition, outside the noise |
| Output tokens | −2% [−3%, −2%] | −16% [−24%, −9%] | fewer in every repetition, outside the noise |
| Cache-read tokens | −23% [−36%, −7%] | −54% [−56%, −53%] | fewer in every repetition, outside the noise |
| Cache-write tokens | −5% [−14%, +4%] † | −14% [−15%, −12%] | fewer in every repetition, within the noise |
| Total tokens (derived) | −21% [−34%, −6%] | −51% [−52%, −50%] | fewer in every repetition, outside the noise |
| Cost | −9% [−17%, 0%] | −26% [−28%, −25%] | fewer in every repetition, outside the noise |
| Wall time | −8% [−13%, −3%] | −18% [−24%, −12%] | fewer in every repetition, outside the noise |

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
| gin | 8 | 5 | −2 | 2 / 0 / 0 |
| all | 8 | 5 | −2 | 2 / 0 / 0 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 70 | 40 | −30 | 2 / 0 / 0 |
| all | 70 | 40 | −30 | 2 / 0 / 0 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 1,686 | 1,537 | −150 | 2 / 0 / 0 |
| all | 1,686 | 1,537 | −150 | 2 / 0 / 0 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 124,753 | 78,136 | −46,618 | 2 / 0 / 0 |
| all | 124,753 | 78,136 | −46,618 | 2 / 0 / 0 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 11,310 | 10,374 | −937 | 2 / 0 / 0 |
| all | 11,310 | 10,374 | −937 | 2 / 0 / 0 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 137,819 | 90,086 | −47,734 | 2 / 0 / 0 |
| all | 137,819 | 90,086 | −47,734 | 2 / 0 / 0 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | $0.0436 | $0.0363 | −$0.0073 | 2 / 0 / 0 |
| all | $0.0436 | $0.0363 | −$0.0073 | 2 / 0 / 0 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 22.0 s | 19.2 s | −2.8 s | 2 / 0 / 0 |
| all | 22.0 s | 19.2 s | −2.8 s | 2 / 0 / 0 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| gin | $0.1744 (4 runs) | $0.1451 (4 runs) | none | none |
| all | $0.1744 (4 runs) | $0.1451 (4 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| gin/x001 | without | 2/2 | 9 [8–10] | 82 [74–90] | 1,937 [1,894–1,980] | 158,045 [139,401–176,688] | 13,372 [13,229–13,514] | $0.0523 [$0.0499–$0.0547] | 23.9 s [23.0 s–24.8 s] |
| gin/x001 | with | 2/2 | 7 [5–8] | 50 [42–58] | 1,824 [1,811–1,837] | 106,737 [83,230–130,244] | 12,843 [11,895–13,791] | $0.0455 [$0.0412–$0.0498] | 22.1 s [21.9 s–22.3 s] |
| gin/x002 | without | 2/2 | 6 [6–6] | 58 [58–58] | 1,436 [1,406–1,465] | 91,462 [91,403–91,520] | 9,249 [9,167–9,330] | $0.0349 [$0.0349–$0.0349] | 20.0 s [19.6 s–20.4 s] |
| gin/x002 | with | 2/2 | 4 [4–4] | 30 [26–34] | 1,250 [1,117–1,382] | 49,534 [40,543–58,525] | 7,904 [7,768–8,040] | $0.0270 [$0.0252–$0.0289] | 16.2 s [15.5 s–17.0 s] |

