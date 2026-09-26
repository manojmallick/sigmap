'use strict';

/**
 * Mixin-composed and indented classes (ing-bank/lion).
 *
 * The class regex matched the heritage clause inline —
 * `class (\w+)(?:\s+extends\s+([\w.]+))?\s*\{` — which cannot match a CALL
 * expression. `extends Mixin(LitElement)`, the idiomatic Lit/web-component
 * composition, failed the extends branch, and because that branch was
 * optional the fallback needed `{` right after the name and failed too. The
 * result was not a missing `extends` annotation: the ENTIRE class was
 * dropped — no class line, no methods, nothing.
 *
 * On ing-bank/lion that was 111 of 326 classes (34%). `LionProgressIndicator`
 * extracted zero signatures despite being a plain, well-formed Lit component.
 *
 * The `^`-anchored regex also required the class at column 0, so an indented
 * class — which is how every mixin factory is written
 * (`superclass => class X extends superclass`) — was dropped as well.
 *
 * Both extractors now walk to the body brace instead of matching the heritage
 * inline, so any superclass expression works.
 */

const assert = require('assert');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const js = require(path.join(ROOT, 'src/extractors/javascript'));
const ts = require(path.join(ROOT, 'src/extractors/typescript'));

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  PASS  ${name}`); passed++; }
  catch (e) { console.log(`  FAIL  ${name}\n        ${e.message}`); failed++; }
}

const joined = (sigs) => sigs.join('\n');
function hasLine(sigs, substr) {
  assert.ok(sigs.some((s) => s.includes(substr)),
    `expected a signature containing "${substr}"\n--- got ---\n${joined(sigs)}`);
}

// ─────────────────────── the lion regression ───────────────────────

// Reduced from packages/ui/components/progress-indicator/src/LionProgressIndicator.js
const LION_COMPONENT = `/* eslint-disable import/no-extraneous-dependencies */
import { LitElement, nothing } from 'lit';
import { getLocalizeManager, LocalizeMixin } from '@lion/ui/localize-no-side-effects.js';

/**
 * @customElement lion-progress-indicator
 */
export class LionProgressIndicator extends LocalizeMixin(LitElement) {
  static get properties() {
    return { value: { type: Number } };
  }

  get indeterminate() {
    return this.value === undefined;
  }

  constructor() {
    super();
    this.value = 0;
  }

  render() {
    return nothing;
  }

