'use strict';

/**
 * file-class.js — single source of truth for file-category classification.
 *
 * Two subsystems classify files and MUST agree:
 *   1. the token-budget drop order (`gen-context.js`) — what gets dropped first
 *   2. the retrieval penalty (`src/retrieval/ranker.js`) — what gets demoted
 *
 * Before this module they kept divergent private copies, and the ranker's was
 * strictly weaker: its test pattern recognised only `foo.test.js` and `test/`
 * path segments, so Go's `routes_test.go`, Python's `test_foo.py`, Rust's
 * `foo_test.rs` and the JVM's `FooTest.java` were never penalised at all. On
 * the gin routing question that let `routes_test.go` and `middleware_test.go`
 * rank ABOVE `gin.go`, and a root `README.md` rank above `routergroup.go`
 * (#808). The budget order had the correct patterns the whole time (#592).
 *
 * Zero dependencies. Pure string predicates — no fs access, so both the
 * bundled CLI core and every `src/` module can share them.
 */

/** Normalise to forward slashes so Windows paths classify identically. */
function _norm(filePath) {
  return String(filePath || '').replace(/\\/g, '/');
}

/**
 * Test files, across every convention the extractors support.
 *
 * Filename forms: `foo.test.ts`, `foo.spec.js`, `foo_test.go`, `test_foo.py`,
 * plus the PascalCase JVM/C#/Swift family (`FooTest.java`, `FooTests.kt`,
 * `FooSpec.scala`). The `[a-z0-9]` guard keeps `contest.java` and `Latest.java`
 * out — the suffix must fall on a real case boundary.
 *
 * Path-segment forms: `src/test/java/**`, `tests/`, `spec/`, `__tests__/`,
 * `e2e/` — the shape the entire JVM world uses. Without it "drop test files
 * first" ran INVERTED on JVM repos (#592).
 */
function isTestFile(filePath) {
  const p = _norm(filePath);
  if (/\.(test|spec)\.[a-z]+$/.test(p) || /_test\.[a-z]+$/.test(p)) return true;
  if (/(^|\/)test_[^/]+\.[a-z]+$/.test(p)) return true;
  if (/[a-z0-9](Test|Spec)s?\.(java|kt|kts|scala|groovy|cs|swift|m|mm)$/.test(p)) return true;
  if (/[a-z0-9]TestCase\.(m|mm)$/.test(p)) return true;
  return /(^|\/)(test|tests|spec|specs|__tests__|e2e)(\/|$)/i.test(p);
}

/** Mocks, stubs, fakes and fixtures — test scaffolding, not behaviour. */
function isMockFile(filePath) {
  const p = _norm(filePath);
  return /\/(mock|mocks|stub|stubs|fake|fakes|demo|demos|__mocks__|fixtures)\//i.test(p) ||
    /\.(mock|stub|fake)\.[jt]sx?$/.test(p) ||
    /mock\.(ts|js|tsx|jsx)$/.test(p) ||
    /_mock\.[a-z]+$/i.test(p);
}

/** Machine-emitted sources. */
function isGeneratedFile(filePath) {
  return /(\.generated\.|\.pb\.|_pb\.)/.test(_norm(filePath));
}

/** Build output and vendored trees. */
function isGeneratedDir(filePath) {
  return /(^|\/)(dist|build|\.next|\.nuxt|out|\.venv|venv|vendor|target)(\/|$)/i.test(_norm(filePath));
}

/**
 * Prose documentation.
 *
 * Both a directory form (`docs/`, `website/`) and the well-known root
 * filenames. The root form is the half the ranker was missing: `README.md`
 * matched no directory segment, so it carried no penalty and outranked
 * implementation files on "how does" questions (#808). Deliberately keyed on
 * the conventional names rather than "any `.md`", so a repo whose content is
 * genuinely markdown is not blanket-demoted.
 */
function isDocsFile(filePath) {
  const p = _norm(filePath);
  // Deliberately NOT `wiki|man|website`: `src/wiki/generate.js` is the module
  // that BUILDS a wiki, and demoting it cost a gold retrieval task. Directory
  // names that double as domain nouns do not belong here.
  if (/(^|\/)(docs|doc|documentation)(\/|$)/i.test(p)) return true;
  const base = p.slice(p.lastIndexOf('/') + 1);
  return /^(README|CHANGELOG|CHANGES|CONTRIBUTING|CODE_OF_CONDUCT|SECURITY|LICENCE|LICENSE|AUTHORS|NOTICE|HISTORY|UPGRADING|MIGRATING|MAINTAINERS|GOVERNANCE)(\.[a-z]+)?$/i.test(base);
}

/**
 * CI / pipeline definitions.
 *
 * SigMap extracts these on purpose (`src/extractors/pipeline.js`) because
 * "how does CI work" is a real question — so they are indexed, then demoted
 * for every query that is NOT about them. They previously had no category at
 * all, which is why four `.github/workflows/*.yml` files filled ranks 3-6 of a
 * routing query (#807) and Alamofire's `ci.yml` reached the top 5 (#808).
 */
function isCiFile(filePath) {
  const p = _norm(filePath);
  if (/(^|\/)\.github\/(workflows|actions)(\/|$)/i.test(p)) return true;
  if (/(^|\/)\.(circleci|gitlab|buildkite|teamcity)(\/|$)/i.test(p)) return true;
  const base = p.slice(p.lastIndexOf('/') + 1);
  return /^(\.gitlab-ci\.ya?ml|\.travis\.ya?ml|\.drone\.ya?ml|appveyor\.ya?ml|bitbucket-pipelines\.ya?ml|azure-pipelines.*\.ya?ml|Jenkinsfile.*|cloudbuild\.ya?ml)$/i.test(base);
}

module.exports = {
  isTestFile,
  isMockFile,
  isGeneratedFile,
  isGeneratedDir,
  isDocsFile,
  isCiFile,
};
