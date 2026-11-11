# Agent-level A/B — measured tool calls, tokens and cost

**anthropic-messages-api direct Messages API · claude-haiku-5-5 · 2026-11-11 · 4 runs per arm · publishable**

- Arms: **without** = no SigMap; **with** = SigMap ranked the question BEFORE the first turn (what a prompt hook would inject): the five likeliest files with their signatures and line anchors after the question in the user turn, + the sigmap CLI; no MCP server, no standing section, no extra tool call.
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
| Tool calls | −57% | −42% | −63% | −54% | fewer in every repetition |
| Input tokens (uncached) | +650% | +656% | +647% | +648% | more in every repetition |
| Output tokens | −12% | −16% | −31% | −23% | fewer in every repetition |
| Cache-read tokens | −72% | −70% | −81% | −74% | fewer in every repetition |
| Cache-write tokens | −41% | −40% | −45% | −40% | fewer in every repetition |
| Total tokens (derived) | −51% | −45% | −62% | −54% | fewer in every repetition |
| Cost | −23% | −23% | −34% | −26% | fewer in every repetition |
| Wall time | −17% | −21% | −41% | −37% | fewer in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | R3 | R4 | verdict |
| --- | ---: | ---: | ---: | ---: | ---: |
| Tool calls | −59% [−74%, −36%] | −34% [−62%, +7%] † | −63% [−73%, −50%] | −56% [−69%, −37%] | fewer in every repetition, within the noise |
| Input tokens (uncached) | +644% [+574%, +704%] | +650% [+581%, +710%] | +641% [+569%, +701%] | +642% [+570%, +702%] | more in every repetition, outside the noise |
| Output tokens | −10% [−27%, +10%] † | −14% [−29%, +3%] † | −27% [−40%, −13%] | −22% [−29%, −12%] | fewer in every repetition, within the noise |
| Cache-read tokens | −71% [−86%, −40%] | −65% [−81%, −39%] | −80% [−90%, −59%] | −77% [−89%, −50%] | fewer in every repetition, outside the noise |
| Cache-write tokens | −34% [−55%, +1%] † | −41% [−54%, −25%] | −44% [−57%, −26%] | −38% [−54%, −16%] | fewer in every repetition, within the noise |
| Total tokens (derived) | −45% [−66%, −11%] | −42% [−59%, −19%] | −58% [−73%, −36%] | −52% [−69%, −24%] | fewer in every repetition, outside the noise |
| Cost | −18% [−38%, +11%] † | −22% [−36%, −5%] | −31% [−44%, −14%] | −24% [−38%, −7%] | fewer in every repetition, within the noise |
| Wall time | −13% [−32%, +9%] † | −20% [−34%, −3%] | −37% [−54%, −18%] | −35% [−47%, −21%] | fewer in every repetition, within the noise |

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
| fastify | 5 | 2 | −3 | 8 / 0 / 0 |
| all | 5 | 2 | −3 | 8 / 0 / 0 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | 219 | 1,653 | +1,439 | 0 / 0 / 8 |
| all | 219 | 1,653 | +1,439 | 0 / 0 / 8 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | 949 | 760 | −170 | 7 / 0 / 1 |
| all | 949 | 760 | −170 | 7 / 0 / 1 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | 11,510 | 1,628 | −9,032 | 7 / 0 / 1 |
| all | 11,510 | 1,628 | −9,032 | 7 / 0 / 1 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | 5,452 | 3,353 | −2,695 | 7 / 0 / 1 |
| all | 5,452 | 3,353 | −2,695 | 7 / 0 / 1 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | 19,689 | 8,409 | −12,571 | 7 / 0 / 1 |
| all | 19,689 | 8,409 | −12,571 | 7 / 0 / 1 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd), or computed from the API's usage and a price table when the run went through the Messages API directly. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | $0.0014 | $0.0010 | −$0.0005 | 6 / 0 / 2 |
| all | $0.0014 | $0.0010 | −$0.0005 | 6 / 0 / 2 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | 5.7 s | 4.2 s | −1.3 s | 7 / 0 / 1 |
| all | 5.7 s | 4.2 s | −1.3 s | 7 / 0 / 1 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| fastify | $0.0448 (32 runs) | $0.0329 (32 runs) | none | none |
| all | $0.0448 (32 runs) | $0.0329 (32 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| fastify/x137 | without | 4/4 | 5 [4–7] | 224 [224–226] | 882 [825–1,284] | 12,764 [9,470–19,917] | 7,485 [6,850–8,353] | $0.0016 [$0.0015–$0.0017] | 5.7 s [5.3 s–7.2 s] |
| fastify/x137 | with | 4/4 | 1 [1–1] | 1,821 [1,821–1,821] | 745 [713–822] | 1,628 [1,628–1,628] | 3,073 [3,060–3,086] | $0.0010 [$0.0009–$0.0010] | 4.0 s [3.9 s–4.4 s] |
| fastify/x138 | without | 4/4 | 3 [3–3] | 205 [205–207] | 643 [601–675] | 4,029 [4,020–8,211] | 3,929 [3,191–3,974] | $0.0009 [$0.0008–$0.0009] | 3.7 s [3.5 s–4.3 s] |
| fastify/x138 | with | 4/4 | 3 [2–3] | 1,567 [1,565–1,567] | 690 [660–892] | 4,852 [1,628–4,952] | 3,251 [3,183–4,173] | $0.0009 [$0.0009–$0.0012] | 4.2 s [4.0 s–5.0 s] |
| fastify/x139 | without | 4/4 | 3 [2–3] | 210 [210–210] | 804 [766–832] | 8,556 [8,543–8,623] | 7,950 [7,632–8,387] | $0.0015 [$0.0014–$0.0016] | 4.6 s [4.2 s–4.7 s] |
| fastify/x139 | with | 4/4 | 2 [1–2] | 1,615 [1,615–1,615] | 663 [626–857] | 1,628 [1,628–1,628] | 2,988 [2,851–4,293] | $0.0009 [$0.0009–$0.0010] | 3.5 s [3.1 s–5.0 s] |
| fastify/x140 | without | 4/4 | 5 [1–7] | 225 [220–226] | 988 [660–1,855] | 23,109 [1,628–30,078] | 10,762 [5,807–11,712] | $0.0021 [$0.0011–$0.0027] | 5.6 s [3.7 s–9.0 s] |
| fastify/x140 | with | 4/4 | 2 [2–2] | 1,772 [1,772–1,772] | 788 [741–1,003] | 1,628 [1,628–1,628] | 5,060 [3,950–6,308] | $0.0012 [$0.0011–$0.0014] | 4.2 s [3.6 s–4.9 s] |
| fastify/x141 | without | 4/4 | 8 [5–8] | 220 [215–223] | 1,284 [1,110–1,329] | 16,437 [5,939–27,400] | 5,254 [4,228–6,062] | $0.0014 [$0.0012–$0.0017] | 8.2 s [6.6 s–9.2 s] |
| fastify/x141 | with | 4/4 | 2 [2–3] | 1,203 [1,203–1,205] | 826 [693–1,008] | 1,628 [1,628–4,335] | 2,059 [1,873–3,061] | $0.0008 [$0.0007–$0.0011] | 4.2 s [3.6 s–5.3 s] |
| fastify/x142 | without | 4/4 | 5 [3–5] | 215 [214–216] | 910 [837–1,036] | 10,257 [5,391–12,224] | 4,059 [2,020–6,049] | $0.0011 [$0.0007–$0.0014] | 5.7 s [5.3 s–6.5 s] |
| fastify/x142 | with | 4/4 | 3 [3–4] | 1,853 [1,853–1,855] | 852 [705–961] | 5,116 [4,743–9,385] | 3,653 [3,528–4,131] | $0.0011 [$0.0010–$0.0013] | 4.5 s [4.1 s–5.8 s] |
| fastify/x143 | without | 4/4 | 5 [1–7] | 217 [210–218] | 1,155 [664–1,468] | 15,505 [1,628–28,640] | 5,649 [4,312–7,934] | $0.0014 [$0.0010–$0.0020] | 9.4 s [4.2 s–13.0 s] |
| fastify/x143 | with | 4/4 | 1 [1–1] | 1,690 [1,690–1,690] | 657 [594–715] | 1,628 [1,628–1,628] | 3,454 [3,418–3,653] | $0.0010 [$0.0009–$0.0010] | 3.6 s [3.4 s–4.4 s] |
| fastify/x144 | without | 4/4 | 5 [3–5] | 221 [219–223] | 1,006 [709–1,061] | 7,972 [5,876–9,554] | 4,422 [3,942–8,814] | $0.0012 [$0.0011–$0.0016] | 5.6 s [4.0 s–6.4 s] |
| fastify/x144 | with | 4/4 | 2 [2–2] | 1,492 [1,492–1,492] | 775 [719–890] | 4,767 [4,334–5,117] | 4,587 [3,834–4,705] | $0.0011 [$0.0011–$0.0012] | 4.7 s [4.1 s–4.8 s] |

