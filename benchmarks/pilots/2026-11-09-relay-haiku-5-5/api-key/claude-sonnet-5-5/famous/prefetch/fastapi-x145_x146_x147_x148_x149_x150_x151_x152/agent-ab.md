# Agent-level A/B — measured tool calls, tokens and cost

**anthropic-messages-api direct Messages API · claude-sonnet-5-5 · 2026-11-11 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap ranked the question BEFORE the first turn (what a prompt hook would inject): the five likeliest files with their signatures and line anchors after the question in the user turn, + the sigmap CLI; no MCP server, no standing section, no extra tool call.
- Both arms: the same prompt, model, tool allowlist (Read, Grep, Glob, Bash), per-run budget cap $0.25 and timeout 420 s; run in a clean copy of the commit pinned in `benchmarks/xrepo-repos.json`.
- Questions: the task id(s) x145, x146, x147, x148, x149, x150, x151, x152 of `benchmarks/tasks/retrieval-xrepo.jsonl`. Pass = hit@5 on the repository-relative paths the answer names.
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
| fastapi | 8 | 16/16 | 16/16 | 0 / 0 |
| all | 8 | 16/16 | 16/16 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 8. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −23% | −29% | fewer in every repetition |
| Input tokens (uncached) | +842% | +840% | more in every repetition |
| Output tokens | −11% | −18% | fewer in every repetition |
| Cache-read tokens | −41% | −20% | fewer in every repetition |
| Cache-write tokens | −25% | −43% | fewer in every repetition |
| Total tokens (derived) | −18% | −12% | fewer in every repetition |
| Cost | −2% | −12% | fewer in every repetition |
| Wall time | −3% | −22% | fewer in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −22% [−46%, +14%] † | −35% [−50%, −15%] | fewer in every repetition, within the noise |
| Input tokens (uncached) | +774% [+567%, +1052%] | +772% [+563%, +1052%] | more in every repetition, outside the noise |
| Output tokens | −14% [−25%, −2%] | −22% [−32%, −4%] | fewer in every repetition, outside the noise |
| Cache-read tokens | −35% [−61%, +5%] † | −31% [−61%, +32%] † | fewer in every repetition, within the noise |
| Cache-write tokens | −15% [−48%, +35%] † | −11% [−54%, +73%] † n=6 | fewer in every repetition, within the noise |
| Total tokens (derived) | −9% [−40%, +37%] † | −12% [−46%, +49%] † | fewer in every repetition, within the noise |
| Cost | +3% [−27%, +43%] † | −12% [−41%, +37%] † | mixed |
| Wall time | −9% [−29%, +20%] † | −23% [−36%, −8%] | fewer in every repetition, within the noise |

### Outcome (hit@5), by repetition

Per paired task: **better** = the SigMap arm named the file and the other did not; **worse** = the reverse; **tie** = both found it or both missed. Localisation only.

| repetition | paired tasks | better | worse | tie |
| --- | ---: | ---: | ---: | ---: |
| R1 | 8 | 0 | 0 | 8 |
| R2 | 8 | 0 | 0 | 8 |
| all | 16 | 0 | 0 | 16 |

## Tool calls

