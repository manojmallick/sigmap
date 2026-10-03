'use strict';

/**
 * A published snapshot proves its provenance and its basis (#854, closes #707, #811).
 *
 * `benchmarks/latest.json` is assembled from five committed reports, and
 * nothing recorded which release produced each one. Four of the five carried no
 * version at all, so a snapshot could pair figures from different releases
 * while every gate passed — `check:metrics` verifies latest.json against the
 * SAVED reports, never that a saved report belongs to the release being
 * stamped. v8.49 published a test-discovery F1 measured at v8.8.0; v8.61.2
 * published one measured the day before its own run, and `check:metrics` passed
 * four times across that release without objecting.
 *
 * The `source` field was the sharpest case: it listed four reports while the
 * generator read five, so the one field whose job was provenance had the wrong
 * provenance.
 *
 * Run: node test/integration/metric-provenance.test.js
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const GEN = path.join(ROOT, 'scripts', 'gen-benchmark-latest.mjs');
const REPORTS = path.join(ROOT, 'benchmarks', 'reports');

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); console.log(`  PASS  ${name}`); pass++; }
  catch (e) { console.log(`  FAIL  ${name}\n        ${e.message}`); fail++; }
}

const pkg = require(path.join(ROOT, 'package.json'));
const latest = require(path.join(ROOT, 'benchmarks', 'latest.json'));

/** The five reports the generator reads. */
const SOURCES = [
  'benchmark-matrix.json',
  'task-benchmark.json',
  'token-reduction.json',
  'honest-baseline.json',
  'test-discovery.json',
];

const minorLine = (v) => String(v).split('.').slice(0, 2).join('.');

console.log('[metric-provenance.test.js] a snapshot proves its provenance (#854)');
console.log('');

// ── every source is stamped ─────────────────────────────────────────────────

test('an unstamped report is declared unknown, never guessed', () => {
  // The transitional state is deliberate: writing a version into a report that
  // predates stamping would fabricate the fact being recorded, and refusing
  // outright would mean this guard could not land until every suite re-ran.
  for (const name of SOURCES) {
    const p = path.join(REPORTS, name);
    if (!fs.existsSync(p)) continue;
    const r = JSON.parse(fs.readFileSync(p, 'utf8'));
    const gen = r.generated || r.generatedAt || r.timestamp;
    assert.ok(gen, `${name} records no date at all — provenance cannot be unknown AND undated`);
    if (r.version) {
      assert.strictEqual(minorLine(r.version), minorLine(pkg.version),
        `${name} is stamped v${r.version}, which is not the v${minorLine(pkg.version)} line`);
    } else {
      assert.strictEqual(latest.sources[name].version, null,
        `${name} has no stamp, so the snapshot must publish version null rather than infer one`);
    }
  }
});

test('an unstamped source is warned about, not passed over silently', () => {
  const unstamped = SOURCES.filter((name) => {
    const f = path.join(REPORTS, name);
    return fs.existsSync(f) && !JSON.parse(fs.readFileSync(f, 'utf8')).version;
  });
  const run = spawnSync(process.execPath, [GEN, '--check'], {
    cwd: ROOT, encoding: 'utf8',
  });
  const combined = (run.stderr || '') + (run.stdout || '');
  if (unstamped.length === 0) {
    assert.ok(!/predate provenance stamping/.test(combined),
      'nothing is unstamped, so no warning should be emitted');
  } else {
    assert.match(combined, /predate provenance stamping/,
      `${unstamped.length} report(s) have unknown provenance and the generator said nothing`);
    for (const name of unstamped) {
      assert.ok(combined.includes(name), `the warning must name ${name}`);
    }
  }
});

test('every source report was produced on this release line', () => {
  const want = minorLine(pkg.version);
  const drifted = [];
  for (const name of SOURCES) {
    const p = path.join(REPORTS, name);
    if (!fs.existsSync(p)) continue;
    const r = JSON.parse(fs.readFileSync(p, 'utf8'));
    if (r.version && minorLine(r.version) !== want) drifted.push(`${name}@${r.version}`);
  }
  assert.deepStrictEqual(drifted, [],
    `these would publish as part of the v${want} snapshot: ${drifted.join(', ')}`);
});

// ── the snapshot publishes that provenance ──────────────────────────────────

test('latest.json publishes a sources block, not a hand-written string', () => {
  assert.ok(latest.sources && typeof latest.sources === 'object',
    'latest.json must carry a `sources` object');
  assert.strictEqual(typeof latest.source, 'undefined',
    'the hand-written `source` string listed four reports while five were read — it must not come back');
});

