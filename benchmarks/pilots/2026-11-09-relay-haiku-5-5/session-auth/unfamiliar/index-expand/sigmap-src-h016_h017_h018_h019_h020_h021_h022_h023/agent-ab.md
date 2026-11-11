# Agent-level A/B — measured tool calls, tokens and cost

**claude-code 2.1.322 (Claude Code) · claude-haiku-5-5 · 2026-11-11 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap index strategy + 7-tool core MCP profile (the docs' setup for an agent that calls the tools).
- Both arms: the same prompt, model, tool allowlist (Read, Grep, Glob, Bash), per-run budget cap $0.6 and timeout 420 s; run in a clean copy of the commit pinned in `benchmarks/xrepo-repos.json`.
- Questions: the task id(s) h016, h017, h018, h019, h020, h021, h022, h023 of `benchmarks/tasks/retrieval-xrepo.jsonl`. Pass = hit@5 on the repository-relative paths the answer names.
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
| sigmap-src | 8 | 16/16 | 16/16 | 0 / 0 |
| all | 8 | 16/16 | 16/16 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 8. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −69% | −40% | fewer in every repetition |
| Input tokens (uncached) | −55% | −32% | fewer in every repetition |
| Output tokens | −58% | −37% | fewer in every repetition |
| Cache-read tokens | −59% | −23% | fewer in every repetition |
| Cache-write tokens | −55% | −24% | fewer in every repetition |
| Total tokens (derived) | −59% | −23% | fewer in every repetition |
| Cost | −56% | −27% | fewer in every repetition |
| Wall time | −44% | −25% | fewer in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −72% [−86%, −46%] | −48% [−65%, −16%] | fewer in every repetition, outside the noise |
| Input tokens (uncached) | −55% [−70%, −36%] | −34% [−48%, −14%] | fewer in every repetition, outside the noise |
| Output tokens | −58% [−74%, −37%] | −39% [−56%, −13%] | fewer in every repetition, outside the noise |
| Cache-read tokens | −59% [−77%, −33%] | −27% [−46%, +4%] † | fewer in every repetition, within the noise |
| Cache-write tokens | −52% [−70%, −21%] | −27% [−41%, −9%] | fewer in every repetition, outside the noise |
| Total tokens (derived) | −59% [−76%, −32%] | −27% [−45%, 0%] | fewer in every repetition, outside the noise |
| Cost | −55% [−72%, −28%] | −30% [−44%, −11%] | fewer in every repetition, outside the noise |
| Wall time | −44% [−59%, −27%] | −26% [−35%, −13%] | fewer in every repetition, outside the noise |

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
| sigmap-src | 7 | 2 | −4 | 7 / 0 / 1 |
| all | 7 | 2 | −4 | 7 / 0 / 1 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 11 | 5 | −5 | 8 / 0 / 0 |
| all | 11 | 5 | −5 | 8 / 0 / 0 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 1,851 | 787 | −876 | 7 / 0 / 1 |
| all | 1,851 | 787 | −876 | 7 / 0 / 1 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 62,965 | 28,418 | −30,933 | 6 / 0 / 2 |
| all | 62,965 | 28,418 | −30,933 | 6 / 0 / 2 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 12,761 | 6,369 | −4,946 | 6 / 0 / 2 |
| all | 12,761 | 6,369 | −4,946 | 6 / 0 / 2 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 78,698 | 34,871 | −36,799 | 6 / 0 / 2 |
| all | 78,698 | 34,871 | −36,799 | 6 / 0 / 2 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | $0.0045 | $0.0019 | −$0.0018 | 7 / 0 / 1 |
| all | $0.0045 | $0.0019 | −$0.0018 | 7 / 0 / 1 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 15.7 s | 9.2 s | −5.7 s | 8 / 0 / 0 |
| all | 15.7 s | 9.2 s | −5.7 s | 8 / 0 / 0 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | $0.0700 (16 runs) | $0.0382 (16 runs) | none | none |
| all | $0.0700 (16 runs) | $0.0382 (16 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| sigmap-src/h016 | without | 2/2 | 5 [4–5] | 7 [6–8] | 1,543 [1,176–1,910] | 35,684 [27,729–43,638] | 9,798 [8,334–11,262] | $0.0031 [$0.0029–$0.0033] | 13.9 s [12.3 s–15.5 s] |
| sigmap-src/h016 | with | 2/2 | 2 [2–2] | 4 [4–4] | 878 [823–932] | 21,145 [20,832–21,458] | 6,205 [5,507–6,903] | $0.0019 [$0.0017–$0.0021] | 10.1 s [9.2 s–10.9 s] |
| sigmap-src/h017 | without | 2/2 | 6 [5–6] | 10 [10–10] | 1,844 [1,565–2,123] | 62,596 [60,132–65,060] | 11,873 [10,428–13,317] | $0.0039 [$0.0037–$0.0041] | 15.1 s [14.4 s–15.9 s] |
| sigmap-src/h017 | with | 2/2 | 2 [1–2] | 5 [4–6] | 710 [676–744] | 28,286 [20,831–35,741] | 5,574 [5,519–5,628] | $0.0018 [$0.0017–$0.0018] | 9.1 s [8.5 s–9.8 s] |
| sigmap-src/h018 | without | 2/2 | 8 [5–10] | 10 [10–10] | 1,859 [1,561–2,156] | 57,038 [54,379–59,697] | 22,167 [9,394–34,940] | $0.0059 [$0.0032–$0.0087] | 16.3 s [14.3 s–18.2 s] |
| sigmap-src/h018 | with | 2/2 | 2 [1–2] | 4 [4–4] | 860 [714–1,006] | 21,154 [20,838–21,470] | 6,533 [5,613–7,452] | $0.0019 [$0.0017–$0.0022] | 9.2 s [9.1 s–9.3 s] |
| sigmap-src/h019 | without | 2/2 | 6 [6–6] | 11 [10–12] | 1,467 [1,455–1,478] | 63,333 [53,621–73,045] | 10,117 [9,059–11,175] | $0.0034 [$0.0031–$0.0037] | 14.3 s [12.7 s–15.9 s] |
| sigmap-src/h019 | with | 2/2 | 3 [2–3] | 6 [6–6] | 714 [599–829] | 35,778 [35,702–35,854] | 6,580 [5,952–7,208] | $0.0020 [$0.0018–$0.0022] | 8.9 s [8.5 s–9.3 s] |
| sigmap-src/h020 | without | 2/2 | 12 [4–20] | 17 [6–28] | 2,865 [974–4,756] | 144,698 [30,443–258,952] | 15,226 [8,511–21,941] | $0.0059 [$0.0025–$0.0094] | 23.5 s [12.0 s–35.1 s] |
| sigmap-src/h020 | with | 2/2 | 2 [1–3] | 5 [4–6] | 642 [547–736] | 28,550 [20,832–36,267] | 5,972 [5,009–6,934] | $0.0018 [$0.0015–$0.0021] | 8.9 s [8.1 s–9.7 s] |
| sigmap-src/h021 | without | 2/2 | 9 [8–9] | 15 [14–16] | 2,562 [2,511–2,613] | 108,155 [106,456–109,854] | 13,649 [11,659–15,638] | $0.0051 [$0.0047–$0.0054] | 20.9 s [19.9 s–22.0 s] |
| sigmap-src/h021 | with | 2/2 | 8 [7–8] | 13 [12–14] | 2,183 [2,026–2,339] | 110,915 [102,676–119,154] | 13,972 [13,238–14,706] | $0.0050 [$0.0050–$0.0050] | 19.6 s [18.9 s–20.2 s] |
| sigmap-src/h022 | without | 2/2 | 4 [3–4] | 8 [6–10] | 1,011 [832–1,189] | 39,616 [27,772–51,459] | 7,737 [7,317–8,156] | $0.0024 [$0.0022–$0.0027] | 11.2 s [9.6 s–12.8 s] |
| sigmap-src/h022 | with | 2/2 | 5 [3–6] | 7 [6–8] | 1,108 [950–1,266] | 46,209 [40,556–51,861] | 9,722 [7,516–11,927] | $0.0030 [$0.0027–$0.0033] | 10.7 s [10.2 s–11.1 s] |
| sigmap-src/h023 | without | 2/2 | 7 [4–10] | 12 [8–16] | 2,194 [1,298–3,089] | 86,024 [41,814–130,234] | 16,224 [8,701–23,747] | $0.0052 [$0.0028–$0.0076] | 18.5 s [14.0 s–23.1 s] |
| sigmap-src/h023 | with | 2/2 | 2 [1–2] | 5 [4–6] | 624 [478–770] | 28,166 [21,468–34,863] | 5,739 [4,771–6,707] | $0.0017 [$0.0014–$0.0021] | 8.9 s [7.9 s–9.9 s] |

