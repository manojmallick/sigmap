---
title: Troubleshooting
description: Fix common SigMap issues. No context file found, zero signatures, watch mode not triggering, and more — resolved in under a minute.
head:
  - - meta
    - property: og:title
      content: "SigMap Troubleshooting — fix common issues"
  - - meta
    - property: og:description
      content: "Fix common SigMap issues. No context file found, zero signatures, watch mode not triggering, and more."
  - - meta
    - property: og:url
      content: "https://manojmallick.github.io/sigmap/guide/troubleshooting"
  - - meta
    - property: og:type
      content: article
  - - meta
    - name: keywords
      content: "sigmap troubleshooting, sigmap not working, sigmap zero signatures, sigmap watch mode, sigmap debug"
---
# Troubleshooting

Most issues resolve in under a minute. Start with the first section that matches your symptom.

## Issue 1 — "no context file found"

**Symptom:** VS Code shows "no context", the MCP server returns an error, or Copilot doesn't know anything about your codebase.

**Fix:**

The context file must be generated before anything can read it. Run `sigmap` or `node gen-context.js` to create it. Check your Node.js version — v18 or later is required.

```bash
node --version
# v22.11.0  ← v18+ required

sigmap && ls .github/copilot-instructions.md
# [sigmap] ✓ wrote .github/copilot-instructions.md
# .github/copilot-instructions.md  ← file now exists
```

---

## Issue 2 — Copilot or Claude still asks "can you share some files?"

**Symptom:** The AI doesn't appear to know your codebase structure even though the context file was generated.

**Fix:**

- The file must be at exactly `.github/copilot-instructions.md` in the workspace root — not a subdirectory. Verify: `ls .github/copilot-instructions.md`
- For Claude Code: also commit `CLAUDE.md` by adding `"claude"` to the `outputs` array in your config, then rerun.
- Restart the IDE after generating for the first time — some editors only read the file at startup.

```bash
ls .github/copilot-instructions.md
# .github/copilot-instructions.md  ← must exist here
```

---

## Issue 3 — Token reduction is lower than expected (< 80%)

**Symptom:** `sigmap --report` shows only 60–70% reduction instead of the typical 90–97%.

**Cause:** You are likely indexing test files, `dist/`, `build/` output, or generated code — these contain many signatures that add bulk without adding information.

**Fix:** Run `sigmap --init` to generate a starter `.contextignore`, then add exclusions for test or generated directories.

```bash
# test files
**/*.test.*
**/*.spec.*

# build output
dist/
build/
src/generated/
coverage/
```

---

## Issue 4 — Context file is stale — VS Code shows grade D or "3d ago"

**Symptom:** The status bar shows a low grade or a large "last updated" timestamp, meaning the context no longer matches current code.

**Fix:**

- Click the status bar item to trigger a manual regeneration from within VS Code.
- For automatic freshness on every commit, run `sigmap --setup` once to install a post-commit hook.

```bash
sigmap --setup
# [sigmap] ✓ installed .git/hooks/post-commit
# [sigmap] context will regenerate on every git commit
```

---

## Issue 5 — Over-budget warning: some files were dropped

**Symptom:** `sigmap --report` shows `files dropped: N` — meaning important files are being cut to stay within the token budget.

**Options:**

- Since v4.1.0, the budget auto-scales to your repo by default (`autoMaxTokens: true`). If files are still being dropped, the repo is very large. Try the options below.
- Switch to `"strategy": "per-module"` — each module gets its own full budget rather than sharing one pool.
- Switch to `"strategy": "hot-cold"` — recently changed files are always injected; older files are served on demand via MCP.
- Raise `coverageTarget` (default `0.80`) closer to `1.0` to push the formula toward a higher budget.
- Raise `maxTokensHeadroom` (default `0.20`) to let SigMap use a larger fraction of the model context window.
- Add exclusions to `.contextignore` to remove generated/vendor files from the index.
- Run `sigmap --report --json` to see which files consume the most tokens.

```json
{
  "strategy": "per-module"
}
```

Or to use a larger fixed budget and disable auto-scaling:
```json
{
  "autoMaxTokens": false,
  "maxTokens": 12000
}
```

---

