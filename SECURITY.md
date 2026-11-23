# Security Policy

## Reporting Security Vulnerabilities

If you discover a security vulnerability in SigMap, please do **not** open a public GitHub issue. Instead, email us at **manoj.mallick079@gmail.com** with:

- Description of the vulnerability
- Steps to reproduce (if applicable)
- Potential impact
- Suggested fix (optional)

We will acknowledge your report within 48 hours and work with you to fix the issue.

## Scope

In scope: the npm package `sigmap` (`gen-context.js`, `gen-project-map.js`, `src/`, `packages/`) and the GitHub Actions workflows that build and publish it (`.github/workflows/`).

The repository also holds a documentation site (`docs-vp/`), benchmarks, tests and scripts. None of these is part of the published package, so a finding there is still welcome, but it is triaged by what it can actually reach.

## Verifying a release

Releases are published from GitHub Actions with npm Trusted Publishing (OIDC) and carry an npm provenance attestation, so a version can be traced to the commit and workflow run that built it:

```sh
npm install sigmap
npm audit signatures            # checks the registry signature and the provenance attestation
npm view sigmap dist.attestations
```

The workflows that publish it pin every action to a commit SHA, run with a read-only token unless a job needs more, and are scanned by CodeQL.

## Security Best Practices

### For Users

- Keep SigMap updated to the latest version
- Review generated signatures before using them in production
- Do not commit API keys or secrets to version control
- To keep a file's signatures out of the generated context files and `.context/sig-index.json`, list it in `.contextignore` and run `sigmap` again (what was generated before keeps the file until you do), then run `sigmap explain <file>` and expect `EXCLUDED` with `Reason: matched .contextignore`; `INCLUDED`, or `EXCLUDED` for another reason, means the pattern did not match.
  - The matcher is simpler than gitignore. Plain paths, `dir/`, `*.ext` and `dir/*` work; a leading `/`, a one-character `?` and a `!` re-include do not, and a pattern that does not match fails open.
  - With `monorepo: true`, a root `.contextignore` is not applied to the packages: put the file in each package's own `.contextignore` and check the package's generated files, because `sigmap explain` is not reliable there.
  - `.sigmapignore` is not a file filter: with auto-detected source roots it only keeps a top-level directory from becoming a source root, and it does nothing when `srcDirs` is set.
- `.contextignore` is not an access control. Among other things, `sigmap lines`, the MCP `get_lines` tool, `--impact`, `--callers` and `node gen-project-map.js` can still read or name an excluded file; the MCP `get_diff_context` tool and `sigmap review-pr` print its signatures when it has changed in git; under the `full`, `per-module` and `hot-cold` strategies a mapped file that imports it names the module in its dependency line; and `.context/extract-cache.json` records its name. To stop an agent reading a file, use the agent's own permission settings and also deny SigMap's file-reading MCP tools (`get_lines`, `get_diff_context`), or do not install the server.
- Validate context before passing it to LLMs

### For Contributors

- Follow OWASP Top 10 security guidelines
- Validate all external inputs
- Use parameterized queries (where applicable)
- Avoid hardcoding secrets
- Run security checks before submitting PRs

## Disclosure Timeline

1. Vulnerability reported
2. We acknowledge receipt (48 hours)
3. We develop a fix
4. We release a patch version
5. We publicly disclose the issue in a security advisory

## Supported Versions

| Version | Security Support |
|---------|------------------|
| v8.x    | Current release  |
| < v8.0  | Unsupported      |

Fixes ship as a new release of the latest 8.x line; earlier releases are not patched separately.

## Zero Dependencies

SigMap has **zero runtime dependencies**, which means:
- No external code is bundled in production
- Minimal attack surface for supply chain vulnerabilities
- No dependency updates needed for runtime security
- Faster, more reliable installations
