# Agent-level A/B — measured tool calls, tokens and cost

**claude-code 2.1.322 (Claude Code) · claude-haiku-5-5 · 2026-11-11 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap index strategy + 7-tool core MCP profile (the docs' setup for an agent that calls the tools).
- Both arms: the same prompt, model, tool allowlist (Read, Grep, Glob, Bash), per-run budget cap $0.6 and timeout 420 s; run in a clean copy of the commit pinned in `benchmarks/xrepo-repos.json`.
- Questions: the task id(s) h009, h010, h011, h012, h013, h014, h015 of `benchmarks/tasks/retrieval-xrepo.jsonl`. Pass = hit@5 on the repository-relative paths the answer names.
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
| sigmap-src | 7 | 14/14 | 14/14 | 0 / 0 |
| all | 7 | 14/14 | 14/14 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 7. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −65% | −68% | fewer in every repetition |
| Input tokens (uncached) | −41% | −38% | fewer in every repetition |
| Output tokens | −49% | −54% | fewer in every repetition |
| Cache-read tokens | −40% | −37% | fewer in every repetition |
| Cache-write tokens | −40% | −37% | fewer in every repetition |
| Total tokens (derived) | −41% | −37% | fewer in every repetition |
| Cost | −42% | −41% | fewer in every repetition |
| Wall time | −24% | −27% | fewer in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −65% [−77%, −49%] | −67% [−79%, −45%] | fewer in every repetition, outside the noise |
| Input tokens (uncached) | −42% [−54%, −29%] | −37% [−50%, −23%] | fewer in every repetition, outside the noise |
| Output tokens | −47% [−60%, −35%] | −53% [−65%, −36%] | fewer in every repetition, outside the noise |
| Cache-read tokens | −41% [−56%, −25%] | −35% [−53%, −9%] | fewer in every repetition, outside the noise |
| Cache-write tokens | −39% [−51%, −24%] | −35% [−50%, −14%] | fewer in every repetition, outside the noise |
| Total tokens (derived) | −41% [−55%, −27%] | −36% [−53%, −11%] | fewer in every repetition, outside the noise |
| Cost | −41% [−53%, −30%] | −39% [−53%, −20%] | fewer in every repetition, outside the noise |
| Wall time | −23% [−33%, −14%] | −27% [−36%, −17%] | fewer in every repetition, outside the noise |

### Outcome (hit@5), by repetition

Per paired task: **better** = the SigMap arm named the file and the other did not; **worse** = the reverse; **tie** = both found it or both missed. Localisation only.

| repetition | paired tasks | better | worse | tie |
| --- | ---: | ---: | ---: | ---: |
| R1 | 7 | 0 | 0 | 7 |
| R2 | 7 | 0 | 0 | 7 |
| all | 14 | 0 | 0 | 14 |

## Tool calls

Provenance: agent-reported (main-thread tool_use blocks). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 5 | 2 | −3 | 7 / 0 / 0 |
| all | 5 | 2 | −3 | 7 / 0 / 0 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 8 | 5 | −3 | 7 / 0 / 0 |
| all | 8 | 5 | −3 | 7 / 0 / 0 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 1,310 | 607 | −614 | 7 / 0 / 0 |
| all | 1,310 | 607 | −614 | 7 / 0 / 0 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 41,821 | 28,238 | −12,319 | 7 / 0 / 0 |
| all | 41,821 | 28,238 | −12,319 | 7 / 0 / 0 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 8,790 | 5,677 | −2,958 | 7 / 0 / 0 |
| all | 8,790 | 5,677 | −2,958 | 7 / 0 / 0 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 51,928 | 34,655 | −13,876 | 7 / 0 / 0 |
| all | 51,928 | 34,655 | −13,876 | 7 / 0 / 0 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | $0.0028 | $0.0017 | −$0.0012 | 7 / 0 / 0 |
| all | $0.0028 | $0.0017 | −$0.0012 | 7 / 0 / 0 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 11.9 s | 9.6 s | −2.2 s | 7 / 0 / 0 |
| all | 11.9 s | 9.6 s | −2.2 s | 7 / 0 / 0 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | $0.0431 (14 runs) | $0.0251 (14 runs) | none | none |
| all | $0.0431 (14 runs) | $0.0251 (14 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| sigmap-src/h009 | without | 2/2 | 4 [3–4] | 8 [8–8] | 1,272 [1,253–1,291] | 40,581 [40,266–40,896] | 7,102 [5,855–8,348] | $0.0025 [$0.0022–$0.0027] | 12.3 s [12.2 s–12.4 s] |
| sigmap-src/h009 | with | 2/2 | 2 [1–2] | 5 [4–6] | 658 [655–661] | 28,262 [20,831–35,693] | 6,162 [5,494–6,830] | $0.0018 [$0.0016–$0.0021] | 9.7 s [9.6 s–9.7 s] |
| sigmap-src/h010 | without | 2/2 | 5 [4–5] | 9 [8–10] | 1,333 [1,275–1,390] | 55,115 [46,321–63,909] | 11,412 [10,366–12,457] | $0.0035 [$0.0032–$0.0038] | 12.4 s [11.8 s–13.1 s] |
| sigmap-src/h010 | with | 2/2 | 2 [1–2] | 5 [4–6] | 719 [571–866] | 28,085 [21,458–34,711] | 5,511 [5,058–5,964] | $0.0017 [$0.0015–$0.0020] | 10.2 s [9.7 s–10.7 s] |
| sigmap-src/h011 | without | 2/2 | 6 [5–6] | 8 [8–8] | 1,393 [1,270–1,516] | 42,608 [40,859–44,356] | 8,407 [6,317–10,497] | $0.0028 [$0.0023–$0.0033] | 11.8 s [11.2 s–12.3 s] |
| sigmap-src/h011 | with | 2/2 | 1 [1–1] | 4 [4–4] | 508 [500–516] | 21,143 [20,822–21,464] | 5,450 [5,132–5,767] | $0.0016 [$0.0015–$0.0016] | 7.5 s [7.3 s–7.6 s] |
| sigmap-src/h012 | without | 2/2 | 5 [4–5] | 8 [8–8] | 1,310 [1,168–1,451] | 41,821 [40,559–43,082] | 8,790 [8,678–8,902] | $0.0028 [$0.0028–$0.0029] | 11.9 s [11.7 s–12.1 s] |
| sigmap-src/h012 | with | 2/2 | 3 [3–3] | 6 [6–6] | 928 [821–1,035] | 36,398 [36,073–36,722] | 7,383 [7,032–7,733] | $0.0023 [$0.0023–$0.0023] | 10.3 s [9.9 s–10.8 s] |
| sigmap-src/h013 | without | 2/2 | 10 [8–11] | 12 [12–12] | 2,355 [2,175–2,535] | 76,487 [73,193–79,781] | 14,061 [12,562–15,560] | $0.0048 [$0.0046–$0.0049] | 17.7 s [17.6 s–17.8 s] |
| sigmap-src/h013 | with | 2/2 | 2 [1–2] | 5 [4–6] | 607 [594–620] | 28,238 [20,823–35,652] | 6,191 [5,565–6,817] | $0.0018 [$0.0016–$0.0020] | 9.6 s [9.5 s–9.8 s] |
| sigmap-src/h014 | without | 2/2 | 2 [2–2] | 6 [6–6] | 796 [718–874] | 29,681 [27,660–31,702] | 8,332 [5,530–11,134] | $0.0024 [$0.0017–$0.0030] | 9.6 s [9.1 s–10.0 s] |
| sigmap-src/h014 | with | 2/2 | 2 [1–2] | 5 [4–6] | 607 [554–660] | 28,366 [20,831–35,900] | 5,677 [5,591–5,763] | $0.0017 [$0.0016–$0.0018] | 8.6 s [8.5 s–8.7 s] |
| sigmap-src/h015 | without | 2/2 | 5 [4–5] | 7 [6–8] | 957 [924–990] | 36,685 [32,619–40,751] | 9,807 [9,566–10,048] | $0.0028 [$0.0028–$0.0028] | 9.8 s [9.5 s–10.1 s] |
| sigmap-src/h015 | with | 2/2 | 2 [1–2] | 5 [4–6] | 522 [427–617] | 27,969 [21,470–34,468] | 5,093 [4,821–5,364] | $0.0016 [$0.0014–$0.0017] | 7.7 s [7.0 s–8.4 s] |

