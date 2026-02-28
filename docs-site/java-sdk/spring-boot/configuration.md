---
title: Configuration Reference
---

# Configuration Reference

Full property reference for the Spring Boot starter.

## Properties

| Property | Type | Default | Description |
| --- | --- | --- | --- |
| `eventlog.enabled` | boolean | `false` | Enable Spring Boot auto-configuration |
| `eventlog.base-url` | string | — | Base URL for the Event Log API (required when enabled) |
| `eventlog.application-id` | string | — | App identifier for headers and annotation logging |
| `eventlog.connect-timeout` | duration | `10s` | HTTP connect timeout (`3s` in dev/local/test) |
| `eventlog.request-timeout` | duration | `30s` | HTTP request timeout (`10s` in dev/local/test) |
| `eventlog.max-retries` | int | `3` | Retry attempts for 5xx/429 responses |
| `eventlog.retry-delay` | duration | `500ms` | Base retry delay (`200ms` in dev/local/test) |
| `eventlog.api-key` | string | — | Static API key (dev/testing only) |
| `eventlog.transport` | string | auto | `webclient` \| `restclient` \| `jdk` |
| `eventlog.target-system` | string | applicationId | Override annotation target system |
| `eventlog.originating-system` | string | applicationId | Override annotation originating system |

### OAuth

| Property | Type | Default | Description |
| --- | --- | --- | --- |
| `eventlog.oauth.token-url` | string | — | OAuth token endpoint |
| `eventlog.oauth.client-id` | string | — | OAuth client ID |
| `eventlog.oauth.client-secret` | string | — | OAuth client secret |
| `eventlog.oauth.scope` | string | — | OAuth scope string |
| `eventlog.oauth.refresh-buffer` | duration | `60s` | Refresh token buffer |
| `eventlog.oauth.connect-timeout` | duration | `10s` | OAuth connect timeout (`3s` in dev/local/test) |
| `eventlog.oauth.request-timeout` | duration | `30s` | OAuth request timeout (`10s` in dev/local/test) |

### Async

| Property | Type | Default | Description |
| --- | --- | --- | --- |
| `eventlog.async.enabled` | boolean | `true` | Enable async logger |
| `eventlog.async.queue-capacity` | int | `10000` | Queue capacity |
| `eventlog.async.max-retries` | int | `3` | Max retries per event |
| `eventlog.async.base-retry-delay-ms` | long | `1000` | Base retry delay (`500` in dev/local/test) |
| `eventlog.async.max-retry-delay-ms` | long | `30000` | Max retry delay (`5000` in dev/local/test) |
| `eventlog.async.circuit-breaker-threshold` | int | `5` | Failures before circuit opens |
| `eventlog.async.circuit-breaker-reset-ms` | long | `30000` | Circuit reset time |
| `eventlog.async.spillover-path` | path | — | Spillover directory for disk persistence |
| `eventlog.async.virtual-threads` | boolean | `false` | Use virtual threads for async logging |
| `eventlog.async.executor` | string | — | `virtual` \| `spring` \| bean name |

### Annotation

| Property | Type | Default | Description |
| --- | --- | --- | --- |
| `eventlog.annotation.enabled` | boolean | `true` | Enable `@LogEvent` AOP |

### Refresh

| Property | Type | Default | Description |
| --- | --- | --- | --- |
| `eventlog.refresh.enabled` | boolean | `true` | Enable refresh-scoped beans when Spring Cloud Config is present |

## Notes

- `eventlog.application-id` defaults to `spring.application.name` for annotation-based logging when unset.
- Profile-aware defaults apply when the active profile includes `dev`, `local`, or `test`.
