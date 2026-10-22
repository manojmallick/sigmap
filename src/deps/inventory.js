'use strict';

/**
 * Dependency inventory (#2a, v8.50).
 *
 * WHY THIS EXISTS
 * ---------------
 * `src/map/config-manifest.js` detected manifests but extracted nothing from
 * most of them: `pom.xml (maven) | present`, `requirements.txt (python) |
 * present`. The word "present" is not grounding. Meanwhile
 * `src/verify/lib-index.js` resolved real `name@version` pins — but only for
 * JS and Python, and only from what is installed on disk.
 *
 * This module reads DECLARED dependencies out of the manifests themselves, so
 * it works on a repo that has never been installed, in every ecosystem SigMap
 * claims to support. A model that knows `express@5.1.0` stops writing Express
 * 4 API; that is the whole point.
 *
 * Pure, zero-dependency, deterministic: no network, no clock, no child
 * processes. Rows are sorted and capped, and every cap is disclosed.
 */

const fs = require('fs');
const path = require('path');
const dirListing = require('../util/dir-listing');

const MAX_DEPS_PER_MANIFEST = 400;

// ---------------------------------------------------------------------------
// Small readers
// ---------------------------------------------------------------------------

function readText(p) { try { return fs.readFileSync(p, 'utf8'); } catch (_) { return null; } }
function readJson(p) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (_) { return null; } }
function exists(p) { try { return fs.existsSync(p); } catch (_) { return false; } }

/** Strip XML comments so a commented-out <dependency> is never counted. */
function stripXmlComments(src) { return String(src).replace(/<!--[\s\S]*?-->/g, ''); }

/** Blank `#` comments outside quotes, preserving line structure. */
function stripHashComments(src) {
  return String(src).split('\n').map((line) => {
    let quote = null;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (quote) { if (c === quote) quote = null; continue; }
      if (c === '"' || c === "'") { quote = c; continue; }
      if (c === '#') return line.slice(0, i);
    }
    return line;
  }).join('\n');
}

/**
 * Split a TOML document into `[table]` sections.
 *
 * Deliberately NOT a regex with a section lookahead: JavaScript has no `\Z`
 * anchor, so the obvious `(?=^\[|\Z)` silently fails to terminate the LAST
 * table in a file — which is exactly where `[dependencies.reqwest]` and
 * `[libraries]` tend to live.
 *
 * @param {string} src
 * @returns {Array<{name:string, body:string}>}
 */
function tomlTables(src) {
  const out = [];
  let current = null;
  for (const line of stripHashComments(String(src)).split('\n')) {
    const m = /^\s*\[\[?([^\]]+?)\]\]?\s*$/.exec(line);
    if (m) {
      current = { name: m[1].trim(), lines: [] };
      out.push(current);
      continue;
    }
    if (current) current.lines.push(line);
  }
  return out.map((t) => ({ name: t.name, body: t.lines.join('\n') }));
}

/** Body of the first table with this exact name, or '' when absent. */
function tomlTable(tables, name) {
  const hit = tables.find((t) => t.name === name);
  return hit ? hit.body : '';
}

/**
 * Quoted strings in a TOML array, matched by the OUTER quote style only.
 *
 * A naive `/["']([^"']+)["']/g` sweep splits
 * `"brotli; platform_python_implementation == 'CPython'"` at the inner single
 * quotes and reports `CPython` as a package — a phantom component that would
 * reach a vulnerability scanner as a real one.
 *
 * @param {string} body
 * @returns {string[]}
 */
function tomlStrings(body) {
  const src = String(body || '');
  const dq = [...src.matchAll(/"([^"]*)"/g)].map((m) => m[1]);
  if (dq.length) return dq.filter(Boolean);
  return [...src.matchAll(/'([^']*)'/g)].map((m) => m[1]).filter(Boolean);
}

/** `key = "value"` lookup inside a table body. */
function tomlValue(body, key) {
  const m = new RegExp(`^\\s*${key}\\s*=\\s*["']([^"']+)["']`, 'm').exec(body || '');
  return m ? m[1] : null;
}

/**
 * True for a constraint on the runtime/toolchain rather than on a package.
 * These have no registry entry, so they can never carry a purl.
 */
function isPlatformRequirement(ecosystem, name) {
  const n = String(name).toLowerCase();
  if (ecosystem === 'composer') {
    return n === 'php' || n.startsWith('php-') || n.startsWith('ext-')
      || n === 'hhvm' || n.startsWith('composer-');
  }
  if (ecosystem === 'pub') return n === 'sdk' || n === 'flutter';
  return false;
}

