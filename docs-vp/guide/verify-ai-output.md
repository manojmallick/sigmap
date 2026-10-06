# Hallucination Guard (`verify-ai-output`)

`verify-ai-output` flags claims in an AI answer that don't match your real
repository — fabricated files, imports, imported names, symbols, test paths, and npm scripts.
It is **deterministic and fully offline**: no network, no second LLM. It reuses
SigMap's symbol index, file map, and import resolver, so every check is grounded
in your actual code.

```bash
sigmap verify-ai-output answer.md
```

Exit code is `1` when any issue is found, `0` when the answer is clean — drop it
straight into CI.

## What it detects

| Type | Meaning | Confidence |
|---|---|---|
| `fake-file` | A referenced path is not on disk | High |
| `fake-test-file` | A referenced **test** path is not on disk | High |
| `fake-import` | A relative import doesn't resolve, a bare package isn't in `package.json`, or a **Python / Go** import of the repo's own package doesn't resolve (#909) | High |
| `fake-import-name` | A name imported from a repo module that resolves to **one** file, and occurs nowhere in it (#909, D1) | Medium |
| `fake-symbol` | A called function/class isn't in the repo index **or the installed libraries**, and is neither called nor defined anywhere in your source (#914) | Medium |
| `fake-npm-script` | `npm run X` where `X` isn't a `package.json` script | High |
| `arity-mismatch` | A **known** repo function is called with an argument count outside its signature's `[min, max]` (v8.28.0, D1) | Medium |

Node/Python builtins, scoped packages, and language globals are allow-listed to
keep precision high. A **third-party** Python import is left alone — which
distribution provides `import yaml` is not decidable offline — while one the repo
can decide is checked (below).

Since **v8.54.1** the globals allowlist lives in `src/verify/globals.js` as
grouped data — 184 names across ECMAScript, Web/Node platform, Node module
scope, test-runner and Python built-ins. It replaced a hand-maintained inline
literal that stopped at `encodeURIComponent`, so `structuredClone(obj)` — a Node
and browser global since Node 17 — was reported as fabricated at `high`
confidence (#777). A missing global is now a one-line addition to the right
group.

### Imports and the names they take (#909)

Before #909 an import was checked only as JS: a relative path against the disk, a
bare package against `package.json`. A Python import was checked only when it was
relative — by a resolver built for JS paths, which flagged real ones — and a Go
import not at all. They are now decided from the repo itself, and every answer is
one of three: **resolved**, **unresolved**, or **unknown**. Only *unresolved* is a
finding, because a false "fake import" costs more than a missed one.

| Language | Resolved | Unresolved (flagged) | Unknown (never flagged) |
|---|---|---|---|
| **Python** | a dotted import whose first segment is a repo package or module and which names a file or package; the standard library; a relative import naming any module the repo has | the first segment is a repo package, and no such module exists under it | a third-party package; a layout with no importable root; a repo package that shadows a stdlib name (`queue/`, `types/`) |
| **Go** | an import under the `go.mod` module path whose directory holds Go files (nested modules too, longest path wins); the standard library; a module in `go.mod`'s `require` | under the module path, but no such directory | any other module path; no `go.mod` |

A package is found through an **empty `__init__.py`** — it carries no signature, so
the index never holds it, and the disk is read instead. A Go import block
(`import ( … )`) and aliased or blank imports (`r "x"`, `_ "x"`) are read only
inside a ```` ```go ```` fence, so prose is never read as a package.

**Named imports.** For an import of a name from a module the repo owns —
`import { helper } from './util'`, `const { a } = require('./x')`,
`from app.config import load_config` — `fake-import-name` flags a name that occurs
**nowhere** in the module's text. It is deliberately a *necessary-condition* check:
a name the file never mentions cannot be exported by it. It never fires for a
default or namespace import, a wildcard re-export (`export *`,
`module.exports = require(…)`, `from x import *`), a computed export
(`exports[k] = …`, `__getattr__`), a package submodule
(`from app import config`), a bare package, or a module that does not resolve to
exactly **one** file. Multi-line imports and destructuring are read, and the
suggestion is the closest name the module actually has.

**Windows paths.** `src\retrieval\ranker.js` is read as `src/retrieval/ranker.js` — one
claim however it is spelled. A string escape (`"a\nfile.txt"`), a drive-letter
path and an escaped `\\` are not paths, and neither is a one-separator path whose
file starts with an escape letter (`lib\test.js` may be `lib<TAB>est.js`) — the
price of precision. Backslashes inside a code fence are escapes, except in a
`bat`/`cmd`/`powershell` fence.

**Known limits.** A declaration in backticks (`` `def clear(domain)` ``) is not a
symbol claim: a reference doc lists methods that way and a plan proposes them, so
reading them is a separate, measured widening of the claim set. It was also unsafe
while the index decided a symbol's fate — on httpx all 3 such claims were flagged
(#909) — which [the next section](#symbols-are-confirmed-against-your-source-914)
settles. Java, Rust and C# imports are not resolved. Neither is a third-party
Python import.

### Symbols are confirmed against your source (#914)

`fake-symbol` used to ask one question — *is this name in the symbol index?* — and
the index is a summary: a file keeps `maxSigsPerFile` (25) signatures, only the
files under the detected source roots are in it, and an extractor lists only the
constructs it knows. A real symbol outside it was reported as fabricated. Measured
on the docs of 35 open-source repositories, **42% of the names `verify` flagged
were defined in the checkout**: 32% in files the index does not hold (another
root, `examples/`, tests), 7% in an indexed file the extractor did not list, and
3% past the 25-signature cap (#910 — httpx's `Cookies.extract_cookies`).

So before a symbol is reported, `verify` looks it up in the source — only the
names that would be flagged, in one pass. A name is **confirmed**, and not
reported, when one of these forms of it occurs in the *code* of a source file:

| Form | Examples |
|---|---|
| a call, or a definition head, optionally generic | `clear(domain)` · `add<T>(x)` |
| a binding to a function, typed or not | `handler = (req) => …` · `name: function` · `name <- function(x)` |
| a keyword definition, with an optional generic or receiver | `def clear` · `fun <T> launch(` · `func (c *Client) Do(` · `class Cookies` |
| an exported binding, function-shaped or not | `export const immer = impl as Immer` · `exports.clear = clear` |

Comments, docstrings, strings, template literals and regex literals are blanked
first, so `# call clear() to reset` or a SQL string confirms nothing, and the bare
word never does. Like the named-import check above it is a *necessary-condition*
check: a name that is called or defined nowhere in the repository's code cannot be
a real symbol of it, so it is still reported — none of 20,171 mutated, fabricated
names was confirmed when this was measured — while a name the code calls is not a
fabrication, whether your repo or a library it uses owns it.

- **Scope.** Every code file of the checkout — JS/TS and single-file components,
  Python, Go, Rust, Java, Kotlin, Scala, C#, C/C++, Objective-C, Swift, Dart, PHP,
  Ruby, Elixir, GDScript, R, shell — except the generator's `exclude` and the
  project's own, dot directories, vendored and generated trees (`vendor`,
  `third_party`, `venv`, `dist`, `*.min.js`, `*.generated.*`, `*.pb.*`), symlinks,
  and files over 1.5 MB. The indexed files are read first. Lua, PowerShell, SQL and
  markup are not read — their comments are not blanked — so a name defined only
  there is reported as before.
- **Bounded.** Nothing is read unless a symbol would be flagged. A deterministic
  budget — 64 MB of text and 25,000 files, never a clock — ends the scan, so two
  runs agree; a name not confirmed within it stays reported, exactly as before.
- **Visible.** `summary.symbolsConfirmed` counts the names the source confirmed.
  They are not findings.
- **Everywhere the question is asked.** `verify-plan` (`unknown-symbol`), `judge`
  and the MCP `verify_suggestion` tool inherit it. A plan's `Creates:`
  introductions are *not* widened: a name that exists only past the cut is still
  not caught by `redefines-existing`.

### Arity checks (v8.28.0)

Because the balanced scanner made JS/TS (v8.27) and Go (v8.46) parameter
lists exact — and Python's come from the AST — the guard can compare a call's
argument count against the repo signature's arity range (`=` defaults and
`?`-optionals lower the minimum; `...rest`/`*args`/Go's `nums ...int` make it
variadic). Conservative by construction: only uniquely-resolved **top-level**
functions from JS/TS/Python/Go are checked (Go receiver methods are excluded
— dotted calls are never flagged); variadic signatures flag only too-few;
dotted method calls, ambiguous names, and every other language are skipped.
The suggestion on each flag is the actual repo signature and its file.

### Installed-library grounding (v8.1.0, v9.0 G5/D5 — the moat)

The `fake-symbol` check no longer knows only your repo's own symbols. It also
grounds against the **libraries actually installed** in `node_modules`: for each
**direct** dependency in `package.json`, SigMap reads that package's TypeScript
declaration entry (`types`/`typings`, else `index.d.ts`) and unions its exported
symbols into the known-symbol universe. So a genuine call like `` `Router()` ``
or `` `debounce(fn)` `` from a real installed library is **no longer
false-flagged**, while a call to a symbol that exists in neither the repo nor an
installed library still surfaces. This is grounding no public-doc tool can do —
it verifies against the *real installed tree*, with each library's version
pinned in the summary (`name@version`). It's deterministic (byte-stable given a
fixed installed tree), zero-dependency, cached, and runs automatically.

**Ecosystems:** JS/TS from `node_modules` (`.d.ts` exports). **Since v8.3.0,
Python** too — SigMap reads direct deps from `requirements.txt`/`pyproject.toml`,
locates the project's venv `site-packages` (`.venv|venv|env` → `lib/python*/
site-packages`, or `Lib/site-packages` on Windows) **without spawning Python**,
and extracts each installed package's exports from its `__init__.py`/`.pyi`
(`__all__`, top-level `def`/`class`, public assignments, and `from … import`
re-exports). A genuine call into an installed Python library (e.g.
`` `Session()` `` from `requests`) is no longer false-flagged.

## Closest-match suggestions

When a flagged name is a near miss for something real, the report adds a
heuristic suggestion (labeled as such — it's a Levenshtein guess, not a fact):

```
  L12  [Fake symbol]  Symbol not found in repo index: loadConfg()
         ↳ Did you mean `loadConfig()` in src/config/loader.js:42?
  L14  [Fake npm script]  npm script not in package.json: buidl
         ↳ Did you mean `build`?
```

### Where suggestions may come from (v8.54.1, #777)

Applying a suggestion is a code edit, so a bad one is worse than none. Until
v8.54.1 the candidate pool was the whole signature index, which produced
suggestions that would have corrupted the answer they claimed to correct —
`structuredClone()` was answered with `structuralFixture()` from a test file,
and `debounce()` with `resource()` from `test/fixtures/main.tf`.

Two rules now bound the pool:

- **Source files only.** Test and fixture paths are excluded, as are languages
  whose top-level names are not callable — Terraform resources, SQL tables,
  GraphQL fields, `.proto` messages, CSS selectors. The broader `CODE_EXTS` set
  used for coverage is deliberately *not* reused here, because it includes
  `.tf`, `.sql`, `.graphql` and `.css`.
- **A similarity floor.** Only the high and medium confidence band survives
  (normalized edit distance ≤ 0.34). `debounce` → `drone` was passing the old
  0.5 ceiling; it is now dropped, and the flag carries no suggestion at all.
  `loadConfg` → `loadConfig()` and `scanx` → `scan()` are unaffected.

## Output modes

### Terminal (default)

Grouped counts plus one line per issue, with suggestions inline.

### JSON — for CI

```bash
sigmap verify-ai-output answer.md --json
```

```json
{
  "file": "answer.md",
  "issues": [
    {
      "type": "fake-symbol",
      "value": "loadConfg",
      "line": 12,
      "location": "L12",
      "message": "Symbol not found in repo index: loadConfg()",
      "confidence": "medium",
      "suggestion": "Did you mean `loadConfig()` in src/config/loader.js:42?"
    }
  ],
  "summary": {
    "total": 1,
    "byType": { "fake-file": 0, "fake-test-file": 0, "fake-import": 0, "fake-import-name": 0, "fake-symbol": 1, "fake-npm-script": 0 },
    "clean": false,
    "symbolsIndexed": 1842,
    "withSuggestion": 1,
    "librariesIndexed": 12,
    "libraries": [{ "name": "express", "version": "4.19.2", "symbols": 41, "typed": true }],
    "checks": { "symbols": true, "files": true, "relativeImports": true, "bareImports": true, "scripts": true },
    "verifiedImports": ["./src/util", "fs", "app.config"]
  }
}
```

`checks` (v8.45.0, J1) states which claim classes actually ran — `symbols` is `false` when no signature index exists, `bareImports`/`scripts` when there is no `package.json` — so a consumer never mistakes "not flagged" for "verified". `verifiedImports` (#909) lists the import claims the run *positively resolved* — a repo module, the standard library, a `go.mod` requirement, a declared dependency — in any language; an import it could not decide is in neither list. [`sigmap judge`](/guide/cli#judge) keys its structural claim grounding off both fields.

### HTML report

```bash
sigmap verify-ai-output answer.md --report report.html
```

Writes a standalone, self-contained HTML report (red/amber/green per issue,
suggestions inline). It has no external assets or scripts, so it's safe to
publish or paste as a screenshot into a PR. `--report` can be combined with
`--json` (the report is written, JSON goes to stdout).

## Use in CI

```yaml
- name: Verify AI answer against the repo
  run: |
    npx sigmap verify-ai-output answer.md --json > verify.json
    npx sigmap verify-ai-output answer.md --report verify-report.html
```

A non-zero exit fails the job when the answer contains fabricated references.

## Precision

Detector precision is validated by a proof harness
(`npm run benchmark:verify`) that scores each detector group against labeled
cases and enforces targets (file ≥ 95%, import ≥ 85%, symbol ≥ 75%, script ≥
95%). Point it at your own repos with a manifest:

```bash
node scripts/run-verify-benchmark.mjs --manifest cases.json
```

It emits a per-detector precision/recall CSV.

The **grounding regression corpus** scores `verify` and `judge` on answers whose
truth is known — six fixture repos (Go, Java, JavaScript, Python, Rust,
TypeScript), each with a `good.md` where every claim is real and a `bad.md` with
labelled fakes — per claim kind (`file`, `symbol`, `import`, `import-name`,
`script`), against floors recorded in `benchmarks/grounding-regression-baseline.json`:

```bash
npm run benchmark:grounding-regression     # the per-engine, per-kind table
npm run validate:grounding                 # fail below a recorded floor
```
