# Agent-level A/B — measured tool calls, tokens and cost

**claude-code 2.1.322 (Claude Code) · claude-haiku-5-5 · 2026-11-11 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap index strategy + 7-tool core MCP profile (the docs' setup for an agent that calls the tools).
- Both arms: the same prompt, model, tool allowlist (Read, Grep, Glob, Bash), per-run budget cap $0.5 and timeout 420 s; run in a clean copy of the commit pinned in `benchmarks/xrepo-repos.json`.
- Questions: the task id(s) x084, x085, x086, x087, x088 of `benchmarks/tasks/retrieval-xrepo.jsonl`. Pass = hit@5 on the repository-relative paths the answer names.
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
| rails | 5 | 10/10 | 9/10 | 0 / 0 |
| all | 5 | 10/10 | 9/10 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 5. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | 0% | −6% | mixed |
| Input tokens (uncached) | −6% | −11% | fewer in every repetition |
| Output tokens | +6% | −1% | mixed |
| Cache-read tokens | +8% | +5% | more in every repetition |
| Cache-write tokens | −18% | −4% | fewer in every repetition |
| Total tokens (derived) | +2% | +4% | more in every repetition |
| Cost | −11% | −1% | fewer in every repetition |
| Wall time | 0% | +4% | more in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | 0% [0%, 0%] † | +8% [−38%, +98%] † | mixed |
| Input tokens (uncached) | −8% [−22%, 0%] † | −2% [−38%, +45%] † | fewer in every repetition, within the noise |
| Output tokens | +5% [0%, +10%] † | +7% [−30%, +54%] † | more in every repetition, within the noise |
| Cache-read tokens | +5% [−14%, +19%] † | +23% [−30%, +91%] † | more in every repetition, within the noise |
| Cache-write tokens | −17% [−32%, +13%] † | +5% [−22%, +36%] † | mixed |
| Total tokens (derived) | +1% [−14%, +16%] † | +20% [−29%, +81%] † | more in every repetition, within the noise |
| Cost | −9% [−21%, +13%] † | +10% [−25%, +50%] † | mixed |
| Wall time | 0% [−4%, +5%] † | +7% [−21%, +40%] † | more in every repetition, within the noise |

### Outcome (hit@5), by repetition

Per paired task: **better** = the SigMap arm named the file and the other did not; **worse** = the reverse; **tie** = both found it or both missed. Localisation only.

| repetition | paired tasks | better | worse | tie |
| --- | ---: | ---: | ---: | ---: |
| R1 | 5 | 0 | 1 | 4 |
| R2 | 5 | 0 | 0 | 5 |
| all | 10 | 0 | 1 | 9 |

## Tool calls

Provenance: agent-reported (main-thread tool_use blocks). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | 4 | 4 | 0 | 2 / 1 / 2 |
| all | 4 | 4 | 0 | 2 / 1 / 2 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | 7 | 6 | 0 | 2 / 1 / 2 |
| all | 7 | 6 | 0 | 2 / 1 / 2 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | 1,102 | 1,314 | +106 | 2 / 0 / 3 |
| all | 1,102 | 1,314 | +106 | 2 / 0 / 3 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | 41,666 | 45,303 | +6,124 | 1 / 0 / 4 |
| all | 41,666 | 45,303 | +6,124 | 1 / 0 / 4 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | 7,216 | 9,009 | −824 | 4 / 0 / 1 |
| all | 7,216 | 9,009 | −824 | 4 / 0 / 1 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | 49,991 | 55,973 | +5,406 | 1 / 0 / 4 |
| all | 49,991 | 55,973 | +5,406 | 1 / 0 / 4 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | $0.0024 | $0.0028 | −$0.0001 | 3 / 0 / 2 |
| all | $0.0024 | $0.0028 | −$0.0001 | 3 / 0 / 2 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | 10.4 s | 11.7 s | +381 ms | 2 / 0 / 3 |
| all | 10.4 s | 11.7 s | +381 ms | 2 / 0 / 3 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| rails | $0.0296 (10 runs) | $0.0277 (10 runs) | none | none |
| all | $0.0296 (10 runs) | $0.0277 (10 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| rails/x084 | without | 2/2 | 2 [1–2] | 5 [4–6] | 781 [771–790] | 27,546 [22,502–32,589] | 6,416 [4,492–8,340] | $0.0019 [$0.0015–$0.0024] | 8.4 s [8.3 s–8.4 s] |
| rails/x084 | with | 2/2 | 3 [2–3] | 6 [6–6] | 955 [829–1,081] | 41,733 [38,676–44,789] | 9,657 [6,711–12,603] | $0.0028 [$0.0023–$0.0033] | 9.5 s [9.2 s–9.8 s] |
| rails/x085 | without | 2/2 | 4 [3–4] | 7 [6–8] | 1,102 [1,057–1,147] | 41,666 [33,506–49,826] | 7,216 [4,676–9,755] | $0.0024 [$0.0020–$0.0029] | 10.4 s [10.4 s–10.4 s] |
| rails/x085 | with | 2/2 | 5 [3–6] | 8 [6–10] | 1,547 [1,099–1,995] | 60,850 [41,048–80,652] | 6,969 [6,394–7,544] | $0.0028 [$0.0025–$0.0031] | 13.9 s [10.0 s–17.9 s] |
| rails/x086 | without | 2/2 | 2 [2–2] | 5 [4–6] | 769 [751–787] | 28,645 [22,544–34,745] | 6,782 [3,755–9,808] | $0.0020 [$0.0014–$0.0027] | 8.1 s [7.6 s–8.5 s] |
| rails/x086 | with | 2/2 | 2 [2–2] | 5 [4–6] | 875 [816–934] | 34,768 [24,824–44,712] | 5,958 [4,114–7,801] | $0.0020 [$0.0017–$0.0022] | 8.4 s [7.8 s–9.1 s] |
| rails/x087 | without | 2/2 | 6 [4–7] | 10 [6–14] | 2,183 [1,686–2,679] | 73,896 [38,901–108,890] | 14,277 [13,148–15,406] | $0.0047 [$0.0043–$0.0051] | 16.4 s [13.4 s–19.3 s] |
| rails/x087 | with | 1/2 | 4 [3–4] | 6 [6–6] | 1,655 [1,386–1,924] | 45,303 [42,883–47,723] | 9,009 [8,097–9,921] | $0.0031 [$0.0028–$0.0034] | 13.3 s [12.8 s–13.7 s] |
| rails/x088 | without | 2/2 | 5 [4–5] | 8 [8–8] | 1,364 [1,262–1,465] | 50,845 [49,255–52,434] | 12,758 [10,086–15,429] | $0.0037 [$0.0031–$0.0043] | 12.4 s [12.4 s–12.4 s] |
| rails/x088 | with | 2/2 | 4 [3–5] | 7 [6–8] | 1,314 [1,064–1,564] | 54,205 [49,003–59,406] | 9,859 [9,369–10,349] | $0.0032 [$0.0029–$0.0034] | 11.7 s [10.9 s–12.6 s] |

