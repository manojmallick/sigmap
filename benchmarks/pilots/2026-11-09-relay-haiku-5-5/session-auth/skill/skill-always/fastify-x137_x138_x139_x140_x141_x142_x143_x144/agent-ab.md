# Agent-level A/B — measured tool calls, tokens and cost

**claude-code 2.1.322 (Claude Code) · claude-haiku-5-5 · 2026-11-10 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap as one skill (sigmap-locate) whose description tells the agent to call it first on every where-is-it question, + the sigmap CLI: no MCP server, no always-on section.
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
| Tool calls | +25% | +92% | more in every repetition |
| Input tokens (uncached) | +35% | +72% | more in every repetition |
| Output tokens | +21% | +52% | more in every repetition |
| Cache-read tokens | +36% | +85% | more in every repetition |
| Cache-write tokens | +4% | +11% | more in every repetition |
| Total tokens (derived) | +31% | +70% | more in every repetition |
| Cost | +13% | +29% | more in every repetition |
| Wall time | +21% | +41% | more in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | +29% [−1%, +58%] † | +109% [+48%, +205%] | more in every repetition, within the noise |
| Input tokens (uncached) | +41% [+13%, +68%] | +75% [+53%, +100%] | more in every repetition, outside the noise |
| Output tokens | +22% [+5%, +41%] | +53% [+33%, +77%] | more in every repetition, outside the noise |
| Cache-read tokens | +45% [+11%, +80%] | +90% [+58%, +129%] | more in every repetition, outside the noise |
| Cache-write tokens | +4% [−5%, +15%] † | +11% [+4%, +21%] | more in every repetition, within the noise |
| Total tokens (derived) | +37% [+9%, +64%] | +73% [+49%, +100%] | more in every repetition, outside the noise |
| Cost | +14% [+3%, +24%] | +30% [+20%, +40%] | more in every repetition, outside the noise |
| Wall time | +23% [+11%, +34%] | +41% [+35%, +48%] | more in every repetition, outside the noise |

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
| fastify | 3 | 5 | +2 | 1 / 0 / 7 |
| all | 3 | 5 | +2 | 1 / 0 / 7 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | 7 | 10 | +4 | 1 / 0 / 7 |
| all | 7 | 10 | +4 | 1 / 0 / 7 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | 1,178 | 1,754 | +509 | 1 / 0 / 7 |
| all | 1,178 | 1,754 | +509 | 1 / 0 / 7 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | 43,111 | 65,335 | +29,671 | 1 / 0 / 7 |
| all | 43,111 | 65,335 | +29,671 | 1 / 0 / 7 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | 9,266 | 10,258 | +459 | 3 / 0 / 5 |
| all | 9,266 | 10,258 | +459 | 3 / 0 / 5 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | 53,704 | 78,492 | +31,972 | 1 / 0 / 7 |
| all | 53,704 | 78,492 | +31,972 | 1 / 0 / 7 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | $0.0029 | $0.0037 | +$0.0007 | 1 / 0 / 7 |
| all | $0.0029 | $0.0037 | +$0.0007 | 1 / 0 / 7 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | 12.7 s | 16.9 s | +4.4 s | 0 / 0 / 8 |
| all | 12.7 s | 16.9 s | +4.4 s | 0 / 0 / 8 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| fastify | $0.0475 (16 runs) | $0.0572 (16 runs) | none | none |
| all | $0.0475 (16 runs) | $0.0572 (16 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| fastify/x137 | without | 2/2 | 4 [4–4] | 7 [6–8] | 1,358 [1,354–1,362] | 42,962 [35,744–50,180] | 9,165 [8,998–9,332] | $0.0029 [$0.0029–$0.0030] | 13.9 s [13.3 s–14.5 s] |
| fastify/x137 | with | 2/2 | 6 [5–6] | 11 [10–12] | 1,774 [1,662–1,886] | 72,593 [64,857–80,328] | 10,559 [10,399–10,718] | $0.0037 [$0.0036–$0.0039] | 18.0 s [16.7 s–19.4 s] |
| fastify/x138 | without | 2/2 | 3 [1–4] | 5 [4–6] | 1,090 [979–1,201] | 27,897 [20,727–35,067] | 8,650 [8,569–8,730] | $0.0026 [$0.0024–$0.0027] | 10.6 s [9.7 s–11.5 s] |
| fastify/x138 | with | 2/2 | 5 [5–5] | 10 [10–10] | 1,196 [1,180–1,212] | 63,735 [63,667–63,803] | 8,527 [8,432–8,621] | $0.0029 [$0.0029–$0.0030] | 14.0 s [13.9 s–14.1 s] |
| fastify/x139 | without | 2/2 | 3 [2–3] | 6 [6–6] | 1,081 [860–1,302] | 36,252 [35,531–36,973] | 9,244 [8,382–10,106] | $0.0028 [$0.0025–$0.0030] | 12.6 s [12.1 s–13.1 s] |
| fastify/x139 | with | 2/2 | 7 [6–7] | 12 [12–12] | 1,615 [1,390–1,839] | 79,353 [78,830–79,875] | 9,542 [9,212–9,872] | $0.0035 [$0.0033–$0.0037] | 17.2 s [15.4 s–19.0 s] |
| fastify/x140 | without | 2/2 | 6 [5–7] | 11 [8–14] | 1,822 [1,447–2,196] | 79,475 [55,434–103,515] | 11,864 [11,692–12,036] | $0.0041 [$0.0036–$0.0045] | 17.5 s [14.4 s–20.5 s] |
| fastify/x140 | with | 2/2 | 5 [4–6] | 10 [10–10] | 1,775 [1,684–1,866] | 64,918 [63,698–66,138] | 11,702 [11,401–12,003] | $0.0039 [$0.0039–$0.0039] | 18.3 s [18.3 s–18.4 s] |
| fastify/x141 | without | 2/2 | 4 [4–4] | 7 [6–8] | 1,200 [1,164–1,235] | 43,421 [35,301–51,541] | 9,288 [9,268–9,308] | $0.0029 [$0.0028–$0.0030] | 12.8 s [11.9 s–13.6 s] |
| fastify/x141 | with | 2/2 | 5 [5–5] | 10 [10–10] | 1,799 [1,709–1,888] | 65,753 [64,783–66,722] | 11,018 [9,815–12,221] | $0.0038 [$0.0036–$0.0040] | 16.5 s [16.1 s–16.8 s] |
| fastify/x142 | without | 2/2 | 3 [3–3] | 6 [6–6] | 850 [802–897] | 35,095 [34,934–35,255] | 7,778 [7,705–7,850] | $0.0023 [$0.0023–$0.0023] | 10.1 s [10.1 s–10.2 s] |
| fastify/x142 | with | 2/2 | 6 [5–6] | 10 [10–10] | 1,333 [1,220–1,446] | 64,806 [63,657–65,955] | 10,078 [9,170–10,986] | $0.0033 [$0.0031–$0.0036] | 14.8 s [14.3 s–15.4 s] |
| fastify/x143 | without | 2/2 | 3 [2–4] | 7 [6–8] | 1,341 [1,174–1,507] | 44,458 [35,582–53,334] | 10,525 [9,981–11,069] | $0.0032 [$0.0029–$0.0035] | 14.0 s [13.7 s–14.4 s] |
| fastify/x143 | with | 2/2 | 7 [6–7] | 12 [12–12] | 2,132 [2,119–2,144] | 78,717 [78,577–78,856] | 10,140 [9,727–10,553] | $0.0039 [$0.0038–$0.0040] | 19.6 s [19.5 s–19.6 s] |
| fastify/x144 | without | 2/2 | 3 [3–3] | 7 [6–8] | 1,157 [1,063–1,251] | 43,260 [35,895–50,624] | 9,757 [9,556–9,958] | $0.0030 [$0.0029–$0.0030] | 12.0 s [12.0 s–12.0 s] |
| fastify/x144 | with | 2/2 | 4 [4–4] | 10 [10–10] | 1,733 [1,633–1,833] | 64,079 [63,807–64,351] | 10,377 [10,136–10,617] | $0.0036 [$0.0036–$0.0036] | 16.6 s [16.2 s–17.1 s] |

