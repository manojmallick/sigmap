# Changelog

All notable changes to SigMap are documented here.

Format: [Semantic Versioning](https://semver.org/)

---

## [Unreleased]

---

## [6.5.0] — 2026-04-25

### Added

- **Source Root Resolver (v6.5)** — intelligent auto-detection of source directories for 17 languages and 50+ frameworks (Next.js, Django, Rails, Spring Boot, Flutter, Go, Rust, etc.). Uses multi-signal scoring: manifest files, language/framework detection, file density, git activity, and framework-specific srcDirs. Returns confidence level (high/medium/low) and detailed explanation. Integrated into `loadConfig()` with graceful fallback to legacy heuristics.
- **`.sigmapignore` pattern matching** — new `.sigmapignore` file support (fallback to `.contextignore`) for excluding directories. Supports simple patterns like `legacy/` and globs like `src/**`.
- **`sigmap roots` CLI command** — three modes: `--explain` (default, shows detected languages/frameworks and scores), `--json` (structured output), `--fix` (interactive prompt to correct srcDirs and write to config).
- **Monorepo detection and enumeration** — auto-detects monorepos via pnpm-workspace.yaml, turbo.json, nx.json, lerna.json, and package.json workspaces. Enumerates all sub-packages and common deep paths.

### Fixed

- **Framework-discovery tests** — updated registry entries to include all framework-specific srcDirs expected by legacy detector (Rails: db/spec/test, Laravel: resources/tests, Angular: projects/apps/libs, Next: hooks/utils).
- **Scoring penalty for framework srcDirs** — test directories (spec, test, tests) no longer penalized when explicitly in framework's srcDirs list.
- **CLI command ordering** — `roots` command handler now executes before `explain` to prevent flag conflict.

---

## [6.4.0] — 2026-04-23

### Changed

- **Docs version labels** — homepage hero badge now shows Release (v6.4.0) and Benchmark (sigmap-v6.0-main) as separate labels instead of a single conflated "Latest: v6.0" pill
- **Generalization benchmark** — upgraded all v5.9-main references in `docs-vp/guide/generalization.md` to v6.0-main snapshot
- **README overclaim fix** — removed "every time" from the comparison table; trimmed top demo block from 4 commands to 2
- **v6.3.0 release notes** — added release note callout blocks to benchmark, retrieval-benchmark, and task-benchmark docs
- **MCP docs** — added v6.3 native tool registration callout to `docs-vp/guide/mcp.md`
- **Content-consistency test** — new `test/content/v640-trust-sync.sh` bash script with 11 checks catches version/copy regressions

---

## [6.3.0] — 2026-04-22

### Added

- **Native tool registration (Level 3)** — `codex.write()` injects a `## Tools` JSON block into AGENTS.md with 5 named sigmap shell tools (`sigmap_ask`, `sigmap_validate`, `sigmap_judge`, `sigmap_query`, `sigmap_weights`); Codex CLI and OpenCode surface these in their tool picker. `claude.write()` injects a `## Bash allowlist` section into CLAUDE.md with `permissions.allow` patterns for all sigmap commands; adding these to `.claude/settings.json` bypasses the Claude Code confirmation prompt. Both sections are idempotent and preserve human content.

---

## [6.2.0] — 2026-04-22

### Added

- **`--setup` MCP auto-wire for 4 new targets** — `sigmap --setup` now registers the MCP server in `.vscode/mcp.json` (GitHub Copilot in VS Code 1.99+), `opencode.json` and `~/.config/opencode/config.json` (OpenCode), `~/.gemini/settings.json` (Gemini CLI), and `~/.codex/config.yaml` (Codex CLI — YAML format). All 5 new targets are idempotent and only written if the file already exists. Total `--setup` targets: 5 → 10.

---

## [6.1.0] — 2026-04-22

### Added

- **Tool instructions in every adapter (Level 1)** — each adapter's `format()` now embeds native-format SigMap command guidance: markdown table (copilot, codex), bullet list (claude), `#` comments (cursor, windsurf), instruction sentence (openai, gemini). Agents get `sigmap ask`, `sigmap validate`, and `sigmap judge` hints automatically in every generated context file.

---

## [6.0.3] — 2026-04-21

### Added

- **`--coverage` CLI flag** — enables test coverage annotation (`✓`/`✗` per function) at runtime without editing config; sets `testCoverage: true` on the loaded config before any run path.
- **`sigmap weights --export [file]`** — writes learned weights JSON to a file path, or prints to stdout if no path given (pipe-friendly for CI and team sharing).
- **`sigmap weights --import <file> [--replace]`** — merges imported weights into the local `.context/weights.json`; `--replace` discards existing weights and takes the imported set entirely. Incoming values are sanitized and clamped.

---

## [6.0.2] — 2026-04-21

### Fixed

- **Duplicate adapter headers (#104, #96)** — `writeOutputs()` now strips the `formatOutput()` preamble (`<!-- Generated... -->` + `# Code signatures`) before passing content to adapters, preventing double headers on every run. Introduces `stripFormatHeader()` helper applied to all adapter paths including `writeClaude()`.
- **Bundled codex factory (#96)** — the inline `__factories["./packages/adapters/codex"]` in `gen-context.js` was still delegating to `openai.format()` after the source-file fix in v6.0.1. Now uses clean `# Code signatures\n\n` + context, matching the source adapter.

---

## [6.0.1] — 2026-04-21

### Fixed

- **TypeScript extractor guard clauses (#97)** — `extractClassMembers` now skips control-flow keywords (`if`, `for`, `while`, `switch`, `do`, `try`, `catch`, `finally`, `else`) that were incorrectly emitted as method signatures when they appeared inside class bodies.
- **Codex/AGENTS.md adapter preamble (#96)** — `packages/adapters/codex.js` no longer delegates to the OpenAI adapter. Output is now clean `# Code signatures\n\n<context>` markdown with no "You are a coding assistant…" preamble, no HTML comment metadata block, and no duplicate headers.

---

## [6.0.0] — 2026-04-19

### Added

- **Graph-boosted retrieval (v6.0)** — `rank()` in `src/retrieval/ranker.js` now accepts `opts.graph`. After scoring all files, a +0.4 `graphBoost` weight is added to 1-hop forward-import neighbors of any file with `score > 0`. Measured lift: +1.1pp (82.2% → 83.3% hit@5 using ranker.js on 90 benchmark tasks).
- **`DEFAULT_WEIGHTS.graphBoost: 0.4`** — new weight constant; path-normalized relative↔absolute conversion handles the sigIndex/graph format mismatch.
- **Incremental signature cache (`src/cache/sig-cache.js`)** — `loadCache`, `saveCache`, `getChangedFiles`, `updateCacheEntries` persist extracted signatures keyed by absolute path + mtime to `.sigmap-cache.json`. Version-keyed so upgrades automatically bust the cache. Ready to wire into `gen-context.js` for 80–95% speed reduction on re-runs.
- **Graph-boosted MCP `query_context`** — `src/mcp/handlers.js` now builds a dependency graph via `buildFromCwd` and passes it to `rank()`, giving agents multi-hop neighbor boosting for free.
- **README rewrite** — full 15-section conversion-optimised README (tagline, npx demo, ❌/✅ replace table, workflow arrow, canonical benchmark block, install options, integrations, try-it, start guide, why-not-embeddings, license).
- **`test/integration/v591-readme.test.js`** — 50 tests covering all 15 README sections and consistency rules.
- **`version.json` updated** — bumped to `6.0.0`, `benchmark_id` to `sigmap-v6.0-main`, metrics updated from live benchmark run: `overall_token_reduction_pct: 96.9`, `retrieval_lift: 5.8`, `graph_boosted_hit_at_5: 0.833`.

### Changed

- **All package versions** synced to `6.0.0` via `scripts/sync-versions.mjs`.
- **`retrieval_lift`** corrected from 5.9× to 5.8× (actual benchmark run average).
- **`overall_token_reduction_pct`** corrected from 98.1% to 96.9% (simple average across 18 repos from live matrix run; 98.1% was a weighted-by-size figure from a prior run).
- **`task_success_proxy_pct`** corrected from 53.3% to 52.2% (live benchmark confirms 47/90 correct).
- **`prompts_per_task`** corrected from 1.67 to 1.68 (live benchmark output).

---

## [5.9.0] — 2026-04-18

### Added

- **`sigmap bench --submit`** — new CLI command that reads `version.json` + local `.context/benchmark-history.ndjson` and formats a shareable community benchmark submission block (text and `--json`).
- **`scripts/verify-checksums.mjs`** — new standalone script to verify a downloaded binary against its `.sha256` checksum file; exits 0 on match, 1 on mismatch.
- **SHA-256 checksum generation in `build-binary.mjs`** — each binary build now writes a matching `dist/<artifact>.sha256` file automatically.
- **22 integration tests** in `test/integration/v590-binary-polish.test.js` covering all acceptance criteria.

### Changed

- **`scripts/verify-binary.mjs`** — extended smoke tests with 5 new checks (tests 6–10): `ask`, `weights`, `history`, `bench --submit`, and `bench --submit --json`.
- **`version.json`** — bumped to `5.9.0`, `benchmark_id` updated to `sigmap-v5.9-main`.
- **`test/integration/v580-trust-completion.test.js`** — version assertion relaxed from exact `5.8.0` to `>= 5.8.0` so future releases don't break the test.

---

## [5.8.0] — 2026-04-18

### Added

- **`docs-vp/guide/compare-alternatives.md`** — new page comparing SigMap vs embeddings/RAG, RepoMix, Copilot context, and manual curation with side-by-side tables.
- **`docs-vp/guide/walkthrough.md`** — end-to-end walkthrough on a real repo (gin): ask → validate → judge → learn, with before/after token and cost table.
- **Canonical benchmark header block** — `:::info` snapshot block added to all 5 benchmark guide pages (benchmark, retrieval, task, quality, generalization), each referencing `sigmap-v5.8-main`.
- **30-second demo strip** — homepage `docs/index.html` now shows a terminal demo section (ask → validate → judge) directly below the stats bar.
- **User-type routing table** — `docs-vp/index.md` landing now opens with a "Who is this for?" table routing new users, daily users, team setup, MCP users, and monorepo evaluators.
- **Both new guide pages in sidebar** — `compare-alternatives` and `walkthrough` added under a new "Guides" section in `docs-vp/.vitepress/config.mts`.
- **`version.json` — `retrieval_lift` field** — `metrics.retrieval_lift: 5.9` added; `version` bumped to `5.8.0`; `benchmark_id` updated to `sigmap-v5.8-main`.
- **33 new integration tests** in `test/integration/v580-trust-completion.test.js` covering all 7 acceptance criteria.

### Changed

- **`version.json`** — bumped to `5.8.0`, `benchmark_id` updated to `sigmap-v5.8-main`.
- **SVG metrics** — `docs/impact-banner.svg`: `78.9%→80.0%` hit@5, `1.69→1.68` prompts, `40.6%→40.8%` prompt reduction card, "hallucinates" replaced with "unsupported answers"; `docs/comparison-chart.svg`: `78.9%→80.0%`.
- **`docs/index.html`** — `softwareVersion` structured-data updated to `5.8.0`; stats bar language count corrected from `21` to `29`.
- **`docs/readmes/vscode-extension.md`** — language count updated from `21` to `29 languages and formats` in badge, table, and architecture diagram.
- **`docs-vp/index.md`** — tagline updated to remove stale v5.5 text; `v5.7.0` snapshot reference updated to `v5.8.0`; stale v5.5 launch strip replaced with v5.8 announcement.
- **Benchmark sub-pages** — `retrieval-benchmark.md`, `task-benchmark.md`, `quality-benchmark.md`, `generalization.md` all updated to `v5.8.0` as latest saved run.
- **`generalization.md`** — adds "Why this matters" intro callout; stale `v5.5.0` snapshot reference updated to `v5.8.0`.
- **`v560-docs-sync` tests** — version assertions updated to accept `v5.8.0` as the current benchmark version.

---

## [5.7.0] — 2026-04-17

### Added

- **`version.json`** — canonical source of truth for version, benchmark date, language count (29), MCP tools (9), tests (495), and official benchmark metrics snapshot.

### Changed

- **README metrics** — `78.9%` → `80.0%` hit@5 and `1.69` → `1.68` prompts per task; benchmark table now matches official v5.7 snapshot.
- **README what's-new block** — replaced stale "v5.2" section with "What's new in v5.7" entry covering version.json, metrics sync, and language count correction.
- **`docs/index.html`** — `softwareVersion` updated from `5.5.0` to `5.7.0`.
- **`docs/languages.html`** — all user-facing "21 languages" occurrences updated to "29 languages and formats" (OG meta, Twitter meta, structured data headline, hero heading, stat badge, section heading, section sub).
- **`docs/quick-start.html`** — language count nav card updated from "21 languages" to "29 languages and formats".
- **`docs/repomix.html`** — current-copy language count updated from "21 languages" to "29 languages and formats".

---

## [5.6.0] — 2026-04-17

### Changed

- **Docs version labels** — all guide pages updated from `v5.2`/`v5.3`/`v5.4` workflow references to `v5.5`.
- **Benchmark sub-pages** — `retrieval-benchmark.md`, `task-benchmark.md`, `quality-benchmark.md` now show `v5.5.0` as the latest saved run (was `v5.3.0`/`v5.4.0`).
- **Canonical metrics** — `generalization.md` and `cli.md` updated to `80.0%` hit@5 and `1.68` prompts per task (were `78.9%` / `1.69`).
- **Judge vocabulary** — `judge.md` and `cli.md` judge examples now use only `Groundedness`, `Support level`, `Unsupported symbols`; removed `pass/fail` and raw `"verdict"` key.
- **Language count** — `docs/index.html` heading, list item, and structured-data description updated from `21 languages` to `29 languages and formats`; `softwareVersion` updated to `5.5.0`.
- **MCP tool count** — `mcp.md` description, heading, and test example updated from `8 tools` to `9 tools`.

### Added

- **Troubleshooting Issue 16** — new entry explaining the `--report` vs `--health` coverage-grade inconsistency and the v5.5 fix, with a before/after comparison table.
- **`test/integration/v560-docs-sync.test.js`** — 17 assertions covering all acceptance criteria for the docs sync.

---

## [5.5.0] — 2026-04-17

### Fixed

- **Coverage grade now accurate for mixed-content projects** — `coverageScore()` counts only code files (`.ts`, `.js`, `.py`, `.go`, etc.) in the denominator. Previously, `package.json`, `tsconfig.json`, `README.md`, and other non-code files were counted, causing inflated D-grades even when all code was covered (reported in discussion #81).
- **`--report` coverage label** — now reads `code files` instead of `source files`, and prints `(N non-code files skipped — json, md, config)` when non-code files were excluded.
- **`--report` actionable guidance** — modules marked `← attention needed` (<50% coverage) now show a tip block listing the three common causes and how to fix each.
- **`--health` label disambiguation** — coverage line renamed from `coverage … source files` to `file access … files accessible in srcDirs`, making it clearly distinct from the `--report` coverage metric.
- **`autoMaxTokens` silent-override warning** — when `autoMaxTokens` is active and overrides the user's `maxTokens` config value, `--report` now emits an explicit note explaining the override and how to disable it.

### Changed

- `src/analysis/coverage-score.js` exports `CODE_EXTS` (the allowlist Set) for use by other modules and tests.
- `coverageScore()` return object gains a `nonCodeSkipped` field (number of non-code files found in srcDirs but excluded from the denominator).

---

## [5.4.0] — 2026-04-17

### Added

- **Neovim plugin (`sigmap.nvim`)** — first-class Neovim integration in `neovim-plugin/`. Provides `:SigMap [args]` (async regen), `:SigMapQuery <text>` (TF-IDF retrieval in a floating window), `auto_run = true` (`BufWritePost` autocmd for source files), `require('sigmap').statusline()` for lualine/statusline widgets, and `:checkhealth sigmap` (validates Node 18+, binary presence, context file freshness).
- **Binary auto-detection** — plugin resolves the sigmap binary automatically: global `sigmap` → `npx sigmap` → local `gen-context.js` fallback; no manual config needed for most setups.
- **`release-neovim.yml` workflow** — tag `neovim-v*` to validate Lua files, run the full integration suite across Node 18/20/22, package the plugin as a `.tar.gz`, and create a GitHub Release.
- **CI now runs integration tests** — `ci.yml` runs both `node test/run.js` and `node test/integration/all.js` on every push and pull request.

---

## [5.3.0] — 2026-04-17

### Added

- **MCP auto-wire: Windsurf** — `sigmap --setup` now registers the MCP server in `.windsurf/mcp.json` (project-level) and `~/.codeium/windsurf/mcp_config.json` (global) using the standard `mcpServers` shape.
- **MCP auto-wire: Zed** — `sigmap --setup` now registers a context server in `~/.config/zed/settings.json` using Zed's `context_servers` shape (`command.path` / `command.args`).
- **Updated `--setup` snippet** — help output now prints manual config snippets for all four tools: Claude, Cursor, Windsurf, and Zed.

### Changed

- `registerMcp()` skips each target when the file does not exist and never overwrites an already-registered `sigmap` entry (idempotent).

---

## [5.2.0] — 2026-04-17

### Added

- **Learning engine** — new local-only weight store at `.context/weights.json` with path-normalized per-file multipliers, clamp safety (`0.30..3.00`), and decay on every non-reset mutation.
- **`sigmap learn`** — manually boost or penalize ranked files with `--good <files...>`, `--bad <files...>`, and `--reset`. Invalid or out-of-repo paths are skipped with warnings; the command exits non-zero when no valid targets remain.
- **`sigmap weights [--json]`** — explainability view for learned ranking multipliers. Human mode prints a compact table and reset hint; JSON mode emits the raw learned-weight object.
- **Opt-in judge learning** — `sigmap judge --response <file> --context <file> --learn` now extracts file headings from query/generated context files and applies small boosts or penalties when groundedness is confidently high or low.

### Changed

- **Ranker learned weighting** — `rank(query, sigIndex, { cwd })` now loads `.context/weights.json` and multiplies non-empty-query scores by learned file multipliers. Empty-query fallback ordering is unchanged.
- **Learning-aware rank call sites** — `sigmap ask`, `sigmap --query`, `sigmap validate --query`, and MCP `query_context` now pass `cwd` into the ranker so learned weights apply consistently across CLI and MCP flows.

## [5.1.0] — 2026-04-16

### Added

- **Benchmark history tracking** — all three benchmark scripts (`run-retrieval-benchmark.mjs`, `run-benchmark.mjs`, `run-task-benchmark.mjs`) now append a structured NDJSON entry to `.context/benchmark-history.ndjson` after each run (`type: "retrieval" | "token-reduction" | "task"`).
- **`sigmap history` benchmark trend rows** — when `.context/benchmark-history.ndjson` exists, `sigmap history` prints a retrieval `hit@5` sparkline row and a token-reduction sparkline row below the usage table. The command no longer exits early when the usage log is empty.
- **Dashboard `readBenchmarkTrend` uses local history** — `src/format/dashboard.js` now prefers `.context/benchmark-history.ndjson` over the CI-only `benchmarks/results/` directory, so the dashboard hit@5 trend chart populates for all users after running any benchmark locally.

---

## [5.0.0] — 2026-04-16

### Added

- **`sigmap judge --response <file> --context <file>`** — rule-based groundedness scoring engine (`src/judge/judge-engine.js`). Computes a 0–1 score from token overlap between an LLM response and its source context. Exits 0 when verdict is `pass`, exits 1 on `fail`. Supports `--json` (emits `{ score, verdict, reasons }`) and `--threshold` override.
- **Config `extends`** — `gen-context.config.json` now accepts an `"extends"` key pointing to a local JSON file path or HTTPS URL. The base config is deep-merged (DEFAULTS → base → local), with HTTPS responses cached for 1 hour in `.context/config-cache/`.
- **`sigmap history [--last N] [--json]`** — displays last N usage log entries as a table with a Unicode sparkline (▁▂▃▄▅▆▇█) for the token trend. Reads from `.context/usage.ndjson` (requires `tracking: true` in config).

---

## [4.3.0] — 2026-04-16

### Added

- **`sigmap validate`** — validates config (srcDirs exist, exclude patterns, maxTokens range), computes coverage as sig-index size / total source files, warns when coverage < 70%, exits 1 on hard errors. Optional `--query "<q>"` checks that PascalCase/camelCase symbols in the query appear in top-5 ranked context. Supports `--json`.
- **`sigmap --ci [--min-coverage N] [--json]`** — GitHub Actions exit gate: exits 0 when coverage ≥ threshold (default 80%), exits 1 otherwise. Uses sig-index vs source file count for a budget-aware coverage metric. Ready for `npx sigmap --ci` in CI workflows.
- **`extractQuerySymbols(query)`** — internal helper that extracts PascalCase and camelCase identifiers from a query string for symbol-level coverage checks in `sigmap validate`.

### Changed

- **`sigmap ask`** — now emits a stderr warning when coverage < 70%, pointing users to `sigmap validate` for diagnosis.

---

## [4.2.0] — 2026-04-16

### Added

- **`sigmap ask "<query>"`** — unified pipeline: intent detection → ranked mini-context → coverage check → cost estimate → risk level in one command. Supports `--json` for machine-readable output.
- **Intent detection** (`detectIntent`) — classifies queries as `debug`, `explain`, `refactor`, `review`, or `search` and adjusts ranking weights accordingly for higher-relevance results.
- **`sigmap query --context`** — writes a targeted mini-context (top-5 ranked files, ≤ 2 000 tokens) to `.context/query-context.md` for direct pasting into an LLM prompt.
- **`--cost [--model <name>] [--json]`** — prints per-model token/dollar cost comparison (raw source vs SigMap output). Supports `gpt-4o`, `gpt-4`, `claude-3-5-sonnet`, `claude-opus-4`, `gemini-1.5-pro`, and more.
- **`sigmap suggest-profile [--short]`** — reads the last git commit message and staged files to recommend a context profile (`debug`, `architecture`, `review`, or `default`).
- **`sigmap compare [--json]`** — human-readable CLI wrapper over the retrieval benchmark scripts, showing SigMap vs baseline hit@5, token counts, and lift multiplier.
- **`sigmap share`** — prints a shareable one-liner with live benchmark numbers and copies it to the clipboard via `pbcopy`/`xclip`.

---

## [4.1.2] — 2026-04-16 — Feat: --output <file> flag for custom context path

### Added

- **`--output <file>` flag** — write signatures to any custom path, not just
  an adapter's fixed location:
  ```bash
  sigmap --output .context/ai-context.md          # default generation
  sigmap --adapter claude --output shared/sigs.md # adapter + custom path
  ```
  The custom file is written **in addition to** the adapter's default output so
  existing tooling is unaffected.

- **Automatic discovery for `--query`** — the resolved path is persisted to
  `gen-context.config.json` as `customOutput` so subsequent `--query` runs
  find it automatically without needing to pass `--output` again:
  ```bash
  sigmap --output .context/ai-context.md          # generates + persists path
  sigmap --query "add a new extractor"             # auto-finds .context/ai-context.md
  ```

- **Priority order for `--query` context resolution** (most specific first):
  1. `--output <file>` flag — explicit path
  2. `--adapter <name>` flag — adapter's fixed output path
  3. `customOutput` in `gen-context.config.json` — persisted from last `--output` run
  4. Probe all known adapter output paths — existing fallback behaviour

- **Nested directories created automatically** — `--output a/b/c/file.md`
  creates any missing parent directories.

### Tests

- Added `test/integration/output-flag.test.js` (13 tests) covering: custom
  file creation, parseable headers, config persistence, nested dirs, missing
  arg error, `--adapter` + `--output` combo, explicit `--query` with `--output`,
  auto-discovery via persisted config, missing-file error, `--output` overrides
  `--adapter` during `--query`.

---

## [4.1.1] — 2026-04-16 — Fix: --query works with any adapter output

### Fixed

- **`--query` fails after `--adapter` generation** (`[sigmap] no context file found`):  
  `buildSigIndex` hardcoded `.github/copilot-instructions.md` as the only
  context file path, so `--query` always failed when any adapter other than
  `copilot` wrote to a different location (`CLAUDE.md`, `AGENTS.md`,
  `.cursorrules`, `.windsurfrules`, etc.).

  `buildSigIndex` now probes all nine known adapter output paths in priority
  order and returns the first non-empty index:
  ```
  copilot → claude → codex → cursor → windsurf → openai → gemini → llm-full → llm
  ```
  Human-written preamble before the `## Auto-generated signatures` marker
  (e.g. custom content in `CLAUDE.md`) is skipped so those `###` sections
  don't pollute the signature index.

- **`--adapter <name> --query "..."` combination ignored the adapter flag**:  
  The `--query` handler now detects a co-present `--adapter` flag, resolves
  that adapter's output path, and reads from it directly — so both forms work:
  ```bash
  # generate with claude adapter, then query without re-specifying adapter
  node gen-context.js --adapter claude
  node gen-context.js --query "add a new extractor"

  # or pin explicitly in one command
  node gen-context.js --adapter claude --query "add a new extractor"
  ```

- **`--analyze --json` output truncated at ~8 KB on macOS**:  
  Calling `process.exit(0)` immediately after `process.stdout.write(largeJson)`
  truncated output because the underlying pipe write is asynchronous even
  when `write()` returns `true`. Fixed by using the write callback so the
  process exits only after the OS has accepted all bytes.

### Tests

- Added `test/integration/query-adapter.test.js` (17 tests) covering every
  adapter output path (unit + CLI), probe order, marker-skipping, explicit
  `opts.contextPath` override, and empty-project fallback.

---

## [4.1.0] — 2026-04-15 — Smart Budget: auto-scaling token budget

### Added

- **Auto-scaling token budget** (`autoMaxTokens: true`, default on):  
  Replaces the old fixed 6 000-token default with a formula that sizes the budget to your repo:
  ```
  effective = clamp(ceil(totalSigTokens × coverageTarget), 4000, floor(modelContextLimit × maxTokensHeadroom))
  ```
  - `coverageTarget` (default `0.80`) — target fraction of source files to include
  - `modelContextLimit` (default `128000`) — model context window size; hard cap = `limit × headroom`
  - `maxTokensHeadroom` (default `0.20`) — fraction of the model window reserved for SigMap output (default hard cap: **25 600 tokens**)
  - Minimum floor: **4 000 tokens** (prevents tiny repos from being under-budgeted)
  - When the hard cap prevents hitting the coverage target by more than 10 percentage points, SigMap warns and suggests `strategy: "per-module"`

- **Four new config keys** (all optional, documented in `gen-context.config.json.example`):
  | Key | Default | Description |
  |---|---|---|
  | `autoMaxTokens` | `true` | Enable auto-scaling |
  | `coverageTarget` | `0.80` | Target fraction of source files |
  | `modelContextLimit` | `128000` | Model context window (tokens) |
  | `maxTokensHeadroom` | `0.20` | Fraction of context for SigMap |

- **Post-run summary annotation**: coverage line now shows `[budget: N auto-scaled]` when the formula overrode the configured `maxTokens`.

- **Per-module strategy budget fix**: each module now gets its own full effective budget instead of a proportional slice, which was the limiting factor that made `per-module` less useful than advertised.

- **Tracking log fields**: `autoBudget: true/false` and `budgetLimit: N` added to `.context/usage.ndjson` entries.

- **12 new integration tests** (`test/integration/auto-budget.test.js`): cover MIN floor, proportional scaling, hard cap, disabled auto-scaling, custom `coverageTarget`/`modelContextLimit`/`maxTokensHeadroom`, warning emission, and empty-project edge case.

### Changed

- `autoMaxTokens: false` + explicit `maxTokens` preserves the old fixed-budget behaviour exactly — fully backwards compatible.
- `printReport` now labels the budget `(auto-scaled)` vs `(fixed)` in the report line.

### Benchmarks (v4.1.0)
- Token reduction: **97.6% average** across 18 repos ✅  
- Retrieval hit@5: **84.4%** ✅  
- With auto-scaling enabled, all 18 benchmark repos now stay within a sensible budget that targets ≥ 80% file coverage rather than the old 6 K ceiling.

---

## [4.0.2] — 2026-04-15 — Bundle factory fix (re-release of 4.0.1)

### Fixed
- v4.0.1 was published to npm/GitHub Packages before the binary CI step ran, which meant the published package contained the incomplete bundle (missing `./src/analysis/coverage-score` factory). v4.0.2 is a clean re-release with all fixes from 4.0.1 and the correct bundle.

---

## [4.0.1] — 2026-04-15 — Config auto-detection fix

### Fixed
- **Bundled `loadConfig` lacked `detectAutoSrcDirs`**: the inline `__factories["./src/config/loader"]` copy inside `gen-context.js` was a stripped-down version that returned raw `DEFAULTS` without filesystem auto-detection. After `--init` wrote a config with 6 hardcoded `srcDirs`, auto-detection was bypassed and custom project directories were missed — causing coverage to drop for any project whose source lives outside those 6 dirs. The bundled loader is now fully in sync with `src/config/loader.js`.
- **`--init` config hardcoded `srcDirs`**: `gen-context.config.json.example` had `"srcDirs": ["src","app","lib","packages","services","api"]` as a plain value. Any project that ran `--init` would lock into those 6 dirs and lose auto-detection. The example now omits `srcDirs` entirely and uses `_comment` keys to explain that auto-detection runs automatically. Users who need custom dirs can add `srcDirs` manually.
- **`gen-context.config.json` (SigMap repo)**: restored explicit `"srcDirs": ["src","packages"]` so the repo's own context generation is not affected by auto-detection picking up `docs-vp/`, `scripts/`, `test/`, and `vscode-extension/`.
- **Example `outputs` updated**: `gen-context.config.json.example` now lists all four standard adapters — `["copilot","codex","claude","gemini"]` — matching the recommended setup.

### Benchmarks (v4.0.1)
- Token reduction: **97.6% average** across 18 repos ✅
- Retrieval hit@5: **84.4%** (up from 83.3% in v4.0.0)

---

## [4.0.0] — 2026-04-15 — Intelligence Layer

### Added
- **Coverage score** (`src/analysis/coverage-score.js`): measures what fraction of source files made it into context after token-budget application.
  - Grade scale: A ≥ 90% · B ≥ 75% · C ≥ 50% · D < 50%
  - Confidence indicator: HIGH / MEDIUM / LOW
  - Per-module breakdown per srcDir via `perModule` Map
- **Confidence indicators in all output writers**: every generated file now includes a metadata comment:
  ```
  <!-- sigmap: version=4.0.0 confidence=HIGH coverage=94% dropped=9 commit=abc1234 -->
  ```
  Applies to: `copilot`, `claude`, `cursor`, `windsurf`, `openai`, `gemini` adapters.
- **`--report` module heatmap**: ASCII bar chart per srcDir showing coverage percentage:
  ```
  Module Coverage:
    src                ████████████████ 100% (64/64 files)
    packages           ██████████████░░  86% (12/14 files)
  ```
  `--report --json` gains a `coverage` object with `score`, `grade`, `confidence`, `totalFiles`, `includedFiles`, `droppedFiles`, and `perModule`.
- **`--diff` risk score**: each changed file is now classified LOW / MEDIUM / HIGH based on reverse-dependency BFS, public API exports, route status, and config-file status:
  ```
  [sigmap] Risk: Changed files (3):
    src/auth/service.ts         [HIGH]    — exports public API, 5 downstream dependents
    src/config/database.ts      [MEDIUM]  — config file
    src/utils/format.ts         [LOW]     — no dependents, internal utility
  ```
- **Coverage in post-run summary**: every normal run now prints a `Coverage` line:
  ```
   Coverage       : A (97%)  — 76 of 78 source files included
  ```
- **Coverage in `--health` and `--health --json`**: coverage grade, score, and file counts are included in both text and JSON health output. `--health --json` adds `coverage`, `coverageGrade`, `coverageConfidence`, `coverageTotalFiles`, `coverageIncludedFiles`.

### Changed
- **Token budget drop order step 5**: now uses `signalQuality = sigs / linesOfCode` (least-informative files dropped first) instead of the previous "fewest sigs" heuristic.
- **`src/eval/analyzer.js` `analyzeFiles()` output**: each file stat now includes `linesOfCode` and `signalQuality` fields.

### Benchmark (v4.0.0)
- Token reduction: **97.6% average** across 18 repos (target ≥ 97.0%) ✅
- Retrieval hit@5: 83.3% (retrieval improvement targeted in v4.5 with adaptive query)

---

## [3.5.0] — 2026-04-14 — Phase C/D Intelligence Expansion

### Added
- **Phase C framework-specialized extractors** for richer framework-level signatures:
  - TypeScript React: `.tsx` component metadata (props, hooks, handlers)
  - Vue SFC: `.vue` component metadata (props, emits, slots, lifecycle)
  - Python dataclass/model patterns: dataclasses, Pydantic models, ORM-style fields
- **Phase D cross-module pattern extractor**:
  - Detects DI containers and injection signatures
  - Detects service, repository, middleware, and controller layer hints
  - Detects type-to-implementation linkage and domain use-case cues
  - Flags unsafe patterns (null-check risks, weak validation, error exposure)

### Changed
- **Extractor mapping expanded** so framework-specific files route to specialized extractors (`.tsx` and `.vue`) for higher-signal signatures.
- **Standalone/bundled runtime wiring updated** to include new Phase C/D extractors in factory resolution.

### Testing
- Added integration coverage for Phase C extractors (`phase-c-extractors`) and Phase D pattern inference (`phase-d-patterns`).
- Current results:
  - `phase-c-extractors`: 3 passed, 0 failed
  - `phase-d-patterns`: 10 passed, 0 failed

---

## [3.4.0] — 2026-04-14 — Phase A/B Coverage Expansion

### Added
- **Phase A extractor support** for high-value config and docs formats:
  - TOML: `.toml`
  - Java/INI properties: `.properties`
  - XML: `.xml`
  - Markdown technical docs: `.md`
- **Bundled runtime factory wiring** for new extractors so standalone/binary execution resolves the same modules as source mode.

### Changed
- **Framework-aware source discovery** defaults expanded for Next/React, Angular, Rails, Laravel, and Flask/Python-style layouts.
- **Strategy audit coverage rules** updated to treat Phase A formats as supported instead of important unsupported baselines.
- **Default srcDirs** broadened to improve first-run context quality on framework-heavy repositories.
## [3.3.4] — 2026-04-14 — Binary Bundle Fix

### Fixed
- **Standalone binary pre-flight now passes for new P1 extractors**
  - Added missing bundled `__factories` entries in `gen-context.js` for:
    - `./src/extractors/graphql`
    - `./src/extractors/protobuf`
    - `./src/extractors/sql`
    - `./src/extractors/terraform`
  - Resolves CI/build failure in `scripts/build-binary.mjs` reporting missing `src/` modules in bundle.

---

## [3.3.3] — 2026-04-14 — Auto srcDirs + P1 Extractors

### Added
- **P1 extractor support** for additional high-value formats:
  - SQL: `.sql`
  - GraphQL: `.graphql`, `.gql`
  - Terraform: `.tf`, `.tfvars`
  - Protobuf: `.proto`
- **Extractor registration updates** across runtime and core mapping so the new file types are parsed consistently.

### Changed
- **Auto source directory detection** (framework- and manifest-aware) in config loading and strategy auditing.
- **Auto maxDepth tuning** in strategy audit based on repository file-depth distribution.
- **Benchmark strategy-audit reports refreshed** to reflect improved source discovery and coverage.
- **Language support count updated from 21 to 25** across core README and extension README.

---

## [3.3.1] — 2026-04-10 — Patch: `--each --adapter` flag combination

### Fixed
- **`--each --adapter <name>` now works correctly** · [#37](https://github.com/manojmallick/sigmap/issues/37)
  - Running `sigmap --each --adapter claude` (or any adapter) from a parent directory containing multiple git repos now correctly writes the chosen adapter output (e.g. `CLAUDE.md`) inside each sub-repo.
  - Root cause: the `--adapter` handler ran before `--each` in `main()`, so `--each` was never reached when both flags were supplied together. The `--each` block is now evaluated first.
  - `runEach()` accepts an optional `adapterOverride` parameter that merges `outputs`/`adapters` into each sub-repo's config before calling `runGenerate`, mirroring how the standalone `--adapter` flag works.
  - Invalid adapter names passed alongside `--each` now exit non-zero with a clear error message listing valid adapters.

---

## [3.3.0] — 2026-04-08 — Context-Aware CLI & Command Switcher

### Added
- **Context-aware `--help` output** — `gen-context.js` and `gen-project-map.js` now detect how they were invoked and show the matching command in every usage example:
  - `npx sigmap --help` shows `npx sigmap <flag>`
  - `sigmap --help` shows `sigmap <flag>`
  - `gen-context --help` shows `gen-context <flag>`
  - `node gen-context.js --help` shows `node gen-context.js <flag>` (unchanged for local users)
  - Detection uses `process.argv[1]` path analysis (npx cache path, basename without `.js`, fallback)
- **`docs/cli.html` command picker** — four-tab switcher ("How you run it:") above the flags reference terminal updates every code block on the page (all `.tw` spans and `.term-title` bars) to the selected invocation style. Applies equally to `gen-project-map` references. Selection is saved in `localStorage` and restored on next visit.
- **`docs/readmes/`** — `vscode-extension.md` and `jetbrains-plugin.md` added for docs site cross-linking
- **`gen-context.config.json`** — example config committed alongside the repo for reference
- **Gemini adapter context file** — `.github/gemini-context.md` now generated alongside the copilot instructions file
- **SEO improvements across all docs pages** — structured data, canonical tags, improved meta descriptions, and `sitemap.xml` updated to v3.3.0

### Added (from `fix/defaults-css-coverage-budget-36` · #38)
- **`--each` flag — multi-repo parent directory support** · [#37](https://github.com/manojmallick/sigmap/issues/37)
  - Running `node gen-context.js --each` (or `sigmap --each`) from a parent directory that contains multiple independent git repos now processes each repo in one shot.
  - Scans immediate subdirectories; a subdirectory qualifies when it contains `.git` or a recognised project manifest (`package.json`, `pyproject.toml`, `Cargo.toml`, `go.mod`, `build.gradle`, `pom.xml`, `requirements.txt`).
  - Each sub-repo is processed independently: it loads its own `gen-context.config.json` when present, uses its own `srcDirs`, and writes its own context files (`.github/copilot-instructions.md` etc.) inside itself.
  - Summary printed at the end: `[sigmap] --each: done — 3 succeeded`.
  - Distinct from `--monorepo` (which processes workspace packages inside a single repo); `--each` targets sibling repos under a shared parent directory.

### Fixed
- **Default excludes expanded + `changesCommits` corrected** · [#36](https://github.com/manojmallick/sigmap/issues/36)
  - `changesCommits` default raised from `5` to `10` to match the documented recommended value.
  - Added `playwright-tmp`, `playwright-report`, `test-results`, `.turbo`, `storybook-static`, `.docusaurus` to the default `exclude` list so they are skipped on modern JS/TS projects without requiring manual config.
- **CSS extractor: utility-class noise elimination** · [#36](https://github.com/manojmallick/sigmap/issues/36)
  - Files where ≥70% of top-level selectors are single-word (e.g. Tailwind / compiled utility CSS) are now detected automatically and class extraction is skipped entirely, preventing the output from being flooded with low-signal entries like `.p-4`, `.flex`, `.text-sm`.
  - For semantic CSS, BEM/hyphenated class names (e.g. `.modal-header`, `.btn-primary`) fill output slots first; single-word names only fill remaining slots up to 8.
- **`testCoverage` false-positive coverage markers eliminated** · [#36](https://github.com/manojmallick/sigmap/issues/36)
  - Removed the "all word tokens" pass from `buildTestIndex` that caused common words appearing anywhere in a test file (comments, variable names) to mark unrelated functions as `✓` tested.
  - Index now only includes tokens extracted from test name strings (`it('...')`, `test('...')`, `describe('...')`) and identifiers directly invoked inside `expect(fn())` / `assert(fn())` calls.
- **Token budget: mock/fixture files drop before test files** · [#36](https://github.com/manojmallick/sigmap/issues/36)
  - Added `isMockFile()` helper and priority-9 drop tier in `applyTokenBudget`. Paths matching `mock`, `mocks`, `stub`, `stubs`, `fake`, `fakes`, `demo`, `__mocks__`, `fixtures` or file suffixes like `.mock.ts` now drop before test files (priority 8) and after generated files (priority 10), keeping real production code in context longer.
  - Fixed `applyTokenBudget` loop direction: generated/mock/test files now drop first (as intended) rather than source files being dropped first.
- **`--monorepo` now respects configured output adapter** · [#39](https://github.com/manojmallick/sigmap/issues/39)
  - Removed hardcoded `outputs: ['claude']` override — `--monorepo` now inherits `outputs` from the root config, defaulting to `copilot` (writes `copilot-instructions.md` per package).
- **IDE command resolution parity (VS Code/Open VSX/JetBrains)** · [#34](https://github.com/manojmallick/sigmap/issues/34)
  - Unified resolver now checks both `sigmap` and `gen-context` executables with consistent fallback order.
  - Improved cross-platform probing for local workspace bins, Volta/nvm/npm-global installs, and OS-specific command lookup (`where` on Windows, shell lookup on macOS/Linux).
  - JetBrains plugin now resolves commands more reliably outside Node-only projects and provides OS-aware install guidance when command lookup fails.

### Changed
- **Installation guidance for plugin users**
  - Updated VS Code/Open VSX and JetBrains setup docs to include all supported install paths: npm global, npm local, npx, standalone binaries in PATH, and project-local `gen-context.js`.

---

## [3.2.1] — 2026-04-07 — Patch: IDE Command Resolution & Plugin Parity

### Added
- **IDE command resolution parity (VS Code / Open VSX / JetBrains)** · [#34](https://github.com/manojmallick/sigmap/issues/34)
  - Unified resolver checks both `sigmap` and `gen-context` executables with consistent fallback order
  - Improved cross-platform probing for local workspace bins, Volta/nvm/npm-global installs, and OS-specific command lookup (`where` on Windows, shell lookup on macOS/Linux)
  - JetBrains plugin resolves commands more reliably outside Node-only projects and provides OS-aware install guidance when command lookup fails
- **`scripts/sync-versions.mjs`** — one-shot script to bump version across all package manifests and `gen-context.js` in sync
- **Updated plugin docs** — VS Code/Open VSX and JetBrains setup docs updated with all supported install paths (npm global, npm local, npx, standalone binaries, project-local `gen-context.js`)

---

## [3.2.0] — 2026-04-07 — Cross-Platform Standalone Binaries

### Added
- **Standalone binaries** — macOS (arm64 + x64), Linux x64, Windows x64 built via Node.js SEA
  - No Node.js or npm required to run SigMap
  - Download from GitHub Releases: `sigmap-darwin-arm64`, `sigmap-darwin-x64`, `sigmap-linux-x64`, `sigmap-win32-x64.exe`
  - SHA-256 checksums in `sigmap-checksums.txt` attached to every release
- **`scripts/build-binary.mjs`** — reproducible local binary build for the current platform
- **`scripts/verify-binary.mjs`** — smoke tests `--version`, `--help`, default generate, `--health`, `--report` against a fixture repo
- **`.github/workflows/release-binaries.yml`** — GHA matrix builds all 4 targets on tag push; attaches artifacts to the GitHub Release
- **`test/fixtures/binary-smoke/`** — minimal fixture project used by CI smoke tests
- **`docs/binaries.md`** — install guide covering download, `chmod +x`, macOS Gatekeeper, Windows SmartScreen, and checksum verification

### Technical
- Uses [Node.js SEA](https://nodejs.org/api/single-executable-applications.html) (Node 20 `--experimental-sea-config` + `postject`)
- `gen-context.js` updated to include previously-missing `src/` modules (`todos`, `coverage`, `prdiff`) in the SEA bundle; `requireSourceOrBundled()` fallback remains SEA-compatible
- Binary builds run natively per OS in GHA (no cross-compilation)
- `release-attach` job waits for the npm-publish Release to exist before uploading binary assets

---

## [3.1.0] — 2026-04-07 — Global Command Detection & VS Code Prerelease Fix

### Added
- **VS Code extension: global command auto-detection** — extension now finds `gen-context` installed via Volta, nvm, npm, or Homebrew without requiring `gen-context.js` in the project root or a manual `sigmap.scriptPath` setting
  - Probe chain: local `node_modules/.bin` → `~/.volta/bin` → `~/.nvm/versions/node/*/bin` (newest first) → `/usr/local/bin` → `/opt/homebrew/bin` → `~/.npm-global/bin` → login-shell `which`
  - Works on macOS GUI apps that do not inherit shell `PATH`
  - `resolveGlobalCommand()` + unified `resolveRunner()` added to `vscode-extension/src/extension.js`
- **VS Code extension: actionable error message** — when command is not found, notification offers "Copy install command" (copies `npm install -g sigmap` to clipboard) and "Open settings" buttons instead of a plain warning
- **Prerelease GitHub Actions workflow** — new `prerelease-publish.yml` for manual alpha/beta/rc releases across all 5 platforms (npm, GitHub Packages, VS Code, Open VSX, JetBrains) without marking as @latest
  - VS Code/Open VSX uses `major.minor.patch` versioning (VSCE prerelease constraint)
  - npm/JetBrains use full semver prerelease suffix (e.g. `3.1.0-beta.1`)

### Fixed
- **`output` config key not honored for copilot adapter** · [#30](https://github.com/manojmallick/sigmap/issues/30)
  - Custom `output` path in config now correctly used for copilot adapter instead of hard-wired `.github/copilot-instructions.md`
  - Added `resolveAdapterPath()` helper to centralize adapter path resolution
  - Other adapters (claude, cursor, windsurf) continue to use fixed paths as designed
  - 5 new integration tests ensure custom paths work correctly across all config combinations
- **JetBrains plugin: global `gen-context` command support** · [#29](https://github.com/manojmallick/sigmap/issues/29)
  - Plugin now resolves command via fallback chain: local `gen-context.js` → `node_modules/.bin/gen-context` → system `PATH`
  - Enables use in Java, Rust, Go and other non-Node projects with `gen-context` installed globally via Volta/nvm/npm
- **VS Code prerelease versioning** — workflow previously failed publishing because semver-suffixed versions (e.g. `3.1.0-alpha.1`) are rejected by VSCE; fixed by splitting into separate `npm_version` and `vscode_version` outputs

### Technical
- `resolveRunner()` returns `{ type: 'script' | 'command', path }` allowing extension to run either `node "path/gen-context.js"` or `"~/.volta/bin/gen-context"` without modification to the terminal command

### How to release (tag triggers automatic publish)
```bash
git tag v3.1.0
git push origin v3.1.0
# npm-publish.yml auto-triggers and publishes to all 5 platforms
```

---

## [3.0.0] — 2026-04-06 — Platform: Multi-Adapter Architecture

### Added
- **Multi-adapter platform** — `packages/adapters/` with 6 output adapters: `copilot`, `claude`, `cursor`, `windsurf`, `openai`, `gemini`
- **`--adapter <name>` CLI flag** — generate output for a specific adapter only (e.g. `node gen-context.js --adapter openai`)
- **`adapt()` in packages/core** — programmatic API: `const { adapt } = require('sigmap'); adapt(context, 'openai')`
- **New config key `adapters`** — replaces `outputs`; old `outputs` key is silently mapped for full backward compatibility
- **OpenAI adapter** — formats context as an OpenAI system prompt, writes `.github/openai-context.md`
- **Gemini adapter** — formats context as a Gemini system instruction, writes `.github/gemini-context.md`
- **API stability guarantee** — `packages/core` API is now semver-stable; breaking changes require v4.0
- **20 new integration tests** in `test/integration/adapters.test.js`

### Changed
- `packages/core/index.js` — adds `adapt()` export alongside existing `extract`, `rank`, `scan`, `score`, `buildSigIndex`
- `writeOutputs()` in `gen-context.js` — now routes `openai`, `gemini` through adapter pipeline

### Backward compat
- `outputs: ["copilot","claude"]` config still works — automatically mirrored to `adapters`
- All existing CLI flags unchanged

---

## [2.10.0] — 2026-04-06 · [#25](https://github.com/manojmallick/sigmap/issues/25)

### Planned additions
- **Report charts** — add chart-ready output for token reduction, signatures per file, and budget utilization trends.
- **Advanced metrics** — extend evaluation output with precision@K, recall@K, MRR, and query-level diagnostics.
- **CLI reporting mode** — introduce richer report surfaces for both human-readable tables and structured JSON artifacts.
- **Benchmark visibility** — include comparative metrics across runs to track regressions and improvements over time.
- **Docs refresh** — align roadmap and docs site references to the v2.10 milestone.

### Go / No-go criteria
- Full test suite passes (extractor + integration).
- Report output includes chart-friendly numeric series and summary stats.
- Benchmark metrics remain stable or improve versus v2.9 baseline.
- Generated docs and release metadata are version-synced to `2.10.0`.

---

## [2.9.1] — 2026-04-06 · JetBrains Marketplace Publishing

### Added
- **JetBrains Marketplace publishing** — automated publishing job in GitHub Actions workflow
- **Gradle wrapper** — gradlew, gradlew.bat for consistent JetBrains plugin builds
- **Publishing guide** — comprehensive [docs/JETBRAINS_PUBLISH.md](docs/JETBRAINS_PUBLISH.md)
- **JetBrains Marketplace badge** — added to README.md
- **One-time token setup** — documented in publishing guide

### Details
- GitHub Actions workflow now includes `publish-jetbrains` job
- Publishes to JetBrains Marketplace alongside npm, GitHub Packages, VS Code, and Open VSX
- Requires `JETBRAINS_PUBLISH_TOKEN` secret for automated publishing
- Full publishing guide with manual instructions and troubleshooting

---

## [2.9.0] — 2026-04-05 · IDE Expansion: JetBrains Plugin

### Added
- **JetBrains plugin** — native support for all JetBrains IDEs (IntelliJ IDEA, WebStorm, PyCharm, GoLand, RubyMine, etc.)
- **Plugin descriptor** — `jetbrains-plugin/src/main/resources/META-INF/plugin.xml` with 3 actions + status bar widget
- **Kotlin sources** — 5 action implementations (RegenerateAction, OpenContextFileAction, ViewRoadmapAction, HealthStatusBar, Factory)
- **Toolbar actions** — "Regenerate Context" (Ctrl+Alt+G), "Open Context File", "View Roadmap"
- **Status bar widget** — shows health grade (A-F) and time since last regeneration; updates every 60s
- **Gradle build** — `jetbrains-plugin/build.gradle.kts` with IntelliJ Platform 2024.1+ compatibility
- **Setup documentation** — [docs/JETBRAINS_SETUP.md](docs/JETBRAINS_SETUP.md) with installation guide, features, troubleshooting
- **Integration tests** — `test/integration/jetbrains.test.js` with 11 structure validation tests

### Details
- Compatible with IntelliJ IDEA 2024.1 - 2024.3 (Community & Ultimate)
- One-click context regeneration from IDE toolbar
- Automatic status bar updates every 60 seconds
- Full Kotlin/Gradle plugin with proper plugin.xml structure

---

## [2.8.0] — upcoming · [#21](https://github.com/manojmallick/sigmap/issues/21) · branch: `feat/v2.8-snippet-retrieval`

### Planned additions
- **Snippet extraction** — `src/retrieval/snippets.js`: extract relevant code blocks (functions, classes, methods) from ranked files
- **Hybrid scoring** — combine file-level relevance with snippet-level relevance; snippets inherit file score + get their own local score
- **`--query --snippets` CLI flag** — return top-k snippets (not full file sigs), with line numbers and context
- **`query_context` MCP enhancement** — add `snippets: true` option; response includes snippet text + line ranges
- **Smart context window** — include 2-3 lines before/after snippet for context
- **Configuration** — `retrieval.snippets: { enabled: true, minLines: 3, maxSnippets: 5 }`
- **`test/integration/snippets.test.js`** — 12 tests: snippet extraction, scoring, line number accuracy, context window

### Go / No-go criteria
- All tests green (21 extractor + all integration)
- `--query "extract signatures" --snippets` returns 3-5 relevant snippets with correct line numbers
- MCP `query_context` with `snippets: true` returns snippet text
- Snippet relevance improves precision@3 by ≥10% over full-file retrieval
- Performance: <150ms for 1000-file repos with snippets enabled

---

## [2.7.0] — 2026-04-05 · [#19](https://github.com/manojmallick/sigmap/issues/19)

### Planned additions
- **Fine-tuned ranking weights** — optimize `exactToken`, `symbolMatch`, `prefixMatch`, `pathMatch`, and `recencyBoost` weights in `src/retrieval/ranker.js` based on benchmark-driven evaluation
- **TF-IDF scoring option** — add TF-IDF (term frequency-inverse document frequency) as an alternative scoring method for better semantic relevance in large codebases
- **Configurable weight presets** — `precision`, `balanced`, `recall` presets for different use cases; configurable via `retrieval.preset` in config
- **`formatRankTable` and `formatRankJSON` improvements** — better output formatting for ranked results with score breakdown and relevance explanation
- **Performance optimization** — optimize ranking algorithm for large codebases (10K+ files), target <100ms for --query on 1000-file repos
- **Regression tests** — ensure hit@5 maintains ≥ 0.80 (no regression from v2.6)
- **Precision improvement** — target precision@5 improvement of ≥ 5% over v2.6

### Config additions
```json
{
  "retrieval": {
    "topK": 10,
    "recencyBoost": 1.5,
    "preset": "balanced",
    "weights": {
      "exactToken": 1.0,
      "symbolMatch": 0.5,
      "prefixMatch": 0.3,
      "pathMatch": 0.8
    }
  }
}
```

### Go / No-go criteria
- All tests green (21 extractor + all integration suites)
- Benchmark hit@5 ≥ 0.80 (no regression from v2.6)
- Precision@5 improves by ≥ 5%
- `--query` performance <100ms for 1000-file repos

---

## [2.6.0] — 2026-04-05 · [#16](https://github.com/manojmallick/sigmap/issues/16)

### Planned additions
- **`benchmarks/repos/`** — register 5 real open-source repos (express, flask, gin, spring-petclinic, rails) as git submodules or clone targets for evaluation
- **`benchmarks/tasks/retrieval-real.jsonl`** — 50 real evaluation tasks across all 5 repos; structured JSONL format compatible with the v2.1 benchmark runner
- **`--benchmark --repo <path>` CLI flag** — run benchmark against external repository; supports any git-cloned project
- **`--report --paper` CLI flag** — generates `benchmarks/reports/paper-metrics.md`: token reduction table (baseline vs SigMap per repo), hit@5 and MRR per repo, latency table (p50, p95, p99 in ms), LaTeX-ready table block for copy-paste into academic papers
- **`src/eval/paper.js`** — formats paper-ready markdown + LaTeX tables; zero dependencies
- **`test/integration/paper.test.js`** — 8 tests: `--report --paper` creates the report file, report contains all required sections, LaTeX table block present and syntactically valid, `--benchmark --repo <missing>` fails gracefully

### Go / No-go criteria
- All tests green (21 extractor + all integration suites)
- `--report --paper` generates a valid markdown file
- LaTeX table block present in report
- Overall hit@5 across all repos ≥ 0.75
- `--benchmark --repo .` completes in < 30 s on SigMap repo

---

## [2.5.0] — 2026-04-05

### Added
- **Impact analysis layer** — `src/graph/impact.js` provides dependency impact analysis: `getImpact(changedFile, graph)` → `{ changed, direct, transitive, tests, routes }`. Uses reverse dependency graph (BFS traversal) to find all files affected by a change.
- **`--impact <file>` CLI flag** — prints all files impacted by changing `<file>`, with their signatures. Supports `--impact --json` (machine-readable output) and `--impact --depth <n>` (BFS depth limit).
- **`get_impact` MCP tool** — 9th MCP tool; accepts `{ file: string, depth?: number }` and returns list of impacted files + signatures, usable live in any MCP session.
- **Dependency graph builder** — `src/graph/builder.js` enhanced: `build(files, cwd)` now returns `{ forward, reverse }` maps; reverse map powers impact analysis.
- **Impact config** — `config.impact.depth` (default: unlimited) and `config.impact.includeSigs` (default: true) added to `src/config/defaults.js`.
- **`test/integration/impact.test.js`** — 20 integration tests: direct deps, transitive deps, circular dependency handling (no infinite loop), depth limit, unknown file returns empty, JSON output shape, MCP tool contract, formatImpact output.

### Changed
- `src/mcp/server.js` version bumped to `2.5.0`.
- `src/mcp/tools.js` now includes `get_impact` tool definition (9th tool).
- `test/integration/mcp-server.test.js` updated to assert 9 tools.

### Validation gate
- 21/21 extractor unit tests passed
- 22/22 integration suites passed (0 failures, including new `impact.test.js`)
- `--impact src/graph/impact.js` returns correct transitive dependencies
- MCP `tools/list` returns 9 tools
- No infinite loops on circular dependencies

---

## [2.4.0] — 2026-04-05

### Added
- **`packages/core/`** — new `sigmap-core` package exposing a stable programmatic API: `{ extract, rank, buildSigIndex, scan, score }`. Third-party tools can now `require('sigmap')` and use all extraction/retrieval/security/health APIs without spawning a CLI process.
- **`packages/cli/`** — new `sigmap-cli` thin wrapper that exposes `{ CLI_ENTRY, run }` for programmatic CLI invocation and forward-compat with the v3.0 adapter architecture.
- **`packages/core/README.md`** — full programmatic API reference with usage examples for all five exported functions.
- **`exports` field in `package.json`** — `require('sigmap')` resolves to `packages/core/index.js`; `require('sigmap/cli')` resolves to `packages/cli/index.js`.
- **`test/integration/core-api.test.js`** — 15 integration tests covering: all exports present, `extract` for JS/TS/Python, file-path extension detection, unknown language returns `[]`, never throws on bad input, `rank` with empty map, `rank` sorted shape, `scan` clean/redact, `score` shape, `buildSigIndex` returns Map, CLI `--version` backward compat, CLI `--help` no crash.

### Changed
- `package.json` `"version"` bumped to `2.4.0`.
- `package.json` `"files"` — added `"packages/"` so `sigmap-core` and `sigmap-cli` are published with the root package.
- `gen-context.js` `VERSION` constant bumped to `2.4.0`.
- `src/mcp/server.js` `SERVER_INFO.version` bumped to `2.4.0`.

### Validation gate
- 21/21 extractor unit tests passed
- 21/21 integration suites passed (0 failures, including new `core-api.test.js`)
- `node gen-context.js --version` → `2.4.0`
- `node -e "const { extract } = require('.'); console.log(extract('function hello(){}', 'javascript').length > 0 ? 'OK' : 'FAIL')"` → `OK`
- `require('sigmap')` works from any directory

---

## [2.3.0] — 2026-04-07

### Added
- **Query-aware retrieval** — `src/retrieval/tokenizer.js` and `src/retrieval/ranker.js`: zero-dependency relevance ranker that scores every file against a free-text query by exact token, symbol, prefix, path, and recency signals.
- **`--query "<text>"` CLI flag** — ranks all context files by relevance and prints a scored table (Rank | File | Score | Sigs | Tokens) plus the top-3 signature blocks; `--query "<text>" --json` for machine-readable output; `--query "<text>" --top <n>` to limit result set.
- **`query_context` MCP tool** — 8th MCP tool; accepts `{ query: string, topK?: number }` and returns the same ranked table as the `--query` CLI flag; live within any running MCP session.
- **Retrieval config** — `config.retrieval.topK` (default 10) and `config.retrieval.recencyBoost` (default 1.5×) added to `src/config/defaults.js`.
- **`test/integration/retrieval.test.js`** — 23 integration tests covering tokenizer unit tests, ranker sorting/scoring/topK/empty-query, `formatRankTable`, `formatRankJSON`, CLI `--query` flags, and MCP `query_context`.

### Changed
- `src/mcp/server.js` version bumped to `2.3.0`.
- `test/integration/mcp-server.test.js` and `mcp-v14.test.js` updated to assert 8 tools.
- `test/integration/analyze.test.js` version assertion updated to `2.3.0`.

### Validation gate
- 21/21 extractor unit tests passed
- 20/20 integration suites passed (0 failures)
- `node gen-context.js --version` → `2.3.0`
- `node gen-context.js --query "python extractor"` → `src/extractors/python.js` in top-3
- `node gen-context.js --query "fix secret scanning" --json` → valid JSON
- MCP `tools/list` → 8 tools including `query_context`

---

## [2.2.0] — 2026-04-06

### Added
- **Diagnostics & analyze command** — `src/eval/analyzer.js`: per-file breakdown of signature count, token cost, extractor used, and test coverage status.
- **`--analyze` CLI flag** — prints a per-file table (File | Extractor | Sigs | Tokens | Covered) across all srcDirs; respects `exclude` config.
- **`--analyze --json` flag** — outputs the same breakdown as structured JSON (`{ files, totalSigs, totalTokens, slowFiles, fileCount }`).
- **`--analyze --slow` flag** — re-times each extractor and flags any file whose extraction takes >50ms in the table.
- **`--diagnose-extractors` CLI flag** — runs all 21 language extractors against `test/fixtures/` and compares output to `test/expected/`; exits non-zero if any extractor diverges, shows first diff line per failure.
- **`test/integration/analyze.test.js`** — 14 integration tests covering `analyzeFiles`, `formatAnalysisTable`, `formatAnalysisJSON`, and all four CLI flags.

### Validation gate
- 21/21 extractor tests passed
- All integration suites passed (19 suites, 19 passed, 0 failed — includes 14 new analyze tests)
- `node gen-context.js --version` → `2.2.0`
- `node gen-context.js --analyze` runs without error on SigMap repo
- `node gen-context.js --analyze --json` → valid JSON with required keys
- `node gen-context.js --diagnose-extractors` → exits 0 on SigMap repo

---

## [2.1.0] — 2026-04-05

### Added
- **Benchmark & evaluation system** — `src/eval/runner.js` and `src/eval/scorer.js`: zero-dependency retrieval quality measurement pipeline. Computes hit@5, MRR, and precision@5 against a JSONL task file.
- **`benchmarks/` directory structure** — `benchmarks/tasks/retrieval.jsonl` (20 tasks against SigMap's own codebase), `benchmarks/results/` (gitignored run output), `benchmarks/reports/` (human-readable summaries).
- **`--benchmark` CLI flag** — runs retrieval through all tasks in `benchmarks/tasks/retrieval.jsonl`, prints a markdown table (Task | Query | hit@5 | RR | Tokens) plus aggregate metrics; `--benchmark --json` for machine-readable output.
- **`--eval` CLI flag** — alias for `--benchmark`.
- **`src/eval/scorer.js`** — pure metric functions: `hitAtK(ranked, expected, k)`, `reciprocalRank(ranked, expected)`, `precisionAtK(ranked, expected, k)`, `aggregate(results)`. Never throws.
- **`src/eval/runner.js`** — task loader (`loadTasks`), sig-index builder (`buildSigIndex`), keyword ranker (`rank`, `tokenize`), and main `run(tasksFile, cwd)` entry point. Reads generated context file from disk; no in-memory state.
- **`test/integration/benchmark.test.js`** — 10 integration tests covering scorer unit tests, tokenizer, task loading, empty-file edge case, metrics shape, and `--benchmark --json` CLI output.

### Validation gate
- 21/21 extractor tests passed
- All integration suites passed (includes 10 new benchmark tests)
- `node gen-context.js --version` → `2.1.0`
- `node gen-context.js --benchmark` runs without error on SigMap repo
- `node gen-context.js --benchmark --json` → valid JSON with `metrics.hitAt5`, `metrics.mrr`, `tasks` array
- `node gen-context.js --eval --json` → same output as `--benchmark --json`

---

## [2.0.0] — 2026-04-04

### Added
- **v2 output enrichment pipeline** — compact `deps`, `todos`, `changes` sections auto-generated in context output.
- **Structural diff mode** — `--diff <base-ref>` writes a signature-level diff section comparing current signatures against a base branch.
- **Test coverage markers** — opt-in per-function `✓`/`✗` hints by scanning test directories (`testCoverage: true`).
- **Impact radius hints** — opt-in reverse dependency annotations (`impactRadius: true`).
- **New helper extractors**:
  - `src/extractors/deps.js` — Python and TS/JS dependency extraction + reverse dep map.
  - `src/extractors/todos.js` — TODO/FIXME/HACK/XXX harvesting (max 20 entries).
  - `src/extractors/coverage.js` — lightweight function/test correlation.
  - `src/extractors/prdiff.js` — signature-level base-ref diffs.
- **New config keys**: `enrichSignatures`, `depMap`, `schemaFields`, `todos`, `changes`, `changesCommits`, `testCoverage`, `testDirs`, `impactRadius`.
- `test/integration/v2plus.test.js` — 3 integration tests for todos, coverage markers, and structural diff.
- `test/integration/all.js` — unified integration runner and `test:integration:all` npm script.

### Changed
- **Enriched multi-language extractors** — return-type hints (`→ Type`) and richer signatures across C++, C#, Dart, Go, Java, JavaScript, Kotlin, PHP, Python, Ruby, Rust, Scala, Svelte, Swift, TypeScript, and Vue.
- **Python extractor** — dataclass/BaseModel field collapse, top-level docstring hints, fixed field bleed across class boundaries.
- **TypeScript extractor** — interface property types, class method return hints, compact hook return shapes for `export function useX()`, union type truncation extended to 35 chars.
- Removed stale development files: `TIMELINE.md`, `scripts/bundle.js`, `scripts/make-icon.py`, `scripts/inject-search.py`, `scripts/backfill-npm.sh`, `examples/slack-context-bot.js`, `examples/copilot-prompts.code-snippets`.

### Fixed
- Python `tryExtractBaseModelFields` no longer bleeds fields into subsequent classes.
- TypeScript interface member type previews preserve longer union strings (20 → 35 chars).
- TypeScript function-style hooks (`export function useX`) now include compact return object shapes.

### Validation gate
- 21/21 extractor tests passed
- 17/17 integration suites passed (262 individual tests)
- `node gen-context.js --report` → ~93.5% reduction


## [1.5.0] — 2026-04-04

### Added
- **VS Code extension** (`vscode-extension/`) — zero-dependency extension for VS Code / VS Code-compatible editors:
  - **Status bar item** — shows health grade (A/B/C/D) and time since last regeneration; refreshes every 60 s and immediately on file-system change to `copilot-instructions.md`.
  - **`SigMap: Regenerate Context`** command — runs `node gen-context.js` in an integrated terminal from the workspace root.
  - **`SigMap: Open Context File`** command — opens `.github/copilot-instructions.md` in the editor.
  - **Stale context notification** — warns when `copilot-instructions.md` is > 24 h old; offers one-click regeneration or "Don't show again" suppression per workspace.
  - **`contextforge.scriptPath` setting** — override the path to `gen-context.js` when it is not at the project root.
  - `onStartupFinished` activation — loads within 3 s of VS Code opening, does not block startup.
- **Docs site search** — lightweight client-side keyword search added to all 6 HTML docs pages (`index.html`, `quick-start.html`, `strategies.html`, `languages.html`, `roadmap.html`, `repomix.html`):
  - Press `/` anywhere to open the search overlay; `Escape` or click outside to close.
  - Searches all headings, paragraphs, and list items in the current page.
  - Up to 12 results shown with snippet preview; matching text highlighted in amber.
  - Click a result to scroll to the exact section with a 2-second amber outline highlight.
  - Zero external dependencies — ~60 lines of inline JS per page. Theme-aware (dark/light).
- **`.npmignore`** — excludes `test/`, `docs/`, `scripts/`, `examples/`, `.claude/`, `vscode-extension/`, `.github/workflows/` and planning docs from npm publish. Published package contains only the runtime files listed in `package.json#files`.
- **`test/integration/v1.5.test.js`** — 58 integration tests covering all v1.5 features:
  - npm package integrity (name, bin, engines, zero deps, .npmignore exclusions)
  - shebang line presence and correctness
  - extension manifest structure (commands, configuration, activation)
  - extension.js API coverage (status bar, notification, commands, scriptPath)
  - search injection verified in all 6 docs pages (overlay, input, keyboard handlers, highlights)

### Notes
- The VS Code extension requires the `vscode` peer dependency at runtime (provided by the editor). It has no npm runtime dependencies of its own.

### Validation gate
- `node gen-context.js --version` → `1.5.0` ✔  *(note: version bumped separately if desired)*
- `node test/integration/v1.5.test.js` → 58/58 pass ✔
- `node test/run.js` → 21/21 extractor tests pass ✔
- `npm pack --dry-run` → no `test/`, `docs/`, or `vscode-extension/` in artifact ✔
- All 6 docs pages: press `/` → search overlay opens; type "python" → result appears ✔

---

## [1.4.0] — 2026-04-04

### Added
- **`explain_file` MCP tool** — deep-dive tool for a single file. Given a relative path, returns three sections: `## Signatures` (from the indexed context file), `## Imports` (resolved relative dependencies from the live source file), and `## Callers` (reverse import lookup across all indexed files). Gracefully returns partial output if the file is not on disk.
- **`list_modules` MCP tool** — returns a markdown table listing all top-level module directories found in the context file, sorted by token count descending, with columns: `Module | Files | Tokens`. Helps agents pick the right `module` arg for `read_context`.
- **Strategy-aware health scorer** — `src/health/scorer.js` and `--health` display now read `gen-context.config.json` and adjust the low-reduction penalty threshold by strategy:
  - `full` (default): 60% reduction threshold — unchanged behaviour.
  - `hot-cold` / `per-module`: reduction penalty disabled — intentionally small hot outputs are not penalised.
  - `hot-cold` only: adds a `context-cold.md` freshness check (`strategyFreshnessDays`). If the cold context file is >1 day stale, up to 10 pts are deducted.
- **New `--health` output fields** — `strategy:` line always visible; `cold freshness:` line shown for `hot-cold` strategy.
- **`test/integration/mcp-v14.test.js`** — 13 integration tests covering `explain_file` and `list_modules`:
  - 7-tool count verification
  - Signature extraction from index
  - Imports and Callers sections (file on disk)
  - Graceful error for unknown path, missing arg, no context file
  - Token count and table structure in `list_modules`
  - Multi-call session combining both new tools
- **`test/integration/observability.test.js`** — 12 new unit tests for strategy-aware scorer:
  - `strategy` field in all return objects
  - No reduction penalty for `hot-cold` and `per-module`
  - Reduction penalty still applied for `full`
  - `strategyFreshnessDays` null/populated correctly
  - Grade A for a fresh, untracked project

### Fixed
- Health scorer: projects with **zero tracking history** (brand-new or never run with `--track`) are no longer penalised for "0% reduction". `tokenReductionPct` is only set when `totalRuns > 0`.

### Changed
- MCP server now exposes **7 tools** (was 5 before v1.3, 5 in v1.3). `tools/list` assertion updated in `mcp-server.test.js`.
- `gen-context.js` VERSION bumped to `1.4.0`
- MCP server `SERVER_INFO.version` bumped to `1.4.0`
- `package.json` version bumped to `1.4.0`

### Validation gate
- `node gen-context.js --version` → `1.4.0` ✔
- `echo '{"jsonrpc":"2.0","method":"tools/list","id":1}' | node gen-context.js --mcp` → 7 tools ✔
- `node test/integration/mcp-v14.test.js` → 13/13 pass ✔
- `node test/integration/observability.test.js` → 35/35 pass ✔
- `node test/integration/mcp-server.test.js` → 16/16 pass ✔
- `node test/run.js` → 21/21 extractor tests pass ✔

---



### Added
- **`--diff` CLI flag** — generates context only for files changed in the current git working tree (`git diff HEAD --name-only`). Useful in CI and pre-review workflows where you only want signatures for files you've touched.
- **`--diff --staged` variant** — restricts context to files in the git staging area only (`git diff --cached --name-only`). Ideal as a pre-commit check.
- **Smart fallback** — both `--diff` modes automatically fall back to a full `runGenerate` when: outside a git repo, no changed files, or all changed files are outside tracked `srcDirs`. No silent failures.
- **`--diff --report`** — when both flags are used together, prints a side-by-side comparison of diff-mode vs full-mode token counts and savings.
- **`watchDebounce` config key** — new key in `gen-context.config.json` (default: `300`) controls the debounce delay (ms) between file-system events and regeneration in watch mode. Configurable per project.
- **`test/integration/diff.test.js`** — 6 integration tests covering all diff-mode scenarios:
  - Diff-only output excludes unchanged files
  - `--staged` excludes unstaged modifications
  - Empty diff fallback to full generate
  - Non-git-repo fallback
  - Changed files outside srcDirs fallback
  - Multiple changed files all appear in output

### Changed
- Watch mode debounce reduced from **500 ms → 300 ms** (default). Now reads `config.watchDebounce || 300` — fully configurable.
- `gen-context.js` VERSION bumped to `1.3.0`
- MCP server version bumped to `1.3.0`
- `package.json` version bumped to `1.3.0`
- `src/config/defaults.js` — added `watchDebounce: 300` key

### Validation gate
- `node gen-context.js --version` → `1.3.0` ✔
- `node gen-context.js --diff` on a repo with changes → output contains only changed-file sigs ✔
- `node gen-context.js --diff --staged` → output contains only staged-file sigs ✔
- `node test/integration/diff.test.js` → 6/6 pass ✔
- `node test/run.js` → 21/21 extractor tests pass ✔

---

## [1.2.0] — 2026-04-02

### Added
- **`--init` now scaffolds `.contextignore`** alongside `gen-context.config.json`. Running `node gen-context.js --init` on a fresh project creates both files. `.contextignore` is pre-populated with sensible defaults (`node_modules/`, `dist/`, `build/`, `*.generated.*`, etc.). Safe to re-run — existing files are never overwritten.
- **`test/integration/strategy.test.js`** — 9 integration tests covering `per-module` and `hot-cold` strategies:
  - `per-module`: asserts one `context-<module>.md` per `srcDir`, overview file references all modules, cross-module signature isolation
  - `hot-cold`: asserts `context-cold.md` is created, primary output contains only hot files, `hotCommits` config controls the boundary
  - Both strategies: fallback behaviour when `srcDir` is missing or repo has no git history
- **`sigmap` npm binary alias** — `package.json` `bin` now exposes both `gen-context` (existing) and `sigmap` (new alias), making `npx sigmap` work ahead of full npm publish in v1.5
- **`--diff` and `--diff --staged` listed in `--help`** — help text documents the upcoming flags so tooling auto-complete picks them up

### Changed
- `package.json` version bumped to `1.1.0` (syncs with already-shipped v1.1 strategy features)
- `gen-context.js` `VERSION` constant bumped to `1.1.0`
- `src/mcp/server.js` `SERVER_INFO.version` bumped to `1.1.0`
- `--init` no longer exits early when config already exists — it still skips writing config but continues to check / write `.contextignore`
- `keywords` in `package.json` expanded: added `token-reduction`, `code-signatures`

### Validation gate
- `node gen-context.js --version` → `1.1.0` ✔
- `cat package.json | grep version` → `"version": "1.1.0"` ✔
- `node gen-context.js --init` on a fresh dir → both `gen-context.config.json` and `.contextignore` created ✔
- `node test/integration/strategy.test.js` → all 9 tests pass ✔
- `node test/run.js` → 21/21 extractor tests pass ✔

---

## [1.1.0] — 2026-04-01

### Added
- **Context strategies** — new `"strategy"` config key with three options:
  - `"full"` (default) — existing behaviour, single output file, all signatures
  - `"per-module"` — one `.github/context-<module>.md` per top-level `srcDir` plus a
    thin always-injected overview table (~100–300 tokens); ~70% fewer injected tokens
    per question with zero context loss; no MCP required
  - `"hot-cold"` — recently committed files auto-injected as usual; all other files
    written to `.github/context-cold.md` for MCP on-demand retrieval; ~90% fewer
    always-injected tokens; best with Claude Code / Cursor MCP enabled
- **`"hotCommits"`** config key — controls how many recent git commits count as "hot"
  for the `hot-cold` strategy (default: 10)
- **`docs/CONTEXT_STRATEGIES.md`** — comprehensive strategy guide: decision tree,
  four worked-scenario comparisons (fix-a-bug, cross-module question, daily dev,
  onboarding), full configuration reference, migration guide, and feature-compatibility
  matrix
- README: new "Context strategies" section with inline examples linking to full guide
- `gen-context.config.json.example`: `strategy` and `hotCommits` keys with comments

### Changed
- `gen-context.js` version remains `1.0.0`; `runGenerate` now dispatches to
  `runPerModuleStrategy` or `runHotColdStrategy` based on `config.strategy`
- `getRecentlyCommittedFiles(cwd, count)` now accepts a count parameter so
  `hotCommits` is respected
- `--help` text updated with strategy descriptions

### Validation gate
- `strategy: per-module` on arbi-platform: `3 modules, overview ~117 tokens, total ~4,058 tokens`
- `strategy: hot-cold` on arbi-platform: `79 hot files ~3,700 tokens, 1 cold ~363 tokens`
- `strategy: full` unchanged: `80 files, ~3,980 tokens, 94.9% reduction`
- All 21 checks pass post-deployment

---

## [1.0.0] — 2026-04-01

### Added
- **Self-healing CI** — `examples/self-healing-github-action.yml`: weekly cron workflow that queries the GitHub Enterprise Copilot API for acceptance rate; automatically opens a PR with regenerated context when rate drops below threshold (default 30%) or context file is stale (> 7 days); falls back to staleness check when no API token is configured
- **`scripts/ci-update.sh`** — CI helper script: `--fail-over-budget` (exits 1 if output tokens exceed budget), `--track`, `--format cache`; designed for required CI pipeline steps
- **`--suggest-tool "<task>"`** — recommends a model tier (fast / balanced / powerful) from a free-text task description using keyword matching against `src/routing/hints.js` TIERS; `--json` variant returns machine-readable `{ tier, label, models, costHint }` for IDE integrations
- **`--health`** — composite 0-100 health score derived from: context staleness (days since last regeneration), average token reduction %, and over-budget run rate; letter grade A–D; `--json` variant for dashboards and CI
- **`src/health/scorer.js`** — zero-dependency health scoring module: `score(cwd)` reads usage log + context file mtime; never throws
- Integration test: `test/integration/system.test.js` — 15 tests covering suggest-tool (all three tiers, `--json` shape, missing-description guard) and health (`--json` field presence, score range, grade values, run counters)

### Changed
- `gen-context.js` version bumped to `1.0.0`; help text expanded with `--suggest-tool`, `--health`
- `package.json` version bumped to `1.0.0`
- `src/mcp/server.js` version bumped to `1.0.0`
- README updated: v1.0 features section, new CLI reference entries, updated project structure tree

### Validation gate
- 177/177 tests pass (21 extractor + 156 integration)
- `node gen-context.js --suggest-tool "security audit" ` → tier: powerful
- `node gen-context.js --health --json` → `{ score, grade, tokenReductionPct, daysSinceRegen, ... }`
- Self-healing CI workflow validates via `node gen-context.js --health --json` in check job

---

## [0.9.0] — 2026-04-01

### Added
- **Enhanced `--report --json`** — structured JSON report now includes `version`, `timestamp`, `overBudget`, and `budgetLimit` fields alongside existing token stats; exits with code `1` when output exceeds `maxTokens` so CI pipelines can fail automatically
- **`--track` CLI flag** — appends one NDJSON record per run to `.context/usage.ndjson`; also enabled by `"tracking": true` in config
- **`src/tracking/logger.js`** — zero-dependency append-only log module; exports `logRun(entry, cwd)`, `readLog(cwd)`, and `summarize(entries)`; uses NDJSON (one JSON object per line) compatible with standard Unix tools
- **`--report --history`** — prints aggregate summary from `.context/usage.ndjson` (total runs, avg reduction %, avg tokens, over-budget count, first/last run timestamps); add `--json` for machine-readable output
- **`docs/ENTERPRISE_SETUP.md`** — comprehensive enterprise guide: GitHub Enterprise REST API acceptance rate tracking, CI token reporting with Prometheus/Grafana dashboard integration, self-hosted runner configuration, usage log analysis examples
- `tracking: false` default added to `src/config/defaults.js`
- Integration test: `test/integration/observability.test.js` — 23 tests covering `logRun`, `readLog`, `summarize`, CLI `--report --json`, `--track`, config-driven tracking, and `--report --history`

### Changed
- `gen-context.js` version bumped to `0.9.0`
- `package.json` version bumped to `0.9.0`
- `src/mcp/server.js` version bumped to `0.9.0`
- `--report` human output now includes `version` and `budget limit` lines
- README updated: `--track` / `--report --history` in CLI reference, new Observability section, updated project structure tree

### Validation gate
- 162/162 tests pass (21 extractor + 141 integration)
- `node gen-context.js --report --json` outputs JSON with `version`, `timestamp`, `overBudget`
- `node gen-context.js --track` writes `.context/usage.ndjson`
- `node gen-context.js --report --history` prints usage summary
- `node gen-context.js --report --history --json` outputs valid JSON

---

## [0.8.0] — 2026-03-31

### Added
- **`--format cache` CLI flag** — alongside the standard markdown output, writes `.github/copilot-instructions.cache.json`, a single Anthropic content block with `cache_control: { type: "ephemeral" }` ready for direct use in Anthropic API calls
- **`src/format/cache.js`** — zero-dependency formatter; exports `formatCache(content) → JSON string` (single content block) and `formatCachePayload(content, model) → JSON string` (full messages API payload with system array)
- **`format: 'default'` config key** — set `"format": "cache"` in `gen-context.config.json` to always write the cache JSON file on every run; default is `'default'` (markdown only)
- **`docs/REPOMIX_CACHE.md`** — full prompt cache strategy: two-layer design (Repomix as stable cached prefix + SigMap as dynamic segment), cost calculations (~60% reduction), API call examples, CI integration, cache warm-up strategy
- Integration test: `test/integration/cache.test.js` — 20 tests covering `formatCache()`, `formatCachePayload()`, CLI `--format cache` flag, config-driven mode, and absence of cache file when flag is not set

### Changed
- `gen-context.js` version bumped to `0.8.0`
- `package.json` version bumped to `0.8.0`
- README updated: `--format cache` entry in CLI reference, new Prompt Caching section, updated project structure tree

### Validation gate
- 139/139 tests pass (21 extractor + 118 integration)
- `node gen-context.js --format cache` writes `.github/copilot-instructions.cache.json`
- Cache JSON has `type: "text"` and `cache_control: { type: "ephemeral" }`
- `node gen-context.js` without `--format cache` does NOT write cache file

---

## [0.7.0] — 2026-03-31

### Added
- **Model routing hints** — classifies every indexed file into `fast`, `balanced`, or `powerful` tier based on path conventions and signature count, then appends a `## Model routing hints` section to the context output
- **`--routing` CLI flag** — `node gen-context.js --routing` appends routing hints in one pass; set `"routing": true` in config to always include them
- **`src/routing/classifier.js`** — zero-dependency heuristic classifier (path patterns, sig count, indented method count)
- **`src/routing/hints.js`** — tier definitions (`TIERS`) and `formatRoutingSection()` formatter
- **`get_routing` MCP tool** (5th tool) — returns routing hints for the current project on demand; reads context file, classifies files, returns formatted markdown
- **`docs/MODEL_ROUTING.md`** — full routing guide: tier criteria, task-to-tier decision flow, VS Code / Claude Code / CI integration, cost calculation reference
- Integration test: `test/integration/routing.test.js` — 25 tests covering classifier unit tests, classifyAll grouping, formatRoutingSection, CLI flag, config flag, and MCP tool
- `routing: false` default added to `src/config/defaults.js`
- `src/mcp/server.js` version bumped to `0.7.0`

### Changed
- `tools/list` now returns 5 tools (previously 4) — adds `get_routing`

### Validation gate
- 119/119 tests pass (21 extractor + 98 integration)
- `node gen-context.js --routing` produces `## Model routing hints` in output
- `tools/list` returns 5 tools including `get_routing`
- `get_routing` MCP call returns tier classification for current project

---

## [0.6.0] — 2026-03-31

### Added
- **`create_checkpoint` MCP tool** — returns a markdown session snapshot: active branch, last 5 commits, context token count, modules indexed, and route table summary (when `PROJECT_MAP.md` is present)
- **`examples/copilot-prompts.code-snippets`** — 20 VS Code code snippets with `cf-` prefix covering the full session lifecycle (`cf-start`, `cf-checkpoint`, `cf-end`, `cf-pr`, `cf-debug`, `cf-test`, `cf-search`, `cf-map-*`, and more)
- **`examples/slack-context-bot.js`** — zero-dependency Node.js script that posts daily context-freshness reminders to a Slack channel via an Incoming Webhook URL; includes branch, recent commit, token count, and a session checklist
- **`docs/SESSION_DISCIPLINE.md`** — complete session discipline guide: session lifecycle, 30-minute checkpoint cadence, token hygiene table, multi-session workflow, git hook integration, MCP tool reference, and VS Code snippet install instructions
- `src/mcp/server.js` version bumped to `0.6.0`
- Integration tests: 5 new tests for `create_checkpoint` in `test/integration/mcp-server.test.js`

### Changed
- `tools/list` now returns 4 tools (previously 3) — `read_context`, `search_signatures`, `get_map`, `create_checkpoint`

### Validation gate
- 94/94 tests pass (21 extractor + 73 integration)
- `create_checkpoint` MCP tool returns JSON with `# SigMap Checkpoint` header
- `create_checkpoint` with `note` param includes note in output
- `tools/list` returns 4 tools including `create_checkpoint`
- VS Code snippets file has JSON-valid syntax; `cf-` prefix on all 20 snippets

---

## [0.5.0] — 2026-03-31

### Added
- `--monorepo` CLI flag — auto-detects packages under `packages/`, `apps/`, `services/`, `libs/` and writes one `CLAUDE.md` per package
- Manifest detection covers `package.json`, `Cargo.toml`, `go.mod`, `pyproject.toml`, `pom.xml`, `build.gradle`
- `config.monorepo: true` triggers monorepo mode without the CLI flag
- **Git-diff priority output ordering** — recently committed files now appear first in the generated output (not just protected from token-budget drops)
- `examples/github-action.yml` — ready-to-use 4-job CI workflow: SigMap, gen-project-map, Repomix, test suite (Node 18/20/22 matrix)
- `docs/CI_GUIDE.md` — full CI setup guide, monorepo config, `.contextignore` patterns, token report in CI
- Integration test: `test/integration/monorepo.test.js` — 8 tests (packages/, apps/, services/, multi-manifest, 5-package smoke)
- Integration test: `test/integration/contextignore.test.js` — 7 tests (patterns, wildcards, comments, union of both ignore files)

### Validation gate
- 89/89 tests pass (21 extractor + 68 integration)
- `node gen-context.js --monorepo` writes `CLAUDE.md` per detected package
- `node gen-context.js --report` confirms git-diff files appear first in output

---

## [0.4.0] — 2026-03-31

### Added
- `gen-project-map.js` — standalone zero-dependency CLI; generates `PROJECT_MAP.md`
- `src/map/import-graph.js` — static import/require analysis for JS, TS, Python; DFS cycle detection with `⚠` warnings
- `src/map/class-hierarchy.js` — extracts `extends`/`implements` relationships across TypeScript, JavaScript, Python, Java, Kotlin, C#
- `src/map/route-table.js` — HTTP route extraction for Express, Fastify, NestJS, Flask, FastAPI, Go (Gin/stdlib), Spring
- Output: `PROJECT_MAP.md` with `### Import graph`, `### Class hierarchy`, `### Route table` sections (MCP-compatible headers)
- `gen-project-map.js --version` and `--help` flags
- Integration test: `test/integration/project-map.test.js` — 12 tests covering all frameworks, circular detection, MCP section extraction
- `package.json` updated to `v0.4.0`; `gen-project-map` added to `bin`

### Validation gate
- 74/74 tests pass (21 extractor + 53 integration)
- `node gen-project-map.js` writes `PROJECT_MAP.md` with all three sections
- MCP `get_map` tool correctly extracts each section by `### ` header

---

## [0.3.0] — 2026-03-31

### Added
- `src/mcp/server.js` — stdio JSON-RPC 2.0 MCP server (zero npm dependencies); handles `initialize`, `tools/list`, `tools/call`
- `src/mcp/tools.js` — 3 tool definitions: `read_context`, `search_signatures`, `get_map`
- `src/mcp/handlers.js` — tool implementations; reads context files from disk on every call (no in-memory state)
- `--mcp` CLI flag — starts MCP server on stdio
- MCP auto-registration in `.claude/settings.json` and `.cursor/mcp.json` via `--setup`
- `examples/claude-code-settings.json` — pre-configured entry for both SigMap and Repomix MCP servers
- `docs/MCP_SETUP.md` — full MCP setup guide with both Claude Code and Cursor examples
- Integration test: `test/integration/mcp-server.test.js` — 11 tests

### Tools
| Tool | Input | Output |
|------|-------|--------|
| `read_context` | `{ module?: string }` | All signatures or module-scoped subset |
| `search_signatures` | `{ query: string }` | Matching signatures with file paths |
| `get_map` | `{ type: "imports" \| "classes" \| "routes" }` | Section from `PROJECT_MAP.md` |

### Validation gate
- 62/62 tests pass (21 extractor + 41 integration)
- `echo '{"jsonrpc":"2.0","method":"tools/list","id":1}' | node gen-context.js --mcp` returns 3 tools

---

## [0.2.0] — 2026-03-31

### Added
- `src/security/patterns.js` — 10 secret detection patterns (AWS, GCP, GitHub, JWT, DB URLs, SSH, Stripe, Twilio, generic key=value)
- `src/security/scanner.js` — `scan(sigs, filePath) → { safe, redacted }`; never throws; redacts per-file only
- `src/config/loader.js` — reads and deep-merges `gen-context.config.json` with defaults; warns on unknown keys
- `src/config/defaults.js` — all config keys documented with defaults
- Token budget drop order: generated → test → config → least-recently-changed
- Multi-agent output targets: `copilot`, `claude`, `cursor`, `windsurf`
- `CLAUDE.md` append strategy — appends below `## Auto-generated signatures` marker; never overwrites human content above
- `docs/REPOMIX_INTEGRATION.md` — companion tool integration guide
- Integration tests: `secret-scan.test.js` (12), `config-loader.test.js` (6), `token-budget.test.js` (5), `multi-output.test.js` (7)

### Validation gate
- 51/51 tests pass (21 extractor + 30 integration)
- Secret in fixture → `[REDACTED — AWS Access Key detected]` in output
- Output ≤ 6000 tokens on any project over 200 files

---

## [0.1.0] — 2026-03-31

### Added
- `gen-context.js` — single-file zero-dependency CLI entry point
- 21 language extractors: TypeScript, JavaScript, Python, Java, Kotlin, Go, Rust, C#, C/C++, Ruby, PHP, Swift, Dart, Scala, Vue, Svelte, HTML, CSS/SCSS, YAML, Shell, Dockerfile
- CLI flags: `--generate`, `--watch`, `--setup`, `--report`, `--report --json`, `--init`, `--help`, `--version`
- `.contextignore` support (gitignore syntax), also reads `.repomixignore`
- `fs.watch` auto-update with 500ms debounce
- `post-commit` git hook installer via `--setup`
- Token budget enforcement with priority drop order
- `test/run.js` zero-dependency test runner
- 21 fixture files and expected outputs
- `gen-context.config.json.example` and `.contextignore.example`

### Validation gate
- 21/21 extractor tests pass
- Runs on a Node 18 machine with zero npm install
- Output written to `.github/copilot-instructions.md`
