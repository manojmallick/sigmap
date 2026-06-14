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
      content: "https://sigmap.io/guide/quick-start"
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

## 5. Get the AI response

Copy the context and ask your AI assistant:

```bash
# Display the focused context (already created in step 3)
cat .context/query-context.md
# → Copy this into Claude, Copilot, ChatGPT, or your IDE chat
# → Ask: "Explain the auth flow" (paste the context first)
# → Copy the AI's answer
```

Save the AI's response to a file:

```bash
# Create response.txt with the AI's answer
cat > response.txt << 'EOF'
<Paste the AI's answer here>
EOF
```

## 6. Judge the answer

Score whether the AI's answer is grounded in your code:

```bash
sigmap judge --response response.txt --context .context/query-context.md
# Output: Score (0.0–1.0) and PASS/FAIL indication
```

That tells you whether the answer looks supported by the supplied code context.

## 7. Optional: Stay fresh with automation

If you want SigMap to stay fresh in the background:

```bash
sigmap --setup
sigmap --watch
```

`--setup` installs the git hook and MCP config. `--watch` is best during active coding.

## 8. Optional: Local learning

If a file was especially helpful or misleading, reinforce that locally:

```bash
sigmap learn --good src/auth/service.js
sigmap weights
```

## Next steps

- Daily workflow: [ask](/guide/ask), [validate](/guide/validate), [judge](/guide/judge), [learning](/guide/learning)
- Reference: [CLI](/guide/cli), [Config](/guide/config)
- **Integrations:**
  - [Open-source agents](/guide/agents) — OpenCode, Aider, OpenHands, Cline
  - [Local LLMs](/guide/local-llms) — Ollama, llama.cpp, vLLM (no API keys)
  - [MCP server](/guide/mcp) — Claude Code, Cursor, Windsurf
  - [Repomix integration](/guide/repomix)
- Proof: [Benchmark overview](/guide/benchmark)
