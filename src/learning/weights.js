'use strict';

const fs = require('fs');
const path = require('path');

const DECAY = 0.95;
const MAX_MULT = 3.0;
const MIN_MULT = 0.30;
const BASELINE = 1.0;

function weightsPath(cwd) {
  return path.join(cwd, '.context', 'weights.json');
}

function clampMultiplier(value) {
  if (!Number.isFinite(value)) return BASELINE;
  if (value > MAX_MULT) return MAX_MULT;
  if (value < MIN_MULT) return MIN_MULT;
  return parseFloat(value.toFixed(6));
}

function normalizeFile(cwd, filePath) {
  if (!cwd || !filePath || typeof filePath !== 'string') return null;
  const cleaned = filePath.trim().replace(/\\/g, '/');
  if (!cleaned) return null;

  const abs = path.resolve(cwd, cleaned);
  const rel = path.relative(cwd, abs);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) return null;
  return rel.split(path.sep).join('/');
}

function sanitizeWeights(cwd, weights) {
  const out = {};
  const entries = weights && typeof weights === 'object' ? Object.entries(weights) : [];

  for (const [filePath, raw] of entries) {
    const normalized = normalizeFile(cwd, filePath);
    if (!normalized) continue;
    const mult = clampMultiplier(Number(raw));
    if (Math.abs(mult - BASELINE) < 1e-9) continue;
    out[normalized] = mult;
  }

  return out;
}

function loadWeights(cwd) {
  try {
    const parsed = JSON.parse(fs.readFileSync(weightsPath(cwd), 'utf8'));
    return sanitizeWeights(cwd, parsed);
  } catch (_) {
    return {};
  }
}

function saveWeights(cwd, weights) {
  const cleaned = sanitizeWeights(cwd, weights);
  const outPath = weightsPath(cwd);

  if (Object.keys(cleaned).length === 0) {
    try {
      if (fs.existsSync(outPath)) fs.unlinkSync(outPath);
    } catch (_) {}
    return;
  }

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  const sorted = Object.keys(cleaned)
    .sort()
    .reduce((acc, key) => {
      acc[key] = cleaned[key];
      return acc;
    }, {});
  fs.writeFileSync(outPath, JSON.stringify(sorted, null, 2) + '\n', 'utf8');
}

function updateWeights(cwd, opts = {}) {
  const goodAmount = Number.isFinite(opts.goodAmount) ? opts.goodAmount : 0.15;
  const badAmount = Number.isFinite(opts.badAmount) ? opts.badAmount : 0.10;
  const goodFiles = Array.isArray(opts.goodFiles) ? opts.goodFiles : [];
  const badFiles = Array.isArray(opts.badFiles) ? opts.badFiles : [];

  const weights = loadWeights(cwd);

  for (const key of Object.keys(weights)) {
    weights[key] = clampMultiplier(weights[key] * DECAY);
  }

  const good = [];
  const bad = [];

  for (const filePath of goodFiles) {
    const normalized = normalizeFile(cwd, filePath);
    if (!normalized) continue;
    weights[normalized] = clampMultiplier((weights[normalized] || BASELINE) + goodAmount);
    good.push(normalized);
  }

  for (const filePath of badFiles) {
    const normalized = normalizeFile(cwd, filePath);
    if (!normalized) continue;
    weights[normalized] = clampMultiplier((weights[normalized] || BASELINE) - badAmount);
    bad.push(normalized);
  }

  saveWeights(cwd, weights);
  return { good, bad, weights: loadWeights(cwd) };
}

function boostFiles(cwd, files, amount = 0.15) {
  return updateWeights(cwd, { goodFiles: files, goodAmount: amount });
}

function penalizeFiles(cwd, files, amount = 0.10) {
  return updateWeights(cwd, { badFiles: files, badAmount: amount });
}

function resetWeights(cwd) {
  const outPath = weightsPath(cwd);
  if (fs.existsSync(outPath)) fs.unlinkSync(outPath);
}

function exportWeights(cwd, outputPath) {
  const weights = loadWeights(cwd);
  const json = JSON.stringify(weights, null, 2) + '\n';
  if (outputPath) {
    fs.mkdirSync(path.dirname(path.resolve(outputPath)), { recursive: true });
    fs.writeFileSync(outputPath, json, 'utf8');
  } else {
    process.stdout.write(json);
  }
  return weights;
}

function importWeights(cwd, importPath, replace) {
  let incoming;
  try {
    incoming = JSON.parse(fs.readFileSync(importPath, 'utf8'));
  } catch (err) {
    throw new Error(`Cannot read weights file: ${err.message}`);
  }
  const sanitized = sanitizeWeights(cwd, incoming);
  if (replace) {
    saveWeights(cwd, sanitized);
    return sanitized;
  }
  const existing = loadWeights(cwd);
  const merged = Object.assign({}, existing, sanitized);
  saveWeights(cwd, merged);
  return merged;
}

module.exports = {
  BASELINE,
  DECAY,
  MAX_MULT,
  MIN_MULT,
  weightsPath,
  clampMultiplier,
  normalizeFile,
  loadWeights,
  saveWeights,
  updateWeights,
  boostFiles,
  penalizeFiles,
  resetWeights,
  exportWeights,
  importWeights,
};
