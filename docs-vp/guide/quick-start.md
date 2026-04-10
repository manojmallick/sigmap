---
title: Quick start
description: Get SigMap running in under 2 minutes. One file download, zero npm install, instant 97% token reduction for your AI coding agent.
head:
  - - meta
    - property: og:title
      content: "SigMap Quick Start — under 2 minutes to working"
  - - meta
    - property: og:description
      content: "node gen-context.js. That's the entire install. Reduces AI context from 80K to 4K tokens automatically."
  - - meta
    - property: og:url
      content: "https://manojmallick.github.io/sigmap/guide/quick-start"
  - - meta
    - property: og:type
      content: article
  - - meta
    - name: twitter:title
      content: "SigMap Quick Start — under 2 minutes to working"
  - - meta
    - name: twitter:description
      content: "node gen-context.js. That's the entire install. Reduces AI context from 80K to 4K tokens automatically."
  - - meta
    - name: twitter:image:alt
      content: "SigMap Quick Start Guide"
  - - meta
    - name: keywords
      content: "sigmap quick start, install sigmap, ai context setup, copilot instructions setup, zero npm install, sigmap tutorial, npx sigmap"
---
# Quick start

Get SigMap running in under two minutes.

## Prerequisites

- **Node.js 18 or later** — check with `node --version`
- A git repository to generate context for

## Install methods

### npm global install

The simplest way for most developers.

```bash
npm install -g sigmap
sigmap
```

### npx (no install)

Run directly without installing.

```bash
npx sigmap
```

### curl single file

Download the single self-contained file and run it directly. Zero npm install.

```bash
curl -O https://raw.githubusercontent.com/manojmallick/sigmap/main/gen-context.js
node gen-context.js
```

### Binary download

Pre-built binaries are available on the [GitHub releases page](https://github.com/manojmallick/sigmap/releases) for macOS, Linux, and Windows.

### VS Code extension

Install from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=manojmallick.sigmap) or search for **SigMap** in the Extensions panel.

The extension adds:
- A status bar item showing health grade and time since last regeneration
- **Regenerate Context** and **Open Context File** commands
- A stale-context warning after 24 hours

### JetBrains plugin

Install from the [JetBrains Marketplace](https://plugins.jetbrains.com/plugin/sigmap) or search for **SigMap** inside IntelliJ IDEA, WebStorm, GoLand, PyCharm, Rider, CLion, RubyMine, PhpStorm, DataGrip, AppCode, Android Studio, Aqua, DataSpell, Fleet, or any other JetBrains IDE.

## 4-step workflow

### Step 1 — Run once to generate

```bash
sigmap
# or: node gen-context.js
```

This writes `.github/copilot-instructions.md` (and `CLAUDE.md` if configured).

### Step 2 — Set up automation

Run `--setup` once to install a git post-commit hook and start the file watcher:

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

### Step 3 — Open your AI coding tool

GitHub Copilot reads `.github/copilot-instructions.md` automatically. Claude Code reads `CLAUDE.md`. Cursor and Windsurf pick up the context file based on the output path in your config.

### Step 4 — Keep it fresh

From this point, every `git commit` regenerates the context file automatically. Use `--watch` for sub-second updates during active coding:

```bash
sigmap --watch
```

## Verify it's working

```bash
sigmap --health
```

Expected output:

```
[sigmap] score: 94  grade: A
[sigmap] context: .github/copilot-instructions.md
[sigmap] last generated: 2m ago
[sigmap] token reduction: 95.3%
```

## Next steps

- [CLI reference](/guide/cli) — all flags with examples
- [Config reference](/guide/config) — all 21 config keys
- [MCP server setup](/guide/mcp) — wire up 8 on-demand tools for Claude Code and Cursor
- [Strategies](/guide/strategies) — choose full, per-module, or hot-cold
