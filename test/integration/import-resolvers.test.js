'use strict';

/**
 * Import resolvers added in #980: C/C++/Objective-C, PHP, C#, Dart, Vue/Svelte/Astro, Lua
 * and GDScript at file level, Swift at module level.
 *
 * Every case has a known answer. The rule they all keep is precision first: an import that
 * cannot be resolved to exactly one file of the repository yields no edge (an external
 * package, a system header, a commented-out import, an ambiguous name, a path built at run
 * time), and what a language does not count as an import is not an edge. The last section
 * pins what must NOT change: the ranker is still handed the original eight families, so a
 * better blast-radius graph cannot move retrieval.
 *
 * Run: node test/integration/import-resolvers.test.js
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const GEN = path.join(ROOT, 'gen-context.js');
const { buildFromCwd, buildRankingGraph, GRAPH_FAMILIES, GRAPH_EXTS, LEGACY_EXTS } = require('../../src/graph/builder');

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  PASS  ${name}`); passed++; }
  catch (e) { console.log(`  FAIL  ${name}\n        ${e.message}`); failed++; }
}

const made = [];
/** A temp repository holding `files` ({ rel: text }). */
function repo(files, tag = 'r') {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), `sigmap-imports-${tag}-`)));
  made.push(root);
  for (const [rel, body] of Object.entries(files)) {
    const abs = path.join(root, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, body);
  }
  return root;
}
const build = (root, opts) => buildFromCwd(root, Object.assign({ srcDirs: ['.'] }, opts));
const show = (g, root, key) => path.relative(root, g.realPaths.get(key) || key).replace(/\\/g, '/');
/** Sorted "from -> to" lines for every edge of the graph. */
function edges(root, opts) {
  const g = build(root, opts);
  const out = [];
  for (const [from, tos] of g.forward) for (const to of tos) out.push(`${show(g, root, from)} -> ${show(g, root, to)}`);
  return out.sort();
}
/** The files one file imports. */
function importsOf(root, rel, opts) {
  const g = build(root, opts);
  return (g.forward.get(path.join(root, rel).toLowerCase()) || []).map((k) => show(g, root, k)).sort();
}
const importersOf = (root, rel, opts) => {
  const g = build(root, opts);
  return (g.reverse.get(path.join(root, rel).toLowerCase()) || []).map((k) => show(g, root, k)).sort();
};

// ── the list ───────────────────────────────────────────────────────────────

test('the import graph reads fifteen families; Swift is not one of them', () => {
  assert.strictEqual(GRAPH_FAMILIES.length, 15);
  assert.deepStrictEqual(GRAPH_FAMILIES.slice(8).map((f) => f[0]), ['C/C++/Objective-C', 'PHP', 'C#', 'Dart', 'Vue/Svelte/Astro', 'Lua', 'GDScript']);
  assert.ok(!GRAPH_EXTS.has('.swift'), 'Swift has no file-level edges, so it is not walked');
  for (const e of ['.php', '.cs', '.dart', '.vue', '.svelte', '.astro', '.lua', '.gd', '.c', '.h', '.cpp', '.hpp', '.m', '.mm']) assert.ok(GRAPH_EXTS.has(e), e);
  for (const e of ['.php', '.cs', '.dart', '.vue', '.lua', '.gd', '.c', '.h']) assert.ok(!LEGACY_EXTS.has(e), `${e} is not one of the original eight`);
  assert.strictEqual(LEGACY_EXTS.size, 21, 'the original eight families are unchanged');
});

// ── C / C++ / Objective-C ──────────────────────────────────────────────────

test('C: quoted includes resolve next to the file, up a directory and through include/; comments and system headers do not', () => {
  const root = repo({
    'src/a.c': ['#include "b.h"', '#include "../include/lib/x.h"', '#include <lib/x.h>', '#include <stdio.h>', '#include <vector>',
      '// #include "c.h"', '/* #include "d.h" */', '/*', '#include "f.h"', '*/', '#  include   "e.h"', '#include a_macro', '#include <../src/g.h>'].join('\n'),
    'src/b.h': '#pragma once\n',
    'src/c.h': '', 'src/d.h': '', 'src/e.h': '', 'src/f.h': '', 'src/g.h': '',
    'include/lib/x.h': '#pragma once\n',
  });
  assert.deepStrictEqual(importsOf(root, 'src/a.c'), ['include/lib/x.h', 'src/b.h', 'src/e.h']);
});

