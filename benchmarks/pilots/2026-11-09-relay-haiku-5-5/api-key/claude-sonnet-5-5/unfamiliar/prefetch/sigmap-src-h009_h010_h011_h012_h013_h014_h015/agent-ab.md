# Agent-level A/B — measured tool calls, tokens and cost

**anthropic-messages-api direct Messages API · claude-sonnet-5-5 · 2026-11-11 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

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
| sigmap-src | 7 | 13/14 | 14/14 | 0 / 0 |
| all | 7 | 13/14 | 14/14 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 7. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −45% | −48% | fewer in every repetition |
| Input tokens (uncached) | +1180% | +1182% | more in every repetition |
| Output tokens | −31% | −21% | fewer in every repetition |
| Cache-read tokens | −79% | −64% | fewer in every repetition |
| Cache-write tokens | −59% | −42% | fewer in every repetition |
| Total tokens (derived) | −65% | −48% | fewer in every repetition |
| Cost | −43% | −25% | fewer in every repetition |
| Wall time | −51% | −39% | fewer in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −55% [−74%, −25%] | −55% [−78%, +4%] † | fewer in every repetition, within the noise |
| Input tokens (uncached) | +1139% [+898%, +1367%] | +1141% [+902%, +1373%] | more in every repetition, outside the noise |
| Output tokens | −31% [−46%, −11%] | −21% [−41%, +10%] † | fewer in every repetition, within the noise |
| Cache-read tokens | −81% [−90%, −63%] | −70% [−87%, −28%] | fewer in every repetition, outside the noise |
| Cache-write tokens | −56% [−65%, −44%] | −39% [−57%, −11%] | fewer in every repetition, outside the noise |
| Total tokens (derived) | −60% [−71%, −46%] | −41% [−59%, −7%] | fewer in every repetition, outside the noise |
| Cost | −39% [−50%, −26%] | −20% [−36%, +7%] † | fewer in every repetition, within the noise |
| Wall time | −51% [−60%, −40%] | −39% [−55%, −18%] | fewer in every repetition, outside the noise |

### Outcome (hit@5), by repetition

Per paired task: **better** = the SigMap arm named the file and the other did not; **worse** = the reverse; **tie** = both found it or both missed. Localisation only.

| repetition | paired tasks | better | worse | tie |
| --- | ---: | ---: | ---: | ---: |
| R1 | 7 | 0 | 0 | 7 |
| R2 | 7 | 1 | 0 | 6 |
| all | 14 | 1 | 0 | 13 |

## Tool calls

