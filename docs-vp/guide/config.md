---
title: Config reference
description: Complete SigMap configuration reference. Every key in gen-context.config.json with types, defaults, and examples. srcDirs, maxTokens, extends, strategy, outputs, secretScan and more.
head:
  - - meta
    - property: og:title
      content: "SigMap Configuration Reference"
  - - meta
    - property: og:description
      content: "Every gen-context.config.json key documented with types, defaults, and examples."
  - - meta
    - property: og:url
      content: "https://sigmap.io/guide/config"
  - - meta
    - property: og:type
      content: article
  - - meta
    - name: twitter:title
      content: "SigMap Configuration Reference"
  - - meta
    - name: twitter:description
      content: "Every gen-context.config.json key documented with types, defaults, and examples."
  - - meta
    - name: twitter:image:alt
      content: "SigMap Configuration Reference"
  - - meta
    - name: keywords
      content: "sigmap config, gen-context.config.json, sigmap configuration, srcDirs, maxTokens, extends, strategy, outputs, secretScan, sigmap settings"
---
# Config reference

All configuration lives in `gen-context.config.json` at the project root. Generate a starter file with:

```bash
sigmap --init
```

Or let detection write it for you: `sigmap tune` (v8.25.0) prints a recommended config diff — srcDirs pin, monorepo mode, adapters, excludes — with one reason per change, and `sigmap tune --apply` merges it in without touching your existing keys. See the [CLI reference](/guide/cli#tune).

## Copy-paste presets

### Solo repo

```json
{
  "srcDirs": ["src", "app", "lib"],
  "strategy": "full",
  "autoMaxTokens": true,
  "outputs": ["copilot"]
}
```

### Large monorepo

```json
{
  "srcDirs": ["packages", "apps", "services"],
  "strategy": "per-module",
  "monorepo": true,
  "autoMaxTokens": true
}
```

### Claude Code, Cursor, Windsurf, or Zed with MCP

```json
{
  "srcDirs": ["src", "app", "lib"],
  "strategy": "hot-cold",
  "hotCommits": 10,
  "diffPriority": true
}
```

### Team shared base config

```json
{
  "extends": "./configs/team-base.json",
  "srcDirs": ["src", "packages"],
  "outputs": ["copilot", "claude"]
}
```

## Full example

```json
{
  "extends": "./team-base.json",
  "srcDirs": ["src", "app", "lib"],
  "output": ".github/copilot-instructions.md",
  "outputs": ["copilot", "claude"],
  "autoMaxTokens": true,
  "coverageTarget": 0.80,
  "strategy": "full",
  "hotCommits": 10,
  "diffPriority": true,
  "monorepo": false,
  "watchDebounce": 300,
  "secretScan": true,
  "todos": true,
  "changes": true,
  "retrieval": {
    "topK": 10,
    "recencyBoost": 1.5
  }
}
```

## Inheritance (v5.0)

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `extends` | `string` | _(none)_ | Path to a base config JSON file (local or HTTPS URL) to inherit from before applying local overrides. |

### extends

Inherit from a shared team base config. The merge order is: **DEFAULTS → base → local config**. Every local key overrides the base.

Local file:

```json
{ "extends": "./configs/team-base.json" }
```

Remote URL (cached 1 hour in `.context/config-cache/`):

```json
{ "extends": "https://raw.githubusercontent.com/your-org/sigmap-config/main/base.json" }
```

The base file is a plain `gen-context.config.json` without an `extends` key itself.

---

## Output

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `output` | `string` | `.github/copilot-instructions.md` | Path to write the primary context file for the `"copilot"` target. |
| `outputs` | `string[]` | `["copilot"]` | Which output files to write. Values: `"copilot"` (`.github/copilot-instructions.md`), `"claude"` (`CLAUDE.md`). |
| `adapters` | `string[]\|null` | `null` | v3.0+ alias for `outputs`. `loadConfig` mirrors it into `outputs` for `"copilot"`, `"claude"`, `"cursor"` and `"windsurf"`; `"openai"`, `"gemini"` and `"codex"` are dropped by that mirror, so list those in `outputs` instead. |

## Token budget

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `autoMaxTokens` | `boolean` | `true` | Auto-scale the token budget based on repo size. Set `false` to use a fixed `maxTokens`. |
| `coverageTarget` | `number` | `0.80` | Target fraction of source files to include (0.0–1.0). Default: 80%. |
| `modelContextLimit` | `number` | `128000` | Model context window size in tokens. Hard cap = `modelContextLimit × maxTokensHeadroom`. |
| `maxTokensHeadroom` | `number` | `0.20` | Fraction of the model context reserved for SigMap output. Default 0.20 = 25 600-token cap for 128K models. |
| `maxTokens` | `number` | `6000` | Used only when `autoMaxTokens: false`, or as a minimum floor. |

**Formula:** `effective = clamp(ceil(totalSigTokens × coverageTarget), 4000, floor(modelContextLimit × maxTokensHeadroom))`

When the hard cap prevents hitting the coverage target by more than 10 percentage points, SigMap prints a warning and suggests switching to `strategy: "per-module"`.

To pin a fixed budget (v4.0 behaviour):
```json
{ "autoMaxTokens": false, "maxTokens": 6000 }
```

## Source scanning

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `srcDirs` | `string[]` | auto-detected | Directories to scan for source files, relative to the project root. Omit it and SigMap detects them, falling back to a 42-entry list (see `src/config/defaults.js`) when detection finds nothing; set it to pin them explicitly. On a **multi-module JVM build** (Gradle, Maven or sbt) detection returns one root per module source set — `core/src/main/kotlin`, `core/src/jvmMain/kotlin`, … — rather than the module directories, so tests, resources and build output are excluded by construction. Verify with `sigmap roots --explain`. |
| `exclude` | `string[]` | `["node_modules", ".git", "dist", "build", "out", …]` | Directory and file names skipped entirely during scanning and source-root auto-detection. See `src/config/defaults.js` for the full list. |
| `maxSigsPerFile` | `number` | `25` | Maximum signatures extracted per file; the tail is replaced with a `… +N more signatures` notice. See [KNOWN_LIMITATIONS.md](https://github.com/manojmallick/sigmap/blob/main/KNOWN_LIMITATIONS.md). |
| `monorepo` | `boolean` | `false` | When true, generates a separate context section per package under `packages/`, `apps/`, or `services/`. |
| `maxDepth` | `number` | `6` (`12` for JVM layouts) | How many directory levels below each `srcDirs` entry to scan. Raised automatically to 12 when a Maven/Gradle/sbt layout is detected — see below. An explicit value always wins. |

### `maxDepth` and JVM layouts

`6` suits the JS/Python-shaped trees the default was tuned on. A JVM project is
different: Java puts **one directory per package segment**, so real code in
`src/main/java/com/company/project/module/Class.java` sits 8–10 levels down. At
depth 6 only the top-level package is reachable — on `spring-petclinic` that
indexed **6 of 47** Java files, and files like `OwnerController.java` were
invisible to `ask` and to the context file alike.

SigMap therefore resolves `maxDepth` to **12** when it detects a JVM layout —
a `pom.xml`, `build.gradle[.kts]`, `build.sbt`, `settings.gradle[.kts]`, or a
`src/main/{java,kotlin,scala}` tree. This matches the dependency-graph walk,
which has used 12 since v8.31.0.

Non-JVM repos are unaffected: deepening globally was measured and rejected, as
it added candidates to every repo for no gain. Setting `maxDepth` yourself
always wins, including a deliberately shallow value:

```json
{ "srcDirs": ["src"], "maxDepth": 4 }
```

If a repo looks under-indexed, compare what is on disk with what was scanned:

```bash
sigmap --analyze          # files scanned, signatures per file
```


### Source-root detection on JVM projects

Leave `srcDirs` unset and SigMap detects it. On a multi-module Gradle, Maven or sbt build this returns **one root per module source set**:

```
core/src/main/kotlin
core/src/jvmMain/kotlin
client/src/main/java
samples/guide/src/main/java
```

Source sets are discovered rather than assumed, so Kotlin Multiplatform layouts (`commonMain`, `jvmMain`, `androidMain`, and custom sets) resolve alongside the classic `main`. Test source sets (`src/test`, `commonTest`, `androidHostTest`) are deliberately excluded — test files are indexed separately and reachable via `sigmap ask`, but they are not source roots.

Detection is structural: two or more module source directories on disk is what makes a build multi-module, with `settings.gradle` `include`, Maven `<modules>` and sbt `lazy val … = project` as secondary evidence. A build file that declares a module which is not present cannot mislead it.

Before v8.51.0 these layouts were badly under-detected — the scan looked two directory levels deep while module source sits at four, so okhttp indexed 4 files of 596. If you pinned `srcDirs` by hand to work around that, you can now drop the override and re-check with `sigmap roots --explain`.

## Strategy

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `strategy` | `"full" \| "index" \| "per-module" \| "hot-cold"` | `"full"` | Context output strategy. `full` = one file, all signatures. `index` = the always-on file is a **map only**; every signature stays in `.context/sig-index.json` and is pulled per question by `sigmap ask` (largest always-on saving). `per-module` = one file per source directory. `hot-cold` = recently changed files auto-injected; everything else in a cold file for MCP retrieval. See [Strategies](/guide/strategies). |
| `hotCommits` | `number` | `10` | Number of recent commits to include in the hot set when `strategy` is `"hot-cold"`. |
| `diffPriority` | `boolean` | `true` | When true, files changed in the current git diff are ranked highest in the output. |

## Features

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `secretScan` | `boolean` | `true` | Scan output for 10 credential patterns before writing. Matching content is replaced with `[REDACTED]`. Patterns: AWS keys, GitHub tokens, JWTs, database URLs, SSH keys, GCP keys, Stripe keys, Twilio keys, generic passwords/api_keys. |
| `monorepo` | `boolean` | `false` | See Source scanning above. |
| `sigCache` | `boolean` | `false` | Enable incremental signature cache. When true, caches extracted signatures with mtime-based validation. Cache is automatically busted on version changes. Skips re-extraction of unchanged files for faster subsequent runs. |
| `sessionBudgetTokens` | `number\|null` | `null` | Opt-in per-session budget for **estimated SigMap-emitted tokens** (chars/4). When set, [`sigmap budget`](/guide/cli#budget) and the MCP `get_budget` tool report remaining tokens, percent used, and an over-budget flag. Counts only what SigMap outputs — not the host chat's total spend. |
| `contextTtlDays` | `number\|null` | `null` | Opt-in staleness threshold: when the newest generated context file is older than this many days, `budget`/`get_budget` flag it `STALE` and advise re-running sigmap. |
| `format` | `"default"\|"cache"` | `"default"` | Output format. `"cache"` additionally writes an Anthropic prompt-cache JSON payload beside the markdown. |
| `routing` | `boolean` | `false` | Append a model-routing hints section that groups files into fast / balanced / powerful tiers by complexity. |
| `depMap` | `boolean` | `true` | Include a compact import dependency map (`## deps`) at the top of the output. |
| `impactRadius` | `boolean` | `false` | Annotate file headings with reverse-dependency usage hints — the files that import them. |
| `tracking` | `boolean` | `false` | Legacy per-run health log: append run metrics to `.context/usage.ndjson`. |
| `mcp.autoRegister` | `boolean` | `true` | Present in `DEFAULTS` but read nowhere in the source. MCP registration is done by `sigmap --setup`; setting this key has no effect. |

Per-operation gain capture (`.context/gain.ndjson`, surfaced by [`sigmap gain`](/guide/cli#gain)) is on by default; it stores counts only — no file paths, source, or query text — and never leaves the machine. Opt out with `--no-track` or `SIGMAP_NO_TRACK=1`. It is independent of the legacy `tracking` health log.

## Watch

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `watchDebounce` | `number` | `300` | Debounce delay in milliseconds for file watcher events. Increase if you see multiple regenerations for a single save. |

## Impact

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `impact.depth` | `number` | `3` | BFS depth for the `--impact` report (`0` = unlimited). The `--depth` flag overrides it. |
| `impact.includeSigs` | `boolean` | `true` | Present in `DEFAULTS` but read nowhere in the source; the `--impact` report lists impacted files and never consumes this key. |

## Enrichment

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `todos` | `boolean` | `true` | Append a TODO/FIXME/HACK/XXX section extracted from inline comments (max 20 entries). |
| `changes` | `boolean` | `true` | Append a recent git log summary showing files changed in the last `changesCommits` commits. |
| `changesCommits` | `number` | `10` | Number of recent commits analyzed for the `changes` section. |
| `versionPins` | `boolean` | `true` | Append a `## versions (installed direct deps)` section listing `name@version` for the installed direct dependencies (JS from `node_modules`, Python from the venv `site-packages`). Grounds agents against what is actually installed. See [versionPins](#versionpins). |
| `terse` | `boolean` | `false` | Deterministic terse encoding of the signature block (`function `→`fn `, tightened params/arrows/exports). Line anchors and doc hints are preserved byte-exactly. Measured −16.1% signature tokens on the SigMap repo (`npm run benchmark:terse`). Also available at runtime as the `--terse` flag. See [terse](#terse). |
| `testCoverage` | `boolean` | `false` | Annotate each function signature with `✓` (tested) or `✗` (untested). Can also be set at runtime via the `--coverage` flag without editing this file. |
| `testDirs` | `string[]` | `["tests","test","__tests__","spec"]` | Directories scanned to build the test index when `testCoverage` is enabled. |
| `retrieval.topK` | `number` | `10` | Number of top-ranked files returned by `--query` and the `query_context` MCP tool. |
| `retrieval.recencyBoost` | `number` | `1.5` | Multiplier applied to recently committed files during TF-IDF ranking. |
| `retrieval.callGraphBoost` | `boolean` | `false` | **v8.15.0, opt-in.** Boost files call-graph-connected to query matches in `ask`/`--query`/`query_context` — catches Go/Java same-package relations that have no import edge. Measured on the 90-task A/B: **+0 hit@5 delta**, so it stays off by default; enable it on call-topology-heavy repos and check the `callGraphBoost` signal in `--query --json`. Re-measure with `npm run benchmark:callgraph-boost`. |
| `retrieval.surfaceEnrichment` | `boolean` | `false` | **v8.18.0, opt-in.** Append `route METHOD /path` pseudo-signatures to the rankable index so route-worded queries can match controllers whose signatures never mention the path (Express/Fastify/NestJS/Flask/FastAPI/Gin/Spring). Measured on the 90-task A/B: **+0 delta** (the corpus never asks route-worded questions), so it stays off by default; enable it on API-heavy repos. Re-measure with `npm run benchmark:surface-enrichment`. |
| `retrieval.centralityBlend` | `boolean` | `false` | **v8.21.0, opt-in.** Blend import-graph centrality (zero-dep power iteration over the forward dependency graph) into `ask`/`--query`/`query_context` ranking as a small additive prior (`0.3 × centrality`) on positively-scored files only — heavily-referenced files break ties above one-off helpers, and non-matching files are never surfaced. Measured on the 90-task A/B: **+0 delta** (both arms 77.8% hit@5), so it stays off by default; enable it on hub-and-spoke architectures and check the `centrality` signal in `--query --json`. Re-measure with `npm run benchmark:centrality-blend`. |
| `retrieval.minedExpansions` | `boolean` | `false` | **v8.48.0, opt-in (B2).** Repo-mined query expansion: tokens co-occurring within the same file's path + signature vocabulary become weighted synonyms for `ask`/`--query`/`query_context` — "auth" ↔ "session" learned from *this* repo, deterministic and cached at `.context/mined-expansions.json`. Precision filters: document-frequency floor/ceiling, minimum co-occurrence, top-4 neighbors, static-synonym pairs excluded; mined weight never exceeds the curated synonym weight. Measured on the full 299-task A/B including the leak-free hard split: cross-repo corpus **hit@5 89.5% → 90.5%** (fastify +1) and JVM +1 (akka), but the **hard split regressed 67/90 → 66/90** and overall MRR fell 0.562 → 0.559 — the hit@5-only trap in person, so the default stays off. Enable it on sparse-context repos (few signatures per file), where the measured wins live; dense-vocabulary repos mine too broad a surface. Re-measure with `npm run benchmark:mined-expansions`. |
| `exactness.typescript` | `boolean` | `false` | **v8.36.0, opt-in.** Parse `.ts` with the **target repo's own** `node_modules/typescript` (the user's install — nothing is bundled) for true-AST signatures: exact anchors across multiline declarations, constrained generics, and the typed arrow consts regex cannot see. Silent, byte-identical regex fallback when the flag is off, no typescript resolves, or the resolved package has no compiler API (typescript@7's Go-native compiler is rejected by design — its path is the future LSP tier). When native extraction fires, the generated header carries `toolchain=typescript@<version>`, so byte-stability is stated per toolchain version. Measured +54% signatures on zod with typescript@5.9.3, 0 parse failures. See [exactness.typescript](#exactness-typescript). |
| `exactness.lsp` | `boolean` | `false` | **v8.37.0, opt-in.** Ask a language server already on the machine (clangd/gopls/rust-analyzer) for `documentSymbol` per file — server-typed details and exact multiline ranges, cached across runs by content hash + server binary. A per-file quality guard accepts the LSP result only when it does not lose surface vs the regex tier (a server parsing standalone can be macro-blind), so the tier is strictly non-losing. Header labels `toolchain=<server>@<version>` when used. Measured with clangd: libuv +37%, spdlog +15% effective signatures. See [exactness.lsp](#exactness-lsp). |
| `exactness.scip` | `boolean` | `false` | **v8.38.0, opt-in.** Read a CI-produced `index.scip` at the repo root as a signature source (import only): compiler-typed signatures with definition-occurrence anchors, parsed by a zero-dep protobuf reader. Same per-file never-lose-vs-regex guard as the LSP tier; header labels `toolchain=scip:<tool>@<version>` on acceptance. Measured on zod: +590% effective signatures. See [exactness.scip](#exactness-scip). |
| `exactness.lspServers` | `object` | `{}` | Extension → command-array overrides laid over the built-in server registry, e.g. `{ ".rs": ["rust-analyzer"] }`. Commands are spawned directly with an argument array — never a shell. |
| `judge.threshold` | `number` | `0.25` | **v8.45.0 (J2).** Verdict pass/fail floor for [`sigmap judge`](/guide/cli#judge): groundedness below this fails. The `--threshold` flag overrides the config value. |
| `judge.learnBoostAbove` | `number` | `0.75` | **v8.45.0 (J2).** With `--learn`, context files are boosted when the groundedness score exceeds this bound. See [judge](#judge) for how the default is derived. |
| `judge.learnPenalizeBelow` | `number` | `0.40` | **v8.45.0 (J2).** With `--learn`, context files are penalized when the score falls below this bound; scores between the two bounds neither boost nor penalize. |

### judge

**v8.45.0 (J2).** The [`sigmap judge --learn`](/guide/cli#judge) feedback loop boosts or penalizes context-file weights based on the groundedness score. The band was previously hardcoded; these keys make it tunable per repo, and the defaults are **measured, not hand-picked**: answers built from ≥ ~80% context-grounded vocabulary score above `learnBoostAbove`, answers under ~30% grounded score below `learnPenalizeBelow` — verified by a drift-guard test that constructs exact-ratio mixtures from the repo's own signature vocabulary and pins the band ordering (`0 < learnPenalizeBelow < learnBoostAbove < 1`). Tighten the band (e.g. `0.85`/`0.30`) to make learning more conservative on noisy corpora.

```json
{
  "judge": {
    "threshold": 0.25,
    "learnBoostAbove": 0.75,
    "learnPenalizeBelow": 0.40
  }
}
```

### sigCache

Enable incremental signature caching with mtime-based validation. When enabled, caches extracted signatures in `.sigmap-cache.json` and skips re-extraction of unchanged files. Cache is automatically busted on version changes.

```json
{
  "sigCache": true
}
```

### versionPins

**v8.6.0+ (D8).** Emit a compact `## versions (installed direct deps)` block in the generated context header, listing the installed version of each **direct** dependency as `name@version` — resolved from `node_modules` (JS/TS) and the venv `site-packages` (Python), versions only, no symbol parsing. This lets an agent reading `CLAUDE.md`/`AGENTS.md` ground its suggestions against the libraries **actually installed here** (it compounds with the [installed-library grounding](/guide/verify-ai-output) moat — e.g. "`foo()` doesn't exist in `lodash@4.17` installed here"). Byte-stable given a fixed installed tree; the list is sorted and capped. Set `false` to omit the section.

```json
{
  "versionPins": true
}
```

### exactness.typescript

**v8.36.0+ (#609, tier T2 of the host-toolchain ladder).** Opt in to true-AST TypeScript extraction using the target repo's own `typescript` package — resolved from `node_modules` upward from each file, never bundled, never required to exist. Works with the classic compiler API (the `typescript@5.x` line and earlier); `typescript@7`'s Go-native compiler exposes no stable CommonJS API and falls back to the regex tier cleanly. Every failure shape — flag off, package absent, package unusable, parse error — produces output byte-identical to the flag being off. When native extraction fires, the generated header's meta line records `toolchain=typescript@<version>`: output is deterministic per toolchain version, and the label makes that boundary visible.

```json
{
  "exactness": { "typescript": true }
}
```

### exactness.lsp

**v8.37.0+ (#612, tier T3 of the host-toolchain ladder).** One client, every LSP language: a synchronous, pipelined `documentSymbol` session against a server the machine already has — clangd ships with Xcode CLT; gopls and rust-analyzer are used where installed; `exactness.lspServers` maps extensions to any other server command. Results are cached in `.context/lsp-cache.json` (content hash + server binary, so a file edit or a server upgrade invalidates) and warm regenerates spawn nothing. Because a server parsing a file standalone can be macro-blind, every LSP result passes a per-file quality guard: it is accepted only when it does not lose surface versus the regex tier, with ties going to LSP for its exact anchors. Failures of any kind — no server, crash, timeout, guard refusal — fall back to the regex tier silently and leave no toolchain label.

```json
{
  "exactness": { "lsp": true, "lspServers": { ".zig": ["zls"] } }
}
```

### exactness.scip

**v8.38.0+ (#618, tier T4 of the host-toolchain ladder — the ladder's final rung).** If your CI already runs a SCIP indexer (scip-typescript, scip-java, scip-python, ...), the resulting `index.scip` holds compiler-grade signatures for every indexed file. With the flag on, SigMap parses it once per run with a zero-dependency protobuf wire reader and serves those signatures — typed by the compiler, anchored by definition occurrences — wherever they do not lose surface versus the regex tier (the same per-file guard the LSP tier uses). No index, a corrupt index, or an uncovered file falls back silently. Index freshness is your pipeline's concern: regenerate `index.scip` alongside your builds.

```json
{
  "exactness": { "scip": true }
}
```

### terse

**v8.11.0+ (D7).** Opt-in deterministic compaction of the generated signature block: `function `→`fn `, `async function `→`async fn `, tightened parameter/arrow/exports spacing. The `:start-end` line anchor and any trailing doc hint are preserved **byte-exactly**, so `get_lines`, evidence packs, and symbol extraction keep working, and the ranker parses terse context files unchanged. When off (the default), output is byte-identical to previous releases. The reduction is measured, not claimed: `npm run benchmark:terse` reported **−16.1%** signature tokens on the SigMap repo itself (10,232 → 8,580 across 143 files).

```json
{
  "terse": true
}
```

```
### src/app.js
exports={fetchUser,formatUser}  :7-7
async fn fetchUser(id,opts={})  :1-3
fn formatUser(user,style)  :4-6
```

Check cache health with:

```bash
sigmap --health
```

Output will include cache stats:
```
sig-cache       : 142 entries, 1.2 KB
```

Use `sigCache: true` for large repositories where signature extraction is slow, or when you run generation frequently.

## .contextignore

Use a `.contextignore` file (gitignore syntax) to exclude files and directories from the index. Run `sigmap --init` to generate a starter file.

```bash
# test files
**/*.test.*
**/*.spec.*
*_test.*

# build output
dist/
build/
src/generated/
coverage/
node_modules/

# generated files
*.pb.*
*.generated.*
```

The `.contextignore` file uses the same gitignore syntax as `.repomixignore`. Symlink them to share a single exclusion list:

```bash
ln -s .contextignore .repomixignore
```


---

<div style="text-align:center;margin-top:2.5rem;padding-bottom:.5rem;font-size:0.85em;color:var(--vp-c-text-3)">
  Made in Amsterdam, Netherlands <span title="Netherlands">🇳🇱</span>
</div>
