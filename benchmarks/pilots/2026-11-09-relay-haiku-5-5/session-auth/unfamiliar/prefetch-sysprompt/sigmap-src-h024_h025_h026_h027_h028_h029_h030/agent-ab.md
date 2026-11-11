# Agent-level A/B — measured tool calls, tokens and cost

**claude-code 2.1.322 (Claude Code) · claude-haiku-5-5 · 2026-11-11 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap ranked the question BEFORE the first turn (what a prompt hook would inject): the five likeliest files with their signatures and line anchors in the prompt, + the sigmap CLI; no MCP server, no standing section, no extra tool call.
- Both arms: the same prompt, model, tool allowlist (Read, Grep, Glob, Bash), per-run budget cap $0.6 and timeout 420 s; run in a clean copy of the commit pinned in `benchmarks/xrepo-repos.json`.
- Questions: the task id(s) h024, h025, h026, h027, h028, h029, h030 of `benchmarks/tasks/retrieval-xrepo.jsonl`. Pass = hit@5 on the repository-relative paths the answer names.
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
| sigmap-src | 7 | 12/14 | 14/14 | 0 / 0 |
| all | 7 | 12/14 | 14/14 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 7. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −29% | −38% | fewer in every repetition |
| Input tokens (uncached) | −27% | −37% | fewer in every repetition |
| Output tokens | −11% | −38% | fewer in every repetition |
| Cache-read tokens | −29% | −45% | fewer in every repetition |
| Cache-write tokens | +4% | −41% | mixed |
| Total tokens (derived) | −22% | −44% | fewer in every repetition |
| Cost | −3% | −41% | fewer in every repetition |
| Wall time | −15% | −30% | fewer in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −35% [−54%, −6%] | −23% [−56%, +38%] † | fewer in every repetition, within the noise |
| Input tokens (uncached) | −31% [−52%, +8%] † | −30% [−49%, −4%] | fewer in every repetition, within the noise |
| Output tokens | −10% [−44%, +38%] † | −30% [−50%, −2%] | fewer in every repetition, within the noise |
| Cache-read tokens | −37% [−62%, +26%] † | −27% [−54%, +15%] † | fewer in every repetition, within the noise |
| Cache-write tokens | +10% [−8%, +31%] † | −37% [−47%, −26%] | mixed |
| Total tokens (derived) | −26% [−52%, +26%] † | −29% [−53%, +3%] † | fewer in every repetition, within the noise |
| Cost | −1% [−22%, +25%] † | −35% [−48%, −22%] | fewer in every repetition, within the noise |
| Wall time | −16% [−39%, +16%] † | −23% [−40%, −8%] | fewer in every repetition, within the noise |

### Outcome (hit@5), by repetition

Per paired task: **better** = the SigMap arm named the file and the other did not; **worse** = the reverse; **tie** = both found it or both missed. Localisation only.

| repetition | paired tasks | better | worse | tie |
| --- | ---: | ---: | ---: | ---: |
| R1 | 7 | 0 | 0 | 7 |
| R2 | 7 | 2 | 0 | 5 |
| all | 14 | 2 | 0 | 12 |

## Tool calls

