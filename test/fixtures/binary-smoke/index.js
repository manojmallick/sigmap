// Fixture: index.js — used by binary smoke tests

function greet(name) {
  return `Hello, ${name}!`;
}

function add(a, b) {
  return a + b;
}

function multiply(a, b) {
  return a * b;
}

class Calculator {
  constructor(initial = 0) {
    this.value = initial;
  }

  add(n) {
    this.value += n;
    return this;
  }

  reset() {
    this.value = 0;
    return this;
  }

  result() {
    return this.value;
  }
}

module.exports = { greet, add, multiply, Calculator };
