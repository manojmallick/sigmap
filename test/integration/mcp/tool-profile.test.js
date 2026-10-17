'use strict';

/**
 * MCP tool profile (#966, from #878): `mcp.tools` picks which tools the server
 * advertises (`tools/list`) and answers (`tools/call`).
 *
 * The 22 tool definitions cost ~2.5k tokens at the start of every MCP session
 * and a long list degrades an agent's tool choice. The properties pinned here:
 *
 *   - NO key means "all": the same 22 tools with the same names, order, parameters
 *     and schemas as before — only the descriptions are shorter — and the same
 *     discovery sentence, so every test and page that pins 22 tools stays true;
 *   - `core` is small enough to be worth choosing (<= 1,000 tokens, measured on the
 *     real serialized list) and it GATES `tools/call` — an unlisted tool that still
 *     answered would make the setting a suggestion, not a switch;
 *   - a value SigMap cannot read never breaks the server, and `doctor` says so;
 *   - the resolver is one function, so the server and `doctor` cannot disagree;
 *   - the pages that list the profiles list the profile the code ships.
 *
 * Run: node test/integration/mcp/tool-profile.test.js
 */

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../../..');
const GEN = path.join(ROOT, 'gen-context.js');
const { TOOLS, LOG_SESSION_USAGE } = require(path.join(ROOT, 'src', 'mcp', 'tools.js'));
const profile = require(path.join(ROOT, 'src', 'mcp', 'profile.js'));
const { DEFAULTS } = require(path.join(ROOT, 'src', 'config', 'defaults.js'));

let pass = 0;
let fail = 0;
const later = [];

function test(name, fn) {
  try { fn(); console.log(`  PASS  ${name}`); pass++; }
  catch (e) { console.log(`  FAIL  ${name}\n        ${e.message}`); fail++; }
}
function testAsync(name, fn) { later.push([name, fn]); }

const tokens = (o) => Math.ceil(JSON.stringify(o).length / 4);
const names = (tools) => tools.map((t) => t.name);

