---
layout: home
title: SigMap — zero-dependency AI context engine
description: SigMap makes AI coding answers more grounded with compact signatures, validation, judge scoring, and local learning. 80.0% hit@5, 40.8% fewer prompts, 96.7% average token reduction.
head:
  - - meta
    - property: og:title
      content: "SigMap — grounded AI coding context for v5.4"
  - - meta
    - property: og:description
      content: "Ask, validate, judge, and learn from real code context. 80.0% hit@5, 40.8% fewer prompts, 98.1% overall token reduction."
  - - meta
    - property: og:url
      content: "https://manojmallick.github.io/sigmap/"
  - - meta
    - property: og:type
      content: website
  - - meta
    - name: twitter:title
      content: "SigMap — grounded AI coding context for v5.4"
  - - meta
    - name: twitter:description
      content: "Ask, validate, judge, and learn from real code context. 80.0% hit@5, 40.8% fewer prompts, 98.1% overall token reduction."
  - - meta
    - name: twitter:image:alt
      content: "SigMap v5.4 homepage"
  - - meta
    - name: keywords
      content: "sigmap, ai context engine, grounded ai answers, code retrieval, mcp, sigmap ask, sigmap judge, sigmap validate, sigmap learn"

hero:
  name: SigMap
  text: Better context. More grounded answers.
  tagline: "v5.4 adds a Neovim plugin (sigmap.nvim) on top of Windsurf, Zed, and the ask, validate, judge, compare, and local learning weights on top of the core signature engine."
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
    details: "Latest saved run: 2.84 prompts without SigMap vs 1.68 with SigMap. That is a 40.8% reduction across 90 real coding tasks."
    link: /guide/task-benchmark
    linkText: Task benchmark →
  - icon: 🎯
    title: Right file in context
    details: 80.0% hit@5 across 18 repos and 90 tasks. Random selection finds the right file only 13.6% of the time.
    link: /guide/retrieval-benchmark
    linkText: Retrieval benchmark →
  - icon: ⚖️
    title: Trust the answer, not just the token count
    details: Use ask to build focused context, validate to check coverage, judge to score groundedness, and learn to reinforce the files that helped.
    link: /guide/judge
    linkText: Workflow docs →
  - icon: 🌐
    title: 29 languages, zero native deps
    details: TypeScript, Python, Go, Rust, Java, Kotlin, Ruby, PHP, Swift, C#, C++, Dart, Scala, Vue, Svelte, GraphQL, SQL, Terraform, and more.
    link: /guide/languages
    linkText: Language support →
  - icon: 🔌
    title: MCP-ready and IDE-friendly
    details: Works with Copilot, Claude Code, Cursor, Windsurf, Codex, and Gemini CLI. Use MCP for dynamic query_context lookups on demand.
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
  <span><strong>v5.4 launch:</strong></span>
  <span><code>sigmap.nvim</code></span>
  <span><code>:SigMap</code></span>
  <span><code>:SigMapQuery</code></span>
  <span><code>:checkhealth sigmap</code></span>
</div>
</div>

<div style="max-width:840px;margin:0 auto;padding:24px">

## Start here

The fastest way to understand SigMap v5.4 is to use the same workflow you would use during a real coding session:

```bash
npx sigmap
sigmap ask "explain the auth flow"
sigmap validate --query "auth login token"
sigmap judge --response response.txt --context .context/query-context.md
```

That flow gives you:

- a compact signature map
- a focused query context
- a coverage sanity check
- and a groundedness score for the answer you got back

</div>

<div style="max-width:840px;margin:0 auto;padding:0 24px 8px">

## The v5.4 story

SigMap is no longer just "shrink the context file." The v5 line turns the product into a daily workflow:

- **Generate** a compact signature map once
- **Ask** for the files that matter to the current task
- **Validate** whether coverage is high enough to trust the context
- **Judge** whether an answer is grounded in the supplied code
- **Learn** from good and bad results locally, inside the repo

</div>

<div style="max-width:840px;margin:0 auto;padding:0 24px 24px">

## Latest saved benchmark snapshot

| Metric | Without SigMap | With SigMap |
|---|:---:|:---:|
| Task success proxy | 10% | **52.2%** |
| Prompts per task | 2.84 | **1.68** |
| Retrieval hit@5 | 13.6% | **80.0%** |
| Overall token reduction | — | **98.1%** |
| GPT-4o overflow repos | 13/18 | **0/18** |

Latest saved benchmark run: **2026-04-17 (v5.3.0)**.

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

</div>
