# Call-graph accuracy protocol

How SigMap's method-level call graph (`src/graph/call-graph.js`, the data behind `--callers`, `--callees` and `get_method_impact`) is scored against an independent reference (#976). The scorer is `scripts/run-callgraph-accuracy.mjs`; the machine-readable half of this document is `benchmarks/callgraph-accuracy-protocol.json`.

**This file and the JSON were committed on 2026-10-26, before the scorer was run on any repository named in section 8.** The scorer records the protocol's sha256 in its report and refuses to save a report when the file differs from the committed copy. A change after the first run is a deviation: it goes in section 10 with its date and reason, and the numbers from before it stay in the report history. Nothing here is edited to make a result look better.

## 1. What is compared

- **System under test:** `buildCallGraph(cwd)` with no options, on a clean `git archive` copy of a pinned commit. Zero config, because that is the graph a user gets. Its nodes are `<repo-relative path>#<bare name>`; its edges are directed caller to callee pairs.
- **Reference:** a SCIP index of the same copy, from the language's own SCIP indexer, pinned in section 8. SCIP carries compiler-resolved definition and reference occurrences (the indexers run the TypeScript checker and Pyright).
- **Call it "compiler-derived", not ground truth.** A compiler cannot resolve a call through an `any`, a callback parameter, `getattr` or an untyped receiver, so the reference misses some real edges. The consequence is stated where it bites: the precision of the graph is measured against what the compiler resolved, so an edge the graph found and the compiler could not is counted as wrong. Precision is therefore a lower bound.

Both sides are reduced to the same unit, an edge `callerFile#callerName -> calleeFile#calleeName`. Two definitions with the same bare name in one file are one node on both sides.

## 2. How reference edges are derived

For each document of the index:

1. **Definitions.** Every definition occurrence gives a symbol, the identifier's source text (its bare name), its range and, where the indexer emits one, its `enclosing_range`.
2. **What a symbol is** comes from the SCIP symbol grammar, not from `SymbolInformation.kind` (scip-python leaves `kind` unset for every symbol). A symbol whose last descriptor is a method (`name().`) is *callable*. It is a **method** when the descriptor before it is a type (`Type#name().`) and a **function** otherwise (including a function nested in a function). A symbol whose last descriptor is a type (`Name#`) is a *class*. A `local N` symbol has no descriptors, so it is callable (a function) only when its `SymbolInformation.kind` is Function or Method and its definition has an `enclosing_range`; scip-typescript sets that kind, and scip-python gives nested functions full descriptors instead.
3. **Candidate references.** A non-definition occurrence is a candidate when its symbol is defined in the index (symbols from the standard library and from dependencies have no definition there and drop out) and is callable or a class.
4. **Is it a call.** The reference is a call when the next non-blank character after it is `(`, once a balanced `<...>` on the same line has been skipped. Anything else (a function passed as a value, a JSX element, a type position) is counted as `nonCall` and is not an edge. A call to a class is a `constructor` edge.
5. **Caller.** The innermost callable definition in the same document whose `enclosing_range` contains the reference. A reference with no enclosing callable (module or class body) is counted as `topLevel` and is not an edge: the graph has no node for top-level code, so it is not asked to find one.
6. **Kind and site.** The edge's **kind** is the callee's: `function`, `method` or `constructor`. Each call site has a **site class**: `bare` (`foo(`), `self` (`this.foo(`, `self.foo(`, `cls.foo(`, `super().foo(`), `receiver` (`x.foo(`, `a.b().foo(`) or `qualified` (`module.foo(` where the callee is a function or constructor). An edge with several sites takes the first class in the order `bare`, `self`, `receiver`, `qualified`. Section 5 uses edges with no `bare` site.
7. **Self edges** (caller and callee are the same node) are dropped, as `buildCallGraph` drops them.

The counts of `nonCall`, `topLevel`, external references and dropped self edges are printed for every repository, so a reader can see how much was set aside.

## 3. The comparison universe

