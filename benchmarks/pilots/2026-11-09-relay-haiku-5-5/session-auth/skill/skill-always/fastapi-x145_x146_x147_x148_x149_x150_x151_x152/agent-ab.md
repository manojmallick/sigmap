# Agent-level A/B — measured tool calls, tokens and cost

**claude-code 2.1.322 (Claude Code) · claude-haiku-5-5 · 2026-11-10 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap as one skill (sigmap-locate) whose description tells the agent to call it first on every where-is-it question, + the sigmap CLI: no MCP server, no always-on section.
- Both arms: the same prompt, model, tool allowlist (Read, Grep, Glob, Bash), per-run budget cap $0.5 and timeout 420 s; run in a clean copy of the commit pinned in `benchmarks/xrepo-repos.json`.
- Questions: the task id(s) x145, x146, x147, x148, x149, x150, x151, x152 of `benchmarks/tasks/retrieval-xrepo.jsonl`. Pass = hit@5 on the repository-relative paths the answer names.
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
| fastapi | 8 | 16/16 | 16/16 | 0 / 0 |
| all | 8 | 16/16 | 16/16 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 8. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | +68% | +50% | more in every repetition |
| Input tokens (uncached) | +59% | +54% | more in every repetition |
| Output tokens | +31% | +11% | more in every repetition |
| Cache-read tokens | +79% | +69% | more in every repetition |
| Cache-write tokens | +28% | +24% | more in every repetition |
| Total tokens (derived) | +70% | +60% | more in every repetition |
| Cost | +36% | +28% | more in every repetition |
| Wall time | +34% | +24% | more in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | +78% [+47%, +119%] | +58% [+21%, +113%] | more in every repetition, outside the noise |
| Input tokens (uncached) | +62% [+45%, +80%] | +58% [+34%, +95%] | more in every repetition, outside the noise |
| Output tokens | +37% [+16%, +61%] | +15% [−7%, +46%] † | more in every repetition, within the noise |
| Cache-read tokens | +83% [+59%, +112%] | +77% [+39%, +141%] | more in every repetition, outside the noise |
| Cache-write tokens | +27% [+12%, +47%] | +24% [+4%, +50%] | more in every repetition, outside the noise |
| Total tokens (derived) | +72% [+53%, +96%] | +64% [+33%, +110%] | more in every repetition, outside the noise |
| Cost | +37% [+25%, +53%] | +28% [+8%, +52%] | more in every repetition, outside the noise |
| Wall time | +36% [+21%, +53%] | +26% [+10%, +48%] | more in every repetition, outside the noise |

### Outcome (hit@5), by repetition

Per paired task: **better** = the SigMap arm named the file and the other did not; **worse** = the reverse; **tie** = both found it or both missed. Localisation only.

| repetition | paired tasks | better | worse | tie |
| --- | ---: | ---: | ---: | ---: |
| R1 | 8 | 0 | 0 | 8 |
| R2 | 8 | 0 | 0 | 8 |
| all | 16 | 0 | 0 | 16 |

## Tool calls

