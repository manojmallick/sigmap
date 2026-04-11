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
      content: "node gen-context.js — that's the entire install. Reduces Copilot sessions from 80K to 4K tokens automatically."
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
      content: "node gen-context.js — that's the entire install. Reduces Copilot sessions from 80K to 4K tokens automatically."
  - - meta
    - name: twitter:image:alt
      content: "SigMap — Zero-dependency AI context engine for AI coding agents"
  - - meta
    - name: keywords
      content: "sigmap, ai context engine, copilot token reduction, ai coding agent, context window optimization, zero dependency, copilot-instructions, claude code context, cursor context, windsurf context"

hero:
  name: SigMap
  text: 97% fewer tokens.
  tagline: Extracts function signatures from 21 languages and writes context files for Copilot, Claude, Cursor, and Windsurf. Zero npm install.
  actions:
    - theme: brand
      text: Get Started →
      link: /guide/quick-start
    - theme: alt
      text: View on GitHub
      link: https://github.com/manojmallick/sigmap

features:
  - icon: ⚡
    title: 97% token reduction
    details: From ~80,000 tokens to ~4,000 per session. Only function signatures, no bodies.
  - icon: 🌐
    title: 21 languages
    details: TypeScript, JS, Python, Go, Rust, Java, Kotlin, Ruby, PHP, Swift, C#, C/C++, Dart, Scala, Vue, Svelte, HTML, CSS, YAML, Shell, Dockerfile.
  - icon: 📦
    title: Zero dependencies
    details: curl one file and run it. No package.json changes, no compiler, no Tree-sitter. Node.js 18+ only.
  - icon: 🔄
    title: Always current
    details: File watcher + git post-commit hook regenerate context on every save and commit automatically.
---

<div style="max-width:560px;margin:0 auto 64px;padding:0 24px">

```bash
# One command to start
npx sigmap
```

</div>


---

<div style="text-align:center;margin-top:2.5rem;padding-bottom:.5rem;font-size:0.85em;color:var(--vp-c-text-3)">
  Made in Amsterdam, Netherlands <span title="Netherlands">🇳🇱</span>
</div>