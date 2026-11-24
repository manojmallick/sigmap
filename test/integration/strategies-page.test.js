'use strict';

/**
 * The strategies page (docs-vp/guide/strategies.md), the pages that repeat its claims, and the script behind its figures.
 *
 * The page's two tables carried figures from one example project (`~4,000 tokens` came from an 80-file repository in docs/readmes/CONTEXT_STRATEGIES.md) and
 * claims the code contradicts. A fact-check against the code and a run of every strategy on 28 repositories (2026-11-23) found:
 *
 *   - what an agent host is handed depends on the file it reads (CLAUDE.md is trimmed to about 200 lines and AGENTS.md to 32 KiB under `full` only);
 *   - `full` drops files over its budget on 25 of 28 repositories, and `per-module` gives each module its own full budget, not a share of one pool;
 *   - `hot-cold` has neither a budget nor the host trim, and its cold files are reachable with `sigmap ask`, so MCP is not required;
 *   - the retrieval index is the same under every strategy.
 *
 * What this pins:
 *   - the figures in the page's tables and detail sections are the ones benchmarks/strategy-footprint.json gives through the script's own `aggregate()`, so those figures and the
 *     data cannot drift (code defaults and issue numbers are not pinned here; the agent-study percentages are pinned only by being figures of docs-vp/index.md or
 *     docs-vp/guide/choosing-a-setup.md, which setup-table.test.js pins to the committed data);
 *   - each behaviour the page states, by running SigMap in a fixture (no budget on the hot set, no host trim, cold files reachable without MCP, each module's own
 *     budget, `maxTokens` unused while `autoMaxTokens` is on, `read_context` and the module files, files dropped under `full`, the same index under all four strategies, a
 *     map with no signatures under `index`, the `budget: dropped N` line of an index run, `--report` blind to the strategy);
 *   - the pages that repeated the claims no longer say them, and the page's repository links resolve;
 *   - the script itself, run from the command line on a small repository.
 *
 * What it cannot do: say how an agent behaves with `per-module` or `hot-cold` (no agent run exists; the page says so), re-measure the 28 repositories (the corpus is not
 * in CI; `node scripts/measure-strategy-footprint.mjs --repos <dir of clones> --self --sweep` does it), or prove the hot-set size on any repository but the ones measured.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const { pathToFileURL } = require('url');

const ROOT = path.join(__dirname, '..', '..');
let passed = 0;
let failed = 0;
async function test(name, fn) {
  try { await fn(); console.log(`  PASS  ${name}`); passed++; } catch (err) { console.log(`  FAIL  ${name}: ${err.message}`); failed++; }
}

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const num = (n) => Number(n).toLocaleString('en-US');
const sp = (x) => `${num(x.median)} (${num(x.min)}–${num(x.max)})`; // the way the page prints a spread: median (min–max)
const tok = (s) => Math.ceil(s.length / 4);
const SCRIPT = path.join(ROOT, 'scripts', 'measure-strategy-footprint.mjs');
const loadScript = () => import(pathToFileURL(SCRIPT).href);

/** A project with its own git root and home (no inherited GIT_* variables), SigMap run in it. */
function withProject(files, fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-strat-'));
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-strat-home-'));
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^GIT_/.test(k)));
  Object.assign(env, { HOME: home, USERPROFILE: home, CODEX_HOME: path.join(home, '.codex') });
  for (const [rel, body] of Object.entries(files)) { fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true }); fs.writeFileSync(path.join(dir, rel), body); }
  spawnSync('git', ['init', '-q', dir], { env, stdio: 'ignore' });
  const sigmap = (...args) => spawnSync(process.execPath, [path.join(ROOT, 'gen-context.js'), ...args], { cwd: dir, encoding: 'utf8', env, timeout: 120000 });
  const git = (...args) => spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd: dir, encoding: 'utf8', env });
  const readFile = (rel) => { try { return fs.readFileSync(path.join(dir, rel), 'utf8'); } catch (_) { return ''; } };
  const mcp = (name, args = {}) => {
    const input = [{ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 't', version: '0' } } }, { jsonrpc: '2.0', method: 'notifications/initialized' }, { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name, arguments: args } }].map((m) => JSON.stringify(m)).join('\n') + '\n';
    const r = spawnSync(process.execPath, [path.join(ROOT, 'gen-context.js'), '--mcp'], { cwd: dir, encoding: 'utf8', env, input, timeout: 120000 });
    try { return JSON.parse(r.stdout.trim().split('\n').pop()).result.content[0].text; } catch (_) { return `${r.stdout}${r.stderr}`; }
  };
  const ctx = { dir, env, sigmap, git, mcp, read: readFile };
  try { return fn(ctx); } finally { fs.rmSync(dir, { recursive: true, force: true }); fs.rmSync(home, { recursive: true, force: true }); }
}

