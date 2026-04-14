# SigMap Strategy Audit

- Repo: `/Users/manojmallick/sigmap/benchmarks/repos/fastapi`
- Output directory: `/Users/manojmallick/sigmap/benchmarks/reports/strategy-audit/fastapi`
- Recommended strategy: `full`
- Why: full is the simplest reliable option when the repo is small or module splits do not materially reduce injected context.

## Strategy comparison

| Strategy | Final tokens | Key shape | Extra metrics |
|---|---:|---|---|
| full | 5233 | single full file | n/a |
| per-module | 5233 | overview + module files | overview n/a, modules n/a |
| hot-cold | 5233 | hot primary + cold on-demand | hot n/a, cold n/a |

## Coverage summary

| Coverage signal | Count |
|---|---:|
| Discovered files | 2988 |
| Files analyzed by SigMap | 52 |
| Supported files missing from analysis | 2694 |
| Important unsupported files missing from analysis | 0 |
| Analyzed files with 0 signatures or 0 tokens | 20 |

## Suggested config

```json
{
  "output": ".github/copilot-instructions.md",
  "outputs": [
    "copilot"
  ],
  "srcDirs": [
    "fastapi",
    "docs",
    "tests",
    "docs_src",
    "scripts",
    ".github",
    "fastapi-slim"
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

- `docs` — 1550 supported files are outside current coverage. Examples: docs/de/docs/_llm-test.md, docs/de/docs/about/index.md, docs/de/docs/advanced/additional-responses.md, docs/de/docs/advanced/additional-status-codes.md, docs/de/docs/advanced/advanced-dependencies.md
- `tests` — 582 supported files are outside current coverage. Examples: tests/__init__.py, tests/benchmarks/__init__.py, tests/benchmarks/test_general_performance.py, tests/forward_reference_type.py, tests/main.py
- `docs_src` — 458 supported files are outside current coverage. Examples: docs_src/additional_responses/__init__.py, docs_src/additional_responses/tutorial001_py310.py, docs_src/additional_responses/tutorial002_py310.py, docs_src/additional_responses/tutorial003_py310.py, docs_src/additional_responses/tutorial004_py310.py
- `scripts` — 70 supported files are outside current coverage. Examples: scripts/add_latest_release_date.py, scripts/contributors.py, scripts/coverage.sh, scripts/deploy_docs_status.py, scripts/doc_parsing_utils.py
- `.github` — 28 supported files are outside current coverage. Examples: .github/DISCUSSION_TEMPLATE/questions.yml, .github/DISCUSSION_TEMPLATE/translations.yml, .github/FUNDING.yml, .github/ISSUE_TEMPLATE/config.yml, .github/ISSUE_TEMPLATE/privileged.yml
- `fastapi-slim` — 1 supported files are outside current coverage. Examples: fastapi-slim/README.md

## Folders needing manual indexing or extractor support

No high-value unsupported folders were detected.

## Folders where extractors are weak

- `fastapi` — 20 analyzed files produced 0 signatures or 0 tokens out of 52 analyzed files.

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

