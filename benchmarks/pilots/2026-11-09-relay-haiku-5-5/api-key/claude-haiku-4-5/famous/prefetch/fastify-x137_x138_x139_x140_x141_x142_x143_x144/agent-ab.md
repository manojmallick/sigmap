# Agent-level A/B — measured tool calls, tokens and cost

**anthropic-messages-api direct Messages API · claude-haiku-4-5 · 2026-11-11 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

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
| fastify | 8 | 15/16 | 15/16 | 0 / 0 |
| all | 8 | 15/16 | 15/16 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 8. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −20% | −15% | fewer in every repetition |
| Input tokens (uncached) | −53% | −70% | fewer in every repetition |
| Output tokens | −17% | −13% | fewer in every repetition |
| Cache-read tokens | −41% | +7% | mixed |
| Cache-write tokens | −32% | −19% | fewer in every repetition |
| Total tokens (derived) | −40% | +1% | mixed |
| Cost | −35% | −16% | fewer in every repetition |
| Wall time | −21% | −14% | fewer in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −23% [−39%, −2%] | −19% [−36%, +3%] † | fewer in every repetition, within the noise |
| Input tokens (uncached) | −47% [−65%, −16%] | −68% [−76%, −59%] | fewer in every repetition, outside the noise |
| Output tokens | −19% [−34%, +1%] † | −17% [−31%, +4%] † | fewer in every repetition, within the noise |
| Cache-read tokens | −46% [−66%, −18%] | −15% [−54%, +52%] † | fewer in every repetition, within the noise |
| Cache-write tokens | −32% [−42%, −20%] | −21% [−41%, +13%] † | fewer in every repetition, within the noise |
| Total tokens (derived) | −44% [−63%, −19%] | −16% [−52%, +43%] † | fewer in every repetition, within the noise |
| Cost | −35% [−49%, −20%] | −22% [−44%, +11%] † | fewer in every repetition, within the noise |
| Wall time | −23% [−37%, −4%] | −18% [−34%, +4%] † | fewer in every repetition, within the noise |

### Outcome (hit@5), by repetition

Per paired task: **better** = the SigMap arm named the file and the other did not; **worse** = the reverse; **tie** = both found it or both missed. Localisation only.

| repetition | paired tasks | better | worse | tie |
| --- | ---: | ---: | ---: | ---: |
| R1 | 8 | 0 | 0 | 8 |
| R2 | 8 | 1 | 1 | 6 |
| all | 16 | 1 | 1 | 14 |

## Tool calls

