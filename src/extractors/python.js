'use strict';

const fs = require('fs');
const path = require('path');
const { lineAt } = require('./line-anchor');
const { capWithNotice } = require('../util/truncate');

// Ceiling sits above the default `maxSigsPerFile` so the configured budget
// governs output rather than a literal buried here, and omissions are disclosed (#576).
const PER_FILE_LIMIT = 200;

// Per-class member ceiling, disclosed via capWithNotice (#576).
const MEMBER_LIMIT = 120;

/**
 * 1-based line of the last source line belonging to a top-level (indent 0)
 * def/class body that starts at `startLine` (1-based). Trailing blank lines
 * are excluded.
 * @param {string[]} srcLines
 * @param {number} startLine
 * @returns {number}
 */
function pyBlockEnd(srcLines, startLine) {
  let end = startLine;
  for (let i = startLine; i < srcLines.length; i++) {
    const line = srcLines[i];
    if (line.trim() === '') continue;
    const indent = line.match(/^(\s*)/)[1].length;
    if (indent === 0) break;
    end = i + 1;
  }
  return end;
}

/**
 * Try to extract signatures using the native Python AST extractor.
 * Returns null if Python3 is unavailable or the script returns empty results.
 * @param {string} filePath - Absolute path to the Python file
 * @returns {string[]|null}
 */
/** Resolve packaged python_ast.py (dev, npm tarball, or bundled CLI root). */
function resolvePythonAstScript() {
  const candidates = [
    path.join(__dirname, 'python_ast.py'),
    path.join(__dirname, 'src', 'extractors', 'python_ast.py'),
  ];
  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) return candidate;
    } catch (_) {}
  }
  return null;
}

// ---------------------------------------------------------------------------
// Batch pre-pass (#970)
//
// The AST tier used to start one `python3` per file: about 2,900 process starts
// on Django, 182 s against 7 s for the regex tier. `prefetch` hands a run's
// whole file list to `python_ast.py --batch` in chunks, and `tryNativeExtract`
// reads the answer back. The per-file call below stays for any caller that did
// not prefetch (one file edited, an MCP write hook, a test), so it is never
// wrong, only slower.
// ---------------------------------------------------------------------------

// Files per python3 process. Bounds the output held in memory at once (about
// 3 KB of signatures a file, and up to about 25 KB for a file at the 200-signature
// ceiling since #982) and the files a hung process can take with it, but
// each process pays interpreter start-up: Django took 3.9 s at 200 a process and
// 2.9 s at 1,000.
const BATCH_CHUNK = 1000;
// A chunk normally takes well under two seconds; this only ends a hung one.
const BATCH_TIMEOUT_MS = 60000;
const BATCH_MAX_BUFFER = 256 * 1024 * 1024;

// absolute path -> { size, mtimeMs, sigs: string[]|null, degraded?: true }.
// `sigs: null` is a settled answer for the regex tier (parse error, empty
// result, python3 absent or failed), not "unknown": it is what keeps a failed
// batch from falling back to one process per file. `degraded` marks the ones a
// failure left unanswered, which the next prefetch tries again. The stat taken
// BEFORE python3 reads the file makes a file edited afterwards miss and take the
// per-file path, as it always has.
const _batched = new Map();

// 'major.minor' of the python3 that served the AST tier this run, and whether
// it served any file: the generated header labels the toolchain (#609).
let _astVersion = null;
let _astServed = false;

function statKey(p) {
  try {
    const st = fs.statSync(p);
    return { size: st.size, mtimeMs: st.mtimeMs };
  } catch (_) {
    return null;
  }
}

/**
 * Run one chunk through `python_ast.py --batch`.
 * @returns {{results: Map<string, string[]>, version: string|null, error: string|null, missing: boolean}}
 */
function runBatchChunk(scriptPath, files, timeoutMs) {
  const { spawnSync } = require('child_process');
  const out = { results: new Map(), version: null, error: null, missing: false };
  const r = spawnSync('python3', [scriptPath, '--batch'], {
    input: files.map((f) => JSON.stringify(f)).join('\n') + '\n',
    encoding: 'utf8',
    timeout: timeoutMs,
    maxBuffer: BATCH_MAX_BUFFER,
    windowsHide: true,
  });
  if (r.error && r.error.code === 'ENOENT') { out.missing = true; return out; }
  // Whatever arrived before a crash or timeout is still good: python_ast.py
  // flushes one line per file.
  for (const line of String(r.stdout || '').split('\n')) {
    if (!line) continue;
    let obj;
    try { obj = JSON.parse(line); } catch (_) { continue; }
    if (obj && Array.isArray(obj.version) && obj.version.length >= 2) out.version = `${obj.version[0]}.${obj.version[1]}`;
    else if (obj && typeof obj.path === 'string' && Array.isArray(obj.sigs)) out.results.set(obj.path, obj.sigs);
  }
  if (r.error) out.error = r.error.code || r.error.message;
  else if (r.status !== 0) out.error = r.signal ? `killed by ${r.signal}` : `exit ${r.status}`;
  return out;
}

