'use strict';

/**
 * PHP imports (#980): `use Ns\Class;` and literal `require` / `include`.
 *
 * A `use` names a class, not a file, so it goes through the autoloader the project
 * declares. `composer.json` `autoload` and `autoload-dev` `psr-4` map a namespace
 * prefix to one or more directories, and PSR-4 tries every prefix that matches, so
 * `Illuminate\Support\Str` is looked for under `Illuminate\Support\` first and under
 * `Illuminate\` after it (Laravel maps the first to four directories). When no PSR-4
 * path holds a file of the set, a class declared in the set under that exact
 * namespace and name is used instead (a layout with no mapping, or a package whose
 * own `composer.json` is not the root one). Two files declaring one name are
 * ambiguous and yield nothing.
 *
 * Only top-level `use` statements of classes, interfaces, traits and enums are
 * imports: `use function` and `use const` name no file (their clause does not parse as a
 * class name), `use ($x)` on a closure and
 * a trait `use` inside a class body are indented and not matched. A class used by its
 * fully qualified name with no `use` is not an import and is not an edge.
 *
 * `require` / `include` with a literal path resolve next to the file, or relative to
 * the project root; `__DIR__ . '/x.php'` and `dirname(__FILE__) . '/x.php'` are the
 * file's directory. A path built from a variable yields nothing.
 *
 * @module src/graph/resolvers/php
 */

const fs = require('fs');
const path = require('path');
const { perBuild, readText, realPathOf, inSet, graphKey, stripComments } = require('./shared');

const EXTS = new Set(['.php']);

// ── composer.json ────────────────────────────────────────────────────────────

const _composer = new Map(); // composer.json path -> { mtimeMs, map }

/** `{ prefix: 'Illuminate\\Support\\', dirs: [abs...] }[]`, longest prefix first. */
function psr4(cwd) {
  if (!cwd) return [];
  const file = path.join(cwd, 'composer.json');
  let st;
  try { st = fs.statSync(file); } catch (_) { return []; }
  const known = _composer.get(file);
  if (known && known.mtimeMs === st.mtimeMs) return known.map;

  let json = null;
  try { json = JSON.parse(readText(file)); } catch (_) { json = null; }
  const map = [];
  for (const section of ['autoload', 'autoload-dev']) {
    const table = json && json[section] && json[section]['psr-4'];
    if (!table || typeof table !== 'object') continue;
    for (const [prefix, target] of Object.entries(table)) {
      const dirs = (Array.isArray(target) ? target : [target])
        .filter((d) => typeof d === 'string')
        .map((d) => path.resolve(cwd, d));
      const p = prefix === '' ? '' : (prefix.endsWith('\\') ? prefix : prefix + '\\');
      map.push({ prefix: p, dirs });
    }
  }
  map.sort((a, b) => b.prefix.length - a.prefix.length);
  _composer.set(file, { mtimeMs: st.mtimeMs, map });
  return map;
}

// ── a name -> file index, for what PSR-4 does not reach ──────────────────────

const DECL = /^[ \t]*(?:(?:abstract|final|readonly)[ \t]+)*(?:class|interface|trait|enum)[ \t]+([A-Za-z_]\w*)/gm;
const NS = /^[ \t]*namespace[ \t]+([A-Za-z_][\w\\]*)[ \t]*[;{]/gm;

function declaredIn(text) {
  const out = [];
  const spans = [];
  NS.lastIndex = 0;
  let m;
  while ((m = NS.exec(text)) !== null) spans.push({ at: m.index, name: m[1] });
  DECL.lastIndex = 0;
  while ((m = DECL.exec(text)) !== null) {
    let ns = '';
    for (const s of spans) if (s.at <= m.index) ns = s.name;
    out.push((ns ? ns + '\\' : '') + m[1]);
  }
  return out;
}

/** lowercased fully qualified name -> keys declaring it. */
function classIndex(fileSet, ctx) {
  return perBuild(fileSet, 'php:classes', () => {
    const idx = new Map();
    for (const k of fileSet) {
      if (!k.endsWith('.php')) continue;
      const text = stripComments(readText(realPathOf(ctx, k)));
      for (const fq of declaredIn(text)) {
        const l = fq.toLowerCase();
        const a = idx.get(l);
        if (a) a.push(k); else idx.set(l, [k]);
      }
    }
    return idx;
  });
}

function resolveClass(fq, fileSet, cwd, ctx) {
  const name = fq.replace(/^\\/, '');
  if (!name) return null;
  for (const { prefix, dirs } of psr4(cwd)) {
    if (!name.startsWith(prefix)) continue;
    const rest = name.slice(prefix.length).replace(/\\/g, path.sep);
    if (!rest) continue;
    for (const d of dirs) {
      const k = inSet(fileSet, path.join(d, rest + '.php'));
      if (k) return k;
    }
  }
  const hits = classIndex(fileSet, ctx).get(name.toLowerCase());
  return hits && hits.length === 1 ? hits[0] : null;
}

// ── use statements ───────────────────────────────────────────────────────────

/** Split on commas that are not inside braces. */
function topLevelCommas(s) {
  const out = [];
  let depth = 0;
  let cur = '';
  for (const ch of s) {
    if (ch === '{') depth++;
    else if (ch === '}') depth--;
    if (ch === ',' && depth === 0) { out.push(cur); cur = ''; } else cur += ch;
  }
  if (cur.trim()) out.push(cur);
  return out;
}

/** The fully qualified class names one `use` clause imports. */
function namesIn(clause) {
  const out = [];
  for (const item of topLevelCommas(clause)) {
    const t = item.trim();
    const group = /^\\?([A-Za-z_][\w\\]*)\\\{([^}]*)\}$/.exec(t.replace(/\s+/g, ' '));
    if (group) {
      for (const sub of group[2].split(',')) {
        const s = sub.trim().replace(/\s+as\s+\w+$/i, '');
        if (/^(function|const)\s/.test(s) || !s) continue;
        out.push(group[1] + '\\' + s);
      }
      continue;
    }
    const plain = /^\\?([A-Za-z_][\w\\]*)(?:\s+as\s+\w+)?$/.exec(t.replace(/\s+/g, ' '));
    if (plain) out.push(plain[1]);
  }
  return out;
}

const USE = /^use[ \t]+([^;]+);/gm;
const INCLUDE = /\b(?:require|include)(?:_once)?[ \t]*\(?[ \t]*(?:(__DIR__|dirname[ \t]*\([ \t]*__FILE__[ \t]*\))[ \t]*\.[ \t]*)?(['"])([^'"$\n]+)\2/g;

function extract(filePath, content, fileSet, cwd, ctx) {
  const text = stripComments(content);
  const out = [];
  let m;

  USE.lastIndex = 0;
  while ((m = USE.exec(text)) !== null) {
    for (const fq of namesIn(m[1])) {
      const hit = resolveClass(fq, fileSet, cwd, ctx);
      if (hit) out.push(hit);
    }
  }

  const dir = path.dirname(filePath);
  INCLUDE.lastIndex = 0;
  while ((m = INCLUDE.exec(text)) !== null) {
    const lit = m[3];
    const bases = m[1] || lit.startsWith('./') || lit.startsWith('../') ? [dir] : [dir, cwd].filter(Boolean);
    for (const b of bases) {
      const k = inSet(fileSet, path.resolve(b, lit.replace(/^\/(?=[^/])/, m[1] ? '' : '/')));
      if (k) { out.push(k); break; }
    }
  }
  return out.filter((k) => k !== graphKey(filePath));
}

module.exports = { name: 'PHP', EXTS, extract };
