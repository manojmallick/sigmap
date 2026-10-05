'use strict';

/**
 * #879 — `sigmap ask` printed a 12-line metadata table (intent, context size,
 * cutoff, hash, selection, coverage, risk, cost, footnote) and no ranked files
 * at all on stdout; the answer was only in `.context/query-context.md`.
 *
 * The default output must now lead with the ranked file blocks and end with at
 * most two metadata lines (a one-line summary, plus Risk only when the files
 * this query selected are themselves changed). `--verbose` restores the full
 * table; `--json` is unchanged.
 *
 * Run: node test/integration/ask-verbose.test.js
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
// SIGMAP_CLI lets this suite be pointed at another revision of the CLI, which
// is how the pre-fix failure is demonstrated.
const GEN_CONTEXT = process.env.SIGMAP_CLI || path.join(ROOT, 'gen-context.js');
const BAR = '─'.repeat(44);

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); console.log(`  PASS  ${name}`); pass++; }
  catch (e) { console.log(`  FAIL  ${name}\n        ${e.message}`); fail++; }
}

function git(cwd, args) {
  return execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...args], { cwd, encoding: 'utf8' });
}

/** Two-file source repo with a committed HEAD, plus a generated context file. */
function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-ask879-'));
  fs.mkdirSync(path.join(dir, 'src'));
  fs.writeFileSync(path.join(dir, 'src', 'db.js'),
    'function connectDatabase(url) { return url; }\nmodule.exports = { connectDatabase };\n');
  fs.writeFileSync(path.join(dir, 'src', 'widget.js'),
    'function loadWidget(el) { return el; }\nmodule.exports = { loadWidget };\n');
  git(dir, ['init', '-q']);
  git(dir, ['add', '-A']);
  git(dir, ['commit', '-qm', 'init']);
  execFileSync(process.execPath, [GEN_CONTEXT], { cwd: dir, encoding: 'utf8' });
  return dir;
}

function ask(dir, args) {
  return execFileSync(process.execPath, [GEN_CONTEXT, 'ask', ...args], {
    cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
  });
}

const rm = (dir) => fs.rmSync(dir, { recursive: true, force: true });

console.log('\n#879 — ask leads with ranked files\n');

console.log('  -- pre-fix failure (run with SIGMAP_CLI=<HEAD copy>) --');

test('default ask: stdout carried a header table and no ranked files', () => {
  const dir = fixture();
  const out = ask(dir, ['connect database']);
  // This is the assertion that fails on the pre-fix CLI: the first line was the
  // header rule, not a `## <file>` block, and the selected signature never
  // reached stdout.
  assert.ok(!out.startsWith(BAR), `stdout still opens with the metadata rule:\n${out}`);
  assert.ok(!out.includes('Cost      :'), `stdout still carries the cost line:\n${out}`);
  rm(dir);
});

console.log('  -- post-fix behaviour --');

test('default ask: ranked blocks first, then one summary line', () => {
  const dir = fixture();
  const out = ask(dir, ['connect database']);
  const lines = out.split('\n');
  assert.ok(lines[0].startsWith('## '), `first line is not a ranked block: ${JSON.stringify(lines[0])}\n${out}`);
  assert.ok(lines[0].includes('db.js'), `top-ranked file missing: ${lines[0]}`);
  assert.ok(out.includes('connectDatabase'), `anchored signature missing from stdout:\n${out}`);
  const summary = out.trimEnd().split('\n').pop();
  assert.ok(/^\d+ of \d+ files · [\d,]+ tokens · sha256:[0-9a-f]{12}$/.test(summary),
    `summary line malformed: ${JSON.stringify(summary)}`);
  rm(dir);
});

test('default ask: cost, coverage and risk header lines are gone', () => {
  const dir = fixture();
  const out = ask(dir, ['connect database']);
  for (const label of ['Intent    :', 'Context   :', 'Selected  :', 'Hash      :',
    'Selection :', 'Coverage  :', 'Risk      :', 'Cost      :']) {
    assert.ok(!out.includes(label), `default output still contains "${label}":\n${out}`);
  }
  assert.ok(!out.includes(BAR), 'default output still contains the header rule');
  // at most two metadata lines: the summary, plus Risk only when actionable
  const meta = out.trimEnd().split('\n').filter((l) => !l.startsWith('## ') && !l.startsWith('```')
    && l.trim() !== '' && !/^\S.*:\d+-\d+$/.test(l));
  assert.ok(meta.length <= 2, `expected <= 2 metadata lines, got ${meta.length}:\n${meta.join('\n')}`);
  rm(dir);
});

test('--verbose: the full metadata table is back', () => {
  const dir = fixture();
  const out = ask(dir, ['connect database', '--verbose']);
  for (const label of ['Intent    :', 'Context   :', 'Selected  :', 'Hash      :',
    'Selection :', 'Coverage  :', 'Risk      :', 'Cost      :']) {
    assert.ok(out.includes(label), `--verbose is missing "${label}":\n${out}`);
  }
  assert.ok(out.includes(BAR), '--verbose is missing the header rule');
  assert.ok(out.includes('## src/db.js'), `--verbose dropped the ranked blocks:\n${out}`);
  rm(dir);
});

test('--json is unchanged (rankedFiles + contextHash still emitted)', () => {
  const dir = fixture();
  const out = ask(dir, ['connect database', '--json']);
  const parsed = JSON.parse(out);
  assert.ok(Array.isArray(parsed.rankedFiles) && parsed.rankedFiles.length > 0, JSON.stringify(parsed));
  assert.ok(parsed.rankedFiles[0].file.includes('db.js'), JSON.stringify(parsed.rankedFiles[0]));
  assert.ok(typeof parsed.contextHash === 'string' && parsed.contextHash.startsWith('sha256:'), parsed.contextHash);
  assert.ok(typeof parsed.riskLevel === 'string', parsed.riskLevel);
  rm(dir);
});

test('Risk is shown only when a selected file itself changed', () => {
  const dir = fixture();
  // an unrelated file changing is not a property of this answer
  fs.appendFileSync(path.join(dir, 'src', 'widget.js'), '// touch\n');
  const unrelated = ask(dir, ['connect database']);
  assert.ok(!unrelated.includes('Risk'), `unrelated dirty file produced a Risk line:\n${unrelated}`);
  // the file this query actually selected changing is worth a line
  fs.appendFileSync(path.join(dir, 'src', 'db.js'), '// touch\n');
  const relevant = ask(dir, ['connect database']);
  const riskLine = relevant.trimEnd().split('\n').find((l) => l.startsWith('Risk'));
  assert.ok(riskLine, `no Risk line for a changed selected file:\n${relevant}`);
  assert.ok(riskLine.includes('db.js'), `Risk line does not name the selected file: ${riskLine}`);
  rm(dir);
});

console.log(`\n#879 — ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
