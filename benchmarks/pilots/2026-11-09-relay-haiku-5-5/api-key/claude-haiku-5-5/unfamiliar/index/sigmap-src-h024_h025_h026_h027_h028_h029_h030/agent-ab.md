# Agent-level A/B — measured tool calls, tokens and cost

**anthropic-messages-api direct Messages API · claude-haiku-5-5 · 2026-11-11 · 4 runs per arm · publishable**

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
| sigmap-src | 7 | 24/28 | 26/28 | 0 / 0 |
| all | 7 | 24/28 | 26/28 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2, R3, R4) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 7. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | R3 | R4 | verdict |
| --- | ---: | ---: | ---: | ---: | ---: |
| Tool calls | −22% | −53% | −33% | −33% | fewer in every repetition |
| Input tokens (uncached) | −1% | −2% | −1% | −1% | fewer in every repetition |
| Output tokens | −4% | −20% | +1% | −3% | mixed |
| Cache-read tokens | −13% | −42% | −20% | −13% | fewer in every repetition |
| Cache-write tokens | −28% | −30% | −44% | −31% | fewer in every repetition |
| Total tokens (derived) | −17% | −38% | −27% | −18% | fewer in every repetition |
| Cost | −21% | −29% | −32% | −22% | fewer in every repetition |
| Wall time | +1% | −22% | 0% | −4% | mixed |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | R3 | R4 | verdict |
| --- | ---: | ---: | ---: | ---: | ---: |
| Tool calls | −15% [−60%, +55%] † | −43% [−72%, −12%] | −25% [−61%, +23%] † | −30% [−63%, +22%] † | fewer in every repetition, within the noise |
| Input tokens (uncached) | −1% [−3%, +1%] † | −2% [−5%, 0%] | −1% [−2%, +1%] † | −1% [−2%, 0%] | fewer in every repetition, within the noise |
| Output tokens | −4% [−40%, +31%] † | −16% [−51%, +18%] † | +1% [−22%, +19%] † | −5% [−34%, +22%] † | mixed |
| Cache-read tokens | +81% [−41%, +317%] † | 0% [−65%, +135%] † | +57% [−44%, +263%] † | +12% [−41%, +112%] † | mixed |
| Cache-write tokens | −33% [−64%, +2%] † | −3% [−12%, +5%] † n=6 | −47% [−71%, −20%] | −10% [−24%, +8%] † n=6 | fewer in every repetition, within the noise |
| Total tokens (derived) | +5% [−55%, +76%] † | −23% [−69%, +40%] † | −11% [−59%, +48%] † | −15% [−51%, +34%] † | mixed |
| Cost | −21% [−57%, +12%] † | −32% [−71%, +7%] † | −32% [−59%, −6%] | −29% [−63%, +10%] † | fewer in every repetition, within the noise |
| Wall time | +1% [−35%, +36%] † | −17% [−46%, +10%] † | +2% [−22%, +21%] † | −3% [−25%, +18%] † | mixed |

### Outcome (hit@5), by repetition

Per paired task: **better** = the SigMap arm named the file and the other did not; **worse** = the reverse; **tie** = both found it or both missed. Localisation only.

| repetition | paired tasks | better | worse | tie |
| --- | ---: | ---: | ---: | ---: |
| R1 | 7 | 1 | 0 | 6 |
| R2 | 7 | 1 | 0 | 6 |
| R3 | 7 | 0 | 0 | 7 |
| R4 | 7 | 0 | 0 | 7 |
| all | 28 | 2 | 0 | 26 |

## Tool calls

