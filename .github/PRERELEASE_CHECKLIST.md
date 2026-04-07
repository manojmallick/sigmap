# Prerelease Testing Checklist

Use this checklist before publishing each prerelease version to ensure quality across all platforms.

## Pre-Prerelease (Local Testing)

- [ ] All local tests pass: `node test/run.js`
- [ ] Core CLI works: `node gen-context.js --version`
- [ ] Report generation works: `node gen-context.js --report`
- [ ] MCP server starts: `echo '{"jsonrpc":"2.0","method":"tools/list","id":1}' | node gen-context.js --mcp`
- [ ] Config loading works: Copy example config, verify custom paths honored
- [ ] No console.error warnings in standalone run

## Prerelease Workflow Trigger

- [ ] Decide version (e.g., `3.0.2-beta.1`)
- [ ] Choose prerelease type: alpha/beta/rc
- [ ] Set build number (1=first, 2=second from that type)
- [ ] Go to Actions → Prerelease → Run workflow
- [ ] Wait for test gate to pass
- [ ] Monitor all 5 platform publishes in parallel jobs

## Post-Prerelease Verification (15-30 min after workflow completes)

### npm Platform
- [ ] Visit [npmjs.com/package/sigmap](https://www.npmjs.com/package/sigmap)
- [ ] Verify version appears under tags (e.g., `@alpha`, `@beta`, `@rc`)
- [ ] Version NOT marked as latest (older version should be @latest)
- [ ] Verify can install: `npm install sigmap@beta` (locally)

### GitHub Packages  
- [ ] Visit [GitHub releases](https://github.com/manojmallick/context-forge/packages)
- [ ] Prerelease version visible in list
- [ ] GitHub Package registry contains the version

### VS Code Marketplace
- [ ] Search [VS Code Marketplace for SigMap](https://marketplace.visualstudio.com/items?itemName=manojmallick.sigmap)
- [ ] Toggle "Show Prerelease Versions" at bottom of page
- [ ] Prerelease version appears in version history
- [ ] NOT marked as default/latest
- [ ] Install available via "Install Prerelease" button

### Open VSX Registry
- [ ] Visit [open-vsx.org/extension/manojmallick/sigmap](https://open-vsx.org/extension/manojmallick/sigmap)
- [ ] Version appears in version list
- [ ] Can install via extension picker in VS Code forks
- [ ] Marketplace rating/reviews show correctly

### JetBrains Marketplace
- [ ] Visit [plugins.jetbrains.com/plugin/sigmap](https://plugins.jetbrains.com/plugin/21624-sigmap)
- [ ] Prerelease version in version dropdown
- [ ] Version number correct
- [ ] Compatible IDE versions listed

## Testing Phase (24-72 hours recommended)

### VS Code / Cursor / Windsurf
- [ ] Install prerelease extension in each IDE
- [ ] Extension initializes without errors
- [ ] MCP server connects (if MCP mode enabled)
- [ ] `gen-context --help` works via terminal
- [ ] Config loading works with custom paths
- [ ] Context generation completes in < 5 seconds

### JetBrains IDEs (IntelliJ, WebStorm, PyCharm, Kotlin)
- [ ] Install prerelease plugin in each IDE variant
- [ ] Plugin loads without errors in startup
- [ ] "Regenerate Context" action visible in Tools menu
- [ ] Action executes successfully
- [ ] Output files created at configured paths

### npm / Global Installation
- [ ] Uninstall any current version: `npm uninstall -g sigmap`
- [ ] Install prerelease: `npm install -g sigmap@beta`
- [ ] Verify CLI: `gen-context --version`
- [ ] Run on test project: `gen-context --report`
- [ ] Verify output tokens < 6000

### Configuration Testing
- [ ] Custom output path respected
- [ ] Exclude patterns work correctly
- [ ] Secret scanning catches test secrets
- [ ] Max tokens budget enforced
- [ ] Multiple adapters (copilot, claude, cursor) all working

## Issue Tracking during Prerelease

For each issue found:
- [ ] Document exact error message
- [ ] Record reproduction steps
- [ ] Note which platform/IDE version affected
- [ ] Check if regression or new issue
- [ ] Create GitHub issue or comment on existing

**If issues found:**
1. Fix issue in code
2. Merge PR to main (if not already)
3. Run prerelease workflow again with incremented build number
   - Example: from `3.0.2-beta.1` → `3.0.2-beta.2`
4. Re-test that specific scenario
5. Continue monitoring

## Sign-Off Criteria (when ready to promote to production)

- [ ] All 5 platforms: version published + accessible
- [ ] All 5 platforms: can install and function
- [ ] Core CLI: working correctly
- [ ] All reported issues: fixed or documented
- [ ] No regressions from previous stable version
- [ ] Acceptance rate from testers: > 90%
- [ ] Performance metrics: no degradation (token budget, speed, memory)

## Promotion to Production

Once sign-off criteria met:

- [ ] Update `package.json`: bump to final version (remove prerelease suffix)
  - Example: `3.0.2-beta.1` → `3.0.2`
- [ ] Update CHANGELOG.md: document changes since last release
- [ ] Create git tag: `git tag v3.0.2`
- [ ] Push tag: `git push origin v3.0.2`
- [ ] Production workflow (`npm-publish.yml`) auto-triggers
- [ ] Monitor workflow: should complete in 15-20 minutes
- [ ] Verify all platforms updated to new version @latest
- [ ] Announce release to users

## Post-Release Monitoring

- [ ] Check error reporting / support channels for 24-48 hours
- [ ] Monitor GitHub issues for regression reports
- [ ] Performance metrics stable (CPU, memory, startup time)
- [ ] Marketplace ratings respond positively
- [ ] No rollback needed

## Quick Troubleshooting

| Problem | Solution |
|---------|----------|
| Workflow fails on test gate | Fix failing tests, merge to main, retry prerelease |
| npm publish fails | Check NPM_TOKEN secret, rerun with incremented build |
| VS Code upload fails | Check VSCE_PAT secret, rerun (often timeout) |
| JetBrains fails | Check JETBRAINS_PUBLISH_TOKEN secret, verify version not duplicate |
| Open VSX upload fails | Check OVSX_PAT secret, verify credentials valid |
| All platforms fail | Likely version already exists — increment build number |
| Can't download after publish | Wait 2-3 minutes for CDN sync (normal for first publish) |

## Reference Documentation

- **Main Guide:** [PRERELEASE_GUIDE.md](../PRERELEASE_GUIDE.md)
- **Workflow Comparison:** [.github/WORKFLOWS_COMPARISON.md](./WORKFLOWS_COMPARISON.md)
- **Production Workflow:** `.github/workflows/npm-publish.yml`
- **Prerelease Workflow:** `.github/workflows/prerelease-publish.yml`

---

**Questions?** Ask in GitHub Discussions or submit issue with `[prerelease]` tag.
