'use strict';

/**
 * Star nudge + run counter (v7.0.0).
 *
 * Records run counts in `.context/usage.json` and shows a one-time GitHub-star
 * message after the tool has been genuinely useful (≥10 runs, ≥8 successes).
 * The file lives in the project, so "once" means once per PROJECT, not per
 * machine — even under concurrent runs (an `wx` lock file makes the show
 * race-safe). Written by every generate, `ask` and `squeeze` run. Counts and
 * dates only; `--track`, `--no-track` and SIGMAP_NO_TRACK govern the two run
 * logs (`usage.ndjson`, `gain.ndjson`), not this counter (documented in
 * docs-vp/guide/config.md).
 */

const fs = require('fs');
const path = require('path');

const RUN_THRESHOLD = 10;
const SUCCESS_THRESHOLD = 8;

function usagePath(cwd) { return path.join(cwd, '.context', 'usage.json'); }

function defaultUsage() {
  return {
    totalRuns: 0, successfulRuns: 0, squeezeOffered: 0, squeezeAccepted: 0,
    starNudgeShown: false, firstRunDate: null, lastRunDate: null,
  };
}

function readUsage(cwd) {
  try { return { ...defaultUsage(), ...JSON.parse(fs.readFileSync(usagePath(cwd), 'utf8')) }; }
  catch (_) { return defaultUsage(); }
}

function writeUsageAtomic(cwd, usage) {
  const p = usagePath(cwd);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const tmp = `${p}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(usage, null, 2));
  fs.renameSync(tmp, p); // atomic on POSIX
}

const STAR_MESSAGE = [
  '─────────────────────────────────────────────────────────',
  '  SigMap has helped you 10 times now.',
  '',
  "  If it's been useful, a GitHub star takes 5 seconds and",
  '  helps other developers find it:',
  '  → github.com/manojmallick/sigmap',
  '',
  "  (Won't ask again. Press Enter to continue.)",
  '─────────────────────────────────────────────────────────',
].join('\n');

function showStarNudge(write) {
  (write || ((s) => process.stderr.write(s)))('\n' + STAR_MESSAGE + '\n');
}

/**
 * Record one run and, when the thresholds are first met, show the star nudge.
 * @param {string} cwd
 * @param {boolean} runSuccess
 * @param {object} [opts]
 * @param {boolean} [opts.silent]   record only — never print
 * @param {function} [opts.write]   sink for the message (default stderr)
 * @param {string} [opts.today]     override date (testing)
 * @param {object} [opts.bump]      counter deltas to merge (e.g. { squeezeAccepted: 1 })
 * @returns {{ usage, nudged }}
 */
function checkStarNudge(cwd, runSuccess, opts = {}) {
  const usage = readUsage(cwd);
  usage.totalRuns += 1;
  if (runSuccess) usage.successfulRuns += 1;
  if (opts.bump) for (const k of Object.keys(opts.bump)) usage[k] = (usage[k] || 0) + opts.bump[k];

  const today = opts.today || new Date().toISOString().slice(0, 10);
  if (!usage.firstRunDate) usage.firstRunDate = today;
  usage.lastRunDate = today;

  let nudged = false;
  if (!usage.starNudgeShown && usage.totalRuns >= RUN_THRESHOLD && usage.successfulRuns >= SUCCESS_THRESHOLD) {
    // Race-safe single-show: only the process that creates the lock prints.
    let won = false;
    try { fs.closeSync(fs.openSync(usagePath(cwd) + '.nudge.lock', 'wx')); won = true; }
    catch (_) { won = false; }
    if (won && !opts.silent) showStarNudge(opts.write);
    nudged = won;
    usage.starNudgeShown = true;
  }

  writeUsageAtomic(cwd, usage);
  return { usage, nudged };
}

module.exports = { checkStarNudge, readUsage, usagePath, showStarNudge, RUN_THRESHOLD, SUCCESS_THRESHOLD };
