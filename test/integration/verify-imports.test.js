'use strict';

/**
 * Imports, names and paths in `verify` and `judge` (#909, #672 — J3).
 *
 * Covers:
 *   Parsers
 *    1. extractImports reads names from every JS/TS form, across lines
 *    2. a JS default import is never read as a Python `import`
 *    3. Python from-imports (parenthesised, aliased, wildcard) and Go imports
 *    4. extractFilePaths reads Windows separators and leaves string escapes alone
 *    5. extractSymbols reads generic calls and ignores keyword "callees"
 *   Resolver (src/verify/imports.js) — real temp repos
 *    6. Python: packages (empty __init__.py), stdlib, shadowed stdlib, relative
 *    7. Go: go.mod root and nested modules, stdlib, requirements
 *    8. names: a fabricated name is found; a barrel, a default import, a
 *       package submodule and an ambiguous module are never flagged
 *   Guard (verify)
 *    9. fake-import / fake-import-name for Python and Go; verifiedImports
 *   10. a real Python relative import is no longer flagged
 *   Judge
 *   11. weak lexical text never grounds a claim verify proved fake
 *   12. without a cwd the lexical match is unchanged
 *   CLI
 *   13. the report names fake-import-name
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const SCRIPT = path.join(ROOT, 'gen-context.js');
const parsers = require(path.join(ROOT, 'src', 'verify', 'parsers'));
const imports = require(path.join(ROOT, 'src', 'verify', 'imports'));
const { verify } = require(path.join(ROOT, 'src', 'verify', 'hallucination-guard'));
const { claimGrounding, hasStrongEvidence } = require(path.join(ROOT, 'src', 'judge', 'judge-engine'));
const report = require(path.join(ROOT, 'src', 'format', 'verify-report'));

let passed = 0;
let failed = 0;
function test(name, fn) {
  try {
    fn();
    console.log(`  PASS  ${name}`);
    passed++;
  } catch (err) {
    console.error(`  FAIL  ${name}`);
    console.error(`        ${err.message}`);
    failed++;
  }
}

/** Write `{ 'rel/path': 'content' }` into a fresh temp repo. */
function makeRepo(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-imports-'));
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(dir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
  }
  return dir;
}
const cleanup = [];
function repo(files) { const d = makeRepo(files); cleanup.push(d); return d; }

const imp = (text) => parsers.extractImports(text);
const byModule = (text) => Object.fromEntries(imp(text).map((i) => [i.module, i]));

// ── 1. JS/TS forms ───────────────────────────────────────────────────────────
test('extractImports: named imports across every ESM form', () => {
  const m = byModule([
    "import { a, b as c } from './one';",
    "import {\n  d,\n  e, // trailing note\n} from './two';",
    "import D, { f } from './three';",
    "import type { T } from './four';",
    "export { g } from './five';",
  ].join('\n'));
  assert.deepStrictEqual(m['./one'].names, ['a', 'b']);
  assert.deepStrictEqual(m['./two'].names, ['d', 'e']);
  assert.deepStrictEqual(m['./three'].names, ['f'], 'a default binding is not a name to check');
  assert.deepStrictEqual(m['./four'].names, ['T']);
  assert.deepStrictEqual(m['./five'].names, ['g']);
  assert.strictEqual(m['./two'].line, 2, 'a multi-line import reports its first line');
});

test('extractImports: namespace, wildcard re-export, side-effect and default-only carry no names', () => {
  const m = byModule("import * as ns from './ns';\nexport * from './star';\nimport 'reflect-metadata';\nimport chalk from 'chalk';");
  assert.deepStrictEqual(m['./ns'].names, []);
  assert.strictEqual(m['./ns'].wildcard, true);
  assert.strictEqual(m['./star'].wildcard, true);
  assert.deepStrictEqual(m['reflect-metadata'].names, []);
  assert.deepStrictEqual(m['chalk'].names, []);
  assert.strictEqual(m['chalk'].relative, false);
});

