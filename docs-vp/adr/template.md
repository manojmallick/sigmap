---
title: ADR template
description: The template for an architecture decision record in this repository.
---

# ADR NNNN — Short title that states the decision

| | |
|---|---|
| **Status** | Accepted · Accepted with exceptions · Deprecated · Superseded by [NNNN](/adr/) |
| **Recorded** | YYYY-MM-DD, and the issue or PR that recorded it |
| **Applies to** | The commands, files or behaviour this governs |

## Context

What forced a choice? Name the options that were on the table, including the one you rejected. Two or three sentences.

## Decision

What SigMap does, in sentences that a test or a `grep` could confirm or refute. If part of the decision is "and not X", say X.

## Why

The reasons in order of weight. Each should be something a reader can check, not a preference.

## Consequences

What this costs. Name the inputs the decision gets wrong, the features it rules out, and any place the repository does not follow it. A record with no cost listed is incomplete.

## Evidence

- The file, test, benchmark report, issue or release note behind each claim above.
- Where a claim has no recorded basis, say "not recorded" here.

## Revisit when

The evidence that would reopen the decision — a measurement, a constraint changing, a use case arriving. If nothing could, say that, and say why.
