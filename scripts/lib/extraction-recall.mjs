#!/usr/bin/env node
'use strict';

/**
 * extraction-recall.mjs — the arithmetic of the extraction-recall benchmark (#983):
 * tallies, rows, floors and the report text. No I/O and no language knowledge, so
 * the tests can feed it synthetic reference output.
 *
 * The question it answers: of the symbols a language's own parser says a file
 * defines, how many does SigMap list, by name, in that file? One answer per
 * KIND (class, function, method...) and per POPULATION: the extractor's raw
 * output, and the index as shipped (after the per-file signature cap).
 *
 * Dev-only. Nothing here ships in the npm package and nothing at runtime depends
 * on a reference parser.
 */

export const SCHEMA = 1;

/** Misses kept per kind in a saved report: enough to read, small enough to commit. */
export const MISS_CAP = 60;

/** One decimal, the same rounding everywhere a recall is printed or saved. */
export function pct(found, reference) {
  return reference ? Math.round((1000 * found) / reference) / 10 : null;
}

/**
 * A tally for the given kinds: `reference` and `found` counts, how many private
 * names were skipped, and the first MISS_CAP misses (the rest are only counted).
 */
export function newTally(kinds) {
  const t = {};
  for (const k of kinds) t[k] = { reference: 0, found: 0, skipped: 0, misses: [] };
  return t;
}

/** Record one reference symbol: `hit` says whether SigMap listed it; `where` locates a miss. */
export function record(tally, kind, hit, where) {
  const row = tally[kind];
  row.reference++;
  if (hit) row.found++;
  else if (row.misses.length < MISS_CAP) row.misses.push(where);
}

/** Record a reference symbol the comparison leaves out by design (a private name). */
export function skip(tally, kind) {
  tally[kind].skipped++;
}

/** Rows in a stable order, ready to print or save. */
export function rowsOf(tally) {
  return Object.entries(tally).map(([kind, t]) => ({
    kind, reference: t.reference, found: t.found, recall: pct(t.found, t.reference), skipped: t.skipped,
    missed: t.reference - t.found,
  }));
}

/** The misses of a tally, by kind, for the saved report. */
export function missesOf(tally) {
  const out = {};
  for (const [kind, t] of Object.entries(tally)) out[kind] = t.misses.slice();
  return out;
}

/**
 * A population ready for the report. `served` records what produced the output
 * under measurement when that is not obvious (for example the Python tier).
 */
export function population(label, filesCompared, tally, extra = {}) {
  return { label, filesCompared, rows: rowsOf(tally), misses: missesOf(tally), ...extra };
}

/**
 * The floors entry that applies to an interpreter version, or null.
 * `references` is an ordered list of { match, floors }; `match` is a version
 * prefix ("2.6", "3."), the first prefix the version starts with wins.
 */
export function floorsFor(spec, version) {
  if (!spec || !Array.isArray(spec.references) || !version) return null;
  return spec.references.find((r) => String(version).startsWith(r.match)) || null;
}

/**
 * Check a measured language against its floors.
 *
 * A floor is a promise about ONE reference parser: another version parses a
 * different set of files, so its numbers are reported but never compared with a
 * floor recorded for a different version. `not-enforced` says so.
 *
 * @returns {{ status: 'pass'|'fail'|'not-enforced'|'unmeasured'|'unfloored', checks: object[], note?: string }}
 * (a check is 'pass', 'fail' or 'skipped'; skipped checks never fail a run)
 */
export function evaluate(result, spec) {
  if (!result || result.measured === false) {
    return { status: 'unmeasured', checks: [], note: result ? result.reason : 'no result' };
  }
  const ref = floorsFor(spec, result.reference && result.reference.version);
  if (!spec) return { status: 'unfloored', checks: [], note: 'no floors are recorded for this language' };
  if (!ref) {
    return {
      status: 'not-enforced', checks: [],
      note: `floors are recorded for ${(spec.references || []).map((r) => r.match).join(', ') || 'no version'}; this run used ${result.reference && result.reference.version}`,
    };
  }
  const checks = [];
  for (const [popId, byKind] of Object.entries(ref.floors)) {
    const pop = result.populations && result.populations[popId];
    // A population the run was told not to measure (--no-index) is skipped; one that was
    // meant to be there and is not is a failure, so a floor can never pass by absence.
    const notRun = !pop && Array.isArray(result.notRun) && result.notRun.includes(popId);
    for (const [kind, floor] of Object.entries(byKind)) {
      const row = pop && pop.rows.find((r) => r.kind === kind);
      const recall = row ? row.recall : null;
      checks.push({
        population: popId, kind, floor, recall,
        status: notRun ? 'skipped' : recall === null ? 'fail' : recall >= floor ? 'pass' : 'fail',
      });
    }
  }
  return { status: checks.some((c) => c.status === 'fail') ? 'fail' : 'pass', checks, match: ref.match };
}

/** Human-readable block for one measured language. */
export function formatLanguage(language, result, verdict, opts = {}) {
  if (result.measured === false) return [`${language}: unmeasured (${result.reason})`];
  const ref = result.reference;
  const out = [`${language}: ${ref.name} ${ref.version}${result.pins ? `, pins ${Object.entries(result.pins).map(([r, s]) => `${r} ${s || '?'}`).join(', ')}` : ''}`];
  for (const [id, pop] of Object.entries(result.populations)) {
    out.push(`  ${id} — ${pop.label} (${pop.filesCompared} files)`);
    for (const r of pop.rows) {
      const flo = verdict.checks.find((c) => c.population === id && c.kind === r.kind);
      const tail = flo ? `  floor ${flo.floor}%${flo.status === 'fail' ? '  FAIL' : ''}` : '';
      out.push(`    ${r.kind.padEnd(8)} ${String(r.found).padStart(6)} of ${String(r.reference).padStart(6)}  ${r.recall === null ? '  n/a' : r.recall.toFixed(1).padStart(5) + '%'}${tail}`);
    }
    if (opts.misses) {
      for (const [kind, list] of Object.entries(pop.misses)) {
        if (list.length) out.push(`    first ${list.length} ${kind} misses:`, ...list.slice(0, opts.misses).map((m) => `      ${m}`));
      }
    }
  }
  if (verdict.status === 'not-enforced') out.push(`  floors not enforced: ${verdict.note}`);
  if (verdict.status === 'unfloored') out.push(`  ${verdict.note}`);
  return out;
}
