'use strict';

/**
 * One canonical CLI vocabulary (#848, closes #817).
 *
 * `--help` was a 113-line template literal maintained by hand next to the
 * `KNOWN_COMMANDS` set the dispatcher guards on — two copies of one fact, with
 * nothing failing when they diverged. #661 found twelve shipped commands help
 * never mentioned; #775 found a flag help advertised that the command ignored.
 *
 * `src/cli/command-table.js` is now the only source. These guards fail when it
 * and the dispatch chain disagree in EITHER direction, and when a flag the
 * table advertises under a command is not read by that command.
 *
 * Run: node test/integration/command-table.test.js
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const GEN = path.join(ROOT, 'gen-context.js');
const TABLE = require(path.join(ROOT, 'src', 'cli', 'command-table'));
const { listAdapters } = require(path.join(ROOT, 'packages', 'adapters', 'index'));

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); console.log(`  PASS  ${name}`); pass++; }
  catch (e) { console.log(`  FAIL  ${name}\n        ${e.message}`); fail++; }
}

const source = fs.readFileSync(GEN, 'utf8');

/** The CLI core — the hand-written tail after the bundled-modules section. */
const CLI = source.slice(source.indexOf('// ═══ END SIGMAP BUNDLED MODULES ═══'));

/**
 * Source region per dispatched subcommand: from its `args[0] === '<name>'`
 * test to the next one. Alias chains (`'verify-ai-output' || 'verify'`) map
 * every alias onto the same region.
 */
