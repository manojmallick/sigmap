---
title: Roadmap
description: SigMap version history and roadmap. From v0.0 to v6.0, with the latest milestone adding graph-boosted retrieval, incremental signature cache, and corrected benchmark numbers.
head:
  - - meta
    - property: og:title
      content: "SigMap Roadmap — version history and upcoming features"
  - - meta
    - property: og:description
      content: "29 versions shipped. See what changed in each release and what is coming next."
  - - meta
    - property: og:url
      content: "https://manojmallick.github.io/sigmap/guide/roadmap"
  - - meta
    - property: og:type
      content: article
  - - meta
    - name: keywords
      content: "sigmap roadmap, sigmap changelog, sigmap versions, sigmap release notes"
---
# Roadmap

Thirty-plus versions shipped. MIT open source from day one.

**Stats:** 96.9% overall token reduction · 683 tests passing · 29 languages · 0 npm deps

## Token reduction by version

| Version | Tokens / session | Notes |
|---------|-----------------|-------|
| v0.0 | 80,000 | Repomix baseline — starting point |
| v0.1 | 4,000 | First 95% reduction |
| v0.2 | 3,000 | Smarter filtering |
| v0.3 | 200–2,000 | Pull only what the task needs (MCP) |
| v0.6 | −40% per conversation | Session discipline |
| v0.8 | −60% API cost | Prompt cache breakpoints |
| v1.0 | 97% total | Full system — 80,000 → under 4,000 |
| v1.1 | ~200 always-on | hot-cold + MCP: 99.75% reduction from baseline |
| v1.3 | 50 diff-mode | Active PR work: 95%+ reduction for diffs |

## Complete version timeline

### v0.0 — Repomix baseline

Measure the problem. Install Repomix, create `.repomixignore`, measure token consumption before any optimisation. This is the number we spend every version beating.

**Tags:** `repomix --compress` · `.repomixignore` · token baseline

**Starting point: ~80,000 tokens per session**

---

### v0.1 — Core extractor ✓

The first version that matters. A single file — `gen-context.js` — with all 21 language extractors inline. Zero npm dependencies. Runs on any machine with Node.js 18+. Writes `.github/copilot-instructions.md`. Installs a post-commit git hook via `--setup`.

**Tags:** `gen-context.js` · `21 extractors` · `--setup hook` · `--watch` · `zero deps`

**Impact: 80,000 → 4,000 tokens — first 95% reduction**

---

### v0.2 — Enterprise hardening ✓

Secret scanning blocks AWS keys, GitHub tokens, database connection strings, and 10 other credential patterns from ever appearing in the output. The `.contextignore` file (gitignore syntax) lets teams exclude generated code, test fixtures, and vendor directories. Token budget enforcement with a defined drop order.

**Tags:** `secret scan (10 patterns)` · `.contextignore` · `token budget` · `drop order` · `config file`

**Impact: 4,000 → 3,000 tokens — smarter filtering**

---

### v0.3 — MCP server ✓

A JSON-RPC stdio server implementing the Model Context Protocol. Three tools: `read_context`, `search_signatures`, `get_map`. The MCP server reads files on every call — no stale state, no restart needed.

**Tags:** `stdio JSON-RPC` · `read_context` · `search_signatures` · `get_map` · `--mcp flag`

**Impact: 200–2,000 tokens — pull only what the task needs**

---

### v0.4 — Project map ✓

`gen-project-map.js` produces `PROJECT_MAP.md` with three structural views: an import graph showing every file dependency, a class hierarchy showing extends/implements relationships, and a route table extracting HTTP routes from Express, FastAPI, Rails, and similar frameworks.

**Tags:** `import graph` · `class hierarchy` · `route table` · `cycle detection` · `gen-project-map.js`

---

### v0.5 — Monorepo + CI ✓

Monorepo mode generates a separate context file per package. The GitHub Action runs on every push and PR, fails CI if token budget is exceeded, and posts a reduction report as a PR comment.

**Tags:** `monorepo mode` · `GitHub Action` · `PR comments` · `CI budget gate` · `per-package output`

---

### v0.6 — Session discipline ✓

