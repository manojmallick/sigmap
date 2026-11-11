# Agent-level A/B — measured tool calls, tokens and cost

**anthropic-messages-api direct Messages API · claude-haiku-4-5 · 2026-11-11 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap ranked the question BEFORE the first turn (what a prompt hook would inject): the five likeliest files with their signatures and line anchors after the question in the user turn, + the sigmap CLI; no MCP server, no standing section, no extra tool call.
- Both arms: the same prompt, model, tool allowlist (Read, Grep, Glob, Bash), per-run budget cap $0.25 and timeout 420 s; run in a clean copy of the commit pinned in `benchmarks/xrepo-repos.json`.
- Questions: the task id(s) x027, x028, x029, x030, x031 of `benchmarks/tasks/retrieval-xrepo.jsonl`. Pass = hit@5 on the repository-relative paths the answer names.
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
| django | 5 | 10/10 | 10/10 | 0 / 0 |
| all | 5 | 10/10 | 10/10 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 5. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −43% | −44% | fewer in every repetition |
| Input tokens (uncached) | −31% | −39% | fewer in every repetition |
| Output tokens | −35% | −33% | fewer in every repetition |
| Cache-read tokens | −65% | −61% | fewer in every repetition |
| Cache-write tokens | −52% | −40% | fewer in every repetition |
| Total tokens (derived) | −63% | −58% | fewer in every repetition |
| Cost | −51% | −45% | fewer in every repetition |
| Wall time | −29% | −34% | fewer in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −56% [−73%, −28%] | −55% [−80%, −23%] | fewer in every repetition, outside the noise |
| Input tokens (uncached) | −18% [−59%, +57%] † | −20% [−75%, +157%] † | fewer in every repetition, within the noise |
| Output tokens | −46% [−65%, −22%] | −39% [−62%, −14%] | fewer in every repetition, outside the noise |
| Cache-read tokens | −76% [−86%, −55%] n=4 | −72% [−89%, −35%] | fewer in every repetition, outside the noise |
| Cache-write tokens | −52% [−67%, −35%] | −44% [−60%, −22%] | fewer in every repetition, outside the noise |
| Total tokens (derived) | −75% [−85%, −59%] | −65% [−82%, −32%] | fewer in every repetition, outside the noise |
| Cost | −55% [−65%, −41%] | −48% [−66%, −24%] | fewer in every repetition, outside the noise |
| Wall time | −39% [−59%, −16%] | −39% [−62%, −15%] | fewer in every repetition, outside the noise |

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
| django | 17 | 6 | −7 | 4 / 0 / 1 |
| all | 17 | 6 | −7 | 4 / 0 / 1 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | 7,878 | 4,717 | −2,274 | 3 / 0 / 2 |
| all | 7,878 | 4,717 | −2,274 | 3 / 0 / 2 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | 1,709 | 1,025 | −739 | 5 / 0 / 0 |
| all | 1,709 | 1,025 | −739 | 5 / 0 / 0 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | 125,195 | 56,095 | −96,104 | 5 / 0 / 0 |
| all | 125,195 | 56,095 | −96,104 | 5 / 0 / 0 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | 20,131 | 8,495 | −6,999 | 5 / 0 / 0 |
| all | 20,131 | 8,495 | −6,999 | 5 / 0 / 0 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | 152,124 | 73,695 | −98,998 | 5 / 0 / 0 |
| all | 152,124 | 73,695 | −98,998 | 5 / 0 / 0 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd), or computed from the API's usage and a price table when the run went through the Messages API directly. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | $0.0541 | $0.0298 | −$0.0232 | 5 / 0 / 0 |
| all | $0.0541 | $0.0298 | −$0.0232 | 5 / 0 / 0 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| django | 21.1 s | 13.1 s | −8.3 s | 5 / 0 / 0 |
| all | 21.1 s | 13.1 s | −8.3 s | 5 / 0 / 0 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| django | $0.5813 (10 runs) | $0.3014 (10 runs) | none | none |
| all | $0.5813 (10 runs) | $0.3014 (10 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| django/x027 | without | 2/2 | 23 [22–23] | 2,983 [2,361–3,604] | 2,645 [2,412–2,877] | 296,153 [187,463–404,843] | 20,131 [15,590–24,671] | $0.0710 [$0.0539–$0.0881] | 31.3 s [27.1 s–35.5 s] |
| django/x027 | with | 2/2 | 23 [21–25] | 4,717 [2,869–6,565] | 2,564 [2,379–2,749] | 200,049 [146,084–254,014] | 15,583 [14,209–16,956] | $0.0570 [$0.0508–$0.0632] | 31.3 s [26.5 s–36.1 s] |
| django/x028 | without | 2/2 | 12 [9–14] | 7,878 [5,111–10,644] | 1,364 [1,190–1,538] | 58,632 [53,565–63,699] | 11,879 [9,661–14,096] | $0.0354 [$0.0340–$0.0368] | 16.2 s [14.4 s–18.0 s] |
| django/x028 | with | 2/2 | 5 [3–6] | 5,604 [5,468–5,740] | 626 [369–882] | 7,125 [0–14,250] | 4,880 [4,276–5,483] | $0.0155 [$0.0129–$0.0182] | 7.8 s [5.5 s–10.2 s] |
| django/x029 | without | 2/2 | 12 [12–12] | 11,268 [10,871–11,664] | 1,475 [1,473–1,477] | 100,135 [100,090–100,179] | 20,338 [19,187–21,488] | $0.0541 [$0.0523–$0.0559] | 18.2 s [18.2 s–18.2 s] |
| django/x029 | with | 2/2 | 6 [6–6] | 2,399 [2,396–2,402] | 1,025 [988–1,061] | 56,095 [28,068–84,122] | 14,232 [9,240–19,224] | $0.0309 [$0.0217–$0.0401] | 13.1 s [12.4 s–13.9 s] |
| django/x030 | without | 2/2 | 17 [13–20] | 9,629 [2,334–16,923] | 1,709 [1,385–2,032] | 125,195 [94,896–155,494] | 15,592 [12,487–18,696] | $0.0502 [$0.0344–$0.0660] | 21.1 s [17.3 s–24.9 s] |
| django/x030 | with | 2/2 | 3 [2–4] | 2,488 [2,484–2,491] | 635 [509–761] | 11,672 [7,354–15,989] | 8,495 [8,056–8,933] | $0.0174 [$0.0158–$0.0191] | 8.6 s [6.3 s–10.8 s] |
| django/x031 | without | 2/2 | 23 [20–25] | 1,883 [1,176–2,590] | 2,320 [2,135–2,505] | 324,818 [285,664–363,972] | 27,213 [24,355–30,071] | $0.0800 [$0.0794–$0.0805] | 27.1 s [24.2 s–29.9 s] |
| django/x031 | with | 2/2 | 12 [9–14] | 6,484 [6,348–6,620] | 1,426 [1,213–1,638] | 57,444 [34,444–80,443] | 8,342 [7,148–9,536] | $0.0298 [$0.0248–$0.0348] | 17.1 s [15.1 s–19.1 s] |

