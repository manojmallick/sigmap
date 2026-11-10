# Agent-level A/B — measured tool calls, tokens and cost

**claude-code 2.1.322 (Claude Code) · claude-haiku-5-5 · 2026-11-10 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap as one on-demand skill (sigmap-locate) + the sigmap CLI: no MCP server, no always-on section.
- Both arms: the same prompt, model, tool allowlist (Read, Grep, Glob, Bash), per-run budget cap $0.5 and timeout 420 s; run in a clean copy of the commit pinned in `benchmarks/xrepo-repos.json`.
- Questions: the task id(s) x137, x138, x139, x140, x141, x142, x143, x144 of `benchmarks/tasks/retrieval-xrepo.jsonl`. Pass = hit@5 on the repository-relative paths the answer names.
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
- Skill variant: both arms run with skills enabled (the Skill tool, and the agent's own bundled skills listed in the prompt, about 2k tokens), which the earlier no-skill runs did not have, so these figures are against this run's own baseline and not comparable cell by cell with the index, lean or current runs. The SigMap arm adds only its skill file(s) and the sigmap CLI: no MCP server and no appended section.

## Outcome

| repo | tasks | pass without | pass with | failed runs (without / with) |
| --- | ---: | ---: | ---: | ---: |
| fastify | 8 | 16/16 | 16/16 | 0 / 0 |
| all | 8 | 16/16 | 16/16 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 8. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | +17% | −17% | mixed |
| Input tokens (uncached) | +8% | 0% | mixed |
| Output tokens | +14% | −8% | mixed |
| Cache-read tokens | +9% | +2% | more in every repetition |
| Cache-write tokens | −10% | −1% | fewer in every repetition |
| Total tokens (derived) | +5% | +1% | more in every repetition |
| Cost | −3% | −2% | fewer in every repetition |
| Wall time | +10% | −3% | mixed |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | +12% [−17%, +59%] † | −24% [−49%, +9%] † | mixed |
| Input tokens (uncached) | +7% [−16%, +36%] † | −2% [−23%, +22%] † | mixed |
| Output tokens | +15% [−3%, +34%] † | −9% [−20%, +2%] † | mixed |
| Cache-read tokens | +6% [−23%, +47%] † | −2% [−28%, +27%] † | mixed |
| Cache-write tokens | −9% [−24%, +5%] † | 0% [−9%, +9%] † | fewer in every repetition, within the noise |
| Total tokens (derived) | +4% [−23%, +38%] † | −2% [−22%, +20%] † | mixed |
| Cost | −2% [−19%, +15%] † | −2% [−8%, +4%] † | fewer in every repetition, within the noise |
| Wall time | +10% [−7%, +30%] † | −4% [−16%, +7%] † | mixed |

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
| fastify | 3 | 3 | −1 | 6 / 0 / 2 |
| all | 3 | 3 | −1 | 6 / 0 / 2 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | 6 | 6 | −1 | 4 / 1 / 3 |
| all | 6 | 6 | −1 | 4 / 1 / 3 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | 1,198 | 1,226 | +32 | 4 / 0 / 4 |
| all | 1,198 | 1,226 | +32 | 4 / 0 / 4 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | 36,622 | 37,604 | −2,974 | 4 / 0 / 4 |
| all | 36,622 | 37,604 | −2,974 | 4 / 0 / 4 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | 9,698 | 9,283 | −312 | 5 / 0 / 3 |
| all | 9,698 | 9,283 | −312 | 5 / 0 / 3 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | 48,446 | 49,367 | −2,169 | 5 / 0 / 3 |
| all | 48,446 | 49,367 | −2,169 | 5 / 0 / 3 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | $0.0029 | $0.0030 | +$0.0001 | 4 / 0 / 4 |
| all | $0.0029 | $0.0030 | +$0.0001 | 4 / 0 / 4 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | 12.0 s | 11.6 s | +363 ms | 3 / 0 / 5 |
| all | 12.0 s | 11.6 s | +363 ms | 3 / 0 / 5 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| fastify | $0.0483 (16 runs) | $0.0471 (16 runs) | none | none |
| all | $0.0483 (16 runs) | $0.0471 (16 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| fastify/x137 | without | 2/2 | 4 [3–4] | 6 [6–6] | 1,519 [1,433–1,604] | 38,628 [37,032–40,224] | 11,713 [9,974–13,452] | $0.0035 [$0.0031–$0.0039] | 13.0 s [11.8 s–14.2 s] |
| fastify/x137 | with | 2/2 | 3 [2–3] | 5 [4–6] | 1,248 [1,152–1,344] | 28,229 [20,861–35,597] | 8,121 [7,453–8,789] | $0.0025 [$0.0024–$0.0027] | 11.7 s [11.6 s–11.7 s] |
| fastify/x138 | without | 2/2 | 3 [2–4] | 6 [4–8] | 895 [711–1,079] | 35,488 [20,729–50,246] | 7,789 [7,308–8,269] | $0.0024 [$0.0020–$0.0027] | 10.4 s [8.1 s–12.7 s] |
| fastify/x138 | with | 2/2 | 2 [1–3] | 5 [4–6] | 781 [716–845] | 27,981 [20,829–35,132] | 8,189 [7,684–8,694] | $0.0023 [$0.0023–$0.0023] | 10.7 s [8.5 s–12.9 s] |
| fastify/x139 | without | 2/2 | 3 [3–3] | 6 [6–6] | 1,006 [970–1,041] | 36,486 [35,954–37,017] | 9,617 [8,806–10,427] | $0.0028 [$0.0026–$0.0029] | 11.8 s [11.8 s–11.9 s] |
| fastify/x139 | with | 2/2 | 2 [2–2] | 6 [6–6] | 958 [799–1,117] | 36,764 [36,430–37,098] | 9,334 [8,866–9,801] | $0.0027 [$0.0025–$0.0029] | 11.1 s [10.3 s–12.0 s] |
| fastify/x140 | without | 2/2 | 4 [3–5] | 8 [6–10] | 1,362 [979–1,745] | 51,888 [37,285–66,491] | 12,360 [12,008–12,711] | $0.0037 [$0.0034–$0.0039] | 14.2 s [12.1 s–16.2 s] |
| fastify/x140 | with | 2/2 | 4 [3–4] | 6 [6–6] | 1,204 [1,107–1,301] | 36,240 [34,964–37,515] | 10,101 [8,125–12,076] | $0.0030 [$0.0026–$0.0033] | 11.3 s [10.7 s–11.9 s] |
| fastify/x141 | without | 2/2 | 4 [4–4] | 6 [6–6] | 1,163 [1,064–1,262] | 35,252 [34,985–35,518] | 9,440 [9,302–9,577] | $0.0028 [$0.0028–$0.0028] | 11.8 s [10.8 s–12.8 s] |
| fastify/x141 | with | 2/2 | 5 [3–6] | 8 [6–10] | 1,423 [1,242–1,603] | 51,991 [35,488–68,493] | 9,099 [8,776–9,421] | $0.0031 [$0.0027–$0.0034] | 14.5 s [13.7 s–15.4 s] |
| fastify/x142 | without | 2/2 | 4 [3–5] | 7 [6–8] | 1,015 [831–1,199] | 44,670 [38,097–51,243] | 9,779 [8,922–10,635] | $0.0029 [$0.0029–$0.0029] | 11.1 s [11.0 s–11.2 s] |
| fastify/x142 | with | 2/2 | 4 [3–4] | 6 [6–6] | 1,127 [1,118–1,136] | 38,444 [38,363–38,525] | 11,607 [11,155–12,059] | $0.0033 [$0.0032–$0.0034] | 11.5 s [11.3 s–11.8 s] |
| fastify/x143 | without | 2/2 | 3 [2–3] | 6 [6–6] | 1,676 [1,310–2,042] | 36,758 [35,532–37,984] | 11,339 [9,676–13,002] | $0.0035 [$0.0029–$0.0040] | 14.2 s [12.9 s–15.6 s] |
| fastify/x143 | with | 2/2 | 6 [6–6] | 10 [10–10] | 1,991 [1,990–1,992] | 67,088 [64,826–69,349] | 10,396 [9,973–10,819] | $0.0037 [$0.0036–$0.0039] | 17.4 s [16.2 s–18.6 s] |
| fastify/x144 | without | 2/2 | 3 [2–4] | 6 [6–6] | 1,233 [952–1,514] | 34,905 [34,895–34,914] | 8,434 [8,120–8,748] | $0.0027 [$0.0026–$0.0027] | 12.2 s [11.0 s–13.4 s] |
| fastify/x144 | with | 2/2 | 3 [2–3] | 7 [6–8] | 1,368 [1,352–1,383] | 43,016 [34,908–51,124] | 9,233 [8,986–9,479] | $0.0030 [$0.0028–$0.0031] | 13.6 s [13.3 s–13.9 s] |

