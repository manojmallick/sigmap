'use strict';

/**
 * CI / pipeline extractor (#3, v8.50).
 *
 * WHY THIS EXISTS
 * ---------------
 * `yaml.js` is a GENERIC key scanner. On a GitHub Actions workflow it emitted
 * four lines — `keys: [name, on, jobs]` plus one `job: <id>` per job — with no
 * triggers, no runner, no steps, no `needs`, no secrets, and no line anchors.
 * That answers none of the questions an agent actually asks of a pipeline file:
 * "what runs on a PR", "where does deploy happen", "which secrets does release
 * need", "why did publish not fire".
 *
 * This module parses the same files STRUCTURALLY and emits semantic signatures
 * with real `:start-end` anchors, so `sigmap lines` can jump straight to a job.
 *
 * Zero-dependency by constraint: no YAML library. `scanYaml` is a small
 * indentation-aware line scanner — enough for the shallow, regular shapes CI
 * formats use, and it degrades to fewer signatures rather than wrong ones.
 * Pure and deterministic: same bytes in, same bytes out, no clock, no I/O.
 */

const path = require('path');
const { capWithNotice } = require('../util/truncate');

const PER_FILE_LIMIT = 200;
const MAX_STEPS_PER_JOB = 12;
const MAX_VALUE_CHARS = 90;

// ---------------------------------------------------------------------------
// Platform routing
// ---------------------------------------------------------------------------

/**
 * Resolve a CI platform key from a file path, or null when the file is not a
 * pipeline definition. Path-based and case-insensitive on the basename.
 * @param {string} filePath
 * @returns {string|null}
 */
function platformFor(filePath) {
  const p = String(filePath || '').replace(/\\/g, '/');
  const base = path.posix.basename(p);
  const lower = base.toLowerCase();

  // Forge workflow directories: GitHub, Gitea, Forgejo all use the same schema.
  if (/(^|\/)\.(github|gitea|forgejo)\/workflows\/[^/]+\.ya?ml$/i.test(p)) return 'github';
  if (lower === 'action.yml' || lower === 'action.yaml') return 'action';
  if (/^\.?gitlab-ci\.ya?ml$/i.test(lower) || /\.gitlab-ci\.ya?ml$/i.test(lower)) return 'gitlab';
  if (/(^|\/)\.circleci\/config\.ya?ml$/i.test(p)) return 'circleci';
  if (/^\.?azure-pipelines[\w.-]*\.ya?ml$/i.test(lower)) return 'azure';
  if (lower === 'bitbucket-pipelines.yml' || lower === 'bitbucket-pipelines.yaml') return 'bitbucket';
  if (/^\.(drone|woodpecker)\.ya?ml$/i.test(lower)) return 'drone';
  if (/(^|\/)\.woodpecker\/[^/]+\.ya?ml$/i.test(p)) return 'drone';
  if (lower === 'jenkinsfile' || lower.startsWith('jenkinsfile.') || lower.endsWith('.jenkinsfile')) return 'jenkins';
  if (/^(docker-)?compose[\w.-]*\.ya?ml$/i.test(lower)) return 'compose';
  return null;
}

/**
 * Content sniff for workflow files sitting outside their conventional path.
 * Deliberately narrow — it must never claim a plain config file.
 * @param {string} src
 * @returns {string|null}
 */
function sniffPlatform(src) {
  const s = String(src || '');
  if (/^on\s*:/m.test(s) && /^jobs\s*:/m.test(s)) return 'github';
  if (/^pipelines\s*:/m.test(s) && /^\s+-?\s*step\s*:/m.test(s)) return 'bitbucket';
  if (/^services\s*:/m.test(s) && /^\s{2,}\w[\w.-]*\s*:\s*$/m.test(s) && /\b(image|build)\s*:/.test(s)) return 'compose';
  return null;
}

// ---------------------------------------------------------------------------
// Minimal YAML structure scanner
// ---------------------------------------------------------------------------

/** Strip an unquoted trailing `# comment` from a line. */
function stripInlineComment(line) {
  let quote = null;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quote) {
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'") { quote = c; continue; }
    // A comment needs whitespace before `#`, so `a#b` and `#{}` stay intact.
    if (c === '#' && (i === 0 || /\s/.test(line[i - 1]))) return line.slice(0, i).trimEnd();
  }
  return line;
}