The graph walks only the source roots it detects, and the indexer indexes whatever its project file includes. To score resolution rather than directory detection, the primary figures use **U**: the files that have at least one definition in `buildCallGraph` and are also documents of the SCIP index. Graph edges and reference edges are compared only when both endpoints are in U.

Two further figures keep that choice honest:

- **scope-inclusive recall**: reference edges between any two SCIP documents, including files the graph never walked;
- the number of files on each side that U excludes, per repository.

## 4. Metrics

`precision = |graph ∩ reference| / |graph|` and `recall = |graph ∩ reference| / |reference|` over edges in U; `F1` is their harmonic mean. Figures are micro-averaged over the repositories of a language group. A graph edge takes the kind of the reference edge it matches; one that matches nothing takes the kind of the callee's definition in the index (`unknown` when the index has no such definition).

Intervals are a cluster bootstrap over caller files (2000 resamples, seed 976, 95%), so the many edges of one file are not treated as independent. A cell with fewer than 100 edges is printed and marked `n<100`; it is never quoted as a headline and never decides a threshold.

A secondary **judgeable precision** (added after the first run, section 10) counts only graph edges whose caller and callee are both nodes the index defines as callables or classes, so an edge that touches a function-local callable is left out of the denominator. The registered precision above is unchanged and is the one to quote as the headline; the secondary figure says how much of it is the reference's blind spot.

A file-level view collapses both sides to undirected file pairs (caller file != callee file), the shape `buildCallFileGraph` feeds the ranker.

## 5. The registered threshold

For each language group with at least 100 such reference edges, take the pooled in-scope recall of **method edges with no `bare` site** (calls made through `this`, `self` or a receiver). If it is **below 0.70**, a spike is warranted for a zero-dependency receiver-type pass that extends `buildTypeMap` for that language: no type checker, no Tree-sitter.

0.70 is chosen because below it more than three in ten of a method's real callers are missing from the answer, and an answer that incomplete cannot be used to decide whether a method is safe to change.

The spike is kept only if it raises that recall by at least 20 points in the language and lowers overall precision by no more than 2 points, both measured by this harness on the same repositories.

## 6. Predictions made before the run

1. **P1.** Receiver-only method recall is below 15% in TypeScript, JavaScript, Python and Go, because `buildCallGraph` resolves `.name(` calls through a receiver type only for Java (`typeMap` is built only for `JAVA_EXTS`, and `callsInRange` skips a `.name(` access).
2. **P2.** Recall of `function` edges with a `bare` site is between 50% and 90% in every group.
3. **P3.** Overall precision is between 50% and 90% in every group, pulled down by calls that match a same-named definition the compiler did not resolve to.
4. **P4.** `constructor` recall is below 10% in TypeScript, JavaScript and Python, because classes are not nodes of the graph.
5. **P5.** In Java, receiver-only method recall is higher than in any other group and below 70%.

Where a prediction is wrong the report says so. P1 and P4 are structural and are expected to hold; P2, P3 and P5 are real guesses.

## 7. What this does and does not say

- It says how often the graph's edges agree with the edges a compiler resolves, in the languages and repositories of section 8.
- It says nothing about PHP, C#, C/C++, Swift, Dart, Lua, GDScript, Vue, Svelte or Astro (the graph reads none of them, #979), nor about Rust, Kotlin, Scala or Ruby (no SCIP indexer was run here), nor about repositories of another shape.
- The repositories are well-known open-source projects with a normal layout; a monorepo or generated-code-heavy repository may score differently.
- JSX element references count as non-calls on both sides, which does not penalise the graph for React component edges.
- **The reference cannot name function-local callables.** scip-typescript gives `const f = () => ...` declared inside a function no callable identity (a `local N` symbol of kind Constant, with no `enclosing_range`), so such a function is neither a caller nor a callee of any reference edge, and a call made inside it is attributed to the enclosing named function. A graph edge that has one as an endpoint is **unjudged**, not wrong; section 4 reports precision both ways. This was visible on the development fixture before the run and was left out of this protocol's first text.
- Dependencies are not installed in the measurement copy, so a call resolved through an installed package's types is unresolved. This only removes reference edges to in-repository callees that need such types.
- A git co-change reference (file pairs that change together) was considered and is not part of this protocol: the pinned clones are single-commit checkouts, so it needs a full-history fetch of every repository and a separate method. It stays open on #976.

