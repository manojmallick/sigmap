---
title: Architecture Decision Records
description: Architecture Decision Records for SigMap — the reasoning behind key design choices.
head:
  - - meta
    - property: og:title
      content: "Architecture Decision Records — SigMap"
    - - meta
    - property: og:description
      content: "The reasoning behind SigMap's key design choices: BM25 over embeddings, no Tree-sitter, no LLM in the core, blast-radius formula, and centrality flag-gating."
---

# Architecture Decision Records

This directory contains ADRs for major design choices in SigMap. Each ADR records a deliberate, defensible, often counter-consensus decision so that evaluators and future maintainers can understand *why* the project is built this way.

## Index

- [ADR 0001 – BM25 over Embeddings](https://github.com/manojmallick/sigmap/blob/develop/docs/adr/0001-bm25-over-embeddings.md)
- [ADR 0002 – Tree-sitter Permanently Cut](https://github.com/manojmallick/sigmap/blob/develop/docs/adr/0002-tree-sitter.md)
- [ADR 0003 – No LLM in Deterministic Core](https://github.com/manojmallick/sigmap/blob/develop/docs/adr/0003-llm-core.md)
- [ADR 0004 – Blast-Radius Formula](https://github.com/manojmallick/sigmap/blob/develop/docs/adr/0004-blast-radius.md)
- [ADR 0005 – Why Centrality Was Shipped Flag-Gated](https://github.com/manojmallick/sigmap/blob/develop/docs/adr/0005-centrality.md)

## Template

Use [ADR 0000 – Template](https://github.com/manojmallick/sigmap/blob/develop/docs/adr/0000-template.md) for new decisions.