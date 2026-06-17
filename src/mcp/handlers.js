'use strict';

const fs   = require('fs');
const path = require('path');
const { git } = require('../util/git');

const CONTEXT_FILE = path.join('.github', 'copilot-instructions.md');
const CONTEXT_COLD_FILE = path.join('.github', 'context-cold.md');

function _readContextFiles(cwd) {
  const paths = [path.join(cwd, CONTEXT_FILE), path.join(cwd, CONTEXT_COLD_FILE)];
  const chunks = [];
  for (const p of paths) {
    if (fs.existsSync(p)) chunks.push(fs.readFileSync(p, 'utf8'));
  }
  return chunks.join('\n');
}

// Section header keywords in PROJECT_MAP.md
const MAP_SECTIONS = {
  imports: '### Import graph',
  classes: '### Class hierarchy',
  routes: '### Route table',
};

/**
 * read_context({ module? }) → string
 *
 * Returns the full context file, or just the sections whose file paths
 * contain the given module substring.
 */
function readContext(args, cwd) {
  const content = _readContextFiles(cwd);
  if (!content) {
    return 'No context file found. Run: node gen-context.js';
  }

  if (!args || !args.module) return content;

  const mod = args.module.replace(/\\/g, '/').replace(/\/$/, '');
  const lines = content.split('\n');
  const result = [];
  let capturing = false;

  for (const line of lines) {
    if (line.startsWith('### ')) {
      const filePath = line.slice(4).trim().replace(/\\/g, '/');
      // Match if file path starts with mod or contains /mod/ or /mod
      capturing =
        filePath === mod ||
        filePath.startsWith(mod + '/') ||
        filePath.includes('/' + mod + '/') ||
        filePath.includes('/' + mod);
      if (capturing) result.push(line);
      continue;
    }
    if (capturing) result.push(line);
  }

  if (result.length === 0) return `No signatures found for module: ${mod}`;
  return result.join('\n');
}

/**
 * search_signatures({ query }) → string
 *
 * Case-insensitive search through all signature lines.
 * Returns matching lines grouped by file path.
 */
function searchSignatures(args, cwd) {
  if (!args || !args.query) return 'Missing required argument: query';

  const query = args.query.toLowerCase();
  try {
    try { require('../cache/freshen').freshen(cwd); } catch (_) {}
    const { buildSigIndex } = require('../retrieval/ranker');
    const index = buildSigIndex(cwd);
    if (index.size === 0) {
      return 'No context file found. Run: node gen-context.js';
    }

    const result = [];
    for (const [file, sigs] of index.entries()) {
      const hits = sigs.filter((s) => s.toLowerCase().includes(query));
      if (hits.length === 0) continue;
      if (result.length > 0) result.push('');
      result.push(`### ${file}`);
      result.push(...hits);
    }

    if (result.length === 0) return `No signatures found matching: ${args.query}`;
    return result.join('\n');
  } catch (err) {
    return `_search_signatures failed: ${err.message}_`;
  }
}

/**
 * get_map({ type }) → string
 *
 * Returns a section from PROJECT_MAP.md.
 * type: 'imports' | 'classes' | 'routes'
 */
