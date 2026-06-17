---
title: Roadmap
description: SigMap version history and roadmap. From v0.0 to v7.15.0, with recent releases adding the sigmap create orchestrator and its four guard stages (scaffold, verify-plan, verify-ai-output, review-pr), the conventions command with --conflicts breakdown, --inject CLAUDE.md injection, --report consistency audit, and --ci gate (grounded codegen, complete create pipeline), the grounding benchmark, read-time self-heal, live-index MCP write hooks, the get_callee_signatures MCP tool (exact callee signatures), realistic per-query savings, release-pipeline robustness (bundle integrity + version.json gates, standalone-bundle smoke test), the sigmap gain token-savings dashboard, supply-chain hardening (zero system-shell access), Squeeze input minimization with symbol enrichment, source-of-truth llms.txt, the verify-ai-output Hallucination Guard, and Memory tools (note, status, read_memory MCP tool).
head:
  - - meta
    - property: og:title
      content: "SigMap Roadmap — version history and upcoming features"
  - - meta
    - property: og:description
      content: "51 versions shipped. See what changed in each release and what is coming next."
  - - meta
    - property: og:url
      content: "https://sigmap.io/guide/roadmap"
  - - meta
    - property: og:type
      content: article
  - - meta
    - name: keywords
      content: "sigmap roadmap, sigmap changelog, sigmap versions, sigmap release notes"
---
# Roadmap

Sixty-eight versions shipped. MIT open source from day one.

**Stats:** 97.0% overall token reduction · 1,122 tests passing · 15 MCP tools · 31 languages · 17-language source resolver · 0 npm deps

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
| v6.12 | symbol-index + delta | Demand-driven `--mode index`: headers only, bodies via `get_lines`; `--since` delta = near-zero per turn |

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

### v6.1.0 — Native tool instructions in every adapter ✓ (tagged v6.1.0 — 2026-04-22)

Every adapter's `format()` now embeds native-format SigMap command guidance so agents automatically receive tool instructions in each generated context file — no manual configuration required. Instructions are styled to match each host tool: a markdown table (copilot, codex), a bullet list (claude), `#` comment lines (cursor, windsurf), and an instruction sentence (openai, gemini). This is Level 1 of the adapter-tool-wiring roadmap; Level 2 will auto-wire the four missing MCP tools.

**Tags:** `tool-instructions` · `adapter-level-1` · `copilot` · `claude` · `cursor` · `windsurf` · `openai` · `gemini` · `codex`

**Impact:** 691 total tests (+8 since v6.0.3) · all 7 adapters now surface `sigmap ask`, `sigmap validate`, and `sigmap judge` to every AI agent automatically

---

### v6.2.0 — MCP auto-wire for 4 new targets ✓ (tagged v6.2.0 — 2026-04-22)

`sigmap --setup` now registers the MCP server in 5 new config targets, bringing total `--setup` coverage from 5 to 10 editors and AI CLI tools. New targets: `.vscode/mcp.json` (GitHub Copilot in VS Code 1.99+), `opencode.json` and `~/.config/opencode/config.json` (OpenCode), `~/.gemini/settings.json` (Gemini CLI), and `~/.codex/config.yaml` (Codex CLI — YAML format with no external parser). All targets are idempotent and only written when the file already exists. This is Level 2 of the adapter tool-wiring roadmap.

**Tags:** `mcp-setup` · `vscode-copilot` · `opencode` · `gemini-cli` · `codex-cli` · `adapter-level-2`

**Impact:** 707 total tests (+16 since v6.1.0) · `--setup` now covers 10 AI tools out of the box

---

### v6.3.0 — Native tool registration ✓ (tagged v6.3.0 — 2026-04-22)

v6.3.0 closes the adapter-tool-wiring roadmap at Level 3: the two adapters with persistent config files now inject structured tool registrations directly into those files on every write, so agents gain one-click access to SigMap commands without manual configuration.

- **Codex adapter (`packages/adapters/codex.js`)** — `write()` injects a `## Tools` JSON block into `AGENTS.md` above the auto-generated signatures section. The block registers five named tools (`sigmap_ask`, `sigmap_validate`, `sigmap_judge`, `sigmap_weights`, `sigmap_history`) in the format expected by the Codex CLI and OpenCode tool picker. Injection is idempotent via `<!-- sigmap-tools -->` marker.
- **Claude adapter (`packages/adapters/claude.js`)** — `write()` injects a `## Bash allowlist` section into `CLAUDE.md` containing a `permissions.allow` JSON array with 10 `Bash(sigmap*)` patterns. Claude Code reads this block to skip confirmation prompts for all SigMap commands. Injection is idempotent via `<!-- sigmap-bash-allowlist -->` marker.
- **Bundled factory sync** — both adapter changes are mirrored into the corresponding `__factories` closures in `gen-context.js` so the zero-dependency single-file distribution stays in sync.

**Tags:** `native-tool-registration` · `agents-md` · `tools-json` · `bash-allowlist` · `claude-md` · `codex-adapter` · `adapter-level-3`

**Impact:** 722 total tests (+15 since v6.2.0) · Codex CLI and Claude Code agents gain full SigMap tool access on first `sigmap --setup`

---

### v6.4.0 — Trust sync ✓ (tagged v6.4.0 — 2026-04-23)

v6.4.0 is a docs-only release that eliminates the visible mismatch between the live site and GitHub Releases.

- **Homepage badge split** — hero pill now shows `Release: v6.4.0` and `Benchmark: sigmap-v6.4-main` as separate labels; the old conflated "Latest: v6.0" wording is gone
- **Benchmark upgrade** — all docs upgraded from v5.9-main / v6.0-main snapshots to the canonical v6.4-main snapshot (2026-04-23): 78.9% hit@5, 80.0% graph-boosted, 5.8× lift, 40.6% prompt reduction, 1.69 prompts/task
- **README overclaim fix** — "correct file selection every time" changed to "right file in context — 79% of the time"; top demo trimmed from 4 commands to 2
- **MCP native tool callout** — `docs-vp/guide/mcp.md` now documents the v6.3 native tool registration behaviour
- **Content-consistency test** — `test/content/v640-trust-sync.sh` (12 checks) guards against version/copy regressions in CI

**Tags:** `trust-sync` · `docs` · `version-labels` · `overclaim-fix` · `generalization-upgrade` · `benchmark-upgrade`

**Impact:** All benchmark docs now point to a single canonical v6.4-main snapshot; homepage no longer conflates release version with benchmark ID

---

### v6.5.0 — Source Root Resolver ✓ (tagged v6.5.0 — 2026-04-25)

Intelligent auto-detection of source directories for 17 languages and 50+ frameworks. A 6-module `src/discovery/` subsystem that combines language/framework detection, file density analysis, git activity, and manifest scanning to find the right root directories without manual config.

