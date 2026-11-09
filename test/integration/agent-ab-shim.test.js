'use strict';

/**
 * The compat shim for running the agent A/B through an Anthropic-compatible
 * relay (scripts/agent-ab-compat-shim.mjs). Offline: a fake upstream on a
 * loopback port records exactly what the shim forwards. No relay, no model.
 */

const assert = require('assert');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const SHIM = path.join(ROOT, 'scripts', 'agent-ab-compat-shim.mjs');

let passed = 0;
let failed = 0;
async function test(name, fn) {
  try { await fn(); console.log(`  PASS  ${name}`); passed++; }
  catch (err) { console.log(`  FAIL  ${name}\n        ${err.message}`); failed++; }
}

/** A fake upstream. `handler(req, body, res)` answers; every request is recorded. */
function fakeUpstream(handler) {
  const seen = [];
  const server = http.createServer((req, res) => {
    const chunks = [];
    req.on('data', (d) => chunks.push(d));
    req.on('end', () => {
      const body = Buffer.concat(chunks);
      seen.push({ method: req.method, url: req.url, headers: req.headers, body });
      handler(req, body, res);
    });
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ server, seen, port: server.address().port })));
}

/** One request to the shim, resolving with the status, headers and raw body. */
function call(port, { method = 'POST', url = '/v1/messages?beta=true', headers = {}, body = null }) {
  return new Promise((resolve, reject) => {
    const data = body === null ? null : Buffer.isBuffer(body) ? body : Buffer.from(typeof body === 'string' ? body : JSON.stringify(body));
    const req = http.request({ host: '127.0.0.1', port, method, path: url, headers: Object.assign({ 'content-type': 'application/json' }, headers) }, (res) => {
      const chunks = [];
      res.on('data', (d) => chunks.push(d));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

const okJson = (_req, _body, res) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end('{"ok":true}'); };

(async () => {
  const { createShim } = await import('../../scripts/agent-ab-compat-shim.mjs');

  async function withShim(opts, upstreamHandler, fn) {
    const up = await fakeUpstream(upstreamHandler);
    const shim = createShim(Object.assign({ upstream: `http://127.0.0.1:${up.port}`, port: 0 }, opts));
    const port = await shim.listen();
    try { await fn({ port, up, shim }); }
    finally { await shim.close(); await new Promise((r) => { up.server.close(() => r()); up.server.closeAllConnections(); }); }
  }

  await test('it drops messages with empty content, and only those, and counts what it dropped', async () => {
    await withShim({}, okJson, async ({ port, up, shim }) => {
      const sent = {
        model: 'm', max_tokens: 100, stream: true, tools: [{ name: 't' }], metadata: { a: 1 },
        messages: [
          { role: 'user', content: [{ type: 'text', text: 'hello' }] },
          { role: 'system', content: [] },
          { role: 'assistant', content: '' },
          { role: 'user', content: '   ' },
          { role: 'user', content: null },
          { role: 'user' },
          { role: 'user', content: 'kept' },
        ],
      };
      const r = await call(port, { body: sent });
      assert.strictEqual(r.status, 200);
      const got = JSON.parse(up.seen[0].body.toString());
      assert.deepStrictEqual(got.messages, [sent.messages[0], sent.messages[6]]);
      const { messages: _a, ...restSent } = sent; const { messages: _b, ...restGot } = got;
      assert.deepStrictEqual(restGot, restSent, 'every other field is untouched');
      assert.deepStrictEqual([shim.stats.messagePosts, shim.stats.modified, shim.stats.droppedEmptyMessages], [1, 1, 5]);
      assert.deepStrictEqual(shim.stats.droppedByRole, { system: 1, assistant: 1, user: 3 });
    });
  });

  await test('a request with nothing to drop is forwarded byte for byte', async () => {
    await withShim({}, okJson, async ({ port, up, shim }) => {
      const raw = '{ "model":"m",  "messages":[{"role":"user","content":"hi"}] , "x": 1}';
      await call(port, { body: raw });
      assert.strictEqual(up.seen[0].body.toString(), raw, 'not re-serialised when unchanged');
      assert.strictEqual(shim.stats.modified, 0);
    });
  });

  await test('non-JSON bodies and other paths pass through untouched', async () => {
    await withShim({}, okJson, async ({ port, up, shim }) => {
      await call(port, { body: 'not json at all {{' });
      await call(port, { url: '/v1/models', method: 'GET' });
      await call(port, { url: '/v1/messages/count_tokens', body: { messages: [{ role: 'system', content: [] }] } });
      assert.strictEqual(up.seen[0].body.toString(), 'not json at all {{');
      assert.strictEqual(up.seen[1].url, '/v1/models');
      assert.deepStrictEqual(JSON.parse(up.seen[2].body.toString()).messages, [{ role: 'system', content: [] }], 'only POST /v1/messages is edited');
      assert.strictEqual(shim.stats.droppedEmptyMessages, 0);
      assert.strictEqual(shim.stats.messagePosts, 1);
    });
  });

  await test('path, query, method and headers reach the upstream; host is the upstream\'s; length is recomputed', async () => {
    await withShim({}, okJson, async ({ port, up }) => {
      await call(port, { url: '/v1/messages?beta=true', headers: { 'x-api-key': 'k-123', 'anthropic-version': '2023-06-01', 'anthropic-beta': 'b1' }, body: { messages: [{ role: 'system', content: [] }, { role: 'user', content: 'x' }] } });
      const s = up.seen[0];
      assert.strictEqual(s.url, '/v1/messages?beta=true');
      assert.strictEqual(s.headers['x-api-key'], 'k-123');
      assert.strictEqual(s.headers['anthropic-version'], '2023-06-01');
      assert.strictEqual(s.headers['anthropic-beta'], 'b1');
      assert.strictEqual(s.headers.host, `127.0.0.1:${up.port}`);
      assert.strictEqual(Number(s.headers['content-length']), s.body.length, 'the length matches the edited body');
    });
  });

  await test('an upstream path prefix is kept', async () => {
    const up = await fakeUpstream(okJson);
    const shim = createShim({ upstream: `http://127.0.0.1:${up.port}/anthropic/`, port: 0 });
    const port = await shim.listen();
    try {
      await call(port, { body: { messages: [{ role: 'user', content: 'x' }] } });
      assert.strictEqual(up.seen[0].url, '/anthropic/v1/messages?beta=true');
    } finally { await shim.close(); up.server.close(); up.server.closeAllConnections(); }
  });

  await test('an upstream error is relayed unchanged and recorded without any header', async () => {
    const err = '{"type":"error","error":{"type":"permission_error","message":"Model requires Plus tier"}}';
    await withShim({}, (_q, _b, res) => { res.writeHead(403, { 'content-type': 'application/json' }); res.end(err); }, async ({ port, shim }) => {
      const r = await call(port, { headers: { 'x-api-key': 'SECRET-KEY-VALUE' }, body: { messages: [{ role: 'user', content: 'x' }] } });
      assert.strictEqual(r.status, 403);
      assert.strictEqual(r.body.toString(), err);
      assert.deepStrictEqual(shim.stats.upstreamStatus, { 403: 1 });
      assert.deepStrictEqual(shim.stats.errors, [{ status: 403, path: '/v1/messages', body: err }]);
      assert.ok(!JSON.stringify(shim.stats).includes('SECRET-KEY-VALUE'), 'the key is nowhere in what the shim records');
    });
  });

  await test('a server-sent-events stream arrives complete and in order', async () => {
    const events = ['message_start', 'content_block_delta', 'message_stop'].map((t, i) => `event: ${t}\ndata: {"type":"${t}","i":${i}}\n\n`);
    await withShim({}, (_q, _b, res) => {
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      let i = 0;
      const tick = () => { if (i < events.length) { res.write(events[i++]); setTimeout(tick, 15); } else res.end(); };
      tick();
    }, async ({ port }) => {
      const r = await call(port, { body: { stream: true, messages: [{ role: 'user', content: 'x' }] } });
      assert.strictEqual(r.headers['content-type'], 'text/event-stream');
      assert.strictEqual(r.body.toString(), events.join(''));
    });
  });

  await test('--max-tokens lowers a larger max_tokens and only when asked', async () => {
    await withShim({ maxTokens: 64000 }, okJson, async ({ port, up, shim }) => {
      await call(port, { body: { max_tokens: 128000, messages: [{ role: 'user', content: 'x' }] } });
      await call(port, { body: { max_tokens: 3072, messages: [{ role: 'user', content: 'x' }] } });
      assert.deepStrictEqual(up.seen.map((s) => JSON.parse(s.body.toString()).max_tokens), [64000, 3072]);
      assert.strictEqual(shim.stats.clampedMaxTokens, 1);
    });
    await withShim({}, okJson, async ({ port, up }) => {
      await call(port, { body: { max_tokens: 128000, messages: [{ role: 'user', content: 'x' }] } });
      assert.strictEqual(JSON.parse(up.seen[0].body.toString()).max_tokens, 128000, 'off by default');
    });
  });

  await test('an unreachable upstream is a 502 in Anthropic\'s error shape, and is recorded', async () => {
    const shim = createShim({ upstream: 'http://127.0.0.1:9', port: 0 });
    const port = await shim.listen();
    try {
      const r = await call(port, { body: { messages: [{ role: 'user', content: 'x' }] } });
      assert.strictEqual(r.status, 502);
      const j = JSON.parse(r.body.toString());
      assert.strictEqual(j.type, 'error');
      assert.strictEqual(j.error.type, 'api_error');
      assert.strictEqual(shim.stats.errors[0].status, 0);
    } finally { await shim.close(); }
  });

  await test('it listens on loopback only, and the stats file is written', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'shim-'));
    const statsFile = path.join(dir, 'stats.json');
    try {
      await withShim({ statsFile }, okJson, async ({ port, shim }) => {
        assert.strictEqual(shim.server.address().address, '127.0.0.1');
        await call(port, { body: { messages: [{ role: 'system', content: [] }, { role: 'user', content: 'x' }] } });
        await new Promise((r) => setTimeout(r, 50));
      });
      const s = JSON.parse(fs.readFileSync(statsFile, 'utf8'));
      assert.strictEqual(s.droppedEmptyMessages, 1);
      assert.match(s.upstream, /^http:\/\/127\.0\.0\.1:\d+$/);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });

  await test('createShim refuses an upstream that is not an http(s) URL', () => {
    assert.throws(() => createShim({ upstream: 'ftp://x' }), /http\(s\) URL/);
    assert.throws(() => createShim({ upstream: 'not a url' }));
  });

  await test('the CLI needs --upstream, rejects unknown flags and a flag with no value', () => {
    const run = (args) => spawnSync(process.execPath, [SHIM, ...args], { encoding: 'utf8', timeout: 20000 });
    let r = run([]);
    assert.strictEqual(r.status, 2); assert.match(r.stderr, /--upstream <url> is required/);
    r = run(['--upstream', 'https://x.example', '--nope']);
    assert.strictEqual(r.status, 2); assert.match(r.stderr, /unknown flag --nope/);
    r = run(['--upstream']);
    assert.strictEqual(r.status, 2); assert.match(r.stderr, /--upstream needs a value/);
    r = run(['--upstream', 'https://x.example', '--port', '0']);
    assert.strictEqual(r.status, 2); assert.match(r.stderr, /--port must be a positive integer/);
  });

  await test('the shim never spawns through a shell and stays out of the package and CI', () => {
    const src = fs.readFileSync(SHIM, 'utf8').split('\n').filter((l) => !/^\s*(\*|\/\/)/.test(l)).join('\n');
    assert.ok(!/\bexecSync\b|shell:\s*true|\bexec\(|child_process/.test(src), 'no process spawning at all');
    const pkg = require(path.join(ROOT, 'package.json'));
    assert.ok(!pkg.files.some((f) => f.startsWith('scripts')), 'scripts are not in the tarball');
    const wf = path.join(ROOT, '.github', 'workflows');
    for (const w of fs.existsSync(wf) ? fs.readdirSync(wf) : []) {
      assert.ok(!/agent-ab-compat-shim/.test(fs.readFileSync(path.join(wf, w), 'utf8')), `${w} runs the shim`);
    }
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})();
