'use strict';

const path = require('path');
const assert = require('assert');

const ROOT = path.resolve(__dirname, '../../..');
const { extract } = require(path.join(ROOT, 'src', 'extractors', 'typescript'));

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  PASS  ${name}`);
    passed++;
  } catch (err) {
    console.log(`  FAIL  ${name}: ${err.message}`);
    failed++;
  }
}

// Issue #97: guard clauses must not appear as class member signatures
test('guard clause if(!x) { return; } not extracted as method', () => {
  const src = `
export class WebGLRenderer {
  private gl: WebGLRenderingContext;
  render(scene: Scene): void {
    if (!this.gl) { return; }
    this._drawScene(scene);
  }
  private _drawScene(scene: Scene): void {}
}
`;
  const sigs = extract(src);
  const sigStr = sigs.join('\n');
  assert.ok(!sigStr.includes('if('), `should not contain 'if(' but got:\n${sigStr}`);
  assert.ok(sigStr.includes('class WebGLRenderer'), 'class name should be present');
  assert.ok(sigStr.includes('render('), 'public method should be present');
});

test('if with complex condition not extracted', () => {
  const src = `
export class BridgeManager {
  connect(bridgeContext: BridgeContext): void {
    if (!bridgeContext) {
      throw new Error('no context');
    }
    this.ctx = bridgeContext;
  }
}
`;
  const sigs = extract(src);
  const sigStr = sigs.join('\n');
  assert.ok(!sigStr.includes('if(') && !sigStr.includes('if ('), `should not contain 'if' guard:\n${sigStr}`);
  assert.ok(sigStr.includes('connect('), 'connect method should be present');
});

test('for loop inside method not extracted as member', () => {
  const src = `
export class Processor {
  run(items: string[]): void {
    for (let i = 0; i < items.length; i++) {
      this.process(items[i]);
    }
  }
  private process(item: string): void {}
}
`;
  const sigs = extract(src);
  const sigStr = sigs.join('\n');
  assert.ok(!sigStr.includes('  for(') && !sigStr.includes('  for ('), `should not contain 'for' loop:\n${sigStr}`);
  assert.ok(sigStr.includes('run('), 'run method should be present');
});

test('while loop inside method not extracted as member', () => {
  const src = `
export class Queue {
  drain(): void {
    while (this.items.length > 0) {
      this.items.pop();
    }
  }
}
`;
  const sigs = extract(src);
  const sigStr = sigs.join('\n');
  assert.ok(!sigStr.includes('  while(') && !sigStr.includes('  while ('), `should not contain 'while' loop:\n${sigStr}`);
  assert.ok(sigStr.includes('drain('), 'drain method should be present');
});

test('switch statement inside method not extracted as member', () => {
  const src = `
export class Router {
  route(action: string): void {
    switch (action) {
      case 'go': this.go(); break;
      default: break;
    }
  }
  private go(): void {}
}
`;
  const sigs = extract(src);
  const sigStr = sigs.join('\n');
  assert.ok(!sigStr.includes('  switch(') && !sigStr.includes('  switch ('), `should not contain 'switch':\n${sigStr}`);
  assert.ok(sigStr.includes('route('), 'route method should be present');
});

// Positive: real methods still extracted
test('normal public methods still extracted correctly', () => {
  const src = `
export class AuthService {
  login(user: string, pass: string): Promise<Token> {
    if (!user) { throw new Error('no user'); }
    return this.verify(user, pass);
  }
  async logout(): Promise<void> {}
  static create(): AuthService { return new AuthService(); }
}
`;
  const sigs = extract(src);
  const sigStr = sigs.join('\n');
  assert.ok(sigStr.includes('login('), 'login should be present');
  assert.ok(sigStr.includes('logout('), 'logout should be present');
  assert.ok(sigStr.includes('static') && sigStr.includes('create('), 'static create should be present');
  assert.ok(!sigStr.includes('  if(') && !sigStr.includes('  if ('), 'no guard clauses');
});

console.log('\n--- typescript-guard-clauses ---');
console.log(`${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