## Issue 6 — MCP server not appearing in tool list

**Symptom:** Claude Code or Cursor doesn't show any sigmap tools, or `tools/list` returns an empty array.

**Fix:**

- Verify the absolute path resolves: run `node /path/to/gen-context.js --version` in a terminal. If it errors, the path is wrong.
- Check JSON syntax in the settings file — a missing comma or mismatched quote will silently prevent parsing.
- Reload or fully restart the IDE after making config changes. MCP servers are registered at startup.
- Test the server manually to confirm it responds before blaming the editor config.

```bash
node /path/to/gen-context.js --version
# sigmap v2.8.0  ← must print a version

echo '{"jsonrpc":"2.0","method":"tools/list","id":1}' | node gen-context.js --mcp
# {"jsonrpc":"2.0","id":1,"result":{"tools":[...]}}  ← 8 tools
```

---

## Issue 7 — "gen-context.js not found" in VS Code

**Symptom:** The VS Code extension shows an error and can't regenerate the context file.

**Fix:**

- Install globally so the extension can find it anywhere: `npm install -g sigmap`
- Or set the explicit path in VS Code settings using the `sigmap.scriptPath` option:

```json
{
  "sigmap.scriptPath": "${workspaceFolder}/gen-context.js"
}
```

---

## Issue 8 — Secret scan is redacting a false positive

**Symptom:** A variable name that happens to match a secret pattern appears as `[REDACTED]` in the output.

**Fix:**

- Add a `.contextignore` rule to exclude that specific file from the index entirely.
- Alternatively, set `"secretScan": false` in your config — but only if you are certain there are no real secrets in your source directories.

**The 10 secret patterns checked:** AWS Access Key, AWS Secret Key, GCP API Key, GitHub Token (`ghp_` / `gho_`), JWT (`eyJ...`), database connection string, SSH private key header, Stripe key (`sk_live_`), Twilio key, generic `password` / `api_key` assignments in code.

---

## Issue 9 — Monorepo: context only covers one package

**Symptom:** Only one package's signatures appear in the output even though your repo has multiple packages under `packages/` or `apps/`.

**Fix:**

- Enable monorepo mode in `gen-context.config.json`: set `"monorepo": true`.
- Or run `sigmap --monorepo` as a one-off flag without touching the config file.
- Make sure your package directories use one of the standard names: `packages/`, `apps/`, or `services/`.

```json
{
  "monorepo": true
}
```

---

## Issue 10 — Watch mode stops working after sleep or wake

**Symptom:** `sigmap --watch` was running fine, but after the machine slept and woke, file changes are no longer picked up.

**Fix:**

- Restart the watcher process. This is an OS-level file descriptor limit issue that affects some macOS and Linux systems after sleep cycles.
- On macOS, increase the file watch limit for the current session: `ulimit -n 10000`
- For a more reliable alternative, use the git hook approach via `sigmap --setup` — it regenerates on every commit and is not affected by sleep/wake cycles.

```bash
ulimit -n 10000   # raise file watch limit (macOS)
sigmap --watch    # restart the watcher
# [sigmap] watching for changes...
```

---

## Still stuck? Get more help

Run the health check and share the output in a GitHub issue — it includes everything needed to diagnose the problem.

```bash
sigmap --health --json
```

```json
{
  "score": 94,
  "grade": "A",
  "version": "2.4.0",
  "node": "22.11.0",
  "contextFile": true,
  "lastGenerated": "2m ago",
  "tokenReduction": "95.3%"
}
```

Open an issue at [github.com/manojmallick/sigmap/issues](https://github.com/manojmallick/sigmap/issues). Include your OS, Node.js version, and a brief description of the symptom.

## Next steps

- [CLI reference](/guide/cli) — every flag with examples and expected output
- [Config reference](/guide/config) — every field in gen-context.config.json with defaults
- [MCP server setup](/guide/mcp) — wire up sigmap's 8 on-demand MCP tools


---

<div style="text-align:center;margin-top:2.5rem;padding-bottom:.5rem;font-size:0.85em;color:var(--vp-c-text-3)">
  Made in Amsterdam, Netherlands <span title="Netherlands">🇳🇱</span>
</div>