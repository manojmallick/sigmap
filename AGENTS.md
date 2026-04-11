# SigMap — AGENTS.md

Instructions for Codex-style agents working in this repository.

## Append Strategy (Required)

When writing generated signature content, never overwrite human-written notes above the marker.

Use this marker block for all appendable context files:

```
## Auto-generated signatures
<!-- Updated by gen-context.js -->
```

### Files that must use append-under-marker

1. `CLAUDE.md`
2. `.github/copilot-instructions.md`
3. `.github/gemini-context.md`

### Safe write procedure

1. Read existing file (or start with empty string if file does not exist).
2. Find the marker `## Auto-generated signatures`.
3. If marker exists: keep everything above marker unchanged; replace only marker-and-below with new generated block.
4. If marker does not exist: append marker + generated block to the end.
5. Never modify human content above marker.

### Legacy cleanup rule

If an existing generated file has no marker but contains prior SigMap-generated content headers, replace the full legacy generated content with marker + new generated block.

## Verification

After changing write logic, run:

```bash
node test/integration/multi-output.test.js
```

Expected: all tests pass, including append-preservation cases.
