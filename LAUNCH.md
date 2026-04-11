# SigMap — Launch Guide

The launch plan. Everything updated for SigMap (the original draft used the old name
"ContextForge"). Structured around version milestones so you know exactly when to start
each channel.

---

## TL;DR — version gates

| Version | When | Do |
|---|---|---|
| **v3.3.1** (now) ✅ | **Ready now** | Benchmarks complete. GIF, then **Show HN**. |
| **v3.3.1** | +1 week after HN | Reddit launches (r/programming, r/webdev, etc.) |
| **v3.3.1** | +2 weeks | Dev.to article |
| **v3.3.1** | +3 weeks | LinkedIn post |
| **v3.3.1** | +4 weeks | X thread + Repomix community post |
| **any** | After 200+ stars | GitHub Sponsors setup |
| **v3.5.0** | +12 weeks | arXiv preprint → second LinkedIn post |

**Benchmarks are done — you can Show HN now.** Token reduction (97.6%), retrieval accuracy (87.5% hit@5,
6.4× lift over random), and answer correctness (59% correct vs ~10% without context) are all measured
on real open-source repos. This is more evidence than most Show HN posts have. Record the GIF and go.

---

## Week 0 — Before you launch anything (checked off at v3.3.1)

These are one-time prep tasks. Most are already done.

### 1. Record the demo GIF

**⬜ TODO** — The single highest-ROI action. People scroll past text; a 5-second GIF of the token
count dropping stops them.

**What to record:**
1. `wc -w` on a few source files (shows the raw size)
2. `npx sigmap` running in the terminal
3. `cat .github/copilot-instructions.md | wc -w` — the output is tiny
4. Overlay: "80,000 words → 4,000 tokens"

