# Agent-level A/B — measured tool calls, tokens and cost

**anthropic-messages-api direct Messages API · claude-sonnet-5-5 · 2026-11-11 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap index strategy + 7-tool core MCP profile (the docs' setup for an agent that calls the tools).
- Both arms: the same prompt, model, tool allowlist (Read, Grep, Glob, Bash), per-run budget cap $0.25 and timeout 420 s; run in a clean copy of the commit pinned in `benchmarks/xrepo-repos.json`.
- Questions: the task id(s) h001, h002, h003, h004, h005, h006, h007, h008 of `benchmarks/tasks/retrieval-xrepo.jsonl`. Pass = hit@5 on the repository-relative paths the answer names.
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
| sigmap-src | 8 | 12/16 | 13/16 | 0 / 0 |
| all | 8 | 12/16 | 13/16 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 8. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −43% | −52% | fewer in every repetition |
| Input tokens (uncached) | −2% | −2% | fewer in every repetition |
| Output tokens | −38% | −31% | fewer in every repetition |
| Cache-read tokens | −55% | −39% | fewer in every repetition |
| Cache-write tokens | −50% | −41% | fewer in every repetition |
| Total tokens (derived) | −53% | −39% | fewer in every repetition |
| Cost | −47% | −38% | fewer in every repetition |
| Wall time | −44% | −37% | fewer in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −56% [−74%, −29%] | −58% [−73%, −40%] | fewer in every repetition, outside the noise |
| Input tokens (uncached) | −2% [−4%, −1%] | −2% [−3%, −1%] | fewer in every repetition, outside the noise |
| Output tokens | −42% [−61%, −25%] | −39% [−57%, −18%] | fewer in every repetition, outside the noise |
| Cache-read tokens | −48% [−76%, +17%] † | −28% [−61%, +43%] † | fewer in every repetition, within the noise |
| Cache-write tokens | −57% [−71%, −37%] | −44% [−64%, −18%] n=7 | fewer in every repetition, outside the noise |
| Total tokens (derived) | −51% [−72%, −19%] | −38% [−59%, −13%] | fewer in every repetition, outside the noise |
| Cost | −52% [−68%, −32%] | −48% [−65%, −25%] | fewer in every repetition, outside the noise |
| Wall time | −46% [−62%, −29%] | −40% [−56%, −21%] | fewer in every repetition, outside the noise |

### Outcome (hit@5), by repetition

Per paired task: **better** = the SigMap arm named the file and the other did not; **worse** = the reverse; **tie** = both found it or both missed. Localisation only.

| repetition | paired tasks | better | worse | tie |
| --- | ---: | ---: | ---: | ---: |
| R1 | 8 | 1 | 0 | 7 |
| R2 | 8 | 0 | 0 | 8 |
| all | 16 | 1 | 0 | 15 |

## Tool calls

Provenance: agent-reported (main-thread tool_use blocks). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 5 | 2 | −2 | 8 / 0 / 0 |
| all | 5 | 2 | −2 | 8 / 0 / 0 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 182 | 179 | −4 | 6 / 1 / 1 |
| all | 182 | 179 | −4 | 6 / 1 / 1 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 934 | 466 | −232 | 8 / 0 / 0 |
| all | 934 | 466 | −232 | 8 / 0 / 0 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 21,522 | 8,687 | −10,260 | 6 / 0 / 2 |
| all | 21,522 | 8,687 | −10,260 | 6 / 0 / 2 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 9,038 | 4,733 | −4,175 | 7 / 0 / 1 |
| all | 9,038 | 4,733 | −4,175 | 7 / 0 / 1 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 31,226 | 14,062 | −13,023 | 6 / 0 / 2 |
| all | 31,226 | 14,062 | −13,023 | 6 / 0 / 2 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd), or computed from the API's usage and a price table when the run went through the Messages API directly. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | $0.0356 | $0.0221 | −$0.0131 | 8 / 0 / 0 |
| all | $0.0356 | $0.0221 | −$0.0131 | 8 / 0 / 0 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 9.8 s | 4.7 s | −2.6 s | 8 / 0 / 0 |
| all | 9.8 s | 4.7 s | −2.6 s | 8 / 0 / 0 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | $0.6046 (16 runs) | $0.3468 (16 runs) | none | none |
| all | $0.6046 (16 runs) | $0.3468 (16 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| sigmap-src/h001 | without | 2/2 | 5 [4–5] | 179 [178–180] | 668 [641–694] | 11,082 [8,307–13,856] | 7,912 [6,315–9,509] | $0.0290 [$0.0242–$0.0338] | 6.8 s [6.2 s–7.4 s] |
| sigmap-src/h001 | with | 2/2 | 2 [2–2] | 176 [176–176] | 438 [433–443] | 4,620 [3,080–6,160] | 8,287 [7,108–9,466] | $0.0264 [$0.0238–$0.0290] | 4.4 s [3.8 s–5.0 s] |
| sigmap-src/h002 | without | 0/2 | 9 [8–9] | 187 [187–187] | 1,585 [1,562–1,607] | 55,063 [48,131–61,995] | 13,453 [12,406–14,500] | $0.0609 [$0.0599–$0.0619] | 19.2 s [18.0 s–20.3 s] |
| sigmap-src/h002 | with | 0/2 | 8 [6–10] | 182 [181–183] | 1,508 [1,464–1,551] | 30,384 [28,952–31,815] | 11,195 [10,528–11,862] | $0.0495 [$0.0471–$0.0519] | 12.0 s [11.6 s–12.5 s] |
| sigmap-src/h003 | without | 2/2 | 4 [3–4] | 183 [182–184] | 611 [563–658] | 11,975 [8,099–15,850] | 6,586 [6,142–7,029] | $0.0253 [$0.0230–$0.0277] | 6.2 s [5.7 s–6.8 s] |
| sigmap-src/h003 | with | 2/2 | 2 [1–2] | 181 [180–182] | 377 [338–415] | 8,704 [6,160–11,247] | 2,165 [1,951–2,378] | $0.0113 [$0.0098–$0.0127] | 5.0 s [4.3 s–5.7 s] |
| sigmap-src/h004 | without | 2/2 | 5 [4–6] | 186 [185–187] | 872 [819–925] | 28,193 [24,747–31,638] | 10,163 [10,019–10,307] | $0.0401 [$0.0386–$0.0417] | 9.4 s [8.7 s–10.1 s] |
| sigmap-src/h004 | with | 2/2 | 3 [2–4] | 181 [179–183] | 746 [518–974] | 14,135 [6,160–22,109] | 6,235 [3,628–8,842] | $0.0262 [$0.0158–$0.0366] | 7.8 s [5.4 s–10.1 s] |
| sigmap-src/h005 | without | 2/2 | 2 [2–2] | 178 [178–178] | 406 [394–418] | 1,628 [1,628–1,628] | 5,776 [5,743–5,809] | $0.0192 [$0.0191–$0.0192] | 6.1 s [4.6 s–7.6 s] |
| sigmap-src/h005 | with | 2/2 | 1 [1–1] | 178 [178–178] | 272 [251–293] | 7,093 [6,160–8,026] | 933 [0–1,866] | $0.0068 [$0.0045–$0.0092] | 3.1 s [3.1 s–3.2 s] |
| sigmap-src/h006 | without | 2/2 | 9 [8–10] | 186 [183–189] | 1,260 [1,120–1,399] | 47,644 [30,707–64,581] | 11,019 [9,308–12,730] | $0.0500 [$0.0410–$0.0591] | 13.6 s [11.8 s–15.3 s] |
| sigmap-src/h006 | with | 2/2 | 1 [1–1] | 175 [175–175] | 241 [240–242] | 6,160 [6,160–6,160] | 1,966 [1,962–1,970] | $0.0089 [$0.0089–$0.0089] | 3.0 s [3.0 s–3.1 s] |
| sigmap-src/h007 | without | 0/2 | 6 [5–6] | 181 [180–182] | 996 [991–1,001] | 32,068 [22,902–41,233] | 11,936 [11,125–12,747] | $0.0466 [$0.0427–$0.0505] | 10.2 s [10.2 s–10.3 s] |
| sigmap-src/h007 | with | 1/2 | 2 [1–2] | 175 [174–176] | 494 [439–549] | 8,671 [6,160–11,182] | 5,263 [5,066–5,459] | $0.0202 [$0.0196–$0.0207] | 4.3 s [3.7 s–5.0 s] |
| sigmap-src/h008 | without | 2/2 | 6 [6–6] | 179 [179–179] | 1,037 [1,035–1,038] | 14,852 [14,244–15,459] | 6,971 [6,897–7,045] | $0.0311 [$0.0311–$0.0312] | 10.2 s [9.7 s–10.8 s] |
| sigmap-src/h008 | with | 2/2 | 5 [4–6] | 180 [179–181] | 800 [786–814] | 26,134 [22,862–29,406] | 4,203 [3,481–4,925] | $0.0241 [$0.0215–$0.0267] | 8.8 s [8.7 s–9.0 s] |