// A fixture: two modules of small JavaScript files. 30 files of 6 functions is about 3,000 tokens of signatures per module.
const fn = (m, i, j) => `function ${m}Fn${i}x${j}(alpha, beta) { return alpha + beta; }`;
const moduleFiles = (m, files, perFile) => Object.fromEntries(Array.from({ length: files }, (_, i) => [`${m}/f${i}.js`, `${Array.from({ length: perFile }, (_, j) => fn(m, i, j)).join('\n')}\nmodule.exports = {};\n`]));
const project = (strategy, extra = {}, { alpha = 30, beta = 30, perFile = 6 } = {}) => ({
  ...moduleFiles('alpha', alpha, perFile),
  ...moduleFiles('beta', beta, perFile),
  'gen-context.config.json': `${JSON.stringify({ srcDirs: ['alpha', 'beta'], outputs: ['claude', 'codex', 'copilot'], strategy, autoMaxTokens: false, maxTokens: 2000, ...extra })}\n`,
});
const sections = (text) => (text.match(/^### /gm) || []).length;
const indexHash = (ctx) => { const j = JSON.parse(ctx.read('.context/sig-index.json')); return crypto.createHash('sha256').update(JSON.stringify([Object.entries(j.files).sort(), j.bare])).digest('hex').slice(0, 16); };

(async () => {
  // ---------------------------------------------------------------------------
  // 1. The page and the data
  // ---------------------------------------------------------------------------
  const fp = JSON.parse(read('benchmarks/strategy-footprint.json'));
  const { aggregate } = await loadScript();
  const agg = aggregate(fp.repos);
  const page = read('docs-vp/guide/strategies.md');

  await test('1. benchmarks/strategy-footprint.json is what the script writes: four strategies on every record, and the 28 repositories the page names', () => {
    assert.strictEqual(fp.schema, 1);
    assert.ok(/^[0-9a-f]{40}$/.test(fp.measured_with_commit), 'the commit the script ran from is recorded');
    assert.strictEqual(fp.repos.length, 28);
    for (const r of fp.repos) for (const k of ['full', 'index', 'per_module', 'hot_cold']) assert.ok(r[k] && Number.isFinite(r[k].claude_md) && Number.isFinite(r[k].agents_md) && Number.isFinite(r[k].copilot), `${r.repo}: ${k} has the three host sizes`);
    for (const name of ['tokio', 'laravel', 'kotlinx-coroutines', 'okhttp', 'vue-core', 'zod', 'httpx', 'sidekiq', 'spdlog', 'vapor', 'echo', 'dio', 'sigmap', 'akka', 'rails', 'django', 'svelte']) assert.ok(fp.repos.some((r) => r.repo === name), `${name} is measured`);
  });

  await test('1. the page carries no placeholder and no figure that the data does not give (the Quick comparison table)', () => {
    assert.ok(!/@@/.test(page), 'a template placeholder is left in the page');
    const ao = agg.always_on;
    const [a, b, c] = agg.full_lost_nothing;
    for (const want of [
      `${agg.repos} repositories of ${num(agg.files_scanned.min)} to ${num(agg.files_scanned.max)} source files`,
      `\`CLAUDE.md\` ${sp(ao.full.claude_md)} · \`AGENTS.md\` ${sp(ao.full.agents_md)} · Copilot file ${sp(ao.full.copilot)}`,
      `${agg.full_lost_files} of ${agg.repos} repositories lost files. The three that lost none had ${a}, ${b} and ${c} source files`,
      `\`CLAUDE.md\` (about 200 lines) held ${Math.min(...fp.repos.map((r) => r.full.sections.claude_md))} to ${Math.max(...fp.repos.map((r) => r.full.sections.claude_md))} files and \`AGENTS.md\` (32 KiB) ${Math.min(...fp.repos.map((r) => r.full.sections.agents_md))} to ${Math.max(...fp.repos.map((r) => r.full.sections.agents_md))}, so \`CLAUDE.md\` lost files on ${fp.repos.filter((r) => r.full.sections.claude_md < r.files_scanned).length} of ${agg.repos}`,
      `With no config SigMap uses \`strategy: full\` and writes only the Copilot file`,
      `a map of ${num(ao.index.claude_md.median)} tokens at the median (${num(ao.index.claude_md.min)} to ${num(ao.index.claude_md.max)})`,
      `Below the size of the map itself (${num(ao.index.claude_md.min)} to ${num(ao.index.claude_md.max)} tokens in the measurement, set by the repository)`,
      `No median: ${fp.repos.filter((r) => r.commits <= 1).length} of the ${agg.repos} copies are one-commit clones, where every file is hot`,
      `${sp(ao.index.claude_md)} in \`CLAUDE.md\` and \`AGENTS.md\`, ${sp(ao.index.copilot)} in the Copilot file`,
      `${sp(ao['per-module'].claude_md)} in \`CLAUDE.md\` and \`AGENTS.md\`, ${sp(ao['per-module'].copilot)} in the Copilot file; about ${agg.per_module_fit.intercept} plus ${agg.per_module_fit.slope} per top-level module`,
      `${agg.per_module_lost_files} of ${agg.repos} repositories had a module lose some`,
      `identical under all four strategies on all ${agg.index_identical_under_all_strategies} repositories measured`,
      `SigMap itself and ${agg.repos - 1} clones from the benchmark corpus`,
      `the largest Copilot file measured (${fp.repos.reduce((x, y) => (y.full.copilot > x.full.copilot ? y : x)).repo}) was ${num(ao.full.copilot.max)} tokens`,
    ]) assert.ok(page.includes(want), `the page must say: ${want}`);
    assert.strictEqual(JSON.stringify(ao.index.claude_md), JSON.stringify(ao.index.agents_md), 'the page prints CLAUDE.md and AGENTS.md as one figure under index');
    assert.strictEqual(a !== undefined && agg.full_lost_nothing.length, 3, 'the page says "the three that lost none"');
    assert.strictEqual(agg.indexed_everything, agg.repos, 'every file with symbols was indexed on every repository');
    assert.strictEqual(agg.index_identical_under_all_strategies, agg.repos, 'the index entries were identical under all four strategies on every repository');
  });

  await test('1. the page carries no figure that the data does not give (the detail sections)', () => {
    const by = (n) => fp.repos.find((r) => r.repo === n);
    const sg = by('sigmap'); const rails = by('rails'); const svelte = by('svelte'); const django = by('django');
    const ask = sg.ask_tokens;
    const src = sg.per_module_files.find((m) => m.module === 'src');
    const point = (name, n) => fp.hot_cold_sweep[name].find((x) => x.hot_commits === n);
    const sweep = (name, n) => point(name, n).claude_md;
    const files = (n) => (n === 0 ? 'no hot file' : n === 1 ? 'one file' : `${n} files`);
    const list = (name, ns) => { const p = ns.map((n) => `${num(sweep(name, n))} (${point(name, n).hot_files} file${point(name, n).hot_files === 1 ? '' : 's'}) at ${num(n)}`); return p.length > 1 ? `${p.slice(0, -1).join(', ')} and ${p[p.length - 1]}` : p[0]; };
    const akkaFull = by('akka').full.claude_md;
    const hotSave = (name, r) => Math.round(100 * (1 - sweep(name, 10) / r.full.claude_md));
    const shallow = fp.repos.filter((r) => r.commits <= 1);
    const sMin = shallow.reduce((x, y) => (y.hot_cold.claude_md < x.hot_cold.claude_md ? y : x));
    const sMax = shallow.reduce((x, y) => (y.hot_cold.claude_md > x.hot_cold.claude_md ? y : x));
    const ao = agg.always_on;
    for (const want of [
      `${num(svelte.full.dropped)} of ${num(svelte.files_scanned)} on svelte, ${num(rails.full.dropped)} of ${num(rails.files_scanned)} on rails`,
      `on django (${num(django.files_scanned)} source files) they carry the signatures of ${django.full.sections.agents_md} and ${django.full.sections.claude_md} files where the Copilot file carries ${django.full.sections.copilot}`,
      `| Copilot file | ${num(sg.full.copilot)} tokens | ${num(sg.index.copilot)} tokens |`,
      `| \`CLAUDE.md\` | ${num(sg.full.claude_md)} tokens | ${num(sg.index.claude_md)} tokens |`,
      `| One \`sigmap ask\` on top | not needed | ${num(Math.min(...ask))} to ${num(Math.max(...ask))} tokens (four questions) |`,
      `(${num(sg.index.claude_md)} plus one \`ask\`, ${num(sg.index.claude_md + Math.min(...ask))} to ${num(sg.index.claude_md + Math.max(...ask))}) is no smaller than \`full\`'s whole \`CLAUDE.md\` (${num(sg.full.claude_md)})`,
      `(\`maxIndexSigsPerFile\`; ${fp.repos.filter((r) => r.index_cap).length} of the ${agg.repos} repositories had such a file, and on rails it was ${rails.index_cap.files} files and ${num(rails.index_cap.signatures)} signatures)`,
      `a median of ${num(ao['per-module'].claude_md.median)}, and ${num(ao['per-module'].claude_md.max)} at ${fp.repos.find((r) => r.per_module.claude_md === ao['per-module'].claude_md.max).modules} modules`,
      `SigMap's own \`src\` keeps ${src.files} files in \`context-src.md\` and loses ${sg.per_module.dropped}`,
      `that is ${Math.round(100 * (1 - ao['per-module'].claude_md.median / ao.full.claude_md.median))}% fewer than its \`CLAUDE.md\` (${num(ao.full.claude_md.median)}) and ${Math.round(100 * (1 - ao['per-module'].copilot.median / ao.full.copilot.median))}% fewer than its Copilot file (${num(ao['per-module'].copilot.median)} against ${num(ao.full.copilot.median)})`,
      `the always-on saving on this repository is about ${num(Math.round((sg.full.claude_md - sg.index.claude_md) / 50) * 50)} tokens`,
      `the saving is about ${num(Math.round((sg.full.copilot - sg.index.copilot) / 500) * 500)} tokens`,
      `\`CLAUDE.md\`, cut to about 200 lines, held ${fp.repos.filter((r) => r.full.dropped === 0).sort((x, y) => x.files_scanned - y.files_scanned).map((r) => r.full.sections.claude_md).join(', ').replace(/, (\d+)$/, ' and $1')} of the files`,
      `since flask, with ${by('flask').files_scanned}, lost ${by('flask').full.dropped}`,
      `\`CLAUDE.md\` was ${num(sweep('sigmap', 10))} tokens with no hot file at the default 10 commits and at 25, then ${list('sigmap', [50, 100, 250, 500, 1000])}`,
      `On akka it was ${num(sweep('akka', 10))} tokens (${files(point('akka', 10).hot_files)}) at 10, then ${list('akka', [25, 100, 250])}`,
      `at 250 commits it was about ${num(Math.round(sweep('akka', 250) / akkaFull / 5) * 5)} times \`full\`'s \`CLAUDE.md\` (${num(akkaFull)})`,
      `At the default that is ${Math.min(hotSave('akka', by('akka')), hotSave('sigmap', sg))}% to ${Math.max(hotSave('akka', by('akka')), hotSave('sigmap', sg))}% fewer tokens than \`full\`'s \`CLAUDE.md\``,
      `the last 10 commits held no source file, so the hot set was empty, and on akka, a corpus checkout whose commit is not recorded, it held ${files(point('akka', 10).hot_files)}`,
      `on the agent study's 222 questions the expected file was in its top five for 74.8%`,
      `across the ${shallow.length} one-commit clones the \`hot-cold\` \`CLAUDE.md\` was ${num(sMin.hot_cold.claude_md)} tokens for a ${sMin.files_scanned}-file repository (${sMin.repo}) and ${num(sMax.hot_cold.claude_md)} for ${sMax.repo} (${num(sMax.files_scanned)} files)`,
    ]) assert.ok(page.includes(want), `the page must say: ${want}`);
    assert.ok(point('sigmap', 10).hot_files === 0 && point('sigmap', 25).hot_files === 0, 'the page says SigMap has no hot file at 10 and at 25 commits');
    assert.ok(sweep('sigmap', 1000) > sweep('sigmap', 100) && sweep('sigmap', 100) > sweep('sigmap', 50), 'the hot set grows with the window');
    assert.ok(sweep('akka', 250) > 10 * akkaFull, 'akka at 250 commits is many times full');
    const pinned = read('docs-vp/index.md') + read('docs-vp/guide/choosing-a-setup.md');
    const figs = [...new Set([...page.split('\n').filter((l) => /Haiku|Sonnet|\(−1%/.test(l)).join('\n').matchAll(/[+−]\d+(?:\.\d+)?%|\d+(?:\.\d+)? points/g)].map((m) => m[0]))];
    assert.ok(figs.length >= 7, `the study figures found on the page: ${figs.join(' ')}`);
    for (const fg of figs) assert.ok(pinned.includes(fg), `${fg} is not a figure of docs-vp/index.md or choosing-a-setup.md, which setup-table.test.js pins`);
    assert.deepStrictEqual([...page.matchAll(/([+−]\d+)% with Haiku 4\.5/g)].map((m) => m[1]), ['−28', '−28'], 'both quotations of the Haiku 4.5 record');
    assert.ok(/\*\*166\s+\(74\.8%\) against 159/.test(read('docs-vp/guide/agent-study.md')), 'the 74.8% of 222 questions is the agent study' + 's figure');
    assert.ok(Math.min(...ask) + sg.index.claude_md >= sg.full.claude_md, 'the first index answer is no smaller than full CLAUDE.md');
    assert.ok(shallow.every((r) => r.hot_cold.hot_files === r.files_scanned), 'on a one-commit clone every file is hot');
  });

  // ---------------------------------------------------------------------------
  // 2. The behaviours the page states, by runs
  // ---------------------------------------------------------------------------
  await test('2. `index` writes a map with no signatures and tells the agent to run `sigmap ask`; the index holds every file', () => withProject(project('index'), (ctx) => {
    const r = ctx.sigmap();
    assert.strictEqual(r.status, 0, r.stderr.slice(-300));
    for (const f of ['CLAUDE.md', 'AGENTS.md', '.github/copilot-instructions.md']) {
      const t = ctx.read(f);
      assert.ok(t.includes('sigmap ask'), `${f} names sigmap ask`);
      assert.strictEqual(sections(t), 0, `${f} holds no signature sections under index`);
    }
    assert.strictEqual(Object.keys(JSON.parse(ctx.read('.context/sig-index.json')).files).length, 60, 'all 60 files are in the retrieval index');
  }));

  await test('2. the retrieval index has the same entries under all four strategies', () => {
    const hashes = ['full', 'index', 'per-module', 'hot-cold'].map((s) => withProject(project(s), (ctx) => { assert.strictEqual(ctx.sigmap().status, 0); return indexHash(ctx); }));
    assert.strictEqual(new Set(hashes).size, 1, `index entries differ between strategies: ${hashes.join(' ')}`);
  });

  // One tree, the config rewritten between runs: the budget orders files by modification time, so four projects created a few milliseconds apart keep slightly different
  // files of the same size on a file system with coarse timestamps (the Node 18 container found it: 1,813 to 1,821 tokens, the same 37 files dropped).
  await test('2. `sigmap --report` prices the single-file `full` layout whatever the strategy: on one tree its figures are the same under all four, and under `index` they describe a file that is not written', () => withProject(project('full'), (ctx) => {
    const setStrategy = (strategy) => fs.writeFileSync(path.join(ctx.dir, 'gen-context.config.json'), `${JSON.stringify({ ...JSON.parse(ctx.read('gen-context.config.json')), strategy })}\n`);
    const report = () => { const j = JSON.parse(ctx.sigmap('--report', '--json').stdout); delete j.timestamp; return j; };
    const by = {};
    for (const strategy of ['full', 'index', 'per-module', 'hot-cold']) { setStrategy(strategy); by[strategy] = report(); }
    assert.ok(by.full.droppedCount > 0 && by.full.coverage.score < 100, 'control: the report has something to say about this fixture');
    for (const strategy of ['index', 'per-module', 'hot-cold']) assert.deepStrictEqual(by[strategy], by.full, `--report --json under ${strategy} differs from full on the same tree`);
    setStrategy('index');
    assert.strictEqual(ctx.sigmap().status, 0);
    assert.strictEqual(sections(ctx.read('CLAUDE.md')), 0, 'control: the file index writes holds no signatures, so the report does not describe it');
  }));

  await test('2. with `autoMaxTokens` on (the default) `maxTokens` plays no part in the size of the context files; with it off it is the budget', () => withProject(project('full'), (ctx) => {
    const write = (cfg) => fs.writeFileSync(path.join(ctx.dir, 'gen-context.config.json'), `${JSON.stringify({ srcDirs: ['alpha', 'beta'], outputs: ['copilot'], strategy: 'full', ...cfg })}\n`);
    const copilot = () => ctx.read('.github/copilot-instructions.md');
    write({ maxTokens: 1000 }); const first = ctx.sigmap(); const small = copilot();
    write({ maxTokens: 20000 }); ctx.sigmap(); const large = copilot();
    assert.ok(/your maxTokens:1000 config was overridden by auto-scaled budget/.test(first.stderr), `the run says the pinned value was overridden: ${first.stderr.slice(-300)}`);
    assert.strictEqual(sections(small), sections(large), 'autoMaxTokens on: the same files whatever maxTokens says');
    assert.ok(Math.abs(tok(small) - tok(large)) <= 8, `autoMaxTokens on: ${tok(small)} against ${tok(large)} tokens`);
    write({ autoMaxTokens: false, maxTokens: 1000 }); ctx.sigmap(); const pinnedSmall = copilot();
    write({ autoMaxTokens: false, maxTokens: 20000 }); ctx.sigmap(); const pinnedLarge = copilot();
    assert.ok(sections(pinnedLarge) > sections(pinnedSmall) && sections(pinnedLarge) === 60, `autoMaxTokens off: maxTokens is the budget (${sections(pinnedSmall)} against ${sections(pinnedLarge)} of 60 files)`);
  }));

  await test('2. MCP `read_context({ module })` returns only the overview under `per-module`, and the cold files under `hot-cold`; `query_context` ranks across modules', () => {
    withProject(project('per-module'), (ctx) => {
      assert.strictEqual(ctx.sigmap().status, 0);
      assert.ok(/^### alpha\//m.test(ctx.read('.github/context-alpha.md')), 'control: the module file exists and holds alpha signatures (the budget keeps the most recent files, so not necessarily f0)');
      const forModule = ctx.mcp('read_context', { module: 'alpha' });
      assert.ok(forModule.length > 0 && !/^### /m.test(forModule) && !/alphaFn/.test(forModule), `read_context does not read the per-module file: ${forModule.slice(0, 120)}`);
      const overview = ctx.mcp('read_context', {});
      assert.ok(/Codebase overview/.test(overview) && !/^### /m.test(overview) && !/alphaFn|betaFn/.test(overview), 'read_context with no module returns the overview and no signatures');
      const both = ctx.mcp('query_context', { query: 'where are alphaFn5x2 and betaFn7x1 defined' });
      assert.ok(both.includes('alpha/f5.js') && both.includes('beta/f7.js'), 'query_context ranks files of both modules in one answer');
    });
    withProject(project('hot-cold', { hotCommits: 1 }), (ctx) => {
      ctx.git('add', '-A'); ctx.git('commit', '-qm', 'one');
      fs.appendFileSync(path.join(ctx.dir, 'alpha/f0.js'), '\n// touched\n');
      ctx.git('add', '-A'); ctx.git('commit', '-qm', 'two');
      assert.strictEqual(ctx.sigmap().status, 0);
      assert.ok(ctx.mcp('read_context', { module: 'beta' }).includes('beta/f5.js'), 'under hot-cold read_context returns the cold files');
    });
  });

  await test('2. a normal `index` run also prints the `budget: dropped N` line, which counts what `full` would drop', () => withProject(project('index'), (ctx) => {
    const r = ctx.sigmap();
    assert.ok(/\[sigmap\] budget: dropped \d+ file/.test(r.stderr), `the index run prints the line: ${r.stderr.slice(-300)}`);
    assert.strictEqual(sections(ctx.read('CLAUDE.md')), 0, 'and the file it wrote holds no signatures');
    assert.strictEqual(Object.keys(JSON.parse(ctx.read('.context/sig-index.json')).files).length, 60, 'and nothing was dropped from the index');
  }));

  await test('2. `full` drops files over its budget and the index still holds them', () => withProject(project('full'), (ctx) => {
    const r = ctx.sigmap();
    assert.ok(/\[sigmap\] budget: dropped \d+ file/.test(r.stderr), `the run says it dropped files: ${r.stderr.slice(-300)}`);
    const kept = sections(ctx.read('.github/copilot-instructions.md'));
    assert.ok(kept > 0 && kept < 60, `the Copilot file holds ${kept} of 60 files`);
    assert.strictEqual(Object.keys(JSON.parse(ctx.read('.context/sig-index.json')).files).length, 60);
  }));

  await test('2. `per-module` gives each module its own full budget, not a share of one pool', () => withProject(project('per-module'), (ctx) => {
    const r = ctx.sigmap();
    assert.strictEqual(r.status, 0);
    const a = tok(ctx.read('.github/context-alpha.md')); const b = tok(ctx.read('.github/context-beta.md'));
    // maxTokens is 2,000: a pool divided between two modules would leave each about 1,000; an own budget leaves each about 2,000 (the commands block and the header are inside it)
    assert.ok(a > 1100 && b > 1100 && a <= 2100 && b <= 2100, `module files are ${a} and ${b} tokens`);
    assert.strictEqual((r.stderr.match(/\[sigmap\] budget: dropped \d+ file/g) || []).length, 2, 'each module over its budget says so');
  }));

  await test('2. `hot-cold`: the cold files are in context-cold.md, the hot file holds only the files of the last commits, and `sigmap ask` returns a cold file with no MCP', () => withProject(project('hot-cold', { hotCommits: 1 }), (ctx) => {
    ctx.git('add', '-A'); ctx.git('commit', '-qm', 'one');
    fs.appendFileSync(path.join(ctx.dir, 'alpha/f0.js'), '\n// touched\n');
    ctx.git('add', '-A'); ctx.git('commit', '-qm', 'two');
    const r = ctx.sigmap();
    assert.strictEqual(r.status, 0, r.stderr.slice(-300));
    assert.ok(ctx.read('CLAUDE.md').includes('### alpha/f0.js') && !ctx.read('CLAUDE.md').includes('### beta/f5.js'), 'only the file of the last commit is hot');
    assert.ok(ctx.read('.github/context-cold.md').includes('### beta/f5.js'), 'the other files are cold');
    const ask = ctx.sigmap('ask', 'where is betaFn5x2 defined');
    assert.strictEqual(ask.status, 0, ask.stderr.slice(-300));
    assert.ok(ctx.read('.context/query-context.md').includes('beta/f5.js'), '`sigmap ask` returns the cold file, with no MCP server involved');
  }));

  await test('2. `hot-cold` has no token budget: a one-commit checkout makes every file hot and the file is many times maxTokens', () => withProject(project('hot-cold', { maxTokens: 1000 }), (ctx) => {
    ctx.git('add', '-A'); ctx.git('commit', '-qm', 'one');
    assert.strictEqual(ctx.sigmap().status, 0);
    const t = ctx.read('CLAUDE.md');
    assert.strictEqual(sections(t), 60, 'every file is hot');
    assert.ok(tok(t) > 3000, `${tok(t)} tokens under maxTokens 1,000`);
  }));

  await test('2. the host limits (AGENTS.md 32 KiB, CLAUDE.md about 200 lines) are applied under `full` and not under `hot-cold`', () => {
    const big = { maxTokens: 20000 };
    const dims = { alpha: 40, beta: 40, perFile: 10 };
    const sizes = (strategy) => withProject(project(strategy, big, dims), (ctx) => {
      if (strategy === 'hot-cold') { ctx.git('add', '-A'); ctx.git('commit', '-qm', 'one'); }
      assert.strictEqual(ctx.sigmap().status, 0);
      return { agents: Buffer.byteLength(ctx.read('AGENTS.md')), claudeLines: ctx.read('CLAUDE.md').split('\n').length };
    });
    const full = sizes('full'); const hot = sizes('hot-cold');
    assert.ok(full.agents <= 32 * 1024, `full: AGENTS.md is ${full.agents} bytes`);
    assert.ok(full.claudeLines <= 200, `full: CLAUDE.md is ${full.claudeLines} lines`);
    assert.ok(hot.agents > 32 * 1024, `hot-cold: AGENTS.md is ${hot.agents} bytes, over what Codex reads`);
    assert.ok(hot.claudeLines > 200, `hot-cold: CLAUDE.md is ${hot.claudeLines} lines, over what Claude Code asks for`);
  });

  // ---------------------------------------------------------------------------
  // 3. The pages that repeated the claims
  // ---------------------------------------------------------------------------
  await test('3. no page says what the fact-check found false: cold files need MCP, are invisible without it, per-module divides the budget, 4,000 tokens, 70% / 90% fewer', () => {
    const pages = ['docs-vp/guide/strategies.md', 'docs/readmes/CONTEXT_STRATEGIES.md', 'docs/readmes/GETTING_STARTED.md', 'docs-vp/guide/troubleshooting.md', 'docs-vp/guide/config.md'];
    const STALE = [
      [/Cold files require MCP/i, 'cold files do not require MCP'],
      [/Yes for cold|Yes \(for cold\)/i, 'the MCP column says no for hot-cold'],
      [/completely invisible|never seen by the model|is COLD, invisible/i, 'a cold file is reachable with sigmap ask'],
      [/maxTokens ÷ number_of_modules|divided equally across modules/i, 'each module has its own budget'],
      [/~4,000 tokens\s*\|/, 'the table figure ~4,000 tokens came from one example project'],
      [/~?70% fewer injected tokens|~?90% fewer always-on tokens|98–99\.5%|97–99%\*\* per question|Token reduction: \*\*90–96%\*\*/, 'unmeasured reduction percentages'],
      [/\*\*No context loss\.\*\*|\*\*No context loss\. No MCP needed\.\*\*/, 'full and per-module lose files over their budget'],
      [/\bthree output strategies\b/i, 'there are four strategies'],
      [/Default for all IDEs and onboarding/, 'the pre-v8.88.0 best-fit cell'],
      [/~?90% fewer always-injected tokens|\(cold files, MCP only\)|Ensure MCP is working|Test MCP retrieval of cold context/, 'unmeasured percentage, and cold files need no MCP'],
      [/^1\. Test files first\s*$|test files first, then config/i, 'the budget drops generated files first, then mocks, tests and config'],
      [/ask MCP `read_context\(\{ module: "<dir>" \}\)` for it|\(or MCP `read_context`\) load only|\(or the model via MCP\) loads|MCP `read_context\(\{ module: "server" \}\)` returns the signatures/, 'read_context does not return a per-module file'],
      [/is a floor|A floor:|as a minimum floor/, 'maxTokens is not a floor: with autoMaxTokens on it is not used'],
      [/The one measured record for `full`|the one setup with an agent study/, 'full has two measured records and index is not the only studied setup'],
      [/recently committed files are pinned and never dropped|are protected from token-budget drops/i, 'diffPriority only orders files; nothing is pinned'],
      [/older files are served on demand via MCP|retrieved on\s+demand via MCP|Either raise `maxTokens` in config/i, 'cold files are also reachable with sigmap ask; maxTokens is not the lever by default'],
    ];
    for (const old of ['Typically 70% fewer injected tokens than `full`.', 'Achieves ~90% fewer always-on tokens when using Claude Code or Cursor with MCP enabled.', 'Token reduction: **98–99.5%** on active sessions.', 'Token reduction: **97–99%** per question (AI reads only the relevant module).', 'Token reduction: **90–96%**', 'recently committed files are pinned and never dropped']) assert.ok(STALE.some(([re]) => re.test(old)), `no STALE pattern matches the old line: ${old}`);
    const bad = [];
    for (const rel of pages) {
      const lines = read(rel).split('\n');
      lines.forEach((line, i) => { for (const [re, why] of STALE) if (re.test(line)) bad.push(`${rel}:${i + 1}: ${line.trim().slice(0, 90)}  (${why})`); });
    }
    assert.deepStrictEqual(bad, [], `these lines repeat a claim the fact-check found false:\n${bad.join('\n')}`);
  });

  await test('3. the corrected claims are on the pages', () => {
    assert.ok(/Cold files do not need MCP/.test(page) && /The hot set has no cap/.test(page) && /Each module gets its own full budget/.test(page));
    assert.ok(/plays no part in the size of the context files/.test(page) && /returns only the overview under `per-module`/.test(page) && /−28% with Haiku 4\.5/.test(page), 'the page says what maxTokens does by default, what read_context returns under per-module, and both records of the old default');
    assert.ok(/`sigmap --report` does not measure this/.test(page) && /always prices the single-file `full` layout, whatever the strategy/.test(page), 'the page says what --report measures');
    assert.ok(/always prices the single-file `full` layout, whatever the strategy/.test(read('docs-vp/guide/troubleshooting.md')), 'troubleshooting says --report does not change with the strategy');
    const legacy = read('docs/readmes/CONTEXT_STRATEGIES.md');
    assert.ok(/Each module gets its own full budget/.test(legacy) && /four output strategies/.test(legacy) && /sigmap ask "<question>"/.test(legacy));
    assert.ok(/MCP.*not required|No \(`sigmap ask` returns cold files/.test(legacy), 'the legacy readme says MCP is not needed for cold files');
    assert.ok(/no token cap|has no cap/.test(read('docs-vp/guide/troubleshooting.md')) && /no token cap/.test(read('docs-vp/guide/config.md')));
  });

  await test('3. the repository links on the strategies page resolve to files that exist', () => {
    const links = [...page.matchAll(/https:\/\/github\.com\/manojmallick\/sigmap\/blob\/main\/([^)\s#]+)/g)].map((m) => m[1]);
    assert.ok(links.length >= 1, 'control: the page has a repository link');
    const missing = links.filter((p) => !fs.existsSync(path.join(ROOT, p)));
    assert.deepStrictEqual(missing, [], `these links point at files that are not in the repository: ${missing.join(', ')}`);
  });

  // ---------------------------------------------------------------------------
  // 4. The script
  // ---------------------------------------------------------------------------
  await test('4. the script runs from the command line on a repository and writes a record of the shape the page is pinned to', () => withProject(project('full'), (ctx) => {
    ctx.git('add', '-A'); ctx.git('commit', '-qm', 'one');
    const out = path.join(ctx.dir, '..', `footprint-${process.pid}.json`);
    try {
      const r = spawnSync(process.execPath, [SCRIPT, '--repo', ctx.dir, '--out', out], { cwd: ROOT, encoding: 'utf8', env: ctx.env, timeout: 300000 });
      assert.strictEqual(r.status, 0, (r.stderr + r.stdout).slice(-400));
      const j = JSON.parse(fs.readFileSync(out, 'utf8'));
      const rec = j.repos[0];
      assert.strictEqual(rec.files_scanned, 60);
      assert.deepStrictEqual(rec.indexed, { n: 60, of: 60 });
      assert.strictEqual(rec.index_identical, true, 'the index is identical under all four strategies');
      assert.ok(rec.index.claude_md > 0, 'the map is not empty');
      assert.strictEqual(rec.index.sections.claude_md, 0, 'index carries no signature sections');
      assert.strictEqual(rec.hot_cold.hot_files, 60, 'one commit: every file is hot'); assert.ok(rec.per_module.on_demand > 0);
      assert.strictEqual(JSON.parse(r.stdout).repos, 1, 'the printed aggregate is aggregate(records)');
    } finally { fs.rmSync(out, { force: true }); }
  }));

  await test('4. a hot-cold sweep point with fewer hot files than a smaller window is marked invalid (the git log read failed), the committed sweeps carry that mark, and the page quotes no invalid point', async () => {
    const { flagInvalidSweep } = await loadScript();
    const probe = flagInvalidSweep([{ hot_commits: 1, hot_files: 0 }, { hot_commits: 10, hot_files: 5 }, { hot_commits: 100, hot_files: 40 }, { hot_commits: 1000, hot_files: 0 }]);
    assert.deepStrictEqual(probe.map((p) => !!p.invalid), [false, false, false, true], 'only a point after a non-empty smaller window is flagged');
    for (const [name, pts] of Object.entries(fp.hot_cold_sweep)) assert.deepStrictEqual(flagInvalidSweep(pts), pts, `${name}: the committed sweep carries the marks the script would add`);
    assert.ok(fp.hot_cold_sweep.akka.some((p) => p.invalid), 'control: the akka sweep has a point that failed');
    const quoted = { sigmap: [10, 25, 50, 100, 250, 500, 1000], akka: [10, 25, 100, 250] };
    for (const [name, ns] of Object.entries(quoted)) for (const n of ns) assert.ok(!fp.hot_cold_sweep[name].find((p) => p.hot_commits === n).invalid, `the page quotes ${name} at ${n} commits, which is marked invalid`);
  });

  await test('4. `aggregate` is a pure function of the records: the committed file gives the same figures twice, and a spread has min <= median <= max', () => {
    assert.deepStrictEqual(aggregate(fp.repos), aggregate(JSON.parse(JSON.stringify(fp.repos))));
    for (const s of Object.values(agg.always_on)) for (const x of Object.values(s)) assert.ok(x.min <= x.median && x.median <= x.max && x.n === agg.repos);
  });

  console.log(`\nstrategies-page: ${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
