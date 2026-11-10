# Agent-level A/B — measured tool calls, tokens and cost

**claude-code 2.1.322 (Claude Code) · claude-haiku-4-5 · 2026-11-10 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap index strategy + 7-tool core MCP profile (the docs' setup for an agent that calls the tools).
- Both arms: the same prompt, model, tool allowlist (Read, Grep, Glob, Bash), per-run budget cap $1 and timeout 420 s; run in a clean copy of the commit pinned in `benchmarks/xrepo-repos.json`.
- Questions: the task id(s) x086, x087, x088 of `benchmarks/tasks/retrieval-xrepo.jsonl`. Pass = hit@5 on the repository-relative paths the answer names.
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
| rails | 3 | 6/6 | 6/6 | 0 / 0 |
| all | 3 | 6/6 | 6/6 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 3. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −20% | −40% | fewer in every repetition |
| Input tokens (uncached) | −22% | −34% | fewer in every repetition |
| Output tokens | −26% | −19% | fewer in every repetition |
| Cache-read tokens | −28% | −28% | fewer in every repetition |
| Cache-write tokens | −25% | −18% | fewer in every repetition |
| Total tokens (derived) | −28% | −27% | fewer in every repetition |
| Cost | −26% | −22% | fewer in every repetition |
| Wall time | −21% | −12% | fewer in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −17% [−52%, +40%] † | −52% [−67%, −23%] | fewer in every repetition, within the noise |
| Input tokens (uncached) | −20% [−60%, +48%] † | −39% [−53%, −22%] | fewer in every repetition, within the noise |
| Output tokens | −24% [−51%, 0%] | −24% [−39%, −12%] | fewer in every repetition, outside the noise |
| Cache-read tokens | −24% [−69%, +73%] † | −36% [−52%, −15%] | fewer in every repetition, within the noise |
| Cache-write tokens | −23% [−52%, +18%] † | −19% [−20%, −17%] | fewer in every repetition, within the noise |
| Total tokens (derived) | −23% [−67%, +67%] † | −34% [−49%, −15%] | fewer in every repetition, within the noise |
| Cost | −23% [−58%, +28%] † | −24% [−29%, −15%] | fewer in every repetition, within the noise |
| Wall time | −20% [−46%, +5%] † | −11% [−16%, +1%] † | fewer in every repetition, within the noise |

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
| rails | 13 | 8 | −5 | 2 / 1 / 0 |
| all | 13 | 8 | −5 | 2 / 1 / 0 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | 110 | 74 | −36 | 2 / 0 / 1 |
| all | 110 | 74 | −36 | 2 / 0 / 1 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | 2,658 | 2,313 | −346 | 3 / 0 / 0 |
| all | 2,658 | 2,313 | −346 | 3 / 0 / 0 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | 247,473 | 164,065 | −83,408 | 2 / 0 / 1 |
| all | 247,473 | 164,065 | −83,408 | 2 / 0 / 1 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | 17,220 | 14,166 | −3,054 | 2 / 0 / 1 |
| all | 17,220 | 14,166 | −3,054 | 2 / 0 / 1 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | 267,461 | 180,618 | −86,843 | 2 / 0 / 1 |
| all | 267,461 | 180,618 | −86,843 | 2 / 0 / 1 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | $0.0726 | $0.0564 | −$0.0162 | 2 / 0 / 1 |
| all | $0.0726 | $0.0564 | −$0.0162 | 2 / 0 / 1 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | 32.3 s | 30.4 s | −1.8 s | 3 / 0 / 0 |
| all | 32.3 s | 30.4 s | −1.8 s | 3 / 0 / 0 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| rails | $0.4669 (6 runs) | $0.3544 (6 runs) | none | none |
| all | $0.4669 (6 runs) | $0.3544 (6 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| rails/x086 | without | 2/2 | 8 [6–10] | 54 [42–66] | 2,048 [1,660–2,435] | 101,364 [69,335–133,393] | 12,278 [11,294–13,262] | $0.0450 [$0.0379–$0.0521] | 26.7 s [20.7 s–32.7 s] |
| rails/x086 | with | 2/2 | 8 [2–14] | 62 [26–98] | 1,723 [1,015–2,431] | 137,744 [44,725–230,762] | 12,351 [9,019–15,683] | $0.0472 [$0.0276–$0.0667] | 25.2 s [20.8 s–29.5 s] |
| rails/x087 | without | 2/2 | 22 [21–22] | 166 [146–186] | 4,553 [4,293–4,812] | 440,800 [404,591–477,008] | 24,428 [22,512–26,344] | $0.1159 [$0.1148–$0.1170] | 50.8 s [47.4 s–54.3 s] |
| rails/x087 | with | 2/2 | 14 [10–17] | 102 [58–146] | 3,164 [2,093–4,234] | 267,462 [127,389–407,535] | 15,509 [12,611–18,407] | $0.0737 [$0.0485–$0.0989] | 35.8 s [25.7 s–46.0 s] |
| rails/x088 | without | 2/2 | 13 [12–13] | 110 [106–114] | 2,658 [2,494–2,822] | 247,473 [230,123–264,822] | 17,220 [17,054–17,386] | $0.0726 [$0.0697–$0.0755] | 32.3 s [32.1 s–32.5 s] |
| rails/x088 | with | 2/2 | 8 [5–11] | 74 [50–98] | 2,313 [2,044–2,581] | 164,065 [110,646–217,484] | 14,166 [14,102–14,230] | $0.0564 [$0.0495–$0.0632] | 30.4 s [27.3 s–33.6 s] |

