---
title: Branching Strategy
---

# Branching & Versioning Strategy

## Versioning

This project follows [Semantic Versioning](https://semver.org/):

```
MAJOR.MINOR.PATCH
```

| Increment | When | Example |
|-----------|------|---------|
| **PATCH** | Bug fixes, no API changes | `1.0.8` -> `1.0.9` |
| **MINOR** | New features, backward compatible | `1.0.x` -> `1.1.0` |
| **MAJOR** | Breaking API changes | `1.x.x` -> `2.0.0` |

## Branches

### `main`

Active development branch. All feature branches merge here.

- Always contains the latest `-SNAPSHOT` version
- PR checks must pass before merging
- Releases are triggered from this branch (until a release branch exists)

### `feature/*`

Short-lived branches for new work.

```
git checkout -b feature/add-retry-metrics main
# ... make changes ...
# PR -> main
```

### `release/X.Y`

Long-lived maintenance branches. Created **only when moving to the next minor or major version**.

```
release/1.0   <- patches for 1.0.x consumers
release/1.1   <- patches for 1.1.x consumers
main          <- developing toward 1.2.0 or 2.0.0
```

## Workflow

### Day-to-Day Development

```
1. Create feature branch from main
2. Make changes, push, open PR
3. PR checks pass -> merge to main
4. main auto-publishes SNAPSHOT
5. When ready -> trigger release
```

### Starting a New Minor Version

When you're ready to develop `1.1.0` and consumers need continued `1.0.x` support:

```
1. Create release/1.0 from main         <- preserves 1.0.x for patches
2. Bump main to 1.1.0-SNAPSHOT          <- main moves forward
3. Update sub-deps on main as needed
4. Continue feature development on main
```

### Hotfixing an Older Version

When a consumer on `1.0.x` reports a bug and can't upgrade to `1.1.x`:

```
1. Fix the bug on main first             <- always fix forward
2. Cherry-pick the commit to release/1.0
3. PR to release/1.0
4. Merge -> release/1.0 auto-publishes 1.0.x-SNAPSHOT
5. Trigger release -> 1.0.10 published
```

### Releasing

```
1. Merge all pending PRs to main (or release branch)
2. SNAPSHOT auto-publishes on merge
3. Trigger release workflow -> strips -SNAPSHOT, publishes release
4. Tag is created: v1.0.9
5. Housekeeping PR: bump to next SNAPSHOT, update sub-deps to released version
```

## Module Sub-Dependencies

The starter and test modules depend on the core SDK. Due to pipeline constraints, sub-dependencies must point to a **previously published version** (not the current SNAPSHOT).

After each release, a housekeeping PR updates sub-deps:

```
eventlog-spring-boot-starter -> eventlog-sdk:<last-released-version>
eventlog-test                -> eventlog-sdk:<last-released-version>
eventlog-sdk-bom             -> all modules at <current-module-version>
```

## Release Branch Rules

- **Maintain at most 2 release branches** — current and previous minor version
- **Always fix on `main` first**, then cherry-pick back to release branches
- **Patch releases only** — no new features on release branches
- **Tag every release** — `git tag v1.0.9`
- **EOL older branches** when they are no longer supported

## Version Support Matrix

| Branch | Status | Receives |
|--------|--------|----------|
| `main` | Active development | All changes |
| `release/1.1` | Current stable | Bug fixes, security patches |
| `release/1.0` | Previous stable | Critical bug fixes, security patches |
| Older | End of life | No updates — consumers must upgrade |
