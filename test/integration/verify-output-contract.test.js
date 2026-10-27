'use strict';

/**
 * #998 — `sigmap verify` is the command meant for CI and pipelines, and two of
 * its basic contracts failed.
 *
 *   1. `--json` was cut at 64 KB when stdout was a pipe: the write was
 *      asynchronous and `process.exit()` discarded what was still queued.
 *      `review-pr` and the other one-shot printers ended the same way.
 *   2. `verify <directory>` threw a raw EISDIR stack trace, and every misuse
 *      exited 1 — the code that means "issues found".
 *
 * Exit codes for `verify`: 0 clean, 1 issues found, 2 usage error.
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn, spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const SCRIPT = path.join(ROOT, 'gen-context.js');
const PIPE_LIMIT = 65536;

let passed = 0;
let failed = 0;
const pending = [];

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

function testAsync(name, fn) {
  pending.push(fn().then(
    () => { console.log(`  PASS  ${name}`); passed++; },
    (err) => { console.error(`  FAIL  ${name}`); console.error(`        ${err.message}`); failed++; }
  ));
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-verify-contract-'));

/** The same command twice: stdout into a pipe, and stdout redirected to a file. */
function pipeAndFile(args, cwd) {
  const piped = spawnSync('node', [SCRIPT, ...args], {
    cwd, stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 256 * 1024 * 1024,
  });
  const outFile = path.join(tmp, `out-${Math.random().toString(36).slice(2)}.txt`);
  const fd = fs.openSync(outFile, 'w');
  const redirected = spawnSync('node', [SCRIPT, ...args], { cwd, stdio: ['ignore', fd, 'ignore'] });
  fs.closeSync(fd);
  return { piped, redirected, fileBytes: fs.readFileSync(outFile) };
}

// ---------------------------------------------------------------------------
// 1. A large --json document reaches a pipe whole
// ---------------------------------------------------------------------------
const repo = path.join(tmp, 'repo');
fs.mkdirSync(path.join(repo, 'src'), { recursive: true });
fs.writeFileSync(path.join(repo, 'src', 'util.js'), 'function summarize(a) { return a; }\nmodule.exports = { summarize };\n');

const bigAnswer = path.join(tmp, 'answer-big.md');
{
  let s = '';
  for (let i = 0; i < 3000; i++) s += `See \`src/missing/file${i}.ts\` and \`src/gone/other${i}.js\`.\n`;
  fs.writeFileSync(bigAnswer, s);
}

test('verify --json: piped output equals the file-redirected output byte for byte (> 1 MB)', () => {
  const { piped, redirected, fileBytes } = pipeAndFile(['verify', bigAnswer, '--json', '--cwd', repo], ROOT);
  assert.ok(fileBytes.length > 1000000, `fixture must exceed 1 MB, got ${fileBytes.length}`);
  assert.strictEqual(piped.stdout.length, fileBytes.length, `piped ${piped.stdout.length} bytes, redirected ${fileBytes.length}`);
  assert.ok(piped.stdout.equals(fileBytes), 'piped bytes differ from redirected bytes');
  assert.strictEqual(piped.status, redirected.status);
  const doc = JSON.parse(piped.stdout.toString('utf8').split('\n').filter((l) => l.startsWith('{'))[0]);
  assert.ok(doc.summary.total >= 6000, 'the whole document parses and carries every issue');
});

