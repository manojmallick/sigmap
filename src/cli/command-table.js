'use strict';

/**
 * The canonical CLI vocabulary (#848, closes #817).
 *
 * `--help` used to be a 113-line template literal in `gen-context.js`, kept by
 * hand alongside the `KNOWN_COMMANDS` set the dispatcher guards on — two copies
 * of one fact. The comment above that set already claimed "`sigmap --help`
 * renders from the same vocabulary"; it did not, and the copies drifted:
 * #661 found twelve shipped commands missing from `--help`, #775 found a flag
 * `--help` advertised that the command ignored, and the template itself carried
 * a misaligned `gain --since` line, a literal `%%` left over from a `printf`
 * escape that a template literal never needed, and an adapter list that had
 * fallen a release behind `packages/adapters/`.
 *
 * `USAGE` below is now the only source. `--help` renders from it, the
 * unknown-command guard derives its vocabulary from it, and the guards in
 * `test/integration/command-table.test.js` fail when it and the dispatch chain
 * disagree in either direction.
 *
 * Adding a command means adding a `USAGE` row — there is nowhere else to add it.
 */

/** Column the description starts in, measured from the end of `${cmd}`. */
const DESC_COL = 35;

/**
 * Every `--help` usage line, in display order.
 *
 * `argv` is the invocation after the program name (empty for a bare run);
 * `desc` is the one-line description, in which `{cmd}` stands for the invocation
 * name. The leading bare word of `argv` is the
 * subcommand the line documents, and its `--flags` are the flags that
 * subcommand is advertised as accepting — both are read back out by the guards,
 * so the shape of these strings is a contract, not just presentation.
 */
