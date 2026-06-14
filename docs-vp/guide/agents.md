---
title: Open-source agents and local LLM workflows
description: Integrate SigMap with OpenCode, OpenHands, Cline, Aider, and local LLMs via Ollama, llama.cpp, vLLM. Model-agnostic context for any inference backend.
head:
  - - meta
    - property: og:title
      content: "SigMap + Open-Source Agents — OpenCode, Aider, Ollama, llama.cpp"
  - - meta
    - property: og:description
      content: "Use SigMap with open-source coding agents and local LLM inference. Works with OpenCode, OpenHands, Cline, Aider, Ollama, llama.cpp, vLLM."
  - - meta
    - property: og:url
      content: "https://sigmap.io/guide/agents"
  - - meta
    - property: og:type
      content: article
  - - meta
    - name: keywords
      content: "sigmap opencode, sigmap aider, sigmap ollama, sigmap llama.cpp, local llm, open-source agents, self-hosted llm"
---

# Open-source agents and local LLM workflows

SigMap is **model-agnostic** — it works with any AI assistant or inference backend that consumes markdown context files. Whether you're using a proprietary cloud API or running an open-source model locally, SigMap handles context generation the same way.

This guide shows how to integrate SigMap with popular open-source coding agents and local inference backends.

## Model-agnostic context generation

SigMap produces plain markdown files containing your codebase signatures and context. Any tool that reads markdown can use SigMap output:

```bash
sigmap  # generates .github/copilot-instructions.md
```

Your AI agent reads this file, either by:
1. **Manual paste** — copy the markdown into your chat
2. **File watcher** — auto-reload when you run `sigmap --watch`
3. **IDE integration** — MCP, .cursor/mcp.json, or Claude Code settings
4. **API integration** — HTTP fetch from a local endpoint
5. **CLI pipe** — direct stdout stream to your model

---

## Open-source coding agents

### OpenCode

**Status:** ⭐ **Most popular** (157k GitHub stars)  
**Type:** Open-source coding agent  
**Model:** Works with OpenAI API (default) or OpenAI-compatible servers (Ollama, local vLLM)

OpenCode is the most widely-adopted open-source coding agent in the LocalLLM community. It integrates with SigMap via file context injection.

#### Setup with SigMap

1. **Generate base context**
   ```bash
   sigmap
   # Writes: .github/copilot-instructions.md
   ```

2. **Start OpenCode**
   ```bash
   # With cloud LLM (OpenAI, Anthropic, etc.)
   opencode --model gpt-4

   # With local inference (see "Local LLM inference" section below)
   opencode --api-base http://localhost:8000 --model local-model
   ```

3. **Inject context in OpenCode**  
   When OpenCode opens the file editor, paste the contents of `.github/copilot-instructions.md` at the top of your current file as a comment block:
   
   ```javascript
   // === SigMap context (paste from .github/copilot-instructions.md) ===
   // ## File signatures
   // auth/login.js: login(email, password) → Promise<{token, user}>
   // auth/verify.js: verify(token) → boolean
   // ... (rest of context)
   // ===
   
   // Your actual code here
   ```

4. **Auto-refresh context during active development**  
   Keep OpenCode running while you code:
   ```bash
   sigmap --watch
   ```
   OpenCode will see the updated `.github/copilot-instructions.md` when you reload the editor.

#### Integration pattern

OpenCode's strength is **local development with full IDE awareness**. Use SigMap to pre-select relevant files before asking:

```bash
# Before asking OpenCode about auth, rank the files
sigmap ask "How is authentication handled?" --top 10
# Copy those file signatures into the context

# Then ask OpenCode: "Given the file signatures, explain the auth flow"
```

---

### OpenHands

**Status:** ⭐ **Growing** (75k GitHub stars)  
**Type:** Open-source autonomous agent  
**Model:** Works with any OpenAI-compatible API

OpenHands runs as a web interface and can be configured to read codebase context.

#### Setup with SigMap

1. **Generate context**
   ```bash
   sigmap --json > /tmp/sigmap-context.json
   ```

2. **Start OpenHands with context path**
   ```bash
   CONTEXT_FILE=/path/to/.github/copilot-instructions.md openhands
   ```

3. **Use SigMap in prompts**  
   In the OpenHands chat, reference the context:
   ```
   Review the files in .github/copilot-instructions.md and explain the auth system.
   ```

---