function unquote(v) {
  const s = String(v == null ? '' : v).trim();
  if (s.length >= 2 && ((s[0] === '"' && s[s.length - 1] === '"') || (s[0] === "'" && s[s.length - 1] === "'"))) {
    return s.slice(1, -1);
  }
  return s;
}

function compact(v, limit = MAX_VALUE_CHARS) {
  const s = unquote(v).replace(/\s+/g, ' ').trim();
  return s.length > limit ? s.slice(0, limit - 1) + '…' : s;
}

/** Parse a `[a, b, c]` flow sequence, else null. */
function flowList(v) {
  const s = unquote(v);
  if (!/^\[.*\]$/.test(s)) return null;
  return s.slice(1, -1).split(',').map((x) => unquote(x)).filter(Boolean);
}

const KV_RE = /^("[^"]*"|'[^']*'|[^:]+?)\s*:(?:\s+([\s\S]*))?$/;

/**
 * Scan YAML into a flat node list. Each node is one `key:` occurrence with its
 * indentation, 1-based line number, and whether it opened a sequence item.
 *
 * Block scalars (`|`, `>`) are skipped wholesale so shell bodies never parse as
 * structure — the single most common source of bogus signatures.
 *
 * @param {string} src
 * @returns {Array<{indent:number,key:string,value:string,line:number,item:boolean}>}
 */
function scanYaml(src) {
  const lines = String(src).split('\n');
  const nodes = [];
  let blockIndent = -1;
  let blockTarget = null;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i].replace(/\t/g, '  ');
    if (!raw.trim()) continue;
    const indent = raw.length - raw.replace(/^\s*/, '').length;

    if (blockIndent >= 0) {
      if (indent > blockIndent) {
        if (blockTarget) blockTarget.block.push(raw.trim());
        continue;
      }
      blockIndent = -1;
      blockTarget = null;
    }

    let content = raw.trim();
    if (content.startsWith('#')) continue;
    content = stripInlineComment(content);
    if (!content) continue;

    let item = false;
    let itemIndent = indent;
    // `- key: value` opens an item whose mapping sits two columns further in.
    while (content.startsWith('- ') || content === '-') {
      item = true;
      itemIndent += 2;
      content = content === '-' ? '' : content.slice(2).trim();
      if (!content) break;
    }
    if (!content) {
      nodes.push({ indent: itemIndent, key: '', value: '', line: i + 1, item });
      continue;
    }

    const m = KV_RE.exec(content);
    if (!m) {
      nodes.push({ indent: itemIndent, key: '', value: content, line: i + 1, item });
      continue;
    }

    const key = unquote(m[1]);
    const value = (m[2] || '').trim();
    nodes.push({ indent: itemIndent, key, value, line: i + 1, item });

    if (/^[|>][-+]?\d*$/.test(value)) {
      blockIndent = indent;
      blockTarget = nodes[nodes.length - 1];
      blockTarget.block = [];
    }
  }
  return nodes;
}

// ---------------------------------------------------------------------------
// Node-tree helpers
// ---------------------------------------------------------------------------

/**
 * Exclusive end index of the block owned by nodes[i].
 *
 * A sequence item is the subtle case: `- name: x` followed by `run: y` puts
 * BOTH keys at the same indent, and the second one belongs to the item's
 * mapping. So for an item the scope runs until the next item marker at that
 * indent (or any shallower node), not until the next node at that indent.
 */
function scopeEnd(nodes, i) {
  const n = nodes[i];
  for (let j = i + 1; j < nodes.length; j++) {
    const m = nodes[j];
    if (m.indent < n.indent) return j;
    if (m.indent === n.indent) {
      if (n.item && !m.item) continue;
      return j;
    }
  }
  return nodes.length;
}

/** All descendants of nodes[i], including an item's sibling mapping keys. */
function childrenOf(nodes, i) {
  return nodes.slice(i + 1, scopeEnd(nodes, i));
}

/** Immediate children of nodes[i] — the shallowest descendant indent only. */
function directChildren(nodes, i) {
  const kids = childrenOf(nodes, i);
  if (kids.length === 0) return [];
  const min = Math.min(...kids.map((k) => k.indent));
  return kids.filter((k) => k.indent === min);
}

/** Find a top-level (indent 0) node by key. */
function topNode(nodes, key) {
  const i = nodes.findIndex((n) => n.indent === 0 && n.key === key);
  return i === -1 ? null : i;
}

