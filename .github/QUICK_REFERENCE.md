# Quick Reference: Merge & Release

Print this or bookmark it. Copy-paste commands as needed.

---

## 🔀 MERGING CONTRIBUTOR PRs (Step 12)

### Checklist
```
☐ CI passed (all green)
☐ CHANGELOG.md has credit line
☐ Docs updated if needed
☐ Labels added (parser, enhancement, etc.)
☐ No new dependencies
```

### GitHub UI: Merge via "Squash and merge"

**Commit title:**
```
feat: description (closes #123)
```

**Commit body:**
```
Co-authored-by: Name <email@example.com>
```

### After merge
```bash
npm test && npm run test:integration
```

**CHANGELOG credit line format:**
```
- Description by @username in #123
```

---

## 🚀 RELEASING (Step 13)

### 1️⃣ Create release branch
```bash
git checkout develop
git pull origin develop
git checkout -b release/vX.Y.Z
```

### 2️⃣ Bump version
```bash
npm version patch    # for bug fixes / docs
npm version minor    # for new features
npm version major    # for breaking changes
```

### 3️⃣ Update CHANGELOG.md

Find `## [Unreleased]` and change to:
```markdown
## [X.Y.Z] — 2026-05-10

### Added
- Feature by @alice in #123

### Fixed
- Bug by @bob in #124

### Docs
- Docs by @carol in #125

### Contributors
Thanks to @alice, @bob, @carol.
```

### 4️⃣ Test everything
```bash
npm test
npm run test:integration
```

### 5️⃣ Commit & push
```bash
git add package.json CHANGELOG.md
git commit -m "chore(release): vX.Y.Z"
git push -u origin release/vX.Y.Z
```

### 6️⃣ Create PR to main

**GitHub UI:**
- New PR: `release/vX.Y.Z` → `main`
- Title: `Release vX.Y.Z`
- Body: Use template `.github/PULL_REQUEST_TEMPLATE/release.md`

**Include in body:**
```markdown
## Included PRs
- #123 — Feature by @alice
- #124 — Bug fix by @bob

## Contributors
Thanks to @alice, @bob, @carol.

## Verification
- [ ] All PRs merged
- [ ] Tests pass
- [ ] Version updated
- [ ] Changelog finalized
```

### 7️⃣ Merge to main
- GitHub UI: "Create a merge commit" (NOT squash)
- Deletes release branch automatically

### 8️⃣ GitHub auto-creates draft release
- Workflow runs automatically
- Draft release appears under Releases
- Review and click "Publish release"

### 9️⃣ Announce (optional)
```
SigMap vX.Y.Z shipped 🚀
Thanks to @alice, @bob, @carol for this release.
```

---

## 📋 Common commands

| Task | Command |
|------|---------|
| Merge PR (UI only) | Squash → Copy commit body template above |
| List branches | `git branch -a` |
| Check version | `grep version package.json` |
| View changelog | `head -20 CHANGELOG.md` |
| Run tests | `npm test && npm run test:integration` |
| View releases | `gh release list` |
| View release draft | `gh release view vX.Y.Z --web` |

---

## ⚠️ Common mistakes

| ❌ Mistake | ✅ Fix |
|-----------|--------|
| Forgot CHANGELOG credit | Add line, ask contributor to commit, or add on merge |
| Tests failed after merge | Revert merge, fix, re-merge |
| Version not updated | Run `npm version patch` before release PR |
| Squash-merged release commit | Should be merge commit (preserves version) |
| Forgot to update docs | Update before merging PR |

---

## 🔗 Full guides

- **Merge process:** See `.github/MERGE_CHECKLIST.md`
- **Release process:** See `.github/RELEASE_WORKFLOW.md`
- **Contributing:** See `CONTRIBUTING.md`
- **Release checklist doc:** See `docs-vp/guide/release-checklist.md`

---

## 🤖 What's automated

✓ CI runs on develop + main  
✓ Docs build on PR  
✓ Release draft auto-created when version bumped  
✓ Labels available in PR template  

---

## 📞 Need help?

- Check `.github/RELEASE_WORKFLOW.md` for detailed examples
- Review recent merged PRs for patterns
- See `CONTRIBUTING.md` for contributor guidelines
