---
title: Extraction recall
description: How many of the symbols a language's own parser finds does SigMap list? Measured against CPython's ast and Ruby's Ripper on pinned Flask, Django, Rails and Sidekiq checkouts, with floors enforced in CI and every other language listed as unmeasured.
head:
  - - meta
    - property: og:title
      content: "SigMap extraction recall — measured against the language's own parser"
  - - meta
    - property: og:description
      content: "Recall of classes, functions and methods against CPython ast and Ruby Ripper, for the extractor and for the index as shipped, with floors in CI."
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
- **index** — what a first-time `sigmap` run keeps in `.context/sig-index.json`, after the index limit (`maxIndexSigsPerFile`, 200 since [#982](https://github.com/manojmallick/sigmap/issues/982); it was the context file's 25). It is scored over the files the index holds, so the limit is not confused with coverage; the number of files it holds is shown beside it.

Measured on SigMap 8.80.1 with `node scripts/run-extraction-recall.mjs`. The full numbers and the first 60 misses of every kind are in [`benchmarks/reports/extraction-recall.json`](https://github.com/manojmallick/sigmap/blob/main/benchmarks/reports/extraction-recall.json).

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

| Population | Files | class | module | method | method under its owner |
|---|---|---|---|---|---|
| extractor | 757 | 100.0% | 100.0% | 98.7% | 100.0% |
| index as shipped | 298 of 757 | 100.0% | 100.0% | 98.3% | 100.0% |

- The extractor row reproduces the [#981](https://github.com/manojmallick/sigmap/issues/981) figures (944 of 944 classes, 1,467 of 1,467 modules, 7,196 of 7,292 methods, 7,291 of 7,292 under the right owner).
- **The index holds 298 of the 757 files, and that is a coverage gap ([#997](https://github.com/manojmallick/sigmap/issues/997)), not an extraction one.** Zero-config source-directory detection on Rails picks `activestorage, actioncable, actionmailer, activesupport, guides, railties`, so no file of `actionpack` or `activerecord` is indexed (`sigmap explain actionpack/lib/action_controller/base.rb` says "not under any srcDir"). Scored over all 757 files the index recall is 37.4% / 30.7% / 31.3% / 31.9%.

On the CI runner (Ruby 3.2.3, which parses 833 of the same files) the extractor scores 100.0% / 100.0% / 98.5% / 99.3% and the index, over the 331 files it holds, 100.0% / 100.0% / 97.8% / 97.7% (87.1% / 98.4% / 82.7% / 80.6% before #982). The floors for Ruby 3 are recorded from those runs, which is why the saved report, made on Ruby 2.6, differs from it.

## Not measured

A language is measured only where a reference parser can be run on the machine that runs the benchmark. These 36 have no adapter yet and are listed rather than left out: astro, cpp, csharp, css, dart, dockerfile, elixir, gdscript, go, graphql, html, java, javascript, kotlin, lua, markdown, objc, php, pipeline, powershell, properties, protobuf, r, rust, scala, shell, sql, svelte, swift, terraform, toml, typescript, typescript_react, vue_sfc, xml, yaml. The report lists them under `unmeasured`.

A measured language with no interpreter or no clones on the machine is also reported as unmeasured, and the run exits 0, unless `--require-reference` is given (CI passes it).

## How it is measured

- The reference parser lists every function, class and method in a file; SigMap lists what it extracts. A Python symbol is found when its name is listed in the same file (a method under the same class), and a name counts once per file and kind, so a property's getter and setter are one name. A Ruby symbol is found when its bare name is listed in the same file and each definition counts; the `owner` row asks whether each method is listed under the class or module that defines it.
- Names the extractors omit on purpose are skipped on both sides, and the report keeps the number skipped (see above for each language).
- The clones are pinned to the commits in `benchmarks/xrepo-repos.json`, the same ones the retrieval gate uses. The index is built the way a first-time run builds it: auto-detected source directories, no config file.
- The index is read in full, every signature it keeps (`buildSigIndex(cwd, { full: true })`), the ones past what ranking reads included: that is how `verify` reads it. Ranking and `ask` read the first `maxSigsPerFile` of each file, as they always did.
- Reference versions are recorded in the report (`reference.version`) and with every floor.
- The comparison is by name, so one thing it cannot see: the regex tier prints a nested class's methods under the outer class, so a nested class's method can be credited to the outer class when the outer class's own method of the same name is missed. That is not quantified and is expected to be small.
- The index step regenerates context inside each pinned clone and restores it afterwards, as the retrieval gate does. Do not run it while another suite reads those clones, and if a run is interrupted, check `git status` in the clone and delete a leftover `.context`. `--no-index` measures the extractor only and touches nothing.

```bash
node scripts/fetch-xrepo-repos.mjs          # the pinned clones
node scripts/run-extraction-recall.mjs      # report both languages
node scripts/run-extraction-recall.mjs --only python --misses 10
npm run validate:extraction-recall          # the gate
```

## Floors

`benchmarks/extraction-recall-floors.json` holds a floor per population and kind. Each is the recall measured on the recorded version, rounded down to a whole point, less one point (100.0 becomes 99), so a floor trips on a real loss and not on a rounding. `npm run validate:extraction-recall` exits 1 below a floor.

A floor is a promise about one reference parser. A different version parses a different set of files, so a run is compared only with the floors recorded for its own version, by version prefix. On any other version the numbers are printed with "floors not enforced". CI passes `--require-reference`, a stricter gate: it also fails unless every language that has floors was measured, on a version the floors cover, with every floored population run, so a runner whose Python or Ruby no floor covers fails the job instead of passing without checking. The remedy is to record floors for that version, never to lower one.

- The Python floors apply to any CPython 3 and were checked on 3.9, 3.11 and 3.14.
- The Ruby floors are recorded twice: for Ruby 2.6 (the local reference) and for Ruby 3, from 3.2.3, the version on the CI runner. The Ruby 3 prefix rests on that one run. Going from Ruby 2.6 to 3.2.3 moved the index class recall from 92.1% to 87.1% through the file set alone (298 to 331 indexed files), against a margin of one point, so a later 3.x could trip a floor without any change to the extractor.
- The index floors guard recall over the files the index holds, not how many it holds ([#997](https://github.com/manojmallick/sigmap/issues/997)); when that changes, they may need new values.

A floor is raised in the change that raises the recall and is never lowered to land a change.
