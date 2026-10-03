# Changelog

All notable changes to SigMap are documented here.

Format: [Semantic Versioning](https://semver.org/)

---

## [Unreleased]

---

## [8.62.0] — 2026-10-03

Minor. Two languages move to Tier 2 — Objective-C and PowerShell — both contributed by @sujalmallick. The Objective-C extractor passed its fixture and its 15 tests, and was then run over 839 real `.m` / `.mm` files before release. About 11% of what it emitted there was not a declaration, so this release ships the extractor together with the review that corpus forced.

### Added
- **Objective-C Tier 2 extractor** (#841, PR #852 integrated as PR #857) — thanks @sujalmallick — dedicated anchored extraction for Objective-C (`.m`, `.mm`) and Objective-C headers (`.h`):
  - **Language constructs:** `@interface`, `@implementation`, `@protocol`, categories (`@interface Class (Category)`), `@property` declarations with attributes (`nonatomic, copy`), and instance/class methods (`-`/`+`) with multi-part selectors and balanced block argument types (`void (^)(NSError *)`). Top-level C functions and `typedef NS_ENUM`/`NS_OPTIONS` definitions are preserved with `:start-end` line anchors.
  - **Header delegation (`.h`):** `.h` remains mapped to `cpp` for reachability, but `src/extractors/cpp.js` sniffs `@interface`, `@implementation`, `@protocol`, and `#import` to delegate to `objc.extract`.
  - **MATLAB/Octave compatibility:** `.m` files with no Objective-C markers deterministically fall back to `src/extractors/generic.js`.
  - **Declaration-surface scanning:** members and C functions are read only at brace depth 0, so a body statement (`return CGRectMake(...)`, `x = a - b;`) never surfaces as a signature. Depth follows `#if` / `#else` branches and resyncs at each container and method head; forward declarations (`@protocol FooDelegate;`) open no container; method bodies anchor to their real closing brace at any length.
  - **Deterministic limits & anchors:** Container `@end` anchoring, member-level balanced masking via `scan.js`, 120 members per container cap, and 200 signatures per file cap with visible disclosure markers.
  - **Test file classification:** `src/util/file-class.js` recognizes PascalCase Objective-C test files (`FooTests.m`, `BarTestCase.mm`).
  - **Secondary registries & standalone bundle:** registered across `packages/core`, discovery, verify, config loaders, and synced into standalone `gen-context.js`.
- **PowerShell extractor (Tier 2)** (#840, PR #850) — thanks @sujalmallick — extracts `function`, `filter`, and `workflow` declarations with clean parameter names from inline or `param(...)` blocks, `[CmdletBinding()]` and `[OutputType]` attributes, doc-comment hints from `.SYNOPSIS`, PS5 classes, constructors, methods (with `hidden` filtering), enums, `Export-ModuleMember`, and `.psd1` manifest metadata. Test-file classification added for `*.Tests.ps1` (Pester). The code is in the v8.61.3 package; that release's entry never recorded it, so it is recorded here

### Fixed
Found by running the new extractor over real Objective-C (a React Native dependency tree) rather than the fixture; none of these reached a release.
- **A forward declaration was read as a container** (PR #857) — `@protocol FooDelegate;` opens no block, so it ran to the *next* container's `@end` and re-emitted that container's members under the wrong name. Forward protocol declarations sit above most real `@interface` blocks
- **A statement in a method body was emitted as a C function** (PR #857) — `return CGRectMake(0, 0, w, h);` has the same `type name(...);` shape as a prototype. 335 of these in the corpus
- **Any `-` or `+` inside `@implementation` could start a "method"** (PR #857) — `kNone = -1` became `- 1`, and `a - b` became `- b`. 805 of these in the corpus
- **A method body past 4KB lost its end anchor** (PR #857) — the balanced reader's default window is a parameter-list ceiling. The method anchored to one line, and its body was then scanned for members, so a single long method could fill the 120-member cap with noise and crowd out the real ones
- **`#if` / `#else` branches that each open a brace hid every later method** (PR #857) — found while verifying the fix above: depth tracking that ignores the preprocessor counts both branches' braces against one `}`. Each branch now restarts from the depth at the `#if`, and depth resyncs at every container keyword and column-0 method head, so a residual imbalance costs one end anchor rather than the rest of the container
- **A C++ header that only mentions `@interface` in a comment lost its class members** (PR #857) — the `.h` sniff in `cpp.js` ran on raw text, delegated to the ObjC extractor, which found no markers once comments were stripped and fell through to the generic one. The sniff now runs on comment-stripped text
- **A header delegated to the ObjC extractor dropped its plain `struct` / `class`** (PR #857) — C++ type extraction was gated to `.mm`; it now covers delegated headers too
- **`@interface Box<ObjectType> : NSObject` lost its superclass** (PR #857) — a lightweight-generics parameter list sat where the pattern expected the category or superclass

### Changed
- **Published counts: 38 languages, 52 extractor modules** (was 37 / 51) — 15 surfaces across README, `docs-vp`, `llms*.txt` and KNOWN_LIMITATIONS followed, all through the drift guards rather than by hand. Tier 2 is now 13 languages; doc hints stay at 7 (PowerShell adds them, Objective-C does not)
- **`.m` is now a recognised source extension** — in discovery, coverage, `tune`, closest-match suggestions and `verify` path parsing. A `.m` file with no Objective-C markers is treated as MATLAB/Octave and goes to the generic extractor

### Notes
- **No published metric moved.** A fresh `benchmark:all` on the release tree reproduces 95.8% / 78.6% / 43.4%, 88.0% vs 40.0%, and test-discovery F1 98.0% exactly; the report diffs are version stamps, timestamps and durations only. All five sources now read `8.62.0`, and `benchmark_id` moves to `sigmap-v8.62-main` — the first minor-line change since the provenance guard (#854) landed, so this is the first release where the 8.61-stamped reports would have been a hard failure had the run been skipped
- **Self-repo retrieval MRR moved, hit@5 did not — and the cause is v8.61.3, not this release.** `hard` 73.3% / 0.584 → 0.578, `mined` 60.9% / 0.389 → 0.411, `easy` 90.0% / 0.792 → 0.825; `jvm` (external repos) unchanged at 29.5% / 0.195. Two control trees isolate it: the tree v8.61.3 was *measured* on reproduces the old figures, and the tree it was *tagged* on already reads the new ones. The PowerShell merge landed between the benchmark run and the tag. Adding the Objective-C module moved nothing
- **12 regression tests** added to `objc-language.test.js` (15 → 27); 10 of them fail against the extractor as contributed. The `expected/objc.txt` fixture output is byte-identical before and after the fix
- The corpus check drops two kinds of output that were never right: 53 `RCT_NOT_IMPLEMENTED(- (instancetype)init)` macro arguments, which had been anchored to the method following them, and C++ member functions defined inline in a `.mm` class body, which had been listed as top-level functions (the class itself is still listed)
- Full suite **204 integration + 28 fixture, 0 failed** · `check:metrics`, `validate:llms`, `validate:retrieval` green · docs build clean · bundle reproducible from `src/` (179 modules)

---

## [8.61.3] — 2026-10-03

Patch. A published snapshot now carries, per source report, the release it was measured on — because the release that shipped yesterday published a figure measured by a run nobody made during it, and four gates passed without objecting.

### Fixed
- **A published metric could be carried from an earlier release and read as fresh** (#707, #854, PR #856) — v8.61.2 shipped `test_discovery: { f1: 0.98, hit_at_1: 0.974 }` stamped `sigmap-v8.61-main`, measured on 2026-10-01 from a run that was never invoked during that release; the 98.0% F1 went onto the roadmap Stats line as current. `check:metrics` passed **four times** across that release without objecting, because it verifies `latest.json` against the *saved* reports and never that a saved report belongs to the release being stamped. #707's original instance was worse: a v8.49 snapshot carrying a test-discovery number measured at **v8.8.0**, 41 minor versions earlier. Three structural causes, all live until now — no single target regenerated the five sources (`benchmark:matrix` produces four; `benchmark:honest` and `benchmark:test-discovery` are separate `--save` scripts no flow invoked, so running four of five looked identical to running all five), four of five reports carried no version at all so a version guard could not even be written, and `latest.json` misdeclared its own sources
- **`latest.json` declared four sources while the generator read five** (#707, PR #856) — the one field whose job was provenance had the wrong provenance. `sources` is now derived from what the run actually read, so the declaration cannot drift from the reads again
- **"95.8% token reduction" read as a per-call cost saving it does not support** (#811, PR #856) — it measures the generated map against *every source file in the repository*, which is a map-size measurement; an agent's context footprint is not the whole repo. Reworded in `sync-metrics.mjs` rather than in prose, because a prose-only fix is reverted by the next `sync-metrics` run
- **`stamp()` kept a rewritten report's old date** (PR #856) — it set `generated` only when absent, so regenerating a report preserved the previous run's timestamp: exactly the confusion the module exists to remove. `generated` is now always overwritten
- **A missing `latest.json` crashed instead of reporting "stale"** (PR #856) — computing the snapshot once (to stop a duplicated warning) dropped the `try/catch` the original `latestInSync` had, turning an absent file into an `ENOENT` trace

### Added
- **`scripts/lib/report-stamp.mjs` — the one provenance shape** (#854, PR #856) — every `--save` path stamps through `stamp()`, which records the version and always overwrites `generated`. Seven benchmark scripts now route through it instead of each writing its own metadata
- **The snapshot refuses to mix release lines** (#854, PR #856) — `gen-benchmark-latest.mjs` hard-fails when a source report was produced on a different **minor** line, naming the report and the version that produced it. Scoped to the minor deliberately: `benchmark_id` is `sigmap-v8.61-main`, so a report measured at 8.61.0 is legitimately part of the v8.61 snapshot and a patch must not be forced to re-run every suite. Within-line differences are not failures, so they are made **visible** instead — each source publishes the version and date it was measured on
- **`classifySources` separates two failure modes that are not the same** (#854, PR #856) — `drifted` says which release produced it and it is the wrong one (hard failure; this is #707), while `unstamped` predates stamping so provenance is genuinely unknown (published as `version: null` and warned about). Hard-failing on the second made `check:metrics` fail against the committed reports, breaking CI and `prepublishOnly`, and the only escapes were a flag day requiring every suite to re-run first or hand-writing versions into legacy reports — fabricating the exact fact being recorded. The snapshot says "unknown" out loud, and the state clears itself the first time each suite runs
- **`npm run benchmark:all`** (#854, PR #856) — one target for all five sources, so "I ran the benchmarks" cannot mean four of them
- **`metric-provenance.test.js`, 10 guards** (#854, PR #856) — three mutations each fail exactly one: disabling the drift guard, reinstating the hand-written `source` string, and reverting the cost-claim wording. The drift test is hermetic — it copies the reports into a temp root, ages one to 8.8.0, and asserts the generator exits non-zero naming it

### Changed
- **`benchmarks/latest.json` publishes a `sources` block** — five entries, each with the version and date its report was measured on. All five currently read `8.61.2 / 2026-10-03`, so the unknown-provenance warning is silent

### Notes
- **No published metric moved.** The fresh `benchmark:all` run reproduces 95.8% / 78.6% / 43.4% and 88.0% vs 40.0% exactly. `benchmark_date` advanced to 2026-10-03, which moved 12 snapshot-date labels across six `docs-vp` pages — **no guard checks those**, and they were corrected by hand. Roadmap release dates are deliberately untouched
- The drift guard is retrospective only in what it can prove: it validates the reports present now. The `hard` corpus figure recorded for v8.61.1 still does not reproduce on a pristine tree, and this release does not fix that — it makes the next such divergence attributable instead of invisible
- Full suite **202 integration + 26 unit, 0 failed** · `check:metrics`, `validate:llms`, `check:doc-counts` green · bundle reproducible from `src/` (177 modules) · supply-chain gate green (no shell spawns, no install scripts, `main` exports the API, no fingerprinting) · tarball unchanged at 967KB / 200 files — `scripts/` is not in `files[]`, so the new helper ships nothing

---

## [8.61.2] — 2026-10-02

Patch. One defect class, found at four surfaces: a canonical fact kept in a hand-maintained second copy, with nothing failing when the copies diverged. Plus the ranker bug that the first half of the work exposed by adding a single file.

### Fixed
- **A CI gate that passed on 241% coverage** (#818, PR #849) — `--ci` computed `index.size / fileList.length`, which is not a ratio: the persisted index deliberately holds more than the current config scopes (declared entrypoints, test roots, CI definitions, files a `srcDirs` change dropped), so the quotient runs past 100% and the threshold stops meaning anything. A gate set to `--min-coverage 200` would have passed. `validate` had the identical formula and reported 218%; #770 fixed it **there**, and the comment it left behind explaining why the old form "stopped meaning anything" sat three screens above a surface still using it. Both now call one function and report the same labelled figure
- **`validate` disagreed with every other surface on an empty repo** (#818, PR #849) — its own `Math.round((covered / total) * 100) : 0` agreed with the shared primitive on every populated repo and read **0%** where the other three read **100%**, one repo making two contradictory statements about whether anything was left uncovered. Nothing in scope means nothing left uncovered; `coveragePct` now states that convention in exactly one place
- **`--help` drifted from the dispatcher it claimed to render from** (#817, PR #849) — it was a 113-line template literal maintained by hand beside the `KNOWN_COMMANDS` set the guard dispatches on, and the comment above that set already asserted "`sigmap --help` renders from the same vocabulary". Writing the table out of the literal found four live drifts: the `gain --since 7d` description sat one column off (visible in `llms.txt` too), `ask --squeeze-threshold` printed a literal `%%` from a `printf` escape a template literal never needed, `Adapters (v3.0+)` omitted `willow` and was a release behind `packages/adapters/`, and `--ci` was dispatchable and documented in `cli.md` but absent from `--help` entirely
- **The import-graph boost counted popularity as relevance** (#851, PR #849) — `GRAPH_BOOST_AMOUNTS.hop1` (0.40) is added once per importing seed, so a shared utility with 23 scoring importers collected 23 × 0.40 = **9.2** and ranked 3rd for a query it shares no token with — `bm25 0`, every match signal `0`, above every genuine match but the top two. What normally hid it is `_computeHubs`, which suppresses any file with `>= ceil(fileCount * 0.2)` importers: that utility has **exactly 36**, so it was suppressed at 180 graph nodes and not at 181. The suppression of a 9.2-point phantom rested on a `Math.ceil` step that any single added file can cross, which is how the first half of this release failed `validate:retrieval` while touching no ranker code

### Added
- **`src/cli/command-table.js` — the only CLI vocabulary** (#817, PR #849) — 115 ordered usage rows. `--help` renders from it, `KNOWN_COMMANDS` and `FLAG_GATED_COMMANDS` derive from it, and the adapter line reads `listAdapters()` rather than a literal that can fall behind the directory. Adding a command means adding a row; there is nowhere else to add it
- **`coveragePct` and `indexedCoverage`** (#818, PR #849) — the only definitions of the file-coverage ratio. `indexedCoverage` is an intersection over the in-scope list, so it cannot exceed 100% by construction, which is what the quotient it replaced could not promise
- **`--ci` in `--help`, and its population named in both verdict lines** (#818, PR #849) — `indexed 98% (185/189 files) ≥ 80%` on this repo at this commit, the rule #762 set for every other surface
- **Structural drift guards, 25 assertions over two files** (#817 / #818, PR #849) — `command-table.test.js` requires the table and the dispatch chain to agree in **both** directions, every flag advertised under a command to be read by that command (#775's class), `--help` to equal the renderer, and `llms.txt` to keep the line shape `generate-llms.mjs` filters on. `shared-definitions.test.js` allows the coverage ratio and the reduction average exactly one definition each, requires all five coverage surfaces to label their population, and requires same-population pairs to produce the same number. Structural rather than numeric on purpose: a numeric check passes whenever today's two copies happen to agree
- **`graph-boost-relevance.test.js`** (#851, PR #849) — pins that a non-matching file takes one hop-1 bonus and may not accumulate, that a zero-score direct neighbour still receives that one bonus, and that a matching file keeps its full accumulation

### Changed
- **`validate` on a repo with an empty in-scope set reports 100%, not 0%** (#818, PR #849) — and no longer warns that 0% is below the recommended 70%. This is a user-visible change in one edge case, and it aligns `validate` with the convention the other three surfaces already used
- **Hop-1 graph boost: one free bonus, accumulation gated on a real match** (#851, PR #849) — measured on this tree with the condition toggled, it recovers `mined` hit@5 **56.5% → 60.9%** (MRR 0.380 → 0.389) and lifts `jvm` MRR 0.192 → 0.195, with `easy` unchanged and `hard` MRR moving −0.002 (0.586 → 0.584). Net against the v8.61.1 baseline every gated corpus is **unchanged**: the 4.4pp was lost by adding the module, which exposed the bug, and is given back by the fix rather than won on top of it

### Notes
- v8.61.1 judged #817's generation half "a 136-line rewrite of a literal that is currently correct, with regression risk and no defect to fix". The literal was **not** currently correct — four drifts above — so the assessment is withdrawn
- Two fixes for #851 were measured and rejected, and both are recorded in the test file so they are not re-attempted. Refusing to boost non-matches outright deletes a **designed** behaviour: lifting a zero-score direct neighbour is how a file that implements what a matching file calls gets found, and `ranker-order-invariance.test.js` pins it (#596) — that variant fails two tests there plus the A12 uppercase-path case. Capping everyone at one bonus flattens accumulation for files that legitimately match, which reordered the matches among themselves and cost a real rank-5 answer its place, so the task stayed a miss either way
- A test-authoring trap worth recording: the first draft of `graph-boost-relevance.test.js` quoted a mined task's query verbatim in its header comment. The mined corpus is built from this repo's own commit subjects and the files they touched, so the test became a **better match for the task than the answer was**, took rank 4 and failed the gate by itself. The corpus leak guards (`queryLeakage`) check basename leaks and verbatim n-grams **in the tasks**, not in the repo's files — nothing detects contamination from that direction. Benchmark queries must not be quoted in indexed source
- Full suite **201 integration + 26 unit, 0 failed**. Two earlier runs failed with `ENOSPC` during the benchmark-plus-fixture burst rather than on a defect; `each-flag.test.js` passes 11/11 standalone and CI was green on Node 18/20/22 for the same code
- Bundle reproducible from `src/` (177 modules) · `check:metrics`, `validate:llms`, `check:doc-counts` green · `validate:retrieval`, `validate:source-roots`, `validate:squeeze` and the cross-suite determinism check all pass · supply-chain gate green (no shell spawns, no install scripts, `main` exports the API)
- **No published number changes.** The fresh matrix and honest runs reproduce 95.8% / 78.6% / 43.4% and 88.0% vs 40.0% exactly; the only diffs in `benchmarks/reports/` are `durationMs` and the version stamp
- `hard` reads 73.3% against a stored baseline of 75.6%. That −2.3pp reproduces on an untouched `develop` worktree and is **pre-existing drift**, not from this release; the gate reports it without enforcing it, because `hard` scores against this repo and moves with the indexed file set. Re-recording stays scheduled with the number-provenance work (#707/#811) rather than being refreshed silently here

---

## [8.61.1] — 2026-10-02

Patch. A documented output contract that was partly fiction, and the guard that was missing for the whole class.

### Fixed
- **`ask --json` omitted two of the five keys its documentation promised** (#662, PR #846) — `cli.md` had described the object since before v8.54.2 as carrying `intent`, `coverage`, `cost`, `riskLevel` and `rankedFiles`. `rankedFiles` was **never implemented**, and no surface emits that name — the closest, `--query --json`, calls its array `results`. There is no `cost` key either; the figure ships as `costBefore`/`costAfter`/`savingsPct`, because a saving needs both sides of the comparison to mean anything. A consumer written against the documented contract got `undefined` twice
- **`ask` was the one command whose ranked selection could not be read back from its own JSON** (#662, PR #846) — `selectedFiles` is a count and `contextPath` is a file to re-parse, so an agent that wanted the files and their scores had to issue a second query against the same index it had just ranked

### Added
- **`rankedFiles` in `ask --json`** (#662, PR #846) — the ranked selection as `[{ rank, file, score, tokens }]` in rank order, the same per-result shape `--query --json` uses minus `sigs`: those are already in the context file the same run wrote, and repeating them would double the payload for no new information. Scores are rounded exactly as `cutoffScore` is, so the last row's score **is** the cutoff rather than a near-miss differing in the fourth decimal — two roundings of one number is the defect this project keeps closing, so the agreement is asserted
- **An output-contract guard for the `--json` surfaces** (#845, PR #846) — `test/integration/json-key-contract.test.js` reads the documented key list **out of `cli.md`** and asserts every key is really emitted, for `ask`, `--callers` and `judge`. The list is read rather than restated: a hand-kept copy in the test would be a third place to drift, which is the defect and not the fix. A negative case proves the comparison fails rather than passing quietly, and six of its eleven tests fail against the pre-fix binary

### Changed
- **The documented `ask --json` key list names only keys that exist** (#662, PR #846) — and states the three cost keys instead of implying a single `cost` field

### Notes
- #661 already guarded that every dispatchable **command** appears in `--help`, and #817 asks for the same at **flag** level; neither covered **output keys**, which is how a documented-but-absent key survived several releases. The exposure was live rather than theoretical: v8.61.0 added fourteen keys to this exact surface
- The other two documented contracts were checked and found exact — `--callers` 9/9 keys, `judge` 4/4 — so `ask` was the only breach. Both are pinned anyway, because the point is the class rather than the instance
- #817's first criterion, rendering `--help` from a canonical table, is deliberately **not** done: the command-level drift it targets is already guarded, and every flag `--help` advertises is parsed today (the six a naive `args.includes` scan flags are all read via `process.argv` or a helper), so it would be a 136-line rewrite of a literal that is currently correct. #817 stays open for the generation half

---

## [8.61.0] — 2026-10-02

Fourth PR of ladder **R2**. Three defects on **one surface** — `ask`, the command the product is used through — so they shipped together. Two are R2's own theme (every figure names its basis); the third closes the gap between what the map saves and what the agent actually spends.

### Added
- **`ask --with-source`** (#814, PR #836) — `ask` emitted signatures only, so an agent that then needed a body opened the **whole file**: the exact cost the map exists to avoid, handed back one level down. `--with-source` slices the top symbols' lines from the `:start-end` anchors every extractor already emits, and attaches the blast radius so the agent sees what else a change there touches without a second query. Breadth first — up to three symbols per file, files in rank order — so one long member list cannot eat the budget. Bodies are secret-scanned with the same redactor `get_lines` uses, and an export list never takes a budget slot because it is already in the signature section verbatim. Strictly **opt-in**: the default context is prefix-identical, asserted by a test
- **`ask --source-budget <tokens>`** (#814, PR #836) — the source addendum is budgeted against the project's existing `maxTokens` minus what the signatures already spent, so there is no second knob to tune; this flag overrides it for a one-off deep read. A body that does not fit is skipped **whole** and the omission disclosed in both the summary line and the written context — half a function is not a cheaper answer, it is a wrong one
- **Stale-index banner on `ask` and the MCP read tools** (#815, PR #836) — `judge` has warned since v8.54.2 (#780) when the context it scores against is older than the sources it describes. `ask`, `read_context`, `search_signatures` and `query_context` answered from the same ground in **silence**, so a stale answer was byte-indistinguishable from a fresh one: `[sigmap] ⚠ context is 11.8 hour(s) older than src/mcp/handlers.js — this answer is ranked against stale ground`
- **`src/retrieval/selection-quality.js`** (#806, PR #836) — `classifySelection()` splits a result set into the implementation an answer can be grounded in and the support files it cannot, and names the composition: `Selection : 2 source, 3 support (test, docs, ci)`. A selection with **no** implementation in it warns and points at `--explain`
- **`src/retrieval/with-source.js`** (#814, PR #836) — anchor parsing, budgeted symbol slicing with a path sandbox matching `get_lines`, and a blast radius that reuses `--impact`'s reverse-dependency walk, so `ask --with-source` and `sigmap --impact <file>` cannot disagree about who depends on what
- **`STALE_TAILS` in `src/judge/context-source.js`** (#815, PR #836) — one definition of "stale" for three surfaces rather than one rule each: the threshold and the gap wording are fixed in the shared module and only the consequence clause varies, because what a stale index does to a verdict is not what it does to a ranking. `judge`'s own line stays byte-identical to what #780 shipped

### Fixed
- **`ask` printed `Coverage : 100%` over a result set with no source code in it** (#806, PR #836) — verified on a fresh `gin` clone whose five selected files were a test, a README, a CI workflow and two unrelated sources, with not one of `gin.go`, `routergroup.go` or `tree.go` among them. The figure is fed every file the scan found, so it reports how much of `srcDirs` is **readable** — 100% in any healthy repo, whatever the query returned. The #762 precedent applies: the defect is the missing population, not the number. It now reads `readable 100% (179/179 files in srcDirs)`
- **`ask` printed `Risk : NONE` whether or not anything had been assessed** (#806, PR #836) — on a clean checkout the probe legitimately counts zero changed files; outside a git repo it throws and the old code still rendered a level. Printed bare next to a coverage figure about an unrelated population, the pair read as "this answer is trustworthy" when nothing had been verified. Risk now names its basis — `NONE (0 file(s) changed vs HEAD)` — or reads `not assessed (no git repo, or git unavailable)` when the check could not run

### Changed
- **`ask --json` names the basis of every figure it reports** (#806, PR #836) — `coveragePopulation`, `coverageIncluded`, `coverageTotal` and a `coverageBasis` that states what the number is **not** ("NOT whether the query found the right files"); `riskAssessed`, `riskChangedFiles`, `riskBasis`; `sourceFiles`, `supportFiles`, `sourceFree`; `stale`, `staleWarning`; and `withSource` plus a `source` report carrying the budget, spend, skip count and blast radius. Every pre-existing key is unchanged, so no consumer breaks
- **`--help` and `llms-full.txt` document `--with-source`** (PR #836) — `sigmap ask "<query>" --with-source   Add top-symbol bodies + blast radius (budgeted; --source-budget <n>)`

---

## [8.60.0] — 2026-10-01

Third PR of ladder **R2**. Two commands reported a **narrower scope than they claimed**, and neither said so. R2's theme is one definition per number; this is its sibling — every claim names its basis.

### Fixed
- **`--diff <ref>` silently excluded uncommitted work** (#667, PR #832) — it ran `git diff <ref>..HEAD`, which is ref-vs-HEAD and therefore **excludes the working tree**, while the flag is documented as "changes since `<ref>`". A developer with local edits got a diff that omitted exactly the files they were editing: on a fixture with one committed and one uncommitted change it reported `diff-vs-HEAD~1 files: 1`. The ref form is now `git diff <ref>` — ref vs working tree, committed and uncommitted alike
- **The same wrong range existed twice** (#667, PR #832) — in the CLI and in the `get_diff_context` MCP tool, so the two surfaces could answer the same question differently. `src/util/git.js` `changedFiles()` now owns all three ranges and both call it. The MCP tool description no longer advertises `base..HEAD`
- **`--callers` asserted a zero it could not support** (#768, PR #832) — it printed `zero method blast radius` for symbols that are demonstrably called. Two systematic blind spots, neither of which is "no callers exist": the graph walks `srcDirs` only, so the CLI entry point — the largest caller of every `src/` module — contributes no edges; and `requireSourceOrBundled('./src/…')` is a dynamic load the resolver cannot follow. This is the exact claim a developer leans on before changing a signature, and it was unqualified while `--impact` in the same codebase already labelled itself a lower bound

### Added
- **`src/util/git.js` `changedFiles(cwd, {base, staged})` and `REF_RE`** (#667, PR #832) — one owner of the three diff ranges: default `git diff HEAD` (working tree vs HEAD), `{base}` `git diff <base>` (working tree vs base), `{staged}` `git diff --cached` (index vs HEAD)
- **Scope disclosure on `--callers` / `--callees`** (#768, PR #832) — `buildCallGraph` returns the scope it searched and counts the module loads it could not follow, and both formatters carry the qualification: `_no caller found (lower bound — searched src, packages, 177 file(s); 17 dynamic module load(s) could not be followed)._`
- **`--callers --json` gains `lowerBound: true` and `scope`** (#768, PR #832) — so a machine consumer cannot read an unqualified zero either. The MCP `get_method_impact` tool shares `formatCallGraph` and inherits all of it

### Changed
- **`--help` states the exact git semantics of all three diff forms** — bare = working tree vs HEAD · `<base-ref>` = working tree vs base · `--staged` = index vs HEAD
- **A counted `--callers` result carries the qualifier too** — the number is a lower bound whether it is zero or not, and `--callees` is labelled for the same reason

### Measurement
- **Bare `--diff` and `--diff --staged` are byte-identical**, asserted by a regression test that passes on **both sides** of this change — which is what makes it a guard rather than a dead test
- This also **removed a direct `child_process` call from the CLI**: the old `getFilesChangedSinceBase` had its own inline `execFileSync` rather than routing through `src/util/git.js`. The ref stays a separate argv element guarded by `REF_RE`, never interpolated into a command string
- **14 tests; 13 fail against v8.59.0.** Coverage includes the uncommitted change appearing on both CLI and MCP for the same ref, an invalid ref refused before reaching git's argv, a structural assertion that neither surface builds a `<ref>..HEAD` range, and a fixture whose only caller lives **outside `srcDirs`** — the precise blind spot — not being reported as zero-risk
- Full suite **196 integration + 26 unit, 0 failed**
- **No measured number changes.** This touches diff scope and call-graph reporting, not retrieval or extraction; `latest.json` untouched and `check:metrics` green

---

## [8.59.0] — 2026-10-01

Second PR of ladder **R2 — "one definition per number, pinned structurally"**. Two defects in the same command, so they shipped as one change.

### Changed
- **`--dashboard` writes `.context/dashboard.html`** (#782, PR #829) — it wrote into `benchmarks/reports/`, a directory SigMap does not own. In a consumer repo that path either does not exist, so SigMap created it, or it means something else entirely; either way the file landed outside the `.context/` line `--init` gitignores. **Migration:** if you referenced `benchmarks/reports/dashboard.html`, point at `.context/dashboard.html` or pass the new `--out`. An audit of the published surface confirms this was the only hardcoded write outside `.context/` — every other `benchmarks/` reference is an optional *read* with a graceful fallback
- **The per-language chart shows the languages actually present**, busiest first (#663, PR #829) — it charted a fixed 21 bars against a positionally-aligned list of 21 label abbreviations. Charting all 36 supported languages would put 20px between labels and most are zero in any one repo, so it renders what is there, with an empty state when none are

### Fixed
- **Dashboard coverage graded against a stale 21-language list** (#663, PR #829) — `LANGUAGE_KEYS` in `src/format/dashboard.js` had drifted from the 36 languages the project ships, so a repo written in Elixir, Lua, R, GDScript, Astro, TOML, Terraform, GraphQL or Protobuf read as uncovered
- **The denominator was only half of it** (#663, PR #829) — `detectLanguage()` in the same file was a **second** extension map covering the same 21 languages, so the numerator could never reach a widened denominator. Raising `supported` 21 → 36 alone would have moved this repo from 2/21 to 2/36 — making the published figure **worse**. Detection and the supported set now come from the same module

### Added
- **`dispatch.LANGUAGES`** (#663, PR #829) — the languages SigMap can extract, derived from `EXT_MAP`'s values plus the two `langFor` routes by *filename* rather than extension (`dockerfile`, `pipeline`). It reproduces `scripts/lib/source-meta.mjs` `deriveLanguages()` **byte-identically** — the list `version.json` publishes and `check-doc-counts` gates. `source-meta.mjs` itself cannot be used at runtime: it is ESM under `scripts/` (not in `package.json` `files`) and `readdirSync`s `src/extractors/`, which does not exist in the standalone bundle
- **`--dashboard --out <path>`** (#782, PR #829) — explicit destination, parent directory created, matching `wiki --out`. `--json` reports the path actually written

### Measurement
- On this repo the figure moves `9.5% (2/21)` → `8.3% (3/36)`. The percentage **drops because the denominator is finally honest**; the numerator rose too (2 → 3 — `markdown` was invisible before). On a fixture using Elixir, Lua, R and Terraform it moves **0/21 → 4/36**
- The `#591` note warned that folding the dashboard's map into `EXT_MAP` "would miscount languages" because `.tsx → typescript_react`. That no longer applies: `deriveLanguages()` already counts `typescript_react` as its own entry, so matching dispatch **agrees** with the gated count rather than diverging from it. `extension-map-single-source.test.js` stays green
- **Five of the 11 new tests are structural** — `dashboard.js` declares no `LANGUAGE_KEYS` and no extension map of its own (asserted on comment-stripped source, so the explanatory comments cannot satisfy it), the chart carries no positional label list, the denominator is tied to **both** `dispatch.LANGUAGES` **and** `version.json.languages`, `--dashboard` creates no directory outside `.context/`, and `--help` no longer advertises the old path
- All **11 fail against v8.58.0** (verified in a throwaway worktree: 0 passed, 11 failed). One initially passed because its callback was marked `async` while the harness calls `fn()` without awaiting — the assertion threw into an unawaited promise and reported a pass regardless; removing `async` took the control from 1/11 to 0/11
- Full suite **195 integration + 26 unit, 0 failed**
- **No measured number changes.** This touches the dashboard and extractor dispatch, not retrieval or extraction output; `latest.json` untouched and `check:metrics` green

---

## [8.58.0] — 2026-10-01

First PR of ladder **R2 — "one definition per number, pinned structurally"**. `validate`, `doctor` and `status` each held a private definition of what the signature index contains and when it was last built, so on a **healthy** index all three contradicted each other. Two open issues, one root cause, one change.

### Fixed
- **`validate` called 266 legitimate index entries stale, and advised a re-run that could not help** (#770, PR #826) — `generate` writes the index over an **augmented** population: the configured `srcDirs` walk, widened by the declared package entrypoints, every test root and every CI definition. All three widenings are deliberate — they are how `sigmap ask` reaches code that lives outside `srcDirs` by construction. `validate` measured that index against the **un-widened** list, so every widened entry read as stale. On this repo the 266 decomposed exactly: 256 under `test/`, 10 under `.github/`, **zero** actually stale. Stale is now only what the shared classifier cannot justify
- **`doctor` counted the same entries as indexed coverage and called the index fresh** (#770, PR #826) — one bare total (`447 file(s) indexed`) over a population deliberately wider than the source tree, so it read as coverage and never surfaced a genuinely stale entry
- **A deleted file survived the full run `validate` told the user to perform** (#770, PR #826) — `saveCache()` writes the cache map back **whole** and never pruned it, and `ranker.buildSigIndex()` merges that cache into the retrieval index, so a deleted file stayed indexed until a version bump busted the cache. This was the half that made the remediation text literally unactionable
- **`status` reported `Last index: never` whenever tracking was off** (#664, PR #826) — freshness came solely from `readLog()` (`.context/usage.ndjson`), which only exists under `--track`/`config.tracking`, i.e. not by default. `doctor` read context-file mtimes in the same repo and called the index up to date

### Added
- **`src/analysis/index-state.js` — one owner of the index population and its age** (#825, PR #826) — `TEST_ROOTS` / `CI_DIRS` are imported by `generate`'s `collectTestEntries` / `collectPipelineEntries`, so the collector and the classifier **cannot drift**; `classifyIndexEntries()` splits in-scope / augmented / missing / out-of-scope; `indexFreshness()` resolves usage log → `.context/sig-index.json` → context mtime, **disclosing which**; `changedSince()` is lifted out of `doctor` so `status` counts the same population
- **Per-class remediation** (#770, PR #826) — `staleRemedies()` names a command per stale class rather than one message for both: a deleted file is cleared by a full run, a file that merely left `srcDirs` is a config question
- **`sig-cache.pruneMissing()`** (#770, PR #826) — run by `generate` before `saveCache`. Keyed on **existence only**, never on the current scope, so a per-package monorepo run cannot evict another package's entries
- **`validate --json` gains `augmentedEntries`, `augmentedByReason`, `missingEntries`, `outOfScopeEntries`**; **`status --json` gains `indexSource`** (PR #826)

### Changed
- **`validate`** — `266 stale` → `268 beyond srcDirs (256 test, 10 CI, 2 entrypoint)`, named rather than miscounted
- **`doctor`** — `447 file(s) indexed` → `179 in-scope file(s) indexed · 268 beyond srcDirs (…)`; the index check **warns** while stale entries exist, and freshness no longer claims "up to date" over a stale index
- **`status`** — `never — run: sigmap` → `1h ago (v8.57.0, 447 files) — from .context/sig-index.json`, and the changed-since count now matches `doctor`'s exactly

### Measurement
- **Index size does not move.** This is a population **widening**, not a prune: the classifier reads the entries the index already holds rather than re-walking the tree. Pinned by a test that runs `generate` and asserts 0 stale on a fixture carrying a test root, a workflow and a declared entrypoint
- **Four of the 14 new tests are structural**, per R2's exit criteria — they pin the single definition rather than a number: `collectTestEntries` imports `TEST_ROOTS` and does not redeclare it, `collectPipelineEntries` likewise for `CI_DIRS`, all three surfaces consume the primitive, and `doctor._countChangedSince` keeps no private `readdirSync` walker
- All **14 fail against v8.57.0** (verified in a throwaway worktree: 0 passed, 14 failed) and pass here
- Full suite **194 integration + 26 unit, 0 failed**
- **No measured number changes.** This touches the index-reporting path, not retrieval or extraction; `latest.json` untouched and `check:metrics` green

---

## [8.57.0] — 2026-10-01

Closes the last two open items of ladder **R1**. Both defects sit in the same four-stage `create` pipeline, and together they meant the grounded-creation loop could neither fail honestly nor succeed at the thing it exists for — so they shipped as one change.

### Fixed
- **`create` exited 0 having run none of its four guard stages** (#767, PR #823) — `summary.ok` was `failed === 0`, which is **vacuously true over an empty set**. A CI step that shelled out to `create` therefore read success from a run that verified nothing: `0/4 ran · 0 passed · 0 failed · 4 skipped`, `$? = 0`. `ok` is now `!nothingRan && failed === 0`, and the summary carries a `nothingRan` flag so the condition is legible to `--json` consumers rather than inferred from a zero count
- **Stage 2 rejected the symbols the plan intended to create** (#666, PR #823) — `verify-plan` checked every name in a plan for *existence*, so `create "add a helper to format dates"` → plan names `formatDate` → stage 2 errored on code that, by construction, does not exist yet. The pipeline's **primary use case was unreachable pre-implementation**. A plan has two kinds of name in it, and checking them identically is the bug: references must exist, **introductions must not**

### Added
- **`Creates:` plan section — introductions, verified in reverse** (#666, PR #823) — names under a `Creates:` section are checked for *absence*, which both unblocks the happy path and adds a **redefinition guard** that did not previously exist: a plan claiming to create something already in the repo is now an error. Introductions are excluded from the existence and blast-radius checks and classified by shape — a `/` or a file extension means a file, anything else a symbol. The label is matched as a heading (`## Creates`, `### Creates new`) or a label line (`Creates:`, `**Creates:**`), inline or as the bulleted/indented lines beneath it
- **`verify-plan --creates <names>`** (#666, PR #823) — comma-separated introductions for plans carrying no `Creates:` section; merged with the section when both are present. `create --creates` forwards the same list to stage 2
- **The scaffold stage's proposal is an allowlist for stage 2** (#666, PR #823) — when stage 1 proposes `userWidget.js`, stage 2 is told it is an introduction, so the pipeline no longer rejects the file it just designed. No flag needed: inside `create` the two stages now share what stage 1 decided
- **`create` exit code `2` — "nothing ran"** (#767, PR #823) — distinct from `1`, which still means *a stage ran and failed*, so a CI gate can tell a clean run from an empty one. It matches `judge`'s existing inconclusive code rather than inventing a third convention. Each stage now carries the input it needs (`STAGE_NEEDS`), printed when nothing ran, so the exit is **actionable** rather than merely non-zero
- **`verify-plan` reports introductions** — `summary.filesIntroduced` / `summary.symbolsIntroduced`, an `introduces[]` array carrying each name's existence verdict, and a `redefines-existing` issue type

### Changed
- **`verify-plan` scope counts introduced files too** — the scope figure is the surface the plan touches, and a file it creates is part of that. With no introductions present the count is unchanged, since `extractFilePaths` already dedupes
- **`create --json` exits on the same code as the human path** — previously `0`/`1` only, so the JSON consumer could not observe the nothing-ran case at all

### Measurement
- **Behaviour is unchanged without the new section or flag.** Every name stays a reference and standalone `verify-plan` is as strict as before — asserted by a test that runs the *same plan both ways* rather than by inspection
- The `Creates:` label is deliberately strict — a heading or a colon — so prose like `Creates a new helper for dates.` does not silently adopt the bullets beneath it as introductions. Pinned by its own test
- **41 tests** across the two suites (19 `create`, 22 `verify-plan`), covering 0-ran, one-ran-passing, mixed pass/fail, exit-code ↔ `summary.ok` agreement in all three outcomes, both redefinition kinds, and the end-to-end create happy path. Full suite **193 integration + 26 unit, 0 failed**
- **No measured number changes.** This touches the `create`/`verify-plan` guard path, not retrieval or extraction; `latest.json` untouched and `check:metrics` green

---

## [8.56.0] — 2026-10-01

### Fixed
- **A flat repo root was never a candidate source root** (#805, PR #821) — `_enumerateCandidates` only ever walked *directories*, so on a flat layout — the normal shape of a Go module — `.` could not be selected no matter how much source sat there. A fresh `gin` clone detected `["internal","binding","render","codec","ginS","testdata"]` and left `gin.go`, `routergroup.go`, `context.go` and `tree.go` invisible; on a reduced 13-file fixture only **2 files were scanned** and `explain gin.go` reported `EXCLUDED`. It also preferred `testdata`, a fixture directory the go tool ignores outright. Two **structural** signals now qualify the root, deliberately not one tuned ratio: a `go.mod` carrying root-level `.go` files — a Go module root *is* a package, which is the toolchain's own model — and, generically, a root holding at least 20% of the tree's code files. Measured across all 43 cached benchmark repos this selects exactly the four Go modules (`cobra`, `echo`, `gin`, `gorm`) and changes nothing else: every non-Go repo has **zero** root-level `.go` files and sits at or below 4% share. `gorm` is at 10%, which is why the `go.mod` rule had to be structural rather than a threshold. `_dedupeNested` now knows `.` is the parent of everything, so a flat layout resolves to `["."]` instead of walking the same files twice
- **…and nothing told the user** (#805, PR #821) — a coverage figure computed over `srcDirs` cannot see a file the detector never selected, which is how the broken case reported a plausible *"indexed 67% (2/3 files)"* while ten of thirteen source files were missing. The number was not wrong about its own population; nothing disclosed that the population was wrong. New `outsideSrcDirs` counts implementation files outside `srcDirs` with an extension breakdown, and both `validate` and `doctor` report it. It is a **separate primitive**, not a new denominator inside `coverageScore`: the named populations (#762) are pinned, and the fix is to disclose what is missing rather than redefine coverage
- **Three monorepo detectors disagreed about the same repo** (#781, PR #821) — the marker-based pair (`_detectMonorepo` in the source-root resolver, duplicated byte-for-byte as `_monorepoMarker` in `tune.js`) answered *no* while the layout scan found two packages. So `roots` and `tune` told the user they were not in a monorepo while `--monorepo` demonstrably processed `packages/core` and `packages/cli`, and `tune` never proposed `monorepo: true` for a layout the mode supports. New `src/discovery/monorepo.js` answers it once and reports **how** it decided — a declared workspace and a layout-only match are different facts, and collapsing them into a bare boolean is exactly what let the disagreement hide

### Added
- **`validate` and `doctor` disclose source files outside `srcDirs`** (#805, PR #821) — graded on **share, not raw count**. The first implementation warned about *297 files* on this repo, because `test/`, `scripts/` and `benchmarks/` are deliberately outside `srcDirs`; a check that cries wolf on a correct configuration teaches the user to ignore it. This repo now reads `✓ 176 in scope · 4 outside (2%)`, while a wrongly-configured flat repo reads `⚠ 10 of 13 implementation file(s) are OUTSIDE srcDirs (77%) — 10.go in .`. `validate --json` carries the figure as `outsideSrcDirs`; `doctor` carries it as a new `srcdirs-coverage` check
- **`roots` and `tune` name the evidence behind the monorepo verdict** (#781, PR #821) — `Monorepo: yes  (layout: 2 manifests under packages/)`, and `tune`'s recommendation reason is the same string, so a layout-only match is distinguishable from a declared workspace at a glance

### Changed
- **`testdata` and the fixture-directory family are never preferred as source roots** (#805, PR #821) — `testdata` is Go's fixture convention and the go tool ignores it outright; `test-data`, `__fixtures__`, `snapshots` and `__snapshots__` join it in the penalised set
- **Both new tree walks stop at nested repositories** (#805, PR #821) — recorded because it was a real defect introduced and then fixed inside the same change. `outsideSrcDirs` was walking **53,013 files** on this repo, 47,327 of them inside `benchmarks/repos/` — 43 cloned repositories whose files could never be the user's source. A `.git` entry is the marker, which also covers submodules and any vendored checkout the exclude list does not happen to name. Same answer, **232ms → 111ms**
- **One existing assertion was corrected rather than worked around** (#805, PR #821) — `v650-source-root-resolver.test.js` required `internal` as a *separate* root for a Go module, which is the #805 defect stated as a requirement. It now asserts the corrected contract (`.` is the root and covers `internal/`), with `vendor` still excluded both from the roots and from the walk

### Measurement
- 23 new tests, each verified **failing** against a `v8.55.0` worktree before the fix. Full suite **193 passed, 0 failed**; `validate:source-roots` PASS across 33 repos; bundle reproducible at 173 modules
- This release changes **what gets indexed** for `gin`, `cobra`, `echo` and `gorm` — all four carry benchmark tasks — so retrieval and honest figures move for the first time on those repos. Every number below was re-measured against a `v8.55.0` control rather than assumed

---

## [8.55.0] — 2026-09-30

### Fixed
- **The ranker kept its own, strictly weaker copy of the file-category rules** (#808, PR #819) — `_computePenalty` recognised only `foo.test.js` and a `test/` path segment, so Go's `routes_test.go`, Python's `test_foo.py`, Rust's `foo_test.rs` and the JVM's `FooTest.java` were **never penalised at all**; a root `README.md` matched no docs *directory* segment and so carried no penalty either; and CI files had no category whatsoever. On "How does gin route requests through its middleware chain?" that put `middleware_test.go` at rank 3 and `README.md` at rank 4 — both at `penalty=1.00` — pushing `routergroup.go` out of the top 5 entirely. The budget drop order had the correct patterns the whole time (#592); the two subsystems simply never shared them. New `src/util/file-class.js` is now the single source of truth and both consume it, so they cannot diverge again
- **Zero-score files were numbered as ranked results** (#807, PR #819) — `rank()` ended in `slice(0, topK)` with no floor, so a query that matched nothing still returned a full table. On a fresh `gin` clone, four `.github/workflows/*.yml` files scoring **exactly 0.00** filled ranks 3–6 of a routing query. A rank is a claim of relevance and `0.00` is the absence of one; rows scoring zero are now dropped, and a query that matches nothing renders an explicit no-match instead of filler
- **A query token equal to the project name lifted files on path alone** (#807, PR #819) — `pathMatch` was a flat bonus, so on `gin` the token "gin" matched the repo name and raised `ginS/gins.go` and `.github/workflows/gin.yml` over the real source despite carrying no discriminating power. Path matches are now scaled by the token's inverse document frequency across indexed paths — the same intuition BM25 already applies to signature tokens. On that corpus "gin" resolves to an IDF of 0.29, collapsing its path bonus rather than removing the signal
- **`stem()` never unified singular and plural, so `ask "where do users log in"` matched nothing** (PR #819) — found while fixing the above, with the new `--explain` view. `users` folded correctly to `user`, then the derivational pass stripped `-er` to `us`, tripped the three-character minimum, and reverted all the way to the **raw input** — so `stem("users")` returned `users` while `stem("user")` returned `user`, and the two never met. Every token in that query therefore scored 0, and because `score = bm25 × penalty × (1 + blend)`, a zero BM25 base makes every other signal irrelevant. The guard now keeps the plural-folded form. Measured neutral on hit@5, and it is why that query previously only "worked" by zero-score padding happening to sort the right file first
- **`--query "…" --explain` was swallowed by the `explain <file>` alias** (PR #819) — `--explain` was already a global alias meaning "explain this file", and its dispatch runs before the `--query` branch, so the new ranking diagnostic hit `Usage: sigmap explain <file>` and exited 1. The alias is now scoped so it does not claim `--explain` when `--query` is present. `sigmap ask` was unaffected (it dispatches earlier), and `sigmap --explain <file>` is unchanged

### Added
- **`ask --explain` and `--query "…" --explain` — diagnose why a query missed** (#813, PR #819) — `ask` gave a file list and a cutoff score with no view of what scored, what was close, or which signals drove the order. The diagnostic prints three things, in the order a miss is actually diagnosed: **per-token corpus coverage** (a token matching zero files answers "why did my query miss" more often than anything else, and it is counted over *stems* because BM25 matches on stems — counting raw tokens made the table report "users matched nothing" on a query BM25 scored 1.24), then each selected file with every contributing signal — path, symbol, prefix, bm25, graph, call-graph, centrality, learned weight, penalty — and **the reason** when a file was demoted, then the near-miss candidates that scored above zero but below the cutoff. Opt-in, so default output is byte-identical; and because it is a diagnostic it writes nothing to `.context/` and does not overwrite the `--followup` session
- **`src/util/file-class.js` — one definition of what a file *is*** (#808, PR #819) — `isTestFile`, `isMockFile`, `isDocsFile`, `isCiFile`, `isGeneratedFile` and `isGeneratedDir` as pure string predicates with no fs access, so the bundled CLI core and every `src/` module share them. The token-budget drop order now delegates to it rather than holding its own copy. Two new categories the ranker never had: **mocks/fixtures** (0.3) and **CI definitions** (0.15) — SigMap indexes pipeline files on purpose, so they are demoted for every query that is not about them and restored to 1.0 for one that is
- **A Trendshift badge on the README** (PR #804)

### Changed
- **`symbolMatch` now outweighs `pathMatch` — defining a thing beats mentioning it** (#808, PR #819) — the weights were inverted (0.5 against 0.8), so a file whose path merely contained the token, or a test naming the behaviour repeatedly, outscored the implementation. `symbolMatch` rises to 0.9. `pathMatch` deliberately **stays at 0.8**: cutting it to 0.45 *as well* double-suppressed the signal against the IDF scaling above and cost 4.5pp of hit@5 on the hard corpus, because a well-organised path is genuinely informative. Recorded because it was settled by measurement rather than intuition
- **`rank()` takes `includeZeroScore` for callers that boost after ranking** (#807, #776, PR #819) — zero-score suppression would otherwise have removed a file *before* a session note could lift it, and a note naming a file is explicit user evidence. `ask` opts in only when a relevant note exists, then filters at its own selection boundary, so nothing the note did not lift reaches the output
- **Two tests stopped asserting on padding** (PR #819) — `callgraph-boost` and `semantic-bridge-2` used the presence of a zero-score file in ranked output as an observation channel for boost *eligibility*. They now opt into `includeZeroScore` for that observation, which is what the option is for

### Measurement
- Verified against a **pristine `develop` worktree as the control**, not against the stored baseline alone: `hard` **72.2%** with the change and **72.2%** without it — no regression — `mined` **60.9%** unchanged, and `jvm` **21.3% → 29.5% (+8.2pp)**, which is the Go/JVM test-penalty fix landing. 192 integration tests pass, 28 of them new
- **Disclosed, not silently fixed:** `benchmarks/retrieval-baseline.json` records `hard = 75.6%`, and that figure **does not reproduce on `develop` today** — the untouched tree measures 72.2%. The drift is pre-existing and is left un-rerecorded here rather than refreshed as a side effect of an unrelated change, because `hard` scores SigMap against its own repository and moves with the indexed file set. Re-recording belongs with the number-provenance work (#707, #811)
- The ranking weights above are currently gated on that same self-scored corpus. The labelled third-party corpus that could falsify them (#810) does not exist yet

---

## [8.54.2] — 2026-09-30

### Fixed
- **`ask --top <n>` was documented and ignored** (#775, #801, PR #802) — `--help` advertised it, `--query` and `evidence` both parsed it correctly, and `ask` hardcoded `topK: 5`. `sigmap ask "…" --top 2` and `--top 20` produced context files differing only in their `Generated:` timestamp. Now parsed and used; an invalid value **errors** rather than silently falling back to 5, because doing something other than what the flag said is the defect being fixed
- **A pinned `maxTokens` was silently overridden** (#783, #801, PR #802) — `autoMaxTokens` defaults to true and replaces the configured budget, but the notice explaining that lived inside the `--report` renderer. On the default run — where almost everyone sees it — the user's `500` simply vanished, leaving the word `auto-scaled` in the coverage line as its only trace. The notice now prints once, on every path
- **…and that notice was wrong in the other direction too** (#783, PR #802) — with no pinned value at all, `--report` still announced *"your maxTokens:6000 config was overridden"*. `6000` is SigMap's own default, not the user's config: the check compared the **merged** `config.maxTokens`, and `loadConfig` recorded no provenance, so "the user set this" was unknowable. `loadConfig` now records `_userKeys` (the merge loops already skip `_`-prefixed keys, so it cannot collide or be re-merged) and the notice speaks only about a value the project actually set

### Added
- **Notes reach retrieval — `sigmap note` is no longer write-only** (#776, #801, PR #802) — every `readNotes` call site in the shipped tree was the `note` command listing its own notes, `status` counting them, or the MCP `read_memory` tool. Never `ask`, `--query`, `rank()`, `plan` or `evidence`, so a note saying *"the redaction logic lives in src/patterns.js"* could not influence a query about redaction — the one thing a decision log exists for. New `src/session/note-relevance.js` scores notes against the query with the ranker's own tokenizer, boosts the files a relevant note names, and renders matching notes into `.context/query-context.md` under a `## Notes` heading. Relevance-gated and bounded, so notes never leak into unrelated queries, and **inert when no notes exist** — a repo that never ran `note` produces byte-identical output
- **`ask` reports what it selected** (#775, PR #802) — the summary gave tokens, coverage and cost but never which files were chosen or where the cut fell, so a result could not be audited or reproduced from its own output. It now prints the selected file count, the score at the cutoff, and a sha256 of the emitted context (the `Generated:` line excluded, so the same query over the same repo hashes identically). `--json` carries `topK`, `selectedFiles`, `cutoffScore`, `contextHash` and any matching `notes`

### Changed
- **The note boost is additive and scaled to the query's own top score** (#776, PR #802) — recorded because both halves were settled by measurement, not intuition. A *multiplier* cannot lift a zero-scoring file, and zero is exactly when a note is most valuable: the ranker found no lexical overlap and a human already knew the answer. A fixed *constant* fails differently — observed scores span roughly 4–30 across queries, so any absolute number is decisive on one query and invisible on another. Separately, `rank()` slices to `topK` before returning, so boosting its result could never lift a noted file **into** the selection; `ask` now ranks a wider pool when a relevant note exists, boosts, then slices
- **The ranking core is untouched** (#776, PR #802) — `applyNoteBoost` is reachable only from the `ask` handler; `rank()` and every benchmark script never import it. `npm run validate:retrieval` passes with **mined +0.0pp**, the corpus nobody tuned against

---

## [8.54.1] — 2026-09-30

### Fixed
- **`redact` missed the credentials an AI-tooling repo actually holds** (#771, #798, PR #799) — five of seven shapes passed through untouched: Slack tokens, Slack webhooks, OpenAI project and legacy keys, Anthropic keys. The cause was a single character. `sk_live_`/`sk_test_` (Stripe, **underscore**) was covered; `sk-` (OpenAI/Anthropic, **hyphen**) was not, so the command whose whole job is keeping secrets out of an AI context file let the three most common modern API-key formats through. Five patterns added, anchored with `\b` so `sk-` cannot match inside `risk-`, and ordered so the hyphenated forms are never misreported as each other
- **`verify` reported standard globals as hallucinations** (#777, #798, PR #799) — the allowlist was an inline literal that stopped at `encodeURIComponent`, so `structuredClone()` — a Node and browser global since Node 17 — was flagged as fabricated at **`high` confidence**. Globals now live in `src/verify/globals.js` as grouped data (184 names across es/web/node/test/python) rather than a hand-maintained literal, so a missing one is a one-line addition to the right group
- **`verify`'s suggestions were worse than its findings** (#777, #798, PR #799) — `buildSymbolCandidates` walked the entire signature index, so `structuredClone()` was answered with `structuralFixture()` from a test file and `debounce()` with `resource()` from `test/fixtures/main.tf`. Applying either would corrupt the answer it claims to correct. The suggestion pool now excludes test and fixture paths and declarative languages — `CODE_EXTS` is deliberately **not** reused, because it includes `.tf`, `.sql`, `.graphql` and `.css`, whose top-level names are resources, tables and selectors, not callables. A 0.34 similarity floor drops the rest (`debounce` → `drone` was surviving the default 0.5 ratio); the high/medium band that makes the feature useful is untouched, so `buildEvidencPack` → `buildEvidencePack()` and `scanx` → `scan()` still resolve. No suggestion beats a wrong one
- **`explain` reported a file that does not exist as an exclusion** (#772, #798, PR #799) — a missing path fell through to the "no signatures" branch and printed `EXCLUDED — no extractable signatures`, advising the user to *"check that the file contains function/class definitions"*, at **exit 0**. It now reports `NOT FOUND`, names the path, and exits **1**. The MCP `explain_file` handler already checked existence; only the CLI path did not. **Note for scripts:** `sigmap explain <missing-file>` changes from exit 0 to exit 1

### Added
- **`explain` has a test file** (#785, #798, PR #799) — it previously had none, which is how #772 shipped. `test/integration/explain.test.js` covers every status the handler can emit — `not-found`, `.contextignore`, not-in-srcDirs, no-signatures, included — in both human and `--json` form

### Changed
- **Two claims in the source issues were stale and are recorded rather than "fixed"** (#798) — #785's *"5 of 11 redact patterns unasserted"* was already solved: `redact.test.js` carries a table-driven `PATTERNS` gate, which is exactly why adding #771's patterns failed the suite until samples existed. And #777's *"consult the installed-lib index"* was already implemented (`hallucination-guard.js:208`) — `debounce` flags in this repo only because SigMap declares zero dependencies, verified by a fixture repo declaring `lodash` where `verify` already reported `✓`. One acceptance criterion in #798 ("the five-line answer produces 0 findings") was wrong as written and was corrected on the issue instead of being met by weakening the guard: a symbol from an undeclared library **should** flag

---

## [8.54.0] — 2026-09-30

### Changed
- **`sigmap judge` scores technical content, not English** (#795, #779, PR #796) — `judge` was the last grounding surface whose *verdict* rested on raw word-overlap. `groundedness()` now uses the ranker's own `tokenize()`/`stem()` from `src/retrieval/bm25.js`, so the judge and retrieval agree on what a token is: `buildEvidencePack` and `build evidence pack` scored **0.750 vs 0.333** for the same fact and now score identically. Ordinary-English vocabulary is dropped from both sides before scoring, so filler can neither inflate nor dilute a grounded answer — the reported prose case goes **0.212 → fail** to **0.643 → pass** with every claim still `1/1 grounded`. The shipped `learnBoostAbove`/`learnPenalizeBelow` band still separates the measured 80%/30% mixtures under the new scorer, so the `--learn` defaults are unchanged
- **Generic phrases are warnings, never a verdict** (#765, PR #796) — a fully-grounded answer failed, exit 1, *at `high` confidence*, solely because it contained the word "typically,". `GENERIC_MARKERS` moved out of `reasons[]` into a new `warnings[]` that never flips the verdict, and are matched on word boundaries so `in general` no longer fires inside `in general-purpose`. A warning now caps confidence below `high` — the judge cannot report high confidence in a result a stylistic signal had any part in

### Added
- **`inconclusive` verdict — "nothing to judge" is not the same as "wrong"** (#766, PR #796) — an empty response file was scored as a genuine failure, giving CI the identical signal a confidently hallucinated answer produces. An empty response, an empty context, or a response with no scoreable tokens now verdicts `inconclusive` and exits **2**, naming the file; `--learn` never learns from it. `pass`=0 and `fail`=1 are unchanged, so existing CI gates keep working
- **`judge` reads stdin and defaults its context** (#780, PR #796) — `--response` accepts `-` and a bare pipe, so `… | sigmap judge` works without writing the model's output to disk first. `--context` is now optional: it resolves the context this repo already generated and names which file it used
- **Stale-context warning** (#780, PR #796) — `judge` never compared the context file's age against the sources it describes, so an answer could be judged against ground that had moved with no hint. A context older than its newest source now warns, naming the gap and the file. New `src/judge/context-source.js` owns the resolution and the freshness check, mirroring the adapter-output list `sigmap doctor` already checks so both commands agree on what "the repo's generated context" means
- **Per-claim detail in the human output** (#780, PR #796) — the checked-claims table existed only in `--json`, so on a failure the reader could not see which claim was checked or how it resolved without re-running the command. It now prints on `fail`/`inconclusive`, alongside the warnings block

---

## [8.53.0] — 2026-09-29

### Added
- **One read path for run history, with named populations** (#773, PR #793) — `src/tracking/usage-source.js` normalises both run stores into a single record shape, dedupes a run logged to both, and reports which stores contributed so a caller can label what it is showing. `--health`, `history` and the dashboard consume it; `gain` and `budget` already read the gain log directly. Populations stay distinct and now say so: **524 generate runs**, **2,047 operations** and a session window are different things — `gain` records `ask` queries alongside generates, which is how one log described itself as both 2,047 and 525. Same rule #762 established for coverage: differing numbers are fine, unlabelled ones are not

### Fixed
- **Three surfaces reported "no history" while the log held hundreds of runs** (#773, PR #793) — four commands published a token-reduction figure and no two were comparable. The cause was not arithmetic: `tracking` defaults to **false**, so `.context/usage.ndjson` is never written — and that is the store `--health`, `history` and the dashboard read, while `recordUsage` writes `.context/gain.ndjson` unconditionally. Three surfaces looked empty because they read the one store nobody fills. On this repo `--health` reported *"token reduction: no history, total runs: 0"* beside a gain log holding 525 generates. It now reports `96.6% (mean of 524 generate run(s) · vs whole-file baseline)` and `524 (generate runs; gain counts every operation)`, and `history` shows `last 10 of 524 runs · gain.ndjson` instead of *"No usage log entries"*
- **`history` printed "(last 1 runs)" for an empty log** (#773, PR #793) — `Math.max(last.length, 1)` forced a floor of one, so a log with nothing in it reported a run that never happened. An empty log now says so
- **`history` rendered unrecorded fields as measured values** (PR #793) — `gain` records no `fileCount` or `overBudget`, which the table printed as `0` and `no`. That is the **same defect #764 fixed in `bench --submit`**, surfacing in a different command: a field the source never recorded displayed as though it had been measured. Both now render `—`

### Changed
- **The issue's premise was corrected while fixing it** (#773) — #773 names `.context/usage.json` as a third token store. It is not: that file is the star-nudge run counter and has nothing to do with tokens. There were **two** token stores, not three, which changes what "one store" had to mean and is recorded here so the next reader does not go looking for a third

---

## [8.52.2] — 2026-09-29

### Fixed
- **v8.52.1 published to npm but shipped no binaries** (PR #791) — every `Build` job in `Release Binaries` failed at *Smoke-test binary*, so nothing was uploaded and *Attach to GitHub Release* then died on a missing `dist/release/`. `scripts/verify-binary.mjs` test 9 runs `bench --submit` in an empty `TMPDIR` and treated a non-zero exit as failure — but since v8.52.1 that case exits 1 **deliberately** (#764): there is no local metric to submit, and a green exit previously said "ready to paste" for a block carrying nothing measured. Test 9 now asserts what it is actually about — that the submission block is still printed — and accepts the non-zero exit, capturing stdout from the thrown error the way the other exit-tolerant checks do. **The v8.52.1 GitHub Release remains without binary assets**; npm `sigmap@8.52.1` was unaffected, since binaries are not part of the npm package. Users needing a standalone binary should take v8.52.2

### Changed
- **A behaviour change reached a tag while PR CI was fully green** (PR #791) — this was the *fourth* place depending on the old `bench --submit` exit contract. Three were found and fixed while doing #764; this one was missed because `release-binaries.yml` is `verify-binary.mjs`'s only caller and it triggers on **tag push, never on pull requests**. Both #789 and #790 passed every check while the failure was already guaranteed. The smoke test only runs after the tag exists, which is the worst moment to learn a CLI contract moved — running it against a single ubuntu build in PR CI is the structural fix and is tracked separately

---

## [8.52.1] — 2026-09-29

### Fixed
- **`sigmap share` printed a multiplier measured nowhere, and invented the user's numbers when none existed** (#763, PR #789) — the share text appended the string literal `6× better results` against a published lift of **2.12×**, an overstatement of roughly three times, in output whose entire purpose is to be pasted into a public post. Worse, `let reduction = 97, hitAt5 = 88` meant a repo that had never run a benchmark emitted *"97% fewer tokens · 88% retrieval accuracy"* as the **user's own measurements**. Every number is now traceable or absent: local figures carry `(this repo)`, the lift carries `(published)` and is read from the same `benchmarks/latest.json` that `compare` reads — so the two commands cannot advertise different multipliers — and a repo with no history says *"not benchmarked locally yet"* instead of substituting defaults. A measured `0` is also now used rather than discarded, since `if (tok.reduction)` treated a real zero as missing
- **`sigmap bench --submit` rendered an unmeasured entry as a measured zero** (#764, PR #789) — `ret.hitAt5Pct || Math.round((ret.hitAt5 || 0) * 100)` collapses a **missing** field to `0`, which then passes the `!= null` render guard, so a history entry carrying no hit@5 printed `hit@5 : 0%` — indistinguishable from a genuine score of zero — inside a block the command explicitly asks users to paste into a public Discussion. Now `!= null` throughout: absent renders `not run`, a measured `0` still renders `0%`, and text mode exits non-zero when nothing local was measured so `bench --submit > block.txt && post` cannot publish an empty submission silently. The `--json` mode deliberately keeps exit 0 — it already states the condition as `local: null`, which a consumer can check, and it is a machine contract other tooling exits-0 against

### Changed
- **Three committed tests had grown to depend on the fabricated numbers** (PR #789) — the hardcoded 97/88 defaults made `share` look unconditionally rich, so a test asserted its output always contains `tokens`. That held only because the command invented a token figure when no benchmark history existed, which made the test **environment-dependent**: it passed on a working copy carrying a gitignored `.context/benchmark-history.ndjson` and failed on a fresh CI clone. It now asserts the contract that actually holds in both — report measured numbers, or state there are none — verified with the history file present and moved aside. The two `bench --submit` tests encoded the old exit-0 contract for a history-less fixture and were re-pointed at the corrected behaviour, keeping their real assertion that the block still prints

---

## [8.52.0] — 2026-09-29

### Added
- **One coverage primitive, with named populations on every surface** (#762, PR #787) — four commands printed a coverage percentage for one repo and no two agreed: `validate` 98% (175/179), `doctor` 100%, `--health` 100% (170/170), `--report` 54% (91/170). They were never in conflict about a fact — they measured **different populations** through the same primitive, and none of them said which. Three populations are now named and carried on every figure: **`in-context`** (survived the token budget — what the agent actually sees), **`indexed`** (present in the retrieval index, budget or not) and **`readable`** (readable on disk under `srcDirs` — an access check, not a coverage claim). `formatCoverage()` renders `<population> <pct>% (<included>/<total> <noun>)` and **throws on an unknown population**, so a bare percentage cannot be printed by accident; `inContextFiles()` parses the `### <relpath>` sections of the generated context file rather than the index. Differing numbers were always fine — unlabelled ones were not

### Fixed
- **`doctor` called the retrieval index "in context", contradicting the run that built it** (#762, PR #787) — it fed `coverageScore` the output of `buildSigIndex` and then printed *"100% of source files in context"*. The index deliberately holds more than the token budget admitted, so `doctor` claimed **100% in-context** while the very run that produced that context reported **54%** — two directly contradictory statements about one artifact on disk, and the reason this was a defect rather than a labelling gap. `doctor` now measures the context file and agrees with `--report` exactly: in-context 54% (91/170). `validate` (indexed 98%) and `--health` (readable 100%) still differ, correctly, and now say why

### Changed
- **Four command outputs changed shape** (PR #787) — `validate`, `doctor`, `--health` and `--report` each now print a population label with an explicit numerator and denominator. `doctor`'s figure in particular moves from 100% to the honest in-context number, which will read as a *drop* on first upgrade and is not one: it is the first time that line has measured what it claims. Nine assertions pin both halves — every figure names its population, and the two surfaces claiming the same population must produce identical numbers — each mutation-checked in both directions

---

## [8.51.10] — 2026-09-29

### Fixed
- **`sigmap compare` advertised a bigger lift than the project publishes** (#760, PR #761) — the command whose entire job is *"SigMap vs a baseline"* scored against `randomBaseline` (~16%) and reported a **4.9× lift**, while README, `docs-vp/`, `version.json` and `benchmarks/latest.json` all publish the honest corpus: **86.4% vs 40.8%** against a single-shot grep agent, a **2.12× lift**. The honest corpus exists *precisely because* the random baseline overstates — v8.19 introduced it to stop quoting random-selection lift, and this command was never switched over. Same failure class as #697 (counts drifting across surfaces) and #743 (the measurement certifying its own bug). `compare` now spawns `run-honest-benchmark.mjs --json`, which already emits pure JSON and runs in **~38s against the ~90s** retrieval run it replaces, so the fix is also faster. The output names the baseline (`SigMap vs grep agent`, corpus size) so no reader can mistake which comparison they are looking at
- **The token row beside it was fabricated** (#760, PR #761) — `Avg tokens 93 vs 1,289,556` derived its baseline from `fileCount * 4000`: four thousand tokens per file, **assumed, never measured**, and rendered next to a real signature count as though both were observed. It now reports the measured **95.8% average reduction** from `latest.json`, explicitly labelled as coming from the saved benchmark rather than from this run
- **`compare --json` has never been pipeable** (PR #761) — the progress line used `console.log`, putting a human string on stdout ahead of the machine payload. That is the same defect as #757 one level up: diagnostics on the machine channel. Moved to stderr, so the JSON mode now pipes cleanly into a parser

### Changed
- **`compare`'s claim is now pinned to `latest.json` by test** (PR #761) — a regression test asserts the command's hit@5 pair agrees with the published SSOT *and* that README carries the same two figures, so the command and the project cannot drift apart again. Eleven assertions, each mutation-checked: reverting to the random baseline, or putting progress back on stdout, fails exactly one test
- **The v8.48 CLI audit backlog is closed** — #656, #657, #658, #660 and #661 were each re-verified individually rather than bulk-closed, with the evidence recorded on every issue: weight decay converges 1.5 → 1.138 toward 1.0 (#657); `displayPath` restores original casing so `--impact` renders `src/MyService.js` (#658); `validate` coverage is bounded by construction with stale index entries counted separately (#660); zero implemented subcommands are missing from `--help` (#661); and the `--report --json` over-budget gate fires correctly — `overBudget: true` exits 1 in both JSON and text mode, `exitWithCode()` having replaced the `process.exit(0)` that clobbered it, with three dedicated cases in `test/integration/audit-criticals.test.js` (#656)

---

## [8.51.9] — 2026-09-28

### Fixed
- **`sigmap compare` failed for every user, and made them wait ~90 seconds first** (#757, PR #758) — the command spawns `run-retrieval-benchmark.mjs --compare` and does a strict `JSON.parse` of that process's **entire** stdout, but the payload was emitted at the bottom of the script, *after* the terminal table. So stdout was a box-drawn results table followed by the JSON, the parse died on the leading `─`, and `compare` exited 1 — after running the full 18-repo retrieval benchmark. Both halves were correct; only their **order** was wrong. `--json` had always got this right, emitting and calling `process.exit(0)` before any human output. `--compare` now does the same. Found by smoke-testing the whole CLI surface command by command: **93 of 97 green**, and this was the only genuine defect — the other three were correct refusals reported from the wrong directory (`--diagnose-extractors` needs SigMap's own fixtures and passes 36/36 from the repo root; `scaffold` declines below its confidence floor in a repo with no naming convention, and proposes correctly at 100% consistency when one exists)
- **The first fix for the above broke it differently** (PR #758) — moving the block above the table made it read `avgHit` and `avgRand`, which are accumulated by the loop that *prints* that table, so it became a `ReferenceError` at runtime rather than a parse error at the boundary. The block now derives the same task-weighted averages straight from `results`, with no dependency on the rendering path, and a test pins that it never reaches for those locals again. Exiting early must also not silently stop recording the run, so the benchmark-history append became a parameterised function called on both paths
- **The `compare` consumer now degrades instead of failing outright** (PR #758) — it falls back to the last JSON-looking line on stdout and validates the `{sigmap, baseline}` shape before using it, so a future stray line costs a malformed table rather than a dead command

### Changed
- **Full-surface verification run** — all 20 benchmark and gate scripts executed (matrix, retrieval, quality, task, honest, verify, squeeze, test-discovery, terse, callgraph-boost, callgraph-jvm, centrality-blend, surface-enrichment, mined-expansions, source-roots, retrieval-gate, grounding, cross-suite determinism, validate:llms, check-corpus) — **20/20 pass**. Run without `--save`, so the released v8.51.8 reports were left intact and no published metric moved. Headline figures held: **86.4% vs 40.8% grep (2.12× honest lift)**, test-discovery **F1 98.0%** (P 97.1 / R 98.8), squeeze 73–89% reduction at 100% ground-truth retention, terse 10.8% signature-token reduction

---

## [8.51.8] — 2026-09-28

### Fixed
- **Two of four strategies never told the agent that SigMap exists** (#754, PR #755) — reported as "in per-module mode the sigmap commands are not getting added in the copilot instruction file so the LLM does not pick it up." The always-on primary output is the only file an IDE auto-injects, so a missing `## SigMap commands` block there means the agent never learns the CLI is available. Two independent causes: `runPerModuleStrategy` hand-built its overview and never called `usageBlock()` — the per-module `context-<module>.md` files *did* carry it via `formatOutput`, but those are on-demand, so the one file that is actually injected was the one without it; and `runHotColdStrategy` fell back to a bare HTML comment whenever `hotEntries` was empty, which skipped `formatOutput` and the block with it. That second case is the worst moment to lose it — "nothing changed recently" is exactly when an agent needs telling to run `sigmap ask` rather than concluding the repo has no context at all. `full` and `index` were unaffected throughout. The per-module overview also closed with *"Inject the relevant module file into your IDE context window"*, an instruction only a human can act on; it now points at `sigmap ask`, which spans every module so the agent does not have to pick one
- **`maxTokens` was not honoured as a total — the fixed preamble was never budgeted** (PR #755) — `applyTokenBudget` reserved a hardcoded `max(200, 10%)` for what its own comment called a "~150-token fixed preamble", a literal that had already drifted from the thing it described. Growing the commands block to ~224 tokens therefore pushed a `maxTokens: 500` run to 554. The reserve is now measured from `usageBlock()` directly plus a named constant for the adapter header, markers, coverage line and budget disclosure — measured at 124 tokens, not the 80 first guessed. Both breaches were invisible locally and caught only by CI, because whether the budget overflows depends on how many entries happen to fit, so a guard now measures the **emitted** preamble against what is reserved and fails if reality outgrows it. Measured after the fix: `maxTokens` 500 → 440 emitted, 4000 → 3474

### Changed
- **The commands block is now directive, and names the commands that matter** (#754, PR #755) — it listed four commands out of roughly fifty, passively, in a table an agent reads past. It now opens with **"Run these yourself in the terminal"** and adds the commands that change what an answer costs or whether it is grounded: `sigmap lines <file> :<line>` (read an anchored range instead of a whole file — the single biggest saving available), `sigmap --impact` and `--callers` (blast radius before editing a file or a function), `sigmap verify` (the grounding guard), and `sigmap explain` (why a file is or is not in context). The long-form version of this already shipped in `sigmap skills install`, but that is opt-in; this block is what every agent gets without asking. Cost measured rather than assumed, since it ships in every context file and under `strategy:"index"` the whole always-on file is ~500 tokens: the block grew ~90 → ~224 tokens and **every published metric is unmoved — 95.9% token reduction, 78.6% hit@5, 61.0% task-success proxy, 43.4% prompt reduction**. A guard fails the build if the block exceeds 320 tokens
- **Two committed tests were asserting the wrong thing and are now stricter, not looser** (PR #755) — `adapter-tool-instructions.test.js` pinned `` `sigmap ask "<your question>"` `` verbatim, so rewording a *placeholder* broke a test whose purpose is to check **which commands are published**; it now asserts the command, with new assertions for the directive framing and each added command. And `token-budget.test.js` asserted output ≤ `maxTokens` while leaving `autoMaxTokens` on, so the auto-scaler legitimately raised the real target (4000 → 4536) and the assertion was checking a bound the tool never promised — it held locally and breached in CI at 4083, reading as a regression when it was not. It now pins `autoMaxTokens: false`, matching its own stated intent and the sibling case that had already learned this, and the auto-scaled path keeps its own test against the scaling ceiling

---

## [8.51.7] — 2026-09-28

### Added
- **Declared dependencies now reach the instruction file, for every ecosystem** (#747 follow-up, PR #749) — reported as "only npm projects write about the packages they use". `## versions (installed direct deps)` resolves versions out of `node_modules` and `site-packages`, so it can only ever describe npm and Python: a Maven, Go, Cargo, Gem or Composer project got **nothing**, and an npm project that had not run `npm install` got nothing either. A new `## dependencies (declared — <ecosystems>)` section carries the manifest-declared pins. It is labelled separately rather than merged, because "what the manifest asks for" and "what is installed here" are different claims — and the installed one is the stronger, so it still leads. The heading names the ecosystems it covers, so the claim is checkable rather than implied
- **Java and Kotlin imports appear in the `## deps` import map** (PR #749) — there was no JVM mapping whatsoever, so a file importing jackson produced an empty row while the POM beside it declared jackson. `extractJavaDeps` reduces an import to its package, drops the `java.*`/`javax.*` platform, and handles the static-import form whose trailing member is lowercase and so was not removed by the class rule
- **Prepared releases are tagged automatically on merge to `main`** (#751, PR #752) — pushing the tag was the last manual step of the release flow, and missing it is silent: **v8.51.5 sat untagged with npm serving 8.51.4 while `main` claimed 8.51.5**, and v8.51.6 repeated it a day later. The tag is what triggers `npm-publish.yml` and `release-binaries.yml`, so a missed tag means no release at all. `tag-on-merge.yml` tags a push to `main` only when `package.json` equals the newest `CHANGELOG.md` header and no such tag exists; every other state is a logged no-op, because a half-prepared release must never be published by accident. `SYNC_PAT` is required rather than optional — a tag pushed with `GITHUB_TOKEN` starts no other workflow, so it would leave a tag with no release behind it, strictly worse than not tagging — and the job refuses loudly instead of creating that state

### Fixed
- **Manifests were discovered at the repo ROOT only, so a multi-module build reported nothing** (#747, PR #748) — `collectDependencies` probed `cwd/<manifest>` and never walked, so the normal shape for Java — an aggregator POM whose `<modules>` hold the actual dependencies — reported `pom.xml  root@1.0.0  (0 deps)` with **every declared dependency invisible**. Same for a nested `requirements.txt` or any nested workspace. Now a bounded walk (depth 4, 200 manifests) reports each with its own path. Two things the fix surfaced and had to handle: the walk descended into whatever the repo deliberately excludes — sigmap's own `benchmarks/repos/` holds **43 cloned third-party repos**, and every one of their manifests was being reported as a sigmap dependency — so `findManifests` now reads the project's `exclude` config and `.contextignore` directly, and fixture trees are skipped for the same reason; and sorting the walk alphabetically silently reassigned project identity, because callers pick "the first manifest that has a name", so composer.json's `vendor/app` displaced package.json's `shop`. The sort now follows the order `MANIFESTS` declares, which is both stable and the meaningful precedence
- **`<parent>` shadowed the project's own identity in every Spring Boot POM** (#747, PR #748) — the identity scan took the first `<artifactId>` before `<dependencies>`, which is the parent's whenever one is declared, so the project reported itself as `spring-boot-starter-parent`. Now read from the POM's own coordinates, with the parent used only as the version fallback — Maven's own rule
- **`<dependencyManagement>` entries were counted as dependencies** (#747, PR #748) — those are version constraints, not dependencies. They inflated counts and leaked into `sigmap sbom` as components the project does not depend on
- **Maven scope collapsed to runtime/test, erasing the compile-time distinction** (#747, PR #748) — `provided`, `compile`, `runtime` and `system` all became `runtime`, so lombok at `<scope>provided</scope>` — a compile-time dependency that is **not shipped** — was indistinguishable from one that is. That is exactly the distinction an SBOM consumer needs. Scopes now map faithfully, and `<scope>import</scope>` is dropped, being a BOM pointer rather than a dependency
- **The `## deps` import map dropped every package, showing only internal wiring** (PR #749) — `extractTSDeps` matched only specifiers beginning with `.`, so `require('express')` and `import axios` produced nothing and a JS file's row named its relative imports but never the libraries it depends on. It now collects bare specifiers too (scope preserved, subpath dropped, `node:` and absolute ignored) and lists packages ahead of relative paths, since which libraries a file uses is the scarcer signal
- **`extractLuaDeps` was defined, exported, and dispatched from nowhere** (PR #749) — dead since it was written, so no `.lua` file ever contributed a dependency row. Now wired, with a test asserting it stays reachable
- **Nested types were under-reported or misattributed in Java, Swift and C#** (#741, PR #750) — three languages, three **different** root causes, which is why this could not be one shared patch. In C# the nested type was reported but its members were not: the member scan demanded an explicit `public|internal|protected`, and interface members are implicitly public — Java already drew this distinction via an `implicitPublic` option, and C# now does too. In Swift the type regex was anchored at column 0, so a nested type was never reported *while the member scan matched its methods against the enclosing block*, attributing them to the wrong owner. In Java the same column-0 anchor meant the nested type and its members were both absent — no misattribution, but no surface either. Correcting the reporting without scoping the members produces duplicates, exactly what happened in Kotlin/Scala (#738), so both halves land together and every test asserts zero exact duplicates. Measured on cached repos, 300-file samples: **akka 3,151 → 4,462 (+42%)**, serilog 1,108 → 1,163, alamofire 1,466 → 1,585, spring-petclinic 13 → 14. Duplicate counts are unchanged everywhere — alamofire's 22 are pre-existing anchor-less overload shapes, verified old-vs-new rather than assumed. The committed `test/expected/csharp.txt` recorded `interface IUserRepository  :31-35` with **no members** while the fixture declares two, and `--diagnose-extractors` reported that as a pass: the fifth committed expectation found this cycle asserting a bug was correct, after ruby (#735), kotlin and scala (#738), and the quality-page figures (#694)
- **CI skipped stacked pull requests entirely, leaving them permanently unmergeable** (#751, PR #752) — `ci.yml` filtered `pull_request` to `branches: [develop, main]`, so a PR whose base is another feature branch matched no workflow and ran only the external Snyk check. Required checks could then never be satisfied, so the PR sat blocked with no way to go green until the branch below it merged; #749 and #750 both hit this, and measured across the stack the two feature-based PRs had **zero** `pull_request` runs against #748's one. The filter is gone. The tag-decision logic is shell inside YAML — the kind of code never exercised until it misfires on `main` — so its tests extract that script and run it against real git repos rather than asserting on the text of the workflow; writing them caught two defects in the first draft, that `secrets` is unavailable in a step `if:` (the refusal would never have fired) and that `set -euo pipefail` plus a non-matching `grep` aborts the step (a CHANGELOG with only `[Unreleased]` would have failed every push to `main`)

### Changed
- **Average token reduction 96.1% → 95.9%, and the 0.2pp is the feature** — the new declared-dependencies section adds real content to every context file that has a manifest, so the reduction ratio falls slightly. The drop lands exactly where the two features landed, which is how the attribution was verified rather than assumed: express −1.5, okhttp −1.0, spring-petclinic −0.7, fastify −0.7 (manifest-bearing), serilog −0.5 and vapor −0.5 (the C#/Swift nested-type work), with the two R repos unchanged within noise at +0.1. express's context file now carries a `## dependencies (declared — npm)` block naming 30 package pins that were previously absent entirely. Every other headline metric is unmoved — **hit@5 78.6%, task-success proxy 61.0%, prompts per task 1.61, prompt reduction 43.4%**, and the honest grep pair at 86.4% vs 40.8% (2.12× lift). Worth stating plainly because the direction looks like a regression and is not: the ratio got worse because the artifact got more useful, which is the same trade recorded in v8.51.6 and the reason the retrieval corpus scores the budgeted context file rather than the extractor

---

## [8.51.6] — 2026-09-28

### Fixed
- **Nine extractors truncated, corrupted or dropped declarations at the first `)`** (#695, #696, PRs #739, #740, #742) — `\(([^)]*)\)` stops at the first closing paren, so a nested call in a default, a function-typed parameter or a `)` inside a string default ended the parameter scan early. One root cause, three symptoms: Swift rendered `func f(cb) → Int, n: Int) -> Int` (structurally malformed), C# and PHP silently lost the closing paren, and **C++ dropped whole declarations** — which then became `fake-symbol` false positives in `sigmap verify`, because a symbol that was never indexed cannot be grounded. Kotlin was the sharpest case: `fun f(a: Int = g(1, 2))` rendered `fun f(a, 2)`, a well-formed signature naming a parameter that does not exist. Swift, Dart, Rust, C#, PHP, Ruby, C++, Kotlin and Scala now resolve parameters with the shared balanced scanner (`src/extractors/scan.js`), joining Go and TypeScript/JavaScript. **Every committed happy-path fixture is byte-identical after the migration** — the change is confined to inputs the old scanner mishandled, and `test/adversarial-defects.json` is now empty for all twelve corpus languages
- **A body-less class swallowed the next class's body, hiding it entirely** (#738, PRs #739, #740) — `(?:[^{]*)\{` on the Kotlin and Scala type headers matched NEWLINES, so `data class A(val x: Int)` followed by `class B { … }` reported **A with B's members** and B appeared nowhere. Misattribution rather than truncation: every symbol named is real, just bolted to the wrong owner, which is exactly what `verify` cannot flag. It was live on both committed fixtures — `test/expected/kotlin.txt` recorded `class User :4-14` carrying UserService's methods, and `--diagnose-extractors` reported it as a pass. Measured on the benchmark corpus, the misattribution was hiding **more than half the types**: akka 836 → 2,545, okhttp 413 → 619, kotlinx-coroutines 450 → 670. Fixing the *finding* of nested types then exposed a second defect — a method inside a nested type was emitted under both the outer and the nested owner — so `blankNestedTypeBodies` scopes each member to its real owner; zero duplicate signatures remain across all three repos
- **A PHP declaration sharing its line with `<?php` extracted nothing at all** (#696, PR #742) — the top-level scan was anchored at column 0 and the opening tag occupied it, so `<?php function f($a) { … }` yielded an empty result while the own-line form worked. Common in short helper files, generated stubs and template partials, every symbol in which became a `fake-symbol` false positive. Now `function f($a)  :1-1`
- **Ruby emitted every top-level `def` after a blank line twice — and the test suite asserted that was correct** (#735, PR #736) — the member scan used `/^\s+def/gm`, and `\s` matches **newlines**, so `^\s+` spanned the blank line after an `end` and matched a column-0 `def` as if it were indented; the top-level pass then matched the same declaration again. `test/expected/ruby.txt` contained **both** the phantom indented member and the real entry, so a green 36/36 was ratifying a duplicated signature. Same character-class family as the `^`-anchored class regex closed in v8.51.1
- **Rust lifetimes read as char literals to the mask, dropping the declaration** (#695, PR #742) — `&'db`, `<'_>` and `'static` open a single quote, which `maskCode` treats as a char-literal opener; the mask desynchronised and the balanced reader failed silently. **208 signatures on rust-analyzer**, every one lifetime-annotated. Lifetimes are now blanked on the mask surface only, so the rendered signature keeps them and `'x'` stays a real char literal
- **A deleting comment strip desynchronised every extractor's scan surfaces** (#695, PR #742) — all nine used `replace(/\/\/.*$/gm, '')`, which REMOVES characters, while `maskCode` preserves length; offsets computed on one therefore did not address the other. Every migrated extractor now uses the length-preserving `stripComments`
- **Python's keyword-only `*` marker was dropped** (#702, PR #742) — `def f(a, *, b=2)` rendered `def f(a, b=...)`, implying `b` was positional. The AST tier now emits the bare separator
- **Dart deleted named-parameter groups wholesale** (#695, PR #742) — `replace(/\{[^}]*\}/g, '')` removed `{int b, int Function(int)? cb}` from every signature. That is real API surface; the group is now kept, with defaults dropped at depth 0

### Changed
- **The token budget now guarantees every module a foothold** (#743) — the budget spent itself strictly best-first across the whole repo, so one module could consume all of it. Measured on akka: `akka-stream` took **all 128 surviving slots** while `akka-actor` (192 files) and `akka-cluster` (28 files) got **zero** — two of three configured `srcDirs` rendered invisible. Completer extraction makes this strictly worse rather than better, because more signatures per file means the leading module exhausts the budget sooner; the nine-extractor work above briefly dropped measured hit@5 to 75.3% for exactly that reason, entirely from akka (1.0 → 0.4). The extraction was right and the drop order was wrong. A bounded per-module floor (24 files, capped at 60% of the budget) now runs before the global best-first pass, so a module can be thinned but never erased, and the first file of every module is always offered. A **single-module repo is byte-identical to before**, so only genuinely multi-module repos change. Two weaker designs were implemented and measured first and are recorded in the code so they are not re-attempted: equal round-robin recovered akka but cost rails (1.0 → 0.8) and gin (1.0 → 0.875), and strictly proportional share was worse than doing nothing (akka 0.4 → 0.2, rails 1.0 → 0.6). With the floor in place every headline metric returns to its pre-migration value while keeping the extractor improvements — **hit@5 78.6%, task-success proxy 61.0%, prompt reduction 43.4%** — and the honest grep pair was unaffected throughout at 86.4% vs 40.8% (2.12× lift). Worth naming because it will recur: the retrieval corpus scores the **budgeted context file**, so a completeness gain can lower a published number while improving the product
- **Rust extraction excludes code embedded in string literals** (#695, PR #742) — a consequence of moving to `maskCode`: declarations living inside `r##"…"##` test-fixture strings are no longer extracted as if real. rust-analyzer reads 5,514 → 5,502 signatures, and the 12 removed were phantom entries for functions the crate does not expose

---

## [8.51.5] — 2026-09-27

### Added
- **An adversarial extractor fixture corpus, with a defect ledger** (#702, PR #736) — `--diagnose-extractors` reported **36 fixtures, 36 pass, 0 fail** while ten languages corrupt, truncate or drop declarations on shapes that appear in ordinary code. The corpus was broad (one per language) but happy-path only, so it could not detect corruption — and it is the evidence cited for the tier labels in `KNOWN_LIMITATIONS.md`. `test/fixtures-adversarial/` now exercises 12 languages against nested calls in defaults, closure/function-typed parameters, nested generics, `)` inside string defaults, collection defaults and trailing commas; `test/expected-adversarial/` snapshots what each produces **today**; and `test/adversarial-defects.json` records which snapshot lines are wrong, the correct signature, and the owning issue. The ledger is load-bearing in both directions — behaviour drifting without a ledger update fails, and *fixing* a language also fails, which forces the entry out — so `defects: []` is a positive claim rather than absent testing. Measured, this corrects #695's own table: **Python is fine** via the AST tier (`def f(a, b=...)`; only the regex fallback drops it), and **Rust and C# carry defects #695 never measured** — Rust's `->`→`→` substitution fires on the *closure* arrow, so the return type is stated twice in two notations. `go` and `java` are clean controls, which is exactly what the shared balanced scanner buys the other eight
- **`sigmap gain --models`** (#665, PR #734) — thanks @AJambla — lists the known pricing model keys and their per-MTok rates, so a name can be checked before it is used

### Fixed
- **`gain --model <typo>` silently priced with the default model** (#665, PR #734) — thanks @AJambla — `resolvePrice()` mapped any unknown model key to `claude-sonnet` and the dashboard printed the resulting dollar figures with no notice, so a typo like `gpt4o` looked like a valid quote. It now returns `requested` + `fallback`, the gain handler emits one stderr line naming the requested model, the model actually used and its rate, and `gain --models` lists the alternatives. Exit code and dashboard output are unchanged — the fallback is **disclosed, not removed**, which is the right call for a figure someone may already be quoting
- **Ruby emitted every top-level `def` after a blank line twice — and the test suite asserted that was correct** (#735, PR #736) — `src/extractors/ruby.js` scanned class members with `/^\s+def/gm`, and `\s` matches **newlines**, so `^\s+` spanned the blank line after an `end` and matched a column-0 `def` as if it were indented; the top-level pass then matched the same declaration again. The committed `test/expected/ruby.txt` contained **both** the phantom indented member and the real top-level entry, so `--diagnose-extractors` reported a green 36/36 while ratifying a duplicated signature. Same class as the `^`-anchored class regex closed in v8.51.1 — a character class meant to express "indentation" that also matched line breaks. Now `/^[ \t]+def/gm`, the expectation is corrected, and a guard fails any committed expectation containing a duplicate signature
- **Published language/extractor/MCP-tool counts drifted wherever `sync-metrics` did not reach** (#697, #698, PR #733) — `sync-metrics.mjs` wrote only `version.json` and `README.md`, so the `docs-vp/` site that actually deploys to sigmap.io was hand-maintained: `languages.md` stated **31** in both of its SEO `content:` meta lines and **36** in its body, on one page, and `repomix.md` said 29. The SEO lines are what search results and social cards render. Markers cannot fix that half — an HTML comment inside a YAML `content: "…"` string is emitted verbatim into the rendered `<meta>` tag — so `scripts/check-doc-counts.mjs` classifies every occurrence instead: **canonical** (must equal `version.json`), **exempt** (a different metric sharing the noun, with the reason recorded — `17 languages` is the source-root resolver's coverage, `13` is what the benchmark repos span), or **historical** (frozen roadmap rows). Anything matching none of the three fails as unclassified, so a new count cannot quietly become the next 31-vs-36. Wired into `check:metrics`, with `npm run fix:doc-counts` to rewrite drift
- **The README promised a line anchor for every symbol; five languages emit none** (#697, PR #733) — measured, Ruby, R, Lua, Elixir and C/C++ carry no `:start-end` anchors while JavaScript and Go do, and `KNOWN_LIMITATIONS.md` said so in its Tier-3 row while the README claimed the opposite. The claim is now scoped to the AST and anchored-regex tiers and points at the limitations page, with a test that re-measures real extractor output so it cannot drift back into an absolute. The tier table also named **none** of R, Lua, Elixir or Astro; all four are now placed, and Astro sits in **Tier 2, not Tier 3** — measured, its frontmatter script routes through the TS/JS path and does carry anchors

---

## [8.51.4] — 2026-09-26

### Fixed
- **The quality benchmark counted R as zero and published it as "0% grounding"** (#694, PR #731) — `countGroundedSymbols` tested every line of generated context against a hardcoded keyword-prefix allowlist (`function `, `class `, `def `, `fun `, `struct `, … plus a `→` return-arrow fallback), so any language whose signature begins with the **identifier** rather than a keyword matched nothing and counted as zero. R is the worst case: its signatures are shaped `name <- function(args)`, so ggplot2 counted **1** grounded symbol against **964** real signature lines — a 964× undercount, published as 0% grounding for a language the project markets as a headline capability, with a dedicated `benchmarks/R_LANGUAGE_BENCHMARKS.md` and an `r-language.test.js` in `npm test`. The generated context already delimits signatures as fenced blocks under `### <file>` headers, so counting non-empty lines inside those fences is language-agnostic and cannot silently read as zero when a new extractor lands. Three more repos were wrong the same way — **ggplot2 1 → 964 (0% → 51%)**, **shiny 0 → 548 (0% → 41%)**, **dplyr 2 → 517 (0% → 71%)**, **svelte 380 → 1108 (17% → 50%)**, vue-core 244 → 666, spring-petclinic 59 → 361 — moving the aggregate from 9,544 grounded / 57,290 dark to **15,674 / 51,183**. The counter is extracted to `scripts/lib/signature-count.mjs` so it is unit-testable; the benchmark script executes on import
- **`groundingPct` could exceed 100%** (#694, PR #731) — the ratio divides by `estimatedRawSymbols`, a `rawTokens / 200` **heuristic**, so a repo whose measured signature count beat the estimate printed an impossible percentage; okhttp published **114%**. When that happens the estimate is what is wrong, not the measurement, so the ratio is clamped, the row is flagged `estimateReliable: false`, and it is excluded from the reported average **with the exclusion and both counts printed** rather than silently dropped (`axios 183 > 161`, `okhttp 179 > 156` — 2 of 21 repos once the counting is correct). Same class as the `validate` coverage-above-100% bug closed in v8.49.2
- **A zero that coexists with a non-empty context now fails the suite** (#694, PR #731) — the R undercount published for months because nothing asserted that a repo with a full context file must count more than zero signatures. The suite now exits 1 and names the repo instead of writing the number into `quality.json` and the public benchmark page. `contextLines` is measured **inside** the hermetic wrapper alongside the signature count, since reading the file afterwards would measure the artifact the wrapper just restored (#706)

---

## [8.51.3] — 2026-09-26

### Fixed
- **Benchmark suites rewrote the shared corpus they were supposed to only read** (#706, PR #729) — `benchmarks/repos/*` is shared state, and `run-honest-benchmark` never regenerates: it reads each repo's context AS-IS via `runner.buildSigIndex`. So any suite that regenerated a repo and left the result on disk silently decided what every later suite measured — the headline hit@5 depended on which suite ran last, which is the exact opposite of the reproducibility the project claims. Two earlier fixes each closed only half the hole: #522 restored `gen-context.config.json` but not the generated context, and #480 restored the markdown adapters but omitted **`.context/`** — the directory holding `sig-index.json`, which is precisely what `ranker.buildSigIndex` reads ([`ranker.js:622`](https://github.com/manojmallick/sigmap/blob/main/src/retrieval/ranker.js#L622)). A function named `measureGroundingHermetic` therefore still rewrote the retrieval index on every call. Separately, `run-benchmark.mjs` restored nothing at all and generated with whatever config happened to be on disk, overwriting the canonical contexts with a **default** config. Measured on the 43-repo corpus: one pre-fix quality-suite run rewrote **42 of 86** tracked artifacts; after this change a full `--cross-suite` determinism run leaves all 86 byte-identical. New `scripts/lib/shared-repo-context.mjs` owns the whole artifact set (adapters + config + `.context/`) and the shared override table in one primitive that restores in a `finally`, so a throwing measure step cannot leak either; `run-quality-benchmark.mjs`, `run-benchmark.mjs` and `run-hallucination-benchmark.mjs` all regenerate through it and their hand-rolled restores are gone. Note that the `86.4% → 89.6%` swing reported in #706 **no longer reproduces on v8.51.2** — source-root auto-detection improved in v8.51.0, so several per-repo overrides are now redundant and the leak happens not to move the score today; the structural defect was still live, and the new guards assert **artifact bytes rather than a score** precisely because a score-based guard is what let #522 regress unnoticed
- **The determinism gate existed, worked, and nothing ran it** (#706, PR #729) — `scripts/check-benchmark-determinism.mjs` correctly detects cross-suite skew and `package.json` exposed it as `validate:benchmark-determinism`, but no workflow invoked it, which is why #522 could regress silently. A new `.github/workflows/benchmark-determinism.yml` runs the cross-suite gate on PRs touching `scripts/` or `benchmarks/`, and the corpus-free artifact-level guard now runs on **every** PR via the existing integration suite. The gate also stops reporting a missing corpus as a determinism failure: with no cached repos it prints an explicit SKIP and exits 0, because a false red is as corrosive to a trust claim as a false green

---

## [8.51.2] — 2026-09-25

### Added
- **A docs-nav guard that fails when a guide page has no sidebar entry** (#700, PR #724) — thanks @tunglambk — `docs-vp/guide/methodology.md` built and deployed, but no entry in `docs-vp/.vitepress/config.mts` pointed at it, so the page explaining how the benchmarks are produced was reachable only by typing the URL; the existing docs check only proved the site compiled. `test/integration/sidebar-coverage.test.js` derives the sidebar links from the config and the pages from disk, then asserts both directions, so a new page must be linked and a renamed one can't leave a dead link. Methodology is now in the Benchmarks sidebar group and cross-linked from all five benchmark pages, and the links that said "methodology" while pointing at the benchmark overview (`README.md`, `how-i-built-sigmap.md`, `local-llms.md`) now point at the page itself

### Fixed
- **The Python AST extractor never ran outside its own unit tests** (#693, PR #726) — thanks @rudi193-cmd — `python_ast.py` existed, was tested, and was documented in `KNOWN_LIMITATIONS.md` as Tier 1 ("Native CPython AST parse … when `python3` is on PATH"), but nothing in the shipped pipeline ever passed it a file path, so every Python file in production fell through to the Tier-2 regex tier. `extractFile` now threads the path to every extractor, and `python_ast.py` resolves from both the dev and packaged layouts. **This changes Python signature output where `python3` is available** — the tiers differ in ordering, in `self`, in `opts=...` versus `opts`, and in the `*` keyword marker — which is the documented Tier-1 behaviour finally taking effect rather than a new divergence. A repo built on a machine without `python3` still gets the regex tier, as the limitations table has always stated. Resolving this against v8.50.0's path-based pipeline routing needed care: passing the path to every extractor is what activates the AST tier, but gating it on `fs.existsSync` and falling back to `undefined` would have broken location-based routing for in-memory content, so the fallback is the original path string — `tryNativeExtract` returns `null` for a path it cannot read, so Python degrades to regex on its own
- **The two Python tiers disagreed on the implicit receiver** (follow-up to #693) — the regex tier has always filtered a leading `self`/`cls` ([`python.js:263`](https://github.com/manojmallick/sigmap/blob/main/src/extractors/python.js#L263)); the AST tier emitted it. Activating the AST tier in production surfaced the divergence immediately: **233 of flask's 235 methods** carried a receiver that conveys nothing, costing ~3% of Python signature bytes and making the same file extract differently depending on whether `python3` was installed. This is the same shape as the TS/JS accessor asymmetry closed in v8.51.1 — two code paths for one language, diverging because nothing compared them. The receiver is now dropped by POSITION AND NAME, so a `@staticmethod`'s real first argument and a parameter genuinely named `self` further along both survive, and defaults stay aligned. Seven tests now compare the tiers directly: same symbols, same parameter conventions, with the AST tier still carrying the type annotations that justify its token cost
- **Willow adapter payload and docs** (PR #726) — thanks @rudi193-cmd — `knowledge_ingest` now sends a `content` field, and the docs point at [willow-memory/willow-mcp](https://github.com/willow-memory/willow-mcp)
- **`cli.md` understated what `sync` writes** (#700, PR #724) — thanks @tunglambk — the `sync` section listed `llm.txt` and `llms.txt` and stopped its example after `llm.txt`, but the command also writes `llm-full.txt` and reports four files. The section now matches what the command actually prints. The `explain` section is also explicit about its three exclusion reasons — `.contextignore`, `srcDirs`, and an extractor that returned no signatures — and notes that it doesn't model the token budget
- **Config reference: dead keys removed, every `DEFAULTS` key documented, drift gated** (#708, PR #725) — thanks @tunglambk — `docs-vp/guide/config.md` documented `enrichTodos`, `enrichChanges` and `enrichCoverage`, none of which exists in `src/`, `packages/` or `gen-context.js`; `loadConfig` drops them as unknown keys, so the copy-paste sample config silently did nothing. Checking every key against `src/config/defaults.js` and its consumer also caught `outputPath` (the key is `output`), `retrieval.preset` (read by nothing) and `gainTracking` (dropped as unknown before `isTrackingEnabled` sees it), and found eleven keys the page omitted — `todos`, `changes`, `changesCommits`, `maxSigsPerFile`, `depMap`, `routing`, `impactRadius`, `format`, `exclude`, `tracking` and `impact.depth`. Three `DEFAULTS`-only keys are now listed with a factual note that nothing reads them (`adapters`, `mcp.autoRegister`, `impact.includeSigs`), so the table covers `DEFAULTS` exactly. New `test/integration/config-docs.test.js` derives the documented keys from the page's own tables and the accepted keys from `DEFAULTS`, fails on drift in either direction or on a sample block that uses an unknown key, and checks each documented default against `DEFAULTS` too — skipping abbreviated (`…`) and prose cells — which caught `diffPriority` (`false` → `true`), `srcDirs` (three of 42 entries shown as if the whole list) and `testDirs` (wrong order); `version.json`'s derived test count is synced to 173

---

## [8.51.1] — 2026-09-25

### Fixed
- **Mixin-composed classes were dropped entirely — 34% of a Lit codebase** (reported against [ing-bank/lion](https://github.com/ing-bank/lion)) — the class regex matched the heritage clause inline, `class (\w+)(?:\s+extends\s+([\w.]+))?\s*\{`, which cannot match a **call expression**. `extends LocalizeMixin(LitElement)` — the idiomatic Lit/web-component composition — failed the extends branch, and because that branch was optional the fallback needed `{` immediately after the class name and failed too. The result was not a missing `extends` annotation: the **entire class vanished** — no class line, no methods, nothing. On lion that was **111 of 326 classes (34%)**, including `LionProgressIndicator`, which extracted zero signatures despite being a plain, well-formed component. Both extractors now walk to the body brace with a bounded, depth-aware scan instead of matching the heritage inline, so any superclass expression resolves — including nested chains like `A(B(C(LitElement)))`. Measured on lion: **517 → 597 files, 797 → 1,017 symbols**, with 129 mixin compositions now visible
- **Indented classes were dropped** (same report) — the class regex was `^`-anchored with no allowance for leading whitespace, so a class had to start at column 0. That silently excluded the mixin-factory form every web-component library uses (`const Impl = superclass => class SlotMixin extends superclass { … }`), where the class sits indented on its own line. lion's `SlotMixin`, `ScopedElementsMixin` and friends now extract their members
- **TypeScript lost every `get`/`set` accessor** (found while fixing the above) — `javascript.js` had always carried `get`/`set` in its member-modifier list and `typescript.js` had not, so a TS class silently shed its accessors while the JS extractor kept them. That asymmetry is how the gap survived, and it matters most exactly where it was found: in a Lit component, `static get properties()` **is** the reactive surface. A test now pins that the two extractors agree on which members a class has

### Added
- **Source-root coverage gate** (`npm run validate:source-roots`) — source-root detection can return almost nothing while every existing gate still passes, which has now happened twice: the CI extractor was inert through a whole release, and multi-module JVM layouts indexed 4 files of 596 for far longer. Neither was caught, for the reason the JVM call-graph gate already documents about itself — the gated retrieval corpus is JavaScript and measures *ranking* over an index it assumes is populated. A ranker scores what it is given; it cannot report what detection never handed it. The gate asserts the input side directly: per repo, how many source files detection reaches out of how many exist. A 5% floor catches a collapse even if the baseline were recorded while broken (pre-fix okhttp reached 1.1%, akka 2.3%), and a 10%-tolerance baseline catches narrower regressions that stay above it (retrofit, 35 files against 196). Skips when `benchmarks/repos` is absent — every CI run — so 8 hermetic tests cover the guard itself
- **Known gap recorded, not fixed** — the gate's first real run found kotlinx-coroutines reaching ~10%: it uses a flat multiplatform layout (`<module>/<target>/src`, e.g. `kotlinx-coroutines-core/common/src`) rather than the `src/<sourceSet>/<lang>` form v8.51.0 covers. Recorded in the committed baseline so it cannot silently worsen

---

## [8.51.0] — 2026-09-25

### Fixed
- **Multi-module JVM projects indexed almost nothing** (PR #721) — a standard Gradle/Maven/sbt build keeps its code under `<module>/src/main/<lang>`, but the root-level candidate scan never reached it: `_countSourceFiles` looks two levels deep and the source sits at four, so every module scored 0 and the only survivor was whatever dir happened to hold a manifest. Measured before the fix: **okhttp indexed 4 files of 596, akka 29 of 2,651** — on the layout that covers a large share of the Java/Kotlin/Scala world. Module source sets are now enumerated directly, and the six-root cap (tuned for JS layouts, where six is generous) is lifted only for these builds, since one root per module is the correct answer rather than over-detection. Detection is **structural** — two or more module source dirs on disk — with Gradle `include`, Maven `<modules>` and sbt `lazy val … = project` as secondary signals, so a build file declaring modules that are not present cannot mislead it
- **Kotlin Multiplatform source sets were invisible** (PR #721) — everything assumed the source set is called `main`, which has not been true of Kotlin for years. okhttp's core module keeps 307 files under `okhttp/src/jvmMain/kotlin` and `src/androidMain/kotlin`, none of which matched. Source sets are now discovered rather than assumed, so `commonMain`, `jvmMain`, `androidMain`, `nativeMain` and custom sets are all found; anything test-shaped (`src/test`, `commonTest`, `androidHostTest`) is excluded, because test files are indexed by their own pass and must not become source roots
- **`JVM_PATH_PATTERN` was anchored to the repo root** (PR #721) — it matched `src/main/java` but not `<module>/src/main/java`, so it also silently withheld its +5.0 score from the `packages/<pkg>/src/main/java` candidates the monorepo branch had been enumerating all along

### Changed
- **Measured effect across 15 real repos** (PR #721) — okhttp 4 → 326 files, akka 29 → 582, retrofit 571 → 697, kotlinx-coroutines 40 → 90, gson 244 → 265. The nine non-JVM-multi-module repos in the same sweep (express, fastapi, httpx, laravel, clap, cobra, sidekiq, dio, upickle) scanned an **identical** file count before and after, so the change is confined to the layout it targets

---

## [8.50.1] — 2026-09-25

### Fixed
- **Three dependency-inventory defects found by field-testing against 10 real repos** (PR #719) — none crashed; all three put wrong rows into an SBOM, which is precisely the failure mode the "no CVE feed" decision exists to avoid. **(1) PEP 508 environment markers produced phantom packages** — httpx declares `"brotli; platform_python_implementation == 'CPython'"`, and a naive quoted-string sweep split it at the *inner* quotes and reported **`CPython` as a dependency**; `pkg:pypi/CPython` would have reached a scanner as a real component. TOML array strings are now matched by the outer quote style, and the `;` marker is stripped before the requirement is parsed. **(2) Composer platform constraints were emitted as components** — laravel produced 10 rows (`php`, `ext-mbstring`, `composer-runtime-api`, …) with no purl, because they have no registry entry; they stay in the inventory, where the PHP version bound is useful grounding, but are flagged and excluded from the SBOM. **(3) Wildcard versions were pinned** — dio's `cli_util: any` became `pkg:pub/cli_util@any`; a version must now contain a digit, so `any`/`latest`/`*` resolve to unversioned. Across all 10 repos the SBOM now emits **0 unresolvable and 0 wildcard components**
- **Gradle did not resolve its own version variables** (PR #719) — Maven `${property}` placeholders were resolved from the start, but the Gradle path left `"org.webjars.npm:bootstrap:${webjarsBootstrapVersion}"` carrying a literal placeholder as its version — the same uselessness the Maven resolution exists to prevent. `ext.NAME = "v"`, `def NAME = "v"`, `ext { }` blocks and `gradle.properties` are now resolved, in both `${name}` and bare `$name` form; an unknown variable stays literal rather than resolving to something wrong, and is never pinned. On spring-petclinic this takes the unresolved count to zero. (The version-catalog path was already correct: okhttp resolves 85/85 through `version.ref`.)
- **`strategy: "index"` overstated its own saving by up to 3x** (PR #719) — the reported figure compared the stub against the **uncapped** retrieval index, but `full` applies a token budget and never emits all of it. On fastapi that claimed ~64,667 tokens/turn where `full` actually emits ~19,910. Capping at the budget ceiling still overshot by ~26%, because the budget is a ceiling rather than an outcome, so the same `applyTokenBudget` pass `full` would run is now run and measured. The figure is now conservative — it counts the signature payload, not the usage/deps sections `full` also emits — and reports the basis inline (`~N after its budget`). Separately, a repo whose whole dump is smaller than stub + one query is now told that its **first** answer is cheaper under `full` even though every later turn is cheaper under `index`; reporting only the per-turn saving implied a first-turn win that is not there (measured on express: full 1,374 vs stub 537 + query 1,094)

- **The CI/pipeline extractor was correct but unreachable through `generate`** (PR #717 follow-up) — v8.50.0 shipped `src/extractors/pipeline.js` and wired it into `langFor`, but not into **file discovery**. `.github/workflows/` is a root dotdir: it is never in `srcDirs`, never auto-detected as a source root, and therefore never walked — so the generate pipeline never handed a workflow to the extractor. The extractor passed 29 direct tests while the feature did nothing in real use: on a repo with `src/` and `.github/workflows/ci.yml`, `sigmap ask "where does deploy happen"` returned **no workflow signatures at all** — the exact question the feature was built to answer. The fixture that made the tests pass lives under `test/fixtures/.github/workflows/`, which is reachable only because `collectTestEntries` sweeps `test/`, and that masked the gap. `collectPipelineEntries` now walks the CI locations (`.github`/`.gitea`/`.forgejo` workflow dirs, `.circleci`, `.woodpecker`, and the repo root for the single-file forms) and indexes anything the extractor's own `platformFor` claims, so routing cannot drift from `langFor`. Same contract as test files: **indexed so `sigmap ask` reaches them, never rendered into the prompt artifact**, so the generated context file stays byte-identical for anyone who was not asking for this. Five end-to-end tests now drive the CLI rather than the extractor — three of them fail against v8.50.0

---

## [8.50.0] — 2026-09-24

### Added
- **Semantic CI/pipeline extractor** (#3, PR #717) — the generic YAML scanner reduced a GitHub Actions workflow to four lines: `keys: [name, on, jobs]` plus one `job: <id>` each, with **no triggers, no runner, no steps, no `needs`, no secrets and no line anchors**. That answers none of the questions actually asked of a pipeline file — what runs on a PR, where deploy happens, which secrets release needs, why publish did not fire. `src/extractors/pipeline.js` parses these files structurally and emits semantic signatures with real `:start-end` anchors, so `sigmap lines` can jump straight to a job. Covers GitHub Actions (plus Gitea/Forgejo, same schema), composite `action.yml`, GitLab CI, CircleCI, Azure Pipelines, Bitbucket, Drone/Woodpecker, Docker Compose and Jenkinsfile. On the committed fixture: **4 flat keys → 9 anchored semantic lines** carrying triggers, runner, `needs`, `if` and the real commands. Zero-dependency by constraint — `scanYaml` is a small indentation-aware line scanner, not a YAML library; block scalars are skipped wholesale so shell bodies never parse as structure, and malformed input degrades to no signatures rather than throwing mid-build. Routing is by **path**, ahead of the extension map (`.github/workflows/ci.yml` is a workflow first and YAML second; `Jenkinsfile` has no extension at all), with a narrow content sniff in `yaml.js` for workflows vendored outside their conventional location. This also collapses the duplicate CI parsing `yaml.js` and `src/map/build-ci.js` had both been doing
- **Real dependency coordinates across nine ecosystems** (#2a, PR #717) — `config-manifest.js` detected manifests but extracted almost nothing from most of them: `pom.xml (maven) | present`, `requirements.txt (python) | present`. "Present" names a file without naming a single package or version, which is not grounding. `src/deps/inventory.js` reads **declared** dependencies out of the manifests themselves, so it works on a checkout that has never been installed: npm (all four scopes), `requirements.txt`, `pyproject.toml` (PEP 621 and Poetry), `pom.xml`, `build.gradle(.kts)`, Gradle version catalogs, `go.mod`, `Cargo.toml`, `Gemfile`, `composer.json`, `*.csproj` and `pubspec.yaml`. Two details carry the value: Maven `${property}` placeholders resolve against the POM's own `<properties>` (an unresolved `${jackson.version}` is exactly as useless as the "present" it replaces), and when a lockfile is present the **exact locked version wins over the declared range** — `^5.1.0` is not what the code runs against, and a model grounded on the wrong major writes the wrong API. TOML sections are split by a real table walker rather than a regex lookahead, because JavaScript has no `\Z` anchor and the obvious `(?=^\[|\Z)` fails to terminate the *last* table in a file — which is where `[dependencies.x]` and `[libraries]` usually live
- **`strategy: "index"` — always-on map, signatures on demand** (#1a, PR #717) — under `full`, the generated context file carries the whole budgeted signature dump and every adapter auto-injects it: **~13,900 tokens on this repo, paid on every session before a single question is asked**. That does not merely cost tokens, it *suppresses retrieval* — an agent already holding a superset of what `sigmap ask` would return is correct not to call it, so the push artifact was out-competing the pull path it exists to feed. The new strategy keeps the always-on file to a map (how to retrieve, module rollup, entry points, direct-dependency version pins) and leaves every signature in `.context/sig-index.json`, which `sigmap ask` already reads and no adapter injects. Measured on this repo: always-on **55,567 B (~13,892 tok) → 1,510 B (~377 tok)**, and a first answer **~13,892 tok → ~1,385 tok** (stub plus one `ask`). The retrieval index is written before the strategy branch for every strategy, so switching changes only *where* signatures are injected and never what retrieval can reach — pinned by a test asserting the index is byte-identical under `index` and `full`. **Ships opt-in:** `full` remains the default and the repo's own config still uses it, both pinned by tests; a default flip belongs in v9 behind a published before/after, not in a minor release
- **`sigmap sbom` — deterministic CycloneDX 1.5 export** (#2c', PR #717) — the ask behind this was "flag CVEs in my dependencies", and SigMap deliberately does **not** do that: a network-sourced vulnerability section would make two runs on the same commit disagree, contaminating the byte-reproducibility claim for every artifact SigMap produces; a stale or wrong CVE claim is worse than no claim and would mean owning a vulnerability feed forever; and osv-scanner, Dependabot, Trivy and `npm audit` already do it well and free. So SigMap emits the one thing those scanners need and cannot derive from a signature map — a complete component list: `sigmap sbom --out sbom.json && osv-scanner --sbom sbom.json`. Correct purls per ecosystem (maven splits groupId/artifactId into namespace + name, Go keeps its slash-separated module path and `v` prefix, npm scopes percent-encode the `@`). `serialNumber` and `metadata.timestamp` are optional in the spec and are **omitted** — both would vary run to run — and components sort by `bom-ref`, so output is byte-identical across runs
- **`sigmap deps`** (#2a, PR #717) — lists the same inventory for humans, grouped by ecosystem, marking which versions came from a lockfile (`--json`, `--runtime`). It states plainly that vulnerability scanning is out of scope and names what to pipe into instead, so the boundary is visible at the point of use rather than only in docs

### Changed
- **Extractor resolution understands paths, not just extensions** (PR #717) — `langFor` now routes CI/pipeline definitions by path before consulting `EXT_MAP`. Resolution stays single-source (#591): this is a path rule inside the one dispatcher, not a second extension map. The test harnesses that derive coverage from fixture filenames — `test/run.js`, `extractor-fixture-coverage`, `extractor-reachability` and `--diagnose-extractors` — now key fixtures by **relative path** so a path-routed extractor is exercised where it actually resolves, with the walk restricted to routing directories so the sample projects under `r-package/` and `binary-smoke/` are not mistaken for language snapshots
- **The generate summary no longer overclaims under `index`** (PR #717) — reporting a headline token-reduction percentage without saying the signatures merely moved would be an overclaim, so the summary now states they live in `.context/sig-index.json` and are pulled by `sigmap ask`. Relatedly, below the crossover (~400 tokens of signatures) the stub's fixed overhead costs *more* than inlining everything; those repos are told `strategy:"full" is cheaper here` rather than shown a saving of zero
- **SBOM versions derived from a range are labelled as inferred** (PR #717) — where a manifest declares a range rather than a pin, the lower bound is used (over-reporting rather than under-reporting against a vulnerability database) and the component carries `sigmap:versionInferred: lower-bound-of-range` with the original spec preserved in `sigmap:versionSpec`. `sigmap sbom` reports pinned-vs-inferred counts on stderr so callers can state how precise a scan result actually is
- **`config-manifest` renders coordinates instead of presence** (#2a, PR #717) — `PROJECT_MAP.md`'s manifest table now shows project identity and per-scope dependency counts per manifest, plus a direct-dependency pin list, replacing the bare `present` flag. Pins render in each ecosystem's own requirement syntax (`requests==2.31.0`, not `requests@==2.31.0`)

---

## [8.49.2] — 2026-09-16

### Fixed
- **A typo'd subcommand silently rewrote your context files** (#655, PR #710) — an unrecognized first argument fell through all 37 `args[0] === '…'` dispatch branches onto the **default generate path**, rewriting `AGENTS.md`, `CLAUDE.md`, `.github/copilot-instructions.md` and `.github/gemini-context.md` in the cwd and exiting 0. `sigmap bench` and `sigmap impact src/file.js` (the form some docs advertised — the real flag is `--impact`) both triggered it, so a typo was an unintended write with no warning. The CLI now carries a `KNOWN_COMMANDS` vocabulary and rejects an unrecognized bare word **before any dispatch**, exiting 1 with a zero-dependency levenshtein-2 suggestion (`unknown command 'asl' — Did you mean 'ask'?`); `bench` is gated on the `--submit` it always required. Bare invocation and every flag form are byte-identical to before
- **`--report --json` never fired its documented CI exit gate** (#656, PR #710) — the help text and docs promise "exits 1 if over budget" so pipelines can fail fast, but the report path set `process.exitCode = 1` and the dispatch tail's unconditional `process.exit(0)` clobbered it: the JSON said `overBudget: true` and the process exited 0, so **every CI job trusting that contract was silently green**. The gate now covers both renderings — text `--report` shares the semantics rather than only printing a warning — and report paths exit through a new `exitWithCode()` helper. `process.exitCode` is assigned in exactly one place, so no other dispatch path can lose a non-zero code
- **`learn` weight decay converged on 0 instead of the documented 1.0** (#657, PR #710) — maintenance decay multiplied every stored weight by `DECAY`, so `w * DECAY` trended to zero (floor-clamped at 0.30): penalties deepened forever and boosts eventually crossed below 1.0 into penalty territory, the opposite of what `sigmap weights` documents. Measured before the fix: a file penalized to 0.9 reached 0.696 after five unrelated `learn` calls. Decay is now `BASELINE + (w - BASELINE) * DECAY`, converging on neutral from both directions, and entries within `NEUTRAL_EPSILON` of 1.0 are pruned so `.context/weights.json` stops accumulating decayed-out noise. This also unblocks cross-session failure learning (G10), where a persistent store would have amplified the drift
- **`--impact` and `plan` mangled paths on every macOS checkout** (#658, PR #710) — dependency-graph node keys are lowercased for case-insensitive matching, so `path.relative(cwd, key)` found no common prefix against a real-case `cwd` and climbed to the filesystem root: `--impact` printed `../../../../-users-manojmallick-sigmap/…/src/scorer.js` in both human and `--json` output, and `plan` rendered `src/userservice.js` for `src/userService.js`. The BFS results were always correct — only rendering was broken. Graphs now carry a `realPaths` map (graph key → original-case path) and every display surface renders through one `displayPath()` helper in `src/graph/path-key.js`, the module that already owned the key convention. Swept: `--impact` human + JSON, `plan` impact radius, and the `wiki` hub/entry-point tables. Graph identity is unchanged, so dep/impact matching stays case-insensitive
- **`compare` burned ~30–60s and then crashed outside this repo** (#659, PR #711) — the handler unconditionally spawned the install-dir-anchored 21-repo retrieval benchmark, but neither `scripts/run-retrieval-benchmark.mjs` nor `benchmarks/tasks/` ships in the npm package, so from any installed copy it spawned the full matrix and died on `Could not parse benchmark output`. It now probes for both before spawning anything and falls back to the user's own `.context/benchmark-history.ndjson` — the same store `share` reads — so `compare` still gives real before/after numbers in any repo, reading only from cwd and writing nothing. ~30–60s and exit 1 becomes ~140ms and exit 0. Inside the source checkout the live comparison is unchanged
- **`validate` reported coverage above 100%** (#660, PR #711) — coverage was `sigIndex.size / fileList.length`, where numerator and denominator are different populations: the persisted index can hold files the current config no longer scopes (deletions, `srcDirs` changes, a different strategy). This repo reported **218%**, at which point the number means nothing. Coverage is now the intersection over the in-scope list — ≤ 100% by construction — and the two residuals are surfaced separately because they say different things: `notIndexed` is missing context, `staleEntries` is a stale index. The same repo now reports 98% (170/174) with 210 stale entries called out
- **Twelve shipped commands were missing from `--help`** (#661, PR #711) — `ask`, `compare`, `explain`, `history`, `judge`, `plan`, `roots`, `run`, `share`, `suggest-profile`, `sync` and `bench --submit` all dispatched but were undocumented at the help layer, compounding #655: a user following stale docs typed a form the dispatcher rejected. All twelve are now listed, grouped with their kin. `docs-vp/guide/cli.md` drift corrected in the same pass: `--routing` was described as *printing* a routing table when it is a generation flag that **embeds** hints in the output; `--suggest-tool` showed an output format the CLI no longer emits; `--eval` was undocumented as a `--benchmark` alias; and the ranker was called **TF-IDF** in two places when it is identifier-aware **BM25** plus keyword/path weights, graph and centrality boosts, and learned weights

### Added
- **`compare --run`** (#659, PR #711) — demands the live 21-repo comparison and exits 1 with an explanation when the benchmark corpus is absent, instead of silently falling back to local history. `compare --json` outside the checkout emits the history form (`{mode, available, runs, hitAt5, tokenReduction}`)
- **`validate` freshness residuals** (#660, PR #711) — `validate --json` gains `indexedInScope`, `notIndexed`, `staleEntries` and `totalFiles` alongside `coverage`; the text rendering warns when the index holds out-of-scope files. All additions are additive — the `--query` report shape is untouched
- **Two drift gates that turn doc rot into a CI failure** (#661, PR #711) — `test/integration/help-command-coverage.test.js` derives the command vocabulary from the **dispatch chain itself**, not from a hand-maintained list, then asserts every dispatched command has a `--help` line, is accepted by the #655 guard, and appears in `cli.md` — and that the guard vocabulary invents no command the dispatcher cannot handle, so the two cannot drift apart in either direction. It earned its keep on the first run by catching `explain`, `run` and `sync` missing from `cli.md` entirely, which the issue had not listed; those now have full sections. `test/integration/audit-criticals.test.js` and `audit-high.test.js` add 24 regression cases across the seven fixes above, run under a deliberately mixed-case temp root so the #658 shape actually reproduces

---

## [8.49.1] — 2026-09-15

### Fixed
- **Signature scanning no longer redacts type annotations** (#680, PR #681) — **regression fix for v8.49.0.** The Generic Secret pattern widened in PR #671 (below) is shared with the signature scanner, where `secretScan` is **on by default** and `scan()` replaces the *entire* signature line. In code an unquoted value token is a type annotation, not a secret, so `function hash(password: PasswordHasher)`, `interface Creds { api_key: ApiKeyProvider }` and `const secret: SecretManagerClient = …` were silently replaced with `[REDACTED — Generic Secret detected in …]` in generated `CLAUDE.md`/`AGENTS.md` — auth-related declarations disappearing from context with no warning. The two consumers are now split instead of either being weakened by a heuristic: the unquoted variant is marked `textOnly` and skipped by the scanner, while `sigmap redact` keeps it in full. Signature scanning is byte-identical to pre-#671; the `redact` fix below is unaffected and all of its tests pass unmodified. **Anyone on v8.49.0 with secret-adjacent type names should upgrade**

### Added
- **`sigmap redact` masks unquoted secrets (M7)** (#668, PR #671) — thanks @tunglambk — the Generic Secret pattern required a quoted value, so the common `.env`/YAML shape `password=SuperSecret123!` passed through unmasked while `password="SuperSecret123!"` was caught. The value alternation now also accepts an unquoted token up to whitespace/EOL (`password=…`, `api_key: …`), keeping the 8-character floor and the key list unchanged; quoted behaviour is byte-identical, and short (`password=x`), empty (`password=`) and benign lines are still ignored. _(Merged shortly before the v8.49.0 release cut, so the code shipped in v8.49.0; recorded here with its scanner-side correction above.)_

---

## [8.49.0] — 2026-09-15

### Added
- **Judge confidence + checked-claims explainability (J4)** (#653, PR #654) — the judge returned a verdict and reasons but not *how sure it is* or *what it actually checked*: grounded claims were only counted, so a verdict resting on word overlap alone looked identical to one backed by structural verification of every claim. `claimGrounding` now emits an additive `checked` array — one record per claim with its grounding route (`"context"`: the context quotes it; `"repo"`: the structural pass cleared it; `null`: ungrounded) — plus an Evidence-Pack-style `coverage` ratio, and `judge()` derives a deterministic **`confidence: { level, basis }`**: `high` when the structural pass ran, every claim grounded, and the score clears the threshold by ≥ 0.15; `medium` for lexical-only checks or thin margins (ungrounded symbol findings are medium-certainty by the verify taxonomy); `low` when no concrete claims exist and the verdict rests on word overlap alone. The `basis` names the factors, so the level is auditable, not oracular. Human output gains `Confidence` and `Claims` lines; all JSON additions are additive and existing consumers are untouched

---

## [8.48.0] — 2026-09-15

### Added
- **Repo-mined query expansion behind a measure gate (B2)** (#649, PR #650 + #651) — the static `EXPANSION_GROUPS` synonym table is a global prior; the new `src/retrieval/mined-expansions.js` mines a per-repo one: tokens co-occurring within the same file's path + signature vocabulary become weighted expansion candidates ("auth" ↔ "session" learned from *this* repo). Precision filters — document-frequency floor and ceiling, minimum co-occurrence, top-4 neighbors by conditional probability, static-pair exclusion — with deterministic sorted JSON cached at `.context/mined-expansions.json` (mtime-keyed). `expandQuery` merges mined synonyms below the curated weight (original > static ≥ mined, never overriding); wired opt-in as **`retrieval.minedExpansions`** through `ask`/`--query`/`query_context`. The measure gate (`npm run benchmark:mined-expansions`, report committed) covered **all 23 corpora (299 tasks)** after PR #651 fixed the corpus mapping that silently skipped the self-repo splits: cross-repo hit@5 **89.5% → 90.5%** (fastify +1) and JVM +1 (akka) — the first retrieval feature in the series to measure above zero — but the leak-free **hard split regressed 67/90 → 66/90** and overall MRR fell 0.562 → 0.559, the exact hit@5-only trap documented in `bm25.js`. **Default stays off**; the wins live on sparse-context repos and the standing benchmark is the gate for revisiting. Deterministic, diffable, zero deps — SigMap's answer to embeddings

---

## [8.47.0] — 2026-09-15

### Added
- **Java extractor on the balanced scanner + modern-Java surface (G4 increment 3)** (#646, PR #647) — the Java extractor still parsed with a naive comment strip and `[^)]*`/`<[^>]+>` captures: a `//` or `/*` inside a string corrupted the rest of the line, braces inside strings derailed the class-body depth count, an annotation with arguments on a parameter (`@Size(max = 10) String name`) truncated the param list, and a generic method with nested bounds was missed. It now runs on the shared `scan.js` core: string-aware comment stripping, masked brace counting, and balanced reads for member params, generic bounds, and type headers. The regexes also learn modern Java — **generic type names** (`interface Repository<T, ID>` was silently missing, as the old pinned fixture output itself proved), **records** with header components, **sealed/non-sealed** types, **implicit-public interface methods** (safe: interface bodies hold no statements), and annotation-argument params. Existing fixture output stays byte-identical with 11 new pinned lines. `.java` deliberately stays out of `EXACT_PARAM_EXTS` — Java has no top-level callables and dotted calls are never flagged, so nothing from a `.java` file could ever enter the arity index; the reasoning is recorded at the constant. Retrieval gate PASS

---

## [8.46.0] — 2026-09-14

### Added
- **Go extractor on the balanced scanner + Go joins arity-checked verification (G4 increment 2)** (#643, PR #644) — the Go extractor still parsed with `[^)]*` and a hand-rolled comment strip: a nested func-typed param (`func Apply(f func(int) error, n int)`) truncated at the first `)`, a generic function (`func Map[T, U any](…)`) was missed entirely, a generic receiver (`func (s *Stack[T]) Push(…)`) failed the receiver regex, and a `//` inside a string corrupted the rest of the line. It now runs on the shared `scan.js` core (the v8.27.0 JS/TS precedent): string-aware comment stripping, `readBalanced` parameter capture (nested func types, multiline lists), type parameters on funcs **and** types, generic receivers, and balanced interface-method params — existing fixture output stays byte-identical, nine new signature shapes are pinned. With Go params exact, `.go` joins `EXACT_PARAM_EXTS`: plain top-level funcs enter the D1 arity index (receiver methods stay out — dotted calls are never flagged), `parseParams` learns Go type-variadics via a depth-0 `...` scan (strictly conservative: variadic only suppresses flags), and ` ```go `/` ```golang ` blocks pass the guard's arity filter. Retrieval gate PASS (67/90 tasks, floor 70%, 4 tasks of headroom)

---

## [8.45.0] — 2026-09-14

### Added
- **Structural judge — the last grounding surface converges on the one engine (J1)** (#640, PR #641) — `sigmap judge` checked an answer's symbol/file/import claims with `ctxLower.includes()` against the context text alone, so a real repo symbol the context happened not to quote was flagged as a hallucination and the installed-library moat never fired at the judge surface. `claimGrounding` now delegates its structural half to the verify engine (the same `buildSymbolSet` + `buildLibraryIndex` map `sigmap verify` uses): with a cwd, a claim is grounded when the context quotes it **or** its check class ran and the guard did not flag it — repo symbols, `.d.ts`-exported library symbols, declared imports, and existing files stop false-flagging while fabrications still fail. `verify()`'s summary gains an additive `checks` field (`symbols`/`files`/`relativeImports`/`bareImports`/`scripts`) stating which claim classes actually ran, so "not flagged" is never mistaken for "verified" on a repo with no index. The CLI always passes cwd; cwd-less behavior is byte-identical; reasons say "not grounded in context or repo index" when the structural pass ran. One grounding engine, two commands
- **Configurable judge learning thresholds with derived defaults (J2)** (#638, PR #639) — the `--learn` boost/penalize band (0.75/0.40) and the 0.25 verdict threshold move from hardcoded constants into a new `judge` config section (`threshold`, `learnBoostAbove`, `learnPenalizeBelow`); the CLI seeds judge options from `loadConfig` and `--threshold` still overrides. The defaults are measured, not hand-picked: a drift-guard test constructs exact-ratio mixture answers from the repo's own ≥7-char vocabulary (stop-list-proof) — 80% context-grounded must land in the boost band, 30% in the penalize band — and pins the band ordering. Behavior at defaults is unchanged

---

## [8.44.0] — 2026-09-14

### Added
- **Knowledge map increment 4: evidence packs become views over the store** (#635, PR #636) — the #543 epic's last re-basing item, deferred in #632. A new `relatedTestsView(map, rels)` reads related tests for a whole file list from the store's `tests` edges in one pass (keys are the caller's original path strings; store-absent files are omitted so callers can fall back). `buildEvidencePack` sources `relatedTests` from the view with **byte-identical output** — `grounding.contextHash` parity with the legacy per-file discovery is pinned by test, and callers injecting `opts.sigIndex` keep the legacy path entirely, so fake-cwd unit builds create no `.context` cache. `buildPrEvidence` derives blast radius (`impactView`) and related tests from the cached store instead of rebuilding the signature index **and** import graph on every call, with the legacy rebuild retained as fallback; blast counts match the graph path, tests/routes are store-enriched supersets, and the report stays byte-stable given a fixed tree

### Fixed
- **Context-less stores dropped every graph edge on case-sensitive filesystems** (PR #636) — graph keys are lowercased, so `relOfGraphKey`'s realpath probe failed on Linux whenever the true path contained uppercase and the file was missing from the signature index, silently discarding all `imports` edges (surfaced as flaky CI where the mkdtemp suffix case decided the outcome). The probe now falls back to prefix-matching the lowercased cwd; a regression test pins an uppercase tmp dir without a gen-context run

---

## [8.43.0] — 2026-09-14

### Added
- **Knowledge map increment 3: `get_impact` and `get_architecture_overview` become views over the store** (#632, PR #633) — the #543 epic's derived-views plan lands. Both MCP handlers now read the mtime-cached store via `loadOrBuild` instead of rebuilding the import graph and signature index on **every call**. `impactView` keeps the graph path's exact BFS semantics (direct = level 1, transitive deeper, depth 0 = unlimited; parity pinned by a realpath-normalized set-equality test) and answers get richer from typed data: affected tests now include the store's discovered `tests` edges — a test covering an impacted file counts even when it doesn't import it — and route totals count real `route` nodes instead of PROJECT_MAP.md table lines (the old heuristic counted every table row in the file). File nodes carry a `tokens` estimate, graph-only endpoints get nodes via realpath recovery, and `SCHEMA_VERSION` bumps to 3. Evidence packs deliberately stay on their own path (schema-stable, hash-anchored artifact — deferred on the epic). Along the way the parity test exposed that the old path mangles displayed paths when the cwd contains capital letters (`../../t/…` artifacts on macOS tmpdirs) — the store's realpath handling is the correct one

---

## [8.42.0] — 2026-09-14

### Added
- **Knowledge map increment 2: env-var, migration, and script nodes + reads-env edges** (#629, PR #630) — the three node kinds from the #543 epic's proposed shape that increment 1 left out. The producers (`env-schema`, `migrations`, `build-ci`) now expose structured collectors alongside their unchanged markdown rendering, following the `collectRoutes` precedent — `collectEnvReads` gains the per-file attribution the old Set-based scan discarded. The store adds `env:<NAME>` nodes (with a committed-`.env.example` flag — example-declared-but-unread variables still get nodes, a dead-config signal), `migration:<rel>` nodes (parsed version/name), `script:<runner>:<name>` nodes (npm scripts, CI workflows, Makefile targets), and `reads-env` edges file → variable; `SCHEMA_VERSION` bumps to 2 so v1 caches rebuild. `query_knowledge_map` gains `{ env: "DATABASE_URL" }` — which files read a variable and whether a committed example declares it

### Fixed
- **The knowledge-map source was binary to git** (#629, PR #630) — the store's edge delimiter was a raw NUL byte embedded in the source, so git rendered every diff of `knowledge-map.js` as `Bin` (that is why PR #627's diff was unreviewable). The delimiter is now the escaped form (backslash-u0000 in source) — identical runtime behavior, reviewable text diffs, and a regression test pins the file stays NUL-free

---

## [8.41.0] — 2026-09-14

### Added
- **Unified knowledge map — increment 1 of the #543 epic** (#626, PR #627) — `src/map/knowledge-map.js` builds one typed store over what SigMap already extracts, instead of a new scan: **nodes** (`file`, `symbol`, `lib@version`, `route`) and **edges** (`imports`, `calls`, `defines`, `tests`, `uses-lib`, `exposes-route`) assembled from the signature index, dependency graph, call graph, library index, and route table. Serialization is canonical (sorted keys, NUL-delimited edge identity so route ids with spaces survive), cached at `.context/knowledge-map.json` keyed on context mtime, and schema-versioned (`SCHEMA_VERSION: 1`). Path identity is realpath-normalized with lowercased abs→rel matching, so macOS symlinked tmpdirs and the graph builder's lowercased keys resolve to the same node. A new **`query_knowledge_map` MCP tool (22nd tool)** answers `upgrade-impact` ("what breaks if I bump `zod`?" — lib → importing files → their dependents), `neighbors` (every typed edge touching one file), and `summary` (node/edge counts by kind) — the first cross-source query surface; later increments re-base `get_impact`/`get_architecture_overview`/evidence packs as views over the same store

---

## [8.40.0] — 2026-09-14

### Added
- **Elixir extractor (Tier 3)** (#538, PR #623) — `.ex`/`.exs` in the Lua/Ruby family: `defmodule` blocks with `@moduledoc` hints; `def`/`defp`/`defmacro` with params (parens optional, `when` guards stripped, `%User{} = user` patterns reduced to binding names, `\\` defaults dropped); `@spec` as a `→ ret` hint and `@doc` first sentence as a doc hint on the next def; single-underscore names filtered, dunder macros kept. Deps genuinely resolve: `alias`/`import`/`use`/`require` module names become graph edges via the `lib/` snake_case convention with longest-suffix matching — external modules miss the file set, so no false edges
- **Astro SFC extractor** (#539, PR #624) — `.astro` frontmatter between `---` fences is delegated to the real TypeScript extractor with anchors shifted to file coordinates (the non-exported `interface Props` convention handled by a same-line export prefix, so line numbers survive). Astro-specific passes add the `Astro.props` destructure, non-exported top-level functions, and awaited data-loading consts; capitalized template components land as a compact `uses A, B` hint. With #537's component surface (v8.39.0), every item in the #541 ranked build list has shipped

### Fixed
- **The CLI kept its own extension→extractor map, and it had drifted** (#538, PR #623) — a third resolution map, the exact class #591 eliminated, lacking `.lua` and `.gd`: **Lua and GDScript had been silently falling to the generic fallback in the generate pipeline** while their extractors passed every direct test. Deleted rather than patched — resolution now delegates to `dispatch.js` (verified a strict superset before deletion), and a regression test generates a repo with `.lua` + `.ex` files and asserts both reach their real extractors end-to-end

---

## [8.39.0] — 2026-09-14

### Added
- **Web-component surface: Lit, Angular, and vanilla custom elements** (#537, PR #621) — first item in the #541 ranked build list. The TS/JS extractors saw a component's class and methods but lost everything that makes it a component: the `@customElement` tag name, `@property`/`@state` reactive fields, Angular's `@Component` selector and `@Input`/`@Output` pairs, and the base class — for an agent those ARE the public API, and a query for `user-card` could never find `UserCard`. Decorator-aware enrichment in the hooks/Zustand idiom family (a shared `component-surface` helper used by both extractors, not a new extractor): component classes now print their `extends` base, a `custom element <tag>` or `selector 'app-x'` member, and typed reactive/input/output fields with decorator-line anchors; `customElements.define('x-y', Cls)` attaches the tag in both TS and JS. Every addition is gated on detecting a marker, and a marker separated from its class by real code does not attach (decorators-only gap, pinned by test). Byte-identity for non-component code verified two ways: the fixture suite unchanged, and an old-vs-new sweep across 1,291 real files (sigmap + zod + express + vue-core + svelte) with zero divergence

---

## [8.38.0] — 2026-09-14

### Added
- **T4: read-only SCIP import with a quality guard** (#618, PR #619) — the final rung of the #542 host-toolchain ladder; every checkbox on that epic is now done. `exactness: { scip: true }` reads a CI-produced `index.scip` at the repo root as a signature source: compiler-typed signatures free at extraction time, import only. A ~100-line **zero-dep protobuf wire reader** (varints + length-delimited, unknown fields skipped by wire type) parses the index — field numbers grounded from the scip bindings vendored by scip-typescript and validated against a real index that tool produced, never guessed. `documentation[0]` fences carry the compiler's own rendering (`function fetchUser<T extends { id: string; }>(id: string, opts?: ...)` — richer than the regex tier or the T2 AST walker), `documentation[1]` becomes the doc hint, definition occurrences give start anchors and `enclosing_range` real end lines, and `Metadata.tool_info` names the acceptance-gated header label (`toolchain=scip:<tool>@<version>`, composing with the T2/T3 labels). Same per-file quality guard as the LSP tier — a sparse or stale index entry can never lose surface vs the regex floor. Measured on zod with a real scip-typescript index (11 MB, parsed once in ~0.4s): 228 of 286 files served, 0 guard refusals, 58 uncovered files fell back silently — **effective signatures 1,185 → 8,173 (+590%)**. The ladder on one corpus: regex 1,185 · T2 AST 1,831 · T4 SCIP 8,173. Hermetic tests write their own minimal valid index with a ~30-line wire writer, so CI needs no SCIP tooling

---

## [8.37.1] — 2026-09-14

### Fixed
- **Full generate 15s → 0.97s: the return-hint regexes were quadratic** (#615, PR #616). A CPU profile put 93.6% of a full self-generate on the two JSDoc `@returns` patterns in `buildReturnHints` — their lazy `[\s\S]*?` gaps were free to scan across comment boundaries, so every docblock without a matching declaration tail walked toward end-of-file: O(n²) on docblock-dense files. This was the real cause of the CI timeout flakes that v8.37.0 recalibrated around; the timeouts treated the symptom, this removes the cause (CI test jobs dropped from ~3m30s to ~1m40s). Rewritten as one linear pass over well-formed docblocks with sticky declaration matches. Verified against the old implementation on 947 real files: 934 byte-identical, and every one of the 13 divergences is the old pattern's bug being fixed — the unbounded gap could bind a hint across an intervening comment to a later declaration (`composeHealth` carried a distant `object` tag instead of its own docblock's type; express's `stringify()` was labeled `ServerResponse` instead of `string`). Retrieval gate: hit@5 identical on all four corpora, hard MRR −0.001 from the corrected tokens, baseline re-recorded. A new guard test pins the correct binding semantics and a linear-time bound on a 3,000-docblock file

---

## [8.37.0] — 2026-09-14

### Added
- **T3 spike: zero-dep LSP client with a per-file quality guard** (#612, PR #613) — the second rung of the #542 host-toolchain ladder. `exactness: { lsp: true }` asks a language server the machine already has (clangd/gopls/rust-analyzer, or `exactness.lspServers` command overrides) for `textDocument/documentSymbol` and renders the hierarchical result — server-typed details, exact multiline ranges — into the signature vocabulary. The session is pipelined and synchronous: all six frames written up front via `spawnSync` (args array, never a shell), responses parsed from captured stdout; ~300ms per file with clangd, and a cross-run cache in `.context/lsp-cache.json` keyed by content hash + server binary size/mtime makes warm regenerates free. Measurement forced two designs the plan did not predict: a **per-file quality guard** — a server parsing standalone can be macro-blind (clangd reported 7 of `fmt/format.h`'s hundreds of symbols because `FMT_BEGIN_NAMESPACE` never expanded), so an LSP result is accepted only when it does not lose surface vs the regex tier, ties to LSP for exact anchors — and **dead-server marking scoped to true spawn errors only**, after one transient per-file failure poisoned the server for 12 of 19 files. Guarded, the tier is strictly non-losing: libuv (C) +37%, spdlog +15%, fmt +2% effective signatures vs regex alone. The header labels `toolchain=<server>@<version>` only for results actually accepted, composing with `typescript@<version>` from #609. Hermetic tests run a fake LSP server speaking the real framed protocol — positive path, both fallback shapes, cache hit/invalidation, and guard refusal all run in CI with no host tools

---

## [8.36.0] — 2026-09-14

### Added
- **T2 exactness: TypeScript via the target repo's own compiler** (#609, PR #610) — the first shipping increment of the #542 host-toolchain tier ladder. `exactness: { typescript: true }` parses `.ts` with the repo's own `node_modules/typescript` (the user's install, never bundled — the lib-index precedent), shipped dark behind the flag with a silent, byte-identical regex fallback for every failure shape: flag off, package absent, or package without the compiler API. That last shape is not hypothetical — **typescript@7**, the Go-native compiler and current npm latest, exposes only `version` through its CommonJS entry, so the resolver rejects it cleanly and 7.x repos stay on the regex floor until the LSP tier (#542 T3, which is what tsgo actually speaks); a hermetic test pins that exact package shape. Determinism honesty: when native extraction fires, the generated header's meta line carries `toolchain=typescript@<version>`, so byte-stability is stated per toolchain version (KNOWN_LIMITATIONS gains the opt-in AST tier row). Measured with typescript@5.9.3 on zod (286 files): 0 parse failures, 256/286 byte-identical, signatures 1,185 → 1,831 (+54%) — audited class by class: typed arrow consts whose annotations defeat the regex tier's `[^=]+` guard, exact end-line anchors across multiline declarations, and the removal of spurious "members" regex extracted from nested object-type literals. `.tsx` deferred: its extractor speaks a different output vocabulary and is its own increment

---

## [8.35.0] — 2026-09-13

### Added
- **Extractor ceilings raised to Java parity** (#576, PR #606) — completing the half of #576 that eec4a21 deliberately split out. Three layers of silent truncation raised together: per-class member ceilings 8 (6 for gdscript) → 120, per-file ceilings 25–50 → 200 so the configured `maxSigsPerFile` governs output rather than a literal buried in each extractor, and — the dominant hider on real repos — class-body scans capped at 2–5 KB in 11 extractors versus Java's 200 KB, which silently discarded every member past the window *and* anchored class end-lines short. akka's `scaladsl/Source.scala` now extracts 48 typed members spanning `:241-1033`; before, 8 members with the end anchor near the top of the file. The bare `methods.slice(0, 8)` in go/python/rust — missed by the disclosure pass because the guard regex only matched `members|sigs` — is now disclosed and raised, and the guard covers `methods`. The original attempt at this was rejected by CI reading hard hit@5 as 75.6% → 72.2%; re-measured with the order-invariant gate below, hard is 75.6% → 75.6% bit-stable. The rejection was the instrument. Cost, measured: jvm 23.0% → 21.3% (net −1 of 61, akka same-band reshuffles under a corpus with ~15× more visible members) and member-heavy repos keep 1–2pp more tokens (serilog 96.3% → 94.9%, okhttp 94.3% → 92.1%) with the token budget still capping context size
- **`server/discover` (MCP spec 2026-07-28)** implemented session-less, per the schema: `CacheableResult` envelope (`resultType`/`cacheScope`/`ttlMs`) + `supportedVersions` + `capabilities` + `serverInfo`, deterministic so the TTL stability promise holds. Clients can learn the honest version list before any handshake — forward-compatible plumbing, deliberately *not* a claim to serve that revision's whole surface (#545, PR #607)

### Fixed
- **Gate scores no longer depend on git history depth** (#596, PR #604). The graph-boost hop-1 loop evaluated its seed condition (`score > 0`) while mutating scores in place, so a zero-scored file boosted by an earlier-visited seed became a seed itself — but only when it sat after its booster in the index, and index order is what git history changes via the recent-commits hoist. 108 of 113 gate queries had such cascade seeds; reversing index insertion order alone changed the top-5 on 76 of 113 tasks. A shallow CI checkout therefore scored differently from a developer clone of the same commit — the disagreement that kept the retrieval baseline deliberately un-recorded for two releases. Seeds are now snapshotted before the loop (as the call-graph block always did, with the comment "so boosts never cascade") and hop-2 eligibility is frozen after hop-1. Ranking is bit-identical across insertion orders and git depths; hard rose 72.2% → 75.6% as removed cascade noise stopped crediting near-hub files (`truncate.js` carried graphBoost up to +10.4) into top-5 slots they had not earned. Baseline re-recorded and trustworthy again, unblocking #592 and #576
- **Token-budget drop order ran inverted on JVM repos** (#592, PR #605). "Drop test files first" only recognised `.test.`/`.spec.`/`_test.` filename patterns, so `src/test/java/**` and `*Tests.java` competed as ordinary production code — and won on recency. spring-petclinic's budget kept all 17 test files while dropping the application entry point, the `owner` entity package, and every owner template; the matrix retrieval benchmark could not return files that were not in the context, and no ranking change could have fixed it — the issue's original "sibling disambiguation" hypothesis did not survive measurement. Path-segment conventions (`test|tests|spec|specs|__tests__|e2e`) and PascalCase `*Test/*Tests/*Spec` suffixes now classify correctly (with a case guard so `contest.java` stays production), and entry points (`main.*`, `*Application.java`, `Program.cs`) get their own drop priority — the entry point is the most orientation-valuable file in a repo yet tiny, so the fewest-sigs tie-break was killing it. petclinic 60% → 80%, vapor 0% → 20%, riverpod 100% → 80% (three same-named `analysis_options.yaml` siblings became visible — completeness making ranking honestly harder), net +1 task across 18 repos; gated corpora untouched
- **MCP handshake echoed unspeakable protocol versions** (#544, PR #607). `initialize` returned whatever `protocolVersion` the client offered — the exact violation `@hasmcp/mcp-spec-test` reported, and the root cause of the companion report: the echo made the suite believe 2026-07-28 was supported, producing six phantom `server/discover` failures on a revision the server never really claimed (#545). Negotiation now runs against an explicit supported list (`2025-11-25` … `2024-11-05`); an unsupported or absent offer gets the newest supported version, never an echo, and `tools/list` rejects cursors it never issued with `-32602` (the spec's SHOULD) instead of silently restarting from page one. Conformance verdicts on both tested revisions went from **not conformant** (1 and 6 violations) to **conformant on what could be checked** (0 failures; remaining skips are honest inapplicability)

---

## [8.34.0] — 2026-09-13

### Added
- **Lua extractor** (Tier 3) — global and local functions, module-table functions (`function M.name`, `function M:name`), assigned functions, `require` module hints, and LDoc `---` doc comments as first-sentence hints (#540, PR #550) — thanks **@zerone0x**. The contribution shipped its own fixture and expected output, which is exactly what the #588 fixture guard now requires, contributed before that guard existed. Brought up to the disclosure convention it predates: its caps now report the true overflow rather than truncating silently, with the ceiling unchanged
- Call-graph definitions for **Kotlin and Scala** (#586, PR #602). `extractDefs` returned null for `.kt`/`.scala` and the walk did not collect them, so the graph was empty for both — and an empty graph returns no error, so `--impact` and blast radius silently read zero. That is the failure mode that cost a release in #561, and akka (Scala) sits in the gated JVM corpus, so CI exercised Scala in a way that could never detect it. Adds `jvmBodyRange` for expression bodies (`fun f() = expr`), which Java does not have. On a small Kotlin+Scala tree: 0 symbols / 0 edges → 8 / 2. Scope is pinned by test — same-file calls resolve, cross-file *receiver* calls do not yet, because receiver typing is Java-shaped

### Fixed
- Generated `context-*.md` splits from a previous `strategy` no longer pollute retrieval (#555, PR #601). Splits are discovered by filename pattern at read time, not by consulting the config, so a file left by an earlier strategy — or by a module since dropped from `srcDirs` — kept being merged into the index and steering every query. On a 524-file Java repo a stale 376 KB split held ranks 1, 3 and 4 with generated entities, one unrelated to the query, while both files implementing the feature fell outside the top 6 — with `sig-index.json` correctly holding zero entries for it. Each strategy now declares what it wrote and the rest is pruned, and the prune is reported rather than silent

---

## [8.33.0] — 2026-09-13

### Added
- The generated artifact now **says when the token budget left files out**. The `[sigmap] budget: dropped N file(s)` warning only ever went to stderr, which an agent reading the file never sees — on flask that meant 25 of 51 files present with no indication the other 26 existed, indistinguishable from a 25-file repo. `applyTokenBudget` attaches a non-enumerable summary to the array it returns, so all four call sites (full, per-module, hot-cold) gain the footer without a signature change. The wording states that the omitted files are still in the retrieval index and reachable via `sigmap ask`, and a test asserts it does not overstate the loss — replacing a misleading silence with a misleading warning would be no improvement (#587, PR #599)
- A test fixture for **every** language extractor, plus a guard that fails when one is missing (#588, PR #595). The 8 languages named in the issue were only part of it: the guard immediately found a ninth, `typescript_react` — `.tsx`, every React component, and the extractor that shipped a silent truncation cap in v8.32.0. It also caught a stale `test/expected/vue.txt` that outlived the `vue.js` deleted in v8.32.1, which had been making `--diagnose-extractors` print a silent `SKIP`. That diagnostic went from 21 passing with an unnoticed SKIP to 32 passing with none

### Fixed
- NestJS route paths now compose the `@Controller` prefix. `@Controller('cats')` + `@Get(':id')` emitted `:id` rather than `/cats/:id`, so the route pseudo-signature matched nothing a user would ask about — defeating the purpose of the feature, which exists so a route-worded query can reach a controller whose signatures never mention the path. The prefix is attributed per controller rather than per file, since a file may declare several. The other six claimed frameworks were verified unchanged (#585, PR #598)

### Changed
- Extractor resolution has **one source of truth**. Three places decided which extractor module to load and two had drifted: `src/eval/analyzer.js` carried a dead duplicate `.vue` key, and the `--diagnose-extractors` map still pointed at `vue.js` after that module was deleted — which is how an unreachable extractor survived unnoticed in the first place. The hand-maintained copy was also incomplete, with no `.gd` entry, so gdscript was never actually diagnosed despite having both a fixture and recorded expected output. `language-detector.js` and `dashboard.js` are deliberately **not** merged in: they map `.tsx` for language *statistics* and display *labels*, not resolution, and a test pins that distinction so a future dedup cannot quietly break language counts (#591, PR #597)

---

## [8.32.1] — 2026-09-13


### Fixed
- **Retraction of a v8.32.0 claim.** That release stated "every extractor now discloses what a ceiling dropped". It did not. `vue.js` was registered but unreachable (`.vue` dispatches to `vue_sfc`), so disclosure was added to dead code while the live `.vue` handler kept truncating silently; `.tsx` (every React component), `.properties`, `.toml` and `.md` still cut output with a bare `slice()`; and `r.js` called `capWithNotice` but eight inner caps stopped collection at the ceiling so it never fired — and when forced to, reported `+1 more` where 50 signatures were hidden. All fixed, ceilings unchanged, with a test that fails against the pre-fix extractors. The root cause was that three of those languages have no test fixture (#582, #583, #584, #588)
- The walk depth hid most code in JVM package layouts: `maxDepth: 6` indexed **6 of 47** Java files on spring-petclinic, because Java puts one directory per package segment. #561 had already raised the *graph* walk to 12, so extraction was the shallower half of an inconsistent pair. Depth now rises to 12 only for JVM layouts; an explicit `maxDepth` always wins. Gated JVM corpus 16.4% → 23.0% (#590)

### Changed
- Published retrieval hit@5 moves 81.1% → 78.9%. One of 18 repos accounts for it: spring-petclinic 100% → 60%, previously measured against an index holding 6 of 47 Java files. The leak-free `mined` corpus is flat and the leak-free `jvm` corpus improves, so the prior figure was inflated by under-indexing rather than this being a ranking regression. The two affected tasks are tracked as a ranking weakness the missing files were concealing (#592)

---

## [8.32.0] — 2026-09-12

### Added
- A gated **JVM retrieval corpus** — 61 tasks mined from `spring-petclinic` (32) and `akka` (29), leak-checked so no query shares a stemmed token with its expected file's basename. It scores against *other* repos, which puts it outside the feedback loop that makes the `hard` split move whenever sigmap's own source changes. `scripts/mine-corpus.mjs` gained `--repo` and gates its sigmap-specific rules on the target being sigmap itself, with byte-identical default output (#577, closes #575)
- `test/integration/docs-markdown.test.js` — guards the VitePress sources against the two failure modes that can break the docs build *after* a release is already tagged: unbalanced code fences, and `{{ }}` outside a fenced block, which Vue parses as an interpolation (#574, closes #573)

### Fixed
- Every extractor now **discloses what a ceiling dropped** instead of truncating silently. 20 extractors gained `… +N more` markers on their member and per-file caps (23 now carry them in total). The ceilings themselves are unchanged — raising them is a separate, measured decision (#578, #576)
  > **Correction (2026-09-13):** "every extractor" was wrong as published. `vue.js` was dead code — `.vue` dispatches to `vue_sfc` — so one of the 20 was unreachable; four reachable extractors (`.tsx`, `.properties`, `.toml`, `.md`) still truncated silently; and `r.js`'s disclosure was defeated by eight inner caps. Corrected in #589 (#582, #583, #584).
- The retrieval gate reused a gitignored index, so a "regression" could be pure staleness — this produced three separate false investigations, including one re-baseline. It now regenerates every index it scores, including one per JVM repo driven from `benchmarks/config-overrides.json` rather than a hand-written config (#579)
- The `sigmap lines` CLI example nested a fenced block inside a text fence; the inner fence closed early and a brace expression became a Vue interpolation. This failed the Pages build *after* v8.31.0 was tagged and published (#574)

### Changed
- The `hard` corpus is now **reported but not enforced** against the previous run — only against its 70% floor. Proven necessary in CI: a probe branch containing one two-assertion test file and no source change scored 75.6% → 74.4% and failed the gate, because `hard` scores sigmap against its own source and BM25 statistics shift with the indexed file set. `mined` and `jvm` keep `--no-regress` (#579)
- JVM baseline re-recorded at 16.4% hit@5 (from 18.0%) — a single task. `akka:m018` expects `Logging.scala`, which holds a class the 8-member ceiling truncates, so disclosure adds one `… +N more methods` line and BM25's length normalisation drops it from rank 5 to 6. A fix excluding markers from the scored term space did not move the number and was reverted rather than left in as unexplained complexity (#578)

## [8.31.0] — 2026-09-08

### Added
- `sigmap lines <file> <start>-<end>` — the CLI twin of the `get_lines` MCP tool, for environments where MCP is unavailable. Accepts a `:94` anchor pasted straight off a signature with `--context N`. Delegates to the same handler as MCP, so it shares the project-root sandbox, EOF clamping and secret redaction (#568)
- Spring interface calls now link to their implementation, so blast radius on the class that owns the code is no longer empty. Exactly one implementation resolves outright; several resolve only via a single `@Primary`; anything still ambiguous produces no edge rather than a guess (#565)
- A JVM call-graph gate (`npm run validate:callgraph-jvm`) asserting named caller→callee pairs and edge volume against a committed baseline — offline and deterministic. Verified to fail on a simulated revert (#567)

### Fixed
- The dependency graph was **empty** on Maven/Gradle repos: `buildFromCwd` hard-coded `srcDirs` to `src`/`app`/`lib`/`R`/`inst` and never read the project config, then capped the walk at 8 directories. Java package-import resolution already worked but was never reached. On a 524-file Spring repo: 0 → 524 nodes, 341 with importers (#561)
- The Java call graph discarded every `receiver.method(` call — 58% of call sites in a real Spring module — so controller→service edges did not exist. Receiver types are now resolved from field and local declarations; unresolvable receivers still produce no edge. Interface method declarations are indexed so calls to them have a target. On the same repo: 0 → 10,213 edges (#563)

### Changed
- Retrieval baseline re-recorded. The hard split moved 76.7% → 74.4% purely because the index is regenerated under a token budget and this release added ~1,000 lines; holding the index fixed, pre- and post-merge code produce identical results and the same 23 misses. MRR rose 0.639 → 0.644 (#569)

## [8.30.0] — 2026-09-07

### Added
- `sigmap-task` — an invokable prompt skill that drives the full grounding loop from the CLI, for environments where MCP is unavailable. Installs to `.github/prompts/sigmap-task.prompt.md` for Copilot (`/sigmap-task`) and through the normal skill path for other clients (#554)

### Fixed
- Java extractor: lifted three hard-coded caps that hid 85% of the API surface on real Java repos — an 8-member-per-class limit applied silently, a 25-signature-per-file cap that shadowed `maxSigsPerFile`, and a 5,000-character class-body scan limit. Omissions are now disclosed with a `… +N more` marker, matching the JS/TS path (#552)
- Retrieval: generated data holders no longer outrank real logic. A file whose members are overwhelmingly trivial accessors is demoted like other generated code, with an escape hatch when the query asks for an entity, model, DTO or accessor. Entities remain retrievable by their own symbols (#552)
- `sigmap mcp install vscode` wrote a config VS Code ignores — it emitted a top-level `mcpServers` key where VS Code requires `servers` with an explicit `type`. A config written by an earlier version is now migrated rather than left in place (#557)

## [8.29.0] — 2026-09-01

Minor release — **"Retrieval Index Split" (v8.29)**: the ranker stops reading the token-budgeted prompt artifact, and the ranking features that were silently inert start executing. Plus the first benchmark corpus this project did not author itself.

### Added
- **Complete retrieval index, separate from the prompt (#546, PR #547):** new `src/retrieval/sig-index-store.js` writes every extracted file to `.context/sig-index.json` **before** `applyTokenBudget` and before the strategy split, so it is complete for `full`, `per-module` and `hot-cold` alike; atomic write-then-rename so a concurrent `ask` never reads a half-written index. `buildSigIndex` merges it as the **base** (not on top): `_mergeSigIndex` only replaces when the source has *more* signatures, and a budget-collapsed entry has the same count as its full form, so merging the other way would have kept the anchors. Previously the ranker parsed the budgeted context file, so every file the budget dropped was unreachable at any rank — **53 of 155 source files here (34%)**. No ranking change can surface a file that is not indexed.
- **Index-only enrichment.** Module-header prose (`src/retrieval/module-doc.js`) is indexed but never rendered into a prompt: signatures describe a file's *shape*, the header describes its *purpose*, which is the vocabulary a behavioural query actually uses. Licence boilerplate is filtered (high df, no query value). Test files are indexed too — previously not scanned at all, so "where are the tests for X" had no answer at any rank. Neither reaches the prompt artifact.
- **Declared entrypoints are always scanned** — `package.json` `main` and every `bin` target, when they live outside `srcDirs`. A CLI's entrypoint is usually at the repo root and was therefore unindexed.
- **Leak-free benchmark corpora + CI gate.** `benchmarks/tasks/retrieval-hard.jsonl` (90 hand-authored leak-free tasks) and `benchmarks/tasks/retrieval-mined.jsonl` — mined by `scripts/mine-corpus.mjs` from commit subjects paired with the files those commits touched, so **nobody tuning the ranker wrote them**; a leaking query is dropped, never rewritten. `scripts/check-corpus.mjs` adds a verbatim 4-gram check on top of the existing basename-leakage check, because once module prose is indexed a query paraphrased from a file's own header is trivially retrievable. `scripts/run-retrieval-gate.mjs` (`npm run validate:retrieval`) gates CI on floor, regression and corpus hygiene, and runs with learned weights disabled so a developer's local `.context/weights.json` cannot change what CI sees.

### Fixed
- **Import- and call-graph boosts were inert.** `ask` never passed `graph` at all, and the lookup could not have matched anyway: `src/graph/builder.js` keyed nodes through `normalizePath` (lowercased) while `src/graph/call-graph.js` used a case-preserving `path.resolve`, so every `.get()` missed on any repo path containing an uppercase letter — i.e. every real checkout under `/Users/…` or `C:\Users\…`. New `src/graph/path-key.js` is the single key definition both builders delegate to. The centrality blend already carried a local `|| map.get(abs.toLowerCase())` workaround; that divergence is now removed at the source.
- **Scoring weights were dead config.** `rank()` discarded `scoreFile`'s score and kept only its penalty, so `DEFAULT_WEIGHTS` and all seven intent profiles changed nothing — zeroing every weight produced byte-identical rankings across 20 queries. The signal is now blended into the score (bounded and multiplicative, so it reorders matches and can never lift a zero-BM25 file). The per-intent profiles are **removed**: with the signal wired, a sweep on the leak-free corpus showed intent-specific weights producing identical metrics to a flat set at every blend value.
- **Negative-signal penalties fought the query.** A test file was multiplied by 0.4 even when the query asked for tests. Penalties now read the query terms directly rather than routing through `detectIntent` — that classifier is first-match-wins over its pattern object and `debug` precedes `test`, so "fix the failing test" classified as debug and never reached the test branch.
- **Line anchors leaked into the term space.** The strip was end-anchored, but extractors append a doc hint *after* the anchor, so 27% of signatures contributed their line numbers as index terms (840 junk tokens) — inflating document length for exactly the best-documented files, which BM25 then penalised through length normalisation. The ranker is documented as anchor-invariant; it now is.
- **Intent detection is multi-label** (`detectIntents`), ranked by match count, so `debug` no longer shadows `test`. Fixing it surfaced a second bug: `\btest\b` does not match "tests", so "write unit tests for the ranker" matched no intent at all and fell through to the default. Patterns now handle plurals across all seven intents; `sigmap ask` reports every matched intent.
- **The benchmark measured code users never ran.** `src/eval/runner.js` carried its own `rank` **and** its own `buildSigIndex` (hardcoded to `.github/copilot-instructions.md`), both bypassing production — so no ranking regression could appear in the numbers. Both now delegate.

### Changed
- Measured on leak-free corpora, ranker changes only: self-authored 90-task hit@5 **45.0% → 76.7%**; the independent mined corpus reads **60.9%**. The bias ladder those three corpora expose — leaky 90.0% / self-authored 76.7% / independent 60.9% — is why the mined split exists and is gated. It is small (1 task ≈ 4.3pp) and the defensible miner parameter range spans 53–73%, so it is documented as a band, not a point.
- Prompt artifacts do not grow: `CLAUDE.md` stays ~55KB; the 176KB retrieval index lives in gitignored `.context/`.
- Rejected after measurement, with reasons recorded in source so they are not re-derived: same-line locality, full per-symbol doc-hint recovery, pseudo-relevance feedback, and a name/body BM25F split — the last raised hit@5 by one task while lowering hit@1, hit@3 and MRR.
- `npm run test:integration` now runs `test/integration/all.js`; the hardcoded subset it ran before diverged from CI and was hiding failures.
- 14 new integration guards (`test/integration/retrieval-index.test.js`), each verified to fail when its bug is reintroduced; 139 test files; bundle rebuilt (154 modules); zero new dependencies.
- **npm Trusted Publishing (OIDC)** replaces the expiring automation token in the release workflow.

---

## [8.28.1] — 2026-08-22

Patch release — two silent-failure bug fixes: a false "zero importers" in the Python import graph, and an empty index under the per-module strategy.

### Fixed
- **Python absolute imports resolve through any ancestor root (#532, PR #533)** — reported and precisely diagnosed by **@ruurdboeke**, thank you: `extractFileDeps` probed only the importing file's directory and one parent for `from package.module import`, so `src/`-layout projects (source root on `sys.path`) silently produced no graph edge whenever the importer sat two or more directories below the root — and `get_impact` then reported **zero importers**, exactly the signal that says a change is safe to make. Fix: an ancestor walk from the importing file up to the project root (nearest first, 16-level cap), probing `<module>.py` and `<module>/__init__.py` per level; nearest-first preserves the old first-match semantics for same-dir/one-parent cases. 4 new tests incl. the verbatim issue repro and `get_impact` end-to-end.
- **Per-module strategy: `ask`/`query_context` find signatures again (#534, PR #535):** the per-module strategy writes one `context-<module>.md` per top-level srcDir and leaves the primary file as a thin overview — but the sig-index strategy enrichment merged only `context-cold.md` (hot-cold) plus the cache, so `sigmap ask` failed with "no context file found" and the `query_context` MCP tool returned an empty index on every per-module repo. Fix: enumerate `.github/context-*.md` (sorted, deterministic) and merge each — the cold-file merge generalized to every strategy split. 4 new tests on a real generated two-module fixture incl. the exact reported failure; hot-cold and full strategies verified unchanged.

### Changed
- 8 new integration tests (138 test files); bundle rebuilt; zero new dependencies.

---

## [8.28.0] — 2026-08-18

Minor release — **"Arity Guard" (v8.28, D1)**: verification now checks not just *does this function exist* but *is it being called with a plausible number of arguments* — the payoff of the v8.27 balanced scanner.

### Added
- **Arity-checked verification (#529, PR #530):** new `src/verify/arity.js` — `parseParams` turns a signature's exact parameter list into an arity range (`=` defaults and TS `?`-optionals lower `min`; `...rest`/`*args`/`**kwargs` mark the signature variadic; destructuring patterns count as one parameter; depth- and quote-aware throughout), `buildArityIndex` builds a per-name range from top-level callables in exact-param languages only (JS/TS via the balanced scanner, Python via AST; names whose signatures disagree across files are marked ambiguous and never checked; indented members excluded), `extractCallArgCounts` reads calls from answer code over masked text (nested calls and comma-containing strings count correctly; argument emptiness judged on the original text; dotted calls, definitions, `new`-expressions, and control keywords skipped), `checkArity` (variadic signatures flag only too-few). Wired into the Hallucination Guard as detector 3b — **`arity-mismatch` at medium confidence**, with the repo signature + file as the suggestion; `verify_suggestion` (MCP) and `sigmap verify-ai-output` inherit automatically; `opts.arityIndex` keeps hermetic callers unchanged. Conservative by construction: uniquely-resolved · top-level · non-variadic · undotted · known-symbol calls in JS/TS/Python code blocks only — unknowns stay `fake-symbol`. `KNOWN_LIMITATIONS.md` documents the checks and their gates.

### Changed
- 6 new integration tests incl. end-to-end through a real context file (136 test files); bundle rebuilt (151 modules); zero new dependencies.

---

## [8.27.0] — 2026-08-18

Minor release — **"Tokenizer Core I" (v8.27, G4 increment 1)**: the hand-rolled balanced scanner lands and JS/TS extraction stops truncating at the first `)` — the first slice of the v9.0 grounding track and the stated precondition for arity-checked verification (D1).

### Added
- **Shared balanced scanner (#526, PR #527):** new `src/extractors/scan.js` — three deterministic, length- and newline-preserving passes: `stripComments` (string-aware — `//` inside a string literal survives, fixing the `url = "https://x"` corruption class), `maskCode` (comments + string/template contents blanked so every delimiter found is structural), and `readBalanced` (depth-matched close index, capped). Generalizes the repo's own `maskJs`/`readBalancedParens` patterns; explicitly NOT tree-sitter — zero dependencies, deterministic by construction.

### Changed
- **JS/TS extraction is balanced (#526, PR #527):** every `\(([^)]*)\)` param capture in `javascript.js`/`typescript.js` (top-level functions, arrow consts, class members, TS interface methods) is replaced with match-to-`(` + depth-matched close — `f(a, b = g(x))`, `c = ")"`, and destructuring-brace params now capture fully, with body/anchor endpoints computed from the real close index. JS class members gain the TS control-keyword guard. TS `normalizeParams` strips types depth- and quote-aware: `(cb: (x: number) => void)` → `cb`, generics consumed with the annotation, defaults after typed params preserved (`m: Map<K,V> = new Map()` → `m = new Map()`). Shipped behind the byte-identical-or-better gate: the full existing suite passes unchanged; 12 new adversarial tests (135 test files). `KNOWN_LIMITATIONS.md` updated — nested-paren gap fixed for JS/TS, the 9 remaining Tier-2 languages stay listed for later G4 increments. Extractor-module count honestly 42 → 43 (`scan` registered as a helper so the language count stays 33).
- **Measured trade, documented honestly (v8.20 precedent):** fuller param text adds lexical tokens that dilute BM25 on the file-discovery corpus — retrieval hit@5 **82.2% → 81.1%** (one task partial → wrong), honest lift 1.76× → 1.73×, token reduction unchanged at 96.8%. **Gate-verified real** (`validate:benchmark-determinism` identical cross-suite), not harness noise. The point of the trade: params are now *exact*, which is what D1 arity-checked verification consumes — correctness over corpus points, per the grounding-first north star.

---

## [8.26.2] — 2026-08-18

Patch release — **"Honest Harness" (#522)**: the benchmark suite's cross-suite instability is diagnosed, fixed, and gated — and the headline retrieval number honestly resettles on the now-stable harness.

### Fixed
- **Benchmark cross-suite determinism (#522, PR #524):** two measured root causes. (1) The quality suite carried a stale 13-entry local copy of the retrieval harness's 21-entry `CONFIG_OVERRIDES` table and regenerated every repo unconditionally — the missing entries (express, flask, spring-petclinic, serilog) got default-srcDirs contexts, silently overwriting the canonical ones (measured: honest hit@5 77.6% → 66.4% after a quality run; flask 0.875 → 0). (2) The 20-task `retrieval` set scores against the **live SigMap repo**, whose context legitimately changes every release (measured: 0.85 → 0.55 over three releases) — real development drift, previously indistinguishable from harness noise. Fixes: a single canonical `benchmarks/config-overrides.json` loaded by both suites; the quality suite now mirrors the retrieval harness's apply/restore semantics exactly (always apply · regenerate · restore in `finally`); the honest report labels the self-repo row (`selfRepo: true`, `*` + note in output). New gate `npm run validate:benchmark-determinism` runs honest → quality → honest and fails on any divergence — verified green post-fix (identical at 77.6% / 125 tasks). 5 CI-safe source-level guard tests.

### Changed
- **Headline honesty, again:** with the harness stable, the honest baseline resettles — the previously published 82.4% hit@5 included ~5pt of unlabeled self-repo drift. The refreshed numbers in this release are the first produced under the determinism gate. 134 test files.

---

## [8.26.1] — 2026-08-18

Patch release — **"Trust Quick Wins II" (G1)**: the extraction layer gets the same honesty treatment the benchmarks got in v8.19.

### Added
- **`KNOWN_LIMITATIONS.md` + README extraction-honesty tiers (#520, PR #521):** one page stating plainly what each extractor tier can and cannot do — Tier 1 AST (Python via `python_ast.py`, regex fallback without `python3`), Tier 2 anchored regex (the 11 `withAnchor` brace languages, doc hints on 6), Tier 3 pattern/heuristic (the rest + generic fallback) — plus the truncation caps (25 signatures/file, 8 members/block) and what falls off, the nested-paren regex gap (the stated G4/D1 precondition), and the honest `verify` implication: a real symbol missing from the index flags `fake-symbol` at **medium** confidence — a conservative false positive, never a silent pass. README carries a compact "Extraction honesty" tier label linking the page. A 6-check guard test drift-locks the doc's counts to `version.json` and cross-checks the Tier-2 count against the extractors that actually call `withAnchor`.

### Changed
- 6 new guard checks (133 test files). No runtime code changed; the npm tarball is unaffected.

---

## [8.26.0] — 2026-08-18

Minor release — **"Agent Economy III" (v8.26, F3+F4)**: the optimal SigMap usage loop ships as installable agent skills in every client's native format — completing the Agent Economy pillar (F1 budget → F2 tune → F3+F4 skills).

### Added
- **`sigmap skills` (#517, PR #518):** new `src/skills/skills.js` — two canonical, deterministic skill documents: **sigmap-usage-maximizer** (F3 — the spend-minimizing loop: `ask` before any file read · `get_lines` for anchored ranges instead of whole files · `verify_suggestion` before trusting generated code · `squeeze` any big log/trace/JSON · checkpoint via `create_checkpoint`/`note` · check `get_budget` and, near budget, summarize-then-drop; token accounting reads the F1 ledger — no LLM calls) and **sigmap-config-optimizer** (the F2 playbook: `tune` → review the evidence-naming reasons → `tune --apply` → `validate`). Multi-client installer mirroring the `mcp/install.js` CLIENTS pattern: Claude Code (`.claude/skills/<skill>/SKILL.md`), Cursor (`.cursor/rules/*.mdc`), Windsurf (`.windsurf/rules/*.md`), GitHub Copilot (`.github/instructions/*.instructions.md`), and Codex — a marker-delimited block injected into `AGENTS.md` **above** the `## Auto-generated signatures` marker, so the codex adapter's regeneration preserves it (proven by an end-to-end regeneration test). Human content is never touched; every install is idempotent (`installed`/`updated`/`already`). CLI: `sigmap skills list` and `sigmap skills install [--client <name> | --all] [--json]` — plain `install` wires only clients whose parent artifact exists (the `--setup` only-touch-existing precedent); `--client`/`--all` create. Zero new dependencies.

### Changed
- 8 new integration tests (132 test files); bundle rebuilt (149 modules).

---

## [8.25.0] — 2026-08-18

Minor release — **"Agent Economy II" (v8.25, F2)**: the discovery stack becomes a config optimizer — one command that recommends (and can apply) the config a repo actually needs.

### Added
- **`sigmap tune` (#514, PR #515):** new `src/config/tune.js` — `buildTuneProposal(cwd)` packages the existing discovery stack (`resolveSourceRoots`, workspace markers, client-artifact probes) into a deterministic recommended-config diff with one evidence-naming reason per change. Five rules, explicit user choices never overridden: **srcDirs pin** (resolver roots, confidence-gated, never proposed against user-pinned dirs — pinned srcDirs are stable across runs and protected from token-budget drops), **monorepo** (fires when a workspace marker exists and the mode is off; reason names the marker — `pnpm-workspace.yaml`/`turbo.json`/`nx.json`/`lerna.json`/package.json `workspaces`), **adapters** (additive from client artifacts present: `CLAUDE.md`→claude, `.cursorrules`/`.cursor/`→cursor, `.windsurfrules`→windsurf, `AGENTS.md`→codex), **exclude** (curated vendored/generated dirs present at root — `third_party`, `external(s)`, `generated`, `testdata`, `tmp`, `.cache` … — appended with defaults preserved), **autoMaxTokens** (fires only when a pinned budget is below a labeled ~25-tokens/file heuristic estimate). `applyTuneProposal` merges into `gen-context.config.json` preserving every user key; re-proposal after apply is empty (idempotent). CLI: `sigmap tune` is read-only by default (`--dry-run` alias), `--apply` writes and points to `sigmap validate`, `--json` for agents. Zero new dependencies.

### Changed
- 10 new integration tests (131 test files); bundle rebuilt (148 modules).

---

## [8.24.0] — 2026-07-28

Minor release — **"Trust Quick Wins I" (v8.24, G3a)**: the secret-redaction engine that already protects signatures, `get_lines`, and evidence packs becomes a standalone command for arbitrary text.

### Added
- **`sigmap redact` (#511, PR #512):** new `src/security/redact.js` — `redactText()` masks only the matched secret substring (`[REDACTED:<pattern name>]`), preserving surrounding text (unlike the generation-time scanner's whole-line replacement, which is unchanged). Findings carry 1-based line numbers with per-pattern counts. CLI: `sigmap redact [file] [--json]` — file argument or stdin; redacted text on stdout (pipe-clean), summary on stderr. Reuses the existing 10-pattern bank verbatim; zero new dependencies; never throws. 6 new integration tests including an every-pattern mask sweep (130 test files).

### Changed
- Test fixtures for secret patterns are assembled at runtime (no secret-shaped literals in committed blobs) — GitHub Push Protection rejected the first push over the fake samples, which validated the detection class this command implements.

---

## [8.23.0] — 2026-07-28

Minor release — **"Agent Economy I" (v8.23, F1)**: SigMap's token savings become queryable *during* a session. A spend ledger over the existing gain log, an optional budget threshold, and context-freshness age — as a CLI command and the 21st MCP tool.

### Added
- **`sigmap budget` + MCP `get_budget` (#508, PR #509):** new `src/tracking/budget.js` — `budgetStatus()` sums the session's gain-log entries (estimated SigMap-emitted tokens: spent/baseline/saved, op count), computes remaining/pct against an optional budget, and reports generated-context age with a stale flag. Session identity: `SIGMAP_SESSION` env override, else UTC day bucket; `recordUsage` now stamps every entry with `session` (legacy entries match day buckets by timestamp prefix). New opt-in config keys `sessionBudgetTokens` and `contextTtlDays` (both default `null`). CLI: `sigmap budget [--json] [--session <key>] [--budget <tokens>]`. The MCP tool advises degrade-gracefully tactics (terse encoding, `squeeze`, summarize-then-drop) at ≥80% budget. 7 new integration tests (129 test files); tool-count guards advanced 20→21.

### Changed
- **Scope honesty by design:** the ledger counts tokens **SigMap emitted** (chars/4, labeled `estimated-tokens` on every surface) — not the host chat's total spend, which a CLI cannot see. Context freshness replaces the originally-planned prompt-cache "injection TTL", which was unverifiable and got cut in the plan audit.

---

## [8.22.0] — 2026-07-28

Minor release — **"Hard Corpus" (v8.22)**: the benchmark corpus gains a no-leakage hard split with a deterministic leakage gate, and per-repo-size buckets stop tiny repos from flattering the average. The headline retrieval number gets harder — and honest.

### Added
- **Hard-split corpus + leakage gate + size buckets (#505, PR #506):** new `src/eval/corpus.js` — a task "leaks" when its BM25-tokenized query shares a stemmed token with the tokenized basenames of its expected files; `validateTasks` flags leaky `split: "hard"` tasks as violations, and `sizeBucket` groups repos at 200/1000 scanned files (tertiles of the 43-repo corpus). New CI gate `scripts/validate-task-corpus.mjs` (exit 1 on hard-split leakage). `loadTasks` carries the optional `split` field (default `easy`). `benchmark:honest` now reports hit@5/MRR per split and per size bucket — buckets use files scanned on disk, not the budget-capped context index. 15 hand-authored hard tasks (express, flask, axios, fastify, gin), all leak-free. 8 new integration tests (128 test files).
- **MiniMax LLM-ablation provider (PR #504)** — thanks @octo-patch: `MINIMAX_API_KEY` support in `scripts/run-llm-ablation.mjs` (OpenAI-compatible endpoint, default model MiniMax-M3, `MINIMAX_BASE_URL` override) plus a pricing entry and tests.

### Changed
- **Headline honesty, again:** the leakage gate measured that **90 of 110 pre-existing easy tasks leak filename tokens**, and the new hard split scores **33.3% hit@5 vs the grep baseline's 53.3%** — with leakage removed, grep currently wins; that measured vocabulary-mismatch ceiling is what B2 (repo-mined expansion, v9.0) exists to attack. Overall corpus (125 tasks): 72.8% hit@5, honest lift 1.63× (+28pt).

---

## [8.21.0] — 2026-07-19

Minor release — **"Semantic Bridge II" (v8.21)**: doc-comment hints reach Go, Rust, and Java, and the import graph gains a principled centrality prior for ranking — flag-gated and measured.

### Added
- **Go/Rust/Java doc-comment hints (#501, PR #502):** `buildDocHints` in the Go extractor (godoc `//` blocks above top-level `func`/`type`, compiler directives `//go:`/`nolint` skipped), the Rust extractor (`///` blocks above `pub fn`/`struct`/`enum`/`trait` and impl methods, `#[attr]` lines between doc and declaration tolerated), and the Java extractor (Javadoc on type declarations **and** public/protected members; tag-only blocks produce no hint). First prose sentence, 60-char cap, appended after the line anchor as `  # <hint>` — byte-format identical to the Python/JS/TS hints. Hints are mined from the original source since `extract()` strips comments before matching; undocumented signatures are byte-identical to before.
- **Centrality rank blend (#501, PR #502, opt-in `retrieval.centralityBlend`):** new `src/graph/centrality.js` — zero-dependency power iteration over the forward import graph (damping 0.85, 20 iterations, sorted nodes, dangling mass redistributed; deterministic), max-normalized to (0,1]. `rank()` blends `0.3 × centrality` as a small additive prior onto **positively-scored files only** (`signals.centrality`) — a tie-breaker among matches, never a way to surface non-matches. Wired like `callGraphBoost`: MCP `query_context` + CLI `ask`/`--query`, all non-fatal. New A/B measure gate `scripts/run-centrality-blend-benchmark.mjs` (`npm run benchmark:centrality-blend`).

### Changed
- **Measured and gated off by default:** the centrality A/B over 90 tasks / 18 repos scored both arms at 77.8% hit@5 (+0 tasks) — non-regressing but neutral on the lexical-favoring corpus, so `retrieval.centralityBlend` ships **off** per the measure gate; the v8.22 hard-split corpus (A3) is the next chance to show a real delta. 11 new integration tests (127 test files).

---

## [8.20.0] — 2026-07-19

Minor release — **"Semantic Bridge I" (v8.20)**: the JS/TS extractors gain the same doc-comment hints Python has carried for releases, and the cross-session stores get a single inspect/prune surface.

### Added
- **JS/TS doc-comment hints (#498, PR #499):** `buildDocHints` in the JavaScript and TypeScript extractors mines the first prose sentence of the JSDoc block immediately preceding each top-level function form (exported function, exported arrow const, top-level function) and appends it after the line anchor as `  # <hint>` — byte-format identical to the Python extractor's `extractDocHint`, restoring cross-language consistency. A tempered comment-body pattern prevents cross-block hint misattribution (caught in smoke testing before landing). The semantic value is proven directly by a new vocab-mismatch fixture: a query whose vocabulary is fully disjoint from every identifier retrieves the file **only** via its hint (BM25 score 0 without).
- **`sigmap memory` (#498, PR #499):** one view over the existing `.context/` cross-session stores — session, notes, weights, evidence, gain, usage — with per-store entry counts, size, and age; `--json`; and explicit `--clear <session|notes|weights|evidence|all>`. Tracking stores (gain/usage) are listed but protected (they keep their own reset flows). No new storage, zero dependencies.

### Changed
- **Headline metric shift, documented honestly:** doc hints add English tokens that compete on the lexical-favoring corpus — one borderline task (`svelte-t002`) fell out of top-5 because competing public-API files' hints carry the query's words. **hit@5 86.4% → 85.5% task-level (−0.9pt), honest lift 2.02× → 2.00×**; grep baseline unchanged at 42.7%. Shipped default-on per the v8.18 anchors precedent and Python-parity; the v8.22 hard-split corpus (A3) will measure the semantic upside these hints exist for. 10 new integration tests (126 test files).

---

## [8.19.0] — 2026-07-19

Minor release — **"Honest Numbers" (v8.19, P0)**: the published retrieval lift now comes from a measured grep-agent comparison, not a random-file baseline, and every proxy metric says so on the label.

### Added
- **Honest grep-agent baseline benchmark (#495, PR #496):** new `scripts/run-honest-benchmark.mjs` (`npm run benchmark:honest`) scores the production ranker against an internal single-shot grep-agent baseline — a pure-Node, zero-dependency, no-child-process repo scan ranked by distinct-term coverage then occurrences, `.gitignore`-aware, deterministic ordering — on the same 110-task / 19-repo corpus and the same scorer. **Measured: SigMap 86.4% hit@5 / MRR .780 vs grep 42.7% / .228 → 2.02× lift (+43.6pt)** → `benchmarks/reports/honest-baseline.json`. `computeLatest` derives `grep_baseline_hit_at_5` + `grep_lift` from the report (optional-report pattern; hermetic fixture unaffected).
- **Claim-hygiene guard test:** `test/integration/honest-baseline.test.js` (7 checks) — report shape, derived-not-hand-typed metrics, version.json mirror, and a one-way door: the 6.4×-vs-random lift, the 13.6% random baseline, and the unsourced "10% without" claim can never reappear on README or llms surfaces; the benchmark script itself is guarded to stay child-process-free.

### Changed
- **Random-baseline lift retired from all human surfaces (#495, PR #496):** README and llms.txt/llms-full.txt now quote the measured grep-agent lift (2.02×) instead of 6.4×-vs-random; task success is labeled a **retrieval-tier proxy** ("modeled from retrieval tiers, not measured LLM sessions") and the "baseline 10%" / "up from 10%" claims are removed. The random-baseline fields (`baseline_hit_at_5`, `retrieval_lift`) remain in latest.json/version.json as data only. `readme-structure` guards advanced: README must show the grep baseline and must **not** show the random one.

---

## [8.18.0] — 2026-07-12

Minor release — **the §7.4 Phase-2 closer**: with these three changes, every quality-ceiling row in the master plan's scorecard is done or measure-gated-closed.

### Added
- **Line anchors for Kotlin, Swift, PHP, Scala, and Dart (#486, PR #487):** the v8.17 recipe applied to the remaining five brace languages — newline-preserving comment strips, brace-matched `:start-end` ranges on types, `:n-n` members, body-scan ranging for top-level functions (expression bodies and PSR next-line braces degrade to single-line anchors). All five fixture files anchor 100%; **9 brace languages** now carry Surgical Context anchors.
- **Route surface-enrichment, opt-in and measure-gated (#488, PR #489):** `collectRoutes` split out of the route-table analyzer (markdown unchanged); `enrichWithSurfaces` appends deterministic `route METHOD /path` pseudo-signatures to the defining file's rankable index entry (sorted, deduped, copy-on-write, idempotent). Config `retrieval.surfaceEnrichment` (default `false`) wired into `ask`/`--query`/`query_context`. **Measured** by the new `npm run benchmark:surface-enrichment` A/B: 280 route pseudo-sigs across 18 repos, 90 tasks — **delta +0** (the corpus never asks route-worded questions), so the default stays off per the gate; the fixture test proves the value case directly — a route-worded query retrieves the controller *only* when enriched.

### Changed
- **Docs — the agent's live loop (#490, PR #491):** new "Your agent's live loop" section in the MCP guide framing `query_context` → `get_callee_signatures` → `get_lines` → `verify_suggestion` → `get_method_impact` as what an agentic loop *calls for grounding* (grep finds; SigMap grounds); README gains the framing and the previously missing `get_method_impact` in its tool list.
- **Ranking is now anchor-invariant:** BM25 strips `:start-end` line anchors before tokenizing, so adding anchors to an extractor never shifts length normalization — this moved one borderline task from partial to **rank-1** (correct 61→62/90, task-success proxy 67.8→68.9%).
- **Headline metric shift, documented honestly:** anchors on the five new corpus languages consume real context budget, and one already-borderline Swift task (`vapor-t002`, a route-worded query) fell out of top-5 — **hit@5 87.8% → 86.7%** (stable across repeated runs, root-caused to the vapor repo). Rank-1 accuracy and task success went **up**; the trade buys Surgical Context anchors on 9 languages.

---

## [8.17.0] — 2026-07-12

Minor release — **line anchors for Java, Go, Rust, and C#** (§7.4 Lang ceiling, the roadmap's long-named "anchors for the remaining extractors" item).

### Added
- **Extractor line anchors for Java/Go/Rust/C# (#483, PR #484):** signatures from these languages now carry `:start-end` anchors — types/functions with bodies get real brace-matched ranges, single-line members get `:n-n`, Rust bodyless items (unit structs, trait declarations) get single-line anchors. Prerequisite fix folded in: the four extractors' comment strips are now **newline-preserving** (block comments previously collapsed outright, making true line numbers impossible — regression-tested with a multi-line license header above declarations). Downstream, verified: Evidence Pack `anchorCoverage` goes **0 → 1.0** on Go/Java fixtures with populated `sourceLines`, and `get_lines` (Surgical Context) works on all four languages. Expected extractor fixtures regenerated; `parseAnchor` round-trips every emitted anchor.

---

## [8.16.1] — 2026-07-12

Patch release — **benchmark hygiene**; the published package is unchanged (scripts + tests only).

### Fixed
- **Hermetic grounding benchmark (#480, PR #481):** the grounding suite regenerated the shared cached benchmark repos with a plain default config, silently overwriting the retrieval harness's per-repo-scoped contexts — later context-reading suites saw degraded indexes (the callgraph A/B measured 32.2% hit@5 instead of ~87.8%). `measureGroundingHermetic` now snapshots every context artifact before its regen and restores them byte-exactly after measuring (leftovers removed). Verified: A/B 87.8% → grounding → 87.8%; first retrieval run post-grounding 87.8% with no transient; grounding's own aggregate unchanged. The callgraph A/B also discloses it reads contexts as-is. 3 regression tests.

---

## [8.16.0] — 2026-07-12

Minor release — **Evidence Pack schema v2** (the last Machine-lever item from the master plan §7.4). Also the first published release carrying v8.15.0, which was prepared but never tagged (see its note below).

### Added
- **Evidence Pack schema v2 (#477, PR #478):** additive over v1 — `schemaVersion: '2.0'` + `schemaUrl` pointing at a **published draft-07 JSON Schema** (`sigmap.io/schemas/evidence-pack-2.json`) that CI/agents can validate packs against; **`files[].riskFactors`** exposes *every* matched risk category in precedence order (a migration touching payments carries `['migration','payment']`) while `riskLabel` stays the first factor for v1 consumers; a **`testDiscovery` provenance block** carries the measured accuracy of the stem-affix related-tests method (**F1 0.98, precision 0.971, recall 0.988** over 3,701 pairs / 28 repos) — constants sourced from the committed benchmark report and guard-tested against it; and `generator: { name, version }` records what built the pack. Byte-stable; `contextHash` determinism preserved.

---

## [8.15.0] — 2026-07-11

> **Not published as a standalone release** — prepared and merged to main, but never tagged; first shipped as part of v8.16.0.

Minor release — **call-graph ranking boost, opt-in and measure-gated**. The milestone item "call-graph edges into ranking" is done — and shipped **dark**, because the measure gate said so.

### Added
- **Call-graph ranking boost (#474, PR #475):** `buildCallFileGraph` collapses symbol edges to deterministic file-level bidirectional edges; `rank()` gains `opts.callGraph` — a single-hop, hub-suppressed neighbor boost (`callHop: 0.30`) with a `callGraphBoost` explain signal. Config-gated (non-fatal) into `ask`, `--query`, and the `query_context` MCP tool via **`retrieval.callGraphBoost` (default `false`)**. **Measured** by the new `npm run benchmark:callgraph-boost` A/B (90 tasks / 18 cached repos through the full ranker): import-graph arm 80% hit@5, +call-graph arm 80% — **delta +0, no repo moved** — so per the gate the default stays off; the boost exists for call-topology-heavy repos (Go/Java same-package) where import edges structurally can't see the relationship. The headline BM25 harness is untouched and reproduces 87.8%. Report: `benchmarks/reports/callgraph-boost.json`.

---

## [8.14.0] — 2026-07-11

Minor release — **call-graph support for Java, Go, and Rust** (GR1 language expansion). The method-level call-graph goes from 2 to 5 languages, and every consumer — `--callers`/`--callees`, blast-radius scoring, `review-pr` method-blast findings, `get_method_impact` — inherits them with no further changes.

### Added
- **Java/Go/Rust call-graph (#471, PR #472):** new def extractors in `src/graph/call-graph.js` — Go `func` + receiver methods (parenthesized return lists handled), Java methods + constructors (generics/`throws` tolerated; control-flow and `new Foo(){}` anonymous classes rejected), Rust `fn` incl. generics + `where` clauses and `impl` methods (bodiless trait declarations skipped). New **lifetime-safe `maskRust`** masker: `'a` lifetimes pass through untouched while char literals and strings are masked, preserving offsets. **Same-package resolution scope:** Go/Java call same-package functions across files with no import statement, so same-directory same-language siblings join the resolution scope (sorted, deterministic). Per North-Star #1, unparseable constructs are skipped — never a parser dep. Surface claims updated to "JS/TS, Python, Java, Go, Rust" in `--help`, the `get_method_impact` description, and the MCP guide.

---

## [8.13.0] — 2026-07-11

Minor release — **method-level blast-radius scoring** (GR2, the biggest Phase-2 lever in the master plan §7.4). The D4 call-graph finally has consumers: review findings, the PR Evidence report, and a 20th MCP tool now answer *which functions break*, not just which files.

### Added
- **Method-level blast-radius scoring (#468, PR #469):** new `src/graph/blast-radius.js` — for each changed file, reverse-BFS the method call-graph and score the change with a documented deterministic formula (`min(100, direct×4 + transitive×1)`; tiers none/low/medium/high/critical). Wired into three consumers: `review-pr` gains a `methodBlast` result field and a `method-blast` finding on high/critical tiers; the **PR Evidence** report gains a per-file `Method blast radius: N function(s) impacted (score X/100, tier)` line with top caller ids; and the new **`get_method_impact`** MCP tool (`symbol`, `direction: callers|callees`, `depth`) exposes per-symbol blast radius to agents — **19 → 20 MCP tools**. Graceful degradation when no call graph resolves; byte-stable output for a fixed tree.

---

## [8.12.0] — 2026-07-11

Minor release — **`sigmap wiki`** (D9, the final unstarted in-boundary item from the master plan §3.5 backlog). With this, every in-boundary initiative D1–D9 has shipped.

### Added
- **`sigmap wiki` — deterministic architecture narrative (#465, PR #466):** writes `.context/WIKI.md` composed entirely from data SigMap already computes — overview (indexed files, modules, signature tokens, health grade), module rollup with key files, dependency flow (hub files, entry points, cycle count from the import graph), conventions summary, and navigation pointers. Template prose only: **no LLM, no network, no timestamps** — two consecutive runs on an unchanged repo are byte-identical (regression-tested). `--out <path>` overrides the target; `--json` emits the structured data instead. Graph paths are relativized against the builder's normalized base so hubs/entries render repo-relative on macOS tmpdirs.

---

## [8.11.0] — 2026-07-11

Minor release — the **terse signature encoder** (D7 from the master plan), shipped under its measure-first gate: the public reduction number comes from a benchmark run on this repo, never borrowed from another tool's prose-compression claims.

### Added
- **`--terse` — deterministic terse signature encoding (#462, PR #463):** opt-in compaction of the generated signature block (`function `→`fn `, tightened params/arrows/exports). Measured on this repo by `npm run benchmark:terse`: **10,232 → 8,580 sig tokens (−16.1%)** across 143 files / 780 signature lines. The `:start-end` line anchor and any trailing doc hint are preserved byte-exactly, so `get_lines`, evidence packs, `parseAnchor`, and symbol extraction keep working; the ranker parses terse context files (regression-tested). `terse: false` config default — default output is byte-identical when off. New `benchmark:terse` npm script (`scripts/run-terse-benchmark.mjs`) is the only legitimate source for this number.

### Changed
- **README:** replaced the flaky Star History embed with a reliable link (PR #461); added the 'Verified on MseeP' badge below the MseeP security badge (PR #460).

---

## [8.10.0] — 2026-07-09

Minor release — **honesty fixes** from a brutal code-review audit of the CLI surface: closing the gap between what each command *claims* and what it *does*. All changes are zero-dependency, deterministic, and the bundle stays reproducible from `src/`. ~40 new regression tests.

### Added
- **`judge` — claim-level grounding (#458):** beyond token overlap, `judge` now extracts an answer's concrete symbol/file/import claims and fails any the context does not contain — catching a hallucinated symbol that pure word-overlap would pass.
- **`review-pr` — real content-based secret scan (#458):** reads changed-file contents and matches known secret patterns, flagging a hardcoded key in an innocently-named file (not just files on a sensitive path).
- **`--health` — auditable composite (#458):** the score now returns a `components[]` breakdown (every deduction, labeled), revives the previously-unused over-budget-streak signal, and adds a "context never generated" penalty.
- **Import graph — alias resolution (#458):** the dependency graph resolves `tsconfig`/`jsconfig` `paths` + `baseUrl` aliases, re-exports (`export … from`), and dynamic `import()`, lifting `--impact`, `--map`, `--callers`, `plan`, and `review-pr` at once.

### Fixed
- **`validate --query` — real signal for natural-language queries (#458):** a lowercase query like `"login rate limit"` now produces a retrieval-confidence report (top file, score, tier) instead of the previous silent no-op.
- **`plan` — wired to the real planner (#458):** the CLI now uses `createPlan()`, fixing a bug where the impact traversal ignored its depth cap and ran unbounded, plus a path-casing bug; impact is unioned across high-confidence files and test coverage is labeled honestly.
- **`gain`/`--cost` — one pricing source (#458):** removed a duplicate inline price table that disagreed with `pricing.js` (gpt-4o priced at $5 vs $2.50 /Mtok), added an explicit `costBasis`, and fixed a `--model` argument-parsing bug.
- **`conventions` — no false consistency (#458):** single lowercase-word filenames are style-neutral, so a repo of `user.ts`/`order.ts` reports "unknown" instead of a spurious "100% camelCase".
- **`--health` — never-generated repos (#458):** a project with source but no generated context is no longer scored 100/A.

### Changed
- **`suggest-profile` (#458):** infers the task profile from the staged-diff composition (test ratio, breadth, doc/config mix) instead of one commit-message keyword.
- **Extractors (JS/TS) (#458):** per-file and per-class caps now append a visible `… +N more` marker instead of silently dropping the tail of large files.
- **`--health` metric relabel (#458):** `extractorCoverage` → `languageCoverage` (it measures language diversity, not extractor quality) and is grouped under `diagnostics`.
- **`learn` / `create` labels (#458):** honest output — a manual boost/penalty ledger, and a deterministic guard runner, respectively.
- **README (#456, #454, #455):** added the MseeP.ai security assessment badge — thanks @mseep-ai; moved the Star History chart into its own section; refreshed SEO/GEO positioning content.

---

## [8.9.1] — 2026-07-06

Patch release — **CI only; the published package is unchanged from 8.9.0.** Makes the GitHub Pages docs deploy self-healing so releases stop going red on a GitHub-side transient.

### Fixed
- **Pages deploy retries GitHub's transient "try again later" (#451):** GitHub's Pages backend intermittently returns `Deployment failed, try again later` within seconds of a push-triggered deploy, and `actions/deploy-pages` treats that status as terminal — so every release's first Pages deploy went red and needed a manual re-run (the identical artifact re-deployed ~1 min later always succeeded). `.github/workflows/pages.yml` now lets the first attempt fail softly (`continue-on-error`), waits 60s for the backend to settle, and retries once with the same official action. The job is green if either attempt deploys, and only red if both fail (the rare stuck-sha case, which still needs a fresh sha). No new dependencies; no change to the npm package.

## [8.9.0] — 2026-07-06

Minor release — **the watcher, detached (D1).** `sigmap --watch` keeps the signature index fresh but held a terminal in the foreground. This adds a managed background daemon so you can start it once and forget it — the roadmap's #1 friction win. Zero-dependency, shell-free, deterministic.

### Added
- **Detached watch daemon — `sigmap daemon start|stop|status` (#447, PR #448):** runs the existing `--watch` mode as a background process, launched with `spawn(process.execPath, ['gen-context.js', '--watch'], { detached: true })` — an arguments array, never a shell command string — and tracked by a PID file under `.context/` (`daemon.pid`; output → `.context/daemon.log`). `start` does an initial generate then detaches, is idempotent (a second start reports "already running", spawns no second process), and clears a stale PID file first; `stop` sends SIGTERM and removes the PID file (a no-op when nothing is running); `status` reports the running PID and log path, exits 0 when running / 1 when not, and self-cleans a stale PID file. Every subcommand supports `--json`. New module `src/daemon/daemon.js`; CLI dispatch mirrors `sigmap mcp <sub>` and is listed in `--help`.

## [8.8.1] — 2026-07-05

Patch release — **byte-stable context, reproducible benchmark.** Closes the determinism residual tracked in #440: `gen-context` output is now byte-identical run-to-run across all 43 benchmark repos, and the retrieval benchmark reproduces a single hit@5 (87.8%) instead of flapping 85.6–87.8%. Plus a test-count derivation fix, docs/CI serving fixes, and repo hygiene.

### Fixed
- **gen-context determinism residual — token-budget recency boost (#440, PR #444):** the recency boost stamped `mtime = Date.now()` on every recently-committed file. On repos where nearly every file is "recently changed", consecutive files often landed on the *same millisecond* — so which equal-priority files shared a millisecond (and thus fell through to the `filePath` tie-break instead of sorting by a distinct mtime) shifted run to run, swapping which files survived at the budget cutoff and making the output non-byte-stable. The `Date.now()` value wasn't just a boost: it encoded the alphabetical walk order that the budget's best-first sort relied on; the nondeterminism was only the millisecond *collisions*. Replaced it with a deterministic monotonic counter (`nextRecentMtime`) that reproduces the exact same processing-order ranking without collisions. Result: all 43 benchmark repos are byte-identical across two clean runs (excluding the `Updated:` timestamp), and retrieval hit@5 reproduces at **87.8%** with identical per-repo results. Adds an integration regression guard (`test/integration/gen-context-determinism.test.js`) that runs gen-context twice on a committed fixture and asserts byte-equality — verified to fail on the old `Date.now()` behaviour.
- **Derived test count after test relocation (503a6e5):** the test-count derivation globbed `tests/**/*.py`; after relocating `test_python_ast_extractor.py` into `test/` it matched neither pattern and dropped the count, failing `check:metrics` in CI. Now counts `test/**/test_*.py` (unittest-named), which matches the relocated test and excludes the fixture.
- **Docs / CI serving (b236e08):** serve the OG banner image and the Google Search Console verification file; run the Python extractor tests in CI.

### Changed
- **Repo hygiene (a49e9c5):** dropped orphaned demo GIFs and a dead script; relocated a stray test from `tests/` into `test/`.

## [8.8.0] — 2026-07-05

Minor release — **the squeeze engine, exposed mid-session (D6).** The always-on squeeze engine (`src/squeeze/`) that powers `sigmap squeeze` was reachable only from the CLI on pasted input. This release exposes it as an MCP tool an agent can call *mid-session*, and adds a named CLI entry point for compressing an agent/tool *response*. Zero-dependency, offline, deterministic — the last A+ ceiling item (Machine 9→10): the engine already shipped, this just exposes it.

### Added
- **`squeeze_output` MCP tool (#437, PR #438):** the 19th MCP tool (18 → 19) wraps the existing `squeeze()` engine so an agent can compress noisy tool/command output — a stack trace, CI/build log, or JSON payload — before it enters context. Keeps the signal (error frames, failing steps, JSON shape), strips the noise, and enriches the top stack frame with its signature; returns the squeezed text plus token-reduction stats. Passes the input through unchanged when no squeezable structure is detected, and returns usage on empty input. No LLM, no network. New handler `squeezeOutput` in `src/mcp/handlers.js`, wired through `src/mcp/tools.js` and `src/mcp/server.js`.
- **`sigmap squeeze --response <file|->` (#437, PR #438):** names the agent/tool response input explicitly (mirroring the existing `sigmap judge --response` convention), routing it through the same squeeze engine. Supports `--json`. Documented in `--help`.

### Fixed
- **Deterministic context output — three nondeterminism sources (#440, PR #441):** `gen-context`'s signature output was not byte-stable across runs on some repos, making the retrieval benchmark's hit@5 non-reproducible. Fixes: (1) the token-budget drop-order now has a final `filePath` tie-break, so which files survive the budget no longer falls through to filesystem `readdir` order (test files sharing a git-checkout mtime tied on every prior key); (2) the source-file walk sorts `readdir` entries by name for stable section order; (3) auto source-root detection sorts its candidate enumeration and adds tie-breaks to the score sorts, so the `MAX_ROOTS` cutoff admits a deterministic directory set. Adds a resolver determinism regression guard. A residual affecting a few large repos remains tracked in #440.

## [8.7.1] — 2026-07-05

Patch release — **multi-model cost savings + verified pricing.** The quality benchmark reported API input-cost savings for GPT-4o only; it now reports GPT-4o, Claude Sonnet, and Claude Haiku, and the hardcoded Claude rates were corrected to current published pricing.

### Changed
- **Multi-model cost savings (#433, PR #434):** `scripts/run-quality-benchmark.mjs` adds Claude Haiku to the pricing model and emits a per-model "cost savings by model" table (GPT-4o · Claude Sonnet · Claude Haiku). `docs-vp/guide/quality-benchmark.md` now shows all three models in the cost table, headline, and frontmatter. Pricing verified 2026-07 (per 1M input tokens): GPT-4o $2.50, Claude Sonnet 5/4.6 $3.00, Claude Haiku 4.5 $1.00.

### Fixed
- **Stale Claude pricing (#433, PR #434):** `src/tracking/pricing.js` (the `sigmap gain` dashboard's cost assumptions) corrected to current published rates — Claude Haiku $0.80→$1.00 and Claude Opus $15.00→$5.00 (Opus 4.8). GPT-4o ($2.50) and Sonnet ($3.00) were already correct.

## [8.7.0] — 2026-07-05

Minor release — **method/caller-level call-graph (D4 v1): the graph goes from files to functions.** SigMap's dependency graph was file-level only (imports → `--impact`/`get_impact`). This adds **symbol-level** edges — *which function calls which function* — and the **method-level blast radius** of changing a single symbol. Deterministic, zero-dependency, JS/TS + Python. This is the plan's single hardest unbuilt gap and the biggest remaining lever on graph intelligence (v9.5 GR1).

### Added
- **Method/caller-level call-graph (#429, PR #430):** new `src/graph/call-graph.js` builds symbol edges keyed by `relPath#symbol` for **JS/TS + Python**. Definitions are extracted with real body ranges (brace-matching for JS, indentation for Python) over **comment- and string-masked** source, so braces/calls inside literals never create phantom edges. Each call site is resolved with **high precision** — a call binds to a definition of that name in the **same file** first, then in a **directly-imported file** (reusing the existing file-level import graph); names with no repo definition produce **no edge**, avoiding global name-collision noise. Public API: `buildCallGraph(cwd)` → `{ forward, reverse, defs }`, `methodImpact(symbol)` (transitive callers = method blast radius), `methodCallees(symbol)` (what it transitively calls), plus formatters mirroring `src/graph/impact.js`.
- **`--callers` / `--callees` CLI (#429, PR #430):** `sigmap --callers <symbol>` prints the method-level blast radius (every function that transitively calls `<symbol>`); `sigmap --callees <symbol>` prints what it calls. Both accept a bare name or a `file#symbol` id, support `--json` and `--depth <n>` (0 = unlimited), and mirror the `--impact` command. Documented in `--help`.

## [8.6.0] — 2026-07-05

Minor release — **Phase 1 "bank the A": the grounding moat's supporting surface.** Three master-plan items land together: a self-contained, third-party-runnable benchmark harness (G1), installed dependency version pins in the generated context header (D8), and `verify` promoted to a documented flagship command (G2). All zero-dependency, deterministic, and in-boundary.

### Added
- **Public benchmark harness (#425, PR #426):** new `public-benchmarks/` — a self-contained, third-party-runnable retrieval harness. `repos.csv` (18 real repos pinned to exact commits), `queries.json` (90 natural-language query → expected-file tasks), `run.sh` (shallow-clones the pinned repos, then scores), `score.mjs` (maps each repo with `gen-context.js`, ranks with the **shipped** identifier-aware BM25 ranker `src/retrieval/bm25.js`, reports hit@1/hit@5/MRR), and a methodology `README.md`. Deterministic — pinned commits + a byte-stable map + rank-only math → the same numbers on any machine; no LLM, no API keys, no external deps. Dev-only (excluded from the npm package). Turns the published retrieval numbers from a claim into a third-party-verifiable fact (v9.0 G1).
- **Version pins in the context header (#425, PR #426):** the generated header now carries a `## versions (installed direct deps)` block of sorted `name@version` pins for installed JS + Python direct dependencies, so agents reading `CLAUDE.md`/`AGENTS.md` ground against what is **actually installed here** (compounds with the G5/D5 verify moat). New `collectVersionPins(cwd)` in `src/verify/lib-index.js` (versions only — no symbol parsing, cheap enough to run per-build); gated by a new `versionPins` config key (default on). Byte-stable given a fixed installed tree (D8).

### Changed
- **`sigmap verify` — the grounding flagship (#425, PR #426):** `verify` is now a first-class alias of `verify-ai-output` (identical flags, output, and exit codes), with a dedicated flagship section near the top of the README and a `--help` entry. Positions the deterministic grounding guard — the one capability no agentic-grep loop or competitor offers — as the headline (v9.0 G2).

## [8.5.0] — 2026-07-05

Minor release — **deterministic query expansion (a vocabulary-mismatch recall aid).** The BM25 ranker now bridges common code-domain synonyms/abbreviations so a query for `authentication` can still surface a file whose signatures only say `auth`. Zero-dependency, deterministic. **Honest framing:** measured on the retrieval benchmark, this is **benchmark-neutral** (hit@5 unchanged within the harness's 86.7–87.8% noise band at the shipped weight) — not a hit@5 improvement. The benefit is for real users whose query vocabulary differs from the code, a case the curated benchmark doesn't exercise.

### Added
- **Query expansion (#421, PR #422):** `src/retrieval/bm25.js` gains a curated, high-precision synonym/abbreviation table (`auth`↔`authentication`/`login`, `db`↔`database`, `ctx`↔`context`, `config`↔`configuration`, `req`/`res`, `init`, `impl`, …). `expandQuery()` adds synonyms to the query tokens at a **discount weight (0.15)** so an exact-term match always outranks a synonym-only match; documents are unchanged. Wired through the ranker, so `sigmap ask`, `--query`, and MCP `query_context` all benefit. A weight sweep confirmed higher weights regress retrieval, so 0.15 (benchmark-neutral) is the shipped setting.

## [8.4.0] — 2026-07-05

Minor release — **PR Evidence Report (v9.0 G3): a branded, deterministic review artifact.** SigMap already had the pieces — `review-pr` findings and `get_diff_context` — but no single Markdown comment an agent or CI could post on a PR. This adds it: one report that answers *"what changed, what it touches, and what to test"*, with no LLM.

### Added
- **PR Evidence Report (#417, PR #418):** new `src/review/pr-evidence.js` — `buildPrEvidence(changedFiles, cwd)` folds together, per changed file, its extracted **signatures**, **blast radius** (direct/transitive importers, impacted tests + routes), cross-language **related tests**, a **risk label**, and the **`review-pr` findings** (scope drift, god-node edits, missing tests, security-sensitive files). `formatPrEvidenceMarkdown` renders the branded **"🔍 PR Evidence Report"** — with **no wall-clock timestamp**, so it's byte-stable given a fixed tree (diff-friendly as a comment). Exposed via `sigmap review-pr --markdown` (alias `--evidence`); honors `--staged`/`--base`; the exit code reflects the review pass/fail so CI can both post the comment and gate on it. Reuses shipped zero-dep modules only; git stays behind the shell-free `git()` util.

## [8.3.0] — 2026-07-05

Minor release — **Python site-packages grounding: the moat now spans both major ecosystems.** v8.1/v8.2 built local-library grounding for JS/TS (`node_modules` `.d.ts`); this extends it to **Python**, so `verify-ai-output` and the `verify_suggestion` MCP tool ground AI-suggested Python code against the libraries actually installed in the project's venv — with pinned versions (D8). Zero-dependency, no Python runtime, deterministic.

### Added
- **Python site-packages grounding (#413, PR #414):** `buildLibraryIndex` (`src/verify/lib-index.js`) gains a Python pass alongside the JS/TS one. It reads direct deps from `requirements.txt` / `pyproject.toml` (PEP 621 `[project].dependencies` + Poetry), discovers the venv `site-packages` (`.venv|venv|env` → `lib/python*/site-packages`, or `Lib/site-packages` on Windows) **without spawning Python**, resolves each dep's installed module + version (`*.dist-info`, D8) with PEP 503 import-name normalization, and extracts exported names from the package's `__init__.py`/`.pyi` (`__all__`, top-level `def`/`class`, public assignments, and `from … import` re-exports). Both ecosystems merge into one symbol index — genuine installed-Python-library calls stop being false-flagged as `fake-symbol`. Byte-stable given a fixed installed tree; cached via `src/cache/sig-cache.js`; graceful on missing venv / unresolved deps.

## [8.2.0] — 2026-07-04

Minor release — **`verify_suggestion` MCP tool: the grounding moat, made consumable by agents.** v8.1.0 built local-library grounding inside the `verify-ai-output` CLI; this exposes it as the **18th MCP tool**, so a coding agent can verify its own generated code against the repo **and the libraries actually installed** in `node_modules` — *before it writes* — and get back the flagged issues plus the pinned versions it verified against (D8).

### Added
- **`verify_suggestion` MCP tool (#409, PR #410):** ground an AI code suggestion before writing it. `verify_suggestion({ code })` runs the Hallucination Guard against the repo signature index **and** the installed-library symbol index (the G5/D5 moat), returning a clean/✗ verdict, one line per issue (fake file / import / symbol / npm-script, with closest-match suggestions), and a **D8** line listing the installed libraries it verified against with pinned versions (`name@version`). Deterministic, offline, zero-dependency. Reuses the shipped `verify()` core; graceful on missing/empty `code`. MCP surface **17 → 18 tools**.

## [8.1.0] — 2026-07-04

Minor release — **v9.0 G5/D5: the local-library signature index (the private-API grounding moat, v1).** SigMap's hallucination guard can now verify AI suggestions against the libraries **actually installed** in `node_modules`, not just declared dependency *names*. This is a capability no competitor offers — Context7 knows only *public* library docs; SigMap grounds against the real installed tree. Local, zero-dependency, deterministic (byte-stable given a fixed installed tree).

### Added
- **Local-library signature index (#405, PR #406):** new `src/verify/lib-index.js` — `buildLibraryIndex(cwd)` resolves the **direct** dependencies declared in `package.json`, locates each under `node_modules/<dep>`, reads its version (**D8 version pinning**) and TypeScript declaration entry (`types`/`typings`, else `index.d.ts`), and deterministically extracts the exported symbol names. Bounded (per-file + dep caps), cached via `src/cache/sig-cache.js`, and graceful on missing/untyped/malformed packages.
- **Installed-library grounding in `verify-ai-output`:** `verify()` now unions installed-library symbols into its known-symbol universe, so genuine library calls (e.g. `Router()`, `debounce()`) stop being false-flagged as `fake-symbol`. The result summary gains `librariesIndexed` and `libraries` (`name@version`, D8). Auto-runs from the project's `node_modules`; opt-out via `libIndex:false`. Scope v1 is JS/TS `.d.ts`; Python site-packages and a standalone `verify_suggestion` MCP tool are deferred to a follow-up.

## [8.0.0] — 2026-07-04

Major release — **v8.5 "Repo-Context Coverage & Test Discovery" (C1 + C2 + C3).** Marks the v8 milestone: the signature map now reaches beyond functions/classes/routes into the repo's operational surface, impl→test discovery is measured rather than best-effort, and every Evidence Pack file carries a risk label from a richer, precedence-ordered set. All zero-dependency, deterministic, and in-boundary with the North-Star constraints. **No breaking API changes** — the `8.0.0` bump aligns the published version with the roadmap's v8 framing; existing `riskLabel`/`relatedTests` consumers keep working.

### Added
- **C1 — Repo-context coverage expansion (#402):** four dedicated zero-dep map analyzers under `src/map/` (mirroring `route-table.js`), wired into `gen-project-map.js` and the MCP `get_map` `MAP_SECTIONS` — `env-schema.js` (**Environment variables** — env reads across JS/TS/Python/Ruby/Go + `.env.example` keys), `build-ci.js` (**Build & CI** — npm/pnpm scripts, GitHub Actions workflows, Makefile targets), `config-manifest.js` (**Config & manifests** — package manifests across npm/Python/Rust/Go/Maven/Gradle/Ruby/PHP + notable config files), and `migrations.js` (**Database migrations** — Rails/Alembic/Prisma/Flyway/timestamped-SQL detection). `PROJECT_MAP.md` and `get_map` now surface all four sections.
- **C2 — Measured test discovery (#402):** `findRelatedTests` now normalizes cross-language test conventions (`test_x.py`↔`x.py`, `x_test.go`↔`x.go`, `XTest.java`↔`X.java`, `x.spec.ts`↔`x.ts`). New reproducible benchmark `scripts/run-test-discovery-benchmark.mjs` (`npm run benchmark:test-discovery`) scores it against an independent canonical-name gold oracle over `benchmarks/repos` — no LLM, pure string math — measuring **F1 98.0%, hit@1 97.4% across 28 repos / 3,701 gold pairs**. The headline number is surfaced in `benchmarks/latest.json` under `test_discovery`.
- **C3 — Richer risk labels (#402):** `riskLabelFor` now returns the v8.5 set — `migration | payment | auth | security | public-api | config | test | generated | source` — with strict most-specific-risk precedence (a migration touching auth is still `migration`; payment/auth outrank the generic `security` bucket). `test`/`generated`/`config`/`source` semantics are preserved so `findRelatedTests` and the verifier keep working. Extended coverage in `test/integration/evidence-pack.test.js`, `project-map.test.js`, and `benchmark-latest.test.js`.

### Fixed
- **Comparison-chart correctness multiplier (#399):** corrected the stale answer-correctness multiplier badge in `docs/comparison-chart.svg` (×5.2 → ×6.8) to match the current task-success benchmark.

## [7.31.0] — 2026-07-02

Minor release — **identifier-aware BM25 re-ranker.** Plain exact-token TF-IDF missed queries whose terms live *inside* code identifiers — `component emit` never surfaced `componentEmits` because that is one token sharing no exact term with the query. This was the dominant retrieval-miss cause. The new ranker splits identifiers, stems lightly, boosts path tokens, and scores with length-normalized BM25. Deterministic, zero new dependencies, no LLM/embeddings.

### Added
- **Identifier-aware BM25 re-ranker (#395, #396):** new zero-dependency `src/retrieval/bm25.js` with (1) identifier-aware tokenization (split camelCase / snake_case), (2) light stemming (`emits` → `emit`, `options` → `option`), (3) path-token boost (filename weighed 3×), and (4) BM25 length-normalized scoring instead of raw TF-IDF. Wired into the core ranker (`src/retrieval/ranker.js`) as the base relevance score — so `sigmap ask`, `sigmap --query`, and MCP `query_context` all benefit — with the existing negative-signal penalty and recency/graph/learned boosts layered on top. Also drives the benchmark runner (`src/eval/runner.js`) and the dev retrieval benchmark.
- **BM25 unit tests (#396):** `test/integration/bm25.test.js` covers tokenization, stemming, path boost, the `component emit` → `componentEmits` motivating case, and deterministic tie-breaking.

### Changed
- **Retrieval benchmark refreshed:** on the 18-repo / 90-task suite, hit@5 rose **75.6% → 86.7%** (retrieval lift 5.6× → 6.4×), with rank-1 gains on flask, spring-petclinic, rails, and svelte (60% → 100%). The task-completion proxy also improved (task success 52.2% → 67.8%, prompts/task 1.72 → 1.46) since it retrieves through the same ranker. Residual misses (vapor, serilog) are files whose signatures genuinely lack the query vocabulary — out of scope, they need semantic retrieval.

## [7.30.0] — 2026-06-23

Minor release — **v8.0 E2 + E4 (the "Pivot"):** completes v8.0 by repositioning every public surface to the chosen framing — *"the deterministic, verifiable grounding layer for AI code work"* — and framing coding agents as **consumers, not competitors**. The Evidence Pack code (E1/E3/D3 + `mcp install`) already shipped in 7.27–7.29; this is the positioning half. Docs/strings only — no runtime behaviour change, zero new dependencies.

### Added
- **Agent recipes (#389):** new README "Agent recipes" section with copy-paste setup for Claude Code, Cursor, Cline, Continue, Aider, OpenHands, and Codex CLI — each via `sigmap mcp install <client>` or a deterministic Evidence Pack, positioning agents as consumers of SigMap's map.
- **Surface docs for shipped commands (#389):** README now documents `sigmap evidence` (deterministic Evidence Pack JSON/Markdown) and `sigmap doctor` (setup diagnostics), which shipped in code but were undocumented.
- **Repositioning gate (#389):** `test/integration/repositioning.test.js` makes the pivot non-regressable — asserts the grounding-layer framing on README/`llms.txt`/docs `<title>`, recipes for every named agent, and the documented commands.

### Changed
- **E2 repositioning (#389):** README tagline, "What is SigMap?", "Why SigMap?" (token reduction demoted to proof) and the compare table; `docs/index.html` title/meta/keywords/JSON-LD + hero (and the stale `softwareVersion` 5.8.0 → current); `llms.txt`/`llms-full.txt` regenerated from `scripts/llms-manual.mjs`; the per-project adapter tagline in `src/format/llms-txt.js` (bundle rebuilt, reproducible); `docs/_config.yml`. The literal `context-engine` remains only inside the published JetBrains plugin URL slug.
- **Structure guards updated (#389):** `readme-structure.test.js` tagline/compare-table assertions moved to the new copy; `version-json.test.js` now derives the docs `softwareVersion` from `version.json` instead of a hardcoded stale value.

## [7.29.0] — 2026-06-23

Minor release — **v8.0 E4:** one-command, per-client MCP install so a cold user reaches a working MCP setup fast (the v8.0 <5-minute-quickstart exit gate).

### Added
- **`sigmap mcp install <client>` (#385):** targeted MCP wiring for a single client — `claude`, `cursor`, `windsurf`, `vscode`, `zed`, `codex`, `gemini`, `opencode`, or portable `mcp` (`.mcp.json`). Unlike `sigmap --setup` (which wires *every* editor at once and only updates configs that already exist), this **creates** the config dir/file when absent, is idempotent (re-running reports already-registered, never duplicates), and emits the correct shape per client — `mcpServers` JSON, Zed `context_servers`, or Codex YAML. `--global` selects the user-level config for clients that have both a project and a global scope (Windsurf, OpenCode). Composed in the zero-dep `src/mcp/install.js` — no system-shell spawns, no install scripts.
- **`sigmap mcp list` (#385):** lists every supported MCP client and its resolved config path (`--json` for a machine-readable array).

### Changed
- Regenerated `llms-full.txt` so the published surface lists the new `mcp install`/`mcp list` commands.

### Fixed
- Hardened two `--ci --min-coverage` integration tests (#385) that were order- and environment-dependent — they hard-coded an "unreachable" 99% threshold, but once the suite generates a full `src/` context the repo's measured coverage reaches 99–100%. They now pin the threshold relative to the actual measured coverage, so the gate-fails-above-achievable property holds deterministically everywhere.

## [7.28.0] — 2026-06-23

Minor release — **v8.0 E3:** a one-shot setup doctor so a cold user reaches a useful answer fast.

### Added
- **`sigmap doctor` (#381):** a one-shot diagnostic that runs seven resilient checks — git repository, config & source roots, generated context file, signature index, index freshness, coverage, and MCP wiring — and prints an **actionable fix** for anything wrong (e.g. "run: npx sigmap", "run: sigmap --setup", "increase maxTokens or expand srcDirs"). `sigmap doctor --json` emits `{ checks, ok, errors, warnings }`; the command exits **1** on a hard failure (no context file / invalid config) and **0** otherwise, so it is usable in CI. Composed from `loadConfig`, `coverageScore`, `buildSigIndex`, and the known adapter-output / MCP-config paths — zero new runtime dependencies, no system-shell spawns.

### Changed
- **Release CI self-heals `develop` (#380):** the develop→main release PR's head branch is `develop`, which the repo's delete-branch-on-merge setting removes on every release; the "Sync develop with main" workflow now fetches `main` and recreates `develop` from it when the ref is missing (else merges `main` in), so `develop` no longer needs manual restoration after a release.

## [7.27.0] — 2026-06-22

Minor release — **v8.0 D3:** two new MCP tools, taking the server from 15 to 17 tools. Both are composed from data SigMap already computes — zero new runtime dependencies, no system-shell spawns.

### Added
- **`get_diff_context` MCP tool (#376):** for every changed file (working tree, staged via `staged`, or vs a base ref via `base`) returns its current **signatures** + **blast radius** (direct importers, transitive count, affected tests/routes) + a risk label — one call gives an agent everything a review or a safe edit needs. Lists changed files **shell-free** through `src/util/git.js` (no `/bin/sh`). Optional `depth` controls the blast-radius BFS.
- **`get_architecture_overview` MCP tool (#376):** a one-call codebase map — module breakdown (files/tokens), the most depended-on **hub files**, the dependency-**cycle** count, and route totals. Extends `get_map` for orienting in an unfamiliar repo. Composed from `buildSigIndex`, `buildFromCwd`, and `detectCycles`.

### Changed
- MCP surface count is now **17 tools** across `--help`, README, `docs-vp/guide/mcp.md`, `version.json` (`mcp_tools`), and the generated `llms.txt`/`llms-full.txt`.

## [7.26.0] — 2026-06-22

Minor release — **v8.0 "The Evidence Pack & the Pivot" (E1):** the keystone artifact that makes SigMap consumable by machines instead of copy-paste.

### Added
- **Evidence Pack JSON v1 (#372):** new `sigmap evidence "<query>"` command emits a deterministic, machine-consumable signature-and-evidence map — a byte-stable JSON artifact (plus a `--markdown`/`--md` handoff rendering) that an agent or CI can ingest directly, every entry anchored to a real file, symbol, and line range. Schema v1: `{ schemaVersion, query, intent, files:[{ path, symbols, reason, confidence, sourceLines, relatedTests, riskLabel }], tokenBudget, droppedFiles, grounding:{ symbolCount, anchoredSymbols, anchorCoverage, contextHash, deterministic } }`. Composed entirely from shipped zero-dep modules (ranker, line-anchor parsing, security scanner, sha256 grounding hash). The pack carries **no wall-clock timestamp** — an unchanged repo yields byte-identical output and a stable `grounding.contextHash`, so the artifact is auditable. CLI flags: `--top`, `--budget`, `--out`; always writes `.context/evidence-pack.json`. `riskLabel` ∈ {generated, test, config, security, source} and `relatedTests` are best-effort v1 (measured test-discovery and richer labels land in v8.5).

---

## [7.25.2] — 2026-06-22

Patch release — **Trust Hygiene (H2):** reproducible bundle build. Completes the v7.25.x "Trust Hygiene" milestone (H1+H2+H3+H4 all shipped).

### Added
- **Reproducible bundle build (#369):** `scripts/build-bundle.mjs` (`npm run build:bundle`) deterministically regenerates the embedded `__factories` of `gen-context.js` from `src/` + `packages/adapters/` — sorted and de-duplicated — between two markers, leaving the preamble and the hand-written CLI core byte-identical. `build:bundle --check` asserts the committed bundle equals a fresh build and is wired into `prepublishOnly` and CI (next to the existing standalone `bundle-smoke` test on Node 18/20/22). A new `bundle-repro` test pins byte-for-byte reproducibility.

### Fixed
- **Duplicate / missing bundled modules (#369):** the bundle carried a duplicate `./src/eval/llm-ablation` factory (124 blocks for 115 `src/` modules) because `check-bundle --fix` prepended on each run; it now regenerates the whole section via `build-bundle`, so duplicates can't recur. The `willow` adapter — silently never embedded (the integrity check only verified `src/`) — is now bundled. The canonical bundle is **125 modules, one factory each**.

---

## [7.25.1] — 2026-06-21

Patch release — **Trust Hygiene (H4):** document the real CLI / MCP / adapter surface. Completes the v7.25.x milestone's documentation goals (only H2, the reproducible bundle build, remains).

### Added
- **Document the shipped surface (#366):** `sigmap --help` now lists the five wired-but-undocumented commands — `conventions`, `scaffold`, `verify-plan`, `review-pr`, and `create` (the grounded-creation pipeline). The README gains a "Grounded creation & guardrails" section, lists all 15 MCP tools, and adds the `willow` adapter to the integrations table. A new `surface-docs` test pins the documented surface to source (`--help` must list the commands, README's MCP count must equal `TOOLS.length`, every `listAdapters()` entry must appear in the README table), so the docs can never silently undersell the product again.

### Fixed
- **MCP tool undercount (#366):** the README advertised "10 on-demand tools" while the server ships **15** — corrected and now gated by the `surface-docs` test.

---

## [7.25.0] — 2026-06-21

Minor release — **Trust Hygiene (H1 + H3):** one generated source of benchmark truth, gated in CI. First installment of the v7.25.x milestone.

### Added
- **Single source of benchmark truth (#363):** `benchmarks/latest.json` is now generated from the benchmark reports (`scripts/gen-benchmark-latest.mjs`), and `version.json` metrics, `README.md` (via `<!--SM:KEY-->` markers), and `llms.txt`/`llms-full.txt` all read from it (`scripts/sync-metrics.mjs`). Every hand-typed metric is removed — published numbers can no longer silently drift from the measured reports. New `npm run metrics:sync` regenerates the whole chain; `npm run check:metrics` gates it in `prepublishOnly` **and** CI.
- **Truthful `version.json` (#363):** `languages`, `extractors`, `mcp_tools`, and `tests` are auto-derived from source via a shared `scripts/lib/source-meta.mjs` (the same derivation the llms generator uses, so the language count can never diverge). Added the `extractors` field.

### Changed
- **Every published number traces to one fresh, gated benchmark run (#363):** the long-standing drift (committed reports vs hand-typed README/`version.json`/`llms.txt`) is eliminated — all surfaces now derive from `benchmarks/latest.json`. This release regenerates that file from a **live** benchmark run (2026-06-21, `sigmap-v7.25-main`, 21 repos): hit@5 **75.6%** (13.6% baseline, 5.6× lift), token reduction **97%**, task success **52.2%**, prompts/task **1.72 → 2.84**, prompt reduction **39.4%**. `languages` corrected `31 → 33`; `extractors` (42) now reported.

---

## [7.24.2] — 2026-06-19

Patch release — surface the StarMapper stargazer map in the docs.

### Added
- **StarMapper stargazer-map badge + link (#360):** the README badge row gains a StarMapper badge and the Support section a "stargazers around the world" link; the docs site adds a community link — all pointing to the [StarMapper map](https://starmapper.bruniaux.com/manojmallick/sigmap) (517 stars across 37 countries). StarMapper is a client-rendered SPA with no verifiable badge endpoint, so a reliable shields.io static badge links to the map rather than embedding an unverifiable image. A README-structure test pins the StarMapper URL.

---

## [7.24.1] — 2026-06-19

Patch release — publish the first measured §9 grounding result.

### Added
- **§9 grounding result published (`version.json` `ablation`):** the first averaged §9 LLM A/B ablation on the fact-question corpus (v7.24.0) — 5 runs × 100 repo-fact tasks, Gemini `gemini-2.5-flash`. With SigMap's exact-signature grounding, flagged codebase-fact errors fell from **99.8 [99–100]** to **0.2 [0–1]** per 100 outputs (mean delta **99.6**). The ungrounded model, with no repo knowledge, fabricates a plausible-but-wrong file path on essentially every task (`src/sigmap/utils.py`, `src/sigmap/extract.py`, …); the grounded model — given exact signatures grouped by file — states the correct path. This measures **factual-recall grounding** (faithful use of provided context), not generative code correctness. Recorded under a new `ablation` block in `version.json`, separate from the retrieval/token/task metrics.

---

## [7.24.0] — 2026-06-19

Minor release — redesign the §9 ablation corpus so it measures grounding, not guard precision.

### Changed
- **§9 ablation corpus → checkable repo-fact questions (#356):** the previous "write a minimal example that requires X" tasks inherently elicited placeholder scaffolding (`src/main.js`, `minimal.js`, real modules referenced by basename), which a string-based guard cannot distinguish from claimed repo files — so the metric measured guard precision, not grounding. A 100-task run confirmed grounding drives *genuine* invented-file hallucinations to ~0 while with-arm scaffolding noise masked it (9 → 7). `scripts/gen-ablation-corpus.mjs` now generates fact questions — *"which file defines `<name>`, and what are its parameters?"* — where a wrong file path is an unambiguous, checkable hallucination and the prompt forbids example code. The grounded arm (given exact signatures grouped by file) answers correctly; the ungrounded arm must guess. Task ids `call-` → `fact-`; 100 real-symbol tasks; a regression test pins the methodology. Run: `npm run benchmark:llm-ablation -- --runs 5 --save`.

---

## [7.23.0] — 2026-06-19

Minor release — make the §9 LLM ablation produce a statistically stable number.

### Added
- **§9 ablation: `--runs N` averaging + 100-task corpus (#353):** the cleaned-guard §9 result is directionally clear (grounding cuts flagged codebase-fact errors ~13 → 3 per 100) but at N=40 with single-digit raw counts a single pass is noisy. `scripts/run-llm-ablation.mjs` gains `--runs N` (default 1) that runs the full task set N times with **fresh model calls per pass** and prints a mean ± [min–max] summary; `src/eval/llm-ablation.js` adds a pure, unit-tested `aggregateRuns(aggregates[])` (mean/min/max of without/with per-100 and delta). The committed corpus (`benchmarks/llm-ablation-tasks.json`) expands from 40 to **100** real-symbol tasks (`gen-ablation-corpus.mjs` default 40 → 100) for a tighter single-run estimate. The network touch stays confined to `scripts/`; the offline harness is unchanged. Run the robust headline with `npm run benchmark:llm-ablation -- --runs 5 --save`.

---

## [7.22.2] — 2026-06-19

Patch release — clears the two remaining `verify-ai-output` false-positive classes surfaced by the §9 ablation.

### Fixed
- **`verify-ai-output` no longer flags camelCase placeholders or documentation-placeholder imports (#350):** continuing from #347, the Hallucination Guard now also skips camelCase/Pascal placeholder filenames (`myExample.js`, `exampleConfig.ts`) via a case-boundary rule that still flags ordinary words (`resample.js`), and the `fake-import` detector skips obvious documentation placeholders (`@scope/utils`, `some-module`, `./local-file`, `./path/to/…`) while still flagging genuine missing packages and unresolved relative imports. In the §9 re-run after #347, grounding genuinely fixed 6 mis-path flags but the guard re-flagged 4 illustrative tokens (net +2); suppressing those exposes the true grounding signal (on those outputs, with-grounding flags drop 10 → 6, delta +2 → +9). The bundled `src/verify/parsers` and `src/verify/hallucination-guard` factories were regenerated for standalone-binary parity.

---

## [7.22.1] — 2026-06-18

Patch release — hardens the `verify-ai-output` file-path extractor against the dominant false-positive class.

### Fixed
- **`verify-ai-output` no longer flags runtime/library names or placeholder filenames (#347):** `extractFilePaths` now skips well-known `X.js` product names (`node.js`, `next.js`, `vue.js`, `express.js`, `three.js`, `d3.js`, …) and illustrative placeholder basenames (`example`/`sample`/`demo`/`placeholder`, including `minimal-example.js`). Genuine repo-shaped paths (`src/foo/bar.js`, `main.js`, `index.ts`) are still extracted, so real hallucinations are unaffected. This removes the dominant Hallucination Guard false-positive class — in the §9 ablation, 22 of ~34 flags were literally "Node.js" — turning the directional grounding delta into a clean signal. The bundled `src/verify/parsers` factory was regenerated for standalone-binary parity.

---

## [7.22.0] — 2026-06-18

Minor release — realistic §9 ablation (real-symbol corpus, exact-signature grounding, --verbose) + Gemini model fix.

### Added
- **Realistic §9 ablation — real-symbol corpus, exact-signature grounding, `--verbose` (#344):** the LLM A/B ablation now measures something meaningful. `buildGrounding` emits **exact signatures grouped by file** (what `get_callee_signatures` returns, bounded by `maxSignatures`) instead of a flat symbol-name dump — the real product behavior. New `scripts/gen-ablation-corpus.mjs` generates ~40 tasks from the repo's actual exported symbols/files (`benchmarks/llm-ablation-tasks.json`). `src/eval/llm-ablation.js` adds `scoreAnswerDetail` (count + issues) and `runAblation`'s `collectIssues`; the runner's `--verbose` prints every flagged item per arm. A 40-task Gemini run showed grounding reduced flagged errors 62.5 → 22.5 per 100 (directionally positive vs the earlier 4-task noise) — and `--verbose` revealed most flags are `verify-ai-output` file-path false-positives (e.g. "Node.js"), the next thing to harden before publishing a number.

### Fixed
- **Gemini default model (#343):** the ablation runner's default `gemini-2.0-flash` was retired by AI Studio (404 NOT_FOUND); the default is now the live `gemini-2.5-flash`. The `--model` flag selects any model.

---

## [7.21.0] — 2026-06-18

Minor release — LLM ablation runner gains a Gemini (AI Studio) provider.

### Added
- **Gemini provider for the §9 LLM A/B ablation runner (#340):** `scripts/run-llm-ablation.mjs` now supports Google Gemini via the AI Studio / Generative Language API (`generateContent`) alongside Anthropic. The provider is auto-detected from whichever key is present (`GEMINI_API_KEY` / `GOOGLE_API_KEY` → gemini; `ANTHROPIC_API_KEY` → anthropic); `--provider` and `--model` override, with a sensible default model per provider (`gemini-2.0-flash` / `claude-sonnet-4-6`). The no-key path lists both providers and exits 0. Run with `GEMINI_API_KEY=… npm run benchmark:llm-ablation`. The network fetch stays confined to `scripts/` — never the published library surface; the offline harness (`src/eval/llm-ablation.js`) is unchanged.

---

## [7.20.0] — 2026-06-18

Minor release — `init` writes a Creation workflow block into CLAUDE.md (grounded codegen, Gap 2 §6.2 — completes the plan).

### Added
- **`sigmap --init` documents the grounded-creation workflow in CLAUDE.md (#337):** the final IMPL item. `--init` now injects a marker-delimited "Creation workflow" block describing the four-stage pipeline (`scaffold` → `verify-plan` → `verify-ai-output` → `review-pr`, orchestrated by `sigmap create`) so an agent reading CLAUDE.md knows the guard-rail workflow exists. New zero-dependency, bundle-safe `src/init/creation-workflow.js` (`renderCreationWorkflowBlock`, `injectCreationWorkflow`); idempotent and marker-scoped (`<!-- sigmap-creation-workflow:start -->` … `:end -->`), it creates CLAUDE.md if absent, preserves human content, and coexists with the conventions + auto-generated-signatures blocks. **With this, every item in the grounded-codegen implementation plan is shipped** (the §9 LLM A/B ablation is built and offline-tested; a live run needs only an API key).

---

## [7.19.0] — 2026-06-18

Minor release — scaffold persistence (grounded codegen, Gap 2 §6.2).

### Added
- **Scaffold persistence — `.context/scaffold/latest.md` (#334):** `sigmap scaffold` now writes an accepted proposal to `.context/scaffold/latest.md` so the `create` pipeline and agents can read back the convention-matched proposal instead of re-deriving it. New zero-dependency, bundle-safe `src/scaffold/persist.js` (`renderScaffoldMarkdown`, `scaffoldPath`); the record captures the filename + naming style, export style, test file + framework, and any force-warning. Persisted in both human and `--json` modes (the JSON output gains a `persistedTo` field); a refused scaffold writes nothing.

---

## [7.18.0] — 2026-06-18

Minor release — `sigmap conventions --update` (grounded codegen, Layer 3 — completes the §4 flag set).

### Added
- **`sigmap conventions --update` — incremental rescan (#331):** refreshes `.context/conventions.json` only when source files have changed since the last scan; otherwise reports "up to date" and exits without recomputing. New zero-dependency, bundle-safe `src/conventions/update.js` (`changedSince`, `planUpdate`) compares source-file mtimes to the stored snapshot — `stale` when the snapshot is missing or any file is newer. The command re-extracts + rewrites when stale (reporting the changed count / "initial scan"), else skips the work. `--json` for machine output. This completes the IMPL §4 `conventions` flag set: `--conflicts`, `--inject`, `--report`, `--ci`, `--fix`, `--update`.

---

## [7.17.0] — 2026-06-18

Minor release — `sigmap conventions --fix` (grounded codegen, Layer 3 — completes the conventions flags).

### Added
- **`sigmap conventions --fix` — exhaustive rename/move checklist (#328):** the complete, actionable list of every source file whose name doesn't match the dominant convention, with full from→to paths, ready to paste into a task or PR. Distinct from `--conflicts` (a diagnostic summary with up to 3 example basenames) — `--fix` lists *every* offending file with its real path. New zero-dependency, bundle-safe `src/conventions/fix.js` (`buildFixList`) reuses `classifyNaming` + `toNamingStyle`; the command prints a checkbox checklist + count (or "no fixes needed") and is read-only (it never performs renames). `--json` for machine output. This completes the `conventions` flag set (`--conflicts`, `--inject`, `--report`, `--ci`, `--fix`).

---

## [7.16.0] — 2026-06-18

Minor release — LLM A/B hallucination ablation harness (grounded codegen, IMPL §9).

### Added
- **LLM A/B hallucination ablation harness (#325):** the honest measurement behind the grounded-codegen plan (IMPL §9). Runs a model twice per task — (A) no SigMap context, (B) with SigMap grounding — pipes both outputs through the hallucination guard, and reports the measured delta in flagged codebase-fact errors. New zero-dependency, bundle-safe `src/eval/llm-ablation.js` (`buildGrounding`, `scoreAnswer`, `runAblation`) keeps the model call **injected**, so the harness is fully offline-testable; the live runner `scripts/run-llm-ablation.mjs` wires Anthropic via `ANTHROPIC_API_KEY` and prints the A/B table + delta (`npm run benchmark:llm-ablation`), degrading to a graceful skip (exit 0) when no key is set. The network fetch is confined to `scripts/`, never the published library surface. Starter corpus in `benchmarks/llm-ablation-tasks.json`. This turns §9 from an offline coverage proxy into a ready-to-run real A/B — the moment a key is present, it produces the measured hallucination delta.

---

## [7.15.0] — 2026-06-18

Minor release — `sigmap conventions --ci` (grounded codegen, Layer 3 polish).

### Added
- **`sigmap conventions --ci` — gate CI on convention consistency (#322):** completes the consistency-tracking story started by `--report` (v7.14.0). A CI gate that fails when a repo's overall convention consistency falls below a threshold (`--min`, default 0.70), and — with `--no-regress` — also fails when the score dropped vs the last recorded snapshot (best-effort). New zero-dependency, bundle-safe `src/conventions/ci.js` (`ciGate`) reuses `overallScore`; the command is read-only (reads the last `.context/conventions-history.ndjson` snapshot for `--no-regress`, never appends) and exits non-zero on failure, so it drops straight into CI. `--json` for machine output. The remaining `conventions` flags (`--fix`, `--update`) and the §9 LLM A/B benchmark are follow-ups.

---

## [7.14.0] — 2026-06-17

Minor release — `sigmap conventions --report` (grounded codegen, Layer 3 polish).

### Added
- **`sigmap conventions --report` — consistency audit + trend vs last run (#319):** the next `conventions` flag (IMPL.md §4). Reports a per-convention consistency score (file naming, export style) and a single file-count-weighted **overall consistency score**, each with a delta vs the previous run — a trackable "how consistent is our style, and is it improving?" number. New zero-dependency, bundle-safe `src/conventions/report.js` (`scoreReport`, `snapshot`, `overallScore`); the command compares against the last snapshot in `.context/conventions-history.ndjson`, prints the audit with ▲/▼ trend arrows, and appends a fresh snapshot. `--json` for machine output. The remaining `conventions` flags (`--fix`, `--update`, `--ci`) and the §9 LLM A/B benchmark are follow-ups.

---

## [7.13.0] — 2026-06-17

Minor release — `sigmap create` (grounded codegen, Gap 2 — the pipeline capstone).

### Added
- **`sigmap create "<task>"` — orchestrate the 4-stage grounded-creation pipeline (#316):** the capstone of the grounded-codegen work. One command sequences the four guard stages — `scaffold` → `verify-plan` → `verify-ai-output` → `review-pr` — with `1/4`…`4/4` numbering and a single pass/fail summary. Each stage runs only when its input is present (`--name` → scaffold, `--plan` → verify-plan, `--answer` → verify-ai-output, the git diff → review-pr); a stage with no input is skipped and does not fail the run. New zero-dependency, bundle-safe `src/create/orchestrate.js` (`orchestrate`) delegates to the real stage modules — no logic duplication. CLI supports `--name`, `--plan`, `--answer`, `--staged`/`--base`, and `--json`, and exits non-zero when a ran stage fails. This completes the grounded-creation loop: every root cause (1–4) is closed and all four guard stages are now sequenced by one command.

---

## [7.12.0] — 2026-06-17

Minor release — `sigmap review-pr` (grounded codegen, Gap 2 — last guard stage).

### Added
- **`sigmap review-pr` — diff audit for drift + side effects (#313):** the last guard stage of the `sigmap create` pipeline (IMPL.md §6 step 4). After a PR is opened, it audits the diff for **scope drift** (too many distinct top-level dirs), **god-node edits** (changed files with transitive dependents above a threshold, via the impact graph), **missing tests** (a changed source file with no matching changed test), and **security-sensitive files** (`.env*`, auth, secrets, `package.json`/lockfiles, `.github/workflows/**`, Dockerfiles, keys). New zero-dependency, bundle-safe `src/review/review-pr.js` (`reviewPr`); deletions are excluded from the source/security checks. CLI `review-pr [--base <ref>] [--staged] [--json]` collects the diff via shell-free git and exits non-zero when any finding is present (CI-gate). With this, all four create-pipeline guard stages exist (`scaffold` → `verify-plan` → `verify-ai-output` → `review-pr`); the `sigmap create` orchestrator remains the final follow-up.

---

## [7.11.0] — 2026-06-17

Minor release — `sigmap verify-plan` (grounded codegen, Gap 2).

### Added
- **`sigmap verify-plan <plan.md>` — check a plan against the live index (#310):** the first piece of the `sigmap create` pipeline (Gap 2, step 2). Before an agent executes a plan, `verify-plan` validates it against the live index — referenced files and symbols exist, blast radius is acceptable, scope is in bounds — catching Cause 1+2 at plan time (cheaper than after the code is written). New zero-dependency, bundle-safe `src/plan/verify-plan.js` (`verifyPlan`): flags missing files and unknown symbols (with closest-match suggestions), computes per-file blast radius via the impact graph (flags high-blast-radius files), and flags broad scope. Plan input schema is **markdown** (consistent with `verify-ai-output`). CLI reads a file or stdin (`-`), supports `--json`, and exits 1 on blocking errors. The `sigmap create` orchestration and `review-pr` remain follow-ups.

---

## [7.10.0] — 2026-06-17

Minor release — `sigmap scaffold` with a confidence floor (grounded codegen, Layer 4).

### Added
- **`sigmap scaffold <name>` — convention-matched proposal with a confidence floor (#307):** the first slice of Layer 4 (Cause 3 — guessing structure for new code). Proposes a convention-matched structure for a new module — filename in the repo's dominant naming style, the export style to use, and a matching test file — but **only when the conventions are consistent enough**. New zero-dependency, bundle-safe `src/scaffold/propose.js` (`proposeScaffold`): the governing confidence is file-naming consistency, with a soft threshold (default 0.70, overridable via `--threshold`) and a **non-overridable hard floor of 0.50**. Below the threshold it refuses and surfaces the conflict (reusing `analyzeConflicts`); `--force` allows a proposal between the floor and the threshold (flagged with a warning), but never below the floor — a wrong proposal systematizes bad code. CLI supports `--ext`, `--threshold`, `--force`, and `--json` (refusal exits 1). Scaffold persistence (`.sigmap/scaffold/latest.md`), `--naming-pattern` override, and the `verify-plan` → `create` → `review-pr` pipeline remain follow-ups.

---

## [7.9.0] — 2026-06-17

Minor release — `sigmap conventions --inject` (grounded codegen, Layer 3).

### Added
- **`sigmap conventions --inject` — write the conventions block into CLAUDE.md (#304):** the next slice of Layer 3, completing the "agent sees the house style" link in the grounded-creation loop. Renders the detected conventions (file naming, export style, test framework — each with its dominant pattern and consistency tier) into a marker-delimited block and injects it into `CLAUDE.md`, creating the file if absent. New zero-dependency, bundle-safe `src/conventions/inject.js` (`renderConventionsBlock`, `injectConventions`): the injection is idempotent and marker-scoped (`<!-- sigmap-conventions:start -->` … `:end -->`), preserving all human content and coexisting with the existing `## Auto-generated signatures` block. `--report`, `--fix`, `--update`, `--ci`, and Layer 4 scaffold remain follow-ups.

---

## [7.8.0] — 2026-06-17

Minor release — `sigmap conventions --conflicts` (grounded codegen, Layer 3).

### Added
- **`sigmap conventions --conflicts` — per-convention breakdown + rename suggestions (#301):** the next slice of Layer 3. Where `conventions` reports the dominant pattern and a consistency tier, `--conflicts` surfaces *why* a convention is mixed — every variant pattern with its file count, share, a visual bar, and example files, plus rename suggestions that move minority file-naming files toward the dominant style. New zero-dependency, bundle-safe `src/conventions/conflicts.js` (`analyzeConflicts`, `toNamingStyle`, `renameSuggestion`); export-style conflicts list variants but no renames (that's a code change, not a rename). `scoreConvention(labels, refs?)` now attaches up to 3 example files per variant (backward compatible). `--json` emits the structured conflict report; a consistent repo prints "no conflicts". `--report`, `--fix`, `--update`, `--ci`, and CLAUDE.md injection remain follow-ups.

---

## [7.7.0] — 2026-06-17

Minor release — `sigmap conventions` (grounded codegen, Layer 3).

### Added
- **`sigmap conventions` — extract & report a repo's coding conventions (#298):** the first slice of Layer 3 (grounded code generation). Detects the dominant **file naming** style, **export style**, and **test framework** for TS/JS/Python so generated code matches the house style instead of drifting (Cause 4: naming/convention drift). New zero-dependency, bundle-safe `src/conventions/extract.js` exposes `classifyNaming` (PascalCase / camelCase / kebab-case / snake_case), `scoreConvention` (a reusable consistency scorer returning `{ dominant, dominantPct, variants, tier }` with tiers at 90% / 70% — Gap 1's scaffold-confidence floor will reuse it), and `extractConventions`. The command writes `.context/conventions.json` and prints a readable report; `--json` emits machine output. `--conflicts`, `--fix`, `--ci`, and CLAUDE.md injection are deferred to follow-ups.

---

## [7.6.0] — 2026-06-17

Minor release — the grounding benchmark (the offline GATE for grounded codegen).

### Added
- **Grounding benchmark — `npm run benchmark:grounding` (#294):** a deterministic, offline callee-grounding ablation that measures how much ground truth SigMap actually gives an agent. For each corpus repo: `coverage = grounded / universe`, where universe is every symbol defined in the source and grounded is the subset SigMap surfaces in its index (resolvable by `get_callee_signatures`); baseline is 0 (no SigMap → guess every reference). `scripts/run-hallucination-benchmark.mjs` prints per-repo + aggregate coverage; `--save` writes `benchmarks/reports/hallucination.json`; `--gate <pct>` exits non-zero below a threshold. It's an honest *ground-truth-availability proxy*, not a measured LLM hallucination rate (the LLM A/B ablation is a documented follow-up needing an API key). No LLM, no network — runs in CI.

---

## [7.5.0] — 2026-06-17

Minor release — read-time self-heal completes Layer 1 freshness.

### Added
- **Read-time self-heal — live index without agent hooks (#290):** the v7.4.0 write hooks kept the index fresh only if the agent called them; now `search_signatures` / `get_callee_signatures` reconcile the index with the source tree *on read*, so on-disk edits show up even when no hook fired — closing that single point of failure. New `src/cache/freshen.js` re-extracts files modified since the last `generate` (bounded to actual session edits, not the whole tree), persists to the sig-cache (which `buildSigIndex` merges), and is throttled per repo. Deletions stay the job of `sigmap_notify_file_deleted` (a cache entry may be a notify overlay for a not-yet-on-disk file). Verified end-to-end in the standalone bundle.

---

## [7.4.0] — 2026-06-17

Minor release — live-index write hooks (grounded codegen, Layer 1).

### Added
- **MCP write hooks — live index for agent-created code (#286):** three new tools — `sigmap_notify_file_created`, `sigmap_notify_symbol_added`, `sigmap_notify_file_deleted` — keep the index fresh while an agent creates/modifies/deletes files mid-session, so newly-written symbols are immediately resolvable by `search_signatures` / `get_callee_signatures` instead of being re-hallucinated. They update the persisted sig-cache, which `buildSigIndex` already merges, so changes are live on the next read. New bundle-safe `src/extractors/dispatch.js` (static extractor dispatch for the standalone bundle). Brings the MCP server to **15 tools**.

### Fixed
- **Standalone-bundle cache merge (#286):** the bundled `ranker` factory carried a raw `require('../cache/sig-cache')` that was never rewritten to `__require`, so the cache merge — and `get_callee_signatures`' cache path — silently failed in the SEA binary. Regenerated the factory; the full create→resolve→delete cycle now works from the bundle with no `src/` present.

---

## [7.3.0] — 2026-06-17

Minor release — a 12th MCP tool that gives agents exact callee signatures before they write.

### Added
- **`get_callee_signatures` MCP tool (#282):** returns the exact current signature(s) of named symbols (functions, classes, methods) from the index, so an agent never guesses a callee's parameter types from training memory — the highest-ROI step toward grounded code generation. Input `{ symbols: string[] }`; unknown names get a closest-match suggestion (reuses `verify/closest-match`). Brings the MCP server to **12 tools**. Wired into the standalone bundle (regenerated `mcp/*` factories) and validated end-to-end via the bundle-driven MCP test.

---

## [7.2.1] — 2026-06-17

Patch release — realistic per-query savings.

### Fixed
- **`ask` / `gain` baseline reflects real usage (#278):** `sigmap ask` measured savings against the *whole repo* (every query assumed feeding the entire source tree), which inflated the `gain` dashboard (cumulative baselines in the millions) and showed ~99% per query. The baseline is now the full content of the files SigMap actually surfaced for the query (the ranked top-K) — the true counterfactual: without SigMap you'd read those files in full; SigMap gives you their signatures. Drives the `ask` cost line, `--json savingsPct`, and the `gain` record. `generate` keeps the whole-repo baseline (it genuinely indexes every file → signatures).

---

## [7.2.0] — 2026-06-17

Minor release — release-pipeline robustness. Hardens the bundle/release machinery that produced the v7.1.0 binary failure, with no user-facing CLI changes.

### Added
- **Bundle integrity check (#266):** `scripts/check-bundle.mjs` verifies every `src/` module is registered in `gen-context.js` `__factories` (the standalone/SEA-binary code path). Runs in CI on every PR (Node 18/20/22) and in `prepublishOnly`; `--fix` inserts missing factories from source. `build-binary.mjs` reuses the same check. Catches — before merge — the gap that broke the v7.1.0 binaries.
- **version.json metadata gate (#268):** `scripts/check-version-meta.mjs` derives `mcp_tools` (from `src/mcp/tools.js`) and `tests` (test-file count) and fails on drift; wired into `prepublishOnly`. `languages` stays editorial. Corrected stale `tests` count.
- **Standalone-bundle smoke test (#274):** runs `gen-context.js` from a temp dir with no `src/` present (the binary path) — `generate` + `--health` + `gain` — in the Node 18/20/22 matrix. Functional complement to the presence check.
- **`docs/RELEASING.md` (#274):** documents the release flow, branch model, tag triggers, and the prepublish/CI gates.

### Fixed
- **`--health` clarity (#270):** the per-repo "extractor coverage" line (languages present in this repo ÷ supported) read as contradictory beside a 100/100 score. Relabeled as informational ("repo languages … not scored") with a "score basis" line. The `--health --json` `extractorCoverage` field is unchanged.

### Changed
- **Repo declutter (#272):** removed the committed, unreferenced `TESTING_IMPORT_GRAPH.md` (gitignored); stale planning docs archived out of the repo. `PROJECT_MAP.md` kept (live generated artifact).

---

## [7.1.0] — 2026-06-16

Minor release — a token-savings dashboard in the terminal, plus domain and sponsorship docs.

### Added
- **Token-savings dashboard — `sigmap gain` (#260):** surfaces cumulative savings right in the terminal — total tokens saved, % efficiency, estimated $ saved, latency, and a by-operation breakdown, plus `gain --all` for daily / weekly / monthly trends. Savings are captured per operation (`ask`, `generate`) into a dedicated local log `.context/gain.ndjson` (counts only — no paths, source, or query text). Capture is **default-on** and privacy-safe; opt out via `--no-track`, `SIGMAP_NO_TRACK=1`, or `config.gainTracking:false`. The legacy `usage.ndjson` / `--track` health log is unchanged. New `src/tracking/{aggregate,pricing}.js` (zero-dep aggregation + model→$/Mtok pricing) and `src/format/gain-terminal.js` (ANSI renderer, `NO_COLOR`/non-TTY safe). Flags: `gain --all | --json | --since <7d|ISO> | --top <n> | --model <name> | --reset`. "Saved" is labeled everywhere as an estimate vs the whole-file baseline.

### Fixed
- **Docs served at the sigmap.io root (#258):** the docs site now builds with base `/` (dropped the `/sigmap/` path prefix) and the project domain points to sigmap.io.

### Changed
- **Sponsorship transparency (#257):** README gained a Sponsor section with a tier ladder and funding goal; detail moved into `SPONSOR.md`, with an "About the maintainer" note and a low-barrier welcome.

---

## [7.0.1] — 2026-06-14

Patch release — supply-chain hardening and package hygiene, plus a wider star nudge.

### Fixed
- **Eliminated system-shell access (#252):** every `child_process.execSync` call (which runs via `/bin/sh -c`) was converted to shell-free `execFileSync` with an arguments array. Several commands had previously interpolated values into the command string (`git diff ${range}`, `HEAD~${n}`, `printf '%s' … | ${clipCmd}`, `node -e "…http.get…"`) — a real shell-injection surface. New `src/util/git.js` (`git()`/`tryGit()`) centralizes shell-free git; the `extends` config fetch passes the URL as an argv to node; `compare` spawns node by argv; clipboard copy writes via stdin. Net: zero `execSync`/`exec`/`shell:true` in the published surface, which clears Socket's "Shell access" capability alert.

### Changed
- **Star nudge now counts plain `sigmap` runs (#251):** the one-time GitHub-star nudge previously only counted `ask`/`squeeze`. Users who only run `sigmap` to generate the context file now also reach the 10-run threshold. Counted once per process at the end of generation (monorepo-safe, tracked at the repo root); interactive-only — silent under `--json`/`--report`/`--quiet`/non-TTY.
- **`main` points at the importable core (#252):** `package.json` `main` changed from the CLI bundle (`gen-context.js`, which runs `main()` + exits on `require`) to `packages/core/index.js`, matching `exports["."]`. Bundlephobia and legacy resolvers now see the real zero-dep API.
- **Removed unused device fingerprint (#252):** the star nudge no longer records `machineId = sha256(os.hostname())` in `.context/usage.json` — it was never read or transmitted. Dropped the now-unused `os`/`crypto` requires.

---

## [7.0.0] — 2026-06-14

Major release — **Squeeze** makes `ask` minimize pasted input by default, a behavioral change to the core command.

### Added
- **Squeeze — input minimization (#238):** `sigmap ask` now classifies a pasted blob (stack trace / CI log / JSON) and minimizes it before ranking — deduping frames, stripping vendor noise, collapsing repeated array items — and **enriches the top stack frame** with its real signature from the symbol index. New `sigmap squeeze <file|->` command and `--squeeze` (auto-accept), `--no-squeeze`, `--squeeze-threshold N` flags. New `src/squeeze/{classify,cilog,stacktrace,jsonpayload,index}.js`; zero-dep, deterministic, offline.
- **Star Nudge (#238):** a one-time, race-safe GitHub-star prompt after ≥10 runs / ≥8 successes (`.context/usage.json`).
- **`llms.txt` + `llms-full.txt` generator (#243):** SigMap's own LLM reference is generated from source of truth (MCP tools, config keys, languages, `version.json` metrics, CLI help), validated in CI so it can never go stale, and published to the docs site + repo root. `npm run generate:llms` / `validate:llms`; `prepublishOnly` regenerates before publish.
- **npm discoverability + GitHub Sponsors (#241):** benefit-driven description, 20 keywords, `funding` field + `.github/FUNDING.yml`.

### Changed
- **BREAKING: `sigmap ask` now classifies its input and may prompt** to minimize large pasted stack traces / logs / JSON before ranking. Interactive only — piped/CI usage is unaffected (no prompt), and `--no-squeeze` fully disables it.
- **Token budget keeps full signatures (#240):** when context exceeds `maxTokens`, low-priority files are dropped (and only marginal overflow collapses to anchors) — signatures keep their parameters/return types instead of being gutted to bare line anchors. The repo's own context config raises `maxTokens` (auto-scaling off) so it fits all files with full signatures.
- **One consistent usage block (#240):** every generated context file (CLAUDE.md / AGENTS.md / copilot-instructions.md / …) now carries a single canonical `## SigMap commands` block emitted from `formatOutput`; the redundant `## Tools` JSON in AGENTS.md was removed.
- **Benchmark repos pinned to fixed commits (#236):** retrieval/token benchmarks now clone pinned SHAs, so metrics move only when SigMap changes — not when upstream repos do.

### Fixed
- **Signatures no longer gutted under budget (#240):** the headline regression in the generated context files is resolved (see Changed).
- **prdiff symbol-name extraction (#247):** the changes block no longer emits phantom 2-char fragments (e.g. `+is`/`~is`); `extractName` now handles `export class`, `const x = () =>`, async/visibility modifiers, and returns nothing for re-export lines.

---

## [6.15.0] — 2026-06-09

### Added
- **`verify-ai-output` — Hallucination Guard Reliable MVP (Phase 1, #232):**
  - Two new deterministic detectors — **`fake-test-file`** (a referenced `*.test`/`*.spec`/`__tests__`/`test_*.py` path absent on disk, reported separately from `fake-file`) and **`fake-npm-script`** (`npm run X` where `X` is not a `package.json` script).
  - **Closest-match suggestions** (`src/verify/closest-match.js`) — Levenshtein + file-proximity over the symbol index attaches a heuristic hint to flagged names ("Did you mean `loadConfig()` in `src/config/loader.js:42`?"). Labeled as heuristic, with its own confidence bucketing.
  - **Finalized JSON schema** — every issue now carries `{ type, value, line, location, message, confidence, suggestion }`; `summary` gains `withSuggestion`. Detection confidence is `high` for path/dep/script checks and `medium` for symbol checks.
  - **Parser hardening** — multi-line `import { … } from '…'` statements and TypeScript `import X = require('…')` are now detected; `npm`/`pnpm`/`yarn run` script references are extracted.
  - **HTML report view** (`src/format/verify-report.js`) — `sigmap verify-ai-output <answer> --report [out.html]` writes a standalone, self-contained red/amber/green report (no external assets/scripts); a Markdown renderer shares the same structure for CI/PR comments.
  - **Proof harness** — `npm run benchmark:verify` scores each detector group against labeled cases and enforces precision targets (file ≥ 95%, import ≥ 85%, symbol ≥ 75%, script ≥ 95%), emitting a precision/recall CSV. Runs offline via a synthetic self-test; point it at real repos with `--manifest`.
  - New guide: `docs-vp/guide/verify-ai-output.md`.
- **Memory tools — `note`, `status`, and the `read_memory` MCP tool (Phase 1.5, #233):** closes the cold-start gap so an agent can recall *what we were doing and why* without re-scanning the repo.
  - **`sigmap note "<text>"`** — append to a cross-session decision log stored as append-only NDJSON at `.context/notes.ndjson` (each entry records text, ISO timestamp, and git branch). `sigmap note` with no text lists recent notes (`--list <N>`, `--json`). New module `src/session/notes.js`.
  - **`sigmap status`** — repo state at a glance: branch (with an unborn-branch fallback), dirty-file count, last index run (time, version, file count) with a **staleness** signal (tracked files modified since the last index), and notes summary. `--json` supported.
  - **`read_memory` MCP tool (11th tool)** — returns recent notes (most recent first) plus the last ranking-session focus from `ask`, formatted for agent consumption. Registered in `src/mcp/tools.js`, `handlers.js`, and `server.js`; bundled into the standalone binary.
  - New guide: `docs-vp/guide/memory.md`.
- The `verify-ai-output` (29 cases) and new `memory-tools` (13 cases) integration suites are now part of `npm run test:integration`.

### Changed
- MCP server now exposes **11 tools** (was 10) with the addition of `read_memory`; `version.json` `mcp_tools`, the `mcp.md` guide, and all tool-count test gates updated accordingly.

### Fixed
- `npm run test:integration` referenced a non-existent `test/integration/mcp-server.test.js`; corrected to `test/integration/mcp/server.test.js`.

---

## [6.14.0] — 2026-06-07

### Added

- **`verify-ai-output` — Hallucination Guard prototype (Phase 1 MVP, #227, PR #228):**
  - New command `sigmap verify-ai-output <answer.md> [--json]` flags fabricated claims in an AI answer against the real repository. Deterministic core — runs fully offline, no LLM.
  - Three detectors: **fake-file** (referenced path absent on disk), **fake-import** (relative import does not resolve; bare import absent from `package.json` deps, with Node/Python builtins allow-listed and scoped packages handled), and **fake-symbol** (called function/class absent from the SigMap symbol index via `buildSigIndex`).
  - Markdown report by default, `--json` for CI (`{ file, issues, summary }`). Exits `1` when any issue is found, `0` when clean.
  - New modules `src/verify/parsers.js` (file/import/symbol/code-block extraction) and `src/verify/hallucination-guard.js` (`verify(answerText, cwd, opts)`); all external lookups are injectable so the core is unit-testable.

### Fixed

- **Standalone binary build:** registered the new `src/verify/parsers` and `src/verify/hallucination-guard` modules in the `gen-context.js` `__factories` bundle. Without them the Release Binaries (Node SEA) build failed its pre-flight check (`missing from __factories`); `requireSourceOrBundled` falls back to `__require` in the single-file binary where `src/` is not present.

---

## [6.13.0] — 2026-06-05

### Added

- **Line anchors for JavaScript + member-level anchors (Surgical Context Phase 2.1, #223, PR #224):**
  - The **JavaScript extractor** now emits `:start-end` line anchors on top-level functions, classes, exported arrow functions, and `module.exports` — previously only TypeScript and Python carried anchors. JS block-comment stripping switched to the newline-preserving blank so anchor line numbers stay exact below a `/* … */`.
  - **Class methods and interface members** (TypeScript **and** JavaScript) now carry their **own** `:start-end` anchor spanning the member body, instead of inheriting nothing — unlocking method-level targeting with the `get_lines` MCP tool.
  - Measured effect: index-mode token reduction on real repos rises from ~4.6% to **32–42%** (axios 42.1%, fastify 41.1%, svelte 36.8%, vue-core 32.4%), now 100% anchored.

### Changed

- The bundled standalone `gen-context.js` extractor factories are re-synced with `src/` (the bundle had been stale since v6.11.0), so anchors work in the single-file distribution too.

### Fixed

- **Token budget could exceed `maxTokens` with many files.** The budget was signature-only and undercounted per-file section headers plus the fixed ~150-token preamble; with anchored (collapsible) signatures keeping more files alive, output could overflow. `applyTokenBudget` now budgets *rendered* cost (signatures + section overhead) against `maxTokens` minus a `max(200, 10%)` preamble reserve.

---

## [6.12.0] — 2026-06-05

### Added

- **Surgical Context Phase 2 — demand-driven retrieval (#219, PR #220):**
  - **`get_lines` MCP tool** (10th tool) — fetch an exact `{ file, start, end }` line range on demand. Lines are clamped to the file bounds, secret-scanned via the existing redactor, and sandboxed to the project root. This is the demand-driven workhorse: agents read the lines behind a `:start-end` anchor instead of re-opening whole files.
  - **`sigmap ask --mode index`** — two-tier output that emits only symbol-header pointers (`symbol  :start-end`), dropping parameter lists, return types, and bodies. Agents re-fetch bodies via `get_lines`.
  - **`sigmap ask --since <ref>`** — delta context that restricts ranked output to files changed since a git ref.
- **Token Reduction dashboard panel (Surface A)** — `sigmap --report` now renders a "Token Reduction" panel (whole-file baseline vs ranked signatures vs surgical, with per-repo rows), sourced from `benchmarks/reports/token-reduction.json` — numbers are never hand-typed.
- New **Surgical Context** guide (`docs-vp/guide/surgical-context.md`) covering line anchors, `--mode index`, `--since`, and the `get_lines` MCP tool.

### Changed

- **Budget-aware progressive disclosure** — when generated context exceeds `maxTokens`, the token budget now collapses signature bodies to their line anchors (keeping `symbol  :start-end`) *before* dropping whole files, degrading gracefully.
- **CI** — added `workflow_dispatch` to the develop→main sync workflow so it can be run on demand (PR #218).

---

## [6.11.1] — 2026-06-04

### Fixed

- **MCP hot-cold cold signatures in bundled server** — the bundled MCP server now includes the hot-cold "cold" signatures, so context lookups return complete results under the hot-cold strategy (closes #201, PR #216). Thanks @rudi193-cmd.

---

## [6.11.0] — 2026-06-03

### Added

- **Line anchors on signatures (Surgical Context Phase 1)** — top-level TypeScript and Python signatures now carry a `:start-end` line anchor (e.g. `export class UserRepository  :18-36`), so agents can read the exact lines instead of re-opening whole files. Rendered automatically by `ask`, `CLAUDE.md`, and every adapter — no consumer changes (closes #212).
- New shared `src/extractors/line-anchor.js` helper (`lineAt`, `anchor`, `withAnchor`).

### Fixed

- **Block-comment / docstring line-shift bug** — comment stripping that blanked `/* */` and `"""…"""` to `''` destroyed newlines and corrupted line numbers. Replaced with a newline-preserving strip so char-offset → line-number stays exact. The Python AST and regex fallback paths now produce identical anchors.

---

## [6.10.12] — 2026-05-27

### Added

- **Portable `.mcp.json` support** — MCP server registration now detects and prioritizes `.mcp.json` at the project root, making MCP configuration portable across multiple agentic harnesses (Claude, Cursor, Windsurf, etc.). Falls back to `.claude/settings.json` if `.mcp.json` doesn't exist (closes #209).

---

## [6.10.11] — 2026-05-22

### Fixed

- **Test assertions** — Updated integration tests to verify correct benchmark date (2026-05-22) and language count (31 with R + GDScript support). Tests now validate version.json metrics consistency across all documentation files.

---

## [6.10.10] — 2026-05-22

### Added

- **First-class R support** — R was already in the language detector and had an extractor, but several gaps stopped it from being usable end-to-end:
  - Registered `.r`/`.R` in `gen-context.js` `EXT_MAP` so the main pipeline actually invokes the R extractor (previously wired into the eval/analyzer path only).
  - Extended the dependency-graph builder (`src/graph/builder.js`) with an R branch: parses `source("path/file.R")` calls and, for R packages, resolves `localPkg::fn` references to the file that defines `fn` via a one-pass symbol scan over `R/`. `buildFromCwd` defaults now include `R/` and `inst/` dirs and Shiny entry files (`app.R`, `server.R`, `ui.R`, `global.R`).
  - Extended the R extractor (`src/extractors/r.js`) with R6 class detection (`Name <- R6Class("Name", public = list(...))`), S7 class detection (`Name <- new_class("Name", ...)` + `method(generic, Name) <- function(...)`), and roxygen2 docstring hints appended to function/class sigs (mirroring the Python extractor's docstring pattern).
  - New `src/discovery/r-manifest.js` module with zero-dep parsers for `DESCRIPTION` (Debian-control format, handles continuation lines and version constraints) and `NAMESPACE` (`export`, `exportPattern`, `exportMethods`, `S3method`, `importFrom`).
  - Added `extractRDeps` to `src/extractors/deps.js` for the dep-map section, recognising `library()`/`require()`/`requireNamespace("…")` and `pkg::fn`, skipping R base packages.
  - Extended the ranker's hub heuristic to recognise `R/utils.R`, `R/zzz.R`, `R/globals.R` and `*.r/*.R` files in the common hub-name set.
  - Test fixture `test/fixtures/r-package/` (DESCRIPTION + NAMESPACE + `R/`) and 8 new tests in `test/r-language.test.js` cover manifest parsing, `source()` edge emission, namespace-aware resolution, and hub detection. Existing `test/fixtures/r.r` extended with R6/S7/richer roxygen2 (closes #190).

### Fixed

- **MCP handler improvements** — Merged hot-cold cache and context-cold support into MCP index. MCP tools (`read_context`, `search_signatures`, `get_map`) now correctly serve signatures from multiple sources: primary context file (copilot-instructions.md), cold storage (context-cold.md), and sig-cache index. Fixes issue where MCP clients received partial results when using hot-cold or per-module output strategies.
- **Ranker hot-cold support** — Extended `buildSigIndex()` to merge signature indexes from multiple sources (primary file + context-cold.md + sig-cache). Added internal helper functions `_mergeSigIndex()`, `_buildSigIndexFromCache()`, and `_enrichSigIndexFromStrategy()` to support hot-cold and memory-efficient strategies without API breakage. Allows monorepo and per-module output strategies to serve complete signatures to rank and MCP handlers.
- **Windows path normalization in get_impact** — Implement case-insensitive path lookups in dependency graph for Windows compatibility. All paths in forward/reverse maps now normalized to lowercase, enabling `get_impact` to work correctly when file paths have different case (e.g., `src/Ledger/equity_ledger.py` vs `src/ledger/equity_ledger.py`). Applied normalization uniformly across JS, Python, Go, Rust, JVM, Ruby, and R import detection (closes #193).

---

## [6.10.9] — 2026-05-12

### Changed

- **Documentation updates** — Updated roadmap to reflect v6.10.8 completion with Python import detection in builder.js for get_impact MCP tool.

---

## [6.10.8] — 2026-05-12

### Fixed

- **Python absolute imports in builder.js for get_impact** — Added Python absolute import detection to `src/graph/builder.js` used by the `get_impact` MCP tool. Previously only `import-graph.js` had this support, causing `get_impact` to return empty blast radius for Python monorepos. Now both tools correctly detect `from package.module import X` patterns (closes #187).

---

## [6.10.7] — 2026-05-12

### Fixed

- **Python absolute imports in bundled gen-context.js** — Added Python absolute import detection (`from package.module import X`) to bundled extractImports function. The source code had this support but it was missing from the bundle, causing MCP tools to show empty import graphs for Python monorepos. Now matches source behavior correctly.

---

## [6.10.6] — 2026-05-11

### Added

- **Python absolute import detection** — Detects `from package.module import X` patterns in Python files, fixing empty import graphs for monorepos. Handles nested imports like `from services.auth.oauth import get_token` correctly (closes #181).
- **Comprehensive import graph diagnostics** — New `sigmap-diagnostics.js` tool and `src/analysis/diagnostics.js` module provide per-file metrics and budget decision explanations. Helps debug why files are included/excluded and why import graphs may be empty (closes #182).
- **Regression tests for MCP tools** — Added 8 comprehensive tests covering simple projects, monorepos, circular imports, and Python absolute imports. All tests passing to prevent regressions in `explain_file`, `get_impact`, and related tools.

### Fixed

- **Import graph edge resolution** — Improved `resolveJsPath` to handle additional extensions (.mjs, .cjs, .tsx) and better fileSet path handling. Import graph now correctly detects cross-file dependencies in complex project structures.

---

## [6.10.5] — 2026-05-11

### Added

- **Branching strategy tests** — Added regression tests verifying the develop-first branching workflow to ensure all PRs target develop before release merges to main.

---

## [6.10.4] — 2026-05-11

### Fixed

- **Bundled MCP tools extractImports export** — Fixed `extractImports` function not being exported from the import-graph factory in bundled gen-context.js, which caused `explain_file` (imports/callers) and `get_impact` MCP tools to fail with "extractImports is not a function" when running via `--mcp` server. Added comprehensive tests to prevent regression.

---

## [6.10.3] — 2026-05-11

### Fixed

- **MCP tools import graph analysis** — Fixed `extractImports` not being exported in bundled gen-context.js, which caused `explain_file` (imports/callers), `get_impact`, and `get_routing` tools to fail with "extractImports is not a function" error. Now all three tools correctly analyze file dependencies and impact blast radius.
- **Contributor attribution** — Added direct author commits for Denis Solonenko (GDScript extractor), Sean Campbell (Willow adapter, Python AST extractor), kumamaki (Claude adapter per-module), and Matt Van Horn (R language support) so they appear in GitHub contributors graph.

### Changed

- **Auto-sync workflow** — Added GitHub Actions workflow to automatically sync `develop` branch with `main` after each release, preventing future branch drift.

---

## [6.10.2] — 2026-05-11

### Added

- **Open-source agents documentation** — Comprehensive integration guides for OpenCode, Aider, OpenHands, and Cline with setup examples and context injection patterns. Clear separation of coding agents from inference backends.
- **Local LLM workflows guide** — Complete setup guide for Ollama, llama.cpp, vLLM with model recommendations, performance tuning, and benchmarking. Emphasizes model-agnostic nature: no API costs, full privacy, offline capability.
- **Integrations sidebar** — New VitePress navigation section highlighting open-source agents, local LLMs, MCP server, and Repomix integration.

### Changed

- **README model-agnostic messaging** — Updated to clarify support for cloud LLMs, open-source agents, and local models with full privacy. Removed proprietary-focused language.
- **Quick-start guide** — Added links to new agent and local-LLM guides in "Next steps" section.

---

## [6.10.1] — 2026-05-10

### Added

- **R language support (Phase 1)** — Extract function signatures from `.r` and `.R` files with support for function definitions (`<-`, `=`, `<<-` forms), multi-line arguments with string-literal protection, S4 patterns (setGeneric, setMethod, setClass), and private function filtering. Shiny framework detection via `app.R`/`ui.R`/`server.R` triplet.
- **Native Python AST extractor** — Fallback to `python_ast.py` using `ast.parse()` for accurate extraction of complex signatures (multiline args, stacked decorators, complex generics). Preserves regex fallback for Python 2 / no-Python3 environments. Zero breaking changes to output format.

### Fixed

- **ReferenceError in `--query`** — Fixed variable scope issue where `adpIdx` was undefined when no context file present. Moved variable declaration to proper scope before conditional block.
- **Windows path handling** — Normalized path separators in nested path deduplication. Windows backslashes no longer cause false negatives when matching nested source roots.
- **.contextignore patterns** — Fixed bracket character classes (`[Bb]in/`) being treated as literals. Fixed trailing slashes on directory patterns not matching nested paths. Added error handling for malformed bracket syntax.
- **Claude adapter in per-module and hot-cold strategies** — Fixed adapter not being written to output in per-module and hot-cold context strategies.

---

## [6.10.0] — 2026-05-05

### Added

- **Workspace-scoped retrieval for monorepos** — New `src/workspace/detector.js` module detects workspace packages from `package.json` workspaces field (npm array and Yarn v2 `packages` format). Automatically infers target package from query tokens (e.g., "rate limiting payments" → `packages/payments/`). Flags `--package <name>` (explicit) and `--global` (disable scoping) control retrieval scope. Files inside inferred package receive +0.30 score boost for tighter context.

---

## [6.9.0] — 2026-05-03

### Added

- **Task metadata for segmentation** — All 18 benchmark repositories now tagged with language, repo type (framework/library/tool/application), and size class (small/medium/large) to enable segmented benchmark analysis.
- **Benchmark methodology documentation** — Comprehensive guide explaining what SigMap measures (retrieval accuracy, task success, prompt reduction, token reduction), why these metrics matter, and how the 90-task test set was selected and evaluated.
- **Answer usefulness evaluation** — New metric tracking whether retrieved context actually enabled correct answers, scored in three tiers: fully-useful (rank 1), partially-useful (ranks 2-5), not-useful (not retrieved). Complements task success proxy with granular answer quality assessment.

---

## [6.8.0] — 2026-05-03

### Added

- **Session memory with 4-hour TTL** — Store intent, top-ranked files, and last query in `.context/session.json` to enable context carry-forward across multiple `sigmap ask` calls. Session expires after 4 hours, preventing stale context fixation.
- **`sigmap ask --followup` flag** — Carry context from previous session with intent-aware boosting: +0.2 score for same intent, +0.1 for topic switch (different intent). Never reduces scores, only adds contextual signals.
- **`sigmap plan "<goal>"` command** — Analyze change impact before editing: rank files by confidence level (inspect first vs. likely to change), compute impact radius using dependency graph, identify affected tests. Outputs human-readable table or JSON.

---

## [6.7.0] — 2026-05-03

### Added

- **2-hop graph traversal with decay** — Extended graph-boosted retrieval from 1-hop (0.40 boost) to 2-hop (0.15 boost for transitive dependencies), improving retrieval accuracy by catching cross-module architecture patterns. Exported `GRAPH_BOOST_AMOUNTS` constants for transparency.
- **Hub suppression** — Automatically suppress common utility files (`utils/`, `helpers/`, `shared/`, `common/`, `index`) and high-fanout files (>20% of codebase) from graph boosts to reduce false-positive boosts and improve ranking signal quality.
- **Incremental signature cache** — Introduced `sigCache: true` config key to enable incremental extraction, caching extracted signatures by mtime. Only re-extracts changed files on subsequent runs, dramatically improving performance on large codebases.
- **Cache health statistics** — Display cache file size, entry count, and freshness in `--health` output (text and JSON formats) for visibility into cache state and efficiency.

---

## [6.6.5] — 2026-04-30

### Added

- **Monorepo JVM project detection** — Enhanced source root resolver to detect `src/main/{java,kotlin,scala}` and `app/src/main/{java,kotlin,scala}` in monorepo workspace packages (packages/*, apps/*, services/*, modules/*). Added `src/test/{java,kotlin}` and `app/src/main/scala` to DEEP_PATHS for consistent detection across monorepo and non-monorepo structures.

---

## [6.6.4] — 2026-04-29

### Changed

- **JVM path pattern refactor** — Extracted JVM path regex pattern into a reusable constant `JVM_PATH_PATTERN` in source-root-scorer.js for improved testability and reusability. No behavior changes.

---

## [6.6.3] — 2026-04-29

### Fixed

- **JVM path pattern consistency** — Updated source root scorer regex to recognize Scala in both `src/main/scala` and `app/src/main/scala` directory patterns for consistent JVM project detection.

---

## [6.6.2] — 2026-04-29

### Added

- **srcDirs validation tests** — Comprehensive integration tests for srcDirs configuration validation. Tests verify all common directories, framework conventions, JVM project structures (Java, Kotlin, Scala), and proper path formatting.

---

## [6.6.1] — 2026-04-27

### Added

- **JVM project structure support** — Added auto-detection of Java, Kotlin, and Scala project directories. `srcDirs` now includes `src/main/java`, `src/main/kotlin`, `src/main/scala`, `app/src/main/java`, `app/src/main/kotlin`, `src/test/java`, and `src/test/kotlin` for out-of-the-box support of JVM-based projects.

---

## [6.6.0] — 2026-04-27

### Added

- **Session memory** — Carry context across follow-up queries within a coding session. New `src/session/memory.js` module manages session state with 4-hour TTL. Previous session's top-5 files get +0.2 score boost in next query; boost reduced to +0.1 if intent differs (topic-switch guard).
- **`sigmap ask --followup`** — Reuse previous session's context when making follow-up queries. Session automatically saved after each `ask` command for seamless context carry-forward.
- **`sigmap plan "<goal>"`** — Analyze change impact and plan modifications. Returns files grouped by confidence (inspect-first vs likely-to-change), impact radius, and affected tests. Supports `--json` output for agent integration.

---

## [6.5.2] — 2026-04-27

### Added

- **2-hop graph boost with decay** — `rank()` now traverses 2 hops in the dependency graph instead of 1. Direct imports (+0.40) and second-order imports (+0.15 with decay) receive score boosts for better context relevance in multi-layer dependency scenarios.
- **Hub suppression** — shared utility files (detected by >20% fanout threshold or static patterns like `util/`, `helper/`, `common/`) are now excluded from graph boosts to prevent over-boosting generic utilities.
- **Incremental signature cache (`sigCache`)** — new opt-in `sigCache: true` config key enables mtime-based caching of extracted signatures. Cache is automatically busted on version changes, and unchanged files skip re-extraction for faster subsequent runs.
- **Cache health statistics** — `--health` output now includes cache stats: entry count and disk size in KB. `--health --json` includes `cacheStats` field with `entries` and `sizeKb` when cache exists.

---

## [6.5.1] — 2026-04-25

### Added

- **Retrieval explain** — `rank()` and `scoreFile()` now return detailed signal breakdown (exactToken, symbolMatch, prefixMatch, pathMatch, penalty) for transparency in ranking decisions
- **7-intent ranking** — expanded intent detection from 4 to 7 patterns (debug, explain, refactor, review, test, integrate, navigate). Each intent applies tuned weights to prioritize relevant signals.
- **Negative-signal penalty layer** — formalized penalties for test files (0.4x), generated code (0.3x), documentation (0.2x), and node_modules (0.0x) to deprioritize non-source content

### Changed

- `formatRankTable` now shows penalty column and signals breakdown for top 3 results
- `formatRankJSON` now includes `intent` and `signals` fields in output for API consumers

---

## [6.5.0] — 2026-04-25

### Added

- **Source Root Resolver (v6.5)** — intelligent auto-detection of source directories for 17 languages and 50+ frameworks (Next.js, Django, Rails, Spring Boot, Flutter, Go, Rust, etc.). Uses multi-signal scoring: manifest files, language/framework detection, file density, git activity, and framework-specific srcDirs. Returns confidence level (high/medium/low) and detailed explanation. Integrated into `loadConfig()` with graceful fallback to legacy heuristics.
- **`.sigmapignore` pattern matching** — new `.sigmapignore` file support (fallback to `.contextignore`) for excluding directories. Supports simple patterns like `legacy/` and globs like `src/**`.
- **`sigmap roots` CLI command** — three modes: `--explain` (default, shows detected languages/frameworks and scores), `--json` (structured output), `--fix` (interactive prompt to correct srcDirs and write to config).
- **Monorepo detection and enumeration** — auto-detects monorepos via pnpm-workspace.yaml, turbo.json, nx.json, lerna.json, and package.json workspaces. Enumerates all sub-packages and common deep paths.

### Fixed

- **Framework-discovery tests** — updated registry entries to include all framework-specific srcDirs expected by legacy detector (Rails: db/spec/test, Laravel: resources/tests, Angular: projects/apps/libs, Next: hooks/utils).
- **Scoring penalty for framework srcDirs** — test directories (spec, test, tests) no longer penalized when explicitly in framework's srcDirs list.
- **CLI command ordering** — `roots` command handler now executes before `explain` to prevent flag conflict.

---

## [6.4.0] — 2026-04-23

### Changed

- **Docs version labels** — homepage hero badge now shows Release (v6.4.0) and Benchmark (sigmap-v6.0-main) as separate labels instead of a single conflated "Latest: v6.0" pill
- **Generalization benchmark** — upgraded all v5.9-main references in `docs-vp/guide/generalization.md` to v6.0-main snapshot
- **README overclaim fix** — removed "every time" from the comparison table; trimmed top demo block from 4 commands to 2
- **v6.3.0 release notes** — added release note callout blocks to benchmark, retrieval-benchmark, and task-benchmark docs
- **MCP docs** — added v6.3 native tool registration callout to `docs-vp/guide/mcp.md`
- **Content-consistency test** — new `test/content/v640-trust-sync.sh` bash script with 11 checks catches version/copy regressions

---

## [6.3.0] — 2026-04-22

### Added

- **Native tool registration (Level 3)** — `codex.write()` injects a `## Tools` JSON block into AGENTS.md with 5 named sigmap shell tools (`sigmap_ask`, `sigmap_validate`, `sigmap_judge`, `sigmap_query`, `sigmap_weights`); Codex CLI and OpenCode surface these in their tool picker. `claude.write()` injects a `## Bash allowlist` section into CLAUDE.md with `permissions.allow` patterns for all sigmap commands; adding these to `.claude/settings.json` bypasses the Claude Code confirmation prompt. Both sections are idempotent and preserve human content.

---

## [6.2.0] — 2026-04-22

### Added

- **`--setup` MCP auto-wire for 4 new targets** — `sigmap --setup` now registers the MCP server in `.vscode/mcp.json` (GitHub Copilot in VS Code 1.99+), `opencode.json` and `~/.config/opencode/config.json` (OpenCode), `~/.gemini/settings.json` (Gemini CLI), and `~/.codex/config.yaml` (Codex CLI — YAML format). All 5 new targets are idempotent and only written if the file already exists. Total `--setup` targets: 5 → 10.

---

## [6.1.0] — 2026-04-22

### Added

- **Tool instructions in every adapter (Level 1)** — each adapter's `format()` now embeds native-format SigMap command guidance: markdown table (copilot, codex), bullet list (claude), `#` comments (cursor, windsurf), instruction sentence (openai, gemini). Agents get `sigmap ask`, `sigmap validate`, and `sigmap judge` hints automatically in every generated context file.

---

## [6.0.3] — 2026-04-21

### Added

- **`--coverage` CLI flag** — enables test coverage annotation (`✓`/`✗` per function) at runtime without editing config; sets `testCoverage: true` on the loaded config before any run path.
- **`sigmap weights --export [file]`** — writes learned weights JSON to a file path, or prints to stdout if no path given (pipe-friendly for CI and team sharing).
- **`sigmap weights --import <file> [--replace]`** — merges imported weights into the local `.context/weights.json`; `--replace` discards existing weights and takes the imported set entirely. Incoming values are sanitized and clamped.

---

## [6.0.2] — 2026-04-21

### Fixed

- **Duplicate adapter headers (#104, #96)** — `writeOutputs()` now strips the `formatOutput()` preamble (`<!-- Generated... -->` + `# Code signatures`) before passing content to adapters, preventing double headers on every run. Introduces `stripFormatHeader()` helper applied to all adapter paths including `writeClaude()`.
- **Bundled codex factory (#96)** — the inline `__factories["./packages/adapters/codex"]` in `gen-context.js` was still delegating to `openai.format()` after the source-file fix in v6.0.1. Now uses clean `# Code signatures\n\n` + context, matching the source adapter.

---

## [6.0.1] — 2026-04-21

### Fixed

- **TypeScript extractor guard clauses (#97)** — `extractClassMembers` now skips control-flow keywords (`if`, `for`, `while`, `switch`, `do`, `try`, `catch`, `finally`, `else`) that were incorrectly emitted as method signatures when they appeared inside class bodies.
- **Codex/AGENTS.md adapter preamble (#96)** — `packages/adapters/codex.js` no longer delegates to the OpenAI adapter. Output is now clean `# Code signatures\n\n<context>` markdown with no "You are a coding assistant…" preamble, no HTML comment metadata block, and no duplicate headers.

---

## [6.0.0] — 2026-04-19

### Added

- **Graph-boosted retrieval (v6.0)** — `rank()` in `src/retrieval/ranker.js` now accepts `opts.graph`. After scoring all files, a +0.4 `graphBoost` weight is added to 1-hop forward-import neighbors of any file with `score > 0`. Measured lift: +1.1pp (82.2% → 83.3% hit@5 using ranker.js on 90 benchmark tasks).
- **`DEFAULT_WEIGHTS.graphBoost: 0.4`** — new weight constant; path-normalized relative↔absolute conversion handles the sigIndex/graph format mismatch.
- **Incremental signature cache (`src/cache/sig-cache.js`)** — `loadCache`, `saveCache`, `getChangedFiles`, `updateCacheEntries` persist extracted signatures keyed by absolute path + mtime to `.sigmap-cache.json`. Version-keyed so upgrades automatically bust the cache. Ready to wire into `gen-context.js` for 80–95% speed reduction on re-runs.
- **Graph-boosted MCP `query_context`** — `src/mcp/handlers.js` now builds a dependency graph via `buildFromCwd` and passes it to `rank()`, giving agents multi-hop neighbor boosting for free.
- **README rewrite** — full 15-section conversion-optimised README (tagline, npx demo, ❌/✅ replace table, workflow arrow, canonical benchmark block, install options, integrations, try-it, start guide, why-not-embeddings, license).
- **`test/integration/v591-readme.test.js`** — 50 tests covering all 15 README sections and consistency rules.
- **`version.json` updated** — bumped to `6.0.0`, `benchmark_id` to `sigmap-v6.0-main`, metrics updated from live benchmark run: `overall_token_reduction_pct: 96.9`, `retrieval_lift: 5.8`, `graph_boosted_hit_at_5: 0.833`.

### Changed

- **All package versions** synced to `6.0.0` via `scripts/sync-versions.mjs`.
- **`retrieval_lift`** corrected from 5.9× to 5.8× (actual benchmark run average).
- **`overall_token_reduction_pct`** corrected from 98.1% to 96.9% (simple average across 18 repos from live matrix run; 98.1% was a weighted-by-size figure from a prior run).
- **`task_success_proxy_pct`** corrected from 53.3% to 52.2% (live benchmark confirms 47/90 correct).
- **`prompts_per_task`** corrected from 1.67 to 1.68 (live benchmark output).

---

## [5.9.0] — 2026-04-18

### Added

- **`sigmap bench --submit`** — new CLI command that reads `version.json` + local `.context/benchmark-history.ndjson` and formats a shareable community benchmark submission block (text and `--json`).
- **`scripts/verify-checksums.mjs`** — new standalone script to verify a downloaded binary against its `.sha256` checksum file; exits 0 on match, 1 on mismatch.
- **SHA-256 checksum generation in `build-binary.mjs`** — each binary build now writes a matching `dist/<artifact>.sha256` file automatically.
- **22 integration tests** in `test/integration/v590-binary-polish.test.js` covering all acceptance criteria.

### Changed

- **`scripts/verify-binary.mjs`** — extended smoke tests with 5 new checks (tests 6–10): `ask`, `weights`, `history`, `bench --submit`, and `bench --submit --json`.
- **`version.json`** — bumped to `5.9.0`, `benchmark_id` updated to `sigmap-v5.9-main`.
- **`test/integration/v580-trust-completion.test.js`** — version assertion relaxed from exact `5.8.0` to `>= 5.8.0` so future releases don't break the test.

---

## [5.8.0] — 2026-04-18

### Added

- **`docs-vp/guide/compare-alternatives.md`** — new page comparing SigMap vs embeddings/RAG, RepoMix, Copilot context, and manual curation with side-by-side tables.
- **`docs-vp/guide/walkthrough.md`** — end-to-end walkthrough on a real repo (gin): ask → validate → judge → learn, with before/after token and cost table.
- **Canonical benchmark header block** — `:::info` snapshot block added to all 5 benchmark guide pages (benchmark, retrieval, task, quality, generalization), each referencing `sigmap-v5.8-main`.
- **30-second demo strip** — homepage `docs/index.html` now shows a terminal demo section (ask → validate → judge) directly below the stats bar.
- **User-type routing table** — `docs-vp/index.md` landing now opens with a "Who is this for?" table routing new users, daily users, team setup, MCP users, and monorepo evaluators.
- **Both new guide pages in sidebar** — `compare-alternatives` and `walkthrough` added under a new "Guides" section in `docs-vp/.vitepress/config.mts`.
- **`version.json` — `retrieval_lift` field** — `metrics.retrieval_lift: 5.9` added; `version` bumped to `5.8.0`; `benchmark_id` updated to `sigmap-v5.8-main`.
- **33 new integration tests** in `test/integration/v580-trust-completion.test.js` covering all 7 acceptance criteria.

### Changed

- **`version.json`** — bumped to `5.8.0`, `benchmark_id` updated to `sigmap-v5.8-main`.
- **SVG metrics** — `docs/impact-banner.svg`: `78.9%→80.0%` hit@5, `1.69→1.68` prompts, `40.6%→40.8%` prompt reduction card, "hallucinates" replaced with "unsupported answers"; `docs/comparison-chart.svg`: `78.9%→80.0%`.
- **`docs/index.html`** — `softwareVersion` structured-data updated to `5.8.0`; stats bar language count corrected from `21` to `29`.
- **`docs/readmes/vscode-extension.md`** — language count updated from `21` to `29 languages and formats` in badge, table, and architecture diagram.
- **`docs-vp/index.md`** — tagline updated to remove stale v5.5 text; `v5.7.0` snapshot reference updated to `v5.8.0`; stale v5.5 launch strip replaced with v5.8 announcement.
- **Benchmark sub-pages** — `retrieval-benchmark.md`, `task-benchmark.md`, `quality-benchmark.md`, `generalization.md` all updated to `v5.8.0` as latest saved run.
- **`generalization.md`** — adds "Why this matters" intro callout; stale `v5.5.0` snapshot reference updated to `v5.8.0`.
- **`v560-docs-sync` tests** — version assertions updated to accept `v5.8.0` as the current benchmark version.

---

## [5.7.0] — 2026-04-17

### Added

- **`version.json`** — canonical source of truth for version, benchmark date, language count (29), MCP tools (9), tests (495), and official benchmark metrics snapshot.

### Changed

- **README metrics** — `78.9%` → `80.0%` hit@5 and `1.69` → `1.68` prompts per task; benchmark table now matches official v5.7 snapshot.
- **README what's-new block** — replaced stale "v5.2" section with "What's new in v5.7" entry covering version.json, metrics sync, and language count correction.
- **`docs/index.html`** — `softwareVersion` updated from `5.5.0` to `5.7.0`.
- **`docs/languages.html`** — all user-facing "21 languages" occurrences updated to "29 languages and formats" (OG meta, Twitter meta, structured data headline, hero heading, stat badge, section heading, section sub).
- **`docs/quick-start.html`** — language count nav card updated from "21 languages" to "29 languages and formats".
- **`docs/repomix.html`** — current-copy language count updated from "21 languages" to "29 languages and formats".

---

## [5.6.0] — 2026-04-17

### Changed

- **Docs version labels** — all guide pages updated from `v5.2`/`v5.3`/`v5.4` workflow references to `v5.5`.
- **Benchmark sub-pages** — `retrieval-benchmark.md`, `task-benchmark.md`, `quality-benchmark.md` now show `v5.5.0` as the latest saved run (was `v5.3.0`/`v5.4.0`).
- **Canonical metrics** — `generalization.md` and `cli.md` updated to `80.0%` hit@5 and `1.68` prompts per task (were `78.9%` / `1.69`).
- **Judge vocabulary** — `judge.md` and `cli.md` judge examples now use only `Groundedness`, `Support level`, `Unsupported symbols`; removed `pass/fail` and raw `"verdict"` key.
- **Language count** — `docs/index.html` heading, list item, and structured-data description updated from `21 languages` to `29 languages and formats`; `softwareVersion` updated to `5.5.0`.
- **MCP tool count** — `mcp.md` description, heading, and test example updated from `8 tools` to `9 tools`.

### Added

- **Troubleshooting Issue 16** — new entry explaining the `--report` vs `--health` coverage-grade inconsistency and the v5.5 fix, with a before/after comparison table.
- **`test/integration/v560-docs-sync.test.js`** — 17 assertions covering all acceptance criteria for the docs sync.

---

## [5.5.0] — 2026-04-17

### Fixed

- **Coverage grade now accurate for mixed-content projects** — `coverageScore()` counts only code files (`.ts`, `.js`, `.py`, `.go`, etc.) in the denominator. Previously, `package.json`, `tsconfig.json`, `README.md`, and other non-code files were counted, causing inflated D-grades even when all code was covered (reported in discussion #81).
- **`--report` coverage label** — now reads `code files` instead of `source files`, and prints `(N non-code files skipped — json, md, config)` when non-code files were excluded.
- **`--report` actionable guidance** — modules marked `← attention needed` (<50% coverage) now show a tip block listing the three common causes and how to fix each.
- **`--health` label disambiguation** — coverage line renamed from `coverage … source files` to `file access … files accessible in srcDirs`, making it clearly distinct from the `--report` coverage metric.
- **`autoMaxTokens` silent-override warning** — when `autoMaxTokens` is active and overrides the user's `maxTokens` config value, `--report` now emits an explicit note explaining the override and how to disable it.

### Changed

- `src/analysis/coverage-score.js` exports `CODE_EXTS` (the allowlist Set) for use by other modules and tests.
- `coverageScore()` return object gains a `nonCodeSkipped` field (number of non-code files found in srcDirs but excluded from the denominator).

---

## [5.4.0] — 2026-04-17

### Added

- **Neovim plugin (`sigmap.nvim`)** — first-class Neovim integration in `neovim-plugin/`. Provides `:SigMap [args]` (async regen), `:SigMapQuery <text>` (TF-IDF retrieval in a floating window), `auto_run = true` (`BufWritePost` autocmd for source files), `require('sigmap').statusline()` for lualine/statusline widgets, and `:checkhealth sigmap` (validates Node 18+, binary presence, context file freshness).
- **Binary auto-detection** — plugin resolves the sigmap binary automatically: global `sigmap` → `npx sigmap` → local `gen-context.js` fallback; no manual config needed for most setups.
- **`release-neovim.yml` workflow** — tag `neovim-v*` to validate Lua files, run the full integration suite across Node 18/20/22, package the plugin as a `.tar.gz`, and create a GitHub Release.
- **CI now runs integration tests** — `ci.yml` runs both `node test/run.js` and `node test/integration/all.js` on every push and pull request.

---

## [5.3.0] — 2026-04-17

### Added

- **MCP auto-wire: Windsurf** — `sigmap --setup` now registers the MCP server in `.windsurf/mcp.json` (project-level) and `~/.codeium/windsurf/mcp_config.json` (global) using the standard `mcpServers` shape.
- **MCP auto-wire: Zed** — `sigmap --setup` now registers a context server in `~/.config/zed/settings.json` using Zed's `context_servers` shape (`command.path` / `command.args`).
- **Updated `--setup` snippet** — help output now prints manual config snippets for all four tools: Claude, Cursor, Windsurf, and Zed.

### Changed

- `registerMcp()` skips each target when the file does not exist and never overwrites an already-registered `sigmap` entry (idempotent).

---

## [5.2.0] — 2026-04-17

### Added

- **Learning engine** — new local-only weight store at `.context/weights.json` with path-normalized per-file multipliers, clamp safety (`0.30..3.00`), and decay on every non-reset mutation.
- **`sigmap learn`** — manually boost or penalize ranked files with `--good <files...>`, `--bad <files...>`, and `--reset`. Invalid or out-of-repo paths are skipped with warnings; the command exits non-zero when no valid targets remain.
- **`sigmap weights [--json]`** — explainability view for learned ranking multipliers. Human mode prints a compact table and reset hint; JSON mode emits the raw learned-weight object.
- **Opt-in judge learning** — `sigmap judge --response <file> --context <file> --learn` now extracts file headings from query/generated context files and applies small boosts or penalties when groundedness is confidently high or low.

### Changed

- **Ranker learned weighting** — `rank(query, sigIndex, { cwd })` now loads `.context/weights.json` and multiplies non-empty-query scores by learned file multipliers. Empty-query fallback ordering is unchanged.
- **Learning-aware rank call sites** — `sigmap ask`, `sigmap --query`, `sigmap validate --query`, and MCP `query_context` now pass `cwd` into the ranker so learned weights apply consistently across CLI and MCP flows.

## [5.1.0] — 2026-04-16

### Added

- **Benchmark history tracking** — all three benchmark scripts (`run-retrieval-benchmark.mjs`, `run-benchmark.mjs`, `run-task-benchmark.mjs`) now append a structured NDJSON entry to `.context/benchmark-history.ndjson` after each run (`type: "retrieval" | "token-reduction" | "task"`).
- **`sigmap history` benchmark trend rows** — when `.context/benchmark-history.ndjson` exists, `sigmap history` prints a retrieval `hit@5` sparkline row and a token-reduction sparkline row below the usage table. The command no longer exits early when the usage log is empty.
- **Dashboard `readBenchmarkTrend` uses local history** — `src/format/dashboard.js` now prefers `.context/benchmark-history.ndjson` over the CI-only `benchmarks/results/` directory, so the dashboard hit@5 trend chart populates for all users after running any benchmark locally.

---

## [5.0.0] — 2026-04-16

### Added

- **`sigmap judge --response <file> --context <file>`** — rule-based groundedness scoring engine (`src/judge/judge-engine.js`). Computes a 0–1 score from token overlap between an LLM response and its source context. Exits 0 when verdict is `pass`, exits 1 on `fail`. Supports `--json` (emits `{ score, verdict, reasons }`) and `--threshold` override.
- **Config `extends`** — `gen-context.config.json` now accepts an `"extends"` key pointing to a local JSON file path or HTTPS URL. The base config is deep-merged (DEFAULTS → base → local), with HTTPS responses cached for 1 hour in `.context/config-cache/`.
- **`sigmap history [--last N] [--json]`** — displays last N usage log entries as a table with a Unicode sparkline (▁▂▃▄▅▆▇█) for the token trend. Reads from `.context/usage.ndjson` (requires `tracking: true` in config).

---

## [4.3.0] — 2026-04-16

### Added

- **`sigmap validate`** — validates config (srcDirs exist, exclude patterns, maxTokens range), computes coverage as sig-index size / total source files, warns when coverage < 70%, exits 1 on hard errors. Optional `--query "<q>"` checks that PascalCase/camelCase symbols in the query appear in top-5 ranked context. Supports `--json`.
- **`sigmap --ci [--min-coverage N] [--json]`** — GitHub Actions exit gate: exits 0 when coverage ≥ threshold (default 80%), exits 1 otherwise. Uses sig-index vs source file count for a budget-aware coverage metric. Ready for `npx sigmap --ci` in CI workflows.
- **`extractQuerySymbols(query)`** — internal helper that extracts PascalCase and camelCase identifiers from a query string for symbol-level coverage checks in `sigmap validate`.

### Changed

- **`sigmap ask`** — now emits a stderr warning when coverage < 70%, pointing users to `sigmap validate` for diagnosis.

---

## [4.2.0] — 2026-04-16

### Added

- **`sigmap ask "<query>"`** — unified pipeline: intent detection → ranked mini-context → coverage check → cost estimate → risk level in one command. Supports `--json` for machine-readable output.
- **Intent detection** (`detectIntent`) — classifies queries as `debug`, `explain`, `refactor`, `review`, or `search` and adjusts ranking weights accordingly for higher-relevance results.
- **`sigmap query --context`** — writes a targeted mini-context (top-5 ranked files, ≤ 2 000 tokens) to `.context/query-context.md` for direct pasting into an LLM prompt.
- **`--cost [--model <name>] [--json]`** — prints per-model token/dollar cost comparison (raw source vs SigMap output). Supports `gpt-4o`, `gpt-4`, `claude-3-5-sonnet`, `claude-opus-4`, `gemini-1.5-pro`, and more.
- **`sigmap suggest-profile [--short]`** — reads the last git commit message and staged files to recommend a context profile (`debug`, `architecture`, `review`, or `default`).
- **`sigmap compare [--json]`** — human-readable CLI wrapper over the retrieval benchmark scripts, showing SigMap vs baseline hit@5, token counts, and lift multiplier.
- **`sigmap share`** — prints a shareable one-liner with live benchmark numbers and copies it to the clipboard via `pbcopy`/`xclip`.

---

## [4.1.2] — 2026-04-16 — Feat: --output <file> flag for custom context path

### Added

- **`--output <file>` flag** — write signatures to any custom path, not just
  an adapter's fixed location:
  ```bash
  sigmap --output .context/ai-context.md          # default generation
  sigmap --adapter claude --output shared/sigs.md # adapter + custom path
  ```
  The custom file is written **in addition to** the adapter's default output so
  existing tooling is unaffected.

- **Automatic discovery for `--query`** — the resolved path is persisted to
  `gen-context.config.json` as `customOutput` so subsequent `--query` runs
  find it automatically without needing to pass `--output` again:
  ```bash
  sigmap --output .context/ai-context.md          # generates + persists path
  sigmap --query "add a new extractor"             # auto-finds .context/ai-context.md
  ```

- **Priority order for `--query` context resolution** (most specific first):
  1. `--output <file>` flag — explicit path
  2. `--adapter <name>` flag — adapter's fixed output path
  3. `customOutput` in `gen-context.config.json` — persisted from last `--output` run
  4. Probe all known adapter output paths — existing fallback behaviour

- **Nested directories created automatically** — `--output a/b/c/file.md`
  creates any missing parent directories.

### Tests

- Added `test/integration/output-flag.test.js` (13 tests) covering: custom
  file creation, parseable headers, config persistence, nested dirs, missing
  arg error, `--adapter` + `--output` combo, explicit `--query` with `--output`,
  auto-discovery via persisted config, missing-file error, `--output` overrides
  `--adapter` during `--query`.

---

## [4.1.1] — 2026-04-16 — Fix: --query works with any adapter output

### Fixed

- **`--query` fails after `--adapter` generation** (`[sigmap] no context file found`):  
  `buildSigIndex` hardcoded `.github/copilot-instructions.md` as the only
  context file path, so `--query` always failed when any adapter other than
  `copilot` wrote to a different location (`CLAUDE.md`, `AGENTS.md`,
  `.cursorrules`, `.windsurfrules`, etc.).

  `buildSigIndex` now probes all nine known adapter output paths in priority
  order and returns the first non-empty index:
  ```
  copilot → claude → codex → cursor → windsurf → openai → gemini → llm-full → llm
  ```
  Human-written preamble before the `## Auto-generated signatures` marker
  (e.g. custom content in `CLAUDE.md`) is skipped so those `###` sections
  don't pollute the signature index.

- **`--adapter <name> --query "..."` combination ignored the adapter flag**:  
  The `--query` handler now detects a co-present `--adapter` flag, resolves
  that adapter's output path, and reads from it directly — so both forms work:
  ```bash
  # generate with claude adapter, then query without re-specifying adapter
  node gen-context.js --adapter claude
  node gen-context.js --query "add a new extractor"

  # or pin explicitly in one command
  node gen-context.js --adapter claude --query "add a new extractor"
  ```

- **`--analyze --json` output truncated at ~8 KB on macOS**:  
  Calling `process.exit(0)` immediately after `process.stdout.write(largeJson)`
  truncated output because the underlying pipe write is asynchronous even
  when `write()` returns `true`. Fixed by using the write callback so the
  process exits only after the OS has accepted all bytes.

### Tests

- Added `test/integration/query-adapter.test.js` (17 tests) covering every
  adapter output path (unit + CLI), probe order, marker-skipping, explicit
  `opts.contextPath` override, and empty-project fallback.

---

## [4.1.0] — 2026-04-15 — Smart Budget: auto-scaling token budget

### Added

- **Auto-scaling token budget** (`autoMaxTokens: true`, default on):  
  Replaces the old fixed 6 000-token default with a formula that sizes the budget to your repo:
  ```
  effective = clamp(ceil(totalSigTokens × coverageTarget), 4000, floor(modelContextLimit × maxTokensHeadroom))
  ```
  - `coverageTarget` (default `0.80`) — target fraction of source files to include
  - `modelContextLimit` (default `128000`) — model context window size; hard cap = `limit × headroom`
  - `maxTokensHeadroom` (default `0.20`) — fraction of the model window reserved for SigMap output (default hard cap: **25 600 tokens**)
  - Minimum floor: **4 000 tokens** (prevents tiny repos from being under-budgeted)
  - When the hard cap prevents hitting the coverage target by more than 10 percentage points, SigMap warns and suggests `strategy: "per-module"`

- **Four new config keys** (all optional, documented in `gen-context.config.json.example`):
  | Key | Default | Description |
  |---|---|---|
  | `autoMaxTokens` | `true` | Enable auto-scaling |
  | `coverageTarget` | `0.80` | Target fraction of source files |
  | `modelContextLimit` | `128000` | Model context window (tokens) |
  | `maxTokensHeadroom` | `0.20` | Fraction of context for SigMap |

- **Post-run summary annotation**: coverage line now shows `[budget: N auto-scaled]` when the formula overrode the configured `maxTokens`.

- **Per-module strategy budget fix**: each module now gets its own full effective budget instead of a proportional slice, which was the limiting factor that made `per-module` less useful than advertised.

- **Tracking log fields**: `autoBudget: true/false` and `budgetLimit: N` added to `.context/usage.ndjson` entries.

- **12 new integration tests** (`test/integration/auto-budget.test.js`): cover MIN floor, proportional scaling, hard cap, disabled auto-scaling, custom `coverageTarget`/`modelContextLimit`/`maxTokensHeadroom`, warning emission, and empty-project edge case.

### Changed

- `autoMaxTokens: false` + explicit `maxTokens` preserves the old fixed-budget behaviour exactly — fully backwards compatible.
- `printReport` now labels the budget `(auto-scaled)` vs `(fixed)` in the report line.

### Benchmarks (v4.1.0)
- Token reduction: **97.6% average** across 18 repos ✅  
- Retrieval hit@5: **84.4%** ✅  
- With auto-scaling enabled, all 18 benchmark repos now stay within a sensible budget that targets ≥ 80% file coverage rather than the old 6 K ceiling.

---

## [4.0.2] — 2026-04-15 — Bundle factory fix (re-release of 4.0.1)

### Fixed
- v4.0.1 was published to npm/GitHub Packages before the binary CI step ran, which meant the published package contained the incomplete bundle (missing `./src/analysis/coverage-score` factory). v4.0.2 is a clean re-release with all fixes from 4.0.1 and the correct bundle.

---

## [4.0.1] — 2026-04-15 — Config auto-detection fix

### Fixed
- **Bundled `loadConfig` lacked `detectAutoSrcDirs`**: the inline `__factories["./src/config/loader"]` copy inside `gen-context.js` was a stripped-down version that returned raw `DEFAULTS` without filesystem auto-detection. After `--init` wrote a config with 6 hardcoded `srcDirs`, auto-detection was bypassed and custom project directories were missed — causing coverage to drop for any project whose source lives outside those 6 dirs. The bundled loader is now fully in sync with `src/config/loader.js`.
- **`--init` config hardcoded `srcDirs`**: `gen-context.config.json.example` had `"srcDirs": ["src","app","lib","packages","services","api"]` as a plain value. Any project that ran `--init` would lock into those 6 dirs and lose auto-detection. The example now omits `srcDirs` entirely and uses `_comment` keys to explain that auto-detection runs automatically. Users who need custom dirs can add `srcDirs` manually.
- **`gen-context.config.json` (SigMap repo)**: restored explicit `"srcDirs": ["src","packages"]` so the repo's own context generation is not affected by auto-detection picking up `docs-vp/`, `scripts/`, `test/`, and `vscode-extension/`.
- **Example `outputs` updated**: `gen-context.config.json.example` now lists all four standard adapters — `["copilot","codex","claude","gemini"]` — matching the recommended setup.

### Benchmarks (v4.0.1)
- Token reduction: **97.6% average** across 18 repos ✅
- Retrieval hit@5: **84.4%** (up from 83.3% in v4.0.0)

---

## [4.0.0] — 2026-04-15 — Intelligence Layer

### Added
- **Coverage score** (`src/analysis/coverage-score.js`): measures what fraction of source files made it into context after token-budget application.
  - Grade scale: A ≥ 90% · B ≥ 75% · C ≥ 50% · D < 50%
  - Confidence indicator: HIGH / MEDIUM / LOW
  - Per-module breakdown per srcDir via `perModule` Map
- **Confidence indicators in all output writers**: every generated file now includes a metadata comment:
  ```
  <!-- sigmap: version=4.0.0 confidence=HIGH coverage=94% dropped=9 commit=abc1234 -->
  ```
  Applies to: `copilot`, `claude`, `cursor`, `windsurf`, `openai`, `gemini` adapters.
- **`--report` module heatmap**: ASCII bar chart per srcDir showing coverage percentage:
  ```
  Module Coverage:
    src                ████████████████ 100% (64/64 files)
    packages           ██████████████░░  86% (12/14 files)
  ```
  `--report --json` gains a `coverage` object with `score`, `grade`, `confidence`, `totalFiles`, `includedFiles`, `droppedFiles`, and `perModule`.
- **`--diff` risk score**: each changed file is now classified LOW / MEDIUM / HIGH based on reverse-dependency BFS, public API exports, route status, and config-file status:
  ```
  [sigmap] Risk: Changed files (3):
    src/auth/service.ts         [HIGH]    — exports public API, 5 downstream dependents
    src/config/database.ts      [MEDIUM]  — config file
    src/utils/format.ts         [LOW]     — no dependents, internal utility
  ```
- **Coverage in post-run summary**: every normal run now prints a `Coverage` line:
  ```
   Coverage       : A (97%)  — 76 of 78 source files included
  ```
- **Coverage in `--health` and `--health --json`**: coverage grade, score, and file counts are included in both text and JSON health output. `--health --json` adds `coverage`, `coverageGrade`, `coverageConfidence`, `coverageTotalFiles`, `coverageIncludedFiles`.

### Changed
- **Token budget drop order step 5**: now uses `signalQuality = sigs / linesOfCode` (least-informative files dropped first) instead of the previous "fewest sigs" heuristic.
- **`src/eval/analyzer.js` `analyzeFiles()` output**: each file stat now includes `linesOfCode` and `signalQuality` fields.

### Benchmark (v4.0.0)
- Token reduction: **97.6% average** across 18 repos (target ≥ 97.0%) ✅
- Retrieval hit@5: 83.3% (retrieval improvement targeted in v4.5 with adaptive query)

---

## [3.5.0] — 2026-04-14 — Phase C/D Intelligence Expansion

### Added
- **Phase C framework-specialized extractors** for richer framework-level signatures:
  - TypeScript React: `.tsx` component metadata (props, hooks, handlers)
  - Vue SFC: `.vue` component metadata (props, emits, slots, lifecycle)
  - Python dataclass/model patterns: dataclasses, Pydantic models, ORM-style fields
- **Phase D cross-module pattern extractor**:
  - Detects DI containers and injection signatures
  - Detects service, repository, middleware, and controller layer hints
  - Detects type-to-implementation linkage and domain use-case cues
  - Flags unsafe patterns (null-check risks, weak validation, error exposure)

### Changed
- **Extractor mapping expanded** so framework-specific files route to specialized extractors (`.tsx` and `.vue`) for higher-signal signatures.
- **Standalone/bundled runtime wiring updated** to include new Phase C/D extractors in factory resolution.

### Testing
- Added integration coverage for Phase C extractors (`phase-c-extractors`) and Phase D pattern inference (`phase-d-patterns`).
- Current results:
  - `phase-c-extractors`: 3 passed, 0 failed
  - `phase-d-patterns`: 10 passed, 0 failed

---

## [3.4.0] — 2026-04-14 — Phase A/B Coverage Expansion

### Added
- **Phase A extractor support** for high-value config and docs formats:
  - TOML: `.toml`
  - Java/INI properties: `.properties`
  - XML: `.xml`
  - Markdown technical docs: `.md`
- **Bundled runtime factory wiring** for new extractors so standalone/binary execution resolves the same modules as source mode.

### Changed
- **Framework-aware source discovery** defaults expanded for Next/React, Angular, Rails, Laravel, and Flask/Python-style layouts.
- **Strategy audit coverage rules** updated to treat Phase A formats as supported instead of important unsupported baselines.
- **Default srcDirs** broadened to improve first-run context quality on framework-heavy repositories.
## [3.3.4] — 2026-04-14 — Binary Bundle Fix

### Fixed
- **Standalone binary pre-flight now passes for new P1 extractors**
  - Added missing bundled `__factories` entries in `gen-context.js` for:
    - `./src/extractors/graphql`
    - `./src/extractors/protobuf`
    - `./src/extractors/sql`
    - `./src/extractors/terraform`
  - Resolves CI/build failure in `scripts/build-binary.mjs` reporting missing `src/` modules in bundle.

---

## [3.3.3] — 2026-04-14 — Auto srcDirs + P1 Extractors

### Added
- **P1 extractor support** for additional high-value formats:
  - SQL: `.sql`
  - GraphQL: `.graphql`, `.gql`
  - Terraform: `.tf`, `.tfvars`
  - Protobuf: `.proto`
- **Extractor registration updates** across runtime and core mapping so the new file types are parsed consistently.

### Changed
- **Auto source directory detection** (framework- and manifest-aware) in config loading and strategy auditing.
- **Auto maxDepth tuning** in strategy audit based on repository file-depth distribution.
- **Benchmark strategy-audit reports refreshed** to reflect improved source discovery and coverage.
- **Language support count updated from 21 to 25** across core README and extension README.

---

## [3.3.1] — 2026-04-10 — Patch: `--each --adapter` flag combination

### Fixed
- **`--each --adapter <name>` now works correctly** · [#37](https://github.com/manojmallick/sigmap/issues/37)
  - Running `sigmap --each --adapter claude` (or any adapter) from a parent directory containing multiple git repos now correctly writes the chosen adapter output (e.g. `CLAUDE.md`) inside each sub-repo.
  - Root cause: the `--adapter` handler ran before `--each` in `main()`, so `--each` was never reached when both flags were supplied together. The `--each` block is now evaluated first.
  - `runEach()` accepts an optional `adapterOverride` parameter that merges `outputs`/`adapters` into each sub-repo's config before calling `runGenerate`, mirroring how the standalone `--adapter` flag works.
  - Invalid adapter names passed alongside `--each` now exit non-zero with a clear error message listing valid adapters.

---

## [3.3.0] — 2026-04-08 — Context-Aware CLI & Command Switcher

### Added
- **Context-aware `--help` output** — `gen-context.js` and `gen-project-map.js` now detect how they were invoked and show the matching command in every usage example:
  - `npx sigmap --help` shows `npx sigmap <flag>`
  - `sigmap --help` shows `sigmap <flag>`
  - `gen-context --help` shows `gen-context <flag>`
  - `node gen-context.js --help` shows `node gen-context.js <flag>` (unchanged for local users)
  - Detection uses `process.argv[1]` path analysis (npx cache path, basename without `.js`, fallback)
- **`docs/cli.html` command picker** — four-tab switcher ("How you run it:") above the flags reference terminal updates every code block on the page (all `.tw` spans and `.term-title` bars) to the selected invocation style. Applies equally to `gen-project-map` references. Selection is saved in `localStorage` and restored on next visit.
- **`docs/readmes/`** — `vscode-extension.md` and `jetbrains-plugin.md` added for docs site cross-linking
- **`gen-context.config.json`** — example config committed alongside the repo for reference
- **Gemini adapter context file** — `.github/gemini-context.md` now generated alongside the copilot instructions file
- **SEO improvements across all docs pages** — structured data, canonical tags, improved meta descriptions, and `sitemap.xml` updated to v3.3.0

### Added (from `fix/defaults-css-coverage-budget-36` · #38)
- **`--each` flag — multi-repo parent directory support** · [#37](https://github.com/manojmallick/sigmap/issues/37)
  - Running `node gen-context.js --each` (or `sigmap --each`) from a parent directory that contains multiple independent git repos now processes each repo in one shot.
  - Scans immediate subdirectories; a subdirectory qualifies when it contains `.git` or a recognised project manifest (`package.json`, `pyproject.toml`, `Cargo.toml`, `go.mod`, `build.gradle`, `pom.xml`, `requirements.txt`).
  - Each sub-repo is processed independently: it loads its own `gen-context.config.json` when present, uses its own `srcDirs`, and writes its own context files (`.github/copilot-instructions.md` etc.) inside itself.
  - Summary printed at the end: `[sigmap] --each: done — 3 succeeded`.
  - Distinct from `--monorepo` (which processes workspace packages inside a single repo); `--each` targets sibling repos under a shared parent directory.

### Fixed
- **Default excludes expanded + `changesCommits` corrected** · [#36](https://github.com/manojmallick/sigmap/issues/36)
  - `changesCommits` default raised from `5` to `10` to match the documented recommended value.
  - Added `playwright-tmp`, `playwright-report`, `test-results`, `.turbo`, `storybook-static`, `.docusaurus` to the default `exclude` list so they are skipped on modern JS/TS projects without requiring manual config.
- **CSS extractor: utility-class noise elimination** · [#36](https://github.com/manojmallick/sigmap/issues/36)
  - Files where ≥70% of top-level selectors are single-word (e.g. Tailwind / compiled utility CSS) are now detected automatically and class extraction is skipped entirely, preventing the output from being flooded with low-signal entries like `.p-4`, `.flex`, `.text-sm`.
  - For semantic CSS, BEM/hyphenated class names (e.g. `.modal-header`, `.btn-primary`) fill output slots first; single-word names only fill remaining slots up to 8.
- **`testCoverage` false-positive coverage markers eliminated** · [#36](https://github.com/manojmallick/sigmap/issues/36)
  - Removed the "all word tokens" pass from `buildTestIndex` that caused common words appearing anywhere in a test file (comments, variable names) to mark unrelated functions as `✓` tested.
  - Index now only includes tokens extracted from test name strings (`it('...')`, `test('...')`, `describe('...')`) and identifiers directly invoked inside `expect(fn())` / `assert(fn())` calls.
- **Token budget: mock/fixture files drop before test files** · [#36](https://github.com/manojmallick/sigmap/issues/36)
  - Added `isMockFile()` helper and priority-9 drop tier in `applyTokenBudget`. Paths matching `mock`, `mocks`, `stub`, `stubs`, `fake`, `fakes`, `demo`, `__mocks__`, `fixtures` or file suffixes like `.mock.ts` now drop before test files (priority 8) and after generated files (priority 10), keeping real production code in context longer.
  - Fixed `applyTokenBudget` loop direction: generated/mock/test files now drop first (as intended) rather than source files being dropped first.
- **`--monorepo` now respects configured output adapter** · [#39](https://github.com/manojmallick/sigmap/issues/39)
  - Removed hardcoded `outputs: ['claude']` override — `--monorepo` now inherits `outputs` from the root config, defaulting to `copilot` (writes `copilot-instructions.md` per package).
- **IDE command resolution parity (VS Code/Open VSX/JetBrains)** · [#34](https://github.com/manojmallick/sigmap/issues/34)
  - Unified resolver now checks both `sigmap` and `gen-context` executables with consistent fallback order.
  - Improved cross-platform probing for local workspace bins, Volta/nvm/npm-global installs, and OS-specific command lookup (`where` on Windows, shell lookup on macOS/Linux).
  - JetBrains plugin now resolves commands more reliably outside Node-only projects and provides OS-aware install guidance when command lookup fails.

### Changed
- **Installation guidance for plugin users**
  - Updated VS Code/Open VSX and JetBrains setup docs to include all supported install paths: npm global, npm local, npx, standalone binaries in PATH, and project-local `gen-context.js`.

---

## [3.2.1] — 2026-04-07 — Patch: IDE Command Resolution & Plugin Parity

### Added
- **IDE command resolution parity (VS Code / Open VSX / JetBrains)** · [#34](https://github.com/manojmallick/sigmap/issues/34)
  - Unified resolver checks both `sigmap` and `gen-context` executables with consistent fallback order
  - Improved cross-platform probing for local workspace bins, Volta/nvm/npm-global installs, and OS-specific command lookup (`where` on Windows, shell lookup on macOS/Linux)
  - JetBrains plugin resolves commands more reliably outside Node-only projects and provides OS-aware install guidance when command lookup fails
- **`scripts/sync-versions.mjs`** — one-shot script to bump version across all package manifests and `gen-context.js` in sync
- **Updated plugin docs** — VS Code/Open VSX and JetBrains setup docs updated with all supported install paths (npm global, npm local, npx, standalone binaries, project-local `gen-context.js`)

---

## [3.2.0] — 2026-04-07 — Cross-Platform Standalone Binaries

### Added
- **Standalone binaries** — macOS (arm64 + x64), Linux x64, Windows x64 built via Node.js SEA
  - No Node.js or npm required to run SigMap
  - Download from GitHub Releases: `sigmap-darwin-arm64`, `sigmap-darwin-x64`, `sigmap-linux-x64`, `sigmap-win32-x64.exe`
  - SHA-256 checksums in `sigmap-checksums.txt` attached to every release
- **`scripts/build-binary.mjs`** — reproducible local binary build for the current platform
- **`scripts/verify-binary.mjs`** — smoke tests `--version`, `--help`, default generate, `--health`, `--report` against a fixture repo
- **`.github/workflows/release-binaries.yml`** — GHA matrix builds all 4 targets on tag push; attaches artifacts to the GitHub Release
- **`test/fixtures/binary-smoke/`** — minimal fixture project used by CI smoke tests
- **`docs/binaries.md`** — install guide covering download, `chmod +x`, macOS Gatekeeper, Windows SmartScreen, and checksum verification

### Technical
- Uses [Node.js SEA](https://nodejs.org/api/single-executable-applications.html) (Node 20 `--experimental-sea-config` + `postject`)
- `gen-context.js` updated to include previously-missing `src/` modules (`todos`, `coverage`, `prdiff`) in the SEA bundle; `requireSourceOrBundled()` fallback remains SEA-compatible
- Binary builds run natively per OS in GHA (no cross-compilation)
- `release-attach` job waits for the npm-publish Release to exist before uploading binary assets

---

## [3.1.0] — 2026-04-07 — Global Command Detection & VS Code Prerelease Fix

### Added
- **VS Code extension: global command auto-detection** — extension now finds `gen-context` installed via Volta, nvm, npm, or Homebrew without requiring `gen-context.js` in the project root or a manual `sigmap.scriptPath` setting
  - Probe chain: local `node_modules/.bin` → `~/.volta/bin` → `~/.nvm/versions/node/*/bin` (newest first) → `/usr/local/bin` → `/opt/homebrew/bin` → `~/.npm-global/bin` → login-shell `which`
  - Works on macOS GUI apps that do not inherit shell `PATH`
  - `resolveGlobalCommand()` + unified `resolveRunner()` added to `vscode-extension/src/extension.js`
- **VS Code extension: actionable error message** — when command is not found, notification offers "Copy install command" (copies `npm install -g sigmap` to clipboard) and "Open settings" buttons instead of a plain warning
- **Prerelease GitHub Actions workflow** — new `prerelease-publish.yml` for manual alpha/beta/rc releases across all 5 platforms (npm, GitHub Packages, VS Code, Open VSX, JetBrains) without marking as @latest
  - VS Code/Open VSX uses `major.minor.patch` versioning (VSCE prerelease constraint)
  - npm/JetBrains use full semver prerelease suffix (e.g. `3.1.0-beta.1`)

### Fixed
- **`output` config key not honored for copilot adapter** · [#30](https://github.com/manojmallick/sigmap/issues/30)
  - Custom `output` path in config now correctly used for copilot adapter instead of hard-wired `.github/copilot-instructions.md`
  - Added `resolveAdapterPath()` helper to centralize adapter path resolution
  - Other adapters (claude, cursor, windsurf) continue to use fixed paths as designed
  - 5 new integration tests ensure custom paths work correctly across all config combinations
- **JetBrains plugin: global `gen-context` command support** · [#29](https://github.com/manojmallick/sigmap/issues/29)
  - Plugin now resolves command via fallback chain: local `gen-context.js` → `node_modules/.bin/gen-context` → system `PATH`
  - Enables use in Java, Rust, Go and other non-Node projects with `gen-context` installed globally via Volta/nvm/npm
- **VS Code prerelease versioning** — workflow previously failed publishing because semver-suffixed versions (e.g. `3.1.0-alpha.1`) are rejected by VSCE; fixed by splitting into separate `npm_version` and `vscode_version` outputs

### Technical
- `resolveRunner()` returns `{ type: 'script' | 'command', path }` allowing extension to run either `node "path/gen-context.js"` or `"~/.volta/bin/gen-context"` without modification to the terminal command

### How to release (tag triggers automatic publish)
```bash
git tag v3.1.0
git push origin v3.1.0
# npm-publish.yml auto-triggers and publishes to all 5 platforms
```

---

## [3.0.0] — 2026-04-06 — Platform: Multi-Adapter Architecture

### Added
- **Multi-adapter platform** — `packages/adapters/` with 6 output adapters: `copilot`, `claude`, `cursor`, `windsurf`, `openai`, `gemini`
- **`--adapter <name>` CLI flag** — generate output for a specific adapter only (e.g. `node gen-context.js --adapter openai`)
- **`adapt()` in packages/core** — programmatic API: `const { adapt } = require('sigmap'); adapt(context, 'openai')`
- **New config key `adapters`** — replaces `outputs`; old `outputs` key is silently mapped for full backward compatibility
- **OpenAI adapter** — formats context as an OpenAI system prompt, writes `.github/openai-context.md`
- **Gemini adapter** — formats context as a Gemini system instruction, writes `.github/gemini-context.md`
- **API stability guarantee** — `packages/core` API is now semver-stable; breaking changes require v4.0
- **20 new integration tests** in `test/integration/adapters.test.js`

### Changed
- `packages/core/index.js` — adds `adapt()` export alongside existing `extract`, `rank`, `scan`, `score`, `buildSigIndex`
- `writeOutputs()` in `gen-context.js` — now routes `openai`, `gemini` through adapter pipeline

### Backward compat
- `outputs: ["copilot","claude"]` config still works — automatically mirrored to `adapters`
- All existing CLI flags unchanged

---

## [2.10.0] — 2026-04-06 · [#25](https://github.com/manojmallick/sigmap/issues/25)

### Planned additions
- **Report charts** — add chart-ready output for token reduction, signatures per file, and budget utilization trends.
- **Advanced metrics** — extend evaluation output with precision@K, recall@K, MRR, and query-level diagnostics.
- **CLI reporting mode** — introduce richer report surfaces for both human-readable tables and structured JSON artifacts.
- **Benchmark visibility** — include comparative metrics across runs to track regressions and improvements over time.
- **Docs refresh** — align roadmap and docs site references to the v2.10 milestone.

### Go / No-go criteria
- Full test suite passes (extractor + integration).
- Report output includes chart-friendly numeric series and summary stats.
- Benchmark metrics remain stable or improve versus v2.9 baseline.
- Generated docs and release metadata are version-synced to `2.10.0`.

---

## [2.9.1] — 2026-04-06 · JetBrains Marketplace Publishing

### Added
- **JetBrains Marketplace publishing** — automated publishing job in GitHub Actions workflow
- **Gradle wrapper** — gradlew, gradlew.bat for consistent JetBrains plugin builds
- **Publishing guide** — comprehensive [docs/JETBRAINS_PUBLISH.md](docs/JETBRAINS_PUBLISH.md)
- **JetBrains Marketplace badge** — added to README.md
- **One-time token setup** — documented in publishing guide

### Details
- GitHub Actions workflow now includes `publish-jetbrains` job
- Publishes to JetBrains Marketplace alongside npm, GitHub Packages, VS Code, and Open VSX
- Requires `JETBRAINS_PUBLISH_TOKEN` secret for automated publishing
- Full publishing guide with manual instructions and troubleshooting

---

## [2.9.0] — 2026-04-05 · IDE Expansion: JetBrains Plugin

### Added
- **JetBrains plugin** — native support for all JetBrains IDEs (IntelliJ IDEA, WebStorm, PyCharm, GoLand, RubyMine, etc.)
- **Plugin descriptor** — `jetbrains-plugin/src/main/resources/META-INF/plugin.xml` with 3 actions + status bar widget
- **Kotlin sources** — 5 action implementations (RegenerateAction, OpenContextFileAction, ViewRoadmapAction, HealthStatusBar, Factory)
- **Toolbar actions** — "Regenerate Context" (Ctrl+Alt+G), "Open Context File", "View Roadmap"
- **Status bar widget** — shows health grade (A-F) and time since last regeneration; updates every 60s
- **Gradle build** — `jetbrains-plugin/build.gradle.kts` with IntelliJ Platform 2024.1+ compatibility
- **Setup documentation** — [docs/JETBRAINS_SETUP.md](docs/JETBRAINS_SETUP.md) with installation guide, features, troubleshooting
- **Integration tests** — `test/integration/jetbrains.test.js` with 11 structure validation tests

### Details
- Compatible with IntelliJ IDEA 2024.1 - 2024.3 (Community & Ultimate)
- One-click context regeneration from IDE toolbar
- Automatic status bar updates every 60 seconds
- Full Kotlin/Gradle plugin with proper plugin.xml structure

---

## [2.8.0] — upcoming · [#21](https://github.com/manojmallick/sigmap/issues/21) · branch: `feat/v2.8-snippet-retrieval`

### Planned additions
- **Snippet extraction** — `src/retrieval/snippets.js`: extract relevant code blocks (functions, classes, methods) from ranked files
- **Hybrid scoring** — combine file-level relevance with snippet-level relevance; snippets inherit file score + get their own local score
- **`--query --snippets` CLI flag** — return top-k snippets (not full file sigs), with line numbers and context
- **`query_context` MCP enhancement** — add `snippets: true` option; response includes snippet text + line ranges
- **Smart context window** — include 2-3 lines before/after snippet for context
- **Configuration** — `retrieval.snippets: { enabled: true, minLines: 3, maxSnippets: 5 }`
- **`test/integration/snippets.test.js`** — 12 tests: snippet extraction, scoring, line number accuracy, context window

### Go / No-go criteria
- All tests green (21 extractor + all integration)
- `--query "extract signatures" --snippets` returns 3-5 relevant snippets with correct line numbers
- MCP `query_context` with `snippets: true` returns snippet text
- Snippet relevance improves precision@3 by ≥10% over full-file retrieval
- Performance: <150ms for 1000-file repos with snippets enabled

---

## [2.7.0] — 2026-04-05 · [#19](https://github.com/manojmallick/sigmap/issues/19)

### Planned additions
- **Fine-tuned ranking weights** — optimize `exactToken`, `symbolMatch`, `prefixMatch`, `pathMatch`, and `recencyBoost` weights in `src/retrieval/ranker.js` based on benchmark-driven evaluation
- **TF-IDF scoring option** — add TF-IDF (term frequency-inverse document frequency) as an alternative scoring method for better semantic relevance in large codebases
- **Configurable weight presets** — `precision`, `balanced`, `recall` presets for different use cases; configurable via `retrieval.preset` in config
- **`formatRankTable` and `formatRankJSON` improvements** — better output formatting for ranked results with score breakdown and relevance explanation
- **Performance optimization** — optimize ranking algorithm for large codebases (10K+ files), target <100ms for --query on 1000-file repos
- **Regression tests** — ensure hit@5 maintains ≥ 0.80 (no regression from v2.6)
- **Precision improvement** — target precision@5 improvement of ≥ 5% over v2.6

### Config additions
```json
{
  "retrieval": {
    "topK": 10,
    "recencyBoost": 1.5,
    "preset": "balanced",
    "weights": {
      "exactToken": 1.0,
      "symbolMatch": 0.5,
      "prefixMatch": 0.3,
      "pathMatch": 0.8
    }
  }
}
```

### Go / No-go criteria
- All tests green (21 extractor + all integration suites)
- Benchmark hit@5 ≥ 0.80 (no regression from v2.6)
- Precision@5 improves by ≥ 5%
- `--query` performance <100ms for 1000-file repos

---

## [2.6.0] — 2026-04-05 · [#16](https://github.com/manojmallick/sigmap/issues/16)

### Planned additions
- **`benchmarks/repos/`** — register 5 real open-source repos (express, flask, gin, spring-petclinic, rails) as git submodules or clone targets for evaluation
- **`benchmarks/tasks/retrieval-real.jsonl`** — 50 real evaluation tasks across all 5 repos; structured JSONL format compatible with the v2.1 benchmark runner
- **`--benchmark --repo <path>` CLI flag** — run benchmark against external repository; supports any git-cloned project
- **`--report --paper` CLI flag** — generates `benchmarks/reports/paper-metrics.md`: token reduction table (baseline vs SigMap per repo), hit@5 and MRR per repo, latency table (p50, p95, p99 in ms), LaTeX-ready table block for copy-paste into academic papers
- **`src/eval/paper.js`** — formats paper-ready markdown + LaTeX tables; zero dependencies
- **`test/integration/paper.test.js`** — 8 tests: `--report --paper` creates the report file, report contains all required sections, LaTeX table block present and syntactically valid, `--benchmark --repo <missing>` fails gracefully

### Go / No-go criteria
- All tests green (21 extractor + all integration suites)
- `--report --paper` generates a valid markdown file
- LaTeX table block present in report
- Overall hit@5 across all repos ≥ 0.75
- `--benchmark --repo .` completes in < 30 s on SigMap repo

---

## [2.5.0] — 2026-04-05

### Added
- **Impact analysis layer** — `src/graph/impact.js` provides dependency impact analysis: `getImpact(changedFile, graph)` → `{ changed, direct, transitive, tests, routes }`. Uses reverse dependency graph (BFS traversal) to find all files affected by a change.
- **`--impact <file>` CLI flag** — prints all files impacted by changing `<file>`, with their signatures. Supports `--impact --json` (machine-readable output) and `--impact --depth <n>` (BFS depth limit).
- **`get_impact` MCP tool** — 9th MCP tool; accepts `{ file: string, depth?: number }` and returns list of impacted files + signatures, usable live in any MCP session.
- **Dependency graph builder** — `src/graph/builder.js` enhanced: `build(files, cwd)` now returns `{ forward, reverse }` maps; reverse map powers impact analysis.
- **Impact config** — `config.impact.depth` (default: unlimited) and `config.impact.includeSigs` (default: true) added to `src/config/defaults.js`.
- **`test/integration/impact.test.js`** — 20 integration tests: direct deps, transitive deps, circular dependency handling (no infinite loop), depth limit, unknown file returns empty, JSON output shape, MCP tool contract, formatImpact output.

### Changed
- `src/mcp/server.js` version bumped to `2.5.0`.
- `src/mcp/tools.js` now includes `get_impact` tool definition (9th tool).
- `test/integration/mcp-server.test.js` updated to assert 9 tools.

### Validation gate
- 21/21 extractor unit tests passed
- 22/22 integration suites passed (0 failures, including new `impact.test.js`)
- `--impact src/graph/impact.js` returns correct transitive dependencies
- MCP `tools/list` returns 9 tools
- No infinite loops on circular dependencies

---

## [2.4.0] — 2026-04-05

### Added
- **`packages/core/`** — new `sigmap-core` package exposing a stable programmatic API: `{ extract, rank, buildSigIndex, scan, score }`. Third-party tools can now `require('sigmap')` and use all extraction/retrieval/security/health APIs without spawning a CLI process.
- **`packages/cli/`** — new `sigmap-cli` thin wrapper that exposes `{ CLI_ENTRY, run }` for programmatic CLI invocation and forward-compat with the v3.0 adapter architecture.
- **`packages/core/README.md`** — full programmatic API reference with usage examples for all five exported functions.
- **`exports` field in `package.json`** — `require('sigmap')` resolves to `packages/core/index.js`; `require('sigmap/cli')` resolves to `packages/cli/index.js`.
- **`test/integration/core-api.test.js`** — 15 integration tests covering: all exports present, `extract` for JS/TS/Python, file-path extension detection, unknown language returns `[]`, never throws on bad input, `rank` with empty map, `rank` sorted shape, `scan` clean/redact, `score` shape, `buildSigIndex` returns Map, CLI `--version` backward compat, CLI `--help` no crash.

### Changed
- `package.json` `"version"` bumped to `2.4.0`.
- `package.json` `"files"` — added `"packages/"` so `sigmap-core` and `sigmap-cli` are published with the root package.
- `gen-context.js` `VERSION` constant bumped to `2.4.0`.
- `src/mcp/server.js` `SERVER_INFO.version` bumped to `2.4.0`.

### Validation gate
- 21/21 extractor unit tests passed
- 21/21 integration suites passed (0 failures, including new `core-api.test.js`)
- `node gen-context.js --version` → `2.4.0`
- `node -e "const { extract } = require('.'); console.log(extract('function hello(){}', 'javascript').length > 0 ? 'OK' : 'FAIL')"` → `OK`
- `require('sigmap')` works from any directory

---

## [2.3.0] — 2026-04-07

### Added
- **Query-aware retrieval** — `src/retrieval/tokenizer.js` and `src/retrieval/ranker.js`: zero-dependency relevance ranker that scores every file against a free-text query by exact token, symbol, prefix, path, and recency signals.
- **`--query "<text>"` CLI flag** — ranks all context files by relevance and prints a scored table (Rank | File | Score | Sigs | Tokens) plus the top-3 signature blocks; `--query "<text>" --json` for machine-readable output; `--query "<text>" --top <n>` to limit result set.
- **`query_context` MCP tool** — 8th MCP tool; accepts `{ query: string, topK?: number }` and returns the same ranked table as the `--query` CLI flag; live within any running MCP session.
- **Retrieval config** — `config.retrieval.topK` (default 10) and `config.retrieval.recencyBoost` (default 1.5×) added to `src/config/defaults.js`.
- **`test/integration/retrieval.test.js`** — 23 integration tests covering tokenizer unit tests, ranker sorting/scoring/topK/empty-query, `formatRankTable`, `formatRankJSON`, CLI `--query` flags, and MCP `query_context`.

### Changed
- `src/mcp/server.js` version bumped to `2.3.0`.
- `test/integration/mcp-server.test.js` and `mcp-v14.test.js` updated to assert 8 tools.
- `test/integration/analyze.test.js` version assertion updated to `2.3.0`.

### Validation gate
- 21/21 extractor unit tests passed
- 20/20 integration suites passed (0 failures)
- `node gen-context.js --version` → `2.3.0`
- `node gen-context.js --query "python extractor"` → `src/extractors/python.js` in top-3
- `node gen-context.js --query "fix secret scanning" --json` → valid JSON
- MCP `tools/list` → 8 tools including `query_context`

---

## [2.2.0] — 2026-04-06

### Added
- **Diagnostics & analyze command** — `src/eval/analyzer.js`: per-file breakdown of signature count, token cost, extractor used, and test coverage status.
- **`--analyze` CLI flag** — prints a per-file table (File | Extractor | Sigs | Tokens | Covered) across all srcDirs; respects `exclude` config.
- **`--analyze --json` flag** — outputs the same breakdown as structured JSON (`{ files, totalSigs, totalTokens, slowFiles, fileCount }`).
- **`--analyze --slow` flag** — re-times each extractor and flags any file whose extraction takes >50ms in the table.
- **`--diagnose-extractors` CLI flag** — runs all 21 language extractors against `test/fixtures/` and compares output to `test/expected/`; exits non-zero if any extractor diverges, shows first diff line per failure.
- **`test/integration/analyze.test.js`** — 14 integration tests covering `analyzeFiles`, `formatAnalysisTable`, `formatAnalysisJSON`, and all four CLI flags.

### Validation gate
- 21/21 extractor tests passed
- All integration suites passed (19 suites, 19 passed, 0 failed — includes 14 new analyze tests)
- `node gen-context.js --version` → `2.2.0`
- `node gen-context.js --analyze` runs without error on SigMap repo
- `node gen-context.js --analyze --json` → valid JSON with required keys
- `node gen-context.js --diagnose-extractors` → exits 0 on SigMap repo

---

## [2.1.0] — 2026-04-05

### Added
- **Benchmark & evaluation system** — `src/eval/runner.js` and `src/eval/scorer.js`: zero-dependency retrieval quality measurement pipeline. Computes hit@5, MRR, and precision@5 against a JSONL task file.
- **`benchmarks/` directory structure** — `benchmarks/tasks/retrieval.jsonl` (20 tasks against SigMap's own codebase), `benchmarks/results/` (gitignored run output), `benchmarks/reports/` (human-readable summaries).
- **`--benchmark` CLI flag** — runs retrieval through all tasks in `benchmarks/tasks/retrieval.jsonl`, prints a markdown table (Task | Query | hit@5 | RR | Tokens) plus aggregate metrics; `--benchmark --json` for machine-readable output.
- **`--eval` CLI flag** — alias for `--benchmark`.
- **`src/eval/scorer.js`** — pure metric functions: `hitAtK(ranked, expected, k)`, `reciprocalRank(ranked, expected)`, `precisionAtK(ranked, expected, k)`, `aggregate(results)`. Never throws.
- **`src/eval/runner.js`** — task loader (`loadTasks`), sig-index builder (`buildSigIndex`), keyword ranker (`rank`, `tokenize`), and main `run(tasksFile, cwd)` entry point. Reads generated context file from disk; no in-memory state.
- **`test/integration/benchmark.test.js`** — 10 integration tests covering scorer unit tests, tokenizer, task loading, empty-file edge case, metrics shape, and `--benchmark --json` CLI output.

### Validation gate
- 21/21 extractor tests passed
- All integration suites passed (includes 10 new benchmark tests)
- `node gen-context.js --version` → `2.1.0`
- `node gen-context.js --benchmark` runs without error on SigMap repo
- `node gen-context.js --benchmark --json` → valid JSON with `metrics.hitAt5`, `metrics.mrr`, `tasks` array
- `node gen-context.js --eval --json` → same output as `--benchmark --json`

---

## [2.0.0] — 2026-04-04

### Added
- **v2 output enrichment pipeline** — compact `deps`, `todos`, `changes` sections auto-generated in context output.
- **Structural diff mode** — `--diff <base-ref>` writes a signature-level diff section comparing current signatures against a base branch.
- **Test coverage markers** — opt-in per-function `✓`/`✗` hints by scanning test directories (`testCoverage: true`).
- **Impact radius hints** — opt-in reverse dependency annotations (`impactRadius: true`).
- **New helper extractors**:
  - `src/extractors/deps.js` — Python and TS/JS dependency extraction + reverse dep map.
  - `src/extractors/todos.js` — TODO/FIXME/HACK/XXX harvesting (max 20 entries).
  - `src/extractors/coverage.js` — lightweight function/test correlation.
  - `src/extractors/prdiff.js` — signature-level base-ref diffs.
- **New config keys**: `enrichSignatures`, `depMap`, `schemaFields`, `todos`, `changes`, `changesCommits`, `testCoverage`, `testDirs`, `impactRadius`.
- `test/integration/v2plus.test.js` — 3 integration tests for todos, coverage markers, and structural diff.
- `test/integration/all.js` — unified integration runner and `test:integration:all` npm script.

### Changed
- **Enriched multi-language extractors** — return-type hints (`→ Type`) and richer signatures across C++, C#, Dart, Go, Java, JavaScript, Kotlin, PHP, Python, Ruby, Rust, Scala, Svelte, Swift, TypeScript, and Vue.
- **Python extractor** — dataclass/BaseModel field collapse, top-level docstring hints, fixed field bleed across class boundaries.
- **TypeScript extractor** — interface property types, class method return hints, compact hook return shapes for `export function useX()`, union type truncation extended to 35 chars.
- Removed stale development files: `TIMELINE.md`, `scripts/bundle.js`, `scripts/make-icon.py`, `scripts/inject-search.py`, `scripts/backfill-npm.sh`, `examples/slack-context-bot.js`, `examples/copilot-prompts.code-snippets`.

### Fixed
- Python `tryExtractBaseModelFields` no longer bleeds fields into subsequent classes.
- TypeScript interface member type previews preserve longer union strings (20 → 35 chars).
- TypeScript function-style hooks (`export function useX`) now include compact return object shapes.

### Validation gate
- 21/21 extractor tests passed
- 17/17 integration suites passed (262 individual tests)
- `node gen-context.js --report` → ~93.5% reduction


## [1.5.0] — 2026-04-04

### Added
- **VS Code extension** (`vscode-extension/`) — zero-dependency extension for VS Code / VS Code-compatible editors:
  - **Status bar item** — shows health grade (A/B/C/D) and time since last regeneration; refreshes every 60 s and immediately on file-system change to `copilot-instructions.md`.
  - **`SigMap: Regenerate Context`** command — runs `node gen-context.js` in an integrated terminal from the workspace root.
  - **`SigMap: Open Context File`** command — opens `.github/copilot-instructions.md` in the editor.
  - **Stale context notification** — warns when `copilot-instructions.md` is > 24 h old; offers one-click regeneration or "Don't show again" suppression per workspace.
  - **`contextforge.scriptPath` setting** — override the path to `gen-context.js` when it is not at the project root.
  - `onStartupFinished` activation — loads within 3 s of VS Code opening, does not block startup.
- **Docs site search** — lightweight client-side keyword search added to all 6 HTML docs pages (`index.html`, `quick-start.html`, `strategies.html`, `languages.html`, `roadmap.html`, `repomix.html`):
  - Press `/` anywhere to open the search overlay; `Escape` or click outside to close.
  - Searches all headings, paragraphs, and list items in the current page.
  - Up to 12 results shown with snippet preview; matching text highlighted in amber.
  - Click a result to scroll to the exact section with a 2-second amber outline highlight.
  - Zero external dependencies — ~60 lines of inline JS per page. Theme-aware (dark/light).
- **`.npmignore`** — excludes `test/`, `docs/`, `scripts/`, `examples/`, `.claude/`, `vscode-extension/`, `.github/workflows/` and planning docs from npm publish. Published package contains only the runtime files listed in `package.json#files`.
- **`test/integration/v1.5.test.js`** — 58 integration tests covering all v1.5 features:
  - npm package integrity (name, bin, engines, zero deps, .npmignore exclusions)
  - shebang line presence and correctness
  - extension manifest structure (commands, configuration, activation)
  - extension.js API coverage (status bar, notification, commands, scriptPath)
  - search injection verified in all 6 docs pages (overlay, input, keyboard handlers, highlights)

### Notes
- The VS Code extension requires the `vscode` peer dependency at runtime (provided by the editor). It has no npm runtime dependencies of its own.

### Validation gate
- `node gen-context.js --version` → `1.5.0` ✔  *(note: version bumped separately if desired)*
- `node test/integration/v1.5.test.js` → 58/58 pass ✔
- `node test/run.js` → 21/21 extractor tests pass ✔
- `npm pack --dry-run` → no `test/`, `docs/`, or `vscode-extension/` in artifact ✔
- All 6 docs pages: press `/` → search overlay opens; type "python" → result appears ✔

---

## [1.4.0] — 2026-04-04

### Added
- **`explain_file` MCP tool** — deep-dive tool for a single file. Given a relative path, returns three sections: `## Signatures` (from the indexed context file), `## Imports` (resolved relative dependencies from the live source file), and `## Callers` (reverse import lookup across all indexed files). Gracefully returns partial output if the file is not on disk.
- **`list_modules` MCP tool** — returns a markdown table listing all top-level module directories found in the context file, sorted by token count descending, with columns: `Module | Files | Tokens`. Helps agents pick the right `module` arg for `read_context`.
- **Strategy-aware health scorer** — `src/health/scorer.js` and `--health` display now read `gen-context.config.json` and adjust the low-reduction penalty threshold by strategy:
  - `full` (default): 60% reduction threshold — unchanged behaviour.
  - `hot-cold` / `per-module`: reduction penalty disabled — intentionally small hot outputs are not penalised.
  - `hot-cold` only: adds a `context-cold.md` freshness check (`strategyFreshnessDays`). If the cold context file is >1 day stale, up to 10 pts are deducted.
- **New `--health` output fields** — `strategy:` line always visible; `cold freshness:` line shown for `hot-cold` strategy.
- **`test/integration/mcp-v14.test.js`** — 13 integration tests covering `explain_file` and `list_modules`:
  - 7-tool count verification
  - Signature extraction from index
  - Imports and Callers sections (file on disk)
  - Graceful error for unknown path, missing arg, no context file
  - Token count and table structure in `list_modules`
  - Multi-call session combining both new tools
- **`test/integration/observability.test.js`** — 12 new unit tests for strategy-aware scorer:
  - `strategy` field in all return objects
  - No reduction penalty for `hot-cold` and `per-module`
  - Reduction penalty still applied for `full`
  - `strategyFreshnessDays` null/populated correctly
  - Grade A for a fresh, untracked project

### Fixed
- Health scorer: projects with **zero tracking history** (brand-new or never run with `--track`) are no longer penalised for "0% reduction". `tokenReductionPct` is only set when `totalRuns > 0`.

### Changed
- MCP server now exposes **7 tools** (was 5 before v1.3, 5 in v1.3). `tools/list` assertion updated in `mcp-server.test.js`.
- `gen-context.js` VERSION bumped to `1.4.0`
- MCP server `SERVER_INFO.version` bumped to `1.4.0`
- `package.json` version bumped to `1.4.0`

### Validation gate
- `node gen-context.js --version` → `1.4.0` ✔
- `echo '{"jsonrpc":"2.0","method":"tools/list","id":1}' | node gen-context.js --mcp` → 7 tools ✔
- `node test/integration/mcp-v14.test.js` → 13/13 pass ✔
- `node test/integration/observability.test.js` → 35/35 pass ✔
- `node test/integration/mcp-server.test.js` → 16/16 pass ✔
- `node test/run.js` → 21/21 extractor tests pass ✔

---



### Added
- **`--diff` CLI flag** — generates context only for files changed in the current git working tree (`git diff HEAD --name-only`). Useful in CI and pre-review workflows where you only want signatures for files you've touched.
- **`--diff --staged` variant** — restricts context to files in the git staging area only (`git diff --cached --name-only`). Ideal as a pre-commit check.
- **Smart fallback** — both `--diff` modes automatically fall back to a full `runGenerate` when: outside a git repo, no changed files, or all changed files are outside tracked `srcDirs`. No silent failures.
- **`--diff --report`** — when both flags are used together, prints a side-by-side comparison of diff-mode vs full-mode token counts and savings.
- **`watchDebounce` config key** — new key in `gen-context.config.json` (default: `300`) controls the debounce delay (ms) between file-system events and regeneration in watch mode. Configurable per project.
- **`test/integration/diff.test.js`** — 6 integration tests covering all diff-mode scenarios:
  - Diff-only output excludes unchanged files
  - `--staged` excludes unstaged modifications
  - Empty diff fallback to full generate
  - Non-git-repo fallback
  - Changed files outside srcDirs fallback
  - Multiple changed files all appear in output

### Changed
- Watch mode debounce reduced from **500 ms → 300 ms** (default). Now reads `config.watchDebounce || 300` — fully configurable.
- `gen-context.js` VERSION bumped to `1.3.0`
- MCP server version bumped to `1.3.0`
- `package.json` version bumped to `1.3.0`
- `src/config/defaults.js` — added `watchDebounce: 300` key

### Validation gate
- `node gen-context.js --version` → `1.3.0` ✔
- `node gen-context.js --diff` on a repo with changes → output contains only changed-file sigs ✔
- `node gen-context.js --diff --staged` → output contains only staged-file sigs ✔
- `node test/integration/diff.test.js` → 6/6 pass ✔
- `node test/run.js` → 21/21 extractor tests pass ✔

---

## [1.2.0] — 2026-04-02

### Added
- **`--init` now scaffolds `.contextignore`** alongside `gen-context.config.json`. Running `node gen-context.js --init` on a fresh project creates both files. `.contextignore` is pre-populated with sensible defaults (`node_modules/`, `dist/`, `build/`, `*.generated.*`, etc.). Safe to re-run — existing files are never overwritten.
- **`test/integration/strategy.test.js`** — 9 integration tests covering `per-module` and `hot-cold` strategies:
  - `per-module`: asserts one `context-<module>.md` per `srcDir`, overview file references all modules, cross-module signature isolation
  - `hot-cold`: asserts `context-cold.md` is created, primary output contains only hot files, `hotCommits` config controls the boundary
  - Both strategies: fallback behaviour when `srcDir` is missing or repo has no git history
- **`sigmap` npm binary alias** — `package.json` `bin` now exposes both `gen-context` (existing) and `sigmap` (new alias), making `npx sigmap` work ahead of full npm publish in v1.5
- **`--diff` and `--diff --staged` listed in `--help`** — help text documents the upcoming flags so tooling auto-complete picks them up

### Changed
- `package.json` version bumped to `1.1.0` (syncs with already-shipped v1.1 strategy features)
- `gen-context.js` `VERSION` constant bumped to `1.1.0`
- `src/mcp/server.js` `SERVER_INFO.version` bumped to `1.1.0`
- `--init` no longer exits early when config already exists — it still skips writing config but continues to check / write `.contextignore`
- `keywords` in `package.json` expanded: added `token-reduction`, `code-signatures`

### Validation gate
- `node gen-context.js --version` → `1.1.0` ✔
- `cat package.json | grep version` → `"version": "1.1.0"` ✔
- `node gen-context.js --init` on a fresh dir → both `gen-context.config.json` and `.contextignore` created ✔
- `node test/integration/strategy.test.js` → all 9 tests pass ✔
- `node test/run.js` → 21/21 extractor tests pass ✔

---

## [1.1.0] — 2026-04-01

### Added
- **Context strategies** — new `"strategy"` config key with three options:
  - `"full"` (default) — existing behaviour, single output file, all signatures
  - `"per-module"` — one `.github/context-<module>.md` per top-level `srcDir` plus a
    thin always-injected overview table (~100–300 tokens); ~70% fewer injected tokens
    per question with zero context loss; no MCP required
  - `"hot-cold"` — recently committed files auto-injected as usual; all other files
    written to `.github/context-cold.md` for MCP on-demand retrieval; ~90% fewer
    always-injected tokens; best with Claude Code / Cursor MCP enabled
- **`"hotCommits"`** config key — controls how many recent git commits count as "hot"
  for the `hot-cold` strategy (default: 10)
- **`docs/CONTEXT_STRATEGIES.md`** — comprehensive strategy guide: decision tree,
  four worked-scenario comparisons (fix-a-bug, cross-module question, daily dev,
  onboarding), full configuration reference, migration guide, and feature-compatibility
  matrix
- README: new "Context strategies" section with inline examples linking to full guide
- `gen-context.config.json.example`: `strategy` and `hotCommits` keys with comments

### Changed
- `gen-context.js` version remains `1.0.0`; `runGenerate` now dispatches to
  `runPerModuleStrategy` or `runHotColdStrategy` based on `config.strategy`
- `getRecentlyCommittedFiles(cwd, count)` now accepts a count parameter so
  `hotCommits` is respected
- `--help` text updated with strategy descriptions

### Validation gate
- `strategy: per-module` on arbi-platform: `3 modules, overview ~117 tokens, total ~4,058 tokens`
- `strategy: hot-cold` on arbi-platform: `79 hot files ~3,700 tokens, 1 cold ~363 tokens`
- `strategy: full` unchanged: `80 files, ~3,980 tokens, 94.9% reduction`
- All 21 checks pass post-deployment

---

## [1.0.0] — 2026-04-01

### Added
- **Self-healing CI** — `examples/self-healing-github-action.yml`: weekly cron workflow that queries the GitHub Enterprise Copilot API for acceptance rate; automatically opens a PR with regenerated context when rate drops below threshold (default 30%) or context file is stale (> 7 days); falls back to staleness check when no API token is configured
- **`scripts/ci-update.sh`** — CI helper script: `--fail-over-budget` (exits 1 if output tokens exceed budget), `--track`, `--format cache`; designed for required CI pipeline steps
- **`--suggest-tool "<task>"`** — recommends a model tier (fast / balanced / powerful) from a free-text task description using keyword matching against `src/routing/hints.js` TIERS; `--json` variant returns machine-readable `{ tier, label, models, costHint }` for IDE integrations
- **`--health`** — composite 0-100 health score derived from: context staleness (days since last regeneration), average token reduction %, and over-budget run rate; letter grade A–D; `--json` variant for dashboards and CI
- **`src/health/scorer.js`** — zero-dependency health scoring module: `score(cwd)` reads usage log + context file mtime; never throws
- Integration test: `test/integration/system.test.js` — 15 tests covering suggest-tool (all three tiers, `--json` shape, missing-description guard) and health (`--json` field presence, score range, grade values, run counters)

### Changed
- `gen-context.js` version bumped to `1.0.0`; help text expanded with `--suggest-tool`, `--health`
- `package.json` version bumped to `1.0.0`
- `src/mcp/server.js` version bumped to `1.0.0`
- README updated: v1.0 features section, new CLI reference entries, updated project structure tree

### Validation gate
- 177/177 tests pass (21 extractor + 156 integration)
- `node gen-context.js --suggest-tool "security audit" ` → tier: powerful
- `node gen-context.js --health --json` → `{ score, grade, tokenReductionPct, daysSinceRegen, ... }`
- Self-healing CI workflow validates via `node gen-context.js --health --json` in check job

---

## [0.9.0] — 2026-04-01

### Added
- **Enhanced `--report --json`** — structured JSON report now includes `version`, `timestamp`, `overBudget`, and `budgetLimit` fields alongside existing token stats; exits with code `1` when output exceeds `maxTokens` so CI pipelines can fail automatically
- **`--track` CLI flag** — appends one NDJSON record per run to `.context/usage.ndjson`; also enabled by `"tracking": true` in config
- **`src/tracking/logger.js`** — zero-dependency append-only log module; exports `logRun(entry, cwd)`, `readLog(cwd)`, and `summarize(entries)`; uses NDJSON (one JSON object per line) compatible with standard Unix tools
- **`--report --history`** — prints aggregate summary from `.context/usage.ndjson` (total runs, avg reduction %, avg tokens, over-budget count, first/last run timestamps); add `--json` for machine-readable output
- **`docs/ENTERPRISE_SETUP.md`** — comprehensive enterprise guide: GitHub Enterprise REST API acceptance rate tracking, CI token reporting with Prometheus/Grafana dashboard integration, self-hosted runner configuration, usage log analysis examples
- `tracking: false` default added to `src/config/defaults.js`
- Integration test: `test/integration/observability.test.js` — 23 tests covering `logRun`, `readLog`, `summarize`, CLI `--report --json`, `--track`, config-driven tracking, and `--report --history`

### Changed
- `gen-context.js` version bumped to `0.9.0`
- `package.json` version bumped to `0.9.0`
- `src/mcp/server.js` version bumped to `0.9.0`
- `--report` human output now includes `version` and `budget limit` lines
- README updated: `--track` / `--report --history` in CLI reference, new Observability section, updated project structure tree

### Validation gate
- 162/162 tests pass (21 extractor + 141 integration)
- `node gen-context.js --report --json` outputs JSON with `version`, `timestamp`, `overBudget`
- `node gen-context.js --track` writes `.context/usage.ndjson`
- `node gen-context.js --report --history` prints usage summary
- `node gen-context.js --report --history --json` outputs valid JSON

---

## [0.8.0] — 2026-03-31

### Added
- **`--format cache` CLI flag** — alongside the standard markdown output, writes `.github/copilot-instructions.cache.json`, a single Anthropic content block with `cache_control: { type: "ephemeral" }` ready for direct use in Anthropic API calls
- **`src/format/cache.js`** — zero-dependency formatter; exports `formatCache(content) → JSON string` (single content block) and `formatCachePayload(content, model) → JSON string` (full messages API payload with system array)
- **`format: 'default'` config key** — set `"format": "cache"` in `gen-context.config.json` to always write the cache JSON file on every run; default is `'default'` (markdown only)
- **`docs/REPOMIX_CACHE.md`** — full prompt cache strategy: two-layer design (Repomix as stable cached prefix + SigMap as dynamic segment), cost calculations (~60% reduction), API call examples, CI integration, cache warm-up strategy
- Integration test: `test/integration/cache.test.js` — 20 tests covering `formatCache()`, `formatCachePayload()`, CLI `--format cache` flag, config-driven mode, and absence of cache file when flag is not set

### Changed
- `gen-context.js` version bumped to `0.8.0`
- `package.json` version bumped to `0.8.0`
- README updated: `--format cache` entry in CLI reference, new Prompt Caching section, updated project structure tree

### Validation gate
- 139/139 tests pass (21 extractor + 118 integration)
- `node gen-context.js --format cache` writes `.github/copilot-instructions.cache.json`
- Cache JSON has `type: "text"` and `cache_control: { type: "ephemeral" }`
- `node gen-context.js` without `--format cache` does NOT write cache file

---

## [0.7.0] — 2026-03-31

### Added
- **Model routing hints** — classifies every indexed file into `fast`, `balanced`, or `powerful` tier based on path conventions and signature count, then appends a `## Model routing hints` section to the context output
- **`--routing` CLI flag** — `node gen-context.js --routing` appends routing hints in one pass; set `"routing": true` in config to always include them
- **`src/routing/classifier.js`** — zero-dependency heuristic classifier (path patterns, sig count, indented method count)
- **`src/routing/hints.js`** — tier definitions (`TIERS`) and `formatRoutingSection()` formatter
- **`get_routing` MCP tool** (5th tool) — returns routing hints for the current project on demand; reads context file, classifies files, returns formatted markdown
- **`docs/MODEL_ROUTING.md`** — full routing guide: tier criteria, task-to-tier decision flow, VS Code / Claude Code / CI integration, cost calculation reference
- Integration test: `test/integration/routing.test.js` — 25 tests covering classifier unit tests, classifyAll grouping, formatRoutingSection, CLI flag, config flag, and MCP tool
- `routing: false` default added to `src/config/defaults.js`
- `src/mcp/server.js` version bumped to `0.7.0`

### Changed
- `tools/list` now returns 5 tools (previously 4) — adds `get_routing`

### Validation gate
- 119/119 tests pass (21 extractor + 98 integration)
- `node gen-context.js --routing` produces `## Model routing hints` in output
- `tools/list` returns 5 tools including `get_routing`
- `get_routing` MCP call returns tier classification for current project

---

## [0.6.0] — 2026-03-31

### Added
- **`create_checkpoint` MCP tool** — returns a markdown session snapshot: active branch, last 5 commits, context token count, modules indexed, and route table summary (when `PROJECT_MAP.md` is present)
- **`examples/copilot-prompts.code-snippets`** — 20 VS Code code snippets with `cf-` prefix covering the full session lifecycle (`cf-start`, `cf-checkpoint`, `cf-end`, `cf-pr`, `cf-debug`, `cf-test`, `cf-search`, `cf-map-*`, and more)
- **`examples/slack-context-bot.js`** — zero-dependency Node.js script that posts daily context-freshness reminders to a Slack channel via an Incoming Webhook URL; includes branch, recent commit, token count, and a session checklist
- **`docs/SESSION_DISCIPLINE.md`** — complete session discipline guide: session lifecycle, 30-minute checkpoint cadence, token hygiene table, multi-session workflow, git hook integration, MCP tool reference, and VS Code snippet install instructions
- `src/mcp/server.js` version bumped to `0.6.0`
- Integration tests: 5 new tests for `create_checkpoint` in `test/integration/mcp-server.test.js`

### Changed
- `tools/list` now returns 4 tools (previously 3) — `read_context`, `search_signatures`, `get_map`, `create_checkpoint`

### Validation gate
- 94/94 tests pass (21 extractor + 73 integration)
- `create_checkpoint` MCP tool returns JSON with `# SigMap Checkpoint` header
- `create_checkpoint` with `note` param includes note in output
- `tools/list` returns 4 tools including `create_checkpoint`
- VS Code snippets file has JSON-valid syntax; `cf-` prefix on all 20 snippets

---

## [0.5.0] — 2026-03-31

### Added
- `--monorepo` CLI flag — auto-detects packages under `packages/`, `apps/`, `services/`, `libs/` and writes one `CLAUDE.md` per package
- Manifest detection covers `package.json`, `Cargo.toml`, `go.mod`, `pyproject.toml`, `pom.xml`, `build.gradle`
- `config.monorepo: true` triggers monorepo mode without the CLI flag
- **Git-diff priority output ordering** — recently committed files now appear first in the generated output (not just protected from token-budget drops)
- `examples/github-action.yml` — ready-to-use 4-job CI workflow: SigMap, gen-project-map, Repomix, test suite (Node 18/20/22 matrix)
- `docs/CI_GUIDE.md` — full CI setup guide, monorepo config, `.contextignore` patterns, token report in CI
- Integration test: `test/integration/monorepo.test.js` — 8 tests (packages/, apps/, services/, multi-manifest, 5-package smoke)
- Integration test: `test/integration/contextignore.test.js` — 7 tests (patterns, wildcards, comments, union of both ignore files)

### Validation gate
- 89/89 tests pass (21 extractor + 68 integration)
- `node gen-context.js --monorepo` writes `CLAUDE.md` per detected package
- `node gen-context.js --report` confirms git-diff files appear first in output

---

## [0.4.0] — 2026-03-31

### Added
- `gen-project-map.js` — standalone zero-dependency CLI; generates `PROJECT_MAP.md`
- `src/map/import-graph.js` — static import/require analysis for JS, TS, Python; DFS cycle detection with `⚠` warnings
- `src/map/class-hierarchy.js` — extracts `extends`/`implements` relationships across TypeScript, JavaScript, Python, Java, Kotlin, C#
- `src/map/route-table.js` — HTTP route extraction for Express, Fastify, NestJS, Flask, FastAPI, Go (Gin/stdlib), Spring
- Output: `PROJECT_MAP.md` with `### Import graph`, `### Class hierarchy`, `### Route table` sections (MCP-compatible headers)
- `gen-project-map.js --version` and `--help` flags
- Integration test: `test/integration/project-map.test.js` — 12 tests covering all frameworks, circular detection, MCP section extraction
- `package.json` updated to `v0.4.0`; `gen-project-map` added to `bin`

### Validation gate
- 74/74 tests pass (21 extractor + 53 integration)
- `node gen-project-map.js` writes `PROJECT_MAP.md` with all three sections
- MCP `get_map` tool correctly extracts each section by `### ` header

---

## [0.3.0] — 2026-03-31

### Added
- `src/mcp/server.js` — stdio JSON-RPC 2.0 MCP server (zero npm dependencies); handles `initialize`, `tools/list`, `tools/call`
- `src/mcp/tools.js` — 3 tool definitions: `read_context`, `search_signatures`, `get_map`
- `src/mcp/handlers.js` — tool implementations; reads context files from disk on every call (no in-memory state)
- `--mcp` CLI flag — starts MCP server on stdio
- MCP auto-registration in `.claude/settings.json` and `.cursor/mcp.json` via `--setup`
- `examples/claude-code-settings.json` — pre-configured entry for both SigMap and Repomix MCP servers
- `docs/MCP_SETUP.md` — full MCP setup guide with both Claude Code and Cursor examples
- Integration test: `test/integration/mcp-server.test.js` — 11 tests

### Tools
| Tool | Input | Output |
|------|-------|--------|
| `read_context` | `{ module?: string }` | All signatures or module-scoped subset |
| `search_signatures` | `{ query: string }` | Matching signatures with file paths |
| `get_map` | `{ type: "imports" \| "classes" \| "routes" }` | Section from `PROJECT_MAP.md` |

### Validation gate
- 62/62 tests pass (21 extractor + 41 integration)
- `echo '{"jsonrpc":"2.0","method":"tools/list","id":1}' | node gen-context.js --mcp` returns 3 tools

---

## [0.2.0] — 2026-03-31

### Added
- `src/security/patterns.js` — 10 secret detection patterns (AWS, GCP, GitHub, JWT, DB URLs, SSH, Stripe, Twilio, generic key=value)
- `src/security/scanner.js` — `scan(sigs, filePath) → { safe, redacted }`; never throws; redacts per-file only
- `src/config/loader.js` — reads and deep-merges `gen-context.config.json` with defaults; warns on unknown keys
- `src/config/defaults.js` — all config keys documented with defaults
- Token budget drop order: generated → test → config → least-recently-changed
- Multi-agent output targets: `copilot`, `claude`, `cursor`, `windsurf`
- `CLAUDE.md` append strategy — appends below `## Auto-generated signatures` marker; never overwrites human content above
- `docs/REPOMIX_INTEGRATION.md` — companion tool integration guide
- Integration tests: `secret-scan.test.js` (12), `config-loader.test.js` (6), `token-budget.test.js` (5), `multi-output.test.js` (7)

### Validation gate
- 51/51 tests pass (21 extractor + 30 integration)
- Secret in fixture → `[REDACTED — AWS Access Key detected]` in output
- Output ≤ 6000 tokens on any project over 200 files

---

## [0.1.0] — 2026-03-31

### Added
- `gen-context.js` — single-file zero-dependency CLI entry point
- 21 language extractors: TypeScript, JavaScript, Python, Java, Kotlin, Go, Rust, C#, C/C++, Ruby, PHP, Swift, Dart, Scala, Vue, Svelte, HTML, CSS/SCSS, YAML, Shell, Dockerfile
- CLI flags: `--generate`, `--watch`, `--setup`, `--report`, `--report --json`, `--init`, `--help`, `--version`
- `.contextignore` support (gitignore syntax), also reads `.repomixignore`
- `fs.watch` auto-update with 500ms debounce
- `post-commit` git hook installer via `--setup`
- Token budget enforcement with priority drop order
- `test/run.js` zero-dependency test runner
- 21 fixture files and expected outputs
- `gen-context.config.json.example` and `.contextignore.example`

### Validation gate
- 21/21 extractor tests pass
- Runs on a Node 18 machine with zero npm install
- Output written to `.github/copilot-instructions.md`
