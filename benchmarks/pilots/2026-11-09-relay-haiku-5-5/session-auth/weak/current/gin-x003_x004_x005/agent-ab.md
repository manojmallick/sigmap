# Agent-level A/B — measured tool calls, tokens and cost

**claude-code 2.1.322 (Claude Code) · claude-haiku-4-5 · 2026-11-10 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap generated context + MCP server.
- Both arms: the same prompt, model, tool allowlist (Read, Grep, Glob, Bash), per-run budget cap $1 and timeout 420 s; run in a clean copy of the commit pinned in `benchmarks/xrepo-repos.json`.
- Questions: the task id(s) x003, x004, x005 of `benchmarks/tasks/retrieval-xrepo.jsonl`. Pass = hit@5 on the repository-relative paths the answer names.
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
| gin | 3 | 6/6 | 6/6 | 0 / 0 |
| all | 3 | 6/6 | 6/6 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 3. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −5% | −28% | fewer in every repetition |
| Input tokens (uncached) | −31% | −34% | fewer in every repetition |
| Output tokens | −13% | −22% | fewer in every repetition |
| Cache-read tokens | −17% | −25% | fewer in every repetition |
| Cache-write tokens | +4% | −34% | mixed |
| Total tokens (derived) | −16% | −25% | fewer in every repetition |
| Cost | −7% | −29% | fewer in every repetition |
| Wall time | −10% | −20% | fewer in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −12% [−57%, +70%] † | −29% [−50%, −11%] | fewer in every repetition, within the noise |
| Input tokens (uncached) | −36% [−72%, +22%] † | −35% [−53%, −16%] | fewer in every repetition, within the noise |
| Output tokens | −17% [−49%, +26%] † | −23% [−27%, −16%] | fewer in every repetition, within the noise |
| Cache-read tokens | −29% [−71%, +39%] † | −27% [−46%, +20%] † | fewer in every repetition, within the noise |
| Cache-write tokens | −5% [−34%, +86%] † | −28% [−63%, +55%] † | fewer in every repetition, within the noise |
| Total tokens (derived) | −27% [−69%, +31%] † | −27% [−45%, +21%] † | fewer in every repetition, within the noise |
| Cost | −17% [−51%, +25%] † | −28% [−52%, +25%] † | fewer in every repetition, within the noise |
| Wall time | −14% [−47%, +25%] † | −21% [−28%, −6%] | fewer in every repetition, within the noise |

### Outcome (hit@5), by repetition

Per paired task: **better** = the SigMap arm named the file and the other did not; **worse** = the reverse; **tie** = both found it or both missed. Localisation only.

| repetition | paired tasks | better | worse | tie |
| --- | ---: | ---: | ---: | ---: |
| R1 | 3 | 0 | 0 | 3 |
| R2 | 3 | 0 | 0 | 3 |
| all | 6 | 0 | 0 | 6 |

## Tool calls

Provenance: agent-reported (main-thread tool_use blocks). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 12 | 13 | −4 | 2 / 0 / 1 |
| all | 12 | 13 | −4 | 2 / 0 / 1 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 102 | 86 | −48 | 2 / 1 / 0 |
| all | 102 | 86 | −48 | 2 / 1 / 0 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 2,641 | 2,321 | −463 | 2 / 0 / 1 |
| all | 2,641 | 2,321 | −463 | 2 / 0 / 1 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 244,260 | 238,579 | −68,235 | 2 / 0 / 1 |
| all | 244,260 | 238,579 | −68,235 | 2 / 0 / 1 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 17,803 | 16,790 | −1,014 | 2 / 0 / 1 |
| all | 17,803 | 16,790 | −1,014 | 2 / 0 / 1 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 270,039 | 259,428 | −63,974 | 2 / 0 / 1 |
| all | 270,039 | 259,428 | −63,974 | 2 / 0 / 1 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | $0.0760 | $0.0700 | +$0.0004 | 1 / 0 / 2 |
| all | $0.0760 | $0.0700 | +$0.0004 | 1 / 0 / 2 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 32.1 s | 29.3 s | −4.3 s | 2 / 0 / 1 |
| all | 32.1 s | 29.3 s | −4.3 s | 2 / 0 / 1 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| gin | $0.4519 (6 runs) | $0.3736 (6 runs) | none | none |
| all | $0.4519 (6 runs) | $0.3736 (6 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| gin/x003 | without | 2/2 | 16 [12–20] | 138 [106–170] | 2,783 [2,124–3,442] | 306,814 [209,381–404,246] | 15,630 [14,397–16,862] | $0.0760 [$0.0605–$0.0915] | 33.7 s [28.0 s–39.5 s] |
| gin/x003 | with | 2/2 | 13 [6–19] | 90 [50–130] | 2,321 [1,560–3,081] | 238,579 [113,239–363,919] | 20,401 [9,468–31,333] | $0.0764 [$0.0381–$0.1146] | 29.4 s [20.3 s–38.5 s] |
| gin/x004 | without | 2/2 | 12 [9–14] | 102 [82–122] | 2,641 [2,571–2,711] | 244,260 [238,976–249,544] | 23,036 [13,780–32,292] | $0.0838 [$0.0662–$0.1014] | 32.1 s [31.6 s–32.6 s] |
| gin/x004 | with | 2/2 | 7 [6–8] | 46 [34–58] | 1,655 [1,375–1,935] | 109,512 [72,823–146,201] | 10,581 [9,134–12,027] | $0.0404 [$0.0325–$0.0484] | 20.0 s [17.1 s–22.9 s] |
| gin/x005 | without | 2/2 | 11 [10–11] | 86 [74–98] | 2,384 [2,244–2,523] | 185,399 [177,169–193,629] | 17,803 [10,402–25,204] | $0.0661 [$0.0512–$0.0811] | 27.0 s [25.3 s–28.8 s] |
| gin/x005 | with | 2/2 | 13 [9–17] | 86 [82–90] | 2,474 [2,124–2,823] | 240,079 [211,778–268,379] | 16,790 [16,115–17,464] | $0.0700 [$0.0641–$0.0760] | 29.3 s [27.2 s–31.4 s] |

