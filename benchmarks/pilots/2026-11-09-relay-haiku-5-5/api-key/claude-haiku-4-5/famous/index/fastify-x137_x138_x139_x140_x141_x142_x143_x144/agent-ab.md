# Agent-level A/B — measured tool calls, tokens and cost

**anthropic-messages-api direct Messages API · claude-haiku-4-5 · 2026-11-11 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

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
| fastify | 8 | 14/16 | 16/16 | 2 / 0 |
| all | 8 | 14/16 | 16/16 | 2 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 8. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −35% | −31% n=6 | fewer in every repetition |
| Input tokens (uncached) | −8% | −4% n=6 | fewer in every repetition |
| Output tokens | −31% | −27% n=6 | fewer in every repetition |
| Cache-read tokens | −36% | −48% n=6 | fewer in every repetition |
| Cache-write tokens | −26% | −39% n=6 | fewer in every repetition |
| Total tokens (derived) | −35% | −46% n=6 | fewer in every repetition |
| Cost | −29% | −36% n=6 | fewer in every repetition |
| Wall time | −29% | −25% n=6 | fewer in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −40% [−55%, −18%] | −34% [−48%, −13%] n=6 | fewer in every repetition, outside the noise |
| Input tokens (uncached) | +2% [−39%, +89%] † | −8% [−41%, +39%] † n=6 | mixed |
| Output tokens | −34% [−47%, −18%] | −31% [−41%, −15%] n=6 | fewer in every repetition, outside the noise |
| Cache-read tokens | −51% [−68%, −24%] | −56% [−73%, −28%] n=6 | fewer in every repetition, outside the noise |
| Cache-write tokens | −30% [−44%, −14%] | −38% [−61%, −11%] n=6 | fewer in every repetition, outside the noise |
| Total tokens (derived) | −47% [−62%, −22%] | −51% [−67%, −26%] n=6 | fewer in every repetition, outside the noise |
| Cost | −34% [−46%, −17%] | −37% [−53%, −19%] n=6 | fewer in every repetition, outside the noise |
| Wall time | −32% [−43%, −17%] | −30% [−41%, −12%] n=6 | fewer in every repetition, outside the noise |

### Outcome (hit@5), by repetition

Per paired task: **better** = the SigMap arm named the file and the other did not; **worse** = the reverse; **tie** = both found it or both missed. Localisation only.

| repetition | paired tasks | better | worse | tie |
| --- | ---: | ---: | ---: | ---: |
| R1 | 8 | 0 | 0 | 8 |
| R2 | 6 | 0 | 0 | 6 |
| all | 14 | 0 | 0 | 14 |

## Tool calls

