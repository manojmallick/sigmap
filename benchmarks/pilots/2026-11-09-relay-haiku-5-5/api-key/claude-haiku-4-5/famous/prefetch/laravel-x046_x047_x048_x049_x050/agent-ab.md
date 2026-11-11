# Agent-level A/B — measured tool calls, tokens and cost

**anthropic-messages-api direct Messages API · claude-haiku-4-5 · 2026-11-11 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap ranked the question BEFORE the first turn (what a prompt hook would inject): the five likeliest files with their signatures and line anchors after the question in the user turn, + the sigmap CLI; no MCP server, no standing section, no extra tool call.
- Both arms: the same prompt, model, tool allowlist (Read, Grep, Glob, Bash), per-run budget cap $0.25 and timeout 420 s; run in a clean copy of the commit pinned in `benchmarks/xrepo-repos.json`.
- Questions: the task id(s) x046, x047, x048, x049, x050 of `benchmarks/tasks/retrieval-xrepo.jsonl`. Pass = hit@5 on the repository-relative paths the answer names.
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
| laravel | 5 | 10/10 | 10/10 | 0 / 0 |
| all | 5 | 10/10 | 10/10 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 5. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −16% | +5% | mixed |
| Input tokens (uncached) | −25% | −41% | fewer in every repetition |
| Output tokens | −17% | +16% | mixed |
| Cache-read tokens | −38% | +19% | mixed |
| Cache-write tokens | −20% | +3% | mixed |
| Total tokens (derived) | −36% | +16% | mixed |
| Cost | −25% | +6% | mixed |
| Wall time | −15% | +15% | mixed |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −20% [−48%, +14%] † | +1% [−27%, +41%] † | mixed |
| Input tokens (uncached) | +16% [−49%, +134%] † | −17% [−59%, +58%] † | mixed |
| Output tokens | −19% [−42%, +6%] † | +14% [−18%, +54%] † | mixed |
| Cache-read tokens | −42% [−68%, −6%] | +20% [−52%, +178%] † | mixed |
| Cache-write tokens | −21% [−35%, −4%] | −2% [−38%, +35%] † | fewer in every repetition, within the noise |
| Total tokens (derived) | −37% [−60%, −6%] | +14% [−51%, +144%] † | mixed |
| Cost | −25% [−39%, −7%] | +3% [−39%, +61%] † | mixed |
| Wall time | −17% [−38%, +8%] † | +14% [−20%, +61%] † | mixed |

### Outcome (hit@5), by repetition

Per paired task: **better** = the SigMap arm named the file and the other did not; **worse** = the reverse; **tie** = both found it or both missed. Localisation only.

| repetition | paired tasks | better | worse | tie |
| --- | ---: | ---: | ---: | ---: |
| R1 | 5 | 0 | 0 | 5 |
| R2 | 5 | 0 | 0 | 5 |
| all | 10 | 0 | 0 | 10 |

## Tool calls

Provenance: agent-reported (main-thread tool_use blocks). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | 14 | 13 | −4 | 3 / 0 / 2 |
| all | 14 | 13 | −4 | 3 / 0 / 2 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | 2,748 | 2,803 | +76 | 2 / 0 / 3 |
| all | 2,748 | 2,803 | +76 | 2 / 0 / 3 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | 1,646 | 1,605 | −207 | 3 / 0 / 2 |
| all | 1,646 | 1,605 | −207 | 3 / 0 / 2 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | 124,186 | 131,540 | −13,960 | 3 / 0 / 2 |
| all | 124,186 | 131,540 | −13,960 | 3 / 0 / 2 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | 17,153 | 18,343 | +1,483 | 2 / 0 / 3 |
| all | 17,153 | 18,343 | +1,483 | 2 / 0 / 3 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | 145,765 | 155,087 | −21,510 | 3 / 0 / 2 |
| all | 145,765 | 155,087 | −21,510 | 3 / 0 / 2 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd), or computed from the API's usage and a price table when the run went through the Messages API directly. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | $0.0499 | $0.0452 | −$0.0063 | 3 / 0 / 2 |
| all | $0.0499 | $0.0452 | −$0.0063 | 3 / 0 / 2 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | 19.7 s | 18.4 s | −1.5 s | 3 / 0 / 2 |
| all | 19.7 s | 18.4 s | −1.5 s | 3 / 0 / 2 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| laravel | $0.4935 (10 runs) | $0.4479 (10 runs) | none | none |
| all | $0.4935 (10 runs) | $0.4479 (10 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| laravel/x046 | without | 2/2 | 17 [15–18] | 1,119 [1,108–1,130] | 1,646 [1,469–1,823] | 159,014 [140,995–177,033] | 20,985 [20,010–21,960] | $0.0515 [$0.0500–$0.0530] | 19.7 s [17.7 s–21.8 s] |
| laravel/x046 | with | 2/2 | 13 [12–13] | 2,803 [2,790–2,815] | 1,439 [1,290–1,588] | 133,380 [96,680–170,079] | 17,466 [16,607–18,324] | $0.0452 [$0.0397–$0.0507] | 18.2 s [15.9 s–20.6 s] |
| laravel/x047 | without | 2/2 | 19 [17–20] | 2,748 [1,131–4,365] | 2,130 [1,998–2,261] | 218,893 [198,051–239,735] | 21,082 [20,188–21,975] | $0.0616 [$0.0562–$0.0671] | 25.4 s [23.3 s–27.4 s] |
| laravel/x047 | with | 2/2 | 13 [12–14] | 2,824 [2,813–2,835] | 1,605 [1,518–1,692] | 73,237 [54,140–92,334] | 10,171 [9,118–11,223] | $0.0309 [$0.0272–$0.0346] | 18.4 s [16.9 s–19.9 s] |
| laravel/x048 | without | 2/2 | 13 [12–14] | 11,538 [10,151–12,925] | 1,573 [1,241–1,904] | 90,795 [57,511–124,078] | 17,153 [16,688–17,617] | $0.0499 [$0.0457–$0.0541] | 19.0 s [15.6 s–22.5 s] |
| laravel/x048 | with | 2/2 | 9 [5–13] | 2,772 [2,751–2,793] | 1,306 [829–1,782] | 76,835 [24,065–129,605] | 18,636 [15,146–22,125] | $0.0403 [$0.0282–$0.0523] | 16.1 s [11.0 s–21.3 s] |
| laravel/x049 | without | 2/2 | 13 [10–16] | 3,472 [2,316–4,627] | 1,758 [1,426–2,089] | 124,186 [68,347–180,025] | 16,350 [13,825–18,874] | $0.0451 [$0.0359–$0.0544] | 20.5 s [16.6 s–24.5 s] |
| laravel/x049 | with | 2/2 | 18 [14–21] | 3,200 [3,182–3,218] | 2,153 [1,712–2,593] | 131,540 [84,294–178,786] | 18,544 [11,244–25,844] | $0.0503 [$0.0342–$0.0664] | 24.9 s [20.5 s–29.3 s] |
| laravel/x050 | without | 2/2 | 14 [13–15] | 1,831 [1,117–2,545] | 1,625 [1,620–1,629] | 93,820 [61,489–126,150] | 15,400 [13,951–16,848] | $0.0386 [$0.0342–$0.0429] | 19.0 s [17.1 s–21.0 s] |
| laravel/x050 | with | 2/2 | 20 [13–26] | 1,995 [1,954–2,036] | 2,212 [1,456–2,968] | 213,346 [107,131–319,561] | 18,343 [18,112–18,573] | $0.0573 [$0.0426–$0.0720] | 26.5 s [18.2 s–34.8 s] |