/**
 * Value of an IMMEDIATE child key, or null.
 *
 * Job-level attributes (`runs-on`, `if`, `needs`, `environment`) must resolve
 * against direct children only: `childValue` walks all descendants, so a step
 * carrying `if:` would otherwise be reported as the job's condition.
 */
function directValue(nodes, i, key) {
  const hit = directChildren(nodes, i).find((k) => k.key === key);
  return hit ? hit.value : null;
}

/** listValues restricted to an immediate child key. */
function directListValues(nodes, i, key) {
  const hit = directChildren(nodes, i).find((k) => k.key === key);
  if (!hit) return [];
  if (hit.value) return flowList(hit.value) || [unquote(hit.value)];
  const out = [];
  for (const c of directChildren(nodes, nodes.indexOf(hit))) {
    const v = (c.item && !c.key) ? c.value : (c.item && c.key ? c.key : (!c.key ? c.value : ''));
    if (v) out.push(unquote(v));
  }
  return out.filter(Boolean);
}

/** First meaningful command inside a captured block scalar. */
function blockText(node) {
  const body = (node && node.block) || [];
  const meaningful = body.filter((l) => l && !l.startsWith('#') && !/^set\s+[-+]/.test(l));
  if (meaningful.length === 0) return '';
  const first = compact(meaningful[0]);
  const rest = meaningful.length - 1;
  return rest > 0 ? `${first} (+${rest} line${rest === 1 ? '' : 's'})` : first;
}

/** Render a step/script value that may be an inline scalar or a block scalar. */
function valueText(node) {
  if (!node) return '';
  if (/^[|>][-+]?\d*$/.test(String(node.value || '').trim())) return blockText(node);
  return compact(node.value);
}

/** First descendant with this key, or null. */
function childValue(nodes, i, key) {
  const kids = childrenOf(nodes, i);
  const hit = kids.find((k) => k.key === key);
  return hit ? hit.value : null;
}

/**
 * Values of a key that may be a scalar, a flow list, or a block sequence.
 * @returns {string[]}
 */
function listValues(nodes, i, key) {
  const kids = childrenOf(nodes, i);
  const at = kids.findIndex((k) => k.key === key);
  if (at === -1) return [];
  const node = kids[at];
  if (node.value) return flowList(node.value) || [unquote(node.value)];
  const out = [];
  const idx = nodes.indexOf(node);
  for (const c of directChildren(nodes, idx)) {
    if (c.item && !c.key && c.value) out.push(unquote(c.value));
    else if (c.item && c.key) out.push(unquote(c.key));
    else if (!c.key && c.value) out.push(unquote(c.value));
  }
  return out.filter(Boolean);
}

/** Last line covered by the block that starts at nodes[i]. */
function spanEnd(nodes, i, lastLine) {
  const end = scopeEnd(nodes, i);
  return end < nodes.length ? Math.max(nodes[i].line, nodes[end].line - 1) : lastLine;
}

function anchor(start, end) {
  return `  :${start}-${Math.max(start, end)}`;
}