Provenance: agent-reported (main-thread tool_use blocks). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | 19 | 14 | −7 | 8 / 0 / 0 |
| all | 19 | 14 | −7 | 8 / 0 / 0 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | 6,098 | 7,058 | +543 | 3 / 0 / 5 |
| all | 6,098 | 7,058 | +543 | 3 / 0 / 5 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | 2,246 | 1,634 | −656 | 7 / 0 / 1 |
| all | 2,246 | 1,634 | −656 | 7 / 0 / 1 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | 263,910 | 186,271 | −92,546 | 7 / 0 / 1 |
| all | 263,910 | 186,271 | −92,546 | 7 / 0 / 1 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | 27,094 | 21,760 | −5,027 | 7 / 0 / 1 |
| all | 27,094 | 21,760 | −5,027 | 7 / 0 / 1 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | 298,879 | 215,968 | −99,021 | 7 / 0 / 1 |
| all | 298,879 | 215,968 | −99,021 | 7 / 0 / 1 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd), or computed from the API's usage and a price table when the run went through the Messages API directly. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | $0.0737 | $0.0610 | −$0.0182 | 7 / 0 / 1 |
| all | $0.0737 | $0.0610 | −$0.0182 | 7 / 0 / 1 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | 26.8 s | 20.7 s | −8.6 s | 8 / 0 / 0 |
| all | 26.8 s | 20.7 s | −8.6 s | 8 / 0 / 0 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| fastify | $1.23 (16 runs) | $0.9019 (16 runs) | $0.1919 (2 runs) | none |
| all | $1.23 (16 runs) | $0.9019 (16 runs) | $0.1919 (2 runs) | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| fastify/x137 | without | 2/2 | 21 [17–24] | 8,119 [7,770–8,467] | 2,373 [1,976–2,769] | 236,736 [96,342–377,130] | 21,017 [13,635–28,398] | $0.0699 [$0.0443–$0.0955] | 28.8 s [23.5 s–34.1 s] |
| fastify/x137 | with | 2/2 | 10 [9–11] | 5,093 [3,100–7,086] | 1,335 [1,250–1,420] | 125,739 [96,603–154,874] | 21,186 [15,379–26,993] | $0.0508 [$0.0391–$0.0626] | 17.5 s [16.5 s–18.6 s] |
| fastify/x138 | without | 2/2 | 17 [14–19] | 6,190 [4,581–7,799] | 1,924 [1,534–2,313] | 157,840 [128,754–186,926] | 16,324 [15,311–17,336] | $0.0520 [$0.0443–$0.0597] | 24.1 s [19.7 s–28.6 s] |
| fastify/x138 | with | 2/2 | 10 [7–12] | 7,071 [7,047–7,094] | 1,142 [886–1,398] | 69,620 [34,321–104,918] | 11,918 [9,516–14,320] | $0.0346 [$0.0268–$0.0425] | 14.3 s [10.8 s–17.8 s] |
| fastify/x139 | without | 2/2 | 14 [12–15] | 5,231 [4,547–5,914] | 1,554 [1,347–1,760] | 150,921 [108,915–192,926] | 22,436 [18,532–26,339] | $0.0561 [$0.0453–$0.0669] | 19.2 s [16.6 s–21.7 s] |
| fastify/x139 | with | 2/2 | 6 [4–7] | 3,053 [3,046–3,059] | 736 [554–918] | 54,049 [23,176–84,922] | 16,788 [9,930–23,645] | $0.0331 [$0.0205–$0.0457] | 10.1 s [8.1 s–12.0 s] |
| fastify/x140 | without | 1/2 | 23 [23–23] n=1 | 11,006 [11,006–11,006] n=1 | 2,529 [2,529–2,529] n=1 | 514,376 [514,376–514,376] n=1 | 43,814 [43,814–43,814] n=1 | $0.1299 [$0.1299–$0.1299] n=1 | 32.0 s [32.0 s–32.0 s] n=1 |
| fastify/x140 | with | 2/2 | 17 [16–17] | 5,100 [3,113–7,087] | 1,949 [1,905–1,992] | 275,987 [217,674–334,299] | 29,190 [26,191–32,189] | $0.0789 [$0.0676–$0.0903] | 24.0 s [23.9 s–24.1 s] |
| fastify/x141 | without | 2/2 | 25 [17–32] | 5,816 [4,655–6,976] | 2,494 [2,172–2,816] | 291,084 [287,841–294,326] | 30,121 [29,658–30,584] | $0.0850 [$0.0846–$0.0855] | 29.3 s [26.9 s–31.7 s] |
| fastify/x141 | with | 2/2 | 21 [18–24] | 7,046 [6,943–7,148] | 2,211 [1,868–2,554] | 308,818 [96,642–520,994] | 22,693 [14,852–30,533] | $0.0773 [$0.0445–$0.1102] | 26.8 s [21.7 s–31.9 s] |
| fastify/x142 | without | 2/2 | 17 [14–20] | 6,930 [5,529–8,330] | 2,120 [1,988–2,251] | 168,044 [156,516–179,571] | 29,985 [20,041–39,929] | $0.0718 [$0.0575–$0.0861] | 24.7 s [24.3 s–25.2 s] |
| fastify/x142 | with | 2/2 | 11 [10–11] | 7,136 [7,131–7,140] | 1,389 [1,375–1,403] | 36,524 [36,228–36,820] | 8,396 [8,046–8,746] | $0.0282 [$0.0279–$0.0286] | 15.5 s [15.2 s–15.7 s] |
| fastify/x143 | without | 1/2 | 18 [18–18] n=1 | 1,162 [1,162–1,162] n=1 | 1,825 [1,825–1,825] n=1 | 299,567 [299,567–299,567] n=1 | 28,343 [28,343–28,343] n=1 | $0.0757 [$0.0757–$0.0757] n=1 | 24.0 s [24.0 s–24.0 s] n=1 |
| fastify/x143 | with | 2/2 | 17 [14–19] | 7,154 [7,140–7,167] | 1,880 [1,612–2,147] | 272,954 [147,472–398,435] | 26,210 [17,464–34,955] | $0.0766 [$0.0518–$0.1014] | 23.8 s [20.2 s–27.4 s] |
| fastify/x144 | without | 2/2 | 23 [19–26] | 6,006 [4,682–7,330] | 2,773 [2,381–3,165] | 303,683 [255,336–352,030] | 25,846 [25,139–26,552] | $0.0825 [$0.0735–$0.0915] | 32.7 s [29.0 s–36.5 s] |
| fastify/x144 | with | 2/2 | 19 [14–23] | 7,138 [7,082–7,194] | 2,308 [1,967–2,649] | 246,804 [239,536–254,071] | 22,333 [19,970–24,696] | $0.0713 [$0.0694–$0.0732] | 29.0 s [24.6 s–33.4 s] |

