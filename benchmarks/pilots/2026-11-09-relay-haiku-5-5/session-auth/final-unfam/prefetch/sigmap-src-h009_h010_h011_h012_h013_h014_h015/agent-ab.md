# Agent-level A/B — measured tool calls, tokens and cost

**claude-code 2.1.322 (Claude Code) · claude-haiku-5-5 · 2026-11-11 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap ranked the question BEFORE the first turn (what a prompt hook would inject): the five likeliest files with their signatures and line anchors after the question in the user turn, + the sigmap CLI; no MCP server, no standing section, no extra tool call.
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
| sigmap-src | 7 | 12/14 | 14/14 | 0 / 0 |
| all | 7 | 12/14 | 14/14 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 7. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −54% | −65% | fewer in every repetition |
| Input tokens (uncached) | −42% | −42% | fewer in every repetition |
| Output tokens | −36% | −38% | fewer in every repetition |
| Cache-read tokens | −50% | −36% | fewer in every repetition |
| Cache-write tokens | −18% | −51% | fewer in every repetition |
| Total tokens (derived) | −44% | −39% | fewer in every repetition |
| Cost | −27% | −46% | fewer in every repetition |
| Wall time | −28% | −30% | fewer in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −54% [−72%, −23%] | −49% [−67%, −11%] n=5 | fewer in every repetition, outside the noise |
| Input tokens (uncached) | −42% [−59%, −18%] | −50% [−71%, −18%] | fewer in every repetition, outside the noise |
| Output tokens | −34% [−48%, −22%] | −38% [−58%, −7%] | fewer in every repetition, outside the noise |
| Cache-read tokens | −49% [−68%, −18%] | −50% [−74%, −7%] | fewer in every repetition, outside the noise |
| Cache-write tokens | −18% [−32%, −1%] | −53% [−69%, −22%] | fewer in every repetition, outside the noise |
| Total tokens (derived) | −43% [−61%, −15%] | −50% [−72%, −9%] | fewer in every repetition, outside the noise |
| Cost | −26% [−37%, −10%] | −49% [−67%, −17%] | fewer in every repetition, outside the noise |
| Wall time | −28% [−39%, −15%] | −31% [−47%, −7%] | fewer in every repetition, outside the noise |

### Outcome (hit@5), by repetition

Per paired task: **better** = the SigMap arm named the file and the other did not; **worse** = the reverse; **tie** = both found it or both missed. Localisation only.

| repetition | paired tasks | better | worse | tie |
| --- | ---: | ---: | ---: | ---: |
| R1 | 7 | 1 | 0 | 6 |
| R2 | 7 | 1 | 0 | 6 |
| all | 14 | 2 | 0 | 12 |

## Tool calls

