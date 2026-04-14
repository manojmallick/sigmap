# SigMap Strategy Audit

- Repo: `/Users/manojmallick/sigmap/benchmarks/repos/vapor`
- Output directory: `/Users/manojmallick/sigmap/benchmarks/reports/strategy-audit/vapor`
- Recommended strategy: `full`
- Why: full is the simplest reliable option when the repo is small or module splits do not materially reduce injected context.
- srcDirs (auto-detected): `Sources`, `Tests`, `.github`
- maxDepth (auto-detected): `7`

## Strategy comparison

| Strategy | Final tokens | Key shape | Extra metrics |
|---|---:|---|---|
| full | 7602 | single full file | n/a |
| per-module | 7602 | overview + module files | overview n/a, modules n/a |
| hot-cold | 7602 | hot primary + cold on-demand | hot n/a, cold n/a |

## Coverage summary

| Coverage signal | Count |
|---|---:|
| Discovered files | 331 |
| Files analyzed by SigMap | 300 |
| Supported files missing from analysis | 7 |
| Important unsupported files missing from analysis | 9 |
| Analyzed files with 0 signatures or 0 tokens | 118 |

## Suggested config

```json
{
  "output": ".github/copilot-instructions.md",
  "outputs": [
    "copilot"
  ],
  "srcDirs": [
    "Sources",
    "Tests",
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

- `.github` — 5 supported files are outside current coverage. Examples: .github/context-cold.md, .github/contributing.md, .github/copilot-instructions.md, .github/dependabot.yml, .github/maintainers.md

## Folders needing manual indexing or extractor support

- `.github` — 4 high-value files not analyzed. Extensions: .md (4). Examples: .github/context-cold.md, .github/contributing.md, .github/copilot-instructions.md, .github/dependabot.yml, .github/maintainers.md
- `Sources` — 3 high-value files not analyzed. Extensions: .md (3). Examples: Sources/Vapor/Docs.docc/index.md, Sources/VaporTesting/Docs.docc/index.md, Sources/XCTVapor/Docs.docc/index.md
- `.` — 1 high-value files not analyzed. Extensions: .md (1). Examples: .spi.yml, Package.swift, README.md
- `Tests` — 1 high-value files not analyzed. Extensions: .env (1). Examples: Tests/VaporTests/Utilities/test.env

## Folders where extractors are weak

- `Sources` — 111 analyzed files produced 0 signatures or 0 tokens out of 242 analyzed files.
- `Tests` — 7 analyzed files produced 0 signatures or 0 tokens out of 58 analyzed files.

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

