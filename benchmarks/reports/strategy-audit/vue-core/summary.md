# SigMap Strategy Audit

- Repo: `/Users/manojmallick/sigmap/benchmarks/repos/vue-core`
- Output directory: `/Users/manojmallick/sigmap/benchmarks/reports/strategy-audit/vue-core`
- Recommended strategy: `full`
- Why: full is the simplest reliable option when the repo is small or module splits do not materially reduce injected context.
- srcDirs (auto-detected): `packages`, `packages-private`, `scripts`, `.github`
- maxDepth (auto-detected): `7`

## Strategy comparison

| Strategy | Final tokens | Key shape | Extra metrics |
|---|---:|---|---|
| full | 8371 | single full file | n/a |
| per-module | 8371 | overview + module files | overview n/a, modules n/a |
| hot-cold | 8371 | hot primary + cold on-demand | hot n/a, cold n/a |

## Coverage summary

| Coverage signal | Count |
|---|---:|
| Discovered files | 706 |
| Files analyzed by SigMap | 556 |
| Supported files missing from analysis | 19 |
| Important unsupported files missing from analysis | 34 |
| Analyzed files with 0 signatures or 0 tokens | 307 |

## Suggested config

```json
{
  "output": ".github/copilot-instructions.md",
  "outputs": [
    "copilot"
  ],
  "srcDirs": [
    "packages",
    "packages-private",
    "scripts",
    ".github"
  ],
  "exclude": [
    "node_modules",
    ".git",
    "dist",
    "build",
    "out",
    "__pycache__",
    ".next",
    "coverage",
    "target",
    "vendor",
    ".context"
  ],
  "maxDepth": 7,
  "maxSigsPerFile": 25,
  "maxTokens": 6000,
  "secretScan": true,
  "monorepo": false,
  "diffPriority": true,
  "mcp": {
    "autoRegister": true
  },
  "strategy": "full",
  "hotCommits": 10,
  "depMap": true,
  "todos": true,
  "changes": true,
  "changesCommits": 5,
  "testCoverage": false,
  "testDirs": [
    "tests",
    "src/test",
    "test",
    "__tests__",
    "spec"
  ],
  "impactRadius": false
}
```

## Recommended srcDirs additions

- `.github` — 12 supported files are outside current coverage. Examples: .github/FUNDING.yml, .github/ISSUE_TEMPLATE/bug_report.yml, .github/ISSUE_TEMPLATE/config.yml, .github/bug-repro-guidelines.md, .github/commit-convention.md

## Folders needing manual indexing or extractor support

- `.github` — 6 high-value files not analyzed. Extensions: .md (6). Examples: .github/FUNDING.yml, .github/ISSUE_TEMPLATE/bug_report.yml, .github/ISSUE_TEMPLATE/config.yml, .github/bug-repro-guidelines.md, .github/commit-convention.md
- `packages-private` — 6 high-value files not analyzed. Extensions: .md (6). Examples: packages-private/dts-built-test/README.md, packages-private/dts-test/README.md, packages-private/sfc-playground/README.md, packages-private/sfc-playground/src/download/template/README.md, packages-private/template-explorer/README.md
- `.` — 5 high-value files not analyzed. Extensions: .md (4), .toml (1). Examples: BACKERS.md, CHANGELOG.md, README.md, SECURITY.md, eslint.config.js
- `changelogs` — 5 high-value files not analyzed. Extensions: .md (5). Examples: changelogs/CHANGELOG-3.0.md, changelogs/CHANGELOG-3.1.md, changelogs/CHANGELOG-3.2.md, changelogs/CHANGELOG-3.3.md, changelogs/CHANGELOG-3.4.md
- `packages/compiler-core` — 1 high-value files not analyzed. Extensions: .md (1). Examples: packages/compiler-core/README.md
- `packages/compiler-dom` — 1 high-value files not analyzed. Extensions: .md (1). Examples: packages/compiler-dom/README.md
- `packages/compiler-sfc` — 1 high-value files not analyzed. Extensions: .md (1). Examples: packages/compiler-sfc/README.md
- `packages/compiler-ssr` — 1 high-value files not analyzed. Extensions: .md (1). Examples: packages/compiler-ssr/README.md

## Folders where extractors are weak

- `packages/runtime-core` — 48 analyzed files produced 0 signatures or 0 tokens out of 48 analyzed files.
- `packages-private` — 41 analyzed files produced 0 signatures or 0 tokens out of 53 analyzed files.
- `packages/vue` — 32 analyzed files produced 0 signatures or 0 tokens out of 56 analyzed files.
- `packages/reactivity` — 23 analyzed files produced 0 signatures or 0 tokens out of 23 analyzed files.
- `packages/compiler-core` — 20 analyzed files produced 0 signatures or 0 tokens out of 22 analyzed files.
- `packages/compiler-sfc` — 19 analyzed files produced 0 signatures or 0 tokens out of 21 analyzed files.
- `packages/server-renderer` — 19 analyzed files produced 0 signatures or 0 tokens out of 19 analyzed files.
- `packages/runtime-dom` — 17 analyzed files produced 0 signatures or 0 tokens out of 17 analyzed files.

## Strategy artifacts

### full

- Report: `strategies/full/report.json`
- Analyze: `strategies/full/analyze.json`
- Stdout log: `strategies/full/stdout.log`
- Generated outputs: `strategies/full/outputs/`

### per-module

- Report: `strategies/per-module/report.json`
- Analyze: `strategies/per-module/analyze.json`
- Stdout log: `strategies/per-module/stdout.log`
- Generated outputs: `strategies/per-module/outputs/`

### hot-cold

- Report: `strategies/hot-cold/report.json`
- Analyze: `strategies/hot-cold/analyze.json`
- Stdout log: `strategies/hot-cold/stdout.log`
- Generated outputs: `strategies/hot-cold/outputs/`

