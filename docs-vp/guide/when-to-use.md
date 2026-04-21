---
title: When to use what — sigmap vs sigmap ask
description: Decision guide for choosing between sigmap (full context), sigmap ask (focused query), sigmap validate, and sigmap judge — with real token and cost numbers.
head:
  - - meta
    - property: og:title
      content: "When to use sigmap vs sigmap ask — Decision guide"
  - - meta
    - property: og:description
      content: "Know exactly which SigMap command to run for your situation. Full context vs focused ask, with real token numbers across 18 repos."
  - - meta
    - property: og:url
      content: "https://manojmallick.github.io/sigmap/guide/when-to-use"
---

# When to use what

SigMap has several ways to give your AI context. Picking the right one means less cost, faster answers, and more accurate results.

## The quick answer

| Situation | Command |
|-----------|---------|
| First time setting up a project | `npx sigmap` |
| Starting a new chat session | `sigmap` |
| Asking a specific question | `sigmap ask "..."` |
| Checking the AI gave a good answer | `sigmap judge` |
| Confirming the right files are covered | `sigmap validate` |
| Teaching SigMap your preferences | `sigmap learn` |
| AI agent (Claude Code, Cursor) | `sigmap --mcp` |
| CI/CD quality gate | `sigmap --ci` |

---

## sigmap — full context generation

```bash
npx sigmap          # first run
sigmap              # subsequent runs
sigmap --watch      # auto-regen on file save
```

**What it produces:** `.github/copilot-instructions.md` — signatures for your entire codebase, trimmed to the token budget.

**Use it when:**

- You're starting a session with Copilot, Cursor, or Windsurf and want the AI to know your whole codebase
- You've just made significant changes and the context is stale
- You want to set up context once and let the AI assistant read it automatically
- You're working across many parts of the codebase in one session

**Token cost across 18 real repos:**

| Repo | Raw source | Full context | Saving |
|------|---:|---:|---:|
| express | 136K | 972 | 99% |
| fastapi | 952K | 4,124 | 100% |
| rails | 4.7M | 29,640 | 99% |
| vue-core | 1M | 13,730 | 99% |
| **Average** | **972K** | **13,474** | **99%** |

**When NOT to use full context:**

