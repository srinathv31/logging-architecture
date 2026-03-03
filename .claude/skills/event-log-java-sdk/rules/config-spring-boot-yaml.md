---
title: Spring Boot YAML Configuration
impact: CRITICAL
impactDescription: incorrect YAML config prevents the SDK from functioning
tags: config, yaml, spring-boot, application-yml
---

## Spring Boot YAML Configuration

The Event Log SDK requires correct YAML configuration under the `eventlog` prefix. A minimal config is sufficient for local development, but production environments need the full set of properties including OAuth, async processing, and spillover.

**Incorrect (missing base-url when enabled):**

```yaml
eventlog:
  enabled: true
  # No base-url — causes startup failure
```

**Correct (minimal for local development):**

```yaml
eventlog:
  enabled: true
  base-url: http://localhost:3000
  api-key: dev-key
```

**Correct (full production config):**

```yaml
eventlog:
  enabled: true
  base-url: https://eventlog-api.example.com
  application-id: my-service
  target-system: MY_SERVICE
  originating-system: MY_SERVICE

  oauth:
    token-url: https://auth.example.com/oauth/token
    client-id: my-client
    client-secret: ${EVENTLOG_CLIENT_SECRET}
    scope: eventlog:write eventlog:read

  async:
    enabled: true
    queue-capacity: 10000
    virtual-threads: true
    spillover-path: ./spillover
    replay-interval-ms: 10000

  annotation:
    enabled: true

  mdc-filter:
    url-patterns: "/api/*"
```

When `enabled=true`, the `base-url` property is mandatory. The SDK validates this on startup and fails fast if it is missing. Profile-aware defaults apply automatically for `dev`, `local`, and `test` profiles (e.g., shorter timeouts, relaxed validation).
