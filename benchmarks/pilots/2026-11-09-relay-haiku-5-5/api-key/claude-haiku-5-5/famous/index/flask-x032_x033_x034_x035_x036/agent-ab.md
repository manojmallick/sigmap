# Agent-level A/B — measured tool calls, tokens and cost

**anthropic-messages-api direct Messages API · claude-haiku-5-5 · 2026-11-11 · 4 runs per arm · publishable**

- Arms: **without** = no SigMap; **with** = SigMap index strategy + 7-tool core MCP profile (the docs' setup for an agent that calls the tools).
- Both arms: the same prompt, model, tool allowlist (Read, Grep, Glob, Bash), per-run budget cap $0.25 and timeout 420 s; run in a clean copy of the commit pinned in `benchmarks/xrepo-repos.json`.
- Questions: the task id(s) x032, x033, x034, x035, x036 of `benchmarks/tasks/retrieval-xrepo.jsonl`. Pass = hit@5 on the repository-relative paths the answer names.
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
- Direct Messages API agent (scripts/lib/agent-ab-api.mjs), not Claude Code: a short neutral system prompt (about 150 tokens) and four read-only tools, so the prefix each turn re-reads is far smaller than Claude Code's and SigMap's per-turn addition is a larger share of a turn. Cost is computed from the usage the API reports and a price table (the Console's usage page is the authority), with 5-minute prompt caching. Not comparable cell by cell with Claude Code runs.

## Outcome

| repo | tasks | pass without | pass with | failed runs (without / with) |
| --- | ---: | ---: | ---: | ---: |
| flask | 5 | 20/20 | 20/20 | 0 / 0 |
| all | 5 | 20/20 | 20/20 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2, R3, R4) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 5. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | R3 | R4 | verdict |
| --- | ---: | ---: | ---: | ---: | ---: |
| Tool calls | −58% | −50% | −39% | −67% | fewer in every repetition |
| Input tokens (uncached) | −1% | −1% | −1% | −2% | fewer in every repetition |
| Output tokens | −29% | −28% | −30% | −25% | fewer in every repetition |
| Cache-read tokens | −11% | −14% | −1% | −38% | fewer in every repetition |
| Cache-write tokens | −57% | −73% | −62% | −73% | fewer in every repetition |
| Total tokens (derived) | −29% | −36% | −23% | −49% | fewer in every repetition |
| Cost | −44% | −54% | −46% | −56% | fewer in every repetition |
| Wall time | −22% | −25% | −25% | −28% | fewer in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | R3 | R4 | verdict |
| --- | ---: | ---: | ---: | ---: | ---: |
| Tool calls | −56% [−76%, −26%] | −51% [−65%, −26%] | −38% [−74%, +55%] † | −66% [−82%, −33%] | fewer in every repetition, within the noise |
| Input tokens (uncached) | −1% [−2%, 0%] | −1% [−2%, 0%] | −1% [−2%, +1%] † | −2% [−3%, −1%] | fewer in every repetition, within the noise |
| Output tokens | −24% [−41%, −7%] | −25% [−39%, −8%] | −28% [−44%, −11%] | −26% [−39%, −10%] | fewer in every repetition, outside the noise |
| Cache-read tokens | +12% [−54%, +96%] † | +18% [−38%, +114%] † | +32% [−53%, +336%] † | −28% [−64%, +32%] † | mixed |
| Cache-write tokens | −51% [−70%, −27%] | −74% [−85%, −49%] | −61% [−79%, −28%] | −77% [−87%, −57%] | fewer in every repetition, outside the noise |
| Total tokens (derived) | −13% [−59%, +48%] † | −25% [−53%, +28%] † | −15% [−61%, +102%] † | −43% [−69%, −1%] | fewer in every repetition, within the noise |
| Cost | −36% [−58%, −15%] | −52% [−63%, −27%] | −43% [−65%, −11%] | −55% [−69%, −35%] | fewer in every repetition, outside the noise |
| Wall time | −18% [−36%, 0%] † | −23% [−33%, −12%] | −24% [−40%, −4%] | −28% [−40%, −13%] | fewer in every repetition, within the noise |

### Outcome (hit@5), by repetition

Per paired task: **better** = the SigMap arm named the file and the other did not; **worse** = the reverse; **tie** = both found it or both missed. Localisation only.

| repetition | paired tasks | better | worse | tie |
| --- | ---: | ---: | ---: | ---: |
| R1 | 5 | 0 | 0 | 5 |
| R2 | 5 | 0 | 0 | 5 |
| R3 | 5 | 0 | 0 | 5 |
| R4 | 5 | 0 | 0 | 5 |
| all | 20 | 0 | 0 | 20 |

## Tool calls

Provenance: agent-reported (main-thread tool_use blocks). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | 4 | 2 | −2 | 5 / 0 / 0 |
| all | 4 | 2 | −2 | 5 / 0 / 0 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | 202 | 200 | −2 | 4 / 1 / 0 |
| all | 202 | 200 | −2 | 4 / 1 / 0 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | 810 | 676 | −134 | 5 / 0 / 0 |
| all | 810 | 676 | −134 | 5 / 0 / 0 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | 7,940 | 8,986 | +3,556 | 2 / 0 / 3 |
| all | 7,940 | 8,986 | +3,556 | 2 / 0 / 3 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | 7,110 | 2,306 | −4,702 | 5 / 0 / 0 |
| all | 7,110 | 2,306 | −4,702 | 5 / 0 / 0 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | 16,958 | 12,401 | −776 | 4 / 0 / 1 |
| all | 16,958 | 12,401 | −776 | 4 / 0 / 1 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd), or computed from the API's usage and a price table when the run went through the Messages API directly. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | $0.0015 | $0.0007 | −$0.0006 | 5 / 0 / 0 |
| all | $0.0015 | $0.0007 | −$0.0006 | 5 / 0 / 0 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | 4.4 s | 3.8 s | −846 ms | 5 / 0 / 0 |
| all | 4.4 s | 3.8 s | −846 ms | 5 / 0 / 0 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| flask | $0.0295 (20 runs) | $0.0148 (20 runs) | none | none |
| all | $0.0295 (20 runs) | $0.0148 (20 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| flask/x032 | without | 4/4 | 7 [6–7] | 210 [208–210] | 1,385 [1,240–1,781] | 28,652 [7,823–29,709] | 13,021 [9,857–13,471] | $0.0026 [$0.0020–$0.0028] | 7.7 s [7.1 s–9.1 s] |
| flask/x032 | with | 4/4 | 1 [1–2] | 204 [204–204] | 805 [632–839] | 6,762 [5,630–6,762] | 1,804 [1,528–2,539] | $0.0007 [$0.0006–$0.0008] | 4.5 s [3.9 s–4.7 s] |
| flask/x033 | without | 4/4 | 3 [2–3] | 206 [206–206] | 810 [721–911] | 7,940 [6,549–7,942] | 8,020 [6,635–8,820] | $0.0015 [$0.0014–$0.0016] | 4.2 s [3.6 s–5.2 s] |
| flask/x033 | with | 4/4 | 2 [1–2] | 206 [204–206] | 676 [577–697] | 11,982 [6,762–12,361] | 3,318 [2,006–4,609] | $0.0009 [$0.0006–$0.0011] | 3.8 s [3.1 s–4.1 s] |
| flask/x034 | without | 4/4 | 4 [3–5] | 202 [202–206] | 827 [777–979] | 13,034 [8,089–31,537] | 7,110 [4,418–8,948] | $0.0015 [$0.0010–$0.0019] | 5.1 s [4.9 s–6.7 s] |
| flask/x034 | with | 4/4 | 2 [2–2] | 200 [200–200] | 765 [753–779] | 11,650 [11,528–11,729] | 2,306 [2,154–2,796] | $0.0008 [$0.0008–$0.0009] | 4.7 s [4.5 s–4.9 s] |
| flask/x035 | without | 4/4 | 4 [3–4] | 193 [192–194] | 593 [511–658] | 4,126 [2,955–8,996] | 2,301 [734–3,699] | $0.0006 [$0.0004–$0.0009] | 4.0 s [3.1 s–4.4 s] |
| flask/x035 | with | 4/4 | 2 [1–4] | 191 [190–194] | 513 [407–602] | 8,710 [6,762–16,528] | 1,545 [505–2,868] | $0.0006 [$0.0004–$0.0008] | 3.1 s [2.6 s–3.7 s] |
| flask/x036 | without | 4/4 | 3 [1–5] | 196 [194–200] | 779 [741–881] | 5,430 [1,628–17,638] | 6,027 [4,786–7,071] | $0.0012 [$0.0010–$0.0015] | 4.4 s [3.9 s–5.1 s] |
| flask/x036 | with | 4/4 | 2 [1–3] | 195 [194–198] | 538 [478–586] | 8,986 [6,762–18,572] | 2,542 [555–4,713] | $0.0007 [$0.0004–$0.0010] | 3.5 s [3.1 s–4.0 s] |

