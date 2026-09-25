# Contributors

SigMap is built by a great community of contributors. Thank you to everyone who has helped!

## Core Contributors

- [manojmallick](https://github.com/manojmallick) — Core architecture, graph builder, impact analysis, release management
- [Claude Code](https://claude.ai/code) — AI-assisted development, code generation, testing
- [ContextForge](https://github.com/contextforge) — Integration, adapters, multi-framework support

## Feature Contributors

- [David Schoch](https://github.com/schochastics) — GDScript extractor, language support
- [Sean Campbell](https://github.com/) — Framework detection, configuration
- [Denis Solonenko](https://github.com/dsolonenko) — GDScript extractor (#146)
- [Matt Van Horn](https://github.com/mvanhorn) — Testing, reliability improvements
- [kumamaki](https://github.com/kumamaki) — Bug fixes, improvements
- [Tung Lam](https://github.com/tunglambk) — Secret redaction (#668); docs-nav coverage guard (#700); config-reference drift gate (#708)
- [rudi193-cmd](https://github.com/rudi193-cmd) — Hot-cold cold signatures in the bundled MCP server (#201); Python AST extractor wired into the shipped pipeline (#693)

## Supporters

- **SigMap Bot** — Release automation, version management
- Community members — Bug reports, feedback, discussions

## Contribution Attribution

When you contribute to SigMap, your GitHub account will appear in the [contributors graph](https://github.com/manojmallick/sigmap/graphs/contributors) if:
- Your commit author email is linked to your GitHub account profile
- You make commits using that email address

To ensure proper attribution:
1. Link your email to your GitHub account: https://github.com/settings/emails
2. Configure git locally: `git config user.email your-github-email@example.com`

## How to Contribute

We welcome contributions! See [Contributing](./docs/CONTRIBUTING.md) for guidelines.

### Recent Contributors (v8.51.3)
- **@manojmallick** — fix(benchmarks): the suites that only *read* the shared benchmark corpus were rewriting it — one quality-suite run changed 42 of 86 tracked artifacts, so the published hit@5 depended on which suite ran last. #522 had restored the config but not the generated context, and #480 restored the markdown adapters but not `.context/sig-index.json`, the index the ranker actually reads. One shared snapshot/restore primitive now owns the whole artifact set, and the determinism gate — which existed and worked but nothing ran — is wired into CI (#706, PR #729)

### Recent Contributors (v8.51.2)
- **[@tunglambk](https://github.com/tunglambk)** (Tung Lam) — docs(nav): `methodology.md` shipped and built but nothing linked to it, so the page explaining how the benchmarks are produced was reachable only by typing the URL; linked from the sidebar and the five benchmark pages, plus a coverage guard that derives pages-on-disk and sidebar-links independently so the next orphaned page fails CI (#700, PR #724)
- **[@tunglambk](https://github.com/tunglambk)** (Tung Lam) — docs(config): the config reference documented three keys that exist nowhere in the source and omitted keys `loadConfig` actually reads; every key now derives from `DEFAULTS` and a drift gate fails in both directions (#708, PR #725)
- **[@rudi193-cmd](https://github.com/rudi193-cmd)** — fix(python): `python_ast.py` was tested and documented as Tier 1 but nothing in the shipped pipeline ever passed it a file path, so every Python file in production silently used the regex tier; paths are now threaded through `extractFile` and the script resolves from both dev and packaged layouts (#693, PR #726)

### Recent Contributors (v8.51.1)
- **@manojmallick** — fix(extractors): mixin-composed classes (`extends Mixin(LitElement)`) and indented classes were dropped entirely — 111 of 326 classes on ing-bank/lion — because the class regex matched the heritage clause inline and was anchored to column 0; both extractors now walk to the body brace. Also closed a TS/JS asymmetry that silently shed every `get`/`set` accessor from TypeScript classes
- **@manojmallick** — test(discovery): source-root coverage gate, so detection returning almost nothing fails loudly instead of passing every existing check

### Recent Contributors (v8.51.0)
- **@manojmallick** — fix(discovery): multi-module JVM builds indexed almost nothing (okhttp 4 files of 596, akka 29 of 2,651) because module source lives four levels deep and the candidate scan looked two; module source sets are now enumerated structurally, and Kotlin Multiplatform sets (`jvmMain`, `commonMain`, `androidMain`) are discovered rather than assumed to be `main` (PR #721)

### Recent Contributors (v8.50.1)
- **@manojmallick** — fix(extractors): the v8.50.0 CI/pipeline extractor was wired into `langFor` but not into file discovery, so `.github/workflows/` — a root dotdir never in `srcDirs` — was never walked and the feature did nothing in real use; `collectPipelineEntries` now indexes CI definitions the same way test files are indexed (PR #717 follow-up)

### Recent Contributors (v8.50.0)
- **@manojmallick** — feat(extractors): semantic CI/pipeline extractor — a GitHub Actions workflow reduced to `keys: [name, on, jobs]` plus bare job ids with no triggers, steps, secrets or line anchors; now parsed structurally across nine CI formats with real `:start-end` anchors, routed by path ahead of the extension map (#3, PR #717)
- **@manojmallick** — feat(deps): dependency inventory across nine ecosystems — `pom.xml (maven) | present` replaced with real coordinates, Maven `${property}` placeholders resolved, and a locked lockfile version preferred over a declared range (#2a, PR #717)
- **@manojmallick** — feat(strategy): opt-in `strategy: "index"` — the always-on context file becomes a ~377-token map and every signature moves to `.context/sig-index.json`, cutting this repo's always-on cost from ~13,892 tokens and unsuppressing `sigmap ask` (#1a, PR #717)
- **@manojmallick** — feat(deps): deterministic CycloneDX 1.5 SBOM export and `sigmap deps`, deliberately stopping short of a CVE feed so byte-reproducibility holds and osv-scanner/Dependabot own the scanning (#2c', PR #717)

### Recent Contributors (v8.49.2)
- **@manojmallick** — fix(cli): an unrecognized subcommand fell through the dispatch chain onto the default generate path and silently rewrote `AGENTS.md`/`CLAUDE.md`/copilot/gemini context files with exit 0; a `KNOWN_COMMANDS` guard now rejects it before any dispatch, with a levenshtein-2 suggestion (#655, PR #710)
- **@manojmallick** — fix(cli): `--report --json` documented "exits 1 if over budget" but the dispatch tail's `process.exit(0)` clobbered `process.exitCode`, so every CI job trusting that contract was silently green; the gate now covers text and JSON alike via `exitWithCode()` (#656, PR #710)
- **@manojmallick** — fix(learn): weight decay multiplied toward 0 instead of the documented neutral 1.0, so penalties deepened forever and boosts crossed into penalty territory; decay now converges on `BASELINE` from both directions and prunes near-neutral entries (#657, PR #710)
- **@manojmallick** — fix(graph): lowercased graph keys made `--impact` and `plan` render paths that climbed out of cwd on every macOS checkout; graphs now carry `realPaths` and every display surface renders through one `displayPath()` helper (#658, PR #710)
- **@manojmallick** — fix(cli): `compare` spawned the install-anchored 21-repo benchmark unconditionally and crashed outside the source checkout after ~30–60s; it now probes for the corpus and falls back to local benchmark history, with `--run` to demand the live comparison (#659, PR #711)
- **@manojmallick** — fix(cli): `validate` reported 218% coverage by dividing two different populations; coverage is now an intersection bounded at 100%, with `notIndexed` and `staleEntries` surfaced separately (#660, PR #711)
- **@manojmallick** — fix(docs): twelve dispatched commands were missing from `--help` and four `cli.md` claims had drifted; added all twelve plus a drift gate that derives the vocabulary from the dispatch chain itself, which immediately caught `explain`/`run`/`sync` missing from `cli.md` (#661, PR #711)

### Recent Contributors (v8.49.1)
- **[@tunglambk](https://github.com/tunglambk)** (Tung Lam) — fix(security): `sigmap redact` now masks unquoted `.env`/YAML secret values (`password=…`, `api_key: …`), not just quoted ones — first external contribution (#668, PR #671)
- **@manojmallick** — fix(security): regression fix for v8.49.0 — the widened Generic Secret pattern is `textOnly` and skipped by the signature scanner, so type annotations (`password: PasswordHasher`) are no longer redacted out of generated context; `sigmap redact` keeps the full fix above (#680, PR #681)

### Recent Contributors (v8.49.0)
- **@manojmallick** — feat(judge): J4 confidence + explainability — per-claim grounding routes (`context`/`repo`/ungrounded) with EP-style coverage, and a deterministic auditable `confidence: { level, basis }` on every verdict; human output gains Confidence + Claims lines, JSON additions fully additive (#653, PR #654)

### Recent Contributors (v8.48.0)
- **@manojmallick** — feat(retrieval): B2 repo-mined query expansion — per-repo co-occurrence synonyms with precision filters and an mtime-keyed cache, opt-in via `retrieval.minedExpansions`; measure gate extended to all 23 corpora (299 tasks), verdict recorded: cross-repo positive, hard split negative, default off (#649, PR #650 + #651)

### Recent Contributors (v8.47.0)
- **@manojmallick** — feat(java): G4 increment 3 — Java extractor migrated to the balanced-scanner core (string-safe comments, masked brace counting, annotation-arg params, nested generic bounds) with the modern-Java surface: generic type names, records, sealed types, implicit-public interface methods; fixture parity byte-exact, retrieval gate PASS (#646, PR #647)

### Recent Contributors (v8.46.0)
- **@manojmallick** — feat(go): G4 increment 2 — Go extractor migrated to the balanced-scanner core (nested func params, generics, generic receivers, string-safe comments; fixture parity byte-exact) and Go joins arity-checked verification (`.go` in EXACT_PARAM_EXTS, type-variadic parsing, go blocks in the guard filter); retrieval gate PASS (#643, PR #644)

### Recent Contributors (v8.45.0)
- **@manojmallick** — feat(judge): the judge-convergence tranche — J1 structural claim grounding via the verify engine (`checks` summary field, repo + installed-lib symbols ground at the judge surface, cwd-less behavior byte-identical) and J2 configurable learning thresholds with mixture-corpus-derived, drift-guarded defaults (#638, PR #639; #640, PR #641)

### Recent Contributors (v8.44.0)
- **@manojmallick** — feat(evidence): knowledge map increment 4 — evidence packs re-based as views over the store: `relatedTestsView` over tests edges, byte-identical `buildEvidencePack` (contextHash parity pinned), `buildPrEvidence` blast + related tests from the cached store without per-call index/graph rebuilds; plus the case-sensitive-fs fix keeping graph-only file nodes in context-less stores (#635, PR #636)

### Recent Contributors (v8.43.0)
- **@manojmallick** — feat(map): knowledge map increment 3 — get_impact and get_architecture_overview re-based as views over the cached store with BFS parity pinned, tests/routes enriched from typed edges, honest route counts, tokens on file nodes, SCHEMA_VERSION 3 (#632, PR #633)

### Recent Contributors (v8.42.0)
- **@manojmallick** — feat(map): knowledge map increment 2 — env-var/migration/script nodes with per-file reads-env edges from structured producer collectors, the `{ env }` query on query_knowledge_map, SCHEMA_VERSION 2, and the NUL-delimiter escape fix that makes the store source git-diffable text (#629, PR #630)

### Recent Contributors (v8.41.0)
- **@manojmallick** — feat(map): unified knowledge map, increment 1 of #543 — typed nodes/edges over the existing signature, graph, library, and route sources with canonical NUL-delimited serialization and an mtime-keyed cache, plus the `query_knowledge_map` MCP tool (22nd) answering upgrade-impact / neighbors / summary (#626, PR #627)

### Recent Contributors (v8.40.0)
- **@manojmallick** — feat(extractors): Elixir Tier 3 with resolving alias/import graph edges (#538, PR #623) and Astro SFC via TS-extractor delegation (#539, PR #624), completing the #541 ranked build list at 35 languages; fix: the drifted CLI resolution map deleted — Lua and GDScript had been silently falling to the generic fallback in the generate pipeline

### Recent Contributors (v8.39.0)
- **@manojmallick** — feat(extractors): web-component surface — Lit tags + reactive fields, Angular selectors + inputs/outputs, vanilla customElements.define, with byte-identity for non-component code verified across 1,291 real files (#537, PR #621)

### Recent Contributors (v8.38.0)
- **@manojmallick** — feat(scip): read-only SCIP import behind exactness.scip — zero-dep protobuf reader, compiler-typed signatures from CI-produced index.scip, per-file never-lose-vs-regex guard; +590% effective signatures on zod, completing the #542 host-toolchain ladder (#618, PR #619)

### Recent Contributors (v8.37.1)
- **@manojmallick** — perf(extractors): linear buildReturnHints — full generate 15s → 0.97s, CI suite wall-time halved, and 13 silently mis-bound @returns hints corrected along the way (#615, PR #616)

### Recent Contributors (v8.37.0)
- **@manojmallick** — feat(lsp): zero-dep synchronous LSP client — documentSymbol via clangd/gopls/rust-analyzer behind exactness.lsp, per-file quality guard so the tier never loses surface to regex, content+binary-keyed cache, acceptance-gated toolchain labels; libuv +37% / spdlog +15% effective signatures with clangd (#612, PR #613)

### Recent Contributors (v8.36.0)
- **@manojmallick** — feat(extractors): T2 exactness — .ts parsed with the target repo's own typescript behind exactness.typescript, silent byte-identical regex fallback, toolchain-labeled header; +54% signatures on zod with zero parse failures, typescript@7's API-less shape rejected by design (#609, PR #610)

### Recent Contributors (v8.35.0)
- **@manojmallick** — fix(retrieval): graph-boost seeds snapshotted so rank() no longer depends on index insertion order or git history depth; hard 72.2% → 75.6% as cascade noise stopped crediting near-hub files (#596, PR #604); fix(budget): the drop order now recognises JVM test conventions and protects entry points — spring-petclinic had kept all 17 test files while dropping the application entry point and every owner template (#592, PR #605); feat(extractors): member/per-file/body-scan ceilings raised to Java parity, un-hiding 43–71% of member surface on Swift/PHP/Kotlin/Scala/C# repos with hard bit-stable at 75.6% (#576, PR #606); fix(mcp): honest protocol-version negotiation plus session-less server/discover — both @hasmcp/mcp-spec-test verdicts now conformant on what could be checked (#544, #545, PR #607)

### Recent Contributors (v8.34.0)
- **@zerone0x** — feat(extractors): Lua extractor (Tier 3) — functions, module-table methods, `require` hints and LDoc doc comments, shipped with its own fixture and expected output (#540, PR #550)
- **@manojmallick** — feat(graph): call-graph definitions for Kotlin and Scala, where the graph had been silently empty and blast radius read zero (#586, PR #602); fix(context): prune `context-*.md` splits left by a previous strategy, which were being merged into the retrieval index and steering every query (#555, PR #601)

### Recent Contributors (v8.33.0)
- **@manojmallick** — feat(context): the artifact now states what the token budget omitted, with the counts, the reason, and a pointer to `sigmap ask` — the drop warning had only ever gone to stderr (#587, PR #599); test(extractors): a fixture for every language plus a guard that fails when one is missing, which immediately found a ninth the issue had not listed (`typescript_react`) and a stale expected file causing a silent `--diagnose-extractors` SKIP (#588, PR #595); fix(routes): NestJS paths compose the `@Controller` prefix, attributed per controller (#585, PR #598); refactor(extractors): one source of truth for extractor resolution — two of three copies had drifted, and the third was missing `.gd` so gdscript was never diagnosed (#591, PR #597)

### Recent Contributors (v8.32.1)
- **@manojmallick** — fix(extractors): made the v8.32.0 disclosure claim true — removed the unreachable `vue.js` (`.vue` dispatches to `vue_sfc`), added disclosure to `.tsx`/`.properties`/`.toml`/`.md`, and cleared the eight inner caps that defeated `r.js`'s own marker (#582, #583, #584, PR #589); fix(config): JVM package layouts were mostly invisible at `maxDepth: 6` — 6 of 47 Java files on spring-petclinic — so the walk now deepens to 12 for JVM layouts only, matching the graph walk from #561 (#590, PR #593); docs: retracted the overstated v8.32.0 claim in the changelog, roadmap and GitHub release

### Recent Contributors (v8.32.0)
- **@manojmallick** — feat(bench): a gated JVM retrieval corpus, 61 leak-checked tasks mined from spring-petclinic and akka, scoring against other repos so it sits outside the feedback loop that moves the `hard` split (#575, PR #577); fix(bench): the gate reused a gitignored index, so staleness could read as a regression — every index it scores is now regenerated, JVM repos included (PR #579); fix(bench): the `hard` corpus held to its 70% floor rather than the previous run, after CI proved a one-file no-op change failed the gate (PR #579); fix(extractors): 20 extractors now disclose what their member and per-file ceilings dropped instead of truncating silently, ceilings unchanged (#576, PR #578); test(docs): a markdown guard so an unbalanced fence or stray Vue interpolation cannot break the Pages build after a tag is already pushed (#573, PR #574)

### Recent Contributors (v8.31.0)
- **@manojmallick** — fix(graph): dependency graph was empty on Maven/Gradle repos — `srcDirs` hard-coded and never read from config, plus an 8-directory walk cap (#560, PR #561); fix(graph): Java call graph discarded every `receiver.method(` call, 58% of call sites in a Spring module — receiver types now resolved from declarations, interface declarations indexed so calls have a target (#562, PR #563); feat(graph): Spring interface calls linked to their implementation, ambiguity left unresolved rather than guessed (#564, PR #565); test(graph): a JVM call-graph gate verified to fail on a simulated revert (#566, PR #567); feat(cli): `sigmap lines` — the CLI twin of `get_lines` for MCP-less environments (PR #568); chore(bench): retrieval baseline re-recorded after establishing the movement was index regeneration under a token budget, not a ranking change (PR #569)

### Recent Contributors (v8.30.0)
- **@manojmallick** — feat(skills): `sigmap-task`, an invokable prompt skill driving the full grounding loop from the CLI for MCP-less environments — installs as `/sigmap-task` for Copilot (#553, PR #554); fix(extractors): lifted three hard-coded Java caps hiding 85% of the API surface, with disclosure markers matching the JS/TS path (#551, PR #552); fix(retrieval): generated data holders demoted so they stop outranking logic, entities still retrievable by symbol (#558, PR #552); fix(mcp): `mcp install vscode` now writes VS Code's `servers` key instead of a config it silently ignores, migrating older configs (#556, PR #557)

### Recent Contributors (v8.29.0)
- **@manojmallick** — feat(retrieval): retrieval index decoupled from the prompt token budget — complete `.context/sig-index.json` written before `applyTokenBudget`; module-doc prose and test files indexed but never prompted; one shared graph key convention (`path-key.js`) after builder/call-graph diverged on case; discarded scoring signal wired in and dead intent profiles removed; penalties no longer fire on the category the query asked for; multi-label intent detection; eval runner pointed at production `rank`/`buildSigIndex`; leak-free + git-mined corpora with a CI gate (#546, PR #547)

### Recent Contributors (v8.28.1)
- **@ruurdboeke** — reported and precisely diagnosed the Python absolute-import resolution gap (silent zero-importer results in `get_impact` on `src/` layouts) with a minimal repro and root-cause walkthrough (#532)
- **@manojmallick** — fix(graph): ancestor-walk resolution for Python absolute imports (#532, PR #533); fix(retrieval): per-module context splits merged into the sig index — `ask`/`query_context` work under `strategy: per-module` (#534, PR #535)

### Recent Contributors (v8.28.0)
- **@manojmallick** — feat(verify): arity-checked verification (D1) — `arity-mismatch` detector over exact JS/TS/Python params; conservative gates (ambiguity, variadics, dotted calls); verify_suggestion + verify-ai-output inherit (#529, PR #530)

### Recent Contributors (v8.27.0)
- **@manojmallick** — feat(extractors): shared balanced scanner (`scan.js`) — JS/TS param capture depth-matched, string-aware comment strip, TS depth/quote-aware type stripping; byte-identical-or-better gated; nested-paren gap fixed for JS/TS (#526, PR #527)

### Recent Contributors (v8.26.2)
- **@manojmallick** — fix(benchmarks): cross-suite determinism — shared `config-overrides.json`, mirrored apply/restore in the quality suite, self-repo labeling, `validate:benchmark-determinism` gate (#522, PR #524)

### Recent Contributors (v8.26.1)
- **@manojmallick** — docs(trust): `KNOWN_LIMITATIONS.md` — three-tier extractor honesty table, truncation caps, verify implication; README tier label; drift-locked guard test (#520, PR #521)

### Recent Contributors (v8.26.0)
- **@manojmallick** — feat(skills): `sigmap skills list|install` — usage-maximizer + config-optimizer playbooks emitted in 5 clients' native skill/rules formats (Claude/Cursor/Windsurf/Copilot/AGENTS.md above-marker block); presence-gated, idempotent (#517, PR #518)

### Recent Contributors (v8.25.0)
- **@manojmallick** — feat(config): `sigmap tune` — deterministic config optimizer over the existing discovery stack (srcDirs pin · monorepo · adapters · exclude · autoMaxTokens), read-only by default, `--apply` merges preserving user keys, idempotent (#514, PR #515)

### Recent Contributors (v8.24.0)
- **@manojmallick** — feat(security): `sigmap redact` — standalone substring-level secret masking over files/stdin (10-pattern bank, pipe-clean stdout, `--json`); every-pattern test sweep (#511, PR #512)

### Recent Contributors (v8.23.0)
- **@manojmallick** — feat(tracking,mcp): `sigmap budget` session spend ledger (estimated SigMap-emitted tokens, optional budget, context-age TTL) + `get_budget` MCP tool (21st); `SIGMAP_SESSION` identity; opt-in `sessionBudgetTokens`/`contextTtlDays` (#508, PR #509)

### Recent Contributors (v8.22.0)
- **@manojmallick** — feat(eval,benchmarks): hard-split corpus + deterministic leakage gate (`src/eval/corpus.js`, `scripts/validate-task-corpus.mjs`) + repo-size buckets in `benchmark:honest`; 15 leak-free hard tasks; measured the hard-split ceiling (33.3% vs grep 53.3%) (#505, PR #506)
- **@octo-patch** — feat(eval): MiniMax LLM-ablation provider — `MINIMAX_API_KEY`, OpenAI-compatible endpoint, default MiniMax-M3, pricing entry + tests (PR #504)

### Recent Contributors (v8.21.0)
- **@manojmallick** — feat(extractors): Go/Rust/Java doc-comment hints (godoc/rustdoc/Javadoc first sentence as `  # <hint>` after the anchor; directives skipped, attributes tolerated, members covered) (#501, PR #502)
- **@manojmallick** — feat(retrieval): import-graph centrality rank blend — zero-dep power iteration, opt-in `retrieval.centralityBlend`, A/B measure gate `benchmark:centrality-blend` (77.8% both arms → ships off) (#501, PR #502)

### Recent Contributors (v8.20.0)
- **@manojmallick** — feat(extractors): JS/TS doc-comment hints (`  # <hint>` after the anchor, Python-parity); measured −0.9pt on the lexical corpus, shipped default-on per the anchors precedent; vocab-mismatch fixture proves the semantic bridge (#498, PR #499)
- **@manojmallick** — feat(cli): `sigmap memory` — inspect/prune the cross-session `.context/` stores, `--json`, explicit `--clear`; no new storage (#498, PR #499)

### Recent Contributors (v8.19.0)
- **@manojmallick** — feat(benchmark): honest grep-agent baseline (`benchmark:honest`) — measured 2.02× lift vs single-shot grep; 6.4×-vs-random retired from all human surfaces; task success labeled a retrieval-tier proxy; claim-hygiene guard test (#495, PR #496)
- **@manojmallick** — docs: Learning Resources page (#493, PR #494)

### Recent Contributors (v8.18.0)
- **@manojmallick** — feat(extractors): line anchors for Kotlin/Swift/PHP/Scala/Dart — 9 brace languages now anchored (#486, PR #487)
- **@manojmallick** — feat(retrieval): route surface-enrichment, opt-in `retrieval.surfaceEnrichment`, measured +0 on the A/B so default stays off; new `benchmark:surface-enrichment` gate (#488, PR #489)
- **@manojmallick** — docs: "Your agent's live loop" framing in the MCP guide + README (#490, PR #491)

### Recent Contributors (v8.17.0)
- **@manojmallick** — feat(extractors): line anchors for Java, Go, Rust, and C# — newline-preserving comment strips + brace-matched `:start-end` ranges; Evidence Pack anchorCoverage 0→1.0 on those languages (#483, PR #484)

### Recent Contributors (v8.16.1)
- **@manojmallick** — fix(bench): hermetic grounding benchmark — snapshot/restore of repo context artifacts stops cross-suite pollution (A/B 32.2% → true 87.8%); 3 regression tests (#480, PR #481)

### Recent Contributors (v8.16.0)
- **@manojmallick** — feat(evidence): Evidence Pack schema v2 — published JSON Schema, multi-factor risk labels, measured test-discovery provenance (F1 0.98, guard-tested), generator identity (#477, PR #478)

### Recent Contributors (v8.15.0)
- **@manojmallick** — feat(retrieval): call-graph ranking boost — opt-in `retrieval.callGraphBoost`, measured +0 on the 90-task A/B so the default stays off; new `benchmark:callgraph-boost` gate script (#474, PR #475)

### Recent Contributors (v8.14.0)
- **@manojmallick** — feat(graph): call-graph support for Java, Go, and Rust (GR1) — per-language def extractors, lifetime-safe Rust masker, Go/Java same-package resolution scope; all call-graph consumers inherit the languages (#471, PR #472)

### Recent Contributors (v8.13.0)
- **@manojmallick** — feat(graph): method-level blast-radius scoring (GR2) — deterministic per-file score/tier from the call graph, wired into `review-pr` findings, the PR Evidence report, and the new `get_method_impact` MCP tool (19→20 tools) (#468, PR #469)

### Recent Contributors (v8.12.0)
- **@manojmallick** — feat(wiki): `sigmap wiki` — deterministic architecture narrative from signatures + dependency graph (no LLM, byte-stable, `--json`/`--out`), closing D9, the last unstarted in-boundary master-plan item (#465, PR #466)

### Recent Contributors (v8.11.0)
- **@manojmallick** — feat(format): terse signature encoder — opt-in `--terse` deterministic compaction of the signature block, measured −16.1% on this repo via the new `benchmark:terse` measure-first gate; line anchors preserved byte-exactly, ranker parse-back regression-tested (#462, PR #463)
- **@manojmallick** — docs(readme): reliable Star History link (PR #461); 'Verified on MseeP' badge (PR #460)

### Recent Contributors (v8.10.0)
- **@manojmallick** — feat(cli): honesty fixes across the CLI surface — claim-level grounding in `judge`, NL retrieval-confidence in `validate --query`, real `plan` impact (+ depth-cap bug fix), content-based secret scan in `review-pr`, unified `gain` pricing, auditable `--health` composite, tsconfig-alias import-graph resolution, single-word `conventions` fix, diff-driven `suggest-profile`, and visible extractor truncation (#457, PR #458)
- **@mseep-ai** — docs: add the MseeP.ai security assessment badge to the README (PR #456)

### Recent Contributors (v8.9.1)
- **@manojmallick** — ci(pages): retry the GitHub Pages deploy once on GitHub's transient "try again later", so releases stop going red on a backend timing flake (CI only; package unchanged) (#451)

### Recent Contributors (v8.9.0)
- **@manojmallick** — feat(daemon): detached watch daemon — `sigmap daemon start|stop|status` runs `--watch` as a managed background process (PID + log under `.context/`), zero-dependency and shell-free (D1) (#447, PR #448)

### Recent Contributors (v8.8.1)
- **@manojmallick** — fix: close the `gen-context` determinism residual — replaced the `Date.now()` recency boost with a deterministic monotonic counter, so output is byte-stable across all 43 benchmark repos and retrieval hit@5 reproduces at 87.8%; adds a byte-equality regression guard (#440, PR #444)
- **@manojmallick** — fix(meta): count the relocated Python test in its new `test/` location; docs/CI: serve OG banner + Search Console file, run Python tests in CI; chore: repo hygiene (drop orphaned GIFs, relocate stray test)

### Recent Contributors (v8.8.0)
- **@manojmallick** — feat(mcp): expose the squeeze engine — `squeeze_output` MCP tool (18 → 19 tools) for mid-session output compression + `sigmap squeeze --response <file|->` CLI flag (D6) (#437, PR #438)
- **@manojmallick** — fix: harden `gen-context` output determinism — filePath tie-break in the token-budget drop-order, sorted source walk, and tie-broken source-root detection so the generated context is byte-stable (#440, PR #441)

### Recent Contributors (v8.7.1)
- **@manojmallick** — docs(benchmark): multi-model cost savings — quality benchmark now reports GPT-4o + Claude Sonnet + Claude Haiku input-cost savings; corrected stale Claude pricing (Haiku $0.80→$1.00, Opus $15→$5) to verified 2026-07 rates (#433, PR #434)

### Recent Contributors (v8.7.0)
- **@manojmallick** — feat(graph): method/caller-level call-graph (D4 v1) — symbol-level edges (`buildCallGraph`) + method blast radius (`methodImpact`) for JS/TS + Python, with `--callers`/`--callees` CLI (#429, PR #430)

### Recent Contributors (v8.6.0)
- **@manojmallick** — feat(grounding): Phase 1 "bank the A" — public reproducible benchmark harness (`public-benchmarks/`), installed dependency version pins in the context header (D8), and `sigmap verify` promoted to the documented grounding flagship (#425, PR #426)

### Recent Contributors (v8.5.0)
- **@manojmallick** — feat(retrieval): deterministic query expansion — curated synonym/abbreviation bridge for the BM25 ranker (auth↔authentication, db↔database, …) at a discount weight; a vocabulary-mismatch recall aid, benchmark-neutral (no hit@5 regression) (#421, PR #422)

### Recent Contributors (v8.4.0)
- **@manojmallick** — feat(review): PR Evidence Report (v9.0 G3) — branded, deterministic Markdown review artifact (signatures + blast radius + related tests + risk labels + review-pr findings); `sigmap review-pr --markdown`, CI-gateable, no LLM (#417, PR #418)

### Recent Contributors (v8.3.0)
- **@manojmallick** — feat(verify): Python site-packages grounding — extend the local-library moat (G5/D5) to venv libraries; verify AI-suggested Python code against installed packages' `__init__.py`/`.pyi` exports + versions (D8), no Python runtime (#413, PR #414)

### Recent Contributors (v8.2.0)
- **@manojmallick** — feat(mcp): `verify_suggestion` tool (18th) — expose the local-library grounding moat to agents; verify an AI code suggestion against repo + installed-library symbols before writing, with pinned versions (D8) (#409, PR #410)

### Recent Contributors (v8.1.0)
- **@manojmallick** — feat(verify): local-library signature index (v9.0 G5/D5) — verify AI suggestions against the libraries actually installed in `node_modules` (direct-dep `.d.ts` exports + D8 version pinning), the private-API grounding moat; genuine library calls stop false-flagging as fake-symbol (#405, PR #406)

### Recent Contributors (v8.0.0)
- **@manojmallick** — feat(v8.5): repo-context coverage — env-schema / build-CI / config-manifest / DB-migration map analyzers (C1); measured cross-language test discovery + reproducible benchmark, F1 98.0% / hit@1 97.4% (C2); richer precedence-ordered risk labels — migration/payment/auth/public-api (C3) (#401, PR #402)
- **@manojmallick** — docs: correct the answer-correctness multiplier badge in the comparison chart (×5.2 → ×6.8) (PR #399)

### Recent Contributors (v7.30.0)
- **@manojmallick** — feat(positioning): reposition every public surface to "the deterministic, verifiable grounding layer for AI code work" + agent recipes (v8.0 E2/E4); documents the shipped `evidence`/`doctor` commands; adds a repositioning gate (#389, PR #390)

### Recent Contributors (v7.29.0)
- **@manojmallick** — feat(mcp): one-command per-client MCP install — `sigmap mcp install <client>` + `sigmap mcp list` (v8.0 E4); creates the config when absent, idempotent, handles mcpServers / Zed / Codex shapes; `--global` scope (#385, PR #386)

### Recent Contributors (v7.28.0)
- **@manojmallick** — feat(doctor): add `sigmap doctor` (v8.0 E3) — one-shot setup diagnostic (config · context · index · freshness · coverage · MCP wiring) with actionable fixes; `--json`; CI-usable exit codes (#381, PR #382)
- **@manojmallick** — ci(sync): self-heal `develop` when the release PR merge auto-deletes it (#380)

### Recent Contributors (v7.27.0)
- **@manojmallick** — feat(mcp): add `get_diff_context` & `get_architecture_overview` MCP tools (v8.0 D3) — changed-file signatures + blast radius, and a one-call architecture map; MCP surface 15→17 (#376, PR #377)

### Recent Contributors (v7.26.0)
- **@manojmallick** — feat(evidence): Evidence Pack JSON v1 — deterministic, machine-consumable signature+evidence map (`sigmap evidence`) with JSON + Markdown handoff modes, byte-stable output, and a sha256 grounding hash (#372, PR #373)

### Recent Contributors (v7.24.2)
- **@manojmallick** — docs: surface the StarMapper stargazer map (517 stars · 37 countries) — README badge + Support link, docs community link, README-structure test (#360, PR #361)

### Recent Contributors (v7.24.1)
- **@manojmallick** — docs: publish the first measured §9 grounding result (`version.json` `ablation`) — 5×100 repo-fact tasks on Gemini: grounding cut flagged codebase-fact errors from 99.8 [99–100] to 0.2 [0–1] per 100 (factual-recall grounding)

### Recent Contributors (v7.24.0)
- **@manojmallick** — feat: redesign the §9 ablation corpus as checkable repo-fact questions (which file defines `<name>`, what params) — a wrong path is a checkable hallucination and example code is forbidden, so the metric isolates grounding instead of guard precision; ids `call-`→`fact-` (#356, PR #357)

### Recent Contributors (v7.23.0)
- **@manojmallick** — feat: robust §9 ablation — `--runs N` averaging (mean ± range) via pure `aggregateRuns`, 100-task real-symbol corpus (was 40); makes one invocation yield a statistically stable grounding number (#353, PR #354)

### Recent Contributors (v7.22.2)
- **@manojmallick** — fix: clear the last two `verify-ai-output` false-positive classes — camelCase placeholders (`myExample.js`) and documentation-placeholder imports (`@scope/utils`, `some-module`, `./local-file`); ordinary words and genuine fakes still flag; exposes the true §9 grounding delta (#350, PR #351)

### Recent Contributors (v7.22.1)
- **@manojmallick** — fix: harden `verify-ai-output` file-path extractor — skip runtime/library product names (`Node.js`, `Next.js`, …) and illustrative placeholders (`example.js`, `minimal-example.js`); genuine repo paths still flag; removes the dominant Hallucination Guard false-positive class (#347, PR #348)

### Recent Contributors (v7.22.0)
- **@manojmallick** — feat: realistic §9 ablation — real-symbol corpus (`gen-ablation-corpus.mjs`), exact-signature grounding, `--verbose` flagged items; `scoreAnswerDetail` (#344, PR #345); fix: default Gemini model → gemini-2.5-flash (#343)

### Recent Contributors (v7.21.0)
- **@manojmallick** — feat: Gemini (AI Studio) provider for the §9 LLM A/B ablation runner — auto-detected from GEMINI_API_KEY; `--provider`/`--model` flags (#340, PR #341)

### Recent Contributors (v7.20.0)
- **@manojmallick** — feat: `sigmap --init` writes a Creation workflow block into CLAUDE.md (`renderCreationWorkflowBlock` / `injectCreationWorkflow`); final IMPL item — grounded-codegen plan complete (#337, PR #338)

### Recent Contributors (v7.19.0)
- **@manojmallick** — feat: scaffold persistence — write an accepted proposal to `.context/scaffold/latest.md`; `renderScaffoldMarkdown` / `scaffoldPath`; Gap 2 §6.2 (#334, PR #335)

### Recent Contributors (v7.18.0)
- **@manojmallick** — feat: `sigmap conventions --update` — incremental rescan (refresh snapshot only when source changed); `changedSince` / `planUpdate`; completes the §4 flag set (#331, PR #332)

### Recent Contributors (v7.17.0)
- **@manojmallick** — feat: `sigmap conventions --fix` — exhaustive rename/move checklist (every offending file, full from→to paths); `buildFixList`; Layer 3 (#328, PR #329)

### Recent Contributors (v7.16.0)
- **@manojmallick** — feat: LLM A/B hallucination ablation harness (IMPL §9) — injected-completer harness (`buildGrounding` / `scoreAnswer` / `runAblation`) + live runner; offline-testable, network confined to scripts/ (#325, PR #326)

### Recent Contributors (v7.15.0)
- **@manojmallick** — feat: `sigmap conventions --ci` — CI gate on overall convention consistency (`--min`, `--no-regress`); `ciGate`; Layer 3 (#322, PR #323)

### Recent Contributors (v7.14.0)
- **@manojmallick** — feat: `sigmap conventions --report` — consistency audit + overall score + trend vs last run; `scoreReport` / `snapshot`; Layer 3 (#319, PR #320)

### Recent Contributors (v7.13.0)
- **@manojmallick** — feat: `sigmap create` — orchestrate the 4-stage grounded-creation pipeline (scaffold → verify-plan → verify-ai-output → review-pr) with n/4 numbering; `orchestrate`; Gap 2 capstone (#316, PR #317)

### Recent Contributors (v7.12.0)
- **@manojmallick** — feat: `sigmap review-pr` — diff audit (scope drift, god-node edits, missing tests, security-sensitive files); `reviewPr`; last guard stage of the create pipeline (Gap 2) (#313, PR #314)

### Recent Contributors (v7.11.0)
- **@manojmallick** — feat: `sigmap verify-plan` — check a plan against the live index (files/symbols exist, blast radius, scope) before execution; `verifyPlan`; Gap 2 grounded codegen (#310, PR #311)

### Recent Contributors (v7.10.0)
- **@manojmallick** — feat: `sigmap scaffold` — convention-matched proposal with a confidence floor (soft threshold 0.70, non-overridable hard floor 0.50); `proposeScaffold`; Layer 4 grounded codegen (#307, PR #308)

### Recent Contributors (v7.9.0)
- **@manojmallick** — feat: `sigmap conventions --inject` — write the auto-detected conventions block into CLAUDE.md (idempotent, marker-scoped); `renderConventionsBlock` / `injectConventions`; Layer 3 grounded codegen (#304, PR #305)

### Recent Contributors (v7.8.0)
- **@manojmallick** — feat: `sigmap conventions --conflicts` — per-convention breakdown (counts, bars, example files) + rename suggestions; `analyzeConflicts` / `toNamingStyle`; example-file tracking in `scoreConvention`; Layer 3 grounded codegen (#301, PR #302)

### Recent Contributors (v7.7.0)
- **@manojmallick** — feat: `sigmap conventions` — extract & report a repo's coding conventions (file naming, export style, test framework) for TS/JS/Python; reusable `scoreConvention` consistency scorer; Layer 3 grounded codegen (#298, PR #299)

### Recent Contributors (v7.0.1)
- **@manojmallick** — fix: shell-free subprocess calls (zero `execSync` in the published surface), `main` → core API, removed unused device fingerprint, star nudge counts plain `sigmap` runs (#250, PRs #251 #252)

### Recent Contributors (v6.14.0)
- **@manojmallick** — feat: `verify-ai-output` Hallucination Guard prototype — deterministic fake-file / fake-import / fake-symbol detectors, markdown + `--json`, offline (#227, PR #228)

### Recent Contributors (v6.13.0)
- **@manojmallick** — feat: line anchors for JavaScript + member-level anchors (TS & JS); index-mode token cut 4.6% → 32–42% on real repos; overhead-aware token budget (#223, PR #224)

### Recent Contributors (v6.12.0)
- **@manojmallick** — feat: Surgical Context Phase 2 — `get_lines` MCP tool, `ask --mode index`, `ask --since`, budget-aware body collapse, Token Reduction dashboard panel (#219, PR #220)
- **@manojmallick** — ci: add `workflow_dispatch` to the develop→main sync workflow (PR #218)

### Recent Contributors (v6.11.1)
- **@rudi193-cmd** — fix: include hot-cold cold signatures in the bundled MCP server (#201, PR #216)

### Recent Contributors (v6.11.0)
- Line anchors (`:start-end`) on TypeScript & Python signatures — Surgical Context Phase 1
- MCP registration with intelligent fallback to `.claude/settings.json`

### v6.10.11
- MCP cache improvements for hot/cold context indexing
- Binary build reliability with r-manifest module bundling
- npm publish workflow with automation token support
- Test assertion fixes and integration test reliability
- Documentation updates for 31 supported languages (R + GDScript)
- Cross-platform compatibility (macOS, Linux, Windows)

---

**Thank you to all contributors!** Your work makes SigMap better for everyone. 🙏
