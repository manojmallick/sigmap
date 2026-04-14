# SigMap Strategy Audit

- Repo: `/Users/manojmallick/sigmap/benchmarks/repos/riverpod`
- Output directory: `/Users/manojmallick/sigmap/benchmarks/reports/strategy-audit/riverpod`
- Recommended strategy: `full`
- Why: full is the simplest reliable option when the repo is small or module splits do not materially reduce injected context.
- srcDirs (auto-detected): `packages`, `benchmarks`, `examples`, `scripts`, `website`, `packages/riverpod_generator`, `.github`, `tools`, `packages/riverpod`, `packages/lint_visitor_generator`, `packages/riverpod_lint_flutter_test`, `packages/flutter_riverpod/lib`, `packages/lint_visitor_generator/lib`
- maxDepth (auto-detected): `9`

## Strategy comparison

| Strategy | Final tokens | Key shape | Extra metrics |
|---|---:|---|---|
| full | 10530 | single full file | n/a |
| per-module | 10530 | overview + module files | overview n/a, modules n/a |
| hot-cold | 10530 | hot primary + cold on-demand | hot n/a, cold n/a |

## Coverage summary

| Coverage signal | Count |
|---|---:|
| Discovered files | 1962 |
| Files analyzed by SigMap | 1399 |
| Supported files missing from analysis | 43 |
| Important unsupported files missing from analysis | 51 |
| Analyzed files with 0 signatures or 0 tokens | 409 |

## Suggested config

```json
{
  "output": ".github/copilot-instructions.md",
  "outputs": [
    "copilot"
  ],
  "srcDirs": [
    "packages",
    "benchmarks",
    "examples",
    "scripts",
    "website",
    "packages/riverpod_generator",
    ".github",
    "tools",
    "packages/riverpod",
    "packages/lint_visitor_generator",
    "packages/riverpod_lint_flutter_test",
    "packages/flutter_riverpod/lib",
    "packages/lint_visitor_generator/lib"
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
  "maxDepth": 9,
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

- `packages/riverpod_generator` — 9 supported files are outside current coverage. Examples: packages/riverpod_generator/CHANGELOG.md, packages/riverpod_generator/README.md, packages/riverpod_generator/build.yaml, packages/riverpod_generator/integration/build_yaml/README.md, packages/riverpod_generator/integration/build_yaml/analysis_options.yaml
- `.github` — 7 supported files are outside current coverage. Examples: .github/FUNDING.yml, .github/ISSUE_TEMPLATE/bug_report.md, .github/ISSUE_TEMPLATE/config.yml, .github/ISSUE_TEMPLATE/example_request.md, .github/ISSUE_TEMPLATE/feature_request.md
- `tools` — 3 supported files are outside current coverage. Examples: tools/generate_providers/bin/generate_providers.dart, tools/generate_providers/pubspec.yaml, tools/generate_providers/src/docs.dart
- `packages/riverpod` — 1 supported files are outside current coverage. Examples: packages/riverpod/CHANGELOG.md, packages/riverpod/README.md, packages/riverpod/dartdoc/core.md, packages/riverpod/dartdoc/notifiers.md, packages/riverpod/dartdoc/providers.md
- `packages/lint_visitor_generator` — 1 supported files are outside current coverage. Examples: packages/lint_visitor_generator/README.md, packages/lint_visitor_generator/build.yaml
- `packages/riverpod_lint_flutter_test` — 1 supported files are outside current coverage. Examples: packages/riverpod_lint_flutter_test/README.md, packages/riverpod_lint_flutter_test/build.yaml
- `packages/flutter_riverpod/lib` — 1 supported files are outside current coverage. Examples: packages/flutter_riverpod/lib/src/builders.dart
- `packages/lint_visitor_generator/lib` — 1 supported files are outside current coverage. Examples: packages/lint_visitor_generator/lib/builder.dart

## Folders needing manual indexing or extractor support

- `examples` — 7 high-value files not analyzed. Extensions: .md (7). Examples: examples/counter/README.md, examples/first_app/README.md, examples/marvel/README.md, examples/pub/README.md, examples/pub/build.yaml
- `.github` — 6 high-value files not analyzed. Extensions: .md (6). Examples: .github/FUNDING.yml, .github/ISSUE_TEMPLATE/bug_report.md, .github/ISSUE_TEMPLATE/config.yml, .github/ISSUE_TEMPLATE/example_request.md, .github/ISSUE_TEMPLATE/feature_request.md
- `packages/riverpod` — 6 high-value files not analyzed. Extensions: .md (6). Examples: packages/riverpod/CHANGELOG.md, packages/riverpod/README.md, packages/riverpod/dartdoc/core.md, packages/riverpod/dartdoc/notifiers.md, packages/riverpod/dartdoc/providers.md
- `packages/flutter_riverpod` — 5 high-value files not analyzed. Extensions: .md (5). Examples: packages/flutter_riverpod/CHANGELOG.md, packages/flutter_riverpod/README.md, packages/flutter_riverpod/dartdoc/core.md, packages/flutter_riverpod/dartdoc/notifiers.md, packages/flutter_riverpod/dartdoc/providers.md
- `packages/hooks_riverpod` — 5 high-value files not analyzed. Extensions: .md (5). Examples: packages/hooks_riverpod/CHANGELOG.md, packages/hooks_riverpod/README.md, packages/hooks_riverpod/dartdoc/core.md, packages/hooks_riverpod/dartdoc/notifiers.md, packages/hooks_riverpod/dartdoc/providers.md
- `.` — 4 high-value files not analyzed. Extensions: .md (4). Examples: .tasks.md, CODE_OF_CONDUCT.md, CONTRIBUTING.md, README.md, all_lint_rules.yaml
- `packages/riverpod_generator` — 3 high-value files not analyzed. Extensions: .md (3). Examples: packages/riverpod_generator/CHANGELOG.md, packages/riverpod_generator/README.md, packages/riverpod_generator/build.yaml, packages/riverpod_generator/integration/build_yaml/README.md, packages/riverpod_generator/integration/build_yaml/analysis_options.yaml
- `packages/riverpod_sqflite` — 3 high-value files not analyzed. Extensions: .md (3). Examples: packages/riverpod_sqflite/CHANGELOG.md, packages/riverpod_sqflite/README.md, packages/riverpod_sqflite/example/README.md

## Folders where extractors are weak

- `website` — 230 analyzed files produced 0 signatures or 0 tokens out of 730 analyzed files.
- `packages/riverpod_lint_flutter_test/test` — 71 analyzed files produced 0 signatures or 0 tokens out of 244 analyzed files.
- `packages/riverpod/lib` — 30 analyzed files produced 0 signatures or 0 tokens out of 50 analyzed files.
- `packages/riverpod_analyzer_utils/lib` — 22 analyzed files produced 0 signatures or 0 tokens out of 34 analyzed files.
- `packages/riverpod_generator/test` — 17 analyzed files produced 0 signatures or 0 tokens out of 49 analyzed files.
- `examples` — 15 analyzed files produced 0 signatures or 0 tokens out of 65 analyzed files.
- `packages/flutter_riverpod/lib` — 8 analyzed files produced 0 signatures or 0 tokens out of 11 analyzed files.
- `packages/hooks_riverpod/lib` — 6 analyzed files produced 0 signatures or 0 tokens out of 7 analyzed files.

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

