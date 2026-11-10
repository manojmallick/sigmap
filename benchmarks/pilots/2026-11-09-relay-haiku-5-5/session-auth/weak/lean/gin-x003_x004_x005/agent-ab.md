# Agent-level A/B — measured tool calls, tokens and cost

**claude-code 2.1.322 (Claude Code) · claude-haiku-4-5 · 2026-11-10 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap lean: 7-tool core MCP profile + a three-line section.
- Both arms: the same prompt, model, tool allowlist (Read, Grep, Glob, Bash), per-run budget cap $1 and timeout 420 s; run in a clean copy of the commit pinned in `benchmarks/xrepo-repos.json`.
- Questions: the task id(s) x003, x004, x005 of `benchmarks/tasks/retrieval-xrepo.jsonl`. Pass = hit@5 on the repository-relative paths the answer names.
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
| gin | 3 | 6/6 | 6/6 | 0 / 0 |
| all | 3 | 6/6 | 6/6 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 3. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −24% | −21% | fewer in every repetition |
| Input tokens (uncached) | −36% | −16% | fewer in every repetition |
| Output tokens | −30% | −20% | fewer in every repetition |
| Cache-read tokens | −52% | −32% | fewer in every repetition |
| Cache-write tokens | −65% | −47% | fewer in every repetition |
| Total tokens (derived) | −53% | −32% | fewer in every repetition |
| Cost | −58% | −37% | fewer in every repetition |
| Wall time | −29% | −18% | fewer in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −42% [−82%, +27%] † | −20% [−53%, +78%] † | fewer in every repetition, within the noise |
| Input tokens (uncached) | −41% [−73%, −8%] | −16% [−44%, +68%] † | fewer in every repetition, within the noise |
| Output tokens | −38% [−72%, +13%] † | −19% [−44%, +25%] † | fewer in every repetition, within the noise |
| Cache-read tokens | −58% [−85%, −26%] | −32% [−58%, +44%] † | fewer in every repetition, within the noise |
| Cache-write tokens | −66% [−70%, −62%] | −46% [−56%, −38%] | fewer in every repetition, outside the noise |
| Total tokens (derived) | −59% [−84%, −34%] | −33% [−57%, +36%] † | fewer in every repetition, within the noise |
| Cost | −61% [−75%, −45%] | −36% [−51%, −8%] | fewer in every repetition, outside the noise |
| Wall time | −33% [−62%, −7%] | −17% [−40%, +24%] † | fewer in every repetition, within the noise |

### Outcome (hit@5), by repetition

Per paired task: **better** = the SigMap arm named the file and the other did not; **worse** = the reverse; **tie** = both found it or both missed. Localisation only.

| repetition | paired tasks | better | worse | tie |
| --- | ---: | ---: | ---: | ---: |
| R1 | 3 | 0 | 0 | 3 |
| R2 | 3 | 0 | 0 | 3 |
| all | 6 | 0 | 0 | 6 |

## Tool calls

Provenance: agent-reported (main-thread tool_use blocks). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 11 | 8 | −4 | 2 / 0 / 1 |
| all | 11 | 8 | −4 | 2 / 0 / 1 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 90 | 62 | −28 | 2 / 0 / 1 |
| all | 90 | 62 | −28 | 2 / 0 / 1 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 2,897 | 1,829 | −1,068 | 2 / 0 / 1 |
| all | 2,897 | 1,829 | −1,068 | 2 / 0 / 1 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 246,707 | 116,022 | −84,483 | 3 / 0 / 0 |
| all | 246,707 | 116,022 | −84,483 | 3 / 0 / 0 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 25,929 | 11,283 | −14,646 | 3 / 0 / 0 |
| all | 25,929 | 11,283 | −14,646 | 3 / 0 / 0 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 275,186 | 129,196 | −100,224 | 3 / 0 / 0 |
| all | 275,186 | 129,196 | −100,224 | 3 / 0 / 0 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | $0.0884 | $0.0434 | −$0.0431 | 3 / 0 / 0 |
| all | $0.0884 | $0.0434 | −$0.0431 | 3 / 0 / 0 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| gin | 33.4 s | 23.1 s | −10.5 s | 2 / 0 / 1 |
| all | 33.4 s | 23.1 s | −10.5 s | 2 / 0 / 1 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| gin | $0.5409 (6 runs) | $0.2838 (6 runs) | none | none |
| all | $0.5409 (6 runs) | $0.2838 (6 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| gin/x003 | without | 2/2 | 15 [11–19] | 122 [98–146] | 3,049 [2,462–3,635] | 326,400 [252,874–399,925] | 23,777 [23,617–23,937] | $0.0956 [$0.0849–$0.1062] | 37.8 s [31.4 s–44.3 s] |
| gin/x003 | with | 2/2 | 6 [2–9] | 54 [26–82] | 1,712 [691–2,733] | 103,700 [37,904–169,495] | 8,891 [7,170–10,612] | $0.0368 [$0.0216–$0.0519] | 23.1 s [12.0 s–34.2 s] |
| gin/x004 | without | 2/2 | 11 [7–15] | 90 [50–130] | 2,897 [1,934–3,860] | 200,505 [101,871–299,138] | 25,929 [17,375–34,482] | $0.0865 [$0.0841–$0.0889] | 33.4 s [22.6 s–44.1 s] |
| gin/x004 | with | 2/2 | 8 [6–9] | 62 [42–82] | 1,829 [1,480–2,178] | 116,022 [75,616–156,428] | 11,283 [10,788–11,778] | $0.0434 [$0.0386–$0.0482] | 22.9 s [19.2 s–26.6 s] |
| gin/x005 | without | 2/2 | 10 [9–11] | 90 [82–98] | 2,290 [2,172–2,407] | 246,707 [201,186–292,227] | 26,100 [20,163–32,037] | $0.0884 [$0.0726–$0.1043] | 29.2 s [27.8 s–30.6 s] |
| gin/x005 | with | 2/2 | 15 [14–16] | 114 [90–138] | 2,732 [2,459–3,004] | 244,353 [199,110–289,596] | 11,786 [11,289–12,283] | $0.0618 [$0.0569–$0.0667] | 31.4 s [28.4 s–34.4 s] |

