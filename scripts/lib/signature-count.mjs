#!/usr/bin/env node
'use strict';

/**
 * signature-count.mjs — count signatures in generated context STRUCTURALLY.
 *
 * The quality benchmark used to count signature lines by testing each one
 * against a hardcoded keyword-prefix allowlist (`function `, `class `, `def `,
 * `fun `, `struct `, … plus a `→` return-arrow fallback). Any language whose
 * signature begins with the IDENTIFIER rather than a keyword matched nothing
 * and counted as zero (#694):
 *
 *   R        `name <- function(args)`     -> 0
 *   Lua      `function M.name(args)`      -> matched only by luck of prefix
 *
 * R was the worst case — ggplot2 reported **1** grounded symbol against 964
 * real signature lines, a 964x undercount published as "0% grounding" for a
 * language the project markets as a headline capability. Three more repos were
 * wrong for the same reason (spring-petclinic 59 -> 361, vue-core 244 -> 666,
 * svelte 380 -> 1108).
 *
 * The generated context already delimits signatures: fenced blocks under
 * `### <file>` headers. Counting non-empty lines inside those fences needs no
 * per-language knowledge at all, so a newly added extractor cannot silently
 * read as zero.
 *
 * Zero-dependency, pure. Node built-ins only.
 */

/**
 * Non-empty lines inside fenced code blocks — the signature count.
 * @param {string} content generated context markdown
 * @returns {number}
 */
export function countSignatureLines(content) {
  let inFence = false;
  let n = 0;
  for (const line of String(content).split('\n')) {
    if (line.startsWith('```')) { inFence = !inFence; continue; }
    if (inFence && line.trim()) n++;
  }
  return n;
}

/**
 * Non-empty lines in the whole document, fences included.
 *
 * Paired with {@link countSignatureLines} so a caller can tell "there was
 * nothing to count" apart from "the counter did not see it" — the distinction
 * the R undercount hid for months.
 * @param {string} content
 * @returns {number}
 */
export function countContextLines(content) {
  return String(content).split('\n').filter((l) => l.trim()).length;
}