A session compression guide (`SESSION_DISCIPLINE.md`) codifies how agents should summarise conversations, checkpoint progress, and restart from a minimal state. The `--track` flag logs every run to `.sigmap/runs.jsonl`. Reduces per-conversation token cost by 40%.

**Tags:** `SESSION_DISCIPLINE.md` · `conversation checkpoints` · `--track flag` · `runs.jsonl`

**Impact: −40% tokens per conversation**

---

### v0.7 — Model routing ✓

A file complexity scorer classifies every file as `fast` (simple CRUD, 0.33× cost), `balanced` (business logic, 1× cost), or `powerful` (architecture decisions, 3× cost). The routing table is appended to the context file. Agents use the fast-tier model for 70% of tasks.

**Tags:** `complexity scorer` · `3-tier routing` · `haiku / sonnet / opus` · `MODEL_ROUTING.md` · `--routing flag`

**Impact: Up to 70% reduction in model API cost**

---

### v0.8 — Prompt cache ✓

The `--format cache` flag wraps context in Anthropic's `cache_control` breakpoints. The stable codebase signatures become a cached prefix — computed once and reused across every request in a session.

**Tags:** `cache_control breakpoints` · `--format cache` · `stable prefix` · `Anthropic API`

**Impact: −60% API cost on repeated context loads**

---

### v0.9 — Observability ✓

`--report --json` emits machine-readable token reduction JSON for CI dashboards. `ENTERPRISE_SETUP.md` consolidates all enterprise configuration. 23 new integration tests bring total coverage to 177 passing tests.

**Tags:** `--report --json` · `--track` · `ENTERPRISE_SETUP.md` · `23 new tests` · `CI dashboard`

---

### v1.0 — Full system ✓ (tagged v1.0.0)

The complete SigMap system. Self-healing CI auto-regenerates the context file when it drifts. The `--health` flag gives a composite 0–100 score. The `--suggest-tool` flag classifies any task description into fast / balanced / powerful model tiers. All 177 tests pass.

**Tags:** `self-healing CI` · `--health` · `--suggest-tool` · `177 tests` · `MIT v1.0.0`

**Impact: 97% total token reduction — 80,000 → under 4,000**

---

### v1.1 — Context strategies ✓ (tagged v1.1.0)

Three output strategies: **full** (one file, all signatures), **per-module** (~70% fewer injected tokens), **hot-cold** (~90% fewer always-on tokens when using Claude Code or Cursor with MCP).

**Tags:** `strategy: full` · `strategy: per-module` · `strategy: hot-cold` · `hotCommits config`

**Impact: hot-cold + MCP: ~200 tokens always-on — 99.75% reduction from baseline**

---

### v1.2 — npm alias + test hardening ✓ (tagged v1.2.0)

Added `sigmap` npm binary alias so `npx sigmap` works from any machine. Improved `--init` to scaffold both config files in one step. 9 new integration tests.

**Tags:** `npx sigmap` · `--init .contextignore` · `strategy tests`

---

### v1.3 — --diff flag + watch debounce ✓ (tagged v1.3.0)

`--diff` generates context only for files changed in the current git working tree. `--diff --staged` restricts to staged files only. `watchDebounce` is now configurable.

**Tags:** `--diff` · `--diff --staged` · `watchDebounce config`

**Impact: Active PR work: ~50–200 tokens instead of ~4,000**

---

### v1.4 — MCP tools + strategy health ✓ (tagged v1.4.0)

Two new MCP tools: `explain_file` and `list_modules`. MCP server now exposes 7 tools total. Strategy-aware health scorer no longer penalises hot-cold or per-module runs.

**Tags:** `explain_file` · `list_modules` · `7 MCP tools` · `strategy health` · `25 new tests`

---

### v1.5 — VS Code extension + npm publish ✓ (tagged v1.5.0)

VS Code extension shows a status bar item with health grade and time since last regeneration. Warns when context is stale (>24 h). Adds Regenerate Context and Open Context File commands.

**Tags:** `VS Code extension` · `status bar` · `stale notification` · `docs search` · `58 new tests`

---

### v2.0 — v2 pipeline ✓ (tagged v2.0.0)