### Cline / Roo Code

**Status:** ⭐ **Popular** (61k GitHub stars)  
**Type:** Open-source coding agent for VS Code/Cursor  
**Model:** Works with OpenAI API or local models (via OpenAI-compatible Base URL)

Cline and Roo Code are VSCode/Cursor extensions that provide agent-like coding assistance.

#### Setup with SigMap

1. **Install Cline or Roo Code**
   ```bash
   # In VS Code: Install from Extensions → search "Cline" or "Roo Code"
   ```

2. **Configure to use SigMap context**  
   In your Cline settings (`.cline.md` in project root):
   ```bash
   # Auto-include SigMap context
   sigmap
   ```

3. **Use in Cline prompts**  
   Start your Cline request with:
   ```
   Read .github/copilot-instructions.md as project context, then implement X.
   ```

---

### Aider

**Status:** ⭐ **Established** (41k GitHub stars)  
**Type:** Open-source AI pair programmer (CLI)  
**Model:** Works with OpenAI API or local models

Aider is a terminal-based AI pair programmer that can reference external context files.

#### Setup with SigMap

1. **Generate context**
   ```bash
   sigmap
   ```

2. **Add SigMap output to Aider's context**
   ```bash
   # Copy the context file to Aider's awareness
   cp .github/copilot-instructions.md .aider.context.md
   ```

3. **Use Aider with context**
   ```bash
   aider --file src/auth.js \
     --read .aider.context.md \
     "Implement the login handler using the context provided"
   ```

---

## Local LLM inference backends

These are **inference engines**, not coding agents. They run the actual LLM model. Pair them with an agent (Cline, OpenCode, Aider) above using the "OpenAI-compatible Base URL" pattern (see next section).

### Ollama

**Model serving:** ✓ Local, ✓ GPU-accelerated  
**Setup time:** 2 minutes  
**Best for:** Macs, Docker, simple setup

