---
layout: home
title: SigMap — the deterministic, verifiable grounding layer for AI code work
description: SigMap builds a deterministic, auditable signature-and-evidence map that AI agents, CI, and reviewers can trust and verify. Zero dependencies, no embeddings, fully offline. Proof — 80.4% hit@5, 44.4% fewer prompts, 95.2% average token reduction, 38 languages with R support.
head:
  - - meta
    - property: og:title
      content: "SigMap — the deterministic, verifiable grounding layer for AI code work"
  - - meta
    - property: og:description
      content: "A reproducible signature-and-evidence map agents and CI can audit. Proof — 80.4% hit@5, 44.4% fewer prompts, 95.2% overall token reduction."
  - - meta
    - property: og:url
      content: "https://sigmap.io/"
  - - meta
    - property: og:type
      content: website
  - - meta
    - name: twitter:title
      content: "SigMap — the deterministic, verifiable grounding layer for AI code work"
  - - meta
    - name: twitter:description
      content: "A reproducible signature-and-evidence map agents and CI can audit. Proof — 80.4% hit@5, 44.4% fewer prompts, 95.2% overall token reduction."
  - - meta
    - name: twitter:image:alt
      content: "SigMap — the deterministic, verifiable grounding layer for AI code work"
  - - meta
    - name: keywords
      content: "sigmap, ai grounding layer, ai code grounding, deterministic context, evidence pack, grounded ai answers, code retrieval, mcp, sigmap ask, sigmap judge"

hero:
  name: SigMap
  text: Grounded context AI can trust. Deterministic. Verifiable.
  tagline: "The deterministic, verifiable grounding layer for AI code work. Proof — 80.4% hit@5 · 95.2% token reduction · zero deps, fully offline."
  actions:
    - theme: brand
      text: Get Started →
      link: /guide/quick-start
    - theme: alt
      text: Benchmark Report →
      link: /guide/benchmark
    - theme: alt
      text: GitHub
      link: https://github.com/manojmallick/sigmap

features:
  - icon: 💬
    title: Fewer prompts to finish the task
    details: "Latest saved run: 2.84 prompts without SigMap vs 1.58 with SigMap. That is a 44.4% reduction across 105 benchmark tasks, modeled from retrieval tiers rather than measured in live sessions."
    link: /guide/task-benchmark
    linkText: Task benchmark →
  - icon: 🎯
    title: Right file in context
    details: 80.4% hit@5 across 18 repos and 105 tasks. On the 125-task honest corpus SigMap scores 92.8% where a single-shot grep agent finds the right file 39.2% of the time — a measured 2.37× better.
    link: /guide/retrieval-benchmark
    linkText: Retrieval benchmark →
  - icon: ⚖️
    title: Trust the answer, not just the token count
    details: Use ask to build focused context, validate to check coverage, judge to score groundedness, and learn to reinforce the files that helped.
    link: /guide/judge
    linkText: Workflow docs →
  - icon: 🌐
    title: 38 languages, zero native deps
    details: TypeScript, Python, Go, Rust, Java, Kotlin, Ruby, PHP, Swift, C#, C++, Dart, Scala, Vue, Svelte, GraphQL, SQL, Terraform, R, GDScript, and more.
    link: /guide/languages
    linkText: Language support →
  - icon: 🔌
    title: MCP-ready and IDE-friendly
    details: Works with Copilot, Claude Code, Cursor, Windsurf, Codex, OpenCode, and Gemini CLI. Use MCP for dynamic query_context lookups on demand.
    link: /guide/mcp
    linkText: MCP setup →
  - icon: 📈
    title: One report for the full story
    details: Run the benchmark matrix once and open a self-contained HTML dashboard with token, retrieval, quality, and task metrics together.
    link: /guide/benchmark
    linkText: Benchmark overview →
---

