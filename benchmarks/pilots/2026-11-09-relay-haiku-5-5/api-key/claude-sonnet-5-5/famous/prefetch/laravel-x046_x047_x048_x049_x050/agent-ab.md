# Agent-level A/B — measured tool calls, tokens and cost

**anthropic-messages-api direct Messages API · claude-sonnet-5-5 · 2026-11-11 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap ranked the question BEFORE the first turn (what a prompt hook would inject): the five likeliest files with their signatures and line anchors after the question in the user turn, + the sigmap CLI; no MCP server, no standing section, no extra tool call.
- Both arms: the same prompt, model, tool allowlist (Read, Grep, Glob, Bash), per-run budget cap $0.25 and timeout 420 s; run in a clean copy of the commit pinned in `benchmarks/xrepo-repos.json`.
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
- Direct Messages API agent (scripts/lib/agent-ab-api.mjs), not Claude Code: a short neutral system prompt (about 150 tokens) and four read-only tools, so the prefix each turn re-reads is far smaller than Claude Code's and SigMap's per-turn addition is a larger share of a turn. Cost is computed from the usage the API reports and a price table (the Console's usage page is the authority), with 5-minute prompt caching. Not comparable cell by cell with Claude Code runs.

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
| Tool calls | −38% | −24% | fewer in every repetition |
| Input tokens (uncached) | +989% | +993% | more in every repetition |
| Output tokens | −27% | −19% | fewer in every repetition |
| Cache-read tokens | −56% | −37% | fewer in every repetition |
| Cache-write tokens | −33% | −13% | fewer in every repetition |
| Total tokens (derived) | −38% | −16% | fewer in every repetition |
| Cost | −20% | −1% | fewer in every repetition |
| Wall time | −18% | −27% | fewer in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −41% [−50%, −22%] | −27% [−50%, +7%] † | fewer in every repetition, within the noise |
| Input tokens (uncached) | +959% [+721%, +1173%] | +964% [+727%, +1173%] | more in every repetition, outside the noise |
| Output tokens | −28% [−38%, −15%] | −20% [−33%, −5%] | fewer in every repetition, outside the noise |
| Cache-read tokens | −66% [−84%, −31%] | −42% [−60%, −13%] | fewer in every repetition, outside the noise |
| Cache-write tokens | −32% [−54%, −4%] | −12% [−36%, +17%] † | fewer in every repetition, within the noise |
| Total tokens (derived) | −39% [−58%, −12%] | −13% [−28%, +9%] † | fewer in every repetition, within the noise |
| Cost | −20% [−37%, 0%] | +1% [−15%, +17%] † | mixed |
| Wall time | −23% [−43%, +9%] † | −29% [−53%, +8%] † | fewer in every repetition, within the noise |

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
| laravel | 5 | 4 | −2 | 4 / 0 / 1 |
| all | 5 | 4 | −2 | 4 / 0 / 1 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | 204 | 2,357 | +2,152 | 0 / 0 / 5 |
| all | 204 | 2,357 | +2,152 | 0 / 0 / 5 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | 814 | 619 | −231 | 5 / 0 / 0 |
| all | 814 | 619 | −231 | 5 / 0 / 0 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | 10,494 | 6,845 | −7,140 | 4 / 0 / 1 |
| all | 10,494 | 6,845 | −7,140 | 4 / 0 / 1 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | 7,194 | 5,468 | −1,384 | 4 / 0 / 1 |
| all | 7,194 | 5,468 | −1,384 | 4 / 0 / 1 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | 18,945 | 14,122 | −8,294 | 4 / 0 / 1 |
| all | 18,945 | 14,122 | −8,294 | 4 / 0 / 1 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd), or computed from the API's usage and a price table when the run went through the Messages API directly. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | $0.0284 | $0.0245 | −$0.0039 | 4 / 0 / 1 |
| all | $0.0284 | $0.0245 | −$0.0039 | 4 / 0 / 1 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | 9.2 s | 6.6 s | −1.6 s | 4 / 0 / 1 |
| all | 9.2 s | 6.6 s | −1.6 s | 4 / 0 / 1 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| laravel | $0.2826 (10 runs) | $0.2496 (10 runs) | none | none |
| all | $0.2826 (10 runs) | $0.2496 (10 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| laravel/x046 | without | 2/2 | 5 [4–5] | 205 [205–205] | 776 [760–791] | 10,494 [10,368–10,619] | 7,541 [6,185–8,897] | $0.0291 [$0.0255–$0.0327] | 11.1 s [10.3 s–11.8 s] |
| laravel/x046 | with | 2/2 | 2 [2–2] | 2,357 [2,356–2,358] | 545 [542–547] | 3,354 [1,628–5,080] | 3,000 [2,928–3,071] | $0.0183 [$0.0178–$0.0188] | 5.1 s [4.7 s–5.4 s] |
| laravel/x047 | without | 2/2 | 4 [4–4] | 196 [196–196] | 793 [747–839] | 10,404 [5,077–15,730] | 7,194 [4,303–10,085] | $0.0284 [$0.0206–$0.0362] | 9.5 s [9.2 s–9.9 s] |
| laravel/x047 | with | 2/2 | 2 [2–2] | 2,365 [2,365–2,365] | 490 [485–494] | 1,628 [1,628–1,628] | 5,810 [5,810–5,810] | $0.0245 [$0.0244–$0.0245] | 4.5 s [4.0 s–4.9 s] |
| laravel/x048 | without | 2/2 | 6 [4–7] | 208 [207–209] | 1,002 [864–1,139] | 20,837 [15,618–26,055] | 9,669 [8,533–10,805] | $0.0388 [$0.0335–$0.0440] | 9.2 s [8.4 s–10.1 s] |
| laravel/x048 | with | 2/2 | 4 [4–4] | 2,222 [2,222–2,222] | 884 [851–917] | 11,786 [10,031–13,540] | 7,402 [6,458–8,346] | $0.0341 [$0.0311–$0.0372] | 8.0 s [7.2 s–8.8 s] |
| laravel/x049 | without | 2/2 | 6 [5–6] | 201 [201–201] | 952 [919–984] | 11,844 [11,364–12,323] | 5,949 [5,807–6,090] | $0.0272 [$0.0270–$0.0273] | 8.2 s [7.3 s–9.1 s] |
| laravel/x049 | with | 2/2 | 4 [3–4] | 2,772 [2,772–2,772] | 619 [548–689] | 6,845 [6,752–6,938] | 5,468 [5,213–5,722] | $0.0268 [$0.0254–$0.0281] | 6.6 s [6.6 s–6.7 s] |
| laravel/x050 | without | 2/2 | 4 [3–5] | 204 [203–205] | 814 [752–876] | 8,296 [6,855–9,736] | 3,060 [2,820–3,299] | $0.0179 [$0.0163–$0.0194] | 7.8 s [6.9 s–8.8 s] |
| laravel/x050 | with | 2/2 | 5 [4–5] | 1,346 [1,346–1,346] | 798 [772–824] | 8,495 [8,094–8,895] | 3,484 [3,187–3,780] | $0.0211 [$0.0200–$0.0222] | 11.5 s [9.9 s–13.0 s] |

