'use strict';

/**
 * Parsers for the Hallucination Guard (verify-ai-output).
 *
 * Extract the verifiable claims an AI answer makes about a codebase:
 *   - file paths it references (POSIX or Windows separators)
 *   - import / require statements it shows — the module, and the names taken
 *     from it — in JS/TS, Python and Go
 *   - function / class symbols it calls or declares
 *   - fenced code blocks (so callers can scope checks to code vs prose)
 *
 * Everything here is deterministic and offline — pure string analysis.
 */

// Extensions we are confident name a source/code/config file (no slash required).
const KNOWN_CODE_EXT = new Set([
  'js', 'jsx', 'mjs', 'cjs', 'ts', 'tsx', 'py', 'pyw', 'rb', 'go', 'rs',
  'java', 'kt', 'swift', 'c', 'h', 'cpp', 'hpp', 'm', 'mm', 'cs', 'php', 'r',
  'vue', 'svelte', 'css', 'scss', 'less', 'html', 'json', 'yml', 'yaml',
  'toml', 'xml', 'sql', 'graphql', 'gql', 'proto', 'tf', 'md', 'sh',
  'gd', 'gdscript', 'ps1', 'psm1', 'psd1',
]);

// Well-known "X.js" runtime/library product names — never repo files.
const LIBRARY_TOKENS = new Set([
  'node.js', 'next.js', 'nuxt.js', 'vue.js', 'react.js', 'express.js', 'koa.js',
  'nest.js', 'three.js', 'd3.js', 'chart.js', 'ember.js', 'backbone.js',
  'angular.js', 'meteor.js', 'moment.js', 'anime.js', 'p5.js', 'next.config.js',
]);

// Illustrative placeholder names the model writes in prose, not repo claims:
// e.g. example.js, minimal-example.js, sample.ts, demo.js, placeholder.js.
const PLACEHOLDER_RE = /(?:^|[-_.])(?:example|sample|demo|placeholder)(?:[-_.]|s?$)/i;
// camelCase / Pascal placeholders: myExample.js, exampleConfig.js, fooSample.ts.
// Requires a case boundary so ordinary words (resample.js) are NOT suppressed.
const PLACEHOLDER_CAMEL_RE = /(?:^|[a-z])(?:Example|Sample|Demo|Placeholder)|(?:^|[-_.])(?:example|sample|demo|placeholder)(?=[A-Z])/;

/**
 * Extract fenced code blocks.
 * @param {string} text
 * @returns {{ lang: string, content: string, line: number }[]}
 */
function extractCodeBlocks(text) {
  const blocks = [];
  const lines = text.split('\n');
  let inBlock = false;
  let lang = '';
  let buf = [];
  let startLine = 0;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^```(\w*)/);
    if (m) {
      if (!inBlock) {
        inBlock = true;
        lang = m[1] || '';
        buf = [];
        startLine = i + 2; // first content line (1-based)
      } else {
        blocks.push({ lang, content: buf.join('\n'), line: startLine });
        inBlock = false;
      }
      continue;
    }
    if (inBlock) buf.push(lines[i]);
  }
  return blocks;
}

/**
 * The fence language of every line: '' outside a fenced block, the lower-cased
 * info-string language inside one ('' for a bare fence is reported as 'text').
 * Lets a parser scope a claim shape to the block language that gives it meaning
 * — a Go `import "x"` is a package, a JS `import 'x'` a side-effect import.
 * @param {string[]} lines
 * @returns {string[]}
 */
function fenceLanguages(lines) {
  const out = new Array(lines.length).fill('');
  let lang = null;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^\s*```+\s*([\w+#.-]*)/);
    if (m) {
      lang = lang === null ? (m[1] || 'text').toLowerCase() : null;
      continue;
    }
    if (lang !== null) out[i] = lang;
  }
  return out;
}

/**
 * 1-based line of a character offset, via a precomputed table of line starts.
 * @param {string} text
 * @returns {(offset: number) => number}
 */
function lineLocator(text) {
  const starts = [0];
  for (let i = 0; i < text.length; i++) if (text.charCodeAt(i) === 10) starts.push(i + 1);
  return (offset) => {
    let lo = 0;
    let hi = starts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (starts[mid] <= offset) lo = mid; else hi = mid - 1;
    }
    return lo + 1;
  };
}

// Fence languages in which a backslash is a path separator, not a string escape.
const WINDOWS_FENCES = new Set(['bat', 'batch', 'cmd', 'dos', 'powershell', 'ps1', 'pwsh']);