- **Source Root Resolver** — multi-signal scoring engine detecting Next.js, Django, Rails, Spring Boot, Flutter, Go, Rust, and 44+ other frameworks
- **`.sigmapignore` support** — exclude directories with patterns (fallback to `.contextignore`); supports simple globs like `src/**`
- **`sigmap roots` CLI** — three modes: `--explain` (show detection details), `--json` (programmatic output), `--fix` (interactive correction)
- **Monorepo detection** — auto-detects npm/yarn/pnpm/lerna/nx/turbo workspaces and enumerates all sub-packages
- **Confidence levels** — high/medium/low confidence with detailed scoring explanation for each root directory
- **Graceful fallback** — integrates into `loadConfig()` with fallback to legacy heuristics when needed

**Tags:** `source-root-resolver` · `17 languages` · `50+ frameworks` · `monorepo` · `.sigmapignore` · `confidence scoring`

**Impact:** Removes manual `srcDirs` config for most projects; monorepo setup now fully automatic. New `sigmap roots --fix` enables one-command root detection and correction.

---

### v6.5.1 — Retrieval explain ✓ (tagged v6.5.1 — 2026-04-25)

Extended retrieval ranking with transparent signal breakdown and intent-aware scoring. All `rank()` results now include a signals object showing which factors (exactToken, symbolMatch, prefixMatch, pathMatch, penalty) contributed to each file's score. Expanded intent detection from 4 to 7 patterns (debug, explain, refactor, review, test, integrate, navigate) with tuned weights per intent. Formalized negative-signal penalties to deprioritize test files (0.4x), generated code (0.3x), and documentation (0.2x).

- **Retrieval explain** — rank() and scoreFile() return detailed signal breakdown for ranking transparency
- **7-intent ranking** — expanded intent patterns with intent-specific weight adjustments
- **Negative-signal penalty layer** — formalized penalties for test files, generated code, documentation, and node_modules
- **Signals in output** — formatRankTable and formatRankJSON now include intent and signals for API consumers

**Tags:** `retrieval explain` · `signal breakdown` · `7-intent ranking` · `negative penalties` · `intent-aware scoring`

**Impact:** Ranking decisions are now fully transparent with signal breakdown. Intent-aware ranking improves relevance for different query types (debugging vs navigation vs exploration). Penalties reduce noise from test/generated code.

---

### v6.5.2 — 2-hop graph boost + hub suppression ✓ (tagged v6.5.2 — 2026-04-27)

Extended dependency-aware retrieval with 2-hop graph traversal and hub suppression. Direct imports now receive +0.40 score boost, with second-order imports receiving +0.15 boost (decay applied) for improved multi-layer dependency context. Shared utility files (detected via >20% fanout threshold or static patterns like `util/`, `helper/`, `common/`) are suppressed from graph boosts to prevent over-prioritizing generic utilities. Added incremental signature cache with mtime-based validation and version-controlled cache busting. Cache health statistics now available in `--health` output (entry count and disk size).

- **2-hop graph boost with decay** — traverses 2 hops in dependency graph (hop1: +0.40, hop2: +0.15) for better multi-layer context
- **Hub suppression** — shared utilities excluded from boosts based on >20% fanout threshold and static patterns
- **Incremental signature cache** — opt-in `sigCache` config key caches extracted signatures with mtime validation and version-based busting
- **Cache health stats** — `--health` output includes cache entry count and disk size when cache exists

**Tags:** `2-hop graph boost` · `hub suppression` · `sigCache` · `incremental cache` · `cache health stats`

**Impact:** Multi-layer dependency context improves ranking for complex dependency trees. Hub suppression reduces noise from generic utilities. Incremental cache accelerates subsequent runs by skipping unchanged files. Cache health stats enable monitoring and debugging of cache effectiveness.

---

### v6.6.0 — Session memory + plan command ✓ (tagged v6.6.0 — 2026-04-27)

Cross-session context carry-forward with topic-switch guard and change-impact analysis. New `sigmap ask --followup` flag reuses previous session context (up to 4 hours old) with +0.2 boost to top-5 files; boost reduced to +0.1 when intent differs (topic switch). New `sigmap plan "<goal>"` command analyzes change impact and returns files grouped by confidence level (inspect-first vs likely-to-change). Session state saved to `.context/session.json` with automatic 4-hour TTL expiry.

- **Session memory** — 4-hour TTL session persistence with loadSession, saveSession, mergeSessionContext, clearSession
- **ask --followup flag** — Reuse previous session's context for iterative exploration with topic-switch guard
- **plan command** — Analyze change impact and plan modifications with confidence-based file grouping and `--json` output for agent integration

**Tags:** `session memory` · `ask --followup` · `plan command` · `4-hour TTL` · `topic-switch guard` · `change impact analysis`

**Impact:** Session memory enables faster iterative exploration without re-ranking the entire codebase. Plan command helps developers understand change scope before editing.

---

### v6.6.1 — JVM project structure detection ✓ (tagged v6.6.1 — 2026-04-27)

Added out-of-the-box support for Java, Kotlin, and Scala projects through intelligent detection of JVM convention directories. `srcDirs` configuration now includes Maven/Gradle standard paths (`src/main/java`, `src/main/kotlin`, `src/main/scala`, `app/src/main/java`, `app/src/main/kotlin`) and common test locations (`src/test/java`, `src/test/kotlin`). Patch release with no benchmark changes.

**Tags:** `JVM support` · `Java detection` · `Kotlin detection` · `Scala detection` · `srcDirs` · `auto-detection`

**Impact:** Eliminates manual configuration for JVM-based projects. Developers can now run `sigmap` immediately on Spring Boot, Micronaut, Quarkus, and Kotlin codebases.

---

### v6.6.2–v6.6.5 — srcDirs validation, JVM pattern refactor & monorepo support ✓ (latest: v6.6.5 — 2026-05-03)

