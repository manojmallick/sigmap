---
layout: home
title: SigMap — Zero-dependency AI context engine
description: Reduce AI coding agent token consumption by 97%. Extracts signatures from 21 languages, writes copilot-instructions.md automatically. Zero npm install.
head:
  - - meta
    - property: og:title
      content: "SigMap — 97% token reduction for AI coding agents"
  - - meta
    - property: og:description
      content: "SigMap gives your AI the right context before the first prompt. 87.5% retrieval accuracy, 46% fewer prompts, 16 real repos benchmarked."
  - - meta
    - property: og:url
      content: "https://manojmallick.github.io/sigmap/"
  - - meta
    - property: og:type
      content: website
  - - meta
    - name: twitter:title
      content: "SigMap — 97% token reduction for AI coding agents"
  - - meta
    - name: twitter:description
      content: "SigMap gives your AI the right context before the first prompt. 87.5% retrieval accuracy, 46% fewer prompts, 16 real repos benchmarked."
  - - meta
    - name: twitter:image:alt
      content: "SigMap — Zero-dependency AI context engine for AI coding agents"
  - - meta
    - name: keywords
      content: "sigmap, ai context engine, copilot token reduction, ai coding agent, context window optimization, zero dependency, copilot-instructions, claude code context, cursor context, windsurf context"

hero:
  name: SigMap
  text: The right code. First prompt.
  tagline: Gives your AI a map of your entire codebase before it answers. 97% fewer tokens. 87.5% retrieval accuracy. Zero dependencies.
  actions:
    - theme: brand
      text: Get Started →
      link: /guide/quick-start
    - theme: alt
      text: Benchmarks →
      link: /guide/task-benchmark
    - theme: alt
      text: GitHub
      link: https://github.com/manojmallick/sigmap

features:
  - icon: 🎯
    title: Right file, first prompt
    details: 87.5% hit@5 across 80 real coding tasks on 16 repos. Without SigMap, random selection finds the right file 13.7% of the time.
    link: /guide/retrieval-benchmark
    linkText: Retrieval benchmark →
  - icon: ⚡
    title: 97% token reduction
    details: From ~80,000 raw tokens to ~4,000 per session. Function signatures only — no bodies, no comments. Measured across 16 real codebases.
    link: /guide/benchmark
    linkText: Token benchmark →
  - icon: 💬
    title: 46% fewer prompts
    details: Correct context lands at rank 1 in 59% of tasks. Wrong context drops from 87% to 13%. Fewer retries, faster answers.
    link: /guide/task-benchmark
    linkText: Task benchmark →
  - icon: 🌐
    title: 21 languages
    details: TypeScript, JS, Python, Go, Rust, Java, Kotlin, Ruby, PHP, Swift, C#, C++, Dart, Scala, Vue, Svelte, HTML, CSS, YAML, Shell, Dockerfile.
    link: /guide/languages
    linkText: All languages →
  - icon: 📦
    title: Zero dependencies
    details: npx sigmap and done. No package.json changes, no compiler, no Tree-sitter. Requires only Node.js 18+.
  - icon: 🔄
    title: Always current
    details: File watcher + git post-commit hook regenerate context on every save and commit. Context is never stale.
---

<div style="max-width:780px;margin:0 auto;padding:0 24px 16px">

## How it works

Your AI coding agent starts every session blind — it has no idea where `handleAuth()` lives, which file owns the route table, or what `UserService` exports. It guesses. It gets it wrong. You correct it.

SigMap runs once (or on every commit) and writes a compact **signature index** — every function name, class, and module across your entire codebase — into `.github/copilot-instructions.md`. Every tool reads it automatically: GitHub Copilot, Claude Code, Cursor, Windsurf, and any MCP-compatible agent.

The AI no longer guesses. It has the map.

</div>

<div style="max-width:780px;margin:0 auto;padding:0 24px 32px">

## One command

```bash
npx sigmap
```

That's it. No config needed. Outputs to `.github/copilot-instructions.md` in ~1 second.

</div>

<div style="max-width:780px;margin:0 auto;padding:0 24px 32px">

## Benchmark results

Measured across **80 tasks on 16 real repos** (express, rails, react, rust-analyzer, laravel, and more). No LLM API used.

<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:1rem;margin:1.5rem 0">

<div style="background:var(--vp-c-bg-soft);border-radius:10px;padding:1rem 1.2rem;text-align:center">
  <div style="font-size:2em;font-weight:700;color:#7c6af7">87.5%</div>
  <div style="font-size:0.82em;color:var(--vp-c-text-2);margin-top:4px">retrieval accuracy<br><span style="color:var(--vp-c-text-3)">vs 13.7% without</span></div>
</div>

<div style="background:var(--vp-c-bg-soft);border-radius:10px;padding:1rem 1.2rem;text-align:center">
  <div style="font-size:2em;font-weight:700;color:#7c6af7">97%</div>
  <div style="font-size:0.82em;color:var(--vp-c-text-2);margin-top:4px">token reduction<br><span style="color:var(--vp-c-text-3)">80K → 4K tokens</span></div>
