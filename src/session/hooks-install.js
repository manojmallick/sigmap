'use strict';

/**
 * `sigmap hooks install claude` (#922): wire SigMap's session capture into
 * Claude Code's hooks.
 *
 * Which file. The command embeds an ABSOLUTE path to this install, so by default
 * it goes in `.claude/settings.local.json` — Claude Code's personal, uncommitted
 * settings file — rather than the committed `.claude/settings.json`, where one
 * machine's path would break every teammate's session. `shared: true` opts in to
 * the committed file anyway.
 *
 * Merge, never replace. The file is parsed, SigMap's own entries are added or
 * brought up to date, and every other key and hook is left exactly as found. A
 * file that is not valid JSON is refused, not overwritten.
 *
 * An entry is SigMap's when its command has the shape SigMap writes:
 * `node <entry> session hook <SessionStart|Stop|SessionEnd>`.
 *
 * Zero dependencies.
 */

const fs = require('fs');
const path = require('path');

const EVENTS = ['SessionStart', 'SessionEnd'];
const OPTIONAL_EVENTS = ['Stop'];
// Documented SessionStart sources; the hook is useful on all of them.
const START_MATCHER = 'startup|resume|clear|compact';
// Seconds. The handler bounds its own work well inside this; it is the host's backstop.
const TIMEOUT_S = 10;

// The script path token: single-quoted (what we write; an embedded quote is `'\''`),
// double-quoted, or bare.
const OWN_COMMAND = /^\s*node\s+('(?:[^']|'\\'')*'|"[^"\n]*"|\S+)\s+session\s+hook\s+(SessionStart|Stop|SessionEnd)\s*$/;

/**
 * POSIX single-quoting: nothing inside is expanded by the shell, so an install
 * path with a space, `$HOME`, a backtick or a quote reaches `node` intact. (Claude
 * Code runs hook commands through a POSIX shell, Git Bash on Windows.)
 */
function shellQuote(text) {
  return `'${String(text).replace(/'/g, "'\\''")}'`;
}

function shellUnquote(token) {
  if (token[0] === "'") return token.slice(1, -1).replace(/'\\''/g, "'");
  if (token[0] === '"') {
    try { return JSON.parse(token); } catch (_) { return token.slice(1, -1); }
  }
  return token;
}

/** The command line registered for one event. */
function hookCommand(scriptPath, event) {
  return `node ${shellQuote(path.resolve(scriptPath))} session hook ${event}`;
}

function isOwnCommand(cmd) {
  return typeof cmd === 'string' && OWN_COMMAND.test(cmd);
}

/** The entry script an own command runs; null when unreadable. */
function scriptOf(cmd) {
  const m = typeof cmd === 'string' ? OWN_COMMAND.exec(cmd) : null;
  if (!m) return null;
  return shellUnquote(m[1]);
}

function targetFile(cwd, shared) {
  return path.join(cwd, '.claude', shared ? 'settings.json' : 'settings.local.json');
}

function _read(file) {
  if (!fs.existsSync(file)) return { settings: {}, exists: false };
  let settings;
  try { settings = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return { error: `${file} is not valid JSON (${e.message}); fix or remove it first` }; }
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return { error: `${file} must contain a JSON object` };
  if (settings.hooks !== undefined && (!settings.hooks || typeof settings.hooks !== 'object' || Array.isArray(settings.hooks))) {
    return { error: `${file}: "hooks" must be an object` };
  }
  return { settings, exists: true };
}

/** Every `{group, hook}` own entry registered for an event. */
function _ownEntries(settings, event) {
  const out = [];
  const groups = settings.hooks && Array.isArray(settings.hooks[event]) ? settings.hooks[event] : [];
  for (const group of groups) {
    if (!group || !Array.isArray(group.hooks)) continue;
    for (const hook of group.hooks) if (hook && isOwnCommand(hook.command)) out.push({ group, hook });
  }
  return out;
}

/**
 * Add (or bring up to date) SigMap's hooks.
 * @param {string} cwd
 * @param {string} scriptPath entry script the hooks should run
 * @param {{ stop?: boolean, shared?: boolean }} [opts]
 * @returns {{ path: string, changes: Array<{event:string, action:'added'|'updated'|'unchanged'}>, error?: string }}
 */
function installClaudeHooks(cwd, scriptPath, opts = {}) {
  const file = targetFile(cwd, !!opts.shared);
  const read = _read(file);
  if (read.error) return { path: file, changes: [], error: read.error };
  const settings = read.settings;
  if (!settings.hooks) settings.hooks = {};
  const events = opts.stop ? EVENTS.concat(OPTIONAL_EVENTS) : EVENTS;
  const changes = [];
  for (const event of events) {
    const want = hookCommand(scriptPath, event);
    const own = _ownEntries(settings, event);
    if (own.length === 0) {
      if (!Array.isArray(settings.hooks[event])) settings.hooks[event] = [];
      const entry = { type: 'command', command: want, timeout: TIMEOUT_S };
      settings.hooks[event].push(event === 'SessionStart' ? { matcher: START_MATCHER, hooks: [entry] } : { hooks: [entry] });
      changes.push({ event, action: 'added' });
    } else if (own.every((e) => e.hook.command === want) && own.length === 1) {
      changes.push({ event, action: 'unchanged' });
    } else {
      // Bring the first up to date and drop any duplicate copies.
      own[0].hook.command = want;
      for (const dup of own.slice(1)) dup.group.hooks = dup.group.hooks.filter((h) => h !== dup.hook);
      changes.push({ event, action: 'updated' });
    }
  }
  if (changes.some((c) => c.action !== 'unchanged')) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(settings, null, 2) + '\n');
  }
  return { path: file, changes };
}

