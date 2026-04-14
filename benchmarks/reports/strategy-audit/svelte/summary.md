# SigMap Strategy Audit

- Repo: `/Users/manojmallick/sigmap/benchmarks/repos/svelte`
- Output directory: `/Users/manojmallick/sigmap/benchmarks/reports/strategy-audit/svelte`
- Recommended strategy: `full`
- Why: full is the simplest reliable option when the repo is small or module splits do not materially reduce injected context.
- srcDirs (auto-detected): `packages`, `benchmarking`, `packages/svelte/tests`, `playgrounds`, `.github`, `packages/svelte/src`
- maxDepth (auto-detected): `12`

## Strategy comparison

| Strategy | Final tokens | Key shape | Extra metrics |
|---|---:|---|---|
| full | 23169 | single full file | n/a |
| per-module | 23169 | overview + module files | overview n/a, modules n/a |
| hot-cold | 23169 | hot primary + cold on-demand | hot n/a, cold n/a |

## Coverage summary

| Coverage signal | Count |
|---|---:|
| Discovered files | 8745 |
| Files analyzed by SigMap | 7976 |
| Supported files missing from analysis | 174 |
| Important unsupported files missing from analysis | 132 |
| Analyzed files with 0 signatures or 0 tokens | 6773 |

## Suggested config

```json
{
  "output": ".github/copilot-instructions.md",
  "outputs": [
    "copilot"
  ],
  "srcDirs": [
    "packages",
    "benchmarking",
    "packages/svelte/tests",
    "playgrounds",
    ".github",
    "packages/svelte/src"
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
  "maxDepth": 12,
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

- `packages/svelte/tests` — 145 supported files are outside current coverage. Examples: packages/svelte/tests/README.md, packages/svelte/tests/migrate/samples/$$slots-used-as-variable/output.svelte, packages/svelte/tests/migrate/samples/$$slots-used-as-variable-$$props/output.svelte, packages/svelte/tests/migrate/samples/accessors/output.svelte, packages/svelte/tests/migrate/samples/css-ignore/output.svelte
- `playgrounds` — 13 supported files are outside current coverage. Examples: playgrounds/sandbox/demo.css, playgrounds/sandbox/index.html, playgrounds/sandbox/run.js, playgrounds/sandbox/scripts/create-app-svelte.js, playgrounds/sandbox/scripts/create-test.js
- `.github` — 9 supported files are outside current coverage. Examples: .github/FUNDING.yml, .github/ISSUE_TEMPLATE/bug_report.yml, .github/ISSUE_TEMPLATE/config.yml, .github/ISSUE_TEMPLATE/feature_request.yml, .github/ISSUE_TEMPLATE.md
- `packages/svelte/src` — 1 supported files are outside current coverage. Examples: packages/svelte/src/compiler/utils/builders.js

## Folders needing manual indexing or extractor support

- `documentation` — 102 high-value files not analyzed. Extensions: .md (102). Examples: documentation/docs/01-introduction/01-overview.md, documentation/docs/01-introduction/02-getting-started.md, documentation/docs/01-introduction/03-svelte-files.md, documentation/docs/01-introduction/04-svelte-js-files.md, documentation/docs/01-introduction/index.md
- `packages/svelte` — 19 high-value files not analyzed. Extensions: .md (19). Examples: packages/svelte/CHANGELOG-pre-5.md, packages/svelte/CHANGELOG.md, packages/svelte/README.md, packages/svelte/messages/client-errors/errors.md, packages/svelte/messages/client-warnings/warnings.md
- `.` — 4 high-value files not analyzed. Extensions: .md (4). Examples: CODE_OF_CONDUCT.md, CONTRIBUTING.md, LICENSE.md, README.md, eslint.config.js
- `.github` — 4 high-value files not analyzed. Extensions: .md (4). Examples: .github/FUNDING.yml, .github/ISSUE_TEMPLATE/bug_report.yml, .github/ISSUE_TEMPLATE/config.yml, .github/ISSUE_TEMPLATE/feature_request.yml, .github/ISSUE_TEMPLATE.md
- `.agents` — 1 high-value files not analyzed. Extensions: .md (1). Examples: .agents/skills/performance-investigation/SKILL.md
- `.changeset` — 1 high-value files not analyzed. Extensions: .md (1). Examples: .changeset/README.md
- `packages/svelte/tests` — 1 high-value files not analyzed. Extensions: .md (1). Examples: packages/svelte/tests/README.md, packages/svelte/tests/migrate/samples/$$slots-used-as-variable/output.svelte, packages/svelte/tests/migrate/samples/$$slots-used-as-variable-$$props/output.svelte, packages/svelte/tests/migrate/samples/accessors/output.svelte, packages/svelte/tests/migrate/samples/css-ignore/output.svelte

## Folders where extractors are weak

- `packages/svelte/tests` — 6713 analyzed files produced 0 signatures or 0 tokens out of 7528 analyzed files.
- `packages/svelte/src` — 40 analyzed files produced 0 signatures or 0 tokens out of 409 analyzed files.
- `benchmarking` — 15 analyzed files produced 0 signatures or 0 tokens out of 23 analyzed files.
- `packages/svelte` — 5 analyzed files produced 0 signatures or 0 tokens out of 16 analyzed files.

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

