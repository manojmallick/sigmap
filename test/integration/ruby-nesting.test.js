'use strict';

/**
 * Regression tests for #981 — the Ruby extractor finds classes and modules at any
 * indentation and lists every `def` under the innermost class or module that
 * owns it. A class is listed by the name the source gives it (`class BadRequest`),
 * as the Python and Java extractors do: the symbol lookups downstream read the
 * name after `class`, so a qualified `A::B` would be found as `A`.
 *
 * Before the fix only column-0 `class`/`module` lines were read, so in the usual
 * layout (classes inside a module) 86% of classes and 56% of modules were dropped
 * and every method was listed with no owner. Measured against Ruby's own parser
 * on 757 Rails and Sidekiq files: class 13.8%, module 44.0%, method 82.7%.
 *
 * Each case below gets a fixture that fails against the pre-fix extractor.
 * Run: node test/integration/ruby-nesting.test.js
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const { spawnSync } = require('child_process');
const { extract } = require('../../src/extractors/ruby');

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  PASS  ${name}`); passed++; }
  catch (e) { console.log(`  FAIL  ${name}\n        ${e.message}`); failed++; }
}
const out = (src) => extract(src);
const same = (src, expected) => assert.deepStrictEqual(out(src), expected);

// ── owners ─────────────────────────────────────────────────────────────────

test('classes inside a module are found, with their methods under them', () => {
  same(`module ActionController
  class ActionControllerError < StandardError
  end

  class BadRequest < ActionControllerError
    def initialize(msg = nil)
      super(msg)
    end
  end
end
`, [
    'module ActionController',
    'class ActionControllerError',
    'class BadRequest',
    '  def initialize(msg = nil)',
  ]);
});

test('methods after a nested class still belong to the outer class', () => {
  same(`class Outer
  def first; end
  class Inner
    def inner_one; end
  end
  def second; end
end
`, [
    'class Outer',
    '  def first',
    '  def second',
    'class Inner',
    '  def inner_one',
  ]);
});

test('class << self lists its methods as singleton methods of the owner', () => {
  same(`class Config
  class << self
    def load(path)
      path
    end
  end
  def self.reset; end
  def value; end
end
`, [
    'class Config',
    '  def self.load(path)',
    '  def self.reset',
    '  def value',
  ]);
});

test('Foo::Bar paths: a compact name is listed as written, and the class reopened by its full path is one entry', () => {
  same(`module Outer
  class Response::Header
    def each(&block); end
  end
end
class Outer::Response::Header
  def reopened(a); end
end
`, [
    'module Outer',
    'class Response::Header',
    '  def each(&block)',
    '  def reopened(a)',
  ]);
});

test('a reopened class is one entry with all its methods', () => {
  const sigs = out(`class Widget
  def a; end
end
class Gadget; end
class Widget
  def b; end
end
`);
  assert.deepStrictEqual(sigs, ['class Widget', '  def a', '  def b', 'class Gadget']);
});

test('same-named classes in different namespaces are two entries, not one', () => {
  same(`module Billing
  class Config
    def a; end
  end
end
module Shipping
  class Config
    def b; end
  end
end
`, ['module Billing', 'class Config', '  def a', 'module Shipping', 'class Config', '  def b']);
});

test('one-line nesting: module A; class B', () => {
  same(`module A; class B
  def inside_b; end
end; end
`, ['module A', 'class B', '  def inside_b']);
});

test('top-level defs stay at column 0, after the owners', () => {
  same(`def helper(x)
  x
end
class K
  def m; end
end
`, ['class K', '  def m', 'def helper(x)']);
});

test('def self.x and def Const.x keep their receiver', () => {
  same(`class K
  def self.build(opts = {}); end
  def Registry.register(x); end
end
`, ['class K', '  def self.build(opts = {})', '  def Registry.register(x)']);
});

// ── text that only looks like structure ────────────────────────────────────

test('heredoc bodies holding class, def and end are not code (and the defs after them keep their owner)', () => {
  same(`class Foo
  TEXT = <<~SQL
    class Fake
      def not_a_method(x)
    end
    end
  SQL

  def real_one(x)
    puts <<-EOS
      class AlsoFake
      def nope
      end
    EOS
  end

  def after_heredocs; end
end
`, ['class Foo', '  def real_one(x)', '  def after_heredocs']);
});

test('two heredocs on one line, and a heredoc with a method call on its opener', () => {
  same(`class Foo
  def a
    run(<<~ONE, <<~TWO).chomp
      def inside_one
      end
    ONE
      class inside_two
      end
    TWO
  end
  def b; end
end
`, ['class Foo', '  def a', '  def b']);
});

test('strings, comments, =begin blocks, __END__ and %-literals holding keywords are not code', () => {
  same(`class Foo
  # class Commented; def nope; end
  A = "class Quoted; def nope2; end"
  B = 'end'
  C = %w[class end def]
  D = %q(class Nope)

=begin
class InBlockComment
  def nope3; end
end
=end

  def real; end
end

__END__
class AfterEnd
  def nope4; end
end
`, ['class Foo', '  def real']);
});

test('regexp literals: a multi-line /x regexp with quotes and a class mention does not swallow the code after it', () => {
  same(`class Foo
  PARSER = /
    \\A
    (?<q>"?)class (?<x>[^;\\s]+)
    end
  /x

  CLASSY = /class Bar; def baz; end/
  def after_regexps; end
end
`, ['class Foo', '  def after_regexps']);
});

test('keywords that are not keywords: method calls, symbols, hash keys, special globals', () => {
  same(`class Foo
  def a
    k = self.class
    x = obj.end
    y = :end
    z = { class: 1, end: 2 }
    w = name.scan(/::|$/) { out << "#{$\`}::#{$'}" }
    method(:def)
  end
  def b; end
end
`, ['class Foo', '  def a', '  def b']);
});

test("a special global at code level ($' $\` $\") does not open a string", () => {
  same(`class Foo
  def a
    rest = $'
  end
  def b
    before = $\`
  end
  def c; end
end
`, ['class Foo', '  def a', '  def b', '  def c']);
});

test('defined? and identifiers that start with a keyword are not keywords', () => {
  same(`class Foo
  def a
    defined?(x)
    klass_name = 1
    ending = 2
    iffy = 3
  end
  def b; end
end
`, ['class Foo', '  def a', '  def b']);
});

// ── blocks that are not def/class ──────────────────────────────────────────

test('modifiers, conditional assignment, begin/end while, case, loops and blocks all balance', () => {
  same(`class Foo
  def modifiers(a)
    return if a
    puts "x" unless a
    x = if a then 1 else 2 end
    y = begin
      1
    end
    begin
      a
    end while false
    case a
    when 1 then 2
    end
    loop do
      break
    end
    a.each do |i|
      next if i
    end
    while a do
      a = nil
    end
    for i in 1..3 do
      i
    end
  end

  def after_modifiers; end
end
`, ['class Foo', '  def modifiers(a)', '  def after_modifiers']);
});

test('endless defs (Ruby 3) have no end to wait for', () => {
  same(`class Foo
  def double(x) = x * 2
  def triple x
    x * 3
  end
  def name = "foo"
  def last; end
end
`, ['class Foo', '  def double(x)', '  def triple', '  def name', '  def last']);
});

test('a conditional def inside the class body belongs to the class', () => {
  same(`class Foo
  if RUBY_VERSION > "3"
    def modern; end
  else
    def legacy; end
  end
  included do
    def from_block; end
  end
end
`, ['class Foo', '  def modern', '  def legacy', '  def from_block']);
});

// One-line witnesses: with every `end` on the same line as its opener there is no
// indentation to lean on, so a block counted wrongly shows as a wrong owner.

test('one-line: an endless def does not wait for an end', () => {
  same('class Foo; def sq(x) = x * x; end\ndef helper; end\n', ['class Foo', '  def sq(x)', 'def helper']);
});

test('one-line: a modifier if/unless/while/until does not open a block', () => {
  same('class Foo; def a; return if b; puts 1 unless c; d += 1 while e; end; end\ndef helper; end\n', ['class Foo', '  def a', 'def helper']);
});

test('one-line: while ... do is one block, not two', () => {
  same('class Foo; def a; while x do y; end; end; end\ndef helper; end\n', ['class Foo', '  def a', 'def helper']);
});

test('one-line: an `end:` hash key is not an end', () => {
  same('class Foo; def a; z = { end: 2 }; end; def b; end; end\ndef helper; end\n', ['class Foo', '  def a', '  def b', 'def helper']);
});

test('a %{...} literal passed to a method call is a string, not modulo and a regexp', () => {
  same(`class Foo
  def a
    assert_dom_equal %{<a href="x">Hello</a>}, link
  end
  def later
    path = "a/b"
  end
end
`, ['class Foo', '  def a', '  def later']);
});

// ── method names ───────────────────────────────────────────────────────────

test('predicate, bang, setter, operator, keyword-named and non-ASCII methods keep their names', () => {
  same(`class Foo
  def valid?(z); z; end
  def save!; end
  def name=(v); end
  def ==(other); true; end
  def <=>(other); 0; end
  def [](k); k; end
  def end; end
  def begin; end
  def ❤; end
  def after; end
end
`, [
    'class Foo',
    '  def valid?(z)',
    '  def save!',
    '  def name=(v)',
    '  def ==(other)',
    '  def <=>(other)',
    '  def [](k)',
    '  def end',
    '  def begin',
    '  def ❤',
    '  def after',
  ]);
});

test('a def whose name is an expression still counts as a block, so the owner survives its end', () => {
  same(`class Foo
  def (obj).special
    1
  end
  def after; end
end
`, ['class Foo', '  def after']);
});

test('names that start with an underscore are left out, as before', () => {
  same('class Foo\n  def _private_helper; end\n  def public_one; end\nend\n', ['class Foo', '  def public_one']);
});

test('parameters across lines, defaults with parentheses and strings, and the sorbet return hint', () => {
  same(`class Foo
  def nested_default(a = g(1, 2), b: h(3))
    a
  end

  def multi(a,
            b = ")",
            c: 1)
    a
  end

  sig { params(x: String).returns(Integer) }
  def typed(x)
    1
  end
end
`, [
    'class Foo',
    '  def nested_default(a = g(1, 2), b: h(3))',
    '  def multi(a, b = ")", c: 1)',
    '  def typed(x) → Integer',
  ]);
});

// ── robustness ─────────────────────────────────────────────────────────────

test('broken or hostile input never throws and stays fast', () => {
  const inputs = [
    '', '   ', 'class', 'class Foo', 'def', 'def (', 'end end end', '"unterminated', "'x", '`x', '<<~HERE\nnever ends',
    '=begin\nnever ends', '%w[unclosed', '/unclosed', 'class Foo\n' + 'def a\n'.repeat(2000), '\u0000\u0001￿'.repeat(500),
    'if true\n'.repeat(5000), 'class A\n' + '  class B\n'.repeat(500),
  ];
  const t0 = Date.now();
  for (const src of inputs) assert.ok(Array.isArray(extract(src)), JSON.stringify(src.slice(0, 20)));
  assert.ok(Date.now() - t0 < 3000, `took ${Date.now() - t0} ms`);
});

// ── the recall harness ─────────────────────────────────────────────────────

test('the recall harness says "unmeasured" and exits 0 when the clones or Ruby are missing', () => {
  const script = path.join(__dirname, '..', '..', 'scripts', 'extraction-recall', 'ruby.mjs');
  const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-recall-'));
  try {
    const r = spawnSync(process.execPath, [script, '--repos', empty], { encoding: 'utf8' });
    assert.strictEqual(r.status, 0, r.stderr);
    assert.ok(r.stdout.includes('unmeasured'), r.stdout);
    const j = spawnSync(process.execPath, [script, '--repos', empty, '--json'], { encoding: 'utf8' });
    assert.strictEqual(JSON.parse(j.stdout).measured, false);
  } finally {
    fs.rmSync(empty, { recursive: true, force: true });
  }
});

console.log(`\nruby-nesting: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