test('C++: a header-only library includes its own headers with angle brackets, and those resolve through include/', () => {
  const root = repo({
    'include/spdlog/spdlog.h': '#include <spdlog/common.h>\n#include <spdlog/details/os.h>\n#include <string>\n',
    'include/spdlog/common.h': '',
    'include/spdlog/details/os.h': '#include <spdlog/common.h>\n',
    'test/t.cpp': '#include <spdlog/spdlog.h>\n',
  });
  assert.deepStrictEqual(importsOf(root, 'include/spdlog/spdlog.h'), ['include/spdlog/common.h', 'include/spdlog/details/os.h']);
  assert.deepStrictEqual(importsOf(root, 'include/spdlog/details/os.h'), ['include/spdlog/common.h']);
  assert.deepStrictEqual(importsOf(root, 'test/t.cpp'), ['include/spdlog/spdlog.h']);
});

test('C: an angle-bracket include is never answered by a repository file of a system name; a quoted one is', () => {
  const root = repo({
    'src/string.h': '', 'src/config.h': '',
    'src/a.c': '#include <string.h>\n#include <config.h>\n#include "string.h"\n',
  });
  assert.deepStrictEqual(importsOf(root, 'src/a.c'), ['src/string.h'], 'only the quoted form reaches src/string.h');
});

test('C: a path with a directory part resolves by a unique suffix, and two candidates are ambiguous', () => {
  const root = repo({
    'src/x.c': '#include "uv/unix.h"\n#include "dup/x.h"\n',
    'third_party/uv/unix.h': '',
    'a/dup/x.h': '', 'b/dup/x.h': '',
  });
  assert.deepStrictEqual(importsOf(root, 'src/x.c'), ['third_party/uv/unix.h']);
});

test('Objective-C: #import resolves like #include, and a file never includes itself', () => {
  const root = repo({
    'App/View.m': '#import "View.h"\n#import <Foundation/Foundation.h>\n#include "View.m"\n',
    'App/View.h': '#import "Model.h"\n',
    'App/Model.h': '',
  });
  assert.deepStrictEqual(importsOf(root, 'App/View.m'), ['App/View.h']);
  assert.deepStrictEqual(importsOf(root, 'App/View.h'), ['App/Model.h']);
});

// ── PHP ────────────────────────────────────────────────────────────────────

const COMPOSER = JSON.stringify({
  autoload: { 'psr-4': { 'App\\': 'app/', 'App\\Support\\': ['lib/a/', 'lib/b/'] } },
  'autoload-dev': { 'psr-4': { 'App\\Tests\\': 'tests/' } },
});

test('PHP: psr-4 tries every matching prefix, longest first, in every directory (the Laravel shape)', () => {
  const root = repo({
    'composer.json': COMPOSER,
    'app/Models/User.php': '<?php\nnamespace App\\Models;\nclass User {}\n',
    'lib/a/Str.php': '<?php\nnamespace App\\Support;\nclass Str {}\n',
    'lib/b/Arr.php': '<?php\nnamespace App\\Support;\nclass Arr {}\n',
    'app/Support/Str.php': '<?php\nnamespace App\\Support;\nclass Str {}\n',
    'app/Support/Only.php': '<?php\nclass Only {}\n', // declares no namespace: only the psr-4 path can reach it
    'app/Models/Concerns.php': '<?php\nclass Concerns {}\n', 'app/Models/Hidden.php': '<?php\nclass Hidden {}\n',
    'tests/Helper.php': '<?php\nclass Helper {}\n',   // reachable only through autoload-dev
    'tests/UserTest.php': '<?php\nnamespace App\\Tests;\nuse App\\Models\\User;\nuse App\\Tests\\Helper;\nclass UserTest {}\n',
    'app/Http/Controller.php': ['<?php', 'namespace App\\Http;', 'use App\\Models\\User;', 'use \\App\\Support\\Str;', 'use App\\Support\\{Arr, Only as O};',
      'use function App\\Support\\helper;', 'use const App\\FLAG;', 'use Vendor\\Pkg\\Thing;', 'use App\\Missing\\Nope;',
      '// use App\\Tests\\UserTest;', '/*', 'use App\\Models\\Hidden;', '*/', 'class Controller {', '    use App\\Models\\Concerns;', '    function f() { return function () use ($x) {}; }', '}'].join('\n'),
  });
  assert.deepStrictEqual(importsOf(root, 'app/Http/Controller.php'), ['app/Models/User.php', 'app/Support/Only.php', 'lib/a/Str.php', 'lib/b/Arr.php']);
  assert.deepStrictEqual(importsOf(root, 'tests/UserTest.php'), ['app/Models/User.php', 'tests/Helper.php'], 'autoload-dev is read too');
});

