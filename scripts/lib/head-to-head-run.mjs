#!/usr/bin/env node
'use strict';

/**
 * head-to-head-run.mjs — running the rivals over one repository's tasks (#972).
 *
 * Each rival indexes a THROWAWAY, PRISTINE copy of the pinned clone (git clean + checkout, so none of
 * SigMap's own output is in what the rival sees), is asked every question through its own command line,
 * and its answers are reduced to ordered files. Nothing is written in the clone itself.
 *
 * Zero-dependency; the adapters are injected, so the tests run it with stand-ins.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { copyRepo, resetCopy } from './warm-cache.mjs';

/**
 * @param {object} p
 * @param {string} p.dir       the pinned clone
 * @param {Array<{id:string, query:string, expected_files:string[]}>} p.tasks
 * @param {Array<object>} p.adapters   as returned by cbmAdapter / crgAdapter
 * @param {boolean} [p.pristine=true]  copy and clean the clone first (the tests pass false for a plain directory)
 * @param {(msg:string)=>void} [p.log]
 * @returns {{ byTool: Object<string,{ index:{ms:number,bytes:number}|null, error:string|null, tasks:Object<string,{ supported:boolean, arms:Object<string,{files:string[], tokens:number, results:number}> }> }> }}
 */
export function runRivalsOnRepo({ dir, tasks, adapters, pristine = true, log = () => {} }) {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-h2h-'));
  const copy = path.join(work, 'repo');
  try {
    if (pristine) { copyRepo(dir, copy); resetCopy(copy); } else fs.cpSync(dir, copy, { recursive: true });
    const byTool = {};
    for (const ad of adapters) {
      const rec = { index: null, error: null, tasks: {} };
      byTool[ad.id] = rec;
      try {
        log(`  ${ad.id}: indexing`);
        rec.index = ad.index(copy);
        for (const t of tasks) {
          const supported = t.expected_files.some((f) => ad.hasFile(copy, f));
          const arms = {};
          if (supported) for (const arm of ad.arms) arms[arm] = ad.query(copy, arm, t.query);
          rec.tasks[t.id] = { supported, arms };
        }
      } catch (e) {
        // a rival that cannot index or answer is reported as such, never as a miss
        rec.error = String(e && e.message ? e.message : e).slice(0, 400);
        for (const t of tasks) rec.tasks[t.id] = { supported: false, arms: {} };
      } finally {
        try { ad.forget(); } catch (_) { /* best effort */ }
      }
    }
    return { byTool };
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
}
