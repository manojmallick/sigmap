#!/usr/bin/env node
'use strict';

/**
 * Hallucination Guard proof harness (Reliable MVP, v6.15.0).
 *
 * Runs `verify-ai-output` against a set of labeled cases and emits a
 * per-detector precision/recall CSV (plan §2 proof requirements, §7 targets).
 *
 *   node scripts/run-verify-benchmark.mjs                 # offline synthetic self-test
 *   node scripts/run-verify-benchmark.mjs --manifest cases.json
 *   node scripts/run-verify-benchmark.mjs --out benchmarks/reports/verify-precision.csv
 *
 * Manifest format (JSON array) — point this at 5 real repos
 * (small / medium / large / monorepo / framework):
 *   [
 *     {
 *       "name": "axios",
 *       "repo": "/abs/path/to/axios",
 *       "answer": "/abs/path/to/seeded-answer.md",
 *       "expected": {                      // ground truth
 *         "fake":  ["src/ghost.js", "ghost-pkg", "phantomFn"],
 *         "real":  ["src/index.js", "chalk", "isAxiosError"]  // must NOT be flagged
 *       }
 *     }
 *   ]
 *
 * Precision = TP / (TP + FP)   (FP = a real reference wrongly flagged)
 * Recall    = TP / (TP + FN)   (FN = a seeded fake that slipped through)
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = path.join(ROOT, 'gen-context.js');

const args = process.argv.slice(2);
function flag(name, def) {
  const i = args.indexOf(name);
  return i !== -1 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : def;
}
const manifestPath = flag('--manifest', null);
const outPath = flag('--out', path.join(ROOT, 'benchmarks', 'reports', 'verify-precision.csv'));

// Plan §7 precision targets per detector group.
const TARGETS = { file: 0.95, import: 0.85, symbol: 0.75, script: 0.95 };
const GROUP = {
  'fake-file': 'file', 'fake-test-file': 'file',
  'fake-import': 'import', 'fake-symbol': 'symbol', 'fake-npm-script': 'script',
};

function runVerify(repo, answer) {
  const res = spawnSync('node', [SCRIPT, 'verify-ai-output', answer, '--cwd', repo, '--json'], {
    cwd: ROOT, encoding: 'utf8',
  });
  try { return JSON.parse(res.stdout.trim()); }
  catch { return { issues: [], summary: { total: 0 } }; }
}

/** Build an offline synthetic case so the harness runs with zero network. */
function makeSyntheticCase() {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-proof-'));
  fs.mkdirSync(path.join(repo, 'src'));
  fs.writeFileSync(path.join(repo, 'package.json'), JSON.stringify({
    name: 'proof', version: '1.0.0',
    scripts: { build: 'x', test: 'x', lint: 'x' },
    dependencies: { chalk: '^5.0.0' },
  }, null, 2));
  fs.writeFileSync(path.join(repo, 'src', 'index.js'),
    'function loadConfig(p){return p;}\nfunction rankFiles(q){return q;}\nmodule.exports={loadConfig,rankFiles};\n');
  fs.writeFileSync(path.join(repo, 'src', 'util.js'),
    'function helper(){return 1;}\nmodule.exports={helper};\n');
  // Seed an index so buildSigIndex has symbols.
  spawnSync('node', [SCRIPT, '--cwd', repo], { cwd: ROOT, encoding: 'utf8' });

  const answer = path.join(repo, 'answer.md');
  fs.writeFileSync(answer, [
    '# Implementation',
    'Edit `src/index.js` which exposes `loadConfig()` and `rankFiles()`.',     // real (negatives)
    'Also see `src/ghost.js` and the test `src/ghost.test.js`.',               // fake-file + fake-test-file
    'Call `loadConfg()` (typo) and `phantomFn()`.',                            // fake-symbol ×2
    '',
    '```js',
    "import { helper } from './src/util';",                                    // real
    "import chalk from 'chalk';",                                              // real
    "import ghost from 'ghost-pkg-9000';",                                     // fake-import
    '```',
    'Run `npm run build` then `npm run nope`.',                                // real script + fake-npm-script
  ].join('\n'));

  return {
    name: 'synthetic',
    repo, answer,
    expected: {
      fake: ['src/ghost.js', 'src/ghost.test.js', 'loadConfg', 'phantomFn', 'ghost-pkg-9000', 'nope'],
      real: ['src/index.js', 'src/util.js', 'loadConfig', 'rankFiles', 'helper', 'chalk', 'build'],
    },
    _cleanup: () => { try { fs.rmSync(repo, { recursive: true, force: true }); } catch {} },
  };
}