<div style="max-width:840px;margin:0 auto;padding:18px 24px 0;text-align:center">
<div style="display:inline-flex;flex-wrap:wrap;gap:.5rem;justify-content:center;background:var(--vp-c-brand-soft,#ede9fe);border:1px solid rgba(124,106,247,.25);border-radius:999px;padding:.55rem .9rem;font-size:.9rem;color:var(--vp-c-text-1)">
  <span><strong>Release:</strong> v8.88.0</span>
  <span>·</span>
  <span><strong>New — a new install starts on the setup the agent study measured:</strong> <code>sigmap --init</code> now writes <code>strategy: "index"</code> and the two-tool <code>locate</code> MCP profile, on three pre-registered runs in Claude Code (cost −16.6% and −8.8% against no SigMap on twenty repositories, −18.5% on sixteen large ones, where the file was found 4.2 points less often). Existing installs do not change. <a href="/guide/choosing-a-setup#what-a-new-install-starts-on">What it was measured to do →</a></span>
</div>
<div style="margin-top:.4rem;display:inline-flex;flex-wrap:wrap;gap:.5rem;justify-content:center;background:var(--vp-c-default-soft,#f3f4f6);border:1px solid rgba(0,0,0,.08);border-radius:999px;padding:.55rem .9rem;font-size:.9rem;color:var(--vp-c-text-2)">
  <span><strong>Benchmark:</strong> sigmap-v8.88-main</span>
  <span>·</span>
  <span>80.4% hit@5 · 95.2% token reduction · 2026-11-21</span>
</div>
</div>

<div style="max-width:840px;margin:0 auto;padding:24px">

## Who is this for?

| I am… | Go to |
|---|---|
| New to SigMap | [Quick start](/guide/quick-start) |
| Using it daily | [ask](/guide/ask) · [validate](/guide/validate) · [judge](/guide/judge) |
| Setting up a team / CI | [Config](/guide/config) · [Strategies](/guide/strategies) |
| Using open-source agents (OpenCode, Aider, Cline) | [Open-source agents guide](/guide/agents) |
| Running local LLMs (Ollama, llama.cpp, vLLM) | [Local LLMs guide](/guide/local-llms) — zero cost, full privacy |
| Integrating with MCP, Claude, or Cursor | [MCP setup](/guide/mcp) |
| Evaluating for a monorepo | [Strategies](/guide/strategies) · [Generalization](/guide/generalization) |
| Comparing against embeddings or RAG | [Compare alternatives](/guide/compare-alternatives) |

</div>

<div style="max-width:840px;margin:0 auto;padding:0 24px 8px">

## Which setup for which job

Each row is a setup SigMap can give an agent, the config that sets it, and what the [agent study](/guide/agent-study) measured for it and did not. Every figure is for *where is this implemented?* questions, scored by whether the expected file was among the (at most five) files the agent named (Haiku 5.5 and Sonnet 5.5, plus Haiku 4.5 in the old-default row; Claude Code and a small Messages-API agent). No offline signal the study tried passed its test for predicting which repositories save (twenty repositories are too few to rule one out), so read the last column as a record, not a promise.

