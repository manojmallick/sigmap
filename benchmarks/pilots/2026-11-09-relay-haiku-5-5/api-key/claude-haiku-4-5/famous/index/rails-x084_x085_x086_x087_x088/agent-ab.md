# Agent-level A/B — measured tool calls, tokens and cost

**anthropic-messages-api direct Messages API · claude-haiku-4-5 · 2026-11-11 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap index strategy + 7-tool core MCP profile (the docs' setup for an agent that calls the tools).
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
| rails | 5 | 8/10 | 10/10 | 0 / 0 |
| all | 5 | 8/10 | 10/10 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 5. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −37% | −44% | fewer in every repetition |
| Input tokens (uncached) | −6% | −19% | fewer in every repetition |
| Output tokens | −28% | −35% | fewer in every repetition |
| Cache-read tokens | −46% | −59% | fewer in every repetition |
| Cache-write tokens | −23% | −31% | fewer in every repetition |
| Total tokens (derived) | −43% | −56% | fewer in every repetition |
| Cost | −30% | −40% | fewer in every repetition |
| Wall time | −23% | −28% | fewer in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −35% [−44%, −25%] | −42% [−53%, −30%] | fewer in every repetition, outside the noise |
| Input tokens (uncached) | +23% [−35%, +132%] † | −1% [−53%, +91%] † | mixed |
| Output tokens | −25% [−37%, −8%] | −35% [−40%, −29%] | fewer in every repetition, outside the noise |
| Cache-read tokens | −23% [−56%, +69%] † | −57% [−71%, −36%] | fewer in every repetition, within the noise |
| Cache-write tokens | −15% [−33%, +18%] † | −33% [−48%, −13%] | fewer in every repetition, within the noise |
| Total tokens (derived) | −27% [−53%, +32%] † | −53% [−65%, −32%] | fewer in every repetition, within the noise |
| Cost | −24% [−40%, +2%] † | −39% [−51%, −23%] | fewer in every repetition, within the noise |
| Wall time | −20% [−35%, −1%] | −27% [−36%, −15%] | fewer in every repetition, outside the noise |

### Outcome (hit@5), by repetition

Per paired task: **better** = the SigMap arm named the file and the other did not; **worse** = the reverse; **tie** = both found it or both missed. Localisation only.

| repetition | paired tasks | better | worse | tie |
| --- | ---: | ---: | ---: | ---: |
| R1 | 5 | 1 | 0 | 4 |
| R2 | 5 | 1 | 0 | 4 |
| all | 10 | 2 | 0 | 8 |

## Tool calls

Provenance: agent-reported (main-thread tool_use blocks). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | 18 | 11 | −7 | 5 / 0 / 0 |
| all | 18 | 11 | −7 | 5 / 0 / 0 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | 4,518 | 3,429 | −1,094 | 3 / 0 / 2 |
| all | 4,518 | 3,429 | −1,094 | 3 / 0 / 2 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | 2,424 | 1,572 | −849 | 5 / 0 / 0 |
| all | 2,424 | 1,572 | −849 | 5 / 0 / 0 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | 128,618 | 78,727 | −49,892 | 5 / 0 / 0 |
| all | 128,618 | 78,727 | −49,892 | 5 / 0 / 0 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | 16,540 | 11,911 | −5,151 | 5 / 0 / 0 |
| all | 16,540 | 11,911 | −5,151 | 5 / 0 / 0 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | 146,997 | 95,614 | −51,830 | 5 / 0 / 0 |
| all | 146,997 | 95,614 | −51,830 | 5 / 0 / 0 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd), or computed from the API's usage and a price table when the run went through the Messages API directly. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | $0.0445 | $0.0340 | −$0.0109 | 5 / 0 / 0 |
| all | $0.0445 | $0.0340 | −$0.0109 | 5 / 0 / 0 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | 27.0 s | 17.8 s | −8.4 s | 4 / 0 / 1 |
| all | 27.0 s | 17.8 s | −8.4 s | 4 / 0 / 1 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| rails | $0.5705 (10 runs) | $0.3693 (10 runs) | none | none |
| all | $0.5705 (10 runs) | $0.3693 (10 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| rails/x084 | without | 2/2 | 13 [12–13] | 10,937 [8,746–13,127] | 1,233 [1,079–1,387] | 46,544 [13,253–79,835] | 11,081 [4,650–17,511] | $0.0356 [$0.0213–$0.0499] | 14.2 s [12.3 s–16.2 s] |
| rails/x084 | with | 2/2 | 9 [9–9] | 5,341 [3,385–7,297] | 1,057 [966–1,148] | 44,014 [42,268–45,759] | 7,715 [7,391–8,038] | $0.0247 [$0.0225–$0.0269] | 15.0 s [14.0 s–15.9 s] |
| rails/x085 | without | 2/2 | 20 [19–20] | 4,940 [4,939–4,941] | 2,424 [2,417–2,431] | 255,555 [253,518–257,591] | 21,960 [21,666–22,254] | $0.0701 [$0.0695–$0.0706] | 29.3 s [29.2 s–29.4 s] |
| rails/x085 | with | 2/2 | 13 [12–13] | 3,429 [3,429–3,429] | 1,575 [1,470–1,680] | 136,506 [126,014–146,997] | 16,464 [15,422–17,505] | $0.0455 [$0.0427–$0.0484] | 20.9 s [19.9 s–22.0 s] |
| rails/x086 | without | 2/2 | 12 [11–12] | 1,752 [1,118–2,386] | 1,486 [1,476–1,495] | 105,640 [104,020–107,259] | 16,540 [16,119–16,960] | $0.0404 [$0.0390–$0.0418] | 18.1 s [17.7 s–18.5 s] |
| rails/x086 | with | 2/2 | 8 [6–9] | 5,189 [3,401–6,977] | 1,065 [974–1,155] | 55,945 [29,790–82,099] | 11,389 [8,909–13,868] | $0.0303 [$0.0260–$0.0347] | 13.9 s [12.0 s–15.8 s] |
| rails/x087 | without | 2/2 | 18 [15–21] | 1,753 [1,153–2,353] | 2,427 [2,254–2,600] | 128,618 [109,892–147,344] | 14,199 [12,598–15,800] | $0.0445 [$0.0404–$0.0486] | 27.0 s [25.1 s–28.8 s] |
| rails/x087 | with | 2/2 | 11 [11–11] | 3,406 [3,401–3,410] | 1,572 [1,449–1,694] | 78,727 [59,116–98,337] | 11,911 [10,294–13,527] | $0.0340 [$0.0294–$0.0386] | 17.8 s [16.1 s–19.4 s] |
| rails/x088 | without | 0/2 | 28 [25–30] | 4,518 [2,705–6,331] | 2,580 [2,562–2,597] | 423,623 [417,030–430,215] | 27,920 [25,982–29,858] | $0.0947 [$0.0912–$0.0982] | 31.3 s [31.0 s–31.6 s] |
| rails/x088 | with | 2/2 | 13 [12–14] | 3,425 [3,411–3,438] | 1,686 [1,493–1,878] | 139,644 [103,661–175,626] | 19,400 [18,944–19,855] | $0.0501 [$0.0461–$0.0541] | 21.7 s [19.2 s–24.2 s] |

