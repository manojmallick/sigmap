'use strict';

/**
 * Compare signature arrays and produce compact diff markers.
 * @param {string[]} baseSigs
 * @param {string[]} currentSigs
 * @returns {{added:string[], removed:string[], modified:string[]}}
 */
function diffSignatures(baseSigs, currentSigs) {
  const base = new Set(baseSigs || []);
  const curr = new Set(currentSigs || []);

  const added = [...curr].filter((s) => !base.has(s));
  const removed = [...base].filter((s) => !curr.has(s));

  const byName = (arr) => {
    const m = new Map();
    for (const s of arr) {
      const n = extractName(s);
      if (!n) continue;
      if (!m.has(n)) m.set(n, []);
      m.get(n).push(s);
    }
    return m;
  };

  const aBy = byName(added);
  const rBy = byName(removed);
  const modified = [];

  for (const [name] of aBy) {
    if (rBy.has(name)) modified.push(name);
  }

  return { added, removed, modified };
}

/**
 * Extract the declared symbol name from a signature line.
 *
 * Robust to the real forms SigMap emits — `export class X`, `const x = () =>`,
 * `async function x`, members, a trailing `:start-end` anchor, and `→ return`
 * suffixes. Anchored so it never returns a mid-string fragment (the old regex
 * could turn a signature into a 2-char name like `is`), and returns '' for
 * non-symbol lines (`module.exports = {…}`, markdown headers) instead of guessing.
 */
function extractName(sig) {
  if (!sig) return '';
  // Drop a trailing `:start-end` (or `:line`) line anchor.
  let t = String(sig).replace(/\s*:\d+(?:-\d+)?\s*$/, '').trim();
  // Re-export / barrel lines carry no single declared name.
  if (/^(?:module\.)?exports\b/.test(t) || /^export\s*\{/.test(t) || /^export\s+\*/.test(t)) return '';
  // Strip leading modifiers so the keyword/name is at the start.
  t = t.replace(/^export\s+/, '')
       .replace(/^default\s+/, '')
       .replace(/^(?:public|private|protected|static|abstract|final|override|readonly)\s+/g, '')
       .replace(/^async\s+/, '');
  let m;
  // Declared forms: function/def/func/fn/class/interface/trait/struct/enum/record/type <name>
  if ((m = t.match(/^(?:def|function|func|fn|class|interface|trait|struct|enum|record|type)\s+([A-Za-z_$][\w$]*)/))) return m[1];
  // const/let/var/val <name> = …  (arrow functions, assigned values)
  if ((m = t.match(/^(?:const|let|var|val)\s+([A-Za-z_$][\w$]*)/))) return m[1];
  // Call / method form: <name>(…)
  if ((m = t.match(/^([A-Za-z_$][\w$]*)\s*\(/))) return m[1];
  // Lone identifier (e.g. a collapsed `symbol` after the anchor was stripped).
  if ((m = t.match(/^([A-Za-z_$][\w$]*)$/))) return m[1];
  return '';
}

module.exports = { diffSignatures, extractName };
