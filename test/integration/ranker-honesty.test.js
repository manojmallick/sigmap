'use strict';

/**
 * Integration tests for ranker honesty and diagnosability.
 *
 *   #807 — zero-score rows are not results; a repo-name token does not dominate
 *   #808 — tests/mocks/CI/docs must not outrank the implementation
 *   #813 — `--explain` makes a miss legible
 *
 * Plus the two defects those fixes exposed: the divergent file-class
 * definitions (src/util/file-class.js) and the stemmer's plural fold.
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const CLI = path.join(ROOT, 'gen-context.js');

const { rank, formatRankTable, formatExplainTable, DEFAULT_WEIGHTS } = require(path.join(ROOT, 'src/retrieval/ranker'));
const fileClass = require(path.join(ROOT, 'src/util/file-class'));
const { stem } = require(path.join(ROOT, 'src/retrieval/bm25'));

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

/** The gin shape from #808: implementation, tests, a root README and CI. */
function ginIndex() {
  return new Map([
    ['gin.go', ['func New() *Engine', 'func (engine *Engine) handleHTTPRequest(c *Context)']],
    ['routergroup.go', ['func (group *RouterGroup) Handle(httpMethod, relativePath string, handlers ...HandlerFunc)', 'func (group *RouterGroup) combineHandlers(handlers HandlersChain) HandlersChain']],
    ['tree.go', ['func (n *node) addRoute(path string, handlers HandlersChain)']],
    ['context.go', ['func (c *Context) Next()', 'func (c *Context) Abort()']],
    ['routes_test.go', ['func TestRouterGroupHandle(t *testing.T)', 'func testRouteOK(method string, t *testing.T)']],
    ['middleware_test.go', ['func TestMiddlewareGeneralCase(t *testing.T)']],
    ['README.md', ['h1 Gin Web Framework', 'h2 Using middleware']],
    ['.github/workflows/gin.yml', ['job build', 'step run tests']],
    ['ginS/gins.go', ['func Handle(httpMethod, relativePath string, handlers ...gin.HandlerFunc)']],
  ]);
}

/** The tokio shape from #808: a mock sitting beside the real implementation. */
function tokioIndex() {
  return new Map([
    ['src/runtime/scheduler/multi_thread/worker.rs', ['fn run(worker: Arc<Worker>)', 'fn schedule_task(&self, task: Notified)']],
    ['benches/schedule_latency.rs', ['fn schedule_latency_bench(c: &mut Criterion)']],
    ['benches/schedule_latency_mock.rs', ['fn schedule_latency_mock(c: &mut Criterion)']],
  ]);
}

function tmpRepo(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-honesty-'));
  for (const [rel, body] of Object.entries(files)) {
    const abs = path.join(dir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, body);
  }
  return dir;
}

function cli(dir, argv) {
  try {
    return { stdout: execFileSync('node', [CLI, ...argv], { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }), code: 0 };
  } catch (e) {
    return { stdout: (e.stdout || '') + (e.stderr || ''), code: e.status };
  }
}

// ── #807: zero-score rows are not results ───────────────────────────────────

test('#807 rank() returns nothing when no file scores above zero', () => {
  const out = rank('quantum chromodynamics lattice gauge', ginIndex(), { topK: 8, learned: false });
  assert.strictEqual(out.length, 0, `expected no results, got ${out.map((r) => r.file).join(', ')}`);
});

test('#807 no ranked row ever carries a zero score', () => {
  for (const q of ['routergroup handle combineHandlers', 'gin', 'engine context abort']) {
    const out = rank(q, ginIndex(), { topK: 9, learned: false });
    const zeros = out.filter((r) => r.score <= 0);
    assert.strictEqual(zeros.length, 0, `"${q}" returned zero-score rows: ${zeros.map((r) => r.file).join(', ')}`);
  }
});

test('#807 a query that matches nothing renders an explicit no-match, not filler', () => {
  const out = rank('quantum chromodynamics lattice gauge', ginIndex(), { topK: 8, learned: false });
  const table = formatRankTable(out, 'quantum chromodynamics lattice gauge');
  assert.ok(/No matching files found/i.test(table), `expected a no-match message, got:\n${table}`);
  assert.ok(!/\| 1 \|/.test(table), 'a no-match render must not number any row');
});

test('#807 includeZeroScore is opt-in only, so multi-stage callers can still boost', () => {
  const q = 'routergroup handle combineHandlers';
  const strict = rank(q, ginIndex(), { topK: 9, learned: false });
  const full = rank(q, ginIndex(), { topK: 9, learned: false, includeZeroScore: true });
  assert.ok(full.length >= strict.length, 'the opt-in pool must be at least as large');
  assert.ok(strict.every((r) => r.score > 0), 'the default pool must be strictly positive');
});

