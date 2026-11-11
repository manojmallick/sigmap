# Agent-level A/B — measured tool calls, tokens and cost

**anthropic-messages-api direct Messages API · claude-haiku-4-5 · 2026-11-11 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap ranked the question BEFORE the first turn (what a prompt hook would inject): the five likeliest files with their signatures and line anchors after the question in the user turn, + the sigmap CLI; no MCP server, no standing section, no extra tool call.
- Both arms: the same prompt, model, tool allowlist (Read, Grep, Glob, Bash), per-run budget cap $0.25 and timeout 420 s; run in a clean copy of the commit pinned in `benchmarks/xrepo-repos.json`.
- Questions: the task id(s) x084, x085, x086, x087, x088 of `benchmarks/tasks/retrieval-xrepo.jsonl`. Pass = hit@5 on the repository-relative paths the answer names.
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
| rails | 5 | 10/10 | 10/10 | 0 / 0 |
| all | 5 | 10/10 | 10/10 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 5. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −42% | −53% | fewer in every repetition |
| Input tokens (uncached) | −62% | −37% | fewer in every repetition |
| Output tokens | −21% | −33% | fewer in every repetition |
| Cache-read tokens | −25% | −53% | fewer in every repetition |
| Cache-write tokens | −32% | −32% | fewer in every repetition |
| Total tokens (derived) | −28% | −51% | fewer in every repetition |
| Cost | −34% | −40% | fewer in every repetition |
| Wall time | −19% | −33% | fewer in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −50% [−71%, −13%] | −65% [−83%, −38%] | fewer in every repetition, outside the noise |
| Input tokens (uncached) | −64% [−75%, −46%] | −31% [−65%, +37%] † | fewer in every repetition, within the noise |
| Output tokens | −28% [−53%, +11%] † | −39% [−56%, −16%] | fewer in every repetition, within the noise |
| Cache-read tokens | −65% [−89%, +15%] † | −58% [−84%, −8%] n=4 | fewer in every repetition, within the noise |
| Cache-write tokens | −42% [−63%, −7%] | −37% [−64%, +7%] † | fewer in every repetition, within the noise |
| Total tokens (derived) | −56% [−82%, +18%] † | −68% [−90%, −15%] | fewer in every repetition, within the noise |
| Cost | −44% [−66%, −7%] | −45% [−68%, −8%] | fewer in every repetition, outside the noise |
| Wall time | −25% [−50%, +13%] † | −38% [−57%, −12%] | fewer in every repetition, within the noise |

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
| rails | 13 | 7 | −9 | 5 / 0 / 0 |
| all | 13 | 7 | −9 | 5 / 0 / 0 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | 7,365 | 2,494 | −4,642 | 5 / 0 / 0 |
| all | 7,365 | 2,494 | −4,642 | 5 / 0 / 0 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | 1,571 | 1,082 | −606 | 3 / 0 / 2 |
| all | 1,571 | 1,082 | −606 | 3 / 0 / 2 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | 104,911 | 22,392 | −26,419 | 3 / 0 / 2 |
| all | 104,911 | 22,392 | −26,419 | 3 / 0 / 2 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | 16,500 | 6,329 | −2,451 | 4 / 0 / 1 |
| all | 16,500 | 6,329 | −2,451 | 4 / 0 / 1 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | 125,262 | 32,526 | −29,934 | 3 / 0 / 2 |
| all | 125,262 | 32,526 | −29,934 | 3 / 0 / 2 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd), or computed from the API's usage and a price table when the run went through the Messages API directly. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | $0.0403 | $0.0186 | −$0.0092 | 4 / 0 / 1 |
| all | $0.0403 | $0.0186 | −$0.0092 | 4 / 0 / 1 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| rails | 18.4 s | 11.9 s | −5.7 s | 3 / 0 / 2 |
| all | 18.4 s | 11.9 s | −5.7 s | 3 / 0 / 2 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| rails | $0.5118 (10 runs) | $0.3232 (10 runs) | none | none |
| all | $0.5118 (10 runs) | $0.3232 (10 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| rails/x084 | without | 2/2 | 13 [10–15] | 7,113 [4,176–10,050] | 1,415 [1,169–1,661] | 34,261 [26,347–42,174] | 8,149 [6,029–10,268] | $0.0278 [$0.0202–$0.0354] | 15.8 s [13.0 s–18.6 s] |
| rails/x084 | with | 2/2 | 4 [4–4] | 6,655 [6,641–6,668] | 809 [763–855] | 7,842 [4,404–11,279] | 5,698 [5,203–6,193] | $0.0186 [$0.0179–$0.0193] | 10.1 s [9.4 s–10.9 s] |
| rails/x085 | without | 2/2 | 11 [10–12] | 8,668 [8,649–8,686] | 1,571 [1,294–1,847] | 68,398 [50,628–86,168] | 13,371 [12,748–13,994] | $0.0401 [$0.0362–$0.0440] | 18.4 s [15.9 s–21.0 s] |
| rails/x085 | with | 2/2 | 10 [9–10] | 2,494 [2,491–2,497] | 1,576 [1,508–1,643] | 77,058 [69,263–84,852] | 15,481 [14,490–16,471] | $0.0374 [$0.0351–$0.0398] | 18.8 s [17.7 s–19.8 s] |
| rails/x086 | without | 2/2 | 11 [10–12] | 2,523 [1,120–3,926] | 1,329 [1,300–1,357] | 104,911 [79,052–130,769] | 16,500 [14,392–18,608] | $0.0403 [$0.0363–$0.0442] | 16.0 s [15.4 s–16.6 s] |
| rails/x086 | with | 2/2 | 3 [1–4] | 2,177 [2,168–2,186] | 628 [504–751] | 7,753 [0–15,506] | 5,519 [4,920–6,118] | $0.0130 [$0.0108–$0.0151] | 8.3 s [6.4 s–10.2 s] |
| rails/x087 | without | 2/2 | 23 [22–24] | 7,365 [5,370–9,359] | 2,639 [2,499–2,778] | 264,555 [240,183–288,926] | 21,565 [20,624–22,506] | $0.0740 [$0.0717–$0.0763] | 31.4 s [29.9 s–32.9 s] |
| rails/x087 | with | 2/2 | 7 [6–8] | 2,723 [2,719–2,727] | 1,082 [969–1,195] | 22,392 [18,902–25,882] | 6,329 [5,532–7,125] | $0.0183 [$0.0164–$0.0202] | 11.9 s [11.3 s–12.4 s] |
| rails/x088 | without | 2/2 | 23 [17–28] | 9,363 [6,992–11,734] | 2,463 [2,007–2,919] | 225,336 [126,608–324,064] | 23,642 [23,297–23,986] | $0.0738 [$0.0644–$0.0831] | 29.2 s [23.7 s–34.6 s] |
| rails/x088 | with | 2/2 | 19 [18–19] | 2,429 [2,428–2,430] | 2,730 [2,622–2,837] | 287,057 [277,600–296,513] | 23,594 [22,741–24,446] | $0.0743 [$0.0717–$0.0768] | 32.5 s [31.2 s–33.7 s] |

