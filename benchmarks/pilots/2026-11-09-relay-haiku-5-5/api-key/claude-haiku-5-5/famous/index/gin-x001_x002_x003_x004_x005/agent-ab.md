# Agent-level A/B — measured tool calls, tokens and cost

**anthropic-messages-api direct Messages API · claude-haiku-5-5 · 2026-11-11 · 4 runs per arm · publishable**

- Arms: **without** = no SigMap; **with** = SigMap index strategy + 7-tool core MCP profile (the docs' setup for an agent that calls the tools).
- Both arms: the same prompt, model, tool allowlist (Read, Grep, Glob, Bash), per-run budget cap $0.25 and timeout 420 s; run in a clean copy of the commit pinned in `benchmarks/xrepo-repos.json`.
- Questions: the task id(s) x001, x002, x003, x004, x005 of `benchmarks/tasks/retrieval-xrepo.jsonl`. Pass = hit@5 on the repository-relative paths the answer names.
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
| gin | 5 | 20/20 | 20/20 | 0 / 0 |
| all | 5 | 20/20 | 20/20 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2, R3, R4) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 5. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | R3 | R4 | verdict |
| --- | ---: | ---: | ---: | ---: | ---: |
| Tool calls | −63% | −50% | −69% | −63% | fewer in every repetition |
| Input tokens (uncached) | −1% | −1% | −1% | −1% | fewer in every repetition |
| Output tokens | −27% | −5% | −36% | −27% | fewer in every repetition |
| Cache-read tokens | +72% | +81% | +65% | +23% | more in every repetition |
| Cache-write tokens | −38% | −22% | −38% | −58% | fewer in every repetition |
| Total tokens (derived) | +17% | +38% | +8% | −8% | mixed |
| Cost | −27% | −7% | −32% | −39% | fewer in every repetition |
| Wall time | −19% | +4% | −27% | −15% | mixed |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | R3 | R4 | verdict |
| --- | ---: | ---: | ---: | ---: | ---: |
| Tool calls | −62% [−76%, −34%] | −50% [−67%, −24%] | −62% [−78%, −34%] | −62% [−77%, −44%] | fewer in every repetition, outside the noise |
| Input tokens (uncached) | −1% [−2%, 0%] | −1% [−1%, 0%] † | −1% [−2%, 0%] | −1% [−2%, −1%] | fewer in every repetition, within the noise |
| Output tokens | −26% [−38%, −11%] | −5% [−26%, +21%] † | −35% [−48%, −15%] | −24% [−37%, −5%] | fewer in every repetition, within the noise |
| Cache-read tokens | +75% [+24%, +136%] | +141% [+27%, +377%] | +90% [+17%, +204%] | +42% [+4%, +88%] | more in every repetition, outside the noise |
| Cache-write tokens | −41% [−51%, −28%] | −23% [−39%, −2%] | −32% [−56%, +23%] † | −53% [−61%, −47%] n=4 | fewer in every repetition, within the noise |
| Total tokens (derived) | +17% [−4%, +42%] † | +50% [+11%, +107%] | +16% [−15%, +59%] † | −1% [−20%, +17%] † | mixed |
| Cost | −28% [−36%, −22%] | −9% [−15%, −1%] | −30% [−44%, −3%] | −40% [−49%, −30%] | fewer in every repetition, outside the noise |
| Wall time | −18% [−34%, −1%] | +2% [−19%, +25%] † | −26% [−37%, −11%] | −16% [−26%, −6%] | mixed |

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
| gin | 4 | 1 | −2 | 4 / 1 / 0 |
| all | 4 | 1 | −2 | 4 / 1 / 0 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 200 | 198 | −2 | 4 / 0 / 1 |
| all | 200 | 198 | −2 | 4 / 0 / 1 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 843 | 574 | −160 | 4 / 0 / 1 |
| all | 843 | 574 | −160 | 4 / 0 / 1 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 4,045 | 7,008 | +2,964 | 1 / 0 / 4 |
| all | 4,045 | 7,008 | +2,964 | 1 / 0 / 4 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 3,845 | 2,017 | −1,963 | 5 / 0 / 0 |
| all | 3,845 | 2,017 | −1,963 | 5 / 0 / 0 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 8,243 | 9,744 | +1,924 | 1 / 0 / 4 |
| all | 8,243 | 9,744 | +1,924 | 1 / 0 / 4 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd), or computed from the API's usage and a price table when the run went through the Messages API directly. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | $0.0008 | $0.0006 | −$0.0003 | 5 / 0 / 0 |
| all | $0.0008 | $0.0006 | −$0.0003 | 5 / 0 / 0 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 4.8 s | 3.8 s | −406 ms | 4 / 0 / 1 |
| all | 4.8 s | 3.8 s | −406 ms | 4 / 0 / 1 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| gin | $0.0198 (20 runs) | $0.0142 (20 runs) | none | none |
| all | $0.0198 (20 runs) | $0.0142 (20 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| gin/x001 | without | 4/4 | 4 [2–4] | 198 [198–200] | 843 [696–1,113] | 4,404 [2,926–7,070] | 2,551 [1,587–4,186] | $0.0008 [$0.0006–$0.0011] | 5.0 s [4.2 s–7.2 s] |
| gin/x001 | with | 4/4 | 1 [1–1] | 196 [196–196] | 574 [496–651] | 7,008 [7,008–7,008] | 1,560 [1,518–3,431] | $0.0006 [$0.0006–$0.0008] | 3.8 s [3.2 s–4.1 s] |
| gin/x002 | without | 4/4 | 2 [1–3] | 211 [210–214] | 774 [752–811] | 3,249 [1,628–9,030] | 4,492 [3,507–5,602] | $0.0010 [$0.0009–$0.0011] | 4.5 s [4.1 s–5.1 s] |
| gin/x002 | with | 4/4 | 2 [1–2] | 212 [210–212] | 614 [491–698] | 12,655 [7,008–12,668] | 2,438 [2,147–2,490] | $0.0008 [$0.0006–$0.0008] | 4.1 s [3.0 s–4.2 s] |
| gin/x003 | without | 4/4 | 2 [2–3] | 203 [203–203] | 537 [459–565] | 3,198 [3,067–3,310] | 3,845 [3,714–3,957] | $0.0008 [$0.0008–$0.0008] | 3.6 s [3.4 s–3.8 s] |
| gin/x003 | with | 4/4 | 1 [1–1] | 201 [201–201] | 563 [525–754] | 7,008 [7,008–7,008] | 1,883 [1,873–1,897] | $0.0006 [$0.0006–$0.0007] | 3.5 s [3.3 s–4.5 s] |
| gin/x004 | without | 4/4 | 4 [3–4] | 200 [199–201] | 877 [768–1,257] | 11,534 [5,332–18,092] | 7,118 [3,614–9,358] | $0.0014 [$0.0011–$0.0020] | 4.8 s [4.6 s–7.0 s] |
| gin/x004 | with | 4/4 | 2 [1–2] | 198 [197–199] | 740 [481–905] | 9,652 [7,008–14,524] | 4,403 [4,057–4,489] | $0.0010 [$0.0009–$0.0012] | 5.7 s [3.5 s–6.8 s] |
| gin/x005 | without | 4/4 | 6 [2–7] | 181 [180–182] | 915 [614–1,044] | 4,045 [2,946–4,842] | 2,650 [2,536–2,799] | $0.0008 [$0.0007–$0.0009] | 4.8 s [3.9 s–5.5 s] |
| gin/x005 | with | 4/4 | 1 [1–1] | 178 [178–178] | 537 [477–587] | 7,008 [7,008–9,028] | 2,017 [0–2,021] | $0.0006 [$0.0004–$0.0006] | 3.3 s [3.1 s–3.9 s] |

