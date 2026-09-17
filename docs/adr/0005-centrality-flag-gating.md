# ADR 0005 – Why Centrality Was Shipped Flag-Gated

**Status:** Accepted

**Context:**
- Centrality blend (import-graph centrality) was added in v6.7 as a small additive prior.
- The feature was shipped flag-gated (`retrieval.centralityBlend: false`) because:
  - Impact on benchmark scores was unknown
  - Risk of changing ranking behavior for existing users
  - Need to measure before enabling universally

**Decision:**
- Ship with the feature disabled (`false` by default).
- Keep the implementation and configuration exposed for opt-in testing.
- Measure impact on retrieval and task benchmarks before enabling by default.
- The flag remains available for users who want the boost today.

**Consequences:**
- Users can enable centrality blend via `sigmap --config retrieval.centralityBlend=true`
- Future releases can enable it by default after sufficient positive data
- No breaking change for existing users
- Benchmarks continue to measure the feature without affecting default behavior

**References:**
- `src/retrieval/ranker.js` (centrality blend implementation)
- `src/config/defaults.js` (default `false` setting)
- Issue [#703](https://github.com/manojmallick/sigmap/issues/703) (re-measure and decide on enabling)