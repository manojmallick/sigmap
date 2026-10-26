---
title: Extraction recall
description: How many of the symbols a language's own parser finds does SigMap list? Measured against CPython's ast, Ruby's Ripper and clangd on pinned Flask, Django, Rails, Sidekiq, libuv, spdlog and abseil-cpp checkouts, with floors enforced in CI for Python and Ruby and every other language listed as unmeasured.
head:
  - - meta
    - property: og:title
      content: "SigMap extraction recall — measured against the language's own parser"
  - - meta
    - property: og:description
      content: "Recall of classes, functions and methods against CPython ast, Ruby Ripper and clangd, for the extractor and for the index as shipped, with floors in CI."
  - - meta
    - property: og:url
      content: "https://sigmap.io/guide/extraction-recall"
  - - meta
    - property: og:type
      content: article
---
# Extraction recall

Retrieval can only rank what the extractor emitted. This page measures the extractor on its own: of the symbols a language's own parser says a file defines, how many does SigMap list, by name, in that file?

Two populations, because they answer different questions:

- **extractor** — what the extractor returns for the file.
- **index** — what a first-time `sigmap` run keeps in `.context/sig-index.json`, read in full, the way `verify` and `search_signatures` read it (ranking and `ask` read the first 25 signatures of each file, exactly as before, so on the ranking side the recall is what it was before #982: for Python 65.0% / 77.3% / 57.1% without `python3` and 64.0% / 87.9% / 57.5% with it, for Ruby 92.1% / 98.7% / 88.0% / 88.0%), after the index limit (`maxIndexSigsPerFile`, 200 since [#982](https://github.com/manojmallick/sigmap/issues/982); it was the context file's 25). It is scored over the files the index holds, so the limit is not confused with coverage; the number of files it holds is shown beside it.

Measured on SigMap 8.81.0 with `node scripts/run-extraction-recall.mjs`. The full numbers and the first 60 misses of every kind are in [`benchmarks/reports/extraction-recall.json`](https://github.com/manojmallick/sigmap/blob/main/benchmarks/reports/extraction-recall.json).

## Python — against CPython `ast` 3.9.6

Flask (`2ac8988`) and Django (`a461af8`): `src/flask`, and Django's `db/models`, `http`, `core`, `forms`, `utils` and `contrib/admin`, without tests, migrations and locale directories. 266 files that `ast` can parse.

| Population | Files | class | function | method |
|---|---|---|---|---|
| extractor, regex tier (no `python3`) | 266 | 99.3% | 98.5% | 90.7% |
| extractor, AST tier (`python3` on PATH) | 266 | 98.8% | 100.0% | 98.6% |
| index as shipped, without `python3` | 237 | 99.3% | 98.5% | 90.6% |
| index as shipped, with `python3` | 237 | 98.8% | 100.0% | 98.6% |

The regex-tier row is 895 of 901 classes, 577 of 586 functions and 2,723 of 3,002 methods; every other count is in the report.

Which names count: the extractors omit on purpose every function or method whose name starts with `_` and every dunder except `__init__`, so those are left out on both sides (88 functions and 933 methods for the regex tier). `__init__` is listed by both tiers and counts, and so does a class whose name starts with `_`.

What the table says:

- **The index now holds what the extractor returns.** Before #982 it kept 25 signatures a file and lost most of a large module: 65.0% / 77.3% / 57.1% (without `python3`) and 64.0% / 87.9% / 57.5% (with). The Python AST tier's own output was cut as well, silently, at 30 signatures a file (`MAX_SIGS`), with a class's constants listed ahead of its methods: 67.7% / 92.5% / 64.4%. Both limits are lifted (the AST tier now stops at the regex tier's 200 and says so), and the index rows equal the extractor rows to within two methods. At the default settings the context file still keeps its first 25 signatures a file, byte for byte as before; with `maxSigsPerFile` above 30 and `python3` on PATH it now gains the signatures the AST tier used to cut at 30.
- **What is left on the AST path is the extractors' own 200.** Two of the 266 files hold more than 200 symbols, `db/models/fields/__init__.py` (278) and `db/models/expressions.py` (277); they account for every one of the 11 classes and 41 methods the index misses with `python3`. No class in the 266 files has more than 120 methods, the per-class member limit the extractors stop at.
- **Without `python3` the methods stay at 90.6%, and that is the regex tier, not the index** (its extractor row is 90.7%). 65 of the 281 methods it misses are in `contrib/admin/options.py`, where it lists none of `ModelAdmin`'s members.
- **Python 3.11 and 3.14 agree to within 0.2 points** (they parse three more Django files than 3.9), so the floors apply to any CPython 3.

### The earlier one-off figures

Two Python figures were measured once, before this harness, with throwaway scripts. Both reproduce; what differs is which names count.

- **Regex tier, 99.2% / 85.6% / 69.2%** (classes / functions / methods, 266 files, Python 3.9.6) counted every name, private ones included: 88 of the 97 function misses were private or dunder. Counting the names the extractors list gives 99.3% / 98.5% / 90.7%, the first row above. The jump in methods is almost all underscore and dunder methods the extractors omit on purpose, not an improvement of the extractor.
- **Django's index at 25 signatures a file, before #982: methods 57.6%, classes 63.5%, functions 75.9%** (221 files, Python 3.9.6) reproduces as 57.6% / 63.6% / 75.9% on a machine without `python3`, with the one-off's file selection (Django's indexed files under those directories, without tests) and its rule (`__init__` skipped like every underscore name). The 0.1 on classes is one class the extractor prints in its collapsed `@dataclass Name(...)` form (`Action`, in `contrib/admin/options.py`), which this harness counts as listed. Counting `__init__` as the extractors list it gives 56.5% for methods; with `python3` on PATH the same files give 62.7% / 87.8% / 55.5%. These 221-file figures come from a scratch script outside the committed harness, which compares Flask and Django together over the file set above; the file count depends on the interpreter (Python 3.11 parses 224 of them).

## Ruby — against Ruby Ripper 2.6.10

Rails (`f9243af`: `actionpack`, `activerecord`, `activesupport`) and Sidekiq (`132f982`). 757 files that Ruby 2.6 can parse; modern syntax drops out on both sides. Methods whose name starts with `_` are left out on both sides, as the extractor omits them on purpose.

| Population | Files | class | module | method | method under its owner | anchored | anchor exact |
|---|---|---|---|---|---|---|---|
| extractor | 757 | 100.0% | 100.0% | 98.7% | 100.0% | 100.0% | 100.0% |
| index as shipped | 298 of 757 | 100.0% | 100.0% | 98.3% | 100.0% | 100.0% | 100.0% |

The last two rows are judged on what the extractor **emits**, not on what Ripper finds ([#975](https://github.com/manojmallick/sigmap/issues/975)). *Anchored* is the share of emitted class, module and `def` lines that carry a `:start-end` anchor (9,701 of 9,701). *Anchor exact* is the share of those anchors that equal the lines Ripper says the same definition starts and ends on, the line of its name and the line of the closing `end` (9,701 of 9,701). A class opened twice is one entry, anchored to its first opening. Before #975 Ruby had no anchors: 0% anchored.

- The extractor row reproduces the [#981](https://github.com/manojmallick/sigmap/issues/981) figures (944 of 944 classes, 1,467 of 1,467 modules, 7,196 of 7,292 methods, 7,292 of 7,292 under the right owner), where owner was 7,291 before the fixes below.
- **The index holds 298 of the 757 files, and that is a coverage gap ([#997](https://github.com/manojmallick/sigmap/issues/997)), not an extraction one.** Zero-config source-directory detection on Rails picks `activestorage, actioncable, actionmailer, activesupport, guides, railties`, so no file of `actionpack` or `activerecord` is indexed (`sigmap explain actionpack/lib/action_controller/base.rb` says "not under any srcDir"). Scored over all 757 files the index recall is 37.4% / 30.7% / 31.3% / 31.9% (the anchor rows are about what is emitted, so a file the index lacks adds nothing to them).

On Ruby 3.2 (833 of the same files, including endless `def`s and pattern matching, which Ruby 2.6 cannot parse) the extractor scores 100.0% / 100.0% / 98.5% / 100.0% with 12,471 of 12,471 definition lines anchored and exact, and the index, over the 331 files it holds, 100.0% / 100.0% / 97.8% / 100.0% with 3,893 of 3,893 (87.1% / 98.4% / 82.7% / 80.6% before #982). The floors for Ruby 3 are recorded from those runs, which is why the saved report, made on Ruby 2.6, differs from it. Reading these files against Ripper found three misreads, fixed in #975: a symbol that ends in `=` (`alias_method :a, :[]= unless x`) was taken for an assignment, so the `unless` opened a block; the operator symbol `:/` (`calculate(:/, other)`) was taken for the start of a regexp that swallowed the code up to the next slash; and `lines << if x … end`, an `if` after `<<`, `,`, `&&`, `||` or `=>`, was taken for a modifier. Each left a class or module closed on the wrong `end`.

## C and C++ — against clangd 21.0.0

libuv (`20b0834`: `include/` and `src/`, the files macOS compiles), spdlog (`8671ca4`: `include/spdlog` and `src/`, without the bundled fmt) and abseil-cpp (`ea64b6e`: `absl/`, without tests, benchmarks and mocks, every sixth file): 248 files. clangd is a language server built on clang's own parser and preprocessor, so it applies the macros and the includes that a reader of the text cannot. Each file is given its repository's include directories in a compile database made in a scratch directory; nothing is written into a clone.

What is asked: classes, structs and unions that are *defined* (a forward or `friend` declaration defines nothing to read); enums; functions, with a body or only a prototype (a header is a declaration surface); methods and constructors; and whether each method is listed under the class that holds it, or under the `A` of an out-of-line `A::b`. Aliases, fields, variables, enumerators and macros are not asked for, and the extractor does not list aliases either, so an anonymous `typedef struct { ... } name_t;` (very common in C) appears in neither the question nor the answer: this page does not measure it. Names that start with `_` are left out on both sides.

| Population | Files | class | enum | function | method | method under its class | anchored | anchor exact |
|---|---|---|---|---|---|---|---|---|
| before #975 | 248 | 49.5% | 0.0% | 57.9% | 16.6% | 13.0% | 0 of 3,827 | none |
| extractor | 248 | 95.6% | 93.1% | 88.2% | 96.6% | 96.9% | 100.0% | 97.3% |
| index as shipped | 220 of 248 | 95.6% | 93.1% | 88.9% | 96.6% | 96.9% | 100.0% | 97.3% |

- **Before #975 C and C++ were Tier 3**: a handful of line-start patterns, with no namespaces, no enums, no prototype at file scope, no member defined in its class, and no `:start-end` anchor. The "before" row is that extractor, taken from `develop` and run against the same clangd answers.
- The two last columns are judged on what the extractor **emits**, as for Ruby. *Anchored* is the share of emitted definition lines that carry a `:start-end` anchor (4,192 of 4,192). *Anchor exact* is the share of those anchors, among the ones clangd can judge (it lists the same kind and name in the same file), that equal the lines clangd gives that declaration (3,961 of 4,073); the other 119 name something clangd does not list on this machine, mostly code behind an `#if` that macOS does not compile, and are neither hits nor misses. Two conventions differ on purpose: clangd's range for a template starts at the declaration and leaves out the `template <...>` header above it, while SigMap's anchor includes the header (an anchor that ends where clangd's does and starts on the header lines directly above clangd's start counts as exact); and a file that defines a function in both branches of an `#if` lists both, where clangd sees one.
- **The 200-signature cap is most of what is missing.** The extractor, like every extractor, stops at 200 signatures a file and 120 members a class and says so (`… +N more signatures`). In a scratch copy with those caps raised the same files score 99.2% / 100.0% / 97.3% / 99.9% / 99.9%. The cap bites on the giant headers: libuv's `uv.h` declares 404 symbols and abseil's `cord.h` has a class past 120 members. This page reports the shipping numbers; whether C and C++ headers deserve a higher ceiling is a separate decision.
- **What a reader of the text cannot see.** A function a macro writes (`UV_LOOP_WATCHER_DEFINE(prepare, PREPARE)`, `HEAP_EXPORT(void heap_init(...))`, `UV_UNUSED(static ...)`) is not listed, and an `#if` that opens a brace in one branch and not in the other can swallow the rest of the file. A C++14 digit separator (`1'000`) makes the shared masker read the rest of the line as a character literal. The extractor reads the text; it does not expand macros or resolve names.
- **No floors for C and C++.** The reference is a language server: its answers depend on its version and on the headers of the machine it runs on, and CI does not install one, so a floor would either not be enforced or fail on a runner that cannot reproduce it. The numbers are recorded in the saved report and reproduced with `node scripts/run-extraction-recall.mjs --only cpp` (it needs `clangd` on PATH and the pinned clones; its answers are cached in the temp directory, by content, flags and clangd version).
- **These are development figures.** The extractor was developed against these three repositories and fmt (which `--dev` adds and which is never part of a saved report), and reading their misses found defects in the *reference* too (a macro-wrapped namespace and a `template struct` hid whole files from it), so they are not held out. A check on four repositories nobody had looked at follows.

### Held out: leveldb, hiredis, yaml-cpp and cJSON

Four repositories the extractor was not developed against, at fixed commits (leveldb `bb74ef7`, hiredis `5bb7f03`, yaml-cpp `c5e6536`, cJSON `6d9f244`: 222 files, the same questions, the same clangd). Their numbers are in [`benchmarks/reports/extraction-recall-cpp-held-out.json`](https://github.com/manojmallick/sigmap/blob/main/benchmarks/reports/extraction-recall-cpp-held-out.json) and are reproduced with the commands below; they are not part of the saved report or of any floor.

| Population | Files | class | enum | function | method | method under its class | anchored | anchor exact |
|---|---|---|---|---|---|---|---|---|
| first check, before any change made because of it | 222 | 93.2% | 97.6% | 83.7% | 98.7% | 97.6% | 100.0% | 99.1% |
| after the three changes below | 222 | 93.2% | 97.6% | 98.8% | 99.2% | 98.1% | 100.0% | 99.1% |
| after the three changes, index as shipped | 210 of 222 | 93.1% | 97.5% | 98.5% | 99.2% | 98.1% | 100.0% | 99.1% |

- **The first check found two gaps in what is listed.** cJSON declares its API as `CJSON_PUBLIC(const char *) cJSON_Version(void)`, a macro that wraps the return type, and yaml-cpp writes `EMITTER_MANIP GetFlowType() const`, a macro that stands for it. The extractor took both for a macro call and dropped the function: 199 of 1,221 functions were missing at first; the two changes recovered 184 of them, most of them cJSON's (92 `CJSON_PUBLIC` definitions). Both are now read (the macro's argument, or the macro itself, is the return type; the name must not be in capitals, which is what keeps `TEST(a, b) {` out).
- **And one in what is listed that should not be.** Recall cannot see a symbol the extractor invents, but the anchor row can: it skips an anchor whose name clangd does not list in that file, and 232 were skipped. leveldb's `int count_ GUARDED_BY(mu_);` (a field and the macro that annotates it) was listed as a method named `GUARDED_BY`, 31 times. A name in capitals after a type that ends in a name of its own is now taken for an annotated variable. Across every file of the development and held-out sets (28,378 signatures) this removed 73 such lines (72 `GUARDED_BY` and one `ABSL_INTERNAL_UNIQUE_SMALL_NAME`) and nothing else; the development figures above did not move. Real functions in capitals (`UTC()`, `H1()`, yaml-cpp's `KEY_NOT_FOUND_WITH_KEY()`) are still listed.
- **Because these changes were made after looking at the four repositories, they are no longer held out for those patterns.** Another check on other repositories would be needed to say how well they generalise; this one says the patterns were real and common.
- **What is still missing is mostly one file.** All 24 missing classes, all 16 missing methods and all 40 methods under the wrong owner are in yaml-cpp's `src/contrib/dragonbox.h` (4,201 lines), which the 200-signature cap cuts. The rest of the missing functions are three in a hiredis adapter where an `#if` opens a brace in one branch only, and conversion operators of templates, which clangd names by their deduced type.
- **Skipped anchors:** 202 of the 4,383 emitted lines name something clangd does not list in that file. 119 are in hiredis's `ffc.h`, a single-header library whose implementation sits under `#ifdef FFC_IMPL`, which clangd does not enable; the rest are spread over 24 other files, such as Windows-only code behind `#ifdef _WIN32` and the Qt adapter (clangd has no Qt headers here). They are neither hits nor misses.

To reproduce (the clones are not pinned in `benchmarks/xrepo-repos.json`; fetch them by hand into any directory):

```bash
mkdir held-out && cd held-out
for spec in google/leveldb@bb74ef739973a70ca9f0d90788a1da89b788c0ad redis/hiredis@5bb7f030f6631b243438cf0fdd3be84352b905bb \
            jbeder/yaml-cpp@c5e65360373d1d99d6b6848c991cd4fcee435009 DaveGamble/cJSON@6d9f2443ab071f86e5d9b43025a40929ec41c46c; do
  repo=${spec%@*}; sha=${spec#*@}; dir=${repo#*/}
  git init -q "$dir" && git -C "$dir" fetch -q --depth 1 "https://github.com/$repo" "$sha" && git -C "$dir" checkout -q FETCH_HEAD
done
cd .. && node scripts/extraction-recall/cpp.mjs --held-out --repos "$PWD/held-out" --index
```

## Not measured

A language is measured only where a reference parser can be run on the machine that runs the benchmark. These 35 have no adapter yet and are listed rather than left out: astro, csharp, css, dart, dockerfile, elixir, gdscript, go, graphql, html, java, javascript, kotlin, lua, markdown, objc, php, pipeline, powershell, properties, protobuf, r, rust, scala, shell, sql, svelte, swift, terraform, toml, typescript, typescript_react, vue_sfc, xml, yaml. The report lists them under `unmeasured`.

A measured language with no interpreter or no clones on the machine is also reported as unmeasured, and the run exits 0, unless `--require-reference` is given (CI passes it).

## How it is measured

- The reference parser lists every function, class and method in a file; SigMap lists what it extracts. A Python symbol is found when its name is listed in the same file (a method under the same class), and a name counts once per file and kind, so a property's getter and setter are one name. A Ruby symbol is found when its bare name is listed in the same file and each definition counts; the `owner` row asks whether each method is listed under the class or module that defines it. A C or C++ symbol is found by the same rule against clangd, over definitions and prototypes; see its section above for what is asked and what is left out.
- Names the extractors omit on purpose are skipped on both sides, and the report keeps the number skipped (see above for each language).
- The clones are pinned to the commits in `benchmarks/xrepo-repos.json`, the same ones the retrieval gate uses. The index is built the way a first-time run builds it: auto-detected source directories, no config file.
- The index is read in full, every signature it keeps (`buildSigIndex(cwd, { full: true })`), the ones past what ranking reads included: that is how `verify` reads it. Ranking and `ask` read the first `maxSigsPerFile` of each file, as they always did.
- Reference versions are recorded in the report (`reference.version`) and with every floor.
- The comparison is by name, so one thing it cannot see: the regex tier prints a nested class's methods under the outer class, so a nested class's method can be credited to the outer class when the outer class's own method of the same name is missed. That is not quantified and is expected to be small.
- The index step regenerates context inside each pinned clone and restores it afterwards, as the retrieval gate does. Do not run it while another suite reads those clones, and if a run is interrupted, check `git status` in the clone and delete a leftover `.context`. `--no-index` measures the extractor only and touches nothing.

```bash
node scripts/fetch-xrepo-repos.mjs          # the pinned clones
node scripts/run-extraction-recall.mjs      # report every measured language (C and C++ need clangd on PATH)
node scripts/run-extraction-recall.mjs --only python --misses 10
npm run validate:extraction-recall          # the gate
```

## Floors

`benchmarks/extraction-recall-floors.json` holds a floor per population and kind. Each is the recall measured on the recorded version, rounded down to a whole point, less one point (100.0 becomes 99), so a floor trips on a real loss and not on a rounding. `npm run validate:extraction-recall` exits 1 below a floor.

A floor is a promise about one reference parser. A different version parses a different set of files, so a run is compared only with the floors recorded for its own version, by version prefix. On any other version the numbers are printed with "floors not enforced". CI passes `--require-reference`, a stricter gate: it also fails unless every language that has floors was measured, on a version the floors cover, with every floored population run, so a runner whose Python or Ruby no floor covers fails the job instead of passing without checking. The remedy is to record floors for that version, never to lower one.

- The Python floors apply to any CPython 3 and were checked on 3.9, 3.11 and 3.14.
- C and C++ have no floors: the reference is a language server, CI does not install one, and a floor that cannot run on the runner would guard nothing (see the section above).
- The Ruby floors are recorded twice: for Ruby 2.6 (the local reference) and for Ruby 3, from 3.2.3, the version on the CI runner. The Ruby 3 prefix rests on that one run. Going from Ruby 2.6 to 3.2.3 moved the index class recall from 92.1% to 87.1% through the file set alone (298 to 331 indexed files), against a margin of one point, so a later 3.x could trip a floor without any change to the extractor.
- The index floors guard recall over the files the index holds, not how many it holds ([#997](https://github.com/manojmallick/sigmap/issues/997)); when that changes, they may need new values.

A floor is raised in the change that raises the recall and is never lowered to land a change.