/**
 * Extract many Python files with one `python3` process per chunk instead of one
 * per file, and keep the answers for `tryNativeExtract`. A file an earlier call
 * answered and that has not changed since is not sent again (`sigmap sync` walks
 * the same files twice), and one that call failed on is. Never throws: a chunk
 * that fails costs the files it did not answer their AST pass (they use the regex
 * tier) and one line on stderr.
 *
 * @param {string[]} files - paths; non-Python files are ignored
 * @param {{chunk?: number, timeoutMs?: number}} [opts]
 * @returns {{requested: number, reused: number, served: number, regexTier: number, degraded: number, available: boolean}}
 *   served/regexTier/degraded count the files sent to python3 by THIS call
 */
function prefetch(files, opts = {}) {
  const summary = { requested: 0, reused: 0, served: 0, regexTier: 0, degraded: 0, available: true };
  try {
    const scriptPath = resolvePythonAstScript();
    if (!scriptPath || !Array.isArray(files)) return summary;
    const chunk = opts.chunk > 0 ? opts.chunk : BATCH_CHUNK;
    const timeoutMs = opts.timeoutMs > 0 ? opts.timeoutMs : BATCH_TIMEOUT_MS;
    // A path holding a line break cannot be told apart from two by a reader of
    // lines, so it keeps the per-file path.
    const wanted = [...new Set(files.filter((f) => typeof f === 'string' && /\.pyw?$/i.test(f) && !/[\r\n]/.test(f))
      .map((f) => path.resolve(f)))];
    summary.requested = wanted.length;
    const list = wanted.filter((f) => {
      const hit = _batched.get(f);
      if (!hit || hit.degraded) return true;
      const now = statKey(f);
      return !(now && now.size === hit.size && now.mtimeMs === hit.mtimeMs);
    });
    summary.reused = wanted.length - list.length;
    let firstError = null;
    for (let i = 0; i < list.length; i += chunk) {
      const part = list.slice(i, i + chunk);
      const stats = part.map(statKey);
      const res = runBatchChunk(scriptPath, part, timeoutMs);
      if (res.missing) {
        // No python3 on PATH is the regex tier by design, not a failure: settle
        // this chunk and every later one without another attempt or a notice.
        summary.available = false;
        for (let j = i; j < list.length; j++) {
          const st = j < i + part.length ? stats[j - i] : statKey(list[j]);
          if (st) _batched.set(list[j], { size: st.size, mtimeMs: st.mtimeMs, sigs: null });
        }
        summary.regexTier += list.length - i;
        break;
      }
      if (res.version) _astVersion = res.version;
      for (let k = 0; k < part.length; k++) {
        if (!stats[k]) continue;
        const sigs = res.results.get(part[k]);
        const settled = sigs !== undefined && sigs.length > 0 ? sigs : null;
        const entry = { size: stats[k].size, mtimeMs: stats[k].mtimeMs, sigs: settled };
        if (sigs === undefined) entry.degraded = true;
        _batched.set(part[k], entry);
        if (settled) summary.served++;
        else if (sigs !== undefined) summary.regexTier++;
        else summary.degraded++;
      }
      if (res.error && !firstError) firstError = res.error;
    }
    if (summary.degraded > 0) {
      console.warn(`[sigmap] python3 AST pass failed for ${summary.degraded} of ${list.length} Python file(s) (${firstError || 'no result'}); they use the regex tier`);
    }
  } catch (_) {
    // A broken pre-pass must never stop generate; the per-file path still works.
    _batched.clear();
  }
  return summary;
}

/**
 * The header label for the AST tier, `python@3.9`, or null when no file was
 * served by it this run. Minor version, not patch: the `ast` node shapes the
 * extractor reads change with 3.x releases, not with 3.x.y fixes.
 * @returns {string|null}
 */
