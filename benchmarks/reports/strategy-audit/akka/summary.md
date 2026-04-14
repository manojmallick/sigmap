# SigMap Strategy Audit

- Repo: `/Users/manojmallick/sigmap/benchmarks/repos/akka`
- Output directory: `/Users/manojmallick/sigmap/benchmarks/reports/strategy-audit/akka`
- Recommended strategy: `full`
- Why: full is the simplest reliable option when the repo is small or module splits do not materially reduce injected context.
- srcDirs (auto-detected): `akka-actor`, `akka-actor-testkit-typed`, `akka-actor-tests`, `akka-actor-typed`, `akka-actor-typed-tests`, `akka-bench-jmh`, `akka-cluster`, `akka-cluster-metrics`, `akka-cluster-sharding`, `akka-cluster-sharding-typed`, `akka-cluster-tools`, `akka-cluster-typed`, `akka-coordination`, `akka-discovery`, `akka-distributed-data`, `akka-docs`, `akka-multi-node-testkit`, `akka-persistence`, `akka-persistence-query`, `akka-persistence-shared`, `akka-persistence-tck`, `akka-persistence-testkit`, `akka-persistence-typed`, `akka-persistence-typed-tests`, `akka-pki`, `akka-remote`, `akka-remote-tests`, `akka-serialization-jackson`, `akka-slf4j`, `akka-stream`, `akka-stream-testkit`, `akka-stream-tests`, `akka-stream-tests-tck`, `akka-stream-typed`, `akka-testkit`, `kubernetes`, `plugins`, `project`, `scripts`, `samples`, `.github`, `native-image-tests`
- maxDepth (auto-detected): `12`

## Strategy comparison

| Strategy | Final tokens | Key shape | Extra metrics |
|---|---:|---|---|
| full | 11070 | single full file | n/a |
| per-module | 11070 | overview + module files | overview n/a, modules n/a |
| hot-cold | 11070 | hot primary + cold on-demand | hot n/a, cold n/a |

## Coverage summary

| Coverage signal | Count |
|---|---:|
| Discovered files | 4626 |
| Files analyzed by SigMap | 3139 |
| Supported files missing from analysis | 134 |
| Important unsupported files missing from analysis | 503 |
| Analyzed files with 0 signatures or 0 tokens | 566 |

## Suggested config

