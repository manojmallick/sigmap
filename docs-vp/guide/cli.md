---
title: CLI reference
description: Complete SigMap CLI reference. All flags with examples — --watch, --setup, --diff, --mcp, --report, --health, --suggest-tool, --monorepo, --format, --track, --init.
head:
  - - meta
    - property: og:title
      content: "SigMap CLI Reference — every flag with examples"
  - - meta
    - property: og:description
      content: "All 22 SigMap CLI flags documented with examples. --watch, --setup, --diff, --mcp, --report, --health and more."
  - - meta
    - property: og:url
      content: "https://manojmallick.github.io/sigmap/guide/cli"
  - - meta
    - property: og:type
      content: article
  - - meta
    - name: twitter:title
      content: "SigMap CLI Reference — every flag with examples"
  - - meta
    - name: twitter:description
      content: "All 22 SigMap CLI flags documented with examples. --watch, --setup, --diff, --mcp, --report, --health and more."
  - - meta
    - name: twitter:image:alt
      content: "SigMap CLI Reference"
  - - meta
    - name: keywords
      content: "sigmap cli, sigmap flags, sigmap --watch, sigmap --mcp, sigmap --diff, sigmap --report, sigmap --init, command line reference"
---
# CLI reference

All flags accepted by `sigmap` (or `node gen-context.js`).

## Quick reference

| Flag | Description |
|------|-------------|
| `--watch` | Watch for file changes and regenerate incrementally |
| `--setup` | Auto-configure MCP servers, install git hook, start watcher |
| `--diff` | Generate context only for changed files |
| `--diff --staged` | Generate context only for staged files |
| `--mcp` | Start the stdio MCP server |
| `--query <text>` | Rank files by relevance to a free-text query (TF-IDF) |
| `--analyze` | Per-file breakdown of signatures, tokens, and extractor |
| `--report` | Token reduction summary |
| `--report --json` | Machine-readable JSON report |
| `--report --paper` | LaTeX/markdown tables for academic export |
| `--health` | Composite 0–100 health score |
| `--health --json` | Machine-readable health output |
| `--suggest-tool <task>` | Classify a task into fast / balanced / powerful model tier |
| `--monorepo` | Generate a separate context section per package |
| `--each` | Run a command in each monorepo package |
| `--routing` | Print the model routing table |
| `--format cache` | Wrap output in Anthropic cache_control breakpoints |
| `--track` | Log each run to `.sigmap/runs.jsonl` |
| `--init` | Scaffold `gen-context.config.json` and `.contextignore` |
| `--benchmark` | Run retrieval evaluation tasks |
| `--impact <file>` | Trace every file that transitively imports the given file |
| `--version` | Print version and exit |
| `--help` | Print help and exit |

---

## --watch

Start the file watcher. Every file save triggers an incremental regeneration. Press `Ctrl+C` to stop.

```bash
sigmap --watch
```

```
[sigmap] watching src/ app/ lib/ ...
[sigmap] ✓ regenerated in 43ms  (src/api/users.ts changed)
```

---

## --setup

One-command setup. Detects `.claude/settings.json` and `.cursor/mcp.json` automatically, adds the sigmap MCP server entry, installs a git post-commit hook, and starts the file watcher.

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

---

## --diff

Generate context only for files changed in the current git working tree. Ideal for PR reviews and CI jobs.

```bash
sigmap --diff
```

`--diff --staged` restricts to staged files only, making it a perfect pre-commit check:

```bash
sigmap --diff --staged
```

Both modes automatically fall back to a full generate when run outside a git repository or when no files have changed.

---

## --mcp

Start the stdio MCP server implementing the Model Context Protocol. Used by Claude Code, Cursor, and Windsurf. Do not call this directly — wire it via the IDE config (see [MCP setup](/guide/mcp)).

```bash
node gen-context.js --mcp
```

---

## --query

Rank all files by relevance to a free-text query using zero-dependency TF-IDF scoring.

```bash
sigmap --query "authentication flow"
```

```
[sigmap] query: "authentication flow"

  score  file
  0.94   src/auth/service.ts
  0.87   src/auth/middleware.ts
  0.72   src/api/users.ts
  0.61   src/guards/jwt.guard.ts
```

Machine-readable output:

```bash
sigmap --query "authentication flow" --json
```

---

## --analyze

Per-file breakdown showing signatures extracted, token count, extractor language, and test coverage status.

```bash
sigmap --analyze
```

Add `--slow` to re-time each extractor and flag files taking over 50ms:

```bash
sigmap --analyze --slow
```

`--diagnose-extractors` self-tests all 21 extractors against their fixture files and reports any mismatch:

```bash
sigmap --diagnose-extractors
```

---

## --report

Print a token reduction summary.

```bash
sigmap --report
```

Machine-readable JSON (suitable for CI dashboards):

```bash
sigmap --report --json
```

Paper-ready LaTeX/Markdown tables:

```bash
sigmap --report --paper
```

---

## --health

Run the composite health check. Returns a score from 0–100 plus a letter grade.

```bash
sigmap --health
```

```
[sigmap] score: 94  grade: A
[sigmap] context: .github/copilot-instructions.md
[sigmap] last generated: 2m ago
[sigmap] token reduction: 95.3%
```

Machine-readable:

```bash
sigmap --health --json
```

```json
{
  "score": 94,
  "grade": "A",
  "version": "2.4.0",
  "node": "22.11.0",
  "contextFile": true,
  "lastGenerated": "2m ago",
  "tokenReduction": "95.3%"
}
```

---

## --suggest-tool

Classify a task description into the appropriate model tier: `fast`, `balanced`, or `powerful`.

```bash
sigmap --suggest-tool "Fix the null pointer in UserService.findById"
```

```
[sigmap] task: "Fix the null pointer in UserService.findById"
[sigmap] → balanced  (business logic, 1× cost)
```

---

## --monorepo

Generate a separate context section per package in a monorepo. Supports `packages/`, `apps/`, and `services/` directory layouts.

```bash
sigmap --monorepo
```

Can also be set permanently in config with `"monorepo": true`.

---

## --each

Run a command inside each monorepo package, similar to `lerna run` or `pnpm -r`.

```bash
sigmap --each "node gen-context.js --diff"
```

---

## --routing

Print the model routing table — a per-file classification of `fast`, `balanced`, or `powerful` based on complexity scoring.

```bash
sigmap --routing
```

---

## --format cache

Wrap the output in Anthropic `cache_control` breakpoints so the stable signatures become a cached prefix.

```bash
sigmap --format cache
```

See [Repomix integration](/guide/repomix) for an example of using this with the two-layer strategy.

---

## --track

Log each run to `.sigmap/runs.jsonl` for monitoring and audit.

```bash
sigmap --track
```

---

## --init

Scaffold a starter `gen-context.config.json` and `.contextignore` in the current directory.

```bash
sigmap --init
```

---

## --benchmark

Run retrieval evaluation tasks from a JSONL task file. Outputs hit@5, MRR, and precision@5.

```bash
sigmap --benchmark
sigmap --benchmark --repo /path/to/external/repo
```

---

## --impact

Trace every file that transitively imports the given file. Shows blast-radius awareness for change impact.

```bash
sigmap --impact src/auth/service.ts
sigmap --impact src/auth/service.ts --json
```

---

## --version

```bash
sigmap --version
# sigmap v3.3.1
```

---

## --help

```bash
sigmap --help
```
