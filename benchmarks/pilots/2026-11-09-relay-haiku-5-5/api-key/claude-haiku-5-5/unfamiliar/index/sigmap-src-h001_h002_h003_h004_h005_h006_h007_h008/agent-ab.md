# Agent-level A/B — measured tool calls, tokens and cost

**anthropic-messages-api direct Messages API · claude-haiku-5-5 · 2026-11-11 · 4 runs per arm · publishable**

- Arms: **without** = no SigMap; **with** = SigMap index strategy + 7-tool core MCP profile (the docs' setup for an agent that calls the tools).
- Both arms: the same prompt, model, tool allowlist (Read, Grep, Glob, Bash), per-run budget cap $0.25 and timeout 420 s; run in a clean copy of the commit pinned in `benchmarks/xrepo-repos.json`.
- Questions: the task id(s) h001, h002, h003, h004, h005, h006, h007, h008 of `benchmarks/tasks/retrieval-xrepo.jsonl`. Pass = hit@5 on the repository-relative paths the answer names.
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
| sigmap-src | 8 | 24/32 | 24/32 | 0 / 0 |
| all | 8 | 24/32 | 24/32 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2, R3, R4) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 8. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | R3 | R4 | verdict |
| --- | ---: | ---: | ---: | ---: | ---: |
| Tool calls | −44% | −54% | −50% | −36% | fewer in every repetition |
| Input tokens (uncached) | −1% | −2% | −1% | −2% | fewer in every repetition |
| Output tokens | −19% | −32% | −30% | −23% | fewer in every repetition |
| Cache-read tokens | −39% | −62% | −43% | −36% | fewer in every repetition |
| Cache-write tokens | −42% | −57% | −54% | −51% | fewer in every repetition |
| Total tokens (derived) | −39% | −60% | −45% | −39% | fewer in every repetition |
| Cost | −36% | −51% | −45% | −41% | fewer in every repetition |
| Wall time | −6% | −27% | −17% | −17% | fewer in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | R3 | R4 | verdict |
| --- | ---: | ---: | ---: | ---: | ---: |
| Tool calls | −38% [−55%, −6%] n=7 | −55% [−70%, −27%] n=7 | −46% [−69%, −3%] n=7 | −46% [−69%, −15%] n=7 | fewer in every repetition, outside the noise |
| Input tokens (uncached) | −1% [−3%, 0%] | −2% [−4%, −1%] | −1% [−3%, 0%] † | −2% [−3%, 0%] | fewer in every repetition, within the noise |
| Output tokens | −17% [−28%, −2%] | −27% [−41%, −8%] | −25% [−42%, −6%] | −21% [−42%, −3%] | fewer in every repetition, outside the noise |
| Cache-read tokens | +3% [−38%, +83%] † | −28% [−63%, +41%] † | +33% [−41%, +191%] † | −10% [−61%, +88%] † | mixed |
| Cache-write tokens | −49% [−71%, −7%] n=7 | −62% [−75%, −40%] n=7 | −61% [−74%, −37%] n=7 | −54% [−75%, −17%] n=7 | fewer in every repetition, outside the noise |
| Total tokens (derived) | −16% [−45%, +36%] † | −38% [−65%, +12%] † | −16% [−52%, +49%] † | −24% [−64%, +50%] † | fewer in every repetition, within the noise |
| Cost | −33% [−54%, −2%] | −47% [−63%, −24%] | −41% [−57%, −19%] | −37% [−62%, −3%] | fewer in every repetition, outside the noise |
| Wall time | −1% [−15%, +16%] † | −19% [−34%, −2%] | −9% [−30%, +11%] † | −14% [−39%, +9%] † | fewer in every repetition, within the noise |

### Outcome (hit@5), by repetition

Per paired task: **better** = the SigMap arm named the file and the other did not; **worse** = the reverse; **tie** = both found it or both missed. Localisation only.

| repetition | paired tasks | better | worse | tie |
| --- | ---: | ---: | ---: | ---: |
| R1 | 8 | 0 | 0 | 8 |
| R2 | 8 | 0 | 0 | 8 |
| R3 | 8 | 0 | 0 | 8 |
| R4 | 8 | 0 | 0 | 8 |
| all | 32 | 0 | 0 | 32 |

## Tool calls