## 8. Repositories and indexers

| Group | Indexer (pinned) | Repositories (full commits in the JSON) |
|---|---|---|
| typescript | `@sourcegraph/scip-typescript` 0.5.2, the repository's own `tsconfig.json` | zod, excalidraw |
| javascript | `@sourcegraph/scip-typescript` 0.5.2, a generated `allowJs` project (JSON `typescriptProject`) | express, fastify |
| python | `@sourcegraph/scip-python` 0.6.8 | flask, fastapi, django |
| go (wave 2) | `scip-go`, version recorded when installed | gin, gorm |
| java (wave 2) | `scip-java`, version recorded when installed | gson, spring-petclinic |

Waves 1 and 2 share this protocol. Wave 2 runs only if its indexer and toolchain can be installed into a scratch directory without a system install; otherwise it is reported unmeasured with the reason.

**No substitution.** A repository whose indexer fails or exceeds 30 minutes is reported unmeasured with the reason; it is not replaced by a friendlier one.

**Development used other repositories.** The reference deriver was built and checked on `src/` of this repository (as JavaScript) and on `click`, neither of which is in the table.

## 9. Reproducing a run

```
node scripts/fetch-xrepo-repos.mjs --only zod,excalidraw,express,fastify,flask,fastapi,django
node scripts/run-callgraph-accuracy.mjs --setup-indexers <dir>      # installs the two pinned indexers into <dir>
node scripts/run-callgraph-accuracy.mjs --indexers <dir>            # prints the tables
node scripts/run-callgraph-accuracy.mjs --indexers <dir> --save     # also writes benchmarks/reports/callgraph-accuracy.json
```

Each repository is exported with `git archive` into a scratch directory, indexed there and scored there, so the pinned clones are never written to. The report carries the commit of SigMap that was scored, the indexer versions, the Node version, the platform and the load average.

## 10. Deviation log

Every change after the first run of a registered repository. The primary definitions in sections 2 to 5 are unchanged by all of them.

### 2026-10-26, after the first run

**The first run** (harness commit `8bf6c12`, protocol commit `fe787a5`) produced figures for the TypeScript group only. Python, JavaScript and the wave-2 groups did not run, for the reasons under "operational". These are its figures, kept here whatever the final report says (zod and excalidraw, in the files both sides cover):

| | recall | reference edges | precision | graph edges |
|---|---:|---:|---:|---:|
| all edges | 5.6% | 1472 | 6.0% | 1365 |
| function | 13.0% | 630 | 25.8% | 318 |
| method | 0.0% | 664 | 0.0% | 7 |
| constructor | 0.0% | 178 | - | 0 |
| graph edges whose callee the index cannot name | - | - | 0.0% | 1040 |

Receiver-only method recall 0.0%, so the section 5 threshold said a spike is warranted. Predictions: P1 held, P2 missed (26.5%), P3 missed (6.0%), P4 held.

**Operational** (a figure could not exist; no definition changed):

1. The runner wrote the protocol's description of the JavaScript project file into `tsconfig.json` instead of the configuration itself, so express and fastify could not be indexed. The protocol JSON now carries the same configuration as data (`javascriptConfig`); its content is the one registered in section 8.
2. The runner required a root `tsconfig.json` for every non-JavaScript group, Python included, so flask, fastapi and django did not run. Only TypeScript repositories need one.
3. An indexer failure showed only the end of its stack trace; it now shows the first lines too.

**Added** (a new figure; no existing one changed):

4. Judgeable precision (section 4). In the first run 1040 of the 1365 graph edges had a callee the index cannot name. The one inspected (`_parse -> freeze` in zod's `types.ts`) is a real call, to a function-local constant. Quoting 6.0% alone would have blamed the graph for the reference's blind spot.
5. Section 7 now states that blind spot.
