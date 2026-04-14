---
layout: home
title: SigMap — Zero-dependency AI context engine
description: Reduce AI coding agent token consumption by 97%. Extracts signatures from 29 languages, writes copilot-instructions.md automatically. Zero npm install.
head:
  - - meta
    - property: og:title
      content: "SigMap — 97% token reduction for AI coding agents"
  - - meta
    - property: og:description
      content: "SigMap gives your AI the right context before the first prompt. 84.4% retrieval accuracy, 37% fewer prompts, 18 real repos benchmarked."
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
      content: "SigMap gives your AI the right context before the first prompt. 84.4% retrieval accuracy, 37% fewer prompts, 18 real repos benchmarked."
  - - meta
    - name: twitter:image:alt
      content: "SigMap — Zero-dependency AI context engine for AI coding agents"
  - - meta
    - name: keywords
      content: "sigmap, ai context engine, copilot token reduction, ai coding agent, context window optimization, zero dependency, copilot-instructions, claude code context, cursor context, windsurf context"

hero:
  name: SigMap
  text: 6× better AI answers.
  tagline: "✔ 59% task success (was 10%)  ✔ 2× fewer prompts  ✔ 97% fewer tokens. One command, zero config — works with Copilot, Claude, Cursor, and Windsurf."
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
    details: 84.4% hit@5 across 90 real coding tasks on 18 repos. Without SigMap, random selection finds the right file 13.6% of the time.
    link: /guide/retrieval-benchmark
    linkText: Retrieval benchmark →
  - icon: ⚡
    title: 97% token reduction
    details: From ~80,000 raw tokens to ~4,000 per session. Function signatures only — no bodies, no comments. Measured across 18 real codebases.
    link: /guide/benchmark
    linkText: Token benchmark →
  - icon: 💬
    title: 37% fewer prompts
    details: Correct context lands at rank 1 in 57% of tasks. Wrong context drops from 87% to 16%. Fewer retries, faster answers.
    link: /guide/task-benchmark
    linkText: Task benchmark →
  - icon: 🌐
    title: 29 languages
    details: TypeScript, JS, Python, Go, Rust, Java, Kotlin, Ruby, PHP, Swift, C#, C++, Dart, Scala, Vue, Svelte, HTML, CSS, YAML, Shell, Dockerfile, GraphQL, SQL, Terraform, Protobuf, TOML, XML, Properties, Markdown.
    link: /guide/languages
    linkText: All languages →
  - icon: 📦
    title: Zero dependencies
    details: npx sigmap and done. No package.json changes, no compiler, no Tree-sitter. Requires only Node.js 18+.
  - icon: 🔄
    title: Always current
    details: File watcher + git post-commit hook regenerate context on every save and commit. Context is never stale.
---

<div style="max-width:780px;margin:0 auto;padding:0 24px 40px">

## The problem — in one sentence

Your AI answers coding questions from whichever files happen to fit its context window. On a large codebase that's ~1% of the code. It guesses. It gets it wrong.

**SigMap fixes this.** It runs before your first prompt and puts the right files into context automatically. No config. No API key. One command.

</div>

<div style="max-width:780px;margin:0 auto;padding:0 24px 16px">

## Before vs After — finding the right file

Does the AI get the right file in context? Measured across 90 real coding tasks.

<div style="margin:1.4rem 0">

<div style="display:flex;align-items:center;gap:12px;margin:10px 0">
  <span style="width:160px;font-size:0.88em;color:#ef4444;font-weight:500">Without SigMap</span>
  <div style="flex:1;background:var(--vp-c-bg-mute);border-radius:6px;height:36px;overflow:hidden">
    <div style="background:#ef4444;height:36px;width:13.6%;display:flex;align-items:center;padding-left:10px">
      <span style="color:#fff;font-size:0.82em;font-weight:700;white-space:nowrap">13.6%</span>
    </div>
  </div>
</div>

<div style="display:flex;align-items:center;gap:12px;margin:10px 0">
  <span style="width:160px;font-size:0.88em;color:#7c6af7;font-weight:500">With SigMap</span>
  <div style="flex:1;background:var(--vp-c-bg-mute);border-radius:6px;height:36px;overflow:hidden">
    <div style="background:#7c6af7;height:36px;width:84.4%;display:flex;align-items:center;padding-left:10px">
      <span style="color:#fff;font-size:0.82em;font-weight:700">84.4%</span>
    </div>
  </div>
