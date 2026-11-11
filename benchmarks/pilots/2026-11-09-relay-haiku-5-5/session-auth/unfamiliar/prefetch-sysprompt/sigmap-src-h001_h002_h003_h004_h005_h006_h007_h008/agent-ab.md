# Agent-level A/B — measured tool calls, tokens and cost

**claude-code 2.1.322 (Claude Code) · claude-haiku-5-5 · 2026-11-10 · 2 runs per arm · NOT PUBLISHABLE — 2 runs per arm (the minimum is 4)**

- Arms: **without** = no SigMap; **with** = SigMap ranked the question BEFORE the first turn (what a prompt hook would inject): the five likeliest files with their signatures and line anchors in the prompt, + the sigmap CLI; no MCP server, no standing section, no extra tool call.
- Both arms: the same prompt, model, tool allowlist (Read, Grep, Glob, Bash), per-run budget cap $0.6 and timeout 420 s; run in a clean copy of the commit pinned in `benchmarks/xrepo-repos.json`.
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
- Run on the logged-in session (--session-auth), not an API key and not under --bare: the agent carries a prompt prefix about 40k tokens larger in both arms (cached), the cost figures are real Anthropic prices with real caching, and the usage counts against that account's plan.

## Outcome

| repo | tasks | pass without | pass with | failed runs (without / with) |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 8 | 11/16 | 12/16 | 0 / 0 |
| all | 8 | 11/16 | 12/16 | 0 / 0 |

## Repetitions — workload total vs typical task

Each repetition (R1, R2) is one pass over every task in both arms. A task counts in a repetition only when both arms completed it and reported the metric; `n=` marks fewer than all 8. A change is the SigMap arm against the no-SigMap arm: negative means SigMap used less. The repetitions reuse the same tasks, so they measure consistency, not generalisation.

### Workload total

Σ with ÷ Σ without − 1 over the paired tasks: the closest view to the bill for this exact batch, and the largest tasks dominate it.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −42% | −5% | fewer in every repetition |
| Input tokens (uncached) | −31% | −8% | fewer in every repetition |
| Output tokens | −13% | 0% | mixed |
| Cache-read tokens | −40% | +13% | mixed |
| Cache-write tokens | −2% | −24% | fewer in every repetition |
| Total tokens (derived) | −34% | +7% | mixed |
| Cost | −11% | −12% | fewer in every repetition |
| Wall time | −13% | 0% | fewer in every repetition |

### Typical task

The geometric mean of with ÷ without on each paired task, so every task has equal weight, with a 95% paired-bootstrap interval (10,000 resamples, seed 1). † = the interval includes zero: inside the noise. A pair with a 0 on either side has no ratio and is left out.

| metric | R1 | R2 | verdict |
| --- | ---: | ---: | ---: |
| Tool calls | −45% [−63%, −12%] | −2% [−41%, +64%] † n=7 | fewer in every repetition, within the noise |
| Input tokens (uncached) | −34% [−48%, −19%] | −22% [−50%, +21%] † | fewer in every repetition, within the noise |
| Output tokens | −25% [−49%, +21%] † | −10% [−39%, +40%] † | fewer in every repetition, within the noise |
| Cache-read tokens | −42% [−58%, −20%] | −10% [−47%, +58%] † | fewer in every repetition, within the noise |
| Cache-write tokens | +5% [−19%, +48%] † | −25% [−47%, +6%] † | mixed |
| Total tokens (derived) | −33% [−49%, −8%] | −11% [−45%, +48%] † | fewer in every repetition, within the noise |
| Cost | −7% [−27%, +31%] † | −17% [−41%, +20%] † | fewer in every repetition, within the noise |
| Wall time | −18% [−34%, +10%] † | −9% [−33%, +27%] † | fewer in every repetition, within the noise |

### Outcome (hit@5), by repetition

Per paired task: **better** = the SigMap arm named the file and the other did not; **worse** = the reverse; **tie** = both found it or both missed. Localisation only.

