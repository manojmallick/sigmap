# Prerelease Workflow Guide

## Overview

The **Prerelease** workflow (`prerelease-publish.yml`) allows you to safely test new versions across all platforms (npm, VS Code, JetBrains, Open VSX, GitHub Packages) without affecting production releases.

This workflow is **separate from** the production `npm-publish.yml` and uses manual triggering for controlled testing.

---

## When to Use

✅ **Use Prerelease Workflow When:**
- Testing a new version before full release
- Validating changes across all platforms
- Gathering feedback from early testers
- Verifying fixes for reported issues
- Testing CI/CD pipeline changes

❌ **Do NOT Use Prerelease Workflow For:**
- Production releases (use `npm-publish.yml` instead)
- Hotfixes to released versions (merge to `main`, trigger `npm-publish.yml`)
- Documentation-only changes

---

## How to Trigger

### Via GitHub UI

1. Go to **Actions** → **Prerelease** workflow
2. Click **Run workflow**
3. Choose prerelease options:
   - **Prerelease type:** `alpha`, `beta`, or `rc`
   - **Build number:** `1`, `2`, `3`, etc.
4. Click **Run workflow**
5. Wait ~15 minutes for all platforms to complete

### Via CLI

```bash
# Requires gh CLI installed
gh workflow run prerelease-publish.yml \
  --ref main \
  -f prerelease_type=beta \
  -f build_number=1
```

---

## Example Versions Generated

| Input | Version Generated | npm Tag |
|-------|-------------------|---------|
| alpha.1 | 3.0.1-alpha.1 | `@alpha` |
| alpha.2 | 3.0.1-alpha.2 | `@alpha` |
| beta.1 | 3.0.1-beta.1 | `@beta` |
| rc.1 | 3.0.1-rc.1 | `@rc` |

---

## What Happens Inside the Workflow

### 1. **Test Gate** ✓
- Runs full test suite (`node test/run.js`)
- Must pass before proceeding
- Ensures no broken changes

### 2. **Version Bumping** 
- Updates `package.json` (root)
- Updates `vscode-extension/package.json`
- Updates `jetbrains-plugin/build.gradle.kts`
- Commits changes to current branch

### 3. **Platform Publishing** (parallel)

| Platform | Command | Tag/Channel |
|----------|---------|-------------|
| **npm** | `npm publish --tag alpha` | Visible as `@alpha` tag |
| **GitHub Packages** | `npm publish` (scoped) | Same version as npm |
| **VS Code** | `vsce publish --pre-release` | Marked as prerelease |
| **Open VSX** | `ovsx publish` | Not marked as latest |
| **JetBrains** | `./gradlew publishPlugin` | Prerelease channel |

### 4. **GitHub Release**
- Creates release tagged `v3.0.1-alpha.1` (etc.)
- Marked as **prerelease** (not shown as latest)
- Includes `.vsix` attachment for manual install
- Auto-generated release notes

---

## For Testers: How to Install Prerelease Versions

### npm
```bash
# Install specific prerelease tag
npm install sigmap@alpha
npm install sigmap@beta
npm install sigmap@rc

# Or install specific version
npm install sigmap@3.0.1-beta.1
```

### VS Code Extension
1. Go to **Extensions** → Search "SigMap"
2. In extension details, toggle **"Show Prerelease Versions"**
3. Prerelease versions appear below stable versions
4. Click **Install** on prerelease

