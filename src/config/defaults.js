'use strict';

/**
 * Default configuration values for SigMap.
 * All keys documented here. Override via gen-context.config.json.
 */
const DEFAULTS = {
  // Primary output file (used when outputs includes 'copilot')
  output: '.github/copilot-instructions.md',

  // Output targets: 'copilot' | 'claude' | 'cursor' | 'windsurf'
  outputs: ['copilot'],

  // Adapter targets (v3.0+): replaces 'outputs'. Same names, adds 'openai' | 'gemini'.
  // Old 'outputs' config key is still accepted and silently maps to 'adapters'.
  adapters: null,

  // Directories to scan (relative to project root)
  srcDirs: [
    'src', 'app', 'lib', 'packages', 'services', 'api',
    // common monorepo / multi-project top-level names
    'server', 'client', 'web', 'frontend', 'backend',
    'desktop', 'mobile', 'shared', 'common', 'core',
    'workers', 'functions', 'lambda', 'cmd',
    // framework convention folders
    'pages', 'components', 'hooks', 'routes', 'controllers',
    'models', 'views', 'resources', 'config', 'db',
    'projects', 'apps', 'libs', 'instance', 'blueprints',
    // JVM project structures (Java, Kotlin, Scala)
    'src/main/java', 'src/main/kotlin', 'src/main/scala',
    'app/src/main/java', 'app/src/main/kotlin',
    'src/test/java', 'src/test/kotlin',
  ],

  // Directory/file names to exclude entirely
  exclude: [
    'node_modules', '.git', 'dist', 'build', 'out',
    '__pycache__', '.next', 'coverage', 'target', 'vendor',
    '.context',
    // CI/test artifacts
    'playwright-tmp', 'playwright-report', 'test-results',
    // build/monorepo caches
    '.turbo',
    // documentation build output
    'storybook-static', '.docusaurus',
  ],

  // Maximum directory depth to recurse
  maxDepth: 6,

  // Maximum signatures extracted per file
  maxSigsPerFile: 25,

  // Maximum tokens in final output before budget enforcement kicks in.
  // Used only when autoMaxTokens is false, or as a floor for auto-scaling.
  maxTokens: 6000,

  // Automatically scale the token budget based on repo size.
  // When true, SigMap targets `coverageTarget` fraction of source files and
  // raises the budget up to `modelContextLimit * maxTokensHeadroom`.
  // Set to false (or set maxTokens explicitly) to pin the budget.
  autoMaxTokens: true,

  // Fraction of source files to target for inclusion (0.0–1.0).
  // 0.80 = include at least 80% of source files in the context output.
  coverageTarget: 0.80,

  // Model context window size (tokens). Used to compute the hard cap:
  //   hardCap = modelContextLimit × maxTokensHeadroom
  // Default: GPT-4o / Claude Sonnet (128K). Set higher for Gemini 1M etc.
  modelContextLimit: 128000,

  // Fraction of the model context window reserved for SigMap output.
  // Leaves the remaining fraction for the conversation, system prompt, etc.
  // Default 0.20 = 20% of 128K = 25,600 token hard cap.
  maxTokensHeadroom: 0.20,

  // Scan signatures for secrets and redact matches
  secretScan: true,

  // Auto-detect monorepo packages and write per-package output files
  monorepo: false,

  // Sort recently git-committed files higher in output
  diffPriority: true,

  // Context strategy controls how the output is split and injected.
  // 'index'      -> always-on file is a MAP only (modules, entry points,
  //                 versions, retrieval commands); every signature stays in
  //                 .context/sig-index.json and is pulled per question by
  //                 `sigmap ask`. Largest always-on saving (#1a, v8.50).
  // 'full'       -> single context file (default)
  // 'per-module' -> one context-<module>.md per top-level srcDir + thin overview
  // 'hot-cold'   -> recent files in primary output, older files in context-cold.md
  strategy: 'full',

  // For hot-cold strategy: how many recent git commits count as "hot"
  hotCommits: 10,

  // Debounce delay (ms) between file-system events and regeneration in watch mode
  watchDebounce: 300,

  // Append model routing hints section to the context output
  // Routes files to fast/balanced/powerful model tiers based on complexity
  routing: false,

  // sigmap judge — verdict threshold and the --learn boost/penalize band (J2).
  // The band is measured, not hand-picked: answers built from ≥ ~80% context-
  // grounded vocabulary score above learnBoostAbove, answers under ~30%
  // grounded score below learnPenalizeBelow (guard-tested on a mixture corpus
  // drawn from the repo's own signatures — see judge.test.js). CLI flags
  // override; scores between the two bounds neither boost nor penalize.
  judge: {
    threshold: 0.25,          // verdict pass/fail floor (--threshold overrides)
    learnBoostAbove: 0.75,    // --learn boosts context files above this score
    learnPenalizeBelow: 0.40, // --learn penalizes context files below this score
  },

  // Output format: 'default' (markdown only) | 'cache' (also write Anthropic prompt-cache JSON)
  format: 'default',

  // Append run metrics to .context/usage.ndjson after each generate
  tracking: false,

  // Session spend ledger (`sigmap budget` / MCP get_budget). Estimates only —
  // counts tokens SigMap emitted (chars/4), not the host chat's total spend.
  // Number → warn threshold for estimated SigMap-emitted tokens per session.
  sessionBudgetTokens: null,

  // Number of days before generated context counts as stale in budget output.
  contextTtlDays: null,

  // MCP server configuration
  mcp: {
    autoRegister: true,
  },

  // Include a compact import dependency map at top of output
  depMap: true,

  // Include a compact `name@version` list of installed direct deps (D8)
  versionPins: true,

  // Terse signature encoding — deterministic compaction of sig lines (D7, opt-in)
  terse: false,

  // Include TODO/FIXME/HACK/XXX comments as compact section
  todos: true,

  // Include compact recent git changes section
  changes: true,

  // Number of commits used for changes section
  changesCommits: 10,

  // Add test coverage markers to extracted function signatures (opt-in)
  testCoverage: false,

  // Directories scanned for tests when testCoverage is enabled
  testDirs: ['tests', 'test', '__tests__', 'spec'],

  // Enable incremental signature cache (v6.7) - only re-extract changed files
  sigCache: false,

  // Add reverse dependency usage hints on file headings (opt-in)
  impactRadius: false,

  // Query-aware retrieval settings (v2.3)
  retrieval: {
    // Maximum number of files to return for --query
    topK: 10,
    // Multiplier applied to recently-changed files (>1 boosts them up)
    recencyBoost: 1.5,
    // Boost files call-graph-connected to query matches (opt-in, measure-gated)
    callGraphBoost: false,
    // Blend import-graph centrality into ranking as a small prior (opt-in, measure-gated)
    centralityBlend: false,
    // Append route pseudo-signatures to the rankable index (opt-in, measure-gated)
    surfaceEnrichment: false,
    // Repo-mined query expansion: per-repo co-occurrence synonyms cached in
    // .context/mined-expansions.json (B2, opt-in, measure-gated)
    minedExpansions: false,
  },

  // Host-toolchain exactness tiers (#542 T2, opt-in, silent regex fallback).
  // typescript: parse .ts with the TARGET repo's own node_modules/typescript
  // (the user's install, never bundled). Byte-stability then holds per
  // toolchain version, and the generated header labels the version used.
  exactness: {
    typescript: false,
    // T3 spike (#612): LSP documentSymbol via a server already on the machine
    // (clangd/gopls/rust-analyzer), cached per content hash + server binary,
    // silent regex fallback. lspServers lays { ".ext": ["cmd", ...] } entries
    // over the built-in registry — commands are spawned directly, never a shell.
    lsp: false,
    lspServers: {},
    // T4 spike (#618): read a CI-produced index.scip at the repo root as a
    // signature source (import only) — compiler-typed signatures, same
    // per-file never-lose-vs-regex guard as the LSP tier.
    scip: false,
  },

  // Impact layer settings (v2.5)
  impact: {
    // BFS traversal depth limit for --impact (0 = unlimited)
    depth: 3,
    // Include signatures of impacted files in --impact output
    includeSigs: true,
  },
};

module.exports = { DEFAULTS };
