# Agent-level A/B — measured tool calls, tokens and cost

**claude-code 2.1.322 (Claude Code) · claude-haiku-5-5 · 2026-11-10 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap as one on-demand skill (sigmap-locate) + the sigmap CLI: no MCP server, no always-on section.
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
| Tool calls | +11% | −36% | mixed |
| Input tokens (uncached) | +10% | −17% | mixed |
| Output tokens | +18% | −3% | mixed |
| Cache-read tokens | +17% | −20% | mixed |
| Cache-write tokens | +9% | −3% | mixed |
| Total tokens (derived) | +15% | −17% | mixed |
| Cost | +11% | −5% | mixed |
| Wall time | +8% | +1% | more in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | +11% [−34%, +73%] † | −33% [−46%, −12%] | mixed |
| Input tokens (uncached) | +11% [−18%, +50%] † | −16% [−29%, 0%] † | mixed |
| Output tokens | +19% [+1%, +38%] | −2% [−12%, +8%] † | mixed |
| Cache-read tokens | +18% [−22%, +79%] † | −19% [−35%, 0%] | mixed |
| Cache-write tokens | +7% [−13%, +35%] † | −3% [−6%, +1%] † | mixed |
| Total tokens (derived) | +16% [−19%, +66%] † | −16% [−29%, −1%] | mixed |
| Cost | +12% [−9%, +37%] † | −5% [−8%, −2%] | mixed |
| Wall time | +9% [+1%, +18%] | +2% [−12%, +14%] † | more in every repetition, within the noise |

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
| express | 2 | 2 | −1 | 2 / 1 / 1 |
| all | 2 | 2 | −1 | 2 / 1 / 1 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | 6 | 6 | 0 | 2 / 0 / 2 |
| all | 6 | 6 | 0 | 2 / 0 / 2 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | 794 | 836 | +90 | 1 / 0 / 3 |
| all | 794 | 836 | +90 | 1 / 0 / 3 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | 31,152 | 31,988 | −66 | 2 / 0 / 2 |
| all | 31,152 | 31,988 | −66 | 2 / 0 / 2 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | 7,911 | 8,540 | −4 | 2 / 0 / 2 |
| all | 7,911 | 8,540 | −4 | 2 / 0 / 2 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | 39,862 | 41,260 | −88 | 2 / 0 / 2 |
| all | 39,862 | 41,260 | −88 | 2 / 0 / 2 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | $0.0023 | $0.0024 | −$0.0000 | 2 / 0 / 2 |
| all | $0.0023 | $0.0024 | −$0.0000 | 2 / 0 / 2 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | 9.4 s | 9.6 s | +704 ms | 1 / 0 / 3 |
| all | 9.4 s | 9.6 s | +704 ms | 1 / 0 / 3 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| express | $0.0184 (8 runs) | $0.0189 (8 runs) | none | none |
| all | $0.0184 (8 runs) | $0.0189 (8 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| express/x037 | without | 2/2 | 2 [2–2] | 6 [6–6] | 906 [854–958] | 34,443 [34,324–34,561] | 7,720 [7,206–8,233] | $0.0023 [$0.0023–$0.0024] | 10.4 s [10.3 s–10.6 s] |
| express/x037 | with | 2/2 | 1 [1–1] | 4 [4–4] | 1,093 [992–1,194] | 20,798 [20,795–20,801] | 6,747 [6,720–6,773] | $0.0021 [$0.0020–$0.0022] | 10.8 s [10.6 s–10.9 s] |
| express/x038 | without | 2/2 | 5 [4–5] | 7 [6–8] | 1,028 [973–1,082] | 43,393 [34,828–51,957] | 9,019 [8,918–9,120] | $0.0028 [$0.0027–$0.0028] | 10.7 s [9.6 s–11.8 s] |
| express/x038 | with | 2/2 | 4 [3–4] | 6 [6–6] | 896 [896–896] | 35,990 [35,303–36,677] | 8,710 [8,302–9,118] | $0.0026 [$0.0025–$0.0026] | 9.5 s [9.3 s–9.7 s] |
| express/x039 | without | 2/2 | 1 [1–1] | 4 [4–4] | 593 [555–631] | 20,360 [20,035–20,685] | 6,756 [6,328–7,183] | $0.0019 [$0.0018–$0.0019] | 7.7 s [7.6 s–7.9 s] |
| express/x039 | with | 2/2 | 2 [1–2] | 5 [4–6] | 679 [606–752] | 28,843 [20,785–36,901] | 8,675 [6,294–11,056] | $0.0024 [$0.0018–$0.0030] | 8.8 s [8.5 s–9.2 s] |
| express/x040 | without | 2/2 | 3 [2–3] | 5 [4–6] | 682 [616–748] | 27,861 [20,041–35,680] | 8,103 [7,054–9,151] | $0.0022 [$0.0020–$0.0025] | 8.3 s [8.2 s–8.3 s] |
| express/x040 | with | 2/2 | 3 [2–3] | 6 [6–6] | 776 [691–861] | 35,132 [34,955–35,309] | 8,404 [8,152–8,656] | $0.0024 [$0.0024–$0.0024] | 9.7 s [9.5 s–9.9 s] |

