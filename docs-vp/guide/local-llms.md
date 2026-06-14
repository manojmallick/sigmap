---
title: Using SigMap with Local LLMs
description: Run SigMap with self-hosted LLMs via Ollama, llama.cpp, or vLLM. No API keys, no cloud costs, full privacy.
head:
  - - meta
    - property: og:title
      content: "SigMap + Local LLMs — Ollama, llama.cpp, vLLM, No API Keys"
  - - meta
    - property: og:description
      content: "Use SigMap with self-hosted LLMs for code understanding. No subscription, no telemetry, full privacy. Works with Ollama, llama.cpp, vLLM."
  - - meta
    - property: og:url
      content: "https://sigmap.io/guide/local-llms"
  - - meta
    - property: og:type
      content: article
  - - meta
    - name: keywords
      content: "sigmap local llm, sigmap ollama, sigmap llama.cpp, sigmap vllm, self-hosted ai, local model, open source llm, no api key"
---

# Using SigMap with Local LLMs

Run SigMap in a fully self-hosted environment: **no API keys, no cloud costs, no telemetry, full privacy.**

SigMap + a local LLM gives you code understanding with complete control over your data.

---

## Why local LLMs?

| Aspect | Cloud LLMs | Local LLMs |
|--------|-----------|-----------|
| **Cost** | Per-token billing | One-time setup |
| **Privacy** | Data sent to API | Stays on your machine |
| **Latency** | Network dependent | <1 second per prompt |
| **Offline** | Requires internet | Fully offline |
| **Control** | Vendor lock-in | 100% yours |

For a typical development session (100 prompts × 500 tokens), cloud LLMs cost $0.50–$5 depending on the model. Local inference costs $0 after the one-time setup.

---

## Quick start (5 minutes)

### 1. Start a local LLM inference server

Pick one of these depending on your setup:

#### **macOS/Windows/Linux: Ollama** (easiest)

```bash
# Install from https://ollama.ai

# Pull a model
ollama pull mistral  # 7B, fastest
# or: ollama pull neural-chat  # optimized for chat
# or: ollama pull llama2-uncensored:13b  # larger, slower

# Start the server (runs in background on port 11434)
ollama serve
```

#### **Linux/Windows: llama.cpp** (most control)

```bash
git clone https://github.com/ggerganov/llama.cpp
cd llama.cpp
make

# Download a GGUF quantized model
# Visit https://huggingface.co/models?search=gguf for options

./server -m path/to/model.gguf --port 8080 -ngl 32
```

#### **Server deployment: vLLM** (high throughput)

```bash
pip install vllm

python -m vllm.entrypoints.openai.api_server \
  --model mistralai/Mistral-7B-Instruct-v0.1 \
  --port 8000
```

### 2. Generate SigMap context

```bash
sigmap
# Writes: .github/copilot-instructions.md
```

### 3. Use SigMap with your local LLM

#### **Option A: Open-source coding agent** (recommended)

