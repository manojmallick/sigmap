'use strict';

/**
 * verify-plan (IMPL.md §6.1 — Gap 2, step 2 of the `create` pipeline).
 *
 * Checks a plan (markdown) against the LIVE index before execution: do the
 * referenced files and symbols exist, is the blast radius acceptable, is the
 * scope in bounds? Catches Cause 1+2 at plan time — cheaper than after the
 * code is written. Reuses the verify primitives + the impact graph.
 * Zero-dependency, bundle-safe.
 *
 * A plan has two kinds of name in it, and checking them the same way makes the
 * creation path unreachable (#666): a plan that *introduces* `formatDate` fails
 * stage 2 for naming a symbol that, by construction, does not exist yet. So a
 * `Creates:` section (or `--creates`) marks introductions, which are verified in
 * REVERSE — they must NOT exist — and excluded from the reference checks. With
 * neither present, nothing changes: every name is a reference, as before.
 */

const fs = require('fs');
const path = require('path');
const { extractFilePaths, extractSymbols } = require('../verify/parsers');
const { buildSymbolSet } = require('../verify/hallucination-guard');
const { confirmSymbols } = require('../verify/source-confirm');
const { closestMatch } = require('../verify/closest-match');
const { analyzeImpact } = require('../graph/impact');

const DEFAULT_BLAST_THRESHOLD = 20; // transitive+direct dependents → "high blast radius"
const DEFAULT_SCOPE_THRESHOLD = 10; // distinct referenced files → "broad scope"

/**
 * Heading/label that opens an introductions block, e.g. `## Creates`,
 * `**Creates:**`, `Creates:` — the plan format documented in cli.md.
 */
