'use strict';

/**
 * Parsers for R package manifest files (DESCRIPTION + NAMESPACE).
 *
 * Zero-dependency, regex/line-based. Both readers are safe on missing files
 * (return null) and on malformed input (return whatever could be parsed).
 *
 * Exports:
 *   readDescription(cwd) → { package, version, imports[], depends[], suggests[], linkingTo[] } | null
 *   readNamespace(cwd)   → { exports: Set, exportPatterns: RegExp[], s3methods: [{generic,class}], importFrom: Map<pkg, Set<name>> } | null
 *   collectLocalDefs(rFiles) → Map<defName, absPath>
 */

const fs   = require('fs');
const path = require('path');

/**
 * Parse a DESCRIPTION file (Debian control format).
 *
 * Continuation lines start with whitespace and are appended to the previous
 * field. Comma-separated dependency lists are split and version constraints
 * `pkg (>= 1.0.0)` are stripped to just `pkg`.
 *
 * @param {string} cwd - project root containing DESCRIPTION
 * @returns {object|null}
 */
function readDescription(cwd) {
  const p = path.join(cwd, 'DESCRIPTION');
  if (!fs.existsSync(p)) return null;
  let raw;
  try { raw = fs.readFileSync(p, 'utf8'); } catch (_) { return null; }

  const fields = {};
  let currentKey = null;
  for (const rawLine of raw.split('\n')) {
    if (/^\s/.test(rawLine) && currentKey) {
      // Continuation: append (with a space) to the current field.
      fields[currentKey] += ' ' + rawLine.trim();
      continue;
    }
    const m = rawLine.match(/^([A-Za-z][\w.]*)\s*:\s*(.*)$/);
    if (m) {
      currentKey = m[1];
      fields[currentKey] = m[2].trim();
    } else {
      currentKey = null;
    }
  }

  return {
    package:   fields.Package   || null,
    version:   fields.Version   || null,
    imports:   splitDeps(fields.Imports),
    depends:   splitDeps(fields.Depends),
    suggests:  splitDeps(fields.Suggests),
    linkingTo: splitDeps(fields.LinkingTo),
  };
}

/**
 * Split a DESCRIPTION dep list like
 *   "dplyr (>= 1.0.0), ggplot2, R (>= 4.0)"
 * into a clean array of package names, dropping `R` itself.
 */
function splitDeps(value) {
  if (!value) return [];
  return value.split(',')
    .map((s) => s.trim().replace(/\s*\([^)]*\)\s*$/, '').trim())
    .filter((s) => s && s !== 'R');
}

/**
 * Parse a NAMESPACE file.
 *
 * Recognised directives (R writes NAMESPACE in Lisp-y notation):
 *   export(name) / export("name")
 *   exportPattern("^foo")
 *   exportMethods(generic1, generic2)
 *   S3method(generic, class)
 *   importFrom(pkg, name1, name2, ...)
 *   import(pkg)
 *   useDynLib(pkg)            — ignored (compiled code)
 *
 * @param {string} cwd
 * @returns {object|null}
 */
function readNamespace(cwd) {
  const p = path.join(cwd, 'NAMESPACE');
  if (!fs.existsSync(p)) return null;
  let raw;
  try { raw = fs.readFileSync(p, 'utf8'); } catch (_) { return null; }

  // Strip comments.
  const text = raw.replace(/#.*$/gm, '');

  const exports = new Set();
  const exportPatterns = [];
  const s3methods = [];
  const importFrom = new Map();

  for (const m of text.matchAll(/\bexport\s*\(\s*([^)]+)\)/g)) {
    for (const name of splitArgs(m[1])) {
      const clean = stripQuotes(name);
      if (clean) exports.add(clean);
    }
  }
  for (const m of text.matchAll(/\bexportMethods\s*\(\s*([^)]+)\)/g)) {
    for (const name of splitArgs(m[1])) {
      const clean = stripQuotes(name);
      if (clean) exports.add(clean);
    }
  }
  for (const m of text.matchAll(/\bexportPattern\s*\(\s*["']([^"']+)["']\s*\)/g)) {
    try { exportPatterns.push(new RegExp(m[1])); } catch (_) {}
  }
  for (const m of text.matchAll(/\bS3method\s*\(\s*([\w.]+)\s*,\s*([\w.]+)\s*\)/g)) {
    s3methods.push({ generic: m[1], class: m[2] });
    // The generic itself is implicitly exported for the registered class.
    exports.add(m[1]);
  }
  for (const m of text.matchAll(/\bimportFrom\s*\(\s*([\w.]+)\s*,\s*([^)]+)\)/g)) {
    const pkg = m[1];
    if (!importFrom.has(pkg)) importFrom.set(pkg, new Set());
    for (const name of splitArgs(m[2])) {
      const clean = stripQuotes(name);
      if (clean) importFrom.get(pkg).add(clean);
    }
  }

  return { exports, exportPatterns, s3methods, importFrom };
}

function splitArgs(raw) {
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

function stripQuotes(s) {
  return s.replace(/^["']|["']$/g, '').trim();
}

/**
 * Build a Map<symbolName, absFilePath> from the top-level definitions in a
 * set of R files. Used by the graph builder to resolve `localPkg::fn` to a
 * concrete file. Reads each file once and runs a single regex.
 *
 * @param {string[]} rFiles - absolute paths to .R/.r files
 * @returns {Map<string, string>}
 */
function collectLocalDefs(rFiles) {
  const defs = new Map();
  // Matches `name <- function(`, `name <- R6Class(`, `name <- new_class(`,
  // `setGeneric("name"`, `setClass("name"`. First-write-wins.
  const reAssign = /^(?:[ \t]*)([\w.]+)\s*(?:<<-|<-|=)\s*(?:(?:R6::)?R6Class|(?:S7::)?new_class|function)\b/gm;
  const reS4Generic = /^[ \t]*setGeneric\s*\(\s*["']([\w.]+)["']/gm;
  const reS4Class   = /^[ \t]*setClass\s*\(\s*["']([\w.]+)["']/gm;
  for (const filePath of rFiles) {
    let content;
    try { content = fs.readFileSync(filePath, 'utf8'); } catch (_) { continue; }
    const stripped = content.replace(/#.*$/gm, '');
    let m;
    while ((m = reAssign.exec(stripped)) !== null) {
      if (m[1].startsWith('.')) continue;
      if (!defs.has(m[1])) defs.set(m[1], filePath);
    }
    while ((m = reS4Generic.exec(stripped)) !== null) {
      if (!defs.has(m[1])) defs.set(m[1], filePath);
    }
    while ((m = reS4Class.exec(stripped)) !== null) {
      if (!defs.has(m[1])) defs.set(m[1], filePath);
    }
  }
  return defs;
}

module.exports = { readDescription, readNamespace, collectLocalDefs };