function dispatchRegions() {
  const re = /if \(args\[0\] === '([a-z][a-z-]*)'((?:\s*\|\|\s*args\[0\] === '[a-z][a-z-]*')*)/g;
  const marks = [...CLI.matchAll(re)];
  const out = new Map();
  marks.forEach((m, i) => {
    const to = i + 1 < marks.length ? marks[i + 1].index : CLI.length;
    const body = CLI.slice(m.index, to);
    const names = [m[1], ...[...(m[2] || '').matchAll(/'([a-z][a-z-]*)'/g)].map((x) => x[1])];
    for (const n of names) out.set(n, (out.get(n) || '') + body);
  });
  return out;
}

const REGIONS = dispatchRegions();
const DISPATCHED = [...REGIONS.keys()].sort();
const helpText = execFileSync(process.execPath, [GEN, '--help'], { encoding: 'utf8' });

console.log('[command-table.test.js] one canonical CLI vocabulary (#848)');
console.log('');
console.log(`  ${TABLE.USAGE.length} usage rows · ${TABLE.commandNames().length} bare subcommands · ${DISPATCHED.length} dispatched`);
console.log('');

// ── the table and the dispatch chain agree, in both directions ──────────────

test('every dispatched subcommand is in the table', () => {
  assert.ok(DISPATCHED.length >= 30, `expected a real dispatch chain, got ${DISPATCHED.length}`);
  const vocab = new Set([...TABLE.commandNames(), ...TABLE.flagGated().map(([n]) => n)]);
  const missing = DISPATCHED.filter((c) => !vocab.has(c));
  assert.deepStrictEqual(missing, [],
    `these dispatch but no USAGE row documents them: ${missing.join(', ')}`);
});

test('the table invents no command the dispatcher cannot handle', () => {
  const dispatched = new Set(DISPATCHED);
  const phantom = [...TABLE.commandNames(), ...TABLE.flagGated().map(([n]) => n)]
    .filter((c) => !dispatched.has(c));
  assert.deepStrictEqual(phantom, [],
    `the table advertises these but nothing dispatches them: ${phantom.join(', ')}`);
});

test('a flag-gated command is not accepted bare', () => {
  for (const [name, flag] of TABLE.flagGated()) {
    assert.ok(!TABLE.commandNames().includes(name),
      `${name} needs ${flag}; listing it as a bare command would let it through the guard`);
  }
});

// ── --help is rendered, not a second copy ───────────────────────────────────

test('--help is rendered from the table, not a literal in gen-context.js', () => {
  const start = source.indexOf('function printHelp(cmd) {');
  assert.ok(start !== -1, 'printHelp not found');
  const body = source.slice(start, source.indexOf('\n}\n', start));
  assert.ok(/renderHelp\(/.test(body), 'printHelp must call the table renderer');
  // The defect was a parallel usage list living here. One or two lines may
  // mention a flag in prose; a dozen means the literal is back.
  const usageish = (body.match(/^\s+\$\{cmd\}/gm) || []).length;
  assert.strictEqual(usageish, 0,
    `printHelp carries ${usageish} of its own usage lines — the table is no longer the only source`);
});

test('--help output matches the renderer exactly', () => {
  const version = require(path.join(ROOT, 'package.json')).version;
  const expected = TABLE.renderHelp({ cmd: 'gen-context', version, adapters: listAdapters() });
  assert.strictEqual(helpText.trimEnd(), expected.trimEnd(),
    '--help and renderHelp disagree — something is post-processing the help body');
});

test('every table command appears as a usage line in --help', () => {
  const names = [...TABLE.commandNames(), ...TABLE.flagGated().map(([n]) => n)];
  const missing = names.filter((c) => {
    const esc = c.replace(/-/g, '\\-');
    return !new RegExp(`^\\s+\\S+\\s+${esc}(\\s|$)`, 'm').test(helpText);
  });
  assert.deepStrictEqual(missing, [], `absent from --help: ${missing.join(', ')}`);
});

// ── every advertised flag is actually read (#775) ───────────────────────────

test('every flag advertised under a command is read by that command', () => {
  const broken = [];
  for (const name of TABLE.commandNames().concat(TABLE.flagGated().map(([n]) => n))) {
    const region = REGIONS.get(name);
    if (!region) continue;                     // covered by the agreement tests above
    for (const flag of TABLE.flagsFor(name)) {
      if (!region.includes(`'${flag}'`) && !region.includes(`"${flag}"`)) {
        broken.push(`${name} ${flag}`);
      }
    }
  }
  assert.deepStrictEqual(broken, [],
    `--help advertises these but the command never reads them: ${broken.join(', ')}`);
});

test('every global flag --help advertises is read somewhere in the shipped source', () => {
  // Global flags may be honoured by a src/ module rather than the dispatch
  // chain — `--no-track` is read in src/tracking/logger.js.
  const shipped = CLI + fs.readFileSync(path.join(ROOT, 'src', 'tracking', 'logger.js'), 'utf8');
  // A bare-run alias is read by nothing — it falls through to the default
  // generate — and is proved by running it, in the next test (#918).
  const broken = TABLE.flagsFor(null)
    .filter((f) => !TABLE.BARE_RUN_ALIASES.includes(f))
    .filter((f) => !shipped.includes(`'${f}'`));
  assert.deepStrictEqual(broken, [],
    `advertised but never read: ${broken.join(', ')}`);
});

test('every bare-run alias is advertised, and running it is the same run as a bare one', () => {
  const { spawnSync } = require('child_process');
  const os = require('os');
  const generate = (args) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bare-alias-'));
    try {
      fs.mkdirSync(path.join(dir, 'src'));
      fs.writeFileSync(path.join(dir, 'src', 'a.js'), 'function a() { return 1; }\nmodule.exports = { a };\n');
      fs.writeFileSync(path.join(dir, 'gen-context.config.json'), JSON.stringify({ srcDirs: ['src'] }));
      const r = spawnSync(process.execPath, [GEN, ...args], { cwd: dir, encoding: 'utf8' });
      const out = path.join(dir, '.github', 'copilot-instructions.md');
      return { status: r.status, out: fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : null };
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  };
  // The only moving part in the output is the timestamp stamp line.
  const stable = (s) => s.replace(/Updated: \S+/g, 'Updated: <t>').replace(/Generated: \S+/g, 'Generated: <t>');
  const bare = generate([]);
  assert.strictEqual(bare.status, 0);
  assert.ok(bare.out && bare.out.includes('function a'), 'a bare run must generate');
  assert.ok(TABLE.BARE_RUN_ALIASES.length >= 1);
  for (const flag of TABLE.BARE_RUN_ALIASES) {
    assert.ok(TABLE.flagsFor(null).includes(flag), `${flag} is a bare-run alias but --help does not advertise it`);
    const aliased = generate([flag]);
    assert.strictEqual(aliased.status, 0, flag);
    assert.strictEqual(stable(aliased.out), stable(bare.out), `${flag} is not the same run as a bare one`);
  }
});

// ── the derived lists stay derived ──────────────────────────────────────────

test('KNOWN_COMMANDS and FLAG_GATED_COMMANDS derive from the table', () => {
  assert.ok(/const KNOWN_COMMANDS = new Set\(CLI_TABLE\.commandNames\(\)\)/.test(source),
    'KNOWN_COMMANDS must come from the table, not a literal set');
  assert.ok(/const FLAG_GATED_COMMANDS = new Map\(CLI_TABLE\.flagGated\(\)\)/.test(source),
    'FLAG_GATED_COMMANDS must come from the table, not a literal map');
});

test('the guard still rejects a typo and suggests the nearest table command', () => {
  // The guard's vocabulary now comes from the table, so a broken derivation
  // would either reject everything or wave a typo through onto the generate
  // path — which is the write-without-asking defect #655 closed.
  const run = (...argv) => {
    try { return execFileSync(process.execPath, [GEN, ...argv], { encoding: 'utf8', stdio: 'pipe' }); }
    catch (e) { return (e.stdout || '') + (e.stderr || ''); }
  };
  const out = run('askk');
  assert.match(out, /unknown command 'askk'/, 'a typo must still be rejected before anything is written');
  assert.match(out, /Did you mean 'ask'\?/, 'the suggestion must come from the table vocabulary');
  for (const [name, flag] of TABLE.flagGated()) {
    assert.match(run(name), new RegExp(`'${name}' requires \\${flag}`),
      `${name} is flag-gated in the table but the guard does not say so`);
  }
});

test('the adapter line is derived, not a literal', () => {
  const line = helpText.split('\n').find((l) => l.startsWith('Adapters (v3.0+):'));
  assert.ok(line, 'help must name the adapters');
  for (const a of listAdapters()) {
    assert.ok(line.includes(a),
      `packages/adapters/ ships "${a}" but --help omits it — the literal it replaced was a release behind`);
  }
});

test('llms.txt carries every command --help advertises', () => {
  const llms = fs.readFileSync(path.join(ROOT, 'llms-full.txt'), 'utf8');
  const missing = TABLE.commandNames().filter((c) => !llms.includes(`sigmap ${c}`));
  assert.deepStrictEqual(missing, [],
    `llms-full.txt is generated from --help but lacks: ${missing.join(', ')} — run npm run generate:llms`);
});

test('the help lines keep the shape generate-llms.mjs filters on', () => {
  // scripts/generate-llms.mjs keeps only /^\s+(sigmap|gen-context)\b/ lines.
  const kept = helpText.split('\n').filter((l) => /^\s+(sigmap|gen-context)\b/.test(l));
  assert.strictEqual(kept.length, TABLE.USAGE.length,
    `llms.txt would capture ${kept.length} of ${TABLE.USAGE.length} usage rows`);
});

// ── the drifts the table made visible stay fixed ────────────────────────────

test('no escaped %% survives into the rendered help', () => {
  assert.ok(!helpText.includes('%%'),
    'the template literal carried a printf escape it never needed; renderHelp must not reintroduce it');
});

test('every usage line aligns its description to one column', () => {
  const offenders = [];
  for (const row of TABLE.USAGE) {
    const line = TABLE.usageLine('sigmap', row);
    const left = row.argv ? ` ${row.argv}` : '';
    const gap = line.slice('  sigmap'.length + left.length).match(/^ */)[0].length;
    const atColumn = left.length + gap === TABLE.DESC_COL;
    if (!atColumn && gap !== 2) offenders.push(row.argv || '(bare)');
  }
  assert.deepStrictEqual(offenders, [],
    `these descriptions sit at an ad-hoc column: ${offenders.join(' | ')}`);
});

console.log('');
console.log(`  command-table: ${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