// A Windows-style repo path: `src\retrieval\ranker.js`. Every directory segment
// needs two characters or more, which keeps a string escape (`a\nfile.txt`)
// from reading as `a/nfile.txt`; an escaped `\\` and a drive-letter absolute
// path never match, and neither can name a repo file. Like the POSIX form,
// a dot-relative `.\lib\a.py` is not read — it is relative to an unknown file.
const WINDOWS_PATH_RE = /(?:^|[\s`"'(\[<])([A-Za-z0-9_][\w.-]+(?:\\[A-Za-z0-9_.][\w.-]*)+\.[A-Za-z][A-Za-z0-9]*)(?![\w\\])/g;

/**
 * Extract file-path references (deduped, first-seen line kept).
 * A token counts as a path when it has a `.<letter…>` extension AND
 * either contains a `/` or carries a known code/config extension. Windows
 * separators (`src\a\b.js`) are read too and reported with `/`, so one file is
 * one claim however the answer spells it.
 * @param {string} text
 * @returns {{ path: string, line: number }[]}
 */
function extractFilePaths(text) {
  const lines = text.split('\n');
  const fences = fenceLanguages(lines);
  const seen = new Map();
  const re = /(?:^|[\s`"'(\[<])([A-Za-z0-9_][\w./-]*\.[A-Za-z][A-Za-z0-9]*)/g;
  const accept = (p, lineNo) => {
    if (/^https?:/i.test(p)) return;
    const ext = (p.split('.').pop() || '').toLowerCase();
    const hasSlash = p.includes('/');
    if (!hasSlash && !KNOWN_CODE_EXT.has(ext)) return;
    if (LIBRARY_TOKENS.has(p.toLowerCase())) return;
    const base = p.split('/').pop();
    if (PLACEHOLDER_RE.test(base) || PLACEHOLDER_CAMEL_RE.test(base)) return;
    if (!seen.has(p)) seen.set(p, lineNo);
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let m;
    re.lastIndex = 0;
    while ((m = re.exec(line)) !== null) accept(m[1], i + 1);

    if (line.indexOf('\\') === -1) continue;
    if (fences[i] && !WINDOWS_FENCES.has(fences[i])) continue; // a code string's escapes
    WINDOWS_PATH_RE.lastIndex = 0;
    while ((m = WINDOWS_PATH_RE.exec(line)) !== null) {
      const parts = m[1].split('\\');
      if (parts.slice(0, -1).some((seg) => seg.length < 2)) continue;
      // `dir\file` where the file starts with an escape letter (`tab\tsep.log`,
      // `line\nfile.txt`) is a string escape far more often than a path.
      if (parts.length === 2 && /^[ntrbfva0exu]/.test(parts[1])) continue;
      accept(parts.join('/'), i + 1);
    }
  }
  return [...seen.entries()].map(([p, line]) => ({ path: p, line }));
}

const IDENT = '[A-Za-z_$][\\w$]*';

// import|export [type] <clause> from '<module>', where the clause is
//   `D` · `{ a, b as c }` · `* as ns` · `D, { a }` · `D, * as ns`.
// The braces may span lines (`[^{}]*` crosses newlines).
const ESM_FROM_RE = new RegExp(
  '\\b(?:import|export)\\s+(?:type\\s+)?('
  + '(?:' + IDENT + '\\s*,\\s*)?\\{[^{}]*\\}'
  + '|(?:' + IDENT + '\\s*,\\s*)?\\*(?:\\s*as\\s+' + IDENT + ')?'
  + '|' + IDENT
  + ')\\s*from\\s*([\'"])([^\'"\\r\\n]+)\\2', 'g');

// import 'x' — a side-effect import (a Go package inside a ```go fence).
const SIDE_EFFECT_RE = /\bimport\s*(['"])([^'"\r\n]+)\1/g;

// [const|let|var <binding> =] require('x') | import('x'). `\s*` crosses
// newlines, so `require(\n  'x'\n)` and a destructuring split over lines read.
const REQUIRE_RE = new RegExp(
  '(?:\\b(?:const|let|var)\\s+(\\{[^{}]*\\}|' + IDENT + ')\\s*=\\s*)?'
  + '\\b(?:require|import)\\s*\\(\\s*([\'"])([^\'"\\r\\n]+)\\2\\s*\\)', 'g');

// Python: from x import y, z  |  from x import (\n y,\n z as w,\n)
const PY_FROM_RE = /^[ \t]*from[ \t]+([.\w]+)[ \t]+import[ \t]+(\([^)]*\)|[^\n#;]+)/gm;

// Python: import a.b as c, d — the WHOLE line, so a JS `import D, { a } from`
// can never read as the module `D`.
const PY_IMPORT_RE = /^[ \t]*import[ \t]+([A-Za-z_][\w.]*(?:[ \t]+as[ \t]+\w+)?(?:[ \t]*,[ \t]*[A-Za-z_][\w.]*(?:[ \t]+as[ \t]+\w+)?)*)[ \t]*(?:#.*)?$/gm;

/** The names inside `{ a, b as c, type d }` / a CJS `{ a: b }` — the source names. */
function braceNames(inner) {
  const names = [];
  const clean = inner.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  for (let part of clean.split(',')) {
    part = part.trim().replace(/^(?:type|typeof)\s+/, '');
    const left = part.split(/\s+as\s+|\s*:\s*/)[0].trim();
    const id = left.match(/^[A-Za-z_$][\w$]*/);
    if (id && id[0] !== 'default') names.push(id[0]);
  }
  return names;
}

/** The names of a Python `import` clause; `*` is a wildcard, not a name. */
function pyNames(clause) {
  const names = [];
  let wildcard = false;
  const clean = clause.replace(/[()]/g, ' ').replace(/#[^\n]*/g, '');
  for (const part of clean.split(/[,\n]/)) {
    const left = part.trim().split(/\s+as\s+/)[0].trim();
    if (left === '*') wildcard = true;
    else if (/^[A-Za-z_]\w*$/.test(left)) names.push(left);
  }
  return { names, wildcard };
}

/**
 * Extract import / require statements, with the names each takes from its
 * module (#672, #909).
 *
 * Reads, per language:
 *   JS/TS   `import D, { a, b as c } from 'x'` (braces may span lines),
 *           `import type`, `export { a } from`, `export * from`, `import 'x'`,
 *           `const { a, b } = require('x')` (and across lines), `require(\n'x'\n)`
 *   Python  `from x import a, b`, `from x import (\n a,\n b as c,\n)`, `import a.b as c`
 *   Go      `import "p"`, `import alias "p"` and `import ( … )` — inside a
 *           ```go / ```golang fence only, so prose is never read as a package
 *
 * `names` lists the bindings taken by name — never a default, a namespace or a
 * wildcard, which cannot be checked against a module's members (`wildcard`
 * records that one was there).
 *
 * @param {string} text
 * @returns {{ module: string, kind: 'js'|'py'|'go', relative: boolean, line: number, raw: string, names: string[], wildcard: boolean }[]}
 */
function extractImports(text) {
  const lines = text.split('\n');
  const fences = fenceLanguages(lines);
  const lineOf = lineLocator(text);
  const byKey = new Map();
  const add = (module, kind, offsetOrLine, extra) => {
    if (!module) return;
    const line = extra && extra.atLine ? offsetOrLine : lineOf(offsetOrLine);
    const key = `${kind}|${module}|${line}`;
    const names = (extra && extra.names) || [];
    const wildcard = !!(extra && extra.wildcard);
    const prior = byKey.get(key);
    if (prior) {
      for (const n of names) if (!prior.names.includes(n)) prior.names.push(n);
      prior.wildcard = prior.wildcard || wildcard;
      return;
    }
    byKey.set(key, {
      module,
      kind,
      relative: kind !== 'go' && /^[./]/.test(module),
      line,
      raw: (lines[line - 1] || '').trim(),
      names: names.slice(),
      wildcard,
    });
  };
  const langAt = (offset) => fences[lineOf(offset) - 1] || '';

  let m;
  // JS/TS: import|export … from 'x'
  ESM_FROM_RE.lastIndex = 0;
  while ((m = ESM_FROM_RE.exec(text)) !== null) {
    const clause = m[1];
    const braces = clause.match(/\{([^{}]*)\}/);
    add(m[3], 'js', m.index, {
      names: braces ? braceNames(braces[1]) : [],
      wildcard: /\*/.test(clause),
    });
  }
  // JS side-effect import 'x' — a Go package inside a ```go fence, handled below.
  SIDE_EFFECT_RE.lastIndex = 0;
  while ((m = SIDE_EFFECT_RE.exec(text)) !== null) {
    if (/^(?:go|golang)$/.test(langAt(m.index))) continue;
    add(m[2], 'js', m.index);
  }
  // require('x') / dynamic import('x'), with an optional destructuring binding.
  REQUIRE_RE.lastIndex = 0;
  while ((m = REQUIRE_RE.exec(text)) !== null) {
    const binding = m[1];
    add(m[3], 'js', m.index, { names: binding && binding.startsWith('{') ? braceNames(binding.slice(1, -1)) : [] });
  }

  // Python: from x import …  |  import x
  PY_FROM_RE.lastIndex = 0;
  while ((m = PY_FROM_RE.exec(text)) !== null) {
    add(m[1], 'py', m.index, pyNames(m[2]));
  }
  PY_IMPORT_RE.lastIndex = 0;
  while ((m = PY_IMPORT_RE.exec(text)) !== null) {
    for (const part of m[1].split(',')) {
      const mod = part.trim().split(/\s+as\s+/)[0].trim();
      add(mod, 'py', m.index);
    }
  }

  // Go: only inside a go fence — `import "p"`, `import a "p"`, `import ( … )`.
  let inGoBlock = false;
  for (let i = 0; i < lines.length; i++) {
    if (!/^(?:go|golang)$/.test(fences[i])) { inGoBlock = false; continue; }
    const line = lines[i];
    if (inGoBlock) {
      if (/^\s*\)/.test(line)) { inGoBlock = false; continue; }
      const spec = line.match(/^\s*(?:[\w.]+\s+)?"([^"\n]+)"/);
      if (spec) add(spec[1], 'go', i + 1, { atLine: true });
      continue;
    }
    if (/^\s*import\s*\(\s*(?:\/\/.*)?$/.test(line)) { inGoBlock = true; continue; }
    const one = line.match(/^\s*import\s+(?:[\w.]+\s+)?"([^"\n]+)"/);
    if (one) add(one[1], 'go', i + 1, { atLine: true });
  }

  return [...byKey.values()].sort((a, b) => a.line - b.line);
}

/**
 * Extract npm/pnpm/yarn script invocations (`npm run <name>`).
 * Only the explicit `run` form is matched, to avoid confusing package-manager
 * subcommands (`yarn add`, `pnpm install`) with script names.
 * @param {string} text
 * @returns {{ name: string, line: number }[]}
 */
function extractNpmScripts(text) {
  const lines = text.split('\n');
  const out = [];
  const seen = new Set();
  const re = /\b(?:npm|pnpm|yarn)\s+run(?:-script)?\s+([A-Za-z0-9:_-]+)/g;
  for (let i = 0; i < lines.length; i++) {
    let m;
    re.lastIndex = 0;
    while ((m = re.exec(lines[i])) !== null) {
      const name = m[1];
      if (seen.has(name)) continue;
      seen.add(name);
      out.push({ name, line: i + 1 });
    }
  }
  return out;
}

// `name(…)`, `name<T>(…)`, `name::<T>(…)` — a backticked call, optionally generic.
// A declaration (`def f(`, `function f(`) is deliberately NOT read: it names an
// existing symbol in an answer that describes code but proposes one in a plan.
// It was also unsafe while a symbol was judged by a capped index — a reference
// doc's `def clear(domain)` for a real method past the cut flagged as fake
// (measured on httpx: 3 of 3, #909). #914 makes that verdict sound; reading
// declarations stays a separate, measured widening of the claim set.
const SYMBOL_RE = new RegExp('`(' + IDENT + ')(?:::<[^`<>()]*>|<[^`<>()]*>)?\\s*\\([^`]*\\)`', 'g');

// Words that precede a parenthesis without naming a callee.
const NOT_A_CALLEE = new Set([
  'if', 'for', 'while', 'switch', 'catch', 'return', 'function', 'func', 'def',
  'fn', 'fun', 'class', 'new', 'typeof', 'sizeof', 'await', 'yield', 'throw',
  'else', 'do', 'with', 'elif', 'lambda', 'assert', 'sub',
]);

/**
 * Extract function/class symbol references that look like calls. Restricted to
 * backtick-wrapped calls (`foo(...)`, `foo<T>(...)`) for high precision; a
 * keyword before a parenthesis (`if (x)`, `func (r *T) F()`) is not a callee.
 * @param {string} text
 * @returns {{ name: string, line: number }[]}
 */
function extractSymbols(text) {
  const lines = text.split('\n');
  const out = [];
  const seen = new Set();
  for (let i = 0; i < lines.length; i++) {
    let m;
    SYMBOL_RE.lastIndex = 0;
    while ((m = SYMBOL_RE.exec(lines[i])) !== null) {
      const name = m[1];
      if (NOT_A_CALLEE.has(name)) continue;
      const key = name + '@' + (i + 1);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ name, line: i + 1 });
    }
  }
  return out;
}

module.exports = {
  extractCodeBlocks,
  extractFilePaths,
  extractImports,
  extractSymbols,
  extractNpmScripts,
};
