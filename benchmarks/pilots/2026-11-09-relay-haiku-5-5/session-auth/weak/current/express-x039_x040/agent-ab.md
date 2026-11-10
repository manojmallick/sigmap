# Agent-level A/B — measured tool calls, tokens and cost

**claude-code 2.1.322 (Claude Code) · claude-haiku-4-5 · 2026-11-10 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap generated context + MCP server.
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
| Tool calls | −60% | −50% | fewer in every repetition |
| Input tokens (uncached) | −57% | −39% | fewer in every repetition |
| Output tokens | −53% | −50% | fewer in every repetition |
| Cache-read tokens | −60% | −33% | fewer in every repetition |
| Cache-write tokens | −39% | −69% | fewer in every repetition |
| Total tokens (derived) | −57% | −38% | fewer in every repetition |
| Cost | −46% | −58% | fewer in every repetition |
| Wall time | −47% | −41% | fewer in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −62% [−75%, −43%] | −52% [−63%, −38%] | fewer in every repetition, outside the noise |
| Input tokens (uncached) | −57% [−65%, −48%] | −38% [−54%, −16%] | fewer in every repetition, outside the noise |
| Output tokens | −52% [−76%, −7%] | −51% [−58%, −41%] | fewer in every repetition, outside the noise |
| Cache-read tokens | −60% [−60%, −59%] | −33% [−48%, −12%] | fewer in every repetition, outside the noise |
| Cache-write tokens | −41% [−44%, −38%] | −67% [−78%, −48%] | fewer in every repetition, outside the noise |
| Total tokens (derived) | −57% [−59%, −55%] | −38% [−49%, −25%] | fewer in every repetition, outside the noise |
| Cost | −49% [−57%, −39%] | −57% [−63%, −51%] | fewer in every repetition, outside the noise |
| Wall time | −46% [−64%, −19%] | −41% [−48%, −33%] | fewer in every repetition, outside the noise |

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
| express | 8 | 4 | −4 | 2 / 0 / 0 |
| all | 8 | 4 | −4 | 2 / 0 / 0 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | 66 | 34 | −32 | 2 / 0 / 0 |
| all | 66 | 34 | −32 | 2 / 0 / 0 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | 1,838 | 882 | −955 | 2 / 0 / 0 |
| all | 1,838 | 882 | −955 | 2 / 0 / 0 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | 120,150 | 63,561 | −56,588 | 2 / 0 / 0 |
| all | 120,150 | 63,561 | −56,588 | 2 / 0 / 0 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | 18,802 | 8,940 | −9,862 | 2 / 0 / 0 |
| all | 18,802 | 8,940 | −9,862 | 2 / 0 / 0 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | 140,855 | 73,417 | −67,438 | 2 / 0 / 0 |
| all | 140,855 | 73,417 | −67,438 | 2 / 0 / 0 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | $0.0589 | $0.0287 | −$0.0302 | 2 / 0 / 0 |
| all | $0.0589 | $0.0287 | −$0.0302 | 2 / 0 / 0 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | 23.7 s | 13.2 s | −10.5 s | 2 / 0 / 0 |
| all | 23.7 s | 13.2 s | −10.5 s | 2 / 0 / 0 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| express | $0.2355 (4 runs) | $0.1147 (4 runs) | none | none |
| all | $0.2355 (4 runs) | $0.1147 (4 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| express/x039 | without | 2/2 | 8 [7–8] | 58 [50–66] | 1,437 [1,214–1,660] | 114,104 [97,015–131,193] | 27,041 [22,804–31,278] | $0.0727 [$0.0637–$0.0818] | 19.5 s [18.9 s–20.2 s] |
| express/x039 | with | 2/2 | 5 [4–5] | 38 [34–42] | 1,053 [978–1,128] | 69,270 [53,463–85,076] | 12,210 [4,960–19,459] | $0.0366 [$0.0234–$0.0499] | 14.4 s [13.6 s–15.2 s] |
| express/x040 | without | 2/2 | 8 [8–8] | 74 [74–74] | 2,238 [1,927–2,549] | 126,195 [123,570–128,820] | 10,562 [10,473–10,651] | $0.0450 [$0.0439–$0.0461] | 27.9 s [25.0 s–30.8 s] |
| express/x040 | with | 2/2 | 3 [2–3] | 30 [26–34] | 712 [623–800] | 57,853 [49,336–66,370] | 5,670 [5,486–5,853] | $0.0207 [$0.0198–$0.0216] | 12.0 s [11.0 s–13.1 s] |

