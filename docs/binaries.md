# SigMap — Standalone Binary Install

No Node.js. No npm. Download and run.

---

## Download

Go to the [latest GitHub Release](https://github.com/manojmallick/sigmap/releases/latest) and download the binary for your platform:

| Platform | File |
|---|---|
| macOS (Apple Silicon) | `sigmap-darwin-arm64` |
| macOS (Intel) | `sigmap-darwin-x64` |
| Linux x64 | `sigmap-linux-x64` |
| Windows x64 | `sigmap-win32-x64.exe` |

A `sigmap-checksums.txt` (SHA-256) is attached to every release for verification.

---

## macOS / Linux

```bash
# Download (example: macOS Apple Silicon)
curl -Lo sigmap https://github.com/manojmallick/sigmap/releases/latest/download/sigmap-darwin-arm64

# Make executable
chmod +x ./sigmap

# Run
./sigmap             # generate context (default)
./sigmap --health
./sigmap --version
```

To make it available system-wide:

```bash
mv ./sigmap /usr/local/bin/sigmap
sigmap
```

### macOS Gatekeeper

On first run, macOS may block the binary with _"cannot be opened because it is from an unidentified developer"_.

To allow it:

1. Right-click the binary in Finder → **Open** → click **Open** in the dialog
2. Or via Terminal:
   ```bash
   xattr -d com.apple.quarantine ./sigmap
   ```

This is a one-time step. The binary is ad-hoc signed (not notarized).

---

## Windows

```powershell
# Download sigmap-win32-x64.exe from the GitHub Release page,
# then run from the directory containing it:
.\sigmap-win32-x64.exe           # generate context (default)
.\sigmap-win32-x64.exe --health
.\sigmap-win32-x64.exe --version
```

Or rename it and add to your PATH:

```powershell
Rename-Item sigmap-win32-x64.exe sigmap.exe
# Move sigmap.exe to a directory that's in your PATH
```

### Windows SmartScreen

On first run, Windows SmartScreen may show _"Windows protected your PC"_. Click **More info** → **Run anyway**.

---

## Verify checksum

```bash
# macOS / Linux
sha256sum -c sigmap-checksums.txt

# macOS (shasum)
shasum -a 256 -c sigmap-checksums.txt
```

---

## Available commands

```bash
sigmap                 # Scan project and write context file (default)
sigmap --health        # Show health diagnostics
sigmap --report        # Show token budget report
sigmap --version       # Print version
sigmap --help          # Show all flags
```

All flags documented in the [CLI reference](../README.md#-cli-reference).

---

## Technical notes

- Built with [Node.js SEA](https://nodejs.org/api/single-executable-applications.html) (Single Executable Applications, Node 20+)
- Node.js runtime is bundled — no external runtime required
- Zero npm dependencies — the binary is fully self-contained
- Config file (`gen-context.config.json`) and output paths resolve relative to `$PWD`, exactly as with the npm version
