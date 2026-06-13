#!/usr/bin/env node
'use strict';

/**
 * Squeeze benchmark + regression gate (v7.0.0).
 *
 *   node scripts/run-squeeze-benchmark.mjs            # run, print table
 *   node scripts/run-squeeze-benchmark.mjs --save     # also write JSON
 *   node scripts/run-squeeze-benchmark.mjs --gate     # exit 1 on regression
 *
 * Scores classification accuracy, per-category reduction, ground-truth
 * preservation (the key fact a developer needs must survive the squeeze),
 * false-trigger rate, and latency. The fixture set below is a representative
 * seed across categories — extend toward the 100 real-world pastes from the
 * plan (§8.1) before any public reduction % is stated.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { squeeze } = await import(path.join(ROOT, 'src/squeeze/index.js'));

const SAVE = process.argv.includes('--save');
const GATE = process.argv.includes('--gate');
const OUT = path.join(ROOT, 'benchmarks', 'reports', 'squeeze.json');

// Targets (plan §8.4/8.5)
const GROUND_TRUTH_MIN = 0.95;
const FALSE_TRIGGER_MAX = 0.05;
const CLASS_ACC_MIN = 0.90;

const rep = (s, n) => s.repeat(n);
const SYMS = new Map([['src/auth/session.js', ['function validateToken(token)  :140-150']]]);

// Each fixture: { name, category (expected, null=prose), input, ground[] }
const FIXTURES = [
  // stacktrace
  { name: 'st/node-typeerror', category: 'stacktrace', ground: ['TypeError', 'src/auth/session.js:142'],
    input: 'TypeError: Cannot read property "id" of undefined\n' + rep('    at vendor (/app/node_modules/x/q.js:5:1)\n', 20) + '    at validateToken (/app/src/auth/session.js:142:9)\n' + rep('    at mw (/app/node_modules/express/router.js:281:7)\n', 10) },
  { name: 'st/python', category: 'stacktrace', ground: ['ValueError', 'app/svc.py'],
    input: 'Traceback (most recent call last):\n' + rep('  File "/usr/lib/python3/site-packages/lib.py", line 5, in g\n    g()\n', 15) + '  File "/app/svc.py", line 42, in handler\n    raise ValueError("bad")\nValueError: bad' },
  { name: 'st/repeated', category: 'stacktrace', ground: ['occurred', 'src/a.js'],
    input: rep('BoomError: kaboom\n    at f (/app/src/a.js:1:2)\n', 47) },
  { name: 'st/java', category: 'stacktrace', ground: ['NullPointerException'],
    input: 'Exception in thread "main" java.lang.NullPointerException\n' + rep('\tat com.x.Lib.run(Lib.java:55)\n', 12) + '\tat com.app.Main.handle(Main.java:21)\n' },
  { name: 'st/go', category: 'stacktrace', ground: ['panic', 'main.go'],
    input: 'panic: runtime error: index out of range\n\ngoroutine 1 [running]:\n' + rep('runtime.foo(/usr/go/pkg/mod/runtime/x.go:12)\n', 8) + 'main.handler(/app/main.go:88)\n' },
  // cilog
  { name: 'ci/gh-actions', category: 'cilog', ground: ['ERROR build failed'],
    input: rep('2026-06-09T10:00:00 ##[group]step\n', 30) + '2026-06-09T10:01:00 ERROR build failed: missing module\n' + rep('2026-06-09T10:02:00 75% Downloading\n', 30) },
  { name: 'ci/npm', category: 'cilog', ground: ['ENOENT'],
    input: rep('npm WARN deprecated foo@1.0.0\n', 40) + 'npm ERR! code ENOENT\nnpm ERR! enoent ENOENT: no such file\n' + rep('npm http fetch GET 200\n', 20) },
  { name: 'ci/docker', category: 'cilog', ground: ['failed to solve'],
    input: rep('#5 12.34 [1/4] downloading layers 45%\n', 35) + '#7 ERROR: failed to solve: process did not complete\n' + rep('#5 12.34 extracting 90%\n', 20) },
  { name: 'ci/pytest', category: 'cilog', ground: ['FAILED'],
    input: rep('10:00:00 PASSED test_a\n', 40) + '10:00:01 FAILED test_z - assert 1 == 2\n' + rep('10:00:02 PASSED test_b\n', 20) },
  // json
  { name: 'json/api-error', category: 'json', ground: ['"code"', '"VALIDATION"'],
    input: JSON.stringify({ error: { code: 'VALIDATION', message: 'bad' }, items: Array.from({ length: 200 }, (_, i) => ({ id: i, name: 'x' })) }) },
  { name: 'json/graphql', category: 'json', ground: ['errors', 'Unauthorized'],
    input: JSON.stringify({ errors: [{ message: 'Unauthorized', path: ['me'] }], data: null, extensions: { trace: rep('z', 900) } }) },
  { name: 'json/validation', category: 'json', ground: ['"field"'],
    input: JSON.stringify({ field: 'email', violations: Array.from({ length: 80 }, (_, i) => ({ idx: i, rule: 'required' })) }) },
  // prose (must NOT trigger)
  { name: 'prose/bug', category: null, ground: [], input: 'the login button does not work when I double-click it on mobile safari' },
  { name: 'prose/question', category: null, ground: [], input: 'how do I configure the retry policy for the upload service in staging?' },
  { name: 'prose/short', category: null, ground: [], input: 'fix the failing checkout flow' },
];

function tokens(s) { return Math.ceil(s.length / 4); }

const byCat = {};
let correct = 0, falseTrig = 0, proseCount = 0;
const rows = [];
for (const fx of FIXTURES) {
  const t0 = process.hrtime.bigint();
  const r = squeeze(fx.input, { srcDirs: ['src', 'app'], symbolIndex: SYMS });
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;

  const classifiedOk = (r.category || null) === (fx.category || null);
  if (classifiedOk) correct++;
  if (fx.category === null) { proseCount++; if (r.category) falseTrig++; }

  const gtOk = fx.ground.every((g) => r.squeezed.includes(g));
  const cat = fx.category || 'prose';
  (byCat[cat] = byCat[cat] || { n: 0, redSum: 0, gtOk: 0, enriched: 0 });
  byCat[cat].n++;
  byCat[cat].redSum += r.reduction;
  if (gtOk) byCat[cat].gtOk++;
  if (r.enriched) byCat[cat].enriched++;

  rows.push({ name: fx.name, expected: fx.category, got: r.category, reduction: r.reduction, groundTruthPreserved: gtOk, enriched: r.enriched, latencyMs: Number(ms.toFixed(2)) });
}

const categories = {};
for (const [cat, v] of Object.entries(byCat)) {
  categories[cat] = {
    count: v.n,
    avgReduction: Number((v.redSum / v.n).toFixed(3)),
    groundTruthPreserved: Number((v.gtOk / v.n).toFixed(3)),
    ...(cat === 'stacktrace' ? { enrichmentHitRate: Number((v.enriched / v.n).toFixed(3)) } : {}),
  };
}
const result = {
  fixtureCount: FIXTURES.length,
  byCategory: categories,
  overall: {
    classificationAccuracy: Number((correct / FIXTURES.length).toFixed(3)),
    falseTriggerRate: Number((proseCount ? falseTrig / proseCount : 0).toFixed(3)),
    avgLatencyMs: Number((rows.reduce((s, r) => s + r.latencyMs, 0) / rows.length).toFixed(2)),
  },
  rows,
};

// Console table
console.log('\nSqueeze benchmark —', FIXTURES.length, 'fixtures\n');
for (const [cat, v] of Object.entries(categories)) {
  const extra = v.enrichmentHitRate != null ? `  enrich ${Math.round(v.enrichmentHitRate * 100)}%` : '';
  console.log(`  ${cat.padEnd(11)} n=${v.count}  reduction ${Math.round(v.avgReduction * 100)}%  ground-truth ${Math.round(v.groundTruthPreserved * 100)}%${extra}`);
}
console.log(`\n  classification ${Math.round(result.overall.classificationAccuracy * 100)}%  false-trigger ${Math.round(result.overall.falseTriggerRate * 100)}%  latency ${result.overall.avgLatencyMs}ms`);

if (SAVE) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(result, null, 2));
  console.log(`\n[squeeze] saved -> ${path.relative(ROOT, OUT)}`);
}

// Regression gate (plan §8.5)
if (GATE) {
  const fails = [];
  for (const [cat, v] of Object.entries(categories)) {
    if (cat !== 'prose' && v.groundTruthPreserved < GROUND_TRUTH_MIN) fails.push(`${cat} ground-truth ${Math.round(v.groundTruthPreserved * 100)}% < ${GROUND_TRUTH_MIN * 100}%`);
  }
  if (result.overall.falseTriggerRate > FALSE_TRIGGER_MAX) fails.push(`false-trigger ${Math.round(result.overall.falseTriggerRate * 100)}% > ${FALSE_TRIGGER_MAX * 100}%`);
  if (result.overall.classificationAccuracy < CLASS_ACC_MIN) fails.push(`classification ${Math.round(result.overall.classificationAccuracy * 100)}% < ${CLASS_ACC_MIN * 100}%`);
  if (fails.length) { console.error('\n[squeeze] GATE FAIL:\n  ' + fails.join('\n  ')); process.exit(1); }
  console.log('\n[squeeze] GATE OK — all categories meet targets');
}
