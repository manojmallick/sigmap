# SigMap Strategy Audit

- Repo: `/Users/manojmallick/sigmap/benchmarks/repos/flask`
- Output directory: `/Users/manojmallick/sigmap/benchmarks/reports/strategy-audit/flask`
- Recommended strategy: `full`
- Why: full is the simplest reliable option when the repo is small or module splits do not materially reduce injected context.
- srcDirs (auto-detected): `src`, `tests`, `examples`, `src/flask`, `docs`, `.github`, `.devcontainer`
- maxDepth (auto-detected): `7`

## Strategy comparison

| Strategy | Final tokens | Key shape | Extra metrics |
|---|---:|---|---|
| full | 6782 | single full file | n/a |
| per-module | 6782 | overview + module files | overview n/a, modules n/a |
| hot-cold | 6782 | hot primary + cold on-demand | hot n/a, cold n/a |

## Coverage summary

| Coverage signal | Count |
|---|---:|
| Discovered files | 239 |
| Files analyzed by SigMap | 105 |
| Supported files missing from analysis | 11 |
| Important unsupported files missing from analysis | 13 |
| Analyzed files with 0 signatures or 0 tokens | 33 |

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
    "examples",
    "src/flask",
    "docs",
    ".github",
    ".devcontainer"
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

- `.github` — 6 supported files are outside current coverage. Examples: .github/ISSUE_TEMPLATE/bug-report.md, .github/ISSUE_TEMPLATE/config.yml, .github/ISSUE_TEMPLATE/feature-request.md, .github/context-cold.md, .github/copilot-instructions.md
- `.devcontainer` — 1 supported files are outside current coverage. Examples: .devcontainer/on-create-command.sh

## Folders needing manual indexing or extractor support

- `.github` — 5 high-value files not analyzed. Extensions: .md (5). Examples: .github/ISSUE_TEMPLATE/bug-report.md, .github/ISSUE_TEMPLATE/config.yml, .github/ISSUE_TEMPLATE/feature-request.md, .github/context-cold.md, .github/copilot-instructions.md
- `examples` — 4 high-value files not analyzed. Extensions: .toml (3), .md (1). Examples: examples/celery/README.md, examples/celery/pyproject.toml, examples/javascript/pyproject.toml, examples/tutorial/flaskr/schema.sql, examples/tutorial/pyproject.toml
- `.` — 2 high-value files not analyzed. Extensions: .md (1), .toml (1). Examples: .pre-commit-config.yaml, .readthedocs.yaml, README.md, pyproject.toml
- `src` — 1 high-value files not analyzed. Extensions: .md (1). Examples: src/flask/sansio/README.md
- `tests` — 1 high-value files not analyzed. Extensions: .toml (1). Examples: tests/static/config.toml

## Folders where extractors are weak

- `tests` — 21 analyzed files produced 0 signatures or 0 tokens out of 51 analyzed files.
- `examples` — 7 analyzed files produced 0 signatures or 0 tokens out of 29 analyzed files.
- `src` — 5 analyzed files produced 0 signatures or 0 tokens out of 24 analyzed files.

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

