'use strict';
const assert = require('assert');
const { loadConfig } = require('../src/index');

assert.strictEqual(loadConfig('a').path, 'a');
