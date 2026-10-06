'use strict';

/**
 * Source-confirmed symbols (#914, closes #910).
 *
 * `fake-symbol` asked one question — "is this name in the symbol index?" — and the
 * index is a lossy summary of the repository: a file keeps `maxSigsPerFile` (25)
 * signatures, only the files under the detected source roots are in it, and an
 * extractor lists only the constructs it knows. A real symbol outside it was
 * reported as fabricated (#910: httpx's `Cookies.extract_cookies`, 1,100 lines into
 * a file whose index entry stops at 25). Measured over 35 repositories' own docs,
 * 42% of the names `verify` flagged were defined in the checkout: 32% in files the
 * index does not hold, 7% in an indexed file the extractor did not list, 3% past
 * the cap.
 *
 * This asks the question the index only approximates, of the source itself, and
 * only of the names that would otherwise be flagged. A name is CONFIRMED when a
 * call or a definition form of it occurs in the code of some file of the checkout
 * — never the bare word, so prose cannot confirm it:
 *
 *   name(   name<T>(           a call, or a definition head
 *   name = (…   name: function   a function-valued binding, typed or not
 *   def|func|fn|fun|class|… [<T>] name   a keyword definition
 *   export const name   exports.name =   an exported binding, function-shaped or not
 *
 * Comments and strings are blanked first (`scan.js` / `call-graph.js` maskers, by
 * language family), so `// call clear() to reset`, a docstring or a SQL string
 * confirms nothing. This is the standard `judge` already applies to the context
 * (`hasStrongEvidence`, #909), turned on the source.
 *
 * It is a NECESSARY-condition check in the same spirit as #909's named-import
 * check: a name that is called or defined nowhere cannot be a real symbol of the
 * repository, so it stays flagged; a name that is called or defined somewhere is
 * not a fabrication, whether the repo or a library it uses owns it. Measured on 20,171
 * mutated names (a swapped letter, a suffix, a prefix) none was confirmed.
 *
 * Bounded and deterministic: nothing is read when there is nothing to confirm; the
 * walk is sorted, the indexed files come first, and a budget on bytes and files —
 * never a clock — ends it, so two runs agree. A name not confirmed within the
 * budget stays flagged exactly as before. Languages whose comments the maskers do
 * not read (Lua, PowerShell, SQL, markup) are not scanned.
 *
 * Zero dependencies, offline.
 */

const fs = require('fs');
const path = require('path');
const { DEFAULTS } = require('../config/defaults');

/** A file larger than this is generated or vendored, never hand-written source. */
const MAX_FILE_BYTES = 1500000;
/** Total text read in one confirmation. The largest of 12 repositories measured held 27 MB of code. */
const MAX_SCAN_BYTES = 64 * 1024 * 1024;
/** Files read in one confirmation. */
const MAX_SCAN_FILES = 25000;
const MAX_DEPTH = 24;

/** Trees that are somebody else's code, on top of the generator's own `exclude`. */
const EXTRA_EXCLUDE = ['venv', 'site-packages', 'third_party', 'Pods', 'Carthage', 'bower_components'];

const JS_FAMILY = new Set(['javascript', 'typescript', 'typescript_react', 'vue_sfc', 'svelte', 'astro']);
const C_FAMILY = new Set(['java', 'kotlin', 'go', 'csharp', 'cpp', 'objc', 'php', 'swift', 'dart', 'scala']);
const HASH_FAMILY = new Set(['python', 'ruby', 'elixir', 'gdscript', 'r', 'shell']);
/** Languages with a multi-line `"""` text block (Dart also `'''`). */
const TEXT_BLOCK_FAMILY = new Set(['java', 'kotlin', 'csharp', 'swift', 'dart', 'scala']);

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * The patterns that confirm one name. Case-sensitive, whole-identifier.
 * @param {string} name
 * @returns {RegExp[]}
 */
function symbolForms(name) {
  const id = escapeRe(name);
  const start = '(?<![\\w$])';
  const end = '(?![\\w$])';
  return [
    new RegExp(start + id + '\\s*(?:<[^<>()\\n]{0,80}>)?\\s*\\('),
    new RegExp(start + id + '\\s*(?::[^=;\\n]{1,80}=|<-|=|:)\\s*(?:async\\s+)?(?:function\\b|lambda\\b|\\\\?\\(|[\\w$]+\\s*=>)'),
    new RegExp(start + '(?:def|defp|defmacro|defmodule|function\\*?|func|fn|fun|sub|class|struct|interface|trait|enum|type|object|module|protocol|record)\\s+(?:<[^>\\n]*>\\s*)?(?:\\([^)\\n]*\\)\\s*)?(?:[\\w$.]+\\.)?' + id + end),
    new RegExp(start + '(?:export\\s+(?:default\\s+)?(?:declare\\s+)?(?:const|let|var)\\s+|(?:module\\.)?exports\\.)' + id + end),
  ];
}

/** Directory and file names the walk never enters: the generator's `exclude`, its own additions, and the project's. */
function excludedNames(cwd) {
  const names = new Set([...DEFAULTS.exclude, ...EXTRA_EXCLUDE]);
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(cwd, 'gen-context.config.json'), 'utf8'));
    if (cfg && Array.isArray(cfg.exclude)) for (const n of cfg.exclude) if (typeof n === 'string') names.add(n);
  } catch (_) { /* no project config, or an unreadable one: the defaults stand */ }
  return names;
}

