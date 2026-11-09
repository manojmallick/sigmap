# Agent-level A/B — measured tool calls, tokens and cost

**claude-code 2.1.321 (Claude Code) · claude-haiku-5-5 · 2026-11-09 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap generated context + MCP server.
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

## Outcome

| repo | tasks | pass without | pass with | failed runs (without / with) |
| --- | ---: | ---: | ---: | ---: |
| gin | 5 | 10/10 | 10/10 | 0 / 0 |
| all | 5 | 10/10 | 10/10 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 5. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −19% | +6% | mixed |
| Input tokens (uncached) | −12% | 0% | mixed |
| Output tokens | −7% | +31% | mixed |
| Cache-read tokens | +41% | +75% | more in every repetition |
| Cache-write tokens | +24% | +6% | more in every repetition |
| Total tokens (derived) | +36% | +61% | more in every repetition |
| Cost | +19% | +21% | more in every repetition |
| Wall time | −3% | +11% | mixed |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −10% [−45%, +48%] † | +15% [0%, +52%] † | mixed |
| Input tokens (uncached) | −10% [−28%, +18%] † | −1% [−16%, +14%] † | fewer in every repetition, within the noise |
| Output tokens | −4% [−17%, +11%] † | +25% [+6%, +57%] | mixed |
| Cache-read tokens | +47% [+17%, +114%] | +75% [+41%, +100%] | more in every repetition, outside the noise |
| Cache-write tokens | +11% [−22%, +94%] † | +3% [−17%, +24%] † | more in every repetition, within the noise |
| Total tokens (derived) | +41% [+10%, +91%] | +59% [+31%, +83%] | more in every repetition, outside the noise |
| Cost | +14% [−14%, +72%] † | +17% [0%, +36%] † | more in every repetition, within the noise |
| Wall time | −3% [−16%, +18%] † | +8% [−3%, +25%] † | mixed |

### Outcome (hit@5), by repetition

Per paired task: **better** = the SigMap arm named the file and the other did not; **worse** = the reverse; **tie** = both found it or both missed. Localisation only.

| repetition | paired tasks | better | worse | tie |
| --- | ---: | ---: | ---: | ---: |
| R1 | 5 | 0 | 0 | 5 |
| R2 | 5 | 0 | 0 | 5 |
| all | 10 | 0 | 0 | 10 |

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
| gin | 6 | 6 | 0 | 2 / 3 / 0 |
| all | 6 | 6 | 0 | 2 / 3 / 0 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 905 | 1,039 | +134 | 2 / 0 / 3 |
| all | 905 | 1,039 | +134 | 2 / 0 / 3 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 29,601 | 49,600 | +15,949 | 0 / 0 / 5 |
| all | 29,601 | 49,600 | +15,949 | 0 / 0 / 5 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 6,789 | 6,949 | +161 | 2 / 0 / 3 |
| all | 6,789 | 6,949 | +161 | 2 / 0 / 3 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 37,237 | 55,929 | +18,692 | 0 / 0 / 5 |
| all | 37,237 | 55,929 | +18,692 | 0 / 0 / 5 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | $0.0022 | $0.0023 | +$0.0001 | 2 / 0 / 3 |
| all | $0.0022 | $0.0023 | +$0.0001 | 2 / 0 / 3 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 11.3 s | 10.8 s | −177 ms | 3 / 0 / 2 |
| all | 11.3 s | 10.8 s | −177 ms | 3 / 0 / 2 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| gin | $0.0240 (10 runs) | $0.0287 (10 runs) | none | none |
| all | $0.0240 (10 runs) | $0.0287 (10 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| gin/x001 | without | 2/2 | 2 [1–2] | 5 [4–6] | 860 [754–965] | 21,569 [16,788–26,349] | 6,536 [5,917–7,154] | $0.0020 [$0.0019–$0.0020] | 10.5 s [9.2 s–11.9 s] |
| gin/x001 | with | 2/2 | 3 [2–3] | 5 [4–6] | 993 [894–1,092] | 33,760 [32,042–35,478] | 13,540 [7,341–19,739] | $0.0035 [$0.0022–$0.0048] | 10.4 s [9.2 s–11.5 s] |
| gin/x002 | without | 2/2 | 2 [1–3] | 6 [4–8] | 905 [784–1,025] | 29,601 [16,144–43,057] | 6,726 [6,673–6,778] | $0.0021 [$0.0019–$0.0023] | 10.5 s [8.6 s–12.5 s] |
| gin/x002 | with | 2/2 | 3 [2–3] | 6 [6–6] | 1,039 [953–1,125] | 49,600 [49,261–49,938] | 5,284 [4,600–5,968] | $0.0021 [$0.0020–$0.0022] | 11.8 s [11.6 s–12.1 s] |
| gin/x003 | without | 2/2 | 3 [2–4] | 7 [6–8] | 871 [760–981] | 34,209 [27,517–40,900] | 7,339 [6,746–7,931] | $0.0022 [$0.0020–$0.0025] | 11.3 s [10.8 s–11.9 s] |
| gin/x003 | with | 2/2 | 2 [2–2] | 6 [6–6] | 865 [812–918] | 50,158 [49,707–50,608] | 6,341 [5,714–6,968] | $0.0022 [$0.0020–$0.0024] | 10.8 s [10.1 s–11.5 s] |
| gin/x004 | without | 2/2 | 5 [5–5] | 9 [8–10] | 1,779 [1,257–2,300] | 52,973 [46,548–59,398] | 10,197 [10,185–10,209] | $0.0035 [$0.0031–$0.0038] | 15.8 s [14.0 s–17.7 s] |
| gin/x004 | with | 2/2 | 5 [4–5] | 9 [8–10] | 2,208 [1,980–2,436] | 86,303 [75,056–97,550] | 11,162 [10,406–11,918] | $0.0042 [$0.0038–$0.0046] | 18.4 s [17.0 s–19.8 s] |
| gin/x005 | without | 2/2 | 5 [4–5] | 6 [6–6] | 1,201 [1,149–1,252] | 28,088 [27,730–28,445] | 6,789 [5,815–7,762] | $0.0022 [$0.0020–$0.0025] | 11.7 s [10.7 s–12.7 s] |
| gin/x005 | with | 2/2 | 4 [2–5] | 5 [4–6] | 1,076 [1,022–1,129] | 42,025 [31,360–52,689] | 6,949 [6,077–7,821] | $0.0023 [$0.0020–$0.0027] | 10.5 s [9.8 s–11.2 s] |

