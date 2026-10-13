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
  });

  // ── guards ─────────────────────────────────────────────────────────────────

  await test('the harness never spawns through a shell and stays out of the published package and CI', () => {
    const files = ['scripts/run-agent-ab.mjs', 'scripts/lib/agent-ab.mjs', 'scripts/lib/agent-ab-claude.mjs', 'scripts/lib/agent-ab-arms.mjs'];
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

  for (const d of tmpDirs) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (_) { /* best effort */ } }
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})();