/**
 * Remove SigMap's hooks from both settings files, pruning only what becomes empty.
 * @returns {{ files: Array<{ path: string, removed: number }>, error?: string }}
 */
function removeClaudeHooks(cwd) {
  const files = [];
  for (const shared of [false, true]) {
    const file = targetFile(cwd, shared);
    const read = _read(file);
    if (read.error) return { files, error: read.error };
    if (!read.exists || !read.settings.hooks) continue;
    const settings = read.settings;
    let removed = 0;
    for (const event of Object.keys(settings.hooks)) {
      const groups = settings.hooks[event];
      if (!Array.isArray(groups)) continue;
      for (const group of groups) {
        if (!group || !Array.isArray(group.hooks)) continue;
        const before = group.hooks.length;
        group.hooks = group.hooks.filter((h) => !(h && isOwnCommand(h.command)));
        removed += before - group.hooks.length;
      }
      settings.hooks[event] = groups.filter((g) => !(g && Array.isArray(g.hooks) && g.hooks.length === 0));
      if (settings.hooks[event].length === 0) delete settings.hooks[event];
    }
    if (Object.keys(settings.hooks).length === 0) delete settings.hooks;
    if (removed > 0) {
      fs.writeFileSync(file, JSON.stringify(settings, null, 2) + '\n');
      files.push({ path: file, removed });
    }
  }
  return { files };
}

/**
 * What is wired, for `hooks status` and `doctor`.
 * @returns {{ wired: boolean, events: string[], files: object[], missingScript: string[] }}
 */
function inspectClaudeHooks(cwd) {
  const files = [];
  const events = new Set();
  const missingScript = [];
  for (const shared of [false, true]) {
    const file = targetFile(cwd, shared);
    const read = _read(file);
    if (read.error) { files.push({ path: file, error: read.error }); continue; }
    if (!read.exists) continue;
    const found = [];
    for (const event of EVENTS.concat(OPTIONAL_EVENTS)) {
      for (const { hook } of _ownEntries(read.settings, event)) {
        found.push(event);
        events.add(event);
        const script = scriptOf(hook.command);
        if (script && !fs.existsSync(path.resolve(cwd, script))) missingScript.push(script);
      }
    }
    if (found.length) files.push({ path: file, events: found });
  }
  return {
    wired: events.has('SessionEnd') && events.has('SessionStart'),
    events: [...events], files, missingScript: [...new Set(missingScript)],
  };
}

module.exports = {
  EVENTS, OPTIONAL_EVENTS, START_MATCHER, TIMEOUT_S,
  hookCommand, shellQuote, shellUnquote, isOwnCommand, scriptOf, targetFile, installClaudeHooks, removeClaudeHooks, inspectClaudeHooks,
};
