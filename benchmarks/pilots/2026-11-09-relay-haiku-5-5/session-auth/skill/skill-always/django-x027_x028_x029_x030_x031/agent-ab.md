# Agent-level A/B — measured tool calls, tokens and cost

**claude-code 2.1.322 (Claude Code) · claude-haiku-5-5 · 2026-11-10 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap as one skill (sigmap-locate) whose description tells the agent to call it first on every where-is-it question, + the sigmap CLI: no MCP server, no always-on section.
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
| Tool calls | +25% | +56% | more in every repetition |
| Input tokens (uncached) | +30% | +63% | more in every repetition |
| Output tokens | +11% | +41% | more in every repetition |
| Cache-read tokens | +15% | +62% | more in every repetition |
| Cache-write tokens | −7% | −4% | fewer in every repetition |
| Total tokens (derived) | +12% | +49% | more in every repetition |
| Cost | 0% | +13% | more in every repetition |
| Wall time | +22% | +35% | more in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | +37% [+7%, +76%] | +60% [+36%, +89%] | more in every repetition, outside the noise |
| Input tokens (uncached) | +34% [+14%, +57%] | +63% [+56%, +67%] | more in every repetition, outside the noise |
| Output tokens | +14% [−3%, +35%] † | +41% [+29%, +59%] | more in every repetition, within the noise |
| Cache-read tokens | +28% [−6%, +70%] † | +67% [+46%, +83%] | more in every repetition, within the noise |
| Cache-write tokens | −2% [−24%, +18%] † | −1% [−18%, +17%] † | fewer in every repetition, within the noise |
| Total tokens (derived) | +23% [−9%, +59%] † | +53% [+34%, +70%] | more in every repetition, within the noise |
| Cost | +6% [−16%, +27%] † | +15% [0%, +33%] | more in every repetition, within the noise |
| Wall time | +24% [+5%, +47%] | +35% [+30%, +41%] | more in every repetition, outside the noise |

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
| django | 3 | 6 | +2 | 0 / 0 / 5 |
| all | 3 | 6 | +2 | 0 / 0 / 5 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | 7 | 10 | +3 | 0 / 0 / 5 |
| all | 7 | 10 | +3 | 0 / 0 / 5 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | 1,093 | 1,296 | +331 | 0 / 0 / 5 |
| all | 1,093 | 1,296 | +331 | 0 / 0 / 5 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | 43,129 | 63,935 | +20,807 | 1 / 0 / 4 |
| all | 43,129 | 63,935 | +20,807 | 1 / 0 / 4 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | 8,465 | 9,405 | +743 | 2 / 0 / 3 |
| all | 8,465 | 9,405 | +743 | 2 / 0 / 3 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | 52,969 | 74,852 | +21,883 | 1 / 0 / 4 |
| all | 52,969 | 74,852 | +21,883 | 1 / 0 / 4 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | $0.0028 | $0.0033 | +$0.0005 | 1 / 0 / 4 |
| all | $0.0028 | $0.0033 | +$0.0005 | 1 / 0 / 4 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | 11.5 s | 15.5 s | +4.1 s | 0 / 0 / 5 |
| all | 11.5 s | 15.5 s | +4.1 s | 0 / 0 / 5 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| django | $0.0328 (10 runs) | $0.0349 (10 runs) | none | none |
| all | $0.0328 (10 runs) | $0.0349 (10 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| django/x027 | without | 2/2 | 3 [3–3] | 7 [6–8] | 1,369 [1,166–1,571] | 43,129 [35,121–51,136] | 8,465 [8,154–8,776] | $0.0028 [$0.0026–$0.0031] | 13.7 s [12.3 s–15.1 s] |
| django/x027 | with | 2/2 | 6 [5–6] | 10 [10–10] | 1,699 [1,367–2,031] | 63,935 [63,473–64,397] | 9,208 [8,391–10,025] | $0.0033 [$0.0030–$0.0037] | 15.4 s [14.4 s–16.4 s] |
| django/x028 | without | 2/2 | 4 [4–4] | 6 [6–6] | 1,093 [1,027–1,159] | 34,757 [34,559–34,955] | 7,898 [7,885–7,910] | $0.0025 [$0.0024–$0.0025] | 11.2 s [11.1 s–11.3 s] |
| django/x028 | with | 2/2 | 6 [5–6] | 10 [10–10] | 1,289 [1,226–1,351] | 63,444 [63,346–63,542] | 9,405 [9,284–9,525] | $0.0032 [$0.0031–$0.0032] | 15.4 s [14.4 s–16.3 s] |
| django/x029 | without | 2/2 | 3 [2–4] | 6 [6–6] | 914 [802–1,026] | 34,518 [34,411–34,625] | 7,932 [7,243–8,621] | $0.0024 [$0.0022–$0.0026] | 10.5 s [10.4 s–10.6 s] |
| django/x029 | with | 2/2 | 5 [4–5] | 10 [10–10] | 1,296 [1,271–1,320] | 63,565 [63,463–63,667] | 8,702 [8,605–8,798] | $0.0030 [$0.0030–$0.0030] | 15.7 s [15.0 s–16.4 s] |
| django/x030 | without | 2/2 | 3 [2–3] | 7 [6–8] | 941 [848–1,033] | 46,453 [38,946–53,960] | 11,896 [10,897–12,894] | $0.0033 [$0.0032–$0.0034] | 11.5 s [11.1 s–11.8 s] |
| django/x030 | with | 2/2 | 4 [4–4] | 10 [10–10] | 1,292 [1,251–1,332] | 64,560 [63,468–65,652] | 10,594 [9,238–11,949] | $0.0034 [$0.0031–$0.0037] | 15.5 s [15.3 s–15.7 s] |
| django/x031 | without | 2/2 | 7 [5–8] | 10 [8–12] | 1,775 [1,639–1,910] | 93,017 [67,352–118,681] | 17,985 [17,116–18,853] | $0.0054 [$0.0049–$0.0059] | 16.1 s [15.2 s–17.0 s] |
| django/x031 | with | 2/2 | 7 [7–7] | 12 [12–12] | 2,043 [1,968–2,117] | 84,397 [81,324–87,470] | 13,331 [11,280–15,381] | $0.0045 [$0.0041–$0.0050] | 18.7 s [17.6 s–19.8 s] |

