'use strict';

const { maskStrings } = require('./scan');

/**
 * Extract TODO/FIXME/HACK/XXX comments from source text.
 *
 * Markers are matched on MASKED source (string/template contents blanked:
 * `maskStrings` in scan.js), so a marker spelled inside a string literal — a
 * `'## todos'` heading pushed by a generator, an example embedded in a template
 * string — is never read as a comment (#877).
 *
 * The marker itself is case-sensitive uppercase, the convention, and bounded by
 * a word boundary, so `#hackathon`, `// Todoist` and `#FIXMEs` do not match. A
 * lowercase marker is accepted only as its shorthand with a colon (`# todo: x`),
 * where the colon makes the intent unambiguous.
 *
 * @param {string} src - Raw file content
 * @returns {{line:number, tag:string, text:string}[]}
 */

// `//`, `#` and `/*` are the comment openers this extractor reads: the first two
// as before, `/*` because `/* HACK */` is a marker too. Masking is per line, so
// an unterminated quote cannot hide markers written on later lines.
const MARKER_RE = /(?:\/\/|#|\/\*)[ \t]*((?:TODO|FIXME|HACK|XXX)\b|(?:todo|fixme|hack|xxx)(?=[ \t]*:))/;

/** The optional `:` separator between the marker and its message. */
const SEP_RE = /^[ \t]*:?[ \t]*/;

function extractTodos(src) {
  if (!src || typeof src !== 'string') return [];
  const todos = [];
  const lines = src.split('\n');

  for (let i = 0; i < lines.length; i++) {
    // Decide on masked text, read the message from the original line: masking
    // must never truncate a message (`# HACK: don't` would otherwise stop at the
    // apostrophe — the masker reads `#` as code, a private-field sigil in JS).
    const masked = maskStrings(lines[i]);
    const m = masked.match(MARKER_RE);
    if (!m) continue;

    const afterTag = m.index + m[0].length;
    const sep = masked.slice(afterTag).match(SEP_RE)[0];
    let text = lines[i].slice(afterTag + sep.length).trim();

    // In a block comment `*/` terminates the comment: it is not the message.
    const inBlock = m[0].startsWith('/*');
    if (inBlock) text = text.split('*/')[0].trim();
    // `// TODO` alone is a flag, not a message — unchanged from before.
    if (text === '' && !inBlock) continue;

    todos.push({
      line: i + 1,
      tag: m[1].toUpperCase(),
      text: text.slice(0, 70),
    });
  }

  return todos;
}

module.exports = { extractTodos };
