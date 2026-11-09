# Agent-level A/B — measured tool calls, tokens and cost

**claude-code 2.1.319 (Claude Code) · claude-haiku-5-5 · 2026-11-09 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap index strategy + 7-tool core MCP profile (the docs' setup for an agent that calls the tools).
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
| Tool calls | −39% | 0% | mixed |
| Input tokens (uncached) | −13% | +7% | mixed |
| Output tokens | −11% | −3% | fewer in every repetition |
| Cache-read tokens | +5% | +23% | more in every repetition |
| Cache-write tokens | −1% | −2% | fewer in every repetition |
| Total tokens (derived) | +3% | +18% | more in every repetition |
| Cost | −2% | +1% | mixed |
| Wall time | −1% | +6% | mixed |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −47% [−74%, +15%] † | +12% [−28%, +98%] † | mixed |
| Input tokens (uncached) | −15% [−33%, +18%] † | +8% [−16%, +52%] † | mixed |
| Output tokens | −8% [−29%, +27%] † | 0% [−15%, +18%] † | fewer in every repetition, within the noise |
| Cache-read tokens | 0% [−27%, +50%] † | +32% [−8%, +105%] † | mixed |
| Cache-write tokens | −3% [−18%, +14%] † | +4% [−17%, +35%] † | mixed |
| Total tokens (derived) | 0% [−24%, +43%] † | +27% [−6%, +91%] † | mixed |
| Cost | −3% [−20%, +23%] † | +7% [−13%, +39%] † | mixed |
| Wall time | −3% [−19%, +16%] † | +8% [−8%, +29%] † | mixed |

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
| django | 3 | 2 | −1 | 4 / 0 / 1 |
| all | 3 | 2 | −1 | 4 / 0 / 1 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | 6 | 5 | −1 | 4 / 0 / 1 |
| all | 6 | 5 | −1 | 4 / 0 / 1 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | 886 | 809 | −89 | 4 / 0 / 1 |
| all | 886 | 809 | −89 | 4 / 0 / 1 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | 27,317 | 27,368 | −657 | 3 / 0 / 2 |
| all | 27,317 | 27,368 | −657 | 3 / 0 / 2 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | 5,856 | 5,770 | −140 | 3 / 0 / 2 |
| all | 5,856 | 5,770 | −140 | 3 / 0 / 2 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | 34,064 | 33,547 | −562 | 4 / 0 / 1 |
| all | 34,064 | 33,547 | −562 | 4 / 0 / 1 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | $0.0019 | $0.0019 | −$0.0001 | 3 / 0 / 2 |
| all | $0.0019 | $0.0019 | −$0.0001 | 3 / 0 / 2 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | 10.7 s | 10.7 s | +91 ms | 2 / 0 / 3 |
| all | 10.7 s | 10.7 s | +91 ms | 2 / 0 / 3 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| django | $0.0234 (10 runs) | $0.0233 (10 runs) | none | none |
| all | $0.0234 (10 runs) | $0.0233 (10 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| django/x027 | without | 2/2 | 3 [2–4] | 6 [6–6] | 886 [686–1,086] | 27,317 [27,151–27,482] | 5,856 [4,655–7,056] | $0.0019 [$0.0015–$0.0022] | 10.3 s [9.7 s–10.9 s] |
| django/x027 | with | 2/2 | 2 [1–3] | 5 [4–6] | 818 [711–924] | 26,395 [18,191–34,599] | 6,285 [5,294–7,275] | $0.0019 [$0.0019–$0.0020] | 10.7 s [9.5 s–11.9 s] |
| django/x028 | without | 2/2 | 4 [4–4] | 6 [6–6] | 1,066 [970–1,162] | 28,025 [26,991–29,058] | 7,244 [6,880–7,608] | $0.0023 [$0.0021–$0.0024] | 12.3 s [11.6 s–13.0 s] |
| django/x028 | with | 2/2 | 2 [1–3] | 5 [4–6] | 809 [658–959] | 27,368 [20,612–34,124] | 5,365 [5,007–5,723] | $0.0018 [$0.0015–$0.0020] | 9.9 s [9.0 s–10.8 s] |
| django/x029 | without | 2/2 | 3 [3–3] | 6 [6–6] | 845 [755–934] | 26,910 [26,217–27,603] | 5,371 [5,097–5,644] | $0.0018 [$0.0018–$0.0018] | 10.7 s [10.0 s–11.5 s] |
| django/x029 | with | 2/2 | 2 [1–2] | 5 [4–6] | 756 [733–779] | 27,322 [20,614–34,029] | 4,576 [4,429–4,722] | $0.0016 [$0.0015–$0.0016] | 10.7 s [9.4 s–12.0 s] |
| django/x030 | without | 2/2 | 1 [1–1] | 4 [4–4] | 577 [495–659] | 16,278 [15,928–16,628] | 3,899 [3,425–4,372] | $0.0012 [$0.0012–$0.0013] | 9.1 s [8.6 s–9.7 s] |
| django/x030 | with | 2/2 | 3 [2–3] | 7 [6–8] | 798 [754–842] | 40,674 [33,176–48,172] | 5,770 [5,619–5,920] | $0.0020 [$0.0019–$0.0020] | 12.4 s [12.2 s–12.6 s] |
| django/x031 | without | 2/2 | 6 [5–6] | 8 [8–8] | 1,591 [1,566–1,615] | 57,016 [56,212–57,820] | 16,007 [15,917–16,096] | $0.0046 [$0.0046–$0.0046] | 15.7 s [15.4 s–15.9 s] |
| django/x031 | with | 2/2 | 5 [4–6] | 7 [6–8] | 1,456 [1,409–1,502] | 55,601 [43,405–67,796] | 15,867 [14,713–17,020] | $0.0045 [$0.0041–$0.0048] | 15.7 s [13.4 s–18.1 s] |

