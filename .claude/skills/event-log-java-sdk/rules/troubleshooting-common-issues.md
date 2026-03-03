---
title: Troubleshooting Common Issues
impact: MEDIUM
impactDescription: saves debugging time for common SDK integration problems
tags: troubleshooting, debug, common-issues, checklist
---

## Troubleshooting Common Issues

A checklist of the most common Event Log SDK integration problems and their solutions.

### SDK Not Logging

```yaml
# Verify these settings:
eventlog:
  enabled: true          # Must be true (default is false)
  base-url: http://...   # Must be set
```

- Confirm the active Spring profile is not overriding `enabled` to `false`
- Check application startup logs for `EventLog auto-configuration disabled`

### Startup Fails

- `base-url` is required when `enabled=true` — the SDK validates this on startup
- If any OAuth field is set (`token-url`, `client-id`, `client-secret`), all three must be present
- Check for typos in property names (e.g., `baseUrl` vs `base-url`)

### @LogEvent Not Firing

```java
// Ensure all of these are true:
// 1. eventlog-spring-boot-starter is on the classpath
// 2. Spring AOP is enabled (spring-boot-starter-aop dependency)
// 3. eventlog.annotation.enabled is not set to false
// 4. eventlog.application-id or spring.application.name is set
// 5. The annotated method is called from outside its own class (AOP proxy requirement)
```

### Circuit Breaker Opens Frequently

- Increase `circuit-breaker-threshold` (default: 5) to tolerate more transient failures
- Verify API availability: `curl <base-url>/health`
- Check for 5xx or 429 responses in application logs
- Ensure network connectivity between service and Event Log API

### Events Dropped

- Increase `async.queue-capacity` (default: 10000) if the queue fills up
- Enable spillover: set `async.spillover-path` to persist events to disk
- Monitor `eventlog.queue.depth` metric for early warning

### HTTP Timeouts

```yaml
eventlog:
  connect-timeout: 5s     # Default: 2s
  request-timeout: 10s    # Default: 5s
  oauth:
    connect-timeout: 5s   # Separate timeout for token endpoint
    request-timeout: 10s
```

### Metrics Not Showing

- Add `spring-boot-starter-actuator` dependency
- Expose the metrics endpoint: `management.endpoints.web.exposure.include: metrics`
- Verify `eventlog.metrics.enabled` is not set to `false`

### MDC Not Propagating

- Set `eventlog.mdc-filter.url-patterns` to match your API paths (e.g., `"/api/*"`)
- Verify `X-Correlation-ID` and `X-Trace-ID` headers are present in requests
- For async threads, use `MDC.getCopyOfContextMap()` before spawning and `MDC.setContextMap()` inside the new thread

### Serialization Errors

- Ensure Jackson `jackson-databind` and `jackson-datatype-jsr310` modules are on the classpath
- Use the Boot-managed `ObjectMapper` rather than creating a custom instance
- Check that custom payload objects are serializable (public getters or `@JsonProperty` annotations)
