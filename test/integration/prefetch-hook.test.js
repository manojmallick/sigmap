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
 *  query focus (src/session/query-focus.js)
 *  14. a prompt of two dozen words or fewer is ranked exactly as written; a long one keeps the sentences that say something
 *  15. labels ("scope: ...", "Task: ...", "What I'm trying to do: ...") and identifiers survive; pasted output goes; nothing left means the prompt as is
 *  16. a megabyte of paste costs milliseconds, before or after the question
 *  17. screen() and the hook: focused by default, SIGMAP_PREFETCH_FOCUS=0 ranks the whole prompt, and focusing changes which file ranks first
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
const qf = require(path.join(ROOT, 'src/session/query-focus'));
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

// ── query focus ──────────────────────────────────────────────────────────

const WRAPPED = 'Hi! I just joined this team and I am still getting familiar with the codebase. Could you help me with something? '
  + 'Where is the payment retry budget computed for failed payments? Thanks so much. A short explanation is plenty, there is no need to be exhaustive.';

test('a prompt of two dozen words or fewer is ranked exactly as written; a long one keeps the sentences that say something', () => {
  for (const p of ['where is the payment retry budget computed', 'Hi! Thanks so much for any help with this, much appreciated, truly', 'x '.repeat(24).trim()]) {
    assert.deepStrictEqual(qf.focusQuery(p), { query: p, focused: false }, p);
  }
  assert.ok(WRAPPED.split(/\s+/).length > qf.MIN_WORDS);
  const f = qf.focusQuery(WRAPPED);
  assert.strictEqual(f.focused, true);
  assert.ok(/Where is the payment retry budget computed for failed payments/.test(f.query), f.query);
  assert.ok(!/joined this team|Could you help|short explanation|exhaustive/.test(f.query), `the conversation is gone: ${f.query}`);
  // The instructions a harness (or a person) puts around a question go too.
  const wrapped = 'You are answering a question about the source code of an open-source project checked out in the current directory.\n\n'
    + 'Question: where is the payment retry budget computed for failed payments\n\n'
    + 'Name the repository-relative path of each file that implements this, most relevant first (at most 5), one per line, in backticks. Then give one sentence on why. Do not modify anything.';
  assert.strictEqual(qf.focusQuery(wrapped).query, 'Question: where is the payment retry budget computed for failed payments');
  assert.deepStrictEqual(qf.focusQuery(WRAPPED), qf.focusQuery(WRAPPED), 'deterministic');
  assert.deepStrictEqual(qf.focusQuery(undefined), { query: '', focused: false });
});

test('labels and identifiers survive; pasted output goes; nothing left means the prompt as written', () => {
  const pad = 'Thanks a lot for taking a look at this, I really appreciate it, and I hope your week is going well so far today.';
  // a scope label before a colon is part of the sentence, not a sentence of its own
  assert.ok(/^goproxmox: make bestSubset template matching independent of resource order/.test(qf.focusQuery(`${pad} goproxmox: make bestSubset template matching independent of resource order ${pad}`).query));
  // a chatty lead-in cannot dilute the question that follows it
  const lead = qf.focusQuery(`I am seeing a crash and I am not sure where to start, it is quite strange. What I am trying to do: fix retry logic in the uploader. ${pad}`);
  assert.ok(/fix retry logic in the uploader/.test(lead.query), lead.query);
  // identifiers keep a sentence that has few other words
  assert.ok(/computeInvoiceTotal/.test(qf.focusQuery(`${pad} Look at computeInvoiceTotal please. ${pad} ${pad}`).query));
  // fenced blocks and tool output are dropped, the prose around them is not
  const logged = 'Why does the payment retry budget stay at zero for failed payments?\n\n```\n$ npm test\nPASS tests/a.test.js\nTests: 3 passed\n```\n\n'
    + 'Traceback (most recent call last):\n  File "main.py", line 42, in run\nRuntimeError: unexpected state\n2026-11-12 10:00:01 INFO worker started\n' + pad;
  const l = qf.focusQuery(logged);
  assert.strictEqual(l.query, 'Why does the payment retry budget stay at zero for failed payments?');
  // nothing that carries content: the prompt is used as written
  const chatter = 'Hello! Thanks! Please help! Okay then, so, well, honestly, really, just checking in on this one today, thanks so much for all of it, regards and kind wishes to you.';
  assert.deepStrictEqual(qf.focusQuery(chatter), { query: chatter, focused: false });
  const onlyCode = `\`\`\`\n${'line of code here\n'.repeat(40)}\`\`\``;
  assert.strictEqual(qf.focusQuery(onlyCode).focused, false);
  // never more than the cap once it has focused
  const many = `${Array.from({ length: 60 }, (_, i) => `The payment retry budget module number ${i} computes failed charges.`).join(' ')} Thanks so much.`;
  const capped = qf.focusQuery(many);
  assert.ok(capped.focused && capped.query.split(/\s+/).length === qf.MAX_WORDS, 'a focused query is bounded');
  // and when nothing is dropped the prompt is simply left as written
  const allContent = Array.from({ length: 60 }, (_, i) => `The payment retry budget module number ${i} computes failed charges.`).join(' ');
  assert.deepStrictEqual(qf.focusQuery(allContent), { query: allContent, focused: false });
});

