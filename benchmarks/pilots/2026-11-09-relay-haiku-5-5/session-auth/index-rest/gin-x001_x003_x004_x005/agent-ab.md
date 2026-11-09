# Agent-level A/B — measured tool calls, tokens and cost

**claude-code 2.1.319 (Claude Code) · claude-haiku-5-5 · 2026-11-09 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap index strategy + 7-tool core MCP profile (the docs' setup for an agent that calls the tools).
- Both arms: the same prompt, model, tool allowlist (Read, Grep, Glob, Bash), per-run budget cap $0.5 and timeout 420 s; run in a clean copy of the commit pinned in `benchmarks/xrepo-repos.json`.
- Questions: the task id(s) x001, x003, x004, x005 of `benchmarks/tasks/retrieval-xrepo.jsonl`. Pass = hit@5 on the repository-relative paths the answer names.
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
| gin | 4 | 8/8 | 8/8 | 0 / 0 |
| all | 4 | 8/8 | 8/8 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 4. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | 0% | 0% | unchanged |
| Input tokens (uncached) | 0% | −7% | mixed |
| Output tokens | −6% | −26% | fewer in every repetition |
| Cache-read tokens | +25% | +29% | more in every repetition |
| Cache-write tokens | −1% | +10% | mixed |
| Total tokens (derived) | +19% | +24% | more in every repetition |
| Cost | +1% | +4% | more in every repetition |
| Wall time | −1% | −7% | fewer in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | 0% [0%, 0%] † | −4% [−41%, +47%] † | mixed |
| Input tokens (uncached) | 0% [0%, 0%] † | −7% [−19%, 0%] † | mixed |
| Output tokens | −6% [−14%, +14%] † | −18% [−40%, +16%] † | fewer in every repetition, within the noise |
| Cache-read tokens | +28% [+19%, +36%] | +25% [−4%, +50%] † | more in every repetition, within the noise |
| Cache-write tokens | +2% [−17%, +24%] † | −1% [−36%, +53%] † | mixed |
| Total tokens (derived) | +22% [+13%, +32%] | +18% [−7%, +47%] † | more in every repetition, within the noise |
| Cost | +4% [−7%, +16%] † | −2% [−28%, +33%] † | mixed |
| Wall time | −1% [−8%, +8%] † | −3% [−19%, +12%] † | fewer in every repetition, within the noise |

### Outcome (hit@5), by repetition

Per paired task: **better** = the SigMap arm named the file and the other did not; **worse** = the reverse; **tie** = both found it or both missed. Localisation only.

| repetition | paired tasks | better | worse | tie |
| --- | ---: | ---: | ---: | ---: |
| R1 | 4 | 0 | 0 | 4 |
| R2 | 4 | 0 | 0 | 4 |
| all | 8 | 0 | 0 | 8 |

## Tool calls

Provenance: agent-reported (main-thread tool_use blocks). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 4 | 4 | 0 | 1 / 2 / 1 |
| all | 4 | 4 | 0 | 1 / 2 / 1 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 7 | 6 | 0 | 1 / 3 / 0 |
| all | 7 | 6 | 0 | 1 / 3 / 0 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 978 | 984 | −72 | 3 / 0 / 1 |
| all | 978 | 984 | −72 | 3 / 0 / 1 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 30,773 | 36,263 | +8,901 | 0 / 0 / 4 |
| all | 30,773 | 36,263 | +8,901 | 0 / 0 / 4 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 7,318 | 7,226 | +494 | 2 / 0 / 2 |
| all | 7,318 | 7,226 | +494 | 2 / 0 / 2 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 38,740 | 44,383 | +9,808 | 1 / 0 / 3 |
| all | 38,740 | 44,383 | +9,808 | 1 / 0 / 3 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | $0.0022 | $0.0023 | +$0.0000 | 2 / 0 / 2 |
| all | $0.0022 | $0.0023 | +$0.0000 | 2 / 0 / 2 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 11.4 s | 11.8 s | +278 ms | 1 / 0 / 3 |
| all | 11.4 s | 11.8 s | +278 ms | 1 / 0 / 3 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| gin | $0.0202 (8 runs) | $0.0207 (8 runs) | none | none |
| all | $0.0202 (8 runs) | $0.0207 (8 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| gin/x001 | without | 2/2 | 2 [1–2] | 5 [4–6] | 911 [719–1,103] | 22,142 [16,622–27,662] | 6,625 [6,514–6,736] | $0.0020 [$0.0019–$0.0021] | 10.1 s [8.7 s–11.6 s] |
| gin/x001 | with | 2/2 | 2 [1–2] | 5 [4–6] | 803 [657–949] | 29,677 [22,018–37,335] | 6,017 [4,362–7,672] | $0.0019 [$0.0014–$0.0024] | 10.3 s [9.0 s–11.6 s] |
| gin/x003 | without | 2/2 | 4 [3–4] | 7 [6–8] | 1,037 [966–1,107] | 34,379 [27,201–41,556] | 8,012 [8,003–8,020] | $0.0025 [$0.0024–$0.0026] | 12.4 s [11.1 s–13.7 s] |
| gin/x003 | with | 2/2 | 3 [2–3] | 6 [6–6] | 1,000 [797–1,203] | 35,092 [34,871–35,312] | 5,825 [5,128–6,522] | $0.0020 [$0.0018–$0.0023] | 12.8 s [12.6 s–13.0 s] |
| gin/x004 | without | 2/2 | 5 [5–5] | 10 [10–10] | 1,965 [1,577–2,352] | 59,171 [54,592–63,750] | 10,756 [9,401–12,111] | $0.0037 [$0.0036–$0.0038] | 18.3 s [16.7 s–19.9 s] |
| gin/x004 | with | 2/2 | 5 [5–5] | 10 [10–10] | 1,287 [1,215–1,358] | 79,057 [72,602–85,511] | 12,351 [10,227–14,475] | $0.0039 [$0.0035–$0.0044] | 15.2 s [14.9 s–15.5 s] |
| gin/x005 | without | 2/2 | 4 [3–5] | 6 [6–6] | 920 [706–1,134] | 27,167 [26,490–27,843] | 5,953 [5,860–6,046] | $0.0019 [$0.0018–$0.0020] | 10.4 s [9.8 s–11.0 s] |
| gin/x005 | with | 2/2 | 5 [5–5] | 6 [6–6] | 968 [957–979] | 37,434 [36,161–38,707] | 8,435 [7,954–8,916] | $0.0025 [$0.0024–$0.0026] | 10.8 s [10.0 s–11.5 s] |

