# Agent-level A/B — measured tool calls, tokens and cost

**claude-code 2.1.322 (Claude Code) · claude-haiku-5-5 · 2026-11-10 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap as one skill (sigmap-locate) whose description tells the agent to call it first on every where-is-it question, + the sigmap CLI: no MCP server, no always-on section.
- Both arms: the same prompt, model, tool allowlist (Read, Grep, Glob, Bash), per-run budget cap $0.5 and timeout 420 s; run in a clean copy of the commit pinned in `benchmarks/xrepo-repos.json`.
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
- Run on the logged-in session (--session-auth), not an API key and not under --bare: the agent carries a prompt prefix about 40k tokens larger in both arms (cached), the cost figures are real Anthropic prices with real caching, and the usage counts against that account's plan.
- Skill variant: both arms run with skills enabled (the Skill tool, and the agent's own bundled skills listed in the prompt, about 2k tokens), which the earlier no-skill runs did not have, so these figures are against this run's own baseline and not comparable cell by cell with the index, lean or current runs. The SigMap arm adds only its skill file(s) and the sigmap CLI: no MCP server and no appended section.

## Outcome

| repo | tasks | pass without | pass with | failed runs (without / with) |
| --- | ---: | ---: | ---: | ---: |
| gin | 5 | 10/10 | 10/10 | 0 / 0 |
| all | 5 | 10/10 | 10/10 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 5. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | +67% | +93% | more in every repetition |
| Input tokens (uncached) | +63% | +87% | more in every repetition |
| Output tokens | +21% | +23% | more in every repetition |
| Cache-read tokens | +68% | +99% | more in every repetition |
| Cache-write tokens | +22% | +12% | more in every repetition |
| Total tokens (derived) | +59% | +80% | more in every repetition |
| Cost | +28% | +26% | more in every repetition |
| Wall time | +29% | +36% | more in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | +84% [+6%, +221%] | +131% [+31%, +349%] | more in every repetition, outside the noise |
| Input tokens (uncached) | +73% [+21%, +148%] | +94% [+37%, +174%] | more in every repetition, outside the noise |
| Output tokens | +29% [−10%, +86%] † | +29% [−7%, +80%] † | more in every repetition, within the noise |
| Cache-read tokens | +91% [+17%, +212%] | +115% [+35%, +243%] | more in every repetition, outside the noise |
| Cache-write tokens | +24% [+6%, +44%] | +13% [−3%, +34%] † | more in every repetition, within the noise |
| Total tokens (derived) | +75% [+15%, +164%] | +91% [+28%, +183%] | more in every repetition, outside the noise |
| Cost | +32% [+8%, +62%] | +28% [+4%, +58%] | more in every repetition, outside the noise |
| Wall time | +34% [+5%, +74%] | +39% [+12%, +76%] | more in every repetition, outside the noise |

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
| gin | 3 | 5 | +2 | 0 / 0 / 5 |
| all | 3 | 5 | +2 | 0 / 0 / 5 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 5 | 10 | +5 | 0 / 0 / 5 |
| all | 5 | 10 | +5 | 0 / 0 / 5 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 1,110 | 1,441 | +298 | 1 / 0 / 4 |
| all | 1,110 | 1,441 | +298 | 1 / 0 / 4 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 28,236 | 66,050 | +38,000 | 0 / 0 / 5 |
| all | 28,236 | 66,050 | +38,000 | 0 / 0 / 5 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 8,559 | 10,900 | +633 | 1 / 0 / 4 |
| all | 8,559 | 10,900 | +633 | 1 / 0 / 4 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 37,661 | 79,722 | +41,776 | 1 / 0 / 4 |
| all | 37,661 | 79,722 | +41,776 | 1 / 0 / 4 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | $0.0025 | $0.0035 | +$0.0009 | 1 / 0 / 4 |
| all | $0.0025 | $0.0035 | +$0.0009 | 1 / 0 / 4 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 11.8 s | 15.6 s | +3.7 s | 1 / 0 / 4 |
| all | 11.8 s | 15.6 s | +3.7 s | 1 / 0 / 4 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| gin | $0.0285 (10 runs) | $0.0362 (10 runs) | none | none |
| all | $0.0285 (10 runs) | $0.0362 (10 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| gin/x001 | without | 2/2 | 3 [1–4] | 5 [4–6] | 1,232 [756–1,707] | 27,485 [20,705–34,264] | 7,262 [7,026–7,497] | $0.0023 [$0.0020–$0.0027] | 11.9 s [8.7 s–15.0 s] |
| gin/x001 | with | 2/2 | 4 [4–4] | 10 [10–10] | 1,364 [1,286–1,441] | 65,485 [64,950–66,019] | 10,900 [10,549–11,251] | $0.0035 [$0.0034–$0.0036] | 15.6 s [13.6 s–17.5 s] |
| gin/x002 | without | 2/2 | 1 [1–1] | 4 [4–4] | 818 [776–860] | 20,741 [20,739–20,743] | 8,559 [8,174–8,943] | $0.0023 [$0.0022–$0.0024] | 8.7 s [8.5 s–9.0 s] |
| gin/x002 | with | 2/2 | 6 [4–7] | 12 [10–14] | 1,696 [1,532–1,859] | 81,240 [66,926–95,553] | 11,808 [11,520–12,096] | $0.0040 [$0.0039–$0.0042] | 16.7 s [15.4 s–18.0 s] |
| gin/x003 | without | 2/2 | 3 [3–3] | 8 [8–8] | 978 [953–1,003] | 51,710 [51,670–51,750] | 9,792 [9,751–9,832] | $0.0030 [$0.0030–$0.0030] | 11.8 s [11.8 s–11.8 s] |
| gin/x003 | with | 2/2 | 4 [4–4] | 10 [10–10] | 1,276 [1,235–1,316] | 63,415 [63,091–63,739] | 10,288 [10,029–10,547] | $0.0033 [$0.0033–$0.0034] | 14.6 s [14.3 s–14.8 s] |
| gin/x004 | without | 2/2 | 5 [4–5] | 9 [8–10] | 1,937 [1,909–1,964] | 66,013 [56,294–75,732] | 12,496 [12,170–12,821] | $0.0041 [$0.0040–$0.0043] | 16.9 s [15.9 s–17.9 s] |
| gin/x004 | with | 2/2 | 5 [5–5] | 10 [10–10] | 1,441 [1,363–1,518] | 66,050 [65,989–66,110] | 12,222 [11,952–12,492] | $0.0038 [$0.0037–$0.0039] | 15.5 s [15.4 s–15.5 s] |
| gin/x005 | without | 2/2 | 4 [2–5] | 5 [4–6] | 1,110 [853–1,366] | 28,236 [20,671–35,800] | 8,311 [7,495–9,126] | $0.0025 [$0.0021–$0.0029] | 10.5 s [8.8 s–12.2 s] |
| gin/x005 | with | 2/2 | 8 [7–8] | 12 [12–12] | 1,627 [1,508–1,746] | 79,195 [78,694–79,695] | 8,943 [8,570–9,316] | $0.0034 [$0.0033–$0.0035] | 16.8 s [16.0 s–17.7 s] |

