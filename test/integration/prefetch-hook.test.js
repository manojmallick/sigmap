'use strict';

/**
 * The prefetch hook: `sigmap hooks install claude --prefetch` registers a UserPromptSubmit hook that hands the model SigMap's ranking
 * of the repository's files before each substantive prompt (src/session/prefetch.js; measured in docs-vp/guide/agent-study).
 *
 * It runs inside someone else's agent on every prompt, so most of this file pins what it must NOT do: fire on a prompt that is not a
 * question, repeat a block already in the conversation, write anywhere but its own state, fail, or stall.
 *
 *  installer
 *   1. --prefetch adds UserPromptSubmit (no matcher) and nothing else; without it nothing is added
 *   2. it is idempotent, composes with --stop, and merges with someone else's UserPromptSubmit hook
 *   3. `hooks status` reports it; `hooks remove claude --prefetch` removes only it; a full remove takes it too
 *  screening
 *   4. a slash command, a shell escape, a note, a short prompt, an empty or non-string one: no ranking
 *   5. a long prompt is bounded to one line; a leading dash cannot become a flag
 *  handler
 *   6. a substantive prompt gets a UserPromptSubmit additionalContext: the header, the ranking, the signatures with anchors
 *   7. no index, SIGMAP_PREFETCH=0, a failing ask: silence, never an error
 *   8. the same files in the same session are not injected twice; another session, other files, or no session id are
 *   9. the block is capped at the byte limit, by whole file sections, with a note
 *  10. it never throws, whatever it is given
 *  `session hook UserPromptSubmit` process
 *  11. a real payload through the real command prints the JSON the host reads, and exits 0
 *  12. exit 0 and no output on garbage, an empty stdin, an unindexed project and SIGMAP_PREFETCH=0
 *  consistency
 *  13. the header equals the one the benchmark harness measured
 *
 * Run: node test/integration/prefetch-hook.test.js
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const GEN = path.join(ROOT, 'gen-context.js');
const hi = require(path.join(ROOT, 'src/session/hooks-install'));
const pf = require(path.join(ROOT, 'src/session/prefetch'));
const { handleHook } = require(path.join(ROOT, 'src/session/capture'));

let passed = 0;
let failed = 0;
const later = [];
function test(name, fn) { later.push([name, fn]); }

const dirs = [];
const mk = (p) => { const d = fs.mkdtempSync(path.join(os.tmpdir(), p)); dirs.push(d); return d; };
const ENV = { ...process.env, SIGMAP_NO_UPDATE_CHECK: '1' };
delete ENV.SIGMAP_PREFETCH;

/** A small indexed project: billing and auth, one file each. */
function indexedProject() {
  const dir = mk('prefetch-hook-');
  fs.mkdirSync(path.join(dir, 'src', 'billing'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'src', 'auth'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'src', 'billing', 'invoice.js'),
    '/** Compute the total of an invoice including tax and the retry budget for failed payments. */\n'
    + 'function computeInvoiceTotal(lines, taxRate) { return lines.reduce((s, l) => s + l.amount, 0) * (1 + taxRate); }\n'
    + 'function paymentRetryBudget(attempts, maxAttempts) { return Math.max(0, maxAttempts - attempts); }\n'
    + 'module.exports = { computeInvoiceTotal, paymentRetryBudget };\n');
  fs.writeFileSync(path.join(dir, 'src', 'auth', 'session.js'),
    '/** Create and expire login sessions. */\n'
    + 'function createLoginSession(userId) { return { userId, createdAt: Date.now() }; }\n'
    + 'function expireLoginSession(session, ttlMs) { return Date.now() - session.createdAt > ttlMs; }\n'
    + 'module.exports = { createLoginSession, expireLoginSession };\n');
  const r = spawnSync(process.execPath, [GEN], { cwd: dir, encoding: 'utf8', env: ENV });
  assert.ok(fs.existsSync(path.join(dir, '.context', 'sig-index.json')), `no index was built: ${r.stdout}${r.stderr}`);
  return dir;
}