Provenance: agent-reported (main-thread tool_use blocks). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | 3 | 2 | −1 | 5 / 2 / 1 |
| all | 3 | 2 | −1 | 5 / 2 / 1 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | 217 | 1,893 | +1,673 | 0 / 0 / 8 |
| all | 217 | 1,893 | +1,673 | 0 / 0 / 8 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | 536 | 431 | −105 | 7 / 0 / 1 |
| all | 536 | 431 | −105 | 7 / 0 / 1 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | 5,546 | 4,188 | −2,731 | 7 / 0 / 1 |
| all | 5,546 | 4,188 | −2,731 | 7 / 0 / 1 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | 3,971 | 2,976 | −2,110 | 6 / 0 / 2 |
| all | 3,971 | 2,976 | −2,110 | 6 / 0 / 2 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | 11,065 | 9,284 | −2,535 | 4 / 0 / 4 |
| all | 11,065 | 9,284 | −2,535 | 4 / 0 / 4 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd), or computed from the API's usage and a price table when the run went through the Messages API directly. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | $0.0168 | $0.0170 | −$0.0032 | 5 / 0 / 3 |
| all | $0.0168 | $0.0170 | −$0.0032 | 5 / 0 / 3 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | 5.9 s | 5.7 s | −1.1 s | 5 / 0 / 3 |
| all | 5.9 s | 5.7 s | −1.1 s | 5 / 0 / 3 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| fastapi | $0.2898 (16 runs) | $0.2693 (16 runs) | none | none |
| all | $0.2898 (16 runs) | $0.2693 (16 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| fastapi/x145 | without | 2/2 | 4 [3–4] | 217 [216–218] | 643 [605–680] | 8,273 [7,020–9,525] | 6,347 [2,622–10,071] | $0.0244 [$0.0152–$0.0336] | 7.8 s [7.0 s–8.5 s] |
| fastapi/x145 | with | 2/2 | 2 [2–2] | 1,426 [1,426–1,426] | 551 [524–578] | 4,196 [4,195–4,197] | 2,633 [2,621–2,644] | $0.0158 [$0.0155–$0.0160] | 9.8 s [7.6 s–12.0 s] |
| fastapi/x146 | without | 2/2 | 3 [3–3] | 219 [219–219] | 544 [541–546] | 5,399 [5,397–5,400] | 4,086 [4,035–4,136] | $0.0172 [$0.0170–$0.0173] | 5.9 s [5.6 s–6.1 s] |
| fastapi/x146 | with | 2/2 | 2 [1–2] | 2,528 [2,527–2,529] | 441 [334–548] | 5,194 [4,787–5,601] | 2,309 [0–4,618] | $0.0163 [$0.0094–$0.0232] | 6.6 s [5.5 s–7.7 s] |
| fastapi/x147 | without | 2/2 | 3 [3–3] | 216 [215–217] | 480 [475–485] | 7,333 [5,173–9,492] | 3,856 [3,643–4,068] | $0.0163 [$0.0163–$0.0164] | 5.9 s [5.4 s–6.4 s] |
| fastapi/x147 | with | 2/2 | 2 [2–2] | 1,829 [1,829–1,829] | 306 [297–315] | 3,041 [1,628–4,453] | 1,413 [0–2,825] | $0.0109 [$0.0077–$0.0140] | 3.3 s [3.2 s–3.4 s] |
| fastapi/x148 | without | 2/2 | 2 [1–3] | 208 [207–209] | 493 [441–545] | 5,694 [1,628–9,759] | 6,340 [4,904–7,775] | $0.0223 [$0.0174–$0.0273] | 5.4 s [4.9 s–5.9 s] |
| fastapi/x148 | with | 2/2 | 2 [2–2] | 1,288 [1,288–1,288] | 367 [355–379] | 1,628 [1,628–1,628] | 2,197 [1,947–2,446] | $0.0121 [$0.0116–$0.0126] | 4.0 s [3.8 s–4.2 s] |
| fastapi/x149 | without | 2/2 | 3 [2–3] | 211 [211–211] | 425 [402–447] | 3,024 [2,998–3,049] | 1,641 [1,185–2,096] | $0.0094 [$0.0080–$0.0107] | 4.8 s [4.6 s–5.0 s] |
| fastapi/x149 | with | 2/2 | 1 [1–1] | 3,637 [3,637–3,637] | 290 [272–308] | 1,628 [1,628–1,628] | 3,842 [3,788–3,896] | $0.0201 [$0.0201–$0.0201] | 3.7 s [3.4 s–4.0 s] |
| fastapi/x150 | without | 2/2 | 3 [2–3] | 216 [216–216] | 557 [550–564] | 3,906 [3,906–3,906] | 2,215 [2,205–2,224] | $0.0123 [$0.0122–$0.0124] | 7.0 s [6.4 s–7.6 s] |
| fastapi/x150 | with | 2/2 | 3 [2–4] | 2,589 [2,588–2,590] | 658 [503–812] | 11,576 [6,263–16,889] | 3,943 [3,463–4,423] | $0.0239 [$0.0225–$0.0253] | 5.9 s [5.0 s–6.8 s] |
| fastapi/x151 | without | 2/2 | 3 [3–3] | 224 [224–224] | 528 [490–566] | 15,270 [14,385–16,155] | 7,217 [6,774–7,659] | $0.0268 [$0.0259–$0.0277] | 5.1 s [4.9 s–5.3 s] |
| fastapi/x151 | with | 2/2 | 2 [2–2] | 1,957 [1,957–1,957] | 420 [411–429] | 5,454 [5,357–5,550] | 3,527 [3,407–3,647] | $0.0180 [$0.0178–$0.0183] | 6.0 s [5.4 s–6.6 s] |
| fastapi/x152 | without | 2/2 | 4 [3–4] | 219 [218–220] | 647 [566–728] | 4,204 [3,030–5,377] | 3,363 [2,315–4,410] | $0.0162 [$0.0125–$0.0198] | 9.8 s [8.5 s–11.2 s] |
| fastapi/x152 | with | 2/2 | 4 [3–4] | 1,028 [1,028–1,028] | 645 [626–664] | 4,180 [3,985–4,374] | 3,319 [3,154–3,483] | $0.0176 [$0.0170–$0.0183] | 5.6 s [5.3 s–5.8 s] |