function getMap(args, cwd) {
  if (!args || !args.type) return 'Missing required argument: type';

  const header = MAP_SECTIONS[args.type];
  if (!header) {
    return `Unknown map type: "${args.type}". Use: imports, classes, routes`;
  }

  const mapPath = path.join(cwd, 'PROJECT_MAP.md');
  if (!fs.existsSync(mapPath)) {
    return 'PROJECT_MAP.md not found. Run: node gen-project-map.js';
  }

  const content = fs.readFileSync(mapPath, 'utf8');
  const idx = content.indexOf(header);
  if (idx === -1) {
    return `Section "${header}" not found in PROJECT_MAP.md`;
  }

  // Extract from this header to the next ### header
  const after = content.slice(idx);
  const nextMatch = after.slice(header.length).search(/\n###\s/);
  return nextMatch === -1 ? after : after.slice(0, header.length + nextMatch);
}

/**
 * create_checkpoint({ note? }) → string
 *
 * Returns a markdown checkpoint summarising current project state:
 * - Timestamp and optional user note
 * - Active git branch + last 5 commit messages
 * - Token count of current context file
 * - List of modules present in the context
 * - Route count (if PROJECT_MAP.md exists)
 */
function createCheckpoint(args, cwd) {
  const note = (args && args.note) ? args.note.trim() : '';
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
  const lines = [
    '# SigMap Checkpoint',
    `**Created:** ${now}`,
  ];

  if (note) lines.push(`**Note:** ${note}`);
  lines.push('');

  // ── Git info ────────────────────────────────────────────────────────────
  lines.push('## Git state');
  try {
    const branch = git(['rev-parse', '--abbrev-ref', 'HEAD'], { cwd }).trim();
    lines.push(`**Branch:** ${branch}`);
  } catch (_) {
    lines.push('**Branch:** (not a git repo)');
  }

  try {
    const log = git(['log', '--oneline', '-5', '--no-decorate'], { cwd }).trim();
    if (log) {
      lines.push('');
      lines.push('**Recent commits:**');
      for (const l of log.split('\n')) lines.push(`- ${l}`);
    }
  } catch (_) {} // ignore — not every project uses git
  lines.push('');

  // ── Context stats ────────────────────────────────────────────────────────
  lines.push('## Context snapshot');
  const contextPath = path.join(cwd, CONTEXT_FILE);
  if (fs.existsSync(contextPath)) {
    const content = fs.readFileSync(contextPath, 'utf8');
    const tokens = Math.ceil(content.length / 4);

    // Count modules (### headers are file paths)
    const modules = content.split('\n').filter((l) => l.startsWith('### ')).map((l) => l.slice(4).trim());
    lines.push(`**Token count:** ~${tokens}`);
    lines.push(`**Modules in context:** ${modules.length}`);

    if (modules.length > 0) {
      lines.push('');
      lines.push('**Modules:**');
      for (const m of modules.slice(0, 20)) lines.push(`- ${m}`);
      if (modules.length > 20) lines.push(`- … and ${modules.length - 20} more`);
    }
  } else {
    lines.push('_No context file found. Run: node gen-context.js_');
  }
  lines.push('');

  // ── Route summary ────────────────────────────────────────────────────────
  const mapPath = path.join(cwd, 'PROJECT_MAP.md');
  if (fs.existsSync(mapPath)) {
    const mapContent = fs.readFileSync(mapPath, 'utf8');
    const routeLines = mapContent.split('\n').filter((l) => l.startsWith('| ') && !l.startsWith('| Method') && !l.startsWith('|---'));
    if (routeLines.length > 0) {
      lines.push('## Routes');
      lines.push(`**Total routes detected:** ${routeLines.length}`);
      lines.push('');
      for (const r of routeLines.slice(0, 10)) lines.push(r);
      if (routeLines.length > 10) lines.push(`| … | +${routeLines.length - 10} more | |`);
      lines.push('');
    }
  }

  lines.push('---');
  lines.push('_Generated by SigMap `create_checkpoint`_');

  return lines.join('\n');
}

/**
 * get_routing({}) → string
 *
 * Reads the current context file, classifies all indexed files by complexity,
 * and returns a formatted markdown routing guide showing which files belong
 * to the fast/balanced/powerful model tier.
 */
function getRouting(args, cwd) {
  const contextPath = path.join(cwd, CONTEXT_FILE);
  if (!fs.existsSync(contextPath)) {
    return (
      '_No context file found. Run `node gen-context.js --routing` first._\n\n' +
      'This generates routing hints that map each file to a model tier:\n' +
      '- **fast** (haiku/gpt-4o-mini) — config, markup, trivial utilities\n' +
      '- **balanced** (sonnet/gpt-4o) — standard application code\n' +
      '- **powerful** (opus/gpt-4-turbo) — complex, security-critical, or large modules'
    );
  }

  // Parse file list from context (### headings are file paths)
  const content = fs.readFileSync(contextPath, 'utf8');
  const fileRels = content.split('\n')
    .filter((l) => l.startsWith('### '))
    .map((l) => l.slice(4).trim());

  // Build synthetic fileEntries for the classifier
  // We don't have live sig arrays here, so rebuild from the context blocks
  const entries = [];
  const blocks = content.split(/^### /m).slice(1); // slice past the header
  for (const block of blocks) {
    const firstLine = block.split('\n')[0].trim();
    const codeBlock = block.match(/```\n([\s\S]*?)```/);
    const sigs = codeBlock ? codeBlock[1].trim().split('\n').filter(Boolean) : [];
    entries.push({ filePath: path.join(cwd, firstLine), sigs });
  }

  try {
    const { classifyAll } = require('../../src/routing/classifier');
    const { formatRoutingSection } = require('../../src/routing/hints');
    const groups = classifyAll(entries, cwd);
    return formatRoutingSection(groups);
  } catch (err) {
    return `_Routing classification failed: ${err.message}_`;
  }
}

/**
 * explain_file({ path }) → string
 *
 * Returns a file's signatures, its direct imports, and files that import it.
 * path: relative path from project root (e.g. 'src/services/auth.ts')
 */
function explainFile(args, cwd) {
  if (!args || !args.path) return 'Missing required argument: path';

  const targetRel = args.path.replace(/\\/g, '/').replace(/^\//, '');
  const targetAbs = path.resolve(cwd, targetRel);
  const contextPath = path.join(cwd, CONTEXT_FILE);

  const lines = ['# explain_file: ' + targetRel, ''];

  // ── Signatures (hot + cold + cache via buildSigIndex) ───────────────────
  lines.push('## Signatures');
  let indexedFiles = [];

  try {
    const { buildSigIndex } = require('../retrieval/ranker');
    const index = buildSigIndex(cwd);
    let sigs = index.get(targetRel);
    if (!sigs) {
      for (const [file, fileSigs] of index.entries()) {
        if (file === targetRel || file.endsWith('/' + targetRel) || targetRel.endsWith('/' + file)) {
          sigs = fileSigs;
          break;
        }
      }
    }
    if (sigs && sigs.length > 0) {
      lines.push(...sigs);
    } else {
      lines.push('_No signatures indexed for this file. Run: node gen-context.js_');
    }
    indexedFiles = [...index.keys()].map((rel) => path.resolve(cwd, rel));
  } catch (_) {
    lines.push('_No context file found. Run: node gen-context.js_');
  }

  if (!fs.existsSync(targetAbs)) {
    lines.push('');
    lines.push('> File not found on disk: ' + targetRel);
    return lines.join('\n');
  }

  lines.push('');

  // ── Direct imports ────────────────────────────────────────────────────────
  lines.push('## Imports (direct dependencies)');
  try {
    const { extractImports } = require('../map/import-graph');
    const fileContent = fs.readFileSync(targetAbs, 'utf8');
    const fileSet = new Set(indexedFiles);
    fileSet.add(targetAbs);
    const imports = extractImports(targetAbs, fileContent, fileSet);
    if (imports.length > 0) {
      for (const imp of imports) lines.push('- ' + path.relative(cwd, imp).replace(/\\/g, '/'));
    } else {
      lines.push('_No resolvable relative imports found._');
    }
  } catch (err) {
    lines.push('_Could not analyze imports: ' + err.message + '_');
  }

  lines.push('');

  // ── Callers (reverse-import lookup) ──────────────────────────────────────
  lines.push('## Callers (files that import this file)');
  try {
    const { extractImports } = require('../map/import-graph');
    const fileSet = new Set(indexedFiles);
    fileSet.add(targetAbs);
    const callers = [];
    for (const f of indexedFiles) {
      if (f === targetAbs || !fs.existsSync(f)) continue;
      try {
        const fc = fs.readFileSync(f, 'utf8');
        const imps = extractImports(f, fc, fileSet);
        if (imps.includes(targetAbs)) callers.push(path.relative(cwd, f).replace(/\\/g, '/'));
      } catch (_) {}
    }
    if (callers.length > 0) {
      for (const c of callers) lines.push('- ' + c);
    } else {
      lines.push('_No indexed files import this file._');
    }
  } catch (err) {
    lines.push('_Could not analyze callers: ' + err.message + '_');
  }

  return lines.join('\n');
}

/**
 * list_modules({}) → string
 *
 * Lists all srcDir modules present in the context file, sorted by token count
 * descending. Helps agents decide which module to query with read_context.
 */
function listModules(args, cwd) {
  try {
    const { buildSigIndex } = require('../retrieval/ranker');
    const index = buildSigIndex(cwd);
    if (index.size === 0) {
      return 'No context file found. Run: node gen-context.js';
    }

    const groups = {};
    for (const [rel, sigs] of index.entries()) {
      const parts = rel.replace(/\\/g, '/').split('/');
      const mod = parts.length > 1 ? parts[0] : '.';
      if (!groups[mod]) groups[mod] = { fileCount: 0, tokenCount: 0 };
      groups[mod].fileCount++;
      groups[mod].tokenCount += Math.ceil(sigs.join('\n').length / 4);
    }

  const sorted = Object.entries(groups)
    .map(([mod, data]) => ({ module: mod, fileCount: data.fileCount, tokenCount: data.tokenCount }))
    .sort((a, b) => b.tokenCount - a.tokenCount);

  if (sorted.length === 0) return 'No modules found in context file.';

  const total = sorted.reduce((s, m) => s + m.tokenCount, 0);

  return [
    '# Modules',
    '',
    '| Module | Files | Tokens |',
    '|--------|-------|--------|',
    ...sorted.map((m) => `| ${m.module} | ${m.fileCount} | ~${m.tokenCount} |`),
    '',
    `**Total context tokens: ~${total}**`,
    '',
    '_Use `read_context({ module: "name" })` to get signatures for a specific module._',
  ].join('\n');
  } catch (err) {
    return `_list_modules failed: ${err.message}_`;
  }
}

/**
 * query_context({ query, topK? }) → string
 *
 * Ranks context-file entries by relevance to the query and returns the
 * top-K most relevant files with their signatures and scores.
 */
function queryContext(args, cwd) {
  if (!args || !args.query) return 'Missing required argument: query';

  try {
    const { rank, buildSigIndex, formatRankTable } = require('../retrieval/ranker');
    const { buildFromCwd } = require('../graph/builder');
    const index = buildSigIndex(cwd);
    if (index.size === 0) return 'No signatures indexed. Run: node gen-context.js';

    const topK = Math.min(Math.max(1, parseInt(args.topK, 10) || 10), 25);
    // Build dependency graph for neighbor boost — non-fatal if it fails
    let graph = null;
    try { graph = buildFromCwd(cwd); } catch (_) {}
    const results = rank(args.query, index, { topK, cwd, graph });
    return formatRankTable(results, args.query);
  } catch (err) {
    return `_query_context failed: ${err.message}_`;
  }
}

/**
 * get_impact({ file, depth? }) → string
 *
 * Returns a formatted markdown impact report for the given file:
 * direct importers, transitive importers, affected tests, affected routes.
 */
function getImpact(args, cwd) {
  if (!args || !args.file) return 'Missing required argument: file';

  try {
    const { analyzeImpact, formatImpact } = require('../graph/impact');
    const depth = Math.max(0, parseInt(args.depth, 10) || 3);
    const results = analyzeImpact(args.file, cwd, { depth });
    if (results.length === 0) return `No impact data for: ${args.file}`;
    return results.map((r) => formatImpact(r.impact)).join('\n\n---\n\n');
  } catch (err) {
    return `_get_impact failed: ${err.message}_`;
  }
}

/**
 * get_lines({ file, start, end }) → string
 *
 * Surgical Context demand-driven fetch: returns an exact, clamped line range from a
 * source file. The path is resolved inside the project root (no traversal escape) and
 * the returned lines are secret-scanned via the same redactor used for signatures.
 */
function getLines(args, cwd) {
  if (!args || !args.file) return 'Missing required argument: file';

  const rel = String(args.file).replace(/\\/g, '/').replace(/^\//, '');
  const abs = path.resolve(cwd, rel);

  // Sandbox: refuse paths that resolve outside the project root.
  const root = path.resolve(cwd);
  if (abs !== root && !abs.startsWith(root + path.sep)) {
    return `Refused: ${rel} resolves outside the project root`;
  }
  if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
    return `File not found: ${rel}`;
  }

  const start = parseInt(args.start, 10);
  const end = parseInt(args.end, 10);
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return 'Arguments "start" and "end" must be numbers (1-based line numbers).';
  }

  let lines;
  try {
    lines = fs.readFileSync(abs, 'utf8').split('\n');
  } catch (err) {
    return `Could not read ${rel}: ${err.message}`;
  }

  const total = lines.length;
  const from = Math.max(1, Math.min(start, end));
  const to = Math.min(total, Math.max(start, end));
  if (from > total) return `${rel} has only ${total} lines; requested ${start}-${end}`;

  const slice = lines.slice(from - 1, to);

  // Redaction scan: reuse the signature secret scanner line-by-line.
  let safeLines = slice;
  try {
    const { scan } = require('../security/scanner');
    safeLines = scan(slice, rel).safe;
  } catch (_) {} // non-fatal: fall back to raw slice

  return [
    `# ${rel}:${from}-${to}`,
    '```',
    ...safeLines,
    '```',
  ].join('\n');
}

/**
 * read_memory({ limit? }) → string
 *
 * Recall the cross-session decision log (notes) plus the last ranking-session
 * focus, formatted for an agent to consume at the start of a task.
 */
function readMemory(args, cwd) {
  let limit = parseInt(args && args.limit, 10);
  if (!Number.isFinite(limit) || limit <= 0) limit = 10;
  limit = Math.min(limit, 50);

  const out = ['# SigMap memory'];

  let notes = [];
  try {
    const { readNotes, formatNotes } = require('../session/notes');
    notes = readNotes(cwd, limit);
    out.push('');
    out.push(`## Recent notes (${notes.length})`);
    // Most recent first for quick scanning.
    out.push(formatNotes(notes.slice().reverse()));
  } catch (_) {
    out.push('');
    out.push('_No notes available._');
  }

  // Last ranking-session focus (if any) — extends src/session/memory.js.
  try {
    const { loadSession } = require('../session/memory');
    const s = loadSession(cwd);
    if (s && (s.lastQuery || (s.topFiles && s.topFiles.length))) {
      out.push('');
      out.push('## Last session');
      if (s.lastQuery) out.push(`**Last query:** ${s.lastQuery}`);
      if (s.topFiles && s.topFiles.length) {
        out.push(`**Focus files:** ${s.topFiles.map((f) => f.file).slice(0, 5).join(', ')}`);
      }
    }
  } catch (_) { /* session optional */ }

  return out.join('\n');
}

/**
 * get_callee_signatures — return the exact defining signature(s) of named
 * symbols from the index, so an agent never guesses a callee's parameter types.
 * Unknown names get a closest-match suggestion.
 * @param {{symbols:string[]}} args
 * @param {string} cwd
 */
function getCalleeSignatures(args, cwd) {
  const symbols = args && Array.isArray(args.symbols)
    ? args.symbols.map((s) => String(s).trim()).filter(Boolean)
    : null;
  if (!symbols || symbols.length === 0) {
    return 'Missing required argument: symbols (non-empty string[])';
  }

  try {
    try { require('../cache/freshen').freshen(cwd); } catch (_) {}
    const { buildSigIndex } = require('../retrieval/ranker');
    const { buildSymbolCandidates, closestMatch, formatSuggestion } = require('../verify/closest-match');
    const index = buildSigIndex(cwd);
    if (index.size === 0) return 'No context file found. Run: node gen-context.js';

    // Extract the defining symbol name from a signature line (same rules as
    // buildSymbolCandidates) so we match definitions, not param occurrences.
    const defName = (sig) => {
      const cleaned = String(sig).replace(/\s*:\d+(?:-\d+)?\s*$/, '');
      const m = cleaned.match(/\b(?:async\s+function|function|class|def|interface|type|enum|const|let|var)\s+([A-Za-z_$][\w$]*)/)
        || cleaned.match(/([A-Za-z_$][\w$]*)\s*\(/);
      return m ? m[1] : null;
    };

    const candidates = buildSymbolCandidates(index);
    const blocks = [];
    for (const symbol of symbols) {
      const matches = [];
      for (const [file, sigs] of index.entries()) {
        for (const sig of sigs) {
          if (defName(sig) === symbol) matches.push(`${sig}    (${file})`);
        }
      }
      if (matches.length === 0) {
        const cm = closestMatch(symbol, candidates);
        const hint = cm ? ' — ' + formatSuggestion(cm) : '';
        blocks.push(`### ${symbol}\n_not found in index${hint}_`);
      } else {
        blocks.push(`### ${symbol}\n${matches.join('\n')}`);
      }
    }
    return blocks.join('\n\n');
  } catch (err) {
    return `_get_callee_signatures failed: ${err.message}_`;
  }
}

// ── Layer 1: live-index write hooks ────────────────────────────────────────
// Keep the sig-cache fresh while an agent creates/modifies/deletes files, so
// new code is discoverable in the same session. buildSigIndex already merges
// the cache (_buildSigIndexFromCache), so updates are live on the next read.

function _pkgVersion(cwd) {
  try { return JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), 'utf8')).version || '0.0.0'; }
  catch (_) { return '0.0.0'; }
}


