# Agent-level A/B — measured tool calls, tokens and cost

**anthropic-messages-api direct Messages API · claude-sonnet-5-5 · 2026-11-11 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

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
| sigmap-src | 7 | 13/14 | 13/14 | 0 / 0 |
| all | 7 | 13/14 | 13/14 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 7. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −17% | −35% | fewer in every repetition |
| Input tokens (uncached) | −1% | −1% | fewer in every repetition |
| Output tokens | −19% | −23% | fewer in every repetition |
| Cache-read tokens | +17% | −18% | mixed |
| Cache-write tokens | −36% | −40% | fewer in every repetition |
| Total tokens (derived) | 0% | −23% | mixed |
| Cost | −25% | −32% | fewer in every repetition |
| Wall time | −31% | −28% | fewer in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −21% [−56%, +30%] † | −31% [−59%, +10%] † | fewer in every repetition, within the noise |
| Input tokens (uncached) | −1% [−2%, +1%] † | −1% [−2%, 0%] † | fewer in every repetition, within the noise |
| Output tokens | −22% [−40%, −3%] | −22% [−46%, +4%] † | fewer in every repetition, within the noise |
| Cache-read tokens | −10% [−53%, +81%] † | +44% [−30%, +180%] † | mixed |
| Cache-write tokens | −46% [−70%, −8%] | −23% [−52%, +47%] † n=6 | fewer in every repetition, within the noise |
| Total tokens (derived) | −26% [−57%, +27%] † | −4% [−45%, +66%] † | fewer in every repetition, within the noise |
| Cost | −36% [−61%, −2%] | −36% [−65%, +7%] † | fewer in every repetition, within the noise |
| Wall time | −33% [−53%, −5%] | −33% [−48%, −12%] | fewer in every repetition, outside the noise |

### Outcome (hit@5), by repetition

Per paired task: **better** = the SigMap arm named the file and the other did not; **worse** = the reverse; **tie** = both found it or both missed. Localisation only.

| repetition | paired tasks | better | worse | tie |
| --- | ---: | ---: | ---: | ---: |
| R1 | 7 | 0 | 1 | 6 |
| R2 | 7 | 1 | 0 | 6 |
| all | 14 | 1 | 1 | 12 |

## Tool calls