test('#807 a repo-name token does not by itself lift a file into the top 5', () => {
  // Every path below collides with the project name "gin"; only gin.go also
  // carries matching signature content.
  const idx = new Map([
    ['gin.go', ['func New() *Engine']],
    ['ginS/gins.go', ['func Handle(httpMethod string)']],
    ['.github/workflows/gin.yml', ['job build']],
    ['internal/gin/helper.go', ['func unrelatedHelper()']],
    ['engine.go', ['func (engine *Engine) ServeHTTP(w http.ResponseWriter, req *http.Request)']],
  ]);
  const out = rank('gin', idx, { topK: 5, learned: false, explain: true });
  const idf = out.pathIdf.get('gin');
  assert.ok(idf < 0.5, `a token in most paths must carry low path IDF, got ${idf}`);
  const ci = out.find((r) => r.file === '.github/workflows/gin.yml');
  if (ci) {
    assert.ok(out.indexOf(ci) >= 3, `a CI file matching only the repo name must not reach the top 3 (got rank ${out.indexOf(ci) + 1})`);
  }
});

// ── #808: the implementation outranks what merely mentions it ───────────────

test('#808 gin.go and routergroup.go both reach the top 5 for the routing question', () => {
  const out = rank('How does gin route requests through its middleware chain?', ginIndex(), { topK: 5, learned: false });
  const top5 = out.map((r) => r.file);
  assert.ok(top5.includes('gin.go'), `gin.go missing from top 5: ${top5.join(', ')}`);
  assert.ok(top5.includes('routergroup.go'), `routergroup.go missing from top 5: ${top5.join(', ')}`);
});

test('#808 no test file outranks the implementation on a how-does query', () => {
  const out = rank('How does gin route requests through its middleware chain?', ginIndex(), { topK: 9, learned: false });
  const files = out.map((r) => r.file);
  const firstTest = files.findIndex((f) => /_test\.go$/.test(f));
  const firstImpl = files.findIndex((f) => /^(gin|routergroup|tree|context)\.go$/.test(f));
  assert.ok(firstImpl !== -1, 'no implementation file ranked at all');
  assert.ok(firstTest === -1 || firstTest > firstImpl,
    `a test outranked the implementation: ${files.join(', ')}`);
});

test('#808 a root README does not outrank the implementation', () => {
  const out = rank('How does gin route requests through its middleware chain?', ginIndex(), { topK: 9, learned: false });
  const files = out.map((r) => r.file);
  const readme = files.indexOf('README.md');
  const impl = files.findIndex((f) => /^(gin|routergroup|tree|context)\.go$/.test(f));
  assert.ok(readme === -1 || readme > impl, `README outranked implementation: ${files.join(', ')}`);
});

test('#808 a CI workflow does not outrank the implementation', () => {
  const out = rank('How does gin route requests through its middleware chain?', ginIndex(), { topK: 9, learned: false });
  const files = out.map((r) => r.file);
  const ci = files.findIndex((f) => f.startsWith('.github/workflows/'));
  const impl = files.findIndex((f) => /^(gin|routergroup|tree|context)\.go$/.test(f));
  assert.ok(ci === -1 || ci > impl, `CI outranked implementation: ${files.join(', ')}`);
});

test('#808 tokio: a _mock bench does not outrank the real scheduler', () => {
  const out = rank('how does the multi thread scheduler schedule a task', tokioIndex(), { topK: 3, learned: false });
  const files = out.map((r) => r.file);
  const mock = files.findIndex((f) => /_mock\.rs$/.test(f));
  const impl = files.indexOf('src/runtime/scheduler/multi_thread/worker.rs');
  assert.ok(impl !== -1, `the implementation did not rank: ${files.join(', ')}`);
  assert.ok(mock === -1 || mock > impl, `a mock outranked the implementation: ${files.join(', ')}`);
});

test('#808 a query that DOES ask about tests still surfaces them, un-penalised', () => {
  const out = rank('router group handle test', ginIndex(), { topK: 5, learned: false });
  const t = out.find((r) => /_test\.go$/.test(r.file));
  assert.ok(t, `an explicit test query surfaced no test file: ${out.map((r) => r.file).join(', ')}`);
  assert.strictEqual(t.signals.penalty, 1.0, 'a test file must not be penalised when the query asks for tests');
});

