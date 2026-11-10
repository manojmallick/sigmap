# Agent-level A/B — measured tool calls, tokens and cost

**claude-code 2.1.322 (Claude Code) · claude-haiku-5-5 · 2026-11-10 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap as one on-demand skill (sigmap-locate) + the sigmap CLI: no MCP server, no always-on section.
- Both arms: the same prompt, model, tool allowlist (Read, Grep, Glob, Bash), per-run budget cap $0.5 and timeout 420 s; run in a clean copy of the commit pinned in `benchmarks/xrepo-repos.json`.
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
- Run on the logged-in session (--session-auth), not an API key and not under --bare: the agent carries a prompt prefix about 40k tokens larger in both arms (cached), the cost figures are real Anthropic prices with real caching, and the usage counts against that account's plan.
- Skill variant: both arms run with skills enabled (the Skill tool, and the agent's own bundled skills listed in the prompt, about 2k tokens), which the earlier no-skill runs did not have, so these figures are against this run's own baseline and not comparable cell by cell with the index, lean or current runs. The SigMap arm adds only its skill file(s) and the sigmap CLI: no MCP server and no appended section.

## Outcome

| repo | tasks | pass without | pass with | failed runs (without / with) |
| --- | ---: | ---: | ---: | ---: |
| flask | 5 | 10/10 | 10/10 | 0 / 0 |
| all | 5 | 10/10 | 10/10 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 5. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | 0% | −11% | mixed |
| Input tokens (uncached) | −6% | +6% | mixed |
| Output tokens | +6% | +19% | more in every repetition |
| Cache-read tokens | −10% | +8% | mixed |
| Cache-write tokens | −9% | +3% | mixed |
| Total tokens (derived) | −9% | +7% | mixed |
| Cost | −6% | +7% | mixed |
| Wall time | −3% | +9% | mixed |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | +4% [−34%, +85%] † | −17% [−53%, +56%] † | mixed |
| Input tokens (uncached) | −6% [−26%, +20%] † | 0% [−28%, +52%] † | mixed |
| Output tokens | +5% [−9%, +24%] † | +24% [+1%, +52%] | more in every repetition, within the noise |
| Cache-read tokens | −8% [−32%, +28%] † | −1% [−37%, +69%] † | fewer in every repetition, within the noise |
| Cache-write tokens | −10% [−25%, +5%] † | +2% [−16%, +20%] † | mixed |
| Total tokens (derived) | −8% [−29%, +21%] † | +2% [−31%, +61%] † | mixed |
| Cost | −7% [−22%, +7%] † | +8% [−9%, +32%] † | mixed |
| Wall time | −3% [−17%, +16%] † | +12% [−5%, +33%] † | mixed |

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
| flask | 4 | 3 | −1 | 3 / 1 / 1 |
| all | 4 | 3 | −1 | 3 / 1 / 1 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | 7 | 6 | 0 | 2 / 2 / 1 |
| all | 7 | 6 | 0 | 2 / 2 / 1 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | 923 | 1,220 | +184 | 1 / 0 / 4 |
| all | 923 | 1,220 | +184 | 1 / 0 / 4 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | 43,220 | 35,833 | +4 | 2 / 0 / 3 |
| all | 43,220 | 35,833 | +4 | 2 / 0 / 3 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | 10,153 | 9,228 | −72 | 4 / 0 / 1 |
| all | 10,153 | 9,228 | −72 | 4 / 0 / 1 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | 54,072 | 47,163 | −891 | 3 / 0 / 2 |
| all | 54,072 | 47,163 | −891 | 3 / 0 / 2 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | $0.0028 | $0.0030 | −$0.0000 | 4 / 0 / 1 |
| all | $0.0028 | $0.0030 | −$0.0000 | 4 / 0 / 1 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | 12.4 s | 12.1 s | +666 ms | 2 / 0 / 3 |
| all | 12.4 s | 12.1 s | +666 ms | 2 / 0 / 3 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| flask | $0.0307 (10 runs) | $0.0308 (10 runs) | none | none |
| all | $0.0307 (10 runs) | $0.0308 (10 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| flask/x032 | without | 2/2 | 5 [5–5] | 8 [8–8] | 2,105 [1,802–2,407] | 53,950 [53,822–54,077] | 12,299 [12,154–12,443] | $0.0041 [$0.0039–$0.0042] | 16.8 s [14.2 s–19.4 s] |
| flask/x032 | with | 2/2 | 5 [4–5] | 6 [6–6] | 2,133 [2,094–2,171] | 35,833 [35,748–35,917] | 12,936 [12,403–13,468] | $0.0040 [$0.0039–$0.0041] | 16.0 s [15.9 s–16.1 s] |
| flask/x033 | without | 2/2 | 2 [1–3] | 5 [4–6] | 859 [648–1,069] | 28,285 [20,715–35,855] | 10,254 [9,715–10,792] | $0.0028 [$0.0025–$0.0031] | 9.9 s [7.9 s–11.9 s] |
| flask/x033 | with | 2/2 | 2 [1–3] | 5 [4–6] | 1,220 [901–1,539] | 28,289 [20,811–35,766] | 8,998 [7,727–10,269] | $0.0027 [$0.0025–$0.0029] | 11.8 s [10.3 s–13.4 s] |
| flask/x034 | without | 2/2 | 4 [3–5] | 7 [6–8] | 1,212 [1,096–1,328] | 43,220 [34,883–51,557] | 9,633 [9,095–10,171] | $0.0030 [$0.0027–$0.0032] | 12.9 s [12.1 s–13.7 s] |
| flask/x034 | with | 2/2 | 3 [3–3] | 6 [6–6] | 1,396 [1,017–1,774] | 35,395 [35,292–35,498] | 9,561 [9,331–9,791] | $0.0030 [$0.0028–$0.0031] | 12.1 s [10.4 s–13.8 s] |
| flask/x035 | without | 2/2 | 4 [2–5] | 8 [6–10] | 923 [757–1,088] | 52,398 [35,075–69,721] | 8,772 [7,609–9,935] | $0.0027 [$0.0023–$0.0032] | 12.4 s [10.0 s–14.7 s] |
| flask/x035 | with | 2/2 | 5 [4–5] | 11 [10–12] | 1,185 [1,067–1,303] | 73,909 [64,676–83,141] | 8,772 [7,886–9,657] | $0.0031 [$0.0028–$0.0034] | 13.5 s [12.5 s–14.4 s] |
| flask/x036 | without | 2/2 | 3 [2–3] | 6 [6–6] | 892 [886–898] | 34,767 [34,708–34,826] | 10,153 [9,746–10,559] | $0.0028 [$0.0027–$0.0029] | 10.5 s [10.4 s–10.7 s] |
| flask/x036 | with | 2/2 | 2 [1–3] | 6 [4–8] | 822 [775–869] | 37,108 [20,787–53,428] | 9,228 [6,897–11,558] | $0.0026 [$0.0020–$0.0033] | 11.2 s [8.6 s–13.8 s] |

