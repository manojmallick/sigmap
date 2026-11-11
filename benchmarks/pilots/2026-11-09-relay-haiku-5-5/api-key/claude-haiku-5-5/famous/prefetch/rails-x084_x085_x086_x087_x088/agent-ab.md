# Agent-level A/B — measured tool calls, tokens and cost

**anthropic-messages-api direct Messages API · claude-haiku-5-5 · 2026-11-11 · 4 runs per arm · publishable**

- Arms: **without** = no SigMap; **with** = SigMap ranked the question BEFORE the first turn (what a prompt hook would inject): the five likeliest files with their signatures and line anchors after the question in the user turn, + the sigmap CLI; no MCP server, no standing section, no extra tool call.
- Both arms: the same prompt, model, tool allowlist (Read, Grep, Glob, Bash), per-run budget cap $0.25 and timeout 420 s; run in a clean copy of the commit pinned in `benchmarks/xrepo-repos.json`.
- Questions: the task id(s) x084, x085, x086, x087, x088 of `benchmarks/tasks/retrieval-xrepo.jsonl`. Pass = hit@5 on the repository-relative paths the answer names.
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
| rails | 5 | 20/20 | 20/20 | 0 / 0 |
| all | 5 | 20/20 | 20/20 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2, R3, R4) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 5. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | R3 | R4 | verdict |
| --- | ---: | ---: | ---: | ---: | ---: |
| Tool calls | −33% | −63% | −56% | −58% | fewer in every repetition |
| Input tokens (uncached) | +767% | +759% | +764% | +759% | more in every repetition |
| Output tokens | −4% | −21% | +4% | −13% | mixed |
| Cache-read tokens | −60% | −81% | −78% | −52% | fewer in every repetition |
| Cache-write tokens | −54% | −63% | −63% | −40% | fewer in every repetition |
| Total tokens (derived) | −43% | −66% | −59% | −35% | fewer in every repetition |
| Cost | −26% | −42% | −35% | −18% | fewer in every repetition |
| Wall time | +10% | −26% | −6% | −19% | mixed |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | R3 | R4 | verdict |
| --- | ---: | ---: | ---: | ---: | ---: |
| Tool calls | −31% [−46%, −10%] n=4 | −63% [−71%, −54%] n=4 | −31% [−46%, −10%] n=4 | −46% [−60%, −20%] n=3 | fewer in every repetition, outside the noise |
| Input tokens (uncached) | +763% [+664%, +874%] | +755% [+655%, +868%] | +759% [+665%, +864%] | +755% [+655%, +869%] | more in every repetition, outside the noise |
| Output tokens | −4% [−21%, +16%] † | −18% [−32%, +5%] † | +2% [−30%, +48%] † | −11% [−24%, +6%] † | mixed |
| Cache-read tokens | −64% [−77%, −42%] | −81% [−89%, −67%] | −81% [−93%, −54%] | −65% [−79%, −43%] | fewer in every repetition, outside the noise |
| Cache-write tokens | −47% [−59%, −37%] n=4 | −58% [−65%, −48%] n=4 | −55% [−65%, −42%] n=4 | −5% [−19%, +19%] † n=3 | fewer in every repetition, within the noise |
| Total tokens (derived) | −46% [−56%, −30%] | −64% [−70%, −58%] | −61% [−79%, −41%] | −45% [−63%, −25%] | fewer in every repetition, outside the noise |
| Cost | −29% [−39%, −17%] | −42% [−45%, −37%] | −37% [−57%, −15%] | −26% [−47%, +2%] † | fewer in every repetition, within the noise |
| Wall time | +10% [−4%, +24%] † | −23% [−35%, −7%] | −7% [−33%, +29%] † | −18% [−31%, −4%] | mixed |

### Outcome (hit@5), by repetition

Per paired task: **better** = the SigMap arm named the file and the other did not; **worse** = the reverse; **tie** = both found it or both missed. Localisation only.

| repetition | paired tasks | better | worse | tie |
| --- | ---: | ---: | ---: | ---: |
| R1 | 5 | 0 | 0 | 5 |
| R2 | 5 | 0 | 0 | 5 |
| R3 | 5 | 0 | 0 | 5 |
| R4 | 5 | 0 | 0 | 5 |
| all | 20 | 0 | 0 | 20 |

## Tool calls

