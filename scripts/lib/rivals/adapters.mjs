#!/usr/bin/env node
'use strict';

/**
 * adapters.mjs — one retrieval question put to a rival through ITS OWN documented command line, and the
 * answer turned into the same thing SigMap's ranker returns: an ordered list of repository-relative files (#972).
 *
 * Both rivals answer in nodes (functions, classes, methods) or snippets, not files. The mapping is the
 * same for both and is stated in the report: a result counts as its file, files keep the order of their
 * first result, a path is made relative to the repository. Every ambiguity is resolved in the rival's
 * favour (see head-to-head.mjs).
 *
 * Every rival runs with a scratch HOME and a minimal environment, so nothing of the user's agent setup
 * is read and nothing is written outside the scratch directory and the throwaway copy it indexes.
 *
 * Zero-dependency; the process runner is injectable so the tests run against a stand-in.
 */

import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { terms } from '../grep-baseline.mjs';

/** A rival that hangs must not hang the run: indexing gets half an hour, one query three minutes. */
const INDEX_TIMEOUT_MS = 30 * 60 * 1000;
const QUERY_TIMEOUT_MS = 3 * 60 * 1000;

/** Tokens, estimated as everywhere else in SigMap: characters / 4. */
export const tokensOf = (text) => Math.ceil(String(text).length / 4);

/** An environment a rival can run in: scratch HOME, nothing inherited from the user's tool configuration. */
export function scratchEnv(home, extra = {}) {
  fs.mkdirSync(home, { recursive: true });
  return Object.assign({ PATH: process.env.PATH || '/usr/bin:/bin', HOME: home, LANG: 'C.UTF-8', TMPDIR: process.env.TMPDIR || '/tmp' }, extra);
}

/**
 * Make a path the rival printed repository-relative with forward slashes. Returns null for a path that is
 * not inside the repository (it can never match an expected file).
 */
