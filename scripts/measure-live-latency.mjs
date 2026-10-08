#!/usr/bin/env node
'use strict';

/**
 * measure-live-latency.mjs — how long does a save take to reach query results? (#926)
 *
 * "Live 4" is defined as: a file save is reflected in query results within a few
 * seconds without a full regeneration, and the staleness is observable. This
 * script measures the first half end to end, from OUTSIDE the watcher, so the
 * number includes everything a user waits for:
 *
 *   t0  the instant the probe is written to disk
 *   t1  the first moment the probe symbol is present in what `ask` / the MCP read
 *       tools consult — .context/overlay.json (patched) or .context/sig-index.json
 *       (regenerated)
 *
 * Each repo is copied to a scratch directory (the corpus clones are never
 * touched) and measured twice with a real `--watch` process:
 *   incremental  watchIncremental:true  — the per-file patch (the default)
 *   full         watchIncremental:false — one full regeneration per change (before #926)
 *
 * Opt-in and slow: not part of the default suite, not run in CI, and it needs a
 * platform with recursive fs.watch. The copies are deleted on exit.
 *
 *   node scripts/measure-live-latency.mjs [--root benchmarks/repos]
 *        [--repos click,gin,express] [--runs 5] [--json out.json]
 *
 * Zero dependencies.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawn, spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const GEN_SOURCE = path.join(ROOT, 'gen-context.js');
let GEN = GEN_SOURCE; // snapshotted into the scratch directory before any repo is measured
const { loadConfig } = createRequire(import.meta.url)(path.join(ROOT, 'src', 'config', 'loader.js'));

const args = process.argv.slice(2);
const arg = (name, dflt) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : dflt;
};

const REPOS_ROOT = path.resolve(arg('--root', path.join(ROOT, 'benchmarks', 'repos')));
const RUNS = Number(arg('--runs', '5'));
const WANT = arg('--repos', 'click,gin,express,vue-core,tokio').split(',').filter(Boolean);
const JSON_OUT = arg('--json', null);
const DEADLINE_MS = 120000;

// One probe per language: a new public top-level function every extractor lists.
// (A `__`-prefixed name reads as private to several extractors and is skipped.)
// `needle` is what the symbol looks like in a signature.
const PROBES = {
  '.js': (t, n) => ({ text: `\nexport function sigmapProbe${t}${n}() {}\n`, needle: `sigmapProbe${t}${n}(` }),
  '.ts': (t, n) => ({ text: `\nexport function sigmapProbe${t}${n}() {}\n`, needle: `sigmapProbe${t}${n}(` }),
  '.py': (t, n) => ({ text: `\n\ndef sigmap_probe_${t}_${n}():\n    pass\n`, needle: `sigmap_probe_${t}_${n}(` }),
  '.go': (t, n) => ({ text: `\nfunc SigmapProbe${t}${n}() {}\n`, needle: `SigmapProbe${t}${n}(` }),
  '.rs': (t, n) => ({ text: `\npub fn sigmap_probe_${t}_${n}() {}\n`, needle: `sigmap_probe_${t}_${n}(` }),
  '.rb': (t, n) => ({ text: `\ndef sigmap_probe_${t}_${n}; end\n`, needle: `sigmap_probe_${t}_${n}` }),
};
if (!(RUNS >= 1 && RUNS <= 9)) { console.error('--runs must be 1..9 (probe names must not be prefixes of each other)'); process.exit(2); }
// Each pass writes probes the other pass has never seen: a probe left in the file
// by an earlier pass is indexed by the next watcher's startup run and would read
// as instantly visible.

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const now = () => Number(process.hrtime.bigint()) / 1e6;
const median = (xs) => { const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
// With fewer than 20 samples a 95th percentile IS the maximum; it is reported (and labelled) as such.
const pct = (xs, p) => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)]; };
const TAIL = () => (RUNS < 20 ? 'max' : 'p95');

function copyRepo(src, dest) {
  fs.cpSync(src, dest, {
    recursive: true,
    filter: (p) => { const b = path.basename(p); return b !== '.git' && b !== 'node_modules'; },
  });
}

/**
 * A small, non-test source file the watcher will actually see: it must sit under
 * a configured srcDir, have a supported probe language, and carry few enough
 * signatures that an appended probe is not cut by maxSigsPerFile.
 */
