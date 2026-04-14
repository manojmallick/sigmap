# SigMap Strategy Audit

- Repo: `/Users/manojmallick/sigmap/benchmarks/repos/okhttp`
- Output directory: `/Users/manojmallick/sigmap/benchmarks/reports/strategy-audit/okhttp`
- Recommended strategy: `full`
- Why: full is the simplest reliable option when the repo is small or module splits do not materially reduce injected context.
- srcDirs (auto-detected): `android-test`, `android-test-app`, `build-logic`, `container-tests`, `fuzzing`, `maven-tests`, `mockwebserver`, `mockwebserver-deprecated`, `mockwebserver-junit4`, `mockwebserver-junit5`, `module-tests`, `native-image-tests`, `okcurl`, `okhttp`, `okhttp-bom`, `okhttp-brotli`, `okhttp-coroutines`, `okhttp-dnsoverhttps`, `okhttp-hpacktests`, `okhttp-idna-mapping-table`, `okhttp-java-net-cookiejar`, `okhttp-logging-interceptor`, `okhttp-osgi-tests`, `okhttp-sse`, `okhttp-testing-support`, `okhttp-tls`, `okhttp-urlconnection`, `okhttp-zstd`, `regression-test`, `samples`, `.github`, `docs`
- maxDepth (auto-detected): `12`

## Strategy comparison

| Strategy | Final tokens | Key shape | Extra metrics |
|---|---:|---|---|
| full | 8574 | single full file | n/a |
| per-module | 8574 | overview + module files | overview n/a, modules n/a |
| hot-cold | 8574 | hot primary + cold on-demand | hot n/a, cold n/a |

## Coverage summary

| Coverage signal | Count |
|---|---:|
| Discovered files | 797 |
| Files analyzed by SigMap | 524 |
| Supported files missing from analysis | 126 |
| Important unsupported files missing from analysis | 80 |
| Analyzed files with 0 signatures or 0 tokens | 63 |

## Suggested config

```json
{
  "output": ".github/copilot-instructions.md",
  "outputs": [
    "copilot"
  ],
  "srcDirs": [
    "android-test",
    "android-test-app",
    "build-logic",
    "container-tests",
    "fuzzing",
    "maven-tests",
    "mockwebserver",
    "mockwebserver-deprecated",
    "mockwebserver-junit4",
    "mockwebserver-junit5",
    "module-tests",
    "native-image-tests",
    "okcurl",
    "okhttp",
    "okhttp-bom",
    "okhttp-brotli",
    "okhttp-coroutines",
    "okhttp-dnsoverhttps",
    "okhttp-hpacktests",
    "okhttp-idna-mapping-table",
    "okhttp-java-net-cookiejar",
    "okhttp-logging-interceptor",
    "okhttp-osgi-tests",
    "okhttp-sse",
    "okhttp-testing-support",
    "okhttp-tls",
    "okhttp-urlconnection",
    "okhttp-zstd",
    "regression-test",
    "samples",
    ".github",
    "docs"
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

- `samples` — 88 supported files are outside current coverage. Examples: samples/compare/build.gradle.kts, samples/compare/src/test/kotlin/okhttp3/compare/ApacheHttpClientTest.kt, samples/compare/src/test/kotlin/okhttp3/compare/JavaHttpClientTest.kt, samples/compare/src/test/kotlin/okhttp3/compare/JettyHttpClientTest.kt, samples/compare/src/test/kotlin/okhttp3/compare/OkHttpClientTest.kt
- `.github` — 4 supported files are outside current coverage. Examples: .github/CONTRIBUTING.md, .github/ISSUE_TEMPLATE/bug_report.md, .github/ISSUE_TEMPLATE/feature_request.md, .github/ISSUE_TEMPLATE/question.md, .github/context-cold.md
- `docs` — 1 supported files are outside current coverage. Examples: docs/assets/css/app.css, docs/changelogs/changelog_1x.md, docs/changelogs/changelog_2x.md, docs/changelogs/changelog_3x.md, docs/changelogs/changelog_4x.md

## Folders needing manual indexing or extractor support

- `docs` — 22 high-value files not analyzed. Extensions: .md (22). Examples: docs/assets/css/app.css, docs/changelogs/changelog_1x.md, docs/changelogs/changelog_2x.md, docs/changelogs/changelog_3x.md, docs/changelogs/changelog_4x.md
- `.github` — 6 high-value files not analyzed. Extensions: .md (6). Examples: .github/CONTRIBUTING.md, .github/ISSUE_TEMPLATE/bug_report.md, .github/ISSUE_TEMPLATE/feature_request.md, .github/ISSUE_TEMPLATE/question.md, .github/context-cold.md
- `.` — 5 high-value files not analyzed. Extensions: .md (4), .properties (1). Examples: BUG-BOUNTY.md, CHANGELOG.md, CONTRIBUTING.md, README.md, build.gradle.kts
- `okhttp` — 5 high-value files not analyzed. Extensions: .properties (3), .md (1), .xml (1). Examples: okhttp/Module.md, okhttp/build.gradle.kts, okhttp/src/androidHostTest/resources/okhttp3/robolectric.properties, okhttp/src/androidMain/AndroidManifest.xml, okhttp/src/jvmMain/resources/META-INF/native-image/okhttp/okhttp/native-image.properties
- `android-test` — 4 high-value files not analyzed. Extensions: .xml (3), .md (1). Examples: android-test/build.gradle.kts, android-test/src/androidTest/README.md, android-test/src/main/AndroidManifest.xml, android-test/src/main/res/values/strings.xml, android-test/src/main/res/xml/network_security_config.xml
- `regression-test` — 4 high-value files not analyzed. Extensions: .xml (3), .md (1). Examples: regression-test/README.md, regression-test/build.gradle.kts, regression-test/src/main/AndroidManifest.xml, regression-test/src/main/res/values/strings.xml, regression-test/src/main/res/xml/network_security_config.xml
- `android-test-app` — 3 high-value files not analyzed. Extensions: .xml (3). Examples: android-test-app/build.gradle.kts, android-test-app/src/main/AndroidManifest.xml, android-test-app/src/main/res/values/strings.xml, android-test-app/src/main/res/xml/network_security_config.xml
- `gradle` — 3 high-value files not analyzed. Extensions: .properties (2), .toml (1). Examples: gradle/gradle-daemon-jvm.properties, gradle/libs.versions.toml, gradle/wrapper/gradle-wrapper.properties

## Folders where extractors are weak

- `okhttp` — 29 analyzed files produced 0 signatures or 0 tokens out of 309 analyzed files.
- `build-logic` — 6 analyzed files produced 0 signatures or 0 tokens out of 11 analyzed files.
- `mockwebserver-deprecated` — 3 analyzed files produced 0 signatures or 0 tokens out of 11 analyzed files.
- `fuzzing` — 2 analyzed files produced 0 signatures or 0 tokens out of 2 analyzed files.
- `mockwebserver` — 2 analyzed files produced 0 signatures or 0 tokens out of 20 analyzed files.
- `mockwebserver-junit5` — 2 analyzed files produced 0 signatures or 0 tokens out of 4 analyzed files.
- `module-tests` — 2 analyzed files produced 0 signatures or 0 tokens out of 5 analyzed files.
- `okhttp-brotli` — 2 analyzed files produced 0 signatures or 0 tokens out of 5 analyzed files.

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

