---
title: "ADR 0002 — Hand-written extractors, no tree-sitter"
description: Why SigMap ships no parser or grammar, the opt-in tiers that use tools already on the machine, the Python exception, and what would reopen the decision.
---

# ADR 0002 — Hand-written extractors; SigMap ships no parser or grammar

| | |
|---|---|
| **Status** | Accepted with exceptions |
| **Recorded** | 2026-10-09 ([#930](https://github.com/manojmallick/sigmap/issues/930)); the decision predates it |
| **Applies to** | `src/extractors/` — how signatures are produced for every supported language, and `:start-end` line anchors for the languages that have them |

## Context

SigMap needs the signatures of each file, in many languages, with line anchors. The standard route is tree-sitter: a parser library plus a compiled or WASM grammar per language. The alternatives are each language's own parser, or extractors written by hand.

## Decision

Extractors are hand-written and dependency-free. The brace-language extractors (JavaScript and TypeScript, Go, Rust, Java, Kotlin, Swift, C#, C and C++ among them) share one tokenizer-grade scanner, [`src/extractors/scan.js`](https://github.com/manojmallick/sigmap/blob/main/src/extractors/scan.js), which masks comments and strings and reads balanced delimiters. Its header is explicit: *"NOT a parser, NOT tree-sitter: three small, deterministic, zero-dependency passes."* Tree-sitter was rejected outright, **including as an opt-in path**.

## Why

1. **Zero runtime dependencies is a constraint, not a preference.** Tree-sitter means a package, a grammar for every language, and either native builds or WASM — setup on exactly the machines (CI runners, locked-down laptops, air-gapped hosts) where a single offline file is the point.
2. **"Opt-in" does not rescue it.** The recorded reason is that even as an opt-in a parser engine adds setup and breaks the spirit of zero dependencies. A further argument, added in writing this record: a second engine gives two answers for the same file depending on the environment, so the committed context file would depend on the host. That is not hypothetical: the Python extractor already behaves this way (see below), and the third-party gate had to run with `python3` shadowed to get a reproducible number — flask moved from 5/5 to 4/5, and Django's MRR from 0.307 to 0.290, depending on whether the host `python3` was present ([#893](https://github.com/manojmallick/sigmap/issues/893) §4).
3. **Raising quality is cheaper than swapping engines.** A fix in the shared scanner lifts every language that uses it at once. [#874](https://github.com/manojmallick/sigmap/issues/874) found about 4% of JavaScript function anchors wrong because regular-expression literals were not masked; the fix went into the scanner, not into a new engine.

## Consequences

- **Hand-written extraction misses things** — macros, unusual formatting, generated code. A missing or wrong signature is a retrieval miss. The third-party corpus ([#892](https://github.com/manojmallick/sigmap/issues/892)) exists partly to find these: it turned up four constructs that made an extractor return nothing for a whole file (a C# `partial` type, a Swift `@unchecked` clause, a TypeScript `export default` of an identifier among them), fixed in [#901](https://github.com/manojmallick/sigmap/pull/901). A fifth gap in that report, the default exclude skipping any directory named `build`, is still open.
- **Fidelity is tiered and disclosed.** [`KNOWN_LIMITATIONS.md`](https://github.com/manojmallick/sigmap/blob/main/KNOWN_LIMITATIONS.md) lists which languages are anchored regex, which are weaker, and what each can miss.

### Where the repository does not follow this

The decision is "SigMap ships no parser", and it holds. These tiers use something the user's environment already has, and fall back to the regex path when it is absent:

| Tier | Uses | Default |
|---|---|---|
| TypeScript (`exactness.typescript`) | the target repository's own `node_modules/typescript` | off |
| LSP (`exactness.lsp`) | a language server already on the machine | off |
| SCIP (`exactness.scip`) | an `index.scip` produced by the user's CI | off |
| **Python** | **`python3` on `PATH`, via `src/extractors/python_ast.py`** | **on** |

Python is the one exception that is on by default, and it is the one that costs reproducibility: the same tree indexes differently with and without a host `python3`. The `python3` dependency is in `KNOWN_LIMITATIONS.md`; the reproducibility cost is tracked in [#893](https://github.com/manojmallick/sigmap/issues/893) §4 and in the [retrieval benchmark](/guide/retrieval-benchmark) guide.

## Evidence

- `src/extractors/scan.js` header; `src/extractors/python.js` (`tryNativeExtract` runs `python3` and returns `null` when it is unavailable); `src/config/defaults.js` (`exactness`, opt-in with a silent regex fallback).
- `KNOWN_LIMITATIONS.md`, "Extractor tiers".
- `test/integration/corpus-floor.test.js`: fails when an extractor language has no labelled task and no recorded reason in `benchmarks/corpus-coverage.json`.

## Revisit when

A language cannot reach usable fidelity with a scanner and hand-written rules, **and** a way to improve it is found that ships no dependency. Shipping a parser or grammar would mean reopening zero runtime dependencies itself, and that belongs in its own record.
