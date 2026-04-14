# SigMap Strategy Audit

- Repo: `/Users/manojmallick/sigmap/benchmarks/repos/laravel`
- Output directory: `/Users/manojmallick/sigmap/benchmarks/reports/strategy-audit/laravel`
- Recommended strategy: `full`
- Why: full is the simplest reliable option when the repo is small or module splits do not materially reduce injected context.
- srcDirs (auto-detected): `src`, `tests`, `bin`, `config`, `config-stubs`, `types`, `.github`
- maxDepth (auto-detected): `7`

## Strategy comparison

| Strategy | Final tokens | Key shape | Extra metrics |
|---|---:|---|---|
| full | 6880 | single full file | n/a |
| per-module | 6880 | overview + module files | overview n/a, modules n/a |
| hot-cold | 6880 | hot primary + cold on-demand | hot n/a, cold n/a |

## Coverage summary

| Coverage signal | Count |
|---|---:|
| Discovered files | 3182 |
| Files analyzed by SigMap | 2870 |
| Supported files missing from analysis | 65 |
| Important unsupported files missing from analysis | 49 |
| Analyzed files with 0 signatures or 0 tokens | 288 |

## Suggested config

```json
{
  "output": ".github/copilot-instructions.md",
  "outputs": [
    "copilot"
  ],
  "srcDirs": [
    "src",
    "tests",
    "bin",
    "config",
    "config-stubs",
    "types",
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

- `.github` — 13 supported files are outside current coverage. Examples: .github/CODE_OF_CONDUCT.md, .github/CONTRIBUTING.md, .github/ISSUE_TEMPLATE/Bug_report.yml, .github/ISSUE_TEMPLATE/config.yml, .github/PULL_REQUEST_TEMPLATE.md

## Folders needing manual indexing or extractor support

- `src` — 38 high-value files not analyzed. Extensions: .md (38). Examples: src/Illuminate/Auth/.github/workflows/close-pull-request.yml, src/Illuminate/Auth/LICENSE.md, src/Illuminate/Broadcasting/.github/workflows/close-pull-request.yml, src/Illuminate/Broadcasting/LICENSE.md, src/Illuminate/Bus/.github/workflows/close-pull-request.yml
- `.github` — 7 high-value files not analyzed. Extensions: .md (7). Examples: .github/CODE_OF_CONDUCT.md, .github/CONTRIBUTING.md, .github/ISSUE_TEMPLATE/Bug_report.yml, .github/ISSUE_TEMPLATE/config.yml, .github/PULL_REQUEST_TEMPLATE.md
- `.` — 4 high-value files not analyzed. Extensions: .md (4). Examples: .styleci.yml, CHANGELOG.md, LICENSE.md, README.md, RELEASE.md

## Folders where extractors are weak

- `tests` — 129 analyzed files produced 0 signatures or 0 tokens out of 1199 analyzed files.
- `src` — 107 analyzed files produced 0 signatures or 0 tokens out of 1605 analyzed files.
- `types` — 35 analyzed files produced 0 signatures or 0 tokens out of 47 analyzed files.
- `config` — 15 analyzed files produced 0 signatures or 0 tokens out of 15 analyzed files.

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

