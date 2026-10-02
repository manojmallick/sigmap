'use strict';

/**
 * Three defects on the `ask` surface, fixed together (#835).
 *
 * #814 — `ask` emitted signatures only, so an agent needing a body opened the
 * whole file: the cost the map exists to avoid, handed back one level down.
 * `--with-source` slices the top symbols from their `:start-end` anchors
 * instead, budgeted and with the blast radius attached. Opt-in, because
 * anything that adds tokens has to be asked for.
 *
 * #815 — `judge` has warned since v8.54.2 (#780) when the context is older
 * than the sources it describes. `ask` and the MCP read tools answered from
 * the same ground in silence, so a stale answer was byte-indistinguishable
 * from a fresh one. All three now share one definition of "stale".
 *
 * #806 — `ask` printed `Coverage : 100%` and `Risk : NONE` over a selection
 * holding a test, a README and a CI workflow. Both readings were defensible
 * alone; together, under the answer, they read as "this is trustworthy".
 * Coverage now names its population, risk names its basis or says it did not
 * run, and a selection with no implementation in it says so.
 *
 * Run: node test/integration/ask-source-and-honesty.test.js
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const GEN = path.join(ROOT, 'gen-context.js');

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); console.log(`  PASS  ${name}`); pass++; }
  catch (e) { console.log(`  FAIL  ${name}\n        ${e.message}`); fail++; }
}

/** stdout + stderr — the warnings go to stderr, the table to stdout. */
const run = (dir, args) => {
  const r = spawnSync(process.execPath, [GEN, ...args], { cwd: dir, encoding: 'utf8', timeout: 60000 });
  return { out: r.stdout || '', err: r.stderr || '', all: (r.stdout || '') + (r.stderr || '') };
};

/** Parse the `--json` surface, ignoring anything written to stderr. */
const askJson = (dir, args) => {
  const r = run(dir, args);
  const line = r.out.trim().split('\n').filter((l) => l.startsWith('{')).pop();
  assert.ok(line, `no JSON on stdout: ${r.all.slice(0, 400)}`);
  return JSON.parse(line);
};

const mcp = (dir, name, args) => {
  const req = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } });
  let out = '';
  try {
    out = execFileSync(process.execPath, [GEN, '--mcp'], { cwd: dir, input: req + '\n', encoding: 'utf8', stdio: 'pipe', timeout: 60000 });
  } catch (e) { out = e.stdout || ''; }
  for (const line of out.split('\n').filter(Boolean)) {
    try {
      const j = JSON.parse(line);
      const t = j.result && j.result.content && j.result.content[0] && j.result.content[0].text;
      if (t) return t;
    } catch (_) { /* not a JSON-RPC line */ }
  }
  return '';
};

/** A repo whose srcDirs hold real implementation, indexed and fresh. */
function makeSourceRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-ask-src-'));
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'src', 'router.js'),
    '/** Dispatch a request through the middleware chain. */\n'
    + 'function dispatchMiddleware(request, chain) {\n'
    + '  let index = 0;\n'
    + '  const next = () => {\n'
    + '    const handler = chain[index++];\n'
    + '    return handler ? handler(request, next) : request;\n'
    + '  };\n'
    + '  return next();\n'
    + '}\n\n'
    + 'function registerRoute(table, method, routePath, handler) {\n'
    + '  table[`${method} ${routePath}`] = handler;\n'
    + '  return table;\n'
    + '}\n\n'
    + 'module.exports = { dispatchMiddleware, registerRoute };\n');
  fs.writeFileSync(path.join(dir, 'src', 'server.js'),
    "const { dispatchMiddleware } = require('./router');\n"
    + 'function handleRequest(request, chain) {\n'
    + '  return dispatchMiddleware(request, chain);\n'
    + '}\n'
    + 'module.exports = { handleRequest };\n');
  fs.writeFileSync(path.join(dir, 'gen-context.config.json'),
    JSON.stringify({ srcDirs: ['src'], outputs: ['copilot'], maxTokens: 6000 }));
  run(dir, []); // generate the index
  return dir;
}

