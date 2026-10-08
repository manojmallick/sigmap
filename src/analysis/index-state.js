'use strict';

/**
 * One definition of what the signature index holds, and of how old it is.
 *
 * WHY THIS EXISTS
 * ---------------
 * `generate` writes the index over an AUGMENTED population: the configured
 * `srcDirs` walk, widened by the declared package entrypoints, every test root
 * and every CI definition — all three deliberate, all three shipped so
 * `sigmap ask` can reach code that lives outside `srcDirs` by construction.
 *
 * `validate` and `doctor` measured that same index against the UN-widened
 * `srcDirs` list, so on this repo 266 perfectly good entries (256 under
 * `test/`, 10 under `.github/`) read as "stale index entries … re-run sigmap",
 * which fixed nothing because nothing was broken. Meanwhile `doctor` counted
 * the same 266 as indexed coverage and called the index fresh, and `status`
 * — reading only the usage log — said the index had never been built.
 *
 * Three private definitions of one population and one timestamp. This module
 * owns both, so the four surfaces can only agree. It classifies entries the
 * index already holds rather than re-walking the tree: the fix is a population
 * widening, not an index prune, and index size must not move because of it.
 *
 * Zero-dependency, bundle-safe (fs + path only).
 */

const fs = require('fs');
const path = require('path');

/**
 * Directory roots whose contents `generate` indexes as tests. Imported by
 * `collectTestEntries` so the collector and the classifier cannot drift.
 */
const TEST_ROOTS = ['test', 'tests', '__tests__', 'spec', 'e2e'];

/**
 * Directories holding CI / pipeline definitions. `.` covers the single-file
 * forms (.gitlab-ci.yml, Jenkinsfile, compose files, …). Imported by
 * `collectPipelineEntries` for the same reason as TEST_ROOTS.
 */
const CI_DIRS = [
  '.', '.github/workflows', '.gitea/workflows', '.forgejo/workflows',
  '.circleci', '.woodpecker',
];

/** The index artifact `generate` writes before the token budget is applied. */
const INDEX_REL = '.context/sig-index.json';

/** Generated context files, in the order the resolvers prefer them. */
const ADAPTER_OUTPUTS = [
  ['.github', 'copilot-instructions.md'],
  ['CLAUDE.md'],
  ['AGENTS.md'],
  ['.cursorrules'],
  ['.windsurfrules'],
  ['.github', 'openai-context.md'],
  ['.github', 'gemini-context.md'],
  ['llm-full.txt'],
  ['llm.txt'],
];

const EXCLUDE_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'out', '__pycache__',
  '.next', 'coverage', 'target', 'vendor', '.context',
]);

function _norm(p) {
  return String(p || '').replace(/\\/g, '/').replace(/^\.\//, '');
}

/**
 * Source files a project declares as its own entrypoints in package.json
 * (`main` and every `bin` target), repo-relative.
 *
 * @param {string} cwd
 * @returns {Set<string>}
 */
function declaredEntrypointPaths(cwd) {
  const out = new Set();
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), 'utf8'));
    const refs = [];
    if (typeof pkg.main === 'string') refs.push(pkg.main);
    if (typeof pkg.bin === 'string') refs.push(pkg.bin);
    else if (pkg.bin && typeof pkg.bin === 'object') {
      refs.push(...Object.values(pkg.bin).filter((v) => typeof v === 'string'));
    }
    for (const ref of refs) {
      const rel = _norm(path.relative(cwd, path.resolve(cwd, ref)));
      if (rel && !rel.startsWith('..')) out.add(rel);
    }
  } catch (_) { /* no package.json → nothing declared */ }
  return out;
}

/**
 * Why a repo-relative path is in the index despite falling outside `srcDirs`,
 * or null when nothing justifies it.
 *
 * @param {string} rel - repo-relative, forward slashes
 * @param {{ entrypoints?: Set<string> }} [ctx]
 * @returns {'test'|'ci'|'entrypoint'|null}
 */