| repetition | paired tasks | better | worse | tie |
| --- | ---: | ---: | ---: | ---: |
| R1 | 8 | 0 | 0 | 8 |
| R2 | 8 | 1 | 0 | 7 |
| all | 16 | 1 | 0 | 15 |

## Tool calls

Provenance: agent-reported (main-thread tool_use blocks). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 5 | 4 | −3 | 5 / 0 / 3 |
| all | 5 | 4 | −3 | 5 / 0 / 3 |

## Input tokens (uncached)

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 9 | 7 | −2 | 5 / 1 / 2 |
| all | 9 | 7 | −2 | 5 / 1 / 2 |

## Output tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 1,534 | 1,198 | −350 | 6 / 0 / 2 |
| all | 1,534 | 1,198 | −350 | 6 / 0 / 2 |

## Cache-read tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 48,895 | 39,357 | −15,108 | 5 / 0 / 3 |
| all | 48,895 | 39,357 | −15,108 | 5 / 0 / 3 |

## Cache-write tokens

Provenance: agent-reported. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 9,816 | 8,764 | −1,052 | 6 / 0 / 2 |
| all | 9,816 | 8,764 | −1,052 | 6 / 0 / 2 |

## Total tokens (derived)

Provenance: derived: input + output + cache-read + cache-write, each agent-reported; unweighted, so a cache read counts like a fresh token — Cost is the priced view. Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 61,198 | 48,834 | −19,495 | 5 / 0 / 3 |
| all | 61,198 | 48,834 | −19,495 | 5 / 0 / 3 |

## Cost

