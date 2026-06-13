---
title: CLI reference
description: Complete SigMap CLI reference. All commands and flags with examples — ask, squeeze, plan, bench, judge, verify-ai-output, note, status, validate, roots, history, --package, --global, --ci, --cost, --coverage, --watch, --diff, --mcp, --report, --health, weights --export/--import and more.
head:
  - - meta
    - property: og:title
      content: "SigMap CLI Reference — every command and flag with examples"
  - - meta
    - property: og:description
      content: "All 46 SigMap commands and flags documented with examples. ask, squeeze, plan, bench, judge, verify-ai-output, note, status, validate, roots, history, --ci, --cost, --coverage, --watch, --diff, --mcp, --report, --health, weights --export/--import and more."
  - - meta
    - property: og:url
      content: "https://manojmallick.github.io/sigmap/guide/cli"
  - - meta
    - property: og:type
      content: article
  - - meta
    - name: twitter:title
      content: "SigMap CLI Reference — every command and flag with examples"
  - - meta
    - name: twitter:description
      content: "All 46 SigMap commands and flags documented with examples. ask, squeeze, plan, bench, judge, verify-ai-output, note, status, validate, history, --ci, --cost, --coverage, --watch, --diff, --mcp, --report, --health, weights --export/--import and more."
  - - meta
    - name: twitter:image:alt
      content: "SigMap CLI Reference"
  - - meta
    - name: keywords
      content: "sigmap cli, sigmap ask, sigmap judge, sigmap validate, sigmap history, sigmap --ci, sigmap --cost, sigmap flags, command line reference"
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
| `ask "<query>" --followup` | Reuse previous session context for follow-up queries (session carry-forward) |
| `ask "<query>" --package <name>` | Scope retrieval to a specific monorepo workspace package |
| `ask "<query>" --global` | Disable package scoping; search entire repo (monorepo override) |
| `ask "<query>" --mode index` | Surgical Context: emit symbol-header pointers (`symbol :start-end`) only — no bodies; fetch on demand via `get_lines` |
| `ask "<query>" --since <ref>` | Delta context: restrict ranked output to files changed since a git ref |
| `ask "<query>" --squeeze` | Auto-accept input minimization (no prompt) — for scripts/CI |
| `ask "<query>" --no-squeeze` | Disable input minimization entirely |
| `ask "<query>" --squeeze-threshold <n>` | Minimum reduction %% to prompt for minimization (default 30) |
| `squeeze <file\|->` | Minimize a pasted stacktrace / CI-log / JSON blob (`--json` for stats) |
| `plan "<goal>"` | Analyze change impact and plan modifications — returns files grouped by confidence |
| `judge --response <f> --context <f>` | Rule-based groundedness scoring for LLM responses |
| `verify-ai-output <answer.md>` | Hallucination Guard — flag fake files, test files, imports, symbols, and npm scripts in an AI answer (deterministic, offline) |
| `verify-ai-output <answer.md> --report [out.html]` | Write a standalone red/amber/green HTML report of the findings |
| `validate` | Validate config and coverage; optional query symbol check |
| `learn` | Boost, penalize, or reset learned file ranking weights |
| `weights` | Show learned file multipliers or emit them as JSON |
| `weights --export [file]` | Write learned weights JSON to file or stdout for team sharing |
| `weights --import <file>` | Merge or replace local weights from a portable JSON file |
| `bench --submit` | Format local + canonical benchmark results as a shareable community block |
| `compare` | CLI wrapper for retrieval benchmark vs baseline |
| `share` | Print shareable one-liner with live benchmark numbers |

## Team, CI, and observability

