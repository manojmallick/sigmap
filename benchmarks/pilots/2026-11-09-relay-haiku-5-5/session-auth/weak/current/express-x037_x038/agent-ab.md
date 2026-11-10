# Agent-level A/B — measured tool calls, tokens and cost

**claude-code 2.1.321 (Claude Code) · claude-haiku-4-5 · 2026-11-10 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap generated context + MCP server.
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
| Tool calls | −41% | 0% | mixed |
| Input tokens (uncached) | −46% | −4% | fewer in every repetition |
| Output tokens | −21% | 0% | fewer in every repetition |
| Cache-read tokens | −44% | +15% | mixed |
| Cache-write tokens | −26% | −29% | fewer in every repetition |
| Total tokens (derived) | −43% | +11% | mixed |
| Cost | −32% | −11% | fewer in every repetition |
| Wall time | −25% | −6% | fewer in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −43% [−54%, −29%] | −16% [−55%, +55%] † | fewer in every repetition, within the noise |
| Input tokens (uncached) | −51% [−68%, −26%] | −19% [−53%, +41%] † | fewer in every repetition, within the noise |
| Output tokens | −26% [−46%, +1%] † | −4% [−23%, +20%] † | fewer in every repetition, within the noise |
| Cache-read tokens | −51% [−68%, −24%] | −6% [−49%, +72%] † | fewer in every repetition, within the noise |
| Cache-write tokens | −26% [−29%, −23%] | −29% [−32%, −27%] | fewer in every repetition, outside the noise |
| Total tokens (derived) | −49% [−65%, −24%] | −7% [−47%, +63%] † | fewer in every repetition, within the noise |
| Cost | −33% [−43%, −22%] | −14% [−33%, +10%] † | fewer in every repetition, within the noise |
| Wall time | −30% [−47%, −6%] | −11% [−26%, +8%] † | fewer in every repetition, within the noise |

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
| express | 12 | 10 | −3 | 1 / 0 / 1 |
| all | 12 | 10 | −3 | 1 / 0 / 1 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | 104 | 76 | −28 | 1 / 0 / 1 |
| all | 104 | 76 | −28 | 1 / 0 / 1 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | 2,555 | 2,267 | −288 | 1 / 0 / 1 |
| all | 2,555 | 2,267 | −288 | 1 / 0 / 1 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | 232,013 | 188,790 | −43,223 | 1 / 0 / 1 |
| all | 232,013 | 188,790 | −43,223 | 1 / 0 / 1 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | 17,253 | 12,470 | −4,782 | 2 / 0 / 0 |
| all | 17,253 | 12,470 | −4,782 | 2 / 0 / 0 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | 251,924 | 203,603 | −48,321 | 1 / 0 / 1 |
| all | 251,924 | 203,603 | −48,321 | 1 / 0 / 1 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | $0.0706 | $0.0552 | −$0.0154 | 2 / 0 / 0 |
| all | $0.0706 | $0.0552 | −$0.0154 | 2 / 0 / 0 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | 31.8 s | 26.8 s | −5.1 s | 1 / 0 / 1 |
| all | 31.8 s | 26.8 s | −5.1 s | 1 / 0 / 1 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| express | $0.2823 (4 runs) | $0.2209 (4 runs) | none | none |
| all | $0.2823 (4 runs) | $0.2209 (4 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| express/x037 | without | 2/2 | 13 [11–14] | 110 [98–122] | 2,732 [2,601–2,863] | 250,526 [211,220–289,831] | 17,828 [17,250–18,406] | $0.0745 [$0.0687–$0.0802] | 35.4 s [35.1 s–35.7 s] |
| express/x037 | with | 2/2 | 14 [10–17] | 114 [90–138] | 2,996 [2,879–3,113] | 291,645 [220,486–362,804] | 12,438 [11,755–13,120] | $0.0691 [$0.0628–$0.0755] | 35.9 s [33.2 s–38.6 s] |
| express/x038 | without | 2/2 | 12 [11–13] | 98 [90–106] | 2,377 [2,226–2,528] | 213,501 [188,935–238,066] | 16,677 [16,261–17,093] | $0.0667 [$0.0643–$0.0691] | 28.3 s [26.3 s–30.3 s] |
| express/x038 | with | 2/2 | 6 [5–6] | 38 [34–42] | 1,537 [1,362–1,712] | 85,936 [75,130–96,741] | 12,503 [12,484–12,522] | $0.0413 [$0.0393–$0.0433] | 17.7 s [15.9 s–19.4 s] |

