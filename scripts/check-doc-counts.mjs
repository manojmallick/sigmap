#!/usr/bin/env node
'use strict';

/**
 * check-doc-counts.mjs — every published "<N> languages / extractors / MCP
 * tools" claim must trace to version.json (#697, #698).
 *
 *   node scripts/check-doc-counts.mjs          # report drift, exit 1 on any
 *   node scripts/check-doc-counts.mjs --fix    # rewrite canonical counts
 *
 * `scripts/sync-metrics.mjs` keeps README's marker-wrapped numbers honest, but
 * it only ever wrote two files — version.json and README.md — so the docs-vp
 * site that actually deploys to sigmap.io drifted freely. `languages.md` ended
 * up stating **31** in its two SEO `content:` meta lines and **36** in its body,
 * on one page; `repomix.md` said 29. The SEO lines are the worst of these,
 * because they are what search results and social cards show.
 *
 * Markers cannot solve the frontmatter half: an HTML comment inside a YAML
 * `content: "…"` string is emitted verbatim into the rendered `<meta>` tag. So
 * this guard classifies each occurrence explicitly instead:
 *
 *   CANONICAL — a live claim about the product's current totals. Must equal
 *               version.json. `--fix` rewrites it.
 *   EXEMPT    — a DIFFERENT metric that merely shares the noun ("17 languages"
 *               is the source-root resolver's coverage, "13 languages" is what
 *               the benchmark repos happen to span).
 *   HISTORICAL— point-in-time records (roadmap release rows). Frozen on purpose.
 *
 * Anything in a scanned file matching none of the three fails as UNCLASSIFIED,
 * so a newly added count cannot quietly become the next 31-vs-36.
 *
 * Zero-dependency. Node built-ins only.
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const FIX = process.argv.includes('--fix');

/** `<N> languages` / `<N>+ extractors` / `<N> MCP tools`. */
const COUNT_RE = /\b(\d+)(\+?)\s+(languages|extractors|MCP tools)\b/g;

/** version.json key backing each metric noun. */
const METRIC_KEY = { languages: 'languages', extractors: 'extractors', 'MCP tools': 'mcp_tools' };

/**
 * Live claims about current totals. `contains` disambiguates which occurrence
 * on which line — a distinctive substring, so a reworded sentence fails loudly
 * rather than silently falling through to UNCLASSIFIED.
 */
const CANONICAL = [
  { file: 'README.md', metric: 'languages', contains: 'get the same depth' },
  { file: 'README.md', metric: 'MCP tools', contains: 'sigmap mcp install claude' },
  { file: 'KNOWN_LIMITATIONS.md', metric: 'languages', contains: 'extractor modules covering' },
  { file: 'KNOWN_LIMITATIONS.md', metric: 'extractors', contains: 'extractor modules covering' },
  { file: 'docs-vp/guide/languages.md', metric: 'languages', contains: 'zero Tree-sitter' },
  { file: 'docs-vp/guide/languages.md', metric: 'languages', contains: 'Pure regex AST extraction' },
  { file: 'docs-vp/guide/languages.md', metric: 'languages', contains: '**Stats:**' },
  { file: 'docs-vp/guide/languages.md', metric: 'languages', contains: '## All' },
  { file: 'docs-vp/guide/generalization.md', metric: 'languages', contains: 'description: SigMap generalizes' },
  { file: 'docs-vp/guide/generalization.md', metric: 'languages', contains: 'hit@5 across' },
  { file: 'docs-vp/guide/generalization.md', metric: 'languages', contains: '(added R, GDScript' },
  { file: 'docs-vp/guide/mcp.md', metric: 'MCP tools', contains: 'on-demand access' },
  { file: 'docs-vp/index.md', metric: 'languages', contains: 'description: SigMap builds' },
  { file: 'docs-vp/index.md', metric: 'languages', contains: 'title:' },
  { file: 'docs-vp/index.md', metric: 'languages', contains: 'zero dependencies, offline, deterministic' },
  { file: 'docs-vp/guide/repomix.md', metric: 'languages', contains: 'Runs automatically on every save' },
  { file: 'docs-vp/guide/roadmap.md', metric: 'languages', contains: '**Stats:**' },
  { file: 'docs-vp/guide/roadmap.md', metric: 'MCP tools', contains: '**Stats:**' },
];

/**
 * Different metrics that share the noun. Each states which number it really is,
 * so the exemption is auditable rather than a blanket skip.
 */