test('PHP: the Laravel Str.php case lists its importers, the same files grep finds', () => {
  const files = { 'composer.json': JSON.stringify({ autoload: { 'psr-4': { 'Illuminate\\': 'src/Illuminate/' } } }), 'src/Illuminate/Support/Str.php': '<?php\nnamespace Illuminate\\Support;\nclass Str {}\n' };
  const importers = ['src/Illuminate/Mail/Mailer.php', 'src/Illuminate/Http/Request.php', 'app/Http/Controllers/PostController.php'];
  for (const rel of importers) files[rel] = `<?php\nnamespace App;\n\nuse Illuminate\\Support\\Str;\n\nclass ${path.basename(rel, '.php')} {}\n`;
  files['src/Illuminate/Http/Other.php'] = '<?php\nnamespace App;\nuse Illuminate\\Support\\Arr;\nclass Other {}\n';
  const root = repo(files);
  assert.deepStrictEqual(importersOf(root, 'src/Illuminate/Support/Str.php'), importers.slice().sort());
  const cli = spawnSync(process.execPath, [GEN, '--impact', 'src/Illuminate/Support/Str.php', '--json'], { cwd: root, encoding: 'utf8' });
  const j = JSON.parse(cli.stdout);
  assert.deepStrictEqual(j.direct.slice().sort(), importers.slice().sort());
  assert.strictEqual('graph' in j, false, 'PHP is read now, so an answer is not marked "not tracked"');
});

test('PHP: with no composer mapping a class is found by its declaration, case-insensitively; two declarations are ambiguous', () => {
  const root = repo({
    'src/Models/User.php': '<?php\nnamespace Acme\\Models;\n\nfinal class User {}\n',
    'src/Models/Twin.php': '<?php\nnamespace Acme\\Models;\nclass Twin {}\n',
    'src/Old/Twin.php': '<?php\nnamespace Acme\\Models;\nclass Twin {}\n',
    'src/Svc.php': '<?php\nnamespace Acme;\nuse Acme\\Models\\user;\nuse Acme\\Models\\Twin;\nuse Acme\\Models\\Absent;\nclass Svc {}\n',
  });
  assert.deepStrictEqual(importsOf(root, 'src/Svc.php'), ['src/Models/User.php']);
});

test('PHP: literal require/include resolve; a variable path does not', () => {
  const root = repo({
    'index.php': ["<?php", "require __DIR__ . '/inc/h.php';", "include 'x/y.php';", "require_once dirname(__FILE__) . '/inc/z.php';", "include($dyn . '/q.php');", "require './inc/rel.php';", "require 'vendor/autoload.php';", 'include "inc/$name.php";'].join('\n'),
    'inc/h.php': '', 'inc/z.php': '', 'inc/rel.php': '', 'x/y.php': '', 'inc/$name.php': '',   // a file literally called $name.php: an interpolated path never reaches it
  });
  assert.deepStrictEqual(importsOf(root, 'index.php'), ['inc/h.php', 'inc/rel.php', 'inc/z.php', 'x/y.php']);
});

