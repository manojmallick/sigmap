# Agent-level A/B — measured tool calls, tokens and cost

**anthropic-messages-api direct Messages API · claude-haiku-5-5 · 2026-11-11 · 4 runs per arm · publishable**

- Arms: **without** = no SigMap; **with** = SigMap index strategy + 7-tool core MCP profile (the docs' setup for an agent that calls the tools).
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
| sigmap-src | 8 | 27/32 | 29/32 | 0 / 0 |
| all | 8 | 27/32 | 29/32 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2, R3, R4) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 8. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | R3 | R4 | verdict |
| --- | ---: | ---: | ---: | ---: | ---: |
| Tool calls | −47% | −42% | −31% | −57% | fewer in every repetition |
| Input tokens (uncached) | −1% | −1% | −1% | −2% | fewer in every repetition |
| Output tokens | −20% | −9% | −11% | −30% | fewer in every repetition |
| Cache-read tokens | −5% | −18% | +20% | −51% | mixed |
| Cache-write tokens | −58% | −51% | −55% | −54% | fewer in every repetition |
| Total tokens (derived) | −25% | −28% | −7% | −51% | fewer in every repetition |
| Cost | −44% | −37% | −36% | −47% | fewer in every repetition |
| Wall time | −9% | −7% | −5% | −27% | fewer in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | R3 | R4 | verdict |
| --- | ---: | ---: | ---: | ---: | ---: |
| Tool calls | −64% [−73%, −47%] n=7 | −59% [−75%, −37%] n=7 | −52% [−69%, −21%] n=7 | −64% [−78%, −39%] n=7 | fewer in every repetition, outside the noise |
| Input tokens (uncached) | −1% [−3%, +2%] † | −1% [−2%, +1%] † | −1% [−2%, +2%] † | −2% [−3%, 0%] | fewer in every repetition, within the noise |
| Output tokens | −15% [−47%, +63%] † | 0% [−40%, +92%] † | −3% [−36%, +74%] † | −22% [−51%, +34%] † | fewer in every repetition, within the noise |
| Cache-read tokens | 0% [−57%, +265%] † | −4% [−62%, +249%] † | +36% [−42%, +356%] † | −31% [−69%, +92%] † | mixed |
| Cache-write tokens | −73% [−81%, −56%] n=7 | −64% [−78%, −42%] n=7 | −65% [−76%, −44%] n=6 | −63% [−80%, −30%] n=7 | fewer in every repetition, outside the noise |
| Total tokens (derived) | −20% [−64%, +191%] † | −15% [−65%, +205%] † | +5% [−53%, +248%] † | −32% [−70%, +93%] † | mixed |
| Cost | −37% [−69%, +82%] † | −25% [−64%, +113%] † | −28% [−64%, +102%] † | −34% [−68%, +64%] † | fewer in every repetition, within the noise |
| Wall time | −5% [−35%, +65%] † | −2% [−35%, +70%] † | +2% [−31%, +76%] † | −21% [−46%, +29%] † | mixed |

### Outcome (hit@5), by repetition

Per paired task: **better** = the SigMap arm named the file and the other did not; **worse** = the reverse; **tie** = both found it or both missed. Localisation only.

| repetition | paired tasks | better | worse | tie |
| --- | ---: | ---: | ---: | ---: |
| R1 | 8 | 1 | 0 | 7 |
| R2 | 8 | 1 | 0 | 7 |
| R3 | 8 | 1 | 2 | 5 |
| R4 | 8 | 1 | 0 | 7 |
| all | 32 | 4 | 2 | 26 |

## Tool calls

