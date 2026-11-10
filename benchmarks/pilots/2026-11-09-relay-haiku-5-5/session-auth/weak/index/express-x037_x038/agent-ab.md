# Agent-level A/B — measured tool calls, tokens and cost

**claude-code 2.1.321 (Claude Code) · claude-haiku-4-5 · 2026-11-10 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap index strategy + 7-tool core MCP profile (the docs' setup for an agent that calls the tools).
- Both arms: the same prompt, model, tool allowlist (Read, Grep, Glob, Bash), per-run budget cap $1 and timeout 420 s; run in a clean copy of the commit pinned in `benchmarks/xrepo-repos.json`.
- Questions: the task id(s) x037, x038 of `benchmarks/tasks/retrieval-xrepo.jsonl`. Pass = hit@5 on the repository-relative paths the answer names.
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
| express | 2 | 4/4 | 4/4 | 0 / 0 |
| all | 2 | 4/4 | 4/4 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 2. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −35% | −38% | fewer in every repetition |
| Input tokens (uncached) | −32% | −36% | fewer in every repetition |
| Output tokens | −25% | −38% | fewer in every repetition |
| Cache-read tokens | −30% | −29% | fewer in every repetition |
| Cache-write tokens | −2% | −25% | fewer in every repetition |
| Total tokens (derived) | −28% | −29% | fewer in every repetition |
| Cost | −16% | −28% | fewer in every repetition |
| Wall time | −25% | −25% | fewer in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −34% [−40%, −27%] | −50% [−78%, +14%] † | fewer in every repetition, within the noise |
| Input tokens (uncached) | −31% [−37%, −24%] | −39% [−68%, +16%] † | fewer in every repetition, within the noise |
| Output tokens | −24% [−29%, −19%] | −40% [−62%, −4%] | fewer in every repetition, outside the noise |
| Cache-read tokens | −28% [−36%, −21%] | −38% [−75%, +54%] † | fewer in every repetition, within the noise |
| Cache-write tokens | −3% [−11%, +5%] † | −25% [−29%, −21%] | fewer in every repetition, within the noise |
| Total tokens (derived) | −27% [−33%, −20%] | −36% [−71%, +39%] † | fewer in every repetition, within the noise |
| Cost | −16% [−16%, −15%] | −31% [−49%, −7%] | fewer in every repetition, outside the noise |
| Wall time | −25% [−28%, −21%] | −26% [−50%, +10%] † | fewer in every repetition, within the noise |

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
| express | 11 | 7 | −4 | 2 / 0 / 0 |
| all | 11 | 7 | −4 | 2 / 0 / 0 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | 90 | 60 | −30 | 2 / 0 / 0 |
| all | 90 | 60 | −30 | 2 / 0 / 0 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | 2,331 | 1,623 | −708 | 2 / 0 / 0 |
| all | 2,331 | 1,623 | −708 | 2 / 0 / 0 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | 189,615 | 133,728 | −55,887 | 1 / 0 / 1 |
| all | 189,615 | 133,728 | −55,887 | 1 / 0 / 1 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | 17,419 | 15,132 | −2,288 | 2 / 0 / 0 |
| all | 17,419 | 15,132 | −2,288 | 2 / 0 / 0 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | 209,455 | 150,542 | −58,913 | 2 / 0 / 0 |
| all | 209,455 | 150,542 | −58,913 | 2 / 0 / 0 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | $0.0655 | $0.0518 | −$0.0137 | 2 / 0 / 0 |
| all | $0.0655 | $0.0518 | −$0.0137 | 2 / 0 / 0 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | 28.5 s | 21.4 s | −7.2 s | 2 / 0 / 0 |
| all | 28.5 s | 21.4 s | −7.2 s | 2 / 0 / 0 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| express | $0.2622 (4 runs) | $0.2072 (4 runs) | none | none |
| all | $0.2622 (4 runs) | $0.2072 (4 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| express/x037 | without | 2/2 | 12 [9–15] | 106 [82–130] | 2,650 [2,381–2,919] | 233,429 [157,042–309,815] | 17,143 [14,631–19,654] | $0.0710 [$0.0570–$0.0850] | 32.4 s [28.4 s–36.4 s] |
| express/x037 | with | 2/2 | 6 [2–9] | 54 [26–82] | 1,485 [908–2,061] | 119,759 [39,742–199,776] | 15,486 [10,391–20,581] | $0.0504 [$0.0293–$0.0715] | 20.1 s [14.1 s–26.2 s] |
| express/x038 | without | 2/2 | 9 [7–11] | 74 [50–98] | 2,011 [1,710–2,312] | 145,802 [85,453–206,151] | 17,696 [15,880–19,511] | $0.0601 [$0.0562–$0.0640] | 24.7 s [20.2 s–29.2 s] |
| express/x038 | with | 2/2 | 8 [8–8] | 66 [58–74] | 1,761 [1,639–1,883] | 147,697 [131,575–163,819] | 14,777 [14,179–15,375] | $0.0532 [$0.0522–$0.0542] | 22.6 s [22.2 s–23.0 s] |

