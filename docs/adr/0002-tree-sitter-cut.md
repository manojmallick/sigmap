# ADR 0002 – Tree-sitter Permanently Cut

**Status:** Accepted

**Context:**
- SigMap originally considered Tree-sitter for parsing to get exact symbol locations.
- Tree-sitter would introduce a heavy dependency (C library + JS bindings) and compile-time complexity.
- The opt-in form was rejected in G13 because it added maintenance burden without deterministic benefits.
- SigMap achieves full coverage with regex-based extractors and manual parsing where needed.

**Decision:**
- Permanently removed Tree-sitter from the dependency graph.
- Keep regex-based extraction as the primary method.
- Use manual parsing only for edge cases where regex fails.
- Document known regex limitations in KNOWN_LIMITATIONS.md.

**Consequences:**
- Zero external dependencies (aligned with zero-dep score).
- Deterministic output (no compiled binary variations).
- Simpler build and CI.
- Reduced maintenance surface area.
- Some edge cases may have slightly less precise extraction, but acceptable given the trade-offs.

**References:**
- `docs/adr/0013-tree-sitter-optin.md` (rejected opt-in form)
- `KNOWN_LIMITATIONS.md` (regex gaps)
- `src/extractors/*` (current extraction implementations)