- For a single specific question — use `sigmap ask` instead (it's 30× more focused)
- For tiny repos under 10K tokens — the overhead isn't worth it

---

## sigmap ask — focused query context

```bash
sigmap ask "where is authentication handled?"
sigmap ask "how does the retry logic work?"
sigmap ask "fix the race condition in UserService"
sigmap ask "explain the middleware stack" --json
```

**What it produces:** `.context/query-context.md` — only the top 5 most relevant files for your specific question.

**Use it when:**

- You have one specific question or task
- You want the cheapest possible context cost
- Your query is about one area of the codebase (auth, payments, routing)
- You're going to paste the context into a chat and ask a targeted question

**Token cost across 18 real repos:**

| Repo | Raw source | Ask context | Saving |
|------|---:|---:|---:|
| express | 136K | 112 | 100% |
| rails | 4.7M | 508 | 100% |
| laravel | 3.9M | 356 | 100% |
| gin | 170K | 452 | 100% |
| **Average** | **972K** | **450** | **100%** |

`sigmap ask` returns ~450 tokens on average — that's 30× smaller than full context and 2,000× smaller than raw source.

**Intent detection** — SigMap automatically adjusts scoring based on your query:

| Query contains | Intent | What changes |
|---|---|---|
| "fix", "bug", "error", "crash" | `debug` | Recently changed files ranked higher |
| "explain", "how does", "what is" | `explain` | Function names weighted more |
| "refactor", "clean", "improve" | `refactor` | File path matching boosted |
| "review", "check", "audit" | `review` | Exact token matches boosted |
| anything else | `search` | Standard scoring |

---

## Full context vs ask — choosing between them

```
sigmap ask "..."    →  450 tokens avg   →  use for specific tasks
sigmap              →  13,474 tokens avg →  use for whole-session context
```

**Choose `sigmap ask` when you know your question.** The focused context is more likely to contain exactly the right code, costs far less, and gives the AI a cleaner signal.

**Choose `sigmap` (full context) when the AI needs to explore.** If you're starting a session and may ask about many different areas, full context lets the AI navigate without asking you to re-run anything.

**Use both together:** Run `sigmap` once at session start, then use `sigmap ask` for each specific task within that session.

```bash
# Session start — give AI the lay of the land
sigmap

# Now ask focused questions
sigmap ask "where is rate limiting configured?"
# paste .context/query-context.md into your chat

sigmap ask "how does session expiry work?"
# paste new .context/query-context.md
```

---

## sigmap validate — confirm coverage

```bash
sigmap validate
sigmap validate --query "loginUser validateToken hashPassword"
sigmap --ci --min-coverage 85
```

**Use it when:**

- You want to confirm the right functions are actually in the context before sending it to an AI
- After `sigmap ask`, to check that the symbols you care about were captured
- In CI to enforce a minimum coverage gate on every pull request

**Typical output:**

```
✓ loginUser       found in src/auth/service.ts
✓ validateToken   found in src/auth/token.ts
✗ hashPassword    not found — may be in an excluded file
Coverage: 87%  Grade: B
```

**When NOT to use:** If you just ran `sigmap` and saw Grade A, you don't need to validate — it already passed.

---

## sigmap judge — score AI answer quality

```bash
sigmap judge --response answer.txt --context .context/query-context.md
sigmap judge --response answer.txt --context .context/query-context.md --threshold 0.5
sigmap judge --response answer.txt --context .context/query-context.md --learn
```

**Use it when:**

- The AI's answer looks plausible but you're not sure it came from your actual code
- You want to catch hallucinations — answers that sound right but reference non-existent functions
- You want to automatically boost the files that produced useful answers (`--learn` flag)

**How it scores:** Token overlap between the AI's response and your context file. A score above 0.25 (default threshold) means the answer is grounded in your code.

| Score | Verdict | Meaning |
|---|---|---|
| ≥ 0.25 | **pass** ✅ | Response references your actual code |
| < 0.25 | **fail** ❌ | Response may be hallucinated or generic |

**Workflow with `--learn`:**

```bash
# 1. Ask a question
sigmap ask "how does password hashing work?"

# 2. Get AI answer, save to file
echo "The AI's answer..." > answer.txt

# 3. Judge + auto-learn in one step
sigmap judge --response answer.txt --context .context/query-context.md --learn
# → boosts files the AI correctly used
# → next ask on similar topics will rank those files higher
```

---

## sigmap learn — shape future rankings

```bash
sigmap learn --good src/auth/service.ts src/auth/token.ts
sigmap learn --bad src/utils/legacy.ts
sigmap weights
```

**Use it when:**

- You've run `sigmap ask` several times and noticed which files were actually useful
- You want those files to rank higher automatically next time
- You want to de-prioritise files that keep showing up but aren't relevant

**How it works:** Multipliers stored in `.context/weights.json`. Boosts decay 5% per run so old preferences fade naturally. Maximum boost is 3×, minimum is 0.3×.

**Shortcut:** Use `sigmap judge --learn` to do this automatically after each answer — no manual file listing needed.

---

## sigmap --mcp — for AI agents

```bash
sigmap --setup     # register with Cursor, Windsurf, Zed once
sigmap --mcp       # agents call this automatically
```

**Use it when:**

- You're using Claude Code, Cursor, or any MCP-compatible agent
- You want the agent to retrieve only what it needs per tool call instead of reading everything upfront
- You want `query_context`, `explain_file`, `get_impact` available to your agent

**What changes:** Instead of the AI reading your full context file, it calls `query_context "..."` and gets back 450 tokens of exactly relevant code. Every tool call is surgical.

See the [MCP server guide](/guide/mcp) for setup details.

---

## sigmap --ci — automated quality gate

```bash
# In GitHub Actions / CI
npx sigmap --ci
npx sigmap --ci --min-coverage 85
npx sigmap --ci --json
```

**Use it when:**

- You want to enforce that context coverage doesn't regress on pull requests
- You want to catch when new files are added but not covered by signatures
- You want a build that fails if the AI context drops below a threshold

Exit 0 = coverage passes. Exit 1 = below threshold, build fails.

---

## Decision flowchart

```
Starting a session?
  └─ Yes → sigmap (full context)

Have a specific question?
  └─ Yes → sigmap ask "..."
       └─ Paste .context/query-context.md into chat
       └─ Not sure which files were relevant? → sigmap validate --query "..."
       └─ Got an AI answer? → sigmap judge --response answer.txt --context .context/query-context.md --learn

Using Claude Code or Cursor?
  └─ Yes → sigmap --setup then sigmap --mcp (agents call it automatically)

Running in CI?
  └─ Yes → npx sigmap --ci --min-coverage 85
```

---

## Cost comparison (gpt-4o, 50 queries/day)

| Approach | Avg tokens/query | Daily cost | Monthly cost |
|---|---:|---:|---:|
| Raw source files | 971,741 | $242.94 | $7,288 |
| `sigmap` full context | 13,474 | $3.37 | $101 |
| `sigmap ask` focused | 450 | $0.11 | $3 |

Numbers measured across 18 real open-source repos (express, rails, fastapi, gin, vue-core, laravel, and 12 more). [Full benchmark →](/guide/benchmark)
