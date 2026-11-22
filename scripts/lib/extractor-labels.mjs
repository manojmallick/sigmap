// The hand-labelled acceptance gate for a language extractor (#1075).
//
// The recall harness (scripts/run-extraction-recall.mjs, #983) scores an extractor against a language's OWN parser, so it can only measure
// languages that have one here (Python's ast, Ruby's Ripper, clangd, the TypeScript compiler) and lists the rest as "unmeasured". A new
// extractor for Zig, Gleam or Groovy has no such reference, and the path in CONTRIBUTING used to be `--update`, which writes the extractor's
// own output as the expected file: the extractor grades itself.
//
// This gate needs no parser. The contributor writes, BY HAND and from reading the fixture (not from what the extractor prints), two things in
// test/labels/<language>.json:
//   defines   the names the fixture declares that the extractor's contract promises to list (types, functions, methods; not locals), at least 5;
//   probes    small sources in the language where a declaration-looking line sits in a comment or a string (`mustNotContain`: it must not be
//             listed) next to one real declaration (`mustContain`: it must be, so an extractor that prints nothing cannot pass).
// Pass: at least 95% of `defines` appear, by whole word, in what the extractor listed for the fixture; every probe lists its `mustContain`
// and none of its `mustNotContain`. A reviewer then reads a short list of names and a few probes instead of a diff of regular expressions.
//
// What it does not see: a wrong signature for a right name, line ranges, a declaration form nobody thought to label, and a label list that
// is too generous or too thin (reviewing the labels is the reviewer's job). It is a floor for a new extractor, not a measure of an old one.

export const MIN_DEFINES = 5;
export const MIN_RECALL = 0.95;

const wordRe = (name) => new RegExp(`(^|[^\\p{L}\\p{N}_$])${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^\\p{L}\\p{N}_$]|$)`, 'u');
const has = (text, name) => wordRe(name).test(text);

/**
 * Check a label file is itself worth running (a label that cannot fail proves nothing).
 * @returns {string[]} problems, empty when sound
 */
export function validateLabel(label) {
  const bad = [];
  const defines = Array.isArray(label.defines) ? label.defines : [];
  if (!label.fixture || typeof label.fixture !== 'string') bad.push('`fixture` (the path of the file the names come from) is missing');
  if (new Set(defines).size < MIN_DEFINES) bad.push(`\`defines\` needs at least ${MIN_DEFINES} distinct names (has ${new Set(defines).size})`);
  if (label.minRecall !== undefined && !(label.minRecall >= MIN_RECALL && label.minRecall <= 1)) bad.push(`\`minRecall\` may be stricter than ${MIN_RECALL} but not weaker`);
  const probes = Array.isArray(label.probes) ? label.probes : [];
  if (!probes.length) bad.push('at least one probe is needed (a declaration-looking line in a comment or a string)');
  probes.forEach((p, i) => {
    const at = `probe ${i + 1}${p && p.name ? ` (${p.name})` : ''}`;
    if (!p || typeof p.source !== 'string' || !p.file) { bad.push(`${at}: needs \`file\` (a name with the language's extension) and \`source\``); return; }
    const no = p.mustNotContain || []; const yes = p.mustContain || [];
    if (!no.length) bad.push(`${at}: \`mustNotContain\` is empty`);
    if (!yes.length) bad.push(`${at}: \`mustContain\` is empty (an extractor that prints nothing would pass)`);
    for (const n of [...no, ...yes]) if (!p.source.includes(n)) bad.push(`${at}: "${n}" does not appear in its source`);
  });
  return bad;
}

/**
 * Score one extractor against one label.
 * @param {(source: string, file: string) => string[]} extract  what the extractor lists for a source (the dispatcher's `extractFile(file, source)`, flipped)
 * @param {object} label  the parsed test/labels/<language>.json
 * @param {string} fixtureSource  the text of `label.fixture`
 * @returns {{ ok: boolean, recall: number, missing: string[], probes: Array<{ name: string, ok: boolean, leaked: string[], absent: string[] }>, problems: string[] }}
 */
export function scoreLabels(extract, label, fixtureSource) {
  const problems = validateLabel(label);
  const defines = [...new Set(label.defines || [])];
  const listed = (extract(fixtureSource, label.fixture) || []).join('\n');
  const missing = defines.filter((n) => !has(listed, n));
  const recall = defines.length ? (defines.length - missing.length) / defines.length : 0;
  const probes = (label.probes || []).map((p, i) => {
    const out = (extract(p.source, p.file) || []).join('\n');
    const leaked = (p.mustNotContain || []).filter((n) => has(out, n));
    const absent = (p.mustContain || []).filter((n) => !has(out, n));
    return { name: p.name || `probe ${i + 1}`, ok: !leaked.length && !absent.length, leaked, absent };
  });
  const need = label.minRecall === undefined ? MIN_RECALL : label.minRecall;
  return { ok: !problems.length && recall >= need && probes.every((p) => p.ok), recall, missing, probes, problems };
}
