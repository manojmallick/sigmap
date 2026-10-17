---
title: ask
description: Use sigmap ask to turn a natural-language coding question into the ranked files and a focused context file in one command; --verbose adds intent detection, coverage, cost, and risk.
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
4. Prints the ranked files and one summary line — coverage, risk, and estimated cost are one flag away (`--verbose`, or `--json` for scripts)

## Typical output

```text
1  src/security/redact.js    14.289  131 tok
2  src/cache/entry.js        13.861  255 tok
3  src/security/scanner.js   12.916   39 tok
4  packages/core/index.js     9.235  220 tok
5  src/security/patterns.js   7.123   41 tok
5 of 529 files · cutoff 7.123 · 744 tokens · sha256:7e1624d83f1c → .context/query-context.md
```

Each row is a rank, a path, a score and the tokens that file's signatures cost in the index. The signatures themselves — with their `:start-end` line anchors — are in `.context/query-context.md`. The last line is what makes the result auditable: how many files were selected, where the cut fell, the size of the context and a hash of it. A second line appears only when something needs your attention, for example a file in the selection that has uncommitted changes.

For the full header — intent, coverage, risk and cost — add `--verbose`, which prints the same rows and then the box `ask` printed before v8.78.0 (the summary line is not repeated):

```text
1  src/security/redact.js    14.289  131 tok
2  src/cache/entry.js        13.861  255 tok
3  src/security/scanner.js   12.916   39 tok
4  packages/core/index.js     9.235  220 tok
5  src/security/patterns.js   7.123   41 tok
────────────────────────────────────────────
 sigmap ask  "how are secrets redacted"
 Intent    : search
 Context   : 744 tokens  →  .context/query-context.md
 Selected  : 5 of 529 file(s) (--top 5) · cutoff score 7.123
 Hash      : sha256:7e1624d83f1c
 Selection : 5 source
 Coverage  : readable 100% (205/205 files in srcDirs)
 Risk      : NONE (0 file(s) changed vs HEAD)
 Cost      : $0.0019/query  (was $0.0133 · saved 86%)
           est. @ gpt-4o $2.5/Mtok input as of 2026-10-04; cost tokens est. (chars/4); "was" = full ranked files
────────────────────────────────────────────
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
