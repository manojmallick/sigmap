'use strict';

/**
 * Integration: the Python AST tier starts one python3 per chunk, not one per file (#970).
 *
 * The default extractor used to run `python3 python_ast.py <file>` for every
 * `.py` file: about 2,900 process starts on Django, 182 s against 7 s for the
 * regex tier. `prefetch` now hands the run's files to `python_ast.py --batch`,
 * and `tryNativeExtract` reads the answers back.
 *
 * Most tests put a FAKE python3 first on PATH. It logs every invocation, so
 * "how many processes" is counted rather than inferred from timing, and it needs
 * no real Python, so the regression runs on any POSIX machine. The tests that
 * compare against the real interpreter skip when there is none.
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync, execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..', '..');
const PY_MODULE = path.join(ROOT, 'src/extractors/python.js');
const POSIX = process.platform !== 'win32';

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  PASS  ${name}`); passed++; }
  catch (e) { console.log(`  FAIL  ${name}\n        ${e.message}`); failed++; }
}
function skip(name, why) { console.log(`  SKIP  ${name} (${why})`); passed++; }

/** A fresh copy of the extractor: its batch map and version live at module scope. */
function freshPython() {
  delete require.cache[require.resolve(PY_MODULE)];
  return require(PY_MODULE);
}

function realPython3() {
  try { execFileSync('python3', ['--version'], { stdio: 'ignore', timeout: 5000 }); return true; } catch (_) { return false; }
}
const REAL = realPython3();

/**
 * A fake python3 in its own directory. MODE (env): ok | fail | hang | partial.
 * `ok` answers `--batch` with the real protocol and a version header of 3.11.2.
 */
function fakeBin(dir) {
  const bin = path.join(dir, 'bin');
  fs.mkdirSync(bin, { recursive: true });
  const script = `#!${process.execPath}
'use strict';
const fs = require('fs');
const argv = process.argv.slice(2);
if (process.env.FAKE_LOG) fs.appendFileSync(process.env.FAKE_LOG, JSON.stringify(argv) + '\\n');
const mode = process.env.FAKE_MODE || 'ok';
if (argv[0] === '-c') { console.log('3.11'); process.exit(0); }
if (argv[1] === '--batch') {
  if (mode === 'fail') process.exit(3);
  if (mode === 'hang') { setTimeout(() => {}, 60000); return; }
  const paths = fs.readFileSync(0, 'utf8').split('\\n').filter(Boolean).map((l) => JSON.parse(l));
  console.log(JSON.stringify({ version: [3, 11, 2] }));
  const limit = mode === 'partial' ? 2 : paths.length;
  paths.slice(0, limit).forEach((p) => console.log(JSON.stringify({ path: p, sigs: ['def fake_' + require('path').basename(p, '.py') + '(x)'] })));
  process.exit(mode === 'partial' ? 1 : 0);
}
console.log(JSON.stringify(['def fake_single(x)']));
`;
  const file = path.join(bin, 'python3');
  fs.writeFileSync(file, script, { mode: 0o755 });
  return bin;
}

function logLines(log) {
  try { return fs.readFileSync(log, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)); } catch (_) { return []; }
}
const batchCalls = (lines) => lines.filter((a) => a[1] === '--batch').length;

function withPath(binDir, fn) {
  const saved = process.env.PATH;
  process.env.PATH = binDir ? binDir + path.delimiter + saved : saved;
  try { return fn(); } finally { process.env.PATH = saved; }
}

function withEnv(vars, fn) {
  const saved = {};
  for (const k of Object.keys(vars)) { saved[k] = process.env[k]; process.env[k] = vars[k]; }
  try { return fn(); } finally { for (const k of Object.keys(vars)) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; } }
}

function projectWith(n, dir) {
  const files = [];
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
  for (let i = 0; i < n; i++) {
    const f = path.join(dir, 'src', `mod${String(i).padStart(3, '0')}.py`);
    fs.writeFileSync(f, `def func_${i}(a, b=1):\n    return a + b\n`);
    files.push(f);
  }
  return files;
}

function tmp(label) { return fs.mkdtempSync(path.join(os.tmpdir(), `sigmap-pybatch-${label}-`)); }
function rm(dir) { try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {} }

// ── process count: the regression this issue is about ───────────────────────

