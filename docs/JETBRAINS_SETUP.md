# SigMap JetBrains Plugin Setup

## Installation

### JetBrains Marketplace

1. Open your JetBrains IDE (IntelliJ IDEA, WebStorm, PyCharm, etc.)
2. Go to **Settings / Preferences → Plugins**
3. Search for **SigMap** in the Marketplace tab
4. Click **Install** and restart the IDE

### Manual ZIP Install

1. Download the latest `.zip` release from [GitHub Releases](https://github.com/manojmallick/sigmap/releases)
2. Go to **Settings / Preferences → Plugins**
3. Click the gear icon ⚙️ → **Install Plugin from Disk…**
4. Select the downloaded `.zip` file
5. Restart the IDE

## Configuration

After installation the plugin reads your project's `gen-context.config.json` (if present) and uses the same settings as the CLI. No additional configuration is required.

### Available Actions

| Action | Description |
|--------|-------------|
| **SigMap: Regenerate Context** | Re-runs context generation for the current project |
| **SigMap: Open Context File** | Opens the generated context file in the editor |
| **SigMap: View Roadmap** | Opens the SigMap roadmap in a browser window |

Access these actions from **Tools → SigMap** or via the **Find Action** menu (`Ctrl+Shift+A` / `⌘⇧A`).

## Status Bar

SigMap adds a health indicator to the IDE status bar. Click it to view the current coverage score and run a quick health check.

## Troubleshooting

- **Plugin not activating**: Ensure Node.js 18+ is installed and available on your `PATH`
- **Context not updating**: Run **SigMap: Regenerate Context** manually or enable watch mode via `gen-context.config.json`
- **Version mismatch**: The plugin version should match the `sigmap` CLI version in your project

## More Information

- [SigMap CLI Documentation](https://manojmallick.github.io/sigmap/)
- [GitHub Repository](https://github.com/manojmallick/sigmap)
- [Changelog](../CHANGELOG.md)
