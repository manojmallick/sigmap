'use strict';

/**
 * vendored-dir.js — directories that are never the project's own source, whatever `exclude` says.
 *
 * `exclude` is a list of NAMES, and a config file that sets it replaces the default list. So a project
 * whose `gen-context.config.json` was copied from the example (which names `node_modules`, `dist`, ...
 * but no Python environment) indexed every package installed in a virtualenv below its source root,
 * so the generated context file and the retrieval index filled with third-party library signatures
 * from `<dir>/.venv/lib/python3.x/site-packages`, a directory git ignores. A name list cannot fix
 * that either, because an environment can be called anything (`.venv`, `venv`, `env`,
 * `.direnv/python-3.11`).
 *
 * Two rules that need no name and no configuration:
 *   - a directory that holds `pyvenv.cfg` IS a Python virtual environment (PEP 405 defines it by that
 *     file), and one that holds `conda-meta/` is a conda environment. Neither is ever project source.
 *   - a directory NAMED for installed third-party packages or a tool's cache is never source either.
 *     The list is kept to names that mean one thing only; `vendor`, `venv`, `env` and `build` are not
 *     on it, because projects do keep their own code under those names. They stay in `exclude`.
 *
 * Both are read from a listing the walker already has, so the check costs no filesystem call.
 *
 * Zero-dependency, bundle-safe.
 */

const VENDORED_NAMES = new Set([
  'node_modules', 'bower_components', 'jspm_packages',          // installed JS packages
  'site-packages', 'dist-packages',                             // installed Python packages
  '__pycache__', '.tox', '.nox', '.mypy_cache', '.pytest_cache', '.ruff_cache', // Python tool output
]);

/** True for a directory name that only ever holds installed packages or tool caches. */
function isVendoredName(name) {
  return VENDORED_NAMES.has(String(name));
}

/**
 * True when a directory's own listing marks it as a Python environment root: it holds a `pyvenv.cfg`
 * file (venv / virtualenv) or a `conda-meta` directory (conda).
 *
 * @param {Array<{name:string, isFile:Function, isDirectory:Function}>} entries - the directory's entries
 */
function isEnvironmentRoot(entries) {
  if (!Array.isArray(entries)) return false;
  for (const e of entries) {
    if (!e || typeof e.name !== 'string') continue;
    if (e.name === 'pyvenv.cfg' && typeof e.isFile === 'function' && e.isFile()) return true;
    if (e.name === 'conda-meta' && typeof e.isDirectory === 'function' && e.isDirectory()) return true;
  }
  return false;
}

module.exports = { isVendoredName, isEnvironmentRoot, VENDORED_NAMES };