if (POSIX) {
  test('prefetch starts one python3 per chunk, and reading the answers back starts none', () => {
    const dir = tmp('count');
    try {
      const files = projectWith(25, dir);
      const bin = fakeBin(dir), log = path.join(dir, 'calls.log');
      withEnv({ FAKE_LOG: log, FAKE_MODE: 'ok' }, () => withPath(bin, () => {
        const py = freshPython();
        const s = py.prefetch(files, { chunk: 10 });
        assert.strictEqual(s.requested, 25);
        assert.strictEqual(s.served, 25);
        assert.strictEqual(batchCalls(logLines(log)), 3, '25 files in chunks of 10 is 3 processes');
        for (const f of files) assert.deepStrictEqual(py.tryNativeExtract(f), [`def fake_${path.basename(f, '.py')}(x)`]);
        assert.strictEqual(logLines(log).length, 3, 'tryNativeExtract must not start a process for a prefetched file');
      }));
    } finally { rm(dir); }
  });

  test('generate runs python3 once for the whole project, not once per file (CLI)', () => {
    const dir = tmp('cli');
    try {
      projectWith(30, dir);
      const bin = fakeBin(dir), log = path.join(dir, 'calls.log');
      const r = spawnSync(process.execPath, [path.join(ROOT, 'gen-context.js')], {
        cwd: dir, encoding: 'utf8', timeout: 120000,
        env: Object.assign({}, process.env, { PATH: bin + path.delimiter + process.env.PATH, FAKE_LOG: log, FAKE_MODE: 'ok' }),
      });
      assert.strictEqual(r.status, 0, r.stderr);
      const calls = logLines(log);
      assert.strictEqual(calls.length, 1, `expected a single python3 process for 30 files, saw ${calls.length}: ${JSON.stringify(calls.slice(0, 3))}`);
      assert.strictEqual(batchCalls(calls), 1);
      const out = fs.readFileSync(path.join(dir, '.github', 'copilot-instructions.md'), 'utf8');
      assert.ok(out.includes('def fake_mod000(x)'), 'the batch answers must reach the generated context');
      assert.match(out, /toolchain=python@3\.11/, 'the header must name the python that served the AST tier');
    } finally { rm(dir); }
  });

  test('a project with no python3 on PATH is the regex tier, with no notice and no per-file attempts', () => {
    const dir = tmp('absent');
    try {
      const files = projectWith(5, dir);
      const empty = path.join(dir, 'empty-bin');
      fs.mkdirSync(empty);
      const warned = [];
      const origWarn = console.warn;
      console.warn = (...a) => warned.push(a.join(' '));
      try {
        withEnv({ PATH: empty }, () => {
          const py = freshPython();
          const s = py.prefetch(files);
          assert.strictEqual(s.available, false);
          assert.strictEqual(s.served, 0);
          for (const f of files) assert.strictEqual(py.tryNativeExtract(f), null);
          assert.strictEqual(py.toolchainLabel(), null, 'no AST served, no label');
        });
      } finally { console.warn = origWarn; }
      assert.deepStrictEqual(warned, [], 'python3 being absent is the regex tier by design, not a failure');
    } finally { rm(dir); }
  });

  // ── degradation ───────────────────────────────────────────────────────────

  test('a failing batch degrades its files to the regex tier with one notice, and never falls back to one process per file', () => {
    const dir = tmp('fail');
    try {
      const files = projectWith(12, dir);
      const bin = fakeBin(dir), log = path.join(dir, 'calls.log');
      const warned = [];
      const origWarn = console.warn;
      console.warn = (...a) => warned.push(a.join(' '));
      try {
        withEnv({ FAKE_LOG: log, FAKE_MODE: 'fail' }, () => withPath(bin, () => {
          const py = freshPython();
          const s = py.prefetch(files, { chunk: 5 });
          assert.strictEqual(s.served, 0);
          assert.strictEqual(s.degraded, 12);
          for (const f of files) assert.strictEqual(py.tryNativeExtract(f), null, 'a failed batch leaves the file to the regex tier');
          assert.strictEqual(logLines(log).length, 3, 'three failed chunks, and no per-file retries afterwards');
        }));
      } finally { console.warn = origWarn; }
      assert.strictEqual(warned.length, 1, `one notice, got ${warned.length}: ${warned.join(' | ')}`);
      assert.match(warned[0], /python3 AST pass failed for 12 of 12/);
      assert.match(warned[0], /regex tier/);
    } finally { rm(dir); }
  });

  test('generate still completes, from the regex tier, when the batch fails (CLI)', () => {
    const dir = tmp('failcli');
    try {
      projectWith(6, dir);
      const bin = fakeBin(dir);
      const r = spawnSync(process.execPath, [path.join(ROOT, 'gen-context.js')], {
        cwd: dir, encoding: 'utf8', timeout: 120000,
        env: Object.assign({}, process.env, { PATH: bin + path.delimiter + process.env.PATH, FAKE_MODE: 'fail' }),
      });
      assert.strictEqual(r.status, 0, r.stderr);
      assert.match(r.stderr, /python3 AST pass failed for 6 of 6/);
      const out = fs.readFileSync(path.join(dir, '.github', 'copilot-instructions.md'), 'utf8');
      assert.ok(out.includes('def func_0('), 'the regex tier must still index the files');
      assert.ok(!/toolchain=python/.test(out), 'no AST served, so the header must not claim python');
    } finally { rm(dir); }
  });

  test('a batch that dies part-way keeps the answers it flushed and degrades only the rest', () => {
    const dir = tmp('partial');
    try {
      const files = projectWith(6, dir);
      const bin = fakeBin(dir);
      const origWarn = console.warn;
      console.warn = () => {};
      try {
        withEnv({ FAKE_MODE: 'partial' }, () => withPath(bin, () => {
          const py = freshPython();
          const s = py.prefetch(files, { chunk: 100 });
          assert.strictEqual(s.served, 2);
          assert.strictEqual(s.degraded, 4);
        }));
      } finally { console.warn = origWarn; }
    } finally { rm(dir); }
  });

  test('a hung batch is ended by the timeout and its files degrade', () => {
    const dir = tmp('hang');
    try {
      const files = projectWith(3, dir);
      const bin = fakeBin(dir);
      const warned = [];
      const origWarn = console.warn;
      console.warn = (...a) => warned.push(a.join(' '));
      try {
        withEnv({ FAKE_MODE: 'hang' }, () => withPath(bin, () => {
          const py = freshPython();
          const t0 = Date.now();
          const s = py.prefetch(files, { timeoutMs: 300 });
          assert.ok(Date.now() - t0 < 10000, 'the timeout must end the hung process');
          assert.strictEqual(s.degraded, 3);
        }));
      } finally { console.warn = origWarn; }
      assert.strictEqual(warned.length, 1);
      assert.match(warned[0], /ETIMEDOUT/);
    } finally { rm(dir); }
  });

  // ── staleness, label ──────────────────────────────────────────────────────

  test('a file edited after the pre-pass is read afresh by the per-file call, as before', () => {
    const dir = tmp('stale');
    try {
      const files = projectWith(3, dir);
      const bin = fakeBin(dir), log = path.join(dir, 'calls.log');
      withEnv({ FAKE_LOG: log, FAKE_MODE: 'ok' }, () => withPath(bin, () => {
        const py = freshPython();
        py.prefetch(files);
        assert.deepStrictEqual(py.tryNativeExtract(files[0]), ['def fake_mod000(x)']);
        fs.writeFileSync(files[1], 'def edited_after_prefetch(a, b, c):\n    return 1\n');
        assert.deepStrictEqual(py.tryNativeExtract(files[1]), ['def fake_single(x)'], 'a changed file must not be answered from the batch');
        assert.strictEqual(logLines(log).filter((a) => a[1] !== '--batch').length, 1, 'exactly one per-file call, for the edited file');
      }));
    } finally { rm(dir); }
  });

  test('a second prefetch of unchanged files starts no process, and a file the first one failed on is tried again', () => {
    const dir = tmp('again');
    try {
      const files = projectWith(4, dir);
      const bin = fakeBin(dir), log = path.join(dir, 'calls.log');
      const py = freshPython();
      const origWarn = console.warn;
      console.warn = () => {};
      try {
        withEnv({ FAKE_LOG: log, FAKE_MODE: 'fail' }, () => withPath(bin, () => {
          assert.strictEqual(py.prefetch(files).degraded, 4);
        }));
      } finally { console.warn = origWarn; }
      withEnv({ FAKE_LOG: log, FAKE_MODE: 'ok' }, () => withPath(bin, () => {
        const retried = py.prefetch(files);
        assert.strictEqual(retried.served, 4, 'a degraded file must be sent again, not remembered as failed for good');
        const before = logLines(log).length;
        const again = py.prefetch(files);
        assert.strictEqual(again.reused, 4);
        assert.strictEqual(again.served, 0);
        assert.strictEqual(logLines(log).length, before, 'files already answered and unchanged must not start a process');
        fs.writeFileSync(files[2], 'def changed(a):\\n    pass\\n');
        const third = py.prefetch(files);
        assert.strictEqual(third.reused, 3);
        assert.strictEqual(third.served, 1, 'only the edited file is sent');
      }));
    } finally { rm(dir); }
  });

  test('sigmap sync walks the files twice but starts python3 once (CLI)', () => {
    const dir = tmp('sync');
    try {
      projectWith(10, dir);
      const bin = fakeBin(dir), log = path.join(dir, 'calls.log');
      const r = spawnSync(process.execPath, [path.join(ROOT, 'gen-context.js'), 'sync'], {
        cwd: dir, encoding: 'utf8', timeout: 120000,
        env: Object.assign({}, process.env, { PATH: bin + path.delimiter + process.env.PATH, FAKE_LOG: log, FAKE_MODE: 'ok' }),
      });
      assert.strictEqual(r.status, 0, r.stderr);
      const calls = logLines(log);
      assert.strictEqual(calls.length, 1, `expected one python3 process for generate plus the llms.txt walk, saw ${calls.length}`);
    } finally { rm(dir); }
  });

  test('toolchainLabel names the python minor version that served the AST tier, and only once it did', () => {
    const dir = tmp('label');
    try {
      const files = projectWith(2, dir);
      const bin = fakeBin(dir);
      withEnv({ FAKE_MODE: 'ok' }, () => withPath(bin, () => {
        const py = freshPython();
        assert.strictEqual(py.toolchainLabel(), null, 'nothing served yet');
        py.prefetch(files);
        assert.strictEqual(py.toolchainLabel(), null, 'answers fetched but none used');
        py.tryNativeExtract(files[0]);
        assert.strictEqual(py.toolchainLabel(), 'python@3.11');
      }));
    } finally { rm(dir); }
  });

  test('freshen re-extracts a branch switch\'s worth of changed Python files with one python3 process', () => {
    const dir = tmp('freshen');
    try {
      const files = projectWith(12, dir);
      const bin = fakeBin(dir), log = path.join(dir, 'calls.log');
      // A generated context gives freshen a base to measure "changed since" against.
      const gen = spawnSync(process.execPath, [path.join(ROOT, 'gen-context.js')], {
        cwd: dir, encoding: 'utf8', timeout: 120000,
        env: Object.assign({}, process.env, { PATH: bin + path.delimiter + process.env.PATH, FAKE_MODE: 'ok' }),
      });
      assert.strictEqual(gen.status, 0, gen.stderr);
      const later = new Date(Date.now() + 60000);
      for (const f of files) { fs.appendFileSync(f, '\n# edited\n'); fs.utimesSync(f, later, later); }
      const freshenPath = require.resolve(path.join(ROOT, 'src/cache/freshen.js'));
      delete require.cache[freshenPath];
      delete require.cache[require.resolve(PY_MODULE)];
      const { freshen } = require(freshenPath);
      withEnv({ FAKE_LOG: log, FAKE_MODE: 'ok' }, () => withPath(bin, () => {
        const written = freshen(dir, { force: true });
        assert.strictEqual(written, 12, 'every changed file is re-extracted');
        const calls = logLines(log);
        assert.strictEqual(calls.length, 1, `expected one python3 process for 12 changed files, saw ${calls.length}`);
        assert.strictEqual(batchCalls(calls), 1);
      }));
    } finally { rm(dir); }
  });

  test('a non-Python file and a duplicate path are not sent to python3', () => {
    const dir = tmp('filter');
    try {
      const files = projectWith(2, dir);
      const other = path.join(dir, 'src', 'x.js');
      fs.writeFileSync(other, 'function x() {}\n');
      const bin = fakeBin(dir), log = path.join(dir, 'calls.log');
      withEnv({ FAKE_LOG: log, FAKE_MODE: 'ok' }, () => withPath(bin, () => {
        const py = freshPython();
        const s = py.prefetch([...files, files[0], other]);
        assert.strictEqual(s.requested, 2);
      }));
    } finally { rm(dir); }
  });
} else {
  skip('process-count and degradation tests', 'they use a POSIX fake python3');
}

