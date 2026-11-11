# Agent-level A/B — measured tool calls, tokens and cost

**claude-code 2.1.322 (Claude Code) · claude-haiku-5-5 · 2026-11-11 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap ranked the question BEFORE the first turn (what a prompt hook would inject): the five likeliest files with their signatures and line anchors after the question in the user turn, + the sigmap CLI; no MCP server, no standing section, no extra tool call.
- Both arms: the same prompt, model, tool allowlist (Read, Grep, Glob, Bash), per-run budget cap $0.5 and timeout 420 s; run in a clean copy of the commit pinned in `benchmarks/xrepo-repos.json`.
- Questions: the task id(s) x084, x085, x086, x087, x088 of `benchmarks/tasks/retrieval-xrepo.jsonl`. Pass = hit@5 on the repository-relative paths the answer names.
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
| rails | 5 | 10/10 | 10/10 | 0 / 0 |
| all | 5 | 10/10 | 10/10 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 5. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −65% | −22% | fewer in every repetition |
| Input tokens (uncached) | −52% | −13% | fewer in every repetition |
| Output tokens | −41% | −19% | fewer in every repetition |
| Cache-read tokens | −63% | −2% | fewer in every repetition |
| Cache-write tokens | −9% | −32% | fewer in every repetition |
| Total tokens (derived) | −54% | −7% | fewer in every repetition |
| Cost | −25% | −24% | fewer in every repetition |
| Wall time | −31% | −4% | fewer in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −56% [−81%, 0%] † n=4 | −16% [−40%, 0%] † | fewer in every repetition, within the noise |
| Input tokens (uncached) | −51% [−68%, −26%] | −15% [−28%, 0%] † | fewer in every repetition, within the noise |
| Output tokens | −27% [−61%, +14%] † | −15% [−37%, +10%] † | fewer in every repetition, within the noise |
| Cache-read tokens | −61% [−79%, −27%] | −6% [−22%, +13%] † | fewer in every repetition, within the noise |
| Cache-write tokens | −5% [−30%, +19%] † | −31% [−45%, −15%] | fewer in every repetition, within the noise |
| Total tokens (derived) | −49% [−71%, −18%] | −11% [−23%, +4%] † | fewer in every repetition, within the noise |
| Cost | −17% [−45%, +7%] † | −24% [−31%, −16%] | fewer in every repetition, within the noise |
| Wall time | −24% [−51%, −2%] | −2% [−11%, +13%] † | fewer in every repetition, within the noise |

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
| rails | 4 | 2 | −1 | 4 / 0 / 1 |
| all | 4 | 2 | −1 | 4 / 0 / 1 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | 7 | 4 | −2 | 4 / 1 / 0 |
| all | 7 | 4 | −2 | 4 / 1 / 0 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | 1,261 | 881 | −23 | 3 / 0 / 2 |
| all | 1,261 | 881 | −23 | 3 / 0 / 2 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | 41,606 | 23,656 | −10,628 | 4 / 0 / 1 |
| all | 41,606 | 23,656 | −10,628 | 4 / 0 / 1 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | 8,675 | 7,871 | −1,503 | 3 / 0 / 2 |
| all | 8,675 | 7,871 | −1,503 | 3 / 0 / 2 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | 52,149 | 32,599 | −10,241 | 4 / 0 / 1 |
| all | 52,149 | 32,599 | −10,241 | 4 / 0 / 1 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | $0.0029 | $0.0023 | −$0.0003 | 5 / 0 / 0 |
| all | $0.0029 | $0.0023 | −$0.0003 | 5 / 0 / 0 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | 11.8 s | 9.1 s | −487 ms | 4 / 0 / 1 |
| all | 11.8 s | 9.1 s | −487 ms | 4 / 0 / 1 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| rails | $0.0311 (10 runs) | $0.0235 (10 runs) | none | none |
| all | $0.0311 (10 runs) | $0.0235 (10 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| rails/x084 | without | 2/2 | 3 [2–3] | 6 [6–6] | 786 [730–841] | 34,219 [32,258–36,180] | 7,577 [5,586–9,567] | $0.0023 [$0.0019–$0.0026] | 9.3 s [9.3 s–9.3 s] |
| rails/x084 | with | 2/2 | 2 [2–2] | 4 [4–4] | 881 [832–929] | 23,591 [20,884–26,298] | 7,871 [5,241–10,501] | $0.0023 [$0.0017–$0.0028] | 8.8 s [8.5 s–9.1 s] |
| rails/x085 | without | 2/2 | 4 [2–5] | 7 [6–8] | 1,261 [1,020–1,502] | 41,606 [33,788–49,424] | 9,275 [8,937–9,613] | $0.0029 [$0.0028–$0.0030] | 11.8 s [10.1 s–13.5 s] |
| rails/x085 | with | 2/2 | 4 [3–5] | 7 [6–8] | 1,239 [1,131–1,346] | 46,177 [36,104–56,250] | 7,772 [5,605–9,939] | $0.0026 [$0.0024–$0.0029] | 11.4 s [10.6 s–12.1 s] |
| rails/x086 | without | 2/2 | 2 [2–2] | 5 [4–6] | 813 [784–841] | 27,349 [22,548–32,149] | 8,675 [7,762–9,588] | $0.0024 [$0.0023–$0.0025] | 8.0 s [7.2 s–8.8 s] |
| rails/x086 | with | 2/2 | 1 [0–2] | 3 [2–4] | 869 [703–1,034] | 15,797 [6,281–25,312] | 6,115 [4,404–7,825] | $0.0018 [$0.0017–$0.0020] | 8.3 s [7.5 s–9.2 s] |
| rails/x087 | without | 2/2 | 7 [2–11] | 11 [6–16] | 2,637 [1,206–4,068] | 89,126 [37,687–140,565] | 14,089 [7,666–20,512] | $0.0050 [$0.0025–$0.0075] | 18.7 s [10.4 s–27.1 s] |
| rails/x087 | with | 2/2 | 2 [2–2] | 4 [4–4] | 872 [859–884] | 23,656 [20,927–26,384] | 8,068 [5,310–10,825] | $0.0023 [$0.0018–$0.0028] | 9.1 s [8.8 s–9.4 s] |
| rails/x088 | without | 2/2 | 6 [5–7] | 8 [8–8] | 1,557 [1,258–1,856] | 49,555 [47,453–51,657] | 8,384 [7,150–9,617] | $0.0030 [$0.0029–$0.0030] | 12.5 s [11.8 s–13.2 s] |
| rails/x088 | with | 2/2 | 2 [1–3] | 6 [4–8] | 1,006 [969–1,042] | 39,570 [20,518–58,622] | 9,330 [6,060–12,600] | $0.0028 [$0.0023–$0.0032] | 11.3 s [11.0 s–11.6 s] |

