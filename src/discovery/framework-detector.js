'use strict';

const fs   = require('fs');
const path = require('path');
const { REGISTRY } = require('./source-root-registry');

function detectFrameworks(cwd) {
  const detected = [];
  const names = _nameSets(cwd);

  for (const [lang, reg] of Object.entries(REGISTRY)) {
    if (!reg.frameworks) continue;
    for (const [name, fw] of Object.entries(reg.frameworks)) {
      let confidence = 0;

      // Detection files: +0.95 / 0.93 / 0.90 depending on specificity
      for (const f of (fw.detectionFiles || [])) {
        if (_existsAnywhere(cwd, f, 3, names)) { confidence = Math.max(confidence, 0.93); }
      }

      // Detection deps in package.json
      if (fw.detectionDeps?.length) {
        const deps = _readDeps(cwd);
        for (const dep of fw.detectionDeps) {
          if (deps.has(dep)) { confidence = Math.max(confidence, 0.90); }
        }
      }

      // go.mod and Cargo.toml deps
      if (lang === 'go' && fw.detectionDeps?.length) {
        const goMod = _readFile(path.join(cwd, 'go.mod'));
        for (const dep of fw.detectionDeps) {
          if (goMod.includes(dep)) { confidence = Math.max(confidence, 0.90); }
        }
      }
      if (lang === 'rust' && fw.detectionDeps?.length) {
        const cargoToml = _readFile(path.join(cwd, 'Cargo.toml'));
        for (const dep of fw.detectionDeps) {
          if (cargoToml.includes(dep)) { confidence = Math.max(confidence, 0.88); }
        }
      }

      // Special rules
      if (fw.specialRule === 'django-app-dirs' && fs.existsSync(path.join(cwd, 'manage.py'))) {
        confidence = Math.max(confidence, 0.95);
      }
      if (fw.specialRule === 'swift-project-dir' && _existsAnywhere(cwd, '.xcodeproj', 2, names)) {
        confidence = Math.max(confidence, 0.90);
      }

      if (confidence > 0) detected.push({ name, language: lang, confidence });
    }
  }

  return detected.sort((a, b) => b.confidence - a.confidence);
}

function _readDeps(cwd) {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), 'utf8'));
    return new Set([...Object.keys(pkg.dependencies || {}), ...Object.keys(pkg.devDependencies || {})]);
  } catch { return new Set(); }
}

function _readFile(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch { return ''; }
}

function _existsAnywhere(cwd, filename, maxDepth, names) {
  const parts = filename.split('/');
  if (parts.length > 1) return fs.existsSync(path.join(cwd, filename));
  return (names ? names.of(maxDepth) : _walkNames(cwd, maxDepth)).has(filename);
}

/**
 * Every entry name found by listing `depth` levels of directories under `dir`: the
 * root's entries, those of its subdirectories, and so on. A name is "found" exactly when the
 * old per-name walk (`_walkFind`) would have found it, but the tree is listed once, not once
 * for each of the ~50 names a run asks about (that was 160-340 ms on Django, #971).
 */
function _walkNames(dir, depth, out = new Set()) {
  if (depth <= 0) return out;
  try {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      out.add(e.name);
      if (e.isDirectory() && depth > 1) _walkNames(path.join(dir, e.name), depth - 1, out);
    }
  } catch (_) { /* an unreadable directory has no names */ }
  return out;
}

/** The name sets of one `detectFrameworks` run, listed on first use and once per depth. */
function _nameSets(cwd) {
  const byDepth = new Map();
  return { of(depth) { if (!byDepth.has(depth)) byDepth.set(depth, _walkNames(cwd, depth)); return byDepth.get(depth); } };
}

// `_walkNames` is exported for the test that holds it to the per-name walk it replaced.
module.exports = { detectFrameworks, _walkNames };
