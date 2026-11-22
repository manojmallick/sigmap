'use strict';

/**
 * A Python environment or a directory of installed packages below the source root is never indexed,
 * whatever `exclude` lists and whatever the environment is called (src/util/vendored-dir.js).
 *
 * The bug it pins: a config whose `exclude` was copied from the example names no Python environment,
 * and `exclude` replaces the default list, so `<dir>/.venv/lib/python3.x/site-packages/**` went
 * into the generated context file and the retrieval index.
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const GEN = path.join(ROOT, 'gen-context.js');
const { isVendoredName, isEnvironmentRoot, VENDORED_NAMES } = require('../../src/util/vendored-dir');

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  PASS  ${name}`); passed++; }
  catch (err) { console.log(`  FAIL  ${name}\n        ${err.message}`); failed++; }
}

const tmpDirs = [];
function repo(files, config) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vendored-'));
  tmpDirs.push(dir);
  for (const [rel, body] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), body);
  }
  if (config) fs.writeFileSync(path.join(dir, 'gen-context.config.json'), JSON.stringify(config));
  execFileSync('git', ['init', '-q', dir]);
  return dir;
}
function generate(dir) {
  execFileSync(process.execPath, [GEN, '--adapter', 'claude'], { cwd: dir, stdio: ['ignore', 'ignore', 'pipe'], env: Object.assign({}, process.env, { SIGMAP_NO_UPDATE_CHECK: '1' }) });
  const md = fs.readFileSync(path.join(dir, 'CLAUDE.md'), 'utf8');
  return [...md.matchAll(/^### (.+)$/gm)].map((m) => m[1]);
}

const PY = (name) => `def ${name}(x):\n    return x\n`;
// The exclude list of gen-context.config.json.example: it names no Python environment.
const EXAMPLE_EXCLUDE = ['node_modules', '.git', 'dist', 'build', 'out', '__pycache__', '.next', 'coverage', 'target', 'vendor', '.context'];

const FILES = {
  'app/main.py': PY('real_app_function'),
  'service/app/crawler.py': PY('crawl_site'),
  // a venv under a subdirectory, with the hidden name
  'service/.venv/pyvenv.cfg': 'home = /usr/bin\nversion = 3.9.1\n',
  'service/.venv/lib/python3.9/site-packages/greenlet/core.py': PY('vendored_greenlet'),
  'service/.venv/bin/activate_this.py': PY('activate'),
  // an environment with a name no list would hold
  'tools/py311/pyvenv.cfg': 'home = /usr\n',
  'tools/py311/lib/python3.11/site-packages/requests/api.py': PY('vendored_requests'),
  'tools/py311/helper.py': PY('env_helper'),
  // a conda environment
  'conda-env/conda-meta/history': '',
  'conda-env/lib/mod.py': PY('conda_thing'),
  // installed packages with no environment marker above them (an old virtualenv, a Lambda layer)
  'layer/python/site-packages/boto/thing.py': PY('vendored_boto'),
  // the project's own code under names that only LOOK like an environment
  'venv/mine.py': PY('my_own_code_in_a_dir_called_venv'),
  'env/settings.py': PY('my_env_settings'),
};

test('the predicates: an environment is known by pyvenv.cfg or conda-meta, a package directory by its name', () => {
  const ent = (name, kind) => ({ name, isFile: () => kind === 'f', isDirectory: () => kind === 'd' });
  assert.ok(isEnvironmentRoot([ent('bin', 'd'), ent('pyvenv.cfg', 'f')]));
  assert.ok(isEnvironmentRoot([ent('conda-meta', 'd')]));
  assert.ok(!isEnvironmentRoot([ent('pyvenv.cfg', 'd')]), 'a DIRECTORY of that name is not the marker');
  assert.ok(!isEnvironmentRoot([ent('conda-meta', 'f')]));
  assert.ok(!isEnvironmentRoot([ent('main.py', 'f')]) && !isEnvironmentRoot(null) && !isEnvironmentRoot([]));
  for (const n of ['site-packages', 'dist-packages', 'node_modules', '__pycache__', '.tox', '.mypy_cache']) assert.ok(isVendoredName(n), n);
  for (const n of ['venv', 'env', 'vendor', 'build', 'lib', 'packages', 'src']) assert.ok(!isVendoredName(n), `${n} can be a project's own directory`);
  assert.ok(VENDORED_NAMES.size <= 16, 'the list stays short: names that mean one thing only');
});

test('a config that copies the example\'s exclude list no longer indexes a virtualenv below the source root', () => {
  const got = generate(repo(FILES, { srcDirs: ['.'], exclude: EXAMPLE_EXCLUDE }));
  assert.ok(got.includes('app/main.py') && got.includes('service/app/crawler.py'), got.join(', '));
  assert.deepStrictEqual(got.filter((f) => /site-packages|\.venv|py311|conda-env|layer\//.test(f)), [], 'no environment and no installed package');
  assert.ok(got.includes('venv/mine.py') && got.includes('env/settings.py'), 'a directory merely NAMED venv or env, with no marker, is the project\'s own');
});

test('zero-config: the same, with no config file at all', () => {
  const got = generate(repo(FILES, null));
  assert.ok(got.includes('app/main.py'), got.join(', '));
  assert.deepStrictEqual(got.filter((f) => /site-packages|\.venv|py311|conda-env/.test(f)), []);
});

test('the retrieval index holds none of it either, so `ask` cannot rank a vendored file', () => {
  const dir = repo(FILES, { srcDirs: ['.'], exclude: EXAMPLE_EXCLUDE });
  generate(dir);
  const out = execFileSync(process.execPath, [GEN, 'ask', 'vendored greenlet requests boto'], { cwd: dir, encoding: 'utf8', env: Object.assign({}, process.env, { SIGMAP_NO_UPDATE_CHECK: '1' }) });
  assert.ok(!/site-packages|\.venv|py311/.test(out), out);
  const index = fs.readFileSync(path.join(dir, '.context', 'sig-index.json'), 'utf8');
  assert.ok(!/vendored_greenlet|vendored_requests|vendored_boto|conda_thing|env_helper/.test(index), 'not in the index');
  assert.ok(/real_app_function/.test(index));
});

for (const d of tmpDirs) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (_) { /* best effort */ } }
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