Major pipeline overhaul adds four new context sections: **TODOs** (inline TODO/FIXME/HACK extraction), **Recent changes** (git log summary), **Coverage gaps** (files lacking tests), **PR diff context** (changed-file signatures). 262 tests passing.

**Tags:** `v2 pipeline` · `TODOs` · `coverage gaps` · `PR diff context` · `dependency extractors` · `262 tests`

---

### v2.1 — Benchmark & evaluation system ✓ (tagged v2.1.0)

Zero-dependency evaluation pipeline: hit@5, MRR, and precision@5 metrics against a JSONL task file. `--benchmark` CLI flag runs retrieval tasks and prints a scored results table.

**Tags:** `--benchmark` · `hit@5 / MRR` · `JSONL tasks` · `src/eval/`

---

### v2.2 — Diagnostics & per-file analysis ✓ (tagged v2.2.0)

`--analyze` prints a per-file breakdown of signatures, tokens, extractor language, and test coverage status. `--diagnose-extractors` self-tests all 21 extractors against their fixture files.

**Tags:** `--analyze` · `--diagnose-extractors` · `per-file breakdown` · `extractor self-test`

---

### v2.3 — Query-aware retrieval ✓ (tagged v2.3.0)

Zero-dependency TF-IDF retrieval ranks all files by relevance to a free-text query. `--query "<text>"` prints a scored file table. New 8th MCP tool `query_context`. 325 tests passing.

**Tags:** `--query` · `query_context MCP` · `TF-IDF` · `8 MCP tools` · `325 tests`

---

### v2.4 — packages/core — programmatic API ✓ (tagged v2.4.0)

`packages/core/index.js` (`sigmap-core`) exposes a stable programmatic API: `extract`, `rank`, `buildSigIndex`, `scan`, `score`. Third-party tools can now `require('sigmap')` without spawning a CLI process. 340 tests passing.

**Tags:** `packages/core` · `packages/cli` · `require('sigmap')` · `programmatic API` · `340 tests`

---

### v2.5 — Impact layer ✓

`--impact <file>` traces every file that transitively imports the given file — giving agents instant blast-radius awareness. `src/map/dep-graph.js` builds the reverse index. New `get_impact` MCP tool (9th tool).

**Tags:** `dep-graph` · `--impact` · `get_impact MCP` · `blast radius` · `BFS traversal`

---

### v2.6 — Research Mode ✓

Generate publishable evaluation results. Run against real open-source repos (express, flask, gin, spring-petclinic, rails). `--report --paper` generates markdown + LaTeX tables ready for academic papers.

**Tags:** `benchmarks` · `--benchmark --repo` · `--report --paper` · `LaTeX export` · `50 eval tasks`

---

### v2.7 — Ranking Optimization ✓

Fine-tuned ranking algorithm weights. Configurable weight presets (`precision`, `balanced`, `recall`). `--query` completes in <100ms on 1000-file repos.

**Tags:** `ranking weights` · `weight presets` · `precision` · `recall`

---

### v3.x — Multi-adapter platform ✓ (v3.0 – v3.6)

The multi-adapter architecture (Copilot, Claude, Cursor, Windsurf, OpenAI, Gemini), reporting charts, advanced health metrics, VS Code + JetBrains plugins with real-time status bars, Phase C/D intelligence extractors (TypeScript React, Vue SFC, Python dataclasses), and the LLM-full write mode.

**Tags:** `adapters` · `VS Code extension` · `JetBrains plugin` · `Phase C/D extractors` · `llm-full mode`

---

### v4.0 — Intelligence Layer ✓ (tagged v4.0.0 — 2026-04-15)

Every run now tells you _how good_ your context is, not just that it ran.

- **Coverage score**: fraction of source files that survived the token budget. Grade A–D per srcDir with per-module ASCII heatmap in `--report`.
- **Confidence indicators**: every generated file carries metadata such as `version`, `confidence`, `coverage`, and `commit` so you can inspect freshness at a glance.
- **`--diff` risk score**: LOW / MEDIUM / HIGH per changed file based on reverse-dependency BFS, public exports, route status, and config-file status.
- **Coverage in `--health` and `--health --json`**: coverage grade and source-file counts included in both text and JSON output.
- **Extractor quality scoring**: token-budget drop order now uses `signalQuality = sigs / linesOfCode` — least-informative files are dropped first.