function scoreCase(c) {
  const result = runVerify(c.repo, c.answer);
  const flagged = new Map(); // value -> group
  for (const issue of result.issues) flagged.set(issue.value, GROUP[issue.type] || 'other');

  const fake = new Set(c.expected.fake || []);
  const real = new Set(c.expected.real || []);

  // Per-group tallies.
  const groups = {};
  const ensure = (g) => (groups[g] = groups[g] || { tp: 0, fp: 0, fn: 0 });

  for (const [val, g] of flagged) {
    if (fake.has(val)) ensure(g).tp++;
    else if (real.has(val)) ensure(g).fp++;
    // values neither labeled fake nor real are ignored (not part of ground truth)
  }
  // False negatives: seeded fakes that were not flagged. We can't know the
  // group of an un-flagged value from output, so bucket by a label map if
  // present, else attribute to a catch-all using a heuristic.
  const fakeGroupHint = c.expected.fakeGroups || {};
  for (const val of fake) {
    if (!flagged.has(val)) ensure(fakeGroupHint[val] || guessGroup(val)).fn++;
  }
  return { name: c.name, groups, result };
}

function guessGroup(val) {
  if (/\.(test|spec)\./.test(val)) return 'file';
  if (/[./]/.test(val) && /\.[a-z]+$/i.test(val)) return 'file';
  if (/^[a-z0-9@][\w@/-]*$/i.test(val) && /-/.test(val)) return 'import';
  if (/^[a-z][\w]*$/i.test(val)) return 'symbol';
  return 'other';
}

function pct(n) { return Number.isFinite(n) ? (n * 100).toFixed(1) + '%' : 'n/a'; }

function main() {
  let cases;
  let synthetic = null;
  if (manifestPath) {
    cases = JSON.parse(fs.readFileSync(path.resolve(manifestPath), 'utf8'));
  } else {
    synthetic = makeSyntheticCase();
    cases = [synthetic];
    console.log('[proof] no --manifest given — running offline synthetic self-test\n');
  }

  const rows = [['repo', 'group', 'TP', 'FP', 'FN', 'precision', 'recall', 'target', 'meets']];
  const agg = {};
  let allMeet = true;

  for (const c of cases) {
    const { name, groups } = scoreCase(c);
    for (const [g, t] of Object.entries(groups)) {
      const precision = t.tp + t.fp ? t.tp / (t.tp + t.fp) : 1;
      const recall = t.tp + t.fn ? t.tp / (t.tp + t.fn) : 1;
      const target = TARGETS[g];
      const meets = target == null ? '' : (precision >= target ? 'yes' : 'NO');
      if (meets === 'NO') allMeet = false;
      rows.push([name, g, t.tp, t.fp, t.fn, pct(precision), pct(recall), target != null ? pct(target) : '', meets]);
      const a = agg[g] = agg[g] || { tp: 0, fp: 0, fn: 0 };
      a.tp += t.tp; a.fp += t.fp; a.fn += t.fn;
    }
  }

  for (const [g, t] of Object.entries(agg)) {
    const precision = t.tp + t.fp ? t.tp / (t.tp + t.fp) : 1;
    const recall = t.tp + t.fn ? t.tp / (t.tp + t.fn) : 1;
    const target = TARGETS[g];
    rows.push(['ALL', g, t.tp, t.fp, t.fn, pct(precision), pct(recall), target != null ? pct(target) : '', target == null ? '' : (precision >= target ? 'yes' : 'NO')]);
  }

  // Console table
  const w = rows[0].map((_, i) => Math.max(...rows.map((r) => String(r[i]).length)));
  for (const r of rows) console.log(r.map((v, i) => String(v).padEnd(w[i])).join('  '));

  // CSV
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, rows.map((r) => r.join(',')).join('\n') + '\n');
  console.log(`\n[proof] CSV written: ${path.relative(ROOT, outPath)}`);

  if (synthetic) synthetic._cleanup();
  if (!allMeet) {
    console.error('\n[proof] FAIL — one or more detector groups missed its precision target');
    process.exit(1);
  }
  console.log('[proof] OK — all detector groups met their precision targets');
}

main();
