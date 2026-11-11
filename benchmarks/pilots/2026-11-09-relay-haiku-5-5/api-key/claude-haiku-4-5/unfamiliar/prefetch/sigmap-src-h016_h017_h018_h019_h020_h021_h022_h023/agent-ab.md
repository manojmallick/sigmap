# Agent-level A/B — measured tool calls, tokens and cost

**anthropic-messages-api direct Messages API · claude-haiku-4-5 · 2026-11-11 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap ranked the question BEFORE the first turn (what a prompt hook would inject): the five likeliest files with their signatures and line anchors after the question in the user turn, + the sigmap CLI; no MCP server, no standing section, no extra tool call.
- Both arms: the same prompt, model, tool allowlist (Read, Grep, Glob, Bash), per-run budget cap $0.25 and timeout 420 s; run in a clean copy of the commit pinned in `benchmarks/xrepo-repos.json`.
- Questions: the task id(s) h016, h017, h018, h019, h020, h021, h022, h023 of `benchmarks/tasks/retrieval-xrepo.jsonl`. Pass = hit@5 on the repository-relative paths the answer names.
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
| sigmap-src | 8 | 9/16 | 12/16 | 0 / 0 |
| all | 8 | 9/16 | 12/16 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 8. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −43% | −31% | fewer in every repetition |
| Input tokens (uncached) | −42% | +5% | mixed |
| Output tokens | −35% | −16% | fewer in every repetition |
| Cache-read tokens | −61% | +7% | mixed |
| Cache-write tokens | −22% | −2% | fewer in every repetition |
| Total tokens (derived) | −57% | +6% | mixed |
| Cost | −40% | −1% | fewer in every repetition |
| Wall time | −29% | −12% | fewer in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −57% [−73%, −23%] n=6 | −37% [−58%, −12%] n=7 | fewer in every repetition, outside the noise |
| Input tokens (uncached) | −20% [−55%, +47%] † | +38% [−14%, +120%] † | mixed |
| Output tokens | −31% [−57%, +8%] † | −16% [−41%, +11%] † | fewer in every repetition, within the noise |
| Cache-read tokens | −56% [−76%, −25%] n=5 | −20% [−68%, +63%] † n=6 | fewer in every repetition, within the noise |
| Cache-write tokens | −29% [−46%, −9%] n=6 | −10% [−39%, +23%] † n=7 | fewer in every repetition, within the noise |
| Total tokens (derived) | −24% [−69%, +118%] † | −13% [−54%, +56%] † | fewer in every repetition, within the noise |
| Cost | −2% [−48%, +123%] † | +1% [−29%, +42%] † | mixed |
| Wall time | −21% [−48%, +21%] † | −13% [−37%, +17%] † | fewer in every repetition, within the noise |

### Outcome (hit@5), by repetition

Per paired task: **better** = the SigMap arm named the file and the other did not; **worse** = the reverse; **tie** = both found it or both missed. Localisation only.

| repetition | paired tasks | better | worse | tie |
| --- | ---: | ---: | ---: | ---: |
| R1 | 8 | 3 | 0 | 5 |
| R2 | 8 | 1 | 1 | 6 |
| all | 16 | 4 | 1 | 11 |

## Tool calls