**Benchmark:** 97.6% token reduction average across 18 repos.

---

### v4.1 — Smart budget + output flag ✓ (tagged v4.1.2 — 2026-04-16)

Auto-scaled token budget: SigMap now picks an appropriate `maxTokens` ceiling based on detected context window size, eliminating the need for manual tuning on most projects. The `--output <file>` flag writes context to any custom path and persists it to config so subsequent `--query` runs find it automatically.

**Tags:** `auto-budget` · `--output flag` · `customOutput config` · `--query auto-discovery`

---

### v4.2 — Unified ask pipeline ✓ (tagged v4.2.0 — 2026-04-16)

A single `sigmap ask "<query>"` command replaces the manual intent→rank→generate flow. Intent detection (`detectIntent`) classifies queries as `debug`, `explain`, `refactor`, `review`, or `search` and tunes ranking weights for each. New commands: `suggest-profile` (reads git state), `compare` (benchmark CLI), `share` (shareable stats), `--cost` (per-model cost table).

**Tags:** `sigmap ask` · `detectIntent` · `suggest-profile` · `compare` · `share` · `--cost flag`

---

### v4.3 — CI gate + validate ✓ (tagged v4.3.0 — 2026-04-16)

`sigmap validate` checks config and measures coverage (sig-index size / source file count), warns below 70%, and optionally verifies that query symbols appear in ranked context. `sigmap --ci [--min-coverage N]` is a GitHub Actions exit gate ready for `npx sigmap --ci`. `sigmap ask` now warns on stderr when coverage drops below 70%.

**Tags:** `sigmap validate` · `--ci gate` · `extractQuerySymbols` · `coverage warning`

---

### v5.0 — Judge engine + config extends + history ✓ (tagged v5.0.0 — 2026-04-16)

Three new capabilities that close the feedback loop between context generation and LLM output quality.

- **`sigmap judge`**: rule-based groundedness scorer (`src/judge/judge-engine.js`). Computes a 0–1 token-overlap score between any LLM response and its source context. Exits 0 on `pass`, 1 on `fail`. Works with `--json` and `--threshold` overrides. Zero dependencies, no LLM API key required.
- **Config `extends`**: `gen-context.config.json` now supports an `"extends"` key pointing to a local JSON file or HTTPS URL. Base configs are deep-merged (DEFAULTS → base → local). HTTPS responses are cached for 1 hour in `.context/config-cache/` — teams can share a common base and override locally.
- **`sigmap history`**: reads `.context/usage.ndjson` and renders the last N runs as a table with a Unicode sparkline (▁▂▃▄▅▆▇█) for token trend. `--json` returns the raw array for dashboards.

**Tags:** `sigmap judge` · `groundedness scoring` · `config extends` · `HTTPS base config` · `sigmap history` · `sparkline`

**Impact:** 199 tests passing · 12 new tests for v5.0 features

---

### v5.1 — Benchmark history + sparkline trends ✓ (tagged v5.1.0 — 2026-04-16)

Benchmark runs now leave a permanent record that feeds back into the UI. All three benchmark scripts append a structured NDJSON entry to `.context/benchmark-history.ndjson` on every run. `sigmap history` reads that file and prints a `hit@5` sparkline row and a token-reduction sparkline row below the usage table — visible even when the usage log is empty. The dashboard `readBenchmarkTrend` function now prefers the local history file over the CI-only `benchmarks/results/` directory, so the hit@5 trend chart works for every developer after running any benchmark locally.

**Tags:** `benchmark-history.ndjson` · `sigmap history trends` · `hit@5 sparkline` · `dashboard readBenchmarkTrend` · `run-retrieval-benchmark` · `run-benchmark` · `run-task-benchmark`

**Impact:** benchmark trends now persist locally and feed both CLI and dashboard views

---

### v5.3 — MCP ecosystem completeness ✓ (tagged v5.3.0 — 2026-04-17)

`sigmap --setup` previously only auto-wired MCP for Claude Code and Cursor. v5.3 closes that gap so all four major AI editors are covered with a single command.

