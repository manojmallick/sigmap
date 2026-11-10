# Agent-level A/B — measured tool calls, tokens and cost

**claude-code 2.1.322 (Claude Code) · claude-haiku-4-5 · 2026-11-10 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap index strategy + 7-tool core MCP profile (the docs' setup for an agent that calls the tools).
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
| Tool calls | +14% | −11% | mixed |
| Input tokens (uncached) | +8% | −29% | mixed |
| Output tokens | +11% | −7% | mixed |
| Cache-read tokens | +5% | −28% | mixed |
| Cache-write tokens | −20% | −32% | fewer in every repetition |
| Total tokens (derived) | +3% | −28% | mixed |
| Cost | −8% | −26% | fewer in every repetition |
| Wall time | +2% | −9% | mixed |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | +11% [−40%, +73%] † | −12% [−20%, −7%] | mixed |
| Input tokens (uncached) | +3% [−49%, +65%] † | −30% [−36%, −25%] | mixed |
| Output tokens | +10% [−27%, +35%] † | −7% [−20%, +22%] † | mixed |
| Cache-read tokens | −2% [−54%, +50%] † | −30% [−52%, −7%] | fewer in every repetition, within the noise |
| Cache-write tokens | −24% [−35%, 0%] | −26% [−60%, +32%] † | fewer in every repetition, within the noise |
| Total tokens (derived) | −1% [−50%, +43%] † | −30% [−52%, −6%] | fewer in every repetition, within the noise |
| Cost | −7% [−21%, +2%] † | −26% [−53%, +4%] † | fewer in every repetition, within the noise |
| Wall time | +3% [−34%, +31%] † | −10% [−18%, −1%] | mixed |

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
| gin | 13 | 10 | +1 | 1 / 0 / 2 |
| all | 13 | 10 | +1 | 1 / 0 / 2 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 114 | 82 | −4 | 2 / 0 / 1 |
| all | 114 | 82 | −4 | 2 / 0 / 1 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 2,647 | 2,515 | +87 | 1 / 0 / 2 |
| all | 2,647 | 2,515 | +87 | 1 / 0 / 2 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 253,581 | 175,056 | −32,714 | 2 / 0 / 1 |
| all | 253,581 | 175,056 | −32,714 | 2 / 0 / 1 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 20,661 | 15,121 | −2,141 | 3 / 0 / 0 |
| all | 20,661 | 15,121 | −2,141 | 3 / 0 / 0 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 273,878 | 189,062 | −44,668 | 2 / 0 / 1 |
| all | 273,878 | 189,062 | −44,668 | 2 / 0 / 1 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | $0.0788 | $0.0651 | −$0.0150 | 2 / 0 / 1 |
| all | $0.0788 | $0.0651 | −$0.0150 | 2 / 0 / 1 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 33.0 s | 28.8 s | +927 ms | 1 / 0 / 2 |
| all | 33.0 s | 28.8 s | +927 ms | 1 / 0 / 2 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| gin | $0.4670 (6 runs) | $0.3874 (6 runs) | none | none |
| all | $0.4670 (6 runs) | $0.3874 (6 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| gin/x003 | without | 2/2 | 14 [12–15] | 118 [106–130] | 2,647 [2,332–2,962] | 254,253 [223,847–284,659] | 20,661 [16,222–25,099] | $0.0801 [$0.0666–$0.0936] | 35.7 s [32.0 s–39.4 s] |
| gin/x003 | with | 2/2 | 10 [9–11] | 70 [66–74] | 2,515 [2,174–2,855] | 150,642 [129,850–171,433] | 18,717 [12,411–25,023] | $0.0651 [$0.0563–$0.0740] | 28.8 s [26.0 s–31.7 s] |
| gin/x004 | without | 2/2 | 10 [9–10] | 86 [82–90] | 2,057 [1,815–2,298] | 207,770 [163,553–251,986] | 23,817 [16,045–31,589] | $0.0788 [$0.0576–$0.1000] | 25.5 s [22.5 s–28.5 s] |
| gin/x004 | with | 2/2 | 10 [8–12] | 82 [58–106] | 2,143 [1,828–2,458] | 175,056 [122,005–228,107] | 11,781 [10,951–12,610] | $0.0519 [$0.0466–$0.0571] | 26.4 s [23.3 s–29.5 s] |
| gin/x005 | without | 2/2 | 13 [11–15] | 114 [98–130] | 2,922 [2,627–3,216] | 253,581 [249,848–257,313] | 17,262 [11,552–22,971] | $0.0746 [$0.0643–$0.0849] | 33.0 s [32.4 s–33.5 s] |
| gin/x005 | with | 2/2 | 17 [14–19] | 130 [98–162] | 3,091 [2,631–3,550] | 308,711 [231,346–386,075] | 15,121 [15,017–15,224] | $0.0767 [$0.0668–$0.0866] | 35.5 s [30.1 s–40.9 s] |

