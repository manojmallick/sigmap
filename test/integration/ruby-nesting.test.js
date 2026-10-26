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
 *
 * The second half (#975) pins the `:start-end` anchors every class, module and `def` now carries:
 * the line of the keyword and the line of the `end` that the same depth count closes it with, so
 * `get_lines` can read exactly one symbol. Measured against Ripper on 757 Rails and Sidekiq files with
 * `node scripts/run-extraction-recall.mjs --only ruby`, every emitted definition line is anchored and
 * every anchor is the parser's exact range. The cases are the hard ones (heredocs and strings that
 * hold `end`, `begin`/`rescue`, `case`, loops, modifiers, a symbol that ends in `=`, an operator
 * symbol, `if` as a value, definitions across lines, reopened classes, input that never closes) and,
 * where Ruby is installed, each is also checked against Ripper at run time.
 *
 * Run: node test/integration/ruby-nesting.test.js
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const { spawnSync } = require('child_process');
const { extract } = require('../../src/extractors/ruby');
const { getLines } = require('../../src/mcp/handlers');

let passed = 0;
let failed = 0;
let skipped = 0;
function test(name, fn) {
  try { fn(); console.log(`  PASS  ${name}`); passed++; }
  catch (e) { console.log(`  FAIL  ${name}\n        ${e.message}`); failed++; }
}
// These cases pin WHICH symbols are listed and under which owner; the `:start-end` anchors the
// extractor now adds (#975) are pinned in ruby-anchors.test.js, so they are stripped here.
const unanchor = (sig) => sig.replace(/\s{2}:\d+-\d+$/, '');
const out = (src) => extract(src).map(unanchor);
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

// ── anchors (#975) ─────────────────────────────────────────────────────────

// Each case is a complete Ruby 2.6 file (so Ripper can read it) and the signatures it must give.
const CASES = {
  'nesting, one-line defs and a top-level def': {
    src: `module Services
  class UserService < Base
    def initialize(repo)
      @repo = repo
    end

    def self.build(repo); new(repo); end

    def one_line; end
  end
end

def top(x)
  if x
    1
  end
end
`,
    sigs: [
      'module Services  :1-11',
      'class UserService  :2-10',
      '  def initialize(repo)  :3-5',
      '  def self.build(repo)  :7-7',
      '  def one_line  :9-9',
      'def top(x)  :13-17',
    ],
  },

  'class << self: each singleton method has its own range': {
    src: `class Config
  class << self
    def load
      new
    end

    def reset!; @x = nil; end
  end

  def self.name
    'c'
  end
end
`,
    sigs: [
      'class Config  :1-13',
      '  def self.load  :3-5',
      '  def self.reset!  :7-7',
      '  def self.name  :10-12',
    ],
  },

  'a class opened twice is one entry, anchored to its first opening': {
    src: `module A
  class Foo
    def one
      1
    end
  end
end

module A
  class Foo
    def two
      2
    end
  end
end
`,
    sigs: [
      'module A  :1-7',
      'class Foo  :2-6',
      '  def one  :3-5',
      '  def two  :11-13',
    ],
  },

  'heredoc bodies that hold class, def and end are not code': {
    src: `class Doc
  def render
    <<~TEXT
      class Fake
        def nope
        end
      end
    TEXT
  end

  def after
    <<-EOS.strip
    end
    EOS
  end
end
`,
    sigs: ['class Doc  :1-16', '  def render  :2-9', '  def after  :11-15'],
  },

  'strings, regexps, %-literals, comments and =begin blocks that hold keywords': {
    src: `class Lit
  # def commented
  # end
  def a
    s = "end def class"
    t = 'module end'
    r = /end\\/def/
    w = %w[end def class]
    s
  end

=begin
def in_block_comment
end
=end

  def b
    1
  end
end
`,
    sigs: ['class Lit  :1-20', '  def a  :4-10', '  def b  :17-19'],
  },

  'begin/rescue/ensure, case, loops, assignment from if, modifiers and begin...end while': {
    src: `class Flow
  def run(items)
    items.each do |i|
      begin
        work(i)
      rescue StandardError => e
        warn e
      ensure
        done
      end
    end
    case items.size
    when 0 then :none
    else :some
    end
    while items.any? do
      items.pop
    end
    x = if items.empty?
          1
        else
          2
        end
    puts x unless x.nil?
    begin
      x += 1
    end while x < 3
  end

  def after_flow; end
end
`,
    sigs: ['class Flow  :1-31', '  def run(items)  :2-28', '  def after_flow  :30-30'],
  },

  'a def whose parameters run over several lines': {
    src: `class Wide
  def call(first,
           second = {},
           *rest,
           key: 1,
           &block)
    first
  end

  def after; end
end
`,
    sigs: ['class Wide  :1-11', '  def call(first, second = {}, *rest, key: 1, &block)  :2-8', '  def after  :10-10'],
  },

  'a symbol that ends in = before a modifier is not an assignment (the class still closes where it ends)': {
    src: `class Hash2
  alias_method :w, :[]= unless method_defined?(:w)
  def []=(k, v)
    v
  end
  def last_one; end
end

AFTER = 1
`,
    sigs: ['class Hash2  :1-7', '  def []=(k, v)  :3-5', '  def last_one  :6-6'],
  },

  'an operator symbol (:/) is not the start of a regexp, and a def of / and % keeps its range': {
    src: `class Calc
  def /(other)
    if other.zero?
      1
    else
      calculate(:/, other)
    end
  end

  def %(other)
    send(:%, other)
  end

  def tail; 4 / 2; end
end
`,
    sigs: ['class Calc  :1-15', '  def /(other)  :2-8', '  def %(other)  :10-12', '  def tail  :14-14'],
  },

  'if after << , && and => is a value, not a modifier, and opens a block that its end closes': {
    src: `class Fmt
  def lines_for(last)
    lines = []
    lines << if last && last.size > 0
      last
    else
      []
    end
    lines
  end

  def pair(a)
    [a, if a then 1 else 2 end]
  end

  def both(a, b)
    a && if b then 1 else 2 end
  end

  def keyed(a)
    { k: 1 }.merge(:v => if a then 1 else 2 end)
  end
end

AFTER = 1
`,
    sigs: ['class Fmt  :1-23', '  def lines_for(last)  :2-10', '  def pair(a)  :12-14', '  def both(a, b)  :16-18', '  def keyed(a)  :20-22'],
  },

  'def obj.name keeps its receiver, whatever it is called': {
    src: `module Explain
  def run(str)
    def str.inspect
      self
    end
    str
  end
end
`,
    sigs: ['module Explain  :1-8', '  def run(str)  :2-7', '  def str.inspect  :3-5'],
  },
};

