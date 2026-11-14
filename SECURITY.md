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
- Use `.sigmapignore` to exclude sensitive files from analysis
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