function augmentedReason(rel, ctx = {}) {
  const r = _norm(rel);
  if (!r) return null;
  if (ctx.entrypoints && ctx.entrypoints.has(r)) return 'entrypoint';

  const first = r.split('/')[0];
  if (r.includes('/') && TEST_ROOTS.includes(first)) return 'test';

  const dir = r.includes('/') ? r.slice(0, r.lastIndexOf('/')) : '.';
  if (CI_DIRS.includes(dir)) {
    // The extractor's own routing decides what counts as a pipeline file, so
    // this cannot drift from `langFor`. A root-level file only qualifies when
    // the extractor claims it — `.` would otherwise match the whole repo root.
    let platformFor = null;
    try { ({ platformFor } = require('../extractors/pipeline')); } catch (_) {}
    if (platformFor && platformFor(r)) return 'ci';
  }
  return null;
}

/**
 * Split the entries an index holds into the four classes that have different
 * remedies.
 *
 * `inScope` and `augmented` are both legitimate — together they are the
 * population `generate` writes. `missing` and `outOfScope` are the two real
 * stale classes, separated because a deleted file is cleared by re-running
 * `sigmap` while a file that merely left `srcDirs` is a config question.
 *
 * @param {string} cwd
 * @param {Iterable<string>} indexedRel - repo-relative keys of the index
 * @param {{srcDirs?: string[]}} config
 * @returns {{ inScope: string[], augmented: string[], missing: string[],
 *             outOfScope: string[], stale: number, byReason: object }}
 */
function classifyIndexEntries(cwd, indexedRel, config) {
  const srcDirs = (config && Array.isArray(config.srcDirs) && config.srcDirs.length)
    ? config.srcDirs.map((d) => _norm(d).replace(/\/+$/, ''))
    : ['src', 'app', 'lib'];
  const entrypoints = declaredEntrypointPaths(cwd);

  const inScope = [];
  const augmented = [];
  const missing = [];
  const outOfScope = [];
  const byReason = { test: 0, ci: 0, entrypoint: 0 };

  for (const raw of indexedRel || []) {
    const rel = _norm(raw);
    if (!rel) continue;
    let exists = true;
    try { exists = fs.statSync(path.join(cwd, rel)).isFile(); } catch (_) { exists = false; }
    if (!exists) { missing.push(rel); continue; }

    if (srcDirs.some((d) => rel === d || rel.startsWith(`${d}/`))) { inScope.push(rel); continue; }

    const reason = augmentedReason(rel, { entrypoints });
    if (reason) { augmented.push(rel); byReason[reason]++; continue; }

    outOfScope.push(rel);
  }

  return {
    inScope, augmented, missing, outOfScope,
    stale: missing.length + outOfScope.length,
    byReason,
  };
}

/**
 * Human summary of the augmented entries, e.g. "256 test, 10 CI".
 *
 * @param {{ byReason: object }} classification
 * @returns {string}
 */
function formatAugmented(classification) {
  const by = (classification && classification.byReason) || {};
  const label = { test: 'test', ci: 'CI', entrypoint: 'entrypoint' };
  return Object.keys(label)
    .filter((k) => by[k] > 0)
    .map((k) => `${by[k]} ${label[k]}`)
    .join(', ');
}

/**
 * Remediation lines for whatever stale classes are actually present, each
 * naming a command or change that fixes THAT class. Empty when nothing is
 * stale — the previous single message advised re-running `sigmap` for entries
 * a re-run could never clear.
 *
 * @param {{ missing: string[], outOfScope: string[] }} classification
 * @returns {string[]}
 */
function staleRemedies(classification) {
  const out = [];
  const missing = (classification && classification.missing) || [];
  const outOfScope = (classification && classification.outOfScope) || [];
  if (missing.length) {
    out.push(`${missing.length} indexed file(s) no longer exist (e.g. ${missing[0]}) — run: sigmap   (a full run prunes them)`);
  }
  if (outOfScope.length) {
    out.push(`${outOfScope.length} indexed file(s) are outside srcDirs with no test/CI/entrypoint role (e.g. ${outOfScope[0]}) — widen "srcDirs" in gen-context.config.json, or run: sigmap roots --fix`);
  }
  return out;
}