test('extractImports: CJS destructuring, renames, and a require split across lines', () => {
  const m = byModule([
    "const { a, b } = require('./one');",
    "const {\n  c,\n  d: renamed,\n} = require('./two');",
    "const x = require(\n  './three'\n);",
    "const lazy = await import('./four');",
    "import fs = require('fs');",
  ].join('\n'));
  assert.deepStrictEqual(m['./one'].names, ['a', 'b']);
  assert.deepStrictEqual(m['./two'].names, ['c', 'd'], 'a rename takes the SOURCE name');
  assert.ok(m['./three'], 'require( across lines');
  assert.ok(m['./four'], 'dynamic import');
  assert.ok(m['fs']);
});

// ── 2. No bogus Python import from a JS line ─────────────────────────────────
test('extractImports: `import D, { a } from` and `import type {…}` never yield a Python module', () => {
  const list = imp("import D, { a } from './x';\nimport type { T } from './y';\nimport leftPad from 'left-pad';");
  assert.deepStrictEqual(list.filter((i) => i.kind === 'py'), [], 'no py import may come from a JS statement');
  assert.deepStrictEqual(list.map((i) => i.module).sort(), ['./x', './y', 'left-pad']);
});

// ── 3. Python and Go ─────────────────────────────────────────────────────────
test('extractImports: Python from-imports — parenthesised, aliased, wildcard — and plain imports', () => {
  const m = byModule([
    'from app.config import load_config, merge',
    'from app.cfg import (\n    one,\n    two as t,  # note\n)',
    'from app.all import *',
    'import os.path as p, sys',
    'from .cache import Cache',
  ].join('\n'));
  assert.deepStrictEqual(m['app.config'].names, ['load_config', 'merge']);
  assert.deepStrictEqual(m['app.cfg'].names, ['one', 'two']);
  assert.strictEqual(m['app.all'].wildcard, true);
  assert.ok(m['os.path'] && m['sys']);
  assert.strictEqual(m['.cache'].relative, true);
  assert.strictEqual(m['.cache'].kind, 'py');
});

test('extractImports: Go imports are read inside a go fence — single, aliased and block', () => {
  const text = [
    '```go',
    'import "single/pkg"',
    'import alias "aliased/pkg"',
    'import (',
    '\t"fmt"',
    '\t_ "blank/pkg"',
    '\tr "example.com/fx/internal/rank"',
    ')',
    '```',
  ].join('\n');
  const goMods = imp(text).filter((i) => i.kind === 'go').map((i) => i.module);
  assert.deepStrictEqual(goMods, ['single/pkg', 'aliased/pkg', 'fmt', 'blank/pkg', 'example.com/fx/internal/rank']);
  assert.ok(imp(text).every((i) => i.relative === false));
});

test('extractImports: outside a go fence an `import "x"` stays a JS side-effect import', () => {
  const list = imp('import "polyfill"');
  assert.deepStrictEqual(list.map((i) => [i.module, i.kind]), [['polyfill', 'js']]);
});

// ── 4. Windows paths ─────────────────────────────────────────────────────────
test('extractFilePaths: a Windows-style path is one claim, reported with `/`', () => {
  const found = parsers.extractFilePaths('Edit `src\\retrieval\\ranker.js` and src/retrieval/ranker.js.');
  assert.deepStrictEqual(found.map((f) => f.path), ['src/retrieval/ranker.js'], 'both spellings are the same claim');
});

test('extractFilePaths: string escapes, drive paths and escaped backslashes are not paths', () => {
  for (const text of ['say "a\\nfile.txt"', 'C:\\Users\\me\\notes.txt', 'share\\\\server\\\\x.txt', 'tab\\tseparated.log', 'two\\nlines.txt']) {
    assert.deepStrictEqual(parsers.extractFilePaths(text), [], `read as a path: ${text}`);
  }
});

test('extractFilePaths: a one-separator path is read unless its file starts with an escape letter', () => {
  assert.deepStrictEqual(parsers.extractFilePaths('Run `src\\main.py`.').map((f) => f.path), ['src/main.py']);
  assert.deepStrictEqual(parsers.extractFilePaths('Open `src\\lib\\test.js`.').map((f) => f.path), ['src/lib/test.js'], 'two separators: no ambiguity');
  // The documented price of precision: `lib\test.js` could be `lib<TAB>est.js`.
  assert.deepStrictEqual(parsers.extractFilePaths('Open `lib\\test.js`.'), []);
});