| Command / Flag | Description |
|----------------|-------------|
| `roots [--explain | --json | --fix]` | Auto-detect source roots for 17 languages and 50+ frameworks; shows confidence and scoring |
| `history` | Show usage log + benchmark trend sparklines (hit@5, token reduction) |
| `note "<text>"` | Append a note to the cross-session decision log (`note` alone lists recent) |
| `status` | Repo state — branch, dirty files, index freshness, notes |
| `learn` | Boost, penalize, or reset learned file ranking weights |
| `weights` | Show learned file multipliers or emit them as JSON |
| `suggest-profile` | Auto-detect context profile from git state |
| `explain <file>` | Why a file is included or excluded from context |
| `sync` | Write all adapter outputs + llm.txt + llms.txt |
| `--watch` | Watch for file changes and regenerate incrementally |
| `--setup` | Auto-wire MCP for Claude, Cursor, Windsurf, Zed, VS Code, OpenCode, Gemini CLI, Codex CLI; install git hook; start watcher |
| `--diff` | Generate context only for changed files (shows risk score per file) |
| `--diff --staged` | Generate context only for staged files |
| `--mcp` | Start the stdio MCP server |
| `--query <text>` | Rank files by relevance to a free-text query (TF-IDF) |
| `--output <file>` | Write context to a custom path (persisted to config) |
| `--cost [--model <name>]` | Per-model token/dollar cost comparison |
| `--coverage` | Enable test coverage annotation (✓/✗ per function) without editing config |
| `--ci [--min-coverage N]` | CI exit gate — exits 1 when coverage < threshold |
| `--analyze` | Per-file breakdown of signatures, tokens, and extractor |
| `--report` | Token reduction + coverage score + module heatmap |
| `--report --json` | Machine-readable JSON report with coverage object |
| `--report --paper` | LaTeX/markdown tables for academic export |
| `--health` | Composite 0–100 health score + coverage grade |
| `--health --json` | Machine-readable health output with coverage fields |
| `--monorepo` | Generate a separate context section per package |
| `--each` | Run a command in each monorepo package |
| `--routing` | Print the model routing table |
| `--format cache` | Wrap output in Anthropic cache_control breakpoints |
| `--track` | Log each run to `.context/usage.ndjson` |
| `--init` | Scaffold `gen-context.config.json` and `.contextignore` |
| `--benchmark` | Run retrieval evaluation tasks |
| `--impact <file>` | Trace every file that transitively imports the given file |
| `--suggest-tool <task>` | Classify a task into fast / balanced / powerful model tier |
| `--version` | Print version and exit |
| `--help` | Print help and exit |

---

## ask

Unified pipeline: intent detection → ranked mini-context → coverage check → cost estimate → risk level, all in one command.

```bash
sigmap ask "fix the login bug"
sigmap ask "explain the rank function" --json
```

```
────────────────────────────────────────────
 sigmap ask  "fix the login bug"
 Intent    : debug
 Context   : 1,823 tokens  →  .context/query-context.md
 Coverage  : 97%
 Risk      : LOW
 Cost      : $0.0005/query  (was $0.032 · saved 98%)
────────────────────────────────────────────
```

With `--json` the output is a machine-readable object with `intent`, `coverage`, `cost`, `riskLevel`, and `rankedFiles`.

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

## plan

Analyze change impact and plan modifications to your codebase. Given a goal or change description, `sigmap plan` returns files grouped by confidence level (inspect-first vs likely-to-change), estimated impact radius, and tests affected by the change.

```bash
sigmap plan "add rate limiting to the API"
sigmap plan "refactor the auth middleware" --json
```

```
────────────────────────────────────────────
 Goal: add rate limiting to the API
 Intent: integrate
────────────────────────────────────────────

 Inspect first (high confidence):
   → src/middleware/rate-limiter.js
   → src/config/limits.json
   → src/auth/service.js

 Likely to change (medium confidence):
   → src/routes/api.js
   → src/utils/cache.js
   → src/models/request-log.js
────────────────────────────────────────────
```

`--json` output includes `goal`, `intent`, `inspectFirst` array, `likelyToChange` array, and `affectedTests` count.

| Option | Description |
|--------|-------------|
| `--json` | Emit structured JSON with goal, intent, file arrays, and test impact |

---

## judge

Rule-based groundedness scoring for LLM responses. Measures token overlap between the response and the source context to detect off-context answers. Zero dependencies, no LLM API required.

