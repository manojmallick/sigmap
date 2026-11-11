# Agent-level A/B — measured tool calls, tokens and cost

**anthropic-messages-api direct Messages API · claude-haiku-5-5 · 2026-11-11 · 4 runs per arm · publishable**

- Arms: **without** = no SigMap; **with** = SigMap ranked the question BEFORE the first turn (what a prompt hook would inject): the five likeliest files with their signatures and line anchors after the question in the user turn, + the sigmap CLI; no MCP server, no standing section, no extra tool call.
- Both arms: the same prompt, model, tool allowlist (Read, Grep, Glob, Bash), per-run budget cap $0.25 and timeout 420 s; run in a clean copy of the commit pinned in `benchmarks/xrepo-repos.json`.
- Questions: the task id(s) h009, h010, h011, h012, h013, h014, h015 of `benchmarks/tasks/retrieval-xrepo.jsonl`. Pass = hit@5 on the repository-relative paths the answer names.
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
| sigmap-src | 7 | 23/28 | 28/28 | 0 / 0 |
| all | 7 | 23/28 | 28/28 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2, R3, R4) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 7. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | R3 | R4 | verdict |
| --- | ---: | ---: | ---: | ---: | ---: |
| Tool calls | −86% | −85% | −89% | −84% | fewer in every repetition |
| Input tokens (uncached) | +1183% | +1179% | +1183% | +1179% | more in every repetition |
| Output tokens | −38% | −43% | −40% | −29% | fewer in every repetition |
| Cache-read tokens | −87% | −90% | −86% | −87% | fewer in every repetition |
| Cache-write tokens | −75% | −69% | −85% | −75% | fewer in every repetition |
| Total tokens (derived) | −72% | −75% | −77% | −76% | fewer in every repetition |
| Cost | −53% | −53% | −61% | −57% | fewer in every repetition |
| Wall time | −38% | −48% | −44% | −39% | fewer in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | R3 | R4 | verdict |
| --- | ---: | ---: | ---: | ---: | ---: |
| Tool calls | −45% [−50%, −33%] n=3 | −65% [−77%, −44%] n=4 | 0% n=1 | −50% [−75%, 0%] † n=3 | mixed |
| Input tokens (uncached) | +1142% [+901%, +1381%] | +1138% [+898%, +1352%] | +1142% [+902%, +1367%] | +1138% [+898%, +1361%] | more in every repetition, outside the noise |
| Output tokens | −36% [−54%, −10%] | −41% [−64%, −4%] | −38% [−55%, −17%] | −24% [−53%, +16%] † | fewer in every repetition, within the noise |
| Cache-read tokens | −89% [−95%, −72%] | −91% [−96%, −75%] | −91% [−97%, −69%] | −92% [−97%, −69%] | fewer in every repetition, outside the noise |
| Cache-write tokens | −33% [−71%, +80%] † n=3 | −29% [−69%, +40%] † n=4 | +39% n=1 | −33% [−65%, +47%] † n=3 | mixed |
| Total tokens (derived) | −74% [−87%, −46%] | −75% [−89%, −43%] | −80% [−90%, −54%] | −78% [−91%, −44%] | fewer in every repetition, outside the noise |
| Cost | −57% [−74%, −24%] | −54% [−76%, −10%] | −64% [−76%, −39%] | −58% [−76%, −24%] | fewer in every repetition, outside the noise |
| Wall time | −37% [−54%, −12%] | −46% [−65%, −16%] | −43% [−58%, −22%] | −36% [−59%, −1%] | fewer in every repetition, outside the noise |

### Outcome (hit@5), by repetition

Per paired task: **better** = the SigMap arm named the file and the other did not; **worse** = the reverse; **tie** = both found it or both missed. Localisation only.

| repetition | paired tasks | better | worse | tie |
| --- | ---: | ---: | ---: | ---: |
| R1 | 7 | 1 | 0 | 6 |
| R2 | 7 | 2 | 0 | 5 |
| R3 | 7 | 1 | 0 | 6 |
| R4 | 7 | 1 | 0 | 6 |
| all | 28 | 5 | 0 | 23 |

## Tool calls

