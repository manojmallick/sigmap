'use strict';

/**
 * PROBE ONLY — not a real test. Adds an indexed file of comparable size to the
 * one #578 adds, with no assertion about extractor behaviour, to isolate whether
 * the hard-corpus gate fails simply because a PR adds a file to the index.
 */

const assert = require('assert');

let passed = 0;
function test(name, fn) { fn(); console.log(`  PASS  ${name}`); passed++; }

test('probe: arithmetic still works', () => { assert.strictEqual(1 + 1, 2); });
test('probe: strings still concatenate', () => { assert.strictEqual('a' + 'b', 'ab'); });

console.log('');
console.log(`${passed} passed, 0 failed`);
