# SigMap Strategy Audit

- Repo: `/Users/manojmallick/sigmap/benchmarks/repos/serilog`
- Output directory: `/Users/manojmallick/sigmap/benchmarks/reports/strategy-audit/serilog`
- Recommended strategy: `full`
- Why: full is the simplest reliable option when the repo is small or module splits do not materially reduce injected context.
- srcDirs (auto-detected): `src`, `test`, `.github`
- maxDepth (auto-detected): `7`

## Strategy comparison

| Strategy | Final tokens | Key shape | Extra metrics |
|---|---:|---|---|
| full | 6945 | single full file | n/a |
| per-module | 6945 | overview + module files | overview n/a, modules n/a |
| hot-cold | 6945 | hot primary + cold on-demand | hot n/a, cold n/a |

## Coverage summary

| Coverage signal | Count |
|---|---:|
| Discovered files | 285 |
| Files analyzed by SigMap | 214 |
| Supported files missing from analysis | 2 |
| Important unsupported files missing from analysis | 41 |
| Analyzed files with 0 signatures or 0 tokens | 20 |

## Suggested config

```json
{
  "output": ".github/copilot-instructions.md",
  "outputs": [
    "copilot"
  ],
  "srcDirs": [
    "src",
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

- `.github` — 2 supported files are outside current coverage. Examples: .github/ISSUE_TEMPLATE/bug_report.md, .github/ISSUE_TEMPLATE/config.yml, .github/ISSUE_TEMPLATE/feature_request.md, .github/context-cold.md, .github/copilot-instructions.md

## Folders needing manual indexing or extractor support

- `results` — 30 high-value files not analyzed. Extensions: .md (30). Examples: results/net4.5.2/LevelControlBenchmark-report-github.md, results/net4.5.2/LogContextEnrichmentBenchmark-report-github.md, results/net4.5.2/MessageTemplateCache/MessageTemplateCacheBenchmark_Cached-report-github.md, results/net4.5.2/MessageTemplateCache/MessageTemplateCacheBenchmark_Leaking-report-github.md, results/net4.5.2/MessageTemplateParsingBenchmark-report-github.md
- `.` — 5 high-value files not analyzed. Extensions: .md (5). Examples: CODE_OF_CONDUCT.md, CONTRIBUTING.md, INFLUENCES.md, README.md, SECURITY.md
- `.github` — 4 high-value files not analyzed. Extensions: .md (4). Examples: .github/ISSUE_TEMPLATE/bug_report.md, .github/ISSUE_TEMPLATE/config.yml, .github/ISSUE_TEMPLATE/feature_request.md, .github/context-cold.md, .github/copilot-instructions.md
- `src` — 1 high-value files not analyzed. Extensions: .xml (1). Examples: src/Serilog/ILLink.Substitutions.xml
- `test` — 1 high-value files not analyzed. Extensions: .md (1). Examples: test/AotTestApp/README.md

## Folders where extractors are weak

- `src` — 13 analyzed files produced 0 signatures or 0 tokens out of 112 analyzed files.
- `test` — 7 analyzed files produced 0 signatures or 0 tokens out of 102 analyzed files.

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

