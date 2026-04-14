'use strict';

/**
 * SigMap VS Code Extension
 *
 * Features:
 *  - Status bar: shows health grade (A/B/C/D) and time since last regen
 *  - Command: SigMap: Regenerate Context  (runs node gen-context.js)
 *  - Command: SigMap: Open Context File
 *  - Notification: when copilot-instructions.md is > 24 h stale
 *
 * Zero runtime dependencies — uses only the VS Code API.
 */

const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFile, execFileSync } = require('child_process');

// ── Constants ────────────────────────────────────────────────────────────────

const CONTEXT_FILE = '.github/copilot-instructions.md';
const STALE_HOURS = 24;
const STATUS_INTERVAL_MS = 60 * 1000; // refresh status bar every 60 s
const EXECUTABLE_NAMES = ['sigmap', 'gen-context'];

// Grade ≥ 90 → A, ≥ 75 → B, ≥ 60 → C, < 60 → D
const GRADE_ICONS = { A: '$(check) A', B: '$(info) B', C: '$(warning) C', D: '$(error) D' };

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Return the workspace root folder path, or null. */
function workspaceRoot() {
  const folders = vscode.workspace.workspaceFolders;
  return folders && folders.length > 0 ? folders[0].uri.fsPath : null;
}

/**
 * Resolve the path to gen-context.js (local script).
 * Uses sigmap.scriptPath setting if set; otherwise looks in workspace root
 * and workspace node_modules/.bin.
 */
function resolveScript(root) {
  const cfg = vscode.workspace.getConfiguration('sigmap');
  const custom = cfg.get('scriptPath', '').trim();
  if (custom && fs.existsSync(custom)) return custom;
  if (root) {
    const candidate = path.join(root, 'gen-context.js');
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function isWindows() {
  return process.platform === 'win32';
}

function executableCandidates(baseDir, name) {
  if (!baseDir) return [];
  if (isWindows()) {
    return [
      path.join(baseDir, `${name}.cmd`),
      path.join(baseDir, `${name}.exe`),
      path.join(baseDir, `${name}.bat`),
      path.join(baseDir, name),
    ];
  }
  return [path.join(baseDir, name)];
}

function firstExecutable(paths) {
  for (const p of paths) {
    if (!p) continue;
    try {
      if (isWindows()) {
        if (fs.existsSync(p)) return p;
      } else {
        fs.accessSync(p, fs.constants.X_OK);
        return p;
      }
    } catch (_) {}
  }
  return null;
}

/**
 * Probe common global installation paths for the gen-context binary.
 * Required because macOS GUI apps (VS Code) do NOT inherit shell PATH,
 * so ~/.volta/bin and nvm paths are invisible without this.
 *
 * Resolution order:
 *  1. workspace node_modules/.bin/gen-context  (local npm install)
 *  2. ~/.volta/bin/gen-context                 (Volta)
 *  3. ~/.nvm/versions/node/<latest>/bin/gen-context (nvm)
 *  4. /usr/local/bin, /opt/homebrew/bin        (classic npm / Homebrew)
 *  5. ~/.npm-global/bin                        (npm prefix override)
 *  6. login-shell `which gen-context`          (last resort)
 *
 * @param {string|null} root - workspace root (may be null)
 * @returns {string|null} absolute path to binary, or null
 */
function resolveGlobalCommand(root) {
  const home = os.homedir();
  const candidates = [];
  const addDir = (dir) => {
    if (!dir) return;
    for (const name of EXECUTABLE_NAMES) {
      candidates.push(...executableCandidates(dir, name));
    }
  };

  // 1. workspace-local node_modules
  if (root) addDir(path.join(root, 'node_modules', '.bin'));

  // 2. Volta
  addDir(path.join(home, '.volta', 'bin'));

  // 3. nvm — scan all installed versions, newest first
  const nvmDir = path.join(home, '.nvm', 'versions', 'node');
  if (fs.existsSync(nvmDir)) {
    try {
      fs.readdirSync(nvmDir)
        .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))
        .forEach(v => addDir(path.join(nvmDir, v, 'bin')));
    } catch (_) {}
  }

  // 4. classic / Homebrew global paths
  addDir('/usr/local/bin');
  addDir('/opt/homebrew/bin');

  // 5. npm prefix override
  addDir(path.join(home, '.npm-global', 'bin'));
  addDir(path.join(home, 'npm', 'bin'));

  // 6. common Windows global npm / user bin dirs
  if (isWindows()) {
    const appData = process.env.APPDATA || path.join(home, 'AppData', 'Roaming');
    addDir(path.join(appData, 'npm'));
    addDir(path.join(home, 'bin'));
    addDir(path.join(home, '.local', 'bin'));
  }

  const known = firstExecutable(candidates);
  if (known) return known;

  // 7. last resort: ask shell/path resolver
  if (isWindows()) {
    for (const name of EXECUTABLE_NAMES) {
      try {
        const result = execFileSync('where', [name], { timeout: 4000, encoding: 'utf8' });
        const first = result.split(/\r?\n/).map(s => s.trim()).find(Boolean);
        if (first && fs.existsSync(first)) return first;
      } catch (_) {}
    }
    return null;
  }

  // 8. last resort: ask a login shell
  for (const sh of ['/bin/zsh', '/bin/bash']) {
    for (const name of EXECUTABLE_NAMES) {
      try {
        const result = execFileSync(sh, ['-l', '-c', `command -v ${name} || which ${name}`], { timeout: 4000, encoding: 'utf8' });
        const cmd = result.trim();
        if (cmd && fs.existsSync(cmd)) return cmd;
      } catch (_) {}
    }
  }

  return null;
}