function toolchainLabel() {
  if (!_astServed) return null;
  if (!_astVersion) {
    try {
      const { execFileSync } = require('child_process');
      const v = execFileSync('python3', ['-c', 'import sys; print("%d.%d" % sys.version_info[:2])'], { encoding: 'utf8', timeout: 5000, windowsHide: true });
      if (/^\d+\.\d+$/.test(v.trim())) _astVersion = v.trim();
    } catch (_) {}
  }
  return _astVersion ? `python@${_astVersion}` : null;
}

function tryNativeExtract(filePath) {
  const hit = _batched.get(filePath);
  if (hit !== undefined) {
    const now = statKey(filePath);
    if (now && now.size === hit.size && now.mtimeMs === hit.mtimeMs) {
      if (hit.sigs) _astServed = true;
      return hit.sigs;
    }
    _batched.delete(filePath);
  }
  try {
    const { execFileSync } = require('child_process');
    const scriptPath = resolvePythonAstScript();
    if (!scriptPath) return null;
    const result = execFileSync('python3', [scriptPath, filePath], {
      timeout: 5000,
      encoding: 'utf8',
    });
    const sigs = JSON.parse(result.trim());
    if (Array.isArray(sigs) && sigs.length > 0) {
      _astServed = true;
      return sigs;
    }
  } catch (_) {}
  return null;
}

/**
 * Extract signatures from Python source code.
 * When a real file path is provided, tries the native Python AST extractor first
 * (more accurate for multiline signatures, stacked decorators, and type annotations).
 * Falls back to the regex approach if Python3 is unavailable or returns no results.
 * @param {string} src - Raw file content
 * @param {string} [filePath] - Optional absolute path to the source file
 * @returns {string[]} Array of signature strings
 */
function extract(src, filePath) {
  // Prefer native AST extractor when the file exists on disk (#693)
  if (filePath && typeof filePath === 'string') {
    const abs = path.isAbsolute(filePath) ? filePath : path.resolve(filePath);
    if (fs.existsSync(abs)) {
      const native = tryNativeExtract(abs);
      if (native) return native;
    }
  }
  if (!src || typeof src !== 'string') return [];
  const sigs = [];

  // noComments: strip only # comments, keep docstrings (needed for @decorator detection)
  const noComments = src.replace(/#.*$/gm, '');
  // stripped: also strip docstrings (safe for regex matching). Docstrings are
  // blanked newline-by-newline (non-newline chars → spaces) so character
  // offsets and line numbers stay exact for line anchors.
  const stripped = noComments
    .replace(/"""[\s\S]*?"""/g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/'''[\s\S]*?'''/g, (m) => m.replace(/[^\n]/g, ' '));
  const srcLines = src.split('\n');

  // Classes
  for (const m of stripped.matchAll(/^class\s+(\w+)(?:\s*\(([^)]*)\))?\s*:/gm)) {
    const className = m[1];
    const baseName = m[2] ? m[2].trim() : '';
    const bodyStart = m.index + m[0].length;
    const clsStart = lineAt(stripped, m.index);
    const clsAnchor = `  :${clsStart}-${pyBlockEnd(srcLines, clsStart)}`;

    // Try @dataclass collapse
    const dcFields = tryExtractDataclassFields(stripped, m.index);
    if (dcFields !== null) {
      sigs.push(`@dataclass ${className}(${dcFields})${clsAnchor}`);
      continue;
    }

    // Try BaseModel/BaseSettings collapse
    if (/(BaseModel|BaseSettings)/.test(baseName)) {
      const bmFields = tryExtractBaseModelFields(stripped, bodyStart);
      if (bmFields) {
        sigs.push(`class ${className}(${baseName}) ${bmFields}${clsAnchor}`);
        continue;
      }
    }

    const baseStr = baseName ? `(${baseName})` : '';
    sigs.push(`class ${className}${baseStr}${clsAnchor}`);

    // Class-level ALL_CAPS constants
    for (const c of extractClassConstants(stripped, bodyStart)) {
      sigs.push(`  ${c}`);
    }

    // Methods
    const methods = extractClassMethods(stripped, bodyStart);
    for (const meth of methods) sigs.push(`  ${meth}`);
  }

  // Top-level functions
  for (const m of stripped.matchAll(/^((?:async\s+)?def\s+(\w+)\s*\(([^)]*)\)(?:\s*->\s*[^:]+)?)\s*:/gm)) {
    if (/^_/.test(m[2])) continue;
    const asyncKw = m[1].trimStart().startsWith('async') ? 'async ' : '';
    const params = normalizeParams(m[3]);
    const retType = extractReturnType(m[1] + ':');
    const retStr = retType ? ` → ${retType}` : '';
    const hint = extractDocHint(src, m[2], m[0]);
    const hintStr = hint ? `  # ${hint}` : '';
    const fnStart = lineAt(stripped, m.index);
    const fnAnchor = `  :${fnStart}-${pyBlockEnd(srcLines, fnStart)}`;
    sigs.push(`${asyncKw}def ${m[2]}(${params})${retStr}${fnAnchor}${hintStr}`);
  }

  // FastAPI router endpoints: @router.METHOD("path") + async def name(...)
  const lines = noComments.split('\n');
  for (let i = 0; i < lines.length - 1; i++) {
    const decLine = lines[i].trim();
    const rm = decLine.match(/^@\w+\.(get|post|put|patch|delete|head)\s*\(\s*['"]([^'"]+)['"]/);
    if (!rm) continue;
    for (let j = i + 1; j < Math.min(i + 6, lines.length); j++) {
      const fl = lines[j].trim();
      const fm = fl.match(/^(?:async\s+)?def\s+(\w+)/);
      if (fm) { const rs = j + 1; sigs.push(`${rm[1].toUpperCase()} ${rm[2]}  →  ${fm[1]}()  :${rs}-${pyBlockEnd(srcLines, rs)}`); break; }
      if (fl && !fl.startsWith('@') && !fl.startsWith('#')) break;
    }
  }

  return capWithNotice(sigs, PER_FILE_LIMIT, 'signatures');
}

