# SUCCESSION

## Emergency Credential Holder

In the unlikely event that the primary maintainer is unreachable for more than 90 consecutive days, the following individual has been designated as the emergency credential holder for the SigMap project.

<!-- TODO(@manojmallick): Fill in the real emergency holder below before merging.
     This must be a real, named person with verifiable contact info.
     The org migration (acceptance item 2 of #705) is still pending —
     the "Assets" section below reflects the current (pre-migration) state. -->

- **Name:** `TODO(@manojmallick)`
- **GitHub Username:** `TODO`
- **Email:** `TODO`

### Assets that need handing over

The holder needs access to these assets (no org exists today; `gh repo view manojmallick/sigmap --json isInOrganization` → `inOrg=false`):

| Asset | Current state | What to hand over |
|-------|--------------|-------------------|
| **GitHub repo admin** | Personal repo under `manojmallick` | Add holder as a collaborator with admin access |
| **npmjs.com package owner** | `sigmap` on npm | Add holder as npm owner (`npm owner add`) |
| **sigmap.io domain** | DNS registrar account | Transfer or delegate DNS access |
| **OIDC Trusted Publishing** | No transferable token — releases use GitHub Actions OIDC (`npm-publish.yml`) | No action needed — whoever merges to `main` and pushes a tag can publish |
| **NPM_TOKEN (prerelease only)** | Exists in `prerelease-publish.yml` secrets | Grant the holder access to repo secrets (requires admin) |

There is no "secret vault" and no single transferable NPM token for production releases. Production publishes use npm Trusted Publishing (OIDC), which authenticates via the GitHub Actions runner — no token expires or needs rotation.

## Transfer procedure

1. Verify the primary maintainer has been unresponsive for 90+ days.
2. The emergency holder ensures they have repo admin access (step 1 of Assets table above).
3. The holder runs the normal release flow: `/update-docs` (version bump + CHANGELOG) → `/ship` (PR `develop` → `main`, tag on merge commit). The tag push triggers `npm-publish.yml` via OIDC — no manual publish step.
4. Document the hand-off in `CHANGELOG.md`.
5. **Org migration** (blocked on acceptance item 2 of [#705](https://github.com/manojmallick/sigmap/issues/705)): once the repo is migrated to a GitHub org, the holder should be added as an org owner. GitHub auto-redirects old URLs; the npm package is unaffected.

## Governance

- This document is part of the Phase-1 governance deliverables (issue [#705](https://github.com/manojmallick/sigmap/issues/705)).
- It will be reviewed annually and updated as personnel changes.
- See `docs/RELEASING.md` for the full release pipeline.
