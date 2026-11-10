# Agent-level A/B — measured tool calls, tokens and cost

**claude-code 2.1.322 (Claude Code) · claude-haiku-4-5 · 2026-11-10 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap index strategy + 7-tool core MCP profile (the docs' setup for an agent that calls the tools).
- Both arms: the same prompt, model, tool allowlist (Read, Grep, Glob, Bash), per-run budget cap $1 and timeout 420 s; run in a clean copy of the commit pinned in `benchmarks/xrepo-repos.json`.
- Questions: the task id(s) x139, x140, x141, x142, x143, x144 of `benchmarks/tasks/retrieval-xrepo.jsonl`. Pass = hit@5 on the repository-relative paths the answer names.
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
| fastify | 6 | 12/12 | 12/12 | 0 / 0 |
| all | 6 | 12/12 | 12/12 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 6. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −23% | −42% | fewer in every repetition |
| Input tokens (uncached) | −23% | −39% | fewer in every repetition |
| Output tokens | −12% | −39% | fewer in every repetition |
| Cache-read tokens | −28% | −53% | fewer in every repetition |
| Cache-write tokens | −23% | −40% | fewer in every repetition |
| Total tokens (derived) | −28% | −52% | fewer in every repetition |
| Cost | −23% | −44% | fewer in every repetition |
| Wall time | −12% | −34% | fewer in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −26% [−49%, +7%] † | −43% [−64%, −12%] | fewer in every repetition, within the noise |
| Input tokens (uncached) | −26% [−46%, +4%] † | −40% [−60%, −12%] | fewer in every repetition, within the noise |
| Output tokens | −18% [−46%, +31%] † | −38% [−51%, −24%] | fewer in every repetition, within the noise |
| Cache-read tokens | −32% [−53%, +2%] † | −54% [−73%, −25%] | fewer in every repetition, within the noise |
| Cache-write tokens | −27% [−43%, −6%] | −42% [−53%, −29%] | fewer in every repetition, outside the noise |
| Total tokens (derived) | −32% [−52%, +1%] † | −54% [−72%, −26%] | fewer in every repetition, within the noise |
| Cost | −27% [−45%, +1%] † | −47% [−61%, −29%] | fewer in every repetition, within the noise |
| Wall time | −17% [−41%, +29%] † | −34% [−45%, −23%] | fewer in every repetition, within the noise |

### Outcome (hit@5), by repetition

Per paired task: **better** = the SigMap arm named the file and the other did not; **worse** = the reverse; **tie** = both found it or both missed. Localisation only.

| repetition | paired tasks | better | worse | tie |
| --- | ---: | ---: | ---: | ---: |
| R1 | 6 | 0 | 0 | 6 |
| R2 | 6 | 0 | 0 | 6 |
| all | 12 | 0 | 0 | 12 |

## Tool calls

Provenance: agent-reported (main-thread tool_use blocks). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | 18 | 14 | −4 | 6 / 0 / 0 |
| all | 18 | 14 | −4 | 6 / 0 / 0 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | 152 | 118 | −34 | 6 / 0 / 0 |
| all | 152 | 118 | −34 | 6 / 0 / 0 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | 4,467 | 3,527 | −1,145 | 5 / 0 / 1 |
| all | 4,467 | 3,527 | −1,145 | 5 / 0 / 1 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | 487,674 | 297,191 | −147,105 | 6 / 0 / 0 |
| all | 487,674 | 297,191 | −147,105 | 6 / 0 / 0 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | 26,742 | 19,665 | −9,794 | 6 / 0 / 0 |
| all | 26,742 | 19,665 | −9,794 | 6 / 0 / 0 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | 517,742 | 320,831 | −156,010 | 6 / 0 / 0 |
| all | 517,742 | 320,831 | −156,010 | 6 / 0 / 0 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | $0.1212 | $0.0852 | −$0.0361 | 6 / 0 / 0 |
| all | $0.1212 | $0.0852 | −$0.0361 | 6 / 0 / 0 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | 53.7 s | 42.3 s | −12.1 s | 5 / 0 / 1 |
| all | 53.7 s | 42.3 s | −12.1 s | 5 / 0 / 1 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| fastify | $1.55 (12 runs) | $1.02 (12 runs) | none | none |
| all | $1.55 (12 runs) | $1.02 (12 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| fastify/x139 | without | 2/2 | 17 [14–20] | 146 [122–170] | 3,760 [3,060–4,459] | 443,321 [330,259–556,383] | 27,441 [24,392–30,489] | $0.1182 [$0.0972–$0.1391] | 44.7 s [36.6 s–52.8 s] |
| fastify/x139 | with | 2/2 | 14 [6–21] | 118 [58–178] | 4,517 [2,125–6,908] | 334,784 [125,704–543,864] | 20,265 [12,451–28,079] | $0.0967 [$0.0482–$0.1453] | 51.3 s [26.7 s–76.0 s] |
| fastify/x140 | without | 2/2 | 20 [13–27] | 158 [114–202] | 4,371 [2,796–5,945] | 632,848 [543,212–722,483] | 41,640 [31,589–51,691] | $0.1686 [$0.1654–$0.1718] | 53.4 s [39.5 s–67.2 s] |
| fastify/x140 | with | 2/2 | 14 [11–17] | 118 [98–138] | 3,165 [2,434–3,895] | 318,691 [244,000–393,381] | 26,664 [22,930–30,397] | $0.1011 [$0.0975–$0.1048] | 38.2 s [30.4 s–45.9 s] |
| fastify/x141 | without | 2/2 | 19 [17–21] | 162 [146–178] | 5,014 [4,712–5,315] | 587,866 [520,780–654,951] | 33,611 [31,946–35,276] | $0.1512 [$0.1427–$0.1598] | 59.4 s [58.8 s–60.0 s] |
| fastify/x141 | with | 2/2 | 16 [14–17] | 122 [122–122] | 3,930 [3,901–3,958] | 407,420 [373,134–441,705] | 31,000 [27,690–34,310] | $0.1225 [$0.1126–$0.1324] | 46.5 s [43.6 s–49.3 s] |
| fastify/x142 | without | 2/2 | 13 [10–15] | 110 [90–130] | 3,332 [3,037–3,626] | 269,037 [216,058–322,015] | 26,044 [23,674–28,414] | $0.0958 [$0.0937–$0.0978] | 40.3 s [37.7 s–43.0 s] |
| fastify/x142 | with | 2/2 | 10 [8–11] | 86 [74–98] | 2,403 [2,304–2,501] | 212,498 [176,176–248,819] | 19,066 [18,169–19,962] | $0.0715 [$0.0655–$0.0774] | 29.0 s [27.9 s–30.1 s] |
| fastify/x143 | without | 2/2 | 22 [19–25] | 186 [162–210] | 4,564 [4,375–4,752] | 532,027 [408,055–655,998] | 24,040 [21,651–26,429] | $0.1243 [$0.1080–$0.1405] | 53.9 s [52.4 s–55.5 s] |
| fastify/x143 | with | 2/2 | 7 [6–7] | 62 [58–66] | 1,800 [1,749–1,850] | 130,963 [121,765–140,161] | 11,628 [11,492–11,764] | $0.0454 [$0.0450–$0.0458] | 25.5 s [24.4 s–26.6 s] |
| fastify/x144 | without | 2/2 | 17 [14–19] | 142 [122–162] | 5,231 [4,445–6,016] | 389,454 [357,716–421,192] | 26,037 [21,685–30,389] | $0.1173 [$0.1157–$0.1189] | 56.0 s [51.4 s–60.6 s] |
| fastify/x144 | with | 2/2 | 14 [12–15] | 118 [106–130] | 3,890 [3,102–4,677] | 275,691 [245,855–305,526] | 13,327 [12,750–13,903] | $0.0738 [$0.0657–$0.0819] | 47.6 s [37.0 s–58.1 s] |

