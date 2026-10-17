'use strict';

/**
 * MCP tool profile (#966, from #878).
 *
 * Every tool definition is paid for in tokens at the start of every MCP session,
 * and a longer list gives the model more to choose between. `mcp.tools` picks
 * which of the shipped tools a server advertises (`tools/list`) and answers
 * (`tools/call`):
 *
 *   "all"      every shipped tool — the default, and what an absent key means
 *   "core"     the retrieval + grounding loop only (CORE below)
 *   [names]    exactly those tools
 *
 * One function resolves it for the server and for `sigmap doctor`, so the tool
 * count and the token figure cannot disagree. `log_session_usage` is not part of
 * any profile: `session.mcpCapture` alone decides whether that tool exists.
 *
 * A bad value never breaks a server. It falls back to "all" (or drops the names
 * that are not tools) and says why in `notes`, which `doctor` prints. The same
 * goes for a setting that was meant for this block and does not parse as one: an
 * `mcp` that is not an object, or a key beside `tools` that SigMap does not read —
 * a typo there would otherwise leave the profile silently on "all".
 */

const { TOOLS, LOG_SESSION_USAGE } = require('./tools');
const { DEFAULTS } = require('../config/defaults');

/**
 * The grounding loop the MCP guide documents as "your agent's live loop": rank the
 * files, read the map, pin the exact signatures, read the anchored lines, size the
 * change, verify the answer. A profile that could not follow that loop would
 * contradict the page that explains why the tools exist.
 */
const CORE = Object.freeze([
  'query_context',
  'read_context',
  'get_callee_signatures',
  'get_lines',
  'get_impact',
  'get_method_impact',
  'verify_suggestion',
]);

const MAX_LISTED = 5;

/** Estimated tokens for a tool list as a client receives it (chars/4, as everywhere in SigMap). */
function definitionTokens(tools) {
  return Math.ceil(JSON.stringify(tools).length / 4);
}

function _shown(names) {
  const head = names.slice(0, MAX_LISTED).join(', ');
  return names.length > MAX_LISTED ? `${head}, … (${names.length - MAX_LISTED} more)` : head;
}

/**
 * Resolve `config.mcp.tools` against a tool list.
 *
 * @param {object} config  a loaded SigMap config; only `config.mcp` is read
 * @param {object[]} [tools]  the tools on offer (tests pass a subset); defaults to the shipped TOOLS
 * @returns {{ profile: 'all'|'core'|'custom', requested: *, tools: object[], names: string[],
 *             total: number, tokens: number, allTokens: number, coreTokens: number, notes: string[] }}
 */
