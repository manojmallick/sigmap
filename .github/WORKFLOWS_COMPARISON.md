## Workflows Quick Reference

### Production Workflow (`npm-publish.yml`)
**When:** After full testing, ready to release to all users
**How to trigger:** Create git tag matching `v*` pattern (e.g. `v3.0.2`)
**Version:** Semantic version (e.g. `3.0.2`)
**Tags/Channels:** Always `@latest` on npm
**GitHub Release:** Marked as `latest` release
**User Expectation:** Stable, production-ready

```bash
# How to trigger production release
git tag v3.0.2
git push origin v3.0.2
# Workflow auto-triggers on tag push
```

### Prerelease Workflow (`prerelease-publish.yml`)
**When:** Want to test version on all platforms before full release
**How to trigger:** Manual via GitHub Actions UI or CLI
**Version:** Semantic with prerelease suffix (e.g. `3.0.1-beta.1`)
**Tags/Channels:** Alpha/beta/rc on npm, `@prerelease` on VS Code
**GitHub Release:** Marked as `prerelease` (not shown as latest)
**User Expectation:** Test version, early access only

---

## Use Cases

### Scenario 1: You fixed a bug and want quick testing
✅ **Use Prerelease Workflow**
1. Work on fix in feature branch
2. Merge PR to main
3. Run prerelease: `3.0.1-alpha.1`
4. Users test the fix
5. If more issues found, run again: `3.0.1-alpha.2`
6. When satisfied, bump to production: create tag `v3.0.2`

### Scenario 2: You're adding a new feature
✅ **Use Prerelease Workflow** (multi-phase)
1. Merge feature to main
2. Run prerelease beta: `3.0.2-beta.1`
3. Collect feedback for 2-3 days
4. Run RC: `3.0.2-rc.1`
5. Final testing pass
6. Promote to production: create tag `v3.0.2`

### Scenario 3: Production bug found after release
✅ **Use Production Workflow**
1. Hotfix in new branch
2. Merge to main
3. Manually bump patch version in `package.json`
4. Create git tag `v3.0.3`
5. Workflow auto-publishes to all platforms
6. Users get fix automatically via `npm install sigmap@latest`

### Scenario 4: Just continuous testing (no expected release)
✅ **Use Prerelease Workflow** frequently
- Run test builds multiple times per day
- Use build numbers: alpha.1, alpha.2, alpha.3, etc.
- Don't promote to production unless quality threshold met

---

## Version Numbering Strategy

### Semantic Versioning: `MAJOR.MINOR.PATCH`
- **MAJOR (3):** Breaking API changes
- **MINOR (0):** New backward-compatible features  
- **PATCH (1):** Bug fixes only

### Prerelease Identifiers Added After PATCH
```
3.0.1           ← Production release
3.0.2-alpha.1   ← First alpha test for upcoming 3.0.2
3.0.2-alpha.2   ← Second alpha test
3.0.2-beta.1    ← Beta phase (more stable than alpha)
3.0.2-rc.1      ← Release Candidate (nearly ready)
3.0.2           ← Final production release
```

### Rules
- ✅ Prerelease versions MUST be for version **higher** than last production
- ✗ Don't do: 3.0.1-alpha.1 after already releasing 3.0.1
- ✓ Do: 3.0.2-alpha.1 after releasing 3.0.1
- ✅ Multiple prerelease builds OK for same PATCH version
- ✅ Can skip major/minor bumps (alpha.1, alpha.2 then rc.1 still valid)

---

## Quick Decision Tree

```
Do you want to publish a new version?
├─ YES → Is it ready for all users?
│  ├─ YES (fully tested, all platforms verified)
│  │  └─→ Use PRODUCTION workflow: create tag v3.0.2
│  └─ NO (testing / collecting feedback)
│     └─→ Use PRERELEASE workflow: manual trigger alpha.1
│
└─ NO → Are you just running tests?
   └─→ Just run: node test/run.js (no workflow needed)
```