let _tools = null;
/** Loaded on first use: a `verify` with nothing to confirm never pays for the extractors or the maskers. */
function tools() {
  if (!_tools) {
    const { langFor } = require('../extractors/dispatch');
    const { maskCode } = require('../extractors/scan');
    const { maskPy, maskRust } = require('../graph/call-graph');
    _tools = { langFor, maskCode, maskPy, maskRust };
  }
  return _tools;
}

/**
 * `maskCode` reads `"""` as an empty string and then a one-line one, which leaves
 * the body of a text block to be searched as code. Blank the whole block first —
 * length- and newline-preserving, like every masker here.
 */
function blankTextBlocks(text, lang) {
  const re = lang === 'dart' ? /"""[\s\S]*?"""|'''[\s\S]*?'''/g : /"""[\s\S]*?"""/g;
  return text.replace(re, (block) => block.replace(/[^\n]/g, ' '));
}

/**
 * The masker for a source file, or null when its language is not one whose
 * comments and strings can be blanked (markup, data, Lua, PowerShell, SQL, …).
 * @param {string} rel repo-relative path
 * @returns {((text: string) => string)|null}
 */
function maskerFor(rel) {
  const { langFor, maskCode, maskPy, maskRust } = tools();
  const lang = langFor(rel);
  if (!lang) return null;
  if (lang === 'rust') return maskRust;
  if (JS_FAMILY.has(lang)) return (t) => maskCode(t, { js: true });
  if (C_FAMILY.has(lang)) {
    return TEXT_BLOCK_FAMILY.has(lang) ? (t) => maskCode(blankTextBlocks(t, lang)) : (t) => maskCode(t);
  }
  if (HASH_FAMILY.has(lang)) return maskPy;
  return null;
}

/** A minified bundle defines and calls everything; it says nothing about the repository's own symbols. */
const MINIFIED_RE = /\.min\.[cm]?js$|\.generated\.|\.pb\.|_pb\./;

/**
 * Every source file of the checkout, sorted, minus excluded and dot directories.
 * Symlinks are not followed.
 * @param {string} cwd
 * @param {Set<string>} exclude
 * @returns {string[]} repo-relative, forward-slashed
 */
function listSourceFiles(cwd, exclude) {
  const out = [];
  const walk = (dirRel, depth) => {
    if (depth > MAX_DEPTH) return;
    let entries;
    try { entries = fs.readdirSync(dirRel ? path.join(cwd, dirRel) : cwd, { withFileTypes: true }); } catch (_) { return; }
    entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    for (const e of entries) {
      if (exclude.has(e.name)) continue;
      const rel = dirRel ? dirRel + '/' + e.name : e.name;
      if (e.isDirectory()) {
        if (!e.name.startsWith('.')) walk(rel, depth + 1);
      } else if (e.isFile() && !MINIFIED_RE.test(e.name) && maskerFor(rel)) {
        out.push(rel);
      }
    }
  };
  walk('', 0);
  return out;
}

/**
 * Which of `names` are called or defined in the source.
 *
 * @param {string} cwd  repo root
 * @param {Iterable<string>} names  identifiers an answer or a plan cites as symbols
 * @param {object} [opts]
 * @param {string[]} [opts.priority]  repo-relative files to read first — the indexed ones
 * @param {Iterable<string>} [opts.exclude]  names the walk skips (default: the generator's `exclude` plus the project's)
 * @param {number} [opts.maxBytes]
 * @param {number} [opts.maxFiles]
 * @returns {{ confirmed: Map<string, string>, files: number, bytes: number, truncated: boolean }}
 *   `confirmed` maps each confirmed name to the first file that confirmed it
 */
function confirmSymbols(cwd, names, opts = {}) {
  const want = [...new Set(names || [])];
  const result = { confirmed: new Map(), files: 0, bytes: 0, truncated: false };
  if (!want.length) return result;

  const maxBytes = opts.maxBytes != null ? opts.maxBytes : MAX_SCAN_BYTES;
  const maxFiles = opts.maxFiles != null ? opts.maxFiles : MAX_SCAN_FILES;
  const exclude = opts.exclude ? new Set(opts.exclude) : excludedNames(cwd);

  // The indexed files first — they are where a name is most likely defined — then
  // the rest of the checkout, in sorted order so the budget always ends in the same place.
  const first = [...new Set(opts.priority || [])].filter((rel) => maskerFor(rel)).sort();
  const seen = new Set(first);
  const order = first.concat(listSourceFiles(cwd, exclude).filter((rel) => !seen.has(rel)));

  const forms = new Map(want.map((n) => [n, symbolForms(n)]));
  for (const rel of order) {
    if (result.confirmed.size === want.length) break;
    if (result.files >= maxFiles || result.bytes >= maxBytes) { result.truncated = true; break; }
    let text;
    try {
      const abs = path.join(cwd, rel);
      if (fs.statSync(abs).size > MAX_FILE_BYTES) continue;
      text = fs.readFileSync(abs, 'utf8');
    } catch (_) { continue; }
    result.files++;
    result.bytes += text.length;

    // Cheap first: only a file that mentions a name still wanted is worth masking.
    const pending = want.filter((n) => !result.confirmed.has(n) && text.includes(n));
    if (!pending.length) continue;
    const masked = maskerFor(rel)(text);
    for (const n of pending) {
      if (forms.get(n).some((re) => re.test(masked))) result.confirmed.set(n, rel);
    }
  }
  return result;
}

module.exports = { confirmSymbols, symbolForms, listSourceFiles, excludedNames, MAX_FILE_BYTES, MAX_SCAN_BYTES, MAX_SCAN_FILES };
