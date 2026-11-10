# Agent-level A/B — measured tool calls, tokens and cost

**claude-code 2.1.321 (Claude Code) · claude-haiku-4-5 · 2026-11-10 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap lean: 7-tool core MCP profile + a three-line section.
- Both arms: the same prompt, model, tool allowlist (Read, Grep, Glob, Bash), per-run budget cap $1 and timeout 420 s; run in a clean copy of the commit pinned in `benchmarks/xrepo-repos.json`.
- Questions: the task id(s) x032, x033 of `benchmarks/tasks/retrieval-xrepo.jsonl`. Pass = hit@5 on the repository-relative paths the answer names.
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
| flask | 2 | 4/4 | 4/4 | 0 / 0 |
| all | 2 | 4/4 | 4/4 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 2. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −23% | +16% | mixed |
| Input tokens (uncached) | −45% | +36% | mixed |
| Output tokens | −32% | +13% | mixed |
| Cache-read tokens | −51% | +30% | mixed |
| Cache-write tokens | −12% | −39% | fewer in every repetition |
| Total tokens (derived) | −48% | +24% | mixed |
| Cost | −31% | −10% | fewer in every repetition |
| Wall time | −29% | +13% | mixed |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −22% [−27%, −15%] | +8% [−15%, +39%] † | mixed |
| Input tokens (uncached) | −45% [−47%, −42%] | +25% [−21%, +98%] † | mixed |
| Output tokens | −30% [−36%, −24%] | +5% [−15%, +30%] † | mixed |
| Cache-read tokens | −51% [−51%, −50%] | +20% [−29%, +103%] † | mixed |
| Cache-write tokens | −12% [−19%, −5%] | −38% [−52%, −18%] | fewer in every repetition, outside the noise |
| Total tokens (derived) | −48% [−49%, −48%] | +15% [−31%, +93%] † | mixed |
| Cost | −30% [−36%, −24%] | −13% [−41%, +29%] † | fewer in every repetition, within the noise |
| Wall time | −30% [−31%, −28%] | +6% [−20%, +40%] † | mixed |

### Outcome (hit@5), by repetition

Per paired task: **better** = the SigMap arm named the file and the other did not; **worse** = the reverse; **tie** = both found it or both missed. Localisation only.

| repetition | paired tasks | better | worse | tie |
| --- | ---: | ---: | ---: | ---: |
| R1 | 2 | 0 | 0 | 2 |
| R2 | 2 | 0 | 0 | 2 |
| all | 4 | 0 | 0 | 4 |

## Tool calls

Provenance: agent-reported (main-thread tool_use blocks). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | 17 | 16 | −1 | 1 / 0 / 1 |
| all | 17 | 16 | −1 | 1 / 0 / 1 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | 130 | 116 | −14 | 1 / 0 / 1 |
| all | 130 | 116 | −14 | 1 / 0 / 1 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | 3,927 | 3,479 | −448 | 2 / 0 / 0 |
| all | 3,927 | 3,479 | −448 | 2 / 0 / 0 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | 322,092 | 268,430 | −53,663 | 1 / 0 / 1 |
| all | 322,092 | 268,430 | −53,663 | 1 / 0 / 1 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | 23,104 | 16,817 | −6,288 | 2 / 0 / 0 |
| all | 23,104 | 16,817 | −6,288 | 2 / 0 / 0 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | 349,254 | 288,842 | −60,412 | 1 / 0 / 1 |
| all | 349,254 | 288,842 | −60,412 | 1 / 0 / 1 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | $0.0982 | $0.0780 | −$0.0202 | 2 / 0 / 0 |
| all | $0.0982 | $0.0780 | −$0.0202 | 2 / 0 / 0 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | 42.3 s | 38.2 s | −4.1 s | 1 / 0 / 1 |
| all | 42.3 s | 38.2 s | −4.1 s | 1 / 0 / 1 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| flask | $0.3927 (4 runs) | $0.3120 (4 runs) | none | none |
| all | $0.3927 (4 runs) | $0.3120 (4 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| flask/x032 | without | 2/2 | 20 [18–22] | 146 [106–186] | 5,058 [4,443–5,673] | 343,354 [243,181–443,526] | 19,530 [19,224–19,835] | $0.0988 [$0.0863–$0.1114] | 50.6 s [43.1 s–58.1 s] |
| flask/x032 | with | 2/2 | 21 [16–25] | 154 [98–210] | 4,706 [3,614–5,798] | 357,029 [220,334–493,723] | 15,943 [15,660–16,225] | $0.0913 [$0.0715–$0.1110] | 51.0 s [41.9 s–60.2 s] |
| flask/x033 | without | 2/2 | 13 [13–13] | 114 [114–114] | 2,797 [2,785–2,808] | 300,831 [296,372–305,290] | 26,679 [21,203–32,155] | $0.0975 [$0.0871–$0.1080] | 34.1 s [34.0 s–34.1 s] |
| flask/x033 | with | 2/2 | 11 [11–11] | 78 [66–90] | 2,253 [2,130–2,375] | 179,831 [149,875–209,787] | 17,691 [15,319–20,062] | $0.0647 [$0.0636–$0.0658] | 25.4 s [23.3 s–27.4 s] |

