#!/usr/bin/env node
/**
 * check-version-meta.mjs — keep version.json's derived counts honest.
 *
 * `version.json` carries metadata that must match the source of truth:
 *   - mcp_tools : number of MCP tools (src/mcp/tools.js `TOOLS`)
 *   - tests     : number of test files (test/**\/*.test.js + tests/**\/*.py)
 *
 * `languages` is intentionally NOT derived — the extractor files include
 * non-language helpers (line-anchor, prdiff, todos, deps…) and dupes, so the
 * curated language count is editorial and stays hand-maintained.
 *
 * Usage:
 *   node scripts/check-version-meta.mjs        # check; exit 1 on drift
 *   node scripts/check-version-meta.mjs --fix  # write derived values
 *
 * Zero dependencies. Wired into prepublishOnly so a stale value blocks publish.
 */

import { readdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const require = createRequire(import.meta.url);

/** Count files under `dir` (recursive) whose name matches `re`. */
function countFiles(dir, re) {
  let n = 0;
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return 0; }
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) n += countFiles(full, re);
    else if (e.isFile() && re.test(e.name)) n += 1;
  }
  return n;
}

/**
 * Compute the derived metadata from source.
 * @param {string} [root]
 * @returns {{ mcp_tools: number, tests: number }}
 */
export function computeMeta(root = ROOT) {
  const { TOOLS } = require(join(root, 'src/mcp/tools.js'));
  const tests =
    countFiles(join(root, 'test'), /\.test\.js$/) +
    countFiles(join(root, 'tests'), /\.py$/);
  return { mcp_tools: TOOLS.length, tests };
}

/** Fields that are derived and gated. */
const DERIVED = ['mcp_tools', 'tests'];

function readVersionJson(root) {
  return JSON.parse(readFileSync(join(root, 'version.json'), 'utf8'));
}

/**
 * Return drift entries where version.json disagrees with computed values.
 * @param {string} [root]
 * @returns {Array<{field:string, actual:number, expected:number}>}
 */
export function findMetaDrift(root = ROOT) {
  const vj = readVersionJson(root);
  const meta = computeMeta(root);
  const drift = [];
  for (const f of DERIVED) {
    if (vj[f] !== meta[f]) drift.push({ field: f, actual: vj[f], expected: meta[f] });
  }
  return drift;
}

// ── CLI ──────────────────────────────────────────────────────────────────────
function main() {
  const fix = process.argv.includes('--fix');
  const drift = findMetaDrift();

  if (drift.length === 0) {
    const m = computeMeta();
    console.log(`✓ version.json metadata current (mcp_tools=${m.mcp_tools}, tests=${m.tests})`);
    return 0;
  }

  if (fix) {
    // Preserve formatting/order: only rewrite the drifted numeric fields in place.
    let raw = readFileSync(join(ROOT, 'version.json'), 'utf8');
    for (const d of drift) {
      const re = new RegExp(`("${d.field}"\\s*:\\s*)\\d+`);
      raw = raw.replace(re, `$1${d.expected}`);
    }
    writeFileSync(join(ROOT, 'version.json'), raw);
    console.log('✓ version.json updated:');
    for (const d of drift) console.log(`    ${d.field}: ${d.actual} → ${d.expected}`);
    return 0;
  }

  console.error('ERROR: version.json metadata is stale:');
  for (const d of drift) console.error(`  ${d.field}: ${d.actual} (source says ${d.expected})`);
  console.error('\nRun `node scripts/check-version-meta.mjs --fix` to update it, then commit version.json.');
  return 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exit(main());
}