Provenance: agent-reported (main-thread tool_use blocks). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | 3 | 5 | +3 | 0 / 1 / 7 |
| all | 3 | 5 | +3 | 0 / 1 / 7 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | 7 | 11 | +4 | 0 / 0 / 8 |
| all | 7 | 11 | +4 | 0 / 0 / 8 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | 1,164 | 1,582 | +351 | 1 / 0 / 7 |
| all | 1,164 | 1,582 | +351 | 1 / 0 / 7 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | 39,008 | 69,395 | +31,887 | 0 / 0 / 8 |
| all | 39,008 | 69,395 | +31,887 | 0 / 0 / 8 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | 9,018 | 10,882 | +1,878 | 1 / 0 / 7 |
| all | 9,018 | 10,882 | +1,878 | 1 / 0 / 7 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | 48,694 | 81,753 | +34,147 | 0 / 0 / 8 |
| all | 48,694 | 81,753 | +34,147 | 0 / 0 / 8 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | $0.0027 | $0.0036 | +$0.0008 | 1 / 0 / 7 |
| all | $0.0027 | $0.0036 | +$0.0008 | 1 / 0 / 7 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastapi | 12.3 s | 17.0 s | +3.7 s | 1 / 0 / 7 |
| all | 12.3 s | 17.0 s | +3.7 s | 1 / 0 / 7 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| fastapi | $0.0472 (16 runs) | $0.0623 (16 runs) | none | none |
| all | $0.0472 (16 runs) | $0.0623 (16 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| fastapi/x145 | without | 2/2 | 4 [3–4] | 7 [6–8] | 1,168 [1,041–1,295] | 42,906 [34,930–50,881] | 8,690 [7,717–9,662] | $0.0028 [$0.0024–$0.0031] | 12.2 s [11.9 s–12.5 s] |
| fastapi/x145 | with | 2/2 | 5 [5–5] | 10 [10–10] | 1,210 [1,191–1,228] | 63,410 [63,327–63,493] | 10,340 [9,378–11,301] | $0.0033 [$0.0031–$0.0035] | 15.0 s [14.9 s–15.1 s] |
| fastapi/x146 | without | 2/2 | 5 [4–6] | 11 [10–12] | 1,809 [1,616–2,001] | 77,486 [65,780–89,192] | 11,897 [9,848–13,946] | $0.0041 [$0.0034–$0.0047] | 17.0 s [16.0 s–18.0 s] |
| fastapi/x146 | with | 2/2 | 7 [5–8] | 14 [12–16] | 1,875 [1,645–2,105] | 111,560 [83,453–139,667] | 14,105 [11,086–17,124] | $0.0049 [$0.0039–$0.0059] | 19.8 s [17.3 s–22.2 s] |
| fastapi/x147 | without | 2/2 | 3 [2–3] | 6 [6–6] | 1,072 [761–1,382] | 34,758 [34,642–34,873] | 7,604 [7,071–8,137] | $0.0024 [$0.0021–$0.0027] | 12.3 s [11.2 s–13.5 s] |
| fastapi/x147 | with | 2/2 | 5 [5–5] | 10 [10–10] | 1,416 [1,197–1,634] | 64,454 [63,800–65,107] | 9,503 [8,778–10,227] | $0.0033 [$0.0030–$0.0035] | 15.0 s [13.7 s–16.2 s] |
| fastapi/x148 | without | 2/2 | 3 [2–4] | 6 [4–8] | 875 [866–883] | 35,123 [20,735–49,511] | 8,858 [7,469–10,247] | $0.0026 [$0.0024–$0.0027] | 10.5 s [9.2 s–11.7 s] |
| fastapi/x148 | with | 2/2 | 7 [6–7] | 12 [12–12] | 1,724 [1,543–1,905] | 85,764 [80,984–90,543] | 12,046 [9,717–14,374] | $0.0041 [$0.0035–$0.0047] | 17.1 s [16.1 s–18.1 s] |
| fastapi/x149 | without | 2/2 | 3 [2–3] | 6 [6–6] | 1,160 [893–1,426] | 34,647 [34,556–34,737] | 9,436 [7,799–11,072] | $0.0028 [$0.0026–$0.0030] | 11.8 s [11.1 s–12.6 s] |
| fastapi/x149 | with | 2/2 | 5 [4–6] | 11 [10–12] | 1,518 [1,376–1,659] | 73,628 [66,494–80,762] | 11,294 [10,339–12,248] | $0.0038 [$0.0037–$0.0038] | 17.1 s [14.9 s–19.4 s] |
| fastapi/x150 | without | 2/2 | 4 [3–4] | 6 [6–6] | 994 [816–1,172] | 35,462 [35,322–35,602] | 9,178 [8,284–10,072] | $0.0027 [$0.0024–$0.0030] | 10.1 s [9.9 s–10.4 s] |
| fastapi/x150 | with | 2/2 | 6 [6–6] | 10 [10–10] | 1,413 [1,374–1,452] | 65,163 [64,260–66,065] | 10,470 [9,719–11,220] | $0.0035 [$0.0033–$0.0036] | 16.4 s [16.0 s–16.8 s] |
| fastapi/x151 | without | 2/2 | 3 [2–3] | 7 [6–8] | 1,242 [1,131–1,352] | 42,554 [35,342–49,766] | 7,946 [7,578–8,314] | $0.0026 [$0.0026–$0.0027] | 12.7 s [12.2 s–13.3 s] |
| fastapi/x151 | with | 2/2 | 5 [5–5] | 12 [12–12] | 1,646 [1,585–1,707] | 91,986 [91,906–92,065] | 15,626 [15,543–15,709] | $0.0049 [$0.0048–$0.0049] | 17.3 s [16.5 s–18.1 s] |
| fastapi/x152 | without | 2/2 | 6 [5–6] | 8 [8–8] | 2,095 [2,054–2,135] | 53,163 [49,443–56,883] | 10,436 [8,795–12,076] | $0.0037 [$0.0033–$0.0041] | 17.3 s [16.9 s–17.7 s] |
| fastapi/x152 | with | 2/2 | 6 [5–6] | 10 [10–10] | 1,755 [1,521–1,989] | 64,686 [64,499–64,872] | 9,907 [9,787–10,027] | $0.0035 [$0.0034–$0.0036] | 16.9 s [16.3 s–17.4 s] |

