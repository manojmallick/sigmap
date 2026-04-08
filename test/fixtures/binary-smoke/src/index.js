'use strict';

/**
 * Minimal fixture used by scripts/verify-binary.mjs smoke tests.
 * sigmap processes this file and writes .github/copilot-instructions.md.
 */

function greet(name) {
  return `Hello, ${name}!`;
}

function add(a, b) {
  return a + b;
}

class Calculator {
  constructor(initial = 0) {
    this.value = initial;
  }

  add(n) {
    this.value += n;
    return this;
  }

  result() {
    return this.value;
  }
}

module.exports = { greet, add, Calculator };
