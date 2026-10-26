'use strict';

/**
 * Reference for the imports of Vue, Svelte and Astro components (#980): each framework's own
 * parser finds the script, TypeScript's own scanner finds the specifiers in it, and
 * TypeScript's own module resolution turns each into a file.
 *
 *   Vue     @vue/compiler-sfc `parse`: `script` and `scriptSetup`
 *   Svelte  svelte/compiler `parse`: the instance and module scripts
 *   Astro   @astrojs/compiler `parse`: the frontmatter and the `<script>` elements
 *
 * `ts.preProcessFile` lists the static imports, `export ... from`, `require()` and dynamic
 * `import()` of the script, and `ts.resolveModuleName` applies the repository's own
 * `tsconfig.json` (`baseUrl`, `paths`) with the bundler resolution rules. TypeScript does not
 * know a component file is a module, so the host it is given answers `X.vue.ts` as existing
 * when `X.vue` does: the real algorithm resolves the specifier, and the answer is mapped back.
 *
 * What it does not read is a bundler's own alias table (`vite.config` `resolve.alias`), a
 * SvelteKit `$lib`, and Astro virtual modules: those are the graph's to get right or not, and
 * a miss against this reference is counted as one.
 *
 * Dev-only. Nothing here ships in the npm package.
 */

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

export const GROUP = 'sfc';
const SFC_EXT = /\.(vue|svelte|astro)$/i;

/** The script source(s) of one component, from the framework's own parser. */
async function scriptsOf(ext, source, filename, tools) {
  if (ext === '.vue') {
    const { descriptor } = tools.vue.parse(source, { filename });
    return [descriptor.script, descriptor.scriptSetup].filter(Boolean).map((s) => s.content);
  }
  if (ext === '.svelte') {
    const ast = tools.svelte.parse(source, { modern: true });
    const out = [];
    for (const s of [ast.module, ast.instance]) if (s && s.content) out.push(source.slice(s.content.start, s.content.end));
    return out;
  }
  const { ast } = await tools.astro.parse(source);
  const out = [];
  const walk = (n) => {
    if (n.type === 'frontmatter') out.push(n.value || '');
    else if (n.type === 'element' && n.name === 'script') out.push((n.children || []).map((c) => c.value || '').join(''));
    for (const c of n.children || []) walk(c);
  };
  walk(ast);
  return out;
}

const JS_NAMED = new Set(['.js', '.jsx', '.mjs', '.cjs']);
const TS_FILE = new Set(['.ts', '.tsx', '.mts', '.cts']);

/**
 * How an import is written, for the report's account of why an edge was missed. Diagnostic
 * only: it is the third element of an edge and no figure depends on it.
 */
export function kindOf(spec, to) {
  if (spec.startsWith('#')) return 'a "#name" import of the package.json imports map';
  if (!spec.startsWith('.') && !spec.startsWith('/')) return 'a bare specifier that resolves inside the repository';
  if (/\.json$/.test(to)) return 'a JSON module';
  if (JS_NAMED.has(path.extname(spec)) && TS_FILE.has(path.extname(to))) return 'written .js/.jsx, the file is .ts/.tsx';
  if (/\.d\.ts$/.test(to)) return 'a relative path that resolves to a .d.ts';
  return 'a relative path';
}

/** The repository's own compiler options for module resolution. */
function compilerOptions(ts, tree) {
  const base = { moduleResolution: ts.ModuleResolutionKind.Bundler, module: ts.ModuleKind.ESNext, allowJs: true, resolveJsonModule: true, noEmit: true };
  for (const name of ['tsconfig.json', 'jsconfig.json']) {
    const file = path.join(tree, name);
    if (!fs.existsSync(file)) continue;
    const read = ts.readConfigFile(file, ts.sys.readFile);
    if (read.error) continue;
    const parsed = ts.parseJsonConfigFileContent(read.config, ts.sys, tree, undefined, file);
    return { ...base, ...parsed.options, moduleResolution: ts.ModuleResolutionKind.Bundler, module: ts.ModuleKind.ESNext, noEmit: true };
  }
  return base;
}

/**
 * @param {{ tree: string, files: string[], tools: object, protocol: object }} i
 *        `files` are the repo-relative component files the graph walked
 * @returns {Promise<{ edges: Array<[string,string]>, covered: Set<string>, notes: object }>}
 */
export async function reference({ tree, files, tools }) {
  const require = createRequire(path.join(tools.dir, 'package.json'));
  const ts = require('typescript');
  const loaded = {
    vue: require('@vue/compiler-sfc'),
    svelte: require('svelte/compiler'),
    astro: await import(require.resolve('@astrojs/compiler')),
  };
  const options = compilerOptions(ts, tree);
  const treeReal = fs.realpathSync(tree);
  const host = {
    ...ts.sys,
    fileExists: (p) => (SFC_EXT.test(p.slice(0, -3)) && p.endsWith('.ts') && !ts.sys.fileExists(p) ? ts.sys.fileExists(p.slice(0, -3)) : ts.sys.fileExists(p)),
    realpath: (p) => (ts.sys.realpath ? ts.sys.realpath(p) : p),
  };

  const edges = new Map();
  const covered = new Set();
  const failed = [];
  for (const rel of files) {
    const abs = path.join(tree, rel);
    const ext = path.extname(rel).toLowerCase();
    let scripts;
    try { scripts = await scriptsOf(ext, fs.readFileSync(abs, 'utf8'), abs, loaded); } catch (e) { failed.push([rel, String(e.message).slice(0, 80)]); continue; }
    covered.add(rel);
    for (const text of scripts) {
      for (const imp of ts.preProcessFile(text, true, true).importedFiles) {
        const r = ts.resolveModuleName(imp.fileName, abs, options, host);
        let target = r.resolvedModule && r.resolvedModule.resolvedFileName;
        if (!target) continue;
        if (SFC_EXT.test(target.slice(0, -3)) && target.endsWith('.ts') && !fs.existsSync(target)) target = target.slice(0, -3);
        let real;
        try { real = fs.realpathSync(target); } catch (_) { continue; }
        const inTree = path.relative(treeReal, real);
        if (!inTree || inTree.startsWith('..') || path.isAbsolute(inTree) || inTree.split(path.sep).includes('node_modules')) continue;
        const to = inTree.replace(/\\/g, '/');
        if (to !== rel) edges.set(`${rel}\u0000${to}`, [rel, to, kindOf(imp.fileName, to)]);
      }
    }
  }
  return { edges: [...edges.values()], covered, notes: { failed: failed.length, failedSample: failed.slice(0, 5) } };
}
