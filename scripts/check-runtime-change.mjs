#!/usr/bin/env node
'use strict';

/**
 * check-runtime-change.mjs — did a file the package runs change since the last
 * release? (#999)
 *
 *   node scripts/check-runtime-change.mjs                          # HEAD against the latest release tag
 *   node scripts/check-runtime-change.mjs --from v8.85.0 --to HEAD
 *   node scripts/check-runtime-change.mjs --json
 *   node scripts/check-runtime-change.mjs --github-output "$GITHUB_OUTPUT"
 *
 * A new npm version whose runtime files equal the previous one's carries
 * nothing for a user to install: 11 of the 71 releases between 2026-09-15 and
 * 2026-10-29 were that. This reads the question off git, so `tag-on-merge`
 * can answer it before it tags.
 *
 * "Runtime" is what the package ships as code: `gen-context.js`,
 * `gen-project-map.js`, `src/` and `packages/`. A file that differs only by the
 * version string (the release bump touches six of them) does not count, and
 * neither do the README, the llms files, the docs, the benchmarks or the
 * workflows. `SHIPPED_NON_RUNTIME` names the other entries of package.json
 * `files`, and a test fails when `files` gains an entry that is in neither
 * list, so a new shipped directory cannot be forgotten here.
 *
 * The manifest counts through the fields that change what runs after an
 * install (`MANIFEST_FIELDS`: entry points, `bin`, `engines`, the dependency
 * tables), so a new dependency or a moved `main` publishes. Its `version`,
 * `scripts`, `files` and metadata do not; a `files` entry that adds a
 * directory of code shows up as that directory's new files.
 *
 * Output (also written, one `key=value` per line, to `--github-output`):
 *
 *   runtime_changed  true | false
 *   previous_tag     the release the comparison started from (empty when none)
 *
 * With no previous release tag the answer is `true`: the first release always
 * publishes. Exit 0 when the question was answered, 2 on a usage or git error.
 *
 * Zero-dependency. Node built-ins and the `git` binary only.
 */

import { execFileSync } from 'child_process';
import { appendFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Paths whose content is the package a user runs. */
export const RUNTIME = ['gen-context.js', 'gen-project-map.js', 'src', 'packages'];

/** The other entries of package.json `files`: shipped, but not code. */
export const SHIPPED_NON_RUNTIME = [
  'README.md',
  'LICENSE',
  'llms.txt',
  'llms-full.txt',
  '.contextignore.example',
  'gen-context.config.json.example',
];

/** package.json fields that change what runs once the package is installed. */
export const MANIFEST_FIELDS = [
  'main', 'module', 'types', 'type', 'exports', 'bin', 'engines', 'os', 'cpu',
  'dependencies', 'peerDependencies', 'optionalDependencies', 'bundledDependencies', 'bundleDependencies',
];

const RELEASE_TAG = 'v[0-9]*.[0-9]*.[0-9]*';

function git(cwd, args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'pipe'] });
}