- **Windsurf** — writes `mcpServers.sigmap` to `.windsurf/mcp.json` (project-level) and `~/.codeium/windsurf/mcp_config.json` (global).
- **Zed** — writes `context_servers.sigmap` to `~/.config/zed/settings.json` using Zed's distinct `command.path`/`command.args` shape.
- **Idempotent** — each target is skipped when the file does not exist; existing `sigmap` entries are never overwritten.
- **Updated snippets** — `--setup` now prints manual config blocks for all four tools so other editors can be wired by hand.

**Tags:** `--setup` · Windsurf MCP · Zed context_servers · `registerMcp()`

**Impact:** MCP auto-wire coverage: 2 editors → 4 editors

---

### v5.4 — Neovim plugin (sigmap.nvim) ✓ (tagged v5.4.0 — 2026-04-17)

First-class Neovim integration for the #1 most-admired editor (Stack Overflow 2025, 83% admiration). The plugin lives in `neovim-plugin/` and ships as a self-contained Lua package requiring zero configuration for most setups.

- **`:SigMap [args]`** — regenerate the AI context file asynchronously via `vim.fn.jobstart`; notifies with `vim.notify` on completion.
- **`:SigMapQuery <text>`** — runs `sigmap query` and displays ranked results in a centered floating window with rounded borders; close with `q` or `<Esc>`.
- **Auto-run on save** — `setup({ auto_run = true })` creates a `BufWritePost` autocmd for `.js`, `.ts`, `.py`, `.go`, `.rs`, `.java`, `.rb`, and `.lua`.
- **Statusline widget** — `require('sigmap').statusline()` returns `sm:✓` when the context file is < 24 h old and `sm:⚠ Nh` otherwise; integrates with lualine and any custom statusline.
- **`:checkhealth sigmap`** — validates Node 18+, binary presence (global → `npx` → local `gen-context.js`), and context file freshness.
- **`release-neovim.yml`** — new GitHub Actions workflow; tag `neovim-v*` to validate Lua, run the full integration suite across Node 18/20/22, package a `.tar.gz`, and publish a GitHub Release.

**Tags:** `sigmap.nvim` · `:SigMap` · `:SigMapQuery` · `auto_run` · `M.statusline()` · `:checkhealth sigmap` · `release-neovim.yml`

**Impact:** 30 new integration tests · Neovim joins VS Code, JetBrains, Claude Code, Cursor, Windsurf, and Zed as a fully supported editor

---

### v5.5 — Coverage clarity + report UX ✓ (tagged v5.5.0 — 2026-04-17)

Coverage metrics now tell the truth. Before v5.5, `--report` could show a D grade (39%) on a project whose code was 100% covered — because json, md, and config files were counted in the denominator. `--health` always showed A (100%) using a different measurement. Both outputs shared the label `source files`, making the divergence impossible to diagnose.

- **Bug fix (denominator)**: `coverageScore()` now counts only code files (`.ts`, `.js`, `.py`, `.go`, and 25 other extensions) in the denominator. Non-code files are counted separately as `nonCodeSkipped` and shown in `--report` as `(N non-code files skipped — json, md, config)`.
- **`--report` label**: changed from `source files included` → `code files included` to match what is actually measured.
- **`--health` label**: changed from `coverage … source files` → `file access … files accessible in srcDirs` to make clear that health always checks filesystem access, not budget coverage.
- **Actionable tip**: when any module scores below 50%, `--report` now prints the three most common causes (token budget too low, srcDir misconfiguration, wrong strategy) with the exact config keys to fix.
- **`autoMaxTokens` transparency**: `--report` now emits a warning on stderr when the auto-budget override silently replaced a user-configured `maxTokens` value, with the exact config key to opt out.

**Tags:** `coverageScore` · `CODE_EXTS` · `nonCodeSkipped` · `--report` · `--health` · `autoMaxTokens warning`

**Impact:** 10 new tests · coverage grade now reflects only code files — eliminates false D grades on documentation-heavy projects

---

### v5.2 — Learning engine + workflow-first docs ✓ (tagged v5.2.0 — 2026-04-16)

This release turns SigMap into a stronger daily workflow product, not just a signature generator.