const USAGE = [
  { argv: '', desc: 'Generate context once and exit' },
  { argv: '--monorepo', desc: 'Generate per-package context (monorepo)' },
  { argv: '--each', desc: 'Run for every repo in the current directory' },
  { argv: '--routing', desc: 'Include model routing hints in output' },
  { argv: '--terse', desc: 'Compact signature encoding (deterministic; line anchors preserved)' },
  { argv: '--format cache', desc: 'Also write Anthropic prompt-cache JSON' },
  { argv: '--track', desc: 'Append run metrics to .context/usage.ndjson' },
  { argv: '--watch', desc: 'Generate + watch for file changes' },
  { argv: '--setup', desc: 'Generate + install git hook + watch' },
  { argv: '--generate', desc: 'Same as a bare run — the flag the installed post-commit hook passes' },
  { argv: 'daemon start|stop|status', desc: 'Run --watch as a detached background daemon (status exits 1 when not running)' },
  { argv: '--mcp', desc: 'Start MCP server on stdio' },
  { argv: '--report', desc: 'Token reduction stats to stdout (exits 1 if over budget)' },
  { argv: '--report --json', desc: 'Token report as JSON (for CI; exits 1 if over budget)' },
  { argv: '--report --history', desc: 'Print usage log summary from .context/usage.ndjson' },
  { argv: '--report --history --chart', desc: 'Include inline SVG charts + Unicode sparklines' },
  { argv: '--dashboard [--out <path>]', desc: 'Write .context/dashboard.html (HTML health dashboard)' },
  { argv: '--suggest-tool "<task>"', desc: 'Recommend model tier for a task description' },
  { argv: '--suggest-tool "<task>" --json', desc: 'Machine-readable tier recommendation' },
  { argv: '--health', desc: 'Print composite health score' },
  { argv: '--health --json', desc: 'Machine-readable health score' },
  { argv: '--ci [--min-coverage N]', desc: 'CI exit gate — exits 1 when indexed coverage is below the threshold (default 80)' },
  { argv: '--ci --json', desc: 'Gate verdict as JSON {pass, coverage, threshold}' },
  { argv: 'gain', desc: 'Token-savings dashboard (totals + by-operation)' },
  { argv: 'gain --all', desc: 'Add daily / weekly / monthly trend tables' },
  { argv: 'gain --json', desc: 'Aggregate savings as JSON' },
  { argv: 'gain --since 7d', desc: 'Window filter (7d, 30d, 12h, or ISO date)' },
  { argv: 'gain --top <n> | --model <name>', desc: 'Limit rows / set $ pricing model' },
  { argv: 'gain --reset', desc: 'Clear the local savings log (.context/gain.ndjson)' },
  { argv: '... --no-track', desc: 'Disable gain savings capture for this run' },
  { argv: '--diff', desc: 'Changed files: working tree vs HEAD' },
  { argv: '--diff <base-ref>', desc: 'Changed files: working tree vs <base-ref> (incl. uncommitted)' },
  { argv: '--diff --staged', desc: 'Changed files: index vs HEAD (staged only)' },
  { argv: '--benchmark', desc: 'Run retrieval benchmark (benchmarks/tasks/retrieval.jsonl)' },
  { argv: '--adapter <name>', desc: 'Generate for a specific adapter only (v3.0+)' },
  { argv: '--adapter <name> --json', desc: 'Show adapter output path as JSON' },
  { argv: '--benchmark --json', desc: 'Benchmark results as JSON' },
  { argv: '--eval', desc: 'Alias for --benchmark' },
  { argv: '--analyze', desc: 'Per-file breakdown: sigs, tokens, extractor, coverage' },
  { argv: '--analyze --json', desc: 'Breakdown as JSON' },
  { argv: '--analyze --slow', desc: 'Re-time each extractor; flag files >50ms' },
  { argv: '--diagnose-extractors', desc: 'Run all 21 extractors vs fixtures; show pass/fail + diff' },
  { argv: '--query "<text>"', desc: 'Rank files by relevance to a query' },
  { argv: '--query "<text>" --json', desc: 'Ranked results as JSON' },
  { argv: '--query "<text>" --top <n>', desc: 'Limit results to top N files (default 10)' },
  { argv: '--query "<text>" --explain', desc: 'Per-file score signals, token coverage and near misses' },
  { argv: 'ask "<query>"', desc: 'Ranked answer with signatures for a question (--json, --top <n>, --mode)' },
  { argv: 'ask "<query>" --explain', desc: 'Diagnose a miss: which tokens matched, why files were demoted' },
  { argv: 'ask "<query>" --with-source', desc: 'Add top-symbol bodies + blast radius (budgeted; --source-budget <n>)' },
  { argv: 'plan "<goal>"', desc: 'Files to inspect, likely-to-change set, and impact radius (--json)' },
  { argv: 'explain <file>', desc: 'Why a file is in or out of the generated context (--json)' },
  { argv: 'run', desc: 'Alias for a bare generate ({cmd} run --report, etc.)' },
  { argv: 'learn --good <files...>', desc: 'Boost files in .context/weights.json' },
  { argv: 'learn --bad <files...>', desc: 'Penalize files in .context/weights.json' },
  { argv: 'learn --reset', desc: 'Delete learned file weights' },
  { argv: 'weights', desc: 'Show learned file multipliers' },
  { argv: 'weights --json', desc: 'Learned weights as JSON' },
  { argv: '--impact <file>', desc: 'Show every file impacted by changing <file>' },
  { argv: '--impact <file> --json', desc: 'Impact as JSON {changed, direct, transitive, tests, routes}' },
  { argv: '--impact <file> --depth <n>', desc: 'BFS depth limit (default 3, 0=unlimited)' },
  { argv: '--callers <symbol>', desc: 'Method-level blast radius — every function that (transitively) calls <symbol> (JS/TS, Python, Java, Go, Rust)' },
  { argv: '--callees <symbol>', desc: 'Every repo function that <symbol> (transitively) calls' },
  { argv: '--callers <symbol> --json --depth <n>', desc: 'Call-graph edges as JSON (depth 0 = unlimited)' },
  { argv: 'verify <answer.md>', desc: 'Flagship grounding guard — flag fake files/tests/imports/symbols/npm-scripts in an AI answer (alias of verify-ai-output)' },
  { argv: 'verify <answer.md> --json', desc: 'Grounding report as JSON (exits 1 if issues)' },
  { argv: 'verify <answer.md> --report', desc: 'Write a standalone HTML report (red/amber/green)' },
  { argv: 'verify-ai-output <answer.md>', desc: 'Full command name for {cmd} verify' },
  { argv: 'validate', desc: 'Check config + index coverage; --query "<text>" also probes retrieval (--json)' },
  { argv: 'judge [--response <f>|-] [--context <f>]', desc: 'Score an AI answer\'s groundedness (stdin ok; --json, --threshold <n>, --learn)' },
  { argv: 'conventions', desc: 'Extract repo file-naming/export/test conventions (--conflicts, --inject, --report, --fix)' },
  { argv: 'scaffold "<name>"', desc: 'Propose a convention-matched file/dir scaffold (--ext, --threshold, --force, --json)' },
  { argv: 'verify-plan <plan.md|->', desc: 'Check a plan vs the live index — files/symbols exist, blast radius, scope (--json)' },
  { argv: 'verify-plan <plan.md> --creates <names>', desc: 'Mark names the plan INTRODUCES (comma-separated) — checked in reverse: they must not exist yet' },
  { argv: 'review-pr', desc: 'Audit a diff — scope drift, god-node edits, missing tests, security files (--staged, --base, --json, --markdown)' },
  { argv: 'review-pr --markdown', desc: 'PR Evidence Report — branded Markdown (signatures + blast radius + tests) to post as a PR comment' },
  { argv: 'create "<task>"', desc: 'Grounded-creation pipeline: scaffold → verify-plan → verify-ai-output → review-pr (--staged, --creates)' },
  { argv: 'wiki', desc: 'Deterministic architecture wiki from signatures + graph — no LLM (--json, --out <path>)' },
  { argv: 'squeeze <file|->', desc: 'Minimize a pasted stacktrace/CI-log/JSON blob (--json for stats)' },
  { argv: 'squeeze --response <file|->', desc: 'Minimize an agent/tool response (same engine; also exposed as the squeeze_output MCP tool)' },
  { argv: 'ask "<query>" --squeeze', desc: 'Auto-accept input minimization (no prompt; for scripts/CI)' },
  { argv: 'ask "<query>" --no-squeeze', desc: 'Disable input minimization entirely' },
  { argv: 'ask "<query>" --squeeze-threshold N', desc: 'Min reduction % to prompt (default 30)' },
  { argv: 'deps', desc: 'List declared dependencies across every manifest at the root' },
  { argv: 'deps --json', desc: 'Same, as machine-readable JSON' },
  { argv: 'sbom', desc: 'CycloneDX 1.5 SBOM on stdout (pipe to osv-scanner for CVEs)' },
  { argv: 'sbom --out sbom.json', desc: 'Write the SBOM to a file (--exact-only, --no-dev)' },
  { argv: 'evidence "<query>"', desc: 'Build a deterministic Evidence Pack (JSON) → .context/evidence-pack.json' },
  { argv: 'evidence "<query>" --markdown', desc: 'Emit the Markdown handoff rendering to stdout' },
  { argv: 'evidence "<query>" --top <n> --budget <n> --out <path>', desc: 'Tune ranked files / token budget / write rendered output' },
  { argv: 'memory', desc: 'List cross-session stores (.context/) — entries, size, age' },
  { argv: 'memory --clear <store>', desc: 'Clear one store: session|notes|weights|evidence|all (--json supported)' },
  { argv: 'budget', desc: 'Session spend ledger — estimated SigMap-emitted tokens, budget, context age (--json)' },
  { argv: 'budget --budget <tokens>', desc: 'One-off budget override (config: sessionBudgetTokens, contextTtlDays)' },
  { argv: 'redact [file]', desc: 'Mask secrets in a file or stdin (10-pattern bank); redacted text to stdout (--json)' },
  { argv: 'tune', desc: 'Recommend config from repo detection — srcDirs, monorepo, adapters, exclude, budget (--json)' },
  { argv: 'tune --apply', desc: 'Write the recommendations into gen-context.config.json (merges; your keys preserved)' },
  { argv: 'skills list', desc: 'List skill clients (Claude/Cursor/Windsurf/Copilot/AGENTS.md) and install state (--json)' },
  { argv: 'skills install', desc: 'Install the SigMap agent playbooks for detected clients (--client <name> | --all)' },
  { argv: 'lines <file> <start>-<end>', desc: 'Print an exact line range — CLI twin of get_lines (secrets redacted)' },
  { argv: 'lines <file> :<line> --context <n>', desc: 'Window around one signature anchor (default ±10)' },
  { argv: 'note "<text>"', desc: 'Append a note to the cross-session decision log' },
  { argv: 'note', desc: 'List recent notes (also: note --list <N>)' },
  { argv: 'history', desc: 'Recent usage-log entries with a sparkline (--last <n>, --json)' },
  { argv: 'compare', desc: 'SigMap vs baseline benchmark; outside the source checkout shows local history (--run, --json)' },
  { argv: 'share', desc: 'Shareable one-liner with your live numbers (copied to clipboard)' },
  { argv: 'bench --submit', desc: 'Format local benchmark history as a shareable community block' },
  { argv: 'roots', desc: 'Detect source roots for this repo (--fix, --json)' },
  { argv: 'sync', desc: 'Write every adapter output + llms.txt and print a compact diff' },
  { argv: 'suggest-profile', desc: 'Infer the task profile from staged changes (--short)' },
  { argv: 'status', desc: 'Show repo state — branch, dirty files, index freshness, notes' },
  { argv: 'doctor', desc: 'Diagnose config, index, freshness, coverage, MCP wiring — with fixes (--json; exits 1 on hard failure)' },
  { argv: 'mcp list', desc: 'List MCP clients and their config paths (--json)' },
  { argv: 'mcp install <client>', desc: 'Wire MCP for one client (claude|cursor|windsurf|vscode|zed|codex|gemini|opencode|mcp); --global for user-level' },
  { argv: '--init', desc: 'Write example config + .contextignore scaffold' },
  { argv: '--help', desc: 'Show this message' },
  { argv: '--version', desc: 'Show version' },
];

