# Agent-level A/B — measured tool calls, tokens and cost

**anthropic-messages-api direct Messages API · claude-haiku-5-5 · 2026-11-11 · 4 runs per arm · publishable**

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
| laravel | 5 | 20/20 | 20/20 | 0 / 0 |
| all | 5 | 20/20 | 20/20 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2, R3, R4) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 5. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | R3 | R4 | verdict |
| --- | ---: | ---: | ---: | ---: | ---: |
| Tool calls | −46% | −70% | −43% | −67% | fewer in every repetition |
| Input tokens (uncached) | +991% | +982% | +993% | +982% | more in every repetition |
| Output tokens | −20% | −23% | −12% | −26% | fewer in every repetition |
| Cache-read tokens | −66% | −87% | −52% | −84% | fewer in every repetition |
| Cache-write tokens | −43% | −53% | −46% | −63% | fewer in every repetition |
| Total tokens (derived) | −48% | −69% | −39% | −70% | fewer in every repetition |
| Cost | −26% | −37% | −23% | −44% | fewer in every repetition |
| Wall time | −15% | −31% | −19% | −31% | fewer in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | R3 | R4 | verdict |
| --- | ---: | ---: | ---: | ---: | ---: |
| Tool calls | −50% [−66%, −34%] | −73% [−82%, −58%] | −53% [−70%, −26%] | −61% [−72%, −39%] n=4 | fewer in every repetition, outside the noise |
| Input tokens (uncached) | +962% [+722%, +1173%] | +953% [+717%, +1164%] | +964% [+727%, +1173%] | +953% [+713%, +1159%] | more in every repetition, outside the noise |
| Output tokens | −21% [−32%, −10%] | −25% [−33%, −12%] | −14% [−32%, +6%] † | −27% [−46%, +5%] † | fewer in every repetition, within the noise |
| Cache-read tokens | −68% [−84%, −49%] | −88% [−91%, −84%] | −64% [−86%, −6%] | −89% [−95%, −75%] | fewer in every repetition, outside the noise |
| Cache-write tokens | −38% [−62%, +4%] † | −52% [−63%, −37%] | −45% [−55%, −32%] | −54% [−62%, −43%] n=4 | fewer in every repetition, within the noise |
| Total tokens (derived) | −47% [−66%, −23%] | −69% [−74%, −63%] | −40% [−63%, 0%] | −72% [−84%, −55%] | fewer in every repetition, outside the noise |
| Cost | −25% [−45%, 0%] | −36% [−45%, −24%] | −23% [−39%, −3%] | −46% [−59%, −25%] | fewer in every repetition, outside the noise |
| Wall time | −16% [−27%, −3%] | −32% [−39%, −22%] | −22% [−41%, +4%] † | −32% [−46%, −14%] | fewer in every repetition, within the noise |

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
| laravel | 5 | 3 | −3 | 5 / 0 / 0 |
| all | 5 | 3 | −3 | 5 / 0 / 0 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | 205 | 2,357 | +2,151 | 0 / 0 / 5 |
| all | 205 | 2,357 | +2,151 | 0 / 0 / 5 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | 1,164 | 808 | −244 | 4 / 0 / 1 |
| all | 1,164 | 808 | −244 | 4 / 0 / 1 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | 17,095 | 3,762 | −15,467 | 5 / 0 / 0 |
| all | 17,095 | 3,762 | −15,467 | 5 / 0 / 0 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | 9,521 | 3,758 | −5,152 | 5 / 0 / 0 |
| all | 9,521 | 3,758 | −5,152 | 5 / 0 / 0 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | 28,743 | 12,409 | −18,618 | 5 / 0 / 0 |
| all | 28,743 | 12,409 | −18,618 | 5 / 0 / 0 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd), or computed from the API's usage and a price table when the run went through the Messages API directly. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | $0.0020 | $0.0012 | −$0.0007 | 5 / 0 / 0 |
| all | $0.0020 | $0.0012 | −$0.0007 | 5 / 0 / 0 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | 6.8 s | 5.2 s | −1.8 s | 5 / 0 / 0 |
| all | 6.8 s | 5.2 s | −1.8 s | 5 / 0 / 0 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| laravel | $0.0371 (20 runs) | $0.0247 (20 runs) | none | none |
| all | $0.0371 (20 runs) | $0.0247 (20 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| laravel/x046 | without | 4/4 | 7 [5–7] | 206 [205–207] | 1,175 [1,045–1,225] | 11,266 [7,340–14,905] | 4,705 [2,453–6,409] | $0.0013 [$0.0010–$0.0016] | 7.1 s [6.4 s–7.5 s] |
| laravel/x046 | with | 4/4 | 3 [1–5] | 2,357 [2,356–2,362] | 932 [749–1,238] | 3,612 [1,628–13,690] | 3,502 [3,029–4,124] | $0.0012 [$0.0010–$0.0015] | 5.2 s [4.0 s–6.8 s] |
| laravel/x047 | without | 4/4 | 4 [4–4] | 196 [196–198] | 1,164 [1,105–1,203] | 17,095 [16,253–26,459] | 9,521 [9,286–11,170] | $0.0020 [$0.0019–$0.0021] | 6.8 s [6.3 s–7.2 s] |
| laravel/x047 | with | 4/4 | 1 [0–1] | 2,365 [2,363–2,365] | 734 [618–911] | 1,628 [814–1,628] | 3,480 [0–4,842] | $0.0011 [$0.0007–$0.0012] | 4.2 s [3.2 s–4.5 s] |
| laravel/x048 | without | 4/4 | 4 [4–6] | 207 [207–211] | 993 [917–1,244] | 16,378 [16,126–36,917] | 10,363 [10,003–10,654] | $0.0020 [$0.0019–$0.0023] | 6.9 s [6.7 s–9.1 s] |
| laravel/x048 | with | 4/4 | 3 [1–3] | 2,220 [2,218–2,220] | 1,105 [739–1,457] | 6,411 [1,628–6,491] | 6,007 [4,053–7,016] | $0.0016 [$0.0011–$0.0018] | 6.0 s [3.9 s–7.1 s] |
| laravel/x049 | without | 4/4 | 5 [4–8] | 202 [201–203] | 1,172 [1,009–1,680] | 19,883 [10,686–27,845] | 9,835 [6,500–11,309] | $0.0020 [$0.0015–$0.0026] | 6.5 s [5.7 s–8.3 s] |
| laravel/x049 | with | 4/4 | 2 [1–3] | 2,771 [2,770–2,772] | 808 [763–1,024] | 3,762 [1,628–6,727] | 4,567 [3,323–6,488] | $0.0013 [$0.0011–$0.0016] | 4.7 s [4.3 s–5.5 s] |
| laravel/x050 | without | 4/4 | 5 [5–8] | 205 [203–207] | 1,010 [773–1,227] | 24,652 [16,611–36,539] | 8,910 [7,915–10,092] | $0.0019 [$0.0016–$0.0023] | 5.9 s [5.3 s–7.2 s] |
| laravel/x050 | with | 4/4 | 3 [3–3] | 1,346 [1,344–1,346] | 789 [776–800] | 8,514 [4,351–8,631] | 3,758 [3,441–4,611] | $0.0011 [$0.0010–$0.0011] | 5.8 s [5.2 s–6.3 s] |

