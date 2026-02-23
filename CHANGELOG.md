# Changelog

All notable changes for this repository are tracked in this file.

## [1.0.0] - 2026-02-23

### Added
- Added `POST /v1/debug/events/clear` as a temporary maintenance endpoint gated by explicit confirmation payload (`{ "confirm": true }`).
- Added Fastify server guardrails in API bootstrap:
  - `requestTimeout: 30_000`
  - `bodyLimit: 1_048_576`
- Added API test coverage for debug clear endpoint behavior and request-size enforcement.

### Changed
- Moved destructive clear operation out of public events routes.
- Reset canonical API and Java SDK versioning to `1.0.0`.
- Updated Java SDK module versions and documentation snippets to `1.0.0`.
- Upgraded JaCoCo Maven plugin to `0.8.13` across Java SDK modules.

### Fixed
- Casing alignment between API read models and Java SDK deserialization contracts.
- WireMock fixtures and SDK tests updated to use camelCase API contracts.

### Security
- Removed unauthenticated public clear route (`DELETE /v1/events`) from the public events surface.
- Added explicit TODO markers to remove debug clear capabilities before production staging.

### TODO
- Add MSSQL real-database integration tests once CI can support containerized database jobs.