/**
 * Returns a unified runner descriptor:
 *   { type: 'script', path }  → run as `node "<path>"`
 *   { type: 'command', path } → run as `"<path>"` directly
 *   null                      → nothing found
 */
function resolveRunner(root) {
  const script = resolveScript(root);
  if (script) return { type: 'script', path: script };
  const cmd = resolveGlobalCommand(root);
  if (cmd) return { type: 'command', path: cmd };
  return null;
}

/**
 * Returns { daysSince, grade, score, tokens, reduction } for a given cwd.
 * Uses gen-context --health --json when available; falls back to mtime check.
 */
function getStatus(root, runner) {
  return new Promise((resolve) => {
    if (!root) return resolve(null);

    // Try gen-context --health --json for rich data
    if (runner) {
      const [cmd, args] = runner.type === 'script'
        ? [process.execPath, [runner.path, '--health', '--json']]
        : [runner.path, ['--health', '--json']];
      execFile(cmd, args, { cwd: root, timeout: 8000 }, (err, stdout) => {
        if (!err) {
          try {
            const data = JSON.parse(stdout.trim());
            const ctxPath = path.join(root, CONTEXT_FILE);
            let daysSince = null;
            if (fs.existsSync(ctxPath)) {
              const mtime = fs.statSync(ctxPath).mtimeMs;
              daysSince = (Date.now() - mtime) / (1000 * 60 * 60 * 24);
            }
            return resolve({
              grade:     data.grade     || 'A',
              score:     data.score     || 100,
              daysSince,
              tokens:    data.tokens    || 0,
              reduction: data.reduction || 0,
            });
          } catch (_) {}
        }
        // Fallback to mtime-only
        mtimeFallback(root, resolve);
      });
    } else {
      mtimeFallback(root, resolve);
    }
  });
}


function mtimeFallback(root, resolve) {
  const ctxPath = path.join(root, CONTEXT_FILE);
  if (!fs.existsSync(ctxPath)) return resolve(null);
  const mtime = fs.statSync(ctxPath).mtimeMs;
  const daysSince = (Date.now() - mtime) / (1000 * 60 * 60 * 24);
  resolve({ grade: 'A', score: 100, daysSince });
}

/** Format daysSince as a human-readable string. */
function formatAge(daysSince) {
  if (daysSince < 1 / 24) return 'just now';
  if (daysSince < 1) {
    const h = Math.round(daysSince * 24);
    return `${h}h ago`;
  }
  const d = Math.floor(daysSince);
  return `${d}d ago`;
}

// ── Status bar ────────────────────────────────────────────────────────────────

function createStatusBarItem() {
  const item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  item.command = 'sigmap.regenerate';
  item.tooltip = 'SigMap — click to regenerate context';
  return item;
}

async function updateStatusBar(statusBar) {
  const root = workspaceRoot();
  const runner = resolveRunner(root);

  if (!root) {
    statusBar.hide();
    return;
  }

  const status = await getStatus(root, runner);

  if (!status) {
    statusBar.text = '$(file-code) sm: no context';
    statusBar.tooltip = 'SigMap: no context file found. Run: node gen-context.js';
    statusBar.show();
    return;
  }

  const icon    = GRADE_ICONS[status.grade] || GRADE_ICONS.A;
  const age     = formatAge(status.daysSince);
  const tokStr  = status.tokens    ? `${(status.tokens / 1000).toFixed(1)}K tok` : '';
  const redStr  = status.reduction ? `${status.reduction}% \u2193` : '';
  const extras  = [tokStr, redStr].filter(Boolean);
  statusBar.text = `$(file-code) SigMap ${icon}${extras.length ? ' \u00b7 ' + extras.join(' \u00b7 ') : ''}`;
  statusBar.tooltip = [
    `SigMap health: ${status.grade} (${status.score}/100)`,
    extras.length ? `Context size: ${tokStr}  Reduction: ${redStr}` : '',
    `Last regenerated: ${age}`,
    'Click to regenerate',
  ].filter(Boolean).join('\n');
  statusBar.show();
}

