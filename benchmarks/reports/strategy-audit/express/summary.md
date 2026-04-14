# SigMap Strategy Audit

- Repo: `/Users/manojmallick/sigmap/benchmarks/repos/express`
- Output directory: `/Users/manojmallick/sigmap/benchmarks/reports/strategy-audit/express`
- Recommended strategy: `full`
- Why: full is the simplest reliable option when the repo is small or module splits do not materially reduce injected context.
- srcDirs (auto-detected): `lib`, `examples`, `test`, `.github`
- maxDepth (auto-detected): `5`

## Strategy comparison

| Strategy | Final tokens | Key shape | Extra metrics |
|---|---:|---|---|
| full | 884 | single full file | n/a |
| per-module | 884 | overview + module files | overview n/a, modules n/a |
| hot-cold | 884 | hot primary + cold on-demand | hot n/a, cold n/a |

## Coverage summary

| Coverage signal | Count |
|---|---:|
| Discovered files | 216 |
| Files analyzed by SigMap | 152 |
| Supported files missing from analysis | 7 |
| Important unsupported files missing from analysis | 6 |
| Analyzed files with 0 signatures or 0 tokens | 116 |

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
    "test",
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

- `.github` — 5 supported files are outside current coverage. Examples: .github/context-cold.md, .github/copilot-instructions.md, .github/dependabot.yml, .github/workflows/ci.yml, .github/workflows/codeql.yml

## Folders needing manual indexing or extractor support

- `.` — 2 high-value files not analyzed. Extensions: .md (2). Examples: .eslintrc.yml, History.md, Readme.md, index.js
- `.github` — 2 high-value files not analyzed. Extensions: .md (2). Examples: .github/context-cold.md, .github/copilot-instructions.md, .github/dependabot.yml, .github/workflows/ci.yml, .github/workflows/codeql.yml
- `examples` — 2 high-value files not analyzed. Extensions: .md (2). Examples: examples/README.md, examples/markdown/views/index.md

## Folders where extractors are weak

- `test` — 78 analyzed files produced 0 signatures or 0 tokens out of 95 analyzed files.
- `examples` — 38 analyzed files produced 0 signatures or 0 tokens out of 51 analyzed files.

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