test('PHP: a changed composer.json is read again', () => {
  const root = repo({ 'composer.json': JSON.stringify({ autoload: { 'psr-4': { 'A\\': 'one/' } } }), 'one/X.php': '<?php\nnamespace A;\nclass X {}\n', 'two/Y.php': '<?php\nnamespace B;\nclass Y {}\n', 'm.php': '<?php\nuse A\\X;\nuse B\\Y;\n' });
  // the declarations would resolve both, so make the second one resolvable ONLY through the map
  fs.writeFileSync(path.join(root, 'two/Y.php'), '<?php\nclass Elsewhere {}\n');
  assert.deepStrictEqual(importsOf(root, 'm.php'), ['one/X.php']);
  const file = path.join(root, 'composer.json');
  fs.writeFileSync(file, JSON.stringify({ autoload: { 'psr-4': { 'A\\': 'one/', 'B\\': 'two/' } } }));
  const later = new Date(Date.now() + 5000);
  fs.utimesSync(file, later, later);
  assert.deepStrictEqual(importsOf(root, 'm.php'), ['one/X.php', 'two/Y.php']);
});

// ── C# ─────────────────────────────────────────────────────────────────────

const CS = {
  'src/Lib.csproj': '<Project/>',
  'src/Events/LogEvent.cs': 'namespace Lib.Events\n{\n    public class LogEvent { }\n}\n',
  'src/Events/Level.cs': 'namespace Lib.Events;\n\npublic enum Level { Info }\n',
  'src/Core/Logger.cs': 'using Lib.Core;\nnamespace Lib.Core;\npublic class Logger { Logger next; }\n',   // imports its own namespace and names its own type: no self edge
  'src/Core/SinkA.cs': 'namespace Lib.Core\n{\n    public partial class Sink { }\n}\n',
  'src/Core/SinkB.cs': 'namespace Lib.Core\n{\n    public partial class Sink { }\n}\n',
  'src/Core/Outer.cs': 'namespace Lib.Core\n{\n    public class Outer\n    {\n        public class Inner { }\n    }\n}\n',
  'src/Core/Util.cs': 'namespace Lib.Core;\npublic static class Util { }\n',
  'src/Deep.cs': 'namespace Lib\n{\n    namespace Deep\n    {\n        public class DeepType { }\n    }\n}\n',
};

test('C#: a using links to the files declaring the types the importing file names, not to the whole namespace', () => {
  const root = repo(Object.assign({}, CS, {
    'src/App/P.cs': 'using System;\nusing Lib.Events;\nnamespace App;\nclass P { LogEvent e; }\n',
    'src/App/NoMention.cs': 'using Lib.Events;\nnamespace App;\nclass N { int x; }\n',
    'src/App/NoUsing.cs': 'namespace App;\nclass M { LogEvent e; }\n',
    'src/App/InComment.cs': 'using Lib.Events;\nnamespace App;\n// LogEvent\n/* Level */\nclass C { string s = "LogEvent"; }\n',
  }));
  assert.deepStrictEqual(importsOf(root, 'src/App/P.cs'), ['src/Events/LogEvent.cs']);
  assert.deepStrictEqual(importsOf(root, 'src/App/NoMention.cs'), [], 'importing a namespace is not using its types');
  assert.deepStrictEqual(importsOf(root, 'src/App/NoUsing.cs'), [], 'a type of an unimported namespace is not an import');
  assert.deepStrictEqual(importsOf(root, 'src/App/InComment.cs'), [], 'a name in a comment or a string is not a mention');
  assert.deepStrictEqual(importsOf(root, 'src/Core/Logger.cs'), [], 'a file that imports its own namespace and names its own type does not import itself');
});

test('C#: a partial type links to all its parts, a nested type does not link its outer, a nested namespace is read', () => {
  const root = repo(Object.assign({}, CS, {
    'src/App/A.cs': 'using Lib.Core;\nnamespace App;\nclass A { Sink s; }\n',
    'src/App/B.cs': 'using Lib.Core;\nnamespace App;\nclass B { Inner i; }\n',
    'src/App/C.cs': 'using Lib.Deep;\nnamespace App;\nclass C { DeepType d; }\n',
  }));
  assert.deepStrictEqual(importsOf(root, 'src/App/A.cs'), ['src/Core/SinkA.cs', 'src/Core/SinkB.cs']);
  assert.deepStrictEqual(importsOf(root, 'src/App/B.cs'), [], 'Inner is nested in Outer, not declared at namespace level');
  assert.deepStrictEqual(importsOf(root, 'src/App/C.cs'), ['src/Deep.cs']);
});

