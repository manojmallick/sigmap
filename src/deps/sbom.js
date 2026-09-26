'use strict';

/**
 * CycloneDX SBOM export (#2c', v8.50).
 *
 * WHY THIS AND NOT A CVE FEED
 * ---------------------------
 * The obvious ask is "tell me which dependencies have CVEs". SigMap should not
 * build that, for three reasons:
 *
 *   1. Determinism. Byte-reproducible output is the differentiator. A
 *      network-sourced vulnerability section makes two runs on the same commit
 *      disagree, which contaminates the reproducibility claim for the WHOLE
 *      artifact, not just that section.
 *   2. Liability. A stale or wrong CVE claim is worse than no claim, and it
 *      would mean owning a vulnerability feed forever.
 *   3. It is already solved. osv-scanner, Dependabot, Trivy and `npm audit`
 *      do this well and for free.
 *
 * So SigMap emits the one thing those tools need and cannot derive from a
 * signature map: a complete, deterministic component list. Pipe it onward:
 *
 *     sigmap sbom > sbom.json && osv-scanner --sbom sbom.json
 *
 * The user gets the CVE outcome; SigMap owns no database and no network code.
 *
 * Spec: CycloneDX 1.5. `serialNumber` and `metadata.timestamp` are optional in
 * the spec and are deliberately OMITTED — both would vary run to run and break
 * byte-stability for no analytic gain.
 */

const { collectDependencies } = require('./inventory');

const SPEC_VERSION = '1.5';
const BOM_FORMAT = 'CycloneDX';

/** SigMap ecosystem key → Package URL type (purl-spec). */
const PURL_TYPE = {
  npm: 'npm',
  pypi: 'pypi',
  maven: 'maven',
  go: 'golang',
  cargo: 'cargo',
  rubygems: 'gem',
  composer: 'composer',
  nuget: 'nuget',
  pub: 'pub',
};

/**
 * CycloneDX `scope` is a three-value enum. Anything shipped to production is
 * `required`; build/dev/test tooling is `optional`.
 */
const CDX_SCOPE = {
  runtime: 'required',
  peer: 'required',
  dev: 'optional',
  test: 'optional',
  build: 'optional',
  optional: 'optional',
  indirect: 'required',
};

/** True when a version string is an exact pin rather than a range. */
function isExactVersion(v) {
  const s = String(v || '').trim();
  // A version must carry at least one digit: `any` (Dart), `latest` and `*`
  // are wildcards, and `pkg:pub/cli_util@any` is not a scannable component.
  if (!s || !/\d/.test(s)) return false;
  return !/[\^~<>=!*|\s,]/.test(s) || /^v?\d+(\.\d+)*([-+][\w.]+)*$/.test(s);
}

/**
 * Best-effort exact version for a declared range.
 *
 * A range has no single correct answer, so this takes the LOWER BOUND —
 * `^5.1.0` becomes `5.1.0`. That over-reports rather than under-reports
 * against a vulnerability database, which is the safer direction, and every
 * such component is counted and disclosed by `summarize` so the caller can say
 * so rather than implying a precision that is not there.
 *
 * @param {string} spec
 * @returns {string} normalized version, or '' when nothing usable is present
 */
function normalizeVersion(spec) {
  const s = String(spec || '').trim();
  if (!s || !/\d/.test(s)) return '';
  // The leading `v` is NOT stripped: Go module versions carry it by
  // convention (`pkg:golang/...@v1.10.0`) and no other ecosystem declares one.
  if (isExactVersion(s)) return s;
  const first = s.split(/[,|]/)[0].trim();
  const m = /(\d+(?:\.\d+)*(?:[-+][\w.]+)*)/.exec(first);
  return m ? m[1] : '';
}

/** Percent-encode a purl path segment, keeping the `/` that separates scopes. */
function purlEncode(segment) {
  return encodeURIComponent(String(segment)).replace(/%40/g, '%40');
}

/**
 * Build a Package URL for one dependency row.
 * @returns {string} purl, or '' when the ecosystem has no purl type
 */
function purlFor(d, version) {
  const type = PURL_TYPE[d.ecosystem];
  if (!type) return '';
  const ver = version ? `@${encodeURIComponent(version)}` : '';

  if (type === 'maven') {
    // Maven coordinates are `groupId:artifactId`.
    const [group, artifact] = String(d.name).split(':');
    if (!group || !artifact) return '';
    return `pkg:maven/${purlEncode(group)}/${purlEncode(artifact)}${ver}`;
  }
  if (type === 'golang') {
    // Go module paths are already slash-separated and must stay readable.
    return `pkg:golang/${String(d.name).split('/').map(purlEncode).join('/')}${ver}`;
  }
  if (type === 'npm' && String(d.name).startsWith('@')) {
    const [scope, name] = String(d.name).split('/');
    if (!name) return '';
    return `pkg:npm/${purlEncode(scope)}/${purlEncode(name)}${ver}`;
  }
  if (type === 'composer') {
    const [vendor, name] = String(d.name).split('/');
    if (!vendor || !name) return '';
    return `pkg:composer/${purlEncode(vendor)}/${purlEncode(name)}${ver}`;
  }
  return `pkg:${type}/${purlEncode(d.name)}${ver}`;
}

