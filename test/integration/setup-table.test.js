'use strict';

/**
 * The home page's "Which setup for which job" table (#1090), and the claims it leans on.
 *
 * A table that says which config to set for which job is a promise, so every cell is tied to what it rests on, and the table says what has no measurement:
 *
 *   - the tool counts, tool names and chars/4 sizes: src/mcp/profile.js, by resolveProfile; the API-counter sizes are the study's and are pinned to `sigmap advise`;
 *   - what `sigmap --init` writes, what `hooks install` accepts and installs, that the hook is opt-in, needs an index and no MCP server, is capped at about
 *     8 KiB, never refreshes the index, that `query_context` does not refresh it either and what does (`--watch`, the post-commit hook), what `sigmap advise`
 *     writes, and what a bare `sigmap` writes: by runs in a fixture;
 *   - every study figure the table prints: recomputed from the committed data by the scripts the guide cites (benchmarks/agent-study/summarize.mjs,
 *     confirm-bar.mjs, the by-goal table in data/setup-signal-eval.txt and data/runs.ndjson), not copied from the guide;
 *   - the pages the table leans on no longer carry the claims a fact-check against the code and the data found false (2026-11-23): "index alone" for the
 *     seven-tool arm, "checks less", "the ceiling", "unseen", "none cost more", the hook's size, speed and failure modes, "writes nothing into your
 *     repository", and `sigmap advise` "writes nothing".
 *
 * What it cannot do: judge whether a setup suits a reader's project (nothing offline predicts that, and the table says so), time the hook (no script
 * does; the speed in cli.md is a hand timing, said so there), or run the stalled-`extends` case (host-specific; the cache time is pinned instead).
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const { spawn, spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..', '..');
let passed = 0;
let failed = 0;
async function test(name, fn) {
  try { await fn(); console.log(`  PASS  ${name}`); passed++; } catch (err) { console.log(`  FAIL  ${name}: ${err.message}`); failed++; }
}

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const hyphen = (s) => s.replace(/−/g, '-'); // the pages print U+2212 for a minus; the scripts print a hyphen
const minus = (n) => (n < 0 ? `−${Math.abs(n)}%` : `+${n}%`); // the way the pages print a signed whole percentage
const num = (n) => n.toLocaleString('en-US');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const script = (name, ...args) => {
  const r = spawnSync(process.execPath, [path.join(ROOT, 'benchmarks', 'agent-study', name), ...args], { cwd: path.join(ROOT, 'benchmarks', 'agent-study'), encoding: 'utf8', timeout: 120000 });
  assert.strictEqual(r.status, 0, `${name} ${args.join(' ')}: ${(r.stdout + r.stderr).slice(-300)}`);
  return r.stdout;
};

/** A project with its own git root and home (no inherited GIT_* variables), SigMap run in it, and one MCP session per call. */
function withProject(files, fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-setup-'));
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-setup-home-'));
  const finish = () => { fs.rmSync(dir, { recursive: true, force: true }); fs.rmSync(home, { recursive: true, force: true }); };
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^GIT_/.test(k)));
  Object.assign(env, { HOME: home, USERPROFILE: home, CODEX_HOME: path.join(home, '.codex') });
  const setup = () => {
    for (const [rel, body] of Object.entries(files)) {
      fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
      fs.writeFileSync(path.join(dir, rel), body);
    }
    spawnSync('git', ['init', '-q', dir], { env, stdio: 'ignore' });
    const sigmap = (...args) => spawnSync(process.execPath, [path.join(ROOT, 'gen-context.js'), ...args], { cwd: dir, encoding: 'utf8', env, timeout: 90000 });
    const git = (...args) => spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd: dir, encoding: 'utf8', env });
    const mcp = (name, args = {}) => {
      const input = [{ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 't', version: '0' } } }, { jsonrpc: '2.0', method: 'notifications/initialized' }, { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name, arguments: args } }].map((m) => JSON.stringify(m)).join('\n') + '\n';
      const r = spawnSync(process.execPath, [path.join(ROOT, 'gen-context.js'), '--mcp'], { cwd: dir, encoding: 'utf8', env, input, timeout: 90000 });
      try { return JSON.parse(r.stdout.trim().split('\n').pop()).result.content[0].text; } catch (_) { return `${r.stdout}${r.stderr}`; }
    };
    const hook = (prompt, session) => spawnSync(process.execPath, [path.join(ROOT, 'gen-context.js'), 'session', 'hook', 'UserPromptSubmit'], { cwd: dir, encoding: 'utf8', env, input: JSON.stringify({ session_id: session, prompt, cwd: dir, hook_event_name: 'UserPromptSubmit' }) });
    const readFile = (rel) => { try { return fs.readFileSync(path.join(dir, rel), 'utf8'); } catch (_) { return ''; } };
    const exists = (rel) => fs.existsSync(path.join(dir, rel));
    return { dir, env, sigmap, git, mcp, hook, read: readFile, exists };
  };
  let result;
  try { result = fn(setup()); } catch (e) { finish(); throw e; }
  if (result && typeof result.then === 'function') return result.finally(finish);
  finish();
  return result;
}

const SRC = { 'src/a.js': 'function alpha(x) { return x; }\nmodule.exports = { alpha };\n' };
const LOCATE = '{"srcDirs":["src"],"outputs":["copilot"],"strategy":"index","mcp":{"tools":"locate"}}\n';
/** Eight files of forty functions each, all named like the prompt: the hook's block is cut at its cap. */
const BIG = { 'gen-context.config.json': LOCATE };
for (let f = 0; f < 8; f++) {
  const names = Array.from({ length: 40 }, (_, i) => `rankerScoreCandidate${f}x${i}`);
  BIG[`src/ranker${f}.js`] = `${names.map((n) => `function ${n}(queryTokens, candidate, weights) { return queryTokens.length + candidate + weights; }`).join('\n')}\nmodule.exports = { ${names.join(', ')} };\n`;
}
const BIG_PROMPT = 'where is the ranker score candidate function implemented for query tokens';
/** Every file under `dir` outside `.git` and `.context`, with its content: what a command changed in the project's own tree. */
const tree = (dir) => {
  const out = {};
  const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { if (['.git', '.context'].includes(e.name)) continue; const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else out[path.relative(dir, p)] = fs.readFileSync(p, 'utf8'); } };
  walk(dir);
  return out;
};

