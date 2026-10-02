#!/usr/bin/env node
'use strict';

/**
 * SigMap test runner — zero dependencies.
 * Usage:
 *   node test/run.js           — run all extractor tests
 *   node test/run.js typescript — run one language
 *   node test/run.js --update  — regenerate expected outputs
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const ROOT = path.join(__dirname, '..');
const FIXTURES_DIR = path.join(__dirname, 'fixtures');
const EXPECTED_DIR = path.join(__dirname, 'expected');

// Extractors that resolve by PATH, not by extension: their fixture must live
// at a routable location or `langFor` would send it elsewhere (#3, v8.50).
const FIXTURE_PATHS = {
  pipeline: path.join('.github', 'workflows', 'pipeline.yml'),
};

// Groovy has two supported surfaces: source files and Gradle build scripts.
// Keep one language snapshot while exercising both file extensions.
const FIXTURE_CASES = {
  groovy: ['groovy.groovy', 'groovy.gradle'],
};

const args = process.argv.slice(2);
const UPDATE = args.includes('--update');
const FILTER = args.filter((a) => !a.startsWith('--'))[0] || null;

// Language → fixture extension mapping
const LANG_EXT = {
  typescript: 'ts',
  javascript: 'js',
  python: 'py',
  java: 'java',
  kotlin: 'kt',
  go: 'go',
  rust: 'rs',
  csharp: 'cs',
  cpp: 'cpp',
  ruby: 'rb',
  php: 'php',
  swift: 'swift',
  dart: 'dart',
  scala: 'scala',
  groovy: 'groovy',
  lua: 'lua',
  elixir: 'ex',
  astro: 'astro',
  r: 'r',
  vue: 'vue',
  svelte: 'svelte',
  html: 'html',
  css: 'css',
  yaml: 'yml',
  pipeline: 'yml',
  shell: 'sh',
  dockerfile: 'Dockerfile',
  gdscript: 'gd',
};

let passed = 0;
let failed = 0;
const failures = [];

for (const [lang, ext] of Object.entries(LANG_EXT)) {
  if (FILTER && lang !== FILTER) continue;

  const fixtureNames = FIXTURE_CASES[lang] || [FIXTURE_PATHS[lang] || (ext === 'Dockerfile' ? 'Dockerfile' : `${lang}.${ext}`)];
  const fixturePaths = fixtureNames.map((name) => path.join(FIXTURES_DIR, name));
  const expectedPath = path.join(EXPECTED_DIR, `${lang}.txt`);
  const extractorPath = path.join(ROOT, 'src', 'extractors', `${lang}.js`);

  if (fixturePaths.some((fixturePath) => !fs.existsSync(fixturePath))) {
    const missing = fixturePaths.findIndex((fixturePath) => !fs.existsSync(fixturePath));
    console.log(`  SKIP  ${lang} — no fixture at test/fixtures/${fixtureNames[missing]}`);
    continue;
  }

  if (!fs.existsSync(extractorPath)) {
    console.log(`  SKIP  ${lang} — no extractor at src/extractors/${lang}.js`);
    continue;
  }

  let extractor;
  try {
    extractor = require(extractorPath);
  } catch (err) {
    console.log(`  FAIL  ${lang} — extractor load error: ${err.message}`);
    failed++;
    failures.push({ lang, error: err.message });
    continue;
  }

  let sigs;
  try {
    sigs = fixturePaths.flatMap((fixturePath, index) => {
      const src = fs.readFileSync(fixturePath, 'utf8');
      // Pass paths only to extractors whose behavior is path-sensitive. This
      // preserves Python's native AST fixture contract for every other language.
      const pathSensitive = Boolean(FIXTURE_PATHS[lang] || FIXTURE_CASES[lang]);
      return pathSensitive ? extractor.extract(src, fixtureNames[index]) : extractor.extract(src);
    });
  } catch (err) {
    console.log(`  FAIL  ${lang} — extract() threw: ${err.message}`);
    failed++;
    failures.push({ lang, error: err.message });
    continue;
  }

  // Validate contract: always returns array, never throws
  if (!Array.isArray(sigs)) {
    console.log(`  FAIL  ${lang} — extract() must return an array`);
    failed++;
    failures.push({ lang, error: 'did not return array' });
    continue;
  }

  const actual = sigs.join('\n') + (sigs.length > 0 ? '\n' : '');

  if (UPDATE || !fs.existsSync(expectedPath)) {
    if (!fs.existsSync(EXPECTED_DIR)) fs.mkdirSync(EXPECTED_DIR, { recursive: true });
    fs.writeFileSync(expectedPath, actual, 'utf8');
    console.log(`  UPD   ${lang} — wrote ${sigs.length} signatures to test/expected/${lang}.txt`);
    passed++;
    continue;
  }

  const expected = fs.readFileSync(expectedPath, 'utf8');

  if (actual === expected) {
    console.log(`  PASS  ${lang} (${sigs.length} signatures)`);
    passed++;
  } else {
    console.log(`  FAIL  ${lang}`);
    // Show diff summary
    const actualLines = actual.split('\n');
    const expectedLines = expected.split('\n');
    const maxLen = Math.max(actualLines.length, expectedLines.length);
    console.log(`         Expected ${expectedLines.length - 1} sigs, got ${actualLines.length - 1}`);
    for (let i = 0; i < Math.min(maxLen, 20); i++) {
      const a = actualLines[i] || '(missing)';
      const e = expectedLines[i] || '(missing)';
      if (a !== e) {
        console.log(`         line ${i + 1}: expected "${e}" got "${a}"`);
      }
    }
    failed++;
    failures.push({ lang, expected, actual });
  }
}

console.log('');
console.log(`Results: ${passed} passed, ${failed} failed`);

if (failed > 0) process.exit(1);