  connectedCallback() {
    super.connectedCallback();
  }
}
`;

for (const [lang, extractor] of [['javascript', js], ['typescript', ts]]) {
  test(`${lang}: a mixin-composed Lit component is extracted at all`, () => {
    const sigs = extractor.extract(LION_COMPONENT);
    assert.ok(sigs.length > 0, 'the whole class was dropped — the lion regression');
    hasLine(sigs, 'class LionProgressIndicator');
  });

  test(`${lang}: the mixin composition is surfaced, not just the class name`, () => {
    // Which behaviours a component inherits is not recoverable from anywhere
    // else in the signature map.
    hasLine(extractor.extract(LION_COMPONENT), 'extends LocalizeMixin(LitElement)');
  });

  test(`${lang}: members of a mixin-composed class are extracted`, () => {
    const sigs = extractor.extract(LION_COMPONENT);
    // Plain methods, which both extractors handle.
    for (const member of ['constructor', 'render', 'connectedCallback']) {
      hasLine(sigs, member);
    }
    if (lang === 'javascript') {
      // Accessors too — `static get properties()` is how a JS Lit component
      // declares its reactive surface, so it is the interesting member.
      hasLine(sigs, 'properties');
      hasLine(sigs, 'indeterminate');
    }
  });

  test(`${lang}: a nested mixin chain resolves`, () => {
    const sigs = extractor.extract('export class Foo extends A(B(C(LitElement))) { m(a) { return a; } }');
    hasLine(sigs, 'class Foo extends A(B(C(LitElement)))');
    hasLine(sigs, 'm(a)');
  });

  test(`${lang}: an indented class is extracted`, () => {
    // The mixin-factory form puts the class on its own indented line.
    const sigs = extractor.extract('  class Foo extends Bar { m(a) { return a; } }');
    hasLine(sigs, 'class Foo');
    hasLine(sigs, 'm(a)');
  });

  test(`${lang}: the mixin-factory form is extracted`, () => {
    const src = [
      'const SlotMixinImplementation = superclass =>',
      '  // @ts-ignore a comment between the arrow and the class',
      '  class SlotMixin extends superclass {',
      '    get slots() { return {}; }',
      '    connectedCallback() { super.connectedCallback(); }',
      '  };',
      'export const SlotMixin = dedupeMixin(SlotMixinImplementation);',
    ].join('\n');
    const sigs = extractor.extract(src);
    hasLine(sigs, 'class SlotMixin');
    hasLine(sigs, 'connectedCallback');
    if (lang === 'javascript') hasLine(sigs, 'slots');
  });

  test(`${lang}: anchors on a mixin class point at the real lines`, () => {
    const sigs = extractor.extract(LION_COMPONENT);
    const cls = sigs.find((s) => s.includes('class LionProgressIndicator'));
    const m = /\s{2}:(\d+)-(\d+)$/.exec(cls);
    assert.ok(m, `class signature has no anchor: ${cls}`);
    const lines = LION_COMPONENT.split('\n');
    assert.match(lines[parseInt(m[1], 10) - 1], /class LionProgressIndicator/,
      `anchor start points at "${lines[parseInt(m[1], 10) - 1]}"`);
    assert.ok(parseInt(m[2], 10) > parseInt(m[1], 10), 'class span is not a real range');
  });

  test(`${lang}: a plain class stays byte-identical (no churn)`, () => {
    // Rendering `extends` unconditionally would rewrite every JS/TS repo's
    // output. Plain inheritance stays gated on component detection.
    const sigs = extractor.extract('class Foo extends Bar { m(a) { return a; } }');
    assert.ok(!joined(sigs).includes('extends Bar'),
      `plain inheritance leaked into output: ${joined(sigs)}`);
    hasLine(sigs, 'class Foo');
  });

  test(`${lang}: non-class text is not mistaken for a class`, () => {
    for (const src of ['const superclass = 1;', 'let classy = 2;', 'const x = "class Foo {";']) {
      const sigs = extractor.extract(src);
      assert.ok(!sigs.some((s) => /class (Foo|superclass|classy)/.test(s)),
        `false positive on: ${src} -> ${joined(sigs)}`);
    }
  });

  test(`${lang}: a malformed class cannot run away`, () => {
    // The body scan is bounded, so an unterminated heritage clause cannot
    // swallow the rest of the file or hang.
    const src = 'class Foo extends ' + 'A('.repeat(400) + '\n'
      + 'export function later(a) { return a; }\n';
    let sigs;
    assert.doesNotThrow(() => { sigs = extractor.extract(src); });
    assert.ok(Array.isArray(sigs));
    // Extraction continues past the malformed class rather than aborting.
    hasLine(sigs, 'later');
  });
}

// ─────────────────── TypeScript-specific shapes ────────────────────

test('typescript: accessors are part of the class surface', () => {
  // javascript.js had always treated `get`/`set` as modifiers; typescript.js
  // did not, so a TS class silently lost every accessor. Found while fixing
  // mixin extraction on a Lit codebase, where `static get properties()` IS
  // the reactive surface.
  const src = [
    'class A {',
    '  get g() { return 1; }',
    '  m(a: string) {}',
    '  static get p() { return 2; }',
    '  set v(x: number) {}',
    '}',
  ].join('\n');
  const sigs = ts.extract(src);
  hasLine(sigs, 'g()');
  hasLine(sigs, 'static p()');
  hasLine(sigs, 'v(x)');
  hasLine(sigs, 'm(a)');
});

test('javascript and typescript agree on a class surface', () => {
  // The two extractors diverging is how the accessor gap survived. This pins
  // the member NAMES as identical; rendering may still differ by language.
  const src = [
    'class A {',
    '  get g() { return 1; }',
    '  m(a) {}',
    '  static get p() { return 2; }',
    '}',
  ].join('\n');
  const names = (sigs) => sigs
    .filter((x) => x.startsWith('  '))
    .map((x) => (/([A-Za-z_$][\w$]*)\s*\(/.exec(x) || [])[1])
    .filter(Boolean).sort();
  assert.deepStrictEqual(names(js.extract(src)), names(ts.extract(src)),
    'the two extractors disagree about which members a class has');
});

test('typescript: generics on the class and superclass survive', () => {
  const sigs = ts.extract('export class Store<T> extends Base<T> { get(k: string): T { return k as any; } }');
  hasLine(sigs, 'class Store');
  hasLine(sigs, 'get(k)');
});

test('typescript: implements is dropped, extends is kept', () => {
  const sigs = ts.extract('export class Foo extends Mixin(Base) implements IThing, IOther { m(a: string) {} }');
  hasLine(sigs, 'extends Mixin(Base)');
  assert.ok(!joined(sigs).includes('implements'),
    `implements leaked into the signature: ${joined(sigs)}`);
});

test('typescript: abstract classes still render their modifier', () => {
  hasLine(ts.extract('export abstract class Foo extends Mixin(Base) { m(a: string) {} }'),
    'abstract class Foo');
});

test('extraction is deterministic', () => {
  assert.deepStrictEqual(js.extract(LION_COMPONENT), js.extract(LION_COMPONENT));
  assert.deepStrictEqual(ts.extract(LION_COMPONENT), ts.extract(LION_COMPONENT));
});

console.log('');
console.log(`mixin-class-extraction: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
