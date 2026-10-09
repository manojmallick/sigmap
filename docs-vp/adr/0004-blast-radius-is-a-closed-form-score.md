---
title: "ADR 0004 — Blast radius is a closed-form score"
description: How SigMap scores the reach of a change, why it is a documented formula rather than a learned one, and the honest gap in how the weights were chosen.
---

# ADR 0004 — Blast radius is a closed-form score: `min(100, 4 × direct + 1 × transitive)`

| | |
|---|---|
| **Status** | Accepted |
| **Recorded** | 2026-10-09 ([#930](https://github.com/manojmallick/sigmap/issues/930)); the formula shipped in v8.13.0 ([#468](https://github.com/manojmallick/sigmap/issues/468)) |
| **Applies to** | `review-pr` (the `method-blast` finding) and the PR Evidence report. MCP `get_method_impact` lists a symbol's callers but does not compute this score |

## Context

A reviewer or an agent about to edit a file needs to know how far the change reaches. SigMap already answered at file level — which files import this one. The question was how to say *how much* in a way that can sit in a CI gate.

## Decision

There are two layers, and only the second weights anything.

- **File level** — [`src/graph/impact.js`](https://github.com/manojmallick/sigmap/blob/main/src/graph/impact.js) walks the reverse import graph breadth-first and reports the *direct* importers and the *transitive* ones as lists. Its total is a plain count.
- **Method level** — [`src/graph/blast-radius.js`](https://github.com/manojmallick/sigmap/blob/main/src/graph/blast-radius.js) takes the functions a changed file defines, walks the reverse call graph, and scores:

  `score = min(100, 4 × direct callers + 1 × transitive callers)`

  | Score | Tier |
  |---|---|
  | 0 | none |
  | 1–9 | low |
  | 10–29 | medium |
  | 30–59 | high |
  | 60 and up | critical |

  A `high` or `critical` file raises a `method-blast` finding in `review-pr`.

## Why

1. **A formula anyone can recompute.** Every number is arithmetic on two counts a reviewer can list; the PR Evidence report names the first 6 impacted functions and `review-pr --json` carries up to 12. There are no learned weights and no run-to-run variance, so `review-pr` findings and PR Evidence lines are byte-stable for a fixed tree (the test asserts two runs deep-equal).
2. **Direct callers are weighed above transitive ones** — evidently because they are the functions that call the changed code itself, though the repository records no reason. How much more is the open question under Consequences.
3. **A score that can be wrong in a known direction beats one that cannot be inspected.** A reviewer who disagrees with a tier can see exactly which callers produced it.

## Consequences

- **The 4:1 ratio is a stated convention, not a fitted value.** Nothing in the repository records how 4 was chosen or checks it against real regressions. The tiers are labels on that convention, and a reader should treat them that way.
- **It saturates.** Twenty-five direct callers already score 100, so a large reach and a very large one are indistinguishable by score (the evidence line still prints the function count).
- **It counts callers, not importance.** Test callers count toward the score and are also reported separately, so a heavily tested leaf can read higher than a barely tested hub.
- **It is only as good as the call graph,** which is built by dependency-free regex and brace/indent matching in `src/graph/call-graph.js`, sharing the scanner's masking with the extractors ([ADR 0002](/adr/0002-hand-written-extractors-no-tree-sitter)). Dynamic dispatch, reflection and cross-language calls are invisible to it.
- **Unknown is flagged, with a caveat.** When no call graph can be built, or no changed file defines a function in it, the result is `available: false`; its `aggregate` is zeroed, and `review-pr` ignores it rather than reporting a score.

## Evidence

- `src/graph/blast-radius.js`: `DIRECT_WEIGHT = 4`, `TRANSITIVE_WEIGHT = 1`, `tierFor`.
- `test/integration/method-blast-radius.test.js`: the documented thresholds, two-run determinism, and graceful degradation on an empty directory.
- [CLI reference](/guide/cli): the `method-blast` finding.
- Not recorded: any calibration of the 4:1 ratio.

## Revisit when

Comparing `method-blast` findings with the defects that later appeared in the same files shows a different ratio would separate them better, or saturation hides a distinction reviewers need. Changing a weight or a threshold changes tiers in existing reports, so it is a behaviour change and needs its own record.
