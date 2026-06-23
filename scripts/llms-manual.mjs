// Manual sections for llms.txt / llms-full.txt (issue #242).
//
// These three blocks are NOT derivable from code — they reflect product
// philosophy, legal wording, and brand positioning. The generator injects them
// verbatim and never overwrites them. Review quarterly (Q3 2026, Q4 2026, …) and
// when EU compliance guidance or major positioning changes.

export const tagline = `The deterministic, verifiable grounding layer for AI code work.
A reproducible signature-and-evidence map that agents, CI, and reviewers can trust and audit. No embeddings, no vector DB, fully offline.`;

export const solves = `## What SigMap solves

- AI agents hallucinate functions, files, and imports that don't exist — \`verify-ai-output\` flags fabricated references before you trust them.
- Agents load 60–80K tokens of raw source just to orient — \`ask\` ranks the codebase and sends ~2K tokens of the relevant signatures.
- Cold start every session — \`note\` + the \`read_memory\` MCP tool carry decisions and focus across sessions.
- No blast-radius awareness before editing a hub file — \`--impact\` shows every file a change touches.
- Pasted stack traces, CI logs, and JSON bloat the prompt — \`squeeze\` minimizes them and enriches the top frame from the symbol index.`;

export const projectDescription = `SigMap is the deterministic, verifiable grounding layer for AI code work. It
extracts function and class signatures from a codebase and builds a byte-stable
signature-and-evidence map that agents, CI, and reviewers can trust and audit —
proving which files and symbols are real before acting. Deterministic TF-IDF
ranking keeps the relevant context in scope (cutting tokens ~97% as a side
effect), with no LLM calls, embeddings, or vector database. Works with Claude,
Cursor, GitHub Copilot, Aider, Windsurf, local LLMs, and MCP.`;

export const doesNotDo = `## What SigMap does not do

- **No embeddings / vector database.** Ranking is deterministic TF-IDF over
  extracted signatures — reproducible and offline, not a semantic vector search.
- **No code execution.** SigMap reads source statically; it never runs your code.
- **No network calls** on the core generate/ask/verify paths. Nothing is uploaded;
  generation works fully offline.
- **Not a linter or type checker.** It maps and ranks code structure; it does not
  judge correctness (use \`verify-ai-output\` only to flag *fabricated* references).
- **Not a full file reader.** It emits signatures + line anchors; an agent fetches
  exact bodies on demand via the \`get_lines\` MCP tool.
- **No telemetry.** Usage tracking (\`--track\`, \`.context/usage.ndjson\`) is local
  and opt-in; nothing leaves your machine.`;

export const compliance = `## Compliance evidence support

SigMap can surface repository facts that *support* technical-evidence narratives
(e.g. DORA Art. 8–11, NIS2 Art. 21, ISO 27001 A.8) — it is a **technical evidence
pack**, never a certification or a "compliance report". Signed evidence packs are
planned for a later release. Any compliance-adjacent wording is reviewed against
the relevant regulation before publication; SigMap makes no legal claims.`;

export const positioning = `SigMap — the deterministic, verifiable grounding layer for AI code work. The
reproducible signature-and-evidence map agents, CI, and reviewers can audit,
which agentic grep cannot produce.`;
