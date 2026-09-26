'use strict';

/**
 * The two Python tiers must agree on conventions.
 *
 * `python.js` has two extraction tiers: a native CPython AST pass
 * (`python_ast.py`, used when `python3` is on PATH and a real file path is
 * available) and a regex fallback. v8.51.2 made the AST tier actually fire in
 * production for the first time (#693) — and immediately exposed that the two
 * disagreed: the regex tier filtered the implicit `self`/`cls` receiver
 * (python.js:263) and the AST tier emitted it. 233 of flask's 235 methods
 * carried it, for no information, costing ~3% of Python signature bytes and
 * making the same file extract differently depending on whether python3 was
 * installed.
 *
 * That is the same class of bug as the TS/JS accessor asymmetry closed in
 * v8.51.1: two code paths for one language, silently diverging because
 * nothing compared them. This compares them.
 *
 * The tiers are NOT expected to be byte-identical — the AST tier carries type
 * annotations and return types the regex tier cannot see, which is the whole
 * reason it exists. What is pinned here is the shared CONVENTIONS: which
 * symbols appear, and how parameters are presented.
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const py = require(path.join(ROOT, 'src/extractors/python'));

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  PASS  ${name}`); passed++; }
  catch (e) { console.log(`  FAIL  ${name}\n        ${e.message}`); failed++; }
}

/** True when python3 is available, so the AST tier can actually run. */
function hasPython3() {
  try {
    require('child_process').execFileSync('python3', ['--version'], { stdio: 'ignore', timeout: 5000 });
    return true;
  } catch (_) { return false; }
}

const PY3 = hasPython3();

/** Extract the same source through both tiers. */
function bothTiers(src) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-pytier-'));
  try {
    const file = path.join(dir, 'mod.py');
    fs.writeFileSync(file, src, 'utf8');
    return { ast: py.extract(src, file), regex: py.extract(src) };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

const SAMPLE = `class Service:
    def handle(self, request, timeout=30):
        """Handle a request."""
        return None

    @classmethod
    def build(cls, config):
        return cls()

    @staticmethod
    def helper(value):
        return value

def top_level(alpha, beta=1):
    """Top level function."""
    return alpha
`;

test('neither tier emits the implicit self/cls receiver', () => {
  const { ast, regex } = bothTiers(SAMPLE);
  for (const [tier, sigs] of [['regex', regex], ['ast', ast]]) {
    if (tier === 'ast' && !PY3) continue;
    const leaked = sigs.filter((s) => /\((self|cls)\b/.test(s));
    assert.deepStrictEqual(leaked, [],
      `${tier} tier emitted a receiver: ${leaked.join(' | ')}`);
  }
});

test('a staticmethod keeps its first parameter', () => {
  // The receiver is dropped by POSITION AND NAME, so a static method — which
  // has no receiver — must not lose its real first argument.
  const { ast, regex } = bothTiers(SAMPLE);
  for (const [tier, sigs] of [['regex', regex], ['ast', ast]]) {
    if (tier === 'ast' && !PY3) continue;
    const helper = sigs.find((s) => s.includes('helper'));
    assert.ok(helper && helper.includes('value'),
      `${tier} tier lost a staticmethod's first parameter: ${helper}`);
  }
});

test('a top-level function keeps every parameter', () => {
  const { ast, regex } = bothTiers(SAMPLE);
  for (const [tier, sigs] of [['regex', regex], ['ast', ast]]) {
    if (tier === 'ast' && !PY3) continue;
    const fn = sigs.find((s) => s.includes('top_level'));
    assert.ok(fn && fn.includes('alpha'), `${tier} tier lost a parameter: ${fn}`);
  }
});

test('a parameter genuinely named self outside position 0 survives', () => {
  // Dropping it would be wrong. Pathological, but the receiver rule must be
  // positional, not a blanket name filter.
  const src = 'def odd(a, self):\n    return a\n';
  const { ast } = bothTiers(src);
  if (!PY3) return;
  const fn = ast.find((s) => s.includes('odd'));
  assert.ok(fn && fn.includes('self'),
    `a non-receiver parameter named self was dropped: ${fn}`);
});

test('both tiers surface the same symbol names', () => {
  if (!PY3) { console.log('        (python3 absent — AST tier unavailable, comparison skipped)'); return; }
  const { ast, regex } = bothTiers(SAMPLE);
  const names = (sigs) => [...new Set(
    sigs.map((s) => (/(?:def|class)\s+([A-Za-z_]\w*)/.exec(s) || [])[1]).filter(Boolean),
  )].sort();
  assert.deepStrictEqual(names(ast), names(regex),
    'the tiers disagree about which symbols a file contains');
});

test('the AST tier is richer, not merely different', () => {
  // It exists to carry type annotations the regex tier cannot see. If it ever
  // stops doing that, the token cost documented in benchmark.md buys nothing.
  if (!PY3) { console.log('        (python3 absent — AST tier unavailable, skipped)'); return; }
  const src = 'def typed(a: str, b: int = 3) -> bool:\n    """Doc."""\n    return True\n';
  const { ast } = bothTiers(src);
  const fn = ast.find((s) => s.includes('typed'));
  assert.ok(/a: str/.test(fn), `AST tier lost its type annotations: ${fn}`);
  assert.ok(/→ bool/.test(fn), `AST tier lost its return type: ${fn}`);
});

test('defaults stay aligned after the receiver is dropped', () => {
  // Defaults are right-aligned against the parameter list, so removing the
  // receiver without care would shift them onto the wrong parameters.
  if (!PY3) { console.log('        (python3 absent — skipped)'); return; }
  const src = 'class C:\n    def m(self, a, b=1, c=2):\n        return a\n';
  const { ast } = bothTiers(src);
  const m = ast.find((s) => s.includes('def m'));
  assert.ok(/\ba\b(?!=)/.test(m), `a wrongly gained a default: ${m}`);
  assert.ok(/b=/.test(m) && /c=/.test(m), `b/c lost their defaults: ${m}`);
});

console.log('');
console.log(`python-tier-parity: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
