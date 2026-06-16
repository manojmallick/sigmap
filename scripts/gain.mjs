#!/usr/bin/env node
'use strict';

/**
 * SigMap `gain` — runnable CLI (src-only preview; bundling deferred).
 *
 * Usage:
 *   node scripts/gain.mjs                 # global summary + by-operation
 *   node scripts/gain.mjs --all           # daily / weekly / monthly trends
 *   node scripts/gain.mjs --json          # machine-readable aggregate
 *   node scripts/gain.mjs --since 7d      # window filter (7d, 30d, 12h, ISO date)
 *   node scripts/gain.mjs --top 5         # limit by-operation rows
 *   node scripts/gain.mjs --model gpt-4o  # pricing assumption for $
 *   node scripts/gain.mjs --seed          # write a realistic small log for THIS repo
 *   node scripts/gain.mjs --demo          # write a big RTK-style demo log, then render
 *   node scripts/gain.mjs --reset         # delete the local usage log
 */

import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const { aggregate } = require(path.join(ROOT, 'src/tracking/aggregate.js'));
const { renderSummary, renderBreakdown } = require(path.join(ROOT, 'src/format/gain-terminal.js'));
const { readGainLog } = require(path.join(ROOT, 'src/tracking/logger.js'));

const LOG_PATH = path.join(ROOT, '.context', 'gain.ndjson');

// ── arg parsing ───────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const val = (f, d) => { const i = argv.indexOf(f); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };

const opts = {
  model: val('--model', 'claude-sonnet'),
  since: val('--since', null),
  top: parseInt(val('--top', has('--all') ? '0' : '10'), 10),
};

function version() {
  try { return require(path.join(ROOT, 'version.json')).version; } catch { return ''; }
}

// ── seeders ────────────────────────────────────────────────────────────────
function appendRecords(records) {
  fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true });
  const lines = records.map((r) => JSON.stringify(r)).join('\n') + '\n';
  fs.appendFileSync(LOG_PATH, lines, 'utf8');
}

// Deterministic pseudo-random so seeds are reproducible.
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seed({ days, opsPerDay, tokenScale = 1, rngSeed }) {
  const rnd = mulberry32(rngSeed);
  const OPS = [
    { op: 'ask', weight: 0.45, base: [2200, 16000], pct: [0.90, 0.97], ms: [25, 70] },
    { op: 'mcp:search_signatures', weight: 0.25, base: [900, 5000], pct: [0.82, 0.94], ms: [1, 8] },
    { op: '--query', weight: 0.12, base: [2500, 15000], pct: [0.88, 0.96], ms: [25, 60] },
    { op: 'mcp:get_map', weight: 0.08, base: [3500, 22000], pct: [0.93, 0.98], ms: [3, 12] },
    { op: 'mcp:explain_file', weight: 0.06, base: [1200, 6000], pct: [0.80, 0.92], ms: [2, 9] },
    { op: 'generate', weight: 0.04, base: [11000, 34000], pct: [0.94, 0.985], ms: [120, 320] },
  ];
  const pick = () => { let r = rnd(); for (const o of OPS) { if ((r -= o.weight) <= 0) return o; } return OPS[0]; };
  const lerp = ([a, b]) => a + (b - a) * rnd();

  const records = [];
  const now = Date.now();
  for (let d = days - 1; d >= 0; d--) {
    const dayStart = now - d * 86400000;
    const n = Math.max(1, Math.round(opsPerDay * (0.5 + rnd())));
    for (let i = 0; i < n; i++) {
      const o = pick();
      const baseline = Math.round(lerp(o.base) * tokenScale);
      const pct = lerp(o.pct);
      const actual = Math.max(50, Math.round(baseline * (1 - pct)));
      const ts = new Date(dayStart + Math.floor(rnd() * 86400000)).toISOString();
      records.push({
        ts,
        v: version() || '7.0.1',
        op: o.op,
        baselineTokens: baseline,
        actualTokens: actual,
        savedTokens: baseline - actual,
        savedPct: Math.round((1 - actual / baseline) * 1000) / 10,
        durationMs: Math.round(lerp(o.ms)),
        model: 'claude-sonnet',
        ok: true,
      });
    }
  }
  records.sort((a, b) => (a.ts < b.ts ? -1 : 1));
  appendRecords(records);
  return records.length;
}

// ── main ─────────────────────────────────────────────────────────────────
if (has('--reset')) {
  if (fs.existsSync(LOG_PATH)) fs.unlinkSync(LOG_PATH);
  console.log('[sigmap] gain: usage log cleared.');
  process.exit(0);
}

if (has('--seed')) {
  const n = seed({ days: 4, opsPerDay: 45, tokenScale: 1, rngSeed: 42 });
  console.log(`[sigmap] gain: seeded ${n} realistic records → ${path.relative(ROOT, LOG_PATH)}`);
}

if (has('--demo')) {
  const n = seed({ days: 35, opsPerDay: 450, tokenScale: 1, rngSeed: 7 });
  console.log(`[sigmap] gain: seeded ${n} demo records → ${path.relative(ROOT, LOG_PATH)}\n`);
}

const records = readGainLog(ROOT);
const agg = aggregate(records, opts);

if (has('--json')) {
  console.log(JSON.stringify(agg, null, 2));
  process.exit(0);
}

const out = has('--all')
  ? renderSummary(agg, { version: version() }) + '\n' + renderBreakdown(agg)
  : renderSummary(agg, { version: version() });
process.stdout.write(out + '\n');
