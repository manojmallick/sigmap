# ADR 0004 – Blast-Radius Formula

**Status:** Accepted

**Context:**
- SigMap's `sigmap impact` command shows the blast radius of changed files.
- The original design used simple depth-based traversal, which was too shallow for JVM projects.
- Issue #561 increased the dependency-graph walk depth to 12 for JVM layouts.
- The current formula uses direct weight (1.0) and transitive weight (0.5) per hop.

**Decision:**
- Direct impact: files that import or are imported by the changed file (weight 1.0).
- Transitive impact: files reachable within 2 hops (weight 0.5 each hop).
- Hub suppression: files with >20% fanout are excluded from boost to avoid surface-level matches.
- Depth is 2 hops maximum; deeper connections are not included.

**Consequences:**
- Accurate impact for typical codebases (JS/TS/Python/Java/Rust).
- JVM projects get deeper coverage via the increased depth (12 hops).
- No false positives from highly connected utility files.
- Deterministic results based on the graph traversal algorithm.

**References:**
- `src/graph/blast-radius.js` (implementation)
- Issue [#561](https://github.com/manojmallick/sigmap/issues/561) (depth increase)
- Issue [#596](https://github.com/manojmallick/sigmap/issues/596) (gate score consistency)