Provenance: agent-reported (main-thread tool_use blocks). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 4 | 2 | −1 | 4 / 2 / 1 |
| all | 4 | 2 | −1 | 4 / 2 / 1 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 181 | 176 | −1 | 4 / 2 / 1 |
| all | 181 | 176 | −1 | 4 / 2 / 1 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 764 | 722 | +108 | 2 / 0 / 5 |
| all | 764 | 722 | +108 | 2 / 0 / 5 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 11,738 | 8,581 | +3,585 | 1 / 0 / 6 |
| all | 11,738 | 8,581 | +3,585 | 1 / 0 / 6 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 8,771 | 6,960 | −985 | 7 / 0 / 0 |
| all | 8,771 | 6,960 | −985 | 7 / 0 / 0 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 21,953 | 14,566 | +2,372 | 1 / 0 / 6 |
| all | 21,953 | 14,566 | +2,372 | 1 / 0 / 6 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd), or computed from the API's usage and a price table when the run went through the Messages API directly. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | $0.0016 | $0.0014 | −$0.0001 | 5 / 0 / 2 |
| all | $0.0016 | $0.0014 | −$0.0001 | 5 / 0 / 2 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 5.0 s | 3.6 s | +166 ms | 2 / 0 / 5 |
| all | 5.0 s | 3.6 s | +166 ms | 2 / 0 / 5 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | $0.0543 (28 runs) | $0.0400 (28 runs) | none | none |
| all | $0.0543 (28 runs) | $0.0400 (28 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| sigmap-src/h024 | without | 0/4 | 8 [6–9] | 187 [186–190] | 1,463 [1,279–1,792] | 62,149 [50,879–87,990] | 16,242 [13,702–17,310] | $0.0034 [$0.0029–$0.0040] | 8.7 s [8.1 s–11.2 s] |
| sigmap-src/h024 | with | 2/4 | 7 [5–9] | 187 [184–192] | 1,616 [1,418–2,152] | 65,733 [48,664–88,476] | 13,668 [10,792–16,914] | $0.0033 [$0.0026–$0.0038] | 9.3 s [8.5 s–14.4 s] |
| sigmap-src/h025 | without | 4/4 | 9 [8–14] | 184 [179–191] | 1,292 [1,061–2,046] | 66,247 [30,585–130,479] | 17,516 [14,004–21,015] | $0.0035 [$0.0026–$0.0050] | 8.1 s [5.5 s–12.0 s] |
| sigmap-src/h025 | with | 4/4 | 1 [1–1] | 173 [173–173] | 375 [351–537] | 7,053 [6,160–7,946] | 893 [0–1,810] | $0.0004 [$0.0003–$0.0006] | 2.8 s [2.7 s–3.4 s] |
| sigmap-src/h026 | without | 4/4 | 4 [3–4] | 182 [179–183] | 764 [670–1,012] | 18,424 [8,130–27,747] | 9,025 [6,796–9,385] | $0.0016 [$0.0016–$0.0019] | 5.1 s [4.3 s–6.1 s] |
| sigmap-src/h026 | with | 4/4 | 4 [2–4] | 181 [179–183] | 846 [733–1,025] | 25,327 [10,744–33,294] | 6,960 [4,100–8,099] | $0.0015 [$0.0010–$0.0019] | 5.1 s [5.0 s–6.2 s] |
| sigmap-src/h027 | without | 4/4 | 4 [3–4] | 174 [173–175] | 776 [682–870] | 11,738 [3,134–15,937] | 8,771 [7,753–10,714] | $0.0016 [$0.0014–$0.0018] | 5.0 s [4.1 s–5.4 s] |
| sigmap-src/h027 | with | 4/4 | 3 [2–3] | 173 [173–175] | 722 [684–807] | 14,845 [10,997–21,949] | 7,787 [5,793–8,169] | $0.0015 [$0.0012–$0.0017] | 4.6 s [4.3 s–5.0 s] |
| sigmap-src/h028 | without | 4/4 | 1 [1–1] | 170 [170–170] | 437 [384–501] | 1,628 [1,628–1,628] | 5,450 [5,410–5,466] | $0.0009 [$0.0009–$0.0010] | 2.6 s [2.2 s–2.7 s] |
| sigmap-src/h028 | with | 4/4 | 2 [1–2] | 171 [170–172] | 551 [507–613] | 8,581 [6,160–11,102] | 4,465 [3,380–7,070] | $0.0009 [$0.0008–$0.0012] | 3.4 s [3.0 s–3.8 s] |
| sigmap-src/h029 | without | 4/4 | 3 [1–3] | 177 [176–178] | 603 [518–712] | 4,864 [1,628–10,599] | 7,815 [5,682–9,469] | $0.0014 [$0.0010–$0.0016] | 3.5 s [2.8 s–3.9 s] |
| sigmap-src/h029 | with | 4/4 | 2 [2–2] | 176 [176–176] | 738 [599–906] | 6,160 [6,160–6,160] | 7,340 [7,291–7,432] | $0.0014 [$0.0013–$0.0015] | 3.6 s [3.0 s–4.4 s] |
| sigmap-src/h030 | without | 4/4 | 1 [1–1] | 181 [181–181] | 445 [408–509] | 1,628 [1,628–1,628] | 5,284 [5,284–5,704] | $0.0009 [$0.0009–$0.0010] | 2.7 s [2.4 s–3.0 s] |
| sigmap-src/h030 | with | 4/4 | 1 [1–1] | 181 [181–181] | 553 [485–599] | 6,160 [6,160–6,160] | 5,275 [5,270–5,278] | $0.0010 [$0.0010–$0.0010] | 3.3 s [3.0 s–3.6 s] |

