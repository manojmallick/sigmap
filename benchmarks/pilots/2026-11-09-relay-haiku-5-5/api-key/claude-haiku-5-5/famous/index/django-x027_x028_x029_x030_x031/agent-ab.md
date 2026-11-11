# Agent-level A/B — measured tool calls, tokens and cost

**anthropic-messages-api direct Messages API · claude-haiku-5-5 · 2026-11-11 · 4 runs per arm · publishable**

- Arms: **without** = no SigMap; **with** = SigMap index strategy + 7-tool core MCP profile (the docs' setup for an agent that calls the tools).
- Both arms: the same prompt, model, tool allowlist (Read, Grep, Glob, Bash), per-run budget cap $0.25 and timeout 420 s; run in a clean copy of the commit pinned in `benchmarks/xrepo-repos.json`.
- Questions: the task id(s) x027, x028, x029, x030, x031 of `benchmarks/tasks/retrieval-xrepo.jsonl`. Pass = hit@5 on the repository-relative paths the answer names.
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
| django | 5 | 20/20 | 20/20 | 0 / 0 |
| all | 5 | 20/20 | 20/20 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2, R3, R4) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 5. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | R3 | R4 | verdict |
| --- | ---: | ---: | ---: | ---: | ---: |
| Tool calls | −58% | −28% | −62% | −39% | fewer in every repetition |
| Input tokens (uncached) | −1% | −1% | −1% | −1% | fewer in every repetition |
| Output tokens | −25% | −8% | −21% | −20% | fewer in every repetition |
| Cache-read tokens | −16% | +22% | −39% | +1% | mixed |
| Cache-write tokens | −55% | −45% | −67% | −52% | fewer in every repetition |
| Total tokens (derived) | −29% | +1% | −47% | −16% | mixed |
| Cost | −41% | −26% | −49% | −36% | fewer in every repetition |
| Wall time | −12% | −8% | −20% | −19% | fewer in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | R3 | R4 | verdict |
| --- | ---: | ---: | ---: | ---: | ---: |
| Tool calls | −56% [−71%, −34%] | −34% [−60%, −6%] | −63% [−70%, −54%] | −46% [−65%, −17%] | fewer in every repetition, outside the noise |
| Input tokens (uncached) | −1% [−2%, 0%] | −1% [−2%, 0%] † | −1% [−2%, −1%] | −1% [−2%, 0%] | fewer in every repetition, within the noise |
| Output tokens | −24% [−39%, −5%] | −8% [−30%, +20%] † | −23% [−36%, −3%] | −23% [−39%, −3%] | fewer in every repetition, within the noise |
| Cache-read tokens | +11% [−54%, +167%] † | +18% [−40%, +131%] † | −11% [−61%, +104%] † | +13% [−48%, +145%] † | mixed |
| Cache-write tokens | −63% [−82%, −23%] | −49% [−72%, −8%] | −69% [−79%, −54%] | −66% [−81%, −37%] | fewer in every repetition, outside the noise |
| Total tokens (derived) | −24% [−60%, +46%] † | −5% [−49%, +78%] † | −32% [−61%, +27%] † | −20% [−56%, +43%] † | fewer in every repetition, within the noise |
| Cost | −42% [−63%, −11%] | −29% [−55%, +13%] † | −48% [−59%, −38%] | −44% [−63%, −15%] | fewer in every repetition, within the noise |
| Wall time | −18% [−39%, +29%] † | −9% [−25%, +12%] † | −21% [−35%, −7%] | −22% [−38%, −2%] | fewer in every repetition, within the noise |

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
| django | 4 | 2 | −2 | 4 / 1 / 0 |
| all | 4 | 2 | −2 | 4 / 1 / 0 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | 199 | 196 | −2 | 3 / 2 / 0 |
| all | 199 | 196 | −2 | 3 / 2 / 0 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | 801 | 598 | −203 | 5 / 0 / 0 |
| all | 801 | 598 | −203 | 5 / 0 / 0 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | 14,453 | 8,080 | −506 | 3 / 0 / 2 |
| all | 14,453 | 8,080 | −506 | 3 / 0 / 2 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | 5,687 | 1,401 | −2,029 | 5 / 0 / 0 |
| all | 5,687 | 1,401 | −2,029 | 5 / 0 / 0 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | 23,776 | 10,165 | −2,656 | 3 / 0 / 2 |
| all | 23,776 | 10,165 | −2,656 | 3 / 0 / 2 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd), or computed from the API's usage and a price table when the run went through the Messages API directly. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | $0.0013 | $0.0006 | −$0.0003 | 5 / 0 / 0 |
| all | $0.0013 | $0.0006 | −$0.0003 | 5 / 0 / 0 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | 5.1 s | 3.9 s | −1.3 s | 5 / 0 / 0 |
| all | 5.1 s | 3.9 s | −1.3 s | 5 / 0 / 0 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| django | $0.0262 (20 runs) | $0.0162 (20 runs) | none | none |
| all | $0.0262 (20 runs) | $0.0162 (20 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| django/x027 | without | 4/4 | 1 [1–4] | 196 [196–198] | 665 [356–675] | 1,628 [1,628–3,156] | 2,063 [663–4,252] | $0.0006 [$0.0003–$0.0009] | 4.2 s [2.7 s–5.3 s] |
| django/x027 | with | 4/4 | 1 [1–1] | 196 [196–196] | 454 [413–674] | 6,298 [5,398–6,298] | 789 [786–1,816] | $0.0004 [$0.0004–$0.0006] | 2.9 s [2.7 s–3.9 s] |
| django/x028 | without | 4/4 | 4 [4–5] | 199 [199–199] | 801 [657–907] | 17,080 [16,982–18,779] | 5,687 [5,498–6,157] | $0.0013 [$0.0012–$0.0014] | 5.1 s [4.7 s–5.6 s] |
| django/x028 | with | 4/4 | 2 [1–3] | 194 [193–195] | 598 [440–906] | 8,080 [6,298–9,948] | 1,141 [702–2,345] | $0.0006 [$0.0004–$0.0008] | 3.8 s [2.7 s–5.0 s] |
| django/x029 | without | 4/4 | 4 [3–4] | 199 [199–201] | 706 [676–876] | 3,138 [3,052–8,459] | 2,854 [2,335–5,411] | $0.0008 [$0.0007–$0.0011] | 4.8 s [4.4 s–5.8 s] |
| django/x029 | with | 4/4 | 2 [1–2] | 199 [197–199] | 644 [522–728] | 10,568 [6,298–11,140] | 1,913 [1,351–2,466] | $0.0007 [$0.0006–$0.0008] | 4.5 s [3.4 s–8.7 s] |
| django/x030 | without | 4/4 | 4 [3–4] | 199 [197–199] | 881 [724–1,197] | 14,453 [7,770–16,244] | 8,742 [7,848–9,428] | $0.0017 [$0.0015–$0.0020] | 5.5 s [4.5 s–6.5 s] |
| django/x030 | with | 4/4 | 1 [1–1] | 195 [195–195] | 540 [508–687] | 6,298 [6,298–6,298] | 1,401 [1,096–1,472] | $0.0005 [$0.0005–$0.0006] | 3.9 s [3.7 s–4.7 s] |
| django/x031 | without | 4/4 | 6 [6–6] | 209 [207–209] | 953 [881–1,047] | 28,774 [16,866–31,329] | 10,577 [8,817–11,580] | $0.0021 [$0.0018–$0.0023] | 5.9 s [5.7 s–6.1 s] |
| django/x031 | with | 4/4 | 5 [2–6] | 207 [203–211] | 884 [642–1,267] | 28,268 [6,298–52,858] | 8,548 [5,428–10,122] | $0.0018 [$0.0012–$0.0024] | 5.4 s [3.8 s–7.7 s] |