/**
 * Subcommands that only dispatch when a required flag is present — without the
 * flag they are not commands at all, so the guard must not accept them bare.
 */
const FLAG_GATED = [
  ['bench', '--submit'],
];

/** The prose that follows the usage list. `{adapters}` is substituted at render time. */
const SECTIONS = `
Strategies (set via config "strategy" key):
  "full"        Single file, all signatures. Works everywhere. (default)
  "index"       Always-on file is a MAP only (~500 tokens): modules, entry
                points, versions, how to retrieve. Every signature stays in
                .context/sig-index.json and is pulled per question via
                "sigmap ask". Largest always-on saving; needs the agent to
                actually run "sigmap ask" (or the MCP tools).
  "per-module"  One .github/context-<module>.md per srcDir + thin overview.
                ~70% fewer tokens per question. No MCP needed.
  "hot-cold"    Hot (recently changed) auto-injected; cold in .github/context-cold.md
                ~90% fewer tokens. Best with MCP (Claude Code, Cursor).
                Set "hotCommits": N to control how many commits count as hot (default 10).

Adapters (v3.0+): {adapters}
  Set "adapters": ["copilot","openai","codex"] in config to write multiple adapter outputs.
  Old "outputs" config key is still accepted (maps to adapters automatically).

Config: gen-context.config.json
Ignore: .contextignore, .repomixignore
Output: .github/copilot-instructions.md (default)
`;

