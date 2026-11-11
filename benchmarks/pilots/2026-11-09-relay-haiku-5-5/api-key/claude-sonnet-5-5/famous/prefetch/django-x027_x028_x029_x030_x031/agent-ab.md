# Agent-level A/B — measured tool calls, tokens and cost

**anthropic-messages-api direct Messages API · claude-sonnet-5-5 · 2026-11-11 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap ranked the question BEFORE the first turn (what a prompt hook would inject): the five likeliest files with their signatures and line anchors after the question in the user turn, + the sigmap CLI; no MCP server, no standing section, no extra tool call.
- Both arms: the same prompt, model, tool allowlist (Read, Grep, Glob, Bash), per-run budget cap $0.25 and timeout 420 s; run in a clean copy of the commit pinned in `benchmarks/xrepo-repos.json`.
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
- Direct Messages API agent (scripts/lib/agent-ab-api.mjs), not Claude Code: a short neutral system prompt (about 150 tokens) and four read-only tools, so the prefix each turn re-reads is far smaller than Claude Code's and SigMap's per-turn addition is a larger share of a turn. Cost is computed from the usage the API reports and a price table (the Console's usage page is the authority), with 5-minute prompt caching. Not comparable cell by cell with Claude Code runs.

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
| Tool calls | −54% | −47% | fewer in every repetition |
| Input tokens (uncached) | +897% | +895% | more in every repetition |
| Output tokens | −31% | −39% | fewer in every repetition |
| Cache-read tokens | −57% | −37% | fewer in every repetition |
| Cache-write tokens | −38% | −71% | fewer in every repetition |
| Total tokens (derived) | −32% | −36% | fewer in every repetition |
| Cost | −14% | −40% | fewer in every repetition |
| Wall time | −18% | −38% | fewer in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −33% [−55%, 0%] † n=4 | −49% [−64%, −28%] | fewer in every repetition, within the noise |
| Input tokens (uncached) | +868% [+673%, +1061%] | +866% [+671%, +1058%] | more in every repetition, outside the noise |
| Output tokens | −31% [−41%, −16%] | −40% [−51%, −27%] | fewer in every repetition, outside the noise |
| Cache-read tokens | −54% [−79%, +5%] † | −37% [−67%, +32%] † | fewer in every repetition, within the noise |
| Cache-write tokens | +22% [−48%, +185%] † n=4 | −55% [−75%, −33%] n=3 | mixed |
| Total tokens (derived) | −22% [−63%, +69%] † | −31% [−49%, +16%] † | fewer in every repetition, within the noise |
| Cost | −8% [−47%, +65%] † | −40% [−55%, −15%] | fewer in every repetition, within the noise |
| Wall time | −17% [−35%, +3%] † | −40% [−53%, −24%] | fewer in every repetition, within the noise |

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
| django | 3 | 1 | −2 | 4 / 1 / 0 |
| all | 3 | 1 | −2 | 4 / 1 / 0 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | 197 | 1,932 | +1,735 | 0 / 0 / 5 |
| all | 197 | 1,932 | +1,735 | 0 / 0 / 5 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | 506 | 286 | −174 | 5 / 0 / 0 |
| all | 506 | 286 | −174 | 5 / 0 / 0 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | 4,526 | 2,986 | −2,071 | 4 / 0 / 1 |
| all | 4,526 | 2,986 | −2,071 | 4 / 0 / 1 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | 3,019 | 2,042 | −2,184 | 4 / 0 / 1 |
| all | 3,019 | 2,042 | −2,184 | 4 / 0 / 1 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | 8,248 | 6,922 | −3,389 | 4 / 0 / 1 |
| all | 8,248 | 6,922 | −3,389 | 4 / 0 / 1 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd), or computed from the API's usage and a price table when the run went through the Messages API directly. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | $0.0139 | $0.0125 | −$0.0054 | 4 / 0 / 1 |
| all | $0.0139 | $0.0125 | −$0.0054 | 4 / 0 / 1 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | 4.9 s | 3.4 s | −1.4 s | 4 / 0 / 1 |
| all | 4.9 s | 3.4 s | −1.4 s | 4 / 0 / 1 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| django | $0.1844 (10 runs) | $0.1313 (10 runs) | none | none |
| all | $0.1844 (10 runs) | $0.1313 (10 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| django/x027 | without | 2/2 | 2 [1–2] | 197 [196–198] | 506 [423–589] | 4,526 [1,628–7,424] | 3,019 [662–5,376] | $0.0139 [$0.0066–$0.0212] | 4.8 s [4.4 s–5.2 s] |
| django/x027 | with | 2/2 | 1 [1–1] | 2,310 [2,310–2,310] | 268 [265–271] | 2,986 [1,628–4,344] | 1,358 [0–2,716] | $0.0113 [$0.0082–$0.0144] | 3.4 s [3.0 s–3.7 s] |
| django/x028 | without | 2/2 | 3 [2–3] | 195 [195–195] | 440 [405–475] | 4,405 [4,398–4,412] | 2,891 [2,749–3,032] | $0.0129 [$0.0129–$0.0129] | 4.5 s [4.0 s–4.9 s] |
| django/x028 | with | 2/2 | 1 [1–1] | 1,223 [1,223–1,223] | 278 [246–309] | 2,335 [1,628–3,041] | 707 [0–1,413] | $0.0075 [$0.0061–$0.0088] | 3.2 s [3.1 s–3.4 s] |
| django/x029 | without | 2/2 | 2 [2–2] | 199 [199–199] | 514 [483–545] | 2,923 [2,906–2,939] | 1,533 [1,525–1,541] | $0.0100 [$0.0097–$0.0102] | 4.9 s [4.7 s–5.2 s] |
| django/x029 | with | 2/2 | 2 [2–2] | 1,887 [1,887–1,887] | 471 [469–472] | 5,589 [4,540–6,638] | 2,042 [1,028–3,056] | $0.0147 [$0.0124–$0.0170] | 5.1 s [4.6 s–5.6 s] |
| django/x030 | without | 2/2 | 3 [3–3] | 197 [197–197] | 460 [448–471] | 7,584 [7,380–7,788] | 6,927 [5,844–8,009] | $0.0238 [$0.0213–$0.0264] | 6.6 s [6.4 s–6.8 s] |
| django/x030 | with | 2/2 | 1 [0–1] | 1,932 [1,931–1,933] | 286 [213–359] | 1,221 [814–1,628] | 2,219 [0–4,437] | $0.0125 [$0.0076–$0.0174] | 3.1 s [2.5 s–3.7 s] |
| django/x031 | without | 2/2 | 5 [5–5] | 207 [207–207] | 895 [737–1,053] | 15,234 [15,159–15,309] | 7,684 [7,582–7,786] | $0.0316 [$0.0298–$0.0335] | 7.4 s [6.4 s–8.5 s] |
| django/x031 | with | 2/2 | 3 [2–3] | 2,557 [2,557–2,557] | 527 [407–647] | 6,446 [5,111–7,780] | 3,201 [1,954–4,448] | $0.0197 [$0.0180–$0.0213] | 5.3 s [5.2 s–5.5 s] |