Provenance: agent-reported (main-thread tool_use blocks). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | 4 | 2 | −2 | 5 / 0 / 0 |
| all | 4 | 2 | −2 | 5 / 0 / 0 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | 218 | 1,846 | +1,628 | 0 / 0 / 5 |
| all | 218 | 1,846 | +1,628 | 0 / 0 / 5 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | 902 | 665 | −163 | 3 / 0 / 2 |
| all | 902 | 665 | −163 | 3 / 0 / 2 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | 8,020 | 1,628 | −6,219 | 5 / 0 / 0 |
| all | 8,020 | 1,628 | −6,219 | 5 / 0 / 0 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | 5,885 | 3,362 | −3,860 | 5 / 0 / 0 |
| all | 5,885 | 3,362 | −3,860 | 5 / 0 / 0 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | 17,439 | 9,107 | −8,129 | 5 / 0 / 0 |
| all | 17,439 | 9,107 | −8,129 | 5 / 0 / 0 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd), or computed from the API's usage and a price table when the run went through the Messages API directly. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | $0.0014 | $0.0010 | −$0.0004 | 5 / 0 / 0 |
| all | $0.0014 | $0.0010 | −$0.0004 | 5 / 0 / 0 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | 5.4 s | 4.9 s | −502 ms | 4 / 0 / 1 |
| all | 5.4 s | 4.9 s | −502 ms | 4 / 0 / 1 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| rails | $0.0292 (20 runs) | $0.0201 (20 runs) | none | none |
| all | $0.0292 (20 runs) | $0.0201 (20 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| rails/x084 | without | 4/4 | 1 [1–6] | 207 [207–213] | 503 [475–1,118] | 1,628 [1,628–22,584] | 5,363 [5,287–7,829] | $0.0010 [$0.0009–$0.0018] | 2.9 s [2.9 s–6.0 s] |
| rails/x084 | with | 4/4 | 0 [0–0] | 2,101 [2,101–2,101] | 634 [617–702] | 814 [814–814] | 0 [0–0] | $0.0005 [$0.0005–$0.0006] | 3.3 s [3.0 s–3.8 s] |
| rails/x085 | without | 4/4 | 4 [2–5] | 218 [215–219] | 933 [835–1,042] | 14,348 [7,029–16,578] | 5,885 [5,510–7,279] | $0.0014 [$0.0012–$0.0016] | 5.8 s [4.7 s–6.3 s] |
| rails/x085 | with | 4/4 | 2 [1–4] | 1,846 [1,845–1,849] | 665 [538–967] | 3,282 [1,628–11,811] | 3,362 [3,104–6,393] | $0.0010 [$0.0009–$0.0016] | 4.9 s [3.1 s–6.5 s] |
| rails/x086 | without | 4/4 | 3 [2–4] | 233 [233–235] | 797 [729–897] | 8,020 [5,245–8,065] | 5,833 [4,703–6,153] | $0.0012 [$0.0011–$0.0013] | 4.6 s [4.1 s–5.2 s] |
| rails/x086 | with | 4/4 | 1 [0–1] | 1,612 [1,610–1,612] | 621 [562–764] | 1,628 [814–1,628] | 1,981 [0–2,153] | $0.0007 [$0.0005–$0.0008] | 3.8 s [3.3 s–4.0 s] |
| rails/x087 | without | 4/4 | 4 [3–4] | 216 [215–217] | 902 [705–1,022] | 7,847 [7,735–20,648] | 8,612 [4,075–12,257] | $0.0016 [$0.0011–$0.0022] | 5.4 s [4.1 s–6.6 s] |
| rails/x087 | with | 4/4 | 2 [2–2] | 2,148 [2,148–2,148] | 934 [786–1,249] | 1,628 [1,628–1,628] | 4,752 [4,573–5,239] | $0.0013 [$0.0012–$0.0015] | 4.9 s [4.1 s–6.0 s] |
| rails/x088 | without | 4/4 | 4 [3–7] | 219 [217–223] | 1,097 [628–1,367] | 12,779 [7,683–36,892] | 9,546 [7,401–12,005] | $0.0019 [$0.0015–$0.0024] | 5.8 s [3.5 s–7.8 s] |
| rails/x088 | with | 4/4 | 3 [2–3] | 1,737 [1,737–1,739] | 934 [913–1,025] | 7,431 [6,009–9,917] | 5,082 [4,365–6,648] | $0.0014 [$0.0012–$0.0016] | 5.4 s [4.7 s–5.7 s] |

