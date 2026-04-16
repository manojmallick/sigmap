---
layout: home
title: SigMap — workflow-first AI context for code
description: SigMap makes AI coding answers more grounded with compact signatures, validation, judge scoring, and local learning. 78.9% hit@5, 40.6% fewer prompts, 98.1% overall token reduction.
head:
  - - meta
    - property: og:title
      content: "SigMap — ask, validate, judge, and learn from real code context"
  - - meta
    - property: og:description
      content: "Workflow-first AI context for codebases. 78.9% hit@5, 40.6% fewer prompts, 98.1% overall token reduction."
  - - meta
    - property: og:url
      content: "https://manojmallick.github.io/sigmap/"
  - - meta
    - property: og:type
      content: website
  - - meta
    - name: twitter:title
      content: "SigMap — workflow-first AI context for code"
  - - meta
    - name: twitter:description
      content: "Ask, validate, judge, and learn from real code context. 78.9% hit@5, 40.6% fewer prompts, 98.1% overall token reduction."
  - - meta
    - name: keywords
      content: "sigmap, ai context engine, grounded ai answers, code retrieval, mcp, sigmap ask, sigmap judge, sigmap validate, sigmap learn"

hero:
  name: SigMap
  text: Grounded answers for coding agents.
  tagline: "v5.2.0 adds ask, validate, judge, compare, share, and local learning weights on top of the core signature engine."
  actions:
    - theme: brand
      text: Get Started →
      link: /guide/quick-start
    - theme: alt
      text: Benchmarks →
      link: /guide/benchmark
    - theme: alt
      text: GitHub
      link: https://github.com/manojmallick/sigmap

features:
  - icon: 🎯
    title: Right file in context
    details: "78.9% hit@5 across 90 real coding tasks on 18 repos. Random selection finds the right file only 13.6% of the time."
    link: /guide/retrieval-benchmark
    linkText: Retrieval benchmark →
  - icon: 💬
    title: Fewer prompts to finish the task
    details: "1.69 prompts with SigMap vs 2.84 without it. That is a 40.6% reduction across the latest saved task benchmark."
    link: /guide/task-benchmark
    linkText: Task benchmark →
  - icon: 🧭
    title: Workflow-first trust layer
    details: "Use ask to build focused context, validate to check coverage, judge to score groundedness, and learn to reinforce the files that actually helped."
    link: /guide/cli
    linkText: CLI reference →
  - icon: ⚡
    title: Smaller context window load
    details: "98.1% overall token reduction in the latest saved benchmark snapshot, measured on 18 real repos."
    link: /guide/benchmark
    linkText: Benchmark overview →
  - icon: 🌐
    title: 29 languages
    details: "TypeScript, JavaScript, Python, Go, Rust, Java, Kotlin, Ruby, PHP, Swift, C#, C++, Dart, Scala, Vue, Svelte, GraphQL, SQL, Terraform, and more."
    link: /guide/languages
    linkText: Language support →
  - icon: 📊
    title: HTML benchmark dashboard
    details: "Run the benchmark matrix once and open a self-contained HTML report for token, retrieval, quality, and task metrics."
    link: /guide/benchmark
    linkText: See benchmark flow →
---

<div style="max-width:780px;margin:0 auto;padding:24px 24px 8px;text-align:center">
<p style="font-size:1.05em;color:var(--vp-c-text-2)">
  SigMap gives coding agents a compact, inspectable map of your repo before the first prompt, then lets you check whether the answer was actually grounded.
</p>
</div>

<div style="max-width:780px;margin:0 auto;padding:0 24px 24px">

## Start here

```bash
npx sigmap
sigmap ask "explain the auth flow"
sigmap validate --query "auth login token"
sigmap judge --response response.txt --context .context/query-context.md
```

</div>

<div style="max-width:780px;margin:0 auto;padding:0 24px 24px">

## Latest release snapshot

| Metric | Without SigMap | With SigMap |
|---|:---:|:---:|
| Task success proxy | 10% | **52.2%** |
| Prompts per task | 2.84 | **1.69** |
| Retrieval hit@5 | 13.6% | **78.9%** |
| Overall token reduction | — | **98.1%** |

Latest saved benchmark run: **2026-04-16 (v5.2.0)**.

</div>

<div style="max-width:780px;margin:0 auto;padding:0 24px 24px">

## What changed in v5.2.0

- `ask` builds task-focused context in one step
- `validate` checks config health and query coverage
- `judge` scores groundedness against the supplied context
- `learn & weights` add safe, local-only ranking feedback
- `compare & share` turn benchmark results into demo-ready output

</div>

<div style="max-width:780px;margin:0 auto;padding:0 24px 40px">

## Proof, not vibes

- Want the benchmark hub: [benchmark overview](/guide/benchmark)
- Want the daily flow: [quick start](/guide/quick-start) and [CLI reference](/guide/cli)
- Want language and platform details: [language support](/guide/languages) and [MCP server](/guide/mcp)

</div>