function pickProbeFile(dir) {
  const idx = JSON.parse(fs.readFileSync(path.join(dir, '.context', 'sig-index.json'), 'utf8'));
  const { srcDirs } = loadConfig(dir);
  const norm = (d) => d.replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+$/, '');
  const roots = srcDirs.map(norm);
  const underSrc = (f) => roots.some((r) => r === '.' || r === '' || f === r || f.startsWith(r + '/'));
  const isTest = (f) => /(^|\/)(tests?|spec|__tests__|e2e|examples?|docs?)(\/|$)|\.(test|spec)\./.test(f);
  const candidates = Object.entries(idx.files)
    .filter(([f, sigs]) => PROBES[path.extname(f).toLowerCase()] && !isTest(f) && underSrc(f) && sigs.length >= 2 && sigs.length <= 12)
    .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
  if (candidates.length === 0) return null;
  const rel = candidates[0][0];
  return { rel, probe: PROBES[path.extname(rel).toLowerCase()], indexed: Object.keys(idx.files).length };
}

function writeConfig(dir, extra) {
  const file = path.join(dir, 'gen-context.config.json');
  let cfg = {};
  try { cfg = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (_) { /* none yet */ }
  fs.writeFileSync(file, JSON.stringify(Object.assign(cfg, extra)));
}

/** True once `needle` is in the overlay or the index — what a query would consult. */
function makeVisibilityCheck(dir, needle) {
  const files = ['overlay.json', 'sig-index.json'].map((f) => path.join(dir, '.context', f));
  const seen = new Map();
  return () => {
    for (const f of files) {
      let st;
      try { st = fs.statSync(f); } catch (_) { continue; }
      const stamp = `${st.mtimeMs}:${st.size}`;
      if (seen.get(f) === stamp) continue; // unchanged since the last look
      seen.set(f, stamp);
      try { if (fs.readFileSync(f, 'utf8').includes(needle)) return true; } catch (_) { /* mid-rename */ }
    }
    return false;
  };
}

async function measureMode(dir, probeFile, mode) {
  const incremental = mode === 'incremental';
  writeConfig(dir, { watchIncremental: incremental, watchDebounce: 300, watchSettleMs: 600000 });
  const child = spawn(process.execPath, [GEN, '--watch'], { cwd: dir, stdio: 'ignore' });
  let exited = null;
  child.on('exit', (code, signal) => { exited = `exit ${code}${signal ? ` (${signal})` : ''}`; });
  try {
    const liveFile = path.join(dir, '.context', 'live.json');
    const t = now();
    while (!(fs.existsSync(liveFile) && JSON.parse(fs.readFileSync(liveFile, 'utf8')).pid === child.pid)) {
      if (exited) throw new Error(`watcher exited at startup: ${exited}`);
      if (now() - t > DEADLINE_MS) throw new Error('watcher did not start');
      await sleep(100);
    }
    await sleep(1000); // let the platform finish registering the recursive watch

    const abs = path.join(dir, probeFile.rel);
    const samples = [];
    for (let n = 1; n <= RUNS; n++) {
      const { text, needle } = probeFile.probe(incremental ? 'i' : 'f', n);
      const visible = makeVisibilityCheck(dir, needle);
      const t0 = now();
      fs.appendFileSync(abs, text);
      let t1 = null;
      while (now() - t0 < DEADLINE_MS) {
        if (visible()) { t1 = now(); break; }
        await sleep(5);
      }
      if (t1 === null) throw new Error(`probe ${n} never became visible in ${mode} mode`);
      samples.push(t1 - t0);
      await sleep(incremental ? 400 : 1500); // let the pipeline go idle before the next save
    }
    const live = JSON.parse(fs.readFileSync(liveFile, 'utf8'));
    return { samples, regenMs: Number.isFinite(live.lastRegenMs) ? live.lastRegenMs : null, patchMs: Number.isFinite(live.lastPatchMs) ? live.lastPatchMs : null };
  } finally {
    try { child.kill('SIGKILL'); } catch (_) { /* gone */ }
    await sleep(200);
  }
}

async function main() {
  const platformOk = !(process.platform === 'linux' && Number(process.versions.node.split('.')[0]) < 20);
  if (!platformOk) { console.error('recursive fs.watch is unavailable on this platform (Linux, Node < 20)'); process.exit(2); }
  if (!fs.existsSync(GEN_SOURCE)) { console.error(`missing ${GEN_SOURCE}`); process.exit(2); }

  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-live-latency-'));
  // A rebuild of gen-context.js while this runs must not change what is measured.
  GEN = path.join(scratch, 'gen-context.js');
  fs.copyFileSync(GEN_SOURCE, GEN);
  const rows = [];
  try {
    for (const name of WANT) {
      const src = path.join(REPOS_ROOT, name);
      if (!fs.existsSync(src)) { console.error(`skip ${name}: not in ${REPOS_ROOT}`); continue; }
      const dir = path.join(scratch, name);
      process.stderr.write(`${name}: copying… `);
      copyRepo(src, dir);
      process.stderr.write('indexing… ');
      const c0 = now();
      const gen = spawnSync(process.execPath, [GEN], { cwd: dir, encoding: 'utf8' });
      const coldMs = now() - c0;
      if (gen.status !== 0) { console.error(`skip ${name}: generate failed`); continue; }
      const probeFile = pickProbeFile(dir);
      if (!probeFile) { console.error(`skip ${name}: no file with a supported probe language`); continue; }

      let inc; let full;
      try {
        inc = await measureMode(dir, probeFile, 'incremental');
        process.stderr.write('patch ok… ');
        full = await measureMode(dir, probeFile, 'full');
        process.stderr.write('full ok\n');
      } catch (err) {
        console.error(`skip ${name}: ${err.message}`);
        fs.rmSync(dir, { recursive: true, force: true });
        continue;
      }

      rows.push({
        repo: name, indexedFiles: probeFile.indexed, probeFile: probeFile.rel, coldGenerateMs: Math.round(coldMs),
        incremental: { p50: Math.round(median(inc.samples)), p95: Math.round(pct(inc.samples, 95)), samples: inc.samples.map(Math.round), patchMs: inc.patchMs },
        full: { p50: Math.round(median(full.samples)), p95: Math.round(pct(full.samples, 95)), samples: full.samples.map(Math.round), regenMs: full.regenMs },
      });
      fs.rmSync(dir, { recursive: true, force: true });
    }
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }

  const meta = {
    measuredAt: new Date().toISOString().slice(0, 10),
    machine: `${os.cpus()[0] ? os.cpus()[0].model.trim() : 'unknown cpu'} × ${os.cpus().length}`,
    os: `${os.type()} ${os.release()}`,
    node: process.versions.node,
    runsPerCell: RUNS,
    debounceMs: 300,
    loadAvg1m: Math.round(os.loadavg()[0] * 10) / 10,
  };
  const out = { meta, rows };
  if (JSON_OUT) fs.writeFileSync(JSON_OUT, JSON.stringify(out, null, 2));

  console.log(`\nSave → visible-to-queries latency, median (${TAIL()}) in ms — ${meta.measuredAt}, ${meta.machine}, ${meta.os}, Node ${meta.node}, ${RUNS} saves per cell, load ${meta.loadAvg1m}\n`);
  console.log('| repo | indexed files | cold generate | per-file patch | full regeneration | speed-up |');
  console.log('|---|---:|---:|---:|---:|---:|');
  for (const r of rows) {
    const x = r.incremental.p50 > 0 ? (r.full.p50 / r.incremental.p50).toFixed(1) + '×' : 'n/a';
    console.log(`| ${r.repo} | ${r.indexedFiles} | ${(r.coldGenerateMs / 1000).toFixed(1)} s | ${r.incremental.p50} (${r.incremental.p95}) | ${r.full.p50} (${r.full.p95}) | ${x} |`);
  }
  console.log('\nBoth columns include the 300 ms debounce. The per-file patch leaves the written context files for one regeneration after a quiet window (watchSettleMs); full regeneration is the "before" behaviour (watchIncremental:false).');
}

main().catch((err) => { console.error(err.stack || err.message); process.exit(1); });