### Open VSX Registry
- Prerelease versions appear in [openvsx.org](https://openvsx.org)
- Install via VS Code normally (works for VS Code forks like Cursor, Windsurf)

### JetBrains Plugins
1. Go to **Settings** → **Plugins** → **Marketplace**
2. Search "SigMap"
3. Prerelease versions shown in version dropdown
4. Click **Install**

### macOS / Global Install
```bash
# Prerelease versions work with global install too
npm install -g sigmap@beta
gen-context --version  # Shows 3.0.1-beta.1
```

---

## Workflow Behavior

### Error Handling
- ✓ If a platform has the version already published, it **skips** (not an error)
- ✗ If a platform fails in an unexpected way, **entire workflow fails**
- Retry: Fix issue → Run workflow again with same/incremented build number

### Idempotency
- Rerunning workflow with same version is **safe**
- Platforms skip publishing if version already exists
- GitHub Release creation **overwrites** if run again (idempotent)

### Rollback
- Prerelease versions don't affect production releases
- If issues found, simply **don't promote** that version
- Production workflow continues independently

---

## Monitoring Progress

### Via GitHub Actions UI
1. Go to **Actions** → **Prerelease**
2. Click latest run
3. Watch jobs complete in order:
   - `test` (must pass first)
   - `update-versions` (bumps all versions)
   - `publish-npm`, `publish-github`, `publish-vscode`, `publish-openvsx`, `publish-jetbrains` (parallel)
   - `release` (creates GitHub Release)

### Expected Duration
- Full workflow: ~10-15 minutes
- Bottleneck steps: JetBrains plugin build (3-5 min), npm publish (2-3 min)

### Output Logs
- Each job has full build output in logs
- Search for `✓ Version already on` if version exists
- Search for errors if workflow fails

---

## Troubleshooting

### npm Publish Fails
**Error:** `no_perms, Private mode enable, only admin can publish`

**Fix:** Verify `NPM_TOKEN` secret is set in GitHub Actions settings
- Go to **Settings** → **Secrets and variables** → **Actions**
- Make sure `NPM_TOKEN` exists and has write permission

### VS Code Extension Fails
**Error:** `Error: Unknown URI scheme: file:///` or marketplace upload timeout

**Fix:** 
1. Check `VSCE_PAT` secret is set (Personal Access Token from dev.azure.com)
2. Rerun workflow (often timeout issue, not actual failure)

### JetBrains Plugin Fails  
**Error:** `error: Missing credentials` or `Plugin already published`

**Fix:**
1. Check `JETBRAINS_PUBLISH_TOKEN` secret is set
2. If version exists, increment build number (alpha.1 → alpha.2)
3. Check [plugins.jetbrains.com](https://plugins.jetbrains.com) for existing version

### All Platforms Fail
**Most Common:** Version already exists on all platforms

**Fix:** Increment build number and rerun
```
Current attempt: alpha.1 (failed on publish)
Next attempt: alpha.2 (will succeed)
```

---

## Prerelease vs. Production Release

| Aspect | Prerelease | Production |
|--------|-----------|-----------|
| **Trigger** | Manual workflow_dispatch | Git tag `v*` |
| **Version Pattern** | `3.0.1-alpha.1` | `3.0.1` |
| **npm Tag** | `@alpha`, `@beta`, `@rc` | `@latest` |
| **GitHub Release** | Marked prerelease | Marked latest |
| **Marketplace Impact** | Not shown by default | Shown prominently |
| **Changelog** | Auto-generated | Manual (CHANGELOG.md) |
| **User Target** | Early adopters / testers | General users |

---

## Integration with Production Workflow

### Both Workflows Coexist
- ✓ Prerelease workflow runs independently
- ✓ Production workflow unaffected by prerelease
- ✓ Can run prerelease multiple times before prod release
- ✓ No conflicts or interference

### Version Strategy
- Prerelease: Tests against **upcoming** version (e.g., 3.0.1-beta.1 before 3.0.1 release)
- Production: Released stable version (e.g., 3.0.1)
- Never reuse same production version as prerelease (e.g., don't do 3.0.0-rc.1 then 3.0.0 from prod)

### Recommended Flow
```
1. Work on new features/fixes in feature branch
2. Merge to main (can skip for quick prerelease test)
3. Run prerelease workflow: version = 3.0.1-alpha.1
4. Collect feedback from testers
5. Fix issues found, rerun if needed: 3.0.1-alpha.2
6. When ready, bump package.json: 3.0.2
7. Create git tag: v3.0.2
8. Production workflow auto-triggers, publishes 3.0.2
```

---

## Next Steps

1. **Setup Secrets** (if not already done):
   - `NPM_TOKEN` → [npmjs.com tokens](https://www.npmjs.com/settings/tokens)
   - `VSCE_PAT` → [VS Code PAT](https://dev.azure.com)
   - `OVSX_PAT` → [Open VSX token](https://open-vsx.org)
   - `JETBRAINS_PUBLISH_TOKEN` → [JetBrains plugin token](https://plugins.jetbrains.com/docs/marketplace/plugin-upload.html)

2. **Test the Workflow**:
   - Trigger prerelease with version `3.0.1-alpha.1`
   - Wait for completion
   - Verify packages appear on each platform
   - Test install on each platform

3. **Document in Team**:
   - Share this guide with your testing team
   - Explain when to use prerelease vs. production
   - Set up feedback channel for testers

---

**Questions?** Check workflow logs or refer to platform-specific docs:
- npm: https://docs.npmjs.com/cli/v10/commands/npm-publish
- VS Code: https://code.visualstudio.com/api/working-with-extensions/publishing-extension
- JetBrains: https://plugins.jetbrains.com/docs/marketplace/plugin-upload.html
- Open VSX: https://github.com/eclipse/openvsx/wiki/Publishing-Extensions