test('C#: using static and an alias name a type directly; global using applies to its project only', () => {
  const root = repo(Object.assign({}, CS, {
    'src/App/S.cs': 'using static Lib.Core.Util;\nnamespace App;\nclass S { }\n',
    'src/App/Al.cs': 'using L = Lib.Core.Logger;\nnamespace App;\nclass Al { }\n',
    'src/GlobalUsings.cs': 'global using Lib.Events;\n',
    'src/App/G.cs': 'namespace App;\nclass G { LogEvent e; }\n',
    'other/Other.csproj': '<Project/>',
    'other/Y.cs': 'namespace Other;\nclass Y { LogEvent e; }\n',
    'src/Core/Self.cs': 'using Me = Lib.Core.Self;\nnamespace Lib.Core;\nclass Self { }\n',
  }));
  assert.deepStrictEqual(importsOf(root, 'src/Core/Self.cs'), [], 'an alias of a type the file declares itself is not an edge to itself');
  assert.deepStrictEqual(importsOf(root, 'src/App/S.cs'), ['src/Core/Util.cs']);
  assert.deepStrictEqual(importsOf(root, 'src/App/Al.cs'), ['src/Core/Logger.cs']);
  assert.deepStrictEqual(importsOf(root, 'src/App/G.cs'), ['src/Events/LogEvent.cs'], 'a global using of the same project');
  assert.deepStrictEqual(importsOf(root, 'other/Y.cs'), [], 'a global using of another project does not reach this one');
});

// ── Dart ───────────────────────────────────────────────────────────────────

test('Dart: relative, package:, part, part of and every target of a conditional import; dart:, missing and commented are not edges', () => {
  const root = repo({
    'pubspec.yaml': 'name: app_pkg\nversion: 1.0.0\n',
    'packages/other/pubspec.yaml': "name: 'other_pkg'\n",
    'packages/other/lib/o.dart': '',
    'lib/a.dart': ["import 'b.dart';", "import 'package:app_pkg/c.dart' as c;", "import 'package:other_pkg/o.dart';", "import 'dart:async';", "import 'package:flutter/material.dart';",
      "import 'missing.dart';", "export 'src/d.dart' show D;", "part 'a.g.dart';", "import 'e.dart'", "    if (dart.library.io) 'e_io.dart';", "// import 'x.dart';", "/* import 'y.dart'; */"].join('\n'),
    'lib/b.dart': '', 'lib/c.dart': '', 'lib/src/d.dart': '', 'lib/e.dart': '', 'lib/e_io.dart': '', 'lib/x.dart': '', 'lib/y.dart': '',
    'lib/a.g.dart': "part of 'a.dart';\n",
  });
  assert.deepStrictEqual(importsOf(root, 'lib/a.dart'), ['lib/a.g.dart', 'lib/b.dart', 'lib/c.dart', 'lib/e.dart', 'lib/e_io.dart', 'lib/src/d.dart', 'packages/other/lib/o.dart']);
  assert.deepStrictEqual(importsOf(root, 'lib/a.g.dart'), ['lib/a.dart'], 'part of points back at the library');
});

// ── Vue / Svelte / Astro ───────────────────────────────────────────────────

test('Vue: the imports of every <script> block resolve like a script\'s; the template, styles and tags do not', () => {
  const root = repo({
    'tsconfig.json': JSON.stringify({ compilerOptions: { baseUrl: '.', paths: { '@/*': ['src/*'] } } }),
    'src/App.vue': ['<template>', '  <Child />', '  <!-- import Fake from \'./Fake.vue\' -->', '<pre>', "import Fake from './Fake.vue'", '</pre>', '</template>',
      '<script setup lang="ts">', "import Child from './Child.vue'", "import { x } from './util'", "import { y } from '@/lib/y'", "import { ref } from 'vue'", '</script>',
      '<script>', "import Plain from './Plain.vue'", '</script>', "<style>@import './s.css';</style>"].join('\n'),
    'src/Child.vue': '<template><div/></template>\n', 'src/Plain.vue': '', 'src/Fake.vue': '', 'src/util.ts': '', 'src/lib/y.ts': '', 'src/s.css': '',
    'src/main.ts': "import App from './App.vue'\nimport Child from './Child'\n",
  });
  // './Child' (no extension) is not guessed to mean Child.vue: a bundler does not unless it is configured to
  assert.deepStrictEqual(importsOf(root, 'src/App.vue'), ['src/Child.vue', 'src/Plain.vue', 'src/lib/y.ts', 'src/util.ts']);
  assert.deepStrictEqual(importersOf(root, 'src/Child.vue'), ['src/App.vue'], 'only the import that names the extension reaches the component');
  assert.deepStrictEqual(importsOf(root, 'src/main.ts'), ['src/App.vue'], 'a .ts file importing a component by its file name');
});

