'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const assert = require('assert');

const ROOT = path.resolve(__dirname, '../..');

let passed = 0;
let failed = 0;
let skipped = 0;

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

function skip(name, reason) {
  console.log(`  SKIP  ${name}: ${reason}`);
  skipped++;
}

// Test Pattern Extractor
test('patterns extractor loads and returns array', () => {
  const ext = require(path.join(ROOT, 'src', 'extractors', 'patterns.js'));
  const sigs = ext.extract('const x = 1;');
  assert.ok(Array.isArray(sigs), 'extract() must return array');
});

test('patterns extractor detects DI containers', () => {
  const ext = require(path.join(ROOT, 'src', 'extractors', 'patterns.js'));
  const src = `
    class ServiceContainer {
      constructor() { this.services = {}; }
      register(name, factory) { this.services[name] = factory(); }
    }
  `;
  const sigs = ext.extract(src).join('\n');
  assert.ok(/di-container|ServiceContainer/i.test(sigs), `expected DI container, got: ${sigs}`);
});

test('patterns extractor detects service decorators', () => {
  const ext = require(path.join(ROOT, 'src', 'extractors', 'patterns.js'));
  const src = `
    @Injectable()
    export class UserService {
      constructor(private readonly repo: UserRepository) {}
      getUser(id) { return this.repo.findById(id); }
    }
  `;
  const sigs = ext.extract(src).join('\n');
  assert.ok(/service-decorated|Injectable|UserService/i.test(sigs), `expected service decorator, got: ${sigs}`);
});

test('patterns extractor detects DI injection patterns', () => {
  const ext = require(path.join(ROOT, 'src', 'extractors', 'patterns.js'));
  const src = `
    class OrderService {
      constructor(private readonly userRepo: UserRepository, 
                  private readonly db: Database) {
        // constructor injection
      }
    }
  `;
  const sigs = ext.extract(src).join('\n');
  assert.ok(/di-injection/i.test(sigs), `expected DI injection pattern, got: ${sigs}`);
});

test('patterns extractor detects repository pattern', () => {
  const ext = require(path.join(ROOT, 'src', 'extractors', 'patterns.js'));
  const src = `
    export class UserRepository {
      async find(id) { return await db.query('SELECT * FROM users WHERE id = ?', [id]); }
      async save(user) { return await db.query('INSERT INTO users ...', [user]); }
    }
  `;
  const sigs = ext.extract(src).join('\n');
  assert.ok(/repo|Repository/i.test(sigs), `expected repository pattern, got: ${sigs}`);
});

test('patterns extractor detects service layer', () => {
  const ext = require(path.join(ROOT, 'src', 'extractors', 'patterns.js'));
  const src = `
    export class AuthService {
      authenticate(username, password) { /* ... */ }
      validateToken(token) { /* ... */ }
    }
  `;
  const sigs = ext.extract(src).join('\n');
  assert.ok(/service|AuthService/i.test(sigs), `expected service layer, got: ${sigs}`);
});

test('patterns extractor detects unsafe patterns - null checks', () => {
  const ext = require(path.join(ROOT, 'src', 'extractors', 'patterns.js'));
  const src = `
    const result = user?.data?.email;
    if (!user) throw new Error('No user');
  `;
  const sigs = ext.extract(src).join('\n');
  assert.ok(/unsafe/i.test(sigs), `expected unsafe pattern detection, got: ${sigs}`);
});

test('patterns extractor detects controller/handler layer', () => {
  const ext = require(path.join(ROOT, 'src', 'extractors', 'patterns.js'));
  const src = `
    export class UserController {
      getUser(req, res) { res.json(req.params.id); }
      @Post
      createUser(req, res) { /* ... */ }
    }
  `;
  const sigs = ext.extract(src).join('\n');
  assert.ok(/controller|UserController/i.test(sigs), `expected controller pattern, got: ${sigs}`);
});

test('patterns extractor detects type linkage', () => {
  const ext = require(path.join(ROOT, 'src', 'extractors', 'patterns.js'));
  const src = `
    export interface IUserService {
      getUser(id: string): Promise<User>;
    }
    export class DefaultUserService implements IUserService {
      getUser(id: string) { return db.findUser(id); }
    }
  `;
  const sigs = ext.extract(src).join('\n');
  assert.ok(/type-impl|IUserService/i.test(sigs), `expected type linkage, got: ${sigs}`);
});

test('patterns extractor detects middleware presence', () => {
  const ext = require(path.join(ROOT, 'src', 'extractors', 'patterns.js'));
  const src = `
    app.use(cors());
    app.use(authMiddleware);
    app.get('/users', (req, res) => { res.json([]); });
  `;
  const sigs = ext.extract(src).join('\n');
  assert.ok(/middleware/i.test(sigs), `expected middleware detection, got: ${sigs}`);
});

console.log('');
console.log(`phase-d-patterns: ${passed} passed, ${failed} failed, ${skipped} skipped`);
if (failed > 0) process.exit(1);
