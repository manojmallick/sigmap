---
title: ask
description: Use sigmap ask to turn a natural-language coding question into focused context, intent detection, coverage, cost, and risk in one command.
---
# ask

`sigmap ask` is the daily command in v5.5. It turns a natural-language coding question into a focused mini-context plus useful metadata.

```bash
sigmap ask "fix the login bug"
sigmap ask "explain the auth flow" --json
```

## What it does

`ask` combines several steps that used to be separate:

1. Detects the query intent (`debug`, `explain`, `review`, `refactor`, `search`)
2. Ranks files against the current signature index
3. Writes a focused context file to `.context/query-context.md`
4. Reports coverage, risk, and estimated cost

## Typical output

```text
Intent      : debug
Context     : .context/query-context.md
Coverage    : 96%
Risk        : LOW
Cost        : saved 98%
Top files   : src/auth/service.js, src/auth/token.js, src/http/middleware.js
```

## Best prompts to use

- `"explain the auth flow"`
- `"where is the middleware stack configured"`
- `"fix the race condition in UserService.findById"`
- `"review the retry logic in the queue worker"`

The more task-shaped the query is, the better the ranking signal becomes.

## JSON mode

Use `--json` when you want to feed the result into scripts, dashboards, or CI:

```bash
sigmap ask "explain the ranker" --json
```

The response includes the detected intent, ranked files, coverage, cost, and risk fields.

## Recommended follow-up

After `ask`, use:

- [validate](/guide/validate) when you want to sanity-check coverage
- [judge](/guide/judge) when you want to score whether an answer was actually grounded in that context
- [learning](/guide/learning) when you want to reinforce or penalize the files that helped
