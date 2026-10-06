---
title: judge
description: Use sigmap judge to score an AI answer's groundedness against the context it used — shared tokenizer, warnings instead of style failures, an inconclusive verdict, stdin input, and a per-claim report.
---
# judge

`sigmap judge` tells you whether an answer appears to be supported by the context you actually supplied.

```bash
sigmap judge --response response.txt --context .context/query-context.md
sigmap judge --response response.txt --json
claude -p "explain the auth flow" | sigmap judge       # stdin; --context defaults
sigmap judge --response response.txt --learn
```

## What it reports

- **Score** — how much of the answer's *technical* vocabulary the context grounds
- **Verdict** — `pass`, `fail`, or `inconclusive`
- **Confidence** — `high` / `medium` / `low`, with the basis it was derived from
- **Claims** — each concrete symbol / file / import claim, and how it resolved
- **Warnings** — hedging language and stale context; reported, never a verdict

This is a traceability check, not a truth oracle. It answers: *"Did this response come from the code I provided, or did the model drift?"*

## Typical output

```text
────────────────────────────────────────────
 sigmap judge
 Score     : 0.75
 Verdict   : pass
 Confidence: medium (1 claim(s) checked · structural pass ran · score margin 0.5 · generic phrasing present)
 Context   : .github/copilot-instructions.md (default — no --context given)
 Claims    : 1/1 grounded (1 context, 0 repo)
 Reasons   : none
 Warnings  :
   response contains generic phrase: "typically,"
────────────────────────────────────────────
```

On a failure the per-claim table prints too, so you can see which claim broke without re-running with `--json`:

```text
 Claims    : 1/2 grounded (1 context, 0 repo)
 Checked   :
   ✗ symbol computeQuantumScore() — not grounded
   ✓ file   src/security/scanner.js — context
```

## What the score measures

Since **v8.54.0** the score counts **technical** vocabulary, not English. `judge` shares the ranker's tokenizer, so camelCase and snake_case identifiers are split and stemmed, and ordinary-English words are dropped from both sides before scoring.

That fixed two reproducible false failures: an answer whose every claim was grounded used to fail at `0.212` simply for containing prose (it now scores `0.643`), and `buildEvidencePack` used to score `0.750` where `build evidence pack` — the same fact — scored `0.333` (they now score identically).

## How a claim is grounded

Each concrete claim — a `symbol()` call, a file path, an import — is grounded in one of two ways, and `Checked` says which (`context` or `repo`):

- **The context quotes it.** A claim is grounded when its text appears anywhere in the context. This is all the library API does when it is called without a `cwd`, and nothing changed there.
- **The repo proves it.** `sigmap judge` always passes the working tree, so the same engine as [`sigmap verify`](/guide/verify-ai-output) also checks the claim against the real index, the disk and the installed libraries. A claim it resolves is grounded whether or not the context mentions it.

The two are not equal, and since #909 the verdict runs both ways. Once `verify` has *proved* a claim fake, a word that merely occurs in the context no longer grounds it — only evidence in the claim's own form does:

| Claim | Not enough (once verify has proved it fake) | Enough |
|---|---|---|
| `rank()` | the word `rank` in "to rank files by topic", or inside `rankFiles` | `rank(` or a definition (`def rank`, `function rank`, `rank = (…) =>`) |
| `lib/index.js` | the basename of `src/index.js` | a path ending in `lib/index.js`, such as `src/lib/index.js` |
| `app.cache` | `app.cache_utils` | `app.cache` as a whole token |

And an import `verify` *positively resolved* — a repo module, the standard library, a `go.mod` requirement — is grounded in any language, not only where a `package.json` exists. Before #909 a correct Go or Python answer failed for want of one: its module path (`example.com/fx/internal/rank`, `app.config`) is never quoted by a context, and the structural import check never ran. An import `verify` could not decide (a third-party Python package) is neither cleared nor flagged by the repo; it falls back to the context.

## Verdicts and exit codes

| Exit | Verdict | Meaning |
|---|---|---|
| `0` | `pass` | Score clears the threshold and every claim is grounded |
| `1` | `fail` | Below threshold, or a claim nothing grounds |
| `2` | `inconclusive` | Nothing to judge — empty response, empty context, or no scoreable tokens |

`inconclusive` exists so CI can tell a truncated or empty model output apart from a wrong one; `--learn` never learns from it. `0` and `1` are unchanged from earlier versions.

Hedging phrases (`typically,`, `in general`, …) are **warnings**, never a verdict — they cap confidence below `high` but cannot fail an otherwise grounded answer.

## Stale context

`judge` compares the context file's age against the sources it describes and warns when the ground has moved:

```text
 Warnings  :
   context is 3.2 day(s) older than src/retrieval/ranker.js — the answer is being judged against stale ground
```

## Complete workflow: ask → get answer → judge

**Step 1: Generate focused context**
```bash
sigmap ask "explain the auth flow"
# Creates: .context/query-context.md
```

**Step 2: Get an AI response and judge it**
```bash
# Pipe the model's answer straight in — no temp file needed
claude -p "explain the auth flow" | sigmap judge --context .context/query-context.md
```

Or judge a saved answer, letting `--context` default to the generated one:

```bash
sigmap judge --response response.txt
```

## Opt-in learning

With `--learn`, `judge` can apply a small local boost or penalty to the files referenced in the context headings:

- strongly grounded result → small boost
- weakly grounded result → small penalty
- middle band → no change
- `inconclusive` → never

The verdict threshold and the learn band are configurable per repo via the [`judge` config section](/guide/config#judge). This learning is local-only and stored in `.context/weights.json`.

## When to use it

- reviewing AI-generated explanations
- checking whether a debugging suggestion is really grounded in the shown files
- grading prompt/response pairs in demos or release benchmarks
- gating a CI step on answer groundedness (`pass`=0, `fail`=1, `inconclusive`=2)
- feeding the [learning engine](/guide/learning) carefully instead of manually every time
