'use strict';

/**
 * The sessions report (#951, SI-4): `sigmap --report --sessions` and the dashboard panel.
 *
 * Tests:
 *  1.  sumClass takes one provenance class and throws on a row of another
 *  2.  perClass makes one bucket per class and never a combined one
 *  3.  guard: report.js merges usage in exactly one place
 *  4.  no blended total: the sum across classes is printed nowhere
 *  5.  a partial sum is a floor (≥), not a total
 *  6.  unknown stays unknown: no usage → unavailable, cost n/a, duration —, never 0
 *  7.  cost is an input-priced floor and every dollar figure cites the table's date
 *  8.  a model absent from the table is n/a with the reason, never $0
 *  9.  a config asOf is the date cited, and is labelled as the user's
 * 10.  a mixed-model session prices each named model and stays a floor
 * 11.  branch rollup is per branch and per class; no branch includes another's
 * 12.  SigMap savings appear once, as modeled, windowed to the sessions, never on a row
 * 13.  duration is known only for transcript-sourced sessions
 * 14.  coverage text comes from the declarations: change one, the report changes
 * 15.  guard: capability prose lives only in capabilities.js, and the renderer never cuts a line short
 * 16.  an agent with no declaration is reported as undeclared
 * 17.  --limit keeps the most recent sessions and --agent filters
 * 18.  CLI: text and --json, exit 0, generates nothing
 * 19.  dashboard: sessions and coverage panels, escaped, and an empty store says so
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const GEN = path.join(ROOT, 'gen-context.js');
const store = require(path.join(ROOT, 'src', 'session', 'store'));
const report = require(path.join(ROOT, 'src', 'session', 'report'));
const render = require(path.join(ROOT, 'src', 'session', 'render'));
const capabilities = require(path.join(ROOT, 'src', 'session', 'capabilities'));
const dashboard = require(path.join(ROOT, 'src', 'format', 'dashboard'));

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  PASS  ${name}`);
    passed++;
  } catch (err) {
    console.log(`  FAIL  ${name}: ${err.message}`);
    failed++;
  }
}

function tmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-report-'));
}

/** Seed one folded session: start, one usage event, optional end. */
function seed(cwd, o) {
  store.appendEvent(cwd, { kind: 'start', id: o.id, ts: o.start, agent: o.agent || 'claude-code', branch: o.branch });
  const ev = { kind: 'usage', id: o.id, ts: o.end || o.start, source: o.source || 'transcript', model: o.model || 'claude-sonnet-5-5', offset: o.offset || 1 };
  if (o.usage) ev.usage = o.usage;
  if (o.models) ev.models = o.models;
  store.appendEvent(cwd, ev);
  if (o.end) store.appendEvent(cwd, { kind: 'end', id: o.id, ts: o.end, reason: 'test' });
}

const T = (h, m = 0) => `2026-10-10T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00.000Z`;
const U = (i, o, cr = 0, cw = 0) => ({ in: i, out: o, cacheRead: cr, cacheWrite: cw });
const build = (cwd, opts) => report.buildReport(cwd, Object.assign({ readGain: () => [], now: Date.parse('2026-10-12T00:00:00Z') }, opts));

console.log('[session-report.test.js] sessions report (#951)');
console.log('');

test('sumClass takes one provenance class and throws on a row of another', () => {
  const rows = [
    { provenance: 'measured', usage: U(1, 1), cost: { usd: null } },
    { provenance: 'agent-reported', usage: U(2, 2), cost: { usd: null } },
  ];
  assert.throws(() => report.sumClass('measured', rows), /cannot sum a "agent-reported" session into the "measured" class/);
  assert.strictEqual(report.sumClass('measured', [rows[0]]).usage.in, 1);
});

test('perClass makes one bucket per class and never a combined one', () => {
  const rows = [
    { provenance: 'measured', usage: U(1, 1), cost: { usd: null } },
    { provenance: 'agent-reported', usage: U(2, 2), cost: { usd: null } },
    { provenance: 'measured', usage: U(4, 4), cost: { usd: null } },
  ];
  const out = report.perClass(rows);
  assert.deepStrictEqual(Object.keys(out), ['agent-reported', 'measured']);
  assert.strictEqual(out.measured.usage.in, 5);
  assert.strictEqual(out['agent-reported'].usage.in, 2);
});

