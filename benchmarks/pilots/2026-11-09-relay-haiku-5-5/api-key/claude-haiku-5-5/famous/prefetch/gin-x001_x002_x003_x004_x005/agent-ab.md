# Agent-level A/B — measured tool calls, tokens and cost

**anthropic-messages-api direct Messages API · claude-haiku-5-5 · 2026-11-11 · 4 runs per arm · publishable**

- Arms: **without** = no SigMap; **with** = SigMap ranked the question BEFORE the first turn (what a prompt hook would inject): the five likeliest files with their signatures and line anchors after the question in the user turn, + the sigmap CLI; no MCP server, no standing section, no extra tool call.
- Both arms: the same prompt, model, tool allowlist (Read, Grep, Glob, Bash), per-run budget cap $0.25 and timeout 420 s; run in a clean copy of the commit pinned in `benchmarks/xrepo-repos.json`.
- Questions: the task id(s) x001, x002, x003, x004, x005 of `benchmarks/tasks/retrieval-xrepo.jsonl`. Pass = hit@5 on the repository-relative paths the answer names.
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
| gin | 5 | 20/20 | 20/20 | 0 / 0 |
| all | 5 | 20/20 | 20/20 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2, R3, R4) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 5. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | R3 | R4 | verdict |
| --- | ---: | ---: | ---: | ---: | ---: |
| Tool calls | −61% | −69% | −50% | −64% | fewer in every repetition |
| Input tokens (uncached) | +1477% | +1479% | +1483% | +1476% | more in every repetition |
| Output tokens | −19% | −12% | −13% | −8% | fewer in every repetition |
| Cache-read tokens | −47% | −75% | −47% | −53% | fewer in every repetition |
| Cache-write tokens | −13% | −5% | −7% | −40% | fewer in every repetition |
| Total tokens (derived) | −7% | −16% | −3% | −20% | fewer in every repetition |
| Cost | +8% | +18% | +15% | −2% | mixed |
| Wall time | −2% | −12% | −9% | −14% | fewer in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | R3 | R4 | verdict |
| --- | ---: | ---: | ---: | ---: | ---: |
| Tool calls | −54% [−74%, 0%] † | −58% [−75%, −29%] n=4 | −49% [−73%, +25%] † | −37% [−75%, 0%] † n=3 | fewer in every repetition, within the noise |
| Input tokens (uncached) | +1474% [+1333%, +1638%] | +1477% [+1322%, +1661%] | +1481% [+1329%, +1653%] | +1474% [+1324%, +1649%] | more in every repetition, outside the noise |
| Output tokens | −17% [−27%, −1%] | −11% [−27%, +14%] † | −13% [−25%, −1%] | −7% [−25%, +13%] † | fewer in every repetition, within the noise |
| Cache-read tokens | −46% [−80%, +51%] † | −70% [−82%, −42%] | −42% [−83%, +124%] † | −63% [−87%, +14%] † | fewer in every repetition, within the noise |
| Cache-write tokens | −9% [−30%, +18%] † | +60% [−13%, +328%] † n=4 | +1% [−30%, +29%] † | +7% [−30%, +118%] † n=3 | mixed |
| Total tokens (derived) | −3% [−33%, +41%] † | −4% [−40%, +84%] † | +14% [−43%, +104%] † | −21% [−59%, +57%] † | mixed |
| Cost | +11% [−6%, +32%] † | +25% [−13%, +100%] † | +22% [−13%, +52%] † | −2% [−33%, +51%] † | mixed |
| Wall time | −1% [−15%, +18%] † | −12% [−25%, +6%] † | −10% [−26%, +7%] † | −13% [−31%, +1%] † | fewer in every repetition, within the noise |

### Outcome (hit@5), by repetition

Per paired task: **better** = the SigMap arm named the file and the other did not; **worse** = the reverse; **tie** = both found it or both missed. Localisation only.

| repetition | paired tasks | better | worse | tie |
| --- | ---: | ---: | ---: | ---: |
| R1 | 5 | 0 | 0 | 5 |
| R2 | 5 | 0 | 0 | 5 |
| R3 | 5 | 0 | 0 | 5 |
| R4 | 5 | 0 | 0 | 5 |
| all | 20 | 0 | 0 | 20 |

## Tool calls