/**
 * Flags that mean "a bare run". Nothing in the dispatch chain reads them — they
 * fall through to the default generate — so the guard that greps the CLI core for
 * every advertised flag exempts exactly these, and command-table.test.js proves
 * each one by running it against a bare run instead (#918).
 *
 * `--generate` is the flag the post-commit hook written by `--setup` passes. It
 * is the v0.1.0 spelling (packages/core/README.md promises it unchanged), so
 * every hook ever installed depends on it.
 */
const BARE_RUN_ALIASES = ['--generate'];

/** Bare-word tokens that lead a usage line but are not subcommands. */
const NOT_A_COMMAND = new Set(['...']);

/**
 * The subcommand a usage line documents, or null for the flag forms and the
 * bare generate.
 * @param {string} argv
 * @returns {string|null}
 */
function commandOf(argv) {
  const first = String(argv).trim().split(/\s+/)[0] || '';
  if (!/^[a-z][a-z-]*$/.test(first) || NOT_A_COMMAND.has(first)) return null;
  return first;
}

/**
 * Long flags a usage line advertises. Short forms and `<n>`-style placeholders
 * are not flags and are skipped.
 * @param {string} argv
 * @returns {string[]}
 */
function flagsOf(argv) {
  return String(argv).split(/\s+/).filter((t) => /^--[a-z][a-z-]*$/.test(t));
}

