'use strict';

/**
 * C# `using` directives (#980).
 *
 * A `using` names a namespace, and a namespace is many files, so resolving it to all
 * of them would link every file of `Serilog` to every other. An edge A -> B is drawn
 * only when A imports a namespace in which B declares a top-level type AND A mentions
 * that type's name as an identifier. A `partial` type declared across several files
 * links to all of its parts. `using static N.T;` and `using Alias = N.T;` name a type
 * directly and link to the files declaring it.
 *
 * The index (namespace -> top-level type name -> files) is built once per build from
 * the C# files of the set. Block `namespace N { }`, nested blocks and file-scoped
 * `namespace N;` are read, with strings and comments blanked first so a brace inside
 * either does not move the depth.
 *
 * `global using` applies to every file of the same project (the directory holding the
 * nearest `.csproj` above it). Types in the file's own namespace need no `using`; they
 * are implicit dependencies, not imports, and are not edges. A namespace that is not
 * declared in the set (`System.*`, a NuGet package) matches nothing.
 *
 * @module src/graph/resolvers/csharp
 */

const fs = require('fs');
const path = require('path');
const { ancestorDirs, perBuild, readText, realPathOf, graphKey, maskCode } = require('./shared');

const EXTS = new Set(['.cs']);

const NS_OPEN = /\bnamespace\s+([A-Za-z_][\w.]*)\s*([;{])/y;

/**
 * Declarations of a file: `{ ns, type }` for each top-level type, and every namespace
 * it declares. Walks the masked text once, tracking brace depth.
 */
function scanDeclarations(masked) {
  const types = [];
  const nss = new Set();
  const stack = []; // block namespaces: { name, depth }
  let fileScoped = '';
  let depth = 0;
  const n = masked.length;
  for (let i = 0; i < n; i++) {
    const ch = masked[i];
    if (ch === '{') { depth++; continue; }
    if (ch === '}') {
      depth--;
      while (stack.length && stack[stack.length - 1].depth > depth) stack.pop();
      continue;
    }
    if (ch === 'n' && masked.startsWith('namespace', i) && /\W/.test(masked[i - 1] || ' ')) {
      NS_OPEN.lastIndex = i;
      const m = NS_OPEN.exec(masked);
      if (m) {
        const outer = stack.length ? stack[stack.length - 1].name : fileScoped;
        const full = outer ? outer + '.' + m[1] : m[1];
        nss.add(full);
        if (m[2] === ';') fileScoped = full;
        else { stack.push({ name: full, depth: depth + 1 }); }
        i += m[0].length - 1;
        if (m[2] === '{') depth++;
        continue;
      }
    }
    if (/[cseird]/.test(ch) && /\W/.test(masked[i - 1] || ' ')) {
      const kw = /^(?:class|struct|interface|enum|record(?:\s+(?:class|struct))?|delegate\s+[^\s(;{]+(?:\s*<[^>]*>)?)\s+([A-Za-z_]\w*)/.exec(masked.slice(i, i + 160));
      if (kw) {
        const ns = stack.length ? stack[stack.length - 1].name : fileScoped;
        const onTop = stack.length ? depth === stack[stack.length - 1].depth : depth === 0;
        if (ns && onTop) types.push({ ns, type: kw[1] });
        i += kw[0].length - 1;
      }
    }
  }
  return { types, nss };
}

/** Does a directory hold a `.csproj`? One listing per directory per process. */
const _csproj = new Map();
function hasCsproj(dir) {
  if (!_csproj.has(dir)) {
    let names = [];
    try { names = fs.readdirSync(dir); } catch (_) { /* unreadable: no project here */ }
    _csproj.set(dir, names.some((x) => x.endsWith('.csproj')));
  }
  return _csproj.get(dir);
}

/** Directory of the nearest `.csproj` above a file; '' when there is none. */
function projectDirOf(file, cwd) {
  for (const a of ancestorDirs(path.dirname(file), cwd)) if (hasCsproj(a)) return a;
  return '';
}

/** { ns: Map<lcNamespace, Map<type, Set<key>>>, globals: Map<project dir, Set<lcNamespace>> } */
function indexFor(fileSet, cwd, ctx) {
  return perBuild(fileSet, 'cs:index', () => {
    const ns = new Map();
    const globals = new Map(); // project dir -> Set<namespace>
    for (const k of fileSet) {
      if (!k.endsWith('.cs')) continue;
      const real = realPathOf(ctx, k);
      const masked = maskCode(readText(real));
      const { types } = scanDeclarations(masked);
      for (const { ns: n, type } of types) {
        const key = n.toLowerCase();
        if (!ns.has(key)) ns.set(key, new Map());
        const byType = ns.get(key);
        if (!byType.has(type)) byType.set(type, new Set());
        byType.get(type).add(k);
      }
      const g = /^[ \t]*global[ \t]+using[ \t]+(?!static\b)(?:\w+[ \t]*=[ \t]*)?([A-Za-z_][\w.]*)[ \t]*;/gm;
      let m;
      while ((m = g.exec(masked)) !== null) {
        const p = projectDirOf(real, cwd);
        if (!globals.has(p)) globals.set(p, new Set());
        globals.get(p).add(m[1].toLowerCase());
      }
    }
    return { ns, globals };
  });
}

const USING = /^[ \t]*(global[ \t]+)?using[ \t]+(static[ \t]+)?(?:([A-Za-z_]\w*)[ \t]*=[ \t]*)?([A-Za-z_][\w.]*)(?:<[^;>]*>)?[ \t]*;/gm;

function extract(filePath, content, fileSet, cwd, ctx) {
  const idx = indexFor(fileSet, cwd, ctx);
  const self = graphKey(filePath);
  const masked = maskCode(content);

  const imported = new Set();   // namespaces whose types the file may use
  const direct = [];            // [namespace, type] named outright
  let m;
  USING.lastIndex = 0;
  while ((m = USING.exec(masked)) !== null) {
    const name = m[4];
    if (m[2] || m[3]) {                       // using static N.T;  using A = N.T;
      const dot = name.lastIndexOf('.');
      if (dot > 0) direct.push([name.slice(0, dot).toLowerCase(), name.slice(dot + 1)]);
    } else {
      imported.add(name.toLowerCase());
    }
  }
  const proj = projectDirOf(filePath, cwd);
  for (const g of idx.globals.get(proj) || []) imported.add(g);

  const out = new Set();
  for (const [n, t] of direct) {
    const files = idx.ns.get(n) && idx.ns.get(n).get(t);
    if (files) for (const f of files) if (f !== self) out.add(f);
  }
  if (imported.size) {
    const ids = new Set(masked.match(/[A-Za-z_]\w*/g) || []);
    for (const n of imported) {
      const byType = idx.ns.get(n);
      if (!byType) continue;
      for (const [type, files] of byType) {
        if (!ids.has(type)) continue;
        for (const f of files) if (f !== self) out.add(f);
      }
    }
  }
  return [...out];
}

module.exports = { name: 'C#', EXTS, extract };