```bash
sigmap judge --response response.txt --context .context/copilot-instructions.md
sigmap judge --response response.txt --context .context/copilot-instructions.md --json
sigmap judge --response response.txt --context .context/query-context.md --learn
```

```
────────────────────────────────────────────
 sigmap judge
 Groundedness       : 0.72
 Support level      : pass
 Unsupported symbols: none
────────────────────────────────────────────
```

JSON output:

```json
{ "groundedness": 0.72, "supportLevel": "high", "reasons": [], "learning": null }
```

With `--learn`, judge becomes an opt-in feedback loop. It reads file headings from the context file (`### path` in generated context or `## path` in `.context/query-context.md`) and applies a small learned boost or penalty when groundedness is confidently high or low.

| Option | Description |
|--------|-------------|
| `--response <file>` | Path to the LLM response text file (required) |
| `--context <file>` | Path to the context/source file (required) |
| `--threshold <n>` | Minimum score to pass (default: `0.25`) |
| `--learn` | Apply opt-in learned boosts/penalties to files referenced by context headings |
| `--json` | Emit JSON instead of human-readable output |

Exit code `0` = pass, `1` = fail. Use in CI to gate on response quality.

---

## verify-ai-output

Hallucination Guard. Scans an AI answer (markdown or plain text) and flags claims that do not match the repository: fake file paths, fake test files, unresolvable imports, symbols not in the SigMap index, and `npm run` scripts that don't exist. Fully deterministic — runs offline, no LLM API. Where a flagged name is a near miss for something real, a heuristic closest-match suggestion is attached.

```bash
sigmap verify-ai-output ai-answer.md
sigmap verify-ai-output ai-answer.md --json
sigmap verify-ai-output ai-answer.md --report report.html
```

```
[sigmap] ✗ ai-answer.md — 3 issues found
  fake-file: 0  fake-test-file: 1  fake-import: 1  fake-symbol: 1  fake-npm-script: 0

  L4   [Fake symbol]     Symbol not found in repo index: loadConfg()
         ↳ Did you mean `loadConfig()` in src/config/loader.js:42?
  L6   [Fake test file]  Test file not found on disk: src/extractors/nonexistent.test.js
  L10  [Fake import]     Import does not resolve: ./src/totally/madeup
```

Five deterministic detectors:

| Detector | Flags | Confidence |
|----------|-------|------------|
| `fake-file` | A referenced path that is not present on disk | High |
| `fake-test-file` | A referenced **test** path (`*.test`/`*.spec`/`__tests__`/`test_*.py`) absent on disk | High |
| `fake-import` | A relative import that does not resolve, or a bare package absent from `package.json` dependencies (Node/Python builtins and scoped packages are allow-listed) | High |
| `fake-symbol` | A called function/class (`` `name()` ``) absent from the SigMap symbol index (`buildSigIndex`) | Medium |
| `fake-npm-script` | An `npm run X` (or `pnpm`/`yarn run X`) where `X` is not a `package.json` script | High |

JSON output (`--json`) for CI:

```json
{
  "file": "ai-answer.md",
  "issues": [
    { "type": "fake-symbol", "value": "loadConfg", "line": 4, "location": "L4", "message": "Symbol not found in repo index: loadConfg()", "confidence": "medium", "suggestion": "Did you mean `loadConfig()` in src/config/loader.js:42?" }
  ],
  "summary": { "total": 1, "byType": { "fake-file": 0, "fake-test-file": 0, "fake-import": 0, "fake-symbol": 1, "fake-npm-script": 0 }, "clean": false, "symbolsIndexed": 288, "withSuggestion": 1 }
}
```

| Option | Description |
|--------|-------------|
| `--json` | Emit machine-readable `{ file, issues, summary }` instead of the markdown report |
| `--report [out.html]` | Write a standalone, self-contained HTML report (red/amber/green per issue, suggestions inline); defaults to `sigmap-verify-report.html`. Combinable with `--json`. |

Exit code `0` = clean (no hallucinations), `1` = at least one issue found. Use in CI to gate AI-generated patches or answers before they are trusted. See the [Hallucination Guard guide](/guide/verify-ai-output) for the full workflow.

