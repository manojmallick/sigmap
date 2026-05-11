---
title: Release checklist
description: How SigMap releases move from develop to main.
---

# Release checklist

SigMap uses:

```
feature branches → develop → main
```

## Before merging contributor PRs into develop

* [ ] PR targets `develop`
* [ ] CI passes
* [ ] Tests are included if needed
* [ ] Docs are updated if needed
* [ ] `CHANGELOG.md` has a contributor credit line
* [ ] Benchmark claims are not changed without benchmark data

## Before merging develop into main

* [ ] All planned PRs are merged into `develop`
* [ ] CI passes on `develop`
* [ ] Docs build passes
* [ ] Benchmarks are run if needed
* [ ] README is updated
* [ ] `CHANGELOG.md` is finalized
* [ ] Contributor names are included
* [ ] Release notes are drafted

## Release PR format

```
develop → main
```

The release PR should include:

* summary
* included PRs
* contributors
* test results
* benchmark notes
* release notes draft

## After merge to main

* [ ] Create GitHub release
* [ ] Publish release notes
* [ ] Thank contributors
* [ ] Share update if relevant
