'use strict';

const fs = require('fs');
const path = require('path');
const { boostFiles, normalizeFile, penalizeFiles } = require('../learning/weights');
const parsers = require('../verify/parsers');
const { tokenize: rankTokenize, stem } = require('../retrieval/bm25');

/**
 * Ordinary-English vocabulary (#779).
 *
 * The judge scores how much of an answer's *technical* content the context
 * grounds — not how much of the answer is English. Before this list existed,
 * `groundedness` was a raw word-overlap ratio, so five words of hedging prose
 * dropped a fully-grounded answer below the threshold and failed it. Filler is
 * removed from BOTH sides, so it can neither inflate nor dilute the score.
 *
 * Deliberately excludes words that name things in a repo (`value`, `type`,
 * `error`, `state`, `class`, `result`, `case`, `file`, `path`, `key`, `index`):
 * dropping those would hide real vocabulary. Entries are stemmed at load with
 * the ranker's own stemmer, so surface forms match after tokenization.
 */
const PROSE_WORDS = (
  // pronouns, determiners, quantifiers
  'i you we they he she it me us them him her my your our their his hers its ' +
  'this that these those which who whom whose what there here any some all both ' +
  'each every either neither many much few several other another same such own ' +
  'most more less least enough none nothing something anything everything ' +
  // auxiliaries and modals
  'am is are was were be been being have has had having do does did doing ' +
  'will would shall should can could may might must ought ' +
  // conjunctions, prepositions, discourse connectives
  'and or but if then else because since while when where whether though ' +
  'although unless until after before during about above below over under ' +
  'between among through across into onto upon within without along around ' +
  'beside behind beyond toward towards per via than so yet nor also too only ' +
  'just even still already again once ever never always often sometimes ' +
  'however therefore thus hence moreover furthermore additionally instead ' +
  'otherwise meanwhile overall indeed anyway rather ' +
  // hedges and intensifiers — the vocabulary of ungrounded prose
  'usually typically generally normally commonly probably possibly perhaps ' +
  'maybe likely unlikely actually really quite very fairly somewhat mostly ' +
  'largely simply basically essentially effectively clearly obviously ' +
  'certainly definitely particularly specifically especially approximately ' +
  'roughly slightly nearly almost ' +
  // generic verbs that carry no repo signal
  'look see make take give come want need know think say tell find use go ' +
  'put keep let help try seem become live decide mean work start happen ' +
  'consider note show tend appear allow provide ensure avoid prefer choose ' +
  'mention describe explain suggest recommend ' +
  // generic nouns and adjectives
  'thing way time place part kind sort lot bit point fact example reason ' +
  'problem question good bad better best worse worst big small large long ' +
  'short high low old first last next previous different important useful ' +
  'helpful easy hard difficult simple complex complicated general specific ' +
  'common possible sure able right wrong true false yes'
).split(/\s+/).filter(Boolean);

const PROSE_STOP = new Set(PROSE_WORDS.map(stem));

/**
 * The tokens a groundedness score is computed over.
 *
 * Uses the ranker's tokenizer (`src/retrieval/bm25.js`) so the judge and the
 * retrieval side agree on what a token is: camelCase and snake_case are split
 * and stemmed, which is why `buildEvidencePack` and `build evidence pack` now
 * score the same. The judge's own ad-hoc `/\b[a-z][a-z0-9_]{2,}\b/` regex did
 * neither, so a bare identifier written out as prose was invisible to it.
 *
 * @param {string} text
 * @returns {string[]}
 */
function scoreTokens(text) {
  return rankTokenize(text).filter((t) => !PROSE_STOP.has(t));
}

