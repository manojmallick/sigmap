'use strict';

/**
 * Session store (#922, SI-2): the append-only, event-sourced log and its fold.
 *
 * Tests:
 *  1.  appendEvent writes exactly one JSON line and prefixes agent ids
 *  2.  concurrent writers (real processes) produce a fold-clean store
 *  3.  the fold keeps the highest-offset usage event, so a double-fire is idempotent
 *  4.  unknown stays unknown: no usage → usage null, source unavailable, model "unknown"
 *  5.  token categories are never summed across provenance classes
 *  6.  unreadable and newer-schema lines are skipped and counted, never fatal
 *  7.  a resumed session (start after end) reads as open
 *  8.  oversize events are refused (they would interleave)
 *  9.  queryRecord: off logs nothing, hashed keeps no text, full redacts
 *  10. sessionConfig defaults and rejects bad values
 *  11. compact folds old sessions into per-provenance monthly rollups, idempotently
 *  12. compact leaves recent sessions alone and is a no-op when nothing is old
 *  13. compact does not run under a live lock, and takes over a stale one
 *  14. maybeCompact honours retention.compact "off" and the size floor
 *  15. inspect reports store health
 *  16. compaction copies across events appended while it rewrites (no tail loss)
 *  17. compaction carries lines it does not understand through byte for byte
 *  18. the fold does not depend on line order (branch, end reason, agent: latest timestamp wins)
 *  19. strings from the file are stripped of control characters and capped
 *  20. a cache category nobody reported is null, never 0, and sums stay floors
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const store = require(path.join(ROOT, 'src', 'session', 'store'));

let passed = 0;
let failed = 0;
const pending = [];

function test(name, fn) {
  pending.push(Promise.resolve().then(fn).then(
    () => { console.log(`  PASS  ${name}`); passed++; },
    (err) => { console.log(`  FAIL  ${name}: ${err.message}`); failed++; },
  ));
}

function tmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-session-'));
}

const U = (i, o, cr, cw) => ({ in: i, out: o, cacheRead: cr, cacheWrite: cw });
const daysAgo = (n, now) => new Date(now - n * 86400000).toISOString();

console.log('[session-store.test.js] event-sourced session store (#922)');
console.log('');

test('appendEvent writes exactly one JSON line and prefixes agent ids', () => {
  const cwd = tmp();
  const id = store.sessionId('claude-code', 'abc-123');
  assert.strictEqual(id, 'cc-abc-123');
  assert.strictEqual(store.sessionId('claude-code', 'cc-abc-123'), 'cc-abc-123', 'already prefixed ids are kept');
  assert.strictEqual(store.sessionId('cursor', 'x'), 'cur-x');
  assert.strictEqual(store.sessionId('aider', 'run-7'), 'aider-run-7', 'an unknown agent keeps its own name, not a truncation');
  assert.strictEqual(store.sessionId('ci', 'run/../9'), 'ci-run..9', 'path characters are stripped from ids');
  store.appendEvent(cwd, { kind: 'start', id, agent: 'claude-code' });
  const raw = fs.readFileSync(store.storePath(cwd), 'utf8');
  assert.strictEqual(raw.split('\n').filter(Boolean).length, 1);
  assert.ok(raw.endsWith('\n'));
  const e = JSON.parse(raw);
  assert.strictEqual(e.schema, 1);
  assert.deepStrictEqual(Object.keys(e).slice(0, 4), ['schema', 'kind', 'id', 'ts']);
  assert.throws(() => store.appendEvent(cwd, { kind: 'bogus', id }), /unknown session event kind/);
  assert.throws(() => store.appendEvent(cwd, { kind: 'start' }), /needs an id/);
});

test('concurrent writers (real processes) produce a fold-clean store', async () => {
  const cwd = tmp();
  const WRITERS = 6;
  const PER = 40;
  const script = `
    const store = require(${JSON.stringify(path.join(ROOT, 'src', 'session', 'store'))});
    const [cwd, who, per] = process.argv.slice(1);
    const id = 'cc-w' + who;
    store.appendEvent(cwd, { kind: 'start', id, agent: 'claude-code' });
    for (let i = 1; i <= Number(per); i++) {
      store.appendEvent(cwd, { kind: 'usage', id, source: 'transcript', model: 'm', offset: i,
        usage: { in: i, out: i, cacheRead: i, cacheWrite: i } });
    }
    store.appendEvent(cwd, { kind: 'end', id, reason: 'x' });
  `;
  await Promise.all(Array.from({ length: WRITERS }, (_, w) => new Promise((resolve, reject) => {
    const p = spawn(process.execPath, ['-e', script, cwd, String(w), String(PER)], { stdio: 'ignore' });
    p.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`writer ${w} exited ${code}`))));
  })));
  const { events, corrupt, unsupported } = store.readEvents(cwd);
  assert.strictEqual(corrupt, 0, 'no torn or interleaved line');
  assert.strictEqual(unsupported, 0);
  assert.strictEqual(events.length, WRITERS * (PER + 2));
  const { sessions } = store.foldSessions(events);
  assert.strictEqual(sessions.length, WRITERS);
  for (const s of sessions) {
    assert.strictEqual(s.events, PER + 2);
    assert.strictEqual(s.ended, true);
    assert.deepStrictEqual(s.usage, U(PER, PER, PER, PER), 'the highest-offset event wins whatever the interleaving');
  }
});

test('the fold keeps the highest-offset usage event, so a double-fire is idempotent', () => {
  const id = 'cc-1';
  const mid = { kind: 'usage', id, ts: '2026-10-01T10:00:00.000Z', source: 'transcript', model: 'm', offset: 100, usage: U(1, 2, 3, 4) };
  const fin = { kind: 'usage', id, ts: '2026-10-01T10:05:00.000Z', source: 'transcript', model: 'm', offset: 500, usage: U(10, 20, 30, 40) };
  const a = store.foldSessions([mid, fin, fin]).sessions[0];
  const b = store.foldSessions([fin, mid, fin, fin]).sessions[0];
  assert.deepStrictEqual(a.usage, U(10, 20, 30, 40));
  assert.deepStrictEqual(a.usage, b.usage, 'order and repetition do not change the totals');
  assert.strictEqual(a.offset, 500);
});

test('unknown stays unknown: no usage → usage null, source unavailable, model "unknown"', () => {
  const s = store.foldSessions([{ kind: 'start', id: 'cc-9', ts: '2026-10-01T00:00:00.000Z' }]).sessions[0];
  assert.strictEqual(s.usage, null);
  assert.strictEqual(s.source, 'unavailable');
  assert.strictEqual(s.provenance, 'unavailable');
  assert.strictEqual(s.model, 'unknown');
  const u = store.foldSessions([{ kind: 'usage', id: 'cc-8', source: 'unavailable', model: 'unknown', offset: 0 }]).sessions[0];
  assert.strictEqual(u.usage, null, 'an unavailable usage event never becomes zeros');
  const bad = store.foldSessions([{ kind: 'usage', id: 'cc-7', source: 'transcript', offset: 5, usage: { in: 1, out: 2 } }]).sessions[0];
  assert.strictEqual(bad.usage, null, 'a usage object missing a category is unknown, not zero-filled');
});

test('token categories are never summed across provenance classes', () => {
  const { totalsByProvenance } = require(path.join(ROOT, 'src', 'session', 'render'));
  const { sessions } = store.foldSessions([
    { kind: 'usage', id: 'cc-1', source: 'transcript', offset: 1, usage: U(1, 1, 1, 1) },
    { kind: 'usage', id: 'cc-2', source: 'transcript', offset: 1, usage: U(2, 2, 2, 2) },
    { kind: 'usage', id: 'aider-3', source: 'agent-reported', offset: 0, usage: U(100, 100, 0, 0) },
    { kind: 'usage', id: 'cc-4', source: 'unavailable', offset: 0 },
  ]);
  const t = totalsByProvenance(sessions);
  assert.deepStrictEqual(Object.keys(t).sort(), ['agent-reported', 'measured']);
  assert.deepStrictEqual(t.measured.usage, U(3, 3, 3, 3));
  assert.strictEqual(t.measured.sessions, 2);
  assert.deepStrictEqual(t['agent-reported'].usage, U(100, 100, 0, 0));
});

test('unreadable and newer-schema lines are skipped and counted, never fatal', () => {
  const cwd = tmp();
  store.appendEvent(cwd, { kind: 'start', id: 'cc-1' });
  fs.appendFileSync(store.storePath(cwd), 'not json\n{"half":\n{"schema":99,"kind":"start","id":"cc-future"}\n{"schema":1,"kind":"start"}\n');
  store.appendEvent(cwd, { kind: 'end', id: 'cc-1' });
  const r = store.readSessions(cwd);
  assert.strictEqual(r.sessions.length, 1);
  assert.strictEqual(r.corrupt, 3, 'bad JSON, truncated JSON and an event with no id');
  assert.strictEqual(r.unsupported, 1, 'a newer schema is counted separately');
  assert.strictEqual(r.sessions[0].ended, true);
});

test('a resumed session (start after end) reads as open', () => {
  const s = store.foldSessions([
    { kind: 'start', id: 'cc-1', ts: '2026-10-01T10:00:00.000Z' },
    { kind: 'end', id: 'cc-1', ts: '2026-10-01T11:00:00.000Z' },
    { kind: 'start', id: 'cc-1', ts: '2026-10-01T12:00:00.000Z' },
  ]).sessions[0];
  assert.strictEqual(s.ended, false);
  assert.strictEqual(s.startedAt, '2026-10-01T10:00:00.000Z', 'the first start still dates the session');
});

test('oversize events are refused (they would interleave)', () => {
  const cwd = tmp();
  assert.throws(() => store.appendEvent(cwd, { kind: 'query', id: 'cc-1', q: 'x'.repeat(5000) }), /larger than/);
  assert.ok(!fs.existsSync(store.storePath(cwd)) || fs.readFileSync(store.storePath(cwd), 'utf8') === '');
});

test('queryRecord: off logs nothing, hashed keeps no text, full redacts', () => {
  assert.strictEqual(store.queryRecord('where is login', 'off'), null);
  const h = store.queryRecord('where is login', 'hashed');
  assert.deepStrictEqual(Object.keys(h), ['qh']);
  assert.match(h.qh, /^[0-9a-f]{12}$/);
  assert.strictEqual(h.qh, store.queryRecord('where is login', 'hashed').qh, 'stable digest');
  assert.ok(!JSON.stringify(h).includes('login'));
  const key = 'AKIAIOSFODNN7EXAMPLE';
  const f = store.queryRecord(`why does ${key} fail`, 'full');
  assert.deepStrictEqual(Object.keys(f), ['q']);
  assert.ok(!f.q.includes(key), 'a secret is redacted on write');
  assert.ok(f.q.includes('REDACTED'));
  assert.strictEqual(store.queryRecord('y'.repeat(900), 'full').q.length, 200, 'capped');
  assert.strictEqual(store.queryRecord('   ', 'hashed'), null);
});

test('sessionConfig defaults and rejects bad values', () => {
  assert.deepStrictEqual(store.sessionConfig({}), { retention: { days: 90, compact: 'monthly' }, logQueries: 'hashed', injectSummary: false });
  const bad = store.sessionConfig({ session: { retention: { days: -5, compact: 'weekly' }, logQueries: 'everything', injectSummary: 'yes' } });
  assert.deepStrictEqual(bad, { retention: { days: 90, compact: 'monthly' }, logQueries: 'hashed', injectSummary: false });
  const ok = store.sessionConfig({ session: { retention: { days: 7, compact: 'off' }, logQueries: 'off', injectSummary: true } });
  assert.deepStrictEqual(ok, { retention: { days: 7, compact: 'off' }, logQueries: 'off', injectSummary: true });
  assert.strictEqual(store.sessionConfig({ session: { retention: { days: 30 } } }).retention.compact, 'monthly', 'a partial retention block keeps the other default');
});

function seedOldAndNew(cwd, now) {
  const mk = (id, ts, source, usage, agent) => {
    store.appendEvent(cwd, { kind: 'start', id, ts, agent });
    store.appendEvent(cwd, { kind: 'usage', id, ts, source, model: 'm1', offset: 1, ...(usage ? { usage } : {}) });
    store.appendEvent(cwd, { kind: 'end', id, ts });
  };
  mk('cc-old1', daysAgo(200, now), 'transcript', U(10, 20, 30, 40), 'claude-code');
  mk('cc-old2', daysAgo(200, now), 'transcript', U(1, 2, 3, 4), 'claude-code');
  mk('aider-old3', daysAgo(200, now), 'agent-reported', U(5, 5, 0, 0), 'aider');
  mk('cc-old4', daysAgo(200, now), 'unavailable', null, 'claude-code');
  store.appendEvent(cwd, { kind: 'query', id: 'cc-old1', ts: daysAgo(200, now), qh: 'abc' });
  mk('cc-new', daysAgo(2, now), 'transcript', U(7, 7, 7, 7), 'claude-code');
}

test('compact folds old sessions into per-provenance monthly rollups, idempotently', () => {
  const cwd = tmp();
  const now = Date.now();
  seedOldAndNew(cwd, now);
  const res = store.compact(cwd, { days: 90, now });
  assert.strictEqual(res.action, 'compacted');
  assert.strictEqual(res.sessions, 4);
  const { events } = store.readEvents(cwd);
  const rollups = events.filter((e) => e.kind === 'rollup');
  const measured = rollups.find((r) => r.source === 'transcript');
  assert.deepStrictEqual(measured.usage, U(11, 22, 33, 44), 'same provenance + agent + model + month sum');
  assert.strictEqual(measured.sessions, 2);
  const reported = rollups.find((r) => r.source === 'agent-reported');
  assert.deepStrictEqual(reported.usage, U(5, 5, 0, 0), 'a different provenance class is a separate rollup');
  const unavail = rollups.find((r) => r.source === 'unavailable');
  assert.strictEqual(unavail.usage, null, 'unavailable stays unavailable — never a summed zero');
  assert.strictEqual(unavail.sessions, 1);
  assert.ok(!events.some((e) => e.id === 'cc-old1' && e.kind !== 'rollup'), 'raw events of folded sessions are dropped, queries with them');
  assert.ok(events.some((e) => e.id === 'cc-new' && e.kind === 'usage'), 'the recent session is untouched');
  // Idempotent: nothing more is old, and the rollups stay as they are.
  const before = fs.readFileSync(store.storePath(cwd), 'utf8');
  assert.strictEqual(store.compact(cwd, { days: 90, now }).action, 'none');
  assert.strictEqual(fs.readFileSync(store.storePath(cwd), 'utf8'), before, 'a no-op does not rewrite the file');
  // The fold still reads the surviving session and exposes the rollups.
  const r = store.readSessions(cwd);
  assert.deepStrictEqual(r.sessions.map((s) => s.id), ['cc-new']);
  assert.strictEqual(r.rollups.length, 3);
});

test('compact merges new old sessions into an existing rollup of the same key', () => {
  const cwd = tmp();
  const now = Date.now();
  seedOldAndNew(cwd, now);
  store.compact(cwd, { days: 90, now });
  store.appendEvent(cwd, { kind: 'start', id: 'cc-old5', ts: daysAgo(200, now), agent: 'claude-code' });
  store.appendEvent(cwd, { kind: 'usage', id: 'cc-old5', ts: daysAgo(200, now), source: 'transcript', model: 'm1', offset: 1, usage: U(100, 0, 0, 0) });
  store.compact(cwd, { days: 90, now });
  const rollups = store.readEvents(cwd).events.filter((e) => e.kind === 'rollup' && e.source === 'transcript');
  assert.strictEqual(rollups.length, 1, 'one rollup per (month, agent, model, source)');
  assert.deepStrictEqual(rollups[0].usage, U(111, 22, 33, 44));
  assert.strictEqual(rollups[0].sessions, 3);
});

test('compact leaves recent sessions alone and is a no-op when nothing is old', () => {
  const cwd = tmp();
  const now = Date.now();
  store.appendEvent(cwd, { kind: 'start', id: 'cc-1', ts: daysAgo(1, now) });
  const before = fs.readFileSync(store.storePath(cwd), 'utf8');
  assert.deepStrictEqual(store.compact(cwd, { days: 90, now }), { action: 'none', sessions: 0, removedEvents: 0 });
  assert.strictEqual(fs.readFileSync(store.storePath(cwd), 'utf8'), before);
  assert.strictEqual(store.compact(tmp(), { days: 90 }).action, 'none', 'no store at all is fine');
});

test('compact does not run under a live lock, and takes over a stale one', () => {
  const cwd = tmp();
  const now = Date.now();
  seedOldAndNew(cwd, now);
  const lock = path.join(cwd, '.context', 'sessions.lock');
  fs.writeFileSync(lock, '1');
  assert.strictEqual(store.compact(cwd, { days: 90, now }).action, 'locked');
  assert.ok(fs.existsSync(lock), 'a live lock is not removed');
  const old = new Date(Date.now() - 120000);
  fs.utimesSync(lock, old, old);
  assert.strictEqual(store.compact(cwd, { days: 90, now }).action, 'compacted', 'a stale lock is taken over');
  assert.ok(!fs.existsSync(lock), 'the lock is released');
});

test('maybeCompact honours retention.compact "off" and the size floor', () => {
  const cwd = tmp();
  const now = Date.now();
  seedOldAndNew(cwd, now);
  assert.strictEqual(store.maybeCompact(cwd, { session: { retention: { compact: 'off' } } }, { minBytes: 0, now }).action, 'off');
  assert.strictEqual(store.maybeCompact(cwd, {}, { now }).action, 'none', 'below the size floor nothing is read or rewritten');
  assert.strictEqual(store.maybeCompact(cwd, {}, { minBytes: 0, now }).action, 'compacted');
  assert.strictEqual(store.maybeCompact(tmp(), {}).action, 'none');
});

test('inspect reports store health', () => {
  const cwd = tmp();
  assert.strictEqual(store.inspect(cwd).exists, false);
  store.appendEvent(cwd, { kind: 'start', id: 'cc-1' });
  fs.appendFileSync(store.storePath(cwd), 'garbage\n');
  const i = store.inspect(cwd);
  assert.strictEqual(i.exists, true);
  assert.strictEqual(i.sessions, 1);
  assert.strictEqual(i.open, 1);
  assert.strictEqual(i.corrupt, 1);
  assert.ok(i.bytes > 0);
});


test('compaction copies across events appended while it rewrites (no tail loss)', () => {
  const cwd = tmp();
  const now = Date.now();
  seedOldAndNew(cwd, now);
  let appended = 0;
  const res = store.compact(cwd, {
    days: 90, now,
    // A hook fires while the rewrite is in flight — once before, once again during the copy-across.
    _afterTmpWrite: () => {
      store.appendEvent(cwd, { kind: 'end', id: 'cc-new', reason: 'LATE-1' });
      store.appendEvent(cwd, { kind: 'start', id: 'cc-late', agent: 'claude-code' });
      appended = 2;
    },
  });
  assert.strictEqual(res.action, 'compacted');
  assert.strictEqual(appended, 2);
  const events = store.readEvents(cwd).events;
  assert.ok(events.some((e) => e.reason === 'LATE-1'), 'an event appended mid-rewrite survives');
  assert.ok(events.some((e) => e.id === 'cc-late'), 'so does a whole new session');
  assert.ok(!fs.readdirSync(path.join(cwd, '.context')).some((f) => f.endsWith('.tmp')), 'no tmp file is left behind');
});

test('compaction carries lines it does not understand through byte for byte', () => {
  const cwd = tmp();
  const now = Date.now();
  seedOldAndNew(cwd, now);
  const foreign = '{"schema":2,"kind":"start","id":"cc-future","ts":"2026-01-01T00:00:00.000Z","extra":{"nested":[1,2,3]}}';
  const newKind = JSON.stringify({ schema: 1, kind: 'checkpoint', id: 'cc-new', ts: daysAgo(1, now), data: 'from a newer minor' });
  fs.appendFileSync(store.storePath(cwd), foreign + '\n' + newKind + '\nthis is damage\n');
  assert.strictEqual(store.compact(cwd, { days: 90, now }).action, 'compacted');
  const lines = fs.readFileSync(store.storePath(cwd), 'utf8').split('\n');
  assert.ok(lines.includes(foreign), 'another schema version is not ours to delete');
  assert.ok(lines.includes(newKind), 'a kind a newer SigMap added is kept');
  assert.ok(!lines.includes('this is damage'), 'only lines that are not JSON at all are dropped');
  const r = store.readSessions(cwd);
  assert.strictEqual(r.unsupported, 2, 'both still counted as unsupported, not lost');
  assert.strictEqual(r.corrupt, 0);
});

test('the fold does not depend on line order (branch, end reason, agent: latest timestamp wins)', () => {
  const evs = [
    { kind: 'start', id: 'cc-1', ts: '2026-10-01T10:00:00.000Z', agent: 'claude-code', branch: 'first' },
    { kind: 'start', id: 'cc-1', ts: '2026-10-01T12:00:00.000Z', agent: 'claude-code', branch: 'second' },
    { kind: 'end', id: 'cc-1', ts: '2026-10-01T11:00:00.000Z', reason: 'early' },
    { kind: 'end', id: 'cc-1', ts: '2026-10-01T13:00:00.000Z', reason: 'late' },
    { kind: 'usage', id: 'cc-1', ts: '2026-10-01T13:00:00.000Z', source: 'transcript', model: 'm', offset: 5, usage: U(1, 2, 3, 4) },
    { kind: 'usage', id: 'cc-1', ts: 'not a time', source: 'transcript', model: 'other', offset: 5, usage: U(1, 2, 3, 4) },
    { kind: 'query', id: 'cc-1', ts: '2026-10-01T10:30:00.000Z', qh: 'aaaaaaaaaaaa', files: ['a'] },
  ];
  const key = (list) => { const s = store.foldSessions(list).sessions[0]; const { events, ...rest } = s; return JSON.stringify(rest); };
  const want = key(evs);
  let seed = 7;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  for (let i = 0; i < 300; i++) {
    const shuffled = evs.slice();
    for (let j = shuffled.length - 1; j > 0; j--) { const k = Math.floor(rnd() * (j + 1)); [shuffled[j], shuffled[k]] = [shuffled[k], shuffled[j]]; }
    assert.strictEqual(key(shuffled), want, 'a shuffle changed the fold');
  }
  const s = store.foldSessions(evs).sessions[0];
  assert.strictEqual(s.branch, 'second');
  assert.strictEqual(s.endReason, 'late');
  assert.strictEqual(s.endedAt, '2026-10-01T13:00:00.000Z');
  assert.strictEqual(s.model, 'm', 'a usage event with a real timestamp beats a tie with a bad one');
});

test('strings from the file are stripped of control characters and capped', () => {
  assert.strictEqual(store.cleanStr('a\u001b[2Jb\nc d   e', 20), 'a [2Jb c d e');
  assert.strictEqual(store.cleanStr('x'.repeat(500), 10), 'x'.repeat(10));
  assert.strictEqual(store.cleanStr('   \n\t ', 10), null);
  assert.strictEqual(store.cleanStr(42, 10), null);
  assert.strictEqual(store.cleanIso('2026-10-01T10:00:00.000Z'), '2026-10-01T10:00:00.000Z');
  for (const bad of ['\u001b[2J2026-10-01T10:00:00Z', '2026-10-01', 'yesterday', '2026-13-45T99:99:99Z', 'x'.repeat(50), 5, null]) {
    assert.strictEqual(store.cleanIso(bad), null, `rejected ${JSON.stringify(bad)}`);
  }
  const s = store.foldSessions([
    { kind: 'start', id: 'cc-1', ts: '2026-10-01T10:00:00.000Z', agent: 'claude-code\u001b[31m', branch: 'feat/x\nINJECT', startSource: 'a'.repeat(99) },
    { kind: 'usage', id: 'cc-1', source: 'transcript', model: 'm\u001b[2J\n## SYSTEM: x --> y', offset: 1, usage: U(1, 1, 1, 1),
      models: JSON.parse('{"__proto__":{"in":1},"ok\\nname":{"in":2}}') },
    { kind: 'end', id: 'cc-1', ts: '2026-10-01T11:00:00.000Z', reason: 'bye\u0007' },
  ]).sessions[0];
  for (const v of [s.agent, s.branch, s.startSource, s.model, s.endReason, ...Object.keys(s.models)]) {
    assert.ok(!/[\u0000-\u001f\u007f-\u009f]/.test(v), `control character left in ${JSON.stringify(v)}`);
  }
  assert.strictEqual(s.startSource.length, 20);
  assert.ok(!('polluted' in {}), 'no prototype pollution');
  assert.deepStrictEqual(Object.keys(s.models).sort(), ['__proto__', 'ok name'], 'a __proto__ key is just a key');
  assert.strictEqual(Object.getPrototypeOf(s.models), null);
});

test('a cache category nobody reported is null, never 0, and sums stay floors', () => {
  const { totalsByProvenance, formatUsage } = require(path.join(ROOT, 'src', 'session', 'render'));
  const { sessions } = store.foldSessions([
    { kind: 'usage', id: 'aider-1', source: 'agent-reported', offset: 0, usage: { in: 10, out: 5, cacheRead: null, cacheWrite: null } },
    { kind: 'usage', id: 'aider-2', source: 'agent-reported', offset: 0, usage: { in: 1, out: 1, cacheRead: 7, cacheWrite: null } },
  ]);
  assert.deepStrictEqual(sessions[0].usage, { in: 10, out: 5, cacheRead: null, cacheWrite: null }, 'null is kept, not zero-filled');
  assert.strictEqual(formatUsage(sessions[0].usage), 'in 10 · out 5 · cache read n/a · cache write n/a');
  const t = totalsByProvenance(sessions)['agent-reported'];
  assert.deepStrictEqual(t.usage, { in: 11, out: 6, cacheRead: 7, cacheWrite: null });
  assert.deepStrictEqual(t.unreported, ['cacheRead', 'cacheWrite']);
  assert.strictEqual(formatUsage(t.usage, t.unreported), 'in 11 · out 6 · cache read ≥7 · cache write n/a', 'a partial sum is a floor, an all-unreported one is n/a');
  // 'in' and 'out' are never optional: a usage object without them is not usage.
  assert.strictEqual(store.foldSessions([{ kind: 'usage', id: 'x-1', source: 'agent-reported', offset: 0, usage: { in: null, out: 1, cacheRead: 0, cacheWrite: 0 } }]).sessions[0].usage, null);
  // Rollups keep the same honesty.
  const cwd = tmp();
  const now = Date.now();
  const ts = daysAgo(200, now);
  for (const [id, cr] of [['aider-1', null], ['aider-2', 7]]) {
    store.appendEvent(cwd, { kind: 'start', id, ts, agent: 'aider' });
    store.appendEvent(cwd, { kind: 'usage', id, ts, source: 'agent-reported', model: 'm', offset: 0, usage: { in: 1, out: 1, cacheRead: cr, cacheWrite: null } });
  }
  store.compact(cwd, { days: 90, now });
  const roll = store.readEvents(cwd).events.find((e) => e.kind === 'rollup');
  assert.deepStrictEqual(roll.usage, { in: 2, out: 2, cacheRead: 7, cacheWrite: null });
  assert.deepStrictEqual(roll.unreported, ['cacheRead', 'cacheWrite']);
});

Promise.all(pending).then(() => {
  console.log('');
  console.log(`[session-store.test.js] ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
});
