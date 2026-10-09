---
title: Architecture decisions
description: The deliberate, counter-consensus decisions behind SigMap — no embeddings, no parser dependency, no LLM in the core — each with the reasoning, the evidence in the repository, and the condition that would reopen it.
---

# Architecture decisions

SigMap makes choices most tools in its space do not: it ranks with BM25 instead of embeddings, ships no parser, calls no model, and keeps shared state in a local text file. Each is a trade, and each has a cost this project pays on purpose.

An architecture decision record (ADR) is the short answer to *"why is it built this way, and what would change your mind?"* These pages write down decisions that were already made — in planning notes, issues and release notes that a reader outside the project cannot see — so the reasoning is public and checkable.

## How to read a record

Every record has the same parts, so a skeptic can go straight to the one they doubt.

| Part | What it answers |
|---|---|
| **Context** | What problem forced a choice, and what the options were |
| **Decision** | What SigMap does, stated so it can be tested |
| **Why** | The reasons, in order of weight |
| **Consequences** | What the decision costs, including the cases it gets wrong |
| **Evidence** | The file, test, benchmark or issue behind each claim — nothing here is asserted without one |
| **Revisit when** | The evidence that would reopen it. A decision with no such condition is a belief |

A record can be **Accepted**, **Accepted with exceptions** (the decision stands and the page lists where it does not), **Deprecated** (the thing it describes is on its way out) or **Superseded** by a later record. A record is never rewritten to hide that it changed; a later one points back at it.

## The records

| # | Decision | Status |
|---|---|---|
| [0001](/adr/0001-bm25-over-embeddings) | Rank files with identifier-aware BM25, not embeddings | Accepted |
| [0002](/adr/0002-hand-written-extractors-no-tree-sitter) | Hand-written extractors; SigMap ships no parser or grammar | Accepted with exceptions |
| [0003](/adr/0003-no-llm-in-the-deterministic-core) | No LLM call, and no network, on the path that produces SigMap's output | Accepted |
| [0004](/adr/0004-blast-radius-is-a-closed-form-score) | Blast radius is a closed-form score, `min(100, 4 × direct + 1 × transitive)` | Accepted |
| [0005](/adr/0005-centrality-flag-gated-then-deprecated) | The centrality ranking prior shipped behind a flag, was measured, and is deprecated | Deprecated |
| [0006](/adr/0006-append-only-local-ndjson-for-shared-state) | Cross-session state is local, append-only NDJSON — no daemon, socket or hosted store | Accepted |

## Adding one

Copy the [template](/adr/template). Number it next in sequence, keep it to one decision, and cite evidence that lives in the repository — a file, a test, a benchmark report or an issue. If the decision reverses an earlier record, mark the earlier one **Superseded** and link both ways; do not delete or reword it.

Two rules keep the records honest: state the cost of the decision as plainly as its benefit, and where a claim has no recorded basis, say so rather than supply one.
