# Agent-level A/B — measured tool calls, tokens and cost

**claude-code 2.1.322 (Claude Code) · claude-haiku-5-5 · 2026-11-11 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap ranked the question BEFORE the first turn (what a prompt hook would inject): the five likeliest files with their signatures and line anchors after the question in the user turn, + the sigmap CLI; no MCP server, no standing section, no extra tool call.
- Both arms: the same prompt, model, tool allowlist (Read, Grep, Glob, Bash), per-run budget cap $0.5 and timeout 420 s; run in a clean copy of the commit pinned in `benchmarks/xrepo-repos.json`.
- Questions: the task id(s) x032, x033, x034, x035, x036 of `benchmarks/tasks/retrieval-xrepo.jsonl`. Pass = hit@5 on the repository-relative paths the answer names.
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
| flask | 5 | 10/10 | 10/10 | 0 / 0 |
| all | 5 | 10/10 | 10/10 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 5. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | +18% | 0% | mixed |
| Input tokens (uncached) | −11% | −7% | fewer in every repetition |
| Output tokens | +41% | +17% | more in every repetition |
| Cache-read tokens | +8% | +16% | more in every repetition |
| Cache-write tokens | +53% | +1% | more in every repetition |
| Total tokens (derived) | +16% | +13% | more in every repetition |
| Cost | +43% | +7% | more in every repetition |
| Wall time | +13% | +1% | more in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | +9% [−28%, +66%] † | +3% [−34%, +60%] † | more in every repetition, within the noise |
| Input tokens (uncached) | −18% [−46%, +32%] † | −6% [−36%, +38%] † | fewer in every repetition, within the noise |
| Output tokens | +24% [−11%, +71%] † | +6% [−21%, +43%] † | more in every repetition, within the noise |
| Cache-read tokens | −9% [−49%, +80%] † | +18% [−28%, +93%] † | mixed |
| Cache-write tokens | +54% [+43%, +66%] | −1% [−25%, +40%] † | mixed |
| Total tokens (derived) | +3% [−35%, +78%] † | +14% [−27%, +77%] † | more in every repetition, within the noise |
| Cost | +40% [+21%, +64%] | +4% [−23%, +41%] † | more in every repetition, within the noise |
| Wall time | +7% [−17%, +36%] † | −3% [−22%, +21%] † | mixed |

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
| flask | 3 | 3 | +1 | 2 / 0 / 3 |
| all | 3 | 3 | +1 | 2 / 0 / 3 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | 7 | 6 | −1 | 3 / 0 / 2 |
| all | 7 | 6 | −1 | 3 / 0 / 2 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | 839 | 878 | +262 | 2 / 0 / 3 |
| all | 839 | 878 | +262 | 2 / 0 / 3 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | 34,267 | 35,551 | −1,746 | 3 / 0 / 2 |
| all | 34,267 | 35,551 | −1,746 | 3 / 0 / 2 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | 7,049 | 9,103 | +2,244 | 0 / 0 / 5 |
| all | 7,049 | 9,103 | +2,244 | 0 / 0 / 5 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | 42,363 | 45,537 | +1,715 | 2 / 0 / 3 |
| all | 42,363 | 45,537 | +1,715 | 2 / 0 / 3 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | $0.0021 | $0.0026 | +$0.0010 | 2 / 0 / 3 |
| all | $0.0021 | $0.0026 | +$0.0010 | 2 / 0 / 3 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | 10.1 s | 9.2 s | +599 ms | 2 / 0 / 3 |
| all | 10.1 s | 9.2 s | +599 ms | 2 / 0 / 3 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| flask | $0.0223 (10 runs) | $0.0280 (10 runs) | none | none |
| all | $0.0223 (10 runs) | $0.0280 (10 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| flask/x032 | without | 2/2 | 6 [6–6] | 8 [8–8] | 1,984 [1,637–2,331] | 44,010 [43,515–44,505] | 9,720 [9,275–10,165] | $0.0034 [$0.0033–$0.0035] | 14.2 s [12.2 s–16.1 s] |
| flask/x032 | with | 2/2 | 7 [6–7] | 7 [6–8] | 3,202 [3,086–3,317] | 42,265 [32,083–52,446] | 11,964 [10,273–13,654] | $0.0044 [$0.0042–$0.0046] | 18.7 s [18.3 s–19.2 s] |
| flask/x033 | without | 2/2 | 2 [1–3] | 5 [4–6] | 837 [814–860] | 22,856 [16,800–28,911] | 7,049 [5,814–8,284] | $0.0021 [$0.0017–$0.0024] | 9.4 s [8.7 s–10.1 s] |
| flask/x033 | with | 2/2 | 5 [2–7] | 9 [6–12] | 1,264 [1,015–1,512] | 63,512 [35,962–91,062] | 9,593 [4,939–14,246] | $0.0032 [$0.0019–$0.0045] | 12.7 s [10.5 s–14.9 s] |
| flask/x034 | without | 2/2 | 3 [3–3] | 7 [6–8] | 977 [967–987] | 34,267 [28,241–40,292] | 7,112 [6,784–7,440] | $0.0023 [$0.0022–$0.0023] | 10.1 s [9.9 s–10.3 s] |
| flask/x034 | with | 2/2 | 2 [2–2] | 4 [4–4] | 816 [705–926] | 19,837 [18,377–21,296] | 7,565 [5,167–9,962] | $0.0021 [$0.0016–$0.0026] | 8.2 s [7.2 s–9.2 s] |
| flask/x035 | without | 2/2 | 4 [3–4] | 8 [8–8] | 839 [837–841] | 38,784 [38,088–39,480] | 5,206 [4,481–5,930] | $0.0018 [$0.0017–$0.0020] | 10.2 s [10.0 s–10.3 s] |
| flask/x035 | with | 2/2 | 2 [2–2] | 4 [4–4] | 583 [577–588] | 19,659 [18,262–21,056] | 5,994 [4,535–7,453] | $0.0017 [$0.0014–$0.0020] | 7.2 s [7.1 s–7.3 s] |
| flask/x036 | without | 2/2 | 2 [2–2] | 5 [4–6] | 616 [590–642] | 21,957 [16,786–27,128] | 5,392 [4,063–6,721] | $0.0016 [$0.0013–$0.0019] | 8.6 s [7.8 s–9.4 s] |
| flask/x036 | with | 2/2 | 3 [3–3] | 6 [6–6] | 878 [851–904] | 35,551 [34,172–36,929] | 9,103 [7,799–10,407] | $0.0026 [$0.0024–$0.0028] | 9.2 s [8.9 s–9.5 s] |