---

## Secrets Required for Both Workflows

**Required in GitHub Settings → Secrets and Variables → Actions:**

- `NPM_TOKEN` — npm registry write access
- `VSCE_PAT` — VS Code Marketplace Personal Access Token  
- `OVSX_PAT` — Open VSX Registry token
- `JETBRAINS_PUBLISH_TOKEN` — JetBrains Marketplace token

Both workflows will fail if secrets missing. Prerelease typically catches this first since used more often.

---

## File Modifications by Each Workflow

### Production Workflow (`npm-publish.yml`)
- ✓ Reads versions (doesn't modify)
- ✓ Creates GitHub Release
- ✓ No commits

### Prerelease Workflow (`prerelease-publish.yml`)
- ✓ Updates `package.json` version
- ✓ Updates `vscode-extension/package.json` version
- ✓ Updates `jetbrains-plugin/build.gradle.kts` version
- ✓ Commits changes to branch
- ✓ Creates GitHub Prerelease

**Important:** Prerelease modifies files. If running locally for testing:
```bash
# After prerelease commits, files changed:
git log --oneline | head -3
# Should show prerelease version bump commit
```

---

## Platform Status After Publishing

### After Production Release (v3.0.2)
```
npm            : 3.0.2 @latest ✓
GitHub Package : 3.0.2 ✓
VS Code        : 3.0.2 (default install) ✓
Open VSX       : 3.0.2 (default install) ✓
JetBrains      : 3.0.2 (default install) ✓
GitHub Release : v3.0.2 (latest) ✓
```

### After Prerelease (v3.0.2-beta.1)
```
npm            : 3.0.1 @latest, 3.0.2-beta.1 @beta ✓
GitHub Package : 3.0.2-beta.1 ✓
VS Code        : 3.0.1 (default), 3.0.2-beta.1 (prerelease toggle) ✓
Open VSX       : 3.0.1 (default), 3.0.2-beta.1 available ✓
JetBrains      : 3.0.1 (default), 3.0.2-beta.1 (version dropdown) ✓
GitHub Release : v3.0.2-beta.1 (prerelease) ✓
```

---

## Example Timeline

```
Day 1 - New Feature Complete
─────────────────────────────
10:00 AM  → Merge feature PR to main
10:30 AM  → Trigger prerelease: 3.0.2-alpha.1
11:00 AM  → Announce to testers
          → "Try: npm install sigmap@alpha"

Day 2-3 - Testing Phase  
─────────────────────────────
Feedback arrives with 3 bugs
Fix bug #1, trigger: 3.0.2-alpha.2
Fix bug #2, trigger: 3.0.2-alpha.3
All bugs resolved

Day 4 - Release Candidate
─────────────────────────────
2:00 PM   → Run prerelease: 3.0.2-rc.1
3:00 PM   → Final smoke tests pass
4:00 PM   → All systems go

Day 5 - Production Release
─────────────────────────────
9:00 AM   → Bump version to 3.0.2
9:05 AM   → Create tag: v3.0.2
9:10 AM   → Production workflow auto-triggers
10:00 AM  → All platforms updated to 3.0.2 @latest
          → Users get update automatically

Day 6+ - Ongoing
─────────────────────────────
3.0.2 stable on all platforms
Ready to work on 3.0.3 / 3.1.0 for next cycle
```

---

## Next Steps

1. **Test Prerelease Workflow**
   - Verify all secrets configured
   - Run first prerelease: alpha.1
   - Confirm publishes to all 5 platforms
   - Test install from each platform

2. **Use Production Workflow for Next Release**
   - Document bump logic (MAJOR.MINOR.PATCH)
   - Create git tag following `v*` pattern
   - Monitor auto-triggered production workflow

3. **Update Team Documentation**
   - Share this guide with release team
   - Document your versioning strategy
   - Set up prerelease testing SLA (how long to gather feedback)
