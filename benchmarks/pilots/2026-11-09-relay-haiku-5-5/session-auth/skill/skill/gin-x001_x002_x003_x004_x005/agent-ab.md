# Agent-level A/B — measured tool calls, tokens and cost

**claude-code 2.1.322 (Claude Code) · claude-haiku-5-5 · 2026-11-10 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap as one on-demand skill (sigmap-locate) + the sigmap CLI: no MCP server, no always-on section.
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
| Tool calls | +24% | −7% | mixed |
| Input tokens (uncached) | +18% | −17% | mixed |
| Output tokens | +24% | −12% | mixed |
| Cache-read tokens | +20% | −21% | mixed |
| Cache-write tokens | −12% | −11% | fewer in every repetition |
| Total tokens (derived) | +14% | −19% | mixed |
| Cost | −2% | −13% | fewer in every repetition |
| Wall time | +20% | −8% | mixed |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | +24% [+3%, +58%] | −15% [−39%, +19%] † | mixed |
| Input tokens (uncached) | +14% [+5%, +25%] | −18% [−28%, −6%] | mixed |
| Output tokens | +26% [+14%, +39%] | −9% [−28%, +16%] † | mixed |
| Cache-read tokens | +15% [+2%, +29%] | −23% [−38%, −4%] | mixed |
| Cache-write tokens | −12% [−21%, −3%] | −9% [−24%, +6%] † | fewer in every repetition, within the noise |
| Total tokens (derived) | +10% [−1%, +23%] † | −19% [−31%, −5%] | mixed |
| Cost | −2% [−9%, +5%] † | −11% [−21%, −3%] | fewer in every repetition, within the noise |
| Wall time | +20% [+11%, +28%] | −7% [−17%, +4%] † | mixed |

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
| gin | 4 | 4 | 0 | 2 / 1 / 2 |
| all | 4 | 4 | 0 | 2 / 1 / 2 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 7 | 8 | 0 | 1 / 3 / 1 |
| all | 7 | 8 | 0 | 1 / 3 / 1 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 1,133 | 1,247 | −30 | 3 / 0 / 2 |
| all | 1,133 | 1,247 | −30 | 3 / 0 / 2 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 43,283 | 51,296 | +911 | 2 / 0 / 3 |
| all | 43,283 | 51,296 | +911 | 2 / 0 / 3 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 9,642 | 9,076 | −682 | 3 / 0 / 2 |
| all | 9,642 | 9,076 | −682 | 3 / 0 / 2 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 55,152 | 61,757 | −2,485 | 3 / 0 / 2 |
| all | 55,152 | 61,757 | −2,485 | 3 / 0 / 2 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | $0.0032 | $0.0031 | −$0.0001 | 3 / 0 / 2 |
| all | $0.0032 | $0.0031 | −$0.0001 | 3 / 0 / 2 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 11.7 s | 12.3 s | +214 ms | 1 / 0 / 4 |
| all | 11.7 s | 12.3 s | +214 ms | 1 / 0 / 4 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| gin | $0.0327 (10 runs) | $0.0304 (10 runs) | none | none |
| all | $0.0327 (10 runs) | $0.0304 (10 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| gin/x001 | without | 2/2 | 3 [2–3] | 7 [6–8] | 866 [776–955] | 41,917 [35,856–47,977] | 12,363 [11,457–13,269] | $0.0033 [$0.0030–$0.0036] | 10.1 s [9.3 s–11.0 s] |
| gin/x001 | with | 2/2 | 4 [4–4] | 7 [6–8] | 1,247 [1,152–1,342] | 42,828 [34,437–51,218] | 8,586 [8,205–8,966] | $0.0028 [$0.0026–$0.0030] | 12.3 s [12.0 s–12.6 s] |
| gin/x002 | without | 2/2 | 2 [1–2] | 5 [4–6] | 844 [820–867] | 28,756 [20,723–36,789] | 8,827 [8,794–8,860] | $0.0025 [$0.0024–$0.0026] | 9.1 s [8.8 s–9.4 s] |
| gin/x002 | with | 2/2 | 1 [1–1] | 4 [4–4] | 996 [881–1,110] | 20,824 [20,823–20,825] | 9,076 [8,890–9,261] | $0.0025 [$0.0025–$0.0025] | 9.8 s [8.6 s–10.9 s] |
| gin/x003 | without | 2/2 | 4 [3–4] | 8 [8–8] | 1,133 [1,063–1,203] | 50,706 [50,200–51,212] | 9,642 [8,538–10,746] | $0.0030 [$0.0027–$0.0033] | 11.7 s [11.0 s–12.3 s] |
| gin/x003 | with | 2/2 | 3 [2–4] | 8 [6–10] | 1,103 [896–1,310] | 52,510 [34,857–70,162] | 10,087 [9,406–10,767] | $0.0031 [$0.0027–$0.0035] | 11.6 s [10.5 s–12.7 s] |
| gin/x004 | without | 2/2 | 4 [4–4] | 8 [8–8] | 1,639 [1,428–1,849] | 57,721 [57,196–58,246] | 14,894 [14,756–15,031] | $0.0044 [$0.0043–$0.0044] | 13.9 s [12.7 s–15.1 s] |
| gin/x004 | with | 2/2 | 4 [3–5] | 8 [6–10] | 1,493 [1,135–1,851] | 53,046 [36,919–69,173] | 12,201 [11,567–12,834] | $0.0037 [$0.0033–$0.0042] | 14.2 s [12.0 s–16.3 s] |
| gin/x005 | without | 2/2 | 5 [3–6] | 7 [6–8] | 1,636 [1,496–1,776] | 43,283 [34,498–52,068] | 9,562 [8,303–10,820] | $0.0032 [$0.0029–$0.0034] | 12.6 s [11.5 s–13.6 s] |
| gin/x005 | with | 2/2 | 6 [4–7] | 8 [6–10] | 1,574 [1,481–1,666] | 51,296 [35,440–67,152] | 8,880 [8,447–9,312] | $0.0031 [$0.0028–$0.0034] | 12.6 s [11.5 s–13.7 s] |

