# Agent-level A/B — measured tool calls, tokens and cost

**anthropic-messages-api direct Messages API · claude-haiku-5-5 · 2026-11-11 · 4 runs per arm · publishable**

- Arms: **without** = no SigMap; **with** = SigMap index strategy + 7-tool core MCP profile (the docs' setup for an agent that calls the tools).
- Both arms: the same prompt, model, tool allowlist (Read, Grep, Glob, Bash), per-run budget cap $0.25 and timeout 420 s; run in a clean copy of the commit pinned in `benchmarks/xrepo-repos.json`.
- Questions: the task id(s) x137, x138, x139, x140, x141, x142, x143, x144 of `benchmarks/tasks/retrieval-xrepo.jsonl`. Pass = hit@5 on the repository-relative paths the answer names.
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
| fastify | 8 | 32/32 | 32/32 | 0 / 0 |
| all | 8 | 32/32 | 32/32 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2, R3, R4) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 8. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | R3 | R4 | verdict |
| --- | ---: | ---: | ---: | ---: | ---: |
| Tool calls | −48% | −41% | −30% | −30% | fewer in every repetition |
| Input tokens (uncached) | −1% | −1% | −1% | −1% | fewer in every repetition |
| Output tokens | −30% | −24% | −20% | −17% | fewer in every repetition |
| Cache-read tokens | −38% | −2% | +26% | +35% | mixed |
| Cache-write tokens | −62% | −59% | −43% | −52% | fewer in every repetition |
| Total tokens (derived) | −44% | −21% | +3% | −2% | mixed |
| Cost | −48% | −41% | −28% | −34% | fewer in every repetition |
| Wall time | −34% | −26% | −23% | −18% | fewer in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | R3 | R4 | verdict |
| --- | ---: | ---: | ---: | ---: | ---: |
| Tool calls | −44% [−65%, −16%] | −42% [−53%, −29%] | −29% [−50%, +9%] † | −26% [−40%, −10%] | fewer in every repetition, within the noise |
| Input tokens (uncached) | −1% [−3%, 0%] | −1% [−2%, 0%] | −1% [−2%, +1%] † | −1% [−1%, 0%] | fewer in every repetition, within the noise |
| Output tokens | −27% [−43%, −11%] | −23% [−31%, −13%] | −20% [−34%, 0%] † | −17% [−25%, −8%] | fewer in every repetition, within the noise |
| Cache-read tokens | −12% [−60%, +79%] † | +14% [−19%, +60%] † | +35% [−26%, +136%] † | +42% [+11%, +70%] | mixed |
| Cache-write tokens | −59% [−73%, −32%] | −55% [−71%, −29%] | −45% [−66%, −22%] | −49% [−60%, −32%] | fewer in every repetition, outside the noise |
| Total tokens (derived) | −30% [−63%, +27%] † | −11% [−35%, +21%] † | +3% [−38%, +64%] † | 0% [−17%, +20%] † | mixed |
| Cost | −44% [−61%, −20%] | −37% [−50%, −20%] | −29% [−48%, −5%] | −32% [−41%, −20%] | fewer in every repetition, outside the noise |
| Wall time | −32% [−49%, −13%] | −23% [−36%, −9%] | −20% [−40%, +7%] † | −16% [−24%, −7%] | fewer in every repetition, within the noise |

### Outcome (hit@5), by repetition

Per paired task: **better** = the SigMap arm named the file and the other did not; **worse** = the reverse; **tie** = both found it or both missed. Localisation only.

| repetition | paired tasks | better | worse | tie |
| --- | ---: | ---: | ---: | ---: |
| R1 | 8 | 0 | 0 | 8 |
| R2 | 8 | 0 | 0 | 8 |
| R3 | 8 | 0 | 0 | 8 |
| R4 | 8 | 0 | 0 | 8 |
| all | 32 | 0 | 0 | 32 |

## Tool calls

