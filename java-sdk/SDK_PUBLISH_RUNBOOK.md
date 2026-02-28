# SDK Publish Runbook

## Constraints

- All four artifacts (SDK, Spring Boot Starter, Test, BOM) share **one version number** per release.
- Once a version is published to Nexus, it **cannot be re-released** — bump to a new version instead.
- All four artifacts deploy together (the OpenPR workflow builds and validates everything as a unit).
- The Starter and Test compile against the **previous** SDK release (the latest version already in Nexus at build time).
- The aggregator POM (`java-sdk/pom.xml`) is for local builds only — it is **not** published to Nexus.

## How the BOM Works

Consumers import the BOM in their `<dependencyManagement>` section. The BOM pins all three artifact versions (SDK, Starter, Test) to a single `<eventlog.version>` property.

When a consumer pulls in the Starter, the Starter internally depends on SDK version N (the previous release). However, because the BOM declares SDK version N+1, Maven's dependency mediation resolves the SDK to N+1 — so **consumers always get the current-release SDK**, even though the Starter was compiled against the previous one.

This works because the SDK maintains backward compatibility between consecutive releases (the Starter compiled against N still runs fine with N+1 at runtime).

## Scenario A: Standard Release (no Starter/Test code changes needed)

The SDK change is self-contained — no code changes required in the Starter or Test modules. They just get a version bump.

**Example: releasing version 1.1.0 (previous release was 1.0.0)**

| Step | Action |
|------|--------|
| 1 | Bump `<version>` to `1.1.0` in **all four** POMs (SDK, Starter, Test, BOM) |
| 2 | In Starter and Test, set `<eventlog-sdk.version>` to `1.0.0` (previous release) |
| 3 | In BOM, set `<eventlog.version>` to `1.1.0` (current release) |
| 4 | Update the aggregator POM version to `1.1.0` |
| 5 | Open PR — CI builds all four, Starter/Test compile against SDK 1.0.0 from Nexus |
| 6 | Merge — all four artifacts deploy to Nexus as 1.1.0 |

## Scenario B: Breaking SDK Change (Starter/Test need code updates)

The SDK introduces a new or changed API that the Starter or Test must use. This requires **two releases** because the Starter/Test can only compile against a version that already exists in Nexus.

**Example: SDK adds a new method that the Starter needs to call**

### Release N+1 (ship the SDK change)

| Step | Action |
|------|--------|
| 1 | Bump `<version>` to `N+1` in all four POMs |
| 2 | Make the SDK code changes (new/changed API) |
| 3 | Starter and Test: version bump only, **no code changes** — they compile against SDK N |
| 4 | In BOM, set `<eventlog.version>` to `N+1` |
| 5 | Deploy all four as N+1 |

At this point SDK N+1 exists in Nexus, but the Starter isn't using the new API yet.

### Release N+2 (update Starter/Test to use the new API)

| Step | Action |
|------|--------|
| 1 | Bump `<version>` to `N+2` in all four POMs |
| 2 | In Starter and Test, set `<eventlog-sdk.version>` to `N+1` (now available in Nexus) |
| 3 | Make Starter/Test code changes that use the new SDK API |
| 4 | In BOM, set `<eventlog.version>` to `N+2` |
| 5 | Deploy all four as N+2 |

Now consumers on the BOM get SDK N+2 and a Starter that uses the new API.

## POM Version Cheat Sheet

For a release at version **X** where the previous release was **P**:

| File | `<version>` | Property | Property Value |
|------|-------------|----------|----------------|
| `eventlog-sdk/pom.xml` | X | *(none)* | — |
| `eventlog-spring-boot-starter/pom.xml` | X | `<eventlog-sdk.version>` | P |
| `eventlog-test/pom.xml` | X | `<eventlog-sdk.version>` | P |
| `eventlog-sdk-bom/pom.xml` | X | `<eventlog.version>` | X |
| `pom.xml` (aggregator) | X | *(none)* | — |

## Files to Modify

### `eventlog-sdk/pom.xml`
- Line 9: bump `<version>` to X

### `eventlog-spring-boot-starter/pom.xml`
- Line 9: bump `<version>` to X
- Line 20: set `<eventlog-sdk.version>` to P (previous release)

### `eventlog-test/pom.xml`
- Line 9: bump `<version>` to X
- Line 19: set `<eventlog-sdk.version>` to P (previous release)

### `eventlog-sdk-bom/pom.xml`
- Line 9: bump `<version>` to X
- Line 16: set `<eventlog.version>` to X (current release)

### `pom.xml` (aggregator — not published)
- Line 9: bump `<version>` to X
