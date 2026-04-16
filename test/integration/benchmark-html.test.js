'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const SCRIPT = path.join(ROOT, 'scripts', 'render-benchmark-report.mjs');

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

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
}

function withTempReports(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-bench-html-'));
  try {
    const reportsDir = path.join(dir, 'benchmarks', 'reports');
    fs.mkdirSync(reportsDir, { recursive: true });

    writeJson(path.join(reportsDir, 'token-reduction.json'), {
      version: '5.2.0',
      timestamp: '2026-04-17T10:00:00.000Z',
      summary: {
        repoCount: 2,
        overallReductionPct: 98.1,
        totalRawTokens: 12759865,
        totalFinalTokens: 239689,
      },
      repos: [
        { repo: 'express', language: 'JavaScript', rawTokens: 70600, finalTokens: 900, reductionPct: 98.7 },
        { repo: 'flask', language: 'Python', rawTokens: 242600, finalTokens: 2800, reductionPct: 98.8 },
      ],
    });

    writeJson(path.join(reportsDir, 'retrieval.json'), {
      generated: '2026-04-17T10:01:00.000Z',
      repos: [
        { repo: 'express', tasks: 5, hitAt5: 0.8, randomBaseline: 0.2, tiers: { correct: 3, partial: 1, wrong: 1 } },
        { repo: 'flask', tasks: 5, hitAt5: 1.0, randomBaseline: 0.26, tiers: { correct: 4, partial: 1, wrong: 0 } },
      ],
    });

    writeJson(path.join(reportsDir, 'quality.json'), {
      version: '5.2.0',
      timestamp: '2026-04-17T10:02:00.000Z',
      summary: {
        overflowGPT4oCount: 1,
        totalHiddenFiles: 59,
        totalGroundedSymbols: 768,
        totalDarkSymbols: 798,
        gpt4oSavedPerMonth: 227.87,
      },
      repos: [
        { repo: 'express', rawTokens: 70600, groundedSymbols: 54, darkSymbols: 299, groundingPct: 15, filesHiddenRaw: 0 },
        { repo: 'flask', rawTokens: 242600, groundedSymbols: 714, darkSymbols: 499, groundingPct: 59, filesHiddenRaw: 59 },
      ],
    });

    writeJson(path.join(reportsDir, 'task-benchmark.json'), {
      generated: '2026-04-17T10:03:00.000Z',
      summary: {
        totalTasks: 10,
        avgReductionPct: 41,
        avgPromptsWithout: 2.84,
        avgPromptsWith: 1.68,
        correctPct: 70,
        partialPct: 20,
        wrongPct: 10,
      },
      repos: [
        { repo: 'express', reductionPct: 33.3 },
        { repo: 'flask', reductionPct: 48.2 },
      ],
    });

    fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

console.log('\nIntegration tests — benchmark html report\n');

test('render-benchmark-report writes self-contained html from saved reports', () => {
  withTempReports((dir) => {
    execSync(`node "${SCRIPT}" --cwd "${dir}"`, {
      cwd: ROOT,
      encoding: 'utf8',
      timeout: 20000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const htmlPath = path.join(dir, 'benchmarks', 'reports', 'benchmark-report.html');
    assert.ok(fs.existsSync(htmlPath), 'html report should exist');
    const html = fs.readFileSync(htmlPath, 'utf8');
    assert.ok(html.includes('SigMap Benchmark Report'));
    assert.ok(html.includes('Token reduction'));
    assert.ok(html.includes('Retrieval quality'));
    assert.ok(html.includes('Task benchmark'));
    assert.ok(html.includes('express'));
    assert.ok(html.includes('flask'));
    assert.ok(!/<script[^>]+src=/i.test(html), 'must not include external script src');
    assert.ok(!/<link[^>]+href=/i.test(html), 'must not include external stylesheet link');
  });
});

test('render-benchmark-report --json returns file and summary', () => {
  withTempReports((dir) => {
    const out = execSync(`node "${SCRIPT}" --cwd "${dir}" --json`, {
      cwd: ROOT,
      encoding: 'utf8',
      timeout: 20000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const parsed = JSON.parse(out.trim());
    assert.strictEqual(parsed.ok, true);
    assert.ok(typeof parsed.file === 'string' && parsed.file.includes('benchmark-report.html'));
    assert.ok(parsed.summary && parsed.summary.tokenSummary);
    assert.ok(parsed.summary && parsed.summary.retrievalSummary);
  });
});

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