Provenance: agent-reported (main-thread tool_use blocks). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 4 | 2 | −2 | 6 / 0 / 1 |
| all | 4 | 2 | −2 | 6 / 0 / 1 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 8 | 4 | −4 | 6 / 0 / 1 |
| all | 8 | 4 | −4 | 6 / 0 / 1 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 1,373 | 876 | −597 | 6 / 0 / 1 |
| all | 1,373 | 876 | −597 | 6 / 0 / 1 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 47,474 | 20,652 | −26,822 | 6 / 0 / 1 |
| all | 47,474 | 20,652 | −26,822 | 6 / 0 / 1 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 9,657 | 6,194 | −4,070 | 6 / 0 / 1 |
| all | 9,657 | 6,194 | −4,070 | 6 / 0 / 1 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 56,311 | 27,625 | −28,686 | 6 / 0 / 1 |
| all | 56,311 | 27,625 | −28,686 | 6 / 0 / 1 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | $0.0031 | $0.0019 | −$0.0012 | 6 / 0 / 1 |
| all | $0.0031 | $0.0019 | −$0.0012 | 6 / 0 / 1 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 12.5 s | 8.6 s | −2.8 s | 6 / 0 / 1 |
| all | 12.5 s | 8.6 s | −2.8 s | 6 / 0 / 1 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | $0.0469 (14 runs) | $0.0301 (14 runs) | none | none |
| all | $0.0469 (14 runs) | $0.0301 (14 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| sigmap-src/h009 | without | 2/2 | 4 [3–5] | 9 [8–10] | 1,373 [1,315–1,431] | 47,474 [42,294–52,653] | 7,455 [6,480–8,430] | $0.0027 [$0.0025–$0.0028] | 13.0 s [12.3 s–13.7 s] |
| sigmap-src/h009 | with | 2/2 | 2 [0–4] | 4 [2–6] | 776 [546–1,006] | 20,652 [8,868–32,435] | 6,194 [2,948–9,439] | $0.0018 [$0.0010–$0.0027] | 7.9 s [7.0 s–8.8 s] |
| sigmap-src/h010 | without | 2/2 | 7 [7–7] | 10 [10–10] | 1,841 [1,768–1,913] | 63,811 [62,617–65,004] | 13,129 [12,832–13,425] | $0.0042 [$0.0042–$0.0042] | 14.7 s [14.7 s–14.7 s] |
| sigmap-src/h010 | with | 2/2 | 2 [2–2] | 5 [4–6] | 876 [760–992] | 27,134 [18,885–35,383] | 6,006 [4,026–7,985] | $0.0019 [$0.0015–$0.0023] | 8.8 s [8.2 s–9.3 s] |
| sigmap-src/h011 | without | 2/2 | 6 [6–6] | 8 [8–8] | 1,552 [1,433–1,670] | 43,351 [41,808–44,893] | 9,657 [9,566–9,747] | $0.0031 [$0.0031–$0.0032] | 12.5 s [12.5 s–12.5 s] |
| sigmap-src/h011 | with | 2/2 | 2 [2–2] | 6 [6–6] | 944 [898–989] | 33,728 [32,062–35,394] | 5,587 [3,944–7,230] | $0.0019 [$0.0016–$0.0023] | 9.9 s [9.2 s–10.6 s] |
| sigmap-src/h012 | without | 2/2 | 4 [3–4] | 8 [8–8] | 1,188 [1,020–1,356] | 48,221 [43,062–53,379] | 14,467 [14,027–14,906] | $0.0040 [$0.0037–$0.0042] | 11.4 s [10.9 s–11.9 s] |
| sigmap-src/h012 | with | 2/2 | 2 [2–2] | 4 [4–4] | 1,012 [890–1,134] | 19,356 [18,074–20,638] | 6,731 [4,739–8,723] | $0.0020 [$0.0016–$0.0025] | 8.6 s [7.9 s–9.3 s] |
| sigmap-src/h013 | without | 0/2 | 10 [9–10] | 13 [12–14] | 2,100 [1,895–2,304] | 80,389 [67,487–93,291] | 13,908 [13,561–14,255] | $0.0046 [$0.0045–$0.0048] | 16.6 s [15.9 s–17.4 s] |
| sigmap-src/h013 | with | 2/2 | 1 [0–2] | 3 [2–4] | 729 [606–851] | 13,528 [8,913–18,142] | 7,610 [2,934–12,285] | $0.0020 [$0.0010–$0.0031] | 7.2 s [6.3 s–8.1 s] |
| sigmap-src/h014 | without | 2/2 | 3 [2–4] | 7 [6–8] | 932 [736–1,128] | 33,490 [28,028–38,951] | 8,024 [5,916–10,132] | $0.0024 [$0.0018–$0.0030] | 10.0 s [8.7 s–11.3 s] |
| sigmap-src/h014 | with | 2/2 | 1 [1–1] | 4 [4–4] | 722 [619–825] | 20,451 [18,801–22,100] | 6,093 [4,432–7,754] | $0.0018 [$0.0014–$0.0022] | 7.8 s [7.3 s–8.3 s] |
| sigmap-src/h015 | without | 2/2 | 4 [4–4] | 7 [6–8] | 1,060 [905–1,215] | 34,345 [28,564–40,126] | 7,819 [6,689–8,949] | $0.0024 [$0.0022–$0.0027] | 10.3 s [9.9 s–10.7 s] |
| sigmap-src/h015 | with | 2/2 | 5 [4–6] | 10 [8–12] | 1,256 [1,024–1,487] | 64,729 [44,880–84,577] | 11,138 [10,622–11,653] | $0.0035 [$0.0031–$0.0039] | 12.8 s [10.9 s–14.6 s] |

