# Agent-level A/B — measured tool calls, tokens and cost

**claude-code 2.1.322 (Claude Code) · claude-haiku-5-5 · 2026-11-10 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap as one skill (sigmap-locate) whose description tells the agent to call it first on every where-is-it question, + the sigmap CLI: no MCP server, no always-on section.
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
- Skill variant: both arms run with skills enabled (the Skill tool, and the agent's own bundled skills listed in the prompt, about 2k tokens), which the earlier no-skill runs did not have, so these figures are against this run's own baseline and not comparable cell by cell with the index, lean or current runs. The SigMap arm adds only its skill file(s) and the sigmap CLI: no MCP server and no appended section.

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
| Tool calls | +26% | +61% | more in every repetition |
| Input tokens (uncached) | +56% | +93% | more in every repetition |
| Output tokens | +20% | +35% | more in every repetition |
| Cache-read tokens | +62% | +117% | more in every repetition |
| Cache-write tokens | +9% | +27% | more in every repetition |
| Total tokens (derived) | +52% | +97% | more in every repetition |
| Cost | +19% | +41% | more in every repetition |
| Wall time | +22% | +42% | more in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | +30% [−1%, +66%] † | +68% [+34%, +132%] | more in every repetition, within the noise |
| Input tokens (uncached) | +58% [+25%, +93%] | +97% [+68%, +129%] | more in every repetition, outside the noise |
| Output tokens | +22% [−8%, +59%] † | +38% [+22%, +64%] | more in every repetition, within the noise |
| Cache-read tokens | +69% [+22%, +123%] | +126% [+81%, +177%] | more in every repetition, outside the noise |
| Cache-write tokens | +8% [−13%, +43%] † | +28% [+19%, +37%] | more in every repetition, within the noise |
| Total tokens (derived) | +56% [+18%, +103%] | +103% [+69%, +139%] | more in every repetition, outside the noise |
| Cost | +20% [−1%, +55%] † | +42% [+31%, +55%] | more in every repetition, within the noise |
| Wall time | +23% [+9%, +39%] | +43% [+30%, +63%] | more in every repetition, outside the noise |

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
| laravel | 4 | 6 | +2 | 0 / 0 / 5 |
| all | 4 | 6 | +2 | 0 / 0 / 5 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | 6 | 11 | +5 | 0 / 0 / 5 |
| all | 6 | 11 | +5 | 0 / 0 / 5 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | 1,364 | 1,841 | +391 | 1 / 0 / 4 |
| all | 1,364 | 1,841 | +391 | 1 / 0 / 4 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | 35,675 | 74,482 | +37,242 | 0 / 0 / 5 |
| all | 35,675 | 74,482 | +37,242 | 0 / 0 / 5 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | 9,830 | 10,951 | +1,377 | 1 / 0 / 4 |
| all | 9,830 | 10,951 | +1,377 | 1 / 0 / 4 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | 47,731 | 89,064 | +38,072 | 0 / 0 / 5 |
| all | 47,731 | 89,064 | +38,072 | 0 / 0 / 5 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | $0.0030 | $0.0039 | +$0.0006 | 0 / 0 / 5 |
| all | $0.0030 | $0.0039 | +$0.0006 | 0 / 0 / 5 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | 12.7 s | 17.4 s | +4.7 s | 0 / 0 / 5 |
| all | 12.7 s | 17.4 s | +4.7 s | 0 / 0 / 5 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| laravel | $0.0308 (10 runs) | $0.0398 (10 runs) | none | none |
| all | $0.0308 (10 runs) | $0.0398 (10 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| laravel/x046 | without | 2/2 | 4 [2–6] | 6 [4–8] | 1,364 [940–1,787] | 37,891 [20,723–55,059] | 9,830 [7,166–12,494] | $0.0030 [$0.0021–$0.0039] | 12.7 s [9.3 s–16.1 s] |
| laravel/x046 | with | 2/2 | 6 [6–6] | 11 [10–12] | 1,841 [1,816–1,865] | 72,409 [64,718–80,099] | 9,564 [9,170–9,957] | $0.0036 [$0.0034–$0.0037] | 17.4 s [16.5 s–18.2 s] |
| laravel/x047 | without | 2/2 | 4 [4–4] | 6 [6–6] | 1,581 [1,547–1,614] | 35,675 [35,427–35,923] | 10,469 [10,217–10,721] | $0.0032 [$0.0032–$0.0033] | 13.4 s [12.9 s–14.0 s] |
| laravel/x047 | with | 2/2 | 6 [6–6] | 11 [10–12] | 1,924 [1,899–1,949] | 72,917 [64,257–81,576] | 10,951 [9,393–12,508] | $0.0039 [$0.0035–$0.0043] | 16.9 s [16.7 s–17.1 s] |
| laravel/x048 | without | 2/2 | 5 [4–6] | 9 [8–10] | 1,806 [1,745–1,866] | 62,556 [53,718–71,394] | 11,409 [11,165–11,653] | $0.0038 [$0.0036–$0.0040] | 15.4 s [15.2 s–15.5 s] |
| laravel/x048 | with | 2/2 | 6 [5–6] | 11 [10–12] | 1,785 [1,417–2,153] | 74,482 [66,679–82,284] | 12,786 [12,658–12,914] | $0.0042 [$0.0040–$0.0044] | 17.4 s [15.5 s–19.2 s] |
| laravel/x049 | without | 2/2 | 5 [4–5] | 6 [6–6] | 1,198 [1,108–1,288] | 35,112 [34,555–35,668] | 9,020 [8,094–9,946] | $0.0028 [$0.0025–$0.0030] | 12.4 s [12.3 s–12.6 s] |
| laravel/x049 | with | 2/2 | 7 [6–7] | 12 [12–12] | 1,895 [1,659–2,131] | 84,361 [82,800–85,922] | 14,172 [13,544–14,799] | $0.0046 [$0.0044–$0.0049] | 17.5 s [16.1 s–18.8 s] |
| laravel/x050 | without | 2/2 | 3 [3–3] | 6 [6–6] | 1,020 [993–1,046] | 35,473 [35,178–35,768] | 8,559 [8,196–8,922] | $0.0026 [$0.0025–$0.0026] | 11.1 s [10.9 s–11.3 s] |
| laravel/x050 | with | 2/2 | 5 [5–5] | 12 [12–12] | 1,411 [1,378–1,443] | 81,225 [79,722–82,727] | 10,543 [9,474–11,611] | $0.0036 [$0.0034–$0.0039] | 16.3 s [15.9 s–16.7 s] |

