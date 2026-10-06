---
title: CLI reference
description: Complete SigMap CLI reference. All commands and flags with examples — ask, ask --with-source, evidence, deps, sbom, budget, redact, tune, skills, squeeze, conventions, plan, bench, judge, verify, verify-ai-output, verify-plan, review-pr, create, memory, lines, note, status, doctor, validate, roots, daemon, history, --package, --global, --ci, --cost, --coverage, --watch, --diff, --callers, --callees, --explain, --mcp, --report, --health, --dashboard, weights --export/--import and more.
head:
  - - meta
    - property: og:title
      content: "SigMap CLI Reference — every command and flag with examples"
  - - meta
    - property: og:description
      content: "All 115 SigMap commands and flags documented with examples. ask, ask --with-source, evidence, deps, sbom, gain, budget, redact, squeeze, conventions, scaffold, plan, bench, judge, verify, verify-ai-output, verify-plan, review-pr, create, note, status, doctor, validate, roots, daemon, history, --ci, --cost, --coverage, --watch, --diff, --callers, --callees, --explain, --mcp, --report, --health, --dashboard, weights --export/--import and more."
  - - meta
    - property: og:url
      content: "https://sigmap.io/guide/cli"
  - - meta
    - property: og:type
      content: article
  - - meta
    - name: twitter:title
      content: "SigMap CLI Reference — every command and flag with examples"
  - - meta
    - name: twitter:description
      content: "All 115 SigMap commands and flags documented with examples. ask, evidence, deps, sbom, gain, budget, redact, squeeze, conventions, scaffold, plan, bench, judge, verify, verify-ai-output, verify-plan, review-pr, create, note, status, doctor, validate, daemon, history, --ci, --cost, --coverage, --watch, --diff, --callers, --callees, --explain, --mcp, --report, --health, --dashboard, weights --export/--import and more."
  - - meta
    - name: twitter:image:alt
      content: "SigMap CLI Reference"
  - - meta
    - name: keywords
      content: "sigmap cli, sigmap ask, sigmap evidence, sigmap deps, sigmap sbom, sigmap judge, sigmap validate, sigmap history, sigmap --ci, sigmap --cost, sigmap flags, command line reference"
---
# CLI reference

All commands and flags accepted by `sigmap` (or `node gen-context.js`).

If you are new to the product, start with the workflow pages first:

- [ask](/guide/ask)
- [validate](/guide/validate)
- [judge](/guide/judge)
- [learning](/guide/learning)
- [compare](/guide/compare)

## Daily workflow

| Command / Flag | Description |
|----------------|-------------|
| `ask "<query>"` | Unified intent→rank→cost→risk pipeline in one command |
| `ask "<query>" --top <n>` | How many files to select (default 5) |
| `ask "<query>" --explain` | Diagnose a miss: which query tokens matched, every signal behind each file, why a file was demoted, and the near misses |
| `ask "<query>" --with-source` | Add the top symbols' **bodies** (sliced from their line anchors) plus a blast-radius list — budgeted, opt-in |
| `ask "<query>" --source-budget <n>` | Token ceiling for `--with-source` bodies (default: `maxTokens` minus what the signatures spent) |
| `ask "<query>" --followup` | Reuse previous session context for follow-up queries (session carry-forward) |
| `ask "<query>" --package <name>` | Scope retrieval to a specific monorepo workspace package |
| `ask "<query>" --global` | Disable package scoping; search entire repo (monorepo override) |
| `ask "<query>" --mode index` | Surgical Context: emit symbol-header pointers (`symbol :start-end`) only — no bodies; fetch on demand via `get_lines` |
| `ask "<query>" --since <ref>` | Delta context: restrict ranked output to files changed since a git ref |
| `ask "<query>" --squeeze` | Auto-accept input minimization (no prompt) — for scripts/CI |
| `ask "<query>" --no-squeeze` | Disable input minimization entirely |
| `ask "<query>" --squeeze-threshold <n>` | Minimum reduction %% to prompt for minimization (default 30) |
| `evidence "<query>"` | Build a deterministic **Evidence Pack** (JSON, schema v2) — a machine-consumable signature+evidence map; writes `.context/evidence-pack.json` |
| `evidence "<query>" --markdown` | Emit the Markdown handoff rendering to stdout (alias `--md`) |
| `evidence "<query>" --top <n> --budget <n> --out <path>` | Tune ranked files / token budget / write the rendered output to a path |
| `deps` | List declared dependencies across every package manifest at the repo root (`--json`, `--runtime`) |
| `sbom` | Emit a deterministic **CycloneDX 1.5** SBOM on stdout (`--out <path>`, `--exact-only`, `--no-dev`) |
| `squeeze <file\|->` | Minimize a pasted stacktrace / CI-log / JSON blob (`--json` for stats) |
| `squeeze --response <file\|->` | Minimize an agent/tool response explicitly (same engine; also the `squeeze_output` MCP tool) |
| `conventions` | Extract & report a repo's coding conventions — file naming, export style, test framework (TS/JS/Python); writes `.context/conventions.json` (`--json` for machine output) |
| `conventions --conflicts` | Breakdown of every mixed convention (counts, bars, example files) + rename suggestions toward the dominant style |
| `conventions --inject` | Write/update the auto-detected conventions block in `CLAUDE.md` (idempotent, marker-scoped) so agents see the house style |
| `conventions --report` | Consistency audit — per-convention + overall score with a trend vs the last run (`--json`) |
| `conventions --ci` | CI gate — fail when overall consistency < `--min` (default 0.70); `--no-regress` blocks drops vs the last run |
| `conventions --fix` | Exhaustive rename checklist — every file not matching the dominant naming style, full from→to paths (`--json`) |
| `conventions --update` | Incremental rescan — refresh `.context/conventions.json` only when source files changed (else "up to date") |
| `scaffold <name>` | Propose a convention-matched structure (filename, export style, test file) for a new module — refuses below the confidence floor |
| `plan "<goal>"` | Plan a change — files to read first, files likely to change (with score and reason), impact radius, covering tests |
| `judge [--response <f>\|-] [--context <f>]` | Rule-based groundedness scoring for LLM responses (stdin ok; `--context` defaults to the generated one) |
| `verify-plan <plan.md>` | Check a plan against the live index before execution — referenced files/symbols exist, blast radius, scope; `Creates:` / `--creates` marks names the plan introduces (`--json`; stdin via `-`) |
| `verify <answer.md>` | **Flagship** grounding guard — flag fake files, test files, imports, symbols, and npm scripts in an AI answer (deterministic, offline). Short alias of `verify-ai-output` |
| `verify-ai-output <answer.md>` | Full command name for `verify` — identical behaviour, flags, and exit codes |
| `verify <answer.md> --report [out.html]` | Write a standalone red/amber/green HTML report of the findings |
| `review-pr [--base <ref>\|--staged]` | Audit a diff — scope drift, god-node edits, missing tests, security-sensitive files (`--json`; exits 1 on findings) |
| `review-pr --markdown` | **PR Evidence Report** — branded Markdown (signatures + blast radius + tests to run + risk labels) to post as a PR comment; CI-gateable |
| `create "<task>"` | Orchestrate the 4-stage grounded-creation pipeline (scaffold → verify-plan → verify-ai-output → review-pr) with `n/4` numbering; exits `2` when no stage had its input (`--creates`, `--json`) |
| `validate` | Validate config and coverage; optional query symbol check |
| `learn` | Boost, penalize, or reset learned file ranking weights |
| `weights` | Show learned file multipliers or emit them as JSON |
| `weights --export [file]` | Write learned weights JSON to file or stdout for team sharing |
| `weights --import <file>` | Merge or replace local weights from a portable JSON file |
| `bench --submit` | Format local + canonical benchmark results as a shareable community block |
| `compare` | Retrieval benchmark vs baseline in the source checkout; local history elsewhere |
| `share` | Print shareable one-liner with live benchmark numbers |

## Team, CI, and observability

| Command / Flag | Description |
|----------------|-------------|
| `roots [--explain | --json | --fix]` | Auto-detect source roots for 17 languages and 50+ frameworks; shows confidence and scoring |
| `tune [--apply | --json]` | Recommend config from repo detection — srcDirs pin, monorepo, adapters, exclude, budget — one reason per change; `--apply` writes |
| `skills list` | List skill clients (Claude/Cursor/Windsurf/Copilot/AGENTS.md) with presence and install state (`--json`) |
| `skills install [--client <name> \| --all]` | Install the SigMap agent playbooks in each client's native skill/rules format, including the invokable `sigmap-task` loop; plain `install` wires only detected clients |
| `history` | Show usage log + benchmark trend sparklines (hit@5, token reduction) |
| `lines <file> <start>-<end>` | Print an exact line range — the CLI twin of the `get_lines` MCP tool; `:<line> --context <n>` for an anchor window |
| `note "<text>"` | Append a note to the cross-session decision log (`note` alone lists recent) |
| `status` | Repo state — branch, dirty files, index freshness, notes |
| `doctor` | Diagnose config, index, freshness, coverage, the model profile, and MCP wiring — with a fix per issue (`--json`; exits 1 on hard failure) |
| `wiki` | Deterministic architecture narrative → `.context/WIKI.md` — modules, hubs, entry points, conventions, health; no LLM (`--json`, `--out`) |
| `mcp list` | List supported MCP clients and their config paths (`--json`) |
| `mcp install <client>` | Wire MCP for one client — `claude`/`cursor`/`windsurf`/`vscode`/`zed`/`codex`/`gemini`/`opencode`/`mcp`; creates the config if absent; `--global` for user-level |
| `learn` | Boost, penalize, or reset learned file ranking weights |
| `weights` | Show learned file multipliers or emit them as JSON |
| `suggest-profile` | Auto-detect context profile from git state |
| `explain <file>` | Why a file is included or excluded from context |
| `sync` | Write all adapter outputs + llm.txt + llms.txt |
| `run` | Alias for a bare generate (`sigmap run --report`, etc.) |
| `--watch` | Watch for file changes and regenerate incrementally |
| `daemon start\|stop\|status` | Run `--watch` as a detached background daemon (PID + log in `.context/`) |
| `--setup` | Auto-wire MCP for Claude, Cursor, Windsurf, Zed, VS Code, OpenCode, Gemini CLI, Codex CLI; install git hook; start watcher |
| `--diff` | Changed files: working tree vs HEAD (shows risk score per file) |
| `--diff <ref>` | Changed files: working tree vs `<ref>` — includes uncommitted work |
| `--diff --staged` | Changed files: index vs HEAD (staged only) |
| `--mcp` | Start the stdio MCP server |
| `--query <text>` | Rank files by relevance to a free-text query (identifier-aware BM25 + signals) |
| `--query <text> --explain` | Per-file score signals, per-token corpus coverage and near-miss candidates |
| `--output <file>` | Write context to a custom path (persisted to config) |
| `--cost [--model <name>]` | Per-model token/dollar cost comparison |
| `--coverage` | Enable test coverage annotation (✓/✗ per function) without editing config |
| `--ci [--min-coverage N]` | CI exit gate — exits 1 when `indexed` coverage < threshold (default 80); same measurement as `validate` |
| `--ci --json` | Gate verdict as JSON `{pass, coverage, threshold}` |
| `--analyze` | Per-file breakdown of signatures, tokens, and extractor |
| `--report` | Token reduction + coverage score + module heatmap + per-model cache fit-check |
| `--report --json` | Machine-readable JSON report with coverage object and `cacheFit` |
| `--report --paper` | LaTeX/markdown tables for academic export |
| `--health` | Composite 0–100 health score + coverage grade |
| `--health --json` | Machine-readable health output with coverage fields |
| `--dashboard [--out <path>]` | Self-contained HTML health dashboard → `.context/dashboard.html` (`--json`) |
| `--monorepo` | Generate a separate context section per package |
| `--each` | Run a command in each monorepo package |
| `--routing` | Regenerate with model routing hints embedded in the output |
| `--terse` | Deterministic terse signature encoding — measured −16.1% sig tokens; line anchors preserved |
| `--format cache` | Wrap output in Anthropic cache_control breakpoints |
| `--track` | Log each run to `.context/usage.ndjson` |
| `gain` | Token-savings dashboard — tokens saved, %, est. $, latency, by-operation |
| `gain --all` | Add daily / weekly / monthly trend tables |
| `gain --json` | Aggregate savings as JSON |
| `gain --since <7d\|ISO>` | Window filter (`7d`, `30d`, `12h`, or ISO date) |
| `gain --top <n> \| --model <name>` | Limit rows / set the $ pricing model (an unknown name is priced as the default and **says so** on stderr) |
| `gain --models` | List the accepted model names, their per-MTok input rates, and the date of the profile they come from |
| `gain --reset` | Clear the local savings log (`.context/gain.ndjson`) |
| `--no-track` | Disable gain savings capture for a run |
| `--init` | Scaffold `gen-context.config.json` and `.contextignore`; inject a "Creation workflow" block into `CLAUDE.md` |
| `--benchmark` | Run retrieval evaluation tasks |
| `--impact <file>` | Trace every file that transitively imports the given file |
| `--callers <symbol>` | Method-level blast radius — every function that transitively calls `<symbol>`; reported as a **lower bound** naming the scope searched |
| `--callees <symbol>` | Every repo function that `<symbol>` transitively calls |
| `--suggest-tool <task>` | Classify a task into fast / balanced / powerful model tier, naming models from the dated profile (or your roster) |
| `--version` | Print version and exit |
| `--help` | Print help and exit |

---

## ask

Unified pipeline: intent detection → ranked mini-context → coverage check → cost estimate → risk level, all in one command. The identifier-aware BM25 ranker also **expands common code-domain synonyms/abbreviations** in your query (v8.5.0) — so `authentication` can surface a file whose signatures only say `auth` (and `database`↔`db`, `context`↔`ctx`, …); exact matches still rank first. Deterministic, applies to `--query` and MCP `query_context` too.

```bash
sigmap ask "fix the login bug"
sigmap ask "explain the rank function" --json
sigmap ask "how are secrets redacted" --top 12
```

```
────────────────────────────────────────────
 sigmap ask  "fix the login bug"
 Intent    : debug
 Context   : 1,823 tokens  →  .context/query-context.md
 Selected  : 5 of 441 file(s) (--top 5) · cutoff score 6.121
 Hash      : sha256:66de57f5b3a8
 Selection : 4 source, 1 support (test)
 Coverage  : readable 97% (428/441 files in srcDirs)
 Risk      : LOW (2 file(s) changed vs HEAD)
 Cost      : $0.0005/query  (was $0.032 · saved 98%)
────────────────────────────────────────────
```

