# SigMap Strategy Audit

- Repo: `/Users/manojmallick/sigmap/benchmarks/repos/fastify`
- Output directory: `/Users/manojmallick/sigmap/benchmarks/reports/strategy-audit/fastify`
- Recommended strategy: `full`
- Why: full is the simplest reliable option when the repo is small or module splits do not materially reduce injected context.

## Strategy comparison

| Strategy | Final tokens | Key shape | Extra metrics |
|---|---:|---|---|
| full | 2579 | single full file | n/a |
| per-module | 2579 | overview + module files | overview n/a, modules n/a |
| hot-cold | 2579 | hot primary + cold on-demand | hot n/a, cold n/a |

## Coverage summary

| Coverage signal | Count |
|---|---:|
| Discovered files | 390 |
| Files analyzed by SigMap | 31 |
| Supported files missing from analysis | 343 |
| Important unsupported files missing from analysis | 0 |
| Analyzed files with 0 signatures or 0 tokens | 3 |

## Suggested config

```json
{
  "output": ".github/copilot-instructions.md",
  "outputs": [
    "copilot"
  ],
  "srcDirs": [
    "lib",
    "test",
    "docs",
    ".github",
    "examples",
    "types",
    "integration",
    "scripts"
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

- `test` — 226 supported files are outside current coverage. Examples: test/404s.test.js, test/500s.test.js, test/allow-unsafe-regex.test.js, test/als.test.js, test/async-await.test.js
- `docs` — 42 supported files are outside current coverage. Examples: docs/Guides/Benchmarking.md, docs/Guides/Contributing.md, docs/Guides/Database.md, docs/Guides/Delay-Accepting-Requests.md, docs/Guides/Detecting-When-Clients-Abort.md
- `.github` — 25 supported files are outside current coverage. Examples: .github/context-cold.md, .github/copilot-instructions.md, .github/dependabot.yml, .github/labeler.yml, .github/scripts/lint-ecosystem.js
- `examples` — 18 supported files are outside current coverage. Examples: examples/asyncawait.js, examples/benchmark/hooks-benchmark-async-await.js, examples/benchmark/hooks-benchmark.js, examples/benchmark/parser.js, examples/benchmark/simple.js
- `types` — 15 supported files are outside current coverage. Examples: types/content-type-parser.d.ts, types/context.d.ts, types/errors.d.ts, types/hooks.d.ts, types/instance.d.ts
- `integration` — 2 supported files are outside current coverage. Examples: integration/server.js, integration/test.sh
- `scripts` — 1 supported files are outside current coverage. Examples: scripts/validate-ecosystem-links.js

## Folders needing manual indexing or extractor support

No high-value unsupported folders were detected.

## Folders where extractors are weak

- `lib` — 3 analyzed files produced 0 signatures or 0 tokens out of 31 analyzed files.

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

