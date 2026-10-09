---
title: "ADR 0001 — BM25 over embeddings"
description: Why SigMap ranks files with identifier-aware BM25 instead of embeddings, what that costs, and what would reopen the decision.
---

# ADR 0001 — Rank files with identifier-aware BM25, not embeddings

| | |
|---|---|
| **Status** | Accepted |
| **Recorded** | 2026-10-09 ([#930](https://github.com/manojmallick/sigmap/issues/930)); the decision predates it |
| **Applies to** | `sigmap ask`, `--query`, MCP `query_context` — everything that ranks files against a question |

## Context

Given a question, SigMap has to say which files matter. One common answer is to embed the code and rank by vector similarity. The alternative is lexical ranking over the signature index SigMap already builds.

## Decision

SigMap ranks with BM25 over identifiers ([`src/retrieval/bm25.js`](https://github.com/manojmallick/sigmap/blob/main/src/retrieval/bm25.js)), combined with keyword, symbol and path-token signals and a demotion of test, mock, docs and CI files unless the question asks for them ([`src/retrieval/ranker.js`](https://github.com/manojmallick/sigmap/blob/main/src/retrieval/ranker.js)). The MCP tool and the benchmarks add an import-graph neighbour boost; `sigmap ask` and `--query` run without one. Learned per-file multipliers from `.context/weights.json` apply locally. There is no embedding model, no vector store and no network call at query time.

## Why

1. **Same input, same output.** The ranking is a deterministic function of the repository, its configuration, the question and the local state under `.context/` (learned weights, notes), which benchmarks and CI switch off (`learned: false`). An embedding can differ across model versions, runtimes and hardware, and a hosted one is a network dependency. Reproducible rankings are what let CI gate on them and let two people compare results.
2. **Zero runtime dependencies.** A model, a client library or an index store is something to install or a service to reach. SigMap runs from `npx` with no further install and no key.
3. **Code questions are mostly lexical.** The meaning lives in identifiers. Plain TF-IDF missed `component emit` → `componentEmits.ts` because `componentEmits` is one token; splitting camelCase and snake_case, light stemming and a path-token boost fixed that without a model. On 85 curated tasks across 17 repositories, hit@5 went from 75.3% to 82.4% ([#395](https://github.com/manojmallick/sigmap/issues/395)).
4. **A ranking you can read.** `ask --explain` prints what scored, what was close and which signals drove the order ([#813](https://github.com/manojmallick/sigmap/issues/813)). A similarity score from an embedding has no such account.

## Consequences

- **A question that shares no word with its answer cannot be found by any method that matches words.** The records show how often: on the third-party corpus, 12 of the 41 misses at the last baseline share no token with the question; on the honest corpus, 4 of 13. This is the cost of the decision, and it is not hidden — the [retrieval benchmark](/guide/retrieval-benchmark) places every miss in exactly one class.
- **The semantic gap is attacked with deterministic means instead.** Curated query expansion (`expandQuery` in `bm25.js`), mined expansions and body words ([`retrieval.bodyWords`](/guide/config), opt-in; +15 tasks on the third-party corpus) all add vocabulary without a model. Mined expansions and body words (both opt-in) are held to the rule in [ADR 0005](/adr/0005-centrality-flag-gated-then-deprecated); the curated synonym groups in `bm25.js` are fixed and ship on.
- **No claim of semantic understanding.** SigMap does not paraphrase, and its documentation does not say it does.

## Evidence

- `src/retrieval/bm25.js` header: the four additions and the 75.3% → 82.4% result.
- [Retrieval benchmark](/guide/retrieval-benchmark): the `--why` miss classes, and "How far is 90%?" for the honest corpus (89.6%, 112 of 125) and the third-party corpus (50.6% as shipped, 42 of 83).
- `scripts/check-benchmark-determinism.mjs` ([#522](https://github.com/manojmallick/sigmap/issues/522)): runs a benchmark twice and fails on any difference in the reports.

## Revisit when

A mechanism closes the no-shared-word class **and** keeps output byte-identical **and** needs no dependency, shown on the third-party corpus rather than this repository's own. An embedding model cannot meet the second and third conditions, so a better embedding would not reopen this — a different mechanism would. The project's recorded position is that embeddings are rejected permanently; this section says what evidence would be needed to revisit that, not that a revisit is planned.