Provenance: agent-reported (main-thread tool_use blocks). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 2 | 1 | −2 | 4 / 0 / 1 |
| all | 2 | 1 | −2 | 4 / 0 / 1 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 201 | 3,211 | +3,008 | 0 / 0 / 5 |
| all | 201 | 3,211 | +3,008 | 0 / 0 / 5 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 860 | 674 | −33 | 3 / 0 / 2 |
| all | 860 | 674 | −33 | 3 / 0 / 2 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 3,312 | 1,628 | −1,920 | 3 / 0 / 2 |
| all | 3,312 | 1,628 | −1,920 | 3 / 0 / 2 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 4,957 | 4,661 | −296 | 4 / 0 / 1 |
| all | 4,957 | 4,661 | −296 | 4 / 0 / 1 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 9,376 | 10,808 | −555 | 3 / 0 / 2 |
| all | 9,376 | 10,808 | −555 | 3 / 0 / 2 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd), or computed from the API's usage and a price table when the run went through the Messages API directly. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | $0.0011 | $0.0013 | +$0.0001 | 1 / 0 / 4 |
| all | $0.0011 | $0.0013 | +$0.0001 | 1 / 0 / 4 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 4.8 s | 4.0 s | −120 ms | 3 / 0 / 2 |
| all | 4.8 s | 4.0 s | −120 ms | 3 / 0 / 2 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| gin | $0.0220 (20 runs) | $0.0241 (20 runs) | none | none |
| all | $0.0220 (20 runs) | $0.0241 (20 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| gin/x001 | without | 4/4 | 4 [3–4] | 201 [198–202] | 860 [689–975] | 10,092 [3,500–12,032] | 5,253 [4,138–7,016] | $0.0012 [$0.0011–$0.0014] | 5.5 s [4.3 s–6.6 s] |
| gin/x001 | with | 4/4 | 1 [0–1] | 3,345 [3,343–3,345] | 642 [571–711] | 1,628 [814–1,628] | 5,194 [0–6,759] | $0.0013 [$0.0006–$0.0015] | 4.3 s [3.6 s–6.3 s] |
| gin/x002 | without | 4/4 | 2 [1–2] | 211 [210–212] | 866 [751–1,025] | 3,312 [1,628–5,244] | 4,957 [4,048–5,371] | $0.0011 [$0.0010–$0.0012] | 4.8 s [4.5 s–5.3 s] |
| gin/x002 | with | 4/4 | 2 [1–3] | 2,865 [2,863–2,867] | 833 [523–877] | 5,782 [1,628–9,774] | 4,661 [3,464–5,681] | $0.0013 [$0.0012–$0.0015] | 4.9 s [3.8 s–5.7 s] |
| gin/x003 | without | 4/4 | 2 [2–3] | 203 [203–203] | 569 [495–588] | 3,141 [3,084–3,200] | 3,788 [3,731–3,847] | $0.0008 [$0.0008–$0.0008] | 3.6 s [3.5 s–3.9 s] |
| gin/x003 | with | 4/4 | 1 [0–1] | 3,211 [3,210–3,212] | 577 [553–723] | 1,221 [814–1,628] | 2,079 [0–4,175] | $0.0009 [$0.0006–$0.0011] | 3.5 s [3.1 s–4.8 s] |
| gin/x004 | without | 4/4 | 4 [3–5] | 200 [199–201] | 939 [876–1,029] | 10,438 [8,433–19,509] | 8,370 [6,621–10,708] | $0.0016 [$0.0014–$0.0020] | 5.3 s [5.0 s–5.8 s] |
| gin/x004 | with | 4/4 | 1 [1–1] | 2,855 [2,855–2,855] | 674 [646–923] | 1,628 [1,628–1,628] | 5,284 [5,177–6,919] | $0.0013 [$0.0013–$0.0016] | 3.9 s [3.4 s–4.9 s] |
| gin/x005 | without | 4/4 | 2 [1–8] | 180 [178–182] | 625 [562–1,241] | 2,909 [1,628–6,612] | 2,521 [543–3,168] | $0.0007 [$0.0004–$0.0011] | 3.7 s [3.4 s–6.3 s] |
| gin/x005 | with | 4/4 | 2 [1–2] | 3,426 [3,425–3,427] | 699 [573–849] | 3,909 [1,628–6,256] | 4,045 [3,801–4,312] | $0.0012 [$0.0011–$0.0014] | 4.0 s [3.6 s–5.3 s] |

