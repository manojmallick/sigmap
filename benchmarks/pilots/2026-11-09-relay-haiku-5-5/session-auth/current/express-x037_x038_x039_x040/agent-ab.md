# Agent-level A/B — measured tool calls, tokens and cost

**claude-code 2.1.321 (Claude Code) · claude-haiku-5-5 · 2026-11-09 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap generated context + MCP server.
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
| Tool calls | −43% | −45% | fewer in every repetition |
| Input tokens (uncached) | −36% | −25% | fewer in every repetition |
| Output tokens | −15% | −13% | fewer in every repetition |
| Cache-read tokens | 0% | +24% | more in every repetition |
| Cache-write tokens | +8% | −27% | mixed |
| Total tokens (derived) | +1% | +15% | more in every repetition |
| Cost | +1% | −16% | mixed |
| Wall time | −10% | −12% | fewer in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −48% [−61%, −32%] | −48% [−67%, −18%] | fewer in every repetition, outside the noise |
| Input tokens (uncached) | −36% [−46%, −27%] | −26% [−33%, −10%] | fewer in every repetition, outside the noise |
| Output tokens | −15% [−28%, −1%] | −15% [−28%, −3%] | fewer in every repetition, outside the noise |
| Cache-read tokens | −1% [−25%, +17%] † | +21% [+8%, +50%] | mixed |
| Cache-write tokens | +1% [−23%, +48%] † | −27% [−34%, −21%] | mixed |
| Total tokens (derived) | +1% [−13%, +12%] † | +13% [0%, +37%] | more in every repetition, within the noise |
| Cost | −2% [−15%, +23%] † | −17% [−24%, −9%] | fewer in every repetition, within the noise |
| Wall time | −10% [−20%, −1%] | −13% [−21%, −4%] | fewer in every repetition, outside the noise |

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
| express | 3 | 2 | −2 | 4 / 0 / 0 |
| all | 3 | 2 | −2 | 4 / 0 / 0 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | 7 | 4 | −2 | 4 / 0 / 0 |
| all | 7 | 4 | −2 | 4 / 0 / 0 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | 815 | 636 | −103 | 4 / 0 / 0 |
| all | 815 | 636 | −103 | 4 / 0 / 0 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | 30,242 | 29,958 | +2,657 | 1 / 0 / 3 |
| all | 30,242 | 29,958 | +2,657 | 1 / 0 / 3 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | 5,754 | 4,837 | −1,146 | 3 / 0 / 1 |
| all | 5,754 | 4,837 | −1,146 | 3 / 0 / 1 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | 36,814 | 35,450 | +949 | 1 / 0 / 3 |
| all | 36,814 | 35,450 | +949 | 1 / 0 / 3 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | $0.0019 | $0.0017 | −$0.0002 | 3 / 0 / 1 |
| all | $0.0019 | $0.0017 | −$0.0002 | 3 / 0 / 1 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | 10.3 s | 9.2 s | −1.0 s | 4 / 0 / 0 |
| all | 10.3 s | 9.2 s | −1.0 s | 4 / 0 / 0 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| express | $0.0151 (8 runs) | $0.0140 (8 runs) | none | none |
| all | $0.0151 (8 runs) | $0.0140 (8 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| express/x037 | without | 2/2 | 3 [2–4] | 7 [6–8] | 962 [931–993] | 32,931 [27,744–38,117] | 5,789 [5,766–5,811] | $0.0020 [$0.0019–$0.0020] | 11.5 s [11.2 s–11.8 s] |
| express/x037 | with | 2/2 | 3 [2–3] | 4 [4–4] | 960 [942–978] | 27,760 [25,231–30,288] | 7,566 [4,685–10,447] | $0.0023 [$0.0017–$0.0028] | 10.9 s [10.6 s–11.2 s] |
| express/x038 | without | 2/2 | 4 [3–5] | 7 [6–8] | 954 [768–1,139] | 34,557 [28,614–40,499] | 6,327 [5,811–6,843] | $0.0021 [$0.0018–$0.0023] | 10.7 s [9.6 s–11.8 s] |
| express/x038 | with | 2/2 | 3 [2–3] | 6 [6–6] | 695 [646–744] | 47,976 [47,911–48,041] | 5,598 [4,496–6,699] | $0.0019 [$0.0017–$0.0022] | 9.8 s [8.8 s–10.8 s] |
| express/x039 | without | 2/2 | 3 [3–3] | 6 [6–6] | 660 [621–699] | 27,553 [26,844–28,262] | 5,720 [5,617–5,823] | $0.0018 [$0.0017–$0.0018] | 9.8 s [8.7 s–10.9 s] |
| express/x039 | with | 2/2 | 1 [1–1] | 4 [4–4] | 576 [573–579] | 29,954 [29,630–30,278] | 4,076 [3,613–4,539] | $0.0014 [$0.0013–$0.0015] | 8.6 s [8.2 s–8.9 s] |
| express/x040 | without | 2/2 | 3 [2–3] | 6 [6–6] | 676 [630–721] | 27,050 [26,620–27,479] | 5,625 [5,465–5,784] | $0.0017 [$0.0017–$0.0017] | 10.0 s [9.2 s–10.7 s] |
| express/x040 | with | 2/2 | 1 [1–1] | 4 [4–4] | 554 [474–633] | 29,962 [29,630–30,294] | 4,063 [3,933–4,192] | $0.0014 [$0.0013–$0.0015] | 7.9 s [7.6 s–8.2 s] |

