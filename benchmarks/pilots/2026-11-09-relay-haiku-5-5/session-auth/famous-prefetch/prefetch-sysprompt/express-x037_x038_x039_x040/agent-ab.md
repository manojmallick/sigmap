# Agent-level A/B — measured tool calls, tokens and cost

**claude-code 2.1.322 (Claude Code) · claude-haiku-5-5 · 2026-11-11 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap ranked the question BEFORE the first turn (what a prompt hook would inject): the five likeliest files with their signatures and line anchors in the prompt, + the sigmap CLI; no MCP server, no standing section, no extra tool call.
- Both arms: the same prompt, model, tool allowlist (Read, Grep, Glob, Bash), per-run budget cap $0.5 and timeout 420 s; run in a clean copy of the commit pinned in `benchmarks/xrepo-repos.json`.
- Questions: the task id(s) x037, x038, x039, x040 of `benchmarks/tasks/retrieval-xrepo.jsonl`. Pass = hit@5 on the repository-relative paths the answer names.
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
| express | 4 | 8/8 | 8/8 | 0 / 0 |
| all | 4 | 8/8 | 8/8 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 4. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −33% | +10% | mixed |
| Input tokens (uncached) | −31% | 0% | mixed |
| Output tokens | −17% | +22% | mixed |
| Cache-read tokens | −38% | +14% | mixed |
| Cache-write tokens | +19% | 0% | mixed |
| Total tokens (derived) | −28% | +12% | mixed |
| Cost | +3% | +6% | more in every repetition |
| Wall time | −12% | +9% | mixed |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −36% [−59%, −10%] | 0% [−51%, +73%] † | mixed |
| Input tokens (uncached) | −31% [−33%, −27%] | −3% [−26%, +24%] † | fewer in every repetition, within the noise |
| Output tokens | −18% [−38%, +12%] † | +22% [−4%, +54%] † | mixed |
| Cache-read tokens | −40% [−44%, −32%] | +9% [−21%, +45%] † | mixed |
| Cache-write tokens | +19% [−4%, +42%] † | −3% [−18%, +13%] † | mixed |
| Total tokens (derived) | −29% [−35%, −21%] | +8% [−20%, +38%] † | mixed |
| Cost | +3% [−15%, +17%] † | +4% [−14%, +18%] † | more in every repetition, within the noise |
| Wall time | −11% [−24%, +3%] † | +8% [−1%, +19%] † | mixed |

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
| express | 3 | 3 | −0 | 2 / 1 / 1 |
| all | 3 | 3 | −0 | 2 / 1 / 1 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | 6 | 6 | −1 | 3 / 1 / 0 |
| all | 6 | 6 | −1 | 3 / 1 / 0 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | 786 | 800 | −28 | 2 / 0 / 2 |
| all | 786 | 800 | −28 | 2 / 0 / 2 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | 27,561 | 26,627 | −3,690 | 3 / 0 / 1 |
| all | 27,561 | 26,627 | −3,690 | 3 / 0 / 1 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | 5,988 | 6,874 | +886 | 1 / 0 / 3 |
| all | 5,988 | 6,874 | +886 | 1 / 0 / 3 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | 34,537 | 34,382 | −2,151 | 3 / 0 / 1 |
| all | 34,537 | 34,382 | −2,151 | 3 / 0 / 1 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | $0.0019 | $0.0021 | +$0.0002 | 1 / 0 / 3 |
| all | $0.0019 | $0.0021 | +$0.0002 | 1 / 0 / 3 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | 9.1 s | 9.5 s | −498 ms | 2 / 0 / 2 |
| all | 9.1 s | 9.5 s | −498 ms | 2 / 0 / 2 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| express | $0.0150 (8 runs) | $0.0157 (8 runs) | none | none |
| all | $0.0150 (8 runs) | $0.0157 (8 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| express/x037 | without | 2/2 | 2 [2–2] | 6 [6–6] | 835 [672–998] | 27,254 [26,975–27,533] | 6,034 [5,711–6,357] | $0.0019 [$0.0018–$0.0020] | 10.6 s [9.0 s–12.2 s] |
| express/x037 | with | 2/2 | 3 [2–4] | 5 [4–6] | 873 [792–954] | 23,492 [15,589–31,394] | 7,357 [6,472–8,241] | $0.0021 [$0.0021–$0.0022] | 9.6 s [9.0 s–10.1 s] |
| express/x038 | without | 2/2 | 4 [3–4] | 7 [6–8] | 871 [798–943] | 33,380 [28,304–38,455] | 5,674 [5,570–5,778] | $0.0019 [$0.0018–$0.0020] | 9.6 s [9.2 s–10.1 s] |
| express/x038 | with | 2/2 | 3 [3–3] | 6 [6–6] | 777 [771–782] | 29,763 [27,547–31,979] | 7,487 [6,236–8,738] | $0.0022 [$0.0020–$0.0024] | 9.7 s [9.5 s–9.9 s] |
| express/x039 | without | 2/2 | 3 [3–3] | 6 [6–6] | 737 [678–796] | 27,708 [27,281–28,135] | 6,494 [4,827–8,160] | $0.0019 [$0.0016–$0.0023] | 8.5 s [8.2 s–8.7 s] |
| express/x039 | with | 2/2 | 1 [1–1] | 4 [4–4] | 545 [447–643] | 17,419 [15,635–19,202] | 5,358 [3,584–7,131] | $0.0015 [$0.0012–$0.0018] | 7.3 s [6.8 s–7.8 s] |
| express/x040 | without | 2/2 | 3 [2–3] | 6 [6–6] | 573 [501–645] | 27,414 [26,877–27,951] | 5,943 [5,823–6,062] | $0.0017 [$0.0017–$0.0018] | 8.0 s [7.9 s–8.1 s] |
| express/x040 | with | 2/2 | 3 [2–3] | 6 [4–8] | 824 [808–840] | 29,816 [15,607–44,024] | 6,392 [5,583–7,200] | $0.0020 [$0.0020–$0.0020] | 9.4 s [8.6 s–10.2 s] |

