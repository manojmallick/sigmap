# Agent-level A/B — measured tool calls, tokens and cost

**claude-code 2.1.321 (Claude Code) · claude-haiku-4-5 · 2026-11-10 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap generated context + MCP server.
- Both arms: the same prompt, model, tool allowlist (Read, Grep, Glob, Bash), per-run budget cap $1 and timeout 420 s; run in a clean copy of the commit pinned in `benchmarks/xrepo-repos.json`.
- Questions: the task id(s) x027, x028 of `benchmarks/tasks/retrieval-xrepo.jsonl`. Pass = hit@5 on the repository-relative paths the answer names.
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
| django | 2 | 4/4 | 4/4 | 0 / 0 |
| all | 2 | 4/4 | 4/4 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 2. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −24% | +38% | mixed |
| Input tokens (uncached) | −47% | +9% | mixed |
| Output tokens | −36% | +8% | mixed |
| Cache-read tokens | −39% | +48% | mixed |
| Cache-write tokens | −23% | −16% | fewer in every repetition |
| Total tokens (derived) | −39% | +43% | mixed |
| Cost | −32% | +8% | mixed |
| Wall time | −32% | +6% | mixed |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −25% [−29%, −22%] | +27% [0%, +62%] † | mixed |
| Input tokens (uncached) | −43% [−50%, −36%] | +7% [0%, +14%] † | mixed |
| Output tokens | −34% [−38%, −30%] | +7% [+1%, +13%] | mixed |
| Cache-read tokens | −34% [−43%, −24%] | +44% [+34%, +54%] | mixed |
| Cache-write tokens | −29% [−51%, +3%] † | −18% [−27%, −9%] | fewer in every repetition, within the noise |
| Total tokens (derived) | −35% [−41%, −28%] | +39% [+29%, +49%] | mixed |
| Cost | −35% [−42%, −28%] | +5% [−4%, +16%] † | mixed |
| Wall time | −31% [−33%, −29%] | +5% [−3%, +12%] † | mixed |

### Outcome (hit@5), by repetition

Per paired task: **better** = the SigMap arm named the file and the other did not; **worse** = the reverse; **tie** = both found it or both missed. Localisation only.

| repetition | paired tasks | better | worse | tie |
| --- | ---: | ---: | ---: | ---: |
| R1 | 2 | 0 | 0 | 2 |
| R2 | 2 | 0 | 0 | 2 |
| all | 4 | 0 | 0 | 4 |

## Tool calls

Provenance: agent-reported (main-thread tool_use blocks). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | 14 | 14 | 0 | 1 / 0 / 1 |
| all | 14 | 14 | 0 | 1 / 0 / 1 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | 120 | 90 | −30 | 2 / 0 / 0 |
| all | 120 | 90 | −30 | 2 / 0 / 0 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | 3,024 | 2,455 | −569 | 2 / 0 / 0 |
| all | 3,024 | 2,455 | −569 | 2 / 0 / 0 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | 263,196 | 241,496 | −21,700 | 1 / 0 / 1 |
| all | 263,196 | 241,496 | −21,700 | 1 / 0 / 1 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | 16,697 | 13,435 | −3,262 | 2 / 0 / 0 |
| all | 16,697 | 13,435 | −3,262 | 2 / 0 / 0 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | 283,037 | 257,477 | −25,561 | 1 / 0 / 1 |
| all | 283,037 | 257,477 | −25,561 | 1 / 0 / 1 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | $0.0750 | $0.0634 | −$0.0116 | 2 / 0 / 0 |
| all | $0.0750 | $0.0634 | −$0.0116 | 2 / 0 / 0 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | 33.9 s | 28.2 s | −5.7 s | 2 / 0 / 0 |
| all | 33.9 s | 28.2 s | −5.7 s | 2 / 0 / 0 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| django | $0.2998 (4 runs) | $0.2535 (4 runs) | none | none |
| all | $0.2998 (4 runs) | $0.2535 (4 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| django/x027 | without | 2/2 | 20 [13–27] | 170 [114–226] | 4,204 [2,849–5,558] | 405,069 [253,510–556,628] | 19,100 [18,618–19,582] | $0.0999 [$0.0789–$0.1209] | 44.8 s [31.6 s–58.0 s] |
| django/x027 | with | 2/2 | 21 [21–21] | 122 [114–130] | 3,336 [3,216–3,456] | 355,042 [318,808–391,275] | 18,498 [17,896–19,099] | $0.0893 [$0.0875–$0.0911] | 37.1 s [35.5 s–38.7 s] |
| django/x028 | without | 2/2 | 8 [7–8] | 70 [66–74] | 1,844 [1,842–1,846] | 121,324 [119,679–122,968] | 14,295 [11,678–16,911] | $0.0500 [$0.0449–$0.0551] | 22.9 s [22.3 s–23.5 s] |
| django/x028 | with | 2/2 | 7 [5–8] | 58 [42–74] | 1,574 [1,286–1,862] | 127,951 [90,695–165,207] | 8,373 [8,232–8,514] | $0.0375 [$0.0320–$0.0429] | 19.2 s [16.8 s–21.7 s] |