/**
 * Every bare-word subcommand the CLI accepts bare, sorted — the vocabulary the
 * unknown-command guard is built from (#655). Flag-gated names are excluded:
 * they dispatch only with their flag, and the guard handles them separately.
 * @returns {string[]}
 */
function commandNames() {
  const gated = new Set(FLAG_GATED.map(([name]) => name));
  const out = new Set();
  for (const row of USAGE) {
    const c = commandOf(row.argv);
    if (c && !gated.has(c)) out.add(c);
  }
  return [...out].sort();
}

/**
 * The flag-gated subcommands as `Map` entries.
 * @returns {Array<[string, string]>}
 */
function flagGated() {
  return FLAG_GATED.map(([name, flag]) => [name, flag]);
}

/**
 * The flags advertised for one subcommand, or the global flags when `name` is
 * null — the set the flag-acceptance guard checks against the dispatch chain.
 * @param {string|null} name
 * @returns {string[]}
 */
function flagsFor(name) {
  const out = new Set();
  for (const row of USAGE) {
    if (commandOf(row.argv) !== (name || null)) continue;
    for (const f of flagsOf(row.argv)) out.add(f);
  }
  return [...out].sort();
}

/**
 * One rendered usage line: `  <cmd> <argv>` with the description aligned to
 * `DESC_COL`, falling back to a two-space gap when `argv` overflows the column.
 * @param {string} cmd
 * @param {{argv: string, desc: string}} row
 * @returns {string}
 */
function usageLine(cmd, row) {
  const left = row.argv ? ` ${row.argv}` : '';
  const pad = left.length >= DESC_COL ? `${left}  ` : left.padEnd(DESC_COL);
  return `  ${cmd}${pad}${row.desc.split('{cmd}').join(cmd)}`;
}

/**
 * Render the whole `--help` body from the table.
 * @param {{cmd?: string, version?: string, adapters?: string[]}} [opts]
 * @returns {string}
 */
function renderHelp(opts = {}) {
  const cmd = opts.cmd || 'node gen-context.js';
  const version = opts.version || '';
  const adapters = (opts.adapters && opts.adapters.length ? opts.adapters : ['copilot']).join(' | ');
  const header = cmd === 'node gen-context.js'
    ? `SigMap — gen-context.js v${version}`
    : `SigMap v${version}  (${cmd})`;
  return [
    '',
    header,
    'Zero-dependency AI context engine',
    '',
    'Usage:',
    ...USAGE.map((row) => usageLine(cmd, row)),
    SECTIONS.replace('{adapters}', adapters),
  ].join('\n');
}

module.exports = {
  USAGE, FLAG_GATED, SECTIONS, DESC_COL, BARE_RUN_ALIASES,
  commandOf, flagsOf, commandNames, flagGated, flagsFor, usageLine, renderHelp,
};
