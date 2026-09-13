'use strict';

/**
 * NestJS route paths compose the `@Controller` prefix (#585).
 *
 * Route detection claims NestJS (config.md, `retrieval.surfaceEnrichment`),
 * but the prefix was never read: `@Controller('cats')` + `@Get(':id')` emitted
 * `:id`. A pseudo-signature of `route GET :id` matches nothing a user would
 * ask about, which defeats the point of the feature.
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const { collectRoutes } = require(path.join(ROOT, 'src/map/route-table'));

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  PASS  ${name}`); passed++; }
  catch (e) { console.log(`  FAIL  ${name}\n        ${e.message}`); failed++; }
}

/** Collect routes from one synthetic file. */
function routesFor(source, name = 'ctrl.ts') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-nest-'));
  const file = path.join(dir, name);
  fs.writeFileSync(file, source);
  return collectRoutes([file], dir);
}

test('composes the controller prefix with the method path', () => {
  const r = routesFor(`
@Controller('cats')
export class CatsController {
  @Get(':id') findOne() {}
}`);
  assert.deepStrictEqual(r.map((x) => `${x.method} ${x.path}`), ['GET /cats/:id']);
});

test('a decorator with no path yields the bare prefix', () => {
  const r = routesFor(`
@Controller('cats')
export class CatsController {
  @Post() create() {}
}`);
  assert.deepStrictEqual(r.map((x) => `${x.method} ${x.path}`), ['POST /cats']);
});

test('nested method paths are preserved under the prefix', () => {
  const r = routesFor(`
@Controller('cats')
export class CatsController {
  @Delete(':id/paws/:pawId') removePaw() {}
}`);
  assert.deepStrictEqual(r.map((x) => x.path), ['/cats/:id/paws/:pawId']);
});

test('a bare @Controller() adds no prefix', () => {
  const r = routesFor(`
@Controller()
export class RootController {
  @Get('health') health() {}
}`);
  assert.deepStrictEqual(r.map((x) => x.path), ['/health']);
});

test('stray slashes on either side collapse', () => {
  const r = routesFor(`
@Controller('/admin/')
export class AdminController {
  @Get('/users/') list() {}
}`);
  assert.deepStrictEqual(r.map((x) => x.path), ['/admin/users']);
});

test('each controller in a file gets its own prefix', () => {
  const r = routesFor(`
@Controller('cats')
export class CatsController {
  @Get(':id') findOne() {}
}
@Controller('dogs')
export class DogsController {
  @Get(':id') findOne() {}
}`);
  assert.deepStrictEqual(r.map((x) => x.path), ['/cats/:id', '/dogs/:id']);
});

test('a bare @Controller() with no path decorator yields root', () => {
  const r = routesFor(`
@Controller()
export class RootController {
  @Get() index() {}
}`);
  assert.deepStrictEqual(r.map((x) => x.path), ['/']);
});

test('Express routes in the same file are unaffected', () => {
  const r = routesFor(`
app.get('/users/:id', (req, res) => res.json({}));
@Controller('cats')
export class CatsController {
  @Get(':id') findOne() {}
}`, 'mixed.ts');
  const paths = r.map((x) => x.path).sort();
  assert.deepStrictEqual(paths, ['/cats/:id', '/users/:id']);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
