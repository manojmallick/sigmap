# Agent-level A/B — measured tool calls, tokens and cost

**claude-code 2.1.322 (Claude Code) · claude-haiku-5-5 · 2026-11-10 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap index strategy + 7-tool core MCP profile (the docs' setup for an agent that calls the tools).
- Both arms: the same prompt, model, tool allowlist (Read, Grep, Glob, Bash), per-run budget cap $0.6 and timeout 420 s; run in a clean copy of the commit pinned in `benchmarks/xrepo-repos.json`.
- Questions: the task id(s) h016, h017, h018, h019, h020, h021, h022, h023 of `benchmarks/tasks/retrieval-xrepo.jsonl`. Pass = hit@5 on the repository-relative paths the answer names.
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
| sigmap-src | 8 | 16/16 | 11/16 | 0 / 0 |
| all | 8 | 16/16 | 11/16 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 8. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −57% | −62% | fewer in every repetition |
| Input tokens (uncached) | −46% | −52% | fewer in every repetition |
| Output tokens | −52% | −53% | fewer in every repetition |
| Cache-read tokens | −50% | −54% | fewer in every repetition |
| Cache-write tokens | −41% | −39% | fewer in every repetition |
| Total tokens (derived) | −49% | −53% | fewer in every repetition |
| Cost | −45% | −46% | fewer in every repetition |
| Wall time | −37% | −37% | fewer in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −56% [−75%, −26%] | −65% [−77%, −41%] | fewer in every repetition, outside the noise |
| Input tokens (uncached) | −45% [−60%, −24%] | −51% [−61%, −31%] | fewer in every repetition, outside the noise |
| Output tokens | −50% [−61%, −35%] | −52% [−64%, −25%] | fewer in every repetition, outside the noise |
| Cache-read tokens | −46% [−65%, −16%] | −51% [−64%, −25%] | fewer in every repetition, outside the noise |
| Cache-write tokens | −40% [−52%, −27%] | −40% [−48%, −32%] | fewer in every repetition, outside the noise |
| Total tokens (derived) | −45% [−63%, −18%] | −50% [−62%, −27%] | fewer in every repetition, outside the noise |
| Cost | −43% [−56%, −28%] | −45% [−54%, −31%] | fewer in every repetition, outside the noise |
| Wall time | −35% [−47%, −23%] | −34% [−47%, −14%] | fewer in every repetition, outside the noise |

### Outcome (hit@5), by repetition

Per paired task: **better** = the SigMap arm named the file and the other did not; **worse** = the reverse; **tie** = both found it or both missed. Localisation only.

| repetition | paired tasks | better | worse | tie |
| --- | ---: | ---: | ---: | ---: |
| R1 | 8 | 0 | 3 | 5 |
| R2 | 8 | 0 | 2 | 6 |
| all | 16 | 0 | 5 | 11 |

## Tool calls

Provenance: agent-reported (main-thread tool_use blocks). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 6 | 3 | −4 | 7 / 0 / 1 |
| all | 6 | 3 | −4 | 7 / 0 / 1 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 11 | 7 | −6 | 7 / 0 / 1 |
| all | 11 | 7 | −6 | 7 / 0 / 1 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 1,733 | 806 | −1,010 | 7 / 0 / 1 |
| all | 1,733 | 806 | −1,010 | 7 / 0 / 1 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 58,640 | 40,037 | −35,093 | 7 / 0 / 1 |
| all | 58,640 | 40,037 | −35,093 | 7 / 0 / 1 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 11,683 | 7,199 | −5,329 | 8 / 0 / 0 |
| all | 11,683 | 7,199 | −5,329 | 8 / 0 / 0 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 71,363 | 48,984 | −42,391 | 7 / 0 / 1 |
| all | 71,363 | 48,984 | −42,391 | 7 / 0 / 1 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | $0.0038 | $0.0025 | −$0.0020 | 7 / 0 / 1 |
| all | $0.0038 | $0.0025 | −$0.0020 | 7 / 0 / 1 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 15.8 s | 10.6 s | −6.5 s | 7 / 0 / 1 |
| all | 15.8 s | 10.6 s | −6.5 s | 7 / 0 / 1 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | $0.0678 (16 runs) | $0.0370 (16 runs) | none | none |
| all | $0.0678 (16 runs) | $0.0370 (16 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| sigmap-src/h016 | without | 2/2 | 6 [5–6] | 11 [10–12] | 1,917 [1,853–1,981] | 60,854 [53,813–67,894] | 11,310 [9,512–13,107] | $0.0038 [$0.0036–$0.0041] | 17.7 s [16.7 s–18.6 s] |
| sigmap-src/h016 | with | 2/2 | 2 [2–2] | 4 [4–4] | 763 [725–801] | 21,018 [20,704–21,332] | 5,969 [5,583–6,355] | $0.0018 [$0.0017–$0.0018] | 9.4 s [9.0 s–9.8 s] |
| sigmap-src/h017 | without | 2/2 | 5 [4–6] | 10 [10–10] | 1,537 [1,422–1,651] | 56,426 [53,523–59,328] | 10,664 [9,976–11,351] | $0.0035 [$0.0032–$0.0037] | 13.9 s [13.6 s–14.3 s] |
| sigmap-src/h017 | with | 2/2 | 2 [1–2] | 5 [4–6] | 672 [609–734] | 27,974 [21,338–34,610] | 5,347 [4,667–6,027] | $0.0017 [$0.0015–$0.0019] | 9.3 s [8.9 s–9.7 s] |
| sigmap-src/h018 | without | 2/2 | 6 [6–6] | 9 [8–10] | 1,443 [1,419–1,466] | 51,371 [42,291–60,450] | 12,615 [10,360–14,869] | $0.0038 [$0.0032–$0.0043] | 13.9 s [12.9 s–15.0 s] |
| sigmap-src/h018 | with | 2/2 | 1 [1–1] | 4 [4–4] | 751 [750–751] | 21,021 [20,704–21,338] | 5,217 [4,859–5,575] | $0.0016 [$0.0016–$0.0017] | 9.7 s [9.4 s–9.9 s] |
| sigmap-src/h019 | without | 2/2 | 5 [4–5] | 9 [8–10] | 1,549 [1,481–1,617] | 53,226 [47,015–59,436] | 10,924 [10,360–11,488] | $0.0035 [$0.0035–$0.0035] | 13.6 s [12.9 s–14.3 s] |
| sigmap-src/h019 | with | 2/2 | 3 [2–3] | 6 [6–6] | 772 [756–788] | 36,581 [35,790–37,371] | 8,384 [7,408–9,359] | $0.0024 [$0.0022–$0.0026] | 10.1 s [9.5 s–10.6 s] |
| sigmap-src/h020 | without | 2/2 | 13 [9–17] | 19 [16–22] | 3,200 [2,723–3,676] | 137,817 [105,139–170,494] | 15,454 [12,620–18,288] | $0.0061 [$0.0049–$0.0072] | 25.2 s [21.9 s–28.5 s] |
| sigmap-src/h020 | with | 1/2 | 3 [2–4] | 7 [6–8] | 995 [988–1,001] | 43,494 [34,898–52,089] | 7,732 [7,625–7,838] | $0.0025 [$0.0024–$0.0026] | 11.8 s [10.8 s–12.9 s] |
| sigmap-src/h021 | without | 2/2 | 11 [10–11] | 19 [18–20] | 2,883 [2,851–2,914] | 153,649 [142,255–165,042] | 16,745 [13,349–20,141] | $0.0063 [$0.0055–$0.0071] | 24.4 s [24.3 s–24.4 s] |
| sigmap-src/h021 | with | 0/2 | 4 [3–4] | 8 [8–8] | 1,286 [1,235–1,337] | 55,286 [51,577–58,994] | 10,833 [9,026–12,640] | $0.0034 [$0.0029–$0.0038] | 13.6 s [13.6 s–13.6 s] |
| sigmap-src/h022 | without | 2/2 | 4 [3–4] | 7 [6–8] | 997 [780–1,213] | 33,733 [27,854–39,611] | 7,985 [7,451–8,519] | $0.0024 [$0.0022–$0.0027] | 11.1 s [9.3 s–12.9 s] |
| sigmap-src/h022 | with | 2/2 | 6 [5–6] | 9 [8–10] | 1,405 [1,305–1,504] | 56,252 [48,622–63,882] | 6,667 [5,749–7,584] | $0.0026 [$0.0024–$0.0028] | 12.9 s [12.9 s–13.0 s] |
| sigmap-src/h023 | without | 2/2 | 8 [5–10] | 14 [10–18] | 2,269 [1,756–2,781] | 95,076 [54,861–135,291] | 12,056 [9,636–14,476] | $0.0045 [$0.0034–$0.0056] | 19.6 s [15.1 s–24.2 s] |
| sigmap-src/h023 | with | 0/2 | 4 [3–4] | 7 [6–8] | 839 [758–920] | 44,764 [38,942–50,586] | 8,302 [7,390–9,214] | $0.0025 [$0.0024–$0.0026] | 11.1 s [10.4 s–11.8 s] |

