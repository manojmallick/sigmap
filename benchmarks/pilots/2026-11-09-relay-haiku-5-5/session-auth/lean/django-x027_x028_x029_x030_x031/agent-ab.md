# Agent-level A/B — measured tool calls, tokens and cost

**claude-code 2.1.321 (Claude Code) · claude-haiku-5-5 · 2026-11-09 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap lean: 7-tool core MCP profile + a three-line section.
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
| Tool calls | +30% | +35% | more in every repetition |
| Input tokens (uncached) | +11% | +6% | more in every repetition |
| Output tokens | +1% | +26% | more in every repetition |
| Cache-read tokens | +32% | +28% | more in every repetition |
| Cache-write tokens | +6% | +34% | more in every repetition |
| Total tokens (derived) | +26% | +29% | more in every repetition |
| Cost | +9% | +31% | more in every repetition |
| Wall time | +13% | +19% | more in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | +33% [+11%, +66%] | +74% [−4%, +217%] † | more in every repetition, within the noise |
| Input tokens (uncached) | +10% [−11%, +31%] † | +12% [−18%, +57%] † | more in every repetition, within the noise |
| Output tokens | −2% [−17%, +15%] † | +32% [+9%, +67%] | mixed |
| Cache-read tokens | +29% [+3%, +57%] | +41% [−4%, +110%] † | more in every repetition, within the noise |
| Cache-write tokens | +6% [−9%, +19%] † | +37% [+19%, +64%] | more in every repetition, within the noise |
| Total tokens (derived) | +24% [+2%, +47%] | +40% [0%, +102%] † | more in every repetition, within the noise |
| Cost | +7% [−3%, +18%] † | +36% [+14%, +69%] | more in every repetition, within the noise |
| Wall time | +12% [−8%, +36%] † | +21% [+3%, +41%] | more in every repetition, within the noise |

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
| django | 4 | 4 | +1 | 1 / 0 / 4 |
| all | 4 | 4 | +1 | 1 / 0 / 4 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | 6 | 7 | +1 | 1 / 1 / 3 |
| all | 6 | 7 | +1 | 1 / 1 / 3 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | 874 | 961 | +104 | 1 / 0 / 4 |
| all | 874 | 961 | +104 | 1 / 0 / 4 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | 27,001 | 39,725 | +12,724 | 1 / 0 / 4 |
| all | 27,001 | 39,725 | +12,724 | 1 / 0 / 4 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | 6,539 | 7,144 | +1,166 | 0 / 0 / 5 |
| all | 6,539 | 7,144 | +1,166 | 0 / 0 / 5 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | 33,346 | 47,341 | +13,995 | 1 / 0 / 4 |
| all | 33,346 | 47,341 | +13,995 | 1 / 0 / 4 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | $0.0021 | $0.0022 | +$0.0004 | 0 / 0 / 5 |
| all | $0.0021 | $0.0022 | +$0.0004 | 0 / 0 / 5 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | 9.8 s | 12.9 s | +1.4 s | 1 / 0 / 4 |
| all | 9.8 s | 12.9 s | +1.4 s | 1 / 0 / 4 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| django | $0.0232 (10 runs) | $0.0273 (10 runs) | none | none |
| all | $0.0232 (10 runs) | $0.0273 (10 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| django/x027 | without | 2/2 | 4 [4–4] | 6 [6–6] | 874 [825–923] | 27,001 [26,685–27,317] | 5,465 [5,203–5,727] | $0.0018 [$0.0017–$0.0019] | 9.6 s [9.1 s–10.0 s] |
| django/x027 | with | 2/2 | 5 [5–5] | 7 [6–8] | 978 [955–1,001] | 39,725 [33,457–45,993] | 6,631 [6,238–7,024] | $0.0022 [$0.0021–$0.0023] | 12.9 s [10.6 s–15.2 s] |
| django/x028 | without | 2/2 | 4 [3–5] | 8 [8–8] | 956 [768–1,144] | 39,836 [38,952–40,719] | 6,539 [6,487–6,590] | $0.0022 [$0.0021–$0.0023] | 11.6 s [11.6 s–11.7 s] |
| django/x028 | with | 2/2 | 4 [3–4] | 6 [6–6] | 888 [664–1,112] | 33,327 [32,082–34,572] | 7,144 [6,926–7,362] | $0.0022 [$0.0020–$0.0024] | 10.7 s [10.5 s–10.8 s] |
| django/x029 | without | 2/2 | 2 [1–3] | 5 [4–6] | 771 [474–1,068] | 21,695 [16,782–26,607] | 5,097 [4,241–5,952] | $0.0016 [$0.0013–$0.0020] | 9.4 s [7.4 s–11.3 s] |
| django/x029 | with | 2/2 | 4 [4–4] | 6 [6–6] | 847 [769–924] | 33,312 [33,042–33,582] | 6,609 [6,222–6,996] | $0.0021 [$0.0020–$0.0021] | 10.3 s [9.6 s–11.1 s] |
| django/x030 | without | 2/2 | 2 [1–2] | 5 [4–6] | 720 [602–837] | 23,902 [16,780–31,024] | 7,318 [3,355–11,280] | $0.0021 [$0.0011–$0.0030] | 9.8 s [9.5 s–10.1 s] |
| django/x030 | with | 2/2 | 4 [4–4] | 8 [8–8] | 961 [906–1,016] | 46,720 [46,654–46,785] | 7,524 [6,312–8,735] | $0.0025 [$0.0022–$0.0027] | 14.0 s [13.9 s–14.0 s] |
| django/x031 | without | 2/2 | 7 [6–8] | 10 [10–10] | 1,605 [1,366–1,844] | 67,268 [56,094–78,442] | 12,339 [8,113–16,565] | $0.0039 [$0.0029–$0.0050] | 15.4 s [14.3 s–16.6 s] |
| django/x031 | with | 2/2 | 8 [6–10] | 10 [8–12] | 1,847 [1,597–2,097] | 80,506 [53,641–107,371] | 14,850 [10,753–18,947] | $0.0047 [$0.0035–$0.0059] | 16.8 s [16.0 s–17.6 s] |