const PROMPT = 'where is the payment retry budget computed for failed payments';
const hook = (dir, payload, opts = {}) => handleHook('UserPromptSubmit', payload, dir, { script: GEN, env: ENV, ...opts });
const context = (r) => JSON.parse(r.stdout).hookSpecificOutput.additionalContext;
const settings = (dir, shared) => JSON.parse(fs.readFileSync(path.join(dir, '.claude', shared ? 'settings.json' : 'settings.local.json'), 'utf8'));

console.log('prefetch hook (UserPromptSubmit)');

// ── installer ────────────────────────────────────────────────────────────────

test('--prefetch adds UserPromptSubmit (no matcher) and nothing else; without it nothing is added', () => {
  const dir = mk('prefetch-inst-');
  hi.installClaudeHooks(dir, GEN, {});
  assert.deepStrictEqual(Object.keys(settings(dir).hooks).sort(), ['SessionEnd', 'SessionStart']);
  const res = hi.installClaudeHooks(dir, GEN, { prefetch: true });
  assert.deepStrictEqual(res.changes.map((c) => `${c.event}:${c.action}`), ['SessionStart:unchanged', 'SessionEnd:unchanged', 'UserPromptSubmit:added']);
  const groups = settings(dir).hooks.UserPromptSubmit;
  assert.strictEqual(groups.length, 1);
  assert.strictEqual(groups[0].matcher, undefined, 'UserPromptSubmit takes no matcher');
  assert.strictEqual(groups[0].hooks[0].command, hi.hookCommand(GEN, 'UserPromptSubmit'));
  assert.ok(/ session hook UserPromptSubmit$/.test(groups[0].hooks[0].command));
  assert.strictEqual(groups[0].hooks[0].timeout, hi.TIMEOUT_S);
});

test('it is idempotent byte for byte, composes with --stop, and merges with someone else\'s UserPromptSubmit hook', () => {
  const dir = mk('prefetch-inst-');
  fs.mkdirSync(path.join(dir, '.claude'));
  const mine = { hooks: { UserPromptSubmit: [{ hooks: [{ type: 'command', command: 'echo theirs' }] }] }, permissions: { allow: ['Read'] } };
  fs.writeFileSync(path.join(dir, '.claude', 'settings.local.json'), JSON.stringify(mine));
  hi.installClaudeHooks(dir, GEN, { prefetch: true, stop: true });
  const first = fs.readFileSync(path.join(dir, '.claude', 'settings.local.json'), 'utf8');
  const again = hi.installClaudeHooks(dir, GEN, { prefetch: true, stop: true });
  assert.ok(again.changes.every((c) => c.action === 'unchanged'), JSON.stringify(again.changes));
  assert.strictEqual(fs.readFileSync(path.join(dir, '.claude', 'settings.local.json'), 'utf8'), first);
  const s = settings(dir);
  assert.deepStrictEqual(s.permissions, { allow: ['Read'] });
  assert.strictEqual(s.hooks.UserPromptSubmit.length, 2, 'their group and ours');
  assert.strictEqual(s.hooks.UserPromptSubmit[0].hooks[0].command, 'echo theirs');
  assert.ok(s.hooks.Stop && s.hooks.SessionStart && s.hooks.SessionEnd);
});

test('status reports it; remove --prefetch removes only it; a full remove takes it too and leaves their hook', () => {
  const dir = mk('prefetch-inst-');
  fs.mkdirSync(path.join(dir, '.claude'));
  fs.writeFileSync(path.join(dir, '.claude', 'settings.local.json'), JSON.stringify({ hooks: { UserPromptSubmit: [{ hooks: [{ type: 'command', command: 'echo theirs' }] }] } }));
  assert.strictEqual(hi.inspectClaudeHooks(dir).prefetch, false);
  hi.installClaudeHooks(dir, GEN, { prefetch: true });
  const st = hi.inspectClaudeHooks(dir);
  assert.ok(st.prefetch && st.wired && st.events.includes('UserPromptSubmit'));
  const only = hi.removeClaudeHooks(dir, { events: ['UserPromptSubmit'] });
  assert.strictEqual(only.files[0].removed, 1);
  const after = hi.inspectClaudeHooks(dir);
  assert.ok(!after.prefetch && after.wired, 'session capture stays wired');
  assert.strictEqual(settings(dir).hooks.UserPromptSubmit.length, 1, 'their group is still there');
  hi.installClaudeHooks(dir, GEN, { prefetch: true });
  hi.removeClaudeHooks(dir);
  const left = settings(dir);
  assert.deepStrictEqual(Object.keys(left.hooks), ['UserPromptSubmit']);
  assert.strictEqual(left.hooks.UserPromptSubmit[0].hooks[0].command, 'echo theirs');
});

