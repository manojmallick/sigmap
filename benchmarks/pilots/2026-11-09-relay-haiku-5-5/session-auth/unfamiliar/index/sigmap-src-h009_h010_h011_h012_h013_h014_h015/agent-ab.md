# Agent-level A/B — measured tool calls, tokens and cost

**claude-code 2.1.322 (Claude Code) · claude-haiku-5-5 · 2026-11-10 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap index strategy + 7-tool core MCP profile (the docs' setup for an agent that calls the tools).
- Both arms: the same prompt, model, tool allowlist (Read, Grep, Glob, Bash), per-run budget cap $0.6 and timeout 420 s; run in a clean copy of the commit pinned in `benchmarks/xrepo-repos.json`.
- Questions: the task id(s) h009, h010, h011, h012, h013, h014, h015 of `benchmarks/tasks/retrieval-xrepo.jsonl`. Pass = hit@5 on the repository-relative paths the answer names.
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
| sigmap-src | 7 | 14/14 | 14/14 | 0 / 0 |
| all | 7 | 14/14 | 14/14 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 7. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −55% | −45% | fewer in every repetition |
| Input tokens (uncached) | −41% | −23% | fewer in every repetition |
| Output tokens | −45% | −41% | fewer in every repetition |
| Cache-read tokens | −46% | −11% | fewer in every repetition |
| Cache-write tokens | −37% | −38% | fewer in every repetition |
| Total tokens (derived) | −44% | −17% | fewer in every repetition |
| Cost | −40% | −35% | fewer in every repetition |
| Wall time | −29% | −17% | fewer in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −56% [−74%, −18%] | −49% [−74%, −12%] | fewer in every repetition, outside the noise |
| Input tokens (uncached) | −39% [−55%, −14%] | −24% [−40%, −8%] | fewer in every repetition, outside the noise |
| Output tokens | −42% [−61%, −9%] | −40% [−57%, −15%] | fewer in every repetition, outside the noise |
| Cache-read tokens | −39% [−61%, 0%] | −12% [−36%, +14%] † | fewer in every repetition, within the noise |
| Cache-write tokens | −33% [−49%, −14%] | −37% [−52%, −16%] | fewer in every repetition, outside the noise |
| Total tokens (derived) | −38% [−58%, −4%] | −17% [−39%, +6%] † | fewer in every repetition, within the noise |
| Cost | −36% [−53%, −13%] | −34% [−50%, −13%] | fewer in every repetition, outside the noise |
| Wall time | −27% [−39%, −10%] | −17% [−29%, −4%] | fewer in every repetition, outside the noise |

### Outcome (hit@5), by repetition

Per paired task: **better** = the SigMap arm named the file and the other did not; **worse** = the reverse; **tie** = both found it or both missed. Localisation only.

| repetition | paired tasks | better | worse | tie |
| --- | ---: | ---: | ---: | ---: |
| R1 | 7 | 0 | 0 | 7 |
| R2 | 7 | 0 | 0 | 7 |
| all | 14 | 0 | 0 | 14 |

## Tool calls

Provenance: agent-reported (main-thread tool_use blocks). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 5 | 3 | −3 | 5 / 0 / 2 |
| all | 5 | 3 | −3 | 5 / 0 / 2 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 9 | 6 | −4 | 5 / 1 / 1 |
| all | 9 | 6 | −4 | 5 / 1 / 1 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 1,510 | 753 | −708 | 6 / 0 / 1 |
| all | 1,510 | 753 | −708 | 6 / 0 / 1 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 53,495 | 35,215 | −23,034 | 5 / 0 / 2 |
| all | 53,495 | 35,215 | −23,034 | 5 / 0 / 2 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 9,263 | 7,035 | −2,179 | 7 / 0 / 0 |
| all | 9,263 | 7,035 | −2,179 | 7 / 0 / 0 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 67,649 | 41,570 | −25,925 | 5 / 0 / 2 |
| all | 67,649 | 41,570 | −25,925 | 5 / 0 / 2 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | $0.0032 | $0.0022 | −$0.0010 | 6 / 0 / 1 |
| all | $0.0032 | $0.0022 | −$0.0010 | 6 / 0 / 1 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 14.1 s | 10.3 s | −4.2 s | 6 / 0 / 1 |
| all | 14.1 s | 10.3 s | −4.2 s | 6 / 0 / 1 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | $0.0460 (14 runs) | $0.0286 (14 runs) | none | none |
| all | $0.0460 (14 runs) | $0.0286 (14 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| sigmap-src/h009 | without | 2/2 | 7 [3–10] | 11 [8–14] | 1,782 [1,280–2,283] | 68,531 [45,742–91,320] | 12,827 [12,685–12,969] | $0.0041 [$0.0036–$0.0046] | 16.2 s [13.7 s–18.7 s] |
| sigmap-src/h009 | with | 2/2 | 3 [2–3] | 6 [6–6] | 652 [593–710] | 35,215 [34,951–35,478] | 5,698 [4,833–6,563] | $0.0018 [$0.0016–$0.0020] | 12.0 s [10.9 s–13.1 s] |
| sigmap-src/h010 | without | 2/2 | 5 [5–5] | 9 [8–10] | 1,572 [1,486–1,658] | 53,495 [43,949–63,041] | 12,573 [11,710–13,435] | $0.0038 [$0.0036–$0.0041] | 14.8 s [14.0 s–15.6 s] |
| sigmap-src/h010 | with | 2/2 | 2 [2–2] | 5 [4–6] | 905 [880–930] | 27,904 [20,702–35,106] | 7,110 [5,260–8,960] | $0.0022 [$0.0019–$0.0024] | 10.6 s [9.6 s–11.5 s] |
| sigmap-src/h011 | without | 2/2 | 5 [4–5] | 6 [6–6] | 1,510 [1,405–1,614] | 27,734 [27,282–28,186] | 7,161 [7,035–7,286] | $0.0025 [$0.0024–$0.0025] | 12.4 s [12.0 s–12.7 s] |
| sigmap-src/h011 | with | 2/2 | 1 [1–1] | 4 [4–4] | 584 [472–695] | 21,017 [20,700–21,334] | 5,448 [5,122–5,773] | $0.0016 [$0.0015–$0.0017] | 8.3 s [7.9 s–8.8 s] |
| sigmap-src/h012 | without | 2/2 | 6 [3–8] | 10 [6–14] | 1,461 [1,101–1,820] | 59,187 [28,288–90,085] | 9,263 [8,182–10,344] | $0.0032 [$0.0025–$0.0039] | 14.1 s [10.2 s–18.1 s] |
| sigmap-src/h012 | with | 2/2 | 3 [2–3] | 6 [6–6] | 753 [693–813] | 36,153 [34,588–37,717] | 7,084 [6,371–7,797] | $0.0022 [$0.0020–$0.0023] | 9.7 s [9.4 s–9.9 s] |
| sigmap-src/h013 | without | 2/2 | 9 [8–9] | 11 [10–12] | 1,899 [1,892–1,906] | 75,734 [52,597–98,870] | 16,441 [12,196–20,685] | $0.0050 [$0.0039–$0.0061] | 17.0 s [15.9 s–18.0 s] |
| sigmap-src/h013 | with | 2/2 | 2 [1–2] | 5 [4–6] | 720 [680–759] | 28,106 [21,334–34,878] | 6,234 [5,053–7,415] | $0.0019 [$0.0016–$0.0022] | 10.3 s [9.5 s–11.0 s] |
| sigmap-src/h014 | without | 2/2 | 3 [2–3] | 6 [6–6] | 799 [695–902] | 27,442 [27,192–27,691] | 7,898 [6,657–9,139] | $0.0023 [$0.0020–$0.0026] | 10.5 s [10.3 s–10.7 s] |
| sigmap-src/h014 | with | 2/2 | 3 [3–3] | 6 [6–6] | 780 [752–807] | 36,570 [36,213–36,926] | 7,084 [6,771–7,396] | $0.0022 [$0.0021–$0.0022] | 10.2 s [9.6 s–10.8 s] |
| sigmap-src/h015 | without | 2/2 | 4 [4–4] | 7 [6–8] | 809 [797–821] | 34,030 [27,924–40,135] | 7,051 [5,925–8,176] | $0.0022 [$0.0020–$0.0023] | 10.4 s [9.6 s–11.3 s] |
| sigmap-src/h015 | with | 2/2 | 6 [5–6] | 8 [8–8] | 1,215 [1,104–1,326] | 50,121 [49,220–51,022] | 7,035 [6,469–7,601] | $0.0025 [$0.0024–$0.0027] | 12.0 s [12.0 s–12.1 s] |