Provenance: agent-reported (main-thread tool_use blocks). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 17 | 9 | −5 | 5 / 1 / 2 |
| all | 17 | 9 | −5 | 5 / 1 / 2 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 3,799 | 2,988 | −803 | 5 / 0 / 3 |
| all | 3,799 | 2,988 | −803 | 5 / 0 / 3 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 1,880 | 1,160 | −323 | 6 / 0 / 2 |
| all | 1,880 | 1,160 | −323 | 6 / 0 / 2 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 170,411 | 71,638 | −34,065 | 6 / 1 / 1 |
| all | 170,411 | 71,638 | −34,065 | 6 / 1 / 1 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 20,379 | 18,057 | −961 | 5 / 1 / 2 |
| all | 20,379 | 18,057 | −961 | 5 / 1 / 2 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 199,032 | 90,753 | −34,299 | 6 / 0 / 2 |
| all | 199,032 | 90,753 | −34,299 | 6 / 0 / 2 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd), or computed from the API's usage and a price table when the run went through the Messages API directly. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | $0.0567 | $0.0354 | −$0.0067 | 6 / 0 / 2 |
| all | $0.0567 | $0.0354 | −$0.0067 | 6 / 0 / 2 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 22.5 s | 14.8 s | −2.5 s | 6 / 0 / 2 |
| all | 22.5 s | 14.8 s | −2.5 s | 6 / 0 / 2 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | $0.8721 (16 runs) | $0.6627 (16 runs) | none | none |
| all | $0.8721 (16 runs) | $0.6627 (16 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| sigmap-src/h016 | without | 1/2 | 3 [0–6] | 1,044 [1,029–1,058] | 527 [186–867] | 23,126 [0–46,251] | 8,800 [0–17,600] | $0.0170 [$0.0020–$0.0320] | 7.3 s [2.7 s–11.8 s] |
| sigmap-src/h016 | with | 2/2 | 4 [3–4] | 3,240 [3,237–3,243] | 466 [349–583] | 2,328 [0–4,655] | 10,219 [5,895–14,542] | $0.0186 [$0.0140–$0.0232] | 6.0 s [5.1 s–6.9 s] |
| sigmap-src/h017 | without | 2/2 | 19 [16–21] | 4,964 [2,698–7,230] | 1,953 [1,667–2,239] | 224,727 [168,433–281,020] | 31,058 [26,168–35,948] | $0.0760 [$0.0606–$0.0915] | 24.3 s [19.7 s–28.8 s] |
| sigmap-src/h017 | with | 2/2 | 13 [12–14] | 2,763 [2,760–2,765] | 1,590 [1,561–1,618] | 101,717 [100,421–103,013] | 14,911 [14,193–15,629] | $0.0395 [$0.0384–$0.0407] | 19.3 s [18.0 s–20.6 s] |
| sigmap-src/h018 | without | 1/2 | 16 [13–18] | 5,814 [4,463–7,164] | 1,831 [1,465–2,197] | 116,096 [63,110–169,082] | 17,827 [14,234–21,420] | $0.0489 [$0.0386–$0.0591] | 21.9 s [18.1 s–25.6 s] |
| sigmap-src/h018 | with | 2/2 | 4 [3–4] | 3,266 [3,266–3,266] | 488 [427–549] | 0 [0–0] | 20,397 [16,588–24,206] | $0.0312 [$0.0261–$0.0363] | 7.7 s [6.2 s–9.2 s] |
| sigmap-src/h019 | without | 1/2 | 37 [35–38] | 4,280 [3,907–4,653] | 2,929 [2,905–2,952] | 504,820 [300,406–709,234] | 35,459 [27,354–43,564] | $0.1137 [$0.0827–$0.1448] | 33.6 s [33.4 s–33.8 s] |
| sigmap-src/h019 | with | 2/2 | 13 [8–17] | 3,359 [3,330–3,387] | 1,543 [849–2,237] | 269,895 [111,247–428,542] | 30,958 [24,865–37,051] | $0.0768 [$0.0498–$0.1037] | 19.1 s [10.9 s–27.3 s] |
| sigmap-src/h020 | without | 0/2 | 25 [25–25] | 9,348 [4,479–14,216] | 2,111 [2,049–2,172] | 293,068 [269,682–316,453] | 25,224 [24,667–25,780] | $0.0807 [$0.0778–$0.0837] | 26.6 s [25.6 s–27.7 s] |
| sigmap-src/h020 | with | 1/2 | 30 [25–34] | 3,213 [3,211–3,214] | 2,638 [2,287–2,988] | 307,334 [296,604–318,064] | 24,056 [23,372–24,739] | $0.0772 [$0.0770–$0.0774] | 33.1 s [30.1 s–36.1 s] |
| sigmap-src/h021 | without | 0/2 | 0 [0–0] | 1,030 [1,030–1,030] | 99 [88–109] | 0 [0–0] | 0 [0–0] | $0.0015 [$0.0015–$0.0016] | 1.3 s [1.2 s–1.4 s] |
| sigmap-src/h021 | with | 0/2 | 0 [0–0] | 2,670 [2,670–2,670] | 116 [103–128] | 0 [0–0] | 0 [0–0] | $0.0032 [$0.0032–$0.0033] | 1.9 s [1.9 s–1.9 s] |
| sigmap-src/h022 | without | 2/2 | 14 [11–17] | 1,781 [1,060–2,501] | 1,081 [900–1,262] | 59,310 [35,041–83,578] | 16,472 [13,202–19,742] | $0.0337 [$0.0256–$0.0418] | 12.5 s [10.5 s–14.5 s] |
| sigmap-src/h022 | with | 2/2 | 6 [5–6] | 2,473 [2,471–2,475] | 777 [718–836] | 41,559 [38,982–44,136] | 15,718 [15,340–16,095] | $0.0302 [$0.0297–$0.0307] | 10.5 s [10.0 s–11.1 s] |
| sigmap-src/h023 | without | 2/2 | 19 [12–26] | 3,318 [1,077–5,558] | 1,929 [1,226–2,632] | 228,319 [61,988–394,649] | 22,931 [16,048–29,814] | $0.0645 [$0.0335–$0.0955] | 23.2 s [13.9 s–32.6 s] |
| sigmap-src/h023 | with | 1/2 | 15 [13–16] | 2,633 [2,622–2,643] | 1,587 [1,420–1,753] | 180,987 [171,681–190,292] | 20,810 [20,343–21,277] | $0.0547 [$0.0523–$0.0570] | 20.2 s [18.0 s–22.5 s] |

