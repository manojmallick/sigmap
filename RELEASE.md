# Release Guide

SigMap uses **three independent release channels**, each on its own tag prefix. You can ship a VS Code patch without touching npm, or fix the JetBrains plugin without triggering binary builds.

---

## Channels at a glance

| Channel | Tag prefix | Example | Workflow(s) | Publishes to |
|---|---|---|---|---|
| **Core** (npm + binaries) | `v[0-9]*` | `v3.4.0` | `npm-publish.yml` + `release-binaries.yml` | npmjs.com, GitHub Packages, macOS/Linux/Windows binaries |
| **VS Code** | `vscode-v*` | `vscode-v3.3.2` | `release-vscode.yml` | VS Code Marketplace, Open VSX Registry |
| **JetBrains** | `jetbrains-v*` | `jetbrains-v3.3.2` | `release-jetbrains.yml` | JetBrains Marketplace |

Each channel gets its own GitHub Release entry. Plugin/extension versions do **not** need to match the core version — patch releases can diverge freely.

---

## Core release (`v*`)

Publishes the npm package and standalone binaries. All three run in parallel off the same tag.

```
npm-publish.yml:
  test  →  publish-npm  →  publish-github  →  create-release
release-binaries.yml (parallel):
  build (macos / linux / windows)  →  attach binaries + checksums to GitHub Release
```

**Prerequisites:**
- `package.json` `.version` must match the tag (checked by CI; will fail otherwise)
- Secrets: `NPM_TOKEN`

**Steps:**

```sh
# 1. Bump version in package.json, packages/core/package.json, packages/cli/package.json
node scripts/sync-versions.mjs 3.4.0        # or edit manually

# 2. Commit the bump
git add -A && git commit -m "chore: release v3.4.0"

# 3. Tag and push
git tag v3.4.0
git push origin main v3.4.0
```

CI runs: version gate → npm publish (with provenance) → GitHub Packages publish → GitHub Release created → binaries built and attached.

---

## VS Code / Open VSX release (`vscode-v*`)

Publishes the extension independently from core. CI patches `vscode-extension/package.json` version automatically from the tag — no manual edit needed.

```
release-vscode.yml:
  publish-vscode (VSCE_PAT)
  publish-openvsx (OVSX_PAT)     ← runs in parallel
        ↓ both succeed
  create-release (with .vsix attached)
```

**Prerequisites:**
- Secrets: `VSCE_PAT` (VS Code Marketplace personal access token), `OVSX_PAT` (Open VSX token)

**Steps:**

```sh
# No file edits needed — CI derives the version from the tag itself.
git tag vscode-v3.3.2
git push origin vscode-v3.3.2
```

CI runs: version patched in package.json → `vsce publish` → `ovsx publish` → GitHub Release with `.vsix` attached.

**If a version is already published:** CI treats `"already exists"` as a non-error and skips gracefully.

---

## JetBrains release (`jetbrains-v*`)

Publishes the IntelliJ-family plugin independently. CI patches `jetbrains-plugin/build.gradle.kts` version from the tag.

```
release-jetbrains.yml:
  publish-jetbrains (JETBRAINS_PUBLISH_TOKEN)
        ↓ succeeds
  create-release (with .zip attached)
```

**Prerequisites:**
- Secrets: `JETBRAINS_PUBLISH_TOKEN`
- Java 17 (provisioned by CI via `actions/setup-java`)

**Steps:**

```sh
# No file edits needed — CI derives the version from the tag itself.
git tag jetbrains-v3.3.2
git push origin jetbrains-v3.3.2
```

CI runs: `build.gradle.kts` version patched → `gradlew buildPlugin verifyPlugin runPluginVerifier` → `gradlew publishPlugin` → GitHub Release with `.zip` attached.

**If a version is already published:** CI treats `"already exists"` as a non-error and skips gracefully.

---

## Tag naming convention

```
v<major>.<minor>.<patch>           ← core (npm + binaries)
vscode-v<major>.<minor>.<patch>    ← VS Code + Open VSX
jetbrains-v<major>.<minor>.<patch> ← JetBrains Marketplace
```

**Version policy:** major and minor should track core, but patch can diverge.

| Core | VS Code | JetBrains |
|---|---|---|
| `v3.4.0` | `vscode-v3.4.0` | `jetbrains-v3.4.0` |
| `v3.4.0` | `vscode-v3.4.1` ← extension-only fix | `jetbrains-v3.4.0` |
| `v3.4.0` | `vscode-v3.4.1` | `jetbrains-v3.4.1` ← plugin-only fix |

---

## Workflows at a glance

| File | Trigger | Jobs |
|---|---|---|
| `.github/workflows/npm-publish.yml` | `v[0-9]*` | test, publish-npm, publish-github, create-release |
| `.github/workflows/release-binaries.yml` | `v[0-9]*` | build (3× matrix), attach to GitHub Release |
| `.github/workflows/release-vscode.yml` | `vscode-v*` | publish-vscode, publish-openvsx, create-release |
| `.github/workflows/release-jetbrains.yml` | `jetbrains-v*` | publish-jetbrains, create-release |

---

## Required secrets

| Secret | Used by | Where to create |
|---|---|---|
| `NPM_TOKEN` | `npm-publish.yml` | npmjs.com → Access Tokens → Automation |
| `VSCE_PAT` | `release-vscode.yml` | Azure DevOps → Personal Access Tokens (Marketplace scope) |
| `OVSX_PAT` | `release-vscode.yml` | open-vsx.org → User Settings → Access Tokens |
| `JETBRAINS_PUBLISH_TOKEN` | `release-jetbrains.yml` | plugins.jetbrains.com → Profile → Tokens |

`GITHUB_TOKEN` is provided automatically by GitHub Actions — no setup needed.

---

## Checklist: new major/minor release

- [ ] Update `package.json`, `packages/core/package.json`, `packages/cli/package.json` versions
- [ ] Update `CHANGELOG.md`
- [ ] Commit: `git commit -m "chore: release v<version>"`
- [ ] `git tag v<version> && git push origin main v<version>`
- [ ] Verify npm-publish and release-binaries workflows pass in GitHub Actions
- [ ] `git tag vscode-v<version> && git push origin vscode-v<version>`
- [ ] `git tag jetbrains-v<version> && git push origin jetbrains-v<version>`
- [ ] Verify VS Code Marketplace listing updated
- [ ] Verify JetBrains Marketplace listing updated