Provenance: agent-reported (main-thread tool_use blocks). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 4 | 0 | −4 | 7 / 0 / 0 |
| all | 4 | 0 | −4 | 7 / 0 / 0 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 180 | 2,168 | +1,985 | 0 / 0 / 7 |
| all | 180 | 2,168 | +1,985 | 0 / 0 / 7 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 765 | 489 | −277 | 5 / 0 / 2 |
| all | 765 | 489 | −277 | 5 / 0 / 2 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 22,998 | 814 | −21,370 | 6 / 0 / 1 |
| all | 22,998 | 814 | −21,370 | 6 / 0 / 1 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 10,013 | 0 | −9,139 | 6 / 0 / 1 |
| all | 10,013 | 0 | −9,139 | 6 / 0 / 1 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 34,985 | 4,144 | −30,935 | 6 / 0 / 1 |
| all | 34,985 | 4,144 | −30,935 | 6 / 0 / 1 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd), or computed from the API's usage and a price table when the run went through the Messages API directly. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | $0.0020 | $0.0005 | −$0.0014 | 6 / 0 / 1 |
| all | $0.0020 | $0.0005 | −$0.0014 | 6 / 0 / 1 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 5.1 s | 2.8 s | −2.4 s | 6 / 0 / 1 |
| all | 5.1 s | 2.8 s | −2.4 s | 6 / 0 / 1 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | $0.0515 (28 runs) | $0.0227 (28 runs) | none | none |
| all | $0.0515 (28 runs) | $0.0227 (28 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| sigmap-src/h009 | without | 4/4 | 4 [2–9] | 180 [177–189] | 765 [593–1,345] | 8,167 [1,628–26,245] | 5,474 [3,231–5,995] | $0.0011 [$0.0009–$0.0017] | 4.4 s [3.3 s–8.1 s] |
| sigmap-src/h009 | with | 4/4 | 0 [0–1] | 2,123 [2,123–2,125] | 489 [471–638] | 814 [814–1,628] | 0 [0–2,545] | $0.0005 [$0.0005–$0.0009] | 2.8 s [2.5 s–3.5 s] |
| sigmap-src/h010 | without | 3/4 | 4 [2–5] | 181 [178–184] | 815 [648–1,651] | 25,628 [8,033–49,488] | 12,662 [10,125–15,739] | $0.0023 [$0.0017–$0.0033] | 5.1 s [3.8 s–9.0 s] |
| sigmap-src/h010 | with | 4/4 | 0 [0–0] | 2,905 [2,905–2,905] | 425 [335–692] | 814 [814–814] | 0 [0–0] | $0.0005 [$0.0005–$0.0006] | 2.6 s [2.1 s–3.6 s] |
| sigmap-src/h011 | without | 4/4 | 5 [3–8] | 180 [178–184] | 992 [864–1,414] | 23,801 [15,366–62,238] | 10,013 [6,576–14,961] | $0.0020 [$0.0014–$0.0032] | 5.6 s [5.1 s–8.3 s] |
| sigmap-src/h011 | with | 4/4 | 0 [0–0] | 2,850 [2,850–2,850] | 387 [344–431] | 814 [814–814] | 0 [0–0] | $0.0005 [$0.0005–$0.0005] | 2.1 s [1.9 s–2.5 s] |
| sigmap-src/h012 | without | 4/4 | 4 [2–4] | 179 [177–181] | 742 [548–899] | 22,998 [8,086–33,105] | 12,012 [10,538–22,416] | $0.0022 [$0.0017–$0.0035] | 6.1 s [4.1 s–7.3 s] |
| sigmap-src/h012 | with | 4/4 | 1 [0–1] | 2,070 [2,068–2,070] | 601 [434–750] | 1,628 [814–1,628] | 2,873 [0–7,926] | $0.0008 [$0.0006–$0.0016] | 3.5 s [3.1 s–4.1 s] |
| sigmap-src/h013 | without | 0/4 | 8 [8–9] | 183 [181–185] | 1,253 [1,170–1,440] | 40,207 [24,676–51,322] | 11,442 [11,015–12,106] | $0.0025 [$0.0024–$0.0027] | 7.8 s [6.9 s–8.8 s] |
| sigmap-src/h013 | with | 4/4 | 0 [0–0] | 2,168 [2,168–2,168] | 466 [433–498] | 814 [814–814] | 0 [0–0] | $0.0005 [$0.0004–$0.0005] | 2.7 s [2.3 s–2.9 s] |
| sigmap-src/h014 | without | 4/4 | 2 [2–3] | 183 [183–183] | 509 [421–576] | 8,192 [8,079–8,261] | 6,844 [6,770–6,893] | $0.0012 [$0.0012–$0.0012] | 3.3 s [2.8 s–3.6 s] |
| sigmap-src/h014 | with | 4/4 | 1 [0–1] | 2,835 [2,833–2,835] | 557 [402–572] | 1,628 [814–1,628] | 3,996 [0–5,772] | $0.0011 [$0.0005–$0.0013] | 2.8 s [2.1 s–3.3 s] |
| sigmap-src/h015 | without | 4/4 | 3 [3–3] | 180 [180–180] | 543 [464–641] | 7,175 [6,319–8,800] | 5,385 [4,400–6,844] | $0.0010 [$0.0009–$0.0013] | 3.4 s [3.0 s–3.8 s] |
| sigmap-src/h015 | with | 4/4 | 3 [2–3] | 1,290 [1,289–1,291] | 757 [688–844] | 11,546 [6,998–17,901] | 8,526 [7,904–9,511] | $0.0017 [$0.0016–$0.0018] | 4.7 s [4.3 s–5.2 s] |