test('Svelte: instance and module scripts are read, and $lib reaches src/lib', () => {
  const root = repo({
    'src/lib/b.js': '', 'src/lib/Card.svelte': '', 'src/routes/Child.svelte': '',
    'src/routes/+page.svelte': "<script module>\nimport Child from './Child.svelte'\n</script>\n<script lang=ts>\nimport { b } from '$lib/b.js'\nimport Card from '$lib/Card.svelte'\nimport 'svelte/store'\n</script>\n<Child />\n",
  });
  assert.deepStrictEqual(importsOf(root, 'src/routes/+page.svelte'), ['src/lib/Card.svelte', 'src/lib/b.js', 'src/routes/Child.svelte']);
});

test('Astro: the frontmatter fence and the <script> tags are read; virtual modules are not edges', () => {
  const root = repo({
    'src/layouts/L.astro': '', 'src/client.ts': '', 'src/Counter.jsx': '',
    'src/pages/index.astro': "---\nimport Layout from '../layouts/L.astro';\nimport Counter from '../Counter.jsx';\nimport { Image } from 'astro:assets';\n---\n<Layout><Counter client:load /></Layout>\n<script>\nimport '../client.ts';\n</script>\n",
  });
  assert.deepStrictEqual(importsOf(root, 'src/pages/index.astro'), ['src/Counter.jsx', 'src/client.ts', 'src/layouts/L.astro']);
});

// ── Lua ────────────────────────────────────────────────────────────────────

test('Lua: require in every spelling resolves under the ancestors and lua/; long comments, run-time names and unknown modules do not', () => {
  const root = repo({
    'lua/mod/init.lua': '', 'lua/mod/b.lua': '', 'lua/mod/c.lua': '', 'lua/mod/d.lua': '', 'data/f.lua': '', 'lua/mod/e.lua': '',
    'lua/mod/a.lua': ['local b = require("mod.b")', "local i = require 'mod'", 'local v = require("vim")', '-- require("mod.c")', '--[[ require("mod.d") ]]',
      '--[==[', 'require("mod.d")', ']==]', 'pcall(require, "mod.e")', 'local n = require(name)', 'dofile("data/f.lua")'].join('\n'),
    'tests/spec.lua': 'require("mod.a")\nrequire "mod.b"\n',
  });
  assert.deepStrictEqual(importsOf(root, 'lua/mod/a.lua'), ['data/f.lua', 'lua/mod/b.lua', 'lua/mod/e.lua', 'lua/mod/init.lua']);
  assert.deepStrictEqual(importsOf(root, 'tests/spec.lua'), ['lua/mod/a.lua', 'lua/mod/b.lua']);
});

// ── GDScript ───────────────────────────────────────────────────────────────

