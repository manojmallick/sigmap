#!/usr/bin/env node
'use strict';

/**
 * SigMap Import Diagnostics
 *
 * Analyzes the import graph and shows which files are importing/importing-from.
 * Helps debug why explain_file and get_impact return empty results.
 *
 * Usage:
 *   node sigmap-diagnostics.js [options]
 *   node sigmap-diagnostics.js --file src/models/account.py
 *   node sigmap-diagnostics.js --grep models/account
 *   node sigmap-diagnostics.js --summary
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const args = process.argv.slice(2);
const cwd = process.cwd();

// Parse arguments
const fileIdx = args.indexOf('--file');
const grepIdx = args.indexOf('--grep');
const summaryIdx = args.indexOf('--summary');
const verboseIdx = args.indexOf('--verbose');

const targetFile = fileIdx >= 0 ? args[fileIdx + 1] : null;
const grepPattern = grepIdx >= 0 ? args[grepIdx + 1] : null;
const showSummary = summaryIdx >= 0;
const verbose = verboseIdx >= 0;

// Source roots to scan
const SOURCE_ROOTS = ['src', 'app', 'lib', 'packages', 'services', 'api', 'server', 'client', 'web'];
const EXCLUDE = ['node_modules', '.git', 'dist', 'build', '__pycache__', '.next', '.venv'];
const JS_EXTS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];
const PY_EXTS = ['.py', '.pyw'];

console.log('\n╔════════════════════════════════════════════════════════════════════╗');
console.log('║           SigMap Import Graph Diagnostics                          ║');
console.log('╚════════════════════════════════════════════════════════════════════╝\n');

// ─────────────────────────────────────────────────────────────────────────────
// Find all source files
// ─────────────────────────────────────────────────────────────────────────────

function walkDir(dir, depth = 0, maxDepth = 6, out = []) {
  if (depth > maxDepth) return out;
  try {
    const entries = fs.readdirSync(dir);
    for (const entry of entries) {
      const fullPath = path.join(dir, entry);
      const rel = path.relative(cwd, fullPath);

      if (EXCLUDE.some(ex => rel.includes(ex))) continue;

      try {
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          walkDir(fullPath, depth + 1, maxDepth, out);
        } else {
          const ext = path.extname(fullPath).toLowerCase();
          if (JS_EXTS.includes(ext) || PY_EXTS.includes(ext)) {
            out.push(fullPath);
          }
        }
      } catch (_) {}
    }
  } catch (_) {}
  return out;
}

console.log('[1/5] Scanning source files...');
let allFiles = [];
for (const root of SOURCE_ROOTS) {
  const fullRoot = path.join(cwd, root);
  if (fs.existsSync(fullRoot)) {
    allFiles = allFiles.concat(walkDir(fullRoot));
  }
}
console.log(`  Found ${allFiles.length} source files\n`);

// ─────────────────────────────────────────────────────────────────────────────
// Extract imports from all files
// ─────────────────────────────────────────────────────────────────────────────

console.log('[2/5] Analyzing imports...');

const { extractImports } = require('./src/map/import-graph');
const fileSet = new Set(allFiles);

const graph = new Map(); // file → [imports]
const reverseGraph = new Map(); // file → [callers]

for (const filePath of allFiles) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const imports = extractImports(filePath, content, fileSet);
    if (imports.length > 0) {
      const rel = path.relative(cwd, filePath);
      graph.set(filePath, imports);

      // Build reverse graph
      for (const imp of imports) {
        if (!reverseGraph.has(imp)) reverseGraph.set(imp, []);
        reverseGraph.get(imp).push(filePath);
      }
    }
  } catch (_) {}
}

console.log(`  Analyzed ${allFiles.length} files`);
console.log(`  Found imports in ${graph.size} files`);
console.log(`  Total import edges: ${Array.from(graph.values()).reduce((s, v) => s + v.length, 0)}\n`);

// ─────────────────────────────────────────────────────────────────────────────
// Show summary or specific file analysis
// ─────────────────────────────────────────────────────────────────────────────

console.log('[3/5] Processing results...\n');

if (showSummary) {
  // Show top 10 most imported files
  console.log('═══ TOP 10 MOST IMPORTED FILES ═══\n');
  const imported = Array.from(reverseGraph.entries())
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 10);

  for (const [file, callers] of imported) {
    const rel = path.relative(cwd, file);
    console.log(`${callers.length.toString().padStart(3)} importers : ${rel}`);
    if (verbose && callers.length <= 5) {
      for (const caller of callers) {
        console.log(`              ↖ ${path.relative(cwd, caller)}`);
      }
    }
  }
  console.log();

  // Show top 10 files with most imports
  console.log('═══ TOP 10 FILES WITH MOST IMPORTS ═══\n');
  const importers = Array.from(graph.entries())
    .map(([file, imports]) => [file, imports.length])
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  for (const [file, count] of importers) {
    const rel = path.relative(cwd, file);
    console.log(`${count.toString().padStart(3)} imports     : ${rel}`);
  }
  console.log();
}

if (targetFile) {
  const absPath = path.resolve(cwd, targetFile);
  const rel = path.relative(cwd, absPath);

  if (!fileSet.has(absPath)) {
    console.log(`✗ File not found: ${rel}\n`);
    process.exit(1);
  }

  console.log(`═══ FILE ANALYSIS: ${rel} ═══\n`);

  // Show what this file imports
  const imports = graph.get(absPath) || [];
  console.log(`IMPORTS (${imports.length} files):`);
  if (imports.length === 0) {
    console.log('  (no resolvable local imports)');
  } else {
    for (const imp of imports.slice(0, 20)) {
      const impRel = path.relative(cwd, imp);
      console.log(`  → ${impRel}`);
    }
    if (imports.length > 20) {
      console.log(`  ... and ${imports.length - 20} more`);
    }
  }
  console.log();

  // Show what imports this file
  const callers = reverseGraph.get(absPath) || [];
  console.log(`CALLERS (${callers.length} files):`);
  if (callers.length === 0) {
    console.log('  (no files import this file)');
  } else {
    for (const caller of callers.slice(0, 20)) {
      const callerRel = path.relative(cwd, caller);
      console.log(`  ← ${callerRel}`);
    }
    if (callers.length > 20) {
      console.log(`  ... and ${callers.length - 20} more`);
    }
  }
  console.log();
}

if (grepPattern) {
  const pattern = new RegExp(grepPattern, 'i');
  const matching = Array.from(graph.keys()).filter(f => pattern.test(f));

  console.log(`═══ FILES MATCHING "${grepPattern}" (${matching.length} files) ═══\n`);

  for (const file of matching.slice(0, 10)) {
    const rel = path.relative(cwd, file);
    const imports = graph.get(file).length;
    const callers = (reverseGraph.get(file) || []).length;
    console.log(`${rel}`);
    console.log(`  ├─ imports: ${imports} files`);
    console.log(`  └─ imported by: ${callers} files`);
  }

  if (matching.length > 10) {
    console.log(`\n... and ${matching.length - 10} more files`);
  }
  console.log();
}

// ─────────────────────────────────────────────────────────────────────────────
// Diagnostic checks
// ─────────────────────────────────────────────────────────────────────────────

console.log('[4/5] Running diagnostic checks...\n');

const issues = [];

// Check 1: Files with no imports detected
const noImports = allFiles.filter(f => !graph.has(f));
if (noImports.length > allFiles.length * 0.7) {
  issues.push({
    severity: 'warning',
    message: `Only ${graph.size}/${allFiles.length} files have imports detected (${(100 * graph.size / allFiles.length).toFixed(1)}%)`,
    hint: 'This is normal for projects with many leaf nodes, but might indicate import detection issues',
  });
}

// Check 2: No imports at all
if (graph.size === 0) {
  issues.push({
    severity: 'error',
    message: 'No imports detected in any files',
    hint: 'Check if files exist and contain valid import statements',
  });
}

// Check 3: Orphaned files (imported but don't exist in fileSet)
const orphaned = new Set();
for (const imports of graph.values()) {
  for (const imp of imports) {
    if (!fileSet.has(imp)) orphaned.add(imp);
  }
}

if (orphaned.size > 0) {
  issues.push({
    severity: 'info',
    message: `${orphaned.size} imports reference files outside source roots`,
    hint: 'This is normal (external packages, generated files, etc.)',
  });
}

if (issues.length === 0) {
  console.log('✓ No diagnostic issues found\n');
} else {
  for (const issue of issues) {
    const icon = issue.severity === 'error' ? '✗' : issue.severity === 'warning' ? '⚠' : 'ℹ';
    console.log(`${icon} [${issue.severity.toUpperCase()}] ${issue.message}`);
    console.log(`  → ${issue.hint}\n`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────────────────────────────────────

console.log('[5/5] Summary\n');
console.log(`Files scanned:           ${allFiles.length}`);
console.log(`Files with imports:      ${graph.size} (${(100 * graph.size / allFiles.length).toFixed(1)}%)`);
console.log(`Total import edges:      ${Array.from(graph.values()).reduce((s, v) => s + v.length, 0)}`);
console.log(`Files imported by others: ${reverseGraph.size}`);
console.log(`External imports:        ${orphaned.size}`);
console.log();

// Usage hints
console.log('═══ USAGE ═══\n');
console.log('Show summary of top importers:');
console.log('  node sigmap-diagnostics.js --summary\n');
console.log('Analyze specific file:');
console.log('  node sigmap-diagnostics.js --file src/models/account.py\n');
console.log('Find files matching pattern:');
console.log('  node sigmap-diagnostics.js --grep "account"\n');
console.log('Add --verbose for more details');
console.log();
