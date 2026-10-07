'use strict';

/**
 * Stack-trace squeeze (v7.0.0) — the highest-value squeeze module.
 *
 * Dedupes repeated exceptions, strips vendor frames, keeps frames in the user's
 * own source dirs, and — the differentiator — **enriches the top kept frame**
 * with its real signature from the SigMap symbol index (`buildSigIndex`).
 * Generic log summarizers can't do this; SigMap has the repo's symbol map.
 *
 * Pure/deterministic. The symbol index is injected via `opts.symbolIndex` so
 * the module is unit-testable without touching the filesystem.
 */

const path = require('path');

const VENDOR_RE = /(?:^|[\\/])(?:node_modules|vendor|site-packages|dist|build|\.venv|venv|third_party|external|\.cargo|go\/pkg\/mod)[\\/]/;

/** Parse a frame line across JS/TS, Python, Java/Kotlin, Go, Rust, native. */
function parseFrame(line) {
  let m;
  if ((m = line.match(/^\s*at\s+(.+?)\s+\((.+?):(\d+):(\d+)\)/))) return { fn: m[1], file: m[2], line: +m[3], raw: line };
  if ((m = line.match(/^\s*at\s+(.+?):(\d+):(\d+)\s*$/))) return { fn: '', file: m[1], line: +m[2], raw: line };
  if ((m = line.match(/^\s*at\s+([\w$.<>]+)\((.+?):(\d+)\)/))) return { fn: m[1], file: m[2], line: +m[3], raw: line };
  if ((m = line.match(/^\s*File\s+"(.+?)",\s+line\s+(\d+)(?:,\s+in\s+(.+))?/))) return { fn: (m[3] || '').trim(), file: m[1], line: +m[2], raw: line };
  if ((m = line.match(/^\s*(.+\.(?:go|rs)):(\d+)/))) return { fn: '', file: m[1], line: +m[2], raw: line };
  return null;
}

function isVendor(file) { return VENDOR_RE.test(String(file).replace(/\\/g, '/')); }

function inSrcDirs(file, srcDirs) {
  const f = String(file).replace(/\\/g, '/');
  return srcDirs.some((d) => {
    const dd = String(d).replace(/^\.\//, '').replace(/\/$/, '');
    return dd && (f === dd || f.startsWith(dd + '/') || f.includes('/' + dd + '/'));
  });
}

// A signature's `:start-end` anchor. The one-line doc hint follows it
// (`foo(a)  :10-20  # does x`), so the anchor is not always the last thing on the line.
const ANCHOR_RE = /\s:(\d+)(?:-(\d+))?(?:\s{2,}#.*)?$/;

/**
 * Whether a signature DECLARES `name`, as opposed to merely mentioning it. An
 * export list (`module.exports = { a, b }`) names every function it exports but
 * defines none of them, and a parameter or a body can carry the name too, so the
 * name must sit in the declarator — ahead of the first `(`, `{` or `=`.
 */
function declares(sig, name) {
  const head = sig.replace(ANCHOR_RE, '');
  return new RegExp('\\b' + name.replace(/[^\w$]/g, '') + '\\b').test(head.split(/[({=]/, 1)[0]);
}

/** Look up the real signature for a frame in the SigMap symbol index. */
function enrichFrame(frame, symbolIndex) {
  if (!symbolIndex || !frame) return null;
  const want = String(frame.file).replace(/\\/g, '/');
  const base = path.basename(want);
  let key = null;
  for (const k0 of symbolIndex.keys()) {
    const k = String(k0).replace(/\\/g, '/');
    if (k === want || want.endsWith('/' + k) || k.endsWith('/' + want)) { key = k0; break; }
    if (!key && path.basename(k) === base) key = k0;
  }
  if (!key) return null;
  const sigs = symbolIndex.get(key) || [];
  const wantFn = frame.fn ? frame.fn.split('.').pop() : '';
  let byLine = null, byLineSpan = Infinity, byName = null;
  for (const sig of sigs) {
    const s = String(sig);
    const mm = s.match(ANCHOR_RE);
    if (mm) {
      const a = +mm[1], b = mm[2] ? +mm[2] : a;
      // The narrowest range around the line: a method, not the class that holds it.
      if (frame.line >= a && frame.line <= b && b - a < byLineSpan) { byLine = s; byLineSpan = b - a; }
    }
    if (wantFn && !byName && declares(s, wantFn)) byName = s;
  }
  const sig = byLine || byName;
  return sig ? { file: key, sig: sig.replace(ANCHOR_RE, '').trim() } : null;
}

/**
 * @param {string} input
 * @param {object} [opts]
 * @param {string[]} [opts.srcDirs]      user source dirs (default ['src'])
 * @param {Map}      [opts.symbolIndex]  SigMap signature index for enrichment
 * @param {number}   [opts.maxFrames=8]  cap on kept source frames
 * @returns {{ squeezed, kept, stripped, enriched }}
 */
function squeezeStackTrace(input, opts = {}) {
  const srcDirs = (opts.srcDirs && opts.srcDirs.length) ? opts.srcDirs : ['src'];
  const maxFrames = opts.maxFrames != null ? opts.maxFrames : 8;
  const lines = input.split('\n');

  const headerCount = new Map();
  const headerOrder = [];
  const frames = [];
  for (const line of lines) {
    const f = parseFrame(line);
    if (f) { frames.push(f); continue; }
    const t = line.trim();
    if (!t) continue;
    if (!headerCount.has(t)) headerOrder.push(t);
    headerCount.set(t, (headerCount.get(t) || 0) + 1);
  }

  const seen = new Set();
  let dupFrames = 0;
  const nonVendor = [];
  const sourceFrames = [];
  let vendorCount = 0;
  for (const f of frames) {
    const k = f.file + ':' + f.line;
    if (seen.has(k)) { dupFrames++; continue; }
    seen.add(k);
    if (isVendor(f.file)) { vendorCount++; continue; }
    nonVendor.push(f);
    if (inSrcDirs(f.file, srcDirs)) sourceFrames.push(f);
  }

  // Prefer source frames; never return empty (fall back to top non-vendor, then raw).
  const shown = sourceFrames.length ? sourceFrames.slice(0, maxFrames)
    : (nonVendor.length ? nonVendor.slice(0, 3) : frames.slice(0, 3));

  const enrichment = shown.length ? enrichFrame(shown[0], opts.symbolIndex) : null;

  const out = [];
  for (const h of headerOrder) {
    const n = headerCount.get(h);
    out.push(n > 1 ? `${h}   (occurred ×${n})` : h);
  }
  for (let i = 0; i < shown.length; i++) {
    out.push('    ' + shown[i].raw.trim());
    if (i === 0 && enrichment) out.push(`      ↳ ${enrichment.sig}   [${enrichment.file}]`);
  }

  return {
    squeezed: out.join('\n'),
    kept: [
      `${headerOrder.length} unique exception(s)`,
      `top ${shown.length} ${sourceFrames.length ? 'source ' : ''}frame(s)`,
      ...(enrichment ? [`enriched ${path.basename(shown[0].file)}:${shown[0].line}`] : []),
    ],
    stripped: [`${vendorCount} vendor frame(s)`, `${dupFrames} duplicate frame(s)`],
    enriched: !!enrichment,
  };
}

module.exports = { squeezeStackTrace, parseFrame, isVendor, inSrcDirs, enrichFrame };