test('GDScript: res:// is the nearest project, scenes are not nodes, class_name resolves inside its project and is not ambiguous', () => {
  const root = repo({
    'proj1/project.godot': '', 'proj2/project.godot': '',
    'proj1/base/entity.gd': 'class_name Entity\nextends Node\n',
    'proj1/enemy.gd': 'class_name Enemy\nextends Entity\n',
    'proj1/twin_a.gd': 'class_name Twin\nextends Node\n', 'proj1/twin_b.gd': 'class_name Twin\nextends Node\n',
    'proj1/bullet.gd': 'extends Node\n', 'proj2/bullet.gd': 'class_name Bullet\nextends Node\n',
    'proj1/player.gd': ['extends "res://base/entity.gd"', 'const B = preload("res://bullet.gd")', 'var S = preload("res://scene.tscn")', 'var M = load("res://missing.gd")',
      'var R = load("base/entity.gd")', '# var C = preload("res://enemy.gd")', 'var P = preload(path_var)'].join('\n'),
    'proj1/user.gd': 'extends Twin\n',
    'proj1/cross.gd': 'extends Bullet\n',
    'proj1/scene.tscn': '',
  });
  assert.deepStrictEqual(importsOf(root, 'proj1/player.gd'), ['proj1/base/entity.gd', 'proj1/bullet.gd']);
  assert.deepStrictEqual(importsOf(root, 'proj1/enemy.gd'), ['proj1/base/entity.gd'], 'extends a class_name of the same project');
  assert.deepStrictEqual(importsOf(root, 'proj1/user.gd'), [], 'two scripts declare class_name Twin: ambiguous');
  assert.deepStrictEqual(importsOf(root, 'proj1/cross.gd'), [], 'a class_name of another project is not visible');
});

// ── Swift: module level only ───────────────────────────────────────────────

const PACKAGE = [
  '// swift-tools-version:5.9', 'import PackageDescription', 'let package = Package(name: "Pkg", targets: [',
  '    .target(name: "Core"),', '    .executableTarget(name: "App", dependencies: ["Core"]),',
  '    .target(name: "Net", path: "Libs/Net"),', '    .testTarget(name: "CoreTests", dependencies: ["Core"]),', '])',
].join('\n');

test('Swift: a file\'s module and the files in other targets that import it; no file-level edge is drawn', () => {
  const { moduleImpact } = require('../../src/graph/swift-modules');
  const root = repo({
    'Package.swift': PACKAGE,
    'Sources/Core/Core.swift': 'public struct Core {}\n', 'Sources/Core/Inner.swift': 'import Foundation\nimport Core\nstruct Inner { let c = Core() }\n',
    'Sources/App/main.swift': 'import Foundation\nimport Core\nprint(Core())\n',
    'Libs/Net/Net.swift': '@testable import Core\n',
    'Tests/CoreTests/CoreTests.swift': '@testable import Core\nimport XCTest\n',
    'Sources/App/Other.swift': 'import struct Core.Core\n',
    'Sources/App/NotCore.swift': 'import CoreFoundation\n',
  });
  const m = moduleImpact(root, path.join(root, 'Sources/Core/Core.swift'));
  assert.strictEqual(m.module, 'Core');
  assert.strictEqual(m.dir, 'Sources/Core');
  assert.deepStrictEqual(m.importers, ['Libs/Net/Net.swift', 'Sources/App/Other.swift', 'Sources/App/main.swift', 'Tests/CoreTests/CoreTests.swift'], 'same-target files and CoreFoundation are not importers');
  assert.strictEqual(moduleImpact(root, path.join(root, 'Libs/Net/Net.swift')).module, 'Net', 'a target with a path: is found');
  assert.deepStrictEqual(moduleImpact(root, path.join(root, 'Libs/Net/Net.swift')).importers, []);
  assert.deepStrictEqual(edges(root), [], 'Swift contributes no file-level edge');
  assert.strictEqual(require('../../src/graph/swift-modules').swiftFiles(root).length, 8);
});

test('Swift: --impact keeps the "not tracked" answer and adds the module-level importers; with no Package.swift it adds nothing', () => {
  const root = repo({
    'Package.swift': PACKAGE, 'Sources/Core/Core.swift': 'public struct Core {}\n', 'Sources/App/main.swift': 'import Core\n',
  });
  const j = JSON.parse(spawnSync(process.execPath, [GEN, '--impact', 'Sources/Core/Core.swift', '--json'], { cwd: root, encoding: 'utf8' }).stdout);
  assert.strictEqual(j.graph, 'unsupported-language');
  assert.strictEqual(j.language, 'Swift');
  assert.strictEqual(j.totalImpact, 0);
  assert.deepStrictEqual(j.module, { module: 'Core', kind: 'target', dir: 'Sources/Core', importers: ['Sources/App/main.swift'] });
  const text = spawnSync(process.execPath, [GEN, '--impact', 'Sources/Core/Core.swift'], { cwd: root, encoding: 'utf8' }).stdout;
  assert.ok(text.includes('Swift imports are not tracked') && text.includes('Module-level importers') && text.includes('Sources/App/main.swift'), text);
  assert.ok(!text.includes('No importers found'), text);

  const bare = repo({ 'Sources/X/X.swift': 'struct X {}\n', 'Sources/Y/Y.swift': 'import X\n' });
  const b = JSON.parse(spawnSync(process.execPath, [GEN, '--impact', 'Sources/X/X.swift', '--json'], { cwd: bare, encoding: 'utf8' }).stdout);
  assert.strictEqual(b.graph, 'unsupported-language');
  assert.strictEqual('module' in b, false, 'no Package.swift, no module structure');
});