function dep(ecosystem, name, version, scope, file) {
  return { ecosystem, name: String(name).trim(), version: version ? String(version).trim() : '', scope, file };
}

// ---------------------------------------------------------------------------
// npm / package.json
// ---------------------------------------------------------------------------

const NPM_SCOPES = [
  ['dependencies', 'runtime'],
  ['devDependencies', 'dev'],
  ['peerDependencies', 'peer'],
  ['optionalDependencies', 'optional'],
];

function npmDeps(cwd, rel, out) {
  const pkg = readJson(path.join(cwd, rel));
  if (!pkg) return null;
  for (const [key, scope] of NPM_SCOPES) {
    const block = pkg[key];
    if (!block || typeof block !== 'object') continue;
    for (const [name, version] of Object.entries(block)) {
      out.push(dep('npm', name, version, scope, rel));
    }
  }
  return { name: pkg.name || null, version: pkg.version || null };
}

/**
 * Exact installed versions from package-lock.json — the version the code
 * actually runs against, which a `^5.1.0` range does not tell you.
 * @returns {Map<string,string>} bare package name → resolved version
 */
function npmLockVersions(cwd) {
  const out = new Map();
  const lock = readJson(path.join(cwd, 'package-lock.json'));
  if (!lock) return out;
  // lockfileVersion 2/3: `packages` keyed by "node_modules/<name>".
  if (lock.packages && typeof lock.packages === 'object') {
    for (const [key, meta] of Object.entries(lock.packages)) {
      if (!key || !meta || !meta.version) continue;
      const m = /(?:^|\/)node_modules\/(.+)$/.exec(key);
      if (!m) continue;
      if (!out.has(m[1])) out.set(m[1], meta.version);
    }
  }
  // lockfileVersion 1: flat `dependencies` map.
  if (out.size === 0 && lock.dependencies && typeof lock.dependencies === 'object') {
    for (const [name, meta] of Object.entries(lock.dependencies)) {
      if (meta && meta.version) out.set(name, meta.version);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Python
// ---------------------------------------------------------------------------

const REQ_LINE = /^\s*([A-Za-z0-9._-]+)\s*(\[[^\]]*\])?\s*((?:[<>=!~^]=?|===)\s*[^;,\s]+(?:\s*,\s*(?:[<>=!~^]=?|===)\s*[^;,\s]+)*)?/;

function requirementsDeps(cwd, rel, out) {
  const src = readText(path.join(cwd, rel));
  if (src == null) return false;
  for (const raw of stripHashComments(src).split('\n')) {
    const line = raw.trim();
    // Skip blanks, pip flags (-r, -e, --index-url) and direct URLs.
    if (!line || line.startsWith('-') || /^[a-z+]+:\/\//i.test(line)) continue;
    const m = REQ_LINE.exec(line);
    if (!m || !m[1]) continue;
    out.push(dep('pypi', m[1], (m[3] || '').replace(/\s+/g, ''), 'runtime', rel));
  }
  return true;
}

/** `[project] dependencies` (PEP 621) and `[tool.poetry.dependencies]`. */
function pyprojectDeps(cwd, rel, out) {
  const src = readText(path.join(cwd, rel));
  if (src == null) return null;
  const tables = tomlTables(src);
  const project = tomlTable(tables, 'project');
  const poetryMeta = tomlTable(tables, 'tool.poetry');
  const name = tomlValue(project, 'name') || tomlValue(poetryMeta, 'name');
  const version = tomlValue(project, 'version') || tomlValue(poetryMeta, 'version');

  const pushSpec = (raw, scope) => {
    // PEP 508 environment marker: "brotli; platform_python_implementation == 'CPython'".
    // Everything after `;` is a condition, not part of the requirement.
    const spec = REQ_LINE.exec(String(raw).split(';')[0].trim());
    if (spec && spec[1]) out.push(dep('pypi', spec[1], (spec[3] || '').replace(/\s+/g, ''), scope, rel));
  };

  // PEP 621: dependencies = ["requests>=2", "flask==3.0"]
  const arr = /dependencies\s*=\s*\[([\s\S]*?)\]/.exec(project);
  if (arr) for (const q of tomlStrings(arr[1])) pushSpec(q, 'runtime');

  // PEP 621 extras: [project.optional-dependencies] with one array per extra.
  const optional = tomlTable(tables, 'project.optional-dependencies');
  if (optional) {
    for (const m of optional.matchAll(/=\s*\[([\s\S]*?)\]/g)) {
      for (const q of tomlStrings(m[1])) pushSpec(q, 'optional');
    }
  }

  // Poetry: name = "^1.2" or name = { version = "1.2", ... } per table.
  for (const t of tables) {
    if (!/^tool\.poetry\.(dev-)?dependencies$/.test(t.name)
      && !/^tool\.poetry\.group\.[^.]+\.dependencies$/.test(t.name)) continue;
    const scope = /dev-dependencies|group\.(dev|test)\./.test(t.name) ? 'dev' : 'runtime';
    for (const m of t.body.matchAll(/^\s*([A-Za-z0-9._-]+)\s*=\s*(.+)$/gm)) {
      if (m[1] === 'python') continue;
      const v = m[2].trim();
      const inline = v.startsWith('{')
        ? (v.match(/version\s*=\s*["']([^"']+)["']/) || [])[1] || ''
        : v.replace(/^["']|["']$/g, '');
      out.push(dep('pypi', m[1], inline, scope, rel));
    }
  }
  return { name, version };
}

// ---------------------------------------------------------------------------
// Maven / Gradle
// ---------------------------------------------------------------------------

/**
 * Maven coordinates, with `${property}` placeholders resolved against the
 * POM's own <properties> block — unresolved `${jackson.version}` strings are
 * exactly as useless as the "present" this replaces.
 */
function mavenDeps(cwd, rel, out) {
  const raw = readText(path.join(cwd, rel));
  if (raw == null) return null;
  const src = stripXmlComments(raw);

  const props = new Map();
  const propBlock = src.match(/<properties>([\s\S]*?)<\/properties>/);
  if (propBlock) {
    for (const m of propBlock[1].matchAll(/<([A-Za-z0-9._-]+)>([^<]*)<\/\1>/g)) props.set(m[1], m[2].trim());
  }
  const resolve = (v) => String(v || '').replace(/\$\{([^}]+)\}/g, (full, key) => (props.has(key) ? props.get(key) : full));

  // Project identity is the POM's OWN coordinates. Slicing "everything before
  // <dependencies>" took the FIRST artifactId in that span, which is the
  // <parent>'s whenever one is declared — so every Spring Boot POM reported
  // `spring-boot-starter-parent` as the project (#747). Maven's own rule is
  // that a child inherits groupId/version from its parent but never the
  // artifactId, so the parent block is read only as a fallback.
  const parentBlock = (src.match(/<parent>([\s\S]*?)<\/parent>/) || [])[1] || '';
  const withoutParent = src.replace(/<parent>[\s\S]*?<\/parent>/, '');
  const headEnd = withoutParent.search(/<dependencies>|<dependencyManagement>|<modules>|<build>/);
  const head = headEnd === -1 ? withoutParent : withoutParent.slice(0, headEnd);
  const pick = (block, tag) => ((block.match(new RegExp(`<${tag}>([^<]+)</${tag}>`)) || [])[1] || '').trim();
  const artifactId = pick(head, 'artifactId') || null;
  const version = resolve(pick(head, 'version') || pick(parentBlock, 'version')) || null;

  // <dependencyManagement> declares VERSION CONSTRAINTS, not dependencies. It
  // was being scanned as if it did, so managed-only coordinates were reported
  // as runtime dependencies and leaked into `sigmap sbom` (#747).
  const declared = src.replace(/<dependencyManagement>[\s\S]*?<\/dependencyManagement>/g, '');

  for (const block of declared.matchAll(/<dependency>([\s\S]*?)<\/dependency>/g)) {
    const body = block[1];
    const g = (body.match(/<groupId>([^<]+)<\/groupId>/) || [])[1];
    const a = (body.match(/<artifactId>([^<]+)<\/artifactId>/) || [])[1];
    if (!g || !a) continue;
    const v = resolve((body.match(/<version>([^<]+)<\/version>/) || [])[1] || '');
    const s = ((body.match(/<scope>([^<]+)<\/scope>/) || [])[1] || 'compile').trim().toLowerCase();
    // `provided`/`system` are compile-time only and are NOT shipped — the exact
    // distinction an SBOM consumer needs, and it was collapsed into `runtime`.
    // `import` is a BOM pointer rather than a dependency at all.
    if (s === 'import') continue;
    const scope = s === 'test' ? 'test' : (s === 'provided' || s === 'system') ? 'build' : 'runtime';
    out.push(dep('maven', `${g.trim()}:${a.trim()}`, v, scope, rel));
  }
  return { name: artifactId, version };
}

const GRADLE_CONFIGS = 'implementation|api|compileOnly|runtimeOnly|testImplementation|testCompileOnly|testRuntimeOnly|annotationProcessor|kapt|ksp|classpath';

/**
 * Gradle's own version variables, so `"g:a:${someVersion}"` resolves.
 *
 * Maven `${property}` placeholders were resolved from the start; Gradle's were
 * not, which left real coordinates carrying a literal `${webjarsBootstrapVersion}`
 * — the same uselessness the Maven resolution exists to prevent. Covers the
 * three forms that appear in practice: `ext.NAME = "v"`, an `ext { NAME = "v" }`
 * block, and `gradle.properties`.
 *
 * @param {string} cwd
 * @param {string} src - the build script, comments already stripped
 * @returns {Map<string,string>}
 */
function gradleVars(cwd, src) {
  const vars = new Map();

  // gradle.properties — plain key=value, and the conventional place for these.
  const props = readText(path.join(cwd, 'gradle.properties'));
  if (props) {
    for (const m of stripHashComments(props).matchAll(/^\s*([A-Za-z_][\w.-]*)\s*=\s*(.+)$/gm)) {
      vars.set(m[1], m[2].trim().replace(/^["']|["']$/g, ''));
    }
  }

  // ext.NAME = "value"  /  def NAME = "value"  /  NAME = "value" inside ext { }
  for (const m of src.matchAll(/(?:^|\n)\s*(?:ext\.|def\s+)([A-Za-z_]\w*)\s*=\s*["']([^"']+)["']/g)) {
    vars.set(m[1], m[2]);
  }
  const extBlock = /(?:^|\n)\s*ext\s*\{([\s\S]*?)\n\s*\}/.exec(src);
  if (extBlock) {
    for (const m of extBlock[1].matchAll(/^\s*([A-Za-z_]\w*)\s*=\s*["']([^"']+)["']/gm)) {
      vars.set(m[1], m[2]);
    }
  }
  return vars;
}

function gradleDeps(cwd, rel, out) {
  const src = readText(path.join(cwd, rel));
  if (src == null) return false;
  const clean = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const vars = gradleVars(cwd, clean);
  // `${name}` and the bare `$name` form Groovy also accepts.
  const resolve = (v) => String(v || '')
    .replace(/\$\{([^}]+)\}/g, (full, key) => (vars.has(key.trim()) ? vars.get(key.trim()) : full))
    .replace(/\$([A-Za-z_]\w*)/g, (full, key) => (vars.has(key) ? vars.get(key) : full));

  const re = new RegExp(`\\b(${GRADLE_CONFIGS})\\s*[( ]\\s*["']([^"']+)["']`, 'g');
  for (const m of clean.matchAll(re)) {
    const scope = /^test/.test(m[1]) ? 'test' : 'runtime';
    const parts = m[2].split(':');
    if (parts.length >= 2) {
      out.push(dep('maven', `${parts[0]}:${parts[1]}`, resolve(parts[2] || ''), scope, rel));
    }
  }
  return true;
}

/** Gradle version catalog: [libraries] entries in gradle/libs.versions.toml. */
function versionCatalogDeps(cwd, rel, out) {
  const src = readText(path.join(cwd, rel));
  if (src == null) return false;
  const tables = tomlTables(src);

  const versions = new Map();
  for (const m of tomlTable(tables, 'versions').matchAll(/^\s*([A-Za-z0-9._-]+)\s*=\s*["']([^"']+)["']/gm)) {
    versions.set(m[1], m[2]);
  }

  for (const m of tomlTable(tables, 'libraries').matchAll(/^\s*([A-Za-z0-9._-]+)\s*=\s*(.+)$/gm)) {
    const body = m[2];
    let coord = (body.match(/module\s*=\s*["']([^"']+)["']/) || [])[1];
    if (!coord) {
      const g = (body.match(/group\s*=\s*["']([^"']+)["']/) || [])[1];
      const a = (body.match(/\bname\s*=\s*["']([^"']+)["']/) || [])[1];
      if (g && a) coord = `${g}:${a}`;
    }
    if (!coord) {
      const plain = /^\s*["']([^"':]+:[^"':]+)(?::([^"']+))?["']\s*$/.exec(body);
      if (plain) coord = plain[1];
    }
    if (!coord) continue;
    const ref = (body.match(/version\.ref\s*=\s*["']([^"']+)["']/) || [])[1];
    const lit = (body.match(/\bversion\s*=\s*["']([^"']+)["']/) || [])[1];
    out.push(dep('maven', coord, ref ? (versions.get(ref) || '') : (lit || ''), 'runtime', rel));
  }
  return true;
}

// ---------------------------------------------------------------------------
// Go / Rust / Ruby / PHP / .NET / Dart
// ---------------------------------------------------------------------------

function goDeps(cwd, rel, out) {
  const src = readText(path.join(cwd, rel));
  if (src == null) return null;
  const clean = src.replace(/^\s*\/\/.*$/gm, '');
  const moduleName = (clean.match(/^module\s+(\S+)/m) || [])[1] || null;
  const goVersion = (clean.match(/^go\s+(\S+)/m) || [])[1] || null;

  for (const block of clean.matchAll(/^require\s*\(([\s\S]*?)^\)/gm)) {
    for (const line of block[1].split('\n')) {
      const m = /^\s*(\S+)\s+(v\S+)/.exec(line);
      if (m) out.push(dep('go', m[1], m[2], /\/\/\s*indirect/.test(line) ? 'indirect' : 'runtime', rel));
    }
  }
  for (const m of clean.matchAll(/^require\s+(\S+)\s+(v\S+)/gm)) {
    out.push(dep('go', m[1], m[2], 'runtime', rel));
  }
  return { name: moduleName, version: goVersion ? `go ${goVersion}` : null };
}

function cargoDeps(cwd, rel, out) {
  const src = readText(path.join(cwd, rel));
  if (src == null) return null;
  const tables = tomlTables(src);
  const pkg = tomlTable(tables, 'package');

  const SCOPES = { dependencies: 'runtime', 'dev-dependencies': 'dev', 'build-dependencies': 'build' };
  for (const t of tables) {
    // Flat table: [dependencies] with one key per crate.
    if (SCOPES[t.name]) {
      for (const m of t.body.matchAll(/^\s*([A-Za-z0-9._-]+)\s*=\s*(.+)$/gm)) {
        const v = m[2].trim();
        const ver = v.startsWith('{')
          ? (v.match(/version\s*=\s*["']([^"']+)["']/) || [])[1] || ''
          : v.replace(/^["']|["']$/g, '');
        out.push(dep('cargo', m[1], ver, SCOPES[t.name], rel));
      }
      continue;
    }
    // Sub-table: [dependencies.reqwest] — the form the old regex could not
    // terminate when it was the last table in the file.
    const sub = /^(dependencies|dev-dependencies|build-dependencies)\.(.+)$/.exec(t.name);
    if (sub) out.push(dep('cargo', sub[2], tomlValue(t.body, 'version') || '', SCOPES[sub[1]], rel));
  }
  return { name: tomlValue(pkg, 'name'), version: tomlValue(pkg, 'version') };
}

function gemfileDeps(cwd, rel, out) {
  const src = readText(path.join(cwd, rel));
  if (src == null) return false;
  const clean = stripHashComments(src);
  let group = 'runtime';
  for (const line of clean.split('\n')) {
    const g = /^\s*group\s+([^d]*?)\s*do/.exec(line);
    if (g) group = /test|development/.test(g[1]) ? 'dev' : 'runtime';
    if (/^\s*end\s*$/.test(line)) group = 'runtime';
    const m = /^\s*gem\s+["']([^"']+)["']\s*(?:,\s*["']([^"']+)["'])?/.exec(line);
    if (m) out.push(dep('rubygems', m[1], m[2] || '', group, rel));
  }
  return true;
}

function composerDeps(cwd, rel, out) {
  const json = readJson(path.join(cwd, rel));
  if (!json) return null;
  for (const [key, scope] of [['require', 'runtime'], ['require-dev', 'dev']]) {
    const block = json[key];
    if (!block || typeof block !== 'object') continue;
    for (const [name, version] of Object.entries(block)) {
      const row = dep('composer', name, version, scope, rel);
      // `php`, `ext-mbstring`, `composer-runtime-api` are platform constraints,
      // not packages: they have no registry entry and no purl. Kept in the
      // inventory (the PHP version bound is useful grounding) but flagged so
      // the SBOM does not emit them as library components.
      if (isPlatformRequirement('composer', name)) row.platform = true;
      out.push(row);
    }
  }
  return { name: json.name || null, version: json.version || null };
}

function csprojDeps(cwd, rel, out) {
  const raw = readText(path.join(cwd, rel));
  if (raw == null) return false;
  const src = stripXmlComments(raw);
  for (const m of src.matchAll(/<PackageReference\s+([^>]*?)\/?>/g)) {
    const attrs = m[1];
    const name = (attrs.match(/Include\s*=\s*"([^"]+)"/) || [])[1];
    if (!name) continue;
    out.push(dep('nuget', name, (attrs.match(/Version\s*=\s*"([^"]+)"/) || [])[1] || '', 'runtime', rel));
  }
  return true;
}

function pubspecDeps(cwd, rel, out) {
  const src = readText(path.join(cwd, rel));
  if (src == null) return null;
  const clean = stripHashComments(src);
  const name = (clean.match(/^name:\s*(\S+)/m) || [])[1] || null;
  const version = (clean.match(/^version:\s*(\S+)/m) || [])[1] || null;

  // Walked line by line: a regex block match cannot reliably terminate the
  // final section of the file, and dev_dependencies is usually last.
  let scope = null;
  for (const line of clean.split('\n')) {
    const section = /^(dev_dependencies|dependencies|dependency_overrides):\s*$/.exec(line);
    if (section) { scope = section[1] === 'dependencies' ? 'runtime' : 'dev'; continue; }
    if (/^\S/.test(line)) { scope = null; continue; }
    if (!scope) continue;
    const m = /^\s{2}([A-Za-z0-9._-]+):\s*(.*)$/.exec(line);
    if (!m || m[1] === 'sdk' || m[1] === 'flutter') continue;
    out.push(dep('pub', m[1], m[2].trim().replace(/^["']|["']$/g, ''), scope, rel));
  }
  return { name, version };
}

// ---------------------------------------------------------------------------
// Aggregation
// ---------------------------------------------------------------------------

/**
 * Every manifest this module knows how to read, in a stable order.
 * `parse` pushes dep rows and may return `{ name, version }` project identity.
 */
const MANIFESTS = [
  { file: 'package.json', ecosystem: 'npm', label: 'npm', parse: npmDeps },
  { file: 'requirements.txt', ecosystem: 'pypi', label: 'python', parse: requirementsDeps },
  { file: 'pyproject.toml', ecosystem: 'pypi', label: 'python', parse: pyprojectDeps },
  { file: 'pom.xml', ecosystem: 'maven', label: 'maven', parse: mavenDeps },
  { file: 'build.gradle', ecosystem: 'maven', label: 'gradle', parse: gradleDeps },
  { file: 'build.gradle.kts', ecosystem: 'maven', label: 'gradle', parse: gradleDeps },
  { file: 'gradle/libs.versions.toml', ecosystem: 'maven', label: 'gradle catalog', parse: versionCatalogDeps },
  { file: 'go.mod', ecosystem: 'go', label: 'go', parse: goDeps },
  { file: 'Cargo.toml', ecosystem: 'cargo', label: 'rust', parse: cargoDeps },
  { file: 'Gemfile', ecosystem: 'rubygems', label: 'ruby', parse: gemfileDeps },
  { file: 'composer.json', ecosystem: 'composer', label: 'php', parse: composerDeps },
  { file: 'pubspec.yaml', ecosystem: 'pub', label: 'dart', parse: pubspecDeps },
];

/** Locate a single `*.csproj` at the repo root, if one exists. */
function findCsproj(cwd) {
  try {
    return fs.readdirSync(cwd).filter((f) => f.endsWith('.csproj')).sort()[0] || null;
  } catch (_) { return null; }
}

/**
 * Read every manifest at the repo root into a flat dependency inventory.
 *
 * @param {string} cwd - project root
 * @param {object} [opts]
 * @param {boolean} [opts.resolve=true] - fold exact package-lock versions in
 * @returns {{
 *   deps: Array<{ecosystem:string,name:string,version:string,resolved?:string,scope:string,file:string}>,
 *   manifests: Array<{file:string,label:string,ecosystem:string,name:string|null,version:string|null,count:number}>,
 *   ecosystems: string[],
 *   truncated: number
 * }}
 */

/** Directories a manifest walk must never descend into. */
const MANIFEST_SKIP_DIRS = new Set([
  'node_modules', 'target', 'build', 'dist', 'out', 'vendor', '.git', '.svn',
  '.hg', '.venv', 'venv', '__pycache__', '.gradle', '.idea', '.vscode',
  'coverage', '.next', '.nuxt', '.context', 'bin', 'obj',
  // Fixture trees hold manifests that describe a TEST CASE, not this project's
  // dependencies — sigmap's own `test/fixtures/pom.xml` was being reported as a
  // spring-petclinic dependency set.
  'fixtures', '__fixtures__', 'testdata', 'test-fixtures', '__snapshots__',
]);

/** How deep the manifest walk descends, and how many manifests it will take. */
const MANIFEST_MAX_DEPTH = 4;
const MANIFEST_MAX_FILES = 200;


/**
 * Directory names the project itself excludes, read straight from its config
 * and `.contextignore`.
 *
 * Without this the walk descends into whatever the repo has deliberately kept
 * out of context — sigmap's own `benchmarks/repos/` holds 43 CLONED THIRD-PARTY
 * REPOS, and every one of their manifests was being reported as a dependency of
 * sigmap. Read directly rather than threaded through six call sites, so `deps`,
 * `sbom` and the project map all honour it.
 *
 * @param {string} cwd
 * @returns {string[]} bare directory names
 */
function projectExcludes(cwd) {
  const names = [];
  const cfg = readJson(path.join(cwd, 'gen-context.config.json'));
  if (cfg && Array.isArray(cfg.exclude)) {
    for (const e of cfg.exclude) if (typeof e === 'string') names.push(e.replace(/\/+$/, ''));
  }
  const ignore = readText(path.join(cwd, '.contextignore'));
  if (ignore) {
    for (const raw of ignore.split('\n')) {
      const line = raw.trim();
      // Only plain directory entries — globs stay the file walker's business.
      if (!line || line.startsWith('#') || line.includes('*')) continue;
      names.push(line.replace(/\/+$/, ''));
    }
  }
  return names.filter(Boolean);
}

/**
 * Every manifest in the tree, not just the ones at the repo root (#747).
 *
 * Probing `cwd/<manifest>` reported NOTHING for a multi-module Maven build —
 * the normal shape for Java — because the aggregator POM at the root declares
 * `<modules>` and no `<dependencies>`, while every real dependency lives in
 * `service-<name>/pom.xml`. The same blind spot hid a nested `backend/requirements.txt`
 * and any nested `package.json` workspace.
 *
 * Bounded by depth and count so a deep monorepo cannot blow up a run, and the
 * root is always visited first so its manifests sort ahead of nested ones.
 *
 * @param {string} cwd
 * @param {object} [opts]
 * @param {string[]} [opts.exclude] extra directory names to skip
 * @returns {string[]} manifest paths relative to cwd, POSIX-separated
 */
function findManifests(cwd, opts = {}) {
  const wanted = new Map(MANIFESTS.map((m) => [m.file, true]));
  const skip = new Set([...MANIFEST_SKIP_DIRS, ...(opts.exclude || []), ...projectExcludes(cwd)]);
  const found = [];
  const walk = (dir, relDir, depth) => {
    if (found.length >= MANIFEST_MAX_FILES || depth > MANIFEST_MAX_DEPTH) return;
    let entries;
    try { entries = dirListing.list(dir); } catch (_) { return; }
    const dirs = [];
    for (const e of entries) {
      if (e.isDirectory()) {
        if (skip.has(e.name) || e.name.startsWith('.')) continue;
        dirs.push(e.name);
        continue;
      }
      if (!e.isFile()) continue;
      const rel = relDir ? `${relDir}/${e.name}` : e.name;
      // `gradle/libs.versions.toml` is the one nested-by-name manifest.
      if (wanted.has(e.name) || wanted.has(rel)) found.push(rel);
      else if (e.name.endsWith('.csproj')) found.push(rel);
    }
    // `gradle/libs.versions.toml` lives one level down by convention.
    for (const d of dirs.sort()) {
      walk(path.join(dir, d), relDir ? `${relDir}/${d}` : d, depth + 1);
    }
  };
  walk(cwd, '', 0);
  // Root manifests first, then by the order MANIFESTS declares, then by path.
  // Callers pick project identity as "the first manifest that has a name"
  // (src/deps/sbom.js), so a plain alphabetical sort silently reassigned it —
  // `composer.json`'s `vendor/app` displaced `package.json`'s `shop`. The
  // declared order is also the meaningful one: package.json before composer.json.
  const rank = new Map(MANIFESTS.map((m, i) => [m.file, i]));
  const rankOf = (f) => {
    const base = f.split('/').pop();
    const r = rank.has(f) ? rank.get(f) : rank.get(base);
    return r === undefined ? MANIFESTS.length : r;
  };
  return found.sort((a, b) => {
    const da = a.split('/').length, db = b.split('/').length;
    if (da !== db) return da - db;
    const ra = rankOf(a), rb = rankOf(b);
    if (ra !== rb) return ra - rb;
    return a < b ? -1 : a > b ? 1 : 0;
  }).slice(0, MANIFEST_MAX_FILES);
}

function collectDependencies(cwd, opts = {}) {
  const deps = [];
  const manifests = [];
  let truncated = 0;

  // Resolve each discovered path back to its parser by basename (or by the
  // `gradle/libs.versions.toml` relative form, the one manifest named by path).
  const byFile = new Map(MANIFESTS.map((m) => [m.file, m]));
  const entries = [];
  for (const rel of findManifests(cwd, opts)) {
    const base = rel.split('/').pop();
    const spec = byFile.get(rel) || byFile.get(base);
    if (spec) { entries.push({ ...spec, file: rel }); continue; }
    if (base.endsWith('.csproj')) {
      entries.push({ file: rel, ecosystem: 'nuget', label: 'dotnet', parse: csprojDeps });
    }
  }

  for (const m of entries) {
    if (!exists(path.join(cwd, m.file))) continue;
    const before = deps.length;
    let identity = null;
    try { identity = m.parse(cwd, m.file, deps); } catch (_) { identity = null; }

    // Per-manifest cap, disclosed rather than silently applied.
    const produced = deps.length - before;
    if (produced > MAX_DEPS_PER_MANIFEST) {
      truncated += produced - MAX_DEPS_PER_MANIFEST;
      deps.splice(before + MAX_DEPS_PER_MANIFEST, produced - MAX_DEPS_PER_MANIFEST);
    }

    manifests.push({
      file: m.file,
      label: m.label,
      ecosystem: m.ecosystem,
      name: identity && identity.name ? identity.name : null,
      version: identity && identity.version ? identity.version : null,
      count: Math.min(produced, MAX_DEPS_PER_MANIFEST),
    });
  }

  if (opts.resolve !== false) {
    const locked = npmLockVersions(cwd);
    if (locked.size) {
      for (const d of deps) {
        if (d.ecosystem !== 'npm') continue;
        const hit = locked.get(d.name);
        if (hit) d.resolved = hit;
      }
    }
  }

  // Deterministic order: ecosystem, then name, then scope.
  deps.sort((a, b) => (a.ecosystem < b.ecosystem ? -1 : a.ecosystem > b.ecosystem ? 1
    : a.name < b.name ? -1 : a.name > b.name ? 1
      : a.scope < b.scope ? -1 : a.scope > b.scope ? 1 : 0));

  return {
    deps,
    manifests,
    ecosystems: [...new Set(manifests.map((m) => m.ecosystem))].sort(),
    truncated,
  };
}

/**
 * `name@version` pins for direct runtime dependencies — the densest grounding
 * that fits in an always-on context header. Prefers the exact locked version
 * over a declared range, since the range is not what the code runs against.
 *
 * @param {object} inventory - result of collectDependencies
 * @param {object} [opts]
 * @param {number} [opts.limit=40]
 * @returns {{ pins: string[], total: number }}
 */
function versionPins(inventory, opts = {}) {
  const limit = Number.isInteger(opts.limit) && opts.limit >= 0 ? opts.limit : 40;
  const seen = new Set();
  const pins = [];
  for (const d of (inventory && inventory.deps) || []) {
    if (d.scope !== 'runtime' || d.platform) continue;
    const version = d.resolved || d.version;
    // `any` (Dart), `latest` and `*` are wildcards, not versions — pinning to
    // them would be a false precision.
    if (!version || !/\d/.test(version)) continue;
    // PyPI writes its own operator (`requests==2.31.0`); an interposed `@`
    // would produce `requests@==2.31.0`, which is not a real requirement
    // string. Every other ecosystem uses the `name@version` form.
    const pin = (d.ecosystem === 'pypi' && /^[=<>!~]/.test(version))
      ? `${d.name}${version}`
      : `${d.name}@${version}`;
    if (seen.has(pin)) continue;
    seen.add(pin);
    pins.push(pin);
  }
  pins.sort();
  return { pins: limit ? pins.slice(0, limit) : pins, total: pins.length };
}

module.exports = {
  findManifests,
  collectDependencies,
  isPlatformRequirement,
  versionPins,
  npmLockVersions,
  MANIFESTS,
  MAX_DEPS_PER_MANIFEST,
};
