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
| rails | 5 | 9/10 | 10/10 | 0 / 0 |
| all | 5 | 9/10 | 10/10 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 5. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | 0% | +25% | mixed |
| Input tokens (uncached) | 0% | +29% | mixed |
| Output tokens | +30% | +7% | more in every repetition |
| Cache-read tokens | +1% | +37% | more in every repetition |
| Cache-write tokens | +11% | +1% | more in every repetition |
| Total tokens (derived) | +3% | +31% | more in every repetition |
| Cost | +13% | +8% | more in every repetition |
| Wall time | +16% | +4% | more in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | +12% [−38%, +93%] † | +24% [−44%, +210%] † | more in every repetition, within the noise |
| Input tokens (uncached) | −4% [−36%, +44%] † | +27% [−14%, +102%] † | mixed |
| Output tokens | +27% [−11%, +60%] † | +9% [−14%, +51%] † | more in every repetition, within the noise |
| Cache-read tokens | −5% [−45%, +64%] † | +34% [−18%, +141%] † | mixed |
| Cache-write tokens | +11% [−1%, +26%] † | +3% [−20%, +49%] † | more in every repetition, within the noise |
| Total tokens (derived) | −1% [−36%, +54%] † | +29% [−18%, +123%] † | mixed |
| Cost | +11% [−8%, +35%] † | +9% [−17%, +61%] † | more in every repetition, within the noise |
| Wall time | +12% [−10%, +38%] † | +4% [−12%, +31%] † | more in every repetition, within the noise |

### Outcome (hit@5), by repetition

Per paired task: **better** = the SigMap arm named the file and the other did not; **worse** = the reverse; **tie** = both found it or both missed. Localisation only.

| repetition | paired tasks | better | worse | tie |
| --- | ---: | ---: | ---: | ---: |
| R1 | 5 | 1 | 0 | 4 |
| R2 | 5 | 0 | 0 | 5 |
| all | 10 | 1 | 0 | 9 |

## Tool calls

Provenance: agent-reported (main-thread tool_use blocks). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | 3 | 5 | +1 | 1 / 1 / 3 |
| all | 3 | 5 | +1 | 1 / 1 / 3 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | 6 | 8 | 0 | 0 / 3 / 2 |
| all | 6 | 8 | 0 | 0 / 3 / 2 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | 1,256 | 1,440 | +184 | 0 / 0 / 5 |
| all | 1,256 | 1,440 | +184 | 0 / 0 / 5 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | 41,669 | 64,427 | +477 | 1 / 0 / 4 |
| all | 41,669 | 64,427 | +477 | 1 / 0 / 4 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | 9,593 | 11,847 | +186 | 2 / 0 / 3 |
| all | 9,593 | 11,847 | +186 | 2 / 0 / 3 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | 52,076 | 77,721 | +576 | 1 / 0 / 4 |
| all | 52,076 | 77,721 | +576 | 1 / 0 / 4 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | $0.0028 | $0.0037 | +$0.0001 | 2 / 0 / 3 |
| all | $0.0028 | $0.0037 | +$0.0001 | 2 / 0 / 3 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | 12.0 s | 13.5 s | +1.5 s | 1 / 0 / 4 |
| all | 12.0 s | 13.5 s | +1.5 s | 1 / 0 / 4 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| rails | $0.0350 (10 runs) | $0.0388 (10 runs) | none | none |
| all | $0.0350 (10 runs) | $0.0388 (10 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| rails/x084 | without | 2/2 | 2 [1–3] | 5 [4–6] | 739 [671–807] | 33,232 [22,916–43,547] | 9,593 [9,112–10,073] | $0.0026 [$0.0026–$0.0027] | 9.6 s [8.9 s–10.2 s] |
| rails/x084 | with | 2/2 | 2 [1–3] | 5 [4–6] | 908 [695–1,121] | 33,453 [26,515–40,390] | 9,778 [6,578–12,978] | $0.0027 [$0.0019–$0.0036] | 9.8 s [8.4 s–11.2 s] |
| rails/x085 | without | 2/2 | 3 [1–5] | 6 [4–8] | 1,256 [934–1,577] | 41,558 [26,445–56,670] | 8,594 [6,047–11,140] | $0.0028 [$0.0019–$0.0036] | 12.0 s [10.2 s–13.9 s] |
| rails/x085 | with | 2/2 | 5 [2–7] | 8 [4–12] | 1,440 [1,015–1,864] | 64,427 [23,020–105,833] | 11,847 [11,194–12,499] | $0.0037 [$0.0030–$0.0045] | 13.5 s [10.7 s–16.4 s] |
| rails/x086 | without | 2/2 | 2 [2–2] | 6 [6–6] | 830 [725–934] | 41,669 [39,959–43,378] | 9,572 [8,420–10,723] | $0.0027 [$0.0026–$0.0029] | 10.6 s [9.2 s–11.9 s] |
| rails/x086 | with | 2/2 | 3 [2–3] | 6 [4–8] | 1,009 [916–1,102] | 42,145 [23,030–61,260] | 9,047 [7,884–10,209] | $0.0027 [$0.0027–$0.0027] | 10.1 s [8.6 s–11.7 s] |
| rails/x087 | without | 1/2 | 4 [3–4] | 7 [6–8] | 1,692 [1,500–1,883] | 54,979 [41,529–68,428] | 12,743 [12,416–13,069] | $0.0039 [$0.0036–$0.0042] | 14.1 s [12.4 s–15.9 s] |
| rails/x087 | with | 2/2 | 5 [4–5] | 10 [10–10] | 2,055 [1,741–2,368] | 85,207 [83,484–86,930] | 14,924 [13,049–16,798] | $0.0049 [$0.0044–$0.0054] | 17.5 s [15.5 s–19.4 s] |
| rails/x088 | without | 2/2 | 7 [6–8] | 11 [10–12] | 1,865 [1,696–2,034] | 95,028 [84,014–106,041] | 17,804 [16,897–18,711] | $0.0054 [$0.0052–$0.0057] | 17.0 s [15.9 s–18.0 s] |
| rails/x088 | with | 2/2 | 6 [5–7] | 11 [10–12] | 2,126 [1,681–2,570] | 91,569 [83,727–99,411] | 16,601 [14,084–19,118] | $0.0053 [$0.0045–$0.0061] | 18.7 s [17.1 s–20.2 s] |

