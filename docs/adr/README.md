# Architecture Decision Records

This directory contains ADRs for major design choices in SigMap. Each ADR records a deliberate, defensible, often counter-consensus decision so that evaluators and future maintainers can understand *why* the project is built this way.

## Index

- [ADR 0000 – Template](0000-template.md)
- [ADR 0001 – BM25 over Embeddings](0001-bm25-over-embeddings.md)
- [ADR 0002 – Tree-sitter Permanently Cut](0002-tree-sitter-cut.md)
- [ADR 0003 – No LLM in Deterministic Core](0003-llm-core-separation.md)
- [ADR 0004 – Blast-Radius Formula](0004-blast-radius.md)
- [ADR 0005 – Why Centrality Was Shipped Flag-Gated](0005-centrality-flag-gating.md)
- *(more ADRs to be added: Tree-sitter rejection, LLM-edge separation, blast-radius formula, centrality flag-gating)*

## Adding an ADR

1. Copy `0000-template.md` to the next number (e.g., `0002-*.md`).
2. Fill in the sections: Status, Context, Decision, Consequences, References.
3. Update this index.
