# Agent-level A/B — measured tool calls, tokens and cost

**claude-code 2.1.322 (Claude Code) · claude-haiku-5-5 · 2026-11-10 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap as one skill (sigmap-locate) whose description tells the agent to call it first on every where-is-it question, + the sigmap CLI: no MCP server, no always-on section.
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
| rails | 5 | 10/10 | 9/10 | 0 / 0 |
| all | 5 | 10/10 | 9/10 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 5. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | +67% | +8% | more in every repetition |
| Input tokens (uncached) | +69% | +9% | more in every repetition |
| Output tokens | +41% | +7% | more in every repetition |
| Cache-read tokens | +81% | +3% | more in every repetition |
| Cache-write tokens | +6% | +7% | more in every repetition |
| Total tokens (derived) | +64% | +4% | more in every repetition |
| Cost | +21% | +6% | more in every repetition |
| Wall time | +39% | +14% | more in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | +71% [+39%, +113%] | +27% [−20%, +102%] † | more in every repetition, within the noise |
| Input tokens (uncached) | +73% [+37%, +119%] | +16% [−15%, +57%] † | more in every repetition, within the noise |
| Output tokens | +47% [+13%, +88%] | +18% [−9%, +53%] † | more in every repetition, within the noise |
| Cache-read tokens | +91% [+38%, +164%] | +14% [−23%, +68%] † | more in every repetition, within the noise |
| Cache-write tokens | +8% [−6%, +25%] † | +9% [−12%, +31%] † | more in every repetition, within the noise |
| Total tokens (derived) | +71% [+29%, +126%] | +14% [−20%, +61%] † | more in every repetition, within the noise |
| Cost | +24% [+5%, +47%] | +12% [−11%, +38%] † | more in every repetition, within the noise |
| Wall time | +42% [+17%, +69%] | +21% [−4%, +50%] † | more in every repetition, within the noise |

### Outcome (hit@5), by repetition

Per paired task: **better** = the SigMap arm named the file and the other did not; **worse** = the reverse; **tie** = both found it or both missed. Localisation only.

| repetition | paired tasks | better | worse | tie |
| --- | ---: | ---: | ---: | ---: |
| R1 | 5 | 0 | 0 | 5 |
| R2 | 5 | 0 | 1 | 4 |
| all | 10 | 0 | 1 | 9 |

## Tool calls

Provenance: agent-reported (main-thread tool_use blocks). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | 4 | 6 | +2 | 1 / 0 / 4 |
| all | 4 | 6 | +2 | 1 / 0 / 4 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | 7 | 10 | +3 | 1 / 0 / 4 |
| all | 7 | 10 | +3 | 1 / 0 / 4 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | 1,150 | 1,751 | +322 | 1 / 0 / 4 |
| all | 1,150 | 1,751 | +322 | 1 / 0 / 4 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | 51,264 | 79,024 | +24,419 | 1 / 0 / 4 |
| all | 51,264 | 79,024 | +24,419 | 1 / 0 / 4 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | 10,860 | 11,438 | +1,242 | 1 / 0 / 4 |
| all | 10,860 | 11,438 | +1,242 | 1 / 0 / 4 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | 62,995 | 94,034 | +25,322 | 1 / 0 / 4 |
| all | 62,995 | 94,034 | +25,322 | 1 / 0 / 4 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | $0.0031 | $0.0040 | +$0.0005 | 1 / 0 / 4 |
| all | $0.0031 | $0.0040 | +$0.0005 | 1 / 0 / 4 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | 11.1 s | 17.6 s | +3.8 s | 1 / 0 / 4 |
| all | 11.1 s | 17.6 s | +3.8 s | 1 / 0 / 4 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| rails | $0.0358 (10 runs) | $0.0409 (10 runs) | none | none |
| all | $0.0358 (10 runs) | $0.0409 (10 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| rails/x084 | without | 2/2 | 3 [2–3] | 7 [6–8] | 865 [786–943] | 51,264 [43,612–58,915] | 10,860 [8,429–13,290] | $0.0031 [$0.0025–$0.0037] | 10.2 s [9.6 s–10.9 s] |
| rails/x084 | with | 2/2 | 5 [5–5] | 10 [10–10] | 1,186 [1,161–1,211] | 75,682 [73,947–77,417] | 11,438 [9,468–13,408] | $0.0036 [$0.0032–$0.0040] | 14.1 s [14.0 s–14.2 s] |
| rails/x085 | without | 2/2 | 4 [3–5] | 6 [6–6] | 1,150 [970–1,330] | 41,207 [39,490–42,924] | 8,608 [6,488–10,728] | $0.0027 [$0.0022–$0.0032] | 11.1 s [10.4 s–11.9 s] |
| rails/x085 | with | 2/2 | 7 [6–7] | 11 [10–12] | 1,751 [1,617–1,884] | 85,458 [78,299–92,617] | 11,210 [9,213–13,206] | $0.0040 [$0.0034–$0.0045] | 17.6 s [16.8 s–18.5 s] |
| rails/x086 | without | 2/2 | 3 [2–3] | 6 [4–8] | 865 [680–1,049] | 41,889 [22,916–60,862] | 8,666 [7,329–10,003] | $0.0026 [$0.0026–$0.0026] | 9.8 s [7.9 s–11.8 s] |
| rails/x086 | with | 2/2 | 5 [4–5] | 10 [10–10] | 1,479 [1,432–1,526] | 76,435 [74,980–77,889] | 10,817 [7,609–14,024] | $0.0037 [$0.0030–$0.0043] | 15.5 s [15.0 s–15.9 s] |
| rails/x087 | without | 2/2 | 6 [4–8] | 11 [8–14] | 2,490 [1,912–3,068] | 96,618 [64,524–128,711] | 15,506 [14,191–16,820] | $0.0053 [$0.0050–$0.0057] | 21.0 s [17.1 s–24.9 s] |
| rails/x087 | with | 1/2 | 6 [5–6] | 10 [10–10] | 2,173 [1,758–2,587] | 79,024 [78,008–80,039] | 12,828 [10,401–15,255] | $0.0044 [$0.0042–$0.0047] | 18.8 s [17.3 s–20.3 s] |
| rails/x088 | without | 2/2 | 7 [4–9] | 9 [6–12] | 1,618 [1,194–2,042] | 73,634 [43,765–103,502] | 13,225 [11,318–15,132] | $0.0042 [$0.0041–$0.0043] | 15.1 s [13.2 s–16.9 s] |
| rails/x088 | with | 2/2 | 7 [6–8] | 11 [10–12] | 1,911 [1,657–2,164] | 86,714 [77,763–95,664] | 14,467 [14,297–14,637] | $0.0047 [$0.0045–$0.0049] | 18.4 s [17.1 s–19.7 s] |