test('#808 a CI query un-penalises CI files', () => {
  const out = rank('github actions workflow build pipeline', ginIndex(), { topK: 5, learned: false, includeZeroScore: true });
  const ci = out.find((r) => r.file.startsWith('.github/workflows/'));
  assert.ok(ci, 'a CI query surfaced no CI file');
  assert.strictEqual(ci.signals.penalty, 1.0, 'a CI file must not be penalised when the query asks for CI');
});

test('#808 symbolMatch outweighs pathMatch — defining beats mentioning', () => {
  assert.ok(DEFAULT_WEIGHTS.symbolMatch > DEFAULT_WEIGHTS.pathMatch,
    `symbolMatch (${DEFAULT_WEIGHTS.symbolMatch}) must exceed pathMatch (${DEFAULT_WEIGHTS.pathMatch})`);
});

// ── file-class: one definition, shared by budget order and ranker ───────────

test('file-class recognises every test convention the extractors support', () => {
  for (const p of ['routes_test.go', 'test_ranker.py', 'ranker_test.rs', 'FooTest.java',
    'FooTests.kt', 'FooSpec.scala', 'FooTest.m', 'FooTests.m', 'FooTestCase.m', 'FooTests.mm',
    'foo.test.js', 'foo.spec.ts', 'src/test/java/A.java',
    'tests/a.py', '__tests__/a.js', 'e2e/flow.ts']) {
    assert.ok(fileClass.isTestFile(p), `${p} must classify as a test file`);
  }
});

test('file-class does not misread ordinary names as tests', () => {
  for (const p of ['Latest.java', 'contest.java', 'protest.kt', 'src/attest.go', 'greatest.js', 'contest.m', 'protest.mm']) {
    assert.ok(!fileClass.isTestFile(p), `${p} must NOT classify as a test file`);
  }
});

test('file-class catches root docs and CI, but not source that merely sounds like docs', () => {
  for (const p of ['README.md', 'CHANGELOG.md', 'CONTRIBUTING.md', 'docs/guide.md']) {
    assert.ok(fileClass.isDocsFile(p), `${p} must classify as docs`);
  }
  // src/wiki/generate.js BUILDS a wiki; demoting it cost a gold retrieval task.
  for (const p of ['src/wiki/generate.js', 'src/man/pages.js', 'website/src/app.tsx']) {
    assert.ok(!fileClass.isDocsFile(p), `${p} must NOT classify as docs`);
  }
  for (const p of ['.github/workflows/ci.yml', '.gitlab-ci.yml', '.circleci/config.yml', 'Jenkinsfile']) {
    assert.ok(fileClass.isCiFile(p), `${p} must classify as CI`);
  }
  assert.ok(!fileClass.isCiFile('src/extractors/pipeline.js'), 'the CI extractor is source, not CI');
});

test('the budget drop-order and the ranker share one definition', () => {
  const src = fs.readFileSync(path.join(ROOT, 'src/retrieval/ranker.js'), 'utf8');
  assert.ok(/require\('\.\.\/util\/file-class'\)/.test(src),
    'the ranker must consume src/util/file-class.js rather than inline its own copy');
  const bundle = fs.readFileSync(CLI, 'utf8');
  assert.ok(/_fileClass\(\)\.isTestFile/.test(bundle),
    'the budget drop-order must delegate isTestFile to the shared module');
});

// ── stemmer: plural folding must survive an over-strip ──────────────────────

test('stem() unifies singular and plural so "users" matches loginUser', () => {
  for (const [a, b] of [['users', 'user'], ['handlers', 'handler'], ['routes', 'route'],
    ['files', 'file'], ['tokens', 'token'], ['classes', 'class']]) {
    assert.strictEqual(stem(a), stem(b), `stem("${a}") must equal stem("${b}")`);
  }
});

// ── #813: --explain makes a miss legible ───────────────────────────────────

test('#813 rank({explain}) attaches the diagnostic surfaces', () => {
  const out = rank('routergroup handle', ginIndex(), { topK: 2, learned: false, explain: true, nearMiss: 3 });
  assert.ok(Array.isArray(out.nearMiss), 'nearMiss must be attached');
  assert.ok(Array.isArray(out.tokenCoverage), 'tokenCoverage must be attached');
  assert.ok(out.pathIdf instanceof Map, 'pathIdf must be attached');
  assert.strictEqual(typeof out.indexSize, 'number', 'indexSize must be attached');
});

test('#813 explain surfaces are absent unless opted in (default output unchanged)', () => {
  const out = rank('routergroup handle', ginIndex(), { topK: 2, learned: false });
  assert.strictEqual(out.nearMiss, undefined, 'nearMiss must not leak into default ranking');
  assert.strictEqual(out.tokenCoverage, undefined, 'tokenCoverage must not leak into default ranking');
  assert.strictEqual(JSON.stringify(out), JSON.stringify([...out]),
    'the returned value must still serialise as a plain array');
});

