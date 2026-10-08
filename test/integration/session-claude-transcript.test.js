'use strict';

/**
 * Claude Code transcript reader + capture (#922, SI-2).
 *
 * The transcript schema is undocumented, so the reader is tested as a parser of
 * untrusted input. The fixtures reproduce what real transcripts were measured to
 * do: repeat an assistant `message.id` across NON-adjacent lines with identical
 * usage, interleave other line types, and end mid-write.
 *
 * Tests:
 *  1.  usage is counted once per message.id, including non-adjacent repeats
 *  2.  the four billing categories map from the transcript's own fields
 *  3.  sidechain (subagent) lines are skipped and counted
 *  4.  damaged lines and malformed usage are skipped and counted, not fatal
 *  5.  no usable usage → unavailable with usage null (never zeros)
 *  6.  model: one name, mixed, unknown, and <synthetic> is ignored
 *  7.  a missing or non-file transcript is unavailable, not an exception
 *  8.  a final line with no newline: whole JSON counts, a half-written tail does not
 *  9.  a deadline stops on a line boundary and flags partial; a full parse is a superset
 *  10. recordTranscript writes one cumulative usage event; Stop + SessionEnd double-fire folds identically
 *  11. recordTranscript only reads an absolute .jsonl path
 *  12. a transcript that grows is re-read to the new cumulative total
 *  13. recordFromJson validates, stores agent-reported usage, and never invents cache numbers it was not given as measured
 *  14. recordCi writes an unavailable agent:"ci" record
 *  15. a cache category the host never reported is null (not 0); one reported on some messages is summed and flagged
 *  16. <synthetic> placeholder messages do not turn a one-model session into "mixed"
 *  17. hostile model / timestamp strings are cleaned before they reach the store
 *  18. a FIFO named *.jsonl is refused without blocking
 *  19. SessionEnd still records the end when the usage event cannot be written
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const { parseTranscript } = require(path.join(ROOT, 'src', 'session', 'claude-transcript'));
const capture = require(path.join(ROOT, 'src', 'session', 'capture'));
const store = require(path.join(ROOT, 'src', 'session', 'store'));

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  PASS  ${name}`); passed++; } catch (err) { console.log(`  FAIL  ${name}: ${err.message}`); failed++; }
}

function tmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-transcript-'));
}

let seq = 0;
function assistant(id, usage, extra = {}) {
  return JSON.stringify({
    type: 'assistant', uuid: `u${++seq}`, timestamp: `2026-10-01T10:00:${String(seq % 60).padStart(2, '0')}.000Z`,
    message: { id, model: 'claude-test-1', role: 'assistant', content: [], usage }, ...extra,
  });
}
const user = () => JSON.stringify({ type: 'user', uuid: `u${++seq}`, message: { role: 'user', content: 'hi' } });
const noise = () => JSON.stringify({ type: 'attachment', uuid: `u${++seq}`, attachment: { kind: 'x' } });
const usage = (i, o, cr, cw) => ({ input_tokens: i, output_tokens: o, cache_read_input_tokens: cr, cache_creation_input_tokens: cw });

function write(lines, opts = {}) {
  const dir = tmp();
  const file = path.join(dir, 'session.jsonl');
  fs.writeFileSync(file, lines.join('\n') + (opts.noFinalNewline ? '' : '\n'));
  return { dir, file };
}

console.log('[session-claude-transcript.test.js] transcript reader + capture (#922)');
console.log('');

test('usage is counted once per message.id, including non-adjacent repeats', () => {
  const { file } = write([
    assistant('m1', usage(10, 5, 100, 20)),
    noise(), user(), noise(), noise(), noise(), noise(), noise(),
    assistant('m1', usage(10, 5, 100, 20)), // same message, far from its first line
    assistant('m2', usage(1, 2, 3, 4)),
    assistant('m1', usage(10, 5, 100, 20)),
    assistant('m2', usage(1, 2, 3, 4)),
  ]);
  const r = parseTranscript(file);
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.messages, 2);
  assert.deepStrictEqual(r.usage, { in: 11, out: 7, cacheRead: 103, cacheWrite: 24 });
  assert.strictEqual(r.source, 'transcript');
});

test('the four billing categories map from the transcript fields, not each other', () => {
  const { file } = write([assistant('m1', usage(1, 20, 300, 4000))]);
  assert.deepStrictEqual(parseTranscript(file).usage, { in: 1, out: 20, cacheRead: 300, cacheWrite: 4000 });
  // A cache field the host omitted everywhere is not damage — and not zero either: it is unknown.
  const { file: f2 } = write([assistant('m1', { input_tokens: 5, output_tokens: 6 })]);
  const r = parseTranscript(f2);
  assert.deepStrictEqual(r.usage, { in: 5, out: 6, cacheRead: null, cacheWrite: null });
  assert.strictEqual(r.parseErrors, 0);
});

test('sidechain (subagent) lines are skipped and counted', () => {
  const { file } = write([
    assistant('m1', usage(1, 1, 1, 1)),
    assistant('s1', usage(900, 900, 900, 900), { isSidechain: true }),
  ]);
  const r = parseTranscript(file);
  assert.deepStrictEqual(r.usage, { in: 1, out: 1, cacheRead: 1, cacheWrite: 1 });
  assert.strictEqual(r.skippedSidechain, 1);
});

test('damaged lines and malformed usage are skipped and counted, not fatal', () => {
  const { file } = write([
    assistant('m1', usage(1, 1, 1, 1)),
    '{"type":"assistant","message":{"id":"m2","usage":{"input_tokens":',   // truncated, mentions "usage"
    'this is not json at all',                                              // not brace-delimited
    assistant('m3', usage('lots', 2, 3, 4)),                                // non-numeric
    assistant('m4', usage(-1, 2, 3, 4)),                                    // negative
    assistant('m5', { input_tokens: 1, output_tokens: 1, cache_read_input_tokens: null }),
    assistant('m6', usage(2, 2, 2, 2)),
  ]);
  const r = parseTranscript(file);
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.messages, 2, 'only m1 and m6 are usable');
  assert.deepStrictEqual(r.usage, { in: 3, out: 3, cacheRead: 3, cacheWrite: 3 });
  assert.strictEqual(r.parseErrors, 5);
});

test('no usable usage → unavailable with usage null (never zeros)', () => {
  const { file } = write([user(), noise(), assistant('m1', usage('x', 'y', 0, 0))]);
  const r = parseTranscript(file);
  assert.strictEqual(r.source, 'unavailable');
  assert.strictEqual(r.usage, null);
  assert.strictEqual(r.messages, 0);
  assert.strictEqual(r.model, 'unknown');
  const empty = write([]);
  fs.writeFileSync(empty.file, '');
  assert.strictEqual(parseTranscript(empty.file).usage, null);
});

test('model: one name, mixed, unknown, and <synthetic> is ignored', () => {
  const m = (id, model) => JSON.stringify({ type: 'assistant', message: { id, model, usage: usage(1, 1, 0, 0) } });
  assert.strictEqual(parseTranscript(write([m('a', 'opus'), m('b', 'opus')]).file).model, 'opus');
  const mixed = parseTranscript(write([m('a', 'opus'), m('b', 'haiku')]).file);
  assert.strictEqual(mixed.model, 'mixed');
  assert.deepStrictEqual(Object.keys(mixed.models).sort(), ['haiku', 'opus']);
  assert.strictEqual(mixed.models.opus.in, 1);
  assert.strictEqual(parseTranscript(write([m('a', undefined)]).file).model, 'unknown', 'a model the transcript does not name is not inferred');
  assert.strictEqual(parseTranscript(write([m('a', '<synthetic>')]).file).model, 'unknown');
  assert.strictEqual(parseTranscript(write([m('a', 'opus'), m('b', undefined)]).file).model, 'mixed', 'some messages unnamed → not claimed as one model');
});

test('a missing or non-file transcript is unavailable, not an exception', () => {
  const r = parseTranscript(path.join(tmp(), 'nope.jsonl'));
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.source, 'unavailable');
  assert.strictEqual(r.error, 'ENOENT');
  const dir = parseTranscript(tmp());
  assert.strictEqual(dir.ok, false);
});

test('a final line with no newline: whole JSON counts, a half-written tail does not', () => {
  const whole = write([assistant('m1', usage(1, 1, 1, 1)), assistant('m2', usage(2, 2, 2, 2))], { noFinalNewline: true });
  const w = parseTranscript(whole.file);
  assert.strictEqual(w.messages, 2);
  assert.strictEqual(w.offset, w.size);
  const half = write([assistant('m1', usage(1, 1, 1, 1))]);
  fs.appendFileSync(half.file, '{"type":"assistant","message":{"id":"m2","usage":{"input_tok');
  const h = parseTranscript(half.file);
  assert.strictEqual(h.messages, 1);
  assert.strictEqual(h.parseErrors, 0, 'a tail the host is still writing is not damage');
  assert.ok(h.offset < h.size, 'the offset stops before the unfinished line');
});

test('a deadline stops on a line boundary and flags partial; a full parse is a superset', () => {
  const lines = [];
  for (let i = 0; i < 3000; i++) lines.push(assistant(`m${i}`, usage(1, 1, 1, 1)));
  const { file } = write(lines);
  const part = parseTranscript(file, { deadlineMs: -1 });
  assert.strictEqual(part.partial, true);
  assert.ok(part.messages > 0 && part.messages < 3000, `partial read ${part.messages}`);
  assert.ok(part.offset < part.size);
  const buf = fs.readFileSync(file);
  assert.strictEqual(buf[part.offset - 1], 10, 'the offset sits just after a newline');
  const full = parseTranscript(file);
  assert.strictEqual(full.partial, false);
  assert.strictEqual(full.messages, 3000);
  assert.ok(full.usage.in >= part.usage.in);
  const capped = parseTranscript(file, { maxBytes: 2048 });
  assert.strictEqual(capped.partial, true, 'stopping at maxBytes is also partial');
});

test('recordTranscript writes one cumulative usage event; Stop + SessionEnd double-fire folds identically', () => {
  const cwd = tmp();
  const { file } = write([assistant('m1', usage(10, 5, 100, 20)), noise(), assistant('m1', usage(10, 5, 100, 20)), assistant('m2', usage(1, 2, 3, 4))]);
  const id = 'cc-dbl';
  const a = capture.recordTranscript(cwd, id, file, {});
  assert.strictEqual(a.event.kind, 'usage');
  assert.strictEqual(a.event.coverage, 'main');
  assert.strictEqual(a.event.offset, fs.statSync(file).size);
  assert.deepStrictEqual(a.event.usage, { in: 11, out: 7, cacheRead: 103, cacheWrite: 24 });
  const once = store.readSessions(cwd).sessions[0].usage;
  capture.recordTranscript(cwd, id, file, {}); // SessionEnd after Stop: same transcript, same totals
  capture.recordTranscript(cwd, id, file, {});
  const sessions = store.readSessions(cwd).sessions;
  assert.strictEqual(sessions.length, 1);
  assert.deepStrictEqual(sessions[0].usage, once, 'three fires fold to the same totals as one');
  // skipIfUnchanged: a Stop on an unchanged transcript writes nothing.
  const before = store.readEvents(cwd).events.length;
  const skipped = capture.recordTranscript(cwd, id, file, { skipIfUnchanged: true });
  assert.strictEqual(skipped.skipped, true);
  assert.strictEqual(store.readEvents(cwd).events.length, before);
});

test('recordTranscript only reads an absolute .jsonl path', () => {
  const cwd = tmp();
  for (const bad of [undefined, null, '', 'relative/x.jsonl', '/etc/passwd', 42, {}]) {
    const r = capture.recordTranscript(cwd, 'cc-1', bad, {});
    assert.strictEqual(r.event, null, `refused ${JSON.stringify(bad)}`);
    assert.match(r.error, /absolute path to a \.jsonl/);
  }
  assert.ok(!fs.existsSync(store.storePath(cwd)), 'nothing was written');
});

test('a transcript that grows is re-read to the new cumulative total', () => {
  const cwd = tmp();
  const { file } = write([assistant('m1', usage(1, 1, 1, 1))]);
  capture.recordTranscript(cwd, 'cc-g', file, {});
  fs.appendFileSync(file, assistant('m2', usage(2, 2, 2, 2)) + '\n' + assistant('m1', usage(1, 1, 1, 1)) + '\n');
  capture.recordTranscript(cwd, 'cc-g', file, {});
  const s = store.readSessions(cwd).sessions[0];
  assert.deepStrictEqual(s.usage, { in: 3, out: 3, cacheRead: 3, cacheWrite: 3 }, 'm1 is not counted again when it reappears after the watermark');
  assert.strictEqual(s.offset, fs.statSync(file).size);
});

test('recordFromJson validates and stores agent-reported usage', () => {
  const cwd = tmp();
  const r = capture.recordFromJson(cwd, { id: 'run-7', agent: 'aider', model: 'gpt-x', usage: { in: 1200, out: 340 } }, {});
  assert.strictEqual(r.id, 'aider-run-7');
  const s = store.readSessions(cwd).sessions[0];
  assert.strictEqual(s.source, 'agent-reported');
  assert.strictEqual(s.provenance, 'agent-reported');
  assert.deepStrictEqual(s.usage, { in: 1200, out: 340, cacheRead: null, cacheWrite: null }, 'categories the agent did not report stay unknown, not 0');
  assert.strictEqual(s.model, 'gpt-x');
  assert.strictEqual(s.ended, true);
  capture.recordFromJson(cwd, { id: 'e1', agent: 'x', source: 'estimate', usage: { in: 1, out: 1 } }, {});
  assert.strictEqual(store.readSessions(cwd).sessions.find((x) => x.id === 'x-e1').provenance, 'estimated (chars/4 ±5%)');
  for (const bad of [null, [], {}, { id: 'a' }, { id: 'a', usage: {} }, { id: 'a', usage: { in: 1 } }, { id: 'a', usage: { in: -1, out: 1 } }, { id: 'a', usage: { in: 'x', out: 1 } }, { id: ' ', usage: { in: 1, out: 1 } }]) {
    assert.throws(() => capture.recordFromJson(tmp(), bad, {}), Error, `rejected ${JSON.stringify(bad)}`);
  }
  assert.strictEqual(store.readSessions(cwd).sessions.length, 2, 'rejected input wrote nothing');
});

test('recordCi writes an unavailable agent:"ci" record', () => {
  const cwd = tmp();
  const r = capture.recordCi(cwd, { env: { GITHUB_ACTIONS: 'true', GITHUB_RUN_ID: '987', GITHUB_RUN_ATTEMPT: '2', GITHUB_REF_NAME: 'main' } });
  assert.strictEqual(r.id, 'ci-987-2');
  assert.strictEqual(r.runner, 'github-actions');
  const s = store.readSessions(cwd).sessions[0];
  assert.strictEqual(s.agent, 'ci');
  assert.strictEqual(s.ci, true);
  assert.strictEqual(s.branch, 'main');
  assert.strictEqual(s.usage, null, 'a CI job has no transcript: unavailable, not zero');
  assert.strictEqual(s.source, 'unavailable');
  assert.strictEqual(s.ended, true);
});


test('a cache category the host never reported is null (not 0); one reported on some messages is summed and flagged', () => {
  const none = parseTranscript(write([assistant('a', { input_tokens: 1, output_tokens: 1 }), assistant('b', { input_tokens: 2, output_tokens: 2 })]).file);
  assert.deepStrictEqual(none.usage, { in: 3, out: 3, cacheRead: null, cacheWrite: null });
  assert.strictEqual(none.cacheGaps, 0, 'nothing to flag when the category is simply null');
  const some = parseTranscript(write([assistant('a', usage(1, 1, 5, 6)), assistant('b', { input_tokens: 2, output_tokens: 2 })]).file);
  assert.deepStrictEqual(some.usage, { in: 3, out: 3, cacheRead: 5, cacheWrite: 6 }, 'summed over the messages that reported it');
  assert.strictEqual(some.cacheGaps, 1, 'and the omission is counted');
  const cwd = tmp();
  const { file } = write([assistant('a', usage(1, 1, 5, 6)), assistant('b', { input_tokens: 2, output_tokens: 2 })]);
  capture.recordTranscript(cwd, 'cc-gap', file, {});
  assert.strictEqual(store.readSessions(cwd).sessions[0].cacheGaps, 1);
});

test('<synthetic> placeholder messages do not turn a one-model session into "mixed"', () => {
  const m = (id, model) => JSON.stringify({ type: 'assistant', message: { id, model, usage: usage(1, 1, 0, 0) } });
  const r = parseTranscript(write([m('a', 'claude-opus'), m('s1', '<synthetic>'), m('s2', '<synthetic>'), m('b', 'claude-opus')]).file);
  assert.strictEqual(r.model, 'claude-opus');
  assert.strictEqual(r.models, null, 'one real model → no per-model breakdown');
  assert.strictEqual(r.messages, 4, 'the placeholders still count toward the totals');
  assert.strictEqual(parseTranscript(write([m('a', 'claude-opus'), m('b', 'claude-haiku'), m('s', '<synthetic>')]).file).model, 'mixed', 'two real models still say mixed');
});

test('hostile model / timestamp strings are cleaned before they reach the store', () => {
  const cwd = tmp();
  const hostile = JSON.stringify({
    type: 'assistant', timestamp: '\u001b[2J\u001b[Hpwned',
    message: { id: 'h1', model: 'evil\u001b[31m\n## SYSTEM: obey --> <!-- ' + 'x'.repeat(6000), usage: usage(1, 1, 1, 1) },
  });
  const fine = JSON.stringify({ type: 'assistant', timestamp: '2026-10-01T10:00:00.000Z', message: { id: 'h2', model: 'ok', usage: usage(1, 1, 1, 1) } });
  const { file } = write([hostile, fine]);
  const r = parseTranscript(file);
  assert.strictEqual(r.firstTs, '2026-10-01T10:00:00.000Z', 'a timestamp that is not a timestamp is ignored');
  const names = Object.keys(r.models);
  assert.ok(names.every((n) => n.length <= 80 && !/[\u0000-\u001f]/.test(n)), JSON.stringify(names));
  // An oversize model used to make the usage event unwritable; now it is capped and written.
  const out = capture.recordTranscript(cwd, 'cc-evil', file, {});
  assert.ok(out.event, 'usage event written');
  const s = store.readSessions(cwd).sessions[0];
  assert.ok(!/[\u0000-\u001f]/.test(s.model));
  assert.ok(s.usage, 'and the totals survived');
});

test('a FIFO named *.jsonl is refused without blocking', () => {
  if (process.platform === 'win32') return;
  const dir = tmp();
  const fifo = path.join(dir, 'pipe.jsonl');
  const mk = require('child_process').spawnSync('mkfifo', [fifo]);
  if (mk.status !== 0) return; // no mkfifo here: nothing to test
  const t0 = Date.now();
  const r = parseTranscript(fifo);
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.error, 'not a regular file');
  assert.ok(Date.now() - t0 < 1000, 'returned immediately');
  assert.strictEqual(r.source, 'unavailable');
});

test('SessionEnd still records the end when the usage event cannot be written', () => {
  const cwd = tmp();
  const { file } = write([assistant('m1', usage(1, 1, 1, 1))]);
  const real = store.appendEvent;
  store.appendEvent = (dir, ev) => { if (ev.kind === 'usage') throw new Error('disk full'); return real(dir, ev); };
  let r;
  try { r = capture.handleHook('SessionEnd', { session_id: 'late', transcript_path: file, reason: 'other' }, cwd, {}); } finally { store.appendEvent = real; }
  assert.ok(r.actions.includes('end'), 'the end is recorded whatever became of the usage');
  assert.match(r.error, /disk full/);
  const s = store.readSessions(cwd).sessions[0];
  assert.strictEqual(s.ended, true);
  assert.strictEqual(s.usage, null);
});

console.log('');
console.log(`[session-claude-transcript.test.js] ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
