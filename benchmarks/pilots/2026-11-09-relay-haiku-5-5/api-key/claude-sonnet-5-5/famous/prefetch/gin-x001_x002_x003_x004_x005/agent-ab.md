# Agent-level A/B — measured tool calls, tokens and cost

**anthropic-messages-api direct Messages API · claude-sonnet-5-5 · 2026-11-11 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

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
| gin | 5 | 10/10 | 10/10 | 0 / 0 |
| all | 5 | 10/10 | 10/10 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 5. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −64% | −45% | fewer in every repetition |
| Input tokens (uncached) | +1479% | +1486% | more in every repetition |
| Output tokens | −25% | −17% | fewer in every repetition |
| Cache-read tokens | −77% | −29% | fewer in every repetition |
| Cache-write tokens | −15% | +30% | mixed |
| Total tokens (derived) | −25% | +37% | mixed |
| Cost | +9% | +51% | more in every repetition |
| Wall time | −25% | −15% | fewer in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −51% [−67%, −24%] n=4 | −44% [−64%, −13%] | fewer in every repetition, outside the noise |
| Input tokens (uncached) | +1477% [+1326%, +1652%] | +1484% [+1328%, +1668%] | more in every repetition, outside the noise |
| Output tokens | −22% [−40%, +3%] † | −17% [−28%, −3%] | fewer in every repetition, within the noise |
| Cache-read tokens | −72% [−88%, −50%] | −37% [−65%, +24%] † | fewer in every repetition, within the noise |
| Cache-write tokens | +68% [−11%, +260%] † n=4 | +116% [+21%, +366%] n=4 | more in every repetition, within the noise |
| Total tokens (derived) | −13% [−62%, +65%] † | +50% [+9%, +125%] | mixed |
| Cost | +19% [−37%, +111%] † | +57% [+16%, +109%] | more in every repetition, within the noise |
| Wall time | −23% [−61%, +42%] † | −15% [−37%, +8%] † | fewer in every repetition, within the noise |

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
| gin | 3 | 1 | −2 | 4 / 1 / 0 |
| all | 3 | 1 | −2 | 4 / 1 / 0 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 199 | 3,212 | +3,009 | 0 / 0 / 5 |
| all | 199 | 3,212 | +3,009 | 0 / 0 / 5 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 522 | 475 | −69 | 4 / 0 / 1 |
| all | 522 | 475 | −69 | 4 / 0 / 1 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 4,517 | 1,628 | −2,889 | 4 / 0 / 1 |
| all | 4,517 | 1,628 | −2,889 | 4 / 0 / 1 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 2,900 | 3,393 | −264 | 3 / 0 / 2 |
| all | 2,900 | 3,393 | −264 | 3 / 0 / 2 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 8,089 | 9,304 | +286 | 2 / 0 / 3 |
| all | 8,089 | 9,304 | +286 | 2 / 0 / 3 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd), or computed from the API's usage and a price table when the run went through the Messages API directly. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | $0.0132 | $0.0194 | +$0.0049 | 1 / 0 / 4 |
| all | $0.0132 | $0.0194 | +$0.0049 | 1 / 0 / 4 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 5.4 s | 4.7 s | −751 ms | 4 / 0 / 1 |
| all | 5.4 s | 4.7 s | −751 ms | 4 / 0 / 1 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| gin | $0.1583 (10 runs) | $0.2005 (10 runs) | none | none |
| all | $0.1583 (10 runs) | $0.2005 (10 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| gin/x001 | without | 2/2 | 4 [3–4] | 199 [198–200] | 597 [538–655] | 10,084 [3,839–16,329] | 4,565 [1,908–7,222] | $0.0198 [$0.0113–$0.0283] | 12.1 s [8.2 s–15.9 s] |
| gin/x001 | with | 2/2 | 1 [0–1] | 3,344 [3,343–3,345] | 408 [390–426] | 1,221 [814–1,628] | 1,902 [0–3,803] | $0.0158 [$0.0111–$0.0204] | 3.9 s [3.8 s–4.0 s] |
| gin/x002 | without | 2/2 | 2 [2–2] | 212 [212–212] | 460 [433–486] | 4,517 [4,440–4,594] | 2,900 [2,180–3,620] | $0.0132 [$0.0116–$0.0147] | 5.4 s [5.1 s–5.7 s] |
| gin/x002 | with | 2/2 | 2 [2–2] | 2,863 [2,863–2,863] | 491 [465–517] | 1,628 [1,628–1,628] | 3,393 [3,326–3,459] | $0.0194 [$0.0190–$0.0199] | 4.7 s [4.6 s–4.8 s] |
| gin/x003 | without | 2/2 | 3 [2–3] | 203 [203–203] | 489 [462–516] | 3,061 [3,061–3,061] | 2,707 [2,612–2,802] | $0.0127 [$0.0122–$0.0132] | 4.7 s [4.5 s–5.0 s] |
| gin/x003 | with | 2/2 | 1 [1–1] | 3,212 [3,212–3,212] | 420 [383–457] | 4,072 [1,628–6,515] | 2,444 [0–4,887] | $0.0175 [$0.0123–$0.0228] | 3.9 s [3.7 s–4.1 s] |
| gin/x004 | without | 2/2 | 3 [3–3] | 199 [199–199] | 832 [670–994] | 5,313 [5,313–5,313] | 6,456 [5,839–7,073] | $0.0259 [$0.0228–$0.0291] | 6.7 s [5.8 s–7.6 s] |
| gin/x004 | with | 2/2 | 1 [1–1] | 2,855 [2,855–2,855] | 496 [494–498] | 1,628 [1,628–1,628] | 6,063 [5,998–6,128] | $0.0262 [$0.0260–$0.0263] | 6.3 s [5.9 s–6.7 s] |
| gin/x005 | without | 2/2 | 2 [1–2] | 179 [178–180] | 522 [481–563] | 2,262 [1,628–2,896] | 615 [564–666] | $0.0076 [$0.0074–$0.0077] | 5.2 s [5.2 s–5.3 s] |
| gin/x005 | with | 2/2 | 1 [1–1] | 3,425 [3,425–3,425] | 475 [396–553] | 1,628 [1,628–1,628] | 3,776 [3,769–3,783] | $0.0214 [$0.0206–$0.0222] | 8.5 s [5.7 s–11.2 s] |

