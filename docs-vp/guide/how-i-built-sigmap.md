---
title: How I built SigMap
description: How I fixed the LLM context problem — deterministic AI code retrieval without embeddings, vector databases, or external services. 80% hit@5, 97% token reduction.
head:
  - - meta
    - property: og:title
      content: "How I built SigMap — fixing AI code retrieval without embeddings"
  - - meta
    - property: og:description
      content: "Most AI coding tools fail because they read the wrong files. Here's how I fixed that with deterministic retrieval, zero dependencies, and a continuous LLM feedback loop."
  - - meta
    - property: og:url
      content: "https://manojmallick.github.io/sigmap/guide/how-i-built-sigmap"
---

# How I built SigMap

Most AI coding tools fail for one reason:

**They read the wrong files.**

I built SigMap to fix that — without embeddings, vector databases, or external services.

---

## What SigMap does

Before the story, the outcome — so you know what you're reading toward:

| | Number |
|---|---|
| File retrieval accuracy | **78.9% hit@5** (vs 13.6% baseline — 5.8× lift) |
| Token reduction | **40–98%** across 18 real open-source repos |
| Task success rate | **52.2%** (vs 10% without context) |
| Prompts per task | **1.69** (down from 2.84) |
| Dependencies | **Zero** |

```bash
npx sigmap                        # generates context for your whole codebase
sigmap ask "where is auth handled?"  # ranked files, 450 tokens, right answer
```

No API key. No infrastructure. Works offline. Under 10 seconds.

---

## The problem I was hitting every day

Working on real projects in Amsterdam, I'd open a chat with Claude or GPT-4, paste in some code, ask a question, and hit one of two outcomes:

- Token limit mid-response. Start over.
- Confident answer referencing functions that didn't exist. Start over.

Every session followed the same arc:

```
1. Open chat
2. Paste what feels like enough context
3. Get a wrong answer (or truncated)
4. Paste more context
5. Hit token limit
6. Start new session
7. Repeat
```

This was the **LLM context problem** — and it was costing real time and money.

::: info The numbers behind the frustration
The average codebase I worked with had ~972K raw source tokens. A single "paste everything" approach costs **$4.86 per GPT-4o query**. At 50 queries/day: **$7,288/month** — before retries.
:::

The models weren't the problem. The input was.

---

## The aha moment

I stopped asking *"how do I get the LLM to answer better?"* and started asking:

> **What is the minimum information the LLM needs to give the right answer?**

That reframe changed everything.

**Example — codebase understanding query:**

```
Query: "Where is authentication handled?"

Without SigMap:
→ AI scans random files
→ Misses middleware, entry points, token utilities
→ Hallucinates functions, gives generic answer
→ Requires 2–3 follow-up prompts

With SigMap:
→ Ranks auth-related files by signature match
→ Surfaces auth/service.ts, auth/token.ts, middleware/auth.ts
→ AI answers using actual implementation, first try
→ 1.69 prompts on average vs 2.84
```

This is the difference between **guessing** and **grounding**.

The insight: **LLMs don't need your code. They need your structure.**

A function signature tells an LLM almost everything it needs to navigate a codebase:

```ts
// This 1 line replaces 80 lines of implementation body
export function loginUser(email: string, password: string): Promise<Token>
```

Signatures only, right files, right answer:

```
Full repo (972K tokens)  →  hallucinated functions, $4.86/query
Top 5 file signatures (450 tokens)  →  grounded answer, $0.002/query
```

---

## Building the first version

The first version was a 200-line Node.js script — a regex walking a TypeScript project, pulling out `function` and `class` declarations:

```js
// v0.1 — the whole thing, roughly
for (const line of src.split('\n')) {
  if (line.match(/^export\s+(function|class|interface)/)) {
    sigs.push(line.trim());
  }
}
```

It worked. Barely. But I ran it on a project I was debugging, pasted the output into Claude, and got the right answer in one shot. No retries. No overflow.

That was the proof. The rest was engineering.

---

## Why not embeddings?

The first thing everyone asks. I tried it.

| | Embeddings | SigMap |
|---|:---:|:---:|
| Infrastructure required | Vector DB | None |
| API key needed | Yes | No |
| Works offline | No | Yes |
| Deterministic results | No | Yes |
| Debuggable ranking | No | Yes |
| Drift over time | Yes (reindex) | No |

Embeddings gave me semantic search. SigMap gives me **deterministic AI code retrieval** — same input, same output, every time. You can read the score. You can explain why a file ranked where it did. When something goes wrong, you fix it in minutes instead of retraining.

The less obvious answer was **TF-IDF** — a decades-old information retrieval technique that scores query terms against document frequency. On function and class *identifiers* (not prose), it turns out to be remarkably effective:

```
score(file, query) = Σ tf(term, file) × idf(term, all_files)
```

When you search for "authentication", the file with `authenticateUser`, `validateToken`, `hashPassword` scores massively higher than `formatDate` or `parseQuery`. No embeddings. No model. Pure math.

::: tip Why determinism matters for LLM context
Non-deterministic retrieval fails silently — you get different files on different runs, can't reproduce a bug, can't explain why the AI answered wrong. Deterministic retrieval fails loudly: you see exactly which file scored, and why, and you can fix it.
:::

---

## Refining with the LLMs themselves

