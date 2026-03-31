'use strict';

/**
 * Classify files by complexity tier for model routing hints.
 *
 * Tiers:
 *   'fast'     — simple files: config, markup, templates, trivial utilities
 *   'balanced' — standard application code: moderate functions and classes
 *   'powerful' — complex files: large classes, many exports, security-critical paths
 *
 * @param {string} filePath - absolute path to the file
 * @param {string[]} sigs   - extracted signatures for the file
 * @returns {'fast'|'balanced'|'powerful'}
 */
function classify(filePath, sigs) {
  const lower = filePath.toLowerCase();
  const sigCount = sigs.length;

  // ── Fast tier heuristics ────────────────────────────────────────────────
  // Configuration, markup, templates, and trivial utilities are small tasks
  if (
    lower.endsWith('.json') ||
    lower.endsWith('.yml') ||
    lower.endsWith('.yaml') ||
    lower.endsWith('.toml') ||
    lower.endsWith('.env') ||
    lower.endsWith('.html') ||
    lower.endsWith('.htm') ||
    lower.endsWith('.css') ||
    lower.endsWith('.scss') ||
    lower.endsWith('.sass') ||
    lower.endsWith('.less') ||
    /dockerfile/i.test(lower) ||
    lower.endsWith('.sh') ||
    lower.endsWith('.bash') ||
    lower.endsWith('.zsh') ||
    lower.endsWith('.fish')
  ) {
    return 'fast';
  }

  // Config-like directories
  if (
    lower.includes('/config/') ||
    lower.includes('/configs/') ||
    lower.includes('/fixtures/') ||
    lower.includes('/migrations/') ||
    lower.includes('/seeds/')
  ) {
    return sigCount > 4 ? 'balanced' : 'fast';
  }

  // Test files — usually standard complexity
  if (/\.(test|spec)\.[a-z]+$/.test(lower) || /_test\.[a-z]+$/.test(lower)) {
    return 'balanced';
  }

  // ── Powerful tier heuristics — high-signal keywords in the path ─────────
  if (
    lower.includes('/security/') ||
    lower.includes('/auth/') ||
    lower.includes('/crypto/') ||
    lower.includes('/core/') ||
    lower.includes('/engine/') ||
    lower.includes('/compiler/') ||
    lower.includes('/parser/') ||
    lower.includes('/scheduler/') ||
    lower.includes('/orchestrat')
  ) {
    return 'powerful';
  }

  // Many exports → complex file
  if (sigCount >= 12) return 'powerful';

  // Large number of class-level methods (indented 2-space sigs)
  const methodCount = sigs.filter((s) => s.startsWith('  ')).length;
  if (methodCount >= 8) return 'powerful';

  // ── Balanced covers everything else ────────────────────────────────────
  if (sigCount <= 2) return 'fast';
  return 'balanced';
}

/**
 * Classify all file entries and group them by tier.
 *
 * @param {Array<{filePath: string, sigs: string[]}>} fileEntries
 * @returns {{ fast: string[], balanced: string[], powerful: string[] }}
 *   Each array contains relative paths (relative to cwd).
 */
function classifyAll(fileEntries, cwd) {
  const path = require('path');
  const result = { fast: [], balanced: [], powerful: [] };
  for (const { filePath, sigs } of fileEntries) {
    const tier = classify(filePath, sigs);
    result[tier].push(path.relative(cwd, filePath));
  }
  return result;
}

module.exports = { classify, classifyAll };