/** A throwaway project, optionally with a config; removed when `fn` returns. */
function withProject(config, fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-toolprofile-'));
  fs.writeFileSync(path.join(dir, 'app.js'), 'function handleRequest(request) { return request; }\nmodule.exports = { handleRequest };\n');
  if (config !== undefined) {
    fs.writeFileSync(path.join(dir, 'gen-context.config.json'), typeof config === 'string' ? config : JSON.stringify(config));
  }
  try { return fn(dir); } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

/** Drive the real bundled server over stdio; responses keyed by id. */
function rpc(dir, messages) {
  const input = messages.map((m) => JSON.stringify(m)).join('\n') + '\n';
  const r = spawnSync(process.execPath, [GEN, '--mcp'], { cwd: dir, input, encoding: 'utf8', timeout: 30000 });
  const byId = new Map();
  for (const line of (r.stdout || '').split('\n').filter(Boolean)) {
    const m = JSON.parse(line);
    byId.set(m.id, m);
  }
  return byId;
}
const listTools = (dir) => rpc(dir, [{ jsonrpc: '2.0', id: 1, method: 'tools/list' }]).get(1).result.tools;
const callTool = (dir, name, args = {}) =>
  rpc(dir, [{ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }]).get(1);
const discoverText = (dir) =>
  rpc(dir, [{ jsonrpc: '2.0', id: 1, method: 'server/discover' }]).get(1).result.instructions;

const doctorRow = (dir) => {
  const r = spawnSync(process.execPath, [GEN, 'doctor', '--json'], { cwd: dir, encoding: 'utf8', timeout: 60000 });
  const json = JSON.parse(r.stdout);
  return json.checks.find((c) => c.id === 'mcp-tools');
};

console.log('\nmcp tool profile: mcp.tools = all | core | [names]\n');

// ---------------------------------------------------------------------------
// The resolver (the one function the server and doctor share)
// ---------------------------------------------------------------------------

test('CORE names real, distinct tools (a rename cannot silently shrink the profile)', () => {
  const have = new Set(names(TOOLS));
  for (const n of profile.CORE) assert.ok(have.has(n), `CORE names "${n}", which is not a shipped tool`);
  assert.strictEqual(new Set(profile.CORE).size, profile.CORE.length, 'CORE must not repeat a name');
});

test('no key, no mcp block, null config: "all", the shipped array itself, no notes', () => {
  for (const cfg of [undefined, null, {}, { mcp: {} }, { mcp: null }, { mcp: { autoRegister: true } }, { mcp: { tools: null } }]) {
    const r = profile.resolveProfile(cfg);
    assert.strictEqual(r.profile, 'all', JSON.stringify(cfg));
    assert.strictEqual(r.tools, TOOLS, 'the default must be the shipped array, not a copy that could drift');
    assert.deepStrictEqual(r.notes, []);
  }
  assert.strictEqual(DEFAULTS.mcp.tools, 'all', 'the shipped default is "all": existing configs must see no change');
});

test('"core" keeps shipped order and is insensitive to case and spacing', () => {
  for (const v of ['core', 'CORE', ' Core ']) {
    const r = profile.resolveProfile({ mcp: { tools: v } });
    assert.strictEqual(r.profile, 'core', v);
    assert.deepStrictEqual(r.names, names(TOOLS).filter((n) => profile.CORE.includes(n)), 'order is the shipped order, not CORE order');
    assert.deepStrictEqual(r.notes, []);
  }
});

test('a name list is deduplicated, in shipped order, and drops (and names) what is not a tool', () => {
  const r = profile.resolveProfile({ mcp: { tools: ['verify_suggestion', 'get_lines', 'get_lines', 'get_mpa', 7] } });
  assert.strictEqual(r.profile, 'custom');
  assert.deepStrictEqual(r.names, names(TOOLS).filter((n) => n === 'get_lines' || n === 'verify_suggestion'));
  assert.strictEqual(r.notes.length, 1);
  assert.ok(/get_mpa/.test(r.notes[0]) && /7/.test(r.notes[0]), `the note must name what was dropped: ${r.notes[0]}`);
});

test('log_session_usage in a list is explained, not silently dropped', () => {
  const r = profile.resolveProfile({ mcp: { tools: ['get_lines', 'log_session_usage'] } });
  assert.deepStrictEqual(r.names, ['get_lines']);
  assert.ok(/session\.mcpCapture/.test(r.notes.join(' ')), `must point at the real switch: ${r.notes}`);
});

test('a list with BOTH mistakes reports both: the capture tool and the typo', () => {
  const r = profile.resolveProfile({ mcp: { tools: ['get_lines', 'log_session_usage', 'get_mpa'] } });
  assert.deepStrictEqual(r.names, ['get_lines']);
  assert.strictEqual(r.notes.length, 2, JSON.stringify(r.notes));
  assert.ok(/session\.mcpCapture/.test(r.notes[0]) && /get_mpa/.test(r.notes[1]) && !/get_mpa/.test(r.notes[0]), JSON.stringify(r.notes));
});

test('names in a list are trimmed', () => {
  const r = profile.resolveProfile({ mcp: { tools: [' get_lines ', '\tverify_suggestion\n'] } });
  assert.strictEqual(r.profile, 'custom');
  assert.deepStrictEqual(r.names, names(TOOLS).filter((n) => n === 'get_lines' || n === 'verify_suggestion'));
  assert.deepStrictEqual(r.notes, []);
});

test('an mcp block that is not an object, or a key beside tools that is not read, never passes silently', () => {
  // The loader keeps a non-object `mcp` as written, and a typo like `mcp.tool` is just another key.
  for (const bad of ['core', ['core'], 7, true]) {
    const r = profile.resolveProfile({ mcp: bad });
    assert.strictEqual(r.profile, 'all', JSON.stringify(bad));
    assert.ok(r.notes.length === 1 && /mcp must be an object/.test(r.notes[0]) && /advertising all \d+ tools/.test(r.notes[0]),
      `${JSON.stringify(bad)}: ${JSON.stringify(r.notes)}`);
  }
  const typo = profile.resolveProfile({ mcp: { autoRegister: true, tool: 'core' } });
  assert.strictEqual(typo.profile, 'all');
  assert.ok(typo.notes.length === 1 && /mcp\.tool is not a setting/.test(typo.notes[0]) && /mcp\.tools/.test(typo.notes[0]), JSON.stringify(typo.notes));
  const two = profile.resolveProfile({ mcp: { tools: 'core', a: 1, b: 2 } });
  assert.strictEqual(two.profile, 'core', 'a stray key must not undo a valid profile');
  assert.ok(/mcp\.a, mcp\.b are not settings/.test(two.notes[0]), two.notes[0]);
  // ...and the legitimate shapes stay quiet.
  for (const ok of [undefined, null, {}, { mcp: null }, { mcp: {} }, { mcp: { autoRegister: false } }, { mcp: { tools: 'core', autoRegister: true } }]) {
    assert.deepStrictEqual(profile.resolveProfile(ok).notes, [], JSON.stringify(ok));
  }
});

test('a value that cannot be read falls back to "all" and says why', () => {
  for (const bad of ['lean', '', 42, true, {}, [], ['nope'], [null, 3]]) {
    const r = profile.resolveProfile({ mcp: { tools: bad } });
    assert.strictEqual(r.profile, 'all', `${JSON.stringify(bad)} must not shrink the server`);
    assert.strictEqual(r.names.length, TOOLS.length);
    assert.ok(r.notes.length > 0 && /advertising all \d+ tools/.test(r.notes[r.notes.length - 1]),
      `${JSON.stringify(bad)} must leave a note: ${JSON.stringify(r.notes)}`);
  }
});

test('discovery text names only tools that are listed; with all tools it is the sentence the server always sent', () => {
  assert.strictEqual(profile.instructionsFor(profile.resolveProfile({})),
    'SigMap serves code signatures for the working directory. Call query_context or search_signatures to rank and fetch signature blocks instead of reading whole files.');
  for (const tools of ['core', ['get_lines'], ['read_context', 'get_map'], ['query_context'], ['search_signatures', 'get_lines']]) {
    const r = profile.resolveProfile({ mcp: { tools } });
    const text = profile.instructionsFor(r);
    for (const n of names(TOOLS)) {
      if (!r.names.includes(n)) assert.ok(!text.includes(n), `${JSON.stringify(tools)}: discovery text names unlisted "${n}": ${text}`);
    }
  }
});

test('the refusal names the setting and the way out — to the project owner, not as an order to the agent', () => {
  const msg = profile.refusal('get_map', profile.resolveProfile({ mcp: { tools: 'core' } }));
  assert.ok(/get_map/.test(msg) && /mcp\.tools/.test(msg) && /"all"/.test(msg) && /restart/i.test(msg), msg);
  assert.ok(/project owner/.test(msg), `an agent reads this; it must not be told to edit the user's config: ${msg}`);
});

// ---------------------------------------------------------------------------
// The real server
// ---------------------------------------------------------------------------

test('no config at all: tools/list is exactly TOOLS — nothing filtered, reordered or rewritten on the way out', () => {
  withProject(undefined, (dir) => assert.deepStrictEqual(listTools(dir), JSON.parse(JSON.stringify(TOOLS))));
});

test('a config without mcp.tools changes nothing', () => {
  withProject({ maxTokens: 5000, mcp: { autoRegister: true } }, (dir) => {
    assert.deepStrictEqual(listTools(dir), JSON.parse(JSON.stringify(TOOLS)));
  });
});

test('a config that does not parse serves every tool', () => {
  withProject('{ not json', (dir) => assert.strictEqual(listTools(dir).length, TOOLS.length));
});

test('"core": the profile\'s tools, and at most 1,000 tokens of definitions', () => {
  withProject({ mcp: { tools: 'core' } }, (dir) => {
    const got = listTools(dir);
    assert.deepStrictEqual(names(got), names(TOOLS).filter((n) => profile.CORE.includes(n)));
    assert.ok(tokens(got) <= 1000, `core is ${tokens(got)} tokens; the point of the profile is ~1k or less`);
    assert.ok(tokens(got) * 2 < tokens(TOOLS), `core (${tokens(got)}) must be well under half of all (${tokens(TOOLS)})`);
  });
});

test('the figures the docs quote (~2.5k all, ~0.9k core) are the real ones', () => {
  // docs-vp/guide/mcp.md says "about 2.5k" / "~0.9k". If a description change moves
  // either by more than rounding, update the page — not this range.
  assert.ok(tokens(TOOLS) >= 2300 && tokens(TOOLS) <= 2700, `all = ${tokens(TOOLS)} tokens`);
  const core = profile.resolveProfile({ mcp: { tools: 'core' } });
  assert.ok(core.tokens >= 800 && core.tokens <= 1000, `core = ${core.tokens} tokens`);
});

test('"core" gates tools/call: a listed tool answers, an unlisted one is refused naming the setting', () => {
  withProject({ mcp: { tools: 'core' } }, (dir) => {
    const ok = callTool(dir, 'read_context');
    assert.ok(ok.result && !ok.error, `a core tool must answer: ${JSON.stringify(ok)}`);
    const refused = callTool(dir, 'get_map', { type: 'imports' });
    assert.ok(refused.error, 'an unlisted tool must not answer');
    assert.strictEqual(refused.error.code, -32601);
    assert.ok(/get_map/.test(refused.error.message) && /mcp\.tools/.test(refused.error.message), refused.error.message);
  });
});

test('a name that is not a tool still reads "Unknown tool", in every profile', () => {
  for (const cfg of [undefined, { mcp: { tools: 'core' } }, { mcp: { tools: ['get_lines'] } }]) {
    withProject(cfg, (dir) => {
      const r = callTool(dir, 'no_such_tool');
      assert.ok(r.error && /^Unknown tool: no_such_tool$/.test(r.error.message), JSON.stringify(r));
    });
  }
});

test('default profile: every shipped tool still answers (nothing was gated by accident)', () => {
  withProject(undefined, (dir) => {
    for (const t of TOOLS) {
      const r = callTool(dir, t.name, {});
      assert.ok(!(r.error && /not enabled|Unknown tool/.test(r.error.message)), `${t.name}: ${JSON.stringify(r.error)}`);
    }
  });
});

test('a name list advertises exactly those tools and gates the rest', () => {
  withProject({ mcp: { tools: ['get_lines', 'nope', 'verify_suggestion'] } }, (dir) => {
    assert.deepStrictEqual(names(listTools(dir)), names(TOOLS).filter((n) => n === 'get_lines' || n === 'verify_suggestion'));
    assert.ok(callTool(dir, 'read_context').error, 'read_context is not in the list');
  });
});

test('a value that cannot be read serves all tools; nothing throws', () => {
  for (const bad of ['lean', [], ['nope'], 42]) {
    withProject({ mcp: { tools: bad } }, (dir) => assert.strictEqual(listTools(dir).length, TOOLS.length, JSON.stringify(bad)));
  }
});

test('session.mcpCapture is its own switch: profile + capture = profile + log_session_usage', () => {
  withProject({ mcp: { tools: 'core' }, session: { mcpCapture: true } }, (dir) => {
    const got = names(listTools(dir));
    assert.strictEqual(got.length, profile.CORE.length + 1);
    assert.strictEqual(got[got.length - 1], LOG_SESSION_USAGE.name);
    const r = callTool(dir, 'log_session_usage', {});
    assert.ok(r.result && !r.error, `the capture tool must answer when switched on: ${JSON.stringify(r)}`);
  });
  withProject({ mcp: { tools: 'core' } }, (dir) => {
    assert.ok(!names(listTools(dir)).includes('log_session_usage'));
    assert.ok(/Unknown tool/.test(callTool(dir, 'log_session_usage', {}).error.message), 'off means absent, as before');
  });
  withProject({ mcp: { tools: ['get_lines', 'log_session_usage'] }, session: { mcpCapture: false } }, (dir) => {
    assert.ok(!names(listTools(dir)).includes('log_session_usage'), 'listing it in mcp.tools must not switch it on');
  });
});

test('server/discover: the default text is unchanged and "core" names only what it lists', () => {
  withProject(undefined, (dir) => assert.strictEqual(discoverText(dir), profile.instructionsFor(profile.resolveProfile({}))));
  withProject({ mcp: { tools: 'core' } }, (dir) => {
    const text = discoverText(dir);
    assert.ok(/query_context/.test(text) && !/search_signatures/.test(text), text);
  });
});

testAsync('the profile is read once, on first use, and held for the life of the server (as the docs say)', async () => {
  await withProjectAsync({ mcp: { tools: 'core' } }, async (dir) => {
    const s = openSession(dir);
    try {
      const first = (await s.send('tools/list')).result.tools.length;
      fs.writeFileSync(path.join(dir, 'gen-context.config.json'), JSON.stringify({ mcp: { tools: 'all' } }));
      const second = (await s.send('tools/list')).result.tools.length;
      assert.strictEqual(first, profile.CORE.length);
      assert.strictEqual(second, first, 'a running server keeps the profile it started with');
    } finally { s.close(); }
  });
});

// ---------------------------------------------------------------------------
// doctor
// ---------------------------------------------------------------------------

test('doctor shows the active profile, the tool count and the definition tokens', () => {
  withProject(undefined, (dir) => {
    const row = doctorRow(dir);
    assert.ok(row, 'doctor must have an mcp-tools row');
    assert.strictEqual(row.status, 'ok');
    assert.ok(new RegExp(`all \\(${TOOLS.length} tools, ~[\\d,]+ tokens of definitions\\)`).test(row.detail), row.detail);
    // On "all" the row says what the lean profile would cost instead.
    assert.ok(new RegExp(`"core" would advertise ${profile.CORE.length} tools, ~[\\d,]+ tokens`).test(row.detail), row.detail);
  });
  withProject({ mcp: { tools: 'core' } }, (dir) => {
    const row = doctorRow(dir);
    assert.strictEqual(row.status, 'ok');
    assert.ok(new RegExp(`core \\(${profile.CORE.length} of ${TOOLS.length} tools, ~[\\d,]+ tokens of definitions\\)`).test(row.detail), row.detail);
  });
});

test('doctor and the server report the same count and token figure', () => {
  withProject({ mcp: { tools: 'core' } }, (dir) => {
    const served = listTools(dir);
    const row = doctorRow(dir);
    assert.ok(row.detail.includes(`~${tokens(served).toLocaleString('en-US')} tokens`), `${row.detail} vs served ${tokens(served)}`);
  });
});

test('doctor warns on a value it had to ignore, and says what it did instead', () => {
  withProject({ mcp: { tools: 'lean' } }, (dir) => {
    const row = doctorRow(dir);
    assert.strictEqual(row.status, 'warn');
    assert.ok(/"lean"/.test(row.detail) && /advertising all \d+ tools/.test(row.detail), row.detail);
    assert.ok(/mcp\.tools/.test(row.fix || ''), 'the warning must say what to set');
  });
  withProject({ mcp: { tools: ['get_lines', 'get_mpa'] } }, (dir) => {
    const row = doctorRow(dir);
    assert.strictEqual(row.status, 'warn');
    assert.ok(/get_mpa/.test(row.detail), row.detail);
  });
});

test('doctor warns on an mcp block that is not an object, and on a stray key beside tools', () => {
  withProject({ mcp: 'core' }, (dir) => {
    const row = doctorRow(dir);
    assert.strictEqual(row.status, 'warn', 'the profile silently stayed on "all" while the config said otherwise');
    assert.ok(/mcp must be an object/.test(row.detail), row.detail);
  });
  withProject({ mcp: { tool: 'core' } }, (dir) => {
    const row = doctorRow(dir);
    assert.strictEqual(row.status, 'warn');
    assert.ok(/mcp\.tool is not a setting/.test(row.detail), row.detail);
  });
});

test('doctor counts the capture tool when session.mcpCapture is on, exactly as the server lists it', () => {
  withProject({ mcp: { tools: 'core' }, session: { mcpCapture: true } }, (dir) => {
    const served = listTools(dir);
    assert.strictEqual(served.length, profile.CORE.length + 1);
    const row = doctorRow(dir);
    assert.ok(row.detail.includes(`~${tokens(served).toLocaleString('en-US')} tokens in all`), `${row.detail} vs served ${tokens(served)}`);
    assert.ok(/log_session_usage \(session\.mcpCapture\)/.test(row.detail), row.detail);
  });
  withProject({ mcp: { tools: 'core' } }, (dir) => {
    assert.ok(!/log_session_usage/.test(doctorRow(dir).detail), 'off means it is not in the figure');
  });
});

// ---------------------------------------------------------------------------
// New installs
// ---------------------------------------------------------------------------

test('--init writes "core" into a new config; an existing config is left alone', () => {
  withProject(undefined, (dir) => {
    spawnSync(process.execPath, [GEN, '--init'], { cwd: dir, encoding: 'utf8', timeout: 30000 });
    const written = JSON.parse(fs.readFileSync(path.join(dir, 'gen-context.config.json'), 'utf8'));
    assert.strictEqual(written.mcp.tools, 'core', 'a new install starts lean');
    assert.strictEqual(listTools(dir).length, profile.CORE.length);
  });
  withProject({ maxTokens: 5000 }, (dir) => {
    spawnSync(process.execPath, [GEN, '--init'], { cwd: dir, encoding: 'utf8', timeout: 30000 });
    assert.deepStrictEqual(JSON.parse(fs.readFileSync(path.join(dir, 'gen-context.config.json'), 'utf8')), { maxTokens: 5000 },
      '--init must not rewrite a config that exists');
    assert.strictEqual(listTools(dir).length, TOOLS.length, 'and an existing install keeps every tool');
  });
});

test('--init from a lone copy of the script (no example file beside it) writes "core" too', () => {
  // The standalone bundle / binary ships without gen-context.config.json.example; `--init` must
  // mean the same thing there, or the docs' "a new install starts lean" is true only for npm.
  withProject(undefined, (dir) => {
    const lone = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-lone-'));
    try {
      fs.copyFileSync(GEN, path.join(lone, 'gen-context.js'));
      assert.ok(!fs.existsSync(path.join(lone, 'gen-context.config.json.example')), 'the premise: no example beside the script');
      spawnSync(process.execPath, [path.join(lone, 'gen-context.js'), '--init'], { cwd: dir, encoding: 'utf8', timeout: 30000 });
      const written = JSON.parse(fs.readFileSync(path.join(dir, 'gen-context.config.json'), 'utf8'));
      assert.strictEqual(written.mcp.tools, 'core');
      assert.strictEqual(written.mcp.autoRegister, true, 'the rest of the block is the default, untouched');
      assert.strictEqual(listTools(dir).length, profile.CORE.length);
    } finally { fs.rmSync(lone, { recursive: true, force: true }); }
  });
});

// ---------------------------------------------------------------------------
// Guidance that names MCP tools stays true under a profile
// ---------------------------------------------------------------------------

test('the wiki recommends only MCP tools the project advertises (and is unchanged on "all")', () => {
  const navLine = (dir) => {
    spawnSync(process.execPath, [GEN, 'wiki'], { cwd: dir, encoding: 'utf8', timeout: 60000 });
    return fs.readFileSync(path.join(dir, '.context', 'WIKI.md'), 'utf8').split('\n').find((l) => l.startsWith('- MCP:'));
  };
  withProject(undefined, (dir) => {
    assert.strictEqual(navLine(dir), '- MCP: `get_architecture_overview`, `get_map`, `get_callee_signatures` for live agent access',
      'the default wiki must read exactly as it always has');
  });
  withProject({ mcp: { tools: 'core' } }, (dir) => {
    assert.strictEqual(navLine(dir), '- MCP: `get_callee_signatures` for live agent access');
  });
  withProject({ mcp: { tools: ['get_lines'] } }, (dir) => {
    assert.strictEqual(navLine(dir), undefined, 'none of the three is advertised: no line rather than a false one');
  });
});

// ---------------------------------------------------------------------------
// Descriptions: tighter wording, same contract
// ---------------------------------------------------------------------------

test('every tool still says what it does, and every parameter is described', () => {
  for (const t of TOOLS) {
    assert.ok(typeof t.description === 'string' && t.description.length >= 30, `${t.name}: description too thin to choose by`);
    for (const [p, spec] of Object.entries((t.inputSchema && t.inputSchema.properties) || {})) {
      assert.ok(spec.description && spec.description.length > 5, `${t.name}.${p} lost its description`);
    }
  }
});

/** Every `description` string removed, at any depth: what is left is the contract a client validates against. */
function stripDescriptions(node) {
  if (Array.isArray(node)) return node.map(stripDescriptions);
  if (node && typeof node === 'object') {
    return Object.fromEntries(Object.entries(node).filter(([k]) => k !== 'description').map(([k, v]) => [k, stripDescriptions(v)]));
  }
  return node;
}

test('the whole tool contract is the one v8.77.2 shipped: only the wording of descriptions moved', () => {
  // Names, order, parameter names/types/enums/items and `required` for all 22 tools, hashed.
  // Computed from `git show v8.77.2:src/mcp/tools.js` and from the reworded file: equal. If a
  // change to a schema is intended, update this fingerprint in the same commit — that is the point.
  const CONTRACT_SHA256 = '07868e02107baf5cd74b23d92dbdf3765aa6ee4ad48610cca08e5f77048926bb';
  assert.ok(!TOOLS.some((t) => t.inputSchema && t.inputSchema.properties && 'description' in t.inputSchema.properties),
    'a parameter named "description" would be hidden by the stripper');
  const sha = crypto.createHash('sha256').update(JSON.stringify(stripDescriptions(TOOLS))).digest('hex');
  assert.strictEqual(sha, CONTRACT_SHA256, 'a tool name, parameter, type, enum or required list changed');
});

test('the contract held through the rewording: tool names, order and the 22-tool surface', () => {
  assert.strictEqual(TOOLS.length, 22);
  assert.deepStrictEqual(names(TOOLS), [
    'read_context', 'search_signatures', 'get_map', 'create_checkpoint', 'get_routing', 'explain_file',
    'list_modules', 'query_context', 'get_method_impact', 'get_impact', 'get_lines', 'read_memory',
    'get_callee_signatures', 'sigmap_notify_file_created', 'sigmap_notify_symbol_added',
    'sigmap_notify_file_deleted', 'get_diff_context', 'get_architecture_overview', 'verify_suggestion',
    'squeeze_output', 'get_budget', 'query_knowledge_map',
  ]);
  const byName = Object.fromEntries(TOOLS.map((t) => [t.name, t.inputSchema]));
  assert.deepStrictEqual(byName.get_lines.required, ['file', 'start', 'end']);
  assert.deepStrictEqual(byName.get_map.properties.type.enum, ['imports', 'classes', 'routes']);
  assert.deepStrictEqual(byName.get_method_impact.properties.direction.enum, ['callers', 'callees']);
  assert.ok(/installed|librar/i.test(TOOLS.find((t) => t.name === 'verify_suggestion').description),
    'verify_suggestion must still say it checks against installed libraries');
});

// ---------------------------------------------------------------------------
// The pages that list the profiles list the profile the code ships
// ---------------------------------------------------------------------------

test('mcp.md and config.md list exactly the core tools the code ships', () => {
  // Every tool name in a piece of text, once each, sorted. Names all contain an underscore,
  // so no ordinary word is mistaken for one.
  const toolNames = (text) => [...new Set((text.match(/[a-z]+(?:_[a-z]+)+/g) || []).filter((n) => names(TOOLS).includes(n)))].sort();
  const want = [...profile.CORE].sort();
  const mcp = fs.readFileSync(path.join(ROOT, 'docs-vp', 'guide', 'mcp.md'), 'utf8');
  const row = mcp.split('\n').find((l) => l.startsWith('| `"core"` |'));
  assert.ok(row, 'mcp.md must have a `"core"` row in its profile table');
  assert.deepStrictEqual(toolNames(row.split('|')[2]), want, 'mcp.md names a different core set than profile.js');
  assert.ok(new RegExp(`\\|\\s*${profile.CORE.length} —`).test(row), `mcp.md must give the count (${profile.CORE.length})`);
  const config = fs.readFileSync(path.join(ROOT, 'docs-vp', 'guide', 'config.md'), 'utf8');
  const cfgRow = config.split('\n').find((l) => l.startsWith('| `mcp.tools` |'));
  assert.ok(cfgRow, 'config.md must document mcp.tools');
  assert.deepStrictEqual(toolNames(cfgRow), want, 'config.md names a different core set than profile.js');
  const example = JSON.parse(fs.readFileSync(path.join(ROOT, 'gen-context.config.json.example'), 'utf8'));
  assert.deepStrictEqual(toolNames(example._mcp_tools_comment), want,
    'the example config\'s comment names a different core set than profile.js');
});

// ---------------------------------------------------------------------------
// Async helpers (one test needs a live, incrementally-fed server)
// ---------------------------------------------------------------------------

async function withProjectAsync(config, fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-toolprofile-'));
  fs.writeFileSync(path.join(dir, 'app.js'), 'function a() {}\n');
  fs.writeFileSync(path.join(dir, 'gen-context.config.json'), JSON.stringify(config));
  try { return await fn(dir); } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

function openSession(dir) {
  const child = spawn(process.execPath, [GEN, '--mcp'], { cwd: dir, stdio: ['pipe', 'pipe', 'ignore'] });
  const waiters = new Map();
  let buf = '';
  let id = 0;
  child.stdout.on('data', (d) => {
    buf += d;
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i);
      buf = buf.slice(i + 1);
      if (!line.trim()) continue;
      const m = JSON.parse(line);
      const w = waiters.get(m.id);
      if (w) { waiters.delete(m.id); w(m); }
    }
  });
  return {
    send(method, params) {
      return new Promise((resolve, reject) => {
        const mine = ++id;
        const timer = setTimeout(() => reject(new Error(`no answer to ${method}`)), 20000);
        waiters.set(mine, (m) => { clearTimeout(timer); resolve(m); });
        child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: mine, method, params }) + '\n');
      });
    },
    close() { child.stdin.end(); child.kill(); },
  };
}

(async () => {
  for (const [name, fn] of later) {
    try { await fn(); console.log(`  PASS  ${name}`); pass++; }
    catch (e) { console.log(`  FAIL  ${name}\n        ${e.message}`); fail++; }
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
})();
