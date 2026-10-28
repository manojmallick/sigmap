'use strict';

/**
 * Order a file's signature groups so that the entries for shapes an extractor LEARNED
 * to read (#996) come after every entry it always listed.
 *
 * An extractor lists at most 200 signatures a file and appends a "+N more" marker. Teach
 * it a new shape and, if the new entries are interleaved in file order, they push older
 * ones past that cap: zod's `api.ts` went from 116 entries to a full 200 and lost 43 functions
 * it used to list. Appending them instead means nothing previously listed can be displaced,
 * a file with no new-shape entry is byte-identical to what it was, and a file already at the
 * cap keeps exactly what it kept.
 *
 * A group is a declaration and its indented members. It is "late" when its head is one the
 * extractor could not read before: a `$` name, an anonymous default export, a const bound to
 * a call, a CommonJS assignment method, or a head the caller marked (a generic or typed arrow,
 * a class whose generic list has a default).
 */

const NAME = /^(?:export\s+)?(?:default\s+)?(?:declare\s+)?(?:abstract\s+)?(?:async\s+)?(?:const|function|class|interface|type|enum)\s+([\w$]+)/;
const LATE_HEAD = new RegExp([
  '^export\\s+default\\s+(?:async\\s+)?(?:function\\s*\\(|\\()',                 // export default function () / export default (a) =>
  '^export\\s+const\\s+[\\w$]+\\s*=\\s*[\\w$.]+\\(\\.\\.\\.\\)',                 // export const x = make(...)
  '^[\\w$]+(?:\\.[\\w$]+)*\\.[\\w$]+\\s*=\\s*(?:async\\s+)?(?:function\\b|\\()',  // app.use = function use(fn)
].join('|'));

/**
 * @param {string[]} sigs
 * @param {Array<[number, number]|null>} anchors parallel to sigs
 * @param {string[]} docHints parallel to sigs (may be sparse)
 * @param {Set<number>} [marked] indexes of heads the caller knows are new-shape
 * @returns {{ sigs: string[], anchors: Array, docHints: string[] }}
 */
function lateLast(sigs, anchors, docHints, marked) {
  const groups = [];
  for (let i = 0; i < sigs.length; ) {
    let j = i + 1;
    while (j < sigs.length && /^\s/.test(sigs[j])) j++;
    groups.push([i, j]);
    i = j;
  }
  const isLate = (i) => {
    if ((marked && marked.has(i)) || LATE_HEAD.test(sigs[i])) return true;
    const m = NAME.exec(sigs[i]);
    return !!(m && m[1].includes('$'));
  };
  const first = [];
  const last = [];
  for (const g of groups) (isLate(g[0]) ? last : first).push(g);
  if (last.length === 0 || first.length === 0) return { sigs, anchors, docHints };
  const out = { sigs: [], anchors: [], docHints: [] };
  for (const [a, b] of first.concat(last)) {
    for (let k = a; k < b; k++) {
      out.sigs.push(sigs[k]);
      out.anchors.push(anchors[k]);
      out.docHints.push(docHints[k]);
    }
  }
  return out;
}

module.exports = { lateLast };
