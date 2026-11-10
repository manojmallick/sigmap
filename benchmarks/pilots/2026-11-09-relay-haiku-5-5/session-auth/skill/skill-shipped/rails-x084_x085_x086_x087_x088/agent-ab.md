# Agent-level A/B — measured tool calls, tokens and cost

**claude-code 2.1.322 (Claude Code) · claude-haiku-5-5 · 2026-11-10 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap as the three skills `sigmap skills install --client claude` writes + the sigmap CLI: no MCP server, no always-on section.
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
- Skill variant: both arms run with skills enabled (the Skill tool, and the agent's own bundled skills listed in the prompt, about 2k tokens), which the earlier no-skill runs did not have, so these figures are against this run's own baseline and not comparable cell by cell with the index, lean or current runs. The SigMap arm adds only its skill file(s) and the sigmap CLI: no MCP server and no appended section.

## Outcome

| repo | tasks | pass without | pass with | failed runs (without / with) |
| --- | ---: | ---: | ---: | ---: |
| rails | 5 | 9/10 | 9/10 | 0 / 0 |
| all | 5 | 9/10 | 9/10 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 5. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | +5% | −47% | mixed |
| Input tokens (uncached) | −5% | −33% | fewer in every repetition |
| Output tokens | +8% | −40% | mixed |
| Cache-read tokens | −2% | −41% | fewer in every repetition |
| Cache-write tokens | +6% | −18% | mixed |
| Total tokens (derived) | −1% | −38% | fewer in every repetition |
| Cost | +5% | −28% | mixed |
| Wall time | +2% | −27% | mixed |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −12% [−49%, +40%] † | −37% [−57%, −8%] | fewer in every repetition, within the noise |
| Input tokens (uncached) | −11% [−38%, +27%] † | −30% [−47%, −8%] | fewer in every repetition, within the noise |
| Output tokens | +4% [−6%, +14%] † | −34% [−45%, −21%] | mixed |
| Cache-read tokens | −13% [−47%, +43%] † | −36% [−55%, −9%] | fewer in every repetition, within the noise |
| Cache-write tokens | +4% [−18%, +31%] † | −16% [−27%, −7%] | mixed |
| Total tokens (derived) | −9% [−40%, +40%] † | −33% [−51%, −9%] | fewer in every repetition, within the noise |
| Cost | +1% [−20%, +28%] † | −24% [−36%, −12%] | mixed |
| Wall time | −2% [−18%, +13%] † | −23% [−37%, −4%] | fewer in every repetition, within the noise |

### Outcome (hit@5), by repetition

Per paired task: **better** = the SigMap arm named the file and the other did not; **worse** = the reverse; **tie** = both found it or both missed. Localisation only.

| repetition | paired tasks | better | worse | tie |
| --- | ---: | ---: | ---: | ---: |
| R1 | 5 | 1 | 0 | 4 |
| R2 | 5 | 0 | 1 | 4 |
| all | 10 | 1 | 1 | 8 |

## Tool calls

Provenance: agent-reported (main-thread tool_use blocks). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | 4 | 4 | −1 | 4 / 0 / 1 |
| all | 4 | 4 | −1 | 4 / 0 / 1 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | 8 | 8 | −3 | 4 / 0 / 1 |
| all | 8 | 8 | −3 | 4 / 0 / 1 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | 1,520 | 1,395 | −135 | 5 / 0 / 0 |
| all | 1,520 | 1,395 | −135 | 5 / 0 / 0 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | 59,643 | 64,525 | −27,974 | 4 / 0 / 1 |
| all | 59,643 | 64,525 | −27,974 | 4 / 0 / 1 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | 11,217 | 10,318 | −463 | 3 / 0 / 2 |
| all | 11,217 | 10,318 | −463 | 3 / 0 / 2 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | 71,316 | 81,119 | −28,185 | 4 / 0 / 1 |
| all | 71,316 | 81,119 | −28,185 | 4 / 0 / 1 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | $0.0032 | $0.0035 | −$0.0005 | 4 / 0 / 1 |
| all | $0.0032 | $0.0035 | −$0.0005 | 4 / 0 / 1 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | 13.4 s | 13.3 s | −2.6 s | 4 / 0 / 1 |
| all | 13.4 s | 13.3 s | −2.6 s | 4 / 0 / 1 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| rails | $0.0391 (10 runs) | $0.0346 (10 runs) | none | none |
| all | $0.0391 (10 runs) | $0.0346 (10 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| rails/x084 | without | 2/2 | 3 [3–3] | 6 [6–6] | 806 [799–812] | 42,063 [40,191–43,935] | 11,217 [9,334–13,100] | $0.0031 [$0.0027–$0.0034] | 9.3 s [9.0 s–9.6 s] |
| rails/x084 | with | 1/2 | 2 [1–3] | 5 [4–6] | 714 [709–718] | 33,473 [23,074–43,871] | 10,057 [9,087–11,027] | $0.0027 [$0.0026–$0.0028] | 9.8 s [9.3 s–10.2 s] |
| rails/x085 | without | 2/2 | 4 [3–4] | 7 [6–8] | 1,520 [1,505–1,535] | 49,748 [42,943–56,552] | 9,349 [7,826–10,872] | $0.0031 [$0.0027–$0.0035] | 13.4 s [12.7 s–14.1 s] |
| rails/x085 | with | 2/2 | 5 [3–7] | 9 [6–12] | 1,395 [982–1,808] | 69,488 [43,323–95,652] | 10,318 [6,678–13,957] | $0.0035 [$0.0023–$0.0047] | 13.3 s [10.3 s–16.4 s] |
| rails/x086 | without | 2/2 | 3 [3–3] | 8 [8–8] | 869 [797–940] | 59,643 [58,450–60,835] | 10,797 [7,370–14,224] | $0.0032 [$0.0026–$0.0038] | 12.0 s [11.9 s–12.0 s] |
| rails/x086 | with | 2/2 | 2 [2–2] | 4 [4–4] | 734 [731–736] | 24,872 [23,106–26,637] | 8,282 [6,555–10,008] | $0.0023 [$0.0019–$0.0026] | 8.5 s [8.2 s–8.8 s] |
| rails/x087 | without | 1/2 | 8 [3–12] | 11 [6–16] | 2,797 [2,036–3,558] | 99,022 [41,419–156,625] | 15,034 [12,315–17,752] | $0.0054 [$0.0039–$0.0069] | 21.0 s [14.6 s–27.5 s] |
| rails/x087 | with | 2/2 | 4 [4–4] | 8 [8–8] | 2,016 [1,833–2,198] | 64,525 [62,502–66,547] | 14,571 [11,591–17,550] | $0.0046 [$0.0039–$0.0053] | 16.2 s [15.5 s–16.9 s] |
| rails/x088 | without | 2/2 | 8 [6–9] | 12 [12–12] | 1,988 [1,452–2,523] | 100,109 [99,084–101,134] | 13,766 [12,490–15,042] | $0.0047 [$0.0047–$0.0048] | 17.4 s [15.4 s–19.4 s] |
| rails/x088 | with | 2/2 | 5 [4–6] | 9 [8–10] | 1,511 [1,358–1,664] | 72,136 [63,510–80,761] | 14,034 [10,885–17,183] | $0.0043 [$0.0035–$0.0051] | 14.8 s [13.6 s–15.9 s] |

