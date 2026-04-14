'use strict';
const path = require('path');
module.exports = { format, outputPath };

function outputPath(cwd) { return path.join(cwd, 'llm.txt'); }

function format(context, cwd, version) {
  const name  = context.projectName || path.basename(cwd);
  const langs = [...new Set((context.fileEntries || []).map(f => f.language).filter(Boolean))];
  const mods  = context.srcDirs || [];

  return [
    `# Project: ${name}`,
    `Languages: ${langs.join(', ') || 'unknown'}`,
    `Root: ${mods[0] || 'src/'}`,
    '',
    '## Modules',
    ...mods.map(m => `- ${m}/`),
    '',
    '## Key flows',
    '- <!-- describe your main user flows here -->',
    '',
    '## Rules',
    '- <!-- describe your team conventions here -->',
    '',
    `Generated: ${new Date().toISOString()} | SigMap v${version}`,
  ].join('\n');
}
