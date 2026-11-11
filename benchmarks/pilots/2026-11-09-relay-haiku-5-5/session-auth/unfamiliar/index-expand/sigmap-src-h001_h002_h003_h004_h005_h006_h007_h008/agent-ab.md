# Agent-level A/B — measured tool calls, tokens and cost

**claude-code 2.1.322 (Claude Code) · claude-haiku-5-5 · 2026-11-11 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap index strategy + 7-tool core MCP profile (the docs' setup for an agent that calls the tools).
- Both arms: the same prompt, model, tool allowlist (Read, Grep, Glob, Bash), per-run budget cap $0.6 and timeout 420 s; run in a clean copy of the commit pinned in `benchmarks/xrepo-repos.json`.
- Questions: the task id(s) h001, h002, h003, h004, h005, h006, h007, h008 of `benchmarks/tasks/retrieval-xrepo.jsonl`. Pass = hit@5 on the repository-relative paths the answer names.
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
- Run on the logged-in session (--session-auth), not an API key and not under --bare: the agent carries a prompt prefix about 40k tokens larger in both arms (cached), the cost figures are real Anthropic prices with real caching, and the usage counts against that account's plan.

## Outcome

| repo | tasks | pass without | pass with | failed runs (without / with) |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 8 | 11/16 | 12/16 | 0 / 0 |
| all | 8 | 11/16 | 12/16 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 8. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −53% | −57% | fewer in every repetition |
| Input tokens (uncached) | −40% | −53% | fewer in every repetition |
| Output tokens | −49% | −56% | fewer in every repetition |
| Cache-read tokens | −46% | −55% | fewer in every repetition |
| Cache-write tokens | −36% | −44% | fewer in every repetition |
| Total tokens (derived) | −44% | −54% | fewer in every repetition |
| Cost | −41% | −49% | fewer in every repetition |
| Wall time | −29% | −40% | fewer in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −52% [−59%, −44%] | −64% [−75%, −48%] | fewer in every repetition, outside the noise |
| Input tokens (uncached) | −38% [−50%, −24%] | −52% [−64%, −35%] | fewer in every repetition, outside the noise |
| Output tokens | −37% [−56%, −19%] | −51% [−61%, −41%] | fewer in every repetition, outside the noise |
| Cache-read tokens | −39% [−61%, −13%] | −52% [−67%, −28%] | fewer in every repetition, outside the noise |
| Cache-write tokens | −31% [−54%, −2%] | −43% [−54%, −27%] | fewer in every repetition, outside the noise |
| Total tokens (derived) | −36% [−54%, −16%] | −50% [−65%, −29%] | fewer in every repetition, outside the noise |
| Cost | −33% [−53%, −10%] | −47% [−57%, −33%] | fewer in every repetition, outside the noise |
| Wall time | −23% [−41%, −8%] | −36% [−49%, −23%] | fewer in every repetition, outside the noise |

### Outcome (hit@5), by repetition

Per paired task: **better** = the SigMap arm named the file and the other did not; **worse** = the reverse; **tie** = both found it or both missed. Localisation only.

| repetition | paired tasks | better | worse | tie |
| --- | ---: | ---: | ---: | ---: |
| R1 | 8 | 1 | 0 | 7 |
| R2 | 8 | 0 | 0 | 8 |
| all | 16 | 1 | 0 | 15 |

## Tool calls

Provenance: agent-reported (main-thread tool_use blocks). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 6 | 2 | −3 | 8 / 0 / 0 |
| all | 6 | 2 | −3 | 8 / 0 / 0 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 10 | 5 | −4 | 8 / 0 / 0 |
| all | 10 | 5 | −4 | 8 / 0 / 0 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 1,478 | 852 | −602 | 8 / 0 / 0 |
| all | 1,478 | 852 | −602 | 8 / 0 / 0 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 50,117 | 24,697 | −18,487 | 8 / 0 / 0 |
| all | 50,117 | 24,697 | −18,487 | 8 / 0 / 0 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 9,535 | 6,461 | −3,702 | 7 / 0 / 1 |
| all | 9,535 | 6,461 | −3,702 | 7 / 0 / 1 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 61,854 | 31,847 | −24,421 | 8 / 0 / 0 |
| all | 61,854 | 31,847 | −24,421 | 8 / 0 / 0 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | $0.0032 | $0.0020 | −$0.0011 | 8 / 0 / 0 |
| all | $0.0032 | $0.0020 | −$0.0011 | 8 / 0 / 0 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 14.0 s | 10.3 s | −3.2 s | 8 / 0 / 0 |
| all | 14.0 s | 10.3 s | −3.2 s | 8 / 0 / 0 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | $0.0620 (16 runs) | $0.0342 (16 runs) | none | none |
| all | $0.0620 (16 runs) | $0.0342 (16 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| sigmap-src/h001 | without | 2/2 | 6 [5–6] | 10 [10–10] | 1,312 [1,269–1,355] | 52,993 [52,354–53,631] | 9,235 [8,949–9,521] | $0.0030 [$0.0030–$0.0031] | 13.9 s [13.7 s–14.0 s] |
| sigmap-src/h001 | with | 2/2 | 2 [1–2] | 4 [4–4] | 717 [574–860] | 16,834 [12,206–21,462] | 10,456 [4,460–16,452] | $0.0026 [$0.0014–$0.0038] | 8.7 s [7.7 s–9.6 s] |
| sigmap-src/h002 | without | 0/2 | 13 [11–14] | 18 [16–20] | 5,668 [5,643–5,693] | 144,734 [141,006–148,462] | 25,516 [17,001–34,031] | $0.0094 [$0.0077–$0.0111] | 35.4 s [35.0 s–35.8 s] |
| sigmap-src/h002 | with | 0/2 | 7 [6–7] | 6 [6–6] | 1,361 [1,168–1,554] | 35,661 [35,149–36,173] | 8,712 [7,790–9,633] | $0.0028 [$0.0025–$0.0031] | 12.5 s [11.7 s–13.4 s] |
| sigmap-src/h003 | without | 1/2 | 4 [2–6] | 9 [6–12] | 1,433 [718–2,148] | 47,241 [26,425–68,057] | 9,834 [5,945–13,723] | $0.0032 [$0.0018–$0.0045] | 14.7 s [10.2 s–19.1 s] |
| sigmap-src/h003 | with | 2/2 | 1 [1–1] | 4 [4–4] | 869 [755–982] | 21,150 [20,832–21,468] | 5,241 [4,865–5,616] | $0.0017 [$0.0017–$0.0017] | 10.7 s [9.9 s–11.6 s] |
| sigmap-src/h004 | without | 2/2 | 6 [5–6] | 8 [8–8] | 1,628 [1,574–1,681] | 45,146 [44,844–45,447] | 13,378 [13,167–13,589] | $0.0039 [$0.0039–$0.0040] | 13.2 s [12.4 s–14.1 s] |
| sigmap-src/h004 | with | 2/2 | 2 [2–2] | 6 [6–6] | 1,020 [966–1,073] | 35,110 [34,768–35,452] | 6,436 [5,804–7,068] | $0.0021 [$0.0021–$0.0022] | 10.9 s [10.1 s–11.7 s] |
| sigmap-src/h005 | without | 2/2 | 3 [2–3] | 6 [6–6] | 1,136 [1,019–1,253] | 27,903 [27,483–28,323] | 9,113 [8,734–9,492] | $0.0027 [$0.0025–$0.0028] | 10.7 s [10.4 s–11.1 s] |
| sigmap-src/h005 | with | 2/2 | 2 [1–2] | 4 [4–4] | 835 [773–896] | 21,141 [20,818–21,464] | 6,302 [5,502–7,102] | $0.0019 [$0.0017–$0.0021] | 8.8 s [8.7 s–8.9 s] |
| sigmap-src/h006 | without | 2/2 | 6 [4–7] | 10 [6–14] | 1,523 [1,162–1,883] | 63,552 [27,219–99,885] | 11,290 [9,297–13,283] | $0.0037 [$0.0027–$0.0046] | 14.1 s [11.1 s–17.2 s] |
| sigmap-src/h006 | with | 2/2 | 3 [2–3] | 5 [4–6] | 677 [646–708] | 28,244 [21,460–35,027] | 6,486 [6,035–6,937] | $0.0019 [$0.0018–$0.0021] | 9.9 s [7.9 s–11.9 s] |
| sigmap-src/h007 | without | 0/2 | 3 [2–3] | 7 [6–8] | 777 [676–877] | 32,024 [26,453–37,595] | 5,777 [5,546–6,008] | $0.0019 [$0.0018–$0.0019] | 9.2 s [8.8 s–9.5 s] |
| sigmap-src/h007 | with | 0/2 | 1 [1–1] | 4 [4–4] | 554 [519–588] | 21,141 [20,824–21,458] | 3,679 [3,337–4,020] | $0.0012 [$0.0011–$0.0013] | 7.8 s [7.6 s–8.1 s] |
| sigmap-src/h008 | without | 2/2 | 7 [6–8] | 10 [8–12] | 1,853 [1,661–2,045] | 57,102 [41,704–72,499] | 8,960 [6,778–11,141] | $0.0033 [$0.0026–$0.0040] | 14.1 s [12.4 s–15.8 s] |
| sigmap-src/h008 | with | 2/2 | 4 [4–4] | 8 [8–8] | 1,240 [993–1,487] | 52,175 [52,071–52,279] | 8,520 [7,976–9,063] | $0.0028 [$0.0026–$0.0031] | 12.1 s [10.4 s–13.8 s] |

