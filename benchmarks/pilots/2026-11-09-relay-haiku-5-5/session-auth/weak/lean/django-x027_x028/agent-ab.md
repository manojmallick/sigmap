# Agent-level A/B — measured tool calls, tokens and cost

**claude-code 2.1.321 (Claude Code) · claude-haiku-4-5 · 2026-11-10 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap lean: 7-tool core MCP profile + a three-line section.
- Both arms: the same prompt, model, tool allowlist (Read, Grep, Glob, Bash), per-run budget cap $1 and timeout 420 s; run in a clean copy of the commit pinned in `benchmarks/xrepo-repos.json`.
- Questions: the task id(s) x027, x028 of `benchmarks/tasks/retrieval-xrepo.jsonl`. Pass = hit@5 on the repository-relative paths the answer names.
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
| django | 2 | 4/4 | 4/4 | 0 / 0 |
| all | 2 | 4/4 | 4/4 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 2. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −42% | −38% | fewer in every repetition |
| Input tokens (uncached) | −39% | −39% | fewer in every repetition |
| Output tokens | −29% | −33% | fewer in every repetition |
| Cache-read tokens | −49% | −62% | fewer in every repetition |
| Cache-write tokens | +13% | −63% | mixed |
| Total tokens (derived) | −46% | −61% | fewer in every repetition |
| Cost | −22% | −58% | fewer in every repetition |
| Wall time | −19% | −29% | fewer in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −35% [−52%, −13%] | −41% [−50%, −31%] | fewer in every repetition, outside the noise |
| Input tokens (uncached) | −33% [−50%, −11%] | −42% [−53%, −29%] | fewer in every repetition, outside the noise |
| Output tokens | −24% [−39%, −4%] | −33% [−37%, −30%] | fewer in every repetition, outside the noise |
| Cache-read tokens | −35% [−59%, +4%] † | −60% [−63%, −57%] | fewer in every repetition, within the noise |
| Cache-write tokens | +14% [+11%, +16%] | −61% [−71%, −46%] | mixed |
| Total tokens (derived) | −32% [−56%, +5%] † | −60% [−63%, −56%] | fewer in every repetition, within the noise |
| Cost | −14% [−31%, +7%] † | −56% [−63%, −47%] | fewer in every repetition, within the noise |
| Wall time | −14% [−36%, +15%] † | −29% [−35%, −23%] | fewer in every repetition, within the noise |

### Outcome (hit@5), by repetition

Per paired task: **better** = the SigMap arm named the file and the other did not; **worse** = the reverse; **tie** = both found it or both missed. Localisation only.

| repetition | paired tasks | better | worse | tie |
| --- | ---: | ---: | ---: | ---: |
| R1 | 2 | 0 | 0 | 2 |
| R2 | 2 | 0 | 0 | 2 |
| all | 4 | 0 | 0 | 4 |

## Tool calls

Provenance: agent-reported (main-thread tool_use blocks). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | 15 | 9 | −6 | 2 / 0 / 0 |
| all | 15 | 9 | −6 | 2 / 0 / 0 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | 128 | 78 | −50 | 2 / 0 / 0 |
| all | 128 | 78 | −50 | 2 / 0 / 0 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | 3,104 | 2,149 | −955 | 2 / 0 / 0 |
| all | 3,104 | 2,149 | −955 | 2 / 0 / 0 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | 358,735 | 162,125 | −196,610 | 2 / 0 / 0 |
| all | 358,735 | 162,125 | −196,610 | 2 / 0 / 0 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | 19,775 | 13,177 | −6,598 | 2 / 0 / 0 |
| all | 19,775 | 13,177 | −6,598 | 2 / 0 / 0 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | 381,742 | 177,529 | −204,213 | 2 / 0 / 0 |
| all | 381,742 | 177,529 | −204,213 | 2 / 0 / 0 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | $0.0911 | $0.0534 | −$0.0377 | 2 / 0 / 0 |
| all | $0.0911 | $0.0534 | −$0.0377 | 2 / 0 / 0 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | 35.6 s | 27.1 s | −8.5 s | 2 / 0 / 0 |
| all | 35.6 s | 27.1 s | −8.5 s | 2 / 0 / 0 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| django | $0.3643 (4 runs) | $0.2136 (4 runs) | none | none |
| all | $0.3643 (4 runs) | $0.2136 (4 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| django/x027 | without | 2/2 | 21 [16–25] | 174 [138–210] | 3,816 [3,062–4,569] | 572,347 [513,286–631,408] | 27,599 [22,481–32,717] | $0.1317 [$0.1312–$0.1322] | 43.1 s [36.8 s–49.4 s] |
| django/x027 | with | 2/2 | 12 [11–12] | 102 [98–106] | 2,459 [2,149–2,769] | 224,988 [190,328–259,647] | 17,226 [9,395–25,056] | $0.0693 [$0.0487–$0.0900] | 30.0 s [28.2 s–31.8 s] |
| django/x028 | without | 2/2 | 9 [8–10] | 82 [74–90] | 2,393 [1,968–2,817] | 145,124 [122,199–168,048] | 11,950 [8,731–15,169] | $0.0505 [$0.0396–$0.0613] | 28.1 s [23.3 s–32.8 s] |
| django/x028 | with | 2/2 | 6 [5–7] | 54 [42–66] | 1,839 [1,785–1,893] | 99,263 [71,461–127,064] | 9,129 [8,148–10,109] | $0.0374 [$0.0324–$0.0425] | 24.2 s [21.4 s–26.9 s] |

