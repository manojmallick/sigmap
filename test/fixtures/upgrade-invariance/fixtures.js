'use strict';

/**
 * The projects an existing SigMap install looks like (#1071, T2 "upgrade invariance"), and a way to read the
 * configuration SigMap ends up using for each, from ANY checkout of SigMap: `effectiveConfigs(root)`.
 *
 * Why a checkout argument: the baseline in `effective-config.v8.87.0.json` was recorded by running this file against the
 * v8.87.0 tag, and the guard test runs it against the code under test. Same fixtures, same reader, two versions of SigMap.
 *
 *   node test/fixtures/upgrade-invariance/fixtures.js <SigMap checkout>    # prints the JSON that is stored as the baseline
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

/** Config files the four kinds of existing project carry. `null` is a project with no config file at all. */
const CONFIGS = {
  'no-config': null,
  minimal: { srcDirs: ['src'] },
  'full-custom': {
    srcDirs: ['src', 'lib'],
    exclude: ['vendor', 'dist'],
    maxTokens: 4000,
    strategy: 'hot-cold',
    outputs: ['claude', 'cursor'],
    mcp: { tools: 'core' },
    codexMaxBytes: 16384,
    claudeMaxLines: 120,
  },
  // Written by SigMap before `adapters` existed, and still accepted.
  'legacy-outputs': { outputs: ['copilot', 'claude'], output: '.github/copilot-instructions.md' },
};

/** A small project on disk: two source folders and a README, so folder auto-detection has something to find. */
function build(name) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `sigmap-upgrade-${name}-`));
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'lib'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'src', 'a.js'), 'function alpha(x) { return x; }\nmodule.exports = { alpha };\n');
  fs.writeFileSync(path.join(dir, 'lib', 'b.js'), 'function beta(y) { return y; }\nmodule.exports = { beta };\n');
  fs.writeFileSync(path.join(dir, 'README.md'), '# fixture\n');
  if (CONFIGS[name] !== null) fs.writeFileSync(path.join(dir, 'gen-context.config.json'), `${JSON.stringify(CONFIGS[name], null, 2)}\n`);
  return dir;
}

/**
 * What each fixture project resolves to under the SigMap checkout at `root`: the whole effective config, and the MCP tool profile it
 * produces (the config's `mcp.tools` is only a request; the profile is what a client is told).
 * @returns {Object<string, { config: object, profile: { profile: string, names: string[] } }>}
 */
function effectiveConfigs(root) {
  const { loadConfig } = require(path.join(root, 'src', 'config', 'loader.js'));
  const { resolveProfile } = require(path.join(root, 'src', 'mcp', 'profile.js'));
  const out = {};
  for (const name of Object.keys(CONFIGS)) {
    const dir = build(name);
    // loadConfig reports deprecations on stderr; the fixtures are not about those.
    const write = process.stderr.write;
    process.stderr.write = () => true;
    let config;
    try { config = loadConfig(dir); } finally { process.stderr.write = write; }
    const r = resolveProfile(config);
    // Nothing the fixture's own location can leak into the comparison.
    out[name] = { config: JSON.parse(JSON.stringify(config).split(dir).join('<project>')), profile: { profile: r.profile, names: r.names.slice().sort() } };
  }
  return out;
}

module.exports = { CONFIGS, build, effectiveConfigs };

if (require.main === module) {
  const root = path.resolve(process.argv[2] || path.join(__dirname, '..', '..', '..'));
  process.stdout.write(`${JSON.stringify(effectiveConfigs(root), null, 1)}\n`);
}
