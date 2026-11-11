# Agent-level A/B — measured tool calls, tokens and cost

**anthropic-messages-api direct Messages API · claude-haiku-4-5 · 2026-11-11 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap index strategy + 7-tool core MCP profile (the docs' setup for an agent that calls the tools).
- Both arms: the same prompt, model, tool allowlist (Read, Grep, Glob, Bash), per-run budget cap $0.25 and timeout 420 s; run in a clean copy of the commit pinned in `benchmarks/xrepo-repos.json`.
- Questions: the task id(s) h024, h025, h026, h027, h028, h029, h030 of `benchmarks/tasks/retrieval-xrepo.jsonl`. Pass = hit@5 on the repository-relative paths the answer names.
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
| sigmap-src | 7 | 12/14 | 13/14 | 0 / 1 |
| all | 7 | 12/14 | 13/14 | 0 / 1 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 7. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −62% n=6 | −15% | fewer in every repetition |
| Input tokens (uncached) | −5% n=6 | −2% | fewer in every repetition |
| Output tokens | −59% n=6 | −8% | fewer in every repetition |
| Cache-read tokens | −71% n=6 | −21% | fewer in every repetition |
| Cache-write tokens | −18% n=6 | −18% | fewer in every repetition |
| Total tokens (derived) | −63% n=6 | −20% | fewer in every repetition |
| Cost | −39% n=6 | −15% | fewer in every repetition |
| Wall time | −54% n=6 | −6% | fewer in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −63% [−81%, −31%] n=6 | −28% [−66%, +58%] † | fewer in every repetition, within the noise |
| Input tokens (uncached) | +25% [−31%, +113%] † n=6 | +16% [−41%, +113%] † | more in every repetition, within the noise |
| Output tokens | −58% [−77%, −24%] n=6 | −23% [−62%, +67%] † | fewer in every repetition, within the noise |
| Cache-read tokens | −78% [−95%, −10%] n=6 | −77% [−94%, +13%] † n=6 | fewer in every repetition, within the noise |
| Cache-write tokens | −21% [−58%, +46%] † n=6 | −39% [−55%, −8%] n=6 | fewer in every repetition, within the noise |
| Total tokens (derived) | −64% [−89%, +2%] † n=6 | −32% [−81%, +189%] † | fewer in every repetition, within the noise |
| Cost | −38% [−70%, +21%] † n=6 | −17% [−56%, +73%] † | fewer in every repetition, within the noise |
| Wall time | −51% [−73%, −12%] n=6 | −20% [−61%, +76%] † | fewer in every repetition, within the noise |

### Outcome (hit@5), by repetition

Per paired task: **better** = the SigMap arm named the file and the other did not; **worse** = the reverse; **tie** = both found it or both missed. Localisation only.

| repetition | paired tasks | better | worse | tie |
| --- | ---: | ---: | ---: | ---: |
| R1 | 6 | 0 | 0 | 6 |
| R2 | 7 | 1 | 0 | 6 |
| all | 13 | 1 | 0 | 12 |

## Tool calls

Provenance: agent-reported (main-thread tool_use blocks). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 13 | 6 | −6 | 5 / 0 / 2 |
| all | 13 | 6 | −6 | 5 / 0 / 2 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 3,733 | 2,850 | +1,208 | 2 / 0 / 5 |
| all | 3,733 | 2,850 | +1,208 | 2 / 0 / 5 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 1,276 | 646 | −624 | 5 / 0 / 2 |
| all | 1,276 | 646 | −624 | 5 / 0 / 2 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 72,740 | 38,382 | −61,244 | 5 / 0 / 2 |
| all | 72,740 | 38,382 | −61,244 | 5 / 0 / 2 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 14,173 | 10,591 | −3,587 | 5 / 0 / 2 |
| all | 14,173 | 10,591 | −3,587 | 5 / 0 / 2 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 89,485 | 55,791 | −64,452 | 5 / 0 / 2 |
| all | 89,485 | 55,791 | −64,452 | 5 / 0 / 2 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd), or computed from the API's usage and a price table when the run went through the Messages API directly. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | $0.0315 | $0.0270 | −$0.0127 | 5 / 0 / 2 |
| all | $0.0315 | $0.0270 | −$0.0127 | 5 / 0 / 2 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 14.7 s | 7.7 s | −7.0 s | 5 / 0 / 2 |
| all | 14.7 s | 7.7 s | −7.0 s | 5 / 0 / 2 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | $0.5816 (14 runs) | $0.4842 (14 runs) | none | $0.0884 (1 run) |
| all | $0.5816 (14 runs) | $0.4842 (14 runs) | none | $0.0884 (1 run) |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| sigmap-src/h024 | without | 0/2 | 9 [6–11] | 7,989 [7,305–8,673] | 1,009 [633–1,385] | 25,683 [0–51,366] | 6,660 [0–13,320] | $0.0239 [$0.0118–$0.0360] | 11.9 s [6.9 s–16.8 s] |
| sigmap-src/h024 | with | 1/2 | 20 [20–20] n=1 | 2,857 [2,857–2,857] n=1 | 2,282 [2,282–2,282] n=1 | 166,870 [166,870–166,870] n=1 | 19,986 [19,986–19,986] n=1 | $0.0559 [$0.0559–$0.0559] n=1 | 27.8 s [27.8 s–27.8 s] n=1 |
| sigmap-src/h025 | without | 2/2 | 22 [16–28] | 1,146 [1,119–1,172] | 2,163 [1,579–2,746] | 301,039 [198,084–403,994] | 26,891 [24,248–29,533] | $0.0757 [$0.0591–$0.0922] | 27.8 s [20.8 s–34.8 s] |
| sigmap-src/h025 | with | 2/2 | 4 [3–4] | 2,774 [2,774–2,774] | 372 [369–375] | 4,135 [4,129–4,141] | 9,923 [7,424–12,422] | $0.0175 [$0.0143–$0.0206] | 5.2 s [5.1 s–5.3 s] |
| sigmap-src/h026 | without | 2/2 | 8 [7–9] | 1,643 [1,075–2,210] | 769 [679–859] | 40,426 [28,244–52,607] | 9,995 [9,541–10,449] | $0.0220 [$0.0215–$0.0226] | 9.5 s [8.5 s–10.5 s] |
| sigmap-src/h026 | with | 2/2 | 15 [12–17] | 2,850 [2,835–2,865] | 1,502 [1,144–1,860] | 154,364 [135,930–172,798] | 21,399 [16,291–26,507] | $0.0525 [$0.0498–$0.0553] | 19.5 s [15.5 s–23.4 s] |
| sigmap-src/h027 | without | 2/2 | 16 [14–17] | 7,994 [7,969–8,019] | 1,575 [1,394–1,755] | 142,212 [131,470–152,954] | 22,528 [21,049–24,006] | $0.0582 [$0.0581–$0.0584] | 20.1 s [18.0 s–22.1 s] |
| sigmap-src/h027 | with | 2/2 | 10 [3–16] | 9,741 [6,766–12,715] | 953 [376–1,530] | 65,459 [5,762–125,155] | 10,173 [6,490–13,855] | $0.0338 [$0.0173–$0.0502] | 13.1 s [5.7 s–20.5 s] |
| sigmap-src/h028 | without | 2/2 | 15 [14–16] | 8,141 [5,884–10,397] | 1,482 [1,416–1,548] | 113,583 [105,721–121,444] | 17,661 [16,797–18,524] | $0.0490 [$0.0489–$0.0490] | 18.4 s [17.7 s–19.2 s] |
| sigmap-src/h028 | with | 2/2 | 6 [4–7] | 2,789 [2,777–2,801] | 547 [440–653] | 38,382 [16,088–60,675] | 14,074 [10,087–18,061] | $0.0270 [$0.0192–$0.0347] | 7.5 s [5.6 s–9.3 s] |
| sigmap-src/h029 | without | 2/2 | 11 [6–15] | 1,073 [1,061–1,085] | 1,276 [886–1,666] | 52,942 [44,558–61,326] | 14,173 [14,032–14,313] | $0.0305 [$0.0278–$0.0331] | 14.7 s [11.4 s–18.0 s] |
| sigmap-src/h029 | with | 2/2 | 5 [4–6] | 2,780 [2,776–2,784] | 646 [571–720] | 12,490 [4,111–20,869] | 10,591 [5,117–16,064] | $0.0205 [$0.0124–$0.0286] | 7.7 s [6.4 s–9.0 s] |
| sigmap-src/h030 | without | 2/2 | 13 [7–18] | 3,733 [2,817–4,649] | 1,118 [659–1,576] | 72,740 [15,183–130,296] | 11,895 [8,655–15,134] | $0.0315 [$0.0203–$0.0426] | 13.4 s [7.8 s–18.9 s] |
| sigmap-src/h030 | with | 2/2 | 4 [4–4] | 4,769 [2,785–6,752] | 494 [484–503] | 11,496 [10,306–12,685] | 8,276 [8,121–8,430] | $0.0187 [$0.0169–$0.0206] | 7.2 s [7.0 s–7.3 s] |