- **`sigmap learn`** adds safe local-only ranking feedback for good and bad files.
- **`sigmap weights`** makes the learned multipliers visible and resettable.
- **`sigmap judge --learn`** can apply opt-in confidence-gated updates based on groundedness.
- **HTML benchmark report** consolidates token, retrieval, quality, and task metrics into one self-contained page.
- **Workflow-first docs** elevate `ask`, `validate`, `judge`, and learning as first-class product surfaces.

**Tags:** `sigmap learn` · `sigmap weights` · `judge --learn` · `.context/weights.json` · `benchmark-report.html`

---

### v5.6 — Website & docs sync ✓ (tagged v5.6.0 — 2026-04-17)

All public surfaces now reflect v5.5 reality. Before this release, several guide pages still referenced `v5.2`/`v5.3`/`v5.4` workflow labels, benchmark sub-pages showed outdated "latest saved run" versions, and the homepage language count said `21` while the extractors covered 29.

- **Version labels**: `ask.md`, `compare.md`, `learning.md`, `quick-start.md`, `validate.md` — all `v5.2 workflow` references updated to `v5.5`.
- **Benchmark sub-pages**: `retrieval-benchmark.md`, `task-benchmark.md`, `quality-benchmark.md` — "latest saved run" updated to `v5.5.0` (was `v5.3.0`/`v5.4.0`).
- **Canonical metrics**: `generalization.md`, `cli.md` — `78.9%` → `80.0%` hit@5, `1.69` → `1.68` prompts per task.
- **Judge vocabulary**: `judge.md`, `cli.md` — removed `pass/fail`/`"verdict"`; standardised to `Groundedness` / `Support level` / `Unsupported symbols`.
- **Language count**: `docs/index.html` heading, list item, and structured-data description — `21 languages` → `29 languages and formats`; `softwareVersion` `2.8.0` → `5.5.0`.
- **MCP tool count**: `mcp.md` — `8 tools` → `9 tools` throughout.
- **Troubleshooting Issue 16**: new entry explaining the `--report` vs `--health` coverage-grade inconsistency and the v5.5 fix with a before/after comparison table.

**Tags:** `docs-sync` · `canonical-metrics` · `judge-vocabulary` · `29-languages` · `9-mcp-tools`

**Impact:** 17 new doc-sync tests — every acceptance criterion machine-verified on each CI run

---

### v5.7 — Growth & positioning ✓ (tagged v5.7.0 — 2026-04-17)

v5.7 adds `version.json` as the single canonical source of truth for version, benchmark date, language count, MCP tool count, test count, and official benchmark metrics — eliminating the manual, error-prone sync that caused version drift across public surfaces in every prior release. All user-facing "21 languages" references across `docs/languages.html`, `docs/quick-start.html`, and `docs/repomix.html` were corrected to `29 languages and formats`. README benchmark numbers were updated to the official v5.7 snapshot (`80.0%` hit@5, `1.68` prompts per task). `docs/index.html` structured-data `softwareVersion` was bumped from `5.5.0` to `5.7.0`.

- **`version.json`** (new): machine-readable record of version, benchmark_date, languages, mcp_tools, tests, and metrics snapshot — referenced by docs and CI.
- **README benchmark table**: `78.9%` → `80.0%` hit@5; `1.69` → `1.68` prompts per task.
- **Language count**: corrected to `29 languages and formats` across all affected HTML pages (8 occurrences in `languages.html`, plus `quick-start.html` and `repomix.html`).
- **`docs/index.html`**: `softwareVersion` `5.5.0` → `5.7.0` in structured data.
- **All sub-packages**: `package.json`, `packages/core`, `packages/cli`, `vscode-extension`, `jetbrains-plugin`, `gen-context.js`, `src/mcp/server.js` — all bumped to `5.7.0` via `scripts/sync-versions.mjs`.

**Tags:** `version.json` · `canonical-metrics` · `29-languages` · `growth` · `positioning`

**Impact:** single `version.json` eliminates per-release manual sync of 7+ files; 44 integration tests pass

---

### v5.8 — Trust completion & conversion ✓ (tagged v5.8.0 — 2026-04-18)

v5.8 closes the gap between accurate internal metrics and what a new user sees when they land on the docs for the first time. The release adds five trust-building surfaces and audits every user-facing metric for staleness.

