# Agent-level A/B — measured tool calls, tokens and cost

**anthropic-messages-api direct Messages API · claude-haiku-4-5 · 2026-11-11 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap ranked the question BEFORE the first turn (what a prompt hook would inject): the five likeliest files with their signatures and line anchors after the question in the user turn, + the sigmap CLI; no MCP server, no standing section, no extra tool call.
- Both arms: the same prompt, model, tool allowlist (Read, Grep, Glob, Bash), per-run budget cap $0.25 and timeout 420 s; run in a clean copy of the commit pinned in `benchmarks/xrepo-repos.json`.
- Questions: the task id(s) x037, x038, x039, x040 of `benchmarks/tasks/retrieval-xrepo.jsonl`. Pass = hit@5 on the repository-relative paths the answer names.
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
| express | 4 | 8/8 | 8/8 | 0 / 0 |
| all | 4 | 8/8 | 8/8 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 4. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −60% | −41% | fewer in every repetition |
| Input tokens (uncached) | −6% | −20% | fewer in every repetition |
| Output tokens | −47% | −34% | fewer in every repetition |
| Cache-read tokens | −82% | −53% | fewer in every repetition |
| Cache-write tokens | −22% | −16% | fewer in every repetition |
| Total tokens (derived) | −71% | −44% | fewer in every repetition |
| Cost | −38% | −27% | fewer in every repetition |
| Wall time | −46% | −34% | fewer in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −48% [−73%, +9%] † | −45% [−68%, −14%] | fewer in every repetition, within the noise |
| Input tokens (uncached) | −1% [−68%, +95%] † | −31% [−55%, −1%] | fewer in every repetition, within the noise |
| Output tokens | −36% [−61%, +17%] † | −37% [−60%, −11%] | fewer in every repetition, within the noise |
| Cache-read tokens | −83% [−96%, −33%] n=2 | +3% [−24%, +38%] † n=2 | mixed |
| Cache-write tokens | −42% [−72%, +62%] † n=3 | −23% [−57%, +23%] † | fewer in every repetition, within the noise |
| Total tokens (derived) | −55% [−87%, +37%] † | −51% [−86%, +7%] † | fewer in every repetition, within the noise |
| Cost | −23% [−70%, +69%] † | −29% [−59%, −6%] | fewer in every repetition, within the noise |
| Wall time | −36% [−63%, +16%] † | −37% [−59%, −11%] | fewer in every repetition, within the noise |

### Outcome (hit@5), by repetition

Per paired task: **better** = the SigMap arm named the file and the other did not; **worse** = the reverse; **tie** = both found it or both missed. Localisation only.

| repetition | paired tasks | better | worse | tie |
| --- | ---: | ---: | ---: | ---: |
| R1 | 4 | 0 | 0 | 4 |
| R2 | 4 | 0 | 0 | 4 |
| all | 8 | 0 | 0 | 8 |

## Tool calls

Provenance: agent-reported (main-thread tool_use blocks). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | 11 | 6 | −6 | 4 / 0 / 0 |
| all | 11 | 6 | −6 | 4 / 0 / 0 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | 6,920 | 5,117 | −255 | 2 / 0 / 2 |
| all | 6,920 | 5,117 | −255 | 2 / 0 / 2 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | 1,180 | 720 | −533 | 4 / 0 / 0 |
| all | 1,180 | 720 | −533 | 4 / 0 / 0 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | 64,632 | 16,326 | −39,224 | 4 / 0 / 0 |
| all | 64,632 | 16,326 | −39,224 | 4 / 0 / 0 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | 10,067 | 6,116 | −3,211 | 3 / 0 / 1 |
| all | 10,067 | 6,116 | −3,211 | 3 / 0 / 1 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | 79,803 | 30,698 | −39,572 | 4 / 0 / 0 |
| all | 79,803 | 30,698 | −39,572 | 4 / 0 / 0 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd), or computed from the API's usage and a price table when the run went through the Messages API directly. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | $0.0287 | $0.0209 | −$0.0076 | 3 / 0 / 1 |
| all | $0.0287 | $0.0209 | −$0.0076 | 3 / 0 / 1 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | 13.9 s | 8.5 s | −5.8 s | 4 / 0 / 0 |
| all | 13.9 s | 8.5 s | −5.8 s | 4 / 0 / 0 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| express | $0.2647 (8 runs) | $0.1788 (8 runs) | none | none |
| all | $0.2647 (8 runs) | $0.1788 (8 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| express/x037 | without | 2/2 | 18 [13–23] | 9,921 [8,492–11,350] | 1,697 [1,371–2,023] | 126,855 [40,756–212,953] | 14,557 [9,223–19,890] | $0.0493 [$0.0310–$0.0676] | 21.2 s [16.4 s–26.0 s] |
| express/x037 | with | 2/2 | 9 [5–13] | 3,723 [2,050–5,396] | 1,019 [666–1,372] | 32,651 [9,171–56,131] | 7,127 [5,504–8,750] | $0.0210 [$0.0132–$0.0288] | 12.3 s [8.0 s–16.5 s] |
| express/x038 | without | 2/2 | 13 [12–13] | 3,348 [1,104–5,591] | 1,399 [1,322–1,476] | 70,720 [68,464–72,975] | 11,273 [10,217–12,329] | $0.0315 [$0.0281–$0.0349] | 16.1 s [15.5 s–16.7 s] |
| express/x038 | with | 2/2 | 6 [5–7] | 1,971 [1,968–1,974] | 772 [725–819] | 50,816 [45,808–55,824] | 16,969 [16,565–17,373] | $0.0321 [$0.0309–$0.0334] | 9.5 s [9.2 s–9.7 s] |
| express/x039 | without | 2/2 | 10 [9–11] | 8,195 [4,390–12,000] | 922 [883–961] | 17,260 [5,369–29,150] | 8,861 [7,003–10,719] | $0.0256 [$0.0251–$0.0261] | 10.5 s [10.0 s–11.0 s] |
| express/x039 | with | 2/2 | 6 [6–6] | 11,102 [9,408–12,796] | 668 [574–762] | 0 [0–0] | 5,106 [4,568–5,643] | $0.0208 [$0.0180–$0.0237] | 7.5 s [6.6 s–8.3 s] |
| express/x040 | without | 2/2 | 9 [2–16] | 5,644 [5,550–5,738] | 961 [354–1,568] | 58,544 [0–117,087] | 7,719 [0–15,437] | $0.0260 [$0.0075–$0.0444] | 11.7 s [4.7 s–18.8 s] |
| express/x040 | with | 2/2 | 4 [3–4] | 6,511 [5,115–7,907] | 522 [491–553] | 0 [0–0] | 5,053 [5,020–5,085] | $0.0154 [$0.0139–$0.0169] | 6.7 s [6.3 s–7.0 s] |