test('guard: report.js merges usage in exactly one place', () => {
  const src = fs.readFileSync(path.join(ROOT, 'src', 'session', 'report.js'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const calls = src.match(/\bmergeUsage\s*\(/g) || [];
  assert.strictEqual(calls.length, 1, `mergeUsage called ${calls.length} times — only sumClass may merge`);
  // …and that one call sits inside sumClass, between its declaration and the next function.
  const body = src.slice(src.indexOf('function sumClass'), src.indexOf('function perClass'));
  assert.ok(/\bmergeUsage\s*\(/.test(body), 'the single merge is not inside sumClass');
});

test('no blended total: the sum across classes is printed nowhere', () => {
  const cwd = tmp();
  seed(cwd, { id: 'cc-a', start: T(9), end: T(10), usage: U(1111, 10) });
  seed(cwd, { id: 'cur-b', agent: 'cursor', source: 'agent-reported', start: T(11), end: T(11), usage: U(2222, 20, null, null) });
  const r = build(cwd);
  assert.deepStrictEqual(Object.keys(r.totals), ['agent-reported', 'measured']);
  const text = render.renderReport(r);
  const json = JSON.stringify(r);
  for (const blended of ['3,333', '3333']) {
    assert.ok(!text.includes(blended), `blended input total ${blended} appears in the text`);
    assert.ok(!json.includes(`:${blended}`), `blended input total ${blended} appears in the JSON`);
  }
  assert.ok(/never summed together/.test(text));
  assert.strictEqual((text.match(/^\s+\[(measured|agent-reported)\] 1 session/gm) || []).length >= 2, true);
});

test('a partial sum is a floor (≥), not a total', () => {
  const cwd = tmp();
  seed(cwd, { id: 'cur-a', agent: 'cursor', source: 'agent-reported', start: T(9), end: T(9), usage: U(10, 1, null, null) });
  seed(cwd, { id: 'cur-b', agent: 'cursor', source: 'agent-reported', start: T(10), end: T(10), usage: U(10, 1, 500, null) });
  const r = build(cwd);
  assert.deepStrictEqual(r.totals['agent-reported'].unreported, ['cacheRead', 'cacheWrite']);
  assert.ok(/cache read ≥500/.test(render.renderReport(r)), 'a sum that some contributor did not report is a floor');
});

test('unknown stays unknown: no usage → unavailable, cost n/a, duration —, never 0', () => {
  const cwd = tmp();
  seed(cwd, { id: 'ci-1', agent: 'ci', source: 'unavailable', start: T(9), end: T(9) });
  const r = build(cwd);
  const [s] = r.sessions;
  assert.strictEqual(s.usage, null);
  assert.strictEqual(s.cost.usd, null);
  assert.strictEqual(s.durationMs, null);
  const text = render.renderReport(r);
  assert.ok(/\[unavailable\] unavailable/.test(text), text);
  assert.ok(/cost n\/a/.test(text));
  assert.ok(!/\$0/.test(text), 'no zero dollar figure for a session with no usage');
  assert.ok(!/\b0s\b/.test(text), 'no zero duration');
  assert.strictEqual(r.totals.unavailable.withUsage, 0);
  assert.strictEqual(r.totals.unavailable.usage, null);
});

test("cost is an input-priced floor and every dollar figure cites the table's date", () => {
  const cwd = tmp();
  seed(cwd, { id: 'cc-a', start: T(9), end: T(10), model: 'claude-sonnet-5-5', usage: U(5000000, 9000000, 1, 1) });
  const r = build(cwd);
  assert.strictEqual(r.sessions[0].cost.usd, 10, 'only the input category is priced: 5M × $2/Mtok');
  const text = render.renderReport(r);
  const dollar = text.split('\n').filter((l) => /\$\d/.test(l) && !/^\s*cost = /.test(l));
  assert.ok(dollar.length >= 3, 'row, class total and branch total each carry a figure');
  for (const l of dollar) assert.ok(/table as of 2026-10-04/.test(l), `uncited dollar figure: ${l}`);
  assert.ok(dollar.every((l) => /≥ \$/.test(l)), 'every figure is labelled a floor');
  assert.ok(/output and cache tokens are not priced/.test(text));
});

test('a model absent from the table is n/a with the reason, never $0', () => {
  const cwd = tmp();
  seed(cwd, { id: 'cc-a', start: T(9), end: T(10), model: 'some-private-model-9', usage: U(1000, 10) });
  const r = build(cwd);
  assert.strictEqual(r.sessions[0].cost.usd, null);
  assert.ok(/some-private-model-9 is not in the pricing table/.test(r.sessions[0].cost.why));
  const text = render.renderReport(r);
  assert.ok(/n\/a \(no priced session of 1\)/.test(text), text);
  assert.ok(!/\$/.test(text.replace(/cost = input tokens × the pricing table's standard input price[^\n]*/, '')), 'no dollar figure at all');
});

test('a config asOf is the date cited, and is labelled as the user\'s', () => {
  const cwd = tmp();
  seed(cwd, { id: 'cc-a', start: T(9), end: T(10), usage: U(1000000, 1) });
  const r = build(cwd, { config: { models: { asOf: '2026-01-02' } } });
  const text = render.renderReport(r);
  assert.ok(/table as of 2026-01-02/.test(text));
  assert.ok(!/table as of 2026-10-04/.test(text));
  assert.ok(/as of 2026-01-02 \(your config\)/.test(text));
  assert.strictEqual(r.pricing.stale, true, 'the clock is injected: 2026-01-02 is more than 90 days before the test clock');
  assert.ok(/⚠ \d+ days old/.test(text));
});

test('a mixed-model session prices each named model and stays a floor', () => {
  const cwd = tmp();
  seed(cwd, {
    id: 'cc-a', start: T(9), end: T(10), model: 'mixed', usage: U(1100, 10),
    models: { 'claude-sonnet-5-5': { in: 600, out: 5, cacheRead: 0, cacheWrite: 0, messages: 2 }, 'gpt-4o': { in: 400, out: 5, cacheRead: 0, cacheWrite: 0, messages: 1 } },
  });
  const c = build(cwd).sessions[0].cost;
  assert.ok(Math.abs(c.usd - (600 * 2 + 400 * 2.5) / 1e6) < 1e-12, `usd ${c.usd}`);
  assert.strictEqual(c.pricedIn, 1000);
  assert.strictEqual(c.partial, true, '100 input tokens named no model and are unpriced');
});

test("branch rollup is per branch and per class; no branch includes another's", () => {
  const cwd = tmp();
  seed(cwd, { id: 'cc-1', start: T(8), end: T(9), branch: 'main', usage: U(1000000, 1) });
  seed(cwd, { id: 'cc-2', start: T(9), end: T(10), branch: 'main', usage: U(2000000, 1) });
  seed(cwd, { id: 'cc-3', start: T(10), end: T(11), branch: 'feat-x', usage: U(4000000, 1) });
  seed(cwd, { id: 'cur-4', agent: 'cursor', source: 'agent-reported', start: T(11), end: T(11), branch: 'feat-x', usage: U(8000000, 1, null, null) });
  seed(cwd, { id: 'cc-5', start: T(12), end: T(13), usage: U(16000000, 1) });
  const r = build(cwd);
  const by = Object.fromEntries(r.branches.map((b) => [b.branch, b]));
  assert.deepStrictEqual(Object.keys(by).sort(), ['feat-x', 'main', 'unknown']);
  assert.strictEqual(by.main.classes.measured.usage.in, 3000000);
  assert.strictEqual(by['feat-x'].classes.measured.usage.in, 4000000, 'the agent-reported 8M is not in the measured class');
  assert.strictEqual(by['feat-x'].classes['agent-reported'].usage.in, 8000000);
  assert.strictEqual(by.unknown.classes.measured.usage.in, 16000000, 'a session with no branch is its own bucket');
  assert.strictEqual(by.main.classes.measured.cost.usd, 6);
  // the branches partition the sessions: their per-class sums add up to the report's class total
  const sum = r.branches.reduce((n, b) => n + (b.classes.measured ? b.classes.measured.usage.in : 0), 0);
  assert.strictEqual(sum, r.totals.measured.usage.in);
});

test('SigMap savings appear once, as modeled, windowed to the sessions, never on a row', () => {
  const cwd = tmp();
  seed(cwd, { id: 'cc-1', start: T(9), end: T(10), usage: U(1, 1) });
  seed(cwd, { id: 'cc-2', start: T(11), end: T(12), usage: U(1, 1) });
  const gain = [
    { ts: T(8, 59), savedTokens: 99999 },      // before the earliest session: outside the window
    { ts: T(9, 30), savedTokens: 1000 },
    { ts: T(13), savedTokens: 250 },
    { ts: T(13, 5), savedTokens: -5 },         // not a saving
    { ts: 'not a date', savedTokens: 7 },
  ];
  const r = build(cwd, { readGain: () => gain });
  assert.strictEqual(r.savings.provenance, 'modeled');
  assert.strictEqual(r.savings.runs, 2);
  assert.strictEqual(r.savings.savedTokens, 1250);
  for (const s of r.sessions) assert.ok(!('savings' in s) && !('savedTokens' in s), 'savings are not attributed to a session');
  const text = render.renderReport(r);
  assert.strictEqual((text.match(/SigMap savings \[modeled\]/g) || []).length, 1);
  assert.ok(/not attributed to a session/.test(text));
  assert.strictEqual(build(cwd, { readGain: () => [] }).savings, null, 'no logged runs → no figure, not zero');
});

test('duration is known only for transcript-sourced sessions', () => {
  const cwd = tmp();
  seed(cwd, { id: 'cc-1', start: T(9), end: T(10, 30), usage: U(1, 1) });
  seed(cwd, { id: 'cur-2', agent: 'cursor', source: 'agent-reported', start: T(11), end: T(11), usage: U(1, 1, null, null) });
  const [a, b] = build(cwd).sessions;
  assert.strictEqual(a.durationMs, 90 * 60 * 1000);
  assert.strictEqual(b.durationMs, null, 'an agent-reported start is the first report, not the session start');
  assert.ok(/1h30m/.test(render.renderReport(build(cwd))));
});

test('coverage text comes from the declarations: change one, the report changes', () => {
  const cwd = tmp();
  seed(cwd, { id: 'cc-1', start: T(9), end: T(10), usage: U(1, 1) });
  const decl = capabilities.forAgent('copilot');
  const was = decl.note;
  try {
    decl.note = 'DECLARATION-CHANGED-FOR-TEST';
    const r = build(cwd);
    const row = r.coverage.find((c) => c.agent === 'copilot');
    assert.ok(row.text.includes('DECLARATION-CHANGED-FOR-TEST'));
    assert.ok(render.renderReport(r).includes('DECLARATION-CHANGED-FOR-TEST'));
    assert.ok(dashboard.generateDashboardHtml(cwd, { grade: 'A', score: 90, daysSinceRegen: 1 }).html.includes('DECLARATION-CHANGED-FOR-TEST'));
  } finally {
    decl.note = was;
  }
  const cc = build(cwd).coverage.find((c) => c.agent === 'claude-code');
  assert.strictEqual(cc.sessions, 1);
  assert.deepStrictEqual(cc.can, ['measured', 'agent-reported']);
  assert.deepStrictEqual(build(cwd).coverage.find((c) => c.agent === 'copilot').can, []);
});

test('no declared coverage line is truncated by the renderer', () => {
  const cwd = tmp();
  const text = render.renderReport(build(cwd));
  for (const d of capabilities.DECLARATIONS) {
    assert.ok(text.includes(capabilities.describe(d)), `cut short: ${capabilities.describe(d).slice(0, 60)}…`);
  }
});

test('guard: capability prose lives only in capabilities.js', () => {
  const phrases = ['exposes no usage surface', 'no session-log ingester', 'subagent transcripts are not read'];
  const where = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
  for (const p of phrases) {
    assert.ok(where('src/session/capabilities.js').includes(p), `capabilities.js must declare: ${p}`);
    for (const f of ['src/session/report.js', 'src/format/dashboard.js', 'src/mcp/handlers.js', 'src/mcp/server.js']) {
      assert.ok(!where(f).includes(p), `${f} restates a capability: ${p}`);
    }
  }
});

test('an agent with no declaration is reported as undeclared', () => {
  const cwd = tmp();
  seed(cwd, { id: 'aider-1', agent: 'aider', source: 'agent-reported', start: T(9), end: T(9), usage: U(1, 1, null, null) });
  const row = build(cwd).coverage.find((c) => c.agent === 'aider');
  assert.ok(row && /not declared/.test(row.text));
  assert.strictEqual(row.sessions, 1);
});

test('--limit keeps the most recent sessions and --agent filters', () => {
  const cwd = tmp();
  for (let i = 0; i < 5; i++) seed(cwd, { id: `cc-${i}`, start: T(8 + i), end: T(8 + i, 30), usage: U(i + 1, 1) });
  seed(cwd, { id: 'cur-x', agent: 'cursor', source: 'agent-reported', start: T(14), end: T(14), usage: U(9, 1, null, null) });
  const r = build(cwd, { limit: 2 });
  assert.deepStrictEqual(r.sessions.map((s) => s.id), ['cc-4', 'cur-x']);
  assert.deepStrictEqual(build(cwd, { agent: 'cursor' }).sessions.map((s) => s.id), ['cur-x']);
});

test('CLI: text and --json, exit 0, generates nothing', () => {
  const cwd = tmp();
  seed(cwd, { id: 'cc-1', start: T(9), end: T(10), branch: 'main', usage: U(1000, 10) });
  seed(cwd, { id: 'cur-2', agent: 'cursor', source: 'agent-reported', start: T(11), end: T(11), branch: 'main', usage: U(50, 5, null, null) });
  const run = (...a) => spawnSync('node', [GEN, ...a], { cwd, encoding: 'utf8', timeout: 20000 });

  const t = run('--report', '--sessions');
  assert.strictEqual(t.status, 0, t.stderr);
  assert.ok(/sessions report — 2 sessions/.test(t.stdout), t.stdout);
  assert.ok(/\[measured\]/.test(t.stdout) && /\[agent-reported\]/.test(t.stdout));
  assert.ok(!fs.existsSync(path.join(cwd, '.github')) && !fs.existsSync(path.join(cwd, 'CLAUDE.md')), 'the report generates no context files');

  const j = run('--report', '--sessions', '--json');
  assert.strictEqual(j.status, 0, j.stderr);
  const data = JSON.parse(j.stdout);
  for (const k of ['sessions', 'totals', 'branches', 'savings', 'coverage', 'pricing', 'notes']) assert.ok(k in data, `missing ${k}`);
  assert.strictEqual(data.sessions.length, 2);

  const one = JSON.parse(run('--report', '--sessions', '--json', '--agent', 'cursor').stdout);
  assert.deepStrictEqual(one.sessions.map((s) => s.id), ['cur-2']);
  const lim = JSON.parse(run('--report', '--sessions', '--json', '--limit', '1').stdout);
  assert.strictEqual(lim.sessions.length, 1);
});

test('dashboard: sessions and coverage panels, escaped, and an empty store says so', () => {
  const empty = tmp();
  const e = dashboard.generateDashboardHtml(empty, { grade: 'A', score: 90, daysSinceRegen: 1 });
  assert.ok(/No sessions recorded yet/.test(e.html));
  assert.ok(/Capture coverage/.test(e.html), 'coverage is shown even with no sessions');
  assert.ok(e.data.sessionsPanel.includes('No sessions recorded yet'));
  assert.ok(!/\$\d|\b0 tokens\b/.test(e.data.sessionsPanel), 'no figures at all for an empty store');

  const cwd = tmp();
  seed(cwd, { id: 'cc-1', start: T(9), end: T(10), branch: '<script>alert(1)</script>', usage: U(1000, 10) });
  const h = dashboard.generateDashboardHtml(cwd, { grade: 'A', score: 90, daysSinceRegen: 1 }).html;
  assert.ok(!h.includes('<script>alert(1)'), 'a branch name from the store must not reach the page raw');
  assert.ok(h.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.ok(/\[measured\]|measured/.test(h) && /table as of 2026-10-04/.test(h));
});

console.log('');
console.log(`[session-report.test.js] ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
