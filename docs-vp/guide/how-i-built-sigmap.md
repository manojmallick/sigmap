---
title: How I built SigMap
description: The story behind SigMap — from hitting token limits daily in Amsterdam to building a continuous feedback loop with LLMs that improved the tool itself.
head:
  - - meta
    - property: og:title
      content: "How I built SigMap — the story behind zero-dependency AI context"
  - - meta
    - property: og:description
      content: "From daily token exhaustion to a self-improving feedback loop. How one engineer in Amsterdam built a tool to fix his own LLM frustration."
  - - meta
    - property: og:url
      content: "https://manojmallick.github.io/sigmap/guide/how-i-built-sigmap"
---

# How I built SigMap

*A story about hitting limits, chasing minimum viable context, and letting LLMs improve themselves.*

---

## The daily frustration

It started with a familiar pattern.

I'd open a chat with an LLM — Claude, GPT-4, whatever was available — paste in some code, ask a question, and wait. Half the time I'd hit a token limit mid-response. The other half, the model would answer confidently about code it had never actually seen, hallucinating functions that didn't exist, referencing files I hadn't shared.

Every session followed the same arc:

```
1. Open chat
2. Paste what feels like enough context
3. Get a wrong answer (or a truncated one)
4. Paste more context
5. Hit token limit
6. Start over in a new session
7. Repeat
```

This wasn't a one-off. This was **every single day**, working on real projects in Amsterdam. Codebases that had hundreds of files. Repos where "just paste the relevant code" is deceptively hard advice.

The cost was real: not just money, but time and attention. Each failed interaction was a context switch. Each retry was a minute lost. Each hallucinated function name was a trust erosion moment with the tool I was relying on.

::: info The numbers behind the frustration
The average codebase I worked with had ~972K tokens of raw source. GPT-4o input pricing at the time meant a single "paste everything" approach cost **$4.86 per query**. At 50 queries a day, that's $7,288/month — before counting the interactions that failed and needed retrying.
:::

---

## The insight

At some point I stopped asking "how do I get the LLM to answer better?" and started asking a different question:

> **What is the minimum amount of information the LLM needs to give the right answer?**

That reframe changed everything.

The problem wasn't that the models were bad. The problem was the input. I was sending noise — giant files, unrelated functions, whole modules the model didn't need. The signal was buried.

The insight was almost embarrassingly simple:

- **LLMs don't need your code.** They need your *structure*.
- A function signature tells an LLM almost everything it needs to navigate a codebase.
- `function loginUser(email: string, password: string): Promise<Token>` is infinitely more useful than the 80-line implementation body below it.

If you give an LLM the right 5 files — just their signatures — you get a better answer than if you paste your entire repo. Every time.

```
Full repo (972K tokens)  →  wrong file, hallucinated functions, $4.86/query
Signatures only (450 tokens)  →  right file, grounded answer, $0.002/query
```

---

## Building the first version

The first version of SigMap was rough. A Node.js script, maybe 200 lines, that walked a TypeScript project and pulled out `function` and `class` declarations using a regex. It wrote them to a single file.

```js
// v0.1 — the whole thing, more or less
for (const line of src.split('\n')) {
  if (line.match(/^export\s+(function|class|interface)/)) {
    sigs.push(line.trim());
  }
}
```

It worked. Not well, but enough to prove the idea.

I ran it on a side project I was debugging, pasted the output into a Claude chat, asked my question, and got the right answer in one shot. No retries. No token overflow. The model knew exactly where to look because I had given it exactly the map it needed.

That moment was the first time I thought: *this could be something.*

---

## Refining with the LLMs themselves

Here's where it gets interesting.

My original plan was to write a better regex extractor for TypeScript, then move to Python, then Go. Iterate slowly. But I had a better resource available: the same LLMs I was building the tool to help.

I started using Claude to review the extractors. Not vaguely — I'd paste in a chunk of the extractor, paste in a file that wasn't being parsed correctly, and ask: *"What is this missing? What edge cases does this regex not handle?"*

The feedback was immediate and specific:
- Generic types like `function foo<T extends Bar>()` weren't captured
- Arrow function exports `export const handler = (req, res) =>` were invisible
- Class methods were missed when modifiers stacked: `public static async`
- Python decorators broke the indentation-based class detection

