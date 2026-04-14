# SigMap Strategy Audit

- Repo: `/Users/manojmallick/sigmap/benchmarks/repos/gin`
- Output directory: `/Users/manojmallick/sigmap/benchmarks/reports/strategy-audit/gin`
- Recommended strategy: `full`
- Why: full is the simplest reliable option when the repo is small or module splits do not materially reduce injected context.
- srcDirs (auto-detected): `internal`, `binding`, `examples`, `ginS`, `render`, `.github`, `codec`, `testdata`
- maxDepth (auto-detected): `5`

## Strategy comparison

| Strategy | Final tokens | Key shape | Extra metrics |
|---|---:|---|---|
| full | 4381 | single full file | n/a |
| per-module | 4381 | overview + module files | overview n/a, modules n/a |
| hot-cold | 4381 | hot primary + cold on-demand | hot n/a, cold n/a |

## Coverage summary

| Coverage signal | Count |
|---|---:|
| Discovered files | 133 |
| Files analyzed by SigMap | 53 |
| Supported files missing from analysis | 58 |
| Important unsupported files missing from analysis | 11 |
| Analyzed files with 0 signatures or 0 tokens | 1 |

## Suggested config

```json
{
  "output": ".github/copilot-instructions.md",
  "outputs": [
    "copilot"
  ],
  "srcDirs": [
    "internal",
    "binding",
    "examples",
    "ginS",
    "render",
    ".github",
    "codec",
    "testdata"
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
  "maxDepth": 5,
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

- `.github` — 8 supported files are outside current coverage. Examples: .github/ISSUE_TEMPLATE/bug-report.yaml, .github/ISSUE_TEMPLATE/config.yml, .github/ISSUE_TEMPLATE/feature-request.yaml, .github/PULL_REQUEST_TEMPLATE.md, .github/context-cold.md
- `codec` — 5 supported files are outside current coverage. Examples: codec/json/api.go, codec/json/go_json.go, codec/json/json.go, codec/json/jsoniter.go, codec/json/sonic.go
- `testdata` — 2 supported files are outside current coverage. Examples: testdata/protoexample/test.pb.go, testdata/protoexample/test.proto

## Folders needing manual indexing or extractor support

- `.` — 5 high-value files not analyzed. Extensions: .md (5). Examples: .golangci.yml, .goreleaser.yaml, BENCHMARKS.md, CHANGELOG.md, CODE_OF_CONDUCT.md
- `.github` — 3 high-value files not analyzed. Extensions: .md (3). Examples: .github/ISSUE_TEMPLATE/bug-report.yaml, .github/ISSUE_TEMPLATE/config.yml, .github/ISSUE_TEMPLATE/feature-request.yaml, .github/PULL_REQUEST_TEMPLATE.md, .github/context-cold.md
- `docs` — 1 high-value files not analyzed. Extensions: .md (1). Examples: docs/doc.md
- `examples` — 1 high-value files not analyzed. Extensions: .md (1). Examples: examples/README.md
- `ginS` — 1 high-value files not analyzed. Extensions: .md (1). Examples: ginS/README.md

## Folders where extractors are weak

No obvious weak-extractor folders were detected.

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