</div>

<div style="background:var(--vp-c-bg-soft);border-radius:10px;padding:1rem 1.2rem;text-align:center">
  <div style="font-size:2em;font-weight:700;color:#7c6af7">−46%</div>
  <div style="font-size:0.82em;color:var(--vp-c-text-2);margin-top:4px">fewer prompts<br><span style="color:var(--vp-c-text-3)">2.84 → 1.54 avg</span></div>
</div>

<div style="background:var(--vp-c-bg-soft);border-radius:10px;padding:1rem 1.2rem;text-align:center">
  <div style="font-size:2em;font-weight:700;color:#7c6af7">6.4×</div>
  <div style="font-size:0.82em;color:var(--vp-c-text-2);margin-top:4px">avg context lift<br><span style="color:var(--vp-c-text-3)">across 16 repos</span></div>
</div>

<div style="background:var(--vp-c-bg-soft);border-radius:10px;padding:1rem 1.2rem;text-align:center">
  <div style="font-size:2em;font-weight:700;color:#22c55e">59%</div>
  <div style="font-size:0.82em;color:var(--vp-c-text-2);margin-top:4px">correct rank-1<br><span style="color:var(--vp-c-text-3)">right file, first</span></div>
</div>

<div style="background:var(--vp-c-bg-soft);border-radius:10px;padding:1rem 1.2rem;text-align:center">
  <div style="font-size:2em;font-weight:700;color:#22c55e">13%</div>
  <div style="font-size:0.82em;color:var(--vp-c-text-2);margin-top:4px">wrong context<br><span style="color:var(--vp-c-text-3)">down from 87%</span></div>
</div>

</div>

<div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:.5rem">
  <a href="/guide/task-benchmark" style="font-size:0.85em;color:#7c6af7;text-decoration:none;border:1px solid #7c6af733;border-radius:6px;padding:4px 12px">Task benchmark →</a>
  <a href="/guide/retrieval-benchmark" style="font-size:0.85em;color:#7c6af7;text-decoration:none;border:1px solid #7c6af733;border-radius:6px;padding:4px 12px">Retrieval benchmark →</a>
  <a href="/guide/quality-benchmark" style="font-size:0.85em;color:#7c6af7;text-decoration:none;border:1px solid #7c6af733;border-radius:6px;padding:4px 12px">Quality benchmark →</a>
  <a href="/guide/generalization" style="font-size:0.85em;color:#7c6af7;text-decoration:none;border:1px solid #7c6af733;border-radius:6px;padding:4px 12px">Generalization →</a>
</div>

</div>

<div style="max-width:780px;margin:0 auto;padding:0 24px 32px">

## Adapters — every tool covered

SigMap writes a single output that works everywhere:

| Tool | Output file | Auto-read |
|---|---|---|
| GitHub Copilot | `.github/copilot-instructions.md` | ✅ |
| Claude Code | `CLAUDE.md` | ✅ |
| Cursor | `.cursorrules` | ✅ |
| Windsurf | `.windsurfrules` | ✅ |
| OpenAI Codex | `.openai/context.md` | ✅ |
| Gemini CLI | `.gemini/context.md` | ✅ |
| MCP server | 8 on-demand tools | ✅ |

</div>

<div style="max-width:780px;margin:0 auto;padding:0 24px 48px">

## Answer correctness — what changes

<div style="display:flex;gap:2rem;flex-wrap:wrap;margin:1.2rem 0">

<div style="flex:1;min-width:220px;border-radius:10px;border:1px solid var(--vp-c-divider);padding:1.2rem">
  <div style="font-size:0.8em;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:#ef4444;margin-bottom:.8rem">Without SigMap</div>
  <div style="font-size:0.88em;line-height:1.7;color:var(--vp-c-text-1)">
    ✗ &nbsp;AI answers from whichever file happens to fit the context window<br>
    ✗ &nbsp;87% of tasks start with the wrong file<br>
    ✗ &nbsp;92% of codebase symbols are invisible — hallucination risk<br>
    ✗ &nbsp;Average of 2.84 prompts before you get a useful answer
  </div>
</div>

<div style="flex:1;min-width:220px;border-radius:10px;border:2px solid #7c6af7;padding:1.2rem">
  <div style="font-size:0.8em;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:#7c6af7;margin-bottom:.8rem">With SigMap</div>
  <div style="font-size:0.88em;line-height:1.7;color:var(--vp-c-text-1)">
    ✓ &nbsp;Right file in context 87.5% of the time<br>
    ✓ &nbsp;59% of tasks answered correctly on the first prompt<br>
    ✓ &nbsp;All 5,067 indexed symbols grounded — no dark zones<br>
    ✓ &nbsp;Average of 1.54 prompts to answer
  </div>
</div>

</div>

</div>

---

<div style="text-align:center;margin-top:2.5rem;padding-bottom:.5rem;font-size:0.85em;color:var(--vp-c-text-3)">
  Made in Amsterdam, Netherlands <span title="Netherlands">🇳🇱</span>
</div>