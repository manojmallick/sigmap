---
title: Generalization
description: The same v5.2.0 retrieval snapshot spans 18 repos, 13 languages, and 9 domains without per-repo tuning.
head:
  - - meta
    - property: og:title
      content: "SigMap generalization — one retrieval snapshot across many repo shapes"
  - - meta
    - property: og:description
      content: "SigMap's latest public snapshot spans 18 repos, 13 languages, and 9 domains without per-repo tuning."
  - - meta
    - property: og:url
      content: "https://manojmallick.github.io/sigmap/guide/generalization"
---

# Generalization

The important part of SigMap's benchmark story is not just the topline score. It is that the same retrieval approach works across a mixed set of repos rather than one curated demo project.

## Current public snapshot

- **18 repos**
- **13 languages**
- **9 domains**
- **78.9%** overall hit@5
- **no per-repo tuning**

That snapshot is shared with the [retrieval benchmark](/guide/retrieval-benchmark) and the [task benchmark](/guide/task-benchmark), so the public docs now use one release number set instead of mixing older runs.

## Why this matters

SigMap uses hand-written extractors and lightweight ranking rather than a hosted retrieval stack. The strongest proof of generalization is therefore breadth:

- frameworks and application repos
- libraries and dev tools
- small, medium, and large codebases
- languages with very different syntax shapes

## Representative coverage

| Category | Example repos |
|---|---|
| Web frameworks | `express`, `flask`, `gin`, `rails`, `laravel`, `fastapi`, `fastify`, `vapor` |
| Libraries / tooling | `axios`, `okhttp`, `serilog`, `riverpod`, `rust-analyzer`, `abseil-cpp`, `akka` |
| UI frameworks | `vue-core`, `svelte` |

## Practical takeaway

If you want one number to carry into launch messaging, use the shared `v5.2.0` snapshot rather than an older per-page variant:

- **78.9% hit@5**
- **52.2% task success proxy**
- **1.69 prompts per task**
- **98.1% overall token reduction**
