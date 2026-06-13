'use strict';

/**
 * Canonical "how to use SigMap" guidance block (v6.16/v7.0).
 *
 * Every adapter emits this one identical block so all generated context files
 * (CLAUDE.md, AGENTS.md, .github/copilot-instructions.md, GEMINI.md, .cursorrules,
 * …) carry the same, single usage section — instead of each adapter inventing
 * its own wording (and codex emitting a redundant second JSON block).
 */

function usageBlock() {
  return [
    '## SigMap commands',
    '',
    '| When | Command |',
    '|------|---------|',
    '| Before answering a question about code | `sigmap ask "<your question>"` |',
    '| To rank files by topic | `sigmap --query "<topic>"` |',
    '| After changing config or source dirs | `sigmap validate` |',
    '| To verify an AI answer is grounded | `sigmap judge --response <file>` |',
    '',
    'Always run `sigmap ask` (or `sigmap --query`) before searching for files relevant to a task.',
    '',
  ].join('\n');
}

module.exports = { usageBlock };
