---
title: Roadmap
description: SigMap version history and roadmap. From v0.0 to v5.2, with the latest milestone focused on trust, workflow, and local learning.
head:
  - - meta
    - property: og:title
      content: "SigMap Roadmap — version history and upcoming features"
  - - meta
    - property: og:description
      content: "25 versions shipped and planned. See what changed in each release and what is coming next."
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

Thirty-plus versions shipped/planned. MIT open source from day one.

**Stats:** 98.1% overall token reduction · 460+ tests passing · 29 languages · 0 npm deps

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

### v5.2 — Learning engine + workflow-first docs ✓ (tagged v5.2.0 — 2026-04-16)

This release turns SigMap into a stronger daily workflow product, not just a signature generator.

- **`sigmap learn`** adds safe local-only ranking feedback for good and bad files.
- **`sigmap weights`** makes the learned multipliers visible and resettable.
- **`sigmap judge --learn`** can apply opt-in confidence-gated updates based on groundedness.
- **HTML benchmark report** consolidates token, retrieval, quality, and task metrics into one self-contained page.
- **Workflow-first docs** elevate `ask`, `validate`, `judge`, and learning as first-class product surfaces.

**Tags:** `sigmap learn` · `sigmap weights` · `judge --learn` · `.context/weights.json` · `benchmark-report.html`

---

## Current milestone — v5.x

Current focus after v5.2: unify the benchmark runners around the shared ranker, benchmark the learning engine directly, and keep the public metrics synchronized across CLI, docs, and release surfaces.

---

<div style="text-align:center;margin-top:2.5rem;padding-bottom:.5rem;font-size:0.85em;color:var(--vp-c-text-3)">
  Made in Amsterdam, Netherlands <span title="Netherlands">🇳🇱</span>
</div>
