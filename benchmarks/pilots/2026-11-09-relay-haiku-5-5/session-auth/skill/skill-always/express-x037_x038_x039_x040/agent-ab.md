# Agent-level A/B — measured tool calls, tokens and cost

**claude-code 2.1.322 (Claude Code) · claude-haiku-5-5 · 2026-11-10 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap as one skill (sigmap-locate) whose description tells the agent to call it first on every where-is-it question, + the sigmap CLI: no MCP server, no always-on section.
- Both arms: the same prompt, model, tool allowlist (Read, Grep, Glob, Bash), per-run budget cap $0.5 and timeout 420 s; run in a clean copy of the commit pinned in `benchmarks/xrepo-repos.json`.
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
- Run on the logged-in session (--session-auth), not an API key and not under --bare: the agent carries a prompt prefix about 40k tokens larger in both arms (cached), the cost figures are real Anthropic prices with real caching, and the usage counts against that account's plan.
- Skill variant: both arms run with skills enabled (the Skill tool, and the agent's own bundled skills listed in the prompt, about 2k tokens), which the earlier no-skill runs did not have, so these figures are against this run's own baseline and not comparable cell by cell with the index, lean or current runs. The SigMap arm adds only its skill file(s) and the sigmap CLI: no MCP server and no appended section.

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
| Tool calls | +150% | +54% | more in every repetition |
| Input tokens (uncached) | +82% | +54% | more in every repetition |
| Output tokens | +60% | +42% | more in every repetition |
| Cache-read tokens | +104% | +64% | more in every repetition |
| Cache-write tokens | +20% | +15% | more in every repetition |
| Total tokens (derived) | +87% | +56% | more in every repetition |
| Cost | +39% | +28% | more in every repetition |
| Wall time | +49% | +29% | more in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | +166% [+100%, +298%] | +67% [+12%, +150%] | more in every repetition, outside the noise |
| Input tokens (uncached) | +84% [+67%, +126%] | +55% [+34%, +67%] | more in every repetition, outside the noise |
| Output tokens | +61% [+48%, +77%] | +44% [+17%, +79%] | more in every repetition, outside the noise |
| Cache-read tokens | +109% [+84%, +169%] | +67% [+38%, +85%] | more in every repetition, outside the noise |
| Cache-write tokens | +20% [+15%, +26%] | +15% [+2%, +32%] | more in every repetition, outside the noise |
| Total tokens (derived) | +90% [+71%, +135%] | +58% [+34%, +75%] | more in every repetition, outside the noise |
| Cost | +39% [+32%, +50%] | +28% [+14%, +45%] | more in every repetition, outside the noise |
| Wall time | +50% [+18%, +89%] | +30% [+19%, +42%] | more in every repetition, outside the noise |

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
| express | 3 | 5 | +2 | 0 / 0 / 4 |
| all | 3 | 5 | +2 | 0 / 0 / 4 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | 6 | 10 | +4 | 0 / 0 / 4 |
| all | 6 | 10 | +4 | 0 / 0 / 4 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | 813 | 1,228 | +395 | 0 / 0 / 4 |
| all | 813 | 1,228 | +395 | 0 / 0 / 4 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | 34,547 | 63,818 | +29,271 | 0 / 0 / 4 |
| all | 34,547 | 63,818 | +29,271 | 0 / 0 / 4 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | 7,658 | 9,227 | +1,346 | 0 / 0 / 4 |
| all | 7,658 | 9,227 | +1,346 | 0 / 0 / 4 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | 42,925 | 74,282 | +31,358 | 0 / 0 / 4 |
| all | 42,925 | 74,282 | +31,358 | 0 / 0 / 4 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | $0.0022 | $0.0031 | +$0.0008 | 0 / 0 / 4 |
| all | $0.0022 | $0.0031 | +$0.0008 | 0 / 0 / 4 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | 9.8 s | 14.5 s | +4.1 s | 0 / 0 / 4 |
| all | 9.8 s | 14.5 s | +4.1 s | 0 / 0 / 4 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| express | $0.0184 (8 runs) | $0.0245 (8 runs) | none | none |
| all | $0.0184 (8 runs) | $0.0245 (8 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| express/x037 | without | 2/2 | 2 [2–2] | 6 [6–6] | 781 [780–782] | 34,575 [34,516–34,634] | 7,526 [6,930–8,122] | $0.0022 [$0.0021–$0.0024] | 10.2 s [10.1 s–10.2 s] |
| express/x037 | with | 2/2 | 5 [5–5] | 10 [10–10] | 1,207 [1,163–1,250] | 64,090 [63,651–64,528] | 9,453 [9,315–9,591] | $0.0031 [$0.0031–$0.0032] | 12.9 s [11.9 s–14.0 s] |
| express/x038 | without | 2/2 | 4 [3–4] | 7 [6–8] | 962 [953–970] | 43,521 [35,199–51,843] | 8,166 [7,608–8,724] | $0.0025 [$0.0024–$0.0027] | 12.1 s [11.8 s–12.4 s] |
| express/x038 | with | 2/2 | 6 [5–6] | 10 [10–10] | 1,326 [1,229–1,422] | 64,626 [64,517–64,734] | 9,648 [9,446–9,849] | $0.0032 [$0.0032–$0.0032] | 14.1 s [13.4 s–14.8 s] |
| express/x039 | without | 2/2 | 3 [1–5] | 5 [4–6] | 844 [625–1,063] | 27,796 [20,693–34,898] | 7,524 [6,446–8,601] | $0.0022 [$0.0018–$0.0026] | 9.3 s [8.0 s–10.7 s] |
| express/x039 | with | 2/2 | 5 [5–5] | 10 [10–10] | 1,078 [1,032–1,124] | 63,291 [63,192–63,390] | 8,296 [8,222–8,369] | $0.0028 [$0.0028–$0.0029] | 14.8 s [13.3 s–16.4 s] |
| express/x040 | without | 2/2 | 2 [2–2] | 6 [6–6] | 646 [633–659] | 34,519 [34,421–34,616] | 7,791 [7,708–7,873] | $0.0022 [$0.0022–$0.0023] | 9.4 s [8.9 s–10.0 s] |
| express/x040 | with | 2/2 | 5 [4–5] | 10 [10–10] | 1,249 [1,235–1,262] | 63,547 [63,412–63,681] | 9,001 [8,994–9,007] | $0.0031 [$0.0031–$0.0031] | 15.0 s [14.6 s–15.5 s] |

