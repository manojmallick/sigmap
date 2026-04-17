---
title: judge
description: Use sigmap judge to score groundedness of an AI answer against the context file it used, with optional opt-in learning.
---
# judge

`sigmap judge` tells you whether an answer appears to be supported by the context you actually supplied.

```bash
sigmap judge --response response.txt --context .context/query-context.md
sigmap judge --response response.txt --context .context/query-context.md --json
sigmap judge --response response.txt --context .context/query-context.md --learn
```

## What it reports

- **Groundedness** — overlap score between the answer and the source context
- **Support level** — high / medium / low based on groundedness ratio
- **Unsupported symbols** — tokens and claims that look weakly supported

This is a traceability check, not a truth oracle. It helps answer: *"Did this response come from the code I provided, or did the model drift?"*

## Typical output

```text
Groundedness       : 78%
Support level      : HIGH
Unsupported symbols: none
```

## Best input pairing

Use `judge` right after `ask`:

1. `sigmap ask "explain auth flow"`
2. Save the model answer to `response.txt`
3. `sigmap judge --response response.txt --context .context/query-context.md`

## Opt-in learning

With `--learn`, `judge` can apply a small local boost or penalty to the files referenced in the context headings:

- strongly grounded result → small boost
- weakly grounded result → small penalty
- middle band → no change

This learning is local-only and stored in `.context/weights.json`.

## When to use it

- reviewing AI-generated explanations
- checking whether a debugging suggestion is really grounded in the shown files
- grading prompt/response pairs in demos or release benchmarks
- feeding the [learning engine](/guide/learning) carefully instead of manually every time
