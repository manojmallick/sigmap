'use strict';

/**
 * Dart `import`, `export` and `part` (#980).
 *
 * `import 'x.dart'`, `export 'x.dart'` and `part 'x.g.dart'` resolve next to the file;
 * `part of 'x.dart'` points back at the library. `package:name/path.dart` resolves
 * through the packages the repository itself holds: a package is a directory with a
 * `pubspec.yaml`, its name is that file's `name:`, and its code is under `lib/`. So in
 * a monorepo `package:flutter_riverpod/x.dart` reaches `packages/flutter_riverpod/lib/x.dart`.
 * `dart:` libraries and packages that are not in the repository (`package:flutter/...`,
 * `package:test/...`) miss the set and yield nothing.
 *
 * A conditional import (`import 'a.dart' if (dart.library.io) 'a_io.dart';`) is one
 * statement with several possible targets; every one that is a file of the set is an
 * edge, because any of them can be the file that is compiled in.
 *
 * @module src/graph/resolvers/dart
 */

const path = require('path');
const { ancestorDirs, perBuild, readText, inSet, dirHas, graphKey, stripComments } = require('./shared');

const EXTS = new Set(['.dart']);

/** package name -> lib directory, for every pubspec.yaml above any file of the set. */
function packages(fileSet, cwd) {
  return perBuild(fileSet, 'dart:packages', () => {
    const roots = new Set();
    const seen = new Set();
    for (const k of fileSet) {
      if (!k.endsWith('.dart')) continue;
      for (const a of ancestorDirs(path.dirname(k), cwd)) {
        if (seen.has(a)) break;       // everything above it was already visited
        seen.add(a);
        if (dirHas(a, 'pubspec.yaml')) roots.add(a);
      }
    }
    const byName = new Map();
    for (const root of roots) {
      const m = /^name:[ \t]*['"]?([A-Za-z_][\w]*)['"]?[ \t]*$/m.exec(readText(path.join(root, 'pubspec.yaml')));
      if (m && !byName.has(m[1])) byName.set(m[1], path.join(root, 'lib'));
    }
    return byName;
  });
}

// A directive runs to its `;` and may hold conditional URIs after the first one.
const DIRECTIVE = /^[ \t]*(import|export|part[ \t]+of|part)[ \t]+((?:'[^'\n]*'|"[^"\n]*")[^;]*);/gm;
const URI = /(?:'([^'\n]*)'|"([^"\n]*)")/g;

function extract(filePath, content, fileSet, cwd) {
  const text = stripComments(content);
  const dir = path.dirname(filePath);
  const self = graphKey(filePath);
  const out = [];
  let m;
  DIRECTIVE.lastIndex = 0;
  while ((m = DIRECTIVE.exec(text)) !== null) {
    const uris = [];
    URI.lastIndex = 0;
    let u;
    while ((u = URI.exec(m[2])) !== null) uris.push(u[1] !== undefined ? u[1] : u[2]);
    // `show` / `hide` / `as` clauses name symbols, not files, so only strings are read; a
    // string after `if (...)` is a conditional target, but a bare `show 'x'` cannot occur.
    for (const uri of uris) {
      let k = null;
      if (uri.startsWith('package:')) {
        const rest = uri.slice('package:'.length);
        const slash = rest.indexOf('/');
        if (slash < 0) continue;
        const lib = packages(fileSet, cwd).get(rest.slice(0, slash));
        if (lib) k = inSet(fileSet, path.join(lib, rest.slice(slash + 1)));
      } else if (!/^[a-z][a-z0-9+.-]*:/i.test(uri)) {     // dart:, http:, ... are not files of the set
        k = inSet(fileSet, path.resolve(dir, uri));
      }
      if (k && k !== self) out.push(k);
    }
  }
  return out;
}

module.exports = { name: 'Dart', EXTS, extract };