test('the sources block names every report the generator actually reads', () => {
  const declared = Object.keys(latest.sources).sort();
  const genSrc = fs.readFileSync(GEN, 'utf8');
  const read = [...genSrc.matchAll(/readReport(?:Optional)?\(root, '([^']+)'\)/g)].map((m) => m[1]).sort();
  const uniqRead = [...new Set(read)];
  assert.ok(uniqRead.length >= 4, `expected the generator to read several reports, found ${uniqRead.length}`);
  assert.deepStrictEqual(declared, uniqRead,
    'the declared sources and the reports the generator reads must be the same set');
});

test('each published source names its date, and its release or an explicit null', () => {
  for (const [name, prov] of Object.entries(latest.sources)) {
    if (prov === null) continue;                  // absent in this checkout
    assert.ok('version' in prov, `${name} must carry a version key, even if null`);
    if (prov.version !== null) {
      assert.strictEqual(minorLine(prov.version), minorLine(pkg.version),
        `${name} publishes v${prov.version}, off the v${minorLine(pkg.version)} line`);
    }
    assert.match(String(prov.generated), /^\d{4}-\d{2}-\d{2}$/,
      `${name} must publish the date it was measured, got ${prov.generated}`);
  }
});

// ── the guard bites ─────────────────────────────────────────────────────────

test('the generator refuses a source from another release line', () => {
  // Copy the repo's reports into a temp root, age one of them, and confirm the
  // generator exits non-zero naming it. This is the v8.8.0-in-v8.49 case.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-prov-'));
  try {
    fs.mkdirSync(path.join(dir, 'benchmarks', 'reports'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'scripts', 'lib'), { recursive: true });
    for (const name of SOURCES) {
      const src = path.join(REPORTS, name);
      if (fs.existsSync(src)) fs.copyFileSync(src, path.join(dir, 'benchmarks', 'reports', name));
    }
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ version: pkg.version }));
    // Age test-discovery to a different minor line.
    const tdPath = path.join(dir, 'benchmarks', 'reports', 'test-discovery.json');
    const td = JSON.parse(fs.readFileSync(tdPath, 'utf8'));
    td.version = '8.8.0';
    fs.writeFileSync(tdPath, JSON.stringify(td));

    let threw = null;
    try {
      execFileSync(process.execPath, ['--input-type=module', '-e',
        `const m = await import(${JSON.stringify('file://' + GEN)});\n`
        + `m.computeLatest(${JSON.stringify(dir)});`,
      ], { encoding: 'utf8', stdio: 'pipe' });
    } catch (e) { threw = (e.stderr || '') + (e.stdout || ''); }

    assert.ok(threw, 'the generator accepted a report from another release line');
    assert.match(threw, /test-discovery\.json/, 'the refusal must name the stale report');
    assert.match(threw, /8\.8\.0/, 'the refusal must name the version it found');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('one npm target regenerates every source', () => {
  const scripts = pkg.scripts || {};
  assert.ok(scripts['benchmark:all'], 'a release needs one command that refreshes all five sources');
  const all = scripts['benchmark:all'];
  for (const part of ['benchmark:matrix', 'benchmark:honest', 'benchmark:test-discovery']) {
    assert.ok(all.includes(part), `benchmark:all must run ${part} — running four of five is the defect`);
  }
  assert.match(String(scripts['benchmark:honest']), /--save/, 'benchmark:honest must persist its report');
  assert.match(String(scripts['benchmark:test-discovery']), /--save/, 'benchmark:test-discovery must persist its report');
});

// ── the reduction figure names its basis (#811) ─────────────────────────────

test('the published reduction figure names what it is measured against', () => {
  const readme = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');
  const pctStr = String(latest.metrics.overall_token_reduction_pct);
  const lines = readme.split('\n').filter((l) => l.includes(pctStr) && /%/.test(l));
  assert.ok(lines.length > 0, `README does not render the ${pctStr}% figure at all`);
  for (const line of lines) {
    assert.match(line, /repositor|repos|source file/i,
      `a reduction figure must name its baseline in the same sentence: ${line.trim()}`);
  }
});

test('no surface presents the map size as a per-call cost saving', () => {
  const sync = fs.readFileSync(path.join(ROOT, 'scripts', 'sync-metrics.mjs'), 'utf8');
  // The wording lives in the generator — a prose-only fix is reverted by the
  // next `sync-metrics`, which is why #811 targets this file.
  assert.ok(/not a per-call cost saving/.test(sync),
    'the generator must emit the caveat distinguishing map size from realised context footprint');
  assert.ok(!/\*\*\$\{pct\(m\.overall_token_reduction_pct\)\} token reduction\*\* — average across/.test(sync),
    'the bare "token reduction — average across N repos" wording reads as a cost claim');
});

console.log('');
console.log(`  metric-provenance: ${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
