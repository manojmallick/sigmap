'use strict';

/**
 * Regression tests for #975 — the C/C++ extractor reads declarations, not lines. It lists
 * classes, structs, unions, enums, free functions and methods, with or without a body, under the
 * class that holds them, and gives each the `:start-end` lines of its declaration (from its first
 * token, a `template <...>` header included, to the `;` or the closing `}`).
 *
 * Before #975 it was a handful of line-start regexes: no namespaces, no enums, no prototypes at
 * file scope, no inline members, no anchors. Measured against clangd (a language server built on
 * clang's own parser and preprocessor) on libuv, spdlog and abseil-cpp with
 * `node scripts/run-extraction-recall.mjs --only cpp`; the cases below are the hard ones: nested
 * angle brackets, operators and conversion operators, constructor initialiser lists, out-of-line
 * definitions, macros that look like functions, `extern "C"`, namespace macros, parameters across
 * lines with strings and lambdas, an `#if` with two definitions, and input that is not C++ at all.
 * Where clangd is installed each case is also checked against it at run time.
 *
 * Run: node test/integration/cpp-extractor.test.js
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const { spawnSync } = require('child_process');
const { extract } = require('../../src/extractors/cpp');
const { getLines } = require('../../src/mcp/handlers');

let passed = 0;
let failed = 0;
let skipped = 0;
async function test(name, fn) {
  try { await fn(); console.log(`  PASS  ${name}`); passed++; }
  catch (e) { console.log(`  FAIL  ${name}\n        ${e.message}`); failed++; }
}

// Each case is a source and the signatures it must give, anchors included.
const CASES = {
  'namespaces, a class with every kind of member': {
    src: `#include <string>
namespace app {
namespace detail {
int helper(int x);
}
class Service : public Base {
public:
  Service(int id, std::string name);
  explicit Service(const Service& o) = default;
  ~Service() override;
  virtual int run(int a, int b = 5) const noexcept = 0;
  static Service create(std::string n) { return Service(1, n); }
  Service& operator=(const Service&) = delete;
  bool operator==(const Service& o) const { return id_ == o.id_; }
  int operator()(int x) const;
  operator bool() const;
  friend bool operator!=(const Service&, const Service&);
private:
  int id_;
  void _hidden();
};
}  // namespace app
`,
    sigs: [
      'helper(int x) → int  :4-4',
      'class Service  :6-21',
      '  Service(int id, std::string name)  :8-8',
      '  Service(const Service& o)  :9-9',
      '  ~Service()  :10-10',
      '  run(int a, int b = 5) → int  :11-11',
      '  create(std::string n) → Service  :12-12',
      '  operator=(const Service&) → Service&  :13-13',
      '  operator==(const Service& o) → bool  :14-14',
      '  operator()(int x) → int  :15-15',
      '  operator bool()  :16-16',
    ],
  },

  'templates with nested angle brackets, attributes and export macros': {
    src: `template <typename K, typename V = std::map<K, std::vector<int>>>
class Cache {
 public:
  template <typename F> auto visit(F&& f) const -> decltype(f(1)) { return f(1); }
  V get(const K& key, std::function<V(const K&)> fallback = {}) const;
};
template <typename T> struct is_ok<T*> : std::true_type {};
UV_EXTERN int uv_run(uv_loop_t* loop, uv_run_mode mode);
[[nodiscard]] static inline constexpr int sq(int x) { return x * x; }
template <typename T>
inline T clamp(T v,
               T lo,
               T hi) {
  return v < lo ? lo : v > hi ? hi : v;
}
class Multi final : public A<int>, private B {
  void m();
};
ABSL_DEPRECATED("use g") void f_old(int a);
`,
    sigs: [
      'class Cache  :1-6',
      '  visit(F&& f) → auto  :4-4',
      '  get(const K& key, std::function<V(const K&)> fallback = {}) → V  :5-5',
      'struct is_ok  :7-7',
      'uv_run(uv_loop_t* loop, uv_run_mode mode) → int  :8-8',
      'sq(int x) → int  :9-9',
      'clamp(T v, T lo, T hi) → T  :10-15',
      'class Multi  :16-18',
      '  m() → void  :17-17',
      'f_old(int a) → void  :19-19',
    ],
  },

  'out-of-line definitions and constructor initialiser lists': {
    src: `Service::Service(int id, std::string name)
    : id_(id),
      name_{std::move(name)},
      tags_{} {
  init();
}
Service::~Service() {}
int Service::run(int a, int b) const noexcept { return a + b; }
template <typename T> void Box<T>::put(T v) { v_ = v; }
Widget::Widget() try : a_(0) { init(); } catch (...) {}
`,
    sigs: [
      'Service::Service(int id, std::string name)  :1-6',
      'Service::~Service()  :7-7',
      'Service::run(int a, int b) → int  :8-8',
      'Box::put(T v) → void  :9-9',
      'Widget::Widget()  :10-10',
    ],
  },

  'C: structs, typedefs, enums, function pointers, array parameters, a brace on its own line': {
    src: `typedef struct uv_foo_s uv_foo_t;
struct uv_foo_s { int a; void (*cb)(int); };
typedef struct bar { int z; } bar_t;
typedef struct { int anon; } anon_t;
typedef enum { RED, GREEN } color_t;
enum shape { CIRCLE, SQUARE };
typedef int (*cmp_fn)(const void*, const void*);
UV_EXTERN int uv_pipe(uv_file fds[2], int flags);
static int
helper(int x)
{
  return x;
}
int (*get_handler(int kind))(int);
`,
    sigs: [
      'struct uv_foo_s  :2-2',
      'struct bar  :3-3',
      'enum shape  :6-6',
      'uv_pipe(uv_file fds[2], int flags) → int  :8-8',
      'helper(int x) → int  :9-13',
    ],
  },

  'macros, extern \'C\', a namespace macro, and statements that are not functions': {
    src: `#define MAX(a, b) ((a) > (b) ? (a) : (b))
#define DECLARE(name) \\
  int name(int x) { return x; }
DECLARE(foo)
TEST(Suite, Case) { EXPECT_EQ(1, 1); }
#ifdef __cplusplus
extern "C" {
#endif
int c_api(void);
#ifdef __cplusplus
}
#endif
ABSL_NAMESPACE_BEGIN

class Wrapped {};

ABSL_NAMESPACE_END
static_assert(sizeof(int) == 4, "int");
Foo x(1, 2);
const int k = compute(3);
using Alias = std::vector<int>;
typedef unsigned long ulong;
extern int counter;
friend class Elsewhere;
class Fwd;
struct Other;
Foo y("a");
`,
    sigs: [
      'c_api(void) → int  :9-9',
      'class Wrapped  :15-15',
    ],
  },

  'a macro that wraps the return type, and one that stands for it (found by the held-out check on cJSON and yaml-cpp)': {
    src: `CJSON_PUBLIC(const char *) cJSON_Version(void)
{
  return version;
}
static CJSON_PUBLIC(cJSON *) cJSON_Parse(const char *value);
class EmitterState {
 public:
  EMITTER_MANIP GetFlowType(int group) const;
  EMITTER_MANIP GetCharset() const { return charset; }
  ABSL_ATTRIBUTE_ALWAYS_INLINE EmitterState() {}
};
DECLARE(foo) TEST(a, b) { return; }
TEST(Suite, Case) { run(); }
DEFINE_THING(x, y) bar(int z);
DECLARE_X(foo) API_FUNC_X(int) twice(void);
ANNOT_MACRO() empty_arg(void);
FOO_BAR BAZ_QUX(int x);
API_FUNC_X(int) CAPS_NAME(void);
UV_EXTERN API_FUNC_X(1, 2) numbered(void);
UV_EXTERN CJSON_PUBLIC(int) both(void);
UV_EXTERN SOME_TYPE two_macros(void);
API_EXPORT(aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa::bbbbbbbbbbbbb) longtype(void);
const char *after(void);
`,
    sigs: [
      'cJSON_Version(void) → const char *  :1-4',
      'cJSON_Parse(const char *value) → cJSON *  :5-5',
      'class EmitterState  :6-11',
      '  GetFlowType(int group) → EMITTER_MANIP  :8-8',
      '  GetCharset() → EMITTER_MANIP  :9-9',
      '  EmitterState()  :10-10',
      'both(void) → int  :20-20',
      'two_macros(void) → SOME_TYPE  :21-21',
      'longtype(void) → aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa  :22-22',
      'after(void) → const char *  :23-23',
    ],
  },

  'a field that a macro annotates is not a function, and a function with a name in capitals still is (found by the held-out check on leveldb)': {
    src: `class Table {
 public:
  time_zone UTC();
  std::pair<int, int> H1(size_t h);
  struct stat STATOF(int fd);
  unsigned int KEY_OF(int k);
  std::string KEY_NOT_FOUND(const std::string& key);
  Foo* const HEAD();
  UV_EXTERN uv_loop_t LOOP_OF(int x);
 private:
  int count_ GUARDED_BY(mu_);
  std::vector<int> items_ GUARDED_BY(mu_);
  Foo* const head_ GUARDED_BY(mu_);
  Foo& ref_ GUARDED_BY(mu_);
  uint64_t size_ ABSL_GUARDED_BY(mu_);
  static unsigned long seed_ GUARDED_BY(mu_);
  UV_EXTERN int plain_ GUARDED_BY(mu_);
  uv_loop_t loop_ LOCKS_EXCLUDED(mu_);
};
DLLEXPORT MyType gl_get_error(void);
`,
    sigs: [
      'class Table  :1-19',
      '  UTC() → time_zone  :3-3',
      '  H1(size_t h) → std::pair<int, int>  :4-4',
      '  STATOF(int fd) → struct stat  :5-5',
      '  KEY_OF(int k) → unsigned int  :6-6',
      '  KEY_NOT_FOUND(const std::string& key) → std::string  :7-7',
      '  HEAD() → Foo* const  :8-8',
      '  LOOP_OF(int x) → uv_loop_t  :9-9',
      'gl_get_error(void) → DLLEXPORT MyType  :20-20',
    ],
  },

  'parameters that span lines, nest parentheses, hold lambdas, strings with braces, and comments': {
    src: `int connect(const char* host, /* the host { */
            int port = default_port(8080),
            std::function<int(int)> cb = [](int x) { return x; },
            const char* banner = "{ not code ( ) }");  // trailing ) comment
