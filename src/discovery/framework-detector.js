'use strict';

const fs   = require('fs');
const path = require('path');
const { REGISTRY } = require('./source-root-registry');

module.exports = { detectFrameworks };

function detectFrameworks(cwd) {
  const detected = [];

  for (const [lang, reg] of Object.entries(REGISTRY)) {
    if (!reg.frameworks) continue;
    for (const [name, fw] of Object.entries(reg.frameworks)) {
      let confidence = 0;

      // Detection files: +0.95 / 0.93 / 0.90 depending on specificity
      for (const f of (fw.detectionFiles || [])) {
        if (_existsAnywhere(cwd, f, 3)) { confidence = Math.max(confidence, 0.93); }
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
      if (fw.specialRule === 'swift-project-dir' && _existsAnywhere(cwd, '.xcodeproj', 2)) {
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

function _existsAnywhere(cwd, filename, maxDepth) {
  const parts = filename.split('/');
  if (parts.length > 1) return fs.existsSync(path.join(cwd, filename));
  return _walkFind(cwd, filename, maxDepth);
}

function _walkFind(dir, name, depth) {
  if (depth <= 0) return false;
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      if (e.name === name) return true;
      if (e.isDirectory() && depth > 1) {
        if (_walkFind(path.join(dir, e.name), name, depth - 1)) return true;
      }
    }
  } catch (_) {}
  return false;
}
