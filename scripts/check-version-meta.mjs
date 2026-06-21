#!/usr/bin/env node
/**
 * check-version-meta.mjs — keep version.json's derived counts honest.
 *
 * `version.json` carries metadata that must match the source of truth:
 *   - languages  : user-facing language extractors (src/extractors, helpers removed)
 *   - extractors : total extractor modules (languages + helpers)
 *   - mcp_tools  : number of MCP tools (src/mcp/tools.js `TOOLS`)
 *   - tests      : number of test files (test/**\/*.test.js + tests/**\/*.py)
 *
 * All four are derived from source via scripts/lib/source-meta.mjs — the same
 * derivation the llms.txt generator uses, so the language list can never
 * diverge (Trust Hygiene H3). Benchmark metrics live in benchmarks/latest.json
 * and are synced separately by scripts/sync-metrics.mjs.
 *
 * Usage:
 *   node scripts/check-version-meta.mjs        # check; exit 1 on drift
 *   node scripts/check-version-meta.mjs --fix  # write derived values
 *
 * Zero dependencies. Wired into prepublishOnly so a stale value blocks publish.
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { deriveCounts } from './lib/source-meta.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

/**
 * Compute the derived metadata from source.
 * @param {string} [root]
 * @returns {{ languages: number, extractors: number, mcp_tools: number, tests: number }}
 */
export function computeMeta(root = ROOT) {
  return deriveCounts(root);
}

/** Fields that are derived and gated, in version.json key order. */
const DERIVED = ['languages', 'extractors', 'mcp_tools', 'tests'];

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
    console.log(`✓ version.json metadata current (languages=${m.languages}, extractors=${m.extractors}, mcp_tools=${m.mcp_tools}, tests=${m.tests})`);
    return 0;
  }

  if (fix) {
    // Preserve formatting/order: rewrite the drifted numeric fields in place.
    let raw = readFileSync(join(ROOT, 'version.json'), 'utf8');
    for (const d of drift) {
      const re = new RegExp(`("${d.field}"\\s*:\\s*)\\d+`);
      if (!re.test(raw)) {
        console.error(`ERROR: version.json has no "${d.field}" field to update — add it first.`);
        return 1;
      }
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
