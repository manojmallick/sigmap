# SigMap — AI Context Engine for VS Code

**Zero-dependency AI context engine. 97% token reduction. Always-on code signatures.**

[![Version](https://img.shields.io/visual-studio-marketplace/v/manojmallick.sigmap?color=7c6af7&label=marketplace)](https://marketplace.visualstudio.com/items?itemName=manojmallick.sigmap)
[![Installs](https://img.shields.io/visual-studio-marketplace/i/manojmallick.sigmap)](https://marketplace.visualstudio.com/items?itemName=manojmallick.sigmap)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](https://github.com/manojmallick/sigmap/blob/main/LICENSE)

---

## What it does

SigMap extracts a compact **signature map** of your codebase — function names, class hierarchies, exported types — and writes it to `.github/copilot-instructions.md`. Every time you open VS Code or run a regeneration, GitHub Copilot (and any other AI assistant) starts with full codebase context at under **4,000 tokens**.

- **21 language extractors** — TypeScript, JavaScript, Python, Go, Rust, Java, C#, C++, Ruby, PHP, Swift, Dart, Kotlin, Scala, Vue, Svelte, HTML, CSS, YAML, Shell, Dockerfile
- **Zero npm dependencies** — runs on any machine with Node.js 18+
- **Secret scanning** — redacts AWS keys, GitHub tokens, DB connection strings before writing
- **MCP server** — exposes `read_context`, `search_signatures`, `get_map` tools for Claude / Cursor
- **Health scoring** — grades your context file A–D so you know when to regenerate

---

## Requirements

- **Node.js 18+** installed on the machine
- `gen-context.js` present in your workspace root (comes with the [`sigmap`](https://www.npmjs.com/package/sigmap) npm package)

Install via npm (optional — the extension auto-detects it):
```bash
npm install -g sigmap
# or use it without installing:
npx sigmap
```

---

## Getting Started

1. Install the extension
2. Open a project that has `gen-context.js` in its root (or install `sigmap` globally)
3. The **SigMap status bar item** appears at the bottom — showing your context health grade and how long ago it was last generated
4. Run **`SigMap: Regenerate Context`** from the Command Palette (`⇧⌘P`) to refresh

---

## Features

### Status Bar
The status bar item shows your context health at a glance:

| Icon | Meaning |
|---|---|
| `$(check) A` | Context is fresh and complete |
| `$(info) B` | Good — minor gaps |
| `$(warning) C` | Stale or incomplete — regenerate soon |
| `$(error) D` | Context is very stale or missing |

Click the status bar item to **open the context file** directly.

### Commands

| Command | Description |
|---|---|
| `SigMap: Regenerate Context` | Runs `node gen-context.js` in your workspace root |
| `SigMap: Open Context File` | Opens `.github/copilot-instructions.md` in the editor |

Access both from the Command Palette (`⇧⌘P` / `Ctrl+Shift+P`).

### Stale Context Notification
If your context file hasn't been updated in **24 hours**, SigMap shows a notification with a one-click **Regenerate** button.

---

## Extension Settings

| Setting | Default | Description |
|---|---|---|
| `sigmap.scriptPath` | `""` | Absolute path to `gen-context.js`. Leave empty to auto-detect from workspace root. |

---

## How SigMap works

```
Your codebase  →  21 language extractors  →  signatures only  →  token budget
                                                                      ↓
                                              .github/copilot-instructions.md
                                                                      ↓
                                              Copilot / Claude / Cursor / Gemini
```

A 50,000-line TypeScript monorepo becomes ~3,800 tokens of pure signatures — **97% reduction** with zero information loss for AI navigation.

---

## Companion: Repomix

For deep one-off sessions (full code review, major refactor), use [Repomix](https://github.com/yamadashy/repomix) alongside SigMap:

- **SigMap** — always-on, daily context at < 4K tokens
- **Repomix** — deep sessions, full file content, when you need everything

---

## Related Resources

- [GitHub Repository](https://github.com/manojmallick/sigmap)
- [npm package: sigmap](https://www.npmjs.com/package/sigmap)
- [Documentation](https://manojmallick.github.io/sigmap/)
- [Changelog](https://github.com/manojmallick/sigmap/blob/main/CHANGELOG.md)
- [Report an Issue](https://github.com/manojmallick/sigmap/issues)

---

## License

MIT © 2026 [Manoj Mallick](https://github.com/manojmallick)