- **Canonical benchmark headers** — all five benchmark pages (`benchmark`, `retrieval-benchmark`, `task-benchmark`, `quality-benchmark`, `generalization`) now open with a `:::info` snapshot block containing the official `sigmap-v5.8-main` ID, run date (2026-04-17), and key metrics. A new user immediately sees verifiable numbers, not a wall of methodology text.
- **30-second demo strip** — `docs/index.html` homepage now includes a terminal mockup directly below the stats bar showing `ask → validate → judge` in sequence, giving new visitors an instant "what does this do?" answer.
- **User-type routing table** — `docs-vp/index.md` opens with a "Who is this for?" table that routes six user archetypes (new users, daily users, teams, MCP users, monorepo evaluators, AI evaluators) to the page that matters most for them.
- **`compare-alternatives.md`** — new guide page with side-by-side tables comparing SigMap vs embeddings/RAG, RepoMix, Copilot context, and manual curation. Uses the canonical 80.0% hit@5 figure and clearly states what SigMap does *not* replace.
- **`walkthrough.md`** — end-to-end walkthrough on the real `gin` repo (Go web framework, 107 files): generate context → ask → validate → AI answer → judge → learn, with a before/after token cost table (142 000 → 1 240 tokens; $0.71 → $0.006 per query).
- **Micro trust-leak audit** — `docs/impact-banner.svg` updated from stale `78.9%`/`1.69`/`40.6%` to canonical `80.0%`/`1.68`/`40.8%`; "hallucinates" replaced with "unsupported answers"; `docs/comparison-chart.svg` bar recalculated for 80.0%; stats bar corrected from `>21<` to `>29<` languages; `softwareVersion` in structured data updated to `5.8.0`.
- **`version.json` — `retrieval_lift` field** — `metrics.retrieval_lift: 5.9` added; `benchmark_id` updated to `sigmap-v5.8-main`.

**Tags:** `compare-alternatives` · `walkthrough` · `benchmark-headers` · `demo-strip` · `routing-table` · `retrieval_lift` · `sigmap-v5.8-main`

**Impact:** 33 new integration tests · all 5 benchmark pages machine-verified · homepage demo strip · two new guide pages in "Guides" sidebar section

---

### v5.9 — Binary polish + community benchmark submissions ✓ (tagged v5.9.0 — 2026-04-18)

v5.9 closes two practical gaps: binary distribution integrity and benchmark visibility. Every binary build now ships a paired SHA-256 checksum file, and a new `sigmap bench --submit` command makes it easy for users to share their own benchmark results with the community.

- **SHA-256 checksum generation** — `scripts/build-binary.mjs` now writes a `dist/<artifact>.sha256` file alongside every binary it produces, so users can verify a download hasn't been tampered with.
- **`scripts/verify-checksums.mjs`** — new standalone verification script. Pass a binary path (or use auto-detection for the current platform); exits `0` on match, `1` on mismatch. Safe to run in CI or post-download.
- **`sigmap bench --submit`** — new CLI command. Reads `version.json` for the canonical release metrics (`hit@5`, token reduction) and `.context/benchmark-history.ndjson` for any local run history, then formats a copyable community submission block. `--json` emits machine-readable output for scripting. Designed to feed a GitHub Discussions thread for community benchmarks.
- **Extended `verify-binary.mjs` smoke tests** — tests 6–10 now cover the full v5.x workflow: `ask`, `weights`, `history`, `bench --submit`, and `bench --submit --json`. Previously only generate, health, and report were covered.

**Tags:** `sha256` · `verify-checksums` · `bench --submit` · `community-benchmarks` · `binary-distribution` · `sigmap-v5.9-main`

**Impact:** 22 new integration tests · 517 total tests · binary artifacts now verifiable via checksum

---

### v6.0 — Graph-boosted retrieval + incremental sig cache ✓ (tagged v6.0.0 — 2026-04-19)

v6.0 ships two performance improvements: graph-boosted retrieval that propagates relevance scores across import edges, and an incremental signature cache that skips re-extraction for unchanged files.

