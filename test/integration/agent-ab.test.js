'use strict';

/**
 * Agent-level A/B harness (#955, closes #812).
 *
 * Offline end to end: a stub runner for the method, a throwaway git repo for arm
 * preparation, and a fake `claude` executable for the CLI. No model is called.
 *
 * The stream-json fixtures are synthetic — built from the agent's documented
 * event schema — so they pin what the parser does with that shape, not that the
 * shape is the live one. A live run is the only check of that; the parser fails
 * loudly (no `result` event = a failed run, no init = an integrity error) rather
 * than guess.
 */

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync, execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const CLI = path.join(ROOT, 'scripts', 'run-agent-ab.mjs');

let passed = 0;
let failed = 0;
async function test(name, fn) {
  try { await fn(); console.log(`  PASS  ${name}`); passed++; }
  catch (err) { console.log(`  FAIL  ${name}\n        ${err.message}`); failed++; }
}

const tmpDirs = [];
const mktmp = (p) => { const d = fs.mkdtempSync(path.join(os.tmpdir(), p)); tmpDirs.push(d); return d; };

function git(dir, args) {
  return execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', '-C', dir, ...args], { encoding: 'utf8' }).trim();
}

/** A throwaway data root: a manifest, a task file and pinned git "clones". */
function makeDataRoot(repos) {
  const root = mktmp('ab-data-');
  fs.mkdirSync(path.join(root, 'benchmarks', 'tasks'), { recursive: true });
  const manifest = { _comment: 'test', repos: [] };
  const tasks = [];
  for (const r of repos) {
    const dir = path.join(root, 'benchmarks', 'repos', r.name);
    fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'src', 'alpha.js'), 'function alphaThing(a) { return a; }\nmodule.exports = { alphaThing };\n');
    fs.writeFileSync(path.join(dir, 'src', 'beta.js'), 'function betaThing(b) { return b; }\nmodule.exports = { betaThing };\n');
    fs.writeFileSync(path.join(dir, 'README.md'), '# fixture\n');
    execFileSync('git', ['init', '-q', dir]);
    git(dir, ['add', '-A']);
    git(dir, ['commit', '-q', '-m', 'pin']);
    manifest.repos.push({ name: r.name, url: 'https://github.com/o/r.git', commit: git(dir, ['rev-parse', 'HEAD']), language: 'javascript', layout: 'flat' });
    for (const t of r.tasks) tasks.push({ id: t.id, split: 'hard', source: 'labelled', repo: r.name, query: t.query, expected_files: t.expected });
  }
  fs.writeFileSync(path.join(root, 'benchmarks', 'xrepo-repos.json'), JSON.stringify(manifest, null, 2));
  fs.writeFileSync(path.join(root, 'benchmarks', 'tasks', 'retrieval-xrepo.jsonl'), tasks.map((t) => JSON.stringify(t)).join('\n') + '\n');
  return { root, manifest, tasks };
}

const FAKE_CLAUDE = `#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const argv = process.argv.slice(2);
if (argv.includes('--version')) { console.log('9.9.9 (Fake Claude)'); process.exit(0); }
let stdin = '';
process.stdin.on('data', (d) => { stdin += d; });
process.stdin.on('end', () => {
  const withSigmap = argv.includes('--mcp-config');
  const mode = process.env.FAKE_MODE || 'ok';
  if (process.env.FAKE_LOG) {
    fs.appendFileSync(process.env.FAKE_LOG, JSON.stringify({
      argv, cwd: process.cwd(), stdin,
      sigmapOnPath: (process.env.PATH || '').split(path.delimiter).some((d) => d && fs.existsSync(path.join(d, 'sigmap')) && d.startsWith(require('os').tmpdir())),
      claudecode: process.env.CLAUDECODE === undefined ? null : process.env.CLAUDECODE,
    }) + '\\n');
  }
  if (mode === 'hang') { setInterval(() => {}, 1000); return; }
  const out = (o) => process.stdout.write(JSON.stringify(o) + '\\n');
  const leaked = mode === 'contaminated';
  const tools = ['Read', 'Grep', 'Glob', 'Bash'].concat(withSigmap || leaked ? ['mcp__sigmap__query_context'] : []);
  out({ type: 'system', subtype: 'init', tools, model: 'claude-sonnet-5-5',
    mcp_servers: withSigmap || leaked ? [{ name: 'sigmap', status: 'connected' }] : [] });
  if (mode === 'error') {
    out({ type: 'result', subtype: 'error_during_execution', is_error: true, num_turns: 1, result: 'boom' });
    return;
  }
  const calls = withSigmap ? 2 : 5;
  for (let i = 0; i < calls; i++) {
    const msg = { type: 'assistant', message: { id: 'm' + i, model: 'claude-sonnet-5-5',
      content: [{ type: 'tool_use', id: 't' + i, name: i % 2 ? 'Bash' : 'Grep', input: { command: 'grep -rn thing .' } }],
      usage: { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } } };
    out(msg);
    out(msg); // the host repeats a message: counted once
  }
  const map = JSON.parse(process.env.FAKE_MAP || '{}');
  const repo = path.basename(process.cwd()).replace(/-(with|without)$/, '');
  const expected = map[repo] || 'src/none.js';
  out({ type: 'result', subtype: 'success', is_error: false, num_turns: calls + 1,
    result: 'It lives in \`' + process.cwd() + '/' + expected + '\`, because it defines the thing.',
    total_cost_usd: withSigmap ? 0.01 : 0.03,
    usage: { input_tokens: withSigmap ? 100 : 300, output_tokens: 20, cache_read_input_tokens: withSigmap ? 1000 : null, cache_creation_input_tokens: 0 } });
});
`;

function runCli(args, env, opts = {}) {
  return spawnSync(process.execPath, [CLI, ...args], {
    cwd: ROOT, encoding: 'utf8', timeout: opts.timeout || 120000,
    env: Object.assign({}, process.env, { ANTHROPIC_API_KEY: '', SIGMAP_XREPO_DATA: '' }, env),
  });
}

const treeHash = (dir) => {
  const h = crypto.createHash('sha256');
  const walk = (d, rel) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
      if (e.name === '.git') continue;
      const abs = path.join(d, e.name);
      const r = path.join(rel, e.name);
      if (e.isDirectory()) walk(abs, r);
      else { h.update(r); h.update(fs.readFileSync(abs)); }
    }
  };
  walk(dir, '');
  return h.digest('hex');
};