const CREATES_RE = /^\s*(#{1,6}\s+)?\*{0,2}creates(?:\s+new)?\*{0,2}\s*(:)?\*{0,2}\s*(.*)$/i;
/** Any other heading/label line closes the block. */
const SECTION_END_RE = /^\s*(?:#{1,6}\s|(?:\*\*)?[A-Za-z][\w \t-]{0,40}(?:\*\*)?\s*:\s*$)/;

/** Resolve a referenced path against cwd (handles a leading "./"). */
function _fileExists(cwd, ref) {
  const clean = ref.replace(/^\.\//, '');
  for (const c of [path.resolve(cwd, clean), path.resolve(cwd, ref)]) {
    try { if (fs.existsSync(c)) return true; } catch (_) {}
  }
  return false;
}

/** Strip markdown list bullets, backticks, call parens and trailing prose. */
function _cleanEntry(raw) {
  let s = String(raw || '').trim();
  s = s.replace(/^[-*+]\s+/, '').replace(/^\d+[.)]\s+/, '');
  const ticked = s.match(/`([^`]+)`/);
  if (ticked) s = ticked[1];
  s = s.split(/\s+[—–-]\s+/)[0];           // "foo() — does a thing"
  s = s.trim().replace(/\s*\([^)]*\)\s*$/, '').replace(/[,;.]+$/, '');
  return s.trim();
}

/**
 * Names a plan declares it will introduce.
 *
 * Reads a `Creates:` section — an inline list on the label line, the indented /
 * bulleted lines under it, or both — and stops at the next heading or label.
 * @param {string} text the plan as markdown
 * @returns {{ name: string, line: number }[]} deduped, first-seen line kept
 */
function extractIntroductions(text) {
  const lines = String(text || '').split('\n');
  const seen = new Map();
  const add = (raw, line) => {
    const name = _cleanEntry(raw);
    if (!name || /\s/.test(name) || !/[A-Za-z0-9]/.test(name)) return;  // prose, not a name
    if (!seen.has(name)) seen.set(name, line);
  };

  for (let i = 0; i < lines.length; i++) {
    const m = CREATES_RE.exec(lines[i]);
    if (!m || (!m[1] && !m[2])) continue;   // a label or heading, never prose
    for (const part of String(m[3] || '').split(',')) add(part, i + 1);
    for (let j = i + 1; j < lines.length; j++) {
      const line = lines[j];
      if (line.trim() === '') continue;
      if (SECTION_END_RE.test(line) && !/^[\s]*[-*+]/.test(line)) { i = j - 1; break; }
      if (!/^\s*(?:[-*+]|\d+[.)])\s+/.test(line) && !/^\s{2,}\S/.test(line)) { i = j - 1; break; }
      for (const part of line.split(',')) add(part, j + 1);
      i = j;
    }
  }
  return [...seen.entries()].map(([name, line]) => ({ name, line }));
}

/** True when an introduction names a file rather than a symbol. */
function _isPathLike(name) {
  return name.includes('/') || /\.[A-Za-z][A-Za-z0-9]*$/.test(name);
}

/**
 * Verify a plan against the live index.
 * @param {string} planText the plan as markdown
 * @param {string} cwd repo root
 * @param {object} [opts]
 * @param {number} [opts.blastThreshold=20]
 * @param {number} [opts.scopeThreshold=10]
 * @param {string[]} [opts.creates] names the plan introduces, in addition to
 *   any `Creates:` section — files (by path) or symbols (bare names)
 * @param {(ref:string)=>boolean} [opts.fileExists] override for testing
 * @param {(names: string[]) => { has: (name: string) => boolean }} [opts.confirmSymbols]
 *   override the source confirmation of a referenced symbol the index lacks (#914)
 * @returns {{ issues: object[], blast: object[], scope: object, introduces: object[], summary: object }}
 */
function verifyPlan(planText, cwd, opts = {}) {
  const blastThreshold = opts.blastThreshold != null ? opts.blastThreshold : DEFAULT_BLAST_THRESHOLD;
  const scopeThreshold = opts.scopeThreshold != null ? opts.scopeThreshold : DEFAULT_SCOPE_THRESHOLD;
  const fileExists = opts.fileExists || ((ref) => _fileExists(cwd, ref));

  const text = String(planText || '');
  const filesRef = extractFilePaths(text);   // [{ path, line }]
  const symbolsRef = extractSymbols(text);   // [{ name, line }]
  const { set: symbolSet, symbolCandidates, fileKeys } = buildSymbolSet(cwd);

  // Introductions: the `Creates:` section plus any `--creates` names. Both are
  // explicit author intent, so they are merged into one list.
  const intro = new Map();
  for (const { name, line } of extractIntroductions(text)) intro.set(name, line);
  for (const raw of (opts.creates || [])) {
    const name = _cleanEntry(raw);
    if (name && !intro.has(name)) intro.set(name, null);
  }
  const introFiles = new Set();
  const introSymbols = new Set();
  for (const name of intro.keys()) (_isPathLike(name) ? introFiles : introSymbols).add(name);

  const issues = [];

  // 0. Introductions must NOT exist yet — the redefinition guard. Verified from
  // the declaration itself, so an introduction the plan never mentions again is
  // still checked.
  const introduces = [];
  for (const [name, line] of intro) {
    const kind = introFiles.has(name) ? 'file' : 'symbol';
    const exists = kind === 'file' ? fileExists(name) : symbolSet.has(name);
    introduces.push({ name, kind, line, exists });
    if (exists) {
      issues.push({ type: 'redefines-existing', ref: name, kind, line, severity: 'error' });
    }
  }

  // 1. Referenced files must exist — unless the plan says it creates them.
  const existingFiles = [];
  for (const f of filesRef) {
    if (introFiles.has(f.path)) continue;
    if (fileExists(f.path)) existingFiles.push(f.path);
    else issues.push({ type: 'missing-file', ref: f.path, line: f.line, severity: 'error' });
  }

  // 2. Referenced symbols must exist in the live index (suggest a near match) —
  // or in the source: the index keeps `maxSigsPerFile` signatures a file and only
  // the files under the detected roots, and an `error` here blocks the plan on a
  // symbol that is real (#914). Only the references the index lacks are looked up.
  const missing = symbolsRef.filter((s) => !introSymbols.has(s.name) && !symbolSet.has(s.name));
  const confirmSource = opts.confirmSymbols
    || ((names) => confirmSymbols(cwd, names, { priority: fileKeys }).confirmed);
  const confirmed = missing.length ? confirmSource([...new Set(missing.map((s) => s.name))]) : null;
  for (const s of missing) {
    if (confirmed && confirmed.has(s.name)) continue;
    const match = closestMatch(s.name, symbolCandidates);
    issues.push({
      type: 'unknown-symbol', ref: s.name, line: s.line, severity: 'error',
      suggestion: match ? match.name : null,
    });
  }

  // 3. Blast radius for each existing referenced file (one graph build).
  const blast = [];
  if (existingFiles.length) {
    let impacts = [];
    try { impacts = analyzeImpact(existingFiles, cwd, {}); } catch (_) { impacts = []; }
    for (const { file, impact } of impacts) {
      const entry = { file, totalImpact: impact.totalImpact, tests: impact.tests.length };
      blast.push(entry);
      if (impact.totalImpact > blastThreshold) {
        issues.push({ type: 'high-blast-radius', ref: file, count: impact.totalImpact, severity: 'warn' });
      }
    }
    blast.sort((a, b) => b.totalImpact - a.totalImpact);
  }

  // 4. Scope — counted over files the plan touches, introduced or referenced.
  const scopeFiles = new Set([...filesRef.map((f) => f.path), ...introFiles]);
  const scope = { files: scopeFiles.size, symbols: symbolsRef.length, threshold: scopeThreshold };
  if (scopeFiles.size > scopeThreshold) {
    issues.push({ type: 'broad-scope', count: scopeFiles.size, threshold: scopeThreshold, severity: 'warn' });
  }

  const errors = issues.filter((i) => i.severity === 'error').length;
  const warnings = issues.filter((i) => i.severity === 'warn').length;
  return {
    issues,
    blast,
    scope,
    introduces,
    summary: {
      filesReferenced: filesRef.length,
      symbolsReferenced: symbolsRef.length,
      filesIntroduced: introFiles.size,
      symbolsIntroduced: introSymbols.size,
      errors,
      warnings,
      ok: errors === 0,
    },
  };
}

module.exports = { verifyPlan, extractIntroductions, DEFAULT_BLAST_THRESHOLD, DEFAULT_SCOPE_THRESHOLD };