test('extractFilePaths: backslashes inside a code fence are escapes — except a shell fence', () => {
  assert.deepStrictEqual(parsers.extractFilePaths('```js\nconst p = "src\\\\a\\\\b.js";\nconst q = `src\\app\\x.js`;\n```'), []);
  const ps = parsers.extractFilePaths('```powershell\nGet-Content src\\app\\config.ps1\n```');
  assert.deepStrictEqual(ps.map((f) => f.path), ['src/app/config.ps1']);
});

// ── 5. Symbols ───────────────────────────────────────────────────────────────
test('extractSymbols: a generic call is read; a keyword before a parenthesis is not a callee', () => {
  const names = (t) => parsers.extractSymbols(t).map((s) => s.name);
  assert.deepStrictEqual(names('Call `parse<User>(input)` and `Vec::<u8>(x)`.'), ['parse', 'Vec']);
  assert.deepStrictEqual(names('`if (x)` `while (y)` `func (r *T) Name(x)` `catch (e)`'), []);
  assert.deepStrictEqual(names('`loadConfig()`'), ['loadConfig'], 'a plain call is unchanged');
});

test('extractSymbols: a declaration is deliberately not a claim (the index keeps maxSigsPerFile per file)', () => {
  assert.deepStrictEqual(parsers.extractSymbols('`async def fetch_user(id)` and `function parse(x)`'), []);
});

// ── 6. Python resolution ─────────────────────────────────────────────────────
const PY = {
  'src/app/__init__.py': '',                               // empty: no signature, never indexed
  'src/app/config.py': 'def load_config(path):\n    return {}\n\n\ndef merge_defaults(a, b):\n    return a\n',
  'src/app/ranker.py': 'def rank_files(q, f):\n    return f\n',
  'src/app/constants.py': 'FOO = 1\n',                      // constants only: no signature
  'src/app/sub/__init__.py': 'from .inner import thing\n',
  'src/app/sub/inner.py': 'def thing():\n    pass\n',
  'src/queue/__init__.py': '',                              // a repo package that shadows the stdlib
  'src/queue/mine.py': 'def own():\n    pass\n',
  'tests/test_config.py': 'def test_x():\n    pass\n',
};
const PY_KEYS = ['src/app/config.py', 'src/app/ranker.py', 'src/app/sub/inner.py', 'src/app/sub/__init__.py', 'src/queue/mine.py', 'tests/test_config.py'];

test('Python: a repo package resolves through an empty __init__.py that the index never held', () => {
  const dir = repo(PY);
  const ctx = imports.buildImportContext(dir, PY_KEYS);
  const c = (module, relative = false) => imports.classifyImport({ module, kind: 'py', relative }, ctx).status;
  assert.strictEqual(c('app.config'), 'resolved');
  assert.strictEqual(c('app'), 'resolved');
  assert.strictEqual(c('app.sub.inner'), 'resolved');
  assert.strictEqual(c('app.constants'), 'resolved', 'a module with no signature is found on disk');
  assert.strictEqual(c('app.cache'), 'unresolved', 'the repo owns `app`, and it has no `cache`');
  assert.strictEqual(c('app.config.nope'), 'unresolved');
});

test('Python: stdlib is resolved, third-party is left alone, a shadowed stdlib name is never flagged', () => {
  const dir = repo(PY);
  const ctx = imports.buildImportContext(dir, PY_KEYS);
  const c = (module) => imports.classifyImport({ module, kind: 'py', relative: false }, ctx).status;
  assert.strictEqual(c('os.path'), 'resolved');
  assert.strictEqual(c('requests'), 'unknown');
  assert.strictEqual(c('queue.mine'), 'resolved', 'the repo really has queue/mine.py');
  assert.strictEqual(c('queue.Queue'), 'unknown', 'a repo `queue` package shadows the stdlib one — not evidence of a fake');
});

test('Python: a relative import is read against every module path, not against the cwd', () => {
  const dir = repo(PY);
  const ctx = imports.buildImportContext(dir, PY_KEYS);
  const c = (module) => imports.classifyImport({ module, kind: 'py', relative: true }, ctx).status;
  assert.strictEqual(c('.config'), 'resolved');
  assert.strictEqual(c('..app.config'), 'resolved');
  assert.strictEqual(c('.sub.inner'), 'resolved');
  assert.strictEqual(c('.constants'), 'resolved', 'a signature-less module is probed on disk');
  assert.strictEqual(c('.'), 'resolved');
  assert.strictEqual(c('.ghostmod'), 'unresolved');
});

