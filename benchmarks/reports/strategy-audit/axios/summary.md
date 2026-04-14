# SigMap Strategy Audit

- Repo: `/Users/manojmallick/sigmap/benchmarks/repos/axios`
- Output directory: `/Users/manojmallick/sigmap/benchmarks/reports/strategy-audit/axios`
- Recommended strategy: `full`
- Why: full is the simplest reliable option when the repo is small or module splits do not materially reduce injected context.
- srcDirs (auto-detected): `lib`, `examples`, `sandbox`, `scripts`, `test`, `tests`, `.github`, `docs`
- maxDepth (auto-detected): `7`

## Strategy comparison

| Strategy | Final tokens | Key shape | Extra metrics |
|---|---:|---|---|
| full | 3691 | single full file | n/a |
| per-module | 3691 | overview + module files | overview n/a, modules n/a |
| hot-cold | 3691 | hot primary + cold on-demand | hot n/a, cold n/a |

## Coverage summary

| Coverage signal | Count |
|---|---:|
| Discovered files | 332 |
| Files analyzed by SigMap | 209 |
| Supported files missing from analysis | 23 |
| Important unsupported files missing from analysis | 54 |
| Analyzed files with 0 signatures or 0 tokens | 153 |

## Suggested config

```json
{
  "output": ".github/copilot-instructions.md",
  "outputs": [
    "copilot"
  ],
  "srcDirs": [
    "lib",
    "examples",
    "sandbox",
    "scripts",
    "test",
    "tests",
    ".github",
    "docs"
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

- `.github` — 8 supported files are outside current coverage. Examples: .github/FUNDING.yml, .github/ISSUE_TEMPLATE.md, .github/PULL_REQUEST_TEMPLATE.md, .github/context-cold.md, .github/copilot-instructions.md
- `docs` — 4 supported files are outside current coverage. Examples: docs/.vitepress/theme/index.ts, docs/.vitepress/theme/style.css, docs/index.md, docs/pages/advanced/adapters.md, docs/pages/advanced/api-reference.md

## Folders needing manual indexing or extractor support

- `docs` — 34 high-value files not analyzed. Extensions: .md (34). Examples: docs/.vitepress/theme/index.ts, docs/.vitepress/theme/style.css, docs/index.md, docs/pages/advanced/adapters.md, docs/pages/advanced/api-reference.md
- `.` — 9 high-value files not analyzed. Extensions: .md (9). Examples: CHANGELOG.md, CODE_OF_CONDUCT.md, COLLABORATOR_GUIDE.md, CONTRIBUTING.md, CONTRIBUTORS.md
- `.github` — 4 high-value files not analyzed. Extensions: .md (4). Examples: .github/FUNDING.yml, .github/ISSUE_TEMPLATE.md, .github/PULL_REQUEST_TEMPLATE.md, .github/context-cold.md, .github/copilot-instructions.md
- `lib` — 4 high-value files not analyzed. Extensions: .md (4). Examples: lib/adapters/README.md, lib/core/README.md, lib/core/buildFullPath.js, lib/env/README.md, lib/helpers/README.md
- `examples` — 2 high-value files not analyzed. Extensions: .md (2). Examples: examples/README.md, examples/improved-network-errors.md
- `tests` — 1 high-value files not analyzed. Extensions: .md (1). Examples: tests/README.md, tests/unit/core/buildFullPath.test.js, tests/unit/helpers/buildURL.test.js

## Folders where extractors are weak

- `tests` — 108 analyzed files produced 0 signatures or 0 tokens out of 127 analyzed files.
- `lib` — 37 analyzed files produced 0 signatures or 0 tokens out of 61 analyzed files.
- `examples` — 5 analyzed files produced 0 signatures or 0 tokens out of 15 analyzed files.
- `scripts` — 2 analyzed files produced 0 signatures or 0 tokens out of 2 analyzed files.

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

