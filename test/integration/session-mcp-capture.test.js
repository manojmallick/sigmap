'use strict';

/**
 * MCP session capture (#951, SI-2b): the `log_session_usage` tool.
 *
 * Drives the real `gen-context.js --mcp` over stdio, the way an MCP client does.
 *
 * Tests:
 *  1.  default: not in tools/list (still 22 tools), and tools/call is refused
 *  2.  refused calls write nothing to the store
 *  3.  session.mcpCapture: true lists it (23) with a usage schema that requires in/out
 *  4.  a call records an agent-reported session, named for the client
 *  5.  a later report for the same session replaces the earlier one
 *  6.  an omitted cache category is n/a (null), never 0
 *  7.  missing or invalid usage is recorded unavailable — with the reason, never as numbers
 *  8.  an unavailable report never replaces a usable one
 *  9.  no id: one agent-prefixed id per connection; two connections never share one
 * 10.  an explicit id is honoured, prefixed, and cleaned of path characters
 * 11.  a measured transcript record of the same id outranks a self-report
 * 12.  the tool is not in the shipped TOOLS array (the opt-in is structural)
 * 13.  a client name that matches no declaration still gets a usable agent
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const GEN = path.join(ROOT, 'gen-context.js');
const store = require(path.join(ROOT, 'src', 'session', 'store'));

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

function project(config) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-mcpcap-'));
  if (config) fs.writeFileSync(path.join(dir, 'gen-context.config.json'), JSON.stringify(config));
  return dir;
}

const ON = { session: { mcpCapture: true } };

/** One MCP connection: initialize (as `client`), then each request in order. Returns parsed responses. */
function connect(cwd, client, calls) {
  const msgs = [{ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', clientInfo: { name: client, version: '1' } } }];
  calls.forEach((c, i) => msgs.push(Object.assign({ jsonrpc: '2.0', id: i + 2 }, c)));
  const r = spawnSync('node', [GEN, '--mcp'], { cwd, input: msgs.map((m) => JSON.stringify(m)).join('\n') + '\n', encoding: 'utf8', timeout: 20000 });
  assert.strictEqual(r.status, 0, `server exited ${r.status}: ${r.stderr}`);
  return r.stdout.split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l)).slice(1);
}

const log = (args) => ({ method: 'tools/call', params: { name: 'log_session_usage', arguments: args } });
const text = (res) => res.result.content[0].text;
const sessions = (cwd) => store.readSessions(cwd).sessions;

console.log('[session-mcp-capture.test.js] log_session_usage MCP tool (#951)');
console.log('');

test('default: not in tools/list (still 22 tools), and tools/call is refused', () => {
  const cwd = project();
  const [list, call] = connect(cwd, 'cursor', [{ method: 'tools/list' }, log({ usage: { in: 10, out: 2 } })]);
  assert.strictEqual(list.result.tools.length, 22);
  assert.ok(!list.result.tools.some((t) => t.name === 'log_session_usage'));
  assert.ok(call.error, 'an unlisted tool must not answer');
  assert.strictEqual(call.error.code, -32601);
});

test('refused calls write nothing to the store', () => {
  const cwd = project();
  connect(cwd, 'cursor', [log({ usage: { in: 10, out: 2 } })]);
  assert.ok(!fs.existsSync(store.storePath(cwd)), 'no store file was created');
});

test('session.mcpCapture: true lists it (23) with a usage schema that requires in/out', () => {
  const cwd = project(ON);
  const [list] = connect(cwd, 'cursor', [{ method: 'tools/list' }]);
  assert.strictEqual(list.result.tools.length, 23);
  const t = list.result.tools.find((x) => x.name === 'log_session_usage');
  assert.ok(t, 'listed once enabled');
  assert.deepStrictEqual(t.inputSchema.properties.usage.required, ['in', 'out']);
  assert.ok(!t.inputSchema.required.includes('usage'), 'usage is optional: omitting it records unavailable');
});

test('a call records an agent-reported session, named for the client', () => {
  const cwd = project(ON);
  const [res] = connect(cwd, 'cursor', [log({ model: 'claude-sonnet-5-5', usage: { in: 1000, out: 200, cacheRead: 40, cacheWrite: 5 } })]);
  assert.ok(/\[agent-reported\]/.test(text(res)), text(res));
  const [s] = sessions(cwd);
  assert.strictEqual(s.agent, 'cursor');
  assert.strictEqual(s.source, 'agent-reported');
  assert.strictEqual(s.provenance, 'agent-reported');
  assert.strictEqual(s.model, 'claude-sonnet-5-5');
  assert.deepStrictEqual(s.usage, { in: 1000, out: 200, cacheRead: 40, cacheWrite: 5 });
  assert.ok(s.id.startsWith('cur-'), s.id);
});