Comprehensive validation of srcDirs configuration with comprehensive JVM project support. v6.6.2 added 10 integration tests ensuring all source directory paths (including JVM structures) are correctly defined. v6.6.3 fixed Scala detection in app/src/main/ pattern. v6.6.4 extracted JVM path pattern as a reusable constant for improved testability. v6.6.5 enhanced monorepo support to detect `src/main/{java,kotlin,scala}` and `app/src/main/{java,kotlin,scala}` in workspace packages (packages/*, apps/*, services/*, modules/*), ensuring JVM projects in monorepo structures are properly discovered.

**Tags:** `srcDirs validation` · `JVM path detection` · `monorepo support` · `integration tests` · `configuration consistency`

**Impact:** All 58 integration tests passing. srcDirs configuration machine-verified on every CI run. JVM project detection now works seamlessly across monorepo and non-monorepo structures. Catch misconfiguration of source directories before runtime.

---

### v6.7.0 — 2-hop graph boost + hub suppression ✓ (tagged v6.7.0 — 2026-05-03)

Formalized retrieval and caching improvements into a stable release milestone. Extended dependency-aware retrieval with 2-hop graph traversal (hop1: +0.40, hop2: +0.15 with decay) for improved multi-layer dependency context. Hub suppression prevents over-boosting shared utility files (detected via >20% fanout threshold or static patterns like `util/`, `helper/`, `common/`). Incremental signature cache with mtime-based validation accelerates subsequent runs by caching extracted signatures. Cache health statistics (entry count, disk size) now visible in `--health` output for visibility into cache efficiency.

- **2-hop graph boost with decay** — traverses 2 hops in dependency graph for improved multi-layer context (vs 1-hop in v6.0)
- **Hub suppression** — shared utilities excluded from graph boosts to reduce noise from generic files
- **Incremental signature cache** — opt-in `sigCache: true` config key caches extracted signatures with mtime-based change detection
- **Cache health statistics** — `--health` output includes cache entry count and disk size for monitoring cache effectiveness

**Tags:** `2-hop graph boost` · `hub suppression` · `sigCache` · `incremental cache` · `cache health stats`

**Benchmark:** 96.8% overall token reduction · 80.0% hit@5 · 52.2% task success · 41.0% prompt reduction

**Impact:** 722 tests passing · multi-layer dependency context improves ranking for complex architectures · incremental cache reduces latency on large repos by skipping unchanged files

---

### v6.8.0 — Session memory + safe change planning ✓ (tagged v6.8.0 — 2026-05-03)

Introduced session-aware context carry-forward and impact analysis tools. Session memory stores intent, top-ranked files, and last query in `.context/session.json` with 4-hour TTL, enabling follow-up queries to boost relevant files (+0.2 same intent, +0.1 topic switch). New `sigmap plan "<goal>"` command analyzes change impact by ranking files by confidence level (inspect first vs. likely to change), computing 2-hop impact radius, and identifying affected tests. Topic-switch guard prevents fixation on outdated context.

- **Session memory (4-hour TTL)** — store intent, top files, and last query for context carry-forward
- **`sigmap ask --followup` flag** — load previous session and apply intent-aware boosting (+0.2 same, +0.1 topic-switch)
- **`sigmap plan "<goal>"` command** — analyze change impact: file ranking, impact radius, affected tests
- **Topic-switch guard** — reduce boost from +0.2 to +0.1 when intent differs, prevent fixation

**Tags:** `session memory` · `followup context` · `safe change planning` · `impact analysis` · `intent-aware retrieval`

**Benchmark:** 80.0% hit@5 · 96.8% token reduction · 52.2% task success (same as v6.7.0, features unchanged retrieval)

**Impact:** Developers carry context across queries and analyze change impact before editing. Reduces need to re-provide context on follow-up questions.

---

### v6.10.0 — Monorepo workspace-scoped retrieval ✓ (tagged v6.10.0 — 2026-05-05)

Added first-class support for monorepo architectures. New workspace detector identifies packages from `package.json` workspaces field (npm array and Yarn v2 `packages` format). Automatically infers target package from query tokens enabling context scoping to specific workspace packages. Flags `--package <name>` (explicit scope) and `--global` (disable scoping) control retrieval boundaries. Files inside inferred package receive +0.30 score boost for tighter, more focused context in large codebases with multiple semi-independent modules.

- **Workspace package detection** — Reads `package.json` workspaces field with support for npm and Yarn v2 formats
- **Automatic package inference** — Infers target package from query tokens (e.g., "rate limiting payments" → `packages/payments/`)
- **Scoped retrieval** — `--package <name>` flag for explicit scope, `--global` to disable scoping
- **In-package score boost** — +0.30 boost for files inside inferred package improves ranking relevance

**Tags:** `workspace detection` · `package inference` · `scoped retrieval` · `monorepo support` · `--package flag` · `--global flag`

**Benchmark:** 80.0% hit@5 · 96.8% token reduction (baseline unchanged, workspace scoping improves signal-to-noise for monorepo queries)

**Impact:** Enterprise developers working in monorepos get more focused context, reducing noise from unrelated workspace packages and improving answer relevance.

---

### v6.10.1 — R language support + Python AST extractor ✓ (tagged v6.10.1 — 2026-05-10)

Expanded language coverage and improved Python extraction accuracy. Added Phase 1 R language support with function definition extraction, S4 pattern recognition, multi-line argument handling, and Shiny framework detection. Introduced native Python AST fallback using `ast.parse()` for accurate extraction of complex signatures (multiline parameters, stacked decorators, complex generics) while preserving regex fallback for environments without Python 3. Included critical bug fixes for --query ReferenceError, Windows path handling, .contextignore patterns, and Claude adapter output in specialized context strategies.

- **R language extractor** — Extract function signatures from `.r` and `.R` files with S4 patterns (setGeneric, setMethod, setClass), Shiny framework detection via `app.R`/`ui.R`/`server.R` triplet
- **Python AST fallback** — Native fallback to `python_ast.py` using `ast.parse()` for accurate complex signature extraction, zero breaking changes to output format
- **Bug fixes** — ReferenceError in `--query`, Windows path normalization, bracket character classes in `.contextignore`, Claude adapter output in per-module and hot-cold strategies

**Tags:** `R extractor` · `S4 patterns` · `Shiny support` · `Python AST` · `bug fixes` · `Windows support` · `pattern fixes`

**Benchmark:** 80.0% hit@5 · 96.8% token reduction · 52.2% task success (metrics unchanged, new language coverage and improved extraction accuracy)

**Impact:** Data scientists and R developers can now use SigMap on R projects. Python developers get more accurate signature extraction for complex code patterns.

---

### v6.10.2 — Open-source agents and local LLM documentation ✓ (tagged v6.10.2 — 2026-05-11)

Comprehensive integration guides for open-source AI tools and self-hosted LLM workflows. Added two new documentation guides highlighting SigMap's model-agnostic nature: detailed integrations for open-source coding agents (OpenCode, Aider, OpenHands, Cline) and complete setup guides for local LLM inference backends (Ollama, llama.cpp, vLLM, LM Studio). Updated README to emphasize no vendor lock-in, cost-free inference with local models, and full privacy for proprietary codebases. Added "Integrations" navigation section in documentation.

- **Open-source agents guide** — Setup and integration patterns for OpenCode, Aider, OpenHands, Cline with local and cloud LLM backends
- **Local LLMs guide** — Complete self-hosted workflows for Ollama, llama.cpp, vLLM with per-backend instructions, model recommendations, performance tuning
- **Updated README** — Clarified model-agnostic support for cloud APIs, open-source agents, and fully local setups with zero token costs
- **Enhanced navigation** — New "Integrations" section in docs linking all agent/backend options

**Tags:** `open-source agents` · `local LLMs` · `Ollama support` · `llama.cpp` · `vLLM` · `documentation` · `model-agnostic`

**Benchmark:** 80.0% hit@5 · 96.8% token reduction · 52.2% task success (unchanged metrics, documentation-only release)

**Impact:** LocalLLM community can now easily use SigMap with self-hosted models. Reduces perceived vendor lock-in and clarifies cost-free inference path.

---

### v6.10.3 — Contributor attribution fixes ✓ (tagged v6.10.3 — 2026-05-11)

Fixed MCP tools import graph analysis and restored contributor attribution in GitHub contributors graph. All 6 core contributors now visible as direct authors of their respective commits via cherry-pick to main.

**Tags:** `contributor attribution` · `github graph fix` · `cherry-pick strategy`

**Benchmark:** 80.0% hit@5 · 96.8% token reduction · 52.2% task success (same metrics)

---

### v6.10.4 — MCP tools extractImports export fix ✓ (tagged v6.10.4 — 2026-05-11)

Fixed critical bug in bundled gen-context.js where `extractImports` function was not exported from the import-graph factory, causing `explain_file` (imports/callers) and `get_impact` MCP tools to fail with "extractImports is not a function" error. Added comprehensive regression tests to prevent future occurrence.

**Tags:** `MCP tools` · `bundled exports` · `regression tests` · `import graph analysis`

**Benchmark:** 80.0% hit@5 · 96.8% token reduction · 52.2% task success (same metrics)

---

### v6.10.6 — Import graph improvements + branching strategy ✓ (tagged v6.10.6 — 2026-05-11)

Fixed import graph analysis for Python monorepos (issues #181, #182): added detection of absolute Python imports (`from package.module import X`), improved edge case handling, and added `sigmap-diagnostics.js` for debugging import detection. Also established branching strategy with develop as integration branch and main as release-only. Includes 8 regression tests for MCP tools and comprehensive testing guide.

**Tags:** `import graph` · `Python absolute imports` · `diagnostics tool` · `issue #181` · `issue #182` · `develop-first branching` · `MCP tools` · `regression tests`

**Impact:** Fixes empty import graph for Python files with cross-package dependencies; enables explain_file and get_impact on large monorepos.

**Benchmark:** 80.0% hit@5 · 96.8% token reduction · 52.2% task success (same metrics)

---

### v6.10.8 — Python imports in builder.js for get_impact ✓ (tagged v6.10.8 — 2026-05-12)

Added Python absolute import detection to `src/graph/builder.js`, fixing the `get_impact` MCP tool which returns empty blast radius for Python monorepos. The fix ensures both `import-graph.js` and `builder.js` correctly detect `from package.module import X` patterns.

**Tags:** `MCP tools` · `Python imports` · `builder.js` · `get_impact` · `issue #187`

**Benchmark:** 80.0% hit@5 · 96.8% token reduction · 52.2% task success (same metrics)

---

### v6.10.7 — Bundled Python import support ✓ (tagged v6.10.7 — 2026-05-12)

Fixed Python absolute import detection in bundled gen-context.js. The source code already had support for `from package.module import X` patterns, but the bundle was missing this code block, causing MCP tools (`explain_file`, `get_impact`) to show empty import graphs for Python monorepos. Now bundled behavior matches source code exactly.

**Tags:** `bundled fix` · `Python imports` · `MCP tools` · `import graph` · `bundle parity`

**Benchmark:** 80.0% hit@5 · 96.8% token reduction · 52.2% task success (same metrics)

---

### v6.9.0 — Segmented benchmarks and methodology ✓ (tagged v6.9.0 — 2026-05-03)

Introduced benchmark transparency and answer usefulness evaluation. All 18 benchmark repositories now tagged by language, repo type (framework/library/tool/application), and size class to enable segmented analysis by project characteristics. Comprehensive methodology documentation explains benchmark design, task selection, metric definitions, and reproducibility. New answer usefulness evaluation metric tracks whether retrieved context actually enabled correct answers, scored in three tiers: fully-useful (rank 1), partially-useful (ranks 2-5), not-useful (not retrieved).

- **Task metadata for segmentation** — Language, repo type, size class for each benchmark repo enables breakdown analysis
- **Methodology documentation** — Explains test set design, metric definitions, why each metric matters, and reproducibility approach
- **Answer usefulness evaluation** — Three-tier scoring complements task success proxy with granular answer quality assessment
- **Benchmark dashboard** — Supports filtering/grouping by language, repo type, repo size for segmented analysis

**Tags:** `segmented benchmarks` · `methodology` · `answer usefulness` · `transparency` · `reproducibility`

**Benchmark:** 80.0% hit@5 · 96.8% token reduction · 52.2% task success (same metrics, improved transparency)

**Impact:** Developers can see which project types benefit most from SigMap. Methodology page enables independent reproduction and validation of results.

---

### v6.11.0 — Line anchors (Surgical Context Phase 1) ✓ (tagged v6.11.0 — 2026-06-03)

Top-level TypeScript and Python signatures now carry a `:start-end` line anchor (e.g. `export class UserRepository  :18-36`), so an AI agent can read the exact lines instead of re-opening the whole file — the first step of **Surgical Context**, the next phase of token reduction. Anchors are emitted as a string suffix, so `ask`, `CLAUDE.md`, and every adapter render them with no consumer changes. A latent block-comment/docstring strip that destroyed newlines and corrupted line numbers was fixed, so the Python AST and regex fallback paths now produce identical anchors.

**Tags:** `line anchors` · `surgical context` · `token reduction` · `typescript` · `python` · `issue #212`

**Benchmark:** 80.0% hit@5 · 96.5% token reduction · 53.3% task success (re-run on v6.11.0 — anchors are index suffixes, metrics unchanged)

---

### v6.11.1 — MCP bundled hot-cold cold signatures ✓ (tagged v6.11.1 — 2026-06-04)

Community patch from **@rudi193-cmd**: the bundled MCP server now includes the hot-cold "cold" signatures, so context lookups return complete results under the hot-cold strategy. Adds strategy integration tests.

**Tags:** `mcp` · `hot-cold` · `bundled server` · `issue #201` · `PR #216` · `community`

---

### v6.12.0 — Surgical Context Phase 2 (demand-driven + delta) ✓ (tagged v6.12.0 — 2026-06-05)

The demand-driven half of **Surgical Context**. A new **`get_lines` MCP tool** (the 10th) fetches an exact `{ file, start, end }` line range behind a `:start-end` anchor — clamped, secret-scanned, and sandboxed to the project root — so agents read just the lines they need instead of re-opening whole files. `sigmap ask --mode index` emits a two-tier symbol index (`symbol  :start-end` pointers only, no bodies), and `sigmap ask --since <ref>` restricts output to files changed since a git ref. The token budget now degrades gracefully: it collapses signature bodies to anchors before dropping whole files. The dashboard gains a **Token Reduction** panel (baseline vs ranked vs surgical), sourced from the published benchmark.

**Tags:** `surgical context` · `demand-driven` · `delta` · `get_lines` · `mcp` · `--mode index` · `--since` · `dashboard` · `issue #219` · `PR #220`

**Impact:** 10 MCP tools (was 9) · symbol-index mode cuts upfront `ask` context further on top of ranked retrieval, with no `hit@5` regression.

---

### v6.13.0 — Surgical Context Phase 2.1 (JavaScript + member anchors) ✓ (tagged v6.13.0 — 2026-06-05)

Widens line-anchor coverage so demand-driven retrieval actually pays off. The **JavaScript extractor** now emits `:start-end` anchors on top-level functions, classes, exported arrows, and `module.exports` (with a newline-preserving comment strip so line numbers stay exact below `/* … */`). **Class methods and interface members** (TypeScript and JavaScript) now carry their **own** anchor spanning the member body, unlocking method-level `get_lines` targeting. The standalone bundle's extractor factories were re-synced (stale since v6.11.0), and a latent token-budget bug — signature-only accounting that undercounted section headers + the fixed preamble and could exceed `maxTokens` — was made overhead-aware.

**Tags:** `line anchors` · `surgical context` · `javascript` · `member anchors` · `token budget` · `issue #223` · `PR #224`

**Impact:** index-mode token reduction on real repos rises from ~4.6% to **32–42%** (axios 42.1%, fastify 41.1%, svelte 36.8%, vue-core 32.4%), now 100% anchored — with no `hit@5` regression.

---

### v6.14.0 — Hallucination Guard prototype (`verify-ai-output`) ✓ (2026-06-07)

The first headline verification command. `sigmap verify-ai-output <answer.md>` scans an AI answer and flags claims that do not match the repository, composing existing primitives (file map, import resolvers, symbol index) into a deterministic, offline check — no LLM. Three detectors ship in this prototype: **fake-file** (path absent on disk), **fake-import** (relative import that does not resolve, or a bare package missing from `package.json` deps — Node/Python builtins and scoped packages allow-listed), and **fake-symbol** (a called function/class absent from the SigMap symbol index). Markdown report by default, `--json` for CI; exits `1` on any issue, `0` when clean. All external lookups are injectable so the core is unit-testable.

**Tags:** `verify-ai-output` · `hallucination guard` · `fake-file` · `fake-import` · `fake-symbol` · `deterministic` · `offline` · `issue #227` · `PR #228`

**Impact:** new command surface for trust/verification; 65 integration test files pass (13 new). Foundation for the reliable MVP (closest-match suggestions, `fake-test-file`/`fake-npm-script`, 5-repo precision proof).

---

### v6.15.0 — Hallucination Guard Reliable MVP + Memory tools ✓ (2026-06-09)

Two milestones in one release. **`verify-ai-output` Reliable MVP** (#232) grows the Hallucination Guard from three detectors to **five** — adding **fake-test-file** (a referenced `*.test`/`*.spec`/`__tests__`/`test_*.py` path absent on disk) and **fake-npm-script** (`npm run X` not in `package.json` scripts) — and adds **closest-match suggestions** (Levenshtein + file/symbol/script proximity → "Did you mean `loadConfig()` in `src/config/loader.js:42`?", labeled heuristic). The JSON schema is finalized (`{ type, value, line, location, message, confidence, suggestion }`), a standalone **HTML report** (`--report`, red/amber/green, no external assets) renders the findings, and a **proof harness** (`npm run benchmark:verify`) enforces per-detector precision targets (file ≥ 95%, import ≥ 85%, symbol ≥ 75%, script ≥ 95%).

**Memory tools** (#233) close the agent cold-start gap. `sigmap note "<text>"` appends to a cross-session decision log (`.context/notes.ndjson`); `sigmap status` shows branch, dirty files, and index freshness/staleness; and the **`read_memory` MCP tool — the 11th** — recalls recent notes plus the last `ask` session focus so a fresh agent session starts already knowing where work left off.

**Tags:** `verify-ai-output` · `fake-test-file` · `fake-npm-script` · `closest-match` · `--report` · `note` · `status` · `read_memory` · `11 MCP tools` · `PR #232` · `PR #233`

**Impact:** 5-detector Hallucination Guard + heuristic suggestions; 11 MCP tools (was 10); 42 new tests (29 verify + 13 memory); 949 tests passing.

---

### v7.15.0 — `conventions --ci` (consistency CI gate) ✓ (2026-06-18)

**Minor release — enforce convention consistency in CI.** `sigmap conventions --ci` computes the overall consistency score (from `--report`) and **exits non-zero** when it falls below a threshold (`--min`, default 0.70) — so a PR that scatters new naming styles fails the build. With `--no-regress` it also fails when the score dropped vs the last recorded snapshot. New zero-dependency, bundle-safe `src/conventions/ci.js` (`ciGate`) reuses `overallScore`; the gate is read-only (it never writes history — `--report` owns that). `--json` for machine output.

**Tags:** `conventions` · `--ci` · `gate` · `ciGate` · `no-regress` · `grounded-codegen` · `#322`

**Impact:** convention consistency is now enforceable in CI — pair `--report` (records the trend) with `--ci` (the PR check).

---

### v7.14.0 — `conventions --report` (consistency audit + trend) ✓ (2026-06-17)

**Minor release — the next `conventions` flag.** `sigmap conventions --report` scores each convention (file naming, export style) plus a single file-count-weighted **overall consistency score**, each with a delta vs the previous run — a trackable "how consistent is our style, and is it improving?" number. New zero-dependency, bundle-safe `src/conventions/report.js` (`scoreReport`, `snapshot`, `overallScore`); the command compares against the last snapshot in `.context/conventions-history.ndjson`, prints the audit with ▲/▼ trend arrows (in percentage points), and appends a fresh snapshot. `--json` for machine output.

**Tags:** `conventions` · `--report` · `consistency-score` · `trend` · `scoreReport` · `grounded-codegen` · `#319`

**Impact:** convention consistency is now a single trackable score with a per-run trend — the basis for a future `--ci` drift gate.

---

### v7.13.0 — `sigmap create` (grounded-creation pipeline capstone, Gap 2) ✓ (2026-06-17)

**Minor release — the capstone of the grounded-codegen work.** `sigmap create "<task>"` sequences the four guard stages — `scaffold` → `verify-plan` → `verify-ai-output` → `review-pr` — in one command with `1/4`…`4/4` numbering and a single pass/fail summary. Each stage runs only when its input is present (`--name` → scaffold, `--plan` → verify-plan, `--answer` → verify-ai-output, the git diff → review-pr); a stage with no input is skipped and never fails the run. New zero-dependency, bundle-safe `src/create/orchestrate.js` (`orchestrate`) delegates to the real stage modules — no logic duplication. Exits non-zero when any ran stage fails, so it works as a single CI gate for the whole pipeline. With this, the grounded-creation loop is functionally complete: every root cause (1–4) is closed and all four guard stages are sequenced by one command.

**Tags:** `create` · `orchestrator` · `pipeline` · `n/4` · `grounded-codegen` · `gap-2` · `capstone` · `#316`

**Impact:** the end-to-end grounded-creation loop ships — `sigmap create` runs scaffold, plan-verification, output-verification, and diff-review as one numbered, gated pass.

---

### v7.12.0 — `sigmap review-pr` (the create pipeline, Gap 2) ✓ (2026-06-17)

**Minor release — the last guard stage of the `create` pipeline.** `sigmap review-pr` audits a diff for drift + side effects after a PR is opened: **scope drift** (too many distinct top-level dirs), **god-node edits** (changed files with transitive dependents above a threshold, via the impact graph), **missing tests** (a changed source file with no matching changed test), and **security-sensitive files** (`.env*`, auth, secrets, `package.json`/lockfiles, `.github/workflows/**`, Dockerfiles, keys). New zero-dependency, bundle-safe `src/review/review-pr.js` (`reviewPr`); deletions are excluded from the source/security checks. CLI `review-pr [--base <ref>] [--staged] [--json]` collects the diff via shell-free git and exits non-zero on any finding (CI-gate). With this, **all four create-pipeline guard stages exist** (`scaffold` → `verify-plan` → `verify-ai-output` → `review-pr`).

**Tags:** `review-pr` · `create-pipeline` · `god-node` · `scope-drift` · `security-files` · `grounded-codegen` · `gap-2` · `#313`

**Impact:** the grounded-creation loop's four guard stages are complete — only the `sigmap create` orchestrator (which sequences them) remains.

---

### v7.11.0 — `sigmap verify-plan` (the create pipeline, Gap 2) ✓ (2026-06-17)

**Minor release — first piece of the `sigmap create` pipeline.** `sigmap verify-plan <plan.md>` checks a plan against the **live index** before the agent executes it: referenced files and symbols exist, blast radius is acceptable, scope is in bounds — catching Cause 1+2 at plan time, cheaper than after the code is written. New zero-dependency, bundle-safe `src/plan/verify-plan.js` (`verifyPlan`): flags missing files + unknown symbols (with closest-match suggestions), computes per-file blast radius via the impact graph, and flags broad scope. Plan input is markdown (resolves the open §10 schema decision, consistent with `verify-ai-output`); CLI reads a file or stdin, supports `--json`, and exits non-zero on blocking errors. This is step 2 of the four-stage pipeline (`scaffold` → **verify-plan** → `verify-ai-output` → `review-pr`).

**Tags:** `verify-plan` · `create-pipeline` · `blast-radius` · `live-index` · `grounded-codegen` · `gap-2` · `#310`

**Impact:** three of the four create-pipeline guard stages now exist (scaffold, verify-plan, verify-ai-output) — only the `create` orchestrator and `review-pr` remain.

---

### v7.10.0 — `sigmap scaffold` + confidence floor (Layer 4) ✓ (2026-06-17)

**Minor release — first slice of Layer 4 (Cause 3: guessing structure for new code).** `sigmap scaffold <name>` proposes a convention-matched structure for a new module — filename in the dominant naming style, the export style to use, and a matching test file — but **only when the conventions are consistent enough**. New zero-dependency, bundle-safe `src/scaffold/propose.js` (`proposeScaffold`): the governing confidence is file-naming consistency, with a configurable soft threshold (default 0.70) and a **non-overridable hard floor of 0.50**. Below the threshold it refuses and surfaces the conflict (reusing `analyzeConflicts`); `--force` allows a proposal between the floor and the threshold (flagged), but never below the floor — a wrong proposal *systematizes* bad code, so the floor is the safety. CLI supports `--ext`, `--threshold`, `--force`, `--json`; a refusal exits non-zero. This closes the last open root cause (Cause 3).

**Tags:** `scaffold` · `confidence-floor` · `proposeScaffold` · `hard-floor` · `grounded-codegen` · `layer-4` · `cause-3` · `#307`

**Impact:** grounded codegen now *produces* structure, not just describes it — and refuses rather than systematize an inconsistent convention.

---

### v7.9.0 — `conventions --inject` (CLAUDE.md injection, Layer 3) ✓ (2026-06-17)

**Minor release — completes the "agent sees the conventions" link.** `sigmap conventions --inject` renders the detected conventions (file naming, export style, test framework — each with dominant pattern + consistency tier) into a marker-delimited block and writes it into `CLAUDE.md`, creating the file if absent. New zero-dependency, bundle-safe `src/conventions/inject.js` (`renderConventionsBlock`, `injectConventions`): idempotent and marker-scoped (`<!-- sigmap-conventions:start -->` … `:end -->`), preserving all human content and coexisting with the `## Auto-generated signatures` block. This is §8 step 5 of the grounded-creation loop — the LLM now plans grounded in the repo's house style. `--report`, `--fix`, `--update`, `--ci`, and the Layer 4 scaffold remain follow-ups.

**Tags:** `conventions` · `--inject` · `claude-md-injection` · `renderConventionsBlock` · `injectConventions` · `idempotent` · `grounded-codegen` · `layer-3` · `#304`

**Impact:** the detected house style is now visible to any agent that reads CLAUDE.md — closing the loop from "SigMap knows the conventions" to "the agent writes to them".

---

### v7.8.0 — `conventions --conflicts` (grounded codegen, Layer 3) ✓ (2026-06-17)

**Minor release — next slice of Layer 3.** Where `sigmap conventions` reports the dominant pattern and a consistency tier, `--conflicts` surfaces *why* a convention is mixed: every variant pattern with its file count, share, a visual bar, and example files — plus rename suggestions that move minority file-naming files toward the dominant style. New zero-dependency, bundle-safe `src/conventions/conflicts.js` (`analyzeConflicts`, `toNamingStyle`, `renameSuggestion`); export-style conflicts list variants but no renames (named ↔ default is a code change, not a rename). `scoreConvention(labels, refs?)` now attaches up to 3 example files per variant (backward compatible). `--json` emits the structured report; a consistent repo prints "no conflicts". `--report`, `--fix`, `--update`, `--ci`, and CLAUDE.md injection remain follow-ups.

**Tags:** `conventions` · `--conflicts` · `analyzeConflicts` · `toNamingStyle` · `rename-suggestions` · `grounded-codegen` · `layer-3` · `#301`

**Impact:** mixed conventions are now actionable — the breakdown + renames are the input the scaffold confidence floor (Gap 1) will consume.

---

### v7.7.0 — `sigmap conventions` (grounded codegen, Layer 3) ✓ (2026-06-17)

**Minor release — first slice of Layer 3.** A new `sigmap conventions` command extracts and reports a repo's dominant coding conventions — **file naming** style, **export style**, and **test framework** — for TS/JS/Python, so generated code matches the house style instead of drifting (Cause 4: naming/convention drift). New zero-dependency, bundle-safe `src/conventions/extract.js` exposes `classifyNaming` (PascalCase / camelCase / kebab-case / snake_case), `scoreConvention` (a reusable consistency scorer returning `{ dominant, dominantPct, variants, tier }` with tiers at 90% / 70% — Gap 1's scaffold-confidence floor will reuse it), and `extractConventions`. The command writes `.context/conventions.json` and prints a readable report; `--json` for machine output. `--conflicts`, `--fix`, `--ci`, and CLAUDE.md injection are deferred to follow-ups.

**Tags:** `conventions` · `grounded-codegen` · `layer-3` · `classifyNaming` · `scoreConvention` · `consistency-tiers` · `#298`

**Impact:** SigMap now surfaces *how a repo writes code*, not just *what it contains* — the foundation for convention-matched code generation.

---

### v7.6.0 — Grounding benchmark (the GATE) ✓ (2026-06-17)

**Minor release.** A deterministic, offline **callee-grounding ablation** (`npm run benchmark:grounding`) that measures how much ground truth SigMap actually gives an agent: per corpus repo, `coverage = grounded / universe` — universe being every symbol defined in the source, grounded the subset SigMap surfaces in its index (resolvable by `get_callee_signatures`); baseline is 0 (no SigMap → guess every reference). `scripts/run-hallucination-benchmark.mjs` prints per-repo + aggregate coverage, `--save`s `hallucination.json`, and `--gate <pct>` exits non-zero below a threshold. Honestly framed as a ground-truth-availability proxy — not an LLM hallucination rate (the LLM A/B ablation is a follow-up needing an API key). This is the **decision gate** before the grounded-codegen Layers 3–4 (conventions/scaffold): measure first, then decide.

**Tags:** `benchmark:grounding` · `grounding-ablation` · `the-gate` · `offline` · `hallucination.json` · `#294`

**Impact:** the grounded-codegen plan now has a reproducible number behind it instead of invented percentages.

---

### v7.5.0 — Read-time self-heal ✓ (2026-06-17)

**Minor release — completes Layer 1 freshness.** The v7.4.0 write hooks kept the index live *only if the agent called them*; this removes that single point of failure. `search_signatures` / `get_callee_signatures` now reconcile the index with the source tree **on read** — `src/cache/freshen.js` re-extracts files modified since the last `generate` (bounded to actual session edits, not the whole tree; throttled per repo) and persists to the sig-cache, which `buildSigIndex` merges. So on-disk edits show up even when no hook fired. Deletions stay explicit (`sigmap_notify_file_deleted`), since a cache entry can be a notify overlay for a not-yet-on-disk file. Verified end-to-end in the standalone bundle.

**Tags:** `read-time-self-heal` · `freshen` · `live-index` · `no-cooperation` · `grounded-codegen` · `#290`

**Impact:** Layer 1 freshness is now robust (write hooks + self-heal) — the index reflects reality without depending on the agent.

---

### v7.4.0 — Live-index MCP write hooks ✓ (2026-06-17)

**Minor release — grounded codegen, Layer 1.** Three new MCP tools — `sigmap_notify_file_created`, `sigmap_notify_symbol_added`, `sigmap_notify_file_deleted` — keep the index fresh while an agent creates/modifies/deletes files mid-session, so a freshly-written symbol is immediately resolvable by `search_signatures` / `get_callee_signatures` instead of being re-hallucinated. They update the persisted sig-cache (which `buildSigIndex` already merges), so changes are live on the next read. New bundle-safe `src/extractors/dispatch.js` (static extractor dispatch). Also fixes a pre-existing standalone-bundle bug: the `ranker` factory had a raw `require('../cache/sig-cache')` never rewritten to `__require`, so the cache merge silently failed in the SEA binary — regenerated, and the full create→resolve→delete cycle now works from the bundle with no `src/`.

**Tags:** `mcp-write-hooks` · `live-index` · `notify_file_created` · `grounded-codegen` · `dispatch.js` · `bundle-fix` · `15-tools` · `#286`

**Impact:** MCP server 12 → 15 tools; agent-created code is indexed live within the session (Cause 2 — stale references).

---

### v7.3.0 — `get_callee_signatures` MCP tool ✓ (2026-06-17)

**Minor release.** A 12th MCP tool, `get_callee_signatures`, returns the **exact current signature(s)** of named symbols (functions, classes, methods) from the index — so an agent never guesses a callee's parameter types from training memory. This is the highest-ROI step toward grounded code generation (Layer 2 of the zero-hallucination plan): call it before writing code that uses a symbol. Input `{ symbols: string[] }`; unknown names get a closest-match suggestion. Works against the current index today (Layer 1 live-freshness makes it live later). Wired into the standalone bundle (regenerated `mcp/*` factories) and validated end-to-end via the bundle-driven MCP test.

**Tags:** `get_callee_signatures` · `mcp` · `grounded-codegen` · `callee-signatures` · `closest-match` · `12-tools` · `#282`

**Impact:** MCP server 11 → 12 tools; attacks the #1 code-gen hallucination (wrong parameter types) with ground-truth signatures before write.

---

### v7.2.1 — Realistic per-query savings ✓ (2026-06-17)

**Patch release.** `sigmap ask` (and the `gain` dashboard) measured savings against the *whole repo* — every query assumed feeding the entire source tree — which inflated `gain` (cumulative baselines in the millions) and showed ~99% per query. The baseline is now the full content of the files SigMap actually surfaced for the query (the ranked top-K): without SigMap you'd read those files in full; SigMap gives you their signatures. Drives the `ask` cost line, `--json savingsPct`, and the `gain` record. `generate` keeps the whole-repo baseline (it genuinely indexes every file → signatures).

**Tags:** `realistic-baseline` · `gain` · `ask` · `surfaced-files` · `#278`

**Impact:** `gain` reports honest savings (e.g. per-`ask` baseline ~127K → ~8K on this repo); per-query reduction now ~90–95% (signatures vs full relevant files) instead of ~99% vs the whole repo.

---

### v7.2.0 — Release-pipeline robustness ✓ (2026-06-17)

**Minor release — build/release hardening, no user-facing CLI changes.** Closes the gap that broke the v7.1.0 standalone binaries (a `src/` module missing from the bundle `__factories`). New **bundle integrity check** (`scripts/check-bundle.mjs`, #266) verifies every `src/` module is registered, runs on every PR (Node 18/20/22) + `prepublishOnly` + the binary preflight, and `--fix` inserts missing factories from source. A **version.json metadata gate** (`scripts/check-version-meta.mjs`, #268) derives `mcp_tools`/`tests` and fails on drift. A **standalone-bundle smoke test** (#274) runs `gen-context.js` with no `src/` present (the binary code path) across the matrix, and **`docs/RELEASING.md`** documents the whole flow. Also: `--health` relabels its informational "extractor coverage" line so it no longer reads as contradictory beside a 100/100 score (#270), and the root was decluttered (#272).

**Tags:** `check-bundle` · `check-version-meta` · `bundle-smoke` · `__factories` · `prepublishOnly-gates` · `RELEASING.md` · `--health-clarity` · `#266` · `#268` · `#270` · `#272` · `#274`

**Impact:** the bundle-drift class of release failures is now caught pre-merge and pre-publish (presence + functional smoke); release flow documented; version.json metadata self-checks.

---

### v7.1.0 — Token-savings dashboard (sigmap gain) ✓ (2026-06-16)

**Minor release.** New **`sigmap gain`** (#260) surfaces cumulative token savings right in the terminal — total tokens saved, % efficiency, estimated dollars, average latency, and a per-operation breakdown — with `gain --all` for daily / weekly / monthly trends. Savings are captured automatically: every `ask` and `generate` run appends a counts-only record to a dedicated local log `.context/gain.ndjson` (no file paths, source, or query text). Capture is **default-on** and privacy-safe; opt out with `--no-track`, `SIGMAP_NO_TRACK=1`, or `config.gainTracking:false`, and the legacy `usage.ndjson` / `--track` health log is untouched. New zero-dep `src/tracking/{aggregate,pricing}.js` and `src/format/gain-terminal.js` (ANSI renderer, `NO_COLOR`/non-TTY safe). "Saved" is labeled everywhere as an estimate vs the whole-file baseline. Also in this release: docs served at the sigmap.io root (#258) and a transparent Sponsor section (#257).

**Tags:** `sigmap gain` · `gain --all` · `gain --json` · `--no-track` · `gainTracking` · `.context/gain.ndjson` · `token-savings` · `privacy-safe` · `#257` · `#258` · `PR #261` · `#260`

**Impact:** users can finally quantify what SigMap saves them (tokens, %, $); zero new dependencies; default-on local-only capture; 18 new tests for the gain data layer + real CLI capture.

---

### v7.0.1 — Supply-chain hardening; importable core; wider star nudge ✓ (2026-06-14)

**Patch release — security & package hygiene.** Every `child_process.execSync` call (which runs through `/bin/sh -c`) was converted to shell-free `execFileSync` with an arguments array — several had previously interpolated values into the command string (`git diff ${range}`, `HEAD~${n}`, `printf '%s' … | ${clipCmd}`, `node -e "…http.get…"`), a real shell-injection surface. A new `src/util/git.js` (`git()`/`tryGit()`) centralizes shell-free git; the `extends` config fetch passes the URL as an argv, `compare` spawns node by argv, and clipboard copy writes via stdin. Net: **zero `execSync`/`exec`/`shell:true` in the published surface**, clearing Socket's "Shell access" capability alert (#252). Also: `package.json` `main` now points at the importable core API (`require('sigmap')` no longer runs the CLI; Bundlephobia sees the real zero-dep library), the star nudge counts plain `sigmap` runs (not just `ask`/`squeeze`) so context-only users reach it (#251), and the unused `machineId = sha256(os.hostname())` fingerprint was removed from `usage.json` (#252).

**Tags:** `shell-free` · `execFileSync` · `no-shell-access` · `src/util/git.js` · `main→core` · `star-nudge` · `no-fingerprint` · `supply-chain` · `#250` · `PR #251` · `PR #252`

**Impact:** Socket "Shell access" + "AI-detected risk" alerts removed (Supply Chain Security 75 → 100 after publish); injection vectors eliminated; importable core API; 988 tests passing.

---

### v7.0.0 — Squeeze + Star Nudge; signatures-under-budget fixed ✓ (2026-06-14)

**Major release.** **Squeeze** (#238) makes `sigmap ask` minimize pasted input before ranking — it classifies a stack trace, CI log, or JSON payload and dedupes frames, strips vendor/timestamp noise, and collapses repeated array items, while **enriching the top stack frame** with its real signature from the symbol index (the differentiator over generic log summarizers). New `sigmap squeeze <file|->` command and `--squeeze` / `--no-squeeze` / `--squeeze-threshold` flags; interactive-only prompt, never blocks pipes/CI. A one-time, race-safe **Star Nudge** appears after ≥10 runs / ≥8 successes. This default behavioral change to `ask` is why it's a major bump.

Alongside it: the **token budget now keeps full signatures** (#240) — when context exceeds `maxTokens`, low-priority files are dropped (only marginal overflow collapses to anchors) instead of every signature being gutted to a bare line pointer — and every generated context file carries **one canonical `## SigMap commands` block** (the redundant AGENTS.md `## Tools` JSON was removed). SigMap's own **`llms.txt` + `llms-full.txt`** are now generated from source of truth and CI-validated (#243); the benchmark corpus is **pinned to fixed commits** for reproducible metrics (#236); and `prdiff` symbol naming no longer emits phantom `+is`/`~is` fragments (#247).

**Tags:** `squeeze` · `star-nudge` · `symbol-enrichment` · `--squeeze` · `full-signatures-under-budget` · `llms.txt` · `pinned-benchmarks` · `BREAKING` · `PR #236` · `#238` · `#240` · `#243` · `#247`

**Impact:** flagship input-minimization (stacktrace ~85% / cilog ~89% / json ~73% reduction with 100% ground-truth preservation); context files keep real signatures; reproducible benchmarks; 984 tests passing.

---

## Current milestone — v7.13+ (grounded codegen shipped; next: measure + polish)

v6.0–v7.0.0 shipped graph-boosted retrieval, incremental signature cache, weights sharing, native tool instructions across all 7 adapters, MCP auto-wire, intelligent source root detection, intent-aware retrieval, cross-session context memory with impact planning, R language support, Python AST extraction, line anchors (Surgical Context), demand-driven retrieval with the `get_lines` MCP tool, the **`verify-ai-output` Hallucination Guard** (five-detector reliable MVP with closest-match suggestions + HTML report), **Memory tools** (`note`, `status`, `read_memory` — 11 MCP tools total), **v7.0.0**: **Squeeze** input minimization with symbol enrichment, full-signatures-under-budget, one canonical usage block, source-of-truth `llms.txt`, and pinned reproducible benchmarks; **v7.1.0**: the **`sigmap gain`** token-savings dashboard (cumulative tokens saved, %, est. $, daily/weekly/monthly trends; privacy-safe, local-only, default-on); and the **grounded-codegen** track — **v7.4–7.5** live-index write hooks + read-time self-heal (Layer 1), **v7.6.0** the offline grounding benchmark (the GATE), **v7.7.0** **`sigmap conventions`** (Layer 3: extract a repo's file-naming / export / test-framework conventions); **v7.8.0** **`conventions --conflicts`** (per-convention breakdown + rename suggestions); **v7.9.0** **`conventions --inject`** (CLAUDE.md convention injection — the agent now sees the house style); **v7.10.0** **`sigmap scaffold`** (Layer 4: convention-matched proposal gated by a confidence floor — closing the last root cause); **v7.11.0** **`sigmap verify-plan`** (Gap 2: plan vs live index); **v7.12.0** **`sigmap review-pr`** (Gap 2: diff audit); and **v7.13.0** **`sigmap create`** (the orchestrator that sequences all four guard stages — the grounded-creation capstone). The grounded-codegen loop is now functionally complete end-to-end. Next: the honest **LLM A/B hallucination benchmark** (run a model with vs without SigMap grounding, count flagged codebase-fact errors — the measured number behind the whole plan), plus polish — scaffold persistence, the remaining `conventions --fix/--update` flags (`--report` and `--ci` shipped in v7.14.0–v7.15.0), and an `init` "Creation workflow" CLAUDE.md block. Also planned: **PR verification** (`verify-plan` / `review-pr` GitHub Action), the **Interactive Context Explorer**, line anchors for the remaining extractors (Java, Go, Rust, C#, …), and performance optimizations for very large monorepos (>50K files).

---

<div style="text-align:center;margin-top:2.5rem;padding-bottom:.5rem;font-size:0.85em;color:var(--vp-c-text-3)">
  Made in Amsterdam, Netherlands <span title="Netherlands">🇳🇱</span>
</div>
