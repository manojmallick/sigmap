# Agent-level A/B — measured tool calls, tokens and cost

**claude-code 2.1.322 (Claude Code) · claude-haiku-5-5 · 2026-11-11 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap index strategy + 7-tool core MCP profile (the docs' setup for an agent that calls the tools).
- Both arms: the same prompt, model, tool allowlist (Read, Grep, Glob, Bash), per-run budget cap $0.5 and timeout 420 s; run in a clean copy of the commit pinned in `benchmarks/xrepo-repos.json`.
- Questions: the task id(s) h016, h017, h018, h019, h020, h021, h022, h023 of `benchmarks/tasks/retrieval-xrepo.jsonl`. Pass = hit@5 on the repository-relative paths the answer names.
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
| sigmap-src | 8 | 16/16 | 16/16 | 0 / 0 |
| all | 8 | 16/16 | 16/16 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 8. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −52% | −65% | fewer in every repetition |
| Input tokens (uncached) | −39% | −54% | fewer in every repetition |
| Output tokens | −47% | −60% | fewer in every repetition |
| Cache-read tokens | −44% | −58% | fewer in every repetition |
| Cache-write tokens | −27% | −50% | fewer in every repetition |
| Total tokens (derived) | −41% | −57% | fewer in every repetition |
| Cost | −35% | −54% | fewer in every repetition |
| Wall time | −30% | −46% | fewer in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −59% [−77%, −25%] | −62% [−76%, −34%] | fewer in every repetition, outside the noise |
| Input tokens (uncached) | −42% [−58%, −19%] | −50% [−65%, −29%] | fewer in every repetition, outside the noise |
| Output tokens | −47% [−61%, −27%] | −55% [−67%, −41%] | fewer in every repetition, outside the noise |
| Cache-read tokens | −47% [−67%, −15%] | −51% [−69%, −20%] | fewer in every repetition, outside the noise |
| Cache-write tokens | −29% [−48%, −2%] | −44% [−60%, −24%] | fewer in every repetition, outside the noise |
| Total tokens (derived) | −42% [−62%, −13%] | −50% [−68%, −21%] | fewer in every repetition, outside the noise |
| Cost | −35% [−53%, −10%] | −48% [−63%, −27%] | fewer in every repetition, outside the noise |
| Wall time | −31% [−45%, −13%] | −42% [−56%, −27%] | fewer in every repetition, outside the noise |

### Outcome (hit@5), by repetition

Per paired task: **better** = the SigMap arm named the file and the other did not; **worse** = the reverse; **tie** = both found it or both missed. Localisation only.

| repetition | paired tasks | better | worse | tie |
| --- | ---: | ---: | ---: | ---: |
| R1 | 8 | 0 | 0 | 8 |
| R2 | 8 | 0 | 0 | 8 |
| all | 16 | 0 | 0 | 16 |

## Tool calls

Provenance: agent-reported (main-thread tool_use blocks). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 6 | 2 | −4 | 7 / 0 / 1 |
| all | 6 | 2 | −4 | 7 / 0 / 1 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 10 | 6 | −5 | 7 / 0 / 1 |
| all | 10 | 6 | −5 | 7 / 0 / 1 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 1,724 | 900 | −911 | 7 / 0 / 1 |
| all | 1,724 | 900 | −911 | 7 / 0 / 1 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 59,423 | 35,622 | −28,829 | 7 / 0 / 1 |
| all | 59,423 | 35,622 | −28,829 | 7 / 0 / 1 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 10,718 | 6,583 | −4,820 | 6 / 0 / 2 |
| all | 10,718 | 6,583 | −4,820 | 6 / 0 / 2 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 70,925 | 42,795 | −34,540 | 7 / 0 / 1 |
| all | 70,925 | 42,795 | −34,540 | 7 / 0 / 1 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | $0.0035 | $0.0022 | −$0.0017 | 7 / 0 / 1 |
| all | $0.0035 | $0.0022 | −$0.0017 | 7 / 0 / 1 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 14.0 s | 9.4 s | −4.9 s | 7 / 0 / 1 |
| all | 14.0 s | 9.4 s | −4.9 s | 7 / 0 / 1 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | $0.0621 (16 runs) | $0.0340 (16 runs) | none | none |
| all | $0.0621 (16 runs) | $0.0340 (16 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| sigmap-src/h016 | without | 2/2 | 4 [4–4] | 8 [8–8] | 1,591 [1,511–1,670] | 42,526 [41,983–43,069] | 10,071 [9,445–10,697] | $0.0032 [$0.0031–$0.0033] | 13.2 s [13.2 s–13.3 s] |
| sigmap-src/h016 | with | 2/2 | 2 [2–2] | 4 [4–4] | 896 [790–1,002] | 16,840 [12,208–21,472] | 10,163 [5,708–14,618] | $0.0026 [$0.0018–$0.0035] | 10.0 s [8.5 s–11.5 s] |
| sigmap-src/h017 | without | 2/2 | 5 [4–6] | 10 [8–12] | 1,681 [1,491–1,870] | 57,668 [45,900–69,435] | 9,265 [9,220–9,309] | $0.0033 [$0.0030–$0.0035] | 14.5 s [12.6 s–16.4 s] |
| sigmap-src/h017 | with | 2/2 | 3 [2–3] | 7 [6–8] | 1,011 [898–1,124] | 43,148 [35,716–50,579] | 6,628 [5,576–7,680] | $0.0023 [$0.0019–$0.0026] | 11.6 s [9.8 s–13.3 s] |
| sigmap-src/h018 | without | 2/2 | 6 [4–7] | 9 [8–10] | 1,840 [1,697–1,983] | 53,127 [41,233–65,021] | 10,822 [8,891–12,752] | $0.0036 [$0.0030–$0.0042] | 13.9 s [13.1 s–14.7 s] |
| sigmap-src/h018 | with | 2/2 | 1 [1–1] | 4 [4–4] | 785 [721–848] | 21,155 [20,836–21,474] | 5,258 [4,943–5,572] | $0.0017 [$0.0016–$0.0017] | 8.9 s [8.3 s–9.4 s] |
| sigmap-src/h019 | without | 2/2 | 6 [5–6] | 10 [8–12] | 1,425 [1,390–1,459] | 61,179 [48,604–73,754] | 10,614 [10,482–10,745] | $0.0034 [$0.0033–$0.0036] | 13.0 s [11.8 s–14.2 s] |
| sigmap-src/h019 | with | 2/2 | 2 [2–2] | 6 [6–6] | 658 [632–684] | 35,543 [35,195–35,891] | 6,537 [6,354–6,720] | $0.0020 [$0.0020–$0.0020] | 8.2 s [7.8 s–8.6 s] |
| sigmap-src/h020 | without | 2/2 | 14 [7–20] | 20 [10–30] | 3,404 [1,795–5,012] | 152,223 [55,293–249,152] | 19,843 [9,636–30,050] | $0.0072 [$0.0034–$0.0110] | 25.3 s [14.3 s–36.3 s] |
| sigmap-src/h020 | with | 2/2 | 4 [4–4] | 6 [6–6] | 905 [793–1,016] | 35,757 [35,599–35,915] | 7,674 [6,601–8,746] | $0.0023 [$0.0022–$0.0025] | 8.8 s [8.3 s–9.3 s] |
| sigmap-src/h021 | without | 2/2 | 8 [7–8] | 13 [12–14] | 2,332 [2,289–2,375] | 85,403 [84,588–86,217] | 12,303 [10,246–14,359] | $0.0045 [$0.0040–$0.0049] | 19.1 s [19.0 s–19.2 s] |
| sigmap-src/h021 | with | 2/2 | 3 [1–4] | 6 [4–8] | 996 [913–1,079] | 35,700 [20,829–50,571] | 6,144 [5,447–6,841] | $0.0021 [$0.0018–$0.0024] | 10.0 s [9.1 s–10.9 s] |
| sigmap-src/h022 | without | 2/2 | 3 [2–3] | 7 [6–8] | 953 [753–1,152] | 33,454 [27,842–39,065] | 5,748 [5,501–5,995] | $0.0020 [$0.0018–$0.0022] | 10.3 s [8.8 s–11.8 s] |
| sigmap-src/h022 | with | 2/2 | 5 [4–6] | 9 [8–10] | 1,067 [719–1,415] | 56,919 [51,520–62,317] | 7,029 [6,738–7,320] | $0.0025 [$0.0022–$0.0028] | 10.6 s [8.9 s–12.3 s] |
| sigmap-src/h023 | without | 2/2 | 6 [4–8] | 11 [8–14] | 1,767 [1,212–2,321] | 69,471 [40,557–98,384] | 11,354 [7,342–15,365] | $0.0038 [$0.0025–$0.0052] | 14.1 s [10.9 s–17.4 s] |
| sigmap-src/h023 | with | 2/2 | 1 [1–1] | 4 [4–4] | 559 [540–578] | 21,146 [20,821–21,470] | 5,092 [4,827–5,356] | $0.0015 [$0.0015–$0.0016] | 7.2 s [7.2 s–7.3 s] |

