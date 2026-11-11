# Agent-level A/B — measured tool calls, tokens and cost

**anthropic-messages-api direct Messages API · claude-haiku-5-5 · 2026-11-11 · 4 runs per arm · publishable**

- Arms: **without** = no SigMap; **with** = SigMap index strategy + 7-tool core MCP profile (the docs' setup for an agent that calls the tools).
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
| laravel | 5 | 20/20 | 20/20 | 0 / 0 |
| all | 5 | 20/20 | 20/20 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2, R3, R4) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 5. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | R3 | R4 | verdict |
| --- | ---: | ---: | ---: | ---: | ---: |
| Tool calls | −24% | −6% | −42% | −20% | fewer in every repetition |
| Input tokens (uncached) | −1% | 0% | −1% | −1% | fewer in every repetition |
| Output tokens | −9% | +13% | −15% | +2% | mixed |
| Cache-read tokens | +3% | +20% | +11% | +16% | more in every repetition |
| Cache-write tokens | −61% | −69% | −72% | −53% | fewer in every repetition |
| Total tokens (derived) | −17% | −15% | −22% | −9% | fewer in every repetition |
| Cost | −38% | −39% | −47% | −30% | fewer in every repetition |
| Wall time | −14% | +16% | −14% | −6% | mixed |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | R3 | R4 | verdict |
| --- | ---: | ---: | ---: | ---: | ---: |
| Tool calls | −27% [−50%, +8%] † | −14% [−38%, +21%] † | −39% [−54%, −20%] | −24% [−42%, +1%] † | fewer in every repetition, within the noise |
| Input tokens (uncached) | −1% [−3%, +1%] † | 0% [−1%, +1%] † | −1% [−2%, 0%] | −1% [−1%, 0%] | fewer in every repetition, within the noise |
| Output tokens | −9% [−22%, +5%] † | +9% [−17%, +51%] † | −13% [−29%, +9%] † | +1% [−10%, +14%] † | mixed |
| Cache-read tokens | −4% [−32%, +50%] † | +27% [−24%, +121%] † | +9% [−20%, +51%] † | +25% [−14%, +91%] † | mixed |
| Cache-write tokens | −59% [−69%, −45%] | −70% [−77%, −61%] | −74% [−80%, −66%] | −47% [−67%, −15%] | fewer in every repetition, outside the noise |
| Total tokens (derived) | −22% [−40%, +9%] † | −17% [−39%, +25%] † | −24% [−40%, −2%] | −1% [−32%, +50%] † | fewer in every repetition, within the noise |
| Cost | −38% [−49%, −28%] | −41% [−52%, −21%] | −48% [−53%, −40%] | −26% [−44%, −1%] | fewer in every repetition, outside the noise |
| Wall time | −14% [−29%, 0%] | +14% [−18%, +58%] † | −13% [−26%, +4%] † | −6% [−14%, +5%] † | mixed |

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
| laravel | 4 | 3 | −1 | 4 / 0 / 1 |
| all | 4 | 3 | −1 | 4 / 0 / 1 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | 204 | 201 | −2 | 3 / 1 / 1 |
| all | 204 | 201 | −2 | 3 / 1 / 1 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | 1,059 | 948 | −150 | 3 / 0 / 2 |
| all | 1,059 | 948 | −150 | 3 / 0 / 2 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | 12,174 | 14,881 | +2,049 | 2 / 0 / 3 |
| all | 12,174 | 14,881 | +2,049 | 2 / 0 / 3 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | 8,397 | 2,996 | −5,342 | 5 / 0 / 0 |
| all | 8,397 | 2,996 | −5,342 | 5 / 0 / 0 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | 22,688 | 18,822 | −2,108 | 3 / 0 / 2 |
| all | 22,688 | 18,822 | −2,108 | 3 / 0 / 2 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd), or computed from the API's usage and a price table when the run went through the Messages API directly. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | $0.0018 | $0.0010 | −$0.0006 | 5 / 0 / 0 |
| all | $0.0018 | $0.0010 | −$0.0006 | 5 / 0 / 0 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | 6.2 s | 5.4 s | −775 ms | 4 / 0 / 1 |
| all | 6.2 s | 5.4 s | −775 ms | 4 / 0 / 1 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| laravel | $0.0338 (20 runs) | $0.0208 (20 runs) | none | none |
| all | $0.0338 (20 runs) | $0.0208 (20 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| laravel/x046 | without | 4/4 | 5 [2–8] | 205 [201–209] | 1,066 [717–1,453] | 9,448 [4,809–15,868] | 5,030 [2,013–6,938] | $0.0013 [$0.0008–$0.0017] | 6.4 s [4.4 s–8.2 s] |
| laravel/x046 | with | 4/4 | 3 [1–3] | 201 [199–203] | 916 [848–951] | 11,497 [7,264–16,392] | 2,077 [1,321–2,646] | $0.0009 [$0.0007–$0.0009] | 5.4 s [4.9 s–8.2 s] |
| laravel/x047 | without | 4/4 | 3 [3–4] | 196 [196–196] | 1,101 [1,078–1,126] | 16,496 [15,536–18,017] | 10,505 [9,066–11,115] | $0.0021 [$0.0019–$0.0021] | 6.2 s [5.8 s–6.5 s] |
| laravel/x047 | with | 4/4 | 3 [2–3] | 194 [194–194] | 948 [901–1,113] | 11,838 [11,715–12,071] | 2,871 [2,185–2,996] | $0.0010 [$0.0010–$0.0010] | 5.4 s [5.1 s–5.8 s] |
| laravel/x048 | without | 4/4 | 4 [3–4] | 206 [205–207] | 911 [716–1,004] | 12,174 [8,127–16,487] | 9,418 [8,213–10,505] | $0.0018 [$0.0015–$0.0020] | 5.4 s [4.1 s–6.4 s] |
| laravel/x048 | with | 4/4 | 5 [2–6] | 208 [203–211] | 1,199 [976–1,649] | 22,832 [7,264–34,546] | 4,583 [1,598–5,331] | $0.0015 [$0.0008–$0.0016] | 6.2 s [4.7 s–8.3 s] |
| laravel/x049 | without | 4/4 | 5 [4–6] | 201 [201–201] | 1,059 [1,013–1,250] | 11,802 [5,321–15,296] | 8,397 [7,854–9,373] | $0.0017 [$0.0017–$0.0018] | 6.4 s [6.3 s–6.5 s] |
| laravel/x049 | with | 4/4 | 4 [3–5] | 201 [199–201] | 1,120 [730–1,156] | 17,042 [11,499–18,087] | 3,055 [2,135–3,474] | $0.0011 [$0.0008–$0.0012] | 6.0 s [4.7 s–6.8 s] |
| laravel/x050 | without | 4/4 | 4 [4–6] | 204 [203–205] | 980 [906–1,142] | 19,665 [9,600–24,330] | 8,363 [5,435–9,194] | $0.0018 [$0.0013–$0.0020] | 6.1 s [5.5 s–6.8 s] |
| laravel/x050 | with | 4/4 | 3 [2–3] | 202 [201–203] | 806 [748–946] | 14,881 [11,641–17,981] | 2,996 [2,080–3,647] | $0.0010 [$0.0008–$0.0011] | 5.0 s [4.5 s–5.9 s] |