// ── what must not change ───────────────────────────────────────────────────

test('the ranker is handed only the original eight families: same files, same edges, no new node', () => {
  const root = repo({
    'src/a.js': "const b = require('./b')\n", 'src/b.js': '',
    'src/m.php': '<?php\nuse A\\B;\n', 'src/B.php': '<?php\nnamespace A;\nclass B {}\n',
    'src/x.c': '#include "x.h"\n', 'src/x.h': '',
    'src/c.vue': "<script>import './d.vue'</script>", 'src/d.vue': '',
  });
  const ranking = buildRankingGraph(root);
  const legacy = buildFromCwd(root, { srcDirs: ['src', 'app', 'lib', 'R', 'inst'], families: 'legacy' });
  const full = buildFromCwd(root, { srcDirs: ['src'] });
  const keys = (g) => [...g.forward.keys()].map((k) => path.basename(k)).sort();
  assert.deepStrictEqual(keys(ranking), ['a.js', 'b.js'], 'no PHP, C or component file is a node of the ranker\'s graph');
  assert.deepStrictEqual(keys(ranking), keys(legacy));
  assert.deepStrictEqual(keys(full), ['B.php', 'a.js', 'b.js', 'c.vue', 'd.vue', 'm.php', 'x.c', 'x.h'].map((x) => x.toLowerCase()).sort());
  assert.strictEqual([...ranking.forward.values()].reduce((n, v) => n + v.length, 0), 1);
  assert.strictEqual([...full.forward.values()].reduce((n, v) => n + v.length, 0), 4);
  assert.strictEqual(buildRankingGraph(root, { families: 'all' }).forward.size, full.forward.size === 8 ? 8 : full.forward.size, 'the experiment switch reads everything');
});

test('SvelteKit\'s $lib is resolved by the extended graph and not by the ranker\'s', () => {
  const root = repo({ 'src/lib/x.ts': '', 'src/routes/+page.ts': "import { x } from '$lib/x'\n" });
  assert.deepStrictEqual(importsOf(root, 'src/routes/+page.ts'), ['src/lib/x.ts']);
  const legacy = buildFromCwd(root, { srcDirs: ['src'], families: 'legacy' });
  assert.strictEqual([...legacy.forward.values()].reduce((n, v) => n + v.length, 0), 0, 'the ranker sees no $lib edge');
});

test('a C file beside Go code never answers a Go import; the Go file does', () => {
  const root = repo({
    'main.go': 'package main\nimport "example.com/m/util"\nfunc main() {}\n',
    'util/a_native.c': 'int x;\n', 'util/b.go': 'package util\n',
  });
  assert.deepStrictEqual(importsOf(root, 'main.go'), ['util/b.go']);
  const ranking = buildFromCwd(root, { srcDirs: ['.'], families: 'legacy' });
  assert.deepStrictEqual((ranking.forward.get(path.join(root, 'main.go').toLowerCase()) || []).map((k) => path.basename(k)), ['b.go']);
});

test('the support list agrees with the walk: PHP is read, Swift is not', () => {
  const { graphSupport, graphLanguageList } = require('../../src/graph/language-support');
  assert.strictEqual(graphSupport('src/Str.php').tracked, true);
  assert.strictEqual(graphSupport('Sources/Str.swift').tracked, false);
  assert.strictEqual(graphSupport('Sources/Str.swift').label, 'Swift');
  assert.ok(graphLanguageList().endsWith('Lua and GDScript'), graphLanguageList());
});

for (const d of made) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (_) { /* best effort */ } }
console.log(`\nimport-resolvers: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
