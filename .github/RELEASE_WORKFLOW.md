# Release Workflow

SigMap uses a three-step release cycle: **develop** (integration) → **main** (stable) → GitHub Release.

---

## Phase 1: Merge Contributor PRs into Develop

When a contributor opens a PR against `develop`:

### Review checklist

```bash
# 1. Check CI passed
# 2. Verify CHANGELOG.md has credit line:
#    - Description by @username in #PR_NUMBER.

# 3. Verify docs updated (if user-facing)
# 4. Label the PR (bug, enhancement, parser, etc.)
```

### Merge strategy

**Squash merge** (recommended):
```bash
# GitHub UI → "Squash and merge"
# Title: feat: description (closes #123)
# Body:
#   Co-authored-by: Contributor Name <email@example.com>
```

**Merge commit** (if commits are clean):
```bash
# GitHub UI → "Create a merge commit"
# Use if contributor has well-organized commits
```

### After merge

- [ ] Delete feature branch
- [ ] Run tests: `npm test` & `npm run test:integration`
- [ ] Leave thank-you comment on PR

---

## Phase 2: Release Develop → Main

When ready to release (weekly, bi-weekly, or on-demand):

### Step 1: Prepare release branch

```bash
git checkout develop
git pull origin develop
git checkout -b release/vX.Y.Z
```

### Step 2: Update version

```bash
# Decide: patch (bug/docs) | minor (feature) | major (breaking)
npm version patch --no-git-tag-version

# Verify package.json updated
cat package.json | grep '"version"'
```

### Step 3: Finalize CHANGELOG.md

Move `[Unreleased]` entries to `[X.Y.Z] — YYYY-MM-DD`:

```markdown
## [X.Y.Z] — 2026-05-10

### Added
- Feature by @alice in #123
- Feature by @bob in #124

### Fixed
- Bug fix by @carol in #125

### Docs
- Docs update by @dave in #126

### Contributors
Thanks to @alice, @bob, @carol, @dave for this release.
```

### Step 4: Run final checks

```bash
npm test
npm run test:integration
```

If docs changed:
```bash
cd docs-vp && npm ci && npm run docs:build && cd ..
```

### Step 5: Commit release

```bash
git add package.json CHANGELOG.md
git commit -m "chore(release): vX.Y.Z

Includes: feature, fix, docs updates
Contributors: @alice, @bob, @carol"

git push -u origin release/vX.Y.Z
```

### Step 6: Create release PR

```bash
gh pr create \
  --title "Release vX.Y.Z" \
  --body-file release-notes.txt \
  --base main \
  --head release/vX.Y.Z
```

Or use GitHub UI and copy template from `.github/PULL_REQUEST_TEMPLATE/release.md`.

**Include in PR body:**
- List of included PRs (copy from CHANGELOG)
- Contributor names
- Any benchmark notes
- Draft release notes

### Step 7: Merge to main

Once PR approved and CI passes:

```bash
# GitHub UI: Merge with "Create a merge commit"
# Do NOT squash — preserve version commit
```

---

## Phase 3: GitHub Release

After merge to `main`:

### Create release

```bash
gh release create vX.Y.Z \
  --title "SigMap vX.Y.Z" \
  --notes-file release-notes.txt
```

**Release notes format:**

```markdown
## Highlights

- Feature 1
- Feature 2
- Performance improvement

## Contributors

Thanks to @alice, @bob, @carol for this release.

## Changes

### Added
- Feature by @alice in #123

### Fixed
- Bug by @bob in #124

### Docs
- Docs by @carol in #125

---

**[Changelog](https://github.com/manojmallick/sigmap/blob/main/CHANGELOG.md)**
```

### Announce release

Post on:
- GitHub Discussions (if any)
- Twitter/X (optional)
- Dev community (if significant)

---

## Timeline Example

```
Monday:   Contributor opens PR on develop
Tuesday:  You review, merge (with credit)
Friday:   Gather 3-5 merged PRs
          Create release/vX.Y.Z branch
          Update version + CHANGELOG
          Open release PR to main
Saturday: Merge to main
          Create GitHub release
          Thank contributors publicly
```

---

## Automation checklist

Already set up:
- ✓ CI runs on develop + main
- ✓ Docs build on PR
- ✓ PR template prompts for labels
- ✓ CONTRIBUTING.md explains workflow
- ✓ Release checklist documented

Optional future automation:
- [ ] Auto-generate changelog from PR labels
- [ ] Auto-bump version in CI
- [ ] Draft release notes from merged PRs
- [ ] Auto-post release notes to discussions

---

## Quick reference

| Step | Command | When |
|------|---------|------|
| Merge PR | Squash merge via GitHub UI | After review |
| Prepare release | `npm version patch` | Weekly or on-demand |
| Finalize changelog | Edit CHANGELOG.md | Before release PR |
| Test | `npm test && npm run test:integration` | Before merge to main |
| Release PR | `gh pr create --base main` | When develop is ready |
| GitHub release | `gh release create` | After merge to main |

---

## FAQ

**Q: Do I have to wait for a schedule to release?**  
A: No. Release anytime — develop is always stable (CI passes). Every merge to main is a valid release.

**Q: Should I do one commit per PR or squash?**  
A: Squash recommended (one clean commit per merged PR). Merge commit only if contributor's commits are already clean.

**Q: How do I credit contributors?**  
A: In three places:
1. Merged PR comment: "Thanks for the contribution!"
2. CHANGELOG.md: `- Description by @username in #PR_NUMBER`
3. GitHub release notes: List names in highlights

**Q: What if a contributor hasn't added a CHANGELOG line?**  
A: Ask in review comment, then add it when merging.

**Q: Can I release without updating version?**  
A: No. Version in `package.json` should match released tag. Use `npm version patch/minor/major`.