/** notify_file_created — extract a file's signatures and index it live. */
function notifyFileCreated(args, cwd) {
  const rel = args && args.path;
  if (!rel) return 'Missing required argument: path';
  try {
    const { extractFile } = require('../extractors/dispatch');
    const { loadCache, saveCache } = require('../cache/sig-cache');
    const abs = path.resolve(cwd, rel);
    let content = args.content;
    if (typeof content !== 'string') {
      try { content = fs.readFileSync(abs, 'utf8'); } catch (_) { content = ''; }
    }
    const sigs = extractFile(abs, content);
    const version = _pkgVersion(cwd);
    const cache = loadCache(cwd, version);
    if (sigs.length > 0) {
      cache.set(abs, { mtime: Date.now(), sigs });
    }
    saveCache(cwd, version, cache);
    return `Indexed ${rel}: ${sigs.length} signature(s) now live.`;
  } catch (err) {
    return `_notify_file_created failed: ${err.message}_`;
  }
}

/** notify_symbol_added — append one signature to a file's live cache entry. */
function notifySymbolAdded(args, cwd) {
  if (!args || !args.signature || !args.file) {
    return 'Missing required arguments: signature, file';
  }
  try {
    const { loadCache, saveCache } = require('../cache/sig-cache');
    const abs = path.resolve(cwd, args.file);
    const version = _pkgVersion(cwd);
    const cache = loadCache(cwd, version);
    const entry = cache.get(abs) || { mtime: Date.now(), sigs: [] };
    const line = Number.isFinite(Number(args.line)) ? `  :${args.line}` : '';
    const sig = String(args.signature) + line;
    if (!entry.sigs.includes(sig)) entry.sigs.push(sig);
    entry.mtime = Date.now();
    cache.set(abs, entry);
    saveCache(cwd, version, cache);
    return `Added signature to ${args.file} (${entry.sigs.length} total).`;
  } catch (err) {
    return `_notify_symbol_added failed: ${err.message}_`;
  }
}

/** notify_file_deleted — drop a file's cache-overlay entry. */
function notifyFileDeleted(args, cwd) {
  const rel = args && args.path;
  if (!rel) return 'Missing required argument: path';
  try {
    const { loadCache, saveCache } = require('../cache/sig-cache');
    const abs = path.resolve(cwd, rel);
    const version = _pkgVersion(cwd);
    const cache = loadCache(cwd, version);
    const had = cache.delete(abs);
    saveCache(cwd, version, cache);
    return had ? `Removed ${rel} from the live index.` : `${rel} was not in the live cache.`;
  } catch (err) {
    return `_notify_file_deleted failed: ${err.message}_`;
  }
}

module.exports = { readContext, searchSignatures, getMap, createCheckpoint, getRouting, explainFile, listModules, queryContext, getImpact, getLines, readMemory, getCalleeSignatures, notifyFileCreated, notifySymbolAdded, notifyFileDeleted };
