'use strict';

/**
 * Query focus for the prefetch hook (src/session/prefetch.js).
 *
 * The hook ranks the repository's files against the prompt it is handed, and a BM25 ranking over a whole prompt is only as good as the
 * prompt is focused. A question wrapped in greetings, instructions about the answer, background and pasted output ranks worse than the
 * question alone: in the agent study the expected file was in the top five for 47 of 87 questions when the question sat inside about
 * fifty words of instructions, against 61 of 87 for the bare question (docs-vp/guide/agent-study-protocol.md, "The hook ranked the
 * whole prompt").
 *
 * This keeps the sentences of a long prompt that say something and drops the ones that are only conversation. It is lexical and fixed:
 *
 *   - a prompt of MIN_WORDS words or fewer is returned exactly as it is, so a plain question is ranked as it always was;
 *   - fenced code blocks, and lines that look like pasted tool output (a shell prompt, a traceback frame, a dated log line, a test
 *     runner's PASS/FAIL), are dropped;
 *   - the rest is split into sentences (at . ? ! followed by a space, and at newlines, but NOT at a colon: `goproxmox: make ...` and
 *     `Task: ...` are labels that belong to the sentence), and a sentence is kept when at least MIN_CONTENT of its words, and at least TAU
 *     of all its words, are neither function words nor conversation/instruction words, or when it contains something that looks like an
 *     identifier (camelCase, snake_case, a dotted or slashed path, a backticked span);
 *   - if that leaves nothing, the prompt is used as it is.
 *
 * What it cannot do, measured: a sentence made of ordinary software words ("keep the public API unchanged", "add tests for any new
 * behaviour") is not told from a question, a pasted traceback loses its frames, and chatter in ordinary words ("I've been going back
 * and forth on it all week") is kept. Offline over 222 held-out questions in thirteen kinds of wrapper (benchmarks/agent-study/
 * query-focus-eval.mjs, result in data/query-focus-eval.txt) the expected file was in the top five for 59% of the raw wrapped prompts,
 * 66% after this, and 72% for the bare question; first for 28%, 36% and 45%. Bare questions come back unchanged. In an agent with the
 * benchmark's wrapped prompt the hook's real cost against its own baseline was -3% [-6, 0] with this and +3% [0, +6] without it on eight
 * repositories, and -7% [-10, -5] and 0% [-3, +2] on twelve others, where the file was also found in 14 fewer runs of 540 than without the hook.
 *
 * Zero dependencies. Pure: the same prompt gives the same query.
 */

const MIN_WORDS = 24;
const TAU = 0.5;
const MIN_CONTENT = 2;
const MAX_WORDS = 80;
const LEAD_IN_WORDS = 8;
const MAX_INPUT = 40000; // chars read: the head and the tail of anything longer, so a pasted megabyte costs nothing

const FUNCTION_WORDS = new Set((
  'a an the and or but if so as of to in on at by for from with without about into onto over under than then there here this that these those '
  + 'is are was were be been being am do does did done have has had having not no yes can could would should will shall may might must '
  + 'i me my mine we us our ours you your yours it its they them their he she him her who whom whose which what when where why how '
  + 'any some each every all both either neither more most less least many much one two per out up down off again also too very just only own same such other another'
).split(' '));

/** Conversation and instruction vocabulary: words that say how to answer or who is asking, not what the code is about. */
const META_WORDS = new Set((
  'hi hello hey thanks thank please sorry ok okay well really honestly basically actually anyway '
  + 'help helping helped try trying tried want wanted need needed like looking look figure understand explain tell show give name mention respond answer answering reply provide include know wondering wonder think guess '
  + 'concise brief short detailed bullet bullets points sentence sentences paragraph line lines backticks format exhaustive '
  + 'ensure make sure keep follow avoid remember note consider '
  + 'thing things stuff something anything everything someone anyone '
  + 'today yesterday earlier now while lately recently quarter week weekly '
  + 'new team joined getting familiar pointers great lot bit lost together '
  + 'context background question questions task tasks follow-up first relevant'
).split(' '));

const PASTED_LINE = /^\s*(\$ |#!\s|at [\w.$<>]+ ?\(|File "|Traceback|\d{4}-\d\d-\d\d|\[\d|[A-Z][a-z]+Error:|PASS |FAIL |Tests?:|Time:)/;
const IDENTIFIER = /[A-Za-z]+[A-Z][a-z]|[a-z]+_[a-z]+|\w+\.\w+|\w+\/\w+|`[^`]+`/;

const wordCount = (s) => (s.trim() ? s.trim().split(/\s+/).length : 0);

function bounded(text) {
  if (text.length <= MAX_INPUT) return text;
  const half = MAX_INPUT / 2;
  return `${text.slice(0, half)}\n${text.slice(-half)}`;
}

function sentences(text) {
  return text.split(/(?<=[.?!])\s+|\n+/).map((s) => s.trim()).filter(Boolean);
}

/**
 * A sentence led by a short label ("Task: ...", "What I'm trying to do: ...", "One question about the code: ...") is judged on what follows
 * the label, so a chatty lead-in cannot dilute a question that follows it. The sentence is kept whole.
 */
function leadInSplit(sentence) {
  const m = /^([^:]{1,60}):\s+(\S[\s\S]*)$/.exec(sentence);
  return m && wordCount(m[1]) <= LEAD_IN_WORDS ? m[2] : sentence;
}

function carriesContent(sentence) {
  if (IDENTIFIER.test(sentence)) return true;
  const all = leadInSplit(sentence).toLowerCase().match(/[a-z][a-z0-9_]*/g) || [];
  const content = all.filter((w) => w.length > 1 && !FUNCTION_WORDS.has(w) && !META_WORDS.has(w));
  return content.length >= MIN_CONTENT && content.length / Math.max(1, all.length) >= TAU;
}

/**
 * @param {string} prompt the submitted prompt, newlines intact
 * @returns {{ query: string, focused: boolean }} `focused` is true when sentences were dropped
 */
function focusQuery(prompt) {
  const text = typeof prompt === 'string' ? prompt : '';
  if (wordCount(text) <= MIN_WORDS) return { query: text, focused: false };

  const body = bounded(text)
    .replace(/```[\s\S]*?```/g, ' ')
    .split('\n')
    .filter((line) => !PASTED_LINE.test(line))
    .join('\n');

  const all = sentences(body);
  const kept = all.filter(carriesContent);
  if (kept.length === 0 || kept.length === all.length && body.length === text.length) {
    return { query: text, focused: false };
  }
  const words = kept.join(' ').split(/\s+/).slice(0, MAX_WORDS);
  return { query: words.join(' '), focused: true };
}

module.exports = { focusQuery, MIN_WORDS, TAU, MIN_CONTENT, MAX_WORDS, MAX_INPUT, FUNCTION_WORDS, META_WORDS };