test('Python: a repo with no Python indexed leaves every Python import unknown', () => {
  const dir = repo({ 'README.md': 'x' });
  const ctx = imports.buildImportContext(dir, []);
  assert.strictEqual(imports.classifyImport({ module: 'app.config', kind: 'py', relative: false }, ctx).status, 'unknown');
  assert.strictEqual(imports.classifyImport({ module: '.config', kind: 'py', relative: true }, ctx).status, 'unknown');
});

// ── 7. Go resolution ─────────────────────────────────────────────────────────
const GO = {
  'go.mod': 'module example.com/fx\n\ngo 1.21\n\nrequire (\n\tgithub.com/spf13/cobra v1.8.0\n\tgolang.org/x/text v0.14.0 // indirect\n)\n\nrequire github.com/stretchr/testify v1.9.0\n',
  'internal/rank/rank.go': 'package rank\n\nfunc RankFiles() {}\n',
  'internal/only/only_test.go': 'package only\n',
  'cmd/fx/main.go': 'package main\n',
  'services/api/go.mod': 'module example.com/api\n\ngo 1.21\n',
  'services/api/handler/h.go': 'package handler\n',
};
const GO_KEYS = ['internal/rank/rank.go', 'internal/only/only_test.go', 'cmd/fx/main.go', 'services/api/handler/h.go'];

test('Go: an import under the module path resolves to a directory with Go files, or does not', () => {
  const ctx = imports.buildImportContext(repo(GO), GO_KEYS);
  const c = (p) => imports.classifyImport({ module: p, kind: 'go', relative: false }, ctx);
  assert.strictEqual(c('example.com/fx/internal/rank').status, 'resolved');
  assert.strictEqual(c('example.com/fx/internal/only').status, 'resolved', 'a directory holding only _test.go files is still a package');
  assert.strictEqual(c('example.com/fx/internal/ghost').status, 'unresolved');
  assert.strictEqual(c('example.com/fx').status, 'unresolved', 'the root holds no Go file here');
});

test('Go: a nested module resolves under its own path, and the longest module wins', () => {
  const ctx = imports.buildImportContext(repo(GO), GO_KEYS);
  const c = (p) => imports.classifyImport({ module: p, kind: 'go', relative: false }, ctx).status;
  assert.strictEqual(c('example.com/api/handler'), 'resolved');
  assert.strictEqual(c('example.com/api/ghost'), 'unresolved');
});

test('Go: stdlib and required modules are resolved; anything else is unknown, never flagged', () => {
  const ctx = imports.buildImportContext(repo(GO), GO_KEYS);
  const c = (p) => imports.classifyImport({ module: p, kind: 'go', relative: false }, ctx);
  assert.strictEqual(c('fmt').via, 'stdlib');
  assert.strictEqual(c('net/http').via, 'stdlib');
  assert.strictEqual(c('github.com/spf13/cobra').via, 'go.mod');
  assert.strictEqual(c('github.com/spf13/cobra/doc').status, 'resolved', 'a sub-package of a required module');
  assert.strictEqual(c('github.com/stretchr/testify/assert').status, 'resolved', 'the single-line require form');
  assert.strictEqual(c('github.com/some/other').status, 'unknown');
});

test('Go: with no go.mod nothing local can be decided', () => {
  const ctx = imports.buildImportContext(repo({ 'internal/rank/rank.go': 'package rank\n' }), ['internal/rank/rank.go']);
  assert.strictEqual(imports.classifyImport({ module: 'myapp/internal/rank', kind: 'go', relative: false }, ctx).status, 'unknown');
  assert.strictEqual(imports.classifyImport({ module: 'fmt', kind: 'go', relative: false }, ctx).status, 'resolved');
});

test('parseGoMod: module path and every require form', () => {
  const m = imports.parseGoMod('module "example.com/q"\nrequire a.b/c v1.0.0\nrequire (\n  d.e/f v2.0.0 // indirect\n)\n');
  assert.strictEqual(m.module, 'example.com/q');
  assert.deepStrictEqual(m.requires, ['a.b/c', 'd.e/f']);
});

