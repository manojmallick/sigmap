# Agent-level A/B — measured tool calls, tokens and cost

**claude-code 2.1.322 (Claude Code) · claude-haiku-4-5 · 2026-11-10 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap generated context + MCP server.
- Both arms: the same prompt, model, tool allowlist (Read, Grep, Glob, Bash), per-run budget cap $1 and timeout 420 s; run in a clean copy of the commit pinned in `benchmarks/xrepo-repos.json`.
- Questions: the task id(s) x029, x030, x031 of `benchmarks/tasks/retrieval-xrepo.jsonl`. Pass = hit@5 on the repository-relative paths the answer names.
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
| django | 3 | 6/6 | 6/6 | 0 / 0 |
| all | 3 | 6/6 | 6/6 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 3. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −26% | −33% | fewer in every repetition |
| Input tokens (uncached) | −34% | −20% | fewer in every repetition |
| Output tokens | −26% | −11% | fewer in every repetition |
| Cache-read tokens | −28% | +12% | mixed |
| Cache-write tokens | −29% | +9% | mixed |
| Total tokens (derived) | −28% | +11% | mixed |
| Cost | −28% | +6% | mixed |
| Wall time | −20% | −7% | fewer in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −23% [−58%, +67%] † | −36% [−50%, −15%] | fewer in every repetition, within the noise |
| Input tokens (uncached) | −29% [−53%, +55%] † | −23% [−44%, −8%] | fewer in every repetition, within the noise |
| Output tokens | −26% [−39%, −2%] | −16% [−40%, +35%] † | fewer in every repetition, within the noise |
| Cache-read tokens | −17% [−51%, +96%] † | +2% [−42%, +35%] † | mixed |
| Cache-write tokens | −27% [−38%, −21%] | +2% [−36%, +31%] † | mixed |
| Total tokens (derived) | −18% [−51%, +78%] † | +2% [−42%, +35%] † | mixed |
| Cost | −25% [−42%, +4%] † | −2% [−39%, +33%] † | fewer in every repetition, within the noise |
| Wall time | −18% [−33%, +4%] † | −10% [−35%, +31%] † | fewer in every repetition, within the noise |

### Outcome (hit@5), by repetition

Per paired task: **better** = the SigMap arm named the file and the other did not; **worse** = the reverse; **tie** = both found it or both missed. Localisation only.

| repetition | paired tasks | better | worse | tie |
| --- | ---: | ---: | ---: | ---: |
| R1 | 3 | 0 | 0 | 3 |
| R2 | 3 | 0 | 0 | 3 |
| all | 6 | 0 | 0 | 6 |

## Tool calls

Provenance: agent-reported (main-thread tool_use blocks). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | 11 | 11 | −6 | 2 / 0 / 1 |
| all | 11 | 11 | −6 | 2 / 0 / 1 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | 98 | 78 | −48 | 2 / 0 / 1 |
| all | 98 | 78 | −48 | 2 / 0 / 1 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | 2,594 | 2,371 | −938 | 2 / 0 / 1 |
| all | 2,594 | 2,371 | −938 | 2 / 0 / 1 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | 184,406 | 236,898 | −74,602 | 2 / 0 / 1 |
| all | 184,406 | 236,898 | −74,602 | 2 / 0 / 1 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | 17,485 | 18,076 | −3,531 | 2 / 0 / 1 |
| all | 17,485 | 18,076 | −3,531 | 2 / 0 / 1 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | 201,086 | 257,610 | −79,636 | 2 / 0 / 1 |
| all | 201,086 | 257,610 | −79,636 | 2 / 0 / 1 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | $0.0646 | $0.0721 | −$0.0206 | 2 / 0 / 1 |
| all | $0.0646 | $0.0721 | −$0.0206 | 2 / 0 / 1 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | 33.5 s | 29.2 s | −9.3 s | 2 / 0 / 1 |
| all | 33.5 s | 29.2 s | −9.3 s | 2 / 0 / 1 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| django | $0.4362 (6 runs) | $0.3768 (6 runs) | none | none |
| all | $0.4362 (6 runs) | $0.3768 (6 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| django/x029 | without | 2/2 | 10 [6–13] | 82 [58–106] | 2,456 [2,406–2,506] | 173,112 [109,834–236,390] | 17,485 [16,786–18,183] | $0.0646 [$0.0594–$0.0698] | 29.9 s [28.6 s–31.3 s] |
| django/x029 | with | 2/2 | 11 [10–11] | 94 [90–98] | 2,864 [2,356–3,371] | 267,725 [215,354–320,095] | 18,076 [14,232–21,919] | $0.0773 [$0.0619–$0.0928] | 35.3 s [29.8 s–40.9 s] |
| django/x030 | without | 2/2 | 11 [10–12] | 98 [90–106] | 2,594 [2,424–2,764] | 184,406 [174,173–194,638] | 13,988 [13,853–14,123] | $0.0595 [$0.0573–$0.0616] | 33.5 s [32.5 s–34.5 s] |
| django/x030 | with | 2/2 | 5 [5–5] | 50 [50–50] | 1,562 [1,451–1,673] | 109,804 [100,925–118,682] | 10,034 [8,919–11,149] | $0.0389 [$0.0352–$0.0426] | 24.2 s [21.3 s–27.0 s] |
| django/x031 | without | 2/2 | 17 [13–20] | 126 [82–170] | 3,309 [2,902–3,715] | 337,387 [169,795–504,978] | 21,794 [14,692–28,896] | $0.0940 [$0.0610–$0.1270] | 39.0 s [33.5 s–44.5 s] |
| django/x031 | with | 2/2 | 11 [8–13] | 78 [74–82] | 2,371 [2,173–2,569] | 236,898 [228,619–245,177] | 18,263 [17,943–18,583] | $0.0721 [$0.0710–$0.0733] | 29.2 s [28.7 s–29.8 s] |

