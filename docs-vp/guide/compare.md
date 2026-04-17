---
title: compare and share
description: Use sigmap compare and sigmap share to show the before-vs-after story with live benchmark numbers.
---
# compare and share

`compare` and `share` are the demo-friendly commands in the v5.5 workflow.

```bash
sigmap compare
sigmap compare --json
sigmap share
```

## compare

`sigmap compare` shows the live before/after benchmark story:

- SigMap hit@5
- baseline hit@5
- lift multiplier
- token savings summary

Use it when you want to answer:

- "What is the current retrieval lift?"
- "How much smaller is the context with SigMap?"
- "Did the benchmark story change after this release?"

## share

`sigmap share` prints a short one-line summary for release notes, social posts, or benchmark screenshots.

Use it after re-running the benchmark matrix so you are not sharing stale numbers.

## Best practice

For launch-day numbers, use:

```bash
node scripts/run-benchmark-matrix.mjs --save --skip-clone
sigmap compare
sigmap share
```

That gives you synchronized JSON, HTML, and CLI output from the same benchmark snapshot.
