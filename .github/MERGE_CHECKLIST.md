# Contributor PR Merge Checklist

Use this when merging contributor PRs into `develop`.

## Before clicking merge

- [ ] CI passed (all tests green)
- [ ] Docs updated if needed
- [ ] `CHANGELOG.md` has contributor credit line (format: `- Description by @username in #PR`)
- [ ] Benchmark claims not changed without data
- [ ] No new runtime dependencies

## Merge strategy

**Option A: Squash merge** (recommended for clean history)
```bash
# GitHub will prompt — use this title format:
type: description (closes #N)

# Example:
feat: add Godot GDScript extractor (closes #146)
```

In commit body, add:
```
Co-authored-by: Contributor Name <email@example.com>
```

**Option B: Merge commit** (if contributor has clean commits)
```
Use only if PR has well-organized commits worth preserving
```

## After merge

- [ ] Delete the feature branch (GitHub prompts)
- [ ] All tests still passing on `develop`
- [ ] Contributor thanked in comment

## Label the PR

Add labels before merging:
- Type: `bug` / `enhancement` / `docs` 
- Area: `parser` / `adapter` / `mcp` / etc.
- Status: `good first issue` if applicable