test('a later report for the same session replaces the earlier one', () => {
  const cwd = project(ON);
  connect(cwd, 'cursor', [log({ usage: { in: 1000, out: 200 } }), log({ usage: { in: 5000, out: 900, cacheRead: 40000 } })]);
  const all = sessions(cwd);
  assert.strictEqual(all.length, 1, 'one connection is one session');
  assert.deepStrictEqual(all[0].usage, { in: 5000, out: 900, cacheRead: 40000, cacheWrite: null });
});

test('an omitted cache category is n/a (null), never 0', () => {
  const cwd = project(ON);
  connect(cwd, 'windsurf', [log({ usage: { in: 7, out: 3 } })]);
  const [s] = sessions(cwd);
  assert.strictEqual(s.usage.cacheRead, null);
  assert.strictEqual(s.usage.cacheWrite, null);
});

test('missing or invalid usage is recorded unavailable — with the reason, never as numbers', () => {
  const bad = [
    [{}, /no usage/i],
    [{ usage: 'lots' }, /must be an object/],
    [{ usage: { in: -4, out: 1 } }, /non-negative/],
    [{ usage: { in: 4 } }, /usage\.out is required/],
    [{ usage: { in: 'many', out: 1 } }, /non-negative number/],
    [{ usage: { in: 1, out: 1, cacheRead: -5 } }, /usage\.cacheRead must be a non-negative number/],
  ];
  for (const [args, re] of bad) {
    const cwd = project(ON);
    const [res] = connect(cwd, 'cursor', [log(args)]);
    assert.ok(re.test(text(res)), `${JSON.stringify(args)} -> ${text(res)}`);
    const [s] = sessions(cwd);
    assert.strictEqual(s.source, 'unavailable', JSON.stringify(args));
    assert.strictEqual(s.usage, null, `${JSON.stringify(args)} must not invent usage`);
  }
});

test('an unavailable report never replaces a usable one', () => {
  const cwd = project(ON);
  const [, second] = connect(cwd, 'cursor', [log({ usage: { in: 100, out: 10 } }), log({ usage: { in: -1, out: 1 } })]);
  assert.ok(/unavailable/.test(text(second)), 'the agent is told why');
  const [s] = sessions(cwd);
  assert.deepStrictEqual(s.usage, { in: 100, out: 10, cacheRead: null, cacheWrite: null });
  assert.strictEqual(s.source, 'agent-reported');
});

test('no id: one agent-prefixed id per connection; two connections never share one', () => {
  const cwd = project(ON);
  connect(cwd, 'cursor', [log({ usage: { in: 1, out: 1 } }), log({ usage: { in: 2, out: 2 } })]);
  connect(cwd, 'cursor', [log({ usage: { in: 3, out: 3 } })]);
  const ids = sessions(cwd).map((s) => s.id);
  assert.strictEqual(ids.length, 2, `two connections, two sessions: ${ids}`);
  assert.notStrictEqual(ids[0], ids[1]);
  for (const id of ids) assert.ok(/^cur-mcp-[0-9a-f]{12}$/.test(id), id);
});

test('an explicit id is honoured, prefixed, and cleaned of path characters', () => {
  const cwd = project(ON);
  connect(cwd, 'cursor', [log({ id: 'task-42', usage: { in: 1, out: 1 } }), log({ id: '../../etc/x', usage: { in: 1, out: 1 } })]);
  const ids = sessions(cwd).map((s) => s.id).sort();
  assert.deepStrictEqual(ids, ['cur-....etcx', 'cur-task-42'].sort());
  assert.ok(ids.every((i) => !i.includes('/')));
});

test('a measured transcript record of the same id outranks a self-report', () => {
  const cwd = project(ON);
  connect(cwd, 'claude-code', [log({ id: 'abc', usage: { in: 1, out: 1 } })]);
  const id = store.sessionId('claude-code', 'abc');
  store.appendEvent(cwd, { kind: 'usage', id, source: 'transcript', model: 'claude-opus-5-5', offset: 500, usage: { in: 900, out: 90, cacheRead: 9, cacheWrite: 0 } });
  const [s] = sessions(cwd);
  assert.strictEqual(s.source, 'transcript');
  assert.strictEqual(s.provenance, 'measured');
  assert.strictEqual(s.usage.in, 900);
});

test('the tool is not in the shipped TOOLS array (the opt-in is structural)', () => {
  const tools = require(path.join(ROOT, 'src', 'mcp', 'tools'));
  assert.ok(!tools.TOOLS.some((t) => t.name === 'log_session_usage'));
  assert.strictEqual(tools.LOG_SESSION_USAGE.name, 'log_session_usage');
  assert.strictEqual(tools.TOOLS.length, 22);
});

test('a client name that matches no declaration still gets a usable agent', () => {
  const cwd = project(ON);
  connect(cwd, 'Visual Studio Code', [log({ usage: { in: 1, out: 1 } })]);
  const [s] = sessions(cwd);
  assert.ok(s.agent && s.agent !== 'unknown', `agent: ${s.agent}`);
  assert.ok(/^visualst-mcp-/.test(s.id), s.id);
});

console.log('');
console.log(`[session-mcp-capture.test.js] ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
