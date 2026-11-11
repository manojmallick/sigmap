# Agent-level A/B — measured tool calls, tokens and cost

**claude-code 2.1.322 (Claude Code) · claude-haiku-5-5 · 2026-11-11 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap ranked the question BEFORE the first turn (what a prompt hook would inject): the five likeliest files with their signatures and line anchors after the question in the user turn, + the sigmap CLI; no MCP server, no standing section, no extra tool call.
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
| Tool calls | −25% | −42% | fewer in every repetition |
| Input tokens (uncached) | −21% | −18% | fewer in every repetition |
| Output tokens | +4% | −4% | mixed |
| Cache-read tokens | −23% | −10% | fewer in every repetition |
| Cache-write tokens | +11% | −10% | mixed |
| Total tokens (derived) | −17% | −10% | fewer in every repetition |
| Cost | +3% | −8% | mixed |
| Wall time | −9% | 0% | fewer in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | +4% [−25%, +50%] † n=3 | −9% [−25%, 0%] † n=3 | mixed |
| Input tokens (uncached) | −29% [−56%, 0%] † | −24% [−56%, 0%] † | fewer in every repetition, within the noise |
| Output tokens | +3% [−11%, +20%] † | −6% [−23%, +14%] † | mixed |
| Cache-read tokens | −35% [−66%, +7%] † | −20% [−59%, +14%] † | fewer in every repetition, within the noise |
| Cache-write tokens | +11% [−8%, +33%] † | −11% [−35%, +19%] † | mixed |
| Total tokens (derived) | −26% [−53%, +11%] † | −17% [−54%, +15%] † | fewer in every repetition, within the noise |
| Cost | +2% [−17%, +25%] † | −11% [−35%, +17%] † | mixed |
| Wall time | −10% [−20%, +2%] † | −2% [−18%, +10%] † | fewer in every repetition, within the noise |

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
| express | 3 | 3 | −1 | 2 / 1 / 1 |
| all | 3 | 3 | −1 | 2 / 1 / 1 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | 7 | 6 | −1 | 2 / 2 / 0 |
| all | 7 | 6 | −1 | 2 / 2 / 0 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | 807 | 837 | −5 | 2 / 0 / 2 |
| all | 807 | 837 | −5 | 2 / 0 / 2 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | 30,426 | 27,241 | −1,935 | 2 / 0 / 2 |
| all | 30,426 | 27,241 | −1,935 | 2 / 0 / 2 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | 5,263 | 6,253 | −24 | 2 / 0 / 2 |
| all | 5,263 | 6,253 | −24 | 2 / 0 / 2 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | 36,428 | 34,412 | −1,733 | 2 / 0 / 2 |
| all | 36,428 | 34,412 | −1,733 | 2 / 0 / 2 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | $0.0017 | $0.0020 | −$0.0000 | 2 / 0 / 2 |
| all | $0.0017 | $0.0020 | −$0.0000 | 2 / 0 / 2 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| express | 9.4 s | 9.5 s | −153 ms | 2 / 0 / 2 |
| all | 9.4 s | 9.5 s | −153 ms | 2 / 0 / 2 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| express | $0.0147 (8 runs) | $0.0144 (8 runs) | none | none |
| all | $0.0147 (8 runs) | $0.0144 (8 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| express/x037 | without | 2/2 | 2 [1–2] | 5 [4–6] | 866 [804–927] | 22,074 [16,786–27,362] | 4,865 [4,190–5,539] | $0.0016 [$0.0015–$0.0018] | 10.0 s [9.8 s–10.2 s] |
| express/x037 | with | 2/2 | 2 [1–3] | 5 [4–6] | 1,020 [968–1,072] | 24,145 [19,080–29,209] | 6,392 [5,749–7,034] | $0.0020 [$0.0019–$0.0022] | 10.3 s [9.8 s–10.9 s] |
| express/x038 | without | 2/2 | 4 [4–4] | 7 [6–8] | 949 [930–967] | 36,277 [28,629–43,925] | 7,248 [6,892–7,604] | $0.0023 [$0.0021–$0.0024] | 9.8 s [9.3 s–10.2 s] |
| express/x038 | with | 2/2 | 3 [3–3] | 6 [6–6] | 806 [804–807] | 30,337 [29,149–31,525] | 6,114 [5,409–6,819] | $0.0019 [$0.0018–$0.0021] | 9.1 s [8.5 s–9.8 s] |
| express/x039 | without | 2/2 | 4 [3–4] | 6 [6–6] | 718 [715–720] | 27,552 [27,476–27,627] | 5,118 [5,040–5,196] | $0.0017 [$0.0016–$0.0017] | 9.1 s [9.0 s–9.1 s] |
| express/x039 | with | 2/2 | 0 [0–0] | 2 [2–2] | 588 [515–661] | 7,210 [6,281–8,139] | 3,841 [2,908–4,774] | $0.0011 [$0.0009–$0.0013] | 6.8 s [6.8 s–6.9 s] |
| express/x040 | without | 2/2 | 3 [3–3] | 7 [6–8] | 748 [739–756] | 33,301 [27,621–38,981] | 5,408 [5,311–5,505] | $0.0018 [$0.0017–$0.0018] | 9.1 s [8.4 s–9.8 s] |
| express/x040 | with | 2/2 | 3 [3–3] | 7 [6–8] | 868 [837–898] | 36,716 [31,357–42,075] | 6,495 [5,647–7,343] | $0.0021 [$0.0019–$0.0023] | 9.9 s [9.5 s–10.2 s] |