Provenance: agent-reported (the agent's own total_cost_usd). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | $0.0033 | $0.0027 | −$0.0008 | 6 / 0 / 2 |
| all | $0.0033 | $0.0027 | −$0.0008 | 6 / 0 / 2 |

## Wall time

Provenance: measured (wall clock of the agent process). Median per task, then median over tasks.

| repo | without | with | Δ median | tasks fewer / tie / more |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | 14.5 s | 12.2 s | −2.5 s | 6 / 0 / 2 |
| all | 14.5 s | 12.2 s | −2.5 s | 6 / 0 / 2 |

## Spend

Provenance: agent-reported (the agent's own `total_cost_usd`), or the table floor (as of 2026-10-04: uncached input only) for a run that reported none. Every run counts, completed or not — the medians above leave a failed run out, this does not — and the classes are never added together.

| repo | without | with | of which failed runs, without | of which failed runs, with |
| --- | ---: | ---: | ---: | ---: |
| sigmap-src | $0.0588 (16 runs) | $0.0521 (16 runs) | none | none |
| all | $0.0588 (16 runs) | $0.0521 (16 runs) | none | none |

## Per task

Each figure is `median [min–max]` over the runs that completed and reported it; `n=` marks a shortfall.

| task | arm | pass | tool calls | input | output | cache read | cache write | cost | time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| sigmap-src/h001 | without | 2/2 | 5 [5–5] | 10 [10–10] | 1,476 [1,417–1,535] | 54,707 [54,698–54,715] | 9,376 [9,069–9,683] | $0.0032 [$0.0031–$0.0033] | 14.6 s [14.1 s–15.2 s] |
| sigmap-src/h001 | with | 2/2 | 6 [4–7] | 9 [8–10] | 1,335 [1,297–1,373] | 56,665 [45,996–67,333] | 10,280 [8,881–11,679] | $0.0033 [$0.0031–$0.0034] | 13.2 s [12.7 s–13.7 s] |
| sigmap-src/h002 | without | 0/2 | 13 [8–17] | 15 [12–18] | 4,363 [4,017–4,709] | 137,709 [75,230–200,188] | 22,398 [17,942–26,853] | $0.0080 [$0.0064–$0.0097] | 28.6 s [25.9 s–31.4 s] |
| sigmap-src/h002 | with | 0/2 | 10 [9–10] | 16 [16–16] | 4,618 [4,331–4,904] | 121,310 [117,933–124,686] | 14,560 [11,391–17,729] | $0.0064 [$0.0057–$0.0072] | 31.4 s [31.3 s–31.5 s] |
| sigmap-src/h003 | without | 1/2 | 4 [3–4] | 7 [6–8] | 1,143 [882–1,403] | 33,615 [28,011–39,219] | 8,584 [6,860–10,308] | $0.0026 [$0.0022–$0.0030] | 12.4 s [12.1 s–12.6 s] |
| sigmap-src/h003 | with | 2/2 | 2 [1–2] | 4 [4–4] | 630 [567–693] | 19,798 [17,232–22,364] | 7,909 [6,266–9,552] | $0.0021 [$0.0018–$0.0024] | 8.8 s [8.7 s–8.8 s] |
| sigmap-src/h004 | without | 2/2 | 5 [4–6] | 9 [8–10] | 1,628 [1,497–1,758] | 47,558 [41,915–53,201] | 11,405 [10,850–11,960] | $0.0036 [$0.0033–$0.0038] | 14.4 s [12.9 s–15.8 s] |
| sigmap-src/h004 | with | 2/2 | 6 [4–7] | 9 [6–12] | 1,433 [1,105–1,761] | 51,389 [28,570–74,207] | 7,958 [6,649–9,267] | $0.0028 [$0.0027–$0.0030] | 13.9 s [10.8 s–17.0 s] |
| sigmap-src/h005 | without | 2/2 | 5 [2–7] | 8 [6–10] | 1,323 [1,073–1,572] | 43,047 [28,354–57,739] | 11,495 [9,891–13,098] | $0.0034 [$0.0028–$0.0040] | 12.6 s [11.1 s–14.1 s] |
| sigmap-src/h005 | with | 2/2 | 1 [0–2] | 3 [2–4] | 817 [722–911] | 12,921 [9,163–16,678] | 6,315 [2,948–9,681] | $0.0018 [$0.0010–$0.0026] | 8.2 s [7.3 s–9.0 s] |
| sigmap-src/h006 | without | 2/2 | 6 [5–7] | 9 [8–10] | 1,592 [1,568–1,615] | 50,232 [42,923–57,540] | 9,964 [9,616–10,311] | $0.0033 [$0.0033–$0.0033] | 15.8 s [15.5 s–16.0 s] |
| sigmap-src/h006 | with | 2/2 | 3 [3–3] | 5 [4–6] | 618 [607–629] | 27,326 [22,516–32,136] | 8,931 [6,924–10,937] | $0.0024 [$0.0019–$0.0028] | 8.5 s [7.2 s–9.8 s] |
| sigmap-src/h007 | without | 0/2 | 2 [2–2] | 6 [6–6] | 910 [888–931] | 27,159 [27,125–27,192] | 5,472 [5,424–5,519] | $0.0018 [$0.0018–$0.0018] | 10.9 s [10.9 s–10.9 s] |
| sigmap-src/h007 | with | 0/2 | 5 [4–6] | 9 [6–12] | 2,890 [2,722–3,058] | 63,593 [34,243–92,943] | 13,296 [10,390–16,202] | $0.0047 [$0.0045–$0.0049] | 22.7 s [21.4 s–24.0 s] |
| sigmap-src/h008 | without | 2/2 | 7 [6–8] | 11 [10–12] | 1,905 [1,612–2,198] | 62,230 [52,754–71,705] | 9,669 [8,469–10,868] | $0.0035 [$0.0030–$0.0040] | 17.2 s [15.9 s–18.5 s] |
| sigmap-src/h008 | with | 2/2 | 3 [2–3] | 5 [4–6] | 1,060 [919–1,201] | 26,015 [15,949–36,080] | 8,598 [8,255–8,940] | $0.0025 [$0.0024–$0.0026] | 11.1 s [9.4 s–12.8 s] |