Provenance: agent-reported (main-thread tool_use blocks). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | 4 | 3 | −1 | 7 / 1 / 0 |
| all | 4 | 3 | −1 | 7 / 1 / 0 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | 218 | 213 | −1 | 6 / 2 / 0 |
| all | 218 | 213 | −1 | 6 / 2 / 0 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | 915 | 732 | −176 | 8 / 0 / 0 |
| all | 915 | 732 | −176 | 8 / 0 / 0 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | 10,300 | 11,527 | +1,700 | 3 / 0 / 5 |
| all | 10,300 | 11,527 | +1,700 | 3 / 0 / 5 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | 6,211 | 2,957 | −3,826 | 7 / 0 / 1 |
| all | 6,211 | 2,957 | −3,826 | 7 / 0 / 1 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | 19,788 | 15,406 | −3,235 | 6 / 0 / 2 |
| all | 19,788 | 15,406 | −3,235 | 6 / 0 / 2 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd), or computed from the API's usage and a price table when the run went through the Messages API directly. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | $0.0015 | $0.0009 | −$0.0007 | 7 / 0 / 1 |
| all | $0.0015 | $0.0009 | −$0.0007 | 7 / 0 / 1 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | 5.4 s | 4.4 s | −860 ms | 7 / 0 / 1 |
| all | 5.4 s | 4.4 s | −860 ms | 7 / 0 / 1 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| fastify | $0.0456 (32 runs) | $0.0282 (32 runs) | none | none |
| all | $0.0456 (32 runs) | $0.0282 (32 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| fastify/x137 | without | 4/4 | 4 [3–5] | 223 [222–224] | 888 [825–977] | 12,019 [6,415–20,146] | 9,012 [5,842–12,094] | $0.0017 [$0.0012–$0.0022] | 5.2 s [4.5 s–5.9 s] |
| fastify/x137 | with | 4/4 | 3 [2–3] | 222 [222–224] | 725 [634–772] | 12,147 [9,771–16,287] | 3,453 [3,071–3,801] | $0.0009 [$0.0008–$0.0010] | 4.5 s [4.1 s–4.9 s] |
| fastify/x138 | without | 4/4 | 4 [3–4] | 205 [205–207] | 704 [626–728] | 4,031 [3,404–6,337] | 2,688 [1,963–2,962] | $0.0007 [$0.0007–$0.0008] | 4.2 s [3.7 s–4.6 s] |
| fastify/x138 | with | 4/4 | 3 [1–4] | 205 [203–205] | 647 [529–664] | 11,867 [6,696–12,022] | 2,987 [2,640–3,354] | $0.0008 [$0.0008–$0.0009] | 4.3 s [3.5 s–4.5 s] |
| fastify/x139 | without | 4/4 | 2 [2–3] | 210 [210–210] | 870 [683–928] | 8,582 [8,468–8,620] | 7,911 [7,745–8,405] | $0.0015 [$0.0014–$0.0016] | 4.7 s [4.1 s–5.0 s] |
| fastify/x139 | with | 4/4 | 2 [2–2] | 210 [210–210] | 681 [615–797] | 12,304 [11,728–12,465] | 3,260 [2,685–3,421] | $0.0009 [$0.0009–$0.0009] | 4.4 s [3.7 s–4.7 s] |
| fastify/x140 | without | 4/4 | 3 [2–9] | 223 [222–232] | 1,062 [763–1,718] | 12,278 [8,173–68,511] | 8,496 [6,820–13,094] | $0.0017 [$0.0013–$0.0032] | 5.7 s [4.4 s–9.9 s] |
| fastify/x140 | with | 4/4 | 3 [2–5] | 222 [220–228] | 901 [622–1,127] | 11,574 [6,696–35,246] | 2,927 [1,930–6,426] | $0.0009 [$0.0007–$0.0017] | 5.0 s [3.2 s–7.1 s] |
| fastify/x141 | without | 4/4 | 8 [7–9] | 220 [219–225] | 1,307 [1,286–1,486] | 19,029 [16,451–28,152] | 4,940 [4,684–7,104] | $0.0015 [$0.0015–$0.0018] | 8.8 s [8.1 s–9.4 s] |
| fastify/x141 | with | 4/4 | 3 [2–4] | 213 [211–215] | 933 [658–1,005] | 10,915 [6,696–15,533] | 1,731 [1,278–2,207] | $0.0009 [$0.0006–$0.0009] | 5.1 s [3.3 s–5.7 s] |
| fastify/x142 | without | 4/4 | 4 [3–5] | 213 [212–216] | 799 [737–1,055] | 8,087 [5,188–9,757] | 5,273 [2,303–7,462] | $0.0012 [$0.0008–$0.0014] | 4.9 s [4.4 s–6.6 s] |
| fastify/x142 | with | 4/4 | 3 [2–4] | 212 [212–214] | 652 [594–815] | 11,358 [11,095–16,723] | 2,250 [1,866–2,607] | $0.0007 [$0.0007–$0.0009] | 3.8 s [3.4 s–4.7 s] |
| fastify/x143 | without | 4/4 | 5 [3–5] | 216 [212–218] | 983 [848–1,281] | 19,883 [5,615–20,394] | 7,149 [6,746–7,997] | $0.0016 [$0.0013–$0.0019] | 8.7 s [5.8 s–9.4 s] |
| fastify/x143 | with | 4/4 | 3 [2–4] | 212 [210–216] | 759 [666–843] | 10,985 [6,696–23,321] | 2,706 [1,071–3,116] | $0.0008 [$0.0006–$0.0011] | 4.4 s [3.7 s–5.3 s] |
| fastify/x144 | without | 4/4 | 4 [4–5] | 221 [221–221] | 942 [930–1,007] | 6,541 [4,664–7,629] | 4,150 [3,787–4,399] | $0.0011 [$0.0010–$0.0011] | 5.7 s [5.4 s–5.8 s] |
| fastify/x144 | with | 4/4 | 2 [2–2] | 219 [219–219] | 740 [631–846] | 11,480 [10,714–11,755] | 3,764 [3,017–3,816] | $0.0010 [$0.0008–$0.0010] | 4.7 s [4.5 s–5.0 s] |