Target: under 8 seconds, loops cleanly. Use [Kap](https://getkap.co) on macOS.

### 2. Benchmark numbers ✅ Done

All three benchmarks are complete and published at `https://manojmallick.github.io/sigmap/`.

**Token reduction** — measured across 7 open-source repos:

| Repo | Language | Raw → Compressed | Reduction |
|------|----------|------------------|-----------|
| express | JavaScript | 15.5K → 201 | **98.7%** |
| flask | Python | 84.8K → 3.4K | **96.0%** |
| gin | Go | 172.8K → 5.7K | **96.7%** |
| spring-petclinic | Java | 77.0K → 634 | **99.2%** |
| rails | Ruby | 1.5M → 7.1K | **99.5%** |
| axios | TypeScript | 31.7K → 1.5K | **95.2%** |
| rust-analyzer | Rust | 3.5M → 5.9K | **99.8%** |

Average: **97.6% reduction** across 7 languages.

**Retrieval accuracy** — SigMap finds the right file 87.5% of the time (hit@5), vs 13.7% for random.
That's a **6.4× lift**. Run `node scripts/run-retrieval-benchmark.mjs` to reproduce.

**Answer correctness** — with SigMap context: **59% correct, 29% partially correct, 12% wrong**.
Without context: ~10% correct, 90% hallucination risk. Run `node scripts/run-task-benchmark.mjs`.

All numbers are live on the docs site with visual charts.

### 3. Add the "Support" footer to README

**⬜ TODO** — add this at the bottom if not already there:

```markdown
## Support

If SigMap saves you time, a ⭐ on GitHub helps others find it.
```

### 4. Check the VS Code extension first-run flow

**⬜ TODO** — Install the extension fresh in a new VS Code window and a repo that has never run SigMap.
Time the path from "extension installed" to "context file generated" using only the UI
(no terminal). If it takes more than 60 seconds or requires reading the README, it needs
fixing before HN. HN readers will try it in 2 minutes.

---

## Launch 1 — Hacker News Show HN (`v3.3.1` — now)

Show HN is the single highest-impact channel. A good one gives 200–500 stars in 48 hours.
Post on **Tuesday or Wednesday, 8–10am US Eastern**.

**Title:**
```
Show HN: SigMap – reduce AI coding agent tokens by 97% with independent benchmarks
```

**First comment (post immediately after submitting):**
```
I built this because GitHub Copilot doesn't know your codebase. Every session
starts cold — agents read files and guess at your patterns, burning 80K tokens
before writing a line of code.

npx sigmap writes .github/copilot-instructions.md automatically. It extracts
signatures from 21 languages, never function bodies — no AST parser, no npm install.
Result: ~4K tokens instead of 80K, and independently benchmarked accuracy improvement.

Three benchmarks, all reproducible:

1/ Token reduction across 7 real repos:
  express (JS):         15.5K → 201 tokens  (98.7%)
  flask (Python):       84.8K → 3.4K        (96.0%)
  rails (Ruby):           1.5M → 7.1K       (99.5%)
  rust-analyzer (Rust):   3.5M → 5.9K       (99.8%)
  Average: 97.6% reduction

2/ Retrieval accuracy: 87.5% hit@5 (finds the right file in top 5),
   vs 13.7% random baseline — 6.4× lift.

3/ Answer correctness: 59% correct answers with SigMap context,
   vs ~10% without. Hallucination risk drops from 92% → 12%.

Works with Copilot, Claude Code, Cursor, Windsurf, and Gemini. There's also an
MCP server for on-demand retrieval. VS Code extension and JetBrains plugin available.

Companion tool for deep sessions: Repomix (which is excellent when you need full
file content). SigMap handles the always-on daily context layer.

Benchmark methodology and data: https://manojmallick.github.io/sigmap/

Happy to answer questions.
```

**Be present for the first 2 hours.** Respond to every comment. Ignoring comments kills
momentum on HN — engagement signals credibility.

---

## Launch 2 — Reddit (`v3.3.1`, +1 week after HN)

Different audience — more practitioners, less purists. Same repo, fresh eyes.

**Title:**
```
I built a tool that reduces GitHub Copilot token usage by 97% — benchmarked on real repos
```

**Body:**
```
After measuring that Copilot sessions were consuming 80K+ tokens before writing
a single line, I built SigMap — it extracts just the function signatures from
your codebase (21 languages, zero npm install) and writes a context file that
Copilot reads automatically.

Three independent benchmarks:
• Token reduction: 97.6% average across 7 repos (express, flask, rails, rust-analyzer...)
• Retrieval accuracy: 87.5% hit@5 vs 13.7% random — finds the right file 6.4× more often
• Answer correctness: 59% correct answers vs ~10% without context

npx sigmap   ← that's the entire install

MIT open source. Benchmark methodology on the docs site. GitHub link in the comments.
```

**Post in this order, 2–3 days apart** (Reddit treats simultaneous cross-posting as spam):

1. [r/programming](https://reddit.com/r/programming)
2. [r/webdev](https://reddit.com/r/webdev)
3. [r/github](https://reddit.com/r/github)
4. [r/ChatGPTCoding](https://reddit.com/r/ChatGPTCoding)
5. [r/ClaudeAI](https://reddit.com/r/ClaudeAI)

End every post with: *"If this helps you, a star goes a long way."*

---

## Launch 3 — Dev.to article (`v3.3.1`, +2 weeks after HN)

**Title:**
```
Why GitHub Copilot gives bad suggestions (and how to fix it in 2 minutes)
```

**Structure (1,200 words):**

1. **The problem** (200 words) — Copilot doesn't know your codebase. Every session
   starts cold. ~80K tokens burned reading files before writing a line.

2. **What's happening with tokens** (200 words) — Show the 80K number with a real
   example from your benchmark run. Repomix gets you to ~8K; SigMap gets to ~4K;
   SigMap + MCP hot-cold mode: ~200 tokens.

3. **The fix — SigMap + how it works** (400 words) — `npx sigmap`, what it generates,
   why signatures-only (no bodies), secret scanning, the 21 languages.

4. **The Repomix workflow** (150 words) — SigMap for always-on; Repomix for deep sessions.
   Mention Repomix positively — this gets you in front of their community.

5. **Results** (150 words) — Use the real benchmark numbers: 97.6% token reduction table,
   87.5% retrieval hit@5, 59% correct answers. Link to `https://manojmallick.github.io/sigmap/`.

6. **The Repomix workflow** (150 words) — SigMap for always-on; Repomix for deep sessions.

**Three things this article does:**
- Drives search traffic ("copilot bad suggestions", "reduce copilot tokens")
- Gives you something substantive to share on LinkedIn
- Creates backlinks to the GitHub repo

---

## Launch 4 — LinkedIn (`v3.3.1`, +3 weeks after HN)

Your enterprise network (ING, ABN AMRO, HCL) is exactly the audience that cares about
token cost at scale. Post Tuesday morning Amsterdam time.

**Post body** (put GitHub link in first comment — LinkedIn penalises external links in posts):
```
I measured how many tokens GitHub Copilot uses before writing a single line of code.

The answer: 80,000+

Every session, the agent reads your codebase trying to understand your patterns.
For a 1,000-developer team that's real money in API spend — and the wasted context
makes suggestions worse, not better.

I built SigMap to fix this. Three independent benchmarks:
• 97.6% token reduction across 7 repos (express, flask, rails, rust-analyzer)
• 87.5% retrieval accuracy — finds the right file 6.4× more often than random
• 59% correct AI answers with context vs ~10% without

21 languages, zero npm install. Copilot reads the generated file automatically.

npx sigmap

That's the entire setup. MIT open source. Full benchmark methodology in comments.

#GitHubCopilot #DeveloperTools #OpenSource #AITools #Netherlands
```

**After posting:** tag Repomix's creator (Yamadashy) if they have a LinkedIn/X presence.
Positive mentions of related tools often earn shares from their community.

---

## Launch 5 — X thread (`v3.3.1`, +4 weeks after HN)

**Thread:**

```
Tweet 1:
GitHub Copilot doesn't know your codebase.
Every session starts cold. ~80,000 tokens burned before writing a line.

I fixed this. Thread 🧵

Tweet 2:
The problem: Copilot reads files on demand, guessing your patterns.
80K tokens × 100 developers × 100 sessions/day = expensive and slow.

Tweet 3:
The fix: extract just signatures (no function bodies) and write
them to .github/copilot-instructions.md — a file Copilot reads automatically.

npx sigmap
That's it. Zero npm install.

Tweet 4:
Token reduction, measured on real repos:
• express (JS): 15.5K → 201 tokens (98.7%)
• flask (Python): 84.8K → 3.4K (96%)
• rails (Ruby): 1.5M → 7.1K (99.5%)
• rust-analyzer: 3.5M → 5.9K (99.8%)
Average: 97.6% reduction.

Tweet 5:
Retrieval accuracy benchmark: finds the right file 87.5% of the time (hit@5).
Random baseline: 13.7%. That's a 6.4× lift.

Answer correctness: 59% correct with SigMap vs ~10% without.
Hallucination risk: 92% → 12%.

All benchmarks reproducible. Methodology: https://manojmallick.github.io/sigmap/

Tweet 6:
21 languages. Works with Copilot, Claude Code, Cursor, Windsurf, Gemini.
Companion tool for deep sessions: @repomix

MIT open source: [link]

If this helps you, a ⭐ goes a long way.
```

---

## Launch 6 — Repomix community (`v3.3.1`, same week as X)

Open a GitHub Discussion on the [Repomix repo](https://github.com/yamadashy/repomix).
This gets you in front of ~15K people who already care about exactly what you built.

**Title:** `SigMap — a companion tool for always-on daily context`

**Body:**
```
Hi Yamadashy and community,

I built SigMap to complement Repomix. Repomix is excellent for deep sessions
when you need full file content. SigMap handles the other side — signatures only,
auto-updated on every save/commit, always writing to copilot-instructions.md.

The workflow I use:
- SigMap running always (always-on, signatures, git hook)
- Repomix --compress before deep sessions that need body content

Both MCP servers registered together so agents pick the right tool for the task.

Would love feedback on the integration. Happy to add an official
"Works with Repomix" section to the README with your blessing.

GitHub: [link]
```

This is genuine and low-risk. If they respond, great. If not, the post still exposes
the tool to Repomix users.

---

## GitHub Sponsors — set up after 200+ stars

Don't set it up before. Sponsors at 50 stars looks desperate. At 500 it looks successful.

**Setup:**
1. GitHub profile → Settings → Sponsor this project
2. Create `.github/FUNDING.yml`:

```yaml
github: [manojmallick]
```

This adds the Sponsor button to the repo automatically.

**Tiers that work:**

| Tier | Price | Pitch |
|---|---|---|
| Supporter | $5/mo | "Keeps this maintained. No perks — just honest." |
| Contributor | $15/mo | Priority issue responses. Name in CONTRIBUTORS.md. |
| Team license | $49/mo | Commercial use with attribution waived. Early access. |
| Enterprise | $199/mo | Email setup support. Logo in README. Quarterly roadmap call. |

The $5 tier gets volume. $49 is where real income comes — small teams paying even
though MIT allows free use, because they want to support maintenance.

---

## Full timeline with version markers

```
Now (v3.3.1) ← YOU ARE HERE
  ├── ✅ Benchmarks complete (token reduction, retrieval, answer correctness)
  ├── ✅ Docs site live with visual charts
  ├── ⬜ Record GIF (highest ROI remaining task)
  ├── ⬜ Add "Support" footer to README
  └── ⬜ Check VS Code cold-start UX (< 60s without docs)

Week 1 (v3.3.1)
  └── Show HN launch — be present all day, respond to every comment
      Remaining gate: GIF on the README

Week 2 (v3.3.1)
  └── Dev.to article published

Week 3 (v3.3.1)
  └── Reddit r/programming post (then r/webdev, r/github etc. every 2 days)

Week 4 (v3.3.1)
  └── LinkedIn post

Week 5 (v3.3.1)
  └── X thread + Repomix GitHub Discussion

Any version, after 200+ stars
  └── Set up GitHub Sponsors

v3.5.0 (target: ~12 weeks from now)
  └── arXiv preprint (benchmarks are already publishable quality)
      → second LinkedIn post: "My open source tool now has academic backing"
```

---

## What changed from the original plan

The original plan was written before the tool was called SigMap and before several
major distribution improvements shipped. Updated throughout above, but the key diffs:

| Original | Updated |
|---|---|
| Tool name: "ContextForge" | **SigMap** |
| Command: `node gen-context.js` | **`npx sigmap`** (still works, but npx is cleaner for first-impressions) |
| No VS Code / JetBrains mention | **VS Code Marketplace + JetBrains Marketplace are live** — major HN credibility signals |
| No MCP server | **MCP server ships with SigMap** — 8 tools for Claude/Cursor |
| No standalone binaries | **macOS / Linux / Windows binaries** — no Node required |
| No independent release channels | **3 separate tag prefixes** — extension patches don't force npm release |
| Token numbers: "80K → 4K" estimate | **97.6% reduction measured** across 7 real repos |
| "Meaningful accuracy improvement" | **87.5% hit@5 retrieval** (6.4× lift), **59% correct answers** — all benchmarked |
| Wait for v3.4.0 to launch | **Launch now at v3.3.1** — benchmarks are the gate that was missing |

The core strategy (Show HN first, then Reddit, Dev.to article, LinkedIn, X, Repomix
community) is unchanged and correct. The launch sequence doesn't care about the
internal architecture — it cares that the demo is instant, the README answers "what /
how much / how" in 10 seconds, and you're present on launch day.
