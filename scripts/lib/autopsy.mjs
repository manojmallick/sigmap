#!/usr/bin/env node
'use strict';

/**
 * autopsy.mjs — where SigMap and a whole-file grep scan disagree, task by task (#674).
 *
 * The honest benchmark reports two hit rates. Which tasks one finds and the other
 * misses is what says what each is missing: a task grep finds and SigMap does not
 * is vocabulary the signature index lacks; one SigMap finds and grep does not is
 * structure grep cannot see. Pure, so the cross-tabulation is tested with fake
 * records and no repository.
 *
 * A record is `{ repo, id, split, sigRank, grepRank, cleanGrepRank, ... }`, each
 * rank the 1-based place of the best expected file in that ranking, or null.
 */

const hit = (rank) => rank !== null && rank !== undefined && rank <= 5;

/**
 * Split records by who finds the answer in the top 5.
 *
 * @param {Array<object>} records
 * @param {'grepRank'|'cleanGrepRank'} [grepKey] which grep ranking to compare with
 * @returns {{both:object[], grepOnly:object[], sigmapOnly:object[], neither:object[]}}
 */
export function crossTab(records, grepKey = 'cleanGrepRank') {
  const out = { both: [], grepOnly: [], sigmapOnly: [], neither: [] };
  for (const r of records) {
    const s = hit(r.sigRank);
    const g = hit(r[grepKey]);
    (s && g ? out.both : g ? out.grepOnly : s ? out.sigmapOnly : out.neither).push(r);
  }
  return out;
}

/** Hit counts of each ranking over the same records. */
export function hitCounts(records) {
  const count = (key) => records.filter((r) => hit(r[key])).length;
  return { tasks: records.length, sigmap: count('sigRank'), grep: count('grepRank'), cleanGrep: count('cleanGrepRank') };
}

/**
 * How many of the places in the published grep ranking's top 5 are files SigMap
 * itself wrote — places a person grepping the code would never see taken.
 *
 * @param {Array<{top5:string[]}>} rankings each task's published grep top 5
 * @param {(relPath:string)=>boolean} isSigmapFile
 */
export function pollutedPlaces(rankings, isSigmapFile) {
  let places = 0;
  let polluted = 0;
  for (const r of rankings) {
    for (const f of r.top5) {
      places++;
      if (isSigmapFile(f)) polluted++;
    }
  }
  return { places, polluted };
}
