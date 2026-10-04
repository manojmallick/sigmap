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
- [AJambla](https://github.com/AJambla) — Unknown `gain --model` fallback disclosure + `gain --models` listing (#665)
- [Sujal Mallick](https://github.com/sujalmallick) — PowerShell Tier 2 extractor (#840); Objective-C Tier 2 extractor (#841)

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

### Recent Contributors (v8.65.0)
- **@manojmallick** — feat(benchmark): one measured population for the grounding harness, and a labelled good/bad fixture corpus that measures grounding accuracy (#704, #673, #871, PR #872). `benchmark:grounding` compared symbols from a hard-coded source list against an index built from the generator's own roots, so clap printed 0/0 and Kotlin and Go looked broken when the harness was; it now measures the generator's scope, fails on an empty universe and gates each repo on its own floor. A six-language fixture corpus scores `verify` and `judge` for precision and recall per claim kind, offline and deterministically, and records the detectors' current gaps in its floors.

### Recent Contributors (v8.64.0)
- **@manojmallick** — feat(context): cache-stable context layout, a two-block cache payload and a per-model fit-check (#683, PR #868). A provider prompt cache matches on an exact prefix, but the generated context put a per-commit block and a relative age ahead of the whole signature body, so the body could never be a cache hit. Every written file is now a stable body, an invisible marker, then the volatile tail; `--format cache` writes the two as separate blocks with a validated `cacheTtl`; and `--report` reports whether the stable prefix reaches each model's minimum cacheable length, saying "borderline" instead of guessing inside ±15%.

### Recent Contributors (v8.63.0)
- **@manojmallick** — feat(models): one dated, config-overridable model profile behind pricing and routing advice (#688, #778, #865, PR #866). `--suggest-tool` and `gain --model` used two unrelated, undated tables, so a name one printed was rejected by the other. Both now derive from `src/config/models.js`, every output that prints a model or a price prints the profile date, a `models` config namespace overrides any figure per model and per field, and `sigmap doctor` warns once the profile is more than 90 days old.

### Recent Contributors (v8.62.2)
- **@manojmallick** — fix(plan,analyze): `--analyze` reported 5 of this repo's 182 files as tested and `plan` left the file a task names off its change list (#769, #774, #862, PR #863). One coverage index now serves both commands — a file is covered when a test targets its stem or loads it — and every "Likely to change" entry carries its score and the task words it matched. #769 proposed reusing `findRelatedTests` alone; it matches stems, and none of that issue's four examples shares a stem with its test.

### Recent Contributors (v8.62.1)
- **@manojmallick** — fix(scale): a tree past ~125,000 files no longer overflows the stack (#855, PR #860). Five places spread a per-file array as call arguments — the CLI file list, the dependency-graph walk, the ranker, centrality and the `--analyze` table — and each is now a loop. Reproduced and verified on a real 130,000-file tree; the ranker and `--analyze` sites were found only by running other commands there after the reported frame was fixed.
- **@sidhunt** — reported #855 with the repro and the exact stack frame, which is what made the crash a one-step reproduction.

### Recent Contributors (v8.62.0)
- **@sujalmallick** — feat(extractors): Objective-C Tier 2 extractor (#841, PR #852, landed via PR #857). `@interface` / `@implementation` / `@protocol`, categories, `@property` with attributes, instance and class methods with multi-part selectors and balanced block argument types, top-level C functions, `typedef NS_ENUM` / `NS_OPTIONS` — all with `:start-end` anchors. `.m` with no Objective-C markers falls back to the generic extractor (MATLAB), and `.h` stays mapped to `cpp`, which sniffs the markers and delegates.
- **@sujalmallick** — feat(extractors): PowerShell Tier 2 extractor (#840, PR #850). `function` / `filter` / `workflow` with clean parameter names, `[CmdletBinding()]` and `[OutputType]`, `.SYNOPSIS` doc hints, PS5 classes and enums, `Export-ModuleMember`, `.psd1` manifest metadata, and Pester test-file classification. Shipped in the v8.61.3 package; first recorded in this release.
- **@manojmallick** — fix(extractors): the Objective-C extractor was run over 839 real `.m` / `.mm` files before release, and about 11% of its output was not a declaration — 805 fake methods (`- b` from `a - b`) and 335 fake C functions (`return CGRectMake(...)`), plus forward `@protocol` declarations read as containers and method bodies past 4KB losing their end anchor. Members and C functions are now matched only at brace depth 0, with depth that follows `#if` / `#else` branches. Same corpus after: 0 fake signatures, 606 real methods newly found, 97 re-anchored, none lost (PR #857).
- **@manojmallick** — chore(integration): merged the Objective-C branch on top of PowerShell — 12 list conflicts, every one resolved as a union — and moved 15 published-count surfaces to 38 languages / 52 extractors through the drift guards (PR #857).

### Recent Contributors (v8.61.3)
- **@manojmallick** — fix(metrics): the release that shipped the day before is the evidence. v8.61.2 published `test_discovery: { f1: 0.98, hit_at_1: 0.974 }` stamped `sigmap-v8.61-main` and dated 2026-10-02, measured on 2026-10-01 by a run nobody made during that release — `benchmark:test-discovery` was never invoked — and the 98.0% F1 went onto the roadmap Stats line as current. `check:metrics` passed **four times** across that release without objecting, because it verifies `latest.json` against the *saved* reports and never that a saved report belongs to the release being stamped. #707's original instance was worse: a v8.49 snapshot carrying a number measured at **v8.8.0**, 41 minor versions earlier. Three structural causes, all live until now — no single target regenerated the five sources (`benchmark:matrix` makes four; `benchmark:honest` and `benchmark:test-discovery` are separate `--save` scripts no flow invoked, so running four of five looked identical to running all five), four of five reports carried no version at all so a version guard could not even be written, and `latest.json` misdeclared its own sources: the `source` string listed four reports while the generator read five, so the one field whose job was provenance had the wrong provenance. `scripts/lib/report-stamp.mjs` is now the single provenance shape and `sources` is derived from what the run actually read. The guard is scoped to the **minor** line, not the patch: `benchmark_id` is `sigmap-v8.61-main`, so a report measured at 8.61.0 legitimately belongs to the v8.61 snapshot and a patch must not be forced to re-run every suite — a different minor line is the defect. Within-line differences are not failures, so they are made **visible** instead, each source publishing the version and date it was measured on. `classifySources` splits the two modes because they are not the same: `drifted` names the wrong release and hard-fails (this is #707), while `unstamped` predates stamping so provenance is genuinely unknown and is published as `version: null` with a warning — hard-failing that second case broke `check:metrics` against the committed reports and so CI and `prepublishOnly`, and the only escapes were a flag day requiring every suite to re-run first or hand-writing versions into legacy reports, fabricating the exact fact being recorded. The second half (#811) reworded "95.8% token reduction" in the generator rather than in prose, because a prose-only fix is reverted by the next `sync-metrics`: it measures the map against every source file in the repository, which is a map-size measurement, not a per-call cost saving. Two bugs were found by testing the change itself — `stamp()` set `generated` only when absent so a rewritten report kept its old date, and computing the snapshot once (to stop a duplicated warning) dropped the `try/catch` that made a missing `latest.json` report "stale" instead of crashing with `ENOENT`. No published metric moved; `benchmark_date` advancing to 2026-10-03 moved 12 snapshot-date labels across six `docs-vp` pages that no guard checks (#854, #707, #811, PR #856)

### Recent Contributors (v8.61.2)
- **@manojmallick** — fix(cli): one defect class at four surfaces — a canonical fact kept in a hand-maintained second copy, with nothing failing when the copies diverged. The sharpest instance was a release gate: `--ci` computed `index.size / fileList.length`, which is not a ratio, because the persisted index deliberately holds more than the current config scopes (declared entrypoints, test roots, CI definitions, files a `srcDirs` change dropped) — so it reported **241% coverage** in this repo and a gate set to `--min-coverage 200` would have passed. `validate` had the identical formula and reported 218%; #770 fixed it **there**, and the comment it left behind explaining why the old form "stopped meaning anything" sat three screens above a surface still using it. `validate` also kept its own `Math.round((covered / total) * 100) : 0`, agreeing with the shared primitive on every populated repo and reading 0% where the other three read 100% on an empty one. `coveragePct` and `indexedCoverage` are now the only definitions, the second an intersection that cannot exceed 100% by construction. The same class at the CLI surface: `--help` was a 113-line template literal maintained beside the `KNOWN_COMMANDS` set the guard dispatches on, under a comment already asserting it "renders from the same vocabulary" — writing it out as a table found four live drifts (a description one column off, visible in `llms.txt`; a literal `%%` from a `printf` escape a template literal never needed; an adapter list a release behind `packages/adapters/`; and `--ci` itself dispatchable and documented but absent from `--help`). v8.61.1 had judged this half "a rewrite of a literal that is currently correct" — it was not. The guards are structural rather than numeric, because a numeric check passes whenever today's two copies happen to agree (#848, #817, #818, PR #849)
- **@manojmallick** — fix(retrieval): adding one module and no ranker code failed `validate:retrieval`, and the gate was right that something moved and wrong about what. `GRAPH_BOOST_AMOUNTS.hop1` (0.40) is added once per importing seed, so a shared utility with 23 scoring importers collected 23 × 0.40 = **9.2** and ranked 3rd for a query it shares no token with — `bm25 0`, every match signal `0` — displacing the correct answer, whose own score had not changed at all. What normally hid that is `_computeHubs`, suppressing any file with `>= ceil(fileCount * 0.2)` importers: the utility has **exactly 36**, so it was suppressed at 180 graph nodes and not at 181, leaving a 9.2-point phantom gated on a `Math.ceil` step any single added file can cross. The fix had to keep a designed behaviour — lifting a zero-score **direct neighbour** of a match is how a file that implements what a matching file calls gets found, pinned by `ranker-order-invariance.test.js` (#596) — so two blunter variants were measured and rejected and are recorded in the test to stop them being re-attempted: refusing non-matches outright fails two tests there plus the A12 uppercase-path case, and capping everyone at one bonus flattens accumulation for files that legitimately match, costing a real rank-5 answer its place. The rule that holds: one free bonus, accumulation gated on a real match. measured with the condition toggled on the release tree, it recovers `mined` hit@5 56.5% → 60.9% (MRR 0.380 → 0.389) and lifts `jvm` MRR 0.192 → 0.195, with `easy` unchanged and `hard` MRR −0.002 — returning every gated corpus to its v8.61.1 value rather than beating it (#851, PR #849)

### Recent Contributors (v8.61.1)
- **@manojmallick** — fix(ask): `cli.md` had described `ask --json` since before v8.54.2 as "a machine-readable object with `intent`, `coverage`, `cost`, `riskLevel`, and `rankedFiles`", and two of those five keys were fiction. `rankedFiles` was **never implemented** — no surface emits that name, the closest being `--query --json`, which calls its array `results` — and there is no `cost` key either, the figure shipping as `costBefore`/`costAfter`/`savingsPct` because a saving needs both sides of the comparison to mean anything. A consumer written against the documented contract got `undefined` twice, and it left `ask` as the one command whose ranked selection could not be read back from its own JSON: `selectedFiles` is a count, `contextPath` is a file to re-parse, so getting the files and their scores meant a second query against the index just ranked. `rankedFiles` now ships as `[{ rank, file, score, tokens }]` in rank order, minus `sigs` (already in the context file the same run wrote), with scores rounded exactly as `cutoffScore` is so the last row's score **is** the cutoff rather than a near-miss differing in the fourth decimal. The wider gap was that nothing pinned output keys at all: #661 guarded commands in `--help` and #817 asks for flags, but a documented-but-absent key could survive releases — and v8.61.0 had just added fourteen keys to this exact surface. The new guard reads the documented list **out of `cli.md`** rather than restating it, since a hand-kept copy would be a third place to drift, and covers `ask`, `--callers` and `judge`; a negative case proves it fails rather than passing quietly, and six of its eleven tests fail against the pre-fix binary. The other two contracts were checked and found exact (#845, #662, PR #846)

### Recent Contributors (v8.61.0)
- **@manojmallick** — feat(ask): three defects on **one surface** — `ask`, the command the product is used through — fixed together. `ask` emitted signatures only, so an agent that then needed a body opened the **whole file**: the exact cost the map exists to avoid, handed back one level down. `--with-source` slices the top symbols' lines from the `:start-end` anchors every extractor already emits and attaches the blast radius, breadth first (three per file, files in rank order) so one long member list cannot eat the budget; bodies are secret-scanned with the same redactor `get_lines` uses, an export list never takes a slot because it is already in the signature section verbatim, and a body that does not fit is skipped **whole** with the omission disclosed — half a function is not a cheaper answer. It is strictly opt-in and the default context is prefix-identical, asserted by a test. Separately, `judge` has warned since v8.54.2 when the context is older than the sources it describes while `ask` and the MCP read tools answered from the same ground in **silence**, so a stale answer was byte-indistinguishable from a fresh one; all three now share one definition of "stale" via `STALE_TAILS`, with only the consequence clause varying by surface and `judge`'s own line byte-identical to what #780 shipped. Finally, on a fresh `gin` clone `ask` printed `Coverage : 100%` and `Risk : NONE` over a selection holding a test, a README and a CI workflow — neither reading a lie alone (the coverage figure is fed every file the scan found, so it reports how much of `srcDirs` is **readable**; the risk figure counts changed files, zero on a clean checkout) but together, under the answer, they read as "this is trustworthy". Each figure now names what it counted, `Risk` reads `not assessed` when the probe could not run, a new `Selection` line names what neither figure ever asked, and `--json` carries every basis while keeping every pre-existing key (#835, #814, #815, #806, PR #836)

### Recent Contributors (v8.60.0)
- **@manojmallick** — fix(scope): two commands reported a narrower scope than they claimed, and neither said so. `--diff <ref>` ran `git diff <ref>..HEAD` — ref-vs-HEAD, which **excludes the working tree** — while the flag is documented as "changes since `<ref>`", so a developer with local edits got a diff that omitted exactly the files they were editing; on a fixture with one committed and one uncommitted change it reported one file. The same wrong range existed **twice**, in the CLI and in the `get_diff_context` MCP tool, so the two surfaces could disagree about what "since `<ref>`" means — `src/util/git.js` `changedFiles()` now owns all three ranges and both call it, and the tool description no longer advertises `base..HEAD`. Separately `--callers` printed `zero method blast radius` for symbols that are demonstrably called: the graph walks `srcDirs` only, so the CLI entry point — the largest caller of every `src/` module — contributes no edges, and `requireSourceOrBundled('./src/…')` is a dynamic load the resolver cannot follow. It could not distinguish "no caller exists" from "no edge was found", which is precisely the claim a developer leans on before changing a signature. Every result now names the scope searched and counts what it could not follow, in the human output and in `--json`. Bare `--diff` and `--diff --staged` are byte-identical, asserted by a regression test that passes on both sides (#831, #667, #768, PR #832)

### Recent Contributors (v8.59.0)
- **@manojmallick** — fix(dashboard): two defects in the same command. `--dashboard` wrote into `benchmarks/reports/`, a directory SigMap does not own — in a consumer repo it either does not exist, so SigMap created it, or it means something else entirely, and either way the file landed outside the `.context/` line `--init` gitignores; it now writes `.context/dashboard.html`, with `--out <path>` for an explicit destination. Separately the coverage panel graded against a hardcoded 21-entry `LANGUAGE_KEYS` while the project ships 36 languages, so a repo written in Elixir, Lua, R or Terraform read as uncovered. The denominator was only half of it: `detectLanguage` in the same file was a **second** extension map covering the same 21, so the numerator could never reach a widened denominator — raising `supported` 21 → 36 alone would have moved this repo from 2/21 to 2/36, making the published figure worse rather than better. Both sides now come from `src/extractors/dispatch.js`, whose new exported `LANGUAGES` reproduces `deriveLanguages()` byte-identically — the list `version.json` publishes and `check-doc-counts` gates. A third copy fell out with it: the chart's 21 positional label abbreviations, replaced by the languages actually present. Five of the 11 tests are structural, tying the denominator to both `dispatch.LANGUAGES` and `version.json.languages` (#828, #782, #663, PR #829)

### Recent Contributors (v8.58.0)
- **@manojmallick** — fix(index): `validate`, `doctor` and `status` each held a private definition of what the signature index contains and when it was last built, so on a **healthy** index all three contradicted each other — 266 stale entries, 447 files indexed and up to date, and never indexed at all. `generate` writes the index over an **augmented** population: the `srcDirs` walk widened by the declared package entrypoints, every test root and every CI definition, all three deliberate because they are how `sigmap ask` reaches code that lives outside `srcDirs` by construction. `validate` measured it against the **un-widened** list, so every widened entry read as stale — the 266 decomposed exactly into 256 under `test/` and 10 under `.github/`, none of them stale, and the advised re-run could not change the number. Two real bugs hid behind that false alarm and both are fixed: the sig-cache was written back whole and never pruned, so a genuinely **deleted** file did survive the full run `validate` prescribed, and `status` read only the usage log — which exists only under `--track` — so with tracking off, the default, it reported `never` about the index `doctor` was calling up to date. `src/analysis/index-state.js` now owns both definitions, exporting the collector roots `generate` itself imports so the collector and the classifier cannot drift. Index size does not move: this is a population widening, not a prune. Four of the 14 new tests are structural, pinning the single definition rather than a number (#825, #770, #664, PR #826)

### Recent Contributors (v8.57.0)
- **@manojmallick** — fix(create): two defects in the same four-stage `create` pipeline, which together meant the grounded-creation loop could neither fail honestly nor succeed at the thing it exists for. `create` exited **0** having run none of its four guard stages, because `ok` was `failed === 0` — vacuously true over an empty set — so a CI step that shelled out to it read success from a run that verified nothing; it now exits `2`, the "nothing to do" code matching `judge`'s inconclusive verdict rather than overloading `1`, which still means a stage ran and failed, and prints the input each stage needed so the exit is actionable. Separately, stage 2 flagged every symbol the plan intended to **create** as unknown, so `create "add a helper to format dates"` → plan names `formatDate` → stage 2 errored on code that by construction does not exist yet, leaving the pipeline's primary use case unreachable pre-implementation. A plan has two kinds of name in it, and checking them identically is the bug: a `Creates:` section marks introductions, verified in **reverse** — they must not exist — which unblocks the happy path and adds a redefinition guard that did not previously exist. Three ways in, one semantic: the plan's own section, `--creates` for plans carrying none, and inside `create` the scaffold stage's proposed filenames handed to stage 2 automatically, so stage 2 stops rejecting the file stage 1 just designed. With neither section nor flag, every name is a reference and standalone `verify-plan` is as strict as before — asserted by a test running the same plan both ways (#767, #666, PR #823)

### Recent Contributors (v8.56.0)
- **@manojmallick** — fix(discovery): two defects of the same class — SigMap's model of the project's shape was wrong, and nothing said so. The repo root was never a candidate source root, because candidate enumeration only ever walked directories; on a flat layout (the normal shape of a Go module) `.` could not be selected however much source sat there, so a fresh `gin` clone indexed `testdata` and left `gin.go`, `routergroup.go`, `context.go` and `tree.go` invisible. Two structural signals now qualify the root — a `go.mod` with root-level `.go` files, which is the toolchain's own model of a module, and a generic 20%-of-tree share — selecting exactly the four Go modules across 43 cached benchmark repos and changing nothing else. The miss is also disclosed now: a coverage figure computed over `srcDirs` cannot see a file the detector never selected, so `validate` and `doctor` report implementation files outside `srcDirs`, graded on share rather than raw count so a correct configuration does not warn. Separately, three monorepo detectors disagreed about the same repo — the marker-based pair said *no* while `--monorepo` processed two packages — and one detector now answers it and names whether the evidence is a declared workspace or the layout (#805, #781, PR #821)

### Recent Contributors (v8.55.0)
- **@manojmallick** — fix(ranker): three retrieval defects shared one cause — the ranker kept its own, strictly weaker copy of the file-category predicates the token-budget drop order already had right. It matched only `foo.test.js` and a `test/` segment, so `routes_test.go`, `test_foo.py`, `foo_test.rs` and `FooTest.java` were never penalised, a root `README.md` matched no docs directory, and CI files had no category — putting two test files and a README above `routergroup.go` on the gin routing question. `src/util/file-class.js` is now the single source of truth for both subsystems. Zero-score rows are no longer numbered as results, path matches are scaled by the token's IDF so a repo-name token stops lifting files on path alone, and `symbolMatch` now outweighs `pathMatch` so defining a thing beats mentioning it. New `ask --explain` / `--query --explain` renders per-token corpus coverage, every contributing signal per file with the reason a file was demoted, and the near misses below the cutoff — which is how the fourth bug was found: the stemmer over-stripped `users` to `us`, tripped its own minimum-length guard and reverted to the raw input, so `users` and `user` never unified and `ask "where do users log in"` matched nothing (#807, #808, #813, PR #819)

### Recent Contributors (v8.54.2)
- **@manojmallick** — fix(input): three commands took input from the user and silently discarded it. `ask --top <n>` was documented in `--help` and parsed by two other commands while `ask` hardcoded 5, so `--top 2` and `--top 20` differed only by a timestamp. A pinned `maxTokens` was replaced by auto-scaling with the explanation printed only under `--report` — and that notice was wrong the other way too, announcing SigMap's own 6000 default as "your config" when nothing was pinned, because `loadConfig` tracked no provenance. And `sigmap note` wrote to a store nothing in the retrieval path ever read, so a note naming a file could not influence a query about that file. Notes now boost what they name and render into the emitted context, relevance-gated and inert when absent (#801, #775, #783, #776, PR #802)

### Recent Contributors (v8.54.1)
- **@manojmallick** — fix(guard): the two guard commands were wrong in opposite directions. `redact` let five of seven credential shapes through — the cause was one character, `sk_live_` (underscore) covered while `sk-` (hyphen, OpenAI/Anthropic) was not — and `verify` reported `structuredClone()` as fabricated at high confidence, then suggested `structuralFixture()` from a test file as the replacement. Globals became grouped data, the suggestion pool lost its test/fixture/declarative sources and gained a similarity floor, and `explain` stopped reporting a missing file as `EXCLUDED — no extractable signatures` at exit 0. `explain` also gained the test file whose absence let that ship (#798, #771, #777, #772, #785, PR #799)

### Recent Contributors (v8.54.0)
- **@manojmallick** — feat(judge): `judge` was the last grounding surface whose verdict rested on raw English word-overlap. It now shares the ranker's tokenizer, so `buildEvidencePack` and `build evidence pack` no longer score 0.750 vs 0.333, and ordinary prose can neither inflate nor dilute a grounded answer — the reported case goes 0.212/fail to 0.643/pass with every claim still grounded. Hedging phrases became warnings instead of a verdict, "nothing to judge" got its own `inconclusive` verdict and exit code instead of being filed as a genuine failure, and `judge` learned to read stdin, default its own `--context`, warn on stale context, and print the per-claim table it previously hid in `--json` (#795, #779, #765, #766, #780, PR #796)

### Recent Contributors (v8.53.0)
- **@manojmallick** — feat(usage): four commands published a token-reduction figure and no two were comparable, because `tracking` defaults to false so the store `--health`, `history` and the dashboard read is never written, while `recordUsage` writes a different one unconditionally. One read path now normalises both, and every figure names its population — 524 generate runs is not 2,047 operations is not a session window (#773, PR #793)

### Recent Contributors (v8.52.2)
- **@manojmallick** — fix(ci): v8.52.1 published to npm but shipped no binaries — the binary smoke test asserted `bench --submit` exits 0 in a directory with no benchmark history, which #764 deliberately changed to exit 1. It was the fourth place depending on that contract and the only one PR CI cannot see, because `release-binaries.yml` triggers on tag push rather than on pull requests (PR #791)

### Recent Contributors (v8.52.1)
- **@manojmallick** — fix(claims): the only two commands whose output exists to be republished both printed numbers measured nowhere — `share` appended a literal "6× better results" against a published 2.12× and emitted hardcoded 97/88 as the user's own figures on an unbenchmarked repo, and `bench --submit` rendered a missing hit@5 as "0%" in a block meant for a public Discussion. Every number is now traceable or explicitly absent (#763, #764, PR #789)

### Recent Contributors (v8.52.0)
- **@manojmallick** — feat(coverage): four commands printed a coverage percentage for one repo and no two agreed, because each measured a different population through the same primitive and none said which. Three named populations — in-context, indexed, readable — now carry every figure with its numerator and denominator. `doctor` was a real defect rather than a labelling gap: it fed the retrieval index to `coverageScore` and printed "of source files in context", claiming 100% while the run that built that context reported 54% (#762, PR #787)

### Recent Contributors (v8.51.10)
- **@manojmallick** — fix(compare): the command whose job is "SigMap vs a baseline" scored against random selection and reported a 4.9x lift while the project publishes 2.12x over a grep agent — and printed a token baseline derived from an assumed 4,000 tokens per file, never measured. Both now come from the published sources, and a test pins the pair to `latest.json` so command and project cannot drift apart (#760, PR #761)
- **@manojmallick** — chore: closed the v8.48 CLI audit backlog (#656, #657, #658, #660, #661) by re-verifying each individually rather than bulk-closing, with the evidence recorded on every issue

### Recent Contributors (v8.51.9)
- **@manojmallick** — fix(compare): `sigmap compare` failed for every user and made them wait ~90s first — the `--compare` payload was emitted after the terminal table, so the consumer's strict `JSON.parse` of the whole stdout died on the leading box rule. Both halves were correct; only their order was wrong. Found by smoke-testing the entire CLI surface, 93 of 97 commands green, this the only genuine defect (#757, PR #758)

### Recent Contributors (v8.51.8)
- **@manojmallick** — fix(context): two of four strategies never told the agent SigMap exists — per-module hand-built its overview without the commands block, and hot-cold dropped it whenever nothing had changed recently, which is the worst moment to lose it. The always-on file is the only one an IDE injects, so agents in those repos never learned the CLI was there. The block is also directive now rather than a passive table, and names `lines`, `--impact`/`--callers`, `verify` and `explain` (#754, PR #755)
- **@manojmallick** — fix(budget): `maxTokens` was not honoured as a total — the fixed preamble was never budgeted, so a hardcoded reserve describing a "~150-token" block that had grown to 224 pushed a 500-token run to 554. The reserve is now measured from the block itself, with a guard that compares it against the preamble actually emitted; both breaches were invisible locally and caught only by CI (PR #755)

### Recent Contributors (v8.51.7)
- **@manojmallick** — fix(deps): manifests were discovered at the repo root only, so a multi-module Maven build — the normal shape for Java — reported every declared dependency as invisible; plus three pom.xml parsing defects, where `<parent>` shadowed the project's own identity in every Spring Boot POM, `<dependencyManagement>` constraints were counted as real dependencies and leaked into `sigmap sbom`, and Maven scope collapsed so a `provided` compile-time dependency looked shipped (#747, PR #748)
- **@manojmallick** — fix(deps): only npm projects described the packages they use — the installed-versions section can only resolve `node_modules` and `site-packages`, so a new `## dependencies (declared — <ecosystems>)` section carries manifest-declared pins for every ecosystem; the import map also dropped all bare specifiers (showing internal wiring but never the libraries), had no JVM mapping at all, and never dispatched `extractLuaDeps`, dead since it was written (PR #749)
- **@manojmallick** — fix(extractors): nested types were under-reported or misattributed in Java, Swift and C# — three different root causes, with Swift attributing a nested type's methods to the enclosing type while never reporting the type itself. akka gained 42% more signatures, and the committed C# expectation had recorded an interface with no members while the fixture declares two: the fifth committed expectation found this cycle asserting a bug was correct (#741, PR #750)
- **@manojmallick** — ci: prepared releases are now tagged automatically on merge to `main`, after v8.51.5 and v8.51.6 both sat untagged with npm behind what `main` claimed; and CI no longer skips stacked pull requests, which previously matched no workflow and so could never satisfy their required checks (#751, PR #752)

### Recent Contributors (v8.51.6)
- **@manojmallick** — fix(extractors): nine extractors truncated, corrupted or dropped declarations at the first `)`; Swift rendered a structurally malformed signature, C++ dropped declarations outright (becoming `fake-symbol` false positives in `verify`), and Kotlin invented a parameter that did not exist. All now resolve parameters with the shared balanced scanner, and the adversarial defect ledger is empty for all twelve corpus languages (#695, #696, PRs #739, #740, #742)
- **@manojmallick** — fix(kotlin,scala): a body-less `data class`/`case class` swallowed the next type's body, reporting it with the wrong members while the real type vanished — hiding more than half the types on akka, okhttp and kotlinx-coroutines, and live on both committed fixtures (#738, PRs #739, #740)
- **@manojmallick** — fix(budget): the token budget spent itself strictly best-first across a repo, so one module could take all of it — on akka `akka-stream` kept all 128 surviving slots while `akka-actor` and `akka-cluster` got zero, rendering two of three configured source dirs invisible. A bounded per-module floor means a module can be thinned but never erased, which returned hit@5 to 78.6% while keeping the extractor work (#743, PR #745)

### Recent Contributors (v8.51.5)
- **[@AJambla](https://github.com/AJambla)** — fix(gain): `gain --model <typo>` mapped any unknown key to `claude-sonnet` and printed the dollar figures with no notice, so a typo read as a valid quote; the substitution is now disclosed on stderr and `gain --models` lists the known keys and rates, with exit code and dashboard output unchanged (#665, PR #734)
- **@manojmallick** — test(extractors): adversarial fixture corpus + defect ledger — `--diagnose-extractors` reported 36/36 green while ten languages corrupt, truncate or drop declarations, and the committed Ruby expectation had ratified a duplicated signature; the ledger now fails in both directions, so a fix forces the entry out (#702, #735, PR #736)
- **@manojmallick** — docs: every published language/extractor/MCP-tool count is classified and gated against `version.json`, closing a page that said 31 in its SEO meta and 36 in its body; the README's universal line-anchor claim is scoped to the tiers that actually anchor (#697, #698, PR #733)

### Recent Contributors (v8.51.4)
- **@manojmallick** — fix(benchmarks): the quality benchmark counted signatures with a keyword-prefix allowlist, so every language whose signature starts with the identifier read as zero — ggplot2 reported 1 grounded symbol against 964 real ones and published "0% grounding" for R. Counting is now structural (fenced blocks), the impossible 114% is clamped and flagged as a failed estimate rather than printed, and a zero-with-content row fails the suite instead of reaching the public page (#694, PR #731)

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