[Ollama](https://ollama.ai) is the simplest way to run local models.

#### Install and run

```bash
# macOS: brew install ollama
# Linux: curl https://ollama.ai/install.sh | sh
# Windows: https://ollama.ai/download

# Start Ollama
ollama serve

# In another terminal, pull a model
ollama pull llama2-uncensored  # or deepseek-coder, mistral, etc.
```

#### Verify it's running

```bash
curl http://localhost:11434/api/generate \
  -d '{"model":"llama2-uncensored","prompt":"Hello"}'
```

#### Use with SigMap + OpenCode

When Ollama is running, point your agent to it:

```bash
# OpenCode with local Ollama
opencode --api-base http://localhost:11434 --model llama2-uncensored
```

---

### llama.cpp

**Model serving:** ✓ Lightweight, ✓ CPU/GPU  
**Setup time:** 5 minutes  
**Best for:** Resource-constrained machines, maximum control

[llama.cpp](https://github.com/ggerganov/llama.cpp) is a C++ inference engine optimized for GGUF quantized models.

#### Install and run

```bash
# Clone
git clone https://github.com/ggerganov/llama.cpp
cd llama.cpp

# Build
make

# Download a GGUF model (e.g., from HuggingFace)
# Example: mistral-7b-instruct.Q4_K_M.gguf

# Start server
./server -m mistral-7b-instruct.Q4_K_M.gguf \
  --port 8080 \
  -ngl 35  # GPU layers (adjust for your GPU)
```

#### Use with SigMap

```bash
# Point any OpenAI-compatible tool to llama.cpp
opencode --api-base http://localhost:8080/v1 --model model-name
```

---

### vLLM

**Model serving:** ✓ High-throughput, ✓ Multi-GPU  
**Setup time:** 10 minutes  
**Best for:** Production, high concurrency, or server deployments

[vLLM](https://docs.vllm.ai/) is a fast inference server for LLMs.

#### Install and run

```bash
pip install vllm

# Start vLLM with a model
python -m vllm.entrypoints.openai.api_server \
  --model mistralai/Mistral-7B-Instruct-v0.1 \
  --port 8000 \
  --dtype half  # Use fp16
```

#### Use with SigMap

```bash
opencode --api-base http://localhost:8000/v1 --model mistral
```

---

### LM Studio

**Model serving:** ✓ GUI-based, ✓ Beginner-friendly  
**Setup time:** 3 minutes  
**Best for:** Non-technical users, macOS/Windows

[LM Studio](https://lmstudio.ai) provides a UI for downloading and serving models locally.

#### Setup

1. Download and install LM Studio
2. Search for a model (e.g., "mistral", "llama2-uncensored")
3. Click "Download"
4. Click "Start Server"
5. Note the API address (default: `http://localhost:1234/v1`)

#### Use with SigMap

```bash
opencode --api-base http://localhost:1234/v1 --model [model-name]
```

---

## Bridge pattern: OpenAI-compatible Base URL

This is the **universal integration pattern** that connects any agent to any inference backend.

### How it works

Most modern agents (OpenCode, Aider, Cline, etc.) accept an `--api-base` flag that overrides the default OpenAI endpoint. This allows you to point them at any OpenAI-compatible API server:

```bash
Agent --api-base http://localhost:8000/v1 --model local-model
```

### Unified workflow

1. **Start any local inference backend**
   ```bash
   ollama serve                    # or llama.cpp, vLLM, LM Studio
   ```

2. **Point agent at it**
   ```bash
   opencode --api-base http://localhost:8000/v1 --model mistral
   ```

3. **Use SigMap as usual**
   ```bash
   sigmap
   sigmap ask "Where is auth?"
   ```

### Inference backends by API compatibility

| Backend | API Compatible | Base URL Example |
|---------|---|---|
| Ollama | ✓ Yes | `http://localhost:11434` (note: no `/v1`) |
| llama.cpp | ✓ Yes | `http://localhost:8080/v1` |
| vLLM | ✓ Yes | `http://localhost:8000/v1` |
| LM Studio | ✓ Yes | `http://localhost:1234/v1` |
| text-generation-webui | ✓ Yes | `http://localhost:5000/v1` |

---

## Advanced: MCP for open-source agents

If your agent supports MCP (Model Context Protocol), you can integrate SigMap as a live tool:

### OpenCode with SigMap MCP

```bash
# 1. Install OpenCode
npm install -g opencode

# 2. Generate SigMap MCP config
sigmap --setup

# 3. Start OpenCode with MCP enabled
opencode --enable-mcp --mcp-config ./gen-context.js --mcp
```

This gives OpenCode **9 live tools** to query your codebase on-demand.

---

## Comparison: Agents vs backends

| Category | What it is | Examples | Role |
|----------|-----------|----------|------|
| **Coding Agent** | Orchestrates coding tasks | OpenCode, Aider, Cline | Decides what to do, calls models, edits code |
| **Inference Backend** | Runs the actual LLM | Ollama, llama.cpp, vLLM | Executes the model, returns text |
| **Context Provider** | Supplies relevant context | SigMap, Repomix | Feeds code context to agents/models |

**Key insight:** You can mix and match. SigMap works with any combination:
- OpenCode (agent) + Ollama (local inference) + SigMap (context)
- Aider (agent) + vLLM (local inference) + SigMap (context)
- Cline (agent) + Claude API (cloud) + SigMap (context)

---

## FAQ

### Can I use SigMap with proprietary agents?

Yes. SigMap generates plain markdown that any agent can read. Clipboard paste is the lowest common denominator.

### Do I need GPUs for local inference?

No. CPU inference works fine for coding tasks (author uses M3 MacBook CPU). GPU accelerates inference ~3–5×.

### What's a good model for coding tasks?

- **Mistral 7B** — 7B params, strong code quality, fast inference
- **DeepSeek Coder 6.7B** — Specialized for code, very good quality
- **Llama 2 13B** — Larger, slower, better reasoning
- **CodeLlama 34B** — Specialized for code, high quality

Use `ollama pull <model>` to download.

### How do I measure my setup's effectiveness?

Evaluate your SigMap context against real coding tasks:

```bash
sigmap validate --query "your question"
```

This shows whether SigMap ranked the right files in the top 10. For comprehensive evaluation with your local LLM setup, use the benchmark guides at [Local LLMs](/guide/local-llms).
### How do I benchmark my local setup?

```bash
sigmap benchmark --model local-model
```

This runs the SigMap benchmark suite against your local LLM and reports hit@5, task success, and token reduction.

---

## Next steps

- **Local LLM guide:** [Using SigMap with Local LLMs](/guide/local-llms)
- **MCP integration:** [MCP server setup](/guide/mcp)
- **Benchmark:** [Measure your setup](/guide/benchmark)
- **Config:** [Advanced configuration](/guide/config)
