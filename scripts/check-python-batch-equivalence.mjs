#!/usr/bin/env node
/**
 * Does the batched Python AST pass answer exactly what the per-file call did? (#970)
 *
 *   node scripts/check-python-batch-equivalence.mjs <dir> [<dir> ...]
 *   node scripts/check-python-batch-equivalence.mjs --bench    # flask django fastapi httpx click rich
 *
 * For every `.py`/`.pyw` file under each directory it takes two answers:
 *   batch    - `prefetch()` then `tryNativeExtract()`, the path `generate` now takes
 *   per-file - `python3 python_ast.py <file>`, the call `generate` used to make for every file
 * and compares them as the extractor does: a non-empty array of signatures, or "regex tier".
 * Exit 1 on any difference. Dev-only: nothing here is shipped or loaded at runtime.
 *
 * The per-file side is slow by construction (one process per file), so it runs
 * eight at a time; only the comparison matters here, not its timing.
 */

import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { execFile } from 'child_process';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const python = require(path.join(ROOT, 'src/extractors/python'));
const SCRIPT = python.resolvePythonAstScript();
const BENCH = ['flask', 'django', 'fastapi', 'httpx', 'click', 'rich'];
const SKIP = new Set(['.git', 'node_modules', '.context', '__pycache__']);

function walk(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else if (e.isFile() && /\.pyw?$/i.test(e.name)) out.push(full);
  }
  return out;
}

/** The old per-file call, answered the way tryNativeExtract used to answer it. */
function perFile(file) {
  return new Promise((resolve) => {
    execFile('python3', [SCRIPT, file], { timeout: 30000, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }, (err, stdout) => {
      if (err) return resolve(null);
      try {
        const sigs = JSON.parse(String(stdout).trim());
        resolve(Array.isArray(sigs) && sigs.length > 0 ? sigs : null);
      } catch (_) { resolve(null); }
    });
  });
}

async function pool(items, n, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (next < items.length) { const i = next++; out[i] = await fn(items[i]); }
  }));
  return out;
}

async function compare(dir) {
  const files = walk(dir, []).sort();
  const t0 = Date.now();
  const summary = python.prefetch(files);
  const batchMs = Date.now() - t0;
  const batch = files.map((f) => python.tryNativeExtract(path.resolve(f)));
  const single = await pool(files, 8, perFile);
  const diffs = [];
  let ast = 0;
  files.forEach((f, i) => {
    if (batch[i]) ast++;
    if (JSON.stringify(batch[i]) !== JSON.stringify(single[i])) diffs.push(f);
  });
  console.log(`  ${path.basename(dir).padEnd(14)} ${String(files.length).padStart(5)} files  ${String(ast).padStart(5)} via AST  ${String(files.length - ast).padStart(4)} regex tier  ` +
    `${String(summary.degraded).padStart(3)} degraded  batch ${batchMs} ms  ${diffs.length ? `DIFFER ${diffs.length}` : 'identical'}`);
  for (const f of diffs.slice(0, 10)) console.log(`      differs: ${path.relative(dir, f)}`);
  return { files: files.length, diffs: diffs.length };
}

async function main() {
  let dirs = process.argv.slice(2);
  if (dirs.includes('--bench')) dirs = BENCH.map((n) => path.join(ROOT, 'benchmarks', 'repos', n));
  if (!dirs.length) { console.error('usage: check-python-batch-equivalence.mjs <dir> [<dir> ...] | --bench'); process.exit(2); }
  if (!SCRIPT) { console.error('python_ast.py not found'); process.exit(2); }
  console.log('[python batch equivalence] batch pre-pass vs the old per-file call');
  let files = 0, differ = 0;
  for (const d of dirs) {
    if (!fs.existsSync(d)) { console.log(`  ${path.basename(d).padEnd(14)} absent, skipped`); continue; }
    const r = await compare(d);
    files += r.files; differ += r.diffs;
  }
  console.log(`\n  ${files} files compared, ${differ} differ`);
  process.exit(files === 0 || differ > 0 ? 1 : 0);
}

main();
