// The reference for TypeScript extraction recall (#996): the compiler's own parse says which
// top-level exports a file declares. Dev-only (see scripts/lib/extraction-recall.mjs).
//
// `typescript` is not a dependency of SigMap and never will be (ADR 0002: hand-written extractors,
// no tree-sitter, no compiler). The harness looks for one the way a user's tooling would, and
// without one the language is reported "unmeasured" and the run exits 0, exactly as C/C++ is
// without clangd:
//
//   1. --typescript <path>      a typescript.js file, its lib/ directory or the package directory
//   2. $SIGMAP_TYPESCRIPT       the same, from the environment
//   3. require.resolve('typescript') from this repository or the working directory
//
// Only the parse is used (`createSourceFile`); nothing is type-checked and no file is executed.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const req = createRequire(import.meta.url);

/** A `typescript.js` inside `p` (a file, a lib/ directory or a package directory), or null. */
function entryIn(p) {
  for (const c of [p, path.join(p, 'lib', 'typescript.js'), path.join(p, 'typescript.js')]) {
    try { if (fs.statSync(c).isFile()) return c; } catch (_) { /* not here */ }
  }
  return null;
}

/**
 * @param {string} [explicit] a path given on the command line
 * @returns {{ ts: object, path: string, version: string }|null}
 */
export function findTypeScript(explicit) {
  const candidates = [explicit, process.env.SIGMAP_TYPESCRIPT].filter(Boolean).map((p) => entryIn(path.resolve(p)));
  try { candidates.push(req.resolve('typescript', { paths: [root, process.cwd()] })); } catch (_) { /* none installed */ }
  for (const file of candidates) {
    if (!file) continue;
    try {
      const ts = req(file);
      if (ts && typeof ts.createSourceFile === 'function') return { ts, path: file, version: ts.version };
    } catch (_) { /* unreadable: try the next */ }
  }
  return null;
}

/**
 * The top-level exports of a file, as `[kind, name]` pairs, from the compiler's own parse.
 *
 * Kinds: function, class, interface, type, enum; `arrow` (an exported const bound to an arrow
 * function) and `factory` (an exported const bound to a call, `export const x = make(...)`);
 * `default` (an anonymous default export, which has no name to match by, so it is asked for as
 * a presence per file); and `dollar`, every name above that starts with `$`, counted a second
 * time because that is the share #996 reports.
 *
 * Not asked for: function expressions, object and literal constants, destructuring, namespaces
 * and re-exports. The extractor does not claim them.
 */
export function truthOf(ts, text, fileName) {
  const sf = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const K = ts.SyntaxKind;
  const out = [];
  const mods = (n) => (ts.getModifiers ? ts.getModifiers(n) : n.modifiers) || [];
  const has = (n, kind) => mods(n).some((m) => m.kind === kind);
  const add = (kind, name) => {
    out.push([kind, name]);
    if (name.startsWith('$')) out.push(['dollar', name]);
  };
  const unwrap = (e) => {
    while (e && (e.kind === K.ParenthesizedExpression || e.kind === K.AsExpression || e.kind === K.NonNullExpression
      || e.kind === K.TypeAssertionExpression || (K.SatisfiesExpression && e.kind === K.SatisfiesExpression))) e = e.expression;
    return e;
  };
  // A factory call is a call to a NAME (`make(...)`, `z.object(...)`, `connect(a)(B)`). `require(...)`,
  // `import(...)` and an immediately invoked function are calls too, and not what is asked for.
  const namedCallee = (call) => {
    let e = call;
    while (e.kind === K.CallExpression) e = e.expression;
    while (e.kind === K.PropertyAccessExpression) e = e.expression;
    return e.kind === K.Identifier && e.text !== 'require';
  };
  for (const st of sf.statements) {
    if (st.kind === K.ExportAssignment && !st.isExportEquals) {
      const e = unwrap(st.expression);
      if (e && (e.kind === K.ArrowFunction)) add('default', '(default)');
      continue;
    }
    if (!has(st, K.ExportKeyword)) continue;
    const isDefault = has(st, K.DefaultKeyword);
    if (st.kind === K.FunctionDeclaration) {
      if (st.name) add('function', st.name.text);
      else if (isDefault) add('default', '(default)');
    } else if (st.kind === K.ClassDeclaration) {
      if (st.name) add('class', st.name.text);
    } else if (st.kind === K.InterfaceDeclaration) add('interface', st.name.text);
    else if (st.kind === K.TypeAliasDeclaration) add('type', st.name.text);
    else if (st.kind === K.EnumDeclaration) add('enum', st.name.text);
    else if (st.kind === K.VariableStatement) {
      for (const d of st.declarationList.declarations) {
        if (d.name.kind !== K.Identifier || !d.initializer) continue;
        const init = unwrap(d.initializer);
        if (init.kind === K.ArrowFunction) add('arrow', d.name.text);
        else if (init.kind === K.CallExpression && namedCallee(init)) add('factory', d.name.text);
      }
    }
  }
  return out;
}