/** Secret names referenced anywhere in a line range, sorted and deduped. */
function secretsIn(lines, start, end) {
  const text = lines.slice(start - 1, end).join('\n');
  const found = new Set();
  for (const m of text.matchAll(/secrets\.([A-Za-z_][A-Za-z0-9_]*)/g)) found.add(m[1]);
  for (const m of text.matchAll(/\$\{\{\s*secrets\.([A-Za-z_][A-Za-z0-9_]*)/g)) found.add(m[1]);
  return [...found].sort();
}

// ---------------------------------------------------------------------------
// GitHub Actions
// ---------------------------------------------------------------------------

/** Render the `on:` trigger block as `push[main], pull_request, schedule[cron]`. */
function githubTriggers(nodes) {
  const i = topNode(nodes, 'on');
  if (i === null) return '';
  const node = nodes[i];
  if (node.value) {
    const list = flowList(node.value);
    return (list || [unquote(node.value)]).join(', ');
  }
  const out = [];
  for (const ev of directChildren(nodes, i)) {
    const evIdx = nodes.indexOf(ev);
    const name = ev.key || unquote(ev.value);
    if (!name) continue;
    // One filter kind renders bare (`push[main]`); several get labelled, or
    // `pull_request[main docs/**]` would read as one ambiguous list.
    const filters = [];
    for (const f of ['branches', 'tags', 'paths', 'types']) {
      const vals = listValues(nodes, evIdx, f);
      if (vals.length) filters.push({ kind: f, text: vals.slice(0, 6).join(',') });
    }
    const rendered = filters.length === 1
      ? filters[0].text
      : filters.map((f) => `${f.kind}:${f.text}`).join(' ');
    if (name === 'schedule') {
      const crons = childrenOf(nodes, evIdx).filter((c) => c.key === 'cron').map((c) => unquote(c.value));
      out.push(crons.length ? `schedule[${crons.join(', ')}]` : 'schedule');
      continue;
    }
    out.push(filters.length ? `${name}[${rendered}]` : name);
  }
  return out.join(', ');
}

function githubSteps(nodes, stepsIdx) {
  const out = [];
  for (const item of directChildren(nodes, stepsIdx)) {
    if (!item.item) continue;
    const idx = nodes.indexOf(item);
    const scope = [item, ...childrenOf(nodes, idx)];
    const get = (k) => {
      const hit = scope.find((s) => s.key === k);
      return hit ? hit.value : null;
    };
    const runNode = scope.find((s) => s.key === 'run');
    const uses = get('uses');
    const name = get('name');
    let text;
    const runText = runNode ? valueText(runNode) : '';
    if (runText) text = `run: ${runText}`;
    else if (uses) text = `uses: ${compact(uses)}`;
    else if (name) text = `step: ${compact(name)}`;
    else continue;
    const cond = get('if');
    if (cond) text += `  if: ${compact(cond, 50)}`;
    out.push(`  ${text}${anchor(item.line, spanEnd(nodes, idx, item.line))}`);
  }
  return capWithNotice(out, MAX_STEPS_PER_JOB, 'steps');
}

function githubActions(nodes, lines, fileName) {
  const sigs = [];
  const nameIdx = topNode(nodes, 'name');
  const wfName = nameIdx !== null ? unquote(nodes[nameIdx].value) || fileName : fileName;
  const triggers = githubTriggers(nodes);

  const onIdx = topNode(nodes, 'on');
  const headEnd = onIdx !== null ? spanEnd(nodes, onIdx, lines.length) : 1;
  let head = `workflow: ${wfName}`;
  if (triggers) head += `  on: ${triggers}`;

  const conc = topNode(nodes, 'concurrency');
  if (conc !== null) {
    const group = childValue(nodes, conc, 'group') || nodes[conc].value;
    if (group) head += `  concurrency: ${compact(group, 40)}`;
  }
  const perms = topNode(nodes, 'permissions');
  if (perms !== null) {
    const kids = directChildren(nodes, perms).filter((k) => k.key).map((k) => `${k.key}:${unquote(k.value)}`);
    head += `  permissions: ${kids.length ? kids.join(' ') : compact(nodes[perms].value)}`;
  }
  sigs.push(head + anchor(1, headEnd));

  const jobsIdx = topNode(nodes, 'jobs');
  if (jobsIdx === null) return sigs;

  for (const job of directChildren(nodes, jobsIdx)) {
    if (!job.key) continue;
    const idx = nodes.indexOf(job);
    const end = spanEnd(nodes, idx, lines.length);

    let line = `job: ${job.key}`;
    const runsOn = directValue(nodes, idx, 'runs-on');
    const reusable = directValue(nodes, idx, 'uses');
    if (runsOn) line += `  runs-on: ${compact(runsOn, 40)}`;
    else if (reusable) line += `  uses: ${compact(reusable)}`;

    const needs = directListValues(nodes, idx, 'needs');
    if (needs.length) line += `  needs: ${needs.join(',')}`;

    const cond = directValue(nodes, idx, 'if');
    if (cond) line += `  if: ${compact(cond, 60)}`;

    const env = directValue(nodes, idx, 'environment');
    if (env) line += `  environment: ${compact(env, 30)}`;

    // Matrix axes live under strategy.matrix; `include`/`exclude` are not axes.
    const kids = childrenOf(nodes, idx);
    const matrixNode = kids.find((k) => k.key === 'matrix');
    if (matrixNode) {
      const mIdx = nodes.indexOf(matrixNode);
      const axes = directChildren(nodes, mIdx)
        .filter((a) => a.key && a.key !== 'include' && a.key !== 'exclude')
        .map((a) => {
          const vals = flowList(a.value) || listValues(nodes, mIdx, a.key);
          return vals.length ? `${a.key}[${vals.join(',')}]` : a.key;
        });
      if (axes.length) line += `  matrix: ${axes.join(' ')}`;
    }

    const secrets = secretsIn(lines, job.line, end);
    if (secrets.length) line += `  secrets: ${secrets.join(',')}`;

    sigs.push(line + anchor(job.line, end));

    const stepsNode = kids.find((k) => k.key === 'steps');
    if (stepsNode) sigs.push(...githubSteps(nodes, nodes.indexOf(stepsNode)));
  }
  return sigs;
}

/** Composite / JS action definitions (`action.yml`). */
function githubAction(nodes, lines, fileName) {
  const sigs = [];
  const nameIdx = topNode(nodes, 'name');
  const name = nameIdx !== null ? unquote(nodes[nameIdx].value) : fileName;
  const runsIdx = topNode(nodes, 'runs');
  const using = runsIdx !== null ? childValue(nodes, runsIdx, 'using') : null;
  let head = `action: ${name}`;
  if (using) head += `  using: ${compact(using, 30)}`;
  sigs.push(head + anchor(1, Math.min(lines.length, nameIdx !== null ? nodes[nameIdx].line : 1)));

  for (const section of ['inputs', 'outputs']) {
    const idx = topNode(nodes, section);
    if (idx === null) continue;
    for (const field of directChildren(nodes, idx)) {
      if (!field.key) continue;
      const fIdx = nodes.indexOf(field);
      const req = childValue(nodes, fIdx, 'required');
      const def = childValue(nodes, fIdx, 'default');
      let t = `  ${section === 'inputs' ? 'input' : 'output'}: ${field.key}`;
      if (req === 'true') t += ' (required)';
      if (def) t += `  default: ${compact(def, 30)}`;
      sigs.push(t + anchor(field.line, spanEnd(nodes, fIdx, lines.length)));
    }
  }
  return sigs;
}

// ---------------------------------------------------------------------------
// GitLab CI
// ---------------------------------------------------------------------------

const GITLAB_RESERVED = new Set([
  'stages', 'variables', 'default', 'include', 'workflow', 'image', 'services',
  'before_script', 'after_script', 'cache', 'pages',
]);

function gitlabCi(nodes, lines) {
  const sigs = [];
  const stagesIdx = topNode(nodes, 'stages');
  if (stagesIdx !== null) {
    const vals = flowList(nodes[stagesIdx].value) || listValues(nodes, stagesIdx, 'stages')
      || directChildren(nodes, stagesIdx).map((c) => unquote(c.value || c.key)).filter(Boolean);
    const list = (vals && vals.length) ? vals : directChildren(nodes, stagesIdx).map((c) => unquote(c.value || c.key)).filter(Boolean);
    if (list.length) {
      sigs.push(`pipeline: gitlab-ci  stages: ${list.join(' → ')}${anchor(nodes[stagesIdx].line, spanEnd(nodes, stagesIdx, lines.length))}`);
    }
  }

  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    // Jobs are top-level mappings; `.hidden` entries are templates, still useful.
    if (n.indent !== 0 || !n.key || n.value || GITLAB_RESERVED.has(n.key)) continue;
    const end = spanEnd(nodes, i, lines.length);
    let line = n.key.startsWith('.') ? `template: ${n.key}` : `job: ${n.key}`;
    const stage = childValue(nodes, i, 'stage');
    if (stage) line += `  stage: ${compact(stage, 30)}`;
    const image = childValue(nodes, i, 'image');
    if (image) line += `  image: ${compact(image, 40)}`;
    const needs = listValues(nodes, i, 'needs');
    if (needs.length) line += `  needs: ${needs.join(',')}`;
    const when = childValue(nodes, i, 'when');
    if (when) line += `  when: ${compact(when, 20)}`;
    const ext = listValues(nodes, i, 'extends');
    if (ext.length) line += `  extends: ${ext.join(',')}`;
    const envNode = childrenOf(nodes, i).find((k) => k.key === 'environment');
    if (envNode) {
      const envName = envNode.value ? unquote(envNode.value) : childValue(nodes, nodes.indexOf(envNode), 'name');
      if (envName) line += `  environment: ${compact(envName, 30)}`;
    }
    sigs.push(line + anchor(n.line, end));

    const scriptNode = childrenOf(nodes, i).find((k) => k.key === 'script');
    if (scriptNode) {
      const sIdx = nodes.indexOf(scriptNode);
      const cmds = [];
      for (const c of directChildren(nodes, sIdx)) {
        const text = c.key && c.value ? `${c.key}: ${c.value}` : (c.value || c.key);
        if (text) cmds.push(`  run: ${compact(text)}${anchor(c.line, c.line)}`);
      }
      sigs.push(...capWithNotice(cmds, MAX_STEPS_PER_JOB, 'steps'));
    }
  }
  return sigs;
}

// ---------------------------------------------------------------------------
// CircleCI
// ---------------------------------------------------------------------------

function circleCi(nodes, lines) {
  const sigs = [];
  const jobsIdx = topNode(nodes, 'jobs');
  if (jobsIdx !== null) {
    for (const job of directChildren(nodes, jobsIdx)) {
      if (!job.key) continue;
      const idx = nodes.indexOf(job);
      const end = spanEnd(nodes, idx, lines.length);
      let line = `job: ${job.key}`;
      const kids = childrenOf(nodes, idx);
      const docker = kids.find((k) => k.key === 'docker');
      if (docker) {
        const img = childrenOf(nodes, nodes.indexOf(docker)).find((k) => k.key === 'image');
        if (img) line += `  docker: ${compact(img.value, 40)}`;
      }
      const executor = childValue(nodes, idx, 'executor');
      if (executor) line += `  executor: ${compact(executor, 30)}`;
      sigs.push(line + anchor(job.line, end));

      const steps = kids.find((k) => k.key === 'steps');
      if (steps) {
        const sIdx = nodes.indexOf(steps);
        const out = [];
        for (const c of directChildren(nodes, sIdx)) {
          if (!c.item) continue;
          const cIdx = nodes.indexOf(c);
          const scope = [c, ...childrenOf(nodes, cIdx)];
          const cmd = scope.find((s) => s.key === 'command');
          const text = cmd ? cmd.value : (c.value || c.key);
          if (text) out.push(`  run: ${compact(text)}${anchor(c.line, c.line)}`);
        }
        sigs.push(...capWithNotice(out, MAX_STEPS_PER_JOB, 'steps'));
      }
    }
  }

  const wfIdx = topNode(nodes, 'workflows');
  if (wfIdx !== null) {
    for (const wf of directChildren(nodes, wfIdx)) {
      if (!wf.key || wf.key === 'version') continue;
      const idx = nodes.indexOf(wf);
      sigs.push(`workflow: ${wf.key}${anchor(wf.line, spanEnd(nodes, idx, lines.length))}`);
      const jl = childrenOf(nodes, idx).find((k) => k.key === 'jobs');
      if (!jl) continue;
      for (const j of directChildren(nodes, nodes.indexOf(jl))) {
        const name = j.key || unquote(j.value);
        if (!name) continue;
        const req = listValues(nodes, nodes.indexOf(j), 'requires');
        sigs.push(`  runs: ${name}${req.length ? `  requires: ${req.join(',')}` : ''}${anchor(j.line, j.line)}`);
      }
    }
  }
  return sigs;
}

// ---------------------------------------------------------------------------
// Azure Pipelines
// ---------------------------------------------------------------------------

function azurePipelines(nodes, lines) {
  const sigs = [];
  const parts = [];
  for (const key of ['trigger', 'pr', 'schedules']) {
    const idx = topNode(nodes, key);
    if (idx === null) continue;
    const vals = flowList(nodes[idx].value) || (nodes[idx].value ? [unquote(nodes[idx].value)] : []);
    const branches = vals.length ? vals : listValues(nodes, idx, 'branches');
    const inner = branches.length ? branches : directChildren(nodes, idx)
      .filter((c) => c.item && (c.value || c.key)).map((c) => unquote(c.value || c.key));
    parts.push(inner.length ? `${key}[${inner.join(',')}]` : key);
  }
  const poolIdx = topNode(nodes, 'pool');
  let pool = '';
  if (poolIdx !== null) {
    pool = unquote(nodes[poolIdx].value) || childValue(nodes, poolIdx, 'vmImage') || '';
  }
  let head = 'pipeline: azure';
  if (parts.length) head += `  on: ${parts.join(', ')}`;
  if (pool) head += `  pool: ${compact(pool, 40)}`;
  sigs.push(head + anchor(1, nodes.length ? Math.min(lines.length, nodes[0].line) : 1));

  for (const section of ['stages', 'jobs']) {
    const idx = topNode(nodes, section);
    if (idx === null) continue;
    for (const item of directChildren(nodes, idx)) {
      if (!item.item) continue;
      const iIdx = nodes.indexOf(item);
      const scope = [item, ...childrenOf(nodes, iIdx)];
      const get = (k) => { const h = scope.find((s) => s.key === k); return h ? h.value : null; };
      const name = get('stage') || get('job') || get('template');
      if (!name) continue;
      const end = spanEnd(nodes, iIdx, lines.length);
      let line = `${section === 'stages' ? 'stage' : 'job'}: ${unquote(name)}`;
      const dn = get('displayName');
      if (dn) line += `  displayName: ${compact(dn, 40)}`;
      const dep = listValues(nodes, iIdx, 'dependsOn');
      if (dep.length) line += `  dependsOn: ${dep.join(',')}`;
      const cond = get('condition');
      if (cond) line += `  condition: ${compact(cond, 50)}`;
      sigs.push(line + anchor(item.line, end));

      const stepsNode = childrenOf(nodes, iIdx).find((k) => k.key === 'steps');
      if (stepsNode) {
        const sIdx = nodes.indexOf(stepsNode);
        const out = [];
        for (const c of directChildren(nodes, sIdx)) {
          if (!c.item) continue;
          const cScope = [c, ...childrenOf(nodes, nodes.indexOf(c))];
          const pick = (k) => { const h = cScope.find((s) => s.key === k); return h ? h.value : null; };
          const text = pick('script') || pick('bash') || pick('pwsh') || pick('task') || pick('template');
          if (text) out.push(`  run: ${compact(text)}${anchor(c.line, c.line)}`);
        }
        sigs.push(...capWithNotice(out, MAX_STEPS_PER_JOB, 'steps'));
      }
    }
  }
  return sigs;
}

// ---------------------------------------------------------------------------
// Bitbucket Pipelines
// ---------------------------------------------------------------------------

function bitbucket(nodes, lines) {
  const sigs = [];
  const imgIdx = topNode(nodes, 'image');
  let head = 'pipeline: bitbucket';
  if (imgIdx !== null && nodes[imgIdx].value) head += `  image: ${compact(nodes[imgIdx].value, 40)}`;
  sigs.push(head + anchor(1, nodes.length ? nodes[0].line : 1));

  const pIdx = topNode(nodes, 'pipelines');
  if (pIdx === null) return sigs;
  for (const group of directChildren(nodes, pIdx)) {
    if (!group.key) continue;
    const gIdx = nodes.indexOf(group);
    const gEnd = spanEnd(nodes, gIdx, lines.length);
    sigs.push(`trigger: ${group.key}${anchor(group.line, gEnd)}`);

    for (const step of childrenOf(nodes, gIdx).filter((k) => k.key === 'step')) {
      const sIdx = nodes.indexOf(step);
      const name = childValue(nodes, sIdx, 'name');
      const img = childValue(nodes, sIdx, 'image');
      let line = `  step: ${name ? compact(name, 40) : '(unnamed)'}`;
      if (img) line += `  image: ${compact(img, 30)}`;
      const deploy = childValue(nodes, sIdx, 'deployment');
      if (deploy) line += `  deployment: ${compact(deploy, 20)}`;
      sigs.push(line + anchor(step.line, spanEnd(nodes, sIdx, lines.length)));
    }
  }
  return sigs;
}

// ---------------------------------------------------------------------------
// Drone / Woodpecker
// ---------------------------------------------------------------------------

function drone(nodes, lines) {
  const sigs = [];
  const nameIdx = topNode(nodes, 'name');
  const kindIdx = topNode(nodes, 'kind');
  let head = `pipeline: ${nameIdx !== null ? unquote(nodes[nameIdx].value) : 'drone'}`;
  if (kindIdx !== null && nodes[kindIdx].value) head += `  kind: ${unquote(nodes[kindIdx].value)}`;
  sigs.push(head + anchor(1, nodes.length ? nodes[0].line : 1));

  const stepsIdx = topNode(nodes, 'steps');
  if (stepsIdx === null) return sigs;
  for (const step of directChildren(nodes, stepsIdx)) {
    if (!step.item) continue;
    const sIdx = nodes.indexOf(step);
    const scope = [step, ...childrenOf(nodes, sIdx)];
    const get = (k) => { const h = scope.find((s) => s.key === k); return h ? h.value : null; };
    const name = get('name');
    if (!name) continue;
    let line = `step: ${unquote(name)}`;
    const img = get('image');
    if (img) line += `  image: ${compact(img, 40)}`;
    const dep = listValues(nodes, sIdx, 'depends_on');
    if (dep.length) line += `  depends_on: ${dep.join(',')}`;
    sigs.push(line + anchor(step.line, spanEnd(nodes, sIdx, lines.length)));
  }
  return sigs;
}

// ---------------------------------------------------------------------------
// Docker Compose
// ---------------------------------------------------------------------------

function compose(nodes, lines) {
  const sigs = [];
  const sIdx = topNode(nodes, 'services');
  if (sIdx === null) return sigs;
  for (const svc of directChildren(nodes, sIdx)) {
    if (!svc.key) continue;
    const idx = nodes.indexOf(svc);
    const end = spanEnd(nodes, idx, lines.length);
    let line = `service: ${svc.key}`;
    const image = childValue(nodes, idx, 'image');
    if (image) line += `  image: ${compact(image, 40)}`;
    else {
      const buildNode = childrenOf(nodes, idx).find((k) => k.key === 'build');
      if (buildNode) {
        const ctx = buildNode.value || childValue(nodes, nodes.indexOf(buildNode), 'context');
        line += `  build: ${ctx ? compact(ctx, 30) : '.'}`;
      }
    }
    const ports = listValues(nodes, idx, 'ports');
    if (ports.length) line += `  ports: ${ports.join(',')}`;
    const dep = listValues(nodes, idx, 'depends_on');
    if (dep.length) line += `  depends_on: ${dep.join(',')}`;
    const cmd = childValue(nodes, idx, 'command');
    if (cmd) line += `  command: ${compact(cmd, 40)}`;
    sigs.push(line + anchor(svc.line, end));
  }
  return sigs;
}

// ---------------------------------------------------------------------------
// Jenkinsfile (Groovy declarative)
// ---------------------------------------------------------------------------

function jenkins(src) {
  const sigs = [];
  const lines = String(src).split('\n');
  const agent = src.match(/^\s*agent\s+(.+)$/m);
  sigs.push(`pipeline: jenkins${agent ? `  agent: ${compact(agent[1], 40)}` : ''}  :1-1`);

  for (let i = 0; i < lines.length; i++) {
    const stage = lines[i].match(/^\s*stage\s*\(\s*['"]([^'"]+)['"]/);
    if (stage) sigs.push(`stage: ${stage[1]}${anchor(i + 1, i + 1)}`);
    const sh = lines[i].match(/^\s*(sh|bat|powershell)\s+['"]{1,3}(.+?)['"]{1,3}\s*$/);
    if (sh) sigs.push(`  run: ${compact(sh[2])}${anchor(i + 1, i + 1)}`);
  }
  return sigs;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

const RENDERERS = {
  github: githubActions,
  action: githubAction,
  gitlab: gitlabCi,
  circleci: circleCi,
  azure: azurePipelines,
  bitbucket,
  drone,
  compose,
};

/**
 * Extract semantic signatures from a CI / pipeline definition.
 * @param {string} src - raw file content
 * @param {string} [filePath] - path (drives platform routing; falls back to a content sniff)
 * @returns {string[]}
 */
function extract(src, filePath) {
  if (!src || typeof src !== 'string') return [];
  const platform = platformFor(filePath) || sniffPlatform(src);
  if (!platform) return [];

  try {
    if (platform === 'jenkins') return capWithNotice(jenkins(src), PER_FILE_LIMIT, 'signatures');
    const lines = src.split('\n');
    const nodes = scanYaml(src);
    if (nodes.length === 0) return [];
    const fileName = path.posix.basename(String(filePath || '').replace(/\\/g, '/')) || 'pipeline';
    const render = RENDERERS[platform];
    const sigs = render.length >= 3 ? render(nodes, lines, fileName) : render(nodes, lines);
    return capWithNotice(sigs.filter(Boolean), PER_FILE_LIMIT, 'signatures');
  } catch (_) {
    // A malformed pipeline must degrade to "no signatures", never to a throw
    // that would abort the whole context build.
    return [];
  }
}

module.exports = { extract, platformFor, sniffPlatform, scanYaml, PER_FILE_LIMIT };
