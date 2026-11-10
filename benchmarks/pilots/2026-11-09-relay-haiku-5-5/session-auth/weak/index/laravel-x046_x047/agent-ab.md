# Agent-level A/B — measured tool calls, tokens and cost

**claude-code 2.1.321 (Claude Code) · claude-haiku-4-5 · 2026-11-10 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap index strategy + 7-tool core MCP profile (the docs' setup for an agent that calls the tools).
- Both arms: the same prompt, model, tool allowlist (Read, Grep, Glob, Bash), per-run budget cap $1 and timeout 420 s; run in a clean copy of the commit pinned in `benchmarks/xrepo-repos.json`.
- Questions: the task id(s) x046, x047 of `benchmarks/tasks/retrieval-xrepo.jsonl`. Pass = hit@5 on the repository-relative paths the answer names.
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
| laravel | 2 | 3/4 | 4/4 | 1 / 0 |
| all | 2 | 3/4 | 4/4 | 1 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 2. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −60% | −76% n=1 | fewer in every repetition |
| Input tokens (uncached) | −51% | −77% n=1 | fewer in every repetition |
| Output tokens | −50% | −56% n=1 | fewer in every repetition |
| Cache-read tokens | −62% | −81% n=1 | fewer in every repetition |
| Cache-write tokens | −58% | −65% n=1 | fewer in every repetition |
| Total tokens (derived) | −61% | −80% n=1 | fewer in every repetition |
| Cost | −58% | −70% n=1 | fewer in every repetition |
| Wall time | −43% | −53% n=1 | fewer in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −65% [−77%, −47%] | −76% n=1 | fewer in every repetition, within the noise |
| Input tokens (uncached) | −55% [−68%, −37%] | −77% n=1 | fewer in every repetition, within the noise |
| Output tokens | −54% [−65%, −40%] | −56% n=1 | fewer in every repetition, within the noise |
| Cache-read tokens | −65% [−73%, −55%] | −81% n=1 | fewer in every repetition, within the noise |
| Cache-write tokens | −55% [−69%, −35%] | −65% n=1 | fewer in every repetition, within the noise |
| Total tokens (derived) | −64% [−71%, −56%] | −80% n=1 | fewer in every repetition, within the noise |
| Cost | −57% [−60%, −54%] | −70% n=1 | fewer in every repetition, within the noise |
| Wall time | −44% [−49%, −38%] | −53% n=1 | fewer in every repetition, within the noise |

### Outcome (hit@5), by repetition

Per paired task: **better** = the SigMap arm named the file and the other did not; **worse** = the reverse; **tie** = both found it or both missed. Localisation only.

| repetition | paired tasks | better | worse | tie |
| --- | ---: | ---: | ---: | ---: |
| R1 | 2 | 0 | 0 | 2 |
| R2 | 1 | 0 | 0 | 1 |
| all | 3 | 0 | 0 | 3 |

## Tool calls

Provenance: agent-reported (main-thread tool_use blocks). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | 16 | 8 | −9 | 2 / 0 / 0 |
| all | 16 | 8 | −9 | 2 / 0 / 0 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | 128 | 68 | −60 | 2 / 0 / 0 |
| all | 128 | 68 | −60 | 2 / 0 / 0 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | 3,123 | 1,816 | −1,308 | 2 / 0 / 0 |
| all | 3,123 | 1,816 | −1,308 | 2 / 0 / 0 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | 312,697 | 147,488 | −165,209 | 2 / 0 / 0 |
| all | 312,697 | 147,488 | −165,209 | 2 / 0 / 0 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | 22,142 | 10,136 | −12,005 | 2 / 0 / 0 |
| all | 22,142 | 10,136 | −12,005 | 2 / 0 / 0 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | 338,089 | 159,508 | −178,581 | 2 / 0 / 0 |
| all | 338,089 | 159,508 | −178,581 | 2 / 0 / 0 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | $0.0913 | $0.0442 | −$0.0471 | 2 / 0 / 0 |
| all | $0.0913 | $0.0442 | −$0.0471 | 2 / 0 / 0 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | 36.2 s | 23.0 s | −13.2 s | 2 / 0 / 0 |
| all | 36.2 s | 23.0 s | −13.2 s | 2 / 0 / 0 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| laravel | $0.2518 (4 runs) | $0.1767 (4 runs) | $0.0000 (1 run) | none |
| all | $0.2518 (4 runs) | $0.1767 (4 runs) | $0.0000 (1 run) | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| laravel/x046 | without | 2/2 | 15 [13–17] | 126 [106–146] | 2,616 [2,528–2,704] | 253,551 [204,459–302,642] | 15,303 [13,380–17,226] | $0.0692 [$0.0600–$0.0784] | 32.8 s [31.8 s–33.8 s] |
| laravel/x046 | with | 2/2 | 4 [3–4] | 34 [34–34] | 1,036 [874–1,198] | 55,789 [54,872–56,705] | 7,427 [6,100–8,753] | $0.0256 [$0.0239–$0.0274] | 16.0 s [15.7 s–16.3 s] |
| laravel/x047 | without | 1/2 | 17 [17–17] n=1 | 130 [130–130] n=1 | 3,630 [3,630–3,630] n=1 | 371,843 [371,843–371,843] n=1 | 28,980 [28,980–28,980] n=1 | $0.1134 [$0.1134–$0.1134] n=1 | 39.6 s [39.6 s–39.6 s] n=1 |
| laravel/x047 | with | 2/2 | 12 [9–14] | 102 [82–122] | 2,595 [2,181–3,009] | 239,188 [166,133–312,243] | 12,846 [9,028–16,664] | $0.0627 [$0.0457–$0.0797] | 30.0 s [24.7 s–35.3 s] |

