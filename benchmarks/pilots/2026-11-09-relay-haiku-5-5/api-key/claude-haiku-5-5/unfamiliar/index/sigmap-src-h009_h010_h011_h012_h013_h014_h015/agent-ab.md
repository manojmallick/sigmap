# Agent-level A/B — measured tool calls, tokens and cost

**anthropic-messages-api direct Messages API · claude-haiku-5-5 · 2026-11-11 · 4 runs per arm · publishable**

- Arms: **without** = no SigMap; **with** = SigMap index strategy + 7-tool core MCP profile (the docs' setup for an agent that calls the tools).
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
| sigmap-src | 7 | 25/28 | 28/28 | 0 / 0 |
| all | 7 | 25/28 | 28/28 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2, R3, R4) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 7. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | R3 | R4 | verdict |
| --- | ---: | ---: | ---: | ---: | ---: |
| Tool calls | −43% | −50% | −55% | −38% | fewer in every repetition |
| Input tokens (uncached) | −1% | −1% | −1% | −1% | fewer in every repetition |
| Output tokens | −19% | −18% | −24% | −20% | fewer in every repetition |
| Cache-read tokens | +2% | −39% | −35% | −4% | mixed |
| Cache-write tokens | −46% | −63% | −72% | −35% | fewer in every repetition |
| Total tokens (derived) | −20% | −47% | −49% | −13% | fewer in every repetition |
| Cost | −35% | −50% | −57% | −27% | fewer in every repetition |
| Wall time | −4% | −8% | −19% | −9% | fewer in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | R3 | R4 | verdict |
| --- | ---: | ---: | ---: | ---: | ---: |
| Tool calls | −44% [−52%, −30%] | −50% [−61%, −36%] | −57% [−71%, −33%] | −46% [−67%, −8%] | fewer in every repetition, outside the noise |
| Input tokens (uncached) | −1% [−1%, 0%] | −1% [−2%, −1%] | −1% [−2%, 0%] | −1% [−2%, 0%] † | fewer in every repetition, within the noise |
| Output tokens | −18% [−34%, 0%] † | −17% [−31%, −2%] | −22% [−44%, +4%] † | −23% [−43%, +7%] † | fewer in every repetition, within the noise |
| Cache-read tokens | −7% [−36%, +32%] † | −32% [−53%, −2%] | −31% [−59%, +22%] † | −29% [−63%, +44%] † | fewer in every repetition, within the noise |
| Cache-write tokens | −53% [−74%, −18%] | −65% [−76%, −47%] | −63% [−78%, −38%] n=6 | −45% [−71%, +1%] † | fewer in every repetition, within the noise |
| Total tokens (derived) | −25% [−43%, +2%] † | −44% [−59%, −21%] | −46% [−68%, −7%] | −33% [−64%, +29%] † | fewer in every repetition, within the noise |
| Cost | −39% [−58%, −14%] | −50% [−63%, −32%] | −57% [−73%, −29%] | −36% [−60%, +4%] † | fewer in every repetition, within the noise |
| Wall time | −6% [−24%, +14%] † | −8% [−21%, +9%] † | −19% [−36%, +6%] † | −10% [−24%, +6%] † | fewer in every repetition, within the noise |

### Outcome (hit@5), by repetition

Per paired task: **better** = the SigMap arm named the file and the other did not; **worse** = the reverse; **tie** = both found it or both missed. Localisation only.

| repetition | paired tasks | better | worse | tie |
| --- | ---: | ---: | ---: | ---: |
| R1 | 7 | 0 | 0 | 7 |
| R2 | 7 | 0 | 0 | 7 |
| R3 | 7 | 2 | 0 | 5 |
| R4 | 7 | 1 | 0 | 6 |
| all | 28 | 3 | 0 | 25 |

## Tool calls

