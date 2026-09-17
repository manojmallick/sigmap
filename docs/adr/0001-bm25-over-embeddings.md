# ADR 0001 – BM25 over Embeddings

**Status:** Accepted

**Context:**
- SigMap aims to be deterministic, zero‑dependency, and offline‑first.
- Embedding models introduce non‑determinism, large model files, and external API costs.

**Decision:**
- Use an identifier‑aware BM25 ranking algorithm as the base relevance signal, modulated by keyword/symbol/path weights, dependency‑graph and centrality boosts, and learned file weights — see `src/retrieval/ranker.js` and `src/retrieval/bm25.js`.
- This approach guarantees byte‑stable results, zero external dependencies, and fast execution.

**Consequences:**
- No need for a vector database or embedding extraction pipeline.
- Future work may add optional embedding support behind a feature flag, but the default remains BM25.

**References:**
- `src/retrieval/bm25.js`
- Benchmark results in `docs-vp/guide/benchmark.md` and `benchmarks/latest.json`
- MASTER_PLAN §7.3 arithmetic: one embedding dependency adds ~200 MB, ~50 transitive deps, and collapses both the determinism and zero-dependency scores — the core reason BM25 was chosen and embeddings permanently rejected.