/** Newest mtime among the generated context files, or 0 when none exist. */
function _contextMtime(cwd) {
  let newest = 0;
  for (const parts of ADAPTER_OUTPUTS) {
    try {
      const m = fs.statSync(path.join(cwd, ...parts)).mtimeMs;
      if (m > newest) newest = m;
    } catch (_) {}
  }
  return newest;
}

/**
 * When the index was last built, and from which evidence.
 *
 * Ordered by how much the source actually knows: the usage log records the run
 * itself but only exists under `--track`; the index artifact records its own
 * `generated` stamp, file count and version; the context file knows only its
 * mtime. `status` reported `never` whenever the first was absent, which is the
 * default — hence the disclosed fallback rather than a silent one.
 *
 * @param {string} cwd
 * @returns {{ ts: string|null, source: string|null, files: number|null,
 *             version: string|null }}
 */
function indexFreshness(cwd) {
  // 1. Usage log — the run itself, when tracking is on.
  try {
    const { readLog } = require('../tracking/logger');
    const log = readLog(cwd) || [];
    if (log.length) {
      const last = log[log.length - 1];
      if (last && last.ts) {
        return {
          ts: last.ts,
          source: 'usage log',
          files: last.fileCount != null ? last.fileCount : null,
          version: last.version || null,
        };
      }
    }
  } catch (_) {}

  // 2. The retrieval index — self-describing, written by every full run.
  try {
    const abs = path.join(cwd, INDEX_REL);
    const data = JSON.parse(fs.readFileSync(abs, 'utf8'));
    const ts = data && data.generated
      ? data.generated
      : new Date(fs.statSync(abs).mtimeMs).toISOString();
    return {
      ts,
      source: INDEX_REL,
      files: data && data.files ? Object.keys(data.files).length : null,
      version: (data && data.sigmapVersion) || null,
    };
  } catch (_) {}

  // 3. The generated context file — mtime only.
  const ctx = _contextMtime(cwd);
  if (ctx > 0) {
    return { ts: new Date(ctx).toISOString(), source: 'context file mtime', files: null, version: null };
  }

  return { ts: null, source: null, files: null, version: null };
}

/**
 * Count code files under `srcDirs` modified after `sinceMs`.
 *
 * Lifted out of `doctor` so `status` counts the same thing: the two reported
 * different freshness because they were reading different populations with
 * different timestamps, and sharing only the timestamp would have left half
 * the disagreement in place.
 *
 * @param {string} cwd
 * @param {{srcDirs?: string[], exclude?: string[]}} config
 * @param {number} sinceMs
 * @param {Map<string,{at:number}>} [covered] - live overlay entries; a file whose
 *        entry was stamped at or after its last write is already reflected in
 *        queries, so it does not count as changed (#926)
 * @returns {number}
 */
function changedSince(cwd, config, sinceMs, covered) {
  const { CODE_EXTS } = require('./coverage-score');
  const exclude = new Set(EXCLUDE_DIRS);
  if (config && Array.isArray(config.exclude)) for (const x of config.exclude) exclude.add(String(x));
  const srcDirs = (config && Array.isArray(config.srcDirs) && config.srcDirs.length)
    ? config.srcDirs : ['src', 'app', 'lib'];

  let changed = 0;
  let seen = 0;
  const walk = (dir, depth) => {
    if (depth > 8 || seen > 5000) return;
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (_) { return; }
    for (const e of entries) {
      if (exclude.has(e.name)) continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full, depth + 1);
      else if (e.isFile() && CODE_EXTS.has(path.extname(e.name).toLowerCase())) {
        seen++;
        try {
          const m = fs.statSync(full).mtimeMs;
          if (m > sinceMs && !isCovered(covered, cwd, full, m)) changed++;
        } catch (_) {}
      }
    }
  };
  for (const d of srcDirs) {
    const abs = path.isAbsolute(d) ? d : path.join(cwd, d);
    if (fs.existsSync(abs)) walk(abs, 0);
  }
  return changed;
}