function extractClassMethods(stripped, startIndex) {
  const methods = [];
  const lines = stripped.slice(startIndex).split('\n');
  for (const line of lines) {
    if (line.trim() === '') continue;
    const indent = line.match(/^(\s+)/);
    if (!indent) break;
    const m = line.match(/^\s+(?:async\s+)?def\s+(\w+)\s*\(([^)]*)\)(?:\s*->\s*([^:]+))?\s*:/);
    if (m) {
      if (m[1].startsWith('__') && m[1] !== '__init__') continue;
      if (m[1].startsWith('_') && !m[1].startsWith('__')) continue;
      const asyncKw = line.trimStart().startsWith('async') ? 'async ' : '';
      const params = normalizeParams(m[2]).replace(/^self,?\s*/, '').replace(/^cls,?\s*/, '');
      const retType = m[3] ? m[3].trim().replace(/Optional\[([^\]]+)\]/, '$1|None').slice(0, 30) : '';
      const retStr = retType ? ` → ${retType}` : '';
      methods.push(`${asyncKw}def ${m[1]}(${params})${retStr}`);
    }
  }
  return capWithNotice(methods, MEMBER_LIMIT, 'methods');
}

function tryExtractDataclassFields(stripped, classIndex) {
  const before = stripped.slice(Math.max(0, classIndex - 120), classIndex);
  if (!/@dataclass/.test(before)) return null;
  const lines = stripped.slice(classIndex).split('\n');
  const fields = [];
  for (const line of lines.slice(1)) {
    if (line.trim() === '') continue;
    if (!line.match(/^\s+/)) break;
    const f = line.match(/^\s+(\w+)\s*:\s*([^=\n]+?)(?:\s*=.*)?$/);
    if (!f) break;
    const isOptional = f[2].includes('Optional') || /=\s*None/.test(line);
    fields.push(isOptional ? `${f[1]}?` : f[1]);
  }
  return fields.length ? fields.join(', ') : null;
}

function tryExtractBaseModelFields(stripped, bodyStart) {
  const lines = stripped.slice(bodyStart, bodyStart + 800).split('\n');
  const fields = [];
  let foundFirst = false;
  for (const line of lines) {
    if (line.trim() === '') continue;
    if (foundFirst && !/^\s/.test(line)) break;
    if (!line.match(/^\s{4}\w/)) continue;
    foundFirst = true;
    const f = line.match(/^\s{4}(\w+)\s*(?::\s*([^=\n]+?))?(?:\s*=\s*(.*))?$/);
    if (!f || f[1].startsWith('_') || f[1] === 'class' || f[1] === 'def') continue;
    const isOptional = (f[2] || '').includes('Optional') || f[3] !== undefined;
    fields.push(isOptional ? `${f[1]}?` : `${f[1]}*`);
  }
  return fields.length ? `{${fields.slice(0, 6).join(', ')}}` : null;
}