- **Graph-boosted retrieval** (`src/retrieval/ranker.js`) — after TF-IDF scoring, any file scoring > 0 donates a `graphBoost: 0.4` bonus to its 1-hop forward-import neighbours. The dependency graph is built via `src/graph/builder.js` and passed as `opts.graph` to `rank()`. Result: **83.3% graph-boosted hit@5** (+3.3pp over the 80.0% baseline).
- **Incremental signature cache** (`src/cache/sig-cache.js`) — persists `Map<absPath, {mtime, sigs}>` to `.sigmap-cache.json`. `getChangedFiles()` compares `mtime` for O(1) change detection; `loadCache()` is version-keyed so upgrades automatically bust stale entries. Eliminates redundant AST extraction on subsequent runs.
- **MCP `query_context` upgrade** (`src/mcp/handlers.js`) — `queryContext` now builds the dependency graph internally and passes it to `rank()`, giving MCP callers graph-boosted results transparently.
- **Corrected canonical benchmark numbers** — `version.json` and all docs updated with live-verified values: 96.9% token reduction (was 98.1%), 52.2% task success (was 53.3%), 1.68 prompts/task (was 1.67), 40.8% prompt reduction (was 41.2%), 5.8× retrieval lift (was 5.9×). Prior numbers were rounding artefacts from an earlier benchmark configuration.

**Tags:** `graph-boost` · `incremental-cache` · `sig-cache` · `query_context` · `benchmark-correction` · `sigmap-v6.0-main`

**Impact:** 545 integration tests · 83.3% graph-boosted hit@5 · sub-second re-runs on large repos via cache

---

### v6.0.1–v6.0.3 — Bug fixes + weights sharing ✓ (tagged v6.0.3 — 2026-04-21)

Three patch releases closing user-reported regressions and adding two team-collaboration features.

- **v6.0.1 — TypeScript extractor guard clauses (#97)** — `extractClassMembers` now filters `if`, `for`, `while`, `switch`, `do`, `try`, `catch`, `finally`, `else` so control-flow keywords are no longer emitted as method signatures inside class bodies.
- **v6.0.1 — Codex adapter preamble (#96)** — `packages/adapters/codex.js` and its bundled `__factories` copy no longer delegate to the OpenAI adapter; output is clean `# Code signatures\n\n<context>` with no LLM system-prompt preamble.
- **v6.0.2 — Duplicate adapter headers (#104)** — `writeOutputs()` now strips the `formatOutput()` preamble via a new `stripFormatHeader()` helper before passing content to adapters, preventing double `# Code signatures` headers on every run across copilot, claude, and codex adapters.
- **v6.0.3 — `--coverage` flag** — enables test coverage annotation (✓/✗ per function) at runtime without editing config. Equivalent to `testCoverage: true` in config, applied only for the current run.
- **v6.0.3 — `sigmap weights --export [file]`** — writes learned weights JSON to a file path or stdout, making it pipe-friendly for CI seed workflows.
- **v6.0.3 — `sigmap weights --import <file> [--replace]`** — merges or fully replaces local `.context/weights.json` from a portable JSON file. Incoming values are sanitized and clamped. Enables teams to share accumulated ranking knowledge across machines.

**Tags:** `guard-clauses` · `codex-adapter` · `strip-header` · `--coverage` · `weights-export` · `weights-import` · `team-sharing`

**Impact:** 683 total tests (+138 since v6.0.0) · weights sharing unlocked for multi-developer repos

---

## Current milestone — v6.x

v6.0–v6.0.3 shipped graph-boosted retrieval, incremental signature cache, and weights sharing. Current focus: wire `sig-cache` into the main `gen-context.js` extraction pipeline so every CLI run benefits from incremental caching, benchmark the learning engine directly (measure hit@5 improvement from accumulated weights), run the full benchmark matrix against freshly cloned repos to confirm the corrected canonical numbers, and explore binary distribution via GitHub Releases download links in docs. Public metrics are kept synchronised across CLI, docs, and release surfaces via `version.json` + `scripts/sync-versions.mjs`.

---

<div style="text-align:center;margin-top:2.5rem;padding-bottom:.5rem;font-size:0.85em;color:var(--vp-c-text-3)">
  Made in Amsterdam, Netherlands <span title="Netherlands">🇳🇱</span>
</div>