Provenance: agent-reported (main-thread tool_use blocks). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 3 | 2 | −2 | 7 / 0 / 0 |
| all | 3 | 2 | −2 | 7 / 0 / 0 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 179 | 177 | −2 | 6 / 1 / 0 |
| all | 179 | 177 | −2 | 6 / 1 / 0 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 739 | 523 | −69 | 4 / 0 / 3 |
| all | 739 | 523 | −69 | 4 / 0 / 3 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 13,820 | 9,672 | −5,778 | 5 / 0 / 2 |
| all | 13,820 | 9,672 | −5,778 | 5 / 0 / 2 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 6,830 | 2,227 | −4,412 | 7 / 0 / 0 |
| all | 6,830 | 2,227 | −4,412 | 7 / 0 / 0 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 24,153 | 11,808 | −15,005 | 5 / 0 / 2 |
| all | 24,153 | 11,808 | −15,005 | 5 / 0 / 2 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd), or computed from the API's usage and a price table when the run went through the Messages API directly. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | $0.0014 | $0.0007 | −$0.0008 | 7 / 0 / 0 |
| all | $0.0014 | $0.0007 | −$0.0008 | 7 / 0 / 0 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 4.7 s | 4.0 s | −23 ms | 5 / 0 / 2 |
| all | 4.7 s | 4.0 s | −23 ms | 5 / 0 / 2 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | $0.0438 (28 runs) | $0.0250 (28 runs) | none | none |
| all | $0.0438 (28 runs) | $0.0250 (28 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| sigmap-src/h009 | without | 4/4 | 5 [2–7] | 182 [179–183] | 771 [632–1,066] | 13,111 [7,779–16,694] | 6,031 [4,924–7,592] | $0.0013 [$0.0011–$0.0015] | 4.7 s [3.8 s–6.0 s] |
| sigmap-src/h009 | with | 4/4 | 3 [2–5] | 180 [179–183] | 825 [764–1,009] | 16,328 [10,771–33,437] | 5,201 [5,093–7,330] | $0.0012 [$0.0012–$0.0018] | 5.7 s [4.6 s–7.0 s] |
| sigmap-src/h010 | without | 4/4 | 3 [2–4] | 179 [178–182] | 739 [636–835] | 13,820 [8,027–32,524] | 11,311 [8,090–13,111] | $0.0019 [$0.0015–$0.0024] | 4.4 s [4.0 s–5.6 s] |
| sigmap-src/h010 | with | 4/4 | 1 [1–1] | 176 [176–176] | 499 [433–527] | 6,160 [6,160–6,160] | 1,746 [1,745–1,762] | $0.0005 [$0.0005–$0.0006] | 4.4 s [4.1 s–5.5 s] |
| sigmap-src/h011 | without | 3/4 | 3 [3–5] | 178 [178–178] | 834 [780–1,228] | 18,284 [15,612–21,032] | 6,732 [2,836–12,214] | $0.0014 [$0.0010–$0.0024] | 4.9 s [4.4 s–6.2 s] |
| sigmap-src/h011 | with | 4/4 | 1 [1–2] | 174 [174–174] | 494 [452–647] | 6,160 [6,160–6,160] | 2,321 [2,300–8,113] | $0.0006 [$0.0006–$0.0014] | 3.1 s [2.8 s–3.6 s] |
| sigmap-src/h012 | without | 4/4 | 3 [2–3] | 179 [177–179] | 703 [651–862] | 17,704 [8,276–20,103] | 10,460 [6,626–16,611] | $0.0018 [$0.0014–$0.0027] | 5.7 s [4.4 s–6.4 s] |
| sigmap-src/h012 | with | 4/4 | 2 [1–5] | 176 [175–183] | 634 [588–878] | 9,672 [6,160–49,460] | 2,227 [0–11,886] | $0.0007 [$0.0004–$0.0024] | 4.0 s [3.9 s–5.8 s] |
| sigmap-src/h013 | without | 2/4 | 6 [4–8] | 179 [177–183] | 1,009 [841–1,219] | 17,010 [8,018–34,954] | 9,088 [6,381–13,168] | $0.0020 [$0.0013–$0.0023] | 5.8 s [4.6 s–6.6 s] |
| sigmap-src/h013 | with | 4/4 | 2 [1–3] | 177 [175–179] | 523 [441–685] | 11,233 [6,160–16,616] | 2,173 [1,803–2,838] | $0.0007 [$0.0005–$0.0009] | 3.8 s [2.9 s–4.6 s] |
| sigmap-src/h014 | without | 4/4 | 2 [2–2] | 183 [183–183] | 420 [400–459] | 8,180 [8,166–8,222] | 6,830 [6,816–6,873] | $0.0012 [$0.0012–$0.0012] | 2.9 s [2.7 s–3.3 s] |
| sigmap-src/h014 | with | 4/4 | 1 [1–2] | 181 [181–181] | 511 [458–608] | 6,160 [6,160–6,160] | 4,761 [4,673–5,603] | $0.0010 [$0.0009–$0.0010] | 2.9 s [2.6 s–3.0 s] |
| sigmap-src/h015 | without | 4/4 | 3 [3–4] | 180 [180–182] | 592 [553–748] | 7,688 [6,322–12,146] | 5,015 [4,364–9,984] | $0.0010 [$0.0009–$0.0017] | 3.7 s [3.6 s–4.3 s] |
| sigmap-src/h015 | with | 4/4 | 3 [1–3] | 180 [178–182] | 615 [262–818] | 13,431 [6,160–16,659] | 2,099 [1,543–7,680] | $0.0007 [$0.0004–$0.0016] | 4.9 s [3.0 s–5.9 s] |

