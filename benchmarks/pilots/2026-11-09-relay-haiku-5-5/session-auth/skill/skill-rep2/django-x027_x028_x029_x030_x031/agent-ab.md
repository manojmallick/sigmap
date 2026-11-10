# Agent-level A/B — measured tool calls, tokens and cost

**claude-code 2.1.322 (Claude Code) · claude-haiku-5-5 · 2026-11-10 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap as one on-demand skill (sigmap-locate) + the sigmap CLI: no MCP server, no always-on section.
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
- Skill variant: both arms run with skills enabled (the Skill tool, and the agent's own bundled skills listed in the prompt, about 2k tokens), which the earlier no-skill runs did not have, so these figures are against this run's own baseline and not comparable cell by cell with the index, lean or current runs. The SigMap arm adds only its skill file(s) and the sigmap CLI: no MCP server and no appended section.

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
| Tool calls | +38% | 0% | mixed |
| Input tokens (uncached) | +21% | +14% | more in every repetition |
| Output tokens | +31% | +4% | more in every repetition |
| Cache-read tokens | +34% | +19% | more in every repetition |
| Cache-write tokens | +11% | +16% | more in every repetition |
| Total tokens (derived) | +29% | +18% | more in every repetition |
| Cost | +17% | +14% | more in every repetition |
| Wall time | +17% | +13% | more in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | +50% [+5%, +149%] | +55% [−28%, +200%] † | more in every repetition, within the noise |
| Input tokens (uncached) | +22% [+6%, +40%] | +22% [−18%, +68%] † | more in every repetition, within the noise |
| Output tokens | +28% [+18%, +42%] | +14% [−19%, +67%] † | more in every repetition, within the noise |
| Cache-read tokens | +33% [+10%, +61%] | +35% [−18%, +102%] † | more in every repetition, within the noise |
| Cache-write tokens | +11% [+4%, +22%] | +15% [+9%, +22%] | more in every repetition, outside the noise |
| Total tokens (derived) | +28% [+10%, +49%] | +29% [−12%, +75%] † | more in every repetition, within the noise |
| Cost | +17% [+8%, +26%] | +16% [+5%, +27%] | more in every repetition, outside the noise |
| Wall time | +16% [+6%, +25%] | +16% [−8%, +43%] † | more in every repetition, within the noise |

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
| django | 2 | 4 | +1 | 2 / 0 / 3 |
| all | 2 | 4 | +1 | 2 / 0 / 3 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | 5 | 6 | +1 | 1 / 1 / 3 |
| all | 5 | 6 | +1 | 1 / 1 / 3 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | 888 | 1,117 | +152 | 0 / 0 / 5 |
| all | 888 | 1,117 | +152 | 0 / 0 / 5 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | 28,166 | 36,068 | +7,202 | 1 / 0 / 4 |
| all | 28,166 | 36,068 | +7,202 | 1 / 0 / 4 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | 8,092 | 8,989 | +897 | 0 / 0 / 5 |
| all | 8,092 | 8,989 | +897 | 0 / 0 / 5 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | 39,015 | 46,180 | +7,911 | 1 / 0 / 4 |
| all | 39,015 | 46,180 | +7,911 | 1 / 0 / 4 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | $0.0025 | $0.0027 | +$0.0005 | 0 / 0 / 5 |
| all | $0.0025 | $0.0027 | +$0.0005 | 0 / 0 / 5 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | 10.2 s | 12.2 s | +919 ms | 0 / 0 / 5 |
| all | 10.2 s | 12.2 s | +919 ms | 0 / 0 / 5 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| django | $0.0273 (10 runs) | $0.0315 (10 runs) | none | none |
| all | $0.0273 (10 runs) | $0.0315 (10 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| django/x027 | without | 2/2 | 1 [1–1] | 4 [4–4] | 888 [816–960] | 20,697 [20,695–20,699] | 6,498 [6,488–6,508] | $0.0020 [$0.0019–$0.0020] | 10.4 s [8.9 s–11.8 s] |
| django/x027 | with | 2/2 | 4 [3–4] | 6 [6–6] | 1,040 [837–1,243] | 35,014 [34,731–35,297] | 8,009 [7,447–8,571] | $0.0025 [$0.0023–$0.0027] | 12.2 s [11.1 s–13.3 s] |
| django/x028 | without | 2/2 | 4 [4–4] | 6 [6–6] | 1,116 [1,017–1,214] | 35,084 [34,864–35,304] | 8,092 [7,483–8,700] | $0.0025 [$0.0025–$0.0026] | 10.2 s [9.7 s–10.6 s] |
| django/x028 | with | 2/2 | 4 [3–4] | 6 [6–6] | 1,117 [1,025–1,209] | 36,068 [36,057–36,079] | 8,989 [8,170–9,807] | $0.0027 [$0.0025–$0.0029] | 10.9 s [10.1 s–11.7 s] |
| django/x029 | without | 2/2 | 2 [1–2] | 5 [4–6] | 637 [578–695] | 27,559 [20,691–34,427] | 6,992 [6,816–7,167] | $0.0020 [$0.0019–$0.0021] | 8.8 s [7.8 s–9.8 s] |
| django/x029 | with | 2/2 | 3 [2–3] | 6 [6–6] | 829 [806–851] | 34,761 [34,571–34,950] | 7,508 [7,200–7,815] | $0.0023 [$0.0022–$0.0023] | 9.7 s [9.6 s–9.9 s] |
| django/x030 | without | 2/2 | 2 [1–2] | 5 [4–6] | 783 [691–874] | 28,166 [20,687–35,645] | 10,062 [9,595–10,528] | $0.0027 [$0.0027–$0.0027] | 9.8 s [9.0 s–10.6 s] |
| django/x030 | with | 2/2 | 3 [3–3] | 8 [8–8] | 1,288 [1,065–1,510] | 53,821 [52,917–54,725] | 10,697 [10,200–11,193] | $0.0033 [$0.0031–$0.0035] | 14.2 s [13.1 s–15.4 s] |
| django/x031 | without | 2/2 | 7 [4–9] | 8 [6–10] | 1,735 [1,212–2,257] | 58,572 [43,187–73,957] | 15,139 [13,309–16,969] | $0.0045 [$0.0044–$0.0045] | 14.3 s [12.0 s–16.7 s] |
| django/x031 | with | 2/2 | 5 [4–5] | 7 [6–8] | 1,740 [1,575–1,904] | 55,765 [43,538–67,992] | 17,790 [17,157–18,422] | $0.0050 [$0.0047–$0.0053] | 14.5 s [13.6 s–15.3 s] |

