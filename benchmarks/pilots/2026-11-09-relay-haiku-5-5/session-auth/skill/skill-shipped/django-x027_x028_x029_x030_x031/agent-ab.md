# Agent-level A/B — measured tool calls, tokens and cost

**claude-code 2.1.322 (Claude Code) · claude-haiku-5-5 · 2026-11-10 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap as the three skills `sigmap skills install --client claude` writes + the sigmap CLI: no MCP server, no always-on section.
- Both arms: the same prompt, model, tool allowlist (Read, Grep, Glob, Bash), per-run budget cap $0.5 and timeout 420 s; run in a clean copy of the commit pinned in `benchmarks/xrepo-repos.json`.
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
- Run on the logged-in session (--session-auth), not an API key and not under --bare: the agent carries a prompt prefix about 40k tokens larger in both arms (cached), the cost figures are real Anthropic prices with real caching, and the usage counts against that account's plan.
- Skill variant: both arms run with skills enabled (the Skill tool, and the agent's own bundled skills listed in the prompt, about 2k tokens), which the earlier no-skill runs did not have, so these figures are against this run's own baseline and not comparable cell by cell with the index, lean or current runs. The SigMap arm adds only its skill file(s) and the sigmap CLI: no MCP server and no appended section.

## Outcome

| repo | tasks | pass without | pass with | failed runs (without / with) |
| --- | ---: | ---: | ---: | ---: |
| django | 5 | 10/10 | 10/10 | 0 / 0 |
| all | 5 | 10/10 | 10/10 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 5. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | +13% | −18% | mixed |
| Input tokens (uncached) | −12% | 0% | mixed |
| Output tokens | +21% | −9% | mixed |
| Cache-read tokens | 0% | +4% | more in every repetition |
| Cache-write tokens | +14% | +8% | more in every repetition |
| Total tokens (derived) | +3% | +5% | more in every repetition |
| Cost | +13% | +4% | more in every repetition |
| Wall time | +3% | −1% | mixed |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −3% [−46%, +53%] † | −23% [−55%, +32%] † | fewer in every repetition, within the noise |
| Input tokens (uncached) | −15% [−28%, 0%] † | −2% [−22%, +19%] † | fewer in every repetition, within the noise |
| Output tokens | +19% [0%, +32%] † | −10% [−31%, +17%] † | mixed |
| Cache-read tokens | −13% [−34%, +15%] † | −1% [−26%, +29%] † | fewer in every repetition, within the noise |
| Cache-write tokens | +4% [−21%, +45%] † | +5% [−7%, +17%] † | more in every repetition, within the noise |
| Total tokens (derived) | −9% [−31%, +18%] † | 0% [−22%, +23%] † | mixed |
| Cost | +4% [−18%, +34%] † | +1% [−13%, +14%] † | more in every repetition, within the noise |
| Wall time | +1% [−11%, +15%] † | −1% [−6%, +4%] † | mixed |

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
| django | 3 | 3 | 0 | 1 / 2 / 2 |
| all | 3 | 3 | 0 | 1 / 2 / 2 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | 6 | 6 | 0 | 2 / 2 / 1 |
| all | 6 | 6 | 0 | 2 / 2 / 1 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | 1,002 | 1,027 | +190 | 2 / 0 / 3 |
| all | 1,002 | 1,027 | +190 | 2 / 0 / 3 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | 35,424 | 35,637 | +354 | 2 / 0 / 3 |
| all | 35,424 | 35,637 | +354 | 2 / 0 / 3 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | 8,865 | 8,891 | −225 | 3 / 0 / 2 |
| all | 8,865 | 8,891 | −225 | 3 / 0 / 2 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | 45,120 | 45,455 | +1,134 | 2 / 0 / 3 |
| all | 45,120 | 45,455 | +1,134 | 2 / 0 / 3 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | $0.0026 | $0.0026 | +$0.0001 | 2 / 0 / 3 |
| all | $0.0026 | $0.0026 | +$0.0001 | 2 / 0 / 3 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | 11.4 s | 10.6 s | +273 ms | 2 / 0 / 3 |
| all | 11.4 s | 10.6 s | +273 ms | 2 / 0 / 3 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| django | $0.0300 (10 runs) | $0.0326 (10 runs) | none | none |
| all | $0.0300 (10 runs) | $0.0326 (10 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| django/x027 | without | 2/2 | 3 [3–3] | 6 [6–6] | 1,167 [1,092–1,242] | 35,424 [35,095–35,752] | 8,523 [8,201–8,845] | $0.0026 [$0.0026–$0.0027] | 11.4 s [10.7 s–12.1 s] |
| django/x027 | with | 2/2 | 1 [1–1] | 4 [4–4] | 853 [785–920] | 20,893 [20,885–20,901] | 6,981 [6,971–6,991] | $0.0020 [$0.0020–$0.0021] | 10.6 s [9.6 s–11.7 s] |
| django/x028 | without | 2/2 | 3 [2–4] | 6 [6–6] | 1,002 [850–1,153] | 35,283 [35,086–35,479] | 8,031 [8,009–8,053] | $0.0025 [$0.0024–$0.0025] | 10.2 s [9.6 s–10.8 s] |
| django/x028 | with | 2/2 | 3 [2–4] | 6 [6–6] | 922 [710–1,133] | 35,637 [35,567–35,706] | 8,891 [8,638–9,143] | $0.0026 [$0.0024–$0.0028] | 10.5 s [9.8 s–11.2 s] |
| django/x029 | without | 2/2 | 2 [2–2] | 6 [6–6] | 837 [794–879] | 34,832 [34,593–35,071] | 8,865 [7,715–10,014] | $0.0025 [$0.0023–$0.0027] | 11.1 s [10.6 s–11.7 s] |
| django/x029 | with | 2/2 | 3 [2–4] | 5 [4–6] | 1,027 [989–1,064] | 27,878 [20,889–34,867] | 8,197 [7,012–9,381] | $0.0024 [$0.0021–$0.0028] | 10.0 s [9.6 s–10.5 s] |
| django/x030 | without | 2/2 | 3 [2–3] | 6 [6–6] | 927 [865–989] | 36,426 [36,378–36,474] | 10,673 [10,394–10,951] | $0.0030 [$0.0029–$0.0030] | 11.4 s [10.3 s–12.5 s] |
| django/x030 | with | 2/2 | 3 [2–3] | 7 [6–8] | 1,141 [1,095–1,187] | 45,669 [36,372–54,966] | 10,448 [10,201–10,695] | $0.0031 [$0.0030–$0.0033] | 12.0 s [11.4 s–12.7 s] |
| django/x031 | without | 2/2 | 6 [5–7] | 9 [8–10] | 1,672 [1,416–1,928] | 69,455 [67,327–71,582] | 14,372 [11,493–17,251] | $0.0044 [$0.0040–$0.0048] | 14.4 s [12.1 s–16.7 s] |
| django/x031 | with | 2/2 | 7 [4–9] | 9 [8–10] | 2,005 [1,443–2,567] | 85,937 [71,259–100,615] | 21,283 [20,413–22,152] | $0.0061 [$0.0055–$0.0067] | 16.1 s [12.9 s–19.3 s] |