test('the CLI: install --prefetch, status --json, remove --prefetch', () => {
  const dir = mk('prefetch-cli-');
  const run = (...a) => spawnSync(process.execPath, [GEN, ...a], { cwd: dir, encoding: 'utf8', env: ENV });
  const inst = run('hooks', 'install', 'claude', '--prefetch');
  assert.strictEqual(inst.status, 0, inst.stderr);
  assert.ok(/UserPromptSubmit: added/.test(inst.stdout) && /SIGMAP_PREFETCH=0/.test(inst.stdout), inst.stdout);
  assert.strictEqual(JSON.parse(run('hooks', 'status', '--json').stdout).prefetch, true);
  assert.ok(/prefetch hook[^\n]*: wired/.test(run('hooks', 'status').stdout));
  const rm = run('hooks', 'remove', 'claude', '--prefetch');
  assert.strictEqual(rm.status, 0, rm.stderr);
  const st = JSON.parse(run('hooks', 'status', '--json').stdout);
  assert.deepStrictEqual([st.prefetch, st.wired], [false, true]);
  assert.ok(/no SigMap prefetch hook to remove/.test(run('hooks', 'remove', 'claude', '--prefetch').stdout));
});

// ── screening ────────────────────────────────────────────────────────────────

test('a slash command, a shell escape, a note, a short prompt, an empty or non-string one: no ranking', () => {
  for (const [p, why] of [
    ['/compact the conversation now please', 'slash'], ['!ls -la the whole tree here', 'shell'], ['# remember to use tabs always', 'note'],
    ['yes', 'short'], ['continue please', 'short'], ['run the tests', 'short'], ['   ', 'empty'], ['', 'empty'], [null, 'null'], [42, 'number'], [{ a: 1 }, 'object'],
  ]) assert.strictEqual(pf.screen(p).ok, false, `${why}: ${JSON.stringify(p)}`);
  assert.ok(pf.screen('where is the retry budget computed').ok);
  assert.ok(pf.screen('four words are enough').ok);
});

test('a long prompt is bounded to one line; a leading dash cannot become a flag', () => {
  const long = pf.screen(`${'word '.repeat(2000)}`.trim());
  assert.ok(long.ok && long.query.length <= 2000 && !/\n/.test(long.query));
  const multi = pf.screen('where is\n\nthe retry budget\tcomputed');
  assert.strictEqual(multi.query, 'where is the retry budget computed');
  assert.ok(!/^-/.test(pf.screen('--json show me where retries are computed').query));
});

// ── handler ──────────────────────────────────────────────────────────────────

test('a substantive prompt gets additionalContext: the header, the ranking, the signatures with anchors', () => {
  const dir = indexedProject();
  const r = hook(dir, { session_id: 's-ok', prompt: PROMPT });
  assert.deepStrictEqual(r.actions, ['prefetch']);
  const out = JSON.parse(r.stdout);
  assert.strictEqual(out.hookSpecificOutput.hookEventName, 'UserPromptSubmit');
  const text = context(r);
  assert.ok(text.startsWith(pf.HEADER), 'starts with the header');
  assert.ok(/1\s+src\/billing\/invoice\.js\s+[\d.]+\s+\d+ tok/.test(text), 'the ranking names the billing file first');
  assert.ok(/function paymentRetryBudget\(attempts, maxAttempts\)\s+:3-3/.test(text), 'a signature with its line anchor');
  assert.ok(Buffer.byteLength(text) <= pf.MAX_BYTES);
  assert.ok(!fs.existsSync(path.join(dir, 'CLAUDE.md')), 'the hook writes no context file');
});

