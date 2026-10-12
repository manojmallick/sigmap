'use strict';

/**
 * What each agent can tell SigMap about its own usage (#951, SI-4).
 *
 * The one place an agent's capture capability is written down. The sessions
 * report, its coverage panel and the dashboard read these declarations and keep
 * no prose of their own (guard-tested), so a capability that changes is changed
 * here once.
 *
 * A capability is the list of `store.SOURCES` an agent can produce, each with the
 * way it arrives. It is a statement about what SigMap can RECEIVE, never about
 * what a model spent: an agent that can report is still unverifiable, and one
 * that cannot is not zero.
 */

const { PROVENANCE } = require('./store');

const MCP_VIA = 'the log_session_usage MCP tool (session.mcpCapture) or `sigmap session log --from-json`';
const HOOKS_VIA = 'hooks that read its transcript (`sigmap hooks install claude`)';

/**
 * `agent` is the store's agent name (a key of its id prefixes). `match` are
 * lowercase fragments of an MCP client's `clientInfo.name` that identify it.
 * `capture` lists each way usage can reach the store, as a `store.SOURCES` value
 * and how; an empty list means the agent exposes no usage surface, and `note`
 * then says so.
 */
const DECLARATIONS = [
  {
    agent: 'claude-code', name: 'Claude Code', match: ['claude'],
    capture: [{ source: 'transcript', via: HOOKS_VIA }, { source: 'agent-reported', via: MCP_VIA }],
    note: 'measured covers the main conversation only — subagent transcripts are not read',
  },
  { agent: 'cursor', name: 'Cursor', match: ['cursor'], capture: [{ source: 'agent-reported', via: MCP_VIA }], note: null },
  { agent: 'windsurf', name: 'Windsurf', match: ['windsurf'], capture: [{ source: 'agent-reported', via: MCP_VIA }], note: null },
  { agent: 'opencode', name: 'OpenCode', match: ['opencode'], capture: [{ source: 'agent-reported', via: MCP_VIA }], note: null },
  {
    agent: 'codex', name: 'Codex CLI', match: ['codex'], capture: [{ source: 'agent-reported', via: MCP_VIA }],
    note: 'no session-log ingester yet (spike #690)',
  },
  {
    agent: 'gemini', name: 'Gemini CLI', match: ['gemini'], capture: [{ source: 'agent-reported', via: MCP_VIA }],
    note: 'no session-log ingester yet (spike #691)',
  },
  {
    agent: 'copilot', name: 'GitHub Copilot', match: ['copilot'], capture: [],
    note: 'context-size estimate only — Copilot exposes no usage surface',
  },
  {
    agent: 'ci', name: 'CI', match: [], capture: [],
    note: 'a pipeline run has no transcript, so its usage is recorded as unavailable',
  },
];

/** The declaration for a store agent name, or null when it is not declared. */
function forAgent(agent) {
  return DECLARATIONS.find((d) => d.agent === agent) || null;
}

/**
 * The store agent name for an MCP client's `clientInfo.name`, or null when no
 * declaration claims it. Matching is by lowercase fragment; the first
 * declaration that matches wins, in declaration order.
 */
function agentFromClient(clientName) {
  const n = String(clientName == null ? '' : clientName).toLowerCase();
  if (!n) return null;
  const hit = DECLARATIONS.find((d) => d.match.some((m) => n.includes(m)));
  return hit ? hit.agent : null;
}

/** The provenance labels an agent can produce, in declaration order. */
function labelsOf(decl) {
  return decl.capture.map((c) => PROVENANCE[c.source]).filter(Boolean);
}

/** One line of prose for a declaration, built only from its fields. */
function describe(decl) {
  if (decl.capture.length === 0) return `${decl.name}: ${decl.note || 'no usage surface'}`;
  const ways = decl.capture.map((c) => `${PROVENANCE[c.source]} via ${c.via}`).join('; or ');
  return `${decl.name}: ${ways}${decl.note ? `; ${decl.note}` : ''}`;
}

/** An agent that appears in the store with no declaration: SigMap claims nothing about it. */
function describeUndeclared(agent) {
  return `${agent}: not declared — SigMap states no capture capability for it; its figures are whatever each record carries`;
}

module.exports = { DECLARATIONS, MCP_VIA, forAgent, agentFromClient, labelsOf, describe, describeUndeclared };
