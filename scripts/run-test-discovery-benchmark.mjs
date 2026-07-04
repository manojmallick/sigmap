#!/usr/bin/env node
'use strict';

/**
 * Test-discovery benchmark (v8.5 C2) — measures `findRelatedTests`.
 *
 * The CHANGELOG deferred a *measured* impl→test discovery number to v8.5. This
 * harness produces it, reproducibly and with zero LLM calls:
 *
 *   1. Walk every repo under benchmarks/repos/.
 *   2. Build an INDEPENDENT gold standard: a test file is a gold match for an
 *      implementation file iff its basename equals an EXACT canonical form of
 *      the impl stem — `X.test.js`, `X.spec.ts`, `test_X.py`, `X_test.go`,
 *      `XTest.java`, `XSpec.scala`. This oracle is deliberately stricter and
 *      case-sensitive, so it does NOT reuse findRelatedTests' fuzzy affix
 *      normalization — the measurement is honest, not circular.
 *   3. Run `findRelatedTests` (repo-wide, lowercased, cross-language) against
 *      each impl and score precision / recall / F1 / hit@1 vs the gold set.
 *
 * All metrics are string-matching math over a fixed file tree → deterministic.
 *
 * Usage:
 *   node scripts/run-test-discovery-benchmark.mjs           # print summary
 *   node scripts/run-test-discovery-benchmark.mjs --save     # write report JSON
 *   node scripts/run-test-discovery-benchmark.mjs --json     # machine-readable
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const REPOS_DIR = path.join(ROOT, 'benchmarks', 'repos');
const REPORTS_DIR = path.join(ROOT, 'benchmarks', 'reports');

const SAVE = process.argv.includes('--save');
const JSON_OUT = process.argv.includes('--json');

const { findRelatedTests, riskLabelFor } = require('../src/evidence/pack.js');

const CODE_EXT = new Set([
  '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.py', '.go', '.rb', '.rs',
  '.java', '.kt', '.scala', '.swift', '.php', '.cs', '.c', '.cc', '.cpp', '.h', '.hpp',
]);
const SKIP_DIR = new Set(['.git', 'node_modules', 'vendor', 'dist', 'build', 'target', '.venv', 'venv', '__pycache__']);

/** Recursively collect code files under `dir`, returned as repo-relative POSIX paths. */
function walk(dir, repoRoot, out) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (SKIP_DIR.has(e.name)) continue;
      walk(full, repoRoot, out);
    } else if (CODE_EXT.has(path.extname(e.name).toLowerCase())) {
      out.push(path.relative(repoRoot, full).replace(/\\/g, '/'));
    }
  }
  return out;
}

/** Plain stem: basename minus its final extension. */
function baseStem(rel) {
  return path.basename(rel).replace(/\.[^.]+$/, '');
}

/**
 * Independent gold oracle: does `testRel`'s basename exactly match a canonical
 * test filename for implementation stem `stem`? Case-sensitive, exact — no
 * lowercasing, no whole-repo stem collisions.
 */
function isCanonicalTestFor(testRel, stem) {
  const b = path.basename(testRel);
  const ext = path.extname(b);
  const tstem = b.slice(0, b.length - ext.length);
  return (
    tstem === `${stem}.test` ||
    tstem === `${stem}.spec` ||
    tstem === `test_${stem}` ||
    tstem === `${stem}_test` ||
    tstem === `${stem}Test` ||
    tstem === `${stem}Spec`
  );
}

function scoreRepo(repo) {
  const repoRoot = path.join(REPOS_DIR, repo);
  const files = walk(repoRoot, repoRoot, []);
  if (!files.length) return null;

  const testFiles = files.filter((f) => riskLabelFor(f) === 'test');
  const implFiles = files.filter((f) => riskLabelFor(f) !== 'test');
  if (!testFiles.length || !implFiles.length) return null;

  let pairs = 0;
  let sumPrecision = 0;
  let sumRecall = 0;
  let scored = 0;
  let hits = 0;

  for (const impl of implFiles) {
    const stem = baseStem(impl);
    if (!stem) continue;
    const gold = testFiles.filter((t) => isCanonicalTestFor(t, stem));
    if (!gold.length) continue;

    const goldSet = new Set(gold);
    const predicted = findRelatedTests(impl, files);
    const tp = predicted.filter((p) => goldSet.has(p)).length;

    const precision = predicted.length ? tp / predicted.length : 0;
    const recall = tp / gold.length;
    sumPrecision += precision;
    sumRecall += recall;
    hits += predicted.length && goldSet.has(predicted[0]) ? 1 : 0;
    pairs += gold.length;
    scored++;
  }

  if (!scored) return null;
  const precision = sumPrecision / scored;
  const recall = sumRecall / scored;
  const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
  return { repo, impls: scored, pairs, precision, recall, f1, hitAt1: hits / scored };
}

function round(n, d = 3) {
  const f = 10 ** d;
  return Math.round(Number(n) * f) / f;
}

function main() {
  let repos;
  try {
    repos = fs.readdirSync(REPOS_DIR, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort();
  } catch {
    console.error(`No benchmark repos at ${REPOS_DIR}. Nothing to measure.`);
    return 1;
  }

  const perRepo = [];
  for (const repo of repos) {
    const r = scoreRepo(repo);
    if (r) perRepo.push(r);
  }

  if (!perRepo.length) {
    console.error('No repos yielded canonical impl↔test pairs.');
    return 1;
  }

  const impls = perRepo.reduce((n, r) => n + r.impls, 0);
  const pairs = perRepo.reduce((n, r) => n + r.pairs, 0);
  // Micro-average across all scored implementation files.
  const precision = perRepo.reduce((s, r) => s + r.precision * r.impls, 0) / impls;
  const recall = perRepo.reduce((s, r) => s + r.recall * r.impls, 0) / impls;
  const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
  const hitAt1 = perRepo.reduce((s, r) => s + r.hitAt1 * r.impls, 0) / impls;

  const report = {
    generated: new Date().toISOString(),
    source: 'benchmarks/repos/* (canonical impl↔test name oracle)',
    repos: perRepo.length,
    impls,
    pairs,
    metrics: {
      precision: round(precision),
      recall: round(recall),
      f1: round(f1),
      hitAt1: round(hitAt1),
    },
    perRepo: perRepo.map((r) => ({
      repo: r.repo,
      impls: r.impls,
      pairs: r.pairs,
      precision: round(r.precision),
      recall: round(r.recall),
      f1: round(r.f1),
      hitAt1: round(r.hitAt1),
    })),
  };

  if (JSON_OUT) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log('Test-discovery benchmark (findRelatedTests vs canonical gold)');
    console.log(`  repos: ${report.repos}   impls scored: ${impls}   gold pairs: ${pairs}`);
    console.log(`  precision: ${(precision * 100).toFixed(1)}%   recall: ${(recall * 100).toFixed(1)}%`);
    console.log(`  F1: ${(f1 * 100).toFixed(1)}%   hit@1: ${(hitAt1 * 100).toFixed(1)}%`);
  }

  if (SAVE) {
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
    fs.writeFileSync(path.join(REPORTS_DIR, 'test-discovery.json'), JSON.stringify(report, null, 2) + '\n');
    console.error(`✓ wrote benchmarks/reports/test-discovery.json`);
  }

  return 0;
}

process.exit(main());