// ── 8. Named imports ─────────────────────────────────────────────────────────
const JS = {
  'src/util.js': "'use strict';\nfunction helper(n) { return n; }\nmodule.exports = { helper };\n",
  'src/barrel.js': "module.exports = require('./util');\n",
  'src/reexport.ts': "export * from './util';\n",
  'src/dyn.js': "const m = {};\nObject.keys(m).forEach((k) => { exports[k] = m[k]; });\n",
  'src/types.ts': 'export interface User { id: string }\nexport type Id = string;\n',
  'src/a/dup.js': 'function onlyInA() {}\nmodule.exports = { onlyInA };\n',
  'src/b/dup.js': 'function onlyInB() {}\nmodule.exports = { onlyInB };\n',
};
const JS_KEYS = Object.keys(JS);
const missing = (dir, statement) => {
  const ctx = imports.buildImportContext(dir, JS_KEYS);
  const found = imp(statement)[0];
  const r = imports.missingNames(found, ctx);
  return r ? r.missing : null;
};

test('names: a fabricated name from a resolvable repo module is found; a real one is not', () => {
  const dir = repo(JS);
  assert.deepStrictEqual(missing(dir, "import { helper, ghost } from './src/util';"), ['ghost']);
  assert.strictEqual(missing(dir, "import { helper } from './src/util';"), null);
  assert.deepStrictEqual(missing(dir, "const { helper, nope } = require('./src/util');"), ['nope']);
  assert.deepStrictEqual(missing(dir, "import type { User, Ghost } from './src/types';"), ['Ghost']);
});

test('names: never flagged for a default import, a namespace import, a barrel, or a computed export', () => {
  const dir = repo(JS);
  assert.strictEqual(missing(dir, "import Default from './src/util';"), null, 'default binding');
  assert.strictEqual(missing(dir, "import * as ns from './src/util';"), null, 'namespace');
  assert.strictEqual(missing(dir, "import { anything } from './src/barrel';"), null, 'module.exports = require(…)');
  assert.strictEqual(missing(dir, "import { anything } from './src/reexport';"), null, 'export *');
  assert.strictEqual(missing(dir, "import { anything } from './src/dyn';"), null, 'exports[k] = …');
});

test('names: never flagged for an ambiguous module, a bare package, or a missing module', () => {
  const dir = repo(JS);
  assert.strictEqual(missing(dir, "import { x } from './dup';"), null, 'two files named dup');
  assert.strictEqual(missing(dir, "import { onlyInA } from './a/dup';"), null, 'present in the narrowed file');
  assert.deepStrictEqual(missing(dir, "import { onlyInB } from './a/dup';"), ['onlyInB'], 'the path narrows to one file');
  assert.strictEqual(missing(dir, "import { x } from 'lodash';"), null, 'a bare package has no local file');
  assert.strictEqual(missing(dir, "import { x } from './nowhere';"), null, 'no such module — verify reports that, not a name');
});

const PYN = {
  'src/app/__init__.py': 'from .config import load_config as load_config\n',
  'src/app/config.py': 'def load_config(path):\n    return {}\n',
  'src/app/ranker.py': 'def rank_files(q, f):\n    return f\n',
  'src/app/star.py': 'from .config import *\n',
  'src/app/dyn.py': 'def __getattr__(name):\n    raise AttributeError(name)\n',
};
const pyMissing = (dir, statement) => {
  const ctx = imports.buildImportContext(dir, ['src/app/config.py', 'src/app/ranker.py', 'src/app/star.py', 'src/app/dyn.py']);
  const r = imports.missingNames(imp(statement)[0], ctx);
  return r ? r.missing : null;
};

test('names (Python): a fabricated name is found; a package submodule, a wildcard module and __getattr__ are not flagged', () => {
  const dir = repo(PYN);
  assert.deepStrictEqual(pyMissing(dir, 'from app.config import load_config, ghost_loader'), ['ghost_loader']);
  assert.strictEqual(pyMissing(dir, 'from app.config import load_config'), null);
  assert.deepStrictEqual(pyMissing(dir, 'from app.ranker import (\n    rank_files,\n    ghost,\n)'), ['ghost']);
  assert.strictEqual(pyMissing(dir, 'from app import config, ranker'), null, 'submodules of a package are importable names');
  assert.deepStrictEqual(pyMissing(dir, 'from app import ghostmod'), ['ghostmod']);
  assert.strictEqual(pyMissing(dir, 'from app.star import anything'), null, 'a wildcard re-export hides its names');
  assert.strictEqual(pyMissing(dir, 'from app.dyn import anything'), null, '__getattr__ makes names dynamic');
  assert.strictEqual(pyMissing(dir, 'from app.ranker import *'), null, 'a wildcard import takes no name');
});

