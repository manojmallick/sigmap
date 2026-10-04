'use strict';

/**
 * Managed-section lookup (#873) — src/util/managed-section.js and every writer
 * and reader of the "## Auto-generated signatures" marker.
 *
 * The defect: writers located their block with `existing.indexOf(marker)` — the
 * FIRST occurrence anywhere — and discarded everything after it, so a file that
 * merely quoted the marker lost every human line that followed the quote.
 *
 * Run: node test/integration/managed-section.test.js
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const GEN = path.join(ROOT, 'gen-context.js');
const ms = require(path.join(ROOT, 'src/util/managed-section.js'));
const { injectSkillsBlock } = require(path.join(ROOT, 'src/skills/skills.js'));
const { inContextFiles } = require(path.join(ROOT, 'src/analysis/coverage-score.js'));

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); console.log(`  PASS  ${name}`); pass++; }
  catch (e) { console.log(`  FAIL  ${name}\n        ${e.message}`); fail++; }
}

const HEADING = ms.HEADING;
const STAMP = ms.STAMP;
const mkdtemp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-managed-'));
const rm = (d) => fs.rmSync(d, { recursive: true, force: true });
/** Wall-clock stamps legitimately differ between runs; nothing else may. */
const norm = (s) => s.replace(/<!-- Updated: [^>]+ -->/g, '<!-- Updated: T -->');
const count = (s, needle) => s.split(needle).length - 1;

const CONTEXT = '## src\n\n### src/a.js\n```\nfunction a()  :1-1\n```\n';

// The four adapters that own a human-editable file, with where they write.
const ADAPTERS = [
  { name: 'claude', file: 'CLAUDE.md' },
  { name: 'copilot', file: path.join('.github', 'copilot-instructions.md') },
  { name: 'gemini', file: path.join('.github', 'gemini-context.md') },
  { name: 'codex', file: 'AGENTS.md' },
];

function runAdapter(adapter, dir, existing) {
  const file = path.join(dir, adapter.file);
  if (existing !== undefined) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, existing, 'utf8');
  }
  const mod = require(path.join(ROOT, 'packages', 'adapters', adapter.name + '.js'));
  mod.write(CONTEXT, dir, { version: '9.9.9' });
  return fs.readFileSync(file, 'utf8');
}

// ── The helper ───────────────────────────────────────────────────────────────

test('an inline mention in prose is not the marker', () => {
  const t = `Intro.\nSee the \`${HEADING}\` section below.\nMore human text.\n`;
  assert.strictEqual(ms.findManagedSection(t), null);
});

test('a fenced mention — even the full two-line marker — is not the marker', () => {
  const t = `Notes\n\`\`\`md\n${HEADING}\n${STAMP}\n\`\`\`\nHuman tail\n`;
  assert.strictEqual(ms.findManagedSection(t), null);
});

test('a ~~~ fence is a fence too', () => {
  const t = `Notes\n~~~\n${HEADING}\n${STAMP}\n~~~\nHuman tail\n`;
  assert.strictEqual(ms.findManagedSection(t), null);
});

test('the LAST stamped heading wins — the generated block is appended after every human line', () => {
  const t = `Human\n\n${HEADING}\n${STAMP}\n# Code signatures\nOLD1\n\nmore human?\n${HEADING}\n${STAMP}\n# Code signatures\nOLD2\n`;
  const at = ms.findManagedSection(t);
  assert.ok(at.stamped);
  assert.ok(t.slice(at.index).includes('OLD2') && !t.slice(at.index).includes('OLD1'));
});

test('CRLF files are matched', () => {
  const t = `Human\r\n\r\n${HEADING}\r\n${STAMP}\r\n# Code signatures\r\nOLD\r\n`;
  const r = ms.replaceManagedSection(t, '# Code signatures\nNEW\n');
  assert.strictEqual(r.action, 'replaced');
  assert.ok(r.content.startsWith('Human\r\n\r\n'));
  assert.ok(!r.content.includes('OLD'));
});

test('an unterminated fence is not a fence: the real marker below it is still found', () => {
  const t = `Doc\n\`\`\`js\nnever closed\n\n${HEADING}\n${STAMP}\n# Code signatures\nOLD\n`;
  const r = ms.replaceManagedSection(t, '# Code signatures\nNEW\n');
  assert.strictEqual(r.action, 'replaced', 'a stray ``` must not hide the marker (it would append a block every run)');
});

