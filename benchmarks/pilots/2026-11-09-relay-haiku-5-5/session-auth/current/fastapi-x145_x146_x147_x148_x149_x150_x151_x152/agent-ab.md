# Agent-level A/B — measured tool calls, tokens and cost

**claude-code 2.1.321 (Claude Code) · claude-haiku-5-5 · 2026-11-09 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap generated context + MCP server.
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
| fastapi | 8 | 16/16 | 15/16 | 0 / 1 |
| all | 8 | 16/16 | 15/16 | 0 / 1 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 8. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | +4% | −18% n=7 | mixed |
| Input tokens (uncached) | 0% | −20% n=7 | mixed |
| Output tokens | +28% | −5% n=7 | mixed |
| Cache-read tokens | +67% | +30% n=7 | more in every repetition |
| Cache-write tokens | +6% | +5% n=7 | more in every repetition |
| Total tokens (derived) | +56% | +26% n=7 | more in every repetition |
| Cost | +20% | +6% n=7 | more in every repetition |
| Wall time | +9% | −4% n=7 | mixed |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | +1% [−28%, +45%] † | −20% [−36%, +2%] † n=7 | mixed |
| Input tokens (uncached) | −6% [−28%, +27%] † | −17% [−32%, −4%] n=7 | fewer in every repetition, within the noise |
| Output tokens | +27% [+5%, +57%] | −7% [−18%, +5%] † n=7 | mixed |
| Cache-read tokens | +54% [+5%, +125%] | +39% [+8%, +68%] n=7 | more in every repetition, outside the noise |
| Cache-write tokens | +6% [−3%, +15%] † | +6% [−1%, +14%] † n=7 | more in every repetition, within the noise |
| Total tokens (derived) | +48% [+7%, +103%] | +32% [+7%, +53%] n=7 | more in every repetition, outside the noise |
| Cost | +20% [+4%, +39%] | +7% [0%, +14%] † n=7 | more in every repetition, within the noise |
| Wall time | +7% [−8%, +28%] † | −4% [−12%, +6%] † n=7 | mixed |

### Outcome (hit@5), by repetition

Per paired task: **better** = the SigMap arm named the file and the other did not; **worse** = the reverse; **tie** = both found it or both missed. Localisation only.

| repetition | paired tasks | better | worse | tie |
| --- | ---: | ---: | ---: | ---: |
| R1 | 8 | 0 | 0 | 8 |
| R2 | 7 | 0 | 0 | 7 |
| all | 15 | 0 | 0 | 15 |

## Tool calls

