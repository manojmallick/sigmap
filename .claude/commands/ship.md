# Ship — Release Prep and Pull Request

You are preparing a finished feature branch for release. Follow these phases in order. Do not skip any phase. After each phase confirm what was done.

## Input

Optional argument `$ARGUMENTS` may provide a version bump hint: `patch` | `minor` | `major`. Default is `patch`.

---

## Phase 1 — Confirm Readiness

1. Run `git status` — confirm the branch is clean (all changes committed).
2. Run the full test suite and confirm 0 failures:
   ```
   node test/integration/all.js
   ```
3. If tests fail, stop and report what failed. Do not proceed until they are green.
4. Read `package.json` to get the current version.
5. Compute the new version by bumping `$ARGUMENTS` (default: patch):
   - patch: `4.1.2` → `4.1.3`
   - minor: `4.1.2` → `4.2.0`
   - major: `4.1.2` → `5.0.0`
6. Report: "Current version: X.Y.Z → New version: A.B.C"

---

## Phase 2 — Update package.json

1. Open `package.json` and update the `"version"` field to the new version.
2. Do not change anything else in `package.json`.

---

## Phase 3 — Update CHANGELOG.md

1. Read `CHANGELOG.md` to understand the existing format.
2. Run `git log --oneline main..HEAD` to see all commits on this branch.
3. Add a new section at the top (below any `[Unreleased]` heading) for the new version:
   ```markdown
   ## [A.B.C] — YYYY-MM-DD

   ### Added / Fixed / Changed
   - <one line per meaningful change derived from commits>
   ```
4. Use today's date (read from system). Keep entries concise — one line each.
5. Do not modify any existing changelog entries.

---

## Phase 4 — Update VERSION constant in gen-context.js (if present)

1. Search `gen-context.js` for `const VERSION = '` or `VERSION = "`.
2. If found, update the version string to match the new version.
3. If not found, skip this phase.

---

## Phase 5 — Update Docs and Other Version References

1. Search for version strings across the project:
   ```
   grep -r "X\.Y\.Z" --include="*.md" --include="*.kts" --include="*.json" --include="*.html" .
   ```
   (Replace X.Y.Z with the old version.)
2. Update any version references found in:
   - `jetbrains-plugin/build.gradle.kts` → `version = "A.B.C"`
   - `docs/*.html` or `README.md` if they contain hardcoded version numbers
   - Any other files that reference the old version string
3. Do not change files that don't contain the old version.

---

## Phase 6 — Run Version Sync Script (if present)

1. Check if `scripts/sync-versions.mjs` exists.
2. If it exists, run it:
   ```
   node scripts/sync-versions.mjs
   ```
3. If it doesn't exist, skip this phase.

---

## Phase 7 — Final Test Run

1. Run the full integration suite one more time to confirm nothing broke:
   ```
   node test/integration/all.js
   ```
2. If any failures, fix them before committing.

---

## Phase 8 — Commit Release Changes

1. Review `git status` and stage all files changed in Phases 2–6.
2. Commit with:
   ```
   chore(release): vA.B.C

   Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
   ```
3. Push:
   ```
   git push
   ```

---

## Phase 9 — Create Pull Request

1. Read all commits on the branch (`git log --oneline main..HEAD`) to build the PR summary.
2. Create the PR:
   ```
   gh pr create --title "<type>: <short description>" --body "..."
   ```
   PR body format:
   ```markdown
   ## Summary
   - <bullet: what changed>
   - <bullet: why / closes #N>

   ## Changes
   - <file or area>: <what was done>

   ## Test plan
   - [ ] All integration tests pass (`node test/integration/all.js`)
   - [ ] Manual smoke test: `node gen-context.js --health`

   🤖 Generated with [Claude Code](https://claude.com/claude-code)
   ```
3. Print the PR URL.

---

## Rules

- Never bump the version without running tests first.
- Never create a PR from a branch with failing tests.
- Only edit files that genuinely need updating — do not touch unrelated files.
- If the branch is already named `main` or `master`, stop and warn the user.