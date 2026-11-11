# Agent-level A/B — measured tool calls, tokens and cost

**anthropic-messages-api direct Messages API · claude-sonnet-5-5 · 2026-11-11 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap ranked the question BEFORE the first turn (what a prompt hook would inject): the five likeliest files with their signatures and line anchors after the question in the user turn, + the sigmap CLI; no MCP server, no standing section, no extra tool call.
- Both arms: the same prompt, model, tool allowlist (Read, Grep, Glob, Bash), per-run budget cap $0.25 and timeout 420 s; run in a clean copy of the commit pinned in `benchmarks/xrepo-repos.json`.
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
- Direct Messages API agent (scripts/lib/agent-ab-api.mjs), not Claude Code: a short neutral system prompt (about 150 tokens) and four read-only tools, so the prefix each turn re-reads is far smaller than Claude Code's and SigMap's per-turn addition is a larger share of a turn. Cost is computed from the usage the API reports and a price table (the Console's usage page is the authority), with 5-minute prompt caching. Not comparable cell by cell with Claude Code runs.

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
| Tool calls | −40% | −50% | fewer in every repetition |
| Input tokens (uncached) | +1112% | +1115% | more in every repetition |
| Output tokens | −25% | −20% | fewer in every repetition |
| Cache-read tokens | −73% | −41% | fewer in every repetition |
| Cache-write tokens | +18% | −49% | mixed |
| Total tokens (derived) | −26% | −22% | fewer in every repetition |
| Cost | +19% | −13% | mixed |
| Wall time | −34% | −27% | fewer in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −35% [−66%, 0%] † | −51% [−68%, −26%] | fewer in every repetition, within the noise |
| Input tokens (uncached) | +1110% [+1060%, +1157%] | +1112% [+1054%, +1167%] | more in every repetition, outside the noise |
| Output tokens | −20% [−42%, +1%] † | −18% [−37%, +1%] † | fewer in every repetition, within the noise |
| Cache-read tokens | −64% [−85%, −28%] | −44% [−78%, +28%] † | fewer in every repetition, within the noise |
| Cache-write tokens | +105% [−35%, +554%] † | +44% [−69%, +231%] † n=3 | more in every repetition, within the noise |
| Total tokens (derived) | +8% [−52%, +151%] † | −8% [−48%, +47%] † | mixed |
| Cost | +59% [−21%, +229%] † | −6% [−44%, +63%] † | mixed |
| Wall time | −22% [−54%, +30%] † | −24% [−37%, −6%] | fewer in every repetition, within the noise |

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
| flask | 3 | 2 | −1 | 4 / 1 / 0 |
| all | 3 | 2 | −1 | 4 / 1 / 0 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | 200 | 2,451 | +2,251 | 0 / 0 / 5 |
| all | 200 | 2,451 | +2,251 | 0 / 0 / 5 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | 565 | 379 | −66 | 4 / 0 / 1 |
| all | 565 | 379 | −66 | 4 / 0 / 1 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | 6,530 | 3,483 | −1,985 | 4 / 0 / 1 |
| all | 6,530 | 3,483 | −1,985 | 4 / 0 / 1 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | 2,915 | 3,056 | +248 | 2 / 0 / 3 |
| all | 2,915 | 3,056 | +248 | 2 / 0 / 3 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | 10,988 | 9,304 | −624 | 3 / 0 / 2 |
| all | 10,988 | 9,304 | −624 | 3 / 0 / 2 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd), or computed from the API's usage and a price table when the run went through the Messages API directly. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | $0.0178 | $0.0184 | +$0.0041 | 2 / 0 / 3 |
| all | $0.0178 | $0.0184 | +$0.0041 | 2 / 0 / 3 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | 5.3 s | 4.9 s | −1.0 s | 4 / 0 / 1 |
| all | 5.3 s | 4.9 s | −1.0 s | 4 / 0 / 1 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| flask | $0.1803 (10 runs) | $0.1865 (10 runs) | none | none |
| all | $0.1803 (10 runs) | $0.1865 (10 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| flask/x032 | without | 2/2 | 4 [3–5] | 209 [208–210] | 875 [693–1,056] | 6,990 [4,512–9,468] | 2,915 [988–4,841] | $0.0178 [$0.0107–$0.0250] | 8.1 s [6.7 s–9.5 s] |
| flask/x032 | with | 2/2 | 2 [1–3] | 2,515 [2,514–2,516] | 711 [590–832] | 3,483 [1,628–5,338] | 3,655 [2,903–4,407] | $0.0220 [$0.0185–$0.0254] | 5.9 s [4.6 s–7.2 s] |
| flask/x033 | without | 2/2 | 5 [4–5] | 209 [208–210] | 807 [714–900] | 18,924 [15,131–22,716] | 9,467 [9,280–9,654] | $0.0359 [$0.0347–$0.0372] | 13.7 s [10.3 s–17.2 s] |
| flask/x033 | with | 2/2 | 1 [1–1] | 2,713 [2,713–2,713] | 379 [372–385] | 1,628 [1,628–1,628] | 3,056 [2,962–3,149] | $0.0172 [$0.0169–$0.0175] | 5.7 s [5.4 s–5.9 s] |
| flask/x034 | without | 2/2 | 2 [2–2] | 200 [200–200] | 565 [535–595] | 6,530 [6,530–6,530] | 4,659 [4,621–4,696] | $0.0190 [$0.0188–$0.0192] | 5.3 s [5.1 s–5.4 s] |
| flask/x034 | with | 2/2 | 2 [2–2] | 2,451 [2,451–2,451] | 532 [529–534] | 4,545 [1,628–7,462] | 2,917 [0–5,834] | $0.0184 [$0.0117–$0.0252] | 4.3 s [3.9 s–4.6 s] |
| flask/x035 | without | 2/2 | 3 [2–3] | 192 [192–192] | 418 [357–478] | 2,792 [2,785–2,799] | 1,059 [611–1,506] | $0.0078 [$0.0060–$0.0095] | 4.3 s [4.1 s–4.5 s] |
| flask/x035 | with | 2/2 | 2 [2–2] | 2,334 [2,334–2,334] | 352 [351–352] | 1,628 [1,628–1,628] | 4,917 [4,846–4,988] | $0.0208 [$0.0206–$0.0210] | 3.3 s [3.2 s–3.4 s] |
| flask/x036 | without | 2/2 | 2 [1–2] | 195 [194–196] | 285 [242–328] | 2,472 [1,628–3,316] | 2,340 [437–4,242] | $0.0096 [$0.0042–$0.0149] | 3.5 s [3.0 s–4.1 s] |
| flask/x036 | with | 2/2 | 1 [1–1] | 2,182 [2,182–2,182] | 319 [269–368] | 4,216 [1,628–6,803] | 2,588 [0–5,175] | $0.0149 [$0.0094–$0.0203] | 4.9 s [4.5 s–5.4 s] |