(async () => {
  const ab = await import('../../scripts/lib/agent-ab.mjs');
  const claude = await import('../../scripts/lib/agent-ab-claude.mjs');
  const arms = await import('../../scripts/lib/agent-ab-arms.mjs');
  const stats = await import('../../scripts/lib/agent-ab-stats.mjs');

  // ── questions ──────────────────────────────────────────────────────────────

  await test('selectTasks takes the first K by id per repo, in manifest order, from a filter', () => {
    const tasks = [
      { id: 'x003', repo: 'b', query: 'q', expected_files: ['b3'] }, { id: 'x001', repo: 'a', query: 'q', expected_files: ['a1'] },
      { id: 'x002', repo: 'a', query: 'q', expected_files: ['a2'] }, { id: 'x004', repo: 'b', query: 'q', expected_files: ['b4'] },
    ];
    assert.deepStrictEqual(ab.selectTasks(tasks, ['a', 'b']).map((t) => t.id), ['x001', 'x003']);
    assert.deepStrictEqual(ab.selectTasks(tasks, ['b', 'a'], { perRepo: 2 }).map((t) => t.id), ['x003', 'x004', 'x001', 'x002']);
    assert.deepStrictEqual(ab.selectTasks(tasks, ['a', 'b'], { only: ['b'] }).map((t) => t.id), ['x003']);
    assert.throws(() => ab.selectTasks(tasks, ['a'], { perRepo: 0 }), /positive integer/);
  });

  await test('selectTasks with ids picks exactly those ids in every repo and ignores the first-K rule', () => {
    const tasks = [
      { id: 'x003', repo: 'b', query: 'q', expected_files: ['b3'] }, { id: 'x001', repo: 'a', query: 'q', expected_files: ['a1'] },
      { id: 'x002', repo: 'a', query: 'q', expected_files: ['a2'] }, { id: 'x004', repo: 'b', query: 'q', expected_files: ['b4'] },
    ];
    assert.deepStrictEqual(ab.selectTasks(tasks, ['a', 'b'], { ids: ['x002', 'x003'] }).map((t) => `${t.repo}/${t.id}`), ['a/x002', 'b/x003']);
    assert.deepStrictEqual(ab.selectTasks(tasks, ['a', 'b'], { ids: ['x004'], perRepo: 1 }).map((t) => t.id), ['x004'], 'a repo\'s first task is not added');
    assert.deepStrictEqual(ab.selectTasks(tasks, ['a', 'b'], { ids: ['x002', 'x001'] }).map((t) => t.id), ['x001', 'x002'], 'id order, whatever order they were asked in');
    assert.deepStrictEqual(ab.selectTasks(tasks, ['a', 'b'], { ids: [] }).map((t) => t.id), ['x001', 'x003'], 'an empty list is no filter');
    assert.deepStrictEqual(ab.selectTasks(tasks, ['a', 'b'], { ids: ['x002'], only: ['b'] }), [], 'a repo filter still applies');
  });

  await test('the prompt carries the question and names neither the answer nor SigMap', () => {
    const p = ab.buildPrompt({ query: 'how are widgets frobbed', expected_files: ['src/secret/frob.js'] });
    assert.ok(p.includes('how are widgets frobbed'));
    assert.ok(!p.includes('src/secret/frob.js') && !/sigmap/i.test(p));
  });

  // ── scoring ────────────────────────────────────────────────────────────────

  await test('scoreAnswer is hit@5 on the paths an answer names', () => {
    const exp = ['pkg/core/real.go'];
    assert.deepStrictEqual(ab.scoreAnswer('`pkg/core/real.go` — it does the work', exp).pass, true);
    assert.strictEqual(ab.scoreAnswer('`a/1.go`\n`a/2.go`\n`a/3.go`\n`a/4.go`\n`a/5.go`\n`pkg/core/real.go`', exp).pass, false, 'the sixth path is outside the top 5');
    assert.strictEqual(ab.scoreAnswer('`a/1.go`\n`a/2.go`\n`a/3.go`\n`a/4.go`\n`pkg/core/real.go`', exp).rank, 5);
    assert.strictEqual(ab.scoreAnswer('see real.go in core', exp).pass, false, 'a bare basename is not the path');
    assert.strictEqual(ab.scoreAnswer('the answer is `src/pkg/core/real.go`', exp).pass, false, 'a longer path is another file');
  });

  await test('scoreAnswer reads absolute paths, ./ prefixes and :line anchors', () => {
    const exp = ['pkg/core/real.go'];
    assert.ok(ab.scoreAnswer('/var/tmp/ab/repo-with/pkg/core/real.go:42', exp, { cwds: ['/var/tmp/ab/repo-with'] }).pass);
    assert.ok(ab.scoreAnswer('./pkg/core/real.go', exp).pass);
    assert.ok(ab.scoreAnswer('`pkg/core/real.go:10-20`', exp).pass);
    assert.ok(ab.scoreAnswer('C:\\x\\repo\\pkg\\core\\real.go', exp, { cwds: ['C:\\x\\repo'] }).pass, 'backslashes are normalised');
  });

  await test('scoreAnswer finds an expected path with a space, at a token boundary only', () => {
    const exp = ['my dir/Real File.swift'];
    assert.ok(ab.scoreAnswer('It is `my dir/Real File.swift`.', exp).pass);
    assert.ok(!ab.scoreAnswer('It is `other/my dir/Real File.swift`.', exp).pass);
  });

  // ── statistics ─────────────────────────────────────────────────────────────

  await test('median, stdev and summarize ignore unknowns and never invent a zero', () => {
    assert.strictEqual(ab.median([3, 1, 2]), 2);
    assert.strictEqual(ab.median([4, 1, 3, 2]), 2.5);
    assert.strictEqual(ab.median([null, undefined, NaN]), null);
    assert.strictEqual(ab.summarize([]), null);
    assert.strictEqual(ab.summarize([null]), null);
    assert.deepStrictEqual(ab.summarize([5]), { n: 1, median: 5, min: 5, max: 5, stdev: 0 });
    const s = ab.summarize([2, null, 4, 6]);
    assert.strictEqual(s.n, 3);
    assert.strictEqual(s.median, 4);
    assert.ok(Math.abs(s.stdev - 2) < 1e-9);
  });

  await test('costFloor prices uncached input only and is null for an unpriced model', () => {
    assert.ok(Math.abs(ab.costFloor(1000000, 'claude-sonnet-5-5') - 2) < 1e-9);
    assert.strictEqual(ab.costFloor(1000, 'no-such-model'), null);
    assert.strictEqual(ab.costFloor(null, 'claude-sonnet-5-5'), null);
  });

  // ── arm integrity ──────────────────────────────────────────────────────────

  await test('checkIntegrity reads the run\'s own init event', () => {
    const base = ['Read', 'Grep', 'Glob', 'Bash'];
    const sig = { name: 'sigmap', status: 'connected' };
    assert.ok(ab.checkIntegrity({ tools: base, mcpServers: [] }, 'without').ok);
    assert.ok(ab.checkIntegrity({ tools: [...base, 'mcp__sigmap__query_context'], mcpServers: [sig] }, 'with').ok);
    assert.ok(!ab.checkIntegrity({ tools: [...base, 'mcp__sigmap__query_context'], mcpServers: [sig] }, 'without').ok, 'SigMap in the no-SigMap arm');
    assert.ok(!ab.checkIntegrity({ tools: base, mcpServers: [] }, 'with').ok, 'SigMap missing from its arm');
    assert.ok(!ab.checkIntegrity({ tools: [...base, 'mcp__sigmap__q'], mcpServers: [{ name: 'sigmap', status: 'failed' }] }, 'with').ok, 'server not connected');
    assert.ok(!ab.checkIntegrity({ tools: [...base, 'WebFetch'], mcpServers: [] }, 'without').ok, 'a web tool');
    assert.ok(!ab.checkIntegrity({ tools: [...base, 'mcp__other__x'], mcpServers: [{ name: 'other', status: 'connected' }] }, 'without').ok, 'a foreign MCP server');
    assert.ok(!ab.checkIntegrity(null, 'without').ok, 'no init event cannot be verified');
  });

  // ── the plan ───────────────────────────────────────────────────────────────

  const TASKS = [
    { id: 'x001', repo: 'r1', query: 'q1', expected_files: ['a.js'] },
    { id: 'x002', repo: 'r2', query: 'q2', expected_files: ['b.js'] },
  ];
  const okInit = (arm) => ({
    tools: ['Read', 'Grep', 'Glob', 'Bash', ...(arm === 'with' ? ['mcp__sigmap__query_context'] : [])],
    mcpServers: arm === 'with' ? [{ name: 'sigmap', status: 'connected' }] : [],
  });
  const stub = (over = {}) => async (job) => Object.assign({
    ok: true, error: null, answer: `\`${job.task.expected_files[0]}\``, cwds: [], init: okInit(job.arm),
    toolCalls: { total: job.arm === 'with' ? 2 : 6 }, usage: { in: job.arm === 'with' ? 100 : 300, out: 10, cacheRead: null, cacheWrite: 0 },
    cost: { usd: job.arm === 'with' ? 0.01 : 0.03, source: 'agent-reported' }, durationMs: 1000, turns: 3,
  }, over);

  await test('runPlan runs every task N times per arm, interleaved and counterbalanced, with one prompt', async () => {
    const seen = [];
    const entries = await ab.runPlan({ tasks: [TASKS[0]], runs: 4, runner: async (job) => { seen.push(job); return stub()(job); } });
    assert.strictEqual(entries.length, 8);
    const label = (j) => `${j.run}${j.arm === 'with' ? '+' : '-'}`; // '-' = without SigMap, '+' = with
    assert.deepStrictEqual(seen.map(label), ['1-', '1+', '2+', '2-', '3-', '3+', '4+', '4-']);
    assert.strictEqual(new Set(seen.map((j) => j.prompt)).size, 1, 'the arms get the byte-identical prompt');
    assert.ok(entries.every((e) => e.record.score.pass));
  });

  await test('runPlan aborts, recording nothing, when a run contradicts its arm', async () => {
    const dirty = async (job) => stub({ init: okInit('with') })(job); // the no-SigMap arm carries the sigmap server
    await assert.rejects(ab.runPlan({ tasks: TASKS, runs: 1, runner: dirty }), (e) => e instanceof ab.IntegrityError && /no-SigMap arm/.test(e.message));
  });

  await test('runPlan aborts when the arms hold different built-in tools', async () => {
    const runner = async (job) => stub({ init: { tools: job.arm === 'with' ? ['Read', 'Grep', 'mcp__sigmap__q'] : ['Read', 'Grep', 'Glob'], mcpServers: job.arm === 'with' ? [{ name: 'sigmap', status: 'connected' }] : [] } })(job);
    await assert.rejects(ab.runPlan({ tasks: TASKS, runs: 1, runner }), /different built-in tools/);
  });

  await test('runPlan stops after consecutive failed runs instead of spending on a broken setup', async () => {
    let calls = 0;
    const runner = async () => { calls++; return { ok: false, error: 'agent error: invalid key', init: null, cwds: [] }; };
    await assert.rejects(ab.runPlan({ tasks: TASKS, runs: 4, runner, maxConsecutiveFailures: 3 }), /3 consecutive failed runs.*invalid key/);
    assert.strictEqual(calls, 3);
  });

  // ── aggregation and the report ─────────────────────────────────────────────

  await test('the report is a paired median over N runs with spread, per task and per repo', async () => {
    let n = 0;
    const runner = async (job) => {
      n++;
      const calls = job.arm === 'with' ? [2, 3, 2, 9][(job.run - 1) % 4] : [7, 6, 7, 7][(job.run - 1) % 4];
      return stub({ toolCalls: { total: calls } })(job);
    };
    const entries = await ab.runPlan({ tasks: TASKS, runs: 4, runner });
    const report = ab.buildReport({ entries, tasks: TASKS, method: { agent: 'claude-code', agentVersion: '1', model: 'claude-sonnet-5-5', runs: 4, tasksPerRepo: 1, budgetUsd: 1, timeoutMs: 1000, date: '2026-10-13' } });
    assert.strictEqual(n, 16);
    const cell = report.cells.find((c) => c.task === 'x001' && c.arm === 'with');
    assert.deepStrictEqual(cell.metrics.toolCalls, { n: 4, median: 2.5, min: 2, max: 9, stdev: cell.metrics.toolCalls.stdev });
    assert.ok(cell.metrics.toolCalls.stdev > 3, 'the outlier shows as spread, not as a shifted median');
    const r1 = report.repos.find((r) => r.repo === 'r1');
    assert.deepStrictEqual([r1.metrics.toolCalls.without, r1.metrics.toolCalls.with, r1.metrics.toolCalls.medianDelta], [7, 2.5, -4.5]);
    assert.deepStrictEqual([r1.metrics.toolCalls.fewer, r1.metrics.toolCalls.ties, r1.metrics.toolCalls.more], [1, 0, 0]);
    assert.deepStrictEqual(r1.pass, { without: { pass: 4, runs: 4 }, with: { pass: 4, runs: 4 } });
    assert.strictEqual(report.method.publishable, true);
    assert.deepStrictEqual(JSON.parse(JSON.stringify(report)), JSON.parse(JSON.stringify(ab.buildReport({ entries, tasks: TASKS, method: report.method }))), 'deterministic');
  });

  await test('unknown stays unknown: an unreported usage is a shortfall in n, never a zero', async () => {
    const runner = async (job) => stub(job.run === 1 ? { usage: null, usageSource: 'unavailable', cost: { usd: null, source: 'unavailable' } } : {})(job);
    const entries = await ab.runPlan({ tasks: [TASKS[0]], runs: 4, runner });
    const cell = ab.buildReport({ entries, tasks: [TASKS[0]], method: { runs: 4 } }).cells.find((c) => c.arm === 'without');
    assert.strictEqual(cell.metrics.in.n, 3);
    assert.strictEqual(cell.metrics.in.min, 300, 'no 0 was mixed in');
    assert.strictEqual(cell.metrics.costUsd.n, 3);
    assert.strictEqual(cell.metrics.cacheRead, null, 'a category no run reported has no summary');
  });

  await test('costs of different provenance are separate series and are never blended', async () => {
    const runner = async (job) => stub({ cost: job.arm === 'with' ? { usd: 0.5, source: 'table' } : { usd: 0.4, source: 'agent-reported' } })(job);
    const entries = await ab.runPlan({ tasks: [TASKS[0]], runs: 4, runner });
    const rep = ab.buildReport({ entries, tasks: [TASKS[0]], method: { runs: 4 } });
    const without = rep.cells.find((c) => c.arm === 'without').metrics;
    const withSig = rep.cells.find((c) => c.arm === 'with').metrics;
    assert.strictEqual(without.costUsd.median, 0.4);
    assert.strictEqual(without.costFloorUsd, null);
    assert.strictEqual(withSig.costFloorUsd.median, 0.5);
    assert.strictEqual(withSig.costUsd, null);
    assert.strictEqual(rep.total.metrics.costUsd.tasks, 0, 'no paired delta across classes');
  });

  await test('a failed run is a failure with unknown usage — a timeout is never a cheap success', async () => {
    const runner = async (job) => (job.run === 1 && job.arm === 'with'
      ? { ok: false, error: 'timeout', init: null, cwds: [], usage: null, toolCalls: null, cost: { usd: null, source: 'unavailable' }, durationMs: 300000 }
      : stub()(job));
    const entries = await ab.runPlan({ tasks: [TASKS[0]], runs: 4, runner });
    const cell = ab.buildReport({ entries, tasks: [TASKS[0]], method: { runs: 4 } }).cells.find((c) => c.arm === 'with');
    assert.strictEqual(cell.completed, 3);
    assert.strictEqual(cell.pass, 3);
    assert.deepStrictEqual(cell.errors, ['timeout']);
    assert.strictEqual(cell.metrics.durationMs.n, 3, 'the timed-out run\'s wall time is not a result');
  });

  await test('fewer than the minimum runs per arm is labelled not publishable', async () => {
    const entries = await ab.runPlan({ tasks: [TASKS[0]], runs: 2, runner: stub() });
    const rep = ab.buildReport({ entries, tasks: [TASKS[0]], method: { agent: 'claude-code', agentVersion: '1', model: 'm', runs: 2, tasksPerRepo: 1, budgetUsd: 1, timeoutMs: 1000, date: '2026-10-13' } });
    assert.strictEqual(rep.method.publishable, false);
    assert.match(rep.method.notPublishableBecause[0], /2 runs per arm.*minimum is 4/);
    assert.match(ab.renderMarkdown(rep), /NOT PUBLISHABLE/);
  });

  await test('a cell that completed fewer than the minimum is not publishable, however many runs were requested (#959)', async () => {
    const meth = (runs) => ({ agent: 'claude-code', agentVersion: '1', model: 'm', runs, tasksPerRepo: 1, budgetUsd: 1, timeoutMs: 1000, date: '2026-10-13' });
    const lose = (n) => async (job) => (job.arm === 'with' && job.run <= n
      ? { ok: false, error: 'timeout', init: null, cwds: [], usage: null, toolCalls: null, cost: { usd: null, source: 'unavailable' }, durationMs: 1 }
      : stub()(job));
    const report = async (runs, lost) => ab.buildReport({
      entries: await ab.runPlan({ tasks: [TASKS[0]], runs, runner: lose(lost) }), tasks: [TASKS[0]], method: meth(runs),
    });

    // Four requested, three completed: the median rests on three, below the method's own minimum.
    const three = await report(4, 1);
    assert.strictEqual(three.method.publishable, false);
    assert.deepStrictEqual(three.method.notPublishableBecause, ['1 cell with fewer than 4 completed runs (r1/x001 with 3 of 4)']);
    assert.match(ab.renderMarkdown(three), /NOT PUBLISHABLE — 1 cell with fewer than 4 completed runs/);

    // Nothing completed: that cell keeps its own reason and is not counted twice.
    assert.deepStrictEqual((await report(4, 4)).method.notPublishableBecause, ['1 cell with no completed run']);

    // Six requested, four completed: enough, and a lost run no longer decides it.
    const six = await report(6, 2);
    assert.strictEqual(six.method.publishable, true);
    assert.deepStrictEqual(six.method.notPublishableBecause, []);

    // Too few requested says so once, not once per cell.
    assert.deepStrictEqual((await report(2, 0)).method.notPublishableBecause, ['2 runs per arm (the minimum is 4)']);

    // Many short cells: the first five are named, the rest are counted.
    const tasks = ['x001', 'x002', 'x003'].map((id) => ({ id, repo: 'r1', query: 'q', expected_files: ['a.js'] }));
    const lossy = async (job) => (job.run <= 2 // five requested, two lost: three completed
      ? { ok: false, error: 'timeout', init: null, cwds: [], usage: null, toolCalls: null, cost: { usd: null, source: 'unavailable' }, durationMs: 1 }
      : stub()(job));
    const many = ab.buildReport({
      entries: await ab.runPlan({ tasks, runs: 5, runner: lossy, maxConsecutiveFailures: 99 }), tasks, method: meth(5),
    });
    assert.strictEqual(many.method.notPublishableBecause.length, 1);
    const line = many.method.notPublishableBecause[0];
    assert.match(line, /^6 cells with fewer than 4 completed runs \(/);
    assert.strictEqual(line.split(' of 5').length - 1, 5, 'five cells named');
    assert.match(line, /, \+1 more\)$/);
  });

  await test('spend counts every run: a failed run that reported a cost is in it, and no median moves (#959)', async () => {
    const runner = async (job) => (job.arm === 'with' && job.run === 1
      ? { ok: false, error: 'agent error: error_max_turns', init: okInit('with'), cwds: [], usage: { in: 400, out: 50, cacheRead: null, cacheWrite: null }, toolCalls: null, cost: { usd: 0.07, source: 'agent-reported' }, durationMs: 9000 }
      : stub()(job));
    const entries = await ab.runPlan({ tasks: [TASKS[0]], runs: 4, runner });
    const meth = { agent: 'claude-code', agentVersion: '1', model: 'm', runs: 4, tasksPerRepo: 1, budgetUsd: 1, timeoutMs: 1000, date: '2026-10-13' };
    const rep = ab.buildReport({ entries, tasks: [TASKS[0]], method: meth });
    const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} !== ${b}`);

    const withCell = rep.cells.find((c) => c.arm === 'with');
    assert.strictEqual(withCell.metrics.costUsd.n, 3, 'the failed run is still not a sample of what a run costs');
    assert.strictEqual(withCell.metrics.costUsd.median, 0.01);
    assert.strictEqual(withCell.spend.all.runs, 4);
    assert.strictEqual(withCell.spend.all.agentReportedRuns, 4);
    near(withCell.spend.all.agentReportedUsd, 0.1);
    assert.strictEqual(withCell.spend.failed.runs, 1);
    near(withCell.spend.failed.agentReportedUsd, 0.07);

    const without = rep.cells.find((c) => c.arm === 'without');
    near(without.spend.all.agentReportedUsd, 0.12);
    assert.deepStrictEqual([without.spend.failed.runs, without.spend.failed.agentReportedUsd], [0, null]);

    near(rep.total.spend.with.all.agentReportedUsd, 0.1);
    near(rep.repos[0].spend.with.failed.agentReportedUsd, 0.07);
    const md = ab.renderMarkdown(rep);
    assert.match(md, /## Spend/);
    assert.ok(md.includes('$0.1000 (4 runs)') && md.includes('$0.0700 (1 run)'), md);
    assert.ok(!/NaN|undefined|null/.test(md));
  });

  await test('spend is one figure per provenance class and a count of unreported runs, never a blended total (#959)', async () => {
    const costs = [{ usd: 0.02, source: 'agent-reported' }, { usd: 0.5, source: 'table' }, { usd: null, source: 'unavailable' }, { usd: 0.04, source: 'agent-reported' }];
    const runner = async (job) => stub({ cost: costs[(job.run - 1) % 4] })(job);
    const entries = await ab.runPlan({ tasks: [TASKS[0]], runs: 4, runner });
    const meth = { agent: 'claude-code', agentVersion: '1', model: 'm', runs: 4, tasksPerRepo: 1, budgetUsd: 1, timeoutMs: 1000, date: '2026-10-13' };
    const rep = ab.buildReport({ entries, tasks: [TASKS[0]], method: meth });
    const s = rep.cells[0].spend.all;
    assert.deepStrictEqual([s.runs, s.agentReportedRuns, s.floorRuns, s.unknownRuns], [4, 2, 1, 1]);
    assert.ok(Math.abs(s.agentReportedUsd - 0.06) < 1e-9);
    assert.strictEqual(s.floorUsd, 0.5);
    assert.ok(!Object.keys(s).some((k) => /^total/i.test(k)), 'no field adds the classes');
    const md = ab.renderMarkdown(rep);
    assert.ok(md.includes('$0.0600 (2 runs) · ≥ $0.5000 floor (1 run) · 1 run unreported'), md);

    // Nothing reported a cost: the section is left out, like any series nobody reported.
    const blank = ab.buildReport({
      entries: await ab.runPlan({ tasks: [TASKS[0]], runs: 4, runner: async (job) => stub({ cost: { usd: null, source: 'unavailable' } })(job) }),
      tasks: [TASKS[0]], method: meth,
    });
    assert.ok(!ab.renderMarkdown(blank).includes('## Spend'));
  });

  await test('a completed run that dropped a cache figure is counted and named in the report (#959)', async () => {
    const runner = async (job) => stub({ cacheGaps: job.run === 1 ? 2 : 0 })(job);
    const entries = await ab.runPlan({ tasks: [TASKS[0]], runs: 4, runner });
    const meth = { agent: 'claude-code', agentVersion: '1', model: 'm', runs: 4, tasksPerRepo: 1, budgetUsd: 1, timeoutMs: 1000, date: '2026-10-13' };
    const rep = ab.buildReport({ entries, tasks: [TASKS[0]], method: meth });
    assert.deepStrictEqual(rep.cells.map((c) => c.cacheGapRuns), [1, 1]);
    assert.strictEqual(rep.total.cacheGapRuns, 2);
    assert.match(ab.renderMarkdown(rep), /2 completed runs dropped a cache figure because some of their messages omitted that category/);
  });

  await test('the rendered report names model, date, agent, runs, budget and caveats; unknown reads n/a', async () => {
    const runner = async (job) => stub({ usage: { in: 100, out: 10, cacheRead: null, cacheWrite: null } })(job);
    const entries = await ab.runPlan({ tasks: TASKS, runs: 4, runner });
    const rep = ab.buildReport({ entries, tasks: TASKS, method: { agent: 'claude-code', agentVersion: '9.9.9 (Fake)', model: 'claude-sonnet-5-5', runs: 4, tasksPerRepo: 1, budgetUsd: 1, timeoutMs: 300000, date: '2026-10-13' } });
    const md = ab.renderMarkdown(rep);
    for (const needle of ['claude-code 9.9.9 (Fake)', 'claude-sonnet-5-5', '2026-10-13', '4 runs per arm', '$1', '## Caveats', 'hit@5', 'Provenance: agent-reported', 'publishable']) {
      assert.ok(md.includes(needle), `missing: ${needle}`);
    }
    assert.ok(!md.includes('Cache-read tokens'), 'a series nobody reported is left out, not printed as zero');
    assert.ok(!/NaN|undefined|null/.test(md), 'no raw placeholder reaches the reader');
    assert.ok(md.includes('n/a'));
    assert.strictEqual(md, ab.renderMarkdown(rep), 'pure');
  });

  // ── the Claude Code adapter ────────────────────────────────────────────────

  await test('the two arms\' argument lists differ only by SigMap', () => {
    const base = { model: 'claude-sonnet-5-5', budgetUsd: 1 };
    const without = claude.buildArgs({ arm: 'without', ...base });
    const withSig = claude.buildArgs({ arm: 'with', ...base, sigmapContext: '## ctx', mcpConfig: '{"mcpServers":{}}' });
    const flag = (a, f) => a[a.indexOf(f) + 1];
    for (const f of ['--model', '--tools', '--permission-mode', '--max-budget-usd', '--output-format']) {
      assert.strictEqual(flag(without, f), flag(withSig, f), `${f} must not differ`);
    }
    for (const a of [without, withSig]) {
      for (const f of ['-p', '--bare', '--strict-mcp-config', '--no-session-persistence']) assert.ok(a.includes(f), `${f} missing`);
      assert.strictEqual(flag(a, '--permission-mode'), 'dontAsk');
      assert.ok(!a.includes('--dangerously-skip-permissions'));
      assert.ok(!a.some((t) => /WebFetch|WebSearch|curl|find/.test(t) && t !== '--no-session-persistence'), 'no web or exec route');
    }
    assert.ok(!without.includes('--mcp-config') && !without.includes('--append-system-prompt'));
    const allow = (a) => flag(a, '--allowedTools').split(',');
    assert.deepStrictEqual(allow(withSig).filter((t) => !allow(without).includes(t)).sort(), ['Bash(sigmap:*)', 'mcp__sigmap']);
    assert.deepStrictEqual(allow(without).filter((t) => !allow(withSig).includes(t)), []);
    assert.ok(allow(without).includes('Bash(grep:*)') && !allow(without).includes('Bash'), 'Bash only through read-only prefixes');
    assert.throws(() => claude.buildArgs({ arm: 'with', ...base }), /needs its generated context/);
  });

  await test('the prompt goes through stdin, never argv', () => {
    const args = claude.buildArgs({ arm: 'with', model: 'm', budgetUsd: 1, sigmapContext: 'C', mcpConfig: '{}' });
    assert.ok(!args.some((a) => /Question:/.test(a)));
  });

  const stream = (events) => events.map((e) => JSON.stringify(e)).join('\n') + '\n';
  const asst = (id, blocks, usage, extra = {}) => Object.assign({ type: 'assistant', message: { id, content: blocks, usage } }, extra);
  const use = (id, name, input) => ({ type: 'tool_use', id, name, input: input || {} });
  const U = (i, o, r, w) => ({ input_tokens: i, output_tokens: o, cache_read_input_tokens: r, cache_creation_input_tokens: w });

  await test('parseStream counts main-thread tool_use blocks once and reads the result event', () => {
    const p = claude.parseStream(stream([
      { type: 'system', subtype: 'init', tools: ['Read', 'Bash'], mcp_servers: [{ name: 'sigmap', status: 'connected' }], model: 'm' },
      asst('m1', [use('t1', 'Read'), use('t2', 'Bash', { command: 'grep -rn x .' })], U(10, 5, 0, 0)),
      asst('m1', [use('t1', 'Read')], U(10, 5, 0, 0)),
      asst('m2', [use('t9', 'Grep')], U(1, 1, 0, 0), { parent_tool_use_id: 'toolu_parent' }),
      asst('m3', [use('t3', 'Bash', { command: 'sigmap ask "x"' })], U(20, 5, 0, 0)),
      { type: 'result', subtype: 'success', is_error: false, num_turns: 4, result: 'ANSWER', total_cost_usd: 0.05, usage: U(500, 40, 2000, 100) },
    ]));
    assert.deepStrictEqual(p.toolCalls, { total: 3, byTool: { Read: 1, Bash: 2 }, byCommand: { grep: 1, sigmap: 1 } });
    assert.deepStrictEqual(p.usage, { in: 500, out: 40, cacheRead: 2000, cacheWrite: 100 });
    assert.strictEqual(p.usageSource, 'result');
    assert.strictEqual(p.costUsd, 0.05);
    assert.strictEqual(p.answer, 'ANSWER');
    assert.deepStrictEqual(p.init.mcpServers, [{ name: 'sigmap', status: 'connected' }]);
  });

  await test('parseStream falls back to per-message usage once per message id, and null is not zero', () => {
    const p = claude.parseStream(stream([
      asst('a', [use('t1', 'Read')], { input_tokens: 10, output_tokens: 2 }),
      asst('a', [use('t1', 'Read')], { input_tokens: 10, output_tokens: 2 }),
      asst('b', [], { input_tokens: 5, output_tokens: 1 }),
      { type: 'result', subtype: 'success', is_error: false, result: 'x' },
    ]));
    assert.deepStrictEqual(p.usage, { in: 15, out: 3, cacheRead: null, cacheWrite: null });
    assert.strictEqual(p.usageSource, 'messages');
  });

  await test('parseStream: a cache category some messages omitted is unknown, never the sum of the others (#959)', () => {
    const done = { type: 'result', subtype: 'success', is_error: false, result: 'x' };
    const p = claude.parseStream(stream([
      asst('a', [use('t1', 'Read')], U(10, 2, 7, 1)),
      asst('b', [], { input_tokens: 5, output_tokens: 1, cache_creation_input_tokens: 2 }), // omits cache read only
      asst('c', [], U(3, 1, 4, 0)),
      done,
    ]));
    assert.deepStrictEqual(p.usage, { in: 18, out: 4, cacheRead: null, cacheWrite: 3 }, 'the read total would have been 11 — a floor');
    assert.strictEqual(p.cacheGaps, 1, 'one message omitted it');
    assert.strictEqual(p.usageSource, 'messages');

    // The same for the write side, with the read side complete.
    const w = claude.parseStream(stream([
      asst('a', [], U(10, 2, 7, 1)),
      asst('b', [], { input_tokens: 5, output_tokens: 1, cache_read_input_tokens: 4 }), // omits cache creation only
      done,
    ]));
    assert.deepStrictEqual(w.usage, { in: 15, out: 3, cacheRead: 11, cacheWrite: null });
    assert.strictEqual(w.cacheGaps, 1);

    // Reported by every message: summed, no gap. By none: null, no gap (a category that was never there).
    const full = claude.parseStream(stream([asst('a', [], U(10, 2, 7, 1)), asst('b', [], U(5, 1, 4, 2)), done]));
    assert.deepStrictEqual(full.usage, { in: 15, out: 3, cacheRead: 11, cacheWrite: 3 });
    assert.strictEqual(full.cacheGaps, 0);
    const none = claude.parseStream(stream([asst('a', [], { input_tokens: 1, output_tokens: 1 }), done]));
    assert.deepStrictEqual(none.usage, { in: 1, out: 1, cacheRead: null, cacheWrite: null });
    assert.strictEqual(none.cacheGaps, 0);

    // The count reaches the record, which is what --raw-out and the report read.
    const rec = claude.toRecord(p, { wallMs: 1, cwds: [], model: 'claude-sonnet-5-5', timedOut: false, code: 0 });
    assert.strictEqual(rec.cacheGaps, 1);
    assert.strictEqual(rec.usage.cacheRead, null);
  });

  await test('parseStream treats the stream as untrusted: bad lines are counted, bad numbers are dropped', () => {
    const p = claude.parseStream('not json\n{"type":"result","subtype":"success","result":"x","usage":{"input_tokens":-5,"output_tokens":"lots"},"total_cost_usd":"free"}\n{broken');
    assert.strictEqual(p.parseErrors, 2);
    assert.strictEqual(p.usage, null);
    assert.strictEqual(p.costUsd, null);
  });

  await test('toRecord: only a successful result with an answer is an ok run', () => {
    const rec = (events, extra = {}) => claude.toRecord(claude.parseStream(stream(events)), Object.assign({ wallMs: 1200, cwds: [], model: 'claude-sonnet-5-5', timedOut: false, code: 0 }, extra));
    const good = rec([{ type: 'result', subtype: 'success', is_error: false, result: 'a.js', total_cost_usd: 0.1, usage: U(10, 1, null, null) }]);
    assert.ok(good.ok && good.cost.source === 'agent-reported' && good.durationMs === 1200);
    const floor = rec([{ type: 'result', subtype: 'success', is_error: false, result: 'a.js', usage: U(1000000, 1, 0, 0) }]);
    assert.strictEqual(floor.cost.source, 'table');
    assert.ok(Math.abs(floor.cost.usd - 2) < 1e-9);
    const unpriced = rec([{ type: 'result', subtype: 'success', is_error: false, result: 'a.js', usage: U(10, 1, 0, 0) }], { model: 'no-such-model' });
    assert.deepStrictEqual(unpriced.cost, { usd: null, source: 'unavailable' });
    assert.match(rec([]).error, /no result event/);
    assert.match(rec([{ type: 'result', subtype: 'error_max_turns', is_error: true }]).error, /error_max_turns/);
    assert.strictEqual(rec([], { timedOut: true }).error, 'timeout');
    assert.strictEqual(rec([], { timedOut: true }).answer, '');
  });

  await test('childEnv drops the nested-session guard and asks for credential scrubbing, nothing else', () => {
    const e = claude.childEnv({ CLAUDECODE: '1', ANTHROPIC_API_KEY: 'k', PATH: '/bin' });
    assert.deepStrictEqual(e, { ANTHROPIC_API_KEY: 'k', PATH: '/bin', CLAUDE_CODE_SUBPROCESS_ENV_SCRUB: '1' });
  });

  await test('a context too large for one argument is refused, not truncated', () => {
    assert.throws(() => claude.buildArgs({ arm: 'with', model: 'm', budgetUsd: 1, sigmapContext: 'x'.repeat(130 * 1024), mcpConfig: '{}' }), /may not exceed/);
    assert.doesNotThrow(() => claude.buildArgs({ arm: 'with', model: 'm', budgetUsd: 1, sigmapContext: 'x'.repeat(100 * 1024), mcpConfig: '{}' }));
  });

  // ── arm preparation ────────────────────────────────────────────────────────

  await test('both arms start from the clean pinned commit; the shared clone is never written', () => {
    const { root, manifest } = makeDataRoot([{ name: 'r1', tasks: [{ id: 'x001', query: 'q', expected: ['src/alpha.js'] }] }]);
    const clone = path.join(root, 'benchmarks', 'repos', 'r1');
    // The shared clone is dirty: a stale index, a generated file, an edited tracked file.
    fs.mkdirSync(path.join(clone, '.context'));
    fs.writeFileSync(path.join(clone, '.context', 'query-context.md'), 'LEFTOVER ANSWER src/alpha.js');
    fs.writeFileSync(path.join(clone, 'CLAUDE.md'), '## Auto-generated signatures\n<!-- Updated by gen-context.js -->\nstale');
    fs.appendFileSync(path.join(clone, 'src', 'beta.js'), '// edited\n');
    const before = treeHash(clone);
    const tmp = mktmp('ab-arms-');

    const a = arms.prepareArm({ root, repo: manifest.repos[0], arm: 'without', tmpRoot: tmp, codeRoot: ROOT });
    const b = arms.prepareArm({ root, repo: manifest.repos[0], arm: 'with', tmpRoot: tmp, codeRoot: ROOT });

    assert.strictEqual(treeHash(clone), before, 'the shared clone is byte-identical');
    assert.ok(!fs.existsSync(path.join(a.cwd, '.context')), 'no generated index in the no-SigMap arm');
    assert.ok(!fs.existsSync(path.join(a.cwd, 'CLAUDE.md')), 'no generated section in the no-SigMap arm');
    assert.ok(!fs.readFileSync(path.join(a.cwd, 'src', 'beta.js'), 'utf8').includes('edited'), 'tracked files are the pinned ones');
    assert.strictEqual(a.sigmapContext, undefined);
    assert.ok(fs.existsSync(path.join(b.cwd, '.context')), 'the SigMap arm has a fresh index');
    assert.ok(b.sigmapContext.startsWith('## Auto-generated signatures'));
    assert.ok(!b.sigmapContext.includes('stale'), 'regenerated, not the leftover');
    assert.ok(b.sigmapContext.includes('alphaThing'));
    assert.ok(a.cwds.length >= 1 && b.binDir);
    const cfg = JSON.parse(b.mcpConfig).mcpServers.sigmap;
    assert.deepStrictEqual(cfg.args, [path.join(ROOT, 'gen-context.js'), '--mcp']);
  });

  await test('a symlinked clone is never reset, cleaned or written, and the two arms do not share a directory (#959)', () => {
    const { root, manifest } = makeDataRoot([{ name: 'r1', tasks: [{ id: 'x001', query: 'q', expected: ['src/alpha.js'] }] }]);
    // The borrowed-clone layout: benchmarks/repos/r1 is a link to a clone that lives elsewhere.
    const link = path.join(root, 'benchmarks', 'repos', 'r1');
    const borrowed = path.join(mktmp('ab-borrowed-'), 'r1');
    fs.renameSync(link, borrowed);
    fs.symlinkSync(borrowed, link, 'dir');
    // What a maintainer keeps in a shared clone: an untracked file and a local edit.
    fs.writeFileSync(path.join(borrowed, 'NOTES-untracked.txt'), 'my work\n');
    fs.appendFileSync(path.join(borrowed, 'src', 'alpha.js'), '// local edit\n');
    const before = treeHash(borrowed);
    const head = git(borrowed, ['rev-parse', 'HEAD']);
    const tmp = mktmp('ab-arms-link-');

    const a = arms.prepareArm({ root, repo: manifest.repos[0], arm: 'without', tmpRoot: tmp, codeRoot: ROOT });
    const b = arms.prepareArm({ root, repo: manifest.repos[0], arm: 'with', tmpRoot: tmp, codeRoot: ROOT });

    assert.strictEqual(treeHash(borrowed), before, 'the shared clone is byte-identical');
    assert.ok(fs.existsSync(path.join(borrowed, 'NOTES-untracked.txt')), 'its untracked file survives');
    assert.ok(fs.readFileSync(path.join(borrowed, 'src', 'alpha.js'), 'utf8').includes('local edit'), 'its local edit survives');
    assert.strictEqual(git(borrowed, ['rev-parse', 'HEAD']), head);
    for (const arm of [a, b]) {
      assert.ok(!fs.lstatSync(arm.cwd).isSymbolicLink(), `${arm.cwd} is a real directory`);
      assert.ok(fs.realpathSync(arm.cwd).startsWith(fs.realpathSync(tmp) + path.sep), 'inside the private temp root');
    }
    assert.notStrictEqual(fs.realpathSync(a.cwd), fs.realpathSync(b.cwd), 'two directories, not one');
    assert.ok(!fs.existsSync(path.join(a.cwd, 'CLAUDE.md')) && !fs.existsSync(path.join(a.cwd, '.context')),
      'the SigMap arm\'s generated files never reach the no-SigMap arm');
    assert.ok(!fs.existsSync(path.join(borrowed, 'CLAUDE.md')) && !fs.existsSync(path.join(borrowed, '.context')),
      'nor the shared clone');
    assert.ok(fs.existsSync(path.join(b.cwd, '.context')), 'the SigMap arm has its own index');
    assert.ok(!fs.existsSync(path.join(a.cwd, 'NOTES-untracked.txt')), 'the copy was cleaned, the original was not');
  });

  await test('an arm whose .git is a link is refused before git can write through it (#959)', () => {
    const { root, manifest } = makeDataRoot([{ name: 'r1', tasks: [{ id: 'x001', query: 'q', expected: ['src/alpha.js'] }] }]);
    const clone = path.join(root, 'benchmarks', 'repos', 'r1');
    // A clone whose repository is shared: .git is a symlink to a gitdir kept elsewhere.
    const gitdir = path.join(mktmp('ab-gitdir-'), 'shared.git');
    fs.renameSync(path.join(clone, '.git'), gitdir);
    fs.symlinkSync(gitdir, path.join(clone, '.git'), 'dir');
    const head = git(clone, ['rev-parse', 'HEAD']);
    const indexBefore = fs.readFileSync(path.join(gitdir, 'index'));
    const tmp = mktmp('ab-arms-gitlink-');

    assert.throws(() => arms.prepareArm({ root, repo: manifest.repos[0], arm: 'without', tmpRoot: tmp, codeRoot: ROOT }),
      /r1 \(without\): the copy's \.git is not a directory of its own/);
    assert.strictEqual(git(clone, ['rev-parse', 'HEAD']), head);
    assert.ok(fs.readFileSync(path.join(gitdir, 'index')).equals(indexBefore), 'the shared repository\'s index was not rewritten');
  });

  await test('the sigmap shim runs THIS checkout, and the SigMap arm\'s MCP server answers', () => {
    const { root, manifest } = makeDataRoot([{ name: 'r1', tasks: [{ id: 'x001', query: 'q', expected: ['src/alpha.js'] }] }]);
    const tmp = mktmp('ab-shim-');
    const b = arms.prepareArm({ root, repo: manifest.repos[0], arm: 'with', tmpRoot: tmp, codeRoot: ROOT });
    const shim = path.join(b.binDir, 'sigmap');
    assert.ok(fs.statSync(shim).mode & 0o111, 'executable');
    const v = spawnSync(shim, ['--version'], { encoding: 'utf8', cwd: b.cwd });
    assert.strictEqual(v.status, 0);
    assert.ok(v.stdout.includes(require(path.join(ROOT, 'package.json')).version), `shim printed: ${v.stdout}`);
    const probe = arms.probeMcp({ cwd: b.cwd, codeRoot: ROOT });
    assert.ok(probe.ok && probe.tools > 0, JSON.stringify(probe));
  });

  await test('the MCP probe fails a server that lists no tools or never answers', () => {
    const fakeRoot = (body) => { const d = mktmp('ab-probe-'); fs.writeFileSync(path.join(d, 'gen-context.js'), body); return d; };
    const empty = fakeRoot(`process.stdin.on('data', (d) => { for (const l of String(d).split('\\n')) { if (!l.trim()) continue; const m = JSON.parse(l); if (m.id === 2) console.log(JSON.stringify({ jsonrpc: '2.0', id: 2, result: { tools: [] } })); } }); process.stdin.on('end', () => process.exit(0));`);
    const silent = fakeRoot(`process.stdin.on('data', () => {}); process.stdin.on('end', () => process.exit(0));`);
    const cwd = mktmp('ab-probe-cwd-');
    const a = arms.probeMcp({ cwd, codeRoot: empty, timeoutMs: 10000 });
    assert.strictEqual(a.ok, false);
    assert.match(a.error, /lists no tools/);
    const b = arms.probeMcp({ cwd, codeRoot: silent, timeoutMs: 10000 });
    assert.strictEqual(b.ok, false);
    assert.match(b.error, /did not answer/);
  });

  // ── the CLI, end to end against a fake agent ──────────────────────────────

  const fixture = () => {
    const d = makeDataRoot([
      { name: 'r1', tasks: [{ id: 'x002', query: 'second', expected: ['src/beta.js'] }, { id: 'x001', query: 'where is the alpha thing', expected: ['src/alpha.js'] }] },
      { name: 'r2', tasks: [{ id: 'x010', query: 'where is the beta thing', expected: ['src/beta.js'] }] },
    ]);
    const bin = path.join(mktmp('ab-bin-'), 'claude');
    fs.writeFileSync(bin, FAKE_CLAUDE, { mode: 0o755 });
    return Object.assign(d, { bin, log: path.join(path.dirname(bin), 'calls.jsonl'), out: mktmp('ab-out-') });
  };
  const live = (f, extra = {}) => ({ ANTHROPIC_API_KEY: 'test-key', SIGMAP_XREPO_DATA: f.root, FAKE_LOG: f.log, FAKE_MAP: JSON.stringify({ r1: 'src/alpha.js', r2: 'src/beta.js' }), CLAUDECODE: '1', ...extra });

  await test('--dry-run prints the plan and the worst-case spend and starts nothing', () => {
    const f = fixture();
    const r = runCli(['--dry-run', '--claude', '/no/such/claude', '--runs', '4'], { SIGMAP_XREPO_DATA: f.root });
    assert.strictEqual(r.status, 0, r.stderr);
    assert.match(r.stdout, /dry run/);
    assert.match(r.stdout, /tasks\s+2 \(first 1 per repo, by id\)/);
    assert.match(r.stdout, /4 per arm × 2 arms = 16 agent runs/);
    assert.match(r.stdout, /<= \$16\.00 worst case/);
    assert.ok(!fs.existsSync(f.log));
  });

  await test('with no API key it explains and exits 0 without preparing or spawning anything', () => {
    const f = fixture();
    const r = runCli(['--claude', f.bin], { SIGMAP_XREPO_DATA: f.root, FAKE_LOG: f.log });
    assert.strictEqual(r.status, 0, r.stderr);
    assert.match(r.stdout, /ANTHROPIC_API_KEY is not set/);
    assert.ok(!fs.existsSync(f.log));
  });

  await test('a flag it does not know is an error, not a silent default', () => {
    const f = fixture();
    const r = runCli(['--run', '4', '--dry-run'], { SIGMAP_XREPO_DATA: f.root });
    assert.strictEqual(r.status, 2);
    assert.match(r.stderr, /unknown flag --run/);
  });

  await test('a flag that takes a value and is given none is an error naming the flag, never the default (#959)', () => {
    const f = fixture();
    // Live env and the fake agent, no --dry-run: before the fix each of these ran the whole plan
    // on a default, so "nothing was started" is a real check, not a vacuous one.
    // --out-dir is always given a real directory (bar the probe about --out-dir itself): were the
    // check to regress, the run this test provokes must still not write into benchmarks/reports.
    const probes = [
      [['--runs', '--save'], '--runs'],                         // the next token is another flag
      [['--model'], '--model'],                                 // last argument
      [['--max-budget-usd', '--save'], '--max-budget-usd'],
      [['--repos', '--runs', '4'], '--repos'],
      [['--out-dir', ''], '--out-dir'],                         // an empty string is no value
    ];
    for (const [rest, flag] of probes) {
      const args = ['--claude', f.bin, ...(flag === '--out-dir' ? [] : ['--out-dir', f.out]), ...rest];
      const r = runCli(args, live(f));
      assert.strictEqual(r.status, 2, `${args.join(' ')}: ${r.stderr}`);
      assert.ok(r.stderr.includes(`${flag} needs a value`), `${args.join(' ')}: ${r.stderr}`);
      assert.ok(!fs.existsSync(f.log), `${flag}: nothing was started`);
    }
    // Boolean flags take no value, and a value that looks like one is still a value for its own flag.
    const ok = runCli(['--dry-run', '--runs', '6', '--tasks-per-repo', '1'], { SIGMAP_XREPO_DATA: f.root });
    assert.strictEqual(ok.status, 0, ok.stderr);
    assert.match(ok.stdout, /6 per arm × 2 arms = 24 agent runs/);
  });

  await test('a full run: both arms, N runs, identical prompts, SigMap only in its arm, report saved', () => {
    const f = fixture();
    const clones = ['r1', 'r2'].map((n) => path.join(f.root, 'benchmarks', 'repos', n));
    const before = clones.map(treeHash);
    const r = runCli(['--claude', f.bin, '--runs', '4', '--save', '--out-dir', f.out, '--max-budget-usd', '0.5', '--raw-out', path.join(f.out, 'raw.json')], live(f));
    assert.strictEqual(r.status, 0, r.stderr);

    const calls = fs.readFileSync(f.log, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
    assert.strictEqual(calls.length, 16, '2 tasks × 4 runs × 2 arms');
    const withArm = calls.filter((c) => c.argv.includes('--mcp-config'));
    const without = calls.filter((c) => !c.argv.includes('--mcp-config'));
    assert.strictEqual(withArm.length, 8);
    assert.ok(withArm.every((c) => /-with$/.test(c.cwd)) && without.every((c) => /-without$/.test(c.cwd)));
    assert.ok(withArm.every((c) => c.sigmapOnPath), 'the harness\'s sigmap is on PATH in its arm');
    assert.ok(without.every((c) => !c.sigmapOnPath), 'and only there');
    assert.ok(calls.every((c) => c.claudecode === null), 'the nested-session guard is not passed on');
    assert.ok(calls.every((c) => c.argv[c.argv.indexOf('--max-budget-usd') + 1] === '0.5'));
    assert.strictEqual(new Set(calls.map((c) => c.stdin)).size, 2, 'one prompt per question, the same in both arms');
    assert.ok(calls.every((c) => !c.argv.some((a) => a.includes('where is the'))), 'the prompt is not in argv');
    assert.deepStrictEqual(clones.map(treeHash), before, 'the shared clones are untouched');

    const rep = JSON.parse(fs.readFileSync(path.join(f.out, 'agent-ab.json'), 'utf8'));
    assert.strictEqual(rep.method.publishable, true);
    assert.strictEqual(rep.method.agentVersion, '9.9.9 (Fake Claude)');
    assert.strictEqual(rep.method.model, 'claude-sonnet-5-5');
    assert.strictEqual(rep.method.budgetUsd, 0.5);
    assert.strictEqual(rep.total.tasks, 2);
    assert.deepStrictEqual(rep.total.pass, { without: { pass: 8, runs: 8 }, with: { pass: 8, runs: 8 } });
    const tc = rep.total.metrics.toolCalls;
    assert.deepStrictEqual([tc.without, tc.with, tc.medianDelta, tc.fewer], [5, 2, -3, 2]);
    assert.strictEqual(rep.total.metrics.costUsd.without, 0.03);
    assert.strictEqual(rep.total.metrics.costUsd.with, 0.01);
    assert.strictEqual(rep.total.metrics.cacheRead.without, null, 'the no-SigMap arm reported none');
    assert.deepStrictEqual([rep.total.spend.without.all.runs, rep.total.spend.with.all.runs], [8, 8]);
    assert.deepStrictEqual([rep.total.spend.without.failed.runs, rep.total.spend.with.failed.runs], [0, 0]);
    assert.ok(Math.abs(rep.total.spend.without.all.agentReportedUsd - 0.24) < 1e-9, 'the spend is the sum over every run');
    assert.match(fs.readFileSync(path.join(f.out, 'agent-ab.md'), 'utf8'), /## Spend/);
    // The repetition view, end to end: 2 tasks × 4 repetitions, SigMap's arm cheaper by the same ratio every time.
    assert.deepStrictEqual(rep.repetitions.runs, [1, 2, 3, 4]);
    assert.deepStrictEqual(rep.repetitions.outcome.total, { tasks: 8, better: 0, worse: 0, ties: 8 });
    assert.strictEqual(rep.repetitions.metrics.costUsd.workload, 'fewer-every-repetition');
    assert.strictEqual(rep.repetitions.metrics.costUsd.typical, 'fewer-every-repetition');
    assert.strictEqual(rep.repetitions.metrics.costUsd.typicalOutsideNoise, true);
    assert.match(fs.readFileSync(path.join(f.out, 'agent-ab.md'), 'utf8'), /## Repetitions — workload total vs typical task/);
    const raw = JSON.parse(fs.readFileSync(path.join(f.out, 'raw.json'), 'utf8'));
    assert.ok(raw.every((r) => r.cacheGaps === 0 && r.usageSource === 'result'), 'the raw record carries the gap count and where usage came from');
    assert.match(fs.readFileSync(path.join(f.out, 'agent-ab.md'), 'utf8'), /claude-code 9\.9\.9 \(Fake Claude\) · claude-sonnet-5-5/);
    assert.strictEqual(JSON.parse(fs.readFileSync(path.join(f.out, 'raw.json'), 'utf8')).length, 16);
    assert.ok(r.stdout.includes('## Caveats'));
  });

  await test('a contaminated arm aborts the run and writes no report', () => {
    const f = fixture();
    const r = runCli(['--claude', f.bin, '--runs', '4', '--save', '--out-dir', f.out], live(f, { FAKE_MODE: 'contaminated' }));
    assert.strictEqual(r.status, 1);
    assert.match(r.stderr, /integrity:.*no-SigMap arm.*Nothing was recorded/);
    assert.ok(!fs.existsSync(path.join(f.out, 'agent-ab.json')));
  });

  await test('--save below the minimum runs is refused before any agent is started', () => {
    const f = fixture();
    const r = runCli(['--claude', f.bin, '--runs', '2', '--save', '--out-dir', f.out], live(f));
    assert.strictEqual(r.status, 2);
    assert.match(r.stderr, /--allow-unpublishable/);
    assert.ok(!fs.existsSync(f.log));
    const ok = runCli(['--claude', f.bin, '--runs', '2', '--save', '--allow-unpublishable', '--out-dir', f.out], live(f));
    assert.strictEqual(ok.status, 0, ok.stderr);
    assert.strictEqual(JSON.parse(fs.readFileSync(path.join(f.out, 'agent-ab.json'), 'utf8')).method.publishable, false);
    assert.match(ok.stdout, /NOT PUBLISHABLE/);
  });

  await test('a broken setup stops after consecutive failures instead of spending the whole plan', () => {
    const f = fixture();
    const r = runCli(['--claude', f.bin, '--runs', '4'], live(f, { FAKE_MODE: 'error' }));
    assert.strictEqual(r.status, 1);
    assert.match(r.stderr, /3 consecutive failed runs/);
    assert.strictEqual(fs.readFileSync(f.log, 'utf8').trim().split('\n').length, 3);
  });

  await test('a hung run is killed, recorded as a timeout, and its usage is unknown', () => {
    const f = fixture();
    const r = runCli(['--claude', f.bin, '--runs', '1', '--repos', 'r2', '--timeout-ms', '700', '--max-consecutive-failures', '99', '--json'], live(f, { FAKE_MODE: 'hang' }), { timeout: 60000 });
    assert.strictEqual(r.status, 0, r.stderr);
    const rep = JSON.parse(r.stdout);
    assert.deepStrictEqual(rep.cells.map((c) => c.errors), [['timeout'], ['timeout']]);
    assert.ok(rep.cells.every((c) => c.completed === 0 && c.metrics.toolCalls === null && c.metrics.in === null));
    assert.strictEqual(rep.method.publishable, false);
    assert.deepStrictEqual([rep.total.spend.with.failed.runs, rep.total.spend.with.failed.unknownRuns], [1, 1], 'a timeout is a billed run of unknown cost');
  });

  // ── guards ─────────────────────────────────────────────────────────────────

  await test('the harness never spawns through a shell and stays out of the published package and CI', () => {
    const files = ['scripts/run-agent-ab.mjs', 'scripts/lib/agent-ab.mjs', 'scripts/lib/agent-ab-claude.mjs', 'scripts/lib/agent-ab-arms.mjs', 'scripts/lib/agent-ab-stats.mjs', 'scripts/agent-ab-compat-shim.mjs'];
    for (const rel of files) {
      const src = fs.readFileSync(path.join(ROOT, rel), 'utf8').split('\n').filter((l) => !/^\s*(\*|\/\/)/.test(l)).join('\n');
      assert.ok(!/\bexecSync\b|shell:\s*true|\bexec\(/.test(src), `${rel} spawns through a shell`);
    }
    const pkg = require(path.join(ROOT, 'package.json'));
    assert.strictEqual(pkg.scripts['benchmark:agent-ab'], 'node scripts/run-agent-ab.mjs');
    assert.ok(!pkg.files.some((f) => f.startsWith('scripts')), 'the harness is not in the tarball');
    assert.ok(!Object.keys(pkg.scripts).some((k) => /^(pre|post)?install$/.test(k)));
    const wf = path.join(ROOT, '.github', 'workflows');
    for (const w of fs.existsSync(wf) ? fs.readdirSync(wf) : []) {
      assert.ok(!/agent-ab/.test(fs.readFileSync(path.join(wf, w), 'utf8')), `${w} runs the paid harness`);
    }
  });

  // ── the lean variant: the same index, told less on every turn ──────────────

  await test('the lean variant keeps the index, narrows the MCP server to the 7-tool core profile, and swaps the section for three lines', () => {
    const { root, manifest } = makeDataRoot([{ name: 'r1', tasks: [{ id: 'x001', query: 'q', expected: ['src/alpha.js'] }] }]);
    // One directory per variant: an arm's copy is named for its repo and arm, so two variants must not share a tmpRoot.
    const cur = arms.prepareArm({ root, repo: manifest.repos[0], arm: 'with', tmpRoot: mktmp('ab-cur-'), codeRoot: ROOT });
    const lean = arms.prepareArm({ root, repo: manifest.repos[0], arm: 'with', tmpRoot: mktmp('ab-lean-'), codeRoot: ROOT, variant: 'lean' });

    assert.match(cur.sigmapContext, /SigMap commands/, 'the default is the generated section');
    assert.strictEqual(lean.sigmapContext, ab.LEAN_SECTION);
    assert.ok(/query_context/.test(lean.sigmapContext) && /get_lines/.test(lean.sigmapContext), 'it names the MCP tools the arm has');
    assert.ok(!/sigmap ask/.test(lean.sigmapContext), 'and not a terminal command the agent rarely ran');
    assert.ok(/lead, not an answer/.test(lean.sigmapContext), 'the ranking is a lead to confirm: top-1 is right about one time in three');
    assert.ok(lean.sigmapContext.length < 600, 'a few hundred characters');
    assert.notStrictEqual(lean.sigmapContext, cur.sigmapContext);

    assert.deepStrictEqual(JSON.parse(fs.readFileSync(path.join(lean.cwd, 'gen-context.config.json'), 'utf8')), { mcp: { tools: 'core' } });
    assert.ok(fs.existsSync(path.join(lean.cwd, 'CLAUDE.md')), 'the index is still generated: only what the agent is told changes');
    const tools = (cwd) => {
      const init = [{ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 't', version: '1' } } }, { jsonrpc: '2.0', id: 2, method: 'tools/list' }];
      const r = spawnSync(process.execPath, [path.join(ROOT, 'gen-context.js'), '--mcp'], { cwd, input: `${init.map((m) => JSON.stringify(m)).join('\n')}\n`, encoding: 'utf8', timeout: 30000 });
      for (const line of r.stdout.split('\n')) { try { const m = JSON.parse(line); if (m.id === 2) return m.result.tools.map((t) => t.name).sort(); } catch (_) { /* not a response */ } }
      return [];
    };
    assert.deepStrictEqual(tools(lean.cwd), ['get_callee_signatures', 'get_impact', 'get_lines', 'get_method_impact', 'query_context', 'read_context', 'verify_suggestion']);
    assert.strictEqual(tools(cur.cwd).length, 22, 'the current variant still advertises every tool');
    assert.ok(arms.probeMcp({ cwd: lean.cwd, codeRoot: ROOT }).ok, 'the narrowed server still answers');
  });

  await test('the index variant is the docs\' setup: the index strategy and the core profile, with the section SigMap itself writes', () => {
    const { root, manifest } = makeDataRoot([{ name: 'r1', tasks: [{ id: 'x001', query: 'q', expected: ['src/alpha.js'] }] }]);
    const idx = arms.prepareArm({ root, repo: manifest.repos[0], arm: 'with', tmpRoot: mktmp('ab-idx-'), codeRoot: ROOT, variant: 'index' });
    assert.deepStrictEqual(JSON.parse(fs.readFileSync(path.join(idx.cwd, 'gen-context.config.json'), 'utf8')), { strategy: 'index', mcp: { tools: 'core' } });
    assert.notStrictEqual(idx.sigmapContext, ab.LEAN_SECTION, 'nothing hand-written: the section is the one SigMap generated');
    assert.match(idx.sigmapContext, /SigMap commands/);
    assert.ok(fs.existsSync(path.join(idx.cwd, '.context')) || fs.existsSync(path.join(idx.cwd, 'CLAUDE.md')), 'the index is generated');
    const init = [{ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 't', version: '1' } } }, { jsonrpc: '2.0', id: 2, method: 'tools/list' }];
    const r = spawnSync(process.execPath, [path.join(ROOT, 'gen-context.js'), '--mcp'], { cwd: idx.cwd, input: `${init.map((m) => JSON.stringify(m)).join('\n')}\n`, encoding: 'utf8', timeout: 30000 });
    let n = 0; for (const line of r.stdout.split('\n')) { try { const m = JSON.parse(line); if (m.id === 2) n = m.result.tools.length; } catch (_) { /* not a response */ } }
    assert.strictEqual(n, 7, 'the narrowed server');
    assert.ok(arms.probeMcp({ cwd: idx.cwd, codeRoot: ROOT }).ok);
  });

  await test('an unknown variant is refused by name, and the report says which variant it measured', async () => {
    const { root, manifest } = makeDataRoot([{ name: 'r1', tasks: [{ id: 'x001', query: 'q', expected: ['src/alpha.js'] }] }]);
    assert.throws(() => arms.prepareArm({ root, repo: manifest.repos[0], arm: 'with', tmpRoot: mktmp('ab-bad-'), codeRoot: ROOT, variant: 'bogus' }), /unknown SigMap variant "bogus" \(one of: current, lean, index\)/);
    assert.deepStrictEqual(Object.keys(ab.SIGMAP_VARIANTS), ['current', 'lean', 'index']);
    const entries = await ab.runPlan({ tasks: [TASKS[0]], runs: 2, runner: stub() });
    const mk = (variant) => ab.buildReport({ entries, tasks: [TASKS[0]], method: { agent: 'claude-code', runs: 2, tasksPerRepo: 1, budgetUsd: 1, timeoutMs: 1000, date: '2026-11-09', variant } });
    assert.deepStrictEqual([mk(undefined).method.variant, mk('current').method.variant, mk('lean').method.variant], ['current', 'current', 'lean']);
    assert.strictEqual(mk('lean').method.arms.with, ab.SIGMAP_VARIANTS.lean);
    assert.strictEqual(mk(undefined).method.arms.with, ab.SIGMAP_VARIANTS.current, 'an older caller without a variant is still the current arm');
    assert.match(ab.renderMarkdown(mk('lean')), /\*\*with\*\* = SigMap lean: 7-tool core MCP profile/);
  });

  await test('--task-ids runs exactly those questions, says so in the plan and the report, and refuses an id that does not exist', () => {
    const f = fixture();
    const dry = runCli(['--dry-run', '--task-ids', 'x010'], { SIGMAP_XREPO_DATA: f.root });
    assert.strictEqual(dry.status, 0, dry.stderr);
    assert.match(dry.stdout, /tasks\s+1 \(task id\(s\) x010\)/);
    assert.match(dry.stdout, /4 per arm × 2 arms = 8 agent runs/, 'one task, the default 4 repetitions, both arms');
    const two = runCli(['--dry-run', '--task-ids', 'x002,x010'], { SIGMAP_XREPO_DATA: f.root });
    assert.match(two.stdout, /tasks\s+2 \(task id\(s\) x002, x010\)/);
    const bad = runCli(['--dry-run', '--task-ids', 'x999'], { SIGMAP_XREPO_DATA: f.root });
    assert.strictEqual(bad.status, 2);
    assert.match(bad.stderr, /--task-ids: "x999" is not a task id/);
    const none = runCli(['--dry-run', '--task-ids', 'x010', '--repos', 'r1'], { SIGMAP_XREPO_DATA: f.root });
    assert.strictEqual(none.status, 2);
    assert.match(none.stderr, /no task to run: none of x010 is in a repo/);
    const noVal = runCli(['--dry-run', '--task-ids'], { SIGMAP_XREPO_DATA: f.root });
    assert.strictEqual(noVal.status, 2);
    assert.match(noVal.stderr, /--task-ids needs a value/);

    const live1 = runCli(['--claude', f.bin, '--runs', '2', '--task-ids', 'x010', '--save', '--allow-unpublishable', '--out-dir', f.out], live(f));
    assert.strictEqual(live1.status, 0, live1.stderr);
    const calls = fs.readFileSync(f.log, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
    assert.strictEqual(calls.length, 4, '1 task × 2 repetitions × 2 arms');
    assert.ok(calls.every((c) => /r2-(with|without)$/.test(c.cwd)), 'only the repo that holds x010 ran');
    const rep = JSON.parse(fs.readFileSync(path.join(f.out, 'agent-ab.json'), 'utf8'));
    assert.deepStrictEqual(rep.method.taskIds, ['x010']);
    assert.strictEqual(rep.method.selection, 'the task id(s) x010');
    assert.deepStrictEqual(rep.cells.map((c) => c.task), ['x010', 'x010']);
  });

  await test('run-remaining.sh runs one question per invocation, resumes by skipping what is saved, and stops on the first failure', () => {
    const script = path.join(ROOT, 'benchmarks', 'pilots', '2026-11-09-relay-haiku-5-5', 'run-remaining.sh');
    const f = fixture();
    const env = (extra) => Object.assign({}, process.env, { ANTHROPIC_API_KEY: 'test-key', SIGMAP_XREPO_DATA: f.root, FAKE_LOG: f.log, FAKE_MAP: '{}', CLAUDECODE: '', ORDER: 'r2:x010', VARIANTS: 'index', RUNS: '2', CLAUDE_BIN: f.bin }, extra);
    const sh = (extra) => spawnSync('bash', [script], { cwd: ROOT, encoding: 'utf8', timeout: 120000, env: env(extra) });

    const dry = sh({ DRY: '1', OUT: path.join(f.out, 'dry') });
    assert.strictEqual(dry.status, 0, dry.stderr);
    assert.match(dry.stdout, /run\s+index r2:x010/);
    assert.match(dry.stdout, /tasks\s+1 \(task id\(s\) x010\)/);
    assert.ok(!fs.existsSync(path.join(f.out, 'dry')) && !fs.existsSync(f.log), 'a dry run creates nothing and starts nothing');

    const out = path.join(f.out, 'ok');
    const first = sh({ OUT: out });
    assert.strictEqual(first.status, 0, first.stderr);
    assert.ok(fs.existsSync(path.join(out, 'index', 'r2-x010', 'raw.json')) && fs.existsSync(path.join(out, 'index', 'r2-x010', 'agent-ab.json')));
    const calls = fs.readFileSync(f.log, 'utf8').trim().split('\n').length;
    assert.strictEqual(calls, 4, '1 question x 2 repetitions x 2 arms');
    const rep = JSON.parse(fs.readFileSync(path.join(out, 'index', 'r2-x010', 'agent-ab.json'), 'utf8'));
    assert.strictEqual(rep.method.variant, 'index');
    assert.deepStrictEqual(rep.method.taskIds, ['x010']);

    const again = sh({ OUT: out });
    assert.strictEqual(again.status, 0, again.stderr);
    assert.match(again.stdout, /skip\s+index r2:x010 \(done:/);
    assert.strictEqual(fs.readFileSync(f.log, 'utf8').trim().split('\n').length, calls, 'nothing was started the second time');

    const done = sh({ OUT: path.join(f.out, 'seeded'), ORDER: 'gin:x001 r2:x010', VARIANTS: 'index lean' });
    assert.match(done.stdout, /skip\s+index gin:x001 \(already in this directory's saved data\)/, 'a question already saved in the repository is not re-run');

    const bad = sh({ OUT: path.join(f.out, 'bad'), FAKE_MODE: 'error', ORDER: 'r2:x010 r1:x001' });
    assert.strictEqual(bad.status, 1, 'the first failed question stops the run');
    assert.match(bad.stderr, /STOPPED at index r2:x010/);
    assert.match(bad.stderr, /Rerun the same command to resume/);
    assert.ok(!fs.existsSync(path.join(f.out, 'bad', 'index', 'r2-x010', 'raw.json')), 'a failed question leaves no raw.json, so a rerun redoes it');
    assert.ok(!fs.existsSync(path.join(f.out, 'bad', 'index', 'r1-x001')), 'and the next question was never started');
    // A forced rerun over saved data that then fails must not leave the old raw.json behind: a later resume would skip the question as done.
    const stale = path.join(f.out, 'stale', 'index', 'r2-x010');
    fs.mkdirSync(stale, { recursive: true });
    fs.writeFileSync(path.join(stale, 'raw.json'), '[]');
    const forced = sh({ OUT: path.join(f.out, 'stale'), FORCE: '1', FAKE_MODE: 'error' });
    assert.strictEqual(forced.status, 1);
    assert.ok(!fs.existsSync(path.join(stale, 'raw.json')), 'the stale raw.json is removed when the forced rerun fails');
    const unknown = sh({ VARIANTS: 'bogus', DRY: '1' });
    assert.strictEqual(unknown.status, 2);
    assert.match(unknown.stderr, /unknown variant: bogus/);
  });

  await test('--sigmap-variant reaches the agent: the lean arm gets the three-line section, the other arm none, and the report records it', () => {
    const f = fixture();
    const r = runCli(['--claude', f.bin, '--runs', '2', '--sigmap-variant', 'lean', '--save', '--allow-unpublishable', '--out-dir', f.out], live(f));
    assert.strictEqual(r.status, 0, r.stderr);
    const calls = fs.readFileSync(f.log, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
    const withArm = calls.filter((c) => c.argv.includes('--mcp-config'));
    const without = calls.filter((c) => !c.argv.includes('--mcp-config'));
    assert.strictEqual(withArm.length, 4);
    assert.ok(withArm.every((c) => c.argv[c.argv.indexOf('--append-system-prompt') + 1] === ab.LEAN_SECTION));
    assert.ok(without.every((c) => !c.argv.includes('--append-system-prompt')), 'the baseline is told nothing');
    const rep = JSON.parse(fs.readFileSync(path.join(f.out, 'agent-ab.json'), 'utf8'));
    assert.strictEqual(rep.method.variant, 'lean');
    assert.strictEqual(rep.method.arms.with, ab.SIGMAP_VARIANTS.lean);
    assert.match(r.stderr, /variant: lean/, 'the plan says which variant is running');
    const bad = runCli(['--dry-run', '--sigmap-variant', 'bogus'], { SIGMAP_XREPO_DATA: f.root });
    assert.strictEqual(bad.status, 2);
    assert.match(bad.stderr, /--sigmap-variant must be one of: current, lean, index \(got "bogus"\)/);
    const noVal = runCli(['--dry-run', '--sigmap-variant'], { SIGMAP_XREPO_DATA: f.root });
    assert.strictEqual(noVal.status, 2);
    assert.match(noVal.stderr, /--sigmap-variant needs a value/);
  });

  // ── "did it save?": workload total vs typical task, per repetition ─────────

  const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} is not ${b}`);

  await test('workloadChange sums each arm; geometricChange weighs each task once — the two disagree in sign on the same pairs', () => {
    const pairs = [{ without: 1000, with: 1200 }, { without: 10, with: 5 }];
    const w = stats.workloadChange(pairs);
    near(w.change, 1205 / 1010 - 1);
    assert.deepStrictEqual([w.n, w.without, w.with], [2, 1010, 1205]);
    const g = stats.geometricChange(pairs);
    near(g.change, Math.sqrt(1.2 * 0.5) - 1);
    assert.ok(w.change > 0 && g.change < 0, 'a few large tasks dominate the sum, not the typical task');
  });

  await test('unknown stays unknown: an unreported value is no pair, a zero has no ratio and is counted, not folded in', () => {
    assert.deepStrictEqual(stats.workloadChange([]), { n: 0, without: null, with: null, change: null });
    const w = stats.workloadChange([{ without: null, with: 5 }, { without: 4, with: NaN }, { without: 4, with: 2 }]);
    assert.deepStrictEqual([w.n, w.change], [1, -0.5], 'only the pair with two known values counts');
    assert.strictEqual(stats.workloadChange([{ without: 0, with: 3 }]).change, null, 'a zero baseline total has no ratio');
    const g = stats.geometricChange([{ without: 100, with: 50 }, { without: 0, with: 10 }, { without: 10, with: 0 }, { without: 20, with: 10 }]);
    assert.deepStrictEqual([g.n, g.dropped], [2, 2]);
    near(g.change, -0.5);
    assert.deepStrictEqual(stats.geometricChange([{ without: 0, with: 0 }]).change, null);
  });

  await test('the bootstrap interval: degenerate on equal ratios, exact on a two-pair sample, none for one pair', () => {
    const same = stats.geometricChange([{ without: 10, with: 5 }, { without: 100, with: 50 }, { without: 7, with: 3.5 }]);
    near(same.lo, -0.5); near(same.hi, -0.5); near(same.change, -0.5);
    assert.strictEqual(same.inNoise, false, 'an interval that excludes zero is outside the noise');
    // Two pairs, ratios 0.5 and 2: a resample's mean is ln0.5, 0 or ln2, so the 95% band is exactly [-50%, +100%].
    const two = stats.geometricChange([{ without: 10, with: 5 }, { without: 10, with: 20 }]);
    near(two.change, 0); near(two.lo, -0.5); near(two.hi, 1);
    assert.strictEqual(two.inNoise, true);
    const one = stats.geometricChange([{ without: 10, with: 5 }]);
    assert.deepStrictEqual([one.n, one.lo, one.hi, one.inNoise], [1, null, null, null]);
    near(one.change, -0.5);
    assert.deepStrictEqual(stats.geometricChange([]), { n: 0, dropped: 0, change: null, lo: null, hi: null, inNoise: null });
    // An interval that touches zero includes it: an unchanged pair of tasks is inside the noise, not outside.
    const flat = stats.geometricChange([{ without: 10, with: 10 }, { without: 20, with: 20 }]);
    assert.deepStrictEqual([flat.change, flat.lo, flat.hi, flat.inNoise], [0, 0, 0, true]);
  });

  await test('the bootstrap is deterministic and an estimate never depends on which one was computed first', () => {
    const a = [{ without: 10, with: 7 }, { without: 20, with: 9 }, { without: 5, with: 6 }, { without: 8, with: 3 }, { without: 50, with: 20 }];
    const b = [{ without: 3, with: 9 }, { without: 4, with: 5 }, { without: 100, with: 40 }];
    const aFirst = [stats.geometricChange(a), stats.geometricChange(b)];
    const bFirst = [stats.geometricChange(b), stats.geometricChange(a)].reverse();
    assert.deepStrictEqual(aFirst, bFirst);
    assert.deepStrictEqual(stats.geometricChange(a), stats.geometricChange(a.map((p) => Object.assign({}, p))));
    assert.ok(aFirst[0].lo <= aFirst[0].change && aFirst[0].change <= aFirst[0].hi);
    assert.deepStrictEqual([stats.BOOTSTRAP_ITERATIONS, stats.BOOTSTRAP_SEED, stats.CI_LEVEL], [10000, 1, 0.95]);
    const r1 = stats.makeRng(1); const r1b = stats.makeRng(1); const r2 = stats.makeRng(2);
    const seq = (r) => [r(), r(), r()];
    assert.deepStrictEqual(seq(r1), seq(r1b));
    assert.notDeepStrictEqual(seq(stats.makeRng(1)), seq(r2));
    assert.ok(seq(stats.makeRng(7)).every((x) => x >= 0 && x < 1));
  });

  await test('consistency: a saving counts only if it points the same way in every repetition', () => {
    assert.strictEqual(stats.consistency([-0.1, -0.2, -0.05]), 'fewer-every-repetition');
    assert.strictEqual(stats.consistency([0.1, 0.2]), 'more-every-repetition');
    assert.strictEqual(stats.consistency([-0.1, 0.2]), 'mixed');
    assert.strictEqual(stats.consistency([0, 0]), 'unchanged');
    assert.strictEqual(stats.consistency([-0.1, 0]), 'mixed', 'a 0 is no saving');
    assert.strictEqual(stats.consistency([-0.1]), null, 'one repetition shows no consistency');
    assert.strictEqual(stats.consistency([-0.1, null]), null, 'an unmeasurable repetition is not a vote');
    assert.strictEqual(stats.consistency([]), null);
  });

  // Four tasks of very different size. `mult[run][task]` scales SigMap's arm against the baseline.
  const SIZED = ['big', 'mid', 'small', 'tiny'].map((id) => ({ id, repo: 'r', query: 'q', expected_files: ['a.js'] }));
  const BASE = { big: 1000000, mid: 200000, small: 50000, tiny: 10000 };
  const METHOD = { agent: 'claude-code', agentVersion: '1', model: 'claude-sonnet-5-5', runs: 2, tasksPerRepo: 4, budgetUsd: 1, timeoutMs: 1000, date: '2026-11-07' };
  const sizedRunner = (mult, over = () => ({})) => async (job) => {
    const n = Math.round(BASE[job.task.id] * (job.arm === 'with' ? mult[job.run][job.task.id] : 1));
    return stub(Object.assign({
      usage: { in: n, out: 10, cacheRead: 0, cacheWrite: 0 },
      cost: { usd: n * 1e-6 * (job.arm === 'with' ? 0.5 : 1), source: 'agent-reported' },
    }, over(job)))(job);
  };
  const sizedReport = async (mult, over, runs = 2) => {
    const entries = await ab.runPlan({ tasks: SIZED, runs, runner: sizedRunner(mult, over) });
    return ab.buildReport({ entries, tasks: SIZED, method: Object.assign({}, METHOD, { runs }) });
  };
  const every = (v) => ({ big: v, mid: v, small: v, tiny: v });

  await test('the report gives each repetition both estimates: tokens up by total and down for the typical task, cost down', async () => {
    const mult = { 1: { big: 1.3, mid: 0.6, small: 0.55, tiny: 0.5 }, 2: { big: 1.2, mid: 0.7, small: 0.6, tiny: 0.65 } };
    const rp = (await sizedReport(mult)).repetitions;
    assert.deepStrictEqual(rp.runs, [1, 2]);
    const m = rp.metrics.in;
    for (const run of [1, 2]) {
      const rep = m.reps[run - 1];
      const withTok = SIZED.map((t) => Math.round(BASE[t.id] * mult[run][t.id]));
      const withoutTok = SIZED.map((t) => BASE[t.id]);
      near(rep.workload.change, withTok.reduce((a, b) => a + b, 0) / withoutTok.reduce((a, b) => a + b, 0) - 1);
      const logs = withTok.map((w, i) => Math.log(w / withoutTok[i]));
      near(rep.typical.change, Math.exp(logs.reduce((a, b) => a + b, 0) / logs.length) - 1);
      assert.ok(rep.workload.change > 0 && rep.typical.change < 0, `repetition ${run}: the two views disagree in sign`);
      assert.strictEqual(rep.typical.inNoise, true, `repetition ${run}: the typical-task interval includes zero`);
    }
    assert.strictEqual(m.workload, 'more-every-repetition');
    assert.strictEqual(m.typical, 'fewer-every-repetition');
    assert.strictEqual(m.typicalOutsideNoise, false, 'fewer every time, but inside the noise');
    assert.strictEqual(rp.metrics.costUsd.workload, 'fewer-every-repetition', 'the token view and the cost view can differ in sign');
    assert.strictEqual(rp.metrics.costUsd.typicalOutsideNoise, true, 'a constant halving is outside the noise');
    assert.strictEqual(rp.metrics.toolCalls.workload, 'fewer-every-repetition', 'the stub gives SigMap 2 calls to the baseline\'s 6');
  });

  await test('a saving that reverses between repetitions is mixed, and is not outside the noise', async () => {
    const rp = (await sizedReport({ 1: every(0.5), 2: every(2) })).repetitions;
    for (const view of ['workload', 'typical']) assert.strictEqual(rp.metrics.in[view], 'mixed');
    assert.strictEqual(rp.metrics.in.typicalOutsideNoise, null, 'no one-sided verdict, so nothing can be outside the noise');
  });

  await test('a saving of the same ratio in every repetition is outside the noise; an unchanged series is unchanged', async () => {
    const rp = (await sizedReport({ 1: every(0.5), 2: every(0.5) })).repetitions;
    assert.strictEqual(rp.metrics.in.typical, 'fewer-every-repetition');
    assert.strictEqual(rp.metrics.in.typicalOutsideNoise, true);
    assert.strictEqual(rp.metrics.out.typical, 'unchanged', 'output tokens are 10 in both arms');
    assert.strictEqual(rp.metrics.out.typicalOutsideNoise, null);
  });

  await test('one repetition cannot show consistency, so it gets no verdict', async () => {
    const rp = (await sizedReport({ 1: every(0.5) }, undefined, 1)).repetitions;
    assert.deepStrictEqual(rp.runs, [1]);
    assert.strictEqual(rp.metrics.in.workload, null);
    assert.strictEqual(rp.metrics.in.typical, null);
    near(rp.metrics.in.reps[0].workload.change, -0.5);
  });

  await test('a failed run drops its pair from that repetition; it is never a zero', async () => {
    const mult = { 1: every(0.5), 2: every(0.5) };
    const entries = await ab.runPlan({
      tasks: SIZED, runs: 2,
      runner: async (job) => (job.run === 2 && job.arm === 'with' && job.task.id === 'big'
        ? { ok: false, error: 'timeout', init: null, cwds: [], durationMs: 1 } : sizedRunner(mult)(job)),
    });
    const m = ab.buildReport({ entries, tasks: SIZED, method: METHOD }).repetitions.metrics.in;
    assert.deepStrictEqual([m.reps[0].workload.n, m.reps[1].workload.n], [4, 3]);
    assert.deepStrictEqual([m.reps[0].typical.n, m.reps[1].typical.n], [4, 3]);
    near(m.reps[1].workload.change, -0.5, 1e-6);
    assert.deepStrictEqual([m.reps[1].workload.without, m.reps[1].workload.with], [260000, 130000], 'the big task is in neither sum');
  });

  await test('a completed run that reported no usage drops its pair from the usage metrics; it is never a zero', async () => {
    const mult = { 1: every(0.5), 2: every(0.5) };
    const silent = (job) => (job.run === 2 && job.arm === 'with' && job.task.id === 'big'
      ? { usage: null, usageSource: 'unavailable', cost: { usd: null, source: 'unavailable' } } : {});
    const rp = (await sizedReport(mult, silent)).repetitions;
    // Without the silent pair, repetition 2 is the three smaller tasks. Output is 10 tokens in both arms, so the total is not exactly half;
    // and the stub already halves SigMap's price, so cost is a quarter.
    const expected = { in: -0.5, costUsd: -0.75, totalTokens: 130030 / 260030 - 1 };
    for (const key of Object.keys(expected)) {
      assert.deepStrictEqual(rp.metrics[key].reps.map((r) => r.workload.n), [4, 3], `${key}: the silent run's pair is not counted`);
      near(rp.metrics[key].reps[1].workload.change, expected[key]);
    }
    assert.deepStrictEqual(rp.metrics.toolCalls.reps.map((r) => r.workload.n), [4, 4], 'a metric it did report keeps its pair');
  });

  await test('total tokens is the sum of the four billing categories, and unknown if any one is unknown', () => {
    const total = ab.METRICS.find((m) => m.key === 'totalTokens');
    assert.ok(/derived/.test(total.label) && /unweighted/.test(total.provenance), 'it is labelled as derived and unweighted');
    assert.strictEqual(total.pick({ usage: { in: 1, out: 2, cacheRead: 3, cacheWrite: 4 } }), 10);
    assert.strictEqual(total.pick({ usage: { in: 1, out: 2, cacheRead: null, cacheWrite: 4 } }), null, 'not the sum of the three that reported');
    assert.strictEqual(total.pick({ usage: null }), null);
    assert.strictEqual(total.pick({}), null);
  });

  await test('hit@5 is counted per repetition as better / worse / tie, only over pairs both arms completed', async () => {
    const miss = '`z.js`';
    const over = (job) => {
      if (job.run === 1 && job.task.id === 'big' && job.arm === 'with') return { answer: miss };
      if (job.run === 2 && job.task.id === 'mid' && job.arm === 'without') return { answer: miss };
      if (job.run === 2 && job.task.id === 'small' && job.arm === 'with') return { ok: false, error: 'timeout', init: null, cwds: [], durationMs: 1 };
      return {};
    };
    const rp = (await sizedReport({ 1: every(0.5), 2: every(0.5) }, over)).repetitions;
    assert.deepStrictEqual(rp.outcome.reps, [
      { run: 1, tasks: 4, better: 0, worse: 1, ties: 3 },
      { run: 2, tasks: 3, better: 1, worse: 0, ties: 2 },
    ]);
    assert.deepStrictEqual(rp.outcome.total, { tasks: 7, better: 1, worse: 1, ties: 5 });
  });

  await test('the repetition section renders: tables, the noise mark, the derived total, no NaN, deterministic', async () => {
    const mult = { 1: { big: 1.3, mid: 0.6, small: 0.55, tiny: 0.5 }, 2: { big: 1.2, mid: 0.7, small: 0.6, tiny: 0.65 } };
    const report = await sizedReport(mult);
    const md = ab.renderMarkdown(report);
    assert.match(md, /## Repetitions — workload total vs typical task/);
    assert.match(md, /### Workload total/);
    assert.match(md, /### Typical task/);
    assert.match(md, /### Outcome \(hit@5\), by repetition/);
    assert.match(md, /\| Input tokens \(uncached\) \| \+15% \| \+9% \| more in every repetition \|/);
    assert.match(md, /\| Input tokens \(uncached\) \| −32% \[−\d+%, \+\d+%\] † \| −24% \[−\d+%, \+\d+%\] † \| fewer in every repetition, within the noise \|/);
    assert.match(md, /\| Cost \| −42% \| −45% \| fewer in every repetition \|/);
    assert.match(md, /Total tokens \(derived\)/);
    assert.match(md, /resamples, seed 1/);
    assert.ok(report.caveats.some((c) => /neither is a correction/.test(c)) && md.includes('inside the noise'));
    assert.ok(!/NaN|undefined|Infinity/.test(md), 'no unformatted number reaches the report');
    assert.ok(!/\| Cache-read tokens \|/.test(md.slice(md.indexOf('## Repetitions'), md.indexOf('### Outcome'))), 'a row with nothing estimable is left out');
    const again = ab.buildReport({ entries: await ab.runPlan({ tasks: SIZED, runs: 2, runner: sizedRunner(mult) }), tasks: SIZED, method: METHOD });
    assert.strictEqual(ab.renderMarkdown(again), md, 'the same runs render the same text');
    assert.deepStrictEqual(report.repetitions.bootstrap, { iterations: 10000, seed: 1, level: 0.95 });
  });

  await test('a report saved before the repetition section existed still renders', async () => {
    const report = await sizedReport({ 1: every(0.5), 2: every(0.5) });
    const old = JSON.parse(JSON.stringify(report));
    delete old.repetitions;
    const md = ab.renderMarkdown(old);
    assert.ok(!md.includes('## Repetitions') && md.includes('## Outcome'));
  });

  for (const d of tmpDirs) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (_) { /* best effort */ } }
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})();