</div>

</div>

<div style="display:flex;gap:2rem;flex-wrap:wrap;margin-top:1.8rem">

<div style="flex:1;min-width:200px">
  <div style="font-size:0.78em;text-transform:uppercase;letter-spacing:.08em;color:var(--vp-c-text-3);margin-bottom:.5rem">Prompts to answer</div>
  <div style="display:flex;align-items:center;gap:12px;margin:6px 0">
    <span style="width:120px;font-size:0.82em;color:#ef4444">Without</span>
    <div style="flex:1;background:var(--vp-c-bg-mute);border-radius:4px;height:22px;overflow:hidden">
      <div style="background:#ef4444;height:22px;width:94.7%;display:flex;align-items:center;padding-left:8px">
        <span style="color:#fff;font-size:0.78em;font-weight:600">2.84</span>
      </div>
    </div>
  </div>
  <div style="display:flex;align-items:center;gap:12px;margin:6px 0">
    <span style="width:120px;font-size:0.82em;color:#7c6af7">With SigMap</span>
    <div style="flex:1;background:var(--vp-c-bg-mute);border-radius:4px;height:22px;overflow:hidden">
      <div style="background:#7c6af7;height:22px;width:59.3%;display:flex;align-items:center;padding-left:8px">
        <span style="color:#fff;font-size:0.78em;font-weight:600">1.78</span>
      </div>
    </div>
  </div>
</div>

<div style="flex:1;min-width:200px">
  <div style="font-size:0.78em;text-transform:uppercase;letter-spacing:.08em;color:var(--vp-c-text-3);margin-bottom:.5rem">Wrong context rate</div>
  <div style="display:flex;align-items:center;gap:12px;margin:6px 0">
    <span style="width:120px;font-size:0.82em;color:#ef4444">Without</span>
    <div style="flex:1;background:var(--vp-c-bg-mute);border-radius:4px;height:22px;overflow:hidden">
      <div style="background:#ef4444;height:22px;width:87%;display:flex;align-items:center;padding-left:8px">
        <span style="color:#fff;font-size:0.78em;font-weight:600">87%</span>
      </div>
    </div>
  </div>
  <div style="display:flex;align-items:center;gap:12px;margin:6px 0">
    <span style="width:120px;font-size:0.82em;color:#7c6af7">With SigMap</span>
    <div style="flex:1;background:var(--vp-c-bg-mute);border-radius:4px;height:22px;overflow:hidden">
      <div style="background:#7c6af7;height:22px;width:16%;display:flex;align-items:center;padding-left:8px">
        <span style="color:#fff;font-size:0.78em;font-weight:600">16%</span>
      </div>
    </div>
  </div>
</div>

</div>

</div>

<div style="max-width:780px;margin:0 auto;padding:0 24px 40px">

## Answer correctness score

**Think of this like a report card.** For every coding task, did the AI get the right code?

<div style="margin:1.4rem 0">

<div style="margin:12px 0">
  <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:5px">
    <span style="font-size:0.9em;font-weight:600;color:#22c55e">✓ Correct — right file, first prompt</span>
    <span style="font-size:0.85em;color:#22c55e">51 / 90 tasks</span>
  </div>
  <div style="background:var(--vp-c-bg-mute);border-radius:6px;height:32px;overflow:hidden">
    <div style="background:#22c55e;height:32px;width:56.7%;display:flex;align-items:center;padding-left:12px">
      <span style="color:#fff;font-weight:700;font-size:0.88em">56.7%</span>
    </div>
  </div>
</div>

<div style="margin:12px 0">
  <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:5px">
    <span style="font-size:0.9em;font-weight:600;color:#f59e0b">~ Partial — right file somewhere in context</span>
    <span style="font-size:0.85em;color:#f59e0b">25 / 90 tasks</span>
  </div>
  <div style="background:var(--vp-c-bg-mute);border-radius:6px;height:32px;overflow:hidden">
    <div style="background:#f59e0b;height:32px;width:27.8%;display:flex;align-items:center;padding-left:12px">
      <span style="color:#fff;font-weight:700;font-size:0.88em">27.8%</span>
    </div>
  </div>
