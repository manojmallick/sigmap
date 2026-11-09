# Agent-level A/B — measured tool calls, tokens and cost

**claude-code 2.1.321 (Claude Code) · claude-haiku-5-5 · 2026-11-09 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap lean: 7-tool core MCP profile + a three-line section.
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
| Tool calls | +92% | +71% | more in every repetition |
| Input tokens (uncached) | +40% | +27% | more in every repetition |
| Output tokens | +15% | +10% | more in every repetition |
| Cache-read tokens | +95% | +54% | more in every repetition |
| Cache-write tokens | +38% | +9% | more in every repetition |
| Total tokens (derived) | +81% | +44% | more in every repetition |
| Cost | +40% | +15% | more in every repetition |
| Wall time | +12% | +13% | more in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | +102% [+31%, +210%] | +84% [+50%, +144%] | more in every repetition, outside the noise |
| Input tokens (uncached) | +38% [+13%, +70%] | +27% [+6%, +53%] | more in every repetition, outside the noise |
| Output tokens | +13% [−1%, +32%] † | +10% [−19%, +38%] † | more in every repetition, within the noise |
| Cache-read tokens | +87% [+40%, +155%] | +56% [+23%, +99%] | more in every repetition, outside the noise |
| Cache-write tokens | +37% [+14%, +59%] | +10% [−9%, +36%] † | more in every repetition, within the noise |
| Total tokens (derived) | +75% [+37%, +131%] | +46% [+16%, +83%] | more in every repetition, outside the noise |
| Cost | +38% [+20%, +62%] | +16% [−5%, +43%] † | more in every repetition, within the noise |
| Wall time | +12% [−4%, +30%] † | +14% [0%, +30%] | more in every repetition, within the noise |

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
| gin | 3 | 4 | +3 | 0 / 0 / 5 |
| all | 3 | 4 | +3 | 0 / 0 / 5 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 6 | 8 | +2 | 0 / 0 / 5 |
| all | 6 | 8 | +2 | 0 / 0 / 5 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 1,097 | 1,212 | +151 | 1 / 0 / 4 |
| all | 1,097 | 1,212 | +151 | 1 / 0 / 4 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 29,353 | 47,607 | +16,584 | 0 / 0 / 5 |
| all | 29,353 | 47,607 | +16,584 | 0 / 0 / 5 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 7,533 | 9,057 | +2,329 | 1 / 0 / 4 |
| all | 7,533 | 9,057 | +2,329 | 1 / 0 / 4 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 40,009 | 55,307 | +19,931 | 0 / 0 / 5 |
| all | 40,009 | 55,307 | +19,931 | 0 / 0 / 5 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | $0.0023 | $0.0027 | +$0.0009 | 1 / 0 / 4 |
| all | $0.0023 | $0.0027 | +$0.0009 | 1 / 0 / 4 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 12.2 s | 12.2 s | +1.6 s | 1 / 0 / 4 |
| all | 12.2 s | 12.2 s | +1.6 s | 1 / 0 / 4 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| gin | $0.0231 (10 runs) | $0.0292 (10 runs) | none | none |
| all | $0.0231 (10 runs) | $0.0292 (10 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| gin/x001 | without | 2/2 | 2 [2–2] | 6 [6–6] | 859 [797–920] | 28,248 [26,102–30,394] | 7,632 [7,561–7,702] | $0.0022 [$0.0022–$0.0023] | 12.2 s [11.8 s–12.7 s] |
| gin/x001 | with | 2/2 | 3 [2–4] | 7 [6–8] | 929 [783–1,075] | 39,174 [30,373–47,975] | 8,529 [7,237–9,821] | $0.0026 [$0.0025–$0.0027] | 12.1 s [11.2 s–13.1 s] |
| gin/x002 | without | 2/2 | 1 [1–1] | 4 [4–4] | 896 [843–948] | 16,474 [16,130–16,818] | 6,028 [5,663–6,393] | $0.0018 [$0.0017–$0.0019] | 9.6 s [8.9 s–10.2 s] |
| gin/x002 | with | 2/2 | 4 [3–4] | 6 [6–6] | 1,212 [1,130–1,294] | 33,058 [32,872–33,243] | 9,057 [8,854–9,259] | $0.0027 [$0.0027–$0.0028] | 12.2 s [11.9 s–12.4 s] |
| gin/x003 | without | 2/2 | 3 [2–3] | 7 [6–8] | 1,097 [865–1,329] | 34,144 [26,956–41,332] | 7,533 [7,512–7,553] | $0.0024 [$0.0022–$0.0026] | 12.1 s [10.0 s–14.2 s] |
| gin/x003 | with | 2/2 | 4 [4–4] | 8 [8–8] | 889 [843–934] | 47,607 [47,391–47,822] | 6,804 [6,313–7,295] | $0.0023 [$0.0022–$0.0024] | 12.2 s [11.7 s–12.7 s] |
| gin/x004 | without | 2/2 | 3 [2–3] | 6 [6–6] | 1,279 [1,049–1,509] | 29,353 [26,289–32,416] | 9,372 [6,808–11,935] | $0.0028 [$0.0021–$0.0035] | 12.4 s [10.9 s–13.8 s] |
| gin/x004 | with | 2/2 | 6 [5–6] | 9 [6–12] | 1,612 [1,582–1,641] | 61,412 [37,074–85,750] | 11,701 [11,581–11,820] | $0.0038 [$0.0036–$0.0040] | 15.6 s [15.2 s–16.0 s] |
| gin/x005 | without | 2/2 | 5 [5–5] | 7 [6–8] | 1,203 [1,200–1,206] | 33,854 [29,143–38,564] | 6,682 [6,303–7,060] | $0.0023 [$0.0023–$0.0023] | 13.4 s [11.8 s–15.0 s] |
| gin/x005 | with | 2/2 | 8 [7–8] | 10 [10–10] | 1,354 [1,154–1,554] | 65,062 [64,867–65,256] | 9,511 [9,226–9,796] | $0.0032 [$0.0032–$0.0033] | 15.0 s [14.8 s–15.2 s] |

