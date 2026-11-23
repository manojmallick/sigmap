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

`test/integration/agent-ab.test.js` exercises the agent A/B harness's search tools, which run [ripgrep](https://github.com/BurntSushi/ripgrep) (`brew install ripgrep`, `apt-get install ripgrep`). CI installs it. Without it on your machine those few assertions are skipped and say so; with `CI` set they fail.

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
6. **Write `test/labels/{language}.json` by hand**, from reading the fixture and not from what the extractor prints (step 3 only records the extractor's own output, so it cannot tell you the extractor is right): `defines` lists at least 5 names the fixture declares that the extractor should list, and `probes` has at least one small source in your language where a declaration-looking line sits in a comment or a string (`mustNotContain`) beside one real declaration (`mustContain`). See `test/labels/go.json`. Then run `node scripts/check-extractor-labels.mjs {language}`: at least 95% of `defines` must be listed and every probe must pass. A reviewer reads your labels instead of your regular expressions, so keep them honest.
7. Run `node test/integration/all.js` — every integration suite must pass

## Extractor contract

```javascript
'use strict';

const { capWithNotice } = require('../util/truncate');

// Above the default `maxSigsPerFile` (25), so for any limit up to 200 the configured budget decides
// what is written; a larger setting is capped here. Most in-tree extractors use 200 (#576).
const PER_FILE_LIMIT = 200;

function extract(src) {
  if (!src || typeof src !== 'string') return [];
  const sigs = [];
  // ... regex extraction only — no npm packages ...
  return capWithNotice(sigs, PER_FILE_LIMIT, 'signatures');
}

module.exports = { extract };
```

Rules:
- Never throw — return `[]` on any error
- Never exceed 200 signatures per file (`PER_FILE_LIMIT`), and say so when you cut: `capWithNotice` (`src/util/truncate.js`) appends `… +N more signatures`. The generated context file then keeps the first `maxSigsPerFile` (default 25) of what the extractor returns, and the retrieval index up to `maxIndexSigsPerFile` (default 200; never fewer than `maxSigsPerFile`, never more than the extractor returned); neither cut belongs in the extractor
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
