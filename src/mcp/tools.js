'use strict';

/**
 * MCP tool definitions for SigMap (22 tools).
 * read_context, search_signatures, get_map, create_checkpoint, get_routing,
 * explain_file, list_modules, query_context, get_method_impact, get_impact,
 * get_lines, read_memory, get_callee_signatures, sigmap_notify_file_created,
 * sigmap_notify_symbol_added, sigmap_notify_file_deleted, get_diff_context,
 * get_architecture_overview, verify_suggestion, squeeze_output, get_budget,
 * query_knowledge_map.
 *
 * Every definition is paid for in tokens at the start of every MCP session (#878),
 * so a description says what the tool returns and when to reach for it — nothing
 * else. Names, parameters, enums and `required` are the contract; the wording is
 * not. Which of these a server advertises is `mcp.tools` (see ./profile.js).
 */

const TOOLS = [
  {
    name: 'read_context',
    description:
      'Read extracted code signatures for the whole project, or only a module path ' +
      '(~50–500 tokens scoped, ~500–4K for everything).',
    inputSchema: {
      type: 'object',
      properties: {
        module: {
          type: 'string',
          description: 'Optional subdirectory (e.g. "src/services"). Omit for the full context.',
        },
      },
      required: [],
    },
  },
  {
    name: 'search_signatures',
    description:
      'Search extracted signatures for a keyword, function name or class name; ' +
      'returns matching lines with their file paths.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Keyword (case-insensitive).',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_map',
    description:
      'Read a section of PROJECT_MAP.md: import graph, class hierarchy or route table. ' +
      'Needs gen-project-map.js to have been run.',
    inputSchema: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['imports', 'classes', 'routes'],
          description: 'Section to retrieve: imports, classes or routes.',
        },
      },
      required: ['type'],
    },
  },
  {
    name: 'create_checkpoint',
    description:
      'Snapshot project state for a session handoff: recent commits, branch, ' +
      'token count and a compact context.',
    inputSchema: {
      type: 'object',
      properties: {
        note: {
          type: 'string',
          description: 'Optional note to include (e.g. what you were working on).',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_routing',
    description:
      'Model routing hints: which files sit in which complexity tier ' +
      '(fast/balanced/powerful) and which model suits each type of task.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'explain_file',
    description:
      'Explain one file without reading its source: its signatures, what it imports ' +
      'and what imports it. Needs a generated context file.',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Project-relative path (e.g. "src/services/auth.ts"), as shown in read_context.',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'list_modules',
    description:
      'List the top-level modules (srcDirs) in the context file by token count, ' +
      'to pick a module for read_context.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'query_context',
    description:
      'Rank files for a task or question and return the top-K with signatures and ' +
      'relevance scores — far cheaper than reading all context.',
    _meta: { 'anthropic/alwaysLoad': true },
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Task description or keywords (e.g. "add a new language extractor", "auth module").',
        },
        topK: {
          type: 'number',
          description: 'Maximum number of files to return (default: 10, max: 25).',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_method_impact',
    description:
      'Method-level blast radius for a symbol: every function that (transitively) calls it, ' +
      'or with direction "callees" every repo function it calls. Finer than get_impact — ' +
      'which functions break, not just which files. JS/TS, Python, Java, Go, Rust; deterministic.',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          description:
            'Function/method name, or "file#name" to disambiguate ' +
            '(e.g. "src/auth/session.js#validateToken").',
        },
        direction: {
          type: 'string',
          enum: ['callers', 'callees'],
          description: '"callers" (default) = blast radius; "callees" = what the symbol calls.',
        },
        depth: {
          type: 'number',
          description: 'BFS depth limit (default 0 = unlimited).',
        },
      },
      required: ['symbol'],
    },
  },
  {
    name: 'get_impact',
    description:
      'Blast radius of changing a file — check it before an edit: direct and transitive ' +
      'importers, affected tests, routes and controllers.',
    inputSchema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          description: 'Project-relative path of the changed file, forward slashes (e.g. "src/extractors/python.js").',
        },
        depth: {
          type: 'number',
          description: 'BFS depth limit (default: 3). Use 0 for unlimited.',
        },
      },
      required: ['file'],
    },
  },
  {
    name: 'get_lines',
    description:
      'Fetch an exact line range from a file — use the `path:start-end` anchors in signatures ' +
      'instead of re-opening the whole file. Clamped to the file bounds, secret-redacted, ' +
      'sandboxed to the project root.',
    inputSchema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          description: 'Project-relative path, forward slashes (e.g. "src/config/loader.js"), as in a signature anchor.',
        },
        start: {
          type: 'number',
          description: '1-based start line (inclusive).',
        },
        end: {
          type: 'number',
          description: '1-based end line (inclusive).',
        },
      },
      required: ['file', 'start', 'end'],
    },
  },
  {
    name: 'read_memory',
    description:
      'Recall the project decision log — recent notes left across sessions (via `sigmap note`) ' +
      'plus the last ranking-session focus. Call at the start of a task to answer ' +
      '"what were we doing and why" without re-reading the codebase.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'How many of the most recent notes to return (default: 10, max: 50).',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_callee_signatures',
    description:
      'Return the EXACT current signature(s) of named symbols from the index, so you never ' +
      "guess a callee's parameter types from memory. Call before writing code that uses a " +
      'symbol; unknown names get a closest-match suggestion.',
    inputSchema: {
      type: 'object',
      properties: {
        symbols: {
          type: 'array',
          items: { type: 'string' },
          description: 'Symbol names to resolve (e.g. ["validateToken", "UserService"]).',
        },
      },
      required: ['symbols'],
    },
  },
  {
    name: 'sigmap_notify_file_created',
    description:
      'Call after writing or changing a file so its signatures are indexed live for this ' +
      'session (new symbols become resolvable by search_signatures / get_callee_signatures).',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path relative to the project root.' },
        content: { type: 'string', description: 'Optional file content; read from disk if omitted.' },
      },
      required: ['path'],
    },
  },
  {
    name: 'sigmap_notify_symbol_added',
    description:
      'Fast path: register one new symbol signature in the live index without re-reading the file.',
    inputSchema: {
      type: 'object',
      properties: {
        signature: { type: 'string', description: 'The signature line (e.g. "function check(key)").' },
        file: { type: 'string', description: 'File path the symbol belongs to (relative to root).' },
        line: { type: 'number', description: 'Optional 1-based line number.' },
      },
      required: ['signature', 'file'],
    },
  },
  {
    name: 'sigmap_notify_file_deleted',
    description:
      'Tell SigMap a file was deleted so its symbols leave the live index.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Deleted file path relative to the project root.' },
      },
      required: ['path'],
    },
  },
  {
    name: 'get_diff_context',
    description:
      'For every changed file (working tree, staged, or vs a base ref): its current signatures ' +
      'plus blast radius — importers, affected tests/routes — with a risk label. One call for ' +
      'a code review or a safe edit. Lists changed files shell-free.',
    inputSchema: {
      type: 'object',
      properties: {
        base: {
          type: 'string',
          description: 'Optional git ref to diff against (e.g. "main"): files changed between it and the WORKING TREE, committed and uncommitted alike. Omit for working-tree changes vs HEAD.',
        },
        staged: {
          type: 'boolean',
          description: 'When true (and no base), report only staged changes (`git diff --cached`).',
        },
        depth: {
          type: 'number',
          description: 'Blast-radius BFS depth limit (default: 2). Use 0 for unlimited.',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_architecture_overview',
    description:
      'One-call map of the codebase: module breakdown (files/tokens), the most depended-on ' +
      'hub files, dependency-cycle count and route totals. Extends get_map; use it to orient ' +
      'before read_context / query_context.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'verify_suggestion',
    description:
      'Ground an AI code suggestion before writing it: check a snippet or answer against the ' +
      'repository AND the libraries actually installed in node_modules. Flags fake file paths, ' +
      'unresolvable imports, symbols in neither the repo nor the installed libraries, and ' +
      'non-existent npm scripts. Deterministic, offline, no LLM.',
    inputSchema: {
      type: 'object',
      properties: {
        code: {
          type: 'string',
          description: 'The suggested code snippet or answer text to verify.',
        },
      },
      required: ['code'],
    },
  },
  {
    name: 'squeeze_output',
    description:
      'Compress noisy output (stack trace, CI/build log, JSON payload) before it enters context: ' +
      'keeps error frames, failing steps and JSON shape, strips the noise, adds the top frame\'s ' +
      'signature. Returns the squeezed text plus reduction stats; unchanged when nothing is ' +
      'squeezable. Deterministic, offline.',
    inputSchema: {
      type: 'object',
      properties: {
        content: {
          type: 'string',
          description: 'The raw output to compress.',
        },
      },
      required: ['content'],
    },
  },
  {
    name: 'get_budget',
    description:
      'Session spend ledger: estimated tokens SigMap has emitted this session (chars/4, local ' +
      'gain log — NOT the whole chat), optional budget remaining, and context freshness. ' +
      'Check mid-session and degrade gracefully near budget (terse encoding, squeeze, summarize).',
    inputSchema: {
      type: 'object',
      properties: {
        session: {
          type: 'string',
          description: 'Session key to report on (default: SIGMAP_SESSION env or the UTC day bucket).',
        },
        budgetTokens: {
          type: 'number',
          description: 'Budget override in estimated tokens (default: config sessionBudgetTokens).',
        },
      },
      required: [],
    },
  },
  {
    name: 'query_knowledge_map',
    description:
      'Query the typed knowledge map: nodes (file, symbol, library@version, route, env-var, ' +
      'migration, script) and edges (imports, calls, defines, tests, uses-lib, exposes-route, ' +
      'reads-env). { library } = upgrade impact (lib → importing files → callers → covering ' +
      'tests); { file } = a file\'s typed neighbors; { env } = files reading an environment ' +
      'variable. Deterministic, cached in .context, local-only.',
    inputSchema: {
      type: 'object',
      properties: {
        library: { type: 'string', description: 'Declared dependency name for the upgrade-impact walk' },
        file: { type: 'string', description: 'Repo-relative file path for a typed-neighbors view' },
        env: { type: 'string', description: 'Environment variable name — which files read it, and whether a committed .env example declares it' },
      },
    },
  },
];

/**
 * The capture tool (#951, SI-2b). Deliberately NOT in TOOLS: it is advertised
 * only when `session.mcpCapture` is on, so a project that does not capture
 * sessions pays none of its definition tokens (#878) and the 22-tool surface
 * every client sees by default does not move.
 */
const LOG_SESSION_USAGE = {
  name: 'log_session_usage',
  description:
    "Record this session's own token usage in SigMap's session store, labelled " +
    'agent-reported (SigMap cannot verify it). Call at the end of a task with the ' +
    'running session totals; a later call for the same session replaces the earlier ' +
    'one. Omit usage when unknown: it is recorded as unavailable, never as zero.',
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Session id. Omit to use one id for this MCP connection.' },
      model: { type: 'string', description: 'Model name as the host reports it.' },
      usage: {
        type: 'object',
        description: 'Billed tokens so far, per request category.',
        properties: {
          in: { type: 'number' },
          out: { type: 'number' },
          cacheRead: { type: 'number', description: 'Omit if the host does not report it.' },
          cacheWrite: { type: 'number', description: 'Omit if the host does not report it.' },
        },
        required: ['in', 'out'],
      },
    },
    required: [],
  },
};

module.exports = { TOOLS, LOG_SESSION_USAGE };