| If you want to… | Set this | What was measured |
|---|---|---|
| **Ask where something is implemented**: what `sigmap --init` starts a new project on | `{ "strategy": "index", "mcp": { "tools": "locate" } }`, then run `sigmap` once and `sigmap mcp install <client>` (`--init` also lists copilot, codex, claude and gemini in `outputs`, so `sigmap` writes `CLAUDE.md`, as in the measured runs, and adds a short "Creation workflow" block to it, which they did not have). Two tools, `query_context` and `get_lines` (about 278 tokens of definitions by chars/4; 426 on the API's own counter, which the study's figures use). `query_context` does not refresh the index, so run `sigmap` again after edits (`sigmap --watch` or `sigmap daemon start` keeps it current as you save; the post-commit hook that `sigmap --setup` installs refreshes it after each commit). | In Claude Code, API-billed, first asks: cost −16.6% (Haiku 5.5, 20 repositories), −8.8% (Sonnet 5.5, the same 20) and −18.5% (Haiku 5.5, 16 repositories of 3,026 to 7,756 files, with no Python or JavaScript). File found with / without SigMap: 205 / 208 of 222, 211 / 207, and 167 / 175 of 192 (4.2 points fewer on the large repositories). In the Messages-API agent (Haiku 5.5, 20 repositories; another loop): cost −7%, time +1%, total tokens +18%; time and tokens were not part of the Claude Code bar, and with Sonnet in Claude Code total tokens rose 9% while cost fell 12%. The first two Claude Code runs use the 20 repositories `locate` was chosen on; the 16 large ones are new. |
| **Let the agent check impact and verify suggestions through MCP** | `{ "strategy": "index", "mcp": { "tools": "core" } }` (from a `--init` config, change `locate` to `core`), then restart the server. Seven tools: the two above plus `read_context`, `get_callee_signatures`, `get_impact`, `get_method_impact` and `verify_suggestion` (about 953 tokens by chars/4; 1,505 on the API's own counter). `verify_suggestion` checks the files, imports and backticked calls a snippet names, not calls in raw code. `sigmap verify`, `--impact` and `--callers` run from the shell under any profile. | **No evidence it helps editing**: the study's one editing stage (nine tasks) could not judge the quality of a patch (cost −7% [−17%, +3%] with Haiku 5.5, not clear), and the agent made a SigMap call in 1 of 45 of its runs. On where-is-it questions `index` plus `core` saved no cost (−1%) and used 51% more total tokens (Messages-API agent, Haiku 5.5). Under `index`, `read_context` returns the map, not signatures. |
| **Cut time and tokens** (Claude Code only) | `sigmap hooks install claude --prefetch`, opt-in; run `sigmap` first and again after edits (the hook never refreshes the index and does not warn when it is stale), then restart Claude Code. On each substantive prompt it puts up to five ranked files in front of the model (at most about 8 KiB each), and it needs no MCP server. It comes with two session hooks: they record each session's usage, and at the next start hand the model a summary of the last one (up to 400 tokens). No other agent has a hook installer; `sigmap ask` prints the same ranking for any agent to paste. | Claude Code, a logged-in session (not API-billed), Haiku 5.5, the prefetch hook alone (without the session hooks), 8 repositories picked after earlier results, one question per session: time −11%, total tokens −23%, tool calls −41%, cost −4%, file found 321 / 326 of 348 (the cost interval includes zero counting each repository once). The same text in the prompt, same questions: cost −12%, time −22%, tokens −32%, tool calls −54%. Messages-API agent, 20 repositories: time −18%, tokens −26%, cost −7% [−19%, +4%], and some repositories cost more (up to +31%). |
| **Nothing to decide** | Nothing: with no config, SigMap uses strategy `full` and, once the server is registered, all 22 tools (about 2,561 tokens of definitions by chars/4). A bare `sigmap` writes only `.github/copilot-instructions.md` and registers nothing; a config written by an older `--init` says `full` plus `core`, which was not measured. | The study's `current` arm (the full section, as `--adapter claude` writes it, plus every tool): +9% against no SigMap in Claude Code on 8 well-known frameworks with Haiku 5.5 (+8% by repository, 3 of 8 repositories cost more), and −28% with Haiku 4.5 (−26% by repository). |
| **Find out for your project** | `sigmap advise`: makes no model call and writes nothing in your source tree (given git history to rank, its first run builds a derived cache under `.context/`); it is offline unless your config `extends` a remote URL. | It prints facts and no forecast: in the study its numbers did not pass the test for predicting which repositories save. To know, measure paired; see [Choosing a setup](/guide/choosing-a-setup). |

The rows were not run against each other: their figures come from different agents, billing, repositories and prompts, named in each cell, so do not compare a percentage in one row with another's. No agent run exists for `per-module`, `hot-cold` or `monorepo`. Not measured: a logged-in or subscription session for `locate`, Python or JavaScript repositories above about 260 files, repositories above 7,756 files, Opus, Sonnet with the hook, and any agent other than Claude Code and the Messages-API loop. Editing: one stage ran and could not judge patches. Sources, limits and how to measure on your own project: [Choosing a setup](/guide/choosing-a-setup).

</div>

<div style="max-width:840px;margin:0 auto;padding:0 24px 8px">

## 30-second start

**Step 1: Generate context for your project**
```bash
npx sigmap
```

**Step 2: Ask for relevant files (query-specific context)**
```bash
sigmap ask "explain the auth flow"
# Outputs: ranked file list + .context/query-context.md (ready to paste)
```

**Step 3: Copy context to your AI assistant**
- Open `.context/query-context.md` 
- Paste the content into Claude, Copilot, ChatGPT, or your IDE's AI chat
- Ask: "Explain the auth flow"

**Step 4: Save the AI response**
```bash
# Copy the AI's answer into a file
echo "Paste AI response here..." > response.txt
```

**Step 5: Validate coverage (optional)**
```bash
sigmap validate --query "auth login token"
# Check if coverage is high enough to trust the response
```

**Step 6: Judge groundedness**
```bash
sigmap judge --response response.txt --context .context/query-context.md
# Score: shows if the answer is grounded in your code
```

That flow gives you: a compact signature map · a focused query context · a coverage sanity check · a groundedness score for the answer.

</div>

<div style="max-width:840px;margin:0 auto;padding:0 24px 8px">

## The workflow

SigMap is no longer just "shrink the context file." Every step has a purpose:

- **Generate** a compact signature map once
- **Ask** for the files that matter to the current task
- **Validate** whether coverage is high enough to trust the context
- **Judge** whether an answer is grounded in the supplied code
- **Learn** from good and bad results locally, inside the repo

See the full [end-to-end walkthrough](/guide/walkthrough) to watch this in action on a real repo.

</div>

<div style="max-width:840px;margin:0 auto;padding:0 24px 24px">

## Latest saved benchmark snapshot

| Metric | Without SigMap | With SigMap |
|---|:---:|:---:|
| Task success proxy | — (proxy, modeled from retrieval tiers) | **61.9%** |
| Prompts per task | 2.84 | **1.58** |
| Retrieval hit@5 (retrieval corpus) | — | **80.4%** |
| Honest corpus hit@5 (125 tasks) | 39.2% (single-shot grep) | **92.8%** (2.37× lift) |
| Overall token reduction | — | **95.2%** |
| GPT-4o overflow repos | 14/21 | **0/21** |

Latest saved benchmark run: **2026-11-21 (v8.88.0)**.

</div>

<div style="max-width:840px;margin:0 auto;padding:0 24px 24px">

## Benchmark proof, by question

| If you want to prove... | Open |
|---|---|
| SigMap reduces token load dramatically | [Token benchmark](/guide/benchmark) |
| SigMap finds the right file more often | [Retrieval benchmark](/guide/retrieval-benchmark) |
| SigMap reduces retries and wrong-context answers | [Task benchmark](/guide/task-benchmark) |
| SigMap keeps large repos inside model limits | [Quality benchmark](/guide/quality-benchmark) |

</div>

<div style="max-width:840px;margin:0 auto;padding:0 24px 32px">

## Where to go next

- New to the product: [Quick start](/guide/quick-start)
- Want the core daily flow: [ask](/guide/ask), [validate](/guide/validate), [judge](/guide/judge), [learning](/guide/learning)
- Using Claude Code or Cursor: [MCP setup](/guide/mcp)
- Evaluating the launch claims: [Benchmark overview](/guide/benchmark)
- 🌍 See the community: [where SigMap's stargazers are around the world](https://starmapper.bruniaux.com/manojmallick/sigmap)

</div>