// ---------------------------------------------------------------------------
// 2. review-pr output above 64 KB reaches a pipe whole
// ---------------------------------------------------------------------------
function git(cwd, ...args) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
  assert.strictEqual(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`);
}

const prRepo = path.join(tmp, 'pr');
fs.mkdirSync(path.join(prRepo, 'src'), { recursive: true });
fs.writeFileSync(path.join(prRepo, 'src', 'a.js'), 'module.exports = 1;\n');
git(prRepo, 'init', '-q', '-b', 'main');
git(prRepo, 'config', 'user.email', 't@example.com');
git(prRepo, 'config', 'user.name', 't');
git(prRepo, 'add', '-A');
git(prRepo, 'commit', '-qm', 'base');
git(prRepo, 'checkout', '-qb', 'feat');
for (let i = 0; i < 450; i++) {
  const d = path.join(prRepo, 'src', `pkg${i % 30}`);
  fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(d, `module${i}.js`), `function f${i}() { return ${i}; }\nmodule.exports = { f${i} };\n`);
}
git(prRepo, 'add', '-A');
git(prRepo, 'commit', '-qm', 'many files');

test('review-pr --markdown: piped output equals the file-redirected output byte for byte (> 64 KB)', () => {
  const { piped, redirected, fileBytes } = pipeAndFile(['review-pr', '--markdown', '--base', 'main', '--cwd', prRepo], ROOT);
  assert.ok(fileBytes.length > PIPE_LIMIT, `fixture must exceed 64 KB, got ${fileBytes.length}`);
  assert.strictEqual(piped.stdout.length, fileBytes.length, `piped ${piped.stdout.length} bytes, redirected ${fileBytes.length}`);
  assert.ok(piped.stdout.equals(fileBytes));
  assert.strictEqual(piped.status, redirected.status);
});

test('review-pr --json: piped output is the whole document', () => {
  const { piped, fileBytes } = pipeAndFile(['review-pr', '--json', '--base', 'main', '--cwd', prRepo], ROOT);
  assert.ok(fileBytes.length > PIPE_LIMIT, `fixture must exceed 64 KB, got ${fileBytes.length}`);
  assert.ok(piped.stdout.equals(fileBytes));
  JSON.parse(piped.stdout.toString('utf8').split('\n').filter((l) => l.startsWith('{'))[0]);
});

// ---------------------------------------------------------------------------
// 3. A reader that closes early is not a crash
// ---------------------------------------------------------------------------
testAsync('verify --json: a reader that closes early (`| head`) leaves no stack trace', () => new Promise((resolve, reject) => {
  const child = spawn('node', [SCRIPT, 'verify', bigAnswer, '--json', '--cwd', repo], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
  let err = '';
  child.stderr.on('data', (c) => { err += c; });
  child.stdout.once('data', () => child.stdout.destroy());
  child.on('close', (code, signal) => {
    try {
      assert.ok(!signal, `killed by ${signal}`);
      assert.ok(!/EPIPE|Error:|\n\s+at /.test(err), `stderr must be clean, got:\n${err.slice(0, 400)}`);
      resolve();
    } catch (e) { reject(e); }
  });
}));

// ---------------------------------------------------------------------------
// 4. A bad path is a usage error, never a stack trace
// ---------------------------------------------------------------------------
function usageError(args) {
  const res = spawnSync('node', [SCRIPT, ...args], { cwd: ROOT, encoding: 'utf8' });
  assert.strictEqual(res.status, 2, `expected exit 2, got ${res.status}\n${res.stdout}${res.stderr}`);
  assert.ok(/Usage: sigmap verify/.test(res.stderr), `expected the usage line, got:\n${res.stderr}`);
  assert.ok(!/EISDIR|ENOENT|\n\s+at /.test(res.stderr), `no stack trace:\n${res.stderr}`);
  return res;
}

test('verify <directory>: usage line, exit 2, no EISDIR stack trace', () => {
  const res = usageError(['verify', path.join(repo, 'src'), '--cwd', repo]);
  assert.ok(/not a file/.test(res.stderr), res.stderr);
});

test('verify <missing>: usage line and exit 2', () => {
  const res = usageError(['verify', path.join(tmp, 'nope.md'), '--cwd', repo]);
  assert.ok(/file not found/.test(res.stderr), res.stderr);
});

test('verify with no argument: usage line and exit 2', () => {
  usageError(['verify', '--cwd', repo]);
});

test('verify-ai-output <directory>: the long name behaves the same', () => {
  usageError(['verify-ai-output', path.join(repo, 'src'), '--cwd', repo]);
});

test('exit 1 still means "issues found", exit 0 still means clean', () => {
  fs.writeFileSync(path.join(tmp, 'clean.md'), 'Nothing here names a file.\n');
  const clean = spawnSync('node', [SCRIPT, 'verify', path.join(tmp, 'clean.md'), '--cwd', repo], { cwd: ROOT, encoding: 'utf8' });
  assert.strictEqual(clean.status, 0, clean.stdout + clean.stderr);
  const dirty = spawnSync('node', [SCRIPT, 'verify', bigAnswer, '--cwd', repo], { cwd: ROOT, encoding: 'utf8' });
  assert.strictEqual(dirty.status, 1);
});

// ---------------------------------------------------------------------------
// 5. The shape of the bug cannot come back
// ---------------------------------------------------------------------------
test('CLI core never ends a run on a bare process.stdout.write (use writeAll)', () => {
  const lines = fs.readFileSync(SCRIPT, 'utf8').split('\n');
  const core = lines.slice(lines.findIndex((l) => l.includes('END SIGMAP BUNDLED MODULES')) + 1);
  const bare = [];
  core.forEach((l, i) => {
    if (!/process\.stdout\.write\(/.test(l)) return;
    if (/^\s*\/\//.test(l)) return; // a comment
    if (/=> process\.exit/.test(l)) return; // flushes first: the exit runs in the write callback
    bare.push(`${i + 1}: ${l.trim().slice(0, 100)}`);
  });
  assert.ok(bare.length === 0, `${bare.length} bare process.stdout.write call(s) return before a pipe has drained; use writeAll(1, text). First few:\n${bare.slice(0, 5).join('\n')}`);
  assert.ok(core.some((l) => /^function writeAll\(fd, text\)/.test(l)), 'writeAll is defined in the CLI core');
});

Promise.all(pending).then(() => {
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) {}
  console.log(`\nverify-output-contract: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
});
