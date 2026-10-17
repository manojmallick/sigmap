'use strict';

/**
 * Integration tests for #801 — honour what the user said.
 *
 * Three commands silently discarded user input:
 *   #775  `ask --top <n>` was documented, parsed by `--query` and `evidence`,
 *         and ignored by `ask` (topK hardcoded to 5)
 *   #783  a pinned `maxTokens` was overridden by autoMaxTokens with the notice
 *         printed only under `--report` — and printed there even when nothing
 *         was pinned, calling SigMap's own default "your config"
 *   #776  `sigmap note` wrote to a store no part of the retrieval path read
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const SCRIPT = path.join(ROOT, 'gen-context.js');

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

/** Temp project with enough distinct files that --top can bite. */
function fixture(config) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-input-'));
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'gen-context.config.json'), JSON.stringify(config));
  for (let i = 1; i <= 8; i++) {
    fs.writeFileSync(path.join(dir, 'src', `mod${i}.js`),
      `function thing${i}(a, b) { return a + b; }\nfunction other${i}(x) { return x; }\n`);
  }
  spawnSync(process.execPath, [SCRIPT], { cwd: dir, encoding: 'utf8', timeout: 120000 });
  return dir;
}

function run(dir, args) {
  return spawnSync(process.execPath, [SCRIPT, ...args], {
    cwd: dir, encoding: 'utf8', timeout: 120000,
  });
}

