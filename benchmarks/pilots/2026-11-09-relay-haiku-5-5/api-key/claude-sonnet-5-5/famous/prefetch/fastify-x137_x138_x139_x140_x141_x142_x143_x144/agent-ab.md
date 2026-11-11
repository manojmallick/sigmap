# Agent-level A/B — measured tool calls, tokens and cost

**anthropic-messages-api direct Messages API · claude-sonnet-5-5 · 2026-11-11 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap ranked the question BEFORE the first turn (what a prompt hook would inject): the five likeliest files with their signatures and line anchors after the question in the user turn, + the sigmap CLI; no MCP server, no standing section, no extra tool call.
- Both arms: the same prompt, model, tool allowlist (Read, Grep, Glob, Bash), per-run budget cap $0.25 and timeout 420 s; run in a clean copy of the commit pinned in `benchmarks/xrepo-repos.json`.
- Questions: the task id(s) x137, x138, x139, x140, x141, x142, x143, x144 of `benchmarks/tasks/retrieval-xrepo.jsonl`. Pass = hit@5 on the repository-relative paths the answer names.
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
| fastify | 8 | 16/16 | 16/16 | 0 / 0 |
| all | 8 | 16/16 | 16/16 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 8. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −54% | −46% | fewer in every repetition |
| Input tokens (uncached) | +650% | +652% | more in every repetition |
| Output tokens | −30% | −25% | fewer in every repetition |
| Cache-read tokens | −71% | −51% | fewer in every repetition |
| Cache-write tokens | −29% | −48% | fewer in every repetition |
| Total tokens (derived) | −49% | −38% | fewer in every repetition |
| Cost | −22% | −27% | fewer in every repetition |
| Wall time | −28% | −28% | fewer in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −50% [−66%, −28%] | −42% [−58%, −16%] | fewer in every repetition, outside the noise |
| Input tokens (uncached) | +645% [+576%, +703%] | +646% [+578%, +703%] | more in every repetition, outside the noise |
| Output tokens | −29% [−42%, −13%] | −23% [−36%, −8%] | fewer in every repetition, outside the noise |
| Cache-read tokens | −68% [−87%, −22%] | −53% [−75%, −9%] | fewer in every repetition, outside the noise |
| Cache-write tokens | −23% [−50%, +10%] † | −32% [−54%, 0%] n=6 | fewer in every repetition, within the noise |
| Total tokens (derived) | −40% [−67%, +3%] † | −37% [−52%, −16%] | fewer in every repetition, within the noise |
| Cost | −16% [−40%, +12%] † | −29% [−45%, −8%] | fewer in every repetition, within the noise |
| Wall time | −26% [−50%, +6%] † | −28% [−47%, −2%] | fewer in every repetition, within the noise |

### Outcome (hit@5), by repetition

Per paired task: **better** = the SigMap arm named the file and the other did not; **worse** = the reverse; **tie** = both found it or both missed. Localisation only.

| repetition | paired tasks | better | worse | tie |
| --- | ---: | ---: | ---: | ---: |
| R1 | 8 | 0 | 0 | 8 |
| R2 | 8 | 0 | 0 | 8 |
| all | 16 | 0 | 0 | 16 |

## Tool calls