Use [OpenCode](https://github.com/SkyworkAI/OpenCode) (open-source VS Code extension) or [Aider](https://aider.chat/) (terminal CLI):

```bash
# Aider example
aider --model openai/local \
  --api-base http://localhost:11434/v1 \
  --init-msg "Check .github/copilot-instructions.md first"
```

#### **Option B: Manual workflow**

Copy the SigMap context and paste it into your local LLM chat interface or use as system prompt:

```bash
cat .github/copilot-instructions.md | wl-copy  # Linux
cat .github/copilot-instructions.md | pbcopy   # macOS
```

---

## Per-backend setup guide

### Ollama

**Easiest. Fastest to get started. Runs on any hardware.**

#### Install

```bash
# macOS
brew install ollama

# Linux
curl https://ollama.ai/install.sh | sh

# Windows
# Download from https://ollama.ai/download
```

#### Run

```bash
ollama serve
```

The server starts on `http://localhost:11434` and stays running in the background.

#### Pull models

```bash
# Minimal (7B, 4-5GB RAM required)
ollama pull mistral

# Balanced (13B, 8-10GB RAM)
ollama pull llama2-uncensored:13b

# Specialized for coding (6.7B)
ollama pull deepseek-coder

# See all: ollama pull --help
```

#### Benchmark your setup

```bash
sigmap benchmark --model mistral --api-base http://localhost:11434/v1
```

#### Performance expectations

On a 2024 MacBook Pro M3:
- **Mistral 7B:** ~10 tokens/sec (CPU)
- **Llama2 13B:** ~4 tokens/sec (CPU)
- **With GPU:** 3–5× faster

### llama.cpp

**Most lightweight. Best for resource-constrained machines or maximum control.**

#### Install

```bash
git clone https://github.com/ggerganov/llama.cpp
cd llama.cpp
make -j4
```

#### Download a model

```bash
# From HuggingFace. Example: Mistral 7B Instruct

wget https://huggingface.co/TheBloke/Mistral-7B-Instruct-v0.1-GGUF/resolve/main/Mistral-7B-Instruct-v0.1.Q4_K_M.gguf
```

#### Run server

```bash
./server -m Mistral-7B-Instruct-v0.1.Q4_K_M.gguf \
  --port 8080 \
  -c 2048 \
  -ngl 35  # GPU layers (adjust for your GPU; -1 = all)
```

#### With Docker

```bash
docker run --rm -p 8080:8080 \
  -v $(pwd):/models \
  ghcr.io/ggerganov/llama.cpp:latest \
  -m /models/mistral-7b-instruct.gguf \
  --server
```

---

### vLLM

**For production, high concurrency, or multi-GPU setups.**

#### Install

```bash
pip install vllm

# Optional: CUDA support
pip install vllm[cuda]
```

#### Run

```bash
python -m vllm.entrypoints.openai.api_server \
  --model mistralai/Mistral-7B-Instruct-v0.1 \
  --port 8000 \
  --dtype=float16 \
  --gpu-memory-utilization 0.9
```

#### Multi-GPU

```bash
python -m vllm.entrypoints.openai.api_server \
  --model mistralai/Mistral-7B-Instruct-v0.1 \
  --port 8000 \
  --tensor-parallel-size 2  # Use 2 GPUs
```

---

## Integration patterns

### Pattern 1: SigMap context file + local chat UI

Use a local LLM interface with SigMap context:

```bash
# 1. Start Ollama
ollama serve

# 2. Start a local chat interface
# https://github.com/oobabooga/text-generation-webui
python server.py

# 3. Generate SigMap context
sigmap

# 4. Open chat UI at http://localhost:7860
# Paste .github/copilot-instructions.md into system prompt
```

### Pattern 2: Aider (terminal pair programmer)

Aider integrates with local LLMs via OpenAI-compatible API:

```bash
# Install Aider
pip install aider-chat

# Use with local Ollama
aider --model openai/local \
  --api-base http://localhost:11434/v1 \
  src/auth.js
```

Aider automatically manages SigMap context if it finds `.github/copilot-instructions.md`.

### Pattern 3: OpenCode (IDE agent)

OpenCode is an open-source VSCode extension that works with local LLMs:

```bash
# Install from VSCode extensions or:
npm install -g opencode

# Configure to use local Ollama
opencode --api-base http://localhost:11434 \
  --model mistral
```

Then use `/sigmap` command in OpenCode to inject context.

---

## Model recommendations for coding

| Model | Size | Speed | Code Quality | RAM | Download |
|-------|------|-------|--------------|-----|----------|
| **Mistral 7B** | 7B | Fast ⚡ | Good ✓ | 5GB | `ollama pull mistral` |
| **DeepSeek Coder** | 6.7B | Fast ⚡ | Very Good ✓✓ | 5GB | `ollama pull deepseek-coder` |
| **Llama2 Uncensored 13B** | 13B | Slow | Good ✓ | 9GB | `ollama pull llama2-uncensored:13b` |
| **Code Llama 34B** | 34B | Very Slow | Very Good ✓✓ | 20GB | Requires manual setup |

**Recommended for most users:** Mistral 7B or DeepSeek Coder 6.7B (fast, good quality, low RAM).

---

## Performance tuning

### Reduce token generation

Configure SigMap to lower max token output:

```json
{
  "maxTokens": 10000,
  "coverageTarget": 0.60
}
```

### Enable GPU acceleration

For Ollama:
```bash
# Automatic GPU detection on macOS (Metal)
ollama serve
```

For llama.cpp:
```bash
# Build with CUDA or Metal support
make LLAMA_CUDA=1
./server -m model.gguf -ngl 32  # 32 GPU layers
```

### Model quantization

Use smaller quantizations if RAM is limited:

```bash
# Q4 (4-bit) ≈ 50% smaller, 10–15% quality loss
ollama pull mistral:7b-instruct-q4
```

---

## Hardware requirements

| Task | Minimum | Recommended | Ideal |
|------|---------|-------------|-------|
| Mistral 7B | 4GB RAM | 8GB RAM | 12GB + GPU |
| Llama2 13B | 8GB RAM | 16GB RAM | 24GB + GPU |
| Code Llama 34B | 20GB RAM | 32GB RAM | 48GB + 2× GPU |

**Memory estimate:** `(model_size_gb × 3.5) + system_overhead`

For example, Mistral 7B needs ~25GB on disk but only ~4GB in RAM during inference.

---

## Troubleshooting

### Model too slow

- Reduce model size (use Mistral 7B instead of 13B)
- Enable GPU acceleration (`-ngl 32`)
- Use 4-bit quantization

### Out of memory

- Reduce `maxTokens` in `gen-context.config.json`
- Use a smaller model or quantization
- Add GPU if available

### API returns 404 errors

Check that your inference server is running on the correct port:

```bash
curl http://localhost:11434/api/generate \
  -d '{"model":"mistral","prompt":"hello"}'
```

### No response from local LLM

Check server logs:

```bash
# Ollama
ollama logs

# llama.cpp
# Check stdout of the server process
```

---

## Benchmarking your setup

Compare your local LLM against the SigMap benchmarks:

```bash
sigmap benchmark \
  --model mistral \
  --api-base http://localhost:11434/v1
```

This runs the full SigMap evaluation suite (90 tasks, 18 repos) against your local model and reports:
- Hit@5 (file ranking accuracy)
- Task success rate
- Token reduction
- Prompts per task

---

## Privacy and security

Local LLM setup guarantees:

✓ **No data leaves your machine** — inference runs locally  
✓ **No telemetry** — open-source models don't track usage  
✓ **No subscription** — one-time model download  
✓ **Offline capable** — works without internet after setup  
✓ **Reproducible** — same model always gives same output  

This is ideal for:
- Proprietary codebases
- Security-sensitive work
- Organizations with data residency requirements
- Users concerned about AI training data

---

## FAQ

### Can I use multiple local models in parallel?

Yes. Run multiple inference servers on different ports:

```bash
ollama serve --addr localhost:11434  # Terminal 1
ollama serve --addr localhost:11435  # Terminal 2 (with different model)
```

Then configure tools to use whichever port you need.

### How do I update models?

```bash
ollama pull mistral  # Downloads latest version
```

### Can I run local LLMs on cloud VMs?

Yes. Set up Ollama/vLLM on an EC2, GCP, or DigitalOcean instance, then point SigMap to the remote endpoint:

```bash
sigmap --api-base http://your-vm.example.com:11434/v1
```

### Should I use quantized models?

Quantized models (Q4, Q5) are 50–75% smaller with minimal quality loss. Recommended for most use cases.

Full precision models are only needed if you require maximum quality and have the VRAM.

---

## Next steps

- **Agents:** [Open-source agents guide](/guide/agents)
- **Config:** [Advanced configuration](/guide/config)
- **MCP:** [MCP server setup for Claude Code/Cursor](/guide/mcp)
- **Benchmark:** [Full benchmark methodology](/guide/benchmark)
