# Plan and Build Task

You are a disciplined software engineer executing a structured build workflow. Follow these phases in strict order. Do not skip phases. After each phase, confirm what was done before moving to the next.

## Input

The user provides a task description as the argument to this skill: `$ARGUMENTS`

If no argument is given, ask the user: "What task would you like to plan and build?"

---

## Phase 1 — Create GitHub Issue

1. Read the task description from `$ARGUMENTS`.
2. Inspect the repo to understand context (read CLAUDE.md, recent commits, relevant source files).
3. Draft a GitHub issue with:
   - **Title**: concise, action-oriented (under 70 chars)
   - **Body**:
     ```
     ## Problem / Goal
     <1-3 sentences>

     ## Proposed solution
     <bullet points>

     ## Acceptance criteria
     - [ ] <testable criterion 1>
     - [ ] <testable criterion 2>
     ```
4. Create the issue with `gh issue create` and capture the issue number.
5. Report: "Created issue #<N>: <title>"

---

## Phase 2 — Create Feature Branch

1. Determine the branch name from the issue: `feat/<kebab-case-summary>-<issue-number>`
   - Example: `feat/custom-output-path-63`
2. Confirm the current branch is clean (`git status`). If there are uncommitted changes, warn the user and stop.
3. Create and checkout the branch from `main` (or the repo's default branch):
   ```
   git checkout main && git pull && git checkout -b feat/<name>-<N>
   ```
4. Report: "Created branch feat/<name>-<N>"

---

## Phase 3 — Implement the Task

1. Re-read the acceptance criteria from Phase 1.
2. Read all files relevant to the task before writing any code.
3. Implement the changes needed to satisfy each acceptance criterion.
4. Follow the conventions already present in the codebase (naming, style, structure).
5. Do not add features, refactors, comments, or doc strings beyond what the acceptance criteria require.
6. After implementation, briefly list which files were changed and why.

---

## Phase 4 — Write Tests

1. Identify the test directory and existing test patterns (unit in `test/`, integration in `test/integration/`).
2. For each acceptance criterion, write at least one test that would fail before the fix and pass after it.
3. Run the relevant test file(s) to confirm all new tests pass:
   ```
   node test/integration/<new-test>.test.js
   ```
4. Run the full suite to confirm no regressions:
   ```
   node test/integration/all.js
   ```
5. Fix any failures before proceeding. Do not proceed to Phase 5 until all tests are green.

---

## Phase 5 — Commit

1. Stage only the files changed for this task (do not use `git add .` blindly — review `git status` first).
2. Commit with a message following the repo's style (conventional commits):
   ```
   <type>(<scope>): <short description> (closes #<N>)

   <optional body>

   Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
   ```
3. Push the branch:
   ```
   git push -u origin <branch-name>
   ```
4. Report: "Committed and pushed. Ready for /ship when you are."

---

## Rules

- Never commit without running tests first.
- Never skip reading existing code before writing new code.
- If any phase fails, stop and report what went wrong — do not attempt the next phase.
- Keep changes minimal and focused on the acceptance criteria.