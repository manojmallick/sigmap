'use strict';

/**
 * Integration tests for v6.9.0 — Segmented benchmarks + methodology + usefulness eval
 *
 * Tests:
 *  1. Task metadata file exists and is valid JSON
 *  2. Metadata covers all 18 benchmark repos
 *  3. Each repo has language, repo_type, size_class
 *  4. Methodology.md exists and has required sections
 *  5. Usefulness scorer computes tier correctly (fully/partially/not useful)
 *  6. Usefulness stats aggregate correctly
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  PASS  ${name}`);
    passed++;
  } catch (err) {
    console.log(`  FAIL  ${name}: ${err.message}`);
    failed++;
  }
}

// ──────────────────────────────────────────────────────────────────────────

test('task-metadata.json exists and is valid JSON', () => {
  const metadataPath = path.join(ROOT, 'benchmarks', 'task-metadata.json');
  assert(fs.existsSync(metadataPath), 'task-metadata.json not found');

  const content = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
  assert(content.metadata, 'metadata object missing');
  assert(content.tasks, 'tasks object missing');
});

test('metadata covers all 18 benchmark repos', () => {
  const metadataPath = path.join(ROOT, 'benchmarks', 'task-metadata.json');
  const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
  const tasks = metadata.tasks;

  const expectedRepos = [
    'flask', 'fastapi', 'express', 'axios', 'fastify', 'vue-core', 'svelte',
    'okhttp', 'spring-petclinic', 'akka', 'gin', 'rails', 'laravel',
    'rust-analyzer', 'abseil-cpp', 'serilog', 'riverpod', 'vapor'
  ];

  expectedRepos.forEach(repo => {
    assert(tasks[repo], `missing metadata for ${repo}`);
  });

  assert.strictEqual(Object.keys(tasks).length, 18, 'should have exactly 18 repos');
});

test('each repo has language, repo_type, size_class', () => {
  const metadataPath = path.join(ROOT, 'benchmarks', 'task-metadata.json');
  const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));

  Object.entries(metadata.tasks).forEach(([repo, data]) => {
    assert(data.language, `${repo} missing language`);
    assert(data.repo_type, `${repo} missing repo_type`);
    assert(data.size_class, `${repo} missing size_class`);
    assert(data.description, `${repo} missing description`);
  });
});

test('methodology.md exists', () => {
  const methodologyPath = path.join(ROOT, 'docs-vp', 'guide', 'methodology.md');
  assert(fs.existsSync(methodologyPath), 'methodology.md not found');

  const content = fs.readFileSync(methodologyPath, 'utf8');
  assert(content.includes('# Benchmark methodology'), 'missing main heading');
});

test('methodology.md has required sections', () => {
  const methodologyPath = path.join(ROOT, 'docs-vp', 'guide', 'methodology.md');
  const content = fs.readFileSync(methodologyPath, 'utf8');

  const sections = [
    'What we measure',
    'Retrieval accuracy',
    'Task success',
    'Prompt reduction',
    'Token reduction',
    'Answer usefulness',
    'Reproducibility'
  ];

  sections.forEach(section => {
    assert(content.includes(section), `missing section: ${section}`);
  });
});

test('usefulness-scorer.js exists and exports functions', () => {
  const scorerPath = path.join(ROOT, 'src', 'eval', 'usefulness-scorer.js');
  assert(fs.existsSync(scorerPath), 'usefulness-scorer.js not found');

  const scorer = require(scorerPath);
  assert(typeof scorer.scoreUsefulness === 'function', 'scoreUsefulness not exported');
  assert(typeof scorer.computeUsefulnessStats === 'function', 'computeUsefulnessStats not exported');
});

test('scoreUsefulness returns "fully-useful" when file ranked first', () => {
  const { scoreUsefulness } = require(path.join(ROOT, 'src', 'eval', 'usefulness-scorer.js'));

  const taskResult = { hitRank: 1 };
  const result = scoreUsefulness(taskResult, 0.95);

  assert.strictEqual(result.tier, 'fully-useful');
  assert.strictEqual(result.score, 0.95);
});

test('scoreUsefulness returns "partially-useful" when file ranked 2-5', () => {
  const { scoreUsefulness } = require(path.join(ROOT, 'src', 'eval', 'usefulness-scorer.js'));

  const taskResult = { hitRank: 3 };
  const result = scoreUsefulness(taskResult, 0.80);

  assert.strictEqual(result.tier, 'partially-useful');
  assert.strictEqual(result.score, 0.40);  // 0.80 * 0.5
});

test('scoreUsefulness returns "not-useful" when file not in top 5', () => {
  const { scoreUsefulness } = require(path.join(ROOT, 'src', 'eval', 'usefulness-scorer.js'));

  const taskResult = { hitRank: -1 };
  const result = scoreUsefulness(taskResult, 0);

  assert.strictEqual(result.tier, 'not-useful');
  assert.strictEqual(result.score, 0);
});

test('computeUsefulnessStats aggregates correctly', () => {
  const { computeUsefulnessStats } = require(path.join(ROOT, 'src', 'eval', 'usefulness-scorer.js'));

  const taskResults = [
    { hitRank: 1, rankingScore: 0.95 },  // fully-useful
    { hitRank: 1, rankingScore: 0.92 },  // fully-useful
    { hitRank: 3, rankingScore: 0.80 },  // partially-useful
    { hitRank: -1, rankingScore: 0 }     // not-useful
  ];

  const stats = computeUsefulnessStats(taskResults);

  assert.strictEqual(stats.fully_useful, 2);
  assert.strictEqual(stats.partially_useful, 1);
  assert.strictEqual(stats.not_useful, 1);
  assert.strictEqual(stats.fully_useful_pct, '50.0');
});

// ──────────────────────────────────────────────────────────────────────────

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
