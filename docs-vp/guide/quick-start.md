---
title: Quick start
description: "Get SigMap running in minutes, then use the v5.5 workflow: ask, validate, judge, and optional learning."
head:
  - - meta
    - property: og:title
      content: "SigMap Quick Start — ask, validate, judge"
  - - meta
    - property: og:description
      content: "Install once, generate signatures, ask a real question, validate coverage, and judge the answer."
  - - meta
    - property: og:url
      content: "https://manojmallick.github.io/sigmap/guide/quick-start"
---
# Quick start

This page is the fastest path to the real v5.5 workflow.

## 1. Install or run directly

```bash
npx sigmap
```

You can also install globally:

```bash
npm install -g sigmap
sigmap
```

## 2. Generate the base context

```bash
sigmap
```

That writes the default context file and builds the signature index your tools will use.

## 3. Ask a real question

```bash
sigmap ask "explain the auth flow"
```

This creates a focused context file for the current task instead of forcing the model to reason over the whole repo.

## 4. Validate the coverage

```bash
sigmap validate --query "auth login token"
```

If coverage is low, fix that before trusting the answer.

## 5. Judge the answer

Save the model answer to a file, then score its groundedness:

```bash
sigmap judge --response response.txt --context .context/query-context.md
```

That tells you whether the answer looks supported by the supplied code context.

## Optional automation

If you want SigMap to stay fresh in the background:

```bash
sigmap --setup
sigmap --watch
```

`--setup` installs the git hook and MCP config. `--watch` is best during active coding.

## Optional local learning

If a file was especially helpful or misleading, reinforce that locally:

```bash
sigmap learn --good src/auth/service.js
sigmap weights
```

## Next steps

- Daily workflow: [ask](/guide/ask), [validate](/guide/validate), [judge](/guide/judge), [learning](/guide/learning)
- Reference: [CLI](/guide/cli), [Config](/guide/config)
- Integrations: [MCP server](/guide/mcp), [Repomix integration](/guide/repomix)
- Proof: [Benchmark overview](/guide/benchmark)