Provenance: agent-reported (main-thread tool_use blocks). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | 5 | 2 | −2 | 6 / 2 / 0 |
| all | 5 | 2 | −2 | 6 / 2 / 0 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | 217 | 1,653 | +1,440 | 0 / 0 / 8 |
| all | 217 | 1,653 | +1,440 | 0 / 0 / 8 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | 747 | 527 | −172 | 7 / 0 / 1 |
| all | 747 | 527 | −172 | 7 / 0 / 1 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | 8,435 | 3,745 | −4,856 | 6 / 0 / 2 |
| all | 8,435 | 3,745 | −4,856 | 6 / 0 / 2 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | 5,385 | 3,553 | −1,245 | 7 / 0 / 1 |
| all | 5,385 | 3,553 | −1,245 | 7 / 0 / 1 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | 15,386 | 8,776 | −6,553 | 6 / 0 / 2 |
| all | 15,386 | 8,776 | −6,553 | 6 / 0 / 2 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd), or computed from the API's usage and a price table when the run went through the Messages API directly. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | $0.0252 | $0.0181 | −$0.0049 | 6 / 0 / 2 |
| all | $0.0252 | $0.0181 | −$0.0049 | 6 / 0 / 2 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| fastify | 7.8 s | 6.0 s | −932 ms | 6 / 0 / 2 |
| all | 7.8 s | 6.0 s | −932 ms | 6 / 0 / 2 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| fastify | $0.3737 (16 runs) | $0.2820 (16 runs) | none | none |
| all | $0.3737 (16 runs) | $0.2820 (16 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| fastify/x137 | without | 2/2 | 5 [5–5] | 224 [224–224] | 833 [822–844] | 11,427 [11,154–11,699] | 5,582 [5,438–5,726] | $0.0250 [$0.0248–$0.0252] | 7.1 s [6.9 s–7.4 s] |
| fastify/x137 | with | 2/2 | 2 [2–2] | 1,821 [1,821–1,821] | 487 [466–508] | 1,628 [1,628–1,628] | 4,345 [4,345–4,345] | $0.0197 [$0.0195–$0.0199] | 4.2 s [3.9 s–4.5 s] |
| fastify/x138 | without | 2/2 | 3 [2–3] | 204 [203–205] | 413 [395–430] | 2,780 [1,628–3,932] | 4,493 [2,995–5,991] | $0.0163 [$0.0130–$0.0197] | 6.5 s [5.7 s–7.3 s] |
| fastify/x138 | with | 2/2 | 3 [2–3] | 1,567 [1,567–1,567] | 382 [335–428] | 4,628 [4,628–4,628] | 3,512 [3,009–4,015] | $0.0167 [$0.0149–$0.0184] | 7.7 s [6.1 s–9.3 s] |
| fastify/x139 | without | 2/2 | 2 [2–2] | 210 [210–210] | 512 [506–518] | 8,494 [8,473–8,514] | 7,631 [7,610–7,651] | $0.0263 [$0.0262–$0.0264] | 5.0 s [4.9 s–5.0 s] |
| fastify/x139 | with | 2/2 | 2 [2–2] | 1,615 [1,615–1,615] | 456 [432–480] | 1,628 [1,628–1,628] | 3,334 [3,191–3,477] | $0.0165 [$0.0159–$0.0170] | 6.5 s [4.7 s–8.2 s] |
| fastify/x140 | without | 2/2 | 9 [7–10] | 228 [228–228] | 1,073 [923–1,223] | 25,442 [11,529–39,354] | 7,841 [4,972–10,710] | $0.0359 [$0.0244–$0.0473] | 14.2 s [11.7 s–16.6 s] |
| fastify/x140 | with | 2/2 | 2 [2–2] | 1,772 [1,772–1,772] | 491 [460–521] | 2,861 [1,628–4,094] | 1,233 [0–2,466] | $0.0121 [$0.0090–$0.0152] | 4.3 s [4.1 s–4.5 s] |
| fastify/x141 | without | 2/2 | 6 [6–6] | 217 [217–217] | 796 [743–848] | 8,377 [7,741–9,012] | 2,942 [2,884–3,000] | $0.0174 [$0.0172–$0.0177] | 9.2 s [8.8 s–9.6 s] |
| fastify/x141 | with | 2/2 | 3 [3–3] | 1,205 [1,205–1,205] | 586 [557–614] | 5,531 [3,841–7,220] | 1,690 [0–3,379] | $0.0136 [$0.0094–$0.0178] | 8.4 s [6.8 s–10.0 s] |
| fastify/x142 | without | 2/2 | 5 [4–5] | 215 [214–216] | 697 [676–718] | 6,392 [5,036–7,747] | 2,384 [2,355–2,413] | $0.0146 [$0.0142–$0.0150] | 8.4 s [7.8 s–8.9 s] |
| fastify/x142 | with | 2/2 | 4 [3–4] | 1,854 [1,853–1,855] | 762 [694–829] | 6,858 [4,819–8,896] | 3,594 [3,548–3,639] | $0.0217 [$0.0205–$0.0229] | 7.5 s [6.6 s–8.4 s] |
| fastify/x143 | without | 2/2 | 6 [5–7] | 216 [214–218] | 960 [873–1,046] | 14,193 [8,800–19,585] | 5,188 [5,074–5,301] | $0.0258 [$0.0242–$0.0275] | 10.6 s [9.0 s–12.2 s] |
| fastify/x143 | with | 2/2 | 2 [2–2] | 1,690 [1,690–1,690] | 602 [558–646] | 1,628 [1,628–1,628] | 4,621 [4,575–4,667] | $0.0213 [$0.0207–$0.0218] | 4.6 s [4.3 s–4.9 s] |
| fastify/x144 | without | 2/2 | 4 [3–4] | 219 [219–219] | 699 [669–728] | 6,315 [4,238–8,391] | 6,695 [4,981–8,408] | $0.0254 [$0.0210–$0.0298] | 6.4 s [5.9 s–7.0 s] |
| fastify/x144 | with | 2/2 | 2 [2–2] | 1,492 [1,492–1,492] | 564 [510–618] | 6,044 [4,843–7,244] | 3,884 [2,697–5,071] | $0.0195 [$0.0174–$0.0217] | 5.4 s [5.2 s–5.7 s] |