function resolveProfile(config, tools = TOOLS) {
  const block = config ? config.mcp : undefined;
  const hasBlock = block !== undefined && block !== null;
  const isObject = hasBlock && typeof block === 'object' && !Array.isArray(block);
  const mcp = isObject ? block : {};
  const requested = mcp.tools === undefined ? null : mcp.tools;
  const shipped = new Set(tools.map((t) => t.name));
  const notes = [];
  let profile = 'all';
  let selected = tools;

  const fallBack = (why) => notes.push(`${why} — advertising all ${tools.length} tools`);

  if (hasBlock && !isObject) {
    fallBack(`mcp must be an object such as { "tools": "core" } (got ${JSON.stringify(block)})`);
  } else if (isObject) {
    const known = Object.keys(DEFAULTS.mcp);
    const stray = Object.keys(mcp).filter((k) => !known.includes(k));
    if (stray.length > 0) {
      notes.push(`${stray.map((k) => `mcp.${k}`).join(', ')} ${stray.length === 1 ? 'is not a setting' : 'are not settings'} ` +
        `SigMap reads (it reads ${known.map((k) => `mcp.${k}`).join(', ')})`);
    }
  }

  if (requested === null) {
    // No key: the default, and the reason an existing config sees no change.
  } else if (typeof requested === 'string') {
    const v = requested.trim().toLowerCase();
    if (v === 'core') {
      profile = 'core';
      selected = tools.filter((t) => CORE.includes(t.name));
    } else if (v !== 'all') {
      fallBack(`mcp.tools is "${requested}"; expected "all", "core" or a list of tool names`);
    }
  } else if (Array.isArray(requested)) {
    const wanted = new Set();
    const ignored = [];
    for (const raw of requested) {
      const name = typeof raw === 'string' ? raw.trim() : '';
      if (shipped.has(name)) wanted.add(name);
      else ignored.push(typeof raw === 'string' ? raw : JSON.stringify(raw));
    }
    // Two different mistakes, two notes: one name is a real tool with its own switch,
    // the rest are not tools at all. Saying only the first would hide a typo.
    const capture = ignored.filter((n) => n === LOG_SESSION_USAGE.name);
    const unknown = ignored.filter((n) => n !== LOG_SESSION_USAGE.name);
    if (capture.length > 0) notes.push(`${LOG_SESSION_USAGE.name} is switched by session.mcpCapture, not listed in mcp.tools`);
    if (unknown.length > 0) notes.push(`mcp.tools names no such tool: ${_shown(unknown)}`);
    if (wanted.size === 0) {
      fallBack('mcp.tools lists no shipped tool');
    } else {
      profile = 'custom';
      selected = tools.filter((t) => wanted.has(t.name));
    }
  } else {
    fallBack(`mcp.tools must be "all", "core" or a list of tool names (got ${JSON.stringify(requested)})`);
  }

  return {
    profile,
    requested,
    tools: selected,
    names: selected.map((t) => t.name),
    total: tools.length,
    tokens: definitionTokens(selected),
    allTokens: definitionTokens(tools),
    coreTokens: definitionTokens(tools.filter((t) => CORE.includes(t.name))),
    notes,
  };
}

/** Whether the resolved profile advertises (and so answers) a tool. */
function has(resolved, name) {
  return resolved.names.includes(name);
}

/**
 * One phrase for doctor and docs alike: the profile, its tool count and what its definitions
 * cost — `core (N of M tools, ~T tokens of definitions)`. With `captureOn` (session.mcpCapture)
 * the server also lists `log_session_usage`, so the phrase says what the client really receives.
 */
function label(resolved, captureOn = false) {
  const kind = resolved.profile === 'custom' ? 'custom list' : resolved.profile;
  const count = resolved.profile === 'all'
    ? `${resolved.names.length} tools`
    : `${resolved.names.length} of ${resolved.total} tools`;
  const base = `${kind} (${count}, ~${resolved.tokens.toLocaleString('en-US')} tokens of definitions)`;
  if (!captureOn) return base;
  const all = definitionTokens(resolved.tools.concat([LOG_SESSION_USAGE]));
  return `${base} + ${LOG_SESSION_USAGE.name} (session.mcpCapture): ~${all.toLocaleString('en-US')} tokens in all`;
}

/**
 * The `tools/call` answer for a shipped tool the profile does not advertise. It is read by an
 * agent, so it states what is true and who can change it; it does not tell the reader to
 * edit anything.
 */
function refusal(name, resolved) {
  const what = resolved.profile === 'custom'
    ? 'the tools listed in mcp.tools'
    : `the "${resolved.profile}" profile`;
  return `Tool not enabled: ${name}. This project's MCP server advertises ${what} (${resolved.names.length} of ${resolved.total} tools). ` +
    'The project owner can enable it by setting "mcp.tools": "all" in gen-context.config.json and restarting the server.';
}

/**
 * The one-line `instructions` of `server/discover`, naming only tools the client
 * can actually call. With every tool listed it is the sentence the server always sent.
 */
function instructionsFor(resolved) {
  const lead = ['query_context', 'search_signatures'].filter((n) => has(resolved, n));
  const how = lead.length > 0
    ? `Call ${lead.join(' or ')} to rank and fetch signature blocks instead of reading whole files.`
    : has(resolved, 'read_context')
      ? 'Call read_context to read signature blocks instead of reading whole files.'
      : 'Use the listed tools to read signatures instead of whole files.';
  return `SigMap serves code signatures for the working directory. ${how}`;
}

module.exports = { CORE, resolveProfile, has, label, refusal, instructionsFor, definitionTokens };