(async () => {
  const cb = await import('../../benchmarks/agent-study/confirm-bar.mjs');
  const { resolveProfile } = require(path.join(ROOT, 'src', 'mcp', 'profile.js'));
  const { NOT_CHECKED } = require(path.join(ROOT, 'src', 'verify', 'coverage.js'));
  const profile = Object.fromEntries(['locate', 'core', 'all'].map((n) => [n, resolveProfile({ mcp: { tools: n } })]));
  const runs = () => read('benchmarks/agent-study/data/runs.ndjson').trim().split('\n').map(JSON.parse);

  const home = read('docs-vp/index.md');
  const start = home.indexOf('## Which setup for which job');
  const section = start >= 0 ? home.slice(start, home.indexOf('</div>', start)) : '';
  const rows = section.split('\n').filter((l) => /^\| \*\*/.test(l));
  const row = (re) => rows.find((r) => re.test(r.split(' | ')[0])) || '';
  const [askRow, coreRow, hookRow, noneRow, adviseRow] = [row(/Ask where something is implemented/), row(/check impact and verify suggestions/), row(/Cut time and tokens/), row(/Nothing to decide/), row(/Find out for your project/)];
  const choosing = read('docs-vp/guide/choosing-a-setup.md');

  await test('the home page has the table: five rows, the caveats that make rows incomparable, and a link to the guide that holds the sources', () => {
    assert.ok(start >= 0, 'the home page has a "Which setup for which job" section');
    assert.strictEqual(rows.length, 5, `five rows, found ${rows.length}`);
    const table = section.split('\n').filter((l) => l.startsWith('|'));
    assert.ok(/^\| If you want to… \| Set this \| What was measured \|$/.test(table[0]) && /^\|---\|---\|---\|$/.test(table[1]) && table.length === 7, 'a header, a separator and five rows, with no blank line inside the table (a blank line would render two tables)');
    assert.ok(section.indexOf(table[0]) < section.indexOf(table[table.length - 1]) && section.slice(section.indexOf(table[0]), section.indexOf(table[table.length - 1]) + table[table.length - 1].length).split('\n').every((l) => l.startsWith('|')), 'the table is one block');
    for (const r of rows) assert.strictEqual(r.split(/ \| /).length, 3, `three cells in: ${r.slice(0, 60)}`); // no cell holds an unescaped pipe
    assert.ok(section.indexOf(askRow) < section.indexOf(coreRow) && section.indexOf(coreRow) < section.indexOf(hookRow), '"the two above" in the core row points at the locate row, so it stays below it');
    for (const [name, r] of Object.entries({ askRow, coreRow, hookRow, noneRow, adviseRow })) assert.ok(r, `the ${name} is there`);
    assert.ok((section.match(/\(\/guide\/choosing-a-setup\)/g) || []).length >= 2 && section.includes('(/guide/agent-study)'), 'it links Choosing a setup and the agent study');
    assert.ok(/The rows were not run against each other/.test(section) && /No agent run exists for `per-module`, `hot-cold` or `monorepo`/.test(section) && /Editing: one stage ran and could not judge patches/.test(section), 'it says the rows are not comparable, and what has no measurement');
    assert.ok(/No offline signal the study tried passed its test for predicting which repositories save \(twenty repositories are too few to rule one out\)/.test(section), 'and says nothing offline predicts the saving, with the limit of that test');
  });

  await test('the tool counts, names and sizes in the table are what src/mcp/profile.js computes (chars/4), and the API-counter sizes are the study\'s', () => {
    assert.deepStrictEqual([profile.locate.names.length, profile.core.names.length, profile.all.names.length], [2, 7, 22]);
    assert.strictEqual(profile.locate.names.join(), 'query_context,get_lines');
    assert.ok(askRow.includes(`Two tools, \`query_context\` and \`get_lines\` (about ${profile.locate.tokens} tokens of definitions by chars/4; 426 on the API's own counter, which the study's figures use)`) && profile.locate.tokens === 278, `locate: ${profile.locate.tokens}`);
    const extra = profile.core.names.filter((n) => !profile.locate.names.includes(n)).sort((a, b) => coreRow.indexOf(a) - coreRow.indexOf(b)).map((n) => `\`${n}\``);
    assert.ok(coreRow.includes(`Seven tools: the two above plus ${extra.slice(0, -1).join(', ')} and ${extra[extra.length - 1]} (about ${profile.core.tokens} tokens by chars/4; 1,505 on the API's own counter)`) && profile.core.tokens === 953, `core: ${extra.join(', ')} and ${profile.core.tokens} tokens`);
    assert.ok(noneRow.includes(`all 22 tools (about ${num(profile.all.tokens)} tokens of definitions by chars/4)`) && profile.all.tokens === 2561, `all: ${profile.all.tokens}`);
    for (const name of ['locate', 'core', 'all']) {
      const listed = withProject({ ...SRC, 'gen-context.config.json': JSON.stringify({ srcDirs: ['src'], outputs: ['copilot'], mcp: { tools: name } }) }, (ctx) => {
        const input = [{ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 't', version: '0' } } }, { jsonrpc: '2.0', method: 'notifications/initialized' }, { jsonrpc: '2.0', id: 2, method: 'tools/list' }].map((m) => JSON.stringify(m)).join('\n') + '\n';
        const r = spawnSync(process.execPath, [path.join(ROOT, 'gen-context.js'), '--mcp'], { cwd: ctx.dir, encoding: 'utf8', env: ctx.env, input, timeout: 90000 });
        return JSON.parse(r.stdout.trim().split('\n').pop()).result.tools;
      });
      assert.deepStrictEqual(listed.map((t) => t.name).sort(), [...profile[name].names].sort(), `the running server (gen-context.js --mcp) advertises the ${name} profile resolveProfile computes`);
      assert.strictEqual(Math.ceil(JSON.stringify(listed).length / 4), profile[name].tokens, `and its tools/list is ${profile[name].tokens} tokens by chars/4`);
    }
    const advise = read('src/advise/advise.js');
    assert.ok(advise.includes('426') && advise.includes('1,505'), '`sigmap advise` prints the API-counter sizes the table quotes (they need the API and cannot be recomputed offline)');
  });

  await test('`sigmap --init` writes the pair the first row shows, adds the CLAUDE.md block, builds no index, registers no client and installs no hook (a run)', () => {
    const shown = JSON.parse(askRow.match(/`(\{ "strategy": "index", "mcp": \{ "tools": "locate" \} \})`/)[1]);
    withProject(SRC, (ctx) => {
      const r = ctx.sigmap('--init');
      assert.strictEqual(r.status, 0, `${r.stdout}${r.stderr}`.slice(-300));
      const cfg = JSON.parse(ctx.read('gen-context.config.json'));
      assert.strictEqual(cfg.strategy, shown.strategy);
      assert.strictEqual(cfg.mcp.tools, shown.mcp.tools);
      assert.deepStrictEqual([...cfg.outputs].sort(), ['claude', 'codex', 'copilot', 'gemini'], '--init lists copilot, codex, claude and gemini in outputs');
      assert.ok(/Creation workflow/.test(ctx.read('CLAUDE.md')), '--init adds the "Creation workflow" block to CLAUDE.md, which the measured runs did not have');
      assert.ok(!ctx.exists('.context/sig-index.json'), '--init builds no index');
      assert.ok(/No signatures indexed|No context file/.test(ctx.mcp('query_context', { query: 'alpha' })), 'so the tools answer nothing until `sigmap` runs');
      assert.ok(!ctx.exists('.mcp.json') && !ctx.exists('.claude'), 'and --init registers no client and installs no hook (the hook is opt-in)');
    });
    assert.ok(/`--init` also lists copilot, codex, claude and gemini in `outputs`, so `sigmap` writes `CLAUDE.md`, as in the measured runs, and adds a short "Creation workflow" block to it, which they did not have/.test(askRow), 'and the row says so');
  });

  await test('`query_context` does not refresh the index; `sigmap --watch` and the post-commit hook do (runs)', async () => {
    const edited = (n) => `function zebraQuokka${n}(x) { return x; }\nmodule.exports = { zebraQuokka${n} };\n`;
    const query = (ctx, n) => ctx.mcp('query_context', { query: `zebraQuokka${n}` });
    await withProject({ ...SRC, 'gen-context.config.json': LOCATE }, async (ctx) => {
      ctx.sigmap();
      fs.writeFileSync(path.join(ctx.dir, 'src', 'later.js'), edited('A'));
      const before = query(ctx, 'A');
      assert.ok(/No matching files found/.test(before) && !/\| 1 \| src\/later\.js \|/.test(before), `not found before \`sigmap\` runs again: ${before.slice(0, 200)}`); // the stale-index banner names the file, which is not a result
      ctx.sigmap();
      assert.ok(/\| 1 \| src\/later\.js \|/.test(query(ctx, 'A')), 'ranked first after it');
      // `sigmap --watch` keeps it current as you save
      const watcher = spawn(process.execPath, [path.join(ROOT, 'gen-context.js'), '--watch'], { cwd: ctx.dir, env: ctx.env, stdio: 'ignore' });
      try {
        await sleep(2500);
        fs.writeFileSync(path.join(ctx.dir, 'src', 'watched.js'), edited('B'));
        const deadline = Date.now() + 25000;
        while (Date.now() < deadline && !ctx.read('.context/sig-index.json').includes('zebraQuokkaB')) await sleep(300);
        assert.ok(ctx.read('.context/sig-index.json').includes('zebraQuokkaB'), '--watch put the new file in the index while it ran');
      } finally { watcher.kill('SIGTERM'); await sleep(300); }
      // the post-commit hook `sigmap --setup` installs refreshes it after each commit
      require(path.join(ROOT, 'src', 'util', 'post-commit-hook.js')).installPostCommitHook(ctx.dir, path.join(ROOT, 'gen-context.js'));
      fs.writeFileSync(path.join(ctx.dir, 'src', 'committed.js'), edited('C'));
      assert.ok(!ctx.read('.context/sig-index.json').includes('zebraQuokkaC'), 'not before the commit');
      ctx.git('add', '-A'); const c = ctx.git('commit', '-q', '-m', 'c');
      assert.strictEqual(c.status, 0, c.stderr);
      assert.ok(ctx.read('.context/sig-index.json').includes('zebraQuokkaC'), 'the commit refreshed it');
    });
    assert.ok(/`query_context` does not refresh the index, so run `sigmap` again after edits \(`sigmap --watch` or `sigmap daemon start` keeps it current as you save; the post-commit hook that `sigmap --setup` installs refreshes it after each commit\)/.test(askRow), 'and the row says so');
    assert.ok(/daemon start\|stop\|status/.test(read('gen-context.js')), 'the daemon the row names exists');
  });

  await test('the prefetch hook installs for Claude Code only, with two session hooks (a run); the summary they hand over is capped at 400 tokens (code)', () => {
    withProject(SRC, (ctx) => {
      for (const client of ['cursor', 'windsurf', 'copilot', 'codex', 'gemini', 'opencode', 'vscode', 'zed', 'cline', 'aider']) {
        const other = ctx.sigmap('hooks', 'install', client, '--prefetch');
        assert.strictEqual(other.status, 1, `${client}`);
        assert.ok(/usage: sigmap hooks install claude/.test(other.stderr) && !ctx.exists('.claude'), `${client}: the usage line, and nothing written`);
      }
      const plain = ctx.sigmap('hooks', 'install', 'claude');
      assert.strictEqual(plain.status, 0, `${plain.stdout}${plain.stderr}`.slice(-300));
      assert.deepStrictEqual(Object.keys(JSON.parse(ctx.read('.claude/settings.local.json')).hooks).sort(), ['SessionEnd', 'SessionStart'], 'without --prefetch there is no UserPromptSubmit hook: the prefetch hook is opt-in');
      const r = ctx.sigmap('hooks', 'install', 'claude', '--prefetch');
      assert.strictEqual(r.status, 0, `${r.stdout}${r.stderr}`.slice(-300));
      assert.deepStrictEqual(Object.keys(JSON.parse(ctx.read('.claude/settings.local.json')).hooks).sort(), ['SessionEnd', 'SessionStart', 'UserPromptSubmit']);
    });
    assert.ok(/const MAX_TOKENS = 400;/.test(read('src/session/summary.js')) && /hand the model a summary of the last one \(up to 400 tokens\)/.test(hookRow), 'the session summary the row mentions is capped at 400 tokens');
    assert.ok(/\(Claude Code only\)/.test(row(/Cut time and tokens/)) && /No other agent has a hook installer; `sigmap ask` prints the same ranking for any agent to paste/.test(hookRow));
    withProject(SRC, (ctx) => { ctx.sigmap(); assert.ok(/src\/a\.js/.test(ctx.sigmap('ask', 'where is alpha defined').stdout), '`sigmap ask` prints a ranking'); });
  });

  await test('the hook: needs an index, needs no MCP server, never refreshes the index, and is cut at about 8 KiB (runs)', () => {
    withProject(BIG, (ctx) => {
      assert.strictEqual(ctx.hook(BIG_PROMPT, 's-noindex').stdout, '', 'no index: it prints nothing');
      assert.ok(!ctx.exists('.context'), 'and writes nothing');
      ctx.sigmap();
      assert.ok(!ctx.exists('.mcp.json'), 'control: no MCP server is registered');
      const out = JSON.parse(ctx.hook(BIG_PROMPT, 's-cap').stdout).hookSpecificOutput;
      const bytes = Buffer.byteLength(out.additionalContext);
      assert.strictEqual(out.hookEventName, 'UserPromptSubmit');
      assert.ok(bytes > 6000 && bytes <= 8 * 1024 + 64, `the block is cut at its cap, not by the fixture's size: ${bytes} bytes`);
      assert.ok(/left out to keep this short/.test(out.additionalContext), 'and says what it left out');
    });
    withProject({ ...SRC, 'src/b.js': 'function beta(x) { return x; }\nmodule.exports = { beta };\n' }, (ctx) => {
      ctx.sigmap();
      fs.writeFileSync(path.join(ctx.dir, 'src', 'zeta.js'), 'function zetaQuasarWidget(x) { return x; }\nmodule.exports = { zetaQuasarWidget };\n');
      const fired = ctx.hook('where is zetaQuasarWidget defined in this project', 's-stale');
      assert.strictEqual(fired.status, 0);
      const text = fired.stdout ? JSON.parse(fired.stdout).hookSpecificOutput.additionalContext : '';
      assert.ok(!/zeta/i.test(text) && !/older than|stale/i.test(text), 'a file added after the last `sigmap` run is not ranked, and the hook does not say the index is stale');
    });
    assert.ok(/run `sigmap` first and again after edits \(the hook never refreshes the index and does not warn when it is stale\), then restart Claude Code/.test(hookRow) && /on each substantive prompt it puts up to five ranked files in front of the model \(at most about 8 KiB each\), and it needs no MCP server/i.test(hookRow), 'and the row says so');
  });

  await test('`sigmap advise` writes nothing in the project tree, and given git history to rank its first run builds a cache under `.context/` (a run)', () => {
    withProject({ ...SRC, 'gen-context.config.json': LOCATE }, (ctx) => {
      for (let i = 1; i <= 10; i++) {
        fs.writeFileSync(path.join(ctx.dir, 'src', `f${i}.js`), `function feature${i}(x) { return x + ${i}; }\nmodule.exports = { feature${i} };\n`);
        ctx.git('add', '-A'); ctx.git('commit', '-q', '-m', `add the feature number ${i} request parsing handler for retries`);
      }
      ctx.sigmap();
      assert.ok(!ctx.exists('.context/body-words.json'), 'control: the cache is not there before advise runs');
      const before = tree(ctx.dir);
      const r = ctx.sigmap('advise');
      assert.strictEqual(r.status, 0, `${r.stdout}${r.stderr}`.slice(-300));
      assert.ok(/Questions mined from your git history[^\n]*: \d+/.test(r.stdout), 'it ranked questions mined from the history');
      assert.deepStrictEqual(tree(ctx.dir), before, 'nothing outside .git and .context changed');
      assert.ok(ctx.exists('.context/body-words.json'), 'the first run builds its derived cache under .context/');
      assert.ok(/it makes no call and prints no saving/.test(r.stdout) && /rho -0\.13/.test(r.stdout), 'and prints that it makes no call and that its numbers did not predict the saving');
    });
    assert.ok(/makes no model call and writes nothing in your source tree \(given git history to rank, its first run builds a derived cache under `\.context\/`\); it is offline unless your config `extends` a remote URL/.test(adviseRow) && /did not pass the test for predicting which repositories save/.test(adviseRow));
  });

  await test('a bare `sigmap` writes only .github/copilot-instructions.md and a config written by an older `--init` said full plus core (runs, changelog)', () => {
    withProject(SRC, (ctx) => {
      ctx.sigmap();
      const written = Object.keys(tree(ctx.dir)).filter((p) => !p.startsWith('src/')).sort();
      assert.deepStrictEqual(written, ['.github/copilot-instructions.md'], 'the files outside src/ after a run with no config');
      assert.ok(!ctx.exists('.mcp.json'), 'registers nothing');
      assert.ok(/strategy {8,}: full/.test(ctx.sigmap('--health').stdout), 'strategy full');
    });
    assert.ok(/it started on `full` plus `core`/.test(read('CHANGELOG.md')) && /a config written by an older `--init` says `full` plus `core`, which was not measured/.test(noneRow));
  });

  await test('the study figures in the table are the committed data\'s: the Messages-API agent rows (data/setup-signal-eval.txt, by repository)', () => {
    const byGoal = {};
    const saved = read('benchmarks/agent-study/data/setup-signal-eval.txt');
    for (const m of saved.matchAll(/^\| (cost|time|tokens) \| `(index|prefetch|locate)` \| (\d+) \| (\d+) \| (\d+) \| ([+-]?\d+)% \[([+-]?\d+)%, ([+-]?\d+)%\] \|$/gm)) (byGoal[m[1]] = byGoal[m[1]] || {})[m[2]] = { saves: Number(m[3]), none: Number(m[4]), more: Number(m[5]), point: Number(m[6]), lo: Number(m[7]), hi: Number(m[8]) };
    assert.strictEqual(Object.keys(byGoal).length, 3, 'control: the table of the saved test has cost, time and tokens');
    const p = (goal, setup) => byGoal[goal][setup].point;
    assert.ok(askRow.includes(`In the Messages-API agent (Haiku 5.5, 20 repositories; another loop): cost ${minus(p('cost', 'locate'))}, time ${minus(p('time', 'locate'))}, total tokens ${minus(p('tokens', 'locate'))}; time and tokens were not part of the Claude Code bar`), 'locate, cost / time / tokens');
    assert.ok(!Object.keys(cb.BAR).some((k) => /time|token/i.test(k)), 'the Claude Code bar (B1 to B4) has no time or token clause');
    assert.ok(coreRow.includes(`saved no cost (${minus(p('cost', 'index'))}) and used ${p('tokens', 'index')}% more total tokens (Messages-API agent, Haiku 5.5)`), 'index plus core, cost and tokens');
    const pf = byGoal.cost.prefetch;
    assert.ok(hookRow.includes(`Messages-API agent, 20 repositories: time ${minus(p('time', 'prefetch'))}, tokens ${minus(p('tokens', 'prefetch'))}, cost ${minus(pf.point)} [${minus(pf.lo)}, ${minus(pf.hi)}], and some repositories cost more (up to +31%)`), 'the same text in the prompt');
    assert.ok(saved.includes('cluster-api-provider-proxmox') && /\| \+31% C \|/.test(saved), 'the worst repository: +31%, and its interval lies above zero (C)');
    // the guide's own table, "The short answer, by goal", is the same data: every row's figures are rebuilt from the saved table
    const iv = (g, s) => `[${minus(byGoal[g][s].lo)}, ${minus(byGoal[g][s].hi)}]`;
    const wantRows = [
      `| **Time** | the prefetch route | time **${minus(p('time', 'prefetch'))}** ${iv('time', 'prefetch')}, and **${byGoal.time.prefetch.saves} of the 20 repositories** saved time; no repository was slower |`,
      `| **Total tokens** | the prefetch route | **${minus(p('tokens', 'prefetch'))}** ${iv('tokens', 'prefetch')}; ${byGoal.tokens.prefetch.saves} repositories clearly used fewer, **none clearly used more** |`,
      `| **Not paying more** | \`strategy: "index"\` with \`mcp.tools: "locate"\` | cost **${minus(p('cost', 'locate'))}** ${iv('cost', 'locate')}; **none of the 20 clearly cost more**, ${byGoal.cost.locate.saves} saved. It saves no time (${minus(p('time', 'locate'))}) and total tokens rise (${minus(p('tokens', 'locate'))}) |`,
      `| **Cost, with upside and risk** | the prefetch route | cost ${minus(p('cost', 'prefetch'))} ${iv('cost', 'prefetch')}: ${byGoal.cost.prefetch.saves} repositories saved, **${byGoal.cost.prefetch.more} cost more** (up to +31%) |`,
      `| **Nothing** | \`strategy: "index"\` with the seven-tool \`mcp.tools: "core"\` | cost ${minus(p('cost', 'index'))} ${iv('cost', 'index')}, time ${minus(p('time', 'index'))}, tokens **${minus(p('tokens', 'index'))}** (${byGoal.tokens.index.more} of 20 clearly used more) |`,
    ];
    assert.ok(byGoal.time.prefetch.more === 0 && byGoal.tokens.prefetch.more === 0 && byGoal.cost.locate.more === 0, 'control: no repository is clearly slower, uses more tokens (prefetch) or costs more (locate)');
    for (const r of wantRows) assert.ok(choosing.includes(r), `choosing-a-setup.md must carry the saved table's figures: ${r.slice(0, 90)}`);
  });

  await test('the study figures in the table are the committed data\'s: the three Claude Code runs of index plus locate (confirm-bar.mjs, first asks)', () => {
    const rowsOf = (f) => fs.readFileSync(path.join(ROOT, 'benchmarks', 'agent-study', 'data', f), 'utf8').trim().split('\n').map(JSON.parse);
    const sel = { variant: 'locate', set: 'heldout' };
    const t5 = cb.judge(rowsOf('confirm-locate-claude-code.ndjson').filter((r) => r.ask !== 'repeat'), sel);
    const t6 = cb.judge(rowsOf('confirm-locate-claude-code-sonnet-5-5.ndjson'), sel);
    const t7 = cb.judge(rowsOf('confirm-locate-claude-code-large.ndjson'), sel);
    const pct = (j) => `${(j.pooled.change * 100).toFixed(1)}%`.replace('-', '−');
    assert.ok(askRow.includes(`cost ${pct(t5)} (Haiku 5.5, 20 repositories), ${pct(t6)} (Sonnet 5.5, the same 20) and ${pct(t7)} (Haiku 5.5, 16 repositories of 3,026 to 7,756 files, with no Python or JavaScript)`), `${pct(t5)} / ${pct(t6)} / ${pct(t7)}`);
    assert.ok(askRow.includes(`File found with / without SigMap: ${t5.foundWith} / ${t5.foundWithout} of ${t5.pairs}, ${t6.foundWith} / ${t6.foundWithout}, and ${t7.foundWith} / ${t7.foundWithout} of ${t7.pairs} (${((t7.foundWithout - t7.foundWith) / t7.pairs * 100).toFixed(1)} points fewer on the large repositories)`), 'file found, with and without');
    assert.deepStrictEqual([t5.repositories, t6.repositories, t7.repositories], [20, 20, 16]);
    const chosenOn = new Set(runs().filter((r) => r.set === 'heldout' && r.route === 'api').map((r) => r.repo));
    const reposOf = (f) => new Set(rowsOf(f).map((r) => r.repo));
    assert.ok([...reposOf('confirm-locate-claude-code.ndjson')].every((r) => chosenOn.has(r)) && [...reposOf('confirm-locate-claude-code-sonnet-5-5.ndjson')].every((r) => chosenOn.has(r)), 'the first two Claude Code runs use repositories the Messages-API runs that chose locate used');
    assert.ok([...reposOf('confirm-locate-claude-code-large.ndjson')].every((r) => !chosenOn.has(r)), 'and the 16 large ones are new');
    assert.ok(/The first two Claude Code runs use the 20 repositories `locate` was chosen on; the 16 large ones are new/.test(askRow));
    const heldout3 = JSON.parse(read('benchmarks/agent-study/data/heldout3-repos.json'));
    assert.ok(!JSON.stringify(heldout3).match(/"(?:python|javascript)"/i), 'the 16 large repositories include no Python or JavaScript');
    const sonnet = rowsOf('confirm-locate-claude-code-sonnet-5-5.ndjson').filter((r) => r.variant === 'locate' || r.arm === 'without');
    const mean = (arm, f) => { const rs = sonnet.filter((r) => r.arm === arm); return rs.reduce((s, r) => s + f(r), 0) / rs.length; };
    const tokens = mean('with', (r) => r.in + r.out + r.cacheRead + r.cacheWrite) / mean('without', (r) => r.in + r.out + r.cacheRead + r.cacheWrite);
    const cost = mean('with', (r) => r.usd) / mean('without', (r) => r.usd);
    assert.ok(tokens > 1.08 && tokens < 1.11 && cost > 0.87 && cost < 0.89 && /with Sonnet in Claude Code total tokens rose 9% while cost fell 12%/.test(askRow), `Sonnet: tokens x${tokens.toFixed(3)}, cost x${cost.toFixed(3)}`);
  });

  await test('the study figures in the table are the committed data\'s: the installed hook, the same text in the prompt, its size, and the old default (summarize.mjs, runs.ndjson)', () => {
    const q = script('summarize.mjs', '--set', 'heldout-q');
    const line = (out, setup) => { const l = out.split('\n').find((x) => x.includes('Claude Code') && new RegExp(`\`${setup}\` \\(`).test(x)); assert.ok(l, `${setup} row`); return hyphen(l); };
    const cells = (setup) => {
      const l = line(q, setup);
      const m = l.match(/\*\*(-?\d+)% \[[^\]]*\]\*\* \| (-?\d+)% \[[^\]]*\] \| (-?\d+)% \[[^\]]*\] \| (-?\d+)% \[[^\]]*\] \| (\d+)\/348 \((\d+)\/348\)/);
      assert.ok(m, `${setup}: ${l}`);
      return { cost: Number(m[1]), tokens: Number(m[2]), calls: Number(m[3]), time: Number(m[4]), found: Number(m[5]), without: Number(m[6]) };
    };
    const hook = cells('prefetch-hook'); const text = cells('prefetch');
    assert.ok(hookRow.includes(`time ${minus(hook.time)}, total tokens ${minus(hook.tokens)}, tool calls ${minus(hook.calls)}, cost ${minus(hook.cost)}, file found ${hook.found} / ${hook.without} of 348`), `the hook: ${JSON.stringify(hook)}`);
    assert.ok(hookRow.includes(`The same text in the prompt, same questions: cost ${minus(text.cost)}, time ${minus(text.time)}, tokens ${minus(text.tokens)}, tool calls ${minus(text.calls)}`), `the same text in the prompt: ${JSON.stringify(text)}`);
    const byRepo = hyphen(script('summarize.mjs', '--set', 'heldout-q', '--by-repo')).split('\n').find((l) => /`prefetch-hook`/.test(l));
    assert.ok(/\*\*-4% \[-14%, \+5%\]\*\*/.test(byRepo) && /counting each repository once/.test(hookRow) && choosing.includes('includes zero counting each repository once ([−14%, +5%])'), `by repository the hook's cost interval includes zero: ${byRepo}`);
    assert.ok(choosing.includes(`took cost ${minus(text.cost)}, time ${minus(text.time)}, tokens ${minus(text.tokens)} and tool calls ${minus(text.calls)}`), 'the guide quotes the same text in the prompt');
    const near = (got, want) => Math.abs(got - want) <= 0.03;
    assert.ok(near(hook.cost / text.cost, 1 / 3) && near(hook.time / text.time, 0.5) && near(hook.tokens / text.tokens, 0.7) && near(hook.calls / text.calls, 0.77) && /about a third of the cost saving, half of the time saving and 70% to 77% of the token and tool-call reductions/.test(choosing), 'the hook keeps about a third of the cost saving, half of the time saving and 70% to 77% of the token and tool-call reductions');
    const versus = hyphen(script('summarize.mjs', '--set', 'heldout-q', '--versus', 'prefetch-hook:prefetch'));
    const calls = versus.match(/\| \+(\d+)% \[\+\d+%, \+\d+%\] \| \+\d+% \[\+\d+%, \+\d+%\] \| \d+\/348/);
    assert.ok(calls && Number(calls[1]) === 28 && /its runs made 28% more tool calls than the same text in the prompt did \(the traces suggest the agent re-checks the list; that is a reading, not a tested cause\)/.test(choosing), `the hook arm makes more tool calls than the prompt text: ${calls && calls[1]}`);
    // what the hook injects: a block per prompt, 0.8k to 1.3k tokens typically, about 2k at most (hookBytes of the clean comparison, chars/4)
    const sizes = runs().filter((r) => r.set === 'heldout-q' && r.variant === 'prefetch-hook' && r.arm === 'with' && r.hookBytes > 0).map((r) => Math.ceil(r.hookBytes / 4)).sort((a, b) => a - b);
    const at = (f) => sizes[Math.floor((sizes.length - 1) * f)];
    assert.ok(sizes.length === 348 && at(0.25) > 750 && at(0.25) < 900 && at(0.5) > 1000 && at(0.5) < 1200 && at(0.75) > 1200 && at(0.75) < 1400 && sizes[sizes.length - 1] < 2100, `hook block sizes: p25 ${at(0.25)}, median ${at(0.5)}, p75 ${at(0.75)}, max ${sizes[sizes.length - 1]}`);
    assert.ok(/typically about 0\.8k to 1\.3k tokens in the study \(median about 1\.1k, chars\/4 as `sigmap advise` counts\), at most about 2k/.test(read('docs-vp/guide/cli.md')));
    const famous = (model, flag) => hyphen(script('summarize.mjs', '--route', 'claude-code', '--model', model, '--set', 'famous', ...(flag ? [flag] : []))).split('\n').find((l) => l.includes('`current`'));
    assert.ok(/\*\*\+9% \[/.test(famous('claude-haiku-5-5')) && /\*\*-28% \[/.test(famous('claude-haiku-4-5')), 'the old default per pair: +9% with Haiku 5.5, -28% with Haiku 4.5');
    assert.ok(/\*\*\+8% \[\+1%, \+14%\]\*\* \| 0 \| 5 \| 3 \|/.test(famous('claude-haiku-5-5', '--by-repo')) && /\*\*-26% \[/.test(famous('claude-haiku-4-5', '--by-repo')), 'and by repository: +8% with 3 of 8 costing more, -26%');
    assert.ok(noneRow.includes('+9% against no SigMap in Claude Code on 8 well-known frameworks with Haiku 5.5 (+8% by repository, 3 of 8 repositories cost more), and −28% with Haiku 4.5 (−26% by repository)'));
  });

  await test('the table does not say `core` helps editing, says it was not measured there, and says what `verify_suggestion` does not check', () => {
    assert.ok(/\*\*No evidence it helps editing\*\*/.test(coreRow) && /could not judge the quality of a patch/.test(coreRow), 'the core row says it');
    const changeRow = hyphen(script('summarize.mjs', '--set', 'change')).split('\n').find((l) => l.includes('claude-haiku-5-5') && /`index` \(/.test(l));
    const cm = changeRow && changeRow.match(/\*\*(-?\d+)% \[(-?\d+)%, \+?(-?\d+)%\] ~\*\* .*(\d+)\/27 \((\d+)\/27\) tests/);
    assert.ok(cm && coreRow.includes(`cost ${minus(Number(cm[1]))} [${minus(Number(cm[2]))}, ${minus(Number(cm[3]))}] with Haiku 5.5, not clear`) && cm[4] === cm[5], `the editing stage, Haiku 5.5, seven-tool arm: ${changeRow}`);
    assert.ok(/did not work as a test of patch quality/.test(read('docs-vp/guide/agent-study.md')), 'control: the study page says its editing stage could not judge quality');
    const change = runs().filter((r) => r.set === 'change' && r.variant === 'index' && r.arm === 'with');
    const called = change.filter((r) => r.mcp > 0).length;
    assert.ok(change.length === 45 && called === 1 && coreRow.includes(`the agent made a SigMap call in ${called} of ${change.length} of its runs`), `the editing stage: a SigMap call in ${called} of ${change.length} runs of the seven-tool arm`);
    assert.ok(NOT_CHECKED.some((c) => /raw code/.test(c)) && /`verify_suggestion` checks the files, imports and backticked calls a snippet names, not calls in raw code/.test(coreRow), 'verify_suggestion\'s own footer says calls in raw code are not checked');
    assert.ok(!/\b(?:suitable|best|recommended)\b[^|]{0,40}\bediting\b|\bediting\b[^|]{0,40}\b(?:suitable|best|recommended)\b|\bhelps?\b[^|]{0,40}\bediting\b/i.test(section.replace('No evidence it helps editing', '')), 'no row calls a setup suitable, best, recommended or helpful for editing');
    assert.ok(coreRow.includes('`{ "strategy": "index", "mcp": { "tools": "core" } }` (from a `--init` config, change `locate` to `core`)'), 'the core row shows the measured pair, not `core` alone (on `full` it was never measured)');
  });

  await test('the pages the table leans on no longer carry the claims the fact-check found false', () => {
    for (const [stale, why] of [
      ['`strategy: "index"` alone', 'the study\'s index arm is index plus the seven-tool core profile'],
      ['checks less', 'its runs made more tool calls than the prompt text'],
      ['which the agent checks more', 'that is a reading of the traces, not a tested cause'],
      ['read the table as the ceiling', 'the table is another agent on other repositories'],
      ['twenty unseen repositories', 'the twenty were held out when the runs were made and looked at again since'],
      ['**none of the 20 cost more**', 'by each repository\'s own interval: none clearly cost more'],
      ['**none used more**', 'none clearly used more'],
      ['above about 2,400 files', 'Python and JavaScript were measured only up to about 260 files'],
      ['one cheap model and one agent', 'three models and two agents'],
      ['prints no percentage', 'advise prints the study\'s own figures and no forecast for your project'],
      ['rank correlation of 0.66', 'recomputed it is about 0.6'],
      ['which record each session\'s usage in `.context/sessions.ndjson`.', 'SessionStart also hands the model a summary'],
      ['([−9%, +1%])', 'no committed script computes a per-question interval'],
    ]) assert.ok(!choosing.includes(stale), `choosing-a-setup.md still says "${stale}" (${why})`);
    assert.ok(/agents called only two of the seven tools/.test(read('docs-vp/guide/agent-study-protocol.md')) && /the `locate` profile itself was chosen after the first five had been run/.test(choosing), 'the protocol says the two-tool profile followed the first five-repository round, and the guide says so');
    const pyJs = [...read('benchmarks/agent-study/data/setup-signal-eval.txt').matchAll(/^\| \S+__\S+ \| (python|javascript) \| \d+ \| -?\d+% \| -?\d+% \| -?\d+% \| (\d+) \|/gm)].map((m) => Number(m[2]));
    assert.ok(pyJs.length >= 3 && choosing.includes(`Python or JavaScript repositories above about ${Math.max(...pyJs)} files`), `the largest Python or JavaScript repository among the twenty has ${Math.max(...pyJs)} files`);
    assert.ok(/on nine editing tasks,\s+where patch quality could not be judged \(cost −7% \[−17%, \+3%\] with Haiku 5\.5, not clear\)/.test(choosing) && !choosing.includes('location questions only'), 'choosing-a-setup.md: the core bullet names the editing stage');
    assert.ok(/SessionStart` also hands the model a summary of the last session \(up to about 400 tokens\)/.test(choosing) && /Twenty repositories, one model \(Haiku 5\.5\) on all of them, Sonnet 5\.5 on five of them/.test(choosing), 'choosing-a-setup.md: the session hooks and the models');
    const study = read('docs-vp/guide/agent-study.md');
    assert.ok(!/\bunseen\b/i.test(study) && !study.includes('SigMap was never tuned on'), 'agent-study.md: the twenty were held out, not unseen');
    assert.ok(!study.includes('**its saving is not established**') && !/rank correlation (?:of )?0\.66/.test(study) && !study.includes('it is not size or language') && !study.includes('There is no pattern by size or language') && !study.includes('with none using more') && !study.includes('saves about a third of what the same text saves'), 'agent-study.md: the hook\'s saving, the correlation, size and language, "none using more", "a third"');
    assert.ok(/cost saving is small \(−4%\) and not clear when each question or repository counts once/.test(study) && /no clear link to size, rank correlation −0\.36 \[−0\.73, \+0\.14\], and language was not tested/.test(study), 'agent-study.md says what is established about the hook and about size');
    const saved = read('benchmarks/agent-study/data/setup-signal-eval.txt');
    assert.ok(/\| files \| cost \| -0\.35 \[-0\.70, 0\.10\] \| -0\.36 \[-0\.73, 0\.14\] \| -0\.57 \[-0\.86, -0\.12\] \|/.test(saved), 'control: size against cost is -0.36 [-0.73, 0.14] for prefetch (and -0.57 for locate) in the saved table');
    const mcp = read('docs-vp/guide/mcp.md');
    assert.ok(!mcp.includes('writes nothing into your repository') && !mcp.includes('so a plain `sigmap mcp install claude` advertises all 22 tools.') && /advertises whatever the project's config says \(all 22 tools with no `mcp\.tools` key, two after `sigmap --init`\)/.test(mcp) && /a file in the project for `claude`, `cursor`, `windsurf`, `vscode`, `opencode` and `mcp`; under your home directory for `gemini`, `zed` and `codex`/.test(mcp), 'mcp.md: `mcp install` writes a file in the project for six clients');
    const cli = read('docs-vp/guide/cli.md');
    for (const stale of ['about 1.4k tokens', 'about 0.2 s when it ranks', 'personal, uncommitted settings', '**The hooks cannot hurt a session.**', '**The hook handler cannot hurt a session.**', 'names the same files as the last block', 'is fetched on each ranking', 'until you run `hooks install claude` again', 'and a failure is silence — it exits `0`']) assert.ok(!cli.includes(stale), `cli.md still says "${stale}"`);
    assert.ok(/SigMap does not add it to `\.gitignore`/.test(cli) && /exit 1; 127 when `node` is not on `PATH`\) until you re-run the same `hooks install claude` command with the same `--stop`, `--prefetch` and `--shared` flags/.test(cli) && /\*\*The session hooks cannot hurt a session\.\*\*/.test(cli) && /eight repositories picked after earlier results, 348 first-ask pairs/.test(cli), 'cli.md: the corrected settings file, failure mode, claim and clean-comparison description');
    assert.ok(/unless an agent reported it through an MCP notify tool, which only the full tool set has/.test(cli) && /a failure of the work itself is silence — the handler exits `0`/.test(cli), 'cli.md: the live-overlay exception and the scope of "a failure is silence"');
    assert.ok(/at most once an hour \(it is cached in `\.context\/config-cache\/`\)/.test(cli) && /BASE_CONFIG_TTL_MS\s*=\s*60\s*\*\s*60\s*\*\s*1000/.test(read('src/config/loader.js')), 'cli.md: a remote extends is cached for an hour (the constant is pinned)');
    assert.ok(/roughly half a second when it ranks and 0\.2 to 0\.3 s when it skips, timed by hand on a loaded laptop; no committed script times it/.test(cli), 'cli.md says the hook\'s speed is a hand timing');
    const strategies = read('docs-vp/guide/strategies.md');
    assert.ok(/This table, and the scenarios and "Winner" lines further down, are design intent, not measurement: no agent run exists for `per-module` or `hot-cold`, and the one measured record for `full` is the old default \(`current`\)/.test(strategies), 'strategies.md says its table and scenarios are design intent');
  });

  await test('the qualifiers in each row are the ones the evidence supports, and a profile change needs a server restart (a run)', async () => {
    assert.ok(/then run `sigmap` once and `sigmap mcp install <client>`/.test(askRow) && /In Claude Code, API-billed, first asks: cost/.test(askRow), 'row 1: run sigmap once, then install; API-billed first asks');
    assert.ok(/Under `index`, `read_context` returns the map, not signatures/.test(coreRow) && /`sigmap verify`, `--impact` and `--callers` run from the shell under any profile/.test(coreRow) && /then restart the server/.test(coreRow), 'row 2: read_context under index, the shell commands, the restart');
    assert.ok(/a logged-in session \(not API-billed\), Haiku 5\.5, the prefetch hook alone \(without the session hooks\), 8 repositories picked after earlier results, one question per session/.test(hookRow), 'row 3: the hook\'s runs were a logged-in session, one question each, on repositories picked after earlier results');
    assert.ok(/the stale-index warning `sigmap ask` prints goes to stderr, which the hook does not pass on/.test(read('docs-vp/guide/cli.md')) && /the traces suggest the agent re-checks that list more than it re-checks text in its own prompt \(a reading, not a tested cause\)/.test(read('docs-vp/guide/cli.md')), 'cli.md says the stale-index warning is not passed on');
    // the server reads the profile once, when it first needs it: a config edit shows up in the next server process, not the running one
    await withProject({ ...SRC, 'gen-context.config.json': '{"srcDirs":["src"],"outputs":["copilot"],"mcp":{"tools":"locate"}}\n' }, async (ctx) => {
      const server = spawn(process.execPath, [path.join(ROOT, 'gen-context.js'), '--mcp'], { cwd: ctx.dir, env: ctx.env, stdio: ['pipe', 'pipe', 'ignore'] });
      let buffer = ''; const waiting = new Map();
      server.stdout.on('data', (d) => { buffer += d; let i; while ((i = buffer.indexOf('\n')) >= 0) { const line = buffer.slice(0, i); buffer = buffer.slice(i + 1); try { const m = JSON.parse(line); if (waiting.has(m.id)) { waiting.get(m.id)(m); waiting.delete(m.id); } } catch (_) { /* not a response */ } } });
      const call = (id, method, params) => new Promise((resolve, reject) => { waiting.set(id, resolve); server.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`); setTimeout(() => reject(new Error(`no answer to ${method}`)), 20000); });
      try {
        await call(1, 'initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 't', version: '0' } });
        const first = (await call(2, 'tools/list', {})).result.tools.map((t) => t.name);
        fs.writeFileSync(path.join(ctx.dir, 'gen-context.config.json'), '{"srcDirs":["src"],"outputs":["copilot"],"mcp":{"tools":"core"}}\n');
        const second = (await call(3, 'tools/list', {})).result.tools.map((t) => t.name);
        assert.deepStrictEqual([first.length, second.length], [2, 2], 'the running server still advertises two tools after the config says core');
      } finally { server.kill('SIGTERM'); }
      const fresh = JSON.parse(spawnSync(process.execPath, [path.join(ROOT, 'gen-context.js'), '--mcp'], { cwd: ctx.dir, encoding: 'utf8', env: ctx.env, input: [{ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 't', version: '0' } } }, { jsonrpc: '2.0', method: 'notifications/initialized' }, { jsonrpc: '2.0', id: 2, method: 'tools/list' }].map((m) => JSON.stringify(m)).join('\n') + '\n' }).stdout.trim().split('\n').pop()).result.tools;
      assert.strictEqual(fresh.length, 7, 'a new server process advertises the seven of core');
    });
  });

  console.log(`\nsetup-table: ${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
