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

### What SigMap writes into an existing file

`CLAUDE.md`, `AGENTS.md`, `.github/copilot-instructions.md` and `.github/gemini-context.md` are yours first. SigMap appends its block under a `## Auto-generated signatures` heading followed by `<!-- Updated by gen-context.js -->`, and on every later run replaces **only** that block — everything above it is left byte for byte as you wrote it.

| What the file contains | What a run does |
|---|---|
| No marker yet | Appends the block at the end |
| The heading and stamp as two consecutive lines (outside any code fence) | Replaces from that heading to the end of the file. If it appears more than once, the last one is the section |
| The marker mentioned in a sentence, or quoted in a fenced code block | Nothing special — a mention is not the marker, and the text after it is kept |
| A heading with the same title but no stamp | Replaced only when a SigMap-generated block follows it. Otherwise your section is kept, a new one is appended after it, and a warning names the line |
| A file that is a generated block from its first line, with no marker | Replaced whole (the pre-marker format) |

Anything you add *below* the generated block is regenerated away; put your own notes above the marker. Releases before v8.65.1 matched the first mention of the marker anywhere in the file and discarded everything after it, so a file that had quoted the marker may have been cut short; the next run repairs its structure, but the lost text is not recoverable unless the file was tracked.

## Prompt-cache layout

A provider's prompt cache matches on an exact prefix: the first byte that differs ends the hit, and everything after it is billed as new input. SigMap therefore writes every context file as a **stable body, then an invisible `<!-- sigmap:volatile -->` marker, then the volatile tail**:

| Stable (before the marker) | Volatile (after the marker) |
|---|---|
| usage guidance, `## deps`, version pins, `## todos`, the signature body, the omission notice | `## recent changes (<branch>@<commit>)`, `--diff` output, model-routing hints, the `Updated:` stamp |

A new commit then changes only the tail, so the signature body stays a cache hit. This is on by default (`cacheLayout: "stable-prefix"`); set `"legacy"` to restore the old order. No written file carries a relative age ("5 minutes ago") in either layout — it is false the moment the file is written.

`--format cache` writes `.github/copilot-instructions.cache.json` as an Anthropic `system` array: block 1 is the stable body carrying `cache_control` (with `"ttl": "1h"` when `cacheTtl` is `"1h"`), block 2 is the volatile tail with none.

### Cache economics

Verified against Anthropic's prompt-caching page on 2026-10-04:

| | 5m TTL | 1h TTL |
|---|---|---|
| Cache write | 1.25× base input price | 2× base input price |
| Cache read | 0.1× (lower on some models, e.g. 0.05× on Opus 5.5) | same |
| Break-even | the 2nd request | the 3rd request |

Caching is not free: a 1h write across only two requests costs 2 + 0.1 = 2.1× against 2× uncached. Anthropic honours up to four cache breakpoints per request, and a prefix below the model's minimum cacheable length is silently not cached. OpenAI and Gemini cache automatically on an exact-prefix match with no opt-in, so the same stable-first ordering helps them too; neither needs `--format cache`.

### Fit check

`sigmap --report` and `sigmap --format cache` compare the stable prefix against each model's minimum cacheable length, read from the [model profile](#models) (`cacheMin`; override it per model under `models.cacheMin`). SigMap counts characters, not tokens, so a prefix within ±15% of a minimum is reported as `borderline — verify with a provider token counter` rather than given a verdict. `--report --json` carries the same rows under `cacheFit`. Models with no verified `cacheMin` are left out, and the `legacy` layout has no stable prefix to measure, so it reports none.