</div>

<div style="margin:12px 0">
  <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:5px">
    <span style="font-size:0.9em;font-weight:600;color:#ef4444">✗ Wrong — AI answered from the wrong code</span>
    <span style="font-size:0.85em;color:#ef4444">14 / 90 tasks</span>
  </div>
  <div style="background:var(--vp-c-bg-mute);border-radius:6px;height:32px;overflow:hidden">
    <div style="background:#ef4444;height:32px;width:15.6%;display:flex;align-items:center;padding-left:12px">
      <span style="color:#fff;font-weight:700;font-size:0.88em">15.6%</span>
    </div>
  </div>
</div>

</div>

<div style="display:flex;gap:1rem;flex-wrap:wrap;margin-top:1.5rem">
<div style="flex:1;min-width:180px;background:var(--vp-c-bg-soft);border-radius:8px;padding:.9rem 1.1rem">
  <div style="font-size:1.6em;font-weight:700;color:#ef4444">92%</div>
  <div style="font-size:0.82em;color:var(--vp-c-text-2)">hallucination risk<br><span style="color:var(--vp-c-text-3)">without SigMap — 57K symbols hidden from AI</span></div>
</div>
<div style="flex:1;min-width:180px;background:var(--vp-c-bg-soft);border-radius:8px;padding:.9rem 1.1rem;border:2px solid #7c6af744">
  <div style="font-size:1.6em;font-weight:700;color:#7c6af7">0%</div>
  <div style="font-size:0.82em;color:var(--vp-c-text-2)">dark symbols<br><span style="color:var(--vp-c-text-3)">with SigMap — all 5,865 signatures grounded</span></div>
</div>
</div>

<div style="margin-top:1rem;font-size:0.83em;color:var(--vp-c-text-3)">
Measured across 90 tasks · 18 repos · 13 languages · no LLM API · <a href="/sigmap/guide/task-benchmark" style="color:#7c6af7">full methodology →</a>
</div>

</div>

<div style="max-width:780px;margin:0 auto;padding:0 24px 32px">

## One command

```bash
npx sigmap
```

No config, no API key, no dependencies. Reads your code, writes the context file, done in ~1 second.

</div>

<div style="max-width:780px;margin:0 auto;padding:0 24px 32px">

## Works with every AI tool

<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:.7rem;margin:1.2rem 0;font-size:0.88em">
<div style="background:var(--vp-c-bg-soft);border-radius:8px;padding:.7rem 1rem;display:flex;justify-content:space-between;align-items:center"><span>GitHub Copilot</span><span style="color:#22c55e;font-weight:600">✓ auto</span></div>
<div style="background:var(--vp-c-bg-soft);border-radius:8px;padding:.7rem 1rem;display:flex;justify-content:space-between;align-items:center"><span>Claude Code</span><span style="color:#22c55e;font-weight:600">✓ auto</span></div>
<div style="background:var(--vp-c-bg-soft);border-radius:8px;padding:.7rem 1rem;display:flex;justify-content:space-between;align-items:center"><span>Cursor</span><span style="color:#22c55e;font-weight:600">✓ auto</span></div>
<div style="background:var(--vp-c-bg-soft);border-radius:8px;padding:.7rem 1rem;display:flex;justify-content:space-between;align-items:center"><span>Windsurf</span><span style="color:#22c55e;font-weight:600">✓ auto</span></div>
<div style="background:var(--vp-c-bg-soft);border-radius:8px;padding:.7rem 1rem;display:flex;justify-content:space-between;align-items:center"><span>OpenAI Codex</span><span style="color:#22c55e;font-weight:600">✓ auto</span></div>
<div style="background:var(--vp-c-bg-soft);border-radius:8px;padding:.7rem 1rem;display:flex;justify-content:space-between;align-items:center"><span>Gemini CLI</span><span style="color:#22c55e;font-weight:600">✓ auto</span></div>
</div>

</div>

---

<div style="text-align:center;margin-top:2.5rem;padding-bottom:.5rem;font-size:0.85em;color:var(--vp-c-text-3)">
  Made in Amsterdam, Netherlands <span title="Netherlands">🇳🇱</span>
</div>