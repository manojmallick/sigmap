# SigMap Strategy Audit

- Repo: `/Users/manojmallick/sigmap/benchmarks/repos/rails`
- Output directory: `/Users/manojmallick/sigmap/benchmarks/reports/strategy-audit/rails`
- Recommended strategy: `full`
- Why: full is the simplest reliable option when the repo is small or module splits do not materially reduce injected context.
- srcDirs (auto-detected): `actioncable`, `actionmailbox`, `actionmailer`, `actionpack`, `actiontext`, `actionview`, `activejob`, `activemodel`, `activerecord`, `activestorage`, `activesupport`, `guides`, `railties`, `tasks`, `tools`, `.github`, `.devcontainer`
- maxDepth (auto-detected): `7`

## Strategy comparison

| Strategy | Final tokens | Key shape | Extra metrics |
|---|---:|---|---|
| full | 7425 | single full file | n/a |
| per-module | 7425 | overview + module files | overview n/a, modules n/a |
| hot-cold | 7425 | hot primary + cold on-demand | hot n/a, cold n/a |

## Coverage summary

| Coverage signal | Count |
|---|---:|
| Discovered files | 4904 |
| Files analyzed by SigMap | 3702 |
| Supported files missing from analysis | 47 |
| Important unsupported files missing from analysis | 129 |
| Analyzed files with 0 signatures or 0 tokens | 234 |

## Suggested config

```json
{
  "output": ".github/copilot-instructions.md",
  "outputs": [
    "copilot"
  ],
  "srcDirs": [
    "actioncable",
    "actionmailbox",
    "actionmailer",
    "actionpack",
    "actiontext",
    "actionview",
    "activejob",
    "activemodel",
    "activerecord",
    "activestorage",
    "activesupport",
    "guides",
    "railties",
    "tasks",
    "tools",
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

- `.github` — 12 supported files are outside current coverage. Examples: .github/ISSUE_TEMPLATE/bug_report.md, .github/ISSUE_TEMPLATE/config.yml, .github/context-cold.md, .github/copilot-instructions.md, .github/labeler.yml
- `.devcontainer` — 3 supported files are outside current coverage. Examples: .devcontainer/Dockerfile, .devcontainer/boot.sh, .devcontainer/compose.yaml

## Folders needing manual indexing or extractor support

- `guides` — 77 high-value files not analyzed. Extensions: .md (77). Examples: guides/CHANGELOG.md, guides/README.md, guides/assets/stylesrc/vendor/_boilerplate.scss, guides/assets/stylesrc/vendor/_include-media.scss, guides/assets/stylesrc/vendor/_normalize.scss
- `tools` — 25 high-value files not analyzed. Extensions: .md (25). Examples: tools/README.md, tools/rail_inspector/test/fixtures/action_mailbox.md, tools/rail_inspector/test/fixtures/action_mailbox_83d85b2.md, tools/rail_inspector/test/fixtures/action_mailbox_invalid.md, tools/rail_inspector/test/fixtures/action_pack_69d504.md
- `.github` — 5 high-value files not analyzed. Extensions: .md (5). Examples: .github/ISSUE_TEMPLATE/bug_report.md, .github/ISSUE_TEMPLATE/config.yml, .github/context-cold.md, .github/copilot-instructions.md, .github/labeler.yml
- `.` — 4 high-value files not analyzed. Extensions: .md (4). Examples: .mdlrc.rb, .rubocop.yml, CODE_OF_CONDUCT.md, CONTRIBUTING.md, README.md
- `actioncable` — 2 high-value files not analyzed. Extensions: .md (2). Examples: actioncable/CHANGELOG.md, actioncable/README.md
- `actionmailbox` — 2 high-value files not analyzed. Extensions: .md (2). Examples: actionmailbox/CHANGELOG.md, actionmailbox/README.md
- `actiontext` — 2 high-value files not analyzed. Extensions: .md (2). Examples: actiontext/CHANGELOG.md, actiontext/README.md
- `activejob` — 2 high-value files not analyzed. Extensions: .md (2). Examples: activejob/CHANGELOG.md, activejob/README.md

## Folders where extractors are weak

- `activesupport` — 37 analyzed files produced 0 signatures or 0 tokens out of 515 analyzed files.
- `actionpack` — 36 analyzed files produced 0 signatures or 0 tokens out of 379 analyzed files.
- `activerecord` — 34 analyzed files produced 0 signatures or 0 tokens out of 1290 analyzed files.
- `activestorage` — 23 analyzed files produced 0 signatures or 0 tokens out of 193 analyzed files.
- `actiontext` — 22 analyzed files produced 0 signatures or 0 tokens out of 128 analyzed files.
- `actionmailbox` — 19 analyzed files produced 0 signatures or 0 tokens out of 106 analyzed files.
- `actioncable` — 18 analyzed files produced 0 signatures or 0 tokens out of 113 analyzed files.
- `railties` — 17 analyzed files produced 0 signatures or 0 tokens out of 363 analyzed files.

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

