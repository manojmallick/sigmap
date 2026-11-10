# Agent-level A/B — measured tool calls, tokens and cost

**claude-code 2.1.322 (Claude Code) · claude-haiku-4-5 · 2026-11-10 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap lean: 7-tool core MCP profile + a three-line section.
- Both arms: the same prompt, model, tool allowlist (Read, Grep, Glob, Bash), per-run budget cap $1 and timeout 420 s; run in a clean copy of the commit pinned in `benchmarks/xrepo-repos.json`.
- Questions: the task id(s) x034, x035, x036 of `benchmarks/tasks/retrieval-xrepo.jsonl`. Pass = hit@5 on the repository-relative paths the answer names.
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
| flask | 3 | 6/6 | 6/6 | 0 / 0 |
| all | 3 | 6/6 | 6/6 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 3. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −16% | −16% | fewer in every repetition |
| Input tokens (uncached) | −23% | −14% | fewer in every repetition |
| Output tokens | −22% | −34% | fewer in every repetition |
| Cache-read tokens | −28% | −7% | fewer in every repetition |
| Cache-write tokens | −30% | −11% | fewer in every repetition |
| Total tokens (derived) | −28% | −8% | fewer in every repetition |
| Cost | −28% | −14% | fewer in every repetition |
| Wall time | −16% | −22% | fewer in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −14% [−55%, +40%] † | −32% [−67%, +50%] † | fewer in every repetition, within the noise |
| Input tokens (uncached) | −25% [−54%, +16%] † | −24% [−55%, +43%] † | fewer in every repetition, within the noise |
| Output tokens | −21% [−50%, +12%] † | −36% [−54%, +13%] † | fewer in every repetition, within the noise |
| Cache-read tokens | −31% [−64%, +2%] † | −29% [−71%, +80%] † | fewer in every repetition, within the noise |
| Cache-write tokens | −30% [−53%, −8%] | −11% [−20%, +3%] † | fewer in every repetition, within the noise |
| Total tokens (derived) | −30% [−60%, −6%] | −25% [−63%, +72%] † | fewer in every repetition, within the noise |
| Cost | −28% [−38%, −10%] | −17% [−34%, +24%] † | fewer in every repetition, within the noise |
| Wall time | −16% [−43%, +11%] † | −23% [−42%, +25%] † | fewer in every repetition, within the noise |

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
| flask | 9 | 6 | −1 | 2 / 0 / 1 |
| all | 9 | 6 | −1 | 2 / 0 / 1 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | 78 | 50 | −12 | 2 / 0 / 1 |
| all | 78 | 50 | −12 | 2 / 0 / 1 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | 2,055 | 1,396 | −420 | 2 / 0 / 1 |
| all | 2,055 | 1,396 | −420 | 2 / 0 / 1 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | 159,209 | 103,652 | −44,230 | 2 / 0 / 1 |
| all | 159,209 | 103,652 | −44,230 | 2 / 0 / 1 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | 16,541 | 13,592 | −2,949 | 3 / 0 / 0 |
| all | 16,541 | 13,592 | −2,949 | 3 / 0 / 0 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | 177,293 | 118,689 | −51,810 | 2 / 0 / 1 |
| all | 177,293 | 118,689 | −51,810 | 2 / 0 / 1 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | $0.0607 | $0.0446 | −$0.0208 | 2 / 0 / 1 |
| all | $0.0607 | $0.0446 | −$0.0208 | 2 / 0 / 1 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | 25.0 s | 19.3 s | −3.7 s | 2 / 0 / 1 |
| all | 25.0 s | 19.3 s | −3.7 s | 2 / 0 / 1 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| flask | $0.3717 (6 runs) | $0.2951 (6 runs) | none | none |
| all | $0.3717 (6 runs) | $0.2951 (6 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| flask/x034 | without | 2/2 | 9 [8–9] | 78 [74–82] | 2,055 [2,047–2,062] | 159,209 [158,722–159,696] | 15,952 [13,533–18,370] | $0.0582 [$0.0534–$0.0630] | 25.0 s [24.8 s–25.1 s] |
| flask/x034 | with | 2/2 | 11 [9–12] | 86 [66–106] | 2,058 [1,793–2,323] | 214,873 [143,479–286,267] | 15,629 [12,386–18,872] | $0.0631 [$0.0482–$0.0781] | 27.2 s [23.0 s–31.4 s] |
| flask/x035 | without | 2/2 | 11 [11–11] | 86 [74–98] | 2,915 [2,458–3,372] | 192,824 [164,386–221,262] | 16,541 [15,659–17,423] | $0.0670 [$0.0636–$0.0704] | 33.3 s [29.5 s–37.2 s] |
| flask/x035 | with | 2/2 | 6 [5–7] | 50 [34–66] | 1,396 [1,230–1,561] | 103,652 [59,194–148,109] | 13,592 [13,542–13,642] | $0.0446 [$0.0394–$0.0498] | 19.2 s [16.9 s–21.5 s] |
| flask/x036 | without | 2/2 | 6 [5–6] | 54 [50–58] | 1,702 [1,405–1,999] | 114,001 [99,619–128,382] | 20,354 [18,580–22,128] | $0.0607 [$0.0542–$0.0671] | 23.0 s [20.2 s–25.7 s] |
| flask/x036 | with | 2/2 | 5 [2–7] | 42 [26–58] | 1,283 [991–1,574] | 69,771 [37,529–102,013] | 13,205 [8,767–17,643] | $0.0398 [$0.0357–$0.0440] | 19.3 s [16.3 s–22.3 s] |