// ── 9 & 10. The guard ────────────────────────────────────────────────────────
/** verify() against a temp repo, with the symbol index injected so no index run is needed. */
function guard(dir, keys, answer, extra = {}) {
  return verify(answer, dir, Object.assign({
    symbolSet: new Set(['load_config', 'merge_defaults', 'rank_files', 'helper', 'RankFiles']),
    fileBasenames: new Set(keys.map((k) => path.basename(k).replace(/\.[^.]+$/, '').toLowerCase())),
    symbolCandidates: [{ name: 'load_config', file: 'src/app/config.py', line: 1 }, { name: 'helper', file: 'src/util.js', line: 2 }],
    fileCandidates: keys,
    deps: new Set(),
    hasPkg: false,
    fileExists: (ref) => fs.existsSync(path.join(dir, ref)),
  }, extra));
}
const types = (r) => r.issues.map((i) => `${i.type}::${i.value}`).sort();

test('verify: a fabricated local Python import is a fake-import; a real one is verified', () => {
  const dir = repo(PY);
  const r = guard(dir, PY_KEYS, '```python\nfrom app.config import load_config\nfrom app.cache import Cache\nimport os.path\nimport requests\n```');
  assert.deepStrictEqual(types(r), ['fake-import::app.cache']);
  assert.ok(r.summary.verifiedImports.includes('app.config'));
  assert.ok(r.summary.verifiedImports.includes('os.path'), 'stdlib is verified');
  assert.ok(!r.summary.verifiedImports.includes('requests'), 'an import verify could not decide is NOT verified');
  assert.strictEqual(r.issues[0].confidence, 'high');
});

test('verify: a fabricated Go import under the module path is a fake-import; stdlib and requirements are verified', () => {
  const dir = repo(GO);
  const r = guard(dir, GO_KEYS, '```go\nimport (\n\t"fmt"\n\t"example.com/fx/internal/rank"\n\t"example.com/fx/internal/ghost"\n\t"github.com/spf13/cobra"\n\t"github.com/unlisted/mod"\n)\n```');
  assert.deepStrictEqual(types(r), ['fake-import::example.com/fx/internal/ghost']);
  for (const ok of ['fmt', 'example.com/fx/internal/rank', 'github.com/spf13/cobra']) assert.ok(r.summary.verifiedImports.includes(ok), ok);
  assert.ok(!r.summary.verifiedImports.includes('github.com/unlisted/mod'));
});

test('verify: fake-import-name for a fabricated name, with a near-miss suggestion; medium confidence', () => {
  const dir = repo(PY);
  const r = guard(dir, PY_KEYS, '```python\nfrom app.config import load_confg, merge_defaults\n```');
  assert.deepStrictEqual(types(r), ['fake-import-name::load_confg']);
  const issue = r.issues[0];
  assert.strictEqual(issue.confidence, 'medium');
  assert.ok(/src\/app\/config\.py/.test(issue.message), issue.message);
  assert.ok(issue.suggestion && /load_config/.test(issue.suggestion), issue.suggestion);
  assert.strictEqual(r.summary.byType['fake-import-name'], 1);
});

test('verify: fake-import-name for JS, and nothing for a default import, a barrel or a real name', () => {
  const dir = repo(JS);
  const r = guard(dir, JS_KEYS, [
    '```js',
    "import { helper, ghost } from './src/util';",
    "import Default from './src/util';",
    "import { anything } from './src/barrel';",
    '```',
  ].join('\n'), { relativeResolvable: () => true });
  assert.deepStrictEqual(types(r), ['fake-import-name::ghost']);
});

test('verify: a real Python relative import is no longer a fake-import (it was, for every one)', () => {
  const dir = repo(PY);
  const r = guard(dir, PY_KEYS, '```python\nfrom .config import load_config\nfrom . import ranker\nfrom ..other import thing\nfrom .ghostmod import X\n```');
  assert.deepStrictEqual(types(r), ['fake-import::..other', 'fake-import::.ghostmod']);
});

