#!/usr/bin/env bash
# Usage: ./scripts/release.sh 1.6.0
#
# Syncs version across all release-critical files, commits, tags, and pushes.
# The GitHub Actions pipeline handles the rest:
#   → npm publish  (NPM_TOKEN secret)
#   → GitHub Packages publish  (GITHUB_TOKEN — automatic)
#   → VS Code Marketplace publish  (VSCE_PAT secret)
#   → GitHub Release (auto-generated notes)

set -euo pipefail

VERSION="${1:-}"

if [ -z "$VERSION" ]; then
  echo "Usage: ./scripts/release.sh <version>   e.g. ./scripts/release.sh 1.6.0"
  exit 1
fi

# Validate semver format
if ! echo "$VERSION" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+$'; then
  echo "ERROR: version must be semver without a leading 'v', e.g. 1.6.0"
  exit 1
fi

# Make sure the working tree is clean
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "ERROR: working tree has uncommitted changes — commit or stash first"
  git status --short
  exit 1
fi

echo "→ Releasing v$VERSION"

# 1. Sync versions across manifests and runtime constants
node scripts/sync-versions.mjs "$VERSION"
echo "  ✓ version sync complete"

# 4. Rebuild bundle so gen-context.standalone.js stays in sync
if [ -f scripts/bundle.js ]; then
  node scripts/bundle.js > /dev/null 2>&1 || true
  echo "  ✓ bundle rebuilt"
fi

# 5. Stage and commit
git add \
  package.json \
  packages/core/package.json \
  packages/cli/package.json \
  gen-context.js \
  src/mcp/server.js \
  vscode-extension/package.json \
  jetbrains-plugin/build.gradle.kts
# Include standalone bundle only if it is tracked (not in .gitignore)
if git ls-files --error-unmatch gen-context.standalone.js > /dev/null 2>&1; then
  git add gen-context.standalone.js
fi

git commit -m "chore: release v$VERSION"

# 6. Tag and push
git tag "v$VERSION"
git push
git push origin "v$VERSION"

echo ""
echo "✓ Tag v$VERSION pushed — pipeline is running:"
echo "  https://github.com/manojmallick/sigmap/actions"
echo ""
echo "Required GitHub Secrets (must be set before pipeline publishes):"
echo "  NPM_TOKEN  — Automation token from npmjs.com/settings/tokens"
echo "  VSCE_PAT   — PAT from dev.azure.com with Marketplace (Publish) scope"
echo "  GITHUB_TOKEN is automatic — no action needed"
