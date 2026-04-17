---
title: validate
description: Use sigmap validate to check config health, context coverage, and whether important query symbols appear in the ranked results.
---
# validate

`sigmap validate` is the fastest way to check whether your current SigMap setup is healthy enough to trust.

```bash
sigmap validate
sigmap validate --json
sigmap validate --query "loginUser validateToken"
```

## What it checks

- config syntax and required paths
- source-directory coverage
- warning thresholds for low coverage
- optional query-symbol presence in the ranked results

## Why it matters in v5.5

The v5 workflow is not just "generate once and hope." `validate` tells you when the current context is too thin, stale, or misconfigured for reliable answers.

## Query validation

This is the most useful mode during active work:

```bash
sigmap validate --query "authenticate user session token"
```

That checks whether the important symbols from your query are likely to appear in the top-ranked context.

## Use in CI

```bash
sigmap --ci --min-coverage 80
```

That turns the same coverage logic into an exit gate for automation.

## Recommended follow-up

- Use [ask](/guide/ask) first when you want focused context
- Use [judge](/guide/judge) after an answer comes back
- Use [learning](/guide/learning) if the same files keep being helpful or misleading
