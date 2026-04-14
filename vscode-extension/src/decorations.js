'use strict';
const vscode = require('vscode');
const fs     = require('fs');
const path   = require('path');

// SVG data URIs for 8px circles
function greenDotUri() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><circle cx="4" cy="4" r="4" fill="#22c55e"/></svg>`;
  return vscode.Uri.parse(`data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`);
}
function greyDotUri() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><circle cx="4" cy="4" r="4" fill="#6b7280"/></svg>`;
  return vscode.Uri.parse(`data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`);
}

const GREEN = vscode.window.createTextEditorDecorationType({
  gutterIconPath: greenDotUri(),
  gutterIconSize: '60%',
  overviewRulerColor: '#22c55e',
  overviewRulerLane: vscode.OverviewRulerLane.Left,
});

const GREY = vscode.window.createTextEditorDecorationType({
  gutterIconPath: greyDotUri(),
  gutterIconSize: '60%',
  overviewRulerColor: '#6b7280',
  overviewRulerLane: vscode.OverviewRulerLane.Left,
});

/**
 * Parse the set of relative file paths included in a copilot-instructions.md.
 * Looks for lines matching `### path/to/file.ext`.
 */
function parseContextPaths(contextFile) {
  if (!fs.existsSync(contextFile)) return new Set();
  const content = fs.readFileSync(contextFile, 'utf8');
  const paths = new Set();
  for (const m of content.matchAll(/^### (.+)$/gm)) {
    paths.add(m[1].trim());
  }
  return paths;
}

let _debounce = null;

/**
 * Schedule a decoration refresh with 2s debounce to avoid thrashing on rapid saves.
 */
function scheduleUpdate(root) {
  clearTimeout(_debounce);
  _debounce = setTimeout(() => applyDecorations(root), 2000);
}

/**
 * Apply green (included) or grey (excluded) gutter dots to all visible editors.
 */
function applyDecorations(root) {
  const ctxFile  = path.join(root, '.github', 'copilot-instructions.md');
  const ctxPaths = parseContextPaths(ctxFile);

  for (const editor of vscode.window.visibleTextEditors) {
    const rel = path.relative(root, editor.document.uri.fsPath);
    const isIncluded = ctxPaths.has(rel) ||
      [...ctxPaths].some(p => rel.endsWith(p) || p.endsWith(rel));

    editor.setDecorations(GREEN, isIncluded ? [fullRange(editor)] : []);
    editor.setDecorations(GREY,  isIncluded ? [] : [fullRange(editor)]);
  }
}

function fullRange(editor) {
  return new vscode.Range(
    editor.document.lineAt(0).range.start,
    editor.document.lineAt(editor.document.lineCount - 1).range.end,
  );
}

module.exports = { applyDecorations, scheduleUpdate, parseContextPaths, GREEN, GREY };