// ── against the real interpreter ────────────────────────────────────────────

const SAMPLES = {
  'plain.py': 'class Service:\n    LIMIT = 10\n    def handle(self, request, timeout=30):\n        """Handle a request."""\n        return None\n\n    @classmethod\n    def build(cls, config):\n        return cls()\n\ndef top(a, b=helper(1, 2)):\n    pass\n',
  'dataclass.py': 'from dataclasses import dataclass\n\n@dataclass\nclass Point:\n    x: int\n    y: int = 0\n',
  'model.py': 'from pydantic import BaseModel\n\nclass Item(BaseModel):\n    name: str\n    price: float = 1.0\n',
  'routes.py': 'from fastapi import APIRouter\nrouter = APIRouter()\n\n@router.get("/items")\nasync def list_items(limit: int = 10) -> list:\n    return []\n',
  'unicode_é.py': '# ünïcödé\ndef größe(wert: int) -> int:\n    """Zählt."""\n    return wert\n',
  'bad syntax.py': 'def broken(:\n    pass\n',
  'empty.py': '',
  'latin1.py': Buffer.from('# caf\xe9\ndef f(a):\n    return a\n', 'latin1'),
  'nested.py': 'def outer():\n    def inner():\n        pass\n    return inner\n',
};

if (REAL) {
  test('--batch answers exactly what the single-file call answers, for every kind of file', () => {
    const dir = tmp('equiv');
    try {
      const files = [];
      for (const [name, body] of Object.entries(SAMPLES)) {
        const f = path.join(dir, name);
        fs.writeFileSync(f, body);
        files.push(f);
      }
      const script = require(PY_MODULE).resolvePythonAstScript();
      const single = (f) => {
        try {
          const sigs = JSON.parse(execFileSync('python3', [script, f], { encoding: 'utf8', timeout: 10000 }).trim());
          return Array.isArray(sigs) && sigs.length > 0 ? sigs : null;
        } catch (_) { return null; }
      };
      const py = freshPython();
      const s = py.prefetch(files);
      assert.strictEqual(s.degraded, 0);
      for (const f of files) {
        assert.deepStrictEqual(py.tryNativeExtract(f), single(f), `${path.basename(f)} differs between batch and single-file`);
      }
      assert.ok(py.tryNativeExtract(files.find((f) => f.endsWith('plain.py'))).some((x) => x.includes('def top(')), 'sanity: the AST answered');
    } finally { rm(dir); }
  });

  test('python_ast.py --batch: a version line, one line per path, and a bad file does not stall the rest', () => {
    const dir = tmp('proto');
    try {
      const good = path.join(dir, 'good.py'), bad = path.join(dir, 'bad.py'), after = path.join(dir, 'after.py');
      fs.writeFileSync(good, 'def good(a):\n    pass\n');
      fs.writeFileSync(bad, 'def broken(:\n');
      fs.writeFileSync(after, 'def after(b):\n    pass\n');
      const script = require(PY_MODULE).resolvePythonAstScript();
      const input = [good, bad, path.join(dir, 'missing.py'), after].map((p) => JSON.stringify(p)).join('\n') + '\nnot json\n';
      const r = spawnSync('python3', [script, '--batch'], { input, encoding: 'utf8', timeout: 20000 });
      assert.strictEqual(r.status, 0, r.stderr);
      const lines = r.stdout.split('\n').filter(Boolean).map((l) => JSON.parse(l));
      assert.ok(Array.isArray(lines[0].version) && lines[0].version.length === 3, 'first line carries the interpreter version');
      const byPath = Object.fromEntries(lines.slice(1).map((o) => [o.path, o.sigs]));
      assert.strictEqual(lines.length, 5, 'a version line and one line for each of the four real paths; the non-JSON line is skipped');
      assert.ok(byPath[good][0].startsWith('def good('));
      assert.deepStrictEqual(byPath[bad], []);
      assert.deepStrictEqual(byPath[path.join(dir, 'missing.py')], []);
      assert.ok(byPath[after][0].startsWith('def after('), 'the file after the bad ones is still answered');
    } finally { rm(dir); }
  });
} else {
  skip('batch vs single-file equivalence', 'no python3 on PATH');
  skip('python_ast.py --batch protocol', 'no python3 on PATH');
}

console.log(`\npython-batch-ast: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
