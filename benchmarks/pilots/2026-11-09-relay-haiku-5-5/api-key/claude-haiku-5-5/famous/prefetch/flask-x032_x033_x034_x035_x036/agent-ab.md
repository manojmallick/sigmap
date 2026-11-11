# Agent-level A/B — measured tool calls, tokens and cost

**anthropic-messages-api direct Messages API · claude-haiku-5-5 · 2026-11-11 · 4 runs per arm · publishable**

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
| flask | 5 | 20/20 | 20/20 | 0 / 0 |
| all | 5 | 20/20 | 20/20 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2, R3, R4) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 5. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | R3 | R4 | verdict |
| --- | ---: | ---: | ---: | ---: | ---: |
| Tool calls | −67% | −82% | −67% | −80% | fewer in every repetition |
| Input tokens (uncached) | +1114% | +1112% | +1117% | +1110% | more in every repetition |
| Output tokens | −11% | −24% | −10% | −15% | fewer in every repetition |
| Cache-read tokens | −70% | −87% | −76% | −79% | fewer in every repetition |
| Cache-write tokens | −52% | −70% | −59% | −69% | fewer in every repetition |
| Total tokens (derived) | −44% | −65% | −53% | −59% | fewer in every repetition |
| Cost | −21% | −42% | −29% | −38% | fewer in every repetition |
| Wall time | −19% | −26% | −19% | −23% | fewer in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | R3 | R4 | verdict |
| --- | ---: | ---: | ---: | ---: | ---: |
| Tool calls | −42% [−80%, +200%] † n=3 | −74% [−83%, −67%] n=3 | −50% [−83%, +200%] † n=3 | −70% [−83%, −50%] n=3 | fewer in every repetition, within the noise |
| Input tokens (uncached) | +1112% [+1045%, +1182%] | +1109% [+1045%, +1174%] | +1114% [+1053%, +1181%] | +1107% [+1043%, +1171%] | more in every repetition, outside the noise |
| Output tokens | −14% [−41%, +23%] † | −24% [−35%, −12%] | −11% [−32%, +27%] † | −16% [−27%, −2%] | fewer in every repetition, within the noise |
| Cache-read tokens | −72% [−90%, +12%] † | −86% [−91%, −76%] | −72% [−91%, +29%] † | −83% [−89%, −71%] | fewer in every repetition, within the noise |
| Cache-write tokens | −30% [−75%, +79%] † n=3 | −59% [−76%, −35%] n=3 | −47% [−73%, +17%] † n=3 | −58% [−72%, −45%] n=3 | fewer in every repetition, within the noise |
| Total tokens (derived) | −46% [−73%, +27%] † | −62% [−77%, −36%] | −47% [−74%, +21%] † | −62% [−72%, −48%] | fewer in every repetition, within the noise |
| Cost | −26% [−56%, +33%] † | −39% [−58%, −14%] | −28% [−54%, +19%] † | −41% [−51%, −28%] | fewer in every repetition, within the noise |
| Wall time | −21% [−45%, +17%] † | −27% [−37%, −16%] | −19% [−38%, +17%] † | −24% [−36%, −10%] | fewer in every repetition, within the noise |

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
| flask | 3 | 1 | −3 | 4 / 1 / 0 |
| all | 3 | 1 | −3 | 4 / 1 / 0 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | 202 | 2,451 | +2,249 | 0 / 0 / 5 |
| all | 202 | 2,451 | +2,249 | 0 / 0 / 5 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | 782 | 767 | −127 | 4 / 0 / 1 |
| all | 782 | 767 | −127 | 4 / 0 / 1 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | 8,318 | 1,628 | −7,504 | 4 / 0 / 1 |
| all | 8,318 | 1,628 | −7,504 | 4 / 0 / 1 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | 6,259 | 3,167 | −3,754 | 5 / 0 / 0 |
| all | 6,259 | 3,167 | −3,754 | 5 / 0 / 0 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | 15,093 | 8,216 | −11,578 | 4 / 0 / 1 |
| all | 15,093 | 8,216 | −11,578 | 4 / 0 / 1 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd), or computed from the API's usage and a price table when the run went through the Messages API directly. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | $0.0012 | $0.0011 | −$0.0005 | 4 / 0 / 1 |
| all | $0.0012 | $0.0011 | −$0.0005 | 4 / 0 / 1 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| flask | 4.8 s | 4.3 s | −1.1 s | 4 / 0 / 1 |
| all | 4.8 s | 4.3 s | −1.1 s | 4 / 0 / 1 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| flask | $0.0279 (20 runs) | $0.0186 (20 runs) | none | none |
| all | $0.0279 (20 runs) | $0.0186 (20 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| flask/x032 | without | 4/4 | 6 [5–6] | 208 [208–208] | 1,249 [1,010–1,306] | 15,977 [15,204–16,516] | 12,376 [11,729–13,361] | $0.0023 [$0.0022–$0.0025] | 6.6 s [5.7 s–6.9 s] |
| flask/x032 | with | 4/4 | 1 [1–1] | 2,514 [2,514–2,514] | 907 [767–1,151] | 1,628 [1,628–1,628] | 3,167 [3,146–3,426] | $0.0011 [$0.0010–$0.0013] | 4.6 s [3.9 s–5.5 s] |
| flask/x033 | without | 4/4 | 2 [1–3] | 205 [204–206] | 666 [580–858] | 3,679 [1,628–8,131] | 6,259 [4,262–8,888] | $0.0012 [$0.0009–$0.0016] | 3.5 s [3.1 s–4.6 s] |
| flask/x033 | with | 4/4 | 2 [1–3] | 2,714 [2,713–2,715] | 902 [717–1,014] | 4,164 [1,628–6,732] | 5,495 [4,328–7,611] | $0.0014 [$0.0012–$0.0018] | 4.6 s [4.0 s–5.1 s] |
| flask/x034 | without | 4/4 | 4 [3–4] | 202 [202–204] | 844 [760–1,095] | 11,435 [7,913–23,560] | 7,567 [4,330–9,133] | $0.0016 [$0.0010–$0.0018] | 5.3 s [4.9 s–6.2 s] |
| flask/x034 | with | 4/4 | 1 [1–2] | 2,451 [2,451–2,453] | 767 [611–835] | 1,628 [1,628–5,686] | 3,814 [3,296–4,267] | $0.0011 [$0.0011–$0.0013] | 4.3 s [3.4 s–5.0 s] |
| flask/x035 | without | 4/4 | 3 [2–3] | 192 [190–194] | 560 [493–635] | 3,193 [1,628–9,653] | 2,061 [925–4,259] | $0.0006 [$0.0004–$0.0010] | 3.6 s [2.9 s–4.3 s] |
| flask/x035 | with | 4/4 | 0 [0–0] | 2,332 [2,332–2,332] | 433 [351–503] | 814 [814–814] | 0 [0–0] | $0.0005 [$0.0004–$0.0005] | 2.5 s [2.1 s–2.7 s] |
| flask/x036 | without | 4/4 | 3 [2–4] | 198 [196–198] | 782 [712–803] | 8,318 [4,888–14,506] | 5,849 [5,158–8,941] | $0.0012 [$0.0011–$0.0017] | 4.8 s [4.2 s–5.4 s] |
| flask/x036 | with | 4/4 | 0 [0–0] | 2,180 [2,180–2,180] | 495 [365–646] | 814 [814–814] | 0 [0–0] | $0.0005 [$0.0004–$0.0005] | 2.7 s [2.3 s–3.4 s] |

