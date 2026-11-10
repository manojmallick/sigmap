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
| Tool calls | −13% | −6% | fewer in every repetition |
| Input tokens (uncached) | −6% | −6% | fewer in every repetition |
| Output tokens | +6% | +1% | more in every repetition |
| Cache-read tokens | −5% | +5% | mixed |
| Cache-write tokens | −4% | +26% | mixed |
| Total tokens (derived) | −4% | +8% | mixed |
| Cost | −3% | +17% | mixed |
| Wall time | +7% | −4% | mixed |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −20% [−48%, 0%] † | −5% [−22%, +15%] † | fewer in every repetition, within the noise |
| Input tokens (uncached) | −8% [−22%, 0%] † | −4% [−10%, 0%] † | fewer in every repetition, within the noise |
| Output tokens | +4% [−12%, +15%] † | +3% [−7%, +17%] † | more in every repetition, within the noise |
| Cache-read tokens | −8% [−26%, +3%] † | +4% [+1%, +9%] | mixed |
| Cache-write tokens | −5% [−9%, 0%] | +19% [−3%, +46%] † | mixed |
| Total tokens (derived) | −7% [−21%, +2%] † | +7% [0%, +15%] | mixed |
| Cost | −4% [−9%, +2%] † | +14% [+1%, +29%] | mixed |
| Wall time | +6% [−1%, +13%] † | −3% [−10%, +2%] † | mixed |

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
| django | 3 | 3 | −1 | 3 / 1 / 1 |
| all | 3 | 3 | −1 | 3 / 1 / 1 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | 6 | 6 | 0 | 2 / 3 / 0 |
| all | 6 | 6 | 0 | 2 / 3 / 0 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | 925 | 1,056 | +32 | 1 / 0 / 4 |
| all | 925 | 1,056 | +32 | 1 / 0 / 4 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | 34,959 | 35,109 | +822 | 1 / 0 / 4 |
| all | 34,959 | 35,109 | +822 | 1 / 0 / 4 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | 9,153 | 9,186 | +33 | 2 / 0 / 3 |
| all | 9,153 | 9,186 | +33 | 2 / 0 / 3 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | 45,301 | 45,245 | +805 | 2 / 0 / 3 |
| all | 45,301 | 45,245 | +805 | 2 / 0 / 3 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | $0.0027 | $0.0027 | +$0.0000 | 2 / 0 / 3 |
| all | $0.0027 | $0.0027 | +$0.0000 | 2 / 0 / 3 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | 10.4 s | 10.5 s | +140 ms | 2 / 0 / 3 |
| all | 10.4 s | 10.5 s | +140 ms | 2 / 0 / 3 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| django | $0.0297 (10 runs) | $0.0317 (10 runs) | none | none |
| all | $0.0297 (10 runs) | $0.0317 (10 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| django/x027 | without | 2/2 | 2 [1–3] | 5 [4–6] | 925 [811–1,039] | 27,569 [20,709–34,429] | 7,969 [7,398–8,539] | $0.0023 [$0.0021–$0.0026] | 10.3 s [10.0 s–10.7 s] |
| django/x027 | with | 2/2 | 1 [1–1] | 4 [4–4] | 1,120 [1,069–1,170] | 20,798 [20,793–20,803] | 7,201 [6,958–7,443] | $0.0022 [$0.0021–$0.0023] | 10.5 s [10.2 s–10.8 s] |
| django/x028 | without | 2/2 | 3 [3–3] | 6 [6–6] | 1,183 [1,160–1,206] | 34,959 [34,501–35,416] | 9,153 [8,321–9,985] | $0.0028 [$0.0026–$0.0030] | 10.6 s [10.4 s–10.9 s] |
| django/x028 | with | 2/2 | 4 [3–4] | 6 [6–6] | 1,056 [912–1,200] | 34,998 [34,966–35,029] | 9,186 [8,811–9,560] | $0.0027 [$0.0027–$0.0027] | 10.4 s [9.9 s–10.8 s] |
| django/x029 | without | 2/2 | 3 [3–3] | 6 [6–6] | 907 [877–936] | 34,287 [33,895–34,679] | 8,134 [7,793–8,475] | $0.0024 [$0.0023–$0.0025] | 10.2 s [9.8 s–10.7 s] |
| django/x029 | with | 2/2 | 3 [2–3] | 6 [6–6] | 976 [915–1,037] | 35,109 [34,923–35,294] | 8,048 [7,493–8,603] | $0.0024 [$0.0023–$0.0026] | 10.7 s [10.2 s–11.3 s] |
| django/x030 | without | 2/2 | 2 [2–2] | 6 [6–6] | 820 [789–850] | 35,026 [34,311–35,740] | 9,706 [8,285–11,127] | $0.0027 [$0.0024–$0.0030] | 10.4 s [9.1 s–11.7 s] |
| django/x030 | with | 2/2 | 2 [2–2] | 6 [6–6] | 826 [770–881] | 37,833 [36,595–39,070] | 11,580 [10,242–12,918] | $0.0031 [$0.0029–$0.0034] | 10.0 s [10.0 s–10.1 s] |
| django/x031 | without | 2/2 | 6 [5–7] | 10 [8–12] | 1,802 [1,506–2,097] | 77,747 [67,229–88,264] | 14,723 [11,350–18,096] | $0.0046 [$0.0042–$0.0050] | 15.3 s [12.9 s–17.6 s] |
| django/x031 | with | 2/2 | 6 [5–6] | 9 [8–10] | 1,834 [1,780–1,887] | 81,179 [69,179–93,178] | 18,133 [18,091–18,175] | $0.0054 [$0.0052–$0.0055] | 15.9 s [15.4 s–16.4 s] |

