# Agent-level A/B — measured tool calls, tokens and cost

**claude-code 2.1.322 (Claude Code) · claude-haiku-5-5 · 2026-11-11 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap ranked the question BEFORE the first turn (what a prompt hook would inject): the five likeliest files with their signatures and line anchors after the question in the user turn, + the sigmap CLI; no MCP server, no standing section, no extra tool call.
- Both arms: the same prompt, model, tool allowlist (Read, Grep, Glob, Bash), per-run budget cap $0.5 and timeout 420 s; run in a clean copy of the commit pinned in `benchmarks/xrepo-repos.json`.
- Questions: the task id(s) x046, x047, x048, x049, x050 of `benchmarks/tasks/retrieval-xrepo.jsonl`. Pass = hit@5 on the repository-relative paths the answer names.
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
| laravel | 5 | 10/10 | 10/10 | 0 / 0 |
| all | 5 | 10/10 | 10/10 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 5. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | 0% | −32% | mixed |
| Input tokens (uncached) | +7% | −26% | mixed |
| Output tokens | +7% | −25% | mixed |
| Cache-read tokens | +26% | −17% | mixed |
| Cache-write tokens | +45% | −4% | mixed |
| Total tokens (derived) | +28% | −16% | mixed |
| Cost | +32% | −12% | mixed |
| Wall time | +5% | −17% | mixed |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −17% [−63%, +47%] † | −32% [−56%, +11%] † | fewer in every repetition, within the noise |
| Input tokens (uncached) | +2% [−22%, +36%] † | −25% [−39%, −8%] | mixed |
| Output tokens | +3% [−26%, +31%] † | −26% [−40%, −8%] | mixed |
| Cache-read tokens | +15% [−19%, +65%] † | −15% [−35%, +13%] † | mixed |
| Cache-write tokens | +49% [+33%, +68%] | −4% [−13%, +5%] † | mixed |
| Total tokens (derived) | +21% [−7%, +57%] † | −14% [−33%, +11%] † | mixed |
| Cost | +31% [+16%, +46%] | −12% [−25%, +2%] † | mixed |
| Wall time | +4% [−13%, +21%] † | −17% [−23%, −11%] | mixed |

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
| laravel | 5 | 4 | −1 | 3 / 0 / 2 |
| all | 5 | 4 | −1 | 3 / 0 / 2 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | 6 | 6 | −2 | 3 / 1 / 1 |
| all | 6 | 6 | −2 | 3 / 1 / 1 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | 1,348 | 1,111 | −237 | 3 / 0 / 2 |
| all | 1,348 | 1,111 | −237 | 3 / 0 / 2 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | 30,251 | 32,589 | −6,653 | 3 / 0 / 2 |
| all | 30,251 | 32,589 | −6,653 | 3 / 0 / 2 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | 6,577 | 7,992 | +1,313 | 0 / 0 / 5 |
| all | 6,577 | 7,992 | +1,313 | 0 / 0 / 5 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | 40,628 | 40,102 | −5,599 | 3 / 0 / 2 |
| all | 40,628 | 40,102 | −5,599 | 3 / 0 / 2 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | $0.0023 | $0.0023 | +$0.0001 | 2 / 0 / 3 |
| all | $0.0023 | $0.0023 | +$0.0001 | 2 / 0 / 3 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | 11.8 s | 10.9 s | −616 ms | 4 / 0 / 1 |
| all | 11.8 s | 10.9 s | −616 ms | 4 / 0 / 1 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| laravel | $0.0234 (10 runs) | $0.0254 (10 runs) | none | none |
| all | $0.0234 (10 runs) | $0.0254 (10 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| laravel/x046 | without | 2/2 | 4 [3–5] | 8 [6–10] | 1,348 [1,072–1,623] | 39,242 [27,681–50,802] | 5,104 [4,469–5,738] | $0.0021 [$0.0017–$0.0025] | 12.1 s [10.6 s–13.5 s] |
| laravel/x046 | with | 2/2 | 4 [3–4] | 6 [6–6] | 1,111 [984–1,237] | 32,589 [31,128–34,049] | 6,397 [5,204–7,590] | $0.0022 [$0.0019–$0.0024] | 11.0 s [9.8 s–12.1 s] |
| laravel/x047 | without | 2/2 | 5 [4–5] | 6 [6–6] | 1,508 [1,455–1,561] | 28,241 [27,979–28,502] | 6,653 [6,223–7,083] | $0.0024 [$0.0023–$0.0024] | 12.0 s [11.6 s–12.3 s] |
| laravel/x047 | with | 2/2 | 2 [1–2] | 4 [4–4] | 932 [895–968] | 19,723 [18,309–21,136] | 7,992 [6,932–9,052] | $0.0023 [$0.0021–$0.0024] | 9.2 s [8.7 s–9.7 s] |
| laravel/x048 | without | 2/2 | 3 [2–4] | 6 [6–6] | 1,415 [1,248–1,582] | 30,251 [29,123–31,378] | 8,957 [7,393–10,520] | $0.0028 [$0.0024–$0.0032] | 11.8 s [11.6 s–12.1 s] |
| laravel/x048 | with | 2/2 | 5 [3–7] | 8 [6–10] | 1,794 [1,246–2,342] | 50,834 [34,857–66,810] | 10,270 [7,887–12,652] | $0.0035 [$0.0025–$0.0044] | 13.0 s [10.7 s–15.3 s] |
| laravel/x049 | without | 2/2 | 5 [4–5] | 6 [6–6] | 1,227 [1,089–1,364] | 27,779 [27,486–28,072] | 5,887 [5,639–6,134] | $0.0021 [$0.0019–$0.0022] | 11.3 s [11.0 s–11.7 s] |
| laravel/x049 | with | 2/2 | 5 [5–5] | 6 [6–6] | 1,328 [1,297–1,359] | 34,744 [33,109–36,378] | 8,257 [6,522–9,992] | $0.0027 [$0.0023–$0.0030] | 10.9 s [10.4 s–11.4 s] |
| laravel/x050 | without | 2/2 | 5 [3–6] | 8 [6–10] | 1,228 [1,072–1,384] | 41,916 [27,947–55,885] | 6,577 [5,601–7,552] | $0.0023 [$0.0019–$0.0028] | 11.2 s [10.2 s–12.3 s] |
| laravel/x050 | with | 2/2 | 2 [2–2] | 6 [6–6] | 924 [780–1,067] | 31,164 [30,254–32,073] | 6,927 [6,028–7,825] | $0.0022 [$0.0019–$0.0024] | 10.6 s [10.5 s–10.8 s] |

