#!/usr/bin/env node
'use strict';
/**
 * Prototype deliveries of the prefetch hook, for the agent study's fourth round (docs-vp/guide/agent-study-protocol.md, stage B1).
 * Not shipped. Each style calls the product's own `prefetch()` (src/session/prefetch.js), so the ranking, the signatures and the
 * dedupe are SigMap's, and changes only what reaches Claude Code and how:
 *
 *   plain   the same block as plain stdout instead of the JSON `additionalContext` (Claude Code labels it "hook success:")
 *   firm    the same block under a header that says where to start, instead of "leads, not an answer"
 *   brief   the same ranking with at most ~2.5 KB of signatures, instead of ~8 KB
 *
 * Usage as a Claude Code hook command:  node prototype-hook.cjs <style> <path to gen-context.js>
 * Like the product's hook it exits 0 and prints nothing on any failure.
 */
const path = require('path');

const STYLES = ['plain', 'firm', 'brief'];

/** The header of the `firm` style: still honest about the ranking being a ranking, but says what to do first. */
const FIRM_HEADER = [
  '## Files SigMap ranked for this question',
  'Before you started, SigMap ranked this repository\'s files against the question from its offline index (no model call). The answer is usually in the first few. Start with them: each signature carries a `:start-end` line anchor you can Read directly, and search only if none of them fits.',
].join('\n');

const BRIEF_BYTES = 2560;

function build(style, payload, cwd, script) {
  const prefetch = require(path.join(__dirname, '..', '..', '..', 'src', 'session', 'prefetch.js'));
  const r = prefetch.prefetch(payload, cwd, { script, maxBytes: style === 'brief' ? BRIEF_BYTES : undefined });
  if (!r || !r.stdout) return null;
  let block = JSON.parse(r.stdout).hookSpecificOutput.additionalContext;
  if (style === 'firm') {
    if (!block.startsWith(prefetch.HEADER)) return null; // the product's block changed shape: say nothing rather than guess
    block = FIRM_HEADER + block.slice(prefetch.HEADER.length);
  }
  return block;
}

function main() {
  const style = process.argv[2];
  const script = process.argv[3];
  if (!STYLES.includes(style) || !script) return;
  let raw = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (d) => { raw += d; });
  process.stdin.on('end', () => {
    try {
      const payload = JSON.parse(raw);
      const cwd = typeof payload.cwd === 'string' && payload.cwd ? payload.cwd : process.cwd();
      const block = build(style, payload, cwd, script);
      if (!block) return;
      process.stdout.write(style === 'plain' ? block : JSON.stringify({ hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: block } }));
    } catch (_) { /* silence: a hook must never fail someone's session */ }
  });
}

if (require.main === module) main();
module.exports = { STYLES, FIRM_HEADER, BRIEF_BYTES, build };
