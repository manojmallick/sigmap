# Agent-level A/B — measured tool calls, tokens and cost

**claude-code 2.1.322 (Claude Code) · claude-haiku-5-5 · 2026-11-10 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap as one skill (sigmap-locate) whose description tells the agent to call it first on every where-is-it question, + the sigmap CLI: no MCP server, no always-on section.
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
| Tool calls | +24% | +93% | more in every repetition |
| Input tokens (uncached) | +25% | +107% | more in every repetition |
| Output tokens | +17% | +30% | more in every repetition |
| Cache-read tokens | +23% | +143% | more in every repetition |
| Cache-write tokens | +7% | +11% | more in every repetition |
| Total tokens (derived) | +20% | +110% | more in every repetition |
| Cost | +11% | +30% | more in every repetition |
| Wall time | +19% | +43% | more in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | +28% [+3%, +64%] | +114% [+23%, +299%] | more in every repetition, outside the noise |
| Input tokens (uncached) | +27% [+9%, +49%] | +108% [+73%, +155%] | more in every repetition, outside the noise |
| Output tokens | +19% [+5%, +34%] | +41% [−5%, +110%] † | more in every repetition, within the noise |
| Cache-read tokens | +25% [+5%, +54%] | +144% [+90%, +218%] | more in every repetition, outside the noise |
| Cache-write tokens | +7% [−2%, +16%] † | +13% [−4%, +38%] † | more in every repetition, within the noise |
| Total tokens (derived) | +22% [+4%, +45%] | +111% [+66%, +173%] | more in every repetition, outside the noise |
| Cost | +12% [+2%, +23%] | +33% [+7%, +72%] | more in every repetition, outside the noise |
| Wall time | +20% [+11%, +29%] | +43% [+26%, +63%] | more in every repetition, outside the noise |

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
| flask | 4 | 6 | +2 | 0 / 0 / 5 |
| all | 4 | 6 | +2 | 0 / 0 / 5 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | 7 | 11 | +4 | 0 / 0 / 5 |
| all | 7 | 11 | +4 | 0 / 0 / 5 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | 1,036 | 1,463 | +213 | 1 / 0 / 4 |
| all | 1,036 | 1,463 | +213 | 1 / 0 / 4 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | 43,910 | 71,508 | +27,568 | 0 / 0 / 5 |
| all | 43,910 | 71,508 | +27,568 | 0 / 0 / 5 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | 10,279 | 11,095 | +774 | 1 / 0 / 4 |
| all | 10,279 | 11,095 | +774 | 1 / 0 / 4 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | 53,188 | 82,261 | +28,601 | 0 / 0 / 5 |
| all | 53,188 | 82,261 | +28,601 | 0 / 0 / 5 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | $0.0029 | $0.0036 | +$0.0004 | 0 / 0 / 5 |
| all | $0.0029 | $0.0036 | +$0.0004 | 0 / 0 / 5 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | 11.3 s | 15.7 s | +3.6 s | 0 / 0 / 5 |
| all | 11.3 s | 15.7 s | +3.6 s | 0 / 0 / 5 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| flask | $0.0312 (10 runs) | $0.0375 (10 runs) | none | none |
| all | $0.0312 (10 runs) | $0.0375 (10 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| flask/x032 | without | 2/2 | 6 [5–6] | 7 [6–8] | 2,195 [2,184–2,205] | 45,861 [35,632–56,090] | 13,730 [13,510–13,949] | $0.0043 [$0.0042–$0.0045] | 16.1 s [15.4 s–16.8 s] |
| flask/x032 | with | 2/2 | 8 [7–8] | 11 [10–12] | 2,117 [1,964–2,270] | 74,569 [64,482–84,655] | 13,697 [13,443–13,950] | $0.0045 [$0.0045–$0.0046] | 18.0 s [17.8 s–18.2 s] |
| flask/x033 | without | 2/2 | 4 [4–4] | 7 [6–8] | 1,338 [1,207–1,468] | 43,910 [35,963–51,856] | 10,321 [9,822–10,820] | $0.0032 [$0.0031–$0.0033] | 12.4 s [12.4 s–12.5 s] |
| flask/x033 | with | 2/2 | 5 [4–6] | 10 [10–10] | 1,463 [1,297–1,629] | 64,868 [64,284–65,452] | 11,095 [10,126–12,064] | $0.0036 [$0.0033–$0.0039] | 15.7 s [15.4 s–16.1 s] |
| flask/x034 | without | 2/2 | 4 [3–4] | 7 [6–8] | 1,036 [1,000–1,072] | 42,877 [34,992–50,761] | 9,268 [8,767–9,769] | $0.0028 [$0.0028–$0.0028] | 11.1 s [10.7 s–11.6 s] |
| flask/x034 | with | 2/2 | 4 [4–4] | 10 [10–10] | 1,249 [1,226–1,271] | 63,308 [63,230–63,385] | 9,545 [9,539–9,551] | $0.0032 [$0.0032–$0.0032] | 14.7 s [14.7 s–14.7 s] |
| flask/x035 | without | 2/2 | 3 [1–5] | 7 [4–10] | 825 [560–1,090] | 43,941 [20,689–67,192] | 7,988 [6,159–9,817] | $0.0025 [$0.0017–$0.0032] | 11.1 s [9.9 s–12.3 s] |
| flask/x035 | with | 2/2 | 6 [5–6] | 11 [10–12] | 1,309 [1,103–1,515] | 71,508 [63,092–79,924] | 9,433 [9,198–9,668] | $0.0033 [$0.0030–$0.0035] | 15.1 s [13.9 s–16.3 s] |
| flask/x036 | without | 2/2 | 2 [2–2] | 6 [6–6] | 954 [944–963] | 34,961 [34,919–35,002] | 10,279 [10,233–10,324] | $0.0029 [$0.0029–$0.0029] | 11.3 s [11.3 s–11.4 s] |
| flask/x036 | with | 2/2 | 6 [4–7] | 12 [10–14] | 1,696 [1,338–2,053] | 83,076 [63,767–102,385] | 12,502 [11,601–13,402] | $0.0042 [$0.0036–$0.0047] | 17.4 s [15.0 s–19.8 s] |

