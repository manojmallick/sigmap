# Agent-level A/B — measured tool calls, tokens and cost

**claude-code 2.1.322 (Claude Code) · claude-haiku-5-5 · 2026-11-10 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap as one on-demand skill (sigmap-locate) + the sigmap CLI: no MCP server, no always-on section.
- Both arms: the same prompt, model, tool allowlist (Read, Grep, Glob, Bash), per-run budget cap $0.5 and timeout 420 s; run in a clean copy of the commit pinned in `benchmarks/xrepo-repos.json`.
- Questions: the task id(s) x001, x002, x003, x004, x005 of `benchmarks/tasks/retrieval-xrepo.jsonl`. Pass = hit@5 on the repository-relative paths the answer names.
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
| gin | 5 | 10/10 | 9/10 | 0 / 0 |
| all | 5 | 10/10 | 9/10 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 5. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −26% | −6% | fewer in every repetition |
| Input tokens (uncached) | −6% | −17% | fewer in every repetition |
| Output tokens | −18% | +2% | mixed |
| Cache-read tokens | −9% | −24% | fewer in every repetition |
| Cache-write tokens | +1% | −5% | mixed |
| Total tokens (derived) | −8% | −21% | fewer in every repetition |
| Cost | −5% | −7% | fewer in every repetition |
| Wall time | −7% | −2% | fewer in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −19% [−40%, +18%] † | +11% [−31%, +115%] † | mixed |
| Input tokens (uncached) | −2% [−31%, +43%] † | −13% [−31%, +15%] † | fewer in every repetition, within the noise |
| Output tokens | −14% [−32%, +4%] † | +10% [−24%, +70%] † | mixed |
| Cache-read tokens | −3% [−37%, +63%] † | −17% [−40%, +19%] † | fewer in every repetition, within the noise |
| Cache-write tokens | +1% [−10%, +14%] † | −5% [−13%, +4%] † | mixed |
| Total tokens (derived) | −3% [−32%, +48%] † | −15% [−35%, +13%] † | fewer in every repetition, within the noise |
| Cost | −3% [−17%, +16%] † | −4% [−18%, +11%] † | fewer in every repetition, within the noise |
| Wall time | −5% [−20%, +11%] † | +1% [−24%, +35%] † | mixed |

### Outcome (hit@5), by repetition

Per paired task: **better** = the SigMap arm named the file and the other did not; **worse** = the reverse; **tie** = both found it or both missed. Localisation only.

| repetition | paired tasks | better | worse | tie |
| --- | ---: | ---: | ---: | ---: |
| R1 | 5 | 0 | 1 | 4 |
| R2 | 5 | 0 | 0 | 5 |
| all | 10 | 0 | 1 | 9 |

## Tool calls

Provenance: agent-reported (main-thread tool_use blocks). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 3 | 3 | −1 | 3 / 0 / 2 |
| all | 3 | 3 | −1 | 3 / 0 / 2 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 7 | 6 | −1 | 3 / 0 / 2 |
| all | 7 | 6 | −1 | 3 / 0 / 2 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 1,130 | 1,240 | −13 | 3 / 0 / 2 |
| all | 1,130 | 1,240 | −13 | 3 / 0 / 2 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 43,415 | 37,638 | −7,716 | 3 / 0 / 2 |
| all | 43,415 | 37,638 | −7,716 | 3 / 0 / 2 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 9,647 | 9,517 | −130 | 3 / 0 / 2 |
| all | 9,647 | 9,517 | −130 | 3 / 0 / 2 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 54,004 | 50,937 | −8,591 | 3 / 0 / 2 |
| all | 54,004 | 50,937 | −8,591 | 3 / 0 / 2 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | $0.0028 | $0.0029 | −$0.0001 | 3 / 0 / 2 |
| all | $0.0028 | $0.0029 | −$0.0001 | 3 / 0 / 2 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 11.8 s | 12.1 s | +382 ms | 2 / 0 / 3 |
| all | 11.8 s | 12.1 s | +382 ms | 2 / 0 / 3 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| gin | $0.0313 (10 runs) | $0.0295 (10 runs) | none | none |
| all | $0.0313 (10 runs) | $0.0295 (10 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| gin/x001 | without | 2/2 | 3 [2–3] | 6 [4–8] | 1,130 [971–1,289] | 35,479 [20,697–50,260] | 8,829 [8,136–9,521] | $0.0027 [$0.0026–$0.0028] | 11.8 s [10.8 s–12.7 s] |
| gin/x001 | with | 2/2 | 3 [3–3] | 7 [6–8] | 1,240 [1,133–1,346] | 44,088 [34,956–53,219] | 10,103 [8,844–11,361] | $0.0031 [$0.0028–$0.0034] | 12.2 s [12.1 s–12.3 s] |
| gin/x002 | without | 2/2 | 1 [1–1] | 4 [4–4] | 806 [680–932] | 20,729 [20,719–20,739] | 8,117 [7,993–8,240] | $0.0022 [$0.0021–$0.0023] | 8.8 s [7.9 s–9.7 s] |
| gin/x002 | with | 2/2 | 3 [1–4] | 5 [4–6] | 1,239 [844–1,633] | 27,708 [20,829–34,587] | 8,503 [7,142–9,864] | $0.0026 [$0.0026–$0.0026] | 12.1 s [11.0 s–13.2 s] |
| gin/x003 | without | 2/2 | 3 [2–3] | 7 [6–8] | 936 [675–1,196] | 43,415 [34,523–52,307] | 9,647 [9,166–10,127] | $0.0028 [$0.0025–$0.0031] | 11.1 s [9.2 s–13.0 s] |
| gin/x003 | with | 1/2 | 2 [2–2] | 6 [6–6] | 923 [880–965] | 34,969 [34,848–35,089] | 9,517 [9,391–9,642] | $0.0027 [$0.0027–$0.0027] | 11.5 s [10.9 s–12.0 s] |
| gin/x004 | without | 2/2 | 6 [5–6] | 10 [10–10] | 2,017 [1,572–2,461] | 75,606 [70,769–80,442] | 13,137 [12,080–14,194] | $0.0044 [$0.0044–$0.0044] | 17.0 s [16.1 s–17.8 s] |
| gin/x004 | with | 2/2 | 3 [3–3] | 6 [6–6] | 1,313 [1,226–1,399] | 37,638 [36,984–38,292] | 11,981 [11,189–12,772] | $0.0034 [$0.0033–$0.0036] | 11.8 s [11.3 s–12.4 s] |
| gin/x005 | without | 2/2 | 7 [7–7] | 8 [8–8] | 1,836 [1,580–2,091] | 51,417 [49,466–53,368] | 10,397 [10,224–10,570] | $0.0035 [$0.0034–$0.0036] | 14.4 s [13.6 s–15.2 s] |
| gin/x005 | with | 2/2 | 5 [5–5] | 7 [6–8] | 1,405 [1,318–1,491] | 43,701 [35,299–52,103] | 8,903 [8,636–9,169] | $0.0029 [$0.0027–$0.0031] | 12.5 s [11.1 s–13.8 s] |