test('a bare heading is replaced only when a SigMap block follows it', () => {
  const generated = ms.replaceManagedSection(`Human\n\n${HEADING}\n# Code signatures\nOLD\n`, '# Code signatures\nNEW\n');
  assert.strictEqual(generated.action, 'replaced');
  const prose = `Human\n\n${HEADING}\nThis section explains what we generate.\nKeep me.\n`;
  const r = ms.replaceManagedSection(prose, '# Code signatures\nNEW\n');
  assert.strictEqual(r.action, 'appended');
  assert.ok(r.content.startsWith(prose), 'human section must be untouched');
  assert.match(r.warning, /not a SigMap-generated block/);
});

test('replaceManagedSection never returns less human content than it was given', () => {
  const human = 'A\n\n```\n' + HEADING + '\n```\nB\nC';
  for (const legacy of [false, true]) {
    const r = ms.replaceManagedSection(human, '# Code signatures\nX\n', { legacy });
    assert.ok(r.content.startsWith(human), `legacy=${legacy}`);
  }
});

test('a pre-marker generated file is replaced whole only when it is ENTIRELY generated', () => {
  const whole = '<!-- Generated by SigMap gen-context.js v1 -->\n# Code signatures\nOLD\n';
  assert.strictEqual(ms.replaceManagedSection(whole, 'NEW\n', { legacy: true }).action, 'legacy');
  const human = 'My notes. They mention # Code signatures and "## Code Signatures" in passing.\n';
  const r = ms.replaceManagedSection(human, 'NEW\n', { legacy: true });
  assert.strictEqual(r.action, 'appended');
  assert.ok(r.content.startsWith(human), 'a substring is not a generated file');
});

// ── Every adapter, same contract ─────────────────────────────────────────────

for (const adapter of ADAPTERS) {
  const quote = {
    inline: `Intro.\nSee the \`${HEADING}\` section below.\n\nHuman line AFTER the mention.\nAnother human line.\n`,
    fenced: `Notes.\n\n\`\`\`javascript\n// 2. Find the marker: "${HEADING}"\n\`\`\`\n\nHuman line AFTER the fence.\n`,
    fencedBlock: `Format docs.\n\n\`\`\`md\n${HEADING}\n${STAMP}\n\`\`\`\n\nHuman line AFTER the example.\n`,
  };

  for (const [kind, human] of Object.entries(quote)) {
    test(`${adapter.name}: a ${kind} mention never truncates; human text above and below is byte-preserved and a re-run is idempotent`, () => {
      const dir = mkdtemp();
      try {
        const run1 = runAdapter(adapter, dir, human);
        assert.ok(run1.startsWith(human) || adapter.name === 'claude',
          'the human content must come through unchanged');
        assert.ok(run1.includes(human.trimEnd()), 'every human line must survive');
        assert.strictEqual(count(run1, `${HEADING}\n${STAMP}`), 1 + count(human, `${HEADING}\n${STAMP}`),
          'exactly one managed section is added');
        const run2 = runAdapter(adapter, dir);
        assert.strictEqual(norm(run2), norm(run1), 're-running must be byte-stable');
        assert.ok(run2.includes(human.trimEnd()), 'human content survives the second run too');
      } finally { rm(dir); }
    });
  }

  test(`${adapter.name}: a file with a real marker still updates in place`, () => {
    const dir = mkdtemp();
    try {
      const human = `# Project\n\nHuman notes.\n`;
      const old = `${human}\n${HEADING}\n${STAMP}\n# Code signatures\nSTALE-BODY\n`;
      const out = runAdapter(adapter, dir, old);
      assert.ok(out.includes('Human notes.'));
      assert.ok(!out.includes('STALE-BODY'), 'the old generated body is replaced');
      assert.strictEqual(count(out, `${HEADING}\n${STAMP}`), 1);
    } finally { rm(dir); }
  });

  test(`${adapter.name}: a legacy file with a bare marker still updates in place`, () => {
    const dir = mkdtemp();
    try {
      const old = `# Project\n\nHuman notes.\n\n${HEADING}\n# Code signatures\nSTALE-BODY\n`;
      const out = runAdapter(adapter, dir, old);
      assert.ok(out.includes('Human notes.'));
      assert.ok(!out.includes('STALE-BODY'));
    } finally { rm(dir); }
  });

  test(`${adapter.name}: a human section titled like the marker is kept, with a warning`, () => {
    const dir = mkdtemp();
    const warned = [];
    const orig = console.warn;
    console.warn = (...a) => warned.push(a.join(' '));
    try {
      const human = `# Project\n\n${HEADING}\nThis is OUR section about generated signatures.\nKeep me.\n`;
      const out = runAdapter(adapter, dir, human);
      assert.ok(out.includes('Keep me.') && out.includes('OUR section'));
      assert.ok(warned.some((w) => /not a SigMap-generated block/.test(w)), `expected a warning, got ${JSON.stringify(warned)}`);
    } finally { console.warn = orig; rm(dir); }
  });

  test(`${adapter.name}: its own output is recognised on the next run (no block is ever appended twice)`, () => {
    const dir = mkdtemp();
    try {
      runAdapter(adapter, dir, '# Mine\n');
      runAdapter(adapter, dir);
      const out = runAdapter(adapter, dir);
      assert.strictEqual(count(out, `${HEADING}\n${STAMP}`), 1);
    } finally { rm(dir); }
  });
}

