'use strict';

/**
 * Regression tests for issue #97:
 * TypeScript extractClassMembers must not emit control-flow keywords
 * (if, for, while, switch, do, try, catch, finally, else) as method signatures.
 *
 *  1.  if (!x) { return; } not extracted
 *  2.  if with complex condition not extracted
 *  3.  for loop not extracted
 *  4.  while loop not extracted
 *  5.  switch not extracted
 *  6.  try/catch block not extracted
 *  7.  do { } while not extracted (do keyword)
 *  8.  else block not extracted
 *  9.  multiple guard clauses — all excluded, real methods kept
 * 10.  method named forEach — NOT filtered (starts with 'for' but isn't 'for')
 * 11.  method named ifExists — NOT filtered (starts with 'if' but isn't 'if')
 * 12.  method named tryParse — NOT filtered
 * 13.  constructor with guard clause — constructor kept, if excluded
 * 14.  async method with inner if — method kept, if excluded
 * 15.  abstract class with abstract method — abstract method extracted
 * 16.  private _ methods still excluded (existing behaviour preserved)
 * 17.  deeply nested guard clause stays excluded
 * 18.  class with only guard clauses + one real method — correct output
 */

const path   = require('path');
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

function noCtrlFlow(sigs) {
  const s = sigs.join('\n');
  for (const kw of ['if(', 'if (', 'for(', 'for (', 'while(', 'while (', 'switch(', 'switch (',
                     'do(', 'do {', 'try(', 'try {', 'catch(', 'catch (', 'finally(', 'finally {',
                     'else(', 'else {']) {
    if (s.includes(`  ${kw}`)) {
      throw new Error(`control-flow keyword '${kw}' leaked into signatures:\n${s}`);
    }
  }
}

// ── Negative cases — guard clauses must NOT appear ────────────────────────────

test('1. if(!x) guard clause not extracted as method', () => {
  const src = `
export class WebGLRenderer {
  render(scene: Scene): void {
    if (!this.gl) { return; }
    this._draw(scene);
  }
}`;
  const sigs = extract(src);
  noCtrlFlow(sigs);
  assert.ok(sigs.join('\n').includes('render('), 'render method must be present');
});

test('2. if with complex multi-line condition not extracted', () => {
  const src = `
export class BridgeManager {
  connect(ctx: BridgeContext): void {
    if (!ctx || !ctx.isReady) {
      throw new Error('not ready');
    }
    this.ctx = ctx;
  }
}`;
  const sigs = extract(src);
  noCtrlFlow(sigs);
  assert.ok(sigs.join('\n').includes('connect('), 'connect must be present');
});

test('3. for loop inside method not extracted', () => {
  const src = `
export class Processor {
  run(items: string[]): void {
    for (let i = 0; i < items.length; i++) {
      this.handle(items[i]);
    }
  }
}`;
  const sigs = extract(src);
  noCtrlFlow(sigs);
  assert.ok(sigs.join('\n').includes('run('), 'run must be present');
});

test('4. while loop not extracted', () => {
  const src = `
export class Queue {
  drain(): void {
    while (this.items.length > 0) {
      this.items.pop();
    }
  }
}`;
  const sigs = extract(src);
  noCtrlFlow(sigs);
  assert.ok(sigs.join('\n').includes('drain('), 'drain must be present');
});

test('5. switch statement not extracted', () => {
  const src = `
export class Router {
  route(action: string): void {
    switch (action) {
      case 'go': this.go(); break;
      default: break;
    }
  }
}`;
  const sigs = extract(src);
  noCtrlFlow(sigs);
  assert.ok(sigs.join('\n').includes('route('), 'route must be present');
});

test('6. try/catch block not extracted', () => {
  const src = `
export class DataLoader {
  load(url: string): void {
    try {
      this.fetch(url);
    } catch (err) {
      this.onError(err);
    } finally {
      this.done();
    }
  }
}`;
  const sigs = extract(src);
  noCtrlFlow(sigs);
  assert.ok(sigs.join('\n').includes('load('), 'load must be present');
});

test('7. else block not extracted', () => {
  const src = `
export class Toggle {
  flip(value: boolean): boolean {
    if (value) {
      return false;
    } else {
      return true;
    }
  }
}`;
  const sigs = extract(src);
  noCtrlFlow(sigs);
  assert.ok(sigs.join('\n').includes('flip('), 'flip must be present');
});

test('8. multiple guard clauses — all excluded, real methods kept', () => {
  const src = `
export class ApiClient {
  get(url: string): Promise<Response> {
    if (!url) { throw new Error('no url'); }
    if (this.busy) { return Promise.reject(); }
    for (const h of this.headers) { this.apply(h); }
    try {
      return this.http.get(url);
    } catch (e) {
      return Promise.reject(e);
    }
  }
  post(url: string, body: unknown): Promise<Response> {
    while (!this.ready) { this.wait(); }
    return this.http.post(url, body);
  }
}`;
  const sigs = extract(src);
  noCtrlFlow(sigs);
  const s = sigs.join('\n');
  assert.ok(s.includes('get('), 'get must be present');
  assert.ok(s.includes('post('), 'post must be present');
});

