# SigMap Strategy Audit

- Repo: `/Users/manojmallick/sigmap/benchmarks/repos/spring-petclinic`
- Output directory: `/Users/manojmallick/sigmap/benchmarks/reports/strategy-audit/spring-petclinic`
- Recommended strategy: `full`
- Why: full is the simplest reliable option when the repo is small or module splits do not materially reduce injected context.
- srcDirs (auto-detected): `src`, `src/main/java`, `src/main/resources`, `src/test/java`, `k8s`, `.github`, `.devcontainer`
- maxDepth (auto-detected): `12`

## Strategy comparison

| Strategy | Final tokens | Key shape | Extra metrics |
|---|---:|---|---|
| full | 2559 | single full file | n/a |
| per-module | 2559 | overview + module files | overview n/a, modules n/a |
| hot-cold | 2559 | hot primary + cold on-demand | hot n/a, cold n/a |

## Coverage summary

| Coverage signal | Count |
|---|---:|
| Discovered files | 164 |
| Files analyzed by SigMap | 66 |
| Supported files missing from analysis | 14 |
| Important unsupported files missing from analysis | 45 |
| Analyzed files with 0 signatures or 0 tokens | 15 |

## Suggested config

```json
{
  "output": ".github/copilot-instructions.md",
  "outputs": [
    "copilot"
  ],
  "srcDirs": [
    "src",
    "src/main/java",
    "src/main/resources",
    "src/test/java",
    "k8s",
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

- `.github` — 4 supported files are outside current coverage. Examples: .github/context-cold.md, .github/copilot-instructions.md, .github/dco.yml, .github/strategy-comparison/README.md, .github/strategy-comparison/full/AGENTS.full.md
- `.devcontainer` — 1 supported files are outside current coverage. Examples: .devcontainer/Dockerfile

## Folders needing manual indexing or extractor support

- `.github` — 16 high-value files not analyzed. Extensions: .md (16). Examples: .github/context-cold.md, .github/copilot-instructions.md, .github/dco.yml, .github/strategy-comparison/README.md, .github/strategy-comparison/full/AGENTS.full.md
- `src/main/resources` — 12 high-value files not analyzed. Extensions: .properties (12). Examples: src/main/resources/application-mysql.properties, src/main/resources/application-postgres.properties, src/main/resources/application.properties, src/main/resources/db/h2/data.sql, src/main/resources/db/h2/schema.sql
- `.idea` — 6 high-value files not analyzed. Extensions: .xml (6). Examples: .idea/compiler.xml, .idea/encodings.xml, .idea/jarRepositories.xml, .idea/misc.xml, .idea/vcs.xml
- `.` — 4 high-value files not analyzed. Extensions: .gradle (2), .md (1), .xml (1). Examples: .gitpod.yml, README.md, build.gradle, docker-compose.yml, pom.xml
- `.gradle` — 3 high-value files not analyzed. Extensions: .properties (3). Examples: .gradle/9.2.1/gc.properties, .gradle/buildOutputCleanup/cache.properties, .gradle/vcs-1/gc.properties
- `src` — 2 high-value files not analyzed. Extensions: .xml (2). Examples: src/checkstyle/nohttp-checkstyle-suppressions.xml, src/checkstyle/nohttp-checkstyle.xml
- `.mvn` — 1 high-value files not analyzed. Extensions: .properties (1). Examples: .mvn/wrapper/maven-wrapper.properties
- `gradle` — 1 high-value files not analyzed. Extensions: .properties (1). Examples: gradle/wrapper/gradle-wrapper.properties

## Folders where extractors are weak

- `src/main/resources` — 7 analyzed files produced 0 signatures or 0 tokens out of 13 analyzed files.
- `src/main/java` — 5 analyzed files produced 0 signatures or 0 tokens out of 30 analyzed files.
- `src/main/scss` — 3 analyzed files produced 0 signatures or 0 tokens out of 4 analyzed files.

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