const EXEMPT = [
  { file: 'docs-vp/guide/cli.md', contains: 'Auto-detect source roots for', why: 'source-root resolver coverage, not extractor coverage' },
  { file: 'docs-vp/guide/cli.md', contains: 'Auto-detect source root directories', why: 'source-root resolver coverage' },
  { file: 'docs-vp/guide/generalization.md', contains: 'latest public snapshot spans', why: 'languages the benchmark repos span' },
  { file: 'docs-vp/guide/methodology.md', contains: 'Common developer tasks across', why: 'languages in the task corpus' },
  { file: 'KNOWN_LIMITATIONS.md', contains: 'anchored regex', why: 'Tier-2 row member count' },
  { file: 'KNOWN_LIMITATIONS.md', contains: 'Nested parentheses', why: 'languages affected by one defect' },
  { file: 'KNOWN_LIMITATIONS.md', contains: 'no anchors, no doc hints', why: 'Tier-3 row member count' },
];

/**
 * Files whose counts are point-in-time records. Only explicit CANONICAL entries
 * are enforced inside them; everything else is left frozen.
 */
const HISTORICAL_FILES = new Set([
  'docs-vp/guide/roadmap.md',
  'docs-vp/guide/how-i-built-sigmap.md',
]);

function mdFiles() {
  const out = [];
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory()) {
        if (e.name === 'dist' || e.name === 'node_modules' || e.name === 'public') continue;
        walk(path.join(dir, e.name));
      } else if (e.name.endsWith('.md')) {
        out.push(path.relative(ROOT, path.join(dir, e.name)).replace(/\\/g, '/'));
      }
    }
  };
  walk(path.join(ROOT, 'docs-vp'));
  return [...out, 'README.md', 'KNOWN_LIMITATIONS.md'];
}

/** @returns {{ problems: object[], fixes: object[] }} */
export function audit(root = ROOT) {
  const vj = JSON.parse(readFileSync(path.join(root, 'version.json'), 'utf8'));
  const problems = [];
  const fixes = [];

  for (const rel of mdFiles()) {
    let text;
    try { text = readFileSync(path.join(root, rel), 'utf8'); } catch { continue; }
    const historical = HISTORICAL_FILES.has(rel);
    const lines = text.split('\n');

    lines.forEach((line, i) => {
      COUNT_RE.lastIndex = 0;
      let m;
      while ((m = COUNT_RE.exec(line))) {
        const [, num, plus, metric] = m;
        const canon = CANONICAL.find((c) => c.file === rel && c.metric === metric && line.includes(c.contains));
        if (canon) {
          const expected = vj[METRIC_KEY[metric]];
          if (Number(num) !== expected) {
            problems.push({ rel, line: i + 1, kind: 'DRIFT', metric, found: num, expected, text: line.trim().slice(0, 90) });
            fixes.push({ rel, lineIdx: i, from: `${num}${plus} ${metric}`, to: `${expected}${plus} ${metric}` });
          }
          continue;
        }
        if (EXEMPT.some((e) => e.file === rel && line.includes(e.contains))) continue;
        if (historical) continue;
        problems.push({ rel, line: i + 1, kind: 'UNCLASSIFIED', metric, found: num, expected: null, text: line.trim().slice(0, 90) });
      }
    });
  }
  return { problems, fixes };
}

function main() {
  const { problems, fixes } = audit();

  if (FIX && fixes.length) {
    const byFile = new Map();
    for (const f of fixes) {
      if (!byFile.has(f.rel)) byFile.set(f.rel, readFileSync(path.join(ROOT, f.rel), 'utf8').split('\n'));
      const lines = byFile.get(f.rel);
      lines[f.lineIdx] = lines[f.lineIdx].replace(f.from, f.to);
    }
    for (const [rel, lines] of byFile) {
      writeFileSync(path.join(ROOT, rel), lines.join('\n'));
      console.log(`  ✓ fixed ${rel}`);
    }
    console.log(`✓ rewrote ${fixes.length} count(s) from version.json`);
    return;
  }

  const drift = problems.filter((p) => p.kind === 'DRIFT');
  const unclassified = problems.filter((p) => p.kind === 'UNCLASSIFIED');

  if (!problems.length) {
    console.log('✓ every published language / extractor / MCP-tool count traces to version.json');
    return;
  }

  if (drift.length) {
    console.error(`\n❌ ${drift.length} count(s) disagree with version.json:`);
    for (const p of drift) {
      console.error(`   ${p.rel}:${p.line}  says ${p.found} ${p.metric}, version.json says ${p.expected}`);
      console.error(`      ${p.text}`);
    }
  }
  if (unclassified.length) {
    console.error(`\n❌ ${unclassified.length} count(s) are neither canonical, exempt, nor historical:`);
    for (const p of unclassified) {
      console.error(`   ${p.rel}:${p.line}  ${p.found} ${p.metric}`);
      console.error(`      ${p.text}`);
    }
    console.error('\n   Classify each in scripts/check-doc-counts.mjs — CANONICAL if it states a');
    console.error('   current total, EXEMPT (with a reason) if it is a different metric.');
  }
  console.error('\n   Run: node scripts/check-doc-counts.mjs --fix   (rewrites canonical drift)\n');
  process.exit(1);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