test('claude: the allowlist block goes above the real section, not into a prose mention', () => {
  const dir = mkdtemp();
  try {
    const human = `Intro.\nSee the \`${HEADING}\` section below.\nHuman AFTER.\n`;
    const out = runAdapter(ADAPTERS[0], dir, human);
    assert.ok(out.includes(human.trimEnd()), 'the human text must be contiguous — nothing injected into it');
    assert.ok(out.indexOf('<!-- sigmap-bash-allowlist -->') > out.indexOf('Human AFTER.'));
    assert.ok(out.indexOf('<!-- sigmap-bash-allowlist -->') < out.indexOf(`${HEADING}\n${STAMP}`));
  } finally { rm(dir); }
});

test('copilot / gemini / codex: a human file that merely mentions "Code signatures" is not replaced whole', () => {
  for (const a of ADAPTERS.filter((x) => x.name !== 'claude')) {
    const dir = mkdtemp();
    try {
      const human = 'Our team notes.\n\nWe call the output "# Code signatures" and "## Code Signatures".\n';
      const out = runAdapter(a, dir, human);
      assert.ok(out.startsWith(human), `${a.name}: human file replaced`);
    } finally { rm(dir); }
  }
});

// ── The CLI core writer (the path `outputs: ["claude"]` takes) ───────────────

function runCli(dir) {
  execFileSync(process.execPath, [GEN], { cwd: dir, stdio: 'ignore' });
}
function cliRepo(claudeMd) {
  const dir = mkdtemp();
  fs.mkdirSync(path.join(dir, 'src'));
  fs.writeFileSync(path.join(dir, 'src', 'app.js'), 'function startServer(port) { return port; }\nmodule.exports = { startServer };\n');
  fs.writeFileSync(path.join(dir, 'gen-context.config.json'), JSON.stringify({ outputs: ['claude'], srcDirs: ['src'] }));
  if (claudeMd !== undefined) fs.writeFileSync(path.join(dir, 'CLAUDE.md'), claudeMd);
  return dir;
}

test('CLI core: a CLAUDE.md that quotes the marker in a code block keeps every human line, across runs', () => {
  const human = [
    '# Rules', '', 'When writing to `CLAUDE.md`, never overwrite human-written content:', '',
    '```javascript', '// Strategy:', `// 2. Find the marker: "${HEADING}"`, '```', '',
    '## SigMap commands', '', 'Run `sigmap ask` first.', '', 'Final human line.', '',
  ].join('\n');
  const dir = cliRepo(human);
  try {
    runCli(dir);
    const run1 = fs.readFileSync(path.join(dir, 'CLAUDE.md'), 'utf8');
    assert.ok(run1.startsWith(human), 'everything after the quote must survive — this is the bug');
    runCli(dir);
    const run2 = fs.readFileSync(path.join(dir, 'CLAUDE.md'), 'utf8');
    assert.ok(run2.startsWith(human));
    assert.strictEqual(count(run2, `${HEADING}\n${STAMP}`), 1);
    assert.strictEqual(norm(run2).replace(/\n<!-- Updated: T -->/g, ''), norm(run1).replace(/\n<!-- Updated: T -->/g, ''));
  } finally { rm(dir); }
});

test('CLI core: a file already truncated by the old bug is repaired in place and converges', () => {
  // The heading glued onto the prose line that quoted it, inside a fence the
  // truncation never closed — this repository's own CLAUDE.md, byte for byte.
  const damaged = [
    '# Rules', '', '```javascript', '// Strategy:', `// 2. Find the marker: "${HEADING}`,
    STAMP, '# Code signatures', '', '## src', '', '### src/old.js', '```', 'function old()  :1-1', '```', '',
  ].join('\n');
  const dir = cliRepo(damaged);
  try {
    runCli(dir);
    const a = fs.readFileSync(path.join(dir, 'CLAUDE.md'), 'utf8');
    runCli(dir);
    const b = fs.readFileSync(path.join(dir, 'CLAUDE.md'), 'utf8');
    runCli(dir);
    const c = fs.readFileSync(path.join(dir, 'CLAUDE.md'), 'utf8');
    assert.ok(a.startsWith(`# Rules\n\n\`\`\`javascript\n// Strategy:\n// 2. Find the marker: "`), 'the prose prefix is kept');
    assert.ok(!a.includes('old.js'), 'the stale body is replaced');
    assert.strictEqual(count(a, STAMP), 1, 'one managed section, not two');
    assert.strictEqual(count(c, STAMP), 1, 'and still one after more runs — no growth');
    assert.ok(Math.abs(c.length - b.length) < 64, `size must be stable (${b.length} → ${c.length})`);
  } finally { rm(dir); }
});

