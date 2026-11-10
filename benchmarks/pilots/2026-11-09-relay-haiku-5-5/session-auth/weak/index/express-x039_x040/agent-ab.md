# Agent-level A/B — measured tool calls, tokens and cost

**claude-code 2.1.322 (Claude Code) · claude-haiku-4-5 · 2026-11-10 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap index strategy + 7-tool core MCP profile (the docs' setup for an agent that calls the tools).
- Both arms: the same prompt, model, tool allowlist (Read, Grep, Glob, Bash), per-run budget cap $1 and timeout 420 s; run in a clean copy of the commit pinned in `benchmarks/xrepo-repos.json`.
- Questions: the task id(s) x039, x040 of `benchmarks/tasks/retrieval-xrepo.jsonl`. Pass = hit@5 on the repository-relative paths the answer names.
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
| Tool calls | −57% | −65% | fewer in every repetition |
| Input tokens (uncached) | −54% | −64% | fewer in every repetition |
| Output tokens | −45% | −49% | fewer in every repetition |
| Cache-read tokens | −56% | −62% | fewer in every repetition |
| Cache-write tokens | −34% | +58% | mixed |
| Total tokens (derived) | −54% | −54% | fewer in every repetition |
| Cost | −43% | −8% | fewer in every repetition |
| Wall time | −35% | −42% | fewer in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −65% [−83%, −27%] | −66% [−77%, −50%] | fewer in every repetition, outside the noise |
| Input tokens (uncached) | −55% [−73%, −24%] | −64% [−65%, −62%] | fewer in every repetition, outside the noise |
| Output tokens | −46% [−60%, −27%] | −49% [−61%, −33%] | fewer in every repetition, outside the noise |
| Cache-read tokens | −58% [−80%, −13%] | −62% [−66%, −56%] | fewer in every repetition, outside the noise |
| Cache-write tokens | −35% [−59%, +2%] † | +52% [+10%, +111%] | mixed |
| Total tokens (derived) | −56% [−78%, −12%] | −55% [−62%, −46%] | fewer in every repetition, outside the noise |
| Cost | −44% [−66%, −9%] | −10% [−33%, +22%] † | fewer in every repetition, within the noise |
| Wall time | −34% [−48%, −17%] | −42% [−50%, −32%] | fewer in every repetition, outside the noise |

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
| express | 12 | 5 | −7 | 2 / 0 / 0 |
| all | 12 | 5 | −7 | 2 / 0 / 0 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | 88 | 36 | −52 | 2 / 0 / 0 |
| all | 88 | 36 | −52 | 2 / 0 / 0 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | 2,354 | 1,252 | −1,102 | 2 / 0 / 0 |
| all | 2,354 | 1,252 | −1,102 | 2 / 0 / 0 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | 160,135 | 65,656 | −94,479 | 2 / 0 / 0 |
| all | 160,135 | 65,656 | −94,479 | 2 / 0 / 0 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | 11,412 | 12,403 | +991 | 1 / 0 / 1 |
| all | 11,412 | 12,403 | +991 | 1 / 0 / 1 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | 173,989 | 79,347 | −94,642 | 2 / 0 / 0 |
| all | 173,989 | 79,347 | −94,642 | 2 / 0 / 0 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | $0.0507 | $0.0377 | −$0.0130 | 1 / 0 / 1 |
| all | $0.0507 | $0.0377 | −$0.0130 | 1 / 0 / 1 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | 27.4 s | 16.9 s | −10.5 s | 2 / 0 / 0 |
| all | 27.4 s | 16.9 s | −10.5 s | 2 / 0 / 0 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| express | $0.2028 (4 runs) | $0.1507 (4 runs) | none | none |
| all | $0.2028 (4 runs) | $0.1507 (4 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| express/x039 | without | 2/2 | 11 [10–11] | 78 [66–90] | 2,121 [2,067–2,175] | 132,300 [106,075–158,524] | 10,025 [9,974–10,075] | $0.0440 [$0.0415–$0.0464] | 23.8 s [23.1 s–24.5 s] |
| express/x039 | with | 2/2 | 7 [5–8] | 42 [34–50] | 1,486 [1,380–1,591] | 81,193 [69,948–92,438] | 15,707 [10,166–21,248] | $0.0470 [$0.0376–$0.0564] | 17.9 s [16.7 s–19.1 s] |
| express/x040 | without | 2/2 | 13 [12–13] | 98 [98–98] | 2,587 [2,575–2,598] | 187,971 [180,835–195,106] | 12,800 [11,107–14,492] | $0.0574 [$0.0534–$0.0615] | 31.0 s [29.3 s–32.7 s] |
| express/x040 | with | 2/2 | 3 [2–3] | 30 [26–34] | 1,019 [1,008–1,030] | 50,119 [39,581–60,657] | 9,099 [5,995–12,202] | $0.0283 [$0.0211–$0.0355] | 15.9 s [14.7 s–17.1 s] |