Provenance: agent-reported (main-thread tool_use blocks). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 5 | 2 | −3 | 6 / 0 / 1 |
| all | 5 | 2 | −3 | 6 / 0 / 1 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 182 | 2,171 | +1,989 | 0 / 0 / 7 |
| all | 182 | 2,171 | +1,989 | 0 / 0 / 7 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 706 | 477 | −151 | 6 / 0 / 1 |
| all | 706 | 477 | −151 | 6 / 0 / 1 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 15,368 | 3,215 | −13,740 | 6 / 0 / 1 |
| all | 15,368 | 3,215 | −13,740 | 6 / 0 / 1 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 6,855 | 4,395 | −2,825 | 7 / 0 / 0 |
| all | 6,855 | 4,395 | −2,825 | 7 / 0 / 0 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 25,120 | 9,418 | −14,762 | 6 / 0 / 1 |
| all | 25,120 | 9,418 | −14,762 | 6 / 0 / 1 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd), or computed from the API's usage and a price table when the run went through the Messages API directly. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | $0.0270 | $0.0214 | −$0.0063 | 6 / 0 / 1 |
| all | $0.0270 | $0.0214 | −$0.0063 | 6 / 0 / 1 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 8.5 s | 5.1 s | −3.9 s | 7 / 0 / 0 |
| all | 8.5 s | 5.1 s | −3.9 s | 7 / 0 / 0 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | $0.4591 (14 runs) | $0.2996 (14 runs) | none | none |
| all | $0.4591 (14 runs) | $0.2996 (14 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| sigmap-src/h009 | without | 2/2 | 5 [4–5] | 182 [181–183] | 602 [554–649] | 17,552 [14,381–20,722] | 6,855 [6,801–6,909] | $0.0270 [$0.0258–$0.0283] | 12.3 s [10.3 s–14.3 s] |
| sigmap-src/h009 | with | 2/2 | 2 [1–3] | 2,126 [2,125–2,127] | 477 [355–598] | 3,431 [1,628–5,234] | 4,395 [3,070–5,720] | $0.0207 [$0.0190–$0.0224] | 4.2 s [3.1 s–5.3 s] |
| sigmap-src/h010 | without | 2/2 | 5 [5–5] | 181 [180–182] | 706 [681–731] | 22,455 [11,358–33,552] | 11,840 [9,422–14,257] | $0.0415 [$0.0330–$0.0500] | 8.0 s [7.3 s–8.7 s] |
| sigmap-src/h010 | with | 2/2 | 1 [1–1] | 2,907 [2,907–2,907] | 418 [343–493] | 1,628 [1,628–1,628] | 4,465 [4,418–4,511] | $0.0215 [$0.0208–$0.0221] | 3.9 s [3.5 s–4.3 s] |
| sigmap-src/h011 | without | 2/2 | 5 [3–6] | 178 [178–178] | 925 [873–976] | 15,368 [14,932–15,804] | 8,650 [7,276–10,023] | $0.0343 [$0.0304–$0.0382] | 7.6 s [7.2 s–8.0 s] |
| sigmap-src/h011 | with | 2/2 | 1 [1–1] | 2,852 [2,852–2,852] | 488 [473–503] | 1,628 [1,628–1,628] | 4,396 [4,391–4,401] | $0.0219 [$0.0218–$0.0220] | 4.5 s [4.4 s–4.5 s] |
| sigmap-src/h012 | without | 2/2 | 7 [6–7] | 184 [183–185] | 1,115 [1,107–1,122] | 56,955 [54,945–58,964] | 15,694 [12,351–19,036] | $0.0621 [$0.0541–$0.0702] | 12.0 s [11.7 s–12.3 s] |
| sigmap-src/h012 | with | 2/2 | 6 [5–7] | 2,076 [2,074–2,078] | 964 [770–1,157] | 19,963 [11,295–28,631] | 4,493 [3,360–5,626] | $0.0290 [$0.0282–$0.0299] | 8.1 s [6.5 s–9.7 s] |
| sigmap-src/h013 | without | 1/2 | 7 [7–7] | 182 [181–183] | 911 [844–978] | 9,331 [7,636–11,026] | 3,460 [3,365–3,555] | $0.0200 [$0.0199–$0.0201] | 12.8 s [12.5 s–13.2 s] |
| sigmap-src/h013 | with | 2/2 | 2 [1–2] | 2,171 [2,170–2,172] | 474 [414–534] | 3,215 [1,628–4,801] | 2,547 [2,378–2,715] | $0.0161 [$0.0148–$0.0174] | 5.1 s [4.4 s–5.8 s] |
| sigmap-src/h014 | without | 2/2 | 2 [2–2] | 183 [183–183] | 483 [474–491] | 8,096 [8,036–8,156] | 6,656 [6,516–6,796] | $0.0235 [$0.0230–$0.0239] | 8.5 s [6.8 s–10.3 s] |
| sigmap-src/h014 | with | 2/2 | 1 [1–1] | 2,835 [2,835–2,835] | 363 [323–402] | 1,628 [1,628–1,628] | 3,832 [3,813–3,850] | $0.0192 [$0.0188–$0.0196] | 5.7 s [4.6 s–6.7 s] |
| sigmap-src/h015 | without | 2/2 | 3 [1–4] | 179 [178–180] | 460 [385–535] | 5,087 [1,628–8,545] | 6,056 [3,992–8,120] | $0.0211 [$0.0145–$0.0277] | 7.1 s [4.8 s–9.4 s] |
| sigmap-src/h015 | with | 2/2 | 5 [4–5] | 1,290 [1,289–1,291] | 674 [630–718] | 6,233 [4,373–8,093] | 4,345 [2,873–5,816] | $0.0214 [$0.0177–$0.0252] | 6.0 s [5.9 s–6.1 s] |