Each session produced a list of concrete fixes. I'd implement them, re-run the extractor on real codebases, paste the diff back, and ask: *"What's still wrong?"*

This loop — **build → test on real code → ask LLM for review → fix → repeat** — compressed months of hand-discovered edge cases into days.

::: tip The meta-pattern
I was using an LLM to improve a tool designed to make LLMs work better. Each improvement to the extractor produced better context, which produced better LLM reviews, which produced better extractors. A genuine compounding loop.
:::

---

## The retrieval problem

Once the extractors were solid, a new problem appeared: I had signatures for hundreds of files, but I was still handing all of them to the LLM. Better than raw source, but still too much.

I needed a way to rank files. Given a question like *"where is authentication handled?"*, which 5 files matter most?

The obvious answer was embeddings — a vector database, semantic search, cosine similarity. I tried it. It worked fine. It also required:

- An embedding model (API key)
- A vector store (infrastructure)
- A reindex pipeline (maintenance)
- Network access (no offline usage)

I wanted none of that. SigMap runs on `npx`. Zero dependencies. No accounts.

The less obvious answer was **TF-IDF** — a decades-old information retrieval technique that counts how often query terms appear in a document, weighted by how rare those terms are across all documents.

```
score(file, query) = Σ tf(term, file) × idf(term, all_files)
```

It sounds too simple. It isn't. TF-IDF on function and class names — not prose, not comments, just identifiers — turned out to be surprisingly effective. When you're searching for "authentication", the file with `authenticateUser`, `validateToken`, `hashPassword` in its signature index scores massively higher than a utility file with `formatDate` and `parseQuery`.

The retrieval benchmark confirmed it: **80.0% hit@5** — the right file in the top 5 results, 5.9× better than random baseline.

---

## After release: using LLMs to judge the tool itself

The first public release was humbling. Real users had real codebases that broke things in ways I hadn't anticipated. Monorepos. Nx workspaces. Projects where the source wasn't under `src/`. Files that were valid TypeScript but tripped the extractor.

I needed a systematic way to measure improvement, not just feel it.

This is when I built `sigmap judge`.

The idea: after running `sigmap ask` and getting an AI answer, you can score that answer for *groundedness* — how much of it is traceable back to the signatures SigMap surfaced. If the model is referencing functions that appear in the context, it's likely giving a real answer. If it's hallucinating, the identifiers won't match.

```bash
sigmap judge --response answer.txt --context .context/query-context.md
# Score: 0.301 ✅ PASS — response references your actual code
```

I then used this as a feedback signal for the tool itself. For every improvement I shipped — better extractor, better ranking, graph boosting — I ran the benchmark suite and checked whether groundedness scores went up across a set of test queries on real open-source repos.

The benchmark became a mirror. If I thought I'd improved the tool, the numbers told me whether I actually had.

```
v5.0 baseline        hit@5: 66.7%   task success: 38%
v5.8 + intent        hit@5: 76.7%   task success: 47%
v6.0 + graph boost   hit@5: 80.0%   task success: 52%
```

Each iteration: implement → benchmark → compare → decide what to do next.

---

## The graph boost

One of the more satisfying moments was discovering a simple improvement that had a measurable effect.

After TF-IDF ranking, the top-5 files are often the *direct* answer files. But they miss the files those files depend on — imports, shared types, shared utilities. The LLM would get the right function but not the types it operates on, or not the helpers it calls.

The fix: after scoring, build a dependency graph from import statements. Any file that is a 1-hop neighbour of a top-scoring file gets a +0.4 bonus.

```
auth/service.ts     score: 1.8  ← directly matches query
auth/token.ts       score: 0.4 + 0.4 graph bonus = 0.8  ← imported by service.ts
utils/crypto.ts     score: 0.1 + 0.4 graph bonus = 0.5  ← imported by token.ts
```

It took about two hours to build. The benchmark moved from 76.7% to 80.0% hit@5.

Those 3.3 percentage points across 90 benchmark tasks represent real queries where the right file was now in the top 5 when it wasn't before.

---

## The feedback loop that runs everything