With `--json` the output is a machine-readable object. The core keys are `intent`, `coverage`, `riskLevel`, `contextTokens`, `contextPath`, `contextHash` and `rankedFiles` — the ranked selection as `[{ rank, file, score, tokens }]`, in rank order, so the file list is readable without re-parsing the written context. Cost is reported as `costBefore`, `costAfter` and `savingsPct` rather than a single `cost` field, because a saving needs both sides of the comparison to mean anything. The rate behind them is named by `pricedModel` and dated by `priceAsOf` (the [model profile](/guide/config#models) date), and `tokenBasis` says whether the cost rests on the chars/4 estimate or on a `models.charsPerToken` factor you configured.

```json
"rankedFiles": [
  { "rank": 1, "file": "src/graph/blast-radius.js", "score": 11.928, "tokens": 192 },
  { "rank": 2, "file": "src/graph/impact.js",       "score": 11.056, "tokens": 260 },
  { "rank": 3, "file": "src/util/git.js",           "score": 9.674,  "tokens": 168 }
]
```

`sigs` are deliberately absent: the same run already wrote them to the context file at `contextPath`, so repeating them would double the payload for no new information. The last row's score **is** `cutoffScore` — both are rounded the same way, so a row and the cutoff compare as equals rather than differing in the fourth decimal.

::: warning Two of these keys did not exist until v8.61.1
This sentence promised `cost` and `rankedFiles` from before v8.54.2, and neither key was ever emitted — a consumer written against the documented contract got `undefined` twice ([#662](https://github.com/manojmallick/sigmap/issues/662)). `rankedFiles` had no implementation anywhere; `--query --json` calls its own array `results`.

[#661](https://github.com/manojmallick/sigmap/issues/661) already guarded that every dispatchable *command* appears in `--help`, and [#817](https://github.com/manojmallick/sigmap/issues/817) did the same at *flag* level in v8.61.2 — neither covered **output keys**, which is how this survived several releases. Every documented `--json` key is now read out of this page and pinned against the command's real output, for `ask`, `--callers` and `judge`.
:::

### Every figure names its basis (v8.61.0)

Three of those lines used to be bare numbers, and two of them read as a trust signal they could not support (#806). On a fresh `gin` clone `ask` reported **`Coverage : 100%`** and **`Risk : NONE`** over five selected files that were a test, a README, a CI workflow and two unrelated sources — with not one of `gin.go`, `routergroup.go` or `tree.go` among them.

Neither reading was a lie on its own:

- **Coverage** is fed every file the scan found, so it measures how much of `srcDirs` is **readable** — 100% in any healthy repo, whatever the query returned. It was never "did I find the right files".
- **Risk** counts files changed in the working tree versus `HEAD`, which on a clean checkout is legitimately zero.

Printed bare, side by side, directly under the answer, the pair reads as *"this answer is trustworthy"*. The [#762](https://github.com/manojmallick/sigmap/issues/762) precedent applies — the defect is the missing population, not the number — so each figure now names what it counted, and a third line names what neither of them ever asked:

| Line | Reads | Means |
|------|-------|-------|
| `Selection` | `4 source, 1 support (test)` | How many selected files carry implementation an answer can stand on |
| `Coverage` | `readable 97% (428/441 files in srcDirs)` | Share of `srcDirs` that is readable — **not** retrieval accuracy |
| `Risk` | `LOW (2 file(s) changed vs HEAD)` | Working-tree churn, with the count it was derived from |

When the probe cannot run at all — outside a git repo, or with `git` unavailable — `Risk` reads `not assessed (no git repo, or git unavailable)` rather than printing a reassuring level anyway. And when the selection contains **no implementation at all** (only tests, docs, CI and config), that is a strong signal the query missed, so it says so on stderr:

```
[sigmap] ⚠  no source file in the selection — 0 source, 4 support (test, docs, ci, config);
            the query likely missed. Re-run with --explain to see which tokens matched, or raise --top
```

`--json` carries the basis of every figure alongside it — `coveragePopulation`, `coverageIncluded`, `coverageTotal`, `coverageBasis`, `riskAssessed`, `riskChangedFiles`, `riskBasis`, `sourceFiles`, `supportFiles`, `sourceFree` — so a machine consumer cannot read `coverage` as retrieval accuracy either. Every pre-existing key is unchanged.

### The index can be stale, and now it says so (v8.61.0)

Index freshness is yours to manage, and [`judge`](#judge) has warned since v8.54.2 when the context it scores against is older than the sources it describes ([#780](https://github.com/manojmallick/sigmap/issues/780)). `ask` and the MCP read tools answered from that same ground **in silence**, so a stale answer was byte-indistinguishable from a fresh one ([#815](https://github.com/manojmallick/sigmap/issues/815)):

```
[sigmap] ⚠  context is 11.8 hour(s) older than src/mcp/handlers.js —
            this answer is ranked against stale ground; re-run `sigmap` to refresh the index
```

The same banner leads the `read_context`, `search_signatures` and `query_context` MCP results. All four surfaces call one shared module, so "stale" has a single definition rather than one per surface — the threshold and the gap wording are fixed, and only the consequence clause differs, because what a stale index does to a *verdict* is not what it does to a *ranking*. A fresh index prints nothing, and `--json` reports `stale` plus `staleWarning`.

### ask --top &lt;n&gt; (fixed in v8.54.2)

How many files to select; default **5**. An invalid value — zero, negative, fractional or non-numeric — is an **error**, not a silent fall back to the default.

Until v8.54.2 this flag was documented in `--help` and parsed correctly by [`--query`](#query) and [`evidence`](#evidence), while `ask` itself hardcoded `topK: 5` and ignored it (#775). `--top 2` and `--top 20` produced context files differing only in their `Generated:` timestamp.

### Selection, cutoff and context hash (v8.54.2)

`ask` reports tokens, coverage and cost — but it used to say nothing about **which** files it chose or where the cut fell, and emitted no hash, so a result could not be audited or reproduced from its own output. It now prints the selected count, the score at the cutoff, and a short sha256 of the emitted context. The `Generated:` timestamp line is excluded from the hash, so the same query over the same repo hashes identically.

`--json` carries the same as `topK`, `selectedFiles`, `cutoffScore` and `contextHash`.

### ask --explain (v8.55.0)

Diagnose why a query missed. `ask` gave a file list and a cutoff score with no view of what scored, what was close, or which signals drove the order (#813). `--explain` prints three things, in the order a miss is actually diagnosed.

```bash
sigmap ask "how does the ranker penalise test files" --explain
```

```
## Explain: how does the ranker penalise test files

Index: 443 files · 209 scored above zero

| Query token | Files w/ token in sigs | in path | Path IDF |
|-------------|------------------------|---------|----------|
| ranker      | 1                      | 2       | 0.82     |
| penalise    | 0                      | 0       | 1.00     |
| test        | 214                    | 254     | 0.09     |

Matched nothing: penalise — these tokens contributed no score.

### Selected

| Rank | File                    | Score | exact | symbol | path | bm25 | penalty | demoted for |
|------|-------------------------|-------|-------|--------|------|------|---------|-------------|
| 1    | src/learning/weights.js | 9.61  | 1.00  | 0.90   | 0.00 | 8.30 | 1.00    | —           |
| 3    | src/retrieval/ranker.js | 8.03  | 1.00  | 0.90   | 0.37 | 6.62 | 1.00    | —           |

### Near misses (below the cutoff of 7.33)

| File               | Score | penalty | demoted for |
|--------------------|-------|---------|-------------|
| src/eval/scorer.js | 7.09  | 1.00    | —           |
```

**1. Per-token corpus coverage.** A token that matches zero files answers *"why did my query miss"* more often than anything else — above, `penalise` contributes nothing because the code spells it `penalty`. Counts are over **stems**, because BM25 matches on stems: counting raw tokens reported *"users matched nothing"* on a query BM25 actually scored 1.24 via `loginUser`. `Path IDF` shows how discriminating a token is across indexed paths — `test` scores 0.09 here because 254 of 443 paths contain it, so it barely lifts anything on path alone.

**2. Every signal behind each selected file**, plus the reason when a file was demoted — `test file`, `mock/fixture`, `documentation`, `CI definition`, `build output` or `data holder (accessors only)`. The reason is derived from the same predicates that set the multiplier, so it cannot disagree with the score it explains.

**3. Near misses** — candidates that scored above zero but fell below the cutoff, so a close call is visible rather than invisible.

Note in the example above that `penalty` is `1.00` on the test files: the query contains the word *test*, so the test demotion is correctly suspended. That is visible rather than implied.

`--explain` is **opt-in**, so default `ask` output is byte-identical without it, and because it is a diagnostic it writes nothing to `.context/` and does not overwrite the `--followup` session.

### ask --with-source (v8.61.0)

`ask` emitted **signatures only**. An agent that then needed a body opened the whole file — which is the exact cost the map exists to avoid, so the saving was real at the map level and partly handed back one level down ([#814](https://github.com/manojmallick/sigmap/issues/814)). The `:start-end` line anchors every extractor already emits were enough to close that loop.

```bash
sigmap ask "how does the ranker penalise test files" --with-source
sigmap ask "how are secrets redacted" --with-source --source-budget 3000
```

```
────────────────────────────────────────────
 sigmap ask  "how does the ranker penalise test files"
 Intent    : explain, test
 Context   : 2,356 tokens  →  .context/query-context.md
 Selected  : 3 of 454 file(s) (--top 3) · cutoff score 9.658
 Hash      : sha256:67282dea11a0
 Selection : 2 source, 1 support (test)
 Coverage  : readable 100% (179/179 files in srcDirs)
 Risk      : HIGH (12 file(s) changed vs HEAD)
 Source    : 9 of 9 top symbol(s), 1,274 of 14,981 budget token(s)
 Cost      : $0.0059/query  (was $0.0426 · saved 86%)
────────────────────────────────────────────
```

The written context gains two sections after the signatures — the bodies, each labelled with the anchor it was sliced from, and the blast radius so the agent sees what else a change there touches **without a second query**:

````markdown
## Source (top symbols)

### src/retrieval/ranker.js:132-162  — function _computePenalty(filePath, wants, sigs)
```
function _computePenalty(filePath, wants, sigs) {
  ...
}
```

## Blast radius
```
src/retrieval/ranker.js  ← 11 direct, 15 total dependent file(s)
src/learning/weights.js  ← 2 direct, 13 total dependent file(s)
```
````

**How symbols are chosen.** Breadth before depth: up to **three** anchored symbols per file, files walked in rank order, capped at 12 overall. A flat "top N anchors" ordering would let one file's long member list eat the entire budget. Declarations with no body worth reading are skipped — an export list (`module.exports = { … }`) is already in the signature section verbatim, so slicing it back out would spend budget to repeat what the agent holds. Anything longer than 120 lines is a module rather than a symbol and stays a pointer.

**Budget.** There is no second knob to tune: the ceiling is the project's existing [`maxTokens`](/guide/config#maxtokens-vs-automaxtokens) minus what the signature context already spent, so the addendum can never push the signatures themselves over the limit. `--source-budget <tokens>` overrides it for a one-off deep read. A body that does not fit is skipped **whole** and the omission is disclosed in both the summary line and the written context — half a function is not a cheaper answer, it is a wrong one:

```
> 4 of 9 top symbol(s) included — 5 omitted to stay within the 400-token source budget
  (raise `maxTokens` or pass `--source-budget <tokens>`).
```

**Safety.** Slices are secret-scanned with the same redactor the signature pipeline and the [`get_lines`](#mcp-tools) MCP tool use, and paths are sandboxed to the project root.

`--with-source` is **opt-in** — anything that adds tokens has to be asked for — so the default context is byte-identical without it, and the signature section stays prefix-identical when it is present. `--json` reports `withSource` plus a `source` object carrying `included`, `skipped`, `candidates`, `budgetTokens`, `spentTokens`, `truncated` and `blast`.

**Input minimization (v7.0.0).** When the query is a pasted blob — a stack trace, CI log, or JSON payload — `ask` classifies it and, on an interactive terminal, offers to minimize it before ranking (dedupe frames, strip vendor noise, collapse repeated array items, and enrich the top stack frame with its real signature). It only prompts when the reduction clears `--squeeze-threshold` (default 30%). Non-interactive (piped/CI) usage is never blocked: `--squeeze` auto-accepts, `--no-squeeze` disables it entirely. See [`squeeze`](#squeeze) below.

When coverage drops below 70%, a warning is emitted on stderr pointing to `sigmap validate`.

**Line anchors (v6.11.0+):** signatures carry a `:start-end` source range, e.g. `export class UserRepository  :18-36`, so an agent can open the exact lines instead of the whole file. Top-level TypeScript and Python decls were first (v6.11.0); **v6.13.0 adds JavaScript and per-member anchors** — TypeScript/JavaScript class methods and interface members now carry their own range, not the parent's. Anchors appear automatically in `ask` output, the generated `CLAUDE.md`, and every adapter; no flag is required.

### ask --followup

Carry context across follow-up queries in a session. When you use `--followup`, SigMap loads the previous session's context (saved automatically after each `ask` run) and applies a +0.2 boost to files that were in the top-5 from the previous query. If the intent differs from the previous session (topic switch), the boost is reduced to +0.1 to reflect the new direction.

Sessions automatically expire after 4 hours. Session state is saved to `.context/session.json`.

```bash
sigmap ask "explain the auth module"
# ... work with the results
sigmap ask "how are tokens validated?" --followup
sigmap ask "add rate limiting to auth" --followup --json
```

The follow-up query reuses high-scoring files from the previous session without re-ranking the entire codebase, making iterative exploration faster.

| Option | Description |
|--------|-------------|
| `--followup` | Load and merge previous session context (4-hour TTL) |

Session intent detection: if the new query's intent (debug/explain/refactor/etc.) matches the previous session, boost is +0.2; if intent changes, boost is +0.1.

### ask --package (monorepo scoping)

Scope retrieval to a specific workspace package in a monorepo. When used, SigMap searches only within the named package directory, applying a +0.30 score boost to matching files inside that package. Useful for large monorepos where unrelated packages create noise.

If the workspace package does not exist, SigMap falls back to global search with a warning.

```bash
# Explicitly scope to the payments package
sigmap ask "add payment gateway" --package payments

# Scope to a specific package and use --json for integration
sigmap ask "fix checkout flow" --package checkout --json
```

| Option | Description |
|--------|-------------|
| `--package <name>` | Scope to workspace package by directory name (e.g., `--package payments` targets `packages/payments/`) |

### ask --global (disable package scoping)

Disable automatic package scoping. By default, SigMap infers the target package from query tokens (e.g., "rate limiting payments" → `packages/payments/`). Use `--global` to search the entire repo without inference.

```bash
# Disable scoping even if tokens match a package name
sigmap ask "what packages import this module" --global

# Global search in monorepo
sigmap ask "find all auth handlers" --global --json
```

| Option | Description |
|--------|-------------|
| `--global` | Disable automatic package inference; search entire repo |

### ask --mode index (Surgical Context)

Emit a two-tier **symbol index** instead of full signature blocks. Each ranked file is reduced to its declaration heads plus line anchors (`symbol  :start-end`) — parameter lists, return types, and bodies are dropped. The agent reads this minimal map, then fetches the exact lines it needs on demand via the [`get_lines` MCP tool](/guide/mcp). This is the demand-driven half of *Surgical Context* (line anchors are the first half — see above).

```bash
sigmap ask "where is config loaded" --mode index
```

```
# SigMap Query Context (index mode)
> Symbol index only — fetch exact lines on demand via the `get_lines` MCP tool.

## src/config/loader.js
function loadConfig  :42-58
function detectAutoSrcDirs  :12-39
```

| Option | Description |
|--------|-------------|
| `--mode index` | Emit symbol-header pointers only; bodies fetched on demand via `get_lines` |

When over `maxTokens`, the regular (non-index) generate path now degrades the same way automatically: it collapses bodies to anchors before dropping whole files. See the [Surgical Context guide](/guide/surgical-context).

### ask --since (delta context)

Restrict ranked output to files changed since a git ref, so a steady-state turn carries near-zero context. Combine with `--mode index` for the leanest possible turn.

```bash
sigmap ask "finish the refactor" --since main
sigmap ask "what did I touch" --since HEAD~3 --mode index
```

| Option | Description |
|--------|-------------|
| `--since <ref>` | Keep only ranked files changed since `<ref>` (any git ref: branch, tag, or SHA) |

---

## deps

List every dependency the repo **declares**, across all nine supported ecosystems, read straight from the manifests — so it works on a checkout that has never been installed.

Covers `package.json` (all four scopes), `requirements.txt`, `pyproject.toml` (PEP 621 and Poetry), `pom.xml`, `build.gradle(.kts)`, Gradle version catalogs, `go.mod`, `Cargo.toml`, `Gemfile`, `composer.json`, `*.csproj` and `pubspec.yaml`.

Manifests are found **anywhere in the tree**, not just at the repo root (v8.51.7) — a bounded walk, depth 4 and 200 manifests. This is what a multi-module build actually looks like: an aggregator `pom.xml` declaring `<modules>` and no dependencies of its own, with the real ones in `service-api/pom.xml` and `service-core/pom.xml`. Before the walk, such a repo reported `0 deps`. The walk honours the project's `exclude` config and `.contextignore`, so vendored or cloned third-party trees are not reported as yours.

Two details make the output usable rather than decorative. Maven `${property}` placeholders are resolved against the POM's own `<properties>` block, so you get `2.17.1` and not `${jackson.version}`. And when a `package-lock.json` is present the **exact locked version wins over the declared range** — `^5.1.0` is not what the code actually runs against, and a model grounded on the wrong major writes the wrong API.

Maven is read to Maven's own rules: project identity comes from the POM's **own** coordinates rather than its `<parent>` (otherwise every Spring Boot project reports itself as `spring-boot-starter-parent`), `<dependencyManagement>` entries are version constraints and are **not** counted as dependencies, and scopes map faithfully — `provided` stays `provided`, so a compile-time dependency that is never shipped is distinguishable from one that is.

```bash
sigmap deps                # human-readable, grouped by ecosystem
sigmap deps --json         # machine-readable inventory
sigmap deps --runtime      # production dependencies only
```

---

## sbom

Emit a **CycloneDX 1.5** Software Bill of Materials for the repo.

SigMap deliberately does **not** ship vulnerability scanning. A network-sourced CVE section would make two runs on the same commit disagree — which contaminates the byte-reproducibility guarantee for every artifact SigMap produces, not just that section — and it would mean maintaining a vulnerability feed forever against tools that already do the job well and for free.

So SigMap emits the one thing those scanners need and cannot derive from a signature map: a complete, deterministic component list. Pipe it onward:

```bash
sigmap sbom --out sbom.json && osv-scanner --sbom sbom.json
```

```bash
sigmap sbom                      # CycloneDX JSON on stdout
sigmap sbom --out sbom.json      # write to a file
sigmap sbom --exact-only         # only components with a real pin
sigmap sbom --no-dev             # production components only
```

The document carries **no `serialNumber` and no `metadata.timestamp`** — both are optional in the spec and both would vary run to run. Components are sorted by `bom-ref`, so the output is byte-identical across runs on an unchanged repo.

Where a manifest declares a **range** rather than a pin, the lower bound is used and the component is explicitly labelled `sigmap:versionInferred: lower-bound-of-range`, with the original spec preserved in `sigmap:versionSpec`. The command reports how many components are pinned versus inferred on stderr, so you can say how precise a scan result actually is rather than implying a precision that is not there. Commit a lockfile to get exact pins.

---

## evidence

Build an **Evidence Pack** — a deterministic, machine-consumable signature-and-evidence map for a query. Where [`ask`](#ask) is tuned for a human reading a terminal, `evidence` emits a byte-stable JSON artifact (**schema v2**, v8.16.0) that an agent or CI can ingest directly: every file entry is anchored to real symbols and line ranges, carries a relevance reason and confidence, **multi-factor risk labels** (`riskFactors`, with `riskLabel` as the dominant factor for v1 consumers), and the pack is signed with a sha256 `contextHash`. Schema v2 also publishes a validatable **JSON Schema** at [sigmap.io/schemas/evidence-pack-2.json](https://sigmap.io/schemas/evidence-pack-2.json) (`schemaUrl` in the pack), a **`testDiscovery` provenance block** stating the measured accuracy of the related-tests method (F1 0.98 on 3,701 pairs / 28 repos — guard-tested against the committed benchmark report), and a `generator` identity. It always writes the artifact to `.context/evidence-pack.json`; stdout carries the requested mode (JSON by default, or Markdown with `--markdown`). Since v8.44 the pack's `relatedTests` are served from the cached [knowledge map](/guide/mcp#query-knowledge-map)'s `tests` edges instead of a per-file rescan — the output is byte-identical (same `contextHash`), just cheaper to produce.

The pack carries **no wall-clock timestamp** — running it twice on an unchanged repository produces byte-identical output and an identical `contextHash`. That is the point: the artifact is auditable, exactly what an agentic grep loop cannot produce.

```bash
sigmap evidence "how does the ranker score files"
sigmap evidence "how does auth work" --markdown
sigmap evidence "fix the login bug" --top 8 --budget 4000 --out pack.json
```

```json
{
  "schemaVersion": "2.0",
  "schemaUrl": "https://sigmap.io/schemas/evidence-pack-2.json",
  "generator": { "name": "sigmap", "version": "8.16.0" },
  "query": "how does the ranker score files",
  "intent": "explain",
  "files": [
    {
      "path": "src/conventions/extract.js",
      "symbols": ["module.exports = { classifyNaming, scoreConvention, extractConventions }"],
      "reason": "symbol-name match; exact token match",
      "confidence": 1,
      "sourceLines": [{ "symbol": "module.exports = { ... }", "start": 178, "end": 178 }],
      "relatedTests": [],
      "riskLabel": "source",
      "riskFactors": ["source"]
    }
  ],
  "tokenBudget": { "limit": 16000, "used": 164, "remaining": 15836 },
  "droppedFiles": [],
  "testDiscovery": {
    "method": "stem-affix-match",
    "measured": { "f1": 0.98, "precision": 0.971, "recall": 0.988, "pairs": 3701, "repos": 28 },
    "benchmark": "npm run benchmark:test-discovery"
  },
  "grounding": {
    "symbolCount": 10,
    "anchoredSymbols": 10,
    "anchorCoverage": 1,
    "contextHash": "sha256:565ef0…",
    "deterministic": true
  }
}
```

Each `files[]` entry: `path`, the matched `symbols`, a human-readable `reason` (derived from the ranker's signals), a `confidence` in `0–1` (normalized to the top-ranked file), `sourceLines` with exact `{start,end}` anchors, cross-language `relatedTests`, and a `riskLabel` ∈ `generated · test · migration · payment · auth · security · public-api · config · source` (strict most-specific-risk precedence — a migration touching auth is still `migration`). Files that rank but don't fit the token budget appear in `droppedFiles` with a reason. The `grounding` block attests how many symbols are anchored and signs the canonical pack.

| Option | Description |
|--------|-------------|
| `--markdown`, `--md` | Emit the Markdown handoff rendering to stdout instead of JSON |
| `--top <n>` | Maximum ranked files to consider (default 12) |
| `--budget <n>` | Token budget for included files (defaults to config `maxTokens`) |
| `--out <path>` | Also write the rendered output (JSON or Markdown) to `<path>` |

::: tip v8.5 — measured & richer
`relatedTests` now normalizes cross-language test conventions (`test_x.py`↔`x.py`, `x_test.go`↔`x.go`, `XTest.java`↔`X.java`, `x.spec.ts`↔`x.ts`) and is measured at **F1 98.0% / hit@1 97.4%** across 28 repos (`npm run benchmark:test-discovery`). `riskLabel` uses the richer, precedence-ordered set above.
:::

---

## plan

Plan a change before making it. Given a goal, `sigmap plan` returns the files to read first, the implementation files the goal is likely to change, the blast radius of those files, and the tests that cover them.

```bash
sigmap plan "add a new secret detection pattern for Slack tokens"
sigmap plan "refactor the auth middleware" --json
```

```
──────────────────────────────────────────────────
 sigmap plan  "add a new secret detection pattern for Slack tokens"
 Intent     : search
──────────────────────────────────────────────────

 Inspect first (highest relevance):
   1. src/security/patterns.js
   2. src/extractors/patterns.js

 Likely to change (high-confidence implementation files · score vs top match · why):
   1. src/security/patterns.js    1.00  "secret" in signatures; "detection" in signatures; "pattern" in path and signatures
   2. src/extractors/patterns.js  0.84  "detection" in signatures; "pattern" in path and signatures

 Impact radius (relative-import dependents, ≤3 hops — lower bound):
   • src/review/review-pr.js  (direct)
   • src/security/redact.js  (direct)
   • src/security/scanner.js  (direct)
   • src/create/orchestrate.js  (transitive)
   • src/review/pr-evidence.js  (transitive)
   • src/evidence/pack.js  (transitive)
   • src/mcp/handlers.js  (transitive)
   • src/retrieval/with-source.js  (transitive)
   • src/analysis/test-coverage.js  (transitive)
   • src/map/knowledge-map.js  (transitive)
   • src/mcp/server.js  (transitive)

 Files with test coverage (re-run their suites after changing):
   • src/security/patterns.js  ←  test/integration/impact.test.js, test/integration/redact.test.js, test/windows-path-normalization.test.js
   • src/extractors/patterns.js  ←  test/integration/extractors/patterns.test.js

──────────────────────────────────────────────────
```

**Likely to change** holds only files the ranker placed in its `high` confidence band, and only implementation files. Tests, fixtures, CI definitions and docs are left out unless the goal asks for them ("add tests for…", "fix the release workflow"). Each entry shows its score relative to the top match and the words of the goal that its path and signatures carry, so a weak match can be discounted rather than trusted. Until v8.62.2 this list was the *medium* band, which by construction left out the file the goal names.

**Files with test coverage** lists, for each covered file, the test files that target it by name (`foo.test.js`, `test_foo.py`, `FooTest.java`) or load it (`require` / `import`, or a path built with `path.join` / `path.resolve`). A file missing from the list has no test that names or loads it. A module exercised only through the CLI is not detected, so the absence is not proof that nothing tests it. [`--analyze`](#analyze) reads the same index.

`--json` emits:

| Key | Type | Meaning |
|-----|------|---------|
| `goal`, `intent` | string | The goal as given, and the detected intent |
| `inspectFirst` | string[] | High-confidence files of any kind, most relevant first |
| `likelyToChange` | string[] | High-confidence implementation files |
| `likelyToChangeEvidence` | object[] | Same order as `likelyToChange`: `{ file, score, reason }` |
| `impactRadius` | object | `{ direct, transitive }` — files that import the ones above, up to 3 hops |
| `coveredFiles` | string[] | Files from `inspectFirst` that a test covers |
| `relatedTests` | object | Covered file → the test files that name or load it |
| `testsAffected` | string[] | Same as `coveredFiles`; kept for compatibility |

| Option | Description |
|--------|-------------|
| `--json` | Emit the structured object above |

---

## judge

Rule-based groundedness scoring for LLM responses. Combines token overlap with **claim-level grounding** (v8.10.0): it extracts the answer's concrete symbol/file/import claims and fails any that nothing grounds. Since **v8.45.0 (J1)** the claim check is **structural**: it runs the same verify engine as [`verify-ai-output`](/guide/verify-ai-output) — repo symbols from the signature index, installed-library symbols from the `.d.ts`/site-packages index, declared dependencies, and real file paths all ground a claim even when the context never quotes it verbatim, while fabrications still fail (one grounding engine, two commands; without a repo, matching falls back to the context text alone). Zero dependencies, no LLM API required.

```bash
sigmap judge --response response.txt --context .context/copilot-instructions.md
sigmap judge --response response.txt --json
claude -p "how does ranking work?" | sigmap judge      # stdin; --context defaults
sigmap judge --response response.txt --context .context/query-context.md --learn
```

```
────────────────────────────────────────────
 sigmap judge
 Score     : 0.72
 Verdict   : pass
 Confidence: high (2 claim(s) checked · structural pass ran · score margin 0.47)
 Context   : .github/copilot-instructions.md (default — no --context given)
 Claims    : 2/2 grounded (1 context, 1 repo)
 Reasons   : none
────────────────────────────────────────────
```

### Scoring technical content, not English (v8.54.0)

`judge` scores how much of an answer's **technical** vocabulary the context
grounds — not how much of the answer is English. It shares the ranker's
tokenizer (`src/retrieval/bm25.js`), so camelCase and snake_case are split and
stemmed, and ordinary-English vocabulary is dropped from both sides before
scoring.

Before v8.54.0 the score was a raw word-overlap ratio over a 40-word stoplist
with no identifier splitting, which produced two reproducible false failures:

- **Prose diluted a grounded answer.** An answer whose every claim was grounded
  scored `0.212` and failed because it contained ordinary English. The same
  answer now scores `0.643` and passes.
- **Identifiers written as prose were invisible.** `buildEvidencePack` scored
  `0.750` while `build evidence pack` — the same fact — scored `0.333`. Both
  now score identically.

The `--learn` band defaults (`learnBoostAbove` / `learnPenalizeBelow`) are
unchanged: they still separate the measured 80%/30% grounded mixtures under the
new scorer.

### Warnings vs. reasons (v8.54.0)

Hedging phrases (`typically,`, `in general`, `generally speaking`, …) are a
**style** signal, never a grounding one. They are reported in `warnings[]` and
**never flip the verdict**. Previously a fully-grounded answer failed with exit
1, *at `high` confidence*, solely because it contained the word "typically,".

```
 Score     : 0.75
 Verdict   : pass
 Confidence: medium (1 claim(s) checked · structural pass ran · score margin 0.5 · generic phrasing present)
 Claims    : 1/1 grounded (1 context, 0 repo)
 Reasons   : none
 Warnings  :
   response contains generic phrase: "typically,"
```

Markers are matched on word boundaries, so `in general` no longer fires inside
`in general-purpose`. A warning caps `confidence` below `high` — the judge never
reports high confidence in a result a stylistic signal had any part in.

### The `inconclusive` verdict (v8.54.0)

"Nothing to judge" is not the same as "wrong". An empty response, an empty
context, or a response with no scoreable tokens verdicts `inconclusive` and
**exits 2**, naming the file on stderr. `--learn` never learns from it.
Previously an empty response file was scored as a genuine `fail` — the same
signal in CI that a confidently hallucinated answer produces.

```
$ : > empty.md && sigmap judge --response empty.md --context ctx.md
[sigmap] response is empty: empty.md — nothing to judge
 Verdict   : inconclusive
 Confidence: low (nothing to judge)
$ echo $?
2
```

`pass` = `0` and `fail` = `1` are **unchanged**, so existing CI gates keep
working.

### Stdin, default context, and stale ground (v8.54.0)

`--response` accepts `-` and a bare pipe, so a model's output can be judged
without writing it to disk first. `--context` is optional: it resolves the
context this repo already generated — the same adapter-output list
[`doctor`](#doctor) checks — and names which file it used.

`judge` also compares that file's age against the sources it describes, and
warns when the answer is being judged against ground that has moved:

```
 Warnings  :
   context is 3.2 day(s) older than src/retrieval/ranker.js — the answer is being judged against stale ground
```

### Per-claim output (v8.54.0)

The checked-claims table existed only in `--json`, so on a failure the reader
could not see which claim was checked or how it resolved without re-running the
command. It now prints on `fail` and `inconclusive`:

```
 Claims    : 1/2 grounded (1 context, 0 repo)
 Checked   :
   ✗ symbol computeQuantumScore() — not grounded
   ✓ file   src/security/scanner.js — context
 Reasons   :
   symbol claim not grounded in context or repo index: computeQuantumScore()
```

Since **v8.49.0 (J4)** the judge explains itself: a deterministic `confidence` level (`high` — structural pass ran, every claim grounded, comfortable score margin; `medium` — claims checked lexically only or a thin margin; `low` — no concrete claims, the verdict rests on word overlap alone) with an auditable `basis`, and a per-claim `checked` report stating each claim's grounding route (`"context"` — the context quotes it; `"repo"` — the structural pass cleared it; `null` — ungrounded). JSON output (`--json`) carries `score`, `reasons`, the claim report, `confidence`, and a `verdict` field that drives the exit code:

```json
{ "score": 0.72, "reasons": [], "confidence": { "level": "high", "basis": ["2 claim(s) checked", "structural pass ran", "score margin 0.47"] },
  "claims": { "total": 2, "grounded": 2, "ungrounded": [], "structural": true, "coverage": 1,
              "checked": [{ "kind": "symbol", "value": "rank", "grounded": true, "via": "context" }] } }
```

With `--learn`, judge becomes an opt-in feedback loop. It reads file headings from the context file (`### path` in generated context or `## path` in `.context/query-context.md`) and applies a small learned boost or penalty when groundedness is confidently high or low. Since **v8.45.0 (J2)** the verdict threshold and the learn band are configurable per repo via the [`judge` config section](/guide/config#judge) (`threshold`, `learnBoostAbove`, `learnPenalizeBelow`) — defaults are derived from a measured mixture corpus, and `--threshold` still overrides the config.

| Option | Description |
|--------|-------------|
| `--response <file\|->` | Path to the LLM response text file, or `-` for stdin. Omit it entirely and `judge` reads a bare pipe |
| `--context <file>` | Path to the context/source file. **Optional since v8.54.0** — defaults to the repo's generated context, and the output names which file it used |
| `--threshold <n>` | Minimum score to pass (default: `0.25`; overrides `judge.threshold` from config) |
| `--learn` | Apply opt-in learned boosts/penalties to files referenced by context headings |
| `--json` | Emit JSON instead of human-readable output |

| Exit code | Verdict | Meaning |
|---|---|---|
| `0` | `pass` | Score clears the threshold and every claim is grounded |
| `1` | `fail` | Below threshold, or a claim nothing grounds — also used for usage errors |
| `2` | `inconclusive` | Nothing to judge: empty response, empty context, or no scoreable tokens |

`0`/`1` are unchanged from earlier versions, so existing CI gates keep working.

---

## verify-plan

Check a plan against the **live index** *before* the agent executes it — step 2 of the grounded-creation pipeline (`scaffold` → **verify-plan** → `verify-ai-output` → `review-pr`). It catches problems at plan time, which is cheaper than after the code is written. The plan is plain **markdown**: reference files inline (`` `src/auth/login.ts` ``) and symbols as calls (`` `validateToken(...)` ``).

```bash
sigmap verify-plan plan.md            # check a plan file
cat plan.md | sigmap verify-plan -    # or from stdin
sigmap verify-plan plan.md --json     # machine-readable result
sigmap verify-plan plan.md --creates formatDate,src/util/date.js   # names the plan introduces
```

```
[sigmap] verify-plan — 3 file(s), 2 symbol(s) referenced
  ✗ missing file: src/auth/sesion.ts (line 4)
  ✗ unknown symbol: validateTokn() — did you mean validateToken()? (line 6)
  ⚠ high blast radius: src/core/index.ts → 34 dependents

  2 error(s), 1 warning(s)
```

It checks three things:

| Check | Flags |
|-------|-------|
| **Existence** | referenced files that don't exist · symbols not in the live index (with a closest-match suggestion) — both **errors** |
| **Blast radius** | each referenced file's transitive dependents (via the impact graph); files above the threshold are a **warning** |
| **Scope** | plans touching more distinct files than the scope threshold — a **warning** |

### References vs introductions — the `Creates:` section (v8.57.0+, #666)

A plan has two kinds of name in it, and checking them the same way makes the
creation path unreachable: a plan that *introduces* `formatDate` would fail for
naming a symbol that, by construction, does not exist yet.

So a **`Creates:` section** marks the names the plan will introduce. They are
verified in **reverse** — they must **not** exist — which is the redefinition
guard: a plan that claims to create something already in the repo is flagged.
Introductions are also excluded from the existence and blast-radius checks.

```markdown
# Add a date helper

## Creates
- `formatDate(date)`
- `src/util/date.js`

Wire it into `src/core.js` next to `renderRow(...)`.
```

The label is matched as a heading (`## Creates`, `### Creates new`) or a label
line (`Creates:`, `**Creates:**`), inline (`Creates: a, b`) or as the bulleted /
indented lines beneath it. An entry with a `/` or a file extension is a **file**;
anything else is a **symbol**. Prose that merely begins with the word — `Creates
a new helper for dates.` — is **not** a section.

With no section and no `--creates`, every name is a reference and behaviour is
exactly as before.

| Option | Description |
|--------|-------------|
| `--creates <names>` | Comma-separated names the plan introduces, for plans carrying no `Creates:` section. Merged with the section when both are present |
| `--json` | Emit `{ issues, blast, scope, introduces, summary }` |

A plan with any **error** exits non-zero (useful as a gate before execution); warnings do not fail.

---

## verify

**The grounding flagship (v8.6.0+).** `sigmap verify` is the first-class short alias of [`verify-ai-output`](#verify-ai-output) — identical behaviour, flags, and exit codes. It is the headline command because deterministic, offline grounding is the one capability no agentic-grep loop or competitor offers: prove an AI answer is anchored to real signatures and line numbers before you trust it.

```bash
sigmap verify answer.md               # ✓ grounded, or a line-by-line list of fabrications
sigmap verify answer.md --json        # machine-readable report; exits 1 if any issue (CI gate)
sigmap verify answer.md --report      # standalone red/amber/green HTML report
```

Full behaviour, options, and installed-library grounding are documented under [`verify-ai-output`](#verify-ai-output) below.

### False positives fixed in v8.54.1 (#777)

A grounding guard that cries wolf is worse than none, and `verify` was doing it in two ways.

**Standard globals were reported as hallucinations.** The allowlist was a hand-maintained inline literal that stopped at `encodeURIComponent`, so `structuredClone(obj)` — a Node and browser global since Node 17 — was flagged as fabricated at **`high` confidence**. Globals now live in `src/verify/globals.js` as grouped data — 184 names across ECMAScript, Web/Node platform, Node module scope, test-runner and Python built-ins — so a missing one is a one-line addition to the right group rather than an edit to a 30-name blob.

**The suggestions were worse than the findings.** The closest-match pool was the entire signature index, so:

| Flagged | Suggested | Sourced from |
|---|---|---|
| `structuredClone()` | `structuralFixture()` | a test file |
| `debounce()` | `resource()` | `test/fixtures/main.tf` |

Applying either would corrupt the answer it claims to correct. The pool now excludes test and fixture paths, and languages whose top-level names are not callable — Terraform resources, SQL tables, GraphQL fields, CSS selectors. A **0.34 similarity floor** drops the remainder, so `debounce()` gets no suggestion rather than a wrong one, while the band that makes the feature useful is untouched: `buildEvidencPack` → `buildEvidencePack()` and `scanx` → `scan()` both still resolve.

::: tip A flagged library call can still be correct behaviour
A symbol from a library the repo does **not** declare is reported as fake on purpose — that is the guard telling you the call is not available here. When the library *is* a declared dependency, [installed-library grounding](#verify-ai-output) resolves it and nothing is reported.
:::

## verify-ai-output

Hallucination Guard — the full command name for [`verify`](#verify). Scans an AI answer (markdown or plain text) and flags claims that do not match the repository: fake file paths, fake test files, unresolvable imports (including Python and Go imports of the repo's own packages), names imported from a module that has no such name, symbols not in the SigMap index, and `npm run` scripts that don't exist. Fully deterministic — runs offline, no LLM API. Where a flagged name is a near miss for something real, a heuristic closest-match suggestion is attached. **v8.1.0+:** symbol checks also ground against the libraries **actually installed** — JS/TS from `node_modules` (`.d.ts` exports) and, since **v8.3.0**, Python from the project's venv `site-packages` (`__init__.py`/`.pyi` exports) — each with its pinned version, so genuine library calls stop false-flagging — see [Installed-library grounding](/guide/verify-ai-output#installed-library-grounding-v8-1-0-v9-0-g5-d5-the-moat).

```bash
sigmap verify ai-answer.md                    # `verify` and `verify-ai-output` are interchangeable
sigmap verify-ai-output ai-answer.md --json
sigmap verify-ai-output ai-answer.md --report report.html
```

```
[sigmap] ✗ ai-answer.md — 3 issues found
  fake-file: 0  fake-test-file: 1  fake-import: 1  fake-import-name: 0  fake-symbol: 1  fake-npm-script: 0

  L4   [Fake symbol]     Symbol not found in repo index: loadConfg()
         ↳ Did you mean `loadConfig()` in src/config/loader.js:42?
  L6   [Fake test file]  Test file not found on disk: src/extractors/nonexistent.test.js
  L10  [Fake import]     Import does not resolve: ./src/totally/madeup
```

Six deterministic detectors:

| Detector | Flags | Confidence |
|----------|-------|------------|
| `fake-file` | A referenced path that is not present on disk | High |
| `fake-test-file` | A referenced **test** path (`*.test`/`*.spec`/`__tests__`/`test_*.py`) absent on disk | High |
| `fake-import` | A relative import that does not resolve, a bare package absent from `package.json` dependencies (Node/Python builtins and scoped packages are allow-listed), or a Python / Go import of the repo's own package that does not resolve | High |
| `fake-import-name` | A name imported from a repo module that resolves to one file and occurs nowhere in it — see [Imports and the names they take](/guide/verify-ai-output#imports-and-the-names-they-take-909) | Medium |
| `fake-symbol` | A called function/class (`` `name()` ``) absent from the SigMap symbol index (`buildSigIndex`) | Medium |
| `fake-npm-script` | An `npm run X` (or `pnpm`/`yarn run X`) where `X` is not a `package.json` script | High |

To avoid false positives, the detectors ignore tokens that aren't real claims about the repo: well-known runtime/library product names (`Node.js`, `Next.js`, `Vue.js`, `Express.js`, `D3.js`, …); illustrative placeholder filenames the model writes in prose, including camelCase forms (`example.js`, `minimal-example.js`, `myExample.js`, `exampleConfig.ts`, `sample.ts`, `demo.py`, `placeholder.js`); and documentation-placeholder imports (`@scope/utils`, `some-module`, `./local-file`, `./path/to/…`). Genuine repo-shaped paths (`src/foo/bar.js`, `main.js`, `index.ts`), ordinary words (`resample.js`), and real missing packages/imports are still flagged, so real hallucinations are unaffected.

JSON output (`--json`) for CI:

```json
{
  "file": "ai-answer.md",
  "issues": [
    { "type": "fake-symbol", "value": "loadConfg", "line": 4, "location": "L4", "message": "Symbol not found in repo index: loadConfg()", "confidence": "medium", "suggestion": "Did you mean `loadConfig()` in src/config/loader.js:42?" }
  ],
  "summary": { "total": 1, "byType": { "fake-file": 0, "fake-test-file": 0, "fake-import": 0, "fake-import-name": 0, "fake-symbol": 1, "fake-npm-script": 0 }, "clean": false, "symbolsIndexed": 288, "withSuggestion": 1 }
}
```

| Option | Description |
|--------|-------------|
| `--json` | Emit machine-readable `{ file, issues, summary }` instead of the markdown report |
| `--report [out.html]` | Write a standalone, self-contained HTML report (red/amber/green per issue, suggestions inline); defaults to `sigmap-verify-report.html`. Combinable with `--json`. |

Exit code `0` = clean (no hallucinations), `1` = at least one issue found. Use in CI to gate AI-generated patches or answers before they are trusted. See the [Hallucination Guard guide](/guide/verify-ai-output) for the full workflow.

---

## review-pr

Audit a diff for drift and side effects after a PR is opened — the final guard stage of the grounded-creation pipeline (`scaffold` → `verify-plan` → `verify-ai-output` → **review-pr**). It collects the changed files via git and flags risk classes: missing tests, sensitive-path touches (a path heuristic), god-node edits, scope drift, and — since v8.10.0 — a **content-based secret scan** that reads changed files and flags a hardcoded key even in an innocently-named file.

```bash
sigmap review-pr                 # vs the merge-base with main (or develop)
sigmap review-pr --base main     # explicit base ref
sigmap review-pr --staged        # audit staged changes (pre-commit)
sigmap review-pr --json          # machine-readable findings
```

```
[sigmap] review-pr — 7 file(s) changed (4 source, 1 test)
  ⚠ missing tests: src/auth/login.js changed with no matching test
  ⚠ security file: .github/workflows/deploy.yml
  ⚠ god node: src/core/index.js → 34 dependents
  ⚠ scope drift: 6 top-level dirs (src, test, docs, scripts, .github, packages)

  4 finding(s)
```

| Finding | Flags |
|---------|-------|
| `missing-tests` | a changed source file with no matching changed test |
| `security-file` | `.env*`, auth, secrets, `package.json` / lockfiles, `.github/workflows/**`, Dockerfiles, key files |
| `god-node` | a changed file with transitive dependents above the threshold (via the impact graph) |
| `method-blast` | **v8.13.0** — a changed file whose method-level blast radius scores high/critical: `min(100, direct×4 + transitive×1)` over the call graph (functions that transitively call into the change) |
| `scope-drift` | the diff touches more distinct top-level directories than the threshold |

| Option | Description |
|--------|-------------|
| `--base <ref>` | Compare against this ref's merge-base (default: `main`, then `develop`) |
| `--staged` | Audit staged changes instead of a commit range |
| `--json` | Emit `{ findings, blast, methodBlast, summary }` |
| `--markdown` | Emit the **PR Evidence Report** (alias `--evidence`) |

Deletions are excluded from the source/security checks. Any finding exits non-zero, so `review-pr` works as a CI gate. To run this together with the other stages, see [`create`](#create).

### PR Evidence Report (`--markdown`)

`sigmap review-pr --markdown` renders one **branded, deterministic Markdown comment** you can post on a pull request. For each changed file it folds together the extracted **signatures**, **blast radius** (direct/transitive importers, impacted tests + routes), a **method blast radius** line (v8.13.0 — how many *functions* transitively call into the change, with score/tier and the top caller ids), cross-language **related tests**, a **risk label**, and the review findings above — answering *"what changed, what it touches, and what to test"* with no LLM.

```bash
sigmap review-pr --markdown --base main > pr-evidence.md   # post this as a PR comment
```

The report carries **no wall-clock timestamp**, so it is byte-stable given a fixed tree (a re-run produces an identical comment). The exit code still reflects the review (0 = clean, 1 = findings), so the same command can both **post** the comment and **gate** the PR in CI. Since v8.44 the blast radius and related tests are views over the cached knowledge map — no per-call signature-index or import-graph rebuild — with affected tests enriched by the store's discovered test↔impl edges.

---

## create

Orchestrate the full **grounded-creation pipeline** in one command: `scaffold` → `verify-plan` → `verify-ai-output` → `review-pr`, with `1/4`…`4/4` numbering and a single pass/fail summary. You do the LLM writing between stages; `create` runs the deterministic guards it owns. Each stage runs **only when its input is present** — a stage with no input is *skipped* and never fails the run. A run where *no* stage had its input exits `2`, not `0` (see [Exit codes](#exit-codes) below).

```bash
sigmap create "add login rate-limiting" \
  --name "rate limiter" \      # 1/4 scaffold
  --plan plan.md \             # 2/4 verify-plan
  --answer answer.md \         # 3/4 verify-ai-output
  --base main                  # 4/4 review-pr (the diff)
sigmap create "demo" --name thing --json
```

```
[sigmap] create "add login rate-limiting" — grounded-creation pipeline
  1/4 ✓ scaffold         ok
  2/4 ✓ verify-plan      ok
  3/4 ✗ verify-ai-output FAILED
  4/4 – review-pr        skipped (no changes)

  3/4 ran · 2 passed · 1 failed · 1 skipped
```

| Stage | Enabled by | Runs |
|-------|-----------|------|
| `1/4 scaffold` | `--name <n>` | [scaffold](#scaffold) — convention-matched proposal |
| `2/4 verify-plan` | `--plan <f>` | [verify-plan](#verify-plan) — plan vs live index |
| `3/4 verify-ai-output` | `--answer <f>` | [verify-ai-output](#verify-ai-output) — hallucination guard |
| `4/4 review-pr` | the git diff | [review-pr](#review-pr) — diff audit |

| Option | Description |
|--------|-------------|
| `--name <n>` | Module name → enables the scaffold stage |
| `--plan <f>` | Plan markdown file → enables verify-plan |
| `--creates <names>` | Comma-separated names the plan introduces, forwarded to [verify-plan](#verify-plan) |
| `--answer <f>` | AI answer markdown file → enables verify-ai-output |
| `--base <ref>` / `--staged` | Diff source for review-pr (default: merge-base with `main`/`develop`) |
| `--json` | Emit `{ task, steps, summary }` |

When stage 1 proposes a scaffold, its proposed filenames are handed to stage 2
as introductions automatically — so a plan naming the file `scaffold` just
designed reaches a passing `verify-plan` instead of failing on it (#666).

### Exit codes

| Code | Meaning |
|------|---------|
| `0` | At least one stage ran, and every stage that ran passed |
| `1` | A stage ran and **failed** |
| `2` | **Nothing ran** — no stage had its input, so the run verified nothing (v8.57.0+, #767) |

Exit `2` matters in CI: `failed === 0` is vacuously true over an empty set, so
`create` with no inputs previously exited **0** and a pipeline step read success
from a run that checked nothing. It now prints what each stage needed:

```
  0/4 ran · 0 passed · 0 failed · 4 skipped

  nothing ran — create verifies the inputs you give it:
    scaffold          needs --name <module> (plus a detectable file-naming convention)
    verify-plan       needs --plan <plan.md>
    verify-ai-output  needs --answer <answer.md>
    review-pr         needs --staged, or commits since --base
```

Skipped stages still never *fail* the run — but they can no longer be the whole run.

---

## squeeze

Minimize a pasted stack trace, CI/build log, or JSON payload — deterministic, offline. Reads a file or stdin and writes the squeezed result to stdout (stats to stderr). The same engine runs inside [`ask`](#ask).

```bash
sigmap squeeze error.log              # squeeze a file → stdout
cat error.log | sigmap squeeze -      # or from stdin
sigmap squeeze error.log --json       # category + reduction + squeezed text as JSON
sigmap squeeze --response out.txt     # name an agent/tool response explicitly
```

```
Input: 14,200 tokens
Can reduce to 1,280 tokens (91% smaller):
  ✓ Kept: 1 unique exception + top source frames
  ✓ Kept: enriched signature for validateToken() at session.js:142
  ✗ Stripped: 47 duplicate frames, 312 lines of build noise
```

Three deterministic detectors, each with its own minimizer:

| Category | What it keeps |
|----------|---------------|
| `stacktrace` | Unique exceptions (`occurred ×N`), top frames in your source dirs, **the top frame enriched** with its real signature from the symbol index; vendor (`node_modules`/`vendor`/`site-packages`) frames stripped |
| `cilog` | Every error line + a context window; timestamps, progress bars, and repeated noise stripped (never empty) |
| `json` | Schema shape at every depth; repeated array items collapsed, long strings truncated |

| Option | Description |
|--------|-------------|
| `--response <file\|->` | Name the agent/tool response input explicitly (mirrors `judge --response`); routes through the same engine |
| `--json` | Emit `{ category, confidence, rawTokens, squeezedTokens, reduction, enriched, squeezed }` |

The same engine is available to agents mid-session as the [`squeeze_output` MCP tool](/guide/mcp) — compress a stack trace, CI/build log, or JSON payload before it enters context.

Prose (no recognizable structure) passes through unchanged. The differentiator over generic log summarizers is **symbol enrichment** — SigMap attaches a real function signature to the top stack frame because it has the repo's symbol index.

---

## conventions

Extract and report a repo's coding conventions so generated code matches the house style instead of drifting. Scans the source tree (TS/JS/Python) and reports the dominant **file naming** style, **export style**, and **test framework**, each with a consistency tier. Writes `.context/conventions.json` for tools to consume.

```bash
sigmap conventions              # report + write .context/conventions.json
sigmap conventions --json       # machine-readable output
sigmap conventions --conflicts  # breakdown of every mixed convention + rename suggestions
```

```
[sigmap] conventions  (TS/JS/Python)
  scanned        115 files
  file naming    camelCase 77% [mostly]  ·  also: kebab-case 20%, snake_case 3%
  export style   named 99% [consistent]  ·  also: default 1%
  test framework none detected

  → wrote .context/conventions.json
```

Each convention is scored into a **consistency tier** so you know whether it is safe to enforce:

| Tier | Dominant share | Meaning |
|------|----------------|---------|
| `consistent` | ≥ 90% | One clear convention — safe to enforce |
| `mostly` | 70–89% | A dominant convention with some drift |
| `inconsistent` | < 70% | No clear convention |

| Option | Description |
|--------|-------------|
| `--json` | Emit `{ fileNaming, exportStyle, testFramework, scope, scannedFiles }` (each convention as `{ dominant, dominantPct, variants, tier }`) |
| `--conflicts` | Show *why* a convention is mixed — every variant with file count, share, bar, and example files, plus rename suggestions toward the dominant style (`--json` emits the structured report) |
| `--inject` | Write/update the conventions block in `CLAUDE.md` (creates the file if absent) so agents read the house style |

### `--conflicts`

When a convention is `mostly` or `inconsistent`, `--conflicts` surfaces the full breakdown: each variant pattern with its file count, share, a visual bar, and example files — plus rename suggestions that move minority file-naming files toward the dominant style. (Export-style conflicts list variants but no renames — switching named ↔ default is a code change, not a rename.) A consistent repo prints `no conflicts`.

```bash
sigmap conventions --conflicts
```

```
[sigmap] conventions --conflicts  (TS/JS/Python)

  file naming — dominant: camelCase 77% [mostly]
    camelCase      89   77% ███████████████ (dominant)  e.g. diagnostics.js, freshen.js
    kebab-case     23   20% ████  e.g. coverage-score.js, sig-cache.js
    snake_case      4    3% █  e.g. python_ast.py
    rename to match camelCase:
      coverage-score.js  →  coverageScore.js
      sig-cache.js  →  sigCache.js
```

### `--inject`

Surface the detected conventions to any agent that reads `CLAUDE.md`. `--inject` renders the conventions (file naming, export style, test framework — each with its dominant pattern and consistency tier) into a marker-delimited block and writes it into `CLAUDE.md`, creating the file if it doesn't exist. The injection is **idempotent** and **marker-scoped** (`<!-- sigmap-conventions:start -->` … `:end -->`) — re-running replaces the block in place, never touches your hand-written content, and coexists with the `## Auto-generated signatures` block.

```bash
sigmap conventions --inject
```

```markdown
<!-- sigmap-conventions:start -->
## Conventions (auto-detected by SigMap)

Match these when writing or editing code (TS/JS/Python):

- **File naming:** camelCase (77% — dominant, with some drift). Variants: kebab-case 20%, snake_case 3%.
- **Export style:** named (99% — consistent — match it).
<!-- sigmap-conventions:end -->
```

### `--report`

A consistency audit you can track over time. `--report` scores each convention plus a single **overall consistency score** (a file-count-weighted mean of the dominant shares), and shows the **trend** vs the previous run — so "are we drifting or tightening up?" is one number. Each run appends a snapshot to `.context/conventions-history.ndjson` and compares against the prior one.

```bash
sigmap conventions --report
sigmap conventions --report --json
```

```
[sigmap] conventions --report  (TS/JS/Python)
  overall consistency: 83% ▼17pp
  file naming    camelCase 67% [inconsistent] ▼33pp
  export style   named 100% [consistent] =
  test framework none detected
```

| Option | Description |
|--------|-------------|
| `--json` | Emit `{ conventions, testFramework, score, prevScore, scoreDelta }` |

The first run reports `(first run)` with no deltas; subsequent runs show ▲/▼ trend arrows in percentage points.

### `--ci`

Enforce convention consistency in CI. `--ci` computes the same overall consistency score as `--report` and **exits non-zero** when it falls below a threshold — so a PR that scatters new naming styles fails the build. With `--no-regress` it also fails when the score dropped vs the last recorded snapshot. It's read-only (it never writes to the history log — `--report` owns that).

```bash
sigmap conventions --ci                 # fail if consistency < 70%
sigmap conventions --ci --min 0.85      # stricter threshold
sigmap conventions --ci --no-regress    # also fail on any drop vs the last run
```

```
[sigmap] conventions --ci  ✗ FAIL — consistency 67% (min 70%)
  • consistency 67% below min 70%
```

| Option | Description |
|--------|-------------|
| `--min <n>` | Minimum overall consistency 0–1 (default 0.70) |
| `--no-regress` | Also fail if the score dropped vs the last `--report` snapshot (best-effort; skipped if there is no prior) |
| `--json` | Emit `{ score, min, ok, regressed, reasons }` |

Exit `0` = pass, `1` = below threshold or regressed. Pair with `--report` (which records the history) in a scheduled job, and `--ci` in the PR check.

### `--fix`

The complete, actionable rename checklist. Where `--conflicts` is a diagnostic summary (counts + up to 3 example files), `--fix` lists **every** source file whose name doesn't match the dominant convention, with full from→to paths — ready to paste into a task or PR. It's read-only (a checklist; it never renames anything).

```bash
sigmap conventions --fix
sigmap conventions --fix --json
```

```
[sigmap] conventions --fix  (TS/JS/Python)
  30 files to rename to camelCase:
  - [ ] src/cache/sig-cache.js  →  src/cache/sigCache.js
  - [ ] src/discovery/framework-detector.js  →  src/discovery/frameworkDetector.js
  …
```

| Option | Description |
|--------|-------------|
| `--json` | Emit `{ dominant, renames: [{from,to,fromStyle}], count }` |

A repo where every file already matches prints `no fixes needed`. Test files are skipped.

### `--update`

An incremental rescan. `--update` refreshes `.context/conventions.json` only when source files have changed since the last scan (by mtime vs the stored snapshot) — otherwise it reports "up to date" and skips the work. Useful in a pre-commit hook or watch loop where you want the snapshot current without paying for a full re-extraction every time.

```bash
sigmap conventions --update
sigmap conventions --update --json
```

```
[sigmap] conventions --update  ✓ up to date — 115 files, no changes since last scan
```

| Option | Description |
|--------|-------------|
| `--json` | Emit `{ stale, wrote, snapshotExists, changed, scanned }` |

The first run (no snapshot) does the initial scan; later runs rescan only when something is newer. This completes the `conventions` flag set.

---

## scaffold

Propose a **convention-matched structure** for a new module — but only when the repo's conventions are consistent enough. `scaffold <name>` reports a filename in the dominant naming style, the export style to use, and a matching test file. Below a confidence floor it **refuses** and surfaces the conflict, because a wrong proposal systematizes bad code.

```bash
sigmap scaffold "user profile loader"      # propose
sigmap scaffold "userProfile" --json       # machine-readable decision
sigmap scaffold "widget" --force           # propose below the soft threshold (not below the hard floor)
sigmap scaffold "widget" --ext ts          # set the file extension
```

```
[sigmap] scaffold "user profile loader"  — conventions mostly (77%)
  file:           userProfileLoader.js  (camelCase)
  export style:   named
  test file:      userProfileLoader.test.js
```

The proposal is gated by the **file-naming consistency** (the confidence):

| Confidence | Behavior |
|------------|----------|
| ≥ threshold (default 0.70) | propose |
| hard floor (0.50) ≤ c < threshold | refuse — unless `--force` (proposes with a warning) |
| < 0.50 (hard floor) | **always refuse** — not overridable, even with `--force` |

When it refuses, it prints the conflicting patterns (counts + example files) so you can fix the convention first. A refusal exits non-zero (useful in CI/scripts).

An **accepted** proposal is also persisted to `.context/scaffold/latest.md`, so [`create`](#create) and agents can read back the convention-matched proposal (the `--json` output gains a `persistedTo` field). A refusal writes nothing.

| Option | Description |
|--------|-------------|
| `--ext <e>` | File extension for the proposed files (default `js`) |
| `--threshold <n>` | Soft consistency threshold 0–1 (default 0.70; clamped to the 0.50 hard floor) |
| `--force` | Propose between the hard floor and the soft threshold (flagged with a warning); never below the floor |
| `--json` | Emit the full decision `{ ok, refused, tier, confidence, threshold, proposal, conflicts, persistedTo }` |

This is part of Layer 4 (grounded code generation); a `--naming-pattern` override is a planned follow-up.

---

## memory

One view over every cross-session store SigMap keeps in `.context/` — session, notes, weights, evidence pack, gain log, and usage log — with per-store entry counts, size on disk, and age. Clearing is explicit and per-store; the tracking stores (`gain`, `usage`) are listed for visibility but keep their own reset flows (`gain --reset`, `--no-track`).

```bash
sigmap memory                       # list all stores
sigmap memory --json                # machine-readable
sigmap memory --clear notes         # remove one store
sigmap memory --clear all           # session + notes + weights + evidence
```

```
[sigmap] cross-session memory (.context/)
  session       1 entries      393B  15m ago
  notes         12 entries    2.1KB  2h ago
  weights       8 entries     1.4KB  1d ago
  evidence      1 entries    11.5KB  7d ago
  gain       2148 entries   370.4KB  15m ago   (reset via its own command)
  usage         — empty   (reset via its own command)
  clear: sigmap memory --clear <session|notes|weights|evidence|all>
```

| Option | Description |
|--------|-------------|
| `--json` | Emit `{ stores: [{ store, path, exists, entries, bytes, modified, clearable }] }` |
| `--clear <store>` | Delete one store: `session`, `notes`, `weights`, `evidence`, or `all` (those four) |

No new storage is introduced — this reads the same files `note`, `learn`/`weights`, `evidence`, and the session engine already own.

---

## budget

Session spend ledger over the existing gain log — the estimated tokens **SigMap itself emitted** this session (chars/4, always labeled estimates; a CLI cannot see the host chat's total spend), an optional budget with remaining/percent-used, and the age of the generated context. Session identity is the `SIGMAP_SESSION` env var when the host agent sets one, else the UTC day bucket. Also exposed to agents as the MCP tool `get_budget`, which adds degrade-gracefully advice (terse encoding, `squeeze`, summarize-then-drop) at ≥80% budget.

```bash
sigmap budget                        # human summary for the current session
sigmap budget --json                 # machine-readable
sigmap budget --budget 50000         # one-off budget override
SIGMAP_SESSION=chat-42 sigmap budget # explicit session key
```

```
[sigmap] session spend (estimates — chars/4; SigMap-emitted tokens only)
  session   2026-08-18
  ops       14
  spent     ~3,900 tokens  (baseline ~41,200, saved ~37,300)
  budget    50,000 → remaining ~46,100 (7.8% used)
  context   0.2 day(s) old
```

| Option | Description |
|--------|-------------|
| `--json` | Emit the full status `{ session, unit, ops, spentTokens, baselineTokens, savedTokens, budgetTokens, remainingTokens, pctUsed, overBudget, context }` |
| `--session <key>` | Report on a specific session key instead of the current one |
| `--budget <tokens>` | Budget override for this invocation (persistent: config `sessionBudgetTokens`) |

Config: `sessionBudgetTokens` (budget threshold) and `contextTtlDays` (marks context `STALE` past the TTL) — both opt-in, `null` by default.

---

## redact

Mask secrets in **arbitrary text** — a log, a diff, an AI answer draft — before sharing it, using the same pattern bank that already redacts signatures at generation time, `get_lines` output, and evidence packs. Unlike the generation-time scanner (which replaces whole signature lines), `redact` masks only the matched substring, so surrounding text stays readable. Since **v8.49.1** `redact` additionally masks **unquoted** secret values (`password=…`, `api_key: …` — the common `.env`/YAML/CLI shape); that variant is text-only by design, because in code an unquoted value token is a type annotation (`password: PasswordHasher`) rather than a secret, so the signature scanner deliberately skips it. Redacted text goes to **stdout** (pipe-clean); the summary goes to stderr.

```bash
sigmap redact server.log              # redact a file
git diff | sigmap redact              # redact a stream
sigmap redact notes.md --json         # machine-readable result
```

```
x [REDACTED:AWS Access Key] y
[sigmap] redact: masked 2 secret(s) — AWS Access Key×1, Generic Secret×1
```

| Option | Description |
|--------|-------------|
| `--json` | Emit `{ text, redacted, findings: [{line, pattern}], counts }` instead of raw text |
| *(no file)* | Read from stdin (piped input) |

**Patterns covered (16).** AWS access/secret keys, GCP API keys, GitHub tokens, JWTs, DB connection strings, SSH private keys, Stripe keys, Twilio keys, generic `password=`/`api_key=` assignments, and — since **v8.54.1** — **Slack tokens**, **Slack webhooks**, **Anthropic keys**, and **OpenAI keys** (both the `sk-proj-` and legacy forms).

::: tip Why the `sk-` family was missing until v8.54.1 (#771)
The gap was one character. `sk_live_`/`sk_test_` (Stripe) uses an **underscore**; OpenAI and Anthropic use a **hyphen**, so the Stripe pattern never covered them and the three most common modern API-key formats passed through a command whose whole job is keeping secrets out of an AI context file. The new patterns are anchored with `\b`, so `sk-` cannot match inside an ordinary hyphenated word like `risk-`.
:::

---

## note

Append a note to a cross-session decision log so an agent (or you) can recall *what we were doing and why* later. Notes are stored as append-only NDJSON at `.context/notes.ndjson` (text + ISO timestamp + git branch). Running `note` with no text lists recent notes.

```bash
sigmap note "switched auth to JWT; refresh-token flow still TODO"
sigmap note               # list the last 10
sigmap note --list 25     # list the last 25
sigmap note --json        # machine-readable
```

```
[sigmap] noted (feat/auth): switched auth to JWT; refresh-token flow still TODO
```

| Option | Description |
|--------|-------------|
| `--list <N>` | List the most recent N notes instead of appending |
| `--json` | Emit `{ added }` (on append) or `{ notes }` (on list) |

The same log is surfaced to agents through the [`read_memory` MCP tool](/guide/mcp). See the [Memory & notes guide](/guide/memory).

### Notes reach retrieval (v8.54.2)

Until v8.54.2 the notes log was **write-only** (#776). Every reader in the shipped tree was `note` listing its own notes, [`status`](#status) counting them, or the `read_memory` MCP tool — never `ask`, `--query`, the ranker, `plan` or `evidence`. A note saying *"the redaction logic lives in `src/security/patterns.js`"* could not influence a query about redaction, which is the one thing a decision log exists for.

A note now participates in retrieval when it is **relevant to the query**:

- notes are scored against the query with the ranker's own tokenizer;
- a relevant note **boosts the files whose paths it names**, so a file the lexical ranker missed can rise into the selection;
- matching notes render into `.context/query-context.md` under a `## Notes` heading, and are summarised in `ask` output, so the agent consuming the context sees the human's answer first.

```
 Notes     : 1 matching (redaction logic for Slack tokens lives in src/sec…)
```

Three properties keep it from becoming noise:

| Property | Behaviour |
|---|---|
| **Gated** | Only notes clearing a relevance floor participate — notes never leak into unrelated queries |
| **Bounded** | The most recent notes are considered, branch-scoped as the store already is |
| **Inert when unused** | With no notes present, output is byte-identical to before — so a repo that never ran `note` is unaffected |

The boost is **additive and scaled to the query's own top score**, not a multiplier and not a constant. A multiplier cannot lift a zero-scoring file, and zero is exactly the case a note is most valuable in: the ranker found no lexical overlap and a human already knew the answer. Scores span roughly 4–30 depending on query and repo, so an absolute constant would be decisive on one query and invisible on another.

The ranking core is untouched — the boost is applied by `ask` after ranking, never inside `rank()`, so retrieval benchmarks are unaffected (`validate:retrieval` mined **+0.0pp**).

---

## status

Repo state at a glance — useful before kicking off a task or in a pre-commit check.

```bash
sigmap status
sigmap status --json
```

```
[sigmap] status
  Branch:        feat/auth-refresh
  Working tree:  3 files changed
  Last index:    2h ago (v8.58.0, 412 files) — from .context/sig-index.json — STALE: 5 files changed since
  Notes:         7 (latest: switched auth to JWT; refresh-token flow still TODO)
```

`Last index` compares the index time against your source files' mtimes, so you can see whether the context an agent is using is stale.

::: warning It no longer says `never` just because tracking is off (v8.58.0)
`Last index` used to come solely from the usage log (`.context/usage.ndjson`), which exists **only** under `--track` / `config.tracking` — so by default `status` reported `never — run: sigmap` about an index [`doctor`](#doctor) was simultaneously calling up to date (#664).

It now resolves through three sources in order, and **says which one it used**:

| Source | When | Carries |
|---|---|---|
| `usage log` | tracking on | run timestamp, version, file count |
| `.context/sig-index.json` | any full run — the default | its own `generated` stamp, version and file count |
| `context file mtime` | index absent, context file present | timestamp only |

`status` and `doctor` now count changed-since over the same population from the same timestamp, so the two cannot disagree about whether your index is fresh.
:::

| Option | Description |
|--------|-------------|
| `--json` | Emit `{ branch, dirty, lastIndex, indexSource, indexVersion, indexFiles, changedSinceIndex, notes, lastNote }` |

---

## learn

Manual feedback loop for the ranker. Learned weights live in `.context/weights.json` and are always local to the repo.

```bash
sigmap learn --good src/auth/service.js
sigmap learn --bad src/legacy/old-api.js
sigmap learn --good src/auth/service.js --bad src/legacy/old-api.js
sigmap learn --reset
```

Each non-reset mutation decays existing weights first, then applies boosts/penalties in one transaction. Paths outside the repo are ignored, missing files are skipped with warnings, and the command exits non-zero if no valid file paths remain.

---

## weights

Show the learned multiplier table used by `sigmap ask`, `sigmap --query`, `sigmap validate --query`, and MCP `query_context`. Export and import weights for team sharing or CI seeding.

```bash
sigmap weights
sigmap weights --json
sigmap weights --export weights.json
sigmap weights --export              # prints JSON to stdout (pipe-friendly)
sigmap weights --import weights.json
sigmap weights --import weights.json --replace
```

Human output is sorted highest boost first and includes a reset hint. JSON output emits the exact `.context/weights.json` object.

| Option | Description |
|--------|-------------|
| `--json` | Print weights as JSON (same format as export) |
| `--export [file]` | Write weights JSON to `file`, or stdout if no path given |
| `--import <file>` | Merge imported weights into local store (preserves existing entries) |
| `--import <file> --replace` | Replace local weights entirely with the imported set |

Imported values are sanitized (path traversal rejected) and clamped to `[0.30, 3.0]`.

---

## --coverage

Enable test coverage annotation at runtime without editing `gen-context.config.json`. Adds `✓` (tested) or `✗` (untested) markers to each function signature in the generated context.

```bash
sigmap --coverage
sigmap --coverage --adapter claude
```

Equivalent to setting `testCoverage: true` in config, but applied only for the current run. Useful for PR reviews and one-off audits.

---

## doctor

One-shot setup diagnostic. Runs nine resilient checks — git repository, config & source roots, source files in scope, the generated context file, the signature index, index freshness, coverage, the model profile, and MCP wiring — and prints an **actionable fix** for anything that is wrong or stale. Use it the moment SigMap "isn't working" or an answer looks thin; it tells you exactly what to run next.

```bash
sigmap doctor
```

```text
sigmap doctor

✓ Git repository — recency boost + impact analysis enabled
✓ Config & source roots — srcDirs: src, packages
✓ Source files in scope — 176 in scope · 4 outside (2%) — 2.js 1.mjs 1.sh in ., public-benchmarks
✓ Generated context — 1 file(s): .github/copilot-instructions.md
✓ Signature index — 179 in-scope file(s) indexed · 268 beyond srcDirs (256 test, 10 CI, 2 entrypoint)
⚠ Index freshness — 1 source file(s) changed since last generate (from .context/sig-index.json)
    ↳ run: sigmap   (or: sigmap --watch to auto-refresh)
✓ Coverage — in-context 71% (54/76 scoped source files) grade B
✓ Model profile — as of 2026-10-04 (shipped profile) · no roster declared — advice names the shipped defaults
✓ MCP wiring — registered in .claude/settings.json

0 error(s), 1 warning(s).
```

::: tip The model profile check (v8.63.0)
Every model name, price and context window SigMap prints comes from one dated table, and nothing refreshes it — there is no live fetch. Its age is therefore the only freshness signal there is. The check warns once the profile in force is more than **90 days** old, and when your [`models.roster`](/guide/config#models) names a model with no price on record:

```text
⚠ Model profile — as of 2026-10-04 (shipped profile) is 91 days old (limit 90) — model names, prices and windows may have changed
    ↳ check your vendors' pricing pages, then set "models.asOf" and any changed figures in gen-context.config.json — or upgrade sigmap
```

Setting `models.asOf` to the date you verified your figures clears it; so does upgrading to a release with a newer shipped profile.
:::

::: tip Source files in scope (v8.56.0)
`Coverage` above is measured *over* `srcDirs`, so it cannot see a file the detector never selected — which is how a flat Go layout reported a healthy percentage while the codebase was invisible (#805). The `Source files in scope` check measures the **population itself**: implementation files that fall outside every `srcDir`.

It warns only above a **10% share**, and counts implementation only — tests, docs, CI, mocks and tooling directories are legitimately outside `srcDirs`. A wrongly-configured flat repo reads:

```text
⚠ Source files in scope — 10 of 13 implementation file(s) are OUTSIDE srcDirs (77%) — 10.go in .
    ↳ run: sigmap roots --fix   or widen "srcDirs" in gen-context.config.json
```
:::

::: tip The index check splits its population (v8.58.0)
`Signature index` used to print one bare total — `447 file(s) indexed` — over a population `generate` deliberately widens past `srcDirs`, so it read as coverage of the source tree and never surfaced a genuinely stale entry (#770). It now reports the three classes as what they are, and **warns** when the last is non-empty:

```text
⚠ Signature index — 179 in-scope file(s) indexed · 268 beyond srcDirs (256 test, 10 CI, 2 entrypoint) · 1 stale
    ↳ 1 indexed file(s) no longer exist (e.g. src/beta.js) — run: sigmap   (a full run prunes them)
```

`Index freshness` names the evidence it used (`from .context/sig-index.json`), and will not say *"index is up to date with sources"* while the index holds stale entries, however current the mtimes are. See [`validate`](#validate) for what counts as augmented versus stale.
:::

::: tip Coverage figures name their population (v8.52.0)
Four commands report coverage and they measure different things, so each one says which:

| population | meaning | surface |
|---|---|---|
| `in-context` | survived the token budget — what the agent actually sees | `doctor`, `--report` |
| `indexed` | present in the retrieval index, budget or not | `validate` |
| `readable` | readable on disk under `srcDirs` — an access check | `--health` |

Different numbers are expected; an unlabelled one is a bug. Before v8.52.0 `doctor` fed the
retrieval index to the coverage scorer and printed *"of source files in context"*, so it could
claim 100% while the run that built that context reported 54%.
:::

Each line is `✓` (ok), `⚠` (warning), or `✗` (hard failure); every non-ok line carries a `↳` fix. `--json` emits the full result (`{ checks, ok, errors, warnings }`) for tooling. The command **exits 1** when a hard check fails (no context file, or invalid `gen-context.config.json`) and **0** otherwise — drop it into CI as a setup gate.

| Option | Description |
|--------|-------------|
| `--json` | Emit the machine-readable result (`{ checks:[{id,label,status,detail,fix}], ok, errors, warnings }`) |

---

## wiki

Deterministic architecture narrative (v8.12.0, D9). Writes `.context/WIKI.md` composed entirely from data SigMap already computes — no LLM, no network, no timestamps, so two runs on an unchanged repo are **byte-identical**. Sections: **Overview** (indexed files, modules, signature tokens, health grade), **Modules** (rollup with key files), **Dependency flow** (hub files with the widest blast radius, entry points, cycle count), **Conventions** (naming / export style / test framework), and **Navigating** (the `ask` / `--impact` / `evidence` / MCP pointers a newcomer needs). The one-page onboarding doc for a new contributor or agent.

```bash
sigmap wiki                    # writes .context/WIKI.md
sigmap wiki --out docs/ARCH.md # custom path
sigmap wiki --json             # structured data to stdout (no file)
```

```text
$ sigmap wiki
[sigmap] wiki → .context/WIKI.md (143 files · 2 modules)
```

| Option | Description |
|--------|-------------|
| `--out <path>` | Write the markdown to a custom path instead of `.context/WIKI.md` |
| `--json` | Print the structured data (`{ name, version, files, modules, flow, conventions, health }`) to stdout; writes no file |

---

## mcp install · mcp list

Targeted, one-command MCP wiring for a **single** client. Where `--setup` wires every editor at once (and only touches configs that already exist), `mcp install` picks one client and **creates** its config dir/file when absent — the fast path to a working MCP setup.

```bash
sigmap mcp list                  # see clients + their config paths
sigmap mcp install claude        # wire one client
sigmap mcp install windsurf --global   # user-level config instead of project
```

```text
$ sigmap mcp list
Supported MCP clients:

  claude     Claude Code
             .claude/settings.json  [project]
  cursor     Cursor
             .cursor/mcp.json  [project]
  windsurf   Windsurf
             .windsurf/mcp.json  [project (or --global)]
  ...
  zed        Zed
             ~/.config/zed/settings.json  [global]
  codex      Codex CLI
             ~/.codex/config.yaml  [global]

$ sigmap mcp install claude
[sigmap] Claude Code: registered MCP server in .claude/settings.json
```

Supported clients: `claude`, `cursor`, `windsurf`, `vscode`, `zed`, `codex`, `gemini`, `opencode`, and `mcp` (portable `.mcp.json`). The command emits the correct shape per client — `mcpServers` JSON, VS Code `servers`, Zed `context_servers`, or Codex YAML — and is **idempotent**: a second run reports that sigmap is already registered and never duplicates the entry. An unknown client name exits non-zero and lists the valid clients.

**VS Code (v8.30.0).** VS Code reads a top-level `servers` key with an explicit transport `type`, not the generic `mcpServers` shape. Earlier versions wrote `mcpServers` into `.vscode/mcp.json`; the file was created, the command reported success, and VS Code silently ignored it — so GitHub Copilot never saw the server. `mcp install vscode` now writes:

```json
{ "servers": { "sigmap": { "type": "stdio", "command": "node", "args": ["…", "--mcp"] } } }
```

A config written by an earlier version is **migrated** rather than left in place: the stale `mcpServers.sigmap` entry is moved under `servers` and reported as `updated`, so re-running repairs a broken setup. Unrelated servers and other top-level keys (such as VS Code's `inputs`) are preserved.

| Option | Description |
|--------|-------------|
| `--global` | Write the user-level config for clients that have both a project and a global scope (Windsurf, OpenCode) |
| `--json` | (`mcp list`) Emit the client array with resolved target paths |

---

## validate

Validates your SigMap configuration and measures context coverage. Checks that every `srcDir` exists, exclude patterns are safe, `maxTokens` is in a sensible range, and that ≥ 70% of your source files are in context. With `--query`, it also reports a **retrieval-confidence signal** (v8.10.0): for a natural-language query like `"login rate limit"` it ranks the context and reports the top file, its score, and a confidence tier (none/low/medium/high) — where earlier it silently did nothing for lowercase queries. If the query literally names a PascalCase/camelCase symbol, it additionally confirms that symbol lands in the top-5.

```bash
sigmap validate
sigmap validate --json
sigmap validate --query "login rate limit"
sigmap validate --query "loginUser validateToken"
```

```
[sigmap] ✓ config valid  coverage: indexed 98% (185/189 files)  — 4 not indexed, 276 beyond srcDirs (264 test, 10 CI, 2 entrypoint)
[sigmap] ✓ query "login rate limit" → src/rate/limiter.js (score 8.42, confidence high)
```

**Coverage is an intersection (v8.49.2).** It is `|indexed ∩ in-scope| / |in-scope|`, so it is bounded at 100% by construction. Earlier releases divided the persisted index size by the current file list — two different populations, since the index can still hold files the config no longer scopes (deletions, `srcDirs` changes, a strategy switch) — which produced impossible figures such as 218%.

**One function, shared with `--ci` (v8.61.2).** The intersection above was fixed here in v8.49.2 and the old quotient survived in [`--ci`](#ci), which was still gating releases on 241%. Both now call `indexedCoverage` and report the same labelled figure for the same repo, and the guard that pins it is structural — a surface that recomputes the figure fails the suite even when today's number happens to match.

A repo with an **empty in-scope set** now reports `100%`, not `0%`, and no longer warns that 0% is below the recommended 70%. Nothing in scope means nothing left uncovered; this is the convention [`doctor`](#doctor), [`--report`](#report) and [`--health`](#health) already used, and `validate` was the one surface disagreeing.

The residuals are reported separately because they mean different things:

| Field | Meaning | What to do |
|--------|---------|------------|
| `notIndexed` | In scope, missing from the index | Raise `maxTokens` or widen `srcDirs` — this is missing context |
| `augmentedEntries` | Indexed on purpose from outside `srcDirs` — tests, CI, declared entrypoints | Nothing. This is how `ask` reaches them |
| `missingEntries` | Indexed, no longer on disk | Re-run `sigmap` — a full run prunes them |
| `outOfScopeEntries` | On disk, outside `srcDirs`, with no test/CI/entrypoint role | Widen `srcDirs`, or run `sigmap roots --fix` — a re-run will not clear it |

`staleEntries` is `missingEntries + outOfScopeEntries`.

::: warning The index is wider than `srcDirs` — on purpose (v8.58.0)
`generate` writes the index over an **augmented** population: the `srcDirs` walk, widened by the declared `package.json` entrypoints, every test root (`test/`, `tests/`, `__tests__/`, `spec/`, `e2e/`) and every CI definition. All three widenings are deliberate — they are how [`ask`](#ask) reaches code that lives outside `srcDirs` *by construction*, such as `.github/workflows/`, which is a root dotdir no source-root detector will ever select.

Until v8.58.0 `validate` measured that index against the **un-widened** list, so every widened entry read as stale. On the SigMap repo that was `266 stale` — 256 under `test/`, 10 under `.github/`, **none of them stale** — followed by advice to re-run `sigmap`, which could not change the number because nothing was broken (#770).

Stale is now only what the shared classifier cannot justify, and each class carries the remedy that actually fixes it:

```
[sigmap] ⚠  stale index entries: 1 indexed file(s) no longer exist (e.g. src/beta.js) — run: sigmap   (a full run prunes them)
[sigmap] ⚠  stale index entries: 2 indexed file(s) are outside srcDirs with no test/CI/entrypoint role (e.g. scripts/tool.js) — widen "srcDirs" in gen-context.config.json, or run: sigmap roots --fix
```

The deleted-file case was not merely mis-reported — it was unactionable. `.sigmap-cache.json` was written back whole and never pruned, and the ranker merges that cache into the retrieval index, so a deleted file stayed indexed until a version bump busted the cache. `generate` now prunes it, keyed on **existence only** so a per-package monorepo run cannot evict another package's entries.

[`doctor`](#doctor) and [`status`](#status) read the same primitive (`src/analysis/index-state.js`), which also exports the collector roots `generate` itself imports — so the collector and the classifier cannot drift.
:::

**The population itself is now checked (v8.56.0).** Coverage is computed *over* `srcDirs`, so it cannot see a file the detector never selected. On a flat Go layout that produced a comfortable `indexed 67% (2/3 files)` while ten of thirteen source files were invisible — the figure was not wrong about its own population; nothing disclosed that the population was wrong (#805). `validate` now reports implementation files that fall **outside** every `srcDir`:

```
[sigmap] ⚠  10 of 13 implementation file(s) OUTSIDE srcDirs (77%) — 10.go
[sigmap]    in: .
[sigmap]    srcDirs is (internal, render, testdata) — widen it or set "srcDirs" explicitly
```

It is graded on **share, not raw count**, and counts implementation only: tests, docs, CI, mocks and the conventional tooling directories (`test/`, `scripts/`, `benchmarks/`, `examples/`, …) are routinely and correctly outside `srcDirs`, and are reported as `skipped` rather than as a miss. Below 10% nothing is printed — a couple of root-level entrypoints outside `srcDirs` is an ordinary layout, and a check that fires on a correct configuration teaches you to ignore it. [`doctor`](#doctor) carries the same figure as its `srcdirs-coverage` check.

JSON output includes `valid`, `issues`, `warnings`, `coverage`, `indexedInScope`, `notIndexed`, `staleEntries`, `augmentedEntries`, `augmentedByReason` (`{ test, ci, entrypoint }`), `missingEntries`, `outOfScopeEntries`, `totalFiles`, `outsideSrcDirs` (`{ total, byExt, dirs, skipped, inScope, share }`), and — when `--query` is given — a `query` report (`{ text, topFile, topScore, confidence }`). Exits `1` when hard issues are found.

---

## roots

Auto-detect source root directories for your project using intelligent multi-signal analysis: language detection, framework identification, file density, git activity, and manifest files. Returns a ranked list with confidence levels (high/medium/low) and detailed scoring explanation. Supports 17 languages and 50+ frameworks (Next.js, Django, Rails, Spring Boot, Flutter, Go, Rust, etc.). Also detects monorepos and enumerates all sub-packages.

Useful when you're unsure which directories to include in `srcDirs` config, or when setting up SigMap in a new project.

```bash
sigmap roots --explain
sigmap roots --json
sigmap roots --fix
```

**`--explain` (default)**
Shows detected languages, frameworks, confidence level, selected root directories, and scoring details:

```
sigmap roots --explain

Detected languages   : TypeScript (tsconfig.json), JavaScript (.ts/.tsx files)
Detected frameworks  : Next.js (next.config.js), React (package.json dep)
Monorepo             : no  (no: no workspace marker and no sibling packages)

Selected roots:
  1. app/        — confidence: high — score: 8.5 (framework match +3.0, density +2.5, entrypoint +1.5)
  2. src/        — confidence: high — score: 7.2 (density +2.5, symbols +2.0)
  3. lib/        — confidence: medium — score: 4.1 (git activity +2.0, density +2.1)
  4. components/ — confidence: low   — score: 2.0

Explanation: Next.js app detected; app/ and src/ are primary Next.js directories with high confidence. lib/ has recent git activity. Max roots capped at 6.
```

**`--json`**
Outputs structured JSON:

```
{
  "roots": ["app", "src", "lib"],
  "languages": [{ "name": "typescript", "weight": 3.5 }, ...],
  "frameworks": [{ "name": "nextjs", "confidence": 0.95 }, ...],
  "confidence": "high",
  "isMonorepo": false,
  "monorepo": { "isMonorepo": false, "source": "none", "evidence": "no: no workspace marker and no sibling packages", "marker": null, "packages": [] },
  "explanation": [...]
}
```

### Flat layouts: the repo root is a source root (v8.56.0)

Candidate detection used to walk **directories only**, so on a flat layout — the normal shape of a Go module — `.` could never be selected however much source sat there. A fresh `gin` clone detected `["internal","binding","render","codec","ginS","testdata"]` and left `gin.go`, `routergroup.go`, `context.go` and `tree.go` invisible, having preferred `testdata` — a fixture directory the go tool ignores outright (#805).

Two **structural** signals now qualify the root:

| Signal | Rule |
|---|---|
| Go module | `go.mod` at the root with at least one root-level `.go` file — a Go module root *is* a package, which is the toolchain's own model |
| Generic share | the root holds **≥20%** of the tree's code files (minimum 3 files) |

Chosen by measuring all 43 cached benchmark repos rather than by tuning a ratio: together they select exactly the four Go modules (`cobra`, `echo`, `gin`, `gorm`) and change nothing else. Every non-Go repo there has **zero** root-level `.go` files and sits at or below 4% share. `gorm` is at 10%, which is why the `go.mod` rule is structural rather than a threshold.

When the root is selected it **replaces** its subdirectories rather than joining them, so a flat layout resolves to `["."]` and the same files are not walked twice. `testdata`, `test-data`, `__fixtures__`, `snapshots` and `__snapshots__` are never preferred as roots.

### One monorepo verdict, with its evidence (v8.56.0)

Three detectors used to answer this question and they disagreed: a marker-based pair (in the source-root resolver, duplicated in `tune`) required `pnpm-workspace.yaml`, `turbo.json`, `nx.json`, `lerna.json` or `package.json.workspaces`, while a separate layout scan looked for sibling manifests. On a repo with `packages/core` and `packages/cli` but no marker, `roots` and `tune` reported **no** while `--monorepo` processed both packages, and `tune` never proposed `monorepo: true` for a layout the mode supports (#781).

One detector answers it now, and it names **how** it decided — a declared workspace and a layout-only match are different facts:

```
Monorepo: yes  (layout: 2 manifests under packages/)
Monorepo: yes  (marker: pnpm-workspace.yaml)
Monorepo: no   (no: 1 package under packages/ (needs 2))
```

A layout match needs **two or more** sibling packages: one package under `packages/` is an ordinary single-package layout. Manifests counted are `package.json`, `pyproject.toml`, `Cargo.toml`, `go.mod`, `build.gradle(.kts)`, `pom.xml`, `requirements.txt`, `pubspec.yaml` and `mix.exs`, so a polyglot workspace is recognised. A declared workspace is `pnpm-workspace.yaml`, `turbo.json`, `nx.json`, `lerna.json`, `melos.yaml`, `package.json` `workspaces`, a `workspace:` key in the root `pubspec.yaml` (a Dart pub workspace) or an `apps_path:` in the root `mix.exs` (an Elixir umbrella project); `melos.yaml` and the `pubspec.yaml` and `mix.exs` forms were added in v8.67.0, and a Dart or Elixir workspace is indexed as its members' `lib/` directories. [`tune`](#tune) uses the same string as its recommendation reason.

**`--fix`**
Interactive mode: prompts you to review and correct the detected roots, then writes the corrected list to `gen-context.config.json`:

```
Detected roots: app, src, lib

✏️  Edit and confirm (or type new dirs). Press Enter to accept:
> app, src, lib, utils

Writing to gen-context.config.json...
✓ Updated srcDirs: ["app", "src", "lib", "utils"]
```

---

## tune

Deterministic config optimizer (v8.25.0). Packages the discovery stack (`resolveSourceRoots`, workspace markers, client-artifact probes) into a **recommended config diff** with one evidence-naming reason per change — the answer to the #1 onboarding failure: a bad or default config. Read-only by default; explicit user choices are never proposed against.

```bash
sigmap tune               # print recommendations (writes nothing)
sigmap tune --apply       # merge them into gen-context.config.json
sigmap tune --json        # machine-readable proposal (for agents)
```

```
[sigmap] tune: 3 recommended change(s)
  srcDirs        null → ["src"]
                 reason: pin the 1 detected source root(s) [confidence medium] — explicit srcDirs are stable across runs and protected from budget drops
  monorepo       false → true
                 reason: workspace marker found: pnpm-workspace.yaml
  adapters       ["copilot"] → ["copilot","claude","cursor"]
                 reason: client files present: CLAUDE.md, .cursorrules

  apply with: sigmap tune --apply   (then: sigmap validate)
  detection: roots [src] · confidence medium · monorepo yes
```

Five rules, each deterministic:

| Rule | Fires when | Reason names |
|------|------------|--------------|
| `srcDirs` | unpinned + detection confidence ≥ medium | the detected roots + confidence (pinned srcDirs are protected from token-budget drops) |
| `monorepo` | a workspace marker exists and the mode is off | the marker found (`pnpm-workspace.yaml`, `turbo.json`, `nx.json`, `lerna.json`, `melos.yaml`, package.json `workspaces`, `pubspec.yaml workspace`, `mix.exs apps_path`) |
| `adapters` | a client artifact has no matching adapter | the files found (`CLAUDE.md`, `.cursorrules`, `.windsurfrules`, `AGENTS.md`) — additive only |
| `exclude` | a curated vendored/generated dir sits unexcluded at root | the dirs found (`third_party`, `external(s)`, `generated`, `testdata`, …) — defaults preserved |
| `autoMaxTokens` | a pinned budget is below the repo's ~25-tokens/file estimate | the file count (labeled heuristic) |

| Option | Description |
|--------|-------------|
| `--apply` | Write the recommendations into `gen-context.config.json` (merges; every existing user key preserved; idempotent — a second `tune` proposes nothing) |
| `--json` | Emit `{ changes: [{key, current, recommended, reason}], detection, configExists }` |
| `--dry-run` | Alias of the read-only default |

---

## skills

Install SigMap's agent playbooks in each client's **native** skill/rules format (v8.26.0) — the multi-adapter idea applied to skills. Three skills ship:

- **sigmap-usage-maximizer** — the spend-minimizing loop: `ask` before any read → `get_lines` for anchored ranges → `verify_suggestion` before trusting → `squeeze` big pastes → checkpoint → watch `get_budget` and summarize-then-drop near budget.
- **sigmap-task** (v8.30.0) — an **invokable** loop for environments where MCP is unavailable, driven entirely from the CLI. Where the maximizer is an always-on playbook that mostly names MCP tools, this one is a prompt the user calls deliberately and every step is a shell command: `sigmap ask` → read `.context/query-context.md` → open only the anchored line ranges → make the change → `sigmap verify-ai-output` → regenerate → report. For Copilot it installs as a prompt file, so `/sigmap-task <your change>` runs it in agent mode.
- **sigmap-config-optimizer** — the `tune` playbook: detect → review reasons → `--apply` → `validate`.

Deterministic content with a version footer; installs are idempotent and human content is never touched.

```bash
sigmap skills list                     # clients, targets, install state
sigmap skills install                  # wire every *detected* client
sigmap skills install --client cursor  # force one client (creates dirs)
sigmap skills install --all --json     # everything, machine-readable
```

```
  claude     installed  .claude/skills/sigmap-usage-maximizer/SKILL.md
  claude     installed  .claude/skills/sigmap-task/SKILL.md
  claude     installed  .claude/skills/sigmap-config-optimizer/SKILL.md
  copilot    installed  .github/instructions/sigmap-usage-maximizer.instructions.md
  copilot    installed  .github/prompts/sigmap-task.prompt.md
  copilot    installed  .github/instructions/sigmap-config-optimizer.instructions.md
  codex      updated    AGENTS.md
```

| Client | Target |
|--------|--------|
| `claude` | `.claude/skills/<skill>/SKILL.md` (frontmatter name/description) |
| `cursor` | `.cursor/rules/<skill>.mdc` |
| `windsurf` | `.windsurf/rules/<skill>.md` |
| `copilot` | `.github/instructions/<skill>.instructions.md`; prompt-kind skills go to `.github/prompts/<skill>.prompt.md` |
| `codex` | marker-delimited block in `AGENTS.md`, inserted **above** the `## Auto-generated signatures` marker — survives `sigmap` regeneration |

| Option | Description |
|--------|-------------|
| `--client <name>` | Install for one client, creating its dirs/files (like `mcp install`) |
| `--all` | Install for every supported client |
| *(no flag)* | Wire only clients whose parent artifact already exists (`.claude/`, `.cursor/`, `.windsurf/`, `.github/`, `AGENTS.md`) — the `--setup` precedent |
| `--json` | Machine-readable list / install results (`installed` \| `updated` \| `already`) |

---

## lines

Print an exact range of a file — the CLI twin of the `get_lines` MCP tool (v8.31.0). Where MCP is unavailable, `sigmap ask` hands an agent precise `:start-end` anchors and, without this, no sanctioned way to spend them: it falls back to reading whole files and throws the saving away. Measured on a real Copilot session, an agent read 2,659 tokens via `sed -n '1,220p'` where the anchored window needed 217.

```bash
sigmap lines src/graph/builder.js 447-451     # an explicit range
sigmap lines src/graph/builder.js :447         # a window around one line
sigmap lines src/graph/builder.js :447 --context 20
```

````text
$ sigmap lines src/graph/builder.js :447 --context 2
# src/graph/builder.js:445-449
```
 * @returns { forward: Map<string,string[]>, reverse: Map<string,string[]> }
 */
function buildFromCwd(cwd, opts) {
  // R-package layouts use `R/` and `inst/`; Shiny apps put helpers in `R/`.
```
````

The `:447` form takes an anchor **pasted straight off a signature** — `ask` prints `buildFromCwd(cwd, opts) → { forward: …  :447-501`, and that string is the argument.

It delegates to the same handler as MCP, so both paths share the project-root sandbox, the end-of-file clamping and the secret redaction. A range beyond the end of the file clamps rather than failing; a path resolving outside the project is refused.

| Option | Description |
|--------|-------------|
| `--context <n>` | Lines either side of a `:<line>` anchor (default 10). Ignored for an explicit range |

Exit codes: `0` printed · `1` missing file, refused path, or a start past end-of-file · `2` usage error or an unparsable range.

---

## history

Display the last N recorded runs as a table with Unicode sparklines for token trend, retrieval hit@5, and token-reduction benchmark history.

Since **v8.53.0** this reads the same source as `--health` and the dashboard, so runs appear without any opt-in: `tracking: true` (or `--track`) adds the richer per-run fields — file counts and over-budget flags — but is no longer required for rows to show at all. Previously `history` read only the tracked log, which `tracking: false` (the default) never writes, so it reported *"No usage log entries"* on repos with hundreds of recorded runs.

```bash
sigmap history
sigmap history --last 20
sigmap history --json
```

```
──────────────────────────────────────────────────────────────
 sigmap history  (last 10 of 524 runs · gain.ndjson)
──────────────────────────────────────────────────────────────
 Date                     Files  Tokens Reduction Budget?
 ──────────────────────── ───── ─────── ───────── ───────
 2026-09-29 21:04:01          —   14973     97.6%       —
 ...
──────────────────────────────────────────────────────────────
 Token trend: ▁▂▃▄▃▄▅▆▇█
 hit@5 trend: ▃▄▅▆▇█  90.5% (latest)
 tok reduce : ▅▆▇█▇█  97.2% (latest)
──────────────────────────────────────────────────────────────
```

The `hit@5` and `tok reduce` rows appear only when `.context/benchmark-history.ndjson` exists — it is created automatically the first time you run any of the benchmark scripts (`run-retrieval-benchmark.mjs`, `run-benchmark.mjs`, or `run-task-benchmark.mjs`). The dashboard hit@5 trend chart reads from the same file.

With `--json` returns a raw JSON array of usage log entries.

---

## suggest-profile

Read the last git commit message and staged files, then recommend the best context profile.

```bash
sigmap suggest-profile
sigmap suggest-profile --short   # prints only the profile name
```

```
[sigmap] suggested profile: --profile debug
  Reason: commit: "fix: null pointer in UserService.findById"
```

Profiles: `debug`, `architecture`, `review`, `default`.

---

## compare

Human-readable CLI wrapper for the retrieval benchmark. It has **two modes**, chosen by whether the benchmark corpus is present.

**In the SigMap source checkout** (where `scripts/run-honest-benchmark.mjs` and `benchmarks/tasks/` exist) it runs the honest corpus live — 125 tasks across 19 repos — and reports SigMap against a single-shot grep agent.

**Anywhere else** — including an npm-installed copy, where the runner and corpus are not published — it renders *your own* recorded numbers from `.context/benchmark-history.ndjson` instead. It never spawns the benchmark and never writes outside the current directory. Use `--run` to demand the live comparison; it exits 1 with an explanation when the corpus is unavailable rather than falling back.

```bash
sigmap compare           # live comparison in the checkout, local history elsewhere
sigmap compare --run     # live comparison only; exit 1 if the corpus is missing
sigmap compare --json
```

```
────────────────────────────────────────────
 SigMap vs grep agent
────────────────────────────────────────────
 hit@5         89.6% vs 40.0%   (2.24× lift)
 Corpus        125 tasks · 19 repos (honest split)
 Token cut     95.7% average (saved benchmark, 21 repos)
────────────────────────────────────────────
```

The baseline is the [honest grep-agent corpus](/guide/retrieval-benchmark) — the same claim
README, this site and `benchmarks/latest.json` publish, so the command cannot advertise a
different number from the project. It previously scored against random selection and
reported a 4.9× lift, and printed a token "baseline" derived from an assumed 4,000 tokens
per file. The token row now carries the measured average, labelled as coming from the saved
benchmark rather than from this run.

Progress goes to stderr, so `sigmap compare --json` pipes cleanly into a parser.

---

## share

Print a shareable one-liner with live benchmark numbers and copy it to the clipboard.

```bash
sigmap share
```

```
Generated with SigMap — the deterministic, verifiable grounding layer for AI code work
95.7% fewer tokens · 78% retrieval accuracy (this repo) · 2.20× vs a grep agent (published)
https://sigmap.io
[sigmap] Copied to clipboard.
```

On a repo that has never been benchmarked there are no local numbers to print, and
`share` says so rather than substituting any:

```
Generated with SigMap — the deterministic, verifiable grounding layer for AI code work
not benchmarked locally yet — run `sigmap compare` · 2.20× vs a grep agent (published)
https://sigmap.io
```

::: warning Every number here is traceable (v8.52.1)
Local figures are labelled `(this repo)` and come from `.context/benchmark-history.ndjson`;
the lift is labelled `(published)` and is read from `benchmarks/latest.json` — the same source
[`compare`](#compare) reads, so the two commands cannot advertise different multipliers.

Before v8.52.1 this line ended with the literal `6× better results`, measured nowhere and
roughly three times the published 2.12×, and a repo with no history emitted a hardcoded
`97% fewer tokens · 88% retrieval accuracy` as if those were its own measurements.
:::

---

## explain

Explain why a single file is **in or out** of the generated context. It runs the same checks generation does, in the same order, and stops at the first one that excludes the file:

0. **Exists on disk** — there is a file at that path at all.
1. **`.contextignore`** — the path matches an ignore pattern.
2. **`srcDirs`** — the path isn't under any configured source directory.
3. **Extractor** — the file's extractor returned no signatures.

If it clears all three it is reported as **INCLUDED**, with the extractor that claimed it, how many signatures it contributed, and a preview of them. The first thing to reach for when a file you expected is missing from the index.

```bash
sigmap explain src/auth/service.js
sigmap explain src/auth/service.js --json
```

```
[sigmap] src/graph/path-key.js — INCLUDED
  Extractor : javascript
  Signatures: 3
  Preview   : module.exports = { graphKey, displayPath }  :56-56 · function graphKey(p)  :22-24 …
```

An excluded file names the reason and the fix:

```
[sigmap] src/thing.generated.js — EXCLUDED
  Reason: matched .contextignore
  Fix:    remove the pattern or add '!src/thing.generated.js' as an exception
```

```
[sigmap] docs/note.js — EXCLUDED
  Reason: not under any srcDir (src)
  Fix:    add the containing directory to srcDirs in gen-context.config.json
```

A path with nothing at it is **not** an exclusion, and says so:

```
[sigmap] src/nope.js — NOT FOUND
  Reason: no such file on disk
  Fix:    check the path — nothing at this location to explain
```

`--json` emits the same as one object, with a machine-readable `status` (`included`, `excluded`, `not-found`) and `reason` (`.contextignore`, `not in srcDirs`, `no signatures`, or `file does not exist on disk`).

::: warning Exit code change in v8.54.1 (#772)
`sigmap explain <missing-file>` now exits **1**. Before v8.54.1 a path that did not exist fell through to the extractor check and was reported as `EXCLUDED — no extractable signatures`, advising the reader to *"check that the file contains function/class definitions"* — for a file that was not there — at **exit 0**. Scripts that relied on `explain` always succeeding for an arbitrary path will now see a failure. Every other status still exits 0: an exclusion is an answer, not an error.
:::

`sigmap explain` doesn't model the token budget, so a file can read as INCLUDED here and still be dropped from a particular run once the budget is applied.

`sigmap --explain <file>` is accepted as an equivalent flag form.

---

## run

Alias for a bare generate, for readability in scripts and task runners. `sigmap run` is exactly `sigmap`, and the positional is stripped before flag parsing, so every generation flag still applies.

```bash
sigmap run
sigmap run --report
```

---

## sync

Write **every** configured adapter output plus `llm.txt`, `llm-full.txt` and `llms.txt` in one pass, then print what it wrote. Use it after a config change, when you want all agent-facing files regenerated together rather than one adapter at a time.

```bash
sigmap sync
```

```
[sigmap] sync complete
  .github/copilot-instructions.md  updated
  llm.txt                          updated
  llm-full.txt                     updated
  llms.txt                         updated
```

---

## bench

Community benchmark submission helper. Reads `version.json` for canonical release metrics and `.context/benchmark-history.ndjson` for local run history, then formats a shareable block suitable for pasting into a GitHub Discussion.

```bash
sigmap bench --submit
sigmap bench --submit --json
```

```
────────────────────────────────────────────────────────
 SigMap Community Benchmark Submission
────────────────────────────────────────────────────────
 SigMap version : 8.51.2
 Benchmark ID   : sigmap-v8.64-main
 Submitted      : 2026-09-13
────────────────────────────────────────────────────────
 Canonical metrics (official release):
 hit@5          : 80.4%
 token reduction: 95.7%
────────────────────────────────────────────────────────
 Local run metrics: none yet — run node scripts/run-retrieval-benchmark.mjs
────────────────────────────────────────────────────────
 Paste the block above into a GitHub Discussion to share your results.
 https://github.com/manojmallick/sigmap/discussions
────────────────────────────────────────────────────────
```

When local benchmark history exists (`.context/benchmark-history.ndjson`), the local `hit@5` and token-reduction numbers are appended automatically.

A history entry that carries no value for a metric renders **`not run`**, never `0%` — a
measured zero and an unmeasured one have to stay distinguishable in a block intended for
publication. Text mode **exits 1** when no local metric could be produced, so
`sigmap bench --submit > block.txt && post` cannot publish an empty submission on a green
exit; the block is still printed, because the canonical release figures in it are real.
`--json` keeps exit 0 — it states the same condition as `"local": null`, which a consumer can
check, and it is a machine contract other tooling relies on (v8.52.1).

JSON output (`--json`) returns a machine-readable object:

```json
{
  "sigmapVersion": "6.8.0",
  "benchmarkId": "sigmap-v6.11-main",
  "canonicalHitAt5": 80.0,
  "canonicalReduction": 96.6,
  "local": null,
  "submittedAt": "2026-05-03"
}
```

| Option | Description |
|--------|-------------|
| `--submit` | Required flag — formats the submission block |
| `--json` | Emit machine-readable JSON instead of human-readable text |

---

## --output

Write the generated context to a custom file path instead of the default adapter location. The path is persisted to `gen-context.config.json` as `customOutput` so subsequent `--query` runs find it automatically.

```bash
sigmap --output .context/ai-context.md
sigmap --adapter claude --output shared/sigs.md
```

Priority order for `--query` context resolution:
1. `--output <file>` flag
2. `--adapter <name>` flag
3. `customOutput` in config
4. Probe all known adapter output paths

---

## --cost

Print per-model token/dollar cost comparison for the current project — raw source vs SigMap output.

```bash
sigmap --cost
sigmap --cost --model gpt-4o
sigmap --cost --json
```

```
 Cost estimate (gpt-4o @ $2.5/Mtok input as of 2026-10-04; tokens est. (chars/4)):
 Without SigMap : 812,400 tok  $2.0310/query  (counterfactual: whole repo)
 With SigMap    : 4,103 tok  $0.0103/query
 Savings        : 99%  ($2.0207 saved per query)
```

`--model` takes any name [`sigmap gain --models`](#gain) lists; the default is `gpt-4o`. Since **v8.63.0** the header carries the price date and the token basis. The price and its date come from the [model profile](/guide/config#models). Token counts are the chars/4 estimate and say so; set `models.charsPerToken` for the priced model and the counts use your factor instead. `--json` adds `priceAsOf` and `tokenBasis`.

---

## --ci

CI exit gate for coverage. Exits `0` when coverage ≥ threshold, exits `1` otherwise.

It measures the **`indexed`** population — how much of the in-scope file list the retrieval index actually holds — through the same function `sigmap validate` calls, so the two commands always report the same figure for the same repo.

```bash
sigmap --ci                    # default threshold: 80%
sigmap --ci --min-coverage 90
sigmap --ci --json
```

```
[sigmap] ✓ CI gate passed — coverage: indexed 98% (185/189 files) ≥ 80%
```

Below the threshold it names the same figure and says what to change:

```
[sigmap] ✗ CI gate FAILED — coverage: indexed 98% (185/189 files) < 99%
  Fix: increase maxTokens or expand srcDirs in gen-context.config.json
```

JSON output:

```json
{ "pass": true, "coverage": 98, "threshold": 80 }
```

Add to `.github/workflows/ci.yml`:

```yaml
- run: npx sigmap --ci --min-coverage 80
```

::: warning The figure this gate reports changed in v8.61.2
Until v8.61.2 this gate computed `index.size / fileList.length`, which is not a
ratio: the persisted index deliberately holds more than the current config
scopes — declared entrypoints, test roots, CI definitions, files a `srcDirs`
change dropped — so the quotient ran past 100%. It reported **241%** on this
repo, and a gate set to `--min-coverage 200` would have passed.

It now measures the intersection over the in-scope list, which cannot exceed
100% by construction. **If you pinned `--min-coverage` above 100 to work around
the old behaviour, lower it** — anything above 100 can no longer pass.
:::

---

## --watch

Start the file watcher. Every file save triggers an incremental regeneration. Press `Ctrl+C` to stop.

```bash
sigmap --watch
```

```
[sigmap] watching src/ app/ lib/ ...
[sigmap] ✓ regenerated in 43ms  (src/api/users.ts changed)
```

---

## daemon start · daemon stop · daemon status

Run `--watch` as a detached **background daemon** so the index stays fresh without holding a terminal (v8.9.0). The watcher is launched as a child process (no shell) and tracked by a PID file under `.context/`; its output goes to `.context/daemon.log`.

```bash
sigmap daemon start     # initial generate, then watch in the background
sigmap daemon status    # is it running? (exit 0 running, 1 not)
sigmap daemon stop      # terminate the watcher
```

```
$ sigmap daemon start
[sigmap] daemon started (pid 41234) — watching for changes
[sigmap] logs: .context/daemon.log   stop with: sigmap daemon stop
```

`start` is idempotent — a second `start` reports `already running` and spawns no second process; a stale PID file (from a crashed watcher) is cleaned up automatically on `start`/`status`. `stop` is a no-op when nothing is running. Add `--json` to any subcommand for machine-readable output (`{ running, pid, pidFile, logFile }`).

| Subcommand | Exit code | Behaviour |
|-----------|-----------|-----------|
| `daemon start` | 0 | starts (or reports already-running); detaches and returns |
| `daemon stop` | 0 | SIGTERM the watcher, remove the PID file |
| `daemon status` | 0 running · 1 not | report PID + log path; self-cleans a stale PID file |

---

## --setup

One-command setup. Auto-wires the SigMap MCP server into all detected AI editor config files, installs a git post-commit hook, and starts the file watcher.

**Supported editors (v6.2.0) — 10 targets:**

| Editor | Config file written |
|--------|-------------------|
| Claude Code | `.claude/settings.json` → `mcpServers.sigmap` |
| Cursor | `.cursor/mcp.json` → `mcpServers.sigmap` |
| Windsurf (project) | `.windsurf/mcp.json` → `mcpServers.sigmap` |
| Windsurf (global) | `~/.codeium/windsurf/mcp_config.json` → `mcpServers.sigmap` |
| Zed | `~/.config/zed/settings.json` → `context_servers.sigmap` |
| VS Code (GitHub Copilot 1.99+) | `.vscode/mcp.json` → `mcpServers.sigmap` |
| OpenCode (project) | `opencode.json` → `mcpServers.sigmap` |
| OpenCode (global) | `~/.config/opencode/config.json` → `mcpServers.sigmap` |
| Gemini CLI | `~/.gemini/settings.json` → `mcpServers.sigmap` |
| Codex CLI | `~/.codex/config.yaml` → `mcpServers.sigmap` (YAML) |

> **Neovim users:** `--setup` does not write Neovim config (Neovim uses a Lua plugin instead of a JSON config file). Install the `sigmap.nvim` plugin directly — see [`neovim-plugin/README.md`](https://github.com/manojmallick/sigmap/blob/main/neovim-plugin/README.md).

Each target is only written if the file already exists — `--setup` will not create IDE config files. Running `--setup` again is safe: existing `sigmap` entries are never overwritten (idempotent).

```bash
sigmap --setup
```

```
[sigmap] registered MCP server in .claude/settings.json
[sigmap] registered MCP server in .cursor/mcp.json
[sigmap] registered MCP server in .windsurf/mcp.json
[sigmap] registered MCP server in .vscode/mcp.json
[sigmap] registered MCP server in opencode.json
[sigmap] registered MCP server in ~/.gemini/settings.json
[sigmap] registered MCP server in ~/.codex/config.yaml
[sigmap] registered context server in ~/.config/zed/settings.json
[sigmap] installed .git/hooks/post-commit
[sigmap] watching for changes (Ctrl+C to stop)…
```

After registration `--setup` also prints manual snippets for all tools so you can configure any editor not listed above:

```
[sigmap] MCP / context server config snippets:
  Claude / Cursor / Windsurf / VS Code / OpenCode / Gemini CLI:
  { "mcpServers": { "sigmap": { "command": "node", "args": ["./gen-context.js", "--mcp"] } } }
  Zed (~/.config/zed/settings.json):
  { "context_servers": { "sigmap": { "command": { "path": "node", "args": ["./gen-context.js", "--mcp"] } } } }
  Codex CLI (~/.codex/config.yaml):
  mcpServers:
    sigmap:
      command: node
      args:
        - ./gen-context.js
        - --mcp
```

---

## --diff

Generate context only for the files git reports as changed. Ideal for PR reviews and CI jobs. Three forms, each a different git comparison:

| Form | git equivalent | Meaning |
|---|---|---|
| `sigmap --diff` | `git diff HEAD` | working tree vs HEAD |
| `sigmap --diff <ref>` | `git diff <ref>` | working tree vs `<ref>` — **committed and uncommitted alike** |
| `sigmap --diff --staged` | `git diff --cached` | index vs HEAD (staged only) |

```bash
sigmap --diff
sigmap --diff main
sigmap --diff --staged
```

All three fall back to a full generate when run outside a git repository or when no files have changed.

::: warning The ref form used to exclude your uncommitted work (v8.60.0)
Until v8.60.0 `--diff <ref>` ran `git diff <ref>..HEAD` — ref vs **HEAD**, not vs the working tree — while the flag was documented as "changes since `<ref>`". With local edits in flight you got a diff that omitted exactly the files you were editing ([#667](https://github.com/manojmallick/sigmap/issues/667)):

```
$ sigmap --diff HEAD~1          # one file committed, one modified in the tree
[sigmap] diff-vs-HEAD~1 files: 1     ← the modified file was invisible
```

The ref form is now `git diff <ref>`, so "since `<ref>`" means what it says. Bare `--diff` and `--diff --staged` were always correct and are unchanged.

The same range was wrong in two places — this command and the [`get_diff_context`](#mcp-install-mcp-list) MCP tool — so both now call one helper (`changedFiles()` in `src/util/git.js`) and cannot answer the question differently.
:::

### Risk score (v4.0)

Every `--diff` run prints a **risk classification** for each changed file:
- `+2` if the file exports public functions (`export` / `module.exports`)
- `+2` if the file has more than 3 downstream dependents (reverse-dependency BFS)
- `+1` if the file is a route/page/controller
- `+1` if the file is a config/env/settings file
- Total 0–1 → **LOW** · 2–3 → **MEDIUM** · 4+ → **HIGH**

```
[sigmap] Risk: Changed files (3):
  src/auth/service.ts         [HIGH]    — exports public API, 5 downstream dependents
  src/config/database.ts      [MEDIUM]  — config file
  src/utils/format.ts         [LOW]     — no dependents, internal utility
```

A base ref compares the working tree against that ref:

```bash
sigmap --diff HEAD~3
sigmap --diff main
```

---

## --mcp

Start the stdio MCP server implementing the Model Context Protocol. Used by Claude Code, Cursor, Windsurf, and Zed. Do not call this directly — wire it via `sigmap --setup` or the IDE config (see [MCP setup](/guide/mcp)).

```bash
node gen-context.js --mcp
```

---

## --query

Rank all files by relevance to a free-text query using zero-dependency, identifier-aware **BM25** as the base relevance signal, modulated by keyword/symbol/path weights, dependency-graph and centrality boosts, and any learned file weights.

```bash
sigmap --query "authentication flow"
```

```
[sigmap] query: "authentication flow"

  score  file
  0.94   src/auth/service.ts
  0.87   src/auth/middleware.ts
  0.72   src/api/users.ts
  0.61   src/guards/jwt.guard.ts
```

Machine-readable output:

```bash
sigmap --query "authentication flow" --json
```

Write a focused mini-context (top-5 ranked files) to `.context/query-context.md`:

```bash
sigmap --query "authentication flow" --context
```

### Ranked rows are relevance claims (v8.55.0)

A rank is a claim of relevance, and `0.00` is the absence of one. Until v8.55.0 `--query` ended in a plain `slice(0, topK)` with no floor, so a query matching nothing still returned a full table — on a fresh `gin` clone, four `.github/workflows/*.yml` files scoring **exactly 0.00** filled ranks 3–6 of a routing query (#807). Zero-score rows are now dropped, and a query that matches nothing says so:

```
No matching files found for query: "quantum chromodynamics lattice"
```

Path matches are also scaled by the token's **inverse document frequency across indexed paths** — the same intuition BM25 already applies to signature tokens. A token that happens to equal the project name (`gin` matching `ginS/gins.go` and `.github/workflows/gin.yml`) carries no discriminating power and no longer lifts files on their path alone.

### --query --explain (v8.55.0)

The same diagnostic as [`ask --explain`](#ask-explain-v8-55-0), rendered over the ranked table:

```bash
sigmap --query "ranker penalty classification" --explain
```

Note that `--explain` is also a standalone alias for [`explain <file>`](#explain). When `--query` is present it means *explain the ranking* and takes no argument; `sigmap --explain <file>` is unchanged.

---

## --analyze

Per-file breakdown showing signatures extracted, token count, extractor language, and test coverage status.

```bash
sigmap --analyze
```

The coverage column reads `✓ tested` when a test file targets the file by name (`foo.test.js`, `test_foo.py`, `FooTest.java`) or loads it (`require` / `import`, or a path built with `path.join` / `path.resolve`). Test files are found recursively under `test/`, `tests/`, `__tests__/`, `spec/` and `e2e/`, plus tests that sit beside their source; fixture directories are not tests. `✗ untested` means no test file names or loads the file — a module exercised only through the CLI is not detected. [`plan`](#plan) reads the same index.

Add `--slow` to re-time each extractor and flag files taking over 50ms:

```bash
sigmap --analyze --slow
```

`--diagnose-extractors` self-tests all extractors against their fixture files:

```bash
sigmap --diagnose-extractors
```

---

## --report

Print a token reduction summary with coverage score and module heatmap (v4.0).

```bash
sigmap --report
```

```
[sigmap] report:
  version         : 5.9.0
  files processed : 76
  files dropped   : 0
  input tokens    : ~65,227
  output tokens   : ~4,103
  budget limit    : 4000 (auto-scaled)
  reduction       : 93.7%
  coverage        : in-context 97% (76/76 scoped source files) grade A
                    (2 non-code files skipped — json, md, config)
  confidence      : HIGH

  Module Coverage:
    src                ████████████████ 100% (64/64 files)
    packages           ██████████████░░  86% (12/14 files)
```

Machine-readable JSON (suitable for CI dashboards):

```bash
sigmap --report --json
```

Paper-ready LaTeX/Markdown tables:

```bash
sigmap --report --paper
```

---

## --health

Run the composite health check. Returns a 0–100 score, letter grade, coverage score, and optional cache stats (if `sigCache` is enabled). Since v8.10.0 the score is **auditable**: the JSON output includes a `components[]` breakdown listing every deduction (id, label, penalty, detail), a project with source but no generated context is penalized (not scored 100/A), and freshness is measured across any adapter output — not just the Copilot file.

```bash
sigmap --health
```

```
[sigmap] health:
  score           : 80/100 (grade B)
  file access     : readable 97% (76/78 files in srcDirs) grade A
  strategy        : full
  token reduction : 96.6% (mean of 524 generate run(s) · vs whole-file baseline)
  sig-cache       : 142 entries, 1.2 KB
  days since regen: 0
  total runs      : 524 (generate runs; `gain` counts every operation)
```

::: tip Reduction figures name their baseline and window (v8.53.0)
`--health`, `gain`, `budget` and `history` all read one source, but they report
different **populations** and each now says which: `--health` averages *generate
runs*, `gain` counts *every operation* including `ask` queries, and `budget`
windows to the current session. Differing numbers are expected; an unlabelled one
is a bug.

A field the source store never recorded renders as `—`, not `0` — `gain` does not
capture per-run file counts or over-budget flags.
:::

Machine-readable:

```bash
sigmap --health --json
```

```json
{
  "score": 80,
  "grade": "B",
  "coverage": 97,
  "coverageGrade": "A",
  "coverageConfidence": "HIGH",
  "coverageTotalFiles": 78,
  "coverageIncludedFiles": 76,
  "tokens": 4103,
  "reduction": 93.7,
  "cacheStats": {
    "entries": 142,
    "sizeKb": 1.2
  }
}
```

---

## --suggest-tool

Classify a task description into the appropriate model tier: `fast`, `balanced`, or `powerful`.

```bash
sigmap --suggest-tool "Fix the null pointer in UserService.findById"
```

```
[sigmap] suggest-tool:
  tier   : balanced
  label  : Balanced (mid-tier)
  models : claude-sonnet-5-5, gpt-6.1-sol, gemini-3.8-flash
  cost   : $0.75–$2 / MTok input
  as of  : 2026-10-04 (shipped profile) — set "models.roster" in gen-context.config.json to name the models you have
```

The tier comes from a keyword rule over your task description. Since **v8.63.0** the model names and the price span come from the dated [model profile](/guide/config#models) — the same table `gain --model` prices from, so **every name printed here is one `gain --model` accepts**. Declare `models.roster` and the line names only the models you have; a tier your roster has no model for says so instead of suggesting one you cannot use.

Add `--json` for the machine-readable form. It keeps `tier`, `label`, `models` and `costHint`, and adds `modelIds` (array), `asOf`, `asOfSource` (`shipped` or `config`), `roster` and `basis`. The advice is a static rule, not a measurement, and `basis` says so.

---

## --dashboard

Self-contained HTML health dashboard — the `--health` score, token-reduction and hit@5 trends, and per-language extractor coverage, rendered as inline SVG with no external script or stylesheet. Opens straight from disk.

```bash
sigmap --dashboard
sigmap --dashboard --out docs/health.html
sigmap --dashboard --json
```

```
[sigmap] dashboard written: .context/dashboard.html
```

| Option | Description |
|--------|-------------|
| `--out <path>` | Write somewhere else; the parent directory is created |
| `--json` | Emit `{ ok, file, summary }` — `file` is the path actually written |

::: warning It used to write outside `.context/` (v8.59.0)
Until v8.59.0 this wrote `benchmarks/reports/dashboard.html` — a directory SigMap does not own. In a consumer repo that path either does not exist, so SigMap created it, or it means something else entirely; either way the file landed outside the `.context/` line [`--init`](#init) adds to `.gitignore` ([#782](https://github.com/manojmallick/sigmap/issues/782)).

**Migration:** if you referenced `benchmarks/reports/dashboard.html`, use `.context/dashboard.html` or pass `--out`. This was the only SigMap command that wrote outside `.context/`; every other `benchmarks/` reference is an optional *read* with a graceful fallback.
:::

::: tip Coverage counts every language SigMap supports (v8.59.0)
The per-language panel graded against a hardcoded 21-entry list while the project ships **36** languages, so a repo written in Elixir, Lua, R, GDScript, Astro, TOML, Terraform, GraphQL or Protobuf read as uncovered ([#663](https://github.com/manojmallick/sigmap/issues/663)).

The denominator was only half of it. Detection was a *second* extension map covering the same 21, so the numerator could never reach a widened denominator — raising `supported` 21 → 36 alone would have moved this repo from 2/21 to 2/36, making the figure **worse**. Both sides now come from `src/extractors/dispatch.js`, whose `LANGUAGES` reproduces the derived list behind `version.json` exactly.

```
before   repo languages : 9.5% of supported langs used here    (2/21)
after    repo languages : 8.3% of supported langs used here    (3/36)
```

The percentage drops because the denominator is finally honest — the numerator rose at the same time. On a repo using Elixir, Lua, R and Terraform it moves **0/21 → 4/36**. The chart now plots the languages actually present, busiest first, rather than a fixed 21 bars that were mostly zero.
:::

The figure is **informational, not scored** — it reports which of SigMap's languages this repo uses, which is a property of your codebase, not of your setup. The composite grade comes from staleness, token reduction and over-budget rate; see [`--health`](#health).


## --monorepo

Generate a separate context section per package in a monorepo. Supports `packages/`, `apps/`, and `services/` directory layouts.

```bash
sigmap --monorepo
```

Can also be set permanently in config with `"monorepo": true`.

---

## --each

Run a command inside each monorepo package, similar to `lerna run` or `pnpm -r`.

```bash
sigmap --each "node gen-context.js --diff"
```

---

## --routing

Regenerate the context **with model-routing hints embedded in the output** — a per-file classification of `fast`, `balanced`, or `powerful` based on complexity scoring. This is a generation flag, not a report: it writes the adapter outputs as usual, with the routing annotations included. Equivalent to setting `"routing": true` in config.

```bash
sigmap --routing
```

---

## --format cache

Write `.github/copilot-instructions.cache.json` as an Anthropic `system` array: the stable body carrying `cache_control`, then the volatile tail (recent commits, routing hints) without it — so a new commit re-bills only the tail. `cacheTtl` (`"5m"` or `"1h"`) sets the TTL, and the run prints a per-model [fit check](/guide/config#fit-check).

```bash
sigmap --format cache
# [sigmap] cache: wrote .github/copilot-instructions.cache.json (ttl 5m)
# [sigmap] cache fit (stable prefix; minimums as of 2026-10-04):
# [sigmap]   claude-sonnet-5-5  fits  ~9120 tokens (est. chars/4) — above the 512-token minimum
```

See [Prompt-cache layout](/guide/config#prompt-cache-layout) for the layout, the economics and when caching does not pay.

See [Repomix integration](/guide/repomix) for an example of using this with the two-layer strategy.

---

## --terse

Deterministic terse encoding of the signature block (v8.11.0, opt-in). Compacts each signature line — `function `→`fn `, tightened params/arrows/exports — while preserving the `:start-end` line anchor and any trailing doc hint **byte-exactly**, so `get_lines`, evidence packs, and symbol extraction keep working, and the ranker parses terse context files unchanged. Without the flag, output is byte-identical to before.

Measured on the SigMap repo itself by `npm run benchmark:terse` (the only legitimate source for this number): **10,232 → 8,580 signature tokens (−16.1%)** across 143 files / 780 signature lines.

```bash
sigmap --terse
# [sigmap] terse: sig block 10232 → 8580 tokens (-16.1%)
```

```
### src/app.js
exports={fetchUser,formatUser}  :7-7
async fn fetchUser(id,opts={})  :1-3
fn formatUser(user,style)  :4-6
```

Equivalent config key: [`terse: true`](/guide/config#terse).

---

## --track

Log each run to `.context/usage.ndjson` for monitoring and audit. View history with `sigmap history`.

```bash
sigmap --track
```

---

## gain

Token-savings dashboard. Shows how much SigMap has saved you — total tokens saved, % efficiency, estimated dollars, average latency, and a per-operation breakdown — built from a local, privacy-safe usage log.

Savings are captured automatically: every `ask` and `generate` run appends a counts-only record to `.context/gain.ndjson` (no file paths, source, or query text). Capture is **default-on**; opt out per run with `--no-track`, globally with `SIGMAP_NO_TRACK=1`, or in config with `gainTracking: false`. This is separate from the legacy `--track` health log.

The `$` column is priced per model. `--model` selects the rate; since **v8.51.5** an unknown key is still priced as the default rather than crashing the dashboard, but the substitution is **disclosed** rather than silent — a typo used to read as a valid quote:

```bash
sigmap gain --model gpt4o
```

```
[sigmap] unknown model 'gpt4o' — priced as claude-sonnet-5-5 ($2/MTok); see: sigmap gain --models
```

`gain --models` lists what it will accept:

```bash
sigmap gain --models
```

```
Known pricing models (sigmap gain --model <name>) — input prices as of 2026-10-04 (shipped profile):
  claude-fable-5-1         $10/MTok
  claude-opus-5-5          $4/MTok
  claude-sonnet-5-5        $2/MTok
  claude-haiku-4-5         $1/MTok
  gpt-6-astra              $10/MTok
  gpt-6.1-sol              $2/MTok
  gpt-6-luna               $0.1/MTok
  gpt-4o                   $2.5/MTok
  gpt-4o-mini              $0.15/MTok
  gemini-3.1-pro-preview   $2/MTok
  gemini-3.8-flash         $0.75/MTok
  gemini-3.5-flash-lite    $0.3/MTok
  minimax-m3               $0.3/MTok
  minimax-m2.7             $0.3/MTok
  claude-opus              $4/MTok  → claude-opus-5-5
  claude-sonnet            $2/MTok  → claude-sonnet-5-5  (default)
  claude-haiku             $1/MTok  → claude-haiku-4-5
```

Since **v8.63.0** this is the one model table SigMap has: [`--suggest-tool`](#suggest-tool) and the routing section name models from it, and `--cost` and `ask` price from it. The family keys (`claude-sonnet`, `claude-opus`, `claude-haiku`) are aliases for the current model of that family, so the rate they resolve to moves when the profile does. Prices you set under [`models.prices`](/guide/config#models) appear here and win over the shipped ones; the header then reads `(your config)` when you also set `models.asOf`. The `gemini-1.5-*` keys earlier releases listed are gone — the vendor no longer publishes a price for them; add your own under `models.prices` if you still use one.

The exit code and the dashboard itself are unchanged — the fallback is disclosed, not removed, because a figure someone is already quoting should not silently change shape.

```bash
sigmap gain
```

```
  ⚡ SigMap — Token Savings (this repo)                          ✓ v7.1.0
  ──────────────────────────────────────────────────────────────────────
  Total operations    : 2,402
  Whole-file baseline : 48.7M tok   ← est. cost of feeding full files
  SigMap context      :  2.9M tok
  Tokens saved        : 45.8M  (94.0%)
  Est. money saved    : $91.60   (claude-sonnet-5-5 input @ $2/M as of 2026-10-04 · tokens est. (chars/4) · --model to change)
  Avg latency         : 22 ms / op   (local, no API round-trip)

  Efficiency   ▕███████████████████████████░░▏  94.0%

  By operation
   #  Operation             Count    Saved    Avg%    Time   Impact
   1. ask                   1,164   22.8M    94.2%    41ms   ████████████
   2. mcp:search_signatures   980    9.1M    88.0%     3ms   █████
```

"Saved" is a counterfactual estimate (whole-file baseline − actual context), not a measured delta — every view labels it as such and shows the pricing assumption inline.

### Options

| Flag | Description |
|------|-------------|
| `--all` | Add daily / weekly / monthly trend tables (with TOTAL rows) |
| `--json` | Emit the aggregate as JSON (for badges, CI, dashboards) |
| `--since <window>` | Filter to a window: `7d`, `30d`, `12h`, or an ISO date |
| `--top <n>` | Limit the by-operation table to N rows (default 10) |
| `--model <name>` | Pricing model for the `$` estimate (e.g. `gpt-6.1-sol`, `claude-opus`) — any name `gain --models` lists |
| `--reset` | Delete the local savings log (`.context/gain.ndjson`) |

```bash
sigmap gain --all                 # daily / weekly / monthly trends
sigmap gain --since 7d --model gpt-4o
sigmap gain --json | jq '.totals'
```

---

## --init

Scaffold a starter `gen-context.config.json` and `.contextignore` in the current directory.

```bash
sigmap --init
```

---

## --benchmark

Run retrieval evaluation tasks from a JSONL task file. Outputs hit@5, MRR, and precision@5.

```bash
sigmap --benchmark
sigmap --benchmark --repo /path/to/external/repo
sigmap --benchmark --json
```

`--eval` is an alias for `--benchmark` and accepts the same flags.

---

## --impact

Trace every file that transitively imports the given file. Shows blast-radius awareness for change impact.

```bash
sigmap --impact src/auth/service.ts
sigmap --impact src/auth/service.ts --json
```

---

## --callers / --callees

**Method-level call-graph (v8.7.0+).** Where `--impact` works at the *file* level, `--callers` and `--callees` work at the *function* level. `--callers <symbol>` is the **method-level blast radius** — every function that transitively calls `<symbol>`; `--callees <symbol>` is what that symbol transitively calls. Deterministic, zero-dependency, for **JS/TS, Python, Java, Go, and Rust** (Java/Go/Rust added in v8.14.0).

Call sites are resolved with high precision: a call binds to a definition of that name in the **same file** first, then in a **directly-imported file**; names with no repo definition produce no edge (no global name-collision noise). Symbols are reported as `relPath#symbol`; pass either a bare name or a full `file#symbol` id.

```bash
sigmap --callers validateToken            # who (transitively) calls validateToken?
sigmap --callees handleRequest --depth 1  # what does handleRequest call directly?
sigmap --callers src/auth.ts#login --json # machine-readable edges
```

```
## Callers: `validateToken`

**Total callers of:** 3 _(lower bound — searched src, packages, 177 file(s); 17 dynamic module load(s) could not be followed)_

### Direct
- `src/auth/middleware.ts#requireAuth`

### Transitive
- `src/routes/api.ts#handler`
- `src/server.ts#start`
```

::: warning Every result is a lower bound, and says so (v8.60.0)
This printed `zero method blast radius` when it found no edge — an affirmative safety claim it could not support ([#768](https://github.com/manojmallick/sigmap/issues/768)). Two systematic blind spots, neither of which means "no callers exist":

1. **the graph walks `srcDirs` only** — a repo's CLI entry point usually sits at the root, outside it, and is the largest caller of every module underneath;
2. **dynamic module loads are unresolvable** — `require(someVar)`, and the bundle-safe wrappers that take a literal but are invisible to a resolver looking for `require`/`import`.

It could not distinguish *"no caller exists"* from *"no edge was found here"* — and that is precisely the claim you lean on before deleting or changing a signature. Every result now names what was searched and counts what could not be followed:

```
$ sigmap --callers buildEvidencePack
_no caller found (lower bound — searched src, packages, 177 file(s); 17 dynamic module load(s) could not be followed)._
```

A **counted** result is a lower bound too, so the qualifier appears there as well, and `--callees` carries it for the same reason. This brings the stronger claim into line with [`--impact`](#impact), which already labelled itself one.
:::

| Option | Description |
|---|---|
| `--depth <n>` | BFS depth limit (0 = unlimited; default 0) |
| `--json` | Emit `{ symbol, kind, resolved, direct, transitive, total, unresolved, lowerBound, scope }` — `lowerBound` is always `true` and `scope` carries `{ roots, files, dynamicLoads }`, so a machine consumer cannot read an unqualified zero either |

---

## --version

```bash
sigmap --version
# 5.9.0
```

---

## --help

Print every command and flag, with a one-line description each.

```bash
sigmap --help
```

::: info Generated from one table (v8.61.2)
`--help` renders from `src/cli/command-table.js`, the single CLI vocabulary the
unknown-command guard also derives from, and the adapter list is read from
`packages/adapters/` rather than restated.

It used to be a 113-line literal maintained by hand beside that guard's command
set — under a comment already claiming it "renders from the same vocabulary".
Writing it out as a table surfaced four live drifts: a description one column
off (which `llms.txt` carried too), a literal `%%` left from a `printf` escape
a template literal never needed, an adapter list a release behind the directory
(missing `willow`), and [`--ci`](#ci) — dispatchable and documented on this page
but absent from `--help` entirely.

Adding a command now means adding a row; there is nowhere else to add it, and
the guards fail if the table and the dispatcher disagree in either direction or
if a flag is advertised under a command that does not read it.
:::

---

<div style="text-align:center;margin-top:2.5rem;padding-bottom:.5rem;font-size:0.85em;color:var(--vp-c-text-3)">
  Made in Amsterdam, Netherlands <span title="Netherlands">🇳🇱</span>
</div>
