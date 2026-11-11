# Agent-level A/B — measured tool calls, tokens and cost

**claude-code 2.1.322 (Claude Code) · claude-haiku-5-5 · 2026-11-11 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap ranked the question BEFORE the first turn (what a prompt hook would inject): the five likeliest files with their signatures and line anchors in the prompt, + the sigmap CLI; no MCP server, no standing section, no extra tool call.
- Both arms: the same prompt, model, tool allowlist (Read, Grep, Glob, Bash), per-run budget cap $0.6 and timeout 420 s; run in a clean copy of the commit pinned in `benchmarks/xrepo-repos.json`.
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
| Tool calls | −62% | −50% | fewer in every repetition |
| Input tokens (uncached) | −47% | −31% | fewer in every repetition |
| Output tokens | −43% | −23% | fewer in every repetition |
| Cache-read tokens | −57% | −34% | fewer in every repetition |
| Cache-write tokens | −11% | −52% | fewer in every repetition |
| Total tokens (derived) | −49% | −37% | fewer in every repetition |
| Cost | −25% | −45% | fewer in every repetition |
| Wall time | −36% | −18% | fewer in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −55% [−69%, −34%] n=6 | −47% [−66%, −21%] | fewer in every repetition, outside the noise |
| Input tokens (uncached) | −47% [−59%, −34%] | −30% [−42%, −15%] | fewer in every repetition, outside the noise |
| Output tokens | −39% [−54%, −24%] | −21% [−37%, +6%] † | fewer in every repetition, within the noise |
| Cache-read tokens | −59% [−73%, −41%] | −27% [−49%, −2%] | fewer in every repetition, outside the noise |
| Cache-write tokens | −9% [−24%, +5%] † | −49% [−66%, −29%] | fewer in every repetition, within the noise |
| Total tokens (derived) | −48% [−61%, −33%] | −32% [−51%, −10%] | fewer in every repetition, outside the noise |
| Cost | −23% [−38%, −10%] | −41% [−57%, −22%] | fewer in every repetition, outside the noise |
| Wall time | −34% [−45%, −23%] | −17% [−25%, −8%] | fewer in every repetition, outside the noise |

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
| sigmap-src | 5 | 2 | −2 | 6 / 1 / 0 |
| all | 5 | 2 | −2 | 6 / 1 / 0 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 7 | 5 | −2 | 7 / 0 / 0 |
| all | 7 | 5 | −2 | 7 / 0 / 0 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 1,364 | 864 | −434 | 6 / 0 / 1 |
| all | 1,364 | 864 | −434 | 6 / 0 / 1 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 36,558 | 26,372 | −10,186 | 7 / 0 / 0 |
| all | 36,558 | 26,372 | −10,186 | 7 / 0 / 0 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 9,061 | 7,397 | −2,221 | 7 / 0 / 0 |
| all | 9,061 | 7,397 | −2,221 | 7 / 0 / 0 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 50,254 | 34,994 | −15,261 | 7 / 0 / 0 |
| all | 50,254 | 34,994 | −15,261 | 7 / 0 / 0 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | $0.0029 | $0.0023 | −$0.0009 | 7 / 0 / 0 |
| all | $0.0029 | $0.0023 | −$0.0009 | 7 / 0 / 0 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 12.6 s | 9.2 s | −2.9 s | 7 / 0 / 0 |
| all | 12.6 s | 9.2 s | −2.9 s | 7 / 0 / 0 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | $0.0477 (14 runs) | $0.0313 (14 runs) | none | none |
| all | $0.0477 (14 runs) | $0.0313 (14 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| sigmap-src/h009 | without | 2/2 | 4 [3–4] | 9 [8–10] | 1,364 [1,069–1,658] | 51,527 [43,199–59,855] | 11,461 [10,382–12,539] | $0.0035 [$0.0030–$0.0039] | 14.0 s [12.7 s–15.3 s] |
| sigmap-src/h009 | with | 2/2 | 4 [3–4] | 7 [6–8] | 1,058 [833–1,282] | 42,555 [37,980–47,129] | 10,767 [9,409–12,125] | $0.0031 [$0.0027–$0.0035] | 11.2 s [10.4 s–12.0 s] |
| sigmap-src/h010 | without | 2/2 | 4 [3–5] | 7 [6–8] | 1,377 [1,333–1,421] | 36,558 [28,527–44,588] | 12,313 [10,899–13,726] | $0.0035 [$0.0031–$0.0039] | 12.8 s [12.3 s–13.4 s] |
| sigmap-src/h010 | with | 2/2 | 2 [2–2] | 5 [4–6] | 893 [764–1,022] | 26,372 [17,184–35,560] | 7,724 [5,130–10,317] | $0.0023 [$0.0018–$0.0027] | 9.9 s [9.3 s–10.5 s] |
| sigmap-src/h011 | without | 2/2 | 5 [4–5] | 6 [6–6] | 1,498 [1,382–1,614] | 28,522 [28,068–28,976] | 8,235 [7,284–9,185] | $0.0027 [$0.0024–$0.0029] | 11.8 s [10.9 s–12.8 s] |
| sigmap-src/h011 | with | 2/2 | 1 [0–1] | 3 [2–4] | 725 [581–869] | 13,368 [4,573–22,162] | 5,776 [3,561–7,991] | $0.0017 [$0.0014–$0.0019] | 8.0 s [7.0 s–8.9 s] |
| sigmap-src/h012 | without | 2/2 | 5 [4–6] | 8 [8–8] | 1,287 [1,279–1,294] | 42,282 [41,366–43,197] | 9,061 [9,011–9,111] | $0.0029 [$0.0029–$0.0029] | 12.6 s [12.1 s–13.1 s] |
| sigmap-src/h012 | with | 2/2 | 2 [2–2] | 4 [4–4] | 853 [822–883] | 18,523 [16,381–20,664] | 6,840 [4,682–8,998] | $0.0020 [$0.0016–$0.0024] | 8.2 s [8.2 s–8.2 s] |
| sigmap-src/h013 | without | 2/2 | 12 [9–14] | 15 [12–18] | 2,482 [1,658–3,306] | 114,549 [106,552–122,546] | 20,511 [15,371–25,651] | $0.0065 [$0.0060–$0.0070] | 19.6 s [14.5 s–24.6 s] |
| sigmap-src/h013 | with | 2/2 | 3 [3–3] | 6 [6–6] | 1,181 [1,023–1,338] | 31,181 [29,027–33,335] | 6,757 [4,743–8,770] | $0.0023 [$0.0020–$0.0026] | 10.8 s [9.6 s–12.0 s] |
| sigmap-src/h014 | without | 2/2 | 3 [2–3] | 6 [6–6] | 752 [602–902] | 27,748 [27,234–28,262] | 7,907 [5,633–10,180] | $0.0022 [$0.0017–$0.0028] | 9.8 s [9.5 s–10.1 s] |
| sigmap-src/h014 | with | 2/2 | 2 [1–2] | 4 [4–4] | 864 [712–1,016] | 19,616 [17,108–22,124] | 7,397 [4,337–10,456] | $0.0021 [$0.0016–$0.0026] | 9.0 s [8.4 s–9.6 s] |
| sigmap-src/h015 | without | 2/2 | 5 [4–5] | 7 [6–8] | 944 [824–1,064] | 36,002 [28,341–43,663] | 8,597 [7,792–9,402] | $0.0026 [$0.0023–$0.0028] | 10.5 s [9.3 s–11.8 s] |
| sigmap-src/h015 | with | 2/2 | 3 [3–3] | 6 [6–6] | 803 [771–834] | 29,180 [27,765–30,595] | 7,985 [5,697–10,273] | $0.0023 [$0.0018–$0.0027] | 9.2 s [9.0 s–9.4 s] |

