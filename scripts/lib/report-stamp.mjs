'use strict';

/**
 * report-stamp.mjs — provenance for every benchmark report (#854, closes #707).
 *
 * `benchmarks/latest.json` is assembled from five committed reports, and until
 * now nothing recorded which release produced each one. Four of the five
 * carried no version at all, so the snapshot could pair figures from different
 * releases and `check:metrics` would still pass: it verifies that latest.json
 * matches the SAVED reports, never that a saved report belongs to the release
 * being stamped. v8.49 published a test-discovery F1 measured at v8.8.0, and
 * v8.61.2 published one measured a day before its own run.
 *
 * Every `--save` path stamps through `stamp()` here so the shape cannot drift
 * between scripts, and the generator reads provenance back through
 * `provenanceOf()` to publish it and to refuse a stale source.
 *
 * Zero dependencies.
 */

import { createRequire } from 'module';
import { join } from 'path';

const require = createRequire(import.meta.url);

/**
 * The release line a benchmark snapshot is scoped to — `major.minor`.
 *
 * Deliberately NOT the patch: `benchmark_id` is `sigmap-v8.61-main`, so a
 * report produced at 8.61.0 is legitimately part of the v8.61 snapshot and a
 * patch release must not be forced to re-run every suite. A report from a
 * different minor line is the defect this guards.
 *
 * @param {string} version
 * @returns {string} e.g. "8.61"
 */
export function minorLine(version) {
  const [maj, min] = String(version).split('.');
  return `${maj}.${min}`;
}

/**
 * Add provenance to a report object, in place of the caller doing it by hand.
 * @param {object} report
 * @param {string} root - repo root
 * @returns {object} the same object, stamped
 */
export function stamp(report, root) {
  const pkg = require(join(root, 'package.json'));
  report.version = pkg.version;
  // Always overwritten, never preserved: `generated` records when THIS file
  // was written. Keeping a value the report object already carried is how a
  // rewritten report keeps an older date, which is the confusion this module
  // exists to remove.
  report.generated = new Date().toISOString();
  return report;
}

/**
 * Read a report's provenance. A report written before stamping existed has no
 * version; that is reported as null rather than guessed, because inventing a
 * version for an unknown run is the failure mode this module exists to stop.
 *
 * @param {object|null} report
 * @returns {{version: string|null, generated: string|null}}
 */
export function provenanceOf(report) {
  if (!report) return { version: null, generated: null };
  const generated = report.generated || report.generatedAt || report.timestamp || null;
  return {
    version: report.version || null,
    generated: generated ? String(generated) : null,
  };
}

/**
 * Split the sources into the two failure modes, which are not the same thing.
 *
 *   drifted   — the report says which release produced it, and it is a
 *               DIFFERENT release line. This is the #707 defect: v8.49
 *               published a test-discovery F1 measured at v8.8.0. Hard failure.
 *   unstamped — the report predates stamping, so its provenance is genuinely
 *               unknown. Writing a version into it by hand would be inventing
 *               the very fact this module exists to record, and refusing
 *               outright would mean the change cannot land until every suite
 *               has been re-run. Published as `version: null` instead, so the
 *               snapshot says "unknown" out loud, and warned about. The state
 *               disappears the first time each suite runs.
 *
 * An absent report is neither — the suite may not have run in this checkout,
 * and the generator already treats those as optional.
 *
 * @param {Record<string, object|null>} reports - name -> parsed report (or null)
 * @param {string} releaseVersion
 * @returns {{drifted: Array<object>, unstamped: Array<object>}}
 */
export function classifySources(reports, releaseVersion) {
  const want = minorLine(releaseVersion);
  const drifted = [];
  const unstamped = [];
  for (const [name, report] of Object.entries(reports)) {
    if (!report) continue;
    const prov = provenanceOf(report);
    if (prov.version === null) unstamped.push({ name, ...prov });
    else if (minorLine(prov.version) !== want) drifted.push({ name, ...prov });
  }
  return { drifted, unstamped };
}
