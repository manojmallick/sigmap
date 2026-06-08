'use strict';

/**
 * MCP tool definitions for SigMap (11 tools).
 * read_context, search_signatures, get_map, create_checkpoint, get_routing,
 * explain_file, list_modules, query_context, get_impact, get_lines, read_memory.
 */

const TOOLS = [
  {
    name: 'read_context',
    description:
      'Read extracted code signatures for the project or a specific module path. ' +
      'Returns the full copilot-instructions.md content (~500–4K tokens) or a ' +
      'filtered subset when a module path is provided (~50–500 tokens).',
    inputSchema: {
      type: 'object',
      properties: {
        module: {
          type: 'string',
          description:
            'Optional subdirectory path to scope results (e.g. "src/services"). ' +
            'Omit to get the full codebase context.',
        },
      },
      required: [],
    },
  },
  {
    name: 'search_signatures',
    description:
      'Search extracted code signatures for a keyword, function name, or class name. ' +
      'Returns matching signature lines with their file paths.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Keyword to search for in signatures (case-insensitive).',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_map',
    description:
      'Read a section from PROJECT_MAP.md — import graph, class hierarchy, or route table. ' +
      'Requires gen-project-map.js to have been run first.',
    inputSchema: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['imports', 'classes', 'routes'],
          description: 'Which section to retrieve: imports, classes, or routes.',
        },
      },
      required: ['type'],
    },
  },
  {
    name: 'create_checkpoint',
    description:
      'Create a session checkpoint summarising current project state. ' +
      'Returns recent git commits, active branch, token count, and a ' +
      'compact snapshot of the codebase context — ideal for session handoffs ' +
      'or periodic saves during long coding sessions.',
    inputSchema: {
      type: 'object',
      properties: {
        note: {
          type: 'string',
          description: 'Optional free-text note to include in the checkpoint (e.g. what you were working on).',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_routing',
    description:
      'Get model routing hints for this project — which files belong to which complexity ' +
      'tier (fast/balanced/powerful) and which AI model to use for each type of task. ' +
      'Helps reduce API costs by 40–80% by routing simple tasks to cheaper models.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'explain_file',
    description:
      'Explain a specific file: returns its extracted signatures, direct imports ' +
      '(files it depends on), and callers (files that import it). ' +
      'Ideal for understanding a file in isolation without reading raw source. ' +
      'Requires the context file to have been generated first.',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description:
            'Relative path from the project root (e.g. "src/services/auth.ts"). ' +
            'Use the paths shown in read_context output.',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'list_modules',
    description:
      'List all top-level modules (srcDirs) present in the context file, ' +
      'sorted by token count descending. Use this to decide which module to ' +
      'pass to read_context before querying a specific area of the codebase.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'query_context',
    description:
      'Rank and return the most relevant files for a specific task or question. ' +
      'Uses keyword + symbol + path scoring to surface only the top-K files relevant ' +
      'to the query — much cheaper than reading all context. ' +
      'Returns ranked file list with signatures and relevance scores.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description:
            'Natural language task description or keyword(s) to rank files against. ' +
            'E.g. "add a new language extractor", "fix secret scanning", "auth module".',
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
    name: 'get_impact',
    description:
      'Show every file that is impacted when a given file changes — direct importers, ' +
      'transitive importers, affected tests, and affected routes/controllers. ' +
      'Gives agents instant blast-radius awareness before making a change. ' +
      'Handles circular dependencies safely (no infinite loops).',
    inputSchema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          description:
            'Relative path from the project root of the file that changed ' +
            '(e.g. "src/extractors/python.js"). Use forward slashes.',
        },
        depth: {
          type: 'number',
          description: 'BFS traversal depth limit (default: 3). Use 0 for unlimited.',
        },
      },
      required: ['file'],
    },
  },
  {
    name: 'get_lines',
    description:
      'Fetch an exact line range from a source file on demand — the Surgical Context ' +
      'workhorse. Signatures carry `path:start-end` anchors; call this to read just those ' +
      'lines instead of re-opening the whole file. Lines are clamped to the file bounds and ' +
      'secret-scanned (redacted) before return. Path is sandboxed to the project root.',
    inputSchema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          description:
            'Relative path from the project root (e.g. "src/config/loader.js"). ' +
            'Use the path shown in a signature anchor. Use forward slashes.',
        },
        start: {
          type: 'number',
          description: '1-based start line (inclusive). Clamped to the file bounds.',
        },
        end: {
          type: 'number',
          description: '1-based end line (inclusive). Clamped to the file bounds.',
        },
      },
      required: ['file', 'start', 'end'],
    },
  },
  {
    name: 'read_memory',
    description:
      'Recall the project decision log — recent notes left by humans or agents ' +
      'across sessions (via `sigmap note`), plus the last ranking-session focus. ' +
      'Call this at the start of a task to kill cold-start: it answers ' +
      '"what were we doing and why" without re-reading the whole codebase.',
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
];

module.exports = { TOOLS };
