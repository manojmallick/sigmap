---
title: Roadmap
description: SigMap version history and roadmap. From v0.0 to v8.70.0, with the latest release making verify check the source instead of the signature index (a real symbol past the 25-signature cap, in a file outside the detected roots or in a construct the extractor does not list had been reported as fabricated; across 35 repositories 42% of the flagged names were real and the cap was only 3% of them) and recent releases making verify and judge agree about imports, imported names and paths (judge had been failing correct Go and Python answers, verdict accuracy 10 to 12 of 12 on the grounding corpus; Python and Go imports of the repo's own packages are now decided from the repo, and a name imported from a module that never defines it is flagged) and recent releases asking why retrieval misses and what each opt-in ranking signal is worth (every miss placed in one class, retrieval.bodyWords taking 83 labelled third-party questions from 42 to 57 hits when turned on, two signals that earned nothing deprecated) and recent releases closing the gaps that kept answers out of the index on repositories it does not control (Dart, Elixir and GDScript source roots, C# partial types, Swift attributed conformances, TypeScript default exports and source files named history.ts, taking the same questions from 48.2% to 50.6% hit@5 with no pinned srcDirs), measuring retrieval on those repositories in the first place, making a word and its inflections reach one stem in retrieval (six of ten common pairs had failed), making JavaScript line anchors end where the function ends (about 4% had been wrong) and fixing a data-loss bug (a context file that quoted the generated-block marker lost every line after the quote), measuring grounding accuracy on labelled good and bad answers and fixing a benchmark that compared two populations, writing context files as a stable body then a volatile tail so a prefix cache keeps hitting, and putting every model name and price behind one dated, overridable profile (`--suggest-tool` had been naming models `gain --model` rejected), resting `--analyze` coverage and the `plan` change list on named evidence (5 of 182 files had been reported as tested), removing a stack overflow on trees past 125,000 files (the report named one frame; four more had the same defect), adding Objective-C and PowerShell at Tier 2 (the Objective-C extractor was run over 839 real files before release, and 11% of its output was not a declaration), giving the CLI one canonical command table and the coverage ratio one definition (a CI gate had been passing on 241%), pinning the documented JSON contract to what the CLI actually emits, closing the loop at the agent (ask --with-source returns symbol bodies, a stale index no longer answers silently, every ask figure names its basis), making every scope claim name its basis (--diff <ref> includes uncommitted work, --callers stops asserting a zero it cannot support), giving the dashboard one output path and one language list, giving the index population and its age one shared definition (validate, doctor and status can no longer contradict each other) and closing the create-pipeline guards (nothing-ran is not a pass, creation plans reach stage 2) and the project-shape cluster (flat-layout source roots, one monorepo verdict, srcDirs disclosure) and the retrieval-honesty cluster (one shared file-category definition, zero-score suppression, path IDF, ask --explain) and completing the grounded-codegen plan — a realistic §9 ablation (real-symbol corpus, exact-signature grounding, --verbose), a Gemini (AI Studio) provider for the §9 ablation, the init Creation-workflow CLAUDE.md block, scaffold persistence, the LLM A/B hallucination ablation harness, the sigmap create orchestrator and its four guard stages (scaffold, verify-plan, verify-ai-output, review-pr), the conventions command with its full flag set (--conflicts, --inject, --report, --ci, --fix, --update), the grounding benchmark, read-time self-heal, live-index MCP write hooks, the get_callee_signatures MCP tool (exact callee signatures), realistic per-query savings, release-pipeline robustness (bundle integrity + version.json gates, standalone-bundle smoke test), the sigmap gain token-savings dashboard, supply-chain hardening (zero system-shell access), Squeeze input minimization with symbol enrichment, source-of-truth llms.txt, the verify-ai-output Hallucination Guard, and Memory tools (note, status, read_memory MCP tool).
head:
  - - meta
    - property: og:title
      content: "SigMap Roadmap — version history and upcoming features"
  - - meta
    - property: og:description
      content: "236 versions shipped. See what changed in each release and what is coming next."
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

Two hundred thirty-seven versions shipped. MIT open source from day one.

**Stats:** 95.7% overall token reduction · 80.4% retrieval hit@5 · 2.29× measured lift vs single-shot grep (89.6% vs 39.2%, honest corpus) · 98.0% test-discovery F1 · installed-library grounding (JS/TS + Python) · method-level call-graph (JS/TS, Python, Java, Go, Rust, Kotlin, Scala) · 22 MCP tools · 38 languages · 17-language source resolver · 0 npm deps

## Token reduction by version

| Version | Tokens / session | Notes |
|---------|-----------------|-------|
| v0.0 | 80,000 | Repomix baseline — starting point |
| v0.1 | 4,000 | First 95% reduction |
| v0.2 | 3,000 | Smarter filtering |
| v0.3 | 200–2,000 | Pull only what the task needs (MCP) |
| v0.6 | −40% per conversation | Session discipline |
| v0.8 | Cheaper repeated loads (depends on reuse within the cache TTL) | Prompt cache breakpoints |
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

**Impact: repeated context loads are billed at the cache-read rate — whether that saves money depends on how many requests reuse the block inside its TTL (see [cache economics](/guide/config#cache-economics))**

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

**Impact:** index-mode token reduction on real repos rises from ~4.6% to **32–42%** (axios 43.4%, fastify 41.1%, svelte 36.8%, vue-core 32.4%), now 100% anchored — with no `hit@5` regression.

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

### v8.26.1 — Trust Quick Wins II: KNOWN_LIMITATIONS.md ✓ (2026-08-18)

**Patch release — Pillar-A honesty reaches the extraction layer (G1).** New [`KNOWN_LIMITATIONS.md`](https://github.com/manojmallick/sigmap/blob/main/KNOWN_LIMITATIONS.md): a three-tier extractor table grounded in code (Tier 1 AST — Python via `python_ast.py` with regex fallback; Tier 2 anchored regex — the 11 `withAnchor` brace languages, doc hints on 6; Tier 3 pattern/heuristic — the rest plus the generic fallback), the truncation caps (25 signatures/file, 8 members/block) and what falls off, the nested-paren regex gap named plainly as the G4/D1 precondition, and the honest `verify` framing: an index-missing real symbol flags `fake-symbol` at medium confidence — a conservative false positive, never a silent pass. README carries a compact "Extraction honesty" tier label. A guard test drift-locks the doc's counts to `version.json` and cross-checks the Tier-2 count against the extractors that actually call `withAnchor` — the honesty page cannot silently rot.

**Tags:** `KNOWN_LIMITATIONS.md` · `extraction honesty` · `tier label` · `drift guard` · `G1` · `#520` · `PR #521`

**Impact:** the credibility gap a skeptical reviewer finds first is closed in writing; 6 new guard checks (133 files); zero runtime changes.

---

### v8.70.1 — the CLI says what it does ✓ (2026-10-08)

**Patch.** SigMap's own surfaces said things its behaviour did not back, and the plainest case was a command that failed a diff with nothing wrong in it ([#918](https://github.com/manojmallick/sigmap/issues/918), closing [#669](https://github.com/manojmallick/sigmap/issues/669), [#784](https://github.com/manojmallick/sigmap/issues/784) and [#816](https://github.com/manojmallick/sigmap/issues/816)). `sigmap create` runs `review-pr` as stage 4/4, and `review-pr` counted the files SigMap itself generates: the same real change passed with 6 files and failed with 10 and a false `scope drift: 6 top-level dirs` once `.context/*` and the copilot file were staged.

```
review-pr on one real change, SigMap's outputs staged:   10 files, scope drift, exit 1  →  6 files, clean, exit 0
--setup re-run on a global install:                      another hook line each time    →  "already installed (.git/hooks/post-commit)"
--setup over a hook holding your own gen-context.js line: your line deleted             →  your line kept, SigMap's replaced in place
squeeze: enclosing function found (this repo, 1,707):    55.4%                          →  99.8%
```

`review-pr` now leaves out `.context/*` and the adapter files that are generated from their first line, and says how many it left out; a `CLAUDE.md` with human text above the marker stays in. Two hook bugs were reproduced on the way: on a global install the line is `node ".../bin/sigmap" --generate …`, which contains no `gen-context.js`, so the idempotency check never matched and every `--setup` appended a copy (the context regenerated once more per commit, each run); and the rewrite deleted every line containing `gen-context.js`, a team's own included. A line is now SigMap's when it has the shape SigMap writes. `--generate` is documented as the hook's flag, `--setup` names the file it wrote and warns on `core.hooksPath`, and `doctor` gains a tenth check for the hook (missing, duplicated, stale, not executable, bypassed). The summary box names the files the run wrote instead of a literal, `--monorepo` counts a file once and says `none` rather than printing −872%, squeeze enrichment reads the anchor wherever the doc hint sits, and the MCP tool count (22), the `daemon status` exit codes and `.context/usage.json` are stated correctly. A new guide, [Measure AI credits](/guide/measure-ai-credits), gives a before/after procedure using GitHub's own billing, because `sigmap gain` is an estimate and says so in its JSON now too.

**Tags:** `review-pr` · `isSigmapOutput` · `src/util/post-commit-hook.js` · `doctor` · `--generate` · `BARE_RUN_ALIASES` · `enrichFrame` · `outputPaths` · `coverageScore` · `costBasis` · `measure-ai-credits` · `post-commit-hook.test.js` · `#918` · `#669` · `#784` · `#816` · `PR #919`
**Impact:** every published figure holds except the grep side of the honest comparison: SigMap's 89.6% is unchanged, and the single-shot grep baseline reads 39.2% (49 of 125) where it read 40.0% (50), so the lift reads 2.29× where it read 2.24×. The cause is measured, not assumed — one task, `t018`, lost its grep hit because SigMap's own generated `.github/copilot-instructions.md`, which the grep scan includes, now takes a top-5 place (127 of 625 against 126), and a control run of the untouched v8.70.0 tree in the same layout reproduces 40.0% and 2.24× exactly. Found and not fixed: `sigmap --watch`, `daemon start` and the end of `--setup` crash on Linux with Node 18 (`fs.watch` recursion arrived in Node 19.1; `engines` says `>=18`).

---

### v8.70.0 — verify checks the source, not the summary ✓ (2026-10-07)

**Minor.** `fake-symbol` — and `verify-plan`'s `unknown-symbol`, an *error* — asked whether a name is in the symbol index, and the index is a summary of the repository: 25 signatures a file, only the files under the detected source roots, only the constructs an extractor lists ([#914](https://github.com/manojmallick/sigmap/issues/914), [#910](https://github.com/manojmallick/sigmap/issues/910)). #910 blamed the cap. Measuring it over the documentation of 35 of the repositories the benchmarks clone showed the cap is the **smallest** of three reasons a real symbol was flagged: of the **355 distinct names** `verify` flagged, 58% are defined nowhere (correctly flagged), **32% are defined only in files the index does not hold** (cobra's index holds `doc/` and none of its 25 root files), 7% in an indexed file the extractor never listed (`export const immer = impl as Immer`), and **3% past the cap**.

```
verify on httpx's Cookies.extract_cookies / set_cookie_header / clear:   flagged → not flagged     the three methods #910 measured
verify on a real symbol in a file outside the indexed roots:             flagged → not flagged     cobra: 19 of its 26 flagged names
verify-plan on the same symbols:                                         error → clean
Ruby grounding fixture, verify symbol precision / judge verdicts:        69.6% → 100%  /  13 of 14 → 14 of 14
```

Before a symbol is reported it is now looked up in the source — only the names that would otherwise be flagged, in one pass. A name is confirmed when a call or a definition form of it occurs in the comment- and string-masked code of a file of the checkout (`name(`, a function-valued binding, a keyword definition, an exported binding — never the bare word, the standard `judge` already applies to the context), under a deterministic 64 MB / 25,000-file budget with no clock. `judge`, `sigmap verify` and the MCP `verify_suggestion` tool inherit it; a plan's `Creates:` introductions are deliberately not widened.

Two things were measured rather than assumed. Over the documentation of **35 third-party repositories** (267 documents that contain a symbol claim) the old and the new `verify` differ by **no new finding of any kind** and 319 dropped `fake-symbol`s, every one of which occurs in the repository's code: 2,275 → 1,956 issues. And 20,171 mutated, fabricated names — a swapped letter, a suffix, a prefix of real definitions — were run through the primitive: **none was confirmed**. The measurement also found that, with a path, the Python AST tier returns only 30 signatures for httpx's 1,277-line `_models.py` before the cap cuts it to 25 — a second truncation layer #910 did not mention.

**Tags:** `src/verify/source-confirm.js` · `confirmSymbols` · `symbolsConfirmed` · `fake-symbol` · `unknown-symbol` · `verify-plan` · `blankTextBlocks` · `grounding-fixtures` · `verify-source-confirm.test.js` · `#914` · `#910` · `PR #915`
**Impact:** the one published figure that moves is the grounding corpus's size — seven fixtures in seven languages where there were six, the engines' totals up (the symbol fakes `verify` catches 12 → 16, the judge's verdicts 12 → 14 of 14), every precision and recall still 1 and no floor lower. A fresh `benchmark:all` on the shipping tree reproduces v8.69.0's other figures leaf for leaf — 95.7% token reduction, 80.4% hit@5, the 61.9% task-success proxy, 1.58 prompts per task (44.4% fewer), 89.6% against 40.0% grep (2.24×) and 98.0% test-discovery F1 — and the saved reports differ only by version stamp and timestamp. Against a clean v8.69.0 worktree no `hard`, `mined`, `easy` or `jvm` task changes between hit and miss (73.3% / 61.7% / 90.0% / 34.4% in both) and 22 of the 231 first-hit ranks move, because the repository indexes its own source and this release adds to it — no ranking, extraction, discovery or config code differs between the two trees. 24 new guards (one new suite, `verify-source-confirm`, broken 34 ways in a scratch copy and caught each time); 231 integration suites + 28 fixture tests passing.

---

### v8.69.0 — verify and judge agree about imports, names and paths ✓ (2026-10-06)

**Minor.** `sigmap verify` and `sigmap judge` disagreed with each other, and with the truth, about imports — and the grounding corpus ([#871](https://github.com/manojmallick/sigmap/issues/871)) had recorded each disagreement as a known limitation in its own labels ([#909](https://github.com/manojmallick/sigmap/issues/909), [#672](https://github.com/manojmallick/sigmap/issues/672)). **`judge` failed fully correct Go and Python answers**: a real module path (`example.com/fx/internal/rank`, `app.config`) is never quoted by a context, and the structural import check only ran where a `package.json` existed. It also **grounded a claim `verify` had proved fake** whenever a word, a substring or a basename of it occurred in the context — `rank` by the prose "to rank files by topic", `lib/index.js` by the basename of `src/index.js`, `merge_default` by a substring of `merge_defaults`. And `verify` could not see a local import outside JS at all.

```
judge on a correct Go / Python answer:   fail → pass                       verdict accuracy 10 / 12 → 12 / 12
verify on a fabricated local import:     missed → flagged                  import recall 66.7% → 100%
judge on a claim verify proved fake:     grounded by a word → not grounded file / symbol recall 91.7% / 83.3% → 100%
```

`verify` now decides a Python or Go import of the repo's own package from the repo itself — `src/verify/imports.js` answers *resolved*, *unresolved* or *unknown*, and only *unresolved* is ever a finding, because a false "fake import" costs more than a missed one — and flags a name imported from a repo module that never defines it (**`fake-import-name`**, medium confidence: a name the file never mentions cannot be exported by it). It reads multi-line imports and destructuring, Go import blocks and Windows-style paths. `judge` lets that structural verdict outrank weak text — once `verify` has proved a claim fake, only evidence in the claim's own form grounds it (a call or definition for a symbol, a path-aligned suffix for a file, a whole token for an import) — and clears any import `verify` resolved, in any language.

Two things were measured rather than assumed. Over the documentation of **12 third-party repositories** — flask, click, httpx, fastapi, rich, gin, cobra, echo, gorm, express, zod and axios: 326 documents, 605 Python and Go import statements — the old and the new `verify` differ by **no new finding** and four dropped ones: three real fastapi relative imports (`from .dependencies import …`, which the old resolver reported as unresolvable) and a zod `catch(…)`. And the sweep ruled one proposal out: reading a declaration in backticks (`` `def clear(domain)` ``) as a symbol claim flagged three real httpx methods, because the symbol index keeps `maxSigsPerFile` (25) signatures per file and `httpx/_models.py` is cut at 1,277 lines. Declarations stay unread; the same false positive exists today for call-form claims and is tracked as [#910](https://github.com/manojmallick/sigmap/issues/910).

**Tags:** `src/verify/imports.js` · `fake-import-name` · `verifiedImports` · `hasStrongEvidence` · `PY_STDLIB` · `GO_STDLIB` · `import-name` · `grounding-fixtures` · `verify-imports.test.js` · `#909` · `#672` · `#910` · `PR #911`
**Impact:** the one published figure that moves is the grounding corpus — verify recall 0.938 → 1, judge precision 0.871 → 1, judge recall 0.9 → 1, verdict accuracy 0.833 → 1, with no floor lower than before. A fresh `benchmark:all` on the shipping tree reproduces v8.68.0's other figures leaf for leaf — 95.7% token reduction, 80.4% hit@5, the 61.9% task-success proxy, 1.58 prompts per task (44.4% fewer), 89.6% against 40.0% grep (2.24×) and 98.0% test-discovery F1 — and the saved reports differ only by their version stamp. Against a clean v8.68.0 worktree no `hard`, `mined` or `easy` task changes between hit and miss (73.3% / 61.7% / 90.0% in both; `jvm` holds at 34.4%) and 18 of 174 first-hit ranks move, because the repository indexes its own source and this release adds to it — no ranking, extraction, discovery or config code differs between the two trees. 41 new guards (one new suite, `verify-imports`, broken thirteen ways in a scratch copy and caught each time, and one changed case in `grounding-regression.test.js`); 230 integration suites + 28 fixture tests passing.

---

### v8.68.0 — why a question misses, and the lever for the biggest class ✓ (2026-10-06)

**Minor.** The retrieval gates said how many tasks miss and never why, and the opt-in ranking signals sat in the config reference with no recorded verdict on whether they were worth keeping ([#674](https://github.com/manojmallick/sigmap/issues/674), [#703](https://github.com/manojmallick/sigmap/issues/703)). This release adds the instruments that say why — **`--why`** places each miss of `hard`, `mined`, `easy` and `jvm` in exactly one class, **`--signals`** ranks each opt-in signal against the shipped ranker task by task, and **`--autopsy`** shows where SigMap and a whole-file grep scan disagree on the honest corpus — and acts on what they found.

```
largest class of miss:         shares no token with the question     xrepo 12 of 41 · jvm 24 of 40
what the answer's source has:  a rare word of the question           11 of xrepo's 12 · the signature map drops it
the lever, opt-in:             retrieval.bodyWords                   xrepo 42 → 57 of 83 · honest 112 → 116 of 125
```

**`retrieval.bodyWords`** indexes each file's rare body words — a word held by no more than 5% of the files and absent from the file's own index entry, 200 a file at most — into BM25's prose field, so a question asked in the words the code uses can reach the file that does it. On `xrepo` it takes 42 of 83 to **57** (50.6% → 68.7%), winning 16 tasks and losing 1, with MRR 0.354 → 0.483, so it is not a hit@5-only effect; the honest corpus goes 112 → 116 of 125 (89.6% → 92.8%) without losing a task, and over all 439 tasks of the six corpora it is +24 (won 27, lost 3). No corpus loses net, and neither does any of the 90 cells of a sweep over its two constants; 5% and 200 sit inside the flat region of that grid, not at its peak. One caveat the corpora cannot remove: `xrepo`'s questions were written by reading the code, which favours a lever that indexes the code's own words, so its +15 is the upper end; the mined and JVM subjects, written by people describing a change, gain less, and none loses. **It is off by default**: turning it on moves every published retrieval number and baseline, which belongs with a release that re-records them, so with it off nothing changes.

The same instruments judged the other signals, by one rule written down with the numbers in hand — a default at +5 on the third-party corpus with no corpus net-negative, deprecated at a net that is not positive with at most two hits changed, opt-in otherwise. `retrieval.centralityBlend` moved the rank of 4 of 314 tasks and changed one hit, a loss; `retrieval.surfaceEnrichment` changed two, one each way. Both are **deprecated**: they still work, warn once per process, and go in v9.0. `retrieval.minedExpansions` stays opt-in (+3, thin), and `retrieval.callGraphBoost`, net −3 (won 3, lost 6) and negative on three of the six corpora, is the next decision.

Two findings are recorded and not acted on. The published grep baseline counts SigMap's own output files — 126 of the 625 places in grep's top 5 — and with them left out grep reads 45.6% and the honest lift is **1.96×** rather than 2.24×; SigMap's own figure does not move, and restating the published one is a decision for a release of its own. And #674's 90% holds only with the flag on (116 of 125; 112 as shipped), so it stays open until the default flips. The `jvm` baseline, which held 21.3% while the tree measures 34.4%, is re-recorded alone. One defect in the gates' own output is fixed on the way: the xrepo gate printed its `--json` document with `console.log` and then exited, which through a pipe cuts anything past 65,536 bytes off.

**Tags:** `retrieval.bodyWords` · `body-words.js` · `--why` · `--signals` · `--autopsy` · `signal-arms.json` · `body-words-sweep.json` · `honest-autopsy.json` · `attribution.mjs` · `write-sync.mjs` · `centralityBlend` · `surfaceEnrichment` · `#905` · `#674` · `#703` · `PR #906`
**Impact:** no published metric moved: a fresh `benchmark:all` on the shipping tree reproduces v8.67.0's figures leaf for leaf — 95.7% token reduction, 80.4% hit@5, the 61.9% task-success proxy, 1.58 prompts per task (44.4% fewer), 89.6% against 40.0% grep (2.24×) and 98.0% test-discovery F1 — and `benchmarks/latest.json` differs only in its benchmark id, date and provenance stamps. With `retrieval.bodyWords` on: `xrepo` 42 → 57 of 83, the honest corpus 112 → 116 of 125, 439 tasks +24 (27 won, 3 lost). Against a clean v8.67.0 worktree no `hard`, `mined`, `easy` or `jvm` task changes between hit and miss (73.3% / 61.7% / 90.0% / 34.4% in both) and 24 of 170 first-hit ranks move, because the repository indexes its own source and this release adds to it — this release's ranker run over the old tree's index ranks all 170 identically. 81 new guards (seven new suites and one case in `xrepo-attribution.test.js`); 229 integration suites + 28 fixture tests passing.

---

### v8.67.0 — the zero-config gaps the third-party gate found, closed ✓ (2026-10-05)

**Minor.** v8.66.0 added `xrepo` — 83 questions across 16 repositories nobody here controls — and it read 40 of 83 (48.2%) with no config. Attributing each of its 43 misses showed that the cheapest to fix, and the only ones that trade nothing against another corpus, were answers that **never reached the index**. This release closes them. Three discovery rules: a Dart pub workspace (and a `melos.yaml` one, and an Elixir umbrella) is a monorepo whose members' `lib/` directories are the roots; Elixir's `.ex` and `.exs` count as code; a GDScript tree is rooted at the repository. Four extractor constructs that returned nothing for a real file: C# `partial` types, Swift `: @unchecked Sendable`, and TypeScript/JavaScript `export default function`, `export default class` and `export default <identifier>`. One path classifier: `isDocsFile` read `history.ts`, `security.py` and `changes.rb` as documentation and took 80% off their score.

```
zero-config source roots:        Riverpod packages/*/lib (10 roots) · Phoenix lib/ · the Godot demos (.)     0/15 → 8/15, no pin
files that extracted nothing:    C# `partial` · Swift `@unchecked` · TS/JS `export default`                 346 of 9,512 files now extract
a classifier that demoted code:  excalidraw history.ts  penalty 0.2  →  rank 20  (undemoted: rank 1)
```

`xrepo` now reads **42 of 83 (50.6%)**, with a 95% interval of 40.1–61.1%, and for the first time with no pinned `srcDirs`: Riverpod, Phoenix and the Godot demos scored 0 of 15 once the pin was removed and read 8 of 15 now. Phoenix reads 4/5 where its pin scored 5/5, and that is a change of measurement path, not a regression: with a config file the import graph is built over the pinned roots, with none it is built over `src`, `app`, `lib`, `R` and `inst` whatever detection chose — 75 of Phoenix's 224 indexed files — which is the experience every product caller gets, and is not changed here. **`xrepo --why`** places each miss in exactly one class — not indexed, demoted by a path penalty, no token in common with the question, or ranked 6–10 / 11–20 / 21–50 / beyond 50 — so the work goes where it pays: of the 41 misses left, 1 is not indexed, none is demoted, 12 share no word with the question and 28 are ranking.

It is measured, not assumed. A diff of v8.66.0's extractors against this release's over every C#, Swift, TypeScript and JavaScript file in the 50 benchmark clones (9,512 files) finds 346 files that gain signatures from zero, 64 that grow (22,351 → 23,407 signatures) and none that loses one. The same diff caught a defect in this release's own export loops before it shipped: they tested for `async` over the whole match, so Svelte's `export function async(…)` was listed as an async function (#902). On the self-scored corpora `hard` reads 74.4% against 73.3% and that is not an improvement — two queries move because the generated `## recent changes` block names different symbols, and with the block off, the same trees differ only by two ranks outside the top 5.

**Tags:** `xrepo` · `--why` · `packageSrcDir` · `rootedAtRepo` · `source-root-resolver.js` · `isDocsFile` · `csharp.js` · `swift.js` · `typescript.js` · `javascript.js` · `export default` · `#900` · `#893` · `#902` · `#674` · `PR #901`
**Impact:** `xrepo` 40/83 → 42/83 (48.2% → 50.6%); the three repositories that needed a pinned `srcDirs` read 8 of 15 without one (0 of 15 before). A fresh `benchmark:all` moves hit@5 79.7% → 80.4%, the task-success proxy 59.0% → 61.9%, prompts per task 1.62 → 1.58 (43.1% → 44.4% fewer) and the honest comparison 88.8% → 89.6% against 40.0% (2.22× → 2.24×), all through five repositories' indexes (axios 29 → 47 indexed files); token reduction (95.7%) and test-discovery F1 (98.0%) hold. Against a clean v8.66.0 worktree `mined` 61.7%, `easy` 90.0% and `jvm` 34.4% are unchanged and `hard` is 74.4% (73.3%), as above. 83 new guards (four new suites and three cases in `xrepo-corpus.test.js`); 222 integration suites + 28 fixture tests passing.

---

### v8.66.0 — retrieval, measured on repositories we do not control ✓ (2026-10-05)

**Minor.** Every retrieval gate scored a corpus this project wrote or can influence — `hard` against its own source, `mined` from its own history, `jvm` on two repositories — so a ranking regression on a repository nobody here controls could ship green, and #805, #807 and #808 did. **`xrepo`** is the instrument that was missing: 83 questions across 16 third-party repositories pinned to exact commits, each labelled with the files that answer it and a written reason before any ranker run, then scored the way a first-time user's run indexes a repository — auto-detected `srcDirs`, no config. A second, independent annotator saw only the questions and matched 79 of 83 file sets exactly (95%); both annotators were language models, so that bounds labelling noise, not blind spots they share.

It reads **40 of 83 (48.2%)**, with a 95% interval of 37.8–58.8%, against 73.3% on `hard` and 61.7% on `mined` — a gap that is the point, not a flaw. The gate holds an overall floor (0.40) and, sharper, per-repo no-regress: the ranker is deterministic and every repository is pinned, so a repo's hit count moves only when SigMap's code does. Its first cold-cache run in CI took about a minute and read the same 40/83 as the macOS baseline, as did a case-sensitive filesystem.

```
zero-config detection never reaches:   Riverpod packages/*/lib · Phoenix lib/ · the Godot demos
files that never reach the index:      TS `export default <id>` · C# `partial` · Swift `@unchecked` · any `build/` directory
a classifier that demotes real code:   excalidraw history.ts  penalty 0.2  →  rank 20  (undemoted: rank 1)
```

None of that is fixed here — #893 tracks it — but each is now measured and recorded in the baseline, so a fix shows as an improvement and a regression as a failure. The corpus the new gate sits beside needed fixing too (#883): five of the 23 `mined` tasks listed the bundled `gen-context.js`, which tooling rewrites on nearly every commit, as their only answer; the miner now drops generated outputs before it judges focus, and the corpus is re-mined to 60 tasks. A coverage guard fails when an extractor language has no corpus task (#701 — Elixir, Astro, Lua and GDScript are measured now), and flat Go, Gradle multi-module Kotlin and SwiftPM layouts have retrieval fixtures (#810).

[@tunglambk](https://github.com/tunglambk) fixed the todos extractor in the same release (#877, PR #895). It matched `//` or `#` plus a marker against the raw line, so `lines.push('## todos')` in this repository's own generator, `// Todoist client` and `#hackathon` were all listed as TODOs; markers are now read from masked source, uppercase and word-bounded, and `/* HACK */` is found instead of dropped. Signatures are identical on 60,964 files across this repository and 50 pinned checkouts. The `## todos` section loses 197 false positives and gains 135 block-comment markers, and 47 entries that read as markers — lowercase or capitalised forms, a bare `// FIXME:` — are no longer listed.

**Tags:** `xrepo` · `run-xrepo-gate.mjs` · `fetch-xrepo-repos.mjs` · `retrieval-xrepo.jsonl` · `xrepo-baseline.json` · `unreachable` · `corpus-coverage.json` · `mine-corpus.mjs` · `todos.js` · `maskStrings` · `#810` · `#883` · `#701` · `#877` · `#892` · `PR #894` · `PR #895`
**Impact:** no ranking, detection or signature-extraction behaviour changes — the one source change is the todos masking fix (#877, PR #895), which alters only what the `## todos` section lists — and no published metric moved: a fresh `benchmark:all` reproduces 95.7% / 79.7% / 43.1%, 88.8% vs 40.0% and 98.0% test-discovery F1 exactly, on the tree before that fix and on the merged tree. Against a clean v8.65.3 worktree `hard` 73.3% / 0.579, `mined` 61.7% and `easy` 90.0% / 0.850 hold; one first-hit rank inside the top 5 moves (`mined` m003, 3 → 4, a 0.012-point tie) and three outside it (`hard` h020, h026, h067), because #895 changed this repository's own index. 78 new guards across six new suites and the isolation test; 218 integration suites + 28 fixture tests passing. **Known trap:** the seven repositories `fetch:xrepo` adds land in `benchmarks/repos/`, where `benchmark:test-discovery` reads 95.3% F1 and `validate:grounding-coverage` fails — the figures above were measured with them set aside (#893).

---

### v8.65.3 — a word and its inflections reach one stem ✓ (2026-10-05)

**Patch.** The ranker compares stems, and the stemmer left a word and its inflections apart: `classify` stayed `classify` while `classified` became `classifi`. A question phrased naturally — "how are test files classified" — therefore never met `classify` in the code, and the file that answers it, `src/util/file-class.js`, ranked 15th. Six of ten common pairs failed (#875), among them `apply`/`applied`, `order`/`ordering`, `parse`/`parsing`, `verify`/`verified` and `cache`/`caching`.

Six small rules fix it. `-ied` becomes `y`. The silent `e` comes off the base, but a stem that would end in a lone `s` keeps it, because the plural rule eats that `s` when a stem is stemmed again (`pars` → `par`). `-er` and the derivational suffixes need a root of five characters, so `order` is no longer `ord` + `er`. An `-er` under `-ed` comes off (`registered` → `regist`), doubled consonants collapse (`mapping` → `map`), and `-ify` folds to its root, so `classified` meets a `file-class` path. Each rule was kept or dropped by measurement against a same-tree control over 299 tasks — never against the stored baseline — and more than twenty variants were run.

```
before:  "how are test files classified"  →  src/util/file-class.js  rank 15
after:   "how are test files classified"  →  src/util/file-class.js  rank 4
```

Measured, not hoped for: hit@5 209 → 212 and hit@3 190 → 197 over 299 tasks, no corpus loses a task, `validate:retrieval --no-regress` passes, and `jvm` moves 29.5% → 34.4%. It is not a free win. On the per-repo tasks three rank-1 hits slip to rank 2, which moves the modeled task-success proxy from 61.0% to 59.0%; four tasks fall from rank 5 to 6 against four that enter the top 5; and the stemmer is still not idempotent for stacked derivational suffixes (322 → 152 unstable stems over 12,003 identifiers), because a fixed point merges `implement` with `implementation` and cost a mined task. One corpus task is relabelled from hard to easy: a better stemmer found that `log` shares a stem with its answer's filename, a leak the old one could not see.

**Tags:** `stem()` · `bm25.js` · `silent e` · `-ify` · `mined-expansions` schema 2 · `leakage` · `#875` · `PR #889`
**Impact:** 15 new guards in `stemmer-inflections.test.js` (10 fail on v8.65.2); a cold `rank()` on a 1,200-file repository takes about 83 ms where it took about 94 ms; the 18-repo hit@5 reads 79.7% (was 78.6%) on one task, svelte, and the modeled task-success proxy reads 59.0% (was 61.0%).

---

### v8.65.2 — a function anchor ends where the function ends ✓ (2026-10-04)

**Patch.** A `:start-end` anchor is the line range an agent reads through `sigmap lines`, `get_lines` and `--with-source`, and it is the core of the claim that every symbol carries a real one. About 4% of JavaScript anchors were wrong: a body that ran on to a later function or the end of the file, or one that collapsed to a single line. An agent following one read the wrong code with full confidence.

The block scanner found a function's end by matching braces over text in which comments and strings had been blanked — but not regular-expression literals. The braces, parens and quotes inside one (`/\{(\w+)\}/g`, `/['"]/g`) unbalanced every scan after it, and a `//` inside one (`/\//g`) read as a comment. A second cause the issue did not name: a template literal nested inside another's `${ }`, with its own backticks, ended the outer one early. An independent check that does not use the masker — V8 compiling each anchored slice, plus the bare column-0 closing brace this repository writes — found 75 of 979 anchors wrong; it finds none now.

The scanner has an opt-in JavaScript/TypeScript mode. A `/` divides after a value (an identifier, number, string, `)` or `]`, or a keyword-shaped word after a `.`) and starts a regex after an operator, an opening bracket or a word like `return`; escapes and `[...]` classes are honoured; a regex never spans lines and `</tag>` is never one; and `${ }` expressions are scanned with the same token step as the main loop. The call graph carried a byte-for-byte copy of the old masker with the same gap; it now uses the shared scanner. Every other language scans exactly as before — the output is byte-identical across 16,898 real files.

```
before:  function _cleanEntry  :48-205     ← really 48-56      function verifyPlan  :108-108   ← really 108-203
after:   function _cleanEntry  :48-56                          function verifyPlan  :108-203
```

**Tags:** `scan.js` · `js` mode · `jsToken` · `templateEnd` · `maskJs` · `anchor self-audit` · `#874`
**Impact:** 55 new guards in `js-anchor-masking.test.js`, including a self-audit of every anchored function declaration in `src/` and `packages/` (0 of 984 wrong; 33 of the 55 fail on v8.65.1). Across 5,618 JS and TS files, 59 change — 57 only in their anchors, 2 gaining symbols the old scanner had swallowed. Retrieval does not change. One token figure moves by 0.1 points: axios's map grows by 123 tokens because `AxiosHeaders` is now indexed, so the average reduction reads 95.7% where it read 95.8%.

---

### v8.65.1 — a file that quotes the marker keeps its text ✓ (2026-10-04)

**Patch.** A fix for data loss. SigMap appends its generated block to `CLAUDE.md`, `AGENTS.md` and the other context files under a `## Auto-generated signatures` heading, and its contract is to never overwrite what a human wrote above it. The writers enforced that with `existing.indexOf('## Auto-generated signatures')` — the first occurrence anywhere in the file — and then discarded everything after it.

So a file that merely *mentioned* the heading — in a sentence, in a code block, in a doc about SigMap itself — lost every line that followed the mention, on the next run, with no warning. When the file is untracked there is no way back. This repository's own `CLAUDE.md` was cut off mid-sentence at exactly such a quote. The bug was also wider than the four adapters the issue named: `outputs: ["claude"]` goes through the CLI core's own writer, and the Bash-allowlist and skills injectors and two readers all used the same first-occurrence lookup. A related substring test replaced a whole human file whenever it contained the text "# Code signatures".

One helper now decides what the managed section is: the heading immediately followed by the generator's stamp comment, never inside a code fence, the last one winning. A heading someone typed without the stamp is replaced only when a SigMap block follows it; otherwise the section is appended after it and a warning is printed. Files already damaged by the old bug repair in place — the next run replaces the stale body once and the file stays stable instead of growing.

```
before:  [ your notes … "## Auto-generated signatures" in a code block … more notes ] → everything after the quote deleted
after:   [ your notes … quote … more notes ] ## Auto-generated signatures <!-- Updated by gen-context.js --> [ generated block ]
```

**Tags:** `managed-section.js` · `findManagedSection` · `replaceManagedSection` · `outputs: ["claude"]` · `writeClaude` · `repair in place` · `#873`
**Impact:** 45 new guards in `managed-section.test.js` — every adapter against an inline mention, a fenced mention, a real marker, a bare marker and a same-titled human section, each byte-stable on a second run; the CLI end to end; and the repair of a damaged file with no growth. No measured retrieval or token figure changes. Text already lost cannot be restored.

---

### v8.65.0 — grounding accuracy, measured on answers whose truth is known ✓ (2026-10-04)

**Minor.** Two defects in how SigMap measures its own grounding, fixed together because they share one harness and one gate.

`benchmark:grounding` divided two numbers that described different things. Its *universe* — every symbol an agent might cite — came from a hard-coded list of source directories; the *index* it was compared against came from the generator's own resolved roots. clap's real code lives in `clap_builder/` and friends, so the harness scanned only its facade crate and printed **0/0** as an ordinary row. okhttp's universe included samples and `build-logic` that the index deliberately skips, so it read **0.1%**. The Kotlin and Go collapse in the issue was never an extractor defect; it was the harness. The universe is now the generator's own scope, less the test, mock and generated files its drop order removes first. A repo with an empty universe is *unmeasured*, not 0%, and fails the run. Re-measured: okhttp 0.1% → 89.9%, kotlinx-coroutines 4.5% → 100%, cobra 14.8% → 90.5%, gin 27.8% → 93.4%, echo 39.0% → 95.6%, clap 0/0 → 36.1%.

The other half had no number at all: how often `verify` and `judge` are *right* about whether a cited file, symbol or import is real. A checked-in corpus now answers it — a small repo in each of go, java, javascript, python, rust and typescript, with a `good.md` where every claim is real and a `bad.md` with planted, labelled fakes. Each is indexed by the real generator in a temp copy, and both engines run over both answers: precision and recall per claim kind, plus the judge's pass/fail verdict accuracy. No LLM, no network, byte-identical across runs.

```
verify   file · symbol · script   precision 100%, recall 100%      import   precision 100%, recall 66.7%
judge    import                   precision  60%                  verdicts 10 of 12 correct
```

The corpus keeps the cases the detectors get wrong, on purpose: the judge fails a good Python or Go answer that cites a real bare import of a repo module (it can only clear a bare import when a `package.json` exists), and `verify` skips non-JS bare imports by design. The floors hold those numbers, so a fix raises them and a regression lowers them. `npm run validate:grounding` gates the corpus in CI; each benchmark repo also has its own recorded coverage floor (`validate:grounding-coverage`, run locally and at release, since it needs the cloned repos).

**Tags:** `run-grounding-regression.mjs` · `grounding-fixtures` · `validate:grounding` · `grounding_regression` · `grounding-floors.json` · `unmeasured` · `validate:grounding-coverage`
**Impact:** 18 new guards in `grounding-regression.test.js` and 7 in `hallucination-benchmark.test.js`; six languages, precision and recall per claim kind published in `benchmarks/latest.json`. No retrieval or token figure changes; the published grounding-availability figure is the first one measured over a single population (75.2% across the repos that measured anything).

---

### v8.64.0 — a prefix cache can only hit what stays still ✓ (2026-10-04)

**Minor.** A provider's prompt cache matches on an exact prefix: the first byte that differs ends the hit, and everything after it is billed as new input.

SigMap's context file opened with the part most likely to differ. A `## changes (last 5 commits — 5 minutes ago)` block sat ahead of the whole signature body, its contents changed on every commit, and its age changed on every run — and was false the moment the file was written. Several adapters also stamped an absolute timestamp on the first lines. So however large and stable the signature body was, it started after a byte that moved, and could never be a cache hit.

```
before:  [ header · usage · deps · todos · CHANGES (5 minutes ago) ] [ signatures ... ]   ← prefix moves every run
after:   [ header · usage · deps · todos · signatures ... ] <!-- sigmap:volatile --> [ recent changes (develop@<commit>) · routing · stamp ]
```

Every written file is now a stable body, an invisible marker, then the volatile tail (`cacheLayout: "stable-prefix"`, the default; `"legacy"` restores the old order). The recent-changes block is identified by branch and commit and never by age. `--format cache` splits at the marker and writes an Anthropic `system` array — the stable block carrying `cache_control` (`cacheTtl` is exactly `"5m"` or `"1h"`), then the tail without it. A new commit changes only what follows the marker; a test commits to a fixture and asserts the stable prefix is byte-identical before and after.

`--report` and `--format cache` also answer the question that decides whether any of this pays: is the stable prefix long enough for the model to cache at all? Each model's minimum is read from the dated profile. SigMap counts characters and the provider counts tokens, so a prefix within ±15% of a minimum is reported as `borderline — verify with a provider token counter` and never given a confident verdict.

The docs now state the economics instead of a savings figure: a 5m write costs 1.25× the input price and a 1h write 2×, a read about 0.1×, so break-even is the 2nd request at 5m and the 3rd at 1h. The unmeasured "−60% API cost" claim is gone from the repomix and roadmap pages.

**One breaking change:** `.github/copilot-instructions.cache.json` is now an array of blocks, not one object. The byte layout of every committed `CLAUDE.md` / `AGENTS.md` also changes on the next run.

**Tags:** `cacheLayout` · `cacheTtl` · `<!-- sigmap:volatile -->` · `src/format/cache-layout.js` · `cacheFit` · `recent changes (<branch>@<commit>)` · `--format cache` two-block payload
**Impact:** 46 new guards in `cache-layout.test.js` — the order in all seven written outputs, no timestamp ahead of the signature body, no relative age, byte-identical reruns apart from stamp lines, and a commit leaving the stable prefix untouched. No measured retrieval or token figure changes; this release touches layout and reporting, not ranking.

---

### v8.63.0 — one dated model table, and advice you can price ✓ (2026-10-04)

**Minor.** SigMap held two model tables that had never met.

`--suggest-tool` and the routing section printed names from a literal in `src/routing/hints.js`: `claude-opus-4-6`, `gpt-5-2`, and `gemini-2-5-pro` in the *powerful* tier above `gemini-3-1-pro` in *balanced* — an older generation ranked over a newer one. `gain`, `--cost` and `ask` priced from a second literal in `src/tracking/pricing.js`, which still listed `gemini-1.5-pro` and charged the current Sonnet $3 per million tokens. No key in one table existed in the other, so a name the first command recommended was rejected by the second:

```
$ sigmap --suggest-tool "refactor the ranker"      →  models : claude-sonnet-4-6, gpt-5-2, gemini-3-1-pro
$ sigmap gain --model claude-sonnet-4-6            →  unknown model — priced as claude-sonnet ($3/MTok)
```

Neither table said when it had been true, and neither could be corrected without editing SigMap.

There is now one table, `src/config/models.js`: model id → vendor, tier, input price, context window and cache minimum, under a single `asOf` date. The pricing module and the routing hints derive from it and hold no model or price literal of their own — a guard test reads their source and fails on one. Four properties follow from that, and each is pinned:

| Property | How it is enforced |
|---|---|
| A name `--suggest-tool` prints is accepted by `gain --model` | every tier's models are resolved through the pricing path in a test, and through the CLI |
| Tier order is consistent within a vendor | a higher tier may never cost less than a lower one from the same vendor |
| The date travels with the figure | `--suggest-tool`, the routing section, `gain`, `gain --models`, `--cost` and `ask` each print `as of <date>` |
| Your figures win | a `models` config namespace overrides any field of any model; a value of the wrong type is ignored rather than trusted |

```
[sigmap] suggest-tool:
  tier   : balanced
  label  : Balanced (mid-tier)
  models : claude-sonnet-5-5, gpt-6.1-sol, gemini-3.8-flash
  cost   : $0.75–$2 / MTok input
  as of  : 2026-10-04 (shipped profile) — set "models.roster" in gen-context.config.json to name the models you have
```

**The roster.** The only honest source for which models *you* have is you — a Copilot picker, an organisation's allow-list and a personal API key all differ. Declare `models.roster` and the advice names only those models; a tier your roster has no model for says so instead of suggesting one you cannot use. The roster also bounds the auto budget: with `modelContextLimit` unset, the cap drops to the smallest known roster window when that is below the default. It never raises the cap — declaring a 1M-window model is not a request for a larger always-on file.

**No live fetch.** Not by default and not as an option. Each shipped figure was read from the vendor's own pricing or models page on the profile date, and a figure a page did not state is left unset rather than guessed — which is why the shipped table carries context windows for the Claude and GPT-6 entries only, and cache minimums for the Claude entries only. Freshness is a ninth `sigmap doctor` check that warns once the profile in force is more than 90 days old; setting `models.asOf` to the date you verified your figures, or upgrading, clears it.

**Estimates say they are estimates.** SigMap counts characters, not tokens. A count priced against a model is labelled `est. (chars/4)` unless `models.charsPerToken` gives that model a factor, in which case the factor is applied and named instead.

**Dollar figures moved, because the old ones were wrong.** The `gain` default, `claude-sonnet`, now resolves to Sonnet 5.5 at $2/MTok (it was $3), so "Est. money saved" reads a third lower for anyone on the default. `claude-opus` resolves to $4 (was $5) and `minimax-m3` to $0.30 (was $0.60). `gemini-1.5-pro` and `gemini-1.5-flash` are no longer priced — the vendor publishes no rate for them — and fall back to the default with the existing unknown-model notice. Token counts and reduction percentages are untouched; only the dollar conversion changed.

**Tags:** `src/config/models.js` · `models.roster` · `models.asOf` · `models.prices` · `models.charsPerToken` · `tierInfo` · `contextLimit` · `tokenBasis` · `doctor` model-profile check · `model-profile.test.js` · `#865` · `#688` · `#778` · `PR #866`

**Impact:** every model name `--suggest-tool` prints is now a key `gain --model` accepts, and every output that shows a model or a price shows the date it was true. The `gain` default rate went from $3 to $2 per MTok, so estimated dollars saved read a third lower on the default model; token counts and reduction percentages did not change. No published metric moved — a fresh `benchmark:all` reproduces 95.8% / 78.6% / 43.4%, 88.0% vs 40.0% and 98.0% test-discovery F1 exactly. `hard` hit@5 reads 74.4% against a 73.3% control: one task (h027) moved from rank 6 to rank 5 with the ranker untouched, and `hard` MRR reads 0.577 against 0.578. The quality benchmark's own Sonnet rate ($3.00) was not re-priced and is now flagged on its page. 23 new guards; 207 integration suites + 28 fixture tests passing.

---

### v8.62.2 — "tested" and "likely to change" now name their evidence ✓ (2026-10-04)

**Patch.** Two commands stated things about a repo that the code behind them could not support.

`sigmap --analyze` marked a file `✓ tested` when any entry directly under `test/` contained its basename as a substring. That is wrong in both directions: a test one directory down is invisible, and `fix` matches the directory `fixtures`. On this repo it reported **5 of 182** source files as tested.

`sigmap plan` filled **Likely to change** with the ranker's *medium* confidence band. By construction that band leaves out the high-confidence files — the ones the task names — and admits anything scoring a third of the top match. For "add a new secret detection pattern for Slack tokens" it listed a CI fixture YAML and not `src/security/patterns.js`.

The issue that reported the first problem ([#769](https://github.com/manojmallick/sigmap/issues/769)) proposed the fix as well: reuse `findRelatedTests`. That helper matches file-name stems, and none of the four files the issue lists shares a stem with its test:

| Source file | The test that exercises it | Shared stem? |
|---|---|---|
| `src/judge/judge-engine.js` | `test/integration/features/judge.test.js` | no |
| `src/config/loader.js` | `test/integration/config-loader.test.js` | no |
| `src/deps/inventory.js` | `test/integration/dependency-inventory.test.js` | no |
| `src/create/orchestrate.js` | `test/integration/create.test.js` | no |

What those four tests have in common is that they **load** the source file. So coverage now has two kinds of evidence: the naming rule, unchanged, and a load — a `require` / `import` that resolves to the file, or its path built with `path.join` / `path.resolve`. One index (`src/analysis/test-coverage.js`) serves both commands, so they can no longer disagree, and `plan` prints the test files beside each covered file.

Two refinements came from running it on this repo rather than on a fixture. The first version counted any path string, and the new test file was credited with covering real files it only named as keys of a fixture map — a mention is not a load. And two source files can share a stem (`security/patterns.js`, `extractors/patterns.js`): the naming rule gives `patterns.test.js` to both, so a same-named test now belongs to the file it loads.

`plan`'s change list is now the `high` band, implementation files only, and every entry carries its score relative to the top match and the task words its path and signatures carry:

```
 Likely to change (high-confidence implementation files · score vs top match · why):
   1. src/security/patterns.js    1.00  "secret" in signatures; "detection" in signatures; "pattern" in path and signatures
   2. src/extractors/patterns.js  0.84  "detection" in signatures; "pattern" in path and signatures
```

A third finding was about this project's own benchmark. A module's leading comment is indexed as prose, and the new module's first header — a paragraph of history — put it in the top three for three unrelated `hard` queries, one of which slipped from rank 5 to 6. The header now states purpose only, and the module changes the first-hit rank of no `hard` task.

"Untested" still means *no test file names or loads the file*. A module exercised only through the CLI is not detected — 45 files here, mostly extractors loaded by name — and the label was not changed.

**Tags:** `src/analysis/test-coverage.js` · `relatedTestsIndex` · `src/plan/planner.js` · `likelyToChangeEvidence` · `relatedTests` · `src/eval/analyzer.js` · `plan-analyze-evidence.test.js` · `#862` · `#769` · `#774` · `PR #863`

**Impact:** `--analyze` on this repo: 5 → 137 of 182 files marked tested, each traceable to a test that names or loads it. `plan` no longer lists tests, fixtures or CI under "Likely to change" unless the task asks for them. No published metric moved — a fresh `benchmark:all` reproduces 95.8% / 78.6% / 43.4%, 88.0% vs 40.0% and 98.0% test-discovery F1 exactly, and every gated retrieval corpus holds its hit@5. `hard` MRR reads 0.578 against a 0.584 control: one task (h034) moved from rank 1 to rank 2. 22 new guards; 206 integration suites + 28 fixture tests passing.

---

### v8.62.1 — a crash report that named one frame out of five ✓ (2026-10-04)

**Patch.** SigMap died with `RangeError: Maximum call stack size exceeded` on any tree past roughly 125,000 files. The report ([#855](https://github.com/manojmallick/sigmap/issues/855), from [@sidhunt](https://github.com/sidhunt)) came from a repo whose git root is the home directory, and it named the frame exactly: `buildFileList`, at `files.push(...found)`.

The cause is one line of JavaScript semantics. `fn(...array)` passes every element as a separate call argument, and V8 stops at roughly 125,000 of them. Any spread over an array that holds one entry **per file** is therefore a crash waiting for a large enough tree — and nothing fails below that size, which is why every benchmark repo and every test passed.

Fixing the reported frame was two lines, and it was not the fix. With generation working on a real 130,000-file tree, the next command run there — `sigmap ask` — died with the same error, in the ranker:

| Where | The spread | Reached by |
|---|---|---|
| `buildFileList` (CLI core) | `files.push(...found)` | every generate run — the reported frame |
| `src/graph/builder.js` | `out.push(...walkDir())` | the dependency-graph walk |
| `src/retrieval/ranker.js` | `Math.max(...scores)` / `Math.min(...scores)` | `ask`, `--query`, `plan` |
| `src/graph/centrality.js` | `Math.max(...ranks)` | centrality blend |
| `src/eval/analyzer.js` | `Math.max(4, ...lengths)` | `--analyze` |

Four of the five were found by running commands on the large tree rather than by reading the report. A fix scoped to the stack trace would have closed the issue and handed the reporter a second crash on their next command.

Each site is now a loop. The ranker is the one change that could have moved a number, so it was measured on its own: the retrieval gate scores identically with the original and the rewritten ranker over the same index.

The regression test does not create 150,000 files — that takes about ten seconds on macOS before the test has started. Its CLI case fakes one 150,000-entry directory through a `readdirSync` preload, and the other cases build their inputs in memory. Five of its six guards fail on v8.62.0.

One thing found on the same tree is **not** fixed: `sigmap evidence` did not finish within nine minutes on 130,000 files. That is slowness rather than a crash, and it is recorded here so this release does not read as "large trees are fine now".

**Tags:** `buildFileList` · `src/graph/builder.js` · `src/retrieval/ranker.js` · `src/graph/centrality.js` · `src/eval/analyzer.js` · `large-tree-spread.test.js` · `#855` · `PR #860`

**Impact:** generation and 24 other commands run on a real 130,000-file tree without a stack overflow (generation in about 16 seconds, with real signatures in every file). No published metric moved — a fresh `benchmark:all` reproduces 95.8% / 78.6% / 43.4%, 88.0% vs 40.0% and 98.0% test-discovery F1 exactly, and every gated retrieval corpus holds its hit@5. `hard` MRR reads 0.584 against 0.578 at v8.62.0; with the ranker ruled out, that is the indexed file set. 6 new guards; 205 integration suites + 28 fixture tests passing.

---

### v8.62.0 — two new Tier 2 languages, and a fixture that proved less than it looked ✓ (2026-10-03)

**Minor.** Objective-C and PowerShell move to Tier 2, both contributed by [@sujalmallick](https://github.com/sujalmallick). The PowerShell extractor (#840) covers `function` / `filter` / `workflow` with clean parameter names, `[CmdletBinding()]`, `.SYNOPSIS` doc hints, PS5 classes and `.psd1` manifests; its code is in the v8.61.3 package, and this is the release that records it. The Objective-C extractor (#841) covers `@interface` / `@implementation` / `@protocol`, categories, `@property`, multi-part selectors with balanced block types, C functions and `NS_ENUM` / `NS_OPTIONS`.

Two design decisions in the Objective-C work are worth keeping. `.m` is also MATLAB, so a `.m` file with no Objective-C marker goes to the generic extractor rather than producing Objective-C-shaped guesses. And `.h` stays mapped to C/C++: the C++ extractor sniffs for Objective-C and delegates, so no header becomes unreachable by being reassigned.

The extractor arrived green — fixture byte-exact, 15 tests passing, CI clean on three Node versions. It was then run over **839 real `.m` / `.mm` files** (a React Native dependency tree), and about 11% of what it emitted was not a declaration:

| Input | What was emitted |
|---|---|
| `@protocol FooDelegate;` (forward declaration) | a container that ran to the **next** `@end` and duplicated that container's members |
| `return CGRectMake(0, 0, w, h);` in a body | a C function named `return CGRectMake` — 335 of these |
| `kNone = -1;`, `a - b` inside `@implementation` | methods `- 1` and `- b` — 805 of these |
| a method body over 4KB | a one-line anchor, then every `-` in that body as a method, filling the 120-member cap |

The fixture could not have found any of them. It contains no forward declaration, no `return f(...)`, no subtraction, and no long method — it is a tidy file written to be parsed. One cause sits under all four: the scan looked for declarations in text that includes bodies. Members and C functions are now matched on a top-level surface where the interior of every brace block is blank.

The first version of that fix was wrong, and the same corpus caught it. Counting braces loses track at an `#if` / `#else` pair where each branch opens its own `if (...) {` for one shared `}` — real code in `react-native-gesture-handler` — and every method after that point vanished: 47 real methods lost, where the broken original had found them. Depth now restarts each branch from the depth at the `#if`, skips macro bodies, and resyncs at every container keyword and column-0 method head, so whatever imbalance is left costs one method its end line rather than the rest of the class.

| Same 839 files | Before | After |
|---|---|---|
| Fake methods | 805 | 0 |
| Fake C functions | 335 | 0 |
| Containers | 1,292 | 1,292 |
| Real methods newly found | | 606 |
| Methods re-anchored to their true end line | | 97 |
| Real methods lost | | 0 |

The 606 are the larger result. The noise was not only extra lines: a long method spilling its body into the member list pushed real methods past the cap, so removing the fake ones is what let the real ones in.

Two regressions against the existing C++ extractor were closed on the way: a C++ header that only *mentions* `@interface` in a comment was delegated and lost its class members, and a delegated header dropped its plain `struct`.

**Tags:** `src/extractors/objc.js` · `src/extractors/powershell.js` · `topLevelSurface` · `.h` delegation · MATLAB fallback · 38 languages · 52 extractors · `#841` · `#840` · `PR #850` · `PR #852` · `PR #857`

**Impact:** 38 languages / 52 extractor modules (was 37 / 51); Tier 2 is now 13 languages. On 839 real Objective-C files: 1,140 fake signatures → 0, 606 real methods newly found, none lost. No published metric moved — a fresh `benchmark:all` reproduces 95.8% / 78.6% / 43.4% and 88.0% vs 40.0% exactly, and every gated retrieval corpus holds its hit@5. 12 new regression tests (Objective-C suite 15 → 27); 204 integration suites + 28 fixture tests passing.

---

### v8.61.3 — a published number now says which release measured it ✓ (2026-10-03)

**Patch.** The release that shipped the day before is the evidence. v8.61.2 published this, stamped `sigmap-v8.61-main` and dated 2026-10-02:

```json
"test_discovery": { "repos": 28, "pairs": 3701, "f1": 0.98, "hit_at_1": 0.974 }
```

That block was measured on 2026-10-01, by a run nobody made during the release — `benchmark:test-discovery` was never invoked. `check:metrics` passed **four times** across that release without objecting, because it verifies `latest.json` against the *saved* reports and never that a saved report belongs to the release being stamped. The 98.0% F1 went onto the Stats line at the top of this page as current. #707's original instance was worse: a v8.49 snapshot carrying a test-discovery number measured at **v8.8.0**, 41 minor versions earlier.

Three structural causes, all live until now. No single target regenerated the five sources — `benchmark:matrix` produces four, while `benchmark:honest` and `benchmark:test-discovery` are separate `--save` scripts that no flow invoked, so running four of five looked exactly like running all five. Four of the five reports carried no version at all, so a version guard could not even be written against them. And `latest.json` misdeclared its own sources: the `source` string listed four reports while the generator read five, so the one field whose job was provenance had the wrong provenance.

The guard is scoped to the **minor** line, not the patch. `benchmark_id` is `sigmap-v8.61-main`, so a report measured at 8.61.0 legitimately belongs to the v8.61 snapshot, and a patch must not be forced to re-run every suite to ship. A *different* minor line is the defect. Within-line differences are not failures, so they are made **visible** rather than fatal: each source publishes the version and date it was measured on, and a figure carried forward can no longer pass as fresh.

`classifySources` separates two modes that are not the same failure. `drifted` says which release produced a report and it is the wrong one — hard failure, and this is #707. `unstamped` predates stamping, so provenance is genuinely unknown; it publishes as `version: null` and warns. Hard-failing that second case made `check:metrics` fail against the committed reports, which breaks CI and `prepublishOnly`, and the only escapes were a flag day requiring every suite to re-run before the guard could land, or hand-writing versions into legacy reports — fabricating the exact fact being recorded. The snapshot says "unknown" out loud instead, and the state clears itself the first time each suite runs.

The second half is #811. "95.8% token reduction — average across 21 real repos" measures the generated map against *every source file in the repository*, which reads as a per-call cost claim that an agent's context footprint does not support. Reworded in the generator rather than in prose, because a prose-only fix is reverted by the next `sync-metrics` run.

Two bugs in this change were found by testing it. `stamp()` set `generated` only when it was absent, so a *rewritten* report kept its old date — the precise confusion the module exists to remove. And computing the snapshot once, to stop a duplicated warning, dropped the `try/catch` the original `latestInSync` had, so a missing `latest.json` crashed with `ENOENT` instead of reporting "stale".

**Tags:** `scripts/lib/report-stamp.mjs` · `stamp()` · `provenanceOf` · `classifySources` · `minorLine` · `latest.json` `sources` block · `npm run benchmark:all` · `metric-provenance.test.js` · `#854` · `#707` · `#811` · `PR #856`

---

### v8.61.2 — one canonical source, and the gate that was passing on 241% ✓ (2026-10-02)

**Patch.** One defect class at four surfaces: a canonical fact kept in a hand-maintained second copy, with nothing failing when the copies diverged.

The sharpest instance was a release gate. `--ci` computed `index.size / fileList.length`, which is not a ratio — the persisted index deliberately holds more than the current config scopes (declared entrypoints, test roots, CI definitions, files a `srcDirs` change dropped), so the quotient runs past 100%. It reported **241% coverage** on this repo, and a gate set to `--min-coverage 200` would have passed. `validate` had the identical formula and reported 218%; #770 fixed it **there**, and the comment it left behind explaining why the old form *"stopped meaning anything"* sat three screens above a surface still using it. Fixing one copy of a formula is not fixing the formula. `validate` also kept its own `Math.round((covered / total) * 100) : 0`, which agreed with the shared primitive on every populated repo and read **0%** where the other three read **100%** on an empty one — one repo making two contradictory statements about whether anything was left uncovered.

The same class at the CLI surface is #817. `--help` was a 113-line template literal maintained by hand beside the `KNOWN_COMMANDS` set the dispatcher guards on, under a comment already asserting that help *"renders from the same vocabulary"*. v8.61.1 judged this half *"a 136-line rewrite of a literal that is currently correct, with regression risk and no defect to fix"*. The literal was not currently correct: writing it out as a table surfaced a description one column off (which `llms.txt` carried too), a literal `%%` left from a `printf` escape a template literal never needed, an adapter list a release behind `packages/adapters/` (missing `willow`), and `--ci` itself — dispatchable, documented on the CLI page, absent from `--help` entirely.

The guards are structural rather than numeric, because a numeric check passes whenever today's two copies happen to agree. The coverage ratio and the reduction average may each be defined in exactly one place; the table and the dispatch chain must agree in **both** directions; and every flag advertised under a command must be read by that command, which is #775's class.

Adding one module then failed `validate:retrieval` while touching no ranker code, and the gate was right that something moved and wrong about what. `GRAPH_BOOST_AMOUNTS.hop1` (0.40) is added once per importing seed, so a shared utility with 23 scoring importers collected 23 × 0.40 = **9.2** — `bm25 0`, every match signal `0` — and ranked 3rd for a query it shares no token with, displacing the correct answer, whose own score had not changed at all. What normally hid that is `_computeHubs`, which suppresses any file with `>= ceil(fileCount * 0.2)` importers: the utility has **exactly 36**, so it was suppressed at 180 graph nodes and not at 181. A 9.2-point phantom was gated on a `Math.ceil` step that any single added file can cross. Lifting a zero-score *direct* neighbour is deliberate — it is how a file that implements what a matching file calls gets found, pinned by #596 — so the rule is one free bonus, with accumulation gated on a real match. Two blunter variants were measured, rejected, and recorded in the test so they are not re-attempted.

**Tags:** `src/cli/command-table.js` · `coveragePct` · `indexedCoverage` · `--ci` labelled `indexed` · `--ci --json` in `--help` · `hop1Matched` · `command-table.test.js` · `shared-definitions.test.js` · `graph-boost-relevance.test.js` · `#848` · `#817` · `#818` · `#851` · `PR #849`

**Impact:** a CI gate can no longer pass on an impossible percentage, and a threshold above 100 can no longer be satisfied · `validate` and `--ci` report one figure from one function · `--help` is generated, so a new command cannot be absent from it · 25 structural drift assertions plus 6 ranker assertions, each mutation-tested · the ranker fix recovers `mined` hit@5 56.5% → 60.9% on this tree (MRR 0.380 → 0.389, `jvm` MRR 0.192 → 0.195, `easy` unchanged, `hard` MRR −0.002), returning every gated corpus to its v8.61.1 value · 201 integration files, 0 failed · 0 npm deps

---

### v8.61.1 — the documented contract was partly fiction ✓ (2026-10-02)

**Patch.** `cli.md` had described `ask --json` since before v8.54.2 as *"a machine-readable object with `intent`, `coverage`, `cost`, `riskLevel`, and `rankedFiles`"*. Two of those five keys did not exist. `rankedFiles` was **never implemented** — and no surface emits that name, the nearest being `--query --json`, which calls its array `results`. There is no `cost` key either; the figure ships as `costBefore`/`costAfter`/`savingsPct`, because a saving needs both sides of the comparison to mean anything. A consumer written against the documented contract got `undefined` twice.

It also left `ask` as the one command whose ranked selection could not be read back out of its own JSON: `selectedFiles` is a count, `contextPath` is a file to re-parse, so an agent that wanted the files and their scores had to issue a second query against the index it had just ranked. `rankedFiles` now ships as `[{ rank, file, score, tokens }]` in rank order — the same per-result shape `--query --json` uses, minus `sigs`, which the same run has already written to the context file. Scores are rounded exactly as `cutoffScore` is, so the last row's score **is** the cutoff rather than a near-miss differing in the fourth decimal; two roundings of one number is the defect this project keeps closing, so the agreement is asserted rather than assumed.

The wider gap was that nothing pinned output keys at all. #661 guards that every dispatchable *command* appears in `--help` and #817 asks for the same at *flag* level, but a key documented and never emitted could survive release after release — and v8.61.0 had just added fourteen keys to this exact surface. The new guard reads the documented list **out of `cli.md`** rather than restating it, because a hand-kept copy in the test would be a third place to drift, which is the defect and not the fix. The other two documented contracts were checked and found exact — `--callers` 9/9 keys, `judge` 4/4 — so `ask` was the only breach; both are pinned anyway, since the point is the class.

**Tags:** `ask --json rankedFiles` · `[{rank, file, score, tokens}]` · `costBefore`/`costAfter`/`savingsPct` · `json-key-contract.test.js` · documented-key guard · `#845` · `#662` · `PR #846`

**Impact:** an agent reads the ranked selection from the same call that produced it · no documented `--json` key can go unemitted unnoticed on `ask`, `--callers` or `judge` · every pre-existing key unchanged, asserted against the full v8.61.0 list · 6 of 11 new tests fail against the pre-fix binary, and a negative case proves the guard has teeth · 198 integration + 26 unit, 0 failed · no measured number changes · 0 npm deps

---

### v8.61.0 — close the loop at the agent ✓ (2026-10-02)

**Minor release, fourth of ladder R2.** Three defects on **one surface** — `ask`, the command the product is actually used through — so they shipped as one change. Two belong to R2's own theme; the third closes the gap between what the map saves and what the agent then spends.

`ask` emitted **signatures only**. An agent that needed a body opened the whole file, which is precisely the cost the map exists to avoid: the saving was real at the map level and partly handed back one level down. The `:start-end` anchors every extractor already emits were enough to close that loop, and `--with-source` now slices the top symbols' lines instead of the files holding them, with the blast radius attached so the agent sees what else a change there touches without a second query. Breadth before depth — three symbols per file, files in rank order — so one long member list cannot eat the budget; an export list never takes a slot because it is already in the signature section verbatim; and a body that does not fit is skipped **whole** with the omission disclosed, because half a function is not a cheaper answer. It is strictly opt-in, and a test asserts the default context stays prefix-identical.

`judge` has warned since v8.54.2 when the context it scores against is older than the sources it describes. `ask`, `read_context`, `search_signatures` and `query_context` answered from that same ground **in silence**, so a stale answer was byte-indistinguishable from a fresh one. Rather than a second rule, all four now call the shared module: the threshold and the gap wording live in one place and only the consequence clause varies by surface, because what a stale index does to a *verdict* is not what it does to a *ranking*. `judge`'s own line is byte-identical to what shipped in #780.

The third is the sharpest. On a fresh `gin` clone `ask` printed **`Coverage : 100%`** and **`Risk : NONE`** over five selected files that were a test, a README, a CI workflow and two unrelated sources — with none of `gin.go`, `routergroup.go` or `tree.go` among them. Neither reading was a lie alone: the coverage figure is fed every file the scan found, so it reports how much of `srcDirs` is **readable** (100% in any healthy repo, whatever the query returned), and the risk figure counts changed files, legitimately zero on a clean checkout. Printed bare, side by side, directly under the answer, they read as *"this answer is trustworthy"*. Each figure now names what it counted, `Risk` reads `not assessed` when the probe could not run instead of printing a reassuring level anyway, and a new `Selection` line names what neither figure ever asked — how much of the selection is implementation at all.

**Tags:** `ask --with-source` · `ask --source-budget` · `src/retrieval/with-source.js` · `src/retrieval/selection-quality.js` · `STALE_TAILS` · `classifySelection()` · `Selection : 2 source, 3 support (test, docs, ci)` · `readable 100% (179/179 files in srcDirs)` · `not assessed` · `#835` · `#814` · `#815` · `#806` · `PR #836`

**Impact:** an agent can read a symbol's body without opening its file · no retrieval surface answers from a stale index silently · no figure in `ask` output is a bare number · 19 tests · 197 integration + 26 unit, 0 failed · **SigMap's own measured figures are unchanged** (88.0% hit@5, MRR 0.730) — the published lift moved 2.16× → 2.20× only because the grep baseline fell 40.8% → 40.0% on the self-repo task set, which drifts by design as this repo gains files · 0 npm deps

---

### v8.60.0 — say what was actually searched ✓ (2026-10-01)

**Minor release, third of ladder R2.** Two commands reported a narrower scope than they claimed, and neither said so. R2's theme is one definition per number; this is its sibling — every claim names its basis.

`--diff <ref>` ran `git diff <ref>..HEAD` — ref vs **HEAD**, which excludes the working tree — while the flag was documented as "changes since `<ref>`". A developer with local edits got a diff that omitted exactly the files they were editing: on a fixture holding one committed and one uncommitted change it reported a single file. The ref form is now `git diff <ref>`, so the phrase means what it says. The same wrong range existed **twice** — in the CLI and in the `get_diff_context` MCP tool — so one helper now owns all three ranges and the two surfaces cannot disagree about what "since `<ref>`" means.

`--callers` printed `zero method blast radius` for symbols that are demonstrably called. Two systematic blind spots, neither of which is "no callers exist": the call graph walks `srcDirs` only, so a repo's root-level CLI entry point — the largest caller of every module beneath it — contributes no edges at all; and the bundle-safe `requireSourceOrBundled('./src/…')` wrapper is a module load the resolver cannot follow. It could not distinguish *no caller exists* from *no edge was found*, and that is precisely the claim a developer leans on before deleting or changing a signature. Every result now names the scope it searched and counts what it could not follow — in the human output, in `--json`, and for `--callees` on the same reasoning. `--impact` already labelled itself a lower bound; this brings the stronger claim into line.

Bare `--diff` and `--diff --staged` were always correct and are byte-identical, asserted by a regression test that passes on **both sides** of the change — which is what makes it a guard rather than a dead test. The fix also removed a direct `child_process` call from the CLI, since the old code carried its own inline `execFileSync` instead of routing through `src/util/git.js`.

**Tags:** `changedFiles()` · `REF_RE` · `git diff <ref>` · `get_diff_context` parity · `_scopeClause` · `scope.dynamicLoads` · `lowerBound: true` · `zero method blast radius` removed · `#831` · `#667` · `#768` · `PR #832`

**Impact:** `--diff <ref>` returns the files you are actually editing · CLI and MCP answer the same question identically · no `--callers`/`--callees` output or JSON asserts a zero it cannot support · one fewer direct `child_process` call in the published surface · 14 tests, 13 failing against v8.59.0 plus one deliberate regression guard · 196 integration + 26 unit, 0 failed · no measured number changes · 0 npm deps

---

### v8.59.0 — the dashboard owns neither its path nor its language list ✓ (2026-10-01)

**Minor release, second of ladder R2.** Two defects in the same command, so they shipped as one change.

`--dashboard` wrote into `benchmarks/reports/` — a directory SigMap does not own. In a consumer repo that path either does not exist, so SigMap created it, or it means something else entirely; either way the file landed outside the `.context/` line `--init` adds to `.gitignore`. It now writes `.context/dashboard.html`, with `--out <path>` for an explicit destination. An audit of the published surface confirmed this was the **only** hardcoded write outside `.context/`: every other `benchmarks/` reference is an optional read with a graceful fallback, so nothing else needed moving.

The coverage panel graded against a hardcoded 21-entry `LANGUAGE_KEYS` while the project ships **36** languages, so a repo written in Elixir, Lua, R, GDScript, Astro, TOML, Terraform, GraphQL or Protobuf read as uncovered. The denominator was only half of it, and this is the half the issue did not capture: detection was a **second** extension map covering the same 21 languages, so the numerator could never reach a widened denominator. Raising `supported` from 21 to 36 on its own would have moved this repo from 2/21 to 2/36 — making the published figure *worse*. Both sides now come from `src/extractors/dispatch.js`.

Its new `LANGUAGES` export is derived from `EXT_MAP`'s values plus the two languages `langFor` routes by *filename* rather than extension, reproducing `deriveLanguages()` byte-identically — the list `version.json` publishes and `check-doc-counts` gates. The v8.27 note warning that folding these maps together "would miscount languages" no longer applies: the canonical count already treats `typescript_react` as its own entry, so matching dispatch agrees with the gated figure rather than diverging from it.

A third copy fell out with it. The chart plotted a fixed 21 bars against a positionally-aligned list of 21 label abbreviations; charting all 36 would put 20px between labels and most are zero in any one repo, so it now plots the languages actually present, busiest first.

**Tags:** `.context/dashboard.html` · `--dashboard --out` · `dispatch.LANGUAGES` · `langFor` detection · `LANGUAGE_KEYS` removed · present-languages chart · `#828` · `#782` · `#663` · `PR #829`

**Impact:** `--dashboard` no longer creates a directory SigMap does not own · coverage denominator 21 → **36**, tied structurally to both `dispatch.LANGUAGES` and `version.json.languages` · a repo in Elixir/Lua/R/Terraform moves **0/21 → 4/36** · three copies of the language set reduced to one · 11 tests, 5 structural, all failing against v8.58.0 · 195 integration + 26 unit, 0 failed · no measured number changes · 0 npm deps

---

### v8.58.0 — one definition per number ✓ (2026-10-01)

**Minor release opening ladder R2, "one definition per number, pinned structurally."** `validate`, `doctor` and `status` each held a private definition of what the signature index contains and when it was last built, so on a **healthy** index all three contradicted each other: `266 stale entries`, `447 file(s) indexed · index is up to date`, and `Last index: never`. Two open issues, one root cause.

`generate` writes the index over an **augmented** population — the configured `srcDirs` walk, widened by the declared `package.json` entrypoints, every test root and every CI definition. All three widenings are deliberate: they are how `ask` reaches code that lives outside `srcDirs` *by construction*, such as `.github/workflows/`, a root dotdir no source-root detector will ever select. `validate` measured that same index against the **un-widened** list, so every widened entry read as stale. On this repo the 266 decomposed exactly — 256 under `test/`, 10 under `.github/`, **zero** actually stale — followed by advice to re-run `sigmap`, which could not change a number that was never wrong.

Two real bugs hid behind that false alarm, and both are fixed. `saveCache()` wrote the cache map back **whole** and never pruned it, and the ranker merges that cache into the retrieval index, so a genuinely **deleted** file did survive the full run `validate` prescribed — the half that made the remediation text literally unactionable. And `status` derived freshness solely from the usage log, which exists only under `--track`, so with tracking off — the default — it reported `never` about the index `doctor` was calling up to date in the same repo.

`src/analysis/index-state.js` now owns both definitions, and exports the collector roots `generate` itself imports, so the collector and the classifier cannot drift. Stale is only what the classifier cannot justify, split into the two classes that have different remedies: a deleted file is cleared by a full run, a file that merely left `srcDirs` is a config question. **Index size does not move** — this is a population widening, not a prune, which is the point: the classifier reads the entries the index already holds rather than re-walking the tree.

Four of the fourteen new tests are **structural**, per R2's exit criteria — they pin the single definition rather than a number: the collectors import the exported constants and do not redeclare them, all three surfaces consume the primitive, and `doctor` keeps no private walker. All fourteen fail against v8.57.0.

**Tags:** `src/analysis/index-state.js` · `classifyIndexEntries` · `indexFreshness` · `changedSince` · `staleRemedies` · `TEST_ROOTS`/`CI_DIRS` · `sig-cache.pruneMissing` · `validate --json` `augmentedEntries`/`missingEntries`/`outOfScopeEntries` · `status --json` `indexSource` · `#825` · `#770` · `#664` · `PR #826`

**Impact:** `validate` 266 stale → **0**, with `268 beyond srcDirs (256 test, 10 CI, 2 entrypoint)` named instead of miscounted · `doctor` `447 file(s) indexed` → `179 in-scope · 268 beyond srcDirs`, and it no longer calls a stale index up to date · `status` `never` → the index's own timestamp, source disclosed, agreeing with `doctor` on changed-since · a deleted file is pruned by the run that was already being advised · 14 tests, 4 structural · 194 integration + 26 unit, 0 failed · no measured number changes · 0 npm deps

---

### v8.57.0 — a guard that verifies nothing is not a guard ✓ (2026-10-01)

**Minor release closing the last two open items of ladder R1.** Both defects sit in the same four-stage `create` pipeline, and together they meant the grounded-creation loop could neither fail honestly nor succeed at the thing it exists for.

`create` exited **0** having run none of its four guard stages. `ok` was `failed === 0` — vacuously true over an empty set — so `0/4 ran · 0 passed · 0 failed · 4 skipped` reported success, and a CI step that shelled out to `create` read a pass from a run that verified nothing. It now exits **2**, the "nothing to do" code, reusing `judge`'s existing inconclusive convention rather than inventing a third one; `1` still means *a stage ran and failed*, so a gate can finally tell a clean run from an empty one. Each stage carries the input it needs, printed when nothing ran, because a non-zero exit that does not say what was missing only moves the problem.

The second defect made the happy path unreachable. Stage 2 checked every name in a plan for *existence*, so `create "add a helper to format dates"` → the plan names `formatDate` → stage 2 errored on code that, by construction, does not exist yet. A plan has **two kinds of name** in it, and checking them identically is the bug: references must exist, introductions must not. A `Creates:` section marks the latter, verified in **reverse** — which both unblocks the path and adds a redefinition guard that did not previously exist, since a plan claiming to create something already in the repo is now an error.

Three ways in, one semantic: the plan's own section, `--creates` for plans carrying none, and — inside `create` — the scaffold stage's proposed filenames handed to stage 2 automatically, so the pipeline stops rejecting the file it just designed. The label is deliberately strict, a heading or a colon, so prose like `Creates a new helper for dates.` does not silently adopt the bullets beneath it as introductions.

With neither section nor flag present nothing changes: every name is a reference and standalone `verify-plan` is as strict as before — asserted by a test that runs the **same plan both ways** rather than by inspection.

**Tags:** `summary.nothingRan` · exit code 2 · `STAGE_NEEDS` · `Creates:` plan section · introductions-verified-in-reverse · `redefines-existing` · `verify-plan --creates` · scaffold→stage-2 allowlist · `#767` · `#666` · `PR #823`

**Impact:** a CI step can no longer read success from a `create` run that checked nothing · the grounded-creation pipeline's primary use case is reachable pre-implementation for the first time · a redefinition guard that did not exist before · 41 tests across the two suites (19 `create`, 22 `verify-plan`) · no measured number changes · 0 npm deps

---

### v8.56.0 — knowing the shape of the repo ✓ (2026-10-01)

**Minor release closing the project-shape cluster.** Two defects of the same class: SigMap's model of the project was wrong, and nothing said so.

The repo root was **never a candidate** source root. Candidate enumeration only ever walked directories, so on a flat layout — the normal shape of a Go module — `.` could not be selected however much source sat there. A fresh `gin` clone detected `["internal","binding","render","codec","ginS","testdata"]` and left `gin.go`, `routergroup.go`, `context.go` and `tree.go` invisible, having preferred `testdata`, a fixture directory the go tool ignores outright. On a reduced 13-file fixture, two files were scanned.

Two **structural** signals now qualify the root, and both were chosen by measurement rather than by tuning a ratio: a `go.mod` carrying root-level `.go` files — a Go module root *is* a package, which is the toolchain's own model — and, generically, a root holding at least 20% of the tree's code. Across all 43 cached benchmark repos these select exactly the four Go modules (`cobra`, `echo`, `gin`, `gorm`) and change nothing else; every non-Go repo has **zero** root-level `.go` files and sits at or below 4% share. `gorm` is at 10%, which is precisely why the `go.mod` rule had to be structural: no share threshold that catches it stays safe.

The second half is disclosure. A coverage figure computed over `srcDirs` cannot see a file the detector never selected, which is how the broken case reported a comfortable *"indexed 67% (2/3 files)"* while ten of thirteen files were missing — the number was not wrong about its own population; nothing said the population was wrong. `validate` and `doctor` now report implementation files outside `srcDirs`. It is graded on **share, not raw count**, recorded because the first implementation warned about 297 files on this repo, where `test/`, `scripts/` and `benchmarks/` are deliberately out of scope: a check that fires on a correct configuration teaches the user to ignore it.

Separately, the monorepo verdict had **three** detectors that disagreed. The marker-based pair answered *no* while the layout scan found two packages, so `roots` and `tune` reported no monorepo while `--monorepo` processed `packages/core` and `packages/cli`, and `tune` never proposed `monorepo: true` for a layout the mode supports. One detector answers it now and names whether the evidence is a declared workspace or the layout, because collapsing those into a bare boolean is what let the disagreement hide.

One defect was introduced and fixed inside the same change, recorded rather than quietly dropped: the new disclosure walked 53,013 files here, 47,327 of them inside `benchmarks/repos/` — 43 cloned repositories whose files could never be the user's source. Both new walks stop at any directory holding a `.git` entry, which also covers submodules and vendored checkouts the exclude list does not name. Same answer, 232ms → 111ms.

**Tags:** `src/discovery/monorepo.js` · root-as-source-root · `go.mod` structural rule · `outsideSrcDirs` · share-graded disclosure · `testdata` penalty · nested-repo walk guard · `#805` · `#781` · `PR #821`

**Impact:** a flat Go repo indexes its own source for the first time (2 → 13 files on the fixture; `explain gin.go` EXCLUDED → INCLUDED) · a wrong `srcDirs` is visible instead of hidden behind a plausible percentage · one monorepo verdict replaces three · 23 new tests (193 integration, was 192) · 0 npm deps

---

### v8.55.0 — a rank is a claim of relevance ✓ (2026-09-30)

**Minor release closing the retrieval-honesty cluster.** Three defects shared one cause, and it was not a ranking-theory mistake: the ranker kept its **own, strictly weaker copy** of the file-category predicates that the token-budget drop order already had right. `_computePenalty` recognised only `foo.test.js` and a `test/` path segment, so Go's `routes_test.go`, Python's `test_foo.py`, Rust's `foo_test.rs` and the JVM's `FooTest.java` were never penalised at all; a root `README.md` matched no docs *directory* segment; and CI files had no category whatsoever. The correct patterns had existed since #592 — the two subsystems simply never shared them.

Asked *"how does gin route requests through its middleware chain?"*, SigMap answered with `middleware_test.go` at rank 3 and `README.md` at rank 4, both at `penalty=1.00`, pushing `routergroup.go` out of the top 5 entirely. `src/util/file-class.js` is now the single source of truth for both subsystems, with two categories the ranker never had — mocks/fixtures and CI definitions — and the budget order delegates to it, so they cannot diverge again.

The same command also presented files scoring **exactly 0.00** as ranked results: `rank()` ended in a bare `slice(0, topK)` with no floor, so four `.github/workflows/*.yml` filled ranks 3–6 of a routing query. A rank is a claim of relevance and `0.00` is the absence of one, so zero-score rows are dropped and a query matching nothing says so. Separately, a token equal to the project name lifted files on their path alone — "gin" matching `ginS/gins.go` and `gin.yml` — so path matches are now scaled by the token's IDF across indexed paths, the intuition BM25 already applied to signature tokens.

`ask --explain` and `--query --explain` make a miss legible: which query tokens matched nothing, every signal behind each selected file, **why** a file was demoted, and the near misses below the cutoff. It earned its place immediately by finding a fourth bug — the stemmer folded `users` to `user`, stripped `-er` to `us`, tripped its own three-character minimum and reverted to the **raw input**, so `users` and `user` never unified and `ask "where do users log in"` matched nothing. That query's test had been passing on zero-score padding happening to sort the right file first.

Two things are recorded because they were settled by measurement rather than argument. `symbolMatch` rises above `pathMatch` (0.9 against 0.8) so defining a thing beats mentioning it — but `pathMatch` deliberately **stays** at 0.8, because cutting it as well as applying IDF double-suppressed the signal and cost 4.5pp of hit@5. And the release was verified against a **pristine `develop` worktree as the control**, not the stored baseline: `hard` measured 72.2% both with and without the change, while the committed baseline claims 75.6% — drift that predates this work and is disclosed rather than silently re-recorded, because `hard` scores SigMap against its own repository.

**Tags:** `src/util/file-class.js` · `ask --explain` · zero-score suppression · path IDF · `symbolMatch > pathMatch` · `includeZeroScore` · plural stemming · `#807` · `#808` · `#813` · `PR #819`

**Impact:** implementation outranks its own tests, CI and docs on "how does" questions · zero-score filler gone · one shared file-category definition replaces two divergent copies · a miss is now diagnosable · **jvm retrieval 21.3% → 29.5% (+8.2pp)**, hard and mined unchanged · 28 new tests (198 integration, was 191) · 0 npm deps

---

### v8.54.2 — honouring what the user said ✓ (2026-09-30)

**Patch release closing the discarded-input cluster.** Three commands took input from the user and silently did not use it. None of them announced it, which is the *silent wrongness* class the roadmap ranks first: a wrong answer delivered confidently costs more than a missing feature.

`ask --top <n>` was documented in `--help` and parsed correctly by `--query` and `evidence`, while `ask` itself hardcoded `topK: 5`. `--top 2` and `--top 20` produced context files that differed only in their `Generated:` timestamp. It is now honoured, and an invalid value errors rather than quietly falling back — doing something other than what the flag said is the defect. `ask` also stopped being unauditable: it now reports the selected file count, the score at the cutoff, and a sha256 of the emitted context, so a result can be reproduced from its own output.

A pinned `maxTokens` was replaced by auto-scaling with the explanation printed only inside the `--report` renderer, so on a default run the user's `500` simply vanished. Reproducing that turned up a second defect pointing the other way: with nothing pinned at all, `--report` still announced *"your maxTokens:6000 config was overridden"* — `6000` being SigMap's own default. The check compared the merged value, and the loader recorded no provenance, so "the user set this" was unknowable. `loadConfig` now records which keys the project actually set, and the notice prints on every path while speaking only about a pinned value.

`sigmap note` was write-only. Every reader in the shipped tree was `note` listing its own notes, `status` counting them, or the `read_memory` MCP tool — never `ask`, the ranker, `plan` or `evidence`. A note naming a file had no effect on a query about exactly that file, which is the one thing a decision log is for. Relevant notes now boost the files they name and render into the emitted context under `## Notes`, gated so they never leak into unrelated queries and inert when no notes exist.

Two design points were settled by measurement rather than intuition, and are recorded because both alternatives look reasonable on paper. The note boost is **additive and scaled to the query's own top score**: a multiplier cannot lift a zero-scoring file, and zero is precisely when a note is most valuable — the ranker found no lexical overlap and a human already knew the answer — while a fixed constant fails differently, since scores span roughly 4–30 across queries. And `rank()` slices to `topK` before returning, so boosting its result could never lift a noted file *into* the selection; `ask` ranks a wider pool first, boosts, then slices.

The ranking core is untouched: the boost is reachable only from the `ask` handler, never from `rank()` or any benchmark script, and `validate:retrieval` passed with **mined +0.0pp** — the corpus nobody tuned against.

**Tags:** `ask --top`, context hash, cutoff score, `maxTokens` provenance, `_userKeys`, `note-relevance.js`, additive note boost, discarded-input cluster

**Impact:** a documented flag stops lying · a pinned budget announces itself (and stops claiming defaults as "your config") · notes become a retrieval signal · 20 new tests (191 integration, was 190) · retrieval gate mined +0.0pp · 0 npm deps

---

### v8.54.1 — the guards were wrong in both directions ✓ (2026-09-30)

**Patch release closing the guard-command cluster.** `redact` exists so secrets never reach an AI context file. `verify` exists to flag hallucinations. One was letting real secrets through and the other was inventing hallucinations that were not there — and the command that would have caught either had no test file.

`redact` missed five of seven credential shapes, and the cause was a single character: `sk_live_`/`sk_test_` (Stripe) uses an **underscore**, while OpenAI and Anthropic use a **hyphen**, so `sk-` was never covered. Slack tokens, Slack webhooks, OpenAI project and legacy keys and Anthropic keys now redact — the three most common modern API-key formats in an AI-tooling repo, previously passing straight through. The new patterns are `\b`-anchored so `sk-` cannot match inside an ordinary word like `risk-`.

`verify` reported `structuredClone()` — a Node and browser global since Node 17 — as fabricated, at **`high` confidence**. The allowlist was a hand-maintained inline literal that stopped at `encodeURIComponent`. Globals moved to `src/verify/globals.js` as grouped data: 184 names across ECMAScript, Web/Node platform, Node module scope, test-runner and Python built-ins.

Worse than the false positives were the suggested corrections. The closest-match pool was the entire signature index, so `structuredClone()` was answered with `structuralFixture()` from a test file and `debounce()` with `resource()` from `test/fixtures/main.tf` — suggestions that would corrupt the answer they claim to fix. The pool now excludes test and fixture paths and languages whose top-level names are not callable; `CODE_EXTS` was deliberately not reused for this, since it contains `.tf`, `.sql`, `.graphql` and `.css`. A 0.34 similarity floor drops the rest, on the principle that no suggestion beats a wrong one — while `buildEvidencPack` → `buildEvidencePack()` and `scanx` → `scan()` still resolve.

`explain` reported a path with nothing at it as `EXCLUDED — no extractable signatures`, advising the reader to check the file for function definitions, at exit 0. It now reports `NOT FOUND` and exits 1 — the MCP `explain_file` handler had checked existence all along; only the CLI path had not.

Two findings are worth recording because they shaped the work. #785's *"5 of 11 redact patterns unasserted"* was already fixed — `redact.test.js` carries a table-driven `PATTERNS` gate, and that gate is precisely why the new patterns failed the suite until samples existed. And one acceptance criterion written for this release was wrong: *"the answer produces 0 findings"* cannot hold for a symbol from an undeclared library, because flagging it is the guard working. It was corrected on the issue rather than met by weakening the check.

**Tags:** `redact`, `verify`, `explain`, `globals.js`, closest-match pool, similarity floor, `sk-` family, guard-command cluster

**Impact:** redact patterns 11 → 16 · two false-positive classes closed in the flagship guard · `explain` gains a test file (and an exit-code fix) · 35 new tests (190 integration, was 189) · 0 npm deps

---

### v8.54.0 — the judge stops scoring English ✓ (2026-09-30)

**Minor release finishing the judge convergence.** `sigmap judge` was the last grounding surface whose *verdict* rested on raw English word-overlap, and four open issues turned out to be four symptoms of the same forty lines — so they landed together rather than re-deriving the `--learn` band four times.

The score now counts **technical** vocabulary, not English. `groundedness()` uses the ranker's own `tokenize()`/`stem()` from `src/retrieval/bm25.js`, so the judge and retrieval finally agree on what a token is: `buildEvidencePack` and `build evidence pack` — the same fact, written two ways — scored **0.750 and 0.333**, and now score identically. Ordinary-English vocabulary is dropped from both sides before scoring, so filler can neither inflate nor dilute a grounded answer: the reported prose case moves from **0.212 → fail** to **0.643 → pass** with every claim still `1/1 grounded`. The `learnBoostAbove`/`learnPenalizeBelow` defaults survived the rewrite unchanged — the same drift-guard confirms the 80%/30% mixtures still land either side of the band.

Hedging phrases became warnings. A fully-grounded answer used to fail, exit 1, *at `high` confidence*, solely because it contained the word "typically,". `GENERIC_MARKERS` moved out of `reasons[]` into a `warnings[]` that never flips the verdict, matched on word boundaries so `in general` stops firing inside `in general-purpose`. A warning now caps confidence below `high` — the judge cannot report high confidence in a result a stylistic signal had any part in.

"Nothing to judge" got its own verdict. An empty response file was scored as a genuine failure, handing CI the identical signal a confidently hallucinated answer produces. Empty input, an empty context, or a response with no scoreable tokens now verdicts `inconclusive` and exits **2**, naming the file; `--learn` never learns from it. `pass`=0 and `fail`=1 are untouched, so existing gates keep working.

The command also became usable. `--response` accepts `-` and a bare pipe, so a model's output no longer has to be written to disk first. `--context` is optional and resolves the context this repo already generated, naming which file it used. A new `src/judge/context-source.js` owns that resolution and a freshness check — a context older than its newest source now warns, naming the gap — mirroring the adapter-output list `doctor` already checks so both commands agree on what "the repo's generated context" means. And the per-claim table, which existed only in `--json`, now prints on `fail`/`inconclusive`, so a reader can see which claim broke without re-running the command.

**Tags:** `judge`, `groundedness`, `bm25 tokenizer`, `warnings`, `inconclusive`, `stdin`, `stale context`, `context-source.js`, J1/J2 tail

**Impact:** one tokenizer across judge and retrieval · two reproducible false-fail classes closed · 20 new tests (judge suite 29 → 49) · 189 integration tests passing · 0 npm deps

---

### v8.53.0 — reading the store nobody fills ✓ (2026-09-29)

**Minor release closing the claim-hygiene cluster.** Four commands published a token-reduction figure and no two were comparable: `--health` said *"no history, 0 runs"*, `gain` said 2,047 operations at 96.5%, `budget` said 142 ops over a session window, `--report` said 97.6% for the current run.

The cause was not arithmetic, and that is the point. `tracking` defaults to **false**, so `.context/usage.ndjson` is never written — and that is the store `--health`, `history` and the dashboard read. Meanwhile `recordUsage` writes `.context/gain.ndjson` unconditionally. Three surfaces looked empty because they read the one store nobody fills. On this repo, `--health` reported zero runs beside a gain log holding 525 generates.

`src/tracking/usage-source.js` is now the single read path: it normalises both stores into one record shape, dedupes a run logged to both, and reports which stores contributed so a caller can label what it is showing. Populations stay distinct and now say so — 524 generate runs, 2,047 operations and a session window are different things, and `gain` records `ask` queries alongside generates, which is how one log described itself as both 2,047 and 525. That is the rule v8.52.0 set for coverage, applied to the second family of numbers.

Two smaller defects went with it. `Math.max(last.length, 1)` made `history` report *"(last 1 runs)"* for an empty log — a run that never happened. And `gain` records no file count or over-budget flag, which the history table rendered as `0` and `no`: a field the source never captured, displayed as though it had been measured. That is the **same defect v8.52.1 fixed in `bench --submit`**, in a different command — the third appearance of the pattern in this series, which is a strong argument for a lint rather than a fourth one-off fix.

The issue's own premise needed correcting while fixing it: #773 names `.context/usage.json` as a third token store. It is not — that file is the star-nudge run counter. There were two token stores, not three, and the record says so to save the next reader the search.

**Tags:** `src/tracking/usage-source.js` · `readRuns` · `describeSource` · named populations · `#773` · PR `#793`

**Impact:** `--health` reports 96.6% over 524 runs where it reported "no history"; `history` is non-empty wherever the gain log is; every reduction figure names its baseline and window. 195 integration tests (up from 194), 8 new assertions each mutation-checked. Every published metric unmoved — 95.8% token reduction, 78.6% hit@5, 86.4% vs 40.8% honest grep pair, 61.0% task-success proxy.

---

### v8.52.2 — the check that only runs after the tag ✓ (2026-09-29)

**Patch release restoring the binaries v8.52.1 failed to ship.** Every `Build` job in `Release Binaries` failed at *Smoke-test binary*, so nothing was uploaded and *Attach to GitHub Release* then died on a missing `dist/release/`. npm was unaffected — binaries are not part of the npm package — so `sigmap@8.52.1` published normally while its GitHub Release carried zero assets.

The cause was self-inflicted and instructive. `scripts/verify-binary.mjs` test 9 runs `bench --submit` in an empty `TMPDIR` and treated a non-zero exit as failure. v8.52.1 had *deliberately* made that case exit 1: there is no local metric to submit, and a green exit previously said "ready to paste" for a block carrying nothing measured. The smoke test was simply the last holder of the old contract.

What makes it worth a roadmap entry is not the one-line fix but **where** it hid. This was the fourth place depending on that exit code. Three were found and corrected while making the change; this one was missed because `release-binaries.yml` is `verify-binary.mjs`'s only caller, and it triggers on **tag push — never on pull requests**. Both the feature PR and the release PR passed every check while the failure was already guaranteed. A contract the test suite cannot see is a contract that breaks after the tag exists, which is the most expensive moment to find out. Running the smoke test against a single ubuntu build in PR CI is the structural fix and is tracked separately.

The pattern is familiar from this series: v8.52.1 found that fabricated numbers had become load-bearing for the suite, and this release found that a corrected contract had a verifier outside the suite's reach. Both are the same failure in different clothing — a check that cannot observe the thing it certifies.

**Tags:** `scripts/verify-binary.mjs` · `release-binaries.yml` · tag-only CI coverage · PR `#791`

**Impact:** binaries build and attach again; the v8.52.1 GitHub Release remains without assets, so anyone needing a standalone binary should take v8.52.2. No product behaviour changed — the diff is twelve lines of release tooling. Every published metric unmoved.

---

### v8.52.1 — the numbers nobody measured ✓ (2026-09-29)

**Patch release closing two issues as one defect.** The only two commands whose output exists to be *republished* — `share`, for a social post, and `bench --submit`, for a GitHub Discussion — both printed figures that were never measured.

`share` appended the string literal `6× better results` against a published lift of **2.12×**, an overstatement of roughly three times, in text the user pastes publicly. Worse, `let reduction = 97, hitAt5 = 88` meant a repo that had never run a benchmark emitted *"97% fewer tokens · 88% retrieval accuracy"* as the **user's own measurements**. Local figures now carry `(this repo)` and the lift carries `(published)`, read from the same `latest.json` that `compare` reads, so the two commands cannot advertise different multipliers. A repo with no history says so.

`bench --submit` collapsed a missing field to zero. `ret.hitAt5Pct || Math.round((ret.hitAt5 || 0) * 100)` turns *absent* into `0`, which then passes the `!= null` render guard — so an entry carrying no hit@5 printed `hit@5 : 0%`, indistinguishable from a genuine score of zero, inside a block the command explicitly asks users to publish. Absent now renders `not run`, a measured `0` still renders `0%`, and text mode exits non-zero when nothing local was measured. `--json` deliberately keeps exit 0: it already states the condition as `local: null`, which a consumer can check, and failing it would break a machine contract for a caller that can already tell.

The interesting part was the tests. Three committed tests had grown to depend on the fabricated numbers. The hardcoded 97/88 defaults made `share`'s output look unconditionally rich, so a test asserted it always contains `tokens` — true only because the command invented a token figure when no history existed. That made the test **environment-dependent**: it passed on a working copy carrying a gitignored `.context/benchmark-history.ndjson` and failed on a fresh CI clone, which is exactly how it was caught. Fabricated data does not just mislead users; it quietly becomes load-bearing for the suite that is supposed to catch it.

**Tags:** `share` · `bench --submit` · `latest.json` provenance · text-vs-json exit contract · `#763` · `#764` · PR `#789`

**Impact:** no shipped command prints a number that cannot be traced to `latest.json` or `.context/benchmark-history.ndjson`; a measured zero and an unmeasured one are distinguishable everywhere they are published. 194 integration tests (up from 193), 10 new assertions each mutation-checked. Every published metric unmoved — 95.8% token reduction, 78.6% hit@5, 86.4% vs 40.8% honest grep pair, 61.0% task-success proxy.

---

### v8.52.0 — four answers to one question ✓ (2026-09-29)

**Minor release: one coverage primitive with named populations.** Four commands printed a coverage percentage for one repo and no two agreed — `validate` 98% (175/179), `doctor` 100%, `--health` 100% (170/170), `--report` 54% (91/170). They were never in conflict about a fact. They measured **different populations** through the same primitive, and none of them said which.

`doctor` was the case that made this a defect rather than a labelling gap. It fed `coverageScore` the output of `buildSigIndex` — the retrieval index, which deliberately holds more than the token budget admitted — and then printed *"of source files in context"*. So it claimed 100% in-context while the very run that produced that context reported 54%: two directly contradictory statements about one artifact on disk.

Three populations are now named and carried on every figure. **`in-context`** is what survived the token budget — what the agent actually sees. **`indexed`** is what the retrieval index holds, budget or not. **`readable`** is what is readable on disk under `srcDirs`, an access check rather than a coverage claim. `formatCoverage()` renders `<population> <pct>% (<included>/<total> <noun>)` and throws on an unknown population, so a bare percentage cannot be printed by accident; `inContextFiles()` parses the `### <relpath>` sections of the generated context file rather than the index, which is what lets `doctor` measure the thing it names.

`doctor` and `--report` now agree exactly. `validate` and `--health` still report different numbers, and that is correct — they answer different questions and now say so. Differing numbers were always fine; unlabelled ones were not.

Worth noting for anyone upgrading: `doctor`'s coverage line will appear to **drop** from 100% to the real in-context figure. It is not a regression — it is the first time that line has measured what it claims.

The same pass closed the last of the v8.48 CLI audit backlog (#656–#661), each re-verified individually rather than bulk-closed. That discipline earned its keep twice: four were genuinely fixed, and an initial check of mine on #656 produced a false reproduction — an exit code read without the `overBudget` flag printed beside it, in a run where the budget legitimately fit.

**Tags:** `coverage-score.js` · `POPULATIONS` · `formatCoverage` · `inContextFiles` · `#762` · PR `#787`

**Impact:** `doctor` and `--report` agree for the first time; every coverage figure carries a population, numerator and denominator. 193 integration tests (up from 192), 9 new assertions each mutation-checked in both directions. Every published metric unmoved — 95.8% token reduction, 78.6% hit@5, 86.4% vs 40.8% honest grep pair, 61.0% task-success proxy.

---

### v8.51.10 — the command that oversold itself ✓ (2026-09-29)

**Patch release closing a claim-hygiene defect and the v8.48 audit backlog.**

`sigmap compare` — the command whose entire job is *"SigMap vs a baseline"* — published two numbers that disagreed with everything else SigMap publishes. It scored against random selection (~16%) and reported a **4.9× lift**, while README, this site, `version.json` and `benchmarks/latest.json` all publish the honest corpus: 86.4% vs 40.8% against a single-shot grep agent, a **2.12× lift**. The honest corpus exists *precisely because* the random baseline overstates — v8.19 introduced it to stop quoting random-selection lift, and this command was never switched over. It now runs the honest benchmark, which is both the published claim and faster: ~38s against the ~90s retrieval run it replaces.

The second number was worse than inconsistent. `Avg tokens 93 vs 1,289,556` derived its baseline from `fileCount × 4000` — four thousand tokens per file, assumed, never measured — and rendered it beside a real signature count as though both were observed. It now carries the measured 95.8% average, labelled as coming from the saved benchmark rather than from the current run.

Fixing it surfaced a third defect of the same family as the one closed in v8.51.9: `compare --json` had never been pipeable, because the progress line used `console.log` and put a human string on stdout ahead of the payload. Diagnostics on the machine channel, one level up from where the last release found it. A regression test now pins the command's hit@5 pair to `latest.json` *and* to the figures README publishes, so the command and the project cannot drift apart again.

The same pass closed the v8.48 CLI audit backlog — #656, #657, #658, #660 and #661 — by re-verifying each individually rather than bulk-closing, with the evidence recorded on every issue. That discipline earned its keep twice over: four were genuinely fixed, and the fifth (#656) was too, but only after an initial check of mine reported a false reproduction. I had read an exit code without the `overBudget` flag printed beside it, in a run where the budget legitimately fit; the correction is on the issue.

**Tags:** `run-honest-benchmark --json` · grep-agent baseline · stderr diagnostics · `latest.json` agreement test · `#760` · PR `#761`

**Impact:** `compare` now reports the same claim as every other surface — 86.4% vs 40.8%, 2.12× — where it previously advertised 4.9×; no invented token figure remains in any shipped output. 192 integration tests, 11 assertions on the compare contract, each mutation-checked. Every published metric unmoved: 95.8% token reduction, 78.6% hit@5, 61.0% task-success proxy, 43.4% prompt reduction.

---

### v8.51.9 — the command that never worked ✓ (2026-09-28)

**Patch release from a full-surface audit.** Every CLI command was run one by one against a fixture repo — 97 invocations, **93 green** — and every benchmark and gate script was executed, **20 of 20 passing**. One genuine defect surfaced.

`sigmap compare` failed for every user, inside and outside the source checkout, and made them wait about ninety seconds first. It spawns `run-retrieval-benchmark.mjs --compare` and does a strict `JSON.parse` of that process's entire stdout — but the payload was emitted at the bottom of the script, *after* the terminal table. So stdout was a box-drawn results table followed by valid JSON, the parse died on the leading rule, and the command exited 1 having just run the full eighteen-repo retrieval benchmark. Both halves were correct; only their order was wrong, and `--json` had always got it right by emitting and exiting before any human output.

The first fix broke it differently, which is worth recording. Moving the block above the table made it read `avgHit` and `avgRand` — locals accumulated by the loop that *prints* that table — so a boundary parse error became a runtime `ReferenceError`. It now derives the same task-weighted averages straight from `results`, and a test pins that it never reaches for those locals again. Exiting early must also not silently stop recording the run, so the benchmark-history append became a parameterised function called on both paths.

The other three non-green commands were not defects but correct refusals reported from the wrong directory: `--diagnose-extractors` needs SigMap's own fixture corpus and passes 36/36 from the repo root, and `scaffold` declines below its confidence floor in a repo with no naming convention while proposing correctly at 100% consistency when one exists. Worth stating because a refusal that exits non-zero looks identical to a failure in a smoke test, and the distinction is the whole value of the command.

The audit also found the CLI reference documenting output `compare` has never produced — the honest grep pair rather than the random baseline it actually scores against. The example now shows real output, with the discrepancy called out rather than quietly corrected: `compare` reports a 4.9× lift over random selection, while the published claim remains 2.12× over a grep agent.

**Tags:** `run-retrieval-benchmark --compare` · `appendHistoryWith` · consumer shape-check · `#757` · PR `#758`

**Impact:** `sigmap compare` works for the first time in the releases this audit covers; 20/20 benchmark and gate scripts pass with **no published metric moved** — 95.8% token reduction, 78.6% hit@5, 86.4% vs 40.8% honest grep pair, test-discovery F1 98.0%. 192 integration tests (up from 191), 6 new assertions, mutation-checked.

---

### v8.51.8 — the instructions nobody was reading ✓ (2026-09-28)

**Patch release from a user bug report:** *"in per-module mode the sigmap commands are not getting added in the copilot instruction file, so the LLM does not pick it up."* Reproduced, and it was two strategies rather than one.

The always-on primary output is the only file an IDE auto-injects. `runPerModuleStrategy` hand-built its overview and never called `usageBlock()` — the per-module `context-<module>.md` files *did* carry the block via `formatOutput`, but those are on-demand, so the one file that actually reaches the agent was the one without it. Separately, `runHotColdStrategy` fell back to a bare HTML comment whenever `hotEntries` was empty, skipping `formatOutput` and the block with it; that is the worst possible moment to lose it, because "nothing changed recently" is exactly when an agent needs telling to run `sigmap ask` rather than concluding the repo has no context. `full` and `index` were unaffected throughout, which is why the defect survived so long. The overview also closed with *"Inject the relevant module file into your IDE context window"* — an instruction only a human can act on.

The second half of the report was the block itself. It named four commands out of roughly fifty, in a passive table an agent reads past. It is now imperative — **"Run these yourself in the terminal"** — and publishes the commands that change what an answer costs or whether it is grounded: `sigmap lines` (read an anchored range instead of a whole file), `--impact` and `--callers` (blast radius before editing), `verify` (the grounding guard) and `explain`. The long form already shipped in `sigmap skills install`, but that is opt-in; this is what every agent gets without asking.

Growing the block then exposed a budget defect it had been hiding. `applyTokenBudget` reserved a hardcoded `max(200, 10%)` for what its own comment called a "~150-token fixed preamble" — a literal that had already drifted from the thing it described — so `maxTokens` was never really a total, and a 500-token budget emitted 554. The fix measures the reserve from `usageBlock()` directly; the first attempt then repeated the same mistake one size smaller, guessing 80 tokens of surrounding chrome against a measured 124. Both breaches were invisible locally and caught only by CI, because whether the budget overflows depends on how many entries happen to fit — so the constant now carries a guard that measures the **emitted** preamble and fails if reality outgrows it.

Worth naming because it is the same failure class as #697 and #743: a number written down once, describing something that then changed. The fix is never a better number — it is a test that re-derives it.

**Tags:** `usageBlock` · `runPerModuleStrategy` · `runHotColdStrategy` · `applyTokenBudget` · `PREAMBLE_CHROME_TOKENS` · `#754` · PR `#755`

**Impact:** all four strategies now carry the commands block in the always-on file, where two carried nothing; `maxTokens` is honoured as a total (500 → 440 emitted, 4000 → 3474); the block grew ~104 → ~224 tokens, and the one metric that moved is exactly that: average token reduction **95.9% → 95.8%**, with every affected repo growing by precisely 119 tokens against a measured block delta of 120 — 11 repos down, none up, ten unchanged by rounding. Everything else is unmoved: 78.6% hit@5, 86.4% vs 40.8% honest grep pair, 61.0% task-success proxy, 43.4% prompt reduction. 191 integration tests (up from 190), 20 new assertions, each mutation-checked.

---

### v8.51.7 — the dependencies nobody could see ✓ (2026-09-28)

**Patch release from a user bug report:** *"only npm projects write about the packages they use — pom.xml and requirements.txt are not read, and pom.xml is not parsed correctly."* It resolved into two unrelated subsystems and four separate defects, which is why the diagnosis came before any patch.

The inventory looked at the repo **root and nowhere else**. `collectDependencies` probed `cwd/<manifest>` and never walked, so the normal shape of a Java build — an aggregator `pom.xml` whose `<modules>` hold the real dependencies — reported `0 deps` with every declared dependency invisible. Three `pom.xml` defects sat behind that: `<parent>` shadowed the project's own identity, so every Spring Boot POM reported itself as `spring-boot-starter-parent`; `<dependencyManagement>` version constraints were counted as real dependencies and leaked into `sigmap sbom` as components the project does not depend on; and Maven scope collapsed, so lombok at `<scope>provided</scope>` — compile-time, never shipped — was indistinguishable from one that is. A bounded walk (depth 4, 200 manifests) now finds them, honouring the project's `exclude` config and `.contextignore`, which the fix forced: sigmap's own `benchmarks/repos/` holds 43 cloned third-party repos, and every one of their manifests was briefly reported as a sigmap dependency.

The second subsystem was the instruction file itself. `## versions (installed direct deps)` resolves versions out of `node_modules` and `site-packages`, so it can only ever describe npm and Python — a Maven, Go, Cargo, Gem or Composer project got nothing, and an npm project that had not run `npm install` got nothing either. A new `## dependencies (declared — <ecosystems>)` section carries the manifest-declared pins, labelled separately because "what the manifest asks for" and "what is installed here" are different claims. The `## deps` import map had its own version of the same blindness: it matched only specifiers beginning with `.`, so a file's row named its internal wiring but never the libraries it imports, and there was no JVM mapping at all. `extractLuaDeps` turned out to be defined, exported, and dispatched from nowhere — dead since it was written.

Shipping alongside: nested types in Java, Swift and C# were under-reported or misattributed — three languages, three different root causes. Swift was the sharpest, reporting a nested type's methods against the **enclosing** type while never reporting the type itself. The committed `test/expected/csharp.txt` recorded an interface with no members while the fixture declares two, and `--diagnose-extractors` graded it a pass: the fifth committed expectation found this cycle asserting a bug was correct.

The release also closes the two process failures that made the previous two releases fragile. v8.51.5 and v8.51.6 both merged to `main` untagged, leaving npm behind what `main` claimed, because pushing the tag was a manual step — `tag-on-merge.yml` now does it when, and only when, `package.json` and the newest CHANGELOG header agree and no tag exists. And CI's `pull_request` trigger was filtered to `[develop, main]`, so a stacked PR matched no workflow and could never satisfy its own required checks.

**Tags:** `findManifests` bounded walk · `projectExcludes` · Maven parent/`dependencyManagement`/scope · `## dependencies (declared)` · `extractJavaDeps` · `blankNestedTypeBodies` · `tag-on-merge.yml` · `#741` · `#747` · `#751` · PRs `#748`, `#749`, `#750`, `#752`

**Impact:** multi-module Maven repos go from 0 declared dependencies to all of them; akka 3,151 → 4,462 signatures (+42%), serilog 1,108 → 1,163, alamofire 1,466 → 1,585; 184 integration tests (up from 180), 44 new assertions. Average token reduction 96.1% → **95.9%** — the declared-dependency section adds real content to every manifest-bearing context file, and the per-repo drops land exactly there (express −1.5, okhttp −1.0, spring-petclinic −0.7). Every other headline metric is unmoved: 78.6% hit@5, 61.0% task-success proxy, 43.4% prompt reduction, 86.4% vs 40.8% honest grep pair.

---

### v8.51.6 — nine extractors stop inventing parameters ✓ (2026-09-28)

**Patch release completing G4 increment 2.** Nine extractors resolved parameter lists with `\(([^)]*)\)`, which stops at the first closing paren — so a nested call in a default, a function-typed parameter, or a `)` inside a string default ended the scan early. One root cause, three symptoms: Swift rendered `func f(cb) → Int, n: Int) -> Int`, structurally malformed; C# and PHP silently lost the closing paren; and **C++ dropped whole declarations**, which then became `fake-symbol` false positives in `verify`, because a symbol that was never indexed cannot be grounded. Kotlin was the sharpest: `fun f(a: Int = g(1, 2))` rendered `fun f(a, 2)` — a well-formed signature naming a parameter that does not exist. Swift, Dart, Rust, C#, PHP, Ruby, C++, Kotlin and Scala now use the shared balanced scanner, and every committed happy-path fixture is byte-identical afterwards.

Two defects were worse than truncation. A body-less `data class`/`case class` **swallowed the next type's body** — `(?:[^{]*)\{` matched newlines — so the first type was reported with the second's members while the second vanished entirely. Misattribution, not truncation: every symbol named is real, just bolted to the wrong owner, which is exactly what `verify` cannot flag. It was live on both committed fixtures, and `--diagnose-extractors` reported it as a pass. And Rust **lifetimes** (`&'db`, `<'_>`) read as char-literal openers to the mask, desynchronising it and dropping 208 signatures on rust-analyzer — every one lifetime-annotated.

The same release reshaped the token budget, because the extractor work exposed a defect in it. The budget spent itself strictly best-first across a repo, so one module could take all of it: on akka, `akka-stream` kept **all 128 surviving slots** while `akka-actor` (192 files) and `akka-cluster` (28 files) got **zero** — two of three configured source dirs rendered invisible. Completer extraction makes that strictly worse rather than better, since more signatures per file means the leading module exhausts the budget sooner, and in development it briefly pulled measured hit@5 down to 75.3% entirely from that one repo. The extraction was right; the drop order was wrong. A bounded per-module floor now runs before the global pass, so a module can be thinned but never erased, and a single-module repo is byte-identical to before. Equal round-robin and strictly proportional share were both implemented and measured first — the former cost rails and gin, the latter was worse than doing nothing — and both are recorded in the code so they are not re-attempted.

Worth naming because it will recur: the retrieval corpus scores the **budgeted context file**, so a completeness gain can lower a published number while improving the product. That is a property of the measurement, not of the tool, and [#743](https://github.com/manojmallick/sigmap/issues/743) records it alongside the fix.

**Tags:** `src/extractors/scan.js` · balanced parameter reads · `blankNestedTypeBodies` · lifetime masking · `#695` · `#696` · `#735` · `#738` · `#743` · PRs `#739`, `#740`, `#742`

**Impact:** nine extractors migrated, adversarial defect ledger empty for all twelve corpus languages; akka types 836 → 2,545, okhttp 413 → 619, kotlinx-coroutines 450 → 670; abseil-cpp 5,535 → 6,465 signatures; 208 lifetime-annotated Rust signatures recovered; no module can be erased by the token budget; every headline metric held at its pre-migration value — 96.1% token reduction, 78.6% hit@5, 61.0% task-success proxy, 43.4% prompt reduction; 180 integration tests (up from 176), 56 new assertions.

---

### v8.51.5 — the suite that graded a bug as correct ✓ (2026-09-27)

**Patch release, and the third consecutive one spent on the measurement layer.** v8.51.3 fixed a benchmark that overwrote the corpus it read; v8.51.4 fixed one that could not see a whole language. This one found the extractor test suite asserting that a bug was correct.

`--diagnose-extractors` reported **36 fixtures, 36 pass, 0 fail**. The corpus was broad — one fixture per language — but happy-path only, so it could not detect corruption, and it is the evidence cited for the tier labels in `KNOWN_LIMITATIONS.md`. Building an adversarial corpus to prove that turned up something sharper: `test/expected/ruby.txt` contained **both** a phantom indented "class member" and the real top-level `def` for the same declaration. `ruby.js` scanned members with `/^\s+def/gm`, and `\s` matches newlines, so `^\s+` spanned the blank line after an `end` and matched a column-0 `def` as if indented; the top-level pass then matched it again. Every top-level Ruby def after a blank line was emitted twice, and the committed expectation ratified it — the same character-class mistake as the `^`-anchored class regex closed in v8.51.1.

`test/fixtures-adversarial/` now exercises 12 languages against the shapes that actually break regex extractors, `test/expected-adversarial/` snapshots what each produces today, and `test/adversarial-defects.json` records which lines are wrong, the correct signature, and the owning issue. The ledger fails in **both** directions: behaviour drifting without a ledger update fails, and *fixing* a language fails too, which forces the entry out. So `defects: []` is a positive claim rather than absent testing. That measurement corrected #695's own table — **Python is fine** via the AST tier, and **Rust and C# carry defects #695 never measured**, with Rust's `->`→`→` substitution firing on the closure arrow so the return type is stated twice in two notations.

The same release closed the last of the published-count drift. `sync-metrics` had only ever written `version.json` and `README.md`, so `languages.md` said **31** in both SEO `content:` meta lines and **36** in its body — and the meta lines are what search results render. Markers cannot fix that half, because an HTML comment inside a YAML string lands verbatim in the rendered tag, so every count is now classified as canonical, exempt (a different metric, reason recorded) or historical, and an unclassified one fails CI. The README's promise of a line anchor for *every* symbol is scoped to the tiers that actually anchor — five languages emit none — and R, Lua, Elixir and Astro finally appear in the tier table, with Astro correctly in Tier 2 rather than Tier 3.

First external contribution to the `gain` surface: **@AJambla** found that `gain --model <typo>` mapped any unknown key to `claude-sonnet` and printed the dollar figures with no notice, so a typo read as a valid quote. The substitution is now disclosed on stderr and `gain --models` lists the known keys and rates, with exit code and dashboard output unchanged — the fallback is disclosed, not removed.

**Tags:** `test/fixtures-adversarial` · `adversarial-defects.json` · `check-doc-counts.mjs` · `gain --models` · `#665` · `#697` · `#698` · `#702` · `#735` · PRs `#733`, `#734`, `#736`

**Impact:** Ruby signature duplication eliminated (every top-level def after a blank line was doubled); ten languages' parser defects enumerated with owning issues instead of counted as passes; published counts gated in both directions; 176 integration tests (up from 175), 32 new assertions of which 15 fail against v8.51.4; one external contributor credited.

---

### v8.51.4 — the language that counted as zero ✓ (2026-09-26)

**Patch release, and the second consecutive one spent on the measurement layer rather than the product.** v8.51.3 fixed a benchmark that overwrote the corpus it read. This one fixes a benchmark that could not see a whole language.

`countGroundedSymbols` tested every line of generated context against a hardcoded keyword-prefix allowlist — `function `, `class `, `def `, `fun `, `struct `, plus a `→` return-arrow fallback. Any language whose signature begins with the **identifier** rather than a keyword matched nothing and counted as zero. R is shaped `name <- function(args)`, so **ggplot2 reported 1 grounded symbol against 964 real signature lines** — a 964× undercount, published on the quality-benchmark page as **0% grounding for R**, a language with its own `benchmarks/R_LANGUAGE_BENCHMARKS.md` and an `r-language.test.js` inside `npm test`. Three more repos were wrong for the same reason. The context already delimits signatures as fenced blocks under `### <file>` headers, so counting non-empty lines inside them needs no per-language knowledge and cannot go silently blind when a new extractor lands.

The same rows carried a second, separate defect: `groundingPct` divides by `estimatedRawSymbols`, a `rawTokens / 200` heuristic, so a repo whose measured count beat the estimate printed an impossible percentage — okhttp published **114%**, the same class as the `validate` coverage-above-100% bug closed in v8.49.2. There the estimate is what is wrong, not the measurement, so the ratio is clamped, the row is flagged, and it is dropped from the average **with the exclusion and both counts stated** rather than silently. And the guard that would have caught the original bug now exists: a repo counting zero from a non-empty context file fails the suite instead of writing the number onto a public page.

Correcting the counter also caught six stale figures on the quality page that no report had ever backed — grounded symbols published as "16,500+" while every saved run said 9,544, GPT-4o overflow as 16 of 21 against a measured 14, and the three window-fit rows. Every number on that page is now sourced from `quality.json`, with the full per-repo table published rather than a rounded headline.

**Tags:** `scripts/lib/signature-count.mjs` · structural fenced-block counting · `estimateReliable` · zero-grounding guard · `#694` · PR `#731`

**Impact:** R grounding 0% → 51% (ggplot2), 0% → 41% (shiny), 0% → 71% (dplyr); svelte 17% → 50%; aggregate grounded 9,544 → **15,674** and dark 57,290 → **51,183**; no published percentage above 100; 174 integration tests (up from 173), 11 new assertions of which 8 fail against the v8.51.3 build.

---

### v8.51.3 — the benchmark that graded its own homework ✓ (2026-09-26)

**Patch release closing a defect in the measurement layer itself.** `benchmarks/repos/*` is shared state, and the honest benchmark never regenerates — it reads each repo's context AS-IS. So every suite that regenerated a repo and left the result on disk was quietly deciding what the *next* suite measured. The published hit@5 depended on which suite ran last, which is precisely the opposite of the reproducibility this project sells.

Two earlier fixes had each closed half the hole. #522 restored `gen-context.config.json` but not the generated context. #480 restored the markdown adapters but omitted `.context/` — the directory holding `sig-index.json`, which is exactly what the ranker reads. A function named `measureGroundingHermetic` was therefore still rewriting the retrieval index on every call, and `run-benchmark.mjs` restored nothing at all, generating with whatever config happened to be on disk. Measured on the 43-repo corpus: **one pre-fix quality-suite run rewrote 42 of 86 tracked artifacts**. One shared primitive now owns the entire artifact set and restores in a `finally`; after the fix a full cross-suite run leaves all 86 byte-identical. The determinism gate — which existed, worked, and was wired to nothing — now runs in CI, and the corpus-free half runs on every PR.

Refreshing the reports this unblocked also corrected two stale inputs feeding the published numbers: `honest-baseline.json` was a **v8.28.1** measurement (2026-08-22) and `test-discovery.json` a **v8.8.0** one. The honest grep baseline moves 44.0% → **40.8%** and the measured lift 1.73× → **2.12×**. That exposed a second defect (#707): the lift divides the honest corpus's own pair (86.4 ÷ 40.8), but every public page rendered it beside the *retrieval* corpus's 78.6% — so 78.6 ÷ 40.8 read 1.93 and the arithmetic never closed. `latest.json` now carries the honest pair as its own block, and all thirteen public surfaces quote the lift only against the two numbers it is computed from.

**Tags:** `scripts/lib/shared-repo-context.mjs` · `.context/` in the snapshot set · cross-suite CI gate · `#706` · `#707` (partial) · PR `#729`

**Impact:** shared-corpus artifacts rewritten per consumer-suite run 42 → 0; two stale benchmark inputs refreshed (one 34 days, one 82 days old); honest lift restated 1.73× → 2.12× and made arithmetically coherent across 13 surfaces; 173 integration tests (up from 168 committed), 6 new hermeticity assertions.

---

### v8.51.2 — three from the outside ✓ (2026-09-25)

**Patch release, and the first where every change came from someone else.** Three external contributions, two of them guards against the same failure class the previous two releases were spent on: something documented and tested that silently did not run.

@rudi193-cmd found the sharpest one. `python_ast.py` existed, had unit tests, and was documented in `KNOWN_LIMITATIONS.md` as Tier 1 — *"Native CPython AST parse … when `python3` is on PATH"*. But nothing in the shipped pipeline ever handed it a file path, so every Python file in production quietly fell through to the Tier-2 regex tier. The tests passed because they called the extractor directly. That is the same shape as the CI extractor in v8.50.0 and the JVM source roots in v8.51.0 — wired into resolution, absent from the path that actually runs. Merging it needed care against v8.50.0's path-based routing: passing the path to every extractor is what activates the AST tier, but gating it on `fs.existsSync` with an `undefined` fallback would have broken location-based routing for in-memory content, so the fallback is the original path string. **Python signature output now changes where `python3` is available** — ordering, `self`, `opts=...` versus `opts`, the `*` marker — which is the documented Tier-1 behaviour finally taking effect rather than a new divergence.

@tunglambk contributed two drift gates in the house style. `methodology.md` built and deployed with nothing linking to it, so the page explaining how the benchmarks are produced was reachable only by typing the URL; the fix links it and adds a guard that derives pages-on-disk and sidebar-links **independently** and fails when they disagree in either direction, so a renamed page cannot leave a dead link either. The second found the config reference documenting three keys that exist nowhere in the source while omitting keys `loadConfig` actually reads — including a `srcDirs` default listed as three entries when `DEFAULTS` has forty-two. Both sides of that page now derive from their own source of truth, gated.

**Tags:** `python_ast.py` Tier 1 · path threading in `extractFile` · docs-nav coverage guard · config-reference drift gate · `#693` · `#700` · `#708` · PRs `#724`–`#726`

**Impact:** the Python AST tier runs in production for the first time; two more drift gates (178 tests, up from 174); three external contributions merged, two contributors credited.

---

### v8.51.1 — the class that was never there ✓ (2026-09-25)

**Patch release from a bug report against [ing-bank/lion](https://github.com/ing-bank/lion):** a Lit/web-component codebase whose generated signatures showed almost nothing for the components themselves.

The cause was not the Lit support. The class regex matched the heritage clause inline, and that form cannot match a **call expression** — so `extends LocalizeMixin(LitElement)`, the idiomatic Lit composition, failed the extends branch, and because that branch was optional the fallback needed `{` immediately after the class name and failed too. The class did not lose its annotation; it **vanished entirely** — no class line, no methods. On lion that was **111 of 326 classes, 34%**. A second bug compounded it: the regex was `^`-anchored with no allowance for indentation, which excluded the mixin-factory form every web-component library uses. Both extractors now walk to the body brace with a bounded, depth-aware scan, so any superclass expression resolves. Fixing it surfaced a third: `javascript.js` had always treated `get`/`set` as member modifiers and `typescript.js` never had, so TypeScript classes silently shed every accessor — and that divergence is how the gap survived.

The release also added a **source-root coverage gate**. Detection can return almost nothing while every other gate passes, which had by then happened twice, for the reason the JVM call-graph gate already documents about itself: the gated retrieval corpus is JavaScript and measures *ranking* over an index it assumes is populated. A ranker scores what it is given and cannot report what detection never handed it. The gate asserts the input side directly, and its first real run immediately found kotlinx-coroutines at ~10% — a flat multiplatform layout still uncovered, recorded in the baseline so it cannot silently worsen.

**Tags:** `findClassBody` · call-expression superclasses · indented class expressions · TS `get`/`set` parity · `validate:source-roots` · ing-bank/lion

**Impact:** lion 517 → 597 files and 797 → 1,017 symbols, with 129 mixin compositions visible where there had been none; plain classes byte-identical, so no other repo's output moved.

---

### v8.51.0 — the layout finally reads ✓ (2026-09-25)

**Patch-shaped work, released as a minor because it changes what a JVM repo indexes.** Everything here came out of field-testing v8.50 against 15 real public repos rather than from a plan — which is the honest summary of the release: four of the five defects it fixes were shipped by v8.50 itself, and the fifth had been latent for far longer.

The largest is source-root detection. A standard Gradle/Maven/sbt build keeps its code under `<module>/src/main/<lang>`, but the candidate scan looked two directory levels deep and the source sits at four, so every module scored zero and the only surviving root was whatever directory happened to hold a manifest. **okhttp indexed 4 files of 596; akka 29 of 2,651** — on the layout covering a large share of the Java/Kotlin/Scala world. Kotlin Multiplatform compounded it: everything assumed the source set is called `main`, which has not been true of Kotlin for years, so okhttp's 307-file core under `src/jvmMain/kotlin` was invisible. Source sets are now *discovered* rather than assumed, detection is structural (two or more module source dirs on disk, with Gradle/Maven/sbt markers as secondary evidence), and the six-root cap tuned for JS layouts is lifted only for these builds. Measured: okhttp 4 → 326, akka 29 → 582, retrofit 571 → 697, kotlinx-coroutines 40 → 90, gson 244 → 265 — while the nine non-JVM repos in the same sweep scanned an **identical** file count, so the change stays inside the layout it targets.

The v8.50 follow-ups are less flattering. The CI/pipeline extractor shipped wired into `langFor` but not into file discovery, so `.github/workflows/` — a root dotdir, never in `srcDirs` — was never walked and the feature did nothing in real use; the fixture that made 29 tests pass sat under `test/`, which a different pass happens to sweep. Three more turned up only against real manifests: a PEP 508 marker split at its inner quotes and reported `CPython` as a package, Composer platform constraints (`php`, `ext-mbstring`) were emitted as unresolvable SBOM components, and `cli_util: any` was pinned as the version `any`. Each would have reached a vulnerability scanner as a real row.

And the `index` strategy was overstating its own benefit by up to 3x, comparing its stub against the *uncapped* retrieval index when `full` applies a token budget and never emits all of it. It now runs the same budget pass and measures the result, under-reporting by construction, and tells a small repo when its *first* answer is actually cheaper under `full`.

**Tags:** `_jvmModuleSourceDirs` · `JVM_PATH_PATTERN` · KMP source sets · structural multi-module detection · `collectPipelineEntries` · PEP 508 markers · purl correctness · budget-measured saving · `#719`–`#721`

**Impact:** okhttp 4 → 326 indexed files and akka 29 → 582, with zero change on nine non-JVM repos; the CI extractor reaches real workflows for the first time; SBOMs emit 0 unresolvable and 0 wildcard components across all 10 test repos; 27 new tests, 22 of which fail on v8.50.0.

---

### v8.50.0 — the map stops competing with the territory ✓ (2026-09-24)

**Minor release — four features from a token-consumption review, plus the honesty guards they each needed.**

The structural one is `strategy: "index"`. Under `full`, the generated context file carries the whole budgeted signature dump and every adapter auto-injects it — **~13,900 tokens on this repo, paid on every session before a single question is asked**. That does not merely cost tokens, it *suppresses retrieval*: an agent already holding a superset of what `sigmap ask` would return is correct not to call it, so the push artifact had been out-competing the pull path it exists to feed. The new strategy keeps the always-on file to a map — how to retrieve, module rollup, entry points, version pins — and leaves every signature in `.context/sig-index.json`, which `ask` already reads and no adapter injects. Always-on falls from 55,567 B (~13,892 tok) to 1,510 B (~377 tok); a first answer falls from ~13,892 tok to ~1,385 tok. A test pins that the retrieval index is **byte-identical** under both strategies, so switching changes only where signatures are injected and never what retrieval can reach. It ships **opt-in** — `full` stays the default, and a flip belongs in v9 behind a published before/after.

Alongside it, two extraction gaps closed. The generic YAML scanner had been reducing a GitHub Actions workflow to `keys: [name, on, jobs]` plus bare job ids — no triggers, runner, steps, `needs`, secrets or line anchors — so the questions actually asked of a pipeline file had no answer. A dedicated extractor now parses nine CI formats structurally with real `:start-end` anchors, routed by **path** ahead of the extension map. And `config-manifest` had been reporting `pom.xml (maven) | present`, which names a file without naming a package; a dependency inventory across nine ecosystems replaces it with real coordinates, resolving Maven `${property}` placeholders and preferring a locked lockfile version over a declared range.

The fourth is a deliberate non-feature. `sigmap sbom` emits a deterministic CycloneDX 1.5 component list and **stops there** — no CVE feed, because a network-sourced vulnerability section would make two runs on the same commit disagree and contaminate byte-reproducibility across every artifact, and because osv-scanner and Dependabot already own that job. SigMap emits what they cannot derive from a signature map, and the user pipes it onward.

Each feature carries a guard against its own easiest overclaim: the summary states that signatures *moved* rather than vanished; repos below the crossover (~400 tokens of signatures) are told `strategy:"full" is cheaper here` instead of shown a saving of zero; and SBOM versions inferred from a range are labelled as lower bounds with the original spec preserved.

**Tags:** `strategy:"index"` · `src/extractors/pipeline.js` · `src/deps/inventory.js` · `src/deps/sbom.js` · `sigmap deps` · `sigmap sbom` · path-routed `langFor` · CycloneDX 1.5 · `#717`

**Impact:** always-on context 13,892 → 377 tokens and first answer 13,892 → 1,385 tokens under the opt-in strategy; a workflow fixture goes from 4 flat keys to 9 anchored semantic lines; nine ecosystems gain real dependency coordinates; 89 new tests.

---

### v8.49.2 — the CLI stops lying ✓ (2026-09-16)

**Patch release — seven fixes from the 2026-09-15 full-CLI audit, every one a case of silently wrong behavior.** The unifying theme is that each command exited 0 while doing the wrong thing, which is the failure class this project exists to prevent.

The worst was #655: an unrecognized subcommand fell through all 37 dispatch branches onto the **default generate path** and rewrote `AGENTS.md`, `CLAUDE.md` and the copilot/gemini context files — so `sigmap bench`, or a typo, was an unintended write. A `KNOWN_COMMANDS` vocabulary now rejects it before any dispatch, with a levenshtein-2 suggestion. Alongside it: `--report --json` promised "exits 1 if over budget" but a bare `process.exit(0)` in the dispatch tail clobbered `process.exitCode`, so every CI job trusting that gate was silently green (#656); `learn` decay multiplied weights toward 0 rather than the documented neutral 1.0, so penalties deepened forever (#657); and lowercased dependency-graph keys made `--impact` and `plan` print paths that climbed out of the repo on every macOS checkout (#658).

The second wave fixed `compare`, which spawned the install-anchored 21-repo benchmark unconditionally and died after ~30–60s from any installed copy, since the runner and corpus are not published (#659); `validate`, which reported **218%** coverage by dividing two different populations (#660); and `--help`, which omitted twelve shipped commands (#661). The durable part of that last one is not the twelve lines but the guard: a test that derives the command vocabulary from the **dispatch chain itself** and fails when help, the C1 guard, or `cli.md` falls behind it — which caught three further commands missing from the docs on its first run.

**Tags:** `KNOWN_COMMANDS` · `exitWithCode` · `displayPath` · `realPaths` · `intersection coverage` · `drift gate` · `#655`–`#661` · `PR #710` · `PR #711`

**Impact:** seven silent-wrongness defects closed; `compare` outside the source checkout goes from ~30–60s + crash to ~140ms + real local numbers; coverage bounded at 100% by construction with stale-index entries surfaced separately; 24 new regression tests (12 of which fail on the previous release) plus two permanent drift gates.

---

### v8.49.1 — the redactor learns its place ✓ (2026-09-15)

**Patch release — a regression fix for v8.49.0, and the project's first external code contribution.** [@tunglambk](https://github.com/tunglambk) fixed a real gap in `sigmap redact` (#668): the Generic Secret pattern only matched *quoted* values, so the most common `.env` shape — `password=SuperSecret123!` — passed through unmasked. Their fix widened the value alternation to accept an unquoted token, and it merged minutes before the v8.49.0 release cut, so it shipped in that release.

The widened pattern is also shared with the **signature scanner**, where `secretScan` is on by default and `scan()` replaces the *whole* declaration — and in code, an unquoted value token is a type annotation. `function hash(password: PasswordHasher)` matched, so auth-adjacent signatures were silently vanishing from generated context in v8.49.0. Rather than weakening either consumer with a heuristic, the two are now split: the unquoted variant is marked `textOnly` and skipped by the scanner, while `redact` keeps it in full. Signature scanning returns to byte-identical pre-#671 behavior and every one of the contributor's tests passes unmodified — the fix and its blast radius, both intact.

**Tags:** `textOnly` · `Generic Secret` · `secretScan` · `regression fix` · `first external contribution` · `#668` · `#680` · `PR #671` · `PR #681`

**Impact:** v8.49.0's silent context corruption is closed; `redact` keeps the broader coverage; 2 new scanner regression tests. Anyone on v8.49.0 with secret-adjacent type names should upgrade.

---

### v8.49.0 — the judge shows its work ✓ (2026-09-15)

**Minor release — J4 lands: confidence + checked-claims explainability at the judge surface.** A verdict resting on word overlap alone used to look identical to one backed by structural verification of every claim — grounded claims were only counted, never itemized. Now every claim reports its grounding route (`context` — the context quotes it; `repo` — the structural pass cleared it; ungrounded) with an Evidence-Pack-style coverage ratio, and every verdict carries a deterministic `confidence: { level, basis }`: high only when the structural pass ran, every claim grounded, and the score clears the threshold with margin; lexical-only checks or thin margins cap at medium; a no-claims, word-overlap-only verdict is labeled low instead of masquerading as verified. The basis names its factors — claims checked, structural coverage, score margin — so the level is auditable, not oracular.

**Tags:** `confidence` · `checked` · `grounding routes` · `coverage` · `J4` · `#653` · `PR #654`

**Impact:** the judge's output distinguishes evidence quality for the first time; 3 new tests pin all three levels (judge suite 26 → 29); JSON additions fully additive — zero consumer changes; 159 integration files passing.

---

### v8.48.0 — the repo teaches the query ✓ (2026-09-15)

**Minor release — B2 lands: repo-mined query expansion, measure-gated to a split verdict.** The curated synonym table is a global prior; `mined-expansions.js` builds a per-repo one at index time — tokens co-occurring within a file's path + signature vocabulary become weighted expansion candidates, so "auth" learns "session" from the repo that actually pairs them. Precision is the design: df floor and ceiling, minimum co-occurrence, top-4 neighbors, static pairs excluded, mined weight capped below the curated weight, everything sorted and cached as diffable JSON in `.context/`. Opt-in via `retrieval.minedExpansions` across `ask`/`--query`/`query_context`. This is SigMap's answer to embeddings: learned from the repo, provable, zero deps.

The measurement is the story. The first A/B run came back positive — the first retrieval feature in the series to beat +0 (callGraphBoost, surfaceEnrichment, centralityBlend all measured flat) — but its corpus mapping had silently skipped the self-repo splits, including `retrieval-hard`, the vocabulary-mismatch gap B2 exists to attack. The fixed gate ran all 23 corpora, 299 tasks: cross-repo **89.5% → 90.5%** and JVM +1, **hard split 67/90 → 66/90** and MRR 0.562 → 0.559. A net +1 on hit@5 with position quality falling and the target corpus regressing is the exact hit@5-only trap `bm25.js` documents — so the default stays off, the wins are named (sparse-context repos), and the standing benchmark is the gate for revisiting.

**Tags:** `mined-expansions.js` · `retrieval.minedExpansions` · `co-occurrence` · `measure gate` · `hard split` · `B2` · `#649` · `PR #650` · `PR #651`

**Impact:** deterministic per-repo expansion exists and is honest about where it helps; 10 new tests (159 integration files); the fourth retrieval feature whose default was decided by measurement, not intuition.

---

### v8.47.0 — Java joins the scanner ✓ (2026-09-15)

**Minor release — G4 increment 3: the Java extractor migrates to the balanced-scanner core, and the type grammar learns modern Java.** The old extractor's naive comment strip corrupted any line whose string contained `//` or `/*`, string braces derailed the class-body depth count (wrong anchors, truncated member scans), an annotation with arguments on a parameter truncated the param list at the annotation's `)`, and a generic method with nested bounds (`<T extends Comparable<T>>`) was missed. Every capture is now a balanced read over the shared `scan.js` surfaces, under the same byte-identical-or-better gate as the JS/TS and Go migrations.

The revealing part: the old pinned fixture output itself proved `interface Repository<T, ID>` was **silently missing** — generic type names broke the type regex. Now extracted, along with records (header components rendered as params), sealed/non-sealed types, and implicit-public interface methods (safe there — interface bodies hold no statements). One honest non-change: `.java` stays out of `EXACT_PARAM_EXTS`, because Java has no top-level callables and dotted calls are never flagged — nothing from a `.java` file could ever enter the arity index, and the reasoning now lives at the constant instead of as dead config.

**Tags:** `scan.js` · `records` · `sealed` · `generic type names` · `implicit-public interface methods` · `annotation-arg params` · `G4 increment 3` · `#646` · `PR #647`

**Impact:** modern-Java surface extracts where it was invisible; string-corruption class fixed for Java; fixture 4 → 15 pinned signatures; retrieval gate PASS; 158 integration files passing. The G4 Go/Java pair named by the milestone is complete.

---

### v8.46.0 — Go gets exact ✓ (2026-09-14)

**Minor release — G4 increment 2: the Go extractor joins the balanced-scanner core, and Go joins arity-checked verification.** The old extractor parsed params with `[^)]*` and a hand-rolled comment strip — a nested func-typed param truncated at the first `)`, a generic function (`func Map[T, U any](…)`) was missed entirely, a generic receiver failed the receiver regex, and a `//` inside a string corrupted the rest of its line. Now every capture is a balanced read on the shared `scan.js` surfaces: nested func types, multiline lists, type parameters on funcs and types, generic receivers, and interface methods with func-typed params all extract exactly, with anchors computed from the real close. The migration shipped under the byte-identical-or-better gate — the pre-existing fixture corpus is unchanged to the byte, with nine new signature shapes pinned beside it.

The payoff is the G4 thesis: with Go params exact, `.go` enters `EXACT_PARAM_EXTS` and the D1 arity guard covers a fourth language. Plain top-level funcs join the arity index (receiver methods deliberately stay out — dotted calls are never flagged), `parseParams` learns Go's type-position variadics via a depth-0 `...` scan that is strictly conservative (variadic only ever suppresses flags), and ` ```go ` blocks pass the guard's language filter — so `verify_suggestion` and `sigmap verify-ai-output` flag a wrong-arity Go call with the actual repo signature as the suggestion.

**Tags:** `scan.js` · `readBalanced` · `generics` · `generic receivers` · `EXACT_PARAM_EXTS` · `type-variadics` · `G4 increment 2` · `#643` · `PR #644`

**Impact:** Go params exact (arity-usable, 4 languages); generics extract where they were silently missing; retrieval gate PASS (67/90, 4 tasks headroom); fixture 8 → 17 pinned signatures; 158 integration files passing.

---

### v8.45.0 — one engine, two commands ✓ (2026-09-14)

**Minor release — the judge convergence (J1 + J2), closing the master plan's last lexical grounding surface.** `sigmap judge` checked an answer's symbol/file/import claims with substring matching against the context text alone — a real repo symbol the context didn't quote verbatim was flagged as a hallucination, and the installed-library moat never fired at the judge surface. `claimGrounding` now delegates its structural half to the verify engine: with a cwd, a claim is grounded when the context quotes it **or** its check class ran and the guard did not flag it — repo symbols, `.d.ts`-exported library symbols, declared imports, and real files stop false-flagging while fabrications still fail. The keystone is honesty about coverage: `verify()`'s summary gains a `checks` field stating which claim classes actually ran, so an empty symbol index or a missing `package.json` can never turn "not flagged" into "verified". Without a repo, behavior is byte-identical lexical matching.

J2 makes the judge tunable: the `--learn` boost/penalize band and the verdict threshold move into a `judge` config section, with defaults **derived, not hand-waved** — a drift-guard test builds exact-ratio mixture answers from the repo's own stop-list-proof vocabulary (80% grounded must boost, 30% must penalize) and pins the band ordering.

**Tags:** `claimGrounding` · `summary.checks` · `one grounding engine` · `judge config` · `mixture-corpus defaults` · `J1` · `J2` · `#638` · `#640` · `PR #639` · `PR #641`

**Impact:** the Grounding dimension's honest deduction closes — repo-true claims pass the judge without context quoting; 10 new tests (judge suite 16 → 26), 158 integration files passing; cwd-less callers unchanged.

---

### v8.44.0 — the evidence rests on the store ✓ (2026-09-14)

**Minor release — knowledge map increment 4, and the #543 epic's last re-basing item lands.** Evidence packs were the derived view #632 deliberately deferred — a schema-stable, hash-anchored artifact re-bases only when the bytes can be proven identical. They now are: `buildEvidencePack` reads `relatedTests` from the store's discovered `tests` edges via the new `relatedTestsView` (one edge pass for the whole ranked set), and the `grounding.contextHash` parity with the legacy per-file rescan is pinned by test. Callers injecting a pre-built `sigIndex` keep the legacy path untouched, so unit builds against a fake cwd write no `.context` cache. `buildPrEvidence` goes further: blast radius (`impactView`) and related tests both come from the mtime-cached store — the per-call signature-index **and** import-graph rebuilds are gone, with the legacy rebuild retained as a fallback and affected tests enriched by the store's test↔impl edges.

The increment also caught a real bug: graph keys are lowercased, so on a case-sensitive filesystem the store's realpath probe failed whenever the true path contained uppercase and the file was missing from the signature index — every `imports` edge of a context-less store silently vanished, surfacing as flaky CI where the mkdtemp suffix case decided the outcome. The probe now falls back to prefix-matching the lowercased cwd, and a regression test pins an uppercase tmp dir without a gen-context run.

**Tags:** `relatedTestsView` · `contextHash parity` · `buildPrEvidence` · `impactView` · `case-sensitive fs` · `#543 increment 4` · `#635` · `PR #636`

**Impact:** zero per-call index/graph rebuilds in PR evidence; byte-identical evidence packs, cheaper to produce; the #543 re-basing plan is complete (SCIP export stays on-demand). 158 integration files passing (knowledge-map suite 19 → 24).

---

### v8.43.0 — the views come home ✓ (2026-09-14)

**Minor release — knowledge map increment 3, and the #543 derived-views plan lands.** `get_impact` and `get_architecture_overview` rebuilt the import graph and signature index on **every MCP call**; both are now views over the mtime-cached store. `impactView` reproduces the graph path's BFS exactly — direct at level 1, transitive deeper, depth 0 unlimited, parity pinned by a realpath-normalized set-equality test — and then answers better than the original: affected tests include the store's discovered test↔impl edges (a test covering an impacted file counts even when it never imports it), and route totals count real route nodes where the old code counted every table row in PROJECT_MAP.md.

Two smaller truths surfaced. File nodes now carry a `tokens` estimate and graph-only endpoints get nodes via realpath recovery (`SCHEMA_VERSION` 3), making the store the superset of both producers. And the parity test caught the old path mangling displayed paths whenever the cwd contains a capital letter (`../../t/…` artifacts on macOS tmpdirs — the builder lowercases keys, `path.relative` got the original case); the store's realpath handling is the correct one. Evidence packs deliberately stay on their own path — a schema-stable, hash-anchored artifact re-bases on its own schedule.

**Tags:** `impactView` · `architectureView` · `loadOrBuild` · `BFS parity` · `SCHEMA_VERSION 3` · `#543 increment 3` · `#632` · `PR #633`

**Impact:** zero per-call graph rebuilds on the two heaviest read tools; richer test/route answers from typed edges; honest route counts. 25 fixture + 158 integration tests passing (knowledge-map suite 14 → 19).

---

### v8.42.0 — the map learns the environment ✓ (2026-09-14)

**Minor release — knowledge map increment 2 of #543.** The store gains the three node kinds increment 1 left out: **`env:<NAME>`** (with a committed-`.env.example` flag — a variable declared in the example but read nowhere still gets a node, which is exactly the dead-config signal), **`migration:<rel>`** (parsed version and name across Rails/Flyway/Prisma/timestamped conventions), and **`script:<runner>:<name>`** (npm scripts, CI workflows, Makefile targets). The new **`reads-env`** edge carries per-file attribution — `query_knowledge_map({ env: "DATABASE_URL" })` answers "which files read this variable, and is it declared?" — a question that previously took a repo-wide grep plus a manual `.env.example` cross-check.

The producers were the point: `env-schema`, `migrations`, and `build-ci` rendered markdown tables and threw the structure away — the env scan collapsed per-file hits into one Set. Each now exposes a structured collector (the `collectRoutes` precedent) with the rendering derived from it, byte-identical. And a fix with a story: the store's edge delimiter was a **raw NUL byte in the source**, which made git treat `knowledge-map.js` as binary — increment 1's own PR diff was unreviewable because of it. Now the escaped form, with a regression test pinning the file stays text.

**Tags:** `env:<NAME>` · `reads-env` · `collectEnvReads` · `SCHEMA_VERSION 2` · `NUL escape` · `#543 increment 2` · `#629` · `PR #630`

**Impact:** on sigmap itself: 13 env-var, 13 migration, 52 script nodes and 24 reads-env edges appear; v1 caches rebuild automatically; the store source is git-diffable text from now on. 25 fixture + 158 integration tests passing (knowledge-map suite 7 → 14).

---

### v8.41.0 — one map over every graph ✓ (2026-09-14)

**Minor release — increment 1 of the #543 unified-knowledge-map epic.** SigMap already extracted five overlapping views of a repo — the signature index, the dependency graph, the call graph, the installed-library index, and the route table — but they answered questions separately. `src/map/knowledge-map.js` assembles them into **one typed store**: nodes for files, symbols, `library@version` pins, and routes; edges for `imports`, `calls`, `defines`, `tests`, `uses-lib`, and `exposes-route`. No new scan — the map is built from what the existing passes already know, serialized canonically (sorted keys, NUL-delimited edge identity so route ids containing spaces survive round-trips), and cached at `.context/knowledge-map.json` keyed on context mtime.

The first consumer is the **`query_knowledge_map` MCP tool — the 22nd**: `library` answers the upgrade-impact question ("what breaks if I bump `zod`?" — lib → importing files → their dependents → covering tests), `file` returns every typed edge touching one file, and no arguments returns the node/edge census. Path identity was the hard part: the graph builder lowercases keys and macOS tmpdirs are symlinks, so the store realpath-normalizes and matches through a lowercased abs→rel table. Later increments re-base `get_impact`, `get_architecture_overview`, and evidence packs as views over this same store.

**Tags:** `src/map/knowledge-map.js` · `query_knowledge_map` · `typed nodes/edges` · `canonical serialization` · `#543 increment 1` · `#626` · `PR #627`

**Impact:** first cross-source query surface (lib → files → dependents → tests in one call); 22 MCP tools; schema-versioned cached store. 25 fixture + 158 integration tests passing.

---

### v8.40.0 — two languages, and the map that lied ✓ (2026-09-14)

**Minor release — the #541 ranked build list is complete.** **Elixir** (Tier 3, the Lua/Ruby family): `defmodule` blocks with `@moduledoc` hints, `def`/`defp`/`defmacro` with `when` guards stripped and pattern matches reduced to their binding names, `@spec` as return hints, `@doc` first sentences as doc hints — and deps that genuinely resolve, `alias`/`import`/`use` module names becoming graph edges via the `lib/` snake_case convention. **Astro**: frontmatter delegated to the real TypeScript extractor with line-preserving anchor shifts, plus the surface exported-only passes cannot see — the `Astro.props` destructure, file-local functions, awaited data-loading consts, and template component usages.

Wiring Elixir exposed the release's real story: the CLI core kept **its own copy** of the extension→extractor map — a third resolution map, the drift class #591 eliminated — and the copy lacked `.lua` and `.gd`. **Lua and GDScript had been silently falling to the generic fallback in the generate pipeline** while their extractors passed every direct test. Deleted, not patched: resolution delegates to `dispatch.js` (verified a strict superset first), with an end-to-end regression test pinning that `.lua` and `.ex` reach their real extractors through the CLI.

**Tags:** `elixir.js` · `astro.js` · `EXT_MAP drift` · `dispatch delegation` · `#538` · `#539` · `#541 complete` · `PR #623` · `PR #624`

**Impact:** 35 languages / 49 extractor modules; Lua and GDScript restored in the generate pipeline; Elixir deps produce real graph edges. 25 fixture + 157 integration tests passing.

---

### v8.39.0 — the tag name is the API ✓ (2026-09-14)

**Minor release — web components stop being invisible.** The TS/JS extractors saw a Lit or Angular component's class and methods but lost what makes it a component: the `@customElement` tag, `@property`/`@state` reactive fields, Angular's selector and `@Input`/`@Output` pairs, and the base class. For an agent those ARE the public surface — a query for `user-card` could never find `UserCard`. Component classes now print their base, their tag or selector, and their typed reactive fields, in both TypeScript and JavaScript, including the vanilla `customElements.define` path.

The mechanism is deliberately not a new extractor: it is decorator-aware enrichment in the hooks/Zustand idiom family, gated on detecting a component marker — and a marker separated from its class by real code refuses to attach (decorators-only gap, pinned by test). Byte-identity for everything else was verified the project's way: not asserted, but swept — 1,291 real files across five codebases, zero divergence.

**Tags:** `component-surface.js` · `@customElement` · `@Component` · `customElements.define` · `#537` · `#541 rank 1` · `PR #621`

**Impact:** Lit/Angular/vanilla component API surface (tags, selectors, reactive fields, bases) now extracted; non-component output byte-identical across 1,291 swept files. 23 extractor + 156 integration tests passing.

---

### v8.38.0 — the ladder is complete ✓ (2026-09-14)

**Minor release — T4 SCIP import, and with it every checkbox on the #542 host-toolchain epic.** `exactness: { scip: true }` reads a CI-produced `index.scip` at the repo root as a signature source: compiler-typed signatures, free at extraction time, import only. The parser is a ~100-line **zero-dependency protobuf wire reader** — field numbers grounded from the scip bindings scip-typescript vendors, validated against a real index that tool produced. The compiler's own rendering rides in the `documentation` fences (`function fetchUser<T extends { id: string; }>(id: string, opts?: ...)`), definition occurrences anchor start lines, `enclosing_range` the real ends, and `Metadata.tool_info` names the acceptance-gated header label.

Measured on zod with a real 11 MB index (parsed once, ~0.4s): 228 of 286 files served, **zero quality-guard refusals**, and effective signatures **1,185 → 8,173 (+590%)**. The whole ladder on one corpus: regex floor 1,185 · T2 repo-local compiler 1,831 · T4 SCIP 8,173 — every tier dark by default, silently falling back, measured on real corpora, and honesty-labeled in the generated header. Hermetic tests write their own valid index with a ~30-line wire writer, so CI needs no SCIP tooling.

**Tags:** `src/scip/reader.js` · `exactness.scip` · `protobuf wire format` · `quality guard` · `T4` · `#542 complete` · `#618` · `PR #619`

**Impact:** zod effective signatures +590% with a CI-produced index; default output unchanged everywhere (flag ships dark). The #542 tier ladder — T1 regex → T2 repo compiler → T3 LSP → T4 SCIP — is fully delivered. 23 extractor + 155 integration tests passing.

---

### v8.37.1 — ninety-three percent of everything ✓ (2026-09-14)

**Patch release — one function was 93.6% of the runtime.** A CPU profile of the 15-second self-generate landed almost entirely on the two JSDoc `@returns` regexes in `buildReturnHints`: lazy `[\s\S]*?` gaps free to scan across comment boundaries, so every docblock without a matching declaration tail walked toward end-of-file — O(n²) on docblock-dense files, and the true cause of the CI timeout flakes v8.37.0 had recalibrated around. Rewritten as one linear docblock pass with sticky declaration matches: **15.0s → 0.97s**, CI suite wall-time roughly halved.

The correctness check paid unexpectedly: compared against the old implementation on 947 real files, all 13 divergences were the old pattern's own bug — the unbounded gap could bind a hint across an intervening comment to a later declaration, so `composeHealth` carried a distant `object` tag instead of its own docblock's type and express's `stringify()` was labeled `ServerResponse`. Fixing the performance fixed the data.

**Tags:** `buildReturnHints` · `catastrophic backtracking` · `linear docblock pass` · `#615` · `PR #616`

**Impact:** full self-generate 15.0s → 0.97s (15×); CI test jobs ~3m30s → ~1m40s; 13 mis-bound return hints corrected across real corpora; gate hit@5 identical, baseline re-recorded (MRR −0.001). 23 extractor + 154 integration tests passing.

---

### v8.37.0 — one client, every language server ✓ (2026-09-14)

**Minor release — the T3 rung of #542, and the tier ladder's first server-agnostic step.** `exactness: { lsp: true }` asks a language server the machine already has for `textDocument/documentSymbol` — clangd (ships with Xcode CLT) measured; gopls/rust-analyzer registered; `exactness.lspServers` maps any extension to any server command. The client is ~90 lines of the same JSON-RPC-over-stdio SigMap already speaks as an MCP server, run in reverse and **pipelined synchronously**: all six frames written up front via `spawnSync`, responses parsed from captured stdout, ~300ms per file cold and free on cache hits (content hash + server binary keyed).

Measurement forced the release's defining feature: the **per-file quality guard**. A server parsing a file standalone can be macro-blind — clangd reported 7 of `fmt/format.h`'s hundreds of symbols because `FMT_BEGIN_NAMESPACE` never expanded without a compilation database — so an LSP result is accepted only when it does not lose surface vs the regex tier, ties to LSP for exact anchors. Guarded, the tier cannot regress: libuv (C) +37%, spdlog +15%, fmt +2% effective signatures, with the macro-blind 16 of fmt's 19 files correctly refused per file. A transient-failure lesson landed too: only a true spawn error retires a server for the run, after one per-file null had silently cost 12 of 19 files. Toolchain honesty composes — `toolchain=typescript@5.9.3, clangd@21.0.0` when both tiers serve.

**Tags:** `src/lsp/client.js` · `exactness.lsp` · `lspServers` · `quality guard` · `T3` · `#542` · `#612` · `PR #613`

**Impact:** effective signatures with clangd: libuv +37%, spdlog +15%, fmt +2% — strictly non-losing by construction; default output unchanged everywhere (flag ships dark). Hermetic fake-server tests cover the full protocol path in CI. 23 extractor + 153 integration tests passing.

---

### v8.36.0 — the compiler was already installed ✓ (2026-09-14)

**Minor release — the first rung of the #542 host-toolchain ladder.** `exactness: { typescript: true }` parses `.ts` with the **target repo's own** `node_modules/typescript` — the user's install, never bundled, the lib-index precedent applied to parsing. Shipped dark behind the flag: every failure shape (off, absent, unusable, parse error) falls back to the regex tier byte-identically, and when native extraction fires the generated header records `toolchain=typescript@<version>`, so the determinism boundary is stated rather than implied.

Measurement reshaped the plan twice. First, **typescript@7 — the Go-native compiler and current npm latest — exposes no classic compiler API** through its CommonJS entry (only `version`; the AST lives behind `unstable/*` exports), so the resolver rejects it by design and 7.x repos stay on the regex floor: tsgo speaks LSP, which is exactly the ladder's T3 tier, not T2. A hermetic test pins that package shape. Second, the regex tier proved stronger than assumed — the balanced scanner (#526) already handles multiline params — so the native win concentrates where regex structurally cannot go: typed arrow consts whose annotations contain `=>` (the `[^=]+` guard cannot cross them), exact end-line anchors for multiline type aliases and functions, and not inventing "members" from nested object-type literals.

**Tags:** `typescript_native.js` · `exactness.typescript` · `toolchain label` · `T2` · `#542` · `#609` · `PR #610`

**Impact:** zod (286 files, typescript@5.9.3): 0 parse failures · 256/286 byte-identical · signatures 1,185 → 1,831 (+54%), audited class by class. Default output unchanged everywhere — the flag ships off. 23 extractor + 152 integration tests passing.

---

### v8.35.0 — the instrument was the bug ✓ (2026-09-13)

**Minor release — four issues closed, and three of them turned out to be the measuring equipment.** The retrieval gate had disagreed with a developer clone for two releases: same commit, same files, hard 72.2% in CI vs 73.3% locally, cause unknown after four investigated-and-retracted mechanisms. The answer was one loop: the graph-boost hop-1 pass evaluated its seed condition (`score > 0`) *while mutating scores in place*, so a zero-scored file boosted by an earlier-visited seed became a seed itself — but only when it sat after its booster in the index, and index order is what git history changes via the recent-commits hoist. 108 of 113 gate queries carried such cascade seeds; reversing index insertion order alone changed the top-5 on 76 of 113 tasks. Seeds are now snapshotted before the loop (the call-graph block always did this, with the comment "so boosts never cascade") and hop-2 eligibility is frozen after hop-1. Ranking is bit-identical across insertion orders and git depths, and hard *rose* to 75.6% as cascade noise stopped crediting near-hub files into top-5 slots they had not earned. The baseline is re-recorded and trustworthy for the first time in three releases.

That trustworthy gate immediately paid twice. The **extractor ceiling raise** — attempted before and rejected when CI read it as 75.6% → 72.2% — re-measured as bit-stable: the rejection had been the gate's order-instability, not the change. Member ceilings 8 → 120, per-file 25–50 → 200, and class-body scans 2–5 KB → 200 KB (11 extractors), un-hiding the 43–71% of member surface the issue had measured on Swift/PHP/Kotlin/Scala/C# repos — akka's `scaladsl/Source.scala` went from 8 members with a wrong end anchor to 48 typed members spanning `:241-1033`. And the **petclinic mystery** (#592) dissolved under measurement: not a ranking weakness at all, but the token-budget drop order running *inverted* on JVM repos — `isTestFile()` never matched `src/test/**` or `*Tests.java`, so the budget kept all 17 petclinic test files while dropping the application entry point and every owner template. Path-segment and PascalCase test conventions plus an entry-point drop tier fixed it: petclinic 60% → 80%, vapor 0% → 20%.

Separately, the **MCP server now passes `@hasmcp/mcp-spec-test` on both revisions it was reported failing**. One line caused both reports: `initialize` echoed back any offered `protocolVersion`, which is itself the 2025-11-25 violation — and it made the suite believe 2026-07-28 was supported, producing six phantom `server/discover` failures. Negotiation now runs against an explicit supported list, session-less `server/discover` is implemented per the 2026-07-28 schema (advertising only versions actually served), and `tools/list` rejects cursors it never issued.

**Tags:** `graph-boost cascade` · `order invariance` · `isTestFile` · `isEntryPointFile` · `MAX_CLASS_BODY_CHARS` · `server/discover` · `protocol negotiation` · `#544` · `#545` · `#576` · `#592` · `#596` · `PR #604` · `PR #605` · `PR #606` · `PR #607`

**Impact:** hard hit@5 72.2% → 75.6% (order-invariant, identical in CI and local); petclinic matrix retrieval 60% → 80%; member surface un-hidden at 1–2pp token cost on member-heavy repos; both MCP conformance verdicts now "conformant on what could be checked"; baseline re-recorded. Fresh full run: 96.6% token reduction · 78.6% hit@5 (1.73× vs grep) · 43.4% prompt reduction. 23 extractor + 151 integration tests passing.

---

### v8.34.0 — Lua, and two graphs that were silently empty ✓ (2026-09-13)

**Minor release — the first community language extractor, plus two more instances of the release's recurring theme.** [@zerone0x](https://github.com/zerone0x) contributed a Tier-3 **Lua** extractor: global and local functions, module-table methods (`function M.name` / `function M:name`), assigned functions, `require` module hints, and LDoc `---` comments as first-sentence hints. It arrived with its own fixture *and* recorded expected output — precisely what the #588 fixture guard requires, contributed before that guard existed. Preparing it for merge needed only conflict resolution against three releases it predated, plus bringing its caps up to the disclosure convention it was written before: they now report the true overflow instead of truncating silently, ceiling unchanged.

The **Kotlin and Scala call graphs were empty** — not degraded, empty. `extractDefs` returned null for both and the file walk did not collect them at all, so every symbol and every edge was missing. An empty graph returns no error, so `--impact` and blast radius silently read zero: the same failure that cost a release in v8.31.0. It survived because akka (Scala) sits in the gated JVM retrieval corpus, which measures *ranking*, not edges — CI exercised Scala daily in a way that could never detect the gap. Both languages now produce definitions, including expression bodies (`fun f() = expr`, `def f: Int = expr`) that Java has no equivalent of. The scope is pinned by an explicit test rather than described optimistically: same-file calls resolve, cross-file *receiver* calls do not yet, because receiver typing is Java-shaped and does not read `private val repo: Repo`.

Finally, generated `context-*.md` splits from a previous `strategy` stopped polluting retrieval. They are discovered by filename pattern at read time, never checked against the current config, so a file left by an earlier strategy — or by a module since dropped from `srcDirs` — kept being merged into the index. On a 524-file Java repo a stale 376 KB split held ranks 1, 3 and 4 with generated entities, one of them unrelated to the query, while both files implementing the feature fell outside the top 6 — and `sig-index.json` held zero entries for that module the whole time. Deleting the file was the only change needed to fix the ranking. The read side could not simply ignore splits, because under `per-module` they are the only place signatures live, so each strategy now declares what it wrote and the rest is pruned — reported, not silent.

**Tags:** `lua.js` · `ktDefs` · `scalaDefs` · `jvmBodyRange` · `pruneStaleContextSplits` · `#540` · `#555` · `#586` · `PR #550` · `#601` · `#602`

**Impact:** 33 languages / 43 extractors (Lua added); Kotlin+Scala call graph 0 symbols and 0 edges → 8 and 2 on a small tree; stale-split pollution removed at generate time. 148 test files passing, 0 failed. Headline metrics unchanged — 96.8% token reduction, 78.9% hit@5.

---

### v8.33.0 — the same bug, four times, finally named ✓ (2026-09-13)

**Minor release — four issues that turned out to be one bug wearing different clothes: something omitted, with nothing saying so.** v8.32.1 fixed extractors that truncated silently. This release finishes the pattern one level up. The generated artifact drops files to fit the token budget and said so only on **stderr** — which an agent reading the file never sees. On flask that meant 25 of 51 files present with no indication the other 26 existed, indistinguishable from a 25-file repo. `applyTokenBudget` now attaches a summary to what it returns, so every call site gains a footer naming the counts, the reason, and where to get the rest. The wording is deliberate about what is *not* true: the omitted files remain in the retrieval index, so the notice says so, and a test asserts it does not overstate — replacing a misleading silence with a misleading warning would be no improvement.

The same shape appeared in the test tooling. `--diagnose-extractors` had been printing a silent `SKIP` for `vue_sfc`, because `test/expected/vue.txt` outlived the `vue.js` deleted in v8.32.1 — and a SKIP reads like a pass at a glance. Eight languages had no fixture at all, which is *why* v8.32.0 shipped undisclosed caps in `markdown`, `properties` and `toml`: no test could observe output nobody generated. Every language now has a fixture and a guard that fails when one is missing. The guard earned itself immediately by finding a **ninth** the issue had not listed — `typescript_react`, which is `.tsx`, every React component, and the extractor that shipped a silent cap. The diagnostic went from 21 passing with an unnoticed SKIP to 32 passing with none.

Underneath both sat a structural cause. Three places decided which extractor module to load, and two had drifted: `analyzer.js` carried a dead duplicate `.vue` key hidden by JavaScript's last-key-wins, and the `--diagnose-extractors` map still pointed at a module that had been deleted. That is how an unreachable extractor survived unnoticed long enough to receive a fix in v8.32.0. The hand-maintained copy was also simply incomplete — no `.gd` entry — so gdscript was never diagnosed despite having both a fixture and recorded output. Resolution now has one source. `language-detector.js` and `dashboard.js` stay separate on purpose: they map `.tsx` for language *statistics* and display *labels*, and folding them in would miscount languages. A test pins that distinction so a future cleanup cannot quietly break it.

Finally, NestJS route paths compose their `@Controller` prefix. `@Controller('cats')` + `@Get(':id')` emitted `:id`, a path matching nothing a user would ask about — which defeats the entire point of route pseudo-signatures, since they exist so a route-worded query can reach a controller whose signatures never mention the path. The prefix is attributed per controller rather than per file, because a file may declare several. The other six claimed frameworks were verified unchanged in the same run.

**Tags:** `applyTokenBudget` · `__omissions` · `formatOutput` · `extractor-fixture-coverage.test.js` · `extension-map-single-source.test.js` · `nestjs-route-prefix.test.js` · `nestControllerPrefixes` · `#585` · `#587` · `#588` · `#591` · `PR #595` · `#597` · `#598` · `#599`

**Impact:** `--diagnose-extractors` 21 → 32 passing, no SKIPs; every one of 32 language extractors now has a fixture and recorded expected output; extractor resolution reduced from three drifting copies to one; 146 test files passing, 0 failed. Headline metrics unchanged — 96.8% token reduction, 78.9% hit@5 — as expected for a release that touches no ranking code.

---

### v8.32.1 — the audit that read its own release notes ✓ (2026-09-13)

**Patch release — v8.32.0 claimed "every extractor now discloses what a ceiling dropped". It did not.** An end-to-end audit — generate 80 symbols per language, run the *real dispatched* extractor, check for a marker — found three ways the claim was false. `vue.js` was registered in the dispatcher but **unreachable**: `.vue` resolves to `vue_sfc`, so the previous release added disclosure to dead code while the live handler kept truncating silently. Four reachable extractors still cut output with a bare `slice()` — `.tsx` (every React component), `.properties`, `.toml` and `.md`. And `r.js` called `capWithNotice` but **eight** inner caps stopped collection at the ceiling, so it never fired; forced to fire, it reported `+1 more` where 50 signatures were hidden. The root cause was not carelessness but coverage: three of those languages have no test fixture, so no test could observe their output.

The same audit found something larger. Installing the actual competitors — repomix, universal-ctags, gitingest — and running them head-to-head on `spring-petclinic/src` showed SigMap at 292 characters per covered file against repomix `--compress` at 2,868, roughly **ten times denser**. But it also showed SigMap indexing **6 of 47** Java files. `maxDepth: 6` suits the JS/Python-shaped trees it was tuned on; Java puts one directory per package segment, so `OwnerController.java` and every other file one package deep was invisible. v8.31.0 had already raised the *dependency-graph* walk to 12 for exactly this reason — extraction was the shallower half of an inconsistent pair, resolving edges into files the signature index had never seen. The walk now deepens to 12 for JVM layouts only; deepening globally was measured first and rejected, because it added candidates to every repo for no gain.

That fix moved a published number, and the movement is the honest part. Headline hit@5 goes **81.1% → 78.9%**, and exactly one of eighteen repos accounts for it: spring-petclinic falls 100% → 60%. That 100% was measured against an index holding 6 of 47 Java files — ranking five hand-written tasks is easy when 87% of the repo is missing. The leak-free `mined` corpus stayed flat and the leak-free `jvm` corpus rose 16.4% → 23.0% on the same change, so the prior figure was inflated by under-indexing rather than this being a ranking regression. The two regressed tasks are tracked as a ranking weakness the missing files were concealing.

Four guard tests were de-hardcoded along the way, each of which had begun failing on a *correct* value: one pinned the banner to `81.1%` while its own title said 75.6%, and another required `81.1%` while blocklisting `78.9%` — doubly self-invalidating once the benchmark legitimately returned to it.

**Tags:** `vue_sfc` · `typescript_react` · `capWithNotice` · `_isJvmLayout` · `_applyJvmDepth` · `JVM_MAX_DEPTH` · `extractor-reachability.test.js` · `jvm-walk-depth.test.js` · `#582` · `#583` · `#584` · `#590` · `PR #589` · `#593`

**Impact:** JVM corpus 16.4% → 23.0% (+6.6pp); spring-petclinic Java coverage 6/47 → 42/47; 4 reachable extractors gained disclosure and `r.js` now reports the true overflow (`+50`, not `+1`); a reachability test fails CI if any registered extractor becomes unreachable. 142 test files passing, 0 failed.

---

### v8.32.0 — The gate cried wolf, so we built one that doesn't ✓ (2026-09-12)

**Minor release — the retrieval gate was measuring the repository it was defending.** The `hard` corpus scores SigMap against its own source, so its BM25 statistics shift whenever the indexed file set changes — including when the change cannot possibly affect ranking. This was not argued, it was proven: a probe branch containing **one two-assertion test file and no source change** scored 75.6% → 74.4% and failed the gate. A gate that fails honest work is worse than no gate, because it teaches you to override it. `hard` is now held to its **70% floor** rather than to the previous run; the floor, the leak assertions, and `--no-regress` on `mined` and `jvm` remain enforced.

Underneath that sat a plainer defect: the gate reused `.context/sig-index.json`, which is gitignored. A stale artifact was therefore indistinguishable from a regression — a trap that consumed **three separate false investigations**, one of which ended in an unnecessary re-baseline. Every index the gate scores is now regenerated, including one per JVM repo, driven from `benchmarks/config-overrides.json` rather than a hand-written config dropped into the repo under test (the exact cross-suite skew #522 established). A re-run now reproduces all four corpora at +0.0pp.

The structural fix is a corpus that sits **outside the feedback loop**: 61 tasks mined from `spring-petclinic` (32) and `akka` (29), verified leak-free, scoring against repositories SigMap's source cannot move. It earned its place the day it landed by catching a real one-task regression (18.0% → 16.4%) in the same release's extractor change — and the cause was identified rather than absorbed. `akka:m018` expects `Logging.scala`, which holds a class the 8-member ceiling truncates, so disclosing the truncation adds one `… +N more methods` line and BM25's document-length normalisation drops it from rank 5 to 6. A fix excluding markers from the scored term space did not move the number and was reverted rather than left in as unexplained complexity.

That extractor change closes a documentation lie. `KNOWN_LIMITATIONS.md` has long promised that caps are "cut with a `… +N more signatures` notice" — but only the JS/TS/Java paths actually did it. **20 extractors** truncated silently, so an eight-method class and a forty-method class were indistinguishable in the output, and the drift-guard test never caught it because it only checks that the tier names are named. All 23 were believed to disclose — **that was wrong, and a later audit corrected it**: `vue.js` was dead code (`.vue` dispatches to `vue_sfc`), so one of the 20 was unreachable; `.tsx`, `.properties`, `.toml` and `.md` still truncated silently; and `r.js`'s own disclosure was defeated by eight inner caps. Fixed in #589. The ceilings themselves are deliberately unchanged: raising them is a separate decision that needs its own measurement, and this release built the corpus that can measure it. Finally, a markdown guard closes the hole that broke the v8.31.0 Pages deploy *after* the tag was pushed — an unbalanced fence or a stray Vue interpolation outside a code block now fails a test instead of a release.

**Tags:** `run-retrieval-gate.mjs` · `retrieval-jvm-spring-petclinic.jsonl` · `retrieval-jvm-akka.jsonl` · `mine-corpus.mjs --repo` · `config-overrides.json` · `capWithNotice` · `capMembersWithNotice` · `docs-markdown.test.js` · `#573` · `#575` · `#576` · `PR #574` · `#577` · `#578` · `#579`

**Impact:** 61 new gated tasks against external repos, 0 leaking; 19 reachable extractors gained disclosure (4 more were missed and fixed later in #589); the gate is reproducible — a clean re-run reports hard 75.6%, mined 60.9%, easy 90.0%, jvm 16.4% at +0.0pp on every corpus. 140 test files passing, 0 failed.

---

### v8.31.0 — The Java graph was empty, and nothing noticed ✓ (2026-09-08)

**Minor release — three hard-coded assumptions that a repo is JS-shaped and shallow.** `buildFromCwd` pinned `srcDirs` to `src`/`app`/`lib`/`R`/`inst` and never consulted the project config, then capped its walk at 8 directories. On a 524-file Spring repo that produced a **completely empty dependency graph** — 0 nodes. Java package-import resolution already worked (`com.macro.mall.X` → `com/macro/mall/X.java`); it was simply never reached. With the config honoured and the cap lifted: 524 nodes, 341 with importers. Because `imported_by_count` was 0 for every Java file, everything downstream was silently dead: `--impact` reported no importers, centrality contributed nothing, and any blast-radius scoring weighted by caller centrality degenerated to zero.

The call graph carried its own copies of both caps plus a third defect: `callsInRange` discarded every `receiver.method(` call as unresolvable. In Java that is essentially all inter-object calls — **1,461 of 2,516 call sites (58%)** in one Spring module — so controller→service edges did not exist. Receiver types are now resolved from field and local declarations and mapped to a file by the JVM convention that a public type lives in a like-named file. Interface method *declarations* are indexed as nodes: they emit no calls, but in Spring the declared interface is what callers name, so without them every edge had no target. Unresolvable receivers still produce no edge — chained and computed receivers are skipped rather than guessed. Spring goes one hop further: a single implementation, or a single `@Primary` among several, links the caller to the code that actually runs; anything still ambiguous is left alone.

None of this was gated. Every gated retrieval corpus is JavaScript, and a retrieval corpus measures ranking, not edges — so a JVM call-graph gate was added instead, asserting named caller→callee pairs and edge volume, and verified by simulating a revert. Separately, `sigmap lines` closes the loop for MCP-less agents: `ask` was handing out precise anchors with no sanctioned way to spend them, and a measured Copilot session read 2,659 tokens where the anchored window needed 217.

**Tags:** `buildFromCwd` · `_configuredSrcDirs` · `callsInRange` · `receiverCallsInRange` · `buildTypeMap` · `javaTypeDecl` · `edgeConfidence` · `sigmap lines` · `validate:callgraph-jvm` · `#560` · `#562` · `#564` · `#566` · `PR #561` · `#563` · `#565` · `#567` · `#568`

**Impact:** on macrozheng/mall (524 Java files) the call graph went from **0 symbols and 0 edges to 13,417 and 10,492** (9,837 high / 376 medium confidence), and blast radius on an implementation stopped being empty. 38 new tests across four files, each verified to fail against its pre-fix implementation. The retrieval baseline was re-recorded: the hard split moved 76.7% → 74.4% purely because the index is regenerated under a token budget and this release added ~1,000 lines — holding the index fixed, pre- and post-merge code give identical results and the same 23 misses, and MRR rose 0.639 → 0.644.

### v8.30.0 — Java made visible, and an invokable loop for MCP-less agents ✓ (2026-09-07)

**Minor release — three hard-coded caps were hiding most of a Java codebase, and the fix exposed a second problem.** The Java extractor capped every class at 8 members *silently* (JS/TS disclose omissions via `capMembersWithNotice`; Java just dropped them), hard-capped each file at 25 signatures regardless of `maxSigsPerFile`, and stopped scanning a class body after 5,000 characters. On `macrozheng/mall` that hid **10,415 of 12,250 public methods — 85% of the API surface**; `search_signatures setNote` returned nothing even though the symbol existed, so agents fell back to bulk-reading whole files instead of jumping to a line anchor. Lifting the caps took the index from 3,768 to 8,468 symbols.

Making every member visible then surfaced a ranking problem it had been masking. Each generated MyBatis/JPA entity carries an accessor per column, so it matches a query on any column name it happens to have — and path-based penalties cannot see them, because generated entities live in ordinary source trees. Generated entities took ranks 1, 3 and 4 on an order-notes query, including one unrelated to orders, while neither file implementing the feature reached the top six. Data holders are now detected by **content** (≥80% trivial accessors, above a minimum member count) and demoted with the existing `generatedCode` multiplier, with the established escape hatch when the query asks for an entity, model, DTO or accessor. Entities stay retrievable by their own symbols — a test guards that the demotion does not undo the extractor fix.

Two client-integration fixes round it out. `mcp install vscode` wrote a top-level `mcpServers` key where VS Code requires `servers` with an explicit transport `type`: the file was written, the command reported success, and VS Code silently ignored it, so Copilot never saw the server. Older configs are now migrated rather than left in place. And `sigmap skills` gained **sigmap-task**, an invokable prompt skill for environments where MCP is unavailable — where the usage-maximizer is an always-on playbook that mostly names MCP tools, this one is called deliberately and every step is a shell command: `ask` → read the query context → open only the anchored ranges → change → `verify-ai-output` → regenerate → report.

**Tags:** `java.js` · `capMembersWithNotice` · `_isDataHolder` · `PENALTY_SIGNALS.dataHolder` · `WANTS_MODELS` · `_installVscode` · `sigmap-task` · `.github/prompts` · `#551` · `#553` · `#556` · `#558` · `PR #552` · `PR #554` · `PR #557`

**Impact:** 8,468 symbols indexed on a 524-file Java repo where 3,768 were reachable before; both target files return to the top 5 on the query that regressed. Retrieval corpus unchanged — hard +0.0pp, mined +0.0pp, MRR +0.002, gate `PASS`. 22 new tests across four files, each verified to fail against its pre-fix implementation (140 test files).

### v8.29.0 — Retrieval Index Split: the ranker stops reading the prompt ✓ (2026-09-01)

**Minor release — the index and the prompt wanted opposite things and were the same artifact.** The generated context file is token-budgeted because it is injected into every prompt; `buildSigIndex` parsed that same file, so retrieval inherited the budget and every file `applyTokenBudget` dropped became unreachable **at any rank** — 53 of 155 source files on this repo. No ranking change can surface a file that is not indexed. A complete index is now written to `.context/sig-index.json` before the budget is applied and before the strategy split, and merged as the base so uncollapsed signatures win. Because it is never injected anywhere, it can afford what a prompt cannot: module-header prose (the file's *purpose*, which is the vocabulary behavioural queries use) and test files (previously unscanned, so "where are the tests for X" had no answer at any rank).

Four ranking features turned out to be inert. The import- and call-graph boosts never fired: `ask` did not pass a graph, and the lookup could not have matched anyway because `builder.js` lowercased node keys while `call-graph.js` preserved case — every `.get()` missed on any checkout under `/Users/…` or `C:\Users\…`. `scoreFile`'s score was computed and discarded, which silently made `DEFAULT_WEIGHTS` and all seven intent profiles dead config. Penalties demoted test files even when the query asked for tests. And 27% of signatures leaked their line anchors into the term space, because the strip was end-anchored while doc hints follow the anchor. None of it was visible: `src/eval/runner.js` carried its own `rank` **and** its own `buildSigIndex`, so the benchmark measured a parallel implementation.

**Tags:** `sig-index-store` · `module-doc` · `path-key` · `applyTokenBudget` · `_mergeSigIndex` · `detectIntents` · `stripAnchor` · `retrieval-mined.jsonl` · `validate:retrieval` · `#546` · `PR #547`

**Impact:** hit@5 **45.0% → 76.7%** on a 90-task leak-free corpus, ranker changes only. A second corpus is mined from commit subjects paired with the files those commits touched — **authored by nobody tuning the ranker** — and reads 60.9%; the ladder it exposes (leaky 90.0% / self-authored 76.7% / independent 60.9%) is why it exists and is gated in CI. Prompt artifacts do not grow. 14 new guards, each verified to fail when its bug is reintroduced (139 test files).

---

### v8.28.1 — Two silent failures fixed ✓ (2026-08-22)

**Patch release — both bugs failed silently, which is the worst way to fail.** (1) **Python absolute imports** (#532, reported and precisely diagnosed by **@ruurdboeke**): `from package.module import` was resolved against only the importing file's directory and one parent, so `src/`-layout projects lost every graph edge from files nested two or more levels below the source root — and `get_impact` reported **zero importers**, exactly the false signal that says a change is safe. Fixed with an ancestor walk to the project root (nearest first, so existing resolutions keep identical semantics). (2) **Per-module strategy** (#534): the strategy's `context-<module>.md` split files were never merged into the signature index — only `context-cold.md` was — so `sigmap ask` died with "no context file found" and `query_context` returned nothing on every per-module repo. Fixed by generalizing the cold-file merge to every `.github/context-*.md` split, sorted and deterministic.

**Tags:** `extractFileDeps` · `ancestor walk` · `zero importers` · `_enrichSigIndexFromStrategy` · `per-module` · `#532` · `#534` · `PRs #533 #535`

**Impact:** `get_impact` is trustworthy on `src/`-layout Python repos; `ask`/`query_context` work under every strategy; 8 new regression tests (138 files).

---

### v8.28.0 — Arity Guard: calls checked against real signatures ✓ (2026-08-18)

**Minor release — D1 lands, and the tokenizer investment pays out.** New `src/verify/arity.js`: signature parameter lists (exact for JS/TS since v8.27's balanced scanner, exact for Python via the AST) become per-name arity ranges — defaults and TS optionals lower the minimum, `...rest`/`*args`/`**kwargs` mark variadic, destructuring counts as one parameter. Calls in answer code blocks are read over masked text (nested calls and comma-containing strings count correctly), and a call to a **known** repo function outside its `[min, max]` flags **`arity-mismatch` at medium confidence** with the actual repo signature and file as the suggestion. Wired as Hallucination Guard detector 3b, so `verify_suggestion` (MCP) and `sigmap verify-ai-output` inherit it with zero new surface. Precision comes from what it *refuses* to check: ambiguous names (signatures disagree across files), variadic overshoots, dotted method calls, indented members, and every language whose params aren't yet exact. Unknown symbols remain `fake-symbol` territory.

**Tags:** `arity.js` · `arity-mismatch` · `parseParams` · `buildArityIndex` · `extractCallArgCounts` · `D1` · `#529` · `PR #530`

**Impact:** verification now checks argument counts, not just existence — the first grounding capability no grep-based agent loop can replicate; 6 new tests incl. end-to-end (136 files); zero new dependencies.

---

### v8.27.0 — Tokenizer Core I: the balanced scanner, JS/TS unbroken ✓ (2026-08-18)

**Minor release — the v9.0 grounding track opens (G4 increment 1).** New `src/extractors/scan.js`: a hand-rolled scanning core — string-aware comment stripping, string/comment masking, and depth-matched delimiter reading — three deterministic, length- and newline-preserving passes that generalize the repo's own `maskJs` and `readBalancedParens` patterns. Explicitly not tree-sitter. Applied to the JS and TS extractors: every parameter capture that used to truncate at the first `)` is now depth-matched, so `f(a, b = g(x))`, string defaults containing `)` or `//` (`url = "https://x"` used to be corrupted by the naive comment strip), and destructuring-brace params all extract fully, with body and anchor endpoints computed from the real close. TS type annotations strip depth- and quote-aware (`cb: (x: number) => void` → `cb`; `m: Map<K,V> = new Map()` keeps its default). Shipped behind the **byte-identical-or-better gate**: the entire pre-existing exact-output test corpus passes unchanged, and 12 adversarial fixtures prove the new cases. This closes the JS/TS half of the nested-paren gap named in `KNOWN_LIMITATIONS.md` — the stated precondition for arity-checked verification (D1); Go/Java and the rest of Tier 2 follow in later increments.

**Tags:** `scan.js` · `stripComments` · `maskCode` · `readBalanced` · `byte-identical-or-better` · `G4` · `D1 precondition` · `#526` · `PR #527`

**Impact:** JS/TS params are now exact (arity-usable); string-corruption class fixed; 12 new adversarial tests (135 files); 43 extractor modules; zero new dependencies — no tree-sitter, still.

---

### v8.26.0 — Agent Economy III: sigmap skills, the pillar closes ✓ (2026-08-18)

**Minor release — the optimal usage loop becomes installable behavior, and the Agent Economy pillar (F1→F4) is complete.** New `src/skills/skills.js`: two canonical, deterministic skill documents — **sigmap-usage-maximizer** (F3: `ask` before any file read · `get_lines` for anchored ranges · `verify_suggestion` before trusting generated code · `squeeze` big logs/traces/JSON · checkpoint via `create_checkpoint`/`note` · check `get_budget` and summarize-then-drop near budget; token accounting reads the F1 ledger, no LLM calls) and **sigmap-config-optimizer** (the F2 playbook: `tune` → review reasons → `--apply` → `validate`). The installer mirrors the `mcp/install.js` CLIENTS pattern across five clients: Claude Code, Cursor, Windsurf, and Copilot get sigmap-namespaced native files; Codex gets a marker-delimited `AGENTS.md` block inserted **above** the signatures marker — the spot the codex adapter preserves on regeneration, proven by an end-to-end test that regenerates and checks the block, the human content, and the fresh signatures all coexist. Plain `skills install` wires only detected clients (the `--setup` only-touch-existing precedent); `--client`/`--all` create; every install is idempotent.

**Tags:** `sigmap skills` · `sigmap-usage-maximizer` · `sigmap-config-optimizer` · `installSkills` · `above-marker AGENTS.md` · `F3` · `F4` · `#517` · `PR #518`

**Impact:** the measured ~90% read-reduction loop is now default agent behavior, not documentation; Agent Economy pillar complete (F1 budget · F2 tune · F3+F4 skills); 8 new integration tests (132 files); zero new dependencies.

---

### v8.25.0 — Agent Economy II: sigmap tune ✓ (2026-08-18)

**Minor release — the discovery stack becomes a config optimizer.** New `src/config/tune.js`: `buildTuneProposal(cwd)` packages `resolveSourceRoots`, the workspace-marker probe, and client-artifact detection into a deterministic recommended-config diff — one evidence-naming reason per change, explicit user choices never proposed against. Five rules: **srcDirs pin** (confidence-gated; pinned srcDirs are stable across runs and protected from token-budget drops), **monorepo** (reason names the marker found), **adapters** (additive, from `CLAUDE.md`/`.cursorrules`/`.windsurfrules`/`AGENTS.md`), **exclude** (curated vendored/generated dirs at root, defaults preserved), **autoMaxTokens** (fires only when a pinned budget sits below a labeled ~25-tokens/file estimate). `applyTuneProposal` merges into `gen-context.config.json` preserving every user key and is idempotent — a second `tune` proposes nothing. CLI: read-only by default (`--dry-run` alias), `--apply` writes and hands off to `sigmap validate`, `--json` for agents. This is F2 of the Agent Economy pillar — the direct answer to the #1 onboarding failure (bad/default config), built entirely from detection code that already existed.

**Tags:** `sigmap tune` · `buildTuneProposal` · `applyTuneProposal` · `--apply` · `--json` · `F2` · `#514` · `PR #515`

**Impact:** config onboarding is now one command; 10 new integration tests (131 files); zero new dependencies, zero new detection code.

---

### v8.24.0 — Trust Quick Wins I: sigmap redact ✓ (2026-07-28)

**Minor release — the redaction engine goes standalone.** New `src/security/redact.js`: `redactText()` applies the existing 10-pattern secret bank to arbitrary text, masking only the matched substring (`[REDACTED:<pattern>]`) so surrounding context stays readable — the generation-time scanner's whole-line behavior is untouched. Findings carry 1-based line numbers and per-pattern counts. CLI `sigmap redact [file] [--json]` reads a file or stdin and keeps stdout pipe-clean (summary on stderr), so `git diff | sigmap redact` works as a pre-share hygiene step. A fitting validation: GitHub Push Protection rejected the first push of the test fixtures because the fake secrets pattern-matched real credential formats — fixtures are now assembled at runtime so no secret-shaped literal exists in any committed blob.

**Tags:** `redact.js` · `redactText` · `sigmap redact` · `--json` · `stdin` · `#511` · `PR #512`

**Impact:** the pattern bank now covers ad-hoc text, not just SigMap-generated surfaces; 6 new integration tests incl. an every-pattern sweep (130 files); zero new dependencies. Remaining v8.24 plan items (KNOWN_LIMITATIONS.md, SUCCESSION.md, issue triage) are non-code and land outside the release train.

---

### v8.23.0 — Agent Economy I: sigmap budget, get_budget ✓ (2026-07-28)

**Minor release — token savings become queryable *during* the session.** New `src/tracking/budget.js`: `budgetStatus()` turns the existing gain log into a session spend ledger — estimated SigMap-emitted tokens (spent/baseline/saved, op count), optional budget with remaining/percent-used, and generated-context age with a stale flag against `contextTtlDays`. Session identity is `SIGMAP_SESSION` (host-settable) or the UTC day bucket; `recordUsage` stamps every entry, and legacy entries match day buckets by timestamp prefix. Surfaces: `sigmap budget [--json] [--session] [--budget]` and the **21st MCP tool `get_budget`**, which advises degrade-gracefully tactics (terse encoding, `squeeze`, summarize-then-drop) at ≥80% budget. Scope honesty by design, per the improvement-plan audit: the ledger counts what SigMap emitted (chars/4, labeled `estimated-tokens` everywhere) — not the chat's total spend, which a CLI cannot see — and the unverifiable prompt-cache "injection TTL" idea was cut in favor of measurable context-file age. Config keys `sessionBudgetTokens` / `contextTtlDays`, both opt-in `null`.

**Tags:** `budget.js` · `budgetStatus` · `sessionKey` · `SIGMAP_SESSION` · `get_budget` · `sessionBudgetTokens` · `contextTtlDays` · `#508` · `PR #509`

**Impact:** 21 MCP tools; 7 new integration tests (129 files); zero new dependencies; F2–F4 of the Agent Economy plan (auto-tune, usage skill, multi-client skills install) queue next.

---

### v8.22.0 — Hard Corpus: no-leakage split, leakage gate, size buckets ✓ (2026-07-28)

**Minor release — the benchmark corpus stops grading itself on filename matching.** (1) **A3 leakage criterion:** new `src/eval/corpus.js` — a task *leaks* when its BM25-tokenized query shares a stemmed token with the tokenized basenames of its expected files; the criterion reuses the production tokenizer, so `payments` leaks against `payment.js` and camelCase basenames split exactly as the ranker sees them. `scripts/validate-task-corpus.mjs` is the CI gate: exit 1 if any `split: "hard"` task leaks (easy-split leakage is reported as info — it measured **90 of 110 pre-existing tasks leaking**). (2) **Hard split:** task JSONL carries an optional `split` field (`easy` default); 15 hand-authored, leak-free hard tasks land across express, flask, axios, fastify, and gin. (3) **Size buckets:** `benchmark:honest` now reports hit@5/MRR per split *and* per repo-size bucket (small <200 / medium ≤1000 / large >1000 files **scanned on disk** — deliberately not the budget-capped context index, which measures `maxTokens` rather than the repo). The result is the honest number the split exists to expose: **hard-split hit@5 33.3% vs the grep baseline's 53.3%** — with leakage removed, grep currently wins, which is the measured vocabulary-mismatch ceiling that repo-mined query expansion (B2, v9.0) is scheduled to attack. Also ships the MiniMax LLM-ablation provider (`MINIMAX_API_KEY`, OpenAI-compatible, default MiniMax-M3) — thanks **@octo-patch** (PR #504).

**Tags:** `corpus.js` · `queryLeakage` · `validateTasks` · `sizeBucket` · `validate-task-corpus.mjs` · `split: hard` · `benchmark:honest splits/buckets` · `minimax ablation provider` · `#505` · `PR #506` · `PR #504`

**Impact:** the corpus's leakage rate is now measured (90/110 easy tasks) and gated for hard tasks; the semantic-retrieval gap has a hard number (33.3% vs 53.3%); 8 new integration tests (128 files); zero new dependencies.

---

### v8.21.0 — Semantic Bridge II: Go/Rust/Java doc hints, centrality blend ✓ (2026-07-19)

**Minor release — the doc-comment bridge reaches three more languages, and the import graph gains a principled ranking prior.** (1) **B1b:** `buildDocHints` lands in the Go extractor (godoc `//` blocks above top-level `func`/`type`, compiler directives `//go:`/`nolint` skipped), the Rust extractor (`///` blocks above `pub fn`/`struct`/`enum`/`trait` and impl methods, `#[attr]` lines between doc and declaration tolerated), and the Java extractor (Javadoc on type declarations *and* public/protected members; tag-only blocks produce no hint) — first prose sentence, 60-char cap, `  # <hint>` after the anchor, byte-format identical to the Python/JS/TS hints. Hints are mined from the original source since `extract()` strips comments before matching. (2) **B3:** new `src/graph/centrality.js` — zero-dependency power iteration over the forward import graph (damping 0.85, 20 iterations, deterministic), max-normalized; `rank()` blends `0.3 × centrality` onto **positively-scored files only** as a tie-breaker (`signals.centrality`), gated by the new opt-in `retrieval.centralityBlend` and wired like `callGraphBoost` (MCP `query_context` + CLI `ask`/`--query`, non-fatal). The `benchmark:centrality-blend` A/B measured **both arms at 77.8% hit@5 (+0 tasks)** over 90 tasks / 18 repos — non-regressing but neutral on the lexical corpus, so the flag ships **off** per the measure gate; the v8.22 hard-split corpus is the next chance to show a real delta.

**Tags:** `buildDocHints (Go/Rust/Java)` · `centrality.js` · `retrieval.centralityBlend` · `signals.centrality` · `benchmark:centrality-blend` · `#501` · `PR #502`

**Impact:** doc hints on 6 languages total (Python, JS, TS, Go, Rust, Java); centrality prior measured +0 → shipped dark; 11 new integration tests (127 files); zero new dependencies.

---

### v8.20.0 — Semantic Bridge I: JS/TS doc hints, sigmap memory ✓ (2026-07-19)

**Minor release — the JS/TS extractors gain the doc-comment hints Python has carried for releases.** `buildDocHints` mines the first prose sentence of the JSDoc block preceding each top-level function form and appends it after the line anchor as `  # <hint>` — byte-format identical to Python's `extractDocHint`. A tempered comment-body pattern prevents cross-block misattribution (caught in smoke testing). The trade was measured and shipped honestly: hints add English tokens that compete on the lexical corpus — **hit@5 86.4% → 85.5% task-level (−0.9pt, one borderline task: `svelte-t002`), honest lift 2.02× → 2.00×**, grep baseline unchanged — shipped default-on per the v8.18 anchors precedent and Python-parity, with the semantic upside proven directly by a new vocab-mismatch fixture (a query fully disjoint from every identifier retrieves the file *only* via its hint; BM25 score 0 without). The v8.22 hard-split corpus will measure that upside at scale. Also ships `sigmap memory`: one inspect/prune view over the existing `.context/` cross-session stores (session, notes, weights, evidence, gain, usage) with `--json` and explicit `--clear` — no new storage.

**Tags:** `buildDocHints` · `firstDocSentence` · `sigmap memory` · `memory --clear` · `vocab-mismatch fixture` · `#498` · `PR #499`

**Impact:** doc hints on 3 JS + 2 TS top-level forms (Python-parity); measured −0.9pt lexical-corpus trade documented; 10 new integration tests (126 files); memory command over 6 existing stores; zero new dependencies.

---

### v8.19.0 — Honest Numbers: measured grep baseline, random-baseline lift retired ✓ (2026-07-19)

**Minor release — the published retrieval lift now comes from a measurement, not a strawman.** The old headline compared hit@5 against random file selection (`min(1, 5/fileCount)` ≈ 13.6%) — a 6.4× lift nobody could defend. The new `npm run benchmark:honest` (`scripts/run-honest-benchmark.mjs`) scores the production ranker against an **internal single-shot grep-agent baseline** — a pure-Node, zero-dependency, child-process-free repo scan ranked by distinct-term coverage then occurrences, `.gitignore`-aware — on the same 110-task / 19-repo corpus with the same scorer. **Measured: SigMap 86.4% hit@5 / MRR .780 vs grep 42.7% / .228 → 2.02× lift (+43.6pt)**, reproduced exactly across independent runs. `grep_baseline_hit_at_5` + `grep_lift` flow from the report through `computeLatest` → latest.json → every human surface; task success is labeled a **retrieval-tier proxy** everywhere; and a claim-hygiene guard test makes the retired numbers a one-way door — 6.4×, 13.6%, and the unsourced "10% without" can never reappear on README or llms surfaces. (Release hygiene note: the benchmark ordering matters — the quality suite regenerates shared repo contexts with a default config, so `benchmark:honest` runs immediately after the retrieval harness, the same cross-suite-skew class the v8.16.1 hermetic fix addressed.)

**Tags:** `benchmark:honest` · `grep_baseline_hit_at_5` · `grep_lift` · `honest-baseline.test.js` · `claim hygiene` · `#495` · `PR #496`

**Impact:** honest lift 2.02× (+43.6pt) vs single-shot grep, measured and reproduced; 6.4×-vs-random retired from all human surfaces; 7 new guard checks (125 test files); zero new dependencies, zero child processes.

---

### v8.18.0 — Phase-2 closer: anchors everywhere, surface enrichment, live-loop framing ✓ (2026-07-12)

**Minor release — with these three changes, every §7.4 Phase-2 quality-ceiling row is done or measure-gated-closed.** (1) **Anchors:** the v8.17 recipe applied to Kotlin, Swift, PHP, Scala, and Dart — all five fixture files anchor 100%, bringing Surgical Context anchors to **9 brace languages**. (2) **Route surface-enrichment** (opt-in `retrieval.surfaceEnrichment`): `enrichWithSurfaces` appends deterministic `route METHOD /path` pseudo-signatures to the rankable index; the new `benchmark:surface-enrichment` A/B measured **+0** on the file-discovery-flavored 90-task corpus, so the default stays off — while the fixture test proves the value case directly (a route-worded query retrieves the controller *only* when enriched). (3) **Live-loop framing** (docs): the MCP guide now positions `query_context` → `get_callee_signatures` → `get_lines` → `verify_suggestion` → `get_method_impact` as what an agentic loop *calls for grounding* — grep finds; SigMap grounds.

**Tags:** `line-anchors` · `9-languages` · `retrieval.surfaceEnrichment` · `benchmark:surface-enrichment` · `measure-gated` · `live-loop` · `#486` · `#488` · `#490` · `PRs #487 #489 #491`

**Impact:** Phase-2 scorecard complete; anchors on 9 brace languages; 9 new integration tests (124 derived); two honest measured decisions recorded (+0 → dark); headline unchanged (87.8%).

---

### v8.17.0 — Line anchors for Java, Go, Rust, and C# ✓ (2026-07-12)

**Minor release — the §7.4 Lang ceiling's first concrete piece, and a long-named roadmap item.** Only the JS/TS/Python extractors emitted `:start-end` anchors; on Java/Go/Rust/C# repos every Evidence Pack had empty `sourceLines` and zero `anchorCoverage`, and `get_lines` (Surgical Context) had nothing to fetch. The four extractors now anchor everything — brace-matched real ranges on bodied types/functions, `:n-n` on single-line members, single-line anchors on Rust bodyless items. The hidden prerequisite was the fix that mattered: their comment strips collapsed block comments outright, so match indices could never map to true line numbers; the strips are now **newline-preserving** (regression-tested with a multi-line license header above declarations). Evidence Pack `anchorCoverage` goes **0 → 1.0** on those languages; `parseAnchor` round-trips every anchor.

**Tags:** `line-anchors` · `Surgical-Context` · `Java` · `Go` · `Rust` · `C#` · `newline-preserving-strip` · `#483` · `PR #484`

**Impact:** anchorCoverage 0 → 1.0 on 4 languages; `get_lines` usable across them; 5 new integration tests (123 derived); 4 expected fixtures regenerated (anchors only); remaining languages (Kotlin/Swift/PHP/Scala/Dart) follow the same recipe.

---

### v8.16.1 — Hermetic grounding benchmark (CI hygiene) ✓ (2026-07-12)

**Patch — benchmark isolation; the published package is unchanged.** A full benchmark sweep revealed that the grounding suite regenerated the shared cached repos with a plain default config, silently overwriting the retrieval harness's per-repo-scoped contexts — any later context-reading suite saw degraded indexes (the callgraph A/B measured 32.2% hit@5 instead of ~87.8%). `measureGroundingHermetic` now snapshots every context artifact before its regen and restores them byte-exactly after measuring. For a project whose pitch is deterministic, auditable numbers, cross-suite skew was a credibility bug of exactly the class the Trust Hygiene tier exists to kill — found and fixed the same day.

**Tags:** `benchmark-isolation` · `measureGroundingHermetic` · `snapshot-restore` · `#480` · `PR #481`

**Impact:** grounding → A/B parity verified (87.8% both sides, was 32.2%); no first-run retrieval transient; 3 regression tests (122 derived); headline metrics unaffected.

---

### v8.16.0 — Evidence Pack schema v2 ✓ (2026-07-12)

**Minor release — the last Machine-lever item from the master plan §7.4; with it, every Phase-1 and Phase-2 checklist item is shipped or measure-gated-closed.** Schema v2 is additive over v1: `schemaVersion: '2.0'` plus a `schemaUrl` pointing at a **published draft-07 JSON Schema** ([sigmap.io/schemas/evidence-pack-2.json](https://sigmap.io/schemas/evidence-pack-2.json)) so CI and agents can *validate* a pack, not just parse it. `files[].riskFactors` exposes every matched risk category in precedence order — a migration touching payments carries `['migration','payment']` — while `riskLabel` stays the dominant factor for v1 consumers. A `testDiscovery` provenance block states the measured accuracy of the related-tests method (**F1 0.98, precision 0.971, recall 0.988** over 3,701 pairs / 28 repos), with the constants guard-tested against the committed benchmark report so they can never silently drift. `generator: { name, version }` records what built the pack. Byte-stable; `contextHash` determinism preserved. _(Also the first published release carrying v8.15.0, which was prepared but never tagged standalone.)_

**Tags:** `evidence` · `schema-v2` · `schemaUrl` · `riskFactors` · `testDiscovery` · `generator` · `#477` · `PR #478`

**Impact:** packs are validatable against a published schema; multi-factor risk; measured related-tests provenance; 8 new integration tests (121 derived); v1 consumers unaffected (additive).

---

### v8.15.0 — Call-graph ranking boost, measured and shipped dark ✓ (2026-07-11)

**Minor release — the milestone item "call-graph edges into ranking" is done, and the default is OFF because the measurement said so.** `buildCallFileGraph` collapses symbol edges to deterministic file-level bidirectional edges; `rank()` gains an opt-in single-hop, hub-suppressed call-neighbor boost (`callHop: 0.30`, `callGraphBoost` explain signal), wired config-gated into `ask`, `--query`, and `query_context` via `retrieval.callGraphBoost: false`. The new `npm run benchmark:callgraph-boost` A/B ran 90 tasks across 18 cached repos through the full ranker: import-graph arm **80% hit@5**, +call-graph arm **80%** — delta **+0, no repo moved**. Per the measure-first gate the default stays off; the boost targets call-topology-heavy repos (Go/Java same-package) where import edges structurally can't see the relationship — a shape the benchmark corpus doesn't stress. The headline BM25 harness is untouched (87.8% reproduces). This is the philosophy working as designed: the feature exists, the number decides the default, and the A/B script is the standing gate for revisiting it.

**Tags:** `retrieval.callGraphBoost` · `buildCallFileGraph` · `callHop` · `benchmark:callgraph-boost` · `measure-gated` · `+0` · `#474` · `PR #475`

**Impact:** measured A/B +0 (80% → 80% hit@5) — default off; 5 new integration tests (120 derived); default-path ranking byte-identical; headline unchanged.

---

### v8.14.0 — Call-graph for Java, Go, and Rust (GR1) ✓ (2026-07-11)

**Minor release — the method-level call-graph goes from 2 to 5 languages.** New def extractors in `src/graph/call-graph.js`: Go `func` + receiver methods (parenthesized return lists handled), Java methods + constructors (generics/`throws` tolerated; control-flow keywords and `new Foo(){}` anonymous classes rejected), and Rust `fn` incl. generics + `where` clauses and `impl` methods (bodiless trait declarations skipped). A **lifetime-safe `maskRust`** masker lets `'a` lifetimes pass through while masking char literals and strings — the one place the JS masker would corrupt offsets. Because Go/Java call same-package functions across files with *no import statement*, same-directory same-language siblings join the resolution scope (sorted, deterministic). Every consumer inherits the languages with zero further changes: `--callers`/`--callees`, GR2 blast-radius scoring, `review-pr` method-blast findings, and `get_method_impact`. Per North-Star #1, unparseable constructs are skipped — never a parser dep.

**Tags:** `call-graph` · `Java` · `Go` · `Rust` · `maskRust` · `same-package-scope` · `GR1` · `#471` · `PR #472`

**Impact:** call-graph consumers now work on Go/Java/Rust repos; 9 new integration tests (119 derived); JS/TS + Python behavior regression-tested unchanged; benchmark headline unchanged (hit@5 87.8%).

---

### v8.13.0 — Method-level blast-radius scoring (GR2) ✓ (2026-07-11)

**Minor release — the biggest Phase-2 lever from the master plan's §7.4 scorecard.** The D4 method-level call-graph finally gets consumers. New `src/graph/blast-radius.js` reverse-BFSes each changed file's defined symbols and scores the change with a documented deterministic formula — `min(100, direct×4 + transitive×1)`, tiers none/low/medium/high/critical. Three surfaces consume it: `review-pr` attaches `methodBlast` and fires a `method-blast` finding on high/critical tiers; the **PR Evidence** report adds a per-file *Method blast radius* line (impacted function count, score/tier, top caller ids); and the new **`get_method_impact`** MCP tool gives agents per-symbol blast radius (callers) or dependencies (callees) — **19 → 20 MCP tools**. A reviewer now sees *which functions break*, not just which files. Graph optional: repos without a resolvable call graph degrade gracefully.

**Tags:** `blast-radius` · `method-blast` · `get_method_impact` · `20 MCP tools` · `review-pr` · `PR Evidence` · `GR2` · `#468` · `PR #469`

**Impact:** deterministic per-file blast score/tier in review output; 10 new integration tests (118 derived); dogfooded on its own diff — flagged `src/graph/builder.js` at score 37/100 (high, 19 impacted functions).

---

### v8.12.0 — `sigmap wiki`: deterministic architecture narrative (D9) ✓ (2026-07-11)

**Minor release — the final unstarted in-boundary item from the master plan's §3.5 backlog; D1–D9 are now all shipped.** `sigmap wiki` writes `.context/WIKI.md`, a one-page onboarding narrative composed entirely from data SigMap already computes: overview (indexed files, modules, signature tokens, health grade), a module rollup with key files, dependency flow (the hub files with the widest blast radius, entry points, cycle count from the import graph), a conventions summary, and navigation pointers. Template prose only — **no LLM, no network, no timestamps** — so two consecutive runs on an unchanged repo are byte-identical (regression-tested; the Philosophy Gate holds). `--out` overrides the path; `--json` emits the structured data. Graph paths are relativized against the builder's normalized base so hubs/entries render repo-relative even on macOS tmpdirs.

**Tags:** `wiki` · `.context/WIKI.md` · `--json` · `--out` · `no-LLM` · `byte-stable` · `D9` · `#465` · `PR #466`

**Impact:** the in-boundary backlog (D1–D9) is complete; 6 new integration tests (117 derived tests); zero new dependencies; benchmark headline unchanged (hit@5 87.8% — wiki adds no retrieval-path code).

---

### v8.11.0 — Terse signature encoder, measured (D7) ✓ (2026-07-11)

**Minor release — the master plan's last unstarted v8.5-tier item, shipped under its measure-first gate.** `--terse` (or `terse: true` in config) deterministically compacts every signature line — `function `→`fn `, tightened params/arrows/exports — while preserving the `:start-end` line anchor and any trailing doc hint byte-exactly, so `get_lines`, evidence packs, `parseAnchor`, symbol extraction, and ranker parse-back all keep working (regression-tested). Off by default: without the flag, output is byte-identical. The public number comes from the new `npm run benchmark:terse` gate run on the SigMap repo itself — never from another tool's prose-compression claims (the borrowed "65–75%" figure correctly did not apply).

**Tags:** `--terse` · `terse: false` · `src/format/terse.js` · `benchmark:terse` · `measure-first` · `D7` · `#462` · `PR #463`

**Impact:** measured −16.1% signature-block tokens (10,232 → 8,580 across 143 files / 780 sig lines); 15 new integration tests (116 derived tests); anchors byte-exact; default output unchanged.

---

### v8.10.0 — Honesty fixes across the CLI surface ✓ (2026-07-09)

**Minor — a brutal code-review audit turned into ~40 regression tests, closing the gap between what each command claims and what it does.** `judge` gained claim-level grounding — it fails an answer that cites a symbol/file/import the context never contains, catching a hallucination that pure word-overlap would pass. `validate --query` emits a retrieval-confidence report for natural-language queries (e.g. `"login rate limit"`) instead of the previous silent no-op. `plan` now uses the real planner, fixing a bug where the impact traversal ignored its depth cap and ran unbounded, and surfaces a true blast radius. `review-pr` adds a content-based secret scan (a hardcoded key in an innocently-named file is now flagged). The dependency graph resolves `tsconfig`/`jsconfig` path aliases, re-exports, and dynamic `import()` — lifting `--impact`, `--map`, `--callers`, `plan`, and `review-pr` at once. `--health` returns an auditable `components[]` breakdown and no longer scores a never-generated repo as 100/A. `gain`/`--cost` unify on a single pricing table; `conventions` stops misreporting single-word repos as "100% camelCase"; `suggest-profile` infers from the staged diff; `learn`/`create` get honest labels; and the JS/TS extractors disclose truncation with a visible `… +N more` marker instead of silently dropping the tail. Zero new dependencies; bundle reproducible from `src/`.

**Tags:** claim-grounding, retrieval-confidence, alias-resolution, secret-scan, auditable-health, honest-labels

**Impact:** ~40 new regression assertions (guard test count 112 → 115). Retrieval hit@5 stable at 87.8% and token reduction 97.0% — these were correctness and labeling fixes, not compression changes.

### v8.9.1 — Self-healing Pages deploy (CI) ✓ (2026-07-06)

**Patch — CI only; the published package is unchanged from 8.9.0.** Every release's first GitHub Pages deploy went red on a GitHub-side transient (`Deployment failed, try again later` within seconds of the push-triggered deploy; the identical artifact re-deployed a minute later always succeeded, but `actions/deploy-pages` treats that status as terminal). `pages.yml` now lets the first attempt fail softly, waits 60s for the backend to settle, and retries once — green if either attempt deploys, red only if both fail (the rare stuck-sha case). Zero new dependencies.

**Tags:** `ci` · `pages.yml` · `deploy-pages` · `continue-on-error` · `retry` · `#451`

**Impact:** releases no longer need a manual Pages re-run; no change to the npm package or metrics.

---

### v8.9.0 — Detached watch daemon (D1) ✓ (2026-07-06)

**Minor release — the watcher, detached.** `sigmap --watch` kept the signature index fresh but held a terminal in the foreground. This adds `sigmap daemon start|stop|status`, running `--watch` as a managed background process so you start it once and forget it — the roadmap's #1 friction win. The watcher is launched as a detached child (an arguments array, never a shell string) and tracked by a PID file under `.context/`, with output to `.context/daemon.log`. `start` is idempotent and cleans a stale PID file; `stop` SIGTERMs and clears the file; `status` reports the PID and exits 0/1. Every subcommand supports `--json`. Zero-dependency, shell-free, deterministic — no change to retrieval, so the benchmark headline is unchanged (hit@5 87.8%).

**Tags:** `daemon` · `daemon start/stop/status` · `--watch` · `detached` · `.context/daemon.pid` · `D1` · `#447` · `PR #448`

**Impact:** background index freshness with one command; new `src/daemon/daemon.js`; 8 new integration tests (112 derived tests).

---

### v8.8.1 — Byte-stable context, reproducible benchmark ✓ (2026-07-05)

**Patch release — closing the determinism residual (#440).** v8.8.0 hardened three nondeterminism sources but left a residual: `gen-context` output still varied run-to-run on a few large repos. The cause was the token-budget recency boost stamping `mtime = Date.now()` on every recently-committed file — on repos where nearly every file is "recently changed", consecutive files landed on the *same millisecond*, so which equal-priority files shared a millisecond (and fell through to the `filePath` tie-break) shifted run to run, swapping which files survived the budget cutoff. The `Date.now()` value silently encoded the alphabetical walk order the budget relied on; the nondeterminism was only the collisions. Replaced with a deterministic monotonic counter (`nextRecentMtime`) that reproduces the same processing-order ranking without collisions. All 43 benchmark repos are now byte-identical across two clean runs, and the retrieval benchmark reproduces a single hit@5 (**87.8%**) instead of flapping 85.6–87.8%. A byte-equality regression guard runs gen-context twice on a committed fixture and asserts equality.

**Tags:** `determinism` · `byte-stable` · `nextRecentMtime` · `token-budget` · `reproducible-benchmark` · `#440` · `PR #444`

**Impact:** reproducible headline (hit@5 87.8%, unchanged in value, now byte-stable); 43/43 repos byte-identical; 1 new regression guard (111 derived tests).

---

### v8.8.0 — `squeeze_output` MCP tool + `squeeze --response` (D6) ✓ (2026-07-05)

**Minor release — the squeeze engine, exposed mid-session.** The always-on squeeze engine (`src/squeeze/`) that powers `sigmap squeeze` was reachable only from the CLI on pasted input. This exposes it as the **19th MCP tool** (18 → 19) — `squeeze_output({ content })` — so an agent can compress noisy tool/command output (a stack trace, CI/build log, or JSON payload) *before it enters context*: it keeps the signal, strips the noise, enriches the top stack frame, and reports token-reduction stats, passing input through unchanged when nothing is squeezable. Also adds `sigmap squeeze --response <file|->`, naming the agent/tool response input explicitly (mirroring `judge --response`). Zero-dependency, offline, deterministic — the last A+ ceiling item (Machine 9→10): the engine already shipped, this just exposes it.

**Tags:** `squeeze_output` · `squeeze --response` · `19 MCP tools` · `mid-session compression` · `D6` · `#437` · `PR #438`

**Impact:** 19 MCP tools (was 18); the deterministic squeeze engine reachable by agents mid-session and named on the CLI; 6 new tests; no retrieval/token code changed.

---

### v8.7.1 — Multi-model cost savings + verified pricing ✓ (2026-07-05)

**Patch release.** The quality benchmark reported API input-cost savings for GPT-4o only; it now reports **GPT-4o, Claude Sonnet, and Claude Haiku** side by side (`scripts/run-quality-benchmark.mjs` gains a per-model "cost savings by model" table), and `docs-vp/guide/quality-benchmark.md` shows all three. Hardcoded Claude rates in `src/tracking/pricing.js` (the `sigmap gain` dashboard's cost assumptions) were corrected to current published pricing — Haiku $0.80→$1.00, Opus $15→$5.00 — verified 2026-07 (per 1M input tokens: GPT-4o $2.50, Sonnet 5/4.6 $3.00, Haiku 4.5 $1.00). Makes the point explicit: **token reduction is model-agnostic, but the dollar figure scales with each model's input rate.**

**Tags:** `benchmark` · `cost` · `pricing` · `multi-model` · `haiku` · `sonnet` · `#433` · `PR #434`

**Impact:** cost story now covers three model tiers; stale pricing corrected. No retrieval/token code changed — the saved run reflects corpus run-to-run drift (86.7% hit@5, within the noise band); the token-based cost figures are unaffected.

---

### v8.7.0 — Method/caller-level call-graph (D4 v1) ✓ (2026-07-05)

**Minor release — the graph goes from files to functions.** SigMap's dependency graph was file-level only (imports → `--impact`). New `src/graph/call-graph.js` adds **symbol-level** edges — *which function calls which function* — and the **method-level blast radius** of changing one symbol, for **JS/TS + Python**. Definitions are extracted with real body ranges (brace-matching for JS, indentation for Python) over comment/string-masked source, so literals never create phantom edges; each call site resolves with high precision — same-file def first, then a directly-imported file — and unresolved names produce no edge. Exposed as `buildCallGraph`/`methodImpact`/`methodCallees` and the `--callers`/`--callees` CLI (with `--json`/`--depth`), mirroring `--impact`. This is the plan's single hardest unbuilt gap and the biggest remaining lever on graph intelligence (v9.5 GR1).

**Tags:** `graph` · `call-graph` · `method-level` · `blast-radius` · `D4` · `--callers` · `--callees` · `#429` · `PR #430`

**Impact:** moves graph intelligence from file-level to function-level; +10 tests (110 total). The call-graph does not touch ranking, so retrieval is unaffected by design — the latest saved run measures 87.8% hit@5 / 97% token reduction (within the corpus's run-to-run noise band).

---

### v8.6.0 — Phase 1 "bank the A": harness, header pins, verify flagship ✓ (2026-07-05)

**Minor release — the grounding moat's supporting surface.** Three master-plan Phase 1 items land together, all zero-dependency and deterministic. **G1 — public reproducible benchmark harness:** new `public-benchmarks/` (`repos.csv`, `queries.json`, `run.sh`, `score.mjs`, `README.md`) is a self-contained, third-party-runnable retrieval harness — it shallow-clones 18 pinned repos, maps each with `gen-context.js`, ranks 90 queries with the **shipped** BM25 ranker (`src/retrieval/bm25.js`), and reports hit@1/hit@5/MRR. Turns the published retrieval numbers into a third-party-verifiable fact; dev-only (excluded from the npm package). **D8 — version pins in the context header:** the generated header now carries a `## versions (installed direct deps)` block of sorted `name@version` pins (JS + Python), via new `collectVersionPins()` in `src/verify/lib-index.js`, gated by the `versionPins` config key — agents ground against what is actually installed. **G2 — `verify` flagship:** `sigmap verify` is now a first-class alias of `verify-ai-output` with a dedicated README/CLI-reference section, positioning deterministic grounding as the headline.

**Tags:** `grounding` · `public-benchmarks` · `G1` · `D8` · `version-pins` · `G2` · `verify` · `flagship` · `#425` · `PR #426`

**Impact:** grounding surface completed toward the v9.0 "A" tier; benchmark reproducibility now third-party-runnable. Benchmark metrics unchanged; +12 tests (109 total).

---

### v8.5.0 — Deterministic query expansion ✓ (2026-07-05)

**Minor release — a vocabulary-mismatch recall aid.** The identifier-aware BM25 ranker (`src/retrieval/bm25.js`) now bridges common code-domain synonyms and abbreviations via a curated table (`auth`↔`authentication`/`login`, `db`↔`database`, `ctx`↔`context`, `config`↔`configuration`, `req`/`res`, `init`, `impl`, …). `expandQuery()` adds synonyms to the query tokens at a **discount weight (0.15)** so an exact-term match always outranks a synonym-only match; documents are unchanged. It's wired through the ranker, so `sigmap ask`, `--query`, and MCP `query_context` all benefit. **Honest result:** a weight sweep on the retrieval benchmark showed higher weights *regress* hit@5, so the shipped setting (0.15) is **benchmark-neutral** — this is a recall aid for real users whose query vocabulary differs from the code (a case the curated benchmark doesn't exercise), *not* a hit@5 improvement. Zero-dependency, deterministic.

**Tags:** `retrieval` · `bm25` · `query-expansion` · `synonyms` · `recall` · `measured` · `#421` · `PR #422`

**Impact:** closes a lexical-recall gap for vocabulary-mismatch queries with no retrieval regression. Benchmark metrics unchanged (86.7% hit@5, 97% token reduction); +5 tests.

---

### v8.4.0 — PR Evidence Report (v9.0 G3) ✓ (2026-07-05)

**Minor release — a branded, deterministic review artifact.** SigMap already had `review-pr` findings and `get_diff_context`, but no single Markdown comment an agent or CI could post on a PR. New `src/review/pr-evidence.js` folds together, per changed file, its extracted **signatures**, **blast radius** (direct/transitive importers, impacted tests + routes), cross-language **related tests**, a **risk label**, and the `review-pr` findings (scope drift, god-node edits, missing tests, security-sensitive files). `sigmap review-pr --markdown` (alias `--evidence`) renders the branded **"🔍 PR Evidence Report"** — with **no wall-clock timestamp**, so it's byte-stable given a fixed tree — and the exit code reflects the review pass/fail, so the same command can both post the comment and gate the PR in CI. Reuses shipped zero-dep modules; git stays behind the shell-free `git()` util.

**Tags:** `review` · `pr-evidence` · `blast-radius` · `G3` · `--markdown` · `ci-gate` · `deterministic` · `#417` · `PR #418`

**Impact:** the machine-consumable review artifact the plan named (G3) — *"what changed, what it touches, and what to test"* in one deterministic comment, no LLM. Retrieval/token metrics unchanged (86.7% hit@5, 97% token reduction); +3 tests.

---

### v8.3.0 — Python site-packages grounding (the moat, both ecosystems) ✓ (2026-07-05)

**Minor release — the grounding moat now spans JS/TS *and* Python.** v8.1/v8.2 grounded AI suggestions against installed `node_modules` libraries; this extends `buildLibraryIndex` (`src/verify/lib-index.js`) with a Python pass: it reads direct deps from `requirements.txt`/`pyproject.toml` (PEP 621 + Poetry), discovers the project's venv `site-packages` (`.venv|venv|env` → `lib/python*/site-packages`, or `Lib/site-packages` on Windows) **without spawning Python**, resolves each dep's installed module + version (`*.dist-info`, D8) with PEP 503 name normalization, and extracts exported names from its `__init__.py`/`.pyi` (`__all__`, top-level `def`/`class`, public assignments, and `from … import` re-exports). Both ecosystems merge into one symbol index, so `verify-ai-output` and the `verify_suggestion` MCP tool stop false-flagging genuine installed-Python-library calls. Zero-dependency, deterministic (byte-stable given a fixed installed tree), cached via `sig-cache`.

**Tags:** `verify` · `python` · `site-packages` · `venv` · `G5` · `D5` · `private-api-grounding` · `D8` · `#413` · `PR #414`

**Impact:** installed-library grounding now covers the two biggest ecosystems (JS/TS + Python); Phase-1 of the grounding moat is feature-complete. Retrieval/token metrics unchanged (86.7% hit@5, 97% token reduction); +4 tests.

---

### v8.2.0 — `verify_suggestion` MCP tool (the moat, for agents) ✓ (2026-07-04)

**Minor release — the grounding moat, made consumable by agents.** v8.1.0 built local-library grounding inside the `verify-ai-output` CLI; this exposes it as the **18th MCP tool** so a coding agent can verify its own generated code against the repo **and the libraries actually installed** in `node_modules` — *before it writes*. `verify_suggestion({ code })` runs the Hallucination Guard against the repo signature index and the installed-library symbol index (G5/D5), returning a clean/✗ verdict, one line per issue (fake file / import / symbol / npm-script + closest-match suggestions), and a **D8** line listing the installed libraries verified against with pinned versions (`name@version`). Reuses the shipped `verify()` core; deterministic, offline, zero-dependency; graceful on missing/empty `code`.

**Tags:** `mcp` · `verify_suggestion` · `18-mcp-tools` · `G5` · `D5` · `private-api-grounding` · `D8` · `#409` · `PR #410`

**Impact:** MCP surface **17 → 18 tools**; the moat is now callable by the agents that consume SigMap's grounding. Retrieval/token metrics unchanged (86.7% hit@5, 97% token reduction); +5 tests.

---

### v8.1.0 — Local-library signature index (v9.0 G5/D5, the moat) ✓ (2026-07-04)

**Minor release — the private-API grounding moat, v1.** SigMap's hallucination guard can now verify AI suggestions against the libraries **actually installed** in `node_modules`, not just declared dependency *names* — a capability no competitor offers (Context7 knows only *public* library docs; SigMap grounds against the real installed tree). New `src/verify/lib-index.js` resolves each **direct** dependency, reads its version (**D8 version pinning**) and TypeScript declaration entry (`types`/`typings`, else `index.d.ts`), and deterministically extracts the exported symbol names — bounded, cached via `src/cache/sig-cache.js`, graceful on missing/untyped/malformed packages. `verify-ai-output` unions those symbols into its known-symbol universe, so genuine library calls (`Router()`, `debounce()`) stop being false-flagged as `fake-symbol`; the summary gains `librariesIndexed` + `libraries` (`name@version`). Auto-runs from the project's `node_modules`; scope v1 is JS/TS `.d.ts` (Python site-packages + a standalone `verify_suggestion` MCP tool follow). Zero-dependency, deterministic — byte-stable given a fixed installed tree.

**Tags:** `v9.0` · `G5` · `D5` · `local-library-index` · `verify-ai-output` · `private-api-grounding` · `D8-version-pinning` · `#405` · `PR #406`

**Impact:** verify-ai-output no longer false-flags real installed-library calls; suggestions are grounded against repo + private + installed-lib symbols with pinned versions. Retrieval/token metrics unchanged (86.7% hit@5, 97% token reduction); +8 tests.

---

### v8.0.0 — v8.5 repo-context coverage, measured test discovery, richer risk labels ✓ (2026-07-04)

**Major release (v8 milestone) — v8.5 "Repo-Context Coverage & Test Discovery" (C1 + C2 + C3).** Closes the map-completeness gaps so the signature map can be trusted as *complete*. **C1 (coverage):** four dedicated zero-dependency `src/map/` analyzers — environment variables (`env-schema.js`), Build & CI (`build-ci.js`), Config & manifests (`config-manifest.js`), and Database migrations (`migrations.js`) — extend `PROJECT_MAP.md` and the MCP `get_map` sections beyond functions/classes/routes into the repo's operational surface. **C2 (test discovery):** `findRelatedTests` now normalizes cross-language conventions (`test_x.py`↔`x.py`, `x_test.go`↔`x.go`, `XTest.java`↔`X.java`, `x.spec.ts`↔`x.ts`), and a new reproducible benchmark (`scripts/run-test-discovery-benchmark.mjs`) measures it against an independent canonical-name gold oracle — no LLM, pure string math. **C3 (risk labels):** `riskLabelFor` returns a richer, precedence-ordered set — `migration | payment | auth | security | public-api | config | test | generated | source` — feeding every Evidence Pack file. Deterministic, zero new dependencies.

**Tags:** `v8.5` · `coverage-expansion` · `env-schema` · `build-ci` · `config-manifest` · `migrations` · `test-discovery` · `risk-labels` · `#401` · `PR #402`

**Impact:** measured test-discovery **F1 98.0% · hit@1 97.4%** across 28 repos / 3,701 canonical impl↔test pairs; four new PROJECT_MAP / `get_map` coverage sections; richer risk labels on every Evidence Pack file. Retrieval/token metrics unchanged (86.7% hit@5, 97% token reduction).

---

### v7.31.0 — Identifier-aware BM25 re-ranker ✓ (2026-07-02)

**Minor release.** Plain exact-token TF-IDF missed queries whose terms live *inside* code identifiers — `component emit` never surfaced `componentEmits`, the dominant retrieval-miss cause. The new zero-dependency `src/retrieval/bm25.js` adds four things: identifier-aware tokenization (split camelCase / snake_case), light stemming (`emits` → `emit`), a path-token boost (filename weighed 3×), and length-normalized **BM25** scoring in place of raw TF-IDF. It is wired into the core ranker (`src/retrieval/ranker.js`) as the base relevance score — so `sigmap ask`, `sigmap --query`, and MCP `query_context` all benefit — with the existing negative-signal penalty and recency/graph/learned boosts layered on top; it also drives the benchmark runner. Deterministic, no LLM/embeddings, zero new dependencies.

**Tags:** `bm25` · `identifier-aware tokenization` · `stemming` · `path-token boost` · `src/retrieval/bm25.js` · `#395` · `PR #396`

**Impact:** retrieval hit@5 **75.6% → 86.7%** (lift 5.6× → 6.4×); task-success proxy 52.2% → 67.8%, prompts/task 1.72 → 1.46; rank-1 gains on flask, spring-petclinic, rails, and svelte (60% → 100%).

---

### v7.29.0 — One-command per-client MCP install (v8.0 E4) ✓ (2026-06-23)

**Minor release — v8.0 E4.** `sigmap mcp install <client>` is the fast path to a working MCP setup: it wires a single client and **creates** the config when absent, where `--setup` wires every editor at once and only touches configs that already exist. Supported clients are `claude`, `cursor`, `windsurf`, `vscode`, `zed`, `codex`, `gemini`, `opencode`, and `mcp` (portable `.mcp.json`); the command emits the correct shape per client — `mcpServers` JSON, Zed `context_servers`, or Codex YAML — and is **idempotent** (a re-run reports already-registered, never duplicates). `--global` selects the user-level config for clients with both a project and a global scope (Windsurf, OpenCode). `sigmap mcp list` (`--json`) shows every client and its resolved config path. All of it lives in the zero-dep `src/mcp/install.js` — no system-shell spawns, no install scripts — so Socket Supply Chain Security holds at 100.

**Tags:** `mcp install` · `mcp list` · `one-command-setup` · `idempotent` · `--global` · `zero-dep` · `#385` · `PR #386`

**Impact:** first-run friction down further — one targeted command brings up MCP for the user's actual client (the v8.0 <5-minute-quickstart gate); +11 tests (1,247 passing); zero new runtime dependencies. Continues the v8.0 milestone (E1, E3, D3 already shipped).

---

### v7.28.0 — sigmap doctor (v8.0 E3) ✓ (2026-06-23)

**Minor release — v8.0 E3.** `sigmap doctor` is a one-shot setup diagnostic so a cold user reaches a useful answer fast. It runs seven resilient checks — git repository, config & source roots, the generated context file, the signature index, index freshness, coverage, and MCP wiring — and prints an **actionable fix** for anything wrong or stale (e.g. "run: npx sigmap", "run: sigmap --setup", "increase maxTokens or expand srcDirs"). `--json` emits `{ checks, ok, errors, warnings }`, and the command exits **1** on a hard failure (no context file / invalid config) and **0** otherwise, so it drops into CI as a setup gate. Composed from the existing config loader, coverage scorer, signature index, and the known adapter-output / MCP-config paths — zero new runtime dependencies, no system-shell spawns. This release also hardened the release CI so `develop` self-heals after the develop→main merge (it had been auto-deleted by the repo's delete-branch-on-merge setting).

**Tags:** `doctor` · `diagnostics` · `setup-gate` · `actionable-fixes` · `--json` · `#381` · `PR #382` · `#380`

**Impact:** first-run friction down — one command tells a new user exactly what to fix; +11 tests (1,236 passing); zero new runtime dependencies. Continues the v8.0 milestone (E1, D3 already shipped).

---

### v7.27.0 — Diff context & architecture overview MCP tools (v8.0 D3) ✓ (2026-06-22)

**Minor release — v8.0 D3.** Two new MCP tools take the server from 15 to 17, both composed from data SigMap already computes (zero new runtime deps, no system-shell spawns). **`get_diff_context`** `{ base?, staged?, depth? }` returns, for every changed file (working tree, staged, or vs a base ref), its current **signatures** plus **blast radius** — direct importers, transitive count, affected tests/routes — and a risk label, so an agent gets everything a review or a safe edit needs in one call. Changed files are listed **shell-free** through `src/util/git.js`. **`get_architecture_overview`** `{}` returns a one-call codebase map — module breakdown (files/tokens), the most depended-on **hub files**, the dependency-**cycle** count, and route totals — extending `get_map` for orienting in an unfamiliar repo. Both reuse the existing graph (`buildFromCwd`, `analyzeImpact`, `detectCycles`) and extractor pipeline.

**Tags:** `mcp` · `get_diff_context` · `get_architecture_overview` · `blast-radius` · `hub-files` · `17 MCP tools` · `#376` · `PR #377`

**Impact:** MCP surface 15 → 17 tools (synced across `--help`, README, `mcp.md`, `version.json`, llms); +6 tests (1,225 passing); zero new runtime dependencies. Continues the v8.0 milestone (E1 shipped in v7.26.0).

---

### v7.26.0 — The Evidence Pack (v8.0 E1) ✓ (2026-06-22)

**Minor release — the first installment of the v8.0 "Evidence Pack & the Pivot" milestone.** SigMap gets its keystone artifact: a deterministic, machine-consumable signature-and-evidence map that replaces the copy-paste workflow. `sigmap evidence "<query>"` emits a byte-stable JSON (schema v1) — plus a `--markdown` handoff rendering — that an agent or CI can ingest directly. Every `files[]` entry is anchored to real symbols and `{start,end}` line ranges, with a relevance `reason`, a `0–1` `confidence`, best-effort `relatedTests`, and a `riskLabel` ∈ `generated · test · config · security · source`; `tokenBudget`/`droppedFiles` make the budget honest, and a `grounding` block signs the canonical pack with a sha256 `contextHash`. The pack carries **no wall-clock timestamp** — an unchanged repo yields byte-identical output and an identical hash, exactly the auditable, reproducible context an agentic grep loop cannot produce. Built entirely from shipped zero-dep modules (ranker, line-anchor parsing, security scanner); always writes `.context/evidence-pack.json`; flags `--top`, `--budget`, `--out`.

**Tags:** `evidence-pack` · `sigmap evidence` · `schema-v1` · `deterministic` · `contextHash` · `grounding` · `#372` · `PR #373`

**Impact:** the first machine-consumable handoff artifact; +14 tests (1,219 passing); zero new runtime dependencies. Opens the v8.0 milestone (E2 repositioning, E3 `doctor`, E4 agent recipes + `mcp install`, D3 +2 MCP tools to follow).

---

### v7.25.2 — Trust Hygiene: reproducible bundle build ✓ (2026-06-22)

**Patch release — H2, the last piece of Trust Hygiene.** The shipped `gen-context.js` is now provably reproducible from source. `scripts/build-bundle.mjs` (`npm run build:bundle`) deterministically regenerates the embedded `__factories` from `src/` + `packages/adapters/` — sorted, de-duplicated — between two markers, leaving the preamble and the hand-written CLI core byte-identical. `build:bundle --check` asserts the committed bundle equals a fresh build and gates `prepublishOnly` + CI (alongside the standalone `bundle-smoke` test on Node 18/20/22). This fixed a duplicate `llm-ablation` factory and embedded the previously-missing `willow` adapter — the canonical bundle is now **125 modules, one factory each**. `check-bundle --fix` delegates to the builder so duplicates can't recur.

**Tags:** `trust-hygiene` · `build:bundle` · `reproducible` · `bundle-repro` · `#369`

**Impact:** deterministic, reproducible distributable; +6 tests (1,205 passing); zero new runtime dependencies. **Completes the v7.25.x Trust Hygiene milestone (H1+H2+H3+H4).**

---

### v7.25.1 — Trust Hygiene: document the real surface ✓ (2026-06-21)

**Patch release — H4, the documentation half of Trust Hygiene.** SigMap shipped more than it advertised. `sigmap --help` now lists the five wired-but-undocumented commands — `conventions`, `scaffold`, `verify-plan`, `review-pr`, and `create` (the grounded-creation pipeline). The README corrects its MCP count (10 → **15**, with the full tool list), adds a "Grounded creation & guardrails" section, and lists the `willow` adapter (all 8 adapters). A new `surface-docs` test pins the documented surface to source — `--help` must list the commands, the README MCP count must equal `TOOLS.length`, and every registered adapter must appear in the README table — so the docs can never silently undersell the product again.

**Tags:** `trust-hygiene` · `--help` · `surface-docs` · `grounded-creation` · `willow` · `#366`

**Impact:** docs-only; +9 tests (1,199 passing); the v7.25.x milestone is documentation-complete (only H2, the reproducible bundle build, remains).

---

### v7.25.0 — Trust Hygiene: single source of benchmark truth ✓ (2026-06-21)

**Minor release — the first installment of the v7.25.x "Trust Hygiene" milestone (H1 + H3).** Every public number now derives from one generated file. `benchmarks/latest.json` is produced from the benchmark reports (`scripts/gen-benchmark-latest.mjs`); `version.json` metrics, the `README.md` benchmark block (via `<!--SM:KEY-->` markers), and `llms.txt`/`llms-full.txt` all read from it (`scripts/sync-metrics.mjs`). No metric is hand-typed, so README, version.json, and the LLM docs can never silently disagree with the measured reports again. `version.json`'s `languages`/`extractors`/`mcp_tools`/`tests` are auto-derived from source via a shared `scripts/lib/source-meta.mjs` — the same derivation the llms generator uses — fixing a stale `languages` count (31 → 33) and adding `extractors` (42). `npm run check:metrics` gates the whole chain in `prepublishOnly` and CI. This release regenerates the numbers from a live benchmark run.

**Tags:** `trust-hygiene` · `benchmarks/latest.json` · `metrics:sync` · `check:metrics` · `source-meta` · `#363`

**Impact:** single source of truth for all published metrics; +15 tests (1,190 passing); zero new runtime dependencies. Live run (`sigmap-v7.25-main`, 2026-06-21): hit@5 75.6% · token reduction 97% · task success 52.2%.

---

### v7.24.2 — StarMapper stargazer map in the docs ✓ (2026-06-19)

**Patch release — surface the community.** SigMap has 517 stars across 37 countries; the [StarMapper map](https://starmapper.bruniaux.com/manojmallick/sigmap) visualizes where. This release adds a StarMapper badge to the README badge row, a "stargazers around the world" link in Support, and a community link on the docs site. StarMapper is a client-rendered SPA with no verifiable badge endpoint, so a reliable shields.io static badge links to the map rather than embedding an unverifiable image; a README-structure test pins the URL.

**Tags:** `docs` · `starmapper` · `community` · `badge`

**Impact:** docs-only; +1 test (1,175 passing).

---

### v7.24.1 — §9 grounding result published: 99.8 → 0.2 flagged per 100 ✓ (2026-06-19)

**Patch release — the §9 measurement chain pays off.** The first averaged §9 ablation on the fact-question corpus (5 runs × 100 repo-fact tasks, Gemini `gemini-2.5-flash`): with SigMap's exact-signature grounding, flagged codebase-fact errors fell from **99.8 [99–100]** to **0.2 [0–1]** per 100 outputs — a mean reduction of **99.6 per 100**, with negligible run-to-run variance. Without grounding the model has no repo knowledge and fabricates a plausible-but-wrong file path on essentially every task (`src/sigmap/utils.py`, `src/sigmap/extract.py`, even Java/Go paths for a JS repo); with grounding it states the correct path. This measures **factual-recall grounding** (faithful use of provided context) — not generative code correctness — and the grounded arm is given the exact paths, so it is the strong, clean direction of the claim. Recorded in `version.json` under a dedicated `ablation` block, separate from the retrieval/token/task metrics.

**Tags:** `llm-ablation` · `§9` · `grounding-result` · `gemini` · `factual-recall`

**Impact:** the four-release §9 arc (v7.22.1 guard cleanup → v7.22.2 → v7.23.0 `--runs` → v7.24.0 fact corpus) culminates in a defensible, published number: **grounding eliminates fabricated file-location claims (99.8 → 0.2 per 100).**

---

### v7.24.0 — §9 corpus redesign: checkable repo-fact questions ✓ (2026-06-19)

**Minor release — make the §9 metric measure grounding, not guard precision.** A 100-task run (on the v7.22-cleaned guard + v7.23 harness) showed grounding drives *genuine* invented-file hallucinations to ~0, but the old "write a minimal example that requires X" corpus elicited placeholder scaffolding (`src/main.js`, `minimal.js`, real modules referenced by basename) that a string-based guard cannot distinguish from claimed repo files — so the measured delta (9 → 7) was dominated by benchmark artifacts, not grounding. `scripts/gen-ablation-corpus.mjs` now generates **checkable repo-fact questions** — *"which file defines `<name>`, and what are its parameters?"* — where a wrong file path is an unambiguous, checkable hallucination and the prompt forbids example code. The grounded arm (given exact signatures grouped by file) answers correctly; the ungrounded arm must guess. Task ids `call-` → `fact-`; 100 real-symbol tasks; a regression test pins the methodology so it can't drift back to code-writing.

**Tags:** `llm-ablation` · `corpus` · `fact-questions` · `grounding` · `§9` · `#356` · `#357`

**Impact:** the §9 ablation now isolates grounding — no example-scaffolding false positives. The next averaged run (`--runs 5`) should yield a clean, publishable `mean [min–max]` delta. +1 test (1,174 passing).

---

### v7.23.0 — robust §9 ablation: --runs averaging + 100-task corpus ✓ (2026-06-19)

**Minor release — turn the §9 result into a stable number.** With the guard cleaned (v7.22.1–v7.22.2), the §9 ablation shows grounding cuts flagged codebase-fact errors ~13 → 3 per 100 — but at N=40 with single-digit raw counts a single pass bounces run-to-run. This release makes one invocation yield a publishable figure: `scripts/run-llm-ablation.mjs` gains `--runs N` (default 1) that runs the full task set N times with **fresh model calls per pass** and prints a `mean ± [min–max]` summary; `src/eval/llm-ablation.js` adds the pure, unit-tested `aggregateRuns(aggregates[])`. The committed corpus expands from 40 to **100** real-symbol tasks for a tighter single-run estimate. The network touch stays confined to `scripts/`.

**Tags:** `llm-ablation` · `--runs` · `aggregateRuns` · `corpus-100` · `§9` · `#353` · `#354`

**Impact:** the §9 grounding result is now measurable with an honest spread (`mean ± range`) from a single command — `npm run benchmark:llm-ablation -- --runs 5 --save`. +3 tests (1,173 passing).

---

### v7.22.2 — verify-ai-output: clear camelCase & doc-placeholder false positives ✓ (2026-06-19)

**Patch release — expose the §9 grounding signal.** Re-running the §9 ablation on the v7.22.1-cleaned guard showed grounding genuinely fixed **6 mis-path flags**, but the guard re-flagged **4 illustrative tokens** in the with-grounding arm (net delta only +2). Those 4 were not real hallucinations, so this release removes them: `extractFilePaths` now also skips camelCase/Pascal placeholders (`myExample.js`, `exampleConfig.ts`) via a case-boundary rule that still flags ordinary words (`resample.js`), and the `fake-import` detector skips documentation-placeholder imports (`@scope/utils`, `some-module`, `./local-file`, `./path/to/…`) while still flagging genuine missing packages and unresolved relatives. On those same outputs the with-grounding flag count drops 10 → 6 — turning the §9 delta from +2 into **+9 per 100**. Bundled `parsers` + `hallucination-guard` factories regenerated.

**Tags:** `verify-ai-output` · `hallucination-guard` · `extractFilePaths` · `fake-import` · `camelCase` · `placeholder-imports` · `#350` · `#351`

**Impact:** clears the last two `verify-ai-output` false-positive classes, exposing the true §9 grounding delta (+2 → +9 on the measured outputs). +2 tests (1,170 passing).

---

### v7.22.1 — verify-ai-output: stop flagging Node.js & placeholder filenames ✓ (2026-06-18)

**Patch release — clear the §9 ablation's dominant false-positive class.** The Hallucination Guard's file-path extractor (`src/verify/parsers.js` `extractFilePaths`) was treating runtime/library product names and illustrative placeholders as repo file claims — in the v7.22.0 ablation, **22 of ~34 flags were literally "Node.js"**. It now skips well-known `X.js` product names (`node.js`, `next.js`, `vue.js`, `express.js`, `three.js`, `d3.js`, …) and placeholder basenames (`example`/`sample`/`demo`/`placeholder`, including `minimal-example.js`). Genuine repo-shaped paths (`src/foo/bar.js`, `main.js`, `index.ts`) are still flagged when absent, so real hallucinations are unaffected. The bundled `src/verify/parsers` factory was regenerated for standalone-binary parity.

**Tags:** `verify-ai-output` · `hallucination-guard` · `extractFilePaths` · `false-positives` · `#347` · `#348`

**Impact:** removes the dominant `verify-ai-output` false-positive class for every user, and turns the §9 grounding delta into a clean, publishable signal. +4 tests (1,168 passing).

---

### v7.22.0 — realistic §9 ablation (real-symbol corpus, exact-signature grounding, --verbose) ✓ (2026-06-18)

**Minor release — make the §9 measurement meaningful.** The LLM A/B ablation now uses a ~40-task corpus generated from the repo's real exported symbols/files (`scripts/gen-ablation-corpus.mjs`), grounds with **exact signatures grouped by file** (what `get_callee_signatures` returns, bounded — not a flat name dump), and `--verbose` prints every flagged item per arm. `src/eval/llm-ablation.js` adds `scoreAnswerDetail` (count + issues) and `runAblation`'s `collectIssues`. A 40-task Gemini run measured **62.5 → 22.5 flagged errors per 100 outputs with grounding** (directionally positive, vs the earlier 4-task noise). `--verbose` then revealed most flags are `verify-ai-output` file-path false-positives (e.g. "Node.js"), which is the next thing to harden before publishing a clean number. Also fixes the runner's default Gemini model (`gemini-2.0-flash` → `gemini-2.5-flash`, the former being retired).

**Tags:** `llm-ablation` · `corpus` · `exact-signatures` · `--verbose` · `scoreAnswerDetail` · `gemini` · `#344` · `#343`

**Impact:** the §9 A/B is now a real experiment — and it surfaced a concrete `verify-ai-output` false-positive class to fix next.

---

### v7.21.0 — Gemini (AI Studio) provider for the §9 ablation ✓ (2026-06-18)

**Minor release — run the §9 A/B with a Gemini key.** The LLM A/B ablation runner (`scripts/run-llm-ablation.mjs`) now supports Google Gemini via the AI Studio / Generative Language API (`generateContent`) alongside Anthropic. The provider is auto-detected from whichever key is present (`GEMINI_API_KEY` / `GOOGLE_API_KEY` → gemini; `ANTHROPIC_API_KEY` → anthropic); `--provider` and `--model` override, with a sensible default model per provider. Run with `GEMINI_API_KEY=… npm run benchmark:llm-ablation`. The offline harness (`src/eval/llm-ablation.js`) is unchanged and the network fetch stays confined to `scripts/`.

**Tags:** `llm-ablation` · `gemini` · `ai-studio` · `provider` · `grounded-codegen` · `#340`

**Impact:** the §9 measurement can now run on either Anthropic or Gemini keys — lowering the bar to publish the real hallucination delta.

---

### v7.20.0 — `init` Creation-workflow CLAUDE.md block (plan complete) ✓ (2026-06-18)

**Minor release — the final IMPL item.** `sigmap --init` now injects a marker-delimited "Creation workflow" block into CLAUDE.md describing the four-stage grounded-creation pipeline (`scaffold` → `verify-plan` → `verify-ai-output` → `review-pr`, orchestrated by `sigmap create`), so an agent reading CLAUDE.md knows the guard-rail workflow exists. New zero-dependency, bundle-safe `src/init/creation-workflow.js` (`renderCreationWorkflowBlock`, `injectCreationWorkflow`); idempotent and marker-scoped, it creates CLAUDE.md if absent, preserves human content, and coexists with the conventions + auto-generated-signatures blocks. **With this, every item in the grounded-codegen implementation plan is shipped** — the §9 LLM A/B ablation is built and offline-tested; a live run needs only an API key.

**Tags:** `init` · `creation-workflow` · `claude-md` · `injectCreationWorkflow` · `grounded-codegen` · `gap-2` · `plan-complete` · `#337`

**Impact:** the grounded-codegen plan (4 root causes + the full create pipeline + measurement harness) is complete end-to-end.

---

### v7.19.0 — scaffold persistence ✓ (2026-06-18)

**Minor release — `.context/scaffold/latest.md`.** `sigmap scaffold` now writes an accepted proposal to `.context/scaffold/latest.md` so the `create` pipeline and agents can read back the convention-matched proposal instead of re-deriving it. New zero-dependency, bundle-safe `src/scaffold/persist.js` (`renderScaffoldMarkdown`, `scaffoldPath`); the record captures the filename + naming style, export style, test file + framework, and any force-warning. Persisted in both human and `--json` modes (`persistedTo` field); a refusal writes nothing.

**Tags:** `scaffold` · `persistence` · `latest.md` · `renderScaffoldMarkdown` · `grounded-codegen` · `gap-2` · `#334`

**Impact:** scaffold proposals are now durable artifacts the rest of the pipeline can consume.

---

### v7.18.0 — `conventions --update` (incremental rescan) ✓ (2026-06-18)

**Minor release — completes the `conventions` flag set.** `sigmap conventions --update` refreshes `.context/conventions.json` only when source files have changed since the last scan (by mtime vs the stored snapshot); otherwise it reports "up to date" and skips the work — handy in a pre-commit hook or watch loop. New zero-dependency, bundle-safe `src/conventions/update.js` (`changedSince`, `planUpdate`). `--json` for machine output. With this, all six IMPL §4 `conventions` flags ship: `--conflicts`, `--inject`, `--report`, `--ci`, `--fix`, `--update`.

**Tags:** `conventions` · `--update` · `incremental` · `planUpdate` · `grounded-codegen` · `#331`

**Impact:** the `conventions` command is now complete across every documented flag.

---

### v7.17.0 — `conventions --fix` (exhaustive rename checklist) ✓ (2026-06-18)

**Minor release — completes the `conventions` flag set.** `sigmap conventions --fix` lists every source file whose name doesn't match the dominant convention, with full from→to paths — the complete, paste-ready rename checklist (distinct from `--conflicts`' 3-example diagnostic summary). New zero-dependency, bundle-safe `src/conventions/fix.js` (`buildFixList`) reuses `classifyNaming` + `toNamingStyle`; read-only (a checklist, never renames). `--json` for machine output. With this, all five `conventions` flags ship: `--conflicts`, `--inject`, `--report`, `--ci`, `--fix`.

**Tags:** `conventions` · `--fix` · `rename-checklist` · `buildFixList` · `grounded-codegen` · `#328`

**Impact:** the `conventions` command is feature-complete — detect, surface conflicts, inject into CLAUDE.md, score + trend, CI-gate, and now the full rename checklist.

---

### v7.16.0 — LLM A/B hallucination ablation harness (IMPL §9) ✓ (2026-06-18)

**Minor release — the honest measurement behind the grounded-codegen plan.** The §9 A/B ablation runs a model twice per task — (A) no SigMap context, (B) with SigMap grounding — pipes both outputs through the hallucination guard, and reports the measured delta in flagged codebase-fact errors. New zero-dependency, bundle-safe `src/eval/llm-ablation.js` (`buildGrounding`, `scoreAnswer`, `runAblation`) keeps the model call **injected** so the harness is fully offline-testable; the live runner `scripts/run-llm-ablation.mjs` wires Anthropic via `ANTHROPIC_API_KEY` (`npm run benchmark:llm-ablation`) and degrades to a graceful skip when no key is set. The network fetch is confined to `scripts/`, never the published surface. Starter corpus in `benchmarks/llm-ablation-tasks.json`. This turns §9 from an offline coverage proxy into a ready-to-run real A/B.

**Tags:** `llm-ablation` · `benchmark:llm-ablation` · `runAblation` · `injected-completer` · `grounded-codegen` · `the-gate` · `#325`

**Impact:** the grounded-codegen plan's headline measurement is now buildable and tested offline — running it live (with a key) produces the measured hallucination delta.

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

## Current milestone — Phase 2 "buy the A+" 🚧 NEXT — Phase 1 grounding banked (G1/D8/G2); the §3.5 in-boundary backlog D1–D9 is complete (v8.12) and method-level blast-radius scoring shipped (GR2, v8.13) and the call-graph now covers Java/Go/Rust (GR1, v8.14) with the ranking boost measured and shipped dark (v8.15). Evidence Pack schema v2 shipped (v8.16). Retrieval surface-enrichment shipped measure-gated (v8.18) — every Phase-2 quality-ceiling row is now done or gate-closed. Honest Numbers shipped (v8.19): the published lift is now measured vs a grep-agent baseline, with claim-hygiene guards. Semantic Bridge I shipped (v8.20): JS/TS doc hints (Python-parity, −0.9pt on the lexical corpus, default-on per the anchors precedent) + `sigmap memory`. Semantic Bridge II shipped (v8.21): Go/Rust/Java doc hints (6 hint languages total) + the import-graph centrality blend (measured +0 → shipped dark behind `retrieval.centralityBlend`). Hard Corpus shipped (v8.22): the no-leakage hard split + leakage gate measured the vocabulary-mismatch ceiling directly (hard-split 33.3% vs grep 53.3% — grep wins when filename leakage is removed). Agent Economy I shipped (v8.23) and Trust Quick Wins I shipped (v8.24, `sigmap redact`). Agent Economy II shipped (v8.25): `sigmap tune` — the discovery stack packaged as a deterministic config optimizer (F2). Agent Economy III shipped (v8.26): `sigmap skills` — the usage-maximizer and config-optimizer playbooks installable in 5 clients' native formats (F3+F4) — **the Agent Economy pillar is complete**. Trust Quick Wins II shipped (v8.26.1): KNOWN_LIMITATIONS.md + the README extraction-honesty tier label (G1). Next: G2 SUCCESSION + org migration and G6 triage (maintainer-driven, non-code), Tokenizer Core I shipped (v8.27): the balanced scanner + JS/TS migration (G4 increment 1). Arity Guard shipped (v8.28): D1 arity-checked verification over exact JS/TS/Python params. The judge convergence shipped (v8.45: J1 structural judge + J2 config thresholds — the last lexical grounding surface is closed). G4 Go+Java shipped (v8.46–v8.47) and B2 shipped measure-gated (v8.48) and J4 confidence/explainability shipped (v8.49 — the judge ladder continues: J5 regression corpus, then J3 parser robustness). Context Economics I shipped (v8.50): `strategy:"index"` separates the always-on MAP from the on-demand signature index, cutting this repo's always-on cost 13,892 → 377 tokens — opt-in, with the default flip reserved for v9 behind a published before/after; shipped alongside the CI/pipeline extractor, the nine-ecosystem dependency inventory, and deterministic CycloneDX export (scanning deliberately left to osv-scanner). Context Economics II shipped (v8.51): the v8.50 features were field-tested against 15 real public repos, which found the CI extractor wired into `langFor` but not into file discovery, three SBOM-correctness defects that only real manifests reproduce, and an `index` saving overstated up to 3x against an uncapped index — all fixed, with the measurement now run rather than estimated. The same sweep surfaced a long-latent one: multi-module JVM and Kotlin Multiplatform layouts indexed almost nothing (okhttp 4 files of 596, akka 29 of 2,651), now detected structurally. Context Economics III shipped (v8.51.1–v8.51.2): field-testing v8.50 against real repos found the CI extractor inert, three SBOM-correctness defects, and an `index` saving overstated 3x; a lion bug report then exposed that call-expression superclasses dropped whole classes (34% of a Lit codebase), and an external contributor found the Python AST tier had never run in production despite being documented and tested. The through-line is one failure class — wired into resolution, absent from the path that actually runs — now guarded by `validate:source-roots`, a docs-nav coverage gate and a config-reference drift gate. Next: J5, then the v9 default-strategy flip, the flat-multiplatform source-root layout the coverage gate flagged, remaining Tier-2 scanner migrations and hard-split levers as pulled; pull-based v10 items only (enterprise, IDE plugins — built if users ask) and the no-code growth lane. Retrieval Honesty shipped (v8.55.0): the ranker and the token-budget drop order now share one file-category definition, zero-score rows are no longer presented as matches, path matches are IDF-scaled, and `ask --explain` makes a miss diagnosable (#807/#808/#813) — jvm retrieval +8.2pp with hard and mined unchanged. Project Shape shipped (v8.56.0): a flat repo root is now a source root on the two structural signals that identify one, `testdata` is never preferred over it, a wrong `srcDirs` is disclosed by `validate` and `doctor` instead of hidden behind a coverage percentage computed over that same wrong set, and the monorepo verdict has one detector that names its evidence (#805/#781) — the critical tier of the backlog is now empty. The 55 remaining open issues now have a published execution order in ten releases (v8.55 &rarr; v9.1), ordered correctness-before-capability; with #805/#781 now closed the immediate next step is **one definition per number** — the shared coverage/freshness/test-discovery primitives (#770, #664, #663, #818) plus the medium bug batch — then the self-describing CLI (#817), then the dated model profile and cache-stable context layout (#688, #683), which adversarial review promoted ahead of the corpus and claims work. Create-pipeline guards shipped (v8.57.0): a `create` run that ran no stage exits 2 instead of reporting a pass, and a plan that *introduces* symbols can reach a passing stage 2 via the `Creates:` section, with a redefinition guard as the reverse check (#767/#666) — **R1 is now complete**. R2 "one definition per number" is now open: the index population and its age have one shared owner (v8.58.0), so `validate`, `doctor` and `status` can no longer publish three readings of one healthy index, and a deleted file is pruned by the full run the remediation text already advised (#770/#664). The dashboard then got one output path and one language list (v8.59.0, #663/#782), and scope claims learned to name their basis — `--diff <ref>` over the working tree and the `--callers` lower-bound hedge (v8.60.0, #667/#768). The `ask` surface then got the same treatment and the loop to the agent closed with it (v8.61.0, #806/#814/#815): every figure in `ask` output names its basis, no retrieval surface answers from a stale index silently, and `--with-source` hands back symbol bodies instead of making the agent open whole files. v8.61.1 extended the same rule from what `ask` *prints* to what it *emits* (#845/#662): two of the five keys its JSON contract documented had never existed, and output keys were the one self-description surface no guard covered — `--help` had commands (#661) and flags (#817) but nothing pinned the JSON. v8.61.2 then closed both halves of the self-description work at once, because they are one defect: the structural pin on the shared populations (#818) found two copies of the coverage ratio already back — `validate`'s own rounding, and the `--ci` quotient that was gating releases on 241% — and the canonical command table (#817) found four live drifts in a `--help` literal the previous release had assessed as correct. Adding one module for that work then exposed a latent ranker bug (#851): the hop-1 import boost accumulated once per importing seed, so a shared utility with 23 importers outranked genuine matches on `bm25 0`, suppressed only by a `Math.ceil` hub threshold that a single added file can cross. v8.61.3 then turned the same rule on the published numbers themselves (#854/#707/#811): v8.61.2 had shipped a test-discovery F1 measured the day before by a run nobody made during the release, and `check:metrics` passed four times without objecting, because it verifies `latest.json` against the saved reports and never that a saved report belongs to the release being stamped. Every source report now publishes the version and date it was measured on, a cross-minor-line report is a hard failure, and `benchmark:all` makes "I ran the benchmarks" mean all five of them rather than four. v8.62.0 added Objective-C and PowerShell at Tier 2 (#841/#840, both from an external contributor) and applied the same rule to an extractor: it arrived with a byte-exact fixture and green CI, and a run over 839 real files showed 11% of its output was not a declaration — the fixture proved the extractor parses tidy input, not that it is right about real code. v8.62.1 fixed an externally reported crash (#855): a tree past 125,000 files overflowed the stack wherever a per-file array was spread as call arguments, and the report named one of five such places — the other four were found by running commands on a real 130,000-file tree. v8.62.2 closed `--analyze` test discovery (#769) together with the `plan` change list (#774): both commands now read one coverage index, and a "tested" or "likely to change" claim names the test or the task words behind it. v8.63.0 shipped the dated model profile (#688, #778): the routing advice and the pricing table had been two unrelated, undated literals, and are now one table that prints its date on every output and can be overridden per model and per field. v8.64.0 shipped the cache-stable context layout and its cache fit-check (#683), which reads cache minimums from that table: every written context file is now a stable body, a marker, then the volatile tail, so a prefix cache keeps hitting across commits. Releases since v8.64.0 — v8.65.0 through v8.70.1 — are recorded in their own entries above; v8.70.0 made `verify` check the source instead of the signature index (#914, #910): a real symbol past the 25-signature cap, in a file outside the detected roots or in a construct the extractor does not list is no longer reported as fabricated, and the cap proved to be the smallest of the three reasons. The latest, v8.70.1, is the first release that is entirely about SigMap's own surfaces telling the truth (#918): `review-pr` and `create` stop counting the files SigMap writes, the git hook stops multiplying and stops deleting its neighbours' lines, and `doctor` checks it. Next: security-aware `verify` (secrets, `eval` and shell calls built from interpolation in suggested code), then the next gap the grounding corpus records, and roster-resolved hints in `ask` with the measured token-basis path (#689).

**v8.0 "Evidence Pack & the Pivot" ✓ COMPLETE** — E1 Evidence Pack in v7.26.0, D3 +2 MCP tools (15→17) in v7.27.0, E3 `doctor` in v7.28.0, E4 `mcp install` in v7.29.0, and **v7.30.0** the repositioning pivot: every public surface now states *"the deterministic, verifiable grounding layer for AI code work"* (token reduction demoted to proof) plus **agent recipes** framing Claude Code, Cursor, Cline, Continue, Aider, OpenHands, and Codex CLI as consumers. The v8.0 exit gate is met: a cold user reaches a useful answer in <5 min, an agent consumes the Evidence Pack JSON with zero copy-paste, and no public surface still calls SigMap a "compression tool".

v6.0–v7.0.0 shipped graph-boosted retrieval, incremental signature cache, weights sharing, native tool instructions across all 7 adapters, MCP auto-wire, intelligent source root detection, intent-aware retrieval, cross-session context memory with impact planning, R language support, Python AST extraction, line anchors (Surgical Context), demand-driven retrieval with the `get_lines` MCP tool, the **`verify-ai-output` Hallucination Guard** (five-detector reliable MVP with closest-match suggestions + HTML report), **Memory tools** (`note`, `status`, `read_memory` — 11 MCP tools total), **v7.0.0**: **Squeeze** input minimization with symbol enrichment, full-signatures-under-budget, one canonical usage block, source-of-truth `llms.txt`, and pinned reproducible benchmarks; **v7.1.0**: the **`sigmap gain`** token-savings dashboard (cumulative tokens saved, %, est. $, daily/weekly/monthly trends; privacy-safe, local-only, default-on); and the **grounded-codegen** track — **v7.4–7.5** live-index write hooks + read-time self-heal (Layer 1), **v7.6.0** the offline grounding benchmark (the GATE), **v7.7.0** **`sigmap conventions`** (Layer 3: extract a repo's file-naming / export / test-framework conventions); **v7.8.0** **`conventions --conflicts`** (per-convention breakdown + rename suggestions); **v7.9.0** **`conventions --inject`** (CLAUDE.md convention injection — the agent now sees the house style); **v7.10.0** **`sigmap scaffold`** (Layer 4: convention-matched proposal gated by a confidence floor — closing the last root cause); **v7.11.0** **`sigmap verify-plan`** (Gap 2: plan vs live index); **v7.12.0** **`sigmap review-pr`** (Gap 2: diff audit); and **v7.13.0** **`sigmap create`** (the orchestrator that sequences all four guard stages — the grounded-creation capstone). and **v7.16.0** the **LLM A/B hallucination ablation harness** (§9 — `npm run benchmark:llm-ablation`). The grounded-codegen plan is now functionally complete: every root cause is closed, the full `create` pipeline ships, and the §9 measurement harness is built and offline-tested. and **v7.20.0** the `init` Creation-workflow CLAUDE.md block — **every item in the grounded-codegen implementation plan is now shipped** (4 root causes, the full create pipeline, the conventions flag set, scaffold persistence, and the §9 measurement harness). The §9 A/B now runs live on a real 40-task corpus (Anthropic or Gemini/AI-Studio keys); a first run measured **62.5 → 22.5 flagged errors per 100 with grounding** (v7.22.0), and **v7.22.1** hardened `verify-ai-output`'s file-path extractor so runtime/library names ("Node.js") and placeholder filenames no longer count as fake files — clearing the dominant false-positive class so the §9 delta is clean, and **v7.22.2** cleared the last two false-positive classes (camelCase placeholders + documentation-placeholder imports) — lifting the measured grounding delta from +2 to +9 per 100, and **v7.23.0** made the §9 harness statistically robust (`--runs N` mean ± range over a 100-task corpus); a 100-task run then revealed the "write an example" corpus elicited placeholder scaffolding that masked grounding's effect, so **v7.24.0** redesigned the corpus as checkable repo-fact questions (which file defines `X`?) that isolate grounding, and **v7.24.1** published the first averaged result: grounding cut fabricated file-location claims from **99.8 to 0.2 per 100** (5×100 tasks, Gemini). Next: a generative-correctness §9 variant (does grounding help the model *write* correct code, not just recall paths?), and broader provider/model coverage. Also planned: **PR verification** (`verify-plan` / `review-pr` GitHub Action), the **Interactive Context Explorer**, line anchors for the remaining extractors (9 brace languages shipped across v8.17–v8.18), and performance optimizations for very large monorepos (>50K files).

---

<div style="text-align:center;margin-top:2.5rem;padding-bottom:.5rem;font-size:0.85em;color:var(--vp-c-text-3)">
  Made in Amsterdam, Netherlands <span title="Netherlands">🇳🇱</span>
</div>