export function relativeTo(repoDir, p) {
  if (typeof p !== 'string' || !p) return null;
  let s = p.replace(/\\/g, '/');
  if (!path.isAbsolute(s)) return s.replace(/^\.\//, '');
  const roots = new Set([repoDir]);
  try { roots.add(fs.realpathSync(repoDir)); } catch (_) { /* gone */ }
  for (const r of roots) {
    const root = r.replace(/\\/g, '/').replace(/\/+$/, '') + '/';
    if (s.startsWith(root)) return s.slice(root.length);
  }
  return null;
}

/** Files in order of first appearance, repository-relative, no repeats. */
export function dedupeFiles(paths, repoDir) {
  const seen = new Set();
  const out = [];
  for (const p of paths) {
    const rel = relativeTo(repoDir, p);
    if (rel && !seen.has(rel)) { seen.add(rel); out.push(rel); }
  }
  return out;
}

function parseJson(text, what) {
  try { return JSON.parse(text); } catch (e) {
    const err = new Error(`${what}: output is not JSON (${String(text).slice(0, 120).replace(/\s+/g, ' ')})`);
    err.cause = e;
    throw err;
  }
}

function dirBytes(dir) {
  let n = 0;
  const walk = (d) => {
    let es;
    try { es = fs.readdirSync(d, { withFileTypes: true }); } catch (_) { return; }
    for (const e of es) {
      const f = path.join(d, e.name);
      if (e.isDirectory()) walk(f); else if (e.isFile()) { try { n += fs.statSync(f).size; } catch (_) { /* gone */ } }
    }
  };
  walk(dir);
  return n;
}

/**
 * codebase-memory-mcp: `cli index_repository`, then `cli search_graph`. Three arms of its documented search:
 * `--query` (BM25 full-text over the graph), `--semantic-query` given the whole question, and `--semantic-query`
 * given the question's significant words as separate entries (how an agent calls it: a list of terms).
 * Indexing is its default mode (full: all files plus semantic).
 */
export function cbmAdapter({ bin, home, run = spawnSync, nodes = 60 }) {
  const env = scratchEnv(home, { CBM_CACHE_DIR: path.join(home, 'cache') });
  const cli = (args, timeout = QUERY_TIMEOUT_MS) => {
    const r = run(bin, ['cli', '--quiet', ...args], { env, encoding: 'utf8', maxBuffer: 1 << 28, timeout });
    if (r.error && r.error.code === 'ETIMEDOUT') throw new Error(`codebase-memory-mcp ${args[0]} timed out after ${timeout / 1000}s`);
    if (r.status !== 0) throw new Error(`codebase-memory-mcp ${args[0]} exited ${r.status}: ${String(r.stderr || r.stdout).slice(0, 200)}`);
    return String(r.stdout);
  };
  let project = null;
  return {
    id: 'codebase-memory-mcp',
    arms: ['bm25', 'semantic', 'semantic-kw'],
    index(dir) {
      const t0 = Date.now();
      const out = parseJson(cli(['index_repository', '--repo-path', dir], INDEX_TIMEOUT_MS), 'index_repository');
      project = out.project;
      if (!project) throw new Error('index_repository returned no project name');
      return { ms: Date.now() - t0, bytes: dirBytes(path.join(home, 'cache')), project };
    },
    /** Does the graph hold any node of this file? (How "unsupported" is decided.) */
    hasFile(dir, rel) {
      const out = parseJson(cli(['search_graph', '--project', project, '--file-pattern', rel, '--limit', '1', '--format', 'json']), 'search_graph');
      return Array.isArray(out.groups) ? out.groups.some((g) => g.file === rel && (g.rows || []).length > 0) : Number(out.total) > 0;
    },
    query(dir, arm, question) {
      const args = ['search_graph', '--project', project, '--format', 'json'];
      if (arm === 'bm25') args.push('--query', question, '--limit', String(nodes));
      else if (arm === 'semantic') args.push('--semantic-query', JSON.stringify([question]), '--semantic-limit', String(nodes));
      else if (arm === 'semantic-kw') args.push('--semantic-query', JSON.stringify(terms(question)), '--semantic-limit', String(nodes));
      else throw new Error(`codebase-memory-mcp has no arm "${arm}"`);
      const raw = cli(args);
      const out = parseJson(raw, 'search_graph');
      const table = arm === 'bm25' ? out : (out.semantic || {});
      const cols = table.cols || [];
      const fi = cols.indexOf('file');
      const rows = table.rows || [];
      return { files: fi < 0 ? [] : dedupeFiles(rows.map((r) => r[fi]), dir), tokens: tokensOf(raw), results: rows.length };
    },
    /** Free the disk a big repository's graph took. */
    forget() { fs.rmSync(path.join(home, 'cache'), { recursive: true, force: true }); project = null; },
  };
}

/**
 * code-review-graph: `build` in the repository, then `search "<query>"` (JSON). Its graph lives in
 * `.code-review-graph/` inside the (throwaway) copy. With no embedding extra installed its search mode is
 * FTS (the report records the mode the tool says it used).
 */
export function crgAdapter({ bin, home, run = spawnSync, limit = 60 }) {
  const env = scratchEnv(home);
  const cli = (dir, args, timeout = QUERY_TIMEOUT_MS) => {
    const r = run(bin, args, { cwd: dir, env, encoding: 'utf8', maxBuffer: 1 << 28, timeout });
    if (r.error && r.error.code === 'ETIMEDOUT') throw new Error(`code-review-graph ${args[0]} timed out after ${timeout / 1000}s`);
    if (r.status !== 0) throw new Error(`code-review-graph ${args[0]} exited ${r.status}: ${String(r.stderr || r.stdout).slice(0, 200)}`);
    return String(r.stdout);
  };
  return {
    id: 'code-review-graph',
    arms: ['search'],
    index(dir) {
      const t0 = Date.now();
      cli(dir, ['build'], INDEX_TIMEOUT_MS);
      return { ms: Date.now() - t0, bytes: dirBytes(path.join(dir, '.code-review-graph')) };
    },
    hasFile(dir, rel) {
      const out = parseJson(cli(dir, ['search', rel, '--kind', 'File', '--limit', '5']), 'search');
      return (out.results || []).some((r) => relativeTo(dir, r.file_path) === rel);
    },
    query(dir, arm, question) {
      if (arm !== 'search') throw new Error(`code-review-graph has no arm "${arm}"`);
      const raw = cli(dir, ['search', question, '--limit', String(limit)]);
      const out = parseJson(raw, 'search');
      return { files: dedupeFiles((out.results || []).map((r) => r.file_path), dir), tokens: tokensOf(raw), results: (out.results || []).length, mode: out.search_mode || null };
    },
    forget() { /* the graph is inside the throwaway copy */ },
  };
}
