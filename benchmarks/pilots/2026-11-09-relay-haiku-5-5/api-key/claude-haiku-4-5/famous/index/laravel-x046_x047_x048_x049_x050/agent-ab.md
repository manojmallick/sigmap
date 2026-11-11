# Agent-level A/B — measured tool calls, tokens and cost

**anthropic-messages-api direct Messages API · claude-haiku-4-5 · 2026-11-11 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap index strategy + 7-tool core MCP profile (the docs' setup for an agent that calls the tools).
- Both arms: the same prompt, model, tool allowlist (Read, Grep, Glob, Bash), per-run budget cap $0.25 and timeout 420 s; run in a clean copy of the commit pinned in `benchmarks/xrepo-repos.json`.
- Questions: the task id(s) x046, x047, x048, x049, x050 of `benchmarks/tasks/retrieval-xrepo.jsonl`. Pass = hit@5 on the repository-relative paths the answer names.
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
- Direct Messages API agent (scripts/lib/agent-ab-api.mjs), not Claude Code: a short neutral system prompt (about 150 tokens) and four read-only tools, so the prefix each turn re-reads is far smaller than Claude Code's and SigMap's per-turn addition is a larger share of a turn. Cost is computed from the usage the API reports and a price table (the Console's usage page is the authority), with 5-minute prompt caching. Not comparable cell by cell with Claude Code runs.

## Outcome

| repo | tasks | pass without | pass with | failed runs (without / with) |
| --- | ---: | ---: | ---: | ---: |
| laravel | 5 | 10/10 | 9/10 | 0 / 0 |
| all | 5 | 10/10 | 9/10 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 5. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −25% | −17% | fewer in every repetition |
| Input tokens (uncached) | −10% | +23% | mixed |
| Output tokens | −13% | −5% | fewer in every repetition |
| Cache-read tokens | −58% | −11% | fewer in every repetition |
| Cache-write tokens | −44% | −20% | fewer in every repetition |
| Total tokens (derived) | −56% | −12% | fewer in every repetition |
| Cost | −42% | −13% | fewer in every repetition |
| Wall time | −9% | +8% | mixed |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −30% [−58%, +11%] † | −11% [−35%, +32%] † | fewer in every repetition, within the noise |
| Input tokens (uncached) | +17% [−38%, +121%] † | +72% [−20%, +197%] † | more in every repetition, within the noise |
| Output tokens | −18% [−47%, +28%] † | +1% [−24%, +36%] † | mixed |
| Cache-read tokens | −56% [−73%, −15%] | +3% [−51%, +97%] † | mixed |
| Cache-write tokens | −44% [−60%, −21%] | −19% [−50%, +30%] † | fewer in every repetition, within the noise |
| Total tokens (derived) | −53% [−69%, −18%] | −2% [−51%, +85%] † | fewer in every repetition, within the noise |
| Cost | −41% [−56%, −19%] | −11% [−45%, +42%] † | fewer in every repetition, within the noise |
| Wall time | −13% [−42%, +31%] † | +14% [−10%, +46%] † | mixed |

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
| laravel | 18 | 17 | −4 | 4 / 0 / 1 |
| all | 18 | 17 | −4 | 4 / 0 / 1 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | 2,499 | 3,279 | +787 | 2 / 0 / 3 |
| all | 2,499 | 3,279 | +787 | 2 / 0 / 3 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | 2,256 | 2,003 | −287 | 4 / 0 / 1 |
| all | 2,256 | 2,003 | −287 | 4 / 0 / 1 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | 196,611 | 141,828 | −67,333 | 4 / 0 / 1 |
| all | 196,611 | 141,828 | −67,333 | 4 / 0 / 1 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | 23,604 | 15,966 | −8,158 | 4 / 0 / 1 |
| all | 23,604 | 15,966 | −8,158 | 4 / 0 / 1 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | 223,112 | 159,849 | −73,135 | 4 / 0 / 1 |
| all | 223,112 | 159,849 | −73,135 | 4 / 0 / 1 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd), or computed from the API's usage and a price table when the run went through the Messages API directly. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | $0.0606 | $0.0445 | −$0.0162 | 4 / 0 / 1 |
| all | $0.0606 | $0.0445 | −$0.0162 | 4 / 0 / 1 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | 27.0 s | 26.3 s | −2.6 s | 4 / 0 / 1 |
| all | 27.0 s | 26.3 s | −2.6 s | 4 / 0 / 1 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| laravel | $0.6249 (10 runs) | $0.4469 (10 runs) | none | none |
| all | $0.6249 (10 runs) | $0.4469 (10 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| laravel/x046 | without | 2/2 | 24 [22–26] | 1,161 [1,150–1,171] | 2,442 [2,211–2,673] | 347,716 [247,951–447,481] | 26,357 [21,007–31,707] | $0.0811 [$0.0633–$0.0989] | 29.5 s [26.5 s–32.4 s] |
| laravel/x046 | with | 2/2 | 18 [17–18] | 3,279 [3,277–3,281] | 2,003 [1,979–2,026] | 180,372 [129,763–230,981] | 18,199 [12,834–23,564] | $0.0541 [$0.0424–$0.0657] | 26.5 s [25.6 s–27.5 s] |
| laravel/x047 | without | 2/2 | 13 [7–18] | 1,109 [1,075–1,143] | 1,497 [928–2,065] | 143,831 [53,657–234,005] | 23,604 [19,733–27,475] | $0.0525 [$0.0454–$0.0595] | 18.2 s [12.1 s–24.3 s] |
| laravel/x047 | with | 2/2 | 9 [5–12] | 3,232 [3,211–3,253] | 1,210 [817–1,603] | 76,498 [56,798–96,198] | 15,966 [12,948–18,984] | $0.0369 [$0.0367–$0.0371] | 15.5 s [10.7 s–20.4 s] |
| laravel/x048 | without | 2/2 | 21 [20–21] | 7,582 [7,566–7,598] | 2,256 [2,158–2,353] | 277,691 [210,462–344,919] | 27,260 [21,223–33,297] | $0.0807 [$0.0669–$0.0945] | 27.1 s [26.9 s–27.2 s] |
| laravel/x048 | with | 2/2 | 11 [11–11] | 3,247 [3,245–3,249] | 1,481 [1,395–1,567] | 77,522 [60,098–94,945] | 10,640 [8,485–12,795] | $0.0317 [$0.0268–$0.0366] | 22.9 s [16.8 s–29.0 s] |
| laravel/x049 | without | 2/2 | 18 [13–23] | 3,335 [2,356–4,313] | 2,319 [1,759–2,879] | 196,611 [182,514–210,708] | 20,848 [14,257–27,438] | $0.0606 [$0.0556–$0.0657] | 27.0 s [21.4 s–32.7 s] |
| laravel/x049 | with | 2/2 | 18 [17–18] | 3,281 [3,279–3,282] | 2,286 [2,133–2,439] | 141,828 [116,659–166,997] | 12,454 [10,942–13,966] | $0.0445 [$0.0408–$0.0481] | 26.3 s [25.0 s–27.7 s] |
| laravel/x050 | without | 2/2 | 16 [15–16] | 2,499 [1,104–3,893] | 1,572 [1,567–1,577] | 87,484 [75,876–99,092] | 14,732 [13,919–15,544] | $0.0375 [$0.0340–$0.0411] | 17.6 s [17.4 s–17.8 s] |
| laravel/x050 | with | 1/2 | 17 [16–18] | 3,286 [3,278–3,293] | 2,176 [1,948–2,404] | 186,179 [132,417–239,941] | 18,816 [13,260–24,371] | $0.0563 [$0.0451–$0.0675] | 27.0 s [25.1 s–29.0 s] |