Provenance: agent-reported (main-thread tool_use blocks). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 4 | 2 | −2 | 6 / 2 / 0 |
| all | 4 | 2 | −2 | 6 / 2 / 0 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 181 | 179 | −3 | 6 / 2 / 0 |
| all | 181 | 179 | −3 | 6 / 2 / 0 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 786 | 555 | −231 | 8 / 0 / 0 |
| all | 786 | 555 | −231 | 8 / 0 / 0 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 10,364 | 8,802 | −4,204 | 5 / 0 / 3 |
| all | 10,364 | 8,802 | −4,204 | 5 / 0 / 3 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 8,742 | 3,259 | −4,788 | 7 / 1 / 0 |
| all | 8,742 | 3,259 | −4,788 | 7 / 1 / 0 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 19,021 | 14,307 | −10,332 | 5 / 0 / 3 |
| all | 19,021 | 14,307 | −10,332 | 5 / 0 / 3 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd), or computed from the API's usage and a price table when the run went through the Messages API directly. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | $0.0016 | $0.0009 | −$0.0008 | 7 / 0 / 1 |
| all | $0.0016 | $0.0009 | −$0.0008 | 7 / 0 / 1 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 4.3 s | 4.3 s | −320 ms | 4 / 0 / 4 |
| all | 4.3 s | 4.3 s | −320 ms | 4 / 0 / 4 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | $0.0532 (32 runs) | $0.0301 (32 runs) | none | none |
| all | $0.0532 (32 runs) | $0.0301 (32 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| sigmap-src/h001 | without | 4/4 | 4 [3–6] | 178 [178–182] | 674 [564–1,039] | 8,773 [8,157–24,572] | 8,575 [6,169–9,016] | $0.0015 [$0.0012–$0.0018] | 4.0 s [4.0 s–5.8 s] |
| sigmap-src/h001 | with | 4/4 | 1 [1–2] | 176 [176–176] | 514 [460–559] | 6,160 [5,329–6,160] | 1,921 [1,574–7,960] | $0.0006 [$0.0005–$0.0013] | 4.9 s [3.8 s–5.2 s] |
| sigmap-src/h002 | without | 0/4 | 6 [6–9] | 182 [181–183] | 1,362 [1,190–1,554] | 21,307 [12,111–30,158] | 12,912 [11,385–15,888] | $0.0025 [$0.0022–$0.0030] | 7.2 s [6.4 s–7.9 s] |
| sigmap-src/h002 | with | 0/4 | 6 [3–6] | 179 [179–181] | 1,061 [1,004–1,310] | 11,443 [11,340–18,554] | 5,295 [4,362–5,805] | $0.0013 [$0.0013–$0.0015] | 6.2 s [5.2 s–6.3 s] |
| sigmap-src/h003 | without | 4/4 | 2 [2–3] | 182 [182–182] | 563 [446–647] | 8,268 [8,132–12,498] | 7,561 [6,629–10,559] | $0.0013 [$0.0013–$0.0018] | 3.3 s [3.0 s–3.8 s] |
| sigmap-src/h003 | with | 4/4 | 2 [1–3] | 182 [180–182] | 522 [334–730] | 13,130 [6,160–15,029] | 4,639 [1,990–7,255] | $0.0010 [$0.0005–$0.0014] | 3.5 s [2.6 s–4.1 s] |
| sigmap-src/h004 | without | 4/4 | 7 [1–12] | 189 [179–201] | 1,327 [623–1,956] | 51,778 [1,628–125,437] | 12,146 [4,673–13,726] | $0.0027 [$0.0009–$0.0040] | 8.0 s [3.4 s–13.0 s] |
| sigmap-src/h004 | with | 4/4 | 3 [1–3] | 182 [179–183] | 732 [474–857] | 13,656 [6,160–16,655] | 2,491 [1,839–3,028] | $0.0009 [$0.0005–$0.0010] | 4.7 s [2.9 s–5.9 s] |
| sigmap-src/h005 | without | 4/4 | 3 [1–4] | 180 [178–182] | 580 [448–781] | 4,797 [1,628–8,044] | 4,460 [4,354–5,637] | $0.0010 [$0.0008–$0.0010] | 3.5 s [2.6 s–4.7 s] |
| sigmap-src/h005 | with | 4/4 | 2 [1–4] | 178 [178–182] | 553 [492–704] | 6,160 [6,160–23,737] | 4,028 [1,870–7,320] | $0.0009 [$0.0006–$0.0014] | 3.5 s [3.1 s–4.5 s] |
| sigmap-src/h006 | without | 4/4 | 8 [5–12] | 184 [179–193] | 1,242 [929–2,044] | 42,796 [15,266–98,258] | 11,012 [8,631–12,517] | $0.0024 [$0.0017–$0.0036] | 7.5 s [5.4 s–12.1 s] |
| sigmap-src/h006 | with | 4/4 | 4 [3–6] | 179 [177–179] | 838 [734–1,212] | 24,887 [15,072–25,445] | 8,976 [8,064–9,828] | $0.0018 [$0.0017–$0.0021] | 5.3 s [4.4 s–6.7 s] |
| sigmap-src/h007 | without | 0/4 | 0 [0–0] | 172 [172–172] | 262 [244–284] | 814 [814–814] | 0 [0–0] | $0.0002 [$0.0001–$0.0002] | 1.9 s [1.8 s–2.0 s] |
| sigmap-src/h007 | with | 0/4 | 0 [0–0] | 172 [172–172] | 261 [194–281] | 3,080 [3,080–3,080] | 0 [0–0] | $0.0002 [$0.0001–$0.0002] | 2.0 s [1.6 s–2.3 s] |
| sigmap-src/h008 | without | 4/4 | 4 [3–5] | 176 [175–181] | 899 [767–1,111] | 11,954 [8,235–15,805] | 8,910 [3,529–9,140] | $0.0017 [$0.0012–$0.0017] | 4.5 s [3.8 s–6.0 s] |
| sigmap-src/h008 | with | 4/4 | 1 [1–4] | 173 [173–179] | 558 [492–998] | 6,160 [6,160–21,830] | 1,742 [1,740–3,305] | $0.0006 [$0.0005–$0.0011] | 3.8 s [3.4 s–6.7 s] |

