#!/usr/bin/env node
'use strict';

/**
 * Fail (exit 1) if the committed llms.txt / llms-full.txt differ from what the
 * generator would produce — so a PR can never merge with stale LLM docs (#242).
 *
 *   npm run validate:llms
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { generate, TARGETS } from './generate-llms.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const { concise, full } = generate();
const expected = [
  ...TARGETS.concise.map((rel) => [rel, concise]),
  ...TARGETS.full.map((rel) => [rel, full]),
];

let stale = false;
for (const [rel, want] of expected) {
  let got = null;
  try { got = fs.readFileSync(path.join(ROOT, rel), 'utf8'); } catch (_) { got = null; }
  if (got !== want) {
    console.error(`❌ ${rel} is out of date`);
    stale = true;
  }
}

if (stale) {
  console.error('\n   Run: npm run generate:llms   (then commit the updated files)');
  process.exit(1);
}
console.log(`✓ llms.txt + llms-full.txt are current (${expected.length} files checked)`);
