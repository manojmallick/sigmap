# Import-resolver accuracy protocol

How the import graph's file-to-file edges (`buildFromCwd`, the data behind `--impact`, `get_impact`, the blast radius in `plan` and `doctor`) are scored against what a language's own tooling reports (#980). The scorer is `scripts/run-import-accuracy.mjs`; the machine-readable half of this document is `benchmarks/import-resolver-protocol.json`.

**This file and the JSON were committed on 2026-10-26, before the scorer was run on any evaluation repository named in section 6.** The scorer records the protocol's sha256 in its report and refuses to save a report when the file differs from the committed copy. A change after the first registered run is a deviation: it goes in section 9 with its date and reason. Nothing here is edited to make a result look better.

## 1. What is compared

- **System under test:** `buildFromCwd(tree)` with every family and no configuration, on a copy of a pinned commit. Its edges go from an importing file to the repository file the import resolves to; an import that resolves to no single file yields none.
- **Reference:** for each language, the edges its own tooling reports about the same files (section 2). Never the resolver, and never a second implementation of its rules: where no such tooling could be run here, the language is listed as **unmeasured** with the reason, not given a number from a weaker oracle.
- **Called "compiler-derived" where a compiler produced it**, and never "ground truth": a reference reports the configuration it ran, and an import that depends on another configuration is not in it.

## 2. The references

| Group | Reference |
|---|---|
| C / C++ / Objective-C | `clang -E -H -fshow-skipped-includes`: the headers the compiler opened, one per line with a dot per level of nesting; the lines with one dot are the file's **direct** includes. Run for the host (macOS), for `x86_64-unknown-linux-gnu` and for `x86_64-pc-windows-msvc` (no system headers), and unioned, so an include behind `_WIN32` or `__linux__` is seen. Include directories: the tree, its `include/` and its `src/`. A header the compiler needs and the repository lacks (a system header on a foreign target, a third-party header) is an error the preprocessor reports and carries on past, so it is not an edge and the includes after it are still listed. |
| Vue, Svelte, Astro | The script found by the framework's own parser (`@vue/compiler-sfc`, `svelte/compiler`, `@astrojs/compiler`); its specifiers listed by TypeScript's own scanner (`ts.preProcessFile`); each resolved by TypeScript's own `ts.resolveModuleName` with the repository's `tsconfig.json` and the bundler resolution rules. A host shim lets TypeScript resolve `./X.vue` to the component file. |
| PHP | PHP's own tokenizer (`token_get_all`) for the top-level `use` statements, and Composer's own autoloader (`composer dump-autoload --classmap-authoritative` in a scratch copy, then `ClassLoader::findFile`) for the file that defines each class. Dependencies are not installed. |
| Swift (module level) | `swiftc -emit-imported-modules` for the modules a file imports, and `swift package describe --type json` for the targets of the package and the files each owns. A reference edge is a file importing a local target other than its own. |

Tool versions are pinned in the JSON and printed in the report. The PHP archive and the Composer phar are checked against a sha256 (Composer's is the one it publishes; the static PHP archive publishes none, so the hash is of the archive used).

## 3. The universe, and the metrics

U is the importing files the graph walked **and** the reference could analyse; an edge counts only when its importing file is in U, on either side. (An edge whose importing file the reference could not analyse is not scored, and the number of them is reported.) The graph's walk is the zero-config one a user gets, so a file in a directory it does not walk is outside U, and that is reported too (section 5).

`precision = |graph ∩ reference| / |graph|` and `recall = |graph ∩ reference| / |reference|` over edges with an importing file in U; F1 is their harmonic mean. Figures are micro-averaged over the evaluation repositories of a group. Intervals are the cluster bootstrap of the call-graph benchmark (#976): 2000 resamples of importing files, seed 980, 95%. A cell with fewer than 100 edges is printed and marked `n<100`, and is never quoted as a headline.

## 4. Predictions made before the run

1. **P1.** C/C++ recall is at least 90%.
2. **P2.** C/C++ precision is at least 80% (an include behind a switch none of the three configurations enable is one the graph counts and the reference does not).
3. **P3.** Component precision is at least 95%.
4. **P4.** Component recall is at least 90%.
5. **P5.** PHP precision is at least 95%.
6. **P6.** PHP recall is at least 85%.
7. **P7.** Swift module-level precision is at least 99%.
8. **P8.** Swift module-level recall is at least 99%.

All are guesses from reading the resolvers. Where one is wrong the report says so.

## 5. What this does and does not say

- It says how often the graph's edges agree with what the language's tooling resolves, for the groups and repositories of section 6, over the files the graph walks.
- **C#, Dart, Lua and GDScript are unmeasured.** A C# or Dart reference is a compiler front end (Roslyn, the Dart analyzer) that needs an SDK, a restore and a build of the repository, which is not installed here; Lua resolves a module by searching a path the project sets at run time, and GDScript is resolved by the engine, so there is no tool to ask. Their resolvers are covered by fixtures with known answers (`test/integration/import-resolvers.test.js`), not by a number.
- **Implicit dependencies are not imports.** A C# or PHP file that uses a type of its own namespace needs no `using`, and a Java-style same-package class needs no import. The graph draws edges for imports only, so it is not a measure of every file a file depends on; the references above report imports too.
- **Swift edges are module level.** A reference edge is (file, local target); the graph's `--impact` reports the same relation. Neither says which file of the target a file uses.
- **PHP precision is a lower bound.** The reference reads `use` statements. The graph also draws an edge for a `require` or `include` of a literal path (`require __DIR__ . '/functions.php'`), which the reference does not read, so such an edge counts as one the reference lacks.
- **Component recall is bounded by the shared JavaScript/TypeScript resolver.** A component's script goes through the same specifier resolution as a `.js` or `.ts` file, with two known gaps: an extension-less specifier that TypeScript resolves to a `.d.ts` file is not found, and a specifier written `./x.js` that names an `x.ts` (the NodeNext convention) is not mapped to it. An import list that spans several lines in a plain `.js` or `.ts` file is not read (the resolver's matcher is line-based), and this is **not changed here** because the ranker's graph is built from the same resolver and a better blast radius must not move retrieval (#934). A component's script is read with a matcher that does take a list across lines, so a component figure is not a JavaScript or TypeScript figure.
- The ranker is handed only the original eight families (#934). These figures are about the blast-radius surfaces, not about retrieval.
- Objective-C is covered by the same resolver and the same reference, but no evaluation repository here is Objective-C, so it is not measured.
- A change to what the graph walks (the source roots it detects) changes U and so every figure; the zero-config walk is the one measured.

## 6. Repositories

| Group | Evaluation repositories (full commits in the JSON) | Used to develop the adapter, not measured |
|---|---|---|
| C / C++ | libuv, abseil-cpp | spdlog, small fixtures |
| Vue / Svelte / Astro | vue-core, svelte, astro | vitepress |
| PHP | laravel, composer | guzzle |
| Swift | alamofire, vapor | fixtures |

**No substitution.** A repository whose reference cannot run is reported unmeasured with the reason; it is not replaced.

**What was looked at before this was registered.** To build the resolvers the graph was built on laravel (the `Str.php` importers the issue names, checked against `grep`: the same 164 files), composer, guzzle, newtonsoft-json, serilog, dio, riverpod, spdlog, libuv, fmt, abseil-cpp and alamofire, to read edge counts and a few importers by eye. No reference was run on any of them, and no figure of this protocol existed. The one rule changed after that reading, for the reason in the resolver's header, is that an angle-bracket include is no longer searched next to the including file.

**Development runs of the references, none of them an evaluation repository.** Each adapter was run on a repository outside section 6's evaluation set (spdlog for C, vitepress for components, guzzle for PHP) and on a small Swift package written for the tests, to see that it ran and to read the disagreements. Three things changed because of what they showed, all in the references or in the new component reader, none in a resolver rule tuned to a figure (the first of the changes below, on a Swift package; the others on vitepress): the Swift reference reads `main.swift` as the program's entry point (the compiler rejects its top-level code as a library file, which had dropped every `main.swift` from the universe); the component reference no longer discards a `.d.ts` target (a first-party declaration file reached through a `tsconfig` `paths` alias is a real import); and a component's script is read with a matcher that takes an import list across lines (see section 5). A fourth change removed code instead: the first version of the C reference stubbed a missing header and ran the file again, and a mutation test showed the step never changed a result, because the compiler reports the missing header and carries on.

## 7. Reproducing a run

```
node scripts/fetch-xrepo-repos.mjs --only libuv,abseil-cpp,vue-core,svelte,astro,laravel,composer,alamofire,vapor
node scripts/run-import-accuracy.mjs --setup-references <dir>      # installs the pinned npm tools, PHP and Composer into <dir>
node scripts/run-import-accuracy.mjs --references <dir>            # prints the tables
node scripts/run-import-accuracy.mjs --references <dir> --save     # also writes benchmarks/reports/import-accuracy.json
```

Each repository is exported at its pinned commit (`git archive`; the tracked files present on disk for a sparse checkout) into a scratch directory, so the clones are only read. The graph is built on one copy and the reference runs on another, because a reference tool may write into the tree it runs in (Composer writes `vendor/`). `--save` refuses a partial run, a protocol that differs from the committed one, and a dirty scored tree.

## 8. Not in scope

A git co-change reference (files that change together in a commit) was listed in the issue. The pinned clones are single-commit checkouts, so it needs a full-history fetch of every repository and a method of its own; it stays open on #980.

## 9. Deviation log

**2026-10-26 — a second run, to record why edges were missed.** The first registered run (scorer at `975d281`, protocol sha256 `e259922692bf…`, load average 3.44) gave the figures below. Reading the misses of the component group showed that most of them share one cause, and the report as run said only how many edges were missed, not why. The scorer was extended to count, for every missed and every extra edge, how the import reaches its file (`missedByKind`, `wrongByKind` in the report; `scripts/lib/import-accuracy.mjs`, `scripts/import-accuracy/sfc.mjs`) and the run was repeated to save a report that carries them. Nothing that decides an edge or a figure changed. The protocol file, the references, the repositories and the pinned commits are the ones of the first run, and the headline figures of the second run are checked against the first's before anything is published.

First run (the figures the second run must reproduce):

| Group | Precision | Graph edges | Recall | Reference edges |
|---|---|---|---|---|
| C / C++ / Objective-C | 99.7% | 4,609 | 99.7% | 4,611 |
| Vue / Svelte / Astro | 99.7% | 1,539 | 79.0% | 1,941 |
| PHP | 100.0% | 4,976 | 100.0% | 4,975 |
| Swift (module level) | 100.0% | 150 | 99.3% | 151 |

Predictions: P1, P2, P3, P5, P6, P7, P8 held; **P4 missed** (component recall 79.0% against 90%).

**The second run reproduced the first exactly**: every group's figures, every repository's counts and samples, every prediction (compared field by field before anything else was done). It also showed what the misses are, and two of them were defects in the new component reader rather than gaps in the shared JavaScript resolver:

- an Astro file that starts with a blank line before its `---` fence lost its frontmatter (the fence pattern required the first character); Astro's own parser accepts the blank line;
- a component that renders itself (`svelte:self`, a recursive Astro component) was its own importer, which no other new resolver allows.

Both were fixed in `src/graph/import-resolvers.js` and `src/graph/builder.js` (commit `91aec34`), with tests and mutants, and the scorer also gained a label for a Swift module with no Swift file (`7287d5a`). **The third run is the saved report.** Against the first run: C, PHP and Swift are bit-for-bit unchanged; components went from 99.7% precision on 1,539 graph edges to **100.0% on 1,535** (five self-edges gone, one frontmatter edge found) and from 79.0% to **79.1% recall** on the same 1,941 reference edges. P4 is still missed. The remaining component misses are not defects of the component reader and were **not** fixed here: they are in the resolver every `.js` and `.ts` file shares, and widening it would move the ranker's graph (#934); the report counts them by cause and the guide page lists them.