test('a megabyte of paste costs milliseconds, before or after the question, and the question is kept either way', () => {
  const q = 'Where is the payment retry budget computed for failed payments and what bounds the number of attempts?';
  const log = '2026-11-12 10:00:01 INFO worker started pid=1234 queue=default\n';
  for (const prompt of [`${q}\n\n${log.repeat(16000)}`, `${log.repeat(16000)}\n${q}`, `${q}\n\`\`\`python\n${'x = foo(bar)\n'.repeat(40000)}`, ' '.repeat(200000) + 'word '.repeat(30)]) {
    const t0 = Date.now();
    const f = qf.focusQuery(prompt);
    assert.ok(Date.now() - t0 < 1000, `slow: ${Date.now() - t0} ms for ${prompt.length} chars`);
    if (prompt.includes(q)) assert.ok(f.query.includes(q), 'the question survives');
  }
});

test('screen(): focused by default, the whole prompt when focusing is off, and a short prompt is never touched', () => {
  const s = pf.screen(WRAPPED);
  assert.ok(s.ok && s.focused === true && /^Where is the payment retry budget/.test(s.query), JSON.stringify(s));
  const off = pf.screen(WRAPPED, { focus: false });
  assert.ok(off.ok && off.focused === false && /Hi! I just joined this team/.test(off.query));
  const short = pf.screen(PROMPT);
  assert.deepStrictEqual([short.query, short.focused], [PROMPT, false]);
  assert.ok(pf.screen('thanks so much for the help today', {}).ok, 'a prompt of four words or more still gets a ranking');
});

test('the hook ranks the focused prompt, SIGMAP_PREFETCH_FOCUS=0 ranks the whole one, and focusing changes which file comes first', () => {
  const dir = indexedProject();
  // Boilerplate that pulls toward the auth file: login sessions are created and expired, none of it is the question.
  const prompt = 'Hi! I am writing some notes about how users log in and how login sessions are created and expired, which is not what this is about, '
    + 'and I really hope it does not matter. Where is the payment retry budget computed for failed payments? Thanks so much for the help.';
  const on = pf.prefetch({ session_id: 's-f1', prompt }, dir, { script: GEN, env: ENV });
  assert.strictEqual(on.focused, true);
  assert.ok(/^Where is the payment retry budget computed for failed payments\?$/.test(on.query), on.query);
  assert.strictEqual(pf.rankedFiles(JSON.parse(on.stdout).hookSpecificOutput.additionalContext)[0], 'src/billing/invoice.js');
  const off = pf.prefetch({ session_id: 's-f2', prompt }, dir, { script: GEN, env: { ...ENV, SIGMAP_PREFETCH_FOCUS: '0' } });
  assert.strictEqual(off.focused, false);
  assert.ok(/log in and how login sessions/.test(off.query), 'the whole prompt');
  assert.strictEqual(pf.rankedFiles(JSON.parse(off.stdout).hookSpecificOutput.additionalContext)[0], 'src/auth/session.js', 'and the boilerplate wins when nothing is dropped');
  // Through the real command (the bundled gen-context.js), not just the module.
  const r = spawnSync(process.execPath, [GEN, 'session', 'hook', 'UserPromptSubmit'], { cwd: dir, input: JSON.stringify({ session_id: 's-f3', hook_event_name: 'UserPromptSubmit', cwd: dir, prompt }), encoding: 'utf8', env: ENV });
  assert.strictEqual(r.status, 0, r.stderr);
  assert.strictEqual(pf.rankedFiles(JSON.parse(r.stdout).hookSpecificOutput.additionalContext)[0], 'src/billing/invoice.js', 'the bundle focuses too');
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
