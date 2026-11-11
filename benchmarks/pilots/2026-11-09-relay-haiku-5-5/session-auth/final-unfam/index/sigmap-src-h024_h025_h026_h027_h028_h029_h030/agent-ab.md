# Agent-level A/B — measured tool calls, tokens and cost

**claude-code 2.1.322 (Claude Code) · claude-haiku-5-5 · 2026-11-11 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap index strategy + 7-tool core MCP profile (the docs' setup for an agent that calls the tools).
- Both arms: the same prompt, model, tool allowlist (Read, Grep, Glob, Bash), per-run budget cap $0.5 and timeout 420 s; run in a clean copy of the commit pinned in `benchmarks/xrepo-repos.json`.
- Questions: the task id(s) h024, h025, h026, h027, h028, h029, h030 of `benchmarks/tasks/retrieval-xrepo.jsonl`. Pass = hit@5 on the repository-relative paths the answer names.
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
| sigmap-src | 7 | 12/14 | 12/14 | 0 / 0 |
| all | 7 | 12/14 | 12/14 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 7. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −29% | −31% | fewer in every repetition |
| Input tokens (uncached) | −31% | −22% | fewer in every repetition |
| Output tokens | −30% | −24% | fewer in every repetition |
| Cache-read tokens | −22% | −14% | fewer in every repetition |
| Cache-write tokens | −14% | −30% | fewer in every repetition |
| Total tokens (derived) | −21% | −17% | fewer in every repetition |
| Cost | −19% | −26% | fewer in every repetition |
| Wall time | −22% | −14% | fewer in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −30% [−63%, +35%] † | −26% [−50%, +15%] † | fewer in every repetition, within the noise |
| Input tokens (uncached) | −32% [−48%, −11%] | −23% [−43%, +1%] † | fewer in every repetition, within the noise |
| Output tokens | −29% [−51%, 0%] | −20% [−33%, +1%] † | fewer in every repetition, within the noise |
| Cache-read tokens | −24% [−47%, +8%] † | −15% [−45%, +22%] † | fewer in every repetition, within the noise |
| Cache-write tokens | −14% [−34%, +11%] † | −28% [−48%, −4%] | fewer in every repetition, within the noise |
| Total tokens (derived) | −22% [−44%, +7%] † | −18% [−44%, +13%] † | fewer in every repetition, within the noise |
| Cost | −19% [−39%, +6%] † | −25% [−43%, −4%] | fewer in every repetition, within the noise |
| Wall time | −21% [−36%, −5%] | −13% [−23%, +1%] † | fewer in every repetition, within the noise |

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
| sigmap-src | 5 | 3 | −2 | 5 / 1 / 1 |
| all | 5 | 3 | −2 | 5 / 1 / 1 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 8 | 6 | −2 | 6 / 1 / 0 |
| all | 8 | 6 | −2 | 6 / 1 / 0 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 1,243 | 920 | −447 | 5 / 0 / 2 |
| all | 1,243 | 920 | −447 | 5 / 0 / 2 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 47,642 | 35,684 | −8,625 | 5 / 0 / 2 |
| all | 47,642 | 35,684 | −8,625 | 5 / 0 / 2 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 9,359 | 7,119 | −2,980 | 6 / 0 / 1 |
| all | 9,359 | 7,119 | −2,980 | 6 / 0 / 1 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 58,106 | 43,863 | −12,164 | 5 / 0 / 2 |
| all | 58,106 | 43,863 | −12,164 | 5 / 0 / 2 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | $0.0032 | $0.0023 | −$0.0010 | 6 / 0 / 1 |
| all | $0.0032 | $0.0023 | −$0.0010 | 6 / 0 / 1 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 11.2 s | 9.3 s | −1.9 s | 6 / 0 / 1 |
| all | 11.2 s | 9.3 s | −1.9 s | 6 / 0 / 1 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | $0.0457 (14 runs) | $0.0351 (14 runs) | none | none |
| all | $0.0457 (14 runs) | $0.0351 (14 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| sigmap-src/h024 | without | 0/2 | 9 [5–12] | 13 [8–18] | 2,496 [1,605–3,386] | 100,581 [44,491–156,671] | 16,071 [10,698–21,444] | $0.0055 [$0.0034–$0.0076] | 18.5 s [13.4 s–23.6 s] |
| sigmap-src/h024 | with | 0/2 | 7 [5–8] | 11 [8–14] | 1,938 [1,707–2,168] | 91,957 [51,145–132,768] | 13,092 [8,952–17,231] | $0.0045 [$0.0032–$0.0059] | 15.9 s [13.2 s–18.5 s] |
| sigmap-src/h025 | without | 2/2 | 5 [5–5] | 8 [8–8] | 1,243 [1,236–1,249] | 40,482 [39,357–41,607] | 12,095 [9,789–14,401] | $0.0034 [$0.0030–$0.0039] | 11.2 s [11.0 s–11.5 s] |
| sigmap-src/h025 | with | 2/2 | 3 [2–3] | 6 [4–8] | 796 [744–848] | 35,307 [20,699–49,915] | 6,270 [5,999–6,541] | $0.0020 [$0.0018–$0.0022] | 9.4 s [8.7 s–10.0 s] |
| sigmap-src/h026 | without | 2/2 | 8 [5–10] | 10 [8–12] | 2,124 [1,536–2,711] | 54,144 [41,795–66,493] | 7,971 [7,082–8,859] | $0.0032 [$0.0026–$0.0038] | 15.0 s [11.6 s–18.4 s] |
| sigmap-src/h026 | with | 2/2 | 4 [3–5] | 7 [6–8] | 1,090 [1,009–1,170] | 42,880 [35,460–50,299] | 6,927 [6,334–7,519] | $0.0024 [$0.0021–$0.0026] | 10.5 s [9.8 s–11.2 s] |
| sigmap-src/h027 | without | 2/2 | 5 [4–6] | 9 [8–10] | 1,382 [1,110–1,654] | 47,642 [39,274–56,010] | 9,073 [6,982–11,163] | $0.0030 [$0.0023–$0.0036] | 12.8 s [10.7 s–15.0 s] |
| sigmap-src/h027 | with | 2/2 | 2 [1–2] | 4 [4–4] | 732 [527–937] | 21,014 [20,695–21,332] | 5,354 [5,178–5,530] | $0.0016 [$0.0015–$0.0018] | 7.7 s [7.2 s–8.1 s] |
| sigmap-src/h028 | without | 2/2 | 2 [2–2] | 6 [6–6] | 813 [790–835] | 27,379 [27,378–27,380] | 5,460 [5,423–5,496] | $0.0018 [$0.0018–$0.0018] | 8.9 s [8.5 s–9.2 s] |
| sigmap-src/h028 | with | 2/2 | 4 [3–5] | 6 [6–6] | 888 [828–948] | 35,684 [35,367–36,000] | 7,286 [7,279–7,292] | $0.0023 [$0.0022–$0.0023] | 9.3 s [9.2 s–9.4 s] |
| sigmap-src/h029 | without | 2/2 | 4 [2–6] | 8 [6–10] | 1,170 [924–1,416] | 48,505 [27,383–69,626] | 11,392 [7,371–15,412] | $0.0033 [$0.0022–$0.0045] | 10.6 s [8.8 s–12.4 s] |
| sigmap-src/h029 | with | 2/2 | 3 [2–4] | 5 [4–6] | 956 [886–1,026] | 29,129 [21,330–36,927] | 7,119 [5,279–8,958] | $0.0022 [$0.0017–$0.0027] | 8.9 s [8.5 s–9.4 s] |
| sigmap-src/h030 | without | 2/2 | 3 [2–4] | 7 [6–8] | 842 [772–911] | 35,409 [32,826–37,992] | 9,359 [8,440–10,277] | $0.0026 [$0.0025–$0.0028] | 9.3 s [8.4 s–10.2 s] |
| sigmap-src/h030 | with | 2/2 | 3 [2–4] | 6 [4–8] | 920 [726–1,113] | 36,431 [20,703–52,159] | 8,764 [8,488–9,039] | $0.0026 [$0.0024–$0.0028] | 9.1 s [7.9 s–10.3 s] |

