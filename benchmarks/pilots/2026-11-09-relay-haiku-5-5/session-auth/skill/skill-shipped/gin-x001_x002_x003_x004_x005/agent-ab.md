# Agent-level A/B — measured tool calls, tokens and cost

**claude-code 2.1.322 (Claude Code) · claude-haiku-5-5 · 2026-11-10 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap as the three skills `sigmap skills install --client claude` writes + the sigmap CLI: no MCP server, no always-on section.
- Both arms: the same prompt, model, tool allowlist (Read, Grep, Glob, Bash), per-run budget cap $0.5 and timeout 420 s; run in a clean copy of the commit pinned in `benchmarks/xrepo-repos.json`.
- Questions: the task id(s) x001, x002, x003, x004, x005 of `benchmarks/tasks/retrieval-xrepo.jsonl`. Pass = hit@5 on the repository-relative paths the answer names.
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
| gin | 5 | 10/10 | 10/10 | 0 / 0 |
| all | 5 | 10/10 | 10/10 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 5. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | +38% | +5% | more in every repetition |
| Input tokens (uncached) | +13% | 0% | mixed |
| Output tokens | +9% | −10% | mixed |
| Cache-read tokens | +20% | +1% | more in every repetition |
| Cache-write tokens | +7% | +6% | more in every repetition |
| Total tokens (derived) | +17% | +2% | more in every repetition |
| Cost | +9% | +2% | more in every repetition |
| Wall time | +5% | −8% | mixed |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | +20% [−39%, +111%] † | +6% [0%, +19%] † | more in every repetition, within the noise |
| Input tokens (uncached) | +9% [−31%, +63%] † | +1% [−13%, +19%] † | more in every repetition, within the noise |
| Output tokens | +4% [−20%, +32%] † | −8% [−18%, +6%] † | mixed |
| Cache-read tokens | +14% [−39%, +95%] † | +4% [−16%, +28%] † | more in every repetition, within the noise |
| Cache-write tokens | +7% [+1%, +14%] | +5% [−7%, +23%] † | more in every repetition, within the noise |
| Total tokens (derived) | +12% [−32%, +75%] † | +4% [−15%, +27%] † | more in every repetition, within the noise |
| Cost | +7% [−9%, +27%] † | +2% [−10%, +16%] † | more in every repetition, within the noise |
| Wall time | +2% [−17%, +26%] † | −8% [−14%, −1%] | mixed |

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
| gin | 3 | 4 | +1 | 1 / 0 / 4 |
| all | 3 | 4 | +1 | 1 / 0 / 4 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 7 | 7 | +1 | 2 / 0 / 3 |
| all | 7 | 7 | +1 | 2 / 0 / 3 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 1,387 | 1,145 | +30 | 2 / 0 / 3 |
| all | 1,387 | 1,145 | +30 | 2 / 0 / 3 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 46,293 | 45,629 | +6,807 | 2 / 0 / 3 |
| all | 46,293 | 45,629 | +6,807 | 2 / 0 / 3 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 9,171 | 9,922 | +183 | 0 / 0 / 5 |
| all | 9,171 | 9,922 | +183 | 0 / 0 / 5 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 59,697 | 57,536 | +6,904 | 2 / 0 / 3 |
| all | 59,697 | 57,536 | +6,904 | 2 / 0 / 3 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | $0.0030 | $0.0032 | +$0.0001 | 2 / 0 / 3 |
| all | $0.0030 | $0.0032 | +$0.0001 | 2 / 0 / 3 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 13.0 s | 11.6 s | +95 ms | 2 / 0 / 3 |
| all | 13.0 s | 11.6 s | +95 ms | 2 / 0 / 3 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| gin | $0.0304 (10 runs) | $0.0321 (10 runs) | none | none |
| all | $0.0304 (10 runs) | $0.0321 (10 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| gin/x001 | without | 2/2 | 3 [2–3] | 5 [4–6] | 1,154 [1,055–1,253] | 28,397 [20,709–36,085] | 8,833 [8,335–9,330] | $0.0026 [$0.0026–$0.0027] | 10.7 s [9.6 s–11.9 s] |
| gin/x001 | with | 2/2 | 3 [3–3] | 7 [6–8] | 1,145 [1,099–1,191] | 45,629 [37,501–53,756] | 10,755 [9,920–11,590] | $0.0032 [$0.0030–$0.0034] | 10.8 s [10.7 s–11.0 s] |
| gin/x002 | without | 2/2 | 3 [2–3] | 7 [6–8] | 1,387 [1,295–1,479] | 43,549 [34,261–52,837] | 8,902 [8,850–8,954] | $0.0029 [$0.0028–$0.0030] | 13.3 s [12.7 s–14.0 s] |
| gin/x002 | with | 2/2 | 2 [1–2] | 5 [4–6] | 1,058 [917–1,198] | 29,034 [20,923–37,145] | 9,085 [9,080–9,090] | $0.0026 [$0.0025–$0.0028] | 11.6 s [10.1 s–13.2 s] |
| gin/x003 | without | 2/2 | 3 [3–3] | 8 [8–8] | 957 [887–1,027] | 51,798 [51,454–52,142] | 9,859 [9,750–9,968] | $0.0030 [$0.0030–$0.0030] | 11.3 s [10.5 s–12.1 s] |
| gin/x003 | with | 2/2 | 4 [3–4] | 7 [6–8] | 1,044 [852–1,235] | 43,871 [35,136–52,606] | 9,922 [9,582–10,262] | $0.0029 [$0.0027–$0.0032] | 10.2 s [8.8 s–11.6 s] |
| gin/x004 | without | 2/2 | 4 [3–4] | 7 [6–8] | 1,598 [1,459–1,737] | 46,293 [37,253–55,332] | 11,799 [11,552–12,046] | $0.0036 [$0.0034–$0.0038] | 13.2 s [12.2 s–14.3 s] |
| gin/x004 | with | 2/2 | 5 [4–5] | 9 [8–10] | 1,779 [1,351–2,206] | 66,085 [55,820–76,349] | 12,641 [12,263–13,019] | $0.0041 [$0.0037–$0.0045] | 14.5 s [12.8 s–16.1 s] |
| gin/x005 | without | 2/2 | 5 [2–7] | 8 [6–10] | 1,460 [1,342–1,577] | 52,568 [35,092–70,043] | 9,171 [8,235–10,107] | $0.0031 [$0.0027–$0.0035] | 13.0 s [12.3 s–13.7 s] |
| gin/x005 | with | 2/2 | 7 [6–7] | 9 [8–10] | 1,489 [1,348–1,630] | 59,375 [50,889–67,860] | 9,237 [8,720–9,754] | $0.0032 [$0.0029–$0.0034] | 13.3 s [11.1 s–15.5 s] |

