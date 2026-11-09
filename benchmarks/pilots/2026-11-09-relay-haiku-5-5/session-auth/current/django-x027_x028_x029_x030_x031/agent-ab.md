# Agent-level A/B — measured tool calls, tokens and cost

**claude-code 2.1.321 (Claude Code) · claude-haiku-5-5 · 2026-11-09 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap generated context + MCP server.
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
| Tool calls | −26% | −21% | fewer in every repetition |
| Input tokens (uncached) | −12% | −7% | fewer in every repetition |
| Output tokens | −19% | +15% | mixed |
| Cache-read tokens | +25% | +56% | more in every repetition |
| Cache-write tokens | +2% | −9% | mixed |
| Total tokens (derived) | +20% | +43% | more in every repetition |
| Cost | +1% | +6% | more in every repetition |
| Wall time | −12% | +6% | mixed |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −28% [−53%, +15%] † | −35% [−65%, +14%] † | fewer in every repetition, within the noise |
| Input tokens (uncached) | −10% [−32%, +18%] † | −11% [−28%, +9%] † | fewer in every repetition, within the noise |
| Output tokens | −19% [−30%, −3%] | +17% [−2%, +38%] † | mixed |
| Cache-read tokens | +40% [−9%, +111%] † | +47% [+20%, +82%] | more in every repetition, within the noise |
| Cache-write tokens | +5% [−13%, +35%] † | −14% [−28%, +2%] † | mixed |
| Total tokens (derived) | +33% [−8%, +87%] † | +36% [+11%, +66%] | more in every repetition, within the noise |
| Cost | +5% [−15%, +29%] † | +2% [−14%, +20%] † | more in every repetition, within the noise |
| Wall time | −12% [−23%, +5%] † | +5% [−3%, +13%] † | mixed |

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
| django | 4 | 2 | −1 | 3 / 1 / 1 |
| all | 4 | 2 | −1 | 3 / 1 / 1 |

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
| django | 873 | 897 | −44 | 4 / 0 / 1 |
| all | 873 | 897 | −44 | 4 / 0 / 1 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | 27,075 | 37,899 | +13,550 | 0 / 0 / 5 |
| all | 27,075 | 37,899 | +13,550 | 0 / 0 / 5 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | 5,423 | 5,027 | −545 | 3 / 0 / 2 |
| all | 5,423 | 5,027 | −545 | 3 / 0 / 2 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | 33,377 | 43,297 | +11,893 | 0 / 0 / 5 |
| all | 33,377 | 43,297 | +11,893 | 0 / 0 / 5 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | $0.0018 | $0.0019 | +$0.0000 | 2 / 0 / 3 |
| all | $0.0018 | $0.0019 | +$0.0000 | 2 / 0 / 3 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | 10.6 s | 10.6 s | −673 ms | 4 / 0 / 1 |
| all | 10.6 s | 10.6 s | −673 ms | 4 / 0 / 1 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| django | $0.0233 (10 runs) | $0.0240 (10 runs) | none | none |
| all | $0.0233 (10 runs) | $0.0240 (10 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| django/x027 | without | 2/2 | 4 [3–4] | 6 [6–6] | 873 [830–916] | 27,075 [26,792–27,358] | 5,423 [5,165–5,680] | $0.0018 [$0.0018–$0.0018] | 10.6 s [10.5 s–10.7 s] |
| django/x027 | with | 2/2 | 2 [1–3] | 5 [4–6] | 829 [778–880] | 35,747 [29,606–41,887] | 6,665 [3,737–9,592] | $0.0021 [$0.0015–$0.0027] | 9.2 s [8.8 s–9.6 s] |
| django/x028 | without | 2/2 | 2 [1–2] | 4 [4–4] | 838 [629–1,046] | 16,447 [16,119–16,774] | 4,060 [3,439–4,681] | $0.0014 [$0.0012–$0.0016] | 8.8 s [8.3 s–9.3 s] |
| django/x028 | with | 2/2 | 2 [1–3] | 5 [4–6] | 1,027 [925–1,128] | 37,899 [29,592–46,205] | 4,367 [3,506–5,227] | $0.0018 [$0.0015–$0.0021] | 10.6 s [9.7 s–11.4 s] |
| django/x029 | without | 2/2 | 2 [1–3] | 5 [4–6] | 784 [521–1,047] | 21,662 [16,782–26,541] | 5,046 [4,214–5,878] | $0.0016 [$0.0013–$0.0020] | 9.4 s [8.3 s–10.5 s] |
| django/x029 | with | 2/2 | 1 [1–1] | 4 [4–4] | 708 [687–728] | 29,270 [28,939–29,600] | 4,502 [4,050–4,953] | $0.0015 [$0.0015–$0.0016] | 8.7 s [8.6 s–8.9 s] |
| django/x030 | without | 2/2 | 4 [3–5] | 7 [6–8] | 1,116 [995–1,236] | 33,227 [27,096–39,357] | 6,464 [5,766–7,162] | $0.0022 [$0.0019–$0.0024] | 12.1 s [11.2 s–13.0 s] |
| django/x030 | with | 2/2 | 2 [1–3] | 6 [4–8] | 897 [891–903] | 46,776 [29,596–63,956] | 5,027 [3,688–6,366] | $0.0019 [$0.0015–$0.0024] | 11.6 s [11.2 s–12.1 s] |
| django/x031 | without | 2/2 | 6 [5–6] | 9 [8–10] | 1,655 [1,649–1,661] | 68,289 [57,919–78,659] | 15,671 [15,139–16,202] | $0.0046 [$0.0044–$0.0049] | 15.8 s [15.6 s–15.9 s] |
| django/x031 | with | 2/2 | 6 [4–7] | 8 [6–10] | 1,617 [1,249–1,984] | 81,954 [54,094–109,814] | 15,089 [14,304–15,874] | $0.0046 [$0.0040–$0.0053] | 14.4 s [11.2 s–17.6 s] |

