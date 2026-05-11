# Contributing to SigMap

Thanks for contributing to SigMap.

SigMap uses a `develop` branch for active development and `main` for stable releases.

## Branch workflow

Please open pull requests against:

```
develop
```

Not directly against:

```
main
```

## Recommended branch names

```
feature/opencode-agents-md
feature/mcp-docs
feature/explain-savings
fix/watch-docs
docs/ecosystem-page
test/parser-fixtures
```

## Pull request checklist

Before opening a PR, please check:

* [ ] The change has a clear purpose
* [ ] Tests were added or updated when needed
* [ ] Existing tests pass
* [ ] Documentation was updated for user-facing changes
* [ ] README was updated if the public behavior changed
* [ ] Benchmark numbers were not changed without fresh benchmark data
* [ ] No new dependency was added unless discussed first

## Local commands

```bash
npm test
```

If the change affects parsing, ranking, context generation, or token output, please also run the relevant benchmark command documented in the benchmark guide.

## Contributor credit

Contributors are credited in:

* the original PR
* `CHANGELOG.md`
* release PRs
* GitHub release notes

Each merged PR should include a short line in `CHANGELOG.md` under `Unreleased`. Example:

```md
- Added OpenCode / AGENTS.md documentation by @username in #24.
```

When a PR is squashed, we preserve contributor credit in the commit message:

```
Co-authored-by: Name <email@example.com>
```

## Adding a language extractor

1. Create `src/extractors/{language}.js` following the contract below
2. Create `test/fixtures/{language}.{ext}` with representative code
3. Run `node test/run.js --update {language}` to generate expected output
4. Review the expected output — it should contain only signatures, no bodies
5. Run `node test/run.js` — must be 21/21 PASS before opening a PR
6. Run `node test/integration/all.js` — 17/17 integration suites must pass

## Extractor contract

```javascript
'use strict';

function extract(src) {
  if (!src || typeof src !== 'string') return [];
  const sigs = [];
  // ... regex extraction only — no npm packages ...
  return sigs.slice(0, 25);
}

module.exports = { extract };
```

Rules:
- Never throw — return `[]` on any error
- Never exceed 25 signatures per file
- Strip all bodies — nothing after opening `{`
- Strip all comments
- Indent methods 2 spaces inside their class/struct
- Return `[]` for empty or unparseable input
- Use only Node.js built-ins (`fs`, `path`, etc.) — no npm packages

## Commit format

```
type(scope): short description (under 72 chars)

Types: feat / fix / docs / test / chore / refactor / perf
Scopes: core / extractor / mcp / security / config / map / ci / docs / test
```

## Running tests

```bash
node test/run.js              # all languages
node test/run.js typescript   # one language
node test/run.js --update     # regenerate all expected outputs
```
