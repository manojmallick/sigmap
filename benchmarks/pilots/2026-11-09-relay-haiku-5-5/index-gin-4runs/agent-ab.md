# Agent-level A/B — measured tool calls, tokens and cost

**claude-code 2.1.319 (Claude Code) · claude-haiku-5.5 · 2026-11-09 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap index strategy + 7-tool core MCP profile (the docs' setup for an agent that calls the tools).
- Both arms: the same prompt, model, tool allowlist (Read, Grep, Glob, Bash), per-run budget cap $0.3 and timeout 420 s; run in a clean copy of the commit pinned in `benchmarks/xrepo-repos.json`.
- Questions: first 1 task(s) by id per repo of `benchmarks/tasks/retrieval-xrepo.jsonl`. Pass = hit@5 on the repository-relative paths the answer names.
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

## Outcome

| repo | tasks | pass without | pass with | failed runs (without / with) |
| --- | ---: | ---: | ---: | ---: |
| gin | 1 | 2/2 | 2/2 | 0 / 0 |
| all | 1 | 2/2 | 2/2 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 1. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −14% | −71% | fewer in every repetition |
| Input tokens (uncached) | −34% | −7% | fewer in every repetition |
| Output tokens | −74% | −45% | fewer in every repetition |
| Cache-read tokens | −11% | +14% | mixed |
| Total tokens (derived) | −30% | −1% | fewer in every repetition |
| Cost | −38% | −11% | fewer in every repetition |
| Wall time | −15% | −27% | fewer in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −14% | −71% | fewer in every repetition, within the noise |
| Input tokens (uncached) | −34% | −7% | fewer in every repetition, within the noise |
| Output tokens | −74% | −45% | fewer in every repetition, within the noise |
| Cache-read tokens | −11% | +14% | mixed |
| Total tokens (derived) | −30% | −1% | fewer in every repetition, within the noise |
| Cost | −38% | −11% | fewer in every repetition, within the noise |
| Wall time | −15% | −27% | fewer in every repetition, within the noise |

### Outcome (hit@5), by repetition

Per paired task: **better** = the SigMap arm named the file and the other did not; **worse** = the reverse; **tie** = both found it or both missed. Localisation only.

| repetition | paired tasks | better | worse | tie |
| --- | ---: | ---: | ---: | ---: |
| R1 | 1 | 0 | 0 | 1 |
| R2 | 1 | 0 | 0 | 1 |
| all | 2 | 0 | 0 | 2 |

## Tool calls

Provenance: agent-reported (main-thread tool_use blocks). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 7 | 4 | −3 | 1 / 0 / 0 |
| all | 7 | 4 | −3 | 1 / 0 / 0 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 18,905 | 14,494 | −4,411 | 1 / 0 / 0 |
| all | 18,905 | 14,494 | −4,411 | 1 / 0 / 0 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 596 | 220 | −376 | 1 / 0 / 0 |
| all | 596 | 220 | −376 | 1 / 0 / 0 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 6,442 | 6,509 | +67 | 0 / 0 / 1 |
| all | 6,442 | 6,509 | +67 | 0 / 0 / 1 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 0 | 0 | 0 | 0 / 1 / 0 |
| all | 0 | 0 | 0 | 0 / 1 / 0 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 25,942 | 21,222 | −4,720 | 1 / 0 / 0 |
| all | 25,942 | 21,222 | −4,720 | 1 / 0 / 0 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | $0.0023 | $0.0016 | −$0.0006 | 1 / 0 / 0 |
| all | $0.0023 | $0.0016 | −$0.0006 | 1 / 0 / 0 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 39.6 s | 31.5 s | −8.1 s | 1 / 0 / 0 |
| all | 39.6 s | 31.5 s | −8.1 s | 1 / 0 / 0 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| gin | $0.0045 (2 runs) | $0.0032 (2 runs) | none | none |
| all | $0.0045 (2 runs) | $0.0032 (2 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| gin/x001 | without | 2/2 | 7 [7–7] | 18,905 [14,382–23,427] | 596 [459–732] | 6,442 [6,290–6,593] | 0 [0–0] | $0.0023 [$0.0017–$0.0028] | 39.6 s [36.0 s–43.2 s] |
| gin/x001 | with | 2/2 | 4 [2–6] | 14,494 [13,423–15,565] | 220 [188–251] | 6,509 [5,871–7,146] | 0 [0–0] | $0.0016 [$0.0015–$0.0017] | 31.5 s [26.2 s–36.8 s] |

