'use strict';

/**
 * Content-hash extraction cache (#971): a re-run costs the files that changed.
 *
 * `generate` used to re-extract every file on every run: a second run with nothing
 * changed cost as much as the first. This keeps, per file, what the run derives from
 * its content (the signatures the extractor returned, the imports, the line and token
 * counts, the TODO lines and the module-doc line), keyed by the SHA-1 of the content,
 * in `.context/extract-cache.json` (already self-ignoring). A hit hands back exactly
 * what a fresh derivation would have produced, so the output of a warm run is
 * byte-identical to a cold one.
 *
 * What makes an entry valid is everything the derivation depends on besides the file,
 * and the cache records it once, as a fingerprint: SigMap's version, the extractor
 * sources and the CLI core that routes to them, the extraction ceiling, whether
 * imports are mapped, and the Python interpreter the AST tier would use. A different
 * fingerprint discards the whole file, which is how an extractor change, a version
 * bump or a different python3 force the right re-extraction.
 *
 * To avoid even reading a file that has not changed, an entry also remembers the
 * file's size and mtime. They are trusted only when the file was last modified more
 * than two seconds before the entry was written (the rule git applies to a "racily
 * clean" index entry): a file edited within the same clock tick, at the same size,
 * is read and hashed instead.
 *
 * Opt-in extraction tiers whose answer depends on something outside the file (the
 * repo's own typescript package, a language server, a SCIP index) are not cached.
 *
 * Zero-dependency, bundle-safe (fs, path, crypto only).
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SCHEMA = 2;
const CACHE_REL = path.join('.context', 'extract-cache.json');
/** A stat is believed only if the file is at least this much older than the entry (ms). */
const RACY_MS = 2000;

/** Hex SHA-1 of a string or Buffer. */
function sha1(data) {
  return crypto.createHash('sha1').update(data).digest('hex');
}

/** The cache key of a file's content. */
function contentHash(content) {
  return sha1(content);
}

/**
 * One hash for the files of `dir` that end in one of `extensions` (sorted by name; name
 * and bytes both in the hash), or '' when the directory is absent. Used for the
 * extractor sources.
 */
function treeHash(dir, extensions) {
  let names;
  try { names = fs.readdirSync(dir).filter((n) => extensions.some((e) => n.endsWith(e))).sort(); } catch (_) { return ''; }
  const h = crypto.createHash('sha1');
  for (const n of names) {
    h.update(n);
    h.update('\0');
    try { h.update(fs.readFileSync(path.join(dir, n))); } catch (_) { /* unreadable: the name still counts */ }
    h.update('\0');
  }
  return h.digest('hex');
}

/**
 * The fingerprint of everything a derivation depends on besides the file.
 *
 * @param {object} parts - version, the extraction ceiling, depMap, secretScan, the Python tier id, and
 *        the two hashes the caller computes from the install (`sources`, `core`)
 * @returns {string}
 */
function fingerprint(parts) {
  return sha1(JSON.stringify([SCHEMA, parts.version, parts.sources, parts.core, parts.readLimit, parts.depMap, parts.secretScan, parts.python]));
}

/** Whether an entry's remembered stat can stand in for reading the file. */
function trusted(e, st) {
  return !!st && Number.isFinite(e.w) && e.z === st.size && e.m === st.mtimeMs && e.m <= e.w - RACY_MS;
}

/**
 * Open the cache for a repository. A file that is absent, corrupt, from another
 * schema or under another fingerprint is the same as an empty cache.
 *
 * An entry is `{ h, z, m, w, s, d, l, k, g, t }`: content hash; size, mtime and the time it
 * was written; signatures, imports, lines, tokens, module-doc line, and (once something asked for
 * them) TODO lines.
 *
 * @param {string} cwd
 * @param {string} fp - fingerprint()
 */
