# Agent-level A/B — measured tool calls, tokens and cost

**claude-code 2.1.321 (Claude Code) · claude-haiku-5-5 · 2026-11-09 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap lean: 7-tool core MCP profile + a three-line section.
- Both arms: the same prompt, model, tool allowlist (Read, Grep, Glob, Bash), per-run budget cap $0.5 and timeout 420 s; run in a clean copy of the commit pinned in `benchmarks/xrepo-repos.json`.
- Questions: the task id(s) x145, x146, x147, x148, x149, x150, x151, x152 of `benchmarks/tasks/retrieval-xrepo.jsonl`. Pass = hit@5 on the repository-relative paths the answer names.
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
| fastapi | 8 | 16/16 | 16/16 | 0 / 0 |
| all | 8 | 16/16 | 16/16 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 8. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | +55% | +35% | more in every repetition |
| Input tokens (uncached) | +15% | +20% | more in every repetition |
| Output tokens | +27% | +18% | more in every repetition |
| Cache-read tokens | +38% | +46% | more in every repetition |
| Cache-write tokens | +12% | +23% | more in every repetition |
| Total tokens (derived) | +33% | +42% | more in every repetition |
| Cost | +18% | +25% | more in every repetition |
| Wall time | +21% | +12% | more in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | +60% [+30%, +90%] | +37% [+7%, +75%] | more in every repetition, outside the noise |
| Input tokens (uncached) | +14% [+4%, +25%] | +20% [+4%, +43%] | more in every repetition, outside the noise |
| Output tokens | +25% [+5%, +54%] | +14% [−2%, +33%] † | more in every repetition, within the noise |
| Cache-read tokens | +37% [+26%, +50%] | +49% [+24%, +86%] | more in every repetition, outside the noise |
| Cache-write tokens | +15% [−1%, +29%] † | +25% [+2%, +51%] | more in every repetition, within the noise |
| Total tokens (derived) | +33% [+25%, +42%] | +45% [+22%, +76%] | more in every repetition, outside the noise |
| Cost | +20% [+12%, +29%] | +27% [+10%, +44%] | more in every repetition, outside the noise |
| Wall time | +21% [+10%, +35%] | +12% [+4%, +20%] | more in every repetition, outside the noise |

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
| fastapi | 3 | 4 | +2 | 0 / 2 / 6 |
| all | 3 | 4 | +2 | 0 / 2 / 6 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | 6 | 8 | +1 | 0 / 3 / 5 |
| all | 6 | 8 | +1 | 0 / 3 / 5 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | 997 | 1,225 | +219 | 3 / 0 / 5 |
| all | 997 | 1,225 | +219 | 3 / 0 / 5 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | 27,893 | 44,739 | +13,578 | 0 / 0 / 8 |
| all | 27,893 | 44,739 | +13,578 | 0 / 0 / 8 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | 6,357 | 8,238 | +1,606 | 2 / 0 / 6 |
| all | 6,357 | 8,238 | +1,606 | 2 / 0 / 6 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | 35,222 | 53,948 | +12,846 | 0 / 0 / 8 |
| all | 35,222 | 53,948 | +12,846 | 0 / 0 / 8 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | $0.0021 | $0.0028 | +$0.0005 | 1 / 0 / 7 |
| all | $0.0021 | $0.0028 | +$0.0005 | 1 / 0 / 7 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | 11.6 s | 13.4 s | +1.8 s | 0 / 0 / 8 |
| all | 11.6 s | 13.4 s | +1.8 s | 0 / 0 / 8 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| fastapi | $0.0360 (16 runs) | $0.0438 (16 runs) | none | none |
| all | $0.0360 (16 runs) | $0.0438 (16 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| fastapi/x145 | without | 2/2 | 4 [3–4] | 8 [8–8] | 1,108 [1,057–1,159] | 44,442 [43,843–45,040] | 9,904 [9,621–10,186] | $0.0030 [$0.0029–$0.0031] | 13.3 s [12.8 s–13.8 s] |
| fastapi/x145 | with | 2/2 | 4 [3–4] | 9 [8–10] | 1,021 [1,002–1,039] | 56,238 [47,646–64,830] | 9,465 [8,451–10,479] | $0.0030 [$0.0027–$0.0032] | 13.8 s [13.6 s–14.0 s] |
| fastapi/x146 | without | 2/2 | 3 [3–3] | 8 [8–8] | 916 [860–972] | 46,103 [42,347–49,858] | 10,060 [7,716–12,404] | $0.0029 [$0.0025–$0.0034] | 12.1 s [11.8 s–12.4 s] |
| fastapi/x146 | with | 2/2 | 5 [4–6] | 10 [10–10] | 1,719 [1,522–1,916] | 62,002 [60,020–63,984] | 7,775 [5,960–9,590] | $0.0030 [$0.0026–$0.0035] | 17.0 s [15.9 s–18.2 s] |
| fastapi/x147 | without | 2/2 | 3 [2–4] | 6 [6–6] | 1,088 [1,054–1,122] | 27,487 [27,069–27,905] | 5,488 [4,934–6,041] | $0.0019 [$0.0018–$0.0020] | 11.7 s [11.6 s–11.7 s] |
| fastapi/x147 | with | 2/2 | 5 [4–5] | 8 [8–8] | 1,278 [1,010–1,545] | 46,118 [46,107–46,128] | 7,216 [6,730–7,702] | $0.0025 [$0.0023–$0.0028] | 13.0 s [12.4 s–13.6 s] |
| fastapi/x148 | without | 2/2 | 3 [2–4] | 6 [6–6] | 924 [688–1,159] | 28,001 [27,959–28,043] | 5,752 [5,360–6,144] | $0.0019 [$0.0019–$0.0019] | 10.4 s [9.2 s–11.6 s] |
| fastapi/x148 | with | 2/2 | 5 [4–6] | 7 [6–8] | 1,173 [1,072–1,273] | 43,361 [34,816–51,906] | 8,737 [8,381–9,092] | $0.0028 [$0.0026–$0.0030] | 12.6 s [12.5 s–12.7 s] |
| fastapi/x149 | without | 2/2 | 2 [2–2] | 5 [4–6] | 840 [804–876] | 22,854 [16,822–28,886] | 6,478 [4,654–8,301] | $0.0019 [$0.0015–$0.0024] | 9.5 s [9.3 s–9.7 s] |
| fastapi/x149 | with | 2/2 | 4 [4–4] | 8 [8–8] | 829 [778–879] | 47,104 [46,652–47,556] | 7,394 [6,660–8,128] | $0.0024 [$0.0022–$0.0025] | 12.9 s [12.2 s–13.6 s] |
| fastapi/x150 | without | 2/2 | 3 [2–4] | 6 [6–6] | 880 [854–906] | 27,659 [27,467–27,851] | 6,647 [6,006–7,287] | $0.0020 [$0.0019–$0.0022] | 9.5 s [9.3 s–9.7 s] |
| fastapi/x150 | with | 2/2 | 5 [4–5] | 6 [6–6] | 863 [786–939] | 34,399 [34,014–34,783] | 8,701 [8,153–9,248] | $0.0025 [$0.0024–$0.0027] | 9.7 s [8.9 s–10.5 s] |
| fastapi/x151 | without | 2/2 | 3 [2–3] | 6 [6–6] | 1,070 [902–1,238] | 27,957 [27,364–28,549] | 6,221 [6,141–6,300] | $0.0021 [$0.0020–$0.0021] | 11.6 s [11.5 s–11.7 s] |
| fastapi/x151 | with | 2/2 | 4 [4–4] | 6 [6–6] | 1,423 [1,224–1,622] | 34,643 [33,157–36,129] | 9,403 [8,720–10,085] | $0.0029 [$0.0027–$0.0032] | 13.9 s [13.8 s–14.0 s] |
| fastapi/x152 | without | 2/2 | 4 [4–4] | 6 [6–6] | 1,408 [1,348–1,468] | 27,829 [27,325–28,332] | 6,237 [6,017–6,456] | $0.0022 [$0.0022–$0.0022] | 14.2 s [13.4 s–15.0 s] |
| fastapi/x152 | with | 2/2 | 4 [4–4] | 6 [6–6] | 1,732 [1,639–1,824] | 34,215 [33,906–34,523] | 7,719 [6,705–8,733] | $0.0028 [$0.0026–$0.0029] | 14.5 s [14.4 s–14.7 s] |