/** The text of `file` at `ref`, or null when it does not exist there. */
function readAt(cwd, ref, file) {
  try {
    return execFileSync('git', ['show', `${ref}:${file}`], { cwd, encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return null;
  }
}

/** package.json `version` at `ref`, or null. */
function versionAt(cwd, ref) {
  const text = readAt(cwd, ref, 'package.json');
  if (text === null) return null;
  try {
    return JSON.parse(text).version || null;
  } catch {
    return null;
  }
}

/**
 * The newest release tag reachable from `to`, never one that points at `to`
 * itself (a commit that is already tagged is compared with the release before
 * it). Prerelease tags (`v1.2.3-rc.1`) are not releases here.
 * @returns {string|null}
 */
export function previousReleaseTag(cwd, to = 'HEAD') {
  const own = git(cwd, ['tag', '--points-at', to]).split('\n').filter(Boolean);
  const args = ['describe', '--tags', '--abbrev=0', '--match', RELEASE_TAG, '--exclude', '*-*'];
  for (const t of own) args.push('--exclude', t);
  args.push(to);
  try {
    return git(cwd, args).trim() || null;
  } catch {
    return null;
  }
}

/** `text` with every occurrence of `version` replaced by a placeholder. */
const normalise = (text, version) => (version ? text.split(version).join('@@VERSION@@') : text);

/** JSON with object keys in sorted order, so key order alone never reads as a change. */
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

/** The `MANIFEST_FIELDS` that differ between two package.json texts (`['(unreadable)']` when one does not parse). */
function manifestFieldsChanged(a, b) {
  let x, y;
  try {
    x = JSON.parse(a);
    y = JSON.parse(b);
  } catch {
    return ['(unreadable)'];
  }
  return MANIFEST_FIELDS.filter((f) => canonical(x[f]) !== canonical(y[f]));
}

/**
 * Compare the runtime files of two refs.
 * @param {{ cwd?: string, from?: string|null, to?: string }} [opts]
 * @returns {{ from: string|null, to: string, fromVersion: string|null, toVersion: string|null,
 *             runtimeChanged: boolean, changed: string[], touched: number, reason: string }}
 */
export function runtimeChange({ cwd = ROOT, from, to = 'HEAD' } = {}) {
  const base = from === undefined ? previousReleaseTag(cwd, to) : from;
  if (!base) {
    return { from: null, to, fromVersion: null, toVersion: versionAt(cwd, to), runtimeChanged: true, changed: [], touched: 0, reason: 'no-previous-release' };
  }
  const fromVersion = versionAt(cwd, base) || (/^v\d/.test(base) ? base.slice(1) : null);
  const toVersion = versionAt(cwd, to);
  const touched = git(cwd, ['diff', '--name-only', '-z', '--no-renames', base, to, '--', ...RUNTIME, 'package.json']).split('\0').filter(Boolean);
  const changed = [];
  for (const file of touched) {
    const a = readAt(cwd, base, file);
    const b = readAt(cwd, to, file);
    if (file === 'package.json') {
      const fields = a === null || b === null ? ['(missing)'] : manifestFieldsChanged(a, b);
      if (fields.length) changed.push(`package.json (${fields.join(', ')})`);
    } else if (a === null || b === null || normalise(a, fromVersion) !== normalise(b, toVersion)) {
      changed.push(file);
    }
  }
  return {
    from: base,
    to,
    fromVersion,
    toVersion,
    runtimeChanged: changed.length > 0,
    changed,
    touched: touched.length,
    reason: changed.length > 0 ? 'runtime-files-changed' : 'version-strings-only',
  };
}

function describe(r) {
  if (r.reason === 'no-previous-release') return 'no earlier release tag, so there is a first release to publish';
  if (!r.runtimeChanged) {
    const n = r.touched;
    return `runtime files since ${r.from}: unchanged (${n} touched file${n === 1 ? '' : 's'}, none of them a change to what runs), so a new npm version would carry nothing`;
  }
  const shown = r.changed.slice(0, 20).join(', ');
  const more = r.changed.length > 20 ? `, and ${r.changed.length - 20} more` : '';
  return `runtime files since ${r.from}: ${r.changed.length} changed: ${shown}${more}`;
}

function option(argv, name) {
  const at = argv.indexOf(name);
  return at === -1 ? undefined : argv[at + 1];
}

function main(argv) {
  for (const flag of ['--from', '--to', '--github-output']) {
    if (argv.includes(flag) && (option(argv, flag) === undefined || String(option(argv, flag)).startsWith('--'))) {
      console.error(`check-runtime-change: ${flag} needs a value`);
      process.exit(2);
    }
  }
  let r;
  try {
    r = runtimeChange({ cwd: process.cwd(), from: option(argv, '--from'), to: option(argv, '--to') || 'HEAD' });
  } catch (e) {
    console.error(`check-runtime-change: ${String(e.stderr || e.message).trim().split('\n')[0]}`);
    process.exit(2);
  }
  const out = option(argv, '--github-output');
  if (out) appendFileSync(out, `runtime_changed=${r.runtimeChanged}\nprevious_tag=${r.from || ''}\n`);
  if (argv.includes('--json')) console.log(JSON.stringify(r, null, 2));
  else console.log(describe(r));
}

if (import.meta.url === `file://${process.argv[1]}`) main(process.argv.slice(2));