test('#813 formatExplainTable renders per-file signals and the penalty reason', () => {
  const out = rank('How does gin route requests through its middleware chain?', ginIndex(),
    { topK: 6, learned: false, explain: true, nearMiss: 4 });
  const view = formatExplainTable(out, 'How does gin route requests through its middleware chain?');
  for (const col of ['exact', 'symbol', 'prefix', 'path', 'bm25', 'penalty', 'demoted for']) {
    assert.ok(view.includes(col), `the signal breakdown must include "${col}"`);
  }
  assert.ok(/test file|documentation|CI definition/.test(view),
    `a demoted file must state its reason:\n${view}`);
});

test('#813 formatExplainTable lists near misses below the cutoff', () => {
  const out = rank('How does gin route requests through its middleware chain?', ginIndex(),
    { topK: 2, learned: false, explain: true, nearMiss: 4 });
  const view = formatExplainTable(out, 'q');
  assert.ok(out.nearMiss.length > 0, 'the fixture must produce at least one near miss');
  assert.ok(/Near misses \(below the cutoff of/.test(view), `near-miss section missing:\n${view}`);
});

test('#813 explain names the tokens that matched nothing', () => {
  const out = rank('routergroup handle zzznotarealtoken', ginIndex(),
    { topK: 3, learned: false, explain: true });
  const view = formatExplainTable(out, 'routergroup handle zzznotarealtoken');
  assert.ok(/Matched nothing:.*zzznotarealtoken/.test(view),
    `an unmatched token must be named:\n${view}`);
});

test('#813 token coverage is counted over stems, matching what BM25 scores', () => {
  const idx = new Map([['src/auth/login.js', ['function loginUser(email, password)']]]);
  const out = rank('users', idx, { topK: 3, learned: false, explain: true });
  const cov = out.tokenCoverage.find((c) => c.token === 'users');
  assert.ok(cov && cov.sigFiles === 1,
    `"users" must be reported as matching loginUser via its stem, got ${JSON.stringify(cov)}`);
});

// ── CLI surfaces ───────────────────────────────────────────────────────────

test('CLI: --help documents both --explain surfaces', () => {
  const out = cli(ROOT, ['--help']).stdout;
  assert.ok(/--query "<text>" --explain/.test(out), '--query --explain missing from --help');
  assert.ok(/ask "<query>" --explain/.test(out), 'ask --explain missing from --help');
});

test('CLI: ask --explain prints the diagnostic and writes no context file', () => {
  const dir = tmpRepo({
    'src/auth/login.js': '/** Authentication entry point. */\nfunction loginUser(email, password) { return true; }\n',
    'src/billing.js': 'function createInvoice(customerId, amount) { return {}; }\n',
    'gen-context.config.json': JSON.stringify({ output: 'context.md', outputs: ['copilot'], srcDirs: ['src'], secretScan: false }),
    'package.json': JSON.stringify({ name: 'demo', version: '1.0.0' }),
  });
  try {
    cli(dir, []);
    const r = cli(dir, ['ask', 'how does a user log in', '--explain']);
    assert.strictEqual(r.code, 0, `ask --explain exited ${r.code}: ${r.stdout}`);
    assert.ok(/## Explain:/.test(r.stdout), `missing explain header:\n${r.stdout}`);
    assert.ok(/Query token/.test(r.stdout), `missing token coverage table:\n${r.stdout}`);
    assert.ok(!fs.existsSync(path.join(dir, '.context', 'query-context.md')),
      'a diagnostic run must not write .context/query-context.md');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('CLI: --query --explain is not swallowed by the explain <file> alias', () => {
  const r = cli(ROOT, ['--query', 'ranker penalty', '--explain']);
  assert.strictEqual(r.code, 0, `exited ${r.code}: ${r.stdout.slice(0, 300)}`);
  assert.ok(/## Explain: ranker penalty/.test(r.stdout), `expected the ranking diagnostic:\n${r.stdout.slice(0, 300)}`);
  assert.ok(!/Usage: sigmap explain <file>/.test(r.stdout), '--query --explain must not hit the file-explain usage');
});

test('CLI: --explain <file> still works as the file-explain alias', () => {
  const r = cli(ROOT, ['--explain', 'src/retrieval/ranker.js']);
  assert.strictEqual(r.code, 0, `exited ${r.code}: ${r.stdout.slice(0, 300)}`);
  assert.ok(!/## Explain: /.test(r.stdout), 'the file alias must not render the ranking diagnostic');
});

console.log(`\nranker-honesty: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