function open(cwd, fp) {
  const file = path.join(cwd, CACHE_REL);
  let files = {};
  let toolchain = null;
  let memos = {};
  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (data && data.schema === SCHEMA && data.fingerprint === fp && data.files && typeof data.files === 'object') {
      files = data.files;
      toolchain = typeof data.toolchain === 'string' ? data.toolchain : null;
      if (data.memo && typeof data.memo === 'object') memos = data.memo;
    }
  } catch (_) { /* absent or unreadable: start empty */ }

  const loaded = Object.keys(files).length;
  const next = {};
  let changed = false;
  let toolchainChanged = false;
  const stats = { hits: 0, statHits: 0, misses: 0 };
  const originalToolchain = toolchain;
  const memoNext = {};
  let memoChanged = false;

  return {
    stats,
    loaded,
    get toolchain() { return toolchain; },
    setToolchain(label) {
      const v = typeof label === 'string' ? label : null;
      if (v !== toolchain) { toolchain = v; toolchainChanged = true; }
    },
    /** Whether the file is believed unchanged from its stat alone (no read needed). */
    fresh(rel, st) {
      const e = files[rel];
      return !!e && Array.isArray(e.s) && trusted(e, st);
    },
    /**
     * The entry for a file whose stat is trusted, without reading it; otherwise undefined.
     * An entry that holds signatures but not the fact a consumer reads (`need`, by default the
     * line count) is not served this way, so the file is read once and the entry completed.
     */
    peek(rel, st, need = 'l') {
      const e = files[rel];
      if (e && Array.isArray(e.s) && (e.s.length === 0 || e[need] !== undefined) && trusted(e, st)) {
        next[rel] = e; stats.hits++; stats.statHits++;
        return e;
      }
      return undefined;
    },
    /**
     * An answer a run derived from something other than a file's content (git history, for the
     * run's recent-changes section), kept under a name with the key it is valid for. Gives it
     * back only for that exact key.
     */
    memoGet(name, key) {
      const m = memos[name];
      if (m && m.k === key) { memoNext[name] = m; return m.v; }
      return undefined;
    },
    memoSet(name, key, value) {
      memoNext[name] = { k: key, v: value };
      memoChanged = true;
    },
    /** The entry this run holds for a file (one it has looked at), or undefined. */
    entryOf(rel) {
      return next[rel];
    },
    /** Add derived facts to an entry already held (marks the cache for writing). */
    update(entry, facts) {
      Object.assign(entry, facts);
      changed = true;
      return entry;
    },
    /** The entry for a file whose content hashes to `hash`; refreshes the remembered stat. */
    get(rel, hash, st) {
      const e = files[rel];
      if (e && e.h === hash && Array.isArray(e.s)) {
        stats.hits++;
        if (st && !trusted(e, st)) { e.z = st.size; e.m = st.mtimeMs; e.w = Date.now(); changed = true; }
        next[rel] = e;
        return e;
      }
      stats.misses++;
      return undefined;
    },
    set(rel, hash, facts, st) {
      const e = Object.assign({ h: hash, z: st ? st.size : null, m: st ? st.mtimeMs : null, w: Date.now() }, facts);
      next[rel] = e;
      changed = true;
      return e;
    },
    /**
     * Carry every loaded entry under `prefix` over untouched: for a run that does not visit
     * that part of the cache (the test entries are only collected when the index is written),
     * so that it is not mistaken for deleted files and dropped.
     */
    keep(prefix) {
      for (const rel of Object.keys(files)) {
        if (rel.startsWith(prefix) && !(rel in next)) next[rel] = files[rel];
      }
    },
    /**
     * Write the cache holding exactly the files this run saw (a deleted or renamed file
     * is dropped). Nothing is written when nothing changed. Failure to write is silent:
     * the cache is an accelerator, never a dependency.
     */
    save() {
      const pruned = Object.keys(files).some((rel) => !(rel in next)) || Object.keys(memos).some((n) => !(n in memoNext));
      if (!changed && !pruned && !memoChanged && !toolchainChanged && toolchain === originalToolchain) return false;
      try {
        const out = path.join(cwd, CACHE_REL);
        fs.mkdirSync(path.dirname(out), { recursive: true });
        try { require('../util/context-dir').ensureSelfIgnore(cwd); } catch (_) { /* best-effort */ }
        const body = {};
        for (const rel of Object.keys(next).sort()) body[rel] = next[rel];
        const tmp = `${out}.${process.pid}.tmp`;
        fs.writeFileSync(tmp, JSON.stringify({ schema: SCHEMA, fingerprint: fp, toolchain, memo: memoNext, files: body }), 'utf8');
        fs.renameSync(tmp, out);
        return true;
      } catch (_) { return false; }
    },
  };
}

module.exports = { SCHEMA, CACHE_REL, RACY_MS, contentHash, treeHash, fingerprint, open, sha1 };