/** File sections in the emitted query context (excludes the Notes heading). */
function contextFiles(dir) {
  const p = path.join(dir, '.context', 'query-context.md');
  const body = fs.readFileSync(p, 'utf8');
  return (body.match(/^## .+$/gm) || []).filter((h) => h !== '## Notes');
}

console.log('[honour-user-input.test.js] #775 --top · #783 pinned maxTokens · #776 notes (#801)');
console.log('');

// ── #775: --top is honoured ──────────────────────────────────────────────────

const askDir = fixture({ srcDirs: ['src'] });

test('#775 --top 2 and --top 20 produce different context', () => {
  run(askDir, ['ask', 'thing function', '--top', '2']);
  const two = contextFiles(askDir);
  run(askDir, ['ask', 'thing function', '--top', '7']);
  const seven = contextFiles(askDir);
  assert.strictEqual(two.length, 2, `--top 2 should select 2 files, got ${two.length}`);
  assert.strictEqual(seven.length, 7, `--top 7 should select 7 files, got ${seven.length}`);
  assert.notDeepStrictEqual(two, seven, '--top must change the emitted file set');
});

test('#775 omitting --top keeps the documented default of 5', () => {
  run(askDir, ['ask', 'thing function']);
  assert.strictEqual(contextFiles(askDir).length, 5, 'default topK should remain 5');
});

test('#775 an invalid --top errors instead of silently defaulting', () => {
  for (const bad of ['0', '-3', 'abc', '2.5']) {
    const r = run(askDir, ['ask', 'thing function', '--top', bad]);
    assert.strictEqual(r.status, 1, `--top ${bad} should exit 1, got ${r.status}`);
    assert.ok(/positive integer/.test(r.stderr), `--top ${bad} stderr: ${r.stderr}`);
  }
  const missing = run(askDir, ['ask', 'thing function', '--top']);
  assert.strictEqual(missing.status, 1, 'a missing --top value should exit 1');
});

test('#775 ask reports selected count, cutoff and a context hash', () => {
  // Default (#966): one summary line after the ranked files carries all three.
  const r = run(askDir, ['ask', 'thing function', '--top', '3']);
  assert.ok(/^3 of \d+ files · cutoff \d+\.\d{3} · [\d,]+ tokens · sha256:[0-9a-f]{12} → /m.test(r.stdout),
    `expected count, cutoff, tokens and hash on the summary line: ${r.stdout}`);
  // --verbose keeps the full box, which says where the cap came from.
  const v = run(askDir, ['ask', 'thing function', '--top', '3', '--verbose']);
  assert.ok(/Selected\s+: 3 of \d+ file\(s\) \(--top 3\)/.test(v.stdout), v.stdout);
  assert.ok(/cutoff score/.test(v.stdout), `expected a cutoff score: ${v.stdout}`);
  assert.ok(/Hash\s+: sha256:[0-9a-f]{12}/.test(v.stdout), `expected a context hash: ${v.stdout}`);
});

test('#775 the context hash is stable across identical runs', () => {
  const a = JSON.parse(run(askDir, ['ask', 'thing function', '--top', '3', '--json']).stdout.trim());
  const b = JSON.parse(run(askDir, ['ask', 'thing function', '--top', '3', '--json']).stdout.trim());
  assert.strictEqual(a.contextHash, b.contextHash, 'same query + repo must hash identically');
  assert.ok(/^sha256:[0-9a-f]{12}$/.test(a.contextHash), a.contextHash);
  assert.strictEqual(a.topK, 3);
  assert.strictEqual(a.selectedFiles, 3);
});

test('#775 a different --top yields a different hash', () => {
  const a = JSON.parse(run(askDir, ['ask', 'thing function', '--top', '2', '--json']).stdout.trim());
  const b = JSON.parse(run(askDir, ['ask', 'thing function', '--top', '6', '--json']).stdout.trim());
  assert.notStrictEqual(a.contextHash, b.contextHash, 'different selections must hash differently');
});

// ── #783: a pinned maxTokens announces itself ────────────────────────────────

test('#783 a pinned maxTokens warns on the DEFAULT run', () => {
  const dir = fixture({ srcDirs: ['src'], maxTokens: 500 });
  const r = run(dir, []);
  assert.ok(/autoMaxTokens is active/.test(r.stderr + r.stdout),
    `default run must warn: ${r.stderr}${r.stdout}`);
  assert.ok(/maxTokens:500/.test(r.stderr + r.stdout), 'warning must name the pinned value');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('#783 no warning when maxTokens is unset — including under --report', () => {
  const dir = fixture({ srcDirs: ['src'] });
  for (const args of [[], ['--report']]) {
    const r = run(dir, args);
    assert.ok(!/autoMaxTokens is active/.test(r.stderr + r.stdout),
      `must not claim a default as the user's config (args=${JSON.stringify(args)}): ${r.stderr}`);
  }
  fs.rmSync(dir, { recursive: true, force: true });
});

test('#783 autoMaxTokens:false respects the pinned value with no warning', () => {
  const dir = fixture({ srcDirs: ['src'], maxTokens: 500, autoMaxTokens: false });
  const r = run(dir, ['--report']);
  assert.ok(!/autoMaxTokens is active/.test(r.stderr + r.stdout), `must be silent: ${r.stderr}`);
  assert.ok(/500 \(fixed\)/.test(r.stdout), `pinned budget should be in force: ${r.stdout}`);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('#783 the warning prints exactly once under --report', () => {
  const dir = fixture({ srcDirs: ['src'], maxTokens: 500 });
  const r = run(dir, ['--report']);
  const hits = ((r.stderr + r.stdout).match(/autoMaxTokens is active/g) || []).length;
  assert.strictEqual(hits, 1, `expected exactly one notice, got ${hits}`);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('#783 loadConfig records which keys the project actually set', () => {
  const { loadConfig } = require(path.join(ROOT, 'src', 'config', 'loader'));
  const pinned = fixture({ srcDirs: ['src'], maxTokens: 500 });
  const plain = fixture({ srcDirs: ['src'] });
  assert.ok(loadConfig(pinned)._userKeys.includes('maxTokens'), 'pinned maxTokens must be recorded');
  assert.ok(!loadConfig(plain)._userKeys.includes('maxTokens'), 'an unset maxTokens must not be recorded');
  const bare = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-bare-'));
  assert.ok(Array.isArray(loadConfig(bare)._userKeys), 'a repo with no config still exposes _userKeys');
  fs.rmSync(bare, { recursive: true, force: true });
  fs.rmSync(pinned, { recursive: true, force: true });
  fs.rmSync(plain, { recursive: true, force: true });
});

// ── #776: notes reach retrieval ──────────────────────────────────────────────

const { selectRelevant, applyNoteBoost, pathsIn } = require(path.join(ROOT, 'src', 'session', 'note-relevance'));

test('#776 a relevant note changes the rank of the file it names', () => {
  const dir = fixture({ srcDirs: ['src'] });
  run(dir, ['ask', 'redaction logic for Slack tokens', '--top', '3']);
  const before = contextFiles(dir);
  assert.ok(!before.includes('## src/mod7.js'), `precondition: mod7 not selected, got ${before}`);

  run(dir, ['note', 'redaction logic for Slack tokens lives in src/mod7.js']);
  run(dir, ['ask', 'redaction logic for Slack tokens', '--top', '3']);
  const after = contextFiles(dir);
  assert.ok(after.includes('## src/mod7.js'), `the noted file must rise into the selection, got ${after}`);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('#776 matching notes appear in ask output and in the written context', () => {
  const dir = fixture({ srcDirs: ['src'] });
  run(dir, ['note', 'redaction logic for Slack tokens lives in src/mod7.js']);
  const r = run(dir, ['ask', 'redaction logic for Slack tokens', '--top', '3']);
  assert.ok(/notes: 1 matching/.test(r.stdout), `ask output must surface the note: ${r.stdout}`);
  const v = run(dir, ['ask', 'redaction logic for Slack tokens', '--top', '3', '--verbose']);
  assert.ok(/Notes\s+: 1 matching/.test(v.stdout), `--verbose keeps the Notes line: ${v.stdout}`);
  const body = fs.readFileSync(path.join(dir, '.context', 'query-context.md'), 'utf8');
  assert.ok(body.includes('## Notes'), 'context must carry a Notes section');
  assert.ok(body.includes('src/mod7.js'), 'context must carry the note text');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('#776 notes never leak into unrelated queries', () => {
  const dir = fixture({ srcDirs: ['src'] });
  run(dir, ['note', 'redaction logic for Slack tokens lives in src/mod7.js']);
  const r = run(dir, ['ask', 'graph builder traversal depth', '--top', '3']);
  assert.ok(!/Notes\s+:|notes: \d+ matching/.test(r.stdout), `unrelated query must not surface the note: ${r.stdout}`);
  const body = fs.readFileSync(path.join(dir, '.context', 'query-context.md'), 'utf8');
  assert.ok(!body.includes('## Notes'), 'unrelated context must carry no Notes section');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('#776 with no notes the emitted context is byte-identical to before', () => {
  const dir = fixture({ srcDirs: ['src'] });
  const a = JSON.parse(run(dir, ['ask', 'thing function', '--top', '4', '--json']).stdout.trim());
  assert.deepStrictEqual(a.notes, [], 'no notes means no notes payload');
  const first = fs.readFileSync(path.join(dir, '.context', 'query-context.md'), 'utf8')
    .replace(/^Generated:.*$/m, '');
  run(dir, ['ask', 'thing function', '--top', '4']);
  const second = fs.readFileSync(path.join(dir, '.context', 'query-context.md'), 'utf8')
    .replace(/^Generated:.*$/m, '');
  assert.strictEqual(first, second, 'a repo with no notes must be unaffected');
  assert.ok(!first.includes('## Notes'), 'no Notes section without notes');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('#776 relevance is gated, not unconditional', () => {
  const notes = [
    { text: 'redaction logic for Slack tokens lives in src/mod7.js', ts: '2026-09-30T10:00:00Z', branch: 'main' },
    { text: 'the CI pipeline runs on ubuntu-24.04 runners', ts: '2026-09-30T11:00:00Z', branch: 'main' },
  ];
  const hit = selectRelevant(notes, 'redaction logic for Slack tokens');
  assert.strictEqual(hit.length, 1, `expected 1 relevant note, got ${hit.length}`);
  assert.deepStrictEqual(hit[0].paths, ['src/mod7.js']);
  assert.strictEqual(selectRelevant(notes, 'quantum entanglement in Haskell').length, 0);
  assert.strictEqual(selectRelevant([], 'anything').length, 0);
  assert.strictEqual(selectRelevant(notes, '').length, 0);
});

test('#776 the boost is additive so it can lift a zero-scoring file', () => {
  const rel = selectRelevant(
    [{ text: 'logic lives in src/mod7.js', ts: '2026-09-30T10:00:00Z', branch: null }],
    'logic lives in src/mod7.js');
  const boosted = applyNoteBoost([{ file: 'src/mod1.js', score: 0 }, { file: 'src/mod7.js', score: 0 }], rel);
  assert.strictEqual(boosted[0].file, 'src/mod7.js', `a multiplier could not lift 0: ${JSON.stringify(boosted)}`);
  assert.ok(boosted[0].score > 0, 'the noted file must end up above its unboosted peers');
});

test('#776 the boost scales with the query top score, not a fixed constant', () => {
  const rel = selectRelevant(
    [{ text: 'logic lives in src/mod7.js', ts: '2026-09-30T10:00:00Z', branch: null }],
    'logic lives in src/mod7.js');
  const small = applyNoteBoost([{ file: 'a.js', score: 2 }, { file: 'src/mod7.js', score: 1 }], rel);
  const large = applyNoteBoost([{ file: 'a.js', score: 40 }, { file: 'src/mod7.js', score: 20 }], rel);
  const gainSmall = small.find((r) => r.file === 'src/mod7.js').score - 1;
  const gainLarge = large.find((r) => r.file === 'src/mod7.js').score - 20;
  assert.ok(gainLarge > gainSmall * 5, `boost must scale with score range: ${gainSmall} vs ${gainLarge}`);
});

test('#776 applyNoteBoost does not mutate its input', () => {
  const rel = selectRelevant(
    [{ text: 'logic lives in src/mod7.js', ts: '2026-09-30T10:00:00Z', branch: null }],
    'logic lives in src/mod7.js');
  const input = [{ file: 'src/mod7.js', score: 5 }];
  applyNoteBoost(input, rel);
  assert.strictEqual(input[0].score, 5, 'the caller-supplied array must be untouched');
});

test('#776 pathsIn extracts repo paths and ignores prose', () => {
  assert.deepStrictEqual(pathsIn('see src/security/patterns.js and src/a/b.ts'),
    ['src/security/patterns.js', 'src/a/b.ts']);
  assert.deepStrictEqual(pathsIn('no paths here at all'), []);
});

// Cleanup
try { fs.rmSync(askDir, { recursive: true, force: true }); } catch (_) {}

console.log('');
console.log(`${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
