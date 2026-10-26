'use strict';

/**
 * Reference for PHP `use` imports (#980): PHP's own tokenizer and Composer's own autoloader.
 *
 * In a scratch copy of the repository, `composer dump-autoload --classmap-authoritative`
 * builds the autoloader the project's `composer.json` declares (`psr-4`, `classmap`, `files`)
 * over the project's own code; dependencies are not installed, so a class from a package
 * resolves to nothing, as it does for the graph. `php-uses.php` then reads each file with
 * `token_get_all` and asks Composer's ClassLoader which file defines each class a top-level
 * `use` names. Nothing of the resolver under test is in this path.
 *
 * Dev-only. Nothing here ships in the npm package.
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const GROUP = 'php';
const HELPER = path.join(path.dirname(fileURLToPath(import.meta.url)), 'php-uses.php');

/**
 * @param {{ tree: string, files: string[], tools: { php: string, composer: string }, work: string }} i
 * @returns {{ edges: Array<[string,string]>, covered: Set<string>, notes: object }}
 */
export function reference({ tree, files, tools, work }) {
  if (!fs.existsSync(path.join(tree, 'composer.json'))) {
    return { edges: [], covered: new Set(), notes: { unmeasured: 'the repository has no composer.json' } };
  }
  const env = { ...process.env, COMPOSER_HOME: path.join(work, 'composer-home'), COMPOSER_CACHE_DIR: path.join(work, 'composer-cache'), COMPOSER_DISABLE_XDEBUG_WARN: '1', COMPOSER_ALLOW_SUPERUSER: '1' };
  fs.mkdirSync(env.COMPOSER_HOME, { recursive: true });
  const dump = spawnSync(tools.php, [tools.composer, 'dump-autoload', '--classmap-authoritative', '--no-interaction', '--no-scripts', '--no-ansi', '--working-dir', tree], { cwd: tree, env, encoding: 'utf8', maxBuffer: 1 << 26, timeout: 600000 });
  if (dump.status !== 0 || !fs.existsSync(path.join(tree, 'vendor/autoload.php'))) {
    return { edges: [], covered: new Set(), notes: { unmeasured: `composer dump-autoload failed: ${(dump.stderr || dump.stdout || '').trim().split('\n').slice(0, 3).join(' | ').slice(0, 300)}` } };
  }
  const list = path.join(work, 'php-files.json');
  fs.writeFileSync(list, JSON.stringify(files));
  const run = spawnSync(tools.php, [HELPER, tree, list], { cwd: tree, env, encoding: 'utf8', maxBuffer: 1 << 28, timeout: 1200000 });
  if (run.status !== 0) {
    return { edges: [], covered: new Set(), notes: { unmeasured: `php-uses.php failed: ${(run.stderr || '').trim().split('\n').slice(0, 3).join(' | ').slice(0, 300)}` } };
  }
  const out = JSON.parse(run.stdout);
  const failed = new Set(out.__failed__ || []);
  const edges = [];
  const covered = new Set();
  for (const rel of files) {
    if (!(rel in out)) continue;                       // unreadable: listed under __failed__, never covered
    covered.add(rel);
    for (const dep of out[rel]) edges.push([rel, dep]);
  }
  return { edges, covered, notes: { failed: failed.size } };
}