// ── Stale notification ────────────────────────────────────────────────────────

/** Key used to suppress 'do not show again' per workspace */
function suppressionKey(root) {
  return `cf.stale.suppress.${Buffer.from(root).toString('base64').slice(0, 16)}`;
}

async function checkStaleContext(context, root, runner) {
  if (!root) return;

  const ctxPath = path.join(root, CONTEXT_FILE);
  if (!fs.existsSync(ctxPath)) return;

  const mtime = fs.statSync(ctxPath).mtimeMs;
  const hoursSince = (Date.now() - mtime) / (1000 * 60 * 60);
  if (hoursSince < STALE_HOURS) return;

  // Check suppression flag
  const key = suppressionKey(root);
  if (context.workspaceState.get(key)) return;

  const daysOld = Math.round(hoursSince / 24);
  const choice = await vscode.window.showInformationMessage(
    `SigMap: context file is ${daysOld} day${daysOld !== 1 ? 's' : ''} old. Regenerate now?`,
    'Regenerate',
    'Not now',
    "Don't show again"
  );

  if (choice === 'Regenerate') {
    await runRegenerate(root, runner);
  } else if (choice === "Don't show again") {
    await context.workspaceState.update(key, true);
  }
}

// ── Command: regenerate ───────────────────────────────────────────────────────

async function runRegenerate(root, runner) {
  if (!root) {
    vscode.window.showWarningMessage('SigMap: no workspace folder open.');
    return;
  }
  if (!runner) {
    const choice = await vscode.window.showWarningMessage(
      'SigMap: command not found. Try npm global/local, npx, standalone binary in PATH, or set sigmap.scriptPath.',
      'Copy install command',
      'Open settings'
    );
    if (choice === 'Copy install command') {
      await vscode.env.clipboard.writeText('npm install -g sigmap');
      vscode.window.showInformationMessage('Copied: npm install -g sigmap');
    } else if (choice === 'Open settings') {
      await vscode.commands.executeCommand('workbench.action.openSettings', 'sigmap.scriptPath');
    }
    return;
  }

  const cmd = runner.type === 'script'
    ? `node "${runner.path}"`
    : `"${runner.path}"`;

  const terminal = vscode.window.createTerminal({ name: 'SigMap', cwd: root });
  terminal.show(true); // show but don't steal focus
  terminal.sendText(`${cmd} && echo "[SigMap] done"`);
}

// ── Activation ────────────────────────────────────────────────────────────────

/** @param {vscode.ExtensionContext} context */
async function activate(context) {
  const statusBar = createStatusBarItem();
  context.subscriptions.push(statusBar);

  // Initial status bar update
  await updateStatusBar(statusBar);

  // Refresh status bar on interval
  const interval = setInterval(() => updateStatusBar(statusBar), STATUS_INTERVAL_MS);
  context.subscriptions.push({ dispose: () => clearInterval(interval) });

  // Feature 2: gutter decorations — green (included) / grey (excluded)
  const decs = require('./decorations');
  context.subscriptions.push(decs.GREEN, decs.GREY);
  const root = workspaceRoot();
  if (root) {
    decs.applyDecorations(root);
    vscode.window.onDidChangeActiveTextEditor(() => decs.scheduleUpdate(root), null, context.subscriptions);
  }

  // Refresh when workspace files change (i.e. context file regenerated)
  const watcher = vscode.workspace.createFileSystemWatcher('**/.github/copilot-instructions.md');
  watcher.onDidChange(() => { updateStatusBar(statusBar); if (root) decs.scheduleUpdate(root); });
  watcher.onDidCreate(() => { updateStatusBar(statusBar); if (root) decs.scheduleUpdate(root); });
  context.subscriptions.push(watcher);

  // Command: regenerate
  context.subscriptions.push(
    vscode.commands.registerCommand('sigmap.regenerate', async () => {
      const root = workspaceRoot();
      const runner = resolveRunner(root);
      await runRegenerate(root, runner);
    })
  );

  // Command: open context file
  context.subscriptions.push(
    vscode.commands.registerCommand('sigmap.openContext', async () => {
      const root = workspaceRoot();
      if (!root) {
        vscode.window.showWarningMessage('SigMap: no workspace folder open.');
        return;
      }
      const ctxPath = path.join(root, CONTEXT_FILE);
      if (!fs.existsSync(ctxPath)) {
        vscode.window.showWarningMessage('SigMap: no context file found. Run: node gen-context.js');
        return;
      }
      const uri = vscode.Uri.file(ctxPath);
      await vscode.window.showTextDocument(uri);
    })
  );

  // Stale check on activation (slight delay to not block startup)
  setTimeout(async () => {
    const root = workspaceRoot();
    const runner = resolveRunner(root);
    await checkStaleContext(context, root, runner);
  }, 3000);
}

function deactivate() {}

module.exports = { activate, deactivate };
