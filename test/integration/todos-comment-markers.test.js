'use strict';

/**
 * #877 — the todos extractor matched `## todos` inside a string literal:
 * case-insensitive, no word boundary, unmasked.
 * Run: node test/integration/todos-comment-markers.test.js
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync, spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const { extractTodos } = require(path.join(ROOT, 'src/extractors/todos.js'));
const { maskStrings, maskCode, stripComments } = require(path.join(ROOT, 'src/extractors/scan.js'));

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); console.log(`  PASS  ${name}`); pass++; }
  catch (e) { console.log(`  FAIL  ${name}\n        ${e.message}`); fail++; }
}

const src = (...lines) => lines.join('\n');
const texts = (list) => JSON.stringify(list.map((t) => `${t.tag}:${t.text}`));

// ── maskStrings: the surface the extractor now reads ────────────────────────

test('maskStrings blanks string contents, keeps comments and offsets intact', () => {
  const input = src(
    "const heading = '## todos';",
    'f("# TODO: in a string"); // TODO: in a comment',
    'g(`# FIXME: in a template`) /* HACK: in a block comment */',
  );
  const out = maskStrings(input);
  assert.strictEqual(out.length, input.length, 'length must be preserved');
  assert.strictEqual((out.match(/\n/g) || []).length, (input.match(/\n/g) || []).length, 'newlines must be preserved');
  assert.ok(!out.includes('## todos'), 'string literal content survived masking');
  assert.ok(!out.includes('# TODO: in a string'), 'quoted marker survived masking');
  assert.ok(!out.includes('# FIXME: in a template'), 'template literal content survived masking');
  assert.ok(out.includes('// TODO: in a comment'), 'line comment was masked away');
  assert.ok(out.includes('/* HACK: in a block comment */'), 'block comment was masked away');
});

test('maskCode and stripComments keep blanking comments (scan default unchanged)', () => {
  const input = 'f("# TODO: string"); // TODO: comment';
  assert.ok(!maskCode(input).includes('TODO: comment'), 'maskCode no longer blanks comments');
  assert.ok(!stripComments(input).includes('TODO: comment'), 'stripComments no longer blanks comments');
});

// ── the reported false positives ────────────────────────────────────────────

test('markers inside string literals produce no entries', () => {
  const input = src(
    "lines.push('## todos');",
    "const s = '# todo list';",
    'const t = `# FIXME: template`;',
    'const u = "# HACK: double quoted";',
  );
  assert.deepStrictEqual(extractTodos(input), [], `string literals extracted: ${texts(extractTodos(input))}`);
});

test('case-insensitive matching is gone: no word boundary, no lowercase prose', () => {
  const input = src(
    '// Todoist client',
    '#hackathon',
    '# todos are cached here',
    '// todo list of things',
    '#FIXMEs are tracked elsewhere',
  );
  assert.deepStrictEqual(extractTodos(input), [], `prose matched: ${texts(extractTodos(input))}`);
});

// ── the markers that must survive ───────────────────────────────────────────

test('genuine comment markers are still extracted', () => {
  const input = src(
    '// TODO: real marker',
    '# FIXME(y): z',
    '/* HACK */',
    '# todo: lowercase shorthand',
    ' * @param x // XXX: third',
  );
  const got = extractTodos(input).map((t) => [t.line, t.tag, t.text]);
  assert.deepStrictEqual(got, [
    [1, 'TODO', 'real marker'],
    [2, 'FIXME', '(y): z'],
    [3, 'HACK', ''],
    [4, 'TODO', 'lowercase shorthand'],
    [5, 'XXX', 'third'],
  ], `unexpected entries: ${JSON.stringify(got)}`);
});

test('a marker with no message is ignored, and `*/` is never the message', () => {
  const bare = src('// TODO', '# FIXME:', '// TODO: b');
  assert.deepStrictEqual(extractTodos(bare).map((t) => t.text), ['b'],
    `message-less markers extracted: ${texts(extractTodos(bare))}`);
  const inline = src('/* TODO: remove the shim */ const x = 1;');
  assert.deepStrictEqual(extractTodos(inline).map((t) => t.text), ['remove the shim'],
    `block terminator leaked into the message: ${texts(extractTodos(inline))}`);
});

test('an apostrophe or a backtick in the message does not truncate it', () => {
  const input = src(
    "# HACK: the user's name is not escaped",
    '// TODO: call `get_lines` instead',
  );
  assert.deepStrictEqual(extractTodos(input).map((t) => t.text), [
    "the user's name is not escaped",
    'call `get_lines` instead',
  ], `message corrupted: ${texts(extractTodos(input))}`);
});

test('known bound: a bare continuation line of a block comment is not a marker', () => {
  // Every match needs its opener on the same line, so the JSDoc `* TODO:` form
  // stays invisible — unchanged by this fix, pinned so the limit stays visible.
  const input = src('/*', ' * TODO: finish this', ' */');
  assert.deepStrictEqual(extractTodos(input), [], `unexpected entries: ${texts(extractTodos(input))}`);
});

// ── the issue's own acceptance case: SigMap's generated `## todos` section ──

test('SigMap-generated `## todos` section keeps string literals out', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-877-'));
  try {
    execSync('git init -b main', { cwd: dir, stdio: 'ignore' });
    fs.mkdirSync(path.join(dir, 'src'));
    fs.writeFileSync(path.join(dir, 'src', 'gen.js'), src(
      "'use strict';",
      'function pushHeadings(lines) {',
      "  lines.push('## todos');",
      '  return lines;',
      '}',
      '// TODO: wire the caller',
      'module.exports = { pushHeadings };',
      '',
    ));

    const r = spawnSync('node', [path.join(ROOT, 'gen-context.js')], { cwd: dir, encoding: 'utf8' });
    assert.strictEqual(r.status, 0, r.stderr || 'gen-context.js failed');

    const context = fs.readFileSync(path.join(dir, '.github', 'copilot-instructions.md'), 'utf8');
    const start = context.indexOf('## todos');
    assert.ok(start !== -1, 'no todos section in the generated context');
    const end = context.indexOf('\n## ', start + 3);
    const section = context.slice(start, end === -1 ? context.length : end);
    assert.ok(section.includes('# TODO: wire the caller'), `genuine marker missing:\n${section}`);
    assert.ok(!section.includes("s');"), `string literal leaked into the section:\n${section}`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

console.log(`\ntodos comment markers (#877):`);
console.log(`  ${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
