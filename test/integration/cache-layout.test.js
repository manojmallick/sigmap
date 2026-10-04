'use strict';

/**
 * Cache-stable context layout (#683).
 *
 * A prefix cache hits only while the bytes up to a point are identical, so the
 * generated context must put everything that changes per commit — and every
 * wall-clock stamp — AFTER all stable content. These tests pin the properties,
 * not one rendering: the order in every written output, byte-identical reruns,
 * the two-block cache payload, the TTL enum, and the per-model fit-check
 * (including that it never gives a confident verdict inside the borderline band).
 *
 * Run: node test/integration/cache-layout.test.js
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const assert = require('assert');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const GEN_CONTEXT = path.join(ROOT, 'gen-context.js');
const layout = require(path.join(ROOT, 'src/format/cache-layout'));
const models = require(path.join(ROOT, 'src/config/models'));

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  PASS  ${name}`); passed++; }
  catch (e) { console.log(`  FAIL  ${name}\n        ${e.message}`); failed++; }
}

const OUTPUTS = ['copilot', 'claude', 'gemini', 'codex', 'openai', 'cursor', 'windsurf'];
const FILES = {
  copilot: '.github/copilot-instructions.md',
  claude: 'CLAUDE.md',
  gemini: null, // resolved from the adapter below
  codex: 'AGENTS.md',
  openai: '.github/openai-context.md',
  cursor: '.cursorrules',
  windsurf: '.windsurfrules',
};
FILES.gemini = path.relative(ROOT, require(path.join(ROOT, 'packages/adapters/gemini')).outputPath(ROOT));

function git(cwd, args) {
  const r = spawnSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...args], { cwd, encoding: 'utf8' });
  assert.strictEqual(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`);
}

function makeRepo(config) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-layout-'));
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
  for (let i = 1; i <= 6; i++) {
    fs.writeFileSync(path.join(dir, 'src', `m${i}.js`), `function handler${i}(a, b) { return a + b; }\nmodule.exports = { handler${i} };\n`);
  }
  fs.writeFileSync(path.join(dir, 'gen-context.config.json'), JSON.stringify(Object.assign({ outputs: OUTPUTS, srcDirs: ['src'], changesCommits: 2 }, config)));
  git(dir, ['init', '-q', '-b', 'develop']);
  git(dir, ['add', '-A']);
  git(dir, ['commit', '-qm', 'one']);
  fs.appendFileSync(path.join(dir, 'src', 'm1.js'), 'function extra() {}\n');
  git(dir, ['commit', '-qam', 'two']);
  return dir;
}

function run(dir, args = []) {
  return spawnSync('node', [GEN_CONTEXT, ...args], { cwd: dir, encoding: 'utf8' });
}

const read = (dir, rel) => fs.readFileSync(path.join(dir, rel), 'utf8');
// The only run-to-run difference allowed in a written file is a stamp line.
const unstamped = (s) => s.split('\n').filter((l) => !/Updated:|Generated: /.test(l)).join('\n');
// File headings only: the volatile tail (routing hints) has `###` headings of its own.
const lastSigHeading = (s) => s.lastIndexOf('\n### src/');

function cleanup(dir) { fs.rmSync(dir, { recursive: true, force: true }); }

// ---------------------------------------------------------------------------
console.log('\nUnit — resolveLayout / resolveTtl\n');

test('cacheLayout defaults to stable-prefix and accepts exactly the two values', () => {
  assert.strictEqual(layout.resolveLayout({}).value, 'stable-prefix');
  assert.strictEqual(layout.resolveLayout({ cacheLayout: 'legacy' }).value, 'legacy');
  assert.strictEqual(layout.resolveLayout({ cacheLayout: 'nope' }).value, 'stable-prefix');
  assert.strictEqual(layout.resolveLayout({ cacheLayout: 'nope' }).invalid, 'nope');
});

test('cacheTtl accepts exactly "5m" and "1h"; anything else is reported and defaults', () => {
  assert.strictEqual(layout.resolveTtl({ cacheTtl: '1h' }).value, '1h');
  assert.strictEqual(layout.resolveTtl({ cacheTtl: '5m' }).value, '5m');
  for (const bad of ['10m', '1H', '60m', 3600, '', true]) {
    const r = layout.resolveTtl({ cacheTtl: bad });
    assert.strictEqual(r.value, '5m', `${JSON.stringify(bad)} must fall back to 5m`);
    assert.strictEqual(r.invalid, String(bad));
  }
  assert.strictEqual(layout.resolveTtl({}).invalid, null);
});

// ---------------------------------------------------------------------------
console.log('\nUnit — fitCheck against the model profile\n');

const profile = models.resolveProfile({});
const M = 'claude-sonnet-5-5';
const min = profile.models[M].cacheMin;
const textOf = (tokens) => 'x'.repeat(tokens * 4); // chars/4 is the default basis
const verdictFor = (tokens, p = profile) => layout.fitCheck(textOf(tokens), p).find((r) => r.model === M).verdict;

test('the fit-check minimum is the profile value — no literal of its own', () => {
  for (const r of layout.fitCheck(textOf(100), profile)) {
    assert.strictEqual(r.cacheMin, profile.models[r.model].cacheMin, r.model);
  }
});

test('below / borderline / fits across the ±15% band', () => {
  assert.strictEqual(verdictFor(Math.floor(min * 0.5)), 'below');
  assert.strictEqual(verdictFor(Math.floor(min * 0.85) - 1), 'below');
  assert.strictEqual(verdictFor(Math.ceil(min * 0.86)), 'borderline');
  assert.strictEqual(verdictFor(min), 'borderline');
  assert.strictEqual(verdictFor(Math.floor(min * 1.14)), 'borderline');
  assert.strictEqual(verdictFor(Math.ceil(min * 1.16)), 'fits');
  assert.strictEqual(verdictFor(min * 10), 'fits');
});

test('a borderline verdict says to verify with a provider token counter', () => {
  const row = layout.fitCheck(textOf(min), profile).find((r) => r.model === M);
  assert.ok(/verify with a provider token counter/.test(row.note), row.note);
  assert.ok(!/will not be cached/.test(row.note));
});

test('models with no verified cacheMin get no verdict', () => {
  const names = layout.fitCheck(textOf(min), profile).map((r) => r.model);
  assert.ok(!names.some((n) => n.startsWith('gpt-') || n.startsWith('gemini-')), names.join(','));
  assert.ok(names.includes(M));
});

test('a declared roster narrows the check to the roster', () => {
  const p = models.resolveProfile({ models: { roster: [M] } });
  assert.deepStrictEqual(layout.fitCheck(textOf(min), p).map((r) => r.model), [M]);
});

test('a project cacheMin override changes the verdict', () => {
  const p = models.resolveProfile({ models: { cacheMin: { [M]: 100000 } } });
  assert.strictEqual(verdictFor(min * 10, p), 'below');
});

test('a per-model charsPerToken changes the token count', () => {
  const p = models.resolveProfile({ models: { charsPerToken: { [M]: 2 } } });
  const row = layout.fitCheck('x'.repeat(2000), p).find((r) => r.model === M);
  assert.strictEqual(row.tokens, 1000);
  assert.strictEqual(row.estimated, false);
});

test('splitVolatile cuts at the marker and drops it', () => {
  const s = layout.splitVolatile(`body\n\n${layout.VOLATILE_MARKER}\ntail\n`);
  assert.strictEqual(s.split, true);
  assert.strictEqual(s.stable, 'body\n');
  assert.strictEqual(s.volatile, 'tail\n');
  assert.strictEqual(layout.splitVolatile('no marker').split, false);
});

// ---------------------------------------------------------------------------
console.log('\nIntegration — default stable-prefix layout, every written output\n');

{
  const dir = makeRepo();
  const first = run(dir);
  test('generation succeeds', () => assert.strictEqual(first.status, 0, first.stderr));

  for (const target of OUTPUTS) {
    const rel = FILES[target];
    test(`${target}: volatile content renders after every signature`, () => {
      const out = read(dir, rel);
      const marker = out.indexOf(layout.VOLATILE_MARKER);
      assert.ok(marker !== -1, `${rel} has no volatile marker`);
      assert.ok(marker > lastSigHeading(out), 'the marker precedes a signature section');
      const changes = out.indexOf('## recent changes');
      assert.ok(changes > marker, 'recent changes must sit after the marker');
    });

    test(`${target}: no wall-clock stamp ahead of the signature body`, () => {
      const out = read(dir, rel);
      const firstSig = out.indexOf('\n### ');
      const head = out.slice(0, firstSig);
      assert.ok(!/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(head), `a timestamp precedes the signatures in ${rel}`);
    });

    test(`${target}: no relative age anywhere`, () => {
      assert.ok(!/\d+ (second|minute|hour|day)s? ago/.test(read(dir, rel)), rel);
    });
  }

  test('recent changes is identified by branch@commit', () => {
    const head = spawnSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: dir, encoding: 'utf8' }).stdout.trim();
    assert.ok(read(dir, FILES.copilot).includes(`## recent changes (develop@${head})`));
  });

  test('a second run is byte-identical apart from stamp lines', () => {
    const before = {};
    for (const t of OUTPUTS) before[t] = unstamped(read(dir, FILES[t]));
    assert.strictEqual(run(dir).status, 0);
    for (const t of OUTPUTS) assert.strictEqual(unstamped(read(dir, FILES[t])), before[t], `${t} drifted between runs`);
  });

  test('a new commit changes only what follows the marker', () => {
    const stableOf = (rel) => layout.splitVolatile(read(dir, rel)).stable;
    const before = stableOf(FILES.copilot);
    fs.appendFileSync(path.join(dir, 'src', 'm2.js'), '\n// touched\n');
    git(dir, ['commit', '-qam', 'three']);
    assert.strictEqual(run(dir).status, 0);
    assert.strictEqual(stableOf(FILES.copilot), before, 'a commit must not disturb the stable prefix');
  });

  cleanup(dir);
}

// ---------------------------------------------------------------------------
console.log('\nIntegration — routing hints are volatile tail\n');

{
  const dir = makeRepo({ routing: true, outputs: ['copilot'] });
  assert.strictEqual(run(dir).status, 0);
  test('routing hints render after the marker', () => {
    const out = read(dir, FILES.copilot);
    const marker = out.indexOf(layout.VOLATILE_MARKER);
    const routing = out.indexOf('## Model routing hints');
    assert.ok(routing !== -1, 'routing section missing');
    assert.ok(routing > marker && marker > lastSigHeading(out));
  });
  cleanup(dir);
}

// ---------------------------------------------------------------------------
console.log('\nIntegration — legacy layout is the opt-out\n');

{
  const dir = makeRepo({ cacheLayout: 'legacy', outputs: ['copilot'] });
  assert.strictEqual(run(dir).status, 0);
  const out = read(dir, FILES.copilot);
  test('legacy keeps recent changes ahead of the signatures and writes no marker', () => {
    assert.ok(!out.includes(layout.VOLATILE_MARKER));
    assert.ok(out.indexOf('## recent changes') !== -1 && out.indexOf('## recent changes') < out.indexOf('\n### '));
  });
  test('legacy still never writes a relative age', () => {
    assert.ok(!/\d+ (second|minute|hour|day)s? ago/.test(out));
  });
  test('legacy has no fit-check (there is no stable prefix to measure)', () => {
    const r = JSON.parse(run(dir, ['--report', '--json']).stdout);
    assert.strictEqual(r.cacheFit, undefined);
  });
  cleanup(dir);
}

test('an invalid cacheLayout warns and falls back to stable-prefix', () => {
  const dir = makeRepo({ cacheLayout: 'sideways', outputs: ['copilot'] });
  const r = run(dir);
  assert.ok(/cacheLayout "sideways" is not one of/.test(r.stderr), r.stderr);
  assert.ok(read(dir, FILES.copilot).includes(layout.VOLATILE_MARKER));
  cleanup(dir);
});

// ---------------------------------------------------------------------------
console.log('\nIntegration — --format cache payload\n');

{
  const dir = makeRepo({ cacheTtl: '1h', outputs: ['copilot'] });
  const r = run(dir, ['--format', 'cache']);
  const cache = JSON.parse(read(dir, '.github/copilot-instructions.cache.json'));

  test('stable block carries cache_control with the configured ttl; the tail carries none', () => {
    assert.strictEqual(cache.length, 2);
    assert.deepStrictEqual(cache[0].cache_control, { type: 'ephemeral', ttl: '1h' });
    assert.strictEqual(cache[1].cache_control, undefined);
    assert.ok(cache[1].text.startsWith('## recent changes'));
  });

  test('no volatile content leaks into the cached block', () => {
    assert.ok(!cache[0].text.includes('recent changes'));
    assert.ok(!cache[0].text.includes(layout.VOLATILE_MARKER));
  });

  test('the cache run prints the per-model fit-check', () => {
    assert.ok(/cache fit \(stable prefix; minimums as of /.test(r.stderr), r.stderr);
    assert.ok(/claude-sonnet-5-5\s+(below|borderline|fits)/.test(r.stderr), r.stderr);
  });
  cleanup(dir);
}

test('an invalid cacheTtl warns and the payload falls back to the 5m default', () => {
  const dir = makeRepo({ cacheTtl: '10m', outputs: ['copilot'] });
  const r = run(dir, ['--format', 'cache']);
  assert.ok(/cacheTtl "10m" is not one of "5m", "1h"/.test(r.stderr), r.stderr);
  const cache = JSON.parse(read(dir, '.github/copilot-instructions.cache.json'));
  assert.deepStrictEqual(cache[0].cache_control, { type: 'ephemeral' });
  cleanup(dir);
});

// ---------------------------------------------------------------------------
console.log('\nIntegration — --report fit-check\n');

{
  const dir = makeRepo({ outputs: ['copilot'] });
  test('--report prints the fit-check with the profile date', () => {
    const r = run(dir, ['--report']);
    assert.ok(/cache fit \(stable prefix; minimums as of \d{4}-\d{2}-\d{2}\)/.test(r.stdout), r.stdout);
  });
  test('--report --json carries cacheFit rows that match the profile', () => {
    const r = JSON.parse(run(dir, ['--report', '--json']).stdout);
    assert.strictEqual(r.cacheFit.layout, 'stable-prefix');
    assert.ok(r.cacheFit.models.length > 0);
    for (const m of r.cacheFit.models) {
      assert.strictEqual(m.cacheMin, profile.models[m.model].cacheMin, m.model);
      assert.ok(['below', 'borderline', 'fits'].includes(m.verdict));
    }
  });
  cleanup(dir);
}

console.log(`\n${'─'.repeat(50)}`);
console.log(`cache-layout: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