test('verify: with no Python or Go to read, nothing is flagged beyond what was before', () => {
  const dir = repo({ 'README.md': 'x' });
  const r = guard(dir, [], '```python\nfrom app.config import load_config\nimport requests\n```\n```go\nimport "example.com/fx/x"\n```');
  assert.deepStrictEqual(types(r), []);
});

test('verify: every verified import of a JS answer is recorded too', () => {
  const dir = repo(JS);
  const r = guard(dir, JS_KEYS, "import { helper } from './src/util';\nimport fs from 'fs';\nimport chalk from 'chalk';", {
    hasPkg: true, deps: new Set(['chalk']), relativeResolvable: () => true,
  });
  assert.deepStrictEqual(r.summary.verifiedImports.sort(), ['./src/util', 'chalk', 'fs']);
});

// ── 11 & 12. Judge ───────────────────────────────────────────────────────────
test('judge evidence: a symbol needs a call or definition, never the bare word', () => {
  const ctx = 'to rank files by topic. function rankfiles(query) {} class ranker {} def merge_defaults(a, b)';
  assert.strictEqual(hasStrongEvidence('symbol', 'rank', ctx), false, 'a prose word');
  assert.strictEqual(hasStrongEvidence('symbol', 'merge_default', ctx), false, 'a substring of merge_defaults');
  assert.strictEqual(hasStrongEvidence('symbol', 'rankfiles', ctx), true, 'a call/definition form');
  assert.strictEqual(hasStrongEvidence('symbol', 'merge_defaults', ctx), true, 'a def');
  assert.strictEqual(hasStrongEvidence('symbol', 'ranker', ctx), true, 'a class');
  assert.strictEqual(hasStrongEvidence('symbol', 'handler', 'const handler = async (req) => {}'), true, 'an arrow assignment');
});

test('judge evidence: a file needs its own path as a path-aligned suffix, not just its basename', () => {
  const ctx = '## deps\nsrc/index.js ← util\nsrc/lib/index.js\nREADME.md';
  assert.strictEqual(hasStrongEvidence('file', 'lib/index.js', 'src/index.js ← util'), false, 'basename of another path');
  assert.strictEqual(hasStrongEvidence('file', 'lib/index.js', ctx), true, 'a longer path ending in the claim');
  assert.strictEqual(hasStrongEvidence('file', 'index.js', ctx), true, 'a bare basename of a path the context names');
  assert.strictEqual(hasStrongEvidence('file', 'ex.js', ctx), false, 'the tail of a longer file name');
  assert.strictEqual(hasStrongEvidence('file', 'src/index.js', 'src/index.js.bak'), false, 'a longer extension');
});

test('judge evidence: an import is a whole token, not a prefix or substring of a longer module', () => {
  assert.strictEqual(hasStrongEvidence('import', 'app.cache', 'from app.cache_utils import x'), false);
  assert.strictEqual(hasStrongEvidence('import', 'app.cache', 'from app.cache import x'), true);
  assert.strictEqual(hasStrongEvidence('import', 'left-pad', 'use left-pad-9000'), false);
});

test('judge: a claim verify proved fake is not grounded by a word in the context; a real one still is', () => {
  const dir = repo({
    'package.json': JSON.stringify({ name: 'x', scripts: {} }),
    'src/index.js': "function rankFiles(q, f) { return f; }\nmodule.exports = { rankFiles };\n",
  });
  const gen = spawnSync(process.execPath, [SCRIPT], { cwd: dir, stdio: 'ignore' });
  assert.strictEqual(gen.status, 0, 'gen-context should index the temp repo');
  const ctxText = 'to rank files by topic. The map lists src/index.js. function rankFiles(q, f) {}';
  const answer = 'Use `rank(q)` from `lib/index.js`, or `rankFiles(q, f)` in `src/index.js`.';
  const withCwd = claimGrounding(answer, ctxText, { cwd: dir });
  const bad = withCwd.ungrounded.map((c) => `${c.kind}::${c.value}`).sort();
  assert.deepStrictEqual(bad, ['file::lib/index.js', 'symbol::rank']);
  // The same answer with no cwd keeps the lenient lexical match — byte-identical to before.
  const lexical = claimGrounding(answer, ctxText);
  assert.deepStrictEqual(lexical.ungrounded, [], 'no cwd, no structural verdict: the old lexical behaviour');
  assert.strictEqual(lexical.structural, false);
});

