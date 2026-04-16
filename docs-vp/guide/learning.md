---
title: Learning and weights
description: Local-only ranking feedback in v5.2. Use sigmap learn and sigmap weights to reinforce helpful files and penalize misleading ones.
---
# Learning and weights

v5.2 adds a safe, local-only learning layer on top of the ranker.

Commands:

```bash
sigmap learn --good src/auth/service.js
sigmap learn --bad src/legacy/old-api.js
sigmap learn --good src/auth/service.js --bad src/legacy/old-api.js
sigmap weights
sigmap weights --json
sigmap learn --reset
```

## What it does

- boosts files that repeatedly help answer the task
- penalizes files that keep surfacing but mislead the answer
- stores the learned multipliers in `.context/weights.json`
- keeps the feedback local to the repo

## Why it is safe

- no networked learning
- no cross-repo sharing
- reset is one command away
- baseline behavior is still the normal ranker when no learned weights exist

## Reading the weights

`sigmap weights` prints the current learned multipliers in a human-readable table. `--json` returns the exact stored object.

Use it when you want to answer:

- Which files has the ranker learned to trust more?
- Did `judge --learn` actually change anything?
- Do I need to reset after a bad experiment?

## Best workflow

1. Start with [ask](/guide/ask)
2. Check coverage with [validate](/guide/validate) if needed
3. Score the answer with [judge](/guide/judge)
4. Reinforce or penalize manually with `learn`, or use `judge --learn` when you want opt-in automation
