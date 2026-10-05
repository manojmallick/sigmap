'use strict';

/**
 * monorepo.js — the single monorepo verdict, with its evidence.
 *
 * SigMap had three detectors that disagreed about the same repo (#781):
 *
 *   * `_detectMonorepo` in source-root-resolver.js — marker files only
 *   * `_monorepoMarker` in config/tune.js          — a duplicate of the above
 *   * `detectMonorepoPackages` in gen-context.js   — scans the layout
 *
 * On SigMap's own repo the marker-based pair answered "no" (there is no
 * `pnpm-workspace.yaml` and no `package.json.workspaces`) while the layout scan
 * found two packages, so `roots` and `tune` told the user they were not in a
 * monorepo while `--monorepo` demonstrably processed `packages/core` and
 * `packages/cli`. `tune` therefore never proposed `monorepo: true` for a repo
 * where the mode works.
 *
 * One function answers it now, and it reports HOW it decided: a declared
 * workspace and a layout-only match are different facts, and collapsing them
 * into a bare boolean is what let the disagreement hide.
 *
 * Zero dependencies.
 */

const fs = require('fs');
const path = require('path');

/** Files that DECLARE a workspace. */
const MARKERS = ['pnpm-workspace.yaml', 'turbo.json', 'nx.json', 'lerna.json', 'melos.yaml'];

/** Directories that conventionally hold sibling packages. */
const MONO_ROOTS = ['packages', 'apps', 'services', 'libs', 'modules'];

/**
 * Any of these makes a directory a package. `pubspec.yaml` (Dart) and `mix.exs`
 * (Elixir) were missing, so a pub workspace or an umbrella project was not a
 * monorepo and none of its packages was ever offered as a source root (#900).
 */
const PKG_MANIFESTS = [
  'package.json', 'pyproject.toml', 'Cargo.toml', 'go.mod',
  'build.gradle', 'build.gradle.kts', 'pom.xml', 'requirements.txt',
  'pubspec.yaml', 'mix.exs',
];

/** A layout match needs at least this many sibling packages to count. */
const MIN_LAYOUT_PACKAGES = 2;

/**
 * The declared-workspace marker for this repo, or null.
 * @returns {string|null} the marker's filename, for use as evidence
 */
function workspaceMarker(cwd) {
  for (const m of MARKERS) {
    if (fs.existsSync(path.join(cwd, m))) return m;
  }
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), 'utf8'));
    if (pkg.workspaces) return 'package.json workspaces';
  } catch (_) {}
  // Dart 3.6+ pub workspaces declare their members in the root pubspec, and an
  // Elixir umbrella project says where its apps live in the root mix.exs.
  try {
    if (/^workspace:/m.test(fs.readFileSync(path.join(cwd, 'pubspec.yaml'), 'utf8'))) return 'pubspec.yaml workspace';
  } catch (_) {}
  try {
    if (/\bapps_path:/.test(fs.readFileSync(path.join(cwd, 'mix.exs'), 'utf8'))) return 'mix.exs apps_path';
  } catch (_) {}
  return null;
}

/**
 * Sibling packages found by scanning the conventional container directories.
 * @returns {Array<{dir: string, manifest: string}>} repo-relative package dirs
 */
function layoutPackages(cwd) {
  const found = [];
  for (const top of MONO_ROOTS) {
    const topFull = path.join(cwd, top);
    let entries;
    try { entries = fs.readdirSync(topFull, { withFileTypes: true }); } catch (_) { continue; }
    for (const e of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (!e.isDirectory()) continue;
      const pkgDir = path.join(topFull, e.name);
      const manifest = PKG_MANIFESTS.find((m) => fs.existsSync(path.join(pkgDir, m)));
      if (manifest) found.push({ dir: `${top}/${e.name}`, manifest });
    }
  }
  return found;
}

/**
 * The monorepo verdict for a repo, and the evidence behind it.
 *
 * `isMonorepo` is true for a declared workspace OR a layout carrying at least
 * MIN_LAYOUT_PACKAGES sibling packages. One package under `packages/` is a
 * common single-package layout, not a monorepo, so it does not qualify.
 *
 * @param {string} cwd
 * @returns {{
 *   isMonorepo: boolean,
 *   source: 'marker'|'layout'|'none',
 *   evidence: string,
 *   marker: string|null,
 *   packages: Array<{dir: string, manifest: string}>
 * }}
 */
function detectMonorepo(cwd) {
  const marker = workspaceMarker(cwd);
  const packages = layoutPackages(cwd);

  if (marker) {
    return {
      isMonorepo: true,
      source: 'marker',
      evidence: `marker: ${marker}`,
      marker,
      packages,
    };
  }
  if (packages.length >= MIN_LAYOUT_PACKAGES) {
    const top = packages[0].dir.split('/')[0];
    return {
      isMonorepo: true,
      source: 'layout',
      evidence: `layout: ${packages.length} manifests under ${top}/`,
      marker: null,
      packages,
    };
  }
  return {
    isMonorepo: false,
    source: 'none',
    evidence: packages.length === 1
      ? `no: 1 package under ${packages[0].dir.split('/')[0]}/ (needs ${MIN_LAYOUT_PACKAGES})`
      : 'no: no workspace marker and no sibling packages',
    marker: null,
    packages,
  };
}

module.exports = {
  detectMonorepo,
  workspaceMarker,
  layoutPackages,
  MARKERS,
  MONO_ROOTS,
  PKG_MANIFESTS,
  MIN_LAYOUT_PACKAGES,
};