/**
 * Whether a live overlay entry already describes `fullPath` as of `mtimeMs`.
 * An entry is stamped before the file is read, so an edit that lands during the
 * read leaves the file's mtime ahead of the stamp and it stays uncovered.
 */
function isCovered(covered, cwd, fullPath, mtimeMs) {
  if (!covered || covered.size === 0) return false;
  const rel = path.relative(cwd, fullPath).replace(/\\/g, '/');
  const e = covered.get(rel);
  // `at` comes from Date.now() (whole ms) and an mtime carries a fraction, so a
  // write in the same millisecond as the stamp must still count as covered.
  // An additive entry adds one symbol to a file it knows nothing else about, so
  // it says nothing about the rest of the file and cannot vouch for it.
  return !!e && !e.additive && e.at >= Math.floor(mtimeMs);
}

/**
 * The live half of index freshness: what the overlay holds beyond the last full
 * run, and what the watcher last measured. Everything derivable is derived here
 * at read time; only the watcher's own measurements come from `.context/live.json`.
 * A figure nobody measured is `null` — never `0`.
 *
 * @param {string} cwd
 * @returns {{ overlayDepth: number, overlay: Map, watcher: {running:boolean, pid:number|null}|null,
 *             lastLatencyMs: number|null, lastLatencyPath: string|null, lastPatchAt: string|null,
 *             lastRegenAt: string|null, lastRegenMs: number|null, patches: number|null,
 *             regens: number|null, settleMs: number|null, incremental: boolean|null,
 *             measured: boolean }}
 */
function liveIndexState(cwd) {
  const overlay = require('../cache/overlay');
  const { readIndexStamp } = require('../retrieval/sig-index-store');
  const all = overlay.load(cwd);
  let baseMs = readIndexStamp(cwd);
  if (!Number.isFinite(baseMs)) baseMs = _contextMtime(cwd);
  const pending = overlay.pending(all, baseMs);

  const t = overlay.readLive(cwd);
  let watcher = null;
  if (t && Number.isFinite(t.pid)) {
    let running = false;
    try { process.kill(t.pid, 0); running = true; } catch (err) { running = err.code === 'EPERM'; }
    // A live pid is necessary, not sufficient: a crashed watcher's number can be
    // reused. A watcher that reports a heartbeat must have beaten recently (it
    // beats every 20 s); one that predates the heartbeat is judged by pid alone.
    if (running && t.heartbeatAt) {
      const age = Date.now() - Date.parse(t.heartbeatAt);
      if (Number.isFinite(age) && age > 90000) running = false;
    }
    watcher = { running, pid: running ? t.pid : null };
  }
  const num = (v) => (Number.isFinite(v) ? v : null);
  return {
    overlayDepth: pending.size,
    overlay: all,
    watcher,
    lastLatencyMs: t ? num(t.lastLatencyMs) : null,
    lastLatencyPath: t && typeof t.lastLatencyPath === 'string' ? t.lastLatencyPath : null,
    lastPatchAt: t && t.lastPatchAt ? t.lastPatchAt : null,
    lastRegenAt: t && t.lastRegenAt ? t.lastRegenAt : null,
    lastRegenMs: t ? num(t.lastRegenMs) : null,
    patches: t ? num(t.patches) : null,
    regens: t ? num(t.regens) : null,
    settleMs: t ? num(t.settleMs) : null,
    incremental: t && typeof t.incremental === 'boolean' ? t.incremental : null,
    measured: !!t && Number.isFinite(t.lastLatencyMs),
  };
}

module.exports = {
  TEST_ROOTS,
  CI_DIRS,
  INDEX_REL,
  ADAPTER_OUTPUTS,
  declaredEntrypointPaths,
  augmentedReason,
  classifyIndexEntries,
  formatAugmented,
  staleRemedies,
  indexFreshness,
  changedSince,
  isCovered,
  liveIndexState,
};