test('no index, SIGMAP_PREFETCH=0 and a failing ask: silence, never an error', () => {
  const bare = mk('prefetch-bare-');
  const a = hook(bare, { session_id: 's-a', prompt: PROMPT });
  assert.strictEqual(a.stdout, null); assert.ok(/no index/.test(a.actions[0]));
  assert.ok(!fs.existsSync(path.join(bare, '.context')), 'and it creates nothing in a project without an index');
  const dir = indexedProject();
  const off = hook(dir, { session_id: 's-b', prompt: PROMPT }, { env: { ...ENV, SIGMAP_PREFETCH: '0' } });
  assert.strictEqual(off.stdout, null); assert.ok(/SIGMAP_PREFETCH=0/.test(off.actions[0]));
  const broken = hook(dir, { session_id: 's-c', prompt: PROMPT }, { script: path.join(dir, 'does-not-exist.js') });
  assert.strictEqual(broken.stdout, null); assert.ok(/ask failed/.test(broken.actions[0]), broken.actions[0]);
});

test('the same files in the same session are not injected twice; another session, other files, or no session id are', () => {
  const dir = indexedProject();
  assert.ok(hook(dir, { session_id: 'one', prompt: PROMPT }).stdout);
  const again = hook(dir, { session_id: 'one', prompt: `${PROMPT} today` });
  assert.strictEqual(again.stdout, null);
  assert.ok(/same files/.test(again.actions[0]), again.actions[0]);
  assert.ok(hook(dir, { session_id: 'two', prompt: PROMPT }).stdout, 'another session starts with nothing in its conversation');
  const other = hook(dir, { session_id: 'one', prompt: 'how do login sessions expire after a timeout' });
  assert.ok(other.stdout && /src\/auth\/session\.js/.test(context(other)), 'a different area is a different block');
  // Claude Code always sends a session id; every hook event ignores a payload without one. Called directly, the module has nothing to deduplicate against.
  assert.strictEqual(hook(dir, { prompt: PROMPT }).stdout, null, 'the hook handler ignores a payload with no session id, like every other event');
  assert.ok(pf.prefetch({ prompt: PROMPT }, dir, { script: GEN, env: ENV }).stdout && pf.prefetch({ prompt: PROMPT }, dir, { script: GEN, env: ENV }).stdout, 'without a session id there is nothing to compare with');
  const state = JSON.parse(fs.readFileSync(path.join(dir, '.context', 'prefetch-state.json'), 'utf8'));
  assert.ok(state.sessions.one && state.sessions.two && !state.sessions.undefined);
});

test('the block is capped at the byte limit, by whole file sections, with a note', () => {
  const dir = mk('prefetch-cap-');
  fs.mkdirSync(path.join(dir, 'src'));
  for (let i = 0; i < 12; i++) {
    const fns = Array.from({ length: 25 }, (_, j) => `function retryBudgetHelper${i}x${j}(attempts, maxAttempts) { return attempts + maxAttempts; }`).join('\n');
    fs.writeFileSync(path.join(dir, 'src', `retry${i}.js`), `/** Retry budget helpers ${i} for failed payments. */\n${fns}\nmodule.exports = {};\n`);
  }
  spawnSync(process.execPath, [GEN], { cwd: dir, encoding: 'utf8', env: ENV });
  const r = hook(dir, { session_id: 'cap', prompt: 'where is the retry budget for failed payments computed' }, { maxBytes: 1500 });
  const text = context(r);
  assert.ok(Buffer.byteLength(text) <= 1500, `${Buffer.byteLength(text)} bytes`);
  assert.ok(/left out to keep this short/.test(text));
  assert.ok(text.startsWith(pf.HEADER) && /1\s+src\/retry\d+\.js/.test(text), 'the ranking is whole; only signatures are cut');
});