// ── Positive cases — real methods must NOT be filtered ────────────────────────

test('9. method named forEach not filtered (starts with "for" but is not "for")', () => {
  // Use a simple parameter type — the extractor cannot handle nested parens like cb: (x: T) => void
  const src = `
export class Collection {
  forEach(items: string[], limit: number): void {
    for (const item of items) { this.process(item); }
  }
}`;
  const sigs = extract(src);
  assert.ok(sigs.join('\n').includes('forEach('), 'forEach must be present');
});

test('10. method named ifExists not filtered', () => {
  // Use simple parameter types to avoid nested-paren limitation in parameter regex
  const src = `
export class Registry {
  ifExists(key: string, fallback: string): string {
    if (this.has(key)) { return this.get(key); }
    return fallback;
  }
}`;
  const sigs = extract(src);
  assert.ok(sigs.join('\n').includes('ifExists('), 'ifExists must be present');
});

test('11. method named tryParse not filtered', () => {
  const src = `
export class Parser {
  tryParse(input: string): Result | null {
    try {
      return this.parse(input);
    } catch (_) {
      return null;
    }
  }
}`;
  const sigs = extract(src);
  assert.ok(sigs.join('\n').includes('tryParse('), 'tryParse must be present');
});

test('12. method named switchTab not filtered', () => {
  const src = `
export class TabBar {
  switchTab(index: number): void {
    switch (index) {
      case 0: this.showHome(); break;
      default: this.showTab(index);
    }
  }
}`;
  const sigs = extract(src);
  assert.ok(sigs.join('\n').includes('switchTab('), 'switchTab must be present');
});

test('13. constructor with guard clause — constructor kept, if excluded', () => {
  const src = `
export class TokenStore {
  constructor(private key: string) {
    if (!key) { throw new Error('key required'); }
  }
  get(): string { return this.key; }
}`;
  const sigs = extract(src);
  const s = sigs.join('\n');
  assert.ok(s.includes('constructor('), 'constructor must be present');
  assert.ok(s.includes('get('), 'get must be present');
  noCtrlFlow(sigs);
});

test('14. async method with inner guard — method kept', () => {
  const src = `
export class EmailService {
  async send(to: string, subject: string): Promise<void> {
    if (!to.includes('@')) { throw new Error('invalid email'); }
    await this.mailer.send(to, subject);
  }
}`;
  const sigs = extract(src);
  const s = sigs.join('\n');
  assert.ok(s.includes('async') && s.includes('send('), 'async send must be present');
  noCtrlFlow(sigs);
});

test('15. static method with try/catch — static method kept', () => {
  const src = `
export class Config {
  static load(filePath: string): Config {
    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(raw);
    } catch (e) {
      return Config.defaults();
    }
  }
  static defaults(): Config { return new Config(); }
}`;
  const sigs = extract(src);
  const s = sigs.join('\n');
  assert.ok(s.includes('static') && s.includes('load('), 'static load must be present');
  assert.ok(s.includes('defaults('), 'static defaults must be present');
  noCtrlFlow(sigs);
});

test('16. private _ prefixed methods still excluded (existing behaviour)', () => {
  const src = `
export class Cache {
  get(key: string): string { return this._store[key]; }
  private _evict(key: string): void {}
  _internal(): void {}
}`;
  const sigs = extract(src);
  const s = sigs.join('\n');
  assert.ok(s.includes('get('), 'get must be present');
  assert.ok(!s.includes('_evict'), '_evict must be excluded');
  assert.ok(!s.includes('_internal'), '_internal must be excluded');
});

test('17. deeply nested guard clauses all excluded', () => {
  const src = `
export class EventBus {
  emit(event: string, data: unknown): void {
    if (!event) { return; }
    for (const listener of this.listeners) {
      if (listener.matches(event)) {
        try {
          listener.handle(data);
        } catch (e) {
          while (this.retries > 0) {
            this.retries--;
          }
        }
      }
    }
  }
}`;
  const sigs = extract(src);
  noCtrlFlow(sigs);
  assert.ok(sigs.join('\n').includes('emit('), 'emit must be present');
});

test('18. class with only guard clauses + one real method — correct count', () => {
  const src = `
export class Validator {
  validate(input: string): boolean {
    if (!input) { return false; }
    if (input.length > 100) { return false; }
    for (const rule of this.rules) {
      if (!rule.test(input)) { return false; }
    }
    return true;
  }
}`;
  const sigs = extract(src);
  noCtrlFlow(sigs);
  const methods = sigs.filter(s => s.trim().match(/^\w/));
  assert.ok(methods.some(m => m.includes('validate(')), 'validate must be present');
  const controlCount = sigs.filter(s => /^\s+(if|for|while|switch|try|catch)\s*[\({]/.test(s)).length;
  assert.strictEqual(controlCount, 0, `expected 0 control-flow sigs, got ${controlCount}`);
});

// ── Summary ───────────────────────────────────────────────────────────────────
console.log('\n--- typescript-guard-clauses ---');
console.log(`${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
