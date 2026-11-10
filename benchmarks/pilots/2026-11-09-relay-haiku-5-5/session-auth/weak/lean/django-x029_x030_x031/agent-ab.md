# Agent-level A/B — measured tool calls, tokens and cost

**claude-code 2.1.322 (Claude Code) · claude-haiku-4-5 · 2026-11-10 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap lean: 7-tool core MCP profile + a three-line section.
- Both arms: the same prompt, model, tool allowlist (Read, Grep, Glob, Bash), per-run budget cap $1 and timeout 420 s; run in a clean copy of the commit pinned in `benchmarks/xrepo-repos.json`.
- Questions: the task id(s) x029, x030, x031 of `benchmarks/tasks/retrieval-xrepo.jsonl`. Pass = hit@5 on the repository-relative paths the answer names.
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
| django | 3 | 6/6 | 6/6 | 0 / 0 |
| all | 3 | 6/6 | 6/6 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 3. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | +19% | −39% | mixed |
| Input tokens (uncached) | +16% | −41% | mixed |
| Output tokens | +35% | −38% | mixed |
| Cache-read tokens | +12% | −53% | mixed |
| Cache-write tokens | −19% | −49% | fewer in every repetition |
| Total tokens (derived) | +9% | −52% | mixed |
| Cost | −2% | −48% | fewer in every repetition |
| Wall time | +33% | −32% | mixed |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | +30% [−25%, +225%] † | −47% [−70%, −21%] | mixed |
| Input tokens (uncached) | +24% [−23%, +171%] † | −45% [−62%, −33%] | mixed |
| Output tokens | +38% [−10%, +169%] † | −40% [−51%, −23%] | mixed |
| Cache-read tokens | +30% [−41%, +375%] † | −56% [−70%, −36%] | mixed |
| Cache-write tokens | −20% [−49%, +78%] † | −46% [−65%, −33%] | fewer in every repetition, within the noise |
| Total tokens (derived) | +25% [−41%, +327%] † | −55% [−67%, −36%] | mixed |
| Cost | +2% [−35%, +148%] † | −47% [−59%, −32%] | mixed |
| Wall time | +34% [−10%, +131%] † | −32% [−38%, −22%] | mixed |

### Outcome (hit@5), by repetition

Per paired task: **better** = the SigMap arm named the file and the other did not; **worse** = the reverse; **tie** = both found it or both missed. Localisation only.

| repetition | paired tasks | better | worse | tie |
| --- | ---: | ---: | ---: | ---: |
| R1 | 3 | 0 | 0 | 3 |
| R2 | 3 | 0 | 0 | 3 |
| all | 6 | 0 | 0 | 6 |

## Tool calls

Provenance: agent-reported (main-thread tool_use blocks). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | 13 | 10 | −3 | 2 / 0 / 1 |
| all | 13 | 10 | −3 | 2 / 0 / 1 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | 110 | 82 | −24 | 2 / 0 / 1 |
| all | 110 | 82 | −24 | 2 / 0 / 1 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | 2,697 | 2,139 | −254 | 2 / 0 / 1 |
| all | 2,697 | 2,139 | −254 | 2 / 0 / 1 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | 265,924 | 167,990 | −102,832 | 2 / 0 / 1 |
| all | 265,924 | 167,990 | −102,832 | 2 / 0 / 1 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | 18,901 | 11,644 | −7,257 | 2 / 0 / 1 |
| all | 18,901 | 11,644 | −7,257 | 2 / 0 / 1 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | 287,635 | 179,549 | −110,374 | 2 / 0 / 1 |
| all | 287,635 | 179,549 | −110,374 | 2 / 0 / 1 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | $0.0780 | $0.0519 | −$0.0261 | 2 / 0 / 1 |
| all | $0.0780 | $0.0519 | −$0.0261 | 2 / 0 / 1 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | 33.3 s | 28.6 s | −1.6 s | 2 / 0 / 1 |
| all | 33.3 s | 28.6 s | −1.6 s | 2 / 0 / 1 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| django | $0.4242 (6 runs) | $0.3080 (6 runs) | none | none |
| all | $0.4242 (6 runs) | $0.3080 (6 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| django/x029 | without | 2/2 | 13 [12–14] | 114 [106–122] | 2,697 [2,361–3,032] | 265,924 [250,033–281,814] | 18,901 [15,551–22,251] | $0.0780 [$0.0714–$0.0846] | 33.4 s [30.6 s–36.3 s] |
| django/x029 | with | 2/2 | 10 [9–11] | 82 [82–82] | 2,443 [2,320–2,566] | 163,092 [159,427–166,757] | 11,644 [10,460–12,828] | $0.0519 [$0.0485–$0.0552] | 31.8 s [28.4 s–35.2 s] |
| django/x030 | without | 2/2 | 7 [4–10] | 66 [42–90] | 1,644 [1,211–2,077] | 115,047 [61,686–168,407] | 12,244 [10,959–13,529] | $0.0443 [$0.0342–$0.0544] | 22.1 s [17.5 s–26.8 s] |
| django/x030 | with | 2/2 | 8 [3–13] | 74 [34–114] | 2,139 [1,024–3,253] | 171,837 [50,795–292,878] | 14,241 [8,984–19,497] | $0.0564 [$0.0282–$0.0847] | 28.6 s [16.6 s–40.5 s] |
| django/x031 | without | 2/2 | 13 [11–14] | 110 [98–122] | 2,783 [2,208–3,357] | 294,628 [227,208–362,048] | 23,172 [18,605–27,738] | $0.0898 [$0.0711–$0.1086] | 33.3 s [27.6 s–38.9 s] |
| django/x031 | with | 2/2 | 10 [9–10] | 86 [82–90] | 1,954 [1,929–1,978] | 167,990 [158,693–177,287] | 9,520 [9,407–9,632] | $0.0457 [$0.0449–$0.0465] | 24.9 s [24.7 s–25.0 s] |

