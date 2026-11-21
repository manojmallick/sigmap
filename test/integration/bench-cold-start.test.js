'use strict';

/**
 * #1071, T4 — the tool that times a cold start to the first `ask` answer (`scripts/bench-cold-start.mjs`). The timings themselves are a
 * measurement taken on the maintainer's machine and shown in the pull request; what is pinned here is that the tool cannot say something false:
 *   - the comparison is exact at the registered bar (10% slower passes, a hair more does not), and a faster arm passes;
 *   - an arm is parsed strictly, so a typo in a config name is an error and not a silent `today`;
 *   - a run that did not answer (non-zero exit, empty output) is an error, never a fast run;
 *   - with the real SigMap, a cold `ask` on a small repository answers under both configs.
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const tmp = [];
const mktmp = (p) => { const d = fs.mkdtempSync(path.join(os.tmpdir(), p)); tmp.push(d); return d; };

/** A one-commit git repository with two source files. */
function smallRepo() {
  const dir = mktmp('sigmap-cold-repo-');
  fs.mkdirSync(path.join(dir, 'src'));
  fs.writeFileSync(path.join(dir, 'src', 'router.js'), 'function route(req) { return req; }\nmodule.exports = { route };\n');
  fs.writeFileSync(path.join(dir, 'src', 'main.js'), 'const { route } = require("./router");\nfunction main() { return route({}); }\nmodule.exports = { main };\n');
  execFileSync('git', ['init', '-q', dir]);
  const git = (...a) => execFileSync('git', ['-C', dir, '-c', 'user.name=t', '-c', 'user.email=t@t', ...a]);
  git('add', '-A'); git('commit', '-q', '-m', 'init');
  return dir;
}
/** A stand-in for a SigMap checkout whose `gen-context.js` does what the script says. */
function fakeCheckout(body) {
  const dir = mktmp('sigmap-fake-');
  fs.writeFileSync(path.join(dir, 'gen-context.js'), body);
  return dir;
}

