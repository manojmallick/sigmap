# SigMap Strategy Audit

- Repo: `/Users/manojmallick/sigmap/benchmarks/repos/rust-analyzer`
- Output directory: `/Users/manojmallick/sigmap/benchmarks/reports/strategy-audit/rust-analyzer`
- Recommended strategy: `full`
- Why: full is the simplest reliable option when the repo is small or module splits do not materially reduce injected context.
- srcDirs (auto-detected): `lib`, `crates`, `xtask`, `editors`, `.github`
- maxDepth (auto-detected): `9`

## Strategy comparison

| Strategy | Final tokens | Key shape | Extra metrics |
|---|---:|---|---|
| full | 6253 | single full file | n/a |
| per-module | 6253 | overview + module files | overview n/a, modules n/a |
| hot-cold | 6253 | hot primary + cold on-demand | hot n/a, cold n/a |

## Coverage summary

| Coverage signal | Count |
|---|---:|
| Discovered files | 2268 |
| Files analyzed by SigMap | 1458 |
| Supported files missing from analysis | 56 |
| Important unsupported files missing from analysis | 103 |
| Analyzed files with 0 signatures or 0 tokens | 798 |

## Suggested config

```json
{
  "output": ".github/copilot-instructions.md",
  "outputs": [
    "copilot"
  ],
  "srcDirs": [
    "lib",
    "crates",
    "xtask",
    "editors",
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

- `editors` — 25 supported files are outside current coverage. Examples: editors/code/README.md, editors/code/src/bootstrap.ts, editors/code/src/client.ts, editors/code/src/commands.ts, editors/code/src/config.ts
- `.github` — 14 supported files are outside current coverage. Examples: .github/ISSUE_TEMPLATE/bug_report.md, .github/ISSUE_TEMPLATE/config.yml, .github/ISSUE_TEMPLATE/critical_nightly_regression.md, .github/ISSUE_TEMPLATE/feature_request.md, .github/actions/github-release/Dockerfile

## Folders needing manual indexing or extractor support

- `crates` — 40 high-value files not analyzed. Extensions: .toml (39), .md (1). Examples: crates/base-db/Cargo.toml, crates/base-db/src/target.rs, crates/cfg/Cargo.toml, crates/edition/Cargo.toml, crates/hir/Cargo.toml
- `docs` — 28 high-value files not analyzed. Extensions: .md (27), .toml (1). Examples: docs/book/README.md, docs/book/book.toml, docs/book/src/README.md, docs/book/src/SUMMARY.md, docs/book/src/assists.md
- `lib` — 14 high-value files not analyzed. Extensions: .md (7), .toml (7). Examples: lib/README.md, lib/la-arena/Cargo.toml, lib/line-index/Cargo.toml, lib/line-index/README.md, lib/lsp-server/Cargo.toml
- `.` — 10 high-value files not analyzed. Extensions: .toml (6), .md (4). Examples: .codecov.yml, .typos.toml, CLAUDE.md, CONTRIBUTING.md, Cargo.toml
- `.github` — 6 high-value files not analyzed. Extensions: .md (6). Examples: .github/ISSUE_TEMPLATE/bug_report.md, .github/ISSUE_TEMPLATE/config.yml, .github/ISSUE_TEMPLATE/critical_nightly_regression.md, .github/ISSUE_TEMPLATE/feature_request.md, .github/actions/github-release/Dockerfile
- `editors` — 2 high-value files not analyzed. Extensions: .md (2). Examples: editors/code/README.md, editors/code/src/bootstrap.ts, editors/code/src/client.ts, editors/code/src/commands.ts, editors/code/src/config.ts
- `xtask` — 2 high-value files not analyzed. Extensions: .toml (1), .md (1). Examples: xtask/Cargo.toml, xtask/src/dist.rs, xtask/test_data/expected.md
- `.cargo` — 1 high-value files not analyzed. Extensions: .toml (1). Examples: .cargo/config.toml

## Folders where extractors are weak

- `crates` — 779 analyzed files produced 0 signatures or 0 tokens out of 1405 analyzed files.
- `lib` — 12 analyzed files produced 0 signatures or 0 tokens out of 34 analyzed files.
- `xtask` — 7 analyzed files produced 0 signatures or 0 tokens out of 19 analyzed files.

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

