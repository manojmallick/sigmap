# Agent-level A/B — measured tool calls, tokens and cost

**claude-code 2.1.321 (Claude Code) · claude-haiku-5-5 · 2026-11-09 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap lean: 7-tool core MCP profile + a three-line section.
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
| Tool calls | +15% | 0% | mixed |
| Input tokens (uncached) | 0% | +8% | mixed |
| Output tokens | −6% | −16% | fewer in every repetition |
| Cache-read tokens | +19% | +31% | more in every repetition |
| Cache-write tokens | +10% | +11% | more in every repetition |
| Total tokens (derived) | +17% | +27% | more in every repetition |
| Cost | +8% | +8% | more in every repetition |
| Wall time | +5% | +6% | more in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | +14% [0%, +47%] † | 0% [−19%, +24%] † | mixed |
| Input tokens (uncached) | 0% [0%, 0%] † | +7% [0%, +24%] † | mixed |
| Output tokens | −6% [−17%, +2%] † | −17% [−30%, −5%] | fewer in every repetition, within the noise |
| Cache-read tokens | +19% [+18%, +21%] | +30% [+16%, +54%] | more in every repetition, outside the noise |
| Cache-write tokens | +10% [−4%, +25%] † | +11% [0%, +28%] | more in every repetition, within the noise |
| Total tokens (derived) | +17% [+13%, +21%] | +26% [+12%, +44%] | more in every repetition, outside the noise |
| Cost | +8% [−2%, +20%] † | +7% [−1%, +17%] † | more in every repetition, within the noise |
| Wall time | +5% [+2%, +9%] | +6% [−4%, +15%] † | more in every repetition, within the noise |

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
| express | 4 | 4 | +0 | 1 / 1 / 2 |
| all | 4 | 4 | +0 | 1 / 1 / 2 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | 6 | 6 | 0 | 0 / 3 / 1 |
| all | 6 | 6 | 0 | 0 / 3 / 1 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | 799 | 736 | −74 | 3 / 0 / 1 |
| all | 799 | 736 | −74 | 3 / 0 / 1 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | 27,538 | 33,355 | +5,774 | 0 / 0 / 4 |
| all | 27,538 | 33,355 | +5,774 | 0 / 0 / 4 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | 5,914 | 6,403 | +379 | 1 / 0 / 3 |
| all | 5,914 | 6,403 | +379 | 1 / 0 / 3 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | 34,298 | 41,165 | +6,675 | 0 / 0 / 4 |
| all | 34,298 | 41,165 | +6,675 | 0 / 0 / 4 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | $0.0019 | $0.0020 | +$0.0001 | 1 / 0 / 3 |
| all | $0.0019 | $0.0020 | +$0.0001 | 1 / 0 / 3 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | 9.7 s | 10.1 s | +769 ms | 1 / 0 / 3 |
| all | 9.7 s | 10.1 s | +769 ms | 1 / 0 / 3 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| express | $0.0150 (8 runs) | $0.0162 (8 runs) | none | none |
| all | $0.0150 (8 runs) | $0.0162 (8 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| express/x037 | without | 2/2 | 4 [3–4] | 6 [6–6] | 987 [976–997] | 27,075 [26,795–27,354] | 6,139 [5,702–6,576] | $0.0020 [$0.0019–$0.0021] | 11.4 s [11.1 s–11.8 s] |
| express/x037 | with | 2/2 | 4 [4–4] | 7 [6–8] | 907 [834–979] | 38,844 [31,719–45,969] | 6,223 [6,065–6,381] | $0.0021 [$0.0021–$0.0021] | 12.7 s [11.6 s–13.7 s] |
| express/x038 | without | 2/2 | 4 [3–4] | 6 [6–6] | 827 [808–846] | 27,856 [27,689–28,022] | 5,903 [5,249–6,556] | $0.0019 [$0.0018–$0.0020] | 9.8 s [9.5 s–10.1 s] |
| express/x038 | with | 2/2 | 5 [4–5] | 6 [6–6] | 759 [744–773] | 34,422 [34,113–34,731] | 7,709 [7,227–8,191] | $0.0023 [$0.0022–$0.0024] | 10.2 s [9.8 s–10.7 s] |
| express/x039 | without | 2/2 | 4 [3–4] | 6 [6–6] | 707 [651–763] | 27,769 [26,791–28,747] | 5,908 [5,667–6,148] | $0.0018 [$0.0017–$0.0019] | 8.8 s [8.7 s–8.8 s] |
| express/x039 | with | 2/2 | 3 [3–3] | 6 [6–6] | 714 [679–748] | 32,133 [31,821–32,445] | 6,582 [6,048–7,116] | $0.0020 [$0.0019–$0.0021] | 9.9 s [9.7 s–10.0 s] |
| express/x040 | without | 2/2 | 3 [3–3] | 6 [6–6] | 770 [727–813] | 27,307 [27,097–27,516] | 5,920 [5,403–6,436] | $0.0018 [$0.0018–$0.0019] | 9.5 s [9.2 s–9.8 s] |
| express/x040 | with | 2/2 | 3 [3–3] | 6 [6–6] | 550 [526–574] | 32,287 [31,954–32,620] | 5,865 [5,630–6,099] | $0.0018 [$0.0017–$0.0018] | 9.0 s [8.8 s–9.3 s] |