test('judge: a real Go import is cleared by verify even with no package.json', () => {
  const dir = repo({
    'go.mod': 'module example.com/fx\n\ngo 1.21\n',
    'internal/rank/rank.go': 'package rank\n\nfunc RankFiles(q string) {}\n',
  });
  const gen = spawnSync(process.execPath, [SCRIPT], { cwd: dir, stdio: 'ignore' });
  assert.strictEqual(gen.status, 0);
  const answer = '```go\nimport (\n\t"fmt"\n\t"example.com/fx/internal/rank"\n\t"example.com/fx/internal/ghost"\n)\n```';
  const c = claimGrounding(answer, 'unrelated context text', { cwd: dir });
  const bad = c.ungrounded.map((x) => `${x.kind}::${x.value}`);
  assert.deepStrictEqual(bad, ['import::example.com/fx/internal/ghost']);
  assert.ok(c.checked.find((x) => x.value === 'example.com/fx/internal/rank' && x.via === 'repo'));
});

test('judge: a fake Python import is not grounded by a longer module name, with no package.json', () => {
  const dir = repo({
    'src/app/__init__.py': '',
    'src/app/config.py': 'def load_config(path):\n    return {}\n',
  });
  assert.strictEqual(spawnSync(process.execPath, [SCRIPT], { cwd: dir, stdio: 'ignore' }).status, 0);
  const answer = '```python\nfrom app.cache import Cache\nfrom app.config import load_config\n```';
  // `app.cache_utils` contains the claim `app.cache` as a substring — not evidence for it.
  const ctxText = 'modules: app.cache_utils; src/app/config.py has def load_config(path)';
  const c = claimGrounding(answer, ctxText, { cwd: dir });
  assert.deepStrictEqual(c.ungrounded.map((x) => `${x.kind}::${x.value}`), ['import::app.cache']);
  assert.ok(c.checked.find((x) => x.value === 'app.config' && x.grounded && x.via === 'repo'), 'the real import is cleared by verify');
});

// ── 13. Report and CLI ───────────────────────────────────────────────────────
test('report: fake-import-name has a label in the HTML and Markdown renderings', () => {
  const result = {
    file: 'a.md',
    issues: [{ type: 'fake-import-name', value: 'ghost', line: 3, location: 'L3', message: 'Not exported by ./x (src/x.js): ghost', confidence: 'medium', suggestion: null }],
    summary: { total: 1, byType: { 'fake-import-name': 1 }, clean: false },
  };
  assert.ok(/Fake imported name/.test(report.renderReportHtml(result)));
  assert.ok(/Fake imported name/.test(report.renderReportMarkdown(result)));
});

test('CLI: `verify` names fake-import-name in its summary line and exits 1', () => {
  const dir = repo({
    'src/app/__init__.py': '',
    'src/app/config.py': 'def load_config(path):\n    return {}\n',
  });
  assert.strictEqual(spawnSync(process.execPath, [SCRIPT], { cwd: dir, stdio: 'ignore' }).status, 0);
  fs.writeFileSync(path.join(dir, 'answer.md'), '```python\nfrom app.config import load_config, ghost_loader\n```\n');
  const res = spawnSync(process.execPath, [SCRIPT, 'verify', 'answer.md'], { cwd: dir, encoding: 'utf8' });
  assert.strictEqual(res.status, 1, res.stdout + res.stderr);
  assert.ok(/fake-import-name: 1/.test(res.stdout), res.stdout);
  assert.ok(/\[Fake imported name\]/.test(res.stdout), res.stdout);
  const json = spawnSync(process.execPath, [SCRIPT, 'verify', 'answer.md', '--json'], { cwd: dir, encoding: 'utf8' });
  const out = JSON.parse(json.stdout);
  assert.strictEqual(out.summary.byType['fake-import-name'], 1);
});

for (const d of cleanup) {
  try { fs.rmSync(d, { recursive: true, force: true }); } catch (_) {}
}

console.log(`\nverify-imports: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
