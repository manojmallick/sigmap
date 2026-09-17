# ADR 0003 – No LLM in Deterministic Core

**Status:** Accepted

**Context:**
- SigMap's core extraction and indexing must be deterministic and reproducible.
- LLMs introduce non-determinism, API costs, and privacy concerns.
- The core product (CLI, MCP server) should work offline with zero external dependencies.
- LLMs are only used as optional adapters for user-facing tools (OpenCode, Aider, etc.).

**Decision:**
- Core extraction uses regex-based parsers only (no LLM calls).
- LLM integration is confined to adapters (`src/adapters/`) and CLI tools that call external services.
- Deterministic core ensures byte-stable output for CI, caching, and verification.
- LLM adapters can evolve independently without breaking core determinism.

**Consequences:**
- Zero dependency on any LLM library or API.
- Fully offline core functionality (matches zero-dep score).
- Clear separation of concerns: core vs. adapters.
- Future LLM work won't affect core reproducibility.
- Users can choose local vs. cloud LLMs at the adapter level.

**References:**
- `src/adapters/` directory structure
- `src/cli/` tools that call external LLMs
- `docs/adr/0000-template.md` (template reference)