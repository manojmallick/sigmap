# Agent-level A/B — measured tool calls, tokens and cost

**claude-code 2.1.321 (Claude Code) · claude-haiku-5-5 · 2026-11-09 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap lean: 7-tool core MCP profile + a three-line section.
- Both arms: the same prompt, model, tool allowlist (Read, Grep, Glob, Bash), per-run budget cap $0.5 and timeout 420 s; run in a clean copy of the commit pinned in `benchmarks/xrepo-repos.json`.
- Questions: the task id(s) x046, x047, x048, x049, x050 of `benchmarks/tasks/retrieval-xrepo.jsonl`. Pass = hit@5 on the repository-relative paths the answer names.
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
| laravel | 5 | 10/10 | 10/10 | 0 / 0 |
| all | 5 | 10/10 | 10/10 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 5. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | +35% | +14% | more in every repetition |
| Input tokens (uncached) | +27% | +31% | more in every repetition |
| Output tokens | +4% | +6% | more in every repetition |
| Cache-read tokens | +56% | +69% | more in every repetition |
| Cache-write tokens | +8% | +22% | more in every repetition |
| Total tokens (derived) | +44% | +59% | more in every repetition |
| Cost | +13% | +24% | more in every repetition |
| Wall time | +21% | +14% | more in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | +31% [+6%, +63%] | +11% [0%, +27%] † | more in every repetition, within the noise |
| Input tokens (uncached) | +24% [+6%, +46%] | +29% [+6%, +61%] | more in every repetition, outside the noise |
| Output tokens | +2% [−14%, +29%] † | +6% [−9%, +22%] † | more in every repetition, within the noise |
| Cache-read tokens | +52% [+21%, +92%] | +65% [+28%, +119%] | more in every repetition, outside the noise |
| Cache-write tokens | +12% [−7%, +33%] † | +24% [+11%, +35%] | more in every repetition, within the noise |
| Total tokens (derived) | +41% [+15%, +80%] | +56% [+24%, +102%] | more in every repetition, outside the noise |
| Cost | +13% [−5%, +40%] † | +25% [+12%, +39%] | more in every repetition, within the noise |
| Wall time | +20% [+6%, +39%] | +13% [+2%, +27%] | more in every repetition, outside the noise |

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
| laravel | 4 | 5 | +1 | 0 / 2 / 3 |
| all | 4 | 5 | +1 | 0 / 2 / 3 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | 6 | 8 | +2 | 0 / 2 / 3 |
| all | 6 | 8 | +2 | 0 / 2 / 3 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | 1,252 | 1,235 | +15 | 2 / 0 / 3 |
| all | 1,252 | 1,235 | +15 | 2 / 0 / 3 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | 28,016 | 47,978 | +18,712 | 0 / 0 / 5 |
| all | 28,016 | 47,978 | +18,712 | 0 / 0 / 5 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | 6,822 | 8,838 | +1,320 | 1 / 0 / 4 |
| all | 6,822 | 8,838 | +1,320 | 1 / 0 / 4 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | 36,036 | 58,560 | +19,171 | 0 / 0 / 5 |
| all | 36,036 | 58,560 | +19,171 | 0 / 0 / 5 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | $0.0022 | $0.0029 | +$0.0003 | 1 / 0 / 4 |
| all | $0.0022 | $0.0029 | +$0.0003 | 1 / 0 / 4 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| laravel | 12.0 s | 13.6 s | +1.9 s | 1 / 0 / 4 |
| all | 12.0 s | 13.6 s | +1.9 s | 1 / 0 / 4 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| laravel | $0.0238 (10 runs) | $0.0281 (10 runs) | none | none |
| all | $0.0238 (10 runs) | $0.0281 (10 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| laravel/x046 | without | 2/2 | 3 [3–3] | 6 [6–6] | 1,073 [912–1,233] | 27,108 [26,909–27,307] | 4,610 [4,094–5,126] | $0.0017 [$0.0015–$0.0019] | 11.8 s [11.3 s–12.2 s] |
| laravel/x046 | with | 2/2 | 3 [3–3] | 6 [6–6] | 1,087 [1,059–1,115] | 32,875 [32,361–33,389] | 5,930 [5,473–6,386] | $0.0021 [$0.0020–$0.0021] | 13.6 s [12.5 s–14.8 s] |
| laravel/x047 | without | 2/2 | 3 [3–3] | 6 [6–6] | 1,252 [1,146–1,358] | 29,266 [27,796–30,736] | 8,865 [6,971–10,759] | $0.0027 [$0.0024–$0.0030] | 12.0 s [11.7 s–12.4 s] |
| laravel/x047 | with | 2/2 | 4 [3–4] | 8 [8–8] | 1,079 [1,064–1,094] | 47,978 [47,625–48,330] | 9,496 [8,294–10,697] | $0.0029 [$0.0027–$0.0032] | 12.4 s [12.4 s–12.4 s] |
| laravel/x048 | without | 2/2 | 5 [4–6] | 7 [6–8] | 1,381 [1,351–1,410] | 36,887 [31,143–42,631] | 10,037 [8,540–11,533] | $0.0031 [$0.0028–$0.0033] | 12.7 s [12.2 s–13.3 s] |
| laravel/x048 | with | 2/2 | 5 [4–6] | 7 [6–8] | 1,235 [1,130–1,340] | 42,059 [34,009–50,109] | 8,861 [8,572–9,149] | $0.0028 [$0.0027–$0.0029] | 12.6 s [12.0 s–13.1 s] |
| laravel/x049 | without | 2/2 | 5 [4–5] | 6 [6–6] | 1,262 [1,219–1,304] | 27,271 [26,905–27,637] | 6,292 [6,045–6,539] | $0.0022 [$0.0021–$0.0022] | 12.2 s [12.1 s–12.2 s] |
| laravel/x049 | with | 2/2 | 7 [7–7] | 9 [8–10] | 1,798 [1,635–1,960] | 55,095 [46,957–63,232] | 8,838 [7,853–9,822] | $0.0032 [$0.0029–$0.0036] | 17.2 s [15.3 s–19.2 s] |
| laravel/x050 | without | 2/2 | 4 [3–5] | 6 [6–6] | 1,193 [1,191–1,194] | 28,016 [27,944–28,087] | 6,822 [6,669–6,975] | $0.0022 [$0.0022–$0.0023] | 11.4 s [11.4 s–11.4 s] |
| laravel/x050 | with | 2/2 | 6 [5–6] | 10 [8–12] | 1,276 [1,203–1,349] | 63,676 [46,152–81,200] | 8,731 [8,183–9,278] | $0.0030 [$0.0027–$0.0033] | 14.9 s [14.1 s–15.6 s] |

