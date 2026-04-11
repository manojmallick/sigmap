---
title: Config reference
description: Complete SigMap configuration reference. All 21 keys in gen-context.config.json with types, defaults, and examples. srcDirs, maxTokens, strategy, outputs, secretScan and more.
head:
  - - meta
    - property: og:title
      content: "SigMap Configuration Reference — all 21 keys"
  - - meta
    - property: og:description
      content: "Every gen-context.config.json key documented with types, defaults, and examples."
  - - meta
    - property: og:url
      content: "https://manojmallick.github.io/sigmap/guide/config"
  - - meta
    - property: og:type
      content: article
  - - meta
    - name: twitter:title
      content: "SigMap Configuration Reference — all 21 keys"
  - - meta
    - name: twitter:description
      content: "Every gen-context.config.json key documented with types, defaults, and examples."
  - - meta
    - name: twitter:image:alt
      content: "SigMap Configuration Reference"
  - - meta
    - name: keywords
      content: "sigmap config, gen-context.config.json, sigmap configuration, srcDirs, maxTokens, strategy, outputs, secretScan, sigmap settings"
---
# Config reference

All configuration lives in `gen-context.config.json` at the project root. Generate a starter file with:

```bash
sigmap --init
```

## Full example

```json
{
  "srcDirs": ["src", "app", "lib"],
  "outputPath": ".github/copilot-instructions.md",
  "outputs": ["copilot", "claude"],
  "maxTokens": 6000,
  "strategy": "full",
  "hotCommits": 10,
  "diffPriority": true,
  "monorepo": false,
  "watchDebounce": 300,
  "secretScan": true,
  "enrichTodos": true,
  "enrichChanges": true,
  "enrichCoverage": false,
  "retrieval": {
    "topK": 10,
    "recencyBoost": 1.5,
    "preset": "balanced"
  }
}
```

## Output

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `outputPath` | `string` | `.github/copilot-instructions.md` | Path to write the primary context file. |
| `outputs` | `string[]` | `["copilot"]` | Which output files to write. Values: `"copilot"` (`.github/copilot-instructions.md`), `"claude"` (`CLAUDE.md`). |
| `maxTokens` | `number` | `6000` | Token budget. Files are dropped in priority order when the budget is exceeded. Raise to `8000`–`10000` for large codebases. |

## Source scanning

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `srcDirs` | `string[]` | `["src", "app", "lib"]` | Directories to scan for source files. Relative to the project root. |
| `monorepo` | `boolean` | `false` | When true, generates a separate context section per package under `packages/`, `apps/`, or `services/`. |

## Strategy

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `strategy` | `"full" \| "per-module" \| "hot-cold"` | `"full"` | Context output strategy. `full` = one file, all signatures. `per-module` = one file per source directory. `hot-cold` = recently changed files auto-injected; everything else in a cold file for MCP retrieval. See [Strategies](/guide/strategies). |
| `hotCommits` | `number` | `10` | Number of recent commits to include in the hot set when `strategy` is `"hot-cold"`. |
| `diffPriority` | `boolean` | `false` | When true, files changed in the current git diff are ranked highest in the output. |

## Features

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `secretScan` | `boolean` | `true` | Scan output for 10 credential patterns before writing. Matching content is replaced with `[REDACTED]`. Patterns: AWS keys, GitHub tokens, JWTs, database URLs, SSH keys, GCP keys, Stripe keys, Twilio keys, generic passwords/api_keys. |
| `monorepo` | `boolean` | `false` | See Source scanning above. |

## Watch

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `watchDebounce` | `number` | `300` | Debounce delay in milliseconds for file watcher events. Increase if you see multiple regenerations for a single save. |

## Enrichment

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `enrichTodos` | `boolean` | `true` | Append a TODO/FIXME/HACK section extracted from inline comments. |
| `enrichChanges` | `boolean` | `true` | Append a recent git log summary showing files changed in the last 10 commits. |
| `enrichCoverage` | `boolean` | `false` | Append a coverage gaps section listing source files that have no corresponding test file. |
| `retrieval.topK` | `number` | `10` | Number of top-ranked files returned by `--query` and the `query_context` MCP tool. |
| `retrieval.recencyBoost` | `number` | `1.5` | Multiplier applied to recently committed files during TF-IDF ranking. |
| `retrieval.preset` | `"precision" \| "balanced" \| "recall"` | `"balanced"` | Weight preset for the ranking algorithm. `precision` minimises false positives. `recall` maximises coverage. |

## .contextignore

Use a `.contextignore` file (gitignore syntax) to exclude files and directories from the index. Run `sigmap --init` to generate a starter file.

```bash
# test files
**/*.test.*
**/*.spec.*
*_test.*

# build output
dist/
build/
src/generated/
coverage/
node_modules/

# generated files
*.pb.*
*.generated.*
```

The `.contextignore` file uses the same gitignore syntax as `.repomixignore`. Symlink them to share a single exclusion list:

```bash
ln -s .contextignore .repomixignore
```


---

<div style="text-align:center;margin-top:2.5rem;padding-bottom:.5rem;font-size:0.85em;color:var(--vp-c-text-3)">
  Made in Amsterdam, Netherlands <span title="Netherlands">🇳🇱</span>
</div>