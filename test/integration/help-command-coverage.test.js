'use strict';

/**
 * Docs-sync guard for the CLI surface (#661).
 *
 * Twelve shipped commands were missing from `--help` because the dispatch chain
 * and the help block are maintained by hand, independently. This test derives
 * the command vocabulary from the DISPATCH CHAIN ITSELF — not from a list a
 * human keeps in sync — and fails when help, the guard vocabulary, or the CLI
 * docs fall behind it.
 *
 * Tests:
 *  1.  every dispatched subcommand appears in --help
 *  2.  every dispatched subcommand is known to the unknown-command guard (#655)
 *  3.  the guard vocabulary invents no command the dispatcher cannot handle
 *  4.  docs-vp/guide/cli.md mentions every dispatched subcommand
 *  5.  no doc advertises the bogus `sigmap impact <file>` form
 */

const assert = require('assert');
const fs     = require('fs');
const path   = require('path');
const { spawnSync } = require('child_process');

const ROOT   = path.resolve(__dirname, '../..');
const SCRIPT = path.join(ROOT, 'gen-context.js');
const CLI_MD = path.join(ROOT, 'docs-vp', 'guide', 'cli.md');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  PASS  ${name}`);
    passed++;
  } catch (err) {
    console.log(`  FAIL  ${name}: ${err.message}`);
    failed++;
  }
}

const source = fs.readFileSync(SCRIPT, 'utf8');

/** Every bare word the dispatch chain compares `args[0]` against. */
function dispatchedCommands() {
  const out = new Set();
  const re = /args\[0\] === '([a-z][a-z-]*)'/g;
  let m;
  while ((m = re.exec(source)) !== null) out.add(m[1]);
  return [...out].sort();
}

/** The vocabulary the unknown-command guard accepts (KNOWN + flag-gated). */
function guardVocabulary() {
  const known = source.match(/const KNOWN_COMMANDS = new Set\(\[([\s\S]*?)\]\);/);
  assert.ok(known, 'KNOWN_COMMANDS declaration not found in gen-context.js');
  const gated = source.match(/const FLAG_GATED_COMMANDS = new Map\(\[([\s\S]*?)\]\);/);
  assert.ok(gated, 'FLAG_GATED_COMMANDS declaration not found in gen-context.js');

  const words = new Set();
  for (const m of known[1].matchAll(/'([a-z][a-z-]*)'/g)) words.add(m[1]);
  for (const m of gated[1].matchAll(/\['([a-z][a-z-]*)'/g)) words.add(m[1]);
  return words;
}

const COMMANDS = dispatchedCommands();
const helpText = spawnSync(process.execPath, [SCRIPT, '--help'], { encoding: 'utf8' }).stdout || '';

/** A help line documenting `cmd` — `  sigmap <cmd> …`, not a mention in prose. */
function hasHelpLine(cmd) {
  const escaped = cmd.replace(/-/g, '\\-');
  return new RegExp(`^\\s+\\S+\\s+${escaped}(\\s|$)`, 'm').test(helpText);
}

console.log('[help-command-coverage.test.js] CLI docs-sync guard (#661)');
console.log('');
console.log(`  ${COMMANDS.length} dispatched subcommands found in gen-context.js`);
console.log('');

test('every dispatched subcommand appears in --help', () => {
  assert.ok(COMMANDS.length >= 30, `expected a real vocabulary, got ${COMMANDS.length}`);
  const missing = COMMANDS.filter((c) => !hasHelpLine(c));
  assert.deepStrictEqual(missing, [],
    `these commands dispatch but are absent from --help: ${missing.join(', ')}`);
});

test('every dispatched subcommand is known to the unknown-command guard', () => {
  const vocab = guardVocabulary();
  const unguarded = COMMANDS.filter((c) => !vocab.has(c));
  assert.deepStrictEqual(unguarded, [],
    `these commands dispatch but the C1 guard would reject them: ${unguarded.join(', ')}`);
});

test('the guard vocabulary invents no command the dispatcher cannot handle', () => {
  const dispatched = new Set(COMMANDS);
  const phantom = [...guardVocabulary()].filter((c) => !dispatched.has(c));
  assert.deepStrictEqual(phantom, [],
    `these are accepted by the guard but never dispatch: ${phantom.join(', ')}`);
});

test('docs-vp/guide/cli.md mentions every dispatched subcommand', () => {
  const doc = fs.readFileSync(CLI_MD, 'utf8');
  const missing = COMMANDS.filter((c) => !new RegExp(`sigmap ${c.replace(/-/g, '\\-')}(\\s|\`|$)`, 'm').test(doc));
  assert.deepStrictEqual(missing, [],
    `these commands dispatch but cli.md never shows them: ${missing.join(', ')}`);
});

test('no doc advertises the bogus `sigmap impact <file>` form', () => {
  const doc = fs.readFileSync(CLI_MD, 'utf8');
  assert.doesNotMatch(doc, /sigmap impact\s/, 'the real form is `sigmap --impact <file>`');
  assert.doesNotMatch(helpText, /sigmap impact\s/, 'the real form is `sigmap --impact <file>`');
});

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------
console.log('');
console.log(`${passed} passed, ${failed} failed`);

if (failed > 0) process.exit(1);
