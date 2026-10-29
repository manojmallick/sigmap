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
npm test            # the fast unit tests, for the loop while you work
npm run test:ci     # what CI's required test job runs
```

`npm run test:ci` chains the workflow hygiene check, bundle integrity and reproducibility, the metrics consistency check, the unit, Python and integration tests, and the retrieval and grounding gates. A change is ready for review when it passes; a test in `test/integration/` fails if the script and the CI job drift apart. The third-party retrieval gate (`npm run validate:xrepo`) is a separate CI job because it needs the pinned clones; run it when you change extraction, ranking or source-root detection.

If the change affects parsing, ranking, context generation, or token output, please also run the relevant benchmark command documented in the benchmark guide.

## Releases

A release is prepared on `develop` (the version, the changelog entry, the benchmark figures) and reaches `main` through a pull request that a maintainer merges. Merging it does not publish by itself: the `tag-on-merge` workflow tags the prepared version, and the tag starts the npm publish and the binaries.

`tag-on-merge` tags a prepared release only when a runtime file changed since the last release tag. Runtime means `gen-context.js`, `gen-project-map.js`, `src/`, `packages/` and the manifest fields that change what runs after an install (`main`, `bin`, `engines`, the dependency tables). A file that differs only by the version string does not count, and neither do the README, the docs, the benchmarks, the tests or the workflows. A release with no such change reaches `main` without a tag, so npm gets no new version. To see what the rule says before merging:

```bash
npm run check:runtime-change
```

To publish such a release anyway, run the "Tag prepared release" workflow on `main` with `force` set.

The release automation pushes with a GitHub App installation token (the repository variable `RELEASE_APP_CLIENT_ID` and the secret `RELEASE_APP_PRIVATE_KEY`), minted for the job and revoked when it ends, and falls back to the `SYNC_PAT` secret until that is deleted. Both npm publishes, the release (`npm-publish.yml`) and the prerelease (`prerelease-publish.yml`), use npm Trusted Publishing, so no npm token is stored.

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
5. Run `node test/run.js` — every fixture must pass before opening a PR
6. Run `node test/integration/all.js` — every integration suite must pass

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
