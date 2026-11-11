# Agent-level A/B — measured tool calls, tokens and cost

**claude-code 2.1.322 (Claude Code) · claude-haiku-5-5 · 2026-11-11 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap index strategy + 7-tool core MCP profile (the docs' setup for an agent that calls the tools).
- Both arms: the same prompt, model, tool allowlist (Read, Grep, Glob, Bash), per-run budget cap $0.5 and timeout 420 s; run in a clean copy of the commit pinned in `benchmarks/xrepo-repos.json`.
- Questions: the task id(s) h009, h010, h011, h012, h013, h014, h015 of `benchmarks/tasks/retrieval-xrepo.jsonl`. Pass = hit@5 on the repository-relative paths the answer names.
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
| sigmap-src | 7 | 14/14 | 14/14 | 0 / 0 |
| all | 7 | 14/14 | 14/14 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 7. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −44% | −58% | fewer in every repetition |
| Input tokens (uncached) | −21% | −33% | fewer in every repetition |
| Output tokens | −34% | −46% | fewer in every repetition |
| Cache-read tokens | −13% | −29% | fewer in every repetition |
| Cache-write tokens | −17% | −42% | fewer in every repetition |
| Total tokens (derived) | −14% | −32% | fewer in every repetition |
| Cost | −20% | −41% | fewer in every repetition |
| Wall time | −12% | −22% | fewer in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −43% [−62%, −10%] | −60% [−79%, −31%] | fewer in every repetition, outside the noise |
| Input tokens (uncached) | −18% [−36%, +4%] † | −34% [−54%, −3%] | fewer in every repetition, within the noise |
| Output tokens | −33% [−55%, −2%] | −44% [−58%, −25%] | fewer in every repetition, outside the noise |
| Cache-read tokens | −9% [−35%, +24%] † | −29% [−56%, +13%] † | fewer in every repetition, within the noise |
| Cache-write tokens | −16% [−36%, +15%] † | −40% [−55%, −24%] | fewer in every repetition, within the noise |
| Total tokens (derived) | −11% [−35%, +21%] † | −32% [−56%, +3%] † | fewer in every repetition, within the noise |
| Cost | −19% [−40%, +12%] † | −40% [−55%, −23%] | fewer in every repetition, within the noise |
| Wall time | −10% [−24%, +5%] † | −20% [−33%, −2%] | fewer in every repetition, within the noise |

### Outcome (hit@5), by repetition

Per paired task: **better** = the SigMap arm named the file and the other did not; **worse** = the reverse; **tie** = both found it or both missed. Localisation only.

| repetition | paired tasks | better | worse | tie |
| --- | ---: | ---: | ---: | ---: |
| R1 | 7 | 0 | 0 | 7 |
| R2 | 7 | 0 | 0 | 7 |
| all | 14 | 0 | 0 | 14 |

## Tool calls

Provenance: agent-reported (main-thread tool_use blocks). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 5 | 3 | −3 | 5 / 2 / 0 |
| all | 5 | 3 | −3 | 5 / 2 / 0 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 8 | 6 | −2 | 5 / 1 / 1 |
| all | 8 | 6 | −2 | 5 / 1 / 1 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 1,314 | 714 | −635 | 5 / 0 / 2 |
| all | 1,314 | 714 | −635 | 5 / 0 / 2 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 43,436 | 34,822 | −8,657 | 4 / 0 / 3 |
| all | 43,436 | 34,822 | −8,657 | 4 / 0 / 3 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 8,304 | 6,266 | −2,494 | 6 / 0 / 1 |
| all | 8,304 | 6,266 | −2,494 | 6 / 0 / 1 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 52,841 | 40,786 | −11,922 | 4 / 0 / 3 |
| all | 52,841 | 40,786 | −11,922 | 4 / 0 / 3 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | $0.0028 | $0.0019 | −$0.0010 | 5 / 0 / 2 |
| all | $0.0028 | $0.0019 | −$0.0010 | 5 / 0 / 2 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 11.9 s | 9.7 s | −2.2 s | 5 / 0 / 2 |
| all | 11.9 s | 9.7 s | −2.2 s | 5 / 0 / 2 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | $0.0430 (14 runs) | $0.0296 (14 runs) | none | none |
| all | $0.0430 (14 runs) | $0.0296 (14 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| sigmap-src/h009 | without | 2/2 | 6 [6–6] | 12 [10–14] | 1,739 [1,672–1,806] | 69,052 [54,994–83,110] | 7,874 [7,229–8,519] | $0.0031 [$0.0028–$0.0034] | 15.2 s [13.7 s–16.7 s] |
| sigmap-src/h009 | with | 2/2 | 3 [2–3] | 6 [6–6] | 693 [560–825] | 34,822 [34,271–35,373] | 5,265 [5,157–5,373] | $0.0017 [$0.0017–$0.0018] | 9.7 s [9.2 s–10.3 s] |
| sigmap-src/h010 | without | 2/2 | 5 [4–6] | 8 [8–8] | 1,314 [1,072–1,555] | 46,257 [44,609–47,905] | 12,115 [11,931–12,298] | $0.0035 [$0.0034–$0.0037] | 11.0 s [10.3 s–11.6 s] |
| sigmap-src/h010 | with | 2/2 | 2 [1–2] | 5 [4–6] | 679 [608–749] | 27,933 [21,340–34,526] | 5,534 [4,685–6,383] | $0.0017 [$0.0015–$0.0020] | 9.1 s [8.2 s–10.0 s] |
| sigmap-src/h011 | without | 2/2 | 4 [4–4] | 7 [6–8] | 1,483 [1,407–1,559] | 36,835 [28,661–45,009] | 8,304 [6,696–9,911] | $0.0028 [$0.0023–$0.0032] | 11.9 s [10.7 s–13.0 s] |
| sigmap-src/h011 | with | 2/2 | 2 [1–2] | 5 [4–6] | 714 [636–791] | 28,178 [21,336–35,020] | 5,810 [5,129–6,491] | $0.0018 [$0.0016–$0.0020] | 9.2 s [8.6 s–9.8 s] |
| sigmap-src/h012 | without | 2/2 | 4 [3–5] | 8 [6–10] | 1,285 [925–1,644] | 43,436 [29,131–57,740] | 8,113 [6,756–9,469] | $0.0027 [$0.0021–$0.0033] | 12.1 s [10.4 s–13.9 s] |
| sigmap-src/h012 | with | 2/2 | 4 [3–5] | 7 [6–8] | 948 [702–1,193] | 44,282 [37,668–50,895] | 7,860 [7,751–7,969] | $0.0025 [$0.0023–$0.0027] | 10.0 s [8.1 s–11.8 s] |
| sigmap-src/h013 | without | 2/2 | 9 [6–12] | 11 [8–14] | 1,883 [1,406–2,360] | 66,858 [44,971–88,745] | 14,323 [11,572–17,073] | $0.0045 [$0.0035–$0.0055] | 14.6 s [11.2 s–18.0 s] |
| sigmap-src/h013 | with | 2/2 | 2 [1–2] | 5 [4–6] | 679 [597–761] | 28,107 [21,332–34,882] | 6,266 [4,991–7,541] | $0.0019 [$0.0016–$0.0022] | 10.2 s [9.1 s–11.3 s] |
| sigmap-src/h014 | without | 2/2 | 3 [2–3] | 6 [6–6] | 725 [706–743] | 27,674 [27,653–27,694] | 7,259 [5,544–8,973] | $0.0021 [$0.0017–$0.0024] | 8.2 s [7.8 s–8.6 s] |
| sigmap-src/h014 | with | 2/2 | 3 [2–3] | 6 [6–6] | 815 [732–897] | 36,943 [36,930–36,956] | 8,108 [6,729–9,486] | $0.0024 [$0.0021–$0.0027] | 8.7 s [8.3 s–9.1 s] |
| sigmap-src/h015 | without | 2/2 | 5 [4–5] | 7 [6–8] | 1,090 [1,032–1,147] | 37,717 [31,513–43,920] | 9,228 [8,586–9,870] | $0.0028 [$0.0027–$0.0029] | 10.1 s [9.8 s–10.4 s] |
| sigmap-src/h015 | with | 2/2 | 4 [3–4] | 9 [8–10] | 1,140 [1,132–1,148] | 57,309 [50,797–63,821] | 8,129 [6,982–9,276] | $0.0028 [$0.0026–$0.0029] | 12.4 s [12.4 s–12.5 s] |

