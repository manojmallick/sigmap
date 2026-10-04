'use strict';
const path = require('path');
const fs   = require('fs');
module.exports = { name: 'llm-full', format, outputPath, write };

function outputPath(cwd) { return path.join(cwd, 'llm-full.txt'); }

function format(context, opts) {
  opts = opts || {};
  // Stable-prefix layout (#683): the stamp trails the entries, not heads them.
  const stampAtTail = opts.cacheLayout !== 'legacy';
  const stamp = `Generated: ${new Date().toISOString()} | SigMap v${opts.version || ''}`;
  const lines = [
    `# ${context.projectName || 'Project'} — SigMap Context`,
    ...(stampAtTail ? [] : [stamp]),
    '',
  ];
  for (const entry of (context.fileEntries || [])) {
    const rel = path.relative(opts.cwd || '', entry.filePath);
    lines.push(`## ${rel}`, '```', ...(entry.sigs || []), '```', '');
  }
  if (stampAtTail) lines.push(stamp);
  return lines.join('\n');
}

function write(context, cwd, opts) {
  opts = opts || {};
  fs.writeFileSync(outputPath(cwd), format(context, { ...opts, cwd }));
}
