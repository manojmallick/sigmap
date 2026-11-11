# Agent-level A/B — measured tool calls, tokens and cost

**claude-code 2.1.322 (Claude Code) · claude-haiku-5-5 · 2026-11-11 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap index strategy + 7-tool core MCP profile (the docs' setup for an agent that calls the tools).
- Both arms: the same prompt, model, tool allowlist (Read, Grep, Glob, Bash), per-run budget cap $0.5 and timeout 420 s; run in a clean copy of the commit pinned in `benchmarks/xrepo-repos.json`.
- Questions: the task id(s) x027, x028, x029, x030, x031 of `benchmarks/tasks/retrieval-xrepo.jsonl`. Pass = hit@5 on the repository-relative paths the answer names.
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
| django | 5 | 10/10 | 10/10 | 0 / 0 |
| all | 5 | 10/10 | 10/10 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 5. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −15% | −35% | fewer in every repetition |
| Input tokens (uncached) | 0% | −13% | mixed |
| Output tokens | −5% | −35% | fewer in every repetition |
| Cache-read tokens | +19% | +7% | more in every repetition |
| Cache-write tokens | −8% | −14% | fewer in every repetition |
| Total tokens (derived) | +13% | +2% | more in every repetition |
| Cost | −4% | −16% | fewer in every repetition |
| Wall time | +2% | −14% | mixed |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −20% [−39%, 0%] † | −32% [−60%, +28%] † | fewer in every repetition, within the noise |
| Input tokens (uncached) | −4% [−22%, +14%] † | −13% [−32%, +18%] † | fewer in every repetition, within the noise |
| Output tokens | −9% [−22%, +5%] † | −35% [−48%, −21%] | fewer in every repetition, within the noise |
| Cache-read tokens | +10% [−11%, +32%] † | +4% [−25%, +55%] † | more in every repetition, within the noise |
| Cache-write tokens | −8% [−37%, +35%] † | −21% [−44%, +12%] † | fewer in every repetition, within the noise |
| Total tokens (derived) | +7% [−10%, +26%] † | −1% [−28%, +45%] † | mixed |
| Cost | −6% [−28%, +23%] † | −21% [−42%, +8%] † | fewer in every repetition, within the noise |
| Wall time | −1% [−13%, +15%] † | −15% [−26%, −2%] | fewer in every repetition, within the noise |

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
| django | 4 | 2 | −2 | 3 / 1 / 1 |
| all | 4 | 2 | −2 | 3 / 1 / 1 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | 6 | 6 | −1 | 3 / 0 / 2 |
| all | 6 | 6 | −1 | 3 / 0 / 2 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | 985 | 683 | −221 | 5 / 0 / 0 |
| all | 985 | 683 | −221 | 5 / 0 / 0 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | 29,102 | 33,052 | −1,584 | 3 / 0 / 2 |
| all | 29,102 | 33,052 | −1,584 | 3 / 0 / 2 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | 7,052 | 4,749 | −555 | 3 / 0 / 2 |
| all | 7,052 | 4,749 | −555 | 3 / 0 / 2 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | 37,537 | 39,221 | −1,813 | 3 / 0 / 2 |
| all | 37,537 | 39,221 | −1,813 | 3 / 0 / 2 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | $0.0023 | $0.0016 | −$0.0003 | 4 / 0 / 1 |
| all | $0.0023 | $0.0016 | −$0.0003 | 4 / 0 / 1 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | 9.5 s | 8.6 s | −1.5 s | 4 / 0 / 1 |
| all | 9.5 s | 8.6 s | −1.5 s | 4 / 0 / 1 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| django | $0.0251 (10 runs) | $0.0226 (10 runs) | none | none |
| all | $0.0251 (10 runs) | $0.0226 (10 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| django/x027 | without | 2/2 | 6 [4–7] | 7 [6–8] | 1,278 [885–1,670] | 34,853 [27,337–42,368] | 6,312 [5,063–7,560] | $0.0023 [$0.0017–$0.0028] | 10.9 s [8.6 s–13.2 s] |
| django/x027 | with | 2/2 | 4 [3–4] | 6 [6–6] | 822 [700–944] | 33,052 [31,698–34,406] | 6,756 [4,698–8,813] | $0.0021 [$0.0016–$0.0026] | 9.0 s [8.9 s–9.1 s] |
| django/x028 | without | 2/2 | 4 [4–4] | 6 [6–6] | 985 [975–994] | 29,102 [27,846–30,358] | 7,444 [6,117–8,771] | $0.0023 [$0.0020–$0.0025] | 9.4 s [8.8 s–10.1 s] |
| django/x028 | with | 2/2 | 2 [2–2] | 5 [4–6] | 683 [620–745] | 27,519 [21,466–33,571] | 4,400 [3,863–4,936] | $0.0015 [$0.0013–$0.0017] | 7.6 s [6.6 s–8.6 s] |
| django/x029 | without | 2/2 | 3 [3–3] | 6 [6–6] | 873 [825–921] | 27,748 [27,696–27,799] | 5,228 [5,057–5,399] | $0.0018 [$0.0017–$0.0018] | 9.5 s [9.1 s–10.0 s] |
| django/x029 | with | 2/2 | 2 [1–2] | 4 [4–4] | 653 [581–724] | 21,145 [20,817–21,472] | 4,673 [4,051–5,295] | $0.0015 [$0.0013–$0.0016] | 8.1 s [8.0 s–8.2 s] |
| django/x030 | without | 2/2 | 2 [1–2] | 5 [4–6] | 838 [836–839] | 24,231 [16,778–31,683] | 7,052 [3,731–10,372] | $0.0021 [$0.0013–$0.0028] | 9.0 s [8.6 s–9.4 s] |
| django/x030 | with | 2/2 | 2 [2–2] | 6 [6–6] | 658 [641–675] | 33,808 [33,515–34,101] | 4,749 [4,404–5,094] | $0.0016 [$0.0016–$0.0017] | 8.6 s [8.5 s–8.8 s] |
| django/x031 | without | 2/2 | 6 [5–7] | 8 [8–8] | 1,658 [1,610–1,706] | 53,702 [48,343–59,060] | 14,087 [11,094–17,079] | $0.0042 [$0.0035–$0.0049] | 12.6 s [12.2 s–13.0 s] |
| django/x031 | with | 2/2 | 6 [5–7] | 9 [8–10] | 1,653 [1,362–1,943] | 76,706 [65,786–87,625] | 15,176 [14,503–15,848] | $0.0046 [$0.0042–$0.0050] | 14.7 s [13.5 s–15.9 s] |