/** A repo whose only indexable content is a test, docs and CI — no source. */
function makeSupportOnlyRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-ask-support-'));
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
  fs.mkdirSync(path.join(dir, '.github', 'workflows'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'src', 'telemetry.test.js'),
    'describe("telemetry", () => {\n'
    + '  it("records a zeppelin heartbeat", () => {\n'
    + '    expect(zeppelinHeartbeat()).toBe(1);\n'
    + '  });\n'
    + '});\n');
  fs.writeFileSync(path.join(dir, 'src', 'README.md'),
    '# Zeppelin heartbeat\n\nHow the zeppelin heartbeat telemetry is recorded.\n');
  fs.writeFileSync(path.join(dir, '.github', 'workflows', 'ci.yml'),
    'name: zeppelin heartbeat\non: [push]\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - run: npm test\n');
  fs.writeFileSync(path.join(dir, 'gen-context.config.json'),
    JSON.stringify({ srcDirs: ['src'], outputs: ['copilot'], maxTokens: 6000 }));
  run(dir, []);
  return dir;
}

/** The same repo, under git, with one uncommitted edit — so a risk check runs. */
function makeGitSourceRepo() {
  const dir = makeSourceRepo();
  const g = (args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8', stdio: 'pipe' });
  // `.context/` is gitignored, as `sigmap --init` sets up: without it every
  // `ask` rewrites query-context.md and counts itself as a changed file.
  fs.writeFileSync(path.join(dir, '.gitignore'), '.context/\n');
  g(['init', '-q', '.']);
  g(['config', 'user.email', 't@t']);
  g(['config', 'user.name', 'T']);
  g(['add', '-A']);
  g(['commit', '-qm', 'base']);
  fs.appendFileSync(path.join(dir, 'src', 'server.js'), '\n// edited\n');
  return dir;
}

/** Make the newest source file strictly newer than the generated context. */
function ageTheIndex(dir, relFile) {
  const future = new Date(Date.now() + 5 * 3600 * 1000);
  fs.utimesSync(path.join(dir, relFile), future, future);
}

// ---------------------------------------------------------------------------
// #814 — ask --with-source
// ---------------------------------------------------------------------------

test('--with-source adds top-symbol bodies, sliced from the line anchors', () => {
  const dir = makeSourceRepo();
  const r = run(dir, ['ask', 'how does the middleware chain dispatch a request', '--with-source']);
  const ctx = fs.readFileSync(path.join(dir, '.context', 'query-context.md'), 'utf8');
  assert.ok(/## Source \(top symbols\)/.test(ctx), `no source section written: ${ctx.slice(0, 400)}`);
  assert.ok(/function dispatchMiddleware\(request, chain\) \{/.test(ctx),
    `the body itself must be present, not just its signature: ${ctx.slice(0, 600)}`);
  assert.ok(/### src\/router\.js:\d+-\d+/.test(ctx),
    `each block must carry the anchor it was sliced from: ${ctx.slice(0, 600)}`);
  assert.ok(/ Source    :/.test(r.out), `the summary must report what was included: ${r.out}`);
});

test('a blast-radius list accompanies the bodies', () => {
  const dir = makeSourceRepo();
  run(dir, ['ask', 'how does the middleware chain dispatch a request', '--with-source']);
  const ctx = fs.readFileSync(path.join(dir, '.context', 'query-context.md'), 'utf8');
  assert.ok(/## Blast radius/.test(ctx), `no blast radius: ${ctx.slice(-600)}`);
  assert.ok(/src\/router\.js\s+←\s+\d+ direct, \d+ total dependent file\(s\)/.test(ctx),
    `blast radius must name the file and its dependent counts: ${ctx.slice(-600)}`);
});

test('default ask is unchanged — no source section, no blast radius, no Source line', () => {
  const dir = makeSourceRepo();
  const r = run(dir, ['ask', 'how does the middleware chain dispatch a request']);
  const ctx = fs.readFileSync(path.join(dir, '.context', 'query-context.md'), 'utf8');
  assert.ok(!/## Source \(top symbols\)/.test(ctx), `default run must not write bodies: ${ctx}`);
  assert.ok(!/## Blast radius/.test(ctx), `default run must not write a blast radius: ${ctx}`);
  assert.ok(!/ Source    :/.test(r.out), `default run must not print a Source line: ${r.out}`);
  assert.ok(/function dispatchMiddleware/.test(ctx), 'signatures must still be there');
});

test('the same query with and without --with-source differs only by the addendum', () => {
  const dir = makeSourceRepo();
  const q = 'how does the middleware chain dispatch a request';
  run(dir, ['ask', q]);
  const plain = fs.readFileSync(path.join(dir, '.context', 'query-context.md'), 'utf8');
  run(dir, ['ask', q, '--with-source']);
  const withSrc = fs.readFileSync(path.join(dir, '.context', 'query-context.md'), 'utf8');
  // Both carry a fresh `Generated:` timestamp; compare everything after it.
  const strip = (s) => s.replace(/^Generated:.*$/m, '');
  assert.ok(withSrc.length > plain.length, 'the addendum must add content');
  assert.ok(strip(withSrc).startsWith(strip(plain).replace(/\s+$/, '')),
    'the signature context must be prefix-identical — --with-source appends, it does not rewrite');
});

test('over-budget truncation is disclosed, never silent', () => {
  const dir = makeSourceRepo();
  const j = askJson(dir, ['ask', 'how does the middleware chain dispatch a request',
    '--with-source', '--source-budget', '40', '--json']);
  assert.ok(j.source, '--json must carry the source report');
  assert.strictEqual(j.source.budgetTokens, 40, 'the explicit budget must be honoured');
  assert.ok(j.source.skipped > 0, `a 40-token budget must skip symbols: ${JSON.stringify(j.source)}`);
  assert.strictEqual(j.source.truncated, true, 'truncation must be flagged');
  assert.ok(j.source.spentTokens <= j.source.budgetTokens,
    `spend ${j.source.spentTokens} exceeded budget ${j.source.budgetTokens}`);

  const r = run(dir, ['ask', 'how does the middleware chain dispatch a request',
    '--with-source', '--source-budget', '40']);
  const ctx = fs.readFileSync(path.join(dir, '.context', 'query-context.md'), 'utf8');
  assert.ok(/omitted to stay within the .*-token source budget/.test(ctx) || /omitted \(over budget\)/.test(r.out),
    `truncation must be visible to the reader: ${r.out}\n---\n${ctx.slice(-400)}`);
});

test('a bodyless export list never takes a budget slot', () => {
  const { collectSymbols } = require(path.join(ROOT, 'src', 'retrieval', 'with-source.js'));
  const syms = collectSymbols([{
    file: 'src/router.js',
    sigs: [
      'module.exports = { dispatchMiddleware, registerRoute }  :15-15',
      'function dispatchMiddleware(request, chain)  :2-9',
    ],
  }], { maxPerFile: 2 });
  assert.deepStrictEqual(syms.map((s) => s.head), ['function dispatchMiddleware(request, chain)'],
    'the export list is already in the signature section — slicing it back out spends budget to repeat it');
});

// ---------------------------------------------------------------------------
// #815 — stale-index banner on ask and MCP
// ---------------------------------------------------------------------------

test('a fresh index produces no staleness banner on ask', () => {
  const dir = makeSourceRepo();
  const r = run(dir, ['ask', 'how does the middleware chain dispatch a request']);
  assert.ok(!/stale ground/.test(r.all), `fresh index must stay silent: ${r.all}`);
  const j = askJson(dir, ['ask', 'how does the middleware chain dispatch a request', '--json']);
  assert.strictEqual(j.stale, false);
  assert.strictEqual(j.staleWarning, null);
});

test('ask warns when the context is older than the newest source, naming the gap', () => {
  const dir = makeSourceRepo();
  ageTheIndex(dir, path.join('src', 'router.js'));
  const r = run(dir, ['ask', 'how does the middleware chain dispatch a request']);
  assert.ok(/stale ground/.test(r.err), `ask must warn: ${r.all}`);
  assert.ok(/router\.js/.test(r.err), `the warning must name the newer file: ${r.err}`);
  assert.ok(/\d+(\.\d+)? hour\(s\)|\d+ minute\(s\)|\d+(\.\d+)? day\(s\)/.test(r.err),
    `the warning must name the gap: ${r.err}`);
  const j = askJson(dir, ['ask', 'how does the middleware chain dispatch a request', '--json']);
  assert.strictEqual(j.stale, true);
  assert.ok(/stale ground/.test(j.staleWarning || ''), 'the JSON surface must carry it too');
});

test('a fresh index produces no staleness banner on the MCP read tools', () => {
  const dir = makeSourceRepo();
  for (const [name, args] of [
    ['read_context', {}],
    ['search_signatures', { query: 'dispatchMiddleware' }],
    ['query_context', { query: 'middleware chain' }],
  ]) {
    const text = mcp(dir, name, args);
    assert.ok(text, `${name} returned nothing`);
    assert.ok(!/stale ground/.test(text), `${name} must stay silent on a fresh index: ${text.slice(0, 200)}`);
  }
});

test('the MCP read tools carry the same stale signal as ask', () => {
  const dir = makeSourceRepo();
  ageTheIndex(dir, path.join('src', 'router.js'));
  for (const [name, args] of [
    ['read_context', {}],
    ['search_signatures', { query: 'dispatchMiddleware' }],
    ['query_context', { query: 'middleware chain' }],
  ]) {
    const text = mcp(dir, name, args);
    assert.ok(/stale ground/.test(text), `${name} must warn: ${text.slice(0, 300)}`);
    assert.ok(/router\.js/.test(text), `${name} must name the newer file: ${text.slice(0, 300)}`);
  }
});

test('"stale" has one definition, shared by judge, ask and MCP', () => {
  const cs = require(path.join(ROOT, 'src', 'judge', 'context-source.js'));
  const st = { stale: true, gapMs: 7200000, newest: 'src/router.js' };
  const judge = cs.stalenessWarning(st);
  const ask = cs.stalenessWarning(st, { tail: cs.STALE_TAILS.ask });
  const forMcp = cs.stalenessWarning(st, { tail: cs.STALE_TAILS.mcp });
  // The measurement is shared; only the consequence clause differs by surface.
  const prefix = 'context is 2 hour(s) older than src/router.js — ';
  for (const [label, line] of [['judge', judge], ['ask', ask], ['mcp', forMcp]]) {
    assert.ok(line.startsWith(prefix), `${label} must share the measurement wording: ${line}`);
  }
  // judge's own output is byte-identical to what #780 shipped.
  assert.strictEqual(judge, `${prefix}the answer is being judged against stale ground`);
  assert.strictEqual(cs.stalenessWarning({ stale: false, gapMs: 0, newest: 'x' }), null);
  assert.strictEqual(cs.stalenessWarning(null), null);

  // One owner, not one per surface: the CLI and the MCP handlers must both
  // route through this module rather than re-deriving the threshold.
  const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const handlers = code(fs.readFileSync(path.join(ROOT, 'src', 'mcp', 'handlers.js'), 'utf8'));
  assert.ok(/judge\/context-source/.test(handlers),
    'the MCP handlers must reuse context-source, not grow a second staleness rule');
});

// ---------------------------------------------------------------------------
// #806 — honest coverage, honest risk, and a missed query that says so
// ---------------------------------------------------------------------------

test('the coverage line names its population, numerator and denominator', () => {
  const dir = makeSourceRepo();
  const r = run(dir, ['ask', 'how does the middleware chain dispatch a request']);
  assert.ok(!/ Coverage  : \d+%$/m.test(r.out), `a bare percentage is the defect: ${r.out}`);
  assert.ok(/ Coverage  : readable \d+% \(\d+\/\d+ files in srcDirs\)/.test(r.out),
    `coverage must name its population: ${r.out}`);
  const j = askJson(dir, ['ask', 'how does the middleware chain dispatch a request', '--json']);
  assert.strictEqual(j.coveragePopulation, 'readable');
  assert.ok(typeof j.coverageIncluded === 'number' && typeof j.coverageTotal === 'number',
    'the JSON surface must carry the population bounds');
  assert.ok(/NOT whether the query found the right files/.test(j.coverageBasis || ''),
    'the JSON surface must say what the figure does not mean');
});

test('Risk names the basis it was measured from when a check ran', () => {
  const dir = makeGitSourceRepo();
  const r = run(dir, ['ask', 'how does the middleware chain dispatch a request']);
  assert.ok(/ Risk      : (NONE|LOW|MEDIUM|HIGH) \(\d+ file\(s\) changed vs HEAD\)/.test(r.out),
    `risk must name its basis: ${r.out}`);
  const j = askJson(dir, ['ask', 'how does the middleware chain dispatch a request', '--json']);
  assert.strictEqual(j.riskAssessed, true);
  assert.ok(j.riskChangedFiles >= 1, `the edit must be counted: ${j.riskChangedFiles}`);
  assert.ok(/files changed in the working tree vs HEAD/.test(j.riskBasis || ''),
    'the JSON surface must name the basis too');
  // The rendered count and the JSON count are one measurement, not two.
  const shown = /Risk      : \w+ \((\d+) file\(s\) changed vs HEAD\)/.exec(r.out);
  assert.ok(shown, `risk line must carry a count: ${r.out}`);
  assert.strictEqual(Number(shown[1]), j.riskChangedFiles,
    'the table and the JSON must report the same number');
});

test('a clean git tree reads NONE with its basis, not a bare NONE', () => {
  const dir = makeSourceRepo();
  const g = (args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8', stdio: 'pipe' });
  fs.writeFileSync(path.join(dir, '.gitignore'), '.context/\n');
  g(['init', '-q', '.']); g(['config', 'user.email', 't@t']); g(['config', 'user.name', 'T']);
  g(['add', '-A']); g(['commit', '-qm', 'base']);
  const r = run(dir, ['ask', 'how does the middleware chain dispatch a request']);
  // The #806 repro exactly: a clean checkout. NONE is now qualified by what
  // was counted, so it can no longer be read as "this answer is safe".
  assert.ok(/ Risk      : NONE \(0 file\(s\) changed vs HEAD\)/.test(r.out),
    `a clean tree must still say what was counted: ${r.out}`);
});

test('Risk reads "not assessed" when no check could run', () => {
  // No git repo at all — the probe throws, and the old code still printed a
  // reassuring level next to it.
  const dir = makeSourceRepo();
  const r = run(dir, ['ask', 'how does the middleware chain dispatch a request']);
  assert.ok(!/ Risk      : NONE$/m.test(r.out),
    `an unqualified NONE is the defect this closes: ${r.out}`);
  const j = askJson(dir, ['ask', 'how does the middleware chain dispatch a request', '--json']);
  assert.strictEqual(j.riskAssessed, false,
    'outside a git repo nothing was assessed, and the JSON must say so');
  assert.strictEqual(j.riskChangedFiles, null);
  assert.ok(/ Risk      : not assessed/.test(r.out), `must read "not assessed": ${r.out}`);
});

test('a selection with no source file emits a visible warning', () => {
  const dir = makeSupportOnlyRepo();
  const r = run(dir, ['ask', 'how is the zeppelin heartbeat recorded']);
  assert.ok(/no source file in the selection/.test(r.err),
    `a test/docs/CI-only selection must warn: ${r.all}`);
  const j = askJson(dir, ['ask', 'how is the zeppelin heartbeat recorded', '--json']);
  assert.strictEqual(j.sourceFree, true);
  assert.strictEqual(j.sourceFiles, 0);
  assert.ok(j.supportFiles > 0, `support files must be counted: ${JSON.stringify(j)}`);
});

test('a source-bearing selection does not warn', () => {
  const dir = makeSourceRepo();
  const r = run(dir, ['ask', 'how does the middleware chain dispatch a request']);
  assert.ok(!/no source file in the selection/.test(r.all),
    `a healthy selection must not cry wolf: ${r.all}`);
  const j = askJson(dir, ['ask', 'how does the middleware chain dispatch a request', '--json']);
  assert.strictEqual(j.sourceFree, false);
  assert.ok(j.sourceFiles > 0);
  assert.ok(/ Selection : \d+ source/.test(r.out), `the composition must be named: ${r.out}`);
});

test('the gin selection from #806 is classified as it reads', () => {
  const { classifySelection, formatComposition } =
    require(path.join(ROOT, 'src', 'retrieval', 'selection-quality.js'));
  // The exact five files the issue reported, under Coverage 100% / Risk NONE.
  const c = classifySelection([
    'ginS/gins.go', 'ginS/gins_test.go', 'ginS/README.md',
    '.github/workflows/gin.yml', 'binding/form.go',
  ]);
  assert.deepStrictEqual(c.source, ['ginS/gins.go', 'binding/form.go']);
  assert.strictEqual(c.support.length, 3);
  assert.strictEqual(c.sourceFree, false, 'two real sources were present — the warning must not fire here');
  assert.strictEqual(formatComposition(c), '2 source, 3 support (test, docs, ci)',
    'the composition is what the user could not see');
});

test('an all-support selection is recognised across every support class', () => {
  const { classifySelection } = require(path.join(ROOT, 'src', 'retrieval', 'selection-quality.js'));
  for (const f of ['src/a.test.js', 'src/__mocks__/a.js', 'docs/guide.md', 'README.md',
                   '.github/workflows/ci.yml', 'tsconfig.json', 'webpack.config.js',
                   'src/api.generated.ts', 'notes.txt']) {
    const c = classifySelection([f]);
    assert.strictEqual(c.sourceFree, true, `${f} must not count as implementation`);
  }
  for (const f of ['src/router.js', 'cmd/main.go', 'app/views.py', 'lib/Parser.kt']) {
    const c = classifySelection([f]);
    assert.strictEqual(c.sourceFree, false, `${f} is implementation`);
  }
});

// ---------------------------------------------------------------------------

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
