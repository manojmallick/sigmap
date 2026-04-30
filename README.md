<div align="center">

<img src="assets/logo.png" alt="SigMap logo" width="80" height="80" />

# ⚡ SigMap

**SigMap finds the right files before your AI answers.**

[![npm version](https://img.shields.io/npm/v/sigmap?color=7c6af7&label=latest&logo=npm)](https://www.npmjs.com/package/sigmap)
[![npm downloads](https://img.shields.io/npm/dt/sigmap?color=22c55e&label=downloads&logo=npm)](https://www.npmjs.com/package/sigmap)
[![CI](https://github.com/manojmallick/sigmap/actions/workflows/ci.yml/badge.svg)](https://github.com/manojmallick/sigmap/actions/workflows/ci.yml)
[![Zero deps](https://img.shields.io/badge/dependencies-zero-22c55e)](package.json)
[![License: MIT](https://img.shields.io/badge/License-MIT-7c6af7.svg)](LICENSE)
[![GitHub Stars](https://img.shields.io/github/stars/manojmallick/sigmap?style=flat&color=f59e0b&logo=github)](https://github.com/manojmallick/sigmap/stargazers)

</div>

---

## Try it now

```bash
npx sigmap
sigmap ask "Where is auth handled?"
```

Zero config. Zero dependencies. Under 10 seconds.

---

## What is SigMap?

SigMap extracts function and class signatures from your codebase and feeds the right files — not the whole repo — to your AI.

Works with Copilot, Claude, Cursor, Windsurf, and any LLM.

---

## Why SigMap?

- **80.0% hit@5** — right file found in top 5 results (vs 13.6% baseline)
- **40–98% token reduction** — 2K–4K tokens instead of 80K+
- **52.2% task success rate** — up from 10% without context
- **1.68 prompts per task** — down from 2.84
- **Works with any LLM** — no API key, no cloud, no accounts
- **Zero npm dependencies** — `npx sigmap` on any machine

---

## Replace this with SigMap

| Without SigMap | With SigMap |
|---|---|
| ❌ Guessing which files are relevant | ✅ Right file in context — 81% of the time |
| ❌ Sending the full repo to your AI | ✅ Minimal context — only what matters |
| ❌ Embeddings / vector DB required | ✅ Grounded answers, no infra needed |

---

## How it works

```
Ask → Rank → Context → Validate → Judge → Learn
```

1. **Ask** — `sigmap ask "Where is auth handled?"` — ranked file list
2. **Rank** — TF-IDF scores every file against your query
3. **Context** — writes compact signatures to your AI's context file
4. **Validate** — `sigmap validate` — confirms right files are in scope
5. **Judge** — `sigmap judge` — scores answer groundedness against context
6. **Learn** — `sigmap weights` — boosts files that keep solving your tasks

---

## Benchmark

```
Benchmark : sigmap-v6.6-main
Date      : 2026-04-30

Hit@5          : 80.0%   (baseline 13.6%  — 5.9× lift)
Prompt reduction : 41.0%
Task success   : 52.2%   (baseline 10%)
Prompts / task : 1.68    (baseline 2.84)
Token reduction: 40–98%  (avg 96.8% across 18 real repos)
```

Measured on 90 coding tasks across 18 real public repos. No LLM API — fully reproducible.

[Full methodology →](https://manojmallick.github.io/sigmap/guide/benchmark.html)

<div align="center">
<img src="docs/comparison-chart.svg" alt="SigMap benchmark — before vs after across 3 RAG quality metrics" width="700" />
</div>

---

## Install

**Try without installing:**

```bash
npx sigmap
```

**Install globally:**

```bash
npm install -g sigmap
```

**Install per-project:**

```bash
npm install --save-dev sigmap
```

**Standalone binary** — no Node.js required:

| Platform | Download |
|---|---|
| macOS Apple Silicon | [`sigmap-darwin-arm64`](https://github.com/manojmallick/sigmap/releases/latest/download/sigmap-darwin-arm64) |
| macOS Intel | [`sigmap-darwin-x64`](https://github.com/manojmallick/sigmap/releases/latest/download/sigmap-darwin-x64) |
| Linux x64 | [`sigmap-linux-x64`](https://github.com/manojmallick/sigmap/releases/latest/download/sigmap-linux-x64) |
| Windows x64 | [`sigmap-win32-x64.exe`](https://github.com/manojmallick/sigmap/releases/latest/download/sigmap-win32-x64.exe) |

Each binary ships with a `.sha256` checksum. [Verify a binary →](docs/readmes/binaries.md)

**Volta:**

```bash
volta install sigmap
```

---

## Integrations

**AI assistants — one run, all of them:**

| Adapter | Output file | Used by |
|---|---|---|
| `copilot` | `.github/copilot-instructions.md` | GitHub Copilot |
| `claude` | `CLAUDE.md` | Claude / Claude Code |
| `cursor` | `.cursorrules` | Cursor |
| `windsurf` | `.windsurfrules` | Windsurf |
| `openai` | `.github/openai-context.md` | OpenAI models |
| `gemini` | `.github/gemini-context.md` | Google Gemini |
| `codex` | `AGENTS.md` | OpenAI Codex · OpenCode |

```bash
sigmap --adapter copilot   # default
sigmap --adapter claude
sigmap --adapter cursor
```

**IDE extensions:**

| IDE | Install | Source | Features |
|-----|---------|--------|----------|
| **VS Code** | [Marketplace](https://marketplace.visualstudio.com/items?itemName=manojmallick.sigmap) · [Open VSX](https://open-vsx.org/extension/manojmallick/sigmap) | [github.com/manojmallick/sigmap-vscode](https://github.com/manojmallick/sigmap-vscode) | Status bar health grade, stale context alerts, one-click regen |
| **JetBrains** | [Marketplace](https://plugins.jetbrains.com/plugin/31109-sigmap--ai-context-engine/) | [github.com/manojmallick/sigmap-jetbrains](https://github.com/manojmallick/sigmap-jetbrains) | IntelliJ IDEA, WebStorm, PyCharm, GoLand — tool window + actions |
| **Neovim** | lazy.nvim / packer / vim-plug | [github.com/manojmallick/sigmap.nvim](https://github.com/manojmallick/sigmap.nvim) | `:SigMap`, `:SigMapQuery` float window, statusline widget |

**MCP server** — 9 on-demand tools for Claude Code and Cursor:

```bash
sigmap --mcp
```

---

## Try it

```bash
# 1. Generate context for your project
npx sigmap

# 2. Ask a question — get ranked files
sigmap ask "Where is auth handled?"

# 3. Validate — confirm the right files are in scope
sigmap validate --query "auth login token"

# 4. Judge — score your AI's answer for groundedness
sigmap judge --response response.txt --context .context/query-context.md

# 5. Inspect health
sigmap --health
```

---

## Start guide

| Who | Start here |
|---|---|
| 👶 **New** | [Quick start guide](docs/readmes/GETTING_STARTED.md) — setup in 60 seconds |
| ⚡ **Daily** | `sigmap ask` / `sigmap validate` / `sigmap judge` |
| 🧠 **Advanced** | [Context strategies](docs/readmes/CONTEXT_STRATEGIES.md) · [MCP setup](docs/readmes/MCP_SETUP.md) |
| 🏢 **Teams** | [Config reference](https://manojmallick.github.io/sigmap/guide/config.html) · [CI setup](docs/readmes/ENTERPRISE_SETUP.md) |

---

## Docs

**[manojmallick.github.io/sigmap](https://manojmallick.github.io/sigmap)**

| Section | Link |
|---|---|
| CLI reference (32 commands) | [cli.html](https://manojmallick.github.io/sigmap/guide/cli.html) |
| Benchmark methodology | [benchmark.html](https://manojmallick.github.io/sigmap/guide/benchmark.html) |
| Config reference | [config.html](https://manojmallick.github.io/sigmap/guide/config.html) |
| Roadmap | [roadmap.html](https://manojmallick.github.io/sigmap/guide/roadmap.html) |
| 29 languages | [generalization.html](https://manojmallick.github.io/sigmap/guide/generalization.html) |

---

## Support

If SigMap saves you context or API spend, a ⭐ on [GitHub](https://github.com/manojmallick/sigmap) helps others find it.

[Report an issue](https://github.com/manojmallick/sigmap/issues) · [Changelog](CHANGELOG.md)

---

## Why not embeddings?

| | Embeddings | SigMap |
|---|:---:|:---:|
| Vector DB required | ✅ | ❌ |
| Infrastructure to run | ✅ | ❌ |
| Drift over time | ✅ | ❌ |
| Deterministic results | ❌ | ✅ |
| Zero-config setup | ❌ | ✅ |
| Works offline | ❌ | ✅ |

- **No vector DB** — signatures are plain text files committed to your repo
- **No infra** — runs locally, zero cloud dependencies
- **No drift** — regenerating is `npx sigmap`, not a reindex pipeline
- **Deterministic** — same input always produces same ranked output
- **Faster** — TF-IDF ranking runs in milliseconds, no embeddings to compute

---

## 29 languages

TypeScript · JavaScript · Python · Java · Kotlin · Go · Rust · C# · C/C++ · Ruby · PHP · Swift · Dart · Scala · Vue · Svelte · HTML · CSS/SCSS · YAML · Shell · SQL · GraphQL · Terraform · Protobuf · Dockerfile · TOML · XML · Properties · Markdown

All implemented with zero external dependencies.

[Full language table →](https://manojmallick.github.io/sigmap/guide/generalization.html)

---

## License

MIT © 2026 [Manoj Mallick](https://github.com/manojmallick) · Made in Amsterdam

---

<div align="center">

**[Docs](https://manojmallick.github.io/sigmap) · [Changelog](CHANGELOG.md) · [Roadmap](https://manojmallick.github.io/sigmap/roadmap.html) · [npm](https://www.npmjs.com/package/sigmap)**

⭐ [Star on GitHub](https://github.com/manojmallick/sigmap) if SigMap saves you tokens.

</div>
