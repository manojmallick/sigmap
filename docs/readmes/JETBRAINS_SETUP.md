# JetBrains Plugin Setup Guide

Complete installation and configuration guide for SigMap JetBrains plugin (IntelliJ IDEA, WebStorm, PyCharm, GoLand, RubyMine, and all JetBrains IDEs).

---

## Requirements

| Item | Requirement |
|---|---|
| JetBrains IDE | 2024.1 or later |
| Node.js | 18+ |
| SigMap | `npm install -g sigmap`, local `npm install sigmap`, standalone binary in `PATH`, or `gen-context.js` in project root |

---

## Installation

### Method 1: JetBrains Marketplace (Recommended)

1. Open IDE settings: **File** → **Settings** (Windows/Linux) or **IntelliJ IDEA** → **Preferences** (macOS)
2. Navigate to **Plugins**
3. Switch to **Marketplace** tab
4. Search for **"SigMap"**
5. Click **Install**
6. Click **Restart IDE**

### Method 2: Manual ZIP Install

1. Download `sigmap-X.Y.Z.zip` from [GitHub Releases](https://github.com/manojmallick/sigmap/releases)
2. Open **Settings** → **Plugins**
3. Click ⚙️ gear icon → **Install Plugin from Disk...**
4. Select the downloaded ZIP file
5. Click **OK** then **Restart IDE**

### Method 3: Build from Source

```bash
cd sigmap/jetbrains-plugin
./gradlew buildPlugin verifyPlugin runPluginVerifier
# Output: build/distributions/sigmap-X.Y.Z.zip

# Install the ZIP using Method 2
```

---

## First-Time Setup

After installation and IDE restart:

1. **Verify Installation**
   - Open **Tools** menu
   - Confirm **SigMap** submenu is present with 3 actions:
     - Regenerate Context
     - Open Context File
     - View Roadmap

2. **Check Status Bar**
   - Look at the bottom status bar (right side)
   - You should see: `SigMap: ⚠ missing` (if no context file exists yet)

3. **Generate Initial Context**
   - From terminal in your project:
     ```bash
     node gen-context.js
     ```
   - Or use the plugin: **Tools** → **SigMap** → **Regenerate Context**

4. **Verify Context File**
   - Status bar should now show: `SigMap: A 0m` (grade A, 0 minutes old)

---

## Features

### 1. Health Status Bar Widget

**Location:** Bottom status bar (right side)

**Display Format:** `SigMap: <Grade> <Age>`

**Example:** `SigMap: B 3h` means grade B, context is 3 hours old

**Grades:**
- **A** — Fresh (< 1 hour)
- **B** — Good (1-6 hours)
- **C** — Aging (6-12 hours)
- **D** — Stale (12-24 hours)
- **F** — Expired (> 24 hours) — regenerate immediately

**Click Action:** Clicking the widget triggers context regeneration

**Update Frequency:** Every 60 seconds

---

### 2. Regenerate Context Action

Re-generates `.github/copilot-instructions.md` (or configured output file).

**Access Methods:**

1. **Keyboard Shortcut:** `Ctrl+Alt+G` (Windows/Linux), `Cmd+Alt+G` (macOS)
2. **Tools Menu:** **Tools** → **SigMap** → **Regenerate Context**
3. **Status Bar:** Click the `SigMap: X Xh` widget

**What It Does:**
- Runs `node gen-context.js` in your project root
- Extracts signatures from all source files
- Writes output to `.github/copilot-instructions.md` (or configured targets)
- Shows notification on success/failure

**Notifications:**
- ✅ **Success:** "SigMap: Context Regenerated"
- ⚠️ **Warning:** "gen-context.js not found" — install SigMap first
- ❌ **Error:** "Generation failed" with exit code

---

### 3. Open Context File Action

Opens the generated context file in the editor.

**Access:** **Tools** → **SigMap** → **Open Context File**

**File Priority:**
1. `.github/copilot-instructions.md`
2. `CLAUDE.md`
3. `.cursorrules`
4. `.windsurfrules`

Opens the first file that exists.

---

### 4. View Roadmap Action

Opens the SigMap roadmap in your default browser.

**Access:** **Tools** → **SigMap** → **View Roadmap**

**URL:** https://manojmallick.github.io/sigmap/roadmap.html

---

## Configuration

Create `gen-context.config.json` in your project root:

```json
{
  "output": ".github/copilot-instructions.md",
  "srcDirs": ["src", "app", "lib"],
  "exclude": ["node_modules", ".git", "dist", "build"],
  "maxDepth": 6,
  "maxSigsPerFile": 25,
  "maxTokens": 6000,
  "secretScan": true
}
```

See [Configuration Reference](https://manojmallick.github.io/sigmap/config.html) for all options.

---

## Troubleshooting

### Plugin Not Visible in Tools Menu

**Problem:** After installation, no "SigMap" entry in Tools menu

**Solution:**
1. Restart IDE (File → Exit, reopen)
2. Check **Settings** → **Plugins** → **Installed** — confirm "SigMap" is listed
3. If not listed, reinstall plugin

---

### "gen-context.js not found" Error

**Problem:** Regenerate action shows warning notification

**Solution:**

**Option 1: Install globally via npm**
```bash
npm install -g sigmap
```

**Option 2: Install locally via npm**
```bash
npm install sigmap
# Creates node_modules/.bin/sigmap (and gen-context compatibility entry)
```

**Option 3: Standalone binary in PATH**
```bash
# macOS/Linux: move binary to ~/.local/bin/sigmap and ensure PATH includes ~/.local/bin
# Windows: move sigmap.exe to %USERPROFILE%\\bin and add it to PATH
```

**Option 4: Copy standalone script**
```bash
curl -O https://raw.githubusercontent.com/manojmallick/sigmap/main/gen-context.js
chmod +x gen-context.js
```

**Option 5: Verify Node.js**
```bash
node --version  # Must be v18 or later
which node      # Should show a valid path
```

---

### Status Bar Shows "⚠ missing"

**Problem:** Widget shows warning icon

**Cause:** No context file exists yet

**Solution:**
1. Run `node gen-context.js` from project root
2. Or use **Tools** → **SigMap** → **Regenerate Context**
3. Widget should update to `SigMap: A 0m` after generation

---

### Keyboard Shortcut Doesn't Work

**Problem:** `Ctrl+Alt+G` does nothing

**Solution:**

1. **Check for conflicts:**
   - **Settings** → **Keymap**
   - Search for "Regenerate Context"
   - If conflict exists, assign a different shortcut

2. **Manually assign shortcut:**
   - **Settings** → **Keymap**
   - Search for "SigMap: Regenerate Context"
   - Right-click → **Add Keyboard Shortcut**
   - Press desired keys → **OK**

---

### Context File Not Opening

**Problem:** "Open Context File" action does nothing

**Cause:** No recognized context file in project

**Solution:**

Create at least one of these files:
```bash
mkdir -p .github
echo "# Context" > .github/copilot-instructions.md
# OR
echo "# Context" > CLAUDE.md
```

Then retry the action.

---

### Plugin Slows Down IDE

**Problem:** IDE becomes sluggish after plugin installation

**Solution:**

The plugin updates status every 60 seconds (lightweight). If slowdown persists:

1. **Disable** the plugin temporarily:
   - **Settings** → **Plugins** → **Installed**
   - Uncheck "SigMap"
   - Restart IDE

2. **Report issue:** [GitHub Issues](https://github.com/manojmallick/sigmap/issues) with:
   - IDE version
   - Plugin version
   - Project size (number of files)

---

## Supported IDEs

| IDE | Version | Status |
|---|---|---|
| IntelliJ IDEA | 2024.1+ | ✅ Tested |
| WebStorm | 2024.1+ | ✅ Tested |
| PyCharm | 2024.1+ | ✅ Tested |
| GoLand | 2024.1+ | ✅ Tested |
| RubyMine | 2024.1+ | ✅ Tested |
| PhpStorm | 2024.1+ | ⚠️ Untested (should work) |
| CLion | 2024.1+ | ⚠️ Untested (should work) |
| Rider | 2024.1+ | ⚠️ Untested (should work) |
| Android Studio | 2024.1+ | ⚠️ Untested (should work) |

**Note:** All JetBrains IDEs 2024.1+ built on IntelliJ Platform should work. Report compatibility issues via GitHub.

---

## Screenshots

> TODO: Add screenshots in future release

1. Status bar widget showing health grade
2. Tools → SigMap menu
3. Regenerate Context notification
4. Context file opened in editor

---

## Known Limitations

1. **No Windows support** for status bar click (use keyboard shortcut instead)
2. **No file watcher** — context regeneration is manual only (planned for v2.10)
3. **No inline git diff** — shows full file signatures only (planned for v3.0)
4. **No monorepo mode** — single context file per project (planned for v2.11)

---

## Uninstallation

1. **Settings** → **Plugins** → **Installed**
2. Find **SigMap** in the list
3. Click ⚙️ → **Uninstall**
4. Restart IDE

**Note:** Uninstalling the plugin does NOT delete your context files or `gen-context.js`.

---

## Publishing to JetBrains Marketplace

### Prerequisites

1. JetBrains Account at https://account.jetbrains.com/
2. Plugin repository at https://plugins.jetbrains.com/
3. Personal Access Token (Settings → OAuth Clients → New Client)

### Manual Upload

```bash
cd jetbrains-plugin
./gradlew buildPlugin
# Output: build/distributions/sigmap-X.Y.Z.zip

# Upload ZIP to https://plugins.jetbrains.com/plugin/add
```

### Automated via GitHub Actions

Set repository secret `PUBLISH_TOKEN`:
```bash
# .github/workflows/publish-jetbrains.yml triggered on tag push
git tag v2.9.0
git push origin v2.9.0
```

---

## Support

- **Documentation:** https://manojmallick.github.io/sigmap/
- **GitHub Issues:** https://github.com/manojmallick/sigmap/issues
- **Roadmap:** https://manojmallick.github.io/sigmap/roadmap.html

---

## License

MIT — see [LICENSE](https://github.com/manojmallick/sigmap/blob/main/LICENSE)
