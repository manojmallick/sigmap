# Agent-level A/B — measured tool calls, tokens and cost

**anthropic-messages-api direct Messages API · claude-haiku-5-5 · 2026-11-11 · 4 runs per arm · publishable**

- Arms: **without** = no SigMap; **with** = SigMap ranked the question BEFORE the first turn (what a prompt hook would inject): the five likeliest files with their signatures and line anchors after the question in the user turn, + the sigmap CLI; no MCP server, no standing section, no extra tool call.
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
| Tool calls | −58% | −70% | −60% | −65% | fewer in every repetition |
| Input tokens (uncached) | +889% | +886% | +889% | +893% | more in every repetition |
| Output tokens | −11% | −18% | −9% | −13% | fewer in every repetition |
| Cache-read tokens | −57% | −91% | −41% | −48% | fewer in every repetition |
| Cache-write tokens | −24% | −32% | −28% | −40% | fewer in every repetition |
| Total tokens (derived) | −36% | −66% | −27% | −33% | fewer in every repetition |
| Cost | −9% | −21% | −11% | −18% | fewer in every repetition |
| Wall time | −5% | −29% | −22% | −20% | fewer in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | R3 | R4 | verdict |
| --- | ---: | ---: | ---: | ---: | ---: |
| Tool calls | −54% [−71%, −27%] n=4 | −56% [−73%, −24%] n=4 | −46% [−68%, −16%] n=4 | −55% [−71%, −24%] n=4 | fewer in every repetition, outside the noise |
| Input tokens (uncached) | +860% [+671%, +1052%] | +858% [+668%, +1040%] | +860% [+668%, +1055%] | +864% [+673%, +1054%] | more in every repetition, outside the noise |
| Output tokens | −13% [−23%, −1%] | −15% [−36%, +19%] † | −9% [−42%, +41%] † | −13% [−31%, 0%] † | fewer in every repetition, within the noise |
| Cache-read tokens | −70% [−90%, −39%] | −82% [−94%, −45%] | −70% [−92%, +1%] † | −67% [−88%, −22%] | fewer in every repetition, within the noise |
| Cache-write tokens | +18% [−8%, +44%] † n=4 | +23% [−37%, +172%] † n=4 | +21% [−60%, +232%] † n=4 | −34% [−61%, +7%] † n=4 | mixed |
| Total tokens (derived) | −39% [−77%, +12%] † | −48% [−77%, +29%] † | −38% [−80%, +80%] † | −46% [−75%, 0%] | fewer in every repetition, within the noise |
| Cost | −12% [−53%, +31%] † | −12% [−51%, +72%] † | −12% [−62%, +97%] † | −26% [−55%, +10%] † | fewer in every repetition, within the noise |
| Wall time | −6% [−24%, +7%] † | −27% [−40%, −4%] | −25% [−48%, +8%] † | −21% [−37%, −7%] | fewer in every repetition, within the noise |

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
| django | 4 | 1 | −3 | 4 / 1 / 0 |
| all | 4 | 1 | −3 | 4 / 1 / 0 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | 199 | 1,931 | +1,731 | 0 / 0 / 5 |
| all | 199 | 1,931 | +1,731 | 0 / 0 / 5 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | 751 | 681 | −23 | 3 / 0 / 2 |
| all | 751 | 681 | −23 | 3 / 0 / 2 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | 10,695 | 1,628 | −4,864 | 4 / 1 / 0 |
| all | 10,695 | 1,628 | −4,864 | 4 / 1 / 0 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | 6,152 | 3,009 | +327 | 2 / 0 / 3 |
| all | 6,152 | 3,009 | +327 | 2 / 0 / 3 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | 17,751 | 6,960 | −653 | 3 / 0 / 2 |
| all | 17,751 | 6,960 | −653 | 3 / 0 / 2 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd), or computed from the API's usage and a price table when the run went through the Messages API directly. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | $0.0012 | $0.0009 | +$0.0001 | 2 / 0 / 3 |
| all | $0.0012 | $0.0009 | +$0.0001 | 2 / 0 / 3 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | 4.7 s | 3.6 s | −879 ms | 3 / 0 / 2 |
| all | 4.7 s | 3.6 s | −879 ms | 3 / 0 / 2 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| django | $0.0260 (20 runs) | $0.0222 (20 runs) | none | none |
| all | $0.0260 (20 runs) | $0.0222 (20 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| django/x027 | without | 4/4 | 1 [1–4] | 196 [196–198] | 562 [387–759] | 1,628 [1,628–3,310] | 1,540 [759–4,333] | $0.0005 [$0.0003–$0.0010] | 3.8 s [2.9 s–4.4 s] |
| django/x027 | with | 4/4 | 1 [1–1] | 2,310 [2,310–2,310] | 681 [567–769] | 1,628 [1,628–1,628] | 3,009 [2,881–3,685] | $0.0010 [$0.0009–$0.0011] | 4.0 s [3.6 s–4.2 s] |
| django/x028 | without | 4/4 | 4 [3–4] | 196 [195–197] | 708 [701–785] | 10,695 [4,513–18,500] | 6,152 [3,867–12,463] | $0.0012 [$0.0009–$0.0022] | 4.5 s [4.2 s–4.9 s] |
| django/x028 | with | 4/4 | 2 [1–2] | 1,223 [1,223–1,223] | 686 [651–730] | 1,628 [1,628–1,628] | 3,165 [1,734–3,493] | $0.0009 [$0.0007–$0.0009] | 3.6 s [3.3 s–4.0 s] |
| django/x029 | without | 4/4 | 4 [3–4] | 199 [199–199] | 751 [692–869] | 3,235 [3,205–4,100] | 2,573 [2,043–3,595] | $0.0008 [$0.0007–$0.0009] | 4.7 s [4.4 s–5.5 s] |
| django/x029 | with | 4/4 | 1 [1–1] | 1,885 [1,885–1,885] | 577 [514–731] | 1,628 [1,628–1,628] | 2,899 [2,460–3,183] | $0.0009 [$0.0008–$0.0009] | 3.6 s [3.0 s–4.4 s] |
| django/x030 | without | 4/4 | 4 [3–5] | 200 [197–201] | 967 [767–1,103] | 19,052 [7,942–25,401] | 8,295 [7,922–9,327] | $0.0017 [$0.0016–$0.0019] | 5.6 s [5.5 s–6.9 s] |
| django/x030 | with | 4/4 | 0 [0–0] | 1,931 [1,931–1,931] | 533 [436–604] | 814 [814–814] | 0 [0–0] | $0.0005 [$0.0004–$0.0005] | 3.1 s [2.6 s–3.5 s] |
| django/x031 | without | 4/4 | 6 [5–9] | 209 [209–215] | 932 [865–1,240] | 27,079 [25,821–56,176] | 9,415 [8,674–9,894] | $0.0019 [$0.0018–$0.0024] | 5.8 s [5.4 s–8.0 s] |
| django/x031 | with | 4/4 | 4 [2–4] | 2,559 [2,555–2,561] | 1,038 [815–1,095] | 22,215 [1,628–37,247] | 11,305 [9,725–14,020] | $0.0024 [$0.0020–$0.0029] | 6.0 s [5.1 s–6.9 s] |

