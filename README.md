<div align="center">

<img src="docs-vp/.vitepress/public/logo.svg" alt="SigMap logo" width="64" height="84" />

<h1>⚡ SigMap</h1>

<p><strong>Without SigMap, your AI is flying blind.<br>
92% of your codebase is invisible to it. Every answer is a guess.</strong></p>

<p><sub>One command fixes that. Works with Copilot, Claude Code, Cursor, Windsurf, Gemini.</sub></p>

</div>

<div align="center">
<img src="docs/impact-banner.svg" alt="SigMap — 6× better answers, 97% fewer tokens, 2× fewer prompts" width="760" />
</div>

```sh
npx sigmap   # 10 seconds. zero config. your AI never reads the wrong file again.
```

<div align="center">

[![npm version](https://img.shields.io/npm/v/sigmap?color=7c6af7&label=latest&logo=npm)](https://www.npmjs.com/package/sigmap)
[![CI](https://github.com/manojmallick/sigmap/actions/workflows/ci.yml/badge.svg)](https://github.com/manojmallick/sigmap/actions/workflows/ci.yml)
[![Zero deps](https://img.shields.io/badge/dependencies-zero-22c55e)](package.json)
[![License: MIT](https://img.shields.io/badge/License-MIT-7c6af7.svg)](LICENSE)
[![VS Code](https://img.shields.io/badge/VS%20Code-extension-0078d4?logo=visual-studio-code)](https://marketplace.visualstudio.com/items?itemName=manojmallick.sigmap)
[![JetBrains](https://img.shields.io/badge/JetBrains-plugin-000000?logo=jetbrains)](https://plugins.jetbrains.com/plugin/31109-sigmap--ai-context-engine/)
[![Docs](https://img.shields.io/badge/docs-live-7c6af7?logo=github-pages)](https://manojmallick.github.io/sigmap)
[![GitHub Stars](https://img.shields.io/github/stars/manojmallick/sigmap?style=flat&color=f59e0b&logo=github)](https://github.com/manojmallick/sigmap/stargazers)

</div>

<details>
<summary><strong>Full benchmark breakdown →</strong></summary>

<br/>

<div align="center">
<img src="docs/comparison-chart.svg" alt="SigMap benchmark — before vs after across 3 RAG quality metrics" width="700" />
<br/><sub><a href="https://manojmallick.github.io/sigmap/guide/task-benchmark.html">80 tasks · 16 real repos · no LLM API · <strong>full methodology →</strong></a></sub>
</div>

| | Without SigMap | With SigMap |
|---|:---:|:---:|
| Task success | 10% | **59%** |
| Prompts per task | 2.84 | **1.54** |
| Tokens per session | ~80,000 | **~2,000** |
| Right file found | 13.7% | **87.5%** |
| Hallucination risk | 92% | **0%** |

</details>

---

## Table of contents

| | |
|---|---|
| [What it does](#-what-it-does) | Token reduction table, pipeline overview |
| [Quick start](#-quick-start) | Install (binary or npm), generate in 60 seconds |
| [Standalone binaries](docs/readmes/binaries.md) | macOS, Linux, Windows — no Node required |
| [VS Code extension](#-vs-code-extension) | Status bar, stale alerts, commands |
| [JetBrains plugin](#-jetbrains-plugin) | IntelliJ IDEA, WebStorm, PyCharm support |
| [Languages supported](#-languages-supported) | 21 languages |
| [Context strategies](#-context-strategies) | full / per-module / hot-cold |
| [MCP server](#-mcp-server) | 8 on-demand tools |
| [CLI reference](#-cli-reference) | All flags |
| [Configuration](#-configuration) | Config file + .contextignore |
| [Observability](#-observability) | Health score, reports, CI |
| [Programmatic API](#-programmatic-api) | Use as a Node.js library |
| [Testing](#-testing) | Run the test suite |
| [Project structure](#-project-structure) | File-by-file map |
| [Principles](#-principles) | Design decisions |

> 📖 **New to SigMap?** Read the **[Complete Getting Started Guide](docs/readmes/GETTING_STARTED.md)** — token savings walkthrough, every command, VS Code plugin, and CI setup.

---

## 🔍 What it does

SigMap scans your source files and extracts only the **function and class signatures** — no bodies, no imports, no comments — then writes a compact context file that Copilot, Claude, Cursor, and Windsurf read automatically. Every session starts with full codebase awareness at a fraction of the token cost.

```
Your codebase
    │
    ▼
sigmap ─────────► extracts signatures from 21 languages
    │
    ▼
.github/copilot-instructions.md   ◄── auto-read by Copilot / Claude / Cursor
    │
    ▼
AI agent session starts with full context
```

> **Dogfooding:** SigMap runs on itself — 40 JS files, 8,600 lines of code.
> View the generated context: [`.github/copilot-instructions.md`](.github/copilot-instructions.md)

### Token reduction at every stage

| Stage | Tokens | Reduction |
|---|---:|---:|
| Raw source files | ~80,000 | — |
| Repomix compressed | ~8,000 | 90% |
| **SigMap signatures** | **~4,000** | **95%** |
| SigMap + MCP (`hot-cold`) | ~200 | **99.75%** |

> **97% fewer tokens. The same codebase understanding.**

### Benchmark: real-world repos

Reproduced with `node scripts/run-benchmark.mjs` on public repos:

| Repo | Language | Raw tokens | After SigMap | Reduction |
|------|----------|------------|--------------|-----------|
| express | JavaScript | 15.5K | 201 | **98.7%** |
| flask | Python | 84.8K | 3.4K | **96.0%** |
| gin | Go | 172.8K | 5.7K | **96.7%** |
| spring-petclinic | Java | 77.0K | 634 | **99.2%** |
| rails | Ruby | 1.5M | 7.1K | **99.5%** |
| axios | TypeScript | 31.7K | 1.5K | **95.2%** |
| rust-analyzer | Rust | 3.5M | 5.9K | **99.8%** |
| abseil-cpp | C++ | 2.3M | 6.3K | **99.7%** |
| serilog | C# | 113.7K | 5.8K | **94.9%** |
| riverpod | Dart | 682.7K | 6.5K | **99.0%** |
| okhttp | Kotlin | 31.3K | 1.4K | **95.5%** |
| laravel | PHP | 1.7M | 7.2K | **99.6%** |
| akka | Scala | 790.5K | 7.1K | **99.1%** |
| vapor | Swift | 171.2K | 6.4K | **96.3%** |
| vue-core | Vue | 404.2K | 8.8K | **97.8%** |
| svelte | Svelte | 438.2K | 8.0K | **98.2%** |

**Average: 99.3% reduction across 16 languages.** See [`benchmarks/reports/token-reduction.md`](benchmarks/reports/token-reduction.md) or reproduce with `node scripts/run-benchmark.mjs`.

---

## ⚡ Installation

Pick the method that fits your workflow — all produce the same output.

<details open>
<summary><strong>npx — try without installing</strong></summary>

```bash
npx sigmap
```

Runs the latest version without any permanent install. Great for a quick try.

</details>

<details>
<summary><strong>npm global — install once, run anywhere</strong></summary>

```bash
npm install -g sigmap
sigmap
```

Available from any directory on your machine.

</details>

<details>
<summary><strong>Standalone binaries — no Node.js, no npm</strong></summary>

Download from the latest release:

- <https://github.com/manojmallick/sigmap/releases/latest>

Available assets:

- `sigmap-darwin-arm64` (macOS Apple Silicon)
- `sigmap-linux-x64` (Linux x64)
- `sigmap-win32-x64.exe` (Windows x64)
- `sigmap-checksums.txt` (SHA-256 checksums)

<details>
<summary><strong>macOS / Linux</strong></summary>

Run directly:

```bash
chmod +x ./sigmap-darwin-arm64   # or ./sigmap-linux-x64
./sigmap-darwin-arm64 --help
./sigmap-darwin-arm64
```

Make it globally available in Bash/Zsh (no `./` needed):

```bash
# 1) Pick a user bin dir and move/rename the binary
mkdir -p "$HOME/.local/bin"
mv ./sigmap-darwin-arm64 "$HOME/.local/bin/sigmap"   # or sigmap-linux-x64
chmod +x "$HOME/.local/bin/sigmap"

# 2) Add to PATH in your shell profile
echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$HOME/.zshrc"    # zsh
# echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$HOME/.bashrc"  # bash

# 3) Reload shell and verify
source "$HOME/.zshrc"   # or: source "$HOME/.bashrc"
sigmap --version
```

</details>

<details>
<summary><strong>Windows (PowerShell)</strong></summary>

Run directly:

```powershell
.\sigmap-win32-x64.exe --help
.\sigmap-win32-x64.exe
```

Make it globally available:

```powershell
# 1) Create a user bin directory and rename the binary
New-Item -ItemType Directory -Force "$HOME\bin" | Out-Null
Move-Item .\sigmap-win32-x64.exe "$HOME\bin\sigmap.exe"

# 2) Add user bin to PATH (current user)
[Environment]::SetEnvironmentVariable(
  "Path",
  $env:Path + ";$HOME\bin",
  "User"
)

# 3) Restart PowerShell and verify
sigmap --version
```

</details>

Optional checksum verification:

```bash
shasum -a 256 sigmap-darwin-arm64
# Compare with sigmap-checksums.txt
```

Full guide: [docs/readmes/binaries.md](docs/readmes/binaries.md)

</details>

<details>
<summary><strong>npm local — per-project, version-pinned</strong></summary>

```bash
npm install --save-dev sigmap
```

Add to `package.json` scripts for team consistency:

```json
{
  "scripts": {
    "context": "sigmap",
    "context:watch": "sigmap --watch"
  }
}
```

Run with `npm run context`. Version is pinned per project.

</details>

<details>
<summary><strong>Volta — team-friendly, auto-pinned version</strong></summary>

```bash
volta install sigmap
sigmap
```

[Volta](https://volta.sh) pins the exact version in `package.json` — every team member runs the same version automatically without configuration.

</details>

<details>
<summary><strong>Single-file download — no npm, any machine</strong></summary>

```bash
curl -O https://raw.githubusercontent.com/manojmallick/sigmap/main/gen-context.js
node gen-context.js
```

No npm, no `node_modules`. Drop `gen-context.js` into any project and run it directly. Requires only Node.js 18+. Ideal for CI, locked-down environments, or one-off use.

</details>

---

## 🚀 Features

### Multi-adapter output

Generate context for any AI assistant from a single run:

```bash
sigmap --adapter copilot    # → .github/copilot-instructions.md
sigmap --adapter claude     # → CLAUDE.md (appended below marker)
sigmap --adapter cursor     # → .cursorrules
sigmap --adapter windsurf   # → .windsurfrules
sigmap --adapter openai     # → .github/openai-context.md
sigmap --adapter gemini     # → .github/gemini-context.md
```

| Adapter | Output file | AI assistant |
|---|---|---|
| `copilot` | `.github/copilot-instructions.md` | GitHub Copilot |
| `claude` | `CLAUDE.md` (append) | Claude / Claude Code |
| `cursor` | `.cursorrules` | Cursor |
| `windsurf` | `.windsurfrules` | Windsurf |
| `openai` | `.github/openai-context.md` | Any OpenAI model |
| `gemini` | `.github/gemini-context.md` | Google Gemini |

Configure multiple adapters at once in `gen-context.config.json`:

```json
{ "outputs": ["copilot", "claude", "cursor"] }
```

### Programmatic API

Use SigMap as a Node.js library without spawning a subprocess. See the [full API reference](#-programmatic-api) below.

### Query-aware retrieval

Find the most relevant files for any task without reading the whole codebase:

```bash
sigmap --query "authentication middleware"   # ranked file list
sigmap --query "auth" --json                 # machine-readable output
sigmap --query "auth" --top 5               # top 5 results only
```

### Diagnostic and evaluation tools

```bash
sigmap --analyze                  # per-file: sigs, tokens, extractor, coverage
sigmap --analyze --slow           # include extraction timing
sigmap --diagnose-extractors      # self-test all 21 extractors against fixtures
sigmap --benchmark                # hit@5 and MRR retrieval quality
sigmap --benchmark --json         # machine-readable benchmark results
```

---

## ⚡ Quick start

### Install

**Standalone binary** — no Node.js or npm required:

| Platform | Download |
|---|---|
| macOS Apple Silicon | [`sigmap-darwin-arm64`](https://github.com/manojmallick/sigmap/releases/latest/download/sigmap-darwin-arm64) |
| macOS Intel | [`sigmap-darwin-x64`](https://github.com/manojmallick/sigmap/releases/latest/download/sigmap-darwin-x64) |
| Linux x64 | [`sigmap-linux-x64`](https://github.com/manojmallick/sigmap/releases/latest/download/sigmap-linux-x64) |
| Windows x64 | [`sigmap-win32-x64.exe`](https://github.com/manojmallick/sigmap/releases/latest/download/sigmap-win32-x64.exe) |

```bash
# macOS / Linux
chmod +x ./sigmap-darwin-arm64
./sigmap-darwin-arm64
```

See [docs/readmes/binaries.md](docs/readmes/binaries.md) for Gatekeeper / SmartScreen notes and checksum verification.

**npm** (requires Node.js 18+):

```bash
npx sigmap                  # run once without installing
npm install -g sigmap       # install globally
```

---

### Generate context

Once installed, run from your project root:

```bash
sigmap                         # generate once and exit
sigmap --watch                 # regenerate on every file save
sigmap --setup                 # generate + install git hook + start watcher
sigmap --diff                  # context for git-changed files only (PR mode)
sigmap --diff --staged         # staged files only (pre-commit check)
sigmap --health                # show context health score (grade A–D)
sigmap --mcp                   # start MCP server on stdio
```

### Companion tool: Repomix

SigMap and [Repomix](https://github.com/yamadashy/repomix) are **complementary, not competing**:

| Tool | When to use |
|---|---|
| **SigMap** | Always-on, git hooks, daily signature index (~4K tokens) |
| **Repomix** | On-demand deep sessions, full file content, broader language support |

```bash
sigmap --setup         # always-on context
npx repomix --compress # deep dive sessions
```

*"SigMap for daily always-on context; Repomix for deep one-off sessions — use both."*

---

## 🧩 VS Code extension

The official SigMap VS Code extension keeps your context fresh without any manual commands. Install it once and it runs silently in the background.

| Feature | Detail |
|---|---|
| **Status bar item** | Shows health grade (`A`/`B`/`C`/`D`) + time since last regen; refreshes every 60 s |
| **Stale notification** | Warns when `copilot-instructions.md` is > 24 h old; one-click regeneration |
| **Regenerate command** | `SigMap: Regenerate Context` — runs `sigmap` in the integrated terminal |
| **Open context command** | `SigMap: Open Context File` — opens `.github/copilot-instructions.md` |
| **Script path setting** | `sigmap.scriptPath` — override the path to the `sigmap` binary or `gen-context.js` |

Activates on startup (`onStartupFinished`) — loads within 3 s, never blocks editor startup.

**Install:** [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=manojmallick.sigmap) | [Open VSX Registry](https://open-vsx.org/extension/manojmallick/sigmap)

---

## 🔧 JetBrains plugin

The official SigMap JetBrains plugin brings the same features to IntelliJ-based IDEs. Install it from the JetBrains Marketplace and it works identically to the VS Code extension.

| Feature | Detail |
|---|---|
| **Status bar widget** | Shows health grade (`A`-`F`) + time since last regen; updates every 60 s |
| **Regenerate action** | `Tools → SigMap → Regenerate Context` or **Ctrl+Alt+G** — runs `sigmap` |
| **Open context action** | `Tools → SigMap → Open Context File` — opens `.github/copilot-instructions.md` |
| **View roadmap action** | `Tools → SigMap → View Roadmap` — opens roadmap in browser |
| **One-click regen** | Click status bar widget to regenerate context instantly |

Compatible with **IntelliJ IDEA 2024.1+** (Community & Ultimate), **WebStorm**, **PyCharm**, **GoLand**, **RubyMine**, **PhpStorm**, and all other IntelliJ-based IDEs.

**Install:** [JetBrains Marketplace](https://plugins.jetbrains.com/plugin/31109-sigmap--ai-context-engine/) | [Manual setup guide](docs/readmes/JETBRAINS_SETUP.md)

---

## 🌐 Languages supported

> 21 languages. All implemented with zero external dependencies — pure regex + Node built-ins.

<details>
<summary><strong>Show all 21 languages</strong></summary>

| Language | Extensions | Extracts |
|---|---|---|
| TypeScript | `.ts` `.tsx` | interfaces, classes, functions, types, enums |
| JavaScript | `.js` `.jsx` `.mjs` `.cjs` | classes, functions, exports |
| Python | `.py` `.pyw` | classes, methods, functions |
| Java | `.java` | classes, interfaces, methods |
| Kotlin | `.kt` `.kts` | classes, data classes, functions |
| Go | `.go` | structs, interfaces, functions |
| Rust | `.rs` | structs, impls, traits, functions |
| C# | `.cs` | classes, interfaces, methods |
| C/C++ | `.cpp` `.c` `.h` `.hpp` `.cc` | classes, functions, templates |
| Ruby | `.rb` `.rake` | classes, modules, methods |
| PHP | `.php` | classes, interfaces, functions |
| Swift | `.swift` | classes, structs, protocols, functions |
| Dart | `.dart` | classes, mixins, functions |
| Scala | `.scala` `.sc` | objects, classes, traits, functions |
| Vue | `.vue` | `<script>` functions and components |
| Svelte | `.svelte` | `<script>` functions and exports |
| HTML | `.html` `.htm` | custom elements and script functions |
| CSS/SCSS | `.css` `.scss` `.sass` `.less` | custom properties and keyframes |
| YAML | `.yml` `.yaml` | top-level keys and pipeline jobs |
| Shell | `.sh` `.bash` `.zsh` `.fish` | function declarations |
| Dockerfile | `Dockerfile` `Dockerfile.*` | stages and key instructions |

</details>

---

## 🗂 Context strategies

> Reduce always-injected tokens by 70–90%.

Set `"strategy"` in `gen-context.config.json`:

| Strategy | Always-injected | Context lost? | Needs MCP? | Best for |
|---|---:|:---:|:---:|---|
| `full` | ~4,000 tokens | No | No | Starting out, cross-module work |
| `per-module` | ~100–300 tokens | No | No | Large codebases, module-focused sessions |
| `hot-cold` | ~200–800 tokens | Cold files only | Yes | Claude Code / Cursor with MCP enabled |

### `full` — default, works everywhere

```json
{ "strategy": "full" }
```

One file, all signatures, always injected on every question.

### `per-module` — 70% fewer injected tokens, zero context loss

```json
{ "strategy": "per-module" }
```

One `.github/context-<module>.md` per top-level source directory, plus a tiny overview table. Load the relevant module file for focused sessions. No MCP required.

```
.github/copilot-instructions.md   ← overview table, ~117 tokens (always-on)
.github/context-server.md         ← server/ signatures, ~2,140 tokens
.github/context-web.md            ← web/ signatures,    ~335 tokens
.github/context-desktop.md        ← desktop/ signatures, ~1,583 tokens
```

### `hot-cold` — 90% fewer injected tokens, requires MCP

```json
{ "strategy": "hot-cold", "hotCommits": 10 }
```

Recently committed files are **hot** (auto-injected). Everything else is **cold** (on-demand via MCP). Best reduction available — ~200 tokens always-on.

📖 Full guide: [docs/readmes/CONTEXT_STRATEGIES.md](docs/readmes/CONTEXT_STRATEGIES.md) — decision tree, scenario comparisons, migration steps.

---

## 🔌 MCP server

Start the MCP server on stdio:

```bash
sigmap --mcp
```

### Available tools

| Tool | Input | Output |
|---|---|---|
| `read_context` | `{ module?: string }` | Signatures for one module or entire codebase |
| `search_signatures` | `{ query: string }` | Matching signatures with file paths |
| `get_map` | `{ type: "imports"\|"classes"\|"routes" }` | Structural section from `PROJECT_MAP.md` |
| `explain_file` | `{ path: string }` | Signatures + imports + reverse callers for one file |
| `list_modules` | — | Token-count table of all top-level module directories |
| `create_checkpoint` | `{ summary: string }` | Write a session checkpoint to `.context/` |
| `get_routing` | — | Full model routing table |
| `query_context` | `{ query: string, topK?: number }` | Files ranked by relevance to the query |

Reads files on every call — no stale state, no restart needed.

📖 Setup guide: [docs/readmes/MCP_SETUP.md](docs/readmes/MCP_SETUP.md)

---

## ⚙️ CLI reference

> See [CHANGELOG.md](CHANGELOG.md) for the full history.

All flags are the same regardless of how you invoke SigMap — swap the prefix to match your install:

> `sigmap` · `npx sigmap` · `gen-context` · `node gen-context.js`

<details>
<summary><strong>All flags</strong></summary>

```
sigmap                                        Generate once and exit
sigmap --watch                                Generate and watch for file changes
sigmap --setup                                Generate + install git hook + start watcher
sigmap --diff                                 Generate context for git-changed files only
sigmap --diff --staged                        Staged files only (pre-commit check)
sigmap --mcp                                  Start MCP server on stdio

sigmap --query "<text>"                       Rank files by relevance to a query
sigmap --query "<text>" --json                Ranked results as JSON
sigmap --query "<text>" --top <n>             Limit results to top N files (default 10)

sigmap --analyze                              Per-file breakdown (sigs / tokens / extractor / coverage)
sigmap --analyze --json                       Analysis as JSON
sigmap --analyze --slow                       Include extraction timing per file
sigmap --diagnose-extractors                  Self-test all 21 extractors against fixtures

sigmap --benchmark                            Run retrieval quality benchmark (hit@5 / MRR)
sigmap --benchmark --json                     Benchmark results as JSON
sigmap --eval                                 Alias for --benchmark

sigmap --report                               Token reduction stats
sigmap --report --json                        Structured JSON report (exits 1 if over budget)
sigmap --report --history                     Usage log summary
sigmap --report --history --json              Usage history as JSON

sigmap --health                               Composite health score (0–100, grade A–D)
sigmap --health --json                        Machine-readable health JSON

sigmap --suggest-tool "<task>"                Recommend model tier for a task
sigmap --suggest-tool "<task>" --json         Machine-readable tier recommendation

sigmap --monorepo                             Per-package context for monorepos (packages/, apps/, services/)
sigmap --each                                 Process each sub-repo under a parent directory
sigmap --routing                              Include model routing hints in output
sigmap --format cache                         Write Anthropic prompt-cache JSON
sigmap --track                                Append run metrics to .context/usage.ndjson

sigmap --init                                 Write config + .contextignore scaffold
sigmap --version                              Version string
sigmap --help                                 Usage information
```
</details>


### Task classification — `--suggest-tool`

```bash
sigmap --suggest-tool "security audit of the auth module"
# tier   : powerful
# models : claude-opus-4-6, gpt-5-4, gemini-2-5-pro

sigmap --suggest-tool "fix a typo in the yaml config" --json
# {"tier":"fast","label":"Fast (low-cost)","models":"claude-haiku-4-5, ...","costHint":"~$0.0008 / 1K tokens"}
```

Tiers: `fast` (config/markup/typos) · `balanced` (features/tests/debug) · `powerful` (architecture/security/multi-file)

---

## 🔒 Security scanning

SigMap automatically redacts secrets from all extracted signatures. Ten patterns are checked on every file:

| Pattern | Example match |
|---|---|
| AWS Access Key | `AKIA...` |
| AWS Secret Key | 40-char base64 |
| GCP API Key | `AIza...` |
| GitHub Token | `ghp_...` `gho_...` |
| JWT | `eyJ...` |
| DB Connection String | `postgres://user:pass@...` |
| SSH Private Key | `-----BEGIN ... PRIVATE KEY-----` |
| Stripe Key | `sk_live_...` `sk_test_...` |
| Twilio Key | `SK[32 hex chars]` |
| Generic secret | `password = "..."`, `api_key: "..."` |

If a match is found, the signature is replaced with `[REDACTED — {pattern} detected in {file}]`. The run continues — no silent failures.

---

## ⚙️ Configuration

Copy `gen-context.config.json.example` to `gen-context.config.json`:

```json
{
  "output": ".github/copilot-instructions.md",
  "srcDirs": ["src", "app", "lib"],
  "maxTokens": 6000,
  "outputs": ["copilot"],
  "secretScan": true,
  "strategy": "full",
  "watchDebounce": 300,
  "tracking": false
}
```

**Key fields:**

- **`output`** — custom path for the primary markdown output file (used by `copilot` adapter). Default: `.github/copilot-instructions.md`
- **`outputs`** — which adapters to write to: `copilot` | `claude` | `cursor` | `windsurf`
- **`srcDirs`** — directories to scan (relative to project root)
- **`maxTokens`** — max tokens in final output before budget enforcement
- **`secretScan`** — redact secrets (AWS keys, tokens, etc.) from output
- **`strategy`** — output mode: `full` (default) | `per-module` | `hot-cold`

Exclusions go in `.contextignore` (gitignore syntax). Also reads `.repomixignore` if present.

```
# .contextignore
node_modules/
dist/
build/
*.generated.*
test/fixtures/
```

Run `sigmap --init` to scaffold both files in one step.

### Output targets

| Key | Output file | Read by |
|---|---|---|
| `"copilot"` | `.github/copilot-instructions.md` *(or custom path via `output`)* | GitHub Copilot |
| `"claude"` | `CLAUDE.md` (appends below marker) | Claude Code |
| `"cursor"` | `.cursorrules` | Cursor |
| `"windsurf"` | `.windsurfrules` | Windsurf |

The **`output`** config key sets the primary output file path. It is used by the `copilot` adapter when enabled. Other adapters always write to their fixed paths.

**Example:**

```json
{
  "output": ".context/ai-context.md",
  "outputs": ["copilot"]
}
```

This writes to `.context/ai-context.md` instead of `.github/copilot-instructions.md`.

If `output` is omitted, the default `.github/copilot-instructions.md` is used.

## 📊 Observability

```bash
# Append run metrics to .context/usage.ndjson
sigmap --track

# Structured JSON report for CI (exits 1 if over budget)
sigmap --report --json
# { "version": "2.0.0", "finalTokens": 3200, "reductionPct": 92.4, "overBudget": false }

# Composite health score
sigmap --health
# score: 95/100 (grade A) | reduction: 91.2% | 1 day since regen | 47 runs
```

### Self-healing CI

Copy `examples/self-healing-github-action.yml` to `.github/workflows/` to auto-regenerate context when:
- Context file is more than 7 days old (always active)
- Copilot acceptance rate drops below 30% (requires `COPILOT_API_TOKEN` — GitHub Enterprise)

```yaml
- name: SigMap health check
  run: sigmap --health --json
- name: Regenerate context
  run: sigmap
```

📖 Full guide: [docs/readmes/ENTERPRISE_SETUP.md](docs/readmes/ENTERPRISE_SETUP.md)

### Prompt caching — 60% API cost reduction

```bash
sigmap --format cache
# Writes: .github/copilot-instructions.cache.json
# Format: { type: 'text', text: '...', cache_control: { type: 'ephemeral' } }
```

📖 Full guide: [docs/readmes/REPOMIX_CACHE.md](docs/readmes/REPOMIX_CACHE.md)

---

## 📦 Programmatic API

Use SigMap as a library — no CLI subprocess needed:

```js
const { extract, rank, buildSigIndex, scan, score } = require('sigmap');

// Extract signatures from source code
const sigs = extract('function hello() {}', 'javascript');

// Build an index and rank files by query
const index = buildSigIndex('/path/to/project');
const results = rank('authentication middleware', index);

// Scan signatures for secrets before storing
const { safe, redacted } = scan(sigs, 'src/config.ts');

// Get a composite health score for a project
const health = score('/path/to/project');
```

📖 Full API reference: [packages/core/README.md](packages/core/README.md)

---

## 🧪 Testing

```bash
# All 21 language extractors
node test/run.js

# Single language
node test/run.js typescript

# Regenerate expected outputs after extractor changes
node test/run.js --update

# Full integration suite
node test/integration/all.js
```

### Validation gates

```bash
# Gate 1 — all tests pass
node test/run.js
# Expected: 21/21 PASS

# Gate 2 — zero external dependencies
grep "require(" gen-context.js | grep -v "^.*//.*require"
# Expected: only fs, path, assert, os, crypto, child_process, readline

# Gate 3 — MCP server responds correctly
echo '{"jsonrpc":"2.0","method":"tools/list","id":1}' | node gen-context.js --mcp
# Expected: valid JSON with 8 tools

# Gate 4 — npm artifact is clean
npm pack --dry-run
# Expected: no test/, docs/, vscode-extension/ in output
```

---

## 📁 Project structure

```
sigmap/
│
├── gen-context.js               ← PRIMARY ENTRY POINT — single file, zero deps
├── gen-project-map.js           ← import graph, class hierarchy, route table
│
├── packages/
│   ├── core/                    ← programmatic API — require('sigmap') (v2.4)
│   │   └── index.js             ← extract, rank, buildSigIndex, scan, score
│   └── cli/                     ← thin CLI wrapper / v3 compat shim (v2.4)
│
├── src/
│   ├── extractors/              ← 21 language extractors (one file per language)
│   ├── retrieval/               ← query-aware ranker + tokenizer (v2.3)
│   ├── eval/                    ← benchmark runner + scorer (v2.1), analyzer (v2.2)
│   ├── mcp/                     ← MCP stdio server — 8 tools
│   ├── security/                ← secret scanner — 10 patterns
│   ├── routing/                 ← model routing hints
│   ├── tracking/                ← NDJSON usage logger
│   ├── health/                  ← composite health scorer
│   ├── format/                  ← Anthropic prompt-cache formatter
│   └── config/                  ← config loader + defaults
│
├── vscode-extension/            ← VS Code extension (v1.5)
│   ├── package.json             ← manifest — commands, settings, activation
│   └── src/extension.js         ← status bar, stale notification, commands
│
├── test/
│   ├── fixtures/                ← one source file per language
│   ├── expected/                ← expected extractor output
│   ├── run.js                   ← zero-dep test runner
│   └── integration/             ← 20 integration test files (304 tests)
│
├── docs/                        ← documentation site (GitHub Pages)
│   ├── index.html               ← homepage
│   ├── quick-start.html
│   ├── strategies.html
│   ├── languages.html
│   ├── roadmap.html
│   └── repomix.html
│
├── scripts/
│   ├── ci-update.sh             ← CI pipeline helper
│   └── release.sh               ← version bump + npm publish helper
│
├── examples/
│   ├── self-healing-github-action.yml
│   ├── github-action.yml            ← ready-to-use CI workflow
│   └── claude-code-settings.json    ← MCP server config example
│
├── .npmignore                   ← excludes docs/, test/, vscode-extension/ from publish
├── .contextignore.example       ← exclusion template
└── gen-context.config.json.example ← annotated config reference
```

---

## 🏗 Principles

| Principle | Implementation |
|---|---|
| **Zero npm dependencies** | `npx sigmap` on any machine — no install required. Or use the standalone binary for zero Node.js dependency. |
| **Never throw** | All extractors return `[]` on any error — the run always completes |
| **Deterministic** | No AI or LLM involved in extraction — only regex + Node built-ins |
| **Repomix is a companion** | Use both tools; SigMap never replaces Repomix |
| **No telemetry** | Never phones home; all state is files in your repo |
| **Local-first** | No cloud service, no database, no accounts |

---

## 🤝 Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for how to add a language extractor or new feature.

Every extractor follows the same contract:

```javascript
module.exports = { extract };
function extract(src) {   // src: string → string[]
  if (!src || typeof src !== 'string') return [];
  // ... regex extraction only — no external dependencies ...
  return sigs.slice(0, 25);  // never more than 25 signatures per file
}
```

---

## ⭐ Support

If SigMap saves you context or API spend, a ⭐ on [GitHub](https://github.com/manojmallick/sigmap) helps others find it.

---

## 📄 License

MIT © 2026 [Manoj Mallick](https://github.com/manojmallick) · Made in Amsterdam 🇳🇱

---

<div align="center">

If SigMap saves you time — a ⭐ on [GitHub](https://github.com/manojmallick/sigmap) helps others find it.

**[Docs](https://manojmallick.github.io/sigmap) · [Changelog](CHANGELOG.md) · [Roadmap](https://manojmallick.github.io/sigmap/roadmap.html) · [Repomix](https://github.com/yamadashy/repomix)**

</div>
