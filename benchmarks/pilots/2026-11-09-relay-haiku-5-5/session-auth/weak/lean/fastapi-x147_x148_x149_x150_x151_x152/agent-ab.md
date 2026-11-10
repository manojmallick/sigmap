# Agent-level A/B — measured tool calls, tokens and cost

**claude-code 2.1.322 (Claude Code) · claude-haiku-4-5 · 2026-11-10 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap lean: 7-tool core MCP profile + a three-line section.
- Both arms: the same prompt, model, tool allowlist (Read, Grep, Glob, Bash), per-run budget cap $1 and timeout 420 s; run in a clean copy of the commit pinned in `benchmarks/xrepo-repos.json`.
- Questions: the task id(s) x147, x148, x149, x150, x151, x152 of `benchmarks/tasks/retrieval-xrepo.jsonl`. Pass = hit@5 on the repository-relative paths the answer names.
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
| fastapi | 6 | 12/12 | 12/12 | 0 / 0 |
| all | 6 | 12/12 | 12/12 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 6. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | +6% | +1% | more in every repetition |
| Input tokens (uncached) | +5% | +3% | more in every repetition |
| Output tokens | +12% | +9% | more in every repetition |
| Cache-read tokens | +14% | +35% | more in every repetition |
| Cache-write tokens | −9% | −1% | fewer in every repetition |
| Total tokens (derived) | +12% | +32% | more in every repetition |
| Cost | +2% | +11% | more in every repetition |
| Wall time | +13% | +7% | more in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −8% [−32%, +24%] † | −32% [−68%, +43%] † | fewer in every repetition, within the noise |
| Input tokens (uncached) | −6% [−28%, +20%] † | −23% [−58%, +39%] † | fewer in every repetition, within the noise |
| Output tokens | +5% [−21%, +33%] † | −15% [−51%, +37%] † | mixed |
| Cache-read tokens | 0% [−30%, +40%] † | −25% [−69%, +77%] † | mixed |
| Cache-write tokens | −15% [−32%, +4%] † | −15% [−36%, +14%] † | fewer in every repetition, within the noise |
| Total tokens (derived) | 0% [−29%, +37%] † | −22% [−65%, +70%] † | fewer in every repetition, within the noise |
| Cost | −5% [−28%, +19%] † | −14% [−45%, +34%] † | fewer in every repetition, within the noise |
| Wall time | +7% [−16%, +30%] † | −10% [−41%, +32%] † | mixed |

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
| fastapi | 11 | 11 | +1 | 3 / 0 / 3 |
| all | 11 | 11 | +1 | 3 / 0 / 3 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | 90 | 96 | +6 | 3 / 0 / 3 |
| all | 90 | 96 | +6 | 3 / 0 / 3 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | 2,478 | 2,882 | +404 | 2 / 0 / 4 |
| all | 2,478 | 2,882 | +404 | 2 / 0 / 4 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | 255,468 | 263,881 | +12,994 | 3 / 0 / 3 |
| all | 255,468 | 263,881 | +12,994 | 3 / 0 / 3 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | 27,050 | 26,453 | −2,060 | 4 / 0 / 2 |
| all | 27,050 | 26,453 | −2,060 | 4 / 0 / 2 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | 288,652 | 295,415 | +9,274 | 3 / 0 / 3 |
| all | 288,652 | 295,415 | +9,274 | 3 / 0 / 3 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | $0.0990 | $0.0980 | −$0.0013 | 3 / 0 / 3 |
| all | $0.0990 | $0.0980 | −$0.0013 | 3 / 0 / 3 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | 31.6 s | 35.3 s | +3.7 s | 3 / 0 / 3 |
| all | 31.6 s | 35.3 s | +3.7 s | 3 / 0 / 3 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| fastapi | $1.15 (12 runs) | $1.22 (12 runs) | none | none |
| all | $1.15 (12 runs) | $1.22 (12 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| fastapi/x147 | without | 2/2 | 11 [10–11] | 94 [90–98] | 2,377 [2,071–2,683] | 218,213 [211,910–224,516] | 23,281 [23,264–23,297] | $0.0804 [$0.0782–$0.0825] | 30.2 s [27.2 s–33.2 s] |
| fastapi/x147 | with | 2/2 | 14 [13–15] | 122 [114–130] | 3,167 [3,145–3,188] | 314,501 [238,160–390,841] | 20,123 [12,224–28,021] | $0.0876 [$0.0641–$0.1112] | 38.6 s [38.2 s–39.1 s] |
| fastapi/x148 | without | 2/2 | 11 [10–12] | 86 [74–98] | 2,125 [1,815–2,434] | 170,622 [130,701–210,543] | 15,162 [14,812–15,512] | $0.0581 [$0.0532–$0.0629] | 26.4 s [22.2 s–30.5 s] |
| fastapi/x148 | with | 2/2 | 7 [2–11] | 50 [26–74] | 1,441 [687–2,194] | 100,323 [37,527–163,118] | 10,782 [8,980–12,584] | $0.0388 [$0.0252–$0.0525] | 20.1 s [12.0 s–28.2 s] |
| fastapi/x149 | without | 2/2 | 9 [6–11] | 78 [58–98] | 1,895 [1,707–2,083] | 158,526 [105,607–211,444] | 16,381 [15,891–16,870] | $0.0582 [$0.0509–$0.0654] | 24.9 s [23.1 s–26.7 s] |
| fastapi/x149 | with | 2/2 | 3 [2–3] | 30 [26–34] | 932 [926–938] | 45,407 [37,327–53,487] | 9,895 [8,105–11,685] | $0.0290 [$0.0263–$0.0318] | 14.2 s [13.7 s–14.7 s] |
| fastapi/x150 | without | 2/2 | 16 [10–21] | 134 [90–178] | 3,321 [2,840–3,802] | 392,449 [212,539–572,359] | 30,820 [29,526–32,113] | $0.1176 [$0.0998–$0.1355] | 39.6 s [33.9 s–45.3 s] |
| fastapi/x150 | with | 2/2 | 20 [17–23] | 170 [146–194] | 4,406 [3,878–4,934] | 672,548 [632,053–713,043] | 36,401 [29,528–43,273] | $0.1623 [$0.1552–$0.1693] | 49.7 s [45.6 s–53.9 s] |
| fastapi/x151 | without | 2/2 | 22 [18–26] | 186 [154–218] | 4,808 [3,910–5,706] | 574,194 [486,914–661,473] | 31,294 [30,688–31,899] | $0.1442 [$0.1322–$0.1563] | 51.7 s [46.0 s–57.3 s] |
| fastapi/x151 | with | 2/2 | 30 [29–30] | 246 [242–250] | 6,365 [6,331–6,398] | 884,269 [747,836–1,020,702] | 32,784 [24,201–41,366] | $0.1861 [$0.1551–$0.2170] | 72.2 s [70.1 s–74.3 s] |
| fastapi/x152 | without | 2/2 | 10 [9–10] | 86 [82–90] | 2,579 [2,309–2,848] | 292,722 [285,704–299,740] | 37,953 [37,644–38,261] | $0.1182 [$0.1167–$0.1196] | 33.1 s [31.4 s–34.7 s] |
| fastapi/x152 | with | 2/2 | 8 [6–9] | 70 [58–82] | 2,597 [2,581–2,613] | 213,261 [184,875–241,646] | 36,991 [36,036–37,946] | $0.1084 [$0.1035–$0.1132] | 31.9 s [31.2 s–32.6 s] |