void after() {}
`,
    sigs: [
      'connect(const char* host, int port = default_port(8080), std::function<int(int)> cb = [](int x) { return x; }, const char* banner = "{ not code ( ) }") → int  :1-4',
      'after() → void  :5-5',
    ],
  },

  'enums of every kind, unions and nested types': {
    src: `enum class Mode : uint8_t { A, B };
enum Plain { P, Q };
enum class Opaque : int;
union Number { int i; float f; };
struct Outer {
  struct Inner { void go(); };
  enum Kind { K1, K2 };
  Inner make() const;
};
`,
    sigs: [
      'enum class Mode  :1-1',
      'enum Plain  :2-2',
      'union Number  :4-4',
      'struct Outer  :5-9',
      '  struct Inner  :6-6',
      '    go() → void  :6-6',
      '  enum Kind  :7-7',
      '  make() → Inner  :8-8',
    ],
  },

  'both branches of an #if are listed': {
    src: `#if defined(HAVE_X)
int pick(int a) { return a; }
#else
int pick(long a) { return (int)a; }
#endif
void after();
`,
    sigs: [
      'pick(int a) → int  :2-2',
      'pick(long a) → int  :4-4',
      'after() → void  :6-6',
    ],
  },

  'the (min)() idiom, operator symbols and conversion operators': {
    src: `struct Limits {
  static constexpr int (min)() { return 0; }
  static constexpr int (max)() { return 9; }
  bool operator<(const Limits&) const;
  bool operator<=>(const Limits&) const;
  Limits& operator<<(int);
  int operator[](int) const;
  explicit operator const char*() const;
};
`,
    sigs: [
      'struct Limits  :1-9',
      '  min() → int  :2-2',
      '  max() → int  :3-3',
      '  operator<(const Limits&) → bool  :4-4',
      '  operator<=>(const Limits&) → bool  :5-5',
      '  operator<<(int) → Limits&  :6-6',
      '  operator[](int) → int  :7-7',
      '  operator const char*()  :8-8',
    ],
  },
};

(async () => {
  for (const [name, c] of Object.entries(CASES)) {
    await test(name, () => assert.deepStrictEqual(extract(c.src, 'x.cpp'), c.sigs));
  }

  await test('a header still hands Objective-C to its own extractor, and a C++ header that only mentions @interface in a comment stays C++', () => {
    const viaCpp = extract('@interface Foo : NSObject\n- (void)bar;\n@end\n', 'Foo.h');
    assert.deepStrictEqual(viaCpp, require('../../src/extractors/objc').extract('@interface Foo : NSObject\n- (void)bar;\n@end\n', 'Foo.h'));
    assert.ok(viaCpp.length > 0, 'the Objective-C extractor listed nothing');
    assert.deepStrictEqual(extract('// @interface is Objective-C\nclass Real {};\n', 'real.h'), ['class Real  :2-2']);
    assert.deepStrictEqual(extract('#import <Foundation/Foundation.h>\n@interface A : NSObject\n@end\n', 'a.h'), require('../../src/extractors/objc').extract('#import <Foundation/Foundation.h>\n@interface A : NSObject\n@end\n', 'a.h'));
  });

  await test('names that start with an underscore stay out, as before; the lines after them keep their own anchors', () => {
    assert.deepStrictEqual(extract('class P {\n  void _hidden();\n  void shown();\n};\nvoid _top();\nvoid top();\n', 'p.cpp'),
      ['class P  :1-4', '  shown() → void  :3-3', 'top() → void  :6-6']);
  });

  await test('every anchor starts on a line that holds the symbol (or its template header) and ends on or after it', () => {
    for (const [name, c] of Object.entries(CASES)) {
      const lines = c.src.split('\n');
      for (const sig of extract(c.src, 'x.cpp')) {
        const anchor = /\s{2}:(\d+)-(\d+)$/.exec(sig);
        const lead = /^\s*(?:(?:class|struct|union|enum class|enum) )?(operator\S*?(?=\()(?:\(\))?|~?\w+(?:::~?\w+)*)/.exec(sig);
        assert.ok(anchor && lead, `${name}: ${sig} has no anchor`);
        const [, a, b] = anchor;
        const sym = lead[1];
        assert.ok(Number(a) <= Number(b), `${name}: ${sig} ends before it starts`);
        const bare = sym.split('::').pop().replace(/^operator.*/, 'operator');
        const window = lines.slice(Number(a) - 1, Number(b)).join('\n');
        assert.ok(window.includes(bare), `${name}: lines ${a}-${b} do not hold ${sym}`);
      }
    }
  });

  await test('get_lines with an anchor returns exactly one declaration: a method of a class, and a free function', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-cppanchor-'));
    try {
      const src = CASES['templates with nested angle brackets, attributes and export macros'].src;
      fs.writeFileSync(path.join(root, 'cache.h'), src);
      const sigs = extract(src, 'cache.h');
      const clamp = sigs.find((s) => s.startsWith('clamp('));
      const [, a, b] = /:(\d+)-(\d+)$/.exec(clamp);
      const out = getLines({ file: 'cache.h', start: a, end: b }, root);
      assert.strictEqual(out, ['# cache.h:10-15', '```', 'template <typename T>', 'inline T clamp(T v,', '               T lo,', '               T hi) {', '  return v < lo ? lo : v > hi ? hi : v;', '}', '```'].join('\n'));
      const get = sigs.find((s) => s.includes('get(const K&'));
      const [, c, d] = /:(\d+)-(\d+)$/.exec(get);
      assert.strictEqual(getLines({ file: 'cache.h', start: c, end: d }, root).split('\n')[2].trim(), 'V get(const K& key, std::function<V(const K&)> fallback = {}) const;');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  await test('the caps disclose what they drop: 200 signatures a file, 120 members a class', () => {
    const many = Array.from({ length: 230 }, (_, i) => `int f${i}(int a);`).join('\n');
    const sigs = extract(many, 'many.h');
    assert.strictEqual(sigs.length, 201);
    assert.strictEqual(sigs[200], '… +30 more signatures');
    const members = Array.from({ length: 150 }, (_, i) => `  void m${i}();`).join('\n');
    const cls = extract(`class Big {\n${members}\n};\n`, 'big.h');
    assert.strictEqual(cls.length, 1 + 121);
    assert.strictEqual(cls[121], '… +30 more members');
  });

  await test('input that is not C++, or never closes, never throws and stays fast', () => {
    const hostile = [
      '', '   ', '{', '}', '((((', '))))', 'template <', 'template <typename T', 'class', 'class {', 'enum', 'enum class X :',
      'namespace {', 'extern "C" {', 'struct S { int a; ', 'int f(', 'int f(int a', 'int f(int a) {', 'operator', 'operator()(',
      '#if 1\nint f() {\n#else\nint f(int) {\n#endif\n}\nint g();\n',
      '{'.repeat(5000), '('.repeat(5000), '<'.repeat(5000), 'template <'.repeat(2000), 'x'.repeat(200000),
      Array.from({ length: 3000 }, (_, i) => `struct S${i} { void m(); };`).join('\n'),
      '\u0000\u0001\u0002 binary �'.repeat(500),
      '#define X(a) \\\n  a \\\n  a\nint after();',
      '"unterminated string {\nint f();',
      "'a' '\nint g();",
    ];
    const t0 = Date.now();
    for (const src of hostile) assert.ok(Array.isArray(extract(src, 'h.cpp')), `not an array for ${JSON.stringify(src.slice(0, 30))}`);
    assert.ok(Date.now() - t0 < 5000, `took ${Date.now() - t0} ms`);
    assert.deepStrictEqual(extract(null), []);
    assert.deepStrictEqual(extract(42), []);
  });

  await test('an #if that opens a brace in one branch and not the other can swallow the rest of the file (a documented limit); the next file is unaffected', () => {
    const swallowed = extract('#if A\nvoid f() {\n#else\nvoid f(int) {\n#endif\n  body();\n}\nvoid after();\n', 'a.cpp');
    assert.ok(swallowed.some((s) => s.startsWith('f(')), JSON.stringify(swallowed));
    assert.deepStrictEqual(extract('void next();\n', 'b.cpp'), ['next() → void  :1-1']);
  });

  // ── against clangd ─────────────────────────────────────────────────────────

  const clangd = spawnSync('clangd', ['--version'], { encoding: 'utf8' });
  if (clangd.error || clangd.status !== 0) {
    console.log('  SKIP  every case agrees with clangd (clangd is not on PATH)');
    skipped++;
  } else {
    await test('every anchor clangd can judge is the range it gives that declaration (a template header above it excepted)', async () => {
      const cpp = await import(path.join(__dirname, '..', '..', 'scripts', 'extraction-recall', 'cpp.mjs'));
      const ref = await import(path.join(__dirname, '..', '..', 'scripts', 'extraction-recall', 'cpp-reference.mjs'));
      const { newTally, rowsOf } = await import(path.join(__dirname, '..', '..', 'scripts', 'lib', 'extraction-recall.mjs'));
      const { stripComments } = require('../../src/extractors/scan');
      const { documentSymbols } = require('../../src/lsp/client');
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-cppclangd-'));
      try {
        let judged = 0;
        for (const [name, c] of Object.entries(CASES)) {
          if (/both branches/.test(name)) continue; // clangd compiles only one branch of an #if
          const file = path.join(dir, `case${judged}.cpp`);
          fs.writeFileSync(file, c.src);
          const r = documentSymbols(['clangd', '--log=error', '--background-index=false'], file, c.src, 'cpp');
          assert.ok(r && Array.isArray(r.symbols), `clangd gave no answer for: ${name}`);
          const tally = newTally(cpp.KINDS);
          cpp.compareFile(tally, ref.flatten(r.symbols), extract(c.src, file), name, stripComments(c.src));
          const exact = rowsOf(tally).find((x) => x.kind === 'anchor-exact');
          const miss = tally['anchor-exact'].misses;
          assert.deepStrictEqual(miss, [], `${name}: anchors clangd disagrees with: ${miss.join(' | ')}`);
          judged += exact.reference;
        }
        assert.ok(judged >= 25, `only ${judged} anchors were judged: the check is not looking at enough`);
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    });
  }

  console.log(`\ncpp-extractor: ${passed} passed, ${failed} failed${skipped ? `, ${skipped} skipped` : ''}`);
  process.exit(failed > 0 ? 1 : 0);
})();