Provenance: agent-reported (main-thread tool_use blocks). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 5 | 3 | −2 | 5 / 0 / 2 |
| all | 5 | 3 | −2 | 5 / 0 / 2 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 8 | 5 | −4 | 6 / 1 / 0 |
| all | 8 | 5 | −4 | 6 / 1 / 0 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 1,323 | 910 | −495 | 5 / 0 / 2 |
| all | 1,323 | 910 | −495 | 5 / 0 / 2 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 39,399 | 25,313 | −20,023 | 6 / 0 / 1 |
| all | 39,399 | 25,313 | −20,023 | 6 / 0 / 1 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 8,912 | 8,117 | −1,362 | 6 / 0 / 1 |
| all | 8,912 | 8,117 | −1,362 | 6 / 0 / 1 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 49,642 | 33,139 | −21,504 | 6 / 0 / 1 |
| all | 49,642 | 33,139 | −21,504 | 6 / 0 / 1 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | $0.0028 | $0.0023 | −$0.0007 | 6 / 0 / 1 |
| all | $0.0028 | $0.0023 | −$0.0007 | 6 / 0 / 1 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 13.5 s | 8.9 s | −3.7 s | 6 / 0 / 1 |
| all | 13.5 s | 8.9 s | −3.7 s | 6 / 0 / 1 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | $0.0545 (14 runs) | $0.0417 (14 runs) | none | none |
| all | $0.0545 (14 runs) | $0.0417 (14 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| sigmap-src/h024 | without | 1/2 | 9 [8–10] | 15 [14–16] | 2,789 [2,592–2,986] | 134,252 [115,556–152,947] | 23,679 [21,510–25,847] | $0.0075 [$0.0070–$0.0080] | 21.7 s [21.5 s–21.9 s] |
| sigmap-src/h024 | with | 2/2 | 6 [6–6] | 10 [10–10] | 2,294 [2,152–2,436] | 77,317 [75,941–78,693] | 16,400 [14,164–18,635] | $0.0052 [$0.0047–$0.0057] | 18.0 s [16.7 s–19.3 s] |
| sigmap-src/h025 | without | 1/2 | 9 [4–13] | 15 [6–24] | 2,558 [967–4,148] | 135,534 [26,891–244,176] | 20,670 [14,317–27,023] | $0.0068 [$0.0036–$0.0099] | 21.6 s [10.0 s–33.2 s] |
| sigmap-src/h025 | with | 2/2 | 5 [3–6] | 11 [8–14] | 1,850 [1,445–2,255] | 82,403 [55,214–109,591] | 15,095 [11,045–19,144] | $0.0048 [$0.0035–$0.0061] | 16.5 s [13.2 s–19.8 s] |
| sigmap-src/h026 | without | 2/2 | 6 [5–6] | 10 [8–12] | 2,145 [1,779–2,511] | 57,521 [40,879–74,162] | 8,591 [7,481–9,701] | $0.0034 [$0.0028–$0.0039] | 17.1 s [14.4 s–19.8 s] |
| sigmap-src/h026 | with | 2/2 | 4 [2–5] | 6 [4–8] | 910 [722–1,098] | 34,137 [17,197–51,076] | 7,592 [5,852–9,332] | $0.0023 [$0.0022–$0.0024] | 10.0 s [8.7 s–11.4 s] |
| sigmap-src/h027 | without | 2/2 | 5 [4–5] | 8 [8–8] | 1,323 [1,220–1,426] | 39,399 [39,135–39,662] | 8,912 [8,531–9,293] | $0.0028 [$0.0028–$0.0029] | 13.5 s [12.0 s–15.1 s] |
| sigmap-src/h027 | with | 2/2 | 2 [2–2] | 4 [4–4] | 642 [513–770] | 19,376 [16,950–21,802] | 8,117 [5,672–10,561] | $0.0021 [$0.0016–$0.0027] | 8.5 s [8.2 s–8.8 s] |
| sigmap-src/h028 | without | 2/2 | 2 [2–2] | 6 [6–6] | 723 [707–739] | 27,022 [26,717–27,327] | 5,736 [5,462–6,009] | $0.0018 [$0.0017–$0.0018] | 9.2 s [9.1 s–9.4 s] |
| sigmap-src/h028 | with | 2/2 | 1 [1–1] | 4 [4–4] | 630 [540–719] | 19,133 [16,782–21,484] | 7,173 [4,819–9,526] | $0.0019 [$0.0014–$0.0024] | 7.9 s [7.9 s–7.9 s] |
| sigmap-src/h029 | without | 2/2 | 3 [2–3] | 6 [6–6] | 765 [682–848] | 32,059 [31,814–32,303] | 10,390 [8,823–11,957] | $0.0028 [$0.0024–$0.0031] | 9.7 s [9.3 s–10.0 s] |
| sigmap-src/h029 | with | 2/2 | 3 [3–3] | 4 [4–4] | 993 [986–1,000] | 19,182 [16,823–21,540] | 8,762 [5,012–12,511] | $0.0024 [$0.0017–$0.0032] | 8.7 s [8.7 s–8.8 s] |
| sigmap-src/h030 | without | 2/2 | 2 [1–3] | 5 [4–6] | 715 [559–870] | 21,684 [16,792–26,575] | 8,360 [7,925–8,794] | $0.0022 [$0.0022–$0.0023] | 8.8 s [8.7 s–9.0 s] |
| sigmap-src/h030 | with | 2/2 | 3 [2–3] | 5 [4–6] | 823 [666–979] | 25,313 [16,666–33,960] | 6,998 [4,784–9,212] | $0.0021 [$0.0018–$0.0023] | 8.9 s [7.9 s–9.8 s] |

