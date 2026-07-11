#!/usr/bin/env node
'use strict';

/**
 * Terse-encoding benchmark — the D7 "measure first" gate.
 *
 *   node scripts/run-terse-benchmark.mjs            # run, print table
 *   node scripts/run-terse-benchmark.mjs --json     # machine-readable result
 *   node scripts/run-terse-benchmark.mjs --save     # also write benchmarks/reports/terse.json
 *
 * Extracts fresh signatures from this repo's own source, encodes them with
 * src/format/terse.js, and reports the real signature-block reduction. Any
 * public reduction % for --terse MUST come from this script's output — never
 * from another tool's prose-compression numbers.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { extractFile, langFor } = require(path.join(ROOT, 'src/extractors/dispatch.js'));
const { encodeTerseSigs, measureTerse } = require(path.join(ROOT, 'src/format/terse.js'));

const JSON_OUT = process.argv.includes('--json');
const SAVE = process.argv.includes('--save');
const OUT = path.join(ROOT, 'benchmarks', 'reports', 'terse.json');

const SRC_DIRS = ['src', 'packages'];
const SKIP_DIRS = new Set(['node_modules', '.git', 'fixtures']);

function walk(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) walk(full, out); }
    else if (e.isFile() && langFor(e.name)) out.push(full);
  }
  return out;
}

const files = SRC_DIRS.flatMap((d) => walk(path.join(ROOT, d), []));
const perFile = [];
for (const f of files) {
  let sigs = [];
  try { sigs = extractFile(f, fs.readFileSync(f, 'utf8')) || []; } catch { continue; }
  if (!sigs.length) continue;
  const m = measureTerse([sigs]);
  perFile.push({ file: path.relative(ROOT, f), lines: sigs.length, ...m });
}

const beforeTokens = perFile.reduce((n, p) => n + p.beforeTokens, 0);
const afterTokens = perFile.reduce((n, p) => n + p.afterTokens, 0);
const total = {
  beforeTokens,
  afterTokens,
  reductionPct: beforeTokens > 0 ? Math.round(((beforeTokens - afterTokens) / beforeTokens) * 1000) / 10 : 0,
};

const result = {
  benchmark: 'terse-encoding',
  date: new Date().toISOString().slice(0, 10),
  corpus: `${perFile.length} files (${SRC_DIRS.join(', ')}) — sigmap repo`,
  sigLines: perFile.reduce((n, p) => n + p.lines, 0),
  beforeTokens: total.beforeTokens,
  afterTokens: total.afterTokens,
  reductionPct: total.reductionPct,
};

if (JSON_OUT) {
  console.log(JSON.stringify(result, null, 2));
} else {
  const worst = [...perFile].sort((a, b) => a.reductionPct - b.reductionPct).slice(0, 3);
  const best = [...perFile].sort((a, b) => b.reductionPct - a.reductionPct).slice(0, 3);
  console.log('Terse-encoding benchmark (D7 measure-first gate)');
  console.log(`  corpus     : ${result.corpus}`);
  console.log(`  sig lines  : ${result.sigLines}`);
  console.log(`  tokens     : ${result.beforeTokens} → ${result.afterTokens}`);
  console.log(`  reduction  : ${result.reductionPct}%`);
  console.log('  best files : ' + best.map((p) => `${p.file} (-${p.reductionPct}%)`).join('  '));
  console.log('  worst files: ' + worst.map((p) => `${p.file} (-${p.reductionPct}%)`).join('  '));
}

if (SAVE) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify({ ...result, perFile }, null, 2) + '\n');
  if (!JSON_OUT) console.log(`  saved      : ${path.relative(ROOT, OUT)}`);
}
