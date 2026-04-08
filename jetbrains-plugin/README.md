# SigMap JetBrains Plugin

AI context engine for IntelliJ IDEA, WebStorm, PyCharm, GoLand, RubyMine, and all JetBrains IDEs.

## Features

- **Health Status Bar** — Shows context health grade (A-F) and age (e.g., "SigMap: B 3h")
- **Regenerate Context** — Tools → SigMap → Regenerate Context (Ctrl+Alt+G)
- **Open Context File** — Quickly open `.github/copilot-instructions.md`
- **View Roadmap** — Open SigMap roadmap in browser
- **Auto-refresh** — Status updates every 60 seconds

## Installation

### From JetBrains Marketplace (Recommended)

Marketplace page: https://plugins.jetbrains.com/plugin/31109-sigmap--ai-context-engine/

1. **Settings** → **Plugins** → **Marketplace**
2. Search for **"SigMap"**
3. Click **Install**
4. Restart IDE

### Manual Installation

1. Download the latest `sigmap-X.Y.Z.zip` from [Releases](https://github.com/manojmallick/sigmap/releases)
2. **Settings** → **Plugins** → ⚙️ → **Install Plugin from Disk...**
3. Select the downloaded ZIP file
4. Restart IDE

## Requirements

- JetBrains IDE 2024.1 through 2026.1 (IntelliJ IDEA, WebStorm, PyCharm, etc.)
- Node.js 18+ (for running gen-context.js)
- `gen-context.js` in your project root (install via `npm install sigmap`)

## Usage

### Regenerate Context

**Method 1:** Status Bar
- Click the "SigMap: X Xh" widget in the bottom status bar

**Method 2:** Keyboard Shortcut
- Press **Ctrl+Alt+G** (Windows/Linux) or **Cmd+Alt+G** (macOS)

**Method 3:** Tools Menu
- **Tools** → **SigMap** → **Regenerate Context**

### Health Grades

| Grade | Age | Meaning |
|---|---|---|
| A | < 1 hour | Fresh context |
| B | 1-6 hours | Good |
| C | 6-12 hours | Aging |
| D | 12-24 hours | Stale |
| F | > 24 hours | Expired — regenerate ASAP |

### Keyboard Shortcuts

| Action | Windows/Linux | macOS |
|---|---|---|
| Regenerate Context | Ctrl+Alt+G | Cmd+Alt+G |
| Open Context File | — | — |
| View Roadmap | — | — |

## Configuration

Place `gen-context.config.json` in your project root to customize:

```json
{
  "srcDirs": ["src", "lib"],
  "exclude": ["node_modules", ".git", "dist"],
  "maxTokens": 6000,
  "secretScan": true
}
```

See [Configuration Guide](https://manojmallick.github.io/sigmap/config.html) for all options.

## CLI Quick Reference

Run these from a terminal in your project root:

| Command | Description |
|---|---|
| `sigmap` | Generate context once |
| `sigmap --watch` | Regenerate on file changes |
| `sigmap --monorepo` | Per-package context (`packages/`, `apps/`, `services/`) |
| `sigmap --each` | Process each sibling repo under a parent directory |
| `sigmap --health` | Context health grade |
| `sigmap --init` | Create starter config + `.contextignore` |

## Troubleshooting

### "gen-context.js not found"

**Solution:** Install SigMap in your project:
```bash
npm install sigmap
# or
cp /path/to/sigmap/gen-context.js .
```

### Context file not detected

The plugin looks for these files in order:
1. `.github/copilot-instructions.md`
2. `CLAUDE.md`
3. `.cursorrules`
4. `.windsurfrules`

Ensure at least one exists.

### Plugin doesn't appear in Tools menu

**Solution:** Restart the IDE after installation.

## Support

- [Documentation](https://manojmallick.github.io/sigmap/)
- [GitHub Issues](https://github.com/manojmallick/sigmap/issues)
- [Roadmap](https://manojmallick.github.io/sigmap/roadmap.html)

## License

MIT — See [LICENSE](https://github.com/manojmallick/sigmap/blob/main/LICENSE)
