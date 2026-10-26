#!/usr/bin/env node
// Ground truth for scripts/extraction-recall/cpp.mjs: what clangd, a language server built on clang's
// own parser and preprocessor, says each C or C++ file defines (#975).
//
//   node cpp-reference.mjs < job.json     # prints one JSON object on stdout
//
// job.json: { clangd, concurrency, cacheDir, files: [{ abs, lang, args }] }, where `args` are the
// compile arguments of that file (include directories, standard). The output is
// { version, files: { abs: [[kind, name, firstLine, lastLine, owner], ...] | null } }, `null` for a
// file clangd could not answer.
//
// WHY A CHILD PROCESS: the recall adapters are synchronous, and a session costs about a second per
// file, so this one runs the sessions in parallel and the adapter waits for it. Answers are cached
// by content, arguments and clangd version, so iterating on the extractor does not pay for the
// reference again; the cache lives where the job says (never inside a clone).
//
// WHAT CLANGD GIVES: documentSymbol, with the preprocessor and the includes applied. A symbol is
// kept by kind and by its `detail` (the others are fields, variables, enumerators, aliases and
// macros, which SigMap's extractor does not list):
//   class     Class or Struct whose detail is class, struct or union (a typedef or `using` is also a
//             Class to clangd, with the detail "type alias", and is left out)
//   enum      Enum whose detail is "enum" (an X-macro's enumerators also arrive as kind Enum, with a
//             type such as "int" as their detail, and are left out)
//   function  Function            (a prototype counts as much as a definition)
//   method    Method, Constructor, Operator   (owner = the class that holds it, or the `A` of `A::b`)
//
// Dev-only. Nothing here ships in the npm package and nothing at runtime depends on clangd.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { frame, parseFrames } = require(path.join(here, '..', '..', 'src', 'lsp', 'client.js'));

const SESSION_TIMEOUT_MS = 60000;

// LSP SymbolKind numbers
const CLASS = new Set([5, 23]);
const ENUM = new Set([10]);
const FUNCTION = new Set([12]);
const METHOD = new Set([6, 9, 25]);
// Namespaces are transparent: their members are asked about. So is the node clangd makes (kind String)
// for a macro whose expansion declares things: spdlog's `SPDLOG_NAMESPACE_BEGIN` and abseil's
// `ABSL_NAMESPACE_BEGIN` open a namespace, and everything in it is a child of that node.
const CONTAINER = new Set([3, 15]);
// Bumped when the shape of a cached answer changes (what `flatten` keeps), so a cache cannot outlive it.
const CACHE_SCHEMA = 4;

/**
 * A clangd name split into its qualifier and its own name, template arguments removed:
 * `Storage<T, N, A>::Resize` -> { qualifier: 'Storage', bare: 'Resize' }, `formatter<a::b>` -> { bare: 'formatter' }.
 * An operator keeps its symbols (`operator<=>` contains a balanced `<=>`).
 */
export function splitName(name) {
  const op = /(^|::)(operator\b.*)$/.exec(name);
  const head = op ? name.slice(0, op.index) : name;
  let plain = head;
  while (/<[^<>]*>/.test(plain)) plain = plain.replace(/<[^<>]*>/g, '');
  const parts = plain.split('::').filter((x) => x.length);
  if (op) return { qualifier: parts.pop() || '', bare: op[2] };
  const bare = parts.pop() || '';
  return { qualifier: parts.pop() || '', bare };
}

/** Flatten a documentSymbol tree into `[kind, name, first, last, owner]` rows. */
export function flatten(nodes, owner = '', out = []) {
  for (const s of nodes || []) {
    const name = String(s.name || '');
    const first = s.range.start.line + 1;
    const last = s.range.end.line + 1;
    const { qualifier, bare } = splitName(name);
    if (CONTAINER.has(s.kind)) {
      flatten(s.children, owner, out);
    } else if (CLASS.has(s.kind)) {
      const real = !s.detail || (/\b(class|struct|union)\b/.test(s.detail) && !/alias/.test(s.detail)); // `template struct` is a class too
      if (real && bare && !bare.startsWith('(')) out.push(['class', bare, first, last, owner]);
      if (real) flatten(s.children, bare, out);
    } else if (ENUM.has(s.kind)) {
      const real = !s.detail || /^(template )?enum\b/.test(s.detail);
      if (real && bare && !bare.startsWith('(')) out.push(['enum', bare, first, last, owner]);
    } else if (FUNCTION.has(s.kind)) {
      if (qualifier) {
        // an out-of-line member definition: `Foo::bar` is a method of Foo
        out.push(['method', bare, first, last, qualifier]);
      } else if (bare) {
        out.push(['function', bare, first, last, '']);
      }
    } else if (METHOD.has(s.kind)) {
      const own = qualifier || owner;
      if (bare) out.push(['method', bare, first, last, own]);
    }
  }
  return out;
}