---

## squeeze

Minimize a pasted stack trace, CI/build log, or JSON payload — deterministic, offline. Reads a file or stdin and writes the squeezed result to stdout (stats to stderr). The same engine runs inside [`ask`](#ask).

```bash
sigmap squeeze error.log              # squeeze a file → stdout
cat error.log | sigmap squeeze -      # or from stdin
sigmap squeeze error.log --json       # category + reduction + squeezed text as JSON
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
| `--json` | Emit `{ category, confidence, rawTokens, squeezedTokens, reduction, enriched, squeezed }` |

Prose (no recognizable structure) passes through unchanged. The differentiator over generic log summarizers is **symbol enrichment** — SigMap attaches a real function signature to the top stack frame because it has the repo's symbol index.

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
  Last index:    2h ago (v6.15.0, 412 files) — STALE: 5 files changed since
  Notes:         7 (latest: switched auth to JWT; refresh-token flow still TODO)
```

`Last index` reads the usage log and compares the index time against your tracked files' mtimes, so you can see whether the context an agent is using is stale.

| Option | Description |
|--------|-------------|
| `--json` | Emit `{ branch, dirty, lastIndex, indexVersion, indexFiles, changedSinceIndex, notes, lastNote }` |

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

## validate

Validates your SigMap configuration and measures context coverage. Checks that every `srcDir` exists, exclude patterns are safe, `maxTokens` is in a sensible range, and that ≥ 70% of your source files are in context. Optionally checks that PascalCase and camelCase symbols in a query appear in the top-5 ranked results.

```bash
sigmap validate
sigmap validate --json
sigmap validate --query "loginUser validateToken"
```

```
[sigmap] ✓ config valid  coverage: 97%
```

JSON output includes `valid`, `issues`, `warnings`, and `coverage` fields. Exits `1` when hard issues are found.

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
Monorepo             : no

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
  "explanation": [...]
}
```

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

## history

Display the last N usage log entries as a table with Unicode sparklines for token trend, retrieval hit@5, and token-reduction benchmark history. Requires `tracking: true` in `gen-context.config.json` (or `--track` on each run) for usage rows; benchmark rows appear automatically once any benchmark script has run.

```bash
sigmap history
sigmap history --last 20
sigmap history --json
```

```
──────────────────────────────────────────────────────────────
 sigmap history  (last 10 runs)
──────────────────────────────────────────────────────────────
 Date                     Files  Tokens Reduction Budget?
 ──────────────────────── ───── ─────── ───────── ───────
 2026-04-16 14:22:01         76    4103    -93.7%      no
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

Human-readable CLI wrapper for the retrieval benchmark. Runs SigMap vs a random baseline and shows hit@5, token counts, and lift multiplier.

```bash
sigmap compare
sigmap compare --json
```

```
────────────────────────────────────────────
 SigMap vs Baseline
────────────────────────────────────────────
 hit@5         75.6% vs 13.6%   (5.6× lift)
 Avg prompts   1.72 vs 2.84
 Token story   97.0% overall reduction
────────────────────────────────────────────
```

---

## share

Print a shareable one-liner with live benchmark numbers and copy it to the clipboard.

```bash
sigmap share
```

```
Generated with SigMap — zero-dependency AI context engine
97.0% fewer tokens · 75.6% retrieval hit@5 · 39.4% fewer prompts
https://sigmap.dev
[sigmap] Copied to clipboard.
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
 SigMap version : 6.8.0
 Benchmark ID   : sigmap-v6.11-main
 Submitted      : 2026-05-03
────────────────────────────────────────────────────────
 Canonical metrics (official release):
 hit@5          : 75.6%
 token reduction: 96.8%
────────────────────────────────────────────────────────
 Local run metrics: none yet — run node scripts/run-retrieval-benchmark.mjs
────────────────────────────────────────────────────────
 Paste the block above into a GitHub Discussion to share your results.
 https://github.com/manojmallick/sigmap/discussions
────────────────────────────────────────────────────────
```

