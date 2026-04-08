<div align="center">

# SigMap

### Zero-dependency AI context engine for VS Code

**97% token reduction · 21 languages · Always-on · Node 18+**

[![VS Marketplace](https://img.shields.io/visual-studio-marketplace/v/manojmallick.sigmap?color=7c6af7&label=VS%20Marketplace&logo=visual-studio-code)](https://marketplace.visualstudio.com/items?itemName=manojmallick.sigmap)
[![Open VSX](https://img.shields.io/open-vsx/v/manojmallick/sigmap?color=a251e3&label=Open%20VSX&logo=vscodium)](https://open-vsx.org/extension/manojmallick/sigmap)
[![Installs](https://img.shields.io/visual-studio-marketplace/i/manojmallick.sigmap?color=blue&logo=visual-studio-code)](https://marketplace.visualstudio.com/items?itemName=manojmallick.sigmap)
[![Rating](https://img.shields.io/visual-studio-marketplace/r/manojmallick.sigmap?color=brightgreen)](https://marketplace.visualstudio.com/items?itemName=manojmallick.sigmap)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](https://github.com/manojmallick/sigmap/blob/main/LICENSE)
[![Node ≥18](https://img.shields.io/badge/node-%E2%89%A518-brightgreen?logo=node.js)](https://nodejs.org)

</div>

---

## What is SigMap?

SigMap extracts a compact **signature map** of your entire codebase — function names, class hierarchies, exported types, interfaces — and writes it to `.github/copilot-instructions.md` automatically.

Every AI coding assistant (GitHub Copilot, Claude, Cursor, Windsurf, Gemini) reads that file as its **first-message context**. Without it, the AI starts each session knowing nothing about your project. With SigMap, it starts with everything.

```
Before SigMap:  "I don't know your codebase structure — can you share some files?"
After SigMap:   "I can see your AuthService, UserRepository, 47 API routes …"
```

**A 50,000-line TypeScript monorepo → ~3,800 tokens of pure signatures — 97% reduction, zero information loss.**

---

## 🆕 What's new in 2.0

| Feature | Description |
|---|---|
| **TODO extraction** | Inline TODO/FIXME/HACK comments surfaced in context output |
| **Recent changes** | Git log summary so the AI knows what you've been working on |
| **Coverage gaps** | Highlights files/functions lacking tests |
| **PR diff context** | `--diff <base>` shows changed-file signatures for focused reviews |
| **Dependency map** | Import/require graph for Python and TypeScript |
| **Impact radius** | Reverse dependency annotations (used by: ...) |
| **Enriched signatures** | Return types, type hints, and schema field collapse across all 21 languages |
| **New helper extractors** | `deps.js`, `todos.js`, `coverage.js`, `prdiff.js` |

Several v2 enhancements (deps map, TODOs, recent changes) are enabled by default. All v2 sections can be tuned or disabled via `gen-context.config.json`.

---

## ✨ Features

### 🔄 Auto-regeneration on startup
The extension checks your context file every time VS Code starts and every 60 seconds while it's running. If the file is missing or stale, you're immediately notified.

### 📊 Live health grade in the status bar
A persistent status bar item shows your context health at a glance — no need to dig into files.

| Grade | Status bar | Meaning |
|:---:|---|---|
| **A** | `sm: ✔ A 2h ago` | Fresh and complete — AI has full codebase context |
| **B** | `sm: ℹ B 6h ago` | Good — minor gaps, regenerate when convenient |
| **C** | `sm: ⚠ C 1d ago` | Stale — missing recent changes, regenerate soon |
| **D** | `sm: ✖ D 3d ago` | Very stale or incomplete — regenerate now |

Click the status bar item to trigger an **instant regeneration**.

### 🔔 Stale context notifications
If your context hasn't been refreshed in over **24 hours**, SigMap pops up a smart notification with a one-click **Regenerate** button — or you can dismiss it permanently per workspace.

### ⚡ One-command regeneration
Run `SigMap: Regenerate Context` from the Command Palette and watch the terminal produce a fresh context file in seconds.

### 🔒 Secret scanning built-in
SigMap scans every signature before writing. If an AWS key, GitHub token, DB connection string, or Stripe key is detected in a function signature, it's **automatically redacted** — never leaks into your context file.

### 🗺 MCP server support
SigMap ships with a built-in **Model Context Protocol (MCP) server** for Claude and Cursor, exposing **7 tools**:
- `read_context` — full or per-module signature map
- `search_signatures` — keyword search across all signatures
- `get_map` — import graph, class hierarchy, or route table
- `create_checkpoint` — session checkpoint with git state and context snapshot
- `get_routing` — model routing hints (fast/balanced/powerful tiers)
- `explain_file` — signatures, imports, and callers for a specific file
- `list_modules` — all top-level modules sorted by token count

---

## 🌐 21 Language Support

| Language | Extensions |
|---|---|
| TypeScript | `.ts`, `.tsx` |
| JavaScript | `.js`, `.jsx`, `.mjs`, `.cjs` |
| Python | `.py`, `.pyw` |
| Go | `.go` |
| Rust | `.rs` |
| Java | `.java` |
| C# | `.cs` |
| C / C++ | `.c`, `.cpp`, `.h`, `.hpp`, `.cc` |
| Ruby | `.rb`, `.rake` |
| PHP | `.php` |
| Swift | `.swift` |
| Dart | `.dart` |
| Kotlin | `.kt`, `.kts` |
| Scala | `.scala`, `.sc` |
| Vue | `.vue` |
| Svelte | `.svelte` |
| HTML | `.html`, `.htm` |
| CSS / SCSS / Sass | `.css`, `.scss`, `.sass`, `.less` |
| YAML | `.yml`, `.yaml` |
| Shell | `.sh`, `.bash`, `.zsh`, `.fish` |
| Dockerfile | `Dockerfile`, `Dockerfile.*` |

---

## 🚀 Quick Start

### Step 1 — Install the sigmap CLI

```bash
npm install -g sigmap
```

Or use it without installing:
```bash
npx sigmap
```

### Step 2 — Generate your first context file

Open your project in VS Code, then open the Command Palette (`⇧⌘P` / `Ctrl+Shift+P`) and run:

```
SigMap: Regenerate Context
```

This creates `.github/copilot-instructions.md` in your workspace root — including v2 sections like TODO/FIXME extraction, recent git changes, and coverage gaps (all enabled by default).

### Step 3 — Done

GitHub Copilot automatically picks up `.github/copilot-instructions.md`. Claude, Cursor, Windsurf and Gemini also read it when configured. Your AI assistant now knows your entire codebase.

> **Tip:** Commit `.github/copilot-instructions.md` to your repo so every team member and CI run benefits.

---

## 🔧 Requirements

| Requirement | Details |
|---|---|
| **Node.js** | Version 18 or higher — [download here](https://nodejs.org) |
| **sigmap CLI** | `npm install -g sigmap`, local `npm install sigmap`, `npx sigmap`, or standalone binary in `PATH` |
| **VS Code** | 1.85.0 or higher |
| **Dependencies** | **Zero** — no npm install needed for the CLI |

> Auto-detection order: `sigmap.scriptPath` → local `gen-context.js` → workspace `node_modules/.bin` (`sigmap`/`gen-context`) → common global locations (Volta, nvm, npm/global bins) → shell lookup.

---

## ⚙️ Extension Settings

Access via `File → Preferences → Settings` → search for **SigMap**, or edit `settings.json` directly.

| Setting | Type | Default | Description |
|---|---|---|---|
| `sigmap.scriptPath` | `string` | `""` | Absolute path to `gen-context.js`. Leave empty to auto-detect from workspace root or global install. |

**Example `settings.json`:**
```json
{
  "sigmap.scriptPath": "/Users/you/.npm-global/lib/node_modules/sigmap/gen-context.js"
}
```

---

## 🖥 Commands Reference

Open the Command Palette (`⇧⌘P` / `Ctrl+Shift+P`) and type **SigMap**:

| Command | Keyboard | Description |
|---|---|---|
| `SigMap: Regenerate Context` | — | Runs `node gen-context.js` in your workspace root |
| `SigMap: Open Context File` | — | Opens `.github/copilot-instructions.md` in the editor |

### CLI commands (terminal)

| Command | Description |
|---|---|
| `node gen-context.js` | Generate context once and exit |
| `node gen-context.js --watch` | Generate + watch for changes |
| `node gen-context.js --setup` | Generate + install git hook + start watcher |
| `node gen-context.js --diff <base>` | Show changed-file signatures vs a git ref |
| `node gen-context.js --health` | Print context health grade |
| `node gen-context.js --report` | Token reduction stats to stdout |
| `node gen-context.js --report --json` | Token report as JSON (for CI) |
| `node gen-context.js --mcp` | Start MCP server on stdio |
| `node gen-context.js --init` | Write example config file |

---

## 🏗 How It Works

```
┌─────────────────────────────────────────────────────────┐
│                      Your codebase                       │
│  src/auth.ts  src/api/*.go  lib/models.py  ...          │
└─────────────────┬───────────────────────────────────────┘
                  │  21 language extractors (regex, zero deps)
                  ▼
┌─────────────────────────────────────────────────────────┐
│              Signature map (function names,              │
│              class hierarchy, exported types)            │
│                 ~3,800 tokens  ←  97% smaller            │
└─────────────────┬───────────────────────────────────────┘
                  │  secret scan → token budget → format
                  ▼
        .github/copilot-instructions.md
                  │
          ┌───────┴────────┐
          ▼                ▼
   GitHub Copilot    Claude / Cursor
   Gemini / Windsurf   (via MCP server)
```

**The extractors use only regex and string operations — no AST parser, no npm install, runs in under 1 second on most codebases.**

---

## 📈 Token Reduction in Practice

| Codebase | Raw tokens | After SigMap | Reduction |
|---|---:|---:|---:|
| Small SaaS (15 files, TS) | ~12,000 | ~480 | **96%** |
| Mid-size API (60 files, Go+TS) | ~85,000 | ~2,100 | **97.5%** |
| Large monorepo (200+ files) | ~400,000 | ~5,800 | **98.5%** |

> Token counts estimated at 4 chars/token (standard approximation).

---

## 🤝 AI Tool Integration

### GitHub Copilot
No configuration needed. Copilot reads `.github/copilot-instructions.md` automatically in every chat and inline suggestion.

### Claude (claude.ai / Claude Code)
Append to `CLAUDE.md` by adding to your config:
```json
{ "outputs": ["claude"] }
```

### Cursor
Add `.cursorrules` output:
```json
{ "outputs": ["cursor"] }
```

### Windsurf
Add `.windsurfrules` output:
```json
{ "outputs": ["windsurf"] }
```

### MCP server (Claude / Cursor)
```bash
node gen-context.js --mcp
```
Exposes 7 tools over stdio JSON-RPC: `read_context`, `search_signatures`, `get_map`, `create_checkpoint`, `get_routing`, `explain_file`, `list_modules`.

---

## 🔍 Companion: Repomix

SigMap is designed to work alongside **[Repomix](https://github.com/yamadashy/repomix)** (15K ⭐):

| Tool | Use case | Tokens |
|---|---|---|
| **SigMap** | Always-on daily context, fast iteration | < 4K |
| **Repomix** | Deep one-off sessions, full code review | 50K–200K |

Use SigMap for every session. Reach for Repomix when you need full file content.

---

## 🐛 Troubleshooting

**Status bar shows `sm: no context`**
→ Run `SigMap: Regenerate Context`. If it fails, check that Node.js 18+ is installed: `node --version`

**"command not found" warning**
→ Try one of:
1. `npm install -g sigmap`
2. `npm install sigmap` (project-local)
3. Add standalone binary (`sigmap`/`sigmap.exe`) to your system `PATH`
4. Set `sigmap.scriptPath` to an absolute `gen-context.js` path

**Context file is generated but Copilot doesn't seem to use it**
→ The file must be at `.github/copilot-instructions.md` in your workspace root. Check `File → Open Folder` opened the right directory.

**Grade is always "A" even on a stale file**
→ `gen-context.js --health --json` may not be available in older versions. Upgrade: `npm update -g sigmap`

**Want to exclude files from the context?**
→ Create `.contextignore` in your project root (gitignore syntax). Example:
```
node_modules/
*.test.ts
dist/
```

---

## 🏪 Available on

| Store | Editors | Link |
|---|---|---|
| **VS Code Marketplace** | VS Code, Cursor | [marketplace.visualstudio.com](https://marketplace.visualstudio.com/items?itemName=manojmallick.sigmap) |
| **Open VSX Registry** | VSCodium, Gitpod, Theia, Eclipse, Windsurf | [open-vsx.org](https://open-vsx.org/extension/manojmallick/sigmap) |
| **npm (CLI)** | Any terminal / CI | [npmjs.com/package/sigmap](https://www.npmjs.com/package/sigmap) |
| **GitHub Packages** | Enterprise / private registries | [@manojmallick/sigmap](https://github.com/manojmallick/sigmap/packages) |

---

## 📦 Related Resources

| Resource | Link |
|---|---|
| 📖 Documentation | [manojmallick.github.io/sigmap](https://manojmallick.github.io/sigmap/) |
| 📦 npm package | [npmjs.com/package/sigmap](https://www.npmjs.com/package/sigmap) |
| 🟣 Open VSX | [open-vsx.org/extension/manojmallick/sigmap](https://open-vsx.org/extension/manojmallick/sigmap) |
| 💻 GitHub | [github.com/manojmallick/sigmap](https://github.com/manojmallick/sigmap) |
| 📝 Changelog | [CHANGELOG.md](https://github.com/manojmallick/sigmap/blob/main/CHANGELOG.md) |
| 🐛 Issues | [github.com/manojmallick/sigmap/issues](https://github.com/manojmallick/sigmap/issues) |
| 💬 Discussions | [github.com/manojmallick/sigmap/discussions](https://github.com/manojmallick/sigmap/discussions) |

---

## 🤗 Contributing

Contributions welcome! To add a new language extractor:

1. Fork the [sigmap repo](https://github.com/manojmallick/sigmap)
2. Add `src/extractors/{language}.js` following the extractor contract in [CONTRIBUTING.md](https://github.com/manojmallick/sigmap/blob/main/CONTRIBUTING.md)
3. Add fixture + expected output in `test/`
4. Submit a PR

---

<div align="center">

MIT © 2026 [Manoj Mallick](https://github.com/manojmallick) · Made in Amsterdam 🇳🇱

*SigMap for daily always-on context · Repomix for deep one-off sessions — use both.*

</div>