## Token budget

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `autoMaxTokens` | `boolean` | `true` | Auto-scale the token budget based on repo size. Set `false` to use your pinned `maxTokens` — see [the interaction](#maxtokens-vs-automaxtokens) below. |
| `coverageTarget` | `number` | `0.80` | Target fraction of source files to include (0.0–1.0). Default: 80%. |
| `modelContextLimit` | `number` | `128000` | Model context window size in tokens. Hard cap = `modelContextLimit × maxTokensHeadroom`. Left unset, a declared [`models.roster`](#models) can lower it to the roster's smallest window. |
| `maxTokensHeadroom` | `number` | `0.20` | Fraction of the model context reserved for SigMap output. Default 0.20 = 25 600-token cap for 128K models. |
| `maxTokens` | `number` | `6000` | Used only when `autoMaxTokens: false`, or as a minimum floor. Pinning it while `autoMaxTokens` is on now prints a notice — see [the interaction](#maxtokens-vs-automaxtokens). |

**Formula:** `effective = clamp(ceil(totalSigTokens × coverageTarget), 4000, floor(modelContextLimit × maxTokensHeadroom))`

When the hard cap prevents hitting the coverage target by more than 10 percentage points, SigMap prints a warning and suggests switching to `strategy: "per-module"`.

The budget is a **total**, not a signatures-only allowance (v8.51.8). Every context file carries a fixed preamble — the adapter header, the `## SigMap commands` block, the coverage line and the budget disclosure — and that cost is reserved before any file is admitted, so the emitted file stays at or under the effective budget rather than exceeding it by the size of the preamble. Note this is the *effective* budget: with `autoMaxTokens: true` (the default) the scaler may legitimately raise the target above `maxTokens`, so pin `autoMaxTokens: false` if you need `maxTokens` itself to be the ceiling.

To pin a fixed budget (v4.0 behaviour):
```json
{ "autoMaxTokens": false, "maxTokens": 6000 }
```

### `maxTokens` vs `autoMaxTokens`

`autoMaxTokens` is **on by default**, and when it is on it overrides a pinned `maxTokens`. That is intended — but until **v8.54.2** it happened in silence (#783). Setting `{"maxTokens": 500}` and running `sigmap` left no trace beyond the word `auto-scaled` in the coverage line; the explanation existed only inside the `--report` renderer, which is not the path most people run.

Since v8.54.2 the notice prints once, on **every** path:

```
[sigmap] note: autoMaxTokens is active — your maxTokens:500 config was overridden by auto-scaled budget (4000)
  to use your value, set "autoMaxTokens": false in gen-context.config.json
```

The same fix removed a false positive in the other direction. The old check compared the **merged** `maxTokens`, so a project that had never configured a budget was told *"your maxTokens:6000 config was overridden"* — `6000` being SigMap's own default. The loader now records which keys the project actually set, and the notice speaks only about a pinned value.

- **Nothing pinned** → budget auto-scales, **no notice** — nothing of yours was overridden.
- **A pinned budget, auto-scaling on** (the default) → budget auto-scales, and the **notice prints**, naming your value.
- **A pinned budget with `autoMaxTokens` set to `false`** → your value is the ceiling, **no notice**.

## Models

**v8.63.0.** SigMap ships one dated table of model names, input prices, context windows and cache minimums (`src/config/models.js`). It is the only source behind `--suggest-tool`, the routing section, `gain`, `--cost` and the cost line of `ask`, so a name one command prints is always a name another accepts. The `models` namespace lays your own values over it — **your value wins, per model and per field**, and everything you leave unset keeps the shipped figure.

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `models.asOf` | `string\|null` | `null` | The `YYYY-MM-DD` date you verified your figures. Replaces the shipped profile date wherever it is printed, and is what `sigmap doctor` measures staleness from. |
| `models.roster` | `string[]` | `[]` | The models you actually have (your Copilot picker, your API keys). When set, `--suggest-tool` and the routing section name **only** these. Aliases such as `claude-sonnet` are accepted. |
| `models.prices` | `object` | `{}` | `{ "<model>": <USD per 1M input tokens> }`. Overrides a shipped price or prices a model SigMap does not ship. |
| `models.windows` | `object` | `{}` | `{ "<model>": <context window in tokens> }`. |
| `models.cacheMin` | `object` | `{}` | `{ "<model>": <minimum cacheable prefix in tokens> }`. |
| `models.charsPerToken` | `object` | `{}` | `{ "<model>": <characters per token> }`. SigMap counts characters; without a factor a token count is the chars/4 estimate and is labelled `est.`. |
| `models.tiers` | `object` | `{}` | `{ "<model>": "fast" \| "balanced" \| "powerful" }`. The tier a model is advised for. A model with no tier is priced but never named as advice. |

```json
{
  "models": {
    "asOf": "2026-10-04",
    "roster": ["claude-sonnet-5-5", "claude-haiku-4-5", "house-coder"],
    "prices": { "house-coder": 0.4 },
    "windows": { "house-coder": 32000 },
    "tiers": { "house-coder": "fast" }
  }
}
```

**The date is part of every answer.** Each output that prints a model name or a price also prints `as of <date>` and whether that date is the shipped profile's or yours. SigMap never fetches prices — not even opt-in — so the date is the only freshness signal there is. `sigmap doctor` warns once the profile in force is more than **90 days** old; clear it by checking your vendors' pricing pages ([Anthropic](https://platform.claude.com/docs/en/about-claude/pricing), [OpenAI](https://developers.openai.com/api/docs/pricing), [Google](https://ai.google.dev/gemini-api/docs/pricing)) and setting `models.asOf`, or by upgrading SigMap.

**A figure SigMap did not verify is left unset, not guessed.** The shipped table carries a context window only where the vendor's own page stated one on the profile date; run `sigmap gain --models` to see what is priced.

**Roster and the token budget.** With a roster declared and `modelContextLimit` not set, the auto-budget cap uses the smallest *known* roster window when that is **smaller** than the default limit — a context file has to fit the smallest model that will read it. A roster never raises the cap: declaring a 1M-window model is not a request for a larger always-on file. An explicit `modelContextLimit` always wins.

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
| `secretScan` | `boolean` | `true` | Scan output for 15 credential patterns before writing. Matching content is replaced with `[REDACTED]`. Patterns: AWS keys, GitHub tokens, JWTs, database URLs, SSH keys, GCP keys, Stripe keys, Twilio keys, Slack tokens/webhooks, OpenAI and Anthropic keys (v8.54.1), generic passwords/api_keys. The unquoted `password=value` variant is text-only and applies to [`redact`](/guide/cli#redact), not to signature scanning. |
| `monorepo` | `boolean` | `false` | See Source scanning above. |
| `sigCache` | `boolean` | `false` | Enable incremental signature cache. When true, caches extracted signatures with mtime-based validation. Cache is automatically busted on version changes. Skips re-extraction of unchanged files for faster subsequent runs. |
| `sessionBudgetTokens` | `number\|null` | `null` | Opt-in per-session budget for **estimated SigMap-emitted tokens** (chars/4). When set, [`sigmap budget`](/guide/cli#budget) and the MCP `get_budget` tool report remaining tokens, percent used, and an over-budget flag. Counts only what SigMap outputs — not the host chat's total spend. |
| `contextTtlDays` | `number\|null` | `null` | Opt-in staleness threshold: when the newest generated context file is older than this many days, `budget`/`get_budget` flag it `STALE` and advise re-running sigmap. |
| `format` | `"default"\|"cache"` | `"default"` | Output format. `"cache"` additionally writes an Anthropic prompt-cache JSON payload beside the markdown — a `system` array of a cached stable block and an uncached volatile tail. See [Prompt-cache layout](#prompt-cache-layout). |
| `cacheLayout` | `"stable-prefix"\|"legacy"` | `"stable-prefix"` | Where volatile content sits in every written context file. `"stable-prefix"` puts the signature body first and everything that changes per commit after it; `"legacy"` keeps the previous order (recent changes ahead of the signatures). See [Prompt-cache layout](#prompt-cache-layout). |
| `cacheTtl` | `"5m"\|"1h"` | `"5m"` | TTL on the cached block `--format cache` writes. Exactly `"5m"` or `"1h"`; any other value warns and falls back to `"5m"`. |
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
| `changes` | `boolean` | `true` | Append a recent git summary, `## recent changes (<branch>@<commit>)`, showing files changed in the last `changesCommits` commits. Identified by commit, never by relative age. |
| `changesCommits` | `number` | `10` | Number of recent commits analyzed for the `changes` section. |
| `versionPins` | `boolean` | `true` | Append two dependency sections: `## versions (installed direct deps)` (JS from `node_modules`, Python from the venv `site-packages`) and, since v8.51.7, `## dependencies (declared — <ecosystems>)` read from the manifests, which covers every supported ecosystem and works with nothing installed. See [versionPins](#versionpins). |
| `terse` | `boolean` | `false` | Deterministic terse encoding of the signature block (`function `→`fn `, tightened params/arrows/exports). Line anchors and doc hints are preserved byte-exactly. Measured −16.1% signature tokens on the SigMap repo (`npm run benchmark:terse`). Also available at runtime as the `--terse` flag. See [terse](#terse). |
| `testCoverage` | `boolean` | `false` | Annotate each function signature with `✓` (tested) or `✗` (untested). Can also be set at runtime via the `--coverage` flag without editing this file. |
| `testDirs` | `string[]` | `["tests","test","__tests__","spec"]` | Directories scanned to build the test index when `testCoverage` is enabled. |
| `retrieval.topK` | `number` | `10` | Number of top-ranked files returned by `--query` and the `query_context` MCP tool. |
| `retrieval.recencyBoost` | `number` | `1.5` | Multiplier applied to recently committed files during TF-IDF ranking. |
| `retrieval.callGraphBoost` | `boolean` | `false` | **v8.15.0, opt-in.** Boost files call-graph-connected to query matches in `ask`/`--query`/`query_context` — catches Go/Java same-package relations that have no import edge. Measured on the 90-task A/B: **+0 hit@5 delta**, so it stays off by default; enable it on call-topology-heavy repos and check the `callGraphBoost` signal in `--query --json`. Re-measure with `npm run benchmark:callgraph-boost`. |
| `retrieval.surfaceEnrichment` | `boolean` | `false` | **Deprecated — removal planned for v9.0** (opt-in since v8.18.0). Append `route METHOD /path` pseudo-signatures to the rankable index so route-worded queries can match controllers whose signatures never mention the path (Express/Fastify/NestJS/Flask/FastAPI/Gin/Spring). It measured no net benefit on any of the five benchmark corpora — it won one task and lost one on the third-party corpus, which is the only place route-worded questions exist — and it adds pseudo-signatures to the index, so it does not earn its keep. Setting it still works and warns once per process. The figures and the rule behind the verdict are in [the retrieval benchmark](/guide/retrieval-benchmark#the-opt-in-ranking-signals). |
| `retrieval.centralityBlend` | `boolean` | `false` | **Deprecated — removal planned for v9.0** (opt-in since v8.21.0). Blend import-graph centrality (zero-dep power iteration over the forward dependency graph) into `ask`/`--query`/`query_context` ranking as a small additive prior (`0.3 × centrality`) on positively-scored files only. It measured no net benefit on any of the five benchmark corpora: it barely moves a rank, and the one hit it changes is a loss. Setting it still works and warns once per process. The figures and the rule behind the verdict are in [the retrieval benchmark](/guide/retrieval-benchmark#the-opt-in-ranking-signals). |
| `retrieval.minedExpansions` | `boolean` | `false` | **v8.48.0, opt-in (B2).** Repo-mined query expansion: tokens co-occurring within the same file's path + signature vocabulary become weighted synonyms for `ask`/`--query`/`query_context` — "auth" ↔ "session" learned from *this* repo, deterministic and cached at `.context/mined-expansions.json`. Precision filters: document-frequency floor/ceiling, minimum co-occurrence, top-4 neighbors, static-synonym pairs excluded; mined weight never exceeds the curated synonym weight. Measured on the full 299-task A/B including the leak-free hard split: cross-repo corpus **hit@5 89.5% → 90.5%** (fastify +1) and JVM +1 (akka), but the **hard split regressed 67/90 → 66/90** and overall MRR fell 0.562 → 0.559 — the hit@5-only trap in person, so the default stays off. Enable it on sparse-context repos (few signatures per file), where the measured wins live; dense-vocabulary repos mine too broad a surface. Re-measure with `npm run benchmark:mined-expansions`. |
| `retrieval.bodyWords` | `boolean` | `false` | **Opt-in.** Index each file's *body words* — the rare words of its source that its signatures drop — into the ranking, so a question in the words the code uses to do something can reach the file that does it even when no signature says them. A word counts when no more than 5% of the files hold it and the file's own index entry lacks it; each file keeps its 200 best. Read by `ask`, `--query` and `query_context`, cached at `.context/body-words.json` (rebuilt whenever `sigmap` regenerates the index), and never added to the generated context or to anything rendered into a prompt. The figures, the parameter sweep and the rule that would make it a default are in [the retrieval benchmark](/guide/retrieval-benchmark#body-words). |
| `exactness.typescript` | `boolean` | `false` | **v8.36.0, opt-in.** Parse `.ts` with the **target repo's own** `node_modules/typescript` (the user's install — nothing is bundled) for true-AST signatures: exact anchors across multiline declarations, constrained generics, and the typed arrow consts regex cannot see. Silent, byte-identical regex fallback when the flag is off, no typescript resolves, or the resolved package has no compiler API (typescript@7's Go-native compiler is rejected by design — its path is the future LSP tier). When native extraction fires, the generated header carries `toolchain=typescript@<version>`, so byte-stability is stated per toolchain version. Measured +54% signatures on zod with typescript@5.9.3, 0 parse failures. See [exactness.typescript](#exactness-typescript). |
| `exactness.lsp` | `boolean` | `false` | **v8.37.0, opt-in.** Ask a language server already on the machine (clangd/gopls/rust-analyzer) for `documentSymbol` per file — server-typed details and exact multiline ranges, cached across runs by content hash + server binary. A per-file quality guard accepts the LSP result only when it does not lose surface vs the regex tier (a server parsing standalone can be macro-blind), so the tier is strictly non-losing. Header labels `toolchain=<server>@<version>` when used. Measured with clangd: libuv +37%, spdlog +15% effective signatures. See [exactness.lsp](#exactness-lsp). |
| `exactness.scip` | `boolean` | `false` | **v8.38.0, opt-in.** Read a CI-produced `index.scip` at the repo root as a signature source (import only): compiler-typed signatures with definition-occurrence anchors, parsed by a zero-dep protobuf reader. Same per-file never-lose-vs-regex guard as the LSP tier; header labels `toolchain=scip:<tool>@<version>` on acceptance. Measured on zod: +590% effective signatures. See [exactness.scip](#exactness-scip). |
| `exactness.lspServers` | `object` | `{}` | Extension → command-array overrides laid over the built-in server registry, e.g. `{ ".rs": ["rust-analyzer"] }`. Commands are spawned directly with an argument array — never a shell. |
| `judge.threshold` | `number` | `0.25` | **v8.45.0 (J2).** Verdict pass/fail floor for [`sigmap judge`](/guide/cli#judge): groundedness below this fails. The `--threshold` flag overrides the config value. |
| `judge.learnBoostAbove` | `number` | `0.75` | **v8.45.0 (J2).** With `--learn`, context files are boosted when the groundedness score exceeds this bound. See [judge](#judge) for how the default is derived. |
| `judge.learnPenalizeBelow` | `number` | `0.40` | **v8.45.0 (J2).** With `--learn`, context files are penalized when the score falls below this bound; scores between the two bounds neither boost nor penalize. |

### judge

**v8.45.0 (J2).** The [`sigmap judge --learn`](/guide/cli#judge) feedback loop boosts or penalizes context-file weights based on the groundedness score. The band was previously hardcoded; these keys make it tunable per repo, and the defaults are **measured, not hand-picked**: answers built from ≥ ~80% context-grounded vocabulary score above `learnBoostAbove`, answers under ~30% grounded score below `learnPenalizeBelow` — verified by a drift-guard test that constructs exact-ratio mixtures from the repo's own signature vocabulary and pins the band ordering (`0 < learnPenalizeBelow < learnBoostAbove < 1`). Tighten the band (e.g. `0.85`/`0.30`) to make learning more conservative on noisy corpora. **v8.54.0** rewrote the scorer ([technical content, not English](/guide/cli#judge)) and the same drift-guard re-verified these defaults against it — the 80%/30% mixtures still land either side of the band, so the values are unchanged. An `inconclusive` verdict never triggers learning at all.

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

**v8.51.7** adds a second block, `## dependencies (declared — <ecosystems>)`, read from the manifests rather than the installed tree. The installed block can only ever describe npm and Python, because those are the ecosystems whose versions are resolvable from disk — so a Maven, Go, Cargo, Gem or Composer project previously got nothing at all, and an npm project that had not run `npm install` got nothing either. The two are labelled separately rather than merged because they are different claims: "what the manifest asks for" and "what is installed here". The installed one is the stronger evidence, so it still leads. The heading names the ecosystems it covers, so the claim is checkable. Setting `versionPins: false` suppresses **both** sections.

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