test('CLI core: every default adapter output survives a quoted marker', () => {
  const human = `# Notes\n\nThe marker is \`${HEADING}\`.\n\nHuman line after.\n`;
  const dir = mkdtemp();
  try {
    fs.mkdirSync(path.join(dir, 'src'));
    fs.mkdirSync(path.join(dir, '.github'));
    fs.writeFileSync(path.join(dir, 'src', 'app.js'), 'function startServer(port) { return port; }\nmodule.exports = { startServer };\n');
    fs.writeFileSync(path.join(dir, 'gen-context.config.json'),
      JSON.stringify({ outputs: ['claude', 'copilot', 'gemini', 'codex'], srcDirs: ['src'] }));
    const files = ['CLAUDE.md', path.join('.github', 'copilot-instructions.md'), path.join('.github', 'gemini-context.md'), 'AGENTS.md'];
    for (const f of files) fs.writeFileSync(path.join(dir, f), human);
    runCli(dir);
    runCli(dir);
    for (const f of files) {
      const out = fs.readFileSync(path.join(dir, f), 'utf8');
      assert.ok(out.startsWith(human), `${f}: human content lost`);
      assert.strictEqual(count(out, `${HEADING}\n${STAMP}`), 1, `${f}: expected exactly one managed section`);
    }
  } finally { rm(dir); }
});

// ── Readers and the skills injector ──────────────────────────────────────────

test('coverage-score reader: human `###` lines before the real section are not counted as indexed files', () => {
  const dir = mkdtemp();
  try {
    fs.writeFileSync(path.join(dir, 'CLAUDE.md'), [
      `See \`${HEADING}\` below.`, '### human/heading.md', 'prose', '',
      HEADING, STAMP, '# Code signatures', '', '### src/real.js', '```', 'function r()  :1-1', '```', '',
    ].join('\n'));
    const got = inContextFiles(dir).map((x) => path.relative(dir, x.filePath || x));
    assert.deepStrictEqual(got.sort(), ['src/real.js']);
  } finally { rm(dir); }
});

test('skills injection: the block lands above the real section, never inside a prose line', () => {
  const human = `Intro with \`${HEADING}\` quoted inline.\nHuman AFTER the mention.\n\n${HEADING}\n${STAMP}\n# Code signatures\nBODY\n`;
  const out = injectSkillsBlock(human, '<!-- sigmap-skills:start -->\nBLOCK\n<!-- sigmap-skills:end -->');
  assert.ok(out.startsWith('Intro with `' + HEADING + '` quoted inline.\nHuman AFTER the mention.\n'),
    'the prose lines are contiguous and unmodified');
  assert.ok(out.indexOf('BLOCK') < out.indexOf(`${HEADING}\n${STAMP}`));
  assert.ok(out.indexOf('BLOCK') > out.indexOf('Human AFTER the mention.'));
});

// ── One helper, no copies ────────────────────────────────────────────────────

test('no writer or reader keeps its own first-occurrence marker lookup', () => {
  const files = [
    'packages/adapters/claude.js', 'packages/adapters/copilot.js', 'packages/adapters/gemini.js',
    'packages/adapters/codex.js', 'src/skills/skills.js', 'src/retrieval/ranker.js', 'src/analysis/coverage-score.js',
  ];
  for (const f of files) {
    const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
    assert.ok(!/indexOf\(\s*['"]## Auto-generated signatures['"]\s*\)/.test(src), `${f} still searches for the marker itself`);
    assert.ok(!/const MARKER = /.test(src), `${f} keeps its own copy of MARKER`);
    assert.ok(/util\/managed-section/.test(src), `${f} does not use the shared helper`);
  }
  const core = fs.readFileSync(GEN, 'utf8');
  const tail = core.slice(core.indexOf('// ═══ END SIGMAP BUNDLED MODULES ═══'));
  assert.ok(!/indexOf\(\s*['"]## Auto-generated signatures['"]\s*\)/.test(tail), 'the CLI core writer still searches for the marker itself');
  assert.ok(/managed-section/.test(tail), 'the CLI core writer does not use the shared helper');
});

console.log(`\nmanaged-section: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