Provenance: agent-reported (main-thread tool_use blocks). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 5 | 3 | −2 | 5 / 0 / 2 |
| all | 5 | 3 | −2 | 5 / 0 / 2 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 181 | 179 | −2 | 5 / 1 / 1 |
| all | 181 | 179 | −2 | 5 / 1 / 1 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 752 | 481 | −197 | 6 / 0 / 1 |
| all | 752 | 481 | −197 | 6 / 0 / 1 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 18,424 | 11,256 | −1,150 | 4 / 0 / 3 |
| all | 18,424 | 11,256 | −1,150 | 4 / 0 / 3 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 7,105 | 5,242 | −2,368 | 6 / 0 / 1 |
| all | 7,105 | 5,242 | −2,368 | 6 / 0 / 1 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 24,185 | 16,047 | −414 | 4 / 0 / 3 |
| all | 24,185 | 16,047 | −414 | 4 / 0 / 3 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd), or computed from the API's usage and a price table when the run went through the Messages API directly. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | $0.0279 | $0.0205 | −$0.0054 | 5 / 0 / 2 |
| all | $0.0279 | $0.0205 | −$0.0054 | 5 / 0 / 2 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 8.6 s | 5.1 s | −3.3 s | 5 / 0 / 2 |
| all | 8.6 s | 5.1 s | −3.3 s | 5 / 0 / 2 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | $0.4799 (14 runs) | $0.3407 (14 runs) | none | none |
| all | $0.4799 (14 runs) | $0.3407 (14 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| sigmap-src/h009 | without | 2/2 | 5 [4–5] | 181 [179–183] | 672 [595–749] | 15,234 [7,753–22,715] | 7,105 [6,481–7,729] | $0.0279 [$0.0241–$0.0317] | 12.7 s [10.2 s–15.3 s] |
| sigmap-src/h009 | with | 2/2 | 3 [2–3] | 179 [177–181] | 475 [415–535] | 11,086 [6,160–16,012] | 2,515 [2,127–2,903] | $0.0136 [$0.0130–$0.0142] | 5.1 s [4.7 s–5.5 s] |
| sigmap-src/h010 | without | 2/2 | 6 [5–7] | 181 [180–182] | 827 [773–881] | 26,673 [17,709–35,637] | 14,517 [13,532–15,502] | $0.0503 [$0.0455–$0.0551] | 8.6 s [8.2 s–8.9 s] |
| sigmap-src/h010 | with | 2/2 | 2 [1–3] | 177 [176–178] | 481 [315–646] | 11,256 [6,160–16,351] | 5,242 [1,805–8,678] | $0.0205 [$0.0092–$0.0318] | 4.6 s [3.4 s–5.7 s] |
| sigmap-src/h011 | without | 2/2 | 4 [3–5] | 179 [178–180] | 752 [662–842] | 19,221 [15,976–22,466] | 8,929 [8,467–9,391] | $0.0340 [$0.0336–$0.0344] | 6.8 s [6.0 s–7.6 s] |
| sigmap-src/h011 | with | 2/2 | 3 [1–4] | 176 [174–178] | 402 [250–554] | 13,440 [8,482–18,398] | 2,029 [0–4,058] | $0.0121 [$0.0045–$0.0197] | 4.2 s [3.0 s–5.4 s] |
| sigmap-src/h012 | without | 2/2 | 10 [7–13] | 186 [183–189] | 1,608 [1,184–2,031] | 72,637 [33,918–111,355] | 13,555 [8,583–18,526] | $0.0649 [$0.0404–$0.0893] | 15.4 s [11.5 s–19.2 s] |
| sigmap-src/h012 | with | 2/2 | 9 [9–9] | 188 [187–189] | 1,309 [1,179–1,439] | 87,620 [80,985–94,255] | 13,341 [12,872–13,809] | $0.0643 [$0.0632–$0.0655] | 16.4 s [15.0 s–17.8 s] |
| sigmap-src/h013 | without | 1/2 | 6 [5–7] | 182 [179–185] | 886 [740–1,031] | 18,424 [5,135–31,712] | 4,694 [1,483–7,904] | $0.0246 [$0.0125–$0.0368] | 12.9 s [9.9 s–15.9 s] |
| sigmap-src/h013 | with | 1/2 | 5 [4–5] | 179 [179–179] | 876 [823–929] | 17,274 [17,058–17,489] | 5,443 [4,723–6,162] | $0.0262 [$0.0239–$0.0285] | 8.9 s [8.9 s–8.9 s] |
| sigmap-src/h014 | without | 2/2 | 2 [1–2] | 182 [181–183] | 405 [363–447] | 4,729 [1,628–7,829] | 5,868 [5,426–6,309] | $0.0200 [$0.0179–$0.0222] | 4.4 s [3.8 s–5.0 s] |
| sigmap-src/h014 | with | 2/2 | 2 [2–2] | 181 [181–181] | 485 [483–486] | 6,160 [6,160–6,160] | 5,733 [4,032–7,433] | $0.0208 [$0.0165–$0.0250] | 5.1 s [4.5 s–5.7 s] |
| sigmap-src/h015 | without | 2/2 | 2 [1–2] | 178 [178–178] | 471 [465–477] | 1,628 [1,628–1,628] | 5,137 [4,850–5,424] | $0.0182 [$0.0176–$0.0189] | 7.2 s [6.3 s–8.0 s] |
| sigmap-src/h015 | with | 2/2 | 2 [2–2] | 178 [178–178] | 430 [410–449] | 6,160 [6,160–6,160] | 2,770 [2,388–3,151] | $0.0128 [$0.0120–$0.0136] | 3.9 s [3.7 s–4.1 s] |

