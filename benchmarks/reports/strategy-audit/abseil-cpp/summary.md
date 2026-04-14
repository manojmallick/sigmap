# SigMap Strategy Audit

- Repo: `/Users/manojmallick/sigmap/benchmarks/repos/abseil-cpp`
- Output directory: `/Users/manojmallick/sigmap/benchmarks/reports/strategy-audit/abseil-cpp`
- Recommended strategy: `full`
- Why: full is the simplest reliable option when the repo is small or module splits do not materially reduce injected context.
- srcDirs (auto-detected): `absl`, `ci`, `.github`, `CMake`
- maxDepth (auto-detected): `7`

## Strategy comparison

| Strategy | Final tokens | Key shape | Extra metrics |
|---|---:|---|---|
| full | 6201 | single full file | n/a |
| per-module | 6201 | overview + module files | overview n/a, modules n/a |
| hot-cold | 6201 | hot primary + cold on-demand | hot n/a, cold n/a |

## Coverage summary

| Coverage signal | Count |
|---|---:|
| Discovered files | 1590 |
| Files analyzed by SigMap | 869 |
| Supported files missing from analysis | 15 |
| Important unsupported files missing from analysis | 9 |
| Analyzed files with 0 signatures or 0 tokens | 163 |

## Suggested config

```json
{
  "output": ".github/copilot-instructions.md",
  "outputs": [
    "copilot"
  ],
  "srcDirs": [
    "absl",
    "ci",
    ".github",
    "CMake"
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

- `.github` — 2 supported files are outside current coverage. Examples: .github/ISSUE_TEMPLATE/00-bug_report.yml, .github/ISSUE_TEMPLATE/config.yml, .github/PULL_REQUEST_TEMPLATE.md, .github/context-cold.md, .github/copilot-instructions.md
- `CMake` — 2 supported files are outside current coverage. Examples: CMake/README.md, CMake/install_test_project/simple.cc, CMake/install_test_project/test.sh

## Folders needing manual indexing or extractor support

- `.` — 5 high-value files not analyzed. Extensions: .md (5). Examples: ABSEIL_ISSUE_TEMPLATE.md, CONTRIBUTING.md, FAQ.md, README.md, UPGRADES.md
- `.github` — 3 high-value files not analyzed. Extensions: .md (3). Examples: .github/ISSUE_TEMPLATE/00-bug_report.yml, .github/ISSUE_TEMPLATE/config.yml, .github/PULL_REQUEST_TEMPLATE.md, .github/context-cold.md, .github/copilot-instructions.md
- `CMake` — 1 high-value files not analyzed. Extensions: .md (1). Examples: CMake/README.md, CMake/install_test_project/simple.cc, CMake/install_test_project/test.sh

## Folders where extractors are weak

- `absl` — 162 analyzed files produced 0 signatures or 0 tokens out of 854 analyzed files.

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

