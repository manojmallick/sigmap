# Agent-level A/B — measured tool calls, tokens and cost

**claude-code 2.1.322 (Claude Code) · claude-haiku-5-5 · 2026-11-10 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap as one on-demand skill (sigmap-locate) + the sigmap CLI: no MCP server, no always-on section.
- Both arms: the same prompt, model, tool allowlist (Read, Grep, Glob, Bash), per-run budget cap $0.5 and timeout 420 s; run in a clean copy of the commit pinned in `benchmarks/xrepo-repos.json`.
- Questions: the task id(s) x084, x085, x086, x087, x088 of `benchmarks/tasks/retrieval-xrepo.jsonl`. Pass = hit@5 on the repository-relative paths the answer names.
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
| rails | 5 | 10/10 | 8/10 | 0 / 0 |
| all | 5 | 10/10 | 8/10 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 5. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −25% | −52% | fewer in every repetition |
| Input tokens (uncached) | −32% | −40% | fewer in every repetition |
| Output tokens | −3% | −26% | fewer in every repetition |
| Cache-read tokens | −40% | −47% | fewer in every repetition |
| Cache-write tokens | −8% | −19% | fewer in every repetition |
| Total tokens (derived) | −33% | −42% | fewer in every repetition |
| Cost | −12% | −25% | fewer in every repetition |
| Wall time | −7% | −21% | fewer in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −28% [−43%, −11%] | −57% [−78%, −26%] | fewer in every repetition, outside the noise |
| Input tokens (uncached) | −32% [−36%, −27%] | −39% [−57%, −18%] | fewer in every repetition, outside the noise |
| Output tokens | −5% [−12%, +6%] † | −23% [−33%, −12%] | fewer in every repetition, within the noise |
| Cache-read tokens | −40% [−45%, −33%] | −45% [−67%, −15%] | fewer in every repetition, outside the noise |
| Cache-write tokens | −8% [−14%, −3%] | −17% [−38%, +5%] † | fewer in every repetition, within the noise |
| Total tokens (derived) | −33% [−37%, −28%] | −40% [−62%, −12%] | fewer in every repetition, outside the noise |
| Cost | −12% [−13%, −10%] | −23% [−42%, −2%] | fewer in every repetition, outside the noise |
| Wall time | −7% [−14%, −1%] | −19% [−32%, −9%] | fewer in every repetition, outside the noise |

### Outcome (hit@5), by repetition

Per paired task: **better** = the SigMap arm named the file and the other did not; **worse** = the reverse; **tie** = both found it or both missed. Localisation only.

| repetition | paired tasks | better | worse | tie |
| --- | ---: | ---: | ---: | ---: |
| R1 | 5 | 0 | 1 | 4 |
| R2 | 5 | 0 | 1 | 4 |
| all | 10 | 0 | 2 | 8 |

## Tool calls

Provenance: agent-reported (main-thread tool_use blocks). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | 5 | 3 | −1 | 5 / 0 / 0 |
| all | 5 | 3 | −1 | 5 / 0 / 0 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | 8 | 5 | −3 | 5 / 0 / 0 |
| all | 8 | 5 | −3 | 5 / 0 / 0 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | 1,489 | 1,153 | −195 | 5 / 0 / 0 |
| all | 1,489 | 1,153 | −195 | 5 / 0 / 0 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | 58,957 | 34,105 | −25,227 | 5 / 0 / 0 |
| all | 58,957 | 34,105 | −25,227 | 5 / 0 / 0 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | 10,282 | 10,111 | −808 | 4 / 0 / 1 |
| all | 10,282 | 10,111 | −808 | 4 / 0 / 1 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | 70,290 | 45,076 | −24,928 | 5 / 0 / 0 |
| all | 70,290 | 45,076 | −24,928 | 5 / 0 / 0 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | $0.0033 | $0.0028 | −$0.0004 | 5 / 0 / 0 |
| all | $0.0033 | $0.0028 | −$0.0004 | 5 / 0 / 0 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | 13.0 s | 11.7 s | −1.6 s | 5 / 0 / 0 |
| all | 13.0 s | 11.7 s | −1.6 s | 5 / 0 / 0 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| rails | $0.0385 (10 runs) | $0.0315 (10 runs) | none | none |
| all | $0.0385 (10 runs) | $0.0315 (10 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| rails/x084 | without | 2/2 | 3 [2–3] | 6 [6–6] | 920 [911–928] | 41,438 [39,717–43,158] | 10,282 [9,007–11,556] | $0.0029 [$0.0027–$0.0032] | 9.9 s [9.6 s–10.1 s] |
| rails/x084 | with | 2/2 | 2 [1–2] | 5 [4–6] | 856 [845–866] | 34,105 [23,001–45,208] | 10,111 [9,931–10,291] | $0.0028 [$0.0027–$0.0029] | 9.2 s [9.1 s–9.3 s] |
| rails/x085 | without | 2/2 | 5 [4–5] | 8 [8–8] | 1,489 [1,294–1,684] | 58,957 [56,902–61,011] | 9,837 [7,764–11,909] | $0.0033 [$0.0028–$0.0038] | 12.4 s [12.1 s–12.7 s] |
| rails/x085 | with | 2/2 | 3 [2–3] | 5 [4–6] | 1,153 [874–1,431] | 33,175 [26,523–39,827] | 9,029 [6,736–11,321] | $0.0027 [$0.0020–$0.0034] | 10.8 s [9.6 s–12.1 s] |
| rails/x086 | without | 2/2 | 3 [2–3] | 6 [6–6] | 920 [910–929] | 41,774 [39,863–43,684] | 9,250 [7,984–10,516] | $0.0027 [$0.0025–$0.0030] | 13.0 s [10.2 s–15.7 s] |
| rails/x086 | with | 2/2 | 2 [1–2] | 4 [4–4] | 797 [712–881] | 24,788 [23,017–26,559] | 8,188 [6,332–10,044] | $0.0023 [$0.0019–$0.0027] | 11.7 s [9.6 s–13.8 s] |
| rails/x087 | without | 2/2 | 7 [5–8] | 10 [8–12] | 2,241 [1,890–2,591] | 90,193 [61,864–118,522] | 17,816 [16,239–19,393] | $0.0056 [$0.0048–$0.0064] | 18.8 s [15.6 s–22.0 s] |
| rails/x087 | with | 0/2 | 3 [1–4] | 5 [4–6] | 1,911 [1,589–2,232] | 34,299 [26,523–42,075] | 11,173 [9,082–13,264] | $0.0035 [$0.0029–$0.0042] | 14.4 s [12.7 s–16.0 s] |
| rails/x088 | without | 2/2 | 6 [5–6] | 9 [8–10] | 1,695 [1,627–1,763] | 69,727 [59,709–79,745] | 15,783 [13,870–17,695] | $0.0047 [$0.0042–$0.0052] | 15.7 s [14.5 s–16.9 s] |
| rails/x088 | with | 2/2 | 5 [5–5] | 6 [6–6] | 1,501 [1,421–1,580] | 44,500 [39,907–49,093] | 16,279 [15,118–17,440] | $0.0045 [$0.0042–$0.0047] | 13.4 s [13.2 s–13.5 s] |

