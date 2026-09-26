'use strict';

/**
 * SigMap MCP server — zero npm dependencies.
 *
 * Wire protocol: JSON-RPC 2.0 over stdio.
 * One JSON object per line on both stdin and stdout.
 *
 * Supported methods:
 *   initialize        → serverInfo + capabilities + negotiated protocolVersion
 *   tools/list        → 21 tool definitions
 *   tools/call        → dispatch to handler, return result
 */

const readline = require('readline');
const { TOOLS } = require('./tools');
const { readContext, searchSignatures, getMap, createCheckpoint, getRouting, explainFile, listModules, queryContext, getMethodImpact, getImpact, getLines, readMemory, getCalleeSignatures, notifyFileCreated, notifySymbolAdded, notifyFileDeleted, getDiffContext, getArchitectureOverview, verifySuggestion, squeezeOutput, getBudget, queryKnowledgeMap } = require('./handlers');

const SERVER_INFO = {
  name: 'sigmap',
  version: '8.51.4',
  description: 'SigMap MCP server — code signatures on demand',
};

// Protocol revisions this server actually speaks. The tools-only surface —
// initialize / tools/list / tools/call plus the initialized/cancelled
// notifications — is identical across these revisions, and the
// @hasmcp/mcp-spec-test suite passes every applicable 2025-11-25 case against
// it. 2026-07-28 is deliberately absent: that revision requires
// server/discover, which is not implemented. Newest first: a client offering
// a version outside this list is downgraded to [0], never echoed back —
// echoing an unspeakable version is itself a spec violation (#544), and it
// made the conformance suite believe 2026-07-28 was supported, producing six
// phantom server/discover failures on a revision never really offered (#545).
const SUPPORTED_PROTOCOL_VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'];

// ---------------------------------------------------------------------------
// JSON-RPC helpers
// ---------------------------------------------------------------------------
function respond(id, result) {
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, result }) + '\n');
}

function respondError(id, code, message) {
  process.stdout.write(
    JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } }) + '\n'
  );
}

// ---------------------------------------------------------------------------
// Method dispatcher
// ---------------------------------------------------------------------------
function dispatch(msg, cwd) {
  const { method, id, params } = msg;

  // Notifications (no id) need no response
  if (method === 'notifications/initialized' || method === 'notifications/cancelled') {
    return;
  }

  // server/discover (spec 2026-07-28) — session-less discovery, answerable
  // before any handshake, so a client can learn the honest version list
  // instead of offering versions and hoping. The response is a
  // CacheableResult: deterministic, so the TTL promise of stability holds.
  // Note supportedVersions does NOT include 2026-07-28 — answering discover
  // is forward-compatible plumbing, not a claim to serve that revision's
  // whole surface (per-result envelopes, inline _meta negotiation).
  if (method === 'server/discover') {
    respond(id, {
      resultType: 'complete',
      cacheScope: 'public',
      ttlMs: 3600000,
      supportedVersions: SUPPORTED_PROTOCOL_VERSIONS,
      capabilities: { tools: {} },
      serverInfo: SERVER_INFO,
      instructions: 'SigMap serves code signatures for the working directory. Call query_context or search_signatures to rank and fetch signature blocks instead of reading whole files.',
    });
    return;
  }

  if (method === 'initialize') {
    const offered = params && params.protocolVersion;
    respond(id, {
      protocolVersion: SUPPORTED_PROTOCOL_VERSIONS.includes(offered)
        ? offered
        : SUPPORTED_PROTOCOL_VERSIONS[0],
      serverInfo: SERVER_INFO,
      capabilities: { tools: {} },
    });
    return;
  }

  if (method === 'tools/list') {
    // No pagination: the full list fits one page, so any cursor a client
    // presents is one this server never issued — reject it (-32602, per the
    // spec's SHOULD) rather than silently restarting from page one.
    if (params && params.cursor !== undefined) {
      respondError(id, -32602, `Invalid cursor: ${String(params.cursor)}`);
      return;
    }
    respond(id, { tools: TOOLS });
    return;
  }

  if (method === 'tools/call') {
    const name = params && params.name;
    const args = (params && params.arguments) || {};

    let text;
    try {
      if (name === 'read_context') text = readContext(args, cwd);
      else if (name === 'search_signatures') text = searchSignatures(args, cwd);
      else if (name === 'get_map') text = getMap(args, cwd);
      else if (name === 'create_checkpoint') text = createCheckpoint(args, cwd);
      else if (name === 'get_routing') text = getRouting(args, cwd);
      else if (name === 'explain_file') text = explainFile(args, cwd);
      else if (name === 'list_modules') text = listModules(args, cwd);
      else if (name === 'query_context') text = queryContext(args, cwd);
      else if (name === 'get_method_impact') text = getMethodImpact(args, cwd);
      else if (name === 'get_impact') text = getImpact(args, cwd);
      else if (name === 'get_lines') text = getLines(args, cwd);
      else if (name === 'read_memory') text = readMemory(args, cwd);
      else if (name === 'get_callee_signatures') text = getCalleeSignatures(args, cwd);
      else if (name === 'sigmap_notify_file_created') text = notifyFileCreated(args, cwd);
      else if (name === 'sigmap_notify_symbol_added') text = notifySymbolAdded(args, cwd);
      else if (name === 'sigmap_notify_file_deleted') text = notifyFileDeleted(args, cwd);
      else if (name === 'get_diff_context') text = getDiffContext(args, cwd);
      else if (name === 'get_architecture_overview') text = getArchitectureOverview(args, cwd);
      else if (name === 'verify_suggestion') text = verifySuggestion(args, cwd);
      else if (name === 'squeeze_output') text = squeezeOutput(args, cwd);
      else if (name === 'get_budget') text = getBudget(args, cwd);
      else if (name === 'query_knowledge_map') text = queryKnowledgeMap(args, cwd);
      else {
        respondError(id, -32601, `Unknown tool: ${name}`);
        return;
      }
    } catch (err) {
      respondError(id, -32603, `Tool error: ${err.message}`);
      return;
    }

    respond(id, {
      content: [{ type: 'text', text: String(text) }],
    });
    return;
  }

  // Unknown method
  if (id !== undefined && id !== null) {
    respondError(id, -32601, `Method not found: ${method}`);
  }
}

// ---------------------------------------------------------------------------
// Server entry point
// ---------------------------------------------------------------------------
function start(cwd) {
  const rl = readline.createInterface({ input: process.stdin, terminal: false });

  rl.on('line', (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    let msg;
    try {
      msg = JSON.parse(trimmed);
    } catch (_) {
      // Cannot respond without a valid id — ignore malformed input
      return;
    }

    try {
      dispatch(msg, cwd);
    } catch (err) {
      const id = (msg && msg.id) != null ? msg.id : null;
      respondError(id, -32603, `Internal error: ${err.message}`);
    }
  });

  rl.on('close', () => {
    process.exit(0);
  });
}

module.exports = { start };
