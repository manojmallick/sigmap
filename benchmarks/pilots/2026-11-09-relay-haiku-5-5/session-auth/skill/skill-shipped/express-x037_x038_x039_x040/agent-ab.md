# Agent-level A/B — measured tool calls, tokens and cost

**claude-code 2.1.322 (Claude Code) · claude-haiku-5-5 · 2026-11-10 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap as the three skills `sigmap skills install --client claude` writes + the sigmap CLI: no MCP server, no always-on section.
- Both arms: the same prompt, model, tool allowlist (Read, Grep, Glob, Bash), per-run budget cap $0.5 and timeout 420 s; run in a clean copy of the commit pinned in `benchmarks/xrepo-repos.json`.
- Questions: the task id(s) x037, x038, x039, x040 of `benchmarks/tasks/retrieval-xrepo.jsonl`. Pass = hit@5 on the repository-relative paths the answer names.
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
| express | 4 | 8/8 | 8/8 | 0 / 0 |
| all | 4 | 8/8 | 8/8 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 4. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −15% | 0% | mixed |
| Input tokens (uncached) | −23% | −7% | fewer in every repetition |
| Output tokens | −1% | +5% | mixed |
| Cache-read tokens | −27% | −7% | fewer in every repetition |
| Cache-write tokens | −1% | +4% | mixed |
| Total tokens (derived) | −22% | −5% | fewer in every repetition |
| Cost | −5% | +2% | mixed |
| Wall time | −3% | +6% | mixed |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −15% [−27%, 0%] † | 0% [−19%, +24%] † | mixed |
| Input tokens (uncached) | −24% [−33%, −10%] | −7% [−25%, +15%] † | fewer in every repetition, within the noise |
| Output tokens | 0% [−12%, +9%] † | +6% [−10%, +20%] † | more in every repetition, within the noise |
| Cache-read tokens | −28% [−40%, −11%] | −7% [−28%, +23%] † | fewer in every repetition, within the noise |
| Cache-write tokens | −1% [−16%, +10%] † | +4% [+2%, +6%] | mixed |
| Total tokens (derived) | −23% [−34%, −8%] | −5% [−24%, +20%] † | fewer in every repetition, within the noise |
| Cost | −6% [−17%, +1%] † | +2% [−5%, +10%] † | mixed |
| Wall time | −3% [−9%, +1%] † | +6% [−5%, +14%] † | mixed |

### Outcome (hit@5), by repetition

Per paired task: **better** = the SigMap arm named the file and the other did not; **worse** = the reverse; **tie** = both found it or both missed. Localisation only.

| repetition | paired tasks | better | worse | tie |
| --- | ---: | ---: | ---: | ---: |
| R1 | 4 | 0 | 0 | 4 |
| R2 | 4 | 0 | 0 | 4 |
| all | 8 | 0 | 0 | 8 |

## Tool calls

Provenance: agent-reported (main-thread tool_use blocks). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | 3 | 3 | −0 | 2 / 1 / 1 |
| all | 3 | 3 | −0 | 2 / 1 / 1 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | 7 | 6 | −1 | 3 / 1 / 0 |
| all | 7 | 6 | −1 | 3 / 1 / 0 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | 790 | 805 | +74 | 1 / 0 / 3 |
| all | 790 | 805 | +74 | 1 / 0 / 3 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | 38,373 | 35,527 | −6,726 | 3 / 0 / 1 |
| all | 38,373 | 35,527 | −6,726 | 3 / 0 / 1 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | 7,912 | 8,140 | +321 | 1 / 0 / 3 |
| all | 7,912 | 8,140 | +321 | 1 / 0 / 3 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | 47,298 | 44,309 | −6,333 | 3 / 0 / 1 |
| all | 47,298 | 44,309 | −6,333 | 3 / 0 / 1 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | $0.0024 | $0.0024 | −$0.0000 | 2 / 0 / 2 |
| all | $0.0024 | $0.0024 | −$0.0000 | 2 / 0 / 2 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | 10.6 s | 10.5 s | +299 ms | 1 / 0 / 3 |
| all | 10.6 s | 10.5 s | +299 ms | 1 / 0 / 3 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| express | $0.0192 (8 runs) | $0.0189 (8 runs) | none | none |
| all | $0.0192 (8 runs) | $0.0189 (8 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| express/x037 | without | 2/2 | 4 [3–4] | 7 [6–8] | 882 [869–895] | 42,022 [34,878–49,165] | 8,040 [7,724–8,356] | $0.0025 [$0.0025–$0.0025] | 11.3 s [11.0 s–11.5 s] |
| express/x037 | with | 2/2 | 4 [3–4] | 6 [6–6] | 966 [923–1,009] | 35,328 [35,142–35,514] | 8,372 [8,307–8,436] | $0.0025 [$0.0025–$0.0025] | 11.7 s [11.1 s–12.2 s] |
| express/x038 | without | 2/2 | 5 [4–5] | 8 [8–8] | 1,010 [969–1,051] | 49,692 [49,607–49,777] | 7,784 [7,626–7,942] | $0.0026 [$0.0025–$0.0026] | 11.4 s [11.3 s–11.5 s] |
| express/x038 | with | 2/2 | 4 [3–4] | 6 [6–6] | 841 [806–875] | 35,856 [35,254–36,457] | 8,401 [7,762–9,040] | $0.0025 [$0.0023–$0.0026] | 10.9 s [10.3 s–11.5 s] |
| express/x039 | without | 2/2 | 3 [3–3] | 6 [6–6] | 698 [620–776] | 34,724 [34,636–34,811] | 7,598 [7,499–7,697] | $0.0022 [$0.0022–$0.0022] | 9.6 s [9.4 s–9.7 s] |
| express/x039 | with | 2/2 | 3 [2–3] | 5 [4–6] | 761 [659–863] | 27,965 [20,867–35,062] | 7,909 [7,873–7,945] | $0.0022 [$0.0022–$0.0023] | 10.1 s [9.9 s–10.4 s] |
| express/x040 | without | 2/2 | 3 [2–3] | 6 [6–6] | 677 [660–693] | 34,710 [34,273–35,147] | 8,252 [8,070–8,434] | $0.0023 [$0.0023–$0.0024] | 9.9 s [9.8 s–10.1 s] |
| express/x040 | with | 2/2 | 3 [2–4] | 6 [4–8] | 769 [674–864] | 35,726 [20,881–50,570] | 7,446 [6,522–8,369] | $0.0022 [$0.0019–$0.0026] | 10.1 s [8.7 s–11.6 s] |

