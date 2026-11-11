# Agent-level A/B — measured tool calls, tokens and cost

**claude-code 2.1.322 (Claude Code) · claude-haiku-5-5 · 2026-11-11 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap ranked the question BEFORE the first turn (what a prompt hook would inject): the five likeliest files with their signatures and line anchors in the prompt, + the sigmap CLI; no MCP server, no standing section, no extra tool call.
- Both arms: the same prompt, model, tool allowlist (Read, Grep, Glob, Bash), per-run budget cap $0.5 and timeout 420 s; run in a clean copy of the commit pinned in `benchmarks/xrepo-repos.json`.
- Questions: the task id(s) x027, x028, x029, x030, x031 of `benchmarks/tasks/retrieval-xrepo.jsonl`. Pass = hit@5 on the repository-relative paths the answer names.
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
| django | 5 | 10/10 | 10/10 | 0 / 0 |
| all | 5 | 10/10 | 10/10 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 5. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −48% | −52% | fewer in every repetition |
| Input tokens (uncached) | −33% | −29% | fewer in every repetition |
| Output tokens | −4% | −19% | fewer in every repetition |
| Cache-read tokens | −39% | −24% | fewer in every repetition |
| Cache-write tokens | +55% | −30% | mixed |
| Total tokens (derived) | −23% | −25% | fewer in every repetition |
| Cost | +26% | −27% | mixed |
| Wall time | −9% | −18% | fewer in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −50% [−70%, −15%] | −60% [−70%, −43%] | fewer in every repetition, outside the noise |
| Input tokens (uncached) | −33% [−52%, −8%] | −31% [−33%, −26%] | fewer in every repetition, outside the noise |
| Output tokens | +4% [−32%, +48%] † | −15% [−31%, +5%] † | mixed |
| Cache-read tokens | −39% [−61%, −4%] | −28% [−35%, −21%] | fewer in every repetition, outside the noise |
| Cache-write tokens | +53% [+38%, +69%] | −36% [−54%, −16%] | mixed |
| Total tokens (derived) | −21% [−42%, +8%] † | −29% [−39%, −19%] | fewer in every repetition, within the noise |
| Cost | +28% [+14%, +45%] | −30% [−47%, −14%] | mixed |
| Wall time | −7% [−31%, +20%] † | −17% [−28%, −4%] | fewer in every repetition, within the noise |

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
| django | 4 | 2 | −2 | 5 / 0 / 0 |
| all | 4 | 2 | −2 | 5 / 0 / 0 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | 6 | 5 | −2 | 5 / 0 / 0 |
| all | 6 | 5 | −2 | 5 / 0 / 0 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | 916 | 1,020 | +105 | 2 / 0 / 3 |
| all | 916 | 1,020 | +105 | 2 / 0 / 3 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | 28,693 | 24,410 | −11,531 | 5 / 0 / 0 |
| all | 28,693 | 24,410 | −11,531 | 5 / 0 / 0 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | 7,714 | 6,768 | +849 | 2 / 0 / 3 |
| all | 7,714 | 6,768 | +849 | 2 / 0 / 3 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | 37,328 | 31,875 | −12,606 | 5 / 0 / 0 |
| all | 37,328 | 31,875 | −12,606 | 5 / 0 / 0 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | $0.0023 | $0.0020 | −$0.0001 | 3 / 0 / 2 |
| all | $0.0023 | $0.0020 | −$0.0001 | 3 / 0 / 2 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | 10.1 s | 10.5 s | −376 ms | 4 / 0 / 1 |
| all | 10.1 s | 10.5 s | −376 ms | 4 / 0 / 1 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| django | $0.0263 (10 runs) | $0.0255 (10 runs) | none | none |
| all | $0.0263 (10 runs) | $0.0255 (10 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| django/x027 | without | 2/2 | 4 [4–4] | 6 [6–6] | 956 [938–973] | 27,252 [26,672–27,831] | 5,722 [5,565–5,879] | $0.0019 [$0.0019–$0.0019] | 10.1 s [9.8 s–10.5 s] |
| django/x027 | with | 2/2 | 3 [1–5] | 5 [4–6] | 1,238 [1,021–1,455] | 25,290 [21,034–29,546] | 7,317 [4,218–10,415] | $0.0023 [$0.0016–$0.0031] | 10.7 s [9.3 s–12.1 s] |
| django/x028 | without | 2/2 | 4 [4–4] | 6 [6–6] | 916 [908–923] | 28,693 [26,970–30,415] | 7,714 [6,596–8,832] | $0.0023 [$0.0020–$0.0025] | 9.4 s [9.1 s–9.8 s] |
| django/x028 | with | 2/2 | 2 [2–2] | 4 [4–4] | 789 [760–818] | 17,162 [15,460–18,864] | 6,768 [4,925–8,610] | $0.0019 [$0.0016–$0.0023] | 8.4 s [8.2 s–8.6 s] |
| django/x029 | without | 2/2 | 3 [3–3] | 6 [6–6] | 823 [787–859] | 26,843 [26,545–27,141] | 5,665 [5,065–6,264] | $0.0018 [$0.0017–$0.0019] | 9.6 s [8.8 s–10.5 s] |
| django/x029 | with | 2/2 | 2 [1–2] | 5 [4–6] | 947 [926–967] | 24,410 [20,188–28,631] | 6,514 [3,916–9,111] | $0.0020 [$0.0014–$0.0026] | 9.6 s [8.9 s–10.2 s] |
| django/x030 | without | 2/2 | 3 [3–3] | 7 [6–8] | 915 [838–991] | 35,248 [31,705–38,790] | 8,700 [6,596–10,804] | $0.0026 [$0.0021–$0.0030] | 10.9 s [10.4 s–11.4 s] |
| django/x030 | with | 2/2 | 1 [1–1] | 4 [4–4] | 1,020 [693–1,346] | 18,231 [16,172–20,290] | 6,557 [3,692–9,421] | $0.0020 [$0.0013–$0.0027] | 10.5 s [7.6 s–13.5 s] |
| django/x031 | without | 2/2 | 8 [7–9] | 10 [10–10] | 2,346 [2,267–2,424] | 68,767 [56,674–80,859] | 13,605 [9,964–17,246] | $0.0046 [$0.0038–$0.0054] | 18.2 s [17.5 s–18.8 s] |
| django/x031 | with | 2/2 | 4 [2–5] | 6 [4–8] | 1,280 [1,141–1,418] | 43,346 [16,796–69,895] | 16,921 [16,708–17,133] | $0.0045 [$0.0042–$0.0048] | 11.3 s [10.1 s–12.5 s] |