/**
 * Build a CycloneDX 1.5 document for a repo.
 *
 * @param {string} cwd - project root
 * @param {object} [opts]
 * @param {boolean} [opts.exactOnly=false] - drop components whose version is a
 *   range rather than a pin, for callers who would rather have a short precise
 *   BOM than a long approximate one
 * @param {boolean} [opts.includeDev=true] - include dev/test/build components
 * @returns {{ bom: object, stats: { total:number, exact:number, ranged:number, unversioned:number, skipped:number } }}
 */
function buildSbom(cwd, opts = {}) {
  const exactOnly = opts.exactOnly === true;
  const includeDev = opts.includeDev !== false;
  const inventory = collectDependencies(cwd);

  const components = [];
  const stats = { total: 0, exact: 0, ranged: 0, unversioned: 0, skipped: 0 };
  const seen = new Set();

  for (const d of inventory.deps) {
    // Platform constraints (`php`, `ext-mbstring`, Dart `sdk`) have no registry
    // entry and therefore no purl; emitting them as components gives a scanner
    // rows it can never resolve.
    if (d.platform) { stats.skipped++; continue; }
    const cdxScope = CDX_SCOPE[d.scope] || 'optional';
    if (!includeDev && cdxScope === 'optional') { stats.skipped++; continue; }

    const declared = d.resolved || d.version;
    const exact = !!d.resolved || isExactVersion(declared);
    const version = normalizeVersion(declared);

    // Count only what actually lands in the BOM, so `total` always equals
    // exact + ranged + unversioned; anything dropped is counted as skipped.
    const ranged = !exact && !!version;
    if (exactOnly && (ranged || !version)) { stats.skipped++; continue; }
    if (!version) stats.unversioned++;
    else if (exact) stats.exact++;
    else stats.ranged++;

    const purl = purlFor(d, version);
    // bom-ref must be unique; purl already is, and it keeps the doc readable.
    const ref = purl || `${d.ecosystem}:${d.name}@${version || 'unknown'}`;
    if (seen.has(ref)) continue;
    seen.add(ref);

    const component = {
      type: 'library',
      'bom-ref': ref,
      name: d.name,
      scope: cdxScope,
    };
    if (version) component.version = version;
    if (purl) component.purl = purl;

    const properties = [
      { name: 'sigmap:ecosystem', value: d.ecosystem },
      { name: 'sigmap:manifest', value: d.file },
      { name: 'sigmap:scope', value: d.scope },
    ];
    // Keep the original spec when it is not what landed in `version`, so a
    // reader can tell an inferred lower bound from a real pin.
    if (declared && declared !== version) {
      properties.push({ name: 'sigmap:versionSpec', value: declared });
    }
    if (!exact && version) {
      properties.push({ name: 'sigmap:versionInferred', value: 'lower-bound-of-range' });
    }
    component.properties = properties;

    components.push(component);
    stats.total++;
  }

  // Deterministic ordering, independent of manifest read order.
  components.sort((a, b) => (a['bom-ref'] < b['bom-ref'] ? -1 : a['bom-ref'] > b['bom-ref'] ? 1 : 0));

  // Project identity: prefer a manifest that actually names the project.
  const root = inventory.manifests.find((m) => m.name) || null;
  const metadataComponent = root
    ? { type: 'application', 'bom-ref': root.name, name: root.name, ...(root.version ? { version: root.version } : {}) }
    : { type: 'application', 'bom-ref': 'root', name: 'unknown' };

  const bom = {
    bomFormat: BOM_FORMAT,
    specVersion: SPEC_VERSION,
    version: 1,
    metadata: {
      // No `timestamp` and no `serialNumber`: both are optional in the spec and
      // both would make two runs on the same commit differ.
      tools: { components: [{ type: 'application', name: 'sigmap', publisher: 'sigmap' }] },
      component: metadataComponent,
    },
    components,
  };

  return { bom, stats };
}

/** Pretty-printed JSON rendering, stable across runs. */
function formatSbom(bom) {
  return JSON.stringify(bom, null, 2);
}

/**
 * One-line human summary for stderr, disclosing how precise the BOM is.
 * @param {object} stats - from buildSbom
 * @returns {string[]} lines
 */
function summarize(stats) {
  const lines = [`[sigmap] sbom: ${stats.total} component(s) — ${stats.exact} pinned`];
  if (stats.ranged > 0) {
    lines.push(`[sigmap]   ${stats.ranged} declared as a range; the lower bound was used —`);
    lines.push('[sigmap]   scanners may over-report on those. Commit a lockfile for exact pins.');
  }
  if (stats.unversioned > 0) {
    lines.push(`[sigmap]   ${stats.unversioned} with no version at all`);
  }
  if (stats.skipped > 0) {
    lines.push(`[sigmap]   ${stats.skipped} omitted by the current flags`);
  }
  lines.push('[sigmap]   scan it: osv-scanner --sbom <file>');
  return lines;
}

module.exports = {
  buildSbom,
  formatSbom,
  summarize,
  purlFor,
  normalizeVersion,
  isExactVersion,
  SPEC_VERSION,
  PURL_TYPE,
};