Provenance: agent-reported (main-thread tool_use blocks). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | 20 | 17 | −4 | 5 / 0 / 3 |
| all | 20 | 17 | −4 | 5 / 0 / 3 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | 5,944 | 2,322 | −3,657 | 8 / 0 / 0 |
| all | 5,944 | 2,322 | −3,657 | 8 / 0 / 0 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | 2,126 | 1,762 | −398 | 6 / 0 / 2 |
| all | 2,126 | 1,762 | −398 | 6 / 0 / 2 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | 222,387 | 179,743 | −49,015 | 5 / 0 / 3 |
| all | 222,387 | 179,743 | −49,015 | 5 / 0 / 3 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | 28,914 | 19,029 | −7,443 | 7 / 0 / 1 |
| all | 28,914 | 19,029 | −7,443 | 7 / 0 / 1 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | 258,323 | 200,885 | −61,766 | 6 / 0 / 2 |
| all | 258,323 | 200,885 | −61,766 | 6 / 0 / 2 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd), or computed from the API's usage and a price table when the run went through the Messages API directly. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | $0.0773 | $0.0539 | −$0.0226 | 7 / 0 / 1 |
| all | $0.0773 | $0.0539 | −$0.0226 | 7 / 0 / 1 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | 25.8 s | 21.8 s | −5.7 s | 5 / 0 / 3 |
| all | 25.8 s | 21.8 s | −5.7 s | 5 / 0 / 3 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| fastify | $1.20 (16 runs) | $0.8847 (16 runs) | none | none |
| all | $1.20 (16 runs) | $0.8847 (16 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| fastify/x137 | without | 2/2 | 18 [15–20] | 11,290 [7,035–15,545] | 2,019 [1,638–2,400] | 219,777 [210,155–229,398] | 30,367 [22,405–38,329] | $0.0813 [$0.0700–$0.0927] | 25.2 s [21.0 s–29.5 s] |
| fastify/x137 | with | 2/2 | 13 [7–19] | 2,389 [2,355–2,422] | 1,523 [990–2,055] | 152,138 [56,816–247,460] | 21,408 [20,897–21,918] | $0.0520 [$0.0404–$0.0636] | 15.7 s [10.8 s–20.6 s] |
| fastify/x138 | without | 1/2 | 26 [25–26] | 5,405 [3,674–7,135] | 2,614 [2,444–2,784] | 291,654 [232,824–350,484] | 23,349 [18,359–28,338] | $0.0768 [$0.0656–$0.0881] | 32.8 s [32.5 s–33.0 s] |
| fastify/x138 | with | 2/2 | 17 [14–19] | 2,181 [2,157–2,204] | 1,753 [1,552–1,953] | 164,879 [88,689–241,068] | 17,422 [15,318–19,525] | $0.0492 [$0.0379–$0.0605] | 20.9 s [18.2 s–23.6 s] |
| fastify/x139 | without | 2/2 | 17 [15–19] | 7,811 [4,554–11,067] | 1,872 [1,662–2,081] | 250,160 [208,317–292,003] | 28,377 [25,024–31,730] | $0.0777 [$0.0650–$0.0903] | 23.7 s [21.2 s–26.3 s] |
| fastify/x139 | with | 2/2 | 11 [11–11] | 2,138 [2,137–2,138] | 1,248 [1,208–1,287] | 58,230 [47,725–68,735] | 12,901 [10,255–15,547] | $0.0303 [$0.0258–$0.0349] | 14.7 s [13.9 s–15.5 s] |
| fastify/x140 | without | 2/2 | 21 [19–22] | 4,675 [4,649–4,700] | 2,233 [2,104–2,362] | 211,890 [206,294–217,486] | 32,476 [24,870–40,081] | $0.0776 [$0.0669–$0.0884] | 26.3 s [24.9 s–27.7 s] |
| fastify/x140 | with | 2/2 | 18 [14–21] | 2,308 [2,291–2,325] | 1,935 [1,797–2,072] | 302,999 [192,315–413,682] | 26,998 [22,044–31,952] | $0.0760 [$0.0581–$0.0940] | 24.0 s [22.2 s–25.7 s] |
| fastify/x141 | without | 2/2 | 20 [17–22] | 8,101 [7,854–8,348] | 1,945 [1,820–2,070] | 212,788 [118,071–307,504] | 30,361 [26,172–34,549] | $0.0771 [$0.0627–$0.0914] | 23.2 s [22.7 s–23.7 s] |
| fastify/x141 | with | 1/2 | 21 [15–26] | 3,714 [1,907–5,520] | 2,206 [1,810–2,601] | 213,900 [183,048–244,752] | 18,655 [18,454–18,855] | $0.0594 [$0.0528–$0.0661] | 26.9 s [22.3 s–31.5 s] |
| fastify/x142 | without | 2/2 | 20 [18–21] | 6,484 [4,590–8,378] | 2,515 [2,124–2,905] | 297,911 [259,287–336,534] | 29,450 [25,874–33,026] | $0.0857 [$0.0812–$0.0901] | 29.4 s [26.1 s–32.8 s] |
| fastify/x142 | with | 2/2 | 11 [9–13] | 2,395 [2,377–2,412] | 1,425 [1,166–1,683] | 91,806 [79,654–103,957] | 19,404 [16,295–22,513] | $0.0430 [$0.0416–$0.0443] | 17.1 s [13.8 s–20.4 s] |
| fastify/x143 | without | 2/2 | 18 [17–18] | 4,239 [1,138–7,339] | 1,820 [1,729–1,910] | 176,955 [147,021–206,888] | 20,268 [16,301–24,234] | $0.0564 [$0.0520–$0.0608] | 22.7 s [21.2 s–24.3 s] |
| fastify/x143 | with | 2/2 | 19 [16–21] | 2,337 [2,326–2,347] | 1,771 [1,767–1,774] | 304,403 [202,999–405,807] | 28,020 [18,946–37,093] | $0.0767 [$0.0552–$0.0981] | 22.8 s [22.2 s–23.4 s] |
| fastify/x144 | without | 2/2 | 21 [16–25] | 4,803 [4,650–4,956] | 2,367 [2,018–2,716] | 224,998 [155,760–294,236] | 20,905 [20,538–21,271] | $0.0653 [$0.0560–$0.0745] | 27.9 s [24.3 s–31.6 s] |
| fastify/x144 | with | 2/2 | 22 [19–24] | 2,197 [2,178–2,215] | 2,853 [2,422–3,284] | 194,607 [183,554–205,660] | 15,881 [15,228–16,534] | $0.0558 [$0.0533–$0.0582] | 32.9 s [27.4 s–38.4 s] |

