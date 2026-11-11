# Agent-level A/B — measured tool calls, tokens and cost

**anthropic-messages-api direct Messages API · claude-haiku-4-5 · 2026-11-11 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

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
| Tool calls | −29% | −35% | fewer in every repetition |
| Input tokens (uncached) | −19% | −5% | fewer in every repetition |
| Output tokens | −22% | −9% | fewer in every repetition |
| Cache-read tokens | +22% | −15% | mixed |
| Cache-write tokens | +12% | −8% | mixed |
| Total tokens (derived) | +16% | −13% | mixed |
| Cost | +4% | −9% | mixed |
| Wall time | −18% | −7% | fewer in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −30% [−46%, −3%] | −35% [−38%, −31%] | fewer in every repetition, outside the noise |
| Input tokens (uncached) | −17% [−29%, +3%] † | +7% [−24%, +84%] † | mixed |
| Output tokens | −25% [−44%, 0%] | −9% [−15%, 0%] † | fewer in every repetition, within the noise |
| Cache-read tokens | +23% [−28%, +122%] † | −2% [−27%, +24%] † | mixed |
| Cache-write tokens | +15% [−15%, +69%] † | +5% [−22%, +34%] † | more in every repetition, within the noise |
| Total tokens (derived) | +17% [−25%, +91%] † | −1% [−25%, +23%] † | mixed |
| Cost | +4% [−21%, +42%] † | −1% [−22%, +18%] † | mixed |
| Wall time | −20% [−42%, +10%] † | −7% [−13%, +2%] † | fewer in every repetition, within the noise |

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
| gin | 10 | 7 | −3 | 5 / 0 / 0 |
| all | 10 | 7 | −3 | 5 / 0 / 0 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 4,160 | 3,334 | −826 | 3 / 0 / 2 |
| all | 4,160 | 3,334 | −826 | 3 / 0 / 2 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 1,035 | 885 | −208 | 4 / 0 / 1 |
| all | 1,035 | 885 | −208 | 4 / 0 / 1 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 46,195 | 51,669 | −5,609 | 3 / 0 / 2 |
| all | 46,195 | 51,669 | −5,609 | 3 / 0 / 2 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 12,620 | 14,400 | +136 | 2 / 0 / 3 |
| all | 12,620 | 14,400 | +136 | 2 / 0 / 3 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 64,695 | 70,098 | −7,171 | 3 / 0 / 2 |
| all | 64,695 | 70,098 | −7,171 | 3 / 0 / 2 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd), or computed from the API's usage and a price table when the run went through the Messages API directly. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | $0.0303 | $0.0299 | −$0.0038 | 3 / 0 / 2 |
| all | $0.0303 | $0.0299 | −$0.0038 | 3 / 0 / 2 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 12.7 s | 11.0 s | −2.7 s | 3 / 0 / 2 |
| all | 12.7 s | 11.0 s | −2.7 s | 3 / 0 / 2 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| gin | $0.3329 (10 runs) | $0.3231 (10 runs) | none | none |
| all | $0.3329 (10 runs) | $0.3231 (10 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| gin/x001 | without | 2/2 | 12 [11–12] | 4,863 [4,747–4,978] | 1,018 [935–1,100] | 46,195 [39,351–53,039] | 12,620 [12,390–12,850] | $0.0303 [$0.0291–$0.0316] | 12.3 s [11.5 s–13.2 s] |
| gin/x001 | with | 2/2 | 7 [7–7] | 3,574 [3,573–3,574] | 746 [648–844] | 33,235 [33,227–33,242] | 12,756 [12,695–12,816] | $0.0266 [$0.0262–$0.0270] | 9.3 s [8.2 s–10.3 s] |
| gin/x002 | without | 2/2 | 10 [10–10] | 2,862 [2,574–3,150] | 931 [877–984] | 24,609 [16,758–32,459] | 9,376 [6,708–12,043] | $0.0217 [$0.0176–$0.0258] | 10.6 s [10.2 s–10.9 s] |
| gin/x002 | with | 2/2 | 7 [7–7] | 3,205 [3,200–3,210] | 956 [947–964] | 32,750 [19,474–46,025] | 10,164 [8,294–12,033] | $0.0240 [$0.0203–$0.0276] | 11.3 s [11.1 s–11.5 s] |
| gin/x003 | without | 2/2 | 11 [11–11] | 2,654 [1,088–4,219] | 1,035 [943–1,127] | 57,277 [56,102–58,452] | 16,304 [14,866–17,741] | $0.0339 [$0.0300–$0.0379] | 15.3 s [12.9 s–17.6 s] |
| gin/x003 | with | 2/2 | 6 [5–7] | 3,350 [3,345–3,354] | 680 [518–842] | 51,669 [35,367–67,970] | 14,400 [12,915–15,885] | $0.0299 [$0.0256–$0.0342] | 10.1 s [8.3 s–11.9 s] |
| gin/x004 | without | 2/2 | 9 [8–10] | 4,281 [3,924–4,638] | 1,134 [1,085–1,182] | 24,885 [20,138–29,632] | 8,792 [7,461–10,122] | $0.0234 [$0.0214–$0.0254] | 12.7 s [12.4 s–13.0 s] |
| gin/x004 | with | 2/2 | 8 [6–10] | 3,048 [3,038–3,057] | 1,130 [976–1,284] | 58,846 [38,661–79,031] | 16,850 [15,719–17,981] | $0.0356 [$0.0314–$0.0399] | 14.5 s [12.3 s–16.7 s] |
| gin/x005 | without | 2/2 | 9 [8–10] | 4,160 [4,153–4,167] | 1,092 [1,014–1,170] | 98,007 [51,458–144,555] | 30,093 [21,300–38,886] | $0.0570 [$0.0410–$0.0731] | 13.7 s [12.3 s–15.1 s] |
| gin/x005 | with | 2/2 | 7 [6–7] | 3,334 [3,331–3,337] | 885 [770–999] | 77,386 [69,281–85,491] | 23,983 [23,626–24,339] | $0.0455 [$0.0445–$0.0464] | 11.0 s [9.5 s–12.6 s] |