Here's where it gets interesting.

I used Claude to review the extractors. Not vaguely — I'd paste the extractor code, paste a file that wasn't parsed correctly, and ask: *"What edge cases does this miss?"*

The feedback was immediate:
- Generic types `function foo<T extends Bar>()` — not captured
- Arrow function exports `export const handler = (req, res) =>` — invisible
- Stacked modifiers `public static async` — class methods missed
- Python decorators — broke indentation-based detection

Each session: list of fixes. Implement. Re-run on real codebases. Paste diff back. Ask again.

This loop — **build → test → LLM review → fix → repeat** — compressed months of edge cases into days.

::: tip The meta-pattern
I was using an LLM to improve a tool designed to make LLMs work better. Better extractors → better context → better LLM reviews → better extractors. A genuine compounding loop.
:::

---

## Proof block

```
Benchmark: sigmap-v6.6-main
Date: 2026-04-30

Hit@5:              80.0%  (baseline 13.6%  — 5.9× lift)
Prompt reduction:   41.0%
Task success:       52.2%  (baseline 10%)
Prompts per task:   1.68   (baseline 2.84)
Token reduction:    40–98% (avg 96.8% across 18 repos)
```

Measured on 90 coding tasks across 18 real public repos. No LLM API. Fully reproducible.

[Full benchmark methodology →](/guide/benchmark)

---

## The feedback loop that runs everything

After release, I built `sigmap judge` — a groundedness scorer that checks whether an AI answer is traceable to the signatures SigMap surfaced:

```bash
sigmap judge --response answer.txt --context .context/query-context.md
# Score: 0.301 ✅ PASS — response references your actual code
```

I used this as a feedback signal for every subsequent improvement. The benchmark became a mirror:

```
v5.0  hit@5: 66.7%   task success: 38%   ← baseline
v5.8  hit@5: 76.7%   task success: 47%   ← intent detection added
v6.0  hit@5: 80.0%   task success: 52%   ← graph boosting added
```

The full loop:

```
Build a feature
  ↓
Run benchmark suite on 18 real repos
  ↓
Ask LLM: "What edge cases does this miss?"
  ↓
Fix the edge cases
  ↓
Re-run benchmark
  ↓
Numbers improved? → Ship
Numbers flat?     → Rethink
Numbers regressed? → Revert
  ↓
Repeat
```

Good measurement is worth more than good ideas. You can generate ideas endlessly; you can only validate them as fast as your feedback loop closes.

---

## One concrete win: graph boosting

TF-IDF finds the *direct* answer files. But it misses dependencies — the types, utilities, and helpers those files import. The LLM gets the right function but not the context around it.

Fix: after scoring, build a dependency graph from import statements. 1-hop neighbours of top-scoring files get a +0.4 bonus:

```
auth/service.ts     score: 1.8                    ← directly matches query
auth/token.ts       score: 0.4 + 0.4 (graph) = 0.8  ← imported by service.ts
utils/crypto.ts     score: 0.1 + 0.4 (graph) = 0.5  ← imported by token.ts
```

Two hours to build. Benchmark moved from 76.7% → 80.0% hit@5. That's 3.3 percentage points across 90 tasks — real queries where the right file now appears when it didn't before.

---

## What I learned

**1. The right abstraction beats raw power.**
450 tokens of signatures outperforms 972K of raw source. Less, structured correctly, wins.

**2. Determinism is underrated.**
Every AI-adjacent tool reached for embeddings and semantic search. TF-IDF on identifiers is transparent, debuggable, and reproducible. When it fails, you see exactly why.

**3. Feedback loops compound.**
The investment in `sigmap judge` and the benchmark paid back in every subsequent release. Measure right, improve fast.

**4. Zero dependencies forces clarity.**
Every time I wanted a library, I had to solve it in plain Node.js. The extractor is a hand-written parser. The ranker is linear algebra. The cache is a JSON file. None of it is clever — it's all just direct.

**5. The real metric is prompts per task.**
Not hit@5, not token reduction — *how many prompts until the user got what they needed*. That's the number that matters. Everything else is a proxy.

---

## Where it is now

| Feature | What it does |
|---|---|
| **Signature extraction** | 29 languages, zero dependencies, milliseconds |
| **Deterministic retrieval** | TF-IDF + graph boost, 78.9% hit@5 |
| **Groundedness scoring** | Catch hallucinations before they reach production |
| **Learned weights** | Files that helped rank higher next time |
| **MCP server** | 9 on-demand tools for Claude Code, Cursor, Windsurf |
| **Incremental cache** | Re-runs skip unchanged files |

Zero npm dependencies. Works offline. Runs on `npx`.

---

## Why I open-sourced it

The LLM context problem — *AI needs codebase understanding, but sending everything is broken* — is a problem every developer hitting AI tools faces every day. The solution shouldn't require a subscription, a vector DB, or an account.

If SigMap saves you one hour a week, it was worth building.

---

## Try it on your repo

```bash
npx sigmap
sigmap ask "where is auth handled?"
sigmap judge --response answer.txt --context .context/query-context.md
```

No install. No API key. No config. Run it on your repo and see which files it finds.

The difference between guessing and grounding is about 10 seconds.

---

*Built in Amsterdam. Made to work everywhere.*

*— [Manoj Mallick](https://github.com/manojmallick)*