```json
{
  "output": ".github/copilot-instructions.md",
  "outputs": [
    "copilot"
  ],
  "srcDirs": [
    "akka-actor",
    "akka-actor-testkit-typed",
    "akka-actor-tests",
    "akka-actor-typed",
    "akka-actor-typed-tests",
    "akka-bench-jmh",
    "akka-cluster",
    "akka-cluster-metrics",
    "akka-cluster-sharding",
    "akka-cluster-sharding-typed",
    "akka-cluster-tools",
    "akka-cluster-typed",
    "akka-coordination",
    "akka-discovery",
    "akka-distributed-data",
    "akka-docs",
    "akka-multi-node-testkit",
    "akka-persistence",
    "akka-persistence-query",
    "akka-persistence-shared",
    "akka-persistence-tck",
    "akka-persistence-testkit",
    "akka-persistence-typed",
    "akka-persistence-typed-tests",
    "akka-pki",
    "akka-remote",
    "akka-remote-tests",
    "akka-serialization-jackson",
    "akka-slf4j",
    "akka-stream",
    "akka-stream-testkit",
    "akka-stream-tests",
    "akka-stream-tests-tck",
    "akka-stream-typed",
    "akka-testkit",
    "kubernetes",
    "plugins",
    "project",
    "scripts",
    "samples",
    ".github",
    "native-image-tests"
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

- `samples` — 90 supported files are outside current coverage. Examples: samples/akka-quickstart-java/README.md, samples/akka-quickstart-java/build.gradle, samples/akka-quickstart-java/gradle/wrapper/gradle-wrapper.properties, samples/akka-quickstart-java/pom.xml, samples/akka-quickstart-java/src/main/java/com/example/HelloWorld.java
- `.github` — 14 supported files are outside current coverage. Examples: .github/ISSUE_TEMPLATE/---bug-report.md, .github/ISSUE_TEMPLATE/---feature-request.md, .github/ISSUE_TEMPLATE/--question.md, .github/autolabeler.yml, .github/context-cold.md
- `native-image-tests` — 5 supported files are outside current coverage. Examples: native-image-tests/README.md, native-image-tests/cluster-scala/project/build.properties, native-image-tests/cluster-scala/src/main/resources/logback.xml, native-image-tests/cluster-scala/src/main/scala/com/lightbend/Main.scala, native-image-tests/local-scala/project/build.properties

## Folders needing manual indexing or extractor support

- `akka-docs` — 417 high-value files not analyzed. Extensions: .md (416), .xml (1). Examples: akka-docs/release-train-issue-template.md, akka-docs/src/main/categories/actor-interop-operators.md, akka-docs/src/main/categories/additional-sink-and-source-converters.md, akka-docs/src/main/categories/asynchronous-operators.md, akka-docs/src/main/categories/backpressure-aware-operators.md
- `samples` — 45 high-value files not analyzed. Extensions: .xml (24), .md (10), .properties (10), .gradle (1). Examples: samples/akka-quickstart-java/README.md, samples/akka-quickstart-java/build.gradle, samples/akka-quickstart-java/gradle/wrapper/gradle-wrapper.properties, samples/akka-quickstart-java/pom.xml, samples/akka-quickstart-java/src/main/java/com/example/HelloWorld.java
- `.github` — 5 high-value files not analyzed. Extensions: .md (5). Examples: .github/ISSUE_TEMPLATE/---bug-report.md, .github/ISSUE_TEMPLATE/---feature-request.md, .github/ISSUE_TEMPLATE/--question.md, .github/autolabeler.yml, .github/context-cold.md
- `native-image-tests` — 5 high-value files not analyzed. Extensions: .properties (2), .xml (2), .md (1). Examples: native-image-tests/README.md, native-image-tests/cluster-scala/project/build.properties, native-image-tests/cluster-scala/src/main/resources/logback.xml, native-image-tests/cluster-scala/src/main/scala/com/lightbend/Main.scala, native-image-tests/local-scala/project/build.properties
- `akka-actor-typed-tests` — 4 high-value files not analyzed. Extensions: .xml (4). Examples: akka-actor-typed-tests/src/test/resources/logback-doc-dev.xml, akka-actor-typed-tests/src/test/resources/logback-doc-prod.xml, akka-actor-typed-tests/src/test/resources/logback-doc-test.xml, akka-actor-typed-tests/src/test/resources/logback-test.xml
- `akka-remote` — 4 high-value files not analyzed. Extensions: .properties (2), .md (2). Examples: akka-remote/src/main/protobuf/ArteryControlFormats.proto, akka-remote/src/main/protobuf/ContainerFormats.proto, akka-remote/src/main/protobuf/SystemMessageFormats.proto, akka-remote/src/main/protobuf/WireFormats.proto, akka-remote/src/main/resources/META-INF/native-image/com.typesafe.akka/akka-remote/native-image.properties
- `.` — 3 high-value files not analyzed. Extensions: .md (3). Examples: .fossa.yml, CONTRIBUTING.md, README.md, RELEASING.md
- `akka-bench-jmh` — 2 high-value files not analyzed. Extensions: .md (1), .xml (1). Examples: akka-bench-jmh/README.md, akka-bench-jmh/src/main/resources/logback.xml

## Folders where extractors are weak

- `akka-stream` — 94 analyzed files produced 0 signatures or 0 tokens out of 182 analyzed files.
- `akka-actor` — 93 analyzed files produced 0 signatures or 0 tokens out of 226 analyzed files.
- `akka-remote` — 58 analyzed files produced 0 signatures or 0 tokens out of 173 analyzed files.
- `akka-actor-typed` — 53 analyzed files produced 0 signatures or 0 tokens out of 91 analyzed files.
- `akka-persistence-typed` — 46 analyzed files produced 0 signatures or 0 tokens out of 126 analyzed files.
- `akka-cluster-sharding` — 24 analyzed files produced 0 signatures or 0 tokens out of 118 analyzed files.
- `akka-persistence` — 23 analyzed files produced 0 signatures or 0 tokens out of 96 analyzed files.
- `akka-serialization-jackson` — 20 analyzed files produced 0 signatures or 0 tokens out of 53 analyzed files.

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

