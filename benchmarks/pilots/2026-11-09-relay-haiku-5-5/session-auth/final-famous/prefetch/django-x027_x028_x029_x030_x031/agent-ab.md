# Agent-level A/B — measured tool calls, tokens and cost

**claude-code 2.1.322 (Claude Code) · claude-haiku-5-5 · 2026-11-11 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap ranked the question BEFORE the first turn (what a prompt hook would inject): the five likeliest files with their signatures and line anchors after the question in the user turn, + the sigmap CLI; no MCP server, no standing section, no extra tool call.
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
| Tool calls | −14% | −60% | fewer in every repetition |
| Input tokens (uncached) | −13% | −39% | fewer in every repetition |
| Output tokens | +23% | −23% | mixed |
| Cache-read tokens | −5% | −41% | fewer in every repetition |
| Cache-write tokens | +62% | −43% | mixed |
| Total tokens (derived) | +6% | −41% | mixed |
| Cost | +42% | −38% | mixed |
| Wall time | +12% | −20% | mixed |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −8% [−32%, +40%] † | −63% [−73%, −45%] | fewer in every repetition, within the noise |
| Input tokens (uncached) | −13% [−26%, 0%] † | −38% [−45%, −33%] | fewer in every repetition, within the noise |
| Output tokens | +22% [+8%, +45%] | −22% [−35%, −10%] | mixed |
| Cache-read tokens | −6% [−26%, +12%] † | −40% [−50%, −30%] | fewer in every repetition, within the noise |
| Cache-write tokens | +58% [+26%, +94%] | −42% [−54%, −27%] | mixed |
| Total tokens (derived) | +6% [−15%, +21%] † | −40% [−50%, −31%] | mixed |
| Cost | +40% [+16%, +62%] | −38% [−47%, −26%] | mixed |
| Wall time | +12% [0%, +32%] † | −20% [−26%, −11%] | mixed |

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
| django | 3 | 2 | −2 | 5 / 0 / 0 |
| all | 3 | 2 | −2 | 5 / 0 / 0 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | 6 | 5 | −2 | 5 / 0 / 0 |
| all | 6 | 5 | −2 | 5 / 0 / 0 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | 955 | 903 | −1 | 3 / 1 / 1 |
| all | 955 | 903 | −1 | 3 / 1 / 1 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | 29,129 | 25,513 | −11,134 | 5 / 0 / 0 |
| all | 29,129 | 25,513 | −11,134 | 5 / 0 / 0 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | 6,683 | 5,902 | −587 | 3 / 0 / 2 |
| all | 6,683 | 5,902 | −587 | 3 / 0 / 2 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | 36,772 | 32,323 | −11,915 | 5 / 0 / 0 |
| all | 36,772 | 32,323 | −11,915 | 5 / 0 / 0 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | $0.0021 | $0.0019 | −$0.0002 | 3 / 0 / 2 |
| all | $0.0021 | $0.0019 | −$0.0002 | 3 / 0 / 2 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | 9.8 s | 9.7 s | −930 ms | 4 / 0 / 1 |
| all | 9.8 s | 9.7 s | −930 ms | 4 / 0 / 1 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| django | $0.0224 (10 runs) | $0.0214 (10 runs) | none | none |
| all | $0.0224 (10 runs) | $0.0214 (10 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| django/x027 | without | 2/2 | 4 [3–5] | 6 [6–6] | 1,138 [730–1,545] | 28,468 [27,341–29,594] | 6,416 [4,834–7,998] | $0.0021 [$0.0016–$0.0027] | 9.9 s [8.0 s–11.8 s] |
| django/x027 | with | 2/2 | 2 [1–3] | 5 [4–6] | 1,046 [852–1,239] | 26,073 [21,010–31,135] | 5,830 [3,802–7,857] | $0.0019 [$0.0014–$0.0025] | 10.4 s [8.5 s–12.3 s] |
| django/x028 | without | 2/2 | 3 [3–3] | 6 [6–6] | 955 [934–975] | 29,129 [28,273–29,984] | 6,683 [6,624–6,741] | $0.0021 [$0.0021–$0.0021] | 9.7 s [9.7 s–9.7 s] |
| django/x028 | with | 2/2 | 2 [2–2] | 4 [4–4] | 850 [735–965] | 17,995 [17,149–18,840] | 6,009 [5,170–6,847] | $0.0018 [$0.0016–$0.0020] | 8.3 s [7.5 s–9.2 s] |
| django/x029 | without | 2/2 | 3 [3–3] | 6 [6–6] | 881 [860–901] | 27,321 [27,231–27,410] | 5,402 [5,379–5,424] | $0.0018 [$0.0018–$0.0018] | 9.8 s [9.3 s–10.2 s] |
| django/x029 | with | 2/2 | 2 [1–2] | 5 [4–6] | 903 [806–1,000] | 25,513 [20,164–30,861] | 5,902 [4,050–7,754] | $0.0019 [$0.0014–$0.0024] | 9.7 s [9.1 s–10.3 s] |
| django/x030 | without | 2/2 | 2 [1–3] | 6 [4–8] | 834 [733–935] | 32,568 [16,782–48,353] | 7,124 [3,525–10,722] | $0.0022 [$0.0012–$0.0031] | 9.6 s [8.1 s–11.1 s] |
| django/x030 | with | 2/2 | 2 [1–2] | 4 [4–4] | 834 [789–879] | 19,061 [17,863–20,258] | 5,606 [4,185–7,027] | $0.0017 [$0.0015–$0.0020] | 8.7 s [8.6 s–8.7 s] |
| django/x031 | without | 2/2 | 5 [4–6] | 9 [8–10] | 1,295 [1,163–1,427] | 52,667 [44,170–61,163] | 9,027 [8,238–9,815] | $0.0030 [$0.0027–$0.0033] | 12.2 s [10.9 s–13.5 s] |
| django/x031 | with | 2/2 | 3 [3–3] | 6 [6–6] | 1,294 [1,162–1,426] | 37,233 [35,086–39,379] | 11,436 [5,899–16,972] | $0.0033 [$0.0021–$0.0045] | 11.3 s [10.4 s–12.2 s] |