test('it never throws, whatever it is given', () => {
  const dir = indexedProject();
  for (const payload of [undefined, null, 'x', 7, [], {}, { session_id: 3, prompt: PROMPT }, { session_id: 'x', prompt: PROMPT.repeat(500) }, { session_id: 'x', prompt: PROMPT, cwd: 5 }]) {
    assert.doesNotThrow(() => handleHook('UserPromptSubmit', payload, dir, { script: GEN, env: ENV }), JSON.stringify(payload));
    assert.doesNotThrow(() => pf.prefetch(payload, dir, { script: GEN, env: ENV }));
  }
  assert.doesNotThrow(() => pf.prefetch({ session_id: 'x', prompt: PROMPT }, '/no/such/dir', { script: GEN, env: ENV }));
});

// ── the real command ─────────────────────────────────────────────────────────

const runHook = (dir, input, env) => spawnSync(process.execPath, [GEN, 'session', 'hook', 'UserPromptSubmit'], { cwd: dir, input, encoding: 'utf8', timeout: 60000, env: { ...ENV, ...env } });

test('a real payload through the real command prints the JSON the host reads, and exits 0', () => {
  const dir = indexedProject();
  const r = runHook(dir, JSON.stringify({ session_id: 'real', hook_event_name: 'UserPromptSubmit', cwd: dir, prompt: PROMPT }));
  assert.strictEqual(r.status, 0, r.stderr);
  const out = JSON.parse(r.stdout);
  assert.strictEqual(out.hookSpecificOutput.hookEventName, 'UserPromptSubmit');
  assert.ok(/src\/billing\/invoice\.js/.test(out.hookSpecificOutput.additionalContext));
  const again = runHook(dir, JSON.stringify({ session_id: 'real', cwd: dir, prompt: PROMPT }));
  assert.strictEqual(again.status, 0); assert.strictEqual(again.stdout.trim(), '', 'a repeat prints nothing');
  assert.ok(fs.existsSync(path.join(dir, '.context', '.gitignore')), 'the state lives in the self-ignored .context/');
  assert.ok(fs.existsSync(path.join(dir, '.context', 'prefetch-state.json')));
});

test('exit 0 and no output on garbage, an empty stdin, an unindexed project and SIGMAP_PREFETCH=0', () => {
  const dir = indexedProject();
  const bare = mk('prefetch-bare-');
  for (const [d, input, env] of [
    [dir, 'not json', {}], [dir, '', {}], [dir, '{"session_id":"g"}', {}], [dir, '[]', {}],
    [bare, JSON.stringify({ session_id: 'b', cwd: bare, prompt: PROMPT }), {}],
    [dir, JSON.stringify({ session_id: 'off', cwd: dir, prompt: PROMPT }), { SIGMAP_PREFETCH: '0' }],
  ]) {
    const r = runHook(d, input, env);
    assert.strictEqual(r.status, 0, `${input.slice(0, 30)}: ${r.stderr}`);
    assert.strictEqual(r.stdout.trim(), '', `${input.slice(0, 30)} printed ${r.stdout}`);
  }
});

// ── consistency with what was measured ───────────────────────────────────────

test('the cap is under the 10,000 characters Claude Code allows a hook to inject (beyond that it saves the text to a file and shows a preview)', () => {
  assert.ok(pf.MAX_BYTES <= 10000, `${pf.MAX_BYTES} bytes is at most that many characters, but must stay under the host's limit`);
  assert.ok(pf.TIMEOUT_MS / 1000 < hi.TIMEOUT_S, 'the hook gives up before the host cancels it, so the prompt goes ahead with a clean no-output');
});

test('the header equals the one the benchmark harness measured, and so does the byte cap', async () => {
  const ab = await import(path.join(ROOT, 'scripts/lib/agent-ab.mjs'));
  assert.strictEqual(pf.HEADER, ab.PREFETCH_HEADER, 'src/session/prefetch.js and scripts/lib/agent-ab.mjs must say the same thing');
  assert.strictEqual(pf.MAX_BYTES, ab.PREFETCH_MAX_BYTES);
});

(async () => {
  for (const [name, fn] of later) {
    try { await fn(); console.log(`  PASS  ${name}`); passed++; }
    catch (e) { console.log(`  FAIL  ${name}\n        ${e.message}`); failed++; }
  }
  for (const d of dirs) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (_) { /* best effort */ } }
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})();