If I had to summarise the entire development of SigMap in one diagram, it would be this:

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│   Build a feature                                       │
│        ↓                                               │
│   Run benchmark suite on 18 real repos                  │
│        ↓                                               │
│   Ask LLM: "What edge cases does this miss?"            │
│        ↓                                               │
│   Fix the edge cases                                    │
│        ↓                                               │
│   Re-run benchmark                                      │
│        ↓                                               │
│   Did numbers improve? → Ship                           │
│   Did numbers stay flat? → Rethink                      │
│   Did numbers regress? → Revert                         │
│        ↓                                               │
│   Repeat                                               │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

The LLM is not a vibe check. It's a reviewer with no ego, infinite patience, and an encyclopaedic knowledge of edge cases. The benchmark is the ground truth. Between them, they replaced what would have taken months of user feedback with a loop I can close in an afternoon.

---

## What I learned

**1. The right abstraction beats raw power.**
A signature index at 450 tokens outperforms a full codebase at 972K tokens. Less, structured correctly, wins.

**2. Determinism is underrated.**
Every AI-adjacent tool I saw used embeddings, neural ranking, or black-box models. SigMap uses TF-IDF: same input, same output, every time. You can read the score. You can understand why a file ranked where it did. Debugging a deterministic system takes minutes. Debugging a semantic search doesn't.

**3. Feedback loops compound.**
The investment in `sigmap judge` and the benchmark suite paid back in every subsequent release. Good measurement is worth more than good ideas. You can generate ideas endlessly; you can only evaluate them as fast as your feedback loop allows.

**4. Zero dependencies is a constraint that makes you smarter.**
Every time I wanted to reach for a library, I had to figure out how to do it in plain Node.js. Every one of those constraints produced a simpler design. The extractor is a hand-written recursive descent parser. The ranker is basic linear algebra. The cache is a JSON file. The MCP server is JSON-RPC over stdio. None of it is clever — it's all just direct.

**5. The users are the benchmark.**
Early on I optimised for metrics I could measure in isolation. Then I watched someone use it for the first time and realised the most important metric wasn't hit@5 or token reduction — it was *how many prompts until they got what they needed*. That's a harder number to measure but it's the one that matters.

---

## Where it is now

SigMap today is what I wished existed two years ago:

| Feature | What it does |
|---|---|
| **Signature extraction** | 29 languages, zero dependencies, milliseconds |
| **Focused retrieval** | 80.0% hit@5 across 90 tasks on 18 real repos |
| **Graph boosting** | Import-aware ranking for multi-file answers |
| **Groundedness scoring** | Detect hallucinations before they reach production |
| **Learned weights** | Files that helped you rank higher next time |
| **MCP server** | 9 tools for Claude Code, Cursor, Windsurf |
| **Incremental cache** | Re-runs in milliseconds on unchanged files |

And still: zero npm dependencies. Works offline. Runs on `npx`.

---

## Why I open-sourced it

Partly because the tool deserves to exist beyond my own projects.

Partly because the feedback loop only gets better with more codebases, more edge cases, more language patterns that I'd never encounter in my own work.

But mostly because the problem I hit — *LLMs need context, but feeding them everything is broken* — is a problem every developer using AI tools faces every day. The solution shouldn't be locked behind a startup or a pricing tier.

If SigMap saves you one hour a week, it was worth building. If it saves you a subscription to a tool that does the same thing with more infrastructure, even better.

---

## What's next

The core idea — minimum viable context, structured correctly — has more room to grow.

Things I'm exploring:

- **Cross-session memory**: weights that persist across machines via a simple config format, so teams share what they've learned
- **Semantic diff mode**: when a PR lands, show only the signatures that *changed*, not the full context
- **Test coverage overlay**: surface which functions have no tests directly in the signature index
- **IDE-native**: deeper VS Code and JetBrains integration so the context is injected automatically, not manually

The feedback loop keeps running. If you find an edge case, open an issue. If a language isn't supported well, submit a test case. Every real-world codebase that breaks something teaches the extractor something new.

---

::: tip Want to try it?
```bash
npx sigmap
sigmap ask "where is auth handled?"
sigmap judge --response answer.txt --context .context/query-context.md
```
No install. No API key. Under 10 seconds.
:::

---

*Built in Amsterdam. Made to work everywhere.*

*— [Manoj Mallick](https://github.com/manojmallick)*