function extractClassConstants(stripped, startIndex) {
  const lines = stripped.slice(startIndex).split('\n');
  const consts = [];
  for (const line of lines) {
    if (!line.match(/^\s+/)) break;
    const c = line.match(/^\s+([A-Z][A-Z0-9_]{2,})\s*=\s*(.+)/);
    if (!c) continue;
    let val = c[2].trim();
    const items = (val.match(/"([^"]+)"/g) || val.match(/'([^']+)'/g) || []);
    if (items.length > 3) val = `[${items[0].replace(/['"]/g, '')}..${items[items.length - 1].replace(/['"]/g, '')}]`;
    if (val.length > 40) val = val.slice(0, 37) + '...';
    consts.push(`${c[1]}=${val}`);
  }
  return consts.slice(0, 3);
}

function extractReturnType(sigLine) {
  const m = sigLine.match(/->\s*([^:]+):/);
  if (!m) return '';
  let rt = m[1].trim();
  rt = rt.replace(/Optional\[([^\]]+)\]/, '$1|None');
  return rt.length > 30 ? rt.slice(0, 27) + '...' : rt;
}

function normalizeParams(params) {
  if (!params) return '';
  return params.trim()
    .split(',')
    .map((p) => {
      const part = p.trim();
      if (!part) return '';
      const stars = part.match(/^(\*{1,2})/)?.[1] || '';
      const rest = part.slice(stars.length);
      const eqIdx = rest.indexOf('=');
      const noDefault = eqIdx !== -1 ? rest.slice(0, eqIdx).trim() : rest.trim();
      const clean = noDefault
        .replace(/Optional\[([^\]]+)\]/, '$1?')
        .replace(/Union\[([^\]]+),\s*None\]/, '$1?');
      return stars + clean;
    })
    .filter((p) => p && p !== 'self' && p !== 'cls')
    .join(', ');
}

function extractDocHint(src, fnName, fnSigLine) {
  if (!src || !fnName || !fnSigLine) return '';
  const escSig = fnSigLine.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`^${escSig.replace(/\s+/g, '\\s+')}`, 'm');
  const pos = src.search(re);
  if (pos === -1) return '';
  const afterSig = src.slice(pos + fnSigLine.length, pos + fnSigLine.length + 600);

  // Find first non-empty line after function signature indentation
  const m = afterSig.match(/^\s*\n\s*(?:[rubfRUBF]{0,2})?("""|''')([\s\S]*?)\1/m);
  if (!m) return '';

  const firstLine = m[2]
    .split('\n')
    .map((l) => l.trim())
    .find(Boolean);
  if (!firstLine) return '';

  const sentence = firstLine.split(/[.!?]/)[0].trim();
  return sentence.slice(0, 60);
}

/**
 * The identity of the interpreter the AST tier would use: the real path, size and mtime of
 * the first `python3` on PATH, or 'none'. A file extracted under one is not the file
 * extracted under another (the AST tier and the regex tier list different things), so the
 * extraction cache is keyed by it (#971). Found by walking PATH, not by starting a process.
 *
 * @returns {string}
 */
function tierId() {
  const names = process.platform === 'win32' ? ['python3.exe', 'python3'] : ['python3'];
  for (const dir of String(process.env.PATH || '').split(path.delimiter)) {
    if (!dir) continue;
    for (const name of names) {
      try {
        const real = fs.realpathSync(path.join(dir, name));
        const st = fs.statSync(real);
        if (st.isFile()) return `${real}:${st.size}:${Math.floor(st.mtimeMs)}`;
      } catch (_) { /* not in this directory */ }
    }
  }
  return 'none';
}

/**
 * A run that serves its Python files from the extraction cache never starts the AST tier,
 * yet the header of a cold run names it (`toolchain=python@3.9`). The label the cold run
 * recorded is restored here so a warm run writes the same header.
 *
 * @param {string|null} label - as returned by toolchainLabel()
 */
function restoreToolchain(label) {
  const m = /^python@(\d+\.\d+)$/.exec(String(label || ''));
  if (!m) return;
  _astServed = true;
  if (!_astVersion) _astVersion = m[1];
}

module.exports = { extract, tryNativeExtract, resolvePythonAstScript, prefetch, toolchainLabel, tierId, restoreToolchain };