(async () => {
  let passed = 0; let failed = 0; let skipped = 0;
  // A test that cannot be evaluated here returns a string, which is counted and printed as a skip, never as a pass.
  const test = async (name, fn) => {
    try {
      const r = await fn();
      if (typeof r === 'string') { skipped++; console.log(`  SKIP  ${name}\n        ${r}`); } else { passed++; console.log(`  PASS  ${name}`); }
    } catch (e) { failed++; console.log(`  FAIL  ${name}\n        ${String(e.message).split('\n').join('\n        ')}`); }
  };
  const b = await import('../../scripts/bench-cold-start.mjs');

  await test('the registered bar is 10%, and the median is the middle run (mean of the middle two when even)', () => {
    assert.strictEqual(b.MAX_SLOWDOWN, 0.10);
    assert.strictEqual(b.median([5, 1, 3]), 3);
    assert.strictEqual(b.median([4, 1, 3, 2]), 2.5);
    assert.strictEqual(b.median([7]), 7);
  });

  await test('an arm is name=<checkout>:<config>, and an unknown config or a missing part is an error', () => {
    assert.deepStrictEqual(b.parseArm('flip=/x/y:candidate-a'), { name: 'flip', checkout: '/x/y', config: 'candidate-a' });
    assert.strictEqual(b.parseArm('base=.:today').config, 'today');
    assert.throws(() => b.parseArm('flip=/x/y:candidate_a'), /unknown config/);
    assert.throws(() => b.parseArm('flip=/x/y'), /no :<config>/);
    assert.throws(() => b.parseArm('/x/y:today'), /not name=/);
  });

  await test('the comparison is exact at the bar: +10.0% passes, a hair more fails, a faster arm passes, the baseline carries no verdict', () => {
    const rows = (flip) => b.compare({ base: [100, 100, 100], flip: [flip, flip, flip] });
    assert.deepStrictEqual([rows(100)[0].verdict, rows(100)[0].ok, rows(100)[0].ratio], ['baseline', null, null]);
    assert.strictEqual(rows(110)[1].verdict, 'within');
    assert.strictEqual(rows(110.01)[1].verdict, 'slower');
    assert.strictEqual(rows(60)[1].verdict, 'within');
    assert.ok(rows(60)[1].slowdown < 0);
    assert.strictEqual(b.compare({ base: [100], flip: [105] }, 0.04)[1].verdict, 'slower', 'a stricter bar is honoured');
  });

  await test('noise is not a verdict: runs whose interval spans the bar are "inconclusive", and a slowdown the noise cannot hide is "slower"', () => {
    // The baseline is steady, the arm ranges from 20% faster to 40% slower: its median is about +10%, and the runs cannot say which side of the bar it is on.
    const noisy = b.compare({ base: [100, 100, 100, 100, 100, 100, 100, 100], flip: [80, 130, 90, 140, 100, 120, 85, 135] })[1];
    assert.strictEqual(noisy.verdict, 'inconclusive');
    assert.strictEqual(noisy.ok, null);
    assert.ok(noisy.lo < 1.10 && noisy.hi > 1.10, `${noisy.lo}..${noisy.hi}`);
    // The same noise around a clearly slower arm (about +50%) is still a slowdown.
    const slow = b.compare({ base: [100, 100, 100, 100, 100, 100, 100, 100], flip: [140, 160, 150, 145, 155, 148, 152, 150] })[1];
    assert.strictEqual(slow.verdict, 'slower');
    // And a clearly faster arm with noise is within the bar.
    const fast = b.compare({ base: [100, 100, 100, 100, 100, 100, 100, 100], flip: [60, 70, 65, 75, 62, 68, 72, 66] })[1];
    assert.strictEqual(fast.verdict, 'within');
  });

  await test('the pairing is by round: a slow baseline round does not make the arm look fast, and unequal run counts are refused', () => {
    const r = b.compare({ base: [100, 100, 900], flip: [120, 120, 120] })[1];
    assert.ok(Math.abs(r.ratio - 1.2) < 1e-9, `paired median ${r.ratio}`);
    assert.notStrictEqual(r.verdict, 'within', 'one slow baseline round does not rescue a slower arm');
    assert.throws(() => b.compare({ base: [100, 100], flip: [100] }), /has 1 runs, the baseline 2/);
  });

  await test('the interval is reproducible: the same runs give the same interval', () => {
    const xs = [1.0, 1.3, 0.9, 1.2, 1.1, 1.4, 0.8];
    assert.deepStrictEqual(b.bootstrapMedian(xs), b.bootstrapMedian(xs));
    const { lo, hi } = b.bootstrapMedian(xs);
    assert.ok(lo <= b.median(xs) && b.median(xs) <= hi);
  });

  await test('a run that did not answer is an error, not a fast run: a failing exit and an empty answer both throw', () => {
    const repo = smallRepo();
    const failing = { name: 'bad', checkout: fakeCheckout('process.stderr.write("boom"); process.exit(3);'), config: 'today' };
    const silent = { name: 'silent', checkout: fakeCheckout('process.exit(0);'), config: 'today' };
    // Generating the index works, then `ask` fails: the ask check, not the generate check, must refuse it.
    const askFails = { name: 'askfails', checkout: fakeCheckout('if (process.argv[2] === "ask") { process.stderr.write("no answer"); process.exit(4); }'), config: 'today' };
    assert.throws(() => b.coldRun({ repoDir: repo, arm: failing, query: 'q' }), /generating the index exited 3/);
    assert.throws(() => b.coldRun({ repoDir: repo, arm: askFails, query: 'q' }), /`ask` exited 4/);
    assert.throws(() => b.coldRun({ repoDir: repo, arm: silent, query: 'q' }), /printed nothing/);
  });

  await test('CPU time is read from `time -p`: user plus sys, the last report, and no report is an error', () => {
    assert.strictEqual(b.parseTimeP('real 2.50\nuser 1.20\nsys 0.30\n'), 1.5);
    assert.strictEqual(b.parseTimeP('noise\nuser 9\nsys 9\nreal 1\nuser 0.25\nsys 0.75\n'), 1.0, 'the last report wins');
    assert.strictEqual(b.parseTimeP('some warning only'), null);
    assert.strictEqual(b.parseTimeP('user 1.0\n'), null, 'user without sys is not a report');
    assert.strictEqual(b.parseTimeP(undefined), null);
  });

  await test('with the real SigMap, the CPU metric reports CPU time next to wall time, and CPU is not more than wall times the cores it ran on', () => {
    if (!fs.existsSync('/usr/bin/time')) return 'not evaluated: /usr/bin/time is not here';
    const d = b.coldRunDetail({ repoDir: smallRepo(), arm: { name: 'here', checkout: ROOT, config: 'today' }, query: 'where is the router', cpu: true });
    assert.ok(d.cpu > 0 && d.wall > 0, JSON.stringify(d));
    assert.ok(d.cpu < d.wall * 16, 'CPU time is of the same order as wall time');
    assert.strictEqual(typeof b.coldRun({ repoDir: smallRepo(), arm: { name: 'here', checkout: ROOT, config: 'today' }, query: 'where is the router', metric: 'cpu' }), 'number');
  });

  for (const config of ['today', 'candidate-a']) {
    await test(`with the real SigMap, a cold \`ask\` on a small repository answers under "${config}" and reports a positive time`, () => {
      const ms = b.coldRun({ repoDir: smallRepo(), arm: { name: 'here', checkout: ROOT, config }, query: 'where is the router' });
      assert.ok(ms > 0 && ms < 60000, `${ms} ms`);
    });
  }

  for (const d of tmp) { try { fs.rmSync(d, { recursive: true, force: true }); } catch { /* best effort */ } }
  console.log(`\nbench-cold-start: ${passed} passed, ${failed} failed, ${skipped} skipped`);
  process.exit(failed ? 1 : 0);
})();
