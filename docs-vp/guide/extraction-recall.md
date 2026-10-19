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
- **index** — what a first-time `sigmap` run keeps, after the 25-signature-per-file cap. It is scored over the files the index holds, so the cap is not confused with coverage; the number of files it holds is shown beside it.

Measured on SigMap 8.80.1 with `node scripts/run-extraction-recall.mjs`. The full numbers and the first 60 misses of every kind are in [`benchmarks/reports/extraction-recall.json`](https://github.com/manojmallick/sigmap/blob/main/benchmarks/reports/extraction-recall.json).

## Python — against CPython `ast` 3.9.6

Flask (`2ac8988`) and Django (`a461af8`): `src/flask`, and Django's `db/models`, `http`, `core`, `forms`, `utils` and `contrib/admin`, without tests, migrations and locale directories. 266 files that `ast` can parse.

| Population | Files | class | function | method |
|---|---|---|---|---|
| extractor, regex tier (no `python3`) | 266 | 99.3% | 98.5% | 93.0% |
| extractor, AST tier (`python3` on PATH) | 266 | 67.6% | 92.5% | 63.9% |
| index as shipped, without `python3` | 237 | 65.0% | 77.3% | 58.4% |
| index as shipped, with `python3` | 237 | 64.0% | 87.9% | 56.6% |

Counts behind each cell are in the report; the regex-tier row is 893 of 899 classes, 577 of 586 functions and 2,433 of 2,615 methods.

What the table says:

- **The AST tier is not the more complete one.** `python_ast.py` stops after 30 signatures a file and does not say so (`MAX_SIGS`), so a large module loses its tail before the index cap applies: Django's `db/models/fields/__init__.py` comes back as 30 signatures where the regex tier returns 201. A machine with `python3` therefore indexes fewer classes and methods than one without. [#982](https://github.com/manojmallick/sigmap/issues/982) tracks the Python index recall.
- **The index loses far more than the extractor does.** From the regex tier to the index without `python3`, classes fall 34 points, functions 21 and methods 35: the 25-signature cap drops the tail of every large file.
- **Python 3.11 and 3.14 agree to within 0.3 points** (they parse three more Django files than 3.9), so the floors apply to any CPython 3.

### The earlier one-off figures

Two Python figures were measured once, before this harness, with throwaway scripts; both reproduce, and the first needs a correction of method:

- **Regex tier, 99.2% / 85.6% / 69.2%** (classes / functions / methods, 266 files) counted private and dunder names the extractor omits on purpose, which made up 88 of the 97 function misses. Scoring public names only gives 99.3% / 98.5% / 93.0%, the first row above.
- **Django's index, methods 57.6%, classes 63.5%, functions 75.9%** (221 files) reproduces on a machine without `python3` as 57.6% / 63.6% / 75.9%; the 0.1 on classes is a class the extractor prints in its collapsed `@dataclass Name(...)` form, which this harness counts as listed. With `python3` on PATH the same 221 files give 54.6% / 62.7% / 87.8%. The 221-file Django figures are not in the report, which covers Flask and Django together.

## Ruby — against Ruby Ripper 2.6.10

Rails (`f9243af`: `actionpack`, `activerecord`, `activesupport`) and Sidekiq (`132f982`). 757 files that Ruby 2.6 can parse; modern syntax drops out on both sides.

| Population | Files | class | module | method | method under its owner |
|---|---|---|---|---|---|
| extractor | 757 | 100.0% | 100.0% | 98.7% | 100.0% |
| index as shipped | 298 of 757 | 92.1% | 98.7% | 88.0% | 88.0% |

- The extractor row reproduces the [#981](https://github.com/manojmallick/sigmap/issues/981) figures (944 of 944 classes, 1,467 of 1,467 modules, 7,196 of 7,292 methods, 7,291 of 7,292 under the right owner).
- **The index holds 298 of the 757 files, and that is a coverage gap, not an extraction one.** Zero-config source-directory detection on Rails picks `activestorage, actioncable, actionmailer, activesupport, guides, railties`, so no file of `actionpack` or `activerecord` is indexed (`sigmap explain actionpack/lib/action_controller/base.rb` says "not under any srcDir"). Scored over all 757 files the index recall is 34.4% / 30.3% / 28.1% / 28.0%.

On the CI runner (Ruby 3.2.3, which parses 833 of the same files) the extractor scores 100.0% / 100.0% / 98.5% / 99.3% and the index, over the 331 files it holds, 87.1% / 98.4% / 82.7% / 80.6%. The floors for Ruby 3 are recorded from that run, which is why the saved report, made on Ruby 2.6, differs from it.

## Not measured

A language is measured only where a reference parser can be run on the machine that runs the benchmark. These 36 have no adapter yet and are listed rather than left out: astro, cpp, csharp, css, dart, dockerfile, elixir, gdscript, go, graphql, html, java, javascript, kotlin, lua, markdown, objc, php, pipeline, powershell, properties, protobuf, r, rust, scala, shell, sql, svelte, swift, terraform, toml, typescript, typescript_react, vue_sfc, xml, yaml. The report lists them under `unmeasured`.

A measured language with no interpreter or no clones on the machine is also reported as unmeasured, and the run exits 0, unless `--require-reference` is given (CI passes it).

## How it is measured

- The reference parser lists every function, class and method in a file; `sigmap` lists what it extracts. A symbol is found when its name is listed in the same file (a method under the same class). A name counts once per file and kind.
- Only public names count. A name whose last segment starts with `_` is skipped on both sides, because the extractors omit those on purpose; the report keeps the number skipped.
- The clones are pinned to the commits in `benchmarks/xrepo-repos.json`, the same ones the retrieval gate uses. The index is built the way a first-time run builds it: auto-detected source directories, no config file, and the checkout is left byte-identical.
- Reference versions are recorded in the report (`reference.version`) and with every floor.

```bash
node scripts/fetch-xrepo-repos.mjs          # the pinned clones
node scripts/run-extraction-recall.mjs      # report both languages
node scripts/run-extraction-recall.mjs --only python --misses 10
npm run validate:extraction-recall          # the gate CI runs
```

## Floors

`benchmarks/extraction-recall-floors.json` holds a floor per population and kind. Each is the recall measured on the recorded version, rounded down to a whole point, less one point (100.0 becomes 99), so a floor trips on a real loss and not on a rounding. `npm run validate:extraction-recall` exits 1 below a floor.

A floor is a promise about one reference parser. A different version parses a different set of files, so a run is compared only with the floors recorded for its own version, by version prefix. On any other version the numbers are printed with "floors not enforced". The Python floors apply to any CPython 3 (checked on 3.9, 3.11, 3.12 and 3.14). The Ruby floors are recorded twice: for Ruby 2.6 (the local reference) and for Ruby 3, from 3.2.3, the version on the CI runner. CI passes `--require-reference`, so a runner whose Python or Ruby no floor covers fails the job instead of passing without checking; the remedy is to record floors for that version.

A floor is raised in the change that raises the recall and is never lowered to land a change.