Provenance: agent-reported (main-thread tool_use blocks). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | 3 | 3 | 0 | 3 / 3 / 2 |
| all | 3 | 3 | 0 | 3 / 3 / 2 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | 7 | 6 | −1 | 6 / 1 / 1 |
| all | 7 | 6 | −1 | 6 / 1 / 1 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | 1,069 | 1,174 | +178 | 3 / 0 / 5 |
| all | 1,069 | 1,174 | +178 | 3 / 0 / 5 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | 33,204 | 48,208 | +15,153 | 1 / 0 / 7 |
| all | 33,204 | 48,208 | +15,153 | 1 / 0 / 7 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | 6,479 | 7,031 | +539 | 3 / 0 / 5 |
| all | 6,479 | 7,031 | +539 | 3 / 0 / 5 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | 40,218 | 56,256 | +16,940 | 1 / 0 / 7 |
| all | 40,218 | 56,256 | +16,940 | 1 / 0 / 7 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | $0.0021 | $0.0025 | +$0.0004 | 2 / 0 / 6 |
| all | $0.0021 | $0.0025 | +$0.0004 | 2 / 0 / 6 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | 12.0 s | 13.0 s | +395 ms | 3 / 0 / 5 |
| all | 12.0 s | 13.0 s | +395 ms | 3 / 0 / 5 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| fastapi | $0.0351 (16 runs) | $0.0382 (15 runs) · 1 run unreported | none | 1 run unreported |
| all | $0.0351 (16 runs) | $0.0382 (15 runs) · 1 run unreported | none | 1 run unreported |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| fastapi/x145 | without | 2/2 | 3 [2–4] | 6 [4–8] | 928 [901–954] | 30,575 [16,848–44,301] | 8,109 [5,461–10,757] | $0.0024 [$0.0017–$0.0030] | 10.4 s [9.2 s–11.7 s] |
| fastapi/x145 | with | 2/2 | 2 [1–2] | 4 [4–4] | 867 [690–1,044] | 27,783 [25,257–30,308] | 7,870 [5,252–10,488] | $0.0023 [$0.0017–$0.0029] | 9.9 s [8.9 s–10.9 s] |
| fastapi/x146 | without | 2/2 | 4 [3–5] | 10 [8–12] | 1,201 [888–1,514] | 53,572 [40,301–66,843] | 7,933 [7,655–8,211] | $0.0027 [$0.0024–$0.0031] | 14.7 s [12.8 s–16.7 s] |
| fastapi/x146 | with | 2/2 | 4 [3–5] | 9 [6–12] | 1,448 [1,272–1,624] | 76,409 [47,338–105,479] | 8,693 [8,627–8,759] | $0.0032 [$0.0029–$0.0036] | 15.4 s [12.8 s–18.0 s] |
| fastapi/x147 | without | 2/2 | 3 [3–3] | 6 [6–6] | 1,140 [980–1,300] | 27,557 [27,397–27,716] | 5,870 [5,354–6,385] | $0.0020 [$0.0020–$0.0020] | 12.4 s [12.2 s–12.6 s] |
| fastapi/x147 | with | 2/2 | 3 [2–4] | 6 [6–6] | 1,249 [1,129–1,369] | 47,740 [47,377–48,103] | 5,815 [5,527–6,103] | $0.0023 [$0.0021–$0.0024] | 13.2 s [12.3 s–14.1 s] |
| fastapi/x148 | without | 2/2 | 4 [3–5] | 7 [6–8] | 944 [775–1,112] | 33,423 [27,792–39,054] | 5,276 [4,550–6,001] | $0.0019 [$0.0016–$0.0021] | 11.3 s [10.3 s–12.2 s] |
| fastapi/x148 | with | 1/2 | 5 [5–5] n=1 | 6 [6–6] n=1 | 1,349 [1,349–1,349] n=1 | 47,938 [47,938–47,938] n=1 | 7,327 [7,327–7,327] n=1 | $0.0026 [$0.0026–$0.0026] n=1 | 13.0 s [13.0 s–13.0 s] n=1 |
| fastapi/x149 | without | 2/2 | 2 [2–2] | 6 [6–6] | 673 [647–699] | 27,171 [26,748–27,594] | 6,711 [6,148–7,274] | $0.0020 [$0.0018–$0.0021] | 9.1 s [8.9 s–9.4 s] |
| fastapi/x149 | with | 2/2 | 4 [2–5] | 9 [6–12] | 1,098 [778–1,418] | 75,596 [47,610–103,582] | 7,028 [6,903–7,153] | $0.0027 [$0.0023–$0.0031] | 13.0 s [10.0 s–16.1 s] |
| fastapi/x150 | without | 2/2 | 4 [2–5] | 7 [6–8] | 1,050 [940–1,160] | 34,508 [28,196–40,820] | 6,995 [6,647–7,342] | $0.0023 [$0.0021–$0.0025] | 11.6 s [10.8 s–12.4 s] |
| fastapi/x150 | with | 2/2 | 3 [2–3] | 6 [6–6] | 841 [747–935] | 47,923 [47,833–48,013] | 6,360 [6,252–6,467] | $0.0022 [$0.0021–$0.0022] | 9.9 s [9.4 s–10.4 s] |
| fastapi/x151 | without | 2/2 | 3 [3–3] | 8 [8–8] | 1,089 [1,024–1,153] | 38,853 [38,439–39,266] | 5,253 [4,907–5,598] | $0.0020 [$0.0020–$0.0020] | 12.7 s [11.7 s–13.6 s] |
| fastapi/x151 | with | 2/2 | 3 [2–3] | 6 [6–6] | 1,054 [1,040–1,068] | 48,477 [47,909–49,045] | 6,354 [6,272–6,436] | $0.0023 [$0.0023–$0.0023] | 11.3 s [10.8 s–11.7 s] |
| fastapi/x152 | without | 2/2 | 4 [3–5] | 7 [6–8] | 1,548 [1,484–1,611] | 32,985 [27,074–38,895] | 6,247 [6,191–6,303] | $0.0024 [$0.0023–$0.0025] | 15.6 s [15.2 s–15.9 s] |
| fastapi/x152 | with | 2/2 | 4 [4–4] | 6 [6–6] | 1,880 [1,868–1,891] | 48,775 [48,429–49,121] | 7,034 [6,663–7,404] | $0.0028 [$0.0028–$0.0029] | 15.7 s [15.4 s–15.9 s] |