Provenance: agent-reported (main-thread tool_use blocks). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 4 | 2 | −3 | 6 / 1 / 1 |
| all | 4 | 2 | −3 | 6 / 1 / 1 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 182 | 180 | −3 | 7 / 0 / 1 |
| all | 182 | 180 | −3 | 7 / 0 / 1 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 876 | 668 | −313 | 6 / 0 / 2 |
| all | 876 | 668 | −313 | 6 / 0 / 2 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 15,590 | 11,191 | −6,867 | 6 / 0 / 2 |
| all | 15,590 | 11,191 | −6,867 | 6 / 0 / 2 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 10,433 | 3,424 | −7,293 | 7 / 0 / 1 |
| all | 10,433 | 3,424 | −7,293 | 7 / 0 / 1 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 28,897 | 16,395 | −14,498 | 6 / 0 / 2 |
| all | 28,897 | 16,395 | −14,498 | 6 / 0 / 2 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd), or computed from the API's usage and a price table when the run went through the Messages API directly. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | $0.0020 | $0.0009 | −$0.0012 | 6 / 0 / 2 |
| all | $0.0020 | $0.0009 | −$0.0012 | 6 / 0 / 2 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 5.3 s | 4.3 s | −1.6 s | 6 / 0 / 2 |
| all | 5.3 s | 4.3 s | −1.6 s | 6 / 0 / 2 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | $0.0579 (32 runs) | $0.0339 (32 runs) | none | none |
| all | $0.0579 (32 runs) | $0.0339 (32 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| sigmap-src/h016 | without | 4/4 | 3 [2–4] | 178 [178–180] | 700 [549–752] | 8,216 [8,148–15,038] | 6,421 [6,106–6,661] | $0.0012 [$0.0012–$0.0014] | 4.6 s [3.9 s–4.8 s] |
| sigmap-src/h016 | with | 4/4 | 2 [1–3] | 177 [176–180] | 816 [566–875] | 10,683 [6,160–24,056] | 6,115 [5,770–7,291] | $0.0013 [$0.0011–$0.0015] | 5.1 s [3.5 s–5.8 s] |
| sigmap-src/h017 | without | 4/4 | 7 [5–9] | 185 [183–189] | 1,411 [1,098–1,644] | 26,526 [15,253–40,988] | 10,490 [7,943–13,275] | $0.0023 [$0.0017–$0.0029] | 7.3 s [5.9 s–9.9 s] |
| sigmap-src/h017 | with | 4/4 | 2 [1–2] | 180 [179–181] | 581 [568–719] | 8,598 [6,160–11,086] | 2,074 [1,789–2,265] | $0.0007 [$0.0006–$0.0008] | 4.3 s [3.5 s–5.4 s] |
| sigmap-src/h018 | without | 4/4 | 4 [3–7] | 183 [182–188] | 871 [678–1,231] | 15,100 [8,446–30,748] | 11,415 [7,892–23,777] | $0.0020 [$0.0014–$0.0039] | 5.3 s [4.1 s–7.8 s] |
| sigmap-src/h018 | with | 4/4 | 1 [1–1] | 180 [180–180] | 512 [485–575] | 6,160 [6,160–8,199] | 2,074 [0–2,304] | $0.0006 [$0.0003–$0.0006] | 3.2 s [3.0 s–3.6 s] |
| sigmap-src/h019 | without | 3/4 | 5 [2–7] | 188 [183–191] | 930 [766–1,361] | 22,086 [8,563–64,410] | 10,564 [5,146–15,107] | $0.0019 [$0.0013–$0.0032] | 6.1 s [4.4 s–8.3 s] |
| sigmap-src/h019 | with | 4/4 | 2 [1–2] | 183 [181–183] | 520 [458–624] | 11,512 [6,160–11,599] | 3,476 [2,048–3,997] | $0.0008 [$0.0006–$0.0009] | 3.6 s [3.4 s–4.3 s] |
| sigmap-src/h020 | without | 4/4 | 7 [7–8] | 188 [186–188] | 1,176 [984–1,420] | 33,697 [22,484–36,662] | 9,324 [8,044–14,408] | $0.0021 [$0.0017–$0.0029] | 7.3 s [5.4 s–8.2 s] |
| sigmap-src/h020 | with | 3/4 | 3 [2–4] | 184 [182–186] | 796 [607–1,115] | 16,596 [11,120–25,901] | 3,372 [2,656–5,122] | $0.0010 [$0.0009–$0.0015] | 5.3 s [4.6 s–6.9 s] |
| sigmap-src/h021 | without | 0/4 | 0 [0–0] | 175 [175–175] | 201 [168–213] | 814 [814–814] | 0 [0–0] | $0.0001 [$0.0001–$0.0001] | 1.5 s [1.3 s–1.7 s] |
| sigmap-src/h021 | with | 3/4 | 6 [2–6] | 185 [179–187] | 1,172 [809–1,393] | 47,866 [11,615–54,685] | 9,038 [5,239–9,934] | $0.0022 [$0.0012–$0.0025] | 7.5 s [5.7 s–8.9 s] |
| sigmap-src/h022 | without | 4/4 | 4 [3–4] | 181 [181–181] | 759 [636–841] | 15,515 [15,447–15,668] | 13,789 [7,672–14,474] | $0.0022 [$0.0015–$0.0024] | 5.0 s [4.2 s–5.4 s] |
| sigmap-src/h022 | with | 4/4 | 4 [2–4] | 179 [177–181] | 722 [624–886] | 11,903 [6,160–25,316] | 4,274 [2,654–9,371] | $0.0010 [$0.0007–$0.0019] | 4.2 s [3.9 s–5.4 s] |
| sigmap-src/h023 | without | 4/4 | 5 [4–5] | 181 [179–183] | 881 [704–1,059] | 15,665 [8,813–32,532] | 10,376 [8,211–15,463] | $0.0020 [$0.0016–$0.0025] | 5.3 s [4.8 s–6.5 s] |
| sigmap-src/h023 | with | 3/4 | 2 [1–2] | 179 [177–179] | 615 [422–720] | 10,870 [6,160–14,947] | 2,877 [1,924–7,546] | $0.0008 [$0.0005–$0.0015] | 4.0 s [2.9 s–4.5 s] |

