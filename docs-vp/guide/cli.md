---
title: CLI reference
description: Complete SigMap CLI reference. All commands and flags with examples — ask, judge, validate, history, --ci, --cost, --watch, --diff, --mcp, --report, --health and more.
head:
  - - meta
    - property: og:title
      content: "SigMap CLI Reference — every command and flag with examples"
  - - meta
    - property: og:description
      content: "All 30 SigMap commands and flags documented with examples. ask, judge, validate, history, --ci, --cost, --watch, --diff, --mcp, --report, --health and more."
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
      content: "All 30 SigMap commands and flags documented with examples. ask, judge, validate, history, --ci, --cost, --watch, --diff, --mcp, --report, --health and more."
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
| `judge --response <f> --context <f>` | Rule-based groundedness scoring for LLM responses |
| `validate` | Validate config and coverage; optional query symbol check |
| `learn` | Boost, penalize, or reset learned file ranking weights |
| `weights` | Show learned file multipliers or emit them as JSON |
| `compare` | CLI wrapper for retrieval benchmark vs baseline |
| `share` | Print shareable one-liner with live benchmark numbers |

## Team, CI, and observability

| Command / Flag | Description |
|----------------|-------------|
| `history` | Show usage log + benchmark trend sparklines (hit@5, token reduction) |
| `suggest-profile` | Auto-detect context profile from git state |
| `explain <file>` | Why a file is included or excluded from context |
| `sync` | Write all adapter outputs + llm.txt + llms.txt |
| `--watch` | Watch for file changes and regenerate incrementally |
| `--setup` | Auto-configure MCP servers, install git hook, start watcher |
| `--diff` | Generate context only for changed files (shows risk score per file) |
| `--diff --staged` | Generate context only for staged files |
| `--mcp` | Start the stdio MCP server |
| `--query <text>` | Rank files by relevance to a free-text query (TF-IDF) |
| `--output <file>` | Write context to a custom path (persisted to config) |
| `--cost [--model <name>]` | Per-model token/dollar cost comparison |
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

When coverage drops below 70%, a warning is emitted on stderr pointing to `sigmap validate`.

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
{ "score": 0.72, "verdict": "pass", "reasons": [], "learning": null }
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

Show the learned multiplier table used by `sigmap ask`, `sigmap --query`, `sigmap validate --query`, and MCP `query_context`.

```bash
sigmap weights
sigmap weights --json
```

Human output is sorted highest boost first and includes a reset hint. JSON output emits the exact `.context/weights.json` object.

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
 hit@5         78.9% vs 13.6%   (5.8× lift)
 Avg prompts   1.69 vs 2.84
 Token story   98.1% overall reduction
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
97% fewer tokens · 84% retrieval accuracy · 6× better results
https://sigmap.dev
[sigmap] Copied to clipboard.
```

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

One-command setup. Detects `.claude/settings.json` and `.cursor/mcp.json` automatically, adds the sigmap MCP server entry, installs a git post-commit hook, and starts the file watcher.

```bash
sigmap --setup
```

```
[sigmap] ✓ detected .claude/settings.json
[sigmap] ✓ added MCP server entry → .claude/settings.json
[sigmap] ✓ detected .cursor/mcp.json
[sigmap] ✓ added MCP server entry → .cursor/mcp.json
[sigmap] ✓ installed .git/hooks/post-commit
[sigmap] ✓ watcher started on src/ app/ lib/
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

Start the stdio MCP server implementing the Model Context Protocol. Used by Claude Code, Cursor, and Windsurf. Do not call this directly — wire it via the IDE config (see [MCP setup](/guide/mcp)).

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
  version         : 5.2.0
  files processed : 76
  files dropped   : 0
  input tokens    : ~65,227
  output tokens   : ~4,103
  budget limit    : 4000 (auto-scaled)
  reduction       : 93.7%
  coverage        : A (97%)  — 76 of 78 source files included  [budget: 4000 auto-scaled]
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

Run the composite health check. Returns a 0–100 score, letter grade, and coverage score.

```bash
sigmap --health
```

```
[sigmap] health:
  score           : 80/100 (grade B)
  coverage        : A (97%)  — 76 of 78 source files
  strategy        : full
  token reduction : 93.7%
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
  "reduction": 93.7
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
# 5.2.0
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