When local benchmark history exists (`.context/benchmark-history.ndjson`), the local `hit@5` and token-reduction numbers are appended automatically.

JSON output (`--json`) returns a machine-readable object:

```json
{
  "sigmapVersion": "6.8.0",
  "benchmarkId": "sigmap-v6.11-main",
  "canonicalHitAt5": 80.0,
  "canonicalReduction": 96.8,
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
[sigmap] cost estimate (4,103 tokens after SigMap):
  gpt-4o-mini    $0.000062  (was $0.012 · 99.5% saved)
  claude-3-haiku $0.000103  (was $0.020 · 99.5% saved)
  gpt-4o         $0.000205  (was $0.040 · 99.5% saved)
  claude-sonnet  $0.000411  (was $0.080 · 99.5% saved)
  claude-opus-4  $0.001236  (was $0.240 · 99.5% saved)
```

Supported models: `gpt-4`, `gpt-4o`, `gpt-4o-mini`, `claude-3-5-sonnet`, `claude-3-haiku`, `claude-opus-4`, `gemini-1.5-pro`.

---

## --ci

CI exit gate for coverage. Exits `0` when coverage ≥ threshold, exits `1` otherwise. Uses sig-index size vs total source file count — the same budget-aware metric as `sigmap validate`.

```bash
sigmap --ci                    # default threshold: 80%
sigmap --ci --min-coverage 90
sigmap --ci --json
```

```
[sigmap] CI gate: coverage 97% ≥ 80% — PASS
```

JSON output:

```json
{ "pass": true, "coverage": 97, "threshold": 80 }
```

Add to `.github/workflows/ci.yml`:

```yaml
- run: npx sigmap --ci --min-coverage 80
```

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

Generate context only for files changed in the current git working tree. Ideal for PR reviews and CI jobs.

```bash
sigmap --diff
```

`--diff --staged` restricts to staged files only, making it a perfect pre-commit check:

```bash
sigmap --diff --staged
```

Both modes automatically fall back to a full generate when run outside a git repository or when no files have changed.

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

You can also pass a specific base ref:

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

Rank all files by relevance to a free-text query using zero-dependency TF-IDF scoring.

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

---

## --analyze

Per-file breakdown showing signatures extracted, token count, extractor language, and test coverage status.

```bash
sigmap --analyze
```

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
  coverage        : A (97%)  — 76 of 76 code files included
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

Run the composite health check. Returns a 0–100 score, letter grade, coverage score, and optional cache stats (if `sigCache` is enabled).

```bash
sigmap --health
```

```
[sigmap] health:
  score           : 80/100 (grade B)
  file access     : A (97%)  — 76 of 78 files accessible in srcDirs
  strategy        : full
  token reduction : 93.7%
  sig-cache       : 142 entries, 1.2 KB
  days since regen: 0
  total runs      : 1
```

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
[sigmap] task: "Fix the null pointer in UserService.findById"
[sigmap] → balanced  (business logic, 1× cost)
```

---

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

Print the model routing table — a per-file classification of `fast`, `balanced`, or `powerful` based on complexity scoring.

```bash
sigmap --routing
```

---

## --format cache

Wrap the output in Anthropic `cache_control` breakpoints so the stable signatures become a cached prefix.

```bash
sigmap --format cache
```

See [Repomix integration](/guide/repomix) for an example of using this with the two-layer strategy.

---

## --track

Log each run to `.context/usage.ndjson` for monitoring and audit. View history with `sigmap history`.

```bash
sigmap --track
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
```

---

## --impact

Trace every file that transitively imports the given file. Shows blast-radius awareness for change impact.

```bash
sigmap --impact src/auth/service.ts
sigmap --impact src/auth/service.ts --json
```

---

## --version

```bash
sigmap --version
# 5.9.0
```

---

## --help

```bash
sigmap --help
```

---

<div style="text-align:center;margin-top:2.5rem;padding-bottom:.5rem;font-size:0.85em;color:var(--vp-c-text-3)">
  Made in Amsterdam, Netherlands <span title="Netherlands">🇳🇱</span>
</div>