function groundedness(response, context) {
  if (!response || !context) return 0;
  const ctxTokens = new Set(scoreTokens(context));
  if (ctxTokens.size === 0) return 0;
  const respTokens = scoreTokens(response);
  if (respTokens.length === 0) return 0;
  const matched = respTokens.filter((t) => ctxTokens.has(t));
  return parseFloat((matched.length / respTokens.length).toFixed(3));
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Evidence in a claim's own form, for a claim `verify` has proved fake (#909).
 *
 *   symbol  a call or definition — `name(`, `name = (…) =>`, `def name` — never
 *           the bare word, which is how `rank` was "grounded" by prose
 *   file    the claimed path as a path-aligned suffix of a path the context
 *           names (`lib/index.js` inside `src/lib/index.js`, not `src/index.js`)
 *   import  the module as a whole token, not a substring of a longer one
 *
 * @param {'symbol'|'file'|'import'} kind
 * @param {string} needle  lower-cased claim value
 * @param {string} ctxLower lower-cased context
 * @returns {boolean}
 */
function hasStrongEvidence(kind, needle, ctxLower) {
  const id = escapeRe(needle);
  if (kind === 'symbol') {
    return new RegExp(`(?<![\\w$])${id}\\s*\\(`).test(ctxLower)
      || new RegExp(`(?<![\\w$])${id}\\s*[:=]\\s*(?:async\\s*)?(?:function\\b|\\()`).test(ctxLower)
      || new RegExp(`\\b(?:def|function|func|fn|fun|class|struct|interface|trait|enum|type)\\s+${id}(?![\\w$])`).test(ctxLower);
  }
  // file and import share one shape: the claim bounded on both sides, with a
  // `/` before it allowed — that is a longer path ending in the claim.
  return new RegExp(`(?:^|[^\\w$.-])(?:[\\w$.-]+/)*${id}(?![\\w$-]|\\.[\\w])`).test(ctxLower);
}

/**
 * Claim-level grounding (v8.10) — the structural half of the judge.
 *
 * `groundedness` above measures lexical *word* overlap: "does the answer reuse
 * context vocabulary?" That is a weak proxy — an answer can echo context words
 * while asserting a symbol, file, or import the context never mentions (a
 * hallucination), and still score high. This function extracts the answer's
 * *concrete, checkable claims* — the same high-precision claims the hallucination
 * guard checks (backtick-wrapped `foo()` calls, `path/to/file.ext` references,
 * and `import … from 'mod'` statements) — and verifies each one appears in the
 * provided context. A claim the context never grounds is a hallucination signal
 * that pure word-overlap cannot see.
 *
 * Deterministic, offline, zero-dependency. Reuses `src/verify/parsers`.
 *
 * Structural half (J1, #640): when `opts.cwd` is provided, the verify engine —
 * the same `buildSymbolSet` + `buildLibraryIndex` map `sigmap verify` uses —
 * clears any claim whose check class ran and did not flag it, so a real repo
 * or installed-library symbol the context never quotes is grounded, while a
 * fabricated one still fails. One grounding engine, two commands. Without a
 * cwd, behavior is the original lexical context matching, byte-identical.
 *
 * The verdict runs both ways (#909): a claim verify has proved fake is no longer
 * grounded by a weak lexical match — a substring, a prose word, a basename —
 * only by evidence in its own form (`hasStrongEvidence`). And an import verify
 * positively resolved (a repo module, the standard library, a go.mod
 * requirement) is cleared in any language, not only where a package.json exists.
 *
 * @param {string} response
 * @param {string} context
 * @param {object} [opts]
 * @param {string} [opts.cwd]  repo root for structural verification
 * @returns {{ total: number, grounded: number, ungrounded: Array<{kind:string, value:string}>, structural: boolean }}
 */
function claimGrounding(response, context, opts = {}) {
  if (!response || !context) return { total: 0, grounded: 0, ungrounded: [], structural: false, checked: [], coverage: 0 };
  const ctxLower = context.toLowerCase();

  const raw = [];
  for (const s of parsers.extractSymbols(response)) raw.push({ kind: 'symbol', value: s.name });
  for (const f of parsers.extractFilePaths(response)) raw.push({ kind: 'file', value: f.path });
  for (const i of parsers.extractImports(response)) raw.push({ kind: 'import', value: i.module, relative: !!i.relative });

  const seen = new Set();
  const claims = raw.filter((c) => {
    const key = `${c.kind}::${c.value}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  let flagged = null;
  let checks = null;
  let verified = null;
  if (opts && typeof opts.cwd === 'string') {
    try {
      const { verify } = require('../verify/hallucination-guard');
      const v = verify(response, opts.cwd);
      checks = (v.summary && v.summary.checks) || null;
      verified = new Set((v.summary && v.summary.verifiedImports) || []);
      flagged = new Set();
      for (const i of v.issues) {
        if (i.type === 'fake-symbol') flagged.add(`symbol::${i.value}`);
        else if (i.type === 'fake-file' || i.type === 'fake-test-file') flagged.add(`file::${i.value}`);
        else if (i.type === 'fake-import') flagged.add(`import::${i.value}`);
      }
    } catch (_) { flagged = null; checks = null; verified = null; }
  }
  // A claim is only structurally clearable when its check class actually ran —
  // "not flagged" means nothing if the symbol index is empty or there is no
  // package.json to check bare imports against. An import verify positively
  // resolved (a repo module, the standard library, a go.mod requirement) has
  // been checked whatever its language; one it could not decide has not (#909).
  const structuralRan = (c) => {
    if (!checks) return false;
    if (c.kind === 'symbol') return !!checks.symbols;
    if (c.kind === 'file') return !!checks.files;
    if (verified && verified.has(c.value)) return true;
    return c.relative ? !!checks.relativeImports : !!checks.bareImports;
  };

  const ungrounded = [];
  const checked = [];
  let grounded = 0;
  for (const c of claims) {
    const key = `${c.kind}::${c.value}`;
    // A file claim is grounded if its basename appears in context (the answer
    // may cite a different directory than the map records). Symbols and modules
    // are matched on the token itself.
    const needle = c.value.toLowerCase();
    const base = c.kind === 'file' ? (c.value.split('/').pop() || c.value).toLowerCase() : needle;
    // Structure outranks weak text (#909): once verify has proved the claim
    // fake, a word that merely occurs in the context — `rank` in "to rank files",
    // `index.js` in `src/index.js` — no longer grounds it; only evidence in the
    // claim's own form does. A claim can only be flagged if its check ran, so
    // being flagged is the proof. Without a structural verdict the match is unchanged.
    const proven = flagged !== null && flagged.has(key);
    const lexical = proven
      ? hasStrongEvidence(c.kind, needle, ctxLower)
      : (ctxLower.includes(base) || ctxLower.includes(needle));
    const structuralHit = flagged !== null && structuralRan(c) && !flagged.has(key);
    // Explainability (J4, #653): every claim reports its grounding route —
    // "context" (the context quotes it), "repo" (the structural pass cleared
    // it), or null (nothing grounds it). Context is reported first when both
    // apply, since it needs no repo at all.
    const via = lexical ? 'context' : (structuralHit ? 'repo' : null);
    checked.push({ kind: c.kind, value: c.value, grounded: via !== null, via });
    if (via !== null) grounded++;
    else ungrounded.push({ kind: c.kind, value: c.value });
  }

  return {
    total: claims.length,
    grounded,
    ungrounded,
    structural: flagged !== null,
    checked,
    coverage: claims.length ? Math.round((grounded / claims.length) * 1000) / 1000 : 0,
  };
}

/**
 * Hedging phrases that signal an answer is reasoning from general knowledge
 * rather than from the context. These are a *style* signal, never a grounding
 * one (#765): before this change a fully-grounded answer failed — exit 1, and
 * reported at `high` confidence — solely because it contained the word
 * "typically,". They are now reported as warnings and never flip the verdict.
 */
const GENERIC_MARKERS = [
  'however, based on my knowledge',
  'generally speaking',
  'in general',
  'typically,',
  'usually,',
  'as a general rule',
];

/**
 * Word-boundary matcher for a generic marker.
 *
 * A plain `includes()` matched `in general` inside `in general-purpose code`
 * (#765). The trailing lookahead rejects a following word character *or*
 * hyphen, so hyphenated compounds no longer trip the check, while markers that
 * end in punctuation (`typically,`) still match.
 */
function markerRegex(marker) {
  return new RegExp(`\\b${marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w-])`, 'i');
}

function extractContextFiles(context, cwd) {
  if (!context || !cwd) return [];

  const seen = new Set();
  const files = [];
  const lines = context.split('\n');

  for (const line of lines) {
    const match = line.match(/^#{2,3}\s+(.+?)\s*$/);
    if (!match) continue;

    const normalized = normalizeFile(cwd, match[1]);
    if (!normalized) continue;

    const abs = path.join(cwd, normalized);
    if (!fs.existsSync(abs) || seen.has(normalized)) continue;

    seen.add(normalized);
    files.push(normalized);
  }

  return files;
}

/** Empty claim report, for a verdict reached without scoring anything. */
function emptyClaims() {
  return { total: 0, grounded: 0, ungrounded: [], structural: false, checked: [], coverage: 0 };
}

/**
 * Why this input cannot be judged at all, or null when it can (#766).
 *
 * `pass`/`fail` is a judgement about an answer. An empty response file, an
 * empty context, or an answer with no scoreable vocabulary is not a wrong
 * answer — it is a missing one, and filing it as `fail` gives CI the same
 * signal a confidently hallucinated answer produces.
 */
function inconclusiveReason(response, context) {
  if (!response || !response.trim()) return 'response is empty — nothing to judge';
  if (!context || !context.trim()) return 'context is empty — nothing to judge against';
  if (scoreTokens(context).length === 0) return 'context has no scoreable tokens — nothing to judge against';
  if (scoreTokens(response).length === 0) return 'response has no scoreable tokens — nothing to check against the context';
  return null;
}

function judge(response, context, opts = {}) {
  const threshold = opts.threshold !== undefined ? opts.threshold : 0.25;

  // Inconclusive short-circuit (#766): nothing was scored, so there is no
  // verdict to reach and no weights feedback to apply.
  const blocked = inconclusiveReason(response, context);
  if (blocked) {
    const result = {
      score: 0,
      verdict: 'inconclusive',
      reasons: [blocked],
      warnings: [],
      claims: emptyClaims(),
      confidence: { level: 'low', basis: ['nothing to judge'] },
    };
    if (opts.learn) {
      result.learning = { applied: false, action: 'none', files: [], reason: 'verdict inconclusive — no signal to learn from' };
    }
    return result;
  }

  const score = groundedness(response, context);
  const reasons = [];

  if (score < threshold) {
    reasons.push(`score ${score} is below threshold ${threshold} — response may not be grounded in context`);
  }

  // Style warnings (#765) — reported, never a verdict input.
  const warnings = [];
  for (const m of GENERIC_MARKERS) {
    if (markerRegex(m).test(response)) {
      warnings.push(`response contains generic phrase: "${m}"`);
    }
  }

  // Structural claim grounding: any concrete symbol/file/import the answer
  // states that neither the context nor (with a cwd) the repo/installed-lib
  // index grounds is a hallucination the lexical score above cannot detect.
  // Each ungrounded claim fails the verdict.
  const claims = claimGrounding(response, context, opts);
  const where = claims.structural ? 'context or repo index' : 'context';
  for (const c of claims.ungrounded) {
    reasons.push(`${c.kind} claim not grounded in ${where}: ${c.value}${c.kind === 'symbol' ? '()' : ''}`);
  }

  const verdict = score >= threshold && claims.ungrounded.length === 0 ? 'pass' : 'fail';

  // Confidence in the verdict (J4, #653) — a deterministic level with an
  // auditable basis, aligned with the Evidence Pack's confidence vocabulary:
  //   high   — the structural pass ran, every claim grounded, and the score
  //            clears the threshold by ≥ 0.15
  //   medium — claims were checked (lexically or with ungrounded findings —
  //            symbol detection is medium-certainty by the verify taxonomy),
  //            or the margin alone is comfortable
  //   low    — no concrete claims and a thin margin: the verdict rests on
  //            word overlap alone
  const margin = Math.round((score - threshold) * 1000) / 1000;
  const basis = [`${claims.total} claim(s) checked`];
  if (claims.structural) basis.push('structural pass ran');
  basis.push(`score margin ${margin}`);
  let level;
  if (claims.structural && claims.total > 0 && claims.ungrounded.length === 0 && margin >= 0.15) level = 'high';
  else if (claims.total > 0 || margin >= 0.15) level = 'medium';
  else level = 'low';
  // Hedging language is unverifiable by construction, so it caps confidence
  // rather than flipping the verdict (#765) — the judge must never report
  // `high` confidence in a result a stylistic signal had any part in.
  if (warnings.length && level === 'high') {
    level = 'medium';
    basis.push('generic phrasing present');
  }
  const confidence = { level, basis };

  const result = { score, verdict, reasons, warnings, claims, confidence };

  if (opts.learn) {
    const learning = {
      applied: false,
      action: 'none',
      files: [],
    };

    if (!opts.cwd) {
      learning.reason = 'cwd is required for learning';
      result.learning = learning;
      return result;
    }

    const contextFiles = extractContextFiles(context, opts.cwd);
    learning.files = contextFiles;

    if (contextFiles.length === 0) {
      learning.reason = 'no context files found in context headings';
      result.learning = learning;
      return result;
    }

    const boostAbove = typeof opts.learnBoostAbove === 'number' ? opts.learnBoostAbove : 0.75;
    const penalizeBelow = typeof opts.learnPenalizeBelow === 'number' ? opts.learnPenalizeBelow : 0.40;
    if (score > boostAbove) {
      boostFiles(opts.cwd, contextFiles, 0.05);
      learning.applied = true;
      learning.action = 'boost';
    } else if (score < penalizeBelow) {
      penalizeFiles(opts.cwd, contextFiles, 0.03);
      learning.applied = true;
      learning.action = 'penalize';
    } else {
      learning.reason = `groundedness in no-op band (${penalizeBelow}-${boostAbove})`;
    }

    result.learning = learning;
  }

  return result;
}

module.exports = { groundedness, claimGrounding, hasStrongEvidence, judge, scoreTokens, markerRegex, GENERIC_MARKERS, PROSE_STOP };