function session(clangd, cdb, file, src) {
  return new Promise((resolve) => {
    const uri = `file://${file.abs}`;
    const input =
      frame({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {
        processId: null, rootUri: `file://${path.dirname(file.abs)}`,
        capabilities: { textDocument: { documentSymbol: { hierarchicalDocumentSymbolSupport: true } } },
      } }) +
      frame({ jsonrpc: '2.0', method: 'initialized', params: {} }) +
      frame({ jsonrpc: '2.0', method: 'textDocument/didOpen', params: { textDocument: { uri, languageId: file.lang === 'c' ? 'c' : 'cpp', version: 1, text: src } } }) +
      frame({ jsonrpc: '2.0', id: 2, method: 'textDocument/documentSymbol', params: { textDocument: { uri } } }) +
      frame({ jsonrpc: '2.0', id: 3, method: 'shutdown' }) +
      frame({ jsonrpc: '2.0', method: 'exit' });
    const child = spawn(clangd, ['--log=error', '--background-index=false', `--compile-commands-dir=${cdb}`], { stdio: ['pipe', 'pipe', 'ignore'] });
    let out = '';
    let done = false;
    const finish = (v) => { if (!done) { done = true; clearTimeout(timer); resolve(v); } };
    const timer = setTimeout(() => { child.kill('SIGKILL'); finish(null); }, SESSION_TIMEOUT_MS);
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (d) => { out += d; });
    child.on('error', () => finish(null));
    child.on('close', () => {
      const sym = parseFrames(out).find((m) => m.id === 2);
      finish(sym && Array.isArray(sym.result) ? flatten(sym.result) : null);
    });
    child.stdin.on('error', () => {});
    child.stdin.end(input);
  });
}

async function main() {
  const job = JSON.parse(fs.readFileSync(0, 'utf8'));
  const v = spawnSync(job.clangd, ['--version'], { encoding: 'utf8' });
  const version = ((v.stdout || '').match(/clangd version ([\d.]+)/) || [])[1] || null;
  if (!version) { process.stdout.write(JSON.stringify({ version: null, files: {} })); return; }

  const cdb = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-recall-cdb-'));
  const cache = job.cacheDir ? path.resolve(job.cacheDir) : null;
  if (cache) fs.mkdirSync(cache, { recursive: true });
  try {
    fs.writeFileSync(path.join(cdb, 'compile_commands.json'), JSON.stringify(job.files.map((f) => ({
      directory: path.dirname(f.abs), file: f.abs, arguments: [f.lang === 'c' ? 'clang' : 'clang++', ...f.args, f.abs],
    }))));
    const result = {};
    let next = 0;
    const worker = async () => {
      for (;;) {
        const i = next++;
        if (i >= job.files.length) return;
        const f = job.files[i];
        const src = fs.readFileSync(f.abs, 'utf8');
        const key = cache ? crypto.createHash('sha1').update(`${CACHE_SCHEMA}\n${version}\n${f.lang}\n${f.args.join(' ')}\n${f.abs}\n${src}`).digest('hex') : null;
        const hit = key && path.join(cache, `${key}.json`);
        if (hit && fs.existsSync(hit)) { result[f.abs] = JSON.parse(fs.readFileSync(hit, 'utf8')); continue; }
        const rows = await session(job.clangd, cdb, f, src);
        result[f.abs] = rows;
        if (hit && rows) fs.writeFileSync(hit, JSON.stringify(rows));
      }
    };
    await Promise.all(Array.from({ length: Math.max(1, Math.min(job.concurrency || 4, job.files.length)) }, worker));
    process.stdout.write(JSON.stringify({ version, files: result }));
  } finally {
    fs.rmSync(cdb, { recursive: true, force: true });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error(e); process.exitCode = 1; });
}
