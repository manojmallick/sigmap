---
layout: home
title: SigMap — zero-dependency AI context engine
description: SigMap makes AI coding answers more grounded with compact signatures, validation, judge scoring, and local learning. 75.6% hit@5, 39.4% fewer prompts, 97.0% average token reduction, 33 languages with R support.
head:
  - - meta
    - property: og:title
      content: "SigMap — grounded AI coding context"
  - - meta
    - property: og:description
      content: "Ask, validate, judge, and learn from real code context. 75.6% hit@5, 39.4% fewer prompts, 97.0% overall token reduction."
  - - meta
    - property: og:url
      content: "https://sigmap.io/"
  - - meta
    - property: og:type
      content: website
  - - meta
    - name: twitter:title
      content: "SigMap — grounded AI coding context"
  - - meta
    - name: twitter:description
      content: "Ask, validate, judge, and learn from real code context. 75.6% hit@5, 39.4% fewer prompts, 97.0% overall token reduction."
  - - meta
    - name: twitter:image:alt
      content: "SigMap — zero-dependency AI context engine"
  - - meta
    - name: keywords
      content: "sigmap, ai context engine, grounded ai answers, code retrieval, mcp, sigmap ask, sigmap judge, sigmap validate, sigmap learn"

hero:
  name: SigMap
  text: Better context. More grounded answers.
  tagline: "Zero-dependency AI context engine. 75.6% hit@5 · 97.0% token reduction · Ask → Validate → Judge → Learn."
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
    details: "Latest saved run: 2.84 prompts without SigMap vs 1.72 with SigMap. That is a 39.4% reduction across 90 real coding tasks."
    link: /guide/task-benchmark
    linkText: Task benchmark →
  - icon: 🎯
    title: Right file in context
    details: 75.6% hit@5 across 21 repos and 90 tasks. Random selection finds the right file only 13.6% of the time.
    link: /guide/retrieval-benchmark
    linkText: Retrieval benchmark →
  - icon: ⚖️
    title: Trust the answer, not just the token count
    details: Use ask to build focused context, validate to check coverage, judge to score groundedness, and learn to reinforce the files that helped.
    link: /guide/judge
    linkText: Workflow docs →
  - icon: 🌐
    title: 33 languages, zero native deps
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
  <span><strong>Release:</strong> v7.27.0</span>
  <span>·</span>
  <span>Two new <strong>MCP tools</strong> (v8.0 D3, 15→17): <code>get_diff_context</code> returns changed files with signatures + blast radius, and <code>get_architecture_overview</code> gives a one-call codebase map — module breakdown, hub files, and dependency cycles</span>
</div>
<div style="margin-top:.4rem;display:inline-flex;flex-wrap:wrap;gap:.5rem;justify-content:center;background:var(--vp-c-default-soft,#f3f4f6);border:1px solid rgba(0,0,0,.08);border-radius:999px;padding:.55rem .9rem;font-size:.9rem;color:var(--vp-c-text-2)">
  <span><strong>Benchmark:</strong> sigmap-v7.27-main</span>
  <span>·</span>
  <span>76% hit@5 · 97.0% token reduction · 2026-06-22</span>
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
| Task success proxy | 10% | **52.2%** |
| Prompts per task | 2.84 | **1.72** |
| Retrieval hit@5 | 13.6% | **76%** (76% graph-boosted) |
| Overall token reduction | — | **97.0%** |
| GPT-4o overflow repos | 16/21 | **0/21** |

Latest saved benchmark run: **2026-06-22 (v7.27.0)**.

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