// ── literal expectations ───────────────────────────────────────────────────

for (const [name, c] of Object.entries(CASES)) {
  test(`anchors: ${name}`, () => assert.deepStrictEqual(extract(c.src), c.sigs));
}

test('an endless def (Ruby 3) ends on its own line and does not wait for an end', () => {
  assert.deepStrictEqual(extract(`class E
  def sq(x) = x * x
  def after; end
end
`), ['class E  :1-4', '  def sq(x)  :2-2', '  def after  :3-3']);
});

test('input that never closes does not throw: an open block runs to the last line', () => {
  const sigs = extract('class Open\n  def a\n    1\n');
  assert.deepStrictEqual(sigs, ['class Open  :1-3', '  def a  :2-3']);
  const lone = extract('def only\n  1');
  assert.deepStrictEqual(lone, ['def only  :1-2']);
});

test('names that start with an underscore stay out; the signatures after them keep their own lines', () => {
  assert.deepStrictEqual(extract(`class P
  def _hidden
    1
  end

  def shown
    2
  end
end
`), ['class P  :1-9', '  def shown  :6-8']);
});

test('every anchor starts on a line that names its symbol and ends on or after it', () => {
  for (const [name, c] of Object.entries(CASES)) {
    const lines = c.src.split('\n');
    for (const sig of extract(c.src)) {
      const m = /^\s*(class|module|def)\s+(?:self\.|\w+\.)?([^\s(→:]+).*?\s{2}:(\d+)-(\d+)$/.exec(sig);
      assert.ok(m, `${name}: ${sig} has no anchor`);
      const [, , sym, a, b] = m;
      assert.ok(Number(a) <= Number(b), `${name}: ${sig} ends before it starts`);
      assert.ok(lines[Number(a) - 1].includes(sym.replace(/^.*::/, '')), `${name}: line ${a} does not name ${sym}`);
    }
  }
});

// ── get_lines narrows to a symbol ──────────────────────────────────────────

test('get_lines with an anchor returns exactly one symbol, from its keyword to its end', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-rbanchor-'));
  try {
    const c = CASES['nesting, one-line defs and a top-level def'];
    fs.writeFileSync(path.join(root, 'svc.rb'), c.src);
    const sig = extract(c.src).find((s) => s.includes('def initialize'));
    const [, a, b] = /:(\d+)-(\d+)$/.exec(sig);
    const out = getLines({ file: 'svc.rb', start: a, end: b }, root);
    assert.strictEqual(out, ['# svc.rb:3-5', '```', '    def initialize(repo)', '      @repo = repo', '    end', '```'].join('\n'));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

// ── against Ruby's own parser ──────────────────────────────────────────────

const ruby = spawnSync('ruby', ['-e', 'puts RUBY_VERSION'], { encoding: 'utf8' });
if (ruby.error || ruby.status !== 0) {
  console.log('  SKIP  every case agrees with Ripper (ruby is not on PATH)');
  skipped++;
} else {
  test('every emitted anchor is a range Ripper reports for the same kind and name', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-rbripper-'));
    try {
      const files = [];
      for (const [i, c] of Object.values(CASES).entries()) {
        const f = path.join(dir, `case${i}.rb`);
        fs.writeFileSync(f, c.src);
        files.push(f);
      }
      const script = path.join(__dirname, '..', '..', 'scripts', 'extraction-recall', 'ruby-ripper.rb');
      const r = spawnSync('ruby', [script, ...files], { encoding: 'utf8', maxBuffer: 1 << 26 });
      assert.strictEqual(r.status, 0, r.stderr);
      const truth = JSON.parse(r.stdout);
      Object.values(CASES).forEach((c, i) => {
        const ref = truth[files[i]];
        assert.ok(ref, `Ripper could not read case ${i}: ${Object.keys(CASES)[i]}`);
        const ranges = new Set(ref.map(([kind, name, a, b]) => `${kind}|${name.split(/[#.]/).pop()}|${a}|${b}`));
        for (const sig of extract(c.src)) {
          const m = /^\s*(class|module|def)\s+(?:\w+\.)?([^\s(→]+).*?\s{2}:(\d+)-(\d+)$/.exec(sig);
          const kind = m[1] === 'def' ? 'method' : m[1];
          assert.ok(ranges.has(`${kind}|${m[2]}|${m[3]}|${m[4]}`), `${Object.keys(CASES)[i]}: ${sig.trim()} is not a range Ripper reports`);
        }
      });
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
}

console.log(`\nruby-nesting: ${passed} passed, ${failed} failed${skipped ? `, ${skipped} skipped` : ''}`);
process.exit(failed > 0 ? 1 : 0);
