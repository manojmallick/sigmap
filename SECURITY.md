# Security Policy

## Reporting Security Vulnerabilities

If you discover a security vulnerability in SigMap, please do **not** open a public GitHub issue. Instead, email us at **zzphandyman@gmail.com** with:

- Description of the vulnerability
- Steps to reproduce (if applicable)
- Potential impact
- Suggested fix (optional)

We will acknowledge your report within 48 hours and work with you to fix the issue.

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
| v6.x    | Current release  |
| v5.x    | Community        |
| < v5.0  | Unsupported      |

## Dependencies

SigMap has **zero runtime dependencies**. We regularly audit our development dependencies for vulnerabilities using GitHub's Dependabot